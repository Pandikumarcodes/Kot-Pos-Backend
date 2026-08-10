const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$", example: "507f1f77bcf86cd799439011" };

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (schema, example) => ({ required: true, content: { "application/json": { schema, example } } });
const parameter = (name, inValue, schema, description, required = false, example) => ({
  name,
  in: inValue,
  required,
  description,
  schema,
  ...(example !== undefined ? { example } : {}),
});

const examples = {
  credentials: { username: "manager@example.com", password: "StrongPassword123" },
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
  Branch: { type: "object", properties: { _id: id, name: { type: "string", example: "Downtown Branch" }, address: { type: "string" }, phone: { type: "string" }, email: { type: "string", format: "email" }, gstin: { type: "string" }, isActive: { type: "boolean", example: true } }, additionalProperties: true },
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
};

const paths = {};
const add = (method, path, tag, summary, roles, options = {}) => {
  const authenticated = options.authenticated !== false;
  const operation = {
    tags: [tag], summary, description: `${options.description || summary}. ${authenticated ? `Requires Bearer access token (or the existing auth cookie). Allowed roles: ${roles?.length ? roles.join(", ") : "authenticated user"}.` : "Public endpoint."} ${options.branch ? "Branch scope is applied from the authenticated user's branch; super admins may select branchId where the implementation permits it." : "No branch scope is applied by this route."}`,
    operationId: options.operationId || `${method}${path.replace(/[^a-zA-Z0-9]+/g, "-")}`,
    parameters: [...(options.parameters || []), ...(authenticated ? authHeaders : [])],
    responses: { ...(options.status === 201 ? { 201: responses[201] } : { 200: responses[200] }), ...(options.status === 204 ? { 204: { description: "No content." } } : {}), 400: responses[400], 401: responses[401], 403: responses[403], 404: responses[404], 409: responses[409], 422: responses[422], 429: responses[429], 500: responses[500] },
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

add("post", "/api/v1/ai/chat", "AI", "Chat with the branch AI assistant", ["admin", "manager"], { branch: true, requestBody: jsonBody({ type: "object", required: ["message"], properties: { message: { type: "string", minLength: 1, maxLength: 2000 }, context: { type: "object" } } }, { message: "Which items are low in stock?", context: {} }) });
add("get", "/api/v1/ai/inventory-alerts", "AI", "Get AI inventory alerts", ["admin", "manager"], { branch: true });
add("get", "/api/v1/ai/daily-summary", "AI", "Get AI daily summary", ["admin", "manager"], { branch: true });
add("get", "/api/version", "Health", "Get API version information", [], { authenticated: false });
add("get", "/health", "Health", "Liveness health check", [], { authenticated: false });
add("get", "/ready", "Health", "Readiness health check", [], { authenticated: false });

const openapi = {
  openapi: "3.0.3",
  info: { title: "KOT POS Backend API", version: "1.0.0", description: "Production API documentation for the current KOT POS backend. The route contract remains /api/v1; this documentation sprint adds no business or route changes." },
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
