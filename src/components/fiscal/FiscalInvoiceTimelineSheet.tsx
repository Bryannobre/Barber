import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fiscalService } from "@/services/fiscal.service";
import type { InvoiceLog } from "@/types/fiscal.types";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  invoice_created: "Criado",
  issue_started: "Processando",
  issue_success: "Emitido",
  issue_failed: "Erro",
  retry_started: "Retry",
  retry_success: "Reemitido",
  retry_failed: "Erro no retry",
  cancelled_internal: "Cancelado",
};

function eventVariant(event: string): "default" | "secondary" | "destructive" | "outline" {
  if (event.includes("failed")) return "destructive";
  if (event.includes("success") || event === "invoice_created") return "default";
  if (event.includes("cancelled")) return "outline";
  return "secondary";
}

interface FiscalInvoiceTimelineSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  invoiceId: string | null;
  invoiceLabel?: string;
}

export function FiscalInvoiceTimelineSheet({
  open,
  onOpenChange,
  companyId,
  invoiceId,
  invoiceLabel,
}: FiscalInvoiceTimelineSheetProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["fiscal-logs", companyId, invoiceId],
    queryFn: () => fiscalService.getLogs(companyId, { invoiceId: invoiceId! }),
    enabled: open && !!companyId && !!invoiceId,
  });

  const sorted = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Timeline fiscal</SheetTitle>
          <SheetDescription>
            {invoiceLabel ?? "Histórico de eventos da nota"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-0">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            sorted.map((log: InvoiceLog, index) => (
              <div key={log.id} className="relative pl-6 pb-6 last:pb-0">
                {index < sorted.length - 1 && (
                  <span
                    className="absolute left-[7px] top-3 bottom-0 w-px bg-border"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 bg-background",
                    log.event.includes("failed")
                      ? "border-destructive"
                      : log.event.includes("success") || log.event === "invoice_created"
                        ? "border-primary"
                        : "border-muted-foreground"
                  )}
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={eventVariant(log.event)}>
                      {EVENT_LABELS[log.event] ?? log.event}
                    </Badge>
                    {log.status && (
                      <span className="text-xs text-muted-foreground">{log.status}</span>
                    )}
                    {log.retry_count != null && log.retry_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        tentativa {log.retry_count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{log.message ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
