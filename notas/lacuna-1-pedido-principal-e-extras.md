# Lacuna: the main request (mid 0) against the extras (mid 1 or more), outside the engine

Read on the worktree `.redesenho/wt-plano` at 48875e3 (branch `linha-0-plano`). Paths are relative to the worktree root.
"(ran)" = confirmed by running node, read-only, on the pure modules, from a scratch folder outside the repo, with
fictitious names and weights only (`Aluno 101`, `Instrutor 01`). "(measured)" = counted over the golden inputs or with grep.
"(read)" = follows from the lines quoted, not executed (the views need a browser). "(inferred)" = not proven by a line.

"Target shape" below = the shape the question asks about: every student's main request stays `fly: false` and every
approved pedido is an object of `stu[].extra[]` whose `mid` never changes.

## Answer

### 0. Short answer

- The lookup, the storage, the pins, the statuses, the results, the reverts, the booking of an existing flight, the
  Sugestões, the Noturno return and the course logic are all written over `(stuId, mid)` and work unchanged in the
  target shape (sections 2 and 3).
- Five things do not: (a) **nothing keeps the main request off**: `alvoDoNovoPedido` hands the next new flight of the
  student to mid 0 (js/rules.js:95-100), so the first "+ Agendar voo" of a student lands on the main request (ran);
  (b) `proximoMid` numbers a hand-made extra as "largest mid + 1" (js/rules.js:67-72), in the same number space as the
  stable mids; (c) the Demanda table and its handlers assume the main row carries the student (name, "+ missão",
  "Pôr um aluno", the Voa cascade); (d) a rejection is joined to its request by a text label that is the same for two
  extras of one student with the same mission (ran); (e) the value of `mid` has two upper bounds outside the engine
  (999,999 for the reception TV, read in the SQL; 1e9 for the saved schedule, ran) that a raw pedido id breaks in
  local mode.
- A stable `mid` is necessary but not sufficient: the booking, the chosen instructor and "Tirar da escala" write
  fields ON the request. A request rebuilt from the pedido with the same `mid` puts the booked flight in conflict and
  blocks its "↶ Desfazer" (ran, section 5).
- The engine side is already pinned: in the 40 generated golden inputs, 38 of 735 students fly only through extras
  (main `fly: false`, at least one flying extra), 289 extras fly, and 226 of 728 recorded rows have `mid` ≥ 1
  (measured). Extras there are numbered from `nid` (`mid: nid++`, test/helpers/cenarios.js:75), so mids in the
  thousands are also already pinned.

### 1. What "main" and "extra" are

- The main request is the student object itself: `pedidoDoAluno(aluno, mid)` returns `aluno` for a falsy `mid` and
  `(aluno.extra || []).find(ex => ex.mid === mid)` otherwise (js/voo.js:26). `getMissionTarget(stuId, mid = 0)`
  (js/state.js:36-39) and `pedidoDe` (js/instrutor-escolhido.js:73-76) wrap it. (ran) `mid` `undefined` gives the main
  request, a missing extra gives `undefined`, and with two extras of the same `mid` the first wins.
- The flight key is `chaveDoVoo(stuId, mid)` = `` `${stuId}_${mid}_1` `` (js/voo.js:5); the return leg of yesterday's
  Noturno is `` `${stuId}_${mid}_2` `` with yesterday's `mid` (js/noturno.js:26, 47; js/engine.js:371).
- Saving: `separar` copies the main request through `CAMPOS_DO_PEDIDO` (13 names, js/dias.js:22, 60) and clones the
  extras whole (`structuredClone(s.extra || [])`, js/dias.js:61). `salvarDia` calls it at every save
  (js/storage.js:229-242), so whatever is in `S.stu` is written to `dia.pedidos`.
- The engine queue: the main request enters with `mid: 0, misOrder: 0`, each flying extra with `mid: ex.mid,
  misOrder: exIdx + 1` (js/engine.js:292-303). The order between a student's extras is their position in `extra[]`,
  not the `mid`, and only after `solicitacao` (js/engine.js:328, 337).

