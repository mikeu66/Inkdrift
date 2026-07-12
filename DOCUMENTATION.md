# To-Do Application - Complete Technical Documentation

## Overview

This is a desktop To-Do application built with **Electron** that includes AI-powered brainstorming capabilities via the **Claude API**. It features a modern dark/light theme UI, task management with stages, subtasks, priorities, drag-and-drop functionality, and a project planning workflow.

---

## Project Structure

```
To-do-app/
├── package.json          # Project configuration and dependencies
├── main.js               # Electron main process
├── preload.js            # Secure bridge between main and renderer
├── index.html            # Application UI structure
├── app.js                # Frontend application logic
├── styles.css            # Complete styling with theming
└── logo.png              # Application icon
```

---

## Dependencies

**package.json**
```json
{
  "name": "todo-app",
  "version": "1.0.0",
  "main": "main.js",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0"
  },
  "devDependencies": {
    "electron": "^39.2.7",
    "electron-builder": "^26.4.0"
  },
  "scripts": {
    "start": "electron .",
    "build": "electron-builder"
  }
}
```

Also requires `dotenv` (loaded in main.js) for environment variable management.

---

## Main Process (main.js)

### Initialization

**Claude Client Setup (lines 1-24)**
- Loads environment variables from `.env` file using `dotenv`
- Conditionally initializes the Anthropic client if `ANTHROPIC_API_KEY` is present
- Handles SDK loading failures gracefully

**Storage Path (lines 25-29)**
```javascript
const getStoragePath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'todos.json');
};
```
- Stores todos in the OS-specific user data directory

### Data Validation

**validateTodos(todos) - lines 31-65**
- Validates the todos array structure
- Checks each todo object for required fields:
  - `text` (string, max 10000 chars)
  - `completed` (boolean)
  - `notes` (optional string, max 50000 chars)
- Throws descriptive errors for invalid data

### IPC Handlers (setupIpcHandlers - lines 67-310)

#### 1. save-todos (lines 70-91)
- Validates input todos
- Creates storage directory if needed
- Writes todos as JSON to file

#### 2. load-todos (lines 94-115)
- Reads todos from storage file
- Returns empty array if file doesn't exist
- Validates loaded data before returning

#### 3. get-app-version (lines 117-120)
- Returns the application version

#### 4. export-todos (lines 123-160)
- Shows native save dialog
- Creates export data with metadata (version, exportDate, appVersion)
- Writes to user-selected location

#### 5. import-todos (lines 163-226)
- Shows native open dialog
- Enforces 10MB file size limit
- Supports both legacy (plain array) and new format (with metadata)
- Returns structured result with success/error info

#### 6. call-claude (lines 229-269)
- Calls Claude API with provided system prompt and messages
- Configurable model, max_tokens, and temperature
- Returns success/error status with response text

#### 7. check-claude-available (lines 272-277)
- Returns availability status and whether API key is set

#### 8. save-brainstorm-file (lines 280-309)
- Saves brainstorm markdown to user-selected file
- Shows save dialog with markdown file filter

### Window Creation (createWindow - lines 312-340)

**Security Configuration:**
```javascript
webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: path.join(__dirname, 'preload.js'),
    webSecurity: true,
    allowRunningInsecureContent: false
}
```
- Window size: 800x600
- Dark background color: `#1a1a1a`
- DevTools only enabled in development mode

### Application Lifecycle (lines 342-359)
- Sets up IPC handlers on ready
- Creates window on activation (macOS)
- Quits on all windows closed (except macOS)

---

## Preload Script (preload.js)

Exposes secure IPC methods via `contextBridge`:

**electronAPI object:**

| Method | Purpose | Validation |
|--------|---------|------------|
| `saveTodos(todos)` | Save todos array | Array check, 10MB size limit |
| `loadTodos()` | Load todos from file | None |
| `getAppVersion()` | Get app version | None |
| `exportTodos(todos)` | Export to file | Array check |
| `importTodos()` | Import from file | None |
| `callClaude(params)` | Call Claude API | Object, systemPrompt string, messages array |
| `checkClaudeAvailable()` | Check API status | None |
| `saveBrainstormFile(content, filename)` | Save markdown file | String check |

---

## Frontend Application (app.js)

### State Management (lines 1-29)

