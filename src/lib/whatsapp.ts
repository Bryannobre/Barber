/**
 * Normaliza telefone brasileiro para links wa.me (apenas dígitos, com DDI 55).
 */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;

  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length >= 12) {
    return digits;
  }

  return null;
}

export function getWhatsAppUrl(
  phone: string | null | undefined,
  message?: string
): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;

  const base = `https://wa.me/${normalized}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}

export function canOpenWhatsApp(phone: string | null | undefined): boolean {
  return getWhatsAppUrl(phone) !== null;
}
