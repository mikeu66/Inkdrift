let todos = [];
let editingIndex = null;
let currentView = 'list'; // 'list' or 'detail'
let currentTodoIndex = null;

// Load todos from localStorage on startup
function loadTodos() {
    const saved = localStorage.getItem('todos');
    if (saved) {
        todos = JSON.parse(saved);
    }
    render();
}

// Save todos to localStorage
function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// Main render function
function render() {
    if (currentView === 'list') {
        renderListView();
    } else if (currentView === 'detail') {
        renderDetailView();
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

    // Separate in-progress and regular todos
    const inProgressTodos = sortedTodos.filter(({ todo }) => todo.inProgress && !todo.completed);
    const regularTodos = sortedTodos.filter(({ todo }) => !todo.inProgress && !todo.completed);
    const completedTodos = sortedTodos.filter(({ todo }) => todo.completed);

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

    // Render completed items
    completedTodos.forEach(({ todo, index }) => {
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
        const priorityIndicator = document.createElement('span');
        priorityIndicator.className = `priority-indicator priority-${todo.priority || 'medium'}`;
        priorityIndicator.textContent = '●';

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
        li.appendChild(priorityIndicator);
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
        inProgress: false
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
}

function setupDropZone(element, isInProgressZone) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
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

        if (draggedIndex !== null) {
            // Toggle in-progress status based on drop zone
            todos[draggedIndex].inProgress = isInProgressZone;
            saveTodos();
            render();
        }
    });
}

// Toggle in-progress status
function toggleInProgress(index) {
    todos[index].inProgress = !todos[index].inProgress;
    saveTodos();
    render();
}

// Event listeners
document.getElementById('addBtn').addEventListener('click', addTodo);
document.getElementById('todoInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTodo();
    }
});
document.getElementById('backBtn').addEventListener('click', backToList);

// Load todos when page loads
loadTodos();
