---
name: project-docs
description: >
  Defines document structure and conventions for personal software projects. Use this skill whenever
  a business analyst or architect role needs to produce a planning document — a PRD/requirements doc,
  a technical specification, or an Architecture Decision Record (ADR). Trigger on phrases like
  "write a PRD", "draft requirements", "write a tech spec", "technical specification", "create an ADR",
  "architecture decision", "requirements document", "document this feature", "spec this out", or any
  request to produce structured planning output for a software project. Also trigger when a user asks
  how documents relate to each other or what goes in a given section. This skill owns document
  structure only — the agent fills sections with project-specific content.
---

# Project Documentation Skill

This skill governs the structure and format of three document types used in a personal software project:

| Document | Produced by | Consumes | Purpose |
|---|---|---|---|
| **PRD** | Business Analyst | — | Defines *what* and *why* |
| **Tech Spec** | Architect | PRD requirement IDs | Defines *how* |
| **ADR** | Architect | PRD + Tech Spec | Records significant decisions |

---

## Project Lifecycle: How the Documents Relate

```
PRD (BA)  ──►  Tech Spec (Architect)  ──►  ADRs (as decisions arise)
               ↑ traces back to FR/NFR IDs
```

1. **BA writes the PRD first.** Every requirement gets a unique ID (`FR-001`, `NFR-001`, etc.). These IDs are the primary cross-document contract.
2. **Architect reads the PRD and writes the Tech Spec.** Every design choice is grounded in one or more requirement IDs. The spec's *Requirements Traceability* section is the explicit mapping.
3. **ADRs are written on demand** — whenever a significant design decision needs to be recorded outside the spec narrative (e.g., choosing a database, picking an auth strategy, adopting a pattern).

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
| Architecture Decision Record | `templates/adr.md` | Architect |

### When to use each template

**PRD** — Use at the start of any feature or project. Answer: what problem are we solving, for whom, and how will we know we succeeded? Stop before saying anything about implementation.

**Tech Spec** — Use after the PRD is approved and requirement IDs are stable. Answer: how will we build it? Every claim should trace to a requirement ID.

**ADR** — Use when a decision is significant enough that future-you (or a future collaborator) would want to know why a choice was made. One ADR per decision. They accumulate over time; do not edit old ones — instead write a new ADR that supersedes the old one.

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
