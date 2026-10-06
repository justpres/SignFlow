import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 h-8 gap-1.5',
    md: 'text-sm px-4 py-2.5 h-10 gap-2',
    lg: 'text-base px-6 py-3.5 h-12 gap-2.5',
  }[size];

  const variantStyles = {
    primary: 'bg-black text-white hover:bg-neutral-800 border border-black',
    secondary: 'bg-neutral-100 text-black hover:bg-neutral-200 border border-neutral-300',
    outline: 'bg-transparent text-black border border-black hover:bg-neutral-50',
    ghost: 'bg-transparent text-black hover:bg-neutral-100 border border-transparent',
  }[variant];

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" aria-hidden="true" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
