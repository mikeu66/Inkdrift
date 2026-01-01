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

// Render list view
function renderListView() {
    // Show list view, hide detail view
    document.getElementById('listView').style.display = 'block';
    document.getElementById('detailView').style.display = 'none';

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
        completed: false,
        notes: ''
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
