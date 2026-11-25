<!-- Design note for the production-line redesign. Local working note: never commit this file. -->

# Desenho: The core data flow: from approved pedidos to the engine input, and the operator restrictions

Final design of the core, written from the three proposals (desenho-nucleo-a.md, -b.md, -c.md) and revised with the
three independent reviews (code, request, production). Code read at the worktree `.redesenho/wt-plano` (branch
`linha-0-plano`, 48875e3); paths are relative to it. Words: a **pedido** is a row of `solicitacoes`; a **record** is the
day's stored request (`dia.pedidos[<aluno>]` or one of its `extra[]`); the **key** is `<stuId>_<mid>_1`; **held** = the
pedido's id is in the date's `importadas`. "desenho-pedidos" (D), "desenho-escala-aprovar" (H), "desenho-entrega" and
"desenho-cadastros" are the sibling final notes. "Edit" = Operador and Administrador.

What the revision changed: the restriction editor is G's panel "Restrições do voo" (no H1 before G); a withdrawal is
read from the pedido's row, not from this browser; a waiting pedido's id is never forgotten, so an approval never brings
back a flight the operator cleared; a date before today receives nothing; "já decolou" asks the operator instead of
deciding; the course-mission walk takes the clock; no click writes against a day changed elsewhere; the booking's undo
cannot remove a pedido's flight; a pedido's exact minute is never loosened silently; format 28 ships in E so G can be
reverted alone; G carries D's conversion again as a migration; names follow D and H.

"(ran)" = run now with node on scratch copies of `js/` and `test/` outside the repo, fictitious names and weights only;
nothing in the worktree changed. Scratch root: `/private/tmp/claude-501/-Users-pedrofernandes-ACPM/5d1f0955-e20a-47d4-acd8-3ee432e7a836/scratchpad/`.
First version: `nucleo-final/` (`js/processamento.js`, `propriedade.mjs`, `missoes.mjs`, `caminhada.mjs`, `parear.mjs`).
Revision: `nucleo-rev/` (the prototype with the revised rules) and `rev-nucleo-dono/` (`sequencias.mjs`,
`desfazer-antes.mjs`, `propriedade.mjs`, `propriedade-antes.mjs`, `caminhada-hoje.mjs`, `horarios.mjs`).

| Run | Result |
|---|---|
| R1. (first version) A prototype of the conciliation put behind `importarSolicitacoes` (entries only), with the guard of decision 2, the time order and the closed-course rule of decision 12 and the kept priority of decision 11; then the repo's own tests: agenda, rules, progresso, instrutor-escolhido, atributos, agendamento | 199 tests, 196 pass. The 3 that fail are the 3 that pin the reuse of a main request that carries a pedido: test/unit/agenda.test.js "o pedido principal que recebe o pedido da agenda começa em branco", test/unit/rules.test.js "o pedido principal, quando o aluno não voa e o dia não guarda nada dele…", test/unit/agendamento.test.js "o pedido principal que não voa, com a chave limpa, recebe o voo…". The other 20 import tests pass unchanged |
| R2. (first version, superseded by R10) 400 random sequences of 60 events | 24,000 steps, 0 failures on the first version's invariants |
| R3. The guard "já decolou" read from the saved row instead of the pin | 1 of 400 sequences stopped being idempotent. With the pin's time: 0 |
| R4. `cabeSozinho` over 100 generated days (`comVolta(comAtributos(comEscolhas(…)))`) | 2,160 flying requests, 350 rejected alone, 0 of them placed in the full day; 0.19 ms each |
| R5. Rejections paired with requests by position (`naOrdemDoMotor` over the flying requests that are not in `out`), with the label as a check; 1,601 days: the example, 400 seeds in three variants and a fourth with half of the flights pinned | 9,040 rejections, 0 days out of line; 84 rejections share their label with another of the same day |
| R6. The course mission by time, PP template: "Voo Local" 08:20 and "Voo Solo" 06:30 with AVP-SOLO-01 next, in the four orders | always AVP-SOLO-01 on the 08:20 flight and none on the 06:30 solo; two "Voo Local" (08:20, 13:40) with PE-01 next: PE-01 and PE-02 by time. Closed course, or programme not read: none |
| R7. The walk of 2.4 in seven cases | yesterday's result arrived (PE-01 → PE-02); two flights move on together; a mission chosen by the operator stays; a flight with a result, a record without the mark and a flight on another resource type are not changed |
| R8. (revision) The reviewers' sequences on the revised rules (`rev-nucleo-dono/sequencias.mjs`) | S1 "Tirar da escala", withdraw, approve again: the flight stays off, id held. S1b withdrawn in another browser, then "Atualizar": `saem`, id out; approved again here: `voltam`. S1c an old tab's waiting pedido with no withdrawal trace: `semAprovacao`, not removed. S2 cleared before D (id held, no record, waiting) then "Aprovar todos": `dispensados`, the hand-made 08:20 flight untouched. S3 approved, past date, never entered: `naoEntrou`, `pendente` false, nothing written. S4 cancelled elsewhere, pinned 11:30 today: at 12:00 `conferir` ('ja-decolou'), not removed, `pendente` false; at 10:00 `saem` |
| R9. (revision) A booking released by "Soltar", a pedido of the same mission takes the record, then the booking's "↶ Desfazer" (`desfazer-antes.mjs`, `sequencias.mjs` U) | today's guard ACCEPTS: Voo Solo and Noturno on an extra, the pedido's record is removed; Voo Solo on mid 0, the record is blanked and `solicitacao` dropped; `importadas` stays `[501]` in all three. The revised guard refuses all three ("Este voo agora é de um pedido aprovado: desfazer o tiraria da escala.") |
| R10. (revision) Property run of the revised rules (`rev-nucleo-dono/propriedade.mjs`): 400 sequences × 60 events (register; approve and withdraw here or elsewhere, the withdrawal leaving its trace; cancel here or elsewhere; "Tirar da escala"; "Pôr de volta"; booking; "Soltar"; "↶ Desfazer"; status incl. Atrasado; pin; result; save and load; "Atualizar"), one third on each of a future date, today, a past date | 24,000 steps, 0 failures on: one record per pedido and a stable key; no pedido record disappears; idempotent after "Atualizar"; a flight the operator took off never flies again without "Pôr de volta"; nothing changes on a past date; a waiting pedido without a withdrawal trace is never removed; a record without a pedido is never touched except the one that gives way; a cancelled flying pedido is in `ficam` or `conferir`. The same property on the first version (`propriedade-antes.mjs`): 142 failures (141 past-date changes, 1 flight taken off that came back by itself) |
| R11. (revision) The walk with the clock (`caminhada-hoje.mjs`): a flight bound PE-02 yesterday, pinned 08:20 today, PE-01 registered reprovado at 10:30 | first version at 11:00: PE-02 → PE-01. Revised: at 11:00 none; at 07:00 PE-02 → PE-01; on a date before today none |
| R12. (revision) The exact minute against `ajustarPreferencias` (worktree modules, `horarios.mjs`) | a "Voo Local" pedido at 10:10 gives `{eq C152, p1 610, p2 610, jan 'h610'}`; type → PA-34 gives `{630, 630, jan deleted}`; a C152 list without 10:10 gives `{690, 690, jan deleted}`; `pedidoDaSolicitacao` with that list keeps `jan 'h610'` (p1 500, p2 690) |

## 1. Decisions (numbered; for each: the decision, why, the evidence as a map section or path:line, and the alternative rejected with the reason)

### 1.1 The three proposals compared

| Criterion | A: smallest change that is airtight | B: truly derived | C: operator and production first |
|---|---|---|---|
| "No data of its own" | the stage has no input; the day keeps one record per admitted pedido | nearest to the letter: requests rebuilt at every load and before every save; the day keeps two maps (`voos`, `restricoes`) | the stage has an editing block in its detail pane; the day keeps the requests |
| Engine and goldens | untouched | untouched | untouched |
| Where a Demanda column lives | the pedido keeps one exact time; every override on the record, edited in an Escala panel | pedido fields, plus an explicit restriction store | pedido fields; overrides on the record, shown as differences |
| Risk to data stored in production | no stored day converted (28 is a no-op); depends on a refined SQL backfill | every stored day converted by step 28; two readers for good; not undone by a revert; a date does not open without the pedido rows | no stored day converted (28 is a no-op); no SQL |
| Size | 1 module; 3 writer sites removed, 13 kept; 9 revert kinds kept | 2 modules; about 10 writer sites and 5 revert kinds re-pointed; about 45 existing unit tests change; G in two PRs | 2 modules; 1 new boolean; writers kept; 9 revert kinds kept |
| The operator, every day | an approval enters at once (0 clicks), which creates the date's data days ahead; restrictions in an Escala panel; no restart | pedidos enter and leave with any save; restrictions in an Escala panel | 1 click per date, then by themselves; stale course missions fixed by the same click; restrictions one screen away |
| A pedido cancelled and another approved | the record stays: same key, same place | the binding stays: same key, pin released | the request is deleted: the number can be reused |
| Reversibility of the cut-over | stored content unchanged; forward only because of the number | forward only; a fix would read the frozen `pedidos` copy | as A |
| Local mode, two operators | same code; the day's version decides | same; one more required read | same; applying twice equals once |

### 1.2 What was taken and what was rejected

| From | Taken | Rejected, and why |
|---|---|---|
| A | the stored records as the engine's only input; the record never deleted, leaving as `fly: false`; the guard on mid 0; `importadas` as the list the date holds; nothing but `fly` rewritten on a record that exists; `so` (apply only the pedido acted on); the pairing by position with the label as a check; `juntar` hardened; format 28 as a no-op; the kept priority; **the panel "Restrições do voo" (its 2.5) as G's editor, with today's row handlers** | approvals always entering at once (decision 4); the symmetric removal of a waiting pedido found without approval and without a withdrawal (decision 5); "Limpar demanda" removed with nothing in its place (decision 17) |
| B | the costing of derived against materialised (its 2.15), which settles decision 1; the release of a booked pin in one pure place; "Pôr de volta"; the late binding, folded into `etapaDoPrograma`; the test of the queue order against a day where nothing can fly; the History read raised to 500 | the derived store: G would carry storage, ten writer sites and five reverts, the pedido rows would become a required read, and a flight could enter or leave with an unrelated save |
| C | the first entry of a date is explicit (decision 4); the wider "stays" guards (decision 6); a waiting pedido never removed without a choice (decision 5); `dispensados`; the course mission by time and the stale list changed by the same click (decisions 12, 13); `js/rejeicoes.js`; "Recomeçar pelos pedidos"; a resource or duration override keeps the course mission | deleting the request on exit (the number is reused); the positive mark `etapaEscolhida` (every stored record would count as "not chosen"): inverted to `etapaDoPrograma`; the restriction block inside the Processamento detail as the only editor: G builds the Escala-stage panel anyway (the red box, the Lista, the map), and that panel opens from the Processamento line with the same count (2.13), so the block would be a second editor; it stays Pedro's alternative (question 2); "Remover este voo"; an override of the mission type; "já decolou" by the saved row (R3) |

### 1.3 The decisions

