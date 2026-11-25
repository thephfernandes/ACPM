# Lacuna: which rejection reasons can be decided before the engine, and how the engine picks the reason

Worktree read: `/Users/pedrofernandes/ACPM/.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to it; evidence is `path:line`.
"(measured)" = run with node, read-only, on the worktree's modules, or on a scratch copy outside the repo. The copy of `js/engine.js` only adds a debug field to each rejection (the request's ids, the branch and the counters); with that field dropped its output equals the worktree engine's on the 41 golden states. Only generated, fictitious states were used (`test/helpers/cenarios.js`, `test/helpers/montar.js`). "(inferred)" = not proven by a line I read or by a run. Nothing in the worktree was changed.

## Answer

### 1. What a rejection is

- Only a request in the queue can be rejected: the student's main request when `fly`, and each `extra` with `fly` (js/engine.js:291-303).
- A request with a pin (`state.fixos[chaveDoVoo(stuId, mid)]`) is skipped by the allocation loop (js/engine.js:356-359, 557). It is never rejected: what no longer holds becomes a conflict on its row, with the 19 conflict codes (js/engine.js:420-449, 533; js/conflitos.js:5-25). (measured) A pinned request whose chosen instructor has `on: false` stays in `out` with `conflitoCodigos: ['instrutor-indisponivel']` and no `err`.
- Every other request ends as exactly one row in `out` or exactly one alert `{ t: 'err', s, m: 'Rejeitado: <motivo>.', codigo }`. The five places that write it: js/engine.js:581, 765, 787-792, 800-805, 964. One alert carries one reason, also when several hold. Pinned by test/unit/engine.invariants.test.js:59 ('toda rejeição tem um código da lista') and :63 ('toda missão marcada é alocada ou recebe um alerta de rejeição').
- The alert has no `stuId`, `mid` or `fKey`. `s` is `stu.nm`, or `` `${nm} (${d.mis})` `` for an extra (js/engine.js:561).
- Readers of rejections: the red box "N missões não entraram na escala: <nomes>" (js/views/escala.js:454, 458, 466-469); `#selo-esc` (js/views/selos.js:22); the PDF (js/export.js:45, 54, 87); the CSV (js/csv.js:63); the BI's `rej` (js/actions.js:358; js/dias.js:178); the booking dialog (js/agendamento.js:235, 1032); the saved-schedule validator (js/escala-gravada.js:85-90: an `err` whose code is outside `CODIGOS_DE_REJEICAO` discards the whole saved schedule); scripts/medir-escalas.mjs:48.
- Readers of the code (not the text): only `FORA_DA_ESCALA` (js/agendamento.js:223-237) and the validator. docs/PLAN.md:283 says the codes were made "for PR 8's "Ir para…" hints"; grep finds no "Ir para" in `js/` or `index.html`.
- The one place that pairs a rejection with its request does it by the label text and takes the first match: `motivoDeFora` (js/agendamento.js:234-237); `motivoDaSaida` does the same with the text `m` (js/agendamento.js:1031-1034). The list of requests left out needs no text: the flying requests whose `chaveDoVoo(stu.id, mid)` is not in `out` (js/agendamento.js:344, 362, 382-383).

### 2. The order in which the reason is decided, for one request without a pin

The queue is sorted first (js/engine.js:333-338): Ground missions; then requests with a chosen instructor who is in the cadastro; then `pr` 5 to 1; then students with "Priorizar com"; then the pedido id (`solicitacao`); then the student's position; then the mission's position. The return legs of yesterday's Noturno and all pins are placed before the queue (js/engine.js:370-393, 406-534).

**Both branches, before anything else**
1. `instrutor-escolhido` (js/engine.js:573-583): the request has `insId`, that instructor is in `state.ins`, and he has `on` false, or fails `podeFazer(escolhido, d.mis, tipoDoPedido, { curso: stu.curso })`, or is in `stu.bl`. Three texts: "o instrutor escolhido (<nome>) não está disponível nesta data" / "… não tem a habilitação de <mis>[ no <eq>] (<exigências>)" / "… está em “Não escalar com” deste aluno". A chosen instructor who left the cadastro is not a rejection: the request goes back to automatic, with the warning `escolhido-saiu` (js/engine.js:573, 990-995). (measured) It wins over a wrong equipment on the same request.

**Ground branch** (js/engine.js:597-768). The search runs first (join an open class, else open one: 623-704). Only when it fails, the first true test gives the reason (743-766):
2. `sem-instrutor-habilitado` (746-747): no `x.on && podeFazer(x, d.mis, GROUND_EQ_TYPE)` in all of `state.ins`.
3. `ground-antes-do-voo-fixo` (748-749): there are open starts, but none ends by `prazoFixo`, the earliest start among the student's pinned, non-cancelled flights that this Ground gates (606-607, 615).
4. `disponibilidade-do-aluno` when the request has `jan`, else `sem-horario` (750-753): `starts` is empty; `starts` = the 8 day windows `DAY` that are open in `state.win`, end by `endMax` and pass `jan` (601).
5. Otherwise the counters `fcGnd` (755-763; section 3).

**Flight and simulator branch** (js/engine.js:773-966). Two tests run before the search:
6. `equipamento-da-missao` (786-794): `!m.eq.includes(d.eq)`.
7. `ground-pendente` (797-806): one of the student's Grounds of the day that gate this flight has `allocatedEnd === null`.

Then the search (830-878). Only when it fails, the first true test gives the reason (926-965):

8. `so-parafuso` (929-932): Parafuso on the C152 and no "Só Parafuso" C152 with `state.av[r]`. Two texts: "o <REG> (só para Parafuso no C152) está em manutenção" / "não há na frota um C152 marcado como “Só Parafuso” (aba Recursos)".
9. `sem-aviao`, IFR text (933-934): an available aircraft of the type is "Só VFR" for this flight and no aircraft of `fleetPool` is available.
10. `sem-aviao` (935-936): `!fleetPool.some(r => state.av[r])`, with `fleetPool = matriculasParaOVoo(frota, vooDoPedido)` (823-824).
11. `sem-instrutor-habilitado` (937-938): no `x.on && podeFazer(x, d.mis, d.eq, { curso: stu.curso })` in all of `state.ins`.
12. `disponibilidade-do-aluno` (939-940): `inicios` is empty and the request has `jan`.
13. `depois-do-ground` when `minStartAfterGround > 0`, else `sem-horario` (941-944): `inicios` is empty and the request has no `jan`.
14. Otherwise the counters `fc` (945-963; section 3).

