import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseClass = 'btn';
  const variantClass = variant === 'ghost' ? 'btn--ghost' : `btn--${variant}`;
  const sizeClass = size === 'icon' ? 'btn-icon' : `btn--${size}`;
  
  return (
    <button 
      className={`${baseClass} ${variantClass} ${sizeClass} animate-scale ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
      ) : children}
    </button>
  );
};
