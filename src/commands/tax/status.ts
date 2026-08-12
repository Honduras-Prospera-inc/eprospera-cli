import { z } from "zod";
import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  parseInput,
  type RuntimeDependencies,
  uuidSchema,
} from "../runtime.js";

export type TaxStatusOptions = {
  subject?: string;
};

const subjectSchema = z.union([z.literal("personal"), uuidSchema]);

export async function runTaxStatus(
  options: TaxStatusOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const subject = options.subject ? parseInput(subjectSchema, options.subject) : undefined;
  const context = await authenticatedContext("tax.status", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/tax/summary", {
    params: { query: { subject } },
  });
  print(response.data ?? null, context.output);
}
