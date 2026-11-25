# Mapa: The server (migrations, RPCs, RLS, pgTAP and the fake Supabase)

Read on the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to the worktree root; a bare file name such as `20261114230012_...:41` is a file of `supabase/migrations/`, `agenda.test.sql:35` a file of `supabase/tests/database/`, `config.toml` is `supabase/config.toml` and `supabase-falso.js` is `test/e2e/supabase-falso.js`. Local working note: never commit this file.

Vocabulary: a **pedido** here is a row of the table `solicitacoes` (the Agenda). The day document also has a key called `pedidos`; those are the Demanda entries, and this map calls them "Demanda entries".

Reading rules used here: every fact ends with `path:line`. "(inferred)" marks what no line proves. Nothing was run against a database (no `npm run test:db`, no network). What was run: `node --test test/unit/espelho-do-banco.test.js test/unit/supabase-falso.test.js test/unit/perfis.test.js` (19 tests, all pass) and greps.

## 1. What exists

- **26 migrations** in `supabase/migrations/` (2026-11-10 to 2026-11-20), **14 pgTAP files** in `supabase/tests/database/` with **433 planned checks**, `supabase/config.toml`, one Edge Function (`supabase/functions/meteorologia/`, 3 files) and one e-mail template (`supabase/templates/troca-de-email.html`). No `supabase/seed.sql` exists although `config.toml:74` names it. No trigger, no view, no `drop function`, no `drop table`, no `drop column` anywhere in the migrations (grep).
- **13 tables** in `public`: `perfis`, `documentos`, `dias`, `historico`, `solicitacoes`, `dados_pessoais`, `resultados_de_missao`, `cursos`, `fases_do_curso`, `missoes_do_curso`, `requisitos_das_fases`, `requisitos_das_missoes`, `versoes_dos_cursos`. One enum, `public.perfil_acesso`.
- **33 function signatures** (31 names, counted from the `create function` statements): two names have a **legacy overload that is still installed and granted**: `registrar_solicitacao` (9 args, `20261110222506_agenda_de_solicitacoes.sql:47-85`) and `salvar_dados_pessoais` (3 args, `20261113150000_dados_pessoais.sql:73-139`). Both migration headers promise "Uma migração depois do merge a tira" (`20261114222031_agenda_com_duracao.sql:6-7`, `20261114151953_dados_pessoais_versionados.sql:10-11`); no such migration exists.
- **The data model is two JSON documents plus rows.** The roster is one row of `documentos` (`chave = 'cadastro'`); each date is one row of `dias`; the server stores both as opaque `jsonb` and reads only a handful of keys (section 2). Requests (`solicitacoes`), personal data (`dados_pessoais`), mission results (`resultados_de_missao`), the History (`historico`) and the course programs are real tables.
- **Every write goes through a function**; no table has a write policy. The client calls them from one module, `js/backends/supabase.js` (17 `cliente.rpc(` calls, lines 55-324) plus `js/painel.js:255` (`painel_do_dia`).
- **The server contract is re-implemented in JS in four more places**, which a new RPC or rule must also reach: local mode `js/backends/local.js` (the whole file; the comments at lines 48, 60, 99, 160, 171, 195, 202, 213, 223, 242 and 249 each name the server rule being copied); the e2e fake `test/e2e/supabase-falso.js` (608 lines, used by 23 spec files); the unit fake `clienteFalso` in `test/unit/backend-supabase.test.js:17-203` (throws `função inesperada` / `tabela inesperada` for anything it does not know, lines 38, 201); and `backendEmMemoria` in `test/unit/storage-dias.test.js:20-65`.
- **pgTAP does not run in CI.** `.github/workflows/testes.yml` runs lint, unit and e2e only; `test/unit/espelho-do-banco.test.js:1` says so and is the only CI test that reads SQL files (and only the courses migration and `cursos.test.sql`, lines 15-16).
- **No realtime, no polling in the app.** Only the TV page polls (`js/painel.js:274`); the app reads requests at date open and after its own agenda changes (`js/views/selos.js:38-45`, callers `js/actions.js:326`, `js/main.js:139`, `js/eventos/agenda.js:120,153`).

Migrations, in application order (file → what it creates or replaces):

| # | File | Content |
|---|---|---|
| 1 | `20261110191032_documentos_e_perfis.sql` | enum `perfil_acesso` ('operador','gestor'); `perfis`; `perfil_atual()`; `documentos`; `salvar_documento` |
| 2 | `20261110201618_dias_e_historico.sql` | `documentos_chave_check` widened (+`'cadastro'`); `dias`; `salvar_dia`; `historico`; `registrar_historico`; `importar_historico` |
| 3 | `20261110202010_historico_autor.sql` | `historico.autor`; `registrar_historico` replaced |
| 4 | `20261110205345_documentos_antigos_somente_copia.sql` | `salvar_documento` replaced: phase-2 documents refuse once `cadastro` exists |
| 5 | `20261110213600_formato_nao_regride.sql` | `esquema_do_conteudo`; format guard in `salvar_documento` and `salvar_dia` |
| 6 | `20261110222505_perfil_secretaria.sql` | enum value `'secretaria'` (own file) |
| 7 | `20261110222506_agenda_de_solicitacoes.sql` | `solicitacoes`; `prazo_da_agenda_permite`; `registrar_solicitacao` (9 args); `cancelar_solicitacao` |
| 8 | `20261111122857_perfil_administrador.sql` | enum value `'administrador'` (own file) |
| 9 | `20261111122858_contas_e_administracao.sql` | `perfil_atual()` replaced (administrador counts as operador); `administrador_atual`; `listar_contas`; `criar_conta`; `excluir_conta` |
| 10 | `20261113140000_leitura_por_perfil.sql` | `le_a_escala()`; the read policies of `documentos`, `dias`, `historico`, `solicitacoes` dropped and recreated |
| 11 | `20261113150000_dados_pessoais.sql` | `cpf_valido`; `dados_pessoais`; `le_dados_pessoais()`; `salvar_dados_pessoais` (3 args) |
| 12 | `20261113160000_perfil_painel.sql` | enum value `'painel'` (own file) |
| 13 | `20261113160001_painel_do_dia.sql` | `nome_curto`; `painel_do_dia` |
| 14 | `20261113170000_nome_curto_com_numero.sql` | `nome_curto` replaced |
| 15 | `20261113180000_horas_dos_instrutores.sql` | `horas_dos_instrutores` |
| 16 | `20261114120000_resultados_de_missao.sql` | `resultados_de_missao`; `registrar_resultado`; `situacao_das_missoes` |
| 17 | `20261114120001_painel_com_etapa.sql` | `painel_do_dia` replaced (+`etapa`) |
| 18 | `20261114140751_painel_status_validos.sql` | `painel_do_dia` replaced (sanitised) |
| 19 | `20261114143242_formato_e_status_do_dia.sql` | `salvar_dia` and `salvar_documento` replaced (hint `formato`; a day never older than the cadastro; `fStatus` list); `dias_em_formato_antigo` |
| 20 | `20261114151953_dados_pessoais_versionados.sql` | `salvar_dados_pessoais` (5 args, new overload); `salvar_documento` replaced (deletes personal data of who left the cadastro) |
| 21 | `20261114222031_agenda_com_duracao.sql` | `solicitacoes.horas`; `registrar_solicitacao` (10 args, new overload) |
| 22 | `20261114230012_agenda_limite_de_locais.sql` | `registrar_solicitacao` (10 args) replaced: 6 local flights per time |
| 23 | `20261114230509_agenda_sem_domingo.sql` | `prazo_da_agenda_permite` replaced: no Sundays, Monday closes Saturday 10:00 |
| 24 | `20261115151734_repouso_conta_o_atraso.sql` | `horas_dos_instrutores` replaced |
| 25 | `20261117200000_cursos_e_missoes.sql` | 6 course tables, 8 functions, `resultados_de_missao_curso_check` widened, `registrar_resultado` replaced |
| 26 | `20261120150000_painel_do_dia_com_a_configuracao.sql` | `painel_do_dia` replaced (+`painel` setting from the cadastro) |

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

"Operador" below always means Operador **and** Administrador: `perfil_atual()` returns `'operador'` for both (`20261111122858_contas_e_administracao.sql:12`).

### 2.1 `public.perfis` (one row per account; all dates)
| Column | Constraint | Writer | Evidence |
|---|---|---|---|
| `usuario uuid` | PK, FK `auth.users(id)` on delete cascade | `criar_conta`, `scripts/criar-conta.mjs` | `20261110191032_documentos_e_perfis.sql:8` |
| `perfil public.perfil_acesso` | not null | same | `:9` |
| `nome text` | not null default `''` | same | `:10` |
| `criado_em timestamptz` | not null default `now()` | default | `:11` |
Read: each account reads only its own row (policy "cada conta lê o próprio perfil", `:19-21`); the app reads it at login (`js/sessao.js:128`, `js/painel.js:88`).

### 2.2 `public.documentos` (all dates)
Columns: `chave text` PK with `check (chave in ('cadastro', 'estado', 'escala', 'historico', 'bi'))` (`20261110201618_dias_e_historico.sql:5-7`); `conteudo jsonb not null`; `versao integer not null default 1 check (versao > 0)`; `atualizado_por uuid` FK `auth.users` on delete set null; `atualizado_em timestamptz not null default now()` (`20261110191032_documentos_e_perfis.sql:38-44`). Writer: `salvar_documento` only (Operador). `estado`, `escala`, `historico`, `bi` are the phase-2 copies: refused once `cadastro` exists (`20261114151953_dados_pessoais_versionados.sql:137-140`).

Keys of the `cadastro` document, as the client writes them (`js/dias.js:38-54`, plus `esquema` at `js/storage.js:232`):
| Key | Scope | What SQL reads of it |
|---|---|---|
| `esquema` (number) | all dates | the format guard (`esquema_do_conteudo`), `salvar_curso` and `importar_cursos` (compared with `formato_dos_cursos()` = 24) |
| `nid` | all dates | nothing (only `scripts/semear-dias-previa.mjs:82-83` updates it directly) |
| `ins[]`: `id`, `nm`, `lv?`, `kg`, `hab[]`, `horasExternas?` | all dates | only `id` and `nm`, in `salvar_dados_pessoais` (`20261114151953_dados_pessoais_versionados.sql:44-48`) and in the personal-data clean-up of `salvar_documento` (`:164-170`) |
| `stu[]`: `id`, `nm`, `kg`, `bl[]`, `voaCom?`, `curso?` | all dates | only `id` and `nm`, same two places |
| `frota[]`, `horarios`, `limites`, `cursos` (frozen copy) | all dates | nothing |
| `painel` (`quadro`, `listas`, `colunas[]`) | all dates | `painel_do_dia` (`20261120150000_painel_do_dia_com_a_configuracao.sql:37-52`) |

