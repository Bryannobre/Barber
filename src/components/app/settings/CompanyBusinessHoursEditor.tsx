import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyBusinessHourDraft } from "@/lib/businessHours";
import { WEEKDAY_LABELS } from "@/lib/businessHours";

interface CompanyBusinessHoursEditorProps {
  drafts: CompanyBusinessHourDraft[];
  slotInterval: string;
  onDraftsChange: (drafts: CompanyBusinessHourDraft[]) => void;
  onSlotIntervalChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  disabled?: boolean;
}

export function CompanyBusinessHoursEditor({
  drafts,
  slotInterval,
  onDraftsChange,
  onSlotIntervalChange,
  onSave,
  isSaving,
  disabled,
}: CompanyBusinessHoursEditorProps) {
  const updateDay = (day: number, patch: Partial<CompanyBusinessHourDraft>) => {
    onDraftsChange(
      drafts.map((d) => (d.day_of_week === day ? { ...d, ...patch } : d))
    );
  };

  const applyWeekdayTemplate = () => {
    onDraftsChange(
      drafts.map((d) => {
        if (d.day_of_week === 0) return { ...d, is_closed: true };
        if (d.day_of_week === 6) {
          return { ...d, is_closed: false, opens_at: "09:00", closes_at: "14:00" };
        }
        return { ...d, is_closed: false, opens_at: "09:00", closes_at: "19:00" };
      })
    );
  };

  const copyMondayToWeekdays = () => {
    const mon = drafts.find((d) => d.day_of_week === 1);
    if (!mon || mon.is_closed) return;
    onDraftsChange(
      drafts.map((d) => {
        if (d.day_of_week >= 1 && d.day_of_week <= 5) {
          return { ...d, is_closed: false, opens_at: mon.opens_at, closes_at: mon.closes_at };
        }
        return d;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={applyWeekdayTemplate} disabled={disabled}>
          Padrão salão (seg–sex 9–19, sáb 9–14, dom fechado)
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copyMondayToWeekdays} disabled={disabled}>
          Copiar segunda para ter–sex
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="hidden sm:grid sm:grid-cols-[1fr_auto_100px_100px] gap-3 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
          <span>Dia</span>
          <span className="text-center">Aberto</span>
          <span>Abre</span>
          <span>Fecha</span>
        </div>
        <div className="divide-y divide-border">
          {drafts.map((d) => (
            <div
              key={d.day_of_week}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_100px_100px] gap-3 px-4 py-3 items-center"
            >
              <span className="text-sm font-medium">{WEEKDAY_LABELS[d.day_of_week]}</span>
              <div className="flex items-center gap-2 sm:justify-center">
                <Switch
                  checked={!d.is_closed}
                  onCheckedChange={(open) => updateDay(d.day_of_week, { is_closed: !open })}
                  disabled={disabled}
                  aria-label={`${WEEKDAY_LABELS[d.day_of_week]} aberto`}
                />
                <span className="text-xs text-muted-foreground sm:hidden">
                  {d.is_closed ? "Fechado" : "Aberto"}
                </span>
              </div>
              <Input
                type="time"
                step={Number(slotInterval) * 60}
                value={d.opens_at}
                onChange={(e) => updateDay(d.day_of_week, { opens_at: e.target.value })}
                disabled={disabled || d.is_closed}
                className="h-9"
                aria-label={`Abertura ${WEEKDAY_LABELS[d.day_of_week]}`}
              />
              <Input
                type="time"
                step={Number(slotInterval) * 60}
                value={d.closes_at}
                onChange={(e) => updateDay(d.day_of_week, { closes_at: e.target.value })}
                disabled={disabled || d.is_closed}
                className="h-9"
                aria-label={`Fechamento ${WEEKDAY_LABELS[d.day_of_week]}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Intervalo entre horários de agendamento</Label>
        <Select value={slotInterval} onValueChange={onSlotIntervalChange} disabled={disabled}>
          <SelectTrigger className="mt-1 max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5 minutos</SelectItem>
            <SelectItem value="10">10 minutos</SelectItem>
            <SelectItem value="15">15 minutos (recomendado)</SelectItem>
            <SelectItem value="30">30 minutos</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Define os horários que o cliente pode escolher na landing e no app. Dias fechados não
          exibem vagas, mesmo que o profissional tenha jornada cadastrada.
        </p>
      </div>

      <Button onClick={onSave} disabled={disabled || isSaving}>
        {isSaving ? "Salvando..." : "Salvar horários da empresa"}
      </Button>
    </div>
  );
}
