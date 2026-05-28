import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageContainer from "@/components/shared/PageContainer";
import { WhatsAppPhoneLink } from "@/components/ui/WhatsAppPhoneLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTenant } from "@/contexts/TenantContext";
import { companyService } from "@/services/company.service";
import { applyCompanyTheme } from "@/lib/companyTheme";
import { Link } from "react-router-dom";
import { ExternalLink, Copy, Globe, Layout } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES } from "@/lib/bookingDuration";
import { CompanyBusinessHoursEditor } from "@/components/app/settings/CompanyBusinessHoursEditor";
import { companyBusinessHoursService } from "@/services/companyBusinessHours.service";
import {
  createDefaultBusinessWeek,
  rowsToDraftMap,
  validateBusinessWeekDraft,
  type CompanyBusinessHourDraft,
} from "@/lib/businessHours";

const DEFAULT_PRIMARY_COLOR = "#6fcf97";

const AppSettings = () => {
  const queryClient = useQueryClient();
  const { currentCompany, setCurrentCompany } = useTenant();
  const [weekDrafts, setWeekDrafts] = useState<CompanyBusinessHourDraft[]>([]);
  const [customizationEnabled, setCustomizationEnabled] = useState(false);
  const [dashboardTheme, setDashboardTheme] = useState<"dark" | "light">("dark");
  const [dashboardPrimaryColor, setDashboardPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [slotInterval, setSlotInterval] = useState(
    String(DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES)
  );

  const { data: businessHoursRows, isLoading: hoursLoading } = useQuery({
    queryKey: ["company-business-hours", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await companyBusinessHoursService.listByCompany(
        currentCompany.id
      );
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  useEffect(() => {
    setSlotInterval(
      String(
        currentCompany?.booking_slot_interval_minutes ??
          DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES
      )
    );
    setCustomizationEnabled(currentCompany?.customization_enabled ?? false);
    setDashboardTheme(currentCompany?.dashboard_theme ?? "dark");
    setDashboardPrimaryColor(currentCompany?.dashboard_primary_color ?? DEFAULT_PRIMARY_COLOR);
  }, [currentCompany]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    if (businessHoursRows && businessHoursRows.length > 0) {
      setWeekDrafts(rowsToDraftMap(businessHoursRows));
    } else if (!hoursLoading) {
      setWeekDrafts(
        rowsToDraftMap(createDefaultBusinessWeek(currentCompany.id)).map((d) => ({
          ...d,
        }))
      );
    }
  }, [businessHoursRows, currentCompany?.id, hoursLoading]);

  const saveBusinessHoursMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) return;

      const interval = Number(slotInterval);
      if (![5, 10, 15, 30].includes(interval)) {
        throw new Error("Intervalo de agendamento inválido.");
      }

      const validationError = validateBusinessWeekDraft(weekDrafts, interval);
      if (validationError) throw new Error(validationError);

      const { data, error } = await companyBusinessHoursService.saveWeek(
        currentCompany.id,
        weekDrafts,
        interval
      );
      if (error) throw error;
      if (data) {
        setCurrentCompany(data);
      } else {
        const refreshed = await companyService.getById(currentCompany.id);
        if (refreshed.data) setCurrentCompany(refreshed.data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      queryClient.invalidateQueries({ queryKey: ["company-booking-settings"] });
      queryClient.invalidateQueries({ queryKey: ["company-business-hours"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(
        `Horários da empresa salvos. Intervalo de agendamento: ${slotInterval} minutos.`
      );
    },
    onError: (error) => {
      const fallback = "Não foi possível salvar o horário de funcionamento.";
      const message = error instanceof Error ? error.message : fallback;
      toast.error(message);
    },
  });

  const saveCustomizationMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) return;
      const { data, error } = await companyService.update(currentCompany.id, {
        customization_enabled: customizationEnabled,
        dashboard_theme: dashboardTheme,
        dashboard_primary_color: dashboardPrimaryColor,
      });
      if (error) throw error;
      if (data) {
        setCurrentCompany(data);
        applyCompanyTheme(data);
      }
    },
    onSuccess: () => {
      toast.success("Customização da dashboard atualizada.");
    },
    onError: (error) => {
      const fallback = "Não foi possível salvar a customização.";
      const message = error instanceof Error ? error.message : fallback;
      toast.error(message);
    },
  });

  const landingUrl =
    typeof window !== "undefined" && currentCompany?.slug
      ? `${window.location.origin}/site/${currentCompany.slug}`
      : null;

  const copyLandingUrl = async () => {
    if (!landingUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(landingUrl);
      } else {
        const ta = document.createElement("textarea");
        ta.value = landingUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Link copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const openLanding = () => {
    if (landingUrl) window.open(landingUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <PageContainer>
      <div className="w-full space-y-8">
        {landingUrl && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="text-primary" size={20} />
              <h3 className="font-semibold">Landing Page</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua página pública onde clientes podem ver serviços, profissionais e agendar horários.
            </p>
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <Input
                  readOnly
                  value={landingUrl}
                  className="font-mono text-sm bg-muted/50 w-full min-w-0"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="icon" onClick={copyLandingUrl} title="Copiar link">
                  <Copy size={18} />
                </Button>
                <Button onClick={openLanding} className="gap-2 shrink-0">
                  <ExternalLink size={18} />
                  Abrir landing page
                </Button>
                <Link to="/app/settings/landing" className="shrink-0">
                  <Button variant="secondary" className="gap-2 w-full sm:w-auto">
                    <Layout size={18} />
                    Personalizar landing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold">Dados da Empresa</h3>
          <p className="text-sm text-muted-foreground">
            Estes dados são gerenciados apenas pelo Super Admin.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Nome da Empresa</p>
              <p className="font-medium">{currentCompany?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CNPJ</p>
              <p className="font-medium">{currentCompany?.cnpj ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Responsável</p>
              <p className="font-medium">{currentCompany?.owner_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="font-medium">
                <WhatsAppPhoneLink phone={currentCompany?.phone} />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium">{currentCompany?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Telefone do Responsável</p>
              <p className="font-medium">
                <WhatsAppPhoneLink phone={currentCompany?.owner_phone} />
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-semibold">Horário de funcionamento</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Por dia da semana. A jornada de cada profissional deve ficar dentro desses horários.
            </p>
          </div>
          {hoursLoading && weekDrafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Carregando horários…</p>
          ) : (
            <CompanyBusinessHoursEditor
              drafts={weekDrafts}
              slotInterval={slotInterval}
              onDraftsChange={setWeekDrafts}
              onSlotIntervalChange={setSlotInterval}
              onSave={() => saveBusinessHoursMutation.mutate()}
              isSaving={saveBusinessHoursMutation.isPending}
              disabled={!currentCompany}
            />
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Ativar Customização</h3>
              <p className="text-sm text-muted-foreground">
                Permite personalizar a cor principal e o tema da dashboard da empresa
              </p>
            </div>
            <Switch
              checked={customizationEnabled}
              onCheckedChange={(checked) => setCustomizationEnabled(Boolean(checked))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Cor principal</Label>
              <Input
                type="color"
                value={dashboardPrimaryColor}
                disabled={!customizationEnabled}
                onChange={(e) => setDashboardPrimaryColor(e.target.value)}
                className="mt-1 h-11 p-1"
              />
            </div>
            <div>
              <Label>Tema da dashboard</Label>
              <div className="mt-1 flex gap-2">
                <Button
                  type="button"
                  variant={dashboardTheme === "light" ? "default" : "outline"}
                  disabled={!customizationEnabled}
                  onClick={() => setDashboardTheme("light")}
                >
                  Light
                </Button>
                <Button
                  type="button"
                  variant={dashboardTheme === "dark" ? "default" : "outline"}
                  disabled={!customizationEnabled}
                  onClick={() => setDashboardTheme("dark")}
                >
                  Dark
                </Button>
              </div>
            </div>
          </div>

          <Button
            onClick={() => saveCustomizationMutation.mutate()}
            disabled={!currentCompany || saveCustomizationMutation.isPending}
          >
            {saveCustomizationMutation.isPending ? "Salvando..." : "Salvar customização"}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
};

export default AppSettings;
