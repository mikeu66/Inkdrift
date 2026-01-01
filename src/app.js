let todos = [];
let editingIndex = null;

// Load todos from localStorage on startup
function loadTodos() {
    const saved = localStorage.getItem('todos');
    if (saved) {
        todos = JSON.parse(saved);
    }
    renderTodos();
}

// Save todos to localStorage
function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// Render all todos to the DOM
function renderTodos() {
    const todoList = document.getElementById('todoList');
    todoList.innerHTML = '';

    todos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;

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
            const label = document.createElement('label');
            label.textContent = todo.text;
            label.addEventListener('click', () => {
                checkbox.checked = !checkbox.checked;
                toggleTodo(index);
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
            li.appendChild(label);
            li.appendChild(editBtn);
            li.appendChild(deleteBtn);
        }

        todoList.appendChild(li);
    });
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
        completed: false
    });

    input.value = '';
    saveTodos();
    renderTodos();
}

// Toggle todo completion status
function toggleTodo(index) {
    todos[index].completed = !todos[index].completed;
    saveTodos();
    renderTodos();
}

// Delete a todo
function deleteTodo(index) {
    todos.splice(index, 1);
    saveTodos();
    renderTodos();
}

// Start editing a todo
function startEdit(index) {
    editingIndex = index;
    renderTodos();
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
    renderTodos();
}

// Cancel editing
function cancelEdit() {
    editingIndex = null;
    renderTodos();
}

// Event listeners
document.getElementById('addBtn').addEventListener('click', addTodo);
document.getElementById('todoInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTodo();
    }
});

// Load todos when page loads
loadTodos();
