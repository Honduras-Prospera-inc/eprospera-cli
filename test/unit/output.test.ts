import { describe, expect, it } from "vitest";
import { ExitCodes, ExitError } from "../../src/errors.js";
import { parseFields, print, printError, selectFields } from "../../src/output/format.js";
import { renderTable } from "../../src/output/table.js";
import {
  resolveOutputMode,
  type TerminalLike,
  terminalCapabilities,
} from "../../src/output/tty.js";

describe("output mode resolution", () => {
  it("uses human mode for TTY stdout", () => {
    expect(resolveOutputMode({}, { stdout: tty() })).toBe("human");
  });

  it("auto-selects JSON for non-TTY stdout", () => {
    expect(resolveOutputMode({}, { stdout: pipe() })).toBe("json");
  });

  it("keeps human mode for non-TTY stdout when auto JSON is disabled", () => {
    expect(resolveOutputMode({ noAutoJson: true }, { stdout: pipe() })).toBe("human");
  });

  it("honors explicit json and lets raw override json", () => {
    expect(resolveOutputMode({ json: true }, { stdout: tty() })).toBe("json");
    expect(resolveOutputMode({ json: true, raw: true }, { stdout: tty() })).toBe("raw");
  });
});

describe("terminal capabilities", () => {
  it("enables decorations only for quiet-free human TTY output", () => {
    expect(
      terminalCapabilities(
        { mode: "human", env: {} },
        { stdin: tty(), stdout: tty(), stderr: tty() },
      ),
    ).toEqual({
      color: true,
      spinner: true,
      interactive: true,
    });

    expect(
      terminalCapabilities(
        { mode: "human", quiet: true, env: {} },
        { stdin: tty(), stdout: tty(), stderr: tty() },
      ),
    ).toEqual({
      color: false,
      spinner: false,
      interactive: false,
    });
  });

  it("suppresses decorations in machine modes and non-TTY output", () => {
    expect(
      terminalCapabilities(
        { mode: "json", env: {} },
        { stdin: tty(), stdout: tty(), stderr: tty() },
      ),
    ).toEqual({
      color: false,
      spinner: false,
      interactive: false,
    });

    expect(
      terminalCapabilities(
        { mode: "human", env: {} },
        { stdin: tty(), stdout: pipe(), stderr: tty() },
      ),
    ).toEqual({
      color: false,
      spinner: false,
      interactive: true,
    });
  });

  it("handles NO_COLOR, FORCE_COLOR, and CI", () => {
    expect(
      terminalCapabilities(
        { mode: "human", env: { NO_COLOR: "1", FORCE_COLOR: "1" } },
        { stdin: tty(), stdout: tty(), stderr: tty() },
      ).color,
    ).toBe(false);

    expect(
      terminalCapabilities(
        { mode: "human", env: { CI: "1" } },
        { stdin: tty(), stdout: tty(), stderr: tty() },
      ),
    ).toMatchObject({ color: false, spinner: false });

    expect(
      terminalCapabilities(
        { mode: "human", env: { CI: "1", FORCE_COLOR: "1" } },
        { stdin: tty(), stdout: tty(), stderr: tty() },
      ).color,
    ).toBe(true);
  });
});

describe("print", () => {
  it("writes pretty JSON to stdout in JSON mode", () => {
    const streams = createStreams();

    expect(print({ id: "entity-1" }, { json: true, streams })).toBe("json");

    expect(streams.stdout.text()).toBe('{\n  "id": "entity-1"\n}\n');
    expect(streams.stderr.text()).toBe("");
  });

  it("writes compact JSON to stdout in raw mode", () => {
    const streams = createStreams();

    expect(print({ id: "entity-1" }, { raw: true, streams })).toBe("raw");

    expect(streams.stdout.text()).toBe('{"id":"entity-1"}\n');
    expect(streams.stderr.text()).toBe("");
  });

  it("writes human output to stdout with the fallback object table", () => {
    const streams = createStreams({ stdoutTty: true });

    expect(print({ id: "entity-1", name: "Acme" }, { noAutoJson: true, streams })).toBe("human");

    expect(streams.stdout.text()).toContain("entity-1");
    expect(streams.stdout.text()).toContain("Acme");
    expect(streams.stderr.text()).toBe("");
  });

  it("applies fields to success payloads only", () => {
    const streams = createStreams();

    print(
      { id: "entity-1", name: "Acme", owner: { name: "Ada", email: "ada@example.test" } },
      { json: true, fields: "id,owner.name,missing", streams },
    );

    expect(JSON.parse(streams.stdout.text())).toEqual({
      id: "entity-1",
      owner: { name: "Ada" },
    });
  });
});

