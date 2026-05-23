import { format, parseISO } from "date-fns";
import { getPaymentMethodLabel } from "@/lib/paymentMethods";
import { createPdfObjectUrl } from "@/lib/reportPdfSecure";
import {
  renderBarChartImage,
  renderDoughnutChartImage,
  renderLineChartImage,
  type ChartPoint,
} from "@/lib/reportPdfCharts";
import {
  buildChartPalette,
  hexToRgb,
  loadLogoForPdf,
  mixRgb,
  resolveReportPrimaryHex,
  type ReportPdfBranding,
  type Rgb,
} from "@/lib/reportPdfTheme";
import type {
  ReportMetrics,
  FaturamentoPorPeriodoItem,
  ServicoMaisVendido,
  ProdutividadeProfissional,
  StatusDistribuicao,
  AppointmentReportRow,
  HorarioMovimentado,
  PaymentMethodReportPoint,
} from "@/services/reports.service";

function formatPaymentCell(row: AppointmentReportRow): string {
  if (row.revenuePending) return "Pendente";
  if (row.paymentMethod) return getPaymentMethodLabel(row.paymentMethod);
  return "—";
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  completed: "Concluído",
  cancelled: "Cancelado",
  blocked: "Bloqueado",
  no_show: "Não compareceu",
};

export type ReportPdfCharts = {
  faturamentoPorPeriodo: FaturamentoPorPeriodoItem[];
  horariosMaisMovimentados: HorarioMovimentado[];
  paymentMethods: PaymentMethodReportPoint[];
  statusDistribuicao: StatusDistribuicao[];
};

export type ReportExportParams = {
  companyName: string;
  startDate: string;
  endDate: string;
  metrics: ReportMetrics;
  faturamentoPorPeriodo: FaturamentoPorPeriodoItem[];
  servicosMaisVendidos: ServicoMaisVendido[];
  produtividade: ProdutividadeProfissional[];
  statusDistribuicao: StatusDistribuicao[];
  tableRows: AppointmentReportRow[];
  branding: ReportPdfBranding;
  charts: ReportPdfCharts;
};

const PAGE_W = 210;
const MARGIN = 14;
const HEADER_H = 34;
const FOOTER_Y = 287;

function reportPdfFilename(startDate: string, endDate: string) {
  return `relatorio-${startDate}-${endDate}.pdf`;
}

