import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { GlobalSearchDialog } from "@/components/app/GlobalSearchDialog";
import { useNotificationsRealtime } from "@/hooks/useNotificationsRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyPageAccess, type AppPageKey } from "@/hooks/useCompanyPageAccess";
import { applyCompanyTheme, resetAppTheme } from "@/lib/companyTheme";
import { getDashboardPageMeta } from "@/lib/dashboardLayoutMeta";
import { companyService } from "@/services/company.service";
import type { Company } from "@/types/database.types";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  UserCheck,
  DollarSign,
  Package,
  BarChart3,
  Settings,
  Target,
  Plus,
  ChevronLeft,
  Menu,
  ChevronRight,
  LogOut,
  Percent,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  Search,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type NavItemDef = {
  label: string;
  icon: LucideIcon;
  path: string;
  accessKey: AppPageKey;
};

/** Blocos na ordem: topo empresa → separador → … → rodapé do usuário fica fora do `<nav>`. */
const NAV_GROUPS: NavItemDef[][] = [
  [
    { label: "Dashboard", icon: LayoutDashboard, path: "/app", accessKey: "dashboard" },
    { label: "Desempenho", icon: Target, path: "/app/performance", accessKey: "performance" },
    { label: "Agenda", icon: Calendar, path: "/app/agenda", accessKey: "agenda" },
    { label: "Clientes", icon: Users, path: "/app/clients", accessKey: "clients" },
  ],
  [
    { label: "Serviços", icon: Scissors, path: "/app/services", accessKey: "services" },
    { label: "Profissionais", icon: UserCheck, path: "/app/professionals", accessKey: "professionals" },
    { label: "Mural", icon: MessageSquare, path: "/app/mural", accessKey: "mural" },
  ],
  [
    { label: "Financeiro", icon: DollarSign, path: "/app/financial", accessKey: "financial" },
    { label: "Fiscal", icon: FileText, path: "/app/fiscal", accessKey: "fiscal" },
    { label: "Pagamentos", icon: Percent, path: "/app/payments", accessKey: "payments" },
    { label: "Relatórios", icon: BarChart3, path: "/app/reports", accessKey: "reports" },
  ],
  [
    { label: "Estoque", icon: Package, path: "/app/stock", accessKey: "stock" },
    { label: "Configurações", icon: Settings, path: "/app/settings", accessKey: "settings" },
  ],
];

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function companyLogoSrc(c: Company | null | undefined) {
  if (!c) return undefined;
  return c.logo_url?.trim() || c.logo?.trim() || undefined;
}