```javascript
let appState = {
    todos: [],                    // All todo items
    currentView: 'list',          // Current view name
    currentTodoId: null,          // Selected todo for detail view
    editingId: null,              // Currently editing todo
    theme: 'dark',                // Current theme
    brainstorm: {
        active: false,
        conversation: [],         // Chat messages
        generatedMarkdown: null,
        isProcessing: false,
        showPreview: false
    }
};
```

**Constants:**
- `STAGES`: `['brainstorm', 'planning', 'development', 'refinement', 'testing', 'done']`
- `THIRTY_DAYS_MS`: 30 days in milliseconds for trash auto-cleanup

### Todo Object Structure

```javascript
{
    id: string,              // UUID
    text: string,            // Task name
    notes: string,           // Planning notes
    subtasks: Array,         // Array of subtask objects
    completed: boolean,      // Completion status
    inProgress: boolean,     // In-progress flag
    priority: string,        // 'high' | 'medium' | 'low'
    stage: string,           // One of STAGES
    deletedAt: string|null,  // ISO date if trashed
    order: number,           // Sort order
    createdAt: number,       // Timestamp
    brainstormResult: string,// Generated project plan markdown
    actionItems: Array       // Generated action items
}
```

### Subtask Object Structure

```javascript
{
    id: string,
    text: string,
    completed: boolean,
    createdAt: number
}
```

### Action Item Object Structure

```javascript
{
    id: string,
    text: string,
    hoursNeeded: number,
    completed: boolean,
    order: number,
    elaboration: string,     // AI-generated details
    isExpanded: boolean
}
```

---

### Backend Integration Functions (lines 32-116)

#### loadTodos() - lines 33-56
- Loads todos via IPC
- Migrates old todos without IDs by generating UUIDs
- Auto-saves if migration occurred

#### saveTodos() - lines 58-65
- Saves todos via IPC
- Shows error toast on failure

#### exportTodos() - lines 67-78
- Filters out deleted todos before export

#### importTodos() - lines 80-116
- Ensures unique IDs for imported todos
- Prompts user to merge or replace existing todos

---

### Theme Management (lines 118-148)

#### loadTheme()
- Loads from localStorage, defaults to 'dark'

#### applyTheme(theme)
- Sets `data-theme` attribute on `documentElement`

#### updateThemeToggleIcon(theme)
- Shows moon (🌙) for dark, sun (☀️) for light

#### toggleTheme()
- Switches between themes, saves to localStorage

---

### Utility Functions (lines 150-216)

#### generateUUID()
- Creates RFC 4122 v4 compliant UUIDs

#### getNextOrder()
- Returns max order + 1 for new todos

#### formatTimeSince(timestamp)
- Human-readable time display ("Just now", "2 hours ago", "5 days ago")

#### cleanupOldTrash()
- Removes items deleted more than 30 days ago

#### getPriorityValue(priority)
- Maps priority to numeric value (high=3, medium=2, low=1)

#### findTodoById(id)
- Finds todo by ID in state

#### showToast(message, type)
- Displays notification with auto-dismiss after 3 seconds
- Types: 'info', 'success', 'error', 'warning'

---

### Rendering System (lines 218-256)

#### render()
Main render function:
- Hides all views
- Shows current view based on `appState.currentView`
- Calls appropriate render function:
  - `'list'` → `renderListView()`
  - `'detail'` → `renderDetailView()`
  - `'completed'` → `renderCompletedView()`
  - `'trash'` → `renderTrashView()`
  - `'brainstorm'` → `renderBrainstormView()`

---

### List View (lines 258-381)

#### renderListView() - lines 261-295
- Sets up drop zones for drag-and-drop
- Filters active (not completed, not deleted) todos
- Sorts by priority then order
- Separates into in-progress and regular lists

#### createTodoElement(todo) - lines 297-381
Creates list item with:
- Checkbox for completion toggle
- Priority indicator (colored dot: red high, yellow medium, green low)
- Text (clickable to navigate to detail)
- Stage dots (6 dots showing progress through stages)
- Delete button
- Drag event handlers

---

### Task Management (lines 383-448)

#### addTodo() - lines 386-420
- Validates text (required, max 10000 chars)
- Creates new todo with default values
- Adds to state and saves

#### toggleComplete(id) - lines 422-429
- Toggles completed status