function formatCurrencyBr(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatPeriodDate(iso: string) {
  try {
    return format(parseISO(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

function formatTableDate(iso: string) {
  try {
    return format(parseISO(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

type JsPDFDoc = InstanceType<Awaited<ReturnType<typeof loadPdfLibs>>["jsPDF"]>;

async function loadPdfLibs() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}

function lastTableY(doc: JsPDFDoc, fallback: number) {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

function ensureSpace(doc: JsPDFDoc, y: number, need: number) {
  if (y + need > FOOTER_Y - 8) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawPageFooters(doc: JsPDFDoc, companyName: string, periodLabel: string) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, FOOTER_Y - 6, PAGE_W - MARGIN, FOOTER_Y - 6);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${companyName} · ${periodLabel}`, MARGIN, FOOTER_Y);
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, FOOTER_Y, { align: "right" });
  }
}

function drawPdfHeader(
  doc: JsPDFDoc,
  opts: {
    companyName: string;
    periodLabel: string;
    generatedAt: string;
    primary: Rgb;
    logo: Awaited<ReturnType<typeof loadLogoForPdf>>;
  }
) {
  const { companyName, periodLabel, generatedAt, primary, logo } = opts;
  doc.setFillColor(...primary);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  let titleX = MARGIN;
  if (logo) {
    const logoH = 22;
    const logoW = (logo.width / logo.height) * logoH;
    try {
      doc.addImage(logo.dataUrl, "PNG", MARGIN, 6, logoW, logoH);
      titleX = MARGIN + logoW + 5;
    } catch {
      titleX = MARGIN;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(companyName, titleX, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Relatório gerencial · ${periodLabel}`, titleX, 21);
  doc.setFontSize(8);
  doc.text(`Gerado em ${generatedAt}`, PAGE_W - MARGIN, 12, { align: "right" });
}

function drawSectionTitle(doc: JsPDFDoc, y: number, title: string, primary: Rgb) {
  doc.setFillColor(...primary);
  doc.rect(MARGIN, y, 3, 8, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, MARGIN + 6, y + 7);
  return y + 14;
}

function drawMetricCards(
  doc: JsPDFDoc,
  y: number,
  metrics: ReportMetrics,
  primary: Rgb
) {
  const cards: { label: string; value: string }[] = [
    { label: "Faturamento total", value: formatCurrencyBr(metrics.faturamentoTotal) },
    { label: "Serviços", value: formatCurrencyBr(metrics.faturamentoServicos) },
    { label: "Produtos", value: formatCurrencyBr(metrics.faturamentoProdutos) },
    { label: "Lucro estimado", value: formatCurrencyBr(metrics.lucroEstimado) },
    { label: "Agendamentos", value: String(metrics.totalAgendamentos) },
    { label: "Concluídos", value: String(metrics.agendamentosConcluidos) },
    { label: "Cancelamentos", value: String(metrics.cancelamentos) },
    { label: "Taxa conversão", value: `${metrics.taxaConversao.toFixed(1)}%` },
    { label: "Ticket médio", value: formatCurrencyBr(metrics.ticketMedio) },
  ];

  const cols = 3;
  const gap = 4;
  const cardW = (PAGE_W - MARGIN * 2 - gap * (cols - 1)) / cols;
  const cardH = 22;
  const fillLight = mixRgb(primary, [255, 255, 255], 0.92);

  cards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gap);
    const cy = y + row * (cardH + gap);

    doc.setFillColor(...fillLight);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cy, cardW, cardH, 2, 2, "FD");

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(card.label, x + 4, cy + 8);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(card.value, x + 4, cy + 17, { maxWidth: cardW - 8 });
  });

  const rows = Math.ceil(cards.length / cols);
  return y + rows * (cardH + gap) + 6;
}

function addChartImage(
  doc: JsPDFDoc,
  y: number,
  dataUrl: string,
  widthMm: number,
  heightMm: number
) {
  try {
    doc.addImage(dataUrl, "PNG", MARGIN, y, widthMm, heightMm);
    return y + heightMm + 6;
  } catch {
    return y;
  }
}

function tableStyles(primary: Rgb) {
  const alt = mixRgb(primary, [255, 255, 255], 0.94);
  return {
    headStyles: {
      fillColor: primary,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
    },
    alternateRowStyles: { fillColor: alt },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.1,
    },
    margin: { left: MARGIN, right: MARGIN },
  };
}

async function buildChartImages(
  charts: ReportPdfCharts,
  primary: Rgb,
  palette: Rgb[]
) {
  const faturamentoPoints: ChartPoint[] = charts.faturamentoPorPeriodo.map((r) => ({
    label: r.date,
    value: r.valor,
  }));
  const horarioPoints: ChartPoint[] = charts.horariosMaisMovimentados.map((r) => ({
    label: r.hora,
    value: r.count,
  }));
  const paymentPoints: ChartPoint[] = charts.paymentMethods.map((r) => ({
    label: r.method,
    value: r.value,
  }));
  const statusPoints: ChartPoint[] = charts.statusDistribuicao.map((r) => ({
    label: STATUS_LABELS[r.status] ?? r.status,
    value: r.count,
  }));

  return {
    faturamento: renderLineChartImage(
      faturamentoPoints,
      primary,
      "Faturamento por período"
    ),
    horarios: renderBarChartImage(horarioPoints, primary, "Horários mais movimentados"),
    pagamentos: renderDoughnutChartImage(
      paymentPoints,
      palette,
      "Formas de pagamento",
      (total) =>
        total >= 1000
          ? `R$ ${(total / 1000).toFixed(1)}k`
          : `R$ ${total.toFixed(0)}`
    ),
    status: renderDoughnutChartImage(
      statusPoints,
      palette,
      "Status dos agendamentos"
    ),
  };
}

export async function buildReportPdfBlob(
  params: ReportExportParams
): Promise<{ blob: Blob; filename: string }> {
  const { jsPDF, autoTable } = await loadPdfLibs();

  const primaryHex = resolveReportPrimaryHex(params.branding);
  const primary = hexToRgb(primaryHex);
  const palette = buildChartPalette(primary);
  const periodLabel = `${formatPeriodDate(params.startDate)} — ${formatPeriodDate(params.endDate)}`;
  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm");

  const [logo, chartImages] = await Promise.all([
    params.branding.logoUrl ? loadLogoForPdf(params.branding.logoUrl) : Promise.resolve(null),
    buildChartImages(params.charts, primary, palette),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  drawPdfHeader(doc, {
    companyName: params.companyName,
    periodLabel,
    generatedAt,
    primary,
    logo,
  });

  let y = HEADER_H + 8;
  y = drawSectionTitle(doc, y, "Resumo do período", primary);
  y = drawMetricCards(doc, y, params.metrics, primary);

  const hasCharts =
    chartImages.faturamento ||
    chartImages.horarios ||
    chartImages.pagamentos ||
    chartImages.status;

  if (hasCharts) {
    y = ensureSpace(doc, y, 70);
    y = drawSectionTitle(doc, y, "Gráficos", primary);

    if (chartImages.faturamento) {
      y = ensureSpace(doc, y, 58);
      y = addChartImage(doc, y, chartImages.faturamento, PAGE_W - MARGIN * 2, 52);
    }

    if (chartImages.horarios) {
      y = ensureSpace(doc, y, 58);
      y = addChartImage(doc, y, chartImages.horarios, PAGE_W - MARGIN * 2, 52);
    }

    const halfW = (PAGE_W - MARGIN * 2 - 4) / 2;
    const pieH = 52;
    if (chartImages.pagamentos || chartImages.status) {
      y = ensureSpace(doc, y, pieH + 4);
      const rowY = y;
      if (chartImages.pagamentos) {
        try {
          doc.addImage(chartImages.pagamentos, "PNG", MARGIN, rowY, halfW, pieH);
        } catch {
          /* ignore */
        }
      }
      if (chartImages.status) {
        try {
          doc.addImage(chartImages.status, "PNG", MARGIN + halfW + 4, rowY, halfW, pieH);
        } catch {
          /* ignore */
        }
      }
      y = rowY + pieH + 8;
    }
  }

  const tStyles = tableStyles(primary);

  if (params.servicosMaisVendidos.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, y, "Serviços mais vendidos", primary);
    autoTable(doc, {
      startY: y,
      head: [["Serviço", "Qtd.", "Faturamento"]],
      body: params.servicosMaisVendidos.map((r) => [
        r.serviceName,
        String(r.quantidade),
        formatCurrencyBr(r.faturamentoGerado ?? 0),
      ]),
      theme: "striped",
      ...tStyles,
    });
    y = lastTableY(doc, y) + 10;
  }

  if (params.produtividade.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, y, "Produtividade por profissional", primary);
    autoTable(doc, {
      startY: y,
      head: [["Profissional", "Atendimentos", "Valor gerado"]],
      body: params.produtividade.map((r) => [
        r.professionalName,
        String(r.atendimentos),
        formatCurrencyBr(r.valorGerado),
      ]),
      theme: "striped",
      ...tStyles,
    });
    y = lastTableY(doc, y) + 10;
  }

  if (params.tableRows.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, y, "Agendamentos (amostra)", primary);
    autoTable(doc, {
      startY: y,
      head: [
        ["Data", "Hora", "Cliente", "Serviço", "Prof.", "Valor", "Pag.", "Status"],
      ],
      body: params.tableRows.slice(0, 40).map((r) => [
        formatTableDate(r.date),
        r.startTime || "—",
        r.clientName.length > 18 ? `${r.clientName.slice(0, 17)}…` : r.clientName,
        r.serviceNames.length > 22 ? `${r.serviceNames.slice(0, 21)}…` : r.serviceNames,
        r.professionalName.length > 12
          ? `${r.professionalName.slice(0, 11)}…`
          : r.professionalName,
        r.revenuePending ? "Pendente" : formatCurrencyBr(r.valor),
        formatPaymentCell(r),
        STATUS_LABELS[r.status] ?? r.status,
      ]),
      theme: "striped",
      ...tStyles,
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 14 },
        5: { halign: "right" },
      },
    });
  }

  drawPageFooters(doc, params.companyName, periodLabel);

  const blob = doc.output("blob");
  return { blob, filename: reportPdfFilename(params.startDate, params.endDate) };
}

