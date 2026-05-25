import { constants } from "node:fs";
import { access, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { ExitCodes, ExitError } from "../errors.js";

export const CONFIG_SERVICE = "eprospera-cli";
export const CONFIG_FILE_NAME = "config.json";
export const SUPPORTED_CONFIG_KEYS = ["api.baseUrl"] as const;

export type ConfigKey = (typeof SUPPORTED_CONFIG_KEYS)[number];
export type CliConfig = Partial<Record<ConfigKey, string>>;

export type ConfigStoreOptions = {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
};

const configSchema = z
  .object({
    "api.baseUrl": z.string().url().optional(),
  })
  .strict();

export async function loadConfig(options: ConfigStoreOptions = {}): Promise<CliConfig> {
  const filePath = getConfigFilePath(options);
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {};
    }
    throw configError("CONFIG_UNREADABLE", "Local configuration could not be read.", error);
  }

  try {
    return configSchema.parse(JSON.parse(text));
  } catch (error) {
    throw configError("CONFIG_INVALID", "Local configuration is invalid.", error);
  }
}

export async function setConfigValue(
  key: ConfigKey,
  value: string,
  options: ConfigStoreOptions = {},
): Promise<CliConfig> {
  const next = { ...(await loadConfig(options)), [key]: value };
  await saveConfig(configSchema.parse(next), options);
  return next;
}

export async function unsetConfigValue(
  key: ConfigKey,
  options: ConfigStoreOptions = {},
): Promise<boolean> {
  const current = await loadConfig(options);
  const existed = key in current;
  delete current[key];

  if (Object.keys(current).length === 0) {
    await deleteConfig(options);
  } else {
    await saveConfig(current, options);
  }

  return existed;
}

export function assertConfigKey(value: string): ConfigKey {
  if (SUPPORTED_CONFIG_KEYS.includes(value as ConfigKey)) {
    return value as ConfigKey;
  }

  throw new ExitError({
    code: "INVALID_CONFIG_KEY",
    message: `Unsupported config key ${value}. Supported keys: ${SUPPORTED_CONFIG_KEYS.join(", ")}.`,
    exitCode: ExitCodes.Usage,
  });
}

export function getConfigFilePath(options: ConfigStoreOptions = {}): string {
  return join(getConfigDir(options), CONFIG_FILE_NAME);
}

function getConfigDir(options: ConfigStoreOptions = {}): string {
  const xdgConfigHome = options.env?.XDG_CONFIG_HOME?.trim();
  return join(xdgConfigHome || join(options.homeDir ?? homedir(), ".config"), CONFIG_SERVICE);
}

async function saveConfig(config: CliConfig, options: ConfigStoreOptions): Promise<void> {
  const filePath = getConfigFilePath(options);
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(dirname(filePath), 0o700);
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(filePath, 0o600);
}

async function deleteConfig(options: ConfigStoreOptions): Promise<void> {
  const filePath = getConfigFilePath(options);
  try {
    await access(filePath, constants.F_OK);
    await rm(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }
    throw configError("CONFIG_UNWRITABLE", "Local configuration could not be updated.", error);
  }
}

function configError(code: string, message: string, cause?: unknown): ExitError {
  return new ExitError({
    code,
    message,
    exitCode: code === "CONFIG_INVALID" ? ExitCodes.Validation : ExitCodes.Generic,
    cause,
  });
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
