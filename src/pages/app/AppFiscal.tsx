import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  Settings,
  ScrollText,
  Loader2,
  ExternalLink,
  RotateCcw,
  Ban,
  History,
} from "lucide-react";
import { toast } from "sonner";
import PageContainer from "@/components/shared/PageContainer";
import CardWidget from "@/components/shared/CardWidget";
import { FiscalStatusBadge } from "@/components/fiscal/FiscalStatusBadge";
import { FiscalDashboardCharts } from "@/components/fiscal/FiscalDashboardCharts";
import { FiscalInvoiceTimelineSheet } from "@/components/fiscal/FiscalInvoiceTimelineSheet";
import { FiscalCancelConfirmDialog } from "@/components/fiscal/FiscalCancelConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenant } from "@/contexts/TenantContext";
import { fiscalService } from "@/services/fiscal.service";
import { buildFiscalDashboardStats } from "@/lib/fiscalDashboard";
import { FISCAL_MAX_RETRIES, type InvoiceStatus, type InvoiceWithMeta } from "@/types/fiscal.types";

function formatCurrency(value: number) {
  return `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "PENDING", label: "Pendentes" },
  { value: "PROCESSING", label: "Processando" },
  { value: "ISSUED", label: "Emitidas" },
  { value: "FAILED", label: "Erros" },
  { value: "CANCELLED", label: "Canceladas" },
];

export default function AppFiscal() {
  const { currentCompany } = useTenant();
  const companyId = currentCompany?.id ?? "";
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithMeta | null>(null);
  const [timelineInvoice, setTimelineInvoice] = useState<InvoiceWithMeta | null>(null);
  const [cancelTarget, setCancelTarget] = useState<InvoiceWithMeta | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const hasProcessing = (list: InvoiceWithMeta[]) =>
    list.some((i) => i.status === "PROCESSING" || i.status === "PENDING");

  const {
    data: invoices = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["fiscal-invoices", companyId],
    queryFn: () => fiscalService.getInvoices(companyId),
    enabled: !!companyId,
    refetchInterval: (query) => {
      const data = query.state.data as InvoiceWithMeta[] | undefined;
      return data && hasProcessing(data) ? 3000 : false;
    },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["fiscal-recent-activity", companyId],
    queryFn: () => fiscalService.getRecentActivity(companyId, 6),
    enabled: !!companyId,
  });

  const { data: pdfSignedUrl } = useQuery({
    queryKey: ["fiscal-pdf-url", detailInvoice?.id, detailInvoice?.pdf_url],
    queryFn: () => fiscalService.getInvoicePdfSignedUrl(detailInvoice?.pdf_url),
    enabled: !!detailInvoice?.pdf_url && detailInvoice.status === "ISSUED",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        inv.invoice_number,
        inv.client_name_snapshot,
        inv.professional_name_snapshot,
        inv.verification_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [invoices, statusFilter, search]);

  const stats = useMemo(() => buildFiscalDashboardStats(invoices), [invoices]);

  const invalidateFiscal = () => {
    queryClient.invalidateQueries({ queryKey: ["fiscal-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["fiscal-logs"] });
    queryClient.invalidateQueries({ queryKey: ["fiscal-recent-activity"] });
    queryClient.invalidateQueries({ queryKey: ["fiscal-invoice-map"] });
  };

  const issueMutation = useMutation({
    mutationFn: (invoiceId: string) => fiscalService.issueInvoice(companyId, invoiceId),
    onSuccess: () => {
      toast.success("Nota emitida com sucesso.");
      invalidateFiscal();
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setActionId(null),
  });

  const retryMutation = useMutation({
    mutationFn: (invoiceId: string) => fiscalService.retryInvoice(companyId, invoiceId),
    onSuccess: () => {
      toast.success("Reemissão concluída.");
      invalidateFiscal();
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setActionId(null),
  });

  const cancelMutation = useMutation({
    mutationFn: (invoiceId: string) => fiscalService.cancelInvoice(companyId, invoiceId),
    onSuccess: () => {
      toast.success("Nota cancelada no sistema.");
      setCancelTarget(null);
      invalidateFiscal();
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setActionId(null),
  });

  const canRetry = (inv: InvoiceWithMeta) =>
    inv.status === "FAILED" && (inv.retry_count ?? 0) < FISCAL_MAX_RETRIES;

  const canCancel = (inv: InvoiceWithMeta) =>
    inv.status !== "CANCELLED" && inv.status !== "PROCESSING";

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground max-w-xl">
            NFS-e em modo semi-real: PDF no Storage, retry e cancelamento interno. Integração com
            prefeitura na Fase 3.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/fiscal/settings">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/fiscal/logs">
              <ScrollText className="h-4 w-4 mr-2" />
              Logs
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <CardWidget title="Emitidas" value={String(stats.issuedCount)} icon={FileText} />
        <CardWidget title="Pendentes" value={String(stats.pendingCount)} icon={FileText} />
        <CardWidget title="Falhas" value={String(stats.failedCount)} icon={FileText} />
        <CardWidget title="Canceladas" value={String(stats.cancelledCount)} icon={FileText} />
        <CardWidget
          title="Valor fiscal"
          value={formatCurrency(stats.revenue)}
          icon={FileText}
        />
        <CardWidget
          title="Impostos (est.)"
          value={formatCurrency(stats.taxes)}
          icon={FileText}
        />
      </div>

      <FiscalDashboardCharts stats={stats} />

      {recentLogs.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-muted/20 p-4">
          <h3 className="text-sm font-medium mb-3">Últimas atividades</h3>
          <ul className="space-y-2 text-sm">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className="text-xs">
                  {log.event}
                </Badge>
                <span className="text-muted-foreground flex-1 min-w-0 truncate">
                  {log.message}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Buscar nota, cliente ou profissional..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="sm:ml-auto"
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <p className="p-8 text-center text-destructive">
            Não foi possível carregar as notas. Tente novamente.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nota</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Nenhuma nota encontrada. Use &quot;Emitir Nota&quot; no Financeiro.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">
                      {inv.invoice_number ?? "—"}
                      {(inv.retry_count ?? 0) > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          retries: {inv.retry_count}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{inv.client_name_snapshot ?? "—"}</TableCell>
                    <TableCell>{inv.professional_name_snapshot ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(Number(inv.final_amount))}</TableCell>
                    <TableCell>
                      <FiscalStatusBadge status={inv.status as InvoiceStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                      {format(
                        new Date(inv.issued_at ?? inv.created_at),
                        "dd/MM/yyyy HH:mm",
                        { locale: ptBR }
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailInvoice(inv)}
                        >
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTimelineInvoice(inv)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {inv.status === "PENDING" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionId === inv.id}
                            onClick={() => {
                              setActionId(inv.id);
                              issueMutation.mutate(inv.id);
                            }}
                          >
                            {actionId === inv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Emitir"
                            )}
                          </Button>
                        )}
                        {canRetry(inv) && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionId === inv.id}
                            onClick={() => {
                              setActionId(inv.id);
                              retryMutation.mutate(inv.id);
                            }}
                          >
                            {actionId === inv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Retry
                              </>
                            )}
                          </Button>
                        )}
                        {canCancel(inv) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setCancelTarget(inv)}
                          >
                            <Ban className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!detailInvoice} onOpenChange={(o) => !o && setDetailInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da nota</DialogTitle>
            <DialogDescription>
              {detailInvoice?.service_name_snapshot ?? "Serviço"}
            </DialogDescription>
          </DialogHeader>
          {detailInvoice && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Número</dt>
              <dd>{detailInvoice.invoice_number ?? "—"}</dd>
              <dt className="text-muted-foreground">Verificação</dt>
              <dd className="font-mono">{detailInvoice.verification_code ?? "—"}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <FiscalStatusBadge status={detailInvoice.status as InvoiceStatus} />
              </dd>
              <dt className="text-muted-foreground">Valor</dt>
              <dd>{formatCurrency(Number(detailInvoice.final_amount))}</dd>
              <dt className="text-muted-foreground">Tentativas</dt>
              <dd>
                {detailInvoice.retry_count ?? 0} / {FISCAL_MAX_RETRIES}
              </dd>
              {detailInvoice.error_message && (
                <>
                  <dt className="text-muted-foreground">Erro</dt>
                  <dd className="text-destructive">{detailInvoice.error_message}</dd>
                </>
              )}
            </dl>
          )}
          {detailInvoice?.status === "ISSUED" && pdfSignedUrl && (
            <Button variant="outline" size="sm" asChild className="mt-2">
              <a href={pdfSignedUrl} target="_blank" rel="noopener noreferrer">
                Abrir PDF <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <FiscalInvoiceTimelineSheet
        open={!!timelineInvoice}
        onOpenChange={(o) => !o && setTimelineInvoice(null)}
        companyId={companyId}
        invoiceId={timelineInvoice?.id ?? null}
        invoiceLabel={timelineInvoice?.invoice_number ?? undefined}
      />

      <FiscalCancelConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        invoiceNumber={cancelTarget?.invoice_number}
        isPending={cancelMutation.isPending}
        onConfirm={() => {
          if (!cancelTarget) return;
          setActionId(cancelTarget.id);
          cancelMutation.mutate(cancelTarget.id);
        }}
      />
    </PageContainer>
  );
}