export { PDF_REQUIRES_HTTPS_MESSAGE, isPdfExportSecureContext } from "@/lib/reportPdfSecure";

export function downloadReportPdf(blob: Blob, filename: string) {
  const url = createPdfObjectUrl(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportReportPDF(params: ReportExportParams) {
  void buildReportPdfBlob(params).then(({ blob, filename }) =>
    downloadReportPdf(blob, filename)
  );
}

export function exportReportExcel(params: ReportExportParams) {
  void (async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const resumo = [
      ["Relatório", `${params.companyName}`],
      ["Período", `${params.startDate} a ${params.endDate}`],
      [],
      ["Métrica", "Valor"],
      ["Faturamento Total", params.metrics.faturamentoTotal],
      ["Total Agendamentos", params.metrics.totalAgendamentos],
      ["Ticket Médio", params.metrics.ticketMedio],
      ["Serviços Realizados", params.metrics.servicosRealizados],
      ["Agendamentos Concluídos", params.metrics.agendamentosConcluidos],
      ["Cancelamentos", params.metrics.cancelamentos],
      ["Taxa de Conversão (%)", params.metrics.taxaConversao],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    const wsApt = XLSX.utils.json_to_sheet(
      params.tableRows.map((r) => ({
        Data: r.date,
        Horário: r.startTime || "",
        Cliente: r.clientName,
        Serviço: r.serviceNames,
        Funcionário: r.professionalName,
        Valor: r.revenuePending ? "Pendente" : r.valor,
        Pagamento: formatPaymentCell(r),
        Status: STATUS_LABELS[r.status] ?? r.status,
        Observações: r.notes ?? "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsApt, "Agendamentos");

    const wsFinanceiro = XLSX.utils.aoa_to_sheet([
      ["Tipo", "Descrição", "Valor"],
      ...params.tableRows
        .filter((r) => r.valor > 0)
        .map((r) => ["Receita", `${r.serviceNames} - ${r.clientName}`, r.valor]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsFinanceiro, "Financeiro");

    const wsServicos = XLSX.utils.json_to_sheet(
      params.servicosMaisVendidos.map((r) => ({
        Serviço: r.serviceName,
        Quantidade: r.quantidade,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsServicos, "Serviços");

    const wsProdutividade = XLSX.utils.json_to_sheet(
      params.produtividade.map((r) => ({
        Funcionário: r.professionalName,
        Atendimentos: r.atendimentos,
        "Valor Gerado": r.valorGerado,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsProdutividade, "Produtividade");

    XLSX.writeFile(wb, `relatorio-${params.startDate}-${params.endDate}.xlsx`);
  })();
}