### 2. Every path that treats mid 0 differently (grep of `mid`, `.extra`, `.fly`, `data-mid` over js/, scripts/, supabase/, index.html, css/)

Verdict in the target shape: **OK** = works unchanged; **OK\*** = works, with a consequence for the plan;
**BREAKS THE SHAPE** = runs, but puts a flying request on mid 0; **BREAKS** = wrong behaviour.

| # | Where | What is different for mid 0 | In the target shape |
|---|---|---|---|
| 1 | js/voo.js:26 (callers: js/state.js:36-39; js/instrutor-escolhido.js:73-76; js/voo.js:29-36 `pedidosDosVoos`; js/fixos.js:120-125 `voaNaChave`; scripts/medir-escalas.mjs:36) | mid 0 is never missing (it is the student); an extra can be missing | OK (ran). Callers already cope with a missing extra: js/instrutor-escolhido.js:106, 142, 168; js/eventos/historico.js:56, 101; js/reversoes.js:141, 168 |
| 2 | js/dias.js:59-62 `separar` | main: only the 13 whitelisted names are saved; extra: every field is saved | OK\* (ran): a field outside the list is dropped from the main request and kept on an extra, nested objects included. The rule "the day has no names or weights" is enforced by the whitelist for the main request only (test/unit/dias.test.js:25-35 checks `dia.pedidos[id]`, not the extras) |
| 3 | js/dias.js:96-101 `juntar` | the stored main request is spread OVER the roster student (`...s, …, ...structuredClone(pedidos[s.id])`); an extra stays inside `extra[]` | OK\*: a stored `dia.pedidos[<id>]` holding `id`, `nm`, `kg` (or `bl`, `voaCom`, `curso`) replaces the roster's values in memory (ran: `{ id: 55555, nm: 'Nome vindo do dia', kg: 999 }`), and the next `separar` takes the roster from that same object (js/dias.js:47, read). `separar` never writes those keys there, but the server does not check `pedidos` (supabase/migrations/20261114143242_formato_e_status_do_dia.sql:29-34 checks only `fStatus`). This is also why the request's course field is `cursoDaEtapa` and not `curso` (js/rules.js:160-162) |
| 4 | js/dias.js:118-123 `diaParaCopiar`; js/eventos/cadastros.js:85 ("+ Novo aluno") | every student is born with a blank main request (`...blank()`, `extra: []`) | OK: every new date and every new student already start in the target shape |
| 5 | js/storage.js:155, 164-171 `normalizeAndMigrateState` | the main request is normalised on the student; an extra that is not an object is dropped; an extra whose `mid` is not a positive integer gets `proximoMid` | OK\*: a `mid` that is a string, 0 or negative is renumbered at every load, so the key changes. `mid` must be a positive integer number |
| 6 | js/rules.js:95-100 `alvoDoNovoPedido` (callers: js/agenda.js:135 import; js/agendamento.js:905 booking) | the main request receives the new flight when `!aluno.fly` and the key `<id>_0_1` has no leftovers (`chaveTemSobras`, js/rules.js:54-62); only otherwise a new extra | **BREAKS THE SHAPE** (ran): with the main off and one extra flying, the target is the student object. Tests that pin it: test/unit/rules.test.js:190, 197; test/unit/agendamento.test.js:497, 514; test/unit/agenda.test.js:95, 103, 265, 285 |
| 7 | js/rules.js:67-72 `proximoMid` (callers: js/rules.js:97; js/eventos/demanda.js:158 "+ missão"; js/storage.js:168) | never returns 0: 1 + the largest `mid` among the student's extras and the keys the day still keeps (`fixos`, `fStatus`, `fObs`, `resultados.doDia`) | OK\* (ran): with extras 4321 and 4322 the next hand-made extra is 4323. If stable mids are pedido ids, 4323 can be the id of the student's next pedido of that date (the ids are one global sequence, supabase/migrations/20261110222506_agenda_de_solicitacoes.sql:7): two extras with one key. Tests: test/unit/rules.test.js:101, 114 |
| 8 | js/rules.js:97; js/eventos/demanda.js:166 | a new extra takes the MAIN request's priority (`pr: aluno.pr \|\| 3`) | OK\*: always 3, since the main stays blank. The only two places that read a request field straight from the student (grep) |
| 9 | js/agendamento.js:899-943 `aplicarAgendamento` | :904 keeps the main request as it was (`principal`); :905 picks the target; :907 `mid = alvo === aluno ? 0 : alvo.mid`; :941 `pedido: movido ? doMovido : mid === 0 ? principal : null` | New flight: **BREAKS THE SHAPE** (ran: `{"mid":0,"criado":true}`, pin `101_0_1`). "Mover" and "Encaixar" of an extra: OK (ran) |
| 10 | js/reversoes.js:102-115 `validarReversao('desfazerAgendamento')` | :111 `pedidoRuim = ausente(rev.pedido) ? !criado \|\| mid === 0 : !pedido`: only a flight created as an extra may come without the request of before | OK (ran). Tests: test/unit/reversoes.test.js:153, 207-208 |
| 11 | js/reversoes.js:165-191 `desfazerAgendamento` | :170 no request of before: the extra is removed; :171-178 otherwise the 13 fields of the target are deleted and those of before assigned (the main request cannot be removed) | OK (ran for mid 0 and for a moved extra). A field outside the 13 on an extra is neither restored nor removed. Tests: test/unit/reversoes.test.js:229, 246 |
| 12 | js/reversoes.js:136-149 `motivoParaNaoDesfazer`; :202-229 `agendamentosEmVolta` | "request gone" (`!criado && !atual`, :141; `!pedido`, :226) can only happen to an extra | OK\*: a derived extra that disappears (pedido cancelled) gives 'O pedido deste voo saiu da Demanda: não há o que desfazer.' (ran). This text and the one of :142 name the Demanda |
| 13 | js/reversoes.js:46-53; js/eventos/historico.js:53-61; js/eventos/demanda.js:42, 190, 221 (`setFly`) | `mid` defaults to 0; `extras` = the extras that left with the main, at most 20, each > 0 | OK for an extra. A revert of an extra that no longer exists does nothing and says nothing (js/eventos/historico.js:56) |
| 14 | js/eventos/demanda.js:33-48 `incluirAluno` ("+ Pôr um aluno na demanda…") | looks only at the main (`if (s.fly)` → '… já está na demanda.', :40), writes `s.fly = true` (:41), revert `{ kind: 'setFly', mid: 0 }` (:42), scrolls to `tr[data-mid="0"]` (:46). The datalist `#alunos-fora` does look at the extras (js/views/demanda.js:104) | **BREAKS** (read): for a student who flies only through extras, typing the name turns the blank main on (a "Voo Local · C152" with no pedido) |
| 15 | js/eventos/demanda.js:213-223 (Voa) | `!mid && !target.fly`: turning the MAIN off turns every flying extra off, and the revert carries `extras` | **BREAKS** (read): Voa on and then off on the main row turns off every pedido of the student. Voa on an extra and `rm-fly` (js/eventos/demanda.js:184-194) touch only their own request: OK. Test: test/e2e/demanda.spec.js:164 |
| 16 | js/views/demanda.js:49-58, 85-91; css/app.css:1546; index.html:306, 338 | `isExtra = mid !== 0`: the main row has the name and "+ missão"; the extra row has "↳ missão extra" and "✕" and no name. The main row is always drawn, class `off` when it does not fly; `#dem` starts with class `only` and `.only tr.off { display: none; }` | **BREAKS** (read, not run in a browser): with "Só quem voa" on (the default) the main row is hidden, so no row shows the student's name and "+ missão" is out of reach. The name stays in `data-nm` and the aria-labels. Tests: test/e2e/demanda.spec.js:142 |
| 17 | js/eventos/demanda.js:174-182 `del-mis` | only an extra can be removed; its booked pin goes (`semAgendados`), its status and detail stay as leftovers | OK\*: a derived extra removed here comes back at the next derivation |
| 18 | js/fixos.js:95-117 `limparDemanda` | :107 the main is blanked (`deixarEmBranco`) and kept; :108 the extras are removed, except those Atrasado, Em Voo or Pousou | OK\* (ran): every derived extra not in progress is removed; with a derivation they come back, so only the side effects remain (pins, statuses and details released, schedule reopened). Tests: describe 'Limpar demanda' (test/unit/fixos.test.js:889), :915 |
| 19 | The label. Engine: js/engine.js:410, 543, 561, 994 (used at :452, 475, 533, 581, 765, 789, 802, 924, 964, 986). Outside: js/agendamento.js:52 `rotuloDoVoo` (:1032, 1049-1051, 1106, 1177, 1185) and :235 `motivoDeFora` | "Nome" for mid 0, "Nome (Missão)" for an extra; the app rebuilds the same text to find the rejection of a request or of a row | OK\* (ran): two extras "Voo Local" of one student, rejected with `equipamento-da-missao` and `disponibilidade-do-aluno`, both show "Encaixar Voo Local (ficou fora: a missão não voa nesse tipo de avião)". See section 6 |
| 20 | js/agendamento.js:132-155 `naOrdemDoMotor` | :144 last key 0 for the main, position in `extra[]` + 1 for an extra | OK (ran: extras with mids 9 and 3, in that order in `extra[]`, come out 9 then 3) |
| 21 | js/eventos/recursos.js:210 | `mid: p === s ? 0 : p.mid` in the `restaurarHorarios` revert | OK |
| 22 | The default 0: js/eventos/registro.js:26, 51 (no `data-mid`); `o.mid \|\| 0` or `p.mid \|\| 0` in js/noturno.js:26, 57; js/instrutor-escolhido.js:95, 159; js/eventos/escala.js:181; js/views/escala.js:64, 371; js/views/etapas.js:39, 62, 171; js/progresso.js:147; js/agenda.js:89, 120; js/agendamento.js:138, 214, 250, 266, 362, 383, 1233 | a row or a request without `mid` is the main request | OK: every row and every extra carries its `mid` (js/engine.js:521, 726, 898) |
| 23 | js/migracoes.js:21-35, 103-105 (format 12); js/backends/local.js:77-81 (legacy `acpm2`) | the step converts the main and, inside it, `extra`; the legacy conversion knows only the main | OK |
| 24 | js/dom.js:173, 175 (`data-mid` in `QUEM_E` and `DA_LINHA`) | focus keeping identifies a Demanda control by `data-id` + `data-mid` | OK |

