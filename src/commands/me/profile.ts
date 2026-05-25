import { print } from "../../output/format.js";
import { authenticatedContext, type GlobalOptions, type RuntimeDependencies } from "../runtime.js";

export async function runMeProfile(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const context = await authenticatedContext("me.profile", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/natural-person");
  print(response.data ?? null, context.output);
}
