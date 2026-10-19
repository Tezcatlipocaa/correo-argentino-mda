import React, { type ReactNode, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import { Icon } from "@iconify/react";

export interface ActionButtonProps {
  id?: string;
  href?: string;
  target?: string;
  rel?: string;
  icon?: string;
  label?: ReactNode;
  shortLabel?: ReactNode;
  labelId?: string;
  ariaLabel?: string;
  title?: string;
  size?: "xs" | "sm" | "md" | "default";
  iconSize?: number;
  color?: string;
  variant?: "solid" | "soft" | "outline" | "ghost";
  ghost?: boolean;
  outline?: boolean;
  circle?: boolean;
  square?: boolean;
  block?: boolean;
  active?: boolean;
  disabled?: boolean;
  iconClass?: string;
  type?: "button" | "submit" | "reset";
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  children?: ReactNode;
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  anchorProps?: AnchorHTMLAttributes<HTMLAnchorElement>;
}

const sizeMap: Record<string, string> = {
  xs: "btn-xs",
  sm: "btn-sm",
  md: "btn-sm md:btn-md",
  default: "btn-sm md:btn-md",
};

export default function ActionButton({
  id,
  href,
  target,
  rel,
  icon,
  label,
  shortLabel,
  labelId,
  ariaLabel,
  title,
  size = "default",
  iconSize,
  color = "btn-secondary",
  variant,
  ghost = false,
  outline = false,
  circle = false,
  square = false,
  block = false,
  active = false,
  disabled = false,
  iconClass = "",
  type = "button",
  className = "",
  onClick,
  children,
  buttonProps,
  anchorProps,
}: ActionButtonProps) {
  const isXs = size === "xs";
  const resolvedIconSize = iconSize ?? (isXs ? 14 : 18);

  const resolvedVariant = ghost ? "ghost" : (variant ?? (outline ? "outline" : "solid"));
  let variantClass = color;
  if (resolvedVariant === "ghost") {
    variantClass = "btn-ghost";
  } else if (resolvedVariant === "soft") {
    variantClass = `btn-soft ${color}`.trim();
  } else if (resolvedVariant === "outline") {
    variantClass = `btn-outline ${color}`.trim();
  }

  const circleClass = circle ? "btn-circle" : "";
  const squareClass = square ? "btn-square" : "";
  const blockClass = block ? "btn-block" : "";
  const activeClass = active ? "btn-active" : "";
  const sizeClass = sizeMap[size] || sizeMap.default;
  const combinedClasses = `btn group ${sizeClass} ${variantClass} ${circleClass} ${squareClass} ${blockClass} ${activeClass} gap-2 ${className}`
    .replace(/\s+/g, " ")
    .trim();

  const content = (
    <>
      {icon && (
        <Icon
          icon={icon}
          width={resolvedIconSize}
          height={resolvedIconSize}
          className={`shrink-0 ${iconClass}`}
          aria-hidden="true"
        />
      )}
      {shortLabel ? (
        <>
          <span className="inline xl:hidden">{shortLabel}</span>
          <span id={labelId} className="hidden xl:inline">
            {label}
          </span>
        </>
      ) : (
        label && <span id={labelId}>{label}</span>
      )}
      {children}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        id={id}
        target={target}
        rel={rel}
        title={title}
        className={combinedClasses}
        aria-label={ariaLabel}
        onClick={onClick}
        {...anchorProps}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      id={id}
      title={title}
      className={combinedClasses}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      {...buttonProps}
    >
      {content}
    </button>
  );
}
