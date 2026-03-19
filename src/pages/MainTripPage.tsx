import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { useNavigate } from 'react-router-dom';
import { BottomPanel } from '../components/layout/BottomPanel';
import { Header } from '../components/layout/Header';
import { useBottomPanelState } from '../hooks/layout/useBottomPanelState';
import { TripSummary } from '../components/trip/TripSummary';
import { Button } from '../components/ui/Button';
import { TripForm } from '../components/trip/TripForm';

import { useTripCalculation } from '../hooks/useTripCalculation';
import { mapProvider } from '../providers/ProviderManager';
import { TripHistoryRepository } from '../repositories/tripRepository';
import { PaymentRepository } from '../repositories/paymentRepository';
import { useHistory } from '../providers/HistoryProvider';
import { useLocationHistory } from '../hooks/useLocationHistory';
import type { Address, Passenger, RouteResult, TripHistory, PassengerPayment } from '../types';
import { storageService } from '../services/storageService';

const MapView = lazy(() => import('../components/MapView'));

// Persist vehicle settings
const LS_KM = 'trip_kmPerLiter';
const LS_FUEL = 'trip_fuelPrice';
const LS_CAPACITY = 'trip_vehicleCapacity';

export default function MainTripPage() {
  const navigate = useNavigate();
  const { refreshAll } = useHistory();
  useLocationHistory();
  
  // Detect if Desktop (>= 1024px) for split-pane layout
  const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : true;
  const { panelState, setPanelState } = useBottomPanelState(isMobile ? 'collapsed' : 'expanded');
  const { calculate, loading: calcLoading } = useTripCalculation(mapProvider);

  // Core State
  const [origin, setOrigin] = useState<Address>({ label: 'Americana, SP', coordinates: [-47.3308, -22.7394] });
  const [destination, setDestination] = useState<Address>({ label: 'Campinas, SP', coordinates: [-47.0608, -22.9064] });
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  // Vehicle settings – persisted via storageService
  const [kmPerLiter, setKmPerLiter] = useState(10);
  const [fuelPrice, setFuelPrice] = useState(5.79);
  const [vehicleCapacity, setVehicleCapacity] = useState(4);

  useEffect(() => {
    storageService.getItem(LS_KM, 10).then(setKmPerLiter);
    storageService.getItem(LS_FUEL, 5.79).then(setFuelPrice);
    storageService.getItem(LS_CAPACITY, 4).then(setVehicleCapacity);
  }, []);

  const handleSetKmPerLiter = (v: number) => { setKmPerLiter(v); storageService.setItem(LS_KM, v); };
  const handleSetFuelPrice = (v: number) => { setFuelPrice(v); storageService.setItem(LS_FUEL, v); };
  const handleSetCapacity = (v: number) => { setVehicleCapacity(v); storageService.setItem(LS_CAPACITY, v); };

  const [routeResult, setRouteResult] = useState<RouteResult | undefined>();
  const [isAddingPassenger, setIsAddingPassenger] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 0. Automatic Geolocation
  useEffect(() => {
    const attemptGeolocation = async () => {
      try {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        const { latitude, longitude } = pos.coords;
        const result = await mapProvider.reverseGeocode([longitude, latitude]);
        if (result) {
          setOrigin({ label: result.fullAddress, coordinates: result.coordinates as [number, number], name: result.name });
        }
      } catch (err) {
        console.warn('[MainTripPage] Geolocation failed:', err);
      }
    };
    attemptGeolocation();
  }, []);

  // 1. Route Calculation
  const calculationParams = useMemo(() => ({
    origin,
    destination,
    passengers,
    kmPerLiter,
    fuelPrice,
    executionMode: 'SHARED' as const,
    vehicleCapacity,
    schedule: { mode: 'departAt' as const, time: new Date() },
  }), [origin, destination, passengers, kmPerLiter, fuelPrice, vehicleCapacity]);

  useEffect(() => {
    const timer = setTimeout(() => {
      calculate(calculationParams, (_, result) => { 
        setRouteResult(result); 
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [calculationParams, calculate]);

  // 3. Handlers
  const handleAddPassenger = (name: string, location: Address) => {
    setPassengers(prev => [...prev, { id: Date.now().toString(), name, location }]);
    setIsAddingPassenger(false);
  };

  const handleRemovePassenger = (id: string) => {
    setPassengers(prev => prev.filter(p => p.id !== id));
  };

  const handleFinalize = async () => {
    if (!routeResult) return;
    setIsSaving(true);
    try {
      const tripId = Date.now().toString();
      const tripHistory: TripHistory = {
        id: tripId,
        shortId: tripId.slice(-5),
        tripName: `Viagem para ${destination.name || destination.label}`,
        tripType: 'REAL_TRIP',
        origin, destination,
        stops: passengers,
        date: Date.now(),
        totalDistance: routeResult.totalDistanceKm,
        totalCost: routeResult.totalCost,
        signature: 'manual',
        kmPerLiter, fuelPrice,
        routeResult,
        activeRoute: {
          id: 'main',
          distanceKm: routeResult.totalDistanceKm,
          durationMinutes: routeResult.durationMinutes || 0,
          pureFuelCost: routeResult.pureFuelCost,
          marginAmount: routeResult.marginAmount,
          fuelCost: routeResult.totalCost,
          geometry: routeResult.geometry,
          label: 'recommended'
        }
      };
      const payments: PassengerPayment[] = passengerCosts.map(p => ({
        id: `pay-${tripId}-${p.id}`,
        tripHistoryId: tripId,
        passengerId: p.id,
        passengerName: p.name,
        amount: p.amount,
        paid: false
      }));
      await TripHistoryRepository.save(tripHistory);
      await PaymentRepository.saveBulk(payments);
      await refreshAll();
      navigate('/historico');
    } catch (err) {
      console.error('Failed to save trip:', err);
      alert('Erro ao salvar a viagem. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Derived calculations
  const costBreakdown = useMemo(() => {
    if (!routeResult) return { fuelCost: 0, margin: 0, total: 0 };
    return { 
      fuelCost: routeResult.pureFuelCost || 0, 
      margin: routeResult.marginAmount || 0, 
      total: routeResult.totalCost 
    };
  }, [routeResult]);

  const passengerCosts = useMemo(() => {
    if (!routeResult) return [];
    return passengers.map(p => {
      const split = routeResult.passengerDetours.find(s => s.passengerId === p.id);
      return { id: p.id, name: p.name, amount: split?.paymentAmount || 0, detourKm: split?.detourKm || 0 };
    });
  }, [routeResult, passengers]);

  const commonForm = (
    <TripForm
      origin={origin} setOrigin={setOrigin}
      destination={destination} setDestination={setDestination}
      kmPerLiter={kmPerLiter} handleSetKmPerLiter={handleSetKmPerLiter}
      fuelPrice={fuelPrice} handleSetFuelPrice={handleSetFuelPrice}
      vehicleCapacity={vehicleCapacity} handleSetCapacity={handleSetCapacity}
      passengers={passengerCosts} handleRemovePassenger={handleRemovePassenger}
      isAddingPassenger={isAddingPassenger} setIsAddingPassenger={setIsAddingPassenger}
      handleAddPassenger={handleAddPassenger}
      routeResult={routeResult}
      costBreakdown={costBreakdown}
    />
  );

  const commonHeader = (
    <Header
      onHistoricoClick={() => navigate('/historico')}
      onNewTripClick={() => { setPassengers([]); setPanelState('expanded'); }}
    />
  );

  const commonMapView = (
    <Suspense fallback={<div className="map-background skeleton" />}>
      <MapView
        routeResult={routeResult}
        baseGeometry={routeResult?.baseGeometry}
        origin={origin}
        destination={destination}
      />
    </Suspense>
  );

  const commonPanel = (isDesktopMode: boolean) => (
    <BottomPanel
      state={panelState}
      onStateChange={setPanelState}
      isDesktop={isDesktopMode}
      header={
        <TripSummary
          origin={origin.label}
          destination={destination.label}
          totalCost={costBreakdown.total}
          distance={routeResult?.totalDistanceKm || 0}
          duration={routeResult?.durationMinutes ? `${Math.round(routeResult.durationMinutes)} min` : '--'}
          passengerCount={passengers.length}
          eta={routeResult?.eta}
        />
      }
      footer={
        <Button
          variant="primary"
          style={{ width: '100%', height: '52px', fontSize: '1rem' }}
          onClick={handleFinalize}
          loading={calcLoading || isSaving}
          disabled={!routeResult || isSaving}
        >
          Finalizar e Salvar Viagem
        </Button>
      }
    >
      {commonForm}
    </BottomPanel>
  );

  if (isDesktop) {
    return (
      <div className="desktop-split-layout">
        <div className="map-area">
          {commonHeader}
          {commonMapView}
        </div>
        {commonPanel(true)}
      </div>
    );
  }

  return (
    <div className="main-layout">
      {commonHeader}
      {commonMapView}
      {commonPanel(false)}
    </div>
  );
}
