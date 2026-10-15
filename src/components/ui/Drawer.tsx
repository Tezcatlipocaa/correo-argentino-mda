import React, { useEffect, useCallback, type ReactNode } from "react";
import { Icon } from "@iconify/react";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses: Record<NonNullable<DrawerProps["size"]>, string> = {
  sm: "max-w-xs",
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-2xl",
};

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  className = "",
}: DrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    },
    [open, onClose],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  const maxWidthClass = sizeClasses[size] || sizeClasses.md;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-200 ${
          open
            ? "visible opacity-100"
            : "invisible opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Detalles"}
        className={`bg-base-100 border-base-300 fixed inset-y-0 right-0 z-50 flex w-full flex-col justify-between border-l shadow-2xl transition-transform duration-300 ease-in-out ${maxWidthClass} ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        } ${className}`}
      >
        {/* Drawer Header */}
        <header className="border-base-200 flex items-start justify-between border-b p-5">
          <div className="space-y-1">
            {typeof title === "string" ? (
              <h3 className="text-base-content text-lg font-bold">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <div className="text-base-content/60 text-xs">{subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-base-content"
            aria-label="Cerrar panel"
          >
            <Icon icon="boxicons:x" width={20} height={20} />
          </button>
        </header>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {/* Optional Drawer Footer */}
        {footer && (
          <footer className="border-base-200 bg-base-200/50 border-t p-4">
            {footer}
          </footer>
        )}
      </aside>
    </>
  );
}
