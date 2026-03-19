import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import LocationInput from '../LocationInput';
import type { Address } from '../../types';

interface AddPassengerProps {
  onAdd: (name: string, location: Address) => void;
  proximity?: [number, number];
  loading?: boolean;
}

export const AddPassengerForm: React.FC<AddPassengerProps> = ({ onAdd, proximity, loading }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState<Address | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && address) {
      onAdd(name, address);
      setName('');
      setAddress(null);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="card animate-slide-up" 
      style={{ padding: '1rem', marginTop: '1rem', background: 'var(--bg-app)', borderStyle: 'dashed' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
        <Input 
          label="Nome do passageiro"
          placeholder="Ex: João Silva" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
        />
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
            Endereço da parada
          </label>
          <LocationInput 
            value={address}
            onChange={setAddress}
            placeholder="Buscar endereço de parada..."
            proximity={proximity}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <Button type="submit" variant="primary" size="sm" loading={loading} disabled={!name || !address}>
          + Confirmar Parada
        </Button>
      </div>
    </form>
  );
};
