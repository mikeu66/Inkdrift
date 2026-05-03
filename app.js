// ===================================
// STATE & CONSTANTS
// ===================================
let appState = {
    todos: [],
    currentView: 'list',
    currentTodoId: null,
    editingId: null,
    theme: 'dark',
    claudeAvailable: false,
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
// CLAUDE AVAILABILITY
// ===================================
async function checkClaudeAvailability() {
    try {
        const status = await window.electronAPI.checkClaudeAvailable();
        appState.claudeAvailable = status.available;
        return status.available;
    } catch (error) {
        console.error('Failed to check Claude availability:', error);
        appState.claudeAvailable = false;
        return false;
    }
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
    } else if (appState.currentView === 'settings') {
        document.getElementById('settingsView').style.display = 'block';
        renderSettingsView();
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

    if (currentStage === 'brainstorm') {
        brainstormBtn.style.display = 'block';
        if (appState.claudeAvailable) {
            brainstormBtn.disabled = false;
            brainstormBtn.textContent = 'Start Brainstorming';
            brainstormBtn.classList.remove('ai-disabled');
        } else {
            brainstormBtn.disabled = true;
            brainstormBtn.textContent = 'Configure API Key in Settings to Enable';
            brainstormBtn.classList.add('ai-disabled');
        }
    } else {
        brainstormBtn.style.display = 'none';
    }

    // Planning result section - show when in planning stage with brainstorm result
    const planningResultSection = document.getElementById('planningResultSection');
    const planningResultContent = document.getElementById('planningResultContent');
    const actionItemsSection = document.getElementById('actionItemsSection');

    if (currentStage === 'planning' && todo.brainstormResult) {
        planningResultSection.style.display = 'block';
        actionItemsSection.style.display = 'block';

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

        // Render action items
        renderActionItems();
    } else {
        planningResultSection.style.display = 'none';
        actionItemsSection.style.display = 'none';
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
// ACTION ITEMS MANAGEMENT
// ===================================
const ACTION_ITEMS_PROMPT = `Based on this project plan, generate 5-10 specific action items in chronological order (when they need to be done).

For each action item provide:
1. A clear, actionable task description (what to do)
2. Estimated hours needed (be realistic, use whole numbers)

Return ONLY a valid JSON array with no other text:
[{"text": "Description here", "hoursNeeded": 4}, ...]`;

async function generateActionItems() {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.brainstormResult) {
        showToast('No project plan found', 'error');
        return;
    }

    // Show loading
    document.getElementById('actionItemsLoading').style.display = 'flex';
    document.getElementById('generateActionItemsBtn').disabled = true;

    try {
        const claudeStatus = await window.electronAPI.checkClaudeAvailable();
        if (!claudeStatus.available) {
            throw new Error('Claude API not available. Please set ANTHROPIC_API_KEY environment variable.');
        }

        const response = await window.electronAPI.callClaude({
            systemPrompt: ACTION_ITEMS_PROMPT,
            messages: [{ role: 'user', content: todo.brainstormResult }],
            options: {
                model: 'claude-3-haiku-20240307',
                max_tokens: 2048
            }
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to generate action items');
        }

        // Parse JSON response - handle potential markdown code blocks
        let jsonText = response.text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }

        const items = JSON.parse(jsonText);
        todo.actionItems = items.map((item, index) => ({
            id: generateUUID(),
            text: item.text,
            hoursNeeded: item.hoursNeeded || 1,
            completed: false,
            order: index,
            children: []
        }));

        await saveTodos();
        renderActionItems();
        showToast('Action items generated', 'success');
    } catch (error) {
        console.error('Generate action items error:', error);
        showToast(error.message, 'error');
    } finally {
        document.getElementById('actionItemsLoading').style.display = 'none';
        document.getElementById('generateActionItemsBtn').disabled = false;
    }
}

// Calculate total progress for action items (including children)
function calculateActionItemProgress(items) {
    let total = 0, completed = 0;

    function countRecursive(itemList) {
        itemList.forEach(item => {
            total++;
            if (item.completed) completed++;
            if (item.children?.length > 0) {
                countRecursive(item.children);
            }
        });
    }

    countRecursive(items);
    return { completed, total };
}

// Get progress of an item's children
function getItemChildProgress(item) {
    if (!item.children?.length) return null;
    return calculateActionItemProgress(item.children);
}

// Show notification when task is auto-completed
function showAutoCompleteNotification() {
    const notification = document.createElement('div');
    notification.className = 'auto-complete-notification';
    notification.textContent = 'Task completed (all action items done)';
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('visible'), 10);
    setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function renderActionItems() {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo) return;

    const actionItemsList = document.getElementById('actionItemsList');
    const generateBtn = document.getElementById('generateActionItemsBtn');
    actionItemsList.innerHTML = '';

    // Update generate button based on Claude availability
    if (appState.claudeAvailable) {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Action Items';
        generateBtn.classList.remove('ai-disabled');
    } else {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Configure API Key to Generate';
        generateBtn.classList.add('ai-disabled');
    }

    // Ensure actionItems array exists
    if (!todo.actionItems) {
        todo.actionItems = [];
    }

    // Update header with progress
    const headerLabel = document.querySelector('.action-items-header label');
    if (headerLabel) {
        if (todo.actionItems.length === 0) {
            headerLabel.textContent = 'Action Items:';
        } else {
            const progress = calculateActionItemProgress(todo.actionItems);
            headerLabel.textContent = `Action Items (${progress.completed}/${progress.total} completed):`;
        }
    }

    if (todo.actionItems.length === 0) {
        const emptyMsg = document.createElement('li');
        emptyMsg.className = 'action-item-empty';
        if (appState.claudeAvailable) {
            emptyMsg.textContent = 'No action items yet. Click "Generate Action Items" to create them from your project plan.';
        } else {
            emptyMsg.textContent = 'Configure your API key in Settings to generate action items from your project plan.';
        }
        actionItemsList.appendChild(emptyMsg);
        return;
    }

    // Sort by order
    const sortedItems = [...todo.actionItems].sort((a, b) => a.order - b.order);

    sortedItems.forEach((item, index) => {
        const li = createActionItemElement(item, index);
        actionItemsList.appendChild(li);
    });
}

function createActionItemElement(item, index) {
    const container = document.createElement('div');
    container.className = 'action-item-container';
    container.dataset.id = item.id;

    const li = document.createElement('li');
    li.className = `action-item ${item.completed ? 'completed' : ''}`;

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.completed;
    checkbox.className = 'action-item-checkbox';
    checkbox.addEventListener('change', () => toggleActionItemComplete(item.id));

    // Order number
    const orderNum = document.createElement('span');
    orderNum.className = 'action-item-order';
    orderNum.textContent = `${index + 1}.`;

    // Text input (editable)
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = item.text;
    textInput.className = 'action-item-text';
    textInput.addEventListener('blur', () => {
        const oldText = item.text;
        const newText = textInput.value;
        if (oldText !== newText) {
            // Clear elaboration when text changes
            updateActionItem(item.id, { text: newText, elaboration: null });
        }
    });
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            textInput.blur();
        }
    });

    // Progress badge for items with children
    let progressBadge = null;
    const childProgress = getItemChildProgress(item);
    if (childProgress) {
        progressBadge = document.createElement('span');
        progressBadge.className = 'progress-badge';
        progressBadge.textContent = `(${childProgress.completed}/${childProgress.total})`;
    }

    // Hours container
    const hoursContainer = document.createElement('div');
    hoursContainer.className = 'action-item-hours-container';

    const hoursInput = document.createElement('input');
    hoursInput.type = 'number';
    hoursInput.value = item.hoursNeeded;
    hoursInput.min = 1;
    hoursInput.max = 999;
    hoursInput.className = 'action-item-hours';
    hoursInput.addEventListener('blur', () => updateActionItem(item.id, { hoursNeeded: parseInt(hoursInput.value) || 1 }));
    hoursInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            hoursInput.blur();
        }
    });

    const hoursLabel = document.createElement('span');
    hoursLabel.className = 'action-item-hours-label';
    hoursLabel.textContent = 'hrs';

    hoursContainer.appendChild(hoursInput);
    hoursContainer.appendChild(hoursLabel);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-item-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete action item';
    deleteBtn.addEventListener('click', () => deleteActionItem(item.id));

    // Granulate button (AI break into sub-tasks)
    const granulateBtn = document.createElement('button');
    granulateBtn.className = 'action-item-granulate-btn';
    granulateBtn.textContent = '⊕';
    granulateBtn.title = 'Break into sub-tasks (AI)';
    if (!appState.claudeAvailable) {
        granulateBtn.disabled = true;
        granulateBtn.title = 'Configure API key to enable';
        granulateBtn.classList.add('ai-disabled');
    }
    granulateBtn.addEventListener('click', () => granulateActionItem(item.id, granulateBtn));

    // Promote button (create new task from action item)
    const promoteBtn = document.createElement('button');
    promoteBtn.className = 'action-item-promote-btn';
    promoteBtn.textContent = '↗';
    promoteBtn.title = 'Promote to main task';
    promoteBtn.addEventListener('click', () => promoteActionItem(item.id));

    li.appendChild(checkbox);
    li.appendChild(orderNum);
    li.appendChild(textInput);
    if (progressBadge) li.appendChild(progressBadge);
    li.appendChild(hoursContainer);
    li.appendChild(granulateBtn);
    li.appendChild(promoteBtn);
    li.appendChild(deleteBtn);

    container.appendChild(li);

    // Children sub-tasks area
    if (item.children && item.children.length > 0) {
        const childrenArea = document.createElement('div');
        childrenArea.className = 'action-item-children';

        item.children.forEach(child => {
            const childDiv = document.createElement('div');
            childDiv.className = `action-item-child ${child.completed ? 'completed' : ''}`;

            const childCheckbox = document.createElement('input');
            childCheckbox.type = 'checkbox';
            childCheckbox.checked = child.completed;
            childCheckbox.className = 'action-item-child-checkbox';
            childCheckbox.addEventListener('change', () => toggleChildComplete(item.id, child.id));

            const childText = document.createElement('span');
            childText.className = 'action-item-child-text';
            childText.textContent = child.text;

            const childDeleteBtn = document.createElement('button');
            childDeleteBtn.className = 'action-item-child-delete';
            childDeleteBtn.textContent = '×';
            childDeleteBtn.title = 'Delete sub-task';
            childDeleteBtn.addEventListener('click', () => deleteChild(item.id, child.id));

            childDiv.appendChild(childCheckbox);
            childDiv.appendChild(childText);
            childDiv.appendChild(childDeleteBtn);

            childrenArea.appendChild(childDiv);
        });

        container.appendChild(childrenArea);
    }

    return container;
}

