import React from 'react';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  formatValue?: (value: number) => string;
  showValue?: boolean;
  fullWidth?: boolean;
}

export function Slider({
  label,
  description,
  formatValue,
  showValue = true,
  fullWidth = false,
  value,
  className = '',
  ...props
}: SliderProps) {
  const numericValue = typeof value === 'string' ? parseInt(value) : 
                      Array.isArray(value) ? 0 : 
                      (value || 0);
  const displayValue = formatValue ? formatValue(numericValue as number) : numericValue.toString();

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <label className="block text-sm font-medium text-gray-900">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-sm font-medium text-gray-700">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        value={value}
        className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider ${className}`}
        {...props}
      />
      {description && (
        <div className="text-xs text-gray-600 mt-2">
          {description}
        </div>
      )}
    </div>
  );
} 