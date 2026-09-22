import { z } from "zod";
import { renderApiEnvelope } from "../../output/envelope.js";
import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  nonEmptyStringSchema,
  parseInput,
  type RuntimeDependencies,
  readJsonFile,
  uuidSchema,
} from "../runtime.js";
import { type FilingFileOptions, type FilingPayOptions, runFilingWrite } from "./filings.js";

const amendmentAddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).nullable().optional(),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100),
});

const amendmentChangesSchema = z.strictObject({
  updatedName: z.string().trim().min(1).max(200).nullable().optional(),
  updatedExtension: z.string().trim().min(1).max(50).nullable().optional(),
  updatedNameStartsWithExtension: z.boolean().nullable().optional(),
  updatedAddress: amendmentAddressSchema.nullable().optional(),
});

const amendmentCreateSchema = amendmentChangesSchema.refine(
  (body) => Object.values(body).some((value) => value != null),
  { message: "At least one non-null proposed change is required." },
);
const amendmentUpdateSchema = amendmentChangesSchema.refine(
  (body) => Object.values(body).some((value) => value !== undefined),
  { message: "Provide at least one field to update." },
);

export async function runAmendmentList(
  entityId: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const id = parseInput(uuidSchema, entityId);
  const context = await authenticatedContext("entity.amendment.list", globals, deps);
  const response = await context.api.raw.GET("/api/v1/legal_entities/{id}/amendments", {
    params: { path: { id } },
  });
  print(response.data ?? null, { ...context.output, human: renderApiEnvelope });
}

export async function runAmendmentGet(
  entityId: string,
  filingId: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const path = parseInput(z.object({ id: uuidSchema, filingId: uuidSchema }), {
    id: entityId,
    filingId,
  });
  const context = await authenticatedContext("entity.amendment.get", globals, deps);
  const response = await context.api.raw.GET("/api/v1/legal_entities/{id}/amendments/{filingId}", {
    params: { path },
  });
  print(response.data ?? null, { ...context.output, human: renderApiEnvelope });
}

export async function runAmendmentCreate(
  entityId: string,
  options: FilingFileOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const id = parseInput(uuidSchema, entityId);
  const file = parseInput(nonEmptyStringSchema, options.file);
  const body = await readJsonFile(file, amendmentCreateSchema, deps);
  await runFilingWrite(
    {
      commandId: "entity.amendment.create",
      confirmation: "Create an amendment or replace all proposals on the existing draft?",
      request: { method: "POST", path: `/api/v1/legal_entities/${id}/amendments`, body },
      send: (api) =>
        api.raw.POST("/api/v1/legal_entities/{id}/amendments", {
          params: { path: { id } },
          body,
        }),
    },
    globals,
    deps,
  );
}

export async function runAmendmentUpdate(
  entityId: string,
  filingId: string,
  options: FilingFileOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const path = parseInput(z.object({ id: uuidSchema, filingId: uuidSchema }), {
    id: entityId,
    filingId,
  });
  const file = parseInput(nonEmptyStringSchema, options.file);
  const body = await readJsonFile(file, amendmentUpdateSchema, deps);
  await runFilingWrite(
    {
      commandId: "entity.amendment.update",
      confirmation: "Update this amendment draft and invalidate its previous signature?",
      request: {
        method: "PATCH",
        path: `/api/v1/legal_entities/${path.id}/amendments/${path.filingId}`,
        body,
      },
      send: (api) =>
        api.raw.PATCH("/api/v1/legal_entities/{id}/amendments/{filingId}", {
          params: { path },
          body,
        }),
    },
    globals,
    deps,
  );
}

export async function runAmendmentPay(
  entityId: string,
  filingId: string,
  options: FilingPayOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const path = parseInput(z.object({ id: uuidSchema, filingId: uuidSchema }), {
    id: entityId,
    filingId,
  });
  const body = { voucherCode: parseInput(nonEmptyStringSchema, options.voucher) };
  await runFilingWrite(
    {
      commandId: "entity.amendment.pay",
      confirmation: "Apply a full-coverage voucher and submit the signed amendment for review?",
      request: {
        method: "POST",
        path: `/api/v1/legal_entities/${path.id}/amendments/${path.filingId}/pay/voucher`,
        body,
      },
      send: (api) =>
        api.raw.POST("/api/v1/legal_entities/{id}/amendments/{filingId}/pay/voucher", {
          params: { path },
          body,
        }),
    },
    globals,
    deps,
  );
}

export async function runAmendmentSubmit(
  entityId: string,
  filingId: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const path = parseInput(z.object({ id: uuidSchema, filingId: uuidSchema }), {
    id: entityId,
    filingId,
  });
  await runFilingWrite(
    {
      commandId: "entity.amendment.submit",
      confirmation: "Submit the signed, paid amendment or retry its review dispatch?",
      request: {
        method: "POST",
        path: `/api/v1/legal_entities/${path.id}/amendments/${path.filingId}/submit`,
      },
      send: (api) =>
        api.raw.POST("/api/v1/legal_entities/{id}/amendments/{filingId}/submit", {
          params: { path },
        }),
    },
    globals,
    deps,
  );
}
