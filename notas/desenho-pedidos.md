# Desenho: Pedidos (D): the rename, the approval state, the preferences on a pedido and the page

Read at the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`); paths are relative to it. "mapa-X n" is
section n of a discovery note; "desenho-X" is another design note of this folder. "(ran)" = `node` on the pure modules of
the worktree, read-only, nothing written there; the runs of this revision are
`/private/tmp/claude-501/-Users-pedrofernandes-ACPM/5d1f0955-e20a-47d4-acd8-3ee432e7a836/scratchpad/dono-pedidos/exp-a.mjs`
and the reviewers' `/private/tmp/claude-501/-Users-pedrofernandes-ACPM/5d1f0955-e20a-47d4-acd8-3ee432e7a836/scratchpad/rev-pedidos/exp1.mjs`
and `/private/tmp/claude-501/-Users-pedrofernandes-ACPM/5d1f0955-e20a-47d4-acd8-3ee432e7a836/scratchpad/rev-pedidos/exp2.mjs`, run again here.
Local working note: never commit.

Words in this note: a **pedido** is a row of `public.solicitacoes` (in code, `solicitacao`); a **record** is an entry of
`dia.pedidos` (in code, `pedido`): a student's main request or one of its `extra`. A bare `20261114230012:41` is a file
of `supabase/migrations/`. "Today" in a rule is today in São Paulo.

What this note assumes of the other topics (if one is false, the place that changes is named):

| # | Assumption | If false |
|---|---|---|
| S1 | F0 gives the redraw registry (`js/redesenho.js`), one stylesheet per screen (`css/agenda.css`), the fake server by topic (`test/e2e/falso/agenda.js`) and the Manual's phrases by owner (`test/e2e/manual-frases.js`) (desenho-entrega 2.2, section 5) | D edits `js/actions.js:324-326`, `js/main.js:127-139`, `css/app.css:1147-1179`, `test/e2e/supabase-falso.js:369-400` and `test/e2e/app.spec.js:159-164` directly |
| S2 | **F1 is merged before D** and leaves: the card "Agenda" that opens `#s-age` (`TELAS.age`, `js/telas.js`); the rail as the only control of the open date; no `#nav`, no `#selo-age`; the Agenda without its own calendar and day (desenho-casca D21); `ApiClient.contagemDaAgenda(de, até)` → `{ 'AAAA-MM-DD': n }` feeding the rail (D17); `js/linha-do-dia.js` building the card's rows and the rail's items from `contexto.pedidos`; the Secretaria landing on the first date open for pedidos (D22) | D deletes the calendar itself (`calendarioHTML`, `gradeDoMes`, `diaEscolhido`, `mesVisivel`, `mudarMes`, `escolherDia`, `carregarMes`, the `[data-cal]` listener, `.cal*` CSS) and creates the count method |
| S3 | F2's list gives groups, one action button per row (`acao`), dimmed rows, search, the multi-value filter and the phone's second view; the detail region can hold a static block of the screen while no item is selected (desenho-lista 2.2) | the form stays above the list, as today; nothing else changes |
| S4 | The core is posicao B1 with an explicit reconciliation (desenho-nucleo-a, desenho-nucleo-c): nothing enters or leaves a day without a write through `gravarAlteracao`; E is stacked on D | with records rebuilt at every load (desenho-nucleo-b), decision 4 goes back to posicao B3 (the Secretaria does not cancel an approved pedido) and `cancelar_solicitacao` refuses every past date |
| S5 | No Secretaria account exists at go-live (docs/PLAN.md:158; nobody could check the server) | nothing breaks; question 11 |
| S6 | D, E and G are merged in one sitting (desenho-entrega decision 13), so the screen of "D without G" is used only if the wave is cut | the interim of 2.9 is what she uses until G; it is complete |

## 1. Decisions

1. **Rename the screen text to "Pedidos"; D owns the card's label; keep the three modules, the ids, the storage keys, the table and the function names.**
   - Why: the text costs about 60 lines. Renaming modules and ids buys no behaviour and collides with `pedido`, which in code is the day's record. Renaming the table breaks the live app between the production migration and the merge. F1 ships the card as "Agenda", because a card carries the name of the screen it opens; card and screen change name in one commit of D (`TELAS.age.rotulo = 'Pedidos'` with the `h2`).
   - Evidence: mapa-pedidos 5.7 (552 / 334 / 150 / 289 occurrences in 81 files); `js/dias.js:22,34`; `js/backends/supabase.js:212,219,228`; lacuna-1-textos 0, 3, 4, 5; desenho-casca D7 and section 5 (row D). Table in 2.1.
   - Rejected: modules renamed to `pedidos.js` (two meanings of `pedido` in one codebase); to `solicitacoes.js` (coherent, but 13 importers that F1 and E edit, for nothing the operator sees; if wanted, one mechanical commit in step I); the table (level 3 of 2.1).