### 2.3 `public.dias` (one row per date)
Columns: `data date` PK; `conteudo jsonb not null`; `versao integer not null default 1 check (versao > 0)`; `atualizado_por uuid`; `atualizado_em timestamptz` (`20261110201618_dias_e_historico.sql:11-17`). Writer: `salvar_dia` only (Operador); `scripts/semear-dias-previa.mjs:87` inserts directly, preview only.

Keys of a day document, as the client writes them (`js/dias.js:55-72`; `resultado` and `esquema` added at `js/storage.js:233,241`):
| Key | What SQL reads of it |
|---|---|
| `esquema` | the format guard |
| `fStatus` (`{fKey: status}`) | validated on save (`20261114143242_formato_e_status_do_dia.sql:29-34`); read by `painel_do_dia` and `horas_dos_instrutores` |
| `fObs` (`{fKey: {motivo, novoInicio, texto}}`) | `painel_do_dia` (`motivo` from a list, `novoInicio`), `horas_dos_instrutores` (`novoInicio`) |
| `resultado.out[]` (the saved schedule rows) | `painel_do_dia`: `fKey`, `classKey`, `isGround`, `a`, `b`, `r`, `eqType`, `s`, `ins`, `mis`, `etapa`, `status` (`20261120150000_...:61-75`); `horas_dos_instrutores`: `fKey`, `insId`, `h`, `eqType`, `a`, `b`, `status` (`20261115151734_repouso_conta_o_atraso.sql:11-38`) |
| `win`, `av`, `ins{id:{on,aw}}`, `pedidos{id:{fly,mis,eq,p1,p2,nb,ss,pr,jan,etapa,solicitacao,insId,cursoDaEtapa,extra[]}}`, `horas`, `filas`, `hangar`, `fixos`, `aprovacao`, `criterios`, `importadas` | **nothing**: grep of all migrations for the quoted keys `'aw'`, `'win'`, `'pedidos'`, `'importadas'`, `'av'`, `'filas'`, `'hangar'`, `'fixos'`, `'aprovacao'`, `'criterios'`, `'frota'`, `'horarios'`, `'limites'`, `'cursos'`, `'fly'`, `'extra'`, `'bl'`, `'voaCom'`, `'hab'`, `'kg'`, `'jan'`, `'p1'`, `'p2'` returns 0 lines each |

### 2.4 `public.historico` (per date; append-only)
`id bigint identity` PK; `data date` (nullable); `registrado_em timestamptz not null default now()`; `usuario uuid` FK on delete set null; `tipo text not null check (tipo in ('inc', 'exc', 'mod'))`; `descricao text not null check (char_length(descricao) between 1 and 500)`; `reverter jsonb`; `reverte bigint` FK `historico(id)`; `importado boolean not null default false` (`20261110201618_dias_e_historico.sql:64-74`); `autor text` (`20261110202010_historico_autor.sql:3`). Index `historico_data_idx (data, registrado_em desc)`. Writers: `registrar_historico` (Operador), `importar_historico` (Operador, once), and **`salvar_dados_pessoais` (5 args) inserts directly** for whoever it accepts, the Secretaria included (`20261114151953_...:110-116`).

### 2.5 `public.solicitacoes` (one row per request; the date is a column)
See 5.3 for every column. Writers: `registrar_solicitacao` (both overloads) and `cancelar_solicitacao`; rows are never deleted or edited apart from the three cancel columns.

### 2.6 `public.dados_pessoais` (one row per person; all dates)
See 5.4. Writers: `salvar_dados_pessoais` (both overloads) and the delete inside `salvar_documento`.

### 2.7 `public.resultados_de_missao` (append-only; all dates, `data` is the flight's date)
`id bigint identity` PK; `aluno integer not null check (aluno > 0)`; `curso text not null check (curso ~ '^[A-Z][A-Z0-9-]{0,8}[A-Z0-9]$')` (`20261117200000_cursos_e_missoes.sql:630-632`); `missao text not null check (missao ~ '^[A-Z0-9][A-Z0-9.-]{0,14}$')`; `resultado text not null check (resultado in ('aprovado', 'reprovado', 'pendente'))`; `data date not null`; `voo text check (voo ~ '^[0-9]+_[0-9]+_[0-9]+$')` (nullable); `registrado_em`; `registrado_por text` (`20261114120000_resultados_de_missao.sql:5-15`). Writer: `registrar_resultado` (Operador). `voo` may be null (pgTAP "sem o voo também vale", `resultados.test.sql:41`).

### 2.8 Course tables (all dates)
`cursos` (`sigla` PK, `nome`, `ordem`, `ativo`, `versao`, `atualizado_em`, `atualizado_por`), `fases_do_curso`, `missoes_do_curso` (with `trecho`), `requisitos_das_fases`, `requisitos_das_missoes`, `versoes_dos_cursos` (`20261117200000_cursos_e_missoes.sql:65-147`). Writers: `salvar_curso` (Administrador only) and `importar_cursos` (Operador, only while the cadastro format is below 24). Not touched by the redesign request.

### 2.9 Outside the database
- `auth.users` / `auth.identities`: written by `criar_conta` (`20261111122858_...:79-87`), `excluir_conta` (`:109`) and `scripts/criar-conta.mjs:31-46`.
- Secret `REDEMET_API_KEY` for the Edge Function (`supabase/functions/meteorologia/index.ts:11`).
- **Nothing records an export** (CSV, PDF, Excel): `js/export.js` only shows toasts (`js/export.js:34,153-154`) and has no `gravarAlteracao`, History or `ApiClient` call (grep).

## 3. Controls inventory

The server has no on-screen control; the screens are in the other maps. For cross-reference only, the controls that reach the server **outside** `salvar_dia` / `salvar_documento` (the `gravarAlteracao` path):

| Label | Element | Handler | Server object | Profiles |
|---|---|---|---|---|
| "Registrar pedido" / "Registrar mesmo assim" | `#form-agenda` submit (`index.html:281`) | `registrarPedido(false)`, `js/eventos/agenda.js:67-121,133` | `registrar_solicitacao` (10 args) | `podeEditarAgenda()`: operador, administrador, secretaria (`js/views/agenda.js:23`) |
| "Exceção da Coordenação" | `#ag-excecao` (`index.html:289`) | `registrarPedido(true)`, `js/eventos/agenda.js:134` | same, `p_excecao = true` | `podeUsarExcecao()`: operador, administrador (`js/views/agenda.js:24`) |
| "Cancelar" (a request) | `button[data-act="cancelar-pedido"][data-id]` (`js/views/agenda.js:164`) | `cancelarPedido`, `js/eventos/agenda.js:138-155` (`confereAPermissao: true`) | `cancelar_solicitacao` | as "Registrar pedido" |
| "Importar da agenda" / "Importar N pedidos para a demanda" | `#importar-agenda` (`index.html:302`), `#agenda-importar` (`index.html:292`) | `importarDaAgenda`, `js/eventos/agenda.js:31-61` | reads `solicitacoes`, then `gravarAlteracao` | operador, administrador (`podeImportar`, `js/views/agenda.js:26`) |
| month and day of the Agenda calendar | `[data-cal="mes"]`, `[data-cal="dia"][data-dia]` (`js/views/agenda.js:126-133`) | `js/eventos/agenda.js:18-27` | reads `solicitacoes` for the month grid (`js/views/agenda.js:65-74`) | every profile that reads the schedule |
| "Dados pessoais" | `button.so-dados[data-dados="aluno:<id>"]` / `"instrutor:<id>"` (`js/views/cadastros.js:115,283`) | `abrirPainelDeDados`, `js/views/dados-pessoais.js:54-79` | reads `dados_pessoais` | `veDadosPessoais`: operador, administrador, secretaria (`js/perfis.js:12`; CSS `css/app.css:237`) |
| "Salvar" (personal data) | `#form-dados` submit (`js/views/dados-pessoais.js:96-101`) | `salvarPainelDeDados`, `js/views/dados-pessoais.js:127-153` | `salvar_dados_pessoais` (5 args) | same |
| result of a flight (aria-label "Resultado de <aluno> em <missão>") | `select.res-sel[data-resultado="<fKey>"]` (`js/views/etapas.js:184`) | `change` listener, `js/eventos/escala.js:236-262` | `registrar_resultado` (with `voo = fKey`, `data = DATA`) | operador, administrador |
| new account / delete account | `#form-nova-conta`, `excluirConta` | `js/eventos/conta.js:46-68` | `criar_conta`, `excluir_conta` | administrador |

## 4. Rules and the tests that pin them (file and test name)

