import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glass?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, glass, style }) => {
  const glassClass = glass ? 'header-card' : 'card';
  return (
    <div 
      className={`${glassClass} ${onClick ? 'animate-scale' : ''} ${className}`} 
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </div>
  );
};
