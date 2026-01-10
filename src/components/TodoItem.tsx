import { useState } from 'react';
import { Check, X, Circle } from 'lucide-react';
import type { Todo } from '../App';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onOpenDetail: (id: string) => void;
}

const priorityColors = {
  high: '#707070',
  medium: '#909090',
  low: '#b8b8b8',
};

const stageProgress = {
  'not-started': 0,
  'planning': 1,
  'in-progress': 2,
  'review': 3,
  'done': 4,
};

export function TodoItem({ todo, onToggle, onDelete, onUpdate, onOpenDetail }: TodoItemProps) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => onOpenDetail(todo.id)}
      className={`bg-[#ffffff] border border-[#d0d0d0] rounded-md p-4 flex items-center gap-4 group hover:bg-[#f8f8f8] hover:border-[#b0b0b0] transition-all duration-200 cursor-pointer ${
        isDragging ? 'opacity-50 rotate-2' : ''
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(todo.id);
        }}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          todo.completed
            ? 'bg-[#a0a0a0] border-[#a0a0a0]'
            : 'bg-transparent border-[#c0c0c0] hover:border-[#808080]'
        }`}
      >
        {todo.completed && <Check size={14} className="text-white" />}
      </button>

      <Circle
        size={12}
        className="flex-shrink-0"
        fill={priorityColors[todo.priority]}
        color={priorityColors[todo.priority]}
      />

      <div className="flex-1 min-w-0">
        <span
          className={`block truncate transition-all ${
            todo.completed ? 'text-[#a0a0a0] line-through' : 'text-[#404040]'
          }`}
        >
          {todo.text}
        </span>
        
        {/* Mini Progress Bar */}
        <div className="flex gap-1 mt-2">
          {[0, 1, 2, 3, 4].map((stage) => (
            <div
              key={stage}
              className={`w-2 h-2 rounded-full ${
                stage <= stageProgress[todo.stage] ? 'bg-[#909090]' : 'bg-[#d8d8d8]'
              }`}
            />
          ))}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(todo.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-[#909090] hover:text-[#505050] transition-all"
      >
        <X size={18} />
      </button>
    </div>
  );
}