### 3. Readers that are generic over the main request and the extras

- They loop over `[aluno, ...(aluno.extra || [])]` and filter by `fly`: `missoesDoDia` (js/progresso.js:144-149),
  `vooQueDaLugar` (js/agenda.js:86-93), `pedidosQueVoam` (js/agendamento.js:44), `fimDasMissoesDoDia`
  (js/horarios.js:47-50), `cnt` (js/views/demanda.js:93-106). OK (ran for `missoesDoDia`).
- They loop WITHOUT looking at `fly`, so the blank main request is not inert:
  - saving a take-off list adjusts `p1`, `p2`, `jan` of every request of the category and lists each one in the revert
    (js/eventos/recursos.js:205-210); the summary counts them (js/views/horarios.js:42-43; `impactoDosHorarios`,
    js/horarios.js:147-158). (ran) three students with a blank main (`eq: 'C152'`, 08:20 and 10:10, js/rules.js:82)
    and no flight give "3 pedidos mudam de preferência." when the C152 list loses those times. The same happens today
    for every student who does not fly; in the target shape it is every roster student, and a revert that lists more
    than 500 requests is not valid, so its entry has no "↶ Reverter" (js/reversoes.js:84);
  - the Cursos code lock: a request that does not fly but still has `etapa` locks the code (`codigosDaDemanda`,
    js/views/cursos.js:56-68);
  - deleting an instructor removes `insId` from both (js/eventos/cadastros.js:123).
