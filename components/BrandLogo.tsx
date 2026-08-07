import Image from "next/image";

type BrandLogoProps = {
  variant?: "mark" | "lockup";
  reversed?: boolean;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  variant = "lockup",
  reversed = false,
  className = "",
  priority = false,
}: BrandLogoProps) {
  const src =
    variant === "mark"
      ? reversed
        ? "/brand/teamframe-mark-reversed.svg"
        : "/brand/teamframe-mark-primary.svg"
      : reversed
        ? "/brand/teamframe-lockup-reversed.svg"
        : "/brand/teamframe-lockup-primary.svg";
  const size = variant === "mark"
    ? { width: 36, height: 36 }
    : { width: 208, height: 52 };

  return (
    <Image
      src={src}
      alt={variant === "mark" ? "TeamFrame" : "TeamFrame - People operations, made ready."}
      width={size.width}
      height={size.height}
      priority={priority}
      className={className}
    />
  );
}
