import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PageContainer from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenant } from "@/contexts/TenantContext";
import { fiscalService } from "@/services/fiscal.service";
import { FiscalProviderFactory } from "@/services/providers/fiscal";

const schema = z.object({
  legal_name: z.string().max(200).optional(),
  document: z.string().max(20).optional(),
  municipal_registration: z.string().max(50).optional(),
  tax_regime: z.string().max(80).optional(),
  provider: z.string().max(80).optional(),
  auto_issue_invoice: z.boolean(),
  default_service_code: z.string().max(30).optional(),
  default_service_description: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

const TAX_REGIME_OPTIONS = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
];

const PROVIDER_OPTIONS = FiscalProviderFactory.listAvailable();

export default function AppFiscalSettings() {
  const { currentCompany } = useTenant();
  const companyId = currentCompany?.id ?? "";
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["fiscal-settings", companyId],
    queryFn: () => fiscalService.getFiscalSettings(companyId),
    enabled: !!companyId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      legal_name: "",
      document: "",
      municipal_registration: "",
      tax_regime: "",
      provider: "mock",
      auto_issue_invoice: false,
      default_service_code: "",
      default_service_description: "",
    },
  });

  useEffect(() => {
    if (!settings) return;
    form.reset({
      legal_name: settings.legal_name ?? "",
      document: settings.document ?? "",
      municipal_registration: settings.municipal_registration ?? "",
      tax_regime: settings.tax_regime ?? "",
      provider: settings.provider ?? "mock",
      auto_issue_invoice: settings.auto_issue_invoice,
      default_service_code: settings.default_service_code ?? "",
      default_service_description: settings.default_service_description ?? "",
    });
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      fiscalService.updateFiscalSettings(companyId, values),
    onSuccess: () => {
      toast.success("Configurações fiscais salvas.");
      queryClient.invalidateQueries({ queryKey: ["fiscal-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-64 w-full max-w-lg" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link to="/app/fiscal">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao fiscal
        </Link>
      </Button>

      <p className="text-sm text-muted-foreground mb-6 max-w-xl">
        Cadastro fiscal da empresa. Certificados e chaves de API ficam no servidor (Fase 2).
      </p>

      <form
        className="max-w-lg space-y-4"
        onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
      >
        <div className="space-y-2">
          <Label htmlFor="legal_name">Razão social</Label>
          <Input id="legal_name" {...form.register("legal_name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="document">CNPJ</Label>
          <Input id="document" placeholder="00.000.000/0000-00" {...form.register("document")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="municipal_registration">Inscrição municipal</Label>
          <Input id="municipal_registration" {...form.register("municipal_registration")} />
        </div>
        <div className="space-y-2">
          <Label>Regime tributário</Label>
          <Select
            value={form.watch("tax_regime") || ""}
            onValueChange={(v) => form.setValue("tax_regime", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TAX_REGIME_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Provedor</Label>
          <Select
            value={form.watch("provider") || "mock"}
            onValueChange={(v) => form.setValue("provider", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={!o.implemented}>
                  {o.label}
                  {!o.implemented ? " (em breve)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="default_service_description">Descrição padrão do serviço</Label>
          <Input
            id="default_service_description"
            {...form.register("default_service_description")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="default_service_code">Código de serviço padrão</Label>
          <Input id="default_service_code" {...form.register("default_service_code")} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="auto_issue">Emissão automática</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Reservado para Fase 2 — não ativo no MVP.
            </p>
          </div>
          <Switch
            id="auto_issue"
            checked={form.watch("auto_issue_invoice")}
            onCheckedChange={(c) => form.setValue("auto_issue_invoice", c)}
            disabled
          />
        </div>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar configurações
        </Button>
      </form>
    </PageContainer>
  );
}
