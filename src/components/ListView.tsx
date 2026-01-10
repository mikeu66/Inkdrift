import { CheckSquare } from 'lucide-react';
import { TodoInput } from './TodoInput';
import { TodoItem } from './TodoItem';
import { InProgressSection } from './InProgressSection';
import { ActionButtons } from './ActionButtons';
import type { Todo } from '../App';

interface ListViewProps {
  todos: Todo[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onOpenDetail: (id: string) => void;
  onViewCompleted: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function ListView({
  todos,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onOpenDetail,
  onViewCompleted,
  onExport,
  onImport,
}: ListViewProps) {
  const inProgressTodos = todos.filter(t => t.inProgress && !t.completed);
  const backlogTodos = todos.filter(t => !t.inProgress && !t.completed);
  const completedCount = todos.filter(t => t.completed).length;

  return (
    <div className="max-w-[600px] mx-auto">
      <div className="bg-[#f5f5f5] rounded-lg shadow-[0_4px_6px_rgba(0,0,0,0.1)] p-8">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <CheckSquare size={40} className="text-[#808080]" />
          <h1 className="text-[#505050] tracking-wide">TASKS</h1>
        </div>

        {/* In Progress Section */}
        {inProgressTodos.length > 0 && (
          <InProgressSection
            todos={inProgressTodos}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onOpenDetail={onOpenDetail}
          />
        )}

        {/* To-Do List */}
        <div className="mb-6">
          <h2 className="text-[#606060] mb-3">Backlog</h2>
          {backlogTodos.length === 0 ? (
            <div className="text-center py-8 text-[#a0a0a0]">
              No tasks in backlog. Add one to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {backlogTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <TodoInput onAdd={onAdd} />

        {/* Action Buttons */}
        <ActionButtons
          completedCount={completedCount}
          onViewCompleted={onViewCompleted}
          onExport={onExport}
          onImport={onImport}
        />
      </div>
    </div>
  );
}
