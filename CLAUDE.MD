# CLAUDE.MD

## Project Overview

A simple, dark-mode desktop to-do application built with Electron. The app launches from the Mac dock and persists all tasks as JSON files in Electron's userData directory, accessed via IPC.

## Project Structure

```
To-do-app/
├── main.js            # Electron main process (storage, AI providers, IPC)
├── preload.js         # Context-isolated bridge between main and renderer
├── index.html         # Main UI with checkbox list
├── styles.css         # Dark mode styling
├── app.js             # Renderer: to-do logic and views
├── lib/               # Pure functions shared with tests (validation, parsing)
├── test/              # Unit tests (node:test, run via npm test)
├── benchmark/         # Ollama vs Claude comparison for the app's AI tasks
├── docs/              # README assets (screenshot)
├── package.json       # Dependencies
├── README.md          # Project documentation
└── CLAUDE.MD          # This file - AI assistant guidelines
```

## Development Guidelines

### Code Style
- Follow consistent naming conventions
- Write clean, readable code
- Add comments for complex logic
- Keep functions focused and single-purpose

### Git Workflow
- Use descriptive commit messages
- Create feature branches for new work
- Test changes before committing
- Keep commits atomic and focused

### Testing
- Write tests for new features
- Ensure existing tests pass before committing
- Test edge cases and error conditions

### Documentation
- Update README.md with significant changes
- Document API endpoints and interfaces
- Keep this CLAUDE.MD file updated

## Tech Stack

**Desktop:**
- Electron (v28+) - Desktop application framework
- Node.js - JavaScript runtime

**Frontend:**
- HTML5 - Markup
- CSS3 - Dark mode styling (barebones, to be enhanced later)
- Vanilla JavaScript (ES6+) - No frameworks

**Storage:**
- JSON files in Electron's userData directory, read/written by the main process and exposed to the renderer via IPC
- API keys encrypted at rest with Electron safeStorage (OS keychain when available)
- localStorage is used only for the UI theme preference

## Project Goals

- Build a functional to-do application
- Maintain clean, maintainable code
- Follow best practices for software development

## Notes for Claude

- Always read existing code before making modifications
- Follow the established patterns in the codebase
- Ask for clarification when requirements are unclear
- Test changes when possible
- Keep changes focused on the requested task

## Current Features (v1.0)

- ✅ Add new to-do items
- ✅ Checkbox to mark items complete
- ✅ Delete individual items
- ✅ Persistent storage (survives app restart)
- ✅ Dark mode UI
- ✅ Launches from Mac dock

## Current Features (v2.0)

- ✅ Edit existing items (inline editing with Save/Cancel)
- ✅ Keyboard shortcuts (Enter to save, Escape to cancel while editing)
- ✅ Planning page for each task (click task to open)
- ✅ Notes field with auto-save functionality
- ✅ Navigation between list and detail views
- ✅ Priority levels (High/Medium/Low)
- ✅ Priority-based sorting with colored indicators
- ✅ Visual priority system (red/yellow/green circles)
- ✅ In Progress section for active tasks
- ✅ Mark tasks as "In Progress" from planning page
- ✅ Add new task input moved to bottom of list

## Backlog

### Features
- [ ] Categories/tags - Add tagging system to organize tasks
- [ ] Due dates - Add due date picker and display for tasks
- [ ] Search/filter - Add ability to search and filter the task list
- [ ] Keyboard shortcuts - Add keyboard navigation and shortcuts
- [ ] Multiple choice interface option - Add multiple choice selection interface for tasks

### UI/UX
- [ ] Enhanced UI design - Improve overall visual design

## Project-Specific Conventions

- Keep UI barebones for now - focus on functionality
- All task data stored as JSON in userData via IPC (never accessed directly from the renderer)
- Dark mode is the default theme (a light mode toggle exists in the header)
- Minimal dependencies - vanilla JavaScript preferred

---

Last updated: 2026-07-12
