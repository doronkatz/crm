# CRM — Agent Instructions

**Fork of:** [trycompai/crm](https://github.com/trycompai/crm)  
**This fork:** [doronkatz/crm](https://github.com/doronkatz/crm)  
**Linear project:** [CRM](https://linear.app/cascadia-ai/project/crm-1b2b80cb5403)

---

## What this fork adds

1. **Fastmail OAuth SSO** — Fastmail as a first-class auth provider (replacing or supplementing Google OAuth)
2. **Fastmail JMAP/CalDAV/CardDAV** — Fastmail email, calendar, contacts integration (replacing/supplementing Google Gmail/Calendar)
3. **OpenRouter LLM routing** — OpenRouter as Context.dev replacement for the Eve AI agent

---

## Strict rules — review before starting any work

**Read the doc for the area you are touching before you touch it.** The table below is the whole index.

| Working on | Read first |
|---|---|
| Anything in `apps/api` — tRPC, auth, logging, sync, deletes, caching | `docs/api.md` |
| `apps/agent` — the Eve research agent, tools, tasks, dispatch | `docs/agent.md` |
| `.env`, configuration, which variables exist and why | `docs/environment.md` |
| UI in `apps/app` or `packages/ui` | `docs/design.md` |
| Deal amounts, totals, charts, exchange rates | `docs/currency.md` |
| The record sheet's Agent tab | `docs/agent-panel.md` |
| Running it locally, Google Cloud, DB commands, secrets | `docs/setup.md` |
| Anything that sends a telemetry event, or a new property on one | `docs/telemetry.md` |
| `.github/workflows`, versions, changelog, how a change reaches `release` | `CONTRIBUTING.md` |

Also check `.agents/skills/` for a relevant skill before starting.

---

## Fastmail Integration Rules (new in this fork)

- **All Fastmail code goes in `apps/api/src/integrations/fastmail/`** — same pattern as `apps/api/src/integrations/google/`
- **New env vars follow the `FASTMARK_` prefix** — e.g. `FASTMARK_CLIENT_ID`, `FASTMARK_CLIENT_SECRET`
- **Add every new var to `.env.example`** with full documentation — never add a per-package `.env`
- **Declare new env vars in `apps/api/src/config/env.validation.ts`** following the existing pattern
- **OAuth provider:** `apps/api/src/auth/providers/fastmail.ts` — follow the Google/Microsoft provider pattern
- **OpenRouter client:** `apps/agent/agent/src/llm/openrouter.ts` — follow the existing LLM client pattern

---

## OpenRouter Integration Rules (new in this fork)

- **OpenRouter client in `apps/agent/agent/src/llm/openrouter.ts`**
- **Capability detection:** `apps/agent/agent/lib/capabilities.ts` — detect `OPENROUTER_API_KEY`
- **When key present:** route all LLM calls through OpenRouter
- **When key absent:** fall back to Context.dev (existing behavior unchanged)
- **Default model:** `openai/gpt-4o-mini`; allow user override

---

## Always true

- **Never add code comments.** Not to new code, not to code you edit.
- **No coauthoring commits.** No `Co-Authored-By` trailer, ever.
- **Intelligence lives in `apps/agent`, never in the API.** No vendor client, no enrichment, no scoring in Nest.
- **One `.env`, at the repo root.** `.env.example` is its documentation.
- **Anything a self-hoster might not have is optional and must never throw.** Missing key = missing capability.
- **`/packages/ui` is the single source of truth for UI.**
- **eve's own docs ship in `apps/agent/node_modules/eve/docs`** — read the relevant guide before writing Eve code.
- **Keep fork changes isolated** — do not merge upstream auth/integration changes into the Fastmail/OpenRouter modules.
- **Sync from upstream `trycompai/crm` regularly** — rebase from `release` branch to stay current.

---

## Open-Source Codex Symphony binding

This project uses Codex Symphony for autonomous agent dispatch. See `WORKFLOW.md` for the state machine and `WORKFLOW.symphony.md` for Symphony-specific rules.

**Canonical state machine:** `Triage → Backlog → Todo → In Progress → Human Review → Done`

**Dispatch policy:** `Todo`/`In Progress` eligible for Codex dispatch. `Human Review` — Doron reviews (mandatory HR gate). `Done`/`Cancelled` are terminal.

**Ownership:** Linear is the control plane and source of truth for state. Symphony spawns isolated Codex runs per ticket.

---

## Linear Issue Authoring Standard (binding)

Every Linear ticket created or mutated by any agent under this project's authority MUST follow the canonical standard.

Skill: `linear-issue-authoring-standard` at `~/.hermes/profiles/tommy/skills/linear-issue-authoring-standard/SKILL.md`

---

## Linear project tickets

| Epic | Linear |
|------|--------|
| Fastmail SSO | [CAS-1676](https://linear.app/cascadia-ai/issue/CAS-1676) |
| Fastmail Email & Calendar | [CAS-1677](https://linear.app/cascadia-ai/issue/CAS-1677) |
| OpenRouter AI Routing | [CAS-1678](https://linear.app/cascadia-ai/issue/CAS-1678) |
| All tickets | [Linear CRM project](https://linear.app/cascadia-ai/project/crm-1b2b80cb5403) |
