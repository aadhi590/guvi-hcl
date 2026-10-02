import { useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
}

// A persistent label (not placeholder-only — the field never loses context
// once filled in) with an accent border-highlight focus state and an
// inline error slot directly under the field, not a toast.
export default function Input({ label, error, id, className = "", ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-[#8A8F9C]">
        {label}
      </label>
      <input
        id={inputId}
        className={`rounded-lg border bg-white/[0.03] px-4 py-2.5 text-sm text-[#F2F0EA] outline-none transition-colors duration-200 placeholder:text-gray-600 ${
          error ? "border-red-500/50" : "border-white/[0.08] focus:border-[#7C6CF0]/60"
        } focus-visible:ring-2 focus-visible:ring-white/20 ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
