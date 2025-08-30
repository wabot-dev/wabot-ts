import alias from '@rollup/plugin-alias'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import tsc from '@rollup/plugin-typescript'
import type { RollupOptions } from 'rollup'

const config: RollupOptions = {
  input: 'src/index.ts',
  plugins: [
    tsc(),
    alias(),
    commonjs(),
    nodeResolve({
      preferBuiltins: true,
    }),
    json(),
  ],
  external: [
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
    'body-parser',
    'debug',
    'html-to-text',
    '@anthropic-ai/sdk',
    'jsonwebtoken',
    '@google/genai'
  ],
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
export default config
