// Canonical skills installer for @wabot-dev/framework.
//
// The packaged agent skills live at `<package>/skills/<name>/SKILL.md` and are
// versioned together with the framework API they document. This module is the
// single source of truth for enumerating and installing them; it is consumed by
// the `wabot-skills` bin and by @wabot-dev/create during project bootstrap.
//
// Dependency-free (node builtins only) so `npx wabot-skills` works with just the
// framework installed.

import fs from 'fs/promises'
import fss from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

export const SKILLS_DIR = fileURLToPath(new URL('../skills', import.meta.url))

const AGENT_DIRS = {
  claude: ['.claude', 'skills'],
  codex: ['.codex', 'skills'],
  agents: ['.agents', 'skills'],
}

export function listSupportedAgents() {
  return Object.keys(AGENT_DIRS)
}

export function agentSkillsSegments(agent) {
  const segments = AGENT_DIRS[agent]
  if (!segments) {
    throw new Error(`Unsupported agent "${agent}". Supported: ${listSupportedAgents().join(', ')}`)
  }
  return segments
}

export function listSkillNames() {
  return fss
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && fss.existsSync(path.join(SKILLS_DIR, entry.name, 'SKILL.md')),
    )
    .map((entry) => entry.name)
    .sort()
}

export function listSkills() {
  return listSkillNames().map((name) => ({
    name,
    sourceDir: path.join(SKILLS_DIR, name),
  }))
}

export function getSkill(name) {
  const sourceDir = path.join(SKILLS_DIR, name)
  if (!fss.existsSync(path.join(sourceDir, 'SKILL.md'))) {
    return null
  }
  return { name, sourceDir }
}

function resolveSkills(skillNames) {
  if (!skillNames || skillNames.length === 0) {
    return listSkills()
  }
  return skillNames.map((name) => {
    const skill = getSkill(name)
    if (!skill) {
      throw new Error(`Unknown skill "${name}". Available skills: ${listSkillNames().join(', ')}`)
    }
    return skill
  })
}

// Copy skills into `<projectDir>/.<agent>/skills`. By default existing skills are
// left untouched (bootstrap semantics). Pass `{ overwrite: true }` to refresh them
// to the currently installed framework version (resync semantics).
export async function installSkillsInProject(projectDir, agents, skillNames, options = {}) {
  if (!projectDir) {
    throw new Error('installSkillsInProject: projectDir is required')
  }

  const resolvedAgents = (agents && agents.length > 0 ? agents : ['claude']).map((agent) => {
    agentSkillsSegments(agent)
    return agent
  })

  const skills = resolveSkills(skillNames)
  const overwrite = options.overwrite === true
  const installations = []

  for (const agent of resolvedAgents) {
    const baseDir = path.join(projectDir, ...agentSkillsSegments(agent))
    await fs.mkdir(baseDir, { recursive: true })

    for (const skill of skills) {
      const installDir = path.join(baseDir, skill.name)
      try {
        await fs.cp(skill.sourceDir, installDir, {
          recursive: true,
          force: overwrite,
          errorOnExist: !overwrite,
        })
        installations.push({
          agent,
          skill: skill.name,
          installDir,
          status: overwrite ? 'synced' : 'installed',
        })
      } catch (error) {
        if (!overwrite && (error?.code === 'ERR_FS_CP_EEXIST' || error?.code === 'EEXIST')) {
          installations.push({ agent, skill: skill.name, installDir, status: 'skipped' })
          continue
        }
        throw error
      }
    }
  }

  return { agents: resolvedAgents, skills: skills.map((skill) => skill.name), installations }
}

// Copy a single skill into agent homes under `homeRoot` (defaults to $HOME).
export async function installSkillGlobally(skillName, agents, homeRoot = os.homedir()) {
  const skill = getSkill(skillName)
  if (!skill) {
    throw new Error(
      `Unknown skill "${skillName}". Available skills: ${listSkillNames().join(', ')}`,
    )
  }
  const resolvedAgents = (agents && agents.length > 0 ? agents : ['claude']).map((agent) => {
    agentSkillsSegments(agent)
    return agent
  })

  const installations = []
  for (const agent of resolvedAgents) {
    const baseDir = path.join(homeRoot, ...agentSkillsSegments(agent))
    await fs.mkdir(baseDir, { recursive: true })
    const installDir = path.join(baseDir, skill.name)
    await fs.cp(skill.sourceDir, installDir, { recursive: true, force: true, errorOnExist: false })
    installations.push({ agent, skill: skill.name, installDir })
  }
  return { skill: skill.name, homeRoot, installations }
}
