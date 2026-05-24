import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";

export const APP_PAGE_KEYS = [
  "dashboard",
  "performance",
  "agenda",
  "clients",
  "services",
  "professionals",
  "financial",
  "stock",
  "payments",
  "reports",
  "fiscal",
  "mural",
  "notifications",
  "settings",
] as const;

export type AppPageKey = (typeof APP_PAGE_KEYS)[number];

/** Rótulos para UI (ex.: permissões na equipe) — manter alinhado a cada chave em APP_PAGE_KEYS */
export const APP_PAGE_LABELS: Record<AppPageKey, string> = {
  dashboard: "Dashboard",
  performance: "Desempenho",
  agenda: "Agenda",
  clients: "Clientes",
  services: "Serviços",
  professionals: "Profissionais",
  financial: "Financeiro",
  stock: "Estoque",
  payments: "Pagamentos",
  reports: "Relatórios",
  fiscal: "Fiscal",
  mural: "Mural de recados",
  notifications: "Notificações",
  settings: "Configurações",
};

function mapPathToPageKey(pathname: string): AppPageKey {
  if (pathname.startsWith("/app/performance")) return "performance";
  if (pathname.startsWith("/app/agenda")) return "agenda";
  if (pathname.startsWith("/app/clients")) return "clients";
  if (pathname.startsWith("/app/services")) return "services";
  if (pathname.startsWith("/app/professionals")) return "professionals";
  if (pathname.startsWith("/app/financial")) return "financial";
  if (pathname.startsWith("/app/stock")) return "stock";
  if (pathname.startsWith("/app/payments")) return "payments";
  if (pathname.startsWith("/app/commissions")) return "payments"; // legacy redirect
  if (pathname.startsWith("/app/reports")) return "reports";
  if (pathname.startsWith("/app/fiscal")) return "fiscal";
  if (pathname.startsWith("/app/mural")) return "mural";
  if (pathname.startsWith("/app/notifications")) return "notifications";
  if (pathname.startsWith("/app/settings")) return "settings";
  return "dashboard";
}

export function useCompanyPageAccess() {
  const { user, profile } = useAuth();
  const { currentCompany } = useTenant();
  const isOwner = profile?.role === "owner";

  const { data, isLoading, refetch: refetchAccess } = useQuery({
    queryKey: ["company-member-access", currentCompany?.id, user?.id],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("company_members")
        .select("allowed_pages")
        .eq("company_id", currentCompany!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (row?.allowed_pages as string[] | null | undefined) ?? null;
    },
    enabled: !!user?.id && !!currentCompany?.id && !isOwner,
  });

  const allowedPages: AppPageKey[] =
    isOwner || !data
      ? [...APP_PAGE_KEYS]
      : APP_PAGE_KEYS.filter((key) => {
          if (key === "payments")
            return data.includes("payments") || data.includes("commissions");
          return data.includes(key);
        });

  const hasAccessToPage = (pageKey: AppPageKey) => allowedPages.includes(pageKey);
  const hasAccessToPath = (pathname: string) => hasAccessToPage(mapPathToPageKey(pathname));

  return {
    isLoading: !isOwner && isLoading,
    allowedPages,
    hasAccessToPage,
    hasAccessToPath,
    refetchAccess,
  };
}
