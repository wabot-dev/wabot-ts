---
name: wabot-validation
description: Use when defining request DTOs, mindset module argument classes, or any class that must be validated and transformed by Wabot — including REST/socket inputs and tool function parameters. Covers the validator decorators (@isString, @isNumber, @isBoolean, @isDate, @isIn, @isNotEmpty, @isPresent, @isRecord, @isOptional, @isModel, @isArray, @min, @max), @description, validateAndTransform, and Mapper.
---

# Validation, description, mapping

Wabot validates request shapes through decorator-driven metadata. The same metadata feeds:

- REST endpoint argument binding (`@onPost`, etc.).
- Socket event payloads (`@onSocketEvent`).
- Mindset tool function parameters (the LLM sees the validator type and the `@description`).
- `Async.runCommand` / `Async.scheduleCommand` payloads (validated against the `@command` class).

## Field validators

All decorators are exported from `@wabot-dev/framework`. Apply them to public class fields.

| Decorator | Effect |
| --- | --- |
| `@isString()` | Value must be `string` |
| `@isNumber()` | Value must be `number` |
| `@isBoolean()` | Value must be `boolean` |
| `@isDate()` | Value must parse as `Date` (ISO 8601 input) |
| `@isIn([...values])` | Value must be one of the listed literals |
| `@isNotEmpty()` | String must be non-empty after trim |
| `@isPresent()` | Field must be present (not `undefined`) |
| `@isRecord(keyType, valueType)` | Plain object with typed keys/values; `keyType: 'number' \| 'string'`, `valueType: 'number' \| 'string' \| 'boolean'` |
| `@isOptional()` | Skip remaining validators when the value is null/undefined |
| `@isModel(OtherClass)` | Nested model validated against `OtherClass` |
| `@isArray({ minLength?, maxLength? })` | Field must be an array |
| `@min(n)` | Numeric / length minimum |
| `@max(n)` | Numeric / length maximum |

Validators chain top-to-bottom. Put `@isOptional()` **above** the type validator if the field is optional.

```typescript
import { description, isIn, isNotEmpty, isNumber, isOptional, isString, max, min } from '@wabot-dev/framework'

export class ListGamesRequest {
  @isString()
  @isIn(['backlog', 'playing', 'finished', 'abandoned'])
  @description('Filter by status')
  status: 'backlog' | 'playing' | 'finished' | 'abandoned' = 'backlog'

  @isNumber()
  @min(1)
  @max(20)
  @description('Maximum number of games to return')
  limit: number = 5

  @isOptional()
  @isString()
  cursor?: string
}
```

The `default` value on the field becomes the value when the input is missing and the field is optional.

## `@description`

`@description('...')` annotates a field or method. Two roles:

1. On a request-class field: it becomes the LLM-facing parameter description for mindset tool functions.
2. On a `@tools()` (formerly `@mindsetModule()`) method: it becomes the tool's description (without it the function is not exposed as a tool).

Mindset module functions **must** have a single request-object parameter (or no parameter), and every property of that request class must have both a type validator (e.g. `@isString()`) and a `@description(...)`. The framework throws at boot otherwise.

## `validateAndTransform`

```typescript
import { validateAndTransform } from '@wabot-dev/framework'

const { value, error } = validateAndTransform(rawInput, ListGamesRequest)
if (error) {
  // error.description + error.properties (per-field errors)
}
```

Use this when you receive a payload outside a framework-managed boundary (e.g. a manually parsed file or queue message). Inside a REST/socket controller or a command handler the framework already validates the parameter for you.

## `Mapper`

`Mapper` is an injectable utility that combines deep-copy + `validateAndTransform`. It is useful when you need to convert a database row, a remote response, or a Storable into a typed model and you want a hard failure on shape mismatch (it throws `CustomError` with `httpCode: 500`).

```typescript
import { container, Mapper } from '@wabot-dev/framework'

const mapper = container.resolve(Mapper)
const game: GameDto = mapper.map(rawRow, GameDto)
```

`Mapper.map(data, ctor)` will:

- Deep-copy `data` (Storables → plain objects, Dates → epoch ms).
- Run all validators on the target class.
- Return a typed instance, or throw.

## Rules

- Every public DTO/Request field needs at least one type validator. Without it, the framework can't introspect the type at runtime (TypeScript types are erased).
- Always pair `@description` with a type validator on mindset module request fields.
- Prefer field defaults over `@isOptional()` when you have a sensible default; reserve `@isOptional()` for fields that may genuinely be absent.
- Don't subclass `RestRequest` unless you want the raw Express `Request` injected into the endpoint — see `wabot-rest-socket`.

## Testing

`assertValid(Model, data)`, `assertInvalid(Model, data, { path? })` and `validateFixture(Model, data)` from `@wabot-dev/framework/testing` test decorated models directly, with issues flattened to `{ path: 'items[0].name', message }`. See the `wabot-testing` skill.
