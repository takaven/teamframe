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
  // Intrinsic dimensions match the official production assets (Symbol 127×127, Primary
  // horizontal lockup 808×127) so next/image preserves the correct aspect ratio; callers
  // control the rendered size via className.
  const size = variant === "mark"
    ? { width: 127, height: 127 }
    : { width: 808, height: 127 };

  return (
    <Image
      src={src}
      alt="TeamFrame"
      width={size.width}
      height={size.height}
      priority={priority}
      className={className}
    />
  );
}
