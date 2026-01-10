import { useState } from 'react';
import { ListView } from './components/ListView';
import { DetailView } from './components/DetailView';
import { CompletedView } from './components/CompletedView';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';

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

  const exportTodos = () => {
    const dataStr = JSON.stringify(todos, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'todos.json';
    link.click();
    toast('Tasks exported successfully');
  };

  const importTodos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          setTodos(imported);
          toast('Tasks imported successfully');
        } catch (error) {
          toast('Failed to import tasks');
        }
      };
      reader.readAsText(file);
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