import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type PackedPackage = {
  filename: string;
};

const tempRoot = await mkdtemp(join(tmpdir(), "eprospera-pack-smoke-"));
const packDir = join(tempRoot, "pack");
const installDir = join(tempRoot, "install");

try {
  await mkdir(packDir, { recursive: true });
  await mkdir(installDir, { recursive: true });

  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    version: string;
  };

  const packResult = await run("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    packDir,
  ]);
  const packed = JSON.parse(extractJsonArray(packResult.stdout)) as PackedPackage[];
  const tarball = packed[0]?.filename;
  if (!tarball) {
    throw new Error("npm pack did not return a tarball filename.");
  }
  const tarballPath = isAbsolute(tarball) ? tarball : join(packDir, tarball);

  await run(
    "npm",
    ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath],
    {
      cwd: installDir,
    },
  );

  const bin = join(
    installDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "eprospera.cmd" : "eprospera",
  );

  const help = await run(bin, ["--help"], { cwd: installDir, shell: process.platform === "win32" });
  assertIncludes(help.stdout, "Usage: eprospera", "help output");

  const version = await run(bin, ["--version"], {
    cwd: installDir,
    shell: process.platform === "win32",
  });
  assertEquals(version.stdout.trim(), packageJson.version, "version output");

  const schema = await run(bin, ["--json", "schema"], {
    cwd: installDir,
    shell: process.platform === "win32",
  });
  const schemaJson = JSON.parse(schema.stdout) as { command?: { name?: string } };
  assertEquals(schemaJson.command?.name, "eprospera", "schema command name");

  const completion = await run(bin, ["completion", "bash"], {
    cwd: installDir,
    shell: process.platform === "win32",
  });
  assertIncludes(completion.stdout, "_eprospera_completions", "bash completion output");

  const globalPrefix = join(tempRoot, "global");
  await run(
    "npm",
    ["install", "--global", "--prefix", globalPrefix, "--no-audit", "--no-fund", tarballPath],
    {
      cwd: installDir,
    },
  );
  const globalBin = join(
    globalPrefix,
    process.platform === "win32" ? "" : "bin",
    process.platform === "win32" ? "eprospera.cmd" : "eprospera",
  );
  const globalHelp = await run(globalBin, ["--help"], {
    cwd: installDir,
    shell: process.platform === "win32",
  });
  assertIncludes(globalHelp.stdout, "Usage: eprospera", "global install help output");

  const globalVersion = await run(globalBin, ["--version"], {
    cwd: installDir,
    shell: process.platform === "win32",
  });
  assertEquals(globalVersion.stdout.trim(), packageJson.version, "global install version output");

  console.log("Packed install smoke test passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

function assertIncludes(value: string, expected: string, label: string): void {
  if (!value.includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}.`);
  }
}

function assertEquals(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `Expected ${label} to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`,
    );
  }
}

function extractJsonArray(value: string): string {
  const start = value.indexOf("[\n  {");
  if (start === -1) {
    throw new Error(`Could not find npm pack JSON output.\nstdout:\n${value}`);
  }

  return value.slice(start);
}

function run(
  command: string,
  args: readonly string[],
  options: { cwd?: string; shell?: boolean } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      shell: options.shell ?? (process.platform === "win32" && command === "npm"),
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    });
  });
}
