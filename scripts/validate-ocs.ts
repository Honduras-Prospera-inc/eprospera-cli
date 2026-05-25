import { readFile } from "node:fs/promises";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";

const [file = "cli.ocs.yaml"] = process.argv.slice(2);
const schemaUrl = "https://opencli.org/draft.json";

const [schemaResponse, source] = await Promise.all([fetch(schemaUrl), readFile(file, "utf8")]);

if (!schemaResponse.ok) {
  throw new Error(`Failed to fetch ${schemaUrl}: ${schemaResponse.status}`);
}

const schema = await schemaResponse.json();
const document = parse(source);
const ajv = new Ajv2020({ allErrors: true, unicodeRegExp: false, validateFormats: false });
const validate = ajv.compile(schema);

if (!validate(document)) {
  for (const error of validate.errors ?? []) {
    console.error(`${error.instancePath || "/"} ${error.message}`);
  }
  process.exitCode = 1;
}
