import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  nonEmptyStringSchema,
  parseInput,
  type RuntimeDependencies,
} from "../runtime.js";

export async function runReferralList(
  code: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const referralCode = parseInput(nonEmptyStringSchema, code);
  const context = await authenticatedContext("referral.list", globals, deps);
  const response = await context.api.raw.GET("/api/v1/referral-codes/{code}/referrals", {
    params: { path: { code: referralCode } },
  });
  print(response.data ?? null, context.output);
}
