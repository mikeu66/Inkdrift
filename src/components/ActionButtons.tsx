import { Eye, Download, Upload } from 'lucide-react';
import { Button } from './ui/button';

interface ActionButtonsProps {
  completedCount: number;
  onViewCompleted: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
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

      <label>
        <input
          type="file"
          accept=".json"
          onChange={onImport}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          className="border-[#d0d0d0] text-[#606060] hover:bg-[#e8e8e8] hover:text-[#404040]"
          onClick={() => {
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            input?.click();
          }}
        >
          <Upload size={18} />
        </Button>
      </label>
    </div>
  );
}