| # | Decision | Why | Evidence | Alternative rejected, and why |
|---|---|---|---|---|
| 1 | **The day keeps `dia.pedidos` in today's shape, and it stays the engine's only input.** `solicitacoes` is read only by the conciliation, which is an explicit, logged write of the day. | A failed or late read of the pedidos can never change a schedule; the saved `resultado` always matches the stored records; pins, statuses, results, nine revert kinds, the TV, the BI and the exports need no change. | js/actions.js:166-182, 367; js/dias.js:59-62; mapa-dados 5.8; mapa-demanda 5.6 | B's rebuilt requests (1.2). Closer to the letter; its cost is what Pedro buys with question 1 |
| 2 | **Identity: the record that carries `solicitacao: <id>` is the pedido's flight. Its slot is given once by today's allocator (`alvoDoNovoPedido`, `proximoMid`), also used by bookings, with one guard: a main request that carries `solicitacao` is never reused. The record is never deleted or renumbered (leaving is `fly: false`; "Recomeçar" resets it in place), and a booking's "↶ Desfazer" is refused once the record carries a pedido the booking did not leave on it.** | One number space, small numbers, no pedido id as `mid`. A deleted slot is reused (`proximoMid` is the largest + 1; mid 0 when clean), so a stored revert or a result would land on another flight. Today a booking released by "Soltar" gives way to an entering pedido and its old undo then removes that pedido's flight (R9). | js/rules.js:54-72, 95-100; js/agenda.js:86-93 (`vooQueDaLugar`: no pin, no status, no result); js/reversoes.js:121-125 (`IDENTIDADE_DO_PEDIDO` has no `solicitacao`), :136-149, :165-180; js/reparo.js:118-125; js/escala-gravada.js:37; supabase/migrations/20261120150000_painel_do_dia_com_a_configuracao.sql:20 (`mid` up to 6 digits); R1, R9, R10 | `mid` = pedido id (13 digits in local mode). Deleting on exit (C). A give-way that skips records a not-undone booking created (it needs the History, which may be cut at 200/500 entries) |
| 3 | **`dia.importadas` means "the pedidos this date received and still holds". An id leaves only with its pedido's exit (cancelled, or withdrawn while its record flew), as the bookkeeping of a cancelled pedido without a flying record, or by "Trazer de volta". A waiting pedido's id is never forgotten.** So "taken off by the operator" (id held, `fly: false`) differs from "left because the pedido lost its approval" (id out, `fly: false`); an approved pedido whose id is held and has no record is `dispensado` and never comes back by itself. | The field exists, is whitelisted and normalised. D's conversion leaves the pedidos cleared before it ("Limpar demanda", "✕") waiting and held: rule (a) needs a record from today on and rule (b) skips held ids. Forgetting their ids would let "Aprovar todos" bring those flights back (the first version did: R10's mutation run). | js/dias.js:34, 71, 110; js/storage.js:84; js/fixos.js:95-117; desenho-pedidos 2.9 (rules a and b), decision 6 ("Aprovar todos" sends every waiting pedido shown); R8 S2 | A new field `admitidos`. Forgetting the ids of waiting pedidos (the first version) |
| 4 | **A pedido enters a date by one explicit step, "Atualizar a escala". An approval, a withdrawal or a cancellation made in this browser for the open date is applied at once, for those pedidos only, under D's five conditions (open date; data read; `diaJaGravado()`; none of `resultados`, `cursos`, `cursos-pendentes` unavailable; `ApiClient.diaMudou(DATA)` false). Approval alone never creates the date's day.** | Every save creates `dia:<data>`, and a stored day never again receives the aircraft hours, the rodízio queues and the availability of the day before it. This is D's decision 13; this note owns the hook D's handlers call from G on. | js/storage.js:182-191 (`novo: !dia`, :212); js/dias.js:118-137; desenho-pedidos decisions 13, 14, 2.5 (`diaJaGravado`, `diaMudou`) | Always at once (posicao B1): it freezes a date not started. Always a click: one more click for every late pedido on the day of operation |
| 5 | **What leaves.** A cancelled pedido's flight leaves with "Atualizar a escala" (at once when cancelled here). A pedido whose row carries a withdrawal (`aprovacao_retirada_em`) leaves the same way, wherever the withdrawal was made. A waiting pedido with no withdrawal trace whose flight is in the day (old tabs, the cut-over) is never removed by "Atualizar": it is listed with "Aprovar pedido" and "Tirar da escala". On a date before today nothing leaves (decision 23). | The row is the truth: a withdrawal made on another computer, or while the results were unread, or between D and G, is still a withdrawal (D records it on the row). A waiting pedido with no trace was never approved here: it is an old tab's import, not a decision to remove a flight. | desenho-pedidos decisions 6 (the approval is a row button; withdrawing is two clicks in the detail), 19 (`aprovacao_retirada_em`, `_por`, `_usuario`; table check "approved or withdrawn, never both"), 2.3; mapa-pedidos 5.8; R8 S1b, S1c | The first version's `retirar` (only withdrawals made in this browser): three cases stayed flying. posicao B1 "removes every pedido no longer approved": an old tab's import would leave without a choice |
| 6 | **What leaving writes.** Withdrawn: `fly = false`, the id out; the pin sleeps. Cancelled: the same, and the key is cleaned (`fixos`, `fStatus`, `fObs`). **What stays, whole (`ficam`):** a flight Em Voo, Pousou or Cancelado; a flight with a result; every flight while the results are unread; every flight of a date before today. **What asks the operator (`conferir`):** a flight Atrasado, and a flight of today whose pinned start has passed with no status: it is not removed, the line asks for Pousou or Cancelado, and it stays in attention until a status or a result exists. The approval of the schedule is never reopened. **A sleeping pin keeps the place only while it lasts: a booked pin through Reabrir and Aprovar, a chosen pin through Reabrir, an approval pin (no mark) is lost at the next Reabrir or Aprovar.** | Saved schedules feed the instructors' hours, the next date's aircraft hours and the BI, and `cancelar_solicitacao` has no time rule: a pedido tidied up later must not erase a flight that happened. "Já decolou" is a guess, not a fact: the flight may have flown without a status, or not at all. | js/engine.js:399-400; js/fixos.js:40-41, 52-53 (`fixosAoReabrir` keeps operator and status pins), 59-69 (`fixosAoAprovar` keeps out-of-schedule booked pins only); js/status.js:13; js/reversoes.js:136-149; supabase/migrations/20261115151734_repouso_conta_o_atraso.sql:10-18 (every non-Cancelado row counts in the hours); R3, R8 S4 | "Já decolou" as a silent stay (the first version: a flight that never flew stayed Confirmado in the hours). Releasing the pin on a withdrawal (B) |
| 7 | **A read writes nothing. Edit profiles apply; one save through `gravarAlteracao`; one History entry per pedido, no revert. Only `aplicarConciliacao` changes `importadas` (and "Pôr de volta" admitting an approved id); `save()` and the other handlers never do.** Read-only profiles see the stored schedule and the notice as text. | Guardrail. The truth is the pedido's state on the server: a revert would be undone by the next conciliation. The bookkeeping (`acertos`) rides on a logged write, never on an unrelated edit. | js/actions.js:166-202, 288-317; js/reversoes.js:43-117 | A tenth revert kind. Acertos applied by any save (an invisible write with no History line) |
| 8 | **"Tirar da escala" stays `fly: false` on the record, with the revert `setFly`: an operator restriction of the date; the pedido stays approved. "Pôr de volta na escala" and the `setFly` revert turn a pedido's record on only while its pedido is approved and the date is today or later (`podeVoltarAEscala`).** | One write of the day, works offline, the place is kept, and every stored `setFly` entry keeps its button. | js/eventos/demanda.js:184-194; js/eventos/historico.js:53-61; H 2.4, 3 ("✕ … G: `fly: false`, with 'Pôr de volta'") | "✕ withdraws the approval": two writes that can half fail, and a pedido back to "aguardando" when the student did nothing |
| 9 | **Operator restrictions live on the record, in today's fields (`insId`, `pr`, `eq`, `nb`, `p1`, `p2`, `jan`, `etapa` + `cursoDaEtapa`, `fly`) plus one boolean, `etapaDoPrograma`. They are edited in G's panel "Restrições do voo": a page-level drawer `aside.gaveta#painel-restricoes`, opened by `data-act="restricoes"` (`data-id`, `data-mid`) from the Escala's Lista row, `#tl-pop`, each line of the red box, each Processamento line and detail, and (from H) `#restricoes-da-data`. It opens over the screen it is called from. Processamento itself has no input.** | The engine, the compaction, the booking, Sugestões and five revert kinds read those fields where they are; the panel is today's Demanda row laid out as lines, driven by the same handlers, so no field is ever left without a control (G deletes the Demanda in the same PR). One editor reached from both stages costs 2 actions per edit from either (2.13). | mapa-restricoes 5.6; js/eventos/registro.js:39-52 (the `data-k="d"` dispatch works on any element); js/eventos/demanda.js:101-273; index.html:667-682 (the drawers are page-level); H decisions 1, 2 and 2.1 (a)-(h); desenho-nucleo-a 2.5 | H1 before G (the first version): H no longer builds it, so G would have deleted the only controls of `pr`, `eq`, `nb`, the times, `insId` without a pin and the course mission. `aside#voo` (H 2.14, Pedro's alternative there). C's block in the Processamento detail (question 2). A `restricoes` store (B) |
| 10 | **Overridable: Instrutor, Prioridade, Tipo de recurso, Duração, Disponibilidade with 1ª and 2ª preferência, Missão do curso. A resource-type or duration change keeps the course mission. A type whose take-off list lacks the record's exact minute is refused. The course-mission writer never writes `fly`; it writes `mis` and `eq`, and `nb` only when `mis` changes or the mission has a fixed duration. The mission type alone is not overridable.** | Each has the pedido (or nothing) as its only other source. Without the course mission the flight has no result control. Today a type change and "Usar" silently delete the exact `jan` (R12) and "Usar" turns an off record on and replaces the pedido's hours. | js/eventos/demanda.js:94-99 (`usarMissaoDoCurso`: `fly: true`, `mis`, `eq`, `nb`), 245-264; js/horarios.js:83-93 (`ajustarPreferencias` deletes `jan`); js/agenda.js:71-74; H question 22; R12 | Dropping the course mission as the Demanda does. Today's silent adjustment (question 9). A type select |
| 11 | **Bookings are unchanged and create no pedido. "+ Pôr um aluno na demanda", "+ missão", the "✕" of an extra and the "Voa" switch end. A hand-made flight of the same mission still gives way to a pedido, and now keeps its priority as it keeps its instructor.** The operator's own additions become pedidos ("Registrar e aprovar"): after 13:00 they need the Exceção da Coordenação and are stored with `excecao`; a 7th local flight at the same 1st preference is refused (`PT422`), which the exception does not lift. | A booking decides more than a pedido holds and passes rules the server refuses. Without the give-way rule the cut-over dates would duplicate flights. The costs of "Registrar e aprovar" are D's rules, stated to Pedro (question 14). | js/agendamento.js:899-943; js/agenda.js:86-93, 129-133; docs/PLAN.md:421; desenho-pedidos decisions 5, 9, 2.3; mapa-pedidos 4 (20261114230012:30-48); js/eventos/demanda.js:33-48, 153-172 | A booking that registers a pedido (PT422 and the deadline against "Agendar mesmo assim"). Keeping "Pôr um aluno" (a second way into the day) |
| 12 | **The course mission is bound when the pedido enters (`missaoDaEntrada`), by time: another flight of the student counts as done only when it ends before this one starts. A closed course gives none. The binding keeps the programme's resource type and the pedido's exact minute; when that type's list lacks the minute, the line says so before the engine ("o pedido pediu 08:20; o PA-34 decola às 08:30") and Horário in the panel is the fix. G wires the Pedidos form's 1st-preference list and Duração to `missaoDaEntrada`, so new pedidos are registered at a time the bound type flies.** | Today the answer depends on the order of registration, the import binds a closed course silently, and an IFR pedido at 08:20 bound to a PA-34 mission is rejected `disponibilidade-do-aluno` every time with no word on why. | js/agenda.js:63-80, 119-127; js/progresso.js:144-149; js/agendamento.js:212-220; mapa-pedidos 5.3 (`{eq:'PA-34', p1:510, jan:'h500'}`); desenho-pedidos decision 20, 2.10; docs/PLAN.md:371, 418, 424; R6 | Today's rule (lacuna-2 2.4, 2.10). Snapping the minute to the type's list (a silent change of what was asked). Dropping the programme's type at entry |
| 13 | **`etapaDoPrograma: true` marks a record whose course mission the app bound. "Atualizar a escala" lists those whose mission the programme now gives differently and changes them, per student all or nothing, only when the resource type stays, never on a date before today and never on a flight of today whose pinned (or saved) start has passed.** Records without the mark (stored before, chosen by the operator, booked) are never changed. | The schedule of tomorrow is built after 13:00, before today's results exist. A flight already flown keeps the code its result will go to: results are append-only and a recorded code is locked in Cursos. | posicao A4; js/progresso.js:144-149; js/reversoes.js:121-125; lacuna-2-itens-abertos 411-414; R7, R11 | Recomputing on every read. C's `etapaEscolhida`. The walk without the clock (the first version rebound a flown flight: R11) |
| 14 | **Pure modules: `js/processamento.js` (the conciliation, the course mission, the stage's reading), `js/rejeicoes.js` (rejections paired with requests) and `js/restricoes.js` (the restriction writers and the per-record difference, G).** From E the import and D's approval handler run the conciliation (entries) and the booking dialog uses the pairing. | The unused-exports lint accepts an export the app imports, or one the module uses and a test imports. The pairing has no dependency on the pedidos, so the booking dialog does not load the conciliation. | scripts/exportacoes-sem-uso.mjs:128-143; js/agendamento.js:234-237, 1031-1034 | One module (the request's letter: section 7). The whole module in E with a throw-away caller |
| 15 | **Why a pedido cannot be scheduled: "Não cabe nem sozinho" is the engine on a copy with only that request flying and no pins; "Não coube na escala" is the engine's own rejection, found by position. Both run on the state the engine ran on, `estadoParaEscalar(S, { data, hoje })` (F3). A request that does not fit alone still goes to the engine. The engine and its alerts are not edited.** | The verdict cannot drift from the engine. Read on `S`, an inactive INVA would make "cabe" wrong and a student whose only "Priorizar com" is inactive would be ordered differently from the engine (`semVoaCom`), breaking the pairing. | js/engine.js:332-338; js/agendamento.js:142-143 (the mirror); desenho-cadastros D2, D3, 2.2 (`js/inativos.js`); lacuna-1-motivos 5; R4, R5 | A second rule set over js/candidatos.js. `fKey` on the alerts (174 golden alerts change) |
| 16 | **The pedidos of the open date are read beside the date, through D's cache (`js/solicitacoes-da-data.js`, `solicitacoesDaData()` → `{ data, lista, lidaEm, erro, diaMudou }`). No click and no hook writes against a day changed elsewhere: while `diaMudou` is true only D's notice "A escala desta data mudou em outro computador · Atualizar" shows, and "Atualizar a escala" re-reads the date first.** | The engine's input does not depend on that read. Without the version check a second Edit account on the same date turns a click into `PT409` and a locked screen. | desenho-pedidos decisions 14, 2.5, 2.8; js/backends/supabase.js:63-67; js/actions.js:138-145 | Accepting the lock (the first version). The pedidos read inside `lerData` |
| 17 | **"Limpar demanda" becomes "Recomeçar pelos pedidos": each approved pedido's record goes back, in place (same `mid`), to what the pedido gives (fresh course mission, no restrictions, key cleaned); records without a pedido leave; waiting or cancelled pedidos' flights leave; flights taken off stay off and `dispensados` stay; what decision 6 keeps or asks about is untouched; pedidos that had no record enter with numbers above every `mid` the date had; an approved schedule is reopened. Two clicks, no revert; not offered on a date before today nor while the results or the pedidos are unread.** | The operator uses it to restart a date. Deleting pedido records would hand their numbers to other pedidos re-entering in the same write, and old History entries would act on the wrong flight. | js/fixos.js:95-117; js/rules.js:67-72; js/eventos/historico.js:89-121; mapa-pedidos 5.1; docs/PLAN.md:437 | Today's clearing followed by a fresh entry (the first version: mids reused, exclusions undone). Removing it (A) |
| 18 | **Format 28 changes no data and ships as E's last commit, not G's. G carries one SQL migration: D's conversion run again with `p_dos_operadores = false`.** | 28 protects `etapaDoPrograma` and the ids that leave `importadas` from older tabs. With 28 in E, a revert of G's merge returns to a client at 28 that reads everything G wrote; with 28 in G, a revert after Pedro's opening makes every save fail with `PT409 formato`. The migration approves what an old tab imported between D's production push and G (rule a). | js/migracoes.js:176-213; supabase/migrations/20261114143242_formato_e_status_do_dia.sql:22-26, 73-76; js/storage.js:229-242; desenho-pedidos 2.9, 4; desenho-entrega 2.6 | 28 in G (desenho-entrega). "28 binds the requests to pedidos" (posicao B8). G with no SQL (the first version) |
| 19 | **Interim, with D's names: `solicitacaoAprovada` (the one predicate), `diaJaGravado()` (the one flag), `solicitacoesDaData()`. E is stacked on D and replaces `importarSolicitacoes` and D's `entrarNaDemanda` with the conciliation, keeping D's behaviour through the option `religar` (an approval made here turns an off record on, and brings back a held pedido with no record); G drops `religar`, so from G a re-approval brings back exactly what a withdrawal took and a flight the operator took off stays off.** | One predicate, one flag, one owner each. D's tests stay green through E; G's identity rule is what R10 checks. | desenho-pedidos 2.5, 2.10, decision 17; desenho-entrega 2.1 (E "rejoins on D"); R8 S1, S1b | `entraNaEscala` (a third name); E applying only `entram` (it would regress D's turn-on) |
| 20 | **The code lock of the Cursos tab keeps its reader (the open date's records and saved rows); only the text changes.** | The records still carry `etapa`. | js/views/cursos.js:56-73 | A server-side lock |
| 21 | **Hardening.** `juntar` takes only `CAMPOS_DO_PEDIDO` and `extra` from a stored main request; the module's records are tested to hold only those names and `mid`; `normalizeMissionFields` checks the type before converting. | A stored main request holding `id`, `nm` or `kg` replaces the roster's values; extras are stored whole. | js/dias.js:59-62, 96-101; lacuna-1-pedido-principal 2 rows 2-3; docs/PLAN.md:440 | Leaving it |
| 22 | **A pedido's exact minute is never loosened silently. The take-off times editor skips records that carry `solicitacao` (they keep `p1`, `p2`, `jan`) and its summary counts them as "fora da lista"; a type change or another course mission is refused when the record's exact `jan` is not in the new list.** | Today saving a list without a pedido's minute turns that flight into "Qualquer horário" on the open date only (other stored dates keep `jan` and are rejected), and nobody chose it. | js/horarios.js:83-93, 147-158; js/eventos/recursos.js:192-216; R12; H question 22 | Today's adjustment, labelled "ajustado pelos horários de decolagem" (question 9) |
| 23 | **A date before today receives nothing from the pedidos: no entry, no return, no exit, no "Trazer de volta", no "Pôr de volta" of a pedido's record, no course-mission change. Its approved pedidos that never entered read "Aprovado, não entrou nesta data", as information.** | A flight added to a flown schedule feeds the BI, the instructors' hours and the next date's copy; it may also double a flight that flew by hand. D refuses approvals there for the same reason. | desenho-pedidos decision 8; js/dias.js:127-137, 172-180; 20261115151734_repouso_conta_o_atraso.sql:10-18; R8 S3, R10 | The first version ("a pedido may still enter, by the click": R10's mutation run, 141 past-date changes) |
| 24 | **The Secretaria may cancel an approved pedido of today or later (D's rule). Her browser writes no day: the flight stays in the stored schedule and on the TV until an Edit profile clicks "Atualizar a escala"; the Edit profiles learn it within 60 s (the notice, the rail item, the card row). On the day of the flight the way is the flight's status Cancelado with its reason, as D's detail says.** | D allows it (one rule that exists today); refusing costs a call and four actions of the operator per cancellation. | desenho-pedidos decision 4, 2.3 (the toast "Avise o operador: o voo continua na escala até ele atualizar."), 2.8, question 8; posicao B3 | posicao B3 (she cannot): Pedro's alternative (question 8). An Operador's browser applying what it reads (a read that writes) |

### 1.4 Where this note differs from, or settles with, the sibling notes

| Sibling | It says | This note |
|---|---|---|
| desenho-escala-aprovar 2.1 (a)-(h) | G delivers the editor "Restrições do voo" and its contract | delivered by G as specified (2.5, "What H gets"). Two names differ: `rejeicoesDosPedidos` lives in `js/rejeicoes.js` (H imports it from there, not from js/processamento.js); H's `diferencaDosPedidos` is `conciliarPedidos` |
| desenho-escala-aprovar 2.4 | "Tirados da escala": `fly: false` on a record that carries an admitted pedido, a pin or a booking | records of approved, held pedidos, plus records without a pedido that still have a pin. A withdrawn pedido's record (id out) is not listed: its "Pôr de volta" would always refuse (`sem-aprovacao`) |
| desenho-escala-aprovar decision 9 | the armed text of "Aprovar escala" is fixed; the counts are a sentence beside the button | agreed: this note's first version ("H2 names what is pending in its confirmation") is dropped; `#aprovacao-pendencias` may carry the plan's counts |
| desenho-pedidos decisions 13, 14 | the five conditions; no write against a stale day | adopted (decisions 4, 16); `depoisDeMudarPedidos` is the hook D's handlers call from G on |
| desenho-pedidos 2.3, "From G on" | the reconciliation removes the record, except a flight with a status that pins it or with a result | the record stays with `fly: false`; the guards of decision 6 also keep Cancelado, a date before today and unread results, and ask about Atrasado and "já decolou" |
| desenho-pedidos 2.5, 2.10 | E replaces `importarSolicitacoes` and `entrarNaDemanda`; G deletes the "until G" functions | agreed; E keeps `religados` through `religar`, G ends it (decision 19). D's e2e "aprovar de novo o pedido tirado com o Voa religa o voo" holds until G and is rewritten in G |
| desenho-pedidos 2.9, conversion | rule (a) needs a record from today on; rule (b) skips held ids; G's migration runs it again with `false` | adopted: pedidos cleared before D stay waiting and held, and approving them gives `dispensado` (decision 3). G ships the migration (section 4) |
| desenho-pedidos decision 20, 2.10 | E decides a time outside the bound type's list; G wires the form to `missaoDaEntrada` | decided in decision 12; the function takes D's name |
| desenho-pedidos decision 4 vs posicao B3 and desenho-entrega 4 (D's migration "refuses the Secretaria on an approved pedido") | she may cancel / she may not | D's rule (decision 24); desenho-entrega's migration row must follow D |
| desenho-entrega 2.1, 4 (format table) | 28 in G: "each request bound to its pedido"; G has no SQL | 28 is a no-op in E's last commit (after E rejoins on D); G has D's conversion again as a migration (decision 18) |
| desenho-entrega 2.6, G go-live step 2 | "no pedido listed in a day's `importadas` is unapproved" | cannot hold (held waiting pedidos exist by design); replaced by the check of section 4 |
| desenho-entrega 2.2 c, d (F0b) | `entraNaEscala` in js/agenda.js; `pedidoDaSolicitacao` and `disponibilidadeDaSolicitacao` move to js/processamento.js; `aoReverter('setFly')` to js/eventos/demanda.js | no `entraNaEscala` (D's `solicitacaoAprovada`); the two mapping functions stay in js/agenda.js (D edits them); `vooQueDaLugar` moves unexported |
| desenho-entrega 5, row G | "js/eventos/escala.js (takes rm-fly)" | `rm-fly`, `por-de-volta`, `usar-proxima`, `usar-fora-da-ordem`, the field handler and `aoReverter('setFly')` go to the panel's `js/eventos/restricoes.js`, in the commit that deletes js/eventos/demanda.js |
| desenho-cadastros D2, D3 | the engine reads `estadoParaEscalar`; an inactive student's flights keep flying, listed | adopted (decision 15; 2.6 note `aluno-inativo-com-voo`); posicao B5's "engine without the inactive" is superseded there |

## 2. How it works (data shapes with field names, function signatures, screen structure, states: enough for an implementer)

### 2.1 What is stored

```
dia:<data>
  pedidos:    { "<stuId>": { fly, mis, eq, p1, p2, nb, ss, pr, jan?, etapa?, cursoDaEtapa?, etapaDoPrograma?, solicitacao?, insId?,
                             extra: [ { mid, …os mesmos campos } ] } }          (igual, mais etapaDoPrograma)
  importadas: [ <id do pedido>… ]     os pedidos que a data recebeu e mantém (decision 3)
  fixos, fStatus, fObs, aprovacao, resultado, win, av, ins, horas, filas, hangar, criterios        (iguais)
memória:
  solicitacoesDaData() → { data, lista, lidaEm, erro, diaMudou }   (js/solicitacoes-da-data.js, de D; as linhas trazem aprovada_em e aprovacao_retirada_em)
  diaJaGravado() → boolean                                          (js/actions.js, de D)
  estadoParaEscalar(S, { data, hoje })                              (js/inativos.js, de F3)
```

| Origin of a record (derived, never stored) | Recognised by | Created by | Leaves by |
|---|---|---|---|
| pedido | `solicitacao: <id>` | the conciliation | never deleted; `fly: false` by the conciliation or "Tirar da escala"; reset in place by "Recomeçar pelos pedidos" |
| agendado | no `solicitacao`, pin with `agendado` | `#dlg-agendar` | "↶ Desfazer" (refused once a pedido took the record); "Tirar da escala"; deleted by "Recomeçar pelos pedidos" |
| sem pedido | neither (stored before G; a booking whose pin was released) | nothing after G | "Tirar da escala"; a pedido of the same mission takes its place; deleted by "Recomeçar pelos pedidos" |

`etapaDoPrograma`: only `true` is stored, with or without `etapa` (without: the programme had none for it yet, or the
results were unread). Set by the conciliation when it creates a record, by its bulk change, by "Usar a do programa" and
by "Recomeçar". Removed by any choice of a mission in the panel, by `aplicarAgendamento` when it creates a flight, by
`deixarEmBranco`, and when the entering pedido takes over a mission the operator had chosen.

### 2.2 Identity of a request (question 1)

| Moment | What happens to `(stuId, mid)` |
|---|---|
| The pedido enters | a flying record of the same mission with no pedido, pin, pinning status or result gives way and keeps its `mid`, `insId` and `pr`; else `alvoDoNovoPedido`: the main request (mid 0) when it does not fly, its key has no leftovers and it carries no `solicitacao`; else a new extra, `proximoMid` |
| Load and save | `mid` is stored in the extra (0 is the student); `separar` and `juntar` round-trip it |
| "Tirar da escala", approval withdrawn | `fly: false` on the same record; same key; the pin sleeps while it lasts (decision 6) |
| Pedido cancelled | `fly: false`; the key is cleaned; the record stays, so the number is never handed out again |
| Approved again after a withdrawal | the same record is turned on (`voltam`): same key, restrictions and, if it lasted, pin |
| A booking for the same student | same allocator, same number space; it never takes a main request that carries a pedido |
| "↶ Desfazer" of a booking whose record a pedido took | refused: "Este voo agora é de um pedido aprovado: desfazer o tiraria da escala." (the record carries a `solicitacao` that `criadoComo` lacks; for an entry without `criadoComo`, a created flight left none) |
| "Recomeçar pelos pedidos" | the pedido's record is reset in place (same `mid`); records without a pedido are deleted; a pedido with no record enters as an extra whose `mid` is above every `mid` the student had on the date before the restart (never mid 0) |
| Bounds | 0, or 1 + the largest of the student in the day; the module's tests assert positive integers up to 999,999, unique per student, also with a 13-digit pedido id, which is stored only in `solicitacao` and `importadas` |

### 2.3 The conciliation (question 4)

```js
// js/processamento.js — sem DOM, sem relógio, sem rede, sem S
export function conciliarPedidos(estado, solicitacoes, { data, hoje, agora, aprovada, so = null, religar = false, cursos = null } = {})
// → o plano; não muda nada. aprovada é obrigatório (sem ele: Error); o app passa solicitacaoAprovada (D)
//   so: só estes ids (a ação feita agora neste navegador); religar: só em E (decision 19); cursos: { programa, situacao } | null
export function aplicarConciliacao(estado, plano, { cursos = null, solicitacoes = [], escala = null, pisoDosMids = null } = {})
// → { entraram: [{ id, stuId, mid, novo, etapa, nota }], voltaram, sairam, trocadas, historico: [[tipo, texto]…] }
//   muda estado.stu, estado.importadas e, na saída por cancelamento, fixos, fStatus e fObs da chave. Único escritor de importadas
```

**A date before today** (`data < hoje`): the plan holds only information: `naoEntrou` (approved, student in the cadastro,
no record), and `ficam` with `porque: 'data-passada'` for a cancelled or withdrawn pedido whose record flies. `pendente`
is false; `depoisDeMudarPedidos` returns at once; nothing is applied (decision 23).

**From today on**, for each row of the date, with `r` = the record whose `solicitacao` is its id:

| The pedido is | `r` | Held | List of the plan | Applied by "Atualizar a escala" or the hook |
|---|---|---|---|---|
| approved | none | no | `entram` (sorted by student, the pedido's minute, the id) | creates the record (2.2), binds the course mission (2.4), adds the id |
| approved | none | yes | `dispensados` | nothing. "Trazer de volta" takes the id out of the list and it enters |
| approved, student not in the cadastro, or inactive | none | any | `semAluno`, `inativos` | nothing; not held (as js/agenda.js:113-115; desenho-cadastros 2.4) |
| approved | flies | yes | (in the schedule) | nothing |
| approved | flies | no | `acertos.admitir` | the id is added (bookkeeping, no History line) |
| approved | `fly: false` | yes | (taken off by the operator: line `fora-pelo-operador`) | nothing; "Pôr de volta na escala" |
| approved | `fly: false` | no | `voltam` | `fly = true`; the id is added. Nothing else of the record changes |
| cancelled | flies | any | `saem` (`motivo: 'cancelado'`), or `ficam` / `conferir` with `porque` | `fly = false`; `fixos`, `fStatus`, `fObs` of the key deleted; the id removed |
| cancelled | none or `fly: false` | yes | `acertos.esquecer` | the id is removed (bookkeeping) |
| waiting, with a withdrawal (`aprovacao_retirada_em`) | flies | any | `saem` (`motivo: 'sem-aprovacao'`), or `ficam` / `conferir` | `fly = false`; the id removed; the pin sleeps |
| waiting, no withdrawal | flies | any | `semAprovacao` (`ficam` when guarded) | nothing; listed with "Aprovar pedido" and "Tirar da escala" |
| waiting | none or `fly: false` | any | none | nothing: the id stays as it is |
| a record whose `solicitacao` is in no row read | | | none | never touched: missing data is not a cancellation |
| a record without `solicitacao` | | | none | never touched, except the one that gives way to an entering pedido |

`religar` (E only, with `so`): an approved pedido of `so` whose record is off and held goes to `voltam`; one with no
record and held goes to `entram`. This is D's `entrarNaDemanda`; G removes the option.

`ficaNaEscala(estado, { data, hoje, agora }, stuId, mid)` answers, in this order: `'data-passada'`; `'sem-os-resultados'`
(`estado.indisponiveis` has `resultados`); `'atrasado'`; `'em-voo-ou-pousou'`; `'cancelado-na-escala'`; `'com-resultado'`
(`resultadoDoVoo(doDia, fKey)`); `'ja-decolou'` (`data === hoje`, the key has a pin and `intervaloEfetivo(pino, status,
fObs[fKey]).a <= agora`); else `null`. `'atrasado'` and `'ja-decolou'` go to `conferir`, the others to `ficam`. The plan
also carries `missoes` (2.4; only when `so` is null and `cursos` is given) and `pendente = entram + voltam + saem + missoes
> 0`. `conferir` and the `acertos` never make `pendente` true: the click would not change them.

`estado` given to `conciliarPedidos` is `S` (the stored records); every engine run inside the module uses
`estadoParaEscalar(S, { data, hoje })`.

| Question | Answer |
|---|---|
| When is the plan computed | whenever D's cache reads the open date's pedidos (a date opens, every 60 s, on return to the page, after this browser's own actions, "Tentar de novo"), and before "Aprovar escala" |
| Who applies it, by hand | Edit profiles (local mode: not the Gestor). `atualizarAEscala()`: refuses before the date is read; asks `ApiClient.diaMudou(DATA)` and, when true, runs `carregarData(DATA)` and writes nothing this time (the notice then shows the plan of the day as it is now, and a second click applies it); otherwise reads the cache again (`lerSolicitacoesDaData()`), drops everything if `DATA` changed meanwhile (js/eventos/agenda.js:33-47), computes the plan again and applies that one. Unread results do not block it: entries take no course mission (`nota: 'sem-dados'`, with the mark) and nothing leaves ('sem-os-resultados'); the next click after the read binds them (2.4) |
| When it applies by itself | `depoisDeMudarPedidos({ ids })` (G, js/eventos/processamento.js), called by D's handlers after "Registrar e aprovar", "Aprovar pedido", "Aprovar todos (N)", "Retirar aprovação" and "Cancelar pedido": when D's five conditions hold and the profile edits, it applies the plan with `so: ids`. Otherwise it writes nothing: the notice shows it |
| What is saved | `dia:<data>` once: `gravarAlteracao(tipo, texto)` for the first History entry, `logChange` for the others of the same event (js/eventos/agendamento.js:36-38). The schedule is recomputed |
| History, prefix "Pedidos:" (D's) | `inc` "Pedidos: <aluno> entrou na escala (<missão> · <disponibilidade> · <N h>[ · <código>])[ (escala aprovada)]"; `inc` "Pedidos: <aluno> voltou à escala (<missão>)"; `inc` "Pedidos: <aluno> trazido de volta à escala (<missão>)"; `exc` "Pedidos: <aluno> saiu da escala, pedido cancelado (<missão>[ · estava às HH:MM–HH:MM no <recurso> com <instrutor>][ · deixa de ser fixo])"; `exc` "Pedidos: <aluno> saiu da escala, aprovação retirada (…)"; `mod` "Pedidos: missão do curso de <aluno>: PE-03 → PE-04 (o programa andou)"; `exc` "Pedidos: escala recomeçada (14 voltaram ao pedido, 3 sem pedido saíram, 2 ficam, 1 continua fora, 2 entraram)[ e escala reaberta]". Names only, no personal data, no Observação. No revert. The acertos write no line |
| Toasts (this browser) | one approval, started date: "Pedido aprovado: <aluno> na escala às 10:10 (PR-VOB)." / "Pedido aprovado: <aluno> não coube na escala (<motivo curto>)."; date not started or a condition missing: "Pedido aprovado. A escala de sex 20/11 ainda não começou: ele entra com Atualizar a escala." / "Pedido aprovado. A escala desta data mudou em outro computador: atualize antes."; "Aprovar todos (N)": "3 pedidos aprovados: 2 na escala, 1 não coube (sem instrutor livre)[; 1 tirado desta data antes (Trazer de volta em Processamento)]"; cancellation applied: "Pedido cancelado: <aluno> saiu da escala." / "Pedido cancelado; o voo de <aluno> fica na escala (já pousou)." / "Pedido cancelado; o horário do voo de <aluno> já passou: marque Pousou ou Cancelado na Escala."; withdrawal applied: "Aprovação retirada: <aluno> saiu da escala (o lugar fica guardado)." A student who already has a booked flight of the same mission: "· já tem voo agendado de <missão> às 08:20" is appended |
| Read-only profile | the stored schedule, never a recomputed one, and the notice as text: "2 pedidos aprovados ainda não estão na escala · 1 cancelado ainda está: um Operador atualiza a escala." |
| Approved schedule | an entering pedido is placed around the pins and is not pinned (H's "Fixar os N voos novos"); a leaving flight stops flying; `aprovacao` stays. The entry ends with "(escala aprovada)" |
| Flight in progress, landed, cancelled with its reason, or with a result, whose pedido is cancelled or withdrawn | `ficam`: stays whole; muted line "Pedido cancelado por <quem>; o voo já pousou: fica" (one text per `porque`); not pending |
| Flight Atrasado, or today pinned and past its start with no status | `conferir`: stays; attention line "Pedido cancelado e o horário do voo já passou: marque Pousou ou Cancelado · Abrir o voo" ("… o voo está Atrasado: marque Cancelado ou deixe voar"); counted in the notice and the card row until a status or a result exists |
| Date before today | the information lists above; no button, no hook, no pending count |
| Two operators (two Edit accounts on one date) | D's 60 s read asks `diaMudou`; while true `#proc-aviso` shows only D's notice 2 ("A escala desta data mudou em outro computador · Atualizar", `carregarData(DATA)`), the hook writes nothing and "Atualizar a escala" re-reads first. A `PT409` remains possible inside the 60 s window (both writing at once), as for any edit today. Applying twice equals once (R10) |
| The Secretaria | she registers, and cancels waiting or approved pedidos of today or later (D's decision 4); her browser writes no day. An approved pedido she cancels keeps its flight in the stored schedule and on the TV until an Edit profile clicks "Atualizar a escala" (the hook applies only the pedidos acted on in that browser). The line, the rail item and the card row name who cancelled. A mistaken cancellation costs the flight its place: a new pedido gets a new record |
| The read failed | "Não foi possível ler os pedidos desta data: a escala fica como está. · Tentar de novo"; no button to apply |

The notice for an Edit profile (`#proc-aviso`, and in Pedidos' `#agenda-aviso` from G): "12 pedidos aprovados fora da
escala · 1 cancelado ainda na escala · 3 missões do curso para trocar", with "Atualizar a escala"
(`data-act="atualizar-escala"`); on a second line "1 voo para conferir: pedido cancelado e o horário já passou · Abrir o
voo"; on a date with no day: "Esta data ainda não tem escala: Atualizar a escala a começa." While `diaMudou`: only D's
notice 2. D's notice 2 always wins over this one.

### 2.4 The course mission (question 5)

| Case | Rule |
|---|---|
| When it is bound | when the record is created, by `missaoDaEntrada(estado, aluno, solicitacao, { cursos, solicitacoes, exceto })` → `{ missao, curso, nota }` (exported for the tests and, from G, for the Pedidos form) |
| Which | the first released or conditional mission of the student's course whose type is the pedido's (`proximasMissoes(…).candidatas.find(m => m.mis === missao)`); its `eq`, when valid for the type, becomes the resource; the pedido's hours win (js/agenda.js:71-74) |
| Time outside the bound type's list | the record keeps the programme's `eq` and the pedido's exact `jan`; `nota: 'horario-fora-da-lista'`; the Processamento line reads "o pedido pediu 08:20; o PA-34 decola às 08:30, 09:00, …" (situation `nao-cabe-sozinho`, which the engine confirms); the fix is Horário in the panel, or "Encaixar…" |
| The student's other flights of the date | all that fly and are not cancelled are not offered again (`exceto`); one counts as done (`planejadas`) only when it ends at or before this pedido's 1st preference. `horarioPedido`: the pin; else the exact `jan`; else the 1st preference of its pedido row; else unknown, and then it counts as done (today's rule) |
| Pedidos that enter together | bound in the order of their times |
| AV PROF. SOLO and SOLO (docs/PLAN.md:418) | "Voo Solo" 06:30 and "Voo Local" 08:20 on one date, in any order: the 08:20 flight gets AVP-SOLO-01 and the solo none, with the note "o programa pede antes AVP-SOLO-01, que está no voo das 08:20" (R6) |
| No mission | the pedido enters as it came, with `nota`: `sem-curso`, `sem-programa`, `sem-dados` (results or programmes not read), `curso-encerrado`, `sem-missao-do-tipo` ("o programa pede TMA-01 (Voo Local)") |
| Closed course (docs/PLAN.md:424) | none at entry; in the panel, "Missão do curso › Trocar…" lists "Liberadas no <sigla> (curso encerrado: pede confirmação)" and arms "Confirmar: <código> do curso encerrado"; History "…, com o curso <sigla> encerrado" (texts and two-step confirmation moved from js/views/etapas.js:98-131 and js/eventos/demanda.js:109-151) |
| Out of order | never at entry; in the panel, group "Fora da ordem (pede confirmação)", armed "Confirmar: <código> fora da ordem", the reason in the History |
| The flight that gave way had a mission the operator chose | it keeps it, without the mark (test/unit/agenda.test.js:296) |
| What the programme gives now | `missoesDoCursoDoDia(estado, aluno, { cursos, solicitacoes, data, hoje, agora, escala })` → `Map<mid, { atual, doPrograma, segue, trocavel }>`, empty on a date before today. A flight does not follow when it has no mark, a result, a status Atrasado, Em Voo or Pousou, a booked pin, or (today) a pinned or saved start at or before `agora`; it keeps its mission and counts for the others |
| What shows | same as bound: "PE-03 · do programa". Different: "PE-03 já aprovada em 20/11: o programa agora dá PE-04" (attention). A flight that already started: "o programa agora daria PE-01: confira antes de registrar o resultado" (attention, never changed). None bound and one exists: "o programa daria PE-03". No mark: "PE-07", and "fora da ordem: falta PE-04" as information. With a result: "PE-03 · Aprovado" |
| "Atualizar a escala" and the missions | `plano.missoes` = per student, the flights where `segue` and `doPrograma` differs from `atual`; applied only when every one of that student's is `trocavel` (same resource type). It writes `etapa` and `cursoDaEtapa`; nothing else. The others are listed with "Restrições" |
| A mission asked for a later date (docs/PLAN.md:421) | still suggested: only the same date counts; the walk corrects it once the result exists |
| The code lock of Cursos (docs/PLAN.md:404, 431) | `codigosDaDemanda` (js/views/cursos.js:56-68) keeps its reader; `codigoNaDemanda` becomes `codigoNosVoos`, text "nos voos de amanhã (Maria e João)" |
| A booked flight whose mission, resource or hours change (docs/PLAN.md:422) | `fixosSemOAgendadoQueMudou(fixos, fStatus, fKey, antes, depois)` in js/fixos.js: the booked pin is released only when `mis`, `eq` or `nb` really change, whoever changes them. The clause "Usar releases it even when the mission is the same" ends |

### 2.5 The pure modules (question 6)

**`js/rejeicoes.js`** (step E)

| Export | Input → output | Reuses |
|---|---|---|
| `naOrdemDoMotor(estado, voos)` | moved unchanged from js/agendamento.js:132-155 | js/voo.js, js/rules.js |
| `rejeicoesDosPedidos(estado, resultado)` | → `Map<fKey, { codigo, m, s }>` (the alert's own fields): the flying requests whose key is not in `resultado.out`, in engine order, paired one to one with `resultado.al.filter(a => a.t === 'err')`. `estado` is the state the engine ran on (`estadoParaEscalar`). When the counts or one label differ (a saved schedule older than the state), only the labels that appear once on both sides are paired | `naOrdemDoMotor`, `chaveDoVoo` |

**`js/conflitos.js`** (no import, the TV loads it): `FORA_DA_ESCALA`, the 21 short texts moved and exported from
js/agendamento.js:223-232 (E); `ONDE_RESOLVER`, code → `{ tela, item?, rotulo }`, the table of 2.6 (G).

**`js/processamento.js`**

| Export | Step | Input → output | Reuses |
|---|---|---|---|
| `importarSolicitacoes` (exported), `vooQueDaLugar` (module-private, not exported: the lint refuses an export only its module uses) | F0 (moved as they are, with their 21 tests); deleted in E (`vooQueDaLugar` stays private) | | |
| `conciliarPedidos`, `aplicarConciliacao` | E | 2.3. In E the callers apply `entram` and `voltam` (with `religar` for D's approval handler); no exits are applied before G | `pedidoDaSolicitacao`, `preferenciasDaSolicitacao` (js/agenda.js, D); `alvoDoNovoPedido`, `migrateLegacyMissionName`, `duracaoFixaDaMissao`, `isGroundMission` (js/rules.js); `fixoPeloStatus`; `resultadoDoVoo`; `STATUS_EM_ANDAMENTO`, `intervaloEfetivo`; `chaveDoVoo` |
| `ficaNaEscala`, `horarioPedido`, `missaoDaEntrada` | E (used by the module, imported by the tests; `missaoDaEntrada` imported by js/views/agenda.js from G) | 2.3, 2.4 | `indiceDoPrograma`; `proximasMissoes`; `situacaoPorMissao`; `paraMinuto` |
| `missoesDoCursoDoDia` | G | 2.4 | the same, plus `estadoDoAluno`, `motivoDoBloqueio`, `rotuloDaMissao` |
| `cabeSozinho(estado, { stuId, mid }, motor = runAllocationEngine)` | G | `estado` = `estadoParaEscalar(S, …)`; → `{ cabe: true }` or `{ cabe: false, codigo, m }`, with `codigo: 'horario-fora-da-lista'` and the list of times when the record's exact `jan` is not in its type's list. The copy has every other request with `fly: false` and `fixos: {}`; `fStatus`, `fObs` and `noturnosDaVespera` stay | js/engine.js, `horariosDaMissao` |
| `podeVoltarAEscala(estado, solicitacoes, stuId, mid, aprovada, { data, hoje })` | G | → `{ ok: true, admitir? }` or `{ ok: false, motivo: 'pedido-cancelado' \| 'sem-aprovacao' \| 'pedidos-nao-lidos' \| 'data-passada' }` | |
| `recomecarPelosPedidos(estado, solicitacoes, ambiente, { aprovada, cursos })` | G | decision 17 → `{ voltaramAoPedido, sairamSemPedido, ficam, continuamFora, entraram, reaberta }` | `deixarEmBranco`, `fixosAoReabrir`, `aplicarConciliacao` with `pisoDosMids` |
| `quadroDoProcessamento(estado, solicitacoes, resultado, ambiente, { cursos, motor })` | G | → `{ plano, linhas, contagens }` (2.10), memoised per `resultado` | everything above; `ocupacaoDaEscala`, `avioesQueServem`, `instrutoresQueServem`, `problemaDoAluno` (js/candidatos.js); `descreverExigencias`; `doesGroundGateFlight`; `voosComInativos` (F3) |

**`js/restricoes.js`** (step G)

| Export | Input → output |
|---|---|
| `aplicarRestricao(estado, resultado, { stuId, mid }, campo, valor)` | `campo`: `insId`, `pr`, `eq`, `nb`, `jan`, `p1`, `p2`, `missaoDoCurso`; → `{ ok: true, antes, depois, soltou, reverter }` (`reverter` only for `insId`: `restaurarEscolha`) or `{ ok: false, motivo: 'horario-fora-da-lista', texto }`. `eq` keeps `etapa` and adjusts `p1`, `p2` with `ajustarPreferencias` only when `jan` is not an exact time outside the new list (else refused: "O PA-34 não decola às 10:10, o horário do pedido: mude o Horário ou use Encaixar…"). `missaoDoCurso` (`{ codigo, curso, confirmado, doPrograma }`) writes `etapa`, `cursoDaEtapa`, `mis`, `eq` (when valid), `nb` only when `mis` changes or the mission has a fixed duration, sets or removes `etapaDoPrograma`, never `fly`; refused like `eq`. The booked pin follows `fixosSemOAgendadoQueMudou` |
| `restricoesDoVoo(estado, aluno, registro, { solicitacoes, cursos })` | → `[{ campo, rotulo, valor, doPedido }]`: what differs from `pedidoDaSolicitacao(linha, …)` with the programme's mission (`campo` in `eq`, `nb`, `jan`, `p1`, `p2`, `etapa`), plus `pr !== 3`, `insId`, `fly: false`; `null` when the pedidos are unread. H wraps it as `doRegistro(aluno, registro)` |

How it stays in real use: from E, `js/eventos/importacao.js` (`importarDaAgenda`) and D's approval handler call
`conciliarPedidos` and `aplicarConciliacao`; `js/agendamento.js` calls `rejeicoesDosPedidos` in `motivoDeFora` and
`FORA_DA_ESCALA`, and `simularAgendamento` returns `rejeicoes: rejeicoesDosPedidos(copia, sim)` so `motivoDaSaida`
reads the flight's own reason. From G every export has a caller in `js/eventos/processamento.js`,
`js/views/processamento.js`, `js/eventos/restricoes.js`, `js/views/restricoes.js` or `js/views/agenda.js`.

**What H gets from G (desenho-escala-aprovar 2.1):** (a) the panel, `data-act="restricoes"` with `data-id` and
`data-mid`, and `data-act="por-de-volta"`; (b) `p:<stuId>:<mid>` in `contextoInicial` (js/agendamento.js:78-104) for
"Encaixar…" and "Mover…"; (c) `restricoesDoVoo` items `{ campo, rotulo, valor, doPedido }`; (d) the plan of
`conciliarPedidos` and `cabeSozinho`; (e) `FORA_DA_ESCALA` (E) and `ONDE_RESOLVER` (G) in js/conflitos.js; (f) each line
of the red box is `li[data-fkey="<fKey>"]` with "Encaixar…" and "Restrições"; (g) D's cache (`lidaEm`, `erro`); (h) the
texts that name the Demanda rewritten (section 5, G).

### 2.6 Why a pedido cannot be scheduled (question 7)

| `situacao` of a line | Decided by | Icon | Third line of the row, and the row's one action |
|---|---|---|---|
| `na-escala` | its key is in `resultado.out` | done; attention with `conflito` | "Na escala 10:10–11:10 · PR-VOB · Instrutor 02"; "Em conflito: …"; "Restrições" |
| `nao-cabe-sozinho` | flies, not in `out`, `cabeSozinho` false | failed | "Não cabe nem sozinho: <texto do motor>" or "o pedido pediu 08:20; o PA-34 decola às 08:30, …"; "Restrições" |
| `nao-coube` | flies, not in `out`, fits alone; reason from `rejeicoesDosPedidos` | failed | "Não coube na escala: <FORA_DA_ESCALA[codigo]>"; "Restrições" (the detail also offers "Encaixar…") |
| `fora-pelo-operador` | approved, held, `fly: false`; or a record without a pedido, off, with a pin | pending | "Fora da escala nesta data, pelo operador"; "Pôr de volta na escala" (`data-act="por-de-volta"`) |
| `para-entrar` | in `plano.entram` or `voltam` | pending | "Aprovado: entra com Atualizar a escala" (the mission and `cabeSozinho` computed on a copy with the plan applied: "… e não caberia nem sozinho: <curto>") |
| `para-sair` | `plano.saem` | attention | "Pedido cancelado por <quem>: sai com Atualizar a escala" / "Aprovação retirada por <quem>: sai com …" |
| `conferir` | `plano.conferir` | attention | "Pedido cancelado e o horário do voo já passou: marque Pousou ou Cancelado"; "Abrir o voo" (to the Escala row) |
| `fica` | `plano.ficam` | muted | "Pedido cancelado; o voo já pousou: fica" (one text per `porque`) |
| `sem-aprovacao` | `plano.semAprovacao` | attention | "Na escala sem aprovação"; "Aprovar pedido" (D's `data-act="aprovar-pedido"`); "Tirar da escala" in the detail |
| `dispensado` | `plano.dispensados` | muted | "Aprovado, tirado desta data antes"; "Trazer de volta" (`data-act="trazer-pedido"`) |
| `nao-entrou` | `plano.naoEntrou` (date before today) | muted | "Aprovado, não entrou nesta data"; none |
| `aguardando`, `cancelado` | the pedido's state, no flying record | muted | "Aguardando aprovação" (Edit: "Aprovar"); "Cancelado por <quem>" |
| `sem-aluno`, `inativo` | `plano.semAluno`, `plano.inativos` | failed | "O aluno não está no cadastro: entra depois de cadastrado"; "Aluno inativo: o pedido entra quando ele voltar a ativo" |

Notes added to any line (attention, never a verdict): `aluno-inativo-com-voo` "Aluno inativo com voo nesta data"
(`voosComInativos`, desenho-cadastros D6: his record keeps flying, nothing is written); `duplicado-agendado` "<aluno> já
tem um voo agendado de <missão> às 08:20 nesta data" (a flying record without `solicitacao`, same student and `mis`, booked
pin); "depende do Ground C152 do mesmo dia" (`doesGroundGateFlight`); "Priorizar com: Instrutor 03 fora nesta data" (the
three static tests of `motivoSemPar`, js/engine.js:246-250, on the engine's state); the course notes of 2.4.
`cabeSozinho` errs towards "cabe"; the Escala's rejection is the final word.

| Engine code | `ONDE_RESOLVER` |
|---|---|
| `instrutor-escolhido` | Restrições do voo › Instrutor |
| `sem-horario`, `disponibilidade-do-aluno`, `horario-fora-da-lista` (pre-engine) | Restrições do voo › Horário, or "Encaixar…"; the date's closed periods; the category's take-off times |
| `sem-aviao`, `so-parafuso`, `revisao`, `habilitacao-do-aviao` | Recursos (this date: Disponível, the hours to the inspection; the requirement); Restrições do voo › Tipo de recurso |
| `sem-instrutor-habilitado`, `instrutores-indisponiveis`, `limite-da-lei` | INVAs (this date: Vem and the availability; cadastro: habilitações) |
| `bloqueio`, `peso` | Alunos (Não escalar com; peso) |
| `ground-pendente`, `depois-do-ground`, `ground-antes-do-voo-fixo` | the student's Ground of the same date (its line) |
| `aluno-ocupado`, `avioes-ocupados`, `sala-ocupada`, `instrutores-ocupados`, `limite-de-locais` | Escala › "Encaixar…" |
| `equipamento-da-missao` | cannot be produced by the app's writers (lacuna-1-motivos 4.1) |

### 2.7 The operator restrictions and the panel (question 2)

| Restriction | Stored field | Edited | History | Revert |
|---|---|---|---|---|
| Chosen instructor | `insId`; on a placed flight also the pin with `escolhido` | panel › Instrutor ("Automático" or "Automático (prioriza …)"); the name on the Escala row | "Voo <aluno>: instrutor <nome> \| automático (<missão>)" | `restaurarEscolha` |
| Priority | `pr` (3 = none) | panel › Prioridade | "Prioridade de <aluno> (<missão>): 3 → 5" | none |
| Another resource type | `eq` (`p1`, `p2` adjusted within the new list; `etapa` kept; refused with an exact minute the list lacks) | panel › Tipo de recurso | "Tipo de recurso de <aluno> (<missão>): C152 → C172[ (deixa de ser fixo)]" | none |
| Another duration | `nb` (`etapa` kept) | panel › Duração, 0.1 to 5 h (off for Ground and Noturno); "Mover…" | "Duração de <aluno> (<missão>): 1 h → 1,5 h (o pedido pede 1 h)[ (deixa de ser fixo)]" | none |
| Another course mission | `etapa`, `cursoDaEtapa`, no `etapaDoPrograma`; `mis`, `eq`; `nb` per decision 10 | panel › Missão do curso › "Trocar…", with the two-step confirmation (the option names the type when it differs); "Usar a do programa" puts the mark back | "<aluno>: <código> no voo (<missão> · <recurso> · <duração>[; era <missão>])[, fora da ordem (<motivo>)][, com o curso <sigla> encerrado][ (deixa de ser fixo)]" | none |
| A loosened time | `jan` removed or `manha`, `tarde`, `noite`; `p1`, `p2` | panel › Horário: Disponibilidade ("Só às HH:MM (o pedido)", "Manhã", "Tarde", "Noite", "Qualquer horário"), 1ª and 2ª preferência | "Horário de <aluno> (<missão>): disponibilidade <rótulo>" / "1ª preferência 10:10 → 11:30" | none |
| A moved flight | `eq`, `nb`, `p1`, `p2 = -1`, `insId`, `jan` removed when it excludes the time; pin `agendado` | `#dlg-agendar`: "Mover…", "Encaixar…" | as today | `desfazerAgendamento` |
| Exclusion | `fly: false` (the id stays held) | "✕" on the Escala row and `#tl-pop`, and "Tirar da escala" in the panel (`data-act="rm-fly"`); back: "Pôr de volta na escala" (`data-act="por-de-volta"`) in the panel and on the Processamento line, or the History's "↶ Restaurar" | "Tirado da escala: <aluno> (<missão> · <recurso>)"; "De volta à escala: <aluno> (<missão>)" | `setFly` |
| Fixed flights, approval, status | `fixos`, `aprovacao`, `fStatus`, `fObs` | unchanged | unchanged | unchanged |

**The panel "Restrições do voo"** (G): `aside.gaveta#painel-restricoes[aria-labelledby="painel-restricoes-titulo"]`,
beside `#painel-reparo` (index.html:682), opened by `abrirGaveta` (js/dom.js:42-59), to the left of a docked rail
(desenho-casca D26), over the screen it is called from; clicking another flight's "Restrições" replaces its content.
Title "<aluno> · <missão>[ · <código>]"; first line "Situação": the line of 2.6 for that flight, recomputed at every
redraw. Body `div[data-k="d"][data-id][data-mid]`, so `aoMudarCampo('d', …)` and the `data-act` handlers work as on
today's row:

| Line | Control | Field | Handler, moved from |
|---|---|---|---|
| Missão do curso | `span.etapa`; "Usar a do programa" `button[data-act="usar-proxima"]`; "Trocar…" `select[data-f="outra-missao"]`; the armed `button[data-act="usar-fora-da-ordem"]` | `etapa`, `cursoDaEtapa`, `etapaDoPrograma` (`mis`, `eq`, `nb` per decision 10) | js/eventos/demanda.js:101-151, through `aplicarRestricao(…, 'missaoDoCurso')`; views js/views/etapas.js:36-144 (`etapaNaDemanda` renamed `etapaNoVoo`) |
| Tipo de recurso | `select[data-f="eq"]` (off for Ground) | `eq` | :244-264 |
| Instrutor | `select[data-f="insId"]` (`instrutoresDoPedido`) | `insId` | :203-212 → `escolherInstrutor` |
| Disponibilidade; 1ª e 2ª preferência | `select[data-f="jan"]` (`opcoesDeDisponibilidade`, first option "Só às HH:MM (o pedido)"), `[data-f="p1"]`, `[data-f="p2"]` | `jan`, `p1`, `p2` | :224-228, generic branch |
| Duração | `input.duracao[data-f="nb"]` | `nb` | :231-239 |
| Prioridade | `select[data-f="pr"]` | `pr` | generic branch |
| Tirar da escala / Pôr de volta na escala | `button[data-act="rm-fly"]` / `button[data-act="por-de-volta"]` | `fly` | :184-194 / new, through `podeVoltarAEscala` |
| O que difere do pedido | read-only list from `restricoesDoVoo` | | |

`aoAcionar('restricoes', …, { confereAPermissao: true })` only opens (the Gestor reads the lines as text; the
Secretaria never sees the button). Closes: "✕" `#btn-fechar-restricoes`, Esc (`gavetaDoEsc`), `carregarData`, or when
the key no longer exists. Below 800 px it takes the screen with "‹ Voltar". The "?" buttons of today's column heads
(`data-dica="instrutor-escolhido" | "preferencias" | "disponibilidade" | "duracao" | "prioridade"`) sit beside the labels;
`voa` becomes `fora-da-escala`, beside "Tirar da escala".

"Tirados da escala nesta data" (Processamento's `fora-pelo-operador` lines, and H's kind of the same name): records of
approved, held pedidos that are off, and records without a pedido that are off and still have a pin. A withdrawn
pedido's record is not listed (it is "Aguardando aprovação"); a hand-made record off with no pin comes back only through
the History. "Pôr de volta" and the `setFly` revert refuse with "O pedido deste voo foi cancelado.", "O pedido deste voo
está sem aprovação: aprove em Pedidos." or "Data passada: nada volta para a escala."

### 2.8 Bookings and requests without a pedido (question 3)

| Today | After |
|---|---|
| "+ Agendar voo" (six entry points) | unchanged: a record with no `solicitacao`, the pin `agendado`, the typed weights, "Marcar disponível" (js/agendamento.js:899-943). Two differences: the main request that carries a pedido is not its target, and the created record has no `etapaDoPrograma` |
| "Mover" and "Encaixar" of a pedido's flight | unchanged: the record keeps `solicitacao`, the mission and the priority. Also opened from a request left out (`data-agendar="p:<stuId>:<mid>"`) |
| "↶ Desfazer" | same payload; one new refusal (2.2) and two texts (js/reversoes.js:141-142): "O pedido deste voo saiu da escala: não há o que desfazer." and "O voo mudou depois do agendamento: desfazer agora mexeria em outro voo. Ajuste o voo em Restrições do voo." |
| "Soltar" (Sugestões; H's `#restricoes-da-data`) | unchanged; the released booked record becomes "sem pedido" and can give way to a pedido, which the undo guard covers |
| "+ missão" | removed: a second pedido, or a booking |
| "+ Pôr um aluno na demanda…" | removed: "Registrar e aprovar" (D; the deadline and PT422 apply), or a booking |
| Records without a pedido in stored days | stay and fly, listed as "sem pedido"; they take restrictions and "Tirar da escala"; one of the same mission gives way to an entering pedido |

### 2.9 The sixteen writer sites, the nine revert kinds, and the other controls (question 8)

| # | Site today (mapa-demanda 5.6) | Becomes |
|---|---|---|
| 1 | js/eventos/demanda.js:41 "Pôr um aluno" | removed (G) |
| 2 | :94-99 `usarMissaoDoCurso` | `aplicarRestricao(…, 'missaoDoCurso')` in js/restricoes.js (G): never `fly`, `nb` per decision 10, refused with the exact minute outside the list; triggers in js/eventos/restricoes.js |
| 3 | :153-182 push and remove an extra | removed (G). `extra[]` grows only through `alvoDoNovoPedido` and shrinks only through `desfazerAgendamento` and "Recomeçar" |
| 4 | :184-194 `rm-fly` | kept; moves to js/eventos/restricoes.js with `por-de-volta`, in the commit that deletes js/eventos/demanda.js |
| 5 | :197-273 the field handler | moves to js/eventos/restricoes.js (`aoMudarCampo('d', …)`) through `aplicarRestricao`; branches `fly` (with its cascade to the extras) and `mis` deleted |
| 6 | js/fixos.js:95-117 `limparDemanda` | deleted (G) with its 7 tests; `recomecarPelosPedidos` has its own pass |
| 7 | js/rules.js:86-100, 142-179 | `alvoDoNovoPedido` gains the guard (E); `deixarEmBranco` removes `etapaDoPrograma`, `normalizeMissionFields` keeps it only when `true` and checks types first (E, format commit) |
| 8 | js/agenda.js:107-140 `importarSolicitacoes` | moved in F0, replaced by the conciliation in E |
| 9 | js/agendamento.js:899-943 `aplicarAgendamento` | kept; removes `etapaDoPrograma` on a flight it creates (G) |
| 10 | js/instrutor-escolhido.js:104-109, 140-145, 165-172, 177-183 | unchanged |
| 11 | js/eventos/escala.js:177-186, 283-285 | unchanged |
| 12 | js/reversoes.js:165-191 `desfazerAgendamento` | unchanged; `motivoParaNaoDesfazer` gains the `solicitacao` guard (E, own commit) and two texts (G) |
| 13 | js/eventos/historico.js:53-61, 96-106 | `setFly` (F0b's `aoReverter`) registered by js/eventos/restricoes.js (G), each record through `podeVoltarAEscala`; `restaurarHorarios` unchanged |
| 14 | js/eventos/recursos.js:192-216 (the take-off times editor) | skips records with `solicitacao` (G, decision 22); `impactoDosHorarios` (js/horarios.js:147-158) returns them as `foraDaLista`: "2 voos de pedidos ficam fora da lista (o horário pedido saiu): veja em Processamento" |
| 15 | js/eventos/cadastros.js:84-90, 123, 128 | unchanged |
| 16 | js/storage.js:149-171; js/dias.js:96-101, 121; js/migracoes.js | `juntar` hardened (E); `CAMPOS_DO_PEDIDO` gains `etapaDoPrograma` and step 28 (E's last commit) |

| Revert kind | After |
|---|---|
| `setFly` | kept; created by "Tirar da escala" and "Pôr de volta"; old entries with `extras` still apply, each record through the check; registered in js/eventos/restricoes.js |
| `restaurarEscolha`, `restaurarFixos`, `restaurarHorarios`, `desfazerAgendamento` | kept, payloads unchanged |
| `setAv`, `setAtributo`, `setInsOn`, `readicionarRecurso` | other topics |

No kind is added and none dropped: every entry stored before the cut-over keeps its button.

### 2.10 The Processamento screen (step G): no input, five actions

- `section#s-proc`. Left pane (F2's list): `#proc-aviso` (2.3); search `#flt-proc` (name, `chaveDeBusca`); filters
  `#flt-proc-sit` (Situação, several values; default: every one but `cancelado`), `#flt-proc-cur`, `#flt-proc-mis`;
  count `#proc-cnt` "N na escala · N fora · N aguardando aprovação"; menu "Mais" (`#btn-mais-proc`) with "Recomeçar pelos
  pedidos" (`data-act="recomecar"`), armed "Confirmar: recomeçar a data", with the sentence beside it "14 voltam ao
  pedido, 3 sem pedido saem, 2 ficam, 1 tirado continua fora".
- One row per line of `quadroDoProcessamento`: status dot; initials; the name; second line "<missão> · <código> · HH:MM ·
  N h", meta the placed time or "fora"; third line the text of 2.6; a lock when booked; the count of restrictions; the
  row's one action (`acao`) of 2.6.
- Middle pane, read-only "Label: value" sections, with "Restrições do voo", "Abrir o voo" and "Abrir em Pedidos" at the
  title: "Pedido" (missão, 1ª and 2ª preferência, disponibilidade, duração, registrado por, exceção, observação, aprovado
  por); "Missão do curso" (2.4); "Preferências do aluno"; "O que a missão exige" (`descreverExigencias`); "Recursos" and
  "INVAs" (each candidate at the 1st preference against the schedule without this flight, with what stops it); "Na
  escala" (the row, or the reason, with "Encaixar…"); "Restrições do operador" (`restricoesDoVoo`, read-only, with
  "Abrir").
- The five actions, Edit-only, all writes of the Escala stage through `gravarAlteracao`: "Atualizar a escala"; "Trazer de
  volta" (`trazer-pedido`); "Pôr de volta na escala" (`por-de-volta`); "Tirar da escala" on a `sem-aprovacao` line
  (`rm-fly`); "Recomeçar pelos pedidos". "Aprovar pedido" and "Aprovar" are D's actions; "Restrições" opens the panel.
- One line: `{ chave: fKey | 'p:<id>', origem: 'pedido' | 'agendado' | 'sem-pedido', situacao, notas, stuId, mid, fKey,
  pedido, voo, missaoDoCurso, restricoes, preferencias, exige, recursos, instrutores, motivo: { quando: 'sozinho' |
  'na-escala', codigo, m, curto, onde } | null, naEscala }`.
- `contagens`: `aprovados`, `naEscala`, `paraEntrar`, `paraSair`, `conferir`, `semAprovacao`, `dispensados`,
  `foraPeloOperador`, `naoCabemSozinhos`, `naoCouberam`, `semMissaoDoCurso`, `missoesParaTrocar`, `comRestricao`,
  `semPedido`, `inativosComVoo`. The rows "recursos disponíveis" and "INVAs disponíveis" are availability counts (H
  decision 17), not rejection codes.
- Profiles: the Gestor reads the list, the detail and the panel as text; the Secretaria does not see the stage. Phone:
  the list, then the detail as a second view.

### 2.11 The cut-over and the interims (question 9)

| Case | What happens |
|---|---|
| Stored days of past dates | not converted, never written by the conciliation (decision 23). A record with `solicitacao` reads as a pedido's flight, the others as "sem pedido" |
| Stored days of today and later, built before G | an imported record (D's rule a approved it, any `fly`): in the schedule, or "fora pelo operador" when "Voa" was off. An id in `importadas` with no record: the pedido stays waiting and held ("Aguardando aprovação"); approving it makes it `dispensado`, never a flight by itself. A pedido cancelled after its import and still flying: "1 cancelado ainda na escala", leaves with the first click under the guards. A pedido withdrawn between D and G whose record flies: leaves with the first click (`sem-aprovacao`), listed before. A waiting pedido an old tab imported: G's migration approves it (rule a, no withdrawal trace); `semAprovacao` covers only what an old tab imports after that migration and before Pedro's opening. No record has the mark, so no course mission is changed |
| Hand-made records | stay and fly; never touched, except giving way to a pedido of the same mission |
| Tabs still open on a version before E | once Pedro's opening after Onda 2 writes 28, their next save is refused (`PT409`, hint `formato`) and they reload |
| Local mode | the same pure code; D's local conversion of `acpm4_agenda` and, at 28, rule (a) once more (marker `acpm4_agenda_aprovacoes_g`); 13-digit ids only in `solicitacao` and `importadas` |
| Two operators, the Secretaria | 2.3 |
| D merged, E not yet | approval exists; the import takes approved pedidos never imported (`solicitacoesParaImportar`); an approval made here runs D's `entrarNaDemanda` under the five conditions (record off → on; held with no record → enters again); a withdrawn or cancelled pedido's flight stays ("Ainda na demanda") |
| E merged, G not yet | the same behaviour through the module (`religar`), entries and `voltam` only; the Demanda, "Voa", "+ missão", "Pôr um aluno" and "Limpar demanda" still exist and write the legacy G reads; 28 is written at the sweep; nothing writes `etapaDoPrograma` yet |
| G merged | exits, the hook, the screen, the panel; G's migration on production before the merge |
| G reverted after Pedro's opening | Pages serves E's client at 28: it reads every record G wrote (the mark is kept by `CAMPOS_DO_PEDIDO`, off records are "Voa" off, removed ids are not re-imported: E imports only approved pedidos with no record); the Demanda comes back. Never revert E after that opening |

### 2.12 The ten columns (question 10)

| Column | Afterwards | Kind | Why |
|---|---|---|---|
| Aluno (the name) | the pedido's `aluno` | field of the pedido | exists |
| Aluno: the course code, "Próxima · Usar" | `etapa`, `cursoDaEtapa`, bound at entry with `etapaDoPrograma`; kept in step by "Atualizar a escala"; "Usar a do programa" in the panel | derived | 2.4 |
| Aluno: "Outra missão…" | panel › Missão do curso › "Trocar…" | operator restriction | it goes against the programme, with a confirmation |
| Aluno: "+ missão", "✕" of an extra | a second pedido, or a booking | removed | one pedido is one flight |
| Aluno: the tag "agendado HH:MM" | the lock on the flight and on the Processamento line | derived (the pin) | |
| Voa | on: the approved pedido has entered; off: "Tirar da escala" | derived; off is an operator restriction | decision 8 |
| Missão | the pedido's `missao` | field of the pedido | no override (decision 10) |
| Recurso (the type) | the programme's type for the bound mission, else `MIS[mis].defEq`; another in the panel | derived; override is an operator restriction | no other source |
| Instrutor | `insId` | operator restriction | no other source |
| 1ª preferência, 2ª preferência | the pedido's `horario` and `horario2` (D decision 10); others in the panel › Horário, or by Mover and Encaixar | fields of the pedido; override is an operator restriction | |
| Disponibilidade | the pedido's `disponibilidade` (absent: only at the 1st preference); looser in the panel | field of the pedido; override is an operator restriction | the only room the Horários criterion has |
| Duração | the pedido's `horas` (the fixed durations first); another in the panel | field of the pedido; override is an operator restriction | |
| Prioridade | `pr`, 3 at entry | operator restriction | no other source |

### 2.13 The operator's day, counted

A build day: tomorrow, after 13:00, the pedidos already approved (she registers them with "Registrar e aprovar"), k
restriction edits (priority, instructor, type, time, duration), then the next morning s students whose mission the
results overtook. Counts are actions (clicks or choices); k = 8 and s = 2 are estimates, not measured.

| Step | Today | After G (and H) |
|---|---|---|
| reach the stage | Demanda (1) | Processamento (1) |
| bring the pedidos in | "Importar N pedidos da agenda" (1) | "Atualizar a escala" (1) |
| each restriction edit | 1 select in the row | the line's "Restrições" (1) + the field (1); the next line's "Restrições" replaces the panel |
| close and go to the result | Escala (1) | close the panel (1) + Escala (1) |
| next morning, the stale missions | nothing shows; "Outra missão…" per student (2 each), or a result on the wrong code | Processamento (1) + "Atualizar a escala" (1), for all |
| **Total, k = 8, s = 2** | k + 3 = 11, + 2s = 4 if she notices: 15 | 2k + 4 = 20, + 2: 22 |

Where it is slower: one more action per restriction edit (opening the flight: the list component has no inline fields),
the panel's close, and with Secretaria accounts "Pedidos" (1) + "Aprovar todos (N)" (1) per batch (today 0: the import
takes waiting pedidos). Where it is faster or safer: the tasks below.

| Task | Today | After |
|---|---|---|
| A late pedido on a date already started | register, then Demanda (1) and "Importar" (1) | "Registrar e aprovar": it enters by itself (D's five conditions); the toast says where |
| A flight that did not fit at its time | Demanda (1), the search (1), Disponibilidade (1), Escala (1): 4, the flight stays free | on its red-box line or Processamento line: "Restrições" (1) + Disponibilidade (1): 2, free; or "Encaixar…", a time, "Agendar": 3, pinned |
| A student cancels, before the day of the flight | Agenda (1), "Cancelar" (1), "Confirmar" (1), then Demanda (1), find the row (1), Voa (1): 6, and forgotten the flight stays | Pedidos (1), the row (1), "Cancelar pedido" (1), "Confirmar cancelamento" (1): 4, the flight leaves at once (open, started date); else + Processamento (1) + "Atualizar a escala" (1) on that date |
| A student gives up on the day of the flight | the status Cancelado with the reason in the Escala (2 or 3) | the same; cancelling the pedido is for one registered by mistake (D's sentence in the detail) |
| The Secretaria cancels an approved pedido at the counter | the flight stays unless the operator hears of it | the notice, the rail item and the card row within 60 s; Processamento (1) + "Atualizar a escala" (1); until then it stays in the stored schedule and on the TV |
| Pedidos registered by a Secretaria | the same 2 clicks of the import | "Pedidos" (1) + "Aprovar todos (N)" (1); on a date not started + "Atualizar a escala" (1) |
| Take a flight off, put it back | "Voa" (1) and "Voa" (1) | "✕" (1) and the line's "Pôr de volta" (1) |
| A student with no pedido | type the name and Enter, then the row's fields | "Registrar e aprovar" (the form; after 13:00 with the exception), or "+ Agendar voo" |
| A second flight for a student | "+ missão", then the row's fields | a second pedido, or a booking |
| Restart the date | 3 clicks, then every pedido again by hand | 3 clicks; the pedidos come back in place |
| News from another computer | nothing tells her | D's read every 60 s, the notice and the rail; 1 click |

The alternatives of question 2, counted the same way: C's block in the Processamento detail costs the line (1) + the
field (1) = 2 per edit from Processamento, and from the Escala's red box "Abrir" (1) + the field (1) + back (1) = 3;
switching to the Escala for every edit costs 3 per edit from Processamento.

## 3. Where each existing control goes (a table: control today (label, id or data attribute) | destination (stage, screen, pane) | kept, moved, replaced by or removed). Only for the screens your topic owns; write 'not applicable' otherwise.

The Demanda screen (`#s-dem`, index.html:299-341) and the two import buttons. "the panel" is G's "Restrições do voo"
(`aside.gaveta#painel-restricoes`, 2.7), opened from the Escala and from Processamento; "`#restricoes-da-data`" is H's
list. The other controls of the Escala and of Pedidos are their notes'.

| Control today | Destination | Kept, moved, replaced by or removed |
|---|---|---|
| Tab "Demanda", `button[data-t="dem"]` | the pipeline card "Processamento", which opens `#s-proc` (F1 points it at `#s-dem` until G) | replaced |
| "Importar da agenda" / "Importar N pedido(s) da agenda", `#importar-agenda` | Processamento, `#proc-aviso`: "Atualizar a escala", `data-act="atualizar-escala"` | replaced |
| "Importar N pedido(s) para a demanda", `#agenda-importar` (Agenda) | Pedidos, the notice `#agenda-aviso` (D 2.8), with the same `data-act` | replaced |
| Badge `#selo-age` | the card rows and rail items of D and G (H's 2.9, 2.10) | replaced |
| "+ Pôr um aluno na demanda…", `#incluir-aluno`, `#alunos-fora` | none: Pedidos › "Registrar e aprovar"; Escala › "+ Agendar voo" | removed |
| "Só quem voa", `#onlyfly` | Processamento: `#flt-proc-sit` | replaced |
| "Buscar na demanda…", `#flt-dem` | Processamento: `#flt-proc` | moved |
| "Todos os cursos", `#flt-dem-cur`, `#flt-dem-cur-painel` | Processamento: `#flt-proc-cur` (its ticks stop being shared with Alunos) | moved |
| "Todas as missões", `#flt-dem-mis` | Processamento: `#flt-proc-mis` | moved |
| "Mais", `#btn-mais-dem`, `#menu-mais-dem` | Processamento: `#btn-mais-proc` | moved |
| "Limpar demanda" → "Confirmar limpeza", `#clr` | Processamento › "Mais": "Recomeçar pelos pedidos" → "Confirmar: recomeçar a data", `data-act="recomecar"` | replaced |
| Count "N / M aluno(s) · K missão(ões) marcada(s)", `#cnt` | Processamento: `#proc-cnt`; the pipeline card | replaced |
| Column "?" buttons, `button.dica-btn[data-dica="voa" \| "instrutor-escolhido" \| "preferencias" \| "disponibilidade" \| "duracao" \| "prioridade"]` | the panel, beside each label; `voa` rewritten as `fora-da-escala`, beside "Tirar da escala" | moved |
| The row, `tr[data-k="d"][data-id][data-mid]` | a read-only Processamento row and its detail; the panel's body `div[data-k="d"][data-id][data-mid]` | replaced |
| Student name, course mission code (`span.etapa`) | Processamento row and detail "Missão do curso"; the panel's title and its first line | moved |
| "Próxima: <rótulo> · Usar", `button[data-act="usar-proxima"]` | none at entry (bound by the conciliation); the panel › Missão do curso › "Usar a do programa" (same `data-act`) | replaced |
| "Outra missão…", `select[data-f="outra-missao"]` | the panel › Missão do curso › "Trocar…" | moved |
| "Usar <código> fora da ordem" / "… do curso encerrado", `button[data-act="usar-fora-da-ordem"]` | the same place, armed as today | moved |
| "agendado HH:MM · <recurso>", `span.tag[data-dica="voo-agendado"]` | Processamento row and detail "Na escala"; the lock in the Escala | moved |
| "+ missão", `button[data-act="add-mis"]` | none | removed |
| "↳ missão extra" and "✕" → "Confirmar", `button[data-act="del-mis"]` | none ("Tirar da escala" takes any flight off) | removed |
| Voa, `input.sw[data-f="fly"]` | on: derived from the entry; off: "Tirar da escala" (`data-act="rm-fly"`); back: "Pôr de volta na escala" (`data-act="por-de-volta"`) in the panel and on the Processamento line; from H also in `#restricoes-da-data` | replaced |
| Missão, `select[data-f="mis"]` | Pedidos: the form's "Fase / missão"; read-only elsewhere | removed as an input |
| Recurso, `select[data-f="eq"]` | the panel › Tipo de recurso | moved |
| Instrutor, `select[data-f="insId"]` | the panel › Instrutor | moved |
| 1ª preferência, 2ª preferência, `select[data-f="p1"]`, `[data-f="p2"]` | Pedidos: the form (D); the panel › Horário | moved |
| Disponibilidade, `select[data-f="jan"]` | Pedidos: the form (D); the panel › Horário, first option "Só às HH:MM (o pedido)" | moved |
| Duração, `input.duracao[data-f="nb"]` | Pedidos: the form; the panel › Duração | moved |
| Prioridade, `select[data-f="pr"]` | the panel › Prioridade | moved |
| "Nenhum aluno com esses filtros." and "Limpar filtros", `#limpar-filtros-dem` | the empty state of F2's list | replaced |
| "Nenhum aluno cadastrado. Cadastre os alunos na aba Alunos.", `tr.empty-dem` | "Nenhum pedido para esta data.", with "Abrir Pedidos" | replaced |
| "Abrir a Demanda" (Alunos), `button[data-go="dem"]` in `p.ir-para-demanda` | none | removed (the Alunos screen is A's) |
| "✕" Tirar da escala (Escala list) and "✕ Excluir da escala" (map pop-up), `button[data-act="rm-fly"]` | Escala, the row and `#tl-pop`; the handler moves to js/eventos/restricoes.js | kept; still writes `fly: false` |
| (new in G) "Restrições" on the Escala row and in `#tl-pop`, `button[data-act="restricoes"][data-id][data-mid]` | Escala | created |
| Items of "N missões não entraram na escala" (js/views/escala.js:466-469) | each `li[data-fkey]` with "Restrições" (`data-act="restricoes"`) and "Encaixar…" (`data-act="agendar"`, `data-agendar="p:<stuId>:<mid>"`) | kept, two entries added |
| Empty states "Nenhum voo nesta data. Marque quem vai voar na aba Demanda…" (js/views/escala.js:597, index.html:373) and "Nenhuma missão marcada na Demanda." (:624) | "Nenhum voo nesta data. Os pedidos aprovados entram em Processamento › Atualizar a escala." and "Nenhum pedido na escala desta data." | replaced (G) |
| PDF header "Missões na demanda" (js/export.js:54) | "Missões pedidas" | replaced (G) |
| "↶ Reverter", "↶ Restaurar", "✕ Excluir", "↶ Desfazer", `data-act="rev-log"` | Histórico | kept |

## 4. Data-format steps and migrations (the number or the migration file name, what changes, the conversion, its tests, the deploy order)

| Item | Content |
|---|---|
| F0, D, G | no format number |
| **Format 28**, E's last commit, made after E rejoins on D (so `PASSOS[27]`, C's, is in its base), js/migracoes.js | `ESQUEMA = 28`; `PASSOS[28] = { cadastro: c => c, dia: d => d }`, with the comment naming what it protects: the record field `etapaDoPrograma` (G writes it; an older tab would drop it from a main request on save) and the ids that leave `importadas` from G on (an older tab would import them again as second records) |
| What ships with it | `CAMPOS_DO_PEDIDO` gains `'etapaDoPrograma'` (js/dias.js:22); `normalizeMissionFields` keeps it only when `true`, after a type check; `deixarEmBranco` removes it. Nothing writes it before G |
| Why E and not G | a revert of G's merge returns to E's client at 28, which reads every record G wrote (2.11, last row); with 28 in G, the same revert after Pedro's opening makes every save of every operator fail (`PT409 formato`: 20261114143242_formato_e_status_do_dia.sql:22-26, 73-76; js/actions.js:138-145) |
| Conversion | none: no stored day changes content |
| Tests, written first | test/unit/migracoes.test.js: a day and a cadastro at 27 come out equal plus `esquema: 28`; an unknown field survives; `{ importado: true }` and `{ simulado: true }` pass untouched; the pin of the number. test/unit/dias.test.js: the key lists (:25-35, :164); the day has no names or weights, now asserted on the extras too. test/unit/rules.test.js: the mark kept only when `true`; a hostile value. test/unit/reversoes.test.js: a `desfazerAgendamento` snapshot with the mark validates |
| Deploy order | client only; E merged after C's 27 and D. Onda 2 (D, E, G in one sitting) ends with Pedro's opening, which rewrites every stored day at 28 once. From then on: G may be reverted alone; E never |
| **SQL migration of G**, `supabase/migrations/20261124200000_importados_ja_aprovados.sql` (after D's `20261124100000`, before I's `20261125100000`) | `select public.aprovar_solicitacoes_de_antes_da_aprovacao(false);` D's function, rule (a) again: approves what a tab of the old version imported between D's production push and G (never a pedido with a withdrawal trace; rule b not run) |
| Its tests | D's `agenda-aprovacao.test.sql` covers the function with `false`; G adds one check: 'com false, aprova o que uma aba antiga importou depois da migração de D, e não o que foi retirado'. `npm run test:db` on the preview |
| Its order | preview, `npm run test:db`, production, then G's merge (the repo's rule: migration before the merge) |
| Local mode | js/backends/local.js runs rule (a) over `acpm4_agenda` once more, the first time a pedido method runs at 28 (marker `acpm4_agenda_aprovacoes_g`); one test in test/unit/backend-local.test.js |
| What this design needs from D's migration (`20261124100000_aprovacao_dos_pedidos.sql`) | `aprovada_em` and `aprovacao_retirada_em` (read by the conciliation); the functions; the conversion as written. Its consequence, built into decision 3: pedidos cleared before D stay waiting and held, and approving them makes them `dispensado` |
| The History read | G raises the date's read from 200 to 500 entries (js/backends/supabase.js:172 and test/e2e/supabase-falso.js): the first "Atualizar a escala" of a date writes one entry per pedido, and `agendamentosEmVolta` scans that list |
| G's go-live list (replaces desenho-entrega 2.6, G, step 2) | 1. export the CSV of every date from today on that has a stored day (the reconciliation's writes have no revert). 2. G's migration: preview, `npm run test:db`, production. 3. rehearsal on the preview: days at 27 seeded with the three origins of a record and pedidos in the four states (one withdrawn); after the sweep every stored day equals itself but for `esquema`; the first "Atualizar a escala" of tomorrow lists only what 2.11 says. 4. a read-only count over the records of dates from today on: flying records whose pedido is waiting with no withdrawal trace (old-tab imports after G's migration), each listed. 5. merge; Pedro opens first. 6. the next date shows the same flights as its CSV. Rollback: revert G's merge only |

## 5. Files created, changed and deleted, by step (the step names are F0, F1, F2, F3, A, B, C, D, E, G, H, I as in posicao.md and the request)

| Step | Created | Changed | Deleted |
|---|---|---|---|
| F0 | js/processamento.js (the moved `importarSolicitacoes`, exported, and `vooQueDaLugar`, not exported); test/unit/processamento.test.js (the 21 tests of test/unit/agenda.test.js:89-334, moved); js/eventos/importacao.js (`importarDaAgenda`, bound by `aoAcionar('importar-agenda', …)`): as desenho-entrega 2.2 d | js/agenda.js (loses the two moved functions; keeps `pedidoDaSolicitacao` and `disponibilidadeDaSolicitacao`; no `entraNaEscala`); test/unit/instrutor-escolhido.test.js:9, test/unit/progresso.test.js:17 (the import path); js/rules.js (the type check of docs/PLAN.md:440, its own commit) | none |
| F1, F2, F3 | not applicable | F3's `estadoParaEscalar` and `voosComInativos` (js/inativos.js) are read by the module from E and G | |
| A, B, C | not applicable | A removes "Abrir a Demanda"; B keeps the take-off times editor, which G edits (decision 22) | |
| D (desenho-pedidos; what this topic needs) | | `solicitacaoAprovada` (js/agenda.js); `diaJaGravado()` (js/actions.js); `ApiClient.diaMudou`; the cache `js/solicitacoes-da-data.js` with `diaMudou` and rows carrying `aprovacao_retirada_em`; D's `entrarNaDemanda` and handlers | |
| E | js/rejeicoes.js; test/unit/rejeicoes.test.js | js/processamento.js (`conciliarPedidos`, `aplicarConciliacao`, `ficaNaEscala`, `horarioPedido`, `missaoDaEntrada`); js/eventos/importacao.js and D's approval handler in js/eventos/agenda.js (the plan with `religar` in place of `entrarNaDemanda` and `importarSolicitacoes`); js/agenda.js (D's `entrarNaDemanda` deleted); js/conflitos.js (`FORA_DA_ESCALA` exported); js/agendamento.js (`naOrdemDoMotor` and `FORA_DA_ESCALA` leave; `motivoDeFora`, `motivoDaSaida`, `simularAgendamento`) and js/views/agendamento.js:184; js/rules.js (the guard); js/reversoes.js (the `solicitacao` guard, its own commit); js/dias.js (`juntar`); last commit: js/migracoes.js, js/dias.js, js/rules.js (format 28); the tests of section 6; README "Estrutura" and "Formato dos dados" | `importarSolicitacoes`; `entrarNaDemanda` and its unit tests (they become the `religar` cases) |
| G | js/views/processamento.js; js/eventos/processamento.js (`atualizarAEscala`, `depoisDeMudarPedidos`, `trazer-pedido`, `recomecar`); js/restricoes.js; js/views/restricoes.js; js/eventos/restricoes.js (`restricoes`, `aoMudarCampo('d')`, `rm-fly`, `por-de-volta`, `usar-proxima`, `usar-fora-da-ordem`, `aoReverter('setFly')`); css/processamento.css; css/restricoes.css; test/unit/restricoes.test.js; test/e2e/processamento.spec.js; test/e2e/restricoes.spec.js; test/e2e/telas/processamento.js (driver, with the panel); `supabase/migrations/20261124200000_importados_ja_aprovados.sql` | js/processamento.js (G exports; exits, `voltam`, `missoes`; `religar` removed); js/conflitos.js (`ONDE_RESOLVER`); js/fixos.js (`fixosSemOAgendadoQueMudou`); js/agendamento.js (`p:<stuId>:<mid>` in `contextoInicial`; the mark on a created flight; texts that name the Demanda); js/views/escala.js (the "Restrições" button on rows and in `#tl-pop`; the red box as `li[data-fkey]` with its two buttons; :597, :624); js/export.js:54; js/reversoes.js (two texts); js/views/etapas.js (`etapaNaDemanda` → `etapaNoVoo`, texts); js/views/cursos.js and js/eventos/cursos.js (`codigoNosVoos`); js/engine.js:994 in its own commit (`escolhido-saiu`: "Escolha outro em Restrições do voo"; no golden holds it); js/horarios.js (`impactoDosHorarios` → `foraDaLista`) and js/eventos/recursos.js (`salvarHorarios` skips pedido records); js/eventos/agenda.js (D's handlers call `depoisDeMudarPedidos`); js/views/agenda.js (the "Nesta data" section shows Processamento's line; the form's 1st-preference list and Duração from `missaoDaEntrada`); js/agenda.js (D's "until G" functions out); js/linha-do-dia.js (G's rows and items, H 2.9, 2.10); js/eventos/registro.js (its `rDem` import, if F0b left it); js/backends/supabase.js:172; js/backends/local.js (rule a at 28); test/e2e/supabase-falso.js (500; `comPedidoAprovado`); index.html (`#s-dem` out; `#s-proc` and `aside.gaveta#painel-restricoes` in; :373; the Manual's Demanda section and the sentences that send her to the Demanda: :445, :448, :482, :486, :489-501, :534, :540, :557-558, :595, :636); js/glossario.js (`fora-da-escala`, `restricoes-do-voo`, `pedido-dispensado`, `recomecar`); README; test/e2e/agendamento-mapa.spec.js:172 | js/views/demanda.js; js/eventos/demanda.js; js/eventos/importacao.js; what is left of js/views/selos.js; css/demanda.css; js/views/filtros-das-pessoas.js; test/e2e/demanda.spec.js; test/e2e/telas/demanda.js; `limparDemanda` and its describe; D's `situacaoNaDemanda`, `solicitacoesParaImportar`, `solicitacoesAindaNaDemanda`, the "…demanda" tags, `#agenda-importar`, `#importar-agenda`. Re-homed, not deleted (the lint): `instrutoresDoPedido`, `opcoesDeDisponibilidade`, `proximaDoPedido`, `outraMissaoDoPedido`, `botaoForaDaOrdem`, `confirmacaoDaMissao`, `etapaNoVoo` (imported by the panel's two modules); `semAgendados` (used by `fixosSemOAgendadoQueMudou`, imported by its tests) |
| H | | lists and links: `#restricoes-da-data` reads `restricoesDoVoo` (as `doRegistro`) and "Tirados da escala" by 2.7's rule; the adapter reads `rejeicoesDosPedidos` (js/rejeicoes.js), the plan, `cabeSozinho`, `contagens`; `#aprovacao-pendencias` may carry the plan's counts; the armed text stays fixed | |
| I | | the last mentions of "Demanda" and "Importar da agenda" in History templates, Manual, glossary and README | |

## 6. Tests (what is written first; which existing tests change, with file names and rough counts)

Written first, step E (about 100 in all):

| File | Tests |
|---|---|
| test/unit/processamento.test.js | the 21 moved tests, through a helper that conciliates with `aprovada: s => !s.cancelada_em` and applies `entram` (they pass before any rule moves, but for the guard's one). Then: each row of the table of 2.3 (15); `aprovada` missing throws (1); the `religar` cases, D's four `entrarNaDemanda` tests moved (4); each `porque` of `ficaNaEscala`, in its order, and which go to `conferir` (8); a date before today: no `entram`, `voltam`, `saem` or `missoes`, `naoEntrou` listed, `pendente` false (4); exit by cancellation cleans the key, exit by withdrawal keeps the pin, a pinned Ground class keeps its other students (4); withdrawn then approved again: the same record, `mid`, `insId` and `pr` (2); taken off, withdrawn, approved: stays off (1); a waiting pedido's held id is never forgotten, and approving it gives `dispensado` (2); applying twice equals once (1); a record without `solicitacao` is never touched, the one that gives way keeps `pr` (2); the contract: positive integer `mid`s up to 999,999 and unique per student also with a 13-digit id, one record per `solicitacao`, no key outside `CAMPOS_DO_PEDIDO` and `mid`, no name and no Observação (3); R10 as a property test, 300 sequences, with "Soltar" and "↶ Desfazer" among the events and the eight invariants of R10 (1) |
| the same file, each in its own commit as a rule of the next-mission logic | by time: R6's AV PROF. SOLO runs in both orders and the two "Voo Local" (4); a closed course enters without the mission (1); a time outside the bound type's list keeps the programme's type and the minute, with the note (1) |
| test/unit/rejeicoes.test.js | two extras of one mission with different reasons; two students with one name; with pins; with a chosen instructor (4); R5 as an invariant over the 41 golden states and 300 seeds in four variants (1); the queue order against the `err` sequence of a day where nothing can fly (1); a schedule that no longer matches the state pairs only the unique labels (1); on `estadoParaEscalar`: an inactive INVA in a student's "Priorizar com", and an inactive student with a flying record (2) |
| test/unit/reversoes.test.js | the booking's undo refused when a pedido took the record: created extra, main request, entry without `criadoComo` (3) |
| test/unit/rules.test.js | "o pedido principal, quando o aluno não voa…" loses `solicitacao: 7`; added: with a pedido on it, a new extra and the record intact (1 changed, 1 added) |
| test/unit/agendamento.test.js | :497 loses `solicitacao: 7`; added: the booking does not take a main request that carries a pedido; two rejections with one label, each "Encaixar" with its own reason; the import of `naOrdemDoMotor` (1 changed, 2 added) |
| test/unit/dias.test.js | `juntar` ignores roster keys in a stored main request (1) |
| format 28 (E's last commit) | section 4 (about 8) |

Written first, step G (about 60 unit, about 40 e2e):

| File | Tests |
|---|---|
| test/unit/processamento.test.js | every `situacao` and note of 2.6 (15); `cabeSozinho` drops the pins, keeps the Noturno's return, reads `estadoParaEscalar`, gives `horario-fora-da-lista`, and R4 as a property (5); `missoesDoCursoDoDia`: R7's seven cases, all or nothing per student, a booked flight skipped, a date before today, a flight whose start passed (11); `podeVoltarAEscala` (5); `recomecarPelosPedidos`: what stays, a pedido record reset in the same `mid`, records without a pedido deleted, a taken-off record stays off, a `dispensado` stays, new entries above every old `mid` and never mid 0, the reopened approval, refused on a past date (8); `religar` gone: the identity rule (2); the History texts of 2.3 (7) |
| test/unit/restricoes.test.js | `aplicarRestricao` per field (8); a type or a course mission refused with an exact minute outside the new list, accepted with a period (3); the course-mission writer never writes `fly` and keeps `nb` unless `mis` changes or the duration is fixed (2); the booked pin released only by a real change (2); `restricoesDoVoo`: the item shape, a period loosened, `null` with the pedidos unread (3) |
| test/unit/fixos.test.js | `fixosSemOAgendadoQueMudou` (3); the describe "Limpar demanda" (7) deleted with `limparDemanda` |
| test/unit/horarios.test.js | `impactoDosHorarios` returns pedido records as `foraDaLista` and does not adjust them (2) |
| test/unit/backend-local.test.js | rule (a) once more at 28, with its marker (1) |
| test/e2e/processamento.spec.js (about 18) | the notice and "Atualizar a escala"; a date without its day does not take an approval by itself, a date with it does; **"outra conta gravou a data: Atualizar a escala relê a data e nada trava"**; a cancelled pedido leaves, a landed one stays; **"pedido cancelado com o horário passado: o voo fica e a linha pede o status"**; withdrawn in another browser leaves at the click; withdraw and approve again returns the flight to its place; **"a Secretaria cancela um pedido aprovado; o voo sai só com Atualizar a escala"**; **"pedido limpo antes da troca: aprovar não traz o voo de volta"**; "Trazer de volta"; "Pôr de volta na escala" on the line; `sem-aprovacao` with its two buttons; a date before today offers nothing; the stale missions changed by the click; "Recomeçar pelos pedidos"; an approved schedule; the failed read; the Gestor sees the text without the buttons; phone (390 px) |
| test/e2e/restricoes.spec.js (about 24) | the panel opens from the Lista row, `#tl-pop`, a red-box line and a Processamento line; each field; the type refused with the exact minute; "Usar a do programa" and "Trocar…" with the two confirmations (the 9 tests of cursos-no-dia.spec.js, moved); availability, duration, times per category and the six of "Voo agendado na Escala" (moved from demanda.spec.js); "Tirar da escala" and "Pôr de volta"; **"↶ Restaurar de uma entrada setFly gravada antes da troca, com extras"**; **"o ✕ da Escala depois da troca"**; the Gestor reads as text; phone |

Existing tests that change:

| File | Change | Rough count |
|---|---|---|
| test/unit/agenda.test.js (31) | the import describe leaves in F0; the guard's test rewritten in E | 21 moved, 1 rewritten |
| test/unit/instrutor-escolhido.test.js:268, test/unit/progresso.test.js:544 | the call becomes the conciliation's helper (E) | 2 |
| test/unit/instrutor-escolhido.test.js:73 | the text of `escolhido-saiu` (G) | 1 |
| test/unit/reversoes.test.js:328, test/unit/agendamento.test.js:539, :865, test/e2e/historico.spec.js:222 | the two refusal texts of "↶ Desfazer" (G) | 4 |
| D's e2e "aprovar de novo o pedido tirado com o Voa religa o voo" (agenda.spec.js) | holds through E; rewritten in G to the identity rule | 1 |
| test/e2e/demanda.spec.js (23) | deleted in G: about 10 restriction tests move to restricoes.spec.js; "Pôr um aluno" (2), "+ Missão" (1), the "Voa" cascade (1), the 10 columns (1) and the Missão select (1) go with their controls; "Limpar demanda" (2) become "Recomeçar" and the 5 filter tests return in processamento.spec.js | 23 |
| test/e2e/cursos-no-dia.spec.js (9) | against the panel (G) | 9 |
| test/e2e/escala.spec.js:46 ("excluir da escala e restaurar pelo histórico") | unchanged; must stay green after the handler moves | 0 |
| test/e2e/agendamento-mapa.spec.js:172 | the Escala's empty-state text | 1 |
| test/e2e: `irPara(page, 'dem')` on 71 lines of 19 files; `data-f="fly"` on 33 lines of 11 files; `#importar-agenda` or `#agenda-importar` on 12 lines of 5 files; `#clr` 13, `#incluir-aluno` 12, `add-mis` or `del-mis` 11 (counted) | a flight is seeded in the state given to `abrir` (seeded records fly as "sem pedido"), or enters through an approved pedido pushed with `comPedidoAprovado(page, …)` | about 150 lines |
| test/helpers/montar.js, the 41 goldens, test/unit/engine.*.test.js | none | 0 |

## 7. Departures from Pedro's request (a table: what the request says | what this design does | why | what Pedro can choose instead)

| The request says | This design does | Why | Pedro can choose instead |
|---|---|---|---|
| Processamento is "an aggregation and enrichment stage with no data of its own" | the stage has no input and stores nothing typed into it; the day keeps one record per pedido that entered (its key, the course mission bound, the operator's restrictions) and the list of pedidos it holds | pins, statuses, results and five revert kinds hang on `(stuId, mid)` | a day that stores no request (B): every stored day converted, ten writer sites and five revert kinds rewritten |
| The stage "shows the enriched pedidos and why any of them cannot be scheduled" | it also carries five writes ("Atualizar a escala", "Trazer de volta", "Pôr de volta na escala", "Tirar da escala" on a `sem-aprovacao` line, "Recomeçar pelos pedidos") and opens the Escala stage's editor over itself | each acts on a line she is reading; sending her to another screen for each costs a screen change per pedido | only "Atualizar a escala" here; the others in the Escala and Pedidos |
| "Input: the approved pedidos of the date" | two more origins (bookings, records stored without a pedido), and a waiting pedido without a withdrawal trace whose flight an old tab put in the day stays until she chooses | "+ Agendar voo" creates no pedido (docs/PLAN.md:421); removing an old tab's import without a choice could empty tomorrow | every booking registers a pedido; old-tab imports removed by the first click |
| "Demanda will consume approved pedidos" | one click per date not started; by themselves on a started date (D's five conditions) | a save creates the date's day and freezes its hours and rodízio | every approval at once, on any date |
| "Build it as one pure module" | three: `js/processamento.js`, `js/rejeicoes.js`, `js/restricoes.js` | the booking dialog uses the pairing without the conciliation; the restriction writers are the Escala stage's | one module |
| A column is "a field of the pedido, something derived, or an operator restriction in the Escala stage" | as asked, and six overrides stay as restrictions beside the three the request lists: priority, resource type, duration, time, another course mission, "Tirar da escala" | they have no other source | fewer overrides |
| Restrictions "in the Escala stage" | their editor is a drawer of the Escala stage that opens over the screen it is called from, Processamento included | same count as C's block from Processamento, and reachable from the red box (2.13) | always switch to the Escala (3 per edit); C's block (question 2) |
| "No modal or pop-up for viewing or editing a record" | the flight's editor is a drawer, as the Sugestões | H decision 2 and its departure; posicao B4 | H's `aside#voo` pane (H 2.14) |
| "Voa" as something derived | on is derived; off stays an operator restriction of the date (`fly: false`) | one write, an undo that restores the place, works offline | "Tirar da escala" withdraws the approval |
| "why any of them cannot be scheduled" | two reasons: "Não cabe nem sozinho" and "Não coube na escala", plus one stated before the engine ("o pedido pediu 08:20; o PA-34 decola às 08:30") | 11 of the 21 reasons exist only against other flights | one mixed list |
| "in the spirit of `importarSolicitacoes`" | the module replaces it and also takes flights out | today a cancelled pedido stays for ever | entries only |
| "missão definida pelo programa" | bound at entry, by time, and kept; one that the results overtook is listed and changed by the same click, never after the flight started | recomputed live it advances after the flight's own result | display only |
| "E. The Processamento module and its tests (no UI)" | no new screen, but E replaces the import behind today's button with five small rule differences (the guard, the time order, the closed course, the kept priority, the undo guard), shows each rejected flight's own reason in the booking dialog, and carries format 28 | the lint refuses exports only tests use; 28 in E lets G be reverted | 28 in G (no revert of G after the sweep) |
| "G. … the engine reading its output" | the engine keeps reading `S`; the module's output reaches `S` through `gravarAlteracao` | no second path into the engine; the goldens untouched | none |
| (not in the request) "+ Pôr um aluno" and "+ missão" end | the operator's additions are pedidos: after 13:00 through the Exceção da Coordenação (stored with `excecao`), and a 7th local flight at the same time is refused | one way in for a pedido-born flight | a booking option "o app escolhe o horário" that creates a record without a pedido and without a pin (question 14) |
| "Decisions this reverses" lists three | three more recorded decisions are restated: "Limpar demanda" (docs/PLAN.md:437) becomes "Recomeçar pelos pedidos"; the confirmation of a course mission "in Demanda" (:371, :397) moves to the panel; the release of a booked flight (:422) becomes one rule | the Demanda table is where they lived | keep "Limpar demanda" as a pure clearing, or drop it |
| Operator restrictions "override any rule" | not changed: a restriction overrides the app's choice; what breaks a rule is a conflict | posicao B7; H decision 7 | a rule change, in its own commits |

docs/PLAN.md's open items, restated: :421 a (a booking creates no pedido) stays; :421 c stays, and the walk corrects it
once the result exists; :422 stays as one pure rule; :371, :397 and the Demanda half of :424 move to the panel; the import
half of :424 is decided (no mission at entry); :418 is decided by time; :425 holds; :430 and :435 stand, with the two
texts reworded and one more undo refusal; :404 and :431 keep their reader and their gap; :437 becomes "Recomeçar pelos
pedidos" (in place, exclusions kept); :440 is fixed in F0.

## 8. Questions for Pedro, each with the default this design implements

| # | Question | Default |
|---|---|---|
| 1 | May the day keep one record per pedido that entered (flight key, course mission, the operator's restrictions), with Processamento itself having no input? | Yes |
| 2 | Where does the operator edit a flight's restrictions: G's panel "Restrições do voo", which opens over the Escala or over Processamento (2 actions per edit from either); a block in the Processamento detail (2 from Processamento, 3 from the Escala's red box); or always switching to the Escala (3 from Processamento)? | The panel, from both |
| 3 | Do pedidos enter a date by one click the first time and by themselves afterwards (D's five conditions)? | Yes |
| 4 | "Tirar da escala": a restriction of the date, the pedido staying approved? | Yes (`fly: false`, the place kept) |
| 5 | A pedido cancelled after its flight was fixed: the flight leaves and the schedule stays approved; it stays when Em Voo, Pousou or Cancelado, with a result, or on a date before today; when Atrasado, or past its pinned time today, the line asks her for the status instead of deciding? | As described |
| 6 | An approval withdrawn, here or elsewhere: the flight leaves keeping its place asleep (a booked pin lasts through Reabrir and Aprovar, a chosen pin through Reabrir, an approval pin is lost at the next Reabrir or Aprovar); approving again brings back exactly what the withdrawal took, and a flight she took off by hand stays off? | Yes |
| 7 | A pedido with no approval and no withdrawal (an old tab's import) whose flight is in the day: never removed without a choice? | Yes: "Aprovar pedido" or "Tirar da escala" |
| 8 | The Secretaria cancels an approved pedido (D allows it; posicao B3 did not): the flight stays in the stored schedule and on the TV until an Operador clicks "Atualizar a escala" (the notice within 60 s); on the day of the flight the way is the status Cancelado. Alternatives: she cannot (one clause in D's migration); or an Operador's browser applies a cancellation it reads | D's rule, applied by the operator's click |
| 9 | A pedido's exact minute when its resource type's take-off list lacks it (the programme's type at entry, a type change, a new list in Recursos): keep the minute and say "o pedido pediu 08:20; o PA-34 decola às 08:30", refuse the type change, and leave pedido flights out of the take-off editor's adjustment? Alternative: today's silent change to "Qualquer horário", labelled | Keep the minute |
| 10 | Should the course mission follow the day's times instead of the order of registration? | Yes; its own commit in E |
| 11 | A student of a closed course: the pedido enters without the course mission, with a notice? | Yes |
| 12 | Which values may the operator override: Instrutor, Prioridade, Tipo de recurso, Duração, Disponibilidade and the two preferências, Missão do curso; the mission type only through another course mission, which the panel and the History name? | As listed |
| 13 | Should "Atualizar a escala" also change the course missions that the results overtook, only on flights whose mission the app bound, only when the resource type stays, never on a date before today nor after the flight's start? | Yes; its own commit in G |
| 14 | A student with no pedido, or a second flight: only a pedido ("Registrar e aprovar", which after 13:00 needs the Exceção da Coordenação and refuses a 7th local flight at the same time) or a booking? Alternative: a booking option "o app escolhe o horário", a flight without a pedido and without a pin | Pedido or booking |
| 15 | Does a change of resource type or duration keep the course mission? | Keeps it |
| 16 | "Limpar demanda" becomes "Recomeçar pelos pedidos": each pedido's flight back to what the pedido gives, in place; hand-made flights leave; flown, cancelled, taken-off and dismissed ones stay? | Yes |
| 17 | A pedido that cannot fit even alone: still sent to the engine and counted in "missões pedidas", the PDF and the BI? | Yes |
| 18 | Does the pedido that takes the place of a hand-made flight keep that flight's priority? | Keeps it |
| 19 | Hours: the pedido's at entry, the programme's beside them; from G the Pedidos form starts Duração and the 1ª preferência list from the programme's mission? | Yes |
| 20 | Approving a pedido for a student who already has a booked flight of the same mission: another flight, with "já tem voo agendado de <missão> às 08:20 nesta data" on its Processamento line and in the toast? | Another flight, with the warning |
| 21 | Pedidos cleared before the cut-over ("Limpar demanda" before D) that someone approves later: "dispensado", back only with "Trazer de volta"? | Yes |
| 22 | Who reads Processamento: the Gestor, as the Demanda today; the Secretaria? | Gestor yes; Secretaria no |
| 23 | May the warning `escolhido-saiu` (js/engine.js:994) stop naming "Demanda", in its own commit, with no golden changed? | Yes |
| 24 | May rejections gain `stuId` and `fKey` in a commit that changes 174 golden alerts and no rule? | No; paired by position |

## 9. Risks, and what would make this design wrong

| Risk | Effect | What contains it |
|---|---|---|
| Pedro wants the day to store nothing about requests | decision 1 falls and B's store is the only way | question 1, first |
| One more action per restriction edit | a build day with many edits is slower than today (2.13: about 20 against 11 for k = 8) | the panel follows the next line without closing; the red box and Processamento both open it; question 2 |
| A counter cancellation nobody applies | on the day of operation the TV and the stored schedule keep a flight the student cancelled | the 60 s notice, the rail item, the card row; D's sentence (status Cancelado on the day); question 8 |
| The rule of decision 4 against a date started early | an approval on a date the operator touched days ahead imports into that early day | her own early write, as today; the notice says the click starts the date |
| An unpinned flight of today past its time, with its pedido cancelled | it leaves at the click (only pins prove a place) | on an approved day every flight is pinned and H fixes late entries |
| The pairing mirrors the engine's order | a changed queue sort sends reasons to the wrong line | the invariant test fails at once; at run time a label that does not line up gives no reason, never a wrong one |
| The bulk change of course missions | a wrong rule would send results to the wrong code | only marked records, never after the flight's start, all or nothing per student, listed before the click, one History entry each, its own commit |
| A sleeping pin wakes on a slot booked meanwhile | the booked flight shows a conflict | visible, with Sugestões; question 6 |
| Two meanings of "off" | "tirado pelo operador" against "sem aprovação" | two states with their own texts; one stored fact each (`fly` with the id held; the id out) |
| Records are never deleted | a date keeps the off records of cancelled pedidos (take-off revert limit of 500; course-code lock while the date is open) | a handful per date |
| "Recomeçar" deletes hand-made records | a later booking may reuse a deleted extra's `mid` and an old History entry may act on it | the same as today's "Limpar demanda"; pedido records keep their numbers; re-entries go above every old number; `setFly` and "↶ Desfazer" check the pedido |
| Format 28 in E | E can no longer be reverted after Pedro's opening | E has no visible change and its rules are covered by the 21 import tests and R10; G's revert is what the go-live needs |
| The History's read per date | a busy date hides older bookings from `agendamentosEmVolta` | 500 in G |
| The counts of e2e lines that change in G | estimates of the work, counted with grep | the per-screen drivers of desenho-entrega's F0 |
| Sibling notes not yet aligned (1.4: desenho-entrega's 28, G's SQL, the go-live check, F0b's names, the Secretaria in D's migration row) | the plan carries two answers | 1.4 lists each with this note's default |

What would make it wrong, one line each: a requirement that the day hold no request; editable pedidos (settled by D's
decision 11: a wrong pedido is cancelled and registered again, a new id and a new record, so the old record leaves as a
cancelled pedido and the operator's restrictions and the place do not carry over); every booking must be a pedido;
schedules that must follow the pedidos without anyone with write access opening the date; a rule that a flight's key
come from the pedido id; an operator who edits most flights every day (then C's block or inline fields earn their cost).

<!-- revisado -->
<!-- fim -->
