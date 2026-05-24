/**
 * Título e subtítulo do header por rota (mais específico primeiro).
 */
const ROUTE_META: { path: string; title: string; subtitle?: string }[] = [
  { path: "/app/settings/landing", title: "Landing page", subtitle: "Personalização do site público" },
  {
    path: "/app/performance",
    title: "Desempenho",
    subtitle: "Indicadores, metas e rankings no período que você escolher.",
  },
  { path: "/app/notifications", title: "Notificações", subtitle: "Menções e avisos do mural" },
  { path: "/app/agenda", title: "Agenda", subtitle: "Agendamentos e disponibilidade" },
  { path: "/app/clients", title: "Clientes", subtitle: "Base e histórico de atendimentos" },
  { path: "/app/services", title: "Serviços", subtitle: "Catálogo e valores" },
  { path: "/app/professionals", title: "Profissionais", subtitle: "Equipe e agendas" },
  { path: "/app/financial", title: "Financeiro", subtitle: "Receitas, despesas e fluxo" },
  { path: "/app/fiscal/settings", title: "Fiscal", subtitle: "Configurações e cadastro da empresa" },
  { path: "/app/fiscal/logs", title: "Fiscal", subtitle: "Histórico de eventos de emissão" },
  { path: "/app/fiscal", title: "Fiscal", subtitle: "Notas fiscais de serviço (NFS-e)" },
  { path: "/app/stock", title: "Estoque", subtitle: "Produtos e movimentações" },
  { path: "/app/payments", title: "Pagamentos", subtitle: "Repasses e comissões" },
  { path: "/app/reports", title: "Relatórios", subtitle: "Indicadores e análises" },
  { path: "/app/mural", title: "Mural de recados", subtitle: "Comunicação interna da equipe" },
  { path: "/app/settings", title: "Configurações", subtitle: "Empresa, tema e preferências" },
  { path: "/app", title: "Dashboard", subtitle: "Visão geral do negócio" },
];

export function getDashboardPageMeta(pathname: string): { title: string; subtitle?: string } {
  for (const r of ROUTE_META) {
    const exactApp = r.path === "/app";
    if (exactApp ? pathname === "/app" : pathname.startsWith(r.path)) {
      return { title: r.title, subtitle: r.subtitle };
    }
  }
  return { title: "Área da empresa", subtitle: undefined };
}
