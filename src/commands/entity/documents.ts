import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  parseInput,
  type RuntimeDependencies,
  uuidSchema,
} from "../runtime.js";

export async function runEntityDocuments(
  id: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const entityId = parseInput(uuidSchema, id);
  const context = await authenticatedContext("entity.documents", globals, deps);
  const response = await context.api.raw.GET("/api/v1/legal_entities/{id}/documents", {
    params: { path: { id: entityId } },
  });
  print(response.data ?? null, { ...context.output, table: "documents" });
}
