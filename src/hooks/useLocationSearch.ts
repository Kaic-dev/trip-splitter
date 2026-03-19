import { useState, useRef, useCallback, useMemo } from 'react';
import type { LocationResult, Address } from '../types';
import type { MapProvider } from '../providers/MapProvider';
import { searchCache } from '../core/cache';
import { normalizeString } from '../core/normalization';
import { useLocationHistory } from './useLocationHistory';
import { createLogger, classifyLocation, Logger, flowManager } from '../core/logger';

const logger = createLogger('Search');

interface UseLocationSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  suggestions: LocationResult[];
  loading: boolean;
  open: boolean;
  setOpen: (o: boolean) => void;
  refreshSession: () => void;
  handleChange: (val: string) => void;
  handleSelect: (s: LocationResult, onChange: (address: Address) => void) => Promise<void>;
  clear: (onClear?: () => void) => void;
}

function getDistance(coord1: [number, number], coord2: [number, number]): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  return Math.sqrt(Math.pow(lng1 - lng2, 2) + Math.pow(lat1 - lat2, 2));
}

export function useLocationSearch(
  provider: MapProvider, 
  initialQuery: string = '', 
  proximity?: [number, number]
): UseLocationSearchReturn & { 
  history: Address[], 
  filteredHistory: Address[],
  saveToHistory: (a: Address) => void 
} {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  
  const { history, saveLocation } = useLocationHistory();
  
  const prefixCache = useRef<Map<string, LocationResult[]>>(new Map());
  const lastSuccessfulQuery = useRef<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFlowId = useRef<string | null>(null);

  // Filter history based on query (Uber-style: show matches while typing)
  const filteredHistory = useMemo(() => {
    if (!query) return history.slice(0, 5);
    const norm = normalizeString(query);
    return history.filter(h => 
      normalizeString(h.label || '').includes(norm) || 
      normalizeString(h.name || '').includes(norm)
    ).slice(0, 3);
  }, [history, query]);

  const getSessionToken = useCallback(() => {
    if (sessionToken) return sessionToken;
    const newToken = crypto.randomUUID();
    setSessionToken(newToken);
    return newToken;
  }, [sessionToken]);

  const refreshSession = useCallback(() => {
    setSessionToken(crypto.randomUUID());
    prefixCache.current.clear(); 
  }, []);

  const search = useCallback(async (q: string, flowId: string) => {
    const cleanQ = q.trim();
    if (cleanQ.length < 3) return;
    
    const norm = normalizeString(cleanQ);
    const token = getSessionToken();

    if (norm === lastSuccessfulQuery.current) return;

    const flowLogger = logger.withFlow(flowId);
    flowLogger.group(`SEARCH: "${q}"`, { input: q });
    
    flowLogger.info("INPUT TRACE", {
      raw: q,
      normalized: norm,
      proximity: proximity ? proximity.join(',') : 'NONE'
    });

    const rankResults = (list: LocationResult[]) => {
      const flowContext = flowManager.create(flowId);
      flowContext.inputRaw = q;

      // 1. Detect Intent
      const streetKeywords = ['rua', 'avenida', 'av.', 'r.', 'alameda', 'travessa', 'rodovia', 'estrada'];
      const poiKeywords = ['atacad', 'mercado', 'shopp', 'restaurante', 'bar', 'posto', 'hotel', 'hospital'];
      
      const hasStreetIntent = streetKeywords.some(k => norm.includes(k));
      const hasPOIIntent = poiKeywords.some(k => norm.includes(k));
      const detectedIntent = hasStreetIntent ? 'STREET' : (hasPOIIntent ? 'POI' : 'GENERAL');
      
      const signals = [];
      if (hasStreetIntent) signals.push('prefix: rua/av');
      if (hasPOIIntent) signals.push('poi_keyword_hit');
      if (/\d/.test(norm)) signals.push('contains_numbers');
      if (norm.length < 5) signals.push('short query');
      if (!hasPOIIntent) signals.push('no POI keywords');

      flowLogger.info("INTENT ANALYSIS", {
        detected: detectedIntent,
        confidence: hasStreetIntent || hasPOIIntent ? 0.92 : 0.5,
        signals
      });

      flowManager.update(flowId, { interpretedIntent: detectedIntent });
      flowManager.addExplanation(flowId, `Interpreted input as ${detectedIntent} (conf: ${hasStreetIntent || hasPOIIntent ? '92%' : '50%'})`);
      if (hasStreetIntent) flowManager.addExplanation(flowId, "Street intent detected → POIs penalized");

      const scored = list.map(item => {
        if (!proximity) return { item, score: 0.5, dist: 0, reasons: ['GLOBAL_SEARCH'] };
        
        const d = getDistance(item.coordinates, proximity);
        const normName = normalizeString(item.name);
        
        // 1. Text Similarity (0 to 1)
        const similarity = 1 - Math.abs(normName.length - norm.length) / Math.max(normName.length, norm.length, 1);
        const isExact = normName === norm;
        const isPrefix = normName.startsWith(norm);
        
        // 2. Proximity Decay (0 to 1) - Sharper decay to favor very close results
        const proximityScore = Math.exp(-d * 5); 

        // 3. Provider Relevance (0 to 1)
        const relevance = item.relevance || 0.5;

        // --- Weighted Scoring ---
        let baseScore = relevance * 0.3; // Base weight for API relevance
        
        if (isExact) baseScore += 0.4;
        else if (isPrefix) baseScore += 0.2;
        else if (normName.includes(norm)) baseScore += 0.1;

        // Proximity contribution
        baseScore += proximityScore * 0.3;

        // Intent logic
        const isPOI = item.type === 'poi';
        const isTransport = (item.type as string) === 'transport' || item.name.toLowerCase().includes('linha');

        if (isPOI && (hasPOIIntent || isPrefix)) baseScore += 0.2;
        if (hasStreetIntent && isPOI) baseScore -= 0.5;
        if (isTransport && !norm.includes('linha')) baseScore -= 0.7;

        // Micro-discrimination (Epsilon)
        const epsilon = (similarity * 0.05) + ((1 / (d + 0.1)) * 0.01);
        
        const finalScore = Math.max(0.01, Math.min(0.999, (baseScore * 0.8) + epsilon));
        
        const reasons: string[] = [];
        if (isExact) reasons.push('exact match');
        if (proximityScore > 0.8) reasons.push('very close');
        if (hasPOIIntent && isPOI) reasons.push('POI priority');
        if (reasons.length === 0) reasons.push('relevance');

        // Rejection logic for alternatives
        let rejectionReason = !isExact && similarity < 0.6 ? 'LOWER_TEXT_SIMILARITY' : 
                               (proximityScore < 0.3 ? 'FURTHER_DISTANCE' : 'LOWER_SCORE');
        
        if (hasStreetIntent && isPOI) rejectionReason = 'Filtered by STREET intent';

        return { 
          item, 
          score: finalScore, 
          dist: d, 
          reasons,
          rejectionReason
        };
      });

      if (!proximity) return list;

      const initialSorted = scored.sort((a, b) => b.score - a.score);

      // --- Diversity Pass: Redundancy Penalty ---
      const nameCounts = new Map<string, number>();
      const diversified = initialSorted.map(s => {
        const name = normalizeString(s.item.name);
        const count = nameCounts.get(name) || 0;
        nameCounts.set(name, count + 1);
        
        if (count > 0) {
          return { 
            ...s, 
            score: s.score - (count * 0.15), 
            reasons: [...s.reasons, `redundancy penalty #${count + 1}`] 
          };
        }
        return s;
      });

      const sorted = diversified.sort((a, b) => b.score - a.score);
      const topN = window.DEBUG_LOGS ? 5 : 3;
      const displayList = sorted.slice(0, topN); // NEW: Quality & Geo Analysis
      if (sorted.length > 0) {
        const top = sorted[0];
        const second = sorted[1];
        const gap = second ? top.score - second.score : 1;
        const gapPct = (gap * 100).toFixed(1) + '%';
        const maxDistTop3 = Math.max(...sorted.slice(0, 3).map(s => s.dist)) - Math.min(...sorted.slice(0, 3).map(s => s.dist));
        
        // --- 1. COMPETITION & AMBIGUITY ANALYSIS ---
        if (gap < 0.05 && second) {
          flowLogger.warn("AMBIGUITY", {
            top3Gap: gapPct,
            suggestion: 'User may need manual selection due to high competition'
          });
          
          flowLogger.warn("HIGH COMPETITION", {
            top: top.item.name,
            runnerUp: second.item.name,
            scoreDiff: gapPct,
            distanceDiff: `${Math.abs(Math.round((top.dist - second.dist) * 1000))}m`,
            risk: "USER MAY MEAN EITHER"
          });
          flowManager.addExplanation(flowId, `High ambiguity between top results (${gapPct} gap)`);
        } else {
          flowManager.addExplanation(flowId, "Low ambiguity between top 3 results");
        }

        // --- 2. REJECTION ANALYSIS ---
        flowLogger.debug("REJECTION ANALYSIS", sorted.slice(1, 5).map(s => ({
          name: s.item.name,
          reason: s.rejectionReason === 'FURTHER_DISTANCE' ? `Too far (+${Math.round(Math.abs(s.dist - top.dist)*1000)}m)` : s.rejectionReason
        })));

        // --- 3. GEO INTELLIGENCE ---
        flowLogger.info("GEO CONSISTENCY", {
          clusterRadius: `${Math.round(maxDistTop3 * 1000)}m`,
          density: maxDistTop3 < 0.05 ? 'HIGH' : 'LOW',
          conclusion: maxDistTop3 < 0.1 ? "ALL RESULTS IN SAME AREA" : "RESULTS ARE DISPERSED"
        });

        // --- 4. UX RISK SIGNALS ---
        if (gap < 0.03 && maxDistTop3 < 0.05) {
          flowLogger.uxSuggestion({
            action: "ask_user_confirmation",
            reason: "Multiple similar streets within 50m radius. High collision risk."
          });
          flowManager.addExplanation(flowId, "Collision risk detected: Multiple similar locations in small radius");
        }

        flowLogger.table("TOP RESULTS", displayList.map((s, i) => ({
          rank: i + 1,
          name: s.item.name,
          score: (s.score * 100).toFixed(1) + '%',
          distance: s.dist < 1 ? `${Math.round(s.dist * 1000)}m` : `${s.dist.toFixed(1)}km`,
          type: classifyLocation(s.item),
          reasons: s.reasons.join(', ')
        })));

        // --- 5. DECISION BREAKDOWN ---
        flowLogger.decision("WHY THIS RESULT", {
          selected: top.item.name,
          confidence: gap > 0.1 ? 'HIGH' : (gap > 0.04 ? 'MEDIUM' : 'LOW'),
          breakdown: {
            distance: top.dist < 0.5 ? 'STRONG' : 'NORMAL',
            textMatch: top.reasons.includes('exact match') ? 'EXACT' : 'PARTIAL',
            competition: gap < 0.05 ? 'HIGH' : 'LOW',
            scoreGap: gapPct
          }
        });
        
        const distNote = top.dist < 0.1 ? `proximity (${Math.round(top.dist*1000)}m)` : 'relevance';
        flowManager.addExplanation(flowId, `Top result chosen due to ${distNote}`);

        // Store metadata for selection
        const searchMetadata = {
          confidence: gap > 0.1 ? 'HIGH' : (gap > 0.04 ? 'MEDIUM' : 'LOW'),
          metadata: {
            competition: gap < 0.05,
            scoreGap: gapPct,
            ambiguity: gap < 0.03,
            alternativesClose: sorted.slice(1, 4).filter(s => s.dist < 0.1).length
          }
        };
        (top.item as any)._searchMetadata = searchMetadata;
        
        flowManager.update(flowId, { 
          selectedEntity: top.item.name,
          alternatives: displayList.slice(1).map(s => ({ name: s.item.name, score: s.score, type: classifyLocation(s.item) }))
        });

        flowLogger.final("SEARCH RESULT", {
          input: q,
          interpretedAs: detectedIntent,
          selected: top.item.name,
          confidence: searchMetadata.confidence,
          ambiguity: gap < 0.05,
          alternativesClose: searchMetadata.metadata.alternativesClose
        });
      }

      return sorted.map(s => s.item);
    };

    // Prefix Cache Hit
    for (let i = norm.length - 1; i >= 3; i--) {
      const prefix = norm.substring(0, i);
      if (prefixCache.current.has(prefix)) {
        const cached = prefixCache.current.get(prefix)!;
        const filtered = cached.filter(s => 
          normalizeString(s.name).includes(norm) || 
          normalizeString(s.fullAddress).includes(norm)
        );

        if (filtered.length >= 2) {
          const ranked = rankResults(filtered);
          flowLogger.success(`CACHE HIT (Prefix): "${prefix}"`, { matches: filtered.length });
          setSuggestions(ranked);
          setOpen(true);
          flowLogger.groupEnd();
          return; 
        }
      }
    }

    const proximityStr = proximity ? `${proximity[0]},${proximity[1]}` : 'default';
    const cacheKey = `search|${norm}|${token}|${proximityStr}`;
    
    setLoading(true);
    const start = performance.now();
    let cacheHit = false;

    try {
      const results = await searchCache.getOrFetch(cacheKey, async () => {
        const fetched = await provider.searchLocation(q, token, proximity);
        return fetched;
      }, { onStatus: (status) => { cacheHit = (status === 'HIT'); } });
      
      const searchEnd = performance.now();
      const ranked = rankResults(results);
      const rankEnd = performance.now();
      
      if (cacheHit) {
        flowLogger.cacheImpact("Search API", {
          savedRequests: 1,
          avoidedLatencyMs: 150, // Approximation
          source: "MEMORY_CACHE"
        });
      }

      flowLogger.timing("SEARCH FLOW", performance.now() - start, {
        network: cacheHit ? 0 : Math.round(searchEnd - start),
        ranking: Math.round(rankEnd - searchEnd)
      });
      
      if (ranked.length > 0) {
        prefixCache.current.set(norm, ranked);
      } else {
        flowLogger.warn('No results found for query');
      }

      lastSuccessfulQuery.current = norm;
      setSuggestions(ranked);
      setOpen(true);
    } catch (err) {
      flowLogger.error('Search failed', err);
    } finally {
      setLoading(false);
      flowLogger.groupEnd();
    }
  }, [getSessionToken, provider, proximity]);

  const handleChange = useCallback((val: string) => {
    setQuery(val);
    const flowId = Logger.createFlowId(); 
    currentFlowId.current = flowId;
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(val, flowId), 500);
  }, [search]);

  const handleSelect = async (s: LocationResult, onChange: (address: Address) => void) => {
    const flowId = currentFlowId.current || Logger.createFlowId();
    const flowLogger = flowId ? logger.withFlow(flowId) : logger;
    flowLogger.group('SELECTION', { label: s.name });

    // Initialize flow context if it doesn't exist (e.g. from history or deep link)
    if (flowId && !flowManager.get(flowId)) {
      const ctx = flowManager.create(flowId);
      ctx.inputRaw = s.name;
    }
    
    flowManager.update(flowId, { selectedEntity: s.name });
    flowLogger.info("USER CHOICE", { label: s.name, type: classifyLocation(s), source: s.id ? 'searchbox' : 'geocoding' });

    const isPOI = s.type === 'poi' || s.source === 'searchbox';
    const bestLabel = isPOI ? s.name : s.fullAddress;
    
    setQuery(bestLabel);
    setSuggestions([]);
    setOpen(false);
    
    const address: Address = { 
      ...s, 
      label: bestLabel, 
      coordinates: s.coordinates,
      flowId,
      confidence: (s as any)._searchMetadata?.confidence || 'HIGH',
      searchMetadata: (s as any)._searchMetadata?.metadata
    };

    const finalize = (addr: Address) => {
      onChange(addr);
      saveLocation(addr); 
      refreshSession();
      
      flowLogger.info("RESOLUTION", {
        coords: addr.coordinates.join(','),
        precision: addr.coordinates[0] !== 0 ? 'ROOFTOP' : 'APPROX'
      });

      flowLogger.success('FINAL LOCATION', { 
        label: addr.label,
        type: classifyLocation(addr)
      });
      
      flowLogger.final('Flow Completed Successfully', {
        input: query,
        selected: addr.label,
        type: classifyLocation(addr),
        flowId
      });
      
      flowLogger.groupEnd();
    };

    if (s.source === 'searchbox' && (s.coordinates[0] === 0 || s.coordinates[1] === 0)) {
      setLoading(true);
      try {
        const coords = await provider.retrieveCoordinates(s.id, sessionToken);
        finalize({ ...address, coordinates: coords });
      } catch (err) {
        flowLogger.error('Error retrieving coordinates', err);
        flowLogger.groupEnd();
      } finally {
        setLoading(false);
      }
    } else {
      finalize(address);
    }
  };

  const clear = (onClear?: () => void) => {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    setSessionToken(''); 
    if (onClear) onClear();
  };

  return { 
    query, 
    setQuery, 
    suggestions, 
    loading, 
    open, 
    setOpen, 
    refreshSession, 
    handleChange, 
    handleSelect, 
    clear,
    history,
    filteredHistory,
    saveToHistory: saveLocation
  };
}
