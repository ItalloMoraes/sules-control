# Sules Control

Sistema web para corretores de seguro auto: vendas, emissão de apólices, comissões, recebimentos, cancelamentos e estornos, conferência mensal da produção (PDF da seguradora), metas, projeções e relatórios.

## Funcionalidades

- **Vendas e apólices:** cadastro da venda com cliente criado na hora, depois emissão da apólice (a venda passa de *pendente* a *emitida*).
- **Comissões:** bruta e líquida calculadas no banco, com o percentual do corretor congelado em cada venda; recebimentos e saldo de caixa.
- **Cancelamentos:** a comissão da venda cancelada sai do total. Excluir uma venda a apaga de vez.
- **Conferência mensal:** importação do PDF da seguradora, comparação com as vendas cadastradas e validação pelo "Total período" do próprio relatório.
- **Dashboard, metas, projeções, comparativos e relatórios** (PDF e Excel).
- **Clientes:** cadastrados direto na venda e editáveis na tela da venda.
- **Propostas em PDF:** anexo na venda, pré-visualização no site e envio junto com o e-mail ao RH.
- **Endereço por CEP:** o CEP do cliente preenche cidade e estado sozinho (ViaCEP) e alimenta os gráficos por região e estado.
- **Notificações** de apólices pendentes (a cada 5 horas), **notas e mensagens prontas**, **registro de conversão de leads** e **assistente de chat**.
- **E-mail automático** com os dados da venda para um destinatário configurável.

## Tecnologias

Vue 3 · TypeScript · Vite · Tailwind CSS · Chart.js · Supabase (PostgreSQL, Auth, RLS, Edge Functions) · Vercel.

## Estrutura

```
src/
  components/   componentes reutilizáveis (calendário, listas, gráficos, ícones)
  composables/  lógica compartilhada (tema, avisos, popovers)
  layouts/      estrutura da área logada
  motion/       animações de entrada por scroll
  pages/        telas
  router/       rotas e proteção de acesso
  services/     Supabase, e-mail, leitura de PDF, conferência
  stores/       estado global (Pinia)
  utils/        regras de negócio e testes (__tests__)
supabase/
  migrations/   banco de dados (rodar em ordem)
  functions/    funções de servidor: chat e send-policy-email
```

## Como rodar localmente

