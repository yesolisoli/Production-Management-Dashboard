@AGENTS.md

# Project Architecture Rules

## Core Principles
- Keep business logic centralized
- Avoid duplicated state
- Prefer derived state
- Reuse existing helpers/types/handlers
- Avoid quick patch logic
- Keep components presentation-focused
- Keep hooks as single source of truth

## Project Rules
- use-assignment-board-data is the main state manager
- TV view should consume derived data only
- Persisted data must survive refresh
- Do not introduce parallel state systems

## Workflow
- Analyze architecture before implementation
- Propose a plan before major changes
- Minimize file modifications
- Run typecheck after changes

## State Management
- Never store derived data as independent mutable state
- Prefer selectors/computed values over sync effects
- Avoid unnecessary useEffect synchronization

## Implementation Rules
- Do not rewrite unrelated files
- Preserve existing UX behavior unless explicitly requested
- Prefer incremental changes over large rewrites