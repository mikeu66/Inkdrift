import { ArrowLeft, Trash2 } from 'lucide-react';
import { StageTracker } from './StageTracker';
import { PrioritySelector } from './PrioritySelector';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { toast } from 'sonner@2.0.3';
import type { Todo, Priority, Stage } from '../App';

interface DetailViewProps {
  todo: Todo;
  onUpdate: (updates: Partial<Todo>) => void;
  onDelete: () => void;
  onBack: () => void;
}

export function DetailView({ todo, onUpdate, onDelete, onBack }: DetailViewProps) {
  const handleSave = () => {
    toast('Task saved successfully');
  };

  const handleDelete = () => {
    onDelete();
    onBack();
  };

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

        {/* Task Title */}
        <h1 className="text-[#404040] mb-6">{todo.text}</h1>

        {/* Stage Tracker */}
        <StageTracker
          currentStage={todo.stage}
          onStageChange={(stage: Stage) => onUpdate({ stage })}
        />

        {/* Priority Selector */}
        <div className="mb-6">
          <label className="block text-[#606060] mb-2">Priority</label>
          <PrioritySelector
            priority={todo.priority}
            onPriorityChange={(priority: Priority) => onUpdate({ priority })}
          />
        </div>

        {/* In Progress Toggle */}
        <div className="mb-6 flex items-center justify-between p-4 bg-[#ffffff] border border-[#d0d0d0] rounded-md">
          <span className="text-[#505050]">Mark as In Progress</span>
          <Switch
            checked={todo.inProgress}
            onCheckedChange={(inProgress) => onUpdate({ inProgress })}
          />
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-[#606060] mb-2">Notes</label>
          <Textarea
            value={todo.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Add detailed notes about this task..."
            className="min-h-[200px] bg-[#ffffff] border-[#d0d0d0] text-[#404040] resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            className="flex-1 bg-[#b0b0b0] hover:bg-[#989898] text-white"
          >
            Save Changes
          </Button>
          <Button
            onClick={handleDelete}
            variant="outline"
            className="border-[#d0d0d0] text-[#707070] hover:bg-[#e8e8e8] hover:text-[#505050]"
          >
            <Trash2 size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}