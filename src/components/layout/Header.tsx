import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import logo from '../../assets/logo.png';

interface HeaderProps {
  title?: string;
  onHistoricoClick: () => void;
  onNewTripClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title = 'RachaFácil', onHistoricoClick, onNewTripClick }) => {
  return (
    <div className="header-overlay">
      <Card glass className="header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={logo} alt="RachaFácil Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--primary)', marginBottom: 0 }}>
            {title}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={onHistoricoClick}>
            🕒 Histórico
          </Button>
          <Button variant="primary" size="sm" onClick={onNewTripClick}>
            + Nova
          </Button>
        </div>
      </Card>
    </div>
  );
};