- By key or by row, with no notion of main: the pins and Aprovar (js/fixos.js:14-27, 44-69), the statuses
  (js/eventos/escala.js:123-138), the result of a mission (`voo: o.fKey`, js/eventos/escala.js:242), the Sugestões
  (js/reparo.js:22-125), the chosen instructor (js/instrutor-escolhido.js:89-125; ran on a Ground class made of two
  extras: both requests and both pins change), `cursoDoResultado` (js/views/etapas.js:170-173), the Noturno return
  (js/noturno.js:17-30, 56-61), the Escala's "✕" (js/views/escala.js:64, 371).
- Never read a request: CSV, PDF, Excel, BI, Painel, TV and the two SQL readers (they read `resultado.out`, `fStatus`,
  `fObs`); no SQL mentions `mid` (grep over supabase/).

### 4. The value of `mid`: every bound outside the engine

| Where | Bound | Effect of a larger or different value |
|---|---|---|
| `painel_do_dia()` (supabase/migrations/20261120150000_painel_do_dia_com_a_configuracao.sql:20, 74, 79, 90) | key `'^[0-9]{1,12}_[0-9]{1,6}_[0-9]{1,6}$'`: `mid` up to 6 digits | the row is left out of `voos` and its status and detail out of `fStatus`, `fObs`: the flight is not on the reception TV (read, not run) |
| `normalizarLinhaGravada` (js/escala-gravada.js:37, 78, 107) | `mid: v => inteiro(v, 0, 1e9)` | one row above it discards the whole saved schedule at every open (ran: 1e9 valid, 1e9 + 1 and 1795000000000 invalid) |
| `normalizeAndMigrateState` (js/storage.js:168) | positive integer | renumbered at load |
| `validarReversao` (js/reversoes.js:49, 51, 69, 76, 88, 104) | integer ≥ 0; in `extras`, > 0 | the History entry loses its button |
| `CHAVE_DO_VOO` (js/voo.js:4), `salvar_dia` (supabase/migrations/20261114143242_formato_e_status_do_dia.sql:29-34), `resultados_de_missao.voo` (supabase/migrations/20261114120000_resultados_de_missao.sql:12) | digits, any length | none |

