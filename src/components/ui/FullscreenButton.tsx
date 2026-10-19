import React from "react";
import ActionButton from "./ActionButton";

export interface FullscreenButtonProps {
  isFullscreen?: boolean;
  onToggle?: () => void;
  targetLabel?: string;
  size?: "xs" | "sm" | "md" | "default";
  variant?: "solid" | "soft" | "outline" | "ghost";
  className?: string;
  label?: React.ReactNode;
}

export default function FullscreenButton({
  isFullscreen = false,
  onToggle,
  targetLabel = "pantalla completa",
  size = "sm",
  variant = "ghost",
  className = "",
  label,
}: FullscreenButtonProps) {
  return (
    <ActionButton
      type="button"
      variant={variant}
      size={size}
      onClick={onToggle}
      icon={isFullscreen ? "boxicons:fullscreen-exit" : "boxicons:fullscreen"}
      iconSize={16}
      title={isFullscreen ? "Salir de pantalla completa" : "Ver en pantalla completa"}
      ariaLabel={isFullscreen ? `Salir de pantalla completa (${targetLabel})` : `Ver ${targetLabel} en pantalla completa`}
      className={className}
      label={label}
    />
  );
}
