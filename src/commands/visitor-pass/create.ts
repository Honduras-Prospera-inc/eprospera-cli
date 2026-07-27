import { z } from "zod";
import type { components } from "../../api/generated.js";
import { print } from "../../output/format.js";
import { confirmAction } from "../../prompts/confirm.js";
import {
  type GlobalOptions,
  nonEmptyStringSchema,
  parseInput,
  printDryRun,
  type RuntimeDependencies,
  unauthenticatedContext,
} from "../runtime.js";

const createVisitorPassSchema = z.object({
  firstName: nonEmptyStringSchema,
  lastName: nonEmptyStringSchema,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD."),
  email: z.string().email(),
  signature: nonEmptyStringSchema,
  consentToBackgroundCheck: z.literal(true, {
    message: "Visitor pass applications require --consent-to-background-check.",
  }),
  referralSource: nonEmptyStringSchema,
});

export type CreateVisitorPassOptions = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  email?: string;
  signature?: string;
  consentToBackgroundCheck?: boolean;
  referralSource?: string;
};

export async function runVisitorPassCreate(
  options: CreateVisitorPassOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const body = parseInput(
    createVisitorPassSchema,
    options,
  ) as components["schemas"]["CreateVisitorPassRequest"];

  if (globals.dryRun) {
    printDryRun({ method: "POST", path: "/api/v1/visitor_pass_applications", body }, globals, deps);
    return;
  }

  const confirmed = await confirmAction("Submit visitor pass application?", globals, deps);
  if (!confirmed) {
    return;
  }

  const context = await unauthenticatedContext(globals, deps);
  const response = await context.api.raw.POST("/api/v1/visitor_pass_applications", { body });
  print(response.data ?? null, context.output);
}