2. **One word on screen, two in code; "aprovar" never without its noun.** Screen: "pedido"; states "Aguardando aprovação", "Aprovado", "Cancelado"; "Aprovar pedido", "Retirar aprovação", against "Aprovar escala" and "Resultado: Aprovado". The rule of the code covers JavaScript identifiers, data fields and SQL objects: there the row is a `solicitacao`, `pedido` is the record, the fields are `aprovada_*`, and no identifier is a bare `aprovacao` (that is `S.aprovacao`, the schedule's). The screen's word stays where the screen's vocabulary already lives: `data-act` values (`cancelar-pedido` exists, 93 selectors use the family), the `agenda-` ids, glossary ids, test descriptions, History texts and the migration's file name. D also rewrites the one existing sentence the new state makes ambiguous, `js/views/reparo.js:34`: "O pedido mudou depois da aprovação da escala: …".
   - Evidence: mapa-pedidos 6.10, 6.12; lacuna-1-textos 6; `js/resultados.js:9`; `js/config.js:128`.
   - Rejected: "Aceitar / Aceito" for the pedido. It removes the triple meaning, but the request's own words are "approval state" and "aguardando aprovação · aprovados" (pedido.md:29, 104). Question 9.
3. **Three states, derived from columns.** Cancelado (`cancelada_em`), aprovado (`aprovada_em`), aguardando aprovação (neither). No status column. Refusing is cancelling, and no reason is stored (question 8).
   - Evidence: mapa-pedidos 5.1, 5.8; `20261110222506:20-22`.
   - Rejected: a `situacao` column (who and when would need more columns anyway: mapa-pedidos 7.2); a "recusado" state (a fourth filter and transition set that says nothing `cancelada_por` does not).
4. **Who does what.** Registers: Secretaria, Operador, Administrador. Approves and withdraws: Operador, Administrador, for a date from today on. Cancels a pedido of today or later, waiting or approved: the three, as today. An approved pedido of a past date is cancelled by nobody. Table in 2.3.
   - Why (the Secretaria's cancel): a cancellation writes nothing in a day. Until G the record stays in the demand; from G on the operator sees "1 pedido cancelado ainda na escala" and applies it with one click. Refusing her turns each cancellation that reaches the counter into a call plus four actions of the operator (open Pedidos, select, "Cancelar pedido", confirm), and narrows a rule that exists (`20261110222506:94-96`: she cancels any pedido today).
   - Evidence: pedido.md:29; mapa-pedidos 5.2; desenho-nucleo-a 2.3 ("If Pedro lets her, her browser writes nothing in the day"); 2.8 (the notice).
   - Rejected: posicao B3 (she cannot cancel an approved pedido): needed only under S4's alternative; kept as Pedro's choice in question 8, one clause (`42501`, hint `aprovada`).
5. **An Operador's pedido can be born approved, and a pedido past the deadline always is.** `registrar_solicitacao` gets `p_aprovar`; the form's main button for Operador and Administrador is "Registrar e aprovar"; the server approves when `p_aprovar` is true **or the date is outside the deadline** (only an operador gets there, through the Exceção da Coordenação); the 10-argument function (the one the live app calls) approves when the caller is an operador.
   - Why: with no Secretaria account, who registers is who approves; two steps would add one action per pedido, every day. The rule in the 10-argument function means a pedido an operator registers from an old tab is already approved.
   - Evidence: docs/PLAN.md:158; mapa-pedidos 5.8 and 7.4; the old import takes every pending pedido (`js/eventos/agenda.js:48`).
   - Rejected: born approved as a server rule with no parameter (the operator could not register "to decide later"); always two steps; "the exception registers approved" as a rule of the form only (a 13-argument call with the exception and `p_aprovar` false would store a waiting exception).
6. **Approval takes a list, can be repeated, and is a button on the row.** `aprovar_solicitacoes(p_ids bigint[]) returns bigint[]`: the ids it approved now; an id already approved, cancelled, unknown or of a past date is skipped. A waiting row carries the button "Aprovar"; "Aprovar todos (N)" sends exactly the waiting pedidos that the search and the filters show. Withdrawing lives in the detail and asks for the second click.
   - Why: today one click imports every pending pedido (`js/eventos/agenda.js:31-59`); one call per pedido would be N round trips with partial failures. F2's row switch is a synchronous field of the screen that goes through `js/eventos/registro.js`; an approval is a server call that can be refused, so it is the row's `acao`.
   - Evidence: desenho-lista decision 5 and 2.2 (`chave` against `acao`); `js/eventos/registro.js:37-52`.
   - Rejected: a switch that approves and withdraws (one click would withdraw an approval, and from G on take a flight off the schedule); approving "every pedido of a date" by date (it would approve pedidos the operator has not seen).
7. **One additive migration, `20261124100000_aprovacao_dos_pedidos.sql`, and D delivered as three PRs.** Eight nullable columns, a 13-argument `registrar_solicitacao` (the 10-argument one becomes a shim that calls it, so no rule can be bypassed through it), `cancelar_solicitacao` replaced, three new API functions and the internal conversion function. The 9-argument overload goes in the same file. D1 is the server with its mirrors (no change on screen), D2 the page, D3 the reads on a timer (section 5).
   - Evidence: mapa-banco 5.5 (house style), 5.7a, 5.8 item 3 (the mirrors in the PR of the migration); lacuna-1-pendencias D; desenho-entrega decision 9 and section 4.
   - Rejected: one function with three defaulted parameters and the 10-argument one dropped (it rests on PostgREST matching a 10-key call to a 13-parameter function, which nothing in this repo can test); a new name `registrar_pedido` (two names for one thing); one PR (about 66 pgTAP checks, a rewritten page, a new module with a timer and the Manual under one review).
8. **The deadline is untouched; the exception stops at Sundays and at past dates; a past date takes no approval, no withdrawal and no cancellation of an approved pedido.** `prazo_da_agenda_permite` is not replaced. The registration refuses a Sunday (`PT403`, hint `domingo`) and a date before today (`PT403`, hint `passada`) before the deadline test, so the exception never lifts them; today still works with the exception.
   - Why: a Sunday or past pedido can never be seen (no control opens a Sunday; the form offers no past date). An approval, a withdrawal or a cancellation of an approved pedido of a past date would, from G on, add a flight that did not happen to a flown schedule or propose taking one off (the BI, the instructors' hours and the next date's copy read stored schedules).
   - Evidence: mapa-banco 5.3 and 6.2; mapa-pedidos 4 ("No test covers a Sunday with the exception"); `js/eventos/agenda.js:24`, `js/main.js:89-90`; mapa-dados 5.8 (who reads a stored schedule); desenho-nucleo-b section 4 (asks D for the past-date refusals).
   - Rejected: as today; refusing today too (the same-day walk-in is what the exception is for); approvals of past dates "for the conversion's leftovers" (they ask for nothing: decision 16).
9. **The limit of 6 local flights counts what it counts today, and refuses.** Non-cancelled pedidos, waiting or approved, at the same 1st preference (`horario`); `PT422`; not lifted by the exception; not checked again at approval. The engine keeps applying the limit at the real take-off time. This leaves unbuilt, for this screen, Pedro's decision of 2026-11-17 ("warn and confirm for every local mission, never block; record who confirmed on the request"): question 3.
   - Evidence: `20261114230012:30-40`; `js/agenda.js:145-152`; `js/engine.js:469,839`; pedido.md:29 ("Keep the existing rules: … the local-flight limit"); docs/PLAN.md:375 item 6; the session memory note `lote-recursos-noturno-agenda` ("C (agenda fields plus local-cap override) has not started").
   - Rejected: counting only approved (the 7th would be refused at approval, far from the counter); counting the 2nd preference too (one flexible pedido would hold two slots); warn-and-confirm as the default (it contradicts the letter of the request of 2026-11-21 and needs an engine rule: a record that carries the confirmation must be allowed as the 7th at its time).
10. **Two nullable columns, `horario2` and `disponibilidade`; both empty is today's exact time. D owns the mapping.** `preferenciasDaSolicitacao(solicitacao, lista)` in `js/agenda.js` gives `p1`, `p2`, `jan`; `pedidoDaSolicitacao` calls it wherever it lives. An availability that does not contain the 1st preference is ignored (exact time).
    - Why: with one exact time the engine cannot move a pedido-born flight and the `horarios` criterion has nothing to act on. (ran) Three pedidos at 10:10 with one INVA: exact, one flies and two are rejected (`instrutores-ocupados`); with `jan: 'manha'`, all fly (08:20, 10:10, 11:30). (ran) `p1` 14:30 with `jan: 'manha'` flies at 11:30: the server accepts that pair, so the mapping needs a rule and not "tolerates".
    - Evidence: posicao A3, B2; mapa-pedidos 5.3; `js/compactar.js:111-112`; `js/engine.js:811`; `js/rules.js:19-27`; Pedro's batch of 2026-11-17 ("Agenda: add the resource, 2nd preference, instructor and priority so the import is complete").
    - Rejected: one exact time, which is the default of desenho-nucleo-a decision 17 (costed in 2.6; the plan carries one answer: 2.10); reusing `janela` for the period (the table check `(janela = 'horario') = (horario is not null)` forbids a period with a time, and the live app shows such a row as "Tarde", without its time: `js/views/agenda.js:38-40`); refusing on the server an availability that excludes the 1st preference (it would put 12:40 and 17:30 in SQL).
11. **The page: the list is the open date's pedidos; the middle pane is the form or the detail; a pedido is not edited.** A selected pedido shows a read-only detail with actions. What changes afterwards has two different paths. A flight's time, duration, resource, instructor or priority on its date is an operator restriction on the day's record (the Demanda until G; the Escala stage from G on): the pedido keeps what was asked. Cancel plus "Registrar de novo…" is only for a pedido registered wrongly (student, mission type, date), and has four effects: past the deadline the replacement is registered only through the Exceção da Coordenação and stored with `excecao`; the Secretaria cannot do it past the deadline; the new pedido has a higher id and loses the place that "who booked first" gives (`js/engine.js:324-328`); the new pedido gets a new record, so what the operator set on the old one (instructor, priority, pin) does not pass to it.
    - Evidence: mapa-pedidos 5.1 (no edit function), 3; pedido.md:33, 71-90; posicao B2; `20261114230012:41-48,55`.
    - Rejected: an `alterar_solicitacao` function for Operador and Administrador that keeps the id and `excecao` (rules for the deadline, the limit and the version on an edit, two audit columns, about 8 pgTAP checks; question 2); the form in a dialog (pedido.md:56).
12. **The list follows the open date; the form has its own field, "Data do pedido".** The field starts on the open date when it still takes pedidos and on the first open date when it does not. The list, the rail and the app stay on the open date. A pedido for another date is registered (and approved), never imported from here.
    - Why: after 13:00 the operator builds tomorrow, which is closed for pedidos, while pedidos for the day after keep coming. With one date strictly: "Pedidos", "Abrir <primeira data aberta>" (the whole app changes date, about ten requests), register, the rail's day to come back (ten more): three clicks and two date loads where today there is one click (`diaPadrao`, `js/views/agenda.js:56-63`), and the first control she meets on the closed date is "Exceção da Coordenação".
    - Evidence: mapa-pedidos 5.5; mapa-avisos 5.4 (ten requests per date change); desenho-casca 2.9 and 2.13 ("Register a pedido after 13:00 (Operador): 2 or 3"); `test/e2e/agenda.spec.js:202`.
    - Rejected: one date strictly, with the button (posicao B4; kept as Pedro's choice, question 6); the Agenda's own day back (a second control of what the page shows).
13. **An approval made here writes the day only when the date is already started. It never creates a day.** The pedido enters the demand at once when all five hold: its date is the open date; the date's data are read; the open date already has a stored day; nothing of `resultados`, `cursos` or `cursos-pendentes` is unavailable; the stored day did not change on another computer. Otherwise the pedido is only marked approved and the notice "N pedidos aprovados fora da demanda · Importar" brings it with one click, her own act, as today's import is.
    - Why: a date copies the day before only while it has no stored day (`js/storage.js:190`); from its first save the aircraft hours to the 50 h inspection, the rodízio queues, Disponível, the INVAs' Vem and windows and the hangar order are frozen. Today registering never writes a day. (ran) Monday stored with an aircraft at 10 h and one 1 h flight; Wednesday saved from it, as an approval with Wednesday open would do: 11 h; Tuesday then created and flown 1 h on the same aircraft; Wednesday reopened: still 11 h, where 12 is right. With unread results the import binds no course mission, and the mission is bound once (`js/views/etapas.js:26-29`).
    - Evidence: `js/storage.js:190,212` (`novo: !dia`); `js/dias.js:118-137`; `js/actions.js:166-195,298` (`lerData` drops `novo`); docs/PLAN.md:176, 306; `js/eventos/agenda.js:99-121` (registering has no `gravarAlteracao`); desenho-nucleo-c decision 3 (the same finding).
    - Rejected: at once on every open date (posicao B1: in the no-Secretaria case every date would be created at its first pedido, a day or more early); always a click (one more click for every late pedido on a date under construction and on the day of the flight); "after the date has received pedidos" (`S.importadas.length > 0`, desenho-nucleo-c: a day stored by another edit would ask for a click for nothing); "or the next operating day" (tomorrow's day would be created in the morning, from today's unfinished schedule).
14. **One cache of the open date's pedidos, read again on a timer together with the day's version; no notice offers a write against a stale day.** `js/solicitacoes-da-data.js`; every 60 s while the page is visible, when it becomes visible, when the connection returns, after this browser's own actions, when a date opens, and on "Atualizar". Each read also asks whether the stored day's `versao` is still the one this browser holds. When it is not, the only notice is "A escala desta data mudou em outro computador · Atualizar", and "Importar" (and the automatic entry of decision 13) first reads the date again.
    - Why: `solicitacoes` has no version. An approval made on another computer was also imported and saved there, so "approved elsewhere, not in my day" is really "the day changed elsewhere": a click on "Importar" would save over a newer day, `salvar_dia` answers `PT409` and the screen locks until reload (`js/backends/supabase.js:53-68`).
    - Evidence: mapa-avisos 5.4 (three callers, two caches); mapa-pedidos 1 (no polling); mapa-dados 5.4, 5.8; `js/eventos/agenda.js:31-59` (the import reads the pedidos again, never the day); the TV already polls (`js/painel.js:169-170,274`).
    - Rejected: Supabase Realtime (a publication change and a websocket the fake server does not model, with 23 spec files on it); events only (a pedido registered at the counter would wait for the operator's next date change).
15. **Counts by a read function; the rail's cell stays as F1 draws it.** `solicitacoes_por_dia(p_de, p_ate) returns jsonb`, `security invoker`. D replaces the body of F1's `ApiClient.contagemDaAgenda` and keeps its shape (`{ date: n }`, n = not cancelled), so D edits no file of the rail. The function already returns the two numbers; a mark for "some wait" is H's, with the pipeline states.
    - Evidence: mapa-avisos 5.4; `supabase/config.toml:19`; `20261115151734:4-43` (the same shape, `horas_dos_instrutores`); desenho-casca D17 and 2.8.
    - Rejected: paging the row query (every column of every row of the month, for a count); a second count API with another shape and a new look for the day (it would mark every past day with a leftover for good).
16. **The cut-over is inside the migration, in one internal function that pgTAP tests and that G's migration runs again.** Approved at the cut-over: (a) on a date before today, every non-cancelled pedido whose id is in its day's `importadas`; from today on, the same only when a record of that day still carries it, whether it flies or not; (b) once, in D's migration: the non-cancelled pedidos from today on that an Operador or Administrador account registered and that are not in their day's `importadas`. A pedido whose approval was withdrawn is never approved by the function. No data-format number.
    - Why: before commit `bfd38e4` (2026-11-14) the import wrote only `importadas` and no `solicitacao` on the record, so those pedidos flew and no record names them; nothing reconciles a past date. From today on, an id left in `importadas` by "Limpar demanda" or "✕" must not come back. A record with "Voa" off is a pedido the operator accepted and then took off the date: it stays approved (desenho-nucleo-a decision 11).
    - Evidence: `git show bfd38e4^:js/agenda.js` (`importadas.push`, no `solicitacao`); mapa-pedidos 5.1, 7.3; mapa-banco 5.7a; (ran) import, "Voa" off, import again: `{novos: 0, atualizados: 0}`, `importadas` stays `[7]`.
    - Rejected: every id in `importadas` on every date (it approves what "Limpar demanda" took out of a future date); "carried and flying" (a pedido with "Voa" off would read "Aguardando aprovação" and "Aprovar todos" would turn the flight back on); rule (b) without the test of `importadas` (it would approve what was imported and then cleared); a backfill by the app at the first open (it needs a format number only to run once).
17. **Between D and G: four facts, three tags; D adds, never removes.** The facts are `aprovada_em`, the id in `S.importadas`, a record that carries it, and `fly`. An approved pedido reads "Na demanda" (imported, a record flies), "Tirado da demanda" (imported, no flying record: the operator took it out; no button, out of the notice's count) or "Fora da demanda" with "Importar" (never imported). The import takes approved pedidos that were never imported. An approval made here of a pedido whose record is off turns `fly` on. D never takes a record out: that is the reconciliation of E and G.
    - Evidence: posicao B1, B3; `js/agenda.js:112,116`; `js/fixos.js:95-117` (`limparDemanda` leaves `importadas`); (ran) after "Limpar demanda" the import brings nothing; forgetting the id and importing again gives one record.
    - Rejected: tags by the records only (after "Limpar demanda" every approved pedido would read "Fora da demanda" with an "Importar" that brings nothing); D turning `fly` off on cancel and withdraw (a second, temporary copy of E's rule); an id left out of `importadas` (D has no format number: a tab from before D would import that pedido again as a second record).
18. **The copies of the rules are tied by shared cases.** `test/helpers/casos-das-solicitacoes.js` runs against the local backend and the fake server, and `espelho-do-banco.test.js` checks that each case is a pgTAP check and that the SQL constants are the app's.
    - Evidence: mapa-banco 5.6 ("For the agenda … there is no automated link to the SQL"); mapa-pedidos 4 (constants compared by nothing); pgTAP is not in CI.
19. **The History logs what changes the day, as today; every transition keeps who and when on the row.** The History gets the entries of the import, with the prefix "Pedidos:". Registering, approving and cancelling stay on the row. A withdrawal clears `aprovada_*` and fills `aprovacao_retirada_em`, `_por`, `_usuario`, which the next approval clears; the same columns keep the conversion from approving it again.
    - Evidence: mapa-pedidos 1; `registrar_historico` is operador-only (`20261110202010:16-18`), so the Secretaria could not log; the counterpart on the day ("Voa" off, "Tirar da escala") is a History entry (`js/eventos/demanda.js:189-191`).
    - Rejected: History rows written by the SQL functions (History text in SQL and in three mirrors, and a duplicate of the import's entry); a withdrawal that leaves no trace.
20. **Two improvements of the form wait for E's module, and D does not copy its rule.** The list of the 1st preference stays the default category's, and the Duração starts at 1 h (2 h for the simulator; the fixed ones), as today. Both depend on "the course mission this pedido would get", which is the binding rule of the import; E gives it one function (`missaoDaEntrada`, desenho-nucleo-a 2.2) and G wires the form to it.
    - Evidence: `js/agenda.js:119-125`; (ran, mapa-pedidos 5.3) an IFR pedido at 08:20 for a mission the programme flies in the PA-34 is rejected (`{eq:'PA-34', p1:510, jan:'h500'}`); `js/agenda.js:71-74` (the registered hours win over the programme's); posicao B2.
    - Rejected: `tipoPrevistoDoRecurso` in `js/agenda.js` (a second copy of the binding rule, dependent on a programme and results that may be unread); a snap in the mapping (it overlaps the same gap; E decides).

## 2. How it works

### 2.1 The rename, by level

| Level | What | Count | Cost | Here |
|---|---|---|---|---|
| 1. Screen text | the card's label (`TELAS.age.rotulo`), the page title, the page's texts and toasts, the History prefix of new entries, the glossary group, the Manual section, README | `js/telas.js`: 1 line; `index.html`: `:275`, `:302` and the Manual's `<h4>Agenda</h4>` with 2 paragraphs and 10 mentions (mapa-pedidos 5.7); `js/`: 10 lines in 3 files (lacuna-1-textos 3) and `js/views/reparo.js:34`; `js/glossario.js:14,70`; `README.md:13-14,209`; 2 SQL messages and the table comment, reworded for free inside D's migration | small; about 14 assertion lines in 6 spec files | D |
| 2. Modules, ids, classes, keys | 3 modules, 13 importers, 289 id, class and attribute occurrences (93 in `agenda.spec.js`), `acpm4_agenda`, `acpm_agenda_registrado_por` | 81 files in all | medium, mechanical, conflicts with F1 and E | not done; optional in I |
| 3. Table and functions | `solicitacoes`, 4 functions, the index, the policy | 150 occurrences | the live app fails to read, register and cancel until the merge (mapa-pedidos 5.7) | never |

Surviving controls keep their ids (`#s-age`, `#form-agenda`, `#ag-aluno`, `#ag-missao`, `#ag-horario`, `#ag-horas`, `#ag-por`, `#ag-obs`, `#ag-excecao`, `#ag-erro`, `#agenda-prazo`, `#agenda-lista`, `#agenda-importar`, `data-act="cancelar-pedido"`, class `agenda-campo`, `body[data-agenda]`), so the specs that only fill the form keep working. New controls take ids of the same family (section 3).

| On screen | In code | Never |
|---|---|---|
| pedido (Pedidos stage; the same thing, enriched, in Processamento) | `solicitacao`, `solicitacoes` | `pedido` in an identifier, a field or an SQL name for a row |
| (no name on screen) the day's record | `pedido`, `dia.pedidos`, `CAMPOS_DO_PEDIDO` | |
| "Aguardando aprovação", "Aprovado", "Cancelado" | `situacaoDaSolicitacao(s)` → `'aguardando' \| 'aprovada' \| 'cancelada'`; `solicitacaoAprovada(s)` | "Pendente", "Confirmado" (flight statuses) |
| "Aprovar pedido", "Retirar aprovação", "Aprovar todos (N)" | `aprovarSolicitacoes`, `retirarAprovacaoDaSolicitacao`; `aprovada_em`, `aprovada_por`, `aprovada_usuario`; `aprovacao_retirada_*` | a bare `aprovar`, `aprovacao`, "Reabrir" (the schedule's) |
| "1ª preferência", "2ª preferência", "Disponibilidade" | `horario`, `horario2`, `disponibilidade` → `p1`, `p2`, `jan` | |
| "Fora do prazo" (the mark of a pedido registered past the deadline) | `excecao` | |

To state once in README "Estrutura": on screen it is "pedido"; in the code and the database the registered row is a `solicitacao` and `pedido` is what the day carries to the engine.

### 2.2 Data

New columns of `public.solicitacoes` (all nullable; an existing row keeps its meaning with all eight empty):

| Column | Type and check | Meaning |
|---|---|---|
| `aprovada_em` | `timestamptz` | null: not approved |
| `aprovada_por` | `text` (no length check, like `conta`: an account without a name stores its e-mail) | the account's name, `coalesce(nullif(perfis.nome, ''), auth.users.email)`; the conversion writes `'importação anterior'` |
| `aprovada_usuario` | `uuid references auth.users (id) on delete set null` | the account; null on converted rows of rule (a) |
| `aprovacao_retirada_em`, `aprovacao_retirada_por`, `aprovacao_retirada_usuario` | as the three above | the last withdrawal; cleared by the next approval |
| `horario2` | `text check (horario2 ~ '^[0-2][0-9]:[0-5][0-9]$')` | the 2nd preference |
| `disponibilidade` | `text check (disponibilidade in ('manha', 'tarde', 'noite', 'qualquer'))` | null: only at the 1st preference (today's meaning) |
| table check `solicitacoes_preferencias_check` | `(horario2 is null or (disponibilidade is not null and horario2 <> horario)) and (disponibilidade is null or janela = 'horario')` | |
| table check `solicitacoes_aprovacao_check` | `aprovada_em is null or aprovacao_retirada_em is null` | approved, or withdrawn, never both |

Unchanged: `janela` stays `'horario'` and `horario` stays required for every new pedido (`20261114230012:22-24`); rows by period from before 2026-11-14 stay as they are. The read policy "perfis da escala leem" already covers the new columns; no write policy is added (`leitura.test.sql:63` stays true). In local mode the same keys go into each row of `acpm4_agenda`; `aprovada_por` and `aprovacao_retirada_por` hold the remembered "Registrado por" (`acpm_agenda_registrado_por`), else `'Operador'`.

### 2.3 States and transitions

| Transition | Operador, Administrador | Secretaria | Gestor | Function |
|---|---|---|---|---|
| nothing → aguardando | "Registrar sem aprovar", inside the deadline | "Registrar pedido", inside the deadline | no | `registrar_solicitacao`, `p_aprovar` false |
| nothing → aprovado | "Registrar e aprovar"; past the deadline, "Exceção da Coordenação" (`excecao = true`, always approved) | no (`42501`, hint `aprovar` or `excecao`) | no | `registrar_solicitacao` |
| aguardando → aprovado | the row's "Aprovar", the detail's "Aprovar pedido", "Aprovar todos (N)"; date from today on | no | no | `aprovar_solicitacoes` |
| aprovado → aguardando | the detail's "Retirar aprovação", two clicks; date from today on | no | no | `retirar_aprovacao_da_solicitacao` |
| aguardando → cancelado | the detail's "Cancelar pedido", two clicks | the row's "Cancelar", two clicks | no | `cancelar_solicitacao` |
| aprovado → cancelado, date from today on | the detail's "Cancelar pedido", two clicks | the same; the toast adds "Avise o operador: o voo continua na escala até ele atualizar." | no | `cancelar_solicitacao` |
| aprovado → cancelado, past date | no (`PT403`, hint `passada`) | no | no | |
| cancelado → anything | no: "Registrar de novo…" | | | |

- Local mode has no profiles: whoever is not in the Gestor role does everything (as today, `js/backends/local.js:153`).
- Shown, not stored (open date only): "Aluno fora do cadastro" and "Aluno inativo" (no "Aprovar" on the row, with that reason; "Aprovar todos" skips them); on a date before today a waiting pedido reads "Sem aprovação", has no action besides "Cancelar pedido" and asks for no attention.
- While a call is in flight its button is off (`disabled`, `aria-busy`). After a refusal the toast says why, the cache is read again and the row shows the state the server has.

What a transition does to the day:

| Made in this browser | D, until G | From G on |
|---|---|---|
| → aprovado, for the open date, with the five conditions of decision 13 | the pedido enters the demand at once: `entrarNaDemanda`, one `gravarAlteracao('inc', …)`. An approved schedule keeps `aprovacao`; the flight is placed around the pins, as any import after "Aprovar escala" does today; the toast and the History line end with "(escala aprovada)" | the reconciliation adds the record (desenho-nucleo-a 2.3), under the same five conditions |
| → aprovado, a condition missing | nothing is written; the row reads "Fora da demanda"; the notice offers "Importar" or "Atualizar" (2.8) | the same notice, "Atualizar a escala" |
| → aprovado, for another date (the form's "Data do pedido") | nothing is written in any day; the rail's number of that day grows | the same |
| aprovado → aguardando or cancelado, while a record carries it and flies | the record stays; the row says "Ainda na demanda"; the notice names the student and links to the Demanda with its search filled | the reconciliation takes it off, except what the core design keeps (a flight with a status that pins it or with a result) |
| the same, on the day of the flight or with the schedule approved | the detail says, above "Cancelar pedido": "Este pedido tem voo na escala. Se o aluno desistiu ou o voo não vai sair, marque o voo como Cancelado na Escala: ele fica na escala, com o motivo. Cancelar o pedido é para um pedido registrado por engano." (shown when the record has a status, `S.aprovacao` exists or the date is today) | the same sentence |

Cost that stays: an approval made here on a date already started saves that day. If another Operador or Administrador account does it while the operator builds the same date, her next change is refused with `PT409` and her screen locks until reload ("Outra pessoa alterou a escala…", `js/actions.js:138-145`); today a registration writes only `solicitacoes`. The 60 s read tells her before she writes ("A escala desta data mudou em outro computador · Atualizar"). Question 5.

### 2.4 Server functions (all `set search_path = ''`; API functions `revoke … from public, anon; grant … to authenticated`)

| Function | Who | Checks, in order |
|---|---|---|
| `registrar_solicitacao(p_data date, p_aluno integer, p_aluno_nome text, p_missao text, p_janela text, p_horario text, p_horas numeric, p_registrado_por text, p_observacao text, p_excecao boolean, p_horario2 text, p_disponibilidade text, p_aprovar boolean) returns bigint`, security definer, no defaults | secretaria, operador | 1 profile → `42501` · 2 `p_janela`, `p_horario` → `22023` hint `horario` · 3 duration, Ground 1.5 → `22023` hint `horas` · 4 **new**: `p_horario2` not `HH:MM`, equal to `p_horario`, or given without `p_disponibilidade` → `22023` hint `horario2`; `p_disponibilidade` outside the list → `22023` hint `disponibilidade` · 5 **new**: Sunday → `PT403` hint `domingo`; `p_data < (now() at time zone 'America/Sao_Paulo')::date` → `PT403` hint `passada` · 6 local limit, same lock and count as today → `PT422` hint `locais` · 7 deadline → `PT403` hint `prazo`; exception by a non-operador → `42501` hint `excecao` · 8 **new**: `p_aprovar` by a non-operador → `42501` hint `aprovar` · 9 insert; `aprovada_*` filled when `p_aprovar` **or the date is outside the deadline** (table checks → `23514`) |
| `registrar_solicitacao(…10 arguments…)`, `create or replace`, same signature | same | body: `return public.registrar_solicitacao(<the 10>, null::text, null::text, coalesce(public.perfil_atual()::text = 'operador', false));` |
| `registrar_solicitacao(…9 arguments…)` | | `drop function` (the first in the repo; the headers of `20261114222031:6-7` promised it) |
| `cancelar_solicitacao(p_id bigint, p_cancelada_por text) returns void`, replaced | secretaria, operador | profile → `42501` · `select … for update`; not found or cancelled → `P0002` · **new**: approved and `data` before today → `PT403` hint `passada` · update (`aprovada_*` stay, as the record) |
| `aprovar_solicitacoes(p_ids bigint[]) returns bigint[]`, security definer | operador | profile → `42501` 'somente operadores aprovam pedidos' · null, empty or more than 200 ids → `22023` hint `ids` · `update … set aprovada_* = …, aprovacao_retirada_* = null where id = any(p_ids) and cancelada_em is null and aprovada_em is null and data >= <today> returning id`, in id order |
| `retirar_aprovacao_da_solicitacao(p_id bigint) returns void`, security definer | operador | profile → `42501` · `select … for update`; not found, cancelled or not approved → `P0002` · `data` before today → `PT403` hint `passada` · sets the three `aprovada_*` to null and fills the three `aprovacao_retirada_*` |
| `solicitacoes_por_dia(p_de date, p_ate date) returns jsonb`, `language sql stable`, **security invoker** | whoever the read policy lets read | `{ "2026-11-20": { "aguardando": 2, "aprovadas": 5 } }`; cancelled ones and days without pedidos are left out; `{}` for the TV and an account without profile |
| `aprovar_solicitacoes_de_antes_da_aprovacao(p_dos_operadores boolean) returns integer`, security definer, **not granted** (`revoke … from public, anon, authenticated`) | the migrations of D and G, and pgTAP | the conversion of 2.9; can run again without changing anything |

Messages follow the house style (lower case, no full stop) and say "pedidos", not "agenda". Every refusal of the new functions carries a hint. The live app reads only the code (`js/backends/supabase.js:223,229`), so a new hint changes nothing for it.

- **Repeating a call.** Approving again changes nothing and keeps the first approver; two operators approving at once is safe (the second `update` finds `aprovada_em` set). Withdrawing or cancelling twice answers `P0002`, as cancelling does today. Registering twice still makes two pedidos (no unique constraint, as today: mapa-pedidos 2.1): the client keeps the buttons off during the call and reads the cache again after a failure (2.5). The conversion can run any number of times.
- **RLS and grants.** Nothing changes: one read policy, no write policy, writes only through the functions.
- **Gaps the maps found that D leaves as they are:** `missao` is free text on the server (mapa-banco 5.3); `aluno` is not checked against the cadastro (question 17); the Noturno's 4 h is forced only by the form and by the record's normalisation (mapa-pedidos 4); a waiting pedido of any date is cancelled by whoever registers; the closed course in the import belongs to E (docs/PLAN.md:424).

### 2.5 Client

| Where | What |
|---|---|
| `js/backends/supabase.js` | `registrarSolicitacao({ …, horario2 = null, disponibilidade = null, aprovar })`: without `aprovar` it sends the 10 parameters (D1: the app as it is); with it, the 13 (D2). `aprovarSolicitacoes(ids)`; `retirarAprovacaoDaSolicitacao(id)`; `solicitacoesPorDia(de, ate)`; `diaMudou(data)`: waits for this browser's saves in flight, reads `select versao from dias where data = …` and answers whether it differs from the version held for `dia:<data>` (0 when the day is not stored). The pedido errors go through `erroComCampo` (the hint becomes `campo`, as in personal data: `:32`) |
| `js/backends/local.js` | the same, with the same codes and hints; `aprovar` undefined behaves as the shim (who is not Gestor has the operator's rights: approved); `diaMudou` answers false (no versions in local mode). The rows of `acpm4_agenda` get the new keys once, by the rule of 2.9 over `acpm4_dia_*` (rule (b) for every pedido: there are no accounts), the first time a pedido method runs after the update; the marker key `acpm4_agenda_aprovacoes` says it was done. It writes only `acpm4_agenda`, never a day or the cadastro |
| `js/storage.js` | `ApiClient.aprovarSolicitacoes`, `.retirarAprovacaoDaSolicitacao`, `.diaMudou`; `.contagemDaAgenda(de, até)` keeps F1's name and shape, with the body `contagemPorDia(await this.backend.solicitacoesPorDia(de, até))`; `.agenda`, `.registrarSolicitacao`, `.cancelarSolicitacao` keep their names |
| `js/actions.js` | `lerData` keeps `novo` (`:298`); `export const diaJaGravado = () => …`: false for a date read without a stored day, true from this browser's first `save()` of it. The call of `lerPedidosDaData()` (`:326`) becomes the cache's |
| the fake server (`test/e2e/supabase-falso.js:369-400`; `test/e2e/falso/agenda.js` under S1) | the 13-key call (it has `p_aprovar`) with every rule of 2.4; the 10-key call as the shim; a call without `p_horas` answers 404 like a function that does not exist (today it plays the 9-argument overload, `:377-386`); `aprovar_solicitacoes`, `retirar_aprovacao_da_solicitacao`, `solicitacoes_por_dia`; the hint in every refusal; `novaSolicitacao(campos)` for the tests that push rows into `solicitacoes` |
| `clienteFalso` (`test/unit/backend-supabase.test.js:17-199`) | the three new function names (it throws `função inesperada` for an unknown one), the 13 parameters and the `versao` read. `backendEmMemoria` (`test/unit/storage-dias.test.js:20-65`) only lists pedidos: no change |
| `js/agenda.js` (pure; the home of the pedido's own rules) | `situacaoDaSolicitacao(s)`; `solicitacaoAprovada(s)` (the predicate E's module receives; desenho-nucleo-a calls it `pedidoAprovado`); `resumoDasSolicitacoes(lista)` → `{ registradas, aguardando, aprovadas, canceladas, foraDoPrazo }`; `novidadesDasSolicitacoes(antes, depois)` → `{ novas, canceladas, aprovadas, semAprovacao }`; `preferenciasDaSolicitacao(solicitacao, lista)` → `{ p1, p2, jan? }` (2.6); `disponibilidadeDaSolicitacao` reads the new column by the same rule; `opcoesDeDisponibilidadeDaSolicitacao(missao, minuto)`; `erroDasPreferencias({ horario, horario2, disponibilidade })` → null or `{ code: '22023', campo }`; `datasParaRegistrar(hoje, dataAberta, { excecao })` → `{ opcoes: [{ data, fechada }], padrao }`; `contagemPorDia(resposta)` → `{ date: aguardando + aprovadas }`, without Sundays. Only until G: `situacaoNaDemanda(solicitacao, estado)` → `'fora' \| 'voa' \| 'tirada'`; `solicitacoesParaImportar(lista, estado)` (approved, `'fora'`, student in the cadastro); `solicitacoesAindaNaDemanda(lista, estado)` (not approved or cancelled, `'voa'`); `entrarNaDemanda(estado, solicitacoes, opcoes)` → `{ novos, atualizados, religados, semAluno }` |
| `js/solicitacoes-da-data.js` (new; one cache for the list, the card, the rail and the import) | `solicitacoesDaData()` → `{ data, lista, lidaEm, erro, diaMudou }`; `lerSolicitacoesDaData()` (ignores an answer for a date that is no longer open; keeps the error instead of an empty list; after each read calls the registry's redraw with the reason `'solicitacoes'`, S1); `vigiarSolicitacoes()` (the triggers of 2.8). They replace `lerPedidosDaData` and `pedidosDaData` of `js/views/selos.js:36-45`, the names the shell and the core notes use: one name, this module's |
| `js/views/agenda.js` | `rAgenda()` (the list model for F2, the middle pane, the notices), `abrirSolicitacao(id)`, `abrirNovaSolicitacao(modelo)`, `podeEditarAgenda`, `preencherHorariosDaAgenda`, `lembrarRegistradoPor`, `solicitacoesDoAluno`, `descreverSolicitacao` |
| `js/eventos/agenda.js` | the form by delegated listeners (two submit buttons and the exception), `aoAcionar('aprovar-pedido')`, `('aprovar-todos')`, `('retirar-aprovacao')` (standard guard), `('cancelar-pedido', …, { confereAPermissao: true })`; plain listeners, with no `data-act`, for what only changes the screen: "+ Novo pedido", "Registrar de novo…" (`#agenda-repetir`), "Atualizar", the row selection (F2) |
| the import handler (`importarDaAgenda`: `js/eventos/agenda.js:31-59` today; `js/eventos/importacao.js` if F0 moves it) | D changes three things: it asks `ApiClient.diaMudou(DATA)` and, when true, runs `carregarData(DATA)` before computing anything; its filter is `solicitacoesParaImportar`; its texts (section 3). E then replaces the call of `importarSolicitacoes` on top of D's version |

`entrarNaDemanda`, for each approved pedido given: a record carries it → `fly = true` (nothing else changes: the `mid`, the instructor, the priority and the pin stay); no record carries it → the id is forgotten and `importarSolicitacoes` brings it again in the same write (the id is back in `importadas` before the save). It never touches a record without `solicitacao`.

Rules of every handler: the buttons are off while a call is in flight (today nothing turns the submit off during the call, `js/eventos/agenda.js:98-102`, so a double click inside it registers twice: inferred, not run); after every `await`, compare `DATA` with the date captured before (mapa-dados 5.4, rule 4); on a failure without a code, read the cache again before showing the error (the pedido may have been registered). "Registrar de novo…" has no `data-act`: the registry refuses every `data-act` without `confereAPermissao` when `isGestor()` is true, and it is true for the Secretaria (`js/eventos/registro.js:24`; `js/sessao.js:171`). The automatic entry that follows an approval checks the five conditions without a toast (`dadosLidos`, `diaJaGravado()`, `S.indisponiveis`, `ApiClient.diaMudou(DATA)`).

### 2.6 The preferences

The form, in this order: Data do pedido, Aluno, Fase / missão, 1ª preferência, Disponibilidade, 2ª preferência, Duração (h), Registrado por, Observação.

| Field | Options | Rule |
|---|---|---|
| "1ª preferência" (`#ag-horario`, today "Horário") | as today: the take-off times of the mission's default category, `horariosDaMissao(S.horarios, missao, regra.defEq)`; the Noturno 17:30, the Voo Solo 06:30 | required (decision 20 for the times of the programme's category) |
| "Disponibilidade" (`#ag-disponibilidade`) | "Só na 1ª preferência" (default, stored as null) · the period of the 1st preference ("Manhã" or "Tarde") · "Qualquer horário" (`'qualquer'`) | off for the Noturno and the Voo Solo (one take-off time). `'noite'` is in the column's list only for symmetry with `janela`: no take-off list has a night time ((ran)) |
| "2ª preferência" (`#ag-horario2`) | "—" or a time of the same list inside the availability, other than the 1st | off while the availability is "Só na 1ª preferência"; cleared when the 1st preference or the availability leaves it outside |
| hint under the three (the glossary tips `preferencias` and `disponibilidade` are reused) | "Se a 1ª não couber, a escala tenta a 2ª e depois o horário livre mais próximo da 1ª, dentro da disponibilidade." | the engine's own order (`js/horarios.js:98-102`; docs/PLAN.md:285) |
| "Duração (h)" (`#ag-horas`) | as today: 1 h, 2 h for the simulator, fixed for the Ground and the Noturno | decision 20 for the programme's hours |

`preferenciasDaSolicitacao(solicitacao, lista)` (`lista`: the take-off times of the record's resource type):

| Pedido | `p1` | `p2` | `jan` | Note |
|---|---|---|---|---|
| `horario` only (every row of today) | t1 | t1 | `'h<t1>'` | byte-identical to today's import ((ran) `{p1:610, p2:610, jan:'h610'}`); a t1 that the list does not have keeps today's result (the list's defaults, exact `jan`): the 21 import tests do not change |
| `horario`, `disponibilidade` a period that contains t1 | t1 | -1 | the period | (ran) `p2: -1` survives `normalizeMissionFields`; the engine orders the other times by distance from t1 |
| `horario`, `horario2`, a period that contains t1 | t1 | t2 | the period | a t2 outside the period is never tried (the engine filters the starts by `jan`) |
| `horario`, a period that does **not** contain t1 (only an API call or a mirror can store it) | as the first row | | | the availability is ignored: (ran) `p1` 14:30 with `'manha'` would fly at 11:30 while the local limit counted 14:30 |
| `horario`, `'qualquer'` | t1 | -1 | absent | |
| `horario`, `horario2`, `'qualquer'` | t1 | t2 | absent | |
| old row by period (`janela` not `'horario'`) | the first two list times of the period | | the period | as today (`js/agenda.js:67-70`) |
| a Noturno or a Voo Solo with any availability | | | | the list has one time, so every row above gives the same flight |

- `pedidoDaSolicitacao` replaces its lines 64 and 68-70 by one call of this function. D makes that edit where the function lives at D's base (`js/agenda.js:63-80` today; `js/processamento.js` if F0 or E moved it), and whoever merges second applies the three lines again.
- "Only at the 1st or at the 2nd" cannot be said with `p1`, `p2`, `jan`: `jan` is a period, one exact time or nothing (`js/rules.js:19-27`). The form's hint says what happens instead. Question 14.
- The local limit counts the 1st preference only (decision 9).

The alternative, one exact time (the default of desenho-nucleo-a decision 17):

| | Two columns (this design) | One exact time |
|---|---|---|
| Migration | 2 columns, 1 table check, 2 parameters, 3 refusals | none of these |
| pgTAP | about 10 checks | 0 |
| Form | 2 fields and their dependency, about 60 lines | unchanged |
| Mirrors | local backend, fake server, `clienteFalso`: about 10 lines each | 0 |
| Mapping | `preferenciasDaSolicitacao`, about 8 unit tests | today's 2 rows |
| The engine | moves a flexible pedido; the `horarios` criterion acts | never moves a pedido-born flight unless the operator loosens it, one flight at a time, in the Escala stage (two actions each) or with "Encaixar" (about 3 clicks, and the result is pinned) |
| The Demanda's 1ª, 2ª and Disponibilidade | fields of the pedido, and still restrictions of the record afterwards | restrictions of the record only |
| Decisions | follows 2026-11-17 ("2nd preference" in the Agenda); reverses in part "the request is at a specific time only" (2026-11-14, docs/PLAN.md:302): the default stays one exact time | follows 2026-11-14; leaves 2026-11-17 unbuilt |

### 2.7 The page

```
┌ LIST (F2) ───────────────────┬ MIDDLE ───────────────────────────┬ RAIL (F1) ┐
│ Pedidos de sex 20/11 · 14    │ nothing selected, may register:   │ calendar  │
│ [+ Novo pedido] [Aprovar     │   "Novo pedido"                   │ with the  │
│  todos (2)] [⟳ lido 14:02]   │   Data do pedido [sáb 21/11 ▾]    │ numbers   │
│ [buscar] [Situação ▾]        │   the deadline sentence, the form │           │
│ notices (2.8), when there are│ nothing selected, Gestor:         │ the date's│
│ ▾ Aguardando aprovação (2)   │   "Selecione um pedido."          │ items     │
│ ● MS Maria Silva       08:20 │ a pedido selected:                │           │
│      Voo Local · 1 h [Aprovar]│   title, actions, sections        │           │
│      Registrado por Ana 10:02│                                   │           │
│ ▾ Aprovados (12)             │                                   │           │
│ ▸ Cancelados (1)             │                                   │           │
└──────────────────────────────┴───────────────────────────────────┴───────────┘
```

**List rows** (`#agenda-lista`, F2's list `age`; the open date only; inside a group by `horario`, then `registrado_em`):

| Part (F2's field) | Aguardando aprovação | Aprovado | Cancelado |
|---|---|---|---|
| dot (`ponto`) | `'aviso'`, "aguardando aprovação", on a date from today on; none on a past date | none | none; `inativo: true` dims the row |
| avatar | the student's initials | same | same |
| line 1 (`titulo`) | `aluno_nome`; marks: "Fora do prazo" (`excecao`), a note icon (there is an Observação) | same | same |
| line 2 (`linha2`) and `meta` | `<missao> · <duração>`, plus `· 2ª 10:10` and `· manhã` or `· qualquer horário` when set; meta: the 1st preference (`08:20`; the period on an old row) | same | same |
| line 3 (`linha3`) | "Registrado por <registrado_por> às HH:MM"; after a withdrawal, "Aprovação retirada por <nome> em dd/mm HH:MM"; on a past date, "Sem aprovação" | "Aprovado por <aprovada_por> às HH:MM" | "Cancelado por <cancelada_por> em dd/mm HH:MM" |
| the row's button (`acao`) | Operador and Administrador, date from today on, student active and in the cadastro: "Aprovar" (`data-act="aprovar-pedido"`, name "Aprovar o pedido de <aluno> (<missão> às HH:MM)"). Who registers and does not approve (the Secretaria): "Cancelar" → "Confirmar cancelamento" (`data-act="cancelar-pedido"`) | none | none |
| the end of line 3, until G (open date from today on; nothing while the day changed elsewhere) | "· Ainda na demanda" when `situacaoNaDemanda` is `'voa'` | "· Na demanda" (`'voa'`), "· Tirado da demanda" (`'tirada'`), "· Fora da demanda" (`'fora'`) | "· Ainda na demanda" (`'voa'`) |

- Groups: "Aguardando aprovação (n)", "Aprovados (n)", "Cancelados (n)", the last one closed. Filters: the search by name (`#flt-age`, `chaveDeBusca`) and "Situação" (`#flt-age-situacao`, several values: "Aguardando aprovação", "Aprovados", "Cancelados", "Fora do prazo"). No pedidos: "Nenhum pedido para sex 20/11."; none after filtering: "Nenhum pedido com esses filtros." and "Limpar filtros"; the read failed: "Não foi possível ler os pedidos. Verifique a conexão." and "Tentar de novo" (today a failed read looks like zero pedidos: `js/views/selos.js:41`).
- Top bar: "+ Novo pedido" (`#agenda-novo`); "Aprovar todos (N)" (`#agenda-aprovar-todos`, `data-act="aprovar-todos"`; Operador and Administrador, date from today on, N above zero); "Atualizar" with "lido às HH:MM" (`#agenda-atualizar`). N counts the waiting pedidos that pass the search and the filters and can be approved; with a search or a filter on the button reads "Aprovar os N filtrados"; a collapsed group does not change N (its header shows the count).
- Named places, for the card's rows and the rail's items (the address form is the shell's: desenho-casca D9): `aguardando`, `aprovados`, `excecao` set the "Situação" filter; `fora` shows the notice of 2.8; a pedido id opens its detail.

**Detail** (F2's detail of the list `age`): title, the student's name. Actions at its right, by profile and state: "Aprovar pedido" or "Retirar aprovação" (`data-act="retirar-aprovacao"`, two clicks with `confirmado`); "Cancelar pedido" (two clicks, as today); "Registrar de novo…" (`#agenda-repetir`: opens the form with this pedido's fields, and its date when that date still takes pedidos). Sections, as "Label: value" lines, read-only:

| Section | Lines |
|---|---|
| "Pedido" | Data · Fase / missão · 1ª preferência · 2ª preferência · Disponibilidade · Duração · Observação |
| "Situação" | the state with who and when · "Registrado por <nome> em dd/mm HH:MM" (and "Conta: <conta>" when it differs) · "Fora do prazo (Exceção da Coordenação)" when `excecao` · "Aprovação retirada por … em …" · "Cancelado por … em …" |
| "Nesta data" (open date from today on, the day loaded and not changed elsewhere) | until G: "Na demanda: <missão> às HH:MM[ · missão extra]"; "Fora da demanda" with "Importar"; "Tirado da demanda" with "Abrir a Demanda"; "Ainda na demanda" with "Abrir a Demanda" (it fills the Demanda's search, `#flt-dem`, with the student's name). From G on: Processamento's line for this pedido (the mission bound, the flight or the reason) |
| "Outros pedidos de <aluno> nesta data" | the list the "já tem voo marcado" warning shows today (`solicitacoesDoAluno`) |

The name used on a cancel is the remembered "Registrado por" (`acpm_agenda_registrado_por`), else the account's name (`ApiClient.autorAtual`); with neither (local mode, first use) the detail shows a field "Seu nome" above the button.

**Form** (`#form-agenda`: static markup of `index.html` inside the detail region, shown while no pedido is selected and never redrawn, so what she typed survives the 60 s read; class `agenda-campo` on every field so `js/somente-leitura.js:6-7` leaves them on for the Secretaria):

- "Data do pedido" (`select#ag-data`): the operating days (no Sunday) from today to today plus 14, and the open date when it is later. The Secretaria gets only the dates inside the deadline. Each option reads "sex 20/11", with "(hoje)" or "(amanhã)" and "· prazo encerrado". It starts on the open date when that date is in the list and inside the deadline, else on `primeiraDataAberta()`; it goes back to that when the open date changes and stays between two registrations. The title ("Novo pedido para sex 20/11"), the deadline sentence (`#agenda-prazo`) and the buttons follow it. For a date other than the open one the form reads that date's pedidos once (`ApiClient.agenda(d, d)`) for the "já tem voo marcado" warning and the local-limit check; without that read the two checks are skipped (the server still refuses the 7th).

| Who | The field's date inside the deadline | The field's date outside the deadline (today or later) |
|---|---|---|
| Operador, Administrador | "Registrar e aprovar" (submit), "Registrar sem aprovar" (`#ag-registrar`) | "Exceção da Coordenação" (`#ag-excecao`): registers approved |
| Secretaria | "Registrar pedido" (submit) | (no such option in the field) |
| Gestor | no form | |

- A student who already has a pedido on that date: the warning and "… mesmo assim" on the button, as today (`js/eventos/agenda.js:90-97`).
- After a registration the form stays, with Aluno and Observação empty and the focus on Aluno. Toasts: "Pedido registrado e aprovado: já está na demanda."; "Pedido registrado e aprovado para qua 25/11." (another date, or a condition of decision 13 missing: the notice follows); "Pedido registrado: aguardando aprovação."; "Pedido registrado e aprovado pela Exceção da Coordenação.".
- The Aluno list leaves out students with `inativo` (format 26, foundation).

**What each profile sees:** everyone who reads the schedule sees the list, the states, the detail (with Observação and Conta, as today) and the numbers. "Aprovar", "Aprovar todos" and "Retirar aprovação": Operador and Administrador. The form and "Cancelar": who `podeEditarAgenda()` (`body[data-agenda="edita"]`, unchanged).

**Phone:** the list first; a row or "+ Novo pedido" opens the middle pane as the second view (F2); the rail is the date button (F1).

### 2.8 Freshness

| Read again when | Today | After |
|---|---|---|
| a date opens; this browser registers or cancels | yes | yes, plus approves and withdraws |
| the Pedidos screen opens | yes (the month) | yes (the open date) |
| every 60 s while `document.visibilityState === 'visible'` and there is a session | no | yes (D3) |
| the page becomes visible, or the connection returns (`online`), when the last read is older than 30 s | no | yes (D3) |
| "Atualizar" | no | yes |
| local mode: another tab of this browser changes `acpm4_agenda` (`storage` event) | no | yes (D3) |

Each read brings the open date's rows (one date: far from the 1,000-row cap) and `ApiClient.diaMudou(DATA)` (one row, one column). The rail's month numbers keep F1's own triggers; the open date's number follows the rows. Nothing is written by a read. A date that is not open is never read.

What she sees, top of the list (`#agenda-aviso`), in this order; only the first that applies of 2 to 4 is replaced by 2:

| # | Condition | Notice | Who |
|---|---|---|---|
| 1 | the read failed | the list's error line and the time of the last good read | all |
| 2 | the stored day changed on another computer | "A escala desta data mudou em outro computador · Atualizar" (`#agenda-atualizar-data`: `carregarData(DATA)`). No "…demanda" tag and no notice 3 or 4 is drawn until then | all (the button reads the date again; it writes nothing) |
| 3 | open date from today on; approved pedidos never imported (`solicitacoesParaImportar`) | "N pedidos aprovados fora da demanda · Importar" (`#agenda-importar`; the text only for read-only profiles); from G on, "… fora da escala · Atualizar a escala" | all; the button for Operador and Administrador |
| 4 | open date from today on; pedidos cancelled or without approval that a flying record carries | "N pedidos cancelados ou sem aprovação ainda na demanda: Maria Silva (Voo Local 08:20), … · Abrir a Demanda"; from G on, the reconciliation's notice | all |

News between two reads of the same date (`novidadesDasSolicitacoes`), D3: a toast, polite (`anunciar`): "Pedidos de sex 20/11: 2 novos." or "…: 1 aprovado, 1 cancelado."; the groups and the open date's number on the rail follow. This is also how the Secretaria learns that the operator approved or cancelled a pedido she registered, on the date she has open: the row changes group and its third line says who and when. A refusal carries no reason (question 8).

The card and the rail (D's edits of `js/linha-do-dia.js`; ids and labels of desenho-escala-aprovar 2.9 and 2.10, which H keeps):

| Where | Row or item | Value and state | Who | Opens |
|---|---|---|---|---|
| card Pedidos | "Registrados" (`pedidos.registrados`, from F1) | not cancelled | all | Pedidos |
| card | "Prazo e exceções" (`pedidos.prazo`) | "até ter 13:00", "encerrado" or "2 fora do prazo" | all | Pedidos, `excecao` |
| card | "Aguardando aprovação" (`pedidos.aguardando`) | N; `atencao` above zero on a date from today on | all | Pedidos, `aguardando` |
| card | "Aprovados" (`pedidos.aprovados`) | "11 de 14" | all | Pedidos, `aprovados` |
| card, until G | "Fora da demanda" (in the place of F1's "ainda não importados") | approved, never imported; `atencao` above zero | Operador, Administrador | Pedidos, `fora` |
| rail | `pedidos-aguardando` (in the place of F1's "N pedidos da agenda ainda não estão na demanda") | "3 pedidos aguardando aprovação"; from today on | all | Pedidos, `aguardando` |
| rail, until G | "2 pedidos aprovados fora da demanda"; "1 pedido cancelado ou sem aprovação ainda na demanda" | from today on | Operador, Administrador | Pedidos, `fora`; the Demanda |
| rail | "A escala desta data mudou em outro computador" | | Operador, Administrador | Pedidos (notice 2) |

### 2.9 Counts, the cut-over and the interim

**Counts.** The rail asks `ApiClient.contagemDaAgenda(de, até)` (F1's call sites, unchanged). The number on a day is every pedido that is not cancelled, as today, for every day shown; a Sunday gets none (a Sunday pedido of before the migration could never be opened). With D the source is the count function and the 1,000-row cap of the month grid is gone.

**The conversion** (`aprovar_solicitacoes_de_antes_da_aprovacao(p_dos_operadores)`):

| Rule | Rows (always: not cancelled, `aprovada_em` null, `aprovacao_retirada_em` null) | Become | Why |
|---|---|---|---|
| (a) dates before today | the id is in `dias.conteudo -> 'importadas'` of its date | `aprovada_em = now()`, `aprovada_por = 'importação anterior'` | it was imported: that was the approval. No record is asked for: before `bfd38e4` the import left no `solicitacao`, and nothing reconciles a past date |
| (a) dates from today on | the id is in `importadas` **and** a record of that date and student (the main one or one of `extra`) carries `solicitacao = id`, with any `fly` | the same | the operator imported it and it is still there; "Voa" off is "tirado da demanda", still approved |
| (b) only when `p_dos_operadores` (D's migration) | `data >=` today, registered by an account whose profile is operador or administrador, id **not** in its date's `importadas` | `aprovada_em = now()`, `aprovada_por = conta`, `aprovada_usuario = usuario` | decision 5: who registered is who approves |
| everything else (cleared by "Limpar demanda" or "✕" on a date from today on; registered by a Secretaria and not imported; past dates never imported; an approval withdrawn) | stays waiting | | |

```sql
-- (a), a sketch to be checked on the preview
update public.solicitacoes s set aprovada_em = now(), aprovada_por = 'importação anterior'
  from public.dias d
 where d.data = s.data and s.cancelada_em is null and s.aprovada_em is null and s.aprovacao_retirada_em is null
   and d.conteudo -> 'importadas' @> to_jsonb(s.id)
   and (s.data < hoje
        or (d.conteudo -> 'pedidos' -> (s.aluno::text) ->> 'solicitacao') = s.id::text
        or exists (select 1 from jsonb_array_elements(coalesce(d.conteudo -> 'pedidos' -> (s.aluno::text) -> 'extra', '[]'::jsonb)) e
                    where (e ->> 'solicitacao') = s.id::text));
```

D's migration ends with `select public.aprovar_solicitacoes_de_antes_da_aprovacao(true);`. G's migration calls it with `false`: rule (a) then approves what a tab of the old version imported between D's production push and G (rule (b) must not run again: after D an operator may leave a pedido waiting on purpose).

**The sequence:**

| Moment | Server | App |
|---|---|---|
| D's file on production, before D1's merge | the columns, the functions and the conversion | the live app (old code) reads with `select('*')` and ignores the columns; registers through the 10-argument shim (an operator's pedido is born approved, a Secretaria's waits); cancels as before, except an approved pedido of a past date (`PT403`, shown as its generic "Não foi possível cancelar…"); imports every pending pedido, approved or not; a Sunday or a past date with the exception answers `PT403`, which it shows as "Prazo encerrado para esta data…" |
| D1 merged | | nothing changes on screen: the app still registers through the shim |
| D2 merged | | Pedidos shows the states; the form sends the 13 arguments; the import takes approved pedidos only; nothing runs at the first open (no format step) |
| D3 merged | | the reads every 60 s, the toasts |
| tabs opened before D2 | | keep working with the old screen. A Secretaria's pedido that such a tab imports is in the demand without approval: the new screen shows "Ainda na demanda", "Aprovar todos" includes it, and G's run of the conversion approves it. A pedido with `horario2` or `disponibilidade` that such a tab imports enters as one exact time and is marked imported: the record is bound once, so the looser time is lost for that flight (she loosens it in the Demanda); the pedido still shows what was asked |
| G | its migration runs the conversion again, rule (a) | the import button goes; the reconciliation takes over; format 28 refuses the old tabs |
| I | a file drops the 10-argument shim and the conversion function | |

For G:
- Until its own cut-over a record may carry the `solicitacao` of a pedido that is waiting or cancelled (cancelled after the import, which nothing removes today: mapa-pedidos 5.1; or imported by an old tab). The reconciliation must not propose removing those on dates before G's cut-over.
- An approved pedido whose record is off ("Tirado da demanda") is the operator's exclusion: the reconciliation leaves it (desenho-nucleo-a 2.1, "tirado"). One whose record is gone (cleared between D and G) is offered back by the notice, never brought by itself.
- The automatic write after an approval keeps the five conditions of decision 13, and "Atualizar a escala" reads the date again when `ApiClient.diaMudou(DATA)`.
- A check "no id of `importadas` is unapproved" (desenho-entrega 2.6, G) cannot hold: an id left by "Limpar demanda" waits on purpose. The check is over the records of dates from today on.

**What the operator does** (N pedidos for tomorrow, she registers them herself):

| | Today | With D | From G on |
|---|---|---|---|
| reach the form, tomorrow still open | "Agenda" (1 click) | "Pedidos" (1) | same |
| reach the form after 13:00, building tomorrow, a pedido for the day after | "Agenda" (1): it opens on the first open date; the app stays on tomorrow | "Pedidos" (1): "Data do pedido" is already the first open date; the list and the app stay on tomorrow | same |
| each pedido | fill, "Registrar pedido" | the same fields (two more, off by default), "Registrar e aprovar" | same |
| bring them to the day, a date not started yet | "Demanda" (1), "Importar N pedidos da agenda" (1) | "Importar" on the notice, in Pedidos (1) | "Atualizar a escala" (1) |
| the same, a date already started (late pedidos while she builds it; the day of the flight) | the same 2 clicks, each time | nothing: "Registrar e aprovar" puts it in the demand | nothing |
| a looser time | 1 to 3 selects in the Demanda, per pedido | at registration (2 selects), or the Demanda as before | at registration, or the flight's restrictions in the Escala stage |
| the instructor, the priority, another resource type | Demanda: 1 select each | Demanda, as before | Escala stage: about 2 actions each (question 4) |
| change the time or the duration of a flight on its date | Demanda: 1 select | Demanda, as before; the pedido keeps what was asked | the flight's restrictions in the Escala stage |
| pedidos a Secretaria registered | the same 2 clicks | "Pedidos" (1), "Aprovar todos (N)" (1); on a date not started, "Importar" (1) | "Pedidos" (1), "Aprovar todos (N)" (1) |
| cancel a waiting pedido | "Cancelar", "Confirmar cancelamento" (2) | select the row, "Cancelar pedido", "Confirmar cancelamento" (3); the Secretaria on the row (2) | same |
| cancel one that is in the day, before the day of the flight | 2 clicks, then the Demanda and "Voa" (if she remembers: nothing tells her) | 3 clicks; the notice names it; the Demanda and "Voa" (2) | 3 clicks: the flight leaves |
| a student gives up on the day of the flight | the flight's status "Cancelado", with the reason, in the Escala | the same; the pedido's detail says so | same |
| a pedido registered wrongly | cancel (2) and register again; past the deadline only by the exception | cancel (3), "Registrar de novo…" (1) with the form filled; the four effects of decision 11 | same |
| learn of a pedido registered or cancelled on another computer | at her next date change or her next action in the Agenda | within 60 s: a toast, the list, the rail | same |

After the schedule is approved nothing of her routine moves to this screen: statuses, results and Sugestões stay in the Escala stage (posicao B7). A walk-in on the day is "Data do pedido: hoje", "Exceção da Coordenação": born approved, and in the demand at once because the day is stored.

### 2.10 What the other steps get from D, and the points open with the core design

| Step | Gets | Leaves for D or takes from it |
|---|---|---|
| F1 (before D) | nothing: F1 ships the card "Agenda", `contagemDaAgenda` over the row query, the rows "pedidos da data" and "ainda não importados" (desenho-casca 2.3, 2.8) | D edits in the shell's files: `js/telas.js` (the label), `js/storage.js` (the body of `contagemDaAgenda`), `js/linha-do-dia.js` (the rows and items of 2.8), the import lines of whoever read `pedidosDaData`. Between F1 and D, registering after 13:00 costs the "2 or 3" of desenho-casca 2.13; D brings it back to 1 |
| F2 (before D) | the row model of 2.7 | assumption S3 |
| E (stacked on D) | rows with `aprovada_em`, `horario2`, `disponibilidade`; `solicitacaoAprovada`; `preferenciasDaSolicitacao` and `disponibilidadeDaSolicitacao`, which stay in `js/agenda.js`; the import handler already reading the day again | E replaces `importarSolicitacoes` and `entrarNaDemanda` by its module inside D's handler; E decides what a time outside the bound type's list becomes (today: rejected) and what an import with unread results does (today: no course mission) |
| G | the cache, `ApiClient.diaMudou`, the notices' place (`#agenda-aviso`), the detail's "Nesta data" section, the conversion function to run again | G deletes `#agenda-importar`, `#importar-agenda`, `situacaoNaDemanda`, `solicitacoesParaImportar`, `solicitacoesAindaNaDemanda`, `entrarNaDemanda`, the "…demanda" tags and the card's row "Fora da demanda"; G wires the form's 1st-preference list and Duração to E's `missaoDaEntrada` (decision 20) |
| H | `resumoDasSolicitacoes`; the card's rows and the rail's items of 2.8, whose bodies H's adapter replaces; the two numbers per day of `solicitacoes_por_dia`, if the rail is to mark a day with waiting pedidos | |
| I | | the contract migration; the optional module rename; the last sweep of Manual and README |

Points where this note and desenho-nucleo-a differ; the plan carries one answer, and this column says what changes with the other:

| Point | Here | desenho-nucleo-a | With the other answer |
|---|---|---|---|
| The pedido's time | two columns; the mapping is `preferenciasDaSolicitacao`, in `js/agenda.js`, owned by D | decision 17: one exact time, no column; `pedidoDaSolicitacao` moves to `js/processamento.js` | the two columns, the two parameters, three refusals, the two fields of the form and the field cases of `agenda-preferencias.test.sql` leave D before the migration is applied; nothing else in this note changes |
| `fly: false` on a record that carries a pedido | "tirado da demanda": the pedido stays approved (taken from decision 11 there) | the same | |
| The conversion | one function; `importadas` alone on past dates, `importadas` and a record from today on, any `fly`; rule (b) once; `'importação anterior'`; `aprovada_usuario`; run again by G | `importadas` and a record on every date; no rule (b); `'importado antes da aprovação'`; run again by G | without rule (b) the operator approves her own future pedidos once, with "Aprovar todos"; without the past-date branch the pedidos imported before 2026-11-14 read "Sem aprovação" for good |
| Who edits the import handler and `js/views/selos.js` | D first, E on top | E stacked on D (2.10 there) | |
| Names | `solicitacaoAprovada`, `lerSolicitacoesDaData`, `solicitacoesDaData` | `pedidoAprovado`, `lerPedidosDaData`, `pedidosDaData` | a rename |
| The Secretaria cancelling an approved pedido | allowed | "cannot (posicao B3)", with the other case written | one clause and one pgTAP check |

## 3. Where each existing control goes

Controls of `#s-age` at `48875e3`. F1 changes the first group before D (S2).

| Control today (label, id or data attribute) | Destination (stage, screen, pane) | Kept, moved, replaced by or removed |
|---|---|---|
| Tab "Agenda", `#nav button[data-t="age"]` | the pipeline card; "Agenda" in F1, "Pedidos" from D (`TELAS.age.rotulo`) | replaced by (F1), renamed (D) |
| Badge, `span#selo-age.aba-selo` | the card's rows and the rail's items of 2.8, for the four reading profiles | replaced by (F1: "ainda não importados"; D: the rows of 2.8) |
| Title "Agenda de Solicitações", `#s-age > h2` | Pedidos, list pane, "Pedidos de <data>" | replaced by |
| Deadline sentence, `p#agenda-prazo` | Pedidos, middle pane, top of the form; it follows "Data do pedido" | moved; the Sunday sentence is removed (no Sunday is offered) |
| "‹", "›", `button[data-cal="mes"][data-delta]`; the month name, `.cal-cab > b`; the weekday heads, `span.sem` | the rail's calendar | replaced by (F1) |
| Day, `button.dia[data-cal="dia"][data-dia]`, with `.sel`, `.fora` | the rail's day (opens the date) | replaced by (F1) |
| The count on a day, `span.qtd` and the cell's `aria-label` | the rail's day; from D out of `solicitacoes_por_dia` | replaced by (F1), source changed (D) |
| "Closed for pedidos", `.dia.fechado` | Pedidos, the option's "· prazo encerrado" in "Data do pedido" and the deadline sentence | removed from the calendar |
| A Sunday chosen in the calendar | none: no control opens a Sunday | removed |
| Day title, `h3#agenda-data` | Pedidos, list pane header; the form's title | replaced by |
| (the Agenda's own day, `diaEscolhido`) | Pedidos, form, "Data do pedido", `select#ag-data` | replaced by (a field of the pedido, not a control of what the page shows) |
| "Aluno", `select#ag-aluno` | Pedidos, middle pane, form | kept (without inactive students) |
| "Fase / missão", `select#ag-missao` | same | kept |
| "Horário", `select#ag-horario` | same, as "1ª preferência" | kept, relabelled |
| "Duração (h)", `input#ag-horas` | same | kept |
| "Registrado por", `input#ag-por` | same; also the name of who cancels | kept |
| "Observação", `input#ag-obs` | same | kept |
| "Registrar pedido" / "Registrar mesmo assim", `#form-agenda [type=submit]` | same: "Registrar pedido" (Secretaria); "Registrar e aprovar" and "Registrar sem aprovar", `#ag-registrar` (Operador, Administrador) | kept, split by profile |
| "Exceção da Coordenação", `button#ag-excecao[data-dica="excecao"]` | same; registers approved; shown when "Data do pedido" is outside the deadline | kept |
| Error line, `p#ag-erro[role=alert]` | same | kept |
| "Importar N pedido(s) para a demanda", `button#agenda-importar` | Pedidos, list pane, the notice "N pedidos aprovados fora da demanda · Importar" | kept until G, then replaced by the reconciliation's "Atualizar a escala" |
| The day's list, `div#agenda-lista > table` | Pedidos, list pane (F2 rows) | replaced by |
| column "Registrado em" | detail, "Situação" | moved |
| column "Aluno" with the Observação, `small.obs` | row line 1; the Observação in the detail, an icon on the row | moved |
| column "Fase / missão" | row line 2; detail | moved |
| column "Horário" ("HH:MM · N h") | row meta and line 2; detail | moved |
| column "Registrado por", with `title="Conta: …"` and the tag "Exceção da coordenação" | row line 3 and the mark "Fora do prazo"; detail | moved |
| column "Situação": "Cancelado", "Na demanda", "Ainda não importado" | the row's group and line 3; the tags "Na demanda", "Tirado da demanda", "Fora da demanda", "Ainda na demanda" | replaced by; the tags removed by G |
| "Cancelar" → "Confirmar cancelamento", `button[data-act="cancelar-pedido"][data-id]` | Pedidos, detail, "Cancelar pedido"; on the row for who does not approve | moved |
| (Demanda) "Importar da agenda", `button#importar-agenda` | stays in the Demanda toolbar as "Importar N pedidos aprovados" | kept until G (text), then removed by G |
| new: the row's "Aprovar" `data-act="aprovar-pedido"`; "Aprovar todos (N)" `#agenda-aprovar-todos`; "+ Novo pedido" `#agenda-novo`; "Atualizar" `#agenda-atualizar`; the notices `#agenda-aviso` with `#agenda-atualizar-data`; the search `#flt-age` and "Situação" `#flt-age-situacao`; "Data do pedido" `#ag-data`; "Disponibilidade" `#ag-disponibilidade`; "2ª preferência" `#ag-horario2`; "Retirar aprovação" `data-act="retirar-aprovacao"`; "Registrar de novo…" `#agenda-repetir` | Pedidos | new |

Texts that change with them: the History entry "Agenda: <aluno> incluído (…)" becomes "Pedidos: <aluno> incluído (…)" (`js/eventos/agenda.js:54-55`; old entries keep the old prefix: the History only grows), and a record turned back on writes "Pedidos: <aluno> de volta à demanda (…)"; "Não foi possível carregar a agenda…" becomes the list's error line; "N pedido(s) da agenda na demanda…" becomes "N pedido(s) na demanda…"; "Nenhum pedido novo na agenda para dd/mm." becomes "Nenhum pedido aprovado fora da demanda em dd/mm."; `js/views/reparo.js:34` gains "da escala".

## 4. Data-format steps and migrations

**Data format:** none. `ESQUEMA` is not touched by D. No field of the cadastro or of a day is added; `importadas` and `solicitacao` stay where they are, and D never leaves an id out of `importadas`. Consequence: a tab opened before D's merge is not refused until G's format 28 (2.9).

| File | What changes | Conversion | Tests | Order |
|---|---|---|---|---|
| `supabase/migrations/20261124100000_aprovacao_dos_pedidos.sql` (D1; the name and the place in the line are desenho-entrega's section 4) | `alter table public.solicitacoes add column …` ×8 and the two table checks; the table comment; `drop function` of the 9-argument overload; `create function` of the 13-argument `registrar_solicitacao`; `create or replace` of the 10-argument one as the shim and of `cancelar_solicitacao`; `create function` of `aprovar_solicitacoes`, `retirar_aprovacao_da_solicitacao`, `solicitacoes_por_dia`, `aprovar_solicitacoes_de_antes_da_aprovacao`; grants; `select public.aprovar_solicitacoes_de_antes_da_aprovacao(true);` | 2.9 | `agenda-aprovacao.test.sql`, `agenda-preferencias.test.sql` (new; desenho-entrega calls the first `pedidos-aprovacao.test.sql`: one name in the plan, default the `agenda-` family the four existing files keep); `agenda.test.sql`, `agenda-horas.test.sql`, `contas.test.sql`, `painel.test.sql` (changed) | preview → `npm run test:db` → production → merge of D1. No different order is needed |
| step G: `supabase/migrations/<after D's>_importados_ja_aprovados.sql` (the name of desenho-nucleo-a; G's file) | `select public.aprovar_solicitacoes_de_antes_da_aprovacao(false);` | rule (a) again | the conversion cases of `agenda-aprovacao.test.sql`, run twice | preview, production, before G's merge |
| step I: `20261125100000_agenda_sem_a_versao_anterior.sql` (the name of desenho-entrega) | `drop function` of the 10-argument `registrar_solicitacao` and of `aprovar_solicitacoes_de_antes_da_aprovacao(boolean)` | none | `agenda-horas.test.sql` and `agenda-locais.test.sql` move to the 13-argument call; two `has_function` become `hasnt_function` | after G is live |

**The line of files.** `supabase db push` sends every file the worktree holds that the remote lacks, and refuses a worktree that lacks a version the remote already has (lacuna-1-pendencias, implication 3). A's `20261123100000_…` and A2's `20261123100100_…` come before D's in name order. So D's push waits for both on the preview and on production, and D's branch is rebased on them before `supabase db push --dry-run`.

Why the live app keeps working on the new schema: 2.9, row 1. What it still calls on the changed objects: `from('solicitacoes').select('*')`, `rpc('registrar_solicitacao')` with the 10 parameters, `rpc('cancelar_solicitacao')` (`js/backends/supabase.js:212,219,228`).

Go-live list of D (the eight points of mapa-banco 5.8):
1. `supabase migration list` on the target ends at A2's file; `supabase db push --dry-run` shows D's file and no other; then the push to the preview.
2. `npm run test:db` on the preview, from a branch that holds every file already pushed: the 14 files plus the 2 new ones, all green.
3. The mirrors in the same PR (D1): `js/backends/local.js`, the fake server, `clienteFalso`, with the shared cases; `npm run lint` and `npm test` green.
4. **The old client against the migrated preview:** serve the commit that production is running, open it with `?supabase=previa` (`js/config-supabase.js:3`), log in as operador, **register and cancel** a pedido. This is the only check of PostgREST choosing between the 10 and the 13 arguments. Importing is left out: the shared preview may already be at a higher data format than that commit, and its day save would be refused with `PT409` hint `formato`, for a reason that is not D's.
5. The same push on production, outside the operator's afternoon (the schedule of the next day is built after 13:00); the live site checked right after. Merge of D1.
6. D2 on the preview with a real login of each profile: register, approve, withdraw, cancel; the Secretaria has no "Aprovar". Merge of D2, then D3 (no server step).
7. No first-open conversion.
8. The contract file of step I, and its condition.

The shared preview: once D's file is there, the copies of `agenda.test.sql`, `agenda-horas.test.sql` and `contas.test.sql` in any branch that is not on top of D fail (they call the dropped overload and expect `42501` where a past date now answers `PT403`). In the delivery order only E is open then, and E carries no SQL: it rebases onto D before its next `npm run test:db`.

Local mode: not a format step (2.5, row of `js/backends/local.js`).

## 5. Files created, changed and deleted, by step

| Step | Created | Changed | Deleted |
|---|---|---|---|
| F0 | | what S1 lists; nothing of the pedidos' rules | |
| F1 (before D) | `js/telas.js`, `js/linha-do-dia.js`, `ApiClient.contagemDaAgenda` | `index.html` (`#nav`, `#selo-age`, `#agenda-cal`), `js/views/selos.js`, `js/views/agenda.js` and `js/eventos/agenda.js:17-27` (the calendar leaves), `js/main.js:131-135` (the Secretaria's landing date) | `calendarioHTML`, `gradeDoMes`, `mudarMes`, `escolherDia`, `diaEscolhido`, `mesVisivel`, the `[data-cal]` listener, `.cal*` CSS |
| F2, F3, A, B, C | | none for this topic (the form only reads the `inativo` of format 26) | |
| **D1** `linha-d1-aprovacao-no-servidor` (the migration reaches production before its merge) | `supabase/migrations/20261124100000_aprovacao_dos_pedidos.sql`; `supabase/tests/database/agenda-aprovacao.test.sql`, `agenda-preferencias.test.sql`; `test/helpers/casos-das-solicitacoes.js` | `js/backends/supabase.js`, `js/backends/local.js`, `js/storage.js` (the new methods; the app still registers with 10 parameters); the fake server; `clienteFalso`; `agenda.test.sql`, `agenda-horas.test.sql`, `contas.test.sql`, `painel.test.sql`; `test/unit/backend-local.test.js`, `backend-supabase.test.js`, `supabase-falso.test.js`, `espelho-do-banco.test.js`; `scripts/semear-dias-previa.mjs` (for each date it writes: fictitious pedidos approved and bound to the day's records by `solicitacao` and `importadas`, two waiting, one cancelled; it still refuses production); README "Banco" | the 9-argument path of the fake (`supabase-falso.js:377-386`) and of `clienteFalso` |
| **D2** `linha-d2-pagina-dos-pedidos` (→ D1) | `js/solicitacoes-da-data.js` (reads on events only); `test/unit/solicitacoes-da-data.test.js` | `js/agenda.js`; `js/views/agenda.js` and `js/eventos/agenda.js` (rewritten); the import handler; `js/views/selos.js` (the text of `#importar-agenda` from `solicitacoesParaImportar`); `js/actions.js` (`novo`, `diaJaGravado`, the cache's read); `js/telas.js` (`TELAS.age.rotulo`); `js/storage.js` (`contagemDaAgenda`, `diaMudou`); `js/backends/supabase.js` and `local.js` (`diaMudou`; the 13-parameter call); `js/linha-do-dia.js` and whoever read `pedidosDaData` (`js/views/linha.js`, `js/views/trilho.js`: the import line); `js/views/reparo.js:34`; `js/glossario.js` (the group "Pedidos"; `excecao`; a new term `pedido-aprovado`); `index.html` (`#s-age`, the Demanda button's text and title, the Manual's "Pedidos" section and the mentions of the import); `css/agenda.css`; `README.md` (:13-14, :209, "Estrutura", the vocabulary sentence); the tests of section 6 | in `js/views/agenda.js`: `listaHTML`, `situacao`, `pendentesDaDataAberta`, `pedidosCarregados`, the `pedidos` cache, the Sunday branch of `prazoDoDia`, `pedidosDoAluno` and `descreverPedido` under those names; in `js/views/selos.js`: `lerPedidosDaData`, `pedidosDaData`, `pedidosPendentes`; in `js/linha-do-dia.js`: the row "ainda não importados" and its rail item; CSS `.agenda`, `#agenda-lista` table rules |
| **D3** `linha-d3-pedidos-em-dia` (→ D2) | | `js/solicitacoes-da-data.js` (`vigiarSolicitacoes`: the timer, visibility, `online`, the `storage` event), `js/agenda.js` (`novidadesDasSolicitacoes`), `js/views/agenda.js` (the toast), their tests | |
| E (on D) | `js/processamento.js` (or its new functions, if F0 created the file) | the import handler: its module in the place of `importarSolicitacoes` and `entrarNaDemanda`, with `{ aprovada: solicitacaoAprovada }` | `importarSolicitacoes`, `vooQueDaLugar` (when its module replaces them) |
| G | its migration of section 4 | `js/views/agenda.js` (the "Nesta data" section, the notices, the form's list and Duração from `missaoDaEntrada`), `js/eventos/agenda.js`, `js/linha-do-dia.js`, `index.html` | `#agenda-importar`, `#importar-agenda`, `importarDaAgenda`, the four "until G" functions of `js/agenda.js`, the "…demanda" tags, the row "Fora da demanda" |
| H | | the bodies of the card's rows and of the rail's items | |
| I | the contract migration | `agenda-horas.test.sql`, `agenda-locais.test.sql`, the fake and `clienteFalso` (the 10-argument path), `test/unit/backend-supabase.test.js`; optionally the three module names | the 10-argument `registrar_solicitacao`, `aprovar_solicitacoes_de_antes_da_aprovacao` |

Two ownership tables of desenho-entrega 2.3 need a line for D: `js/actions.js` (`lerData`, `diaJaGravado`) and `js/linha-do-dia.js` (the rows of the Pedidos card).

## 6. Tests

**Written first, in this order.**

1. `test/helpers/casos-das-solicitacoes.js` (D1): one list of cases (name, profile, calls, the expected code and hint or the expected row), about 36. The names are the pgTAP descriptions.
2. pgTAP, two new files (D1; accounts in blocks `d300` and `d400`; hints through `pg_temp.erro`, as `cursos.test.sql:39-54`). The dates, in a `pg_temp` table, from `hoje = (now() at time zone 'America/Sao_Paulo')::date` (the server's `current_date` is UTC and can be one day ahead):

| Name | Value | Used by |
|---|---|---|
| `aberta` | `hoje + 5`, plus 1 when that is a Sunday | inside the deadline |
| `fechada` | `hoje`, plus 1 when today is a Sunday | outside the deadline, not past, not a Sunday |
| `passada` | `hoje - 2`, minus 1 when that is a Sunday | 'numa data que já passou' (a Sunday would answer `domingo` first: one day in seven) |
| `domingo` | `hoje + 14 - extract(isodow from hoje)::int` | 'num domingo' |

| `agenda-aprovacao.test.sql` (about 50 checks) | |
|---|---|
| structure | the six `aprovada_*` and `aprovacao_retirada_*` columns; the 13-argument function; `aprovar_solicitacoes(bigint[])`; `retirar_aprovacao_da_solicitacao(bigint)`; the 9-argument function is gone; the 10-argument one stays |
| registering | 'a secretaria registra: o pedido fica aguardando aprovação'; 'a secretaria não registra já aprovado' (`42501 aprovar`); 'o operador registra e aprova de uma vez' (who and when); 'pela exceção da coordenação, o pedido nasce aprovado mesmo sem pedir'; 'a exceção não registra num domingo' (`PT403 domingo`); 'a exceção não registra numa data que já passou' (`PT403 passada`); 'a exceção registra para hoje' (`PT403 domingo` when today is a Sunday) |
| the shim | 'pela função de 10 argumentos, o pedido do operador nasce aprovado'; '… e o da secretaria, aguardando'; '… com as mesmas regras' (a Sunday with the exception, `PT403`) |
| approving | 'o operador aprova os pedidos da lista' (the ids returned, the rows); 'aprovar de novo não muda nada e guarda quem aprovou primeiro'; 'o cancelado, o de uma data que já passou e o id que não existe ficam fora da resposta'; 'a secretaria não aprova', 'o gestor não aprova', 'conta sem perfil não aprova' (`42501`); 'lista vazia' and 'mais de 200' (`22023 ids`) |
| withdrawing | 'o operador retira a aprovação: o pedido volta a aguardar'; 'a retirada guarda quem e quando'; 'aprovar de novo apaga a retirada'; 'sem aprovação' and 'cancelado' (`P0002`); 'a aprovação de uma data que já passou não é retirada' (`PT403 passada`); 'a secretaria não retira a aprovação' |
| cancelling | 'a secretaria cancela o pedido que aguarda'; 'a secretaria cancela o pedido aprovado'; 'o operador cancela o pedido aprovado'; 'o pedido aprovado de uma data que já passou não é cancelado' (`PT403 passada`); 'o que aguarda numa data que já passou é cancelado' |
| the conversion | 'numa data que já passou, o que está em importadas fica aprovado, mesmo sem registro'; 'de hoje em diante, o que um registro ainda leva fica aprovado, voando ou não'; 'o da missão extra também'; 'o que só ficou em importadas continua aguardando'; 'o cancelado continua cancelado'; 'o pedido de outra data não muda'; 'o pedido futuro de um operador fica aprovado; o de uma secretaria, não'; 'o que está em importadas não entra pela regra dos operadores'; 'sem a regra dos operadores, o pedido futuro de um operador continua aguardando'; 'a aprovação retirada não volta pela conversão'; 'rodar de novo não muda nada'; 'a conversão não é da API' |

| `agenda-preferencias.test.sql` (about 16 checks) | |
|---|---|
| structure | `horario2`, `disponibilidade`, `solicitacoes_por_dia(date, date)` |
| the fields | 'a 2ª preferência com a disponibilidade: registra' and what was stored; 'a 2ª preferência pede uma disponibilidade mais ampla'; '… é diferente da 1ª'; '… é um horário' (`22023 horario2`); 'a disponibilidade é manhã, tarde, noite ou qualquer horário' (`22023 disponibilidade`) |
| the limit | 'o limite conta os pedidos que aguardam e os aprovados, pela 1ª preferência'; 'a 2ª preferência não ocupa vaga' |
| the counts | 'os pedidos por dia: aguardando e aprovados, sem os cancelados'; 'um dia sem pedidos não aparece'; 'o gestor e a secretaria leem a contagem'; 'conta sem perfil recebe vazio'; 'anônimo não executa' |

3. Unit. `test/unit/agenda.test.js`, a new suite of about 24 tests (D2): the three states and `solicitacaoAprovada`; the summary; `preferenciasDaSolicitacao`, row by row of 2.6, with 'a disponibilidade que não contém a 1ª preferência não vale' and the Noturno; the form's options; `erroDasPreferencias`; the limit ignores the state and the 2nd preference; `situacaoNaDemanda` (the three answers, with "Voa" off and after "Limpar demanda"); `solicitacoesParaImportar`; `entrarNaDemanda` (never imported: enters; record off: `fly` on with the same `mid`, instructor and pin; no record: one record, the id once in `importadas`; a record without `solicitacao` is never touched); `datasParaRegistrar` (after 13:00 the default is the first open date; no Sunday; the Secretaria gets no closed date); `contagemPorDia` (the sum; no Sunday). `novidadesDasSolicitacoes` (D3). `test/unit/solicitacoes-da-data.test.js`, about 8 (an answer for another date is dropped; a failed read keeps the error and the last list; `diaMudou` goes with the read; D3: when the next read is due, with the clock injected). `test/unit/supabase-falso.test.js` and `test/unit/backend-local.test.js`: one test each that runs the shared cases. `test/unit/espelho-do-banco.test.js`: 'cada caso dos pedidos é uma verificação do pgTAP' and 'as constantes da migração dos pedidos são as do app' (6, the three local missions, 5 h, 1,5 h, 13:00 and 10:00).
4. e2e, the cases the reviews asked for (D2 unless marked):
   - 'registrar e aprovar numa data sem dia gravado não grava o dia; um clique em Importar põe os pedidos na demanda' (no `salvar_dia` call until the click);
   - 'numa data já começada, registrar e aprovar põe o pedido na demanda';
   - 'depois das 13:00, o formulário já está na primeira data aberta; a lista e o app continuam em amanhã';
   - two contexts on one date: 'o pedido aprovado em outro computador: aqui aparece "mudou em outro computador · Atualizar", sem Importar e sem travar';
   - 'com os resultados sem ler, aprovar não importa: o aviso oferece';
   - 'aprovar de novo o pedido tirado com o Voa religa o voo';
   - 'depois de Limpar demanda, o pedido aprovado fica "Tirado da demanda", sem Importar e fora do aviso';
   - 'Aprovar todos com a busca: só os que a lista mostra';
   - 'retirar a aprovação pede o segundo clique'; 'numa data que já passou não há Aprovar';
   - 'cancelar o pedido de um voo com status mostra o caminho do status';
   - the Secretaria: 'usa "Registrar de novo…"'; 'cancela um pedido aprovado e é avisada de falar com o operador';
   - D3: 'um pedido registrado em outro computador aparece em até um minuto, com o aviso'.

**Existing tests that change** (line numbers of `48875e3`; F1 changes `agenda.spec.js:164-256` and `agenda-compartilhado.spec.js:40-74` first).

| File | Now | Change |
|---|---|---|
| `supabase/tests/database/agenda.test.sql` | 28 checks, 9 calls of the 9-argument overload (:35-69) | the calls move to 13 arguments with a time and a duration; :47 and :49 become `22023`; :41 uses `passada`, :43 and :62 use `fechada` (with a past date the Secretaria's exception would now answer `PT403`, not `42501`); still 28 |
| `agenda-horas.test.sql` | 11 | :18-19 becomes `hasnt_function`; the calls stay on the shim |
| `agenda-locais.test.sql`, `agenda-prazo.test.sql`, `leitura.test.sql` | 5, 9, 40 | none |
| `contas.test.sql` | 28 | :27 moves to 13 arguments and `fechada`; plus 'administrador aprova pedidos' |
| `painel.test.sql` | 58 | plus 'painel não aprova pedidos' and 'painel não lê a contagem dos pedidos' |
| `test/unit/agenda.test.js` | 31 tests | :58 and :65 gain the new columns; the 21 import tests do not change (the approved filter is in the caller) |
| `test/unit/backend-local.test.js` | 5 Agenda tests (:81-127) | the exception test takes today's date, not a past one; plus about 7 (approve, withdraw with its trace, cancel approved, born approved, the counts, the one-time conversion and its marker key) |
| `test/unit/backend-supabase.test.js` | 1 Agenda test (:471-484), `clienteFalso` (:182-196) | 10 and 13 parameters; the 9-parameter call at :479 goes; plus one test for the three new calls and the hint, and one for `diaMudou` |
| `test/unit/linha-do-dia.test.js` (F1's) | the rows "pedidos da data" and "ainda não importados" | the rows and items of 2.8, per profile; no attention on a past date |
| `test/e2e/agenda.spec.js` | 16 tests, 93 selector occurrences | rewritten on the new page, about 28: the 10 form tests stay with the same ids; :152 and :177 become "aprovar põe o pedido na demanda" and the notice; :202 becomes the "Data do pedido" case above; new: the row's "Aprovar", "Aprovar todos", "Retirar aprovação", the two new fields and what the Demanda row gets, the detail, "Registrar de novo…", the cases of item 4 |
| `test/e2e/agenda-compartilhado.spec.js` | 7 | about 11: the Secretaria sees the states and has no "Aprovar"; the two Secretaria cases of item 4; the exception registers approved; the Gestor reads |
| `test/e2e/casca.spec.js`, `test/e2e/trilho.spec.js` (F1's) | the card "Agenda"; the numbers from the row query | the card "Pedidos" and its rows per profile; the same numbers, now from the count function in the fake; a Sunday with a pedido shows none |
| `test/e2e/selos.spec.js` (as F1 leaves it) | the Agenda rows | "aguardando aprovação", for every reading profile |
| `abertura.spec.js:31`, `selos.spec.js:53,68`, `agenda-compartilhado.spec.js:94,106` | push rows into the fake's `solicitacoes` | the rows need `aprovada_em`: the helper `novaSolicitacao(campos)` |
| `demanda.spec.js:55`, `atributos.spec.js:56`, `noturno.spec.js:14` | register in the form, then import | the button text; on a date already started "Registrar e aprovar" makes the import step go |
| `app.spec.js:159,164` (`test/e2e/manual-frases.js` under S1) | the Manual's `h4` list and its phrases | 'Agenda' → 'Pedidos'; "Ainda não importado" → "Aguardando aprovação" and "Registrar e aprovar" |
| `reparo.spec.js` | the sentence of `js/views/reparo.js:34`, if asserted | "da escala" |
| `seguranca.spec.js` | no hostile pedido today | plus a pedido with hostile text in the name, the Observação, "Registrado por", "Cancelado por" and "Aprovado por" (the list, the detail and the notice that names students are new HTML) |
| `celular.spec.js:32,51`, `acessibilidade.spec.js:38,547-575` | loop over the tabs; the calendar's chosen day | follow F1 and F2; the row's button and the form's new fields have names |

## 7. Departures from Pedro's request

| What the request says | What this design does | Why | What Pedro can choose instead |
|---|---|---|---|
| The rail "is the app's only date control: it replaces … the Agenda's calendar" | the form has a field "Data do pedido"; the list and the app follow only the rail | after 13:00, one click as today instead of three clicks and two date loads (decision 12) | one date strictly, with the button "Abrir <primeira data aberta>" |
| "Demanda will consume approved pedidos" | an approval puts the pedido in the day at once only on a date already started; on a date not started it waits for one click | an approval must not create a day: its aircraft hours and rodízio queues would freeze a day or more early (decision 13) | always at once; or always one click |
| "Keep the existing rules: … the local-flight limit" | kept as a refusal at registration, counting waiting and approved pedidos | it is the existing rule; **it leaves unbuilt your decision of 2026-11-17** (warn and confirm for every local mission, never block; record who confirmed), which was built only in the booking dialog | the 2026-11-17 rule in Pedidos (question 3) |
| Your batch of 2026-11-17: "Agenda: add the resource, 2nd preference, instructor and priority so the import is complete" | only the 2nd preference (with the Disponibilidade); resource type, instructor and priority stay operator restrictions (posicao B2; the request of 2026-11-21 lists the chosen instructor among them) | **a second 2026-11-17 decision left partly unbuilt**; the plan should list both under "Decisions this reverses" | three more optional fields on the pedido (question 4) |
| "Keep the existing rules: … Exceção da Coordenação, no Sundays" | the exception stops accepting a Sunday and a date before today; approvals, withdrawals and the cancellation of an approved pedido stop at past dates | today the exception accepts both (mapa-banco 6.2), so "no Sundays" is not a rule yet; a past schedule must not change through a pedido | keep past dates with the exception; keep all as today |
| "the 13:00 deadline" | kept as the code has it: Monday closes on Saturday at 10:00 | `20261114230509:16` | nothing to choose |
| a pedido "needs an approval state"; "the Secretaria keeps registering" | an Operador's own pedido can be born approved, a pedido past the deadline always is, and the conversion approves the future pedidos operators registered | no Secretaria account is recorded; otherwise one more action per pedido, every day | every pedido waits for an explicit approval |
| every list item "open in the middle pane, editable there" | a pedido's detail is read-only, with actions | there is no edit today and an edit needs rules nobody asked for; the flight's time is changed on the day's record | Operador and Administrador edit the pedido (question 2) |
| "With nothing selected, an empty state" | with nothing selected, who may register sees the form; the Gestor sees "Selecione um pedido." | the form is the screen's main action and must not need a click | an empty state, and the form behind "+ Novo pedido" |
| "Each row carries its active switch; inactive rows are dimmed" | a waiting row carries the button "Aprovar"; cancelled rows are dimmed; there is no switch | a pedido has no active flag; an approval is a server call, and one click must not withdraw one | a switch (F2 would need one that calls an action) |
| "Pedidos: registrados · fora do prazo ou com exceção · aguardando aprovação · aprovados" | "Registrados · Prazo e exceções · Aguardando aprovação · Aprovados" | a pedido past the deadline without the exception is refused and never stored | nothing to choose |
| "Exceção da Coordenação" as the name of a decision of the coordination | from G on every flight the operator adds past the deadline goes through it, since hand-made requests end; the mark on the row and in the detail reads "Fora do prazo" | the flag stores "registered past the deadline", nothing more | rename the button to "Registrar fora do prazo" from G on (question 10) |
| "Days could carry the pedido count the Agenda calendar shows today" | the same number, from a count function | the month query is capped at 1,000 rows | a mark for days with waiting pedidos (H) |
| "Recommend … whether [the three modules] and the `solicitacoes` table are renamed too" | not renamed | 2.1 | the modules in one commit of step I |
| other screens' "behaviour does not change" | Pedidos reads again every 60 s, with the day's version | so a pedido or a change from another computer shows without touching the app | read only on events, as today |

## 8. Questions for Pedro, each with the default this design implements

Most important first.

1. "2ª preferência" and "Disponibilidade" on the pedido. Default: yes (you asked for the 2nd preference in the Agenda on 2026-11-17), with "Só na 1ª preferência" as the default availability, so a pedido is still one exact time unless someone widens it. Alternative: one exact time, which is the default of the core design (2.6, 2.10).
2. Should a pedido be editable? Default: no. A flight's time, duration, resource, instructor or priority on its date is changed on the day's record (the Demanda today, the Escala stage from G on); cancel and "Registrar de novo…" is for a pedido registered wrongly, and costs what decision 11 lists. Alternative: Operador and Administrador change the time fields of the pedido, keeping its id and its "fora do prazo" (one more function, about 8 pgTAP checks, two audit columns).
3. The 6 local flights in Pedidos. On 2026-11-17 you decided "warn and confirm for every local mission, never block; record who confirmed"; it was built in the booking dialog and never in the Agenda. On 2026-11-21 you wrote "keep the existing rules: … the local-flight limit". Default: refused at the 7th, as today; the way around is "+ Agendar voo" with "Agendar mesmo assim". Alternative: the 2026-11-17 rule here too: one more parameter and two nullable columns for who confirmed, about 3 pgTAP checks, a second click in the form, and an engine rule so the confirmed 7th is not rejected at its time.
4. Resource type, INVA and priority on the pedido (the same batch of 2026-11-17, "so the import is complete"). Default: no; they are operator restrictions, about two actions per flight in the Escala stage, only for the flights that need them. Alternative: three more optional fields in the form she already fills (three nullable columns and parameters in the same migration, their mirrors and the mapping).
5. When an approval writes the day. Default: at once on a date already started, one click on a date not started. And: do other people with an Operador or Administrador account register pedidos while the escala of that date is being built? Default: one person does both; if another account does it, the operator's next change is refused and her screen locks until reload (2.3). If yes: an approval never writes the day by itself and only "Importar" does (one click per batch for whoever builds; today two clicks and a screen change).
6. "Data do pedido" in the form. Default: yes, so registering after 13:00 stays one click. Alternative: one date strictly (three clicks and two date loads after 13:00).
7. An Operador's own pedido. Default: "Registrar e aprovar" is the main button, with "Registrar sem aprovar" beside it; a pedido past the deadline is always approved. Alternative: one button, always approved; or every pedido waits for an explicit approval.
8. The Secretaria and an approved pedido. Default: she may cancel it, as today; the operator sees the notice and applies it (one click from G on), against a call and four actions if she may not. And a refusal: default, it is a cancellation with no reason stored; she reads "Cancelado por <operador>". Alternative: an optional "Motivo" on a cancellation (one nullable column, a third parameter, 2 pgTAP checks, one more field).
9. The words. Default: yours, "Aprovar pedido", "Aprovado", "Aguardando aprovação". Alternative: "Aceitar", "Aceito", keeping "aprovar" for the schedule and for course results.
10. The exception. Default: refused on a Sunday and on a past date; today's date still works; a flight that already happened is recorded with "+ Agendar voo". And from G on, when every late addition goes through it: default, the button keeps the name "Exceção da Coordenação" and the mark reads "Fora do prazo". Alternative: the button becomes "Registrar fora do prazo".
11. Are there Secretaria accounts in production? Default: none; everything works with or without them, and with none "aguardando aprovação" only shows what the operator chose to leave waiting.
12. The pedidos that exist at the cut-over. Default: approved when they were imported (on a date from today on, only while a record still carries them), or when an operator registered them for today or later; the rest wait. Alternative: without the operators' rule, she approves her own future pedidos once.
13. How fresh. Default: every 60 s while the page is visible, on return to the page, and "Atualizar". Alternative: only on events; or realtime.
14. Should "só na 1ª ou na 2ª preferência" exist as an availability? Default: no (it needs a new shape of `jan` in `js/rules.js`, owned by E; no golden changes).
15. The number on a day of the rail. Default: every pedido that is not cancelled, as today. Alternative: a mark when some wait for approval (H).
16. Should registering, approving and cancelling appear in the date's History? Default: only what changes the day's demand, as today; the pedido keeps who and when of each transition, the withdrawal included.
17. Should the server refuse a pedido for a student who is not in the cadastro, or inactive? Default: no; the form offers only active students, and the list flags the rest.
18. The module and table names. Default: they stay; the modules can be renamed in one commit of step I.

## 9. Risks, and what would make this design wrong

- **Two notes, two defaults.** The pedido's time, the conversion, the names and the Secretaria's cancel are written differently in desenho-nucleo-a (2.10). The plan must carry one answer for each before D1's migration is applied: the file is frozen once it is on the preview.
- **PostgREST and the two signatures.** A call with the 10 names must reach the 10-argument function and one with the 13 names the other. Nothing in the repo runs PostgREST; the check is item 4 of the go-live list. If it fails: one function with three defaulted parameters, or a new function name.
- **Two people with operator accounts on one date.** An approval made by one on a date already started saves the day under the other: `PT409`, a locked screen, one lost change. The version check tells her within 60 s, not at once. Question 5 has the way out.
- **The trigger of decision 13 misread.** "The date already has a stored day" is true for a date the operator touched early by herself (a resource in maintenance for next week): an approval then imports into that early day. It is her own early write, as today; D does not make it earlier and does not fix it.
- **Secretaria accounts exist and register most pedidos.** Then approving is a daily task ("Aprovar todos" keeps it at one click), her cancellations of approved pedidos reach the operator as notices, and old tabs can import pedidos without approval until G; the design holds, the interim is noisier.
- **The 2nd preference read as "only the 1st or the 2nd".** It is a preference, as in the Demanda today. If the school means the strict reading, question 14 becomes necessary.
- **Pedro wants pedidos strictly exact.** The two columns go before the migration is applied; after, they stay unused.
- **The conversion approves what an operator registered (rule b).** If every existing pedido should wait, call the function with `false` in D's migration too.
- **The conversion reads inside `dias.conteudo`.** A wrong path marks nothing or too much; pgTAP on the preview with seeded days is the guard; the statement only fills `aprovada_em` where it is null.
- **No format number in D.** Old tabs are not refused until G: they import unapproved pedidos and flatten flexible ones to an exact time (2.9). Merging D, E and G in one sitting closes the window; a wave cut after D leaves it open.
- **G and old days.** Records that carry a waiting or cancelled pedido exist on past dates and will exist until G's cut-over; a reconciliation that removed them would erase flights that happened.
- **The timer in tests.** The e2e clock is fixed with `context.clock.setFixedTime` (`test/e2e/fixtures.js:23`), which keeps timers running: a test longer than 60 s gets one more read of `solicitacoes` and of the day's version; a test that holds that request (`segurar('/rest/v1/solicitacoes')`, `agenda-compartilhado.spec.js:112`) must not depend on the number of reads.
- **F2 without a place for the form, or F1 leaving the calendar to D.** Assumptions S2 and S3: both have a named fallback.
- **"Data do pedido" and the list on different dates.** She registers for the day after and the list in front of her does not grow. The toast names the date and the rail's number of that day grows; if that is not enough, question 6 has the strict alternative.
- **Waiting pedidos of past dates stay waiting for ever.** They read "Sem aprovação", raise no notice and no attention state; the day's number on the rail still counts them, as today.
- **Sunday pedidos registered through the exception before the migration** stay in the table and are never seen (how many, only the server knows); the rail shows no number for a Sunday.
- **E changes the mapping** (a time outside the bound type's list): the rows of 2.6 are the contract; a different rule changes the first row and then the 21 import tests.
- **Server state.** The plan's migration order depends on what each project has applied (posicao A15 gives it; `supabase db push --dry-run` confirms it before the push).

<!-- revisado -->
<!-- fim -->
