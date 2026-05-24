import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import PageContainer from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenant } from "@/contexts/TenantContext";
import { fiscalService } from "@/services/fiscal.service";

export default function AppFiscalLogs() {
  const { currentCompany } = useTenant();
  const companyId = currentCompany?.id ?? "";
  const [searchParams] = useSearchParams();
  const invoiceFilter = searchParams.get("invoice") ?? "";
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading, isError } = useQuery({
    queryKey: ["fiscal-logs", companyId, invoiceFilter],
    queryFn: () =>
      fiscalService.getLogs(companyId, {
        invoiceId: invoiceFilter || undefined,
        limit: 200,
      }),
    enabled: !!companyId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.event.toLowerCase().includes(q) ||
        (l.message ?? "").toLowerCase().includes(q) ||
        (l.status ?? "").toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link to="/app/fiscal">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao fiscal
        </Link>
      </Button>

      {invoiceFilter && (
        <p className="text-sm text-muted-foreground mb-2">
          Filtrando logs da nota: <span className="font-mono">{invoiceFilter}</span>
        </p>
      )}

      <Input
        placeholder="Buscar evento ou mensagem..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md mb-4"
      />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <p className="p-8 text-center text-destructive">Erro ao carregar logs.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="hidden md:table-cell">Retry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    Nenhum log registrado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.event}</Badge>
                    </TableCell>
                    <TableCell>{log.status ?? "—"}</TableCell>
                    <TableCell className="max-w-md truncate">{log.message ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {log.retry_count != null ? log.retry_count : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </PageContainer>
  );
}
