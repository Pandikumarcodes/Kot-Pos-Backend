const fs = require("fs");
const path = require("path");
const openapi = require("../src/docs/openapi");

const root = path.join(__dirname, "..");
fs.mkdirSync(path.join(root, "docs/postman"), { recursive: true });
const writeJson = (file, value) => fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);

const postmanUrl = (route, operation) => {
  const pathVariables = [...route.matchAll(/\{([^}]+)\}/g)].map((match) => ({ key: match[1], value: "507f1f77bcf86cd799439011" }));
  const query = (operation.parameters || []).filter((item) => item.in === "query").map((item) => ({ key: item.name, value: item.example === undefined ? "" : String(item.example), description: item.description }));
  return { raw: `{{baseUrl}}${route}`, host: ["{{baseUrl}}"], path: route.split("/").filter(Boolean).map((segment) => segment.replace(/[{}]/g, "")), ...(pathVariables.length ? { variable: pathVariables } : {}), ...(query.length ? { query } : {}) };
};

const buildCollection = (name, baseUrl) => {
  const folders = new Map();
  for (const [route, methods] of Object.entries(openapi.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const tag = operation.tags?.[0] || "Other";
      if (!folders.has(tag)) folders.set(tag, []);
      const request = { name: operation.summary, request: { method: method.toUpperCase(), header: [{ key: "Accept", value: "application/json" }], url: postmanUrl(route, operation), description: operation.description } };
      if (operation.security) {
        request.request.auth = { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] };
      }
      const bodyExample = operation.requestBody?.content?.["application/json"]?.example;
      if (bodyExample) {
        request.request.header.push({ key: "Content-Type", value: "application/json" });
        request.request.body = { mode: "raw", raw: JSON.stringify(bodyExample, null, 2), options: { raw: { language: "json" } } };
      }
      folders.get(tag).push(request);
    }
  }
  return { info: { name, _postman_id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-collection`, description: "Generated from the checked-in OpenAPI specification. Do not add routes here that are absent from src/routes.", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" }, variable: [{ key: "baseUrl", value: baseUrl }, { key: "accessToken", value: "" }, { key: "refreshToken", value: "" }, { key: "branchId", value: "507f1f77bcf86cd799439011" }], item: [...folders.entries()].map(([folder, items]) => ({ name: folder, item: items })) };
};

writeJson("docs/openapi.json", openapi);
writeJson("docs/postman/kot-pos-local.postman_collection.json", buildCollection("KOT POS Local Development", "http://localhost:3000"));
writeJson("docs/postman/kot-pos-production.postman_collection.json", buildCollection("KOT POS Production", "https://api.example.com"));
writeJson("docs/postman/kot-pos-local.postman_environment.json", { name: "KOT POS Local", values: [{ key: "baseUrl", value: "http://localhost:3000", enabled: true }, { key: "accessToken", value: "", enabled: true }, { key: "refreshToken", value: "", enabled: true }, { key: "branchId", value: "507f1f77bcf86cd799439011", enabled: true }] });
writeJson("docs/postman/kot-pos-production.postman_environment.json", { name: "KOT POS Production", values: [{ key: "baseUrl", value: "https://api.example.com", enabled: true }, { key: "accessToken", value: "", enabled: true }, { key: "refreshToken", value: "", enabled: true }, { key: "branchId", value: "507f1f77bcf86cd799439011", enabled: true }] });

console.log(`Generated OpenAPI for ${Object.keys(openapi.paths).length} routes and ${Object.values(openapi.paths).reduce((count, methods) => count + Object.keys(methods).length, 0)} operations.`);
