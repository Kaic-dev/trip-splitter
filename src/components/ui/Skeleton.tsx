import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width, height, circle, className = '' }) => {
  return (
    <div 
      className={`skeleton ${className}`} 
      style={{ 
        width: width || '100%', 
        height: height || '1rem', 
        borderRadius: circle ? '50%' : 'var(--radius-sm)' 
      }} 
    />
  );
};
