import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  description?: string;
  className?: string;
}

const sizeClasses = {
  sm: {
    container: 'h-4 w-8',
    thumb: 'h-3 w-3',
    translate: 'translate-x-4',
  },
  md: {
    container: 'h-6 w-11',
    thumb: 'h-4 w-4',
    translate: 'translate-x-6',
  },
  lg: {
    container: 'h-8 w-14',
    thumb: 'h-6 w-6',
    translate: 'translate-x-7',
  },
};

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  label,
  description,
  className = '',
}: ToggleProps) {
  const sizeClass = sizeClasses[size];

  const toggleElement = (
    <label className={`flex items-center cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
      <div className={`relative inline-flex ${sizeClass.container} items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      }`}>
        <span className={`inline-block ${sizeClass.thumb} transform rounded-full bg-white transition-transform ${
          checked ? sizeClass.translate : 'translate-x-1'
        }`} />
      </div>
    </label>
  );

  if (label || description) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {label && <div className="font-medium text-gray-900">{label}</div>}
          {description && <div className="text-sm text-gray-600">{description}</div>}
        </div>
        {toggleElement}
      </div>
    );
  }

  return toggleElement;
} 