# Sules Control

Sistema web individual para vendas de seguros, comissões, recebimentos, cancelamentos/estornos, conferência mensal de produção (PDF Digital Suhai), metas, projeções e relatórios.

Stack: Vue 3 + TypeScript + Vite + Tailwind · Supabase (PostgreSQL, Auth, RLS, Storage) · Chart.js · Vercel.

## Colocar no ar

1. **Supabase**: crie um projeto. Em *Authentication → Providers*, desative "Allow new users to sign up" (sem cadastro público) e crie seu usuário manualmente (*Authentication → Users → Add user*).
2. **SQL Editor**: rode, nesta ordem, `supabase/migrations/001_schema.sql`, `002_rules_rls.sql`, `003_seed.sql`.
3. `cp .env.example .env` e preencha URL e chave **anon** (nunca a `service_role`).
4. `npm install && npm run dev`. No primeiro login o sistema pede seu nome e cria a Suhai como seguradora padrão e os produtos Moto, Auto e Digital.
5. **Vercel**: importe o repositório do GitHub, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O `vercel.json` já cuida das rotas.
6. **Backup**: ative os backups diários do Supabase (plano Pro) ou agende `pg_dump`.

## Movimento (skills aplicadas)

| Onde | Skill | Detalhe |
|---|---|---|
| Entrada (hero) | `ambient-section-particles` | `components/AmbientParticles.vue`: canvas limitado à seção, modo recycle, 1 loop rAF, pausa fora da tela e com aba oculta, estático com *reduced motion* |
| Entrada (manifesto) | `scroll-scrubbed-word-reveal` | `components/WordReveal.vue`: palavras reveladas pelo scroll, cópia intacta para leitores de tela |
| Cards, gráficos, tabelas | `animation-on-scroll` | `motion/reveal.ts` (`v-reveal`, `v-reveal.stagger`) + keyframe `animationIn` em `style.css`; roda uma vez |
| Telas de uso diário | `design-motion-principles` | Emil como lente principal: reveals curtos (320 ms, 10 px), troca de página só com fade de 120 ms, modal 160 ms, clique `scale(.97)`; expressivo apenas na entrada |

Tudo respeita `prefers-reduced-motion`.

## Novidades (chat, e-mail ao RH, notificações)

1. **Banco:** rode também `supabase/migrations/004_features.sql` no SQL Editor (conversão de leads, notas e notificações). Para os avisos saírem mesmo com o site fechado, ative a extensão **pg_cron** em *Database → Extensions* antes de rodar; sem ela, os avisos são gerados enquanto o site estiver aberto.
2. **Funções do Supabase** (chat e e-mail), com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... \
  SMTP_USER=voce@seudominio.com SMTP_PASS=senha-do-email RH_EMAIL=rh@empresa.com
supabase functions deploy chat
supabase functions deploy send-policy-email
```

- `ANTHROPIC_API_KEY`: chave de API criada em console.anthropic.com (cobrança própria, separada da assinatura do Claude.ai). Modelo opcional: `ANTHROPIC_MODEL`.
- E-mail Titan (HostGator): servidor `smtp.titan.email`, porta **465** (SSL), usuário e senha da própria caixa. O Supabase bloqueia as portas 25 e 587.
- O e-mail ao RH sai ao **cadastrar uma venda nova** (não ao editar) e traz cliente, produto, prêmio, os percentuais e a comissão líquida. Se falhar, a venda continua salva e aparece um aviso.

## Testes

`npm test` roda os testes da lógica de negócio (cálculo de comissões, estornos, parser do PDF, conferência, duplicidade). Exigem Node 22.6+.

## Onde está cada regra

| Regra | Onde |
|---|---|
| Percentual do corretor congelado na venda | `sales.broker_percent` + trigger `sales_before_write` (nenhum trigger em `settings` toca `sales`) |
| Comissões bruta/líquida | trigger no banco + `utils/finance.ts` |
| Alteração financeira exige justificativa e gera histórico | `sales_before_write` → `audit_logs` |
| Sem exclusão destrutiva | triggers `*_prevent_delete`, `block_delete`, arquivamento de clientes |
| Sem estorno de dinheiro não recebido | `reversals_check` |
| Cancelamento antes do recebimento = comissão perdida | `cancellations_before_insert` |
| Só estorno efetivado impacta resultado; data do estorno = data do impacto | `utils/finance.ts#summarize` |
| Importação não cria vendas nem recebimentos | `services/reconciliation.ts` |
| Duplicidade (arquivo e registro) | `file_hash` único + `item_key` |
| Dt. In. Vig. ≠ sale_date | colunas separadas; diferença só informativa |

## Leitor do PDF

O parser (`utils/reportParser.ts`) foi ajustado e testado com o relatório real *Digital Suhai · Itallo Cesar · Outubro/2026* (14 documentos). Na tela de importação ele compara o que leu com o "Total período" impresso no próprio PDF (quantidade de documentos, prêmio e comissão) e avisa se não bater. Linhas não reconhecidas continuam listadas, nada é descartado em silêncio.
