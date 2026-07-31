import alias from '@rollup/plugin-alias'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import tsc from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'
import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Plugin, RollupOptions } from 'rollup'

// Resolve the `@` / `@/*` tsconfig path alias to real files. The JS builds get
// this from @rollup/plugin-typescript (tsconfig paths); rollup-plugin-dts needs
// it spelled out so the emitted `.d.ts` inline internal types instead of leaking
// unresolved `@/...` imports.
const srcDir = fileURLToPath(new URL('./src', import.meta.url))
const dtsAlias = alias({ entries: [{ find: '@', replacement: srcDir }] })

// `css-modules.d.ts` is a pure ambient declaration file (no imports/exports), so
// rollup-plugin-dts has nothing to bundle from it. Copy it verbatim into dist so
// the package's `./ui/css` types entry resolves for consumers.
const copyCssTypes = (): Plugin => ({
  name: 'copy-css-module-types',
  async writeBundle() {
    const outDir = new URL('./dist/src/ui/', import.meta.url)
    await mkdir(fileURLToPath(outDir), { recursive: true })
    await copyFile(
      fileURLToPath(new URL('./src/ui/css-modules.d.ts', import.meta.url)),
      fileURLToPath(new URL('css-modules.d.ts', outDir)),
    )
  },
})

const sharedExternal = [
  // Node built-ins are always external (they can't be bundled). Declaring them
  // silences "Unresolved dependencies" — notably in the dts build, which has no
  // node-resolve plugin, when a builtin type leaks into a public signature
  // (e.g. http.Server, AsyncLocalStorage).
  /^node:/,
  'class-transformer',
  'class-validator',
  'tslib',
  'reflect-metadata',
  'express',
  'tsyringe',
  'uuid',
  'openai',
  'grammy',
  'dotenv',
  'sqlite',
  'sqlite3',
  'pg',
  'short-uuid',
  'socket.io',
  'body-parser',
  'socket.io-client',
  'debug',
  'html-to-text',
  '@anthropic-ai/sdk',
  'jsonwebtoken',
  '@google/genai',
  'big.js',
  '@openrouter/sdk',
  'preact',
  'preact/hooks',
  'preact/jsx-runtime',
  'preact/jsx-dev-runtime',
  'preact-render-to-string',
  '@preact/signals',
  'esbuild',
  '@hubspot/api-client',
  '@slack/bolt',
]

const libConfig: RollupOptions = {
  input: [
    'src/index.ts',
    'src/testing/index.ts',
    'src/ui/index.ts',
    'src/ui/client.ts',
    'src/ui/jsx-runtime.ts',
    'src/ui/jsx-dev-runtime.ts',
    'src/addon/ui/preact/preactClientRuntime.ts',
    // Referenced by a runtime path (not a static import) when the bundler
    // generates the nav entry, so it needs to be an explicit input to be emitted.
    'src/feature/ui-controller/bundler/navRuntime.ts',
    // CSS module SSR loader: the `--import` entry and its hooks module (the hooks
    // are referenced by a runtime `register()` string, so an explicit input).
    'src/ui/cssModuleLoader.ts',
    'src/ui/cssModuleHooks.ts',
    // CSS module registry (public `./ui/css-runtime`, imported by generated CSS
    // modules) and the shared compile transform.
    'src/ui/cssRegistry.ts',
    'src/ui/cssModuleCompile.ts',
  ],
  plugins: [
    tsc(),
    alias(),
    commonjs(),
    nodeResolve({
      preferBuiltins: true,
    }),
    json(),
  ],
  external: sharedExternal,
  output: {
    dir: 'dist/src',
    format: 'es',
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  onwarn: function (warning, handler) {
    if (warning.code === 'THIS_IS_UNDEFINED') {
      return
    }
    handler(warning)
  },
}

const buildScriptConfig: RollupOptions = {
  input: 'src/build/build.ts',
  plugins: [
    tsc({ declaration: false, declarationMap: false }),
    alias(),
    commonjs(),
    nodeResolve({ preferBuiltins: true }),
    json(),
  ],
  external: [...sharedExternal, 'tsup'],
  output: {
    file: 'dist/build/build.js',
    format: 'es',
    inlineDynamicImports: true,
  },
  onwarn: function (warning, handler) {
    if (warning.code === 'THIS_IS_UNDEFINED') {
      return
    }
    handler(warning)
  },
}

// The prod build script (dist/build/build.js) is a single inlined bundle, so the
// `new URL('./preactClientRuntime' | './navRuntime', import.meta.url)` island
// client-entry paths baked into it resolve next to build.js — i.e. dist/build/.
// Emit standalone copies there so esbuild can bundle them into island client
// code during `npm run build` of a consumer project. (dist/src copies from
// libConfig serve the dev path, which resolves relative to dist/src modules.)
const buildRuntimesConfig: RollupOptions = {
  input: {
    preactClientRuntime: 'src/addon/ui/preact/preactClientRuntime.ts',
    navRuntime: 'src/feature/ui-controller/bundler/navRuntime.ts',
  },
  plugins: [
    tsc({ declaration: false, declarationMap: false }),
    alias(),
    commonjs(),
    nodeResolve({ preferBuiltins: true }),
    json(),
  ],
  external: sharedExternal,
  output: {
    dir: 'dist/build',
    format: 'es',
    entryFileNames: '[name].js',
  },
  onwarn: function (warning, handler) {
    if (warning.code === 'THIS_IS_UNDEFINED') {
      return
    }
    handler(warning)
  },
}

// Bundled `.d.ts` for each public entry (replaces `tsup --dts-only`). Emitted
// alongside the JS into dist/src so the package's `exports` types fields resolve.
const dtsConfig: RollupOptions = {
  input: {
    index: 'src/index.ts',
    'testing/index': 'src/testing/index.ts',
    'ui/index': 'src/ui/index.ts',
    'ui/jsx-runtime': 'src/ui/jsx-runtime.ts',
    'ui/jsx-dev-runtime': 'src/ui/jsx-dev-runtime.ts',
    // Public as `@wabot-dev/framework/ui/css-runtime`, and imported by the
    // modules the CSS loader generates, so it needs its own declarations.
    'ui/cssRegistry': 'src/ui/cssRegistry.ts',
  },
  output: {
    dir: 'dist/src',
    format: 'es',
    entryFileNames: '[name].d.ts',
    chunkFileNames: '_dts/[name]-[hash].d.ts',
  },
  external: sharedExternal,
  plugins: [dtsAlias, dts({ respectExternal: false }), copyCssTypes()],
}

export default [libConfig, buildScriptConfig, buildRuntimesConfig, dtsConfig]
