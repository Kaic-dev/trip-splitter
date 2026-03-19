import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const variants = {
    success: { bg: '#ecfdf5', color: '#059669', border: '#10b981' },
    warning: { bg: '#fffbeb', color: '#d97706', border: '#f59e0b' },
    danger: { bg: '#fef2f2', color: '#dc2626', border: '#ef4444' },
    info: { bg: '#eff6ff', color: '#2563eb', border: '#3b82f6' },
    neutral: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }
  };

  const style = variants[variant];

  return (
    <span 
      className={`badge ${className}`}
      style={{ 
        backgroundColor: style.bg, 
        color: style.color, 
        border: `1px solid ${style.border}` 
      }}
    >
      {children}
    </span>
  );
};
