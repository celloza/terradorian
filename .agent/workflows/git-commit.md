---
description: How to format git commit messages
---

# Git Commit Convention

We follow the Semantic Commits convention.

## Rule
All commit messages MUST follow this format:
`<type>: <description>`

## Types
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation

## Examples
- `feat: migrate to bicep`
- `fix: resolve infinite loop in login`
- `docs: update deployment guide`

## Workflow
1. Stage your changes.
2. Determine the type of change.
3. Write a concise description (lowercase, no period at end).
4. Commit: `git commit -m "<type>: <description>"`
