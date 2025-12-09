import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: Variant;
  fullWidth?: boolean;
};

export default function Button({
  children,
  loading,
  disabled,
  variant = 'primary',
  fullWidth = true,
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-lg px-4 py-2.5 font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';
  const variants: Record<Variant, string> = {
    primary:
      'bg-brand-600 text-white hover:bg-brand-700 shadow-soft focus-visible:ring-brand-500',
    secondary:
      'bg-surface-subtle text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400',
    ghost:
      'bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-300',
  } as const;

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="-ml-1 mr-2 h-5 w-5 animate-spin text-white/90"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
      )}
      {children}
    </button>
  );
}
