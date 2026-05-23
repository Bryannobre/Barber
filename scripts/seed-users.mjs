/**
 * Script para criar contas de teste: Admin e Dashboard Empresa
 * Execute: node scripts/seed-users.mjs
 * Requer: SUPABASE_SERVICE_ROLE_KEY no .env ou variável de ambiente
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://nrvqmjjbhdnayadotjeg.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error("Erro: Defina SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  console.error("Obtenha em: Supabase Dashboard > Settings > API > service_role (secret)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const CREDENTIALS = {
  admin: { email: "admin@beautyhub.com", password: "Admin123!", fullName: "Admin BeautyHub", role: "owner" },
  empresa: { email: "empresa@beautyhub.com", password: "Empresa123!", fullName: "Gestor Empresa", role: "company_admin" },
};

const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6];

async function seedBookingDemoData(companyId) {
  if (!companyId) return;

  const { count: svcCount } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if ((svcCount ?? 0) > 0) {
    console.log("Serviços da demo já existem — pulando seed de agenda.\n");
    return;
  }

  const services = [
    { name: "Corte", duration_minutes: 30, price: 45, category: "corte", execution_mode: "sequential" },
    { name: "Barba", duration_minutes: 20, price: 25, category: "barba", execution_mode: "sequential" },
    { name: "Corte + Barba", duration_minutes: 45, price: 65, category: "combo", execution_mode: "sequential" },
  ];

  const { data: insertedServices, error: svcErr } = await supabase
    .from("services")
    .insert(services.map((s) => ({ ...s, company_id: companyId })))
    .select("id, name");

  if (svcErr) {
    console.warn("Aviso: não foi possível criar serviços demo:", svcErr.message);
    return;
  }

  const pros = [
    { name: "João Silva", specialty: "Barbeiro", is_active: true },
    { name: "Maria Santos", specialty: "Cabeleireira", is_active: true },
  ];

  const { data: insertedPros, error: proErr } = await supabase
    .from("professionals")
    .insert(pros.map((p) => ({ ...p, company_id: companyId })))
    .select("id, name");

  if (proErr || !insertedPros?.length) {
    console.warn("Aviso: não foi possível criar profissionais demo:", proErr?.message);
    return;
  }

  const serviceIds = (insertedServices ?? []).map((s) => s.id);
  const whRows = [];
  for (const pro of insertedPros) {
    for (const day of DEFAULT_WORKING_DAYS) {
      whRows.push({
        professional_id: pro.id,
        day_of_week: day,
        start_time: "09:00",
        end_time: "19:00",
      });
    }
    for (const sid of serviceIds) {
      await supabase.from("professional_services").upsert(
        { professional_id: pro.id, service_id: sid },
        { onConflict: "professional_id,service_id" }
      );
    }
  }

  await supabase.from("working_hours").insert(whRows);
  console.log(
    `Demo agenda: ${insertedServices?.length ?? 0} serviços, ${insertedPros.length} profissionais (horários 09–19, intervalo 15 min no app).\n`
  );
}

async function main() {
  console.log("Criando contas de teste...\n");

  // 1. Criar empresa (para vincular ao gestor)
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      name: "Barbearia Premium",
      slug: "barbearia-premium",
      slogan: "Seu estilo, nossa arte",
      phone: "(11) 99999-0000",
      email: "contato@barbeariapremium.com",
      status: "active",
    })
    .select("id")
    .single();

  let companyId = company?.id;
  if (companyError) {
    if (companyError.code === "23505") {
      console.log("Empresa 'Barbearia Premium' já existe. Buscando...");
      const { data: existing } = await supabase.from("companies").select("id").eq("slug", "barbearia-premium").single();
      if (existing) companyId = existing.id;
    }
    if (!companyId) {
      console.error("Erro ao criar empresa:", companyError);
      process.exit(1);
    }
  }
  console.log("Empresa OK (slug: barbearia-premium)\n");

  await seedBookingDemoData(companyId);

  // 2. Criar admin (owner)
  const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
    email: CREDENTIALS.admin.email,
    password: CREDENTIALS.admin.password,
    email_confirm: true,
    user_metadata: { full_name: CREDENTIALS.admin.fullName },
  });

  let adminUserId = adminUser?.user?.id;
  if (adminError) {
    if (adminError.message?.includes("already been registered") || adminError.message?.includes("already exists")) {
      console.log("Admin já existe. Atualizando role...\n");
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const adm = users?.find((u) => u.email === CREDENTIALS.admin.email);
      if (adm) {
        adminUserId = adm.id;
        await supabase.from("profiles").update({ role: "owner" }).eq("id", adm.id);
        if (companyId) await supabase.from("companies").update({ owner_id: adm.id }).eq("id", companyId);
      }
    } else {
      console.error("Erro ao criar admin:", adminError.message, adminError);
      process.exit(1);
    }
  } else {
    const { error: profileErr } = await supabase.from("profiles").upsert(
      { id: adminUser.user.id, full_name: CREDENTIALS.admin.fullName, role: "owner" },
      { onConflict: "id" }
    );
    if (profileErr) await supabase.from("profiles").update({ role: "owner" }).eq("id", adminUser.user.id);
    if (companyId && adminUser.user.id) {
      await supabase.from("companies").update({ owner_id: adminUser.user.id }).eq("id", companyId);
    }
    console.log("Admin criado com sucesso!\n");
  }

  // 3. Criar gestor empresa (company_admin)
  const { data: empresaUser, error: empresaError } = await supabase.auth.admin.createUser({
    email: CREDENTIALS.empresa.email,
    password: CREDENTIALS.empresa.password,
    email_confirm: true,
    user_metadata: { full_name: CREDENTIALS.empresa.fullName },
  });

  if (empresaError) {
    if (empresaError.message?.includes("already been registered")) {
      console.log("Gestor empresa já existe. Atualizando vínculo...\n");
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const empUser = users?.find((u) => u.email === CREDENTIALS.empresa.email);
      if (empUser) {
        await supabase.from("profiles").update({ role: "company_admin", company_id: companyId }).eq("id", empUser.id);
      }
    } else {
      console.error("Erro ao criar gestor:", empresaError.message);
      process.exit(1);
    }
  } else {
    await supabase.from("profiles").upsert(
      { id: empresaUser.user.id, full_name: CREDENTIALS.empresa.fullName, role: "company_admin", company_id: companyId },
      { onConflict: "id" }
    );
    console.log("Gestor empresa criado e vinculado à Barbearia Premium!\n");
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("              CREDENCIAIS DE ACESSO");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log("PAINEL ADMIN (Owner):");
  console.log("  Email:    " + CREDENTIALS.admin.email);
  console.log("  Senha:    " + CREDENTIALS.admin.password);
  console.log("  URL:      / → Painel Admin\n");
  console.log("DASHBOARD EMPRESA (Company Admin):");
  console.log("  Email:    " + CREDENTIALS.empresa.email);
  console.log("  Senha:    " + CREDENTIALS.empresa.password);
  console.log("  URL:      / → Dashboard Empresa\n");
  console.log("LANDING PAGE (pública):");
  console.log("  URL:      /site/barbearia-premium");
  console.log("  (Clientes podem se cadastrar e agendar)\n");
  console.log("═══════════════════════════════════════════════════════");
}

main().catch(console.error);
