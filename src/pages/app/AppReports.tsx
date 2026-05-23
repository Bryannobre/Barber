import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/shared/PageContainer";
import CardWidget from "@/components/shared/CardWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Scissors,
  XCircle,
  Percent,
  Download,
  Loader2,
  Package,
  Wallet,
  FileText,
} from "lucide-react";
import type { ReportExportParams } from "@/lib/reportsExport";
import {
  PDF_REQUIRES_HTTPS_MESSAGE,
  createPdfObjectUrl,
  isPdfExportSecureContext,
  revokePdfObjectUrl,
} from "@/lib/reportPdfSecure";
import { useTenant } from "@/contexts/TenantContext";
import { reportsService } from "@/services/reports.service";
import { professionalService } from "@/services/professional.service";
import { serviceService } from "@/services/service.service";
import {
  format,
  parseISO,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { getPaymentMethodLabel } from "@/lib/paymentMethods";
import { ptBR } from "date-fns/locale";

const QUICK_FILTERS = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "custom", label: "Personalizado" },
] as const;

function getDateRange(filterId: string): { start: string; end: string } {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  switch (filterId) {
    case "today":
      return { start: todayStr, end: todayStr };
    case "7d":
      return {
        start: format(subDays(today, 6), "yyyy-MM-dd"),
        end: todayStr,
      };
    case "30d":
      return {
        start: format(subDays(today, 29), "yyyy-MM-dd"),
        end: todayStr,
      };
    case "this_month":
      return {
        start: format(startOfMonth(today), "yyyy-MM-dd"),
        end: format(endOfMonth(today), "yyyy-MM-dd"),
      };
    case "last_month":
      const last = subMonths(today, 1);
      return {
        start: format(startOfMonth(last), "yyyy-MM-dd"),
        end: format(endOfMonth(last), "yyyy-MM-dd"),
      };
    default:
      return {
        start: format(subDays(today, 29), "yyyy-MM-dd"),
        end: todayStr,
      };
  }
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  completed: "Concluído",
  cancelled: "Cancelado",
  blocked: "Bloqueado",
  no_show: "Não compareceu",
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(142 76% 36%)",
  "hsl(221 83% 53%)",
  "hsl(38 92% 50%)",
  "hsl(var(--muted-foreground))",
  "hsl(280 65% 55%)",
];

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatChartDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd/MM");
  } catch {
    return dateStr;
  }
}

