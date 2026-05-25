import { print } from "../../output/format.js";
import { authenticatedContext, type GlobalOptions, type RuntimeDependencies } from "../runtime.js";

export async function runApplicationList(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const context = await authenticatedContext("application.list", globals, deps);
  const response = await context.api.raw.GET("/api/v1/legal_entity_applications");
  print(response.data ?? null, { ...context.output, table: "applications" });
}
