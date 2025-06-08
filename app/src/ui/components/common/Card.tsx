import React from 'react';

export interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outlined' | 'elevated';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const variantClasses = {
  default: 'bg-white border',
  outlined: 'bg-white border-2 border-gray-100',
  elevated: 'bg-white border border-gray-200 shadow-md',
};

export function Card({
  title,
  children,
  className = '',
  padding = 'md',
  variant = 'default',
}: CardProps) {
  const paddingClass = paddingClasses[padding];
  const variantClass = variantClasses[variant];

  return (
    <div className={`rounded-lg ${variantClass} ${paddingClass} ${className}`}>
      {title && (
        <h4 className="text-lg font-medium text-gray-900 mb-4">
          {title}
        </h4>
      )}
      {children}
    </div>
  );
} 