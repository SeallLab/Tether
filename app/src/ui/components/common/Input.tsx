import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  variant?: 'default' | 'error' | 'success';
  fullWidth?: boolean;
}

const variantClasses = {
  default: 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
  error: 'border-red-300 focus:ring-red-500 focus:border-red-500',
  success: 'border-green-300 focus:ring-green-500 focus:border-green-500',
};

export function Input({
  label,
  description,
  error,
  variant = 'default',
  fullWidth = false,
  className = '',
  ...props
}: InputProps) {
  const baseClasses = 'px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors';
  const variantClass = variantClasses[error ? 'error' : variant];
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-gray-900 mb-2">
          {label}
        </label>
      )}
      <input
        className={`${baseClasses} ${variantClass} ${widthClass} ${className}`}
        {...props}
      />
      {description && !error && (
        <div className="text-xs text-gray-600 mt-2">
          {description}
        </div>
      )}
      {error && (
        <div className="text-xs text-red-600 mt-2">
          {error}
        </div>
      )}
    </div>
  );
} 