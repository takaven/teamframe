export function RollingLoader({ label = "Loading workspace", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <span className={`tf-rolling-loader${compact ? " tf-rolling-loader-compact" : ""}`} role="status" aria-label={label}>
      <span className="tf-loader-track" aria-hidden="true">
        <span className="tf-loader-ball">
          <span className="tf-loader-stripes">
            {Array.from({ length: 10 }, (_, index) => <span key={index} />)}
          </span>
        </span>
      </span>
    </span>
  );
}
