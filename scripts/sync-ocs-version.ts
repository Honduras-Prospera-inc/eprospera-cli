import { readFile, writeFile } from "node:fs/promises";
import { parseDocument } from "yaml";

const args = process.argv.slice(2);
if (args[0] === "--") {
  args.shift();
}

const [packageJsonPath = "package.json", ocsPath = "cli.ocs.yaml"] = args;

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
  version?: unknown;
};

if (typeof packageJson.version !== "string" || packageJson.version.trim().length === 0) {
  throw new Error(`${packageJsonPath} must contain a string version.`);
}

const source = await readFile(ocsPath, "utf8");
const document = parseDocument(source);
const currentVersion = document.getIn(["info", "version"]);

if (typeof currentVersion !== "string") {
  throw new Error(`${ocsPath} must contain a string info.version.`);
}

if (currentVersion !== packageJson.version) {
  document.setIn(["info", "version"], packageJson.version);
  await writeFile(ocsPath, String(document));
}
