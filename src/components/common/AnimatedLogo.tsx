import motionLogo from "@/assets/motion-logo.png";
import "./AnimatedLogo.css";

interface AnimatedLogoProps {
  className?: string;
  height?: string | number;
}

export function AnimatedLogo({ className = "", height = "1.5rem" }: AnimatedLogoProps) {
  const heightValue = typeof height === 'number' ? `${height}px` : height;

  return (
    <img
      src={motionLogo}
      alt="Motion Logo"
      className={`animated-logo ${className}`}
      style={{
        height: heightValue,
        objectFit: "contain"
      }}
    />
  );
}

