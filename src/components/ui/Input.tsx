import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`input-container ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {label && <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>{label}</label>}
      <input className="input-field" {...props} />
      {error && <span style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '2px' }}>{error}</span>}
    </div>
  );
};
