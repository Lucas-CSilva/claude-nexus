# claude-nexus

Centralized hub for Claude Code agents and skills, distributed as a plugin and shared across all your projects. Install once and the same specialist agents and conventions are available in **every** repo you work in.

## Why

Instead of re-creating agents and copy-pasting conventions into each project, `claude-nexus` keeps a single source of truth. The agents are designed to hand off to one another across a software delivery lifecycle — from a rough idea to verified, merged code.

```
idea ──▶ business-analyst ──▶ architect ──▶ nextjs-engineer ──┐
              (PRD)            (spec/ADR)   spring-webflux-… ──┴──▶ code-reviewer ──▶ done
                                                                      (verify)
                            researcher  ◀── supports every stage ──▶
```

## Available Agents

| Agent | Role | Use it when… |
| --- | --- | --- |
| `business-analyst` | Requirements | A rough idea or feature request needs to become a clear, testable PRD before any design. Produces the *what* and *why*. |
| `architect` | Design | A PRD is ready to become a technical spec — defining service boundaries, recommending a stack, and recording ADRs before coding. |
| `nextjs-engineer` | Frontend | Implementing frontend features in Next.js (App Router) + TypeScript + React from an architect's spec and API contracts. |
| `spring-webflux-engineer` | Backend | Implementing reactive Java backends (Spring WebFlux, hexagonal architecture) from a spec and contracts. |
| `code-reviewer` | Verification | Code or a design needs independent verification against the spec and acceptance criteria before it's accepted. Never reviews its own work. |
| `researcher` | Support | A technical question needs a concise, sourced answer (APIs, errors, best practices, option comparisons) without flooding the context with raw search results. |

## Available Skills

Skills are reusable knowledge packs that agents (and you) load on demand.

| Skill | What it does |
| --- | --- |
| `project-docs` | Document structure and conventions for PRDs, tech specs, and ADRs. |
| `mermaid` | Author render-safe Mermaid diagrams embedded in Markdown. |
| `nextjs-react-conventions` | Conventions and patterns for Next.js (App Router) + TypeScript + React. |
| `spring-webflux-conventions` | Conventions for reactive Java backends (Spring WebFlux, hexagonal architecture). |

## Installation

This repo is a Claude Code plugin served from its own marketplace.

### From GitHub (syncs across machines)

```
/plugin marketplace add lucascorreia-dev/claude-nexus
/plugin install claude-nexus@claude-nexus
```

### From a local clone

```bash
git clone https://github.com/lucascorreia-dev/claude-nexus.git
```

Then, inside Claude Code, point the marketplace at the cloned directory:

```
/plugin marketplace add /path/to/claude-nexus
/plugin install claude-nexus@claude-nexus
```

## Usage

Once installed, the agents and skills are available in any project:

```
> Have the business-analyst draft a PRD for this feature
> Use the architect to turn that PRD into a technical spec
> Have the code-reviewer verify the implementation against the spec
```

Skills are invoked automatically when relevant, or explicitly with `/project-docs`, `/mermaid`, etc.

## Structure

```
claude-nexus/
├── agents/                   # Agent definition files (.md) — source of truth
├── skills/                   # Reusable skills (each in its own dir)
├── .claude-plugin/
│   ├── plugin.json           # Plugin manifest
│   └── marketplace.json      # Marketplace manifest (makes it installable)
├── .claude/                  # Local dev-only symlinks for dogfooding (gitignored)
└── CLAUDE.md                 # Global coding standards
```

## Local Development

To use the agents and skills *while editing them in this repo* — without reinstalling the plugin — `.claude/agents` and `.claude/skills` are symlinked to the top-level `agents/` and `skills/` folders. The symlinks are gitignored; consumers always load everything through the plugin manifest, never through these links.

```bash
ln -s ../agents .claude/agents
ln -s ../skills .claude/skills
```

Because of these symlinks, creating an agent via `/agents` writes straight into `agents/` — no manual move needed.

After editing an agent or skill, validate the manifests:

```bash
claude plugin validate .
```

## Adding a New Agent

```bash
cat > agents/my-agent.md << 'EOF'
---
name: my-agent
description: What it does and when to use it
tools: Read, Grep, Glob
model: sonnet
---

You are a [role]...
EOF

git add agents/my-agent.md
git commit -m "Add my-agent"
git push
```

After pushing, update the plugin to pick up the change:

```
/plugin marketplace update claude-nexus
```
