import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetAppTheme } from "@/lib/companyTheme";
import { SignUpForm, type SignUpFormValues } from "@/components/auth/SignUpForm";
import { sanitizeInternalReturnTo } from "@/lib/safeRedirect";
import { createClientAccount } from "@/services/clientAccount.service";
import { supabase } from "@/lib/supabase";
import { ArrowLeft } from "lucide-react";
import PlatformBrandMark from "@/components/shared/PlatformBrandMark";

export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeInternalReturnTo(searchParams.get("returnTo"), "/client");
  const companySlug =
    searchParams.get("company") ??
    (() => {
      try {
        const m = returnTo.match(/company=([^&]+)/);
        return m ? decodeURIComponent(m[1]) : null;
      } catch {
        return null;
      }
    })();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    resetAppTheme();
  }, []);

  const handleSubmit = async (values: SignUpFormValues) => {
    setError(null);
    setIsLoading(true);

    if (!companySlug) {
      setError(
        "Para criar conta, acesse pelo link da empresa onde deseja agendar (ex: /site/sua-empresa)."
      );
      setIsLoading(false);
      return;
    }

    const result = await createClientAccount({
      name: values.fullName,
      email: values.email,
      password: values.password,
      phone: values.phone?.trim() || undefined,
      company_slug: companySlug,
    });

    if (!result.success) {
      setError(result.error ?? "Erro ao criar conta. Tente novamente.");
      setIsLoading(false);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setIsLoading(false);

    if (signInErr) {
      setError("Conta criada, mas falha no login. Tente entrar manualmente.");
      return;
    }

    navigate(returnTo, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      <Link
        to="/"
        className="absolute top-4 left-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={18} />
        Voltar para seleção
      </Link>
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center">
          <PlatformBrandMark size="sm" showTagline={false} className="mb-4" />
          <h1 className="text-2xl font-bold">Criar conta</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cadastre-se para fazer agendamentos
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          {error && (
            <p className="text-destructive text-sm mb-4">{error}</p>
          )}
          <SignUpForm onSubmit={handleSubmit} isLoading={isLoading} />
          <p className="text-center text-sm text-muted-foreground mt-4">
            Já tem conta?{" "}
            <Link
              to={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
              className="text-primary hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
