import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  threshold?: number; // pixels to pull before triggering refresh
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
  threshold = 80,
}: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const canPull = useCallback(() => {
    if (disabled || isRefreshing) return false;
    
    // Only allow pull when at the top of the scroll container
    const container = containerRef.current;
    if (!container) return false;
    
    // Check if we're at the top
    return container.scrollTop <= 0;
  }, [disabled, isRefreshing]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!canPull()) return;
    
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
  }, [canPull]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!canPull()) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    // Only pull down, not up
    if (diff > 0) {
      // Apply resistance - pulling gets harder the further you go
      const resistance = 0.4;
      const adjustedDiff = diff * resistance;
      
      setIsPulling(true);
      setPullDistance(Math.min(adjustedDiff, threshold * 1.5));
      
      // Prevent default scrolling when pulling
      if (adjustedDiff > 10) {
        e.preventDefault();
      }
    }
  }, [canPull, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6); // Snap to refresh position
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setIsPulling(false);
    setPullDistance(0);
  }, [isPulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const showIndicator = isPulling || isRefreshing;

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      style={{ touchAction: isPulling ? 'none' : 'auto' }}
    >
      {/* Pull indicator */}
      <div 
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center z-10 pointer-events-none transition-opacity duration-200",
          showIndicator ? "opacity-100" : "opacity-0"
        )}
        style={{ 
          top: 0,
          height: pullDistance,
          transform: `translateY(${Math.max(0, pullDistance - 40)}px)`,
        }}
      >
        <div 
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20",
            isRefreshing && "animate-pulse"
          )}
        >
          <RefreshCw 
            className={cn(
              "h-5 w-5 text-primary transition-transform duration-200",
              isRefreshing && "animate-spin"
            )}
            style={{ 
              transform: isRefreshing 
                ? undefined 
                : `rotate(${pullProgress * 180}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content with pull offset */}
      <div 
        style={{ 
          transform: showIndicator ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>

      {/* Pull hint text */}
      {isPulling && !isRefreshing && (
        <div 
          className="absolute top-2 left-0 right-0 text-center text-xs text-muted-foreground pointer-events-none transition-opacity"
          style={{
            opacity: pullProgress > 0.3 ? 1 : 0,
            transform: `translateY(${pullDistance - 20}px)`,
          }}
        >
          {pullProgress >= 1 ? 'Άφησε για ανανέωση' : 'Τράβηξε για ανανέωση'}
        </div>
      )}
    </div>
  );
}
