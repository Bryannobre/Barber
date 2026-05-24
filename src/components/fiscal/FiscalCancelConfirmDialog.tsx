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
import { Loader2 } from "lucide-react";

interface FiscalCancelConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber?: string | null;
  onConfirm: () => void;
  isPending?: boolean;
}

export function FiscalCancelConfirmDialog({
  open,
  onOpenChange,
  invoiceNumber,
  onConfirm,
  isPending,
}: FiscalCancelConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar nota internamente?</AlertDialogTitle>
          <AlertDialogDescription>
            A nota {invoiceNumber ? `nº ${invoiceNumber}` : ""} será marcada como cancelada no
            sistema. Isso não cancela a NFS-e na prefeitura (Fase 3).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar cancelamento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