function updateActionItem(id, updates) {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.actionItems) return;

    const item = todo.actionItems.find(i => i.id === id);
    if (!item) return;

    Object.assign(item, updates);
    saveTodos();
}

function deleteActionItem(id) {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.actionItems) return;

    if (confirm('Delete this action item?')) {
        todo.actionItems = todo.actionItems.filter(i => i.id !== id);
        // Reorder remaining items
        todo.actionItems.forEach((item, index) => {
            item.order = index;
        });
        saveTodos();
        renderActionItems();
        showToast('Action item deleted', 'info');
    }
}

function toggleActionItemComplete(id) {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.actionItems) return;

    const item = todo.actionItems.find(i => i.id === id);
    if (!item) return;

    item.completed = !item.completed;

    // Auto-complete parent task if all action items are done
    const progress = calculateActionItemProgress(todo.actionItems);
    if (progress.completed === progress.total && progress.total > 0 && !todo.completed) {
        todo.completed = true;
        showAutoCompleteNotification();
    }

    saveTodos();
    renderActionItems();
}

// Promote action item to a new main task
function promoteActionItem(id) {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.actionItems) return;

    const itemIndex = todo.actionItems.findIndex(i => i.id === id);
    if (itemIndex === -1) return;

    const item = todo.actionItems[itemIndex];

    // Create new main task
    const newTodo = {
        id: generateId(),
        text: item.text,
        completed: false,
        notes: '',
        priority: 'medium',
        createdAt: Date.now(),
        inProgress: false,
        stage: 'brainstorm',
        actionItems: item.children || []
    };

    appState.todos.push(newTodo);

    // Remove from current action items
    todo.actionItems.splice(itemIndex, 1);

    saveTodos();
    renderActionItems();
    showToast('Action item promoted to main task!', 'success');
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

