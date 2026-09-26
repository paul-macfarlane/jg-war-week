# jg-war-week

## Maintainer's guide

When Jason (or any maintainer) asks how to change JG War Week, read and follow `docs/maintainers-guide.md`.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- atlas-v3:guidance:start -->
## Workspace framing

Atlas workspace: **war-weeker**. Confirmed repositories:

- `war-weeker` at `.`; base `staging` (promoted to `main` by PR); source host `github`.

When isolation or parallel delivery benefits from worktrees, they live beneath
`.claude/worktrees/<work-package>/<repository-id>/`. The frontier
orchestrator chooses direct checkout, worker worktrees, and an optional
integration worktree from the dependency, concurrency, file-ownership, and
shared-state risks. Never place worktrees beneath `.atlas/`. Each affected
repository keeps its own base SHA, branch, verification result, and pull request.

## Repository framing

**war-weeker** — JG War Week: one place for Jahnel Group Organizers and Competition Hosts to run War Week (themes, schedule, teams, competitions, points, awards, announcements) and for participants to follow it, plus a curated War Week history. Post-hackathon: being hardened toward War Week XII (late Feb 2027); plan in `.scratch/hardening/spec.md`.

### Structure

- `.scratch/` — Local-markdown issue tracker: specs, tickets, and plans per feature
- `old-wikis/` — Source text of past War Week wiki pages (2016-2026) for history seeding
- `docs/agents/` — Agent guidance: issue tracker, triage labels, domain docs

### Repository-specific rules

- Competiscore data is gone; historical War Week content comes only from old-wikis/ or manual entry
- Never read .env.local or other .env files; use .env.example for variable names
- No new feature without a named Organizer, Host or Participant need; prefer removing to adding. Correctness, then design, then fun (`.scratch/hardening/spec.md`)
- All work goes on a feature branch (`feat/NN-<slug>`, `fix/…`, `chore/…`, `docs/…`) with a PR into `staging`. Never commit directly to `staging` or `main`; `staging` → `main` is its own PR. This overrides any skill that says to commit to the current branch.
- UI uses shadcn components (base-nova / Base UI, `components.json`). Add one with `pnpm dlx shadcn@latest add <name>`; don't hand-roll a control shadcn already has. App-specific wrappers (`EntityCombobox`, `DatePicker`, `DateRangePicker`, `TimeCombobox`, `ColorField`, `ConfirmDialog`) live in `src/components/`; confirms use `ConfirmDialog`, results use sonner toasts; their popups portal into the themed root via `ThemeRoot`.

## Atlas repository workflow

Use the lightest route that fits:

- Small, clear change: `/implement <description-or-spec>` then verify.
- Normal feature: `/grill-with-docs` → optional prototype → `/to-spec` → optional `/to-tickets` → `/atlas-red-team` when required → optional `/atlas-plan <ticket-epic-or-spec>` → `/atlas-implement`.
- Huge or unclear effort: `/wayfinder`, then rejoin at the spec route.
- Existing ticket, epic, or stable spec: optional `/atlas-plan <work-package>` → `/atlas-implement <work-package>`.

Run `/atlas-plan` and `/atlas-implement` using the most capable approved
frontier-grade model available. These commands reserve frontier capacity for
planning, orchestration, review, and final verification; implementation
delegates tightly specified or mechanical work to the least expensive capable
worker model.

Managed work uses `/atlas-implement <ticket-or-epic-or-spec>`. A frontier
orchestrator chooses the execution structure and delegates bounded deliverables
when useful. It uses the least expensive capable worker model per delegation;
tight, mechanical packets favor cheaper models, while final review and
verification judgment stay with the frontier orchestrator. Implementation
workers read and follow the supported Matt Pocock implementation skill source
while deferring its final review step. Size alone is never a reason to stop.

## Repository policy and contract model

`CLAUDE.md` is the agent entry point and cross-cutting policy router. Team-owned
documents under `docs/agents/` are authoritative for their named scope. Within
a document that classifies entries, the classification determines authority;
recommendations and repository facts do not silently become mandatory policy.
Tickets and specs remain stable work-package contracts. Planning resolves the
applicable repository policy and facts into technical plans and execution
packets. Generic skills provide reusable mechanics and do not override
repository policy.

Setup initializes `docs/agents/*`; the team owns those files afterward. A setup
rerun refreshes only the managed sections Atlas itself last wrote, preserves any
section the team has edited, and reports every preserved edit in `plan` and
`verify` output.

- Before any tracker read, write, comment, claim, or transition, read and follow
  `docs/agents/issue-tracker.md`.
- Before creating, classifying, prioritizing, or decomposing tickets, read and
  follow `docs/agents/triage-labels.md`.
- Before clarifying, researching, prototyping, specifying, decomposing,
  technically planning, or red-team reviewing proposed work, read and follow
  `docs/agents/planning.md`. This includes `/grill-with-docs`, Wayfinder,
  planning prototypes, `/to-spec`, `/to-tickets`, and `/atlas-plan`.
- During planning, read `docs/agents/domain.md` when the work introduces or
  changes domain concepts and resolve conflicting terminology in the plan.
- Before writing acceptance criteria, Definition of Done, fixtures, or
  verification steps, read `docs/agents/testing.md`.
- During planning, read `docs/agents/tooling.md` when work depends on a detected
  capability and resolve the applicable tool into the execution plan.

Execution workers receive resolved decisions, exact verification commands, and
the evidence location in their task packet. Do not make execution workers
reread planning, tracker, triage, domain, testing, or tooling guidance.

## Atlas planning contract

- Invoking `/atlas-implement` approves the fixed work-package contract and any
  existing technical plan. When the contract is content-complete but no plan
  exists, the frontier orchestrator derives the execution plan without inventing
  missing product or architectural decisions.
- `/atlas-plan` is optional. Read `docs/agents/issue-tracker.md` for the
  project's configured readiness, availability, claim, transition, and
  writeback policy; do not infer those rules here.
<!-- atlas-v3:guidance:end -->
