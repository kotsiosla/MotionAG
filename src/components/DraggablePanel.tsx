import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

interface DraggablePanelProps {
  children: ReactNode;
  initialPosition?: { x: number; y: number };
  className?: string;
  onPositionChange?: (position: { x: number; y: number }) => void;
  zIndex?: number;
  showDragHandle?: boolean;
}

export function DraggablePanel({
  children,
  initialPosition = { x: 16, y: 16 },
  className = '',
  onPositionChange,
  zIndex = 1000,
  showDragHandle = true,
}: DraggablePanelProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
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
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Update position when initialPosition changes (for smart repositioning)
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition.x, initialPosition.y]);

  return (
    <div
      ref={panelRef}
      className={`absolute transition-shadow duration-200 ${isDragging ? 'shadow-2xl cursor-grabbing' : 'shadow-xl cursor-grab'} ${className}`}
      style={{
        left: position.x,
        top: position.y,
        zIndex: isDragging ? zIndex + 100 : zIndex,
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {showDragHandle && (
        <div
          className="absolute -left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 hover:opacity-100 transition-opacity z-10"
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          <div className="bg-card/80 backdrop-blur-sm rounded-l-lg h-12 flex items-center px-1 border border-r-0 border-border">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
      <div
        className={`${showDragHandle ? '' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={showDragHandle ? undefined : handleMouseDown}
        onTouchStart={showDragHandle ? undefined : handleMouseDown}
      >
        {children}
      </div>
    </div>
  );
}