| Rule (SQL) | pgTAP (file: test text) | JS mirror and its tests |
|---|---|---|
| Only Operador/Administrador save the cadastro and a day (`20261114151953_...:133-135`, `20261114143242_...:18-20`) | `acesso.test.sql`: 'gestor não grava', 'conta sem perfil não grava', 'anônimo não executa salvar_documento'; `dias-e-historico.test.sql`: 'gestor não grava escalas'; `agenda.test.sql`: 'a secretaria não altera a escala'; `contas.test.sql`: 'administrador grava a escala'; `painel.test.sql`: 'painel não grava a escala' | fake `test/e2e/supabase-falso.js:458`; `ApiClient.readOnly` (`js/storage.js:230`) |
| Optimistic version (`p_versao_lida`; conflict = PT409 without hint) | `acesso.test.sql`: 'versão desatualizada é rejeitada (outra pessoa gravou antes)', 'criar um documento que já existe também é conflito'; `dias-e-historico.test.sql`: 'versão desatualizada é rejeitada', 'criar uma data que já existe é conflito' | `test/unit/backend-supabase.test.js:248` 'conflito: avisa, não grava mais nada e responde false' |
| Format guard (5.2) | `formato.test.sql`, all 19 checks | `test/unit/backend-supabase.test.js:262` 'recusa pelo formato (uma versão mais nova do app atualizou os dados): o conflito diz que é o formato'; fake `supabase-falso.js:216-229,470-475` |
| Phase-2 documents are copies once `cadastro` exists | `dias-e-historico.test.sql`: 'depois da conversão (o cadastro existe), gravar um documento da fase 2 é conflito: a aba antiga pede para recarregar' | fake `supabase-falso.js:461` |
| A day only carries statuses of the list, on flight keys | `formato.test.sql`: 'status da lista são aceitos', 'um status fora da lista é recusado', 'um status numa chave que não é de voo é recusado' | fake `supabase-falso.js:217-219,473` |
| History only grows; author name kept after the account is deleted | `dias-e-historico.test.sql`: 'ninguém altera entradas do histórico', 'a importação acontece uma vez só'; `contas.test.sql`: 'o histórico dele continua, com o nome do autor' | - |
| Who reads (`le_a_escala`) | `leitura.test.sql` (40): `policies_are` on `documentos`, `dias`, `historico`, `solicitacoes`, then operador / administrador / gestor / secretaria read, 'conta sem perfil não lê …', 'anônimo não acessa …'; `painel.test.sql`: 'painel não lê os documentos / os dias / o histórico / a agenda / os dados pessoais' | fake `supabase-falso.js:266-270,315-334` |
| Agenda deadline, Sunday, Monday | `agenda.test.sql` lines 24-30 (7 checks, e.g. 'amanhã: encerrado às 13:00', '16:30 UTC é 13:30 em São Paulo'); `agenda-prazo.test.sql` (9: 'domingo nunca', 'segunda: até sábado 09:59', 'segunda: encerrado sábado às 10:00', 'segunda: na sexta à tarde ainda pode', 'segunda: no domingo já fechou', 'terça: no domingo pode', 'terça: encerrado segunda às 13:00', 'sábado: até sexta 12:59', '16:30 UTC é 13:30 em São Paulo') | `prazoDaAgendaPermite`, `js/agenda.js:32-43`; `test/unit/agenda.test.js:19,37` repeat the same instants by hand |
| Who registers, the exception | **only on the legacy 9-arg overload**: `agenda.test.sql`: 'secretaria registra um pedido dentro do prazo', 'fora do prazo: recusado' (PT403), 'a secretaria não usa a exceção da coordenação' (42501), 'operador registra fora do prazo pela exceção da coordenação', 'o pedido fica marcado como exceção', 'gestor não registra pedidos'; `contas.test.sql`: 'administrador usa a exceção da coordenação' | fake `supabase-falso.js:369-400`; `test/e2e/agenda-compartilhado.spec.js:49,80,92`; `test/unit/backend-local.test.js:97` |
| Specific time and duration (10 args) | `agenda-horas.test.sql` (11): 'registra o pedido com a duração', 'o Ground tem sempre 01h30', 'o pedido novo é num horário específico (não por período)', 'a duração vai até 5 h', 'a duração é maior que zero', 'a duração é obrigatória', 'a função antiga continua enquanto o app anterior estiver no ar' | `js/backends/local.js:161-164`; `test/unit/backend-local.test.js:103` |
| 6 local flights per time (10 args) | `agenda-locais.test.sql` (5): 'seis voos locais às 08:20', 'o sétimo voo local no mesmo horário é recusado', 'outra missão no mesmo horário passa', 'outro horário passa', 'com um cancelado, abre a vaga' | `vagaDeVooLocal`, `js/agenda.js:145-152`; `test/unit/agenda.test.js:343-353`; `test/unit/backend-local.test.js:114` |
| Personal data (5.4) | `dados-pessoais.test.sql` (47) | `gravarDadosPessoais`, `js/dados-pessoais.js:87-113`; `test/unit/dados-pessoais.test.js:64-89`; `test/e2e/dados-pessoais.spec.js` |
| The TV sees only today's board, sanitised | `painel.test.sql` (58) | `quadroDoDia`, `js/quadro.js:146-167`; `test/unit/quadro.test.js:258` |
| Instructor hours and rest | `limites.test.sql` (8) | `acumularHoras`, `js/limites.js:55-69`; `test/unit/limites.test.js:38,54` |
| Results append-only, course must exist | `resultados.test.sql` (27) | `validarRegistro`, `js/resultados.js:34-41`; `test/unit/resultados.test.js:30,42` |
| Course programs | `cursos.test.sql` (91) | `test/helpers/casos-do-programa.js` (47 cases: 43 `salvar`, 4 `importar`, 35 refusals) run against `js/programa.js`, the local backend and the fake; `test/unit/espelho-do-banco.test.js` ties them to the SQL text |
| Accounts | `contas.test.sql` (28) | fake `supabase-falso.js:349-366`; `test/e2e/contas.spec.js` |

Repo rules touched in this area: tests use fictitious names only (pgTAP: 'Aluno 1000', 'Ana Souza', 'Instrutor 07', e-mails at `*.acpm.invalid`; fake accounts at `@teste.acpm`, `test/e2e/supabase-falso.js:20-27`); personal data stays out of the History by construction (the server writes field labels only: `20261114151953_...:91-97,111`; pinned by 'o histórico registra só os nomes dos campos que mudaram', `dados-pessoais.test.sql:66-68`) and out of the TV board ('sem o peso (nem o que o quadro não mostra)', `painel.test.sql:93`); `registrar_solicitacao`, `cancelar_solicitacao`, `salvar_dados_pessoais`, `registrar_resultado` and `salvar_curso` are server writes that do **not** pass through `gravarAlteracao` today.

## 5. Answers

### 5.1 Inventory

**Profiles.** `public.perfil_acesso` has five values: `'operador'`, `'gestor'` (`20261110191032_...:5`), `'secretaria'` (`20261110222505_perfil_secretaria.sql:3`), `'administrador'` (`20261111122857_perfil_administrador.sql:3`), `'painel'` (`20261113160000_perfil_painel.sql:4`). Each new value has its own one-statement migration because "Valor novo de enum fica numa migração própria: só pode ser usado depois de gravado" (`20261110222505_...:2`). An account without a `perfis` row sees nothing.

**How a profile is read in SQL** (all `stable security definer set search_path = ''`, executable by `authenticated`):
| Function | Body | Evidence |
|---|---|---|
| `public.perfil_atual() returns public.perfil_acesso` | `select case when perfil = 'administrador' then 'operador'::public.perfil_acesso else perfil end from public.perfis where usuario = (select auth.uid())` (null without a profile) | `20261111122858_...:5-14` |
| `public.administrador_atual() returns boolean` | `exists (... perfil = 'administrador')` | `:17-27` |
| `public.le_a_escala() returns boolean` | `coalesce(public.perfil_atual()::text in ('operador', 'gestor', 'secretaria'), false)` | `20261113140000_leitura_por_perfil.sql:7-17` |
| `public.le_dados_pessoais() returns boolean` | `coalesce(public.perfil_atual()::text in ('operador', 'secretaria'), false)` | `20261113150000_dados_pessoais.sql:55-65` |

The five role-check idioms: `if public.perfil_atual() is distinct from 'operador'` (Operador + Administrador); `quem is null or quem not in ('secretaria', 'operador')` (agenda); `if not public.administrador_atual()`; `if not public.le_dados_pessoais()`; `if public.perfil_atual() is null` (any profile, `painel_do_dia`). The client mirrors them only to decide what the screen shows (`js/perfis.js:1-12`: "O servidor confere tudo de novo").

**Policies (final state; all `for select to authenticated`; no insert/update/delete policy exists):**
| Table | Policy name | `using` | Evidence |
|---|---|---|---|
| `perfis` | "cada conta lê o próprio perfil" | `usuario = (select auth.uid())` | `20261110191032_...:19-21` |
| `documentos`, `dias`, `historico`, `solicitacoes` | "perfis da escala leem" | `(select public.le_a_escala())` | `20261113140000_...:19-37` |
| `dados_pessoais` | "operadores e secretaria leem" | `(select public.le_dados_pessoais())` | `20261113150000_...:67-69` |
| `resultados_de_missao` | "quem lê a escala lê os resultados" | `le_a_escala()` | `20261114120000_...:24-26` |
| `cursos` / `fases_do_curso` / `missoes_do_curso` / `requisitos_das_fases` + `requisitos_das_missoes` / `versoes_dos_cursos` | "quem lê a escala lê os cursos" / "… as fases" / "… as missões" / "… os requisitos" / "… as versões" | `le_a_escala()` | `20261117200000_...:155-195` |

**Grants.** Every table: `enable row level security` and `revoke all on … from anon`. Tables created up to 2026-11-13 (`perfis`, `documentos`, `dias`, `historico`, `solicitacoes`, `dados_pessoais`) have no revoke for `authenticated`, so they keep its default table privileges (inferred: no migration grants or revokes them; `config.toml:20-24` describes the default exposure) and are closed only by the absence of write policies: a direct insert raises 42501 and a direct update or delete touches no row (`acesso.test.sql:41-44`, `dados-pessoais.test.sql:102-103`). Tables created from 2026-11-14 on add `revoke insert, update, delete, truncate on … from authenticated` (`20261114120000_...:22`, `20261117200000_...:157,164,171,178,185,192`), so update and delete also raise 42501 (`resultados.test.sql:61-62`). API functions: `revoke execute … from public, anon; grant execute … to authenticated;`. Internal helpers: `revoke execute … from public, anon, authenticated` (`esquema_do_conteudo`, `formato_dos_cursos`, `missao_e_recurso_validos`, `programa_do_curso`, `assinatura_do_programa`, `gravar_programa`). `cpf_valido` has no revoke at all (`20261113150000_...:6-32`).

