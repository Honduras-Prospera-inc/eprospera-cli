import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

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
});

function leafCommands(command: OcsCommand): string[] {
  if (!command.commands?.length) {
    return [command.name];
  }

  return command.commands.flatMap(leafCommands);
}
