import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { createProgram } from "../../src/index.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version: string };
const tsxCliPath = require.resolve("tsx/cli");

type OcsCommand = {
  name: string;
  options?: OcsOption[];
  commands?: OcsCommand[];
};

type OcsOption = {
  name: string;
  description?: string;
};

const source = await readFile("cli.ocs.yaml", "utf8");
const document = parse(source) as { info: { version: string }; command: OcsCommand };

describe("cli.ocs.yaml", () => {
  it("defines the expected root command", () => {
    expect(document.command.name).toBe("eprospera");
  });

  it("uses the package version in the OpenCLI info block", () => {
    expect(document.info.version).toBe(packageJson.version);
  });

  it("syncs the OpenCLI info version from package metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eprospera-ocs-"));
    const packageJsonPath = join(dir, "package.json");
    const ocsPath = join(dir, "cli.ocs.yaml");

    try {
      await writeFile(packageJsonPath, `${JSON.stringify({ version: "9.8.7" }, null, 2)}\n`);
      await writeFile(
        ocsPath,
        [
          'opencli: "0.1"',
          "info:",
          "  title: eprospera",
          '  version: "0.0.0"',
          "command:",
          "  name: eprospera",
          "",
        ].join("\n"),
      );

      await execa(
        process.execPath,
        [tsxCliPath, "scripts/sync-ocs-version.ts", packageJsonPath, ocsPath],
        {
          cwd: process.cwd(),
        },
      );

      const synced = parse(await readFile(ocsPath, "utf8")) as { info: { version: string } };
      expect(synced.info.version).toBe("9.8.7");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("covers the v0.1 command surface", () => {
    expect(leafCommands(document.command)).toHaveLength(24);
  });

  it("matches the Commander command registration", () => {
    expect(leafCommandIds(document.command).sort()).toEqual(commanderLeafCommandIds().sort());
  });

  it("keeps the skip-scope-check help text aligned with Commander", () => {
    const ocsOption = document.command.options?.find(
      (option) => option.name === "--skip-scope-check",
    );
    const commanderOption = createProgram().options.find(
      (option) => option.long === "--skip-scope-check",
    );

    expect(commanderOption?.description).toBe(ocsOption?.description);
  });

  it("has a generated command doc for every leaf command", async () => {
    await Promise.all(
      leafCommandIds(document.command).map((commandId) =>
        expect(access(`docs/commands/${commandId.replaceAll(".", "-")}.md`)).resolves.toBe(
          undefined,
        ),
      ),
    );
  });
});

function leafCommands(command: OcsCommand): string[] {
  if (!command.commands?.length) {
    return [command.name];
  }

  return command.commands.flatMap(leafCommands);
}

function leafCommandIds(command: OcsCommand, path: string[] = []): string[] {
  const nextPath = command.name === "eprospera" ? path : [...path, command.name];
  if (!command.commands?.length) {
    return [nextPath.join(".")];
  }

  return command.commands.flatMap((child) => leafCommandIds(child, nextPath));
}

function commanderLeafCommandIds(): string[] {
  const root = createProgram();
  return leafCommanderCommands(root);
}

function leafCommanderCommands(
  command: { name(): string; commands: readonly unknown[] },
  path: string[] = [],
): string[] {
  const nextPath = command.name() === "eprospera" ? path : [...path, command.name()];
  const children = command.commands.filter(isCommanderLike);
  if (children.length === 0) {
    return [nextPath.join(".")];
  }

  return children.flatMap((child) => leafCommanderCommands(child, nextPath));
}

function isCommanderLike(
  value: unknown,
): value is { name(): string; commands: readonly unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "function" &&
    "commands" in value &&
    Array.isArray(value.commands)
  );
}