const DashboardLayout = () => {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { currentCompany, setCurrentCompany } = useTenant();
  const { profile, user, signOut } = useAuth();
  const { hasAccessToPage, hasAccessToPath, isLoading: accessLoading, refetchAccess } =
    useCompanyPageAccess();
  const canAccessCurrentPath = hasAccessToPath(location.pathname);

  /** Troca de empresa na UI: apenas dono da plataforma (role owner). Demais perfis veem só o contexto da empresa atual. */
  const canSwitchCompany = profile?.role === "owner";

  const { data: switcherCompanies = [] } = useQuery({
    queryKey: ["dashboard-company-switcher", user?.id],
    queryFn: async () => {
      const { data } = await companyService.list();
      return data ?? [];
    },
    enabled: !!user?.id && canSwitchCompany,
    staleTime: 60_000,
  });

  const pageMeta = useMemo(() => getDashboardPageMeta(location.pathname), [location.pathname]);

  const visibleNavGroups = NAV_GROUPS.map((group) =>
    group.filter((item) => hasAccessToPage(item.accessKey))
  ).filter((group) => group.length > 0);

  const companyTagline =
    currentCompany?.slogan?.trim() ||
    (currentCompany?.phone?.trim() ? `Tel. ${currentCompany.phone}` : null) ||
    "Conta empresarial";

  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Usuário";
  const displayEmail = user?.email ?? "";

  useNotificationsRealtime(
    hasAccessToPage("notifications") ? currentCompany?.id : undefined,
    hasAccessToPage("notifications")
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (currentCompany?.id) setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentCompany?.id]);

  const handleRefresh = useCallback(async () => {
    if (!currentCompany?.id || refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["appointments"] }),
        queryClient.refetchQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.refetchQueries({ queryKey: ["dashboard-revenue"] }),
        queryClient.refetchQueries({ queryKey: ["dashboard-activity"] }),
        queryClient.refetchQueries({ queryKey: ["dashboard-performance"] }),
        queryClient.refetchQueries({ queryKey: ["performance-goals-block"] }),
        queryClient.refetchQueries({ queryKey: ["performance-rankings-trend"] }),
        queryClient.refetchQueries({ queryKey: ["performance-indicators"] }),
        queryClient.refetchQueries({ queryKey: ["dashboard-services"] }),
        queryClient.refetchQueries({ queryKey: ["financial"] }),
        queryClient.refetchQueries({ queryKey: ["fiscal-invoices"] }),
        queryClient.refetchQueries({ queryKey: ["fiscal-logs"] }),
        queryClient.refetchQueries({ queryKey: ["fiscal-invoice-map"] }),
        queryClient.refetchQueries({ queryKey: ["clients"] }),
        queryClient.refetchQueries({ queryKey: ["services"] }),
        queryClient.refetchQueries({ queryKey: ["professionals"] }),
        queryClient.refetchQueries({ queryKey: ["stock-products"] }),
        queryClient.refetchQueries({ queryKey: ["payment-professionals"] }),
        queryClient.refetchQueries({ queryKey: ["company-member-access"] }),
        queryClient.refetchQueries({ queryKey: ["recados"] }),
        queryClient.refetchQueries({ queryKey: ["notifications"] }),
        queryClient.refetchQueries({ queryKey: ["notifications-unread"] }),
      ]);
      toast.success("Dados atualizados");
    } catch {
      toast.error("Erro ao atualizar. Tente novamente.");
    } finally {
      setRefreshing(false);
    }
  }, [currentCompany?.id, queryClient, refreshing]);

  const switchTenant = useCallback(
    async (company: Company) => {
      if (!company?.id || company.id === currentCompany?.id) return;
      setCurrentCompany(company);
      await queryClient.invalidateQueries();
      toast.success(`Conta: ${company.name}`);
    },
    [currentCompany?.id, queryClient, setCurrentCompany]
  );

  useEffect(() => {
    applyCompanyTheme(currentCompany);
    return () => {
      resetAppTheme();
    };
  }, [currentCompany]);

  const isActivePath = (path: string) =>
    path === "/app" ? location.pathname === "/app" : location.pathname.startsWith(path);

  const renderNavLink = (item: NavItemDef, compact: boolean, onNavigate?: () => void) => {
    const active = isActivePath(item.path);
    const className = cn(
      "group relative flex items-center rounded-md text-sm outline-none transition-colors duration-150",
      compact ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
      "hover:bg-secondary/80 hover:text-foreground",
      active
        ? "bg-primary/10 font-medium text-primary before:absolute before:left-0 before:top-1/2 before:h-7 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary"
        : "text-muted-foreground",
      !active && "hover:translate-x-0.5"
    );

    const inner = (
      <>
        <item.icon className="size-5 shrink-0 opacity-90" aria-hidden />
        {!compact && <span className="truncate">{item.label}</span>}
      </>
    );

    if (onNavigate) {
      return (
        <SheetClose asChild key={item.path}>
          <Link to={item.path} className={className} onClick={onNavigate}>
            {inner}
          </Link>
        </SheetClose>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        title={compact ? item.label : undefined}
        className={className}
      >
        {inner}
      </Link>
    );
  };

  const renderNavBlock = (items: NavItemDef[], compact: boolean, onNavigate?: () => void) => (
    <div className="space-y-0.5">{items.map((item) => renderNavLink(item, compact, onNavigate))}</div>
  );

  const CompanySwitcher = ({ narrow }: { narrow: boolean }) => {
    const logo = companyLogoSrc(currentCompany);
    const name = currentCompany?.name ?? "Empresa";

    const companyRowClass = cn(
      "flex w-full items-center gap-2.5 rounded-lg border border-transparent text-left transition-colors",
      narrow ? "justify-center p-1.5" : "p-2",
      canSwitchCompany
        ? "hover:border-border hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        : "cursor-default"
    );

    const companyRowInner = (
      <>
        <Avatar className={cn("shrink-0 border border-border/60", narrow ? "size-9" : "size-10")}>
          {logo ? <AvatarImage src={logo} alt="" /> : null}
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {initialsFromName(name)}
          </AvatarFallback>
        </Avatar>
        {!narrow && (
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold leading-tight">{name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{companyTagline}</p>
          </div>
        )}
        {!narrow && canSwitchCompany && (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </>
    );

    if (!canSwitchCompany) {
      return (
        <div className={companyRowClass} aria-label={`Empresa: ${name}`}>
          {companyRowInner}
        </div>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={companyRowClass} aria-label="Selecionar empresa">
            {companyRowInner}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="start" sideOffset={6}>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Trocar conta
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {switcherCompanies.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground">Nenhuma empresa disponível.</div>
          ) : (
            switcherCompanies.map((c) => {
              const selected = c.id === currentCompany?.id;
              const src = companyLogoSrc(c);
              return (
                <DropdownMenuItem
                  key={c.id}
                  className="gap-2 py-2"
                  onSelect={() => void switchTenant(c)}
                  disabled={selected}
                >
                  <Avatar className="size-8 border border-border/50">
                    {src ? <AvatarImage src={src} alt="" /> : null}
                    <AvatarFallback className="text-[10px]">{initialsFromName(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{c.slug}</p>
                  </div>
                  {selected && (
                    <span className="text-[10px] font-medium uppercase text-primary">Ativa</span>
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const SidebarUser = ({ narrow }: { narrow: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-transparent text-left transition-colors",
            "hover:border-border hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            narrow ? "justify-center p-2" : "p-2"
          )}
          aria-label="Menu da conta"
        >
          <Avatar className="size-9 shrink-0 border border-border/60">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback className="text-xs font-medium">{initialsFromName(displayName)}</AvatarFallback>
          </Avatar>
          {!narrow && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{displayEmail || "—"}</p>
            </div>
          )}
          {!narrow && <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" side="top" align="start" sideOffset={8}>
        <DropdownMenuLabel className="font-normal">
          <span className="text-xs text-muted-foreground">Conta</span>
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasAccessToPage("settings") && (
          <DropdownMenuItem asChild>
            <Link to="/app/settings" className="gap-2">
              <Settings className="size-4" />
              Configurações da conta
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onSelect={() => void signOut()}
        >
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const sidebarShell = (opts: { narrow: boolean; onNavigate?: () => void }) => (
    <>
      <div
        className={cn(
          "flex shrink-0 items-start gap-1 border-b border-border",
          opts.narrow ? "flex-col items-center px-1 py-2" : "px-2 py-2"
        )}
      >
        <div className={cn("min-w-0 flex-1", opts.narrow && "flex w-full justify-center")}>
          <CompanySwitcher narrow={opts.narrow} />
        </div>
        {!opts.narrow && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-1 shrink-0 text-muted-foreground"
            onClick={() => setCollapsed(true)}
            aria-label="Recolher menu"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
        {opts.narrow && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            onClick={() => setCollapsed(false)}
            aria-label="Expandir menu"
          >
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3 scrollbar-theme">
        {visibleNavGroups.map((group, idx) => (
          <div key={idx}>
            {idx > 0 ? <Separator className="my-3 bg-border/80" /> : null}
            {renderNavBlock(group, opts.narrow, opts.onNavigate)}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2">
        <SidebarUser narrow={opts.narrow} />
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-300 md:flex",
          collapsed ? "w-[4.25rem]" : "w-64"
        )}
      >
        {sidebarShell({ narrow: collapsed })}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-stretch gap-2 border-b border-border bg-card px-3 md:h-16 md:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="Abrir menu">
                  <Menu className="size-[18px]" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex h-full w-[min(100%,20rem)] flex-col gap-0 p-0"
              >
                <SheetHeader className="space-y-0.5 border-b border-border px-4 py-3 text-left">
                  <SheetTitle className="font-display text-base font-semibold">Menu</SheetTitle>
                  <p className="text-xs text-muted-foreground">Empresa e navegação</p>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {sidebarShell({ narrow: false, onNavigate: () => setMobileMenuOpen(false) })}
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 py-1">
              <h1 className="truncate font-display text-base font-semibold md:text-lg">{pageMeta.title}</h1>
              {pageMeta.subtitle ? (
                <p className="hidden truncate text-xs text-muted-foreground sm:block md:text-sm">
                  {pageMeta.subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="hidden flex-1 items-center justify-center px-2 lg:flex">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              disabled={!currentCompany?.id}
              className="relative w-full max-w-md text-left"
              aria-label="Abrir busca global (Ctrl+K)"
            >
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <span className="flex h-9 w-full items-center rounded-md border border-input bg-background/80 pl-9 pr-16 text-sm text-muted-foreground">
                Buscar cliente, agendamento…
              </span>
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                Ctrl+K
              </kbd>
            </button>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0 text-muted-foreground"
              onClick={() => setSearchOpen(true)}
              disabled={!currentCompany?.id}
              aria-label="Buscar"
            >
              <Search className="size-[18px]" />
            </Button>
            {hasAccessToPage("notifications") && (
              <NotificationsBell companyId={currentCompany?.id} />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleRefresh()}
              disabled={refreshing || !currentCompany?.id}
              title="Atualizar dados"
              className="shrink-0 text-muted-foreground"
              aria-label="Atualizar dados"
            >
              <RefreshCw className={cn("size-[18px]", refreshing && "animate-spin")} />
            </Button>
            <Link to="/app/agenda?new=1" className="hidden sm:block">
              <Button size="sm" className="whitespace-nowrap shadow-sm">
                <Plus className="mr-1.5 size-4" />
                Novo agendamento
              </Button>
            </Link>
            <Link to="/app/agenda?new=1" className="sm:hidden">
              <Button size="icon" className="shadow-sm" aria-label="Novo agendamento">
                <Plus className="size-4" />
              </Button>
            </Link>
          </div>
        </header>

        <main className="scrollbar-theme min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6">
          {accessLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Carregando acessos...</div>
            </div>
          ) : canAccessCurrentPath ? (
            <RouteErrorBoundary>
              <Outlet />
            </RouteErrorBoundary>
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
              <p className="text-sm text-muted-foreground max-w-md">
                Você não tem permissão para esta área. Se acabou de receber acesso, atualize as permissões.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="default" size="sm" onClick={() => void refetchAccess()}>
                  Atualizar permissões
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/app">Ir ao painel</Link>
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      {currentCompany?.id && (
        <GlobalSearchDialog
          companyId={currentCompany.id}
          open={searchOpen}
          onOpenChange={setSearchOpen}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
