# Desenho: The core data flow: from approved pedidos to the engine input, and the operator restrictions

Lens: the smallest change that is airtight (posicao.md B1 kept; every hole of the gap notes closed with the least new
machinery). Read on the worktree `.redesenho/wt-plano` at 48875e3; paths are relative to it. "(ran)" = run with node on
the pure modules from a scratch folder outside the repo, fictitious names and weights only; nothing in the worktree changed.
Words: *pedido* = a row of `solicitacoes`; *record* = the day's stored request (`dia.pedidos[<aluno>]` or one of its
`extra[]`); *key* = `<stuId>_<mid>_1`.

The design in one paragraph: the day's records stay exactly as they are stored today and stay the engine's only input.
A record is born once, from an approved pedido (it carries `solicitacao: <id>`) or from a booking, and is never deleted
or renumbered. `dia.importadas` (existing field) becomes "the pedidos this date admits". A pure reconciliation compares
the date's pedidos with that list: a pedido that became approved enters (a new record, or the same record turned on
again); one that stopped being approved leaves (`fly: false`, nothing else). Everything the operator decides about a
flight stays on the record, in fields that exist today, and is edited in an Escala-stage panel. No new stored field, no
re-keying, one no-op format number (28), no engine change, no golden change.

## 1. Decisions (numbered; for each: the decision, why, the evidence as a map section or path:line, and the alternative rejected with the reason)

