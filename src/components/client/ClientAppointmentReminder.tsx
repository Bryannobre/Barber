import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { bookingService } from "@/services/booking.service";
import {
  getClientReminderCopy,
  getNextClientAppointment,
  shouldShowClientReminder,
} from "@/lib/clientAppointmentReminder";
import { cn } from "@/lib/utils";

interface ClientAppointmentReminderProps {
  className?: string;
}

/**
 * Lembrete in-app do próximo horário (sem push/e-mail/WhatsApp).
 */
export function ClientAppointmentReminder({ className }: ClientAppointmentReminderProps) {
  const { user } = useAuth();
  const [dismissedId, setDismissedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("client-reminder-last-dismiss") ?? null;
  });

  const { data } = useQuery({
    queryKey: ["appointments-client", user?.id],
    queryFn: () => bookingService.listMyAppointments(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const next = getNextClientAppointment(data?.upcoming ?? []);
  if (!next || !shouldShowClientReminder(next)) return null;
  if (dismissedId === next.id) return null;

  const copy = getClientReminderCopy(next);

  const handleDismiss = () => {
    sessionStorage.setItem("client-reminder-last-dismiss", next.id);
    setDismissedId(next.id);
  };

  return (
    <div
      className={cn(
        "mb-4 rounded-xl border p-4 shadow-sm",
        copy.urgency === "today"
          ? "border-primary/40 bg-primary/10"
          : copy.urgency === "tomorrow"
            ? "border-amber-500/40 bg-amber-500/10"
            : "border-border bg-muted/30",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            copy.urgency === "today" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Bell className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{copy.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{copy.subtitle}</p>
          <Link
            to="/client/appointments"
            className="text-xs font-medium text-primary hover:underline mt-2 inline-block"
          >
            Ver meus horários
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8"
          onClick={handleDismiss}
          aria-label="Dispensar lembrete desta sessão"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
