import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type ZodType, z } from "zod";
import {
  createApiClient,
  type EProsperaApiClient,
  type RetryOptions,
  resolveBaseUrl,
} from "../api/client.js";
import { type CliConfig, type ConfigStoreOptions, loadConfig } from "../config/store.js";
import { type ResolveCredentialOptions, resolveCredential } from "../credentials/resolve.js";
import type {
  CredentialSource,
  ResolvedCredential,
  StoredCredential,
} from "../credentials/types.js";
import { ExitCodes, ExitError } from "../errors.js";
import { type OutputStreams, type PrintOptions, print } from "../output/format.js";
import { assertCommandScope } from "../scopes/check.js";

export type GlobalOptions = {
  json?: boolean;
  raw?: boolean;
  fields?: string;
  quiet?: boolean;
  yes?: boolean;
  apiKey?: string;
  dryRun?: boolean;
  autoJson?: boolean;
  skipScopeCheck?: boolean;
};

export type RuntimeDependencies = {
  env?: NodeJS.ProcessEnv;
  fetch?: (input: Request) => Promise<Response>;
  retry?: RetryOptions;
  idempotencyKey?: () => string;
  streams?: OutputStreams;
  cwd?: string;
  readFile?: typeof readFile;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  loadStoredCredential?: ResolveCredentialOptions["loadStoredCredential"];
  saveStoredCredential?: (credential: StoredCredential) => Promise<CredentialSource>;
  deleteStoredCredential?: () => Promise<boolean>;
  configStore?: ConfigStoreOptions;
  promptPassword?: (message: string) => Promise<string>;
  promptInput?: (message: string) => Promise<string>;
  promptConfirm?: (message: string) => Promise<boolean>;
};

export type AuthenticatedContext = {
  api: EProsperaApiClient;
  credential: ResolvedCredential;
  output: PrintOptions;
  globals: GlobalOptions;
};

export const uuidSchema = z.string().uuid();
export const nonEmptyStringSchema = z.string().trim().min(1);
export const rpnSchema = z
  .string()
  .regex(/^[89]\d{13}$/, "RPN must be 14 digits starting with 8 or 9.");

export async function authenticatedContext(
  commandId: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<AuthenticatedContext> {
  const env = deps.env ?? process.env;
  const config = await loadConfig(configStoreOptions(deps));
  const credential = await resolveCredential({
    apiKey: globals.apiKey,
    env,
    store: configStoreOptions(deps),
    loadStoredCredential: deps.loadStoredCredential,
  });
  assertCommandScope(commandId, credential, { skipScopeCheck: globals.skipScopeCheck });

  return {
    api: createApiClient({
      baseUrl: resolveRuntimeBaseUrl(env, config),
      env,
      token: credential.token,
      fetch: deps.fetch,
      retry: deps.retry,
      idempotencyKey: deps.idempotencyKey,
    }),
    credential,
    output: outputOptions(globals, deps),
    globals,
  };
}

export function outputOptions(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): PrintOptions {
  return {
    json: globals.json,
    raw: globals.raw,
    fields: globals.fields,
    quiet: globals.quiet,
    noAutoJson: globals.autoJson === false,
    env: deps.env,
    streams: deps.streams,
  };
}

export function resolveRuntimeBaseUrl(env: NodeJS.ProcessEnv, config: CliConfig): string {
  if (env.EPROSPERA_BASE_URL?.trim()) {
    return resolveBaseUrl(env);
  }
  if (config["api.baseUrl"]) {
    return trimTrailingSlash(config["api.baseUrl"]);
  }
  return resolveBaseUrl(env);
}

export function configStoreOptions(deps: RuntimeDependencies = {}): ConfigStoreOptions {
  const store = deps.configStore ?? {};
  return {
    ...store,
    env: store.env ?? deps.env,
  };
}

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  throw new ExitError({
    code: "INVALID_USAGE",
    message: result.error.issues.map((issue) => issue.message).join("; "),
    exitCode: ExitCodes.Usage,
    details: result.error.issues,
  });
}

export async function readJsonFile<T>(
  filePath: string,
  schema: ZodType<T>,
  deps: RuntimeDependencies = {},
): Promise<T> {
  const reader = deps.readFile ?? readFile;
  const absolutePath = resolve(deps.cwd ?? process.cwd(), filePath);
  let parsed: unknown;

  try {
    parsed = JSON.parse(await reader(absolutePath, "utf8"));
  } catch (error) {
    throw new ExitError({
      code: "INVALID_JSON_FILE",
      message: `Could not read valid JSON from ${filePath}.`,
      exitCode: ExitCodes.Validation,
      cause: error,
    });
  }

  return parseInput(schema, parsed);
}

export function printDryRun(
  request: { method: string; path: string; body?: unknown },
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): void {
  print({ dryRun: true, request }, outputOptions(globals, deps));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
