---
name: wabot-ui
description: Use when building server-rendered web pages, forms, or interactive UI from a Wabot app. Covers @uiController, @view, @action, @uiMiddleware, the one validated-DTO handler arg, redirect(), islands (island() in *.island.tsx, callAction/actionUrl), signals vs hooks, boosted navigation (app: true) with layout/<Outlet/> and swr, static generation (SSG) via @view({ static }) + StaticPageCache, head resource hints, CSS modules, the tsconfig JSX setup, and custom UiRenderer. Argument validation is shared with wabot-validation.
---

# UI controllers

Wabot's UI layer server-renders Preact and ships JavaScript only for the interactive parts ("islands"). You write `@uiController` classes with `@view` (GET → HTML) and `@action` (POST → JSON) methods; the runner discovers them from `src/`, SSRs each view inside a default HTML document, and — in dev/prod — bundles islands for client hydration. Everything works without JS; islands are a progressive enhancement.

Everything ships from `@wabot-dev/framework/ui`. Never import from internal paths.

## Setup

Importing `@wabot-dev/framework/ui` registers the Preact renderer as a side effect. Configure JSX in `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@wabot-dev/framework/ui",
  },
}
```

No manual registration: `run(config)` discovers `@uiController` classes, loads the Preact renderer, and sets up the island bundler automatically. `config.ui.bundlerAlias` is only needed when islands import the framework UI through a non-package specifier (path alias in a monorepo/in-repo dev) — regular consumers never set it.

## Controller

```tsx
import { isNotEmpty, isString } from '@wabot-dev/framework'
import { uiController, view, action, redirect } from '@wabot-dev/framework/ui'
import { HomePage } from './ui/pages/HomePage'
import { addMessage, messages } from './ui/store'

class AddMessageDto {
  @isString()
  @isNotEmpty()
  text?: string
}

@uiController('/board')
export class BoardController {
  // GET /board  — empty/omitted path is the controller index.
  @view({ title: 'Message board' })
  index() {
    return <HomePage messages={messages} />
  }

  // GET /board/archive
  @view({ path: 'archive', title: 'Archive' })
  archive() {
    return <HomePage messages={messages} archived />
  }

  // POST /board/_action/add  — path defaults to the method name.
  @action()
  add(input: AddMessageDto) {
    addMessage(input.text!)
    return redirect('/board') // post/redirect/get for no-JS forms
  }

  // POST /board/_action/postMessage — returns JSON for callAction() from an island.
  @action()
  postMessage(input: AddMessageDto) {
    addMessage(input.text!)
    return { messages }
  }
}
```

