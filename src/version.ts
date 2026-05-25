import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLED_VERSION = "__EPROSPERA_CLI_VERSION__";

export const VERSION = readPackageVersion() ?? BUNDLED_VERSION;

function readPackageVersion(): string | undefined {
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (;;) {
    const packageJsonPath = join(currentDir, "package.json");
    if (existsSync(packageJsonPath)) {
      const version = parsePackageVersion(packageJsonPath);
      if (version) {
        return version;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
}

function parsePackageVersion(packageJsonPath: string): string | undefined {
  try {
    const value = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: unknown;
      version?: unknown;
    };
    if (value.name === "@prospera/eprospera-cli" && typeof value.version === "string") {
      return value.version;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
