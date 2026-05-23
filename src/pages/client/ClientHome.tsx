import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { bookingService } from "@/services/booking.service";
import { Calendar, Clock, Bell } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getClientReminderCopy,
  getNextClientAppointment,
} from "@/lib/clientAppointmentReminder";

const ClientHome = () => {
  const { user, profile } = useAuth();
  const { currentCompany } = useTenant();
  const { data: appointmentsData } = useQuery({
    queryKey: ["appointments-client", user?.id],
    queryFn: () => bookingService.listMyAppointments(user!.id),
    enabled: !!user?.id,
  });

  const upcomingAppointments = (appointmentsData?.upcoming ?? []).slice(0, 3);
  const nextAppointment = getNextClientAppointment(appointmentsData?.upcoming ?? []);
  const nextReminder = nextAppointment ? getClientReminderCopy(nextAppointment) : null;
  const bookingPath = currentCompany?.slug
    ? `/client/booking?company=${currentCompany.slug}`
    : "/client/booking";

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      {/* Hero + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Olá, {profile?.full_name?.split(" ")[0] ?? "Cliente"}! 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Bem-vindo de volta</p>
        </div>
        <Link to={bookingPath} className="shrink-0">
          <Button className="w-full sm:w-auto sm:min-w-[200px] py-6 sm:py-6 text-base sm:text-lg">
            <Calendar size={20} className="mr-2 shrink-0" /> Agendar Horário
          </Button>
        </Link>
      </div>

      {nextAppointment && nextReminder && (
        <section
          className="rounded-xl border border-primary/30 bg-primary/5 p-4 md:p-5"
          aria-label="Próximo horário"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Bell size={22} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-primary/80">
                Lembrete
              </p>
              <p className="text-lg font-semibold mt-0.5">{nextReminder.title}</p>
              <p className="text-sm text-muted-foreground">{nextReminder.subtitle}</p>
            </div>
          </div>
        </section>
      )}

      {/* Próximos agendamentos */}
      <section>
        <h2 className="font-semibold mb-3 md:mb-4 text-lg">Próximos Agendamentos</h2>
        {upcomingAppointments.length === 0 ? (
          <div className="bg-muted/30 border border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground text-sm">Nenhum agendamento futuro</p>
            <p className="text-muted-foreground text-xs mt-1">Agende seu horário acima</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingAppointments.map((apt) => (
              <div
                key={apt.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-primary font-bold text-sm sm:text-base leading-tight">
                    {format(parseISO(apt.date), "EEEE, d MMM", { locale: ptBR })} ·{" "}
                    {apt.start_time?.slice(0, 5)}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                      apt.status === "confirmed"
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {apt.status === "confirmed" ? "Confirmado" : "Pendente"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{apt.duration_minutes}min</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {upcomingAppointments.length > 0 && (
        <Link to="/client/appointments" className="block">
          <Button variant="outline" className="w-full sm:w-auto sm:min-w-[240px] h-auto py-4 flex items-center justify-center gap-2">
            <Clock size={20} />
            <span>Ver todos os agendamentos</span>
          </Button>
        </Link>
      )}
    </div>
  );
};

export default ClientHome;
