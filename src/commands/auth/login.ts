import { spawn } from "node:child_process";
import input from "@inquirer/input";
import password from "@inquirer/password";
import { z } from "zod";
import {
  DEFAULT_OAUTH_SCOPES,
  pollDeviceAuthorization,
  startDeviceAuthorization,
} from "../../credentials/oauth.js";
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
  unauthenticatedContext,
} from "../runtime.js";

export type LoginOptions = {
  agentKey?: boolean;
  standardKey?: boolean;
  oauth?: boolean;
  browser?: boolean;
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
  const selectedModes = [options.agentKey, options.standardKey, options.oauth].filter(Boolean);
  if (selectedModes.length !== 1) {
    throw new ExitError({
      code: "INVALID_AUTH_MODE",
      message: "Choose exactly one login mode: --oauth, --agent-key, or --standard-key.",
      exitCode: ExitCodes.Usage,
    });
  }

  if (options.oauth) {
    await loginWithOAuth(options, globals, deps);
    return;
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

async function loginWithOAuth(
  options: LoginOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies,
): Promise<void> {
  if (globals.apiKey) {
    throw new ExitError({
      code: "INVALID_AUTH_MODE",
      message: "--api-key cannot be combined with auth login --oauth.",
      exitCode: ExitCodes.Usage,
    });
  }

  const scopes = options.scopes ? parseScopes(options.scopes) : [...DEFAULT_OAUTH_SCOPES];
  if (scopes.length === 0) {
    throw new ExitError({
      code: "INVALID_OAUTH_SCOPES",
      message: "At least one OAuth scope is required.",
      exitCode: ExitCodes.Usage,
    });
  }

  const context = await unauthenticatedContext(globals, deps);
  const authorization = await startDeviceAuthorization(context.api, scopes);
  const verificationUrl = authorization.verification_uri_complete;
  const shouldOpenBrowser =
    options.browser !== false &&
    Boolean(deps.streams?.stdin?.isTTY ?? process.stdin.isTTY) &&
    Boolean(deps.streams?.stderr?.isTTY ?? process.stderr.isTTY);
  const browserOpened = shouldOpenBrowser
    ? await (deps.openUrl ?? launchBrowser)(verificationUrl)
    : false;

  writeOAuthInstructions(authorization.user_code, authorization.verification_uri, deps);
  if (shouldOpenBrowser && !browserOpened) {
    (deps.streams?.stderr ?? process.stderr).write(
      "Could not open a browser automatically; use the URL shown above.\n",
    );
  }

  const credential = await pollDeviceAuthorization(context.api, authorization, scopes, {
    now: deps.now,
    sleep: deps.sleep,
  });
  const source =
    (await deps.saveStoredCredential?.(credential)) ??
    (await saveCredential(credential, configStoreOptions(deps)));

  print(
    {
      kind: credential.kind,
      source,
      scopes: credential.scopes,
      expiresAt: credential.expiresAt,
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
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ];
}

function writeOAuthInstructions(
  userCode: string,
  verificationUri: string,
  deps: RuntimeDependencies,
): void {
  const stderr = deps.streams?.stderr ?? process.stderr;
  stderr.write(`Open ${verificationUri} and enter code ${userCode}.\n`);
  stderr.write("Waiting for browser authorization…\n");
}

async function launchBrowser(url: string): Promise<boolean> {
  const command =
    process.platform === "darwin"
      ? { executable: "open", args: [url] }
      : process.platform === "win32"
        ? { executable: "rundll32", args: ["url.dll,FileProtocolHandler", url] }
        : { executable: "xdg-open", args: [url] };

  try {
    const child = spawn(command.executable, command.args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
