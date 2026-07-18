---
name: wabot-auth
description: Use when adding authentication to a Wabot REST endpoint or Socket.IO namespace, issuing JWT access/refresh tokens, or protecting endpoints with API keys. Covers the chat/request-scoped Auth<D> service, @jwtGuard / @jwtHandshakeGuard, JwtConfig and the JWT_* env vars, Jwt.createToken / findRefreshTokenAuthInfo, JwtRefreshToken, and @apiKeyGuard / @apiKeyHandshakeGuard with PgApiKeyRepository / RemoteApiKeyRepository.
---

# Authentication

Wabot's auth is request-scoped. A guard middleware verifies the credential, then writes the resolved auth info into the per-request/socket `Auth<D>` instance. Downstream code reads it with `auth.require()`.

## `Auth<D>`

```typescript
import { Auth, injectable } from '@wabot-dev/framework'

interface SessionInfo {
  userId: string
  role: 'admin' | 'user'
}

@injectable()
export class OrdersService {
  constructor(private auth: Auth<SessionInfo>) {}

  list() {
    const session = this.auth.require() // throws CustomError({ httpCode: 401 }) if not assigned
    return this.repo.findByUserId(session.userId)
  }
}
```

`Auth` is `@scoped(Lifecycle.ContainerScoped)` and exists once per request, chat, or socket connection. Methods:

- `assign(info)` — sets the auth info (used by guards). Throws if already assigned.
- `override(info)` — replaces even when assigned (use cautiously).
- `require()` — returns the info or throws 401.
- `isAssigned()` / `wasOverrided()` / `clear()`.

## JWT — REST

```typescript
import { jwtGuard, onGet, onPost, restController } from '@wabot-dev/framework'

@restController('/account')
export class AccountController {
  @onGet('/me')
  @jwtGuard()
  async me(_, auth: Auth<SessionInfo>) {
    return auth.require()
  }
}
```

`@jwtGuard()` reads `Authorization: Bearer <token>`, verifies it with `JwtConfig` (env-driven, see below), and calls `auth.assign(payload)`.

## JWT — Socket

```typescript
import { jwtHandshakeGuard, socketController } from '@wabot-dev/framework'

@socketController('private')
@jwtHandshakeGuard()
export class PrivateSocketController {
  /* ... */
}
```

The token is read from `socket.handshake.auth.token` first, falling back to the `Authorization` header.

## Issuing tokens

```typescript
import {
  Auth,
  Jwt,
  JwtAccessAndRefreshTokenDto,
  injectable,
  onPost,
  restController,
} from '@wabot-dev/framework'

@restController('/auth')
export class AuthController {
  constructor(
    private jwt: Jwt,
    private auth: Auth<SessionInfo>,
  ) {}

  @onPost('/login')
  async login(body: LoginRequest): Promise<JwtAccessAndRefreshTokenDto> {
    const session = await this.userService.verify(body)
    this.auth.assign(session)
    return this.jwt.createToken({ device: body.device ?? 'unknown' })
  }

  @onPost('/refresh')
  async refresh(body: RefreshRequest): Promise<JwtAccessAndRefreshTokenDto> {
    const session = await this.jwt.findRefreshTokenAuthInfo(body.refreshToken)
    this.auth.override(session)
    return this.jwt.createToken()
  }
}
```

`Jwt.createToken(metadata?)`:

- Reads the current `auth.require()` info.
- Persists a `JwtRefreshToken` via `JwtRefreshTokenRepository`. The base class throws `Method not implemented` — the project must register an implementation: `container.registerType(JwtRefreshTokenRepository, PgJwtRefreshTokenRepository)` (table `wabot.jwt_refresh_token`), or its own.
- Returns `{ access: { token, expiration }, refresh: { token, expiration } }`.

`Jwt.findRefreshTokenAuthInfo(secret)` validates the refresh secret (hash-compare + expiration + revocation) and returns the original auth payload. Throws 401 if any check fails.

### Env vars

| Variable                         | Default           | Description                                             |
| -------------------------------- | ----------------- | ------------------------------------------------------- |
| `JWT_SECRET`                     | (required)        | Symmetric secret or asymmetric key used for sign/verify |
| `JWT_ALGORITHM`                  | `HS256`           | Any `jsonwebtoken.Algorithm`                            |
| `JWT_ACCESS_EXPIRATION_SECONDS`  | `600` (10 min)    | Access token lifetime                                   |
| `JWT_REFRESH_EXPIRATION_SECONDS` | `31536000` (1 yr) | Refresh token lifetime                                  |

`JwtConfig` is `@singleton()` and reads these at boot.

### Refresh-token metadata

`JwtRefreshToken<D>` exposes `metadata` (the arbitrary `Record<string, string>` you passed to `createToken`), `expirationTime`, `revoke()`, and `isValidToken(secret)`. The repository exposes `findByMetadata(metadata)` so you can revoke all tokens issued to a device.

## API key

```typescript
import {
  apiKeyGuard,
  apiKeyHandshakeGuard,
  onGet,
  restController,
  socketController,
} from '@wabot-dev/framework'

@restController('/internal')
export class InternalController {
  @onGet('/health')
  @apiKeyGuard()
  async health() {
    return { ok: true }
  }
}

@socketController('admin')
@apiKeyHandshakeGuard()
export class AdminSocketController {
  /* ... */
}
```

The guard reads `Authorization: Api-Key <secret>` (REST) or `socket.handshake.auth.token` / the `Authorization` handshake header (socket), validates via `ApiKeyRepository`, and assigns the lookup result to `Auth`.

`ApiKeyRepository` is a base class with no storage — register an implementation yourself: `container.registerType(ApiKeyRepository, PgApiKeyRepository)` (table `wabot.api_key`), or `RemoteApiKeyRepository` to delegate validation to an external service:

```typescript
import { container, ApiKeyRepository, RemoteApiKeyRepository } from '@wabot-dev/framework'

container.registerType(ApiKeyRepository, RemoteApiKeyRepository)
```

Set `WABOT_API_KEY` and `WABOT_LLM_URL` to point `RemoteApiKeyRepository` at your auth service (it expects the same shape as the Wabot platform).

## Rules

- Always type `Auth<D>` with your session shape. `auth.require()` returns the typed value.
- A guard runs once per request/connection. Don't reassign manually — use `override(...)` only on token refresh.
- `@jwtGuard()` and `@apiKeyGuard()` work on REST endpoints; their `*HandshakeGuard()` variants work on socket controllers. Don't mix them up.
- Never log `auth.require()` results — they may contain PII or token claims. Use a redacted view.
- If you need a custom guard, implement `IMiddleware` (REST) or `IHandshakeMiddleware` (socket) and wire it with `@middleware(...)` / `@handshakeMiddlewares([...])`.

## Testing

From `@wabot-dev/framework/testing`: `RestHarness` with `jwt: true` registers a test `JwtConfig` so the real `@jwtGuard` works without env secrets (`harness.as(authInfo)` signs per-request tokens; `harness.jwt.signInvalid()` for 401 tests). `TestApiKeyRepository` is an in-RAM `ApiKeyRepository` for `@apiKeyGuard` (`register: [[ApiKeyRepository, repo]]`, `repo.addKey(authInfo)`). Harnesses also accept `authInfo` to populate the container-scoped `Auth` directly. See the `wabot-testing` skill.