**Functions (final definition; SD = `security definer`; every one has `set search_path = ''`):**
| Signature → returns | SD | Who may call (check) | Errors (errcode, hint) | Final definition |
|---|---|---|---|---|
| `salvar_documento(p_chave text, p_conteudo jsonb, p_versao_lida integer)` → `integer` | yes | Operador; 42501 'somente operadores podem alterar a escala' | PT409 hint `formato` (phase-2 key after the cadastro exists; older format); PT409 no hint (version); 23514 (unknown `chave`, table check) | `20261114151953_...:124-173` |
| `salvar_dia(p_data date, p_conteudo jsonb, p_versao_lida integer)` → `integer` | yes | Operador; same message | PT409 hint `formato`; 23514 'status de voo fora da lista'; PT409 no hint | `20261114143242_...:9-53` |
| `dias_em_formato_antigo(p_esquema integer)` → `jsonb` | yes | Operador; 42501 'somente operadores atualizam o formato dos dados' | - | `20261114143242_...:98-113` |
| `esquema_do_conteudo(p_conteudo jsonb)` → `integer` | no (immutable) | internal | - | `20261110213600_...:7-15` |
| `registrar_historico(p_data date, p_tipo text, p_descricao text, p_reverter jsonb default null, p_reverte bigint default null)` → `bigint` | yes | Operador | 23514 (table checks) | `20261110202010_...:5-28` |
| `importar_historico(p_data date, p_entradas jsonb)` → `integer` | yes | Operador | - (returns 0 the second time) | `20261110201618_...:109-134` |
| `prazo_da_agenda_permite(p_data date, p_agora timestamptz)` → `boolean` | no (stable) | `authenticated` | - | `20261114230509_...:4-18` |
| `registrar_solicitacao(p_data date, p_aluno integer, p_aluno_nome text, p_missao text, p_janela text, p_horario text, p_horas numeric, p_registrado_por text, p_observacao text, p_excecao boolean)` → `bigint` | yes | secretaria, Operador; 42501 | 22023 hint `horario`; 22023 hint `horas`; PT422 hint `locais`; PT403; 42501 (exception by a non-operador); 23514 (table checks) | `20261114230012_...:4-60` |
| `registrar_solicitacao(p_data, p_aluno, p_aluno_nome, p_missao, p_janela, p_horario, p_registrado_por, p_observacao text default null, p_excecao boolean default false)` → `bigint` (**legacy**) | yes | secretaria, Operador | PT403; 42501; 23514. No time, duration or local-limit rule | `20261110222506_...:47-85` |
| `cancelar_solicitacao(p_id bigint, p_cancelada_por text)` → `void` | yes | secretaria, Operador; 42501 'somente a secretaria e os operadores cancelam pedidos da agenda' | P0002 'pedido % não encontrado ou já cancelado'; 23514 (empty name) | `20261110222506_...:87-106` |
| `listar_contas()` → table; `criar_conta(p_email text, p_senha text, p_perfil public.perfil_acesso, p_nome text)` → `uuid`; `excluir_conta(p_usuario uuid)` → `void` | yes | Administrador; 42501 'somente administradores gerenciam contas' | 22023, 23505, P0002 | `20261111122858_...:29-116` |
| `cpf_valido(p_cpf text)` → `boolean` | no (immutable strict) | anyone (no revoke) | - | `20261113150000_...:6-32` |
| `salvar_dados_pessoais(p_tipo text, p_id integer, p_dados jsonb, p_atualizado_em timestamptz, p_data date)` → `jsonb` | yes | `le_dados_pessoais()` | see 5.4 | `20261114151953_...:13-121` |
| `salvar_dados_pessoais(p_tipo text, p_id integer, p_dados jsonb)` → `void` (**legacy**) | yes | `le_dados_pessoais()` | 42501, 22023, 23505; no version, no cadastro check, no History | `20261113150000_...:73-139` |
| `nome_curto(p_nome text)` → `text` | no (immutable) | `authenticated` | - | `20261113170000_...:3-15` |
| `painel_do_dia()` → `jsonb` | yes (stable) | any profile; 42501 'sem acesso ao painel' | - | `20261120150000_...:9-98` |
| `horas_dos_instrutores(p_data date)` → `jsonb` | **security invoker** | whoever RLS lets read `dias`; the TV gets `{}` | - | `20261115151734_...:4-43` |
| `registrar_resultado(p_aluno integer, p_curso text, p_missao text, p_resultado text, p_data date, p_voo text)` → `bigint` | yes | Operador; 42501 'somente operadores registram resultados' | 23514 'curso desconhecido'; 23514 (table checks) | `20261117200000_...:635-658` |
| `situacao_das_missoes()` → `jsonb` | yes (stable) | `[]` unless `le_a_escala()` | - | `20261114120000_...:54-68` |
| `programa_dos_cursos()` → `jsonb` | yes (stable) | `[]` unless `le_a_escala()` | - | `20261117200000_...:480-492` |
| `salvar_curso(p_sigla text, p_versao_lida integer, p_curso jsonb, p_descricao text)` → `jsonb` | yes | Administrador; 42501 'somente o Administrador altera os cursos' | PT409 hint `formato`; PT409 hint `sigla`; PT409; P0002; 22023 with hints `descricao`, `limite`, `nome`, `ativo`, `sigla`, `id`, `modulo`, `regra`, `fase`, `codigo`, `mis`, `dispensada`, `avaliacao`, `trecho`, `requer`; 23505 hint `codigo`; 23514 hint `codigo` | `:497-565`, rules in `gravar_programa` `:266-474` |
| `importar_cursos(p_cursos jsonb, p_versao_do_cadastro integer)` → `integer` | yes | Operador | PT409; 22023 hint `limite` | `:571-625` |
| `formato_dos_cursos()` → `integer` (24), `missao_e_recurso_validos(p_mis text, p_eq text, p_nb numeric)`, `programa_do_curso(p_sigla text)`, `assinatura_do_programa(p_curso jsonb)`, `gravar_programa(p_sigla text, p_curso jsonb, p_substituir boolean)` | mixed | internal (no grant) | - | `:23-31, 35-62, 205-240, 244-260, 266-474` |

How the client treats the codes: PT409 locks the screen, and the hint `formato` picks the text "O app foi atualizado. Recarregue a página para continuar (a sua última alteração não foi salva)." (`js/backends/supabase.js:63-67`, `js/actions.js:138-145`); 401 waits for a new login (`js/backends/supabase.js:69-73`); status 0, 408, 429 or 5xx retries (`:15`); any other refusal of a save is final (`:74-78`). The agenda calls pass only `code`, not the hint (`:223,229`); personal data and courses pass `hint` as `campo` (`:32,261`).

### 5.2 The format guard

- **What stores the format:** the number `esquema` inside the JSON content itself, in `documentos.conteudo` (the cadastro) and in each `dias.conteudo`. There is no column for it. `esquema_do_conteudo` reads it: `case when jsonb_typeof(p_conteudo -> 'esquema') = 'number' then floor((p_conteudo ->> 'esquema')::numeric)::integer else 0 end` (`20261110213600_formato_nao_regride.sql:13`). The client writes `esquema: ESQUEMA` on every save (`js/storage.js:232-233`), with `ESQUEMA = 25` (`js/migracoes.js:13`).
- **How the refusal happens:** inside the two save functions (no trigger).
  - `salvar_dia`: refuses when `esquema_do_conteudo(p_conteudo) < greatest(<the stored day's format, 0 if none>, <the cadastro's format, 0 if none>)`, with `errcode = 'PT409', hint = 'formato'` and the message 'a escala de % está num formato mais antigo que o dos dados; recarregue a página' (`20261114143242_...:22-27`). So a **new** day cannot be created below the cadastro's format either.
  - `salvar_documento`: refuses when the content's format is below the stored format of the same key, PT409 hint `formato`, 'o documento % está num formato mais novo; recarregue a página' (`20261114151953_...:142-146`).
- The server never refuses a **newer** format and knows no target number: it only compares with what is stored. The only format number in SQL is `formato_dos_cursos()` = 24 (`20261117200000_...:23-30`), kept equal to `FORMATO_DOS_CURSOS` by `test/unit/espelho-do-banco.test.js:77-85`.
- **The guard covers only these two functions** (plus `salvar_curso`, which waits while the cadastro is below 24, `20261117200000_...:513-516`). `registrar_solicitacao`, `cancelar_solicitacao`, `salvar_dados_pessoais`, `registrar_resultado` and `registrar_historico` carry no format and are never refused for it.
- How a new format reaches the stored data: the first Operador open runs `ApiClient.atualizarFormatoGravado` (`js/storage.js:385-399`, called at `js/main.js:103`): it asks `dias_em_formato_antigo(ESQUEMA)`, then reads and re-saves **every** such day one by one, then the cadastro last. From that save on, any tab with a lower `ESQUEMA` gets the `formato` refusal on its next save. A format step that changes no data exists exactly for this fence (`js/migracoes.js:170-175, 207-213`).
- pgTAP: `formato.test.sql` (19), e.g. 'voltar o dia a um formato mais antigo é recusado (aba com a versão anterior do app)', 'versão de formato que não é número conta como a mais antiga', 'um dia novo num formato mais antigo que o do cadastro é recusado (aba com a versão anterior do app)', 'com a dica "formato"', 'quando outra pessoa gravou antes, a recusa vem sem a dica', 'as datas num formato anterior ao pedido'.

### 5.3 `solicitacoes` in full

Columns (`20261110222506_agenda_de_solicitacoes.sql:6-24`; `horas` from `20261114222031_agenda_com_duracao.sql:8`):
| Column | Type and check |
|---|---|
| `id` | `bigint generated always as identity primary key` |
| `data` | `date not null` |
| `aluno` | `integer not null` (the cadastro id; **no check that the student exists**) |
| `aluno_nome` | `text not null check (char_length(aluno_nome) between 1 and 80)` (a snapshot of the name) |
| `missao` | `text not null check (char_length(missao) between 1 and 60)` (free text, not checked against the mission list) |
| `janela` | `text not null check (janela in ('manha', 'tarde', 'noite', 'horario'))` |
| `horario` | `text check (horario ~ '^[0-2][0-9]:[0-5][0-9]$')` |
| `horas` | `numeric(3,1) check (horas is null or (horas > 0 and horas <= 5))` |
| `observacao` | `text check (char_length(observacao) <= 300)` |
| `registrado_por` | `text not null check (char_length(registrado_por) between 1 and 80)` |
| `registrado_em` | `timestamptz not null default now()` |
| `usuario` | `uuid references auth.users (id) on delete set null` |
| `conta` | `text` (profile name or e-mail of the account) |
| `excecao` | `boolean not null default false` |
| `cancelada_em`, `cancelada_por` (`check (char_length(cancelada_por) between 1 and 80)`), `cancelada_usuario` | nullable |
| table check | `check ((janela = 'horario') = (horario is not null))` |
Index `solicitacoes_data_idx (data, registrado_em)`. Comment: 'Agenda de solicitações de voo. Gravação somente pelas funções registrar_solicitacao e cancelar_solicitacao.' Policy: "perfis da escala leem" (operador, administrador, gestor, secretaria read every row and column). **No approval column, no version column, no update function**: a request is registered or cancelled, nothing else.

