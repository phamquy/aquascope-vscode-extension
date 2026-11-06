# 0001. Spec-driven development with an Obsidian task vault

- Status: accepted
- Date: 2026-11-05

## Context

We want AI agents and humans to work from the same durable intent, and to track work without an external service.

## Decision

Specs live in `specs/`, decisions in `docs/adr/`, and tasks as Markdown notes in `vault/`, an Obsidian vault viewed through a Bases board.

## Consequences

All state is versioned in git and readable without tooling. Task status is in note frontmatter, so agents can update it with plain file edits.
