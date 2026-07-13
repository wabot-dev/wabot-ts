---
name: wabot-framework
description: Use when working with @wabot-dev/framework — building, reviewing, or debugging chat bots, REST APIs, sockets, async jobs, or any project scaffolded with @wabot-dev/create. Covers project boot, the IProjectRunnerConfig flow, file layout, the WABOT_BUNDLED dev/prod split, and where to dive for each subsystem.
---

# Wabot Framework — Umbrella skill

Wabot is a TypeScript framework for chat bots, REST and Socket.IO APIs, and async/cron work, all wired through a `tsyringe`-based DI container. Code is self-discovered from `src/` at boot time and each subsystem is opt-in via decorators.

## Project boot — `src/_run_.ts`

```typescript
import { run, IProjectRunnerConfig } from '@wabot-dev/framework'

export const config: IProjectRunnerConfig = {}

export default config

if (process.env.WABOT_BUNDLED !== '1') {
  run(config)
}
```

- `run(config)` is the entry point. It scans `directories` (default `['src']`), imports every `.ts`/`.js` it finds (so decorators register), then starts every discovered subsystem.
- `WABOT_BUNDLED=1` is set in production by `npm start` after `npm run build` produces `dist/entry.js` (bundled by `@wabot-dev/framework/dist/build/build.js`). In that mode you must not call `run()` at import time — the bundled entry calls it.
- If `DATABASE_URL` is set to `postgres://…` the runner registers Pg adapters (chat memory/repo, jobs, cron jobs, locker, transaction). Otherwise it registers the in-memory equivalents. There is no manual `container.registerType(ChatRepository, …)` to write.

`IProjectRunnerConfig` fields: `directories?`, `exclude?`, `connectionString?`, `chatAdapters?` (override auto-detect by env keys: `OPENAI_API_KEY` → OpenAI, `OPENROUTER_API_KEY` → OpenRouter, `ANTHROPIC_API_KEY` → Anthropic, `GOOGLE_API_KEY` → Google), `preloaded?` (used by the bundled output — skip filesystem scan).

## Scripts (from `@wabot-dev/template`)

| Script | What it does |
| --- | --- |
| `npm run dev` | `node --import=@yucacodes/ts --env-file=./.env ./src/_run_.ts` |
| `npm run dev:watch` | Same with `--watch --watch-preserve-output` |
| `npm run cmd` | Runs `runCmdClient()` — connects to the local cmd channel for terminal chats |
| `npm run build` | Bundles to `dist/entry.js` via the framework's `build.js` |
| `npm start` | Runs the bundle with `WABOT_BUNDLED=1` |
| `npm run tsc` | `tsc --noEmit` |

## Typical layout

```text
src/
  _run_.ts                       # boot: run(config)
  _cmd_.ts                       # optional terminal client
  <bot>/
    <Bot>ChatController.ts       # @chatController + channel decorators
    mindset/<Bot>Mindset.ts      # @mindset implementing IMindset
    modules/<Foo>Module.ts       # @tools (formerly @mindsetModule) with tool functions
    models/<x>/<X>.ts            # Entity subclass
    models/<x>/<X>Repository.ts  # @repository + @memExtension/@pgExtension
```

The runner discovers `@chatController`, `@restController`, `@socketController`, `@uiController`, `@commandHandler`, `@cronHandler`, and `@chatAdapter` by scanning `directories`. No central registration list.

## Subsystem skills

Load the skill that matches the task:

| Task | Skill |
| --- | --- |
| Wire services, lifecycles, env, config | `wabot-di-config` |
| Validate DTOs, transform input, describe tool args | `wabot-validation` |
| Define entities, repositories, queries | `wabot-persistence` |
| Define bot behavior, modules, models | `wabot-mindset` |
| Dev-facing agents, typed/yes-no answers, orders, tool sharing & gating, mindset→agent delegation | `wabot-agents` |
| Receive chat messages, configure channels (cmd, socket, telegram, whatsapp) | `wabot-chat` |
| Expose REST endpoints or Socket.IO namespaces | `wabot-rest-socket` |
| Server-render web pages, forms, and interactive islands | `wabot-ui` |
| Background commands, cron schedules, DB transactions | `wabot-async` |
| Protect endpoints/sockets with JWT or API key | `wabot-auth` |
| Logger, locking, errors, password hashing, randomness | `wabot-ops` |
| Write tests or evals (harnesses, mocks, LlmJudge) | `wabot-testing` |

## Hard rules

- All decorators and helpers ship from a single package: `@wabot-dev/framework`. Never import from internal paths.
- Code identifiers are in English; user-facing text (mindset prompts, docs) may be in Spanish or the bot's chosen language.
- Decorators run as **side effects** on import. The project runner relies on this. Do not lazy-load files that contain decorators behind conditional branches.
- Never invent decorators or types not present in the framework source. If a need is not covered, write a plain class with `@injectable()`/`@singleton()` and inject it.
- Do not rename or restructure the discovery scripts (`_run_.ts`, `_cmd_.ts`) without also updating `package.json` and the build output.
