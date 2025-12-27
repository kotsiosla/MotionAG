import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

interface ResizableDraggablePanelProps {
  children: ReactNode;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  className?: string;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  zIndex?: number;
  title?: string;
}

export function ResizableDraggablePanel({
  children,
  initialPosition = { x: 16, y: 16 },
  initialSize = { width: 320, height: 400 },
  minSize = { width: 200, height: 150 },
  maxSize = { width: 600, height: 800 },
  className = '',
  onPositionChange,
  onSizeChange,
  zIndex = 1000,
  title,
}: ResizableDraggablePanelProps) {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const sizeStartRef = useRef({ width: 0, height: 0 });

  // Update position when initialPosition changes
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition.x, initialPosition.y]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[data-no-drag]') || target.closest('.resize-handle')) {
      return;
    }
    
    // Only allow dragging from the header area
    if (!target.closest('.panel-header')) {
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

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = { x: clientX, y: clientY };
    sizeStartRef.current = { width: size.width, height: size.height };
    positionStartRef.current = { x: position.x, y: position.y };
  }, [size, position]);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (isDragging && panelRef.current) {
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      const parentRect = panelRef.current.parentElement?.getBoundingClientRect();
      if (!parentRect) return;
      
      let newX = positionStartRef.current.x + deltaX;
      let newY = positionStartRef.current.y + deltaY;
      
      const maxX = parentRect.width - size.width - 8;
      const maxY = parentRect.height - size.height - 8;
      
      newX = Math.max(8, Math.min(newX, maxX));
      newY = Math.max(8, Math.min(newY, maxY));
      
      setPosition({ x: newX, y: newY });
      onPositionChange?.({ x: newX, y: newY });
    }
    
    if (isResizing && resizeDirection) {
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      let newWidth = sizeStartRef.current.width;
      let newHeight = sizeStartRef.current.height;
      let newX = positionStartRef.current.x;
      let newY = positionStartRef.current.y;
      
      if (resizeDirection.includes('e')) {
        newWidth = Math.max(minSize.width, Math.min(maxSize.width, sizeStartRef.current.width + deltaX));
      }
      if (resizeDirection.includes('w')) {
        const widthDelta = Math.max(minSize.width, Math.min(maxSize.width, sizeStartRef.current.width - deltaX)) - sizeStartRef.current.width;
        newWidth = sizeStartRef.current.width + widthDelta;
        newX = positionStartRef.current.x - widthDelta;
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(minSize.height, Math.min(maxSize.height, sizeStartRef.current.height + deltaY));
      }
      if (resizeDirection.includes('n')) {
        const heightDelta = Math.max(minSize.height, Math.min(maxSize.height, sizeStartRef.current.height - deltaY)) - sizeStartRef.current.height;
        newHeight = sizeStartRef.current.height + heightDelta;
        newY = positionStartRef.current.y - heightDelta;
      }
      
      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
      onSizeChange?.({ width: newWidth, height: newHeight });
      onPositionChange?.({ x: newX, y: newY });
    }
  }, [isDragging, isResizing, resizeDirection, size.width, size.height, minSize, maxSize, onPositionChange, onSizeChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeDirection(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isResizing ? 
        (resizeDirection?.includes('e') || resizeDirection?.includes('w') ? 'ew-resize' : 
         resizeDirection?.includes('n') || resizeDirection?.includes('s') ? 'ns-resize' : 'move') 
        : 'grabbing';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp, resizeDirection]);

  return (
    <div
      ref={panelRef}
      className={`absolute transition-shadow duration-200 ${isDragging || isResizing ? 'shadow-2xl' : 'shadow-xl'} ${className}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: isDragging || isResizing ? zIndex + 100 : zIndex,
      }}
    >
      {/* Drag handle header */}
      <div 
        className="panel-header flex items-center gap-2 px-2 py-1.5 cursor-grab active:cursor-grabbing bg-card/80 backdrop-blur-sm rounded-t-lg border-b border-border/50"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        {title && <span className="text-xs font-medium text-muted-foreground">{title}</span>}
      </div>
      
      {/* Content */}
      <div className="h-[calc(100%-32px)] overflow-auto">
        {children}
      </div>
      
      {/* Resize handles */}
      <div 
        className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={(e) => handleResizeStart(e, 'se')}
        onTouchStart={(e) => handleResizeStart(e, 'se')}
      >
        <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-muted-foreground/50" />
      </div>
      <div 
        className="resize-handle absolute top-8 right-0 w-2 h-[calc(100%-48px)] cursor-ew-resize"
        onMouseDown={(e) => handleResizeStart(e, 'e')}
        onTouchStart={(e) => handleResizeStart(e, 'e')}
      />
      <div 
        className="resize-handle absolute bottom-0 left-0 w-[calc(100%-16px)] h-2 cursor-ns-resize"
        onMouseDown={(e) => handleResizeStart(e, 's')}
        onTouchStart={(e) => handleResizeStart(e, 's')}
      />
    </div>
  );
}
