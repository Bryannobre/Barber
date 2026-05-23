import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtSign, Calendar, CheckCheck, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/database.types";

interface NotificationCardProps {
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
  onMarkRead: (n: AppNotification) => void;
  isMarkingRead?: boolean;
}

export function NotificationCard({
  notification,
  onOpen,
  onMarkRead,
  isMarkingRead,
}: NotificationCardProps) {
  const isMention = notification.type === "mention";
  const isAppointment = notification.type.startsWith("appointment_");
  const relative = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-stretch rounded-xl border shadow-sm transition-all duration-200 overflow-hidden",
        "hover:shadow-md hover:border-primary/25",
        !notification.is_read && "border-primary/30 bg-primary/[0.06] dark:bg-primary/10",
        notification.is_read && "border-border bg-card/80 opacity-90"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className={cn(
          "flex-1 text-left p-4 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        )}
      >
        <div className="flex gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              isMention
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : isAppointment
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-sky-500/15 text-sky-700 dark:text-sky-400"
            )}
          >
            {isMention ? (
              <AtSign className="h-5 w-5" />
            ) : isAppointment ? (
              <Calendar className="h-5 w-5" />
            ) : (
              <Megaphone className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">{notification.title}</span>
              {!notification.is_read && (
                <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                  Nova
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
            <p className="text-xs text-muted-foreground">{relative}</p>
          </div>
        </div>
      </button>

      {!notification.is_read && (
        <div className="flex sm:flex-col justify-end p-2 sm:p-3 sm:border-l border-border/60 bg-muted/20 sm:bg-transparent shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto gap-1.5 text-xs"
            disabled={isMarkingRead}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead(notification);
            }}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {isMarkingRead ? "Salvando..." : "Marcar como lida"}
          </Button>
        </div>
      )}
    </div>
  );
}
