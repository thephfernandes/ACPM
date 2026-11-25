# Lacuna: the items docs/PLAN.md still records as open, read against the redesign

Read at the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, 48875e3). Paths are relative to the worktree root.
"The request" is `notas/pedido.md`, cited as pedido.md:N. "(ran)" = confirmed by running `node` on the pure modules,
with fictitious names and weights, nothing written in the worktree (section 8 lists the runs). "(inferred)" = no line
proves it. Playwright was not run.

Verdict words used below:
- **moot**: the redesign removes the thing the item is about;
- **carried**: nothing in the request touches it; it stays open exactly as recorded;
- **carried, touched**: stays open as recorded, but one new screen or workstream meets it (named in the row);
- **moves**: stays open, but it is written against a control, a text or a stored field that the request reworks, so the
  plan must say where it lives afterwards (otherwise it is lost or silently decided);
- **contradicted**: the target model, as the request states it, cannot hold the recorded default; the plan must
  reverse one of the two in so many words.

## Answer

### 0. Short answer

- **No item of the 17 is made moot outright.** Three parts become moot only if the plan removes the Demanda's "Usar",
  "Outra missão…" and "Limpar demanda": the wording half of item 10, the "Usar releases it even when…" clause of item 8,
  and the "Cancelado" option of docs/PLAN.md:437.
- **Two recorded defaults are contradicted by the target model as written**: item 7 "a booking creates no Agenda
  request" (against "Input: the approved pedidos of the date … no data of its own", pedido.md:34) and item 11's move,
  which rewrites the request (against a Processamento that keeps nothing per request; ran).
- **One decision of 2026-11-19 is reversed or emptied and is not in the request's "Decisions this reverses"**: "Limpar
  demanda" also releases the flights it blanks (docs/PLAN.md:437; pedido.md:111-115 lists three other decisions of
  that day).
- **Six of the 17 are written against the Demanda's own controls, texts or request fields and must be restated**: 7
  (four of its seven defaults), 8, 10, 11, 16, 17; so must docs/PLAN.md:435.
- **Eight carry with one touch point** (1, 2, 3, 4, 6, 13, 14, 15) and **three are untouched** (5, 9, 12).
- **Phase 16**: none of the four is moot; the PWA item gets harder and the "make room after approval" item gets more
  needed.
- **"## 5. Open questions"**: of the three questions not struck, the first is half answered by the request itself; the
  second and the fourth were answered by Phases 2 and 4 and were never struck.
- **Three of the 17 (10, 13, 17) cite sections of "the design" (§4.9, §6.4, §2.1) that is not in the repo**: the only
  Markdown files tracked are `README.md` and `docs/PLAN.md` (`git ls-files`).

### 1. The clauses of the request the items are read against

| Tag | Clause | Where |
|---|---|---|
| R1 | "The allocation rules themselves do not change unless a section below says so"; the engine stays pure, the goldens change only in rule-change commits | pedido.md:16, 144 |
| R2 | Pedidos get an approval state; keep the 13:00 deadline, the Exceção da Coordenação, no Sundays, the local-flight limit | pedido.md:29 |
| R3 | The Demanda, edited by hand today (Voa, Missão, Recurso, Instrutor, 1ª and 2ª preferência, Disponibilidade, Duração, Prioridade), "becomes an aggregation and enrichment stage with no data of its own. Input: the approved pedidos of the date"; one pure module "in the spirit of `importarSolicitacoes`"; every column must get a new home | pedido.md:33-41 |
| R4 | Escala inputs in priority order: operator restrictions "which override any rule" (fixed flights, the chosen instructor, "+ Agendar voo"), then Processamento's output, then the criteria | pedido.md:43-50 |
| R5 | Aprovar becomes the last stage: unresolved conflicts, approve or reopen, then the exports | pedido.md:52-53 |
| R6 | Cadastros become master–detail; "No modal or pop-up for viewing or editing a record"; Alunos: "Missão anterior and atual come from the course results … (I expect through registering a result, not free text)"; the Secretaria must not edit | pedido.md:55-59 |
| R7 | F3: habilitações as one registry referenced by INVAs and by resource requirements; INVA availability becomes ranges; deactivation switches | pedido.md:61-69, 126 |
| R8 | The right rail is the only date control and lists "the notifications of that date"; inactive rows are dimmed; each row carries a switch | pedido.md:88-90 |
| R9 | Pipeline sub-tasks, among them "missão definida pelo programa", "pedidos que não cabem", "conflitos pendentes" | pedido.md:102-107 |
| R10 | "Say where Cursos, Rodízio, BI, Painel, Histórico and Manual go; their behaviour does not change" | pedido.md:109 |

### 2. "Left for Pedro" (docs/PLAN.md:414-431): the 17 items

| # | Line | Item, in short | Verdict | Meets |
|---|---|---|---|---|
| 1 | :415 | one result for the whole Noturno, on its night | carried, touched | R6 (results registered from the Alunos detail) |
| 2 | :416 | Noturno rules of a new course (`porCurso`) | carried, touched | R7 (F3 edits the function that holds it) |
| 3 | :417 | the syllabus mapping (TMA → Voo Local, …) | carried, touched | R3, R9 ("missão definida pelo programa") |
| 4 | :418 | AV PROF. SOLO right before each SOLO | carried, touched | R3 (it becomes a rule of the pure module) |
| 5 | :419 | the solo crew weight | carried | nothing (R1) |
| 6 | :420 | no check flight for new courses; waivers per course only | carried, touched | R7, R6 |
| 7 | :421 | seven smaller defaults | one contradicted, three move, three carried | 2.7 |
| 8 | :422 | a booked flight whose mission changes in the Demanda | moves | R3 |
| 9 | :423 | two Noturnos back to back are refused | carried | nothing (R10) |
| 10 | :424 | a closed course in the Demanda and in the import | first half moot if the two controls go; second half moves | R3 |
| 11 | :425 | Mover and Encaixar | moves; the move itself is contradicted under pure derivation | R3, R4, R5 |
| 12 | :426 | Cursos: a retired item's "Depois de…" list | carried | nothing (R10) |
| 13 | :427 | default aircraft; idle instructors hidden by the category filter | carried, touched | R7 (`on`), pane width |
| 14 | :428 | the rest before the Noturno's return is a note | carried, touched | R8 |
| 15 | :429 | dates in the booking dialog | carried, touched | R8 |
| 16 | :430 | undo and revert lean towards not bringing a booking back | moves | R3 |
| 17 | :431 | mission codes and the requests (the code lock) | moves | R3 |

