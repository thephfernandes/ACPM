<!-- Design note of the production-line redesign (2026-11-21). Local working note: never commit this file. -->

# Desenho: Alunos, INVAs e Recursos como telas de lista e detalhe (A, B, C), a desativação, as permissões e o registro das habilitações (F3)

Read on the worktree `.redesenho/wt-plano` (`linha-0-plano`, `48875e3`); paths are relative to it and **as of 48875e3**
(F0 renames files: first table). Nothing in it was changed. "(ran)" marks a fact confirmed with `node` on the pure modules,
on fictitious data, in a scratch copy outside the worktree; "(review, ran)" a fact the independent reviews of this note
measured. Profiles: **O** Operador, **A** Administrador, **G** Gestor, **S** Secretaria; local mode has the Operador role
(does everything) and the Gestor role. "Today" in a rule is `hojeISO()` (js/format.js:26), the date the header's
"hoje" already uses; the app opens on tomorrow (js/main.js:75).

| As of 48875e3 | After F0 (desenho-entrega 2.2) |
|---|---|
| js/views/cadastros.js:249-326; :23-247 | js/views/alunos.js; js/views/instrutores.js |
| js/eventos/cadastros.js, the Alunos and Instrutores halves | js/eventos/alunos.js, js/eventos/instrutores.js |
| the drawer: js/eventos/cadastros.js:24-44, js/views/dados-pessoais.js:35-153 | js/eventos/painel-de-dados.js, js/views/painel-de-dados.js (desenho-lista calls it gaveta-de-dados.js) |
| js/agenda.js:52-140 (`importarSolicitacoes`); js/eventos/agenda.js:28-61 (`importarDaAgenda`) | js/processamento.js; js/eventos/importacao.js |
| the `if` chain of js/eventos/historico.js:53-123; the lists `rRec(); rIns(); rAlu()` | `aoReverter(tipo, desfazer)` per kind; `registrarTela`, `redesenharTelas` (js/telas.js) |
| css/app.css | css/alunos.css, css/instrutores.css, css/recursos.css, css/cadastro.css (C deletes it) |
| test/e2e/cadastros.spec.js; `abrir` waiting for `#wins` | alunos.spec.js, instrutores.spec.js, recursos.spec.js, selectors behind test/e2e/telas/*.js; `appPronto` |

What this note assumes from the other topics, and what it requires of them (if one decides otherwise, the section named
changes):

| From | Assumption or requirement | Used in |
|---|---|---|
| desenho-entrega (the stack) | F0a, F0b, F0c, **F3**, F1, **F2**, **A**, **A2**, **B**, **C**, D, E, G, H, I; B rejoins on A2, C on B; 26 is F3's, 27 C's; F2 ships Alunos with today's fields, the row switch and the inactive filter (2.1) | 4, 5 |
| F1 (desenho-casca) | the Cadastros card has the rows "Alunos", "INVAs", "Recursos" (Recursos hidden for S); the ids `#s-alu`, `#s-ins`, `#s-rec` stay | 2.5 |
| F2 (desenho-lista), as designed | a row is `button.lista-botao` plus `chave` (`label.alvo > input.sw` with the screen's own `data-f` or `data-a`); `inativo` mutes the title and adds the tag; "Mostrar inativos" is a toolbar toggle (`#<lista>-inativos`); a row stays until a filter changes (D7); pinned items (`fixos`); selectable group headers (`idDoDetalhe`); sections with a scope tag (D19); icon actions at the title (D20); the selection mirrored in `?sel=` (D16); a cadastro PT409 re-reads instead of locking (D14); the personal-data editor `js/views/editor-de-dados-pessoais.js`, read 250 ms after a selection | 2.5, 2.6 |
| **F2, required by this note** | **R1** `item.rapida = { marcado, texto, rotulo, atributos }`: a second switch, sibling of the select button, on the third line, its word visible from 400 px of pane (the review of desenho-lista asks the same). **R2** the `chave` shows the word "Ativo" from 400 px. **R3** a group with `idDoDetalhe` is drawn even when none of its items passes the filters. **R4** Enter in the search selects the first record drawn, never a pinned item. **R5** the editor draws its fields from `CAMPOS_PESSOAIS` (label, type, `maxlength`), takes its note and its edit rule from js/views/dados-pessoais.js, and sends one save per sitting: when the focus leaves the section, another record or date is chosen, or the page is hidden | D11, D17, D21, 2.5 |
| desenho-disponibilidade (C, 27) | the INVA's "Nesta data" block (`js/views/disponibilidade-do-dia.js`), the third line and the strip `span.tira` (a sub-block slot it asks of F2); its D15 is this note's D12 | 2.5, 2.7 |
| D, E, G (core, pedidos, processamento) | the reconciliation never adds a request for an inactive student's pedido and never removes one because he is inactive; E's reasons name an inactive INVA or resource that would have served | D3, D7 |
| H (desenho-escala-aprovar) | the rail and Aprovar's pending list take `voosComInativos` (D6) as a source | D6 |

## 1. Decisions

**D1. One cadastro flag, `inativo: true` (absent means active), on `cadastro.stu[]`, `cadastro.ins[]` and
`cadastro.frota[]`; format 26 (F3). It takes effect on the open date when that date is today or later; a past date is
computed as if nobody were inactive.**
- Why: the request's "cadastro-level and applies to all dates", kept apart from "Vem" and "Disponível"; absent-means-active
  keeps every stored document byte-identical until someone is deactivated. The cut at today: every edit recomputes the
  open date with the present cadastro (js/actions.js:166-170, 367). (review, ran) a saved date, not approved, three INVAs
  with 2 h each, Instrutor 01 deactivated: at any edit he has 0 h and the others 3 h, 6 of 6 flights change instructor, no
  alert; the same date approved: his flights stay, each in conflict. The hours of the Lei do Aeronauta are summed from
  those stored schedules by `insId` (mapa-invas 5.4). With the cut, a deactivation never rewrites a past date, moves no
  past hours and puts no conflict on a past approved date.
- Evidence: posicao B5; no flag exists (lacuna-1 §1.1); `separar` and `recurso()` drop unknown keys (js/dias.js:41-47,
  js/frota.js:62); exact shapes pinned by test/unit/dias.test.js:28, 93.
- Rejected: (a) literally every date: the rewrite above, which "Excluir" and "Retirar" already do today to past dates that
  were never approved; (b) a stored `inativoDesde: 'AAAA-MM-DD'`: the same protection plus a stamp with no safe default to
  show and edit; switching from the boolean to it after F3 ships costs another format number and a conversion. Question 8.1.

**D2. The engine, the booking's simulation and the list builders read one derived state, `estadoParaEscalar(estado,
{ data, hoje })`: on a date that is today or later, an inactive INVA is there with `on: false`, an inactive resource with
`av[reg] = false`, and no student's `voaCom` names an inactive INVA; on a past date, or with nobody inactive, it returns
`estado` itself. It is never saved. This departs from posicao B5 ("a state without the inactive ones").**
- Why: with absence the engine cannot draw the pinned flight of an inactive INVA. (ran) pin with Instrutor 02: absent gives
  the row `ins: 'Instrutor fora do cadastro', insKg: 0, kg: 0` and "o instrutor saiu do cadastro"; `on: false` gives the
  full row (`insKg: 70`, `kg: 140`) and "o instrutor não está disponível". Aircraft absent: "a missão ou o avião do pedido
  mudou"; `av: false`: "o avião está indisponível".
- What it does on a date that is today or later, at its next recalculation: an inactive INVA's or aircraft's unpinned
  flights go to another one or are rejected with the engine's own texts; pinned ones stay, in conflict, with Sugestões
  (D4). A date not edited keeps showing its stored schedule: D6 says so on screen.
- Evidence: js/engine.js:414, 435-437, 524-526; js/viabilidade.js:40, 54; (ran) 40 generated scenarios, 20% of the INVAs and
  25% of the resources inactive: 682 flights, none with an inactive one; with nobody inactive the function returns `estado`.
- Cost: on the derived state the list builders would show an inactive item as "indisponível" or "em manutenção", so they
  skip `inativo` themselves (js/candidatos.js:89, 111; js/instrutor-escolhido.js:21-22, 59), on any date. None is imported
  by the engine.
- Rejected: absence; the engine reading `inativo` (an engine change in about ten places); writing `on` or `av` into `S` (it
  would be saved and copied to every new date, lacuna-1 §1.2).

**D3. An inactive student is gated only where a request or a pedido would enter. He stays in the state the engine reads,
so the requests he already has keep flying and show as a pending item (D6). His pedidos stay registered, leave the pending
counts and show "Aluno inativo". This also departs from posicao B5.**
- Why: the engine builds the flights from `state.stu` (js/engine.js:292-300); removing him drops his flights at the next
  edit of each date. A pedido that is never imported never leaves the pending counts (js/views/selos.js:47-49;
  js/views/agenda.js:139-140, 149), and the import handler logs every pending pedido whose student is in `S.stu`
  (js/eventos/agenda.js:53-58): without the change, each import would log "Agenda: <nome> incluído" for a pedido it skipped.
- Where: table 2.4, students.
- Rejected: a derived `fly: false`, or absence (the loss above); the pedido kept in the counts like today's "de aluno que
  não está no cadastro" (js/agenda.js:113-115), which never clears.

**D4. Deactivating rewrites nothing in the day. A pin with an inactive INVA or aircraft stays, in conflict, with
Sugestões; a request whose chosen INVA is inactive is rejected with today's text ("o instrutor escolhido (X) não está
disponível nesta data"). Reactivating gives the engine its input back on every date from then on; it does not give back
the Rodízio place or the hangar position (D5).**
- Why: Pedro's rule for the chosen INVA is a hard constraint, "flies with that INVA or is rejected with the reason" (PR #38);
  a pin is the operator's decision too (posicao B7). The switch's announcement counts both on the open date (D8); D6 shows
  them on every date opened later.
- Evidence: (ran) the two alerts above; deleting today resets the choice and releases pins on the open date
  (js/eventos/cadastros.js:123-124), which no revert brings back.
- Rejected: dropping `insId` in the derived state (the app chooses another and the engine says nothing; offered in
  question 8.3 with a pending item); doing at deactivation what deleting does (irreversible).

**D5. On a date that is today or later, the Rodízio queues and the hangar order are normalised with the active ones: an
inactive INVA leaves the queues and comes back at the end, an inactive aircraft leaves the hangar and comes back at the
back. A past date keeps its stored order.**
- Why: it is the rule both lists already apply to someone new (js/rodizio.js:24-31, js/hangar.js:9-13); a hidden item
  inside the order would make "Subir" and "Descer" swap with something not shown (js/views/filtros-dos-recursos.js:4-5);
  a kept place drifts to the front while he is away (lacuna-1 E1); on a past date the order is an input of a schedule
  already made.
- How: `ativosNaData(lista, data, hoje)` where the orders are normalised for the open date: js/storage.js:93 and :162
  (`normalizeAndMigrateState(x, { ativos })`, called by `carregarDia` with `inativoValeEm(data, hojeISO())`), :187-190
  (`diaParaCopiar(…, ativosNaData(instrutores, data, hoje))`), js/views/rodizio.js:9, js/eventos/rodizio.js:11,
  js/eventos/recursos.js:165, js/views/recursos.js:158 (`rHangar`).
- Rejected: keeping the place (question 8.8).

**D6. A pending item computed outside the engine, `voosComInativos(estado, resultado, { data, hoje })`: on an open date
that is today or later, the flights of the schedule on screen whose student, INVA or resource is inactive. F3 shows it in
the Escala's warnings ("2 voos com Instrutor 02 (inativo) na escala desta data") with "Refazer a escala" for INVAs and
resources; G shows the students' in Processamento; H moves it to the rail and to Aprovar's pending list.**
- Why: a stored date shows its stored schedule until its first edit (js/actions.js:309; js/escala-gravada.js:1-4), so
  after a deactivation every date already built, tomorrow included, keeps his flights without a word.
- "Refazer a escala" (`data-act="refazer-escala"`, `.edit-only`): `gravarAlteracao('mod', 'Escala refeita: Instrutor 02
  está inativo')` with no other change; `save()` runs the engine (js/actions.js:166-182). A student's flight does not
  change by recalculation (D3): his item points to the Demanda (G: Processamento) and to Pedidos.
- Rejected: recalculating on open without saving (the TV and the other profiles would keep seeing the stored schedule);
  nothing (the reviews' finding).

**D7. Wording. Cadastro: "Ativo" (the switch), "inativo" (the tag, the History, the glossary term `inativo`), "Mostrar
inativos" (F2's toggle). Date: "Vem"/"não vem", "Disponível"/"em manutenção", "fora nesta data", "indisponível",
unchanged. This topic changes no engine text.**
- Why: the golden text "nenhum instrutor ativo tem a habilitação de …" (27 alerts, 3 files) stays true in both senses: the
  engine reads a cadastro-inactive INVA as one who does not come.
- Until an engine-text commit: an inactive aircraft reads "todos em manutenção" in a rejection when every other one of the
  type is unavailable (js/engine.js:935), and "o avião está indisponível" on a pin. Outside the engine: Sugestões stops
  pre-selecting "Manutenção da aeronave" for an inactive aircraft (js/reparo.js:110-114, `motivoDoConflito` learns the
  flight's aircraft); E's reasons name an inactive INVA or resource that would have served.
- js/engine.js:244 and :961 say "habilitação própria" and "(marque em Instrutores › Cadastro)". They change only in a
  commit Pedro approves for that purpose (desenho-entrega D15 and its question 5); if it is made, the same commit gives both
  the wording of 2.8 for a requirement that is not an `aviao:` id. Default here: unchanged (question 8.21).
- Evidence: js/engine.js:746-747, 937-938; (ran) grep over the 42 golden files: none has "saiu do cadastro", "fora do
  cadastro", "não está disponível" or "o avião está indisponível".

**D8. The "Ativo" switch is F2's row control: `input.sw` with `data-f="inativo"` inside `li[data-k][data-id]` (students,
INVAs) or `data-a="inativo"` with `data-id="<reg>"` (resources), checked meaning active, handled by a branch of each
screen's own field handler. One click each way. The row stays drawn (F2 D7), muted, with the tag; a toast and `anunciar`
say what it touched on the open date; one History entry with a revert: `setAlunoInativo`, `setInstrutorInativo`,
`setRecursoInativo`.**
- Why: F2's switch is a checkbox saved on `change`, which `confirmado` cannot arm (it rewrites a button's `textContent` for
  3.5 s, js/eventos/confirmacao.js:23-40); a wrong click loses nothing (the same click undoes it, the open date is
  recomputed from the same input, the past is untouched by D1); and three notes had named three owners for a separate
  handler.
- The announcement, from `usoNaData` computed before the change: "Instrutor 02 inativo de hoje em diante. Nesta data: 3
  voos vão para outro instrutor; 1 voo fixo fica em conflito; escolhido em 2 pedidos, que ficam rejeitados. As datas
  passadas não mudam." For a student: "… Os voos dele nesta data continuam; os pedidos ficam registrados e só entram quando
  ele voltar a ativo."
- Owners: Alunos F2 (desenho-entrega 2.1; desenho-lista §5 gives it to A, and the plan must keep one), Recursos B, INVAs
  C. Each registers its revert with `aoReverter` (F0b); F3 validates the three kinds in js/reversoes.js.
- Rejected: an armed second step (an F2 variant nobody else needs; question 8.6); a `data-act="ativo"` module in F3 (F3
  has no switch, and the unused-exports lint refuses its exports).

**D9. Deleting stays, at the foot of the detail, de-emphasised: "Excluir aluno…", "Excluir instrutor…", two clicks (armed
"Confirmar: excluir e apagar os dados pessoais"), under the line "Para quem saiu, desligue Ativo: excluir apaga os dados
pessoais e não se desfaz." No guard. "Retirar da frota…" stays at the foot of a resource, with its History revert.**
- Why: with the switch, deleting is for a record made by mistake. It erases the personal data on the server, orphans
  results and pedidos and has no revert (mapa-alunos 5.5, mapa-invas 5.6). A guard would protect less than it claims:
  `S.horasBase` holds only aircraft hours on dates before the open date in its calendar year (js/limites.js:55-69;
  js/storage.js:197-202), not last year, simulators or Grounds; a student's pedidos are in memory only for the Agenda's month.
- Rejected: the guards (question 8.17 keeps the one that is reliable, a student with a result); an icon action at the title
  (F2 D20: the first stop after the title, for the one action that destroys).

**D10. The "Disponibilidade do dia | Cadastro" switch goes. The detail is one scroll of sections with F2's scope tag:
"Nesta data · sex 20/11" first, then "… · todas as datas". `mostrarVista`, `vistaDoBotao` and js/views/vistas.js go: B
removes the `rec` key and its calls (js/eventos/recursos.js:43-44, js/views/recursos.js:145); C, the second of the two in
the stack, deletes the module with js/eventos/navegacao.js:13, 52-53 and the instructors' calls.**
- Why: one record on one page; the switch hid half of it, and the two switches are the module's only users
  (js/views/vistas.js:1-13). The request's "reuse mostrarVista" is a departure (section 7).
- Rejected: the switch inside the detail (two clicks to see a record whole).

**D11. The per-date switch is also on the INVAs and Recursos rows ("Vem", "Disponível"), the same control as in the
detail: F2's `item.rapida` (R1). Without R1 it lives only in the detail, and 2.7 counts both.**
- Why: marking who does not come and which aircraft is in maintenance is the daily routine, one click per item today
  (index.html:446-447); behind a selection it is two. desenho-disponibilidade D15 relies on it.
- Rejected: only in the detail (question 8.5).

**D12. The list is the date's overview of the INVAs and of the resources; there is no board.** An INVA row says whether he
comes, his ranges, his flights (desenho-disponibilidade 2.6) and his month hours; a resource row whether it is available,
its hours to the inspection and its hours in the schedule.
- What nothing else covers: no other screen lines every INVA up by time. The "Por instrutor" map draws flights and, as free
  rows, whoever has "Vem", with no availability on it (js/views/escala.js:133-137, 580-582); "INVAs disponíveis" is a
  count. Only the row's strip (desenho-disponibilidade, a sub-block slot of F2) keeps the time columns; without it, the
  third line's text. "Who can take this time" is answered exactly by the booking dialog's list (js/candidatos.js
  `instrutoresQueServem`), which the grid never did.
- Cost (2.7): a typical day 8 → 9 interactions, a heavy one 19 → 22; a screen shows about half as many INVAs.
- Rejected: a board as a pinned item: today's grid needs 960 px (css/app.css:1044) and the detail pane has about 599 px
  (desenho-disponibilidade D15), so it would span both panes as a second surface for the same switches; for Recursos a
  board would put "Disponível" and the hours in three places. Question 8.4, one question with desenho-disponibilidade 5.

**D13. "Nome completo" is a new nullable column, `dados_pessoais.nome_completo` (1 to 120 characters), for students and
INVAs; `nm` stays the name on the schedule (up to 80, js/format.js:54-55).**
- Why: it is personal data; the cadastro is read by the Gestor and its names go to the History, the CSV and the TV
  (mapa-alunos §6.1; mapa-banco 5.4).
- Three cases, the same in SQL (M1), in `gravarDadosPessoais` and `camposAlterados` (local mode and the fake run them,
  js/dados-pessoais.js:63-65, 87-113) and in their tests: the key absent keeps the stored value (the app before A never
  sends it); the key present and empty clears it; text sets it. The client after A always sends the key.
- Rejected: `stu[].nomeCompleto` in the cadastro (visible to the Gestor); today's "Nome" as the full name (question 8.11).

**D14. "Missão anterior" is the student's latest result in his course that is not `pendente`: code, result, date, "sem
voo" when it has none, and who registered; latest by `data`, then `registrado_em`. "Missão atual" is the first released
mission, with the others released at once under "Também liberadas"; a Noturno by its night ("NOT (com TSL-01 e TSL-02)").**
- Evidence: `progressoNoCurso`, `proximasMissoes` (js/progresso.js:87-106); `situacao` keeps the last record of each mission
  (20261114120000_resultados_de_missao.sql:54-66); `rotuloDaMissao` (js/programa.js:149-153).
- Rejected: "the mission before the current one in the program" (undefined with free phases and several released missions).

**D15. Results in the detail, O and A only, no SQL:**
- **(a) A flight of the open date** shows today's control `resultadoNaEscala(o)` (js/views/etapas.js:176-185), handled by
  today's document listener (js/eventos/escala.js:236-261): no new handler.
- **(b) "Registrar resultado sem voo":** mission, result, date (default the open date when it is not after today, else
  today; `max` today), `voo: null`. Refused for a mission that has a flight on the open date ("PE-03 tem voo nesta data,
  às 08:20 no PR-VOB: registre no voo, acima."). Out of order only with a confirmation (`motivoDoBloqueio`).
- **(c) "Colocar no curso até…":** approves without a flight every mission before the chosen one in the course's order
  that is neither approved nor dispensed, a Noturno by its night (never a leg); the armed confirmation gives the count and
  the codes; one History entry with "↶ Reverter" (`desfazerColocacao`: the result each mission had before).
- Why: (b) the app opens on tomorrow (js/main.js:75) and D14 orders by `data`: a record dated tomorrow would outrank a real
  flight of today; a no-flight record for a mission flown in a flight row would leave that row with "Resultado" forever
  (`resultadoDoVoo` matches by `voo`, js/resultados.js:26-29). (c) `faltam` is what blocks one mission, not the course
  before it (js/progresso.js:57-64): (review, ran) for NOT it approves 5 missions and leaves the student in Fase 1. (ran,
  PP model) the course order gives PE-04 19 records, NAV-01 13, SOLO-03 26, NOT 42, AVX-CQ 43, each leaving the target
  "liberada" and next.
- Rejected: free text; a batch RPC (new SQL and mirrors for a rare action); `faltam` (above). Questions 8.15, 8.16.

**D16. Search: the name, the nome completo and the CANAC for O, A and S; the name only for the Gestor, whose personal-data
cache stays empty (js/views/dados-pessoais.js:15, 24).** The row's CANAC comes from that cache, never from `S`.

**D17. Personal data are F2's editor (desenho-lista D11), shared by Alunos and INVAs, with one default in both notes:
edited in place, no "Salvar", one save per sitting (R5): one RPC and one History entry when she leaves the section. A
adds the field, the permission and a narrower list read.**
- Why: "edited in place" (pedido.md:89); a save per field writes up to six History entries per person on the open date,
  whose History shows only the latest 200 (js/backends/supabase.js:172); a "Salvar" leaves a draft out of sight once
  another row is selected.
- The narrower list read: `listarDadosPessoais` selects `id_cadastro, canac, nome_completo, atualizado_em`
  (js/backends/supabase.js:241-246 reads every field of everybody today); the selected person is read whole by F2's read,
  and the other four fields wait for it ("Lendo os dados…"). With people kept instead of deleted (D9), every CPF, birth
  date, phone and e-mail would otherwise sit in each Operador's and Secretaria's browser to draw one column.
- Rejected: a save per field; a section "Salvar" (question 8.13, shared with desenho-lista 2).

**D18. The Secretaria reads and no longer edits personal data, of students and INVAs alike: A's client shows her text; A2's
migration makes the server refuse her write. Client rule: `editaDadosPessoais(perfil) = operaEscala(perfil)`
(js/perfis.js) and `podeEditarDadosPessoais() = !isGestor() && (ApiClient.perfil === null ||
editaDadosPessoais(ApiClient.perfil))` (js/views/dados-pessoais.js): local Operador yes, local Gestor no, a locked
screen no.**
- Why: `le_dados_pessoais()` is both the read policy and the write check (20261113150000_dados_pessoais.sql:55-69, 88-90;
  20261114151953_dados_pessoais_versionados.sql:36-38), so the write gets a predicate of its own and the read is left; the
  3-argument overload also lets her write and the app never calls it (js/backends/supabase.js:258). Two PRs so both follow
  "preview, production, then merge" (desenho-entrega D8): A needs M1 on the server before its merge; M2 goes after A is
  published, because the app before A offers her a "Salvar" that M2 would turn into "Verifique a conexão"
  (js/views/dados-pessoais.js:144).
- `ApiClient.salvarDadosPessoais` refuses `readOnly` as `registrarResultado` does (js/storage.js:303-305, 309-312).
- Rejected: changing `le_dados_pessoais()` (she would stop reading; question 8.10); one file for both (either the name is
  lost between the merge and the migration, or she sees a "Salvar" that fails).

**D19. F3: the groups move into js/habilitacoes.js; a resource gets `exige`, a list of ids of the same registry (any of the
21, or `aviao:<matrícula>`); `habilitacaoPropria: true` converts to `exige: ['aviao:<reg>']` and stays as a mirror
("`exige` contains the resource's own id"); js/engine.js is not edited.**
- Evidence: (ran, scratch copy) with the list, a reader that still accepts the flag alone and the motive as the first
  missing id: engine.golden.test.js 42 of 42 unchanged; the 165 tests of invariants, compactar, candidatos, reparo,
  reparo-horario, agendamento and viabilidade pass; two unit tests change (the exact normalised shape); a C172 that
  requires `ifr` is paired only with the INVA who has it. (review, ran) the same 42 of 42.
- Rejected: keeping the flag and adding a second list for other ids (two fields every reader must join).

**D20. Orphan `aviao:` ids stay on the INVAs. The INVA's detail shows each one he holds that no resource requires, with its
switch on, so it can be taken off by hand.** Why: the revert of "Retirar" and of the attribute restores the pairing only
because the id stays (test/e2e/cadastros.spec.js:891-934).

**D21. Recursos: the list is grouped by category in the order of `CATEGORIAS` (C152, C172, Simulador, PA-34); the header
selects the category, whose detail holds "Horários de decolagem" and the type's fixed facts; a header stays drawn when
none of its resources passes the filters (R3). The "Categoria" filter is replaced by the groups.** Evidence: two orders
exist today (mapa-recursos 5.1). Rejected: the times repeated inside each resource (reads as "this aircraft's times").
Without R3: the four categories as pinned items.

**D22. The take-off times draft keeps today's rules (mapa-recursos 5.8); the category's header shows "edição aberta" while a
draft exists, and selecting something else does not discard it.**

**D23. "Ordem no hangar" is the pinned first item of the Recursos list; its detail is the whole order for the open date,
never filtered, active aircraft only on a date that is today or later (D5).** Rejected: a row of the Escala card (it would
leave the aircraft availability it is read with).

**D24. "+ Novo recurso" opens the form in the detail pane; "Retirar da frota…" is at the resource's foot.**

**D25. INVAs: "preferences" are the read-only list of the students who point at him; "Limites da Lei do Aeronauta" is a
pinned item of the INVAs list; his Rodízio positions show read-only in "Nesta data".**

**D26. The Gestor and the Secretaria see an INVA's grouped habilitações and hours, read-only** (today the drawer opens only
for who edits; none of it is personal data).

**D27. The screen is labelled "INVAs" (posicao B4); code and texts keep `ins` and "instrutor"** (the engine's texts say
"instrutor" and are in the goldens).

**D28. Format 26 belongs to F3 and is two commits under the one number: "registro" (the groups, `exige`, the step, both
whitelists, `inativo` whitelisted, the goldens run) and "inativos" (js/inativos.js, every reader gated, the pending item,
the e2e).** Why: each diff is reviewed alone; the golden proof of the first is read without the second. A, B and C take no
format number for this topic.

**D29. Retention: an inactive person's personal data are kept until an Operador or Administrador clears them. The foot of
an inactive person's detail offers "Apagar os dados pessoais", two clicks: the store reads the person and saves every
field empty (six with the nome completo); the server deletes the row and logs the field names only
(20261114151953:99-101, 110-116).** Question 8.14.

**D30. Icon actions at the title, only where an action exists: an INVA's "Agendar voo com <nome>" (`data-act="agendar"
data-agendar="i:<id>"`) and a resource's "Agendar voo no <reg>" (`data-agendar="r:<reg>"`), both existing contexts of the
booking (js/agendamento.js:73-97), for O and A, on an active record.** A student has none (the booking has no student
context); a category has the take-off editor's own "Editar".

## 2. How it works

### 2.1 Data shapes

```
cadastro.stu[]   { id, nm, kg, bl: [insId], voaCom?: [insId], curso?: 'PP', inativo?: true }
cadastro.ins[]   { id, nm, lv?, kg, hab: [id…], horasExternas?: {…}, inativo?: true }
cadastro.frota[] { reg, tipo, soParafuso?: true, soVfr?: true, habilitacaoPropria?: true, exige?: [id…], inativo?: true }
dados_pessoais   + nome_completo text null check (char_length(nome_completo) between 1 and 120)
```

- `inativo` is stored only when `true`. `exige` is stored only when it has an id: valid ids (`HABILITACOES` or
  `aviao:<MATRICULA>`), no repeats, in registry order, never the id of the resource's own type.
- `habilitacaoPropria` is written by `recurso()` exactly when `exige` contains `aviao:<own reg>`.
- History reverts, validated in js/reversoes.js, applied by the screen that registered the kind (`aoReverter`):

| Kind | Payload | Validated in | Applied by |
|---|---|---|---|
| `setAlunoInativo` | `{ id: <inteiro>, inativo: <boolean a restaurar>, label }` | F3 | js/eventos/alunos.js (F2) |
| `setInstrutorInativo` | `{ id, inativo, label }` | F3 | js/eventos/instrutores.js (C) |
| `setRecursoInativo` | `{ reg: <MATRICULA>, inativo, label }` | F3 | js/eventos/recursos.js (B) |
| `setExigencias` | `{ reg, lista: [até 30 ids válidos], label }` | B | js/eventos/recursos.js (B) |
| `desfazerColocacao` | `{ aluno, curso: <sigla>, missoes: [{ missao: <código>, resultado: 'pendente' \| 'reprovado' \| 'aprovado' }] (até 60), label }` | A | js/eventos/alunos.js (A) |
| `setAtributo` with `habilitacaoPropria` | unchanged | — | adds or removes the own id in `exige` |

- Nothing per date is added by this topic.

### 2.2 Modules and signatures

| Module | Export | Contract |
|---|---|---|
| `js/inativos.js` (new, pure, F3) | `inativo(item)` | `item.inativo === true` |
| | `soAtivos(lista)` | the items that are not inactive |
| | `inativoValeEm(data, hoje)` | `data >= hoje` (ISO dates) |
| | `ativosNaData(lista, data, hoje)` | `soAtivos(lista)` when `inativoValeEm`, else `lista` |
| | `estadoParaEscalar(estado, { data, hoje })` | `estado` itself on a past date or with nobody inactive; else a shallow copy with `ins` (inactive ones copied with `on: false`, `inativo` kept), `av` (inactive regs `false`) and `stu` (those whose `voaCom` named an inactive INVA copied without him). Never passed to `salvarDia` or to a function that changes the state |
| | `voosComInativos(estado, resultado, { data, hoje })` | `[{ fKey, de: 'aluno' \| 'instrutor' \| 'recurso', id, nome }]` on a date that is today or later; `[]` before |
| | (F2) `usoNaData(estado, resultado, { de, id })` | `{ voos, fixos, escolhidoEm }` on the open date, before a change |
| | (F2) `avisoDoInativo({ de, nome, inativo, uso })` | the announcement text of D8 |
| `js/habilitacoes.js` (F3) | `GRUPOS_DE_HABILITACAO` | `[{ id, titulo, ids, dica? }]`: the six groups of js/views/cadastros.js:35-43 |
| | `PREFIXO_DA_HABILITACAO_DO_AVIAO`, `habilitacaoDoAviao(reg)` | moved from js/frota.js, which re-exports them |
| | `exigenciasDoRecurso(recurso)` | `recurso.exige` when it is a list; else `[aviao:<reg>]` when `habilitacaoPropria`; else `[]`; js/frota.js keeps exporting it as `exigenciasDoAviao` |
| | `faltaParaORecurso(instrutor, recurso)` | the first required id he lacks, or `null` |
| | `normalizarExigencias(lista, tipo)` | the stored form of `exige` |
| | `gruposDosRecursos(frota, doInstrutor = [])` | the group "Habilitação própria do recurso": every `aviao:` id some resource requires (inactive ones too), plus the orphans in `doInstrutor` |
| | (B) `habilitacaoDoTipo(tipo)`, `quemOpera(instrutores, recurso)` | `c152`, `c172`, `mlte`, `sim_mono`, `sim_multi`; the active INVAs who hold the type's id and all of `exige` |
| `js/config.js` (F3) | `MATRICULA` | moved from js/frota.js (re-exported there), so js/habilitacoes.js imports nothing from js/frota.js |
| `js/frota.js` (F3) | `normalizarFrota`, `novoRecurso` | carry `exige` and `inativo`; `FROTA_INICIAL` built normalised (PR-VOM with `exige`) |
| | `comAtributo(recurso, atributo, val)` | for `habilitacaoPropria`, the own id in or out of `exige` (the checkbox and old History entries) |
| | (B) `comExigencias(recurso, lista)` | the resource with the new list |
| `js/perfis.js` (A) | `editaDadosPessoais(perfil)` | `operaEscala(perfil)`; `veDadosPessoais` stays the reading rule |
| `js/views/dados-pessoais.js` (store; F2 creates `podeEditarDadosPessoais`, A changes it) | `podeEditarDadosPessoais()` | D18 |
| | (A) `apagarDadosPessoais(tipo, id)` | reads the person, saves every field empty from the version read (D29) |
| `js/dados-pessoais.js` (A) | `CAMPOS_PESSOAIS` | "Nome completo" (`nome_completo`, text, `maxlength` 120) first |
| | `gravarDadosPessoais`, `camposAlterados`, `comCampoMudado` | the three cases of D13; `comCampoMudado` always sends `nome_completo` (empty to clear) |
| `js/resultados.js` (A) | `ultimoResultadoDoAluno(registros, aluno, curso)` | D14; indexed once per list |
| `js/progresso.js` (A) | `paraColocarNoCurso(curso, mapa, aluno, missaoId)` | the ids D15(c) approves, in course order, legs replaced by their night, the target's own night left out |
| | `alvosDaColocacao(curso)` | the missions she may choose: neither a Noturno leg nor dispensed, grouped by phase |
| `js/eventos/resultados.js` (new, A) | `registrarResultadoNaTela(registro, { nome })` | the body of js/eventos/escala.js:236-261 (RPC, `S.resultados`, History, redraw), shared by the Escala's listener, the no-flight form, the placement and its revert |

### 2.3 Who receives the derived state (F3; inert until a switch exists)

| Call site | Today | After |
|---|---|---|
| js/actions.js:367 (`escalaCalculada`) | `runAllocationEngine(S)` | `runAllocationEngine(estadoParaEscalar(S, { data: DATA, hoje: hojeISO() }))`; `salvarDia(DATA, S, RES)` keeps `S` |
| js/views/agendamento.js:157, 181, 185, 338, 356 | `S` | the derived state (the list and the simulation read the same) |
| js/views/demanda.js:36, js/views/escala.js:354, js/views/reparo.js:23 | `S` | the derived state |
| js/export.js:125 (Excel) | `{ frota: S.frota, av: S.av }` | `{ frota: ativosNaData(S.frota, DATA, hoje), av: <derived> }` |
| the order normalisers of D5 | the whole roster or fleet | `ativosNaData(…, DATA, hoje)` |
| js/eventos/agendamento.js:35, js/eventos/escala.js:181, 284-285, js/eventos/demanda.js:207, the reverts | `S` | `S` (they change it) |

### 2.4 The decision for each place

Instructors (rows of lacuna-1 §2 and §3). "Hidden" means hidden unless "Mostrar inativos" (F2 D8).

| # | Place | Decision |
|---|---|---|
| I1, I2, I3 | day grid, Cadastro table and count, the two drawers | C's list: hidden, muted with the tag; the count of the toggle's scope; the detail opens for an inactive INVA, "Nesta data" disabled with the note of 2.6 |
| I4, I5 | Alunos "Não escalar com…", "Priorizar com…" | active INVAs only (F3 on today's selects; F2 keeps it in the detail) |
| I6 | the chips of both lists | stay, "Instrutor 02 (inativo)" |
| I7 | Demanda "Instrutor" | not listed (`impedimentoDoPedido` answers 'inativo' first); when he is the chosen one: "Instrutor 02 (inativo)" |
| I8 | "Automático (prioriza A, B)" | names active ones only (the derived `voaCom`) |
| I9 | Escala, a flight's instructor list | not listed, unless he is the flight's ("(inativo)") |
| I10, I11 | "Agendar voo" "Instrutor" and its default | not listed, so no "Marcar disponível" |
| I12, I13 | alternatives, Sugestões | nothing to do (only who serves) |
| I14 | Rodízio screen | not listed on a date that is today or later (D5); a past date shows its stored queue, tag "inativo" |
| I15 | "Por instrutor" free rows | active and with "Vem" |
| I16 | rows with flights, their "+" | the row stays with his name; no "+" and no click to book |
| I17 | BI "N/M instrutores" | N active with "Vem", M active |
| I18 | BI "Horas por instrutor" | no row for an inactive one without hours in the period; with hours, the row stays |
| I19 | "Simular 30 dias" (local) | draws among active ones |
| I20 | login text | unchanged |
| E1 | Rodízio membership | D5 |
| E2 | engine search | `on: false` in the derived state, dates from today on |
| E3 | a request that chose him | rejected, code `instrutor-escolhido` (D4) |
| E4 | a pin with him | stays, conflict `instrutor-indisponivel`, Sugestões |
| E5 | "Priorizar com" | ignored, no warning |
| E6 | yesterday's Noturno return | as today |
| E7 | hours for the legal limits | computed for everyone |
| E8 | personal data | kept (he stays in `cadastro.ins`); D29 |
| E9 | `setInsOn`, `desfazerAgendamento` | act on the stored `on` and ranges |
| E10 | CSV, PDF, Excel names, painel.html and `painel_do_dia`, History | nothing to do: they read the name stored in each schedule row (js/csv.js:48; js/export.js:67, 85; js/planilha.js:173; 20261120150000:65), and a pinned flight keeps it (D2) |

Resources (rows of lacuna-1 §4 and §5):

| # | Place | Decision |
|---|---|---|
| R1, R2, R3 | day table, Frota, count | B's list: hidden, muted; group header "C152 · 12 de 13 disponíveis" counts active ones |
| R4 | Ordem no hangar | D5, D23 |
| R5 | Horários de decolagem | unchanged |
| R6 | "Por recurso" free rows | active only (not "em manutenção"); a row with flights stays |
| R7 | "Agendar voo" "Recurso" | not listed |
| R8, R9 | alternatives, Sugestões, the Escala's filter | nothing to do |
| R10 | BI "n/N Recursos disponíveis" | n active and available, N active |
| R11 | BI "Horas por recurso" | no row without hours; with hours, the tag "Inativo" in the place of "Manut." |
| R12 | "Simular 30 dias" (local) | active only |
| R13 | Excel | `ativosNaData`: the column is released; a reg with a flight still gets one (js/planilha.js:177); question 8.9 |
| R14 | INVAs: "Habilitação própria do recurso" and the filter options | every id a resource requires, inactive ones included (the pairing survives a reactivation) |
| R15, R16 | texts naming the "Só Parafuso" aircraft; type pickers | unchanged |
| F1 | engine, swap, compaction | `av: false` in the derived state, dates from today on |
| F2 | a pin on it | stays, conflict `aviao-indisponivel`, Sugestões; no cancel reason pre-selected (D7) |
| F3 | the day's `av`, `horas` | kept and copied as stored; back as it stopped |
| F4 | hangar as an engine input | the engine appends it at the back and never picks it |
| F5 | 50 h warning and badge | no warning; the badge skips it (js/views/selos.js:26-28) |
| F6 | Noturno return | as today |
| F7 | matrícula unique | against the whole fleet: "Já existe um recurso com a matrícula X." |
| F8, F9 | CSV, PDF, TV, server | nothing to do |

Students (rows of mapa-alunos 5.5, plus the pending counts):

| Place | Decision |
|---|---|
| Pedidos form "Aluno" (`#ag-aluno`, js/views/agenda.js:198-199) | active only |
| a pedido of an inactive student in the Pedidos list (js/views/agenda.js:140-149) | the tag "Aluno inativo" in place of "Ainda não importado"; out of "Importar N pedidos para a demanda" |
| the Agenda badge and the Demanda's "Importar N pedidos da agenda" (js/views/selos.js:47-58) | not counted |
| the import (`importarSolicitacoes`, js/processamento.js after F0b) | skipped, not added to `importadas`, counted in `resumo.deInativo`; toast "· N de aluno inativo (entram quando ele voltar a ativo)"; History lines only for those imported (js/eventos/importacao.js) |
| server `registrar_solicitacao` | unchanged (it does not know the roster) |
| the reconciliation (G) | not added, with the reason; never removed |
| Demanda rows; "Pôr um aluno na demanda" datalist (js/views/demanda.js:104-117) | the datalist offers active ones; a row that has a request stays, tagged "inativo" |
| "Agendar voo" "Aluno" (`opcoesDeAluno`, js/agendamento.js:343-365) | an inactive student only in "Ficaram fora da escala" and "Na demanda" (he has a request on the date), never in "Outros alunos" |
| engine | unchanged (D3) |
| Alunos list, count, Curso options | hidden (F2 D8) |
| Cursos "N alunos no PP" and the phases (js/views/cursos.js:270) | active only |
| BI "Simular 30 dias" (local; js/eventos/bi.js:36, `stuPool`) | active only |
| his flights on a date that is today or later | the pending item of D6 ("aluno inativo com voo nesta data") |
| personal data, results | kept; D29 |

Processamento's sub-tasks "recursos disponíveis" and "INVAs disponíveis" count active ones in both numbers.

### 2.5 The screens

List rows (F2's structure; lines 1 and 2 are cadastro, line 3 is the open date and starts with it):

| Screen | Dot | Line 1 | Line 2 (accent) and meta | Line 3 (muted) | Row controls (O, A) |
|---|---|---|---|---|---|
| Alunos | "sem peso" | `nm` | O, A, S: "CANAC 123456 · PP"; G: "PP". Meta "13/46" | "Fase 5 · próxima NAV-01", "concluído" or "sem curso"; "· voa às 08:20" when in the date's schedule | `chave` "Ativo" |
| INVAs | "sem peso"; 90% of a legal limit | `nm` | O, A, S: "CANAC 654321 · Checador · MLTE · C172 · +4"; G without the CANAC. Meta "42,5 h" (month) | "20/11 · vem 06:30–11:30 · 12:40–17:30 · 3 voos" or "20/11 · não vem"; the strip under it (desenho-disponibilidade) | `rapida` "Vem"; `chave` "Ativo" |
| Recursos | stopped, or under 5 h to the inspection | `reg` | `tipo` and the tags "Só Parafuso", "Só VFR", "Exige: Avião PR-VOM". Meta "12,5 h" (aircraft) | "20/11 · disponível · 2 h na escala", "20/11 · em manutenção" or "20/11 · parou para revisão às 14:30" | `rapida` "Disponível"; `chave` "Ativo" |

- G and S see no switch. S has no Recursos, as today (css/app.css:184-186).
- Pinned items: Recursos "Ordem no hangar"; INVAs "Limites da Lei do Aeronauta". Group headers: Recursos "C152 · 12 de 13
  disponíveis" (selectable, R3).
- Toolbar: search; Alunos "Curso" (shared with the Demanda until G), INVAs "Habilitações" (groups from the registry); "Mostrar
  inativos" on all three; count; "+ Novo …".
- An inactive record's `rapida` is not drawn.
- The CANAC and the nome completo of the rows and of the search come from the personal-data cache, filled by
  `carregarDadosPessoais` and refreshed when a person is read or saved; the list is filtered again when the cache arrives.

Detail of a student (`div.det[data-k="s"][data-id]`; title `nm`, subtitle "CANAC 123456 · PP · Piloto Privado", no icon
action):

| Section (scope) | Field, label | Stored in | Who edits | How it saves | Step |
|---|---|---|---|---|---|
| Nesta data · sex 20/11 | his flights of the date (time, mission, code, resource, INVA, status); "Sem voo nesta data." | `dia.resultado`, read-only | — | — | A |
| | "Resultado" of a flight with a course mission: `resultadoNaEscala(o)` | `resultados_de_missao` | O, A | today's listener | A |
| Curso e missões · todas as datas | "Curso matriculado" `select[data-f="curso"]` | `stu[].curso` | O, A | on change, `gravarAlteracao` | F2 (in Cadastro), A moves it here |
| | "Progresso", "Missão anterior", "Missão atual", "Também liberadas" | derived | — | — | A |
| | "Registrar resultado sem voo": "Missão" (groups "Liberadas", "Fora da ordem (pede confirmação)", "Já com resultado"), "Resultado" ("Aprovado", "Reprovado", "Pendente (desfaz)"), "Data" (`max` today), "Registrar" | `resultados_de_missao`, `voo` null | O, A | RPC; History "Resultado de <nome> em <código>: aprovado (sem voo)" | A |
| | "Colocar no curso até…" (`alvosDaColocacao`, by phase), armed "Confirmar: aprovar 13 missões sem voo (IN-01 … TMA-05)" | the same, one record per mission | O, A | RPC in sequence; a failure stops and says how many; one History entry with "↶ Reverter" | A |
| Cadastro · todas as datas | "Nome (na escala)" `[data-f="nm"]`, "Peso (kg)" `[data-f="kg"]` | `stu[].nm`, `.kg` | O, A | on change | F2 |
| | "Priorizar com", "Não escalar com": chips with ✕ (`unvc`, `unbl`) and the selects (`voaCom`, `bl`), active INVAs only | `stu[].voaCom`, `.bl` | O, A | on change | F2 |
| Dados pessoais · todas as datas | "Nome completo", "CPF", "CANAC", "Nascimento", "Celular", "E-mail"; foot "Atualizado em … por …" | `dados_pessoais` | O, A; S reads; absent for G | F2's editor, one save per sitting | F2; A adds "Nome completo" |
| foot | "Excluir aluno…"; for an inactive student also "Apagar os dados pessoais" | — | O, A | two clicks | F2; A |

Detail of an INVA (`div.det[data-k="i"][data-id]`; title `nm`, subtitle "CANAC 654321 · Checador · MLTE"; icon action
"Agendar voo com <nome>"):

| Section (scope) | Field, label | Stored in | Who edits | How it saves |
|---|---|---|---|---|
| Nesta data · sex 20/11 | desenho-disponibilidade 2.6: "Vem nesta data" `[data-f="on"]`, "Faixas", "Turno", "Períodos", "Editar faixas", "O que cabe nestas faixas", "Na escala desta data" | `dia.ins[id]` | O, A | one click at once; typed ranges by "Salvar faixas" |
| | "Escolhido em N pedidos desta data"; "No rodízio: Voo C172 4º · Voo noturno 2º" | derived | — | — |
| Horas de voo e limites da lei · calculado para sex 20/11 | "No mês: X h de 100 h · No semestre · No ano" | derived | — | — |
| | "Fora do app, neste mês (novembro)" `[data-f="ext-mes"]`, "Fora do app, neste ano, antes de novembro" `[data-f="ext-ano"]` | `ins[].horasExternas` | O, A | on change |
| Cadastro · todas as datas | "Nome" `[data-f="nm"]`, "Peso (kg)" `[data-f="kg"]` | `ins[].nm`, `.kg` | O, A | on change |
| Habilitações · todas as datas | one switch per habilitação in the six groups, `[data-f="hab"][data-h]`; "Habilitação própria do recurso"; the orphans (D20) | `ins[].hab` | O, A; G and S see | on change |
| Dados pessoais · todas as datas | as in Alunos | `dados_pessoais` | O, A; S reads; absent for G | F2's editor |
| Alunos que apontam para ele | "Priorizam: …", "Não são escalados com ele: …" | derived from `stu[]` | — | — |
| foot | "Excluir instrutor…"; for an inactive INVA "Apagar os dados pessoais" | — | O, A | two clicks |

Detail of a resource (`div.det[data-id="<reg>"]`; title `reg`, subtitle `tipo` and the attribute tags; icon action "Agendar
voo no <reg>"):

| Section (scope) | Field, label | Stored in | Who edits | How it saves |
|---|---|---|---|---|
| Nesta data · sex 20/11 | "Disponível" `[data-a="av"][data-id]` (off reads "Em manutenção nesta data") | `dia.av[reg]` | O, A | on change; revert `setAv` |
| | "Horas disponíveis até a revisão de 50 horas" `[data-a="horas"][data-horas]`, aircraft only; "Revisão feita" `[data-act="revisao"]` | `dia.horas[reg]` | O, A | on change; two clicks |
| | "Na escala desta data"; "No hangar: 3º de 22" | derived | — | — |
| Cadastro · todas as datas | "Matrícula", "Tipo" | `frota[].reg`, `.tipo` | nobody | — |
| | "Só Parafuso", "Só VFR" `[data-a="atributo"]` | `frota[]` | O, A | on change; revert `setAtributo` |
| | "Habilitações que o INVA precisa": "Do tipo: C172"; "Habilitação própria deste recurso (Avião PR-VOM)"; "Exigir também…" with chips; "Quem pode operar: 4 INVAs" | `frota[].exige` | O, A | on change; reverts `setAtributo`, `setExigencias` |
| foot | "Retirar da frota…" | — | O, A | two clicks; revert `readicionarRecurso` |

- Detail of a category: "Horários de decolagem · todas as datas" (today's summary and editor, one category) and "Do tipo"
  (weight limit, tank, whether the 50 h control applies, the type's habilitação), read-only.
- Detail of "Ordem no hangar": "Nesta data" scope, today's list and its three buttons.
- Detail of "Limites da Lei do Aeronauta": "Todas as datas, todos os INVAs", today's panel (A; local mode, the Operador).
- A result without a flight: the record has no `voo`, so no flight row shows it; its History entry is the open date's;
  "Pendente (desfaz)" undoes it; nothing is edited or deleted.
- What the Secretaria sees: Alunos and INVAs, the CANAC on the rows and in the search; every section as text, "Dados
  pessoais" included; no switch, no "+ Novo", no delete, no form. She keeps registering pedidos (D). No Recursos.
- The Gestor: the three screens read-only; no CANAC on the rows or in the search; no "Dados pessoais". In local mode the
  Gestor role hides the same on screen only, as today (mapa-alunos 5.7).
- Phones (F2 D15: one view under 720 px of content): the row is dot, avatar, text, `rapida` and `chave`, two 44 px targets,
  about 140 px of text at 320 px; under 400 px of pane the words "Vem", "Disponível" and "Ativo" are hidden and the switches
  keep `title` and the names "Instrutor 02 vem em 20/11" and "Instrutor 02 ativo no cadastro". Pinned items and a category
  open as the second view like any record ("‹ Recursos").

### 2.6 States

| State | Behaviour |
|---|---|
| nothing selected | F2's empty state; the selection per list is mirrored in the address (F2 D16) |
| inactive record | every cadastro field editable; "Nesta data" disabled with "Inativo no cadastro: não entra em voo novo de hoje em diante. As datas passadas e o que está abaixo ficam guardados."; "Apagar os dados pessoais" at the foot |
| read-only profile | F2 draws text; switches and buttons are `.edit-only`; js/somente-leitura.js disables what is left in `main` |
| after a cadastro conflict (PT409) | F2 D14: the app reads again, the detail says the last change was not saved, she redoes it; a day conflict or `formato` keeps today's lock |
| before the date's data is read | every change refused by js/eventos/registro.js as today |
| personal data | the CANAC and the nome completo from the cache at once; the other four after the person's read ("Lendo os dados…", disabled); PT409 and P0002 keep their texts (F2 2.7) |
| results or programs not read | "Curso e missões" shows only the course; the forms are disabled |
| a no-flight result for a mission with a flight on the open date | refused at the field, pointing to the flight (D15) |
| new record | "+ Novo aluno", "+ Novo instrutor" create it as today and select it, focus on the name (F2 2.6) |

### 2.7 What the operator does, before and after

Interactions; T = a typed time. INVA rows from desenho-disponibilidade 2.7, with this note's row switch (R1) and without it.

| Routine | Today | After, with R1 | Without R1 |
|---|---|---|---|
| an INVA does not come | 1 (grid) | 1 (row) | 2 |
| a turno | 2 | 2 (select the INVA, the button) | 2 |
| a whole period on or off (a lunch break, an early leave) | 1 per period | 1 selection + 1 per period | same |
| one end at a free minute ("from 13:30") | not possible | 4 (select, "Editar faixas", 1 T, "Salvar faixas") | same |
| a typical day: 3 do not come, 2 turnos, 1 lunch break on a period | 8 | 9 | 12 |
| a heavy day: 5 do not come, 4 turnos, 3 INVAs with two periods changed | 19 | 22 | 27 |
| check everybody | one grid, a line of about 34 px each | three-line rows of 72 to 80 px: about half as many per screen; the strip keeps the time columns | same |
| "who can take a 13:40" | read one column (availability only) | "+ Agendar voo" or the INVA's icon action, the time: the list "Servem neste horário" (habilitações, limits and occupancy included) | same |
| an aircraft in maintenance | 1 (table) | 1 (row) | 2 |
| type one aircraft's hours | click, type | select the row, type: +1 | same |
| type the hours of N aircraft in a row | N × (Tab, type) | N × (select, Tab to the field, type): +1 per aircraft | same |
| "Revisão feita" | 2 | select + 2 | same |
| check every aircraft's hours | one column | the meta of each row; the dot marks stopped or under 5 h | same |
| reorder the hangar | 1 | select the pinned item, then 1 | same |
| an INVA's habilitações | "Cadastro", "Editar habilitações", switch, close: 4 | select, switch: 2 | same |
| change a weight | click the cell, type | select, type: +1 | same |
| find a student by CANAC | not possible | type the digits | same |
| put a student in the middle of a course | 13 results one by one, from flights only | select, choose the mission, "Colocar no curso até…", confirm | same |
| stop offering someone who left | delete (no way back) or "Vem"/"Disponível" off on each date | 1 click, once | same |

### 2.8 F3: who decides whether an INVA may operate a resource

- The eleven places of mapa-recursos 5.3 keep their call sites: they ask `instrutorVoaNoAviao`, `exigenciasDoAviao` or
  `exigencias(…, { recurso })`, which now read the list (js/engine.js:201-203, 268-271, 428-432, 826, 852-853, 867;
  js/compactar.js:148-153, 195-201; js/candidatos.js:74-78, 105-119; js/instrutor-escolhido.js:59-65;
  js/viabilidade.js:56-57; js/habilitacoes.js:95; js/frota.js:52-54).
- Four places build a motive or a text from the resource's own id and change in F3: js/viabilidade.js:57 and
  js/candidatos.js:77 (the motive is the first id he lacks), js/conflitos.js:41 (an `aviao:` id keeps "o instrutor não tem
  a habilitação própria do <reg>"; another id reads "o instrutor não tem a habilitação que o recurso exige (<nome>)"),
  js/agendamento.js:500. (ran) without the edit of js/conflitos.js:41, the motive `ifr` reads "o instrutor não tem a
  habilitação própria do ".
- The engine's two texts keep "habilitação própria" (js/engine.js:244, 961); from F3 on the term means "what the resource
  itself requires", and the glossary entry `habilitacao-propria` says so. Wording for the engine-text commit, only if Pedro
  approves it (D7): :961 "os C172 livres exigem do instrutor uma habilitação que nenhum instrutor livre tem (marque no
  INVA, em Habilitações)" (with a chosen INVA: "… que Instrutor 02 não tem …"); :244 "sem a habilitação que os aviões
  livres exigem".
- The type's habilitação stays derived from `tipo` (`DO_AVIAO`, `DO_SIMULADOR`, js/habilitacoes.js:62, 82) and is never
  stored in `exige`: a cheque flight skips it and still requires the list (js/habilitacoes.js:92, 95).

## 3. Where each existing control goes

| Control today | Destination | Fate (step) |
|---|---|---|
| tabs `#nav button[data-t="alu"]`, `[data-t="ins"]`, `[data-t="rec"]`; the badge `#selo-rec` | the rows "Alunos", "INVAs", "Recursos" of the Cadastros card; the badge's count in the rail | replaced (F1, H) |
| **`#s-alu`** | | |
| "Buscar aluno…" `[data-flt="alu"]` | the list's toolbar; also the CANAC (F2) and the nome completo (A) | moved (F2) |
| "Todos os cursos" `#flt-alu-cur`, its panel, "?", "Limpar", Esc, the click outside; the marks shared with the Demanda | the toolbar, same ids; shared until G decides (mapa-alunos question 14) | kept (F2) |
| "N de M alunos" `#alu-contagem` | the toolbar | kept (F2) |
| "+ Novo aluno" `[data-act="adds"]` | the toolbar; the new student opens selected | moved (F2) |
| "Os pedidos de cada data ficam na Demanda." "Abrir a Demanda" `[data-go="dem"]` | the list pane, under the toolbar, until G; G points it at Processamento or removes it (test/e2e/app.spec.js:75-76) | kept (F2), changed (G) |
| "Nome" `[data-f="nm"]`, "Peso (kg)" `[data-f="kg"]` | detail › Cadastro ("Nome (na escala)") | moved (F2) |
| "CANAC" cell `.c-canac.so-dados` | the row's second line; detail › Dados pessoais | moved (F2) |
| "Curso" `[data-f="curso"]`, the progress line | detail › Curso e missões; the row's third line | moved (F2, A) |
| "Priorizar com", "Não escalar com": chips, ✕ (`unvc`, `unbl`), selects, the two "?" | detail › Cadastro; active INVAs only | moved (F2; the gate F3) |
| "Dados pessoais" `[data-dados="aluno:<id>"]` | detail › Dados pessoais | replaced (F2) |
| "✕" `[data-act="dels"]` | "Excluir aluno…" at the foot of the detail | moved (F2) |
| "Nenhum aluno cadastrado…"; "Nenhum aluno com esses filtros." "Limpar filtros" | the list's empty states | replaced (F2) |
| the phone card of a row | the row on one view, the detail as the second | replaced (F2) |
| (new) "Ativo" `input.sw[data-f="inativo"]`; "Mostrar inativos" `#alu-inativos` | the row; the toolbar | new (F2) |
| (new) "Nesta data", "Curso e missões", "Registrar resultado sem voo", "Colocar no curso até…", "Nome completo", "Apagar os dados pessoais" | the detail | new (A) |
| **`#painel-dados`** | | |
| title, "✕" `#btn-fechar-dados`, Esc | none: a section does not close | removed (F2 students, C INVAs) |
| "CPF", "CANAC", "Nascimento", "Celular", "E-mail" (`#dado-…`) and their errors | the section's fields `det-<lista>-<campo>`, "Nome completo" first | moved (F2, C; A the new field) |
| "Cancelar" `#btn-cancelar-dados` | Esc in a field puts the stored value back (F2 D23) | replaced (F2) |
| "Salvar" | one save per sitting (R5) | removed (F2) |
| `#dados-erro`, "Atualizado em …", the note | the section's notice and foot line; the note from js/views/dados-pessoais.js ("a secretaria consulta", A) | moved (F2, A) |
| the host `aside#painel-dados` | — | deleted (C) |
| **`#s-ins`** | | |
| "Disponibilidade do dia" / "Cadastro" `[data-vista-ins]` | — | removed (C) |
| "Buscar instrutor…" `[data-flt="inst"]`, "Todas as habilitações" `#flt-ins-hab` (groups from the registry), `#ins-contagem`, "+ Novo instrutor" `[data-act="addi"]` | the list's toolbar | moved (C) |
| "Limpar filtros" (two buttons) | one, in the empty state | replaced (C) |
| "Vem" `[data-f="on"]` and its "?" | the row's `rapida`; detail › Nesta data | moved (C) |
| the nine windows `[data-f="aw"][data-w]`, "Aplicar turno…" `[data-f="pre"]`, the legend | detail › Nesta data: period chips, turno buttons, "Editar faixas" (desenho-disponibilidade 2.6) | replaced (C) |
| "Instrutor", "Voos", "Mês", "Habilitações" (summary), the "CANAC" cell | the row; the detail | moved (C) |
| "Nome", "Peso (kg)" | detail › Cadastro | moved (C) |
| "Editar habilitações" `[data-act="editar-habs"]`, "Dados pessoais" `[data-dados="instrutor:<id>"]` | the detail's sections | removed (C) |
| "✕" `[data-act="deli"]` | "Excluir instrutor…" at the foot | moved (C) |
| (new) "Ativo" `input.sw[data-f="inativo"]`, "Mostrar inativos" `#ins-inativos`, icon "Agendar voo com <nome>" | row, toolbar, title | new (C) |
| **`#painel-instrutor`** | | |
| "✕" `#btn-fechar-painel-instrutor`, Esc | — | removed (C) |
| switches `[data-f="hab"][data-h]` | detail › Habilitações | moved (C) |
| the hours line, `[data-f="ext-mes"]`, `[data-f="ext-ano"]` | detail › Horas de voo e limites da lei | moved (C) |
| **`#limites-lei`**: six `[data-limite]`, "Voltar aos valores da lei" | the pinned item of the INVAs list | moved (C) |
| **`#s-rec`** | | |
| "Disponibilidade do dia" / "Cadastro" `[data-vista-rec]`, `#selo-rec-dia` | the count goes to the rows' dots and to the rail | removed (B) |
| "Buscar matrícula…" `#flt-rec-mat`, `#rec-contagem` | the list's toolbar (the matrícula key) | moved (B) |
| "Todas as categorias" `#flt-rec-cat` and its panel | the category groups | replaced (B) |
| "+ Novo recurso" `#btn-novo-recurso`; `#form-recurso` | the toolbar; the form in the detail pane | moved (B) |
| "Limpar filtros" (two buttons) | one, in the empty state | replaced (B) |
| "Janelas de operação" `#wins [data-a="win"]` | Escala stage, `details#periodos` (desenho-disponibilidade D22) | moved (B) |
| group rows `[data-recolher-grupo]` | the list's group headers, also selectable | replaced (B) |
| "Disponível" `[data-a="av"]` | the row's `rapida`; detail › Nesta data | moved (B) |
| the "Recurso" cell (matrícula, type, tags) | the row's first and second lines | moved (B) |
| "Horas disponíveis" `[data-a="horas"]` and its "?", "Na escala do dia", "Revisão feita" `[data-act="revisao"]` | detail › Nesta data; the values on the row | moved (B) |
| "Ordem no hangar" `#hangar` and `hangar-subir`, `hangar-descer`, `hangar-frente` | the pinned item's detail | moved (B) |
| "Frota" `#frota`; the matrícula button `[data-act="atributos-recurso"]` | the list; the detail | replaced (B) |
| "Só Parafuso", "Só VFR" `[data-a="atributo"]` | detail › Cadastro | moved (B) |
| "Habilitação própria" `[data-atributo="habilitacaoPropria"]` | the first switch of "Habilitações que o INVA precisa" (it writes `exige` from F3) | moved (B) |
| "Retirar" `[data-act="retirar-recurso"]` | "Retirar da frota…" at the foot | moved (B) |
| "Horários de decolagem" `#horarios`, "Editar" and the editor | the category's detail | moved (B) |
| (new) "Ativo" `input.sw[data-a="inativo"]`, "Mostrar inativos" `#rec-inativos`, icon "Agendar voo no <reg>" | row, toolbar, title | new (B) |
| **Escala and Pedidos (this topic's part)** | | |
| (new) the warning "N voos com … inativo na escala desta data" and "Refazer a escala" `[data-act="refazer-escala"]` | the Escala's warnings; then the rail and Aprovar | new (F3), moved (H) |
| "Ainda não importado" on an inactive student's pedido | "Aluno inativo" | changed (F3) |

The Rodízio screen, the booking dialog and the Escala's result control: not applicable (other topics; D5 and D15 only
change what they list or reuse).

## 4. Data-format steps and migrations

| What | Content | Conversion | Tests | Order |
|---|---|---|---|---|
| Format **26** (F3), js/migracoes.js; commit "registro" | cadastro: each `frota[]` item with `habilitacaoPropria === true` and no `exige` list gets `exige: ['aviao:<reg>']`, the flag kept. Day: nothing. The number also protects `stu[].inativo`, `ins[].inativo`, `frota[].inativo`, whitelisted in the same commit | whitelists js/dias.js:41-45 and :47 (`inativo`), `recurso()` js/frota.js:62 (`exige`, `inativo`, the mirror); normalisers js/storage.js:101-111, 144-156 (only `true` stays); `normalizarFrota` converts on read what never went through the step (History payloads, `FROTA_INICIAL`, test states) | migracoes.test.js: the step on a cadastro at 25; an unknown field survives; hostile items; the round trip (the stored cadastro equals what `salvarDia` writes back); the pin of the number (moved there by F0a) becomes 26. atributos, frota, dias (:28-32), storage, storage-dias.test.js:428 | client only; F3 merges at the head of Onda 1; Pedro's first opening rewrites every stored day once; a tab on 25 is refused with the hint `formato` |
| **M1** (A) `supabase/migrations/20261123100000_nome_completo_nos_dados_pessoais.sql` | `alter table public.dados_pessoais add column nome_completo text check (char_length(nome_completo) between 1 and 120)`; `create or replace` of `salvar_dados_pessoais(text, integer, jsonb, timestamptz, date)`, whole body: `p_dados ? 'nome_completo'` false keeps `v_atual.nome_completo`; true: trimmed, one space between words, empty to null, over 120 → 22023 with hint `nome_completo`; "Nome completo" first in the History's list; the row is deleted only when all six are null; grants restated; the header says the live app never sends the key | none | dados-pessoais.test.sql `plan(47)` → 54: `has_column`; "o nome completo: o texto grava, com um espaço só entre as palavras"; "o nome completo: sem a chave, fica o gravado"; "o nome completo: a chave vazia apaga"; "o nome completo: mais de 120 caracteres é recusado"; "o histórico registra Nome completo"; "com só o nome completo, a linha fica" | preview, `npm run test:db`, production, then A's merge |
| **M2** (A2) `supabase/migrations/20261123100100_secretaria_so_le_dados_pessoais.sql` | `create function public.grava_dados_pessoais() returns boolean language sql stable security definer set search_path = '' as $$ select coalesce(public.perfil_atual()::text = 'operador', false) $$` (the Administrador counts as operador, 20261111122858:5-15), revoke from public and anon, grant to authenticated; `create or replace` of the 5-argument function, whole body with M1's lines, with `if not public.grava_dados_pessoais() then raise exception 'somente operadores e administradores alteram dados pessoais' using errcode = '42501'`; `drop function public.salvar_dados_pessoais(text, integer, jsonb)`; `le_dados_pessoais()` and the policy "operadores e secretaria leem" untouched; the comments of the table and the function | none | `:43` becomes `hasnt_function`; `has_function` of `grava_dados_pessoais`; `:109` becomes "secretaria não grava os dados de um aluno" (`throws_ok` 42501); new "secretaria não grava os dados de um instrutor"; `:110-111` becomes "nada da secretaria no histórico" (`is_empty`); the Administrador writes aluno 1004, so `:112` still counts 4 rows and `:116-120` still removes one; the header; `plan(54)` → 56 | after A is published: preview, `npm run test:db`, production, then A2's merge |

- The timestamps are desenho-entrega's (its section 4), in the order the files reach the shared preview.
- Mirrors of M1 (A): js/dados-pessoais.js (`CAMPOS_PESSOAIS`, `REGRAS.nome_completo`, the three cases in
  `gravarDadosPessoais` and `camposAlterados`, `comCampoMudado`); js/backends/supabase.js:241-255 (the list read narrowed,
  the person read and its select gain `nome_completo`); js/backends/local.js:203-211 (the list projects the same columns).
  The unit tests carry the pgTAP names verbatim; one e2e in shared mode clears the name. Nothing ties the JS to the SQL
  automatically (mapa-banco 5.6), so the names are the link.
- Mirrors of M2 (A2): test/e2e/falso/dados-pessoais.js (the write asks `operador`; the read keeps `veDados`, router `:330`);
  test/unit/supabase-falso.test.js.
- B and C need no migration and no format number for this topic.

## 5. Files created, changed and deleted, by step

| Step | Created | Changed | Deleted |
|---|---|---|---|
| F0a, F0b, F0c | (desenho-entrega 2.2) | | |
| **F3 "registro"** | — | js/habilitacoes.js, js/frota.js, js/config.js, js/viabilidade.js:56-57, js/candidatos.js:77, js/conflitos.js:41, js/agendamento.js:500, js/migracoes.js, js/dias.js:41-47, js/storage.js:101-111, 144-156, js/eventos/recursos.js:75-90 (the checkbox writes `exige` through `comAtributo`), js/views/recursos.js:95-97 (tags from `exige`), js/views/instrutores.js (groups imported), js/glossario.js `habilitacao-propria` (the definition; the place to mark stays until C), README ('Formato dos dados' 26; rows of js/habilitacoes.js and js/frota.js) | `GRUPOS_DE_HABILITACAO` and `gruposDosRecursos` from the view |
| **F3 "inativos"** | js/inativos.js, test/unit/inativos.test.js, test/e2e/inativos.spec.js | js/reversoes.js (the three kinds), js/actions.js:367, js/views/agendamento.js, js/agendamento.js:343-365, js/views/demanda.js:36, 104-117 and the row tag, js/views/escala.js:150, 156-164, 354, 580-583 and the warning, js/eventos/escala.js (`refazer-escala`), js/views/reparo.js:23, js/reparo.js:110-114, js/candidatos.js:89, 111, js/instrutor-escolhido.js:21-22, 59, js/processamento.js (the import), js/eventos/importacao.js, js/views/selos.js:26-28, 47-49, js/views/agenda.js:140, 149, 198-199, js/views/alunos.js (I4 to I6), js/views/cursos.js:270, js/views/rodizio.js:9, js/eventos/rodizio.js:11, js/storage.js:93, 162, 187-190, js/eventos/recursos.js:165, js/views/recursos.js:158, js/export.js:125, js/views/bi.js:127, 139-142 and the instructors' rows, js/eventos/bi.js:35-36, 51, 56-58, README (row of js/inativos.js) | — |
| F1 | — | (the Cadastros card rows are F1's) | — |
| **F2** (this topic's part; F2 also meets R1 to R5 in its own files) | — | js/eventos/alunos.js (branch `inativo`, `aoReverter('setAlunoInativo')`), js/views/alunos.js (the row's `chave` and `inativo`; today's fields in the detail), js/inativos.js (`usoNaData`, `avisoDoInativo`), js/glossario.js (term `inativo`), index.html (`#alu-inativos`; Manual "Alunos" 531-535), test/e2e/alunos.spec.js, test/e2e/telas/alunos.js | the Alunos table, `linhaDoAluno`, `atualizarLinhaDoAluno`, the phone cards of `table.cadastro.alunos` (desenho-lista §5) |
| **A** | M1, js/eventos/resultados.js | js/views/alunos.js (sections "Nesta data" and "Curso e missões", the search keys, the foot), js/eventos/alunos.js (no-flight result, placement, "Apagar", `aoReverter('desfazerColocacao')`), js/eventos/escala.js:236-261 (calls `registrarResultadoNaTela`), js/resultados.js, js/progresso.js, js/reversoes.js (`desfazerColocacao`), js/dados-pessoais.js, js/views/dados-pessoais.js (`podeEditarDadosPessoais`, `apagarDadosPessoais`, the note), js/views/painel-de-dados.js (the drawer, still the INVAs', enabled by `podeEditarDadosPessoais`), js/perfis.js, js/storage.js:303-305, js/backends/supabase.js:241-255, js/backends/local.js:203-211, css/alunos.css, js/glossario.js (Alunos terms), index.html (Manual 462-466 and 531-535), README.md:13-15 and 'Estrutura', supabase/tests/database/dados-pessoais.test.sql, test/unit/{perfis,dados-pessoais,resultados,progresso,reversoes}.test.js, test/e2e/alunos.spec.js, test/e2e/dados-pessoais.spec.js | "a secretaria … edita" in every text |
| **A2** | M2 | dados-pessoais.test.sql, test/e2e/falso/dados-pessoais.js, test/unit/supabase-falso.test.js | the 3-argument `salvar_dados_pessoais` |
| **B** | — | index.html (`#s-rec`; the hint :184; Manual 446, 507-519, 642), css/recursos.css, js/views/recursos.js, js/eventos/recursos.js (the list, the switch `data-a="inativo"`, `aoReverter('setRecursoInativo')`, `setExigencias`), js/views/horarios.js (one category; the mark), js/habilitacoes.js, js/frota.js, js/reversoes.js (`setExigencias`), js/views/selos.js, js/views/vistas.js (`rec` out), js/glossario.js 73-85 (`hangar`: "com os aviões ativos"; `horarios-de-decolagem`, `so-vfr`, `so-parafuso`, `habilitacao-propria`: the new places), README rows, test/e2e/telas/recursos.js, test/e2e/recursos.spec.js | `[data-vista-rec]`, `#selo-rec-dia`, `#wins` (with desenho-disponibilidade's B commit), `rFrota`, `alternarAtributos`, js/views/filtros-dos-recursos.js, the term `filtro-das-categorias` |
| **C** | — | index.html (`#s-ins`; Manual 447, 521-529), css/instrutores.css, js/views/instrutores.js, js/eventos/instrutores.js (the switch, `aoReverter('setInstrutorInativo')`), js/somente-leitura.js:8, js/eventos/navegacao.js:13, 52-53, js/glossario.js 88-93 (and `habilitacao-propria`: "marque no INVA, em Habilitações"; the group 'INVAs'), README rows, test/e2e/telas/instrutores.js, test/e2e/instrutores.spec.js, limites.spec.js, publicado.spec.js:83-93 | `#painel-instrutor` and its three functions, the day grid, the Cadastro table, `[data-vista-ins]`, the legend, `aside#painel-dados`, js/views/painel-de-dados.js, js/eventos/painel-de-dados.js, css/cadastro.css, js/views/vistas.js, the Instrutores half of js/views/filtros-das-pessoas.js |
| D | — | the "Aluno" list of the form keeps F3's gate | — |
| E | — | the reasons name an inactive INVA or resource that would have served | — |
| G | — | the reconciliation skips the inactive student's pedido with the reason; Processamento shows his flights; "Abrir a Demanda" and the shared Curso marks (app.spec.js:75-76) | — |
| H | — | the rail's and Aprovar's pending item from `voosComInativos` | — |
| I | — | Manual, glossary and README read-through | `.so-dados` if nothing uses it |

Files A, B and C all reach follow desenho-entrega 2.3: index.html by region (`#s-alu` F2 then A; `#s-rec` B; `#s-ins`,
`#painel-instrutor`, `#painel-dados` C), js/glossario.js by term, js/reversoes.js by region, README by row, the Manual
by block; test/e2e/fixtures.js is frozen and each screen has its driver; test/e2e/cadastros.spec.js is split by F0a.

## 6. Tests

Written first:

| Step | Test | What it pins |
|---|---|---|
| F3 | test/unit/engine.golden.test.js | unchanged, 42 of 42, after each of the two commits |
| F3 | test/unit/inativos.test.js (about 16) | the derived state on dates before, on and after today; the source unchanged; the same object with nobody inactive; `ativosNaData`; `voosComInativos` (each kind; nothing on a past date) |
| F3 | habilitacoes (+4), frota (2 changed, +3), atributos (1 changed, +4), migracoes (+3), dias (+2), storage (+3), reversoes (+5, hostile values), candidatos (+2), instrutor-escolhido (+2), rodizio (+1), hangar (+1), planilha (+1), processamento (+2), agendamento (+2), reparo (+1) | the groups in the registry; a registry id as a requirement; the mirror; step 26 and its round trip; the whitelists; the three kinds; the gates of the list builders; the student's pedido skipped and counted apart; the student options; no cancel reason for an inactive aircraft |
| F3 | test/e2e/inativos.spec.js (about 10, on a local cadastro seeded with the flag) | no new flight; a pin in conflict with the name; a request that chose him rejected; the pickers I4 to I11 and R7; Rodízio and hangar (R4); BI; Excel; the map; the pending item and "Refazer a escala"; a past date unchanged after an edit; the Agenda badge and "Aluno inativo" |
| F2 | inativos (+2: `usoNaData`, `avisoDoInativo`); e2e alunos.spec.js (+4) | the switch: one click, the row stays, the announcement, the History revert, "Mostrar inativos" |
| A | perfis (+2: `editaDadosPessoais`, local and shared), dados-pessoais (+5, the pgTAP names), resultados (+2), progresso (+3: NAV-01 13, NOT 42 by its night, approved ones skipped), reversoes (+2: `desfazerColocacao`) | the rules of D13 to D18 |
| A | e2e alunos.spec.js (+8), dados-pessoais.spec.js (+1) | missões; a result in "Nesta data"; a no-flight result (the date bound, the refusal); "Colocar no curso até" and its revert; search by CANAC and nome completo, not for the Gestor; the Secretaria reads text; "Apagar os dados pessoais"; the name cleared in shared mode |
| A2 | pgTAP (section 4); supabase-falso.test.js (+1) | her write refused for both types |
| B | e2e recursos.spec.js | the groups and R3; the category's times; the hangar item; the requirement editor; the form in the pane; the two switches; the icon action |
| C | e2e instrutores.spec.js | habilitações in place; the orphans; the row as the overview; the limits item; the two switches; the icon action |

Existing tests that change (rough counts; after F0a most selectors live in the drivers):

| File | Tests | Step |
|---|---|---|
| test/e2e/alunos.spec.js (11 from cadastros.spec.js) | rewritten for list and detail | F2, then A |
| test/e2e/recursos.spec.js (22), instrutores.spec.js (11) | rewritten | B; C |
| test/e2e/dados-pessoais.spec.js (12) | the student half to the section (F2); `:114` "a Secretaria vê … e só consulta os dados pessoais" and `:276` removed (A); `:141` (her phone button) F2 and C; `:171` removed (C); the INVA tests (C) | F2, A, C |
| hangar.spec.js (2), revisao.spec.js (3), atributos.spec.js (3), selos.spec.js (1 of 5) | through the driver | B |
| limites.spec.js (4) | the pinned item | C |
| celular.spec.js (13) | `:64` (cards: F2 the Alunos half, C the other), `:174` (F2; G the Demanda's), `:196` (G), `:217` (C); the walks `:30`, `:49` through the drivers' `ESTADOS` | F2, B, C, G |
| acessibilidade.spec.js (52) | the 11 Esc-layer tests over the two drawers: F2 points the students' at an INVA, C rewrites or deletes them | F2, C |
| perfis.spec.js (6) | `:5`, `:46` (F2); `:19`, `:31` (C) | F2, C |
| publicado.spec.js (by hand only, in each migration's go-live check) | `:23` waits for `appPronto` (F0a); `:83-93` count the INVAs' rows | F0a, C |
| app.spec.js | `:75-76` (G); the Manual phrases of each screen | F2, A, B, C, G |
| cursos, abertura, instrutor-escolhido, demanda, seguranca, historico:64 and the other specs that reach the screens | through the drivers of F0a | — |
| test/unit/frota.test.js:23, atributos.test.js:55-62, migracoes.test.js (the pin of the number) | exact shapes and 26 | F3 |

## 7. Departures from Pedro's request

| The request says | This design does | Why | Pedro can choose instead |
|---|---|---|---|
| deactivating "applies to all dates" | from today on; a past date is computed as before, and an inactive student's existing requests keep flying | a deactivation must not rewrite flown or approved history, nor move past hours (D1, D3) | every date, or from a typed date (8.1, 8.7) |
| "Each row carries its active switch" | it does; the INVAs and Recursos rows also carry the per-date switch | the daily routine stays at one click (D11) | the per-date switch only in the detail (8.5) |
| "Reuse … `mostrarVista`" | deleted with the switch it served | its only users were the two switches (D10) | keep the switch inside the detail |
| "A large title, with icon actions at its right" | only where an action exists (booking from an INVA or a resource); delete is at the foot | an icon is one stop from the title, and delete destroys (D9, D30) | delete as an icon action (desenho-lista D20) |
| "inactive rows are dimmed" | the title in the muted colour and the tag "inativo" | contrast of 4.5:1 on a row that still acts (desenho-lista D21) | opacity |
| "nome completo" among the fields | a new column, for INVAs too | it does not exist; it is personal data (D13) | today's "Nome" is the full name (8.11) |
| "missão anterior", "missão atual" | the latest result; the first released mission and the others | neither exists as one value (D14) | the mission before the current one in the program |
| editing them "through registering a result" | plus "Colocar no curso até…", many approvals without a flight in one act, with a revert | a student who arrives mid-course needs 13 to 43 records (D15) | not offered (8.16) |
| "the Secretaria must not edit" (Alunos) | she stops editing INVAs' personal data too, and keeps reading | one function and one table serve both (D18) | she stops reading too (8.10) |
| INVAs: "preferences" | read-only, the students who point at him | no INVA-side preference exists (D25) | a real preference (which one?) |
| Recursos: hours and maintenance status in the detail | under "Nesta data": both are per-date values | `dia.horas`, `dia.av` (mapa-recursos C5) | — |
| "Search by name" (INVAs) | also by CANAC and nome completo for who may read them | one search for both screens (D16) | name only |
| the multi-value filter reused | not on Recursos: the category groups replace "Categoria" | two controls for one grouping (D21) | keep the filter too |

## 8. Questions for Pedro, each with the default this design implements

1. **Inactive for which dates?** Default: from today on; a past date stays as it was, even when edited later.
   Consequence: on today and every later date, at its next recalculation, his unpinned flights go to others and his pinned
   ones are in conflict; a date not yet edited shows a warning with "Refazer a escala". Alternatives: every date (past dates
   not approved are rewritten at their next edit, and past hours move), or "inativo a partir de <data>" (a stored date:
   another format number).
2. **A pinned flight with an inactive INVA or aircraft, today or later.** Default: it stays, in conflict ("o instrutor não
   está disponível", "o avião está indisponível"), with Sugestões. Alternative: released, and the app chooses.
3. **A request whose chosen INVA becomes inactive.** Default: rejected with the reason (your rule: the chosen INVA is a hard
   constraint), counted in the announcement and in the pending item. Alternative: the app chooses another, and the pending
   item says so.
4. **The date's overview of the INVAs and of the resources** (one question with desenho-disponibilidade 5). Default: the
   list itself (a typical day 8 → 9 interactions, a heavy one 19 → 22; half as many INVAs per screen). Alternative: a board
   pinned at the top, spanning both panes (8 and 19; a second surface for the same switches).
5. **Two switches on the INVAs and Recursos rows ("Vem" or "Disponível", and "Ativo")?** Default: yes. Alternative: the
   per-date one only in the detail (+1 click per change: typical day 12, heavy 27).
6. **Deactivate with one click?** Default: yes; the row stays, muted, the app says what it touched, and the History reverts
   it. Alternative: a confirmation.
7. **An inactive student who already has a flight today or later.** Default: the flight stays and shows as pending; nothing
   new enters. Alternative: his flights leave each date at its next edit.
8. **The Rodízio place and the hangar position of someone who comes back.** Default: the end of each queue, the back of the
   hangar. Alternative: the place they had.
9. **The Excel column of an inactive aircraft.** Default: released to another aircraft. Alternative: kept.
10. **Does the Secretaria keep reading all personal data?** Default: yes, every field, of students and INVAs. Alternative:
    only the CANAC, or nothing.
11. **"Nome completo": a new field, or is today's "Nome" the full name?** Default: a new field. With the alternative, M1 and
    its pgTAP checks disappear and A needs only A2.
12. **"Nome completo" for INVAs too?** Default: yes (one table, one editor).
13. **Personal data: how are they saved?** Default (shared with desenho-lista 2): in place, no "Salvar", one save and one
    History entry when she leaves the section. Alternatives: a save per field (up to six History entries per person), or a
    "Salvar".
14. **Personal data of inactive people.** Default: kept until an Operador clears them ("Apagar os dados pessoais").
    Alternative: erased automatically after some months inactive (new SQL, outside this redesign).
15. **A result without a flight: which date?** Default: the open date when it is not after today, else today; she may type
    an earlier one, never a later one. Alternative: always the open date.
16. **"Colocar no curso até…"?** Default: offered; it approves without a flight every mission before the chosen one in the
    course's order, lists them before confirming, and the History reverts it. Alternative: not offered (one result at a time).
17. **Deleting.** Default: as today, two clicks, with the text saying what it erases. Alternative: refused for a student
    who has a result.
18. **May a resource require any habilitação of the registry (IFR for one aircraft, another aircraft's own id)?** Default:
    yes. Alternative: only its own id.
19. **Do the Gestor and the Secretaria see an INVA's grouped habilitações and hours?** Default: yes, read-only.
20. **The screen's name.** Default: "INVAs" in the navigation and the titles; "instrutor" in the texts.
21. **The engine texts "habilitação própria" and "(marque em Instrutores › Cadastro)".** Default: unchanged by this topic.
    If you approve desenho-entrega's text-only commit, it also gives both the wording of 2.8.

## 9. Risks, and what would make this design wrong

- **A reader of `S` that F3 misses** shows an inactive item as active (it still gets no flight from the engine on a date
  that is today or later). The tables of 2.4 are the checklist; test/e2e/inativos.spec.js covers one case per row.
- **The derived state reaching a writer.** `salvarDia` and the functions that change the state keep `S` (2.3); a unit test
  asserts the source is unchanged.
- **"Today" is the browser's date.** A machine with a wrong clock moves the cut of D1; `hojeISO()` already labels "hoje".
- **A stored date nobody opens** keeps an inactive INVA's flights; for today, the TV (`painel_do_dia`) shows them until
  someone opens the date and refaz the schedule (D6).
- **F2 without R1 to R5:** the per-date switch costs 2 clicks (2.7); a category whose resources are all filtered out
  loses its header (the categories become pinned items); Enter in the search may open a pinned item; A has to change F2's
  editor through a fix PR to the base branch for the nome completo and the note; a save per field writes up to six History
  entries per person.
- **The owner of the student's switch**: desenho-entrega puts it in F2, desenho-lista in A; this note's files assume F2.
- **Editing in place multiplies cadastro writes** to one document with one version (posicao A8; mapa-invas 7.13): F2 D14
  re-reads after a cadastro conflict; a day conflict still locks.
- **"Colocar no curso até"** locks mission codes (a code with a result can no longer be renamed in Cursos, docs/PLAN.md:431);
  a connection lost midway leaves some approvals, and running it again completes it; its revert can stop midway the same way.
- **The shared preview**: once M2 is there, older copies of dados-pessoais.test.sql in other branches fail on it.
- **The 1,000-row cap** of `listarDadosPessoais` (supabase/config.toml:19): with people kept, each type only grows. The fix
  (paging ordered by `id_cadastro`, and `offset` in the fake's router, F0a's file) is outside this redesign; its trigger is
  about 800 rows of one type.
- **`habilitacaoPropria` and `exige` out of step** if some code writes the flag directly: only `recurso()` writes it, and
  atributos.test.js pins the mirror.
- **Wrong if** the operator deactivates often and for short periods (then "Vem" and "Disponível" are the tools, and the
  announcement says "de hoje em diante"); if the school wants an inactive student's future flights to vanish by themselves
  (8.7); or if a deactivation must also rewrite past dates (8.1).

<!-- revisado -->
<!-- fim -->
