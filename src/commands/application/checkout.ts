import { z } from "zod";
import type { components } from "../../api/generated.js";
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
} from "../runtime.js";

const paymentMethodSchema = z.record(z.string(), z.unknown());

export type CheckoutApplicationOptions = {
  redirectUrl?: string;
  provider?: string;
  paymentMethod?: string;
  email?: string;
};

export async function runApplicationCheckout(
  id: string,
  options: CheckoutApplicationOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const applicationId = parseInput(uuidSchema, id);
  if ((options.provider === undefined) === (options.paymentMethod === undefined)) {
    throw new ExitError({
      code: "INVALID_USAGE",
      message: "Provide exactly one of --provider or --payment-method.",
      exitCode: ExitCodes.Usage,
    });
  }

  const body: components["schemas"]["CheckoutRequest"] = {
    redirectUrl: parseInput(z.string().url(), options.redirectUrl),
  };
  if (options.provider !== undefined) {
    body.paymentProvider = parseInput(nonEmptyStringSchema, options.provider);
  }
  if (options.paymentMethod !== undefined) {
    body.paymentMethod = parseInput(paymentMethodSchema, parseJsonOption(options.paymentMethod));
  }
  if (options.email !== undefined) {
    body.email = parseInput(z.string().email(), options.email);
  }

  if (globals.dryRun) {
    printDryRun(
      {
        method: "POST",
        path: `/api/v1/legal_entity_applications/${applicationId}/checkout_session`,
        body,
      },
      globals,
      deps,
    );
    return;
  }

  const confirmed = await confirmAction(
    "Create a hosted checkout session for this application?",
    globals,
    deps,
  );
  if (!confirmed) {
    return;
  }

  const context = await authenticatedContext("application.checkout", globals, deps);
  try {
    const response = await context.api.raw.POST(
      "/api/v1/legal_entity_applications/{id}/checkout_session",
      {
        params: { path: { id: applicationId } },
        body,
      },
    );
    print(response.data ?? null, context.output);
  } catch (error) {
    if (error instanceof ExitError && error.httpStatus === 503) {
      throw new ExitError({
        code: "AGENT_CHECKOUT_DISABLED",
        message:
          "Hosted checkout is unavailable for this credential. Use a standard sk- API key, or pay with application pay --voucher.",
        exitCode: ExitCodes.Authorization,
        httpStatus: 503,
        cause: error,
      });
    }
    throw error;
  }
}

function parseJsonOption(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new ExitError({
      code: "INVALID_USAGE",
      message: "--payment-method must be valid inline JSON.",
      exitCode: ExitCodes.Usage,
      cause: error,
    });
  }
}
