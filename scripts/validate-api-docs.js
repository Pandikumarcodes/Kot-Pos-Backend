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

const generatedSpec = JSON.parse(fs.readFileSync("docs/openapi.json"));
if (JSON.stringify(generatedSpec) !== JSON.stringify(spec)) {
  throw new Error("docs/openapi.json is stale; run npm run docs:generate");
}

const postmanFiles = [
  "docs/postman/kot-pos-local.postman_collection.json",
  "docs/postman/kot-pos-production.postman_collection.json",
];
const postmanCollections = postmanFiles.map((file) => JSON.parse(fs.readFileSync(file)));
for (const file of [
  "docs/postman/kot-pos-local.postman_environment.json",
  "docs/postman/kot-pos-production.postman_environment.json",
]) JSON.parse(fs.readFileSync(file));

const operationCount = Object.values(spec.paths).reduce((count, methods) => count + Object.keys(methods).length, 0);
const expectedPathCount = 71;
const expectedOperationCount = 85;
if (Object.keys(spec.paths).length !== expectedPathCount || operationCount !== expectedOperationCount) throw new Error("Unexpected documented route count");
for (const collection of postmanCollections) {
  const requestCount = collection.item.reduce((count, folder) => count + folder.item.length, 0);
  if (requestCount !== expectedOperationCount) throw new Error(`Unexpected Postman operation count: ${requestCount}`);
}
console.log(JSON.stringify({ paths: Object.keys(spec.paths).length, operations: operationCount, schemaReferences: refs.length, missing, postman: "valid JSON" }, null, 2));
