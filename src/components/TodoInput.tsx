import { useState } from 'react';
import { Plus } from 'lucide-react';

interface TodoInputProps {
  onAdd: (text: string) => void;
}

export function TodoInput({ onAdd }: TodoInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onAdd(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 bg-[#ffffff] border border-[#d0d0d0] rounded-md px-4 py-3 text-[#303030] placeholder-[#a8a8a8] focus:outline-none focus:border-[#909090] transition-colors"
        />
        <button
          type="submit"
          className="bg-[#b0b0b0] hover:bg-[#989898] text-white rounded-md px-6 py-3 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          <span>Add</span>
        </button>
      </div>
    </form>
  );
}
