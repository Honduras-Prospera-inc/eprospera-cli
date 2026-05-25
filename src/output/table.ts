import Table from "cli-table3";
import pc from "picocolors";

export type TablePreset = "entities" | "applications" | "documents";

export type RenderTableOptions = {
  color?: boolean;
};

type TableColumn = {
  key: string;
  label: string;
};

const PRESET_COLUMNS = {
  entities: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "residentPermitNumber", label: "RPN" },
  ],
  applications: [
    { key: "id", label: "ID" },
    { key: "statusId", label: "Status" },
    { key: "legalEntityId", label: "Legal Entity" },
    { key: "createdAt", label: "Created" },
  ],
  documents: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "version", label: "Version" },
    { key: "createdAt", label: "Created" },
    { key: "fileUrl", label: "URL" },
  ],
} as const satisfies Record<TablePreset, readonly TableColumn[]>;

export function renderTable(
  data: unknown,
  preset?: TablePreset,
  options: RenderTableOptions = {},
): string {
  const unwrapped = unwrapData(data);

  if (preset) {
    return renderRows(toRows(unwrapped), PRESET_COLUMNS[preset], options);
  }

  if (Array.isArray(unwrapped)) {
    return renderRows(unwrapped, inferColumns(unwrapped), options);
  }

  if (isRecord(unwrapped)) {
    return renderKeyValueTable(unwrapped, options);
  }

  return formatCell(unwrapped);
}

function renderRows(
  rows: readonly unknown[],
  columns: readonly TableColumn[],
  options: RenderTableOptions,
): string {
  if (rows.length === 0) {
    return "(empty)";
  }

  const table = new Table({
    head: columns.map((column) => formatHeader(column.label, options.color)),
    wordWrap: true,
  });

  for (const row of rows) {
    table.push(columns.map((column) => formatCell(readPath(row, column.key))));
  }

  return table.toString();
}

function renderKeyValueTable(data: Record<string, unknown>, options: RenderTableOptions): string {
  const table = new Table({
    head: [formatHeader("Key", options.color), formatHeader("Value", options.color)],
    wordWrap: true,
  });

  for (const [key, value] of Object.entries(data)) {
    table.push([key, formatCell(value)]);
  }

  return table.toString();
}

function inferColumns(rows: readonly unknown[]): TableColumn[] {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!isRecord(row)) {
      return [{ key: "value", label: "Value" }];
    }

    for (const key of Object.keys(row)) {
      keys.add(key);
      if (keys.size >= 6) {
        break;
      }
    }

    if (keys.size >= 6) {
      break;
    }
  }

  return [...keys].map((key) => ({ key, label: humanizeKey(key) }));
}

function toRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function unwrapData(data: unknown): unknown {
  if (isRecord(data) && "data" in data) {
    return data.data;
  }

  return data;
}

function readPath(value: unknown, path: string): unknown {
  if (path === "value") {
    return value;
  }

  let current = value;
  for (const part of path.split(".")) {
    if (!isRecord(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatHeader(value: string, color: boolean | undefined): string {
  return color ? pc.bold(value) : value;
}

function humanizeKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