- **`@uiController(path | { path, middlewares?, app?, layout?, head? })`** — `path` is the base every view/action mounts under.
- **`@view(subpath | { path?, title?, meta?, static?, swr? })`** → `GET <controllerPath>/<path>`. Returns a JSX node (SSR'd) or `redirect(...)`. `title`/`meta` fill the document `<head>`. `static` serves the route as a cached statically generated page (see below).
- **`@action(subpath | { path? })`** → `POST <controllerPath>/_action/<path>` (path defaults to the method name). Returns a JSON-serializable value (circular refs stripped) or `redirect(...)`.
- **Handler args:** at most **one** parameter — a class the framework validates exactly like a rest-controller request DTO (see `wabot-validation`). The request object is `body`, `query`, and route `params` merged. Omit the parameter for handlers that need no input.
- **`redirect(location, status = 302)`** — return it from a view or action to send an HTTP redirect instead of rendering.

## Middlewares / guards

Same `IMiddleware` contract as REST (see `wabot-rest-socket` / `wabot-auth`).

```tsx
import { injectable, type IMiddleware } from '@wabot-dev/framework'
import { uiController, uiMiddleware } from '@wabot-dev/framework/ui'

@injectable()
class RequireAuth implements IMiddleware {
  async handle(req: unknown, res: unknown) {
    /* throw or write a response to block */
  }
}

@uiController({ path: '/admin', middlewares: [RequireAuth] }) // whole controller
export class AdminController {
  @uiMiddleware(RequireAuth) // …or a single view/action
  @view()
  index() {
    return <Dashboard />
  }
}
```

Middlewares run before the handler; if one sends a response, the handler is skipped.

## Islands (client interactivity)

Only islands ship JS and hydrate; the rest of the page is static SSR HTML. An island **must** be the default export of a `*.island.tsx` file so the bundler can give it a stable id.

```tsx
// Counter.island.tsx
import { island, useSignal } from '@wabot-dev/framework/ui'

function Counter({ start = 0 }: { start?: number }) {
  const count = useSignal(start)
  return <button onClick={() => count.value++}>{count}</button>
}

export default island(Counter)
```

Render an island like any component from a view or another component: `<Counter start={3} />`. Props must be JSON-serializable (they are sent to the client for hydration). Islands may use **signals** (`signal`, `useSignal`, `useComputed`, `useSignalEffect`) or **hooks** (`useState`, `useEffect`, `useRef`, …) — both re-exported from `@wabot-dev/framework/ui`.

### Calling actions from an island

```tsx
// MessageBoard.island.tsx
import { island, useSignal, callAction, actionUrl } from '@wabot-dev/framework/ui'

const POST_URL = actionUrl('/board', 'postMessage') // -> /board/_action/postMessage

function MessageBoard({ initial = [] }) {
  const messages = useSignal(initial)
  async function send(text: string) {
    const res = await callAction<{ messages: any[] }>(POST_URL, { text })
    messages.value = res.messages
  }
  // …form that calls send()…
}

export default island(MessageBoard)
```

- **`actionUrl(controllerPath, actionName)`** builds the action URL.
- **`callAction<T>(url, data?, { headers?, signal? })`** POSTs JSON and returns the parsed result; it throws on non-2xx with the server-provided error message.
- Both are client-safe (no Node imports) so they bundle into islands. A plain `<form method="post" action="/board/_action/add">` also works for no-JS progressive enhancement.

## App shell & boosted navigation

`app: true` opts a controller into client-side ("boosted") navigation between its own views: in-scope links are swapped in without a full reload, backed by a stale-while-revalidate cache. Views still SSR and work without JS.

```tsx
import { uiController, view, Outlet } from '@wabot-dev/framework/ui'

function AppLayout() {
  return (
    <div class="app">
      <nav>{/* … */}</nav>
      <main>
        <Outlet />
      </main>
      {/* current view renders here */}
    </div>
  )
}

@uiController({ path: '/panel', app: true, layout: AppLayout })
export class PanelController {
  @view({ path: '', title: 'Home', swr: { maxAge: 30 } })
  home() {
    return <HomeView />
  }

  @view({ path: ':id', title: 'Detail', swr: { version: ({ id }) => revisionOf(id) } })
  detail(input: DetailParams) {
    return <DetailView id={input.id} />
  }
}
```

- **`layout: Component`** — a persistent shell rendered once around every view; it renders `<Outlet/>` where the current view goes. During boosted nav only the outlet swaps, so the shell and its islands keep their state. Full loads render inside the layout; boosted-nav fragments render just the view.
- **`swr: { maxAge?, version? }`** on `@view` tunes the boosted-nav cache. `maxAge` (seconds) serves a revisit from cache without revalidating. `version(request)` returns a short deterministic string; boosted-nav revalidation answers `304` from it _without running the handler or SSR_. Parameterized `app` views should declare `swr.version` keyed off their route params.
- **`head: { stylesheets?, preconnect?, preload? }`** on `@uiController` emits `<link rel="stylesheet">` for each URL (see [Styling](#styling)) and `<link rel="preconnect|preload">` hints on full loads (the natural home for app-wide fonts — the head persists across boosted nav).

## Static generation (SSG)

Mark a **public, stateless** view `static` to render it once and serve the cached HTML for every request — no per-request handler or SSR. Islands in a static page still hydrate and run on the client.

```tsx
@uiController({ path: '/' })
export class LandingController {
  @view({ title: 'Home', static: { revalidate: 300 } })
  async index() {
    return <Landing services={await this.catalog.list()} />
  }
}
```

- **`static: true`** — generated once (non-parameterized routes are pre-rendered at startup) and kept until restart.
- **`static: { revalidate: N }`** — ISR: serve the cached page; once older than `N` seconds the next request gets it _while a fresh copy regenerates in the background_ (stale-while-revalidate).
- Parameterized routes (`/x/:id`) are generated lazily on first request and cached per URL.
- Responses carry a strong `ETag` (→ `304` on `If-None-Match`) and a `Cache-Control` matching `revalidate`.
- **Middleware/guards are skipped** for a static view (the cached document is shared across all visitors) — never mark an authenticated route static.
- Invalidate on demand by injecting **`StaticPageCache`**: `this.pages.invalidate('/x/42')` (or `invalidateAll()`) after the underlying data changes; the next request re-renders. `await pages.ready()` resolves once the startup pre-render settles (handy when data is seeded _after_ boot — then `invalidate(path)`).

## Styling

CSS modules are supported in islands and components:

```tsx
import styles from './styles.module.css'
export default island(() => <div class={styles.box}>styled</div>)
```

A **plain** (non-module) stylesheet imports as the URL it is served at, which is what `head.stylesheets` takes — the way to pull in a design system once, cached, instead of inlining it into every document:

```tsx
import reset from '@acme/ui/reset.css'
import tokens from '@acme/ui/tokens.css'

@uiController('/dash', { head: { stylesheets: [reset, tokens] } })
export class DashboardController {}
```

The URL carries a hash of the file's contents (`/_wabot/css/<hash>.css`) and is served with a long immutable cache, so a changed stylesheet gets a new URL. Order matters: controller stylesheets are emitted before the CSS-module styles of the page.

Inline `<style dangerouslySetInnerHTML={{ __html: css }} />` works too (as in a layout that injects a design-system stylesheet once).

## Advanced

- **`renderDocument(options)`** produces the default HTML shell (`bodyHtml`, `title`, `meta`, `styles`, `links`, `scripts`, `headHtml`, `bodyEndHtml`, `lang`). The runner calls it for you; use it directly only for a custom document.
- **Custom renderer:** implement the `UiRenderer` interface and register it with `UiRendererRegistry.setDefault(myRenderer)` instead of importing the Preact entry. The default id is `"preact"`.

## Hard rules

- Import everything from `@wabot-dev/framework/ui` (server decorators + client helpers + Preact/signals re-exports). Never import from `preact` / `@preact/signals` directly, and never from framework internal paths.
- Islands live in `*.island.tsx` files and are the file's default export via `island()`. A component used interactively but not wrapped this way will render but never hydrate.
- View/action handlers take at most one parameter, and it is a validated class — not raw `req`/`res`.
- `@preact/signals`' `action` is re-exported as **`signalAction`** to avoid clashing with the `@action` controller decorator.

## Testing

`createUiHarness({ controllers, register? })` from `@wabot-dev/framework/testing` mounts `@uiController` classes on a private ephemeral-port server and exercises the real pipeline (middlewares/guards, validation, SSR, actions). `harness.get(path)` returns the rendered HTML document; `harness.action(path, body?)` POSTs to an action route and `res.json()` parses the reply. Islands render as static SSR HTML — no client bundling needed. See the `wabot-testing` skill.
