# Mapa: The client data layer: formats, storage, the write path and the History

Read at worktree `~/ACPM/.redesenho/wt-plano` (branch `linha-0-plano`, commit 48875e3). Evidence is `path:line`, relative to the worktree root. Database migrations are cited by file name (`2026…_nome.sql`); they live in `supabase/migrations/`, and the pgTAP files (`*.test.sql`) in `supabase/tests/database/`. A bare `actions.js`, `storage.js`, `dias.js`, `migracoes.js`, `sessao.js`, `perfis.js`, `somente-leitura.js`, `config-supabase.js` means the file in `js/`; `local.js` and `supabase.js` mean the ones in `js/backends/`; `registro.js` is `js/eventos/registro.js`. "(inferred)" marks a conclusion that no single line proves. Nothing in the worktree was changed; the nine data-layer unit test files were run (182 tests, all pass).

## 1. What exists

### 1.1 Modules

| File | What it holds |
|---|---|
| `js/migracoes.js` | `ESQUEMA = 25` (:13), `FORMATO_DOS_CURSOS = 24` (:18), the steps `PASSOS` 5 to 25 (:41-214), `migrarCadastro` / `migrarDia` (:231-232), `precisaMigrar` (:218), `antesDosCursosProprios` (:222), `renomearSimulador` (:39) |
| `js/dias.js` | The split of the in-memory state into two stored documents: `separar` (:36-74), `juntar` (:78-112), `diaPadrao` (:34), `diaParaCopiar` (:118-123), `horasDoDiaSeguinte` (:127-137), `converterLegado` (:154-169), `biDosDias` (:172-180), `CAMPOS_DO_PEDIDO` (:22) |
| `js/storage.js` | `ApiClient`: `createFreshState` (:46-66), `normalizeAndMigrateState` (:68-174), `carregarDia` (:182-213), `lerDadosAParte` (:218-227), `salvarDia` (:229-242), `registrarHistorico` (:249-252), pass-throughs for agenda, personal data, results, courses, accounts (:259-347), `biDoPeriodo` (:349-351), `migrarDocumentosAntigos` (:359-379), `atualizarFormatoGravado` (:385-399) |
| `js/backends/local.js` | `backendLocal`: every document in `localStorage`, with the server's rules re-implemented from shared pure functions |
| `js/backends/supabase.js` | `criarBackendSupabase(cliente, { aoConflito, aoErro, aoGravar, aoSessaoExpirada, esperar })` (:34): versions read, one write queue per document, retry, conflict lock |
| `js/state.js` | Live bindings `S`, `RES`, `AUDIT_LOG`, `BI_HISTORY`, `TL_MODE`, `DATA` (:6-13) and setters; `isGestor()` (:25), `modoCompartilhado()` (:27), `dadoIndisponivel` (:24) |
| `js/actions.js` | `abrirData` (:21-41), `setRole` (:44-64), `lerDadosDeNovo` (:85-108), `travarAposConflito` (:138-145), `dadosLidos` (:151), `aindaNaoAbriu` (:154-158), private `save` (:166-182), `gravarAlteracao` (:189-195), `gravarEscalaCalculada` (:199-202), `logChange` (:212-239), `mostrarNoHistorico` (:249-252), `dadosPreparados` (:271-277), `lerData` (:286-317), `carregarData` (:321-328), `carregarBI` (:332-348) |
| `js/sessao.js`, `js/config-supabase.js` | Login, profile, backend choice, session keys; `projetoSupabase()` (config-supabase.js:14-19) |
| `js/eventos/registro.js` | `aoAcionar` (data-act clicks, :15-28) and `aoMudarCampo` (data-f / data-a changes, :33-52), both with the read-only and not-yet-open guards |
| `js/eventos/historico.js`, `js/reversoes.js` | The History drawer and "Reverter": `validarReversao` (reversoes.js:43-117), nine revert kinds |
| `js/perfis.js`, `js/somente-leitura.js` | Profile predicates (perfis.js:6-12); disabling of fields for `data-role="gestor"` (somente-leitura.js:5-38) |

### 1.2 Two modes
- Shared mode: `projetoSupabase()` maps `gdruumond.github.io` to `producao` and `thephfernandes.github.io` to `previa`; on `localhost` / `127.0.0.1` only `?supabase=<nome>` picks a project (config-supabase.js:11-19). `iniciarSessaoSupabase` sets `document.body.dataset.backend = 'supabase'` (sessao.js:115) and replaces `ApiClient.backend` (sessao.js:150-155).
- Local mode: `ApiClient.backend = backendLocal` by default (storage.js:36); no login; `ApiClient.perfil` stays `null` (storage.js:43).
- There is no realtime subscription and no polling in the app; only the TV page polls (`setInterval` only in js/painel.js:161,274 and js/views/painel-aeroporto.js:284). A tab sees other people's changes only when it reads a date again or reloads.

### 1.3 Three mirrors of the server contract
Every server function the client calls exists three more times and must be kept equal: `js/backends/local.js`; the e2e fake `test/e2e/supabase-falso.js` (header :1-6); the unit fake `clienteFalso` in test/unit/backend-supabase.test.js:17-199 (plus `backendEmMemoria`, test/unit/storage-dias.test.js:20-65). A new server function (pedido approval, a personal-data permission change) touches all of them.

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

### 2.1 The `cadastro` document: FOR ALL DATES
Stored in `public.documentos` row `chave = 'cadastro'` (`conteudo` jsonb, `versao` integer: supabase/migrations/20261110191032_documentos_e_perfis.sql:38-44; key allowed since 20261110201618_dias_e_historico.sql:5-7) or `localStorage['acpm4_cadastro']` (js/backends/local.js:13). Written only by `separar(estado).cadastro` plus `esquema` (js/storage.js:231-239). Key order as written: `nid, ins, stu, frota, horarios, limites, cursos, painel, esquema` (js/dias.js:38-54; js/storage.js:232).

| Field | Shape | Writers (handler) |
|---|---|---|
| `nid` | integer counter for new people ids, at least 1000 (storage.js:86) | `S.nid++` in "+ Novo instrutor" / "+ Novo aluno" (js/eventos/cadastros.js:75,85) |
| `ins[]` | `{ id, nm, lv?, kg, hab[], horasExternas? }` only (dias.js:41-45). `lv` is a dead copy; `horasExternas` keys `'AAAA-MM'` / `'AAAA-00'` | add :74-81, delete :111-125, `nm` :148-151, `kg` :152-156 (also the weight typed in a booking, js/agendamento.js:930), `hab` :157-160, `ext-mes` / `ext-ano` :161-172 (all js/eventos/cadastros.js) |
| `stu[]` | `{ id, nm, kg, bl[], voaCom?, curso? }` only (dias.js:47) | add :84-90, delete :126-129, `nm` :192-195, `kg` :196-200, `bl` :201-207 and `unbl` :92-99, `voaCom` :208-211 and `unvc` :101-109, `curso` :212-217 (js/eventos/cadastros.js) |
| `frota[]` | `{ reg, tipo, soParafuso?, soVfr?, habilitacaoPropria? }` only: `recurso()` keeps just those (js/frota.js:62, `normalizarFrota` :65-71) | add js/eventos/recursos.js:56-70, attributes :75-90, "Retirar" :149-159; reverts js/eventos/historico.js:66-73, :107-112 |
| `horarios` | `{ C152, C172, sim, 'PA-34' }`, each a sorted list of minutes 06:00 to 17:00 (js/horarios.js:13,21-29) | take-off times editor, js/eventos/recursos.js:192-216; revert js/eventos/historico.js:96-106 |
| `limites` | eight keys of `LIMITES_DA_LEI` (js/limites.js:9-18) | Administrador only (local: non-Gestor), js/eventos/cadastros.js:229-249 |
| `cursos` | `{ PP: [], PC: [], INVA: [] }`: the frozen copy from before format 24; nobody edits it (README.md:173-174); `separar` writes it back unchanged (dias.js:51) | none |
| `painel` | `{ quadro, colunas[{id,on}], listas }`, present only after it was changed (dias.js:52-53; storage.js:99-100) | `mudar` in js/views/config-do-painel.js:70-77 |
| `esquema` | 25 | `salvarDia` (storage.js:232), `atualizarFormatoGravado` (storage.js:395) |

### 2.2 The `dia:<AAAA-MM-DD>` document: PER DATE
Stored in `public.dias` row `data` (20261110201618_dias_e_historico.sql:11-17) or `localStorage['acpm4_dia_<data>']` (local.js:15). Written by `separar(estado).dia` plus `esquema` and `resultado` (storage.js:233,241). "New date" column: what a date that has no stored document starts with, computed on every open from the latest stored day before it (`backend.diaAnterior`, any distance back, not only yesterday: local.js:120-123; supabase.js:135-141) by `diaParaCopiar` (dias.js:118-123); nothing is saved until the first change.