#### 2.1 Item 1 (:415): one result for the whole Noturno

- Still as recorded. The transfers are decided by the night (`quemDecide`, js/progresso.js:26; used at :38-39); the
  lists offer a Noturno once, by its night (js/agendamento.js:412-413; js/views/etapas.js:67-70); the D+1 return row is
  pushed without `etapa` (js/engine.js:387-392), and the result select exists only on a row with `o.etapa`
  (js/views/etapas.js:176-177). Test: test/unit/agendamento.test.js:427. (ran) A 'Noturno' pedido for a student with the
  night phase open is imported with `etapa: 'NOT'`.
- The request does not touch the Escala's result select. It adds one place where a result may be registered away from
  a flight row, the Alunos detail (R6). There the default needs a guard that today's only entry point gives for free:
  `validarRegistro` checks formats only (js/resultados.js:34-41) and the server only that the course exists
  (docs/PLAN.md:379). A result typed for TSL-01 or TSL-02 would be stored, would not count (the night decides) and
  would lock or reserve that code (item 17). "Missão anterior" after a Noturno is NOT, never TSL-02.

#### 2.2 Item 2 (:416): the Noturno rules of a new course

- Still as recorded: `porCurso: { PC: { regras: 'IFR', habilitacoes: ['ifr'] } }` (js/config.js:66), read by
  `regrasDoVoo` (js/frota.js:31-36) and `exigencias` (js/habilitacoes.js:93-95), keyed by the sigla. Test:
  test/unit/agendamento.test.js:261.
- F3 rewrites how requirements are expressed ("one type, referenced from both sides … Propose whether the
  `habilitacaoPropria` flag becomes a list of required ids", pedido.md:61), and Processamento joins "`exigencias` in
  `js/habilitacoes.js`" (pedido.md:37). So F3 edits the function that holds this item. The request neither answers nor
  forbids it. If the resource's requirement becomes a list of ids, the course's requirement stays a third source
  (mission, course, resource) inside `exigencias`.

#### 2.3 Item 3 (:417): the syllabus mapping

- Still as recorded: TMA-01…05 are 'Voo Local', C152, 1 h (js/modelos-de-curso.js:36-37); ENDOSSO SOLO LOCAL is 'Voo
  Local' (:46); NAV SOLO is 'Voo Solo' (:51); AVX ENDOSSO CQ is 'Navegação', C152, 2 h (:55). The app's TGL needs the
  `tgl` habilitação (js/habilitacoes.js:15, 54).
- The import binds a course mission only when a released mission has the type the pedido asks
  (`candidatas.find(m => m.mis === solicitacao.missao)`, js/agenda.js:121-122). (ran) With TMA-01 next: a 'Voo Local'
  pedido gets `etapa: 'TMA-01'`; a 'TGL (TMA)' pedido gets no course mission. With AVX-CQ next, a 'Cheque PP' pedido
  gets none.
- In a line where "missão definida pelo programa" is a row with a status icon (R9), the mapping decides which pedidos
  show as defined. mapa-avisos 5.5 proposes "needs attention" for "a request without `etapa` where a next mission
  exists": that state would be permanent for every pedido whose type the mapping never matches. Carried; its weight
  goes up.

#### 2.4 Item 4 (:418): AV PROF. SOLO right before each SOLO

- Still as recorded: each SOLO is preceded by a 0.3 h 'Voo Local' (js/modelos-de-curso.js:47, 51); Voo Solo has one
  take-off time, 06:30, the first of the day (js/horarios.js:40, 52; js/config.js:4, 8).
- (ran) A 'Voo Solo' pedido alone, with AVP-SOLO-01 next: imported with no course mission.
- (ran) A 'Voo Local' pedido at 08:20 and a 'Voo Solo' pedido at 06:30 on the same date, the local one registered
  first: the import gives `AVP-SOLO-01` to the 08:20 flight and `SOLO-01` to the 06:30 one, with no warning. It counts
  every flying request already in the day as planned, whatever its time (`missoesDoDia`, js/progresso.js:144-149;
  js/agenda.js:120-121). The booking dialog counts only the flights that end before the new one (`planejadas:
  voos.filter(o => o.b <= a)`, js/agendamento.js:217): that is where "only gives the order warning" comes from.
- (ran) The same two pedidos with the solo registered first: the solo gets no course mission and the 08:20 flight
  gets `AVP-SOLO-01`. The result depends on the order in which the pedidos were registered (the import walks them in
  the order received, js/agenda.js:111), not on the flights' times.
- A pure module "in the spirit of `importarSolicitacoes`" (pedido.md:40) inherits the import's version unless the plan
  says otherwise. Carried, and it needs an answer before stream E writes its tests.

#### 2.5 Item 5 (:419): the solo crew weight

- Still as recorded: `kg: stu.kg && x.kg ? stu.kg + x.kg : 0` for pinned (js/engine.js:525) and placed flights (:907),
  with no case for 'Voo Solo'. R1 keeps the rules. Carried, untouched; any other answer is an engine commit of its own.

#### 2.6 Item 6 (:420): no check flight for new courses; waivers per course only

- Still as recorded: the checker marks are seven fixed ids of `HABILITACOES` (js/habilitacoes.js:26-32) and the five
  Cheque types are fixed (`CHEQUES`, :65-71); "Dispensada" is a mark on the programme's mission (`marcarMissao`,
  js/programa.js:700-705).
- First half: carried as long as F3 keeps `HABILITACOES` a constant in code (the request names it so, pedido.md:61).
- Second half meets the Alunos detail: with no per-student waiver, the only way to "edit missão atual" is one
  `aprovado` per earlier mission (mapa-alunos 5.4: 13 records to reach NAV-01), and each record locks its code
  (item 17).

#### 2.7 Item 7 (:421): seven smaller defaults

