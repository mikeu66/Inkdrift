let todos = [];
let editingIndex = null;
let currentView = 'list'; // 'list', 'detail', or 'completed'
let currentTodoIndex = null;

// Load todos from secure storage on startup
async function loadTodos() {
    try {
        const loadedTodos = await window.electronAPI.loadTodos();
        if (loadedTodos && Array.isArray(loadedTodos)) {
            todos = loadedTodos;
        }
    } catch (error) {
        console.error('Failed to load todos:', error);
        // Continue with empty todos array
    }
    render();
}

// Save todos to secure storage
async function saveTodos() {
    try {
        await window.electronAPI.saveTodos(todos);
    } catch (error) {
        console.error('Failed to save todos:', error);
        // You might want to show an error message to the user here
    }
}

// Main render function
function render() {
    if (currentView === 'list') {
        renderListView();
    } else if (currentView === 'detail') {
        renderDetailView();
    } else if (currentView === 'completed') {
        renderCompletedView();
    }
}

// Get priority value for sorting
function getPriorityValue(priority) {
    const priorityMap = { 'high': 3, 'medium': 2, 'low': 1 };
    return priorityMap[priority] || 2;
}

// Sort todos by priority (high to low) then by creation date
function getSortedTodos() {
    return todos.map((todo, index) => ({ todo, index }))
        .sort((a, b) => {
            const priorityDiff = getPriorityValue(b.todo.priority) - getPriorityValue(a.todo.priority);
            if (priorityDiff !== 0) return priorityDiff;
            return (a.todo.createdAt || 0) - (b.todo.createdAt || 0);
        });
}

// Render list view
function renderListView() {
    // Show list view, hide detail view
    document.getElementById('listView').style.display = 'block';
    document.getElementById('detailView').style.display = 'none';

    const inProgressList = document.getElementById('inProgressList');
    const todoList = document.getElementById('todoList');
    inProgressList.innerHTML = '';
    todoList.innerHTML = '';

    // Set up drop zones
    setupDropZone(inProgressList, true);
    setupDropZone(todoList, false);

    const sortedTodos = getSortedTodos();

    // Separate in-progress and regular todos (exclude completed from main view)
    const inProgressTodos = sortedTodos.filter(({ todo }) => todo.inProgress && !todo.completed);
    const regularTodos = sortedTodos.filter(({ todo }) => !todo.inProgress && !todo.completed);

    // Render in-progress items
    inProgressTodos.forEach(({ todo, index }) => {
        const li = createTodoElement(todo, index);
        inProgressList.appendChild(li);
    });

    // Render regular items
    regularTodos.forEach(({ todo, index }) => {
        const li = createTodoElement(todo, index);
        todoList.appendChild(li);
    });
}

// Create mini progress bar for list view
function createMiniProgressBar(currentStage) {
    const miniBar = document.createElement('div');
    miniBar.className = 'mini-progress-bar';

    const currentStageIndex = stages.indexOf(currentStage);

    stages.forEach((stage, index) => {
        // Create dot
        const dot = document.createElement('span');
        dot.className = 'mini-stage-dot';

        if (index === currentStageIndex) {
            dot.classList.add('active');
        } else if (index < currentStageIndex) {
            dot.classList.add('completed');
        }

        // Add title for hover tooltip
        dot.title = stage.charAt(0).toUpperCase() + stage.slice(1);

        miniBar.appendChild(dot);

        // Add connector between dots (except after last dot)
        if (index < stages.length - 1) {
            const connector = document.createElement('span');
            connector.className = 'mini-stage-connector';
            if (index < currentStageIndex) {
                connector.classList.add('completed');
            }
            miniBar.appendChild(connector);
        }
    });

    return miniBar;
}