| Field | Shape | New date starts with | Writers (handler) |
|---|---|---|---|
| `win` | 9 booleans, one per `WIN` window (js/config.js:4) | copy of the previous day | "Janelas de operação" switch `data-a="win"`, js/eventos/recursos.js:115-120 |
| `av` | `{ reg: boolean }` ("Disponível") | copy | `data-a="av"`, recursos.js:122-129; new resource :62; reverts historico.js:63,110 |
| `ins` | `{ <instructor id>: { on, aw[9] } }` (dias.js:58). `on` is the "Vem" column (js/views/cadastros.js:86,123); `aw` is one boolean per window (views/cadastros.js:82) | copy | `on`: js/eventos/cadastros.js:143-147; booking "marcado disponível" js/agendamento.js:937; reverts historico.js:77, js/reversoes.js:188. `aw`: cadastros.js:173-174 and the "Aplicar turno…" preset :175-177 (no History entry, :179-181); js/agendamento.js:938; new instructor `aw: WIN.map((_, i) => i < 8)` (cadastros.js:75) |
| `pedidos` | `{ <student id>: { fly, mis, eq, p1, p2, nb, ss, pr, jan?, etapa?, solicitacao?, insId?, cursoDaEtapa?, extra[] } }`. Main pedido limited to `CAMPOS_DO_PEDIDO` (dias.js:22,59-62); each `extra[]` item is cloned whole and carries `mid` | the same student keys, every pedido blank (`blank()`, `extra: []`) (dias.js:121) | js/eventos/demanda.js (fly :41,:188,:214; fields :244; `insId` :207; mission of the course :94-99; extras :153-182; "Limpar demanda" :81-89), import js/eventos/agenda.js:53, booking js/eventos/agendamento.js:35, instructor on the Escala js/eventos/escala.js:181, Sugestões :284-285, take-off times change js/eventos/recursos.js:205-211, instructor deleted js/eventos/cadastros.js:123, History reverts |
| `fStatus` | `{ fKey: status }`, `fKey = '<stuId>_<mid>_1'` (js/voo.js:4-5) | `{}` | `aplicarStatus`, js/eventos/escala.js:123-138 |
| `fObs` | `{ fKey: { motivo, texto? } or { novoInicio } }` | `{}` | same |
| `horas` | `{ reg: hours flown since the 50 h inspection, at the start of the day }` | previous day's hours plus its non-cancelled flights (`horasDoDiaSeguinte`, dias.js:127-137) | `data-a="horas"` recursos.js:131-145; "Revisão feita" :171-176 |
| `filas` | `{ cheque, mlte, noturno, c172 }`: instructor ids in queue order (js/rodizio.js:7-12) | previous day's queues with who flew moved to the end (`filasDoDiaSeguinte`, rodizio.js:34-46) | js/eventos/rodizio.js:8-20; re-fitted to the roster on every load (`ajustarFilas`, storage.js:162) |
| `hangar` | list of aircraft regs, front to back | copy | recursos.js:162-168 |
| `fixos` | `{ fKey: { a, b, r, insId, classKey?, escolhido?, agendado? } }` (js/fixos.js:14-27) | `{}` | status escala.js:135, instructor :181, Aprovar :204, Reabrir :213, Sugestões :286; demanda.js:28,:179,:83; cadastros.js:124; booking; reverts |
| `aprovacao` | `{ em, por }` or `null` (fixos.js:29-32) | `null` | Aprovar escala.js:205, Reabrir :214, "Limpar demanda" (fixos.js:115) |
| `criterios` | `{ buracos, horarios }` (js/criterios.js:13-20) | copy | `[data-criterio]` buttons, escala.js:222-231 |
| `importadas` | ids of pedidos of the agenda already imported | `[]` | `importarSolicitacoes`, js/agenda.js:116 |
| `resultado` | the saved schedule `{ out[], al[], tot, revisao?, data, rej? }`; `null` until the first save | none | `save()` → `ApiClient.salvarDia(DATA, S, RES)` (actions.js:169; storage.js:241) |
| `esquema` | 25 | none | storage.js:233 |

Two other stored day shapes exist: `{ importado: true, resultado }` (old BI days, dias.js:158-164) and, in local mode only, `{ simulado: true, resultado, esquema }` ("Simular 30 dias", js/eventos/bi.js:71). Both lack `ins` and `pedidos`, so `diaParaCopiar` treats them as "no previous day" (dias.js:119).

### 2.3 Data kept beside the two documents

| Data | Where | Scope | Written by | Read |
|---|---|---|---|---|
| Pedidos | table `solicitacoes` (20261110222506_agenda_de_solicitacoes.sql:6-24, column `horas` in 20261114222031_agenda_com_duracao.sql:8) / `acpm4_agenda` | per date (column `data`); never deleted; no version column | `ApiClient.registrarSolicitacao`, `cancelarSolicitacao` (js/eventos/agenda.js:99,147) | month grid when the Agenda opens (js/views/agenda.js:65-74); the open date after every date change (js/views/selos.js:38-45); again at "Importar" (js/eventos/agenda.js:36) |
| Personal data | table `dados_pessoais`, key `(tipo, id_cadastro)` (20261113150000_dados_pessoais.sql:34-45) / `acpm4_dados_pessoais` | all dates, one row per person, own version `atualizado_em` | `ApiClient.salvarDadosPessoais` (js/views/dados-pessoais.js:139) | all rows once at opening (js/main.js:129); one person when its panel opens (views/dados-pessoais.js:65) |
| Mission results | table `resultados_de_missao` (20261114120000_resultados_de_missao.sql:5-15) / `acpm4_resultados` | append-only; each row has `aluno`, `curso`, `missao`, `data`, `voo` (the `fKey`) | `ApiClient.registrarResultado` (js/eventos/escala.js:245) | on every date open: the situation of every mission (all dates) and the rows of the date (storage.js:222) |
| Instructors' hours | not stored: summed from the stored schedules by `horas_dos_instrutores(p_data)` (20261115151734_repouso_conta_o_atraso.sql:4-43) or `acumularHoras` (js/limites.js:55-70) | computed for a date | none | on every date open (storage.js:221) |
| Course programs | course tables (20261117200000_cursos_e_missoes.sql) / `acpm4_cursos` | all dates, one version per course | `ApiClient.salvarCurso` (Administrador), `importarCursos` (one-off) | on every date open (storage.js:224) |
| History | table `historico` (20261110201618_dias_e_historico.sql:64-74, `autor` in 20261110202010_historico_autor.sql:3) / `acpm4_historico` | per date; only grows | `registrar_historico` after the save; `salvar_dados_pessoais` (server-side); `importar_historico` (once) | on every date open, newest 200 of the date (supabase.js:169-175) |
| BI | not stored: `biDosDias` over the stored `resultado` of each day (dias.js:172-180) | a period | none | at opening, on every date change and when the BI tab opens (actions.js:327,333-348; js/main.js:140; js/eventos/navegacao.js:25) |
| Profile | table `perfis` | per account | Administrador RPCs | at login (sessao.js:128) |

### 2.4 Memory only (never stored)
`S.schemaVer` (dias.js:83), `S.horasBase`, `S.horasDosInstrutores`, `S.resultados`, `S.programa`, `S.indisponiveis` (actions.js:305), `S.noturnosDaVespera` (storage.js:201); `RES`, `AUDIT_LOG`, `BI_HISTORY`, `TL_MODE`, `DATA` (js/state.js:6-13); `dadosLidos` (actions.js:151); `escalaSoCalculada` (actions.js:199); `ApiClient.cadastroGravado` (storage.js:178); the backend's `versoes`, `pendentes`, `emAndamento`, `bloqueado` (supabase.js:37-41); the personal data map `DADOS` (js/views/dados-pessoais.js:11); the Agenda's `pedidos`, `diaEscolhido`, `mesVisivel` (js/views/agenda.js:17-19); `pedidosDaData` (js/views/selos.js:36); the chosen views (js/views/vistas.js:14); the course write queues (js/eventos/cursos.js:40-43).

### 2.5 Which fields survive (confirmed with `node -e` on the pure modules)
- A migration step keeps every unknown field, top-level and nested (`{ ...PASSOS[v][parte](atual), esquema: v }`, migracoes.js:227).
- `juntar` drops unknown top-level fields of both documents, unknown fields of `dia.ins[id]`, and unknown fields of a `frota` item (dias.js:82-111; frota.js:62). It keeps unknown fields on a person in memory (`...x`, `...s`, dias.js:94,97).
- `separar` is a whitelist: a person is rebuilt from the listed fields only (dias.js:41-47), the main pedido from `CAMPOS_DO_PEDIDO` (dias.js:60), `dia.ins[id]` as `{ on, aw }` (dias.js:58). Only the items of `extra[]` keep unknown fields (`structuredClone`, dias.js:61).
- Consequence: a field that is not added to `separar`, `juntar` and the normalizers is erased from the stored document by the next save from any tab. A field taken out of `separar` disappears from each document at its next save, with no step involved.

