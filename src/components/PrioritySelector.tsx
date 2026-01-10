import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Priority } from '../App';

interface PrioritySelectorProps {
  priority: Priority;
  onPriorityChange: (priority: Priority) => void;
}

export function PrioritySelector({ priority, onPriorityChange }: PrioritySelectorProps) {
  return (
    <Select value={priority} onValueChange={onPriorityChange}>
      <SelectTrigger className="bg-[#ffffff] border-[#d0d0d0] text-[#404040]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-[#ffffff] border-[#d0d0d0]">
        <SelectItem value="high" className="text-[#404040]">High Priority</SelectItem>
        <SelectItem value="medium" className="text-[#404040]">Medium Priority</SelectItem>
        <SelectItem value="low" className="text-[#404040]">Low Priority</SelectItem>
      </SelectContent>
    </Select>
  );
}
