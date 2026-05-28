import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { clientService } from "@/services/client.service";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppPhoneLink } from "@/components/ui/WhatsAppPhoneLink";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  Phone,
  Mail,
  Calendar,
  CalendarCheck,
  TrendingUp,
  DollarSign,
  Receipt,
} from "lucide-react";

export interface ClientHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyClientId: string | null;
}

export function ClientHistorySheet({
  open,
  onOpenChange,
  companyId,
  companyClientId,
}: ClientHistorySheetProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-history", companyId, companyClientId],
    queryFn: () =>
      companyClientId
        ? clientService.getClientHistory(companyId, companyClientId)
        : Promise.resolve({ data: null, error: null }),
    enabled: !!companyId && !!companyClientId && open,
  });

  const result = data?.data;
  const client = result?.client as Record<string, unknown> | undefined;
  const stats = result?.stats as Record<string, unknown> | undefined;
  const history = (result?.history ?? []) as Array<{
    appointment_id: string;
    date: string;
    service_names: string;
    professional_name: string;
    valor: number;
  }>;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v);

  const lastVisit = stats?.ultima_visita as string | null | undefined;
  const lastVisitFormatted = lastVisit
    ? formatDistanceToNow(parseISO(lastVisit), { addSuffix: true, locale: ptBR })
    : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <User size={20} />
            Histórico do Cliente
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              </div>
            ) : error || !result ? (
              <p className="text-sm text-muted-foreground">
                {error
                  ? (error as Error).message
                  : "Nenhum dado encontrado."}
              </p>
            ) : (
              <>
                {/* Informações básicas */}
                <div>
                  <h3 className="font-semibold text-lg">
                    {(client?.full_name as string) ?? "—"}
                  </h3>
                  <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="shrink-0 text-muted-foreground" />
                      <WhatsAppPhoneLink phone={client?.phone as string | undefined} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="shrink-0" />
                      <span>{(client?.email as string) ?? "—"}</span>
                    </div>
                    {client?.created_at && (
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="shrink-0" />
                        <span>
                          Cliente desde{" "}
                          {format(
                            parseISO(client.created_at as string),
                            "MMM yyyy",
                            { locale: ptBR }
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  {client?.notes && (
                    <p className="mt-3 text-sm bg-muted/50 rounded-lg p-3">
                      {(client.notes as string)}
                    </p>
                  )}
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp size={14} />
                      <span className="text-xs">Visitas realizadas</span>
                    </div>
                    <p className="font-semibold text-lg">
                      {(stats?.total_visits as number) ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <CalendarCheck size={14} />
                      <span className="text-xs">Visitas marcadas</span>
                    </div>
                    <p className="font-semibold text-lg">
                      {(stats?.visitas_marcadas as number) ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign size={14} />
                      <span className="text-xs">Total gasto</span>
                    </div>
                    <p className="font-semibold text-lg">
                      {formatCurrency((stats?.total_gasto as number) ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Receipt size={14} />
                      <span className="text-xs">Ticket médio</span>
                    </div>
                    <p className="font-semibold text-lg">
                      {formatCurrency((stats?.ticket_medio as number) ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3 col-span-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar size={14} />
                      <span className="text-xs">Última visita</span>
                    </div>
                    <p className="font-semibold">{lastVisitFormatted}</p>
                  </div>
                </div>

                {/* Histórico */}
                <div>
                  <h4 className="font-semibold mb-3">Histórico</h4>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum atendimento concluído.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((item) => (
                        <li
                          key={item.appointment_id}
                          className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">{item.service_names}</p>
                            <p className="text-muted-foreground">
                              {format(
                                parseISO(item.date),
                                "d MMM yyyy",
                                { locale: ptBR }
                              )}{" "}
                              · {item.professional_name}
                            </p>
                          </div>
                          <span className="font-medium shrink-0">
                            {formatCurrency(item.valor)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