Rules of the function the app calls (10 args, `20261114230012_agenda_limite_de_locais.sql`), in the order they are checked:
1. Role (`:19-21`): `if quem is null or quem not in ('secretaria', 'operador')` → 42501 'somente a secretaria e os operadores registram pedidos na agenda'.
2. Specific time (`:22-24`): `if p_janela is distinct from 'horario' or p_horario is null` → 22023 hint `horario`.
3. Duration (`:25-29`): `if p_missao like 'Ground%' then v_horas := 1.5; elsif v_horas is null or v_horas <= 0 or v_horas > 5` → 22023 hint `horas` (`v_horas := round(p_horas, 1)`).
4. Local limit (`:30-40`): for `p_missao in ('Voo Local', 'Voo Solo', 'TGL (TMA)')`, `pg_advisory_xact_lock(hashtext('agenda-locais:' || p_data::text || ':' || p_horario))`, then if the count of rows with the same `data`, `janela = 'horario'`, same `horario`, `cancelada_em is null` and one of the three missions is `>= 6` → PT422 hint `locais`. Checked **before** the deadline, so the exception does not lift it; there is no override.
5. Deadline and exception (`:41-48`): `no_prazo := public.prazo_da_agenda_permite(p_data, now())`; `if not no_prazo then if not coalesce(p_excecao, false)` → PT403 'prazo encerrado: pedido para o dia seguinte só até as 13:00'; `if quem <> 'operador'` → 42501 'a exceção da coordenação é só para operadores'.
6. The row stores `excecao = not no_prazo` (`:55`): asking for the exception inside the deadline stores `false`.

Deadline, Sunday and Monday (`20261114230509_agenda_sem_domingo.sql:10-17`):
```sql
with prazo as (
  select p_agora at time zone 'America/Sao_Paulo' as agora,
         p_data - case when extract(isodow from p_data - 1) = 7 then 2 else 1 end as dia
)
select extract(isodow from p_data) <> 7
   and (agora::date < dia
        or (agora::date = dia and agora::time < case when extract(isodow from dia) = 6 then time '10:00' else time '13:00' end))
from prazo;
```
A Sunday is never inside the deadline; it is not a separate refusal. The Exceção da Coordenação therefore registers on a Sunday or on a past date (pgTAP registers on `current_date` with the exception, `agenda.test.sql:62`, `contas.test.sql:27`). The screen follows: on any closed date, a Sunday included, the submit is disabled and `#ag-excecao` shows for whoever operates (`js/views/agenda.js:210-212`), although the text above it reads 'O aeroclube não opera aos domingos: não há escala nem pedidos.' (`js/views/agenda.js:107`). The e2e test of the Sunday checks the text and the disabled submit, not the exception button (`test/e2e/agenda.spec.js:238-247`).

`cancelar_solicitacao` (`20261110222506_...:87-104`): secretaria or Operador; sets `cancelada_em = now()`, `cancelada_por = trim(p_cancelada_por)`, `cancelada_usuario = auth.uid()` where `cancelada_em is null`; otherwise P0002. Anyone of the two profiles cancels any request, whoever registered it.

Client readers of the table (every one): `js/backends/supabase.js:212` (`select('*')` with `gte`/`lte` on `data`, ordered by `data`, `registrado_em`), reached through `ApiClient.agenda` (`js/storage.js:280-282`) from `js/views/agenda.js:68` (month grid), `js/views/selos.js:41` (the open date, for the badge) and `js/eventos/agenda.js:36` (the import). Writers: `js/eventos/agenda.js:99` and `:147` only. Tests also read it (`test/e2e/publicado.spec.js:70`, as the TV account, expecting 0 rows). A query returns at most 1000 rows (`config.toml:19` `max_rows = 1000`; "uma consulta devolve no máximo 1000 linhas", `20261114143242_formato_e_status_do_dia.sql:7-8`), and the month read has no paging.

### 5.4 Personal data in full

Table (`20261113150000_dados_pessoais.sql:34-49`): `tipo text not null check (tipo in ('aluno', 'instrutor'))`; `id_cadastro integer not null check (id_cadastro > 0)`; `cpf text check (public.cpf_valido(cpf))`; `canac text check (canac ~ '^[0-9]{6}$')`; `nascimento date check (nascimento >= date '1900-01-01')`; `celular text check (celular ~ '^[1-9]{2}9[0-9]{8}$')`; `email text check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')`; `atualizado_em timestamptz not null default now()`; `atualizado_por text`; `primary key (tipo, id_cadastro)`; unique indexes `dados_pessoais_cpf_unico (tipo, cpf) where cpf is not null` and `dados_pessoais_canac_unico (tipo, canac) where canac is not null`. **There is no name column**: the only name is `nm` in the cadastro.

Versioning: the version is the row's `atualizado_em`. The save takes the value read (`p_atualizado_em`; null when the person had no row), locks the row (`select * into v_atual … for update`) and refuses with PT409 'os dados pessoais foram alterados por outra pessoa; abra de novo para ver a versão atual' when `v_atual.atualizado_em is distinct from p_atualizado_em` (`20261114151953_...:85-89`). The new stamp is `clock_timestamp()` (`:31`). Saving with every field empty deletes the row and returns `atualizado_em: null` (`:99-101`).

Who reads: `le_dados_pessoais()`, that is Operador, Administrador and Secretaria; the Gestor, the TV, an account without profile and anonymous do not (policy at `20261113150000_...:67-69`).

**The exact role check of `salvar_dados_pessoais`** (5 args, `20261114151953_dados_pessoais_versionados.sql:36-38`; the 3-arg overload has the same three lines at `20261113150000_dados_pessoais.sql:88-90`):
```sql
  if not public.le_dados_pessoais() then
    raise exception 'somente operadores e a secretaria alteram dados pessoais' using errcode = '42501';
  end if;
```
with `le_dados_pessoais()` = `select coalesce(public.perfil_atual()::text in ('operador', 'secretaria'), false)` (`20261113150000_...:62`). **The same function is the read policy's predicate**, so changing it changes reading and writing together.

The rest of the 5-arg function, in order: tipo/id (22023 'aluno ou instrutor inválido', `:39-41`); the person must be in the cadastro's `stu`/`ins` list, else P0002 '% que não está no cadastro' (`:43-51`); field checks, each 22023 with hint `cpf`, `canac`, `nascimento`, `celular`, `email` (`:53-77`); CPF and CANAC unique per type, 23505 with hint (`:78-83`); version (above); upsert or delete; then, if any field changed, **one History row written by the function itself**: `format('Dados pessoais de %s atualizados: %s', <nm>, <field labels>)`, `tipo = 'mod'`, on `coalesce(p_data, today in São Paulo)` (`:110-116`). Returns `{atualizado_em, atualizado_por, historico: {id, descricao} | null}` (`:117`).

Side rule: saving the cadastro deletes the personal data of everyone who is no longer in `stu` / `ins` (`20261114151953_...:164-170`).

**Every pgTAP case that pins the Secretaria's permission on personal data** (all in `supabase/tests/database/dados-pessoais.test.sql`; no other pgTAP file tests the Secretaria on this table):
| Line | Check text | What it asserts |
|---|---|---|
| 109 | 'secretaria grava' | `lives_ok` of `pg_temp.salvar('aluno', 1004, '{"email":"bia@exemplo.com"}')` as the secretaria account |
| 110-111 | 'a alteração da secretaria também vai para o histórico' | the History row 'Dados pessoais de Duda atualizados: E-mail' has `autor = 'Secretaria de teste'` |
| 112 | 'secretaria lê todos os dados pessoais' | `count(*) = 4` rows of `dados_pessoais` visible to her |
| 116-120 (depends on 109) | 'o operador grava o cadastro sem uma aluna e um instrutor', 'os dados pessoais de quem saiu do cadastro saem junto' | the student row removed there (Duda, 1004) is the one the Secretaria wrote |
| 1-5 (header), 105 (comment) | "Só operadores, administradores e a secretaria leem e gravam" / "Administrador e secretaria gravam e leem" | comments stating the rule |
Related, not about the Secretaria: line 43 'a versão antiga continua enquanto o app anterior estiver no ar' (`has_function` on the 3-arg overload); lines 124-128 gestor and no-profile neither read nor write; lines 134-135 anonymous.

Outside pgTAP the same permission is pinned by: `test/unit/perfis.test.js:12-13` ('dados pessoais: operadores, administradores e a secretaria; a TV da recepção só vê o painel'); `test/e2e/dados-pessoais.spec.js:114` ('a Secretaria vê Alunos e Instrutores e edita só os dados pessoais'), `:141` ('no celular, o cartão de cada pessoa tem o "Dados pessoais" da Secretaria, em Instrutores e em Alunos'), `:171` (the Secretaria opens Instrutores on Cadastro because "o trabalho dela ali são os dados pessoais", comment at `:169-170`), `:276` ('a alteração da secretaria vai para o histórico (só os nomes dos campos)'); the fake `test/e2e/supabase-falso.js:268` (`veDados`), `:330`, `:418`; the client gate `js/perfis.js:12`, `js/views/dados-pessoais.js:15,95`; CSS `css/app.css:237,1132`; README `README.md:13-15`.

### 5.5 How migrations and pgTAP files are written here

