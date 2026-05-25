import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { CredentialKind } from "../../src/credentials/types.js";
import { ExitCodes } from "../../src/errors.js";
import { assertCommandScope, checkCommandScope } from "../../src/scopes/check.js";
import {
  COMMAND_SCOPES,
  type CommandId,
  type CommandScopeRequirement,
} from "../../src/scopes/map.js";

type OcsMetadata = {
  name: string;
  value: unknown;
};

type OcsCommand = {
  name: string;
  commands?: OcsCommand[];
  metadata?: OcsMetadata[];
};

const source = await readFile("cli.ocs.yaml", "utf8");
const document = parse(source) as { command: OcsCommand };

describe("command scope map", () => {
  it("covers every leaf command in cli.ocs.yaml", () => {
    expect(Object.keys(COMMAND_SCOPES).sort()).toEqual(
      leafCommands(document.command)
        .map((command) => command.id)
        .sort(),
    );
  });

  it("matches auth-related cli.ocs.yaml metadata", () => {
    for (const command of leafCommands(document.command)) {
      const requirement: CommandScopeRequirement = COMMAND_SCOPES[command.id as CommandId];
      const metadata = metadataObject(command.metadata ?? []);

      expect(requirement.requiredScope).toBe(metadata.requiredScope);
      expect(requirement.oauthScope).toBe(metadata.oauthScope);
      expect(credentialTypes(requirement)).toEqual(metadata.credentialTypes);
    }
  });
});

describe("scope checks", () => {
  it("accepts an Agent Key with the required scope", () => {
    expect(
      checkCommandScope("entity.verify", {
        kind: "ak",
        scopes: ["agent:verify_rpn"],
      }),
    ).toEqual({ ok: true });
  });

  it("reports missing Agent Key scopes", () => {
    expect(
      checkCommandScope("application.create", {
        kind: "ak",
        scopes: ["agent:entity.application.read"],
      }),
    ).toEqual({ ok: false, missing: "agent:entity.application.create" });
  });

  it("lets skip-scope-check bypass cached scope presence", () => {
    expect(
      checkCommandScope(
        "application.create",
        {
          kind: "ak",
          scopes: [],
        },
        { skipScopeCheck: true },
      ),
    ).toEqual({ ok: true });
  });

  it("does not let skip-scope-check bypass credential type compatibility", () => {
    expect(
      thrownBy(() =>
        checkCommandScope(
          "application.create",
          {
            kind: "oauth",
            scopes: [],
          },
          { skipScopeCheck: true },
        ),
      ),
    ).toMatchObject({
      code: "UNSUPPORTED_CREDENTIAL_TYPE",
      exitCode: ExitCodes.Authorization,
    });
  });

  it("accepts standard keys for commands that allow them without requiring cached scopes", () => {
    expect(
      checkCommandScope("entity.search", {
        kind: "sk",
        scopes: [],
      }),
    ).toEqual({ ok: true });
  });

  it("checks OAuth scopes when a command supports OAuth credentials", () => {
    expect(
      checkCommandScope("me.profile", {
        kind: "oauth",
        scopes: ["eprospera:person.details.read"],
      }),
    ).toEqual({ ok: true });

    expect(
      checkCommandScope("me.profile", {
        kind: "oauth",
        scopes: [],
      }),
    ).toEqual({ ok: false, missing: "eprospera:person.details.read" });
  });

  it("throws authorization errors for missing scopes when asserted", () => {
    expect(
      thrownBy(() =>
        assertCommandScope("me.residency", {
          kind: "ak",
          scopes: [],
        }),
      ),
    ).toMatchObject({
      code: "MISSING_SCOPE",
      exitCode: ExitCodes.Authorization,
      details: {
        command: "me.residency",
        missing: "agent:person.residency.read",
      },
    });
  });

  it("does not require credentials for local utility commands", () => {
    expect(checkCommandScope("schema", undefined)).toEqual({ ok: true });
    expect(checkCommandScope("config.get", undefined)).toEqual({ ok: true });
  });
});

function leafCommands(
  command: OcsCommand,
  path: string[] = [],
): Array<{
  id: string;
  metadata?: OcsMetadata[];
}> {
  const nextPath = command.name === "eprospera" ? path : [...path, command.name];
  if (!command.commands?.length) {
    return [{ id: nextPath.join("."), metadata: command.metadata }];
  }

  return command.commands.flatMap((child) => leafCommands(child, nextPath));
}

function metadataObject(metadata: OcsMetadata[]): {
  requiredScope?: string;
  oauthScope?: string;
  credentialTypes?: CredentialKind[];
} {
  const output: {
    requiredScope?: string;
    oauthScope?: string;
    credentialTypes?: CredentialKind[];
  } = {};

  for (const entry of metadata) {
    if (
      (entry.name === "requiredScope" || entry.name === "oauthScope") &&
      typeof entry.value === "string"
    ) {
      output[entry.name] = entry.value;
    }
    if (entry.name === "credentialTypes" && isCredentialTypeArray(entry.value)) {
      output.credentialTypes = entry.value;
    }
  }

  return output;
}

function credentialTypes(requirement: CommandScopeRequirement): CredentialKind[] | undefined {
  return requirement.credentialTypes ? [...requirement.credentialTypes] : undefined;
}

function isCredentialTypeArray(value: unknown): value is CredentialKind[] {
  return (
    Array.isArray(value) &&
    value.every((item) => item === "ak" || item === "sk" || item === "oauth")
  );
}

function thrownBy(fn: () => void): unknown {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error;
  }
}
