import { Circle, CheckCircle2 } from 'lucide-react';
import type { Stage } from '../App';

interface StageTrackerProps {
  currentStage: Stage;
  onStageChange: (stage: Stage) => void;
}

const stages: { id: Stage; label: string }[] = [
  { id: 'not-started', label: 'Not Started' },
  { id: 'planning', label: 'Planning' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

const stageIndex = {
  'not-started': 0,
  'planning': 1,
  'in-progress': 2,
  'review': 3,
  'done': 4,
};

export function StageTracker({ currentStage, onStageChange }: StageTrackerProps) {
  const currentIndex = stageIndex[currentStage];

  return (
    <div className="mb-8">
      <h3 className="text-[#606060] mb-4">Progress Stage</h3>
      <div className="relative">
        {/* Connector Line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-[#d8d8d8]" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-[#909090] transition-all duration-300"
          style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
        />

        {/* Stages */}
        <div className="relative flex justify-between">
          {stages.map((stage, index) => {
            const isActive = index <= currentIndex;
            const isCurrent = stage.id === currentStage;

            return (
              <button
                key={stage.id}
                onClick={() => onStageChange(stage.id)}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-[#909090] text-white'
                      : 'bg-[#e8e8e8] text-[#b8b8b8] border-2 border-[#d0d0d0]'
                  } ${isCurrent ? 'ring-4 ring-[#d0d0d0]' : ''} hover:scale-110`}
                >
                  {isActive ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Circle size={20} />
                  )}
                </div>
                <span
                  className={`text-xs text-center max-w-[80px] ${
                    isActive ? 'text-[#505050]' : 'text-[#a0a0a0]'
                  }`}
                >
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