// Conversational brainstorm prompt
const BRAINSTORM_PROMPT = `You're helping someone think through a project. Have a natural conversation - no rigid structure, no checklists.

CRITICAL RULE: Ask exactly ONE question per response. End your message after that single question. Do not ask follow-up questions in the same message.

BAD (never do this): "What's the main goal? And who's the target audience? Have you thought about the tech stack?"
GOOD: "What's the main goal you're trying to achieve with this project?"

Your style:
- Be conversational, not formulaic
- Follow their lead - if they want to talk about tech first, go with it
- Share thoughts and suggestions naturally
- It's fine to explore tangents if they seem useful

Things worth understanding (explore one at a time through conversation):
- What they're building and why
- Who it's for
- Technical approach
- What's MVP vs later
- Potential challenges

Keep responses concise. One question only.`;

function navigateToBrainstorm(todoId, preserveConversation = false) {
    const todo = findTodoById(todoId);
    if (!todo) {
        showToast('Task not found', 'error');
        return;
    }

    // Check if we should preserve existing conversation
    if (preserveConversation && appState.brainstorm.conversation && appState.brainstorm.conversation.length > 0) {
        // Keep existing conversation, just reset preview state
        appState.brainstorm.active = true;
        appState.brainstorm.showPreview = false;
        appState.brainstorm.isProcessing = false;
    } else {
        // Reset brainstorm state - start fresh
        appState.brainstorm = {
            active: true,
            conversation: [],
            generatedMarkdown: null,
            isProcessing: false,
            showPreview: false
        };

        // Pre-fill with task context
        let initialContext = '';
        if (todo.text) {
            initialContext = `Project: ${todo.text}`;
        }
        if (todo.notes) {
            initialContext += `\n\nNotes:\n${todo.notes}`;
        }
        if (todo.subtasks && todo.subtasks.length > 0) {
            initialContext += '\n\nInitial tasks I have in mind:\n' + todo.subtasks.map(s => `- ${s.text}`).join('\n');
        }

        if (initialContext) {
            appState.brainstorm.conversation.push({
                role: 'user',
                content: initialContext
            });
        }
    }

    // Update title
    const titleEl = document.getElementById('brainstormTitle');
    if (titleEl) {
        titleEl.textContent = `Brainstorming: ${todo.text}`;
    }

    appState.currentView = 'brainstorm';
    render();

    // If we have pre-filled context and starting fresh, start the conversation
    if (!preserveConversation && appState.brainstorm.conversation.length > 0) {
        processBrainstormMessage();
    }
}

