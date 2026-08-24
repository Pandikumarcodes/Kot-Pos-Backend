const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$", example: "507f1f77bcf86cd799439011" };

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (schema, example) => ({ required: true, content: { "application/json": { schema, example } } });
const jsonResponse = (description, schema, example) => ({
  description,
  content: { "application/json": { schema, ...(example ? { example } : {}) } },
});
const parameter = (name, inValue, schema, description, required = false, example) => ({
  name,
  in: inValue,
  required,
  description,
  schema,
  ...(example !== undefined ? { example } : {}),
});

const examples = {
  credentials: { username: "manager@example.com" },
  branch: { name: "Downtown Branch", address: "12 Market Street", phone: "9876543210", email: "downtown@example.com", gstin: "29ABCDE1234F1Z5" },
  customer: { name: "Asha Rao", phone: "9876543210", email: "asha@example.com", address: "Bengaluru" },
  menu: { ItemName: "Paneer Tikka", category: "starter", price: 249, available: true },
  inventory: { name: "Paneer", unit: "kg", currentStock: 12, lowStockThreshold: 5, category: "dairy", costPerUnit: 320, supplier: "Fresh Foods" },
  order: { tableId: "507f1f77bcf86cd799439011", tableNumber: 4, customerName: "Asha Rao", customerPhone: "9876543210", items: [{ itemId: "507f1f77bcf86cd799439012", quantity: 2 }] },
  takeaway: { customerName: "Asha Rao", customerPhone: "9876543210", items: [{ itemId: "507f1f77bcf86cd799439012", quantity: 2 }] },
  settings: { businessName: "KOT POS Downtown", currency: "INR", timezone: "Asia/Kolkata", openTime: "09:00", closeTime: "23:00", taxRate: 5 },
  error: { success: false, message: "Validation failed", error: "Validation failed", validationErrors: [{ field: "body.items", location: "body", message: "Items are required", type: "any.required" }] },
};

