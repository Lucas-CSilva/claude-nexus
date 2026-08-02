---
name: project-docs
description: >
  Defines document structure and conventions for personal software projects. Use this skill whenever
  a business analyst or architect role needs to produce a planning document — a PRD/requirements doc,
  a technical specification, a task breakdown, or an Architecture Decision Record (ADR). Trigger on
  phrases like "write a PRD", "draft requirements", "write a tech spec", "technical specification",
  "create an ADR", "architecture decision", "requirements document", "document this feature",
  "spec this out", "break this into tasks", "task breakdown", "slice this feature", "build order",
  or any request to produce structured planning output for a software project. Also trigger when a
  user asks how documents relate to each other or what goes in a given section. This skill owns
  document structure only — the agent fills sections with project-specific content.
---

# Project Documentation Skill

This skill governs the structure and format of four document types used in a personal software project:

| Document | Produced by | Consumes | Purpose |
|---|---|---|---|
| **PRD** | Business Analyst | — | Defines *what* and *why* |
| **Tech Spec** | Architect | PRD requirement IDs | Defines *how* |
| **Task Breakdown** | Architect | Tech Spec | Sequences multi-slice delivery into ordered, independently-mergeable chunks *(only when the spec needs it — see below)* |
| **ADR** | Architect | PRD + Tech Spec | Records significant decisions |

---

## Project Lifecycle: How the Documents Relate

```
PRD (BA)  ──►  Tech Spec (Architect)  ──►  Task Breakdown (Architect, multi-slice specs only)  ──►  ADRs (as decisions arise)
               ↑ traces back to FR/NFR IDs         ↑ ordered slices of the Tech Spec
```

1. **BA writes the PRD first.** Every requirement gets a unique ID (`FR-001`, `NFR-001`, etc.). These IDs are the primary cross-document contract.
2. **Architect reads the PRD and writes the Tech Spec.** Every design choice is grounded in one or more requirement IDs. The spec's *Requirements Traceability* section is the explicit mapping.
3. **Architect writes a Task Breakdown, in the same pass, if the spec needs one.** Sequencing a build into independently-mergeable slices is itself a design judgment call — the same hand that wrote the component breakdown is best placed to order it. See "When to Write a Task Breakdown" below for the trigger.
4. **ADRs are written on demand** — whenever a significant design decision needs to be recorded outside the spec narrative (e.g., choosing a database, picking an auth strategy, adopting a pattern).

> **Handoff contract:** The BA MUST assign stable requirement IDs before the architect begins. The architect MUST cite those IDs in the spec — never paraphrase or re-number them. A broken ID reference means a broken traceability chain.

---

## Diagram Integration (mermaid skill)

Any diagram in any of these documents **must be authored using the `mermaid` skill**. Read `mermaid/SKILL.md` before writing any diagram. The table below maps diagram types to their canonical locations:

| Diagram type | Where it belongs |
|---|---|
| Architecture / service map (flowchart + subgraphs) | Tech Spec § Architecture |
| Sequence diagram (per major flow) | Tech Spec § Component Breakdown or API Contracts |
| ER diagram | Tech Spec § Data Model |
| State diagram | Tech Spec § Data Model (for lifecycle-heavy entities) |
| Flowchart | PRD § Use Cases (optional, for complex flows) |

---

## Templates

Each template is a separate file. Copy the skeleton, then fill every section with project-specific content. Do not omit sections — use `_N/A — [reason]_` if a section genuinely does not apply.

| Template | File | Role |
|---|---|---|
| PRD / Requirements | `templates/prd.md` | Business Analyst |
| Technical Specification | `templates/tech-spec.md` | Architect |
| Task Breakdown (per slice) | `templates/task-slice.md` | Architect |
| Architecture Decision Record | `templates/adr.md` | Architect |

### When to use each template

**PRD** — Use at the start of any feature or project. Answer: what problem are we solving, for whom, and how will we know we succeeded? Stop before saying anything about implementation.

**Tech Spec** — Use after the PRD is approved and requirement IDs are stable. Answer: how will we build it? Every claim should trace to a requirement ID.

**Task Breakdown** — Use once the Tech Spec exists, only if it needs one (see below). One file per slice, not one file for the whole feature.

**ADR** — Use when a decision is significant enough that future-you (or a future collaborator) would want to know why a choice was made. One ADR per decision. They accumulate over time; do not edit old ones — instead write a new ADR that supersedes the old one.

---

## Task Breakdown (Multi-Slice Specs Only)

Most specs don't need this — a plain CRUD feature is built in one pass and the Tech Spec's
Component Breakdown (§3) is guidance enough. Write a Task Breakdown only when the spec itself
surfaces multiple **independently buildable, independently testable** phases — the signal is
usually one or more of:

- An asynchronous or eventual-consistency pipeline (queue → consumer → projection) where the
  trigger, the consumer, and turning it on for real are each verifiable on their own.
- A retrofit onto an existing, already-shipped feature, where each step must leave the system in a
  working state if you stop there.
- A multi-phase rollout (schema change → backfill → cutover) where doing it all in one shot would
  make a partial failure hard to diagnose.

If none of these apply, don't create a `tasks/` folder — a single-pass CRUD spec forcing itself
into slices is busywork, not clarity.

**When it applies:** the architect writes the Task Breakdown in the same pass as the Tech Spec,
right after the Component Breakdown is settled — sequencing the build is a design judgment call,
not a separate later exercise.

**Structure:** `specs/00N-feature/tasks/NN-slice-name.md`, one file per slice, numbered in build
order (`01-`, `02-`, ...). Each file uses `templates/task-slice.md`: a goal, why the slice is an
independent checkpoint, explicit `Depends on` / `Blocks` slice references, a checklist, and a
definition of done that's verifiable without any later slice existing yet. Keep each slice small
enough to hold in one sitting — if a slice file is accumulating unrelated concerns, split it.

---

## ID Scheme Reference

| Prefix | Applies to | Example |
|---|---|---|
| `FR-NNN` | Functional Requirement | `FR-001` |
| `NFR-NNN` | Non-Functional Requirement | `NFR-001` |
| `UC-NNN` | Use Case | `UC-001` |
| `AC-NNN` | Acceptance Criterion | `AC-001` |
| `ADR-NNN` | Architecture Decision Record | `ADR-001` |

IDs are zero-padded to three digits and never reused, even if a requirement is removed (mark it `[REMOVED]` instead).
