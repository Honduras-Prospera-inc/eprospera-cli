import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { createProgram } from "../../src/index.js";

type OcsCommand = {
  name: string;
  commands?: OcsCommand[];
};

const source = await readFile("cli.ocs.yaml", "utf8");
const document = parse(source) as { command: OcsCommand };

describe("cli.ocs.yaml", () => {
  it("defines the expected root command", () => {
    expect(document.command.name).toBe("eprospera");
  });

  it("covers the v0.1 command surface", () => {
    expect(leafCommands(document.command)).toHaveLength(24);
  });

  it("matches the Commander command registration", () => {
    expect(leafCommandIds(document.command).sort()).toEqual(commanderLeafCommandIds().sort());
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
