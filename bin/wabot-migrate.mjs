#!/usr/bin/env node

// wabot-migrate — apply plain-SQL database migrations for a Wabot project.
//
//   wabot-migrate up                 apply pending migrations (default)
//   wabot-migrate status             show applied / pending / drifted
//   wabot-migrate create <name>      scaffold a new migration file
//
// Reads DATABASE_URL from the environment and migrations from ./migrations.
// Migrations are never applied automatically at boot — this CLI is the only path.

import { runMigrationCli } from '../dist/src/index.js'

runMigrationCli(process.argv.slice(2))
  .then((code) => process.exit(code ?? 0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
