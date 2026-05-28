import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageContainer from "@/components/shared/PageContainer";
import { WhatsAppPhoneLink } from "@/components/ui/WhatsAppPhoneLink";
import { useTenant } from "@/contexts/TenantContext";
import { clientService } from "@/services/client.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, MoreHorizontal, Pencil, Trash2, History, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { CompanyClientWithVisitCount } from "@/services/client.service";
import { ClientFormModal } from "@/components/app/ClientFormModal";
import { ClientHistorySheet } from "@/components/app/ClientHistorySheet";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const AppClients = () => {
  const queryClient = useQueryClient();
  const { currentCompany } = useTenant();
  const companyId = currentCompany?.id ?? "";
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CompanyClientWithVisitCount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: clientsData, error: listError, isLoading: listLoading } = useQuery({
    queryKey: ["clients", companyId],
    queryFn: () => clientService.listByCompany(companyId),
    enabled: !!companyId,
  });

  const allClients = clientsData?.data ?? [];
  const searchLower = search.trim().toLowerCase();
  const clients = searchLower
    ? allClients.filter(
        (c) =>
          (c.full_name ?? "").toLowerCase().includes(searchLower) ||
          (c.email ?? "").toLowerCase().includes(searchLower)
      )
    : allClients;
  const hasListError = !!listError || !!clientsData?.error;

  const createMutation = useMutation({
    mutationFn: (v: { full_name: string; phone: string; email: string; cpf: string; notes: string }) =>
      clientService.create(companyId, v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setModalOpen(false);
      toast.success("Cliente adicionado!");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao adicionar cliente.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: { full_name: string; phone: string; email: string; cpf: string; notes: string };
    }) => clientService.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setEditingClient(null);
      toast.success("Cliente atualizado!");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao atualizar.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeletingId(null);
      toast.success("Cliente removido.");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao remover.");
    },
  });

  return (
    <>
      <PageContainer
        actions={
          <Button onClick={() => setModalOpen(true)} disabled={!companyId}>
            <Plus size={16} className="mr-2" />
            Adicionar cliente
          </Button>
        }
      >
        {!companyId && (
          <p className="text-sm text-muted-foreground mb-4">
            Selecione uma empresa para ver os clientes.
          </p>
        )}
        {hasListError && (
          <p className="text-sm text-destructive mb-4">
            Erro ao carregar clientes: {(listError as Error)?.message ?? clientsData?.error?.message}
          </p>
        )}
        {companyId && (
          <div className="relative mb-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 max-w-sm"
            />
          </div>
        )}
        {/* Tabela (desktop) */}
        <div className="hidden lg:block bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Visitas</TableHead>
                <TableHead>Último atendimento</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Carregando clientes...
                  </TableCell>
                </TableRow>
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    {companyId
                      ? search
                        ? "Nenhum cliente encontrado para essa busca."
                        : "Nenhum cliente cadastrado. Clique em \"Adicionar cliente\" para começar."
                      : "Selecione uma empresa acima para ver os clientes."}
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((c) => (
                  <TableRow
                    key={c.id}
                    className="hover:bg-secondary/50 cursor-pointer"
                    onClick={() => setHistoryClientId(c.id)}
                  >
                    <TableCell className="font-medium">{c.full_name}</TableCell>
                    <TableCell className="text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                      <WhatsAppPhoneLink phone={c.phone} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell>{c.visit_count}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.last_visit
                        ? format(parseISO(c.last_visit), "d MMM yyyy", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.cpf ?? "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setHistoryClientId(c.id)}>
                            <History size={14} className="mr-2" />
                            Ver histórico
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingClient(c)}>
                            <Pencil size={14} className="mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeletingId(c.id)}
                          >
                            <Trash2 size={14} className="mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {/* Cards (mobile/tablet) */}
        <div className="lg:hidden space-y-4">
          {listLoading ? (
            <div className="text-center text-muted-foreground py-12">
              Carregando clientes...
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {companyId
                ? search
                  ? "Nenhum cliente encontrado para essa busca."
                  : "Nenhum cliente cadastrado. Clique em \"Adicionar cliente\" para começar."
                : "Selecione uma empresa acima para ver os clientes."}
            </div>
          ) : (
            clients.map((c) => (
              <Card
                key={c.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setHistoryClientId(c.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{c.full_name}</p>
                      {c.email && (
                        <p className="text-sm text-muted-foreground truncate">{c.email}</p>
                      )}
                      {c.phone && (
                        <p className="text-sm" onClick={(e) => e.stopPropagation()}>
                          <WhatsAppPhoneLink phone={c.phone} />
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span>Visitas: {c.visit_count}</span>
                        <span>
                          Último: {c.last_visit
                            ? format(parseISO(c.last_visit), "d MMM yyyy", { locale: ptBR })
                            : "—"}
                        </span>
                        {c.cpf && <span>CPF: {c.cpf}</span>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setHistoryClientId(c.id)}>
                          <History size={14} className="mr-2" />
                          Ver histórico
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingClient(c)}>
                          <Pencil size={14} className="mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingId(c.id)}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </PageContainer>

      <ClientFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode="create"
        onSubmit={(v) => createMutation.mutateAsync(v)}
        isLoading={createMutation.isPending}
      />

      <ClientFormModal
        open={!!editingClient}
        onOpenChange={(o) => !o && setEditingClient(null)}
        mode="edit"
        client={editingClient}
        onSubmit={(v) =>
          editingClient && updateMutation.mutateAsync({ id: editingClient.id, values: v })
        }
        isLoading={updateMutation.isPending}
      />

      <ClientHistorySheet
        open={!!historyClientId}
        onOpenChange={(o) => !o && setHistoryClientId(null)}
        companyId={companyId}
        companyClientId={historyClientId}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente será removido do cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AppClients;