- Pedido ids: `id bigint generated always as identity` on the server
  (supabase/migrations/20261110222506_agenda_de_solicitacoes.sql:7); `Math.max(Date.now(), …)` in local mode, 13
  digits (js/backends/local.js:46, 176); `solicitacoes.length + 1` in the e2e fake (test/e2e/supabase-falso.js:393).
- Mids already stored: 0; small numbers from `proximoMid`; and numbers from the roster counter `nid` (1000 and up) in
  the example and in the days seeded on the preview (test/helpers/exemplo.js:47-48, 58;
  scripts/semear-dias-previa.mjs:81-83).
  Server pedido ids and e2e fake ids start at 1, inside that range.
- Results on the server are keyed by the flight key and the table only grows (`revoke insert, update, delete,
  truncate … from authenticated`, supabase/migrations/20261114120000_resultados_de_missao.sql:1-4, 22): moving the
  requests of a stored date from mid 0 to an extra would orphan its results unless a migration rewrites `voo`.

### 5. What a stable `mid` does not cover: fields written ON the request

- Writers of a request by `(stuId, mid)` that are not the pedido: the booking sets `fly`, `eq`, `nb`, `p1` = the booked
  time, `p2 = -1`, `insId`, and deletes a `jan` that does not include the new time (js/agendamento.js:910-917); the
  chosen instructor sets or deletes `insId` (js/instrutor-escolhido.js:104-109, 140-145, 165-172); "Tirar da escala"
  and Voa set `fly` (js/eventos/demanda.js:188, 214); the take-off times edit sets `p1`, `p2`, `jan`
  (js/eventos/recursos.js:205-210); five revert kinds restore them (js/eventos/historico.js:53-61, 96-106;
  js/reversoes.js:165-191; js/instrutor-escolhido.js:138-153, 177-183).
