// ===================================
// STATE & CONSTANTS
// ===================================
let appState = {
    todos: [],
    currentView: 'list',
    currentTodoId: null,
    editingId: null,
    theme: 'dark'
};

const STAGES = ['brainstorm', 'planning', 'development', 'refinement', 'testing', 'done'];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ===================================
// BACKEND INTEGRATION
// ===================================
async function loadTodos() {
    try {
        const loadedTodos = await window.electronAPI.loadTodos();
        if (loadedTodos && Array.isArray(loadedTodos)) {
            appState.todos = loadedTodos;
        }
    } catch (error) {
        console.error('Failed to load todos:', error);
        showToast('Failed to load tasks', 'error');
    }
}

async function saveTodos() {
    try {
        await window.electronAPI.saveTodos(appState.todos);
    } catch (error) {
        console.error('Failed to save todos:', error);
        showToast('Failed to save tasks', 'error');
    }
}

async function exportTodos() {
    try {
        const activeTodos = appState.todos.filter(t => !t.deletedAt);
        const result = await window.electronAPI.exportTodos(activeTodos);
        if (result.success) {
            showToast('Tasks exported successfully', 'success');
        }
    } catch (error) {
        console.error('Failed to export todos:', error);
        showToast('Failed to export tasks', 'error');
    }
}

async function importTodos() {
    try {
        const result = await window.electronAPI.importTodos();
        if (result.success) {
            // Merge imported todos with existing
            const imported = result.todos;

            // Ensure all imported tasks have valid unique IDs
            const allExistingIds = new Set(appState.todos.map(t => t.id));
            imported.forEach(task => {
                // If task doesn't have an ID or has a duplicate ID, generate a new one
                if (!task.id || allExistingIds.has(task.id)) {
                    task.id = generateUUID();
                }
                allExistingIds.add(task.id);
            });

            // Ask user if they want to merge or replace
            const shouldMerge = confirm(`Import ${result.count} tasks. Do you want to merge with existing tasks?\n\nOK = Merge\nCancel = Replace all`);

            if (shouldMerge) {
                // Merge: Add all imported todos (IDs are now guaranteed unique)
                appState.todos = [...appState.todos, ...imported];
            } else {
                // Replace
                appState.todos = imported;
            }

            await saveTodos();
            render();
            showToast(`Imported ${result.count} tasks`, 'success');
        }
    } catch (error) {
        console.error('Failed to import todos:', error);
        showToast('Failed to import tasks', 'error');
    }
}

// ===================================
// THEME MANAGEMENT
// ===================================
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    appState.theme = savedTheme;
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    updateThemeToggleIcon(theme);
}

function updateThemeToggleIcon(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
    appState.theme = newTheme;
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}

// ===================================
// UTILITY FUNCTIONS
// ===================================
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getNextOrder() {
    if (appState.todos.length === 0) return 0;
    return Math.max(...appState.todos.map(t => t.order || 0)) + 1;
}

