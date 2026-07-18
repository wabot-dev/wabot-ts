---
name: wabot-di-config
description: Use when wiring services, choosing service lifecycles, reading env vars, or expressing typed config references for Wabot apps. Covers @injectable / @singleton / @scoped / @inject, the container, the Env service, and the config tag functions (str, num, bool, obj, strArr, numArr, boolArr) that drive resolveConfigReferences in channel and adapter decorators.
---

# DI, Env, and config references

Wabot uses `tsyringe` under the hood and re-exports the pieces you need from `@wabot-dev/framework`:

```typescript
import { container, injectable, singleton, scoped, Lifecycle, inject } from '@wabot-dev/framework'
```

## Lifecycles

| Decorator                            | When to use                                                                                    | Example                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------- |
| `@singleton()`                       | App-wide infra: clients, repositories, config holders, caches. One instance for the process.   | DB clients, adapters    |
| `@injectable()`                      | Stateless / per-resolution services. Each `resolve` returns a new instance.                    | Calculators, mappers    |
| `@scoped(Lifecycle.ContainerScoped)` | Per-request / per-chat / per-socket state. Lives in the child container created by the runner. | `Auth`, request context |

The framework already creates child containers for every chat message, REST request, and socket connection. `ContainerScoped` services do not leak across them.

```typescript
import { injectable, singleton, scoped, Lifecycle } from '@wabot-dev/framework'

@singleton()
export class ProductCache {
  private byId = new Map<string, string>()
  put(id: string, name: string) {
    this.byId.set(id, name)
  }
}

@injectable()
export class QuoteCalculator {
  total(base: number, discount: number) {
    return base - base * discount
  }
}

@scoped(Lifecycle.ContainerScoped)
export class RequestContext {
  private userId?: string
  setUserId(id: string) {
    this.userId = id
  }
  requireUserId() {
    if (!this.userId) throw new Error('Unauthorized')
    return this.userId
  }
}
```

Decorators that mark something as a controller/handler also apply `@injectable()` for you (`@chatController`, `@restController`, `@socketController`, `@commandHandler`, `@cronHandler`, `@mindset`, `@tools`/`@mindsetModule`, `@agent`). Do not stack lifecycle decorators on top of those — they will conflict.

## Resolving and registering

```typescript
import { container, inject, injectable } from '@wabot-dev/framework'

container.register('SMTP_HOST', { useValue: 'smtp.example.com' })
container.register('SMTP_PORT', { useValue: 587 })

@injectable()
export class Mailer {
  constructor(
    @inject('SMTP_HOST') private host: string,
    @inject('SMTP_PORT') private port: number,
  ) {}
}
```

You rarely need `container.register*` in app code — for chat/REST/socket components the runner does it. Use registration only for:

- Replacing a default infra binding (e.g. swap `Locker` for a custom implementation).
- Providing typed config values to classes you cannot decorate.
- Bootstrapping in tests.

`container.registerInstance(Token, value)` and `container.registerType(From, To)` are the two most common helpers.

## `Env`

```typescript
import { container, Env } from '@wabot-dev/framework'

const env = container.resolve(Env)

const dbUrl = env.requireString('DATABASE_URL')
const port = env.requireNumber('PORT', { default: 3000 })
const isDev = env.isDevelopment() // controlled by WABOT_ENV: 'development' | 'staging' | 'testing' | 'production'
```

`Env.requireString` / `requireNumber` throw if the variable is missing and no `default` is provided.

## Config tag functions

Some addon decorators (e.g. `@socket`, `@whatsApp`, `@wasender`) accept a config object whose fields may be `ConfigReference` values produced by tag functions. The reference is resolved by `resolveConfigReferences` (called inside the decorator) against `process.env`, with the path translated to UPPER_SNAKE_CASE.

```typescript
import { socket } from '@wabot-dev/framework' // tag fns also exported from the package root
import { str, num, bool, obj, strArr, numArr, boolArr } from '@wabot-dev/framework'

@socket({
  // Resolved from env: SOCKET_NAMESPACE; defaults to "chat" if env is missing.
  namespace: str`socket.namespace:chat`,
  maxConnections: num`socket.max:100`,
})
class MyController {
  /* ... */
}
```

Syntax: `<fn>\`path.with.dots:default\``. The default after the colon is optional. Only literal strings are allowed; interpolation throws.

Available factories: `str`, `num`, `bool`, `obj` (parses JSON), `strArr`, `numArr`, `boolArr` (comma-separated).

If you call `resolveConfigReferences(cfg)` yourself it returns a typed object where each `ConfigReference<T>` field is replaced by `T`.

## Rules

- Default to `@injectable()` for new code. Promote to `@singleton()` only when state must be shared.
- `@scoped(Lifecycle.ContainerScoped)` only when the value must not leak across requests, chats, or socket connections.
- Don't call `container.resolve(...)` inside a constructor — declare dependencies as constructor parameters and let DI inject them.
- Use `Env.requireString/requireNumber` for plain env reads; use config tag functions only inside decorator configs that the framework already resolves.
