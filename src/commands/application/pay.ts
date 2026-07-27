import { ExitCodes, ExitError } from "../../errors.js";
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
  warnDeprecated,
} from "../runtime.js";

export type PayApplicationOptions = {
  voucher?: string;
  coupon?: string;
};

export async function runApplicationPay(
  id: string,
  options: PayApplicationOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const applicationId = parseInput(uuidSchema, id);
  if ((options.voucher === undefined) === (options.coupon === undefined)) {
    throw new ExitError({
      code: "INVALID_USAGE",
      message: "Pass exactly one of --voucher or --coupon.",
      exitCode: ExitCodes.Usage,
    });
  }
  if (options.coupon !== undefined) {
    warnDeprecated("--coupon is deprecated; use --voucher instead.", globals, deps);
  }

  const voucherCode = parseInput(nonEmptyStringSchema, options.voucher ?? options.coupon);
  const body = { voucherCode };

  if (globals.dryRun) {
    printDryRun(
      {
        method: "POST",
        path: `/api/v1/legal_entity_applications/${applicationId}/pay/voucher`,
        body,
      },
      globals,
      deps,
    );
    return;
  }

  const confirmed = await confirmAction(
    "Apply voucher to legal-entity application?",
    globals,
    deps,
  );
  if (!confirmed) {
    return;
  }

  const context = await authenticatedContext("application.pay", globals, deps);
  const response = await context.api.raw.POST(
    "/api/v1/legal_entity_applications/{id}/pay/voucher",
    {
      params: { path: { id: applicationId } },
      body,
    },
  );
  print(response.data ?? null, { ...context.output, table: "applications" });
}