function formatTimeSince(timestamp) {
    const ms = Date.now() - new Date(timestamp).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (days === 0 && hours === 0) return 'Just now';
    if (days === 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
}

function cleanupOldTrash() {
    const cutoffDate = Date.now() - THIRTY_DAYS_MS;
    const beforeCount = appState.todos.filter(t => t.deletedAt).length;

    appState.todos = appState.todos.filter(todo => {
        if (!todo.deletedAt) return true;
        return new Date(todo.deletedAt).getTime() > cutoffDate;
    });

    const afterCount = appState.todos.filter(t => t.deletedAt).length;
    const removed = beforeCount - afterCount;

    if (removed > 0) {
        console.log(`Auto-deleted ${removed} old trash items`);
    }
}

function getPriorityValue(priority) {
    const priorityMap = { 'high': 3, 'medium': 2, 'low': 1 };
    return priorityMap[priority] || 2;
}

function findTodoById(id) {
    return appState.todos.find(t => t.id === id);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
}

// ===================================
// MAIN RENDER FUNCTION
// ===================================
function render() {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');

    // Show current view
    if (appState.currentView === 'list') {
        document.getElementById('listView').style.display = 'block';
        renderListView();
        updateNavButtons('list');
    } else if (appState.currentView === 'detail') {
        document.getElementById('detailView').style.display = 'block';
        renderDetailView();
    } else if (appState.currentView === 'completed') {
        document.getElementById('completedView').style.display = 'block';
        renderCompletedView();
        updateNavButtons('completed');
    } else if (appState.currentView === 'trash') {
        document.getElementById('trashView').style.display = 'block';
        renderTrashView();
        updateNavButtons('trash');
    }
}

function updateNavButtons(activeView) {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    if (activeView === 'completed') {
        document.getElementById('viewCompletedBtn').classList.add('active');
    } else if (activeView === 'trash') {
        document.getElementById('viewTrashBtn').classList.add('active');
    }
}

// ===================================
// LIST VIEW
// ===================================
function renderListView() {
    const inProgressList = document.getElementById('inProgressList');
    const todoList = document.getElementById('todoList');
    inProgressList.innerHTML = '';
    todoList.innerHTML = '';

    // Set up drop zones
    setupDropZone(inProgressList, true);
    setupDropZone(todoList, false);

    // Filter active todos (not completed, not deleted)
    const activeTodos = appState.todos.filter(t => !t.completed && !t.deletedAt);

    // Sort by priority, then order
    const sortedTodos = activeTodos.sort((a, b) => {
        const priorityDiff = getPriorityValue(b.priority) - getPriorityValue(a.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return (a.order || 0) - (b.order || 0);
    });

    // Separate in-progress and regular todos
    const inProgressTodos = sortedTodos.filter(t => t.inProgress);
    const regularTodos = sortedTodos.filter(t => !t.inProgress);

    // Render
    inProgressTodos.forEach(todo => {
        const li = createTodoElement(todo);
        inProgressList.appendChild(li);
    });

    regularTodos.forEach(todo => {
        const li = createTodoElement(todo);
        todoList.appendChild(li);
    });
}

function createTodoElement(todo) {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''} ${todo.inProgress ? 'in-progress-item' : ''}`;
    li.draggable = true;
    li.dataset.id = todo.id;

    // Drag events
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleComplete(todo.id);
    });

    // Priority indicator
    const priorityContainer = document.createElement('div');
    priorityContainer.className = 'priority-container';
    const priorityIndicator = document.createElement('span');
    priorityIndicator.className = `priority-indicator priority-${todo.priority || 'medium'}`;
    priorityIndicator.textContent = '●';
    priorityContainer.appendChild(priorityIndicator);

    // Text
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;
    text.addEventListener('click', () => navigateToDetail(todo.id));

    // Stage dots
    const stageDots = document.createElement('div');
    stageDots.className = 'stage-dots';
    const currentStageIndex = STAGES.indexOf(todo.stage || 'brainstorm');
    STAGES.forEach((stage, index) => {
        const dot = document.createElement('span');
        dot.className = 'stage-dot';
        if (index < currentStageIndex) {
            dot.classList.add('completed');
        } else if (index === currentStageIndex) {
            dot.classList.add('active');
        }
        stageDots.appendChild(dot);
    });

    // Actions
    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTodo(todo.id);
    });

    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(priorityContainer);
    li.appendChild(text);
    li.appendChild(stageDots);
    li.appendChild(actions);

    return li;
}

// ===================================
// TASK MANAGEMENT
// ===================================
function addTodo() {
    const input = document.getElementById('todoInput');
    const text = input.value.trim();

    if (!text) {
        showToast('Task name cannot be empty', 'error');
        return;
    }

    if (text.length > 10000) {
        showToast('Task name too long (max 10000 chars)', 'error');
        return;
    }

    const newTodo = {
        id: generateUUID(),
        text: text,
        notes: '',
        subtasks: [],
        completed: false,
        inProgress: false,
        priority: 'medium',
        stage: 'brainstorm',
        deletedAt: null,
        order: getNextOrder(),
        createdAt: Date.now()
    };

    appState.todos.push(newTodo);
    saveTodos();
    render();

    input.value = '';
    showToast('Task added', 'success');
}

function toggleComplete(id) {
    const todo = findTodoById(id);
    if (!todo) return;

    todo.completed = !todo.completed;
    saveTodos();
    render();
}

function deleteTodo(id) {
    const todo = findTodoById(id);
    if (!todo) return;

    todo.deletedAt = new Date().toISOString();
    saveTodos();
    render();
    showToast('Task moved to trash', 'info');
}

function updateTodo(id, updates) {
    const todo = findTodoById(id);
    if (!todo) return;

    Object.assign(todo, updates);
    saveTodos();
    render();
}

// ===================================
// DRAG AND DROP
// ===================================
let draggedId = null;

function handleDragStart(e) {
    draggedId = e.target.dataset.id;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    cleanupDropZones();
}

function setupDropZone(element, isInProgress) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', (e) => {
        if (e.target === element) {
            element.classList.remove('drag-over');
        }
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');

        if (draggedId) {
            const todo = findTodoById(draggedId);
            if (todo) {
                todo.inProgress = isInProgress;
                saveTodos();
                render();
                showToast(`Moved to ${isInProgress ? 'In Progress' : 'To Do'}`, 'success');
            }
        }
    });
}

function cleanupDropZones() {
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
}

// ===================================
// DETAIL VIEW
// ===================================
function navigateToDetail(id) {
    appState.currentView = 'detail';
    appState.currentTodoId = id;
    render();
}

function renderDetailView() {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo) {
        navigateToView('list');
        return;
    }

    // Title
    document.getElementById('detailTitle').textContent = todo.text;

    // Priority
    document.getElementById('prioritySelect').value = todo.priority || 'medium';

    // In Progress checkbox
    document.getElementById('inProgressCheckbox').checked = todo.inProgress || false;

    // Notes
    const notesInput = document.getElementById('notesInput');
    notesInput.value = todo.notes || '';
    updateCharCount();

    // Stage progress
    renderStageProgress(todo.stage || 'brainstorm');

    // Subtasks
    renderSubtasks();
}

function renderStageProgress(currentStage) {
    const currentIndex = STAGES.indexOf(currentStage);
    const stageItems = document.querySelectorAll('.stage-item');
    const connectors = document.querySelectorAll('.stage-connector');

    stageItems.forEach((item, index) => {
        item.classList.remove('active', 'completed');
        if (index < currentIndex) {
            item.classList.add('completed');
        } else if (index === currentIndex) {
            item.classList.add('active');
        }
    });

    connectors.forEach((connector, index) => {
        connector.classList.remove('completed');
        if (index < currentIndex) {
            connector.classList.add('completed');
        }
    });
}

function updateCharCount() {
    const notesInput = document.getElementById('notesInput');
    const charCount = document.getElementById('charCount');
    charCount.textContent = notesInput.value.length;
}

// ===================================
// SUBTASKS MANAGEMENT
// ===================================
function renderSubtasks() {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo) return;

    const subtasksList = document.getElementById('subtasksList');
    subtasksList.innerHTML = '';

    // Ensure subtasks array exists
    if (!todo.subtasks) {
        todo.subtasks = [];
    }

    if (todo.subtasks.length === 0) {
        const emptyMsg = document.createElement('li');
        emptyMsg.className = 'subtask-empty';
        emptyMsg.textContent = 'No subtasks yet';
        subtasksList.appendChild(emptyMsg);
        return;
    }

    todo.subtasks.forEach((subtask, index) => {
        const li = createSubtaskElement(subtask, index);
        subtasksList.appendChild(li);
    });
}

function createSubtaskElement(subtask, index) {
    const li = document.createElement('li');
    li.className = `subtask-item ${subtask.completed ? 'completed' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = subtask.completed;
    checkbox.className = 'subtask-checkbox';
    checkbox.addEventListener('change', () => toggleSubtask(index));

    const text = document.createElement('span');
    text.className = 'subtask-text';
    text.textContent = subtask.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'subtask-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete subtask';
    deleteBtn.addEventListener('click', () => deleteSubtask(index));

    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(deleteBtn);

    return li;
}

function addSubtask() {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo) return;

    const input = document.getElementById('subtaskInput');
    const text = input.value.trim();

    if (!text) {
        showToast('Subtask cannot be empty', 'error');
        return;
    }

    if (text.length > 500) {
        showToast('Subtask too long (max 500 chars)', 'error');
        return;
    }

    if (!todo.subtasks) {
        todo.subtasks = [];
    }

    const newSubtask = {
        id: generateUUID(),
        text: text,
        completed: false,
        createdAt: Date.now()
    };

    todo.subtasks.push(newSubtask);
    input.value = '';
    saveTodos();
    renderSubtasks();
    showToast('Subtask added', 'success');
}

function toggleSubtask(index) {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.subtasks || !todo.subtasks[index]) return;

    todo.subtasks[index].completed = !todo.subtasks[index].completed;
    saveTodos();
    renderSubtasks();
}

