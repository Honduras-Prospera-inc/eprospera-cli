import { print } from "../../output/format.js";
import { renderTable } from "../../output/table.js";
import {
  authenticatedContext,
  type GlobalOptions,
  nonEmptyStringSchema,
  parseInput,
  type RuntimeDependencies,
} from "../runtime.js";

export async function runEntitySearch(
  query: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const body = { query: parseInput(nonEmptyStringSchema, query) };
  const context = await authenticatedContext("entity.search", globals, deps);
  const response = await context.api.raw.POST("/api/v1/registries/legal_entities/search", { body });
  const data = response.data ?? { results: [] };
  print(data, {
    ...context.output,
    human: (value) => renderTable(isResultEnvelope(value) ? value.results : value, "entities"),
  });
}

function isResultEnvelope(value: unknown): value is { results?: unknown[] } {
  return typeof value === "object" && value !== null && "results" in value;
}
