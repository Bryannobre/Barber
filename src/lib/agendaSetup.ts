import type { ProfessionalWithServices, Service } from "@/types/database.types";

export interface AgendaSetupIssue {
  id: string;
  label: string;
  href: string;
}

export function getAgendaSetupStatus(
  services: Service[],
  professionals: ProfessionalWithServices[]
): { ready: boolean; issues: AgendaSetupIssue[] } {
  const issues: AgendaSetupIssue[] = [];

  if (services.length === 0) {
    issues.push({
      id: "services",
      label: "Cadastre pelo menos um serviço (nome, duração e preço)",
      href: "/app/services",
    });
  }

  const activePros = professionals.filter((p) => p.is_active !== false);
  if (activePros.length === 0) {
    issues.push({
      id: "professionals",
      label: "Cadastre pelo menos um profissional ativo",
      href: "/app/professionals",
    });
  }

  const prosWithoutHours = activePros.filter(
    (p) => !(p.working_hours && p.working_hours.length > 0)
  );
  if (activePros.length > 0 && prosWithoutHours.length > 0) {
    issues.push({
      id: "hours",
      label: `Defina horários de trabalho (${prosWithoutHours.length} profissional(is) sem jornada)`,
      href: "/app/professionals",
    });
  }

  const prosWithoutServices = activePros.filter((p) => {
    const links =
      (p as ProfessionalWithServices & { professional_services?: { service_id: string }[] })
        .professional_services ?? [];
    return links.length === 0;
  });
  if (activePros.length > 0 && services.length > 0 && prosWithoutServices.length > 0) {
    issues.push({
      id: "links",
      label: `Vincule serviços aos profissionais (${prosWithoutServices.length} sem serviço)`,
      href: "/app/professionals",
    });
  }

  return { ready: issues.length === 0, issues };
}
