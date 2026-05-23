import { format, parseISO } from "date-fns";
import type { Rgb } from "@/lib/reportPdfTheme";

export type ChartPoint = { label: string; value: number };

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");
  return { canvas, ctx };
}

function rgbCss([r, g, b]: Rgb) {
  return `rgb(${r},${g},${b})`;
}

function rgbaCss([r, g, b]: Rgb, alpha: number) {
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawChartFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 14px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(title, 16, 24);
}

function formatAxisDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd/MM");
  } catch {
    return dateStr.slice(5) || dateStr;
  }
}

export function renderLineChartImage(
  points: ChartPoint[],
  primary: Rgb,
  title: string
): string | null {
  if (points.length === 0) return null;

  const width = 520;
  const height = 220;
  const { canvas, ctx } = createCanvas(width, height);
  drawChartFrame(ctx, width, height, title);

  const padL = 48;
  const padR = 16;
  const padT = 44;
  const padB = 36;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const values = points.map((p) => p.value);
  const maxVal = Math.max(...values, 1);
  const minVal = 0;

  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(width - padR, y);
    ctx.stroke();
  }

  const coords = points.map((p, i) => {
    const x =
      padL + (points.length === 1 ? chartW / 2 : (chartW * i) / (points.length - 1));
    const y = padT + chartH - ((p.value - minVal) / (maxVal - minVal)) * chartH;
    return { x, y, label: p.label };
  });

  const gradient = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  gradient.addColorStop(0, rgbaCss(primary, 0.33));
  gradient.addColorStop(1, rgbaCss(primary, 0.03));
  ctx.beginPath();
  ctx.moveTo(coords[0].x, padT + chartH);
  coords.forEach((c) => ctx.lineTo(c.x, c.y));
  ctx.lineTo(coords[coords.length - 1].x, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  coords.forEach((c, i) => {
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.strokeStyle = rgbCss(primary);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  coords.forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = rgbCss(primary);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.fillStyle = "#64748b";
  ctx.font = "11px system-ui, sans-serif";
  const step = Math.max(1, Math.ceil(points.length / 7));
  points.forEach((p, i) => {
    if (i % step !== 0 && i !== points.length - 1) return;
    const x =
      padL + (points.length === 1 ? chartW / 2 : (chartW * i) / (points.length - 1));
    ctx.textAlign = "center";
    ctx.fillText(formatAxisDate(p.label), x, height - 12);
  });

  return canvas.toDataURL("image/png");
}

export function renderBarChartImage(
  points: ChartPoint[],
  primary: Rgb,
  title: string
): string | null {
  if (points.length === 0) return null;

  const width = 520;
  const height = 220;
  const { canvas, ctx } = createCanvas(width, height);
  drawChartFrame(ctx, width, height, title);

  const padL = 40;
  const padR = 16;
  const padT = 44;
  const padB = 40;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const barGap = 8;
  const barW = Math.min(36, (chartW - barGap * (points.length + 1)) / points.length);

  points.forEach((p, i) => {
    const barH = (p.value / maxVal) * chartH;
    const x = padL + barGap + i * (barW + barGap);
    const y = padT + chartH - barH;
    const radius = 4;
    ctx.fillStyle = rgbCss(primary);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barW - radius, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
    ctx.lineTo(x + barW, padT + chartH);
    ctx.lineTo(x, padT + chartH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.label, x + barW / 2, height - 14);
  });

  return canvas.toDataURL("image/png");
}

export function renderDoughnutChartImage(
  points: ChartPoint[],
  colors: Rgb[],
  title: string,
  formatCenter?: (total: number) => string
): string | null {
  const total = points.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;

  const width = 260;
  const height = 220;
  const { canvas, ctx } = createCanvas(width, height);
  drawChartFrame(ctx, width, height, title);

  const cx = 90;
  const cy = height / 2 + 8;
  const outerR = 58;
  const innerR = 34;
  let start = -Math.PI / 2;

  points.forEach((p, i) => {
    const slice = (p.value / total) * Math.PI * 2;
    const end = start + slice;
    const color = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, start, end);
    ctx.arc(cx, cy, innerR, end, start, true);
    ctx.closePath();
    ctx.fillStyle = rgbCss(color);
    ctx.fill();
    start = end;
  });

  const centerText = formatCenter
    ? formatCenter(total)
    : total >= 1000
      ? `${(total / 1000).toFixed(1)}k`
      : String(Math.round(total));
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(centerText, cx, cy + 4);

  let legendY = 52;
  const legendX = 168;
  points.forEach((p, i) => {
    const color = colors[i % colors.length];
    ctx.fillStyle = rgbCss(color);
    ctx.fillRect(legendX, legendY, 10, 10);
    ctx.fillStyle = "#334155";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    const pct = ((p.value / total) * 100).toFixed(0);
    const label =
      p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label;
    ctx.fillText(`${label} (${pct}%)`, legendX + 16, legendY + 9);
    legendY += 18;
  });

  return canvas.toDataURL("image/png");
}