function showEditPlanDialog() {
    const hasExistingConversation = appState.brainstorm.conversation && appState.brainstorm.conversation.length > 0;

    if (!hasExistingConversation) {
        // No existing conversation, just start fresh
        navigateToBrainstorm(appState.currentTodoId, false);
        return;
    }

    // Show dialog with options
    const choice = confirm(
        'How would you like to edit the plan?\n\n' +
        'OK = Continue existing chat\n' +
        'Cancel = Start fresh'
    );

    navigateToBrainstorm(appState.currentTodoId, choice);
}

function renderBrainstormView() {
    const bs = appState.brainstorm;

    const chatContainer = document.getElementById('bsChatContainer');
    const previewContainer = document.getElementById('bsPreviewContainer');
    const loadingOverlay = document.getElementById('bsLoadingOverlay');

    if (bs.showPreview) {
        chatContainer.style.display = 'none';
        previewContainer.style.display = 'block';
        loadingOverlay.style.display = 'none';
        renderBrainstormPreview();
    } else {
        chatContainer.style.display = 'flex';
        previewContainer.style.display = 'none';
        renderBrainstormChat();

        // Update button states
        const submitBtn = document.getElementById('bsSubmitBtn');
        const generateBtn = document.getElementById('bsGeneratePlanBtn');

        submitBtn.disabled = bs.isProcessing;
        submitBtn.textContent = bs.isProcessing ? 'Thinking...' : 'Send';

        // Enable generate plan if there's been some conversation
        generateBtn.disabled = bs.isProcessing || bs.conversation.length < 2;

        // Show/hide loading overlay
        loadingOverlay.style.display = bs.isProcessing ? 'flex' : 'none';
    }
}

