import { print } from "../../output/format.js";
import {
  authenticatedContext,
  type GlobalOptions,
  parseInput,
  type RuntimeDependencies,
  uuidSchema,
} from "../runtime.js";

export async function runMeLegalEntitiesList(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const context = await authenticatedContext("me.legal-entities.list", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/legal-entities");
  print(response.data ?? null, context.output);
}

export async function runMeLegalEntitiesGet(
  id: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const entityId = parseInput(uuidSchema, id);
  const context = await authenticatedContext("me.legal-entities.get", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/legal-entities/{id}", {
    params: { path: { id: entityId } },
  });
  print(response.data ?? null, context.output);
}

export async function runMeLegalEntitiesDocuments(
  id: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const entityId = parseInput(uuidSchema, id);
  const context = await authenticatedContext("me.legal-entities.documents", globals, deps);
  const response = await context.api.raw.GET("/api/v1/me/legal-entities/{id}/documents", {
    params: { path: { id: entityId } },
  });
  print(response.data ?? null, context.output);
}