#### deleteTodo(id) - lines 431-439
- Soft delete: sets `deletedAt` timestamp
- Shows "moved to trash" toast

#### updateTodo(id, updates) - lines 441-448
- Merges updates into existing todo

---

### Drag and Drop (lines 450-498)

#### handleDragStart(e)
- Sets dragged ID, adds visual class

#### handleDragEnd(e)
- Removes dragging class, cleans up drop zones

#### setupDropZone(element, isInProgress)
- Configures element as drop target
- Updates todo's `inProgress` status on drop
- Visual feedback during drag

---

### Detail View (lines 500-603)

#### navigateToDetail(id)
- Sets view to 'detail' and current todo ID

#### renderDetailView() - lines 510-573
Displays:
- Task title
- Priority selector
- In-progress checkbox
- Notes textarea with character count
- Stage progress bar (clickable to change stage)
- Subtasks section
- Brainstorm button (only in brainstorm stage)
- Planning result section (only in planning stage with result)
- Action items section (only in planning stage)

#### renderStageProgress(currentStage) - lines 576-596
- Updates visual state of stage circles and connectors
- Completed stages: green
- Active stage: blue with glow
- Future stages: gray

#### updateCharCount()
- Updates character count display

---

### Subtasks Management (lines 604-712)

#### renderSubtasks()
- Renders subtasks list or empty message

#### createSubtaskElement(subtask, index)
Creates subtask item with:
- Checkbox
- Text
- Delete button (×)

#### addSubtask() - lines 660-693
- Validates text (required, max 500 chars)
- Creates subtask with UUID

#### toggleSubtask(index)
- Toggles subtask completion

#### deleteSubtask(index)
- Removes subtask from array

---

### Action Items Management (lines 714-1051)

#### ACTION_ITEMS_PROMPT
- System prompt for Claude to generate action items

#### generateActionItems() - lines 726-781
- Calls Claude API with project plan
- Parses JSON response (handles markdown code blocks)
- Creates action items with structure:
  ```javascript
  { id, text, hoursNeeded, completed, order }
  ```

#### renderActionItems() - lines 783-810
- Renders sorted action items or empty message

#### createActionItemElement(item, index) - lines 812-908
Creates item with:
- Checkbox for completion
- Order number
- Editable text input
- Hours input
- Elaborate button
- Delete button
- Collapsible elaboration area

#### elaborateActionItem(id, btn, elaborationArea) - lines 926-1012
- If expanded with elaboration: collapse
- If collapsed with elaboration: expand
- Otherwise: generate new elaboration via Claude API
- Uses structured markdown format:
  - Summary
  - Key Considerations
  - Optional: Prerequisites, Watch Out For

#### renderElaborationMarkdown(text)
- Renders markdown or falls back to basic formatting

#### updateActionItem(id, updates)
- Merges updates into action item

#### deleteActionItem(id)
- Removes with confirmation, reorders remaining

#### toggleActionItemComplete(id)
- Toggles completion status

---

### AI Markdown Export (lines 1053-1122)

#### exportToMarkdown() - lines 1056-1101
Generates markdown with:
- Task title
- Priority with emoji
- Stage name
- Status
- Created date
- Subtasks (if any) with checkboxes
- Notes (if any)
- AI Context section with progress info

#### copyToClipboard(text)
- Copies to clipboard with fallback for older browsers

---

### Completed View (lines 1124-1186)

#### renderCompletedView()
- Filters completed, non-deleted todos

#### createCompletedElement(todo)
Creates item with:
- Strikethrough text
- "Uncomplete" button
- "Delete" button (moves to trash)

---

### Trash View (lines 1188-1278)

#### renderTrashView()
- Filters todos with `deletedAt`

#### createTrashElement(todo)
Creates item with:
- Task text
- Time since deletion
- "Restore" button
- "Delete Forever" button

#### permanentlyDeleteTodo(id)
- Removes from array entirely

#### emptyTrash()
- Permanently deletes all trashed items with confirmation

---

### Navigation (lines 1280-1286)

#### navigateToView(viewName)
- Sets current view and re-renders

---

### Brainstorm View (lines 1288-1630)

#### BRAINSTORM_PROMPT - lines 1293-1313
System prompt for conversational brainstorming:
- Asks ONE question per response
- Natural conversation style
- Explores: goals, scope, tech stack, phases, risks

