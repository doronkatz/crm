# CRM — WORKFLOW.md

## Overview

CRM is a fork of [trycompai/crm](https://github.com/trycompai/crm) adding Fastmail SSO, Fastmail email/calendar, and OpenRouter LLM routing. This WORKFLOW.md defines the state machine, dispatch rules, and governance for all agents working on this project.

---

## State Machine

**Canonical states:** `Triage → Backlog → Todo → In Progress → Human Review → Done`

**Off-ramps:** `Blocked` (from In Progress), `Cancelled`

**Reverse transitions:** `Human Review → Rework → In Progress`

---

## Dispatch Policy

| State | Eligible for dispatch? | Notes |
|-------|----------------------|-------|
| Triage | No | Herme's triage queue — not for Codex |
| Backlog | No | Backlog grooming — not for Codex |
| Todo | **Yes** | Primary dispatch target |
| In Progress | **Yes** | Active Codex worker |
| Rework | **Yes** | Returned from Human Review |
| Human Review | **No** | Symphony pauses; Doron reviews |
| Done | No | Terminal |
| Blocked | No | No retry until human resolves blocker |
| Cancelled | No | Terminal |

---

## Human Review Gate

Doron reviews all work before it lands in `Done`. No agent may transition `Human Review → Done`.

---

## Open-Source Codex Symphony binding

This project uses Codex Symphony. See `WORKFLOW.symphony.md` for:

- Symphony daemon startup/shutdown
- Worker dispatch protocol
- Proof-of-work collection
- Rate limit guards

---

## Linear Issue Authoring Standard (binding)

Every Linear ticket authored by any agent MUST follow:

`linear-issue-authoring-standard` skill — `~/.hermes/profiles/tommy/skills/linear-issue-authoring-standard/SKILL.md`

---

## Architecture Rules

- Fastmail code: `apps/api/src/integrations/fastmail/`
- Fastmail OAuth provider: `apps/api/src/auth/providers/fastmail.ts`
- OpenRouter LLM client: `apps/agent/agent/src/llm/openrouter.ts`
- OpenRouter capability detection: `apps/agent/agent/lib/capabilities.ts`
- All new env vars: declared in `apps/api/src/config/env.validation.ts`
- All new env vars: documented in `.env.example`
- Capability-gate pattern: missing key = missing capability, never throws

---

## Upstream Sync Rule

Rebase/merge from `trycompai/crm` `release` branch regularly. Keep fork changes isolated to `integrations/fastmail/`, `auth/providers/fastmail.ts`, and `llm/openrouter.ts`. Do not merge upstream auth/integration changes into these modules without review.

---

## Obsidian artifacts

All planning, PRD, ADR, and engineering artifacts live in:

`~/Obsidian/Doron's Vault/10 Projects/10 Current Projects/CRM/`
