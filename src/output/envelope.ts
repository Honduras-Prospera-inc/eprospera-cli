import { renderTable } from "./table.js";

/** Render every part of an API envelope, including metadata alongside data. */
export function renderApiEnvelope(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return renderValue(value);
  }

  return Object.entries(value)
    .map(([key, entry]) => `${label(key)}\n${renderValue(entry)}`)
    .join("\n\n");
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "(empty)" : value.map(renderValue).join("\n\n");
  }
  return renderTable(value);
}

function label(key: string): string {
  if (key === "agreementOfCoexistence") {
    return "Agreement of Coexistence";
  }
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}
