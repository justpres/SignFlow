import React from 'react';

interface ProgressBarProps {
  currentStep: number;
  steps: string[];
}

export function ProgressBar({ currentStep, steps }: ProgressBarProps) {
  return (
    <nav aria-label="Signing progress" className="w-full">
      <ol className="flex items-center justify-between border-b border-neutral-200 pb-4">
        {steps.map((label, idx) => {
          const stepNumber = idx + 1;
          const isCurrent = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <li
              key={label}
              className={`flex items-center space-x-2 text-xs ${
                isCurrent
                  ? 'font-bold text-black'
                  : isCompleted
                  ? 'font-medium text-neutral-600'
                  : 'text-neutral-400'
              }`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={`w-6 h-6 flex items-center justify-center border text-xs ${
                  isCurrent
                    ? 'border-black bg-black text-white'
                    : isCompleted
                    ? 'border-neutral-400 bg-neutral-100 text-black'
                    : 'border-neutral-300 text-neutral-400'
                }`}
                aria-hidden="true"
              >
                {stepNumber}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
