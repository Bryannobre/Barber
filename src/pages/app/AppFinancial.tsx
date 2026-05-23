import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageContainer from "@/components/shared/PageContainer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CardWidget from "@/components/shared/CardWidget";
import { DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { financialService } from "@/services/financial.service";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getPeriodRange,
  formatPeriodLabel,
  type PeriodKey,
} from "@/lib/dateUtils";
import type { FinancialRecord } from "@/types/database.types";

const PERIOD_OPTIONS: { id: PeriodKey; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "custom", label: "Período personalizado" },
];

type SourceFilter =
  | "all"
  | "appointment"
  | "product_sale"
  | "product_purchase"
  | "manual";

const SOURCE_FILTER_OPTIONS: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "appointment", label: "Agendamentos" },
  { id: "product_sale", label: "Venda de produto" },
  { id: "product_purchase", label: "Compra de produto" },
  { id: "manual", label: "Manual" },
];

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatSource(source: string) {
  if (source === "appointment") return "Agendamento";
  if (source === "manual") return "Manual";
  if (source === "product") return "Produto";
  if (source === "product_purchase") return "Compra de produto";
  if (source === "product_sale") return "Venda de produto";
  return source;
}

function getServiceDisplay(r: FinancialRecord) {
  if (r.source === "appointment") {
    return r.service_name_snapshot ?? r.description ?? "Atendimento";
  }
  return r.description ?? "—";
}

interface ManualEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "income" | "expense";
  companyId: string;
  onSuccess: () => void;
}

