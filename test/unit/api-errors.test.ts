import { describe, expect, it } from "vitest";
import { apiErrorFromResponse } from "../../src/api/errors.js";
import { ExitCodes, ExitError } from "../../src/errors.js";

describe("upstream error normalization", () => {
  it("prefers machine codes while preserving human messages and validation details", () => {
    const details = [{ path: ["contest"], message: "Required" }];
    const error = apiErrorFromResponse(new Response(null, { status: 409 }), {
      code: "certificate.contest_required",
      error: "Evidence required",
      details,
    });
    expect(error).toMatchObject({
      code: "certificate.contest_required",
      message: "Evidence required",
      details,
      exitCode: 6,
    });
  });

  it("retains recovery context alongside array validation details", () => {
    const details = [{ path: ["updatedName"], message: "Invalid" }];
    const error = apiErrorFromResponse(new Response(null, { status: 409 }), {
      error: { code: "CONFLICT", message: "Draft locked", details },
      data: { statusId: "Pending Payment" },
      nextSteps: { paymentRequired: true },
    });
    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "Draft locked",
      details,
      recovery: {
        data: { statusId: "Pending Payment" },
        nextSteps: { paymentRequired: true },
      },
    });
  });

  it("preserves conflicting object details separately from returned resource IDs", () => {
    const details = { reason: "queue", filingId: "original" };
    const error = apiErrorFromResponse(new Response(null, { status: 503 }), {
      error: "Saved",
      code: "submission_not_queued",
      details,
      filingId: "current",
      invoiceId: "invoice",
    });
    expect(error.details).toBe(details);
    expect(error.recovery).toEqual({ filingId: "current", invoiceId: "invoice" });
    expect(error.toEnvelope().error).toMatchObject({
      details,
      recovery: { filingId: "current", invoiceId: "invoice" },
    });
  });

  it("keeps OAuth protocol error strings and legacy details unchanged", () => {
    const error = apiErrorFromResponse(new Response(null, { status: 400 }), {
      error: "authorization_pending",
      error_description: "Awaiting consent",
      details: ["wait"],
    });
    expect(error).toMatchObject({
      code: "authorization_pending",
      message: "Awaiting consent",
      details: ["wait"],
      exitCode: 8,
    });
    expect(error.toEnvelope().error).not.toHaveProperty("recovery");
  });

  it.each([
    { details: [{ message: "Invalid", path: ["contest"] }] },
    { details: { data: "original data", nextSteps: "original steps" } },
    { details: "validation text" },
    { details: 0 },
    { details: false },
    { details: null },
  ])("keeps the original details value and serializes recovery independently: $details", ({
    details,
  }) => {
    const recovery = { data: { statusId: "Pending Payment" }, nextSteps: null };
    const error = apiErrorFromResponse(new Response(null, { status: 409 }), {
      error: "Conflict",
      details,
      ...recovery,
    });
    expect(error.details).toBe(details);
    expect(JSON.parse(JSON.stringify(error.toEnvelope())).error).toMatchObject({
      details,
      recovery,
    });
  });

  it("adds recovery without changing the absent-details default", () => {
    const error = apiErrorFromResponse(new Response(null, { status: 503 }), {
      error: "Submission saved",
      code: "submission_not_queued",
      filingId: "filing",
    });
    expect(error.toEnvelope().error).toEqual({
      code: "submission_not_queued",
      message: "Submission saved",
      httpStatus: 503,
      details: null,
      recovery: { filingId: "filing" },
    });
  });

  it("omits recovery from existing local errors", () => {
    const error = new ExitError({
      code: "INVALID_USAGE",
      message: "Missing argument",
      exitCode: ExitCodes.Usage,
    });
    expect(error.toEnvelope().error).not.toHaveProperty("recovery");
  });
});