const schemas = {
  User: { type: "object", description: "User record returned by the current API.", properties: { _id: id, username: { type: "string", example: "manager@example.com" }, role: { type: "string", enum: ["admin", "manager", "waiter", "chef", "cashier"] }, status: { type: "string", enum: ["active", "locked"] }, branchId: { oneOf: [id, { type: "null" }] } }, additionalProperties: true },
  Branch: { type: "object", properties: { _id: id, name: { type: "string", example: "Downtown Branch" }, address: { type: "string" }, phone: { type: "string" }, email: { type: "string", format: "email" }, gstin: { type: "string" }, isActive: { type: "boolean", example: true }, adminUser: { oneOf: [id, { type: "null" }] } }, additionalProperties: true },
  Staff: { allOf: [ref("User"), { description: "User assigned to a branch." }] },
  Customer: { type: "object", properties: { _id: id, name: { type: "string" }, phone: { type: "string" }, email: { type: "string", format: "email" }, address: { type: "string" }, branchId: id }, additionalProperties: true },
  Menu: { type: "object", properties: { _id: id, ItemName: { type: "string", example: "Paneer Tikka" }, category: { type: "string", example: "starter" }, price: { type: "number", example: 249 }, available: { type: "boolean", example: true }, branchId: id }, additionalProperties: true },
  Inventory: { type: "object", properties: { _id: id, name: { type: "string" }, unit: { type: "string", enum: ["kg", "g", "l", "ml", "pcs", "dozen", "box", "packet"] }, currentStock: { type: "number" }, lowStockThreshold: { type: "number" }, category: { type: "string" }, costPerUnit: { type: "number" }, supplier: { type: "string" }, branchId: id }, additionalProperties: true },
  Order: { type: "object", properties: { _id: id, tableId: id, tableNumber: { type: "number" }, customerName: { type: "string" }, customerPhone: { type: "string" }, items: { type: "array", items: ref("OrderItem") }, status: { type: "string", example: "pending" }, branchId: id }, additionalProperties: true },
  OrderItem: { type: "object", required: ["itemId", "quantity"], properties: { itemId: id, quantity: { type: "number", exclusiveMinimum: 0, example: 2 } } },
  KOT: { allOf: [ref("Order"), { description: "Kitchen order ticket representation returned by kitchen/order endpoints." }] },
  Bill: { type: "object", properties: { _id: id, customerName: { type: "string" }, customerPhone: { type: "string" }, items: { type: "array", items: ref("OrderItem") }, paymentStatus: { type: "string", enum: ["unpaid", "paid"] }, paymentMethod: { type: "string", enum: ["cash", "card", "upi", "none"] }, total: { type: "number" }, branchId: id }, additionalProperties: true },
  Payment: { type: "object", properties: { paymentMethod: { type: "string", enum: ["cash", "card", "upi"] }, paymentStatus: { type: "string", enum: ["unpaid", "paid"] } }, additionalProperties: true },
  Settings: { type: "object", properties: { businessName: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string" }, address: { type: "string" }, gstin: { type: "string" }, currency: { type: "string" }, timezone: { type: "string" }, openTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" }, closeTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" }, taxRate: { type: "number", minimum: 0 }, paymentMethods: { type: "object" } }, additionalProperties: true },
  Pagination: { type: "object", properties: { page: { type: "integer", example: 1 }, limit: { type: "integer", example: 20 }, total: { type: "integer", example: 42 }, pages: { type: "integer", example: 3 } }, additionalProperties: true },
  StandardSuccessResponse: { type: "object", required: ["success", "message"], properties: { success: { type: "boolean", example: true }, message: { type: "string", example: "Success" }, data: { nullable: true } }, additionalProperties: true },
  ErrorResponse: { type: "object", required: ["success", "message"], properties: { success: { type: "boolean", example: false }, message: { type: "string", example: "Not authenticated" }, error: { type: "string", example: "Not authenticated" }, validationErrors: { type: "array", items: { type: "object", properties: { field: { type: "string" }, location: { type: "string", enum: ["body", "params", "query"] }, message: { type: "string" }, type: { type: "string" } } } }, stack: { type: "string", description: "Development-only field." } }, additionalProperties: true },
  BranchAdminLifecycleResponse: { type: "object", required: ["message", "branch", "user", "previousAdmin"], properties: { message: { type: "string", enum: ["Branch admin assigned", "Branch admin created", "Branch admin replaced"] }, branch: ref("Branch"), user: ref("User"), previousAdmin: { oneOf: [ref("User"), { type: "null" }] } } },
  AiChatResponse: { type: "object", required: ["reply"], properties: { reply: { type: "string", description: "Plain-text Gemini response or the service's safe connection/quota fallback message." } } },
  AiInventoryAlertsResponse: { type: "object", required: ["alerts", "counts"], properties: { alerts: { type: "array", items: { type: "object", required: ["_id", "name", "currentStock", "unit", "reorderLevel", "avgDailyUsage", "daysUntilStockout", "level", "emoji", "message"], properties: { _id: id, name: { type: "string" }, currentStock: { type: "number" }, unit: { type: "string" }, reorderLevel: { type: "number" }, avgDailyUsage: { type: "number" }, daysUntilStockout: { type: "integer", nullable: true }, level: { type: "string", enum: ["critical", "warning", "info", "ok"] }, emoji: { type: "string" }, message: { type: "string" } }, additionalProperties: false } }, counts: { type: "object", required: ["critical", "warning", "info", "ok"], properties: { critical: { type: "integer" }, warning: { type: "integer" }, info: { type: "integer" }, ok: { type: "integer" } } }, message: { type: "string", description: "Present when no inventory items are found." } } },
  AiDailySummaryResponse: { type: "object", required: ["data", "aiSummary"], properties: { data: { type: "object", required: ["date", "totalRevenue", "totalOrders", "orderChange", "orderTrend", "topItems", "peakHour", "paymentBreakdown", "dineIn", "takeaway", "avgOrderValue", "criticalStockItems"], properties: { date: { type: "string" }, totalRevenue: { type: "string" }, totalOrders: { type: "integer" }, orderChange: { type: "string" }, orderTrend: { type: "string", enum: ["up", "down", "neutral"] }, topItems: { type: "array", items: { type: "object", required: ["name", "qty"], properties: { name: { type: "string" }, qty: { type: "number" } } } }, peakHour: { type: "string" }, paymentBreakdown: { type: "object", additionalProperties: { type: "integer" } }, dineIn: { type: "integer" }, takeaway: { type: "integer" }, avgOrderValue: { type: "string" }, criticalStockItems: { type: "array", items: { type: "string" } } } }, aiSummary: { type: "string", description: "Gemini-generated plain text when configured and available; otherwise a deterministic local fallback." } } },
};

const responses = {
  200: { description: "Successful response. The exact legacy JSON envelope is endpoint-specific.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
  201: { description: "Resource created or workflow action accepted.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
  400: { description: "Bad request or validation failure.", content: { "application/json": { schema: ref("ErrorResponse"), example: examples.error } } },
  401: { description: "Missing, invalid, or expired access token.", content: { "application/json": { schema: ref("ErrorResponse"), example: { success: false, message: "Not authenticated", error: "Not authenticated" } } } },
  403: { description: "Authenticated user lacks the required role or branch access.", content: { "application/json": { schema: ref("ErrorResponse"), example: { success: false, message: "Forbidden - insufficient role", error: "Forbidden - insufficient role" } } } },
  404: { description: "Requested resource or route was not found.", content: { "application/json": { schema: ref("ErrorResponse") } } },
  409: { description: "Conflict with current resource state or uniqueness constraints.", content: { "application/json": { schema: ref("ErrorResponse") } } },
  422: { description: "Validation failed where a service emits semantic validation status.", content: { "application/json": { schema: ref("ErrorResponse"), example: examples.error } } },
  429: { description: "Rate limit exceeded.", content: { "application/json": { schema: ref("ErrorResponse"), example: { success: false, message: "Too many requests", error: "Too many requests" } } } },
  500: { description: "Unexpected server error.", content: { "application/json": { schema: ref("ErrorResponse") } } },
  503: { description: "AI service is not configured or is temporarily unavailable.", content: { "application/json": { schema: ref("ErrorResponse") } } },
};

const paths = {};
const add = (method, path, tag, summary, roles, options = {}) => {
  const authenticated = options.authenticated !== false;
  const successStatus = options.status === 201 ? 201 : options.status === 204 ? 204 : 200;
  const errorStatuses = options.errorStatuses || [400, 401, 403, 404, 409, 422, 429, 500];
  const operation = {
    tags: [tag], summary, description: `${options.description || summary}. ${authenticated ? `Requires Bearer access token (or the existing auth cookie). Allowed roles: ${roles?.length ? roles.join(", ") : "authenticated user"}.` : "Public endpoint."} ${options.branch ? "Branch scope is applied from the authenticated user's branch; super admins may select branchId where the implementation permits it." : "No branch scope is applied by this route."}`,
    operationId: options.operationId || `${method}${path.replace(/[^a-zA-Z0-9]+/g, "-")}`,
    parameters: [...(options.parameters || []), ...(authenticated ? authHeaders : [])],
    responses: {
      [successStatus]: options.successResponse || (successStatus === 204 ? { description: "No content." } : responses[successStatus]),
      ...Object.fromEntries(errorStatuses.map((status) => [status, responses[status]])),
    },
    ...(authenticated ? { security: [{ bearerAuth: [] }] } : {}),
    ...(options.requestBody ? { requestBody: options.requestBody } : {}),
    ...(options.headers ? { parameters: [...(options.parameters || []), ...options.headers] } : {}),
    ...(options.branch ? { "x-branch-scope": true } : {}),
    ...(roles?.length ? { "x-required-roles": roles } : {}),
  };
  paths[path] = paths[path] || {};
  paths[path][method] = operation;
};
const p = (name, description, example) => parameter(name, "path", id, description, true, example);
const q = (name, schema, description, example) => parameter(name, "query", schema, description, false, example);
const branchQuery = q("branchId", id, "Branch selector used only where the current branch-scope middleware permits it.", "507f1f77bcf86cd799439011");
const authHeaders = [parameter("Authorization", "header", { type: "string", example: "Bearer eyJhbGciOiJIUzI1NiIs..." }, "Bearer access token. Cookie authentication remains supported by the implementation.")];

add("post", "/api/v1/auth/signup", "Authentication", "Register a user", [], { authenticated: false, status: 201, requestBody: jsonBody({ type: "object", required: ["username", "password"], properties: { username: { type: "string", maxLength: 254 }, password: { type: "string", maxLength: 72, format: "password" }, role: { type: "string" }, status: { type: "string" } } }, examples.credentials) });
add("post", "/api/v1/auth/login", "Authentication", "Log in", [], { authenticated: false, requestBody: jsonBody({ type: "object", required: ["username", "password"], properties: { username: { type: "string" }, password: { type: "string", format: "password", maxLength: 72 } } }, examples.credentials) });
add("get", "/api/v1/auth/me", "Authentication", "Get current user", ["admin", "manager", "waiter", "chef", "cashier"]);
add("post", "/api/v1/auth/refresh", "Authentication", "Refresh access token", [], { authenticated: false });
add("post", "/api/v1/auth/logout", "Authentication", "Log out", [], { authenticated: false });

add("get", "/api/v1/admin/branches", "Branches", "List branches", ["super-admin"]);
add("post", "/api/v1/admin/branches", "Branches", "Create branch", ["super-admin"], { status: 201, requestBody: jsonBody({ $ref: "#/components/schemas/Branch" }, examples.branch) });
add("put", "/api/v1/admin/branches/{id}", "Branches", "Update branch", ["super-admin"], { parameters: [p("id", "Branch ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody(ref("Branch"), examples.branch) });
add("delete", "/api/v1/admin/branches/{id}", "Branches", "Deactivate branch", ["super-admin"], { parameters: [p("id", "Branch ID.", "507f1f77bcf86cd799439011")] });
add("post", "/api/v1/admin/branches/{id}/assign-staff", "Staff", "Assign staff to branch", ["super-admin"], { parameters: [p("id", "Branch ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody({ type: "object", required: ["userId"], properties: { userId: id } }, { userId: "507f1f77bcf86cd799439012" }) });
add("post", "/api/v1/admin/branches/{id}/assign-admin", "Branches", "Assign or replace a branch admin", ["superadmin"], { description: "Assigns an eligible existing user as the branch admin. A current admin is demoted to manager and affected refresh tokens are cleared transactionally", parameters: [p("id", "Branch ID; must be a 24-character MongoDB ObjectId.", "507f1f77bcf86cd799439011")], requestBody: jsonBody({ type: "object", required: ["userId"], properties: { userId: { ...id, description: "Eligible existing user ID. The user must be active, cannot be a superadmin, and cannot belong to another branch." } } }, { userId: "507f1f77bcf86cd799439012" }), successResponse: jsonResponse("Branch admin assigned or replaced.", ref("BranchAdminLifecycleResponse"), { message: "Branch admin assigned", branch: { _id: "507f1f77bcf86cd799439011", name: "Downtown Branch", adminUser: "507f1f77bcf86cd799439012" }, user: { _id: "507f1f77bcf86cd799439012", username: "branch.admin@example.com", role: "admin", status: "active", branchId: "507f1f77bcf86cd799439011" }, previousAdmin: null }), errorStatuses: [400, 401, 403, 404, 409, 429, 500] });
add("post", "/api/v1/admin/branches/{id}/admin", "Branches", "Create and assign a branch admin", ["superadmin"], { description: "Creates a new branch admin and assigns that user to the branch atomically. A current admin is demoted to manager and affected refresh tokens are cleared", status: 201, parameters: [p("id", "Branch ID; must be a 24-character MongoDB ObjectId.", "507f1f77bcf86cd799439011")], requestBody: jsonBody({ type: "object", required: ["username", "password"], properties: { username: { type: "string", minLength: 1, maxLength: 254 }, password: { type: "string", format: "password", minLength: 5, maxLength: 72, description: "Must pass the backend strong-password validator. Never log or return this value." }, status: { type: "string", enum: ["active", "locked"], default: "active" } } }), successResponse: jsonResponse("Branch admin created and assigned or an existing branch admin replaced.", ref("BranchAdminLifecycleResponse"), { message: "Branch admin created", branch: { _id: "507f1f77bcf86cd799439011", name: "Downtown Branch", adminUser: "507f1f77bcf86cd799439013" }, user: { _id: "507f1f77bcf86cd799439013", username: "new.branch.admin@example.com", role: "admin", status: "active", branchId: "507f1f77bcf86cd799439011" }, previousAdmin: null }), errorStatuses: [400, 401, 403, 404, 409, 429, 500] });
add("post", "/api/v1/admin/branches/{id}/remove-staff", "Staff", "Remove staff from branch", ["super-admin"], { parameters: [p("id", "Branch ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody({ type: "object", required: ["userId"], properties: { userId: id } }, { userId: "507f1f77bcf86cd799439012" }) });
add("get", "/api/v1/admin/branches/{id}/staff", "Staff", "List branch staff", ["super-admin"], { parameters: [p("id", "Branch ID.", "507f1f77bcf86cd799439011")] });
add("get", "/api/v1/admin/branches/unassigned-staff", "Staff", "List unassigned staff", ["super-admin"]);
add("get", "/api/v1/admin/branches/{id}/summary", "Branches", "Get branch summary", ["super-admin"], { parameters: [p("id", "Branch ID.", "507f1f77bcf86cd799439011")] });

add("post", "/api/v1/admin/create-user", "Users", "Create a branch user", ["admin"], { branch: true, status: 201, requestBody: jsonBody({ allOf: [ref("User"), { required: ["username", "password"] }] }, examples.credentials) });
add("get", "/api/v1/admin/users", "Users", "List users", ["admin", "manager"], { branch: true, parameters: [branchQuery, q("page", { type: "integer", minimum: 1 }, "Page number.", 1), q("limit", { type: "integer", minimum: 1, maximum: 100 }, "Page size.", 20), q("search", { type: "string", maxLength: 100 }, "Search term.", "asha")] });
add("put", "/api/v1/admin/update-role/{userId}", "Users", "Update user role", ["admin", "manager"], { branch: true, parameters: [p("userId", "User ID.", "507f1f77bcf86cd799439012")], requestBody: jsonBody({ type: "object", required: ["role"], properties: { role: { type: "string", enum: ["admin", "manager", "waiter", "chef", "cashier"] } } }, { role: "waiter" }) });
add("delete", "/api/v1/admin/deleteUser/{userId}", "Users", "Delete a user", ["admin"], { branch: true, parameters: [p("userId", "User ID.", "507f1f77bcf86cd799439012")] });

add("post", "/api/v1/admin/menu", "Menu", "Create menu item", ["admin", "manager"], { branch: true, status: 201, requestBody: jsonBody(ref("Menu"), examples.menu) });
add("get", "/api/v1/admin/menuItems", "Menu", "List menu items", ["admin", "manager", "waiter", "chef", "cashier"], { branch: true, parameters: [q("category", { type: "string" }, "Menu category.", "starter"), q("search", { type: "string", maxLength: 100 }, "Search term.", "paneer")] });
add("put", "/api/v1/admin/menu-item/{ItemId}", "Menu", "Update menu item", ["admin", "manager"], { branch: true, parameters: [p("ItemId", "Menu item ID.", "507f1f77bcf86cd799439012")], requestBody: jsonBody({ type: "object", properties: { price: { type: "number", exclusiveMinimum: 0 }, available: { type: "boolean" } } }, { price: 275, available: true }) });
add("delete", "/api/v1/admin/delete/{ItemId}", "Menu", "Delete menu item", ["admin"], { branch: true, parameters: [p("ItemId", "Menu item ID.", "507f1f77bcf86cd799439012")] });

add("post", "/api/v1/admin/tables", "Tables", "Create table", ["admin", "manager"], { branch: true, status: 201, requestBody: jsonBody({ type: "object", required: ["tableNumber", "capacity"], properties: { tableNumber: { type: "integer", minimum: 1 }, capacity: { type: "integer", minimum: 1 } } }, { tableNumber: 4, capacity: 4 }) });
add("get", "/api/v1/admin/tables", "Tables", "List tables", ["admin", "manager", "waiter", "cashier"], { branch: true });
add("get", "/api/v1/admin/tables/{id}", "Tables", "Get table", ["admin", "manager", "waiter", "cashier"], { branch: true, parameters: [p("id", "Table ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/admin/tables/{id}", "Tables", "Update table", ["admin", "manager"], { branch: true, parameters: [p("id", "Table ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody({ type: "object", properties: { capacity: { type: "integer", minimum: 1 }, status: { type: "string", enum: ["available", "occupied", "reserved"] } } }, { capacity: 6, status: "available" }) });
add("delete", "/api/v1/admin/tables/{id}", "Tables", "Delete table", ["admin"], { branch: true, parameters: [p("id", "Table ID.", "507f1f77bcf86cd799439011")] });

add("get", "/api/v1/admin/inventory", "Inventory", "List inventory", ["admin", "manager"], { branch: true, parameters: [branchQuery, q("page", { type: "integer", minimum: 1 }, "Page number.", 1), q("limit", { type: "integer", minimum: 1, maximum: 100 }, "Page size.", 20), q("lowStock", { type: "string", enum: ["true", "false"] }, "Filter low stock items."), q("category", { type: "string" }, "Inventory category."), q("search", { type: "string" }, "Search term."), q("sort", { type: "string" }, "Sort field."), q("order", { type: "string", enum: ["asc", "desc"] }, "Sort direction.")] });
add("post", "/api/v1/admin/inventory", "Inventory", "Create inventory item", ["admin", "manager"], { branch: true, status: 201, requestBody: jsonBody(ref("Inventory"), examples.inventory) });
add("put", "/api/v1/admin/inventory/{id}", "Inventory", "Update inventory item", ["admin", "manager"], { branch: true, parameters: [p("id", "Inventory item ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody(ref("Inventory"), examples.inventory) });
add("post", "/api/v1/admin/inventory/{id}/restock", "Inventory", "Restock inventory item", ["admin", "manager"], { branch: true, parameters: [p("id", "Inventory item ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody({ type: "object", required: ["quantity"], properties: { quantity: { type: "number", exclusiveMinimum: 0 }, note: { type: "string", maxLength: 500 } } }, { quantity: 5, note: "Weekly delivery" }) });
add("post", "/api/v1/admin/inventory/{id}/adjust", "Inventory", "Adjust stock", ["admin", "manager"], { branch: true, parameters: [p("id", "Inventory item ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody({ type: "object", required: ["quantity"], properties: { quantity: { type: "number" }, note: { type: "string", maxLength: 500 } } }, { quantity: -1, note: "Damaged stock" }) });
add("get", "/api/v1/admin/inventory/{id}/logs", "Inventory", "List stock logs", ["admin", "manager"], { branch: true, parameters: [p("id", "Inventory item ID.", "507f1f77bcf86cd799439011")] });
add("delete", "/api/v1/admin/inventory/{id}", "Inventory", "Delete inventory item", ["admin", "manager"], { branch: true, parameters: [p("id", "Inventory item ID.", "507f1f77bcf86cd799439011")] });

add("get", "/api/v1/admin/customers", "Customers", "List customers", ["admin", "manager"], { branch: true, parameters: [q("search", { type: "string", maxLength: 100 }, "Search term.")] });
add("get", "/api/v1/admin/customers/{customerId}", "Customers", "Get customer", ["admin", "manager"], { branch: true, parameters: [p("customerId", "Customer ID.", "507f1f77bcf86cd799439011")] });
add("post", "/api/v1/admin/customers", "Customers", "Create customer", ["admin", "manager"], { branch: true, status: 201, requestBody: jsonBody(ref("Customer"), examples.customer) });
add("put", "/api/v1/admin/customers/{customerId}", "Customers", "Update customer", ["admin", "manager"], { branch: true, parameters: [p("customerId", "Customer ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody(ref("Customer"), examples.customer) });
add("delete", "/api/v1/admin/customers/{customerId}", "Customers", "Delete customer", ["admin"], { branch: true, parameters: [p("customerId", "Customer ID.", "507f1f77bcf86cd799439011")] });

add("get", "/api/v1/admin/reports/summary", "Reports", "Get sales summary", ["admin", "manager"], { branch: true, parameters: [q("range", { type: "string", enum: ["today", "week", "month", "custom"] }, "Report range.", "today"), q("from", { type: "string", format: "date-time" }, "Custom range start."), q("to", { type: "string", format: "date-time" }, "Custom range end.")] });
add("get", "/api/v1/admin/reports/top-items", "Reports", "Get top items", ["admin", "manager"], { branch: true, parameters: [q("range", { type: "string" }, "Report range.", "week")] });
add("get", "/api/v1/admin/reports/payments", "Payments", "Get payment report", ["admin", "manager"], { branch: true, parameters: [q("range", { type: "string" }, "Report range.", "month")] });
add("get", "/api/v1/admin/reports/hourly", "Reports", "Get hourly sales", ["admin", "manager"], { branch: true, parameters: [q("range", { type: "string" }, "Report range.", "today")] });
add("get", "/api/v1/cashier/income", "Reports", "Get cashier income", ["cashier"], { branch: true });

add("get", "/api/v1/admin/settings", "Settings", "Get branch settings", ["admin", "manager"], { branch: true });
add("put", "/api/v1/admin/settings", "Settings", "Save branch settings", ["admin"], { branch: true, requestBody: jsonBody(ref("Settings"), examples.settings) });
add("get", "/api/v1/settings", "Settings", "Get receipt settings", ["admin", "manager", "cashier"], { branch: true });

add("post", "/api/v1/cashier/billing", "Billing", "Create bill", ["cashier", "admin", "manager"], { branch: true, status: 201, requestBody: jsonBody(ref("Bill"), { customerName: "Asha Rao", customerPhone: "9876543210", items: examples.order.items, paymentStatus: "unpaid", paymentMethod: "none" }) });
add("get", "/api/v1/cashier/bills", "Billing", "List bills", ["cashier", "admin", "manager"], { branch: true, parameters: [q("status", { type: "string", enum: ["unpaid", "paid"] }, "Payment status."), q("search", { type: "string", maxLength: 100 }, "Search term.")] });
add("get", "/api/v1/cashier/bills/{billId}", "Billing", "Get bill", ["cashier", "admin", "manager"], { branch: true, parameters: [p("billId", "Bill ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/cashier/bills/{billId}/pay", "Payments", "Pay bill", ["cashier", "admin", "manager"], { branch: true, parameters: [p("billId", "Bill ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody(ref("Payment"), { paymentMethod: "upi" }) });
add("delete", "/api/v1/cashier/bills/{billId}", "Billing", "Delete bill", ["cashier", "admin", "manager"], { branch: true, parameters: [p("billId", "Bill ID.", "507f1f77bcf86cd799439011")] });

add("post", "/api/v1/cashier/takeaway-orders", "Orders", "Create takeaway order", ["cashier", "admin", "manager"], { branch: true, status: 201, requestBody: jsonBody(ref("Order"), examples.takeaway) });
add("get", "/api/v1/cashier/takeaway-orders", "Orders", "List takeaway orders", ["cashier", "admin", "manager"], { branch: true });
add("get", "/api/v1/cashier/takeaway/{orderId}", "Orders", "Get takeaway order", ["cashier", "admin", "manager"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/cashier/takeaway/{orderId}/send", "Kitchen", "Send takeaway order to kitchen", ["cashier", "admin", "manager"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/cashier/takeaway/{orderId}/received", "Orders", "Mark takeaway order received", ["cashier", "admin", "manager"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/cashier/takeaway/{orderId}/cancel", "Orders", "Cancel takeaway order", ["cashier", "admin", "manager"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });

add("get", "/api/v1/waiter/menu", "Menu", "List available menu for waiter", ["waiter", "manager", "admin", "cashier"], { branch: true, parameters: [q("category", { type: "string" }, "Menu category."), q("search", { type: "string" }, "Search term.")] });
add("get", "/api/v1/waiter/orders/table/{tableId}", "Orders", "List table orders", ["waiter", "manager", "admin", "cashier"], { branch: true, parameters: [p("tableId", "Table ID.", "507f1f77bcf86cd799439011")] });
add("post", "/api/v1/waiter/orders/table/{tableId}/send-to-cashier", "Billing", "Send table order to cashier", ["waiter", "manager", "admin", "cashier"], { branch: true, status: 201, parameters: [p("tableId", "Table ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody({ type: "object", properties: { customerName: { type: "string" }, customerPhone: { type: "string" }, tableNumber: { type: "number", nullable: true } } }, { customerName: "Asha Rao", tableNumber: 4 }) });
add("post", "/api/v1/waiter/orders", "Orders", "Create waiter order", ["waiter", "manager", "admin", "cashier"], { branch: true, status: 201, requestBody: jsonBody(ref("Order"), examples.order) });
add("get", "/api/v1/waiter/orders", "Orders", "List waiter orders", ["waiter", "manager", "admin", "cashier"], { branch: true, parameters: [branchQuery, q("page", { type: "integer", minimum: 1 }, "Page number.", 1), q("limit", { type: "integer", minimum: 1, maximum: 100 }, "Page size.", 20)] });
add("get", "/api/v1/waiter/orders/{orderId}", "Orders", "Get waiter order", ["waiter", "manager", "admin", "cashier"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/waiter/orders/{orderId}/send", "Kitchen", "Send waiter order to kitchen", ["waiter", "manager", "admin", "cashier"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/waiter/orders/{orderId}/served", "Orders", "Mark waiter order served", ["waiter", "manager", "admin", "cashier"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/waiter/orders/{orderId}/cancel", "Orders", "Cancel waiter order", ["waiter", "manager", "admin", "cashier"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("post", "/api/v1/waiter/allocate/{tableId}", "Tables", "Allocate table", ["waiter", "manager", "admin"], { branch: true, parameters: [p("tableId", "Table ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody({ type: "object", properties: { name: { type: "string", maxLength: 150 }, phone: { type: "string", maxLength: 30 } } }, { name: "Asha Rao", phone: "9876543210" }) });
add("put", "/api/v1/waiter/free/{tableId}", "Tables", "Free table", ["waiter", "manager", "admin"], { branch: true, parameters: [p("tableId", "Table ID.", "507f1f77bcf86cd799439011")] });

add("get", "/api/v1/chef/kot", "Kitchen", "List active KOTs", ["chef", "admin", "manager"], { branch: true });
add("get", "/api/v1/chef/kot/{orderId}", "Kitchen", "Get KOT", ["chef", "admin", "manager"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/chef/kot/{orderId}/start", "Kitchen", "Start KOT", ["chef", "admin", "manager"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/chef/kot/{orderId}/ready", "Kitchen", "Mark KOT ready", ["chef", "admin", "manager"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });
add("put", "/api/v1/chef/kot/{orderId}/cancel", "Kitchen", "Cancel KOT", ["chef", "admin", "manager"], { branch: true, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });

add("get", "/api/v1/public/menu/{tableId}", "Menu", "Get QR menu", [], { authenticated: false, parameters: [p("tableId", "Table ID.", "507f1f77bcf86cd799439011")] });
add("post", "/api/v1/public/order/{tableId}", "Orders", "Place public table order", [], { authenticated: false, status: 201, parameters: [p("tableId", "Table ID.", "507f1f77bcf86cd799439011")], requestBody: jsonBody(ref("Order"), { customerName: "Asha Rao", customerPhone: "9876543210", items: examples.order.items }) });
add("get", "/api/v1/public/order/{orderId}/status", "Orders", "Get public order status", [], { authenticated: false, parameters: [p("orderId", "Order ID.", "507f1f77bcf86cd799439011")] });

add("post", "/api/v1/ai/chat", "AI", "Chat with the branch AI assistant", ["admin", "manager"], { branch: true, description: "KOT POS sends a sanitized subset of the optional client-supplied restaurant context to Google Gemini and returns plain text. The Gemini credential remains server-side", requestBody: jsonBody({ type: "object", required: ["message"], properties: { message: { type: "string", minLength: 1, maxLength: 2000 }, context: { type: "object", description: "Optional dashboard context. The service allowlists known summary fields and at most five topItems before prompting Gemini." } } }, { message: "Which items are low in stock?", context: { criticalStockItems: ["Paneer"] } }), successResponse: jsonResponse("Gemini-backed assistant response or a safe provider fallback message.", ref("AiChatResponse"), { reply: "Paneer is currently the critical stock item in the supplied context." }), errorStatuses: [400, 401, 403, 429, 500, 503] });
add("get", "/api/v1/ai/inventory-alerts", "AI", "Get inventory alerts", ["admin", "manager"], { branch: true, description: "Calculates branch-scoped inventory alert levels locally from inventory and recent deduction logs; this route does not call Gemini", successResponse: jsonResponse("Branch inventory alerts and counts.", ref("AiInventoryAlertsResponse")), errorStatuses: [400, 401, 403, 429, 500] });
add("get", "/api/v1/ai/daily-summary", "AI", "Get daily business summary", ["admin", "manager"], { branch: true, description: "Builds yesterday's branch-scoped operational summary, caches it for 600 seconds, and asks Google Gemini for concise summary text when configured. Missing or failed Gemini access falls back to deterministic local text", successResponse: jsonResponse("Structured daily metrics plus summary text.", ref("AiDailySummaryResponse")), errorStatuses: [400, 401, 403, 429, 500] });
add("get", "/api/version", "Health", "Get API version information", [], { authenticated: false });
add("get", "/health", "Health", "Liveness health check", [], { authenticated: false });
add("get", "/ready", "Health", "Readiness health check", [], { authenticated: false });

const openapi = {
  openapi: "3.0.3",
  info: { title: "KOT POS Backend API", version: "1.0.0", description: "Production API documentation for the current KOT POS backend. AI requests use KOT POS REST endpoints and are processed server-side through Google Gemini where noted. The route contract remains /api/v1; this documentation sprint adds no business or route changes." },
  servers: [{ url: "http://localhost:3000", description: "Local development" }, { url: "https://api.example.com", description: "Production placeholder; set the actual backend URL in deployment tooling." }],
  tags: ["Authentication", "Users", "Branches", "Staff", "Customers", "Inventory", "Categories", "Menu", "Tables", "Orders", "Kitchen", "Billing", "Payments", "Reports", "Settings", "AI", "Health"].map((name) => ({ name, description: name === "Categories" ? "No category-specific route is currently mounted; menu and inventory category filters are documented on their owning endpoints." : `${name} endpoints.` })),
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Paste the access JWT returned by the login flow. The implementation also accepts the token cookie." } },
    schemas,
    responses,
    parameters: { BranchId: branchQuery },
  },
};

module.exports = openapi;
