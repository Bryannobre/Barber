import { cn } from "@/lib/utils";
import type {
  LandingBodySize,
  LandingFontWeight,
  LandingHeadingSize,
  LandingLetterSpacing,
  LandingTextAlign,
  LandingTextTransform,
} from "@/types/database.types";

export function alignClass(value: LandingTextAlign | null | undefined) {
  switch (value) {
    case "left":
      return "text-left items-start";
    case "right":
      return "text-right items-end";
    default:
      return "text-center items-center";
  }
}

export function headingSizeClass(value: LandingHeadingSize | null | undefined) {
  switch (value) {
    case "md":
      return "text-3xl md:text-4xl lg:text-5xl";
    case "xl":
      return "text-5xl md:text-6xl lg:text-7xl";
    default:
      return "text-4xl md:text-5xl lg:text-6xl";
  }
}

export function bodySizeClass(value: LandingBodySize | null | undefined) {
  switch (value) {
    case "sm":
      return "text-sm md:text-base";
    case "lg":
      return "text-lg md:text-xl";
    default:
      return "text-base md:text-lg";
  }
}

export function buttonTextSizeClass(value: LandingBodySize | null | undefined) {
  switch (value) {
    case "sm":
      return "text-base";
    case "lg":
      return "text-xl";
    default:
      return "text-lg";
  }
}

export function fontWeightClass(value: LandingFontWeight | null | undefined) {
  switch (value) {
    case "normal":
      return "font-normal";
    case "medium":
      return "font-medium";
    case "semibold":
      return "font-semibold";
    default:
      return "font-bold";
  }
}

export function letterSpacingClass(value: LandingLetterSpacing | null | undefined) {
  switch (value) {
    case "wide":
      return "tracking-wide";
    case "wider":
      return "tracking-wider";
    default:
      return "tracking-tight";
  }
}

export function textTransformClass(value: LandingTextTransform | null | undefined) {
  switch (value) {
    case "uppercase":
      return "uppercase";
    case "capitalize":
      return "capitalize";
    default:
      return "normal-case";
  }
}

export function sectionTextContainerClass(value: LandingTextAlign | null | undefined) {
  return cn("flex flex-col", alignClass(value));
}
