import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Scissors, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { globalSearchService } from "@/services/globalSearch.service";

interface GlobalSearchDialogProps {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  completed: "Concluído",
  blocked: "Bloqueado",
};

export function GlobalSearchDialog({
  companyId,
  open,
  onOpenChange,
}: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", companyId, query],
    queryFn: () => globalSearchService.search(companyId, query),
    enabled: open && !!companyId && query.trim().length >= 2,
    staleTime: 10_000,
  });

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const hasResults =
    (data?.clients.length ?? 0) > 0 ||
    (data?.appointments.length ?? 0) > 0 ||
    (data?.services.length ?? 0) > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar cliente, telefone, agendamento ou serviço…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < 2 ? (
          <CommandEmpty>Digite pelo menos 2 caracteres</CommandEmpty>
        ) : isFetching ? (
          <CommandEmpty>Buscando…</CommandEmpty>
        ) : !hasResults ? (
          <CommandEmpty>Nenhum resultado encontrado</CommandEmpty>
        ) : (
          <>
            {(data?.clients.length ?? 0) > 0 && (
              <CommandGroup heading="Clientes">
                {data!.clients.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`client-${c.id}-${c.full_name}`}
                    onSelect={() => go("/app/clients")}
                  >
                    <Users className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                    <span className="truncate">
                      {c.full_name}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(data?.appointments.length ?? 0) > 0 && (
              <>
                {(data?.clients.length ?? 0) > 0 && <CommandSeparator />}
                <CommandGroup heading="Agendamentos (próximos 14 dias)">
                  {data!.appointments.map((a) => {
                    const dateLabel = format(parseISO(a.date), "dd/MM", { locale: ptBR });
                    return (
                      <CommandItem
                        key={a.id}
                        value={`apt-${a.id}-${a.client_name}`}
                        onSelect={() => go(`/app/agenda?edit=${a.id}`)}
                      >
                        <Calendar className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                        <span className="truncate">
                          {a.client_name ?? "Cliente"} — {dateLabel} {a.start_time} ·{" "}
                          {a.professional_name} ·{" "}
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}

            {(data?.services.length ?? 0) > 0 && (
              <>
                {((data?.clients.length ?? 0) > 0 ||
                  (data?.appointments.length ?? 0) > 0) && <CommandSeparator />}
                <CommandGroup heading="Serviços">
                  {data!.services.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`service-${s.id}-${s.name}`}
                      onSelect={() => go("/app/services")}
                    >
                      <Scissors className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                      <span className="truncate">{s.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
