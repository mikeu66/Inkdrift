import { Eye, Download, Upload } from 'lucide-react';
import { Button } from './ui/button';

interface ActionButtonsProps {
  completedCount: number;
  onViewCompleted: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function ActionButtons({
  completedCount,
  onViewCompleted,
  onExport,
  onImport,
}: ActionButtonsProps) {
  return (
    <div className="flex gap-3 mt-6">
      <Button
        onClick={onViewCompleted}
        variant="outline"
        className="flex-1 border-[#d0d0d0] text-[#606060] hover:bg-[#e8e8e8] hover:text-[#404040]"
      >
        <Eye size={18} />
        <span>View Completed ({completedCount})</span>
      </Button>

      <Button
        onClick={onExport}
        variant="outline"
        className="border-[#d0d0d0] text-[#606060] hover:bg-[#e8e8e8] hover:text-[#404040]"
      >
        <Download size={18} />
      </Button>

      <Button
        onClick={onImport}
        variant="outline"
        className="border-[#d0d0d0] text-[#606060] hover:bg-[#e8e8e8] hover:text-[#404040]"
      >
        <Upload size={18} />
      </Button>
    </div>
  );
}
