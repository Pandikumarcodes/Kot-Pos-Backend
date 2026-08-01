const customerRepository = require("../repositories/CustomerRepository");
const AppError = require("../utils/AppError");
const {
  buildMasterDataPlan,
  hasQueryControls,
  paginationFor,
  repositoryOptions,
  usesPagination,
} = require("./masterDataQuery");

const CUSTOMER_QUERY_POLICY = Object.freeze({
  pagination: { defaultPage: 1, defaultLimit: 20, maxLimit: 100 },
  searchableFields: [
    { field: "name", mode: "partial" },
    { field: "phone", mode: "partial" },
  ],
  filters: {},
  sorting: {
    fields: { name: "name", createdAt: "createdAt" },
    defaultField: "createdAt",
    defaultOrder: "desc",
  },
  fieldSelection: {
    fields: {
      id: "_id",
      name: "name",
      phone: "phone",
      email: "email",
      address: "address",
      totalOrders: "totalOrders",
      totalSpent: "totalSpent",
      lastVisit: "lastVisit",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    defaultFields: [
      "id", "name", "phone", "email", "address", "totalOrders",
      "totalSpent", "lastVisit", "createdAt", "updatedAt",
    ],
  },
});

const listCustomers = async (query = {}) => {
  if (!hasQueryControls(query)) {
    return { items: await customerRepository.listByLastVisit() };
  }

  const paginated = usesPagination(query);
  const plan = buildMasterDataPlan({ query, policy: CUSTOMER_QUERY_POLICY });
  const dataPromise = customerRepository.listByLastVisit({
    ...repositoryOptions(plan, paginated),
    filter: plan.filter,
  });
  const [items, total] = paginated
    ? await Promise.all([dataPromise, customerRepository.count(plan.filter)])
    : [await dataPromise, null];
  return {
    items,
    ...(paginated && { pagination: paginationFor(plan, total) }),
  };
};

const getCustomer = async (customerId) => {
  const customer = await customerRepository.findById(customerId);
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

const createCustomer = async ({ name, phone, email, address }) => {
  if (await customerRepository.findByPhone(phone)) {
    throw new AppError("Customer with this phone already exists", 400);
  }
  return customerRepository.createCustomer({ name, phone, email, address });
};

const updateCustomer = async (customerId, { name, phone, email, address }) => {
  const customer = await customerRepository.updateCustomer(customerId, {
    name,
    phone,
    email,
    address,
  });
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

const deleteCustomer = async (customerId) => {
  const customer = await customerRepository.deleteCustomer(customerId);
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
