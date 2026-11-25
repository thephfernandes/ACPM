# Mapa: Pedidos: the Agenda de Solicitações today

Read at worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to the worktree root.
"Probe" = a read-only `node` run of pure modules from the session scratchpad (nothing written in the worktree).
`node --test test/unit/agenda.test.js`: 31 tests, 3 suites, all pass at this commit.

Vocabulary used below, because the words collide (see 5.7):
- **pedido (Agenda row)** = a row of the table `solicitacoes`; in code it is called `solicitacao`.
- **request (Demanda)** = an entry of `S.stu[]` or of `S.stu[].extra[]`; in code it is called `pedido` (`CAMPOS_DO_PEDIDO`, `dia.pedidos`).

## 1. What exists

- **A tab "Agenda"** (`<button data-t="age">`, index.html:94) opening `<section id="s-age">` with the title "Agenda de Solicitações" (index.html:273-296): a month calendar (`#agenda-cal`), a registration form (`#form-agenda`), an import button (`#agenda-importar`) and the list of the chosen day (`#agenda-lista`).
- **Three JS modules**: `js/agenda.js` (pure: deadline, pedido-to-request mapping, import, local-flight limit; 152 lines), `js/views/agenda.js` (render and the page's own state; 213 lines), `js/eventos/agenda.js` (handlers; 155 lines, no exports).
- **One server table** `public.solicitacoes` with one read policy and four functions (5.1). Writes only through RPCs. In local mode the same data lives in `localStorage['acpm4_agenda']` (js/backends/local.js:17).
- **A pedido has two stored states**: active or cancelled (soft, a flag), plus the flag `excecao`. "Imported" is not a state of the pedido: it is a list of ids in the day document (`importadas`, js/dias.js:29,34,71,110).
- **"Importar da agenda"** (Demanda, `#importar-agenda`, index.html:302) and **"Importar N pedidos para a demanda"** (Agenda, `#agenda-importar`, index.html:292) call the same handler `importarDaAgenda` (js/eventos/agenda.js:31-61), which runs the pure `importarSolicitacoes` (js/agenda.js:107-140) on all pending pedidos of the open date at once (no per-pedido choice) and saves through `gravarAlteracao('inc', [...])` (js/eventos/agenda.js:53-55).
- **The agenda is the hub of the day** (decision of 2026-11-14, docs/PLAN.md:305-306): a new date starts with an empty demand (`diaParaCopiar`, js/dias.js:114-123) and the import builds it.
- **A badge** `#selo-age` on the tab (index.html:94) counts pedidos of the open date not yet imported (js/views/selos.js:47-55).
- **Registering and cancelling never touch the History and never go through `gravarAlteracao`**: they call `ApiClient.registrarSolicitacao` / `cancelarSolicitacao` directly (js/eventos/agenda.js:99-102,147; js/storage.js:284-290). The audit trail is the row itself. Only the import writes a History entry (tipo `inc`, text `Agenda: <aluno_nome> incluído (<missão> · às HH:MM · N h)`, js/eventos/agenda.js:54-55), with no `reverter` action (the import cannot be undone from the History).
- **No polling and no realtime**: the only `setInterval` in the app proper is the Painel clock (js/views/painel-aeroporto.js:284). Pedidos are re-read when the tab opens, after a registration or a cancellation, and when a date opens (callers in 5.5).

Life of a pedido today:

| Step | What is written | Where |
|---|---|---|
| Registered | a row (`registrado_em`, `registrado_por`, `usuario`, `conta`, `excecao`) | `solicitacoes` (RPC `registrar_solicitacao`); local: `acpm4_agenda` |
| Imported ("Na demanda") | the id in `importadas`; a request with `solicitacao: <id>`; one History entry | day document, through `gravarAlteracao` (js/eventos/agenda.js:53-55) |
| Scheduled | the engine orders same-priority requests by `solicitacao` (the id) | js/engine.js:324-328,337 |
| Cancelled | `cancelada_em`, `cancelada_por`, `cancelada_usuario` on the row | RPC `cancelar_solicitacao`; **the Demanda and the Escala are not touched** (probe, 5.1) |

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

### 2.1 Table `public.solicitacoes` (one row per pedido; each row belongs to one date, `data`)

| Column | Type and constraint | Written by | Evidence |
|---|---|---|---|
| `id` | `bigint generated always as identity primary key` | server | supabase/migrations/20261110222506_agenda_de_solicitacoes.sql:7 |
| `data` | `date not null` (the flight date) | `registrar_solicitacao` | :8 |
| `aluno` | `integer not null`; the cadastro id (`S.stu[].id`); **no FK** (students live in the JSON document `cadastro`) | RPC | :9 |
| `aluno_nome` | `text not null`, 1 to 80 chars; a copy of the name at registration time | RPC (`trim`) | :10; js/eventos/agenda.js:100 |
| `missao` | `text not null`, 1 to 60 chars; **not checked against a list** | RPC | :11 |
| `janela` | `text not null check in ('manha','tarde','noite','horario')` | RPC | :12 |
| `horario` | `text check (horario ~ '^[0-2][0-9]:[0-5][0-9]$')`; nullable | RPC | :13 |
| `observacao` | `text check (char_length <= 300)`; nullable | RPC (`nullif(trim(...), '')`) | :14 |
| `registrado_por` | `text not null`, 1 to 80; free text typed in the form | RPC (`trim`) | :15 |
| `registrado_em` | `timestamptz not null default now()` | server | :16 |
| `usuario` | `uuid references auth.users (id) on delete set null` | RPC (`auth.uid()`) | :17 |
| `conta` | `text`; `coalesce(nullif(perfis.nome,''), auth.users.email)`: **the account name, or its e-mail when the profile has no name** | RPC | :18, :77 |
| `excecao` | `boolean not null default false`; stored as `not no_prazo` (derived by the server, not the parameter) | RPC | :19, :78 |
| `cancelada_em` | `timestamptz`; null = active | `cancelar_solicitacao` | :20 |
| `cancelada_por` | `text check (char_length between 1 and 80)` | `cancelar_solicitacao` (`trim`) | :21 |
| `cancelada_usuario` | `uuid references auth.users (id) on delete set null` | `cancelar_solicitacao` | :22 |
| `horas` | `numeric(3,1) check (horas is null or (horas > 0 and horas <= 5))`; null on rows older than 2026-11-14 | 10-argument RPC | supabase/migrations/20261114222031_agenda_com_duracao.sql:8 |

- Table check: `check ((janela = 'horario') = (horario is not null))` (20261110222506:23).
- Index: `solicitacoes_data_idx on (data, registrado_em)` (20261110222506:26), plus the primary key.
- No version column, no `updated_at`, no unique constraint (two identical pedidos are accepted).
- The app reads with `select('*')` (js/backends/supabase.js:212), so every reading profile receives all 17 columns, `usuario`, `conta` and `observacao` included.

### 2.2 Day document (`dias.conteudo`; local `acpm4_dia_<data>`), per date

| Field | Meaning | Written by | Evidence |
|---|---|---|---|
| `importadas` | array of pedido ids already imported into this date's demand | `importarSolicitacoes` (js/agenda.js:110,116), saved by `gravarAlteracao` | js/dias.js:29,34,71,110; normalised to positive integers in js/storage.js:84; data-format step 10 (js/migracoes.js:79-83) |
| `pedidos[<alunoId>].solicitacao` and `pedidos[<alunoId>].extra[].solicitacao` | the pedido id that became this request | import (js/agenda.js:128); removed by `deixarEmBranco` (js/rules.js:86-90: "Limpar demanda" and the reuse of a blank main request); restored by the booking undo (comment js/dias.js:18-22) | `CAMPOS_DO_PEDIDO`, js/dias.js:22; validated in js/rules.js:163-164 |

A new date starts with `importadas: []` and every request blank (js/dias.js:118-123; test/unit/dias.test.js:295-300).

### 2.3 Local mode (this browser, all dates)

| Key | Content | Evidence |
|---|---|---|
| `acpm4_agenda` | JSON array with every pedido of every date (no cap, no trimming) | js/backends/local.js:17,156,170,182 |
| `acpm_agenda_registrado_por` | the last "Registrado por" typed, to prefill the form | js/views/agenda.js:15,93-99,204-208 |

### 2.4 In-memory page state (lost on reload)

| State | Meaning | Evidence |
|---|---|---|
| `diaEscolhido`, `mesVisivel`, `pedidos` | the Agenda's own day, the visible month, the rows of the visible month grid | js/views/agenda.js:17-19 |
| `pedidosDaData = { data, lista }` | the open date's pedidos, for the badge | js/views/selos.js:36 |
| `#form-agenda[data-confirmado]` = `<alunoId>|<dia>` | the armed "Registrar mesmo assim" | js/eventos/agenda.js:85,92-93,130 |
| `#ag-horas[data-antes]`, `[data-padrao]` | the duration to restore after a fixed or default duration | js/views/agenda.js:176-180 |
| `body[data-agenda="edita|consulta"]` | who sees the form and the Cancelar buttons | js/actions.js:60; js/main.js:127; css/app.css:1172-1173 |

## 3. Controls inventory

Profiles: Op = Operador, Adm = Administrador, Sec = Secretaria, Ges = Gestor. The Painel profile never loads the app (redirected to `painel.html`, js/sessao.js:140-146). "Local" = localhost without login, where `#role-sel` offers Operador and Gestor (index.html:69-72).

| Label | Element (id, data-act, data-f, class) | Handler (function, file:line) | State read and written | Profiles |
|---|---|---|---|---|
| Tab "Agenda" | `#nav button[data-t="age"]` > `.aba-rotulo` (index.html:94) | document click on `[data-t],[data-go]` → `show('age')` + `abrirAgenda()` (js/eventos/navegacao.js:19-27; js/views/agenda.js:59-63) | reads `DATA`; writes `diaEscolhido`, `mesVisivel`; fetches the month into `pedidos` | Op, Adm, Ges, Sec (css/app.css:184 keeps it for Sec); the app opens on it for Sec (js/main.js:134) |
| Badge (a number) | `span#selo-age.aba-selo` (index.html:94) | `atualizarSeloDaAgenda()` (js/views/selos.js:52-55) | reads `pedidosDaData`, `S.importadas`, `isGestor()`; title "N pedido(s) da agenda ainda não está/estão na demanda" | shown only when not `isGestor()`: Op, Adm, local Operador. The Gestor never sees it (test/e2e/selos.spec.js:66-72), nor the Secretaria (`ApiClient.readOnly` makes `isGestor()` true: js/sessao.js:171; js/state.js:25) |
| Title "Agenda de Solicitações" | `#s-age > h2` (index.html:275) | static | | all |
| Deadline sentence | `p#agenda-prazo.h` (index.html:276) | `prazoDoDia()` (js/views/agenda.js:105-116), set in `rAgenda` (:188) | reads `diaEscolhido`, the São Paulo clock, `podeUsarExcecao()` | all |
| "‹" (aria "Mês anterior") | `button.x[data-cal="mes"][data-delta="-1"]` (js/views/agenda.js:126) | document click on `[data-cal]` → `mudarMes(-1)` (js/eventos/agenda.js:18-21; js/views/agenda.js:76-82) | writes `mesVisivel`, `diaEscolhido = <mês>-01`; fetches the month; **does not change `DATA`** | all, the local Gestor too (comment js/eventos/agenda.js:17) |
| Month name | `.cal-cab > b` (js/views/agenda.js:127) | display | | all |
| "›" (aria "Próximo mês") | `button.x[data-cal="mes"][data-delta="1"]` (js/views/agenda.js:128) | → `mudarMes(1)` | same | all |
| Weekday heads "dom … sáb" | `span.sem` ×7 (js/views/agenda.js:14,130) | display; the week starts on Sunday | | all |
| Day (the number, with the count) | `button.dia[data-cal="dia"][data-dia="AAAA-MM-DD"]` with `.fora` (other month), `.fechado` (deadline closed), `.sel` + `aria-current="date"` (chosen), `span.qtd` (count); aria-label "<dia por extenso>: N pedido(s)" (js/views/agenda.js:130-134) | → `escolherDia(dia)` (js/views/agenda.js:84-91) and, when the day is not `DATA`, is valid and is not a Sunday, `carregarData(dia)` (js/eventos/agenda.js:22-26; js/actions.js:321-328) | reads `pedidos`, the deadline; writes `diaEscolhido` (and the month); **opens that date in the whole app** (`DATA`, `S`, `RES`, History) | all, the local Gestor too (whose `#dt` is disabled, js/actions.js:56-57) |
| Day title | `h3#agenda-data` (index.html:280) | `dataPorExtenso(diaEscolhido)` (js/views/agenda.js:30-33,189) | | all |
| "Aluno" | `select#ag-aluno.agenda-campo[required]` (index.html:282) | options "Escolha o aluno…" + every `S.stu` by name (js/views/agenda.js:197-200); `change` → `desarmarConfirmacaoDaAgenda()`, clears the error (js/eventos/agenda.js:135) | reads `S.stu` (the whole roster; there is no inactive student today) | who `podeEditarAgenda()` (js/views/agenda.js:23): Op, Adm, Sec; local non-Gestor. The form is hidden for the others (css/app.css:1172) |
| "Fase / missão" | `select#ag-missao.agenda-campo` (index.html:283) | options `Object.keys(MIS)` (the 18 mission **types**), default 'Voo Local' (js/views/agenda.js:201-203); `onchange = preencherHorariosDaAgenda` (js/eventos/agenda.js:136) | reads `MIS`, `S.horarios`; rewrites `#ag-horario` and `#ag-horas` | same |
| "Horário" | `select#ag-horario.agenda-campo` (index.html:284) | options `horariosDaMissao(S.horarios, missao, regra.defEq)` (js/views/agenda.js:181-183): the take-off times of the mission's **default** category; Noturno only 17:30, Voo Solo only 06:30 (js/horarios.js:52) | reads `S.horarios` | same |
| "Duração (h)" | `input#ag-horas.agenda-campo[type=number][min=0.1][max=5][step=0.1][value=1]` (index.html:285) | `preencherHorariosDaAgenda` (js/views/agenda.js:173-180): disabled with the fixed duration (Ground 1.5, Noturno 4), starts at 2 for Simulador; validated by `duracaoDigitada` (js/eventos/agenda.js:79-84) | | same |
| "Registrado por" | `input#ag-por.agenda-campo[maxlength=80][required]`, placeholder "Quem anotou o pedido" (index.html:286) | prefilled from `localStorage` (js/views/agenda.js:204-208); remembered after a registration (js/eventos/agenda.js:114); **also the name used when cancelling** (js/eventos/agenda.js:140-145) | `acpm_agenda_registrado_por` | same |
| "Observação" | `input#ag-obs.agenda-campo[maxlength=300]`, placeholder "Opcional" (index.html:287) | read at submit (js/eventos/agenda.js:101); cleared after (:116) | | same |
| "Registrar pedido" / "Registrar mesmo assim" | `#form-agenda button.btn[type=submit]` (index.html:288) | `form.onsubmit` → `registrarPedido(false)` (js/eventos/agenda.js:133, 67-121) | disabled when the deadline is closed (js/views/agenda.js:210-211); reads `pedidosCarregados()`, `S.stu`, `S.horarios`, `diaDaAgenda()`; writes one pedido (RPC), then `carregarMes()` and `lerPedidosDaData()` (:119-120); **no History, no `gravarAlteracao`** | Op, Adm, Sec; local non-Gestor |
| "Exceção da Coordenação" | `button#ag-excecao.x[data-dica="excecao"][hidden]` (index.html:289) | `onclick` → `registrarPedido(true)` (js/eventos/agenda.js:134) | shown when the deadline is closed and `podeUsarExcecao()` (js/views/agenda.js:24,212) | Op, Adm; local non-Gestor. Hidden for Sec (test/e2e/agenda-compartilhado.spec.js:69-71) |
| Error line | `p#ag-erro[role=alert]`, the `aria-describedby` of four fields (index.html:282-290) | `marcarInvalidos(...)` sets `aria-invalid` (js/eventos/agenda.js:64) | | |
| "Importar N pedido(s) para a demanda" | `button#agenda-importar.btn.edit-only[hidden]` (index.html:292) | `onclick = importarDaAgenda` (js/eventos/agenda.js:61, 31-59) | shown when `diaEscolhido === DATA`, there are pending pedidos and `podeImportar()` (js/views/agenda.js:26,140,192-194); reads `S.importadas`, `S.resultados.situacao`, `programaParaInferir()`; writes `S.stu`, `S.importadas`; `gravarAlteracao('inc', [...])` | Op, Adm; local Operador |
| The day's list | `div#agenda-lista.tw > table` (index.html:293; js/views/agenda.js:151-166). Columns "Registrado em", "Aluno" (with `small.obs` for the Observação), "Fase / missão", "Horário" ("HH:MM · N h", or the period on old rows), "Registrado por" (`td.por`, `title="Conta: …"` when the account differs, tag "Exceção da coordenação"), "Situação" (`td.situacao`), actions. Empty: "Nenhum pedido para esta data." | `listaHTML()` | reads `pedidos`, `diaEscolhido`, `DATA`, `S.importadas`. Rows in the query's order (`data`, `registrado_em`). **No filter, search, sort or pagination** | all reading profiles |
| Situação tag | `span.tag` "Cancelado" (title "Cancelado por X em dd/mm hh:mm", `tr.cancel`), `span.tag.grp` "Na demanda", `span.tag.fb` "Ainda não importado"; empty on a date that is not `DATA` (js/views/agenda.js:141-149) | `situacao(p)` | "Cancelado" is tested first: a cancelled pedido that is in the demand shows only "Cancelado" | all |
| "Cancelar" → "Confirmar cancelamento" | `button.x.agenda-acao[data-act="cancelar-pedido"][data-id]` (js/views/agenda.js:164) | `aoAcionar('cancelar-pedido', cancelarPedido, { confereAPermissao: true })` (js/eventos/agenda.js:138-155); two clicks in 3.5 s (js/eventos/confirmacao.js:23-40) | needs `#ag-por`; RPC; then `carregarMes()` and `lerPedidosDaData()`; no History; the Demanda is not touched | who `podeEditarAgenda()`; hidden for the others (css/app.css:1173) |
| (Demanda) "Importar da agenda" / "Importar N pedido(s) da agenda" | `button#importar-agenda.btn.sec.edit-only`, title "Traz os pedidos da agenda da secretaria para esta data (só acrescenta; não repete)" (index.html:302) | `onclick = importarDaAgenda` (js/eventos/agenda.js:60); text and class `sec` from `atualizarSeloDaAgenda` (js/views/selos.js:56-59) | same as the import above | Op, Adm (`.edit-only`, css/app.css:235; the Demanda tab is hidden for Sec, css/app.css:184) |

Toasts: "Pedido registrado.", "Pedido registrado pela Exceção da Coordenação." (js/eventos/agenda.js:118); "Pedido cancelado." (:148); "Nenhum pedido novo na agenda para dd/mm." (:50); "N pedido(s) da agenda na demanda · M de aluno que não está no cadastro (entra depois de cadastrado)." (:57-58); "A data mudou durante a importação da agenda: nada foi importado. Importe de novo na data certa." (:43); "Não foi possível ler a agenda. Verifique a conexão e tente de novo." (:38).

Focus keeping: `data-cal`, `data-dia` and `data-delta` are in `QUEM_E`, and `data-cal` in `DO_TIPO` (js/dom.js:171-172,178). Phones: `.cal .dia { min-height: 44px }` (css/app.css:1587).

## 4. Rules and the tests that pin them (file and test name)

| Rule | Server | Client | Local backend | Tests |
|---|---|---|---|---|
| **Deadline**: a date takes pedidos until 13:00 of the previous operating day; Monday until Saturday 10:00; São Paulo time | `prazo_da_agenda_permite` (supabase/migrations/20261114230509_agenda_sem_domingo.sql:4-18), called by `registrar_solicitacao` (20261114230012_agenda_limite_de_locais.sql:15,41-44), error `PT403` | `prazoDaData`, `prazoDaAgendaPermite` (js/agenda.js:32-43); submit disabled (js/views/agenda.js:210-211); `.fechado` on the calendar (:132); the sentence (:105-116); error text (js/eventos/agenda.js:105) | js/backends/local.js:165-166 | pgTAP agenda.test.sql:24-30 (7 checks), :41-42 'fora do prazo: recusado'; agenda-prazo.test.sql:9-17 (9 checks); unit agenda.test.js:19 'pedido para o dia seguinte só até as 13:00 de São Paulo…', :30, :37 'domingo não tem voo; segunda até sábado às 10:00…', :51; backend-local.test.js:97 'fora do prazo: recusa (403)…'; e2e agenda.spec.js:20, :122, :202 'depois das 13:00, amanhã fecha e a agenda abre no dia seguinte', :238 |
| **Exceção da Coordenação**: past the deadline only Operador and Administrador, and the row is flagged | 20261114230012:41-48 (`quem <> 'operador'` → `42501`); `excecao = not no_prazo` (:55). The Administrador counts as operador in `perfil_atual()` (20261111122858_contas_e_administracao.sql:5-14) | `podeUsarExcecao` (js/views/agenda.js:24); `#ag-excecao` (:212); error text (js/eventos/agenda.js:106) | any non-Gestor ("Sem login, quem usa tem os direitos de operador (inclusive a exceção)", js/backends/local.js:153,165-166,180) | pgTAP agenda.test.sql:43-44 'a secretaria não usa a exceção da coordenação', :62-64; contas.test.sql:27-28 'administrador usa a exceção da coordenação'; unit backend-local.test.js:97; e2e agenda.spec.js:122 'fora do prazo não registra; a exceção da coordenação registra marcado'; agenda-compartilhado.spec.js:80 and :69-71 |
| **No Sundays** | `prazo_da_agenda_permite` is false for a Sunday (20261114230509:14). **Nothing else refuses a Sunday: with the exception, `registrar_solicitacao` inserts it** (20261114230012:41-58; read, not run) | `prazoDaData` returns null (js/agenda.js:33); the calendar click does not open a Sunday in the app (js/eventos/agenda.js:24); the app skips Sundays in the default date, the arrows, the picker and links (js/main.js:76,89-90; js/eventos/topo.js:35-39,47-54). **`#ag-excecao` still shows on a Sunday for an operator** (js/views/agenda.js:210-212; read, not run in a browser) | **accepts a Sunday with `excecao: true`** (probe: 2026-11-15 registered) | pgTAP agenda-prazo.test.sql:9 'domingo nunca' (the function only); unit agenda.test.js:37, :51 'primeira data aberta: pula o domingo'; e2e agenda.spec.js:238 'sábado: o app abre na segunda…; domingo não existe' (checks the disabled submit, not the exception button), :256. **No test covers a Sunday with the exception** |
| **Local-flight limit**: at most 6 of 'Voo Local', 'Voo Solo', 'TGL (TMA)' at the same take-off time of a date; cancelled ones do not count | 20261114230012:30-40, with `pg_advisory_xact_lock(hashtext('agenda-locais:' \|\| p_data::text \|\| ':' \|\| p_horario))`, error `PT422`, hint `locais`. Checked before the deadline, so the exception does not bypass it | `vagaDeVooLocal` (js/agenda.js:145-152) before the RPC (js/eventos/agenda.js:87-89), with the next possible time; `PT422` text (:110,123-126) | js/backends/local.js:171-175 | pgTAP agenda-locais.test.sql:18-27 (5 checks); unit agenda.test.js:343, :348, :353; backend-local.test.js:114 'o 7º voo local no mesmo horário é recusado (PT422)…'; e2e agenda.spec.js:102. The engine, the compaction and the booking apply the same limit to the schedule (js/engine.js:469,839,959; js/compactar.js:211-214; js/agendamento.js:1162-1167) |
| **Specific time only** (no period) | 20261114230012:22-24, `22023`, hint `horario` | the form has no period field; it always sends `janela: 'horario'` (js/eventos/agenda.js:100) | js/backends/local.js:162 | pgTAP agenda-horas.test.sql:29-30; unit backend-local.test.js:103; e2e agenda.spec.js:44 |
| **Duration** 0.1 to 5 h in tenths; Ground always 1.5 | 20261114230012:16,25-29 (`22023`, hint `horas`); column check (20261114222031:8) | `duracaoDigitada`, `ERRO_DA_DURACAO` (js/rules.js:117-121); field attributes (index.html:285); the Noturno fixed at 4 h **only in the form** (js/views/agenda.js:173-176; the server does not force it) | js/backends/local.js:163-164 | pgTAP agenda-horas.test.sql:23-36; unit backend-local.test.js:103; e2e agenda.spec.js:71; noturno.spec.js:14; atributos.spec.js:56 |
| **"Registrado por" required** | column check 1 to 80 (20261110222506:15), `23514` | js/eventos/agenda.js:72-77 | js/backends/local.js:167-169 | pgTAP agenda.test.sql:45-46; e2e agenda.spec.js:115, :59 |
| **Who registers and cancels** | 20261114230012:19-21; 20261110222506:94-96 | `podeEditarAgenda` (js/views/agenda.js:23); `registraNaAgenda` (js/perfis.js:7) | not checked (the Gestor role is client-side only) | pgTAP agenda.test.sql:35-36, :53-54 'escrita direta na agenda é bloqueada', :56, :69-70 'gestor não registra pedidos'; unit perfis.test.js:17-26; e2e agenda-compartilhado.spec.js:49, :92 |
| **Who reads** | policy "perfis da escala leem" (supabase/migrations/20261113140000_leitura_por_perfil.sql:34-37) | | | pgTAP leitura.test.sql:63 (`policies_are`), :72, :80, :88, :96, :104, :114; painel.test.sql:82; agenda.test.sql:68, :72; e2e publicado.spec.js:70-76 |
| **Cancel is a flag, once** | 20261110222506:97-102 (`P0002` the second time) | two clicks; "Cancelado" stays in the list | js/backends/local.js:186-193 | pgTAP agenda.test.sql:56-58; unit backend-local.test.js:120; e2e agenda.spec.js:135 |
| **A student already booked that day asks for a second click** | none | js/eventos/agenda.js:90-97 | none | e2e agenda.spec.js:88 |
| **Import only adds**; rules in 5.4 | none (the server does not know what was imported) | `importarSolicitacoes` (js/agenda.js:107-140) | same code | unit agenda.test.js:89-334 (21 tests); rules.test.js:180-209; instrutor-escolhido.test.js:266; progresso.test.js:540; e2e agenda.spec.js:152, :177; demanda.spec.js:55; agenda-compartilhado.spec.js:104; selos.spec.js:51; abertura.spec.js:78 |
| **Booking order**: with the same Prioridade, the lower pedido id goes first; hand-made requests after | none | js/engine.js:324-328,337; js/agendamento.js:143 | | unit engine.rules.test.js:286-302 (3 tests). No golden input carries `solicitacao` (grep of `test/fixtures`, `test/helpers`, `scripts`: none) |

The constants of the SQL (`6`, the three mission names, `5`, `1.5`, `13:00`, `10:00`) are **not** compared with `LIMITE_DE_VOOS_LOCAIS`, `MISSOES_LOCAIS`, `DURACAO_MAXIMA_H` and `prazoDaData` by any automated check: `test/unit/espelho-do-banco.test.js` covers only the cursos migration (its `it` names, lines 46-131). They are kept equal by parallel cases in pgTAP and in the unit tests.
pgTAP is not in CI (`.github/workflows/testes.yml` runs lint, unit and e2e); `scripts/testar-banco.mjs:17-18` runs every `*.test.sql` of `supabase/tests/database/`, so a new file is picked up by itself.

## 5. Answers

### 5.1 The `solicitacoes` table

**Columns, constraints, index**: section 2.1.

**RLS**: enabled (20261110222506:28); `revoke all on public.solicitacoes from anon` (:29). One policy, `"perfis da escala leem"`, `for select to authenticated using ((select public.le_a_escala()))` (20261113140000:34-37), which replaced `"contas com perfil leem"` (20261110222506:31-33). `le_a_escala()` is true for `operador`, `gestor`, `secretaria`, and for the Administrador through `perfil_atual()` (20261113140000:7-17). No insert, update or delete policy: direct writes fail with `42501` (agenda.test.sql:53-54). Unlike the cursos tables (supabase/migrations/20261117200000_cursos_e_missoes.sql:156-157), this migration has no `revoke insert, update, delete, truncate ... from authenticated`; it relies on RLS alone (the default grants are not in the repo: inferred).

**RPCs**:

| Function | Arguments | Who may call | What it does | Evidence |
|---|---|---|---|---|
| `prazo_da_agenda_permite` | `(p_data date, p_agora timestamptz) returns boolean`, `language sql stable`, not security definer | `authenticated` (any account); **the app never calls it** (it computes the deadline in JS) | the deadline rule | 20261110222506:36-45,107-108; replaced by 20261114230509:4-18 |
| `registrar_solicitacao` (10 arguments) | `(p_data date, p_aluno integer, p_aluno_nome text, p_missao text, p_janela text, p_horario text, p_horas numeric, p_registrado_por text, p_observacao text, p_excecao boolean) returns bigint`, security definer, no defaults | `authenticated`; inside: `secretaria` or `operador` (the Administrador counts), else `42501` | checks in this order: profile → specific time (`22023`) → duration (`22023`) → local limit (`PT422`) → deadline (`PT403`) or exception only for operador (`42501`) → insert; the table checks give `23514` | created in 20261114222031:10-57; replaced by 20261114230012:4-60 |
| `registrar_solicitacao` (9 arguments, **old, still in the database**) | `(p_data, p_aluno, p_aluno_nome, p_missao, p_janela, p_horario, p_registrado_por, p_observacao default null, p_excecao default false)` | same | profile and deadline only: **accepts periods, stores no `horas`, has no local limit** | 20261110222506:47-85. Kept "até o app novo estar no ar… Uma migração depois do merge a tira" (20261114222031:6-7); no later migration drops it (grep `drop function`: none); agenda-horas.test.sql:18-19 asserts it exists; agenda.test.sql:35-62 and contas.test.sql:27 call it |
| `cancelar_solicitacao` | `(p_id bigint, p_cancelada_por text) returns void`, security definer | `authenticated`; inside: `secretaria` or `operador`, else `42501` | sets the three `cancelada_*` columns where `cancelada_em is null`; none found → `P0002`. **No date, deadline or ownership check**: anyone who registers can cancel anyone's pedido, of any date, at any time | 20261110222506:87-106 |

The app calls only the 10-argument one (js/backends/supabase.js:218-225 always sends `p_horas`).

**States of a pedido today**:
- Stored: **active** (`cancelada_em is null`) or **cancelled** (a flag with who and when; "Os pedidos não são apagados", 20261110222506:4). There is no delete path, no un-cancel and **no edit**: changing a pedido means cancelling it and registering another (past the deadline, only with the exception).
- Stored flag: `excecao`. A pedido "past the deadline" does not exist as a state: it is either refused (nothing stored) or stored with `excecao = true`.
- Derived on screen, only for the open date: "Na demanda" (the id is in `S.importadas`) or "Ainda não importado" (js/views/agenda.js:139-149).
- Never importable: a pedido whose student is not in the cadastro is counted (`semAluno`) and not marked as seen (js/agenda.js:113-115), so it stays in the badge and in "Importar N pedidos" until someone cancels it.
- **Cancelled after import** (probe): the request stays in the Demanda with `fly: true` and its `solicitacao`; nothing in the repo removes it or warns. The list shows only "Cancelado".
- **After "Limpar demanda"** (probe): the id stays in `importadas` (`limparDemanda`, js/fixos.js:95-117, does not touch it) and the request loses `solicitacao` (js/rules.js:88); importing again brings nothing (`{"novos":0,"atualizados":0,"semAluno":0}`), and the Agenda still says "Na demanda". The same when an imported extra mission is removed with ✕ (`del-mis`, js/eventos/demanda.js:174-182).

### 5.2 The rules, where each is enforced, and who can do what

Enforcement: the table in section 4.

| Action | Operador | Administrador | Secretaria | Gestor | Painel |
|---|---|---|---|---|---|
| Read pedidos | yes | yes | yes | yes | no (painel.test.sql:82; never loads the app) |
| Register within the deadline | yes | yes | yes | no (`42501`; form hidden) | no (`42501` by the profile list; no test) |
| Register past the deadline (Exceção) | yes | yes | no (`42501`; button hidden) | no | no |
| Cancel any pedido | yes | yes | yes | no | no |
| Import into the demand | yes | yes | no (`isGestor()`, js/eventos/agenda.js:32; the Demanda tab is hidden) | no | no |
| See the badge `selo-age` | yes | yes | no | no | no |
| Browse the calendar and open a date | yes | yes | yes | yes | no |

- The server is the authority (`perfil_atual()`; "O servidor confere tudo de novo", js/perfis.js:1-2). The Administrador is `operador` in every Agenda rule (20261111122858:5-14; contas.test.sql:22,27-28).
- In local mode there is no server check: everyone who is not in the Gestor role has the operator's rights.
- docs/PLAN.md:158 (2026-11-10): "Secretaria accounts: none for now… Operadores register requests in the Agenda." Whether such accounts exist in production today could not be checked (no network).

### 5.3 What a pedido carries and what it lacks

| Field of the Demanda request (`CAMPOS_DO_PEDIDO`, js/dias.js:22) | In the pedido? | What the import puts there (js/agenda.js:63-80,107-140) |
|---|---|---|
| the student | `aluno` (id) and `aluno_nome` (a copy) | matched by id (:114); the copied name is used only in the list and in the History text |
| `fly` (Voa) | implicit: the row exists and is not cancelled | `true` |
| `mis` (Missão) | `missao`, a mission **type** (one of the 18 `MIS` keys; the form labels it "Fase / missão") | the same; an old name is migrated and an unknown one becomes 'Voo Local' (js/rules.js:102-114; probe) |
| `etapa`, `cursoDaEtapa` (the course mission) | no | inferred: the first released mission of the student's course whose type is the requested one (:119-122,127), or the one the replaced flight already had (:118,126) |
| `eq` (Recurso) | **no** | the programme's resource when valid for the type, else `MIS[missao].defEq` (:65-66) |
| `insId` (Instrutor) | **no** | never set; kept when the pedido takes the place of a hand-made flight (:130-132) |
| `p1`, `p2` (1ª and 2ª preferência) | one time only (`horario`) | both equal to that time when it is in the resource's list (:67-70); otherwise the list's defaults |
| `jan` (Disponibilidade) | `janela` + `horario` | `h<minutos>` (an exact time), or the period on old rows (:52-56,75) |
| `nb` (Duração) | `horas` | the pedido's, else the programme's, else the mission's default; Ground 1.5 and Noturno 4 always (:71-78) |
| `pr` (Prioridade) | **no** | always 3 (:74), also over the replaced flight's priority |
| `ss` | no | 1 |
| `solicitacao` | `id` | the id (:128) |
| (nothing) | `observacao` | **not carried**: the note is visible only in the Agenda list |
| (nothing) | `registrado_por`, `registrado_em`, `usuario`, `conta`, `excecao`, `cancelada_*` | not carried (the id stands for the registration order) |

Two consequences proven by probe:
1. **An imported pedido can only start at its exact minute.** Two pedidos at 10:10 with one instructor: `{p1:610, p2:610, jan:"h610"}` each; the first flies and the second is rejected ("Rejeitado: os instrutores habilitados (Voo Local + C152) já têm outro compromisso nos horários possíveis."), not moved. The same two as period pedidos ('tarde') are placed at 12:40 and 13:40. Since 2026-11-14 the form and both backends refuse periods. The "Horários" setting moves a flight "dentro da disponibilidade do aluno", "só entre a 1ª e a 2ª preferência" or not at all (js/glossario.js:53-56); with `p1 = p2 = jan` the three options leave the same single minute, so the setting has no room on imported pedidos unless the operator widens Disponibilidade by hand in the Demanda (inferred from those definitions; the compaction itself was not run).
2. **A time of the default category may not exist in the programme's category.** An 'IFR' pedido at 08:20 (a C172 time) for a mission the programme flies in the PA-34 (times every 30 minutes) becomes `{eq:"PA-34", p1:510, p2:630, jan:"h500"}` and the engine answers "Rejeitado: nenhum horário aberto na disponibilidade do aluno (às 08:20) comporta 1 h." (`codigo: 'disponibilidade-do-aluno'`).

### 5.4 `importarSolicitacoes`

Signature: `importarSolicitacoes(estado, solicitacoes, { situacao = [], programa = [] } = {})` → `{ novos, atualizados, semAluno }` (js/agenda.js:107-140). It **mutates** `estado` (`stu`, `importadas`). Pure (no DOM, no clock).

For each pedido, in the order received (`data`, `registrado_em`):
1. Skipped when cancelled or already in `estado.importadas` (:112).
2. Student not in `estado.stu`: `semAluno++`, not marked as seen (:113-115).
3. `estado.importadas.push(id)` (:116).
4. `copiada = vooQueDaLugar(...)` (:117, 86-93): the student's first request that flies, has the same mission type, has **no** `solicitacao`, has no pin in `estado.fixos`, is not fixed by status (`fixoPeloStatus`: 'Em Voo', 'Atrasado', 'Pousou', 'Cancelado', js/fixos.js:40-41) and has no result on the date.
5. The course mission: the one `copiada` already carries (`escolhida`, :118), else the first released mission of the student's course whose `mis` equals the pedido's (:119-122). The missions of the student's other flights of the day count as done; a cancelled flight's does not (`missoesDoDia`, js/progresso.js:144-149).
6. `pedidoDaSolicitacao` builds the request (:125; mapping in 5.3), then `etapa`/`cursoDaEtapa` (:126-127) and `solicitacao = id` (:128).
7. With `copiada`: `jan`, `etapa`, `cursoDaEtapa` are deleted from it and the new request is assigned over it; `insId` and `mid` stay (:129-133). `atualizados++`.
8. Otherwise `Object.assign(alvoDoNovoPedido(estado, aluno), pedido)` (:135). `novos++`.

`alvoDoNovoPedido(estado, aluno)` (js/rules.js:95-100): the main request, blanked by `deixarEmBranco` (`jan`, `etapa`, `cursoDaEtapa`, `solicitacao`, `insId` go, js/rules.js:86-90), when the student does not fly **and** `chaveTemSobras(estado, chaveDoVoo(aluno.id, 0))` is false; otherwise a new extra `{ mid: proximoMid(estado, aluno), ...blank(), pr: aluno.pr || 3 }`. The booking dialog uses it too (js/agendamento.js:905).
`chaveTemSobras(estado, chave)` (js/rules.js:52-62): the day still keeps something under that flight key: a pin (`fixos`), a status (`fStatus`), a status detail (`fObs`) or a result registered on the date (`resultados.doDia[].voo`).

**What it never overwrites**: a pinned flight (approved, booked, chosen instructor), a flight fixed by status, a flight with a result, a flight that already came from a pedido, a flight of another mission type, a request that does not fly, and a non-flying main request with leftovers. In all those cases the pedido becomes another flight. It never removes a request.

**The closed-course gap** (docs/PLAN.md:371 and :424, item 10): `curso = !escolhida && aluno.curso ? indice.curso(aluno.curso) : null` (:119) does not look at `curso.ativo`. Probe: with the PP course `ativo: false`, the import still sets `etapa: 'IN-01'`, `cursoDaEtapa: 'PP'`, with no warning and nothing in the History, while the Demanda and the booking dialog ask for a confirmation. Still open for Pedro.

**The handler around it** (`importarDaAgenda`, js/eventos/agenda.js:31-59): refuses for `isGestor()` or before the date opens; reads the open date's pedidos again; drops everything if the date changed meanwhile (test/e2e/agenda-compartilhado.spec.js:104); imports **all** pending pedidos; one History entry per pedido whose student exists; `programa` is `programaParaInferir()`, empty when the results or the programmes were not read (js/views/etapas.js:26-29; agenda.test.js:323).

**Tests**: test/unit/agenda.test.js, suite 'Importar as solicitações da agenda para a demanda' (:89-334, 21 tests; e.g. :95 'aluno sem voo no dia: o pedido vira a missão principal', :112, :119 'dois pedidos da mesma missão para o mesmo aluno: dois voos…', :137 'ignora cancelados e os já importados; conta os alunos que não estão no cadastro', :229 'o voo fixo não dá lugar ao pedido da agenda…', :243, :252, :265 'o pedido principal que não voa mas tem sobras no dia não recebe o pedido da agenda…', :285, :296, :309) and suite 'Agenda de solicitações' (:65 and :82 for `pedidoDaSolicitacao`); test/unit/rules.test.js:180 and :190-209 (`chaveTemSobras`, `alvoDoNovoPedido`); test/unit/instrutor-escolhido.test.js:266; test/unit/progresso.test.js:540; test/unit/atributos.test.js:167-169; e2e agenda.spec.js:152, :177; demanda.spec.js:55. No test covers a closed course in the import, a pedido cancelled after import, or an import after "Limpar demanda".

### 5.5 The Agenda page

Controls: section 3.

**`calendarioHTML`** (js/views/agenda.js:118-135): a header (‹, the month name, ›), seven weekday heads from "dom", and one button per day of the whole weeks (Sunday to Saturday) that cover the month (`gradeDoMes`, :48-54). Each day shows its number and, when there is any, **the count of that day's pedidos that are not cancelled** (`qtd`, :131,133), in `span.qtd` and in the aria-label ("…: 2 pedido(s)"). Classes: `fora`, `fechado` (`!prazoDaAgendaPermite(d)`: past days, Sundays, tomorrow after 13:00), `sel` with `aria-current="date"`. There is no mark for today.

**How the month is fetched**: `carregarMes()` (:65-74) → `ApiClient.agenda(inicio, fim)` (js/storage.js:280-282) → one query, `from('solicitacoes').select('*').gte('data', de).lte('data', ate).order('data').order('registrado_em')` (js/backends/supabase.js:211-215): every row and every column of five or six weeks, cancelled ones included, **without pagination**. The API returns at most 1,000 rows (`max_rows = 1000`, supabase/config.toml:19; the fake server does the same, test/e2e/supabase-falso.js:95-99), so in a month with more rows than that the last days of the grid would lose pedidos, counts and the local-limit check without any notice (the cap is a fact; the production volume is unknown). It runs again every time the tab is clicked (js/eventos/navegacao.js:26), a month changes, a day of another month is chosen, and after each registration or cancellation (js/eventos/agenda.js:119,152). On failure: "Não foi possível carregar a agenda. Verifique a conexão." and an empty list (js/views/agenda.js:69-72).

**`selo-age`** (js/views/selos.js:36-55): the pedidos of the **open date** (`ApiClient.agenda(DATA, DATA)`), not cancelled and not in `S.importadas`; 0 for whoever is `isGestor()` (the Gestor and the Secretaria). The same number goes on `#importar-agenda`. `lerPedidosDaData()` runs at start-up (js/main.js:139), when a date opens (js/actions.js:326) and after a registration or cancellation in this browser (js/eventos/agenda.js:120,153). A pedido registered on another computer shows up only at the next of those events.

**The Agenda's own date and the app's open date**: the Agenda keeps its own day, `diaEscolhido` (js/views/agenda.js:17).
- Opening the tab sets it to `diaPadrao()`: `DATA` when `DATA >= primeiraDataAberta()`, else **the first date still open for pedidos** (js/views/agenda.js:58). After 13:00 the app's default date (tomorrow) is closed, so the Agenda opens one day ahead of the app (e2e agenda.spec.js:202).
- A click on a day sets it and also opens that date in the whole app, unless it is a Sunday (js/eventos/agenda.js:22-26; e2e agenda.spec.js:211, :168-171).
- The two differ in four cases: (1) the opening above; (2) ‹ › of the month (`diaEscolhido` becomes the 1st, `DATA` stays, js/views/agenda.js:76-82); (3) a Sunday chosen in the calendar; (4) the date changed at the top while the Agenda is on screen (`carregarData` calls `rAgenda()`, which keeps `diaEscolhido`, js/actions.js:324; js/views/agenda.js:186-191). When they differ, the Situação column is empty and the import button is hidden (js/views/agenda.js:140,147).
- The Secretaria lands on the Agenda (js/main.js:134; e2e agenda-compartilhado.spec.js:49).
- "Today" for the deadline is São Paulo's (`hojeEmSaoPaulo`, js/agenda.js:25); the app's default date and the "hoje/amanhã" label use the browser's local date (`hojeISO`, `amanhaISO`, js/format.js:26-27).

### 5.6 Local mode

- Pedidos live in `localStorage['acpm4_agenda']`, one JSON array for all dates (js/backends/local.js:17,153-193). Ids are `Math.max(Date.now(), last + 1)` (`proximoId`, :46): 13-digit numbers that still grow with registration.
- `registrarSolicitacao` (:161-184) mirrors the server with the same error codes: specific time (`22023`), duration with Ground 1.5 (`22023`), deadline (`PT403`) unless `excecao`, required texts (`23514`), the local limit (`PT422`); it stores `conta: null`, `excecao: !noPrazo`, and no `usuario`.
- `cancelarSolicitacao` (:186-193): `P0002` when not found or already cancelled, `23514` without a name. `listarSolicitacoes` (:154-158): by date range, ordered by `data` and `registrado_em`.
- Differences from the server: no profile check at all (the Gestor role is only the screen's); the order of the checks (deadline before the limit); the Observação is cut at 300 chars instead of refused (:179); a Sunday and any past date are accepted with the exception, any mission text, any student id and any `HH:MM` are accepted (probe), which the server's SQL also allows.
- Tests: test/unit/backend-local.test.js:81-127 (5 tests).

### 5.7 Renaming

**Where the words are.** Counts of occurrences per file, by `perl` over the tracked text files (fixtures and snapshots left out). A = `agenda` not followed by `r`, `d` or `m` (so `agendar`, `agendado`, `agendamento` are out; the verb "agenda" of the booking feature is still in, see the caveat). S = `solicita`. T = `solicitacoes`, `registrar_solicitacao`, `cancelar_solicitacao`, `prazo_da_agenda_permite`. I = the Agenda's ids, classes and attributes (`ag-*`, `agenda-*`, `s-age`, `selo-age`, `form-agenda`, `importar-agenda`, `data-t="age"`, `'age'`, `data-cal`, `data-agenda`, `cancelar-pedido`). Totals: A 552, S 334, T 150, I 289, in 81 files.

| File | A | S | T | I |
|---|---|---|---|---|
| README.md | 3 | 2 | 0 | 0 |
| css/app.css | 24 | 1 | 0 | 16 |
| docs/PLAN.md | 35 | 6 | 1 | 0 |
| index.html | 37 | 2 | 0 | 28 |
| js/actions.js | 10 | 0 | 0 | 1 |
| js/agenda.js | 9 | 33 | 2 | 0 |
| js/agendamento.js | 3 | 2 | 0 | 0 |
| js/backends/local.js | 21 | 7 | 0 | 0 |
| js/backends/supabase.js | 1 | 7 | 3 | 0 |
| js/config.js | 1 | 0 | 0 | 0 |
| js/dias.js | 4 | 3 | 0 | 0 |
| js/dom.js | 0 | 0 | 0 | 2 |
| js/engine.js | 2 | 2 | 0 | 0 |
| js/eventos/agenda.js | 38 | 9 | 3 | 43 |
| js/eventos/demanda.js | 1 | 0 | 0 | 0 |
| js/eventos/escala.js | 2 | 0 | 0 | 0 |
| js/eventos/navegacao.js | 3 | 0 | 0 | 1 |
| js/eventos/registro.js | 1 | 0 | 0 | 0 |
| js/eventos/topo.js | 1 | 0 | 0 | 0 |
| js/fixos.js | 2 | 0 | 0 | 0 |
| js/glossario.js | 3 | 0 | 0 | 0 |
| js/main.js | 12 | 0 | 0 | 3 |
| js/migracoes.js | 1 | 1 | 0 | 0 |
| js/perfis.js | 1 | 0 | 0 | 0 |
| js/rules.js | 5 | 5 | 0 | 0 |
| js/sessao.js | 1 | 0 | 0 | 0 |
| js/somente-leitura.js | 3 | 0 | 0 | 2 |
| js/storage.js | 2 | 6 | 0 | 0 |
| js/views/agenda.js | 31 | 1 | 0 | 24 |
| js/views/conta.js | 1 | 0 | 0 | 0 |
| js/views/cursos.js | 1 | 0 | 0 | 0 |
| js/views/escala.js | 8 | 0 | 0 | 0 |
| js/views/etapas.js | 1 | 0 | 0 | 0 |
| js/views/selos.js | 13 | 0 | 0 | 2 |
| scripts/semear-dias-previa.mjs | 1 | 0 | 0 | 0 |
| supabase/migrations/20261110222505_perfil_secretaria.sql | 1 | 1 | 0 | 0 |
| supabase/migrations/20261110222506_agenda_de_solicitacoes.sql | 10 | 19 | 20 | 0 |
| supabase/migrations/20261111122858_contas_e_administracao.sql | 2 | 0 | 0 | 0 |
| supabase/migrations/20261113140000_leitura_por_perfil.sql | 1 | 2 | 2 | 0 |
| supabase/migrations/20261114222031_agenda_com_duracao.sql | 3 | 6 | 7 | 0 |
| supabase/migrations/20261114230012_agenda_limite_de_locais.sql | 3 | 4 | 5 | 0 |
| supabase/migrations/20261114230509_agenda_sem_domingo.sql | 1 | 1 | 2 | 0 |
| supabase/tests/database/agenda-horas.test.sql | 3 | 12 | 12 | 0 |
| supabase/tests/database/agenda-locais.test.sql | 1 | 9 | 9 | 0 |
| supabase/tests/database/agenda-prazo.test.sql | 9 | 0 | 9 | 0 |
| supabase/tests/database/agenda.test.sql | 16 | 26 | 32 | 0 |
| supabase/tests/database/contas.test.sql | 0 | 2 | 2 | 0 |
| supabase/tests/database/leitura.test.sql | 8 | 8 | 8 | 0 |
| supabase/tests/database/painel.test.sql | 2 | 1 | 1 | 0 |
| test/e2e/abertura.spec.js | 6 | 1 | 1 | 5 |
| test/e2e/acessibilidade.spec.js | 6 | 0 | 0 | 5 |
| test/e2e/agenda-compartilhado.spec.js | 25 | 7 | 5 | 32 |
| test/e2e/agenda.spec.js | 54 | 3 | 0 | 93 |
| test/e2e/agendamento-mapa.spec.js | 8 | 0 | 0 | 0 |
| test/e2e/app.spec.js | 3 | 1 | 0 | 0 |
| test/e2e/atributos.spec.js | 2 | 0 | 0 | 5 |
| test/e2e/celular.spec.js | 2 | 0 | 0 | 2 |
| test/e2e/dados-pessoais.spec.js | 1 | 0 | 0 | 0 |
| test/e2e/datas.spec.js | 3 | 0 | 0 | 0 |
| test/e2e/demanda.spec.js | 7 | 2 | 0 | 8 |
| test/e2e/fixtures.js | 1 | 0 | 0 | 0 |
| test/e2e/noturno.spec.js | 2 | 0 | 0 | 4 |
| test/e2e/perfis.spec.js | 1 | 0 | 0 | 0 |
| test/e2e/publicado.spec.js | 3 | 3 | 2 | 4 |
| test/e2e/seguranca.spec.js | 0 | 0 | 0 | 1 |
| test/e2e/selos.spec.js | 10 | 2 | 2 | 8 |
| test/e2e/supabase-falso.js | 7 | 12 | 12 | 0 |
| test/unit/agenda.test.js | 50 | 59 | 0 | 0 |
| test/unit/agendamento.test.js | 0 | 4 | 0 | 0 |
| test/unit/atributos.test.js | 1 | 2 | 0 | 0 |
| test/unit/backend-local.test.js | 2 | 22 | 0 | 0 |
| test/unit/backend-supabase.test.js | 1 | 16 | 10 | 0 |
| test/unit/dias.test.js | 2 | 1 | 0 | 0 |
| test/unit/engine.rules.test.js | 1 | 4 | 0 | 0 |
| test/unit/fixos.test.js | 0 | 2 | 0 | 0 |
| test/unit/instrutor-escolhido.test.js | 3 | 2 | 0 | 0 |
| test/unit/migracoes.test.js | 1 | 1 | 0 | 0 |
| test/unit/perfis.test.js | 2 | 0 | 0 | 0 |
| test/unit/progresso.test.js | 3 | 4 | 0 | 0 |
| test/unit/reversoes.test.js | 1 | 2 | 0 | 0 |
| test/unit/rules.test.js | 2 | 6 | 0 | 0 |

Caveat: in `js/views/escala.js`, `js/eventos/escala.js`, `test/e2e/agendamento-mapa.spec.js`, part of `css/app.css` and the Manual's Escala text, column A is the **verb** "agenda" of the booking feature (`const agenda = …`, js/views/escala.js:150,159; "o '+' que agenda"), not the Agenda. A search-and-replace by the word would hit the booking code; the first version of this count also caught `data-agendar`.

**By kind**:
- File names: `js/agenda.js`, `js/views/agenda.js`, `js/eventos/agenda.js`; `test/unit/agenda.test.js`, `test/e2e/agenda.spec.js`, `test/e2e/agenda-compartilhado.spec.js`; `supabase/tests/database/agenda.test.sql`, `agenda-horas.test.sql`, `agenda-locais.test.sql`, `agenda-prazo.test.sql`; four migrations (applied history, never renamed). Six other files are the booking, not the Agenda: `js/agendamento.js`, `js/views/agendamento.js`, `js/eventos/agendamento.js` and their three tests.
- Exports of `js/agenda.js`: `FUSO_DO_AEROCLUBE` (:13), `JANELAS_DA_AGENDA` (:15), `hojeEmSaoPaulo` (:25), `ehDomingo` (:28), `prazoDaData` (:32), `prazoDaAgendaPermite` (:38), `primeiraDataAberta` (:45), `disponibilidadeDaSolicitacao` (:52), `pedidoDaSolicitacao` (:63), `importarSolicitacoes` (:107), `vagaDeVooLocal` (:145).
- Importers of `js/agenda.js` outside the Agenda: `js/agendamento.js:40`, `js/main.js:32`, `js/eventos/topo.js:4`, `scripts/semear-dias-previa.mjs:16` (`ehDomingo`); `js/views/conta.js:6`, `js/views/cursos.js:18` (`FUSO_DO_AEROCLUBE`); `js/backends/local.js:4`, `test/e2e/supabase-falso.js:10` (`prazoDaAgendaPermite`); tests `agenda.test.js:4,339`, `atributos.test.js:13`, `instrutor-escolhido.test.js:9`, `progresso.test.js:17`.
- Exports of `js/views/agenda.js`: `podeEditarAgenda` (:23), `diaDaAgenda` (:27), `pedidosCarregados` (:43), `pedidosDoAluno` (:44), `descreverPedido` (:45), `abrirAgenda` (:59), `carregarMes` (:65), `mudarMes` (:76), `escolherDia` (:84), `lembrarRegistradoPor` (:93), `preencherHorariosDaAgenda` (:169), `rAgenda` (:186). Importers: `js/actions.js:17`, `js/main.js:45`, `js/eventos/navegacao.js:6`, `js/eventos/agenda.js:12`. `npm run lint` also fails on unused exports (`scripts/exportacoes-sem-uso.mjs`, package.json:15).
- Other identifiers: `ApiClient.agenda`, `.registrarSolicitacao`, `.cancelarSolicitacao` (js/storage.js:280-290); the backends' `listarSolicitacoes`, `registrarSolicitacao`, `cancelarSolicitacao`; `CHAVE_AGENDA`, `erroDaAgenda` (js/backends/local.js:17,68); `registraNaAgenda` (js/perfis.js:7); `lerPedidosDaData`, `atualizarSeloDaAgenda` (js/views/selos.js:38,52); the stored fields `importadas` and `solicitacao`.
- Ids, classes, attributes: `#s-age`, `#selo-age`, `#agenda-prazo`, `#agenda-cal`, `#agenda-data`, `#form-agenda`, `#ag-aluno`, `#ag-missao`, `#ag-horario`, `#ag-horas`, `#ag-por`, `#ag-obs`, `#ag-excecao`, `#ag-erro`, `#agenda-importar`, `#agenda-lista`, `#importar-agenda`; `.agenda`, `.agenda-campo`, `.agenda-acao`, `.cal-cab`, `.cal`, `.sem`, `.dia`, `.qtd`; `data-t="age"`, `data-cal`, `data-dia`, `data-delta`, `data-act="cancelar-pedido"`, `data-dica="excecao"`, `body[data-agenda]`. The booking dialog uses `agd-*` on purpose (comment index.html:723-724).
- Storage keys: `acpm4_agenda`, `acpm_agenda_registrado_por`.
- SQL: table `solicitacoes`; index `solicitacoes_data_idx`; policy "perfis da escala leem"; functions `registrar_solicitacao` (two), `cancelar_solicitacao`, `prazo_da_agenda_permite`; the lock text `'agenda-locais:'`; the table comment and the error messages.
- History: no `kind` for the Agenda (the nine kinds that `validarReversao` accepts are `setFly`, `setAv`, `setAtributo`, `setInsOn`, `restaurarFixos`, `restaurarEscolha`, `restaurarHorarios`, `readicionarRecurso`, `desfazerAgendamento`: js/reversoes.js:46-102). Only the description text "Agenda: … incluído (…)" with tipo `inc`; rows already stored keep that text.
- Glossary: `ABAS_DO_GLOSSARIO` has 'Agenda' (js/glossario.js:14); one term, `excecao`, with `aba: 'Agenda'` (:70). `test/unit/glossario.test.js:28` requires every term's `aba` to be in that list.
- Manual (index.html): the heading `<h4>Agenda</h4>` and its two paragraphs (:503-505); mentions at :445 ("a agenda é o centro dos agendamentos, e Importar da agenda monta a demanda do dia"), :448 and :499 ("Importar pedidos da agenda", which is not the button's text), :456, :465, :474, :500, :558, :578, :595. Pinned by test/e2e/app.spec.js:10 (tab names), :159 (the Manual's `h4` list), :164 ("Ainda não importado" must be in the Manual).
- README: :13-14 and the row of `js/agenda.js` (:209).
- Fake servers: test/e2e/supabase-falso.js:151, 318, 327, 368-400, 528; test/unit/backend-supabase.test.js:21, 36, 182-196.

**The collision that matters**: in the code, `pedido` already means the Demanda request: `dia.pedidos` (js/dias.js:34,59), `CAMPOS_DO_PEDIDO` (:22), `alvoDoNovoPedido`, `pedidoDoAluno`, `pedidosDosVoos` (js/voo.js:26-29), the History texts "Pedido <nome>: …" (js/eventos/demanda.js:208,228,265); `pedido` appears 93 times in `js/agendamento.js` alone. `pedidoDaSolicitacao` is "the request made from an Agenda row". And on screen both are already called "pedido": "Registrar pedido" (index.html:288) and "Os pedidos de cada data ficam na Demanda." (index.html:260).

**Cost and risk of each level**:

| Level | What changes | Cost | Risk |
|---|---|---|---|
| 1. UI text only | the tab label, the `h2`, the Manual, the glossary group name, button and toast texts, the History prefix for new entries, README | small: about 40 lines of index.html, a dozen strings in `js/views/agenda.js`, `js/eventos/agenda.js`, `js/views/selos.js`, two lines of `js/glossario.js`; text assertions in app.spec.js:10,159, selos.spec.js:58,62, agenda.spec.js, dados-pessoais.spec.js:116, agenda-compartilhado.spec.js:74 | low. Old History rows keep "Agenda:". The Alunos hint "Os pedidos de cada data ficam na Demanda" then contradicts a tab called Pedidos (it goes away with the Demanda rework) |
| 2. JS modules, ids and classes too | three modules, 13 importers, 289 selector occurrences (93 in agenda.spec.js), the focus lists in `js/dom.js`, CSS, storage keys | medium, mechanical, no functional gain | collides with the existing `pedido` identifiers; conflicts with every parallel branch that touches the same importers (`js/main.js`, `js/actions.js`, `index.html`, `css/app.css`), so it only fits as one commit of the foundation; renaming `acpm4_agenda` orphans local-mode pedidos unless copied |
| 3. The table and the RPCs too | `solicitacoes`, three function names, the policy, the index | high: a new migration plus a compatibility layer, the four agenda pgTAP files, leitura.test.sql:63, contas.test.sql, painel.test.sql, publicado.spec.js:70-76, both fake servers | high. The repo's rule is "migrations applied to preview, then production, before the merge", and they must only add (README.md:125-128,180-187; the precedent in 20261114222031:6-7). The app in the air, and every tab opened before the merge, calls `from('solicitacoes')`, `rpc('registrar_solicitacao')`, `rpc('cancelar_solicitacao')` (js/backends/supabase.js:212,219,228): after a rename the Agenda shows "Não foi possível carregar a agenda", registering and cancelling fail, and the badge silently becomes 0 (`.catch(() => [])`, js/views/selos.js:41). There is no forced reload for this (the `PT409`/`formato` guard exists only in `salvar_dia` and `salvar_documento`). And the stored fields `importadas` and `solicitacao` keep the old word anyway (data-format steps never delete fields) |

### 5.8 For an approval state

**What would change in SQL** (facts the design must respect; the options are in section 7):
- A place for the state on `solicitacoes`: adding columns is additive, and the app in the air ignores unknown columns (it reads named fields of `select('*')`).
- A new RPC to approve (and probably one to take the approval back), in the pattern of the existing ones: `security definer`, `set search_path = ''`, the profile test on `public.perfil_atual()::text` (the Administrador already counts as `operador`), `42501` and `P0002`, `revoke execute … from public, anon; grant execute … to authenticated`.
- `registrar_solicitacao`: a new parameter makes a new overload (as `p_horas` did), and the old one must stay for the app in the air; without a new parameter, `create or replace` keeps the grants (as 20261114230012 did).
- `cancelar_solicitacao` has no rule about state, date or author today.
- The local-limit count is "not cancelled", whatever the approval (20261114230012:34-36).
- RLS: the read policy does not need to change; writes stay RPC-only. `leitura.test.sql:63` (`policies_are`) fails if a policy is added.
- A server-side History entry in the same transaction is possible: `salvar_dados_pessoais` inserts into `historico` itself (supabase/migrations/20261114151953_dados_pessoais_versionados.sql:112-115). `historico.tipo` accepts only `inc`, `exc`, `mod` (supabase/migrations/20261110201618_dias_e_historico.sql:69), and `registrar_historico` is operador-only (20261110202010_historico_autor.sql:16-18).
- The server does not know what was imported: `importadas` is inside `dias.conteudo`. A backfill can read it (`dias.conteudo -> 'importadas'`).

**pgTAP that would cover it**: a new file (`scripts/testar-banco.mjs` picks it up); `agenda.test.sql` (structure and profiles, `plan(28)`); `contas.test.sql:27-28` (the Administrador); `painel.test.sql` (the TV profile); `leitura.test.sql` only if policies change. Also outside pgTAP: `test/unit/backend-local.test.js` and `js/backends/local.js` (the local mirror), `test/unit/backend-supabase.test.js:182-196`, `test/e2e/supabase-falso.js`, `test/e2e/agenda-compartilhado.spec.js`.

**How the fake server models the table** (test/e2e/supabase-falso.js): an array `solicitacoes` (:151) exposed to the tests (:528), which push rows straight into it (selos.spec.js:53; abertura.spec.js:31; agenda-compartilhado.spec.js:94,106). `GET /rest/v1/solicitacoes` goes through `consultar` (filters `eq`, `gte`, `lte`, `lt`, `order`, `limit`, at most 1,000 rows; :80-98,327); profiles that do not read get `[]` (:318). The two RPCs are at :368-400: the profile list names `administrador` explicitly (:370); the presence of `p_horas` selects the new function (:379-389), so the old 9-argument one is modelled too; the deadline is the app's `prazoDaAgendaPermite` with the server clock (:390); `excecao: !noPrazo` (:397); ids are `length + 1` (:393). It does not check an empty "Registrado por", the `janela` list or the time format, and it stores no `cancelada_usuario`. `segurar('/rest/v1/solicitacoes')` delays a read (:555-559).

**What approval could mean**:
- *A pedido the Operador registers himself.* Today the import is the gate and only Operador and Administrador import; with no Secretaria accounts (docs/PLAN.md:158, unverified today), the person who registers is the person who would approve. Either such a pedido is born approved, or the one operator clicks twice for every pedido.
- *A pedido past the deadline with the exception.* Only Operador and Administrador can create it, it is already flagged (`excecao`), and it is by nature a coordination decision. Note that today the exception has no limit at all: any past date and a Sunday are accepted.
- *A pedido cancelled after approval.* Today nothing happens downstream (5.1). With a derived Processamento the flight would vanish at the next recomputation of that date, which only happens when someone opens or changes it; the flight may already be pinned by "Aprovar escala", booked, in progress or with a result. And the Secretaria can cancel any pedido today.

## 6. Conflicts with the request

1. **"Keep the existing rules: … no Sundays"**: not absolute in the code. `registrar_solicitacao` accepts a Sunday through the exception (20261114230012:41-58, read), the local backend does (probe), and `#ag-excecao` shows on a Sunday for an operator (js/views/agenda.js:210-212). docs/PLAN.md:310 says "Sunday takes none". Such a pedido can never be imported, because the app never opens a Sunday (js/eventos/agenda.js:24; js/main.js:89-90).
2. **"the 13:00 deadline"**: Monday's deadline is Saturday 10:00 (20261114230509:16; js/agenda.js:35).
3. **"the local-flight limit"**: the old 9-argument `registrar_solicitacao` is still in the database and does not apply it, nor the duration, nor "specific time only" (20261110222506:47-85; agenda-horas.test.sql:18-19).
4. **"the Secretaria keeps registering"; approvers "Operador and Administrador"**: Operador and Administrador also register and cancel, and docs/PLAN.md:158 records that no Secretaria account existed and the Operadores registered the pedidos.
5. **Processamento has "no data of its own. Input: the approved pedidos of the date"**: today the demand also holds requests that are not pedidos ("Pôr um aluno na demanda", "+ missão", js/eventos/demanda.js:33-48,153-172; "+ Agendar voo", which "creates no Agenda request", docs/PLAN.md:421), and everything the operator edits on an imported request (resource, instructor, preferences, availability, duration, priority, Voa off) exists only in the day document.
6. **The pedido has no room for what the Demanda's columns hold**: no resource, no instructor, no 2nd preference, no priority, and its availability is one exact minute (5.3). With the Demanda's editing gone, "Prioridade de horários dos alunos" has nothing to work with on pedidos (probe in 5.3).
7. **"Pedidos: registrados · fora do prazo ou com exceção · aguardando aprovação · aprovados"**: "fora do prazo" is not a state (refused pedidos are not stored; only `excecao` is). "Cancelados" is a state today and is not in the list. "Aguardando aprovação" maps to "Ainda não importado", which includes pedidos that can never be imported (student not in the cadastro).
8. **"Days could carry the pedido count the Agenda calendar shows today"**: that count is of non-cancelled pedidos, taken from one unpaginated query of every row of the month grid, capped at 1,000 rows (5.5). The calendar also shows which days are closed for pedidos and lets a Sunday be chosen; it has no mark for today.
9. **The right rail as "the app's only date control"**: the Agenda has its own date, and on purpose it opens on the first date still open for pedidos, not on the app's date (js/views/agenda.js:58). After 13:00 the app's default date is closed for pedidos every day.
10. **The rename to "Pedidos"**: in the code `pedido` is the Demanda request, and on screen both things are already "pedidos" (5.7).
11. **Master–detail with the item "editable there"** (the visual reference lists Pedidos among the lists): a pedido cannot be edited today; there is no RPC for it (5.1).
12. **A third "aprovado"**: the code and the screens already use the word for the approved schedule (`S.aprovacao`, "Aprovar escala", js/fixos.js:29-32) and for the course result (`RESULTADOS = ['aprovado', 'reprovado', 'pendente']`, js/resultados.js:9). "Pendente", "Confirmado" and "Cancelado" are flight statuses (js/config.js:128).
13. **Notification sources "the tab badges (… `selo-age` …)"**: `selo-age` is never shown to the Gestor or the Secretaria and is refreshed only on a few events of this browser (5.5).

## 7. Implications and options for the redesign (suggestions)

Each item is a suggestion, with its cost and its risk.

1. **Rename the UI text only; keep `solicitacao`/`solicitacoes` in code and in the database.** In code the word then has one meaning (a pedido of the Pedidos stage) and `pedido` keeps the other (the engine's request). Cost: level 1 of 5.7. Risk: two vocabularies (screen and code), to be stated once in README "Estrutura". If the modules are renamed anyway, do it as one mechanical commit of the foundation, before the parallel branches.
2. **Approval as columns on the row** (`aprovada_em`, `aprovada_por`, `aprovada_usuario`, mirroring `cancelada_*`) **plus `aprovar_solicitacao` and a way back.** Cost: one additive migration, about 15 to 25 pgTAP checks, the local mirror, the fake server, the list and the badge. Risk: a second source of truth beside `importadas` until Processamento replaces the import; `importadas` must stay in the format (never delete fields). Alternative A: one `situacao` text column (simpler to read, loses who and when unless more columns are added). Alternative B: no migration, keep `importadas` in the day document as the approval record; cost near zero, but the state exists only for a date whose day document is loaded, and the request asks for a migration.
3. **Backfill**: mark as approved the pedidos whose id is in their date's `dias.conteudo -> 'importadas'`. Cost: one `update` in the migration and one pgTAP case. Risk: ids left in `importadas` after "Limpar demanda" (5.1) would be marked approved though they are no longer in the demand.
4. **Born approved**: a pedido registered by Operador or Administrador, and any exception pedido, is approved at registration (the same RPC, no new parameter). Cost: a few lines and three pgTAP cases. Risk: the "aguardando aprovação" step never appears while only operators register; that is the honest picture of a one-operator school.
5. **Cancel after approval**: let Operador and Administrador do it; decide for the Secretaria (refuse, or allow and notify). In both cases show it on the right rail of that date and make it a "needs attention" row of the pipeline. Cost: a rule in the RPC and a notification source. Risk: with a derived Processamento, a pinned, booked or flown flight loses its request; the Escala stage must say what happens to it.
6. **Close the three gaps together with the approval migration**: drop the 9-argument `registrar_solicitacao` (after rewriting agenda.test.sql:35-62 and contas.test.sql:27, which call it); refuse a Sunday even with the exception; add the Agenda's constants to `test/unit/espelho-do-banco.test.js`. Cost: small. Risk: dropping a function is the one non-additive change; a tab open since before 2026-11-14 would fail to register (unlikely; inferred).
7. **Counts for the rail calendar from the server**: a read function returning `(data, quantos)` for a range, instead of fetching every row. Cost: one function and its checks. Risk: one more RPC to keep; without it the 1,000-row cap stays.
8. **Give the pedido the flexibility the Demanda columns hold today**, if those columns are not to become operator restrictions: at least an availability (a period or a range) or a 2nd time. Cost: columns, RPC parameters (a new overload), the form. Risk: it reverses the decision of 2026-11-14 ("o pedido novo é sempre num horário específico", docs/PLAN.md:302); the local-limit rule counts exact times and would need a definition for flexible pedidos.
9. **Carry the Observação and the exception flag into Processamento's view**: today the operator sees them only in the Agenda list. Cost: display only. Risk: the Observação is free text and must stay out of CSV, PDF, BI and the History, as today.
10. **A stable flight key for a derived stage.** The pins, statuses, details and results are keyed by `<alunoId>_<mid>_1` (js/voo.js:5; js/rules.js:52-72), and `mid` is assigned and stored at import. If Processamento stores nothing, the pedido-to-`mid` mapping must still be stable when pedidos are added or cancelled, or pins and results move to another flight. The pedido id cannot be the `mid`: the server accepts at most 6 digits there (`'^[0-9]{1,12}_[0-9]{1,6}_[0-9]{1,6}$'`, supabase/migrations/20261114140751_painel_status_validos.sql:17) and local ids have 13. Cost: a design decision for streams E and G (a stored mapping in the day document is the cheap one). Risk: high if left implicit.
11. **Keep `solicitacao` on every request Processamento emits**, so the engine's booking order (js/engine.js:328) stays as it is and the goldens are untouched (none of them carries the field).
12. **Decide the closed-course gap inside Processamento** (docs/PLAN.md:424): the pure module is the natural place to return "curso encerrado" as a reason. Cost: one branch and one test. Risk: none for the engine.
13. **One date**: with the rail as the only date control, drop `diaEscolhido`, `mesVisivel`, `mudarMes`, `escolherDia`, `carregarMes`, `calendarioHTML` and the `.cal*` CSS; keep `data-cal`, `data-dia`, `data-delta` for the rail's calendar so the focus keeping in `js/dom.js` still applies. Cost: deletions plus the lint for unused exports. Risk: the Secretaria's landing date (question 11 below); the deadline sentence (`#agenda-prazo`) and "closed for pedidos" must move to the rail or to the list header.
14. **Move `ehDomingo`, `hojeEmSaoPaulo`, `FUSO_DO_AEROCLUBE` out of `js/agenda.js`** (to `js/format.js` or a dates module): six files that are not the Agenda import them, and the shell and the rail will too. Cost: import lines. Risk: none.

## 8. Open questions for Pedro

1. Are there Secretaria accounts in production today, or does the Operador register every pedido?
2. Is a pedido registered by an Operador or Administrador born approved? And one registered through the Exceção da Coordenação?
3. May the Secretaria cancel an approved pedido? What happens to its flight when the schedule is already approved, the flight is booked, in progress or has a result?
4. Can an approval be taken back? By whom, and until when?
5. Should the exception stop accepting a Sunday (and a past date)? Today it accepts both.
6. May the old 9-argument `registrar_solicitacao` be dropped now?
7. Does the pedido stay "one exact time", or does it gain an availability, a 2nd preference, a priority, a resource? (Section 6, item 6.)
8. Do hand-made requests and "+ Agendar voo" become pedidos (then almost always past the deadline, so exceptions), or stay as operator restrictions outside Pedidos?
9. How deep is the rename: the screen only? (`pedido` in code is the Demanda request.)
10. Which words for the states, given "aprovado", "pendente", "confirmado" and "cancelado" already mean other things on screen?
11. With one date control, on which date does the Secretaria land after 13:00: tomorrow (closed for pedidos) or the first open date, as today?
12. Should a pedido be editable (time, mission, observação)? With which rule after the deadline and after approval?
13. Should registering, cancelling and approving a pedido go to the History of the date? Today only the import does.
14. Existing pedidos: those already imported become approved? Those of past dates never imported stay pending?
15. The closed course in the import (docs/PLAN.md:424, item 10): import without the course mission, or with it and a warning?
16. The number on each day of the rail: all active pedidos (as today) or only those waiting for approval?

<!-- fim -->
