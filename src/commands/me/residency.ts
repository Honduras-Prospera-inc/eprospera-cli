import { print } from "../../output/format.js";
import { authenticatedContext, type GlobalOptions, type RuntimeDependencies } from "../runtime.js";

export async function runMeResidency(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const context = await authenticatedContext("me.residency", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/natural-person/residency");
  print(response.data ?? null, context.output);
}
