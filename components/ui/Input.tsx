import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  optional?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  optional,
  id,
  className = '',
  required,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="w-full flex flex-col space-y-1.5">
      <div className="flex justify-between items-center">
        <label htmlFor={inputId} className="text-sm font-semibold text-black">
          {label}
          {required && <span className="text-black ml-0.5" aria-hidden="true">*</span>}
        </label>
        {optional && <span className="text-xs text-neutral-500">Optional</span>}
      </div>

      <input
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={`w-full px-3.5 py-2.5 bg-white text-black text-sm border ${
          error ? 'border-black ring-1 ring-black' : 'border-neutral-300 hover:border-black'
        } focus:border-black focus:outline-none transition-colors ${className}`}
        {...props}
      />

      {error ? (
        <p id={errorId} className="text-xs font-medium text-black mt-1 flex items-center gap-1" role="alert">
          <span className="font-bold underline" aria-hidden="true">Note:</span> {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-neutral-500 mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
