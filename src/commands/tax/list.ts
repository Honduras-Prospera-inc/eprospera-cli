import { z } from "zod";
import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  parseInput,
  type RuntimeDependencies,
  uuidSchema,
} from "../runtime.js";

export type TaxListOptions = {
  subject?: string;
  type?: string;
  year?: string;
  limit?: string;
  cursor?: string;
};

const optionsSchema = z.object({
  subject: z.union([z.literal("personal"), uuidSchema]).optional(),
  type: z.enum(["income", "vat"]).optional(),
  year: z.coerce.number().int().min(2020).max(9999).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).optional(),
});

export async function runTaxList(
  options: TaxListOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const query = parseInput(optionsSchema, options);
  const context = await authenticatedContext("tax.list", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/tax/filings", {
    params: { query },
  });
  print(response.data ?? null, context.output);
}
