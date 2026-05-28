import { cn } from "@/lib/utils";
import { WhatsAppPhoneLink } from "@/components/ui/WhatsAppPhoneLink";

interface BookingSummaryProps {
  companyName?: string;
  serviceName?: string;
  professionalName?: string;
  professionalSpecialty?: string | null;
  clientName?: string;
  clientPhone?: string;
  date?: string;
  time?: string;
  duration?: number;
  totalPrice?: number;
  className?: string;
  compact?: boolean;
}

export function BookingSummary({
  companyName,
  serviceName,
  professionalName,
  professionalSpecialty,
  clientName,
  clientPhone,
  date,
  time,
  duration,
  totalPrice,
  className,
  compact = false,
}: BookingSummaryProps) {
  const hasData =
    companyName ?? serviceName ?? professionalName ?? clientName ?? clientPhone ?? date ?? time;

  if (!hasData) return null;

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(v);

  const professionalLine = professionalName
    ? professionalSpecialty
      ? `${professionalName} - ${professionalSpecialty}`
      : professionalName
    : "";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        compact && "p-3 lg:p-4",
        className
      )}
    >
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        Resumo
      </p>
      <div className={cn("space-y-1.5 text-sm", compact && "space-y-1")}>
        {professionalLine && (
          <p>
            <span className="text-muted-foreground">Profissional:</span> {professionalLine}
          </p>
        )}
        {serviceName && (
          <p>
            <span className="text-muted-foreground">Serviço(s):</span> {serviceName}
          </p>
        )}
        {clientName && (
          <p>
            <span className="text-muted-foreground">Usuário:</span> {clientName}
          </p>
        )}
        {clientPhone && (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-muted-foreground">Número:</span>
            <WhatsAppPhoneLink phone={clientPhone} />
          </p>
        )}
        {date && (
          <p>
            <span className="text-muted-foreground">Data:</span> {formatDate(date)}
          </p>
        )}
        {time && (
          <p>
            <span className="text-muted-foreground">Horário:</span> {time}
            {duration != null ? ` - ${duration} minutos` : ""}
          </p>
        )}
      </div>
      {totalPrice != null && totalPrice > 0 && (
        <>
          <hr className="my-3 border-border" />
          <p className="text-xl font-bold text-primary">{formatPrice(totalPrice)}</p>
        </>
      )}
    </div>
  );
}