#### navigateToBrainstorm(todoId, preserveConversation) - lines 1315-1371
- Resets or preserves brainstorm state
- Pre-fills conversation with task context (name, notes, subtasks)
- Starts AI conversation if context provided

#### showEditPlanDialog() - lines 1373-1390
- Shows dialog to continue existing chat or start fresh

#### renderBrainstormView() - lines 1392-1421
- Shows either chat container or preview container
- Updates button states based on processing status

#### renderBrainstormChat() - lines 1424-1445
- Renders welcome message or conversation history
- Auto-scrolls to bottom

#### handleBrainstormSubmit() - lines 1447-1464
- Adds user message to conversation
- Triggers AI response

#### processBrainstormMessage() - lines 1466-1503
- Sends conversation to Claude API
- Appends response to conversation

#### generateBrainstormPlan() - lines 1505-1557
- Formats conversation into text
- Generates project plan via Claude API
- Shows preview on success

#### renderBrainstormPreview()
- Sets markdown in editor, renders preview

#### updateBrainstormPreview()
- Live preview update on editor input

#### backToWizard()
- Returns to chat view

#### saveBrainstormToTask() - lines 1594-1623
- Saves markdown to todo's `brainstormResult`
- Advances stage to 'planning'
- Returns to detail view

#### exitBrainstorm()
- Returns to detail view

---

### Event Listeners (lines 1632-1747)

On DOMContentLoaded:
1. Load theme
2. Load todos from backend
3. Clean up old trash
4. Initial render

**Registered listeners:**
- Theme toggle button
- Add button and Enter key on input
- Export/Import buttons
- Navigation buttons (Completed, Trash)
- Back buttons on all views
- Priority select change
- In-progress checkbox
- Notes input (debounced 500ms save)
- Stage item clicks
- Subtask add button and Enter key
- Export to Markdown button
- Brainstorm button
- Edit Plan button
- Generate Action Items button
- Brainstorm chat submit and Enter key
- Generate Plan button
- Preview save/back buttons
- Markdown editor live preview
- Empty Trash button

---

## HTML Structure (index.html)

### Script Dependencies
- `marked` (bundled locally from `node_modules/marked/lib/marked.umd.js`) for markdown rendering
- `lib/parse-json-array.js` for parsing AI JSON-array responses (shared with unit tests)

### Views

#### 1. List View (`#listView`)
- Header with title and theme toggle
- In Progress section header and list
- To Do section header and list
- Input section (text input + Add button)
- Navigation buttons (Completed)
- Export/Import section
- Trash icon button

#### 2. Detail View (`#detailView`)
- Back button and title
- Stage progress bar (6 stages with labels)
- Priority dropdown
- In-progress checkbox
- Notes textarea with character count
- Subtasks section with input and list
- Export to Markdown button
- Brainstorm button (conditional)
- Planning result section (conditional)
- Action items section (conditional)

#### 3. Completed View (`#completedView`)
- Back button and title
- Completed tasks list
- Empty state message

#### 4. Trash View (`#trashView`)
- Back button, title, Empty Trash button
- Info message about 30-day auto-delete
- Trash list
- Empty state message

#### 5. Brainstorm View (`#brainstormView`)
- Back button and title
- Chat container with messages area and input
- Submit and Generate Plan buttons
- Preview container with split editor/preview
- Save & Continue / Back to Chat buttons
- Loading overlay

#### 6. Toast Container (`#toastContainer`)
- Fixed position for notifications

---

## CSS Styling (styles.css) - 2587 lines

### CSS Variables (lines 1-117)

**Dark Theme (default):**
- Primary background: `#070E1A` (deep navy)
- Secondary: `#0F1D33`
- Primary accent: `#2B6FFF` (blue)
- Success: `#1F7A6B` (teal)
- Warning: `#B45309` (amber)
- Error: `#8B1E2D` (crimson)
- Text primary: `#F8FAFC`

**Light Theme:**
- Primary background: `#C8D4E1`
- Primary accent: `#4F7FFF`
- Uses gradients and frosted glass effects

### Key Visual Features

#### 1. Animated Gradients
- `gradientShift` animation on backgrounds
- Gradient text on headings
- Hover glow effects

#### 2. Glass Morphism
- `backdrop-filter: blur()` on containers
- Subtle transparency layers
- Inner glow borders