const AppReports = () => {
  const { currentCompany } = useTenant();
  const companyId = currentCompany?.id ?? "";
  const companyName = currentCompany?.name ?? "Empresa";

  const [quickFilter, setQuickFilter] = useState<string>("30d");
  const [startDate, setStartDate] = useState(() =>
    format(subDays(new Date(), 29), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const ALL_VALUE = "__all__";
  const [professionalId, setProfessionalId] = useState<string>(ALL_VALUE);
  const [serviceId, setServiceId] = useState<string>(ALL_VALUE);
  const [page, setPage] = useState(0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    filename: string;
    blob: Blob;
  } | null>(null);

  const toFilterId = (v: string) => (v && v !== "__all__" ? v : undefined);
  const filters = useMemo(() => {
    if (quickFilter === "custom") {
      return { startDate, endDate, professionalId: toFilterId(professionalId), serviceId: toFilterId(serviceId) };
    }
    const { start, end } = getDateRange(quickFilter);
    return {
      startDate: start,
      endDate: end,
      professionalId: toFilterId(professionalId),
      serviceId: toFilterId(serviceId),
    };
  }, [quickFilter, startDate, endDate, professionalId, serviceId]);

  const { data: professionalsData } = useQuery({
    queryKey: ["professionals", companyId],
    queryFn: () => professionalService.listByCompany(companyId),
    enabled: !!companyId,
  });
  const { data: servicesData } = useQuery({
    queryKey: ["services", companyId],
    queryFn: () => serviceService.listByCompany(companyId),
    enabled: !!companyId,
  });

  const professionals = professionalsData?.data ?? [];
  const services = servicesData?.data ?? [];

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["reports-metrics", companyId, filters],
    queryFn: () => reportsService.getMetrics(companyId, filters),
    enabled: !!companyId,
  });

  const { data: faturamentoData, isLoading: fatLoading } = useQuery({
    queryKey: ["reports-faturamento", companyId, filters],
    queryFn: () => reportsService.getFaturamentoPorPeriodo(companyId, filters),
    enabled: !!companyId,
  });

  const { data: servicosData, isLoading: svcLoading } = useQuery({
    queryKey: ["reports-servicos", companyId, filters],
    queryFn: () => reportsService.getServicosMaisVendidos(companyId, filters),
    enabled: !!companyId,
  });

  const { data: produtividadeData, isLoading: prodLoading } = useQuery({
    queryKey: ["reports-produtividade", companyId, filters],
    queryFn: () => reportsService.getProdutividadeProfissionais(companyId, filters),
    enabled: !!companyId,
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["reports-status", companyId, filters],
    queryFn: () => reportsService.getStatusDistribuicao(companyId, filters),
    enabled: !!companyId,
  });

  const { data: tableData, isLoading: tableLoading } = useQuery({
    queryKey: ["reports-table", companyId, filters, page],
    queryFn: () =>
      reportsService.getAppointmentsForTable(companyId, filters, {
        limit: 20,
        offset: page * 20,
      }),
    enabled: !!companyId,
  });

  const { data: rankingData } = useQuery({
    queryKey: ["reports-ranking", companyId, filters],
    queryFn: () => reportsService.getRankingProfissionais(companyId, filters),
    enabled: !!companyId,
  });
  const { data: horariosData } = useQuery({
    queryKey: ["reports-horarios", companyId, filters],
    queryFn: () => reportsService.getHorariosMaisMovimentados(companyId, filters),
    enabled: !!companyId,
  });

  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ["reports-payment-methods", companyId, filters],
    queryFn: () => reportsService.getPaymentMethodsDistribution(companyId, filters),
    enabled: !!companyId,
  });

  const metrics = metricsData?.data ?? {
    faturamentoTotal: 0,
    faturamentoServicos: 0,
    faturamentoProdutos: 0,
    lucroEstimado: 0,
    totalAgendamentos: 0,
    ticketMedio: 0,
    servicosRealizados: 0,
    cancelamentos: 0,
    taxaConversao: 0,
    agendamentosConcluidos: 0,
  };
  const faturamentoRaw = faturamentoData?.data ?? [];
  const faturamentoPorPeriodo = faturamentoRaw.map((item) => ({
    ...item,
    dateLabel: formatChartDate(item.date),
  }));
  const paymentMethodsChart = paymentMethodsData?.data ?? [];
  const servicosMaisVendidos = servicosData?.data ?? [];
  const rankingProfissionais = rankingData?.data ?? [];
  const horariosMaisMovimentados = horariosData?.data ?? [];
  const produtividade = produtividadeData?.data ?? [];
  const statusDistribuicao = statusData?.data ?? [];
  const tableRows = tableData?.data ?? [];
  const tableTotal = tableData?.total ?? 0;

  const handleQuickFilter = (id: string) => {
    setQuickFilter(id);
    if (id !== "custom") {
      const { start, end } = getDateRange(id);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const companyLogoUrl =
    currentCompany?.logo_url?.trim() || currentCompany?.logo?.trim() || null;

  const getExportParams = useCallback((): ReportExportParams => {
    return {
      companyName,
      startDate: filters.startDate,
      endDate: filters.endDate,
      metrics,
      faturamentoPorPeriodo: faturamentoRaw,
      servicosMaisVendidos,
      produtividade,
      statusDistribuicao,
      tableRows,
      branding: {
        primaryHex: currentCompany?.dashboard_primary_color ?? "#6fcf97",
        logoUrl: companyLogoUrl,
        customizationEnabled: currentCompany?.customization_enabled ?? false,
      },
      charts: {
        faturamentoPorPeriodo: faturamentoRaw,
        horariosMaisMovimentados,
        paymentMethods: paymentMethodsChart,
        statusDistribuicao,
      },
    };
  }, [
    companyName,
    filters.startDate,
    filters.endDate,
    metrics,
    faturamentoRaw,
    servicosMaisVendidos,
    produtividade,
    statusDistribuicao,
    tableRows,
    currentCompany?.dashboard_primary_color,
    currentCompany?.customization_enabled,
    companyLogoUrl,
    horariosMaisMovimentados,
    paymentMethodsChart,
  ]);

  const pdfSecure = isPdfExportSecureContext();

  const closePdfPreview = useCallback(() => {
    setPdfPreview((prev) => {
      revokePdfObjectUrl(prev?.url);
      return null;
    });
    setPdfPreviewOpen(false);
  }, []);

  useEffect(() => {
    return () => revokePdfObjectUrl(pdfPreview?.url);
  }, [pdfPreview?.url]);

  const handlePreviewPdf = async () => {
    if (!pdfSecure) {
      toast.error(PDF_REQUIRES_HTTPS_MESSAGE);
      return;
    }
    setPdfGenerating(true);
    try {
      const { buildReportPdfBlob } = await import("@/lib/reportsExport");
      const { blob, filename } = await buildReportPdfBlob(getExportParams());
      const url = createPdfObjectUrl(blob);
      setPdfPreview((prev) => {
        revokePdfObjectUrl(prev?.url);
        return { url, filename, blob };
      });
      setExportModalOpen(false);
      setPdfPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownloadPdfPreview = () => {
    if (!pdfPreview) return;
    if (!pdfSecure) {
      toast.error(PDF_REQUIRES_HTTPS_MESSAGE);
      return;
    }
    void import("@/lib/reportsExport")
      .then(({ downloadReportPdf }) =>
        downloadReportPdf(pdfPreview.blob, pdfPreview.filename)
      )
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Não foi possível baixar o PDF.")
      );
  };

  const handleExportExcel = async () => {
    const { exportReportExcel } = await import("@/lib/reportsExport");
    exportReportExcel(getExportParams());
    setExportModalOpen(false);
  };

  const hasData =
    metrics.totalAgendamentos > 0 ||
    faturamentoPorPeriodo.length > 0 ||
    servicosMaisVendidos.length > 0 ||
    produtividade.length > 0;

  return (
    <>
      <PageContainer
        actions={
          <Button onClick={() => setExportModalOpen(true)}>
            <Download size={16} className="mr-2" />
            Exportar Relatório
          </Button>
        }
      >
        {/* 1. Filtros */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold mb-4">Filtros</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-wrap gap-2">
              {QUICK_FILTERS.map((f) => (
                <Button
                  key={f.id}
                  variant={quickFilter === f.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            {quickFilter === "custom" && (
              <div className="flex items-end gap-4">
                <div>
                  <Label className="text-xs">Data inicial</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Data final</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            )}
            <div className="w-48">
              <Label className="text-xs">Funcionário</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs">Serviço</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Período: {filters.startDate} a {filters.endDate}
          </p>
        </div>

        {/* 2. Cards de métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-3 mb-3">
          {metricsLoading ? (
            Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          ) : (
            <>
              <CardWidget
                title="Faturamento serviços"
                value={formatCurrency(metrics.faturamentoServicos ?? 0)}
                icon={Scissors}
              />
              <CardWidget
                title="Faturamento produtos"
                value={formatCurrency(metrics.faturamentoProdutos ?? 0)}
                icon={Package}
              />
              <CardWidget
                title="Faturamento total"
                value={formatCurrency(metrics.faturamentoTotal ?? 0)}
                icon={DollarSign}
              />
            </>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-2">
          {!metricsLoading && (
            <>
              <CardWidget
                title="Lucro estimado"
                value={formatCurrency(metrics.lucroEstimado ?? 0)}
                icon={Wallet}
              />
              <CardWidget
                title="Agendamentos"
                value={String(metrics.totalAgendamentos)}
                icon={Calendar}
              />
              <CardWidget
                title="Concluídos"
                value={String(metrics.agendamentosConcluidos ?? 0)}
                icon={TrendingUp}
              />
              <CardWidget
                title="Cancelamentos"
                value={String(metrics.cancelamentos ?? 0)}
                icon={XCircle}
              />
              <CardWidget
                title="Taxa de conversão"
                value={`${(metrics.taxaConversao ?? 0).toFixed(1)}%`}
                icon={Percent}
              />
              <CardWidget
                title="Ticket médio"
                value={formatCurrency(metrics.ticketMedio ?? 0)}
                icon={DollarSign}
              />
            </>
          )}
        </div>
        {!metricsLoading && (
          <p className="text-xs text-muted-foreground mb-6">
            Lucro estimado = entradas − saídas no período (lançamentos válidos no financeiro).
            Taxa de conversão = concluídos ÷ confirmados no período.
          </p>
        )}

        {!hasData && !metricsLoading && (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground mb-6">
            Nenhum dado encontrado neste período.
          </div>
        )}

        {/* 3. Gráficos */}
        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Faturamento por Período</h3>
              {fatLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : faturamentoPorPeriodo.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={faturamentoPorPeriodo}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="dateLabel"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v), "Faturamento"]}
                      labelFormatter={(_, payload) => {
                        const raw = payload?.[0]?.payload?.date as string | undefined;
                        return raw ? formatChartDate(raw) : "";
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Horários mais movimentados</h3>
              {horariosMaisMovimentados.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={horariosMaisMovimentados} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hora" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip formatter={(v: number) => [v, "Atendimentos"]} />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--primary))"
                      name="Atendimentos"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Formas de pagamento</h3>
              {paymentMethodsLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : paymentMethodsChart.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Sem receitas no período. Conclua atendimentos informando a forma de pagamento.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={paymentMethodsChart}
                      dataKey="value"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {paymentMethodsChart.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [formatCurrency(v), "Receita"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2">
              <h3 className="font-semibold mb-4">Status dos Agendamentos</h3>
              {statusLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : statusDistribuicao.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusDistribuicao.map((s, i) => ({
                        ...s,
                        name: STATUS_LABELS[s.status] ?? s.status,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusDistribuicao.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, "Quantidade"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* 4. Rankings (tabelas) */}
        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <h3 className="font-semibold p-5 pb-3">Ranking de profissionais</h3>
              <div className="px-5 pb-5">
                {rankingProfissionais.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6">Sem dados</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Profissional</TableHead>
                        <TableHead className="text-right">Atendimentos</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">Ticket médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankingProfissionais.map((r) => (
                        <TableRow key={r.professionalId}>
                          <TableCell className="font-medium">{r.professionalName}</TableCell>
                          <TableCell className="text-right">{r.atendimentos}</TableCell>
                          <TableCell className="text-right">R$ {r.faturamentoGerado.toFixed(2)}</TableCell>
                          <TableCell className="text-right">R$ {r.ticketMedio.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <h3 className="font-semibold p-5 pb-3">Serviços mais vendidos</h3>
              <div className="px-5 pb-5">
                {servicosMaisVendidos.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6">Sem dados</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serviço</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servicosMaisVendidos.map((s) => (
                        <TableRow key={s.serviceId}>
                          <TableCell className="font-medium">{s.serviceName}</TableCell>
                          <TableCell className="text-right">{s.quantidade}</TableCell>
                          <TableCell className="text-right">
                            R$ {(s.faturamentoGerado ?? 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. Tabela detalhada de agendamentos */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="p-5 pb-0">
            <h3 className="font-semibold">Tabela detalhada de agendamentos</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Pagamento vem do atendimento concluído ou do lançamento no financeiro. Valor R$ 0 em
              concluídos indica receita pendente (após o horário do atendimento).
            </p>
          </div>
          <div className="p-5 pt-3">
            {tableLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : tableRows.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                Nenhum agendamento no período.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {formatChartDate(r.date)}
                        </TableCell>
                        <TableCell className="tabular-nums">{r.startTime || "—"}</TableCell>
                        <TableCell>{r.clientName}</TableCell>
                        <TableCell>{r.serviceNames}</TableCell>
                        <TableCell>{r.professionalName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.revenuePending ? (
                            <span className="text-muted-foreground text-xs" title="Receita pendente">
                              Pendente
                            </span>
                          ) : (
                            formatCurrency(r.valor)
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.paymentMethod
                            ? getPaymentMethodLabel(r.paymentMethod)
                            : "—"}
                        </TableCell>
                        <TableCell>{STATUS_LABELS[r.status] ?? r.status}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-muted-foreground">
                          {r.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {tableTotal > 20 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-4 text-sm text-muted-foreground">
                      Página {page + 1} de {Math.ceil(tableTotal / 20)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= Math.ceil(tableTotal / 20) - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PageContainer>

      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar Relatório</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Período {filters.startDate} a {filters.endDate}. O PDF pode ser visualizado antes
            do download.
          </p>
          {!pdfSecure && (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              {PDF_REQUIRES_HTTPS_MESSAGE} O Excel continua disponível nesta conexão.
            </p>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handlePreviewPdf()}
              disabled={pdfGenerating || !pdfSecure}
              title={!pdfSecure ? PDF_REQUIRES_HTTPS_MESSAGE : undefined}
            >
              {pdfGenerating ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <FileText size={16} className="mr-2" />
              )}
              Visualizar PDF
            </Button>
            <Button variant="secondary" onClick={() => void handleExportExcel()}>
              <Download size={16} className="mr-2" />
              Exportar Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pdfPreviewOpen}
        onOpenChange={(open) => {
          if (!open) closePdfPreview();
          else setPdfPreviewOpen(true);
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle>Pré-visualização do relatório</DialogTitle>
            <p className="text-sm text-muted-foreground font-normal">
              {filters.startDate} a {filters.endDate}
              {pdfPreview?.filename ? ` · ${pdfPreview.filename}` : ""}
            </p>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-3">
            {pdfPreview?.url ? (
              <iframe
                title="Pré-visualização do PDF do relatório"
                src={pdfPreview.url}
                className="w-full h-full min-h-[60vh] rounded-lg border border-border bg-muted/30"
              />
            ) : (
              <div className="flex items-center justify-center h-full min-h-[40vh] text-muted-foreground text-sm">
                Gerando documento…
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button variant="outline" onClick={closePdfPreview}>
              Fechar
            </Button>
            <Button
              onClick={handleDownloadPdfPreview}
              disabled={!pdfPreview || !pdfSecure}
              title={!pdfSecure ? PDF_REQUIRES_HTTPS_MESSAGE : undefined}
            >
              <Download size={16} className="mr-2" />
              Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AppReports;
