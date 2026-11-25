# Desenho: The core data flow: from approved pedidos to the engine input, and the operator restrictions

Architect B, lens **truly derived**: the day stores only what cannot be derived; the requests the engine reads are rebuilt at every load and before every save. Code read at `/Users/pedrofernandes/ACPM/.redesenho/wt-plano` (48875e3); paths are relative to it.
Words: **pedido** = a row of `solicitacoes`; **request** = what the engine reads (`stu[]` fields, `stu[].extra[]`); **flight key** = `<stuId>_<mid>_1`; **own flight** = a flight that has no pedido behind it (a booking, or a request stored before format 28).
"(ran)" = run with node on a scratch copy of `js/` outside the worktree (`…/scratchpad/nucleo-b/proto*.mjs`), fictitious names and weights only:

| Run | Result |
|---|---|
| R1. Stored day → `voos` + `restricoes` (the step 28 of section 4) → requests rebuilt → engine, against today's load path; 301 states (example + 300 generated) × 3 variants (plain, `comEscolhas`, `comVolta(comAtributos(comEscolhas))`) | 903 states, 19,305 flights converted, 219 kept "off with leftovers": engine-read requests differ in **0**, schedules differ in **0** |
| R2. Requests rebuilt from pedido rows + bindings, against `importarSolicitacoes` on a clean day; 100 days, 2,272 pedidos (9 mission types, 6 times, two pedidos for every third student) | days that differ: **0** |
| R3. Rejections paired with requests by label, in the engine's queue order, against a debug copy of the engine that tags each `err` with its key; 1,200 days, 7,290 rejections, 631 with a repeated label (2,671 when every student has one of three names) | wrong pairs: **0**; unmatched: 0 |
| R4. "Cabe sozinho": the engine on a copy with only that request flying, no pins, no statuses; 300 days, 6,137 flying requests | 365 rejected alone, **0** of them placed in the full day; 0.104 ms per request, worst day 7.4 ms |
| R5. One pedido at 08:20: (a) approved; (b) moved to 14:30 with the restriction stored and the pin; (c) same pin, restriction lost; (d) pedido cancelled; (e) `fora`; (f) priority 5 and a chosen instructor | (a) flies 08:20; (b) flies 14:30, no conflict; (c) conflict `disponibilidade` (what lacuna-1-pedido-principal §5 ran); (d) and (e) out, pin dormant; (f) honoured |

Where each question of the brief is settled: Q1 → 2.4; Q2 → 2.5; Q3 → 2.6; Q4 → 2.7; Q5 → 2.8; Q6 → 2.2 and 6; Q7 → 2.9; Q8 → 2.10 and 2.11; Q9 → 2.13 and 4; Q10 → 2.12.

## 1. Decisions (numbered; for each: the decision, why, the evidence as a map section or path:line, and the alternative rejected with the reason)