#### 3. Stage Progress Visualization
- Circles with connectors
- Active: blue glow
- Completed: green
- Clickable with hover/active states

#### 4. Priority Indicators
- High: Red (`#8B1E2D`) with glow
- Medium: Amber (`#B45309`)
- Low: Teal (`#1F7A6B`)

#### 5. Drag & Drop
- `.dragging` class reduces opacity
- `.drag-over` highlights drop zones

#### 6. Toast Notifications
- Slide-in animation from right
- Color-coded borders by type
- Auto-dismiss animation

#### 7. Brainstorm UI
- Chat bubble styling (user: blue right-aligned, assistant: gray left-aligned)
- Split markdown editor/preview
- Loading spinner overlay
- Purple accent for AI features

---

## Data Persistence

- **Location**: OS user data directory (`app.getPath('userData')`)
- **File**: `todos.json`
- **Format**: JSON array with optional migration support

**Export format:**
```json
{
  "version": "1.0.0",
  "exportDate": "2024-01-15T10:30:00.000Z",
  "appVersion": "1.0.0",
  "todos": [...]
}
```

---

## Security Features

1. **Context Isolation**: Renderer cannot access Node.js directly
2. **Sandbox Mode**: Additional process isolation
3. **Preload Validation**: Input validation before IPC
4. **File Size Limits**: 10MB max for todos and imports
5. **Text Length Limits**: 10000 chars for tasks, 50000 for notes, 500 for subtasks
6. **No Remote Content**: Local file loading only
7. **Web Security Enabled**: Prevents mixed content

---

## AI Integration

**Model**: `claude-3-haiku-20240307`

**Features:**
1. **Brainstorming Chat**: Conversational project planning
2. **Plan Generation**: Structured markdown from conversation
3. **Action Items**: JSON array of tasks from plan
4. **Elaboration**: Detailed breakdown of individual action items

**Configuration:**
- Max tokens: 2048 (4096 for plans)
- Temperature: 0.5-1.0 depending on use case

---

## Running the Application

1. Create `.env` file with `ANTHROPIC_API_KEY=your-key`
2. `npm install`
3. `npm start`

**Building:**
```bash
npm run build
```
(uses electron-builder)

---

## Complete Function Reference

### main.js Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `getStoragePath()` | 26-29 | Returns path to todos.json in user data directory |
| `validateTodos(todos)` | 32-65 | Validates todo array structure and content |
| `setupIpcHandlers()` | 68-310 | Registers all IPC handlers for main process |
| `createWindow()` | 312-340 | Creates the main application window with security settings |

### preload.js Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `saveTodos(todos)` | 7-20 | Validates and saves todos via IPC |
| `loadTodos()` | 22-24 | Loads todos via IPC |
| `getAppVersion()` | 27-29 | Gets app version via IPC |
| `exportTodos(todos)` | 32-37 | Exports todos via IPC |
| `importTodos()` | 39-41 | Imports todos via IPC |
| `callClaude(params)` | 44-56 | Calls Claude API via IPC |
| `checkClaudeAvailable()` | 58-60 | Checks Claude availability via IPC |
| `saveBrainstormFile(content, suggestedFilename)` | 62-67 | Saves brainstorm file via IPC |