function deleteSubtask(index) {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.subtasks) return;

    todo.subtasks.splice(index, 1);
    saveTodos();
    renderSubtasks();
    showToast('Subtask deleted', 'info');
}

// ===================================
// AI MARKDOWN EXPORT
// ===================================
function exportToMarkdown() {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo) return;

    const stageName = (todo.stage || 'brainstorm').charAt(0).toUpperCase() + (todo.stage || 'brainstorm').slice(1);
    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };

    let markdown = `# ${todo.text}\n\n`;
    markdown += `**Priority:** ${priorityEmoji[todo.priority] || '🟡'} ${(todo.priority || 'medium').toUpperCase()}\n`;
    markdown += `**Stage:** ${stageName}\n`;
    markdown += `**Status:** ${todo.inProgress ? '🔄 In Progress' : todo.completed ? '✅ Completed' : '📝 To Do'}\n`;
    markdown += `**Created:** ${new Date(todo.createdAt).toLocaleDateString()}\n\n`;

    // Subtasks
    if (todo.subtasks && todo.subtasks.length > 0) {
        markdown += `## Subtasks\n\n`;
        todo.subtasks.forEach(subtask => {
            const checkbox = subtask.completed ? '[x]' : '[ ]';
            markdown += `- ${checkbox} ${subtask.text}\n`;
        });
        markdown += `\n`;
    }

    // Notes
    if (todo.notes && todo.notes.trim()) {
        markdown += `## Notes\n\n${todo.notes}\n\n`;
    }

    // Add AI context section
    markdown += `---\n\n`;
    markdown += `## AI Context\n\n`;
    markdown += `This task is part of a project management workflow. `;
    markdown += `The task is currently in the **${stageName}** stage. `;

    if (todo.subtasks && todo.subtasks.length > 0) {
        const completedCount = todo.subtasks.filter(s => s.completed).length;
        const totalCount = todo.subtasks.length;
        markdown += `Progress: ${completedCount}/${totalCount} subtasks completed. `;
    }

    markdown += `\n\nFeel free to ask questions or provide suggestions related to this task.\n`;

    // Copy to clipboard
    copyToClipboard(markdown);
    showToast('Markdown copied to clipboard!', 'success');
}

