/** Tema visual do PDF alinhado à customização da dashboard da empresa */

export const DEFAULT_REPORT_PRIMARY_HEX = "#6fcf97";

export type Rgb = [number, number, number];

export type ReportPdfBranding = {
  primaryHex: string;
  logoUrl?: string | null;
  customizationEnabled: boolean;
};

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "").trim();
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [59, 130, 246];
  }

  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function resolveReportPrimaryHex(branding: ReportPdfBranding): string {
  if (branding.customizationEnabled && branding.primaryHex?.trim()) {
    return branding.primaryHex.trim();
  }
  return DEFAULT_REPORT_PRIMARY_HEX;
}

export function buildChartPalette(primary: Rgb): Rgb[] {
  const white: Rgb = [255, 255, 255];
  const slate: Rgb = [100, 116, 139];
  return [
    primary,
    mixRgb(primary, white, 0.35),
    mixRgb(primary, [30, 64, 175] as Rgb, 0.25),
    mixRgb(primary, [234, 179, 8] as Rgb, 0.4),
    slate,
    mixRgb(primary, [168, 85, 247] as Rgb, 0.3),
  ];
}

export type LoadedLogo = {
  dataUrl: string;
  width: number;
  height: number;
};

/** Carrega logo remota como PNG base64 (requer CORS no host da imagem). */
export async function loadLogoForPdf(url: string): Promise<LoadedLogo | null> {
  if (!url?.trim()) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxSide = 160;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (!w || !h) {
        resolve(null);
        return;
      }
      if (w > maxSide || h > maxSide) {
        const scale = maxSide / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: w,
          height: h,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url.trim();
  });
}