function ManualEntryModal({
  open,
  onOpenChange,
  type,
  companyId,
  onSuccess,
}: ManualEntryModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const mutation = useMutation({
    mutationFn: () =>
      financialService.createManual({
        company_id: companyId,
        type,
        description: description.trim(),
        amount: parseFloat(amount.replace(",", ".")) || 0,
        created_at: `${date}T12:00:00`,
        created_by: user?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      onSuccess();
      onOpenChange(false);
      setDescription("");
      setAmount("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      toast.success(type === "income" ? "Entrada registrada!" : "Saída registrada!");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao registrar.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", ".")) || 0;
    if (!description.trim()) {
      toast.error("Informe a descrição.");
      return;
    }
    if (!val || val <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === "income" ? "Nova Entrada" : "Nova Saída"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Descrição</Label>
            <Input
              placeholder="Ex: Aluguel, Compra de produtos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^\d,.]/g, ""))
              }
            />
          </div>
          <div>
            <Label>Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const AppFinancial = () => {
  const { currentCompany } = useTenant();
  const { user } = useAuth();
  const companyId = currentCompany?.id ?? "";
  const [periodKey, setPeriodKey] = useState<PeriodKey>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [manualIncomeOpen, setManualIncomeOpen] = useState(false);
  const [manualExpenseOpen, setManualExpenseOpen] = useState(false);

  const { startDate, endDate } = getPeriodRange(
    periodKey,
    customStart || undefined,
    customEnd || undefined
  );

  const syncAndLoad = async () => {
    if (companyId) {
      await financialService.syncAppointmentRevenue(companyId, user?.id);
    }
    return financialService.listByCompany(companyId, {
      startDate,
      endDate,
      validOnly: true,
    });
  };

  const { data: stats, isError: statsError } = useQuery({
    queryKey: ["financial", "stats", companyId, startDate, endDate],
    queryFn: async () => {
      if (companyId) {
        await financialService.syncAppointmentRevenue(companyId, user?.id);
      }
      return financialService.getStats(companyId, { startDate, endDate });
    },
    enabled: !!companyId,
    retry: false,
  });

  const { data: recordsData, isError: recordsError } = useQuery({
    queryKey: ["financial", "records", companyId, startDate, endDate],
    queryFn: syncAndLoad,
    enabled: !!companyId,
    retry: false,
  });

  const records = recordsData?.data ?? [];

  const filteredRecords =
    sourceFilter === "all"
      ? records
      : records.filter((r) => r.source === sourceFilter);

  const summaryBySource = (() => {
    let servicos = 0;
    let produtos = 0;
    let outrasReceitas = 0;
    let despesas = 0;
    records.forEach((r) => {
      const amt = Math.abs(Number(r.amount));
      if (r.type === "expense") {
        despesas += amt;
      } else {
        if (r.source === "appointment") servicos += amt;
        else if (r.source === "product_sale") produtos += amt;
        else outrasReceitas += amt;
      }
    });
    return { servicos, produtos, outrasReceitas, despesas };
  })();

  const statsData = stats?.data ?? {
    openingBalance: 0,
    income: 0,
    expense: 0,
    balance: 0,
  };
  const hasError = statsError || recordsError;

  if (!companyId) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Selecione uma empresa para visualizar o financeiro.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {hasError && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          Erro ao carregar dados financeiros. Verifique se a tabela financial_records existe no banco.
        </div>
      )}

      {/* Filtro de período */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              variant={periodKey === opt.id ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodKey(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        {periodKey === "custom" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-[140px]"
            />
            <span className="text-muted-foreground">até</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-[140px]"
            />
          </div>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {formatPeriodLabel(periodKey, startDate, endDate)}
        </span>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <CardWidget
          title="Saldo Inicial"
          value={formatCurrency(statsData.openingBalance)}
          icon={Wallet}
        />
        <CardWidget
          title="Entradas no Caixa"
          value={formatCurrency(statsData.income)}
          icon={TrendingUp}
          trend="up"
        />
        <CardWidget
          title="Saídas do Caixa"
          value={formatCurrency(statsData.expense)}
          icon={TrendingDown}
          trend="down"
        />
        <CardWidget
          title="Saldo Atual"
          value={formatCurrency(statsData.balance)}
          icon={DollarSign}
        />
      </div>

      {/* Botões de movimentação manual */}
      <div className="flex gap-2 mb-4">
        <Button onClick={() => setManualIncomeOpen(true)}>
          <Plus size={16} className="mr-2" />
          Nova Entrada
        </Button>
        <Button variant="outline" onClick={() => setManualExpenseOpen(true)}>
          <Minus size={16} className="mr-2" />
          Nova Saída
        </Button>
      </div>

      {/* Resumo por origem (período selecionado) */}
      <div className="mb-4 p-4 rounded-xl border border-border bg-muted/30">
        <p className="text-sm font-medium text-muted-foreground mb-3">Resumo no período</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Serviços: </span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatCurrency(summaryBySource.servicos)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Produtos: </span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatCurrency(summaryBySource.produtos)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Outras receitas: </span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatCurrency(summaryBySource.outrasReceitas)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Despesas: </span>
            <span className="font-medium text-red-600 dark:text-red-400">
              {formatCurrency(summaryBySource.despesas)}
            </span>
          </div>
        </div>
      </div>

      {/* Filtro por origem (só a tabela) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Exibir:</span>
        {SOURCE_FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.id}
            variant={sourceFilter === opt.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSourceFilter(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Tabela de movimentações */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço / descrição</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Profissional</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="hidden sm:table-cell">Origem</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  {records.length === 0
                    ? "Nenhuma movimentação no período. Receitas de cortes entram aqui quando o agendamento está \"Concluído\" e o horário do atendimento já passou. Use os botões acima para entradas ou saídas manuais."
                    : "Nenhum registro com essa origem no período."}
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium align-top max-w-[200px]">
                    <span className="line-clamp-2">{getServiceDisplay(r)}</span>
                  </TableCell>
                  <TableCell className="align-top">
                    {r.source === "appointment"
                      ? r.client_name_snapshot ?? "—"
                      : "—"}
                  </TableCell>
                  <TableCell className="align-top">
                    {r.source === "appointment"
                      ? r.professional_name_snapshot ?? "—"
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground align-top whitespace-nowrap tabular-nums">
                    {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    <span className="block text-xs opacity-80">
                      {format(new Date(r.created_at), "HH:mm", { locale: ptBR })}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground align-top text-xs">
                    {formatSource(r.source)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium align-top",
                      r.type === "income"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {r.type === "income" ? "+" : "-"}
                    {formatCurrency(Math.abs(Number(r.amount)))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ManualEntryModal
        open={manualIncomeOpen}
        onOpenChange={setManualIncomeOpen}
        type="income"
        companyId={companyId}
        onSuccess={() => {}}
      />
      <ManualEntryModal
        open={manualExpenseOpen}
        onOpenChange={setManualExpenseOpen}
        type="expense"
        companyId={companyId}
        onSuccess={() => {}}
      />
    </PageContainer>
  );
};

export default AppFinancial;
