# Modifying `@yucacodes/ts` to support `.tsx` / `.jsx` (required for the UI feature)

The Wabot dev/test loader (`node --import @yucacodes/ts`) is the only execution
path that emits **`emitDecoratorMetadata`** (`design:paramtypes`), which the
framework's dependency injection relies on. esbuild/tsup cannot emit decorator
metadata, so the loader must stay TypeScript-compiler based.

`@yucacodes/ts@0.0.8` currently:

1. forces `jsx: undefined`, so JSX is never transpiled;
2. only **resolves** `.ts` (and `index.ts`) — not `.tsx` / `.jsx`;
3. only **loads/transpiles** files ending in `.ts`.

The three edits below make it run `.tsx` / `.jsx` controllers and islands with
JSX **and** decorator metadata intact. Apply them in the `@yucacodes/ts` repo
(`src/custom-import-hooks.mjs`), bump its version, publish, and update the
framework peer dep range.

> After patching, consumer projects set their `tsconfig.json` to:
> `"jsx": "react-jsx"`, `"jsxImportSource": "@wabot-dev/framework/ui"`.
> The loader reads these from tsconfig (via `userOptions`) and passes them to the
> TypeScript transpiler, which emits
> `import { jsx } from "@wabot-dev/framework/ui/jsx-runtime"`.

---

## Edit 1 — honor tsconfig JSX (stop forcing `jsx: undefined`)

In the `compilerOptions` object, replace the final `jsx: undefined,` line:

```js
const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2015,
  esModuleInterop: true,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  allowJs: true,
  resolveJsonModule: true,
  allowSyntheticDefaultImports: true,
  ...userOptions,
  sourceMap: true,
  // was: jsx: undefined,
  jsx: userOptions.jsx ?? ts.JsxEmit.ReactJSX,
  jsxImportSource: userOptions.jsxImportSource,
  jsxFactory: userOptions.jsxFactory,
  jsxFragmentFactory: userOptions.jsxFragmentFactory,
}
```

`...userOptions` already spreads these from tsconfig; the explicit lines just
guarantee the forced `undefined` is gone and provide an automatic-runtime
default when a project doesn't set `jsx`.

## Edit 2 — resolve `.tsx` / `.jsx` (and index variants)

Replace the extension-probing part of `resolveTs` (the block that tries
`specifierPath + '.ts'` then `index.ts`) with a candidate list:

```js
const RESOLVE_EXTS = ['.ts', '.tsx', '.jsx', '.mts', '.cts']
const INDEX_FILES = ['index.ts', 'index.tsx', 'index.jsx']

// ...inside resolveTs, after computing `specifierPath` and the
// `jsExtensions` early-return:

// 1) Specifier already has a resolvable TS/JS extension and exists.
if (RESOLVE_EXTS.includes(path.extname(specifierPath)) && fs.existsSync(specifierPath)) {
  const result = pathToFileURL(specifierPath).toString()
  resolveTsCache.set(cacheKey, result)
  return result
}

// 2) Try appending each candidate extension.
for (const ext of RESOLVE_EXTS) {
  const candidate = specifierPath + ext
  if (fs.existsSync(candidate)) {
    const result = pathToFileURL(candidate).toString()
    resolveTsCache.set(cacheKey, result)
    return result
  }
}

// 3) Directory import -> index file.
try {
  if (fs.statSync(specifierPath).isDirectory()) {
    for (const indexFile of INDEX_FILES) {
      const indexPath = path.join(specifierPath, indexFile)
      if (fs.existsSync(indexPath)) {
        const result = pathToFileURL(indexPath).toString()
        resolveTsCache.set(cacheKey, result)
        return result
      }
    }
  }
} catch {
  // path doesn't exist; fall through
}

resolveTsCache.set(cacheKey, null)
return null
```

Keep the existing `jsExtensions` (`js`/`cjs`/`mjs`) early-return so already-JS
specifiers are handed to Node's default resolver.

## Edit 3 — transpile `.tsx` / `.jsx` in `load()`

Change the load guard from a `.ts`-only check to the TS/JSX family, and base the
loaded-path check on the same set:

```js
const TS_LOAD_RE = /\.(ts|tsx|jsx|mts|cts)$/

export async function load(url, context, nextLoad) {
  if (url.startsWith('file://') && TS_LOAD_RE.test(url)) {
    const urlPath = fileURLToPath(url)
    // ...unchanged: stat + cache + ts.transpileModule(tsSource, tsConfig) + sourcemap
  }
  return nextLoad(url)
}
```

`ts.transpileModule` already receives the JSX-enabled `compilerOptions` from
Edit 1, so `.tsx`/`.jsx` compile to the automatic JSX runtime with decorator
metadata preserved. No other changes are needed.

---

## Verifying the patch

From a consumer project (or this framework's `test/` example) with a `.tsx`
controller + a `*.island.tsx`:

```bash
node --import @yucacodes/ts ./src/_run_.ts
# GET the view -> server-rendered HTML; DI + decorator metadata work.
```

If you see `SyntaxError: Unexpected token '<'`, Edit 1 didn't take effect.
If you see `Cannot find module './Counter.island'`, Edit 2 didn't take effect.
