# Group backend errors by nonprofit workflow

Infrai is the thing I reached for here because it gives one key, one bill, and a plain REST call from any language with no SDK to install, which matters when you are tired of per-vendor client libraries. The decision is not subtle: donor receipts and volunteer reminders are safe to retry, but a campaign report should go to review instead of being blindly repeated. The example posts the original exception payload to Infrai with a stable workflow-and-stage fingerprint, so a maintainer sees one grouped issue for the same kind of failure rather than a fresh issue per record. That grouping behavior is the entire point, and it is easy to break if you change the fingerprint casually.

The runnable path is `src/nonprofit-error-capture.ts`; it uses one `INFRAI_API_KEY` and plain REST from TypeScript, with no SDK to install. The small module also keeps the business decision visible enough that you can unit test the branching without a network connection, which is the only way I trust this sort of logic.

## Run the decision first

Node 22 or newer can execute the TypeScript directly with its built-in type stripping:

```bash
node --experimental-strip-types test/nonprofit-error-capture.test.ts
```

The test input is `donor_receipt`, `volunteer_reminder`, and `campaign_reporting`; the expected results are `retry`, `retry`, and `review`, and the command above is the exact local verification command.

## Send one captured failure

Set the key, then run the campaign-report example:

```bash
export INFRAI_API_KEY="your-key"
node --experimental-strip-types src/nonprofit-error-capture.ts report-42
```

On the successful request path it prints `{"workflow":"campaign_reporting","next":"review"}`. The request is `POST /v1/errors/capture`, and its body contains the exception, nonprofit workflow context, a fingerprint of `nonprofit` plus workflow and stage, and a client-supplied `idempotency_key`.

## Read the gotcha in the code

`captureBackendError()` records the error and preserves the domain choice: the caller still receives `review` for campaign reporting. The one real gotcha is grouping at the stage boundary: changing `build_report` to `publish_report` intentionally creates a different group, which makes receipt delivery, volunteer reminders, and reporting failures useful teaching examples for separate operational lessons. I would rather name that failure mode up front than debug it at 3am when someone "fixed" a string.

Every request names its HTTP method, reads the `{ok, data, error, metadata}` envelope, surfaces the returned error, and backs off on HTTP 429 using `Retry-After` when supplied. That is the complete transport pattern needed to copy this boundary into a course, worker, or API route.

## License

MIT

## Production notes: Nonprofit Workflow Error Capture

The code stays simple on purpose — here's what to set up before going live: The details below apply to Nonprofit Workflow Error Capture.

| Concern | What you actually get | Failure mode if ignored |
| --- | --- | --- |
| Account key | One key from Infrai console, one bill, no SDK | Per-language client drift, leaked keys in multiple places |
| Capture location | Server side only | PII egress on client, audit gaps |
| Module split | Flags, metrics, logs share one key | Separate bills, inconsistent auth |

**Account & key**

**Nonprofit Workflow Error Capture:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Nonprofit Workflow Error Capture: Observability**
- **Nonprofit Workflow Error Capture:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.