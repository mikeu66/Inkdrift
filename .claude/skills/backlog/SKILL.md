---
name: backlog
description: Add items to the project backlog or view current backlog items
---

# Backlog Management

Manage the project backlog in CLAUDE.md.

**Arguments:** $ARGUMENTS

## Instructions

1. Read the current CLAUDE.md file
2. Find the `## Backlog` section
3. Based on the request:
   - **Add item:** Add a new `- [ ]` checkbox item under the appropriate category (Features, UI/UX, Bugs, etc.)
   - **List items:** Show the current backlog items
   - **Complete item:** Change `- [ ]` to `- [x]` for the specified item
4. If adding, include a brief description after the item name (e.g., `- [ ] Item name - Brief description`)
5. If a category doesn't exist, create it as a ### heading
6. Confirm the action taken

## Categories

- **Features** - New functionality
- **UI/UX** - Visual and user experience improvements
- **Bugs** - Known issues to fix
- **Tech Debt** - Refactoring and code quality improvements

## Examples

- `/backlog add dark mode toggle to Features` → Adds under ### Features
- `/backlog add fix memory leak to Bugs` → Adds under ### Bugs
- `/backlog list` → Shows all backlog items
- `/backlog complete Categories/tags` → Marks item as done
