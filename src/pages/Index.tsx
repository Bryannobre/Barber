import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Shield, Building2, ChevronRight } from "lucide-react";
import PlatformBrandMark from "@/components/shared/PlatformBrandMark";
import { useAuth } from "@/hooks/useAuth";
import { resetAppTheme } from "@/lib/companyTheme";

const getDashboardByRole = (role: string) => {
  if (role === "owner") return "/owner/dashboard";
  if (role === "company_admin" || role === "employee") return "/app";
  if (role === "client") return "/client";
  return null;
};

interface OptionCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function OptionCard({ to, icon, title, description }: OptionCardProps) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
    </Link>
  );
}

const Index = () => {
  const { initialized, isAuthenticated, profile } = useAuth();

  useEffect(() => {
    resetAppTheme();
  }, []);

  if (!initialized) return null;

  if (isAuthenticated && profile?.role) {
    const dest = getDashboardByRole(profile.role);
    if (dest) return <Navigate to={dest} replace />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Background com gradiente sutil */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-primary/5 -z-10" />
      <div
        className="fixed inset-0 opacity-[0.015] -z-10"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="flex-1 flex items-center justify-center p-6 min-h-screen">
        <div className="w-full max-w-lg animate-fade-in">
          {/* Header */}
          <div className="mb-12 px-2">
            <PlatformBrandMark size="lg" showName={false} logoClassName="md:max-w-2xl" />
          </div>

          {/* Opções */}
          <div className="space-y-4">
            <OptionCard
              to="/auth/login?returnTo=%2Fowner%2Fdashboard&loginOnly=1"
              icon={<Shield size={24} className="text-primary" />}
              title="Painel Admin"
              description="Gestão da plataforma"
            />
            <OptionCard
              to="/auth/login?returnTo=%2Fapp&loginOnly=1"
              icon={<Building2 size={24} className="text-primary" />}
              title="Dashboard Empresa"
              description="Gestão do negócio"
            />
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-10">
            Escolha uma opção para continuar
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