Migrations:
- **Name:** `supabase/migrations/<AAAAMMDDHHMMSS>_<nome_em_portugues_sem_acento>.sql`; applied in name order by `supabase db push`. An enum value goes in its own file with the timestamp just before the file that uses it (…222505 then …222506; …122857 then …122858; …160000 then …160001).
- **Header:** a Portuguese comment that says what and why, the compatibility with the live app, and what stays the same ("O resto continua igual"), e.g. `20261120150000_...:1-8`. Table comments via `comment on table … is '… Gravação somente por public.<função>.'`.
- **Expand-only:** new columns are nullable (`20261114222031_...:8`, `20261110202010_...:3`); a changed signature is a **new overload** and the old one stays for the live app (`20261114222031_...:6-7,10-13`); an unchanged signature is `create or replace` with the whole body repeated (`painel_do_dia` is written out four times: one `create` and three replaces; `salvar_documento` five times); a check is widened by `drop constraint` + `add constraint` (`20261110201618_...:5-7`, `20261117200000_...:630-632`); policies are replaced by `drop policy` + `create policy` (`20261113140000_...:19-37`). PLAN.md calls the courses migration "(expand only)" and lists the later contract as its own PR (`docs/PLAN.md:379,412`).
- **Functions:** `language plpgsql` (or `sql`), `security definer`, `set search_path = ''`, every object schema-qualified (`public.`, `auth.`, `extensions.`); then `revoke execute on function … from public, anon;` and `grant execute on function … to authenticated;`. A `create or replace` keeps the grants; the latest ones restate them (`20261120150000_...:97-98`).
- **Errors:** `raise exception '<frase em minúsculas, sem ponto final>' using errcode = '<código>'[, hint = '<campo>'];`. Codes in use: 42501, PT409, PT403, PT422, 22023, 23514, 23505, P0002.
- **Author and time:** the author is stored as text, `coalesce(nullif(p.nome, ''), u.email)` (`20261110202010_...:22`), so records survive the account; dates use `(now() at time zone 'America/Sao_Paulo')`.
- **Races:** `pg_advisory_xact_lock(hashtext('…'))` (`20261110201618_...:121`, `20261114230012_...:33`, `20261117200000_...:590`) and `select … for update` on the versioned row (`20261114151953_...:86`, `20261117200000_...:545,593`).
- A migration file is edited in place until it is applied: the courses file was created "não aplicada" (commit 91cc579) and changed by 69eb743 and ff29103; the painel file by three commits of 2026-11-20 (`git log -- supabase/migrations`).

pgTAP files:
- **Frame:** header comment; `begin; create extension if not exists pgtap with schema extensions; set local search_path = public, extensions; select plan(N);` … `select * from finish(); rollback;` (`acesso.test.sql:3-7,69-70`). Everything, including the deletes of preview data at the top (`delete from public.documentos;`, `delete from public.solicitacoes;`), is undone by the rollback.
- **A user of each profile:** `insert into auth.users (id, email, created_at, updated_at) values ('00000000-0000-4000-<bloco>-00000000000N', '<perfil>@<arquivo>.acpm.invalid', now(), now())` plus `insert into public.perfis (usuario, perfil, nome) values (…, '<perfil>', '<Perfil> de teste')`; the "sem-perfil" account gets no `perfis` row. Blocks in use: `a000…01-03` acesso, `a000…11-15` leitura, `a000…21-25` dados-pessoais, `a000…31-34` painel, `a000…41-43` limites, `a000…51-54` resultados, `b000` dias-e-historico, `c000` formato, `d000` agenda, `d100` agenda-horas, `d200` agenda-locais, `e000` contas, `f000` cursos.
- **Taking a profile:** `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);`; switching user is another `set_config`; owner again with `reset role;`; anonymous with `reset role; set local role anon; select set_config('request.jwt.claims', '{"role":"anon"}', true);` (`acesso.test.sql:28-29,62-64`).
- **Helpers live in `pg_temp`:** `pg_temp.dica(p_sql)` returns the hint or 'sem dica' (`formato.test.sql:13-24`); `pg_temp.erro(p_sql)` returns '<code> <hint>' and undoes the statement (`cursos.test.sql:39-54`); `pg_temp.desfeito` (`cursos.test.sql:108-123`); `pg_temp.salvar` saves personal data from the version read (`dados-pessoais.test.sql:32-36`); `pg_temp.painel_como`, `pg_temp.gravar_painel` (`painel.test.sql:142-150`).
- **Reserved test values:** dates in 2098/2099, students above 99000, courses `ZZ9` and `ZZ8`, and a date that is never a Sunday for the deadline: `(current_date + 5 + case when extract(isodow from current_date + 5) = 7 then 1 else 0 end)` (`agenda.test.sql:35`).
- **Assertions used:** `has_table`, `has_column`, `has_function`, `policies_are`, `ok`, `is`, `isnt`, `is_empty`, `results_eq`, `throws_ok(sql, errcode, null, descrição)`, `lives_ok`.

Checks per file (the `plan(N)` equals the number of assertion calls in every file, counted by grep):
| File | Checks | File | Checks |
|---|---|---|---|
| `acesso.test.sql` | 24 | `dias-e-historico.test.sql` | 38 |
| `agenda.test.sql` | 28 | `formato.test.sql` | 19 |
| `agenda-horas.test.sql` | 11 | `leitura.test.sql` | 40 |
| `agenda-locais.test.sql` | 5 | `limites.test.sql` | 8 |
| `agenda-prazo.test.sql` | 9 | `painel.test.sql` | 58 |
| `contas.test.sql` | 28 | `resultados.test.sql` | 27 |
| `cursos.test.sql` | 91 | **Total** | **433** |
| `dados-pessoais.test.sql` | 47 | | |

### 5.6 What the fake server models, and what keeps it equal to the SQL

`test/e2e/supabase-falso.js` answers Playwright routes for `https://acpm-teste.supabase.invalid` (`:18`, `:538`). Six fixed accounts, one per profile plus one without (`CONTAS`, `:20-27`). Role flags per request (`:266-270`): `operador` (operador, administrador), `veDados` (operador, administrador, secretaria), `leEscala` (operador, administrador, gestor, secretaria).

| Route | What the fake does | Differences from the SQL seen by reading |
|---|---|---|
| Auth: `/auth/v1/token` (password, refresh), `/auth/v1/user`, `/auth/v1/logout` | sessions, single-use refresh tokens, password and e-mail change (`:272-313`) | not SQL |
| `/functions/v1/meteorologia` | fixed METAR/TAF, 404 when "not deployed" (`:301-306`) | not SQL |
| GET `perfis` | own profile or `[]` (`:316`) | - |
| GET `documentos`, `dias`, `historico`, `solicitacoes` | `[]` unless `leEscala`; filters `eq`/`gte`/`lte`/`lt`, `order`, `limit`, 1000-row cap (`:79-99,318-327`) | - |
| GET `resultados_de_missao`, `dados_pessoais` | by `leEscala` / `veDados` (`:328-333`) | the course tables are not served (the app reads them by RPC) |
| `salvar_documento`, `salvar_dia` | version, format guard with hint, phase-2 refusal, status list, personal-data clean-up, injected failures (`:339-347,459-475`) | `salvar_dia` checks the status list before the format; the SQL does the format first |
| `listar_contas`, `criar_conta`, `excluir_conta` | Administrador only (`:349-366`) | no e-mail format check |
| `registrar_solicitacao`, `cancelar_solicitacao` | role; with `p_horas`: specific time, duration, 6-local limit; deadline through the app's own `prazoDaAgendaPermite`; exception for operador/administrador (`:369-400`) | PT422 answered with HTTP 400 (`:388`; the client only reads `code`, `js/eventos/agenda.js:104-111`); no 23514 for an empty "Registrado por"; `cancelada_usuario` not stored; a call without `p_horas` is accepted like the legacy overload |
| `horas_dos_instrutores` | `acumularHoras` of the app (`:402-405`) | shared JS, not SQL |
| `painel_do_dia` | `quadroDoDia` of the app plus `painelDoCadastro`; can play the pre-2026-11-20 function (`:116-135,407-414`) | "today" is the clock minus 3 h |
| `situacao_das_missoes`, `registrar_resultado` | `situacaoPorMissao`, `validarRegistro` (`:416,480-490`) | shared JS |
| `salvar_dados_pessoais` | `veDados`, then `gravarDadosPessoais` of the app; writes the History row (`:417-437`) | only the 5-arg behaviour |
| `programa_dos_cursos`, `salvar_curso`, `importar_cursos` | the app's `gravarCurso` / `importarProgramas` (`:440-457,494-505`) | covered by the shared cases |
| `dias_em_formato_antigo`, `registrar_historico`, `importar_historico` | (`:476-479,506-519`) | `registrar_historico` does not check `tipo` or the description |
| anything else | 404 'rota não simulada: …' (`:521`) | a new RPC must be added here or every shared-mode spec that reaches it fails |

Two more fakes follow the same contract and need the same additions: `clienteFalso` (`test/unit/backend-supabase.test.js:17-203`; its `registrar_solicitacao` only refuses dates before '2026-11-11', line 183-190, and it has no `dados_pessoais` table, line 32-39) and `backendEmMemoria` (`test/unit/storage-dias.test.js:20-65`).

Tests that keep it equal to the SQL:
- `test/unit/espelho-do-banco.test.js` (9 tests, in CI), **courses only**: 'missao_e_recurso_validos tem os tipos de missão de MIS, na mesma ordem, com os mesmos recursos'; 'o Ground é na Sala Ground, com 1,5 h; as horas vão até 5'; 'os trechos do Noturno da migração são os de NOTURNO, só no tipo Noturno'; 'formato_dos_cursos() devolve o FORMATO_DOS_CURSOS do app, imutável e fora do alcance da API'; 'o formato dos cursos é um passo do formato que o app grava, e o cadastro de antes passa por ele'; 'a migração compara o formato do cadastro com formato_dos_cursos(), sem nenhum número'; 'cada caso da gravação dos programas é uma verificação de cursos.test.sql (o nome é a descrição)'; 'cursos.test.sql grava os mesmos programas dos casos'; 'cada código de erro da migração, com a dica, tem um caso, e nenhum caso espera um erro que a migração não dá'.
- `test/unit/supabase-falso.test.js` (7 tests): 'salvar_curso e importar_cursos respondem como o banco nos casos de casos-do-programa.js (código, dica e status)' (the 47 shared cases), 'quem lê e quem grava: os perfis da escala leem, só o Administrador grava e só os operadores trazem o programa', 'documentosAtuais põe nas tabelas o programa que a conversão única deixa: o curso vazio fica sem fases', and four on the session.
- **For the agenda, personal data, the board and the hours there is no automated link to the SQL.** The fake and local mode share the app's own functions (`prazoDaAgendaPermite`, `gravarDadosPessoais`, `quadroDoDia`, `acumularHoras`), whose unit tests repeat the pgTAP cases by hand (`test/unit/agenda.test.js:19-48` uses the same instants as `agenda.test.sql:24-30` and `agenda-prazo.test.sql:9-17`). The only end-to-end check against a real database is the manual `test/e2e/publicado.spec.js` (needs the passwords, `:1-5`).

