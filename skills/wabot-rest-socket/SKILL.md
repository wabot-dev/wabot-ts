---
name: wabot-rest-socket
description: Use when exposing HTTP endpoints or Socket.IO namespaces from a Wabot app. Covers @restController, @onGet / @onPost / @onPut / @onDelete, @middleware and IMiddleware, @rateLimit (fixed-window, 429 + rate-limit headers), the EXPRESS_REQ / EXPRESS_RES tokens, the RestRequest base for raw-request access, plus @socketController, @onSocketEvent, @handshakeMiddlewares and IHandshakeMiddleware. Argument validation is shared with wabot-validation.
---

# REST and Socket controllers

Wabot's HTTP and Socket layers sit on top of Express and Socket.IO. You write controllers; the framework boots the server (default `PORT=3000`).

## REST controller

```typescript
import {
  injectable,
  isNotEmpty,
  isNumber,
  isString,
  middleware,
  onGet,
  onPost,
  restController,
} from '@wabot-dev/framework'

class CreateOrderRequest {
  @isString() @isNotEmpty() productId!: string
  @isNumber() quantity!: number
}

@injectable()
export class AuditMiddleware implements IMiddleware {
  async handle(req, res, container) {
    // record, throw CustomError to short-circuit
  }
}

@restController('/orders')
export class OrdersController {
  constructor(private orders: OrderService) {}

  @onGet('/:id')
  async getOne(req: { id: string }) {
    return this.orders.find(req.id)
  }

  @onPost()
  @middleware(AuditMiddleware)
  async create(req: CreateOrderRequest) {
    return this.orders.create(req)
  }
}
```

Path resolution: `restController('/orders')` + `onPost()` → `POST /orders`. `onGet('/:id')` → `GET /orders/:id`. Either decorator accepts a `string` path or `{ path, disableJsonParser?, disableUrlEncodedParser? }`.

Argument binding:

- 0 parameters → no binding.
- 1 parameter typed as a validator class → framework merges `req.body`, `req.query`, `req.params` and runs `validateAndTransform` against the class. Validation errors produce HTTP 400.
- 1 parameter typed as `IncomingMessage` (Node's `http` type) → raw request injected.
- 1 parameter that extends `RestRequest` → the full Express `Request` is passed (no merge). Use this for streaming or multipart.

`@restController` applies `@injectable()`. Endpoint methods may be `async`; the return value is `res.status(200).json(value ?? null)`. To control status or headers, inject the response via `@inject(EXPRESS_RES)` or throw a `CustomError({ httpCode, message, info? })`.

### Middleware

```typescript
import { IMiddleware, injectable, middleware } from '@wabot-dev/framework'

@injectable()
export class RequireApiVersion implements IMiddleware {
  async handle(req, res, container) {
    if (req.header('x-api-version') !== '2')
      throw new CustomError({ httpCode: 400, message: 'Unsupported API version' })
  }
}

@restController('/api')
class ApiController {
  @onGet('/me')
  @middleware(RequireApiVersion)
  async me() {
    /* ... */
  }
}
```

Multiple `@middleware(X)` decorations run in declaration order. Middlewares are resolved out of the request's child container, so per-request injectables (e.g. `Auth`) work.

### Rate limiting

For rate limiting, use the built-in `@rateLimit` rather than a hand-rolled middleware. It counts each request in a fixed window (in-memory or Postgres, chosen by `DATABASE_URL`), sets `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `Retry-After`, and throws HTTP 429 when the limit is exceeded:

```typescript
import { onPost, rateLimit, restController } from '@wabot-dev/framework'

@restController('/api')
class ApiController {
  @onPost('/messages')
  @rateLimit({ limit: 20, windowSeconds: 60 }) // default key: per-route-per-IP
  async send(req: SendRequest) {
    /* ... */
  }
}
```

Pass `key: (req) => ...` to bucket per user / API key instead of per IP. For non-HTTP paths (e.g. per-user LLM limits) resolve the `RateLimiter` utility directly — see `wabot-ops`.

This is app-level fairness / cost control, not a DoS shield — reject volumetric floods at the edge (nginx / gateway / CDN).

### Inheritance

Endpoint and middleware metadata is inherited. A subclass automatically picks up parent endpoints; the subclass's `@restController(path)` becomes the base path. Child endpoints override parents on a per-method-name basis.

### Tokens

```typescript
import { container, EXPRESS_REQ, EXPRESS_RES, inject, injectable } from '@wabot-dev/framework'
import type { Request, Response } from 'express'

@injectable()
class CookieReader {
  constructor(
    @inject(EXPRESS_REQ) private req: Request,
    @inject(EXPRESS_RES) private res: Response,
  ) {}
}
```

These tokens live in the per-request child container only — never resolve them from the root.

## Socket controller

```typescript
import {
  handshakeMiddlewares,
  IHandshakeMiddleware,
  injectable,
  isNumber,
  onSocketEvent,
  socketController,
} from '@wabot-dev/framework'
import { Socket } from 'socket.io'

class JoinRoomReq {
  @isNumber() roomId!: number
}

@injectable()
class CookieAuthMw implements IHandshakeMiddleware {
  async handle(socket: Socket, container) {
    // throw CustomError to refuse the connection
  }
}

@socketController('chat')
@handshakeMiddlewares([CookieAuthMw])
export class ChatSocketController {
  @onSocketEvent('connection')
  async onConnect(socket: Socket) {
    socket.emit('hello', { ok: true })
  }

  @onSocketEvent('join')
  async onJoin(req: JoinRoomReq, socket: Socket) {
    socket.join(`room:${req.roomId}`)
  }
}
```

- `@socketController('chat')` → namespace `/chat`. Pass `undefined` or `''` for the default namespace `/`.
- `@onSocketEvent('join')` registers a listener. Method signature: `(req, socket?)`. If the first arg type is `Socket`, no body validation is done. Otherwise the body is validated against that DTO class. A `connection` event handler runs once when the socket connects.
- `@handshakeMiddlewares([Mw, ...])` runs the middlewares during the Socket.IO `use(...)` phase, before `connection`. Throw a `CustomError` to refuse the handshake.

If the client uses `socket.emit('join', payload, ack)` the return value of the handler is passed to `ack`. Throwing produces `ack({ error: ... })`.

## Boot

Both layers boot automatically when the project runner finds at least one `@restController` (REST) or `@socketController` (sockets). Manually they expose `runRestControllers([...])` / `runSocketControllers([...])`.

Both share one Express + HTTP server via `ExpressProvider` / `HttpServerProvider` (singleton). Set `PORT` in `.env` to change the listen port.

## Rules

- Always type the endpoint/socket parameter — the framework relies on `design:paramtypes` reflection to bind it.
- REST endpoints can have 0 or 1 parameter. More than one throws at boot.
- Socket events can have up to 2 parameters: `(req, socket)`. The framework injects the active `Socket`.
- Don't disable JSON parsing globally — disable per-endpoint via `@onPost({ path, disableJsonParser: true })` when you need raw bytes.
- For auth, prefer `@jwtGuard()` / `@apiKeyGuard()` (see `wabot-auth`) over hand-rolled middleware.

## Testing

`createRestHarness({ controllers, jwt?, register? })` from `@wabot-dev/framework/testing` mounts `@restController` classes on a private ephemeral-port server and exercises the real pipeline (parsers, middlewares/guards, validation, error mapping). `harness.request(...)` returns `{ status, body, headers }`; `harness.as(authInfo)` sends signed Bearer tokens through the real `@jwtGuard`, and `harness.as(authInfo, { cookie, audience })` sends them in a session cookie with an `aud` claim. See the `wabot-testing` skill.
