import Image from "next/image";

/**
 * Quiet parent-company endorsement. Uses the final approved TeamFrame endorsed
 * lockup; `reversed` selects the light-text variant for dark backgrounds.
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
    ? "/brand/teamframe-endorsed-dark.svg"
    : "/brand/teamframe-endorsed-light.svg";
  const labelTone = reversed ? "text-white/55" : "text-ink-500";
  return (
    <div className={`flex flex-col gap-2 ${align === "center" ? "items-center text-center" : "items-start"} ${className}`}>
      <span className={`text-[10.5px] font-medium uppercase tracking-[0.2em] ${labelTone}`}>{label}</span>
      <Image src={src} alt="TeamFrame by TAKAVEN" width={1600} height={370} className="h-5 w-auto opacity-90" />
    </div>
  );
}
