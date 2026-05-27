import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import PageContainer from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { companyService } from "@/services/company.service";
import {
  companyMemberService,
  getCompanyMemberRpcErrorMessage,
} from "@/services/company-member.service";
import type { CompanyMemberWithProfile } from "@/types/database.types";
import { APP_PAGE_KEYS, APP_PAGE_LABELS } from "@/hooks/useCompanyPageAccess";

function initials(name: string | null | undefined) {
  const value = (name ?? "").trim();
  if (!value) return "US";
  return value
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const AdminCompanyTeam = () => {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openAdd, setOpenAdd] = useState(false);
  const [editingMember, setEditingMember] = useState<CompanyMemberWithProfile | null>(null);
  const [toRemove, setToRemove] = useState<CompanyMemberWithProfile | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    allowed_pages: [...APP_PAGE_KEYS] as string[],
  });

  const ACCESS_OPTIONS = APP_PAGE_KEYS.map((key) => ({
    key,
    label: APP_PAGE_LABELS[key],
  }));

  const { data: companyRes } = useQuery({
    queryKey: ["company-by-id", companyId],
    queryFn: () => companyService.getById(companyId),
    enabled: !!companyId,
  });

  const { data: membersRes, isLoading } = useQuery({
    queryKey: ["company-members", companyId],
    queryFn: () => companyMemberService.listByCompany(companyId),
    enabled: !!companyId,
  });

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await companyMemberService.addToCompany({
        company_id: companyId,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        allowed_pages: form.allowed_pages,
      });
      if (error) throw new Error(getCompanyMemberRpcErrorMessage(error));
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company-members", companyId] });
      setOpenAdd(false);
      setForm({
        full_name: "",
        email: "",
        phone: "",
        password: "",
        allowed_pages: [...APP_PAGE_KEYS],
      });
      toast.success("Usuário vinculado com sucesso.");
    },
    onError: (error) => {
      toast.error(getCompanyMemberRpcErrorMessage(error));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => companyMemberService.removeFromCompany(companyId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company-members", companyId] });
      setToRemove(null);
      toast.success("Usuário removido da empresa.");
    },
    onError: () => {
      toast.error("Não foi possível remover o vínculo do usuário.");
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await companyMemberService.updateProfileAndAccess({
        company_id: companyId,
        user_id: editingMember!.user_id,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        allowed_pages: form.allowed_pages,
        password: form.password.trim() || undefined,
      });
      if (error) throw new Error(getCompanyMemberRpcErrorMessage(error));
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company-members", companyId] });
      setEditingMember(null);
      setForm({
        full_name: "",
        email: "",
        phone: "",
        password: "",
        allowed_pages: [...APP_PAGE_KEYS],
      });
      toast.success("Perfil e acessos atualizados.");
    },
    onError: (error) => {
      toast.error(getCompanyMemberRpcErrorMessage(error));
    },
  });

  const members = membersRes?.data ?? [];
  const company = companyRes?.data;

  const toggleAccess = (accessKey: string) => {
    setForm((prev) => {
      const exists = prev.allowed_pages.includes(accessKey);
      const next = exists
        ? prev.allowed_pages.filter((item) => item !== accessKey)
        : [...prev.allowed_pages, accessKey];
      return { ...prev, allowed_pages: next };
    });
  };

  return (
    <PageContainer
      title={`Equipe${company?.name ? ` · ${company.name}` : ""}`}
      description="Usuários vinculados à empresa atual"
      actions={
        <>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate("/owner/dashboard")}>
            <ArrowLeft size={16} className="mr-2" />
            Voltar
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setOpenAdd(true)}>
            <Plus size={16} className="mr-2" />
            Adicionar usuário
          </Button>
        </>
      }
    >
      <div className="bg-card border border-border rounded-xl p-4">
        {isLoading ? (
          <p className="text-muted-foreground py-6 text-center">Carregando equipe...</p>
        ) : members.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Users size={20} className="mx-auto mb-3" />
            Esta empresa ainda não possui usuários vinculados.
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={`${member.company_id}-${member.user_id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10">
                    {member.avatar_url ? <AvatarImage src={member.avatar_url} alt="" /> : null}
                    <AvatarFallback>{initials(member.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{member.full_name ?? "Usuário"}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {[member.email, member.phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vínculo em{" "}
                      {member.linked_at
                        ? new Date(member.linked_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setEditingMember(member);
                      setForm({
                        full_name: member.full_name ?? "",
                        email: member.email ?? "",
                        phone: member.phone ?? "",
                        password: "",
                        allowed_pages: member.allowed_pages ?? [...APP_PAGE_KEYS],
                      });
                    }}
                  >
                    <Pencil size={14} className="mr-1" />
                    Editar perfil
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-destructive"
                    onClick={() => setToRemove(member)}
                  >
                    <Trash2 size={14} className="mr-1" />
                    Remover da empresa
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Ex: João da Silva"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="joao@email.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Acessos da dashboard</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3">
                {ACCESS_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.allowed_pages.includes(opt.key)}
                      onCheckedChange={() => toggleAccess(opt.key)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addMemberMutation.mutate()}
              disabled={
                addMemberMutation.isPending ||
                !form.full_name.trim() ||
                !form.email.trim() ||
                form.password.trim().length < 6 ||
                form.allowed_pages.length === 0
              }
            >
              {addMemberMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil do usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_full_name">Nome completo</Label>
              <Input
                id="edit_full_name"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit_email">Email</Label>
              <Input id="edit_email" value={form.email} readOnly className="bg-muted" />
            </div>
            <div>
              <Label htmlFor="edit_phone">Telefone</Label>
              <Input
                id="edit_phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit_password">Nova senha (opcional)</Label>
              <Input
                id="edit_password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Deixe vazio para manter a senha atual"
              />
            </div>
            <div className="space-y-2">
              <Label>Acessos da dashboard</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3">
                {ACCESS_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.allowed_pages.includes(opt.key)}
                      onCheckedChange={() => toggleAccess(opt.key)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => updateMemberMutation.mutate()}
              disabled={
                updateMemberMutation.isPending ||
                !form.full_name.trim() ||
                form.allowed_pages.length === 0 ||
                (form.password.trim().length > 0 && form.password.trim().length < 6)
              }
            >
              {updateMemberMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toRemove} onOpenChange={(open) => !open && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário da empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esse processo remove apenas o vínculo com a empresa atual. O usuário e perfil não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => toRemove && removeMemberMutation.mutate(toRemove.user_id)}
            >
              Remover vínculo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
};

export default AdminCompanyTeam;
