import { useState, useEffect, useRef } from 'react';
import type { Address, LocationType, LocationResult } from '../types';
import { useLocationSearch } from '../hooks/useLocationSearch';
import { mapProvider } from '../providers/ProviderManager';
import './LocationInput.css';

interface Props {
  placeholder?: string;
  value: Address | null;
  onChange: (address: Address | null) => void;
  proximity?: [number, number];
  id?: string;
}

const TYPE_ICONS: Record<LocationType, string> = {
  poi: '🏢',
  city: '🏙️',
  address: '🏠',
  street: '🛣️',
  district: '📍',
  region: '🗺️',
  country: '🌍',
  locality: '🏙️',
  place: '📍',
  neighborhood: '🏘️',
  transport: '🚌',
  unknown: '📍'
};

export default function LocationInput({ placeholder = 'Digite um endereço...', value, onChange, proximity, id }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [isFocused, setIsFocused] = useState(false);

  const {
    query,
    setQuery,
    suggestions,
    loading,
    setOpen,
    refreshSession,
    handleChange,
    filteredHistory,
    handleSelect,
    clear
  } = useLocationSearch(mapProvider, value?.label ?? '', proximity);

  const lastPropLabelRef = useRef<string | null>(value?.label ?? null);

  useEffect(() => {
    if (value?.label !== lastPropLabelRef.current) {
      setQuery(value?.label ?? '');
      lastPropLabelRef.current = value?.label ?? null;
    }
  }, [value, setQuery]);


  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    handleChange(val);
    if (val === '') {
      onChange(null);
      lastPropLabelRef.current = null;
    }
  };

  const handleClear = () => {
    clear(() => {
      onChange(null);
      lastPropLabelRef.current = null;
    });
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    refreshSession();
    // Re-open if we have query
    if (query.trim().length >= 3) setOpen(true);
    
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const highlightMatch = (text: string, match: string) => {
    if (!match) return text;
    const parts = text.split(new RegExp(`(${match})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === match.toLowerCase() ? <strong key={i}>{part}</strong> : part
    );
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setOpen]);

  // Position logic removed - using standard absolute positioning in CSS

  // Show dropdown if focused and (has history OR has query results)
  const showDropdown = isFocused && (filteredHistory.length > 0 || suggestions.length > 0 || (query.length >= 3 && loading));

  return (
    <div className="location-input" ref={containerRef}>
      <div className="location-input__field">
        <span className="location-input__icon">📍</span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={onInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          className="location-input__input"
        />
        {loading && <span className="location-input__spinner" />}
        {!loading && query && (
          <button type="button" className="location-input__clear" onClick={handleClear}>✕</button>
        )}
      </div>
      
      {showDropdown && (
        <div className="location-input__dropdown">
          {/* History Match Section (Top Priority) */}
          {filteredHistory.length > 0 && (
            <div className="location-input__history">
              <div className="location-input__history-title">
                {!query ? 'LOCAIS RECENTES' : 'ENCONTRADO NO HISTÓRICO'}
              </div>
              <ul className="location-input__list">
                {filteredHistory.map((h: Address, i: number) => (
                  <li key={`hist-${i}`} className="location-input__option" onMouseDown={() => handleSelect(h as any, onChange)}>
                    <span className="location-input__option-icon">🕒</span>
                    <div className="location-input__option-text">
                      <div className="location-input__option-label">{highlightMatch(h.label || h.name || '', query)}</div>
                      <div className="location-input__option-sublabel">Recente</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Search Suggestions Section */}
          {loading && suggestions.length === 0 ? (
            <div className="location-input__status">Buscando...</div>
          ) : suggestions.length > 0 ? (
            <ul className="location-input__list">
              {suggestions.map((s: LocationResult, i: number) => (
                <li key={s.id || i} className="location-input__option" onMouseDown={() => handleSelect(s, onChange)}>
                  <span className="location-input__option-icon">{TYPE_ICONS[s.type as LocationType || 'unknown']}</span>
                  <div className="location-input__option-text">
                    <div className="location-input__option-label">{highlightMatch(s.name, query)}</div>
                    <div className="location-input__option-sublabel">
                      {s.fullAddress.includes(s.name) ? s.fullAddress.replace(s.name, '').replace(/^,\s*/, '') : s.fullAddress}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : query.length >= 3 && !loading && filteredHistory.length === 0 ? (
            <div className="location-input__status">Nenhum resultado encontrado.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