`inicios` (811-819) = the take-off list of the mission and type (`horariosDaMissao`: the category's list from `state.horarios`; the Noturno only 17:30; the Voo Solo only 06:30), kept when the period is open in `state.win`, the minute passes `jan`, `m >= minStartAfterGround` (the latest end of the student's placed gating Grounds, 808) and `m + dur <= endMax`. `endMax = fimDoAluno(...)` is 17:30 for a day flight in an aircraft, and also for the simulator and the Ground of a student who has a Noturno with `fly` in the day (js/horarios.js:43-50).

Facts about this order:
- It is a priority list, not a count. (measured) With no PA-34 available and no instructor with the multimotor habilitação, the only reason is `sem-aviao`; the second cause shows after the first is fixed.
- Tests 2 and 11 never look at `aw`, at "Não escalar com", at weights, at the aircraft's own habilitação or at the chosen instructor: they use all of `state.ins` and only `on` and `hab`. Tests 8 to 10 look only at `av` and at the aircraft's attributes, not at the balance to the inspection or at who may fly the aircraft.
- Test 10's text says "(todos em manutenção)" also when the fleet has no resource of the type, and when the only available C152 is the "Só Parafuso" one (measured, both).
- Tests 12 and 13 can hide the real cause. (measured) A flight with `jan: 'manha'` whose Ground could only be placed in the afternoon is rejected "nenhum horário aberto na disponibilidade do aluno (Manhã) comporta 1 h"; alone, the same flight is placed at 08:20. (measured) A flight with no possible start at all (C152 list `[960]`, 2 h) gets `depois-do-ground` when the student has a Ground placed, and `sem-horario` without the Ground.
- `ground-pendente` also fires when the gating Ground is pinned and `Cancelado`: `allocatedEnd` is set only inside `if (status !== 'Cancelado')` (js/engine.js:426, 512-513). (measured) The text says the Ground "não entrou na escala" while its row is in `out`, cancelled.

### 3. How the reason is picked when no fixed test applies

Four layers; the text is what survives them.

**Layer 1, per start time: only the first obstacle is counted.** For each possible start the checks run in a fixed order and the first that fails adds 1 to its counter and ends that start (`continue`).

| Order | Flights: key of `fc` (js/engine.js:835) | Check | Ground: key of `fcGnd` (js/engine.js:653) | Check |
|---|---|---|---|---|
| 1 | `locais` | 6 local flights already leave at that minute; only for Voo Local, Voo Solo and TGL (839) | `stu_busy` | the student has another flight (663) |
| 2 | `stu_busy` | the student has another flight (840) | `sala` | the one room is taken (672); a class of the same window is joined before this check (665-669) |
| 3 | `eq` | no aircraft of `fleetPool` is available and free (842-843) | `disp`, `busy`, `bloq`, `limite` | the instructors (674-676) |
| 4 | `revisao` | none of the free ones has balance to the 50 h inspection (844-845) | | |
| 5 | `disp`, `busy`, `bloq`, `limite`, `peso` | the instructors (848-850) | | |
| 6 | `aviaoProprio` | no instructor who serves may fly one of those aircraft (852-853) | | |

So each start adds exactly one count, and the counts add up to the number of starts tried (`inicios.length`; `candidateWins.length` for the Ground). (measured) True in all 1,540 count-picked rejections of 600 generated days; 537 of them had a single possible start.

**Layer 2, per instructor: only his first failing rule.** `problemasDoInstrutor` without `todos` stops at the first of: `instrutor-indisponivel` (`x.on && cobre(x.aw, a, b)`), `habilitacao`, `instrutor-ocupado`, `bloqueio`, `limite-da-lei`, `peso` (js/viabilidade.js:53-69).

**Layer 3, per pool: the rule that stopped the instructor who got furthest.** The engine's private `instrutoresQueServem` (js/engine.js:24-37) maps each instructor's first problem to a stage (`'instrutor-indisponivel': 0, habilitacao: 0, 'instrutor-ocupado': 1, bloqueio: 2, 'limite-da-lei': 3, peso: 4`) and returns the highest stage as `barrou`: `'disp'`, `'busy'`, `'bloq'`, `'limite'` or `'peso'`. `disp` therefore covers both "not available" and "not qualified".

**Layer 4, across the starts: the highest count wins.** `Object.keys(fc).sort((a, b) => fc[b] - fc[a])[0]` (js/engine.js:946; `fcGnd` at 755). The sort is stable, so a tie goes to the key declared first: `locais, stu_busy, eq, revisao, disp, busy, bloq, limite, peso, aviaoProprio` for flights and `stu_busy, sala, disp, busy, bloq, limite` for the Ground. (measured, goldens) `{ busy: 7, limite: 3, aviaoProprio: 7 }` gave `instrutores-ocupados`; `{ stu_busy: 3, limite: 3 }` gave `aluno-ocupado`; `{ disp: 2, busy: 2 }` gave `instrutores-indisponiveis`.

**Which counters are used.** The counters are reset for each pass and each fuel attempt, and the rejection reads the last ones.
- Passes (js/engine.js:586-589): with a chosen instructor, one pass with only him; with "Priorizar com", a pass with those instructors and then a pass with everyone; otherwise one pass with everyone. The rejection uses the last pass. The counts of the "Priorizar com" pass are kept only for the warning `voa-com` (`fcDoPar`: 703, 877; `motivoSemPar`, 241-253, which picks the most counted of `disp, busy, bloq, limite, peso, aviaoProprio` the same way).
- Fuel (js/engine.js:834-836, 874): the first attempt allows only a full tank; a second attempt, with less fuel, runs only when the first counted some `peso`. The rejection uses the last attempt, so `peso` there means "not even with the minimum fuel".

**The key decides the code; the mission, the fleet and a chosen instructor change the text.**