### 5.7 What new migrations would have to touch, and the deploy order

Fixed order of every schema change so far: preview (`supabase db push --remote`) → `npm run test:db` on the preview → production (`--remote=<ref de produção>`) → merge → first Operador open (`README.md:180-190`, `docs/PLAN.md:407-412`). The live app must work on the new schema, so each item states what the live app still calls.

**(a) An approval state for a pedido.**
- Table: new **nullable** columns on `public.solicitacoes` (for instance who approved, when, the account). The functions insert with explicit column lists (`20261114230012_...:50`), so a nullable column does not disturb them; a `not null` column without default would break the live app's inserts.
- Functions: one new function per transition (approve, and undo if wanted), in the house style: `security definer`, `set search_path = ''`, `if public.perfil_atual() is distinct from 'operador'` → 42501 for the default "Operador and Administrador", P0002 when the request does not exist or is cancelled, `revoke … from public, anon; grant … to authenticated`. `cancelar_solicitacao` needs a decision for an approved request (it has no such notion today). `registrar_solicitacao` (10 args) keeps its signature unless the registration gets new inputs; if an Operador's own request is to be born approved, that is a `create or replace` of the same signature.
- The 6-local count ignores approval today (`20261114230012_...:34-36`): the migration must say which states count.
- **The legacy 9-arg `registrar_solicitacao` still inserts** without the time, duration or local-limit rules (`20261110222506_...:47-85`): any rule added only to the 10-arg version is bypassable through it until it is dropped.
- Policy: nothing to change; all four schedule profiles already read every column.
- Live app with the new schema: it reads with `select('*')` (`js/backends/supabase.js:212`) and uses fields by name (`js/views/agenda.js:141-165`, `js/agenda.js:107-140`), so extra columns are ignored; "Importar da agenda" keeps importing unapproved requests until the merge.
- Existing rows: none has an approval. What the operator already accepted lives outside SQL's reach today, as the list `importadas` inside each day document (`js/dias.js:71`); requests imported by the live app between the production migration and the merge would be missed by a backfill written inside the migration.
- Also to update: pgTAP (a new file, or `agenda.test.sql`; next free user block `d300`), `test/e2e/supabase-falso.js` (`:369-400`), `clienteFalso` (`test/unit/backend-supabase.test.js:183-197`), `js/backends/local.js:153-193` (local mode keeps requests in `acpm4_agenda`), `js/backends/supabase.js`, `js/storage.js:279-290`, and `scripts/semear-dias-previa.mjs` (it seeds days with `pedidos` and no `solicitacoes` rows, `:61-71,87`).

**(b) The Secretaria no longer saving personal data.**
- The check to change is inside **both** overloads of `salvar_dados_pessoais` (`20261114151953_...:36-38`, `20261113150000_...:88-90`). Changing `le_dados_pessoais()` instead would also stop her **reading**, because the read policy uses it (`20261113150000_...:67-69`).
- So the migration is: a `create or replace` of the 5-arg function with a write check of its own (whole body repeated, about 105 lines), and either the same change in the 3-arg overload or its drop. The live app calls only the 5-arg one (`js/backends/supabase.js:258-260`).
- pgTAP edits in `dados-pessoais.test.sql`: lines 109-112 (three checks invert or go), the student removed at 116-120 needs a row written by someone else, line 43 if the 3-arg overload is dropped, the header and `plan(47)`.
- Live app between the production migration and the merge: the Secretaria still sees the "Dados pessoais" button and an enabled "Salvar" (`css/app.css:237`, `js/perfis.js:12`); her save now returns 42501, which the pane shows as "Não foi possível salvar. Verifique a conexão e tente de novo." (`js/views/dados-pessoais.js:140-145`: only `campo`, PT409 and P0002 have their own text). Reading keeps working if `le_dados_pessoais()` is untouched.
- Also to update: `js/perfis.js:12` and `test/unit/perfis.test.js:12-13`, `test/e2e/dados-pessoais.spec.js:114,141,171,276`, the fake (`supabase-falso.js:268,418`), `css/app.css:237,1132`, the pane's text (`js/views/dados-pessoais.js:95`), `README.md:13-15`, and `js/views/vistas.js:11` (her default view of Instrutores).

**(c) What the server knows about the day's format.**
- **No SQL reads `aw`, `win` or the requests inside the day** (2.3). Availability ranges replacing `ins[id].aw`, the removal of `win`, a cadastro-level "active" flag, resource requirements in `frota[]` and any Demanda field change are client data-format steps with **no migration**; the format guard fences old tabs once the first Operador saves the new number.
- What SQL does read from a day, and would break silently or loudly if the shapes changed:
  - `fStatus`: keys must match `^[0-9]+_[0-9]+_[0-9]+$` and values must be one of 'Pendente', 'Confirmado', 'Atrasado', 'Em Voo', 'Cancelado', 'Pousou', else `salvar_dia` raises 23514 'status de voo fora da lista' (`20261114143242_...:29-34`). A new status, or a flight key not made of three numbers (`chaveDoVoo`, `js/voo.js:4-5`), needs a migration **before** the app writes it.
  - `resultado.out[]` rows: `painel_do_dia` drops any row whose `fKey` does not match `^[0-9]{1,12}_[0-9]{1,6}_[0-9]{1,6}$` or whose `a`/`b` are not minutes of the day (`20261120150000_...:20,74`); `horas_dos_instrutores` sums `h` by `insId` only for `eqType in ('C152', 'C172', 'PA-34')` (`20261115151734_...:26`), a hard-coded list.
  - `resultados_de_missao.voo` has the same three-number check (`20261114120000_...:12`).
- The legal limits are not on the server: `limites` is a cadastro key evaluated in the browser (`js/limites.js:101-117`); "o Administrador pode mudá-los" is a screen rule (`js/views/cadastros.js:75`), while SQL lets any Operador save the cadastro.
- Two side effects of the cadastro on other tables: whoever leaves `stu` / `ins` loses the personal data at the next cadastro save (`20261114151953_...:164-170`), and personal data can only be saved for someone present there (`:43-51`). A deactivated person must therefore stay in the list.

**Request items that need no migration at all** (the server already allows them, or never looks):
- Editing "missão anterior / missão atual" through a result: `registrar_resultado` accepts a result with `p_voo` null and any `p_data` (`20261117200000_...:635-658`; 'sem o voo também vale', `resultados.test.sql:41`), 'pendente' undoes it ('pendente desfaz um engano', `resultados.test.sql:43`), only Operador and Administrador may call it, and the table only grows.
- The Aprovar stage: the schedule's approval is the day key `aprovacao` (`{em, por}`, `js/eventos/escala.js:205`; `js/dias.js:69`), saved by `salvar_dia`.
- The optimisation settings: the day key `criterios` (`js/dias.js:70`).
- Peso, curso, "Priorizar com" (`voaCom`), "Não escalar com" (`bl`), habilitações (`hab`), the fleet and its attributes: cadastro keys (`js/dias.js:41-49`), writable only by Operador and Administrador already.

**Order when several branches carry migrations (inferred from how the preview is used, not from a line):** the preview database is one, shared by every branch (`README.md:22-25,65`); a migration pushed from one worktree is then missing from the others' `supabase/migrations/`, and their copy of the pgTAP files still pins the old behaviour. Migrations need a serial order and a number each, like the `ESQUEMA` steps.

### 5.8 How the database tests are run, and what a go-live checklist must list

- `npm run test:db` is `node scripts/testar-banco.mjs` (`package.json:14`). It needs `psql`, takes the connection from `SUPABASE_DB_URL` or from `supabase/.temp/pooler-url` (written by `supabase link`, git-ignored: `.gitignore:6`; **absent in the worktree `wt-plano`**), requires `SUPABASE_DB_PASSWORD`, and runs each `*.test.sql` in name order with `psql -X -q -t -A -v ON_ERROR_STOP=1 -f` (`scripts/testar-banco.mjs:11-28`). A file passes when no line is `not ok`, the number of results equals the `1..N` plan and N > 0 (`:34-42`); exit code 1 otherwise.
- "Use sempre o projeto de prévia (acpm-escala-preview), nunca o de produção" is a comment (`scripts/testar-banco.mjs:6`, `README.md:65`); **the script has no guard**, unlike `scripts/semear-previa.mjs:12-17` and `scripts/semear-dias-previa.mjs:18-20`, which refuse the production ref.
- `supabase test db` is not used because it needs Docker (`scripts/testar-banco.mjs:2`).
- The throwaway local Postgres: `docs/PLAN.md:458-459` says the 26 new `painel.test.sql` checks were "run on a throwaway local Postgres 14 with every migration applied and the minimal pgTAP stand-in". **No script, stub or pgTAP stand-in for that is in the repo** (`git ls-files` shows no SQL outside `supabase/migrations` and `supabase/tests/database`), and `config.toml:42` declares the remote as Postgres 17. It also needs stand-ins for `auth.users`, `auth.identities`, `auth.uid()`, the `anon`/`authenticated` roles and `extensions.crypt` (inferred from what the migrations reference).
- pgTAP is not in CI (`.github/workflows/testes.yml`), so `npm test` green says nothing about the SQL except through `espelho-do-banco.test.js`.

What a plan step that adds a migration must list in its go-live checklist (from `docs/PLAN.md:407-412`, `README.md:98-134,180-190`):
1. The migration file name and one sentence on why it only adds (or why the live app keeps working), naming the calls the live app still makes on the changed objects.
2. The pgTAP file(s) and the new check counts; `supabase db push --remote` on the preview, then `SUPABASE_DB_PASSWORD=… npm run test:db` there, all files green.
3. The mirrors updated in the same PR: `test/e2e/supabase-falso.js`, `clienteFalso`, `js/backends/local.js`, and a CI test tying them to the SQL when the rule is new (5.6); `npm test` green.
4. A check on the preview site with a real login of each affected profile (`test/e2e/publicado.spec.js` or by hand).
5. The same migration on production (`supabase db push --remote=<ref de produção>`) **before the merge**, with the live site checked right after.
6. The merge, and who opens the app first as Operador or Administrador when a format step rides along (every stored day is re-saved then).
7. The contract step that follows in its own PR (dropped overloads or functions) and the condition for it.
8. Anything outside the schema: accounts whose rights change, README "Modos de uso", the Manual.

## 6. Conflicts with the request

