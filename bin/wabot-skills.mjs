#!/usr/bin/env node

// wabot-skills — install / resync the packaged Wabot agent skills that ship with
// the installed @wabot-dev/framework version.
//
//   wabot-skills list
//   wabot-skills sync   [--agents claude,codex,agents] [--project <dir>]
//   wabot-skills add <skill> [--agents claude,codex,agents] [--home <dir>]
//
// `sync` refreshes the project's skills to match the currently installed framework
// version (overwrites in place). Run it after upgrading @wabot-dev/framework.

import fss from 'fs'
import path from 'path'

import {
  installSkillGlobally,
  installSkillsInProject,
  listSkillNames,
  listSupportedAgents,
} from './skills.mjs'

function parseFlags(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      positional.push(arg)
    }
  }
  return { flags, positional }
}

function parseAgents(value) {
  if (!value || value === true) return listSupportedAgents()
  return String(value)
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
}

function usage() {
  console.log(`wabot-skills — manage packaged Wabot agent skills

Usage:
  wabot-skills list
  wabot-skills sync [--agents claude,codex,agents] [--project <dir>]
  wabot-skills add <skill> [--agents claude,codex,agents] [--home <dir>]

sync refreshes existing project skills to the installed framework version.`)
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const { flags, positional } = parseFlags(rest)

  if (!command || command === 'help' || flags.help) {
    usage()
    return
  }

  if (command === 'list') {
    for (const name of listSkillNames()) console.log(name)
    return
  }

  if (command === 'sync') {
    const projectDir = path.resolve(flags.project || process.cwd())
    // Default to the agent dirs that already exist in the project; fall back to claude.
    let agents = flags.agents
      ? parseAgents(flags.agents)
      : listSupportedAgents().filter((agent) =>
          fss.existsSync(path.join(projectDir, `.${agent}`, 'skills')),
        )
    if (agents.length === 0) agents = ['claude']

    const result = await installSkillsInProject(projectDir, agents, undefined, { overwrite: true })
    const byAgent = new Map()
    for (const item of result.installations) {
      byAgent.set(item.agent, (byAgent.get(item.agent) ?? 0) + 1)
    }
    for (const [agent, count] of byAgent) {
      console.log(`✓ synced ${count} skills into .${agent}/skills`)
    }
    return
  }

  if (command === 'add') {
    const skillName = positional[0]
    if (!skillName) {
      console.error('Error: `wabot-skills add` requires a skill name')
      process.exit(1)
    }
    const agents = parseAgents(flags.agents)
    const result = await installSkillGlobally(skillName, agents, flags.home || undefined)
    for (const item of result.installations) {
      console.log(`✓ installed ${result.skill} -> ${item.installDir}`)
    }
    return
  }

  console.error(`Error: unknown command "${command}"`)
  usage()
  process.exit(1)
}

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
