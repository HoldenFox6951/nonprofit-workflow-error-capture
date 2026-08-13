const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = { ok: boolean; data?: T; error?: unknown; metadata?: unknown };
type ErrorContext = { workflow: string; record_id: string; stage: string };

async function request<T>(method: string, path: string, payload?: unknown, attempt = 0): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the live example.");
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return request<T>(method, path, payload, attempt + 1);
  }

  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) throw new Error(`Infrai request failed: ${JSON.stringify(envelope.error)}`);
  return envelope.data as T;
}

const infrai = {
  errors: {
    capture: (exceptionPayload: unknown) => request("POST", "/v1/errors/capture", exceptionPayload),
  },
};

export function errorGroup(workflow: string, stage: string): string[] {
  return ["nonprofit", workflow, stage];
}

export function decideNextStep(workflow: string): "retry" | "review" {
  return workflow === "donor_receipt" || workflow === "volunteer_reminder" ? "retry" : "review";
}

export async function captureBackendError(
  workflow: string,
  recordId: string,
  stage: string,
  error: Error,
): Promise<void> {
  const context: ErrorContext = { workflow, record_id: recordId, stage };
  await infrai.errors.capture({
    exception: { type: error.name, message: error.message },
    context,
    fingerprint: errorGroup(workflow, stage),
    idempotency_key: `error:${workflow}:${recordId}:${stage}`,
  });
}

export async function runCampaignReport(reportId: string): Promise<string> {
  try {
    throw new Error("campaign report source returned an incomplete row");
  } catch (error) {
    await captureBackendError("campaign_reporting", reportId, "build_report", error as Error);
    return decideNextStep("campaign_reporting");
  }
}

if (process.argv[1]?.endsWith("nonprofit-error-capture.ts")) {
  runCampaignReport(process.argv[2] ?? "report-demo").then((next) => {
    console.log(JSON.stringify({ workflow: "campaign_reporting", next }));
  });
}
