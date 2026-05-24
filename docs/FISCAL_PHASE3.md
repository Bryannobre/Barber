# Módulo fiscal — Fase 3 (roadmap)

> Fase 2 entrega retry, cancelamento interno, PDF mock em Storage e arquitetura de providers.
> Itens abaixo **não** estão implementados.

## Provedores reais

- [ ] `TecnoSpeedFiscalProvider` — integração API homologada
- [ ] `NuvemFiscalProvider` — integração API
- [ ] `IntegraNotasFiscalProvider` — integração API
- [ ] `FiscalProviderFactory` — seleção por `company_fiscal_settings.provider`
- [ ] Secrets: `FISCAL_TECNOSPEED_*`, `FISCAL_NUVEM_*` no Supabase (nunca no client)

## Certificado e assinatura

- [ ] Certificado A1/A3 em Supabase Vault / Secrets
- [ ] Upload de certificado via fluxo admin (Edge Function only)
- [ ] Assinatura XML conforme layout municipal

## XML e documentos legais

- [ ] Geração e armazenamento de XML NFS-e real
- [ ] DANFSE / PDF oficial do provedor (substituir PDF mock)
- [ ] Validação de schema XSD por município

## Webhooks e assíncrono

- [ ] Edge Function `fiscal-webhook` com validação de assinatura
- [ ] Atualização de status `PROCESSING` → `ISSUED` / `FAILED` via callback
- [ ] Fila / idempotência (evitar processar mesmo evento 2x)

## Cancelamento fiscal real

- [ ] `cancelInvoice` no provider real (prefeitura)
- [ ] Status `CANCELLED` só após confirmação do provedor
- [ ] Manter cancelamento interno como fallback administrativo

## Automação

- [ ] `auto_issue_invoice` após confirmação em `financial_records`
- [ ] Trigger ou job controlado (sem duplicar lançamentos financeiros)

## Compliance

- [ ] Retenção de logs e XML (prazo legal)
- [ ] Auditoria por `company_id` para owner da plataforma
