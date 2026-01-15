// ===================================
// STATE & CONSTANTS
// ===================================
let appState = {
    todos: [],
    currentView: 'list',
    currentTodoId: null,
    editingId: null,
    theme: 'dark',
    brainstorm: {
        active: false,
        currentSection: 1,
        sections: [
            { name: 'goal', title: 'Goal', description: 'What are you building? Describe the core problem you want to solve.', complete: false, data: null },
            { name: 'scope', title: 'Scope', description: 'What features are in scope for MVP vs future versions?', complete: false, data: null },
            { name: 'techstack', title: 'Tech Stack', description: 'What technologies will you use to build this?', complete: false, data: null },
            { name: 'phases', title: 'Phases', description: 'How will you break down the implementation into phases?', complete: false, data: null },
            { name: 'risks', title: 'Risks', description: 'What risks might affect the project and how will you mitigate them?', complete: false, data: null }
        ],
        conversations: {},
        generatedMarkdown: null,
        isProcessing: false,
        showPreview: false
    }
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
            // Ensure all todos have IDs (migration for old data)
            let needsSave = false;
            loadedTodos.forEach(todo => {
                if (!todo.id) {
                    todo.id = generateUUID();
                    needsSave = true;
                }
            });
            appState.todos = loadedTodos;
            // Save if we added any missing IDs
            if (needsSave) {
                await saveTodos();
                console.log('Migrated todos: added missing IDs');
            }
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
    } else if (appState.currentView === 'brainstorm') {
        document.getElementById('brainstormView').style.display = 'block';
        renderBrainstormView();
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
    console.log('createTodoElement - todo:', todo, 'id:', todo.id);
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''} ${todo.inProgress ? 'in-progress-item' : ''}`;
    li.draggable = true;
    li.dataset.id = todo.id;

    // Click on row to navigate to detail
    li.addEventListener('click', (e) => {
        // Don't navigate if clicking on checkbox or delete button
        if (e.target.type === 'checkbox' || e.target.classList.contains('delete-btn')) {
            return;
        }
        console.log('Row clicked - todo.id:', todo.id);
        navigateToDetail(todo.id);
    });

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
    text.addEventListener('click', () => {
        console.log('Text clicked - todo object:', JSON.stringify(todo, null, 2));
        console.log('Todo keys:', Object.keys(todo));
        navigateToDetail(todo.id);
    });

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
    console.log('navigateToDetail called with id:', id);
    appState.currentView = 'detail';
    appState.currentTodoId = id;
    render();
}

function renderDetailView() {
    console.log('renderDetailView - currentTodoId:', appState.currentTodoId);
    const todo = findTodoById(appState.currentTodoId);
    if (!todo) {
        console.log('Todo not found, navigating to list');
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

    // Brainstorm button - only show during brainstorm phase
    const brainstormBtn = document.getElementById('brainstormBtn');
    const currentStage = todo.stage || 'brainstorm';
    brainstormBtn.style.display = currentStage === 'brainstorm' ? 'block' : 'none';

    // Planning result section - show when in planning stage with brainstorm result
    const planningResultSection = document.getElementById('planningResultSection');
    const planningResultContent = document.getElementById('planningResultContent');

    if (currentStage === 'planning' && todo.brainstormResult) {
        planningResultSection.style.display = 'block';

        // Render markdown
        try {
            if (typeof marked !== 'undefined') {
                marked.setOptions({
                    breaks: true,
                    gfm: true
                });
                planningResultContent.innerHTML = marked.parse(todo.brainstormResult);
            } else {
                planningResultContent.innerHTML = `<pre>${todo.brainstormResult}</pre>`;
            }
        } catch (error) {
            planningResultContent.innerHTML = `<pre>${todo.brainstormResult}</pre>`;
        }
    } else {
        planningResultSection.style.display = 'none';
    }
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
// BRAINSTORM VIEW
// ===================================

// Section prompts for Claude
const SECTION_PROMPTS = {
    goal: `You are an expert project architect helping a developer define their project goal. Your role is to understand the core problem they're trying to solve and help them articulate a clear, comprehensive goal statement.

## CRITICAL RULE - ONE QUESTION AT A TIME:
You must ONLY ask ONE question per response. Never ask multiple questions in a single message.

