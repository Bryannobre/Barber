import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/types/fiscal.types";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  ISSUED: "Emitida",
  FAILED: "Erro",
  CANCELLED: "Cancelada",
};

const STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  PROCESSING: "outline",
  ISSUED: "default",
  FAILED: "destructive",
  CANCELLED: "secondary",
};

const STATUS_CLASS: Partial<Record<InvoiceStatus, string>> = {
  PROCESSING: "animate-pulse border-primary/50",
  CANCELLED: "opacity-70 line-through decoration-muted-foreground",
};

export function FiscalStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "secondary"}
      className={STATUS_CLASS[status]}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
