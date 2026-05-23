export type PaymentMethod =
  | "pix"
  | "cash"
  | "credit_card"
  | "debit_card"
  | "transfer"
  | "other";

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "pix";

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

const LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  transfer: "Transferência",
  other: "Outro",
};

export function getPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return LABELS[method as PaymentMethod] ?? method;
}

/** Rótulos para o gráfico do dashboard (cartões agrupados). */
export function getPaymentChartLabel(method: string | null | undefined): string {
  if (method === "pix") return "PIX";
  if (method === "cash") return "Dinheiro";
  if (method === "credit_card" || method === "debit_card") return "Cartão";
  if (method === "transfer") return "Transferência";
  return "Outros";
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHOD_OPTIONS.some((o) => o.value === value);
}
