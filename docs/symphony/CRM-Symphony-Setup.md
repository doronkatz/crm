# CRM Symphony Setup

**Status:** active  
**Repo path:** `/Users/doronkatz/Development/Apps/crm`  
**Git remote:** `git@github.com:doronkatz/crm.git`  
**Linear project:** [CRM](https://linear.app/cascadia-ai/project/crm-1b2b80cb5403)  
**Source architecture docs:** [[10 Projects/10 Current Projects/CRM/01 Strategy/PRD/CRM PRD — Fastmail SSO, Fastmail Email/Calendar & OpenRouter]] | [[10 Projects/10 Current Projects/CRM/04 Architecture Decisions/ADR-001 — Fastmail OAuth SSO]] | [[10 Projects/10 Current Projects/CRM/04 Architecture Decisions/ADR-002 — Fastmail JMAP CalDAV]] | [[10 Projects/10 Current Projects/CRM/04 Architecture Decisions/ADR-003 — OpenRouter LLM Routing]]

## Architecture baseline for all Symphony work

Symphony agents must implement CRM against the accepted architecture:

- **Application shape:** Agentic-first CRM (trycompai/crm fork)
- **Stack:** tRPC API (`apps/api`), Next.js app (`apps/app`), Eve AI agent (`apps/agent`)
- **Auth:** Better Auth with multiple OAuth providers; intelligence in `apps/agent`, never in the API layer
- **Email/calendar:** Fastmail JMAP + CalDAV + CardDAV (replacing/supplementing Google Gmail/Calendar)
- **LLM routing:** OpenRouter with Context.dev fallback
- **Env config:** `.env` at repo root; `.env.example` documents all vars; `env.validation.ts` enforces types
- **Fastmail code:** `apps/api/src/integrations/fastmail/` — isolated from upstream Google integration
- **OpenRouter code:** `apps/agent/agent/src/llm/openrouter.ts`
- **Capability gating:** missing key = missing capability, never throws

## Symphony execution model

All implementation tickets must be executed in Symphony/Codex workspaces from this repository root:

```bash
cd /Users/doronkatz/Development/Apps/crm
```

Before implementation starts, create a git worktree instead of copying the repo into a temp directory.

## Required review and approval gate

No Symphony-implemented ticket may be considered complete until it has at least **three independent agent reviews/approvals**:

1. **QA Review** — validates acceptance criteria, test evidence, regression risk, visual assets, and docs changes.
2. **Product Review** — validates PRD alignment, scope fidelity, and user story completeness.
3. **Architect Review** — validates architecture, security, API boundaries, and integration constraints.

## Upstream sync rule

Rebase/merge from `trycompai/crm` `release` branch regularly. Keep fork changes isolated to:
- `apps/api/src/integrations/fastmail/`
- `apps/api/src/auth/providers/fastmail.ts`
- `apps/agent/agent/src/llm/openrouter.ts`

Do not merge upstream auth/integration changes into these modules without review.

## Obsidian artifacts

All planning, PRD, ADR, and engineering artifacts live in:

`~/Obsidian/Doron's Vault/10 Projects/10 Current Projects/CRM/`