- (ran) An extra with `jan: 'h500'` moved by the booking to 14:30 becomes `p1: 870, p2: -1, insId: 2`, without `jan`.
  Rebuilt from the pedido with the same `mid` (`jan: 'h500'` again), the pin stays at 14:30, the engine marks the
  conflict `disponibilidade`, and "↶ Desfazer" is refused with 'O pedido mudou depois do agendamento: desfazer agora
  mexeria em outro voo. Mude o pedido na Demanda.' (`mesmoPedido` compares `mis`, `eq`, `nb`, `etapa`, `p1`, `p2`,
  js/reversoes.js:121-125, 142). A pin whose type or length no longer matches the request gets `tipo-de-aviao` or
  `duracao` (js/engine.js:436, 449).
- (ran) A new flight booked on mid 0, followed by a derivation that puts the main request back to blank and off: the
  flight leaves the schedule, the pin `101_0_1` stays as a leftover, its "↶ Desfazer" is refused with the same text, and
  the next new flight goes to the extra `mid` 4322 (largest + 1).
- Because `separar` writes `pedidos` from `S.stu` at every save (js/dias.js:59-62), a state derived in today's shape is
  stored by the first `gravarAlteracao` after it (js/actions.js:189-195). Opening a date writes nothing
  (js/actions.js:197-202).

### 6. The label that ties a rejection to its request

- An `err` alert is `{ t, s, m, codigo }` (ran: keys `t,s,m,codigo`), pushed inside the queue loop
  (js/engine.js:556-966), one per rejected request ('toda missão marcada é alocada ou recebe um alerta de rejeição',
  test/unit/engine.invariants.test.js:63-68).
- Readers of `s` outside the engine: the join in js/agendamento.js:235 ("Encaixar … (ficou fora: …)") and :1032
  ("Sai: … (motivo)" in the booking preview); the Escala summary, which also removes repeated labels from the list of
  names (js/views/escala.js:458-459, 472); the CSV (js/csv.js:63) and the PDF, column "Aluno" of "Alertas e pendências"
  (js/export.js:87). In the target shape every label is "Nome (Missão)".
- (measured) 10 students of the 40 golden inputs have two flying extras of the same mission, so the shared label is
  not a corner case of the generator. Two students with the same name share a label already today.
- Whether a request was left out needs no label: it flies and its key is not in `out` (js/agendamento.js:362, 383,
  1233). Only the reason needs the join.

### 7. Tests and seeds built on the main request

- `aluno(id, pedido, extra)` spreads the request over the student with `fly: true` by default; `missaoExtra(mid,
  pedido)` builds an extra (test/helpers/montar.js:11-17). 62 files under test/ import it; `missaoExtra(` is on 38
  lines of 15 files (measured).
- A key ending in `_0_1` is on 480 lines of 29 unit test files and on 53 lines of 15 e2e files (measured). The
  generator puts statuses only on `_0_1` (test/helpers/cenarios.js:80).
- e2e creates most flights by ticking Voa on the main row: `data-f="fly"` on 33 lines in 11 spec files, and
  `tr[data-mid="0"]` on 28 lines in 11 spec files (measured).
- None of these fail while the engine and the helpers keep accepting mid 0; they pin behaviours 6, 9, 10, 11, 15 and 16
  of the table.

### 8. The repo's rules in this area

- Pure engine and goldens: the target shape changes neither (section 0, measured).
- `gravarAlteracao` only: every writer above goes through it (js/eventos/demanda.js:42, 85, 115, 129, 149, 169, 180,
  189, 208, 267; js/eventos/agendamento.js:36; js/eventos/historico.js:59, 88, 94, 105, 120; js/eventos/agenda.js:54;
  js/eventos/recursos.js:212). A module that rebuilds `S.stu` when a date opens must not save by itself.
