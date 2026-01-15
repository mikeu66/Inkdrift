# Brainstorming Integration Plan

## Overview
Connect the Brainstorming app to the main To-do app, triggered by clicking the "Start Brainstorming" button in the detail view. The brainstorming UI will appear as a new view within the same window, pre-filled with task notes (→ Goal) and subtasks (→ Phases). On completion, export the markdown to a file and store it for rendering in the planning stage.

## Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Add brainstorm view container with wizard/chat/preview UI |
| `app.js` | Add brainstorm view logic, data passing, completion handling |
| `styles.css` | Add namespaced brainstorming styles (`.bs-*` prefix) |
| `main.js` | Add IPC handler for Claude API calls |
| `preload.js` | Expose Claude API bridge to renderer |

## Files to Copy/Adapt from Brainstorming-app

| Source | Purpose |
|--------|---------|
| `src/core/PromptBuilder.js` | Prompt construction for Claude |
| `src/core/MarkdownGenerator.js` | Generate markdown from wizard data |
| `src/ui/styles.css` | Styles (will namespace with `.bs-` prefix) |

## Implementation Steps

### Step 1: Add Brainstorm View HTML
Add to `index.html` after the trash view:
- New view container `#brainstormView` with class `.view`
- Header with back button and title
- Wizard container with 5-step progress indicator
- Chat container for messages
- Input area with textarea and send button
- Preview container for markdown editing
- Loading overlay

### Step 2: Add Brainstorming Styles
Add to `styles.css`:
- Namespace all brainstorming styles with `.bs-` prefix to avoid conflicts
- Include: progress indicator, chat messages, input area, preview split view
- Dark theme consistent with existing app

### Step 3: Add IPC for Claude API
In `main.js`:
- Add `brainstorm-message` IPC handler that calls Claude API
- Pass through ANTHROPIC_API_KEY from environment

In `preload.js`:
- Expose `sendBrainstormMessage(messages, section)` method

### Step 4: Add Brainstorm View Logic in app.js

**State additions:**
```javascript
appState.brainstorm = {
    active: false,
    currentSection: 1,
    sections: [
        { name: 'goal', title: 'Goal', complete: false, data: null },
        { name: 'scope', title: 'Scope', complete: false, data: null },
        { name: 'techstack', title: 'Tech Stack', complete: false, data: null },
        { name: 'phases', title: 'Phases', complete: false, data: null },
        { name: 'risks', title: 'Risks', complete: false, data: null }
    ],
    conversations: {},  // Per-section conversation history
    generatedMarkdown: null
};
```

**Functions to add:**
- `navigateToBrainstorm(todoId)` - Initialize and show brainstorm view
- `renderBrainstormView()` - Render current wizard state
- `handleBrainstormSubmit()` - Send message to Claude, process response
- `updateBrainstormProgress()` - Update progress indicator
- `navigateBrainstormSection(direction)` - Move between sections
- `completeBrainstorm()` - Generate markdown, export, store result
- `renderBrainstormPreview(markdown)` - Show editable preview
- `exitBrainstorm(saveResult)` - Return to detail view

### Step 5: Data Passing (Notes → Goal, Subtasks → Phases)

When starting brainstorm:
```javascript
function navigateToBrainstorm(todoId) {
    const todo = findTodoById(todoId);

    // Pre-fill Goal with task notes
    if (todo.notes) {
        appState.brainstorm.sections[0].data = todo.notes;
        // Add as initial context in conversation
    }

    // Pre-fill Phases with subtasks
    if (todo.subtasks?.length) {
        const phasesText = todo.subtasks.map(s => `- ${s.text}`).join('\n');
        appState.brainstorm.sections[3].data = phasesText;
    }

    appState.currentView = 'brainstorm';
    render();
}
```

### Step 6: Completion Handling

When wizard completes:
1. Generate markdown from all section data
2. Show preview/edit screen
3. On export:
   - Save to file via dialog
   - Store markdown in `todo.brainstormResult`
   - Auto-advance stage to 'planning'
4. Return to detail view

### Step 7: Planning Stage Markdown Rendering

Add to detail view:
- When stage is 'planning' and `todo.brainstormResult` exists
- Show rendered markdown preview section
- Use marked.js library (add via CDN in index.html)
- Include "Edit Plan" button to re-enter brainstorm

### Step 8: Update render() Function

```javascript
} else if (appState.currentView === 'brainstorm') {
    document.getElementById('brainstormView').style.display = 'block';
    renderBrainstormView();
}
```

### Step 9: Wire Up Brainstorm Button

Update event listener:
```javascript
document.getElementById('brainstormBtn').addEventListener('click', () => {
    navigateToBrainstorm(appState.currentTodoId);
});
```

## Data Flow Diagram

```
Detail View (brainstorm stage)
    ↓ Click "Start Brainstorming"
Brainstorm View
    ↓ Pre-fill: notes → Goal, subtasks → Phases
5-Section Wizard (Claude AI conversation)
    ↓ All sections complete
Preview/Edit Markdown
    ↓ Click Export
Save to file + Store in todo.brainstormResult
    ↓ Auto-advance to planning stage
Detail View (planning stage)
    ↓ Render stored markdown
```

## Verification

1. Click brainstorm button from a task in brainstorm stage
2. Verify notes appear in Goal section context
3. Verify subtasks appear in Phases section context
4. Complete all 5 wizard sections with Claude
5. Verify markdown preview renders correctly
6. Export to file - verify file saved
7. Verify task advances to planning stage
8. Verify markdown renders in planning stage detail view
