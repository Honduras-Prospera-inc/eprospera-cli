import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  parseInput,
  type RuntimeDependencies,
  rpnSchema,
} from "../runtime.js";

export async function runEntityVerify(
  rpn: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const body = { rpn: parseInput(rpnSchema, rpn) };
  const context = await authenticatedContext("entity.verify", globals, deps);
  const response = await context.api.raw.POST("/api/v1/verify_rpn", { body });
  print(response.data ?? null, context.output);
}