## Your Objectives:
1. Understand the core problem: What problem is this project solving?
2. Identify the target users: Who will use or benefit from this project?
3. Clarify success criteria: What does success look like?

## Process:
1. Listen carefully to the user's initial description
2. Ask ONE focused clarifying question at a time if needed
3. When you have sufficient information, respond with:

CONFIRMED: [A clear, comprehensive goal statement]

The user will now provide their initial project idea. Help them refine it into a clear goal statement.`,

    scope: `You are helping define project scope by distinguishing between MVP and Production features.

## CRITICAL RULE - ONE QUESTION AT A TIME:
You must ONLY ask ONE question per response.

## Your Objectives:
1. Identify core MVP features: What's absolutely necessary for the first usable version?
2. Separate nice-to-have features: What can wait for future versions?

## When ready, confirm with:

CONFIRMED:
**MVP Scope (Phase 1):**
- [Core features]

**Production Scope (Future Phases):**
- [Enhancement features]`,

    techstack: `You are helping choose the optimal tech stack for this project.

## CRITICAL RULE - ONE QUESTION AT A TIME:
You must ONLY ask ONE question per response.

## Key Areas to Cover:
- Frontend: Framework/library, UI components, styling
- Backend: Server framework, language, API design
- Database: Type and specific database
- Infrastructure: Hosting, deployment

## When ready, confirm with:

CONFIRMED:
**Frontend:** [Technology choice and rationale]
**Backend:** [Technology choice and rationale]
**Database:** [Technology choice and rationale]
**Infrastructure:** [Technology choice and rationale]`,

    phases: `You are creating a phased implementation plan for the project.

## CRITICAL RULE - ONE QUESTION AT A TIME:
You must ONLY ask ONE question per response.

## Your Objectives:
1. Break the project into logical phases that build incrementally
2. Ensure each phase delivers value independently
3. Identify dependencies between phases

## When ready, structure the phases:

CONFIRMED:
**Phase 1: [Phase Name]**
*Objective: [What this phase achieves]*
Tasks:
- [Specific, actionable tasks]

**Phase 2: [Phase Name]**
...`,

    risks: `You are identifying potential risks and proposing mitigation strategies.

## CRITICAL RULE - ONE QUESTION AT A TIME:
You must ONLY ask ONE question per response.

## Risk Categories:
- Technical: Scalability, performance, complexity
- Resource: Time, skills, availability
- Dependency: External APIs, third-party services

## When ready, document the risks:

CONFIRMED:
**Technical Risks:**
**Risk: [Name]**
- Impact: [High/Medium/Low]
- Mitigation: [Strategy]

