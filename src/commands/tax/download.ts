import { chmod, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { z } from "zod";
import { ExitCodes, ExitError } from "../../errors.js";
import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  parseInput,
  type RuntimeDependencies,
  uuidSchema,
} from "../runtime.js";

export type TaxDownloadOptions = {
  document: string;
  historyYears?: string;
  output?: string;
};

const optionsSchema = z.object({
  document: z.enum(["assessment", "return"]),
  historyYears: z.coerce.number().int().min(1).max(5).optional(),
  output: z.string().trim().min(1).optional(),
});

export async function runTaxDownload(
  filingId: string,
  options: TaxDownloadOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const id = parseInput(uuidSchema, filingId);
  const parsed = parseInput(optionsSchema, options);
  if (parsed.document === "return" && parsed.historyYears !== undefined) {
    throw new ExitError({
      code: "INVALID_USAGE",
      message: "--history-years is only valid when --document is assessment.",
      exitCode: ExitCodes.Usage,
    });
  }

  const context = await authenticatedContext("tax.download", globals, deps);
  const response = await context.api.raw.GET(
    "/api/v1/me/tax/filings/{filingId}/documents/{document}",
    {
      params: {
        path: { filingId: id, document: parsed.document },
        query: { history_years: parsed.historyYears },
      },
      parseAs: "arrayBuffer",
    },
  );
  if (!(response.data instanceof ArrayBuffer)) {
    throw new ExitError({
      code: "INVALID_DOWNLOAD_RESPONSE",
      message: "The API did not return a PDF document.",
      exitCode: ExitCodes.Generic,
    });
  }

  const suggestedName = filenameFromDisposition(
    response.response.headers.get("content-disposition"),
  );
  const fileName = suggestedName ?? `eprospera-tax-${id}-${parsed.document}.pdf`;
  const outputPath = resolve(deps.cwd ?? process.cwd(), parsed.output ?? fileName);
  await mkdir(dirname(outputPath), { recursive: true });

  try {
    await writeFile(outputPath, new Uint8Array(response.data), {
      flag: globals.yes ? "w" : "wx",
      mode: 0o600,
    });
    await chmod(outputPath, 0o600);
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new ExitError({
        code: "FILE_EXISTS",
        message: `${outputPath} already exists. Pass --yes to overwrite it.`,
        exitCode: ExitCodes.Conflict,
        cause: error,
      });
    }
    throw error;
  }

  print(
    {
      filingId: id,
      document: parsed.document,
      path: outputPath,
      bytes: response.data.byteLength,
    },
    context.output,
  );
}

function filenameFromDisposition(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(value)?.[1];
  const decoded = encoded ? safeDecode(encoded) : plain;
  if (!decoded) {
    return undefined;
  }
  const safe = basename(decoded).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return safe.length > 0 ? safe : undefined;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
