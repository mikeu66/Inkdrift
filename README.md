# To-Do App

A simple, dark-mode desktop to-do application built with Electron.

## Features

- Add, edit, and delete to-do items
- Check off completed tasks
- Inline editing with Save/Cancel buttons
- Planning page for each task with notes
- Priority levels (High/Medium/Low) with colored indicators
- Auto-sorting by priority and creation date
- Click any task to open detailed planning view
- Auto-save notes and priority as you type
- Navigation with back button
- Visual priority system (🔴 red, 🟡 yellow, 🟢 green circles)
- Keyboard shortcuts (Enter to save, Escape to cancel)
- Persistent storage (tasks saved locally)
- Dark mode UI
- Runs as a native Mac application

## Installation

```bash
npm install
```

## Running the App

```bash
npm start
```

## Building for macOS

```bash
npm run build
```

This will create a distributable .app file in the `dist` folder.

## Project Structure

```
To-do-app/
├── src/
│   ├── index.html     # Main UI
│   ├── styles.css     # Dark mode styling
│   └── app.js         # To-do logic & localStorage
├── main.js            # Electron main process
├── package.json       # Dependencies
└── README.md          # This file
```

## Tech Stack

- Electron
- HTML/CSS/JavaScript (Vanilla)
- LocalStorage for data persistence
