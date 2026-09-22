import { renderApiEnvelope } from "../../output/envelope.js";
import { print } from "../../output/format.js";
import { authenticatedContext, type GlobalOptions, type RuntimeDependencies } from "../runtime.js";

export async function runMeDocuments(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const context = await authenticatedContext("me.documents", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/natural-person/documents");
  print(response.data ?? null, { ...context.output, human: renderApiEnvelope });
}
