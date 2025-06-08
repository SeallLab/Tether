import React from 'react';

export interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'error' | 'warning' | 'success';
  label: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig = {
  active: {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    dotColor: 'bg-green-500',
  },
  inactive: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    dotColor: 'bg-red-500',
  },
  error: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    dotColor: 'bg-red-500',
  },
  warning: {
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    dotColor: 'bg-yellow-500',
  },
  success: {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    dotColor: 'bg-green-500',
  },
};

const sizeClasses = {
  sm: {
    container: 'p-3',
    dot: 'w-2 h-2',
    label: 'text-sm',
    description: 'text-xs',
  },
  md: {
    container: 'p-4',
    dot: 'w-3 h-3',
    label: 'text-base',
    description: 'text-sm',
  },
  lg: {
    container: 'p-5',
    dot: 'w-4 h-4',
    label: 'text-lg',
    description: 'text-base',
  },
};

export function StatusBadge({
  status,
  label,
  description,
  size = 'md',
  className = '',
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClass = sizeClasses[size];

  return (
    <div className={`rounded-lg border ${config.bgColor} ${config.borderColor} ${sizeClass.container} ${className}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`${sizeClass.dot} rounded-full ${config.dotColor}`} />
        <span className={`font-medium ${config.textColor} ${sizeClass.label}`}>
          {label}
        </span>
      </div>
      {description && (
        <div className={`text-gray-600 ${sizeClass.description}`}>
          {description}
        </div>
      )}
    </div>
  );
} 