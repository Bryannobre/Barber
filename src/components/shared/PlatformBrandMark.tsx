import { cn } from "@/lib/utils";
import { PLATFORM_BRAND } from "@/lib/platformBrand";

type PlatformBrandMarkProps = {
  className?: string;
  logoClassName?: string;
  showName?: boolean;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
};

const logoHeights = {
  sm: "h-12",
  md: "h-20",
  lg: "h-36 sm:h-40 md:h-48 max-w-[min(100%,22rem)] sm:max-w-md md:max-w-xl",
} as const;

export default function PlatformBrandMark({
  className,
  logoClassName,
  showName = true,
  showTagline = true,
  size = "md",
}: PlatformBrandMarkProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <img
        src={PLATFORM_BRAND.logoSrc}
        alt={PLATFORM_BRAND.name}
        className={cn(
          "w-auto max-w-full object-contain",
          logoHeights[size],
          logoClassName
        )}
        loading="lazy"
        decoding="async"
      />
      {showName && (
        <span className="sr-only">{PLATFORM_BRAND.name}</span>
      )}
      {showTagline && (
        <p
          className={cn(
            "text-muted-foreground max-w-md mx-auto",
            size === "lg" ? "text-lg mt-4" : size === "md" ? "text-sm mt-3" : "text-xs mt-2"
          )}
        >
          {PLATFORM_BRAND.tagline}
        </p>
      )}
    </div>
  );
}
