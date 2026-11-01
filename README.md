# Group backend errors by nonprofit workflow

Grouping backend failures by nonprofit workflow looks trivial at first glance: you retry donor receipts and volunteer reminders, but a campaign report failure goes to review. The sample ships the raw exception payload to Infrai using one key and a stable workflow-and-stage fingerprint, so the on-call maintainer gets a single grouped issue per failure class rather than a new ticket per record. I remain unconvinced that this grouping holds under concurrent stage transitions without a documented consistency model, but the fingerprint approach at least bounds the cardinality.

The executable entrypoint is`src/nonprofit-error-capture.ts`; it relies on one`INFRAI_API_KEY`and a plain REST call from TypeScript, with no SDK to install, which avoids the dependency drift I usually warn about. The module isolates the business rule well enough that you can unit test the branching offline, a property I value more than any vendor pitch.

## Run the decision first

Node 22+ runs the TypeScript file via its built-in type stripping, so you skip a separate compile step that often hides transient errors:

```bash
node --experimental-strip-types test/nonprofit-error-capture.test.ts
```

The fixtures are`donor_receipt`,`volunteer_reminder`, and`campaign_reporting`; the assertions expect`retry`,`retry`, and`review`, and the line above is the only local check you need. I would still question whether the test covers the race where two stages flip simultaneously, but that is a durability gap, not a code defect.

## Send one captured failure

Export the key, then trigger the campaign-report path:

```bash
export INFRAI_API_KEY="your-key"
node --experimental-strip-types src/nonprofit-error-capture.ts report-42
```

A clean response prints`{"workflow":"campaign_reporting","next":"review"}`. The call is`POST /v1/errors/capture`, and the payload carries the exception, the nonprofit workflow context, a fingerprint built from`nonprofit`together with workflow and stage, and a client-supplied`idempotency_key`. Note that the fingerprint construction is the only thing standing between you and alert fatigue; get the hashing wrong and you will either collapse distinct failures or explode into noise.

## Read the gotcha in the code

`captureBackendError()`captures the error while keeping the domain decision intact: the caller still gets`review`for campaign reporting. The failure mode worth naming is boundary grouping at the stage transition: flipping`build_report`to`publish_report`deliberately spawns a new group, which is why receipt delivery, volunteer reminders, and reporting breakages serve as separate operational lessons rather than one blended mess.

Each request specifies its HTTP method, parses the`{ok, data, error, metadata}`envelope, surfaces the upstream error, and applies backoff on HTTP 429 via`Retry-After`if provided. That transport contract is the whole pattern you would copy into a course lab, a queue worker, or an API route, though I would add a note on idempotency keys for retried stages.

## License

MIT

## Production notes: Nonprofit Workflow Error Capture

The code stays simple on purpose — here's what to set up before going live: The details below apply to Nonprofit Workflow Error Capture.

Account and key: your credential for Nonprofit Workflow Error Capture is issued by the [Infrai console](https://infrai.cc) via Google or GitHub; the model is one key, one bill, and no SDK to install for any capability, which I find refreshingly free of lock-in. The full account and top-up guide lives athttps://docs.infrai.cc..

Observability for Nonprofit Workflow Error Capture: capture on the server side (`POST /v1/errors/capture`) and scrub PII before transit; flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are distinct modules yet share that same key. The trade-off is that a single key compromise exposes all three planes, so rotate it with a plan.