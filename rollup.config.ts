import alias from '@rollup/plugin-alias'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import tsc from '@rollup/plugin-typescript'
import type { RollupOptions } from 'rollup'

const sharedExternal = [
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

export default [libConfig, buildScriptConfig]
