# Real-time API

KOT POS uses Socket.IO on the same HTTP server as Express. The server authenticates each connection and assigns rooms from persisted user identity.

## Connection authentication

The server searches for an access token in this order:

1. `socket.handshake.auth.token`
2. `Authorization: Bearer <token>` handshake header
3. `token` cookie

It verifies the JWT with `JWT_SECRET`, loads the User document, and requires:

- Existing active user.
- One of the six recognized roles.
- Branch assignment for non-superadmins.
- No branch assignment for superadmin.
- Existing active branch for non-superadmins.

Failure returns the generic Socket.IO connection error `Unauthorized`.

The current Socket verifier does not explicitly restrict JWT algorithms or validate `tokenType`; HTTP authentication is stricter.

## Room model

```text
branch:<branchId>:role:<role>
```

Examples:

```text
branch:<branch-object-id>:role:chef
branch:<branch-object-id>:role:waiter
branch:<branch-object-id>:role:cashier
branch:global:role:superadmin
```

Room membership is derived exclusively from the loaded user. The client cannot request another branch or role room.

On connection, the server emits:

```text
room:joined
```

Payload fields are `role` and `branchId`. Socket.IO removes room membership at disconnect; the application also removes its stored user metadata.

Known application-contract gap: the current frontend listener expects `{ room }`, while this backend emits `{ role, branchId }`. That mismatch leaves the frontend acknowledgement value undefined, but it does not change server-side authorization or room membership. This documentation task does not change either application's payload contract.

## Server-emitted operational events

| Event | Trigger | Recipient roles in the same branch |
|---|---|---|
| `order:new` | Successful waiter/takeaway order-to-KOT transaction | chef, admin, manager |
| `kot:updated` | Kitchen KOT status change | chef, waiter, cashier, admin, manager |
| `table:updated` | Table create/update/delete, allocation/free, billing/payment state | admin, manager, waiter |
| `billing:created` | Bill creation or payment update | admin, manager, cashier |

Despite its name, `billing:created` is also used when a bill is marked paid.

Superadmin receives no operational branch events. The global superadmin room exists for authentication/room consistency but is not targeted by current notification services.

## Event timing and transactions

For transaction-backed workflows, events are emitted after successful commit:

- Order-to-KOT creation.
- Kitchen audited status transition.
- Table-to-bill creation.
- Payment and table release.

This prevents clients receiving an event for a transaction that subsequently rolls back.

Some table operations are non-transactional and emit after a successful document save/update.

## Public QR behavior

Public QR order creation currently creates a KOT but does not call `notify.newOrder`. Chefs can see it through subsequent KOT reads, but no `order:new` Socket.IO event is emitted for that creation path.

When a public order occupies an available table, `table:updated` is emitted.

## Generic emitters

The notification module also exports generic `toRoom` and `toAll` helpers. No mounted route accepts arbitrary room or event input, and normal operational services use the role-specific helpers.

## CORS

Socket.IO uses the same origin function and credential policy as Express:

- Requests without an Origin header are allowed.
- Exact configured/local origins are allowed.
- Other origins are rejected.
- Credentials are enabled.

## Scaling limitation

There is no Socket.IO Redis adapter or other inter-process adapter. In a multi-instance deployment:

- A socket belongs to one process.
- An event emitted by another process is not forwarded to it.

Until an adapter is added, deploy a single real-time application instance or use sticky routing with the understanding that cross-instance events remain incomplete.

## Client connection example

```js
import { io } from "socket.io-client";

const socket = io("https://<backend-host>", {
  withCredentials: true,
  // Alternatively: auth: { token: "<access-token>" }
});

socket.on("room:joined", ({ role, branchId }) => {
  console.log({ role, branchId });
});

socket.on("order:new", (kot) => {
  // Refresh or insert the new branch-local KOT.
});
```

Do not let the client construct or select authorization rooms. Treat event payloads as notifications and refetch authoritative state when correctness is important.