## 3. Controls inventory

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| "Dia anterior" | `button#dt-ant.topo-ico` (index.html:59) | `irParaDia(-1)`, js/eventos/topo.js:47-55 (fires `change` on `#dt`) | reads `DATA`; skips Sunday | all in shared mode; local mode: disabled for Gestor (actions.js:56-57) |
| "Escolher a data" (`aria-label="Data da escala"`) | `input#dt[type=date]` in `label.topo-data-campo` (index.html:60-65) | `$('#dt').onchange`, topo.js:28-44; click opens the picker, topo.js:57-63 | `carregarData(data)`: sets `DATA`, `S`, `RES`, `AUDIT_LOG`, `dadosLidos`; Sunday opens Monday with a toast; a failed read puts the field back to `DATA` | same |
| "Próximo dia" | `button#dt-prox.topo-ico` (index.html:66) | `irParaDia(1)`, topo.js:56 | same | same |
| date label | `span#dt-rotulo`, `span#dt-rel` (index.html:62-63) | written by `abrirData`, actions.js:36-40 | display only | all |
| "Perfil de acesso" | `select#role-sel.hd-sel`, options "Operador" / "Gestor" (index.html:69-72) | topo.js:17-21 → `setRole`, actions.js:44-64 | writes `body[data-role]`, `body.dataset.agenda`; re-applies the read-only fields | local mode only (hidden in shared mode, css/app.css:1557; disabled when `ApiClient.readOnly`, actions.js:51) |
| "Histórico" with counter | `button#btn-open-log.hd-btn`, `span#log-cnt.badge-cnt` (index.html:73) | `mostrarHistorico`, js/eventos/historico.js:20-30; counter in `renderAuditPanel`, js/views/escala.js:273-274 | reads `AUDIT_LOG` | hidden for Secretaria (css/app.css:187) |
| "Fechar o histórico" ✕ | `button#btn-fechar-historico.x` (index.html:670) | historico.js:31; Esc :32-34 | none | who sees the drawer |
| History list | `div#audit-log-list.audit-list` in `aside#historico.gaveta` (index.html:667-675) | `renderAuditPanel`, js/views/escala.js:267-301 | reads `AUDIT_LOG`, `S.frota`; hides entries another entry reverts (:271-272) | who sees the drawer |
| "↶ Reverter", "↶ Restaurar", "✕ Excluir", "↶ Desfazer" (the label comes stored in the entry) | `button.x.edit-only[data-act="rev-log"][data-logid]` (views/escala.js:287) | `aoAcionar('rev-log', …)`, historico.js:46-124 | reads `entry.revert`; writes `S` (pedidos `fly` / `insId` / `p1` / `p2` / `jan`, `av`, `frota`, `ins[].on` / `aw`, `fixos`, `fStatus`, `fObs`, `horarios`); `gravarAlteracao(…, null, entry.id)` | Operador, Administrador; local non-Gestor (registro.js:24; css/app.css:235) |
| "Limpar o histórico desta data" | `button#btn-clear-log.btn.quiet.edit-only` (index.html:674) | historico.js:37-43 → `ApiClient.backend.limparHistorico(DATA)` (local.js:141-144) | deletes the date's entries in `acpm4_historico`; `AUDIT_LOG = []` | local mode only (css/app.css:1564), non-Gestor |
| "Recarregar" | `button#btn-recarregar` in `div#aviso-sync` (index.html:108-111) | `mostrarAviso`, js/dom.js:26-32 → `window.location.reload()` | none | whoever gets the notice |
| "Tentar de novo" | `button#btn-tentar-dados` in `div#aviso-dados` (index.html:120-123) | topo.js:114-117 → `lerDadosDeNovo`, actions.js:85-108 | writes `S.horasBase`, `S.horasDosInstrutores`, `S.resultados`, `S.programa`, `S.indisponiveis`; calls `save()` when the hours arrived and the profile edits (:106) | all |
| "OK" (link notice) | `button#btn-fechar-aviso-link` (index.html:116) | js/dom.js:81-86 | none | all |
| "Entrar" | `form#form-login`, `#login-email`, `#login-senha`, `button#btn-entrar` (index.html:128-133) | `pedirLogin`, sessao.js:14-40 | Supabase session in `localStorage['acpm-<projeto>']` | shared mode |
| "Sair" (account without profile) | `button#btn-sair-sem-acesso` (index.html:136) | sessao.js:135 | signs out of this browser | account with no profile |
| "Enviar os dados deste navegador" / "Começar sem eles" | `button#btn-enviar-local`, `button#btn-ignorar-local` (index.html:141-142) | `oferecerEnvioDosDadosLocais`, sessao.js:44-63 → `ApiClient.migrarDocumentosAntigos(amanhaISO(), backendLocal)` | reads local `acpm3*`; writes days then the cadastro on the server | Operador, Administrador, only with an empty server (sessao.js:46,172) |
| "Entre de novo" → "Entrar" | `dialog#dlg-sessao`, `form#form-sessao`, `#sessao-senha`, `button#sessao-entrar` (index.html:712-721) | `pedirNovoLogin`, sessao.js:78-105 | the waiting writes continue after it | shared mode, on a 401 |
| "Minha conta", "Usuários", theme switch, "Sair" | `#btn-conta`, `#btn-usuarios`, `#btn-theme`, `#btn-sair` in `#menu-conta` (index.html:82-87) | topo.js:104,106-111,73-82; sessao.js:166 | theme in `localStorage['acpm3_theme']` | "Usuários": Administrador (sessao.js:164); the others: every shared-mode account |
| "Compartilhar" | `button#btn-share-link` (index.html:358) | js/eventos/escala.js:106-118 | reads `DATA`; copies a link with only `?data=` | hidden for Secretaria (css/app.css:188); local mode: explains only |
| "CSV", "PDF", "Excel" | `#exp`, `#pdf`, `#xlsx` (index.html:359-361) | js/eventos/escala.js:90-92 → `gravarEscalaCalculada()` then the export | saves the day (no History entry) when the schedule on screen was only calculated (actions.js:199-202) | everyone sees them; only who edits saves (actions.js:167) |
| "Data base" (BI) | `input#bi-dt` (index.html:655) | js/eventos/bi.js:16 → `carregarBI`, actions.js:333-348 | reads the stored days of the month; `BI_HISTORY` | all |
| "Simular 30 dias" / "Limpar BI" | `button#btn-bi-sim`, `button#btn-bi-clr` (index.html:659-660) | js/eventos/bi.js:26-75, :78-83 | writes `dia:<iso>` with `simulado: true` straight through `ApiClient.backend.gravar` (bi.js:71); removes them | local mode only (css/app.css:1565-1566), non-Gestor |

## 4. Rules and the tests that pin them

| Rule | Code | Tests |
|---|---|---|
| A step keeps what it does not know; a doc already at the current format does not change | migracoes.js:227; README.md:164-167 | test/unit/migracoes.test.js "dia: renomeia os simuladores na disponibilidade e na escala, sem perder nada", "é idempotente: um dia já no formato atual não muda", "cadastro: ganha a versão do formato e mantém tudo o que tinha", one test per step ("versão 6 …" to "versão 24 …"); test/unit/config-do-painel.test.js "o formato 25 traz o cadastro de antes sem mudar nada …" (asserts `ESQUEMA === 25` literally, :127) |
| A new top-level cadastro field goes before `esquema`, in the order the app writes | migracoes.js:89-91,100-101,124-125,143-144 | migracoes.test.js "versão 15 …" and "versão 18 …" (`Object.keys(novo)`, :116,:141) |
| The courses format is one number at each end | migracoes.js:18; 20261117200000_cursos_e_missoes.sql:23-31 | test/unit/espelho-do-banco.test.js "formato_dos_cursos() devolve o FORMATO_DOS_CURSOS do app, imutável e fora do alcance da API", "o formato dos cursos é um passo do formato que o app grava, e o cadastro de antes passa por ele", "a migração compara o formato do cadastro com formato_dos_cursos(), sem nenhum número" |
| The state survives `separar` then `juntar`; the cadastro has no day data and the day has no names or weights | dias.js:36-112 | test/unit/dias.test.js "juntar(separar(estado)) devolve o mesmo estado em 300 cenários e no exemplo", "o cadastro não tem dados do dia e o dia não tem nomes nem pesos" (asserts the exact key lists, :28-32), "Nova data" tests (:156-175, key list at :164) |
| The cadastro is written only when its JSON changed; the day always; cadastro first, the day only if the cadastro was written | storage.js:229-242 | test/unit/storage-dias.test.js "grava o cadastro só quando ele muda; o dia é gravado sempre", "o cadastro é gravado antes do dia; sem o cadastro gravado, o dia não é gravado e a gravação responde false"; test/e2e/compartilhado.spec.js "uma missão extra grava só o dia (o cadastro, de todas as datas, não muda)" |
| Opening a date writes nothing; a new date is a copy of the previous one with an empty Demanda | storage.js:180-213; dias.js:114-123 | storage-dias.test.js "data nova começa com uma cópia do dia anterior (sem status, sem escala e com a demanda vazia) e não grava nada"; test/e2e/datas.spec.js "cada data tem a sua escala; a nova data começa com a demanda vazia" |
| The upgrade rewrites the days, then the courses conversion, then the cadastro; once; resumed after a failure | storage.js:385-399 | storage-dias.test.js "atualiza o que está gravado: todos os dias e, por último, o cadastro; uma vez só", "se uma gravação falha, para com erro e o cadastro continua no formato anterior (retoma na próxima abertura)", "não grava nada no modo somente leitura nem com o banco vazio", "na atualização do formato: os dias, depois a conversão, depois o cadastro (que a encerra); uma vez só"; e2e datas.spec.js "dados no formato anterior neste navegador são regravados no formato atual na abertura"; datas-compartilhado.spec.js "no primeiro acesso de um operador, os dados no formato anterior são regravados no formato atual", "gestor vê os dados no formato atual antes da atualização, sem gravar nada" |
| The server refuses a write in a format older than the stored one, and a day older than the cadastro, with PT409 and hint `formato` | 20261114143242_formato_e_status_do_dia.sql:22-27,73-77 | supabase/tests/database/formato.test.sql ("voltar o formato do dia também", "e o do cadastro", "com a dica \"formato\""); test/unit/backend-supabase.test.js "recusa pelo formato (uma versão mais nova do app atualizou os dados): o conflito diz que é o formato"; e2e compartilhado.spec.js "a versão anterior do app aberta numa aba: o servidor recusa pelo formato e o app pede para recarregar" |
| Writes of one document go out in series with the latest content; reads wait for this browser's writes | supabase.js:44,46-88,98-114 | backend-supabase.test.js "gravações seguidas do mesmo documento saem em série, só com o conteúdo mais recente", "as leituras esperam as gravações em andamento deste navegador (não voltam a um conteúdo anterior)", "a leitura só para consultar não muda a versão lida: a gravação seguinte continua com a de antes" |
| After a conflict nothing more is sent and the screen is read-only until reload | supabase.js:63-68,111; actions.js:138-145 | backend-supabase.test.js "conflito: avisa, não grava mais nada e responde false", "depois de um conflito, nada mais é gravado: nem outras datas nem o histórico"; e2e compartilhado.spec.js "conflito: aviso fixo, a tela fica só para consulta, nada mais é enviado e \"Recarregar\" mostra a versão do colega", "depois de um conflito, nem o Administrador muda o programa dos cursos ou os limites da lei" |
| No connection: retry with backoff; 401: wait for the new login; a definitive refusal does not retry | supabase.js:15-25,69-82 | backend-supabase.test.js "erro de rede: avisa a cada falha e tenta de novo sozinho, esperando cada vez mais, até gravar", "sessão expirada (401): a alteração e o histórico esperam o novo login e são gravados depois", "recusa definitiva (sem permissão, dado inválido): avisa e não tenta de novo"; e2e compartilhado.spec.js "sem conexão: as alterações esperam (fechar a página pede confirmação) e são gravadas quando a conexão volta" |
| Nothing is saved before the open date's data is read; dates are read one at a time | actions.js:147-158,167,190,213,286-317 | test/e2e/abertura.spec.js (15 `test(` blocks, e.g. "enquanto os dados chegam, nenhum botão grava …", "enquanto outra data abre, nenhuma mudança grava e a tela fica como estava; na data nova, vale de novo", "as datas são lidas uma de cada vez: a leitura atrasada de uma troca anterior não apaga o aluno que outra pessoa incluiu") |
| A History entry reaches the server only after the write that carries the change | actions.js:208-239 | e2e compartilhado.spec.js "a alteração recusada (outra pessoa gravou antes) não entra no histórico: na tela, \"não gravada\", sem Reverter", "enquanto a alteração é gravada, a entrada aparece \"gravando…\" sem Reverter; depois, registrada e com Reverter" |
| A stored revert is applied only in the app's own format; a tampered one never throws | reversoes.js:43-117 | test/unit/reversoes.test.js "as que o app grava passam, com o rótulo", "qualquer campo adulterado, de qualquer tipo de reversão, não lança: a reversão vale limpa ou não vale"; e2e historico.spec.js "a reversão de um agendamento adulterada não vira botão nem impede a data de abrir" |
| The History only grows; nobody edits or deletes entries on the server | 20261110201618_dias_e_historico.sql:62-106 | supabase/tests/database/dias-e-historico.test.sql ("escrita direta no histórico é bloqueada", "ninguém altera entradas do histórico") |
| Personal data live outside the cadastro; the History gets only the names of the changed fields | js/dados-pessoais.js:63-65,87-113; 20261114151953_dados_pessoais_versionados.sql:92-116 | test/unit/dados-pessoais.test.js "o histórico registra só os nomes dos campos que mudaram, nunca os valores", "quem sai do cadastro leva os dados pessoais junto"; e2e dados-pessoais.spec.js "ficam fora do cadastro; no perfil Gestor não aparecem", "a alteração da secretaria vai para o histórico (só os nomes dos campos)"; dados-pessoais.test.sql |
| Who may do what on screen | perfis.js:6-12 | test/unit/perfis.test.js (3 tests); e2e perfis.spec.js, dados-pessoais.spec.js "a Secretaria vê Alunos e Instrutores e edita só os dados pessoais", agenda-compartilhado.spec.js "a Secretaria abre na agenda, registra pedidos e só consulta a escala", "o Gestor vê a agenda, sem registrar nem cancelar" |
| Local mode follows the server's rules and error codes | local.js | test/unit/backend-local.test.js (23 tests); espelho-do-banco.test.js |
| Stored content is untrusted: every loader checks types | storage.js:68-174; js/escala-gravada.js:103-123 | test/unit/storage.test.js "valores gravados fora do formato: status desconhecidos saem; pessoas e pedidos voltam aos tipos certos"; test/unit/escala-gravada.test.js; e2e seguranca.spec.js |

