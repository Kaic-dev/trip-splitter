import React from 'react';
import { type Address } from '../../types';
import LocationInput from '../LocationInput';
import { Input } from '../ui/Input';
import { PassengerList } from '../trip/PassengerList';
import { AddPassengerForm } from '../trip/AddPassengerForm';
import { CostBreakdown } from '../trip/CostBreakdown';

interface TripFormProps {
  origin: Address;
  setOrigin: (addr: Address) => void;
  destination: Address;
  setDestination: (addr: Address) => void;
  kmPerLiter: number;
  handleSetKmPerLiter: (v: number) => void;
  fuelPrice: number;
  handleSetFuelPrice: (v: number) => void;
  vehicleCapacity: number;
  handleSetCapacity: (v: number) => void;
  passengers: any[]; // formatted passenger costs
  handleRemovePassenger: (id: string) => void;
  isAddingPassenger: boolean;
  setIsAddingPassenger: (v: boolean) => void;
  handleAddPassenger: (name: string, loc: Address) => void;
  routeResult: any;
  costBreakdown: any;
}

export const TripForm: React.FC<TripFormProps> = ({
  origin, setOrigin,
  destination, setDestination,
  kmPerLiter, handleSetKmPerLiter,
  fuelPrice, handleSetFuelPrice,
  vehicleCapacity, handleSetCapacity,
  passengers, handleRemovePassenger,
  isAddingPassenger, setIsAddingPassenger,
  handleAddPassenger,
  routeResult,
  costBreakdown
}) => {
  return (
    <>
      {/* ── Route Inputs ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="field-label">Origem</label>
            <LocationInput 
              value={origin} 
              onChange={(a) => a && setOrigin(a)} 
              placeholder="Cidade ou endereço de partida" 
              proximity={origin.coordinates}
            />
          </div>
          <div>
            <label className="field-label">Destino</label>
            <LocationInput 
              value={destination} 
              onChange={(a) => a && setDestination(a)} 
              placeholder="Cidade ou endereço de destino" 
              proximity={origin.coordinates}
            />
          </div>
        </div>
      </section>

      {/* ── Vehicle Settings ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="field-label">Consumo (km/L)</label>
            <Input type="number" value={kmPerLiter} onChange={(e) => handleSetKmPerLiter(Number(e.target.value))} />
          </div>
          <div>
            <label className="field-label">Preço Comb.</label>
            <Input type="number" step="0.01" value={fuelPrice} onChange={(e) => handleSetFuelPrice(Number(e.target.value))} />
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          <label className="field-label">Tipo de Veículo</label>
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            background: 'var(--bg-app)', 
            padding: '4px', 
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            <button 
              onClick={() => handleSetCapacity(2)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                background: vehicleCapacity === 2 ? 'var(--primary)' : 'transparent',
                color: vehicleCapacity === 2 ? '#fff' : 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              🏍️ Moto
            </button>
            <button 
              onClick={() => handleSetCapacity(4)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                background: vehicleCapacity === 4 ? 'var(--primary)' : 'transparent',
                color: vehicleCapacity === 4 ? '#fff' : 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              🚗 Carro
            </button>
          </div>
        </div>
      </section>

      <PassengerList
        passengers={passengers}
        onRemove={handleRemovePassenger}
        onAddClick={() => setIsAddingPassenger(true)}
        isAdding={isAddingPassenger}
      />

      {isAddingPassenger && (
        <AddPassengerForm onAdd={handleAddPassenger} proximity={origin.coordinates} />
      )}

      {routeResult && (
        <div style={{ marginTop: '1.5rem' }}>
          <CostBreakdown
            fuelCost={costBreakdown.fuelCost}
            margin={costBreakdown.margin}
            total={costBreakdown.total}
            distance={routeResult.totalDistanceKm}
            consumption={kmPerLiter}
            marginPercent={routeResult.pureFuelCost && routeResult.pureFuelCost > 0 
              ? Math.round((routeResult.marginAmount || 0) / routeResult.pureFuelCost * 100) 
              : undefined}
          />
        </div>
      )}
    </>
  );
};
