import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { Home, Calendar, Clock, User, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useQuery } from "@tanstack/react-query";
import { companyLandingService } from "@/services/companyLanding.service";
import { applyCompanyThemeForSite } from "@/lib/companyTheme";
import { ClientAuthModal } from "@/components/client/ClientAuthModal";
import { ClientAppointmentReminder } from "@/components/client/ClientAppointmentReminder";

const navItems = (
  bookingPath: string
): { label: string; icon: typeof Home; path: string }[] => [
  { label: "Início", icon: Home, path: "/client" },
  { label: "Agendar", icon: Calendar, path: bookingPath },
  { label: "Meus Horários", icon: Clock, path: "/client/appointments" },
  { label: "Perfil", icon: User, path: "/client/profile" },
];

const ClientLayout = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, initialized } = useAuth();
  const { currentCompany, setCurrentCompanyBySlug } = useTenant();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const companySlug = searchParams.get("company");
  useEffect(() => {
    if (companySlug) setCurrentCompanyBySlug(companySlug);
  }, [companySlug, setCurrentCompanyBySlug]);

  const { data: landingRes } = useQuery({
    queryKey: ["company-landing-settings", currentCompany?.id],
    queryFn: () => companyLandingService.getByCompanyId(currentCompany!.id),
    enabled: !!currentCompany?.id,
  });

  useEffect(() => {
    if (currentCompany) {
      applyCompanyThemeForSite(currentCompany, landingRes?.data?.primary_color);
    }
  }, [currentCompany, landingRes?.data?.primary_color]);

  const companyId = currentCompany?.id ?? null;
  const companyName = currentCompany?.name ?? "brynex";
  const bookingPath = currentCompany?.slug
    ? `/client/booking?company=${currentCompany.slug}`
    : "/client/booking";
  const items = navItems(bookingPath);

  const renderNavItem = (item: (typeof items)[0]) => {
    const pathOnly = item.path.split("?")[0];
    const active = location.pathname === pathOnly;
    const baseClass = cn(
      "flex flex-col items-center justify-center gap-1 min-h-[48px] min-w-[56px] px-3 py-2 text-xs transition-colors rounded-lg touch-manipulation",
      active ? "text-primary" : "text-muted-foreground"
    );
    const requiresAuth = ["/client", "/client/appointments", "/client/profile"].includes(pathOnly);
    if (requiresAuth && initialized && !user) {
      return (
        <button
          key={item.path}
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className={baseClass}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </button>
      );
    }

    return (
      <Link key={item.path} to={item.path} className={baseClass}>
        <item.icon size={20} />
        <span>{item.label}</span>
      </Link>
    );
  };

  const navLinkClass = (item: (typeof items)[0]) => {
    const pathOnly = item.path.split("?")[0];
    const isActive = location.pathname === pathOnly;
    return cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar: tablet e desktop */}
      <aside className="hidden md:flex md:flex-col md:w-56 lg:w-64 md:border-r md:border-border md:bg-card/50 md:shrink-0">
        <header className="p-4 md:p-5 border-b border-border flex items-center gap-2">
          <Scissors className="text-primary shrink-0" size={22} />
          <span className="font-display font-bold text-primary truncate">{companyName}</span>
        </header>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => {
            const pathOnly = item.path.split("?")[0];
            const requiresAuth = ["/client", "/client/appointments", "/client/profile"].includes(pathOnly);
            const isAuthButton = requiresAuth && initialized && !user;
            if (isAuthButton) {
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className={cn("w-full text-left", navLinkClass(item))}
                >
                  <item.icon size={20} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            }
            return (
              <Link key={item.path} to={item.path} className={navLinkClass(item)}>
                <item.icon size={20} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Conteúdo principal */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header mobile */}
        <header className="md:hidden p-4 border-b border-border flex items-center gap-2 shrink-0">
          <Scissors className="text-primary" size={20} />
          <span className="font-display font-bold text-primary">{companyName}</span>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6 lg:p-8 lg:pb-8 scrollbar-theme">
          <div className="mx-auto w-full max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl">
            {user && <ClientAppointmentReminder />}
            <Outlet />
          </div>
        </main>

        {/* Bottom nav: fixo no mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex justify-around py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {items.map(renderNavItem)}
        </nav>
      </div>

      <ClientAuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        companyId={companyId}
        companyName={companyName}
        companySlug={currentCompany?.slug ?? null}
        onSuccess={() => setAuthModalOpen(false)}
      />
    </div>
  );
};

export default ClientLayout;