- Format steps never delete fields: each new field of the MAIN request needed its own format number because an older
  tab's whitelist drops it on save (`jan`, format 9, js/migracoes.js:74-78; `insId`, format 22, :176-182;
  `cursoDaEtapa`, format 24, :198-206). A field that exists only on extras survives an older tab's save (table row 2).
- Personal data and names: an extra is saved whole, so anything the module writes on it (for example the pedido's
  `aluno_nome`, `registrado_por`, `observacao`) would be stored in the day document, which the whitelist prevents for
  the main request.

## What the maps got wrong or left out (name the map)

- **mapa-demanda, S3** ("emit all pedidos as extras with `mid = solicitacao id` and leave the main request off"):
  it lists three risks and no blocker. Left out: (1) local pedido ids have 13 digits and fail both bounds of section 4
  (mapa-dados 5.8, "Local mode", and mapa-pedidos section 7 item 10 do say so); (2) `proximoMid` returns the largest mid + 1,
  which may be the next pedido id; (3) `alvoDoNovoPedido` still sends a new flight to mid 0; (4) the list it promises
  ("modules that assume `mid` 0 is the main request change") is table 2 above, and most of it does NOT need to change:
  rows 6, 7, 9, 14, 15, 16 and 19 do.
- **mapa-demanda, S3 and conflict 7**: the label is built at four engine lines (410, 543, 561, 994), not only at 561,
  and is rebuilt at js/agendamento.js:52 and :235; the readers that print it (Escala summary, CSV, PDF) are not named.
- **mapa-demanda, 5.5** ("The only bound is 20 extras in the `setFly` revert payload"): that bound applies only to the
  extras that leave together with the main request (js/reversoes.js:49); it is not a bound on extras per student. The
  bounds on the `mid` value itself (section 4) are missing.
- **mapa-pedidos, section 7 item 10** ("the server accepts at most 6 digits there"): only `painel_do_dia` has that pattern. The
  day is saved and a result is recorded with any number of digits
  (supabase/migrations/20261114143242_formato_e_status_do_dia.sql:31; 20261114120000_resultados_de_missao.sql:12);
  what a longer `mid` loses is the flight on the TV. The client bound is another one (1e9, js/escala-gravada.js:37).
- **mapa-motor, 5.8 and 7.1**: correct that the engine accepts the shape, and "for example the pedido id" repeats S3
  without the blockers. Left out: the goldens already pin the shape (38 students, 226 rows, measured), and the engine
  orders a student's extras by their position in `extra[]`, so the module must emit them in a fixed order.
- **mapa-restricoes, 5.3 "New flight"** (target = `alvoDoNovoPedido`): describes the rule, not its consequence for a
  derived stage: a booked flight with no pedido takes mid 0 first, and a derivation that resets the main request erases
  it while leaving its pin (section 5, ran).
- **mapa-demanda 2.1 and mapa-alunos section 1** ("`juntar` spreads the stored request over the roster student"):
  neither says that roster keys inside a stored main request win over the roster (table row 3, ran).
- **All maps**: none says that the blank main request still counts in the take-off times edit and its 500-request
  revert limit (section 3), nor that the Demanda's extra rows carry no name (row 16).
- No map was found wrong about js/engine.js:292-303.

## Implications for the plan (suggestions, marked as such)

All items below are suggestions.

