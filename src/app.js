let todos = [];

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

        const label = document.createElement('label');
        label.textContent = todo.text;
        label.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            toggleTodo(index);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => deleteTodo(index));

        li.appendChild(checkbox);
        li.appendChild(label);
        li.appendChild(deleteBtn);
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

// Event listeners
document.getElementById('addBtn').addEventListener('click', addTodo);
document.getElementById('todoInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTodo();
    }
});

// Load todos when page loads
loadTodos();
