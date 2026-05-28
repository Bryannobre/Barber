import type { MouseEvent } from "react";
import { MessageCircle } from "lucide-react";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export interface WhatsAppPhoneLinkProps {
  phone: string | null | undefined;
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  /** Texto pré-preenchido na conversa do WhatsApp */
  message?: string;
  showIcon?: boolean;
  /** Quando não houver telefone válido */
  fallback?: React.ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export function WhatsAppPhoneLink({
  phone,
  children,
  className,
  iconClassName,
  message,
  showIcon = true,
  fallback = "—",
  onClick,
}: WhatsAppPhoneLinkProps) {
  const url = getWhatsAppUrl(phone, message);
  const label = children ?? phone;

  if (!phone?.trim() || !url) {
    if (label) {
      return <span className={className}>{label}</span>;
    }
    return <>{fallback}</>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir no WhatsApp"
      aria-label={`Abrir WhatsApp: ${phone}`}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium text-[#25D366] hover:underline underline-offset-2",
        className
      )}
      onClick={onClick}
    >
      {showIcon && (
        <MessageCircle
          className={cn("size-4 shrink-0", iconClassName)}
          aria-hidden
        />
      )}
      <span>{label}</span>
    </a>
  );
}