## 5. Answers

### 5.1 The data model seen from the client
- Two documents make the state the engine and the screens use: the cadastro (2.1) and the day of the open date (2.2). `juntar(cadastro, dia)` builds `S` (dias.js:78-112), `normalizeAndMigrateState` checks every type (storage.js:68-174), `separar(S)` splits it back for saving (dias.js:36-74).
- A student in `S.stu` is the cadastro person and the main pedido of the day in one object (`...s, ...pedidos[s.id]`, dias.js:96-101); `pedidoDoAluno(aluno, 0)` returns the student itself (js/voo.js:26). An instructor in `S.ins` is the cadastro person plus `on` and `aw` of the day (dias.js:92-95).
- The saved schedule lives inside the day (`resultado`). It carries copies of names and weights (`s`, `ins`, `stuKg`, `insKg`: js/escala-gravada.js:40-41,46-47), so a past day keeps the names as they were when it was last saved.
- Data beside the documents: 2.3.

What the client reads, shared mode:

| Moment | Requests |
|---|---|
| Opening, every profile | Auth session; `perfis` (sessao.js:128) |
| Opening, Operador and Administrador only | `cadastro` three more times: `oferecerEnvioDosDadosLocais` (sessao.js:46), `migrarDocumentosAntigos` (storage.js:360), `atualizarFormatoGravado` (storage.js:387); read-only profiles skip all three (sessao.js:172; storage.js:360,386) |
| Every date open (opening and each date change), blocking | 1 `cadastro` (storage.js:183); 2 `dia:<data>` (:186); 3 the latest day before the date (:189); then in parallel 4 `horas_dos_instrutores`, 5 `situacao_das_missoes`, 6 `resultados_de_missao` of the date, 7 `programa_dos_cursos` (storage.js:220-225); then 8 `historico` of the date (actions.js:299). A failure of 1, 2, 3 or 8 fails the date; 4 to 7 only mark `indisponiveis` (storage.js:210-211) |
| Every date open, after the screen is drawn | 9 `solicitacoes` of the date (js/views/selos.js:41; failure ignored); 10 every stored day, with its full content, from the 1st of the month (or 6 days back) to the end of the month, for the BI (actions.js:333-348; supabase.js:121-126) |
| Opening only | `dados_pessoais` for alunos and for instrutores, for who may see them (js/main.js:129; js/views/dados-pessoais.js:23-33); never read again on a date change |
| When the Agenda opens, a month changes, a pedido is registered or cancelled | `solicitacoes` of the whole month grid (js/views/agenda.js:65-74) |

- The API returns at most 1000 rows per query (`max_rows = 1000`, supabase/config.toml:19). `listarSolicitacoes` selects `*` with cancelled rows included (supabase.js:211-215); `listarDadosPessoais` returns every person of a type (supabase.js:241-246).
- Local mode does the same calls against `localStorage` (5.6).

### 5.2 Per date or for all dates, today

| Subject | For all dates (cadastro) | Per date (day) | Carried to a new date |
|---|---|---|---|
| Students | `id`, `nm`, `kg`, `bl` ("Não escalar com"), `voaCom` ("Priorizar com"), `curso` | the pedidos: `fly` ("Voa"), `mis`, `eq`, `p1`, `p2`, `nb`, `ss`, `pr`, `jan`, `etapa`, `cursoDaEtapa`, `solicitacao`, `insId`, `extra[]` | no: the Demanda starts empty (dias.js:114-123) |
| Instructors | `id`, `nm`, `lv`, `kg`, `hab`, `horasExternas` | `on` ("Vem"), `aw` (9 window booleans) | yes, copied |
| Resources | `frota[]`: `reg`, `tipo`, `soParafuso`, `soVfr`, `habilitacaoPropria` | `av[reg]` ("Disponível"), `horas[reg]` (hours since the inspection, start of day), position in `hangar` | `av` and `hangar` copied; `horas` advanced by the previous day's flights |
| `win` (Janelas de operação) | none | `win[9]` | copied |
| Criteria of the compaction | none | `criterios` | copied |
| Hangar order | none | `hangar` | copied |
| Rodízio | none | `filas` (queues at the start of the day) | rotated from the previous day's schedule |
| Painel settings | `painel` | none | n/a |
| Take-off times | `horarios` | none | n/a |
| Legal limits | `limites` | none | n/a |
| Approval, pins, statuses | none | `aprovacao`, `fixos`, `fStatus`, `fObs` | no |
| Pedidos already imported | none | `importadas` | no |
| The schedule | none | `resultado` | no |
| Pedidos of the agenda | none (own table, column `data`) | not in the day; outside the day's version and conflict check | n/a |

What the redesign asks to move, against today's home:

| Item of the request | Today | Home the request implies |
|---|---|---|
| INVA availability as ranges, per date | `dia.ins[id].aw` and `.on` | still `dia.ins[id]`: a new key that `separar` (dias.js:58) and `juntar` (dias.js:94) must list |
| Deactivation switch for Alunos, Recursos (and INVAs) | does not exist. The only cadastro-level "off" is deleting the person (js/eventos/cadastros.js:111-132) or "Retirar" for a resource (js/eventos/recursos.js:149-159); `on`, `av`, `fly` are all per date | a new flag on `stu[]`, `frota[]`, `ins[]` in the cadastro: three whitelists to extend (dias.js:41-47; frota.js:62) |
| Approval of a pedido | does not exist. `dia.importadas` records which pedidos were imported into a date's Demanda | a state on the `solicitacoes` row (server table and `acpm4_agenda`), outside both documents |
| Removal of `win` | `dia.win` | nowhere |
| Requirement list of a resource | `frota[].habilitacaoPropria` boolean | a list on the `frota[]` item, which `recurso()` (frota.js:62) would drop today |

### 5.3 `js/migracoes.js`
**ESQUEMA is 25**, confirmed (migracoes.js:13). A document without the field `esquema`, or with one that is not a number, counts as version 4 on the client (`versaoDe`, :216; migracoes.test.js:43) and as 0 on the server (`esquema_do_conteudo`, 20261110213600_formato_nao_regride.sql:7-14) and in local mode (`formatoDe`, local.js:50).

Every step so far (21 steps; 9 change data, 12 only raise the number; only 5 and 12 touch the day):

| Step | `cadastro` | `dia` |
|---|---|---|
| 5 (:42-54) | none | simulators renamed in the keys of `av` and in `resultado.out[].r` |
| 6 (:57-62) | `ins[].hab` from `lv` when missing | none |
| 7, 8, 9, 10 (:65-83) | none | none (the days hold `horas`, `filas`, pedido `jan`, `importadas`) |
| 11 (:86-94) | `frota` = `FROTA_INICIAL` when missing, placed before `esquema` | none |
| 12 (:97-106, :21-35) | `horarios` = `HORARIOS_INICIAIS` when missing | each pedido and each extra: `p1`, `p2` from window index to minutes, `jan` to the current form, PA-34 preferences snapped to its list |
| 13, 14 (:110-118) | none | none (`fObs`, `hangar`) |
| 15 (:121-128) | `limites` = `LIMITES_DA_LEI` when missing | none |
| 16, 17 (:130-138) | none | none (`fixos`, `aprovacao`, `criterios`) |
| 18 (:140-147) | `cursos` = `cursosVazios()` when missing | none |
| 19 (:150-158) | every instructor gets `'c152'` in `hab` | none |
| 20 (:161-169) | `hab` through `marcasDoChecadorAntigo` | none |
| 21, 22 (:172-182) | none | none (status "Pousou"; pedido `insId`, student `voaCom`) |
| 23 (:186-197) | `frota`: PR-CPL (C172) gets `soVfr: true`, PR-VOM (PA-34) gets `habilitacaoPropria: true`, only when undefined | none |
| 24 (:203-206) | none | none (`FORMATO_DOS_CURSOS`: programs in their own tables; `fixos[].agendado`; pedido `cursoDaEtapa`) |
| 25 (:210-213) | none | none (cadastro `painel`) |

**The pattern of a step.** `PASSOS[n] = { cadastro: doc => doc', dia: doc => doc' }`, two pure functions that each see one stored document. `migrar` applies `PASSOS[v][parte]` for every `v` from the stored version plus 1 up to `ESQUEMA` and stamps `esquema: v` (:224-229). The numbers must be contiguous: a missing key throws inside the loop (:227). The comment of a no-op step says which field the number protects and why an older tab would lose it.

