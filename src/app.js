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

// Create todo element
function createTodoElement(todo, index) {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''} ${todo.inProgress ? 'in-progress-item' : ''}`;
    li.draggable = true;
    li.dataset.index = index;

    // Drag events
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);

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

        li.appendChild(checkbox);
        li.appendChild(editInput);
        li.appendChild(saveBtn);
        li.appendChild(cancelBtn);

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

        li.appendChild(checkbox);
        li.appendChild(priorityContainer);
        li.appendChild(label);
        li.appendChild(editBtn);
        li.appendChild(deleteBtn);
    }

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
        actionItems: []
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

    // Render action items
    renderActionItems();
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

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.priority-dropdown').forEach(d => {
        d.style.display = 'none';
    });
});


// Action Items functionality
let actionItemInputStates = {}; // Track which items have open granulate inputs

// Calculate total progress for action items
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

// Generate unique ID for action items
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Find action item by ID recursively
function findActionItem(items, targetId) {
    for (let item of items) {
        if (item.id === targetId) {
            return { item, parent: items };
        }
        if (item.children && item.children.length > 0) {
            const found = findActionItem(item.children, targetId);
            if (found) return found;
        }
    }
    return null;
}

// Add action item to the current todo
function addActionItem() {
    const input = document.getElementById('newActionItemInput');
    const text = input.value.trim();

    if (text === '' || currentTodoIndex === null) {
        return;
    }

    const newItem = {
        id: generateId(),
        text: text,
        completed: false,
        children: []
    };

    if (!todos[currentTodoIndex].actionItems) {
        todos[currentTodoIndex].actionItems = [];
    }

    todos[currentTodoIndex].actionItems.push(newItem);
    input.value = '';
    saveTodos();
    renderActionItems();
}

// Add granular (child) action item
function addGranularItem(parentId, text) {
    if (!text || text.trim() === '') {
        return;
    }

    const todo = todos[currentTodoIndex];
    const found = findActionItem(todo.actionItems, parentId);

    if (found) {
        const newItem = {
            id: generateId(),
            text: text.trim(),
            completed: false,
            children: []
        };

        if (!found.item.children) {
            found.item.children = [];
        }

        found.item.children.push(newItem);
        saveTodos();
        renderActionItems();
    }
}

// Toggle action item completion
function toggleActionItem(itemId) {
    const todo = todos[currentTodoIndex];
    const found = findActionItem(todo.actionItems, itemId);

    if (found) {
        found.item.completed = !found.item.completed;

        // Auto-complete parent task if all action items are done
        const progress = calculateActionItemProgress(todo.actionItems);
        if (progress.completed === progress.total && progress.total > 0) {
            todos[currentTodoIndex].completed = true;
            showAutoCompleteNotification();
        }

        saveTodos();
        renderActionItems();
    }
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

// Delete action item
function deleteActionItem(itemId) {
    const todo = todos[currentTodoIndex];
    const found = findActionItem(todo.actionItems, itemId);

    if (found) {
        const index = found.parent.indexOf(found.item);
        if (index > -1) {
            found.parent.splice(index, 1);
            saveTodos();
            renderActionItems();
        }
    }
}

// Find the nesting level of an action item
function findActionItemLevel(items, targetId, currentLevel) {
    for (let item of items) {
        if (item.id === targetId) return currentLevel;
        if (item.children?.length) {
            const childLevel = findActionItemLevel(item.children, targetId, currentLevel + 1);
            if (childLevel !== -1) return childLevel;
        }
    }
    return -1;
}

// Promote action item (two-tier: nested → root, root → main task)
function promoteActionItem(itemId) {
    const todo = todos[currentTodoIndex];
    const found = findActionItem(todo.actionItems, itemId);
    if (!found) return;

    const level = findActionItemLevel(todo.actionItems, itemId, 0);

    if (level === 0) {
        // Root level → promote to main task
        todos.push({
            text: found.item.text,
            completed: false,
            notes: '',
            priority: 'medium',
            createdAt: Date.now(),
            inProgress: false,
            actionItems: found.item.children || []
        });

        found.parent.splice(found.parent.indexOf(found.item), 1);
        saveTodos();
        renderActionItems();
        alert('Action item promoted to main task!');
    } else {
        // Nested → promote to root level
        todo.actionItems.push({
            ...found.item,
            children: found.item.children || []
        });

        found.parent.splice(found.parent.indexOf(found.item), 1);
        saveTodos();
        renderActionItems();
    }
}

// Show granulate input for an item
function showGranulateInput(itemId) {
    actionItemInputStates[itemId] = true;
    renderActionItems();

    // Focus the input after render
    setTimeout(() => {
        const input = document.getElementById(`granulate-input-${itemId}`);
        if (input) {
            input.focus();
        }
    }, 0);
}

// Hide granulate input
function hideGranulateInput(itemId) {
    delete actionItemInputStates[itemId];
    renderActionItems();
}

// Render action items recursively
function renderActionItems() {
    const container = document.getElementById('actionItemsContainer');
    const todo = todos[currentTodoIndex];

    // Update header with progress
    const headerLabel = document.querySelector('.action-items-section > label');

    if (!todo || !todo.actionItems) {
        container.innerHTML = '<div class="no-action-items">No action items yet</div>';
        if (headerLabel) headerLabel.textContent = 'Action Items:';
        return;
    }

    if (todo.actionItems.length === 0) {
        container.innerHTML = '<div class="no-action-items">No action items yet</div>';
        if (headerLabel) headerLabel.textContent = 'Action Items:';
        return;
    }

    // Update header with progress count
    const progress = calculateActionItemProgress(todo.actionItems);
    if (headerLabel) {
        headerLabel.textContent = `Action Items (${progress.completed}/${progress.total} completed):`;
    }

    container.innerHTML = '';

    function renderItem(item, level) {
        const itemDiv = document.createElement('div');
        const hasOpenInput = actionItemInputStates[item.id];
        const classes = ['action-item', `action-item-level-${level}`];
        if (hasOpenInput) classes.push('has-open-input');
        itemDiv.className = classes.join(' ');
        itemDiv.style.paddingLeft = `${level * 20}px`;

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = item.completed;
        checkbox.className = 'action-item-checkbox';
        checkbox.addEventListener('change', () => toggleActionItem(item.id));

        // Text label
        const label = document.createElement('span');
        label.className = `action-item-text ${item.completed ? 'completed' : ''}`;
        label.textContent = item.text;

        // Add inline progress badge for parent items
        const childProgress = getItemChildProgress(item);
        if (childProgress) {
            const badge = document.createElement('span');
            badge.className = 'progress-badge';
            badge.textContent = ` (${childProgress.completed}/${childProgress.total})`;
            label.appendChild(badge);
        }

        // Buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'action-item-buttons';

        // Granulate button
        const granulateBtn = document.createElement('button');
        granulateBtn.innerHTML = '⊕';
        granulateBtn.className = 'granulate-btn';
        granulateBtn.title = 'Break into sub-tasks';
        granulateBtn.addEventListener('click', () => showGranulateInput(item.id));

        // Promote button
        const promoteBtn = document.createElement('button');
        promoteBtn.innerHTML = '↗';
        promoteBtn.className = 'promote-btn';
        promoteBtn.title = level === 0 ? 'Promote to main task' : 'Promote to root level';
        promoteBtn.addEventListener('click', () => promoteActionItem(item.id));

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '×';
        deleteBtn.className = 'delete-action-btn';
        deleteBtn.title = 'Delete';
        deleteBtn.addEventListener('click', () => deleteActionItem(item.id));

        buttonsDiv.appendChild(granulateBtn);
        buttonsDiv.appendChild(promoteBtn);
        buttonsDiv.appendChild(deleteBtn);

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(label);
        itemDiv.appendChild(buttonsDiv);

        container.appendChild(itemDiv);

        // Show granulate input if active
        if (actionItemInputStates[item.id]) {
            const inputDiv = document.createElement('div');
            inputDiv.className = 'granulate-input-container';
            inputDiv.style.paddingLeft = `${(level + 1) * 20}px`;

            const input = document.createElement('input');
            input.type = 'text';
            input.id = `granulate-input-${item.id}`;
            input.className = 'granulate-input';
            input.placeholder = 'Add sub-task...';
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addGranularItem(item.id, input.value);
                    hideGranulateInput(item.id);
                } else if (e.key === 'Escape') {
                    hideGranulateInput(item.id);
                }
            });

            const addBtn = document.createElement('button');
            addBtn.textContent = 'Add';
            addBtn.className = 'granulate-add-btn';
            addBtn.addEventListener('click', () => {
                addGranularItem(item.id, input.value);
                hideGranulateInput(item.id);
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'granulate-cancel-btn';
            cancelBtn.addEventListener('click', () => hideGranulateInput(item.id));

            inputDiv.appendChild(input);
            inputDiv.appendChild(addBtn);
            inputDiv.appendChild(cancelBtn);

            container.appendChild(inputDiv);
        }

        // Render children recursively
        if (item.children && item.children.length > 0) {
            item.children.forEach(child => renderItem(child, level + 1));
        }
    }

    // Render all top-level items
    todo.actionItems.forEach(item => renderItem(item, 0));
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


// Load todos when page loads
loadTodos();
