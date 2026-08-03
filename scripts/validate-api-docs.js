const fs = require("fs");
const spec = require("../src/docs/openapi");

const refs = [];
const walk = (value) => {
  if (!value || typeof value !== "object") return;
  if (value["$ref"]) refs.push(value["$ref"]);
  Object.values(value).forEach(walk);
};
walk(spec);
const schemaRefs = new Set(Object.keys(spec.components.schemas).map((name) => `#/components/schemas/${name}`));
const missing = refs.filter((item) => item.startsWith("#/components/schemas/") && !schemaRefs.has(item));
if (missing.length) throw new Error(`Missing schema references: ${missing.join(", ")}`);

for (const file of [
  "docs/postman/kot-pos-local.postman_collection.json",
  "docs/postman/kot-pos-production.postman_collection.json",
  "docs/postman/kot-pos-local.postman_environment.json",
  "docs/postman/kot-pos-production.postman_environment.json",
]) JSON.parse(fs.readFileSync(file));

const operationCount = Object.values(spec.paths).reduce((count, methods) => count + Object.keys(methods).length, 0);
if (Object.keys(spec.paths).length !== 68 || operationCount !== 82) throw new Error("Unexpected documented route count");
console.log(JSON.stringify({ paths: Object.keys(spec.paths).length, operations: operationCount, schemaReferences: refs.length, missing, postman: "valid JSON" }, null, 2));
