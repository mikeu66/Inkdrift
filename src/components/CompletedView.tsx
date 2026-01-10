import { ArrowLeft, X } from 'lucide-react';
import type { Todo } from '../App';

interface CompletedViewProps {
  todos: Todo[];
  onBack: () => void;
  onDelete: (id: string) => void;
}

export function CompletedView({ todos, onBack, onDelete }: CompletedViewProps) {
  return (
    <div className="max-w-[600px] mx-auto">
      <div className="bg-[#f5f5f5] rounded-lg shadow-[0_4px_6px_rgba(0,0,0,0.1)] p-8">
        {/* Navigation */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#606060] hover:text-[#404040] mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <h1 className="text-[#505050] mb-6">Completed Tasks</h1>

        {todos.length === 0 ? (
          <div className="text-center py-12 text-[#a0a0a0]">
            No completed tasks yet.
          </div>
        ) : (
          <div className="space-y-2">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="bg-[#ffffff] border border-[#d0d0d0] rounded-md p-4 flex items-center gap-4 group"
              >
                <span className="flex-1 text-[#a0a0a0] line-through">
                  {todo.text}
                </span>
                <button
                  onClick={() => onDelete(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#909090] hover:text-[#505050] transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