| Default | In the code | Verdict | Why |
|---|---|---|---|
| a. "a booking creates no Agenda request" | `aplicarAgendamento` writes a request and a pin, no `solicitacao`, no RPC (js/agendamento.js:899-943); the only caller of `ApiClient.registrarSolicitacao` is js/eventos/agenda.js:99 (grep) | **contradicted** | R3 has no place for a flight without a pedido, while R4 lists "+ Agendar voo" as an operator restriction that exists. If a booking becomes a pedido, two recorded behaviours collide on the server: the 7th local flight is refused with PT422, before the deadline test (supabase/migrations/20261114230012_agenda_limite_de_locais.sql:32-40), where a booking asks for "Agendar mesmo assim" (js/agendamento.js:1162-1171; decision 6 of 2026-11-17, docs/PLAN.md:375); and past the deadline it needs `p_excecao` and the operador profile (:41-48). |
| b. a past date or a Sunday warns and asks | `data-passada`, `horario-passado`, `domingo` (js/agendamento.js:1189-1191); test/unit/agendamento.test.js:715. Today no date control opens a Sunday: the picker, the arrows and a link go to Monday (js/eventos/topo.js:34-39, 47-52; js/main.js:76-77, 88-91) | moves | depends on (a) and on whether the rail's calendar can open a Sunday (mapa-casca question 2). |
| c. a mission booked on a later date is still suggested today | `missoesDoDia` reads only the requests of the state it is given (js/progresso.js:144-149); `missoesNoDia` only `base.out` (js/agendamento.js:212-220). (ran) Two pedidos of one student on two dates both get `IN-01` | moves | it stops being a booking detail: under R3 every approved pedido gets its mission this way, and the row "missão definida pelo programa" shows both as defined. |
| d. `sem-peso` only on booked flights, not on approval pins | js/engine.js:450, 472-476 ("os outros voos fixos não avisam"); :921-925 for placed flights; test/unit/fixos.test.js:816 | moves | R5 and R8 put conflicts and engine warnings on a stage and on the rail: approving makes `sem-peso`, `voa-com` and `escolhido-saiu` disappear while the weights are still missing (mapa-avisos 5.2 D, measured there; its question 5 is this default). |
| e. no hover marker on the map | only `cursor: cell` (css/app.css:1316); the minute is the click's fraction rounded to 5 (js/eventos/escala.js:27-31) | carried | a narrower pane makes it matter more (1.3 min per pixel at the map's minimum width, computed in mapa-escala 5.7). |
| f. undoing a move is logged as "Edição" | `gravarAlteracao(rev.criado ? 'exc' : 'mod', …)` (js/eventos/historico.js:120); badge text at js/views/escala.js:283 | carried | not touched. |
| g. any weight above 0 kg is accepted | `kg > 0 && kg <= PESO_MAXIMO` against "O peso vai de 1 a 300 kg." (js/rules.js:136-140). (ran) `pesoDigitado('0.5')` is 0.5; `'0,1'` is 0.1 | carried | the Alunos and INVAs detail panes edit the same field with the same message (pedido.md:58, 64). |

#### 2.8 Item 8 (:422): a booked flight whose mission changes in the Demanda

- The release is made by Demanda handlers and nowhere else: `soltarAgendado` (js/eventos/demanda.js:25-30), called by
  `usarMissaoDoCurso` without testing what changed (:94-99: the "Usar releases it even when … the same" clause), by
  the field handler when `mis`, `eq` or `nb` really change (:245-249), and `semAgendados` when an extra is removed
  (:179; js/fixos.js:78-85). Tests: test/e2e/demanda.spec.js:511, :536, :549; test/e2e/cursos-no-dia.spec.js:137.
- The engine has no such rule, and it never reads the approval (grep of `aprovacao` in js/engine.js: none). (ran) A
  booked pin of 1 h whose request becomes 1.5 h, with the pin kept, stays in place with the conflict "a duração do
  pedido mudou"; with `semAgendados` applied first the flight is placed again, 08:20–09:50, not pinned; a type change
  with the pin kept gives "a missão ou o avião do pedido mudou" (js/engine.js:436, 449).
- R3 ends the hand-editing of the Demanda. Its column list does not name "Usar" nor "Outra missão…", which sit in the
  Aluno column (mapa-demanda conflict 2). So the trigger as written disappears, and the rule survives only if the plan
  moves it. If Missão, Recurso or Duração become operator restrictions of the Escala stage, or if a derived value
  changes under a booked pin (the next mission advancing, a pedido cancelled and registered again), the default flips
  from "released and placed again" to "stays, in conflict", unless something outside the event handlers carries the
  release. The clause about Usar is moot if "Usar" goes.

#### 2.9 Item 9 (:423): two Noturnos back to back

- Still as recorded: `FORMAS_DO_NOTURNO` and the refusal text "cada Noturno fica junto na fase: …" (js/programa.js:96,
  161-163). Cursos keeps its behaviour (R10). Carried, untouched.

#### 2.10 Item 10 (:424): a closed course in the Demanda and in the import

- **The Demanda's confirmation and its wording.** "Confirmar: <código> do curso encerrado" (js/eventos/demanda.js:113;
  js/views/etapas.js:98-102), the group "Liberadas no <sigla> (curso encerrado: pede confirmação)"
  (js/views/etapas.js:115-118), the History suffix ", com o curso <sigla> encerrado" (js/eventos/demanda.js:104, 115,
  149). Test: test/e2e/cursos-no-dia.spec.js:174. Moot if those two controls go with the table. If they move to
  another stage, the wording question travels with them, and the History text "… na demanda (…)" names a screen that
  no longer exists (lacuna-1-textos-que-citam-telas, section 2.1).
- **The import.** `curso = !escolhida && aluno.curso ? indice.curso(aluno.curso) : null` does not read `curso.ativo`
  (js/agenda.js:119). (ran) With the PP closed, the pedido is imported with `etapa: 'IN-01'`, `cursoDaEtapa: 'PP'`. No
  test covers it (grep of test/unit/agenda.test.js). This half moves into Processamento, the import's successor.
- It is bound by decision 2 of 2026-11-17, "warns and asks for a confirmation, never blocks" (docs/PLAN.md:371). A
  pure module has no second click. Two answers fit that decision: emit the request without the course mission (the
  analogy the item itself proposes), or emit it with the mission plus a notice that some screen lets the operator
  acknowledge and that is stored. Today a confirmation is kept nowhere but in the History text (mapa-avisos 5.2 F).

#### 2.11 Item 11 (:425): Mover and Encaixar

What the code does, clause by clause:
- Not the "Mover" default without a course mission: `comAProxima` needs `o.info.missao` equal to the next mission
  (js/agendamento.js:476-477, 483-484); otherwise the default stays the next mission as a new flight. Test:
  test/unit/agendamento.test.js:781.
- The status stays: `aplicarAgendamento` never touches `fStatus` (js/agendamento.js:899-943).
- "Encaixar" keeps the chosen instructor: `doPedido = movido.pedido.insId`, taken whenever he is in the list, disabled
  or not (js/agendamento.js:693, 699-701).
