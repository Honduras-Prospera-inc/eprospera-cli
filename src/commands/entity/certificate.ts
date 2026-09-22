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

const certificateRequestSchema = z.strictObject({
  contest: z
    .strictObject({
      note: z.string().trim().min(1).max(2000),
      proofUrl: z.string().url().max(2048),
    })
    .optional(),
});

export async function runCertificateList(
  entityId: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const id = parseInput(uuidSchema, entityId);
  const context = await authenticatedContext("entity.certificate.list", globals, deps);
  const response = await context.api.raw.GET("/api/v1/legal_entities/{id}/certificate_requests", {
    params: { path: { id } },
  });
  print(response.data ?? null, { ...context.output, human: renderApiEnvelope });
}

export async function runCertificateGet(
  entityId: string,
  requestId: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const path = parseInput(z.object({ id: uuidSchema, requestId: uuidSchema }), {
    id: entityId,
    requestId,
  });
  const context = await authenticatedContext("entity.certificate.get", globals, deps);
  const response = await context.api.raw.GET(
    "/api/v1/legal_entities/{id}/certificate_requests/{requestId}",
    { params: { path } },
  );
  print(response.data ?? null, { ...context.output, human: renderApiEnvelope });
}

export async function runCertificateCreate(
  entityId: string,
  options: FilingFileOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const id = parseInput(uuidSchema, entityId);
  const body =
    options.file === undefined
      ? {}
      : await readJsonFile(
          parseInput(nonEmptyStringSchema, options.file),
          certificateRequestSchema,
          deps,
        );
  await runFilingWrite(
    {
      commandId: "entity.certificate.create",
      confirmation:
        "Request a Certificate of Good Standing and prepare its invoice, or reuse the existing request?",
      request: { method: "POST", path: `/api/v1/legal_entities/${id}/certificate_requests`, body },
      send: (api) =>
        api.raw.POST("/api/v1/legal_entities/{id}/certificate_requests", {
          params: { path: { id } },
          body,
        }),
    },
    globals,
    deps,
  );
}

export async function runCertificatePay(
  entityId: string,
  requestId: string,
  options: FilingPayOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const path = parseInput(z.object({ id: uuidSchema, requestId: uuidSchema }), {
    id: entityId,
    requestId,
  });
  const body = { voucherCode: parseInput(nonEmptyStringSchema, options.voucher) };
  await runFilingWrite(
    {
      commandId: "entity.certificate.pay",
      confirmation: "Apply a full-coverage voucher to this Certificate of Good Standing request?",
      request: {
        method: "POST",
        path: `/api/v1/legal_entities/${path.id}/certificate_requests/${path.requestId}/pay/voucher`,
        body,
      },
      send: (api) =>
        api.raw.POST("/api/v1/legal_entities/{id}/certificate_requests/{requestId}/pay/voucher", {
          params: { path },
          body,
        }),
    },
    globals,
    deps,
  );
}