async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        showToast('Failed to copy to clipboard', 'error');
    }
}

// ===================================
// COMPLETED VIEW
// ===================================
function renderCompletedView() {
    const completedList = document.getElementById('completedList');
    const emptyState = document.getElementById('completedEmptyState');
    completedList.innerHTML = '';

    const completedTodos = appState.todos.filter(t => t.completed && !t.deletedAt);

    if (completedTodos.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    completedTodos.forEach(todo => {
        const li = createCompletedElement(todo);
        completedList.appendChild(li);
    });
}

function createCompletedElement(todo) {
    const li = document.createElement('li');
    li.className = 'completed-item';

    // Text
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;
    text.style.textDecoration = 'line-through';

    // Actions
    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    const uncompleteBtn = document.createElement('button');
    uncompleteBtn.className = 'action-btn restore-btn';
    uncompleteBtn.textContent = 'Uncomplete';
    uncompleteBtn.addEventListener('click', () => {
        todo.completed = false;
        saveTodos();
        navigateToView('list');
        showToast('Task restored', 'success');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
        deleteTodo(todo.id);
        render();
    });

    actions.appendChild(uncompleteBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(text);
    li.appendChild(actions);

    return li;
}

// ===================================
// TRASH VIEW
// ===================================
function renderTrashView() {
    const trashList = document.getElementById('trashList');
    const emptyState = document.getElementById('trashEmptyState');
    trashList.innerHTML = '';

    const trashedTodos = appState.todos.filter(t => t.deletedAt);

    if (trashedTodos.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    trashedTodos.forEach(todo => {
        const li = createTrashElement(todo);
        trashList.appendChild(li);
    });
}

function createTrashElement(todo) {
    const li = document.createElement('li');
    li.className = 'trash-item';

    // Text
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    // Time since deleted
    const timeText = document.createElement('span');
    timeText.className = 'trash-time';
    timeText.textContent = formatTimeSince(todo.deletedAt);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'action-btn restore-btn';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => {
        todo.deletedAt = null;
        saveTodos();
        render();
        showToast('Task restored', 'success');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.textContent = 'Delete Forever';
    deleteBtn.addEventListener('click', () => {
        if (confirm('Permanently delete this task? This cannot be undone.')) {
            permanentlyDeleteTodo(todo.id);
        }
    });

    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(text);
    li.appendChild(timeText);
    li.appendChild(actions);

    return li;
}

function permanentlyDeleteTodo(id) {
    appState.todos = appState.todos.filter(t => t.id !== id);
    saveTodos();
    render();
    showToast('Task permanently deleted', 'info');
}

function emptyTrash() {
    const trashedCount = appState.todos.filter(t => t.deletedAt).length;
    if (trashedCount === 0) {
        showToast('Trash is already empty', 'info');
        return;
    }

    if (confirm(`Permanently delete ${trashedCount} tasks? This cannot be undone.`)) {
        appState.todos = appState.todos.filter(t => !t.deletedAt);
        saveTodos();
        render();
        showToast(`${trashedCount} tasks permanently deleted`, 'info');
    }
}

// ===================================
// NAVIGATION
// ===================================
function navigateToView(viewName) {
    appState.currentView = viewName;
    render();
}

// ===================================
// EVENT LISTENERS
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    // Load theme
    loadTheme();

    // Load todos from backend
    await loadTodos();

    // Clean up old trash items
    cleanupOldTrash();

    // Initial render
    render();

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // List View buttons
    document.getElementById('addBtn').addEventListener('click', addTodo);
    document.getElementById('todoInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
    document.getElementById('exportBtn').addEventListener('click', exportTodos);
    document.getElementById('importBtn').addEventListener('click', importTodos);

    // Navigation buttons
    document.getElementById('viewCompletedBtn').addEventListener('click', () => navigateToView('completed'));
    document.getElementById('trashIconBtn').addEventListener('click', () => navigateToView('trash'));

    // Detail View
    document.getElementById('backBtn').addEventListener('click', () => navigateToView('list'));

    document.getElementById('prioritySelect').addEventListener('change', (e) => {
        if (appState.currentTodoId) {
            updateTodo(appState.currentTodoId, { priority: e.target.value });
        }
    });

    document.getElementById('inProgressCheckbox').addEventListener('change', (e) => {
        if (appState.currentTodoId) {
            updateTodo(appState.currentTodoId, { inProgress: e.target.checked });
        }
    });

    document.getElementById('notesInput').addEventListener('input', updateCharCount);

    // Debounced notes save
    let notesTimeout;
    document.getElementById('notesInput').addEventListener('input', (e) => {
        clearTimeout(notesTimeout);
        notesTimeout = setTimeout(() => {
            if (appState.currentTodoId) {
                updateTodo(appState.currentTodoId, { notes: e.target.value });
            }
        }, 500);
    });

    // Stage click handlers
    document.querySelectorAll('.stage-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            if (appState.currentTodoId) {
                updateTodo(appState.currentTodoId, { stage: STAGES[index] });
            }
        });
    });

    // Subtasks
    document.getElementById('addSubtaskBtn').addEventListener('click', addSubtask);
    document.getElementById('subtaskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSubtask();
    });

    // AI Markdown Export
    document.getElementById('exportMarkdownBtn').addEventListener('click', exportToMarkdown);

    // Completed View
    document.getElementById('backBtnCompleted').addEventListener('click', () => navigateToView('list'));

    // Trash View
    document.getElementById('backBtnTrash').addEventListener('click', () => navigateToView('list'));
    document.getElementById('emptyTrashBtn').addEventListener('click', emptyTrash);
});
