import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50";

const SIZES: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm md:text-base",
  sm: "px-4 py-2 text-sm",
};

// Primary is the ONE accent-colored element allowed per screen — reach for
// secondary/ghost for everything else, even other prominent actions.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-[#7C6CF0] text-white hover:bg-[#6A5ADE]",
  secondary: "bg-white/10 text-gray-100 backdrop-blur-sm hover:bg-white/15",
  ghost: "text-gray-300 hover:text-white",
  danger: "border border-red-500/30 text-red-400 hover:bg-red-500/10",
};

/** Returns the exact class string a Button renders, for non-<button> elements (e.g. <Link>) that need identical styling. */
export function buttonVariants(variant: Variant = "primary", size: Size = "md", className = "") {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonVariants(variant, size, className)} {...props} />;
}