**Resource Risks:**
...`
};

function navigateToBrainstorm(todoId) {
    const todo = findTodoById(todoId);
    if (!todo) {
        showToast('Task not found', 'error');
        return;
    }

    // Reset brainstorm state
    appState.brainstorm = {
        active: true,
        currentSection: 1,
        sections: [
            { name: 'goal', title: 'Goal', description: 'What are you building? Describe the core problem you want to solve.', complete: false, data: null },
            { name: 'scope', title: 'Scope', description: 'What features are in scope for MVP vs future versions?', complete: false, data: null },
            { name: 'techstack', title: 'Tech Stack', description: 'What technologies will you use to build this?', complete: false, data: null },
            { name: 'phases', title: 'Phases', description: 'How will you break down the implementation into phases?', complete: false, data: null },
            { name: 'risks', title: 'Risks', description: 'What risks might affect the project and how will you mitigate them?', complete: false, data: null }
        ],
        conversations: {},
        generatedMarkdown: null,
        isProcessing: false,
        showPreview: false
    };

    // Pre-fill Goal with task name and notes
    if (todo.text || todo.notes) {
        let goalContext = `Project: ${todo.text}`;
        if (todo.notes) {
            goalContext += `\n\nNotes:\n${todo.notes}`;
        }
        appState.brainstorm.conversations[1] = [{
            role: 'user',
            content: goalContext
        }];
    }

    // Pre-fill Phases with subtasks
    if (todo.subtasks && todo.subtasks.length > 0) {
        const phasesText = 'Initial tasks/phases I have in mind:\n' + todo.subtasks.map(s => `- ${s.text}`).join('\n');
        appState.brainstorm.conversations[4] = [{
            role: 'user',
            content: phasesText
        }];
    }

    // Update title
    const titleEl = document.getElementById('brainstormTitle');
    if (titleEl) {
        titleEl.textContent = `Brainstorming: ${todo.text}`;
    }

    appState.currentView = 'brainstorm';
    render();

    // If we have pre-filled goal context, automatically send it
    if (appState.brainstorm.conversations[1]) {
        handleBrainstormSubmitAuto();
    }
}

async function handleBrainstormSubmitAuto() {
    // Automatically process pre-filled content
    await processBrainstormMessage();
}

function renderBrainstormView() {
    const bs = appState.brainstorm;

    // Show wizard or preview
    const wizardContainer = document.getElementById('bsWizardContainer');
    const previewContainer = document.getElementById('bsPreviewContainer');

    if (bs.showPreview) {
        wizardContainer.style.display = 'none';
        previewContainer.style.display = 'block';
        renderBrainstormPreview();
    } else {
        wizardContainer.style.display = 'block';
        previewContainer.style.display = 'none';
        renderBrainstormWizard();
    }
}

function renderBrainstormWizard() {
    const bs = appState.brainstorm;
    const currentSection = bs.sections[bs.currentSection - 1];

    // Update progress indicator
    document.querySelectorAll('.bs-progress-step').forEach((step, index) => {
        step.classList.remove('active', 'complete');
        if (index < bs.currentSection - 1 || bs.sections[index].complete) {
            step.classList.add('complete');
        }
        if (index === bs.currentSection - 1) {
            step.classList.add('active');
        }
    });

    // Update section header
    document.getElementById('bsSectionTitle').textContent = currentSection.title;
    document.getElementById('bsSectionDescription').textContent = currentSection.description;

    // Render chat messages
    renderBrainstormChat();

    // Update navigation buttons
    const backBtn = document.getElementById('bsBackBtn');
    const nextBtn = document.getElementById('bsNextBtn');
    const submitBtn = document.getElementById('bsSubmitBtn');

    backBtn.disabled = bs.currentSection === 1;
    nextBtn.disabled = !currentSection.complete;

    // If all sections are complete, show "Generate Plan" instead of "Next"
    const allComplete = bs.sections.every(s => s.complete);
    if (allComplete) {
        nextBtn.textContent = 'Generate Plan →';
        nextBtn.disabled = false;
    } else {
        nextBtn.textContent = 'Next →';
    }

    // Disable submit while processing
    submitBtn.disabled = bs.isProcessing;
    submitBtn.textContent = bs.isProcessing ? 'Thinking...' : 'Send';

    // Show/hide loading overlay
    const loadingOverlay = document.getElementById('bsLoadingOverlay');
    loadingOverlay.style.display = bs.isProcessing ? 'flex' : 'none';
}

function renderBrainstormChat() {
    const bs = appState.brainstorm;
    const chatContainer = document.getElementById('bsChatMessages');
    chatContainer.innerHTML = '';

    const conversation = bs.conversations[bs.currentSection] || [];

    if (conversation.length === 0) {
        // Show initial prompt
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'bs-message bs-message-system';
        welcomeMsg.textContent = `Let's work on the ${bs.sections[bs.currentSection - 1].title.toLowerCase()}. Type your thoughts below.`;
        chatContainer.appendChild(welcomeMsg);
    }

    conversation.forEach(msg => {
        const msgEl = document.createElement('div');
        msgEl.className = `bs-message bs-message-${msg.role === 'user' ? 'user' : 'assistant'}`;
        msgEl.textContent = msg.content;
        chatContainer.appendChild(msgEl);
    });

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function handleBrainstormSubmit() {
    const input = document.getElementById('bsUserInput');
    const text = input.value.trim();

    if (!text) return;

    const bs = appState.brainstorm;

    // Add user message to conversation
    if (!bs.conversations[bs.currentSection]) {
        bs.conversations[bs.currentSection] = [];
    }
    bs.conversations[bs.currentSection].push({
        role: 'user',
        content: text
    });

    input.value = '';
    renderBrainstormChat();

    await processBrainstormMessage();
}

