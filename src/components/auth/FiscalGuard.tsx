import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCompanyPageAccess } from "@/hooks/useCompanyPageAccess";

interface FiscalGuardProps {
  children: ReactNode;
}

/** Controle de acesso ao módulo fiscal via allowed_pages em company_members */
export function FiscalGuard({ children }: FiscalGuardProps) {
  const { hasAccessToPage, isLoading } = useCompanyPageAccess();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!hasAccessToPage("fiscal")) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