// Create todo element
function createTodoElement(todo, index) {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''} ${todo.inProgress ? 'in-progress-item' : ''}`;
    li.draggable = true;
    li.dataset.index = index;

    // Drag events
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);

    // Create a wrapper for the main content (checkbox, priority, label, buttons)
    const mainContent = document.createElement('div');
    mainContent.className = 'todo-item-main';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => toggleTodo(index));

    // Check if this item is being edited
    if (editingIndex === index) {
        // Edit mode
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'edit-input';
        editInput.value = todo.text;
        editInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveEdit(index, editInput.value);
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        });

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'save-btn';
        saveBtn.addEventListener('click', () => saveEdit(index, editInput.value));

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'cancel-btn';
        cancelBtn.addEventListener('click', () => cancelEdit());

        mainContent.appendChild(checkbox);
        mainContent.appendChild(editInput);
        mainContent.appendChild(saveBtn);
        mainContent.appendChild(cancelBtn);

        // Auto-focus the input
        setTimeout(() => editInput.focus(), 0);
    } else {
        // Normal mode
        const priorityContainer = document.createElement('div');
        priorityContainer.className = 'priority-container';

        const priorityIndicator = document.createElement('span');
        priorityIndicator.className = `priority-indicator priority-${todo.priority || 'medium'}`;
        priorityIndicator.textContent = '●';
        priorityIndicator.style.cursor = 'pointer';

        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'priority-dropdown';
        dropdown.style.display = 'none';

        // Create priority options
        const priorities = [
            { value: 'high', label: '🔴 High', color: 'priority-high' },
            { value: 'medium', label: '🟡 Medium', color: 'priority-medium' },
            { value: 'low', label: '🟢 Low', color: 'priority-low' }
        ];

        priorities.forEach(priority => {
            const option = document.createElement('div');
            option.className = 'priority-option';
            option.innerHTML = `<span class="priority-indicator ${priority.color}">●</span> ${priority.value.charAt(0).toUpperCase() + priority.value.slice(1)}`;
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                changePriority(index, priority.value);
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(option);
        });

        // Toggle dropdown on priority indicator click
        priorityIndicator.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other dropdowns
            document.querySelectorAll('.priority-dropdown').forEach(d => {
                if (d !== dropdown) d.style.display = 'none';
            });
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        priorityContainer.appendChild(priorityIndicator);
        priorityContainer.appendChild(dropdown);

        const label = document.createElement('label');
        label.textContent = todo.text;
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            openDetailView(index);
        });

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-btn';
        editBtn.addEventListener('click', () => startEdit(index));

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => deleteTodo(index));

        mainContent.appendChild(checkbox);
        mainContent.appendChild(priorityContainer);
        mainContent.appendChild(label);
        mainContent.appendChild(editBtn);
        mainContent.appendChild(deleteBtn);
    }

    // Append main content to li
    li.appendChild(mainContent);

    // Create mini progress bar
    const miniProgressBar = createMiniProgressBar(todo.stage || 'brainstorm');
    li.appendChild(miniProgressBar);

    return li;
}

// Add a new todo
function addTodo() {
    const input = document.getElementById('todoInput');
    const text = input.value.trim();

    if (text === '') {
        return;
    }

    todos.push({
        text: text,
        completed: false,
        notes: '',
        priority: 'medium',
        createdAt: Date.now(),
        inProgress: false,
        stage: 'brainstorm'
    });

    input.value = '';
    saveTodos();
    render();
}

// Toggle todo completion status
function toggleTodo(index) {
    todos[index].completed = !todos[index].completed;
    saveTodos();
    render();
}

// Delete a todo
function deleteTodo(index) {
    todos.splice(index, 1);
    saveTodos();
    render();
}

// Start editing a todo
function startEdit(index) {
    editingIndex = index;
    render();
}

// Save edited todo
function saveEdit(index, newText) {
    const trimmedText = newText.trim();
    if (trimmedText === '') {
        return;
    }
    todos[index].text = trimmedText;
    editingIndex = null;
    saveTodos();
    render();
}

// Cancel editing
function cancelEdit() {
    editingIndex = null;
    render();
}

// Render detail view
function renderDetailView() {
    // Hide list view, show detail view
    document.getElementById('listView').style.display = 'none';
    document.getElementById('detailView').style.display = 'block';

    const todo = todos[currentTodoIndex];
    if (!todo) {
        backToList();
        return;
    }

    // Set the title
    document.getElementById('detailTitle').textContent = todo.text;

    // Set the priority
    const prioritySelect = document.getElementById('prioritySelect');
    prioritySelect.value = todo.priority || 'medium';

    // Auto-save priority on change
    prioritySelect.onchange = () => {
        todos[currentTodoIndex].priority = prioritySelect.value;
        saveTodos();
    };

    // Set the in-progress checkbox
    const inProgressCheckbox = document.getElementById('inProgressCheckbox');
    inProgressCheckbox.checked = todo.inProgress || false;

    // Auto-save in-progress status on change
    inProgressCheckbox.onchange = () => {
        todos[currentTodoIndex].inProgress = inProgressCheckbox.checked;
        saveTodos();
    };

    // Set the notes
    const notesInput = document.getElementById('notesInput');
    notesInput.value = todo.notes || '';

    // Auto-save notes on input
    notesInput.oninput = () => {
        todos[currentTodoIndex].notes = notesInput.value;
        saveTodos();
    };

    // Update progress bar
    updateProgressBar(todo.stage || 'brainstorm');
}

// Open detail view for a todo
function openDetailView(index) {
    currentView = 'detail';
    currentTodoIndex = index;
    render();
}

// Go back to list view
function backToList() {
    currentView = 'list';
    currentTodoIndex = null;
    render();
}

// Render completed view
function renderCompletedView() {
    // Hide other views, show completed view
    document.getElementById('listView').style.display = 'none';
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('completedView').style.display = 'block';

    const completedList = document.getElementById('completedList');
    completedList.innerHTML = '';

    const sortedTodos = getSortedTodos();
    const completedTodos = sortedTodos.filter(({ todo }) => todo.completed);

    if (completedTodos.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No completed tasks yet';
        completedList.appendChild(emptyMessage);
        return;
    }

    completedTodos.forEach(({ todo, index }) => {
        const li = document.createElement('li');
        li.className = 'completed-item';

        const label = document.createElement('label');
        label.textContent = todo.text;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'completed-buttons';

        const uncompleteBtn = document.createElement('button');
        uncompleteBtn.textContent = 'Uncomplete';
        uncompleteBtn.className = 'uncomplete-btn';
        uncompleteBtn.addEventListener('click', () => uncompleteTodo(index));

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => deleteTodo(index));

        buttonContainer.appendChild(uncompleteBtn);
        buttonContainer.appendChild(deleteBtn);

        li.appendChild(label);
        li.appendChild(buttonContainer);
        completedList.appendChild(li);
    });
}

// Open completed view
function openCompletedView() {
    currentView = 'completed';
    render();
}

// Uncomplete a todo
function uncompleteTodo(index) {
    todos[index].completed = false;
    saveTodos();
    render();
}


// Drag and drop functionality
let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(e.target.dataset.index);
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedIndex = null;

    // Remove any lingering drag-over classes
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
}

function setupDropZone(element, isInProgressZone) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', (e) => {
        // Only remove if we're leaving the drop zone entirely
        const rect = element.getBoundingClientRect();
        if (
            e.clientX < rect.left ||
            e.clientX >= rect.right ||
            e.clientY < rect.top ||
            e.clientY >= rect.bottom
        ) {
            element.classList.remove('drag-over');
        }
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');

        if (draggedIndex !== null) {
            // Toggle in-progress status based on drop zone
            todos[draggedIndex].inProgress = isInProgressZone;
            saveTodos();
            render();
        }
    });

    // Cleanup on drag end (safety net)
    element.addEventListener('dragend', () => {
        element.classList.remove('drag-over');
    });
}

// Toggle in-progress status
function toggleInProgress(index) {
    todos[index].inProgress = !todos[index].inProgress;
    saveTodos();
    render();
}

// Change priority of a todo
function changePriority(index, newPriority) {
    todos[index].priority = newPriority;
    saveTodos();
    render();
}

// Progress bar functionality
const stages = ['brainstorm', 'planning', 'development', 'refinement', 'testing', 'done'];

function updateProgressBar(currentStage) {
    const stageItems = document.querySelectorAll('.stage-item');
    const stageConnectors = document.querySelectorAll('.stage-connector');
    const currentStageIndex = stages.indexOf(currentStage);

    // Update each stage item
    stageItems.forEach((item, index) => {
        const stage = item.dataset.stage;
        const stageIndex = stages.indexOf(stage);

        // Remove all state classes first
        item.classList.remove('active', 'completed');

        if (stageIndex === currentStageIndex) {
            item.classList.add('active');
        } else if (stageIndex < currentStageIndex) {
            item.classList.add('completed');
        }

        // Add click handler
        item.onclick = () => changeStage(stage);
    });

    // Update connectors
    stageConnectors.forEach((connector, index) => {
        connector.classList.remove('completed');
        if (index < currentStageIndex) {
            connector.classList.add('completed');
        }
    });
}

function changeStage(newStage) {
    if (currentTodoIndex !== null) {
        todos[currentTodoIndex].stage = newStage;
        saveTodos();
        updateProgressBar(newStage);
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.priority-dropdown').forEach(d => {
        d.style.display = 'none';
    });
});

// Export/Import functionality

// Export todos to file
async function exportTodos() {
    try {
        const result = await window.electronAPI.exportTodos(todos);

        if (result.cancelled) {
            // User cancelled - no message needed
            return;
        }

        if (result.success) {
            showMessage(`Successfully exported ${todos.length} tasks`, 'success');
        } else {
            showMessage('Export failed: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Export error:', error);
        showMessage('Export failed: ' + error.message, 'error');
    }
}

// Import todos from file
async function importTodos() {
    try {
        // First, let user select the file
        const result = await window.electronAPI.importTodos();

        if (result.cancelled) {
            // User cancelled - no message needed
            return;
        }

        if (!result.success) {
            // Show user-friendly error messages
            let errorMsg = 'Import failed: ';
            if (result.errorType === 'INVALID_JSON') {
                errorMsg += 'File is not valid JSON format';
            } else if (result.errorType === 'VALIDATION_ERROR') {
                errorMsg += result.error;
            } else {
                errorMsg += result.error || 'Unknown error';
            }
            showMessage(errorMsg, 'error');
            return;
        }

        // Show confirmation dialog
        const currentCount = todos.length;
        const importCount = result.count;
        const confirmMsg = currentCount > 0
            ? `This will replace all ${currentCount} existing tasks with ${importCount} imported tasks. Continue?`
            : `Import ${importCount} tasks?`;

        if (!confirm(confirmMsg)) {
            showMessage('Import cancelled', 'info');
            return;
        }

        // Replace todos and save
        todos = result.todos;
        await saveTodos();

        // Reset view state
        editingIndex = null;
        currentView = 'list';
        currentTodoIndex = null;

        // Re-render
        render();

        showMessage(`Successfully imported ${importCount} tasks`, 'success');
    } catch (error) {
        console.error('Import error:', error);
        showMessage('Import failed: ' + error.message, 'error');
    }
}

// Show temporary message to user
function showMessage(text, type = 'info') {
    // Remove any existing message
    const existingMsg = document.querySelector('.toast-message');
    if (existingMsg) {
        existingMsg.remove();
    }

    // Create message element
    const msg = document.createElement('div');
    msg.className = `toast-message toast-${type}`;
    msg.textContent = text;
    document.body.appendChild(msg);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        msg.classList.add('fade-out');
        setTimeout(() => msg.remove(), 300);
    }, 3000);
}


// Event listeners
document.getElementById('addBtn').addEventListener('click', addTodo);
document.getElementById('todoInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTodo();
    }
});
document.getElementById('backBtn').addEventListener('click', backToList);
document.getElementById('backBtnCompleted').addEventListener('click', backToList);
document.getElementById('viewCompletedBtn').addEventListener('click', openCompletedView);
document.getElementById('exportBtn').addEventListener('click', exportTodos);
document.getElementById('importBtn').addEventListener('click', importTodos);


// Load todos when page loads
loadTodos();
