import { print } from "../../output/format.js";
import { confirmAction } from "../../prompts/confirm.js";
import {
  authenticatedContext,
  type GlobalOptions,
  nonEmptyStringSchema,
  parseInput,
  printDryRun,
  type RuntimeDependencies,
  uuidSchema,
} from "../runtime.js";

export type PayApplicationOptions = {
  coupon?: string;
};

export async function runApplicationPay(
  id: string,
  options: PayApplicationOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const applicationId = parseInput(uuidSchema, id);
  const couponCode = parseInput(nonEmptyStringSchema, options.coupon);
  const body = { couponCode };

  if (globals.dryRun) {
    printDryRun(
      {
        method: "POST",
        path: `/api/v1/legal_entity_applications/${applicationId}/pay/coupon`,
        body,
      },
      globals,
      deps,
    );
    return;
  }

  const confirmed = await confirmAction("Apply coupon to legal-entity application?", globals, deps);
  if (!confirmed) {
    return;
  }

  const context = await authenticatedContext("application.pay", globals, deps);
  const response = await context.api.raw.POST("/api/v1/legal_entity_applications/{id}/pay/coupon", {
    params: { path: { id: applicationId } },
    body,
  });
  print(response.data ?? null, { ...context.output, table: "applications" });
}