| Key | Code | Text (js/engine.js) |
|---|---|---|
| `stu_busy` | `aluno-ocupado` | "o aluno já tem outra missão nos horários possíveis" (757, 948) |
| `sala` | `sala-ocupada` | "a sala de Ground já está ocupada por outra turma nos horários possíveis" (758) |
| `eq` | `avioes-ocupados` | three texts by mission and fleet (949-953): the "Só Parafuso" one; "nenhum <eq> homologado IFR livre…"; "nenhum <eq> livre nos horários possíveis (ocupados por pedidos de prioridade maior)" |
| `revisao` | `revisao` | "os <eq> livres estão sem saldo até a revisão de 50 horas" (954) |
| `disp` | `instrutores-indisponiveis` | "nenhum instrutor habilitado (<exigências>) está disponível durante o voo inteiro nos horários possíveis" (955); Ground: "… durante as 01h30 …" (759) |
| `busy` | `instrutores-ocupados` | "os instrutores habilitados (<exigências>) já têm outro compromisso nos horários possíveis" (956; 760) |
| `bloq` | `bloqueio` | "os instrutores habilitados (<exigências>) e livres estão em “Não escalar com” deste aluno" (957; 761) |
| `limite` | `limite-da-lei` | "nenhum instrutor dentro dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis" (958; 762); it never says which limit |
| `locais` | `limite-de-locais` | "já há 6 voos locais (Voo Local, Voo Solo e TGL) em todos os horários possíveis, o máximo no mesmo horário" (959) |
| `peso` | `peso` | "peso aluno + instrutor acima do limite de <lim> kg do <eq>, mesmo com o mínimo de combustível" (960) |
| `aviaoProprio` | `habilitacao-do-aviao` | "os <eq> livres exigem a habilitação própria deles, e nenhum instrutor livre a tem (marque em Instrutores › Cadastro)" (961) |

The Ground texts of `disp`, `busy` and `bloq` have no "(<exigências>)" (js/engine.js:759-761). With a chosen instructor the texts of `disp`, `busy`, `limite`, `peso` and `aviaoProprio` name him, "o instrutor escolhido (<nome>)…" (js/engine.js:759, 760, 762, 955, 956, 958, 960, 961); the code is the same. (measured) A chosen instructor who comes but is available only in the afternoon, for a morning request, gives `instrutores-indisponiveis`, not `instrutor-escolhido` (also test/unit/instrutor-escolhido.test.js:66).

**What follows from the four layers** (each measured on the real engine with small fictitious days):
- "nos horários possíveis" reads as "at every possible time"; the code guarantees only "at more start times than any other obstacle". Two open starts, the student busy at one and the only instructor busy at the other: `aluno-ocupado`, by the tie rule.
- The text can name an obstacle that is not the cause. A student whose only qualified instructor is in his "Não escalar com", while that instructor flies with someone else at the only possible start: `instrutores-ocupados` ("já têm outro compromisso"). Freeing the instructor does not help; the request can never fit.
- The same static cause gets three codes. Every qualified instructor in "Não escalar com": `bloqueio` when they are available and free, `instrutores-indisponiveis` when their `aw` covers no start, `instrutores-ocupados` when they are busy.
- An earlier check hides a later one. Two requests of one student at the same exact minute, the second needing an instructor who is not available then: `aluno-ocupado`; alone, that request is rejected `instrutores-indisponiveis`.
- "(ocupados por pedidos de prioridade maior)" is not checked. One C152, a priority 5 request without a chosen instructor and a priority 1 request with one, same minute: the priority 1 flies (chosen instructors go first in the queue, js/engine.js:337) and the priority 5 is told the aircraft is taken by higher-priority requests. The occupant can also be a pin or yesterday's Noturno return.

### 4. The 21 codes

"Alone" = for this one request, from the cadastro and the day, with no other request placed. Where the data lives: `ins[].on` and `aw`, `av`, `horas`, `win`, `fixos`, `fStatus` and the request fields are per date; `ins[].hab` and `kg`, `stu[].bl`, `curso` and `kg`, `frota`, `horarios`, `limites` are in the cadastro; `horasDosInstrutores` and `noturnosDaVespera` are computed when the date is read (mapa-motor, section 2).

