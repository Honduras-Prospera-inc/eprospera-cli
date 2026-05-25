import { print } from "../../output/format.js";
import { authenticatedContext, type GlobalOptions, type RuntimeDependencies } from "../runtime.js";

export async function runMeIdVerification(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const context = await authenticatedContext("me.id-verification", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/natural-person/id-verification");
  print(response.data ?? null, context.output);
}
