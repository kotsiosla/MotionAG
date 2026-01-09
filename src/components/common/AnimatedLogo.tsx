import { useEffect, useState } from "react";
import motionLogo from "@/assets/motion-logo.svg";
import "./AnimatedLogo.css";

interface AnimatedLogoProps {
  className?: string;
  height?: string | number;
}

export function AnimatedLogo({ className = "", height = "1.5rem" }: AnimatedLogoProps) {
  const [direction, setDirection] = useState(0); // 0 = right, 180 = left
  const [isMoving, setIsMoving] = useState(true);

  useEffect(() => {
    // Change direction periodically like a bus on a route
    const interval = setInterval(() => {
      setDirection(prev => prev === 0 ? 180 : 0);
      // Pause briefly at "stops"
      setIsMoving(false);
      setTimeout(() => setIsMoving(true), 500);
    }, 5000); // Change direction every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const heightValue = typeof height === 'number' ? `${height}px` : height;

  return (
    <img 
      src={motionLogo} 
      alt="Motion Logo" 
      className={`animated-logo ${className} ${isMoving ? 'moving' : 'stopped'}`}
      style={{
        height: heightValue,
        transform: `scaleX(${direction === 180 ? -1 : 1})`,
        transition: 'transform 0.6s ease-in-out',
      }}
    />
  );
}

