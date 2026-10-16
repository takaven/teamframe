import Image from "next/image";

/** Quiet parent-company endorsement using the approved standalone TAKAVEN mark. */
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
  const labelTone = reversed ? "text-white/55" : "text-ink-500";
  return (
    <div className={`flex flex-col gap-2 ${align === "center" ? "items-center text-center" : "items-start"} ${className}`}>
      <span className={`text-[10.5px] font-medium uppercase tracking-[0.2em] ${labelTone}`}>{label}</span>
      <span className={reversed ? "inline-flex rounded bg-white/95 px-2 py-1.5" : "inline-flex"}>
        <Image
          src="/brand/takaven-primary-horizontal.svg"
          alt="TAKAVEN"
          width={2048}
          height={512}
          className="h-7 w-auto"
        />
      </span>
    </div>
  );
}
