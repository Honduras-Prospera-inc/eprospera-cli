import { z } from "zod";
import type { components } from "../../api/generated.js";
import { print } from "../../output/format.js";
import { confirmAction } from "../../prompts/confirm.js";
import {
  authenticatedContext,
  type GlobalOptions,
  nonEmptyStringSchema,
  parseInput,
  printDryRun,
  type RuntimeDependencies,
  readJsonFile,
} from "../runtime.js";

const addressSchema = z
  .object({
    country: z.string().optional(),
    line1: z.string().optional(),
    line2: z.string().nullable().optional(),
    city: z.string().optional(),
    state: z.string().nullable().optional(),
    postalCode: z.string().optional(),
  })
  .passthrough();

const extensionSchema = z.enum([
  "LLC",
  "L.L.C.",
  "Limited Liability Company",
  "S. de R.L.",
  "SRL",
  "Limited Company",
  "L.C.",
  "LC",
  "Limited Liability Co.",
  "Limited Co.",
  "Ltd. Co.",
]);

const createApplicationSchema = z
  .object({
    applicationData: z
      .object({
        residencyType: z.enum(["e-Resident", "Resident"]),
        entityType: z.literal("llc"),
        name: nonEmptyStringSchema,
        extension: extensionSchema,
        principalOffice: addressSchema,
        contactEmail: z.string().email(),
        registeredAgentProvider: z.literal("prospera_employment_solutions").nullable().optional(),
        registeredAgentDetails: z.unknown().optional(),
        analytics: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough(),
    referralCode: z.string().optional(),
    redirectUrl: z.string().url().optional(),
  })
  .passthrough();

export type CreateApplicationOptions = {
  file?: string;
};

export async function runApplicationCreate(
  options: CreateApplicationOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const file = parseInput(nonEmptyStringSchema, options.file);
  const body = (await readJsonFile(
    file,
    createApplicationSchema,
    deps,
  )) as components["schemas"]["CreateLegalEntityApplicationRequest"];

  if (globals.dryRun) {
    printDryRun({ method: "POST", path: "/api/v1/legal_entity_applications", body }, globals, deps);
    return;
  }

  const confirmed = await confirmAction("Create legal-entity application?", globals, deps);
  if (!confirmed) {
    return;
  }

  const context = await authenticatedContext("application.create", globals, deps);
  const response = await context.api.raw.POST("/api/v1/legal_entity_applications", { body });
  print(response.data ?? null, { ...context.output, table: "applications" });
}