| # | The request assumes | The code says | Evidence |
|---|---|---|---|
| 1 | "the 13:00 deadline" is the rule | Monday's requests close on **Saturday at 10:00**; 13:00 holds for the other days | `20261114230509_agenda_sem_domingo.sql:12,16`; `js/eventos/agenda.js:105` |
| 2 | "no Sundays" is a rule to keep | A Sunday is only "outside the deadline"; the Exceção da Coordenação registers on a Sunday (and on past dates), in SQL and on screen | `20261114230509_...:14`, `20261114230012_...:41-48`; `js/views/agenda.js:210-212`; `agenda.test.sql:62` |
| 3 | "the local-flight limit" is enforced | Only by the 10-arg function; the legacy 9-arg overload, still granted, has no limit, no specific-time rule and no duration. The limit counts every non-cancelled request and has no override, not even with the exception | `20261110222506_...:47-85`; `20261114230012_...:30-40` |
| 4 | Sub-task "fora do prazo ou com exceção" are two things | A stored request is outside the deadline if and only if `excecao = true`: without the exception the function refuses it (PT403), and `excecao` is stored as `not no_prazo` | `20261114230012_...:41-44,55` |
| 5 | "`salvar_dados_pessoais` accepts the Secretaria, so this needs a migration" (true) | The check is shared with **reading**: `le_dados_pessoais()` is both the write check and the read policy. And there are two overloads to change | `20261113150000_...:62,67-69,88-90`; `20261114151953_...:36-38` |
| 6 | The list "Decisions this reverses" has three items | "The Secretaria must not edit" reverses a fourth: "Personal data … Operadores, Administradores and the Secretaria see and edit it" (Pedro, 2026-11-13), pinned by pgTAP, unit and e2e tests | `docs/PLAN.md:206,221`; 5.4 |
| 7 | The Alunos detail edits "nome completo" | No such field is stored: the only name is `nm` in the cadastro (cut to 80 characters); `dados_pessoais` has cpf, canac, nascimento, celular, email | `20261113150000_...:34-45`; `20261114151953_...:44`; `js/dias.js:47` |
| 8 | "Demanda will consume approved pedidos"; Processamento has "no data of its own" | Flights exist in the Demanda with no row in `solicitacoes` (typed by hand, "+ Agendar voo", extras): `solicitacao` is an optional field of the day's request, and "a booking creates no Agenda request". What was imported is the list `importadas` in the day document. A request row cannot be edited (only cancelled), has no version, and has no column for Recurso, Instrutor, 2ª preferência or Prioridade | `js/dias.js:18-22,71`; `js/agenda.js:86-93`; `docs/PLAN.md:421`; 5.3 |
| 9 | Sub-task "exportada" has a state | Nothing stores that an export happened | `js/export.js:34,153-154` (toasts only) |
| 10 | "The server refuses older formats" | Only `salvar_documento` and `salvar_dia` do (and `salvar_curso` below format 24). Requests, personal data, results and History entries are accepted from a tab of any age | 5.2 |
| 11 | Renaming the `solicitacoes` table is an open choice | A rename cannot be "applied to production before the merge" without breaking the live app, which reads `from('solicitacoes')` and calls `registrar_solicitacao` / `cancelar_solicitacao` by name | `js/backends/supabase.js:212,219,228` |
| 12 | "database tests only on the preview project" is enforced | It is a comment; `scripts/testar-banco.mjs` runs against whatever URL it is given. The local Postgres of PLAN.md has no tooling in the repo | 5.8 |
| 13 | "Operador and Administrador edit every field" versus finer rights elsewhere | The cadastro is all-or-nothing on the server: any Operador may save any key, including `limites`, which the screen reserves for the Administrador | `20261114151953_...:133-135`; `js/views/cadastros.js:75` |

Also to keep in mind: the role and exception refusals of the agenda are pinned by pgTAP **only on the legacy overload** (`agenda.test.sql:35-70` and `contas.test.sql:27` all call the 9-arg signature); the 10-arg function the app uses is tested only with a Secretaria account inside the deadline (`agenda-horas.test.sql`, `agenda-locais.test.sql`).

## 7. Implications and options for the redesign (suggestions)

Each is a suggestion, with its cost and its risk.

1. **Approval as columns on `solicitacoes` plus one function per transition** (5.7 a). Cost: one migration, roughly 15 to 25 pgTAP checks, four JS mirrors, two client methods. Risk: the backfill of requests already in a Demanda, and the legacy overload staying open.
2. **Alternative: keep approval in the day document** (today's `importadas`, renamed in meaning). Cost: no migration, one format step. Risk: it contradicts the request for a migration; the state is visible only for a loaded date (today "Na demanda" shows only on the open date, `js/views/agenda.js:147-148`); the Secretaria and the calendar counts cannot see it across dates.
3. **Backfill by the app, not by the migration:** an idempotent, Operador-only function that marks as approved the requests listed in a date's `importadas`, called once from `atualizarFormatoGravado` in the `importar_cursos` pattern (`20261117200000_...:571-625`, `js/storage.js:394`). Cost: one more function to add and later drop. Risk: a second "contract later" item.
4. **Separate the write right from the read right of personal data:** a new predicate for writing, used by `salvar_dados_pessoais`; `le_dados_pessoais()` stays for the policy. Cost: one migration with the body repeated, about six pgTAP edits, four e2e tests. Risk: the window in 5.7 b; it is zero if no Secretaria account exists in production.
5. **Do the overdue contract now:** drop the 9-arg `registrar_solicitacao` and the 3-arg `salvar_dados_pessoais` (and `importar_cursos` if the production conversion is done). Cost: `agenda.test.sql` rewritten on the 10-arg signature (28 checks), `contas.test.sql:27`, two `has_function` checks (`agenda-horas.test.sql:18-19`, `dados-pessoais.test.sql:43`). Risk: none for the app on main, which calls only the new overloads (`js/backends/supabase.js:219-222,258-260`); it also closes conflict 3 and gives the 10-arg function its missing role tests.
6. **Shared cases for the agenda**, as `test/helpers/casos-do-programa.js` does for courses, with `espelho-do-banco.test.js` checking that each case name is a pgTAP check. Cost: a helper and three test edits. Risk: more files to keep in step; the gain is that CI, which never runs pgTAP, notices drift in the approval rules.
7. **Keep `solicitacoes`, `registrar_solicitacao` and `cancelar_solicitacao` as names**; rename only the user-facing text to "Pedidos". Cost: none. Risk: the code keeps two words for one thing (the messages already say "pedido": `20261110222506_...:62,101`).
8. **A count function for the rail calendar** (requests per day and per state for a date range). Cost: one function and its mirrors. Risk: one more rule to mirror. Why: the calendar becomes visible on every screen, the month read is capped at 1000 rows with no paging (`config.toml:19`, `js/backends/supabase.js:212`), and nothing refreshes it (no realtime).
9. **Give every migration a number and an owner in the plan, and run them serially on the preview**, because the preview database and its pgTAP expectations are shared by all branches (5.7). Cost: A and D wait for each other or move into the foundation. Risk of not doing it: one branch's pgTAP run fails for a reason that lives in another branch.
10. **Bundle the data-format steps where possible.** Each new `ESQUEMA` makes the first Operador open re-save every stored day, one read and one RPC per day (`js/storage.js:389-393`), and the preview database, once written at a higher number, refuses saves from any branch at a lower one. Cost: coordination. Risk: a slow first open after each merge.
11. **Deactivation as a flag on the person**, never as removal from `stu` / `ins` (5.7 c). Cost: none on the server. Risk if ignored: personal data deleted at the next cadastro save.
12. **Keep `fKey`, the status list and the `resultado.out` row fields unchanged**, or schedule a migration of `salvar_dia`, `painel_do_dia` and `horas_dos_instrutores` before the app that changes them. The engine also orders by the request id (`ordemDoAgendamento`, `js/engine.js:328`): if every flight comes from an approved request, that tie-break changes for flights that were typed by hand before (goldens).
13. **If a Demanda column becomes a field of the pedido** (resource, instructor, second preference, priority, course mission): nullable columns plus a new overload, and an edit function, since a request cannot be changed today. Cost: the largest server change of the redesign. Risk: every new column is one more thing the legacy overload ignores.
14. **Let the approval function write its own History row**, as `salvar_dados_pessoais` does (`20261114151953_...:110-116`). Cost: a few lines. Risk: History text written in SQL as well as in JS.
15. **Add the production guard to `scripts/testar-banco.mjs`** (the check of `scripts/semear-previa.mjs:12-17`). Cost: trivial. Risk: none.

## 8. Open questions for Pedro

1. After losing the edit, does the Secretaria still **read** personal data (CPF, celular, e-mail, nascimento, CANAC)? This decides whether `le_dados_pessoais()` changes or only the write check.
2. Are there Secretaria accounts in production today? (`docs/PLAN.md:158` said none on 2026-11-10.) If not, the order of migration and merge in 5.7 b does not matter.
3. Approval: two states (waiting, approved) or also "refused", distinct from "cancelled"? Can an approval be undone, and by whom? May the Secretaria still cancel an approved pedido?
4. Is a pedido registered by an Operador or Administrador (including by the Exceção da Coordenação) born approved?
5. Does the 6-local limit count waiting plus approved pedidos, or only approved? Is an override expected at this stage (the server has none)?
6. At the cut-over, are the pedidos already imported into a date's Demanda marked approved automatically? And the ones waiting for future dates?
7. Is `20261120150000_painel_do_dia_com_a_configuracao` already applied to the preview and to production, and is the `meteorologia` function deployed? (`docs/PLAN.md:458` says "Not applied"; the next `supabase db push` applies every pending file.)
8. Has production been converted to format 24/25 by an Operador open (`README.md:187`)? May the plan drop the two legacy overloads and `importar_cursos` now?
9. Is "nome completo" a new field (personal data, out of exports and of the TV) or today's `nm`?
10. Should approving a pedido appear in the date's History? Should a pedido be editable after registration (today only cancel)?
11. Should the server refuse a pedido for an inactive student? (Today it does not even check that the student exists.)
12. Should an export be recorded so that "exportada" has a state, and where (only an Operador or Administrador can write to a day)?
13. Sunday and past dates under the Exceção da Coordenação: keep as today (allowed), or make Sunday a hard refusal?

<!-- fim -->
