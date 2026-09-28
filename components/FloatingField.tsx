import type { InputHTMLAttributes } from "react";

type FloatingFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder"> & {
  label: string;
  error?: boolean;
};

/**
 * Canonical TeamFrame input interaction: open left/bottom geometry at rest,
 * a complete outline on focus or value, and a label that clears the value.
 */
export function FloatingField({ label, error = false, className = "", id, name, ...props }: FloatingFieldProps) {
  const controlId = id ?? name;

  return (
    <label className={`tf-floating-field${error ? " tf-floating-field-error" : ""}`} htmlFor={controlId}>
      <input
        {...props}
        id={controlId}
        name={name}
        placeholder=" "
        aria-invalid={error || undefined}
        className={`tf-floating-input ${className}`}
      />
      <span className="tf-floating-label">{label}</span>
    </label>
  );
}
