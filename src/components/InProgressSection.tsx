import { TodoItem } from './TodoItem';
import type { Todo } from '../App';

interface InProgressSectionProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onOpenDetail: (id: string) => void;
}

export function InProgressSection({
  todos,
  onToggle,
  onDelete,
  onUpdate,
  onOpenDetail,
}: InProgressSectionProps) {
  return (
    <div className="mb-6 bg-[#e0e0e0] border-2 border-[#c8c8c8] rounded-lg p-4">
      <h2 className="text-[#505050] mb-3">In Progress</h2>
      <div className="space-y-2">
        {todos.map((todo) => (
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
    </div>
  );
}