**4.1 Decided by a fixed test (the numbers are section 2's)**

| Code | Test | Reads | Alone? | Existing pure function |
|---|---|---|---|---|
| `instrutor-escolhido` | 1 | request `insId`, `mis`, `eq`; `ins[].on`; `ins[].hab`; `stu.bl`; `stu.curso` | **Yes, exact** | `impedimentoDoPedido(x, aluno, pedido)` (js/instrutor-escolhido.js:21-26, private): the same three tests in the same order, with the short texts 'fora nesta data', 'sem a habilitação', 'em Não escalar com'. Exported through `instrutoresDoPedido` (:30-35), which the Demanda's Instrutor select already shows as "Nome (fora nesta data)" (js/views/demanda.js:35-36) |
| `equipamento-da-missao` | 6 | request `mis`, `eq`; constant `MIS` (js/config.js:51-73) | **Yes, exact**, and the app cannot produce it: every date read runs `normalizeMissionFields`, which puts `eq` back inside `MIS[mis].eq` (js/rules.js:167-168; js/storage.js:164-170, 191); the Demanda's Recurso select lists only `m.eq` (js/views/demanda.js:20-23, 75); the import, the booking and the reversals normalise too (js/agenda.js:78; js/agendamento.js:918; js/reversoes.js:34, 178). It exists in the goldens because the generator makes about 5% of the flight requests incompatible on purpose (test/helpers/cenarios.js:58-59) | no exported predicate; the same test is written inline at js/engine.js:786, js/rules.js:168, js/eventos/demanda.js:252, js/agenda.js:66 and js/agendamento.js:291, 464, 713 |
| `so-parafuso` | 8 | `mis`, `eq`; `frota[].soParafuso`; `av` | **Yes, exact** | `matriculasDoTipo(frota, 'C152', { parafuso: true })` (js/frota.js:74-76); `motivoDoAviao` (js/frota.js:42-47) |
| `sem-aviao` | 9, 10 | `mis`, `eq`, `stu.curso` (the PC Noturno is IFR); `frota[].soVfr`, `soParafuso`, `tipo`; `av` | **Yes, exact** | `matriculasParaOVoo(frota, voo)` (js/frota.js:57); `motivoDoAviao` |
| `sem-instrutor-habilitado` | 2, 11 | `ins[].on`; `ins[].hab`; mission, type, `stu.curso` | **Yes, exact**. "ativo" in the text is `on` ("Vem" on the date) | `podeFazer(instrutor, mis, eq, contexto)` (js/habilitacoes.js:100-103). `impedimentoDoPedido` tells the three cases apart per instructor, but the exported `instrutoresDoPedido` drops the unqualified and the blocked from its list (js/instrutor-escolhido.js:31-32), so its result cannot tell "nobody qualified" from "everybody in Não escalar com" |
| `sem-horario` | 4, 13 | `win`; `horarios`; mission, type, duration; whether the student has a Noturno in the day | **Yes, exact** | pieces only: `horariosDaMissao`, `periodoDoMinuto`, `fimDasMissoesDoDia` (js/horarios.js:47-59); `duracaoFixaDaMissao`, `duracaoValida` (js/rules.js:79-80, 124-128); `horariosDoAgendamento(estado, { mis, tipo })` gives the list in open windows, without `jan` and the duration (js/agendamento.js:105-108) |
| `disponibilidade-do-aluno` | 4, 12 | the same plus `jan`; for flights, the end of the student's placed Ground | **Yes when the student has no gating Ground that day**; otherwise it depends on where the Ground landed | the same pieces plus `disponibilidadeDoAluno(jan)` (js/rules.js:19-27) |
| `ground-antes-do-voo-fixo` | 3 | the same student's pins (`fixos`, `fStatus`); `win`; `jan` | **Only with the pins**; no other request is needed | none; the mirror rule for moving a pinned Ground is in js/reparo.js:80-83 |
| `ground-pendente` | 7 | whether the student's own Ground of the day was placed | **No.** Known beforehand only when that Ground is itself certainly rejected, or is pinned and cancelled | `doesGroundGateFlight(gMis, flightReq)` says which Ground gates which flight (js/rules.js:44-50) |
| `depois-do-ground` | 13 | where the student's own Ground was placed | **No** | none |

The possible starts of a request ("`inicios`") are computed inline three times, with the same filters: js/engine.js:601 and 811-819, js/compactar.js:107-112, js/reparo.js:75-89. No shared function returns them.

**4.2 Decided by the counters (section 3)**

| Code | Key | What the counted check reads | Alone? | Existing pure function |
|---|---|---|---|---|
| `instrutores-indisponiveis` | `disp` | `on`, `aw` over the whole flight (`cobre`), `hab`, `stu.curso`: nothing from the schedule | **A static form exists**: no instructor is on, qualified and covering any possible start. Then the request can never fit; the engine prints this code only if `disp` has the highest count | `problemasDoInstrutor` (js/viabilidade.js:38-71); `cobre` (:17); `instrutoresQueServem(estado, ocupacao, …)` of js/candidatos.js:105-119 (all problems of every instructor, for one time) |
| `bloqueio` | `bloq` | `stu.bl` | **A static form exists**: every instructor that is on and qualified is in `stu.bl` | `impedimentoDoPedido` ('em Não escalar com'); `problemasDoInstrutor` |
| `peso` | `peso` | `stu.kg`, `ins[].kg`, the type's `DEFAULT_LIM`, duration, mission | **A static form exists**: with every instructor who could take it, not even the minimum fuel fits. Checked only when both weights are informed (js/viabilidade.js:42-47) | `pesoECombustivel`, `reducaoNecessaria` (js/combustivel.js:10-26); the candidates list gives `reducao` per instructor, `Infinity` when nothing fits (js/candidatos.js:116) |
| `habilitacao-do-aviao` | `aviaoProprio` | `frota[].habilitacaoPropria`, `ins[].hab` (`aviao:<matrícula>`), `av` | **A static form exists**: every available aircraft that serves requires its own habilitação and no instructor who could take the flight has it | `exigenciasDoAviao`, `instrutorVoaNoAviao` (js/frota.js:52-54); `avioesQueServem(…, { instrutor })` returns `{ codigo: 'habilitacao', motivo: 'aviao:<reg>' }` (js/candidatos.js:74-78, 86-96) |
| `revisao` | `revisao` | `horas[reg]`, the hours given to the aircraft so far today, duration | **A static form exists**: no available aircraft that serves has `50 - horas[reg]` for the flight's own duration. Beyond that it depends on what the others flew | `saldoAteARevisao`, `cabeNoSaldo` (js/viabilidade.js:20-23); `problemaDoRecurso` returns `{ codigo: 'revisao' }` (js/candidatos.js:56-63) |
| `limite-da-lei` | `limite` | `limites`; `horasDosInstrutores` (month, semester, year, yesterday's end); the instructor's commitments of the day | **A static form exists for the history part**: month, semester or year already at the limit, or the rest since yesterday against the start (`dentroDosLimites` with `compromissos: []`). (measured) The only instructor with 100 h in the month, or one who ended yesterday at 21:30 for a request that can only start at 06:30: `limite-da-lei` with the request alone. The day's flight time and duty depend on the others. Without the hours read ('horas' in `S.indisponiveis`) the history is missing | `dentroDosLimites({ compromissos, novo, historico, limites })` (js/limites.js:101-117); `historicoDoDia` (js/noturno.js:44-52) |
| `aluno-ocupado` | `stu_busy` | the student's other flights already placed | **No**, except against the student's own pins and yesterday's Noturno return (busy until 10:10: js/engine.js:381; js/voo.js:14) | `problemaDoAluno(ocupacao, stuId, { a, b })` (js/candidatos.js:67-70) |
| `avioes-ocupados` | `eq` | the aircraft's flights already placed | **No**, except against pins and the Noturno return (the C172 is busy until 10:10: js/engine.js:380) (inferred for this code; not seen alone in the runs) | `problemaDoRecurso` returns `{ codigo: 'aviao-ocupado', voo }` |
| `sala-ocupada` | `sala` | the room's classes already placed | **No**, except against pinned classes | `problemaDoRecurso(…, { ground: true })` |
| `instrutores-ocupados` | `busy` | the instructors' commitments already placed | **No**, except against pins and the Noturno return | `problemasDoInstrutor`; js/candidatos.js:105-119 |
| `limite-de-locais` | `locais` | the local flights already leaving at that minute | **No** for one request. Over the set of pedidos it has a pre-engine form: `vagaDeVooLocal(pedidos, { data, horario, missao }, horarios)` counts the local pedidos of an exact time (js/agenda.js:145-152), and the server refuses the 7th (mapa-avisos 5.2 E) | `vagaDeVooLocal` |

**Summary of the 21:** 7 are exact from the cadastro and the day (`instrutor-escolhido`, `equipamento-da-missao`, `so-parafuso`, `sem-aviao`, `sem-instrutor-habilitado`, `sem-horario`, and `disponibilidade-do-aluno` when no Ground of the same student is involved); 1 needs only the pins (`ground-antes-do-voo-fixo`); 2 follow from the student's own Ground (`ground-pendente`, `depois-do-ground`); 6 are picked by count but have a form that holds whatever the other requests do (`instrutores-indisponiveis`, `bloqueio`, `peso`, `habilitacao-do-aviao`, `revisao`, `limite-da-lei`); 5 exist only against other flights (`aluno-ocupado`, `avioes-ocupados`, `sala-ocupada`, `instrutores-ocupados`, `limite-de-locais`).

### 5. Measured: the request alone in the day

Method: for each flying request, the same state with every other request set to `fly: false` (the day's other data kept: `win`, `av`, `ins`, `fStatus`, `noturnosDaVespera`), then `runAllocationEngine`.

**The 41 golden states** (923 flying requests, 174 rejections):
- 58 rejections came from a fixed test: `sem-instrutor-habilitado` 27, `equipamento-da-missao` 13, `depois-do-ground` 9, `sem-horario` 6, `so-parafuso` 2, `sem-aviao` 1. 116 came from the counters: `instrutores-ocupados` 43, `aluno-ocupado` 26, `limite-da-lei` 21, `instrutores-indisponiveis` 12, `habilitacao-do-aviao` 7, `bloqueio` 3, `sala-ocupada` 3, `avioes-ocupados` 1.
- Of the 116 picked by count: 66 had one kind of obstacle, 29 two, 18 three, 3 four. 5 had a tie at the top. In 11 the printed obstacle was counted at no more than half of the starts.
- 64 of the 174 are also rejected alone: all 27 `sem-instrutor-habilitado`, 13 `equipamento-da-missao`, 7 `habilitacao-do-aviao`, 6 `sem-horario`, 2 `so-parafuso`, 1 `sem-aviao`; 3 of the 12 `instrutores-indisponiveis`; 2 of the 3 `bloqueio`; 2 of the 43 `instrutores-ocupados` (alone: `bloqueio`); 1 of the 26 `aluno-ocupado` (alone: `instrutores-indisponiveis`). The other 110 enter when alone, including all 9 `depois-do-ground` and all 21 `limite-da-lei`.
- Not in any golden, as a rejection: `ground-pendente`, `ground-antes-do-voo-fixo`, `disponibilidade-do-aluno`, `revisao`, `peso`, `limite-de-locais`, `instrutor-escolhido`.

**300 generated scenarios, three variants** (6,806 flying requests each):

| Variant | Rejected in the day (chosen instructor / fixed test / count) | Rejected alone | Rejected alone but placed in the day | Same code in the day | Other code in the day |
|---|---|---|---|---|---|
| `gerarCenario` | 1,380 (0 / 635 / 745) | 662 | 0 | 631 | 31 |
| plus `comEscolhas`, `comAtributos`, `comVolta` | 1,890 (492 / 603 / 795) | 1,170 | 0 | 1,137 | 33 |
| plus `jan` on about 35% of the requests and `horas` on about 40% of the aircraft (my own generator, outside the repo) | 2,683 (492 / 1,455 / 736) | 2,034 | 0 | 1,980 | 54 |

- In 3,866 cases a request rejected alone was never placed in the full day: "rejected alone" is a safe "this can never fit". The variants have no pins. One exception exists with pins (measured on a small case): a Ground request can join a pinned class that starts outside the eight day windows (js/engine.js:506-511, 632-650). A student whose `jan` is that exact minute (`h450`) is rejected `disponibilidade-do-aluno` alone and placed when the pinned class exists. A pinned class in a closed period does not take anyone: it has the conflict `horario-fechado` and is not opened (js/engine.js:446, 509; measured).
- In 118 of the 3,866 (3.1%) the full day prints another code than the cause that holds alone. The most common pairs: alone `bloqueio`, day `instrutores-ocupados` (19); alone `habilitacao-do-aviao`, day `instrutores-ocupados` (10); alone some other cause, day `ground-pendente` or `depois-do-ground` (43: with the student's Ground in the day, its outcome is tested before that cause, or replaces `sem-horario`).
- Codes seen alone: the 7 exact ones; `instrutores-indisponiveis`, `bloqueio`, `peso`, `habilitacao-do-aviao` and `revisao` in their static form; and, in the second variant, `aluno-ocupado` (32), `instrutores-ocupados` (10) and `limite-da-lei` (7). Run again without `noturnosDaVespera`, every one of those 49 enters or shows a static cause: alone, they come only from yesterday's Noturno return. The generators give the instructors no hours history, so the history form of `limite-da-lei` was checked only on the two small cases of section 4.2.
- The share rejected alone was 37% (goldens), 48%, 62% and 76% of the day's rejections. These are synthetic days (10% of instructors off, random habilitações, 5% wrong equipment); the share on real days is unknown.

**Isolating the student instead of the request is not safe.** With all of one student's requests alone in the day, 4 flights of the golden states are rejected (`depois-do-ground` 3, `aluno-ocupado` 1) that the full day places (cenario-27, -28, -35, -40). Alone, the student's Ground lands on its own preferred time, after which the flight has no start; in the full day the competition pushed the Ground earlier. The Ground's window is chosen by its preferences and by the flight's 1ª preferência (js/engine.js:603-621), not by whether the flight still fits afterwards.

**A function built only from today's exports gives the same verdict.** A prototype of about 25 lines (outside the repo) computes the possible starts and, for each, asks `problemaDoAluno`, `avioesQueServem` and `instrutoresQueServem` of js/candidatos.js against the occupation of the day before any request (`ocupacaoDaEscala` of the engine's output with no request flying, that is, the Noturno return rows). Its "fits alone / does not fit" equals the engine's in 13,612 of 13,612 checks (the first two variants). The engine with one request takes about 0.1 ms.

### 6. The existing functions that already check one request

| Function | Where | Exported | Checks | Used by |
|---|---|---|---|---|
| `impedimentoDoPedido` | js/instrutor-escolhido.js:21-26 | no | one instructor against one request, time-independent: off, unqualified, blocked | `instrutoresDoPedido` (:30-35, exported) → the Demanda's Instrutor select (js/views/demanda.js:35-36) |
| `FORA_DA_ESCALA`, `motivoDeFora` | js/agendamento.js:223-237 | no | nothing: a short text for each of the 21 codes, read from the engine's rejection by label | the booking dialog's "Encaixar <missão> (ficou fora: <motivo>)" (js/agendamento.js:272) |
| `problemaDoRecurso` | js/candidatos.js:56-63 | yes | one resource at one time against an occupation: `aviao-indisponivel`, `aviao-ocupado` or `sala-ocupada`, `revisao` | `avioesQueServem`; js/agendamento.js:176, 518 |
| `problemaDoAluno` | js/candidatos.js:67-70 | yes | the student at one time: `aluno-ocupado` | js/reparo.js:86; js/agendamento.js:177 |
| `avioesQueServem` | js/candidatos.js:86-96 | yes | every resource of a type at one time, each with its problem (`so-parafuso`, `so-vfr`, the own habilitação, and the three above) | js/reparo.js:35; js/agendamento.js:517 |
| `instrutoresQueServem` | js/candidatos.js:105-119 | yes | every instructor at one time, with all his problems (`todos: true`) and the fuel reduction | js/reparo.js:39; js/agendamento.js:179, 551, 671, 1209 |
| `ocupacaoDaEscala` | js/candidatos.js:38-52 | yes | builds the occupation the four above read; `soFixos: true` keeps only pinned flights | js/reparo.js:27; js/agendamento.js:166 |
| `problemasDoInstrutor` | js/viabilidade.js:38-71 | yes | the six instructor rules, first or all | the engine, the hours split, the compaction, the candidates, the Escala's instructor list |
| `motivoDoBloqueio` | js/progresso.js:114-139 | yes | why a course mission is out of order ('falta PE-03 (reprovada em 14/11)') | js/views/etapas.js:76 |

- Two different functions are called `instrutoresQueServem`: the engine's private one returns `{ servem, barrou }` (js/engine.js:28-37); the exported one of js/candidatos.js returns every instructor with all his problems.
- The booking dialog is the existing example of "one flight judged before the others are placed": its lists are computed "contra os voos fixos" (js/agendamento.js:160-182, 511-525, 546-574), and only then the engine runs on a copy of the state for the final answer (`simularAgendamento`, js/agendamento.js:960-967).
- Short texts that already exist for a per-request list: `NOTA_DO_PROBLEMA` (js/instrutor-escolhido.js:38-41, exported: 'indisponível', 'sem a habilitação', 'ocupado', 'em Não escalar com', 'limite da lei', 'peso acima do limite'); `textoDoRecurso` (js/agendamento.js:491-502, private: 'em manutenção', 'sem saldo até a revisão de 50 h', 'só Parafuso', 'só VFR (o voo é IFR)', 'exige a habilitação própria'); `FORA_DA_ESCALA`.

### 7. Reasons outside the 21 codes that Processamento can state by itself

- **The course order.** The engine imports nothing from `js/progresso.js` or `js/programa.js` (js/engine.js:3-19): a mission out of the programme's order is never a rejection. The pure functions are `estadoDoAluno` (state per mission: 'liberada', 'condicional', 'bloqueada', …; js/progresso.js:18-21) and `motivoDoBloqueio`. Today the check is a confirmation in the Demanda (js/views/etapas.js:54-76) and a warning `fora-da-ordem` in the booking dialog (js/agendamento.js:1111-1132).
- **"Priorizar com" that cannot be met.** `motivoSemPar` first tests what holds for every instructor of the student's list, from `on`, `hab` and `bl` alone: 'fora nesta data', 'sem a habilitação da missão', 'em “Não escalar com”' (js/engine.js:246-250). Those three can be said before the engine; the other texts come from the counters of the "Priorizar com" pass (251-252).
- **A pedido at an exact minute.** Every pedido registered since the migration of 2026-11-14 has an exact time (`janela: 'horario'`: js/eventos/agenda.js:100; js/backends/local.js:162; supabase/migrations/20261114222031_agenda_com_duracao.sql:28), and the import turns it into `jan: 'h<minuto>'` (js/agenda.js:52-56, 63-80). Such a request has at most one possible start. With one start the counters hold a single 1, so the reason is the first obstacle of layer 1 at that minute; with none it is `disponibilidade-do-aluno` (mapa-pedidos 5.3 shows both).

### 8. Tests that pin the reasons

| Code | Unit test (file:line of the assertion, test name) |
|---|---|
| `instrutor-escolhido` | test/unit/instrutor-escolhido.test.js:62-64, 'o escolhido que não pode voar o pedido em nenhum horário: o pedido fica fora, com o motivo' |
| `equipamento-da-missao` | test/unit/engine.rules.test.js:203, 'missão em equipamento não permitido é rejeitada' |
| `ground-pendente`, `instrutores-indisponiveis` (Ground) | test/unit/engine.rules.test.js:533-534, 'o voo é rejeitado quando o Ground pré-requisito não pode ser alocado' |
| `ground-antes-do-voo-fixo` | test/unit/fixos.test.js:217, 'sem horário para o Ground antes do voo fixo, a rejeição diz por quê' |
| `so-parafuso` | test/unit/engine.rules.test.js:430, 'Parafuso no C152 é rejeitado com o PR-JPL em manutenção' |
| `sem-aviao` | test/unit/engine.rules.test.js:423, 'outras missões nunca usam o PR-JPL'; test/unit/atributos.test.js:90 |
| `sem-instrutor-habilitado` | test/unit/engine.rules.test.js:164, '${mis} em ${eq} exige ${exige}'; test/unit/atributos.test.js:104 |
| `disponibilidade-do-aluno` | test/unit/engine.rules.test.js:343, 'sem horário possível na disponibilidade, o pedido é rejeitado dizendo por quê' |
| `sem-horario` | test/unit/engine.rules.test.js:450, 'é rejeitado com a janela noturna desativada'; :555, 'sem nenhum período do dia aberto, não há horário para a aula' |
| `sala-ocupada` | test/unit/engine.rules.test.js:504, 'é rejeitado quando a sala está ocupada em todos os horários possíveis' |
| `avioes-ocupados` | test/unit/atributos.test.js:135 (the IFR text only) |
| `revisao` | test/unit/engine.rules.test.js:366, 384 |
| `bloqueio` | test/unit/engine.rules.test.js:210, 'instrutor bloqueado pelo aluno não é escalado' |
| `limite-da-lei` | test/unit/limites.test.js:118, 'sem instrutor dentro dos limites, o voo não entra e a mensagem diz por quê'; test/unit/noturno.test.js:69, 81; test/e2e/limites.spec.js:43 |
| `peso` | test/unit/engine.rules.test.js:224, 'aluno + instrutor acima do limite, mesmo com o mínimo de combustível, é rejeitado' |
| `limite-de-locais` | test/unit/engine.rules.test.js:271, 'o Solo só sai às 06:30: com 6 locais às 06:30, o 7º é rejeitado dizendo por quê' |
| `habilitacao-do-aviao` | test/unit/atributos.test.js:119 |
| `depois-do-ground`, `instrutores-ocupados`, `aluno-ocupado` | **no unit or e2e test asserts the code or the text** (grep of test/unit and test/e2e); only the goldens hold them (9, 43 and 26 alerts) |

- (inferred) Every unit test above builds a day with one kind of obstacle. The highest-count rule, the ties and the "last pass, last attempt" rule are pinned only by the goldens.
- The goldens record every rejection text: 174 alerts in 32 of the 41 files (mapa-avisos, section 7).

### 9. Repo rules this touches

- **`runAllocationEngine` stays pure and the goldens stay as they are** as long as the reason selection (js/engine.js:24-37, 743-766, 926-965) is not edited. Running the engine more times, on copies of the state, changes nothing in it.
- **Goldens**: any change to a rejection text, to the order of the tests or to the fields of the alert changes golden files (174 alerts).
- **Saved schedules**: a new rejection code must enter `CODIGOS_DE_REJEICAO` in the same commit; an `err` with a code outside the list makes `normalizarEscalaGravada` return null (js/escala-gravada.js:85-90, 107).
- **`gravarAlteracao`**: a verdict computed before the engine is derived from `S`; it writes nothing.
- **Personal data**: the checks read `nm`, `kg`, `hab`, `bl`, `curso`; none reads CPF, CANAC, nascimento, celular or e-mail. Rejection texts carry names and go to the CSV and the PDF today (js/csv.js:63; js/export.js:87).
- **Fictitious data**: every measurement here used generated names and weights.

## What the maps got wrong or left out

- **mapa-motor, section 6, conflict 10** ("Almost every reason is an output of the allocation and depends on the other requests"): overstated. 7 of the 21 codes are fixed tests on the request, the cadastro and the day; 6 of the 11 codes picked by count have a schedule-independent form; and in the 41 golden states 64 of the 174 rejections hold with the request alone (measured). Its question 10 lists three pre-engine reasons; the full list is in section 4.
- **mapa-motor, section 5.6**, describes the search but not how the reason is chosen: the priority list of fixed tests, the one-obstacle-per-start counting, the "furthest instructor" rule, the highest count with ties by declaration order, and the last pass and last fuel attempt (sections 2 and 3).
- **mapa-motor, section 5.3** ("With no start left the rejection is `disponibilidade-do-aluno` when the request has `jan`, `depois-do-ground`, or `sem-horario`"): correct, but in the flight branch `so-parafuso`, `sem-aviao` and `sem-instrutor-habilitado` are tested before them (js/engine.js:929-938), and in the Ground branch `sem-instrutor-habilitado` and `ground-antes-do-voo-fixo` (746-749). A closed period can be hidden behind any of those.
- **mapa-avisos, section 5.3 and section 6, item 11** ("pedidos que não cabem … only after the engine has run"; "it does not exist before the engine runs, and it depends on the other requests"): true for the count of the day, not for each request. A safe subset exists before the engine (section 5).
- **mapa-avisos, section 5.2 B**: the table omits the eight texts that change with a chosen instructor (js/engine.js:759, 760, 762, 955, 956, 958, 960, 961), and that the Ground texts of `instrutores-indisponiveis`, `instrutores-ocupados` and `bloqueio` carry no "(<exigências>)" (759-761). It names `FORA_DA_ESCALA` as the only consumer of the codes, which is right; it leaves out that `motivoDaSaida` (js/agendamento.js:1031-1034) reads the rejection's text, also found by label, for the lines "Sai: …" and the warning `saem`.
- **mapa-avisos, section 5.5** (a suggestion) maps rejection codes read from `RES.al` to Processamento rows ("recursos disponíveis": `sem-aviao`, `so-parafuso` or `revisao`; "INVAs disponíveis": `sem-instrutor-habilitado`). Those codes exist only after the engine, `habilitacao-do-aviao` is missing from the resource row, and a code picked by count can name the wrong row (118 of 3,866, measured).
- **mapa-invas, section 6, conflict 10** ("Time-independent reasons already exist as a pure function (`instrutoresDoPedido`…)"): correct, but it leaves out the instructor reasons that depend on the time and not on the schedule: `aw` against the request's possible starts, the weight with this student, the aircraft's own habilitação, and the history part of the law (month, semester, year, rest). All are answered by `problemasDoInstrutor` with no commitments.
- **mapa-demanda, section 5.5** ("The flight is rejected (`ground-pendente`) when its Ground did not fit"): also when the Ground is pinned and cancelled (js/engine.js:426, 512-513; measured).
- **mapa-escala, section 5.1** ("no view uses them to link to a screen"): correct; it does not say that the hints the codes were made for (docs/PLAN.md:283, "Ir para…") were never built.
- **No map recorded** that `equipamento-da-missao` cannot be produced by the app's own writers (section 4.1); that three codes are pinned only by the goldens (section 8); that "(ocupados por pedidos de prioridade maior)" is printed without checking it (section 3); that the Ground's window can make its own flight impossible (section 5); or that a request born from a pedido has at most one possible start (section 7).

## Implications for the plan (suggestions)

Everything below is a suggestion.

1. **Name two different things in the plan.** "Não cabe sozinho": the request cannot fit even with the day empty; Processamento and module E can say it, with its cause. "Não coube na escala": it lost to other flights; it exists only after the Escala stage (`RES.al`). The pipeline row "pedidos que não cabem" under Processamento would count the first; the second belongs under Escala ("conflitos e avisos" or a row of its own). *Cost:* wording, one more row, a decision by Pedro. *Risk:* two "left out" numbers on screen; today's red box mixes both, so the operator has to learn the difference.
2. **Route A for "não cabe sozinho": run the engine once per request on a copy of the state with only that request flying**, as `simularAgendamento` already runs it on a copy. The code and the text are the engine's by construction. *Cost:* about 0.1 ms per request (measured), no engine change, no golden change. *Risk:* it inherits the one-reason text and the masking of layers 1 to 3 (a static `bloqueio` can still read `instrutores-indisponiveis`); the other requests of the same student are dropped with the rest, so the Ground gate and the "Noturno in the day" limit vanish and the verdict errs only towards "fits" (0 false "does not fit" in 3,866).
3. **Route B: a pure function in module E built from js/candidatos.js**, returning for each request its possible starts and, per start, the aircraft and the instructors with what stops each one (`todos: true`). It gives the same verdict as the engine alone (13,612 of 13,612, measured) and can show every cause, which the engine cannot. It also fills the rows "recursos disponíveis" and "INVAs disponíveis" per request (how many could serve). *Cost:* the function, its unit tests and an invariant test "the verdict equals the engine with the request alone" over the scenario generators; a shared "possible starts of a request" function, today written inline three times. Taking that function out of the engine is an engine edit that must leave the goldens identical. *Risk:* without the shared function there is a fourth copy of the start-time rule; without the invariant test the two drift apart.
4. **Decide what "the day" includes for the verdict.** Yesterday's Noturno return is part of the date and already explains `aluno-ocupado`, `instrutores-ocupados` and `limite-da-lei` for a request alone (measured). The pins are operator restrictions of the Escala stage; counting them gives `ground-antes-do-voo-fixo`, `sala-ocupada` and occupied aircraft before the engine. *Cost:* none; one sentence in the plan. *Risk:* with the pins, "Processamento" changes when the schedule is approved (every flight becomes a pin).
5. **Never isolate by student.** It rejects flights the day places (4 in the goldens). For a flight gated by a Ground, say "depende do Ground <missão> do mesmo dia" (static, `doesGroundGateFlight`) and leave `ground-pendente` and `depois-do-ground` to the Escala stage. *Cost:* none. *Risk:* a Ground and a flight that can never both fit (the flight's only start is before any Ground can end) are found only by the engine, unless a lower bound is added (earliest open Ground window plus 90 minutes).
6. **Build the code-to-place table the codes were made for**, now that each cadastro has a detail pane: the exact codes point at one record or control (the chosen instructor of the request; the resource's "Disponível"; the instructors' habilitações; the student's "Não escalar com" and weight; the take-off times and the request's availability); the five competition codes point at the Escala. mapa-avisos 5.2 B has a first (inferred) column for it. *Cost:* a table and a navigation helper; exporting `FORA_DA_ESCALA`, `NOTA_DO_PROBLEMA` and `textoDoRecurso` from one shared module (js/conflitos.js is the natural place). *Risk:* a code picked by count can send the operator to the wrong place (3.1% of the static cases, and 50 of the 116 count-picked golden rejections had more than one kind of obstacle); the request must be found by key, not by the label text.
7. **Leave the engine's reason selection as it is in this redesign**, or change it in one commit of its own with Pedro's consent. Two candidate changes: (a) when the request cannot fit alone, print that cause instead of the most counted obstacle (3 golden alerts change: cenario-07, -08, -21); (b) add `stuId` and `fKey` to rejections (all 174 change; mapa-motor section 7, item 7). *Cost:* goldens re-recorded, text and fields only. *Risk:* the guardrail says the goldens change only for a rule change; this is a message change.
8. **Tell Pedro what exact-time pedidos do to the reasons.** If an approved pedido keeps its minute as the only possible start, "nos horários possíveis" means one minute, the count is trivial, and requests at the same minute are rejected instead of moved (mapa-pedidos 5.3). If Processamento widens the availability, the count logic of section 3 applies again. *Cost:* none. *Risk:* more `instrutores-ocupados` and `aluno-ocupado` than with hand-made requests.
9. **Decide whether a request that cannot fit alone still goes to the engine.** If it does (nothing changes in the state's shape), it is rejected again there and counted in "N missões pedidas", in the PDF's "Missões na demanda" and in the BI's `rej` (js/views/escala.js:462-463; js/export.js:54; js/actions.js:358). If Processamento holds it back, those three numbers drop on every date from then on. *Cost:* none for the first; for the second, new texts and a note in the BI. *Risk:* the first shows the same request in two places; the second breaks the comparison with past dates.
10. **Add the three missing unit tests before anyone touches the selection**: a rejection `depois-do-ground`, `instrutores-ocupados` and `aluno-ocupado`, plus one day with two kinds of obstacle and one with a tie. *Cost:* small. *Risk:* none.
11. **Attach the course order to the enriched pedido in module E** (`estadoDoAluno`, `motivoDoBloqueio`), since the engine will never report it. *Cost:* moving the logic out of js/views/etapas.js, which reads the global `S`. *Risk:* it needs the results and the programmes read (`S.indisponiveis`).

Questions these depend on:
- Does a pedido that cannot fit by itself still go to the Escala stage, or does it wait in Processamento until fixed?
- For "cabe sozinho", do the operator's pins count as part of the day?
- May the engine's rejection messages change in a commit of their own (the static cause first; ids on the alert), with the goldens re-recorded in text only?
- Does an approved pedido keep its exact minute as the only possible start?
- Should Processamento show every obstacle of a request (each instructor and aircraft with what stops it) or one line, as the red box does today?

<!-- fim -->