**Pré-requisitos:** Node.js 22.6 ou superior e uma conta no [Supabase](https://supabase.com).

1. Instale as dependências:
   ```bash
   npm install
   ```
2. No Supabase, crie um projeto. Em *Authentication*, desative o cadastro público de novos usuários e crie o seu usuário manualmente.
3. No *SQL Editor*, rode em ordem os arquivos de `supabase/migrations`: `001_schema.sql`, `002_rules_rls.sql`, `003_seed.sql` e `004_features.sql`, `005_proposals.sql`, `006_delete_sales.sql`, `007_security.sql` e `008_address.sql`.
4. Crie o arquivo de ambiente e preencha:
   ```bash
   cp .env.example .env
   ```
5. Inicie:
   ```bash
   npm run dev
   ```
   No primeiro acesso o sistema pede o nome do corretor e cria a seguradora padrão, os produtos iniciais e as configurações.

## Variáveis de ambiente

**Aplicação** (arquivo `.env`; use somente a chave pública, nunca a chave secreta/`service_role`):

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (*publishable* / *anon*) |

**Funções de servidor** (cadastradas como *secrets* no Supabase, não vão no `.env`):

| Variável | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | Chave da API usada pelo chat. `ANTHROPIC_MODEL` é opcional |
| `SMTP_USER` / `SMTP_PASS` | Login da caixa de e-mail que envia as vendas (de preferência uma senha de aplicativo) |
| `SMTP_HOST` / `SMTP_PORT` | Opcionais. Padrão: `smtp.titan.email` e `465` (SSL) |
| `RH_EMAIL` | Destinatário dos e-mails de venda |

## Funções de servidor e agendamento

Com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set ANTHROPIC_API_KEY=... SMTP_USER=... SMTP_PASS=... RH_EMAIL=...
supabase functions deploy chat
supabase functions deploy send-policy-email
```

- O Supabase bloqueia as portas SMTP 25 e 587; use a **465**.
- Os avisos de apólice pendente são gerados por uma rotina no banco agendada com **pg_cron**. Ative a extensão em *Database → Extensions* antes de rodar `004_features.sql`. Sem ela, os avisos são gerados apenas com o sistema aberto.
- O e-mail é enviado ao **cadastrar** uma venda nova. Se falhar, a venda permanece salva.

## Testes e build

```bash
npm test         # regras de negócio: comissões, estornos, leitura do PDF, conferência
npm run build    # checagem de tipos + build de produção
```

## Deploy

1. Importe o repositório na [Vercel](https://vercel.com).
2. Cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em *Environment Variables*.
3. Publique. O `vercel.json` já configura as rotas da aplicação.
4. No Supabase, em *Authentication → URL Configuration*, informe o endereço da Vercel em *Site URL*.

Ative os backups do banco no Supabase (ou agende `pg_dump`).

## Segurança

- **HTTPS/TLS:** o site é servido em HTTPS pela Vercel, e o banco só aceita conexões protegidas. O `vercel.json` ainda envia HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`. A `Content-Security-Policy` está em modo de observação (*Report-Only*); depois de usar o site sem erros no console, troque o nome do cabeçalho para `Content-Security-Policy` para aplicá-la.
- **Dados em repouso:** criptografados pela infraestrutura do Supabase (conforme o provedor). Arquivos PDF ficam em espaço privado, abertos por link temporário.
- **Rate limiting em camadas:** (1) Supabase Auth limita tentativas de login e envio de e-mails (*Authentication → Rate Limits*); (2) as funções `chat` e `send-policy-email` limitam chamadas por usuário (`007_security.sql`); (3) o login bloqueia por 1 minuto após 5 erros seguidos; (4) opcional: regra de limite na Vercel (*Firewall → Configure → New Rule → Rate Limit*), por IP, que no plano Hobby permite 1 regra desse tipo.
- **Privacidade e termos:** páginas `/privacidade`, `/termos` e `/cookies`, com o canal de contato configurado em `src/contact.ts`. Os textos são um modelo e devem ser revisados por um advogado.

- Todas as tabelas usam *Row Level Security*: cada usuário acessa apenas os próprios dados.
- Chaves privadas (API de IA, senha de e-mail) ficam somente nas funções de servidor.
- Alterações financeiras exigem justificativa e geram histórico de auditoria.
- `.env`, `node_modules` e `dist` não são versionados.

## Regras de negócio

| Regra | Onde |
|---|---|
| Percentual do corretor congelado na venda | `sales.broker_percent` + trigger `sales_before_write` |
| Comissões bruta e líquida | trigger no banco + `utils/finance.ts` |
| Alteração financeira exige justificativa e gera histórico | `sales_before_write` → `audit_logs` |
| Excluir venda é definitivo e leva junto os registros ligados a ela | `006_delete_sales.sql` |
| Sem estorno de dinheiro não recebido | `reversals_check` |
| Cancelamento antes do recebimento = comissão perdida | `cancellations_before_insert` |
| Só estorno efetivado impacta o resultado | `utils/finance.ts#summarize` |
| Importação do PDF não cria vendas nem recebimentos | `services/reconciliation.ts` |
| Duplicidade de arquivo e de registro | `file_hash` único + `item_key` |
| Início de vigência é informativo, separado da data da venda | colunas distintas em `sales` |

## Interface e acessibilidade

Layout claro e escuro, menu lateral recolhível e animações discretas (partículas e texto revelado por scroll apenas na tela de entrada). Todas as animações respeitam `prefers-reduced-motion`.
