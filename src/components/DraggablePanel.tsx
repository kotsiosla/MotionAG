import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface DraggablePanelProps {
  children: ReactNode;
  initialPosition?: { x: number; y: number };
  className?: string;
  onPositionChange?: (position: { x: number; y: number }) => void;
  zIndex?: number;
}

export function DraggablePanel({
  children,
  initialPosition = { x: 16, y: 16 },
  className = '',
  onPositionChange,
  zIndex = 1000,
}: DraggablePanelProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Don't start drag if clicking on a button or interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[data-no-drag]')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = { x: clientX, y: clientY };
    positionStartRef.current = { x: position.x, y: position.y };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !panelRef.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    const parentRect = panelRef.current.parentElement?.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    
    if (!parentRect) return;
    
    // Calculate new position with bounds checking
    let newX = positionStartRef.current.x + deltaX;
    let newY = positionStartRef.current.y + deltaY;
    
    // Keep within parent bounds
    const maxX = parentRect.width - panelRect.width - 8;
    const maxY = parentRect.height - panelRect.height - 8;
    
    newX = Math.max(8, Math.min(newX, maxX));
    newY = Math.max(8, Math.min(newY, maxY));
    
    setPosition({ x: newX, y: newY });
    onPositionChange?.({ x: newX, y: newY });
  }, [isDragging, onPositionChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={panelRef}
      className={`absolute transition-shadow duration-200 ${isDragging ? 'shadow-2xl' : 'shadow-xl'} ${className}`}
      style={{
        left: position.x,
        top: position.y,
        zIndex: isDragging ? zIndex + 100 : zIndex,
      }}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
    >
      {children}
    </div>
  );
}