describe("printError", () => {
  it("writes ExitError envelopes to stdout in machine modes", () => {
    const streams = createStreams();
    const error = new ExitError({
      code: "FORBIDDEN_SCOPE",
      message: "Missing scope",
      exitCode: ExitCodes.Authorization,
      httpStatus: 403,
      details: null,
    });

    expect(printError(error, { json: true, streams })).toEqual({
      exitCode: ExitCodes.Authorization,
    });

    expect(JSON.parse(streams.stdout.text())).toEqual({
      error: {
        code: "FORBIDDEN_SCOPE",
        message: "Missing scope",
        httpStatus: 403,
        details: null,
      },
    });
    expect(streams.stderr.text()).toBe("");
  });

  it("writes human errors to stderr", () => {
    const streams = createStreams({ stdoutTty: true, stderrTty: true });
    const error = new ExitError({
      code: "NO_CREDENTIAL",
      message: "No credential configured",
      exitCode: ExitCodes.Authentication,
    });

    expect(printError(error, { noAutoJson: true, streams, env: { NO_COLOR: "1" } })).toEqual({
      exitCode: ExitCodes.Authentication,
    });

    expect(streams.stdout.text()).toBe("");
    expect(streams.stderr.text()).toBe("Error: No credential configured\n");
  });

  it("normalizes unknown errors", () => {
    const streams = createStreams();

    expect(printError(new Error("boom"), { raw: true, streams })).toEqual({
      exitCode: ExitCodes.Generic,
    });

    expect(JSON.parse(streams.stdout.text())).toEqual({
      error: {
        code: "UNEXPECTED_ERROR",
        message: "boom",
      },
    });
  });
});

describe("fields", () => {
  it("parses comma-separated and array fields", () => {
    expect(parseFields(["id,name", "owner.name", "", "id"])).toEqual(["id", "name", "owner.name"]);
  });

  it("selects top-level and dotted paths from objects", () => {
    expect(
      selectFields(
        {
          id: "entity-1",
          owner: { name: "Ada", email: "ada@example.test" },
          ignored: true,
        },
        ["id", "owner.name", "missing"],
      ),
    ).toEqual({
      id: "entity-1",
      owner: { name: "Ada" },
    });
  });

  it("selects fields from arrays item-by-item without mutating input", () => {
    const input = [
      { id: "one", nested: { value: 1 }, ignored: true },
      { id: "two", nested: { value: 2 }, ignored: true },
    ];

    expect(selectFields(input, ["id", "nested.value"])).toEqual([
      { id: "one", nested: { value: 1 } },
      { id: "two", nested: { value: 2 } },
    ]);
    expect(input[0]?.ignored).toBe(true);
  });

  it("returns input unchanged when no fields are provided", () => {
    const input = { id: "entity-1" };

    expect(selectFields(input, parseFields(""))).toBe(input);
  });
});

describe("table rendering", () => {
  it("renders application preset headers and rows", () => {
    const output = renderTable(
      [
        {
          id: "app-1",
          statusId: "Draft",
          legalEntityId: "entity-1",
          createdAt: "2026-05-25T00:00:00.000Z",
        },
      ],
      "applications",
      { color: false },
    );

    expect(output).toContain("Status");
    expect(output).toContain("Draft");
    expect(output).toContain("entity-1");
  });

  it("renders document preset rows from API envelopes", () => {
    const output = renderTable(
      {
        data: [
          {
            id: "doc-1",
            name: "Articles",
            version: 1,
            fileUrl: "https://example.test/document.pdf",
          },
        ],
      },
      "documents",
      { color: false },
    );

    expect(output).toContain("Articles");
    expect(output).toContain("https://example.test/document.pdf");
  });
});

function tty(): TerminalLike {
  return { isTTY: true };
}

function pipe(): TerminalLike {
  return { isTTY: false };
}

function createStreams(options: { stdoutTty?: boolean; stderrTty?: boolean } = {}): {
  stdin: TerminalLike;
  stdout: BufferWriter;
  stderr: BufferWriter;
} {
  return {
    stdin: tty(),
    stdout: new BufferWriter(options.stdoutTty ?? false),
    stderr: new BufferWriter(options.stderrTty ?? false),
  };
}

class BufferWriter {
  readonly #chunks: string[] = [];
  readonly isTTY: boolean;

  constructor(isTTY: boolean) {
    this.isTTY = isTTY;
  }

  write(chunk: string): boolean {
    this.#chunks.push(chunk);
    return true;
  }

  text(): string {
    return this.#chunks.join("");
  }
}