function renderBrainstormChat() {
    const bs = appState.brainstorm;
    const chatContainer = document.getElementById('bsChatMessages');
    chatContainer.innerHTML = '';

    if (bs.conversation.length === 0) {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'bs-message bs-message-system';
        welcomeMsg.textContent = "What are you working on? Tell me about your project.";
        chatContainer.appendChild(welcomeMsg);
    }

    bs.conversation.forEach(msg => {
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

    bs.conversation.push({
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
    renderBrainstormView();

    try {
        const claudeStatus = await window.electronAPI.checkClaudeAvailable();
        if (!claudeStatus.available) {
            throw new Error('Claude API not available. Please set ANTHROPIC_API_KEY environment variable.');
        }

        const response = await window.electronAPI.callClaude({
            systemPrompt: BRAINSTORM_PROMPT,
            messages: bs.conversation,
            options: {
                model: 'claude-3-haiku-20240307',
                max_tokens: 2048,
                temperature: 0.5
            }
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to get response from Claude');
        }

        bs.conversation.push({
            role: 'assistant',
            content: response.text
        });

    } catch (error) {
        console.error('Brainstorm error:', error);
        showToast(error.message, 'error');
    }

    bs.isProcessing = false;
    renderBrainstormView();
}

async function generateBrainstormPlan() {
    const bs = appState.brainstorm;
    bs.isProcessing = true;
    renderBrainstormView();

    try {
        const claudeStatus = await window.electronAPI.checkClaudeAvailable();
        if (!claudeStatus.available) {
            throw new Error('Claude API not available.');
        }

        // Format conversation for the plan generator
        const conversationText = bs.conversation.map(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${msg.content}`;
        }).join('\n\n');

        const systemPrompt = `Based on this brainstorming conversation, create a project plan in markdown.

Structure it naturally based on what was discussed - don't force sections that weren't covered. Include:
- A clear summary of what's being built
- Key decisions made
- Next steps or phases if discussed
- Any risks or considerations mentioned

Keep it practical and actionable. This will be used by a developer (possibly with AI assistance) to build the project.`;

        const response = await window.electronAPI.callClaude({
            systemPrompt,
            messages: [{ role: 'user', content: conversationText }],
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
        renderBrainstormView();
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

async function saveBrainstormToTask() {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo) {
        showToast('Task not found', 'error');
        return;
    }

    const editor = document.getElementById('bsMarkdownEditor');
    const markdown = editor.value;

    if (!markdown.trim()) {
        showToast('Plan cannot be empty', 'error');
        return;
    }

    try {
        // Save result to todo
        todo.brainstormResult = markdown;
        todo.stage = 'planning';
        await saveTodos();

        showToast('Plan saved successfully', 'success');

        // Return to detail view
        exitBrainstorm();
    } catch (error) {
        console.error('Save error:', error);
        showToast('Failed to save plan', 'error');
    }
}

function exitBrainstorm() {
    appState.brainstorm.active = false;
    appState.brainstorm.showPreview = false;
    appState.currentView = 'detail';
    render();
}

// ===================================
// SETTINGS VIEW
// ===================================
async function renderSettingsView() {
    // Load current settings
    const settings = await window.electronAPI.getSettings();
    const claudeStatus = await window.electronAPI.checkClaudeAvailable();

    // Update status badge
    const statusEl = document.getElementById('apiKeyStatus');
    if (claudeStatus.available) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'api-key-status connected';
    } else {
        statusEl.textContent = 'Not configured';
        statusEl.className = 'api-key-status not-configured';
    }

    // Show/hide current key info
    const currentKeyInfo = document.getElementById('currentKeyInfo');
    const currentKeyPreview = document.getElementById('currentKeyPreview');
    const encryptionStatus = document.getElementById('encryptionStatus');
    if (settings.hasApiKey && settings.apiKeyPreview) {
        currentKeyInfo.style.display = 'flex';
        currentKeyPreview.textContent = settings.apiKeyPreview;
        // Show encryption status
        if (settings.isEncrypted) {
            encryptionStatus.textContent = '🔒 Encrypted';
            encryptionStatus.className = 'encryption-status encrypted';
        } else {
            encryptionStatus.textContent = '⚠️ Not encrypted';
            encryptionStatus.className = 'encryption-status not-encrypted';
        }
    } else {
        currentKeyInfo.style.display = 'none';
    }

    // Clear input and messages
    document.getElementById('apiKeyInput').value = '';
    hideApiKeyMessage();

    // Load app version
    try {
        const version = await window.electronAPI.getAppVersion();
        document.getElementById('appVersionDisplay').textContent = `Version: ${version}`;
    } catch (e) {
        // Ignore version errors
    }
}

function showApiKeyMessage(message, type) {
    const msgEl = document.getElementById('apiKeyMessage');
    msgEl.textContent = message;
    msgEl.className = `api-key-message ${type}`;
    msgEl.style.display = 'flex';
}

function hideApiKeyMessage() {
    const msgEl = document.getElementById('apiKeyMessage');
    msgEl.style.display = 'none';
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    const btn = document.getElementById('toggleApiKeyVisibility');
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

async function testApiKey() {
    const input = document.getElementById('apiKeyInput');
    const apiKey = input.value.trim();

    if (!apiKey) {
        showApiKeyMessage('Please enter an API key to test', 'error');
        return;
    }

    // Disable buttons during test
    const testBtn = document.getElementById('testApiKeyBtn');
    const saveBtn = document.getElementById('saveApiKeyBtn');
    testBtn.disabled = true;
    saveBtn.disabled = true;
    showApiKeyMessage('Testing API key...', 'loading');

    try {
        const result = await window.electronAPI.testApiKey(apiKey);
        if (result.valid) {
            showApiKeyMessage('API key is valid!', 'success');
        } else {
            showApiKeyMessage(`Invalid API key: ${result.error}`, 'error');
        }
    } catch (error) {
        showApiKeyMessage(`Test failed: ${error.message}`, 'error');
    } finally {
        testBtn.disabled = false;
        saveBtn.disabled = false;
    }
}

async function saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    const apiKey = input.value.trim();

    if (!apiKey) {
        showApiKeyMessage('Please enter an API key to save', 'error');
        return;
    }

    // Disable buttons during save
    const testBtn = document.getElementById('testApiKeyBtn');
    const saveBtn = document.getElementById('saveApiKeyBtn');
    testBtn.disabled = true;
    saveBtn.disabled = true;
    showApiKeyMessage('Saving API key...', 'loading');

    try {
        const result = await window.electronAPI.saveApiKey(apiKey);
        if (result.success) {
            showApiKeyMessage('API key saved successfully!', 'success');
            input.value = '';
            // Update Claude availability state
            await checkClaudeAvailability();
            // Re-render to update status
            setTimeout(() => renderSettingsView(), 1000);
        } else {
            showApiKeyMessage(`Failed to save: ${result.error}`, 'error');
        }
    } catch (error) {
        showApiKeyMessage(`Save failed: ${error.message}`, 'error');
    } finally {
        testBtn.disabled = false;
        saveBtn.disabled = false;
    }
}

async function removeApiKey() {
    if (!confirm('Are you sure you want to remove your API key? AI features will be disabled.')) {
        return;
    }

    try {
        const result = await window.electronAPI.saveApiKey(null);
        if (result.success) {
            showToast('API key removed', 'info');
            // Update Claude availability state
            await checkClaudeAvailability();
            renderSettingsView();
        } else {
            showToast('Failed to remove API key', 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

function openAnthropicConsole(e) {
    e.preventDefault();
    // Use shell.openExternal in Electron or fallback
    window.open('https://console.anthropic.com/', '_blank');
}

// ===================================
// EVENT LISTENERS
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    // Load theme
    loadTheme();

    // Check Claude API availability
    await checkClaudeAvailability();

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
    document.getElementById('editPlanBtn').addEventListener('click', showEditPlanDialog);

    // Generate Action Items button
    document.getElementById('generateActionItemsBtn').addEventListener('click', generateActionItems);

    // Brainstorm View event listeners
    document.getElementById('backBtnBrainstorm').addEventListener('click', exitBrainstorm);

    document.getElementById('bsSubmitBtn').addEventListener('click', handleBrainstormSubmit);
    document.getElementById('bsUserInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleBrainstormSubmit();
        }
    });

    document.getElementById('bsGeneratePlanBtn').addEventListener('click', generateBrainstormPlan);

    // Preview actions
    document.getElementById('bsSaveBtn').addEventListener('click', saveBrainstormToTask);
    document.getElementById('bsBackToWizardBtn').addEventListener('click', backToWizard);

    // Live preview update
    document.getElementById('bsMarkdownEditor').addEventListener('input', updateBrainstormPreview);

    // Completed View
    document.getElementById('backBtnCompleted').addEventListener('click', () => navigateToView('list'));

    // Trash View
    document.getElementById('backBtnTrash').addEventListener('click', () => navigateToView('list'));
    document.getElementById('emptyTrashBtn').addEventListener('click', emptyTrash);

    // Settings View
    document.getElementById('settingsBtn').addEventListener('click', () => navigateToView('settings'));
    document.getElementById('backBtnSettings').addEventListener('click', () => navigateToView('list'));
    document.getElementById('toggleApiKeyVisibility').addEventListener('click', toggleApiKeyVisibility);
    document.getElementById('testApiKeyBtn').addEventListener('click', testApiKey);
    document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);
    document.getElementById('removeApiKeyBtn').addEventListener('click', removeApiKey);
    document.getElementById('anthropicLink').addEventListener('click', openAnthropicConsole);

    // Manual action item add (inside AI action items section)
    document.getElementById('addManualActionItemBtn').addEventListener('click', addManualToActionItems);
    document.getElementById('manualActionItemInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addManualToActionItems();
        }
    });
});

// ===================================
// MANUAL ADD TO ACTION ITEMS
// ===================================
function addManualToActionItems() {
    const input = document.getElementById('manualActionItemInput');
    const text = input.value.trim();

    if (text === '' || !appState.currentTodoId) {
        return;
    }

    const todo = findTodoById(appState.currentTodoId);
    if (!todo) return;

    if (!todo.actionItems) {
        todo.actionItems = [];
    }

    const newItem = {
        id: generateUUID(),
        text: text,
        hoursNeeded: 1,
        completed: false,
        order: todo.actionItems.length,
        children: []
    };

    todo.actionItems.push(newItem);
    input.value = '';
    saveTodos();
    renderActionItems();
}

// ===================================
// AI GRANULATE (BREAK INTO SUB-TASKS)
// ===================================
async function granulateActionItem(id, btn) {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.actionItems) return;

    const item = todo.actionItems.find(i => i.id === id);
    if (!item) return;

    // If children already exist, confirm before regenerating
    if (item.children && item.children.length > 0) {
        if (!confirm('This item already has sub-tasks. Regenerate them?')) {
            return;
        }
    }

    // Show loading state
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    btn.classList.add('loading');

    try {
        const claudeStatus = await window.electronAPI.checkClaudeAvailable();
        if (!claudeStatus.available) {
            throw new Error('Claude API not available');
        }

        const prompt = `Break this action item into 3-5 specific, actionable sub-tasks.

Action Item: "${item.text}"
Estimated Hours: ${item.hoursNeeded}
${todo.brainstormResult ? `\nProject Context:\n${todo.brainstormResult}` : ''}

Return ONLY a valid JSON array with no other text:
[{"text": "Sub-task description here"}, ...]`;

        const response = await window.electronAPI.callClaude({
            systemPrompt: 'You are a project planning assistant. Break action items into concrete sub-tasks. Return only valid JSON.',
            messages: [{ role: 'user', content: prompt }],
            options: {
                model: 'claude-3-haiku-20240307',
                max_tokens: 1024
            }
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to generate sub-tasks');
        }

        // Parse JSON response - handle potential markdown code blocks
        let jsonText = response.text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }

        const subTasks = JSON.parse(jsonText);
        item.children = subTasks.map(st => ({
            id: generateUUID(),
            text: st.text,
            completed: false
        }));

        await saveTodos();
        renderActionItems();
        showToast('Sub-tasks generated', 'success');
    } catch (error) {
        console.error('Granulate error:', error);
        showToast(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
        btn.classList.remove('loading');
    }
}

// Toggle child sub-task completion
function toggleChildComplete(parentId, childId) {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.actionItems) return;

    const parent = todo.actionItems.find(i => i.id === parentId);
    if (!parent || !parent.children) return;

    const child = parent.children.find(c => c.id === childId);
    if (!child) return;

    child.completed = !child.completed;

    // Auto-complete parent task if all action items are done
    const progress = calculateActionItemProgress(todo.actionItems);
    if (progress.completed === progress.total && progress.total > 0 && !todo.completed) {
        todo.completed = true;
        showAutoCompleteNotification();
    }

    saveTodos();
    renderActionItems();
}

// Delete child sub-task
function deleteChild(parentId, childId) {
    const todo = findTodoById(appState.currentTodoId);
    if (!todo || !todo.actionItems) return;

    const parent = todo.actionItems.find(i => i.id === parentId);
    if (!parent || !parent.children) return;

    parent.children = parent.children.filter(c => c.id !== childId);
    saveTodos();
    renderActionItems();
}
