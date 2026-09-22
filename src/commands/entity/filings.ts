import type { EProsperaApiClient } from "../../api/client.js";
import { renderApiEnvelope } from "../../output/envelope.js";
import { print } from "../../output/format.js";
import { confirmAction } from "../../prompts/confirm.js";
import type { CommandId } from "../../scopes/map.js";
import {
  authenticatedContext,
  type GlobalOptions,
  printDryRun,
  type RuntimeDependencies,
} from "../runtime.js";

export type FilingFileOptions = { file?: string };
export type FilingPayOptions = { voucher?: string };

type FilingWrite = {
  commandId: CommandId;
  confirmation: string;
  request: { method: "POST" | "PATCH"; path: string; body?: unknown };
  send: (api: EProsperaApiClient) => Promise<{ data?: unknown }>;
};

export async function runFilingWrite(
  write: FilingWrite,
  globals: GlobalOptions,
  deps: RuntimeDependencies,
): Promise<void> {
  if (globals.dryRun) {
    printDryRun(write.request, globals, deps);
    return;
  }
  if (!(await confirmAction(write.confirmation, globals, deps))) {
    return;
  }

  // These endpoints have no idempotency response cache. After an uncertain
  // outcome, callers must read the resource before deciding what to retry.
  const context = await authenticatedContext(write.commandId, globals, {
    ...deps,
    retry: { ...deps.retry, maxRetries: 0 },
  });
  const response = await write.send(context.api);
  print(response.data ?? null, { ...context.output, human: renderApiEnvelope });
}