| # | Decision | Why | Evidence | Alternative rejected, and why |
|---|---|---|---|---|
| 1 | **The stored records are the engine's only input and the module's memory.** `runAllocationEngine(S)` keeps reading `S.stu[].fly` and `.extra`; the table `solicitacoes` is read only by the reconciliation, which is an explicit, logged write. | A failed, partial or late read of the pedidos can never change a schedule; the saved `resultado` always matches the stored records; pins, statuses, results, the nine reverts, TV, BI and exports need no change. | js/actions.js:367; mapa-dados 5.8 ("a schedule computed from zero pedidos must never be saved"); mapa-demanda 5.6 (non-readers); lacuna-1-pedido-principal §5 | Derive the requests at each open, or gate `fly` by the pedidos at each engine run: read-only profiles would see a schedule that is not the stored one, and a run without the pedidos (offline) would drop every flight. |
| 2 | **Identity = the record that carries `solicitacao: <id>`.** Its slot (`mid` 0 or an extra's `mid`) is given once by `alvoDoNovoPedido` / `proximoMid`, the same allocator the booking uses, and never changes. A pedido id is never a `mid`. | One number space for pedidos and bookings (no collision by construction); mids stay small (1 + the student's highest), far inside 6 digits; local ids of 13 digits are only ever the value of `solicitacao`, which accepts any positive integer. | js/rules.js:67-72, 95-100, 163-164; js/dias.js:22, 59-62; js/escala-gravada.js:37; lacuna-1-pedido-principal §4; (ran) 300 random sequences of 60 events (register, approve, withdraw, cancel, exclude, restore, book, status, pin, save and load): 0 pedidos changed key, 0 duplicate keys, 0 mids outside 1..999,999 | `mid` = pedido id (breaks both bounds in local mode; `proximoMid` can hand out the next pedido's id). "Main request stays off, every pedido an extra" (rows 6, 9, 14, 15, 16 of the gap table break; collision on the cut-over date). |
| 3 | **A record born from a pedido is never deleted.** Leaving the schedule is `fly: false` on the same record. | A deleted slot is reused (`proximoMid` is max + 1; mid 0 is reused when clean), so a stored revert or a later result would land on another flight; a re-approved pedido would get another key and lose what the operator set. Kept, the record makes re-approval return to the same key, pin and restrictions. | js/rules.js:67-72, 95-100; five revert kinds address `(stuId, mid)` (js/reversoes.js:46-115); `resultados_de_missao.voo` is append-only (mapa-restricoes 2.4) | Remove the record (posicao B1): needs the per-key cleanup of `limparDemanda`, loses restrictions on re-approval, and reopens the reuse hole. A counter of handed-out mids: a new stored field for the same guarantee. |
| 4 | **One guard in `alvoDoNovoPedido`: a main request that carries `solicitacao` is never reused** (`!aluno.fly && !Number.isInteger(aluno.solicitacao) && !chaveTemSobras(…)`). | Today a non-flying main request with no leftovers is blanked and handed to the next new flight, pedido or booking: the record of an excluded or withdrawn pedido would be erased and its key given to another flight. | js/rules.js:95-100; js/agendamento.js:905; the two tests that pin today's reuse: test/unit/rules.test.js "o pedido principal, quando o aluno não voa…" (its fixture has `solicitacao: 7`) and test/unit/agenda.test.js "o pedido principal que recebe o pedido da agenda começa em branco" (`solicitacao: 99`) | Leave it: decision 3 would not hold for mid 0. |
| 5 | **`dia.importadas` means "the pedidos this date admits"**: an id enters with the pedido and leaves when the pedido leaves. It is what tells "taken off by the operator" (id still in the list, `fly: false`) from "left because the pedido is no longer approved" (id gone). | The field is already stored, whitelisted, normalised and has its format step; no new field is needed to mark anything. | js/dias.js:29, 34, 71, 110; js/storage.js:84; js/agenda.js:110-116; js/migracoes.js:79-83 | A new field `admitidos`, or a mark on the record: a new name in `separar`, `juntar`, `CAMPOS_DO_PEDIDO`, the normalisers and `pedidoDeAntes` for nothing the existing list cannot say. |
| 6 | **The reconciliation only does three things**: creates the record of a pedido that enters for the first time (today's import rules), sets `fly` of a record that returns or leaves, and edits `importadas`. It never touches a record without `solicitacao`, and never rewrites any other field of an existing record. | What a booking, the chosen instructor or a restriction wrote on the record survives every reconciliation; "rebuilt from the pedido" is what puts a moved flight in conflict and blocks its "↶ Desfazer". | lacuna-1-pedido-principal §5 (ran there); lacuna-2 2.11 (ran there); (ran here) the reconciliation is idempotent and convergent in the 300 sequences | Re-enrich at each reconciliation: reverses bookings and restrictions, and releases booked pins on a read. |
| 7 | **Leaving keeps the pin dormant; nothing but `fly` and the list changes.** | It is exactly what "Tirar da escala" does today, with its tests: the engine walks pins only of flying requests, the next "Aprovar escala" drops a stale pin that is not booked, and a pedido approved again returns to its place. A cancellation is final, so its pin never wakes. | js/engine.js:400; js/fixos.js:59-69; test/unit/fixos.test.js "pedido que saiu da demanda: o voo fixo dele não aparece", "com o motor: o agendado tirado da escala volta ao lugar dele…"; test/e2e/demanda.spec.js:511 | Release pin, status and detail (posicao B1): new code, and an approval withdrawn by mistake loses the flight's place and its booking. Cost of the choice: a pedido approved again long after can wake a pin onto a slot booked meanwhile (the booked flight takes the conflict, as today with "Voa"). |
| 8 | **What stays when its pedido stops being approved**: a flight whose status pins it (`fixoPeloStatus`: Em Voo, Atrasado, Pousou, Cancelado) or whose key has a result on the date. With the results unread (`indisponiveis` has `resultados`) no flight leaves. The flight stays as it is and is shown as "sem pedido aprovado". | A pedido edit must not erase the record of something that happened, nor a cancellation with its reason; a cancelled flight occupies nothing. | js/fixos.js:40-41; js/status.js:13; js/reversoes.js:143-147 (the same guard for the booking undo) | Only Atrasado, Em Voo, Pousou (posicao B1, after "Limpar demanda"): the cancelled row and its reason would leave the schedule, the CSV and the BI. |
| 9 | **When it runs.** (a) At once, inside `gravarAlteracao`, after an approval, a withdrawal, a cancellation or a "Registrar e aprovar" made in this browser for the open date, and only for that pedido. (b) Otherwise the difference is shown ("2 pedidos aprovados fora da escala · 1 cancelado ainda na escala · Atualizar a escala") and an Operador or Administrador applies it with one click. A read never writes; read-only profiles see the sentence without the button. A failed read of the pedidos is its own notice, never "no difference". No rail notice on dates before today. | Guardrail "nothing is saved before the date's data is read"; the day document is versioned and `solicitacoes` is not, so the admission has to be a write to the day. | js/actions.js:189-195, 286-317; js/views/selos.js:38-45 (`.catch(() => [])` today); mapa-dados 5.8; docs/PLAN.md:176 | Apply on open for an Operador: a write caused by a read. Read the pedidos inside `lerData`: not needed once the engine input does not depend on them. |
| 10 | **History: one line per pedido, no revert.** The inverse of an entry is withdrawing the approval in Pedidos (which reconciles again); a cancellation has no inverse. | No tenth revert kind; the same as today's import. Volume per date is what the import writes today. | js/eventos/agenda.js:54-55; js/reversoes.js:43-117 | A revert kind `desfazerAprovacao`: it would have to call an RPC from the History. |
| 11 | **The exclusion stays `fly: false` on the record, an operator restriction of the date; the pedido stays approved.** | "Tirar da escala" keeps working with no server call, its `setFly` revert and its dormant pin; records already stored with `fly: false` need no conversion. | js/eventos/demanda.js:184-194; js/eventos/historico.js:53-61; js/backends/supabase.js:218-230 (an RPC has no queue) | "Turning Voa off is withdrawing the approval" (posicao B2): an Escala action that fails offline, a new path for the `setFly` revert, and every stored record that is bound, approved by the backfill and `fly: false` would come back at the cut-over unless SQL un-approves it. |
| 12 | **Operator restrictions live on the record, in today's fields** (`insId`, `pr`, `eq`, `nb`, `etapa` + `cursoDaEtapa`, `p1`, `p2`, `jan`, `fly`), and are edited in one Escala-stage panel, "Restrições do voo", which is one row of today's Demanda table laid out as lines and driven by the same handler. Processamento has no input. | The engine, the compaction, the booking, Sugestões and five revert kinds read those fields where they are. | mapa-restricoes 5.6; js/eventos/registro.js:39-52 (the `data-k="d"` dispatch works on any element); js/eventos/demanda.js:197-273 | A per-date restriction store keyed by pedido (mapa-restricoes suggestion 2): every writer of mapa-demanda 5.6 and five revert kinds rewritten, two homes for `insId`. |
| 13 | **Hand-made requests end at G**: "+ Pôr um aluno na demanda", "+ missão", the "✕" of an extra, the Voa checkbox with its cascade to the extras, the Missão (type) select and "Limpar demanda" are removed. A flight enters as a pedido ("Registrar e aprovar") or as a booking. Requests with no pedido already stored stay and keep flying. | Each of them assumes the main row is the student, or creates or deletes slots by hand. | lacuna-1-pedido-principal §2 rows 14-18; mapa-demanda 5.8 items 1, 3, 11 | Keep them beside the pedidos: two ways to create a flight on the same screen, and slot deletion comes back. |
| 14 | **Bookings are unchanged**: "+ Agendar voo" creates a record with no `solicitacao` and a pin `agendado`; Mover and Encaixar rewrite the record they move, whatever its origin; "↶ Desfazer" is unchanged. A booking still creates no pedido. | With decision 6 nothing un-does what a booking wrote; the server refuses what a booking only warns about (deadline, Sunday, the 7th local flight). | js/agendamento.js:899-943; js/reversoes.js:136-191; mapa-restricoes 5.3; docs/PLAN.md:421 | A booking registers an approved pedido: a server path that mirrors "Agendar mesmo assim", and fields a pedido does not have. |
| 15 | **The course mission is bound when the record is created, or by the operator, and never recomputed.** The screen shows what the program says now beside what is bound. A pedido of a student in a closed course enters without the course mission. Several pedidos entering together are bound in the order of their times. | Recomputed, the mission would advance after the flight's own result and put pinned flights in conflict. Decision 2 of 2026-11-17 says a closed course "warns and asks, never blocks", and a pure module has no second click. | posicao A4; mapa-demanda 5.8 item 9; js/agenda.js:119-127; lacuna-2 2.4, 2.10 (ran there) | Bind silently in a closed course (today's import). Time-aware binding as the default (lacuna-2 C.2): a rule change of the next-mission logic, left as a question. |
| 16 | **The pedido that takes the place of a hand-made flight keeps that flight's `pr`** (it already keeps `insId` and `mid`). | A restriction of the operator must not be reset by an approval. | js/agenda.js:74, 129-133; mapa-demanda 5.4 (ran there: `pr` back to 3) | Keep the reset: a silent loss of an operator input. |
| 17 | **The pedido stays one exact time.** A looser or another time is an operator restriction (Disponibilidade, 1ª and 2ª preferência in the panel, or Encaixar). No new column on `solicitacoes`. | The fields and their options exist; the local-flight limit counts exact times; the decision of 2026-11-14 stands. | js/rules.js:35-36; mapa-pedidos 4 (local limit), 7.8; docs/PLAN.md:302 | Two nullable columns in D's migration (posicao B2): a new RPC overload, the form, the three mirrors, and a definition of the local limit for flexible pedidos. |
| 18 | **The module is `js/processamento.js`**, with a pure difference, a mutating apply (as `importarSolicitacoes` is today), the join of rejections and the "alone" verdict. From E on the app imports five of its exports; the parts exported only for tests are used by the module itself, which the lint accepts. | The unused-exports lint passes an export that the app imports, or that the module uses and a test imports. | scripts/exportacoes-sem-uso.mjs (the loop over `exportacoes`: `interno && testado`) | Ship the whole view-model in E: exports that only tests use, which the lint refuses. |
| 19 | **"Não cabe nem com o dia vazio" is the engine itself, run on a copy with only that request flying and no pins** (`motivoSemODia`). | The verdict and the text cannot drift from the engine; no fourth copy of the start-time rule. | js/agendamento.js:960-967 (the same pattern); lacuna-1-motivos §5; (ran) 1,344 requests of 60 generated days: 210 rejected alone, none of them placed in the full day, 0.2 ms each | A second rule set built from js/candidatos.js (route B): needs a shared "possible starts" function taken out of the engine and an invariant test to stop the drift. The candidates are still used, to list who could serve. |
| 20 | **A rejection is matched to its request by position, not by label**: the i-th `err` alert is the i-th flying request with no pin and no row, in the engine's queue order. The label is only a check; when it does not line up (a stale saved schedule), only the labels that are unique on both sides are matched and the rest get no reason. The engine's alerts are untouched. | The label is the same for two extras of one student with the same mission, and for two students with the same name. | js/engine.js:292-303, 333-338, 556-964 (every `err` is pushed inside the queue loop; nothing reorders `al`); (ran) 1,200 generated days, 6,439 rejections, 0 out of line, 70 of them sharing a label; with half of the flights pinned, 400 days, 2,556 rejections, 0 out of line | `stuId` and `fKey` on `err` alerts: 174 golden alerts change in a commit that is not a rule change. |
| 21 | **A request that cannot fit alone still goes to the engine.** | "N missões pedidas", the PDF's "Missões na demanda" and the BI's `rej` keep their meaning across the cut-over. | lacuna-1-motivos implication 9; js/views/escala.js:462-463; js/export.js:54 | Hold it back in Processamento: three numbers drop on every date from then on. |
| 22 | **Cut-over: format 28 is a no-op step that ships with G**; no stored day changes content. The pedidos already imported are marked approved by SQL only when their record still exists in that date's day, and the same statement runs again in G's migration. | A tab of the version before G would import again a pedido whose id left the list (two records for one pedido), so its saves must be refused. Ids imported between D's migration and D's merge would otherwise be "admitted and not approved". | js/migracoes.js:176-213 (the no-op pattern); mapa-pedidos 5.1 (probes), 7.3; mapa-dados 5.3 | A step that rewrites `importadas` or the records: not needed; the difference handles a stale id by itself. |
| 23 | **Between D, E and G the Demanda works as today**: D makes the import take only approved pedidos; E routes the import through the module with entries only (an id never leaves the list before G); G turns the exits on and deletes the table. E needs no format number. | An id leaving the list is what needs the number (decision 22). | posicao B3, B8; js/eventos/agenda.js:31-61 | Exits in E: E would need a format number of its own, merged in number order with C's 27, while the Demanda's Voa could still turn the same flight back on. |
| 24 | **`juntar` takes only the request fields and `extra` from the stored main request**, and the module's contract is tested on the records it writes (no name, no free text, only `CAMPOS_DO_PEDIDO` plus `mid`). | Today a stored main request that holds `id`, `nm` or `kg` replaces the roster's values in memory and is saved back; extras are stored whole, so a pedido's `aluno_nome`, `observacao` or `registrado_por` must never be copied onto one. | js/dias.js:59-62, 96-101; lacuna-1-pedido-principal §2 rows 2-3, §8 | Leave it: the day is the one document the server does not check inside (`pedidos`). |

## 2. How it works (data shapes with field names, function signatures, screen structure, states: enough for an implementer)

### 2.1 Stored data: nothing new

| Data | Shape | Change |
|---|---|---|
| `dia.pedidos[<stuId>]` | `{ fly, mis, eq, p1, p2, nb, ss, pr, jan?, etapa?, cursoDaEtapa?, solicitacao?, insId?, extra: [{ mid, …os mesmos }] }` | none |
| `dia.importadas` | `[<id do pedido>…]` | same field; an id now also leaves (from G) |
| `dia.fixos`, `fStatus`, `fObs`, `aprovacao`, `resultado`, `criterios` | as today | none |
| `solicitacoes` (D) | today's columns plus `aprovada_em`, `aprovada_por` (nullable) | D's migration |

Origin of a record, derived, never stored: **pedido** (it has `solicitacao`); **agendamento** (no `solicitacao`, its
pin has `agendado`); **manual** (no `solicitacao`, no booked pin: stored before G, or a booking whose pin was released).

Where a pedido stands on a date (all derived):

| The pedido is | id in `importadas` | Record | Meaning | Reconciliation |
|---|---|---|---|---|
| approved | no | none, or `fly: false` | a entrar | enters: record created, or `fly = true`; id added |
| approved | no | flies | flies without being admitted (only from the interim, when Voa was turned on by hand) | id added |
| approved | yes | flies | na escala (or rejected by the engine) | nothing |
| approved | yes | `fly: false` | tirado da escala pelo operador | nothing |
| approved | yes | none | (only in days stored before G) | enters again |
| approved, student not in the cadastro | any | none | fora do cadastro | reported, not admitted |
| not approved (cancelled or approval withdrawn) | yes | flies, no pinning status, no result | a sair | leaves: `fly = false`; id removed |
| not approved | yes | flies, pinned by status or with a result | fica | nothing; shown as "sem pedido aprovado" |
| not approved | yes | none or `fly: false` | nothing to take off | id removed silently with the next write |
| not approved | no | any | fora | nothing |
| id in the list but no row read for it | yes | any | unknown | nothing (an id that was not read is never an exit) |

### 2.2 The module `js/processamento.js` (no DOM, no clock, no network, no `S`)

Imported by the app from E on:

```js
// A diferença entre os pedidos da data e o que o dia admite. Não muda nada.
// aprovada: o predicado de "aprovado" (antes do passo D, todo pedido não cancelado; depois, pedidoAprovado, de js/agenda.js)
// so: só estes ids (a ação feita agora neste navegador); sem ele, todos
export function diferencaDosPedidos(estado, solicitacoes, { aprovada = s => !s.cancelada_em, so = null } = {})
// → { entram: [solicitacao…],            na ordem aluno, horário, id
//     saem:   [{ id, stuId, mid, motivo: 'cancelado' | 'sem-aprovacao' }],
//     ficam:  [{ id, stuId, mid, motivo, porque: 'status' | 'resultado' | 'resultados-nao-lidos' }],
//     semAluno: [solicitacao…], esquecidos: [id…] }

// Aplica a diferença. Muda estado.stu e estado.importadas (como importarSolicitacoes muda hoje).
export function reconciliarPedidos(estado, diferenca, { situacao = [], programa = [] } = {})
// → { entraram: [{ solicitacao, stuId, mid, novo, etapa, semMissao: null | 'curso-encerrado' | 'sem-missao-do-tipo' }],
//     sairam:   [{ id, stuId, mid, motivo }] }

// A rejeição do motor de cada pedido que voa e ficou fora, pela posição na fila (decisão 20)
export function rejeicoesDosPedidos(estado, resultado)        // → Map<fKey, { codigo, m, s }>

// A posição de um pedido na fila do motor (a mesma chave de js/engine.js:333-338), para quem ordena fora dele
export function ordemNaFila(estado)                           // → (aluno, pedido) => number[]

// Por que o pedido não entra nem com o dia vazio: o motor numa cópia só com ele, sem voos fixos; null quando cabe
export function motivoSemODia(estado, stuId, mid, motor = runAllocationEngine)   // → { codigo, texto } | null
```

Exported for the tests and used inside the module: `pedidoDaSolicitacao(solicitacao, horarios, { eq, nb })` (moved from
js/agenda.js with `vooQueDaLugar`), `missaoDaEntrada(estado, aluno, solicitacao, { indice, mapa, copiada })`.

Real use from E on (what the lint counts): `diferencaDosPedidos` ← js/eventos/agenda.js (the import) and
js/views/selos.js (the badge and the button's number); `reconciliarPedidos` ← js/eventos/agenda.js; `motivoSemODia` ←
js/eventos/agenda.js (the toast); `rejeicoesDosPedidos` and `ordemNaFila` ← js/agendamento.js.

Added in G, imported by the new views:

```js
export function pedidosDoDia(estado, solicitacoes, resultado, { situacao, programa, aprovada, motor })
// → uma linha por pedido da data e por registro sem pedido que voa ou está fixo:
//   { origem: 'pedido' | 'agendamento' | 'manual', solicitacao | null, aluno | null, registro | null, mid, fKey,
//     estado: 'cancelado' | 'aguardando' | 'sem-aluno' | 'a-entrar' | 'a-sair' | 'fica' | 'tirado'
//           | 'na-escala' | 'nao-cabe' | 'nao-coube',
//     voo: linha de resultado.out | null,
//     motivo: { quando: 'antes' | 'depois', codigo, texto } | null,
//     missao: { codigo, curso, situacao, agora }, restricoes: [{ campo, rotulo, valor, doPedido }] }
export function restricoesDoRegistro(registro, solicitacao, horarios, missaoDoPrograma)   // o que difere do que a entrada daria
export function missaoNoHorario(estado, base, ambiente, aluno, registro, minuto)          // movida de js/agendamento.js:212-255
export function candidatosDoPedido(estado, aluno, registro)   // { horario, recursos: [{ r, problema }], instrutores: [{ x, problemas }] }
```

What it reuses:

| From | Functions |
|---|---|
| js/agenda.js | `disponibilidadeDaSolicitacao`; after D, `pedidoAprovado`. The deadline, `vagaDeVooLocal`, `ehDomingo` stay there |
| js/rules.js | `alvoDoNovoPedido` (with the guard), `proximoMid`, `normalizeMissionFields`, `migrateLegacyMissionName`, `isGroundMission`, `doesGroundGateFlight`, `duracaoPadraoDaMissao` |
| js/progresso.js | `proximasMissoes`, `missoesDoDia`, `estadoDoAluno`, `motivoDoBloqueio` |
| js/candidatos.js | `ocupacaoDaEscala`, `problemaDoAluno`, `avioesQueServem`, `instrutoresQueServem` |
| js/programa.js, js/resultados.js | `indiceDoPrograma`, `rotuloDaMissao`; `situacaoPorMissao`, `resultadoDoVoo` |
| js/fixos.js, js/voo.js, js/horarios.js | `fixoPeloStatus`; `chaveDoVoo`, `pedidoDoAluno`; `horariosDaMissao`, `preferenciasPadrao`, `paraMinuto` |
| js/engine.js | `runAllocationEngine`, only as the default of `motor` (the app passes the same wrapper it uses for the schedule, so the inactive records of posicao B5 are left out the same way) |

Rules of `reconciliarPedidos`:

| Case | What is written |
|---|---|
| Enters, a record with that `solicitacao` exists | `fly = true`; id added. Nothing else: the mission, the instructor, the priority, the times and the pin are as they were |
| Enters, no record | Today's import, js/agenda.js:117-136: the student's unpinned hand-made flight of the same mission type gives way (`vooQueDaLugar`: it keeps `mid`, `insId` and now `pr`); otherwise `alvoDoNovoPedido`. Fields from `pedidoDaSolicitacao` (`fly: true, mis, eq, p1, p2, nb, ss: 1, pr: 3, jan: 'h<minuto>'`), the course mission from `missaoDaEntrada`, `solicitacao = id`; id added |
| Leaves | `fly = false`; id removed. The pin, the status and every other field stay |
| `esquecidos` | id removed |
| `ficam`, `semAluno` | nothing |

`missaoDaEntrada`: the mission the replaced flight already carries, else the first released mission of the student's
course whose type is the pedido's (`proximasMissoes(…).candidatas.find(m => m.mis === missao)`, with the student's other
flying records of the day counted as done, as today); none when the course is closed (`curso.ativo === false`), when no
released mission has that type, or when the program or the results were not read (`programa` empty).

`rejeicoesDosPedidos`: `fila` = the flying records sorted by `ordemNaFila` (Ground first; a chosen instructor who is in
the cadastro; `pr` 5 to 1; a student with `voaCom`; `solicitacao` ascending, none last; the student's position; the main
request, then the extras by position); `fora` = those with no pin in `estado.fixos` and no row in `resultado.out`;
`erros` = `resultado.al.filter(a => a.t === 'err')`. Same length and every label equal (`nm`, or `` `${nm} (${mis})` ``
for an extra): pair by index. Otherwise pair only the labels that appear once in both lists. `naOrdemDoMotor`
(js/agendamento.js:132-155) uses `ordemNaFila` instead of its own copy of the key; `motivoDeFora` (:234-237) and
`motivoDaSaida` (:1031-1034) read `rejeicoesDosPedidos` instead of finding the first label.

`motivoSemODia`: a shallow copy of the state where every other request has `fly: false` and `fixos` is `{}`; the first
`err` of `motor(copia)`. "The day" is therefore `win`, `av`, the instructors' availability, the hours to the
inspection, the legal history and yesterday's Noturno return; other requests and every pin are out.

### 2.3 The flows

| Moment | Who | Steps | Saved | History |
|---|---|---|---|---|
| "Aprovar", "Registrar e aprovar", "Retirar a aprovação", "Cancelar" of a pedido of the open date (the handlers are D's; steps 2 to 6 are added to them in G) | Operador, Administrador | 1 the RPC; 2 the row it returns replaces the one in the open date's list (`pedidosDaData`, js/views/selos.js:36); 3 if `DATA` changed or `aindaNaoAbriu()`, stop (the difference shows when that date opens); 4 `diferencaDosPedidos(S, lista, { aprovada: pedidoAprovado, so: [id] })`; 5 `reconciliarPedidos`; 6 `gravarAlteracao` | the day, once | `inc` "Pedido aprovado: <aluno> entra na escala (<missão> · às HH:MM · N h[ · <código>])[ (escala aprovada)]"; `inc` "Pedido aprovado de novo: <aluno> volta à escala (…)"; `exc` "Pedido cancelado: <aluno> sai da escala (…)" or "Aprovação retirada: <aluno> sai da escala (…)". No revert |
| A cancellation of a pedido that is not approved (the Secretaria's case) | Secretaria, Operador, Administrador | the RPC only | nothing in the day | none, as today |
| The open date's pedidos are read: date open, opening the Pedidos or the Processamento stage, after any pedido action here, "Tentar de novo" | every profile | `lerPedidosDaData()`; `diferencaDosPedidos(S, lista, { aprovada })`; with `entram` or `saem` not empty and the date not before today, the notice | nothing | none |
| "Atualizar a escala" (`data-act="atualizar-pedidos"`) | Operador, Administrador (`aoAcionar` refuses the others and before the date opens) | reads the pedidos again; if the date changed meanwhile, nothing; the whole difference; `gravarAlteracao('inc', linhas de entrada)`, then `logChange('exc', …)` for each exit of the same save (the pattern of js/eventos/agendamento.js:38); with exits only, `gravarAlteracao('exc', linhas de saída)` | the day, once | one line per pedido, as above, with "(aprovado por <quem>)" when the row says who |
| The read of the pedidos fails | every profile | `lerPedidosDaData` keeps the failure instead of `[]` | nothing | none. Notice: "Não foi possível ler os pedidos desta data: a escala fica como está. · Tentar de novo" |

- Read-only profile: the same sentence, no button, plus "O operador atualiza a escala."; the schedule on screen is the
  stored one.
- Approved schedule ("Aprovar escala" done): a pedido that enters is placed around the pins, with no pin, as any request
  that arrives after the approval does today; one that leaves stops flying and its approval pin sleeps; `aprovacao`
  stays. The History line ends with "(escala aprovada)".
- Flight in progress, landed, cancelled by status, or with a result, whose pedido is cancelled: it stays in the
  schedule; the id stays in the list; Processamento shows "pedido cancelado · o voo fica (Pousou)". If the status later
  goes back to Confirmado or Pendente, it becomes "a sair".
- Two operators: the admission lives in the day document, so the second save gets PT409 and the screen locks until
  reload, as today; after the reload the difference shows what is still to apply. Nothing is admitted twice.
- The Secretaria: she cancels a pedido that is not approved at any time, with no effect on the day. She cannot cancel
  an approved one (posicao B3). If Pedro lets her, her browser writes nothing in the day (read-only): the operator sees
  "1 cancelado ainda na escala" at the next read and applies it.
- After the approval the toast says where the flight went: "Pedido aprovado: <aluno> na escala às 10:10 (PR-VOB)." or
  "Pedido aprovado: <aluno> não coube na escala (<motivo curto>)."

### 2.4 What the Processamento screen shows (step G; no input on it)

Left pane, the list: one row per row of `pedidosDoDia`, grouped by state. Row: status dot; initials; line 1 the
student; line 2 "<missão>[ · <código>] · HH:MM · N h", meta at the right the placed time or "fora"; line 3 the reason,
or "<recurso> · <instrutor>". Toolbar: `#flt-proc` (name, `chaveDeBusca`), `#flt-proc-estado` (several values),
`#flt-proc-cur` (the filter shared with Alunos), `#flt-proc-mis`. Count line `#proc-cnt`. The notice of 2.3 sits above
the list (`#proc-diferenca`).

| State | Condition | Line 3 | Where it is resolved |
|---|---|---|---|
| `nao-cabe` | flies, no row, `motivoSemODia` answers | "Não cabe nem com o dia vazio: <texto do motor>" | the table of codes below |
| `nao-coube` | flies, no row, fits alone | "Não coube na escala: <rejeição do motor>" | Escala: "Encaixar" or "Restrições do voo" |
| `na-escala` | row in `resultado.out` | "<recurso> · <instrutor>" plus "fixo", "em conflito" | Escala |
| `a-entrar`, `a-sair` | 2.1 | "Aprovado: ainda fora da escala" / "Cancelado: ainda na escala" (or "Sem aprovação: ainda na escala") | "Atualizar a escala" |
| `fica` | 2.1 | "Pedido cancelado · o voo fica (<status>)" | none |
| `tirado` | approved, admitted, `fly: false` | "Tirado da escala pelo operador" | Escala: "Pôr de volta na escala" |
| `aguardando`, `cancelado`, `sem-aluno` | the pedido's own state | "Aguardando aprovação" / "Cancelado por … em …" / "Aluno fora do cadastro" | Pedidos; Alunos |

Middle pane, the detail of the selected row, read-only, in this order: **Pedido** (missão, horário, duração,
registrado por, observação, exceção: read from the table, never copied to the day); **Missão do curso** (2.6);
**Preferências do aluno** (Priorizar com, Não escalar com); **O que a missão exige** (`descreverExigencias`);
**Recursos** and **INVAs** that could serve at the pedido's time, each with what stops it (`candidatosDoPedido`,
against the occupation of a day with no request: yesterday's Noturno return); **Na escala** (the row, or the reason);
**Restrições do operador** (`restricoesDoRegistro`, read-only) with the link "Abrir na Escala".

Reasons the module states by itself, outside the 21 codes: `aluno-inativo` (posicao B5: the engine never sees the
student, so there is no rejection); "o <tipo> não decola às HH:MM" beside `disponibilidade-do-aluno`, when the
pedido's minute is not in the bound resource's take-off list; "depende do Ground <missão> do mesmo dia"
(`doesGroundGateFlight`), a note, never a verdict; the course notices of 2.6.

| Engine code (before the engine, alone, or after it) | Short text (`FORA_DA_ESCALA`, moved to js/conflitos.js) | "Onde resolver" |
|---|---|---|
| `instrutor-escolhido` | o instrutor escolhido não serve | Escala › Restrições do voo › Instrutor |
| `disponibilidade-do-aluno`, `sem-horario` | fora da disponibilidade do aluno; sem horário aberto | Escala › Restrições do voo (Disponibilidade) or Encaixar; Recursos (horários da categoria) |
| `so-parafuso`, `sem-aviao`, `revisao`, `habilitacao-do-aviao` | sem o avião do Parafuso; sem avião disponível; sem saldo até a revisão; sem a habilitação própria do avião | Recursos (the resource); INVAs (habilitações) |
| `sem-instrutor-habilitado`, `instrutores-indisponiveis`, `limite-da-lei` | sem instrutor habilitado; sem instrutor disponível; o limite da lei | INVAs |
| `bloqueio`, `peso` | em Não escalar com; o peso acima do limite | Alunos |
| `ground-pendente`, `depois-do-ground`, `ground-antes-do-voo-fixo` | o Ground antes dele ficou fora; sem horário depois do Ground; sem horário antes do voo fixo | Escala (the student's Ground) |
| `aluno-ocupado`, `avioes-ocupados`, `sala-ocupada`, `instrutores-ocupados`, `limite-de-locais` | (exist only against other flights) | Escala › Encaixar |
| `equipamento-da-missao` | cannot be produced by the app's writers (lacuna-1-motivos 4.1) | none |

### 2.5 The Escala-stage panel "Restrições do voo" (step G)

One request at a time, opened by `data-act="restricoes"` (`data-id`, `data-mid`) from: each row of the Escala list and
the map popup `#tl-pop`; each item of the box "N missões não entraram na escala" (which also gets "Encaixar",
`data-act="agendar"` with the new context `p:<stuId>:<mid>` in `contextoInicial`, js/agendamento.js:78-104); the link
"Abrir na Escala" of Processamento. Element: `aside#painel-restricoes`, docked where the shell puts `#painel-reparo`;
body `div[data-k="d"][data-id][data-mid]`, so `aoMudarCampo('d', …)` and the `data-act` handlers of today's row work
unchanged; each change redraws the panel. Hidden for read-only profiles (`.edit-only`).

| Line (label) | Element | Stored field | Handler today | Note |
|---|---|---|---|---|
| Missão do curso | `span.etapa`, `button[data-act="usar-proxima"]`, `select[data-f="outra-missao"]`, `button[data-act="usar-fora-da-ordem"]` | `etapa`, `cursoDaEtapa` (and `mis`, `eq`, `nb` follow the program) | js/eventos/demanda.js:109-151; js/views/etapas.js:36-144 | the two confirmations as today; History "…: <código> na escala (…)" |
| Recurso (tipo) | `select[data-f="eq"]` | `eq` | :244-264 | releases the booked pin, removes the course mission, as today |
| Instrutor | `select[data-f="insId"]`, first option "Automático" or "Automático (prioriza …)" | `insId` | :203-212 → `escolherInstrutor` | "o app procura o horário e o avião com ele"; the name button of the Escala row keeps "fica onde está" |
| 1ª preferência, 2ª preferência | `select[data-f="p1"]`, `[data-f="p2"]` | `p1`, `p2` | :244, 265 | |
| Disponibilidade | `select[data-f="jan"]` | `jan` | :224-228 | the option the pedido asks is marked "(o pedido)" |
| Duração | `input.duracao[data-f="nb"]` (the fixed ones disabled) | `nb` | :231-249 | |
| Prioridade | `select[data-f="pr"]` | `pr` | :244 | |
| Tirar da escala / Pôr de volta na escala | `button[data-act="rm-fly"]` / `button[data-act="por-de-volta"]` (new) | `fly` | :184-194; the new one mirrors it with `setFly` | "Pôr de volta" only for a record whose id is in the list, or that has no pedido |

The Missão (type) is shown, not edited. The operator's routine, counted:

| What she does | Today | After |
|---|---|---|
| Put tomorrow's pedidos in the schedule | Agenda, then Demanda, "Importar N pedidos" (1 click, 1 screen change) | "Registrar e aprovar", or "Aprovar" in Pedidos: the flight is in the Escala (0 extra clicks) |
| A flight that did not fit at its minute | Demanda, find the row, change Disponibilidade or the two preferences, back to the Escala (1 to 2 changes, 2 screen changes) | Escala, on the rejection: "Encaixar", a free time, "Agendar" (3 clicks), or "Restrições", Disponibilidade (2) |
| Choose the instructor | Demanda (1) or the name in the Escala (2) | the name in the Escala (2) or the panel (2) |
| Change the priority | 1 select in the row | 2 (open the panel, select) |
| Take a student off | Voa or ✕ (1) | ✕ (1) |
| A pedido cancelled by the student | cancel in the Agenda (2) and remember to turn Voa off in the Demanda (1, another screen) | cancel in Pedidos (2): the flight leaves |
| A student with no pedido | "Pôr um aluno" (name, Enter), then the row's fields | "Registrar e aprovar" (one form) or "+ Agendar voo" |
| A second flight for a student | "+ missão" (1), then the row's fields | a second pedido (the form warns "já tem voo marcado": 1 more click) |
| Another mission of the course | "Outra missão…" in the row (1 to 2) | the panel (1), then the same (1 to 2) |
| Clear the date | Mais, "Limpar demanda", "Confirmar limpeza" (3) | no bulk action (question 8) |

### 2.6 The course mission

| Moment | Rule |
|---|---|
| Bound | when the record is created (`missaoDaEntrada`); by the operator in the panel (Usar, Outra missão…, the armed button); by a booking |
| Never | recomputed on a read, on a reconciliation of a record that exists, or when a result is registered |
| Shown in Processamento, `missao.situacao` | `sem-programa` (no course, no program, or results unread); `sem-missao` (nothing bound: "Próxima do programa: <código>" when one exists, or "nenhuma liberada é do tipo <missão>"); `em-ordem`; `com-resultado` (this flight's own result: the result is shown, nothing is suggested); `ja-aprovada` (approved by another flight); `fora-da-ordem` ("falta PE-03 (reprovada em 14/11)", `motivoDoBloqueio`); `codigo-desconhecido` (renamed or retired after binding); `curso-encerrado`. Computed by `missaoNoHorario` with the student's other flights that end before this one counted as planned, as the booking dialog does (js/agendamento.js:212-220, 241-255) |
| Closed course | at entry: no course mission, `semMissao: 'curso-encerrado'`; the operator binds it in the panel with "Usar <código> do curso encerrado" → "Confirmar: <código> do curso encerrado" (unchanged) |
| Out of order | never bound at entry (only released missions are candidates, as today); by the operator, with the armed button and the reason in the History (unchanged) |
| AV PROF. SOLO and SOLO on one date | the rule is today's: the student's other flying records of the day count as done whatever their time. What changes is the order: pedidos that enter together are bound in the order of their times, not of their registration. A 06:30 solo and a 08:20 local flight entering together: the solo gets no course mission (the next released one, `AVP-SOLO-01`, is not of its type) and 08:20 gets `AVP-SOLO-01`, whichever was registered first (today the result depends on that, lacuna-2 2.4). Entering one at a time, the local one first: 08:20 gets `AVP-SOLO-01` and the solo then gets `SOLO-01`, as today; Processamento shows `fora-da-ordem` on the 06:30 flight, because `missaoNoHorario` counts only what ends before it |
| The code lock of the Cursos tab | `codigosDaDemanda` (js/views/cursos.js:56-68) keeps reading the open date's records and `RES.out`; only its text changes ("nos voos de <data>" for "na Demanda de <data>"). A record that does not fly keeps locking its code, as today. The gap of docs/PLAN.md:431 (a code that only another date's records carry) stays as recorded |

### 2.7 Every site that writes a request field today (the sixteen of mapa-demanda 5.6)

| # | Site | After |
|---|---|---|
| 1 | js/eventos/demanda.js:41 "Pôr um aluno" (`fly = true`) | removed at G; "Pôr de volta na escala" covers a record that exists |
| 2 | :94-99 `usarMissaoDoCurso` | kept; moves with its three triggers to js/eventos/restricoes.js; still releases the booked pin (`soltarAgendado`, :25-30) |
| 3 | :153-182 push and remove an extra | removed at G; `extra[]` is written only by `alvoDoNovoPedido` and `desfazerAgendamento` |
| 4 | :184-194 `rm-fly` | kept |
| 5 | :197-273 the field handler | kept for `insId`, `jan`, `eq`, `nb`, `p1`, `p2`, `pr`, `outra-missao`; the branches `fly` (with the cascade to the extras, :213-223) and `mis` are deleted |
| 6 | js/fixos.js:95-117 `limparDemanda` | deleted at G with its 7 unit tests |
| 7 | js/rules.js `deixarEmBranco`, `alvoDoNovoPedido`, `normalizeMissionFields` | kept; one guard (decision 4) |
| 8 | js/agenda.js:107-140 `importarSolicitacoes` | replaced by `reconciliarPedidos` (E) |
| 9 | js/agendamento.js:899-943 `aplicarAgendamento` | unchanged |
| 10 | js/instrutor-escolhido.js:104-109, 140-145, 165-172, 177-183 | unchanged |
| 11 | js/eventos/escala.js:177-186, 283-285 | unchanged |
| 12 | js/reversoes.js:165-191 `desfazerAgendamento` | unchanged; two refusal texts stop naming the Demanda (:141-142) |
| 13 | js/eventos/historico.js:53-61, 96-106 (`setFly`, `restaurarHorarios`) | unchanged |
| 14 | js/eventos/recursos.js `salvarHorarios` (the take-off times editor adjusts `p1`, `p2`, `jan` of the category's records and stores them in its revert) | unchanged; it keeps looping over records that do not fly, as today |
| 15 | js/eventos/cadastros.js:84-90, 123, 128 | unchanged |
| 16 | js/storage.js:149-171, js/dias.js:96-101, 121, js/migracoes.js:21-35 | unchanged, plus decision 24 in `juntar` |

The nine History revert kinds all keep their payloads, their validation and their apply code, because what they
address is where it was: `setFly` (also for old entries with `extras`), `setAv`, `setAtributo`, `setInsOn`,
`restaurarFixos`, `restaurarEscolha`, `restaurarHorarios`, `readicionarRecurso`, `desfazerAgendamento`. Entries stored
before the change keep their buttons.

### 2.8 What docs/PLAN.md records as open and this design restates

| PLAN.md | After |
|---|---|
| :421 "a booking creates no Agenda request" | kept (decision 14) |
| :421 a mission asked for a later date is still suggested today | now true of every admitted pedido; kept as recorded (question 11) |
| :422 a booked flight whose mission changes is released | kept, in the panel's handlers only; the reconciliation never changes `mis`, `eq` or `nb` of a record, so nothing is released on a read |
| :371, :397, :424 the confirmation of a closed course or of an out-of-order mission "in Demanda" | moves to the panel with its texts; the import half is decided: no course mission at entry |
| :425 Mover and Encaixar; :430, :435 the undo and revert fallbacks | stand as written: the record keeps what the booking wrote, and "a request that does not fly" is still one state of the record |
| :404, :431 the code lock "while the open date's Demanda carries it" | same reader, new text |
| :437 "Limpar demanda" also releases the flights it blanks (decided 2026-11-19) | reversed: the control is removed. Not in the request's list of reversed decisions |
| :418 AV PROF. SOLO before each SOLO; :417 the syllabus mapping | carried as rules of `missaoDaEntrada` (2.6); a pedido whose type the mapping never matches enters with `semMissao: 'sem-missao-do-tipo'`, which the pipeline row must not count as "needs attention" |

### 2.9 Requests that have no pedido

| Today | What it becomes | What it writes | Undo |
|---|---|---|---|
| "+ Agendar voo" (the six entry points of `#dlg-agendar`) | unchanged: the second origin of a record | `aplicarAgendamento`, js/agendamento.js:899-943: a record with no `solicitacao` (the main request when it is free and carries no pedido, else a new extra), the pin with `agendado`, the typed weights, "Marcar disponível" | `desfazerAgendamento`, unchanged |
| Mover, Encaixar | unchanged, on a record of any origin; "Encaixar" also opens straight from a rejection (`p:<stuId>:<mid>`) | `fly: true, eq, nb, p1, p2: -1, insId` on the same record, a `jan` that excludes the new time deleted, the pin; `mis`, the course mission, `solicitacao` and `pr` stay | unchanged: the record comes back as it was. Its guard compares the record with `criadoComo` (js/reversoes.js:121-125, 142); the reconciliation cannot break it, since it never rebuilds a record (a change the operator makes in the panel still refuses the undo, as today) |
| "+ missão" | removed: a second pedido, or a booking | | |
| "+ Pôr um aluno na demanda…" | removed: "Registrar e aprovar" (the Operador has the Exceção da Coordenação past the deadline), or a booking | | |
| Hand-made requests stored before G | stay, fly, take restrictions and "Tirar da escala"; a pedido of the same mission type takes the place of one that has no pin, no pinning status and no result, as the import does today | | |

### 2.10 Between D, E and G

| After | The Demanda's "Importar da agenda" | A pedido cancelled or un-approved after its import | `importadas` |
|---|---|---|---|
| D | today's function, only over approved pedidos | stays in the Demanda (today's gap); D's toast says so | ids only enter |
| E (stacked on D; if E is ready first, its default predicate keeps today's "every pedido that is not cancelled" and D switches it) | `reconciliarPedidos` with the entries whose id is not in the list: today's result, held by the same 21 tests, except four deliberate differences: the main request that carries a pedido is not reused (decision 4); a closed course gets no course mission and pedidos of one student are bound in the order of their times (decision 15); the flight that gives way keeps its `pr` (decision 16) | the same | ids only enter |
| G | the button is gone; approvals enter at once, the rest by "Atualizar a escala" | leaves the schedule | ids enter and leave; format 28 |

## 3. Where each existing control goes (a table: control today (label, id or data attribute) | destination (stage, screen, pane) | kept, moved, replaced by or removed). Only for the screens your topic owns; write 'not applicable' otherwise.

The Demanda screen (`#s-dem`, index.html:299-341) and the two import buttons. The other controls of mapa-restricoes
section 3 (status, Aprovar, Reabrir, Sugestões, the three dialogs) are not this topic's screens: kept where they are.

| Control today | Destination | Kept, moved, replaced or removed |
|---|---|---|
| Tab "Demanda", `button[data-t="dem"]` | the pipeline card "Processamento", which opens `#s-proc` | replaced |
| "Importar da agenda" / "Importar N pedido(s) da agenda", `#importar-agenda` | Processamento, above the list: `#proc-diferenca` with "Atualizar a escala" (`data-act="atualizar-pedidos"`); not needed after an approval made here | replaced |
| "Importar N pedido(s) para a demanda", `#agenda-importar` (Agenda) | none | removed |
| "+ Pôr um aluno na demanda…", `#incluir-aluno`, `#alunos-fora` | Pedidos: "Registrar e aprovar"; Escala: "+ Agendar voo" | removed |
| "Só quem voa", `#onlyfly` | Processamento, list pane: `#flt-proc-estado` | replaced |
| "Buscar na demanda…", `#flt-dem` | Processamento, list pane: `#flt-proc` | moved |
| "Todos os cursos", `#flt-dem-cur`, `#flt-dem-cur-painel` | Processamento, list pane: `#flt-proc-cur` | moved |
| "Todas as missões", `#flt-dem-mis` | Processamento, list pane: `#flt-proc-mis` | moved |
| "Mais", `#btn-mais-dem`, `#menu-mais-dem` | none (its only item goes) | removed |
| "Limpar demanda" → "Confirmar limpeza", `#clr` | none | removed |
| Count "N / M aluno(s) · K missão(ões) marcada(s)", `#cnt` | Processamento: `#proc-cnt` "N na escala · N não cabem · N aguardando aprovação" | replaced |
| Column "?" buttons, `button.dica-btn[data-dica="voa" \| "instrutor-escolhido" \| "preferencias" \| "disponibilidade" \| "duracao" \| "prioridade"]` | beside the labels of "Restrições do voo"; "voa" becomes the hint of "Tirar da escala" | moved |
| The row, `tr[data-k="d"][data-id][data-mid]` | a read-only row of the Processamento list; the body of `#painel-restricoes`, `div[data-k="d"]` | replaced |
| Student name, course mission code (`span.etapa`) | Processamento: list row and detail "Missão do curso"; header of the panel | moved |
| "Próxima: <rótulo> · Usar", `button[data-act="usar-proxima"]` | Escala › Restrições do voo › Missão do curso | moved |
| "Outra missão…", `select[data-f="outra-missao"]` | same line | moved |
| "Usar <código> fora da ordem" / "… do curso encerrado", `button[data-act="usar-fora-da-ordem"]` | same line | moved |
| "agendado HH:MM · <recurso>", `span.tag[data-dica="voo-agendado"]` | Processamento row and detail ("Agendado na Escala"); header of the panel | moved |
| "+ missão", `button[data-act="add-mis"]` | none: a second pedido | removed |
| "↳ missão extra" and "✕" → "Confirmar", `button[data-act="del-mis"]` | none | removed |
| Voa, `input.sw[data-f="fly"]` | derived at entry from the approval; by hand: "Tirar da escala" (`data-act="rm-fly"`) and "Pôr de volta na escala" (`data-act="por-de-volta"`) in the Escala | replaced |
| Missão, `select[data-f="mis"]` | Pedidos: the form's "Fase / missão"; shown read-only elsewhere | removed as an input |
| Recurso, `select[data-f="eq"]` | Escala › Restrições do voo | moved |
| Instrutor, `select[data-f="insId"]` | Escala › Restrições do voo | moved |
| 1ª preferência, 2ª preferência, `select[data-f="p1"]`, `[data-f="p2"]` | Escala › Restrições do voo | moved |
| Disponibilidade, `select[data-f="jan"]` | Escala › Restrições do voo | moved |
| Duração, `input.duracao[data-f="nb"]` | Escala › Restrições do voo | moved |
| Prioridade, `select[data-f="pr"]` | Escala › Restrições do voo | moved |
| "Nenhum aluno com esses filtros." and "Limpar filtros", `#limpar-filtros-dem` | the empty state of the list component | replaced |
| "Nenhum aluno cadastrado. Cadastre os alunos na aba Alunos.", `tr.empty-dem` | "Nenhum pedido para esta data." with a link to Pedidos | replaced |
| "Abrir a Demanda" (Alunos), `button[data-go="dem"]` in `p.ir-para-demanda` | none | removed |
| "✕" Tirar da escala (Escala list) and "✕ Excluir da escala" (map popup), `button[data-act="rm-fly"]` | where they are | kept |
| Items of "N missões não entraram na escala" (js/views/escala.js:466-469) | each gets "Encaixar" (`data-act="agendar"`, `data-agendar="p:<stuId>:<mid>"`) and "Restrições" (`data-act="restricoes"`) | kept, two new entries |

## 4. Data-format steps and migrations (the number or the migration file name, what changes, the conversion, its tests, the deploy order)

| Item | What changes | Conversion | Tests | Deploy order |
|---|---|---|---|---|
| Steps F to E | nothing of this topic is stored differently; E needs no number | none | none | none |
| **Format 28**, step G, js/migracoes.js | no data: from this version an id can leave `importadas`, and a tab of the version before would import that pedido again as a second record | `28: { cadastro: c => c, dia: d => d }`, with the comment saying which behaviour the number protects | test/unit/migracoes.test.js: a day at 27 comes out equal with `esquema: 28`, an unknown field survives, `{ importado: true }` and `{ simulado: true }` untouched | merged after C's 27 (numbers in merge order); the first Operador opening rewrites every stored day once, as every number does |
| D's approval migration (owned by the Pedidos design); this topic needs one clause in it | the pedidos already imported are marked approved **only when a record of that date still carries their id** | `update solicitacoes s set aprovada_em = now(), aprovada_por = 'importado antes da aprovação' from dias d where d.data = s.data and s.cancelada_em is null and s.aprovada_em is null and d.conteudo -> 'importadas' @> to_jsonb(s.id) and (jsonb_path_exists(d.conteudo, '$.pedidos.*.solicitacao ? (@ == $id)', jsonb_build_object('id', s.id)) or jsonb_path_exists(d.conteudo, '$.pedidos.*.extra[*].solicitacao ? (@ == $id)', jsonb_build_object('id', s.id)))` (a sketch: to be checked on the preview) | pgTAP: imported and bound becomes approved; imported and then cleared ("Limpar demanda") stays waiting; cancelled stays cancelled; a pedido of another date is not touched | preview, then production, before D's merge |
| `supabase/migrations/<carimbo depois do de D>_importados_ja_aprovados.sql`, step G | the same statement again, idempotent | covers the pedidos imported by the old client between D's migration and D's merge | `supabase/tests/database/importados-ja-aprovados.test.sql` (the four cases above, run twice) | preview, then production, before G's merge. Between this migration and G's merge the client in the air imports only approved pedidos, so no new id can be admitted unapproved |
| Local mode | `acpm4_agenda` rows get `aprovada_em` by the same rule, once, in D's local mirror (a marker key, since D has no format number) | js/backends/local.js | test/unit/backend-local.test.js | with D |

What needs no conversion, and why:

| Stored data | After the cut-over |
|---|---|
| Days of past and future dates | read as they are. Records with `solicitacao` are the pedidos' records; ids in `importadas` are the admitted ones |
| A record with `solicitacao`, `fly: false` (Voa turned off before) | "tirado da escala pelo operador": approved, admitted, not flying. It does not come back |
| An id in `importadas` with no record (after "Limpar demanda" or the "✕" of an imported extra) | not approved by the clause above, so "aguardando aprovação"; the id is dropped with the next write of that date; if the operator approves it, it enters again. One cleared between D and G is already approved: on a date from today on, the notice offers it back ("1 pedido aprovado fora da escala") |
| A pedido cancelled after its import, still flying (today's gap) | on a date from today on: "1 cancelado ainda na escala · Atualizar a escala". On a past date: shown in Processamento only, no notice |
| Hand-made requests (no `solicitacao`) | stay and keep flying; never touched by the reconciliation; listed in Processamento under "Sem pedido"; "Tirar da escala" and the restrictions work on them |
| Stored History reverts | all nine kinds stay valid |
| A tab still open on the version before G | its next save is refused (PT409, hint `formato`) and it asks for a reload |
| Local mode | same code; no version check (two tabs overwrite each other, as today); ids of 13 digits are only `solicitacao` values |

## 5. Files created, changed and deleted, by step (the step names are F0, F1, F2, F3, A, B, C, D, E, G, H, I as in posicao.md and the request)

| Step | Created | Changed | Deleted |
|---|---|---|---|
| F0, F1, F2, F3 | none | none of this topic (it uses F0's redraw registry and `body[data-pronto]`, F1's panes, F2's list) | none |
| A, B, C | none | none (B: `salvarHorarios` keeps adjusting the records) | none |
| D (owned by the Pedidos design; what this topic needs from it) | none | the approval migration with the clause of section 4; js/agenda.js: `export const pedidoAprovado = s => !s.cancelada_em && Boolean(s.aprovada_em)`; js/eventos/agenda.js: the import takes only approved pedidos (before E: the filter at :48; after E: `{ aprovada: pedidoAprovado }`); when an approval is withdrawn or an approved pedido is cancelled while its record flies, the toast says the flight is still in the Demanda (until G); js/backends/local.js and the two fakes | none |
| E | js/processamento.js; test/unit/processamento.test.js | js/agenda.js (loses `importarSolicitacoes`, `pedidoDaSolicitacao`, `vooQueDaLugar` and the imports only they use); js/eventos/agenda.js (`importarDaAgenda`: `diferencaDosPedidos`, entries whose id is not in `S.importadas`, `reconciliarPedidos`, the toast names what `motivoSemODia` refuses); js/views/selos.js (`pedidosPendentes` counts the same entries); js/agendamento.js (`naOrdemDoMotor` uses `ordemNaFila`; `motivoDeFora` and `motivoDaSaida` use `rejeicoesDosPedidos`); js/rules.js (the guard); js/dias.js (`juntar`); README "Estrutura" | nothing else |
| G | js/views/processamento.js; js/eventos/processamento.js ("Atualizar a escala", the hook the Pedidos handlers call after an RPC); js/views/restricoes.js and js/eventos/restricoes.js (from the row view and the handlers that stay); css/processamento.css; test/e2e/processamento.spec.js; test/e2e/restricoes.spec.js; the migration and the pgTAP file of section 4 | index.html (`#s-dem` out; `#s-proc` and `#painel-restricoes` in); js/migracoes.js (28); js/processamento.js (the four exports of 2.2); js/agendamento.js (`missoesNoDia` and `missaoDoPedido` move out; the context `p:`; texts that name the Demanda); js/conflitos.js (`FORA_DA_ESCALA` and the "onde resolver" table); js/fixos.js (`limparDemanda` out); js/views/etapas.js (`etapaNaDemanda` becomes the panel's line; History texts); js/views/escala.js (the buttons on rows and on rejections); js/views/cursos.js and js/eventos/cursos.js (the lock's text); js/reversoes.js (two texts); js/eventos/agenda.js (reconcile after each RPC; the import buttons out); js/views/selos.js; js/views/agenda.js ("Na demanda" / "Ainda não importado" become the states of 2.4); js/glossario.js, js/manual.js, README | js/views/demanda.js; js/eventos/demanda.js; test/e2e/demanda.spec.js; the Demanda's CSS |
| H | none | the pipeline adapter reads `diferencaDosPedidos` and the states of `pedidosDoDia` (rows: "aprovados fora da escala", "não cabem nem com o dia vazio" under Processamento; "não couberam na escala" under Escala) | none |
| I | none | the sweep of texts that still say "Demanda" in entries and hints | none |

## 6. Tests (what is written first; which existing tests change, with file names and rough counts)

Written first, step E, test/unit/processamento.test.js (about 55 tests):

| Describe | Tests |
|---|---|
| "A diferença entre os pedidos e o dia" (about 14) | each line of the table in 2.1; `so`; the order of `entram`; an id with no row read is not an exit; results unread hold every exit; the default predicate (before D every pedido that is not cancelled counts as approved) |
| "Reconciliar os pedidos" (about 33) | the 21 tests of "Importar as solicitações da agenda para a demanda" (test/unit/agenda.test.js:89-334), moved with the function; plus: the same record turns on again with the same `mid`, pin, `insId` and `pr`; leaving changes only `fly` and the list; a record without `solicitacao` is never touched; a field written by a booking survives (the case run in lacuna-1-pedido-principal §5); the main request that carries a pedido is not reused; the flight that gives way keeps `pr`; a closed course enters without the course mission; two pedidos of one student enter in the order of their times; applying twice changes nothing; the contract (mids are positive integers up to 999,999 and unique per student, one record per `solicitacao`, no key outside `CAMPOS_DO_PEDIDO` and `mid`); 300 generated sequences of events keep those invariants |
| "A rejeição de cada pedido" (about 5) | generated days with and without pins: every rejection pairs with its request; two extras of one student with the same mission get their own reasons; a schedule that no longer matches the state pairs only the unique labels |
| "Não cabe nem com o dia vazio" (about 4) | equals the engine with the request alone; other requests' pins and the request's own pin do not count; yesterday's Noturno return counts; over the generators, nothing refused alone is placed in the day |

Existing tests that change:

| Step | File | Change |
|---|---|---|
| E | test/unit/agenda.test.js (31 tests) | 23 move out to processamento.test.js (the import describe and the two of `pedidoDaSolicitacao`); one of them, "o pedido principal que recebe o pedido da agenda começa em branco", is rewritten for the guard (the pedido becomes an extra; the record of pedido 99 stays) |
| E | test/unit/rules.test.js | "o pedido principal, quando o aluno não voa…" rewritten (reused without `solicitacao`, kept with it); 2 added |
| E | test/unit/atributos.test.js:167-169, test/unit/instrutor-escolhido.test.js:266, test/unit/progresso.test.js:540 | the import call becomes the module's (3 tests) |
| E | test/unit/dias.test.js | 2 added (`juntar` ignores roster keys in a stored main request; the extras the module writes hold no name) |
| E | test/unit/agendamento.test.js | 1 added (two rejections with the same label: each "Encaixar" shows its own reason) |
| E | e2e | none expected to change: agenda.spec.js:152, :177, demanda.spec.js:55, selos.spec.js:51, agenda-compartilhado.spec.js:104, abertura.spec.js:78 guard the unchanged behaviour |
| G | test/unit/fixos.test.js | the describe "Limpar demanda" (7 tests) deleted |
| G | test/unit/migracoes.test.js; test/unit/config-do-painel.test.js:127 (`assert.equal(ESQUEMA, 25)`, touched by the first step that raises the number) | 3 added |
| G | test/unit/processamento.test.js | about 20 added (`pedidosDoDia` states, `restricoesDoRegistro`, `missaoNoHorario` situations, `candidatosDoPedido`) |
| G | test/unit/reversoes.test.js:324, test/unit/agendamento.test.js | texts; the context `p:` (2 added) |
| G | test/e2e/demanda.spec.js (23 tests) | deleted; about 10 return in restricoes.spec.js against the panel (availability, duration, times per category, the six of "Voo agendado na Escala", the mission change through "Outra missão…"); 8 go with their controls ("Pôr um aluno" 2, "+ Missão" 1, "Limpar demanda" 2, the Voa cascade 1, the 10 columns 1, the Missão select 1); the 5 filter tests return in processamento.spec.js |
| G | test/e2e/cursos-no-dia.spec.js (9), test/e2e/instrutor-escolhido.spec.js (the 2 "na Demanda") | retargeted to the panel |
| G | test/e2e/processamento.spec.js (new, about 12) | each state of 2.4; approve and see the flight; cancel and see it leave; the notice and "Atualizar a escala"; the Gestor sees the sentence without the button; an approved schedule; a landed flight stays; two operators on the fake server; the failed read |
| G | the 33 lines in 11 spec files that tick `data-f="fly"`, and the 71 `irPara(page, 'dem')` | a fixture helper that seeds the day with flying records (the e2e already seed `acpm3` states with requests that fly: those keep working, as stored hand-made requests do) |
| G | test/e2e/agenda.spec.js, agenda-compartilhado.spec.js, selos.spec.js, perfis.spec.js | the import buttons and the badge text |

## 7. Departures from Pedro's request (a table: what the request says | what this design does | why | what Pedro can choose instead)

| The request says | This design does | Why | Pedro can choose instead |
|---|---|---|---|
| Processamento is "an aggregation and enrichment stage with no data of its own" | The stage has no input and stores nothing typed into it; the day keeps one record per admitted pedido (its flight key, the course mission bound at entry, the operator's restrictions) and the list of admitted ids | pins, statuses, results and five revert kinds hang on `(stuId, mid)`; a booking writes on the request | A day that stores no request: a new per-date store keyed by pedido, every writer and five revert kinds rewritten, stored days re-keyed |
| "Input: the approved pedidos of the date" | Also the flights booked in the Escala and the hand-made requests already stored | "+ Agendar voo" exists and creates no pedido (docs/PLAN.md:421); the request itself lists it as an operator restriction | Every booking registers an approved pedido (a server path for the deadline, the Sunday and the 7th local flight) |
| "Demanda will consume approved pedidos" | An approval made here enters at once; a change made elsewhere is shown and applied with one click | a read must not write; `solicitacoes` has no version | Apply automatically when an Operador opens the date |
| Operator restrictions "exist: fixed flights, the chosen instructor, '+ Agendar voo'" | Six more are kept as restrictions of the Escala stage: priority, resource type, duration, time, another course mission, "Tirar da escala" | they have no other source and the engine reads them on the request | Drop some of them (priority, resource type) |
| The screen "shows … why any of them cannot be scheduled" | Before the engine only "não cabe nem com o dia vazio"; what lost to other flights is the engine's rejection, shown after it and resolved in the Escala | 11 of the 21 reasons exist only against other flights | One reason text for both |
| "For every column … a field of the pedido, something derived, or an operator restriction" | 1ª and 2ª preferência and Disponibilidade are derived from the pedido's one time and changed only as restrictions; the pedido gains no column | decision 17 | The two columns of posicao B2 |
| "E. The Processamento module and its tests (no UI)" | No new screen, but E changes two texts (the import toast names a pedido that cannot fit alone; the booking dialog's "ficou fora: …" is always the request's own reason) and four small rules of the import (2.10) | the module must be in real use for the lint, and its rules are the ones G will run | Keep today's texts and rules in E, and change them in G |
| "Decisions this reverses" lists three | A fourth is reversed: "Limpar demanda" (docs/PLAN.md:437); and "Pôr um aluno na demanda", "+ missão" and the Missão select of the row end | decision 13 | Keep a bulk action in the Escala (question 8) |
| Pipeline row "missão definida pelo programa" | Defined when the record is created and not recomputed; three notices can leave it undefined (closed course, no released mission of the asked type, program or results unread) | decision 15 | Time-aware binding, or re-binding of flights with no pin and no result |

Where each of the ten columns lives afterwards:

| Column | Afterwards | Kind |
|---|---|---|
| Aluno (name, course code, "Usar", "Outra missão…", "+ missão", the booked tag, the "✕" of an extra) | the pedido's `aluno`; the code is `etapa` + `cursoDaEtapa`, bound at entry; another mission is a restriction; "+ missão" is a second pedido; the tag shows on the flight; the "✕" goes | pedido field; derived; restriction |
| Voa | `fly: true` when the pedido is admitted; off by "Tirar da escala" | derived; restriction |
| Missão | `missao` of the pedido, copied to `mis` at entry | pedido field |
| Recurso (the type) | the program's `eq`, else the mission's default, at entry; another type in the panel | derived; restriction |
| Instrutor | `insId` | restriction |
| 1ª preferência, 2ª preferência | both the pedido's `horario` at entry; changed in the panel or by Mover and Encaixar | derived; restriction |
| Disponibilidade | `jan = 'h<minuto>'` from the pedido's `horario`; loosened in the panel | derived; restriction |
| Duração | the pedido's `horas` (the fixed ones and the program's as today); another in the panel | pedido field; restriction |
| Prioridade | `pr`, 3 at entry | restriction |

## 8. Questions for Pedro, each with the default this design implements

| # | Question | Default |
|---|---|---|
| 1 | May the day keep one record per admitted pedido (flight key, course mission, restrictions), with Processamento itself having no input? | Yes |
| 2 | "Tirar da escala" on a flight born from a pedido: a restriction of the date, the pedido stays approved; or withdrawing the approval? | A restriction of the date |
| 3 | When a pedido is cancelled or loses its approval, does the flight keep its place asleep (it returns there if approved again) or is the place released? | Kept asleep |
| 4 | Which flights stay when their pedido is cancelled: those in progress or landed only, or also the ones cancelled by status and the ones with a result? | All four statuses and any flight with a result |
| 5 | A change made in another browser: shown, one click to apply; or applied when an Operador opens the date? | Shown, one click |
| 6 | Does the pedido stay one exact time, with the looser time as an operator restriction? | Yes; no new column |
| 7 | May the mission type be changed in the Escala, or only by cancelling and registering another pedido? | Only through the pedido (or another course mission) |
| 8 | "Limpar demanda": removed with nothing in its place, or a bulk "Soltar os voos fixos e reabrir" in the Escala? | Removed |
| 9 | A pedido of a student in a closed course (docs/PLAN.md:424): enters without the course mission, and the operator confirms it in the Escala? | Yes |
| 10 | AV PROF. SOLO and SOLO on one date (docs/PLAN.md:418): bind as the import does today and flag the pair, or count only the flights that end earlier when binding? | As today, flagged |
| 11 | A mission asked for a later date is still suggested today (docs/PLAN.md:421)? | Yes, only the same day counts |
| 12 | A pedido that cannot fit even alone: still sent to the engine and counted in "missões pedidas" and in the BI? | Yes |
| 13 | On a date before today, should a cancelled pedido that is still in that schedule raise a notice? | No; it shows in Processamento only |
| 14 | Approving a pedido for a student who already has a booked flight of the same mission: warn and create another flight, or attach the pedido to the booked flight? | Warn and create another |
| 15 | Who reads Processamento: the Gestor, as the Demanda today; the Secretaria, who has no Demanda today? | Gestor yes; Secretaria no |
| 16 | May rejections gain `stuId` and `fKey` in a commit that changes 174 golden alerts and no rule? | No; they are matched by position |
| 17 | The pedido that takes the place of a hand-made flight keeps that flight's priority (today it goes back to 3)? | Keeps it |

## 9. Risks, and what would make this design wrong

| Risk | Effect | What contains it |
|---|---|---|
| Pedro wants the day to store nothing about requests | the whole design is the wrong one | question 1, first |
| D makes a pedido editable (time, mission) after approval | the record created at entry no longer matches the pedido, silently | treat an edit as cancel plus register (a new id), or add a "pedido mudou" state to `pedidosDoDia`; to be settled with D |
| The engine's queue order changes and `ordemNaFila` does not | reasons paired with the wrong request | the test over generated days fails at once; the label check stops a wrong pairing at run time |
| A pin that slept wakes on a slot booked meanwhile | the booked flight shows a conflict | visible, with Sugestões; it is today's behaviour of "Voa"; question 3 offers the release |
| Two notions of "off" (taken off by the operator; pedido not approved) | confusion on screen | two states with their own texts (2.4); one stored fact each (`fly` with the id in the list; the id out of the list) |
| Records are never deleted | a date keeps the off records of cancelled pedidos; the take-off times editor lists them in its revert (limit of 500, js/reversoes.js:84), as it lists every student's blank request today; a record that does not fly still locks its course code while its date is open | a handful per date; same as "Voa" off today |
| The interim between D and G | a pedido cancelled or un-approved after its import keeps flying until someone turns Voa off (today's gap) | D's toast says so; it lasts from D's merge to G's; G closes it |
| The read of the pedidos is still a separate, unversioned read | a change made elsewhere is seen only at the next read (no polling, docs/PLAN.md:132) | reads on date open, on opening Pedidos or Processamento, after every pedido action; the difference never applies by itself |
| The History's read of 200 entries per date (js/backends/supabase.js:169-175) | one line per admitted pedido, as the import writes today; a busy date reaches 200 as soon as it does today, and `agendamentosEmVolta` then misses older bookings | unchanged volume; carried with docs/PLAN.md:435 |
| A stored extra with a `mid` close to 999,999 (written outside the app) | the next slot would not reach the reception TV | theoretical: `proximoMid` grows by one per new flight of a student |
| The SQL of the backfill reads inside `dias.conteudo` | a wrong path marks nothing or too much | pgTAP on the preview with a seeded day; the statement only sets `aprovada_em` where it is null |

What would make it wrong, in one line each: a requirement that the day hold no request; editable pedidos; a need for
schedules that follow the pedidos without anyone with write access opening the date; a rule that a flight's key must
come from the pedido id.

<!-- fim -->
