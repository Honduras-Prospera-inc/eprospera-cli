import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  parseInput,
  type RuntimeDependencies,
  uuidSchema,
} from "../runtime.js";

export async function runApplicationGet(
  id: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const applicationId = parseInput(uuidSchema, id);
  const context = await authenticatedContext("application.get", globals, deps);
  const response = await context.api.raw.GET("/api/v1/legal_entity_applications/{id}", {
    params: { path: { id: applicationId } },
  });
  print(response.data ?? null, { ...context.output, table: "applications" });
}