| # | Decision | Why | Evidence | Alternative rejected, and why |
|---|---|---|---|---|
| 1 | **The engine's input keeps today's shape; the requests in `S.stu` become a cache.** One pure function, `montarPedidos`, rebuilds every request from the pedido rows, the cadastro and two day maps, at every load and before every save. The day stops storing requests. | Pedro's preference (engine and goldens untouched) and his sentence "no data of its own" are both met literally. | pedido.md:34-40; js/engine.js:291-303; R1, R2 | Change the engine's input: 41 goldens, 62 test files on `test/helpers/montar.js` (mapa-motor 7.1). Materialise (`dia.pedidos` kept, written by a reconciliation): cheaper, compared in 2.15. |
| 2 | **The day stores two new maps keyed by the flight key**: `voos` (where each flight comes from: the pedido it is bound to and the course mission bound then; or the own request of a booking) and `restricoes` (what the operator imposed). Format **28**. | The key already indexes `fixos`, `fStatus`, `fObs`, the saved rows and the results; a booking needs restrictions and has no pedido id; a document keyed by flight key validates itself (the student is in the key). | mapa-restricoes 2.5; js/voo.js:5; js/dias.js:55-72 | Keyed by pedido id: no place for bookings; the student would be known only from the row, so a tampered day could not be normalised alone. One map with both: the binding is written by the conciliation and the restrictions by the operator; two writers, two maps. |
| 3 | **Identity: one allocator, `alocarMid`, and a binding that is never deleted.** A pedido gets its `mid` once (0 when the student's key `_0_1` is clean, else 1 + the largest `mid` among the student's `voos` keys and the keys the day still keeps); a pedido id is only ever a value (`voos[k].sol`), never a `mid`. | Stable across loads, saves, cancellations and re-approvals; inside both bounds (6 digits for the TV, 1e9 for the saved schedule); mid 0 keeps today's labels for one-flight students. | lacuna-1-pedido-principal §4, §2 rows 6-7; js/rules.js:54-72, 95-100; supabase/migrations/20261120150000_painel_do_dia_com_a_configuracao.sql:20; js/escala-gravada.js:37 | `mid` = pedido id (mapa-demanda S3): local ids have 13 digits, collides with `proximoMid`, old dates. "Every pedido an extra": rows 14-16 and 19 of lacuna-1 §2 break, every label becomes "Nome (Missão)". |
| 4 | **The course mission is bound when the pedido enters the date and stored in the binding** (`etapa`, `cursoDaEtapa`, and the resource type the programme gave, `eq`). It is the one place this design stores something a function could recompute. | Recomputed, it advances after the flight's own result and moves under programme edits, while the saved schedule of a date is not recomputed on open (fact A4; a pinned flight would get `tipo-de-aviao`). "What the pedido received when it entered" is an event, like the `mid`. | mapa-demanda 5.8 item 9; js/actions.js:309; js/engine.js:436, 449; js/eventos/escala.js:242 (the result is recorded against the row's code) | Recompute until a pin or a result freezes it: two regimes, and an unapproved past date would rewrite its missions at the next save. Store on the `solicitacoes` row (mapa-demanda S4): a server change for D, and a booking has no row. |
| 5 | **Membership is live: `fly` = the pedido is approved now and the operator has not taken it off, or the flight is in progress.** No stored "is in the day" flag for flights born from a pedido. | It is what "input: the approved pedidos" means; no state where a cancelled pedido stays in the day because nobody reconciled (today's gap); a read-only profile sees the truth. | mapa-pedidos 5.4 ("It only adds"); mapa-dados 5.8; R5 d | A stored flag changed only by an explicit "Atualizar" (posicao B1): the operator keeps the moment, but a failed save between the server call and the day leaves a stuck state, and the store is no longer derived. |
| 6 | **`conciliar` runs before every save** (and by itself at "Atualizar"): it binds the approved pedidos that have no flight and releases what a dead flight still holds. One History entry per pedido, no revert. | With decision 5 a save already computes the schedule from the live approved set; binding at the same moment keeps both directions alike, and the normal case (she approves, it enters) costs no click. | js/actions.js:166-195; mapa-dados 5.4 | Bind only on the click: removals would be implicit and additions explicit. |
| 7 | **A read writes nothing.** At load `pendenciasDosPedidos` says what the next save will do; the screen shows it; an Operador has "Atualizar", a read-only profile only the notice. | Guardrail; `lerData` must not save. | js/actions.js:197-202, 288-317 | — |
| 8 | **Operator restrictions are explicit fields with one writer, `restringir`**, edited in the Escala stage ("Restrições do voo"); the Processamento screen has no input. | The screen can say exactly what she imposed and undo one item; a writer that bypasses the store is overwritten by the next rebuild, so it cannot hide. | mapa-restricoes 5.6 (16 inputs, 8 of them on the request record); R5 b-c | Restrictions as the stored difference between the request in memory and the derived base (no writer changes): any stray mutation becomes a silent "restriction" (the take-off times editor would create hundreds). |
| 9 | **A booking stays outside Pedidos**: it is an own flight (`voos[k].proprio`) with its pin and its restrictions. "+ missão" and "Pôr um aluno na demanda" end as controls: a second pedido ("Registrar e aprovar") or a booking. | The request lists "+ Agendar voo" among the operator restrictions; a booking decides more than a pedido holds and may pass rules the server refuses (PT422, the deadline). docs/PLAN.md:421 stays as recorded. | mapa-restricoes 5.3; lacuna-2 2.7 a | A booking registers a pedido: a server path that relaxes three rules, two writes that are not atomic, Pedidos filled with rows nobody asked for. |
| 10 | **"Tirar da escala" is a restriction (`fora`), not a withdrawal of the approval.** | It keeps the pin and the status dormant, has a revert, needs no network; the brief lists "the exclusion" among the restrictions. | js/eventos/demanda.js:184-194; test/e2e/demanda.spec.js:511 | "Voa off = withdraw the approval" (posicao B2): a server call outside `gravarAlteracao`, no revert, and the flight would lose its place. |
| 11 | **Stored days: step 28 turns every stored request that matters into a frozen own flight** (`proprio` = the request as stored; `sol` kept as a link) plus `pr`, `insId` and `fora` as restrictions. Their membership does not follow the pedido. `pedidos` stays in the document as a frozen copy; `importadas` stays and means "seen before the change". | A step sees one document: it cannot read the rows or the programme, so it cannot tell a derived value from a typed one. Past dates are records. | mapa-dados 5.3 ("must be pure and see only its own document"); R1; README.md:167; the precedent of `cadastro.cursos` (js/dias.js:51) | Convert at load with the rows: a second, unstored conversion. Drop `pedidos` at the next save: against the practice of keeping dead copies. |
| 12 | **The Escala-stage writers are re-pointed through three helpers** (`criarVooProprio`, `restringir`, `removerVoo`); the nine revert kinds stay, three payloads unchanged, one extended. | The honest extra cost of this lens: a materialised design leaves these writers alone. | 2.10, 2.11 | — |
| 13 | **"Limpar demanda" becomes "Recomeçar a escala"** (same menu, same two clicks): releases every pin, status and detail, clears the restrictions, removes the own flights, reopens the approval; flights in progress stay; the approved pedidos stay, so nothing has to be imported again. Reverses the decision of 2026-11-19 (docs/PLAN.md:437), which the request does not list. | Nothing is left to blank; operators use it to restart a date. | js/fixos.js:95-117; lacuna-2 §3 | Remove it: no way to restart a date except undoing each restriction. |
| 14 | **The take-off times editor stops adjusting requests.** Preferences are recomputed from the pedido against the current list at every load, on every date. | Today only the open date is adjusted and the other dates degrade silently. | js/eventos/recursos.js:203-211; js/agenda.js:67-70 | — |
| 15 | **Reasons, without touching the engine's alerts.** Before the engine: `cabeSozinho` runs the engine on a copy with only that request (its own code and text), plus notes only the module knows. After it: `rejeicoesPorVoo` pairs each `err` with its request by label in queue order. | No second implementation of the rules to drift; the goldens stay. | lacuna-1-motivos §5, suggestion 2; lacuna-1-pedido-principal suggestion 6a; R3, R4 | A function built from `js/candidatos.js` for the verdict: same answer (13,612 of 13,612) and a fourth copy of the start-time rule. `fKey` on `err` alerts: 174 golden alerts change. |
| 16 | **Two pure modules**: `js/processamento.js` (bind, rebuild, reasons) and `js/restricoes.js` (the two maps: shape, normalisers, allocator, writers). In **E** the import button already runs `voosDosPedidos`, `conciliar` and `pedidoDoVoo` in memory and writes the new requests in today's shape. | The cut-over's core (the conversion of stored requests, the allocator, the binding, the rebuilding of one request) is in production, behind the 21 import tests, one step before the storage changes; the lint passes (exports used by the app, or used inside the module and tested: scripts/exportacoes-sem-uso.mjs:139). | posicao B8; test/unit/agenda.test.js:89-334 | Leave them for G: G becomes the first time they run. |
| 17 | **G is two PRs.** G1: format 28, the load and save paths, every writer re-pointed, with the Demanda table still on screen as the editor of restrictions. G2: the Processamento screen and "Restrições do voo"; the table is deleted. | The data change is proven by the table's own 23 e2e tests before the screen changes; never two versions of a screen. | test/e2e/demanda.spec.js (23 tests) | One PR: storage, ten writer sites, five reverts and two screens reviewed together. |
| 18 | **The pedido rows of the date are a required read of `carregarDia`.** Without them the date does not open (as without the cadastro). | A schedule computed from zero requests must never be saved over the stored one; a required read needs no new guard beside `dadosLidos`. | mapa-dados 5.8; js/storage.js:182-213; supabase/migrations/20261113140000_leitura_por_perfil.sql:34-37 (the four profiles read the table) | A fifth entry of `indisponiveis` with a "do not save" guard: one more degraded mode to test. |
| 19 | **A request that cannot fit alone still goes to the engine.** | "N missões pedidas", the PDF's "Missões na demanda" and the BI's `rej` stay comparable with past dates. | lacuna-1-motivos suggestion 9 | Hold it back: three numbers drop on every date from then on. |
| 20 | **A booked flight whose mission, type or hours change is released**, as today, by `restringir` itself (docs/PLAN.md:422 kept, in one pure place). | The rule lives only in event handlers today. | js/eventos/demanda.js:25-30, 245-249; lacuna-2 2.8 | Leave it in conflict: reverses a recorded default. |

## 2. How it works (data shapes with field names, function signatures, screen structure, states: enough for an implementer)

### 2.1 What the day stores (format 28)

```
dia:<data>
  voos:       { "<stuId>_<mid>_1": { sol?, proprio?, etapa?, cursoDaEtapa?, eq?, aVincular? } }
  restricoes: { "<stuId>_<mid>_1": { fora?, pr?, insId?, mis?, eq?, nb?, etapa?, cursoDaEtapa?, p1?, p2?, jan? } }
  fixos, fStatus, fObs, aprovacao, win, av, ins, horas, filas, hangar, criterios, resultado      (unchanged)
  importadas  (unchanged; nothing appends after format 28)
  pedidos     (only in days stored before format 28: the copy of before, never read again)
```

| Field | Values | Written by | Meaning |
|---|---|---|---|
| key of both maps | `/^\d{1,12}_\d{1,6}_1$/` | — | the flight key; `mid` at most 999,999 (the TV's pattern) |
| `voos[k].sol` | safe integer > 0, unique in the map | `conciliar`; step 28 | the pedido this flight belongs to |
| `voos[k].proprio` | `{ mis, eq, nb, p1, p2, jan? }` | `criarVooProprio` (booking); step 28 | the flight's own request: with it, nothing is read from the row |
| `voos[k].etapa`, `.cursoDaEtapa` | `codigoValido`, `siglaValida` (js/cursos.js:9) | `conciliar`; booking; step 28 | the course mission bound when the flight entered the date |
| `voos[k].eq` | a type of `MIS[mis].eq` | `conciliar` | the type the programme gave to that mission then (absent: `MIS[mis].defEq`) |
| `voos[k].aVincular` | `true` | `conciliar` | bound while the programmes or the results were not read: the next `conciliar` that has them binds the course mission |
| `restricoes[k].fora` | `true` | "Tirar da escala" | out of the engine's queue; pin and status dormant |
| `.pr` | 1, 2, 4, 5 (absent = 3) | "Restrições do voo" | priority |
| `.insId` | integer > 0 | Escala instructor list, "Restrições do voo", booking, Sugestões | the chosen instructor |
| `.mis` | key of `MIS` | "Restrições do voo › Missão" | another mission type (with another course mission, or "Outro tipo de missão…") |
| `.eq`, `.nb` | type; 0.1 to 5 in tenths | "Restrições do voo"; booking (Mover) | another resource type; another duration |
| `.etapa`, `.cursoDaEtapa` | code, or `''` for "sem missão do curso"; sigla | "Restrições do voo › Missão" (with the confirmation); booking | another course mission than the bound one |
| `.p1`, `.p2`, `.jan` | minute 360..1050 or -1; `'manha'`, `'tarde'`, `'noite'`, `'h<min>'`, `''` (any time) | "Restrições do voo › Horário"; booking (Mover) | a moved or loosened time |

- An entry of `voos` needs `sol` or `proprio`; an entry of `restricoes` needs its key in `voos`. `normalizarVoos` and `normalizarRestricoes` check the type before converting anything (the bug of docs/PLAN.md:440 is not repeated) and rebuild each entry from the known fields. `pedidoDoVoo` does the same with the row (`missao` a text, `horas` a number or null): in local mode the rows are JSON in the browser.
- No names, weights or free text in either map (the pedido's `aluno_nome`, `observacao` and `registrado_por` stay on the row).
- Memory only, beside `S.resultados` and `S.programa`: `S.solicitacoes` (the rows the requests were last rebuilt from), `S.pedidosDeAntes` (the frozen copy, carried through `juntar` and `separar`).

### 2.2 The two modules

`js/restricoes.js` (pure; imports `js/config.js`, `js/voo.js`, `js/rules.js`, `js/cursos.js`, `js/fixos.js`):

| Export | Signature | Step |
|---|---|---|
| `voosDosPedidos` | `(dia) → { voos, restricoes }`: the conversion of step 28 (section 4) | E |
| `alocarMid` | `(estado, aluno) → mid` | E |
| `normalizarVoos`, `normalizarRestricoes` | `(valor[, voos]) → mapa` | G1 |
| `criarVooProprio` | `(estado, aluno, { mis, eq, nb, p1, p2, jan?, etapa?, cursoDaEtapa? }) → mid` | G1 |
| `restringir` | `(estado, stuId, mid, mudancas) → { solto }`: sets or clears (`null`) each field of `restricoes[k]`, removes the empty entry, rebuilds that one request in `estado.stu`, and releases a booked pin when the request's `mis`, `eq` or `nb` really change (`semAgendados`, js/fixos.js:78-85) | G1 |
| `removerVoo` | `(estado, fKey)`: deletes the own flight, its restrictions, pin, status and detail (the key is clean again) | G1 |
| `restricoesPara` | `(base, pedido) → restricoes`: the restrictions that make `base` equal a 13-field request (only for old History payloads) | G1 |

`js/processamento.js` (pure; reuses `pedidoDaSolicitacao`, `disponibilidadeDaSolicitacao` of js/agenda.js; `normalizeMissionFields`, `blank`, `chaveTemSobras`, `doesGroundGateFlight`, `rotuloDaDisponibilidade` of js/rules.js; `proximasMissoes`, `estadoDoAluno`, `motivoDoBloqueio` of js/progresso.js; `indiceDoPrograma`, `rotuloDaMissao` of js/programa.js; `situacaoPorMissao`, `resultadoDoVoo` of js/resultados.js; `ocupacaoDaEscala`, `avioesQueServem`, `instrutoresQueServem`, `problemaDoAluno` of js/candidatos.js; `horariosDaMissao` of js/horarios.js; `exigencias` of js/habilitacoes.js; `fixoPeloStatus` of js/fixos.js; `STATUS_EM_ANDAMENTO` of js/status.js; `runAllocationEngine`, injected as a default argument as in `simularAgendamento`, js/agendamento.js:960):

| Export | Signature | Step |
|---|---|---|
| `ambienteDosCursos` | `(estado) → { inferir, programa, situacao }`: the pure form of `programaParaInferir` (js/views/etapas.js:26-29) | E |
| `missaoDoCursoPara` | `(estado, aluno, { missao, minuto, fKey }, ambiente) → { etapa, cursoDaEtapa, eq, nb } \| { nota }` (2.8) | E |
| `pedidoDoVoo` | `(estado, fKey) → request \| null` (2.3) | E |
| `conciliar` | `(estado, { ambiente, escala, retirados = [] }) → { entraram, deramLugar, sairam, ficaram, semAluno }` (2.7); the only function here that changes `voos`, `fixos`, `fStatus`, `fObs` | E (enters, gives way, binds); G1 (leaves, releases) |
| `importarAprovados` | `(estado, solicitacoes, ambiente) → { novos, atualizados, semAluno, naoCabem }`: the interim import of E (2.13); deleted in G1 | E only |
| `montarPedidos` | `(estado) → estado`: rebuilds the main request and `extra[]` of every student with `pedidoDoVoo` | G1 |
| `pendenciasDosPedidos` | `(estado, linhas, escala) → { entram, saem, semAluno, legados }`: what `conciliar` would do with `linhas`, changing nothing | G1 |
| `cabeSozinho` | `(estado, fKey, motor = runAllocationEngine) → null \| { codigo, texto }` | E |
| `rejeicoesPorVoo` | `(estado, resultado) → Map<fKey, alerta>` | E |
| `enriquecerPedidos` | `(estado, resultado, ambiente) → [item]` (2.9) | G2 |
| `resumoDoProcessamento` | `(itens) → counts` for the pipeline adapter of H | G2 |

How it stays in real use from E on: `js/eventos/agenda.js` calls `importarAprovados`, which calls `voosDosPedidos`, `conciliar`, `alocarMid`, `missaoDoCursoPara`, `pedidoDoVoo` and `cabeSozinho` (the toast gains "N não cabem sozinhos: <motivo>"); `js/agendamento.js` calls `rejeicoesPorVoo` in `motivoDeFora` (:234-237) and `motivoDaSaida` (:1031-1034), which today take the first alert with the same label; `js/views/etapas.js` `proximaDoPedido` delegates to `missaoDoCursoPara`, so "Usar" and the import follow one rule. What only G1 calls (`montarPedidos`, the normalisers, the writers, `pendenciasDosPedidos`) is written in G1.

### 2.3 How one request is rebuilt (`pedidoDoVoo`)

| Step | Pedido flight (`sol`, no `proprio`) | Own flight (`proprio`) |
|---|---|---|
| base | `pedidoDaSolicitacao({ ...linha, missao: r.mis ?? linha.missao }, estado.horarios, { eq: r.eq ?? v.eq })` (js/agenda.js:63-80; D makes it read `horario2` and `disponibilidade`) | `{ ...v.proprio }` |
| `solicitacao` | `v.sol` (the engine's fifth sort key, js/engine.js:328) | `v.sol` when the flight was stored with one; else absent |
| course mission | `v.etapa`, `v.cursoDaEtapa`; replaced by `r.etapa` (`''` removes both) | the same |
| restrictions | `pr = r.pr ?? 3`; `insId`; `nb`, `p1`, `p2` when present; `jan` (`''` removes it) | the same, plus `mis`, `eq` |
| `fly` | `!r.fora && (aprovada_em && !cancelada_em \|\| STATUS_EM_ANDAMENTO.includes(fStatus[k]))` | `!r.fora` |
| last | `normalizeMissionFields` (js/rules.js:142-179) | the same |
| no row for `sol` | no request; the screen says "pedido não encontrado" | not applicable |

- `mid` 0 goes on the student object, the others into `extra[]` in ascending `mid` (the engine's last tie-break is the position in `extra[]`, js/engine.js:299, 337; the allocator only grows, so the order is today's: R1).
- A student with no entry at `_0_1` has the blank main request (`blank()`, `fly: false`), as every new date has today (js/dias.js:121).
- Hours: fixed by the mission, else the pedido's `horas` (always present since 2026-11-14). When the operator picks another course mission, the programme's hours are written with it as `r.nb`, as "Usar" does today (js/eventos/demanda.js:95). The two rules of mapa-demanda S6 stay, each in one place.

### 2.4 Identity (Q1)

| Moment | What happens to the key |
|---|---|
| a pedido is approved | nothing yet; it is listed "entra na próxima atualização" |
| first save after that (her own approval saves at once) | `conciliar`: `mid = alocarMid(estado, aluno)`, `voos[chaveDoVoo(aluno.id, mid)] = { sol }` |
| loads, saves | the binding is stored: the same key |
| cancellation, approval withdrawn | the binding stays; the request is rebuilt with `fly: false`; pin, status and detail of the key are released unless the flight is in progress |
| approved again | the same key and the same restrictions; placed anew by the engine |
| a booking | `criarVooProprio` uses the same allocator, in the same number space; undoing a created booking cleans its key (as today, js/reversoes.js:180) |
| another pedido of the student is approved or cancelled | no other key moves |

- `alocarMid`: 0 when `voos` has no `<id>_0_1` and `chaveTemSobras(estado, '<id>_0_1')` is false (js/rules.js:52-62); else 1 + the largest `mid` among the student's `voos` keys and `chavesGuardadas` (`fixos`, `fStatus`, `fObs`, `resultados.doDia`). `proximoMid` and `alvoDoNovoPedido` are deleted in G1.
- A provisional key never reaches the server: results are recorded from a row of `RES.out` (js/eventos/escala.js:240-242), and a row exists only for a bound, saved flight.
- Two operators: the second save of the same date gets PT409 and locks (mapa-dados 5.4); after the reload the first binding is there and the other pedido is bound next. Approving twice is safe on the server.

### 2.5 Operator restrictions (Q2)

| Restriction | Stored in | Edited where, once the table is gone |
|---|---|---|
| chosen instructor, flight left where the engine puts it | `restricoes[k].insId` | "Restrições do voo › Instrutor" (first option "Automático" or "Automático (prioriza A, B)", options from `instrutoresDoPedido`, js/instrutor-escolhido.js:30-35) |
| chosen instructor, flight fixed in place | `restricoes[k].insId` + `fixos[k].escolhido` | the instructor's name on the Escala row or in the map popup (`select.ins-sel[data-a="insVoo"]`), as today |
| priority | `restricoes[k].pr` | "Restrições do voo › Prioridade" |
| another resource type | `restricoes[k].eq` | "Restrições do voo › Recurso"; booking |
| another duration | `restricoes[k].nb` | "Restrições do voo › Duração"; booking |
| another course mission, another type | `restricoes[k].etapa`, `.cursoDaEtapa`, `.mis` (with `.eq`, `.nb` from the programme) | "Restrições do voo › Missão": "A do pedido", "O programa agora diz…", "Liberadas no <sigla>", "Fora da ordem (pede confirmação)", "Sem missão do curso", "Outro tipo de missão…"; the armed button `data-act="usar-fora-da-ordem"` keeps its two steps |
| loosened or moved time | `restricoes[k].p1`, `.p2`, `.jan` | "Restrições do voo › Horário" (1ª preferência, 2ª preferência, Disponibilidade, the three selects of today); booking (Mover) |
| exclusion | `restricoes[k].fora` | "✕" on the Escala row, "✕ Excluir da escala" in the popup (`data-act="rm-fly"`); back with "Pôr de volta" in the list of flights taken off, or the History |
| a fixed time, resource and instructor | `fixos[k]` (`agendado`) | "+ Agendar voo", Mover, Encaixar |
| approval, status, Sugestões | `fixos`, `aprovacao`, `fStatus`, `fObs` | unchanged |

"Restrições do voo" is one panel of the Escala stage, `#painel-restricoes`, rows `[data-k="r"][data-id][data-mid]` with `data-f="insId|pr|mis|eq|nb|missao|p1|p2|jan"`, handled by `aoMudarCampo('r', …)` in `js/eventos/restricoes.js` (the dispatcher of js/eventos/registro.js:37-52 refuses read-only profiles and a date not read). It opens with `data-act="restricoes"` + `data-fkey` from: each row of the Escala list, the map popup, each name of the box "N missões não entraram na escala", and "Editar na Escala" of a Processamento item. It shows, read-only, what the pedido asked, then one line per restriction with what is derived beside it ("Recurso: C152 (do programa)"), and "Tirar todas as restrições deste voo". The surface (drawer like `#painel-reparo`, or a pane) is the Escala screen's design; the ids, attributes and handler are fixed here.

History: `mod` "Restrição de <aluno> (<missão> · HH:MM): <campo> <valor>[ (deixa de ser fixo)]"; the instructor keeps "Pedido <aluno>: instrutor <nome|automático>" with `restaurarEscolha`; the exclusion keeps "Tirado da escala: …" with `setFly`. The other fields have no revert, as today (mapa-demanda 5.7).

### 2.6 Bookings and requests without a pedido (Q3)

| Today | Becomes | What is written |
|---|---|---|
| "+ Agendar voo", new flight | an own flight | `mid = criarVooProprio(estado, aluno, { mis, eq, nb, p1: a, p2: -1, etapa?, cursoDaEtapa? })`; `restringir(…, { insId })`; `fixos[k] = { a, b, r, insId, classKey?, agendado: true }`; weights to the cadastro and "Marcar disponível" to `dia.ins`, as today (js/agendamento.js:921-939) |
| Mover, Encaixar (a flight of the student, from a pedido or own) | restrictions on the same flight | `restringir(…, { eq, nb, p1: a, p2: -1, insId, jan: '' when the availability excludes the new time, fora: null })` + the pin. The pedido link, the course mission and the priority stay (docs/PLAN.md:425 holds; R5 b) |
| "↶ Desfazer" | the same kind, `desfazerAgendamento` | payload `{ stuId, mid, criado, restricoes (the entry before, or null), fixo, disponibilidade, criadoComo }`. Created: `removerVoo`. Moved: the entry of before and the pin of before come back (the rules of js/reversoes.js:181-185 unchanged); a flight taken off meanwhile stays off. The guards of `motivoParaNaoDesfazer` read the rebuilt request, which no longer changes by itself (the course mission is bound, the row is immutable). Payloads recorded before format 28 (with `pedido`) stay valid: `restricoesPara` turns the old snapshot into restrictions |
| "+ missão" | a second pedido in Pedidos ("Registrar e aprovar"; the form already asks "É um reagendamento ou mais um voo?", js/eventos/agenda.js:90-97), or a booking | — |
| "+ Pôr um aluno na demanda…" | "Registrar e aprovar" in Pedidos, or "+ Agendar voo" | — |
| requests made by hand in stored days | frozen own flights (decision 11); they keep flying | step 28 |
| a booked flight after "Soltar" (Sugestões) | an own flight without pin: the engine places it | `fixos[k]` deleted, `restricoes[k].insId` cleared (js/eventos/escala.js:283-286 through `restringir`) |

The booking's simulation clones the two maps beside `stu` (`simularAgendamento`, js/agendamento.js:960-967).

### 2.7 The conciliation (Q4)

`conciliar(estado, { ambiente, escala, retirados })`, with the rows in `estado.solicitacoes`:

| Rule | |
|---|---|
| Enters | a row approved and not cancelled; with no entry of `voos` carrying its id; whose id is not in `estado.importadas` (seen before the change and cleared by "Limpar demanda": it shows as "aprovado, fora da escala desde antes da mudança · Pôr na escala"); whose student is in the cadastro (else `semAluno`: it enters when the student exists) |
| Order | keys are allocated in the order received (`data`, `registrado_em`: today's, so the same request is the main one); course missions are bound in a second pass, by time (2.8) |
| Gives way | an own flight of the student with the same mission type, no `sol`, no pin, no pinning status and no result takes the pedido on its key: the entry gains `sol` and loses `proprio`; `insId` stays, `pr` goes (today's `vooQueDaLugar`, js/agenda.js:86-93, 129-133) |
| Leaves | nothing is written to make it leave (decision 5). For a pedido flight that is no longer approved and is not in progress, `conciliar` deletes `fixos[k]`, `fStatus[k]`, `fObs[k]` (what `limparDemanda` does per key, js/fixos.js:110-114) |
| In progress | Atrasado, Em Voo, Pousou (`STATUS_EM_ANDAMENTO`, js/status.js:13): the flight stays with its pin, status and detail, as "Limpar demanda" keeps it (js/fixos.js:102); the item says "pedido cancelado; o voo fica porque está em andamento" |
| Frozen flights (`proprio` + `sol`) | never leave by themselves; when their pedido is in `retirados` (cancelled or approval withdrawn in this browser, now): `fora: true` and the same release |
| Own flights without `sol` | never touched |
| Late course mission | entries with `aVincular` are bound when `ambiente.inferir` is true |

| Question | Answer |
|---|---|
| When | inside `save()` (js/actions.js:166), before the engine: after every approval, withdrawal or cancellation made in this browser for the open date (those handlers call `gravarAlteracao` when the server call returns and the rows were read again), at "Atualizar" (`#atualizar-pedidos`: reads the rows, then `gravarAlteracao`), and with any other change of the day |
| Who | Operador and Administrador, after the date's data is read (`gravarAlteracao`'s own guard) |
| What is saved | `dia:<data>` once: `voos` with the new bindings, `fixos`/`fStatus`/`fObs` without the released keys, `resultado` recomputed. The cadastro is untouched |
| History | one entry per pedido, after the entry of the action that saved: `inc` "Pedido aprovado na escala: <aluno> (<missão> · <disponibilidade> · <h>)[ · <código>]"; `exc` "Pedido cancelado: <aluno> saiu da escala (<missão> · HH:MM)[ (deixa de ser fixo)]" or "Aprovação retirada: …"; `mod` "Pedido cancelado: o voo de <aluno> continua (<status>)". A leaving flight is logged when something is released or the saved schedule (`escala`) still has its row; after the save neither holds, so once |
| Revert | none: the state belongs to the server (approve again, or withdraw) |
| Read-only profile | the Processamento list rebuilt from the rows read at load, each pending item marked, and the notice "2 pedidos aprovados ainda fora da escala · 1 pedido cancelado ainda na escala gravada", without the button |
| Approved schedule | `aprovacao` stays. Entering flights are placed around the pins (js/engine.js:399-406); a leaving flight loses its pin. Both are pending items of Aprovar until the next approval (H) |
| Flight in progress whose pedido is cancelled | stays (row above) |
| Before "Aprovar escala" | the rows are read again; pending items are shown first |

### 2.8 The course mission (Q5)

| Case | Rule |
|---|---|
| when it is bound | in `conciliar`, the first time the pedido has a key; never again by itself |
| which | the first released mission (`liberada` or `condicional`) of the student's course whose type is the pedido's (`candidatas.find(m => m.mis === missao)`, js/agenda.js:121-122) |
| the student's other flights of the date | those whose 1st-preference time is **earlier** count as done under condition (`planejadas`); all of them are not offered again (`exceto`). Today every flying request counts as done, whatever its time, and the answer depends on the order of registration (lacuna-2 2.4, ran there) |
| AV PROF. and SOLO | a Voo Solo at 06:30 and a Voo Local at 08:20, in either order of registration: the 08:20 flight gets `AVP-SOLO-01`; the solo gets no course mission and the note "SOLO-01 espera AVP-SOLO-01, que está no voo das 08:20". She may bind it out of order in "Restrições do voo › Missão" |
| closed course (`curso.ativo === false`) | the pedido enters **without** the course mission, with the note `curso-encerrado`; "Restrições do voo › Missão" offers "Liberadas no <sigla> (curso encerrado: pede confirmação)", armed button "Confirmar: <código> do curso encerrado", History suffix ", com o curso <sigla> encerrado" (decision 2 of 2026-11-17 kept: warns and asks, never blocks; closes the import gap of docs/PLAN.md:424) |
| out of order | only by the operator, as a restriction, with "Confirmar: <código> fora da ordem" and the reason in the History (`confirmacaoDaMissao`, moved from js/views/etapas.js:98-102) |
| no programme, no match (TGL for a TMA mission, lacuna-2 2.3), results or programmes not read | no course mission; in the last case `aVincular` |
| the programme or the results now say otherwise | `enriquecerPedidos` compares the bound mission with `missaoDoCursoPara` now (the flight's own result of the date ignored): "Missão do curso: PE-03 · o programa agora diz PE-04", with "Editar na Escala". A flight that has a result shows only its code |
| the Noturno in legs | by its night, as the import does (code `NOT`; lacuna-2 2.1) |
| a mission asked for a later date | still suggested today (docs/PLAN.md:421 c, unchanged: only the open date is read) |
| the code lock of Cursos | `codigosDaDemanda` (js/views/cursos.js:56-68) becomes `codigosDosVoos`: the rebuilt requests that fly and `RES.out`; the text becomes "Este código está nos voos de amanhã (Maria e João): …". The gap of docs/PLAN.md:431 (a code only another date carries can be renamed) stays as recorded |

### 2.9 Why a pedido cannot be scheduled (Q7)

| Where it comes from | Reason | The screen shows | Opens |
|---|---|---|---|
| module, before the engine | `sem-aluno`; `aluno-inativo` (step 26) | "Aluno fora do cadastro" / "Aluno inativo no cadastro" | Alunos |
| | `fora` | "Tirado da escala pelo operador · Pôr de volta" | Escala |
| | `dispensado` | "Aprovado, fora da escala desde antes da mudança · Pôr na escala" | Escala |
| | `horario-fora-da-lista` | "08:20 não é horário de decolagem do PA-34" | "Restrições do voo › Horário"; the category's take-off times |
| | `curso-encerrado`, `sem-missao-do-curso`, `missao-mudou` | notes, not blocks (2.8) | "Restrições do voo › Missão" |
| | depends on a Ground of the same day (`doesGroundGateFlight`, js/rules.js:44-50) | "Depende do Ground C152 do mesmo dia" (a note; `ground-pendente` and `depois-do-ground` belong to the Escala) | — |
| `cabeSozinho`: the engine alone (R4) | one of the 21 codes, with the engine's text | "**Não cabe sozinho**: <texto do motor>" | the record the code points at (the INVA, the resource, the student's "Não escalar com", the restriction) |
| `rejeicoesPorVoo`, after the engine (R3) | the engine's rejection of the current schedule | "**Não coube na escala**: <texto do motor>" | "Encaixar…" (the booking dialog on that request) and "Restrições do voo" |
| the detail pane | each resource of the type and each INVA with what stops it, per possible start (`avioesQueServem`, `instrutoresQueServem`; texts `NOTA_DO_PROBLEMA`, js/instrutor-escolhido.js:38-41) | two lists, read-only | the cadastro record |

- `cabeSozinho` keeps yesterday's Noturno return (it is part of the date) and drops pins, statuses and every other request, the student's own too: it errs only towards "cabe" (lacuna-1-motivos §5). Computed once per rebuilt state, for the flights that fly.
- `rejeicoesPorVoo`: the flying requests whose key is not in `out`, sorted by the engine's queue key (Ground, chosen instructor in the cadastro, `pr`, "Priorizar com", `solicitacao`, student, position); the k-th `err` with a label goes to the k-th of them with that label. No field is added to the alerts.

### 2.10 The sixteen writers of mapa-demanda 5.6, and the other controls of Q8

| Site today | Becomes | Step |
|---|---|---|
| js/eventos/demanda.js:41 "Pôr um aluno" | G1: `criarVooProprio` with the blank request; G2: removed | G1, G2 |
| :94-99 `usarMissaoDoCurso` (Usar, Outra missão) | G1: `restringir(…, { etapa, cursoDaEtapa, mis, eq, nb, fora: null })`; G2: the same call from "Restrições do voo › Missão" | G1, G2 |
| :153-182 "+ missão", "✕" of an extra | G1: `criarVooProprio` / `removerVoo` (own) or `fora` (pedido); G2: removed | G1, G2 |
| :184-194 `rm-fly` | `restringir(…, { fora: true })`; revert `setFly` unchanged | G1 |
| :197-273 the field handler | G1: every branch calls `restringir` (`fly` → `fora`; `insId` → `escolherInstrutor`); a row with no flight first gets `criarVooProprio`; G2: moves to `js/eventos/restricoes.js` | G1, G2 |
| js/fixos.js:95-117 `limparDemanda` | `recomecarEscala(estado)` (decision 13) | G1 |
| js/rules.js:86-100 `deixarEmBranco`, `alvoDoNovoPedido`; :67-72 `proximoMid` | deleted; `alocarMid` | G1 |
| js/rules.js:142-179 `normalizeMissionFields` | unchanged; called by `pedidoDoVoo` | — |
| js/agenda.js:107-140 `importarSolicitacoes`, :86-93 `vooQueDaLugar` | `importarAprovados` (E), then `conciliar` inside `save()` (G1) | E, G1 |
| js/agendamento.js:899-943 `aplicarAgendamento` | 2.6 | G1 |
| js/instrutor-escolhido.js:107-108, 143-144, 169-170 (`insId` on the request) | `restringir(estado, stuId, mid, { insId })` in the three places | G1 |
| js/eventos/escala.js:177-186, 283-285 | unchanged (they call the functions above) | — |
| js/reversoes.js:165-191 `desfazerAgendamento` | 2.6 | G1 |
| js/eventos/historico.js:53-61 (`setFly`), :96-106 (`restaurarHorarios`) | `restringir(…, { fora: !val })`; the list comes back and the requests are rebuilt | G1 |
| js/eventos/recursos.js:203-211 (take-off times adjust `p1`, `p2`, `jan`) | removed. New entries carry `pedidos: []`. `impactoDosHorarios` (js/horarios.js:148, js/views/horarios.js:43) compares the requests rebuilt with the new list: "N pedidos da data aberta ficam sem horário na lista" | G1 |
| js/eventos/cadastros.js:123 (instructor deleted), :128 (student deleted), :84-90 (new student) | `insId` cleared in `restricoes`; the student's keys linger and are ignored, as `fixos` does today; nothing for a new student | G1 |
| js/storage.js:164-171, js/dias.js:59-62, 96-101, 121 | 2.14 | G1 |
| "Voa" (`data-f="fly"`) | derived (2.12) | G1 |
| "Importar da agenda" | removed in G1; the notice and "Atualizar" | G1 |

### 2.11 The nine History revert kinds

| Kind | After | Payload |
|---|---|---|
| `setFly` | `restringir(…, { fora: !val })` on the key and on each of `extras` | unchanged; entries of before stay valid |
| `restaurarEscolha` | `reverterEscolha` writes `insId` through `restringir` | unchanged |
| `restaurarFixos` | `reverterReparo`, the same | unchanged |
| `restaurarHorarios` | the list; `pedidos` is ignored for flights that are rebuilt | unchanged shape; `pedidos` empty in new entries |
| `desfazerAgendamento` | 2.6 | `restricoes` added; `pedido` still accepted |
| `setAv`, `setAtributo`, `setInsOn`, `readicionarRecurso` | other areas | unchanged here |

`validarReversao` (js/reversoes.js:43-117) loses no kind, so no entry of a past date loses its button. `agendamentosEmVolta` and `voaNaChave` (js/fixos.js:120-125) read the rebuilt requests; the three cases of docs/PLAN.md:435 stay as recorded, and the two texts that name the Demanda (js/reversoes.js:141-142) are reworded ("O pedido deste voo saiu da escala…", "… Mude as restrições do voo.").

### 2.12 Where each of the ten columns lives (Q10)

| Column | After | Kind | Reason |
|---|---|---|---|
| Aluno | the pedido's `aluno` | field of the pedido | the row exists for a student |
| — course code, "Próxima · Usar" | `voos[k].etapa`, bound at entry | derived once, stored in the binding | decision 4; "Usar" has nothing left to do |
| — "Outra missão…" | `restricoes[k].etapa` | operator restriction | it goes against the programme, with a confirmation |
| — "+ missão", "✕" of an extra | a second pedido; cancelling it | Pedidos | one pedido is one flight |
| — tag "agendado HH:MM · <recurso>" | the lock of the flight in the Escala; the group "Agendados na Escala (sem pedido)" in Processamento | display | |
| Voa | `fly`, rebuilt | derived: approved and not `fora` | off for this date = `fora` (restriction); off for good = withdraw or cancel, in Pedidos |
| Missão | the pedido's `missao` | field of the pedido | another type = restriction `mis` |
| Recurso (the type) | the programme's type for the bound mission (`voos[k].eq`), else `MIS[mis].defEq` | derived | another type = restriction `eq` |
| Instrutor | `restricoes[k].insId` | operator restriction | no other source (mapa-demanda 5.3) |
| 1ª preferência, 2ª preferência | the pedido's `horario`, `horario2` (D), against the type's take-off list at every load | field of the pedido, derived | moved = restriction `p1`, `p2` |
| Disponibilidade | the pedido's `disponibilidade` (D); absent, the exact time | field of the pedido | loosened = restriction `jan` |
| Duração | the pedido's `horas`; the fixed durations first | field of the pedido | another = restriction `nb` |
| Prioridade | `restricoes[k].pr` | operator restriction | no other source |

### 2.13 The cut-over and the interim (Q9)

| Case | What happens |
|---|---|
| D merged, E and G not yet | approval exists; the table and `dia.pedidos` are as today; "Importar da agenda" takes approved pedidos only (D); a pedido cancelled after the import stays until she turns it off (today's behaviour) |
| E merged | "Importar" calls `importarAprovados`: the stored requests are read as frozen flights (`voosDosPedidos`, in memory, for the allocation and the give-way), `conciliar` binds the approved pedidos not in `importadas`, and the request of each flight that entered (`pedidoDoVoo`) is written at its key in today's shape; the other requests are not touched, and `importadas` grows as today. Three things differ from today's import: the course mission by time, the closed course without it, and a request that is off but still carries a `solicitacao` keeps its key (today the next pedido overwrites it, js/rules.js:95-96) |
| G1 merged, first Operador opening | `atualizarFormatoGravado` (js/storage.js:385-397) rewrites every stored day through step 28, then the cadastro |
| stored days of past dates | frozen own flights: the same engine input and the same schedule (R1); nothing enters or leaves by itself; `resultado` is still shown as saved |
| stored days of future dates | the same; pedidos approved and not yet imported enter at the first save; a pedido she cancels now takes its frozen flight off (`retirados`) |
| the `importadas` lists | kept; an approved pedido whose id is there and that has no flight is not brought back (it was cleared by "Limpar demanda"); she can put it back with one click |
| hand-made requests already stored | frozen own flights without `sol`; editable through restrictions; they give way to a pedido of the same mission under today's conditions |
| tabs still open on the old version | read: they see the `pedidos` copy (old days) or an empty Demanda (new days); the first save is refused with PT409 `formato` and the screen asks for a reload (mapa-dados 5.3) |
| the legacy documents (`acpm3`) and every e2e seed | `converterLegado` (js/dias.js:154-169) keeps building the old `pedidos` (a private `pedidosDoLegado`), and `migrarDia` runs step 28 on it (js/storage.js:370): `abrir(page, { estado })` (test/e2e/fixtures.js:57-66) keeps working |
| local mode | the same code; `sol` holds the 13-digit local id as a value; no version check between two tabs (as today, mapa-dados C4) |
| two operators at once | 2.4 |
| the Secretaria | cannot cancel an approved pedido (posicao B3; D's migration); what she registers changes nothing until it is approved |
| G1 merged, G2 not yet | the table is the editor of restrictions: edits go through `restringir`, a tick on a student with no flight makes an own flight; no "Importar" |

### 2.14 Load and save

| Path | Change |
|---|---|
| `carregarDia` (js/storage.js:182-213) | reads the rows of the date (`this.agenda(data, data)`; a failure throws, decision 18); `estado = normalizeAndMigrateState(montarPedidos({ ...juntar(cadastro, base), solicitacoes }))`; returns `solicitacoes` |
| `juntar` (js/dias.js:78-112) | every student gets `{ ...blank(), extra: [] }`; `voos: normalizarVoos(dia.voos)`, `restricoes: normalizarRestricoes(dia.restricoes, voos)`, `pedidosDeAntes: dia.pedidos` when present |
| `separar` (js/dias.js:55-72) | writes `voos` and `restricoes`; writes `pedidos` only from `estado.pedidosDeAntes`; `CAMPOS_DO_PEDIDO` stays exported (the bookings' `criadoComo`) |
| `diaPadrao`, `diaParaCopiar` (js/dias.js:34, 118-123) | `voos: {}`, `restricoes: {}`, no `pedidos`; the test "is a whole day" becomes `anterior.ins && (anterior.pedidos \|\| anterior.voos)` |
| `save()` (js/actions.js:166-182) | `S.solicitacoes` = the last rows read for `DATA` (D's cache, `js/solicitacoes-da-data.js`), `conciliar(S, …)`, `montarPedidos(S)`, then the engine and `salvarDia`; returns the entries `gravarAlteracao` logs |
| `lerData` (js/actions.js:288-317) | after `setS`: `pendenciasDosPedidos` for the notice; nothing saved |
| a news from the cache (60 s, D) | only the notice changes; `S` is rebuilt at a save, never in the background |

### 2.15 Against a materialised design (`dia.pedidos` kept, written by a reconciliation)

| | Truly derived (this note) | Materialised |
|---|---|---|
| a pedido cancelled or un-approved | leaves at the next save, whatever happened in between; no stuck state | stays until an Operador with that date open reconciles |
| what a Gestor sees | the current pedidos, and that the saved schedule is behind | the stored requests, behind |
| what the operator imposed | explicit: listed, counted (`Object.keys(restricoes)`), cleared one by one or all | mixed into the request: a C172 is the programme's or hers only by deriving again |
| take-off list edited | every date follows at its next load; one writer and one revert payload less | the open date is adjusted, the others degrade |
| Mover and its undo | restrictions over an immutable base (R5 b) | work, as long as nothing re-derives the request |
| the day document | not self-contained: no schedule can be computed without the rows; one more required read; the PWA of Phase 16 gets harder | self-contained |
| writers outside the Demanda | booking, chosen instructor, Sugestões, five reverts, the cadastro's deletions: about ten sites and 45 unit tests change | untouched |
| stored days | two readers for good: frozen flights (before 28) and derived ones | one shape |
| control of the moment | a flight may enter or leave with an unrelated save (logged, and announced by the notice) | she clicks "Atualizar" |
| depends on | the row never changing after registration; a future "editar pedido" would have to withdraw the approval | nothing |
| size of the risky step | G1 carries storage and writers; mitigated by E's dry run and by keeping the table for one PR | G is smaller |

### 2.16 What the operator does, before and after

| Task | Today | After |
|---|---|---|
| put the date's pedidos in the day | Demanda › "Importar N pedidos da agenda": 1 click per batch | 0: "Registrar e aprovar" is the click she already gives |
| a pedido cancelled after the import | find the row, Voa off: 1, if she notices | 0 |
| the course mission of a pedido | set by the import; "Usar" on hand-made rows: 1 each | 0 |
| priority, instructor, type, duration, a looser time | 1 edit in the row | 2: open "Restrições do voo" on the flight, edit |
| take a flight off, put it back | 1; 1 | 1; 1 |
| a student with no pedido | type the name + Enter, then 0 to 5 edits | the Pedidos form (aluno, missão, horário; "Registrado por" is remembered) or "+ Agendar voo": about 4 fields |
| a second flight | "+ missão" + edits | a second pedido or a booking |
| restart the date | Mais › Limpar demanda › Confirmar, then import: 4 | Mais › Recomeçar a escala › Confirmar: 3 |
| news from another computer | nothing tells her | a notice; applied by her next save or "Atualizar": 0 or 1 |

### 2.17 The Processamento screen (G2), read-only

- List (left): the date's items in groups "Precisam de atenção", "Na escala", "Aguardando aprovação", "Tirados da escala", "Agendados na Escala (sem pedido)", "Cancelados". Row: status dot; initials; name; second line "<missão> · <código> · <tipo> · <h>" with the time at the right; third line the state ("na escala 10:10 · PR-VOB · Instrutor 01", "não cabe sozinho: …", "entra na próxima atualização"). Search by name (`chaveDeBusca`), filters by state and course (the multi-value component). No switch on the rows.
- Detail (middle): sections "Pedido" (what was asked, observação, registrado por, exceção, aprovado por), "Curso" (2.8), "Preferências do aluno" (Priorizar com, Não escalar com), "Exigências da missão" (`exigencias`, the type, its take-off times), "Recursos" and "INVAs" (2.9), "Restrições do operador" (read-only, with "Editar na Escala"), "Por que não entra". The Gestor sees the same; the Secretaria does not see the stage, as today (css/app.css:184-188).
- Item of `enriquecerPedidos`: `{ id, fKey, aluno, situacao: 'aguardando'|'aprovado'|'cancelado'|'sem-pedido', pedido, linha, naEscala (the row of out, or null), pendente: 'entra'|'sai'|null, missao: { vinculada, agora }, restricoes, notas[], sozinho, naEscalaNaoCoube }`.
- Counts for the pipeline (`resumoDoProcessamento`): aprovados, com missão do programa, sem missão, não cabem sozinhos, não couberam, tirados, com restrições, agendados sem pedido, pendentes de atualizar.

## 3. Where each existing control goes (a table: control today (label, id or data attribute) | destination (stage, screen, pane) | kept, moved, replaced by or removed)

Only the Demanda screen (`#s-dem`) and the controls elsewhere that write requests. The Escala, Pedidos and cadastro screens belong to other notes.

| Control today | Destination | |
|---|---|---|
| tab "Demanda", `button[data-t="dem"]` | pipeline card "Processamento" | replaced (F1 opens the table; G2 the new screen) |
| "Importar da agenda", `#importar-agenda`; "Importar N pedido(s) para a demanda", `#agenda-importar` | nowhere: approved pedidos enter by themselves; "Atualizar", `#atualizar-pedidos`, in the notice | removed (G1) |
| "+ Pôr um aluno na demanda…", `#incluir-aluno`, `#alunos-fora` | Pedidos › "Registrar e aprovar"; Escala › "+ Agendar voo" | removed (G2) |
| "Só quem voa", `#onlyfly` | Processamento › state filter (default: every group but "Cancelados") | replaced (G2) |
| "Buscar na demanda…", `#flt-dem` | Processamento › list search | moved (G2) |
| "Todos os cursos", `#flt-dem-cur` | Processamento › course filter | moved (G2) |
| "Todas as missões", `#flt-dem-mis` | Processamento › mission filter | moved (G2) |
| "Mais", `#btn-mais-dem`; "Limpar demanda", `#clr` | Escala › "Mais" › "Recomeçar a escala", `#recomecar` | replaced (G1: same menu; G2: moves) |
| count `#cnt` | Processamento › group headers; pipeline card | replaced (G2) |
| column "?" buttons, `data-dica="voa\|instrutor-escolhido\|preferencias\|disponibilidade\|duracao\|prioridade"` | the labels of "Restrições do voo"; `voa` is rewritten as "na escala" | moved (G2) |
| the row `tr[data-k="d"]`, the name, the course code `span.etapa` | Processamento list row and detail | replaced (G2) |
| "Próxima: <rótulo> · Usar", `data-act="usar-proxima"` | nothing to click: bound at entry; "o programa agora diz…" in the detail | removed (G2) |
| "Outra missão…", `select[data-f="outra-missao"]`; `data-act="usar-fora-da-ordem"` | Escala › "Restrições do voo › Missão" | moved (G2) |
| tag "agendado HH:MM · <recurso>", `data-dica="voo-agendado"` | Processamento › group "Agendados na Escala (sem pedido)" and the state line | moved (G2) |
| "+ missão", `data-act="add-mis"`; "✕" of an extra, `data-act="del-mis"` | Pedidos (a second pedido; cancelling it) | removed (G2) |
| Voa, `input[data-f="fly"]` | off: Escala › "✕" (`rm-fly`); on: "Pôr de volta", `data-act="por-de-volta"` | replaced (G2) |
| Missão, `select[data-f="mis"]`; Recurso, `[data-f="eq"]`; Duração, `[data-f="nb"]` | Escala › "Restrições do voo" | moved (G2) |
| Instrutor, `select[data-f="insId"]` | Escala › "Restrições do voo › Instrutor" | moved (G2) |
| 1ª preferência, 2ª preferência, Disponibilidade, `[data-f="p1\|p2\|jan"]` | Escala › "Restrições do voo › Horário"; for new pedidos, the Pedidos form (D) | moved (G2) |
| Prioridade, `select[data-f="pr"]` | Escala › "Restrições do voo › Prioridade" | moved (G2) |
| "Nenhum aluno com esses filtros." + "Limpar filtros", `#limpar-filtros-dem` | Processamento › empty state of the list | replaced (G2) |
| "Nenhum aluno cadastrado…", `tr.empty-dem` | Processamento › empty state: "Nenhum pedido para esta data." | replaced (G2) |
| "Abrir a Demanda", `button[data-go="dem"]` in Alunos | "Ver os pedidos desta data", to Processamento | replaced (G2; A if it lands first) |
| "✕" Tirar da escala, "✕ Excluir da escala", `data-act="rm-fly"` | the same places in the Escala | kept; writes `fora` (G1) |
| the box "N missões não entraram na escala: <nomes>" | the same box; each name opens "Restrições do voo", with "Encaixar…" | kept, extended (G2) |
| "↶ Reverter", "↶ Restaurar", "✕ Excluir", "↶ Desfazer", `data-act="rev-log"` | the Histórico | kept |

## 4. Data-format steps and migrations (the number or the migration file name, what changes, the conversion, its tests, the deploy order)

| Item | Content |
|---|---|
| **Format 28**, in G1 (`js/migracoes.js`: `ESQUEMA = 28`, `PASSOS[28]`) | `cadastro`: identity. `dia`: when the document has `pedidos` and no `voos`, `{ ...dia, ...voosDosPedidos(dia) }`; `pedidos`, `importadas` and every unknown field stay |
| the conversion, `voosDosPedidos(dia)` | leftovers = the keys of `fixos`, `fStatus`, `fObs` and `resultado.out[].fKey`. For the main request of each student id (`mid` 0) and each extra (an extra without a valid `mid` gets 1 + the largest of the student, as the load does today, js/storage.js:168): skipped when it does not fly, has no `solicitacao` and its key has no leftovers; otherwise `voos[k] = { sol?, proprio: { mis, eq, nb, p1, p2, jan? }, etapa?, cursoDaEtapa? }` and `restricoes[k] = { pr (when not 3), insId?, fora (when it does not fly) }`. A second request with the same `solicitacao` loses the link. Types are checked before any conversion; `{ importado: true }`, `{ simulado: true }`, `null` and `{}` pass untouched |
| tests of the step (written first) | test/unit/migracoes.test.js: a day at 27 with a flying main request, an extra, a request off with a pin, a blank one, a duplicated `solicitacao`, a hostile value in each field; `pedidos` and an unknown field survive; `ESQUEMA >= 28`. test/unit/restricoes.test.js: R1 as a property (903 states: same engine-read requests, same schedule) |
| what the number protects | a tab on format 27 would write `pedidos` from a state it cannot rebuild and drop the two maps; the server refuses it |
| deploy order | client only. The PR's preview deployment first: the first Operador opening there rewrites the preview's days (the preview database is shared, so G1 goes after A to E are merged); then the merge; production is rewritten at the first Operador or Administrador opening, one read and one `salvar_dia` per stored day, in series. No way back by reverting the PR once a day is at 28 (the server refuses older formats); the `pedidos` copy is what a forward fix would read |
| SQL migrations | none in this topic. No SQL reads `pedidos`, `voos` or `restricoes` (mapa-demanda §1) |
| asked of D's migration (`20261124100000_aprovacao_dos_pedidos.sql` in desenho-pedidos) | (1) the Secretaria cannot cancel an approved pedido (posicao B3); (2) `cancelar_solicitacao` and `retirar_aprovacao_da_solicitacao` refuse a pedido whose `data` is before today in São Paulo: with live membership a past schedule would change at its next save (question 9); (3) the row's own fields never change after registration |
| the History read | `conciliar` writes one entry per pedido, as the import does; the read of a date takes the newest 200 (js/backends/supabase.js:172), which `agendamentosEmVolta` scans. G1 raises it to 500 there and in the fake server (lacuna-2 C.7) |
| format 29 (H) | unaffected |

## 5. Files created, changed and deleted, by step (the step names are F0, F1, F2, F3, A, B, C, D, E, G, H, I as in posicao.md and the request)

| Step | Created | Changed | Deleted |
|---|---|---|---|
| F0 | — | the redraw registry removes `rDem` from js/eventos/registro.js:7, 43, js/actions.js:107, 140, 324 and js/eventos/historico.js (needed so G2 can delete the view) | — |
| F1, F2, F3, A, B, C | not applicable | A, F-step 26: `inativo` is read by `pedidoDoVoo` in G1 (reason `aluno-inativo`). C: "Marcar disponível" and the `disponibilidade` of `desfazerAgendamento` follow the ranges (C's note) | — |
| D | (D's note) | the import filter takes approved pedidos (js/eventos/agenda.js:48); the three rules of section 4 | — |
| **E** | js/processamento.js; js/restricoes.js (`voosDosPedidos`, `alocarMid`); test/unit/processamento.test.js; test/unit/restricoes.test.js | js/eventos/agenda.js (`importarDaAgenda`: `importarAprovados`, the toast); js/agendamento.js:234-237, 1031-1034 (`rejeicoesPorVoo`); js/views/etapas.js:36-45 (`proximaDoPedido` delegates); test/unit/agenda.test.js (the 21 import tests move to processamento.test.js, rows with `aprovada_em`); test/unit/engine.rules.test.js (+3: `depois-do-ground`, `instrutores-ocupados`, `aluno-ocupado`, which only the goldens hold today) | js/agenda.js: `importarSolicitacoes`, `vooQueDaLugar` |
| **G1** (format 28) | test/unit/conciliar.test.js | js/migracoes.js; js/dias.js; js/storage.js; js/actions.js; js/restricoes.js (normalisers, `criarVooProprio`, `restringir`, `removerVoo`, `restricoesPara`); js/processamento.js (`pendenciasDosPedidos`); js/fixos.js (`recomecarEscala`); js/agendamento.js (`aplicarAgendamento`, `simularAgendamento`, `reversaoDoAgendamento`); js/instrutor-escolhido.js; js/reversoes.js; js/eventos/historico.js; js/eventos/demanda.js; js/views/demanda.js (rows from the rebuilt requests, origin tag, no import button); js/eventos/recursos.js, js/horarios.js, js/views/horarios.js; js/eventos/cadastros.js; the Pedidos handlers of D (call `gravarAlteracao` after the server call); js/views/cursos.js; js/backends/supabase.js:172 and test/e2e/supabase-falso.js; index.html (`#importar-agenda` out, `#clr` text, the notice); README "Formato dos dados"; Manual and glossary texts of the import | js/rules.js: `alvoDoNovoPedido`, `proximoMid`, `deixarEmBranco`; js/fixos.js: `limparDemanda`; js/processamento.js: `importarAprovados`; `#agenda-importar` |
| **G2** | js/views/processamento.js; js/eventos/processamento.js; js/views/restricoes.js; js/eventos/restricoes.js; the stage's stylesheet (F0's one file per screen); test/e2e/processamento.spec.js; test/e2e/restricoes.spec.js | js/processamento.js (`enriquecerPedidos`, `resumoDoProcessamento`); js/views/escala.js (the "Restrições" action on rows and popup, the box of rejected, the list of flights taken off); js/views/etapas.js; js/agendamento.js (the student groups' texts); index.html; js/glossario.js; the Manual; README "Estrutura" | js/views/demanda.js; js/eventos/demanda.js; `#s-dem` and its CSS; test/e2e/demanda.spec.js; in js/views/etapas.js: `etapaNaDemanda`, `outraMissaoNaDemanda`, `botaoForaDaOrdem` |
| H | — | the pipeline adapter reads `resumoDoProcessamento` and `Object.keys(S.restricoes)`; Aprovar's pending items include `pendenciasDosPedidos` | — |
| I | — | the sweep of texts that say "Demanda" in History templates and engine-facing messages (lacuna-1-textos) | nothing of this topic is left to delete; `pedidos` stays in old days |

## 6. Tests (what is written first; which existing tests change, with file names and rough counts)

Written first, E:

| File | Suites (about 45 tests) |
|---|---|
| test/unit/processamento.test.js | the 21 import tests, moved ("Os pedidos aprovados entram na demanda"), plus: only approved rows enter; `missaoDoCursoPara` (the three AV PROF. and SOLO runs of lacuna-2 2.4 in both orders of registration; the closed course; no match; the night of a Noturno in legs; another date does not count); `pedidoDoVoo` field by field, one case per restriction; R2 as a property; `cabeSozinho` equals the engine alone for the seven exact codes and never says "não cabe" for a request the full day places (300 scenarios); `rejeicoesPorVoo`: two extras of one mission with different reasons; two students with one name; the multiset of codes equals the engine's; and the queue order, checked against the sequence of `err` labels of a day where nothing can fly (no instructor comes) |
| test/unit/restricoes.test.js | `voosDosPedidos` (the cases of section 4); R1 flight by flight (`pedidoDoVoo` of each converted key equals the stored request, 903 states; G1 adds the whole state through `montarPedidos` and the engine); `alocarMid` (0 when clean; skips a key with a pin, a status, a detail or a result; never reuses a bound key; never above 999,999; never a pedido id) |

Written first, G1 (about 40 new): test/unit/conciliar.test.js (each row of 2.7: enters, gives way, leaves and releases, in progress stays, approved again on the same key with its restrictions, a frozen flight only through `retirados`, `importadas`, `semAluno`, `aVincular`; the History texts; the leaving flight logged once); test/unit/restricoes.test.js (the normalisers with a hostile value in every field; `restringir` per field, clearing, the release of a booked pin on `mis`, `eq`, `nb`; after any sequence of helpers the requests in `estado.stu` equal `montarPedidos` from scratch, 300 scenarios; `restricoesPara` inverts `pedidoDoVoo`).

Existing tests that change:

| File (tests in it) | Change | About |
|---|---|---|
| test/unit/agenda.test.js (31) | 21 move in E | 21 |
| test/unit/rules.test.js (21) | `proximoMid`, `alvoDoNovoPedido` → `alocarMid` | 5 |
| test/unit/dias.test.js (25) | the key lists (:28-32, :164); the round trip becomes `montarPedidos(juntar(separar(e)))`; "o dia não tem nomes nem pesos" covers the two maps; `diaParaCopiar` | 6 |
| test/unit/storage-dias.test.js (35) | the load reads the rows; a date does not open without them; a new date starts with no flight | 5 |
| test/unit/migracoes.test.js (21) | +6 for step 28; config-do-painel.test.js:127 pins `ESQUEMA` | 7 |
| test/unit/agendamento.test.js (62) | "Agendamento: o pedido e o voo fixo" (5), "os voos de hoje do aluno (mover e encaixar)" (10): what is written | 15 |
| test/unit/instrutor-escolhido.test.js (36) | "Instrutor escolhido nos dados" (6); the others build engine states and do not change | 6 |
| test/unit/reversoes.test.js (26) | "Desfazer um voo agendado na Escala" (13): the new payload, and the old one through `restricoesPara` | 13 |
| test/unit/fixos.test.js (69) | "Limpar demanda" (7) → "Recomeçar a escala" | 7 |
| test/unit/engine.*.test.js, the goldens | none (they feed the engine directly) | 0 |
| test/e2e, G1 | agenda.spec.js:152, 177, selos.spec.js:51, abertura.spec.js:78, agenda-compartilhado.spec.js:104 (import → enters when approved); demanda.spec.js:55, 89 ("Limpar demanda"); demanda.spec.js as a whole keeps passing on the new store: that is G1's check | 8 |
| test/e2e, G2 | demanda.spec.js (23) deleted, its behaviours re-homed in processamento.spec.js and restricoes.spec.js; cursos-no-dia.spec.js (9); the 33 lines that tick `data-f="fly"` and 28 that address `tr[data-mid="0"]`, in 11 spec files, become a seeded state or `comPedidoAprovado(page, …)` in test/e2e/fixtures.js; perfis.spec.js (the Gestor in the Demanda) | 60 |

Seeds: `abrir(page, { estado })` keeps working (2.13), so tests that only need flights in the day do not change.

## 7. Departures from Pedro's request (a table: what the request says | what this design does | why | what Pedro can choose instead)

| The request says | This design does | Why | Pedro can choose |
|---|---|---|---|
| Processamento has "no data of its own" | the stage has none; the day keeps, as data of the Escala stage, each pedido's binding (`mid`, the course mission it received) and the operator restrictions | pins, statuses, results and reverts hang on the key; fact A4 | the course mission recomputed at every load (it advances after its own result; decision 4) |
| "Input: the approved pedidos of the date" | also the bookings and the requests stored before the change, as own flights | a booking decides more than a pedido holds; past dates are records | every booking registers a pedido (a server path that relaxes three rules) |
| joined with "course progress (the next mission)" | joined once, when the pedido enters; afterwards shown beside what the programme says now | the same | — |
| "preferências aplicadas" as a Processamento sub-task | shown there; applied by the engine (`voaCom`, `bl`) | the engine is untouched | — |
| shows "why any of them cannot be scheduled" | two reasons with two names: "não cabe sozinho" (before the engine) and "não coube na escala" (after it) | most reasons depend on the other flights | one number, after the engine only |
| the Demanda's nine columns | ten: "Aluno" holds five controls (2.12) | index.html:326-335 | — |
| operator restrictions "exist: fixed flights, the chosen instructor, '+ Agendar voo'" | also the priority, the exclusion, another type, duration, course mission and time | they have no other source once the table is gone | fewer overrides: those change only through the pedido |
| workstreams E and G | E also wires the import; G is G1 (data) and G2 (screens) | decisions 16 and 17 | one G |
| "Data-format steps never delete fields" | kept: `pedidos` stays in old days as a copy, as `cursos` did | README.md:167 | drop the copy in a later step |
| "Decisions this reverses" lists three | a fourth: "Limpar demanda" (docs/PLAN.md:437) becomes "Recomeçar a escala"; and the import's order rule for course missions changes | 2.8, decision 13 | keep the registration order; drop the button |
| `gravarAlteracao` is the only way | kept; the conciliation runs inside it, so an approval made elsewhere reaches the day with her next change | decision 6 | only on "Atualizar" |

PLAN.md's open items, restated for this topic: :421 a stays (a booking creates no pedido); :421 c stays; :422 stays, moved into `restringir` (the clause about "Usar" is moot); :371 and :397 move to "Restrições do voo › Missão"; :424: the Demanda half moves with the control, the import half is closed (2.8); :425 holds on restrictions; :430 and :435 as recorded, texts reworded; :431 and :404: reader and text change, the gap stays; :437 a reversed, b moot.

## 8. Questions for Pedro, each with the default this design implements

| # | Question | Default |
|---|---|---|
| 1 | May an approved pedido enter, and a cancelled one leave, with the operator's next change of any kind, or only when she clicks "Atualizar"? | with the next change; the notice says so beforehand |
| 2 | Two flights of one student on a date: is the course mission given by time (the earlier flight first) or by the order of registration, as today? | by time |
| 3 | A student of a closed course: does the pedido enter without the course mission (she confirms it in the Escala), or with it? | without |
| 4 | "Limpar demanda": becomes "Recomeçar a escala" (pins, statuses and restrictions go, approved pedidos stay), or disappears? | becomes "Recomeçar a escala" |
| 5 | "Tirar da escala" keeps the place and the pedido approved; withdrawing the approval is another action, in Pedidos. Two actions, or one? | two |
| 6 | Are the restrictions edited in a panel of the Escala ("Restrições do voo"), or inside the Processamento detail? | in the Escala; Processamento has no input |
| 7 | May the operator give a pedido another mission type or course mission as a restriction, or only by cancelling and registering again? | as a restriction, with today's confirmations |
| 8 | A student with no pedido and no fixed time ("Pôr um aluno", "+ missão"): "Registrar e aprovar" or "+ Agendar voo", about four fields where one click was enough? | yes, both end |
| 9 | May a pedido of a past date be cancelled or lose its approval? | no: the server refuses; a no-show is the flight's status |
| 10 | A pedido that cannot fit alone: still sent to the engine (counted in "N missões pedidas", the PDF and the BI)? | yes |
| 11 | The `pedidos` copy in days stored before the change: kept for good? | kept |
| 12 | The hours: the pedido's when it enters; the programme's when she picks another course mission (today's two rules)? | as today |
| 13 | The Gestor reads Processamento as he reads the Demanda today? | yes |

## 9. Risks, and what would make this design wrong

| Risk | Mitigation |
|---|---|
| A writer changes a request in `S.stu` without the helpers: the next rebuild erases it | it shows at once (the change does not stick); the property test "requests equal a rebuild from scratch"; G1 keeps demanda.spec.js as the net |
| The rows of `solicitacoes` become necessary to open any date, past ones too | they come from the same server as the cadastro; frozen flights do not need their rows; the saved `resultado` needs none |
| A flight enters or leaves with an unrelated save | logged in the History beside it; announced by the notice; "Aprovar escala" reads the rows first |
| The bound course mission goes stale (a result registered late, the programme edited) | "o programa agora diz…" on the item and in the pipeline count; one edit fixes it |
| `rejeicoesPorVoo` mirrors the engine's sort and would drift if the sort changed | the test against the `err` sequence of a day where nothing can fly; R3 |
| `cabeSozinho` says "cabe" for a flight whose own Ground makes it impossible, and the one case with a pinned class outside the day windows | it only errs towards "cabe"; the Escala's rejection is the final word |
| Two readers for good (frozen and derived flights) | one branch in `pedidoDoVoo`; R1 as a permanent test |
| The History of a busy date passes the read limit sooner | 500 in G1 |
| Local mode, two tabs: bindings overwritten without conflict | as every other field today |
| G1 is the largest step of the redesign | E's dry run; the table kept for one PR; R1 and R2 already ran |

This design is wrong if: pedidos become editable after approval (the base stops being immutable; every edit would have to withdraw the approval); a date must open when `solicitacoes` cannot be read; Pedro wants each stored day to hold, by itself, everything the schedule was computed from; or the operator must decide the moment each approved pedido enters the day. In any of those cases the materialised design of 2.15 is the right one, and `montarPedidos`, `conciliar` and the two maps still serve as its reconciliation: only `separar` changes back.

<!-- fim -->
