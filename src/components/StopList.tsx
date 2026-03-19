import type { Passenger } from '../types';
import './StopList.css';

interface Props {
  origin: { label: string };
  destination: { label: string };
  orderedPassengers: Passenger[];
  /** Estimated arrival Date at each passenger stop (index-aligned with orderedPassengers) */
  stopEtas?: Date[];
}

const STOP_COLORS = ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4', '#76e4f7'];

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

type StopEntry =
  | { label: string; type: 'origin' | 'destination'; name: string; eta?: undefined }
  | { label: string; type: 'stop'; name: string; index: number; eta?: Date };

export default function StopList({ origin, destination, orderedPassengers, stopEtas }: Props) {
  const stops: StopEntry[] = [
    { label: origin.label, type: 'origin', name: 'Origem' },
    ...orderedPassengers.map((p, i): StopEntry => ({
      label: p.location.label,
      type: 'stop',
      name: p.name,
      index: i,
      eta: stopEtas?.[i],
    })),
    { label: destination.label, type: 'destination', name: 'Destino Final' },
  ];

  return (
    <div className="stop-list">
      {stops.map((stop, i) => {
        const stopIndex = stop.type === 'stop' ? stop.index : undefined;
        return (
          <div key={i} className="stop-item">
            <div className="stop-item__connector">
              {stop.type === 'origin' ? (
                <div className="stop-dot stop-dot--origin">🚗</div>
              ) : stop.type === 'destination' ? (
                <div className="stop-dot stop-dot--dest">🏁</div>
              ) : (
                <div
                  className="stop-dot stop-dot--passenger"
                  style={{ background: STOP_COLORS[(stopIndex ?? 0) % STOP_COLORS.length] }}
                >
                  {i}
                </div>
              )}
              {i < stops.length - 1 && <div className="stop-line" />}
            </div>
            <div className="stop-item__content">
              <div className="stop-item__top">
                <span className="stop-item__name">{stop.name}</span>
                {stop.eta && (
                  <span className="stop-item__eta">🕐 {formatTime(stop.eta)}</span>
                )}
              </div>
              <span className="stop-item__address">{stop.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
