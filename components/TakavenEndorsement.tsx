import Image from "next/image";

/**
 * Quiet "Conceptualised by TAKAVEN" endorsement mark. Uses the official endorsed lockup from the
 * production asset pack (06_Endorsed_Takaven), with the solid background removed so it sits cleanly
 * on any surface. `reversed` selects the white-text variant for dark backgrounds.
 */
export function TakavenEndorsement({
  reversed = false,
  className = "",
  label = "Conceptualised by",
  align = "left",
}: {
  reversed?: boolean;
  className?: string;
  label?: string;
  align?: "left" | "center";
}) {
  const src = reversed
    ? "/brand/teamframe-by-takaven-reversed.svg"
    : "/brand/teamframe-by-takaven-primary.svg";
  const labelTone = reversed ? "text-white/55" : "text-ink-500";
  return (
    <div className={`flex flex-col gap-2 ${align === "center" ? "items-center text-center" : "items-start"} ${className}`}>
      <span className={`text-[10.5px] font-medium uppercase tracking-[0.2em] ${labelTone}`}>{label}</span>
      {/* Endorsed lockup natural size 808×198.12 (viewBox 70 47 …). */}
      <Image src={src} alt="TeamFrame — conceptualised by TAKAVEN" width={808} height={198} className="h-5 w-auto opacity-90" />
    </div>
  );
}