- The undo: the 13 request fields are replaced by the stored ones, `pr` included, and a request that no longer flies
  stays off (js/reversoes.js:175-177); with no pin before, the pin is deleted (:185). Tests:
  test/unit/agendamento.test.js:838, :868.
- A move rewrites the request: `p1 = a`, `p2 = -1`, `insId`, and it deletes a `jan` that excludes the new time
  (js/agendamento.js:910, 916-917), after the confirmable warning "… o pedido fica sem a disponibilidade"
  (:1138-1139).

Against the request:
- Every pedido registered since 2026-11-14 has one exact time, so every imported request has `jan: 'h<minuto>'`
  (js/agenda.js:52-56; mapa-demanda 5.3). (ran) A pedido at 10:10, imported, then pinned at 08:20 with `jan` deleted:
  no conflict. The same pin with the request rebuilt from the pedido (`jan: 'h610'` back): "Conflito no voo agendado:
  o horário está fora da disponibilidade do aluno." (js/engine.js:447-448, 533). lacuna-1-pedido-principal-e-extras,
  section 5, ran the same case and also got "↶ Desfazer" refused.
- So "Mover" cannot stand on a Processamento that keeps nothing per request: **contradicted** under pure derivation,
  **moves** under a materialized one.
- Three clauses now depend on where a column goes: the chosen instructor (`insId`), the priority (the item says "the
  same one-line rule could keep the priority too"; if Prioridade leaves the request for an Escala-stage restriction,
  the undo stops touching it by construction) and "Voa" (`fly`).
- The last clause (the flight stays unpinned on the approved schedule) meets R5: flights that enter, or lose their
  pin, after approval carry no mark (mapa-escala 5.2 and its question 9).

#### 2.12 Item 12 (:426): Cursos, a retired item's "Depois de…" list

- The settled half (one course at a time) is step 5 of the 2026-11-19 section; the request does not list it among the
  three decisions it reverses (pedido.md:111-115) and keeps Cursos' behaviour (R10).
- The open half is still as recorded: a retired item keeps its list on screen only, the server stores it without
  requisites (js/programa.js:651-660, 200-202), `regraDeVolta` then answers `regraPerdida: 'sem-requisitos'`
  (:765-770), and whoever waited for it dropped it (`semORequisito`, :645-649). Carried, untouched.

#### 2.13 Item 13 (:427): smaller booking and map choices

- Default aircraft: the sort puts the programme's type before "free now" (`(q.tipo === preferido) - (p.tipo ===
  preferido) || p.ocupadoAgora - q.ocupadoAgora`, js/agendamento.js:519-520). Test:
  test/unit/agendamento.test.js:290. Carried.
- Por instrutor: `linhasLivres` returns no idle rows when a category is chosen, and otherwise
  `S.ins.filter(x => x.on)` (js/views/escala.js:576-584). Carried; it reads `on`, which stream C and the INVAs'
  deactivation rework (R7).
- The item cites "the design's order, §6.4", a document that is not in the repo.

#### 2.14 Item 14 (:428): the rest before the Noturno's return is a note

- Still as recorded: the note is built only in the booking dialog (js/agendamento.js:1215-1229; test
  test/unit/agendamento.test.js:402); the warning belongs to the next day's schedule (`repouso-do-noturno`,
  js/engine.js:997-1008). Carried.
- New with the request: a Noturno that arrives as an approved pedido never passes through the dialog, so on date D
  nothing says it (as with the import today), and the rail lists "the notifications of that date" (R8): the warning
  shows only on D+1.

#### 2.15 Item 15 (:429): dates in the booking dialog

- Still as recorded: `nomeDaData` keeps "hoje" and "amanhã" only (js/agendamento.js:61-65) of the three relatives
  `rotuloDaData` gives ("ontem" too, js/format.js:36-43). Test: test/unit/agendamento.test.js:164. Carried.
- The rail adds "a line naming the open date" ("Hoje · sex 20", pedido.md:80, 90): a second text for the same date,
  to be written by one rule. "Today" is the browser's in these texts (`hojeISO`, js/format.js:26) and São Paulo's in
  the pedido deadline (js/agenda.js:25) (mapa-casca question 12).

#### 2.16 Item 16 (:430): undo and revert lean towards not bringing a booking back

- The fallbacks read three things the request moves: whether the request flies (`voaNaChave`, js/fixos.js:120-125,
  used at :148), the date's History (`agendamentosEmVolta`, js/reversoes.js:202-229) and the request's own fields
  (`mesmoPedido` on `mis, eq, nb, etapa, p1, p2`, js/reversoes.js:121-125, 142; `MISSAO_DO_PEDIDO` at :226).
- The two refusal texts name the Demanda (js/reversoes.js:141-142; test/unit/reversoes.test.js:324). The entry keeps
  its button because the handler returns after the toast (js/eventos/historico.js:117-118).
- Moves: (a) if "Voa off" becomes a cancelled or unapproved pedido, "a request that doesn't fly" is no longer one
  state; (b) if a request field is recomputed (the course mission advancing after its own result, the pedido's time
  restored), `mesmoPedido` fails, and both the undo and the revert of an older change take the "it changed" branch.

#### 2.17 Item 17 (:431): mission codes and the requests

- The lock's reader: `codigosDaDemanda` walks `S.stu` (main request and extras: `p.cursoDaEtapa || s.curso`,
  `p.etapa`) and `RES.out` of the open date (js/views/cursos.js:56-68). The texts say "na Demanda de amanhã (…)"
  (js/views/cursos.js:70-73, 82-85; js/eventos/cursos.js:395-396). Lock by results: js/views/cursos.js:41-50;
  reserved codes: :77-80.
- Moves, in three ways:
  - the text names the Demanda (listed in lacuna-1-textos-que-citam-telas, section 3);
  - the reader keeps working only while the open date's state still carries `etapa` on each request, that is, if
    Processamento emits today's shape (the request's preference, pedido.md:40);
  - the gap the item records ("a code that only another date's requests carry … can still be renamed") changes with
    where an approved pedido's course mission is stored. On the `solicitacoes` row: the server could read it and
    close the gap for every date. In the day document: the gap stays as recorded. Recomputed and stored nowhere: a
    rename before the flight just shows the new code, and the problem becomes the frozen mission of mapa-demanda 5.8
    item 9.
- The item cites "the design's code lock, §2.1", not in the repo.

### 3. "Still open from the final review" and the paragraph after it (docs/PLAN.md:433-437)

| Line | What is recorded | Verdict | Evidence, and what it meets |
|---|---|---|---|
| :434 | finding 13: Noturno units block ↑/↓, and "Voltar ao programa" is refused next to one. "Kept as it is, by Pedro's decision (2026-11-19)": a decision, not a question | carried | Cursos unchanged (R10). |
| :435 | what the undo and revert fixes leave (findings 1, 33): three cases when the date's History lacks the booking's entry or the reverts come out of order | moves | Same three inputs as item 16. The record names two ways the History can lack an entry: local mode's last 1000 entries (js/backends/local.js:125-130) and another operator's entries not loaded. **A third exists and is not named**: in shared mode a date's History is read with `.limit(200)` (js/backends/supabase.js:169-175; js/storage.js:254-255; js/actions.js:254-265). If approving, registering or cancelling a pedido starts to write History lines on the flight's date (mapa-pedidos question 13; mapa-dados suggestion 10), a date reaches 200 sooner (inferred: no volume data). The case "a Usar that picks the booking's own mission can't be told from the booking still standing" is moot if "Usar" goes. The engine hardening it mentions (`daMesmaTurma` "only for the same times") sits inside the pinned-flights loop (js/engine.js:420), and no golden holds a pin (0 of the 42 files of test/fixtures/goldens-do-motor contain `fixos`, `fixo`, `agendado` or `conflito`; grep): the goldens would not have moved (inferred). |
| :437, a | "**Decided (Pedro, 2026-11-19)**": "Limpar demanda" also releases every flight it blanks, drops status and note, reopens an approved schedule; Atrasado, Em Voo and Pousou stay | **reversed or emptied, and not in the request's list** | `limparDemanda` (js/fixos.js:95-117), handler js/eventos/demanda.js:81-89; tests test/e2e/demanda.spec.js:55, :89 and the "Limpar demanda" describe of test/unit/fixos.test.js. With a Demanda that has no data of its own there is nothing to blank (mapa-demanda 5.8 item 11). pedido.md:111-115 names three decisions of 2026-11-19; this one, of the same day, is not among them. |
| :437, b | "A Cancelado flight is cleared like any other…; keeping it too is one line in `limparDemanda`" | moot with (a) | `STATUS_EM_ANDAMENTO = ['Atrasado', 'Em Voo', 'Pousou']` (js/status.js:13; js/fixos.js:102). |
| :437, c | "Still open there, for Pedro: Esc with the focus in a lower drawer closes that drawer, not the one on top." | half moot | `gavetaDoEsc` picks the drawer that holds the focus, else the last opened (js/dom.js:53-59). There are four drawers (index.html:667, 678, 680, 682). R6 removes the two that edit a cadastro record, `#painel-instrutor` and `#painel-dados` (mapa-casca 5.7). The question stays for `#historico` with `#painel-reparo`, and vanishes if either moves into a pane (mapa-outras-abas 5.5 item 5; mapa-restricoes suggestion 7). |

