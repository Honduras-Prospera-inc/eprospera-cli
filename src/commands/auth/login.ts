import { input, password } from "@inquirer/prompts";
import { z } from "zod";
import { saveCredential } from "../../credentials/store.js";
import type { StoredCredential } from "../../credentials/types.js";
import { ExitCodes, ExitError } from "../../errors.js";
import { print } from "../../output/format.js";
import {
  configStoreOptions,
  type GlobalOptions,
  outputOptions,
  parseInput,
  type RuntimeDependencies,
} from "../runtime.js";

export type LoginOptions = {
  agentKey?: boolean;
  standardKey?: boolean;
  scopes?: string;
};

const agentKeySchema = z
  .string()
  .trim()
  .regex(/^ak-.+/, "Agent Key must start with ak-.");
const standardKeySchema = z
  .string()
  .trim()
  .regex(/^sk-.+/, "Standard API key must start with sk-.");

export async function runAuthLogin(
  options: LoginOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  if (options.agentKey === options.standardKey) {
    throw new ExitError({
      code: "INVALID_AUTH_MODE",
      message: "Choose exactly one login mode: --agent-key or --standard-key.",
      exitCode: ExitCodes.Usage,
    });
  }

  const kind = options.agentKey ? "ak" : "sk";
  const promptMessage = kind === "ak" ? "Agent Key" : "Standard API key";
  const token = globals.apiKey?.trim() || (await promptSecret(promptMessage, deps));
  const scopes = kind === "ak" ? await resolveScopes(options.scopes, deps) : [];
  const credential: StoredCredential = {
    kind,
    token: parseInput(kind === "ak" ? agentKeySchema : standardKeySchema, token),
    scopes,
  };

  const source =
    (await deps.saveStoredCredential?.(credential)) ??
    (await saveCredential(credential, configStoreOptions(deps)));

  print(
    {
      kind: credential.kind,
      source,
      scopes: credential.scopes,
      saved: true,
    },
    outputOptions(globals, deps),
  );
}

async function promptSecret(message: string, deps: RuntimeDependencies): Promise<string> {
  return deps.promptPassword?.(message) ?? password({ message });
}

async function resolveScopes(
  scopes: string | undefined,
  deps: RuntimeDependencies,
): Promise<string[]> {
  if (scopes !== undefined) {
    return parseScopes(scopes);
  }

  const value =
    (await deps.promptInput?.("Agent Key scopes (comma-separated, optional)")) ??
    (await input({ message: "Agent Key scopes (comma-separated, optional)", default: "" }));
  return parseScopes(value);
}

function parseScopes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ];
}
