import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgendaSetupIssue } from "@/lib/agendaSetup";

interface AgendaSetupBannerProps {
  ready: boolean;
  issues: AgendaSetupIssue[];
}

export function AgendaSetupBanner({ ready, issues }: AgendaSetupBannerProps) {
  if (ready) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">
            Agendamento pronto para clientes
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Serviços, profissionais e horários configurados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Configure a agenda antes de receber clientes
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Sem estes itens, a landing e o agendamento online podem ficar sem horários
              disponíveis.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {issues.map((issue) => (
              <li key={issue.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{issue.label}</span>
                <Button variant="outline" size="sm" className="shrink-0" asChild>
                  <Link to={issue.href}>Resolver</Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
