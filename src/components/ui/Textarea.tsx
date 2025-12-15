import React from 'react';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string | null;
  hint?: string;
};

export default function Textarea({ id, label, error, hint, className = '', ...props }: TextareaProps) {
  const inputId = id || props.name || Math.random().toString(36).slice(2);
  return (
    <div className="relative">
      <textarea
        id={inputId}
        className={`peer w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-gray-900 placeholder-transparent outline-none transition-[box-shadow,background,transform,border-color] duration-200 focus:border-brand-500 focus:shadow-glow resize-y ${className}`}
        placeholder={label}
        {...props}
      />
      <label
        htmlFor={inputId}
        className="pointer-events-none absolute left-3 top-3 origin-[0] -translate-y-1/2 transform bg-white px-1 text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-base peer-focus:-top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-brand-600 peer-focus:font-medium"
      >
        {label}
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
    </div>
  );
}
