import Image from "next/image";

type BrandLogoProps = {
  variant?: "mark" | "wordmark" | "lockup";
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
      : variant === "wordmark"
        ? reversed
          ? "/brand/teamframe-wordmark-dark.svg"
          : "/brand/teamframe-wordmark-light.svg"
      : reversed
        ? "/brand/teamframe-endorsed-dark.svg"
        : "/brand/teamframe-endorsed-light.svg";
  const size = variant === "mark" ? { width: 127, height: 127 } : { width: 1600, height: 370 };

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
