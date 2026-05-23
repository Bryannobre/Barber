import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageContainer from "@/components/shared/PageContainer";
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

const DEFAULT_OPENING_TIME = "09:00";
const DEFAULT_CLOSING_TIME = "19:00";
const DEFAULT_PRIMARY_COLOR = "#6fcf97";

function isMinuteStep(time: string, stepMinutes: number) {
  const minutes = Number(time.split(":")[1] ?? "0");
  return minutes % stepMinutes === 0;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const AppSettings = () => {
  const queryClient = useQueryClient();
  const { currentCompany, setCurrentCompany } = useTenant();
  const [openingTime, setOpeningTime] = useState(DEFAULT_OPENING_TIME);
  const [closingTime, setClosingTime] = useState(DEFAULT_CLOSING_TIME);
  const [customizationEnabled, setCustomizationEnabled] = useState(false);
  const [dashboardTheme, setDashboardTheme] = useState<"dark" | "light">("dark");
  const [dashboardPrimaryColor, setDashboardPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [slotInterval, setSlotInterval] = useState(
    String(DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES)
  );

  useEffect(() => {
    setOpeningTime((currentCompany?.opening_time ?? DEFAULT_OPENING_TIME).slice(0, 5));
    setClosingTime((currentCompany?.closing_time ?? DEFAULT_CLOSING_TIME).slice(0, 5));
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

  const saveBusinessHoursMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany) return;

      const interval = Number(slotInterval);
      if (![5, 10, 15, 30].includes(interval)) {
        throw new Error("Intervalo de agendamento inválido.");
      }

      if (!isMinuteStep(openingTime, interval) || !isMinuteStep(closingTime, interval)) {
        throw new Error(
          `Abertura e fechamento devem usar múltiplos de ${interval} minutos (ex.: 09:00, 09:15).`
        );
      }

      if (toMinutes(closingTime) <= toMinutes(openingTime)) {
        throw new Error("O horário de fechamento deve ser maior que o de abertura.");
      }

      const { data, error } = await companyService.update(currentCompany.id, {
        opening_time: openingTime,
        closing_time: closingTime,
        booking_slot_interval_minutes: interval,
      });
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
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(
        `Configuração salva. Agendamentos usarão intervalos de ${slotInterval} minutos.`
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
              <p className="font-medium">{currentCompany?.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium">{currentCompany?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Telefone do Responsável</p>
              <p className="font-medium">{currentCompany?.owner_phone ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold">Horário de Funcionamento</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Abertura</Label>
              <Input
                type="time"
                step={Number(slotInterval) * 60}
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Fechamento</Label>
              <Input
                type="time"
                step={Number(slotInterval) * 60}
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Intervalo entre horários de agendamento</Label>
            <Select value={slotInterval} onValueChange={setSlotInterval}>
              <SelectTrigger className="mt-1 max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutos (ex.: 09:00, 09:05…)</SelectItem>
                <SelectItem value="10">10 minutos</SelectItem>
                <SelectItem value="15">15 minutos (recomendado)</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Define os horários que o cliente pode escolher na landing e no app.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Abertura e fechamento limitam a janela do dia; o intervalo define o passo entre cada
            horário oferecido.
          </p>
          <Button
            onClick={() => saveBusinessHoursMutation.mutate()}
            disabled={!currentCompany || saveBusinessHoursMutation.isPending}
          >
            {saveBusinessHoursMutation.isPending ? "Salvando..." : "Salvar horários e intervalo"}
          </Button>
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