1. **Suggestion: do not make "the main request stays off" a requirement of the output shape.** Keep one allocator for
   the day (`alvoDoNovoPedido` + `proximoMid`, as today) for pedidos, bookings and hand-made flights, and let the
   request's own `solicitacao` field be the stored pedido → `mid` map (it is already saved, js/dias.js:22). The module
   takes the day's stored requests as an input: an approved pedido reuses the request whose `solicitacao` is its id
   (keeping `mid` and everything the operator wrote on it), otherwise it gets a new slot. Cost: small; table 2 stays as
   it is, no bound of section 4 is touched, old dates need nothing. Risk: it is not "no data of its own" (the stored
   requests are the module's output and its memory); a rule is needed for a pedido cancelled or un-approved after its
   request exists; the asymmetries of rows 14 to 16 and 19 remain until the Demanda screen is replaced.
2. **Suggestion, if the plan prefers "every pedido is an extra":** the minimum set of changes is: a variant of
   `alvoDoNovoPedido` that never returns the student (rows 6 and 9); one number space for pedidos and hand-made
   requests (row 7), either by storing the map as in 1 or by making every booked flight a pedido; the Demanda view and
   handlers replaced in the same step that switches the shape (rows 14 to 16; workstream G, not E); mids ≤ 999,999.
   Cost: medium, plus the e2e rewrite of section 7 (which G needs anyway). Risk: a collision on the cut-over date,
   where stored requests with mids 0, 1, 2… or 1000… meet pedido ids that start at 1.
3. **Suggestion: do not use the raw pedido id as `mid`.** If the plan wants it anyway, it needs three things: a
   local-mode counter instead of `Date.now()` (js/backends/local.js:46) or a higher bound in js/escala-gravada.js:37;
   a wider pattern in `painel_do_dia` before the ids pass 999,999 (a migration with pgTAP); and no `proximoMid` in the
   same day (row 7). Cost: three places and a migration. Risk: the two bounds fail silently (schedule recomputed at
   every open; flight missing on the TV).
4. **Suggestion: never re-key stored dates.** Dates before the cut-over keep their mid-0 requests; the code keeps
   reading both shapes (it does today). Cost: none. Risk: none found; the alternative needs a rewrite of
   `resultados_de_missao.voo`, of five revert kinds in the History and of the D+1 Noturno keys.
5. **Suggestion: decide where operator writes on a request live before fixing the output shape** (section 5). Either
   they stay on the stored request (suggestion 1) or the module applies a per-flight override store after deriving
   (mapa-restricoes suggestion 2). Cost of the second: every writer of section 5 and five revert kinds. Risk of doing
   neither: booked flights in conflict and "↶ Desfazer" refused, as run.
6. **Suggestion: stop joining rejections by text.** (a) No engine change: a request is out when its key is not in
   `out`; for the reason, pair the k-th `err` of a label with the k-th rejected request of that label in engine order
   (chosen instructor, `pr`, `solicitacao`, position). Cost: one pure function with tests. Risk: it mirrors the engine's
   sort and breaks silently if that changes. (b) Engine change: add `fKey` and `stuId` to `err` alerts; the saved-schedule
   validator already accepts them (js/escala-gravada.js:89-93). Cost: its own commit; the `err` alerts of the goldens
   change (174 per mapa-motor). Risk: a golden change that is not a rule change needs Pedro's agreement.
7. **Suggestion: make `juntar` take only `CAMPOS_DO_PEDIDO` and `extra` from the stored main request.** Cost: one
   expression and a unit test. Risk: none for data the app wrote (the round trip test/unit/dias.test.js:17 keeps
   passing, inferred).
8. **Suggestion: give the Processamento module tests of its own output contract**: positive integer mids, unique per
   student, within the bounds of section 4; `extra[]` in a fixed order; no field with names or free text on an extra
   (extend test/unit/dias.test.js:25 to the extras); the main request untouched. Cost: small. Risk: none.
9. **Suggestion: keep `aluno()` and the mid-0 unit tests as they are** (the engine keeps both shapes) and seed the new
   e2e flights through approved pedidos. Cost: the 33 Voa lines and 28 `data-mid="0"` lines of section 7. Risk: e2e
   coverage of the Escala drops while the helpers are rewritten.

Open questions that follow from this file:

- Is a flight with no pedido still allowed ("+ Agendar voo" for a student who asked for nothing, a second flight by
  hand)? If yes, it needs a request slot in the same number space as the pedidos.
- May the stored requests of the day be the module's memory (suggestion 1), or must the day store nothing about
  requests?
- When an approved pedido is cancelled after its flight was pinned, approved or flown: does the request stay (turned
  off) or go, leaving its pin, status and result as leftovers?
- May `err` alerts gain `fKey` and `stuId` in a commit that changes the goldens only in those fields?

<!-- fim -->