**The test of a step** (test/unit/migracoes.test.js, or the feature's file: test/unit/atributos.test.js:172-177 for 23, test/unit/horarios.test.js:97-118 for 12, test/unit/frota.test.js:56-59 for 11, test/unit/config-do-painel.test.js:126-130 for 25): a document at `esquema: n - 1`, then `migrarCadastro` / `migrarDia`, then `deepEqual` with `{ ...expected, esquema: ESQUEMA }`, an unknown field that survives, `assert.ok(ESQUEMA >= n)`; for a new top-level cadastro field also `Object.keys(novo)`. Other tests compare whole documents and move with a step that adds content: storage-dias.test.js:428 (the upgraded cadastro), dias.test.js:28-32 and :164 (the exact key lists of `separar` and `diaParaCopiar`), e2e datas-compartilhado.spec.js:53,78,96. One test hard-codes the current number: `assert.equal(ESQUEMA, 25)` (config-do-painel.test.js:127).

**FORMATO_DOS_CURSOS and the mirror test.** `FORMATO_DOS_CURSOS = 24` (:18) is the cadastro format from which the course programs live in their own tables; the server holds the same number in `public.formato_dos_cursos()` (20261117200000_cursos_e_missoes.sql:23-31). test/unit/espelho-do-banco.test.js compares the two (:77-85), checks that 24 is a step the app already passes (:91-98) and that the migration never compares the cadastro format with a literal number (:104-114). It is the only number the server knows; `salvar_documento` and `salvar_dia` only compare integers.

**How stored data are upgraded.**
1. Every read migrates in memory: `carregarDia` (storage.js:185-186,190), `biDoPeriodo` (:350), `noturnosDaVespera` (js/noturno.js:19). The stored document is not touched by a read.
2. At opening, for a profile that writes: `atualizarFormatoGravado` (called at js/main.js:103). It reads the cadastro and stops if the cadastro is current (storage.js:387-388): the cadastro's number is the marker. Otherwise: each date returned by `diasEmFormatoAntigo(ESQUEMA)` (server `dias_em_formato_antigo`, operators only: 20261114143242_formato_e_status_do_dia.sql:98-113) is read, migrated and written (storage.js:389-393); then the one-off courses conversion if the cadastro is before 24 (:394); then the cadastro, last (:395-397). A failed write throws, no date opens ("Não foi possível preparar os dados da escala. …", js/main.js:118), and the next opening resumes.
3. Cost per format number: the first Operador or Administrador to open the app after the deploy does one read and one `salvar_dia` per stored day, in series, then one cadastro write.
4. A day written at an old format after the listing and before the cadastro write stays old for good (the next opening stops at step 2's first check). Reads still migrate it, so every step has to stay in the code.
5. Readers that do NOT migrate: the SQL functions `horas_dos_instrutores` (reads `resultado.out[].insId`, `h`, `eqType`, `a`, `b`, `fKey`, `status`, plus `fStatus` and `fObs.novoInicio`: 20261115151734_repouso_conta_o_atraso.sql:11-37) and `painel_do_dia` (reads `resultado.out`, `fStatus`, `fObs` of today and `conteudo->'painel'` of the cadastro: 20261120150000_painel_do_dia_com_a_configuracao.sql:37-93), and the TV in local mode (`quadroDoDia(await backendLocal.ler(…))`, js/painel.js:82-83).

**A tab on the old version.**
- Its next save is refused: the day by `salvar_dia` when its format is below the stored day's or below the cadastro's (20261114143242_formato_e_status_do_dia.sql:22-27), the cadastro by `salvar_documento` (:73-77), both with `PT409` and hint `formato`. The backend stops sending anything (supabase.js:63-68), `travarAposConflito({ formato: true })` makes the screen read-only and shows "O app foi atualizado. Recarregue a página para continuar (a sua última alteração não foi salva)." (actions.js:138-145).
- It can still read. A document above its `ESQUEMA` passes through `migrar` unchanged (the loop does not run) and is then read by the old normalizers, which replace anything they do not recognize with a default: `aw` that is not a 9-item array becomes "all windows available" (storage.js:146), `win` likewise (storage.js:85). So an old tab can show wrong data, never save it.
- Between the day rewrites and the cadastro write of one upgrade run, an old tab can still write the cadastro and create new days at the old format (the server compares the day with the cadastro, still old at that moment).
- Local mode has no such protection (5.6).

**What a step may and may not do.**
- May: add a field with a default; convert a representation while keeping the old field; do nothing but carry the number.
- Must: be pure and see only its own document (step 12 could not read the cadastro's `horarios` from the day step and uses the constant `HORARIOS_INICIAIS['PA-34']`, :32); return docs that already have the field untouched (:88,:99,:123,:142); accept `null`, `{}`, `{ importado: true, … }`, `{ simulado: true, … }` and non-object items (migracoes.test.js:31-36); put a new top-level cadastro field before `esquema` in the order `separar` writes (:89-91), because `salvarDia` compares JSON text (storage.js:234-237) and a different order makes every tab rewrite the cadastro at its first save.
- May not: delete a field (README.md:167); reach anything outside the two documents. Not covered by `ESQUEMA` at all: the History and its stored reverts, `solicitacoes`, `resultados_de_missao`, `dados_pessoais`, the course tables, and in local mode `acpm4_historico`, `acpm4_agenda`, `acpm4_resultados`, `acpm4_dados_pessoais`, `acpm4_cursos`.
- A step is not what keeps a field stored: `separar` is (2.5).

**Steps 26, 27 and 28 from parallel branches.**
- Two branches that both add step 26 collide in git: both edit line 13 and both append after step 25 (:210-213). The collision is a merge conflict, not a silent bug.
- A number carries a meaning only from the moment a database holds documents written at it. Renumbering a step that only ever ran in unit tests costs: the `ESQUEMA` line, the key in `PASSOS`, the step's comment, its test (`esquema: n - 1` and the expectations), the README, Manual and plan text that names the number.
- Renumbering after a database was written at the number is the dangerous case, and the code already warns about it for the courses: "com o cadastro já gravado no número do outro, importar_cursos não traria nada, nunca" (espelho-do-banco.test.js:87-90; README.md:171-173). If branch B's preview deployment wrote documents at 26 and B is later renumbered to 27 behind branch A's 26, those documents skip A's step forever. This applies to the preview project as much as to production (inferred: which branch the preview site publishes was not checked, no network).
- Merge order must equal number order. If the branch holding 27 merges first, `PASSOS[26]` is missing and `migrar` throws for every document at 25: the app does not open. The unit tests that migrate an old document catch it.
- Reserving empty slots up front does not help when the order changes: once any deploy writes at 28, documents are past 26 and a step 26 filled in later never runs on them.
- **One number can carry several independent changes.** A step is two functions; step 12 changes the cadastro and the day for different reasons, step 23 sets two attributes, and steps 22 and 24 each cover two or three unrelated new fields with one no-op. What needs a new number is a deploy that stores something an older tab would drop or misread, not a feature. Changes that reach `main` in the same merge can share one number; changes merged separately need one number each, taken in merge order, because GitHub Pages publishes on every merge (README.md:243-244).

### 5.4 The write path
**`gravarAlteracao(tipo, descricao, reverter = null, reverte = null)`** (actions.js:189-195): returns without doing anything when `isGestor() || aindaNaoAbriu()`; otherwise `save()` once, then `logChange` for the description, or for each item when it is a list. Without a description it only saves. The handler changes `S` in place BEFORE calling it, so the guard inside it is the last line of defence; the real guard is at the entry.

**`save()`** (private, actions.js:166-182): no-op when `isGestor() || !dadosLidos`; `refazerEscala()` runs the engine and redraws; `gravacaoAtual = ApiClient.salvarDia(DATA, S, RES)`. Its only callers: `gravarAlteracao` (:191), `gravarEscalaCalculada` (:201, the three exports) and `lerDadosDeNovo` (:106). The last two save without a History entry.

**`ApiClient.salvarDia`** (storage.js:229-242): the cadastro is written only when `JSON.stringify` of it differs from `cadastroGravado`; the day is ALWAYS written, also when only the cadastro changed. So editing a name or a weight with date D open creates or rewrites day D (with D's recomputed schedule) and can conflict with a colleague working on D. Stored schedules of other dates are not refreshed.

**`logChange(type, texto, revertAction, reverte)`** (actions.js:212-239): the entry appears at once with `estado: 'gravando'`; in a microtask it waits for `gravacaoAtual` (the latest save of the same event) and only then calls `ApiClient.registrarHistorico`; a refused save leaves the entry "não gravada" and nothing goes to the server. Description cut at 500 characters (:205).

**`lerData(data)`** (actions.js:286-317): sets `dadosLidos = false`; waits for `dadosProntos` (the opening's preparation, :271-277) and for the previous read; a request overtaken before it starts does not read; reads `carregarDia` and the History; a read overtaken while reading reaches the screen only if it is the open date; `dadosLidos` becomes true only for the newest request. A thrown read leaves `dadosLidos` false until some date opens.

**`aindaNaoAbriu()`** (actions.js:154-158): answers true with the toast "A escala ainda não abriu: nada foi mudado. Espere os dados chegarem ou recarregue a página."

**Versions.** `backend.ler` stores the version read per document (supabase.js:98-108; `guardarVersao: false` only consults); `gravar` queues the latest content per document and sends `p_versao_lida`, 0 creating the row (supabase.js:46-62,110-114); a success stores the new version.

**Failures and what the user sees.**

| Server answer | Backend | Screen |
|---|---|---|
| `PT409`, no hint (someone else wrote the cadastro or this day first) | `bloqueado = true` for every document and for the History; `aoConflito` (supabase.js:63-68) | "Outra pessoa alterou a escala enquanto você editava. A tela ficou só para consulta: recarregue para ver a versão atual e continuar (a sua última alteração não foi salva)."; `data-role="gestor"`, `ApiClient.readOnly = true`; the entry shows "não gravada"; button "Recarregar" (actions.js:138-145) |
| `PT409`, hint `formato` | same | "O app foi atualizado. Recarregue a página para continuar (a sua última alteração não foi salva)." |
| no answer, 5xx, 408, 429 | the content waits; retry after 2 s, 4 s, 8 s up to 30 s and when the browser is online again (supabase.js:15-25,79-82) | "Sem conexão com o servidor: N alterações esperando para serem gravadas. …", no reload button (actions.js:124-135); leaving the page asks for confirmation (js/main.js:58-62) |
| 401 | waits for `aoSessaoExpirada` (supabase.js:69-73) | dialog "Entre de novo" (sessao.js:78-105) |
| any other refusal (42501, 23514, …) | dropped, not blocked (supabase.js:74-78) | "O servidor recusou a última alteração (motivo): ela não foi salva. Recarregue a página para voltar à escala gravada." (actions.js:112-122) |
| local mode, `localStorage` refuses | `gravar` answers false (local.js:95-106) | "Não foi possível salvar neste navegador (o espaço de armazenamento pode ter acabado): …" (actions.js:171-175) |

- The cadastro is one document with one version for everybody. A tab whose cadastro is stale keeps saving days without conflict (its cadastro JSON has not changed) and computes schedules with the stale roster; its first cadastro edit gets PT409 and locks the screen. The plan records that cadastro writes "caused 409s between people on different dates" (docs/PLAN.md:271).
- Write paths that do not go through `gravarAlteracao`, each with its own rules: personal data (`ApiClient.salvarDadosPessoais`, own version `atualizado_em`; PT409 is a message inside the panel, js/views/dados-pessoais.js:139-146); pedidos (`registrarSolicitacao`, `cancelarSolicitacao`: no version, not gated by `aindaNaoAbriu`, js/eventos/agenda.js:67-68,138-139); results (`registrarResultado`, then `logChange` alone or `ApiClient.registrarHistorico` for another date, js/eventos/escala.js:245-256); courses (`salvarCurso`, one queue per course, PT409 is a toast and never locks, js/eventos/cursos.js:133-140,179-208); accounts; and in local mode the simulated days and "Limpar o histórico" (js/eventos/bi.js:71; js/eventos/historico.js:39). One view module calls `gravarAlteracao` itself (js/views/config-do-painel.js:76).

**What a new screen has to do.**
1. Change `S` inside an event handler and call `gravarAlteracao` once per user action. Never call `ApiClient.backend` or `ApiClient.salvarDia`.
2. Register through `aoAcionar` (`data-act`) or `aoMudarCampo` (`data-f`, `data-a`, rows with `data-k`): they refuse for `isGestor()` and before the date opens, and the field handler redraws the tabs (registro.js:24,41-46). A handler with its own listener checks `isGestor() || aindaNaoAbriu()` before touching `S` and redraws the control (as js/eventos/escala.js:199,224,239,271 and js/eventos/cadastros.js:232,245 do).
3. Controls that only change what is seen (search, filters, selecting a row of the list, opening a section, the view switch) carry no `data-act`, `data-f` or `data-a`; an input or select inside `main` needs the class `flt-ctrl`, or `somente-leitura.js` disables it for the Gestor (:5-9). That module covers only `main` and `#painel-instrutor`: an input placed in a pane outside `main` is not disabled for read-only profiles unless its selector is added.
4. After any `await`, compare `DATA` with the date captured before it and call `aindaNaoAbriu()` again (js/eventos/agenda.js:33-47; js/views/selos.js:39-42; actions.js:86-92; js/eventos/escala.js:251).
5. Change the date only through `carregarData(data)` (actions.js:321-328) and handle its rejection (js/eventos/topo.js:40-43). The Sunday rule is repeated in js/eventos/topo.js:35-39,51, js/eventos/agenda.js:24 and js/main.js:76,89-90.
6. A new stored field needs all of: `separar`, `juntar`, a normalizer in `normalizeAndMigrateState`, the decision for a new date in `diaPadrao` and `diaParaCopiar`, a step and a new `ESQUEMA`, and the tests listed in 5.3.
7. Personal data never enter `S`: they are read with `ApiClient.lerDadosPessoais`, saved with `ApiClient.salvarDadosPessoais` and the version read, and their History entry is written by the server.
8. A History description has at most 500 characters and no personal data value; a revert must be one of the kinds `validarReversao` knows, or it never becomes a button.

### 5.5 The History
- An entry: `id`, `data`, `registrado_em`, `usuario`, `autor`, `tipo` in (`inc`, `exc`, `mod`), `descricao` (1 to 500 characters), `reverter` jsonb, `reverte` (id of the entry it undoes), `importado` (20261110201618_dias_e_historico.sql:64-74). On screen `tipo` reads "Inclusão", "Exclusão", "Edição" (js/views/escala.js:282-283).
- Who and when: the server fills `usuario`, `autor` (the profile's name, else the e-mail) and `registrado_em` (20261110202010_historico_autor.sql:19-24). While it waits, the entry shows `ApiClient.autorAtual` and "gravando…"; refused, "não gravada" (js/views/escala.js:289-293). Local mode: `autor: null` (local.js:129).
- It belongs to a date, is read with the date (the 200 newest: supabase.js:172) and only grows; "Reverter" adds a new entry with `reverte` set, and the reverted entry stops being listed (js/views/escala.js:271-272). The counter `#log-cnt` counts the listed ones.
- What writes entries: every `gravarAlteracao` with a description (49 call sites: js/eventos/cadastros.js 11, demanda.js 10, historico.js 9, recursos.js 9, escala.js 6, agenda.js 1, agendamento.js 1, rodizio.js 1, js/views/config-do-painel.js 1); `logChange` alone for the weights typed in a booking (js/eventos/agendamento.js:38) and for a mission result (js/eventos/escala.js:255); the server itself for personal data (20261114151953_dados_pessoais_versionados.sql:110-116), shown by `mostrarNoHistorico` (js/eventos/cadastros.js:43); the one-off import of the old history.
- What writes none: the instructor's windows `aw` and the "Aplicar turno…" preset (js/eventos/cadastros.js:173-181), course program changes (kept as course versions, js/eventos/cursos.js:9-10), registering or cancelling a pedido (the row holds who and when), exports, "Tentar de novo", the format upgrade, accounts.
- The nine revert kinds (`validarReversao`, js/reversoes.js:43-117) and where each is created:

| `kind` | Undoes | Created at |
|---|---|---|
| `setFly` | "Voa" of a pedido, with its extras | js/eventos/demanda.js:42,190,221 |
| `setAv` | "Disponível" of a resource | js/eventos/recursos.js:126 |
| `setAtributo` | an attribute of a resource | js/eventos/recursos.js:86 |
| `setInsOn` | "Vem" of an instructor | js/eventos/cadastros.js:146 |
| `restaurarFixos` | a Sugestões repair (pins, and the chosen instructor of the pedidos) | js/eventos/escala.js:290 |
| `restaurarEscolha` | the chosen instructor | js/eventos/escala.js:183; js/eventos/demanda.js:208 |
| `restaurarHorarios` | the take-off times of a category and the pedidos that moved with them | js/eventos/recursos.js:213 |
| `readicionarRecurso` | "Retirar" of a resource | js/eventos/recursos.js:155 |
| `desfazerAgendamento` | a flight booked on the Escala (label "↶ Desfazer") | js/agendamento.js:1273-1274 |

- Stored reverts are a second persisted format that no step migrates. They address pedidos by `stuId` and `mid`, and `desfazerAgendamento` stores a whole pedido snapshot (`CAMPOS_DO_PEDIDO`) and the instructor's availability as `{ insId, on, aw }` with exactly nine booleans (js/reversoes.js:30-40). An entry whose stored revert no longer validates loses its button (js/reversoes.js:112).
- How personal data stay out: they are never in `S`, the cadastro or the day (2.3; only seven modules import them: js/backends/local.js, js/backends/supabase.js, js/storage.js, js/main.js, js/eventos/cadastros.js, js/views/cadastros.js, js/views/dados-pessoais.js); the entry text is built from field labels only (`camposAlterados`, js/dados-pessoais.js:63-65; SQL :92-97,111); the free text of a cancellation reason never goes, only its category (js/status.js:1-3). Reverts hold ids and schedule data, no names.
- Names and weights are not treated as personal data here: descriptions carry names, and "Peso <nome>: <n> kg" (js/eventos/cadastros.js:156,200; js/agendamento.js:1278).

### 5.6 Local mode
Every `localStorage` key:

| Key | Content | Evidence |
|---|---|---|
| `acpm4_cadastro` | the cadastro | local.js:13 |
| `acpm4_dia_<AAAA-MM-DD>` | one day | local.js:15 |
| `acpm4_historico` | the History of all dates, last 1000 entries | local.js:16,130 |
| `acpm4_agenda` | every pedido | local.js:17 |
| `acpm4_dados_pessoais` | `{ 'aluno:<id>': {…}, 'instrutor:<id>': {…} }` | local.js:18 |
| `acpm4_resultados` | every mission result | local.js:19 |
| `acpm4_cursos` | `{ cursos, alteracoes }`, last 200 changes | local.js:21-22,59 |
| `acpm3`, `acpm3_res`, `acpm3_audit`, `acpm3_bi` | the old undated documents `estado`, `escala`, `historico`, `bi` | local.js:13 |
| `acpm2` | the oldest format (7 windows), converted on read | local.js:14,72-83,91 |
| `acpm3_theme` | the theme, both modes | storage.js:34; js/eventos/topo.js:77,87 |
| `acpm_agenda_registrado_por` | the last "Registrado por", both modes | js/views/agenda.js:15,95,205 |
| `acpm-<projeto>` | the app's Supabase session (plus supabase-js keys starting with it) | config-supabase.js:23,26 |
| `acpm-<projeto>-painel` | the TV's session | config-supabase.js:23 |
| `acpm-<projeto>-painel-entrada` | the TV's e-mail and password, in clear text | config-supabase.js:27; js/sessao-da-tv.js:43-64 |

Rules that keep it equal to the server: the same pure function runs on both sides or is checked against the SQL.
- The agenda deadline: `prazoDaAgendaPermite` (js/agenda.js:38-43) in `registrarSolicitacao` (local.js:161-184), with the server's codes `PT403`, `22023`, `23514`, `PT422`, `P0002` (local.js:67).
- Personal data: `gravarDadosPessoais` and `semQuemSaiu` (js/dados-pessoais.js:75-113); writing the cadastro deletes the personal data of who left it (local.js:99-103), as `salvar_documento` does (20261114151953_dados_pessoais_versionados.sql:164-170).
- Hours: `acumularHoras` (js/limites.js:55-70). Results: `validarRegistro`, `situacaoPorMissao` (js/resultados.js). Courses: `gravarCurso`, `importarProgramas`, `programaComResultados` (js/programa.js), including the format check `PT409` / `formato` (backend-local.test.js "antes do formato dos cursos, o programa espera a conversão (PT409 formato); sem cadastro, grava").
- Tests: test/unit/backend-local.test.js; test/unit/espelho-do-banco.test.js; the shared cases of test/helpers/casos-do-programa.js.

Where local mode is NOT the server:
1. No version and no format check on the cadastro and the days: `gravar` is a bare `setItem` (local.js:95-106). Two tabs overwrite each other silently, and an old tab can write an older format over a newer one.
2. No profiles: the user has operator rights, the Exceção included (local.js:153), and edits courses and limits as non-Gestor (js/views/cursos.js:36; js/views/cadastros.js:75).
3. Ids are `Math.max(Date.now(), …)` (local.js:46), thirteen digits, not a small sequence.
4. The History keeps 1000 entries of all dates and can be cleared (local.js:130,141-144).
5. No accounts, no meteorologia (storage.js:345-347).

### 5.7 Profiles on the client
State: `ApiClient.perfil` is the account's profile in shared mode, `null` in local mode (sessao.js:169). `setRole(operaEscala(perfil) ? 'operador' : 'gestor', !operaEscala(perfil))` (sessao.js:171): Gestor and Secretaria get `body[data-role="gestor"]` and `ApiClient.readOnly = true`; `body.dataset.perfil` holds the real profile (sessao.js:165); `body.dataset.agenda` is `edita` or `consulta` (actions.js:60). `isGestor()` is `ApiClient.readOnly || data-role === 'gestor'` (state.js:25). "(The server checks everything again: these rules only decide what the screen shows)" (perfis.js:2).

| Capability | Operador | Administrador | Gestor | Secretaria | Evidence |
|---|---|---|---|---|---|
| Opens the app | yes | yes | yes | yes, on the Agenda | js/main.js:134. Profile `painel`: sent to `painel.html` (sessao.js:140-147). No profile: "#sem-acesso" (sessao.js:130-137) |
| Tabs | all nine | all nine | all nine | Escala, Agenda, Instrutores, Alunos, Cursos | css/app.css:184-186 |
| Changes the date | yes | yes | yes | yes | actions.js:56 (blocked only for the local-mode Gestor) |
| Edits the cadastro and the day (every `.edit-only`, `data-act`, `data-f`, `data-a`) | yes | yes | no | no | css/app.css:235; registro.js:24,41; somente-leitura.js:5-21 |
| Registers and cancels pedidos | yes | yes | no | yes | perfis.js:7; js/views/agenda.js:23; css/app.css:1172-1173 |
| Exceção da Coordenação; "Importar da agenda" | yes | yes | no | no | js/views/agenda.js:24-26,193,212 |
| Sees and edits personal data (one predicate for both) | yes | yes | no | yes | perfis.js:12; js/views/dados-pessoais.js:15,56; css/app.css:237 |
| Edits the legal limits | no | yes | no | no | js/views/cadastros.js:75 |
| Edits the course programs | no | yes | no | no | js/views/cursos.js:36 |
| "Usuários" (accounts) | no | yes | no | no | sessao.js:164; js/views/conta.js:20 |
| "Minha conta" | yes | yes | yes | yes | sessao.js:163 |
| "Configurar painel" | yes | yes | sees, disabled | sees, disabled | js/views/config-do-painel.js:20; button at js/views/painel-aeroporto.js:189 |
| History drawer | yes | yes | yes | hidden | css/app.css:187 |
| "Reverter" | yes | yes | no | no | js/views/escala.js:287 |
| Mission results, status, Aprovar, Reabrir, critérios, Sugestões, "+ Agendar voo" | yes | yes | no | no | js/eventos/escala.js:199,224,238,268,271; js/views/escala.js:57,335 |
| "Compartilhar" | yes | yes | yes | hidden | css/app.css:188 |
| CSV, PDF, Excel | yes, and saves a calculated schedule | same | exports, saves nothing | same as Gestor | index.html:359-361; actions.js:167 |
| Search, filters, view switches | yes | yes | yes | yes | class `flt-ctrl`, no `data-act` |
| Agenda badge `#selo-age` | yes | yes | no | no | js/views/selos.js:53 |
| Format upgrade and conversions at opening | yes | yes | no | no | storage.js:360,386 |
| Default view of Instrutores | Disponibilidade do dia | same | same | Cadastro | js/views/vistas.js:10-13 |

- Local mode: `#role-sel` or `?role=` switches Operador / Gestor (js/eventos/topo.js:17-21; js/main.js:123); the non-Gestor has every right above, the Administrador's included; the Gestor cannot even change the date (actions.js:56). `ApiClient.readOnly` stays false; the guards use `isGestor()`.
- After a conflict any profile becomes `data-role="gestor"` with `readOnly` (actions.js:139). The Agenda form and the personal-data predicate still answer by `ApiClient.perfil`, but the "Dados pessoais" buttons and the CANAC column (`.so-dados`) are hidden by CSS for every `data-perfil` other than `secretaria` (css/app.css:237).
- The personal data panel `aside#painel-dados` is outside `main` (index.html:664,680), so `somente-leitura.js` does not disable its fields; that is how the Secretaria types in it while everything else is disabled.

### 5.8 A derived Demanda
**What the saved schedule depends on.** `resultado = { ...runAllocationEngine(S), data: DATA }` (actions.js:367). The engine reads `state.stu` (with the pedido fields and `extra`), `ins`, `av`, `frota`, `win`, `fixos`, `fStatus`, `fObs`, `horas`, `horarios`, `hangar`, `filas`, `limites`, `noturnosDaVespera` (grep of `state.` in js/engine.js) and `horasDosInstrutores` through `historicoDoDia` (js/noturno.js:44-52); the compaction reads `criterios` (js/compactar.js:64,77). On reopening a date, a stored schedule that passes `normalizarEscalaGravada` and `voltasConferem` is shown as it is and is NOT recomputed (storage.js:205-206; actions.js:309): a saved day is a snapshot, refreshed only by the next `save()` on that date.

**Who reads the stored schedule of a date** (so `resultado` has to stay stored): the BI (dias.js:172-180), the instructors' hours of later dates (SQL and js/limites.js), the next day's `horas` and `filas` (dias.js:127-137; js/rodizio.js:34-46), the next day's Noturno return leg (js/noturno.js:17-30), the TV (`painel_do_dia`), and the exports.

**What the day would still need to store.**

| Day field | With pedidos derived from approved `solicitacoes` |
|---|---|
| `win`, `av`, `ins` (`on` and availability), `horas`, `filas`, `hangar`, `criterios`, `aprovacao`, `fStatus`, `fObs`, `resultado` | unchanged: none of them comes from a pedido |
| `fixos` (operator restrictions) | unchanged, but keyed by `fKey = <stuId>_<mid>_1`, like `fStatus`, `fObs`, the `voo` of a mission result (20261114120000_resultados_de_missao.sql:12) and the stored History reverts. Each derived pedido needs a `mid` that never changes when another pedido of the same student is approved or cancelled. Today the number is allocated once and stored (`proximoMid`, js/rules.js:67-72) |
| `pedidos[...].insId`, `pr`, `p2`, `eq`, `nb`, `jan`, `etapa`, `cursoDaEtapa` set by the operator | need a home: a `solicitacoes` row has `missao`, `horario`, `horas`, `observacao` and no recurso, priority, second preference, chosen instructor or course mission (20261110222506_agenda_de_solicitacoes.sql:6-24). Either columns of the pedido or per-date restrictions kept in the day, keyed by the pedido |
| `pedidos[...].fly` false with leftovers (a student taken off who keeps the slot) | a per-date "does not fly" mark keyed by the pedido, or the pedido's own state |
| `importadas` | replaced by the approval state; still present in old days. Today "Limpar demanda" does not clear it (js/fixos.js:95-117), so cleared pedidos cannot be imported again |
| which approved pedidos the saved `resultado` was computed from | new: without it the client cannot tell that an approval or a cancellation made after the last save left the stored schedule stale |

**Cost of reading the pedidos of the open date on every date change.**
- Queries: none added. The app already reads them after every date open (`lerPedidosDaData`, js/views/selos.js:38-45; called at actions.js:326 and js/main.js:139): one `solicitacoes` query filtered by the date. What changes is its place: today it runs after the screen is drawn and a failure is swallowed (`.catch(() => [])`); for a derived Demanda it has to finish before `setS` (actions.js:305), inside `lerData`, because the engine input depends on it.
- Failure mode: it becomes a fifth "read beside" next to hours, results and programs. Without it the date must still open (as `indisponiveis` does today, storage.js:210-211), and a schedule computed from zero pedidos must never be saved over the stored one. That is a new guard next to `dadosLidos`.
- Versions: `solicitacoes` has no version and the day's conflict check does not cover it. A pedido approved by someone else after the date was read is unseen until the next read; there is no realtime. Today the only moment pedidos enter the day is an explicit click that re-reads them first (js/eventos/agenda.js:36).
- Who saves: read-only profiles cannot write the day. If they open a date whose approved pedidos changed, they see a recomputed schedule that is not the stored one, while the TV, the BI and the hours keep reading the stored one until an Operador or Administrador saves that date.
- Offline: writes queue and retry, reads fail. A date change offline already fails on the cadastro read; the pedidos add nothing there.
- Local mode: pedidos are in `acpm4_agenda`, read synchronously; no cost. The approval and its rules have to be written again in local.js and in the two test fakes (1.3). Local pedido ids are `Date.now()` values (local.js:46,176), above the limit a saved schedule accepts for `mid` (`inteiro(v, 0, 1e9)`, js/escala-gravada.js:37), so a pedido id cannot be used as `mid` there.

## 6. Conflicts with the request

| # | The request assumes | The code | Evidence |
|---|---|---|---|
| C1 | "`gravarAlteracao` stays the only way events change data" | True for the cadastro and the day only. Personal data, pedidos, mission results, course programs and accounts each have their own write path; exports and "Tentar de novo" call `save()` with no History entry; one view module calls `gravarAlteracao`; in local mode two buttons write through `ApiClient.backend` directly. A pedido approval will be one more path outside it | js/views/dados-pessoais.js:139; js/eventos/agenda.js:99,147; js/eventos/escala.js:245-256,90-92; js/eventos/cursos.js:185; js/views/config-do-painel.js:76; js/eventos/bi.js:71; actions.js:106,201 |
| C2 | "nothing is saved before the date's data is read" | Not true for pedidos and personal data: registering or cancelling a pedido checks only `podeEditarAgenda()`, and the personal data panel only its own read. The plan says so itself | js/eventos/agenda.js:67-68,138-139; js/views/dados-pessoais.js:127-135; docs/PLAN.md:358 |
| C3 | "Data-format steps never delete fields" as the guarantee that nothing is lost | The steps keep unknown fields, but the save path is a whitelist: `separar` and the loaders drop every field they do not list. Removing `state.win`, or replacing `aw`, is decided in `separar` / `juntar`, not in a step; a field left out vanishes from each document at its next save | dias.js:41-47,56-72,82-111; js/frota.js:62; README.md:167 |
| C4 | "The server refuses older formats" | Only writes, only in shared mode. Reads of a newer format by an old tab go through with defaults; the local backend has no format or version check | 20261114143242_formato_e_status_do_dia.sql:22-27,73-77; migracoes.js:227; local.js:95-106 |
| C5 | "Today `salvar_dados_pessoais` accepts the Secretaria, so this needs a migration" | Confirmed, and wider: one predicate `le_dados_pessoais()` gates BOTH reading (the table policy) and writing; the old three-argument `salvar_dados_pessoais(text, integer, jsonb)` still exists (no migration ever dropped it), also accepts the Secretaria, and has no version check and no History entry; on the client one predicate `veDadosPessoais` gates seeing and editing. The request does not say whether the Secretaria keeps SEEING personal data. Tests and defaults pin today's behaviour | 20261113150000_dados_pessoais.sql:55-69,73-90; 20261114151953_dados_pessoais_versionados.sql:10-11,36; perfis.js:12; js/views/dados-pessoais.js:15; test/unit/perfis.test.js:12-15; dados-pessoais.test.sql:43,109,112; test/e2e/dados-pessoais.spec.js:114,141,276; js/views/vistas.js:4-5,11; docs/PLAN.md:274 |
| C6 | The Alunos detail edits "CANAC, CPF, nome completo, curso, …, peso, preferências, nascimento" in one place | These fields sit in three stores with three write paths and three conflict models: the cadastro (`nm`, `kg`, `curso`, `voaCom`, `bl`: one version for the whole cadastro, a conflict locks the screen), `dados_pessoais` (CPF, CANAC, nascimento, celular, e-mail: one version per person, a conflict is a message), mission results (append-only). There is no "nome completo": only `nm`, at most 80 characters, readable by every profile and shown shortened on the TV | dias.js:47; 20261113150000_dados_pessoais.sql:34-45; js/format.js:54; 20261120150000_painel_do_dia_com_a_configuracao.sql:65 |
| C7 | Recursos detail "shows the hours available until the inspection and the maintenance status" as cadastro information | Both are per date: `dia.horas[reg]` and `dia.av[reg]`. The cadastro of a resource holds only `reg`, `tipo` and three attribute flags | dias.js:57,65; js/eventos/recursos.js:122-145; js/frota.js:62 |
| C8 | Deactivation "is cadastro-level … find how `on`, 'Vem', 'Disponível' and 'Retirar' work today" | No cadastro-level inactive state exists for anyone. `on` ("Vem"), `av` ("Disponível") and `fly` ("Voa") are per date and copied to the next new date; "Retirar" and "✕" delete the cadastro entry for all dates, and deleting a person makes the server delete that person's personal data | dias.js:58,118-123; js/eventos/recursos.js:149-159; js/eventos/cadastros.js:111-132; 20261114151953_dados_pessoais_versionados.sql:164-170 |
| C9 | Convert `aw` to ranges in a step, "The goldens must not change" (cross-area) | The goldens are fed raw generated states, not stored documents: each of the 40 scenario files stores a `hash` of its input state and the test fails when the hash changes; all 40 inputs carry `aw` with windows off. A step in `migracoes.js` never touches them; what decides is whether the in-memory state the engine receives changes shape. `aw` is also stored in History reverts (nine booleans required) and set by the booking and the presets | test/unit/engine.golden.test.js:17-23; test/helpers/cenarios.js:50,94; js/reversoes.js:39-40; js/agendamento.js:938; js/eventos/cadastros.js:75,177 |
| C10 | Remove `state.win`; the goldens change only in rule-change commits (cross-area) | 22 of the 40 golden scenarios have at least one closed window in their input (`win` drawn at random), and the engine reads `state.win` in three places. An engine that stops reading `win` changes those goldens | test/helpers/cenarios.js:85; js/engine.js:446,601,811 (count obtained by running the generator) |
| C11 | Processamento "with no data of its own" | The day stores the pedidos, and five other things are keyed by the pedido's `stuId` and `mid`: `fixos`, `fStatus`, `fObs`, the `voo` of mission results, and the stored History reverts. Operator choices live inside the pedido (`insId`, `pr`, `p2`, `eq`, `nb`, `etapa`). See 5.8 | dias.js:22,59-62; js/voo.js:4-5; js/reversoes.js:30-36,102-115 |
| C12 | Pipeline sub-task "Aprovar: … exportada" | Nothing records that a date was exported. The exports only save a schedule that was merely calculated | js/eventos/escala.js:90-92; actions.js:199-202 |
| C13 | "Personal data stays out of … the History, as today" | Holds for the five `dados_pessoais` fields. Names and weights are written into History descriptions and into the saved schedule, and are not treated as personal data by the code, although the test rule treats names and weights as sensitive | js/eventos/cadastros.js:156,200; js/agendamento.js:1278; js/escala-gravada.js:40-41,46-47; README.md:54 |
| C14 | "give every data-format step its number in the plan, so parallel branches do not collide" | A number fixed in advance is safe only if merge order equals number order; a gap makes the app fail to open, and a number whose meaning changes after any database was written at it leaves documents that skip a step. One number can cover several changes that ship together (5.3) | migracoes.js:224-229; test/unit/espelho-do-banco.test.js:87-90; README.md:171-173 |

Confirmed, no conflict: `ESQUEMA` is 25 (migracoes.js:13); `aw` is nine booleans, one per `WIN` entry (js/config.js:4; storage.js:146); the nine tabs and their order (index.html:92-102); the Gestor is read-only and without personal data (20261113150000_dados_pessoais.sql:62; css/app.css:237).

## 7. Implications and options for the redesign (suggestions)

1. **Format numbers.** (a) The plan fixes the ORDER of the format changes and each PR takes `ESQUEMA + 1` when it rebases for its merge. Cost: a small renumbering in a late PR (the line, the key, the comment, the test, the docs). Risk: a branch deployed to the preview at a number it later loses leaves preview documents that skip a step; reseed the preview or never renumber what the preview has written. (b) One step, 26, in the serial foundation, carrying every format change of the redesign (the whitelists, normalizers and conversions land before the screens use them). Cost: every stored shape must be decided before the parallel work starts; one rewrite of all stored days instead of three. Risk: a shape discovered late still needs 27. (c) Pre-assigned 26, 27, 28 per workstream. Cost: none up front. Risk: the highest; safe only with a forced merge order.
2. **A round-trip test per step.** Assert that the cadastro as `atualizarFormatoGravado` stores it equals, as JSON text, what `salvarDia` would write back after `juntar`, `normalizeAndMigrateState`, `separar`. It holds today (checked for an upgraded and an app-written cadastro). Cost: one unit test. Risk if skipped: a new field whose default the normalizer adds but the step does not makes every tab rewrite the cadastro at its first save, with PT409 between two operators.
3. **Deactivation flag stored only when inactive** (absent means active), as `voaCom`, `curso`, `painel` and the resource attributes are stored only when set. Stored documents then stay byte-identical and the step is a no-op. Cost: `separar`, `juntar` / `normalizarFrota`, the normalizer, every reader. Risk: a reader that forgets the flag keeps scheduling an inactive person; deactivation takes effect on stored dates only when each is next saved.
4. **Derived Demanda: materialize or recompute.** (a) Keep `dia.pedidos` as the stored OUTPUT of the Processamento module, never edited by hand, plus the list of approved pedido ids it was built from (the successor of `importadas`); the module emits today's state shape. Cost: the lowest; `fixos`, statuses, results, History reverts, the SQL readers and the goldens stay as they are. Risk: it is not literally "no data of its own"; a refresh rule is needed (when the approved set differs from the stored list). (b) Recompute from the pedidos at every open and store no pedidos. Cost: a stable `mid` per pedido, a home for every operator choice now inside the pedido, a staleness rule for `resultado`, and a new format for stored reverts. Risk: pins, statuses and results attached to the wrong flight when the set of approved pedidos changes.
5. **Pedidos read inside `lerData`** as a fifth entry of `indisponiveis` (`'pedidos'`), with "no save of a schedule built without the pedidos". Cost: `carregarDia`, `lerDadosAParte`, the notice texts, the abertura tests. Risk: without the guard, an offline moment wipes a stored schedule.
6. **Cadastro contention.** In-place editing in three master-detail screens means many more cadastro writes against one version. (a) Keep the single document and accept "conflict locks the screen, reload". Cost: none. Risk: more lost edits as soon as two people maintain cadastros at once. (b) Re-read the cadastro and retry once when a PT409 hits a cadastro-only change. Cost: a merge rule per field and new tests of the write queue. Risk: subtle; it weakens today's simple guarantee. (c) Split people and resources into rows with their own versions, as `dados_pessoais` already is. Cost: a server migration, a new backend surface, three mirrors, a data conversion. Risk: the largest change of the redesign.
7. **BI read on every date change.** `carregarData` downloads every stored day of the month with full content. With the rail calendar making date changes cheaper for the user, load the BI only when its tab is open. Cost: `carregarData`, `carregarBI`, the BI tests. Risk: low.
8. **`aw` to ranges.** Decide explicitly whether `separar` keeps writing `aw` beside the ranges for one release (old tabs then read something sensible) and keep a reader for the nine-boolean `disponibilidade.aw` of stored reverts, or accept that old "↶ Desfazer" buttons disappear. Cost: one compatibility branch in `validarReversao`. Risk: without it, `desfazerAgendamento` writes an `aw` nobody reads.
9. **Personal data permission.** Split the server predicate into read and write, change both `salvar_dados_pessoais` overloads or drop the three-argument one, split `veDadosPessoais` on the client, and update perfis.test.js, dados-pessoais.test.sql and the three e2e tests named in C5. Cost: one migration, pgTAP, three mirrors. Risk: dropping the old overload while a pre-format-25 tab is still open breaks only that tab.
10. **Approval logged by the server.** Let the approval function write the History entry itself, as `salvar_dados_pessoais` does, so it does not depend on the client's write queue or on the open date. Cost: SQL plus the mirrors. Risk: the entry appears in the History of the pedido's date, which may not be the open one.

## 8. Open questions for Pedro

1. After the change, does the Secretaria still see personal data (read-only), or lose both seeing and editing? Does the same apply to the INVAs' personal data?
2. When a pedido is approved or cancelled for a date whose schedule is already saved or approved, who recomputes that schedule and when? Today only an Operador or Administrador with that date open can save it.
3. Where should the operator's choices that live inside a pedido today go: the chosen instructor, the priority, the second preference, the resource, the mission of the course?
4. Is "nome completo" a new field, different from the name the schedule shows, and is it personal data (hidden from the Gestor and the TV)?
5. Is weight personal data? Today it is written into History entries and into every saved schedule.
6. Deactivating a student, resource or INVA: what happens to pedidos already registered or approved, to pinned flights, to the rodízio queue position, and to dates already saved?
7. Do the availability ranges of a date carry over to the next new date, as `on` and `aw` do today?
8. Should the app record that a date was exported (who, when, which format)?
9. Will the format changes ship in one deploy or one per workstream? This decides how many format numbers the plan needs.
10. How many people will edit the cadastros at the same time? This decides whether "a conflict locks the screen until reload" is still acceptable.
11. Must local mode (localhost, and most e2e tests) get the pedido approval too, with the same rules?

<!-- fim -->