### 4. "Found on main by this branch's reviews (not changed here)" (docs/PLAN.md:439-440)

- Still true at 48875e3 (ran): `normalizeMissionFields` throws "TypeError: Cannot convert object to primitive value"
  when `mis`, `nb`, `pr` or `jan` holds `{"toString": null}`; `normalizarCursos` when a mission's `mis` or `nb` does.
  Safe in the same run: `p1`, `p2`, `eq`, `etapa`, `insId`, `solicitacao`, `cursoDaEtapa`, `fly`, and the mission's
  `id`, `nome`, `eq`.
- Where: at load, js/storage.js:97 (`normalizarCursos`) and :164-170 (`normalizeMissionFields`, main request and each
  extra); the converting lines are js/rules.js:143 (through `Object.hasOwn(MIS, mis)` at :39), :149, :156, :175 and
  js/cursos.js:24, 28. The guard that exists for History payloads: `valorSimples` and `pedidoDeAntes`
  (js/reversoes.js:25-36).
- Verdict: **carried, and widened**. Narrower on one side: in shared mode a request built from a `solicitacoes` row
  takes `missao` from a `text` column and `horas` from a `numeric` one
  (supabase/migrations/20261110222506_agenda_de_solicitacoes.sql:11; 20261114222031_agenda_com_duracao.sql:8), so
  those two cannot hold an object; whatever is kept per request in the day document still can, and in local mode the
  pedidos are JSON in the browser (`acpm4_agenda`, mapa-pedidos 2.3). Wider on the other: every stored shape the request adds
  (availability ranges, a list of required habilitação ids, deactivation flags, a per-date restriction store) gets a
  normalizer of the same kind, and the roster's frozen `cadastro.cursos` stays (docs/PLAN.md:412).

### 5. "Phase 16: Later (nice to have)" (docs/PLAN.md:463-467)

| Line | Item | Verdict | Evidence, and what it meets |
|---|---|---|---|
| :464 | currency (last flight, medical/CMA expiry); "The engine then checks these too" | carried | No code (grep of `CMA`, `validade do`: none). The request fixes the field lists of the two detail panes without it (pedido.md:58, 64) and keeps the rules (R1). A CMA date would be a new column of `dados_pessoais` and a new reason in Processamento ("why any of them cannot be scheduled", pedido.md:41); it is health data, which the app already keeps out of free text ("Sem dados de saúde ou outros dados pessoais.", js/views/dialogo-status.js:20). Stream A migrates that table's write permission anyway (pedido.md:59). |
| :465 | Google Calendar | carried | No code (grep). Not touched. Only question 2 of section 5 bears on it. |
| :466 | installable (PWA), "for use on the apron with poor connectivity" | carried; harder | No manifest and no service worker (grep of index.html, painel.html, js/). Today a day or roster save waits and retries offline (js/backends/supabase.js:46-88) and reads fail (mapa-dados 5.8). Registering and cancelling a pedido are single RPC calls with no queue (js/backends/supabase.js:218-230); an approval call would be the same (inferred). A Demanda derived from server rows moves one more operator step from "queued" to "needs the connection". |
| :467 | after approval, when a new request doesn't fit around the pinned flights, suggest one change to a pinned flight | carried; more needed | Sugestões exist only for a pinned flight in conflict (`if (!voo \|\| !voo.conflito) return []`, js/reparo.js:22-24); a request that does not fit is a rejection with no control (js/engine.js:556-557, 964; mapa-avisos 5.2 B). R9 gives rejected pedidos a row of their own and R5 puts Aprovar last, while pedidos approved after "Aprovar escala" are placed around the pins (mapa-escala 5.2). |

### 6. "## 5. Open questions for the repo owner" (docs/PLAN.md:469-476)

