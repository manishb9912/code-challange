# AI usage

> **Template.** Sections marked `TODO (human)` are deliberately empty. They must be written by the author from their own experience, not generated.

## Tools and models

- **Claude Code**, model: Claude Opus 5.5 (`claude-opus-5-5`), in the VS Code extension.
- TODO (human): any other tools used (e.g. ChatGPT, Copilot), or "none".

## Agent instruction files

- [CLAUDE.md](CLAUDE.md): project conventions the agent followed. It covers the layout and dependency rule, commands, security non-negotiables, testing rules and workflow (plan first, small slices, ask don't guess, never push).

## Plan / spec

- [docs/SPEC.md](docs/SPEC.md): written and approved before any code. It covers the architecture, the API contract, the acceptance-criteria → endpoint → component → test mapping, the threat model, assumptions and the build order.
- [docs/prompts/initial-brief.md](docs/prompts/initial-brief.md): the instruction brief given to the agent.
- [docs/ai-notes.md](docs/ai-notes.md): the agent's running log of course changes, its own mistakes and non-obvious choices. This is raw material for the sections below, to be verified by the author.

## Key prompts and moments that shaped the solution

TODO (human): 3–5 moments, each with what you asked, what came back, and what you decided. For example, the plan review, the rate-limit trade-off question, the Docker port conflict.

1. TODO (human)
2. TODO (human)
3. TODO (human)

## Where the AI got it wrong, and how it was caught

TODO (human): pick the cases you verified yourself (candidates are logged in docs/ai-notes.md) and say how each was caught: tests, lint, a manual check, your review.

1. TODO (human)
2. TODO (human)

## What I reviewed and changed myself

TODO (human)

## Time spent

TODO (human): actual time, roughly split.

| Activity                      | Time         |
| ----------------------------- | ------------ |
| Planning (brief, spec review) | TODO (human) |
| Building                      | TODO (human) |
| Testing / verification        | TODO (human) |
| Reviewing AI output           | TODO (human) |
| **Total**                     | TODO (human) |
