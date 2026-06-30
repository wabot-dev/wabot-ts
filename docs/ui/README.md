# `@wabot-dev/framework/ui` — full-stack UI controllers

Build server-rendered pages with interactive client **islands**, using the same
decorator + DI model as the rest of the framework. Rendering is powered by
**Preact + @preact/signals** by default, behind a pluggable renderer so other
view libraries can be adapted.

- Server-rendered pages from `@uiController` / `@view` (async, DI-injected).
- Interactive **islands** — only components wrapped with `island()` ship JS and
  hydrate; everything else is static HTML (0 JS).
- **Server actions** (`@action`) callable from `<form>` (progressive
  enhancement) or from islands via `callAction()`.
- Head/meta + auth guards (reuse existing `IMiddleware`).
- CSS and CSS Modules.
- Integrated dev server with auto-bundling and live reload; `wabot build` emits
  hashed client bundles + a manifest for production.

## Setup

1. **Install peers**: `preact`, `preact-render-to-string`, `@preact/signals`,
   `esbuild` (and the dev loader `@yucacodes/ts` **>= 0.1.0**, which adds the
   `.tsx`/JSX support this feature needs — see
   [yucacodes-ts-jsx-support.md](./yucacodes-ts-jsx-support.md)).

2. **tsconfig.json**:

   ```jsonc
   {
     "compilerOptions": {
       "experimentalDecorators": true,
       "emitDecoratorMetadata": true,
       "moduleResolution": "Bundler",
       "jsx": "react-jsx",
       "jsxImportSource": "@wabot-dev/framework/ui",
       "types": ["@wabot-dev/framework/ui/css"], // for *.css / *.module.css imports
     },
   }
   ```

3. **Run** (dev): `node --import @yucacodes/ts ./src/_run_.ts` where `_run_.ts`
   calls `run()`. **Build** (prod): `wabot build` (runs `runBuild()`), then run
   the bundled server.

## Controllers, views and actions

```tsx
// src/TodoController.tsx
import { isNotEmpty, isString } from '@wabot-dev/framework'
import { uiController, view, action, redirect } from '@wabot-dev/framework/ui'
import { TodoService } from './TodoService'
import Counter from './Counter.island'

// Action/view params are validated DTOs, exactly like rest-controller models.
class AddTodoDto {
  @isString()
  @isNotEmpty()
  title?: string
}

@uiController('/todos')
class TodoController {
  constructor(private todos: TodoService) {} // DI, like rest controllers

  @view({ title: 'Todos' })
  async index() {
    const items = await this.todos.all()
    return (
      <main>
        <h1>Todos ({items.length})</h1>
        <ul>
          {items.map((t) => (
            <li key={t.id}>{t.title}</li>
          ))}
        </ul>
        <Counter start={items.length} />
      </main>
    )
  }

  @view('archived')
  async archived() {
    return <ArchivedList items={await this.todos.archived()} />
  }

  @action()
  async add(input: AddTodoDto) {
    await this.todos.add(input)
    return redirect('/todos') // post/redirect/get
  }
}
```

- `@view()` → the controller's index route (`/todos`); `@view('archived')` →
  `/todos/archived`.
- `@action()` → `POST /todos/_action/add`. Return a `redirect()` for forms, or
  plain data (JSON) for island `callAction` calls.
- A single optional method parameter is validated with the framework's
  validation decorators (same as rest controllers).

## Islands (interactivity)

Interactive components live in `*.island.tsx` and are wrapped with `island()`:

```tsx
// src/Counter.island.tsx
import { island, signal } from '@wabot-dev/framework/ui'

function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start)
  return <button onClick={() => count.value++}>Count: {count}</button>
}

export default island(Counter)
```

The server renders the island to HTML; the client ships only that island's
bundle and hydrates it. Props passed to an island are serialized for hydration,
so keep them JSON-serializable. `useState` and the other Preact hooks are also
re-exported from `@wabot-dev/framework/ui` if you prefer hooks over signals.

## Server actions from islands

```tsx
import { island, signal, actionUrl, callAction } from '@wabot-dev/framework/ui'

function AddTodo() {
  const title = signal('')
  async function submit() {
    await callAction(actionUrl('/todos', 'add'), { title: title.value })
    location.reload()
  }
  return (
    <div>
      <input onInput={(e) => (title.value = e.currentTarget.value)} />
      <button onClick={submit}>Add</button>
    </div>
  )
}
export default island(AddTodo)
```

Without JS, a plain `<form method="post" action="/todos/_action/add">` posts to
the same endpoint and the `redirect()` completes the flow.

## Styling

Import CSS from islands (bundled and injected as `<link>` for pages that use the
island):

```tsx
import styles from './counter.module.css' // locally-scoped class map
import './global.css' // global stylesheet
```

## Auth / guards

Reuse any `IMiddleware` (e.g. the JWT / API-key guards) on UI routes:

```tsx
@uiController({ path: '/admin', middlewares: [JwtGuardMiddleware] })
class AdminController {
  /* ... */
}
```

Use `@uiMiddleware(Guard)` to protect a single view/action. A guard that calls
`res.redirect(...)` short-circuits the request (send users to a login page).

## Testing

```ts
import { createUiHarness } from '@wabot-dev/framework/testing'
import { actionUrl } from '@wabot-dev/framework/ui'

const ui = await createUiHarness({ controllers: [TodoController] })
const page = await ui.get('/todos')
// page.text contains the SSR HTML
const res = await ui.action(actionUrl('/todos', 'add'), { title: 'Buy milk' })
await ui.close()
```

## Using another renderer

Preact is the default. To use a different library, implement `UiRenderer`
(`renderToString` + a `client` config for bundling/hydration) and register it:

```ts
import { container } from '@wabot-dev/framework'
import { UiRendererRegistry } from '@wabot-dev/framework/ui'

container.resolve(UiRendererRegistry).setDefault(new MyRenderer())
```

Point `jsxImportSource` at that library's JSX runtime in your tsconfig.
