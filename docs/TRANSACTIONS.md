# MongoDB Transactions and Atomic Workflows

## Transaction manager

Critical workflows use `TransactionManager`, which wraps a Mongoose session and `session.withTransaction()`.

Default transaction options:

- Read preference: primary.
- Read concern: snapshot.
- Write concern: majority.
- Transient transaction retries: up to three retries after the initial attempt.
- Session cleanup after both success and failure.

Recognized transient errors are retried. Non-transient errors are rethrown. Abort and session-cleanup failures do not replace the original workflow result.

MongoDB transactions require a replica set or sharded deployment. A standalone MongoDB server is insufficient for the workflows below.

## Atomic branch-admin workflows

### Assign existing admin candidate

`branchService.assignBranchAdmin` atomically:

1. Loads the branch.
2. Reconciles `Branch.adminUser` with any role-admin user in the branch.
3. Validates candidate eligibility.
4. Demotes the previous admin to manager when replacing.
5. Revokes refresh hashes for affected users.
6. Assigns candidate role and branch.
7. Updates `Branch.adminUser`.
8. Writes branch-admin assignment/replacement audit event.

### Create and assign a branch admin

`branchService.createBranchAdmin` performs the same replacement steps but creates the new User inside the transaction.

Branch creation itself is not transactional with creation of its Settings row. Branch update, deactivation, ordinary staff assignment, and staff removal are also not transaction-backed.

## Atomic inventory workflows

### Inventory creation

The transaction can include:

- Inventory record.
- Initial restock StockLog when initial stock is positive.
- Linked global MenuItem availability update.
- Inventory audit event.

### Restock

The transaction includes:

- Inventory stock increment.
- Restock StockLog.
- Menu availability restoration when stock moves from zero to positive.
- Audit event.

### Manual adjustment

The transaction includes:

- Signed stock adjustment, clamped at zero.
- Adjustment StockLog.
- Menu availability update when zero/nonzero state changes.
- Audit event.

Inventory metadata updates and soft deactivation are not transactional or currently audit-integrated.

### Automatic order deduction is not atomic

`deductStockForKot` is named for KOT deduction but is invoked immediately after waiter or takeaway draft creation. It:

- Runs asynchronously without delaying the API response.
- Does not share a transaction with order creation.
- Processes linked inventory items sequentially.
- Can partially succeed.
- Does not run for public QR orders.

It must not be described as an atomic order/inventory reservation.

## Atomic order-to-KOT workflows

### Dine-in

Sending a TableOrder to kitchen atomically:

1. Loads the scoped TableOrder.
2. Loads the branch-owned table.
3. Rejects an already-sent order.
4. Updates TableOrder to `sent_to_kitchen`.
5. Creates a branch-owned dine-in KOT in `pending`.
6. Writes the send-to-kitchen audit event.

`order:new` is emitted only after commit.

### Takeaway

Sending a TakeAway order to kitchen atomically:

1. Loads the scoped takeaway order.
2. Rejects an already-sent order.
3. Updates it to `sent_to_kitchen`.
4. Creates a branch-owned takeaway KOT.
5. Writes the audit event.

`order:new` is emitted only after commit.

Draft TableOrder/TakeAway creation and ordinary served/received/cancelled status updates are not transactional.

## Atomic kitchen transitions

Recognized kitchen transitions (`preparing`, `ready`, and `cancelled`) load and update the scoped KOT and write the corresponding audit event in one transaction. Socket.IO `kot:updated` is emitted after commit.

The KOT transaction does not update the source TableOrder or TakeAway record. Those state models remain independent.

## Atomic table-to-bill workflow

`waiterOrderService.sendToCashier` atomically:

1. Loads the branch-owned table.
2. Loads active TableOrders created by current members of the branch.
3. Rejects a second unpaid bill for that table.
4. Generates a bill number.
5. Creates an unpaid Billing record with item snapshots.
6. Marks selected TableOrders `served`.
7. Sets the table to `billing`.
8. Writes the bill-created audit event.

Table and billing Socket.IO events are emitted after commit.

Important constraints:

- The bill is scoped indirectly by creator membership because Billing has no branch field.
- Bill-number generation uses today's bill count plus one and can collide under concurrent creation despite the unique index.
- TableOrders already marked `served` are excluded and therefore cannot be picked up by this workflow.

## Atomic payment and table release

`billingService.payBill` atomically:

1. Loads the scoped bill.
2. Requires it to be unpaid.
3. Sets `paymentStatus: paid`.
4. Sets `paidAt` and optional payment method.
5. If a table is linked, sets it to `available` and clears `currentCustomer`.
6. Writes the payment audit event.

Table and billing events are emitted after commit.

The independent waiter `free` endpoint is not part of this transaction and can release a billing table without payment. Direct bill creation is not transactional or audit-integrated.

## Audit failure semantics

Successful audit records for transactional workflows use the same Mongo session, so a failure writing the required audit record aborts the business transaction.

After a transaction fails, services generally attempt a minimal sanitized FAILURE audit event without the failed session. This allows the failure record to survive rollback. A secondary failure while recording the failure event is usually suppressed so the original business error is preserved.

## Seed transactions

- Full seed creation runs its inserts and operational fixture construction in a MongoDB transaction.
- Customer-only reseed deletes/recreates Customer rows and recalculates metrics in a transaction.
- Guarded cleanup for `--clean` occurs before the seed transaction and uses collection-level deletes; it is protected by environment/database-name checks but is not rolled back with the later seed transaction.

See [Seeding](SEEDING.md).

## Non-transactional operations summary

The following should not be described as atomic multi-document workflows:

- Public signup/login/refresh/logout persistence as a group.
- Branch creation plus Settings creation.
- Branch metadata update/deactivation.
- Ordinary staff assignment/removal.
- Menu, Customer, Table, and Settings CRUD.
- Draft waiter/takeaway creation.
- Public QR order creation and table occupation.
- Automatic inventory deduction.
- Direct cashier bill creation/deletion.
- Manual table allocation/freeing.
- Inventory metadata update/deactivation.
