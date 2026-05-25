import { type ErrorEnvelope, type ExitCode, ExitCodes, ExitError } from "../errors.js";
import { renderTable, type TablePreset } from "./table.js";
import {
  type OutputMode,
  type OutputModeOptions,
  resolveOutputMode,
  type TerminalLike,
  terminalCapabilities,
} from "./tty.js";

export type OutputWriter = TerminalLike & {
  write(chunk: string): unknown;
};

export type OutputStreams = {
  stdin?: TerminalLike;
  stdout?: OutputWriter;
  stderr?: OutputWriter;
};

export type PrintOptions = OutputModeOptions & {
  quiet?: boolean;
  fields?: string | readonly string[];
  table?: TablePreset;
  schema?: unknown;
  env?: NodeJS.ProcessEnv;
  streams?: OutputStreams;
  human?: (data: unknown) => string;
};

export type PrintErrorResult = {
  exitCode: ExitCode;
};

export function print(data: unknown, options: PrintOptions = {}): OutputMode {
  const streams = resolveStreams(options.streams);
  const mode = resolveOutputMode(options, streams);
  const selected = selectFields(data, parseFields(options.fields));

  if (mode === "json") {
    writeLine(streams.stdout, JSON.stringify(selected ?? null, null, 2));
    return mode;
  }

  if (mode === "raw") {
    writeLine(streams.stdout, JSON.stringify(selected ?? null));
    return mode;
  }

  const capabilities = terminalCapabilities({ ...options, mode }, streams);
  const rendered =
    options.human?.(selected) ??
    renderTable(selected, options.table, {
      color: capabilities.color,
    });
  writeLine(streams.stdout, rendered);
  return mode;
}

export function printError(error: unknown, options: PrintOptions = {}): PrintErrorResult {
  const streams = resolveStreams(options.streams);
  const mode = resolveOutputMode(options, streams);
  const { envelope, exitCode } = errorEnvelope(error);

  if (mode === "json") {
    writeLine(streams.stdout, JSON.stringify(envelope, null, 2));
    return { exitCode };
  }

  if (mode === "raw") {
    writeLine(streams.stdout, JSON.stringify(envelope));
    return { exitCode };
  }

  const capabilities = terminalCapabilities({ ...options, mode }, streams);
  const prefix = capabilities.color ? "\u001b[31mError:\u001b[39m" : "Error:";
  writeLine(streams.stderr, `${prefix} ${envelope.error.message}`);
  return { exitCode };
}

export function parseFields(fields: string | readonly string[] | undefined): string[] {
  if (!fields) {
    return [];
  }

  const rawFields = typeof fields === "string" ? [fields] : fields;
  const parsed = rawFields.flatMap((field) => field.split(",").map((part) => part.trim()));
  return [...new Set(parsed.filter((field) => field.length > 0))];
}

export function selectFields(data: unknown, fields: readonly string[]): unknown {
  if (fields.length === 0) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => selectObjectFields(item, fields));
  }

  return selectObjectFields(data, fields);
}

function selectObjectFields(data: unknown, fields: readonly string[]): unknown {
  if (!isRecord(data)) {
    return data;
  }

  const output: Record<string, unknown> = {};
  for (const field of fields) {
    const path = field.split(".").filter((part) => part.length > 0);
    const value = readPath(data, path);
    if (value !== undefined) {
      writePath(output, path, value);
    }
  }

  return output;
}

function readPath(data: Record<string, unknown>, path: readonly string[]): unknown {
  let current: unknown = data;
  for (const part of path) {
    if (!isRecord(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

function writePath(output: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let current = output;
  for (const [index, part] of path.entries()) {
    if (index === path.length - 1) {
      current[part] = value;
      return;
    }

    const next = current[part];
    if (!isRecord(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
}

function errorEnvelope(error: unknown): { envelope: ErrorEnvelope; exitCode: ExitCode } {
  if (error instanceof ExitError) {
    return {
      envelope: error.toEnvelope(),
      exitCode: error.exitCode,
    };
  }

  return {
    envelope: {
      error: {
        code: "UNEXPECTED_ERROR",
        message: error instanceof Error ? error.message : "Unexpected error.",
      },
    },
    exitCode: ExitCodes.Generic,
  };
}

function resolveStreams(streams: OutputStreams | undefined): Required<OutputStreams> {
  return {
    stdin: streams?.stdin ?? process.stdin,
    stdout: streams?.stdout ?? process.stdout,
    stderr: streams?.stderr ?? process.stderr,
  };
}

function writeLine(writer: OutputWriter, value: string): void {
  writer.write(value.endsWith("\n") ? value : `${value}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
