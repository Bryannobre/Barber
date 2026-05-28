export type UserRole = 'owner' | 'company_admin' | 'employee' | 'client';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'blocked' | 'no_show';
export type LandingTextAlign = "left" | "center" | "right";
export type LandingHeadingSize = "md" | "lg" | "xl";
export type LandingBodySize = "sm" | "md" | "lg";
export type LandingFontWeight = "normal" | "medium" | "semibold" | "bold";
export type LandingLetterSpacing = "normal" | "wide" | "wider";
export type LandingTextTransform = "none" | "uppercase" | "capitalize";

/** Onde aplicar cor de destaque no título da seção Sobre */
export type AboutTitleAccent = "first_word" | "last_word" | "all" | "none";

export interface CompanyLandingSettings {
  id: string;
  company_id: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  about_text: string | null;
  about_image_url: string | null;
  /** Título customizado da seção Sobre */
  about_title: string | null;
  /** Onde aplicar cor em destaque: first_word | last_word | all | none */
  about_title_accent: AboutTitleAccent | null;
  about_image_1_url: string | null;
  about_image_2_url: string | null;
  about_image_3_url: string | null;
  about_image_4_url: string | null;
  gallery_image_1_url: string | null;
  gallery_image_2_url: string | null;
  gallery_image_3_url: string | null;
  gallery_image_4_url: string | null;
  gallery_image_5_url: string | null;
  gallery_image_6_url: string | null;
  gallery_image_7_url: string | null;
  gallery_image_8_url: string | null;
  cta_text: string | null;
  cta_button_text: string | null;
  hero_text_align: LandingTextAlign | null;
  hero_title_size: LandingHeadingSize | null;
  hero_title_weight: LandingFontWeight | null;
  hero_title_letter_spacing: LandingLetterSpacing | null;
  hero_title_transform: LandingTextTransform | null;
  hero_subtitle_size: LandingBodySize | null;
  about_text_align: LandingTextAlign | null;
  about_title_size: LandingHeadingSize | null;
  about_body_size: LandingBodySize | null;
  cta_text_align: LandingTextAlign | null;
  cta_title_size: LandingHeadingSize | null;
  cta_body_size: LandingBodySize | null;
  cta_button_text_size: LandingBodySize | null;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyBusinessHour {
  id: string;
  company_id: string;
  day_of_week: number;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  logo: string | null;
  logo_url: string | null;
  cnpj: string | null;
  email: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_photo_url: string | null;
  slogan: string | null;
  phone: string | null;
  opening_time: string | null;
  closing_time: string | null;
  /** Intervalo entre slots de agendamento (5, 10, 15 ou 30 minutos) */
  booking_slot_interval_minutes?: number;
  customization_enabled: boolean;
  dashboard_theme: "dark" | "light" | null;
  dashboard_primary_color: string | null;
  revenue_goal_amount: number | null;
  revenue_goal_period: "daily" | "weekly" | "monthly" | "custom" | null;
  revenue_goal_custom_start_date: string | null;
  revenue_goal_custom_end_date: string | null;
  status: 'active' | 'blocked';
  /** Data em que o plano foi iniciado (admin) */
  active_from: string | null;
  /** Quantidade de dias que a empresa ficará ativa (admin) */
  active_days: number | null;
  /** Observações do admin */
  admin_obs: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  /** CPF opcional - cliente pode preencher no perfil */
  cpf: string | null;
  role: UserRole;
  company_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  company_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category: string | null;
  execution_mode?: "sequential" | "parallel";
  created_at: string;
  updated_at: string;
}

export interface Professional {
  id: string;
  company_id: string;
  profile_id: string | null;
  name: string;
  photo_url: string | null;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalService {
  professional_id: string;
  service_id: string;
}

export type CompanyMemberRole = 'owner' | 'admin' | 'staff';

export interface CompanyMember {
  id: string;
  user_id: string;
  company_id: string;
  role: CompanyMemberRole;
  created_at: string;
}

export interface CompanyMemberWithProfile {
  user_id: string;
  company_id: string;
  role: CompanyMemberRole;
  linked_at: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  allowed_pages: string[] | null;
}

export interface WorkingHour {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Appointment {
  id: string;
  company_id: string;
  client_id: string | null;
  /** company_clients.id para walk-in reutilizado */
  company_client_id?: string | null;
  /** Cliente walk-in (sem conta) */
  client_name: string | null;
  client_phone: string | null;
  client_email?: string | null;
  professional_id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  /** Informada ao concluir atendimento (pix, cash, credit_card, …) */
  payment_method?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentService {
  appointment_id: string;
  service_id: string;
}

// Extended types for joins
export interface ProfessionalWithServices extends Professional {
  professional_services?: { service_id: string }[];
  working_hours?: WorkingHour[];
}

export interface AppointmentWithDetails extends Appointment {
  services?: Service[];
  professional?: Professional;
  client?: Profile;
}

export interface CompanyClient {
  id: string;
  company_id: string;
  /** auth.users.id - vincula cliente autenticado à empresa (multi-tenant) */
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type StockUnit = 'unit' | 'ml' | 'g';
export type StockMovementType = 'entry' | 'usage' | 'sale' | 'adjustment';

export interface StockProduct {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  brand: string | null;
  description: string | null;
  unit_type: StockUnit;
  current_quantity: number;
  package_quantity: number;
  package_type: string | null;
  minimum_stock: number;
  image_url: string | null;
  cost_price: number | null;
  sale_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  company_id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StockProductWithQuantity extends StockProduct {
  current_quantity: number;
}

export type FinancialType = 'income' | 'expense';
export type FinancialSource =
  | 'appointment'
  | 'manual'
  | 'product'
  | 'product_purchase'
  | 'product_sale';

export interface FinancialRecord {
  id: string;
  company_id: string;
  appointment_id: string | null;
  type: FinancialType;
  source: FinancialSource;
  description: string | null;
  amount: number;
  service_name_snapshot: string | null;
  client_name_snapshot: string | null;
  professional_name_snapshot: string | null;
  created_by: string | null;
  created_at: string;
  is_valid: boolean;
  payment_method?: string | null;
}

export interface ProfessionalPaymentSettings {
  id: string;
  company_id: string;
  professional_id: string;
  salario_fixo_mensal: number;
  percentual_comissao_padrao: number;
  fechamento_dia: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalServiceCommission {
  id: string;
  company_id: string;
  professional_id: string;
  service_id: string;
  percentual: number;
  created_at: string;
}

export interface MonthlyProfessionalSummary {
  id: string;
  company_id: string;
  professional_id: string;
  mes: string;
  total_faturado: number;
  ponto_equilibrio: number;
  excedente: number;
  total_comissao_excedente: number;
  salario_fixo: number;
  valor_final: number;
  fechado: boolean;
  created_at: string;
}

export type RecadoPrioridade = 'normal' | 'importante' | 'urgente';

export interface Recado {
  id: string;
  company_id: string;
  titulo: string;
  mensagem: string;
  autor: string;
  prioridade: RecadoPrioridade;
  fixado: boolean;
  criado_em: string;
  created_by: string | null;
  /** Reservado para equipes/unidades (sem FK até existir tabela teams) */
  team_id?: string | null;
}

export interface RecadoComment {
  id: string;
  recado_id: string;
  user_id: string;
  mensagem: string;
  criado_em: string;
}

export interface RecadoMention {
  id: string;
  recado_id: string;
  mentioned_user_id: string;
}

export type AppNotificationType =
  | "mention"
  | "global"
  | "appointment_created"
  | "appointment_cancelled"
  | "appointment_updated"
  | "appointment_completed";

export interface AppNotification {
  id: string;
  user_id: string;
  company_id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  recado_id: string | null;
  comment_id: string | null;
  appointment_id: string | null;
}

export interface CreateNotificationInput {
  user_id: string;
  company_id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  recado_id?: string | null;
  comment_id?: string | null;
}
