/**
 * Reset operacional + seed demo — Salão Meire Reis
 * Preserva: companies, company_members, auth, landing settings, fiscal settings.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-meire-reis.mjs
 *   pnpm seed:meire-reis
 *
 * Alternativa manual (SQL Editor):
 *   scripts/sql/seed-meire-reis.sql
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const COMPANY_ID = process.env.SEED_COMPANY_ID ?? "8ac59242-3ef8-45a2-85ed-19a94c174df0";
const COMPANY_SLUG = "meire-reis";

const PAYMENT_METHODS = ["pix", "cash", "credit_card", "debit_card", "transfer"];
const SLOT_MINUTES = 30;
const OPEN_MIN = 9 * 60;
const CLOSE_MIN = 19 * 60;

const FIRST_NAMES = [
  "Mariana", "Beatriz", "Carla", "Fernanda", "Juliana", "Patrícia", "Amanda", "Larissa",
  "Camila", "Gabriela", "Renata", "Aline", "Bruna", "Débora", "Eliane", "Helena",
  "Isabela", "Jéssica", "Karina", "Luciana", "Michele", "Natália", "Olívia", "Paula", "Raquel",
];

const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Lima", "Costa", "Ferreira", "Almeida",
  "Pereira", "Ribeiro", "Carvalho", "Gomes", "Martins", "Araújo", "Barbosa", "Rocha",
];

const SERVICES_DEF = [
  { name: "Corte feminino", duration_minutes: 45, price: 95, category: "corte", execution_mode: "sequential" },
  { name: "Escova", duration_minutes: 40, price: 70, category: "finalização", execution_mode: "sequential" },
  { name: "Hidratação", duration_minutes: 60, price: 120, category: "tratamento", execution_mode: "sequential" },
  { name: "Coloração", duration_minutes: 120, price: 280, category: "coloração", execution_mode: "sequential" },
  { name: "Mechas / luzes", duration_minutes: 150, price: 380, category: "coloração", execution_mode: "sequential" },
  { name: "Progressiva", duration_minutes: 180, price: 420, category: "química", execution_mode: "sequential" },
  { name: "Manicure", duration_minutes: 45, price: 45, category: "unhas", execution_mode: "parallel" },
  { name: "Pedicure", duration_minutes: 50, price: 55, category: "unhas", execution_mode: "parallel" },
  { name: "Alongamento em gel", duration_minutes: 90, price: 150, category: "unhas", execution_mode: "sequential" },
  { name: "Design de sobrancelha", duration_minutes: 30, price: 50, category: "estética", execution_mode: "sequential" },
  { name: "Maquiagem social", duration_minutes: 60, price: 140, category: "maquiagem", execution_mode: "sequential" },
  { name: "Penteado para festa", duration_minutes: 90, price: 180, category: "eventos", execution_mode: "sequential" },
];

const PROFESSIONALS_DEF = [
  {
    name: "Ana Paula Ribeiro",
    specialty: "Cabeleireira",
    serviceNames: ["Corte feminino", "Escova", "Hidratação", "Penteado para festa"],
  },
  {
    name: "Juliana Costa",
    specialty: "Colorista",
    serviceNames: ["Coloração", "Mechas / luzes", "Hidratação", "Progressiva"],
  },
  {
    name: "Camila Mendes",
    specialty: "Manicure e pedicure",
    serviceNames: ["Manicure", "Pedicure", "Alongamento em gel"],
  },
  {
    name: "Fernanda Lima",
    specialty: "Estética e maquiagem",
    serviceNames: ["Design de sobrancelha", "Maquiagem social"],
  },
  {
    name: "Patrícia Souza",
    specialty: "Tratamentos capilares",
    serviceNames: ["Hidratação", "Progressiva", "Escova"],
  },
];

const STOCK_DEF = [
  { name: "Shampoo profissional 1L", category: "Cabelo", brand: "Wella", unit_type: "ml", minimum_stock: 500, cost_price: 89, sale_price: 0, entry_qty: 2000 },
  { name: "Máscara hidratação 500g", category: "Cabelo", brand: "L'Oréal", unit_type: "g", minimum_stock: 200, cost_price: 65, sale_price: 0, entry_qty: 1500 },
  { name: "Tintura 7.0", category: "Coloração", brand: "Koleston", unit_type: "unit", minimum_stock: 5, cost_price: 28, sale_price: 45, entry_qty: 24 },
  { name: "Oxidante 20 volumes", category: "Coloração", brand: "Wella", unit_type: "ml", minimum_stock: 500, cost_price: 35, sale_price: 0, entry_qty: 3000 },
  { name: "Esmalte gel premium", category: "Unhas", brand: "Impala", unit_type: "unit", minimum_stock: 10, cost_price: 22, sale_price: 38, entry_qty: 36 },
  { name: "Acetona 500ml", category: "Unhas", brand: "Risqué", unit_type: "ml", minimum_stock: 200, cost_price: 18, sale_price: 0, entry_qty: 2000 },
  { name: "Algodão rolo", category: "Descartáveis", brand: "Cremer", unit_type: "unit", minimum_stock: 3, cost_price: 12, sale_price: 0, entry_qty: 12 },
  { name: "Lixa profissional", category: "Unhas", brand: "World Beauty", unit_type: "unit", minimum_stock: 20, cost_price: 2.5, sale_price: 5, entry_qty: 100 },
  { name: "Pinça para sobrancelha", category: "Estética", brand: "Mundial", unit_type: "unit", minimum_stock: 2, cost_price: 35, sale_price: 0, entry_qty: 8 },
  { name: "Base fortalecedora", category: "Unhas", brand: "Risqué", unit_type: "unit", minimum_stock: 8, cost_price: 15, sale_price: 28, entry_qty: 30 },
];

function loadEnvLocal() {
  const envPath = join(rootDir, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function minutesToTime(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function sumServiceDuration(services) {
  const sequential = services.filter((s) => s.execution_mode !== "parallel");
  const parallel = services.filter((s) => s.execution_mode === "parallel");
  const seqSum = sequential.reduce((a, s) => a + s.duration_minutes, 0);
  const parMax = parallel.length ? Math.max(...parallel.map((s) => s.duration_minutes)) : 0;
  return seqSum + parMax;
}

function sumServicePrice(services) {
  return services.reduce((a, s) => a + Number(s.price), 0);
}

function fakePhone(index) {
  const n = String(981000000 + index).slice(-8);
  return `(61) 9${n.slice(0, 4)}-${n.slice(4)}`;
}

function randomClientName(i) {
  if (i < FIRST_NAMES.length) {
    return `${FIRST_NAMES[i]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
  }
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

async function fetchIds(supabase, table, companyId, column = "company_id") {
  const { data, error } = await supabase.from(table).select("id").eq(column, companyId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []).map((r) => r.id);
}

async function fetchProfessionalIds(supabase, companyId) {
  const { data, error } = await supabase.from("professionals").select("id").eq("company_id", companyId);
  if (error) throw new Error(`professionals: ${error.message}`);
  return (data ?? []).map((r) => r.id);
}

async function deleteInChunks(supabase, table, column, ids, chunkSize = 100) {
  if (!ids.length) return;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
  }
}

async function clearTenantOperationalData(supabase, companyId) {
  console.log("Limpando dados operacionais da empresa (preservando cadastro da empresa)...\n");

  const steps = [
    ["invoice_logs", "company_id", companyId],
    ["invoices", "company_id", companyId],
    ["financial_records", "company_id", companyId],
  ];

  for (const [table, col, val] of steps) {
    const { error } = await supabase.from(table).delete().eq(col, val);
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ✓ ${table}`);
  }

  const appointmentIds = await fetchIds(supabase, "appointments", companyId);
  await deleteInChunks(supabase, "appointment_services", "appointment_id", appointmentIds);
  console.log("  ✓ appointment_services");

  const { error: aptErr } = await supabase.from("appointments").delete().eq("company_id", companyId);
  if (aptErr) throw new Error(`appointments: ${aptErr.message}`);
  console.log("  ✓ appointments");

  const { error: notifErr } = await supabase.from("notifications").delete().eq("company_id", companyId);
  if (notifErr) throw new Error(`notifications: ${notifErr.message}`);
  console.log("  ✓ notifications");

  for (const table of ["stock_movements", "stock_products", "professional_service_commissions", "monthly_professional_summary", "professional_payment_settings", "company_performance_goals"]) {
    const { error } = await supabase.from(table).delete().eq("company_id", companyId);
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ✓ ${table}`);
  }

  const proIds = await fetchProfessionalIds(supabase, companyId);
  await deleteInChunks(supabase, "working_hours", "professional_id", proIds);
  console.log("  ✓ working_hours");

  if (proIds.length) {
    const { error: psErr } = await supabase.from("professional_services").delete().in("professional_id", proIds);
    if (psErr) throw new Error(`professional_services: ${psErr.message}`);
  }
  console.log("  ✓ professional_services");

  const { error: proErr } = await supabase.from("professionals").delete().eq("company_id", companyId);
  if (proErr) throw new Error(`professionals: ${proErr.message}`);
  console.log("  ✓ professionals");

  const { error: svcErr } = await supabase.from("services").delete().eq("company_id", companyId);
  if (svcErr) throw new Error(`services: ${svcErr.message}`);
  console.log("  ✓ services");

  const recadoIds = await fetchIds(supabase, "recados", companyId);
  await deleteInChunks(supabase, "recado_comments", "recado_id", recadoIds);
  await deleteInChunks(supabase, "recado_mentions", "recado_id", recadoIds);
  console.log("  ✓ recado_comments / recado_mentions");

  const { error: recErr } = await supabase.from("recados").delete().eq("company_id", companyId);
  if (recErr) throw new Error(`recados: ${recErr.message}`);
  console.log("  ✓ recados");

  const { error: ccErr } = await supabase.from("company_clients").delete().eq("company_id", companyId);
  if (ccErr) throw new Error(`company_clients: ${ccErr.message}`);
  console.log("  ✓ company_clients\n");
}

async function seedMeireReis(supabase, companyId) {
  console.log("Inserindo dados demo (salão de beleza)...\n");

  const { data: insertedServices, error: svcErr } = await supabase
    .from("services")
    .insert(SERVICES_DEF.map((s) => ({ ...s, company_id: companyId })))
    .select("id, name, duration_minutes, price, execution_mode, category");

  if (svcErr) throw new Error(`services insert: ${svcErr.message}`);
  const serviceByName = Object.fromEntries((insertedServices ?? []).map((s) => [s.name, s]));
  console.log(`  ✓ ${insertedServices?.length ?? 0} serviços`);

  const { data: insertedPros, error: proErr } = await supabase
    .from("professionals")
    .insert(
      PROFESSIONALS_DEF.map((p) => ({
        company_id: companyId,
        name: p.name,
        specialty: p.specialty,
        is_active: true,
      }))
    )
    .select("id, name");

  if (proErr) throw new Error(`professionals insert: ${proErr.message}`);
  console.log(`  ✓ ${insertedPros?.length ?? 0} profissionais`);

  const whRows = [];
  const proServiceRows = [];
  const paymentSettingsRows = [];

  for (const pro of insertedPros ?? []) {
    const def = PROFESSIONALS_DEF.find((d) => d.name === pro.name);
    for (let day = 1; day <= 6; day++) {
      whRows.push({
        professional_id: pro.id,
        day_of_week: day,
        start_time: "09:00:00",
        end_time: "19:00:00",
      });
    }
    paymentSettingsRows.push({
      company_id: companyId,
      professional_id: pro.id,
      salario_fixo_mensal: randomInt(1800, 3200),
      percentual_comissao_padrao: randomInt(15, 35),
      fechamento_dia: 30,
      ativo: true,
    });
    for (const svcName of def?.serviceNames ?? []) {
      const svc = serviceByName[svcName];
      if (svc) proServiceRows.push({ professional_id: pro.id, service_id: svc.id });
    }
  }

  if (whRows.length) {
    const { error: whErr } = await supabase.from("working_hours").insert(whRows);
    if (whErr) throw new Error(`working_hours: ${whErr.message}`);
  }

  if (proServiceRows.length) {
    const { error: psErr } = await supabase.from("professional_services").upsert(proServiceRows, {
      onConflict: "professional_id,service_id",
    });
    if (psErr) throw new Error(`professional_services: ${psErr.message}`);
  }

  if (paymentSettingsRows.length) {
    const { error: payErr } = await supabase.from("professional_payment_settings").insert(paymentSettingsRows);
    if (payErr) console.warn("  (aviso) professional_payment_settings:", payErr.message);
  }

  const clientRows = Array.from({ length: 28 }, (_, i) => {
    const name = randomClientName(i);
    const slug = name.toLowerCase().replace(/\s+/g, ".");
    return {
      company_id: companyId,
      full_name: name,
      phone: fakePhone(i + 1),
      email: `${slug}${i}@exemplo.demo`,
      notes: i % 5 === 0 ? "Cliente preferencial — demo" : null,
    };
  });

  const { data: clients, error: clientErr } = await supabase.from("company_clients").insert(clientRows).select("id, full_name, phone");
  if (clientErr) throw new Error(`company_clients: ${clientErr.message}`);
  console.log(`  ✓ ${clients?.length ?? 0} clientes`);

  const today = new Date("2026-05-22T12:00:00");
  const occupied = new Map();

  function slotKey(proId, dateStr, startMin) {
    return `${proId}|${dateStr}|${startMin}`;
  }

  function markOccupied(proId, dateStr, startMin, durationMin) {
    for (let m = startMin; m < startMin + durationMin; m += SLOT_MINUTES) {
      occupied.set(slotKey(proId, dateStr, m), true);
    }
  }

  function isFree(proId, dateStr, startMin, durationMin) {
    for (let m = startMin; m < startMin + durationMin; m += SLOT_MINUTES) {
      if (occupied.has(slotKey(proId, dateStr, m))) return false;
      if (m + SLOT_MINUTES > CLOSE_MIN) return false;
    }
    return startMin >= OPEN_MIN;
  }

  function pickServicesForPro(proName) {
    const def = PROFESSIONALS_DEF.find((d) => d.name === proName);
    const names = def?.serviceNames ?? [];
    const pool = names.map((n) => serviceByName[n]).filter(Boolean);
    if (!pool.length) return [pick(insertedServices)];
    const count = Math.random() > 0.65 ? 2 : 1;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  const appointmentsToInsert = [];
  const dayOffsets = [];
  for (let d = -28; d <= 14; d++) dayOffsets.push(d);

  let attempts = 0;
  while (appointmentsToInsert.length < 55 && attempts < 800) {
    attempts++;
    const dayOff = pick(dayOffsets);
    const date = addDays(today, dayOff);
    const dow = date.getDay();
    if (dow === 0) continue;

    const dateStr = formatDate(date);
    const pro = pick(insertedPros);
    const selectedServices = pickServicesForPro(pro.name);
    const duration = sumServiceDuration(selectedServices);
    const maxStart = CLOSE_MIN - duration;
    if (maxStart < OPEN_MIN) continue;

    const startMin = OPEN_MIN + Math.floor(Math.random() * ((maxStart - OPEN_MIN) / SLOT_MINUTES + 1)) * SLOT_MINUTES;
    if (!isFree(pro.id, dateStr, startMin, duration)) continue;

    const client = pick(clients);
    let status = "confirmed";
    if (dayOff < 0) {
      const r = Math.random();
      if (r < 0.55) status = "completed";
      else if (r < 0.7) status = "cancelled";
      else if (r < 0.8) status = "no_show";
      else status = "confirmed";
    } else if (dayOff > 7) {
      status = Math.random() > 0.4 ? "pending" : "confirmed";
    }

    markOccupied(pro.id, dateStr, startMin, duration);
    appointmentsToInsert.push({
      company_id: companyId,
      professional_id: pro.id,
      date: dateStr,
      start_time: minutesToTime(startMin),
      duration_minutes: duration,
      status,
      client_name: client.full_name,
      client_phone: client.phone,
      company_client_id: client.id,
      payment_method: status === "completed" ? pick(PAYMENT_METHODS) : null,
      _services: selectedServices,
      _clientName: client.full_name,
      _proName: pro.name,
    });
  }

  let aptCreated = 0;
  let finCreated = 0;

  for (const apt of appointmentsToInsert) {
    const { _services, _clientName, _proName, ...row } = apt;
    const { data: created, error: aptErr } = await supabase
      .from("appointments")
      .insert({
        company_id: row.company_id,
        professional_id: row.professional_id,
        date: row.date,
        start_time: row.start_time,
        duration_minutes: row.duration_minutes,
        status: row.status,
        client_name: row.client_name,
        client_phone: row.client_phone,
        company_client_id: row.company_client_id,
        payment_method: row.payment_method,
      })
      .select("id")
      .single();

    if (aptErr) {
      console.warn("  (aviso) agendamento:", aptErr.message);
      continue;
    }
    aptCreated++;

    const svcLinks = _services.map((s) => ({ appointment_id: created.id, service_id: s.id }));
    await supabase.from("appointment_services").insert(svcLinks);

    if (row.status === "completed") {
      const amount = sumServicePrice(_services);
      const [hh, mm] = String(row.start_time).slice(0, 5).split(":").map(Number);
      const occurredAt = new Date(row.date);
      occurredAt.setHours(hh, mm + row.duration_minutes, 0, 0);
      const { error: finErr } = await supabase.from("financial_records").insert({
        company_id: companyId,
        appointment_id: created.id,
        type: "income",
        source: "appointment",
        description: _services.map((s) => s.name).join(" + "),
        amount,
        service_name_snapshot: _services.map((s) => s.name).join(", "),
        client_name_snapshot: _clientName,
        professional_name_snapshot: _proName,
        payment_method: row.payment_method,
        is_valid: true,
        created_at: occurredAt.toISOString(),
      });
      if (!finErr) finCreated++;
    }
  }
  console.log(`  ✓ ${aptCreated} agendamentos (${finCreated} lançamentos financeiros)`);

  for (const item of STOCK_DEF) {
    const { entry_qty, ...product } = item;
    const { data: prod, error: pErr } = await supabase
      .from("stock_products")
      .insert({
        company_id: companyId,
        name: product.name,
        category: product.category,
        brand: product.brand,
        unit_type: product.unit_type,
        minimum_stock: product.minimum_stock,
        cost_price: product.cost_price,
        sale_price: product.sale_price || null,
        current_quantity: entry_qty,
        is_active: true,
      })
      .select("id")
      .single();

    if (pErr) {
      console.warn("  (aviso) estoque:", product.name, pErr.message);
      continue;
    }

    await supabase.from("stock_movements").insert({
      company_id: companyId,
      product_id: prod.id,
      movement_type: "entry",
      quantity: entry_qty,
      reason: "Estoque inicial — seed demo",
    });

    if (Math.random() > 0.5) {
      const usage = Math.max(1, Math.floor(entry_qty * 0.05));
      await supabase.from("stock_movements").insert({
        company_id: companyId,
        product_id: prod.id,
        movement_type: "usage",
        quantity: usage,
        reason: "Consumo atendimento — demo",
      });
    }
  }
  console.log(`  ✓ ${STOCK_DEF.length} produtos de estoque`);

  const { error: recErr } = await supabase.from("recados").insert([
    {
      company_id: companyId,
      titulo: "Promoção escova + hidratação",
      mensagem: "Combo especial até o fim do mês. Divulguem nas redes!",
      autor: "Meire Reis",
      prioridade: "importante",
      fixado: true,
    },
    {
      company_id: companyId,
      titulo: "Estoque de tintura",
      mensagem: "Conferir saldo da linha 7.0 antes do fim de semana.",
      autor: "Gestão",
      prioridade: "normal",
      fixado: false,
    },
    {
      company_id: companyId,
      titulo: "Treinamento colorimetria",
      mensagem: "Sábado 14h — sala de apoio. Presença da equipe de coloração.",
      autor: "Juliana Costa",
      prioridade: "normal",
      fixado: false,
    },
  ]);
  if (recErr) console.warn("  (aviso) recados:", recErr.message);
  else console.log("  ✓ 3 recados no mural");

  const { error: goalErr } = await supabase.from("company_performance_goals").insert({
    company_id: companyId,
    name: "Meta receita mensal",
    period_type: "monthly",
    metric: "revenue",
    target_value: 45000,
  });
  if (goalErr) console.warn("  (aviso) meta desempenho:", goalErr.message);
  else console.log("  ✓ meta de desempenho (receita mensal)");
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("id", COMPANY_ID)
    .single();

  if (companyErr || !company) {
    console.error("Empresa não encontrada:", COMPANY_ID, companyErr?.message);
    process.exit(1);
  }

  if (company.slug !== COMPANY_SLUG) {
    console.warn(`Aviso: slug esperado "${COMPANY_SLUG}", encontrado "${company.slug}". Continuando pelo ID.`);
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Seed: ${company.name} (${company.id})`);
  console.log("═══════════════════════════════════════════════════════\n");

  await clearTenantOperationalData(supabase, company.id);
  await seedMeireReis(supabase, company.id);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Concluído! Empresa e membros preservados.");
  console.log(`  Landing: /site/${company.slug}`);
  console.log("  Dashboard: /app");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
