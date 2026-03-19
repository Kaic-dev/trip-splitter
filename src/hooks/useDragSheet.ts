import { useState, useRef, useCallback, useEffect } from 'react';
import { useViewportHeight } from './useViewportHeight';

type SnapPosition = 'collapsed' | 'medium' | 'expanded';

interface DragSheetConfig {
  onSnap?: (position: SnapPosition) => void;
  initialPosition?: SnapPosition;
}

/**
 * Applies Apple-style rubber banding (elastic resistance)
 */
function applyRubberBand(offset: number, dimension: number): number {
  const constant = 0.55;
  return (constant * Math.abs(offset) * dimension) / (dimension + constant * Math.abs(offset)) * Math.sign(offset);
}

export function useDragSheet(config?: DragSheetConfig) {
  const [currentPos, setCurrentPos] = useState<SnapPosition>(config?.initialPosition || 'medium');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Otimização de leitura de layout (Reactive viewport)
  const viewportHeight = useViewportHeight();
  const viewportRef = useRef(viewportHeight);

  useEffect(() => {
    viewportRef.current = viewportHeight;
  }, [viewportHeight]);
  
  const startY = useRef(0);
  const startTime = useRef(0);
  const lastY = useRef(0);
  const rafId = useRef<number | null>(null);

  // 3. Garantir limpeza no unmount
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const getSnapY = useCallback((pos: SnapPosition) => {
    const isMobile = viewportRef.current <= 768;
    switch (pos) {
      case 'collapsed': return viewportRef.current - 92;
      case 'medium':    return viewportRef.current * 0.45; // Slightly lower for better map visibility
      case 'expanded':  return isMobile ? 120 : viewportRef.current * 0.2; // 20% on web, 120px constant on mobile
      default:          return viewportRef.current * 0.45;
    }
  }, [viewportRef.current]);

  const onTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    // 2. Cancelamento seguro de RAF
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    const touch = e instanceof TouchEvent ? e.touches[0] : e.touches[0];
    startY.current = touch.clientY;
    lastY.current = touch.clientY;
    startTime.current = Date.now();
    setIsDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!isDragging) return;
    const touch = e instanceof TouchEvent ? e.touches[0] : e.touches[0];
    const deltaY = touch.clientY - startY.current;
    
    // 6. Evitar jitter em micro movimentos
    if (Math.abs(deltaY) < 0.5) return;

    const currentBaseY = getSnapY(currentPos);
    const limitTop = getSnapY('expanded');
    const limitBottom = getSnapY('collapsed');
    
    // Limits
    const TOP_LIMIT = 80;
    const BOTTOM_LIMIT = viewportRef.current - 60;
    
    const rawTargetY = currentBaseY + deltaY;
    const clampedTargetY = Math.max(TOP_LIMIT - 30, Math.min(BOTTOM_LIMIT + 60, rawTargetY));
    
    let finalDelta = 0;
    if (clampedTargetY < limitTop) {
      const overdrag = clampedTargetY - limitTop;
      finalDelta = (limitTop - currentBaseY) + applyRubberBand(overdrag, viewportRef.current);
    } else if (clampedTargetY > limitBottom) {
      const overdrag = clampedTargetY - limitBottom;
      finalDelta = (limitBottom - currentBaseY) + applyRubberBand(overdrag, viewportRef.current);
    } else {
      finalDelta = clampedTargetY - currentBaseY;
    }

    if (e.cancelable) e.preventDefault();

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      setDragOffset(finalDelta);
      lastY.current = touch.clientY;
    });
  }, [isDragging, currentPos, getSnapY, viewportRef.current]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const TOP_LIMIT = 80;
    const BOTTOM_LIMIT = viewportRef.current - 60;
    const duration = Math.max(1, Date.now() - startTime.current);
    const distance = lastY.current - startY.current;
    const currentBaseY = getSnapY(currentPos);
    
    const MAX_VELOCITY = 2.5;
    const velocityWithDirection = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, distance / duration));
    
    // 5. Reduzir sensibilidade do flick (ajuste para 140)
    const projectionFactor = 140; 
    let projectedY = currentBaseY + distance + (velocityWithDirection * projectionFactor);
    
    // 4. Clamp mais rígido na projeção
    projectedY = Math.max(TOP_LIMIT, Math.min(BOTTOM_LIMIT, projectedY));
    
    const snaps: SnapPosition[] = ['expanded', 'medium', 'collapsed'];
    let target: SnapPosition = currentPos;
    let minDistance = Infinity;

    snaps.forEach(pos => {
      const d = Math.abs(projectedY - getSnapY(pos));
      if (d < minDistance) {
        minDistance = d;
        target = pos;
      }
    });

    setDragOffset(0);
    if (target !== currentPos) {
      setCurrentPos(target);
      config?.onSnap?.(target);
    }
  }, [isDragging, currentPos, getSnapY, config, viewportRef.current]);

  // 1. Clamp também no limite inferior (consistência visual)
  const TOP_LIMIT = 80;
  const BOTTOM_LIMIT = viewportRef.current - 60;
  const rawAbsoluteY = getSnapY(currentPos) + dragOffset;
  const visualY = Math.max(TOP_LIMIT, Math.min(BOTTOM_LIMIT, rawAbsoluteY));

  return {
    isDragging,
    currentPos,
    visualY,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd
    },
    style: {
      transform: `translateY(${visualY}px)`,
      transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.3, 1)',
      willChange: 'transform'
    }
  };
}