### app.js Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `loadTodos()` | 33-56 | Loads todos from backend, migrates old data |
| `saveTodos()` | 58-65 | Saves todos to backend |
| `exportTodos()` | 67-78 | Exports active todos to file |
| `importTodos()` | 80-116 | Imports todos from file with merge option |
| `loadTheme()` | 121-125 | Loads theme from localStorage |
| `applyTheme(theme)` | 127-134 | Applies theme to document |
| `updateThemeToggleIcon(theme)` | 136-141 | Updates theme toggle button icon |
| `toggleTheme()` | 143-148 | Toggles between dark and light themes |
| `generateUUID()` | 153-159 | Generates RFC 4122 v4 UUID |
| `getNextOrder()` | 161-164 | Gets next order number for new todos |
| `formatTimeSince(timestamp)` | 166-175 | Formats time since timestamp as human readable |
| `cleanupOldTrash()` | 177-192 | Removes trash items older than 30 days |
| `getPriorityValue(priority)` | 194-197 | Converts priority string to numeric value |
| `findTodoById(id)` | 199-201 | Finds todo by ID in state |
| `showToast(message, type)` | 203-216 | Shows toast notification |
| `render()` | 221-245 | Main render function for current view |
| `updateNavButtons(activeView)` | 247-256 | Updates navigation button active states |
| `renderListView()` | 261-295 | Renders the main list view |
| `createTodoElement(todo)` | 297-381 | Creates DOM element for a todo item |
| `addTodo()` | 386-420 | Adds a new todo |
| `toggleComplete(id)` | 422-429 | Toggles todo completion status |
| `deleteTodo(id)` | 431-439 | Soft deletes a todo (moves to trash) |
| `updateTodo(id, updates)` | 441-448 | Updates todo with new values |
| `handleDragStart(e)` | 455-459 | Handles drag start event |
| `handleDragEnd(e)` | 461-464 | Handles drag end event |
| `setupDropZone(element, isInProgress)` | 466-492 | Sets up drop zone for drag and drop |
| `cleanupDropZones()` | 494-498 | Removes drag-over class from all elements |
| `navigateToDetail(id)` | 503-508 | Navigates to detail view for a todo |
| `renderDetailView()` | 510-573 | Renders the detail view |
| `renderStageProgress(currentStage)` | 576-596 | Renders stage progress visualization |
| `updateCharCount()` | 598-602 | Updates character count display |
| `renderSubtasks()` | 607-631 | Renders subtasks list |
| `createSubtaskElement(subtask, index)` | 633-658 | Creates DOM element for a subtask |
| `addSubtask()` | 660-693 | Adds a new subtask |
| `toggleSubtask(index)` | 695-702 | Toggles subtask completion |
| `deleteSubtask(index)` | 704-712 | Deletes a subtask |
| `generateActionItems()` | 726-781 | Generates action items via Claude API |
| `renderActionItems()` | 783-810 | Renders action items list |
| `createActionItemElement(item, index)` | 812-908 | Creates DOM element for action item |
| `renderElaborationMarkdown(text)` | 910-924 | Renders markdown for elaboration |
| `elaborateActionItem(id, btn, elaborationArea)` | 926-1012 | Generates or toggles action item elaboration |
| `updateActionItem(id, updates)` | 1014-1023 | Updates an action item |
| `deleteActionItem(id)` | 1025-1039 | Deletes an action item |
| `toggleActionItemComplete(id)` | 1041-1051 | Toggles action item completion |
| `exportToMarkdown()` | 1056-1101 | Exports task to markdown and copies to clipboard |
| `copyToClipboard(text)` | 1103-1122 | Copies text to clipboard |
| `renderCompletedView()` | 1127-1145 | Renders completed tasks view |
| `createCompletedElement(todo)` | 1147-1186 | Creates DOM element for completed task |
| `renderTrashView()` | 1191-1209 | Renders trash view |
| `createTrashElement(todo)` | 1211-1256 | Creates DOM element for trashed task |
| `permanentlyDeleteTodo(id)` | 1258-1263 | Permanently deletes a todo |
| `emptyTrash()` | 1265-1278 | Empties all trash |
| `navigateToView(viewName)` | 1283-1286 | Navigates to a view by name |
| `navigateToBrainstorm(todoId, preserveConversation)` | 1315-1371 | Navigates to brainstorm view |
| `showEditPlanDialog()` | 1373-1390 | Shows dialog for editing existing plan |
| `renderBrainstormView()` | 1392-1421 | Renders brainstorm view |
| `renderBrainstormChat()` | 1424-1445 | Renders brainstorm chat messages |
| `handleBrainstormSubmit()` | 1447-1464 | Handles user message submission |
| `processBrainstormMessage()` | 1466-1503 | Processes brainstorm message with Claude |
| `generateBrainstormPlan()` | 1505-1557 | Generates project plan from conversation |
| `renderBrainstormPreview()` | 1559-1568 | Renders brainstorm preview |
| `updateBrainstormPreview()` | 1570-1587 | Updates markdown preview |
| `backToWizard()` | 1589-1592 | Returns to brainstorm chat from preview |
| `saveBrainstormToTask()` | 1594-1623 | Saves brainstorm result to task |
| `exitBrainstorm()` | 1625-1630 | Exits brainstorm view |

---

This documentation provides everything needed to recreate the application from scratch, including all functions, data structures, UI components, styling, and integration points.