async function processBrainstormMessage() {
    const bs = appState.brainstorm;
    bs.isProcessing = true;
    renderBrainstormWizard();

    try {
        // Check if Claude is available
        const claudeStatus = await window.electronAPI.checkClaudeAvailable();
        if (!claudeStatus.available) {
            throw new Error('Claude API not available. Please set ANTHROPIC_API_KEY environment variable.');
        }

        // Build system prompt with context from previous sections
        const currentSectionName = bs.sections[bs.currentSection - 1].name;
        let systemPrompt = SECTION_PROMPTS[currentSectionName];

        // Add context from completed sections
        const contextParts = [];
        bs.sections.forEach((section, index) => {
            if (section.complete && section.data) {
                contextParts.push(`## ${section.title}:\n${section.data}`);
            }
        });

        if (contextParts.length > 0) {
            systemPrompt += '\n\n## Context from Previous Sections:\n' + contextParts.join('\n\n');
        }

        // Get conversation messages
        const messages = bs.conversations[bs.currentSection] || [];

        // Call Claude API
        const response = await window.electronAPI.callClaude({
            systemPrompt,
            messages,
            options: {
                model: 'claude-3-haiku-20240307',
                max_tokens: 2048,
                temperature: 0.7
            }
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to get response from Claude');
        }

        // Add assistant response to conversation
        bs.conversations[bs.currentSection].push({
            role: 'assistant',
            content: response.text
        });

        // Check if response contains CONFIRMED: marker
        if (response.text.includes('CONFIRMED:')) {
            bs.sections[bs.currentSection - 1].complete = true;
            bs.sections[bs.currentSection - 1].data = response.text;

            // Show success message
            bs.conversations[bs.currentSection].push({
                role: 'system',
                content: `Section complete! You can proceed to the next section.`
            });
        }

    } catch (error) {
        console.error('Brainstorm error:', error);
        showToast(error.message, 'error');

        // Add error to conversation
        bs.conversations[bs.currentSection].push({
            role: 'system',
            content: `Error: ${error.message}`
        });
    }

    bs.isProcessing = false;
    renderBrainstormWizard();
}

function navigateBrainstormSection(direction) {
    const bs = appState.brainstorm;

    // Check if all sections are complete and we're going forward
    const allComplete = bs.sections.every(s => s.complete);
    if (direction === 1 && allComplete) {
        generateBrainstormPlan();
        return;
    }

    const newSection = bs.currentSection + direction;
    if (newSection >= 1 && newSection <= 5) {
        bs.currentSection = newSection;
        renderBrainstormWizard();
    }
}

function restartBrainstormSection() {
    const bs = appState.brainstorm;

    if (confirm('Are you sure you want to restart this section? Your conversation will be cleared.')) {
        bs.sections[bs.currentSection - 1].complete = false;
        bs.sections[bs.currentSection - 1].data = null;
        bs.conversations[bs.currentSection] = [];
        renderBrainstormWizard();
    }
}

async function generateBrainstormPlan() {
    const bs = appState.brainstorm;
    bs.isProcessing = true;
    renderBrainstormWizard();

    try {
        const claudeStatus = await window.electronAPI.checkClaudeAvailable();
        if (!claudeStatus.available) {
            throw new Error('Claude API not available.');
        }

        // Build comprehensive prompt for final plan
        const systemPrompt = `You are an expert technical writer. Generate a comprehensive, well-structured project plan in markdown format based on the brainstorming session data.

Generate a markdown document with the following structure:
# [Project Name]
## Executive Summary
## Goal
## Scope (MVP vs Production)
## Technical Architecture
## Implementation Phases
## Risk Management
## Success Criteria
## Next Steps

Make it actionable, clear, and optimized for an AI coding assistant to understand.`;

        // Compile all section data
        let allContext = 'Here is the brainstorming session data:\n\n';
        bs.sections.forEach(section => {
            if (section.data) {
                allContext += `### ${section.title}:\n${section.data}\n\n`;
            }
        });

        const response = await window.electronAPI.callClaude({
            systemPrompt,
            messages: [{ role: 'user', content: allContext }],
            options: {
                model: 'claude-3-haiku-20240307',
                max_tokens: 4096,
                temperature: 0.7
            }
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to generate plan');
        }

        bs.generatedMarkdown = response.text;
        bs.showPreview = true;
        bs.isProcessing = false;
        renderBrainstormView();

    } catch (error) {
        console.error('Plan generation error:', error);
        showToast(error.message, 'error');
        bs.isProcessing = false;
        renderBrainstormWizard();
    }
}

function renderBrainstormPreview() {
    const bs = appState.brainstorm;

    // Set markdown in editor
    const editor = document.getElementById('bsMarkdownEditor');
    editor.value = bs.generatedMarkdown || '';

    // Render preview
    updateBrainstormPreview();
}

function updateBrainstormPreview() {
    const editor = document.getElementById('bsMarkdownEditor');
    const preview = document.getElementById('bsMarkdownPreview');

    try {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            preview.innerHTML = marked.parse(editor.value);
        } else {
            preview.innerHTML = '<p>Markdown preview not available</p>';
        }
    } catch (error) {
        preview.innerHTML = `<p>Error rendering markdown: ${error.message}</p>`;
    }
}

function backToWizard() {
    appState.brainstorm.showPreview = false;
    renderBrainstormView();
}

async function exportAndSaveBrainstorm() {
    const bs = appState.brainstorm;
    const todo = findTodoById(appState.currentTodoId);

    const editor = document.getElementById('bsMarkdownEditor');
    const markdown = editor.value;

    try {
        // Generate filename
        const safeName = (todo?.text || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase().substring(0, 30);
        const filename = `${safeName}-plan-${new Date().toISOString().split('T')[0]}.md`;

        // Export to file
        const result = await window.electronAPI.saveBrainstormFile(markdown, filename);

        if (result.success) {
            showToast('Project plan exported successfully', 'success');

            // Save result to todo
            if (todo) {
                todo.brainstormResult = markdown;
                todo.stage = 'planning';
                await saveTodos();
            }

            // Return to detail view
            exitBrainstorm();
        } else if (!result.cancelled) {
            throw new Error(result.error || 'Export failed');
        }
    } catch (error) {
        console.error('Export error:', error);
        showToast(error.message, 'error');
    }
}

function exitBrainstorm() {
    appState.brainstorm.active = false;
    appState.brainstorm.showPreview = false;
    appState.currentView = 'detail';
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
            console.log('Stage clicked:', STAGES[index], 'currentTodoId:', appState.currentTodoId);
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

    // Brainstorm button
    document.getElementById('brainstormBtn').addEventListener('click', () => {
        navigateToBrainstorm(appState.currentTodoId);
    });

    // Edit Plan button (in detail view for planning stage)
    document.getElementById('editPlanBtn').addEventListener('click', () => {
        navigateToBrainstorm(appState.currentTodoId);
    });

    // Brainstorm View event listeners
    document.getElementById('backBtnBrainstorm').addEventListener('click', exitBrainstorm);

    document.getElementById('bsSubmitBtn').addEventListener('click', handleBrainstormSubmit);
    document.getElementById('bsUserInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleBrainstormSubmit();
        }
    });

    document.getElementById('bsBackBtn').addEventListener('click', () => navigateBrainstormSection(-1));
    document.getElementById('bsNextBtn').addEventListener('click', () => navigateBrainstormSection(1));
    document.getElementById('bsRestartBtn').addEventListener('click', restartBrainstormSection);

    // Progress step click handlers
    document.querySelectorAll('.bs-progress-step').forEach((step, index) => {
        step.addEventListener('click', () => {
            const bs = appState.brainstorm;
            // Only allow clicking on completed sections or the next section
            if (index < bs.currentSection || bs.sections[index].complete || index === bs.currentSection - 1) {
                bs.currentSection = index + 1;
                renderBrainstormWizard();
            }
        });
    });

    // Preview actions
    document.getElementById('bsExportBtn').addEventListener('click', exportAndSaveBrainstorm);
    document.getElementById('bsBackToWizardBtn').addEventListener('click', backToWizard);

    // Live preview update
    document.getElementById('bsMarkdownEditor').addEventListener('input', updateBrainstormPreview);

    // Completed View
    document.getElementById('backBtnCompleted').addEventListener('click', () => navigateToView('list'));

    // Trash View
    document.getElementById('backBtnTrash').addEventListener('click', () => navigateToView('list'));
    document.getElementById('emptyTrashBtn').addEventListener('click', emptyTrash);
});
