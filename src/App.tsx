import { useState, useEffect } from 'react';
import { ListView } from './components/ListView';
import { DetailView } from './components/DetailView';
import { CompletedView } from './components/CompletedView';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';
import './electron.d.ts';

export type Priority = 'high' | 'medium' | 'low';
export type Stage = 'not-started' | 'planning' | 'in-progress' | 'review' | 'done';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  inProgress: boolean;
  priority: Priority;
  stage: Stage;
  notes: string;
  createdAt: number;
}

type View = 'list' | 'detail' | 'completed';

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  // Load todos from Electron storage on mount
  useEffect(() => {
    const loadTodos = async () => {
      try {
        if (window.electronAPI) {
          const loadedTodos = await window.electronAPI.loadTodos();
          setTodos(loadedTodos);
        }
      } catch (error) {
        console.error('Failed to load todos:', error);
        toast('Failed to load tasks');
      }
    };
    loadTodos();
  }, []);

  // Auto-save todos whenever they change
  useEffect(() => {
    const saveTodos = async () => {
      try {
        if (window.electronAPI && todos.length >= 0) {
          await window.electronAPI.saveTodos(todos);
        }
      } catch (error) {
        console.error('Failed to save todos:', error);
      }
    };
    saveTodos();
  }, [todos]);

  const addTodo = (text: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false,
      inProgress: false,
      priority: 'medium',
      stage: 'not-started',
      notes: '',
      createdAt: Date.now(),
    };
    setTodos([newTodo, ...todos]);
    toast('Task added successfully');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
    if (selectedTodoId === id) {
      setCurrentView('list');
      setSelectedTodoId(null);
    }
    toast('Task deleted');
  };

  const updateTodo = (id: string, updates: Partial<Todo>) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, ...updates } : todo
    ));
  };

  const openDetail = (id: string) => {
    setSelectedTodoId(id);
    setCurrentView('detail');
  };

  const exportTodos = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.exportTodos(todos);
        if (result.success) {
          toast(`Successfully exported ${todos.length} tasks`);
        } else if (!result.cancelled) {
          toast(result.error || 'Failed to export tasks');
        }
      } else {
        // Fallback for browser testing
        const dataStr = JSON.stringify(todos, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'todos.json';
        link.click();
        toast('Tasks exported successfully');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast('Failed to export tasks');
    }
  };

  const importTodos = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.importTodos();

        if (result.success && result.todos) {
          setTodos(result.todos);
          toast(`Successfully imported ${result.count} tasks`);
        } else if (!result.cancelled) {
          const errorMsg = result.errorType === 'INVALID_JSON'
            ? 'File is not valid JSON format'
            : result.error || 'Failed to import tasks';
          toast(errorMsg);
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      toast('Failed to import tasks');
    }
  };

  const selectedTodo = selectedTodoId ? todos.find(t => t.id === selectedTodoId) : null;

  return (
    <div className="min-h-screen bg-[#e8e8e8] p-6">
      <Toaster position="bottom-right" />

      {currentView === 'list' && (
        <ListView
          todos={todos}
          onAdd={addTodo}
          onToggle={toggleTodo}
          onDelete={deleteTodo}
          onUpdate={updateTodo}
          onOpenDetail={openDetail}
          onViewCompleted={() => setCurrentView('completed')}
          onExport={exportTodos}
          onImport={importTodos}
        />
      )}

      {currentView === 'detail' && selectedTodo && (
        <DetailView
          todo={selectedTodo}
          onUpdate={(updates) => updateTodo(selectedTodo.id, updates)}
          onDelete={() => deleteTodo(selectedTodo.id)}
          onBack={() => setCurrentView('list')}
        />
      )}

      {currentView === 'completed' && (
        <CompletedView
          todos={todos.filter(t => t.completed)}
          onBack={() => setCurrentView('list')}
          onDelete={deleteTodo}
        />
      )}
    </div>
  );
}