| Line | Question | Verdict | Evidence |
|---|---|---|---|
| :470 | 1. "Who uses the app daily, and how many operators edit at the same time?" | first half answered by the request; second half carried, and it now decides two designs | pedido.md:9: "our champion operator, the one person at ACPM who builds the escala every day". Recorded before: "Writes come from 1 to 3 operators" (docs/PLAN.md:59); three Operador accounts at go-live (:120); "Secretaria accounts: none for now … Operadores register requests in the Agenda" (:158). It decides (a) whether "aguardando aprovação" is ever a real state, when who registers is who approves (mapa-pedidos 5.8), and (b) how much the single version of the `cadastro` document hurts three edit-in-place screens (mapa-dados suggestion 6). |
| :471 | 2. Google Workspace? "This decides Sheets versus Supabase." | moot since Phase 2, not because of the redesign | Supabase was recommended and is live (docs/PLAN.md:75, 106). The line is not struck. The fact would still matter to Phase 16's calendar item. |
| :473 | 4. "Are the instructor levels in someone's browser the real ones, and whose?" | moot since Phases 2 and 4 | The roster "with the real levels" was uploaded from the master operator's browser on 2026-11-10 (docs/PLAN.md:114, 122), and the levels were replaced by individual habilitações (:148; `habilitacoesDoNivel`, js/habilitacoes.js:110-126). Not struck. Its successor is the unchecked box "The operator marks the checkers (and reviews the qualifications)" (:160; lacuna-1-pendencias-de-implantacao-registradas, section B), which is about the data F3 reorganizes. |
| :472, :474-476 | 3, 5, 6, 7 | struck and answered in the file | — |

### 7. Recorded decisions beside these items that the request also reaches

They are not open items, but the open items hang on them, and none is in pedido.md:111-115.

| Line | Decision | What the request does to it |
|---|---|---|
| docs/PLAN.md:371 | decision 2 of 2026-11-17: breaking a course restriction "warns and asks for a confirmation, never blocks, in the booking dialog and in Demanda" | the Demanda half loses its place (items 8, 10); P16's "Outra missão…" (docs/PLAN.md:397) goes with it. |
| docs/PLAN.md:373 | decision 4: a weight typed in the booking dialog is saved to the profile (js/agendamento.js:925-933) | meets "No modal or pop-up for viewing or editing a record" (R6), if that sentence reaches this dialog (mapa-restricoes conflict 6 and question 9). The dialog is already for Operador and Administrador only (mapa-restricoes, section 3), so the Secretaria rule is not broken. |
| docs/PLAN.md:374 | decision 5: "The operator's input beats the engine" | the request says more: restrictions "override any rule" (R4). In the code a booking is refused when the engine would flag it (mapa-restricoes conflict 1). |
| docs/PLAN.md:375 | decision 6: an over-limit local flight in a booking warns and asks | item 7a above. |
| docs/PLAN.md:388, 399 | P07 and P18: what releases a booked pin in the Demanda; the Demanda's tag "agendado 10:10 · PR-VOB" (js/views/demanda.js:43-47) | both live on the table that R3 replaces (item 8). |
| docs/PLAN.md:404 | finding 10: the code lock "while the open date's Demanda carries it" | item 17. |
| docs/PLAN.md:437 | "Limpar demanda" (2026-11-19) | section 3. |

### 8. What was run

All with `node --input-type=module -e` from the worktree root, importing the pure modules; students "Aluno 1000" (id
1000, 70 kg), instructors from test/helpers/estado.js; the PP programme built with `novoCurso(…, { modelo:
MODELOS['pp-acpm'] })`.

| Run | Result |
|---|---|
| `normalizeMissionFields` with `{"toString": null}` in each field | throws for `mis`, `nb`, `pr`, `jan`; the other eight fields are normalized |
| `normalizarCursos` with the same value in each field of a mission | throws for `mis`, `nb`; `id`, `nome`, `eq` are normalized |
| `pesoDigitado` on '0.5', '0,1', '0.04', '0', '300', '300.1' | 0.5, 0.1, null, null, 300, null; `ERRO_DO_PESO` is "O peso vai de 1 a 300 kg." |
| `importarSolicitacoes`, 'Voo Solo' pedido alone, AVP-SOLO-01 next | `{ mis: 'Voo Solo', etapa: none }` |
| same, 'Voo Local' 08:20 (0.3 h) then 'Voo Solo' 06:30, same date | `AVP-SOLO-01` on the 08:20 request, `SOLO-01` on the 06:30 one |
| same two pedidos, the 'Voo Solo' registered first | no course mission on the solo, `AVP-SOLO-01` on the 08:20 request |
| same, PP with `ativo: false`, 'Voo Local' pedido | `etapa: 'IN-01'`, `cursoDaEtapa: 'PP'` |
| same, one student, one 'Voo Local' pedido on each of two dates | `IN-01` on both |
| same, 'TGL (TMA)' and 'Voo Local' pedidos with TMA-01 next; 'Cheque PP' with AVX-CQ next; 'Noturno' with the night phase open | none; `TMA-01`; none; `NOT` |
| `runAllocationEngine`: a pedido imported at 10:10; then a booked pin at 08:20 with `jan` deleted; then the same pin with the request as imported | placed at 10:10 with `jan: 'h610'`; no conflict; "Conflito no voo agendado: o horário está fora da disponibilidade do aluno." |
| `runAllocationEngine`: a booked pin of 1 h, request changed to 1.5 h, pin kept; the same after `semAgendados`; type changed to C172 with the pin kept | conflict "a duração do pedido mudou"; placed 08:20–09:50 and not pinned; conflicts "o instrutor não tem a habilitação da missão" and "a missão ou o avião do pedido mudou" |

### 9. Repo rules this touches

- **Fictitious names and weights**: every run above; the tests named use "Aluno 1000", "Instrutor 01", "Maria".
- **Personal data**: item 7g and decision 4 write a weight with the person's name into the History ("Peso <nome>:
  <kg> kg (agendamento)", js/agendamento.js:1278); weight is not in the repo's personal-data list (mapa-dados C13).
  Phase 16's CMA date would be personal data of a new kind (health).
- **Pure engine and goldens**: items 5, 7d and the hardening of :435 are engine changes; 7d and the hardening sit in
  the pinned-flights loop, which no golden exercises. Items 3, 4, 7c and 10 are next-mission rules outside the engine
  (the engine copies `etapa` to the row and decides nothing with it: js/engine.js:523, 902).
- **`gravarAlteracao`**: the release of item 8 and "Limpar demanda" both run inside it today
  (js/eventos/demanda.js:85, 115, 129, 149, 267). A release made by a derivation at date open would be a write outside
  it, on a read.
- **Data-format steps never delete fields**: items 11, 16 and 17 need `jan`, `fly`, `insId`, `etapa`,
  `cursoDaEtapa`, `p1`, `p2` to stay readable on stored days, whatever the new model stores.

## What the maps got wrong or left out (name the map)

- **All maps and gap files**: only :421, :424, :431 and :437 are cited; none checks whether a recorded default still
  holds in the code, and none says that three of the 17 items lean on a design document that is not in the repo. The
  code comments cite it too ("desenho §4.9": js/eventos/demanda.js:107; js/views/etapas.js:84;
  test/unit/progresso.test.js:373; test/e2e/cursos-no-dia.spec.js:172).
- **mapa-escala 5.2**, row "New or changed requests in the Demanda": "a changed pinned request becomes a conflict" is
  right only for pins without the `agendado` mark. A booked flight whose `mis`, `eq` or `nb` changes in the Demanda is
  released and placed again, approved schedule or not (js/eventos/demanda.js:245-249; js/fixos.js:78-85;
  docs/PLAN.md:422; ran on the pure modules, and the engine never reads the approval), unless a status pins it.
- **mapa-demanda 5.8 and section 8**: it lists what has nowhere to live without saying which entries are recorded
  defaults or decisions. Item 11 of 5.8 and question 10 ("Limpar demanda") do not cite the decision of 2026-11-19
  (:437); item 6 (out of order, closed course) cites neither decision 2 (:371) nor item 10 (:424); question 5 is
  item 7a; question 6 is decision 2 plus item 10. It describes the release of a booked pin (sections 3 and 4) without
  the two facts item 8 turns on: "Usar" releases without testing what changed (js/eventos/demanda.js:98), and the rule
  exists only in event handlers.
- **mapa-restricoes 5.1 and 5.5**: correct on what releases a booked pin and on the undo's guards, but silent that
  these are the open cases of :422, :430 and :435. Its questions 1, 6 and 9 restate item 7a, the decision of :437 and
  decision 4 (:373) without the PLAN lines; its question 2 ("override any rule") does not set the request against
  decisions 2 and 5 (:371, :374). Its section 1 and conflict 7 say the goldens hold no pin, as a warning about the
  safety net; the other side is not drawn: the two engine changes PLAN.md left out "to keep the engine and its
  goldens unchanged" (:435) or kept as a default (:421, `sem-peso`) would not move a golden (inferred from the grep in
  section 3), only unit tests.
- **mapa-pedidos 5.4, suggestion 12 and question 15**: it covers only the import half of item 10. Suggestion 12
  ("return 'curso encerrado' as a reason … Risk: none") is not weighed against decision 2 (:371): as a reason why a
  pedido "cannot be scheduled" it would turn a warning into a block. Its section 4 notes that the Sunday rule is not
  absolute, but not that the booking's `domingo` warning (item 7b) is unreachable from any date control today.
- **mapa-alunos 5.4**: "A mission code with results can no longer be renamed in Cursos (docs/PLAN.md:431)" is right
  and incomplete. A result whose code no mission has *reserves* that code (js/views/cursos.js:77-80), the server
  accepts any well-formed code (docs/PLAN.md:379; js/resultados.js:34-41), and results are append-only
  (js/resultados.js:1-3): a detail pane that registers results by typing a code could reserve a mistyped one for good.
  It mentions the Noturno in legs for "missão atual" and not for "missão anterior" (item 1), and does not link "no
  per-student waiver" (item 6) to its own question 6.
- **mapa-avisos 5.2 D, conflict 5, question 5**: measures item 7d, cites :421 and names the test group (its section
  4; the exact test is test/unit/fixos.test.js:816). Left out: a change there would sit inside the pin loop that no
  golden covers. Its row state for "missão definida pelo programa" (5.5) does not account for items 3 and 4.
- **mapa-casca 5.7** cites the Esc question (:437) without its consequence; **mapa-outras-abas 7.1 item 10** has the
  consequence (two drawers left) without the PLAN line. Together: the open question shrinks from four drawers to two.
- **mapa-outras-abas 5.4** and **mapa-dados 5.5** give the 200-entry read of a date's History
  (js/backends/supabase.js:169-175) and **mapa-restricoes 5.5** the History scan of `agendamentosEmVolta`; no file
  joins them: above 200 entries the scan misses bookings, a case docs/PLAN.md:435 does not name.
- **lacuna-1-pendencias-de-implantacao-registradas, section H item 4** lists the seven accessibility decisions "Left
  for the owner" (docs/PLAN.md:344-351) only as "not server items". They are outside the five lists of this question,
  but they are open items of PLAN.md that the request answers by force or re-creates:

  | Line | Open decision | What the request does to it |
  |---|---|---|
  | :345 | the two-click confirmation reverts after 3.5 s (js/eventos/confirmacao.js:9) | carried |
  | :346 | toasts last 2.8 s (js/dom.js:18); some errors exist only as toasts | carried; the rail's list is for "that date" (R8), so it is not their home by itself |
  | :347 | drawers cover content without holding focus: "modal …, or reserve their width on wide screens?" | answered by force: `.gaveta` is fixed at the right edge, 440 px wide (css/app.css:1455-1459), exactly over the rail (mapa-escala 5.7) |
  | :348 | text dimmed with opacity is under 4.5:1 (`tr.off td { opacity: .5 }`, css/app.css:577; `.cal .dia.fora { opacity: .45 }`, :1154) | re-created: "inactive rows are dimmed" and "the next month's first days shown after the last week" (pedido.md:88, 90) |
  | :349 | non-text contrast: the switch's off track (`input.sw`, css/app.css:771-780), the availability grid's cells | the switch becomes the state control of every list row (pedido.md:88); the grid's cells go with the ranges (pedido.md:64) |
  | :350 | on the map, Atrasado and Em voo differ by border colour only | carried; the pipeline adds five status icons that must not differ by colour alone (pedido.md:99) |
  | :351 | required fields in Agenda and Recurso are not marked | carried into streams D and B, which rebuild both forms |

- Also outside the five lists and still open in the file: "Left for the next PR: the time vocabulary (… 'Aplicar
  período')" (docs/PLAN.md:326; no such control exists, grep), which is about the periods that stream B removes with
  `state.win`; and "Not now: realtime updates" (docs/PLAN.md:132), the decision behind the "no polling" fact that
  mapa-avisos (question 7) and mapa-pedidos (section 1) report.

## Implications for the plan (suggestions, marked as such)

Everything below is a suggestion.

**A. Lines for the new section's "Decisions this reverses" (or "keeps"), beyond the request's three.** Cost: text
only. Risk of leaving them out: a reviewer finds the contradiction after the step is merged.
1. docs/PLAN.md:437, "Limpar demanda" (2026-11-19): say whether it goes, or what it clears now.
2. docs/PLAN.md:421, "a booking creates no Agenda request": say whether a booking registers an approved pedido
   (then also how PT422, the deadline and a Sunday are handled for it) or stays a second input of Processamento.
3. docs/PLAN.md:422, the release of a booked flight when its request changes: kept (where) or replaced by a conflict.
4. docs/PLAN.md:371 and :397, the confirmation of an out-of-order or closed-course mission "in Demanda": its new place.
5. docs/PLAN.md:404 and :431, the code lock "while the open date's Demanda carries it": its new reader and text.
6. docs/PLAN.md:373, weights typed in the booking dialog: kept, with one sentence on the "no modal" rule.

**B. Lines for its "Open questions", by origin.**
- Carry as they are: items 2, 5, 9, 12, 14; :434 as a decision; Phase 16 as four later items.
- Carry with the new wording: items 1 and 6 (as questions of the Alunos detail), 3 and 4 (as rules of Processamento),
  7b-7d, 8, 10 (import half), 11, 13, 15, 16, 17, :435, :440.
- Close: questions 2 and 4 of section 5 (answered by the record); the first half of question 1 (answered by
  pedido.md:9); :437 b and c once A.1 and the drawers are decided.
- Do not cite "the design's §x.y": restate the rule in words. Cost: text.

**C. Suggestions with a cost and a risk.**
1. **Put the release rule of item 8 in one pure function**, beside `semAgendados` in js/fixos.js, called by every
   writer that changes a request's `mis`, `eq` or `nb`. Cost: one function and unit tests; the four e2e tests of 2.8
   move with the screen. Risk: if Processamento recomputes at every date open, the release would run on a read, for
   read-only profiles too, against "Opening a date still writes nothing" (docs/PLAN.md:176); it must run only inside
   an operator's change. The alternative (leave the flight in conflict) reverses the item's default and belongs in A.3.
2. **Decide items 10 (import half) and 4 as rules of the Processamento module before stream E writes its tests.** For
   10: emit without the course mission, with a notice (fits decision 2). For 4: count as planned only the same-day
   requests whose pedido time is earlier, as the booking dialog does; with exact-time pedidos the times are known
   before the engine runs, and the result stops depending on the order of registration (2.4). Cost: a few lines and
   unit tests in the new module. Risk: both change what today's import
   gives for the same input (ran), so they are rule changes of the next-mission logic and need Pedro's answer; the
   engine and the goldens are not involved.
3. **Item 7c, only if Pedro wants a mission asked for an earlier date to count**: Processamento's input grows from
   "the approved pedidos of the date" to "the student's approved pedidos up to the date". Cost: a wider read (the
   month read already brings up to 42 days, mapa-avisos 5.4) and new tests. Risk: a flight that did not happen on D
   leaves D+1 with the wrong mission until a result is registered.
4. **Item 7d: count missing weights from the rows** (`limKg && !kg`, js/views/escala.js:323-325), as mapa-avisos
   suggestion 5, and leave the engine alone. Cost: view only. Risk: two counts while the Escala's amber box still
   counts `al`. The alternative (emit `sem-peso` for every pin) changes test/unit/fixos.test.js:816 and no golden, but
   it is still an engine output change and needs its own commit.
5. **Item 11 and item 16: keep `fly`, `insId` and the identity fields (`mis, eq, nb, etapa, p1, p2`, plus `jan`)
   stored per request**, whatever else is derived (this is option 4a of mapa-dados section 7). Cost: none beyond that
   option. Risk: it is not literally "no data of its own"; without it "Mover", its undo and the fallbacks of :430 and
   :435 break (ran).
6. **Item 17: decide it together with where a pedido's course mission is stored.** On the row: let `gravar_programa`
   refuse a code that an active pedido carries. Cost: a server change with pgTAP, the local mirror (`gravarCurso`) and
   the shared cases of test/helpers/casos-do-programa.js. Risk: a new refusal in Cursos, against R10. In the day
   document: only the text changes, and the gap stays as recorded.
7. **If pedido approvals are logged in the date's History, page or raise the 200-entry read first**
   (js/backends/supabase.js:172). Cost: one query and the fake server. Risk: low; without it the History-based
   arbitration of item 16 degrades on busy dates.
8. **:437 c, Esc**: with two drawers left, either close the item by statement (the drawer with the focus closes,
   else the top one: today's behaviour) or move the Sugestões into the middle pane and the question disappears. Cost:
   none, or the rework of mapa-restricoes suggestion 7. Risk: the Esc-layering tests (mapa-escala suggestion 14).
9. **:440: fix it in the first data-format step of the redesign.** Check the type before converting in
   `normalizeMissionFields` and `normalizarMissao`, as `valorSimples` does, and make "type first" the rule for every
   new normalizer. Cost: about ten lines and one hostile-value test per normalizer (the pattern of
   test/unit/reversoes.test.js, "qualquer campo adulterado…"). Risk: low; it is a fix to main's behaviour, so its own
   commit.
10. **Phase 16, fourth item: give "pedidos que não cabem" a link to the booking dialog's "Encaixar"** for that
    request, which already says why it was left out and offers the free alternatives against the pinned flights
    (js/agendamento.js:262-279, 989-1007). Cost: a new context kind for the dialog (js/agendamento.js:78-100). Risk:
    it suggests no change to a pinned flight, so the Phase 16 item stays open; say so.
11. **Result entry in the Alunos detail (items 1, 6, 17)**: pick the mission from the programme, never a typed code;
    offer a Noturno by its night only. Cost: reuse `estadoDoAluno` and `rotuloDaMissao`. Risk: placing a transfer
    student still takes one record per mission, each locking a code.
12. **The accessibility decisions of docs/PLAN.md:347-350**: decide them inside F1 and F2, which re-create them
    (drawers over the rail, dimmed inactive rows, the row switch, status by icon). Cost: tokens and contrast checks.
    Risk: it goes beyond "Use the app's existing light and dark tokens" (pedido.md:92).

Not covered: the design document cited by section number (not in the repo); production facts (whether the PP course
uses the template, whether Secretaria accounts exist); Playwright runs.

<!-- fim -->
