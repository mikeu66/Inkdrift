# CLAUDE.MD

## Project Overview

A simple, dark-mode desktop to-do application built with Electron. The app launches from the Mac dock and persists all tasks locally using localStorage.

## Project Structure

```
To-do-app/
├── src/
│   ├── index.html     # Main UI with checkbox list
│   ├── styles.css     # Dark mode styling
│   └── app.js         # To-do logic & localStorage
├── main.js            # Electron main process
├── package.json       # Dependencies
├── README.md          # Project documentation
└── CLAUDE.MD         # This file - AI assistant guidelines
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
- LocalStorage - Persistent data storage

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

## Future Enhancements

- Categories/tags
- Due dates
- Priority levels
- Search/filter
- Enhanced UI design
- Keyboard shortcuts

## Project-Specific Conventions

- Keep UI barebones for now - focus on functionality
- All data stored in localStorage
- Dark mode is default (no light mode toggle yet)
- Minimal dependencies - vanilla JavaScript preferred

---

Last updated: 2026-01-01
