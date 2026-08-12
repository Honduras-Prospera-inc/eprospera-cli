import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  parseInput,
  type RuntimeDependencies,
  uuidSchema,
} from "../runtime.js";

export async function runTaxGet(
  filingId: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const id = parseInput(uuidSchema, filingId);
  const context = await authenticatedContext("tax.get", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/tax/filings/{filingId}", {
    params: { path: { filingId: id } },
  });
  print(response.data ?? null, context.output);
}
