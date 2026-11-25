# Desenho: The core data flow: from approved pedidos to the engine input, and the operator restrictions

Architect C. Lens: the operator's day and the data already in production. Read at the worktree
`~/ACPM/.redesenho/wt-plano` (`linha-0-plano`, 48875e3); paths are relative to it. Nothing in it
was changed. "(ran)" = run with `node`, read-only, from a scratch folder outside the repo, with fictitious names only.
Words: *pedido* = a row of `solicitacoes`; *request* = the day's record (`dia.pedidos`, `S.stu[]` and `extra[]`);
*voo* = one request seen as a flight, key `fKey = <stuId>_<mid>_1`.

Three runs this note rests on (ran; the scripts are `parear.mjs`, `alvo.mjs` and `turma.mjs` in the session scratch
folder `/private/tmp/claude-501/-Users-pedrofernandes-ACPM/5d1f0955-e20a-47d4-acd8-3ee432e7a836/scratchpad/nucleo-c/`,
which a cleanup may remove; the first one becomes the invariant test of section 6):
- **Rejections paired without touching the engine.** Flying requests that are not in `out`, sorted with the existing
  `naOrdemDoMotor` (js/agendamento.js:132-155), against the `err` alerts in the order the engine emits them: 1,201
  days (the example, and 400 seeds of `gerarCenario`, `comEscolhas`, `comVolta(comAtributos(comEscolhas))`), 6,618
  rejections, 0 with a different count, 0 with a different label; 62 of them share their label with another rejection
  of the same day (the cases a text match gets wrong).
- **A request taken off the schedule loses its pedido today.** A pedido imported on the main request, then "Voa" off,
  then a second pedido of the same student imported: the second overwrites the first (`solicitacao: 8`, `extra: []`),
  and pedido 7 stays in `importadas`, so it never comes back (`alvoDoNovoPedido`, js/rules.js:95-100).
- **Numbers are reused only when nothing is left.** `proximoMid` gives 1 again after extra 1 left without leftovers,
  and 2 when the day still keeps a pin of `<id>_1_1` (js/rules.js:54-72). A pinned Ground class that loses one
  student keeps the other two, with no conflict.

## 1. Decisions (numbered; for each: the decision, why, the evidence as a map section or path:line, and the alternative rejected with the reason)

1. **The day keeps `dia.pedidos` in today's shape. A pedido is tied to its voo by the request's own field
   `solicitacao` (stored since the import exists), and keeps the `(stuId, mid)` it received when it entered the date.**
   - Why: pins, statuses, details, saved rows, results on the server (append-only), the D+1 Noturno and five revert
     kinds address a voo by `(stuId, mid)`. Keeping the stored shape re-keys nothing, on any date.
   - Evidence: posicao.md A1, A2; mapa-restricoes 2.5; js/dias.js:22, 59-62; lacuna-1-pedido-principal 0 and 5.
   - Rejected: (a) derive the requests when a date opens, with a per-date restriction store keyed by pedido
     (mapa-demanda S2): every writer of 2.9 and five revert kinds are rewritten, a read would have to finish before
     `setS`, and a failed read could save a schedule built from zero pedidos (mapa-dados 5.8). (b) the pedido id as
     `mid` (S3): local ids have 13 digits, `painel_do_dia` accepts 6, the saved-schedule validator 1e9
     (supabase/migrations/20261120150000_painel_do_dia_com_a_configuracao.sql:20; js/escala-gravada.js:37;
     js/backends/local.js:46), and `proximoMid` would collide with the next id.

2. **One allocator for every voo: `alvoDoNovoPedido` + `proximoMid`, as today, for pedidos and for bookings. One rule
   changes: a main request that carries `solicitacao` is never reused.**
   - Why: one number space (0 and small integers), inside both bounds, and no pin, status or result can pass to
     another voo (the allocator skips keys with leftovers). The change is needed because "taken off the schedule"
     becomes a lasting restriction of a pedido (decision 7); today the slot is blanked and the pedido is lost (ran).
   - Evidence: js/rules.js:54-72, 95-100; the second run above; lacuna-1-pedido-principal table rows 6, 7, 9.
   - Rejected: "every pedido is an extra, the main request stays off": it breaks the main-request tests (480 lines
     in 29 unit files use `_0_1`) for no gain once the binding is `solicitacao`.

3. **A pedido enters or leaves the date through one explicit step, the conciliation ("Atualizar a escala"). The first
   time on each date it is a click, as "Importar da agenda" is today; after the date has received pedidos
   (`S.importadas.length > 0`), an approval, a withdrawal or a cancellation made in this browser for the open date is
   applied at once.**
   - Why: a save creates the date's day document, and a stored day never again receives the aircraft hours to the
     50 h inspection, the rodízio queues and the availability of the day before it: `carregarDia` copies them only
     while the date has no document. Approving on Monday a pedido for Friday must not create Friday.
   - Evidence: js/storage.js:186-191; js/dias.js:118-137; js/actions.js:166-195 (every `gravarAlteracao` writes the
     day). Today registering a pedido never touches the day (mapa-pedidos section 1).
   - Rejected: posicao.md B1 "runs right after an approval": correct for a date under construction, harmful for a
     date not yet built. Rejected too: always a click (one more click for every late pedido on the day of operation).

4. **What leaves: only the request of a CANCELLED pedido, and only when the voo left nothing behind that happened.**
   The voo stays, whole, when its status is Atrasado, Em Voo, Pousou or Cancelado, when a result is registered for its
   key, when its take-off time of today has passed, or when the date is before today; and nothing leaves while the
   results were not read. Leaving deletes the request, its pin of any kind and a Pendente or Confirmado mark, and
   takes the id out of `importadas`. The approval of the schedule is not reopened.
   - Why: saved schedules feed the instructors' hours, the next date's aircraft hours and the BI; a flown voo that
     nobody marked must not vanish because a pedido was tidied up afterwards. `cancelar_solicitacao` has no date rule.
   - Evidence: mapa-dados 5.3 item 5; js/dias.js:127-137; mapa-pedidos 5.1 (`cancelar_solicitacao`);
     js/reversoes.js:136-149 (the same guards protect "↶ Desfazer"); js/fixos.js:40-41.
   - Rejected: posicao.md B1 keeps only Atrasado, Em Voo and Pousou: a voo cancelled with its reason, a voo with a
     result and a voo of 08:20 cancelled at 16:00 would be erased from the day.

5. **A pedido that is active but not approved while its request is in the day is never removed by "Atualizar". It is
   listed apart, with two buttons: "Aprovar" and "Tirar da escala".** A withdrawal made in this browser is the
   operator saying "tirar", and is applied.
   - Why: at the cut-over this state is produced by the old client (a pedido imported between D's migration and D's
     merge, or by a tab still open on the old version), not by a decision to remove a voo.
   - Evidence: mapa-pedidos 5.8 and section 7 item 3; posicao.md A14 (migration before the merge), B3.
   - Rejected: posicao.md B1 "removes the request of a pedido that is no longer approved": tomorrow's schedule could
     lose voos on the first click after G.

6. **The conciliation writes History entries (one per pedido that enters, one per pedido that leaves, one per course
   mission changed) and has no revert.** The undo of an exit is in Pedidos (approve or register again); the History
   text of an exit says where the voo was.
   - Why: the truth is the pedido's state on the server; a revert that puts back the voo of a cancelled pedido would
     be undone by the next conciliation. The import has no revert today.
   - Evidence: mapa-demanda 5.7; js/eventos/agenda.js:53-55; js/reversoes.js:43-117 (a closed list of nine kinds).
   - Rejected: a tenth revert kind (a second stored format no step migrates, mapa-dados 5.5).

7. **"Tirar da escala" stays what it is: `fly: false` on the request, with the revert `setFly`. It is an operator
   restriction of the date; the pedido stays approved.** Withdrawing the approval is a separate action of the Pedidos
   stage.
   - Why: it is one write of the day, works offline (day writes queue, pedido RPCs do not), keeps the pin dormant so
     "pôr de volta" returns the voo to its place, and every `setFly` entry already stored keeps its button.
   - Evidence: js/eventos/demanda.js:184-194; mapa-restricoes 5.1 ("Voa off"); test/e2e/demanda.spec.js:511;
     lacuna-2 section 5 (:466); js/eventos/historico.js:53-61.
   - Rejected: posicao.md B2 "turning it off is withdrawing the approval": two writes that can half fail, no undo
     that restores the pin, and a pedido back to "aguardando aprovação" when the student did nothing.

8. **Operator restrictions live on the stored request, in the fields that exist: `insId`, `pr`, `fly`, `mis`, `eq`,
   `nb`, `p1`, `p2`, `jan`, `etapa`, `cursoDaEtapa`. No new store. One new boolean field, `etapaEscolhida` (the course
   mission was chosen by the operator).** The screen shows a restriction as the difference between the request and
   what the pedido gives (`pedidoDaSolicitacao`), with "Voltar ao pedido".
   - Why: nothing has to be kept in step at the writer sites, days already stored read the same way (a request
     imported and then edited shows its edits as restrictions), and reverts keep working. The boolean is the one fact
     a difference cannot tell: "the programme moved on" against "the operator chose this mission on purpose"
     (decision 12 needs it).
   - Evidence: mapa-restricoes 5.6; js/agenda.js:63-80; js/reversoes.js:25-36 (a request field stored in the History
     must be a simple value, so the mark is a boolean, not a list).
   - Rejected: a `restricoes` object in the day keyed by fKey (mapa-restricoes suggestion 2): two homes for `insId`
     during the transition and every revert kind rewritten.

9. **The restrictions are edited in one block, "Restrições do operador (valem só nesta data)", in the detail of the
   pedido or voo.** The Escala keeps its own two controls (the instructor's name, "✕ Tirar da escala") and the booking
   dialog. The block belongs to the Escala stage (its data, its History texts); it is drawn in the detail pane of the
   Processamento screen, because that is the only list that also holds the pedidos that did not fit and the ones taken
   off.
   - Why: the operator changes a restriction where she reads why the pedido does not fit; a rejected or excluded voo
     has no row in the Escala (js/views/escala.js:454-469 shows only names).
   - Evidence: mapa-demanda 5.8 items 4 to 8; posicao.md B4 (the Escala's views span the list and detail panes).
   - Rejected: the block only in the Escala (needs a second list of every voo there); a table of all pedidos with
     editable cells (the Demanda again).

10. **The mission type, the resource type and the duration can each be overridden; an override of resource or
    duration keeps the course mission.** Today the Demanda drops the course mission when Recurso or Duração change by
    hand, and the booking dialog keeps it with a notice; the block follows the dialog.
    - Why: without the course mission the voo has no result select; the operator would bind it again and lose the
      override. The type must be overridable because some pedido types never match the programme (a "TGL (TMA)"
      pedido while TMA-01 is "Voo Local"), and a pedido cannot be edited.
    - Evidence: js/eventos/demanda.js:245-249; js/agendamento.js:1122, 1130 (`recurso-do-programa`);
      js/views/etapas.js:176-177; lacuna-2 2.3 (ran); mapa-pedidos 5.1 (no edit RPC).
    - Rejected: posicao.md B2 "Missão (type): a field of the pedido" with no override: cancel, register and approve
      again (six actions or more, and the Exceção after 13:00) for what is one select today.

11. **Bookings stay as they are: a request plus the pin `agendado`, no pedido, the same dialog, the same "↶ Desfazer".
    "Pôr um aluno na demanda", "+ missão" and the "Voa" switch end. Requests without a pedido already stored stay and
    fly, and can be removed one by one ("Remover este voo").**
    - Why: the booking decides what a pedido cannot hold (a specific resource, the instructor, rules confirmed past),
      and the server refuses what the dialog only warns about.
    - Evidence: mapa-restricoes 5.3; docs/PLAN.md:421 (item 7a), :375; lacuna-2 2.7 a.
    - Rejected: a booking that registers a pedido (PT422 and the deadline on the server against "Agendar mesmo
      assim").

12. **The course mission is bound when the pedido enters, in the order of the day's times, and is never recomputed
    silently. A binding the results have overtaken is listed in the same notice and changed by the same click.**
    - Why: the schedule of tomorrow is built after 13:00 today, before today's results exist: a student who flies
      PE-03 at 16:00 today gets PE-03 again for tomorrow (only the same date's voos count as planned). The app does
      this already; nothing shows it, and the result of tomorrow's voo goes to the wrong code unless the operator
      notices. Binding by time fixes the AV PROF. SOLO case, where the mission each voo gets depends on which pedido
      was registered first.
    - Evidence: posicao.md A4; js/agenda.js:119-127; js/progresso.js:144-149; lacuna-2 2.4 and 2.7 c (ran).
    - Rejected: recompute on every read (the mission advances after the voo's own result; a write on a read).

13. **A closed course: the pedido enters without the course mission, with a notice; the operator binds it through the
    block, with the two-step confirmation that exists.** (docs/PLAN.md:424, the import half.)
    - Evidence: js/agenda.js:119 (does not read `curso.ativo`); docs/PLAN.md:371 (warns and asks, never blocks).
    - Rejected: bind silently (today), or refuse the pedido (turns a warning into a block).

14. **Hours: the pedido's hours win, as in today's import; the screen shows the programme's when they differ, with
    "Usar a do programa".** No behaviour change at the cut-over.
    - Evidence: js/agenda.js:71-74; mapa-demanda 5.3 and S6.

15. **Two pure modules. `js/processamento.js`: the conciliation and the course mission (step E), then the reading of
    the stage and the restrictions (step G). `js/rejeicoes.js` (step E): the engine's rejections paired with their
    requests.** In E the conciliation replaces `importarSolicitacoes` behind today's import button (entries only), and
    the booking dialog uses the pairing instead of its match by name.
    - Why: the unused-exports lint refuses an export only tests use (scripts/exportacoes-sem-uso.mjs:128-143), so each
      function lands in the step that has its real caller.
    - Evidence: js/eventos/agenda.js:53; js/agendamento.js:234-237, 1031-1034; posicao.md A13, B8.
    - Rejected: the whole module in E with a throwaway caller in the Demanda table (deleted in G).

16. **Why a pedido cannot be scheduled: (a) "não cabe nem sozinho": the engine run on a copy of the state with only
    that request flying and no pins; (b) "não coube": the engine's own rejection, found by order, not by name. The
    engine and its alerts are not edited.**
    - Why: the engine on one request is the rule itself, so the verdict cannot drift from it; it costs about 0.1 ms
      per request, and a request rejected alone was placed in the full day in 0 of 3,866 measured cases.
    - Evidence: lacuna-1-motivos sections 5 and 9; the first run above; js/engine.js:333-338, 556-557 (`err` pushed
      inside the queue loop, in queue order); js/agendamento.js:960-967 (`simularAgendamento` already runs the engine
      on a copy).
    - Rejected: a new "possible starts" function over js/candidatos.js (a fourth copy of the start-time rule and an
      invariant test to keep); `fKey` on the alerts (174 golden alerts change, not a rule change).

17. **The pedidos of the open date stay a read beside the date (`lerPedidosDaData`), kept in `S.solicitacoes`. A read
    writes nothing. Without the pedidos, the stage shows the day's voos and the conciliation is off.**
    - Why: the engine's input does not depend on that read (the requests are stored), so no new guard is needed
      beside `dadosLidos`, and read-only profiles see the stored schedule, never a recomputed one.
    - Evidence: js/views/selos.js:36-45; mapa-dados 5.8 ("a fifth read beside").
    - Rejected: the pedidos read inside `lerData` (mapa-dados suggestion 5): only needed when requests are derived.

18. **"Limpar demanda" becomes "Recomeçar pelos pedidos": the same clearing, then the approved pedidos enter again,
    fresh.** Two clicks, no revert, in the "Mais" menu. A voo cancelled with its reason stays cancelled.
    - Why: the operator uses it to restart a date; today the pedidos cleared never come back (`importadas` is not
      reset), so the restart is by hand.
    - Evidence: js/fixos.js:95-117; mapa-pedidos 5.1 ("After Limpar demanda", probe); docs/PLAN.md:437.

19. **Data format 28 (step G) is a step that changes no data: it protects `etapaEscolhida` from a tab on the old
    version. No stored day is converted, no SQL migration belongs to this topic, and `importadas` keeps its place with
    a sharper meaning: the pedidos this date has received.**
    - Evidence: js/migracoes.js:176-213 (formats 22, 24, 25 are the same kind of step); mapa-dados 2.5, 5.3.
    - Rejected: posicao.md B8 "28: the day's requests bound to pedidos; `importadas` to approvals": the requests are
      already bound, and the approvals are D's server backfill.

20. **The code lock of the Cursos tab keeps its reader (the open date's requests and saved rows); only the text
    changes.** The gap recorded in docs/PLAN.md:431 (a code carried only by another date) stays as recorded.
    - Evidence: js/views/cursos.js:56-73; lacuna-2 2.17.

21. **The pedidos of the open date are read again when the window regains focus (at most once a minute), besides the
    reads that exist.** It is one query by date; it shows a cancellation made on another computer without polling.
    - Evidence: mapa-pedidos section 1 and 5.5 (no polling; a pedido of another computer shows only at the next read).

## 2. How it works (data shapes with field names, function signatures, screen structure, states: enough for an implementer)

### 2.1 What is stored

```
dia:<data>
  pedidos: { "<stuId>": { fly, mis, eq, p1, p2, nb, ss, pr, jan?, etapa?, cursoDaEtapa?, etapaEscolhida?, solicitacao?, insId?,
                          extra: [ { mid, …the same fields } ] } }        (unchanged, plus etapaEscolhida)
  importadas: [solicitacaoId…]   the pedidos this date has received (kept by the conciliation: in on entry, out on exit)
  fixos, fStatus, fObs, aprovacao, resultado, …                           (unchanged)
memory only: S.solicitacoes = { data, lista } | null   (the date's rows of `solicitacoes`, every state; null = not read)
```

| Origin of a request | How it is recognised | Created by | Removed by |
|---|---|---|---|
| pedido | `solicitacao: <id>` | the conciliation | the conciliation (pedido cancelled; or "Tirar da escala" of an unapproved one); "Recomeçar pelos pedidos" |
| agendado | no `solicitacao`, pin with `agendado` | `#dlg-agendar` | "↶ Desfazer"; "Remover este voo"; "Recomeçar pelos pedidos" |
| sem pedido | neither (days stored before the cut-over; a booking whose pin was released by "Soltar o voo") | nothing after G | "Remover este voo"; "Recomeçar pelos pedidos"; a pedido of the same mission takes its place (`vooQueDaLugar`, as today) |

`etapaEscolhida`: only `true` is stored; with or without `etapa` (without: the operator chose "sem missão do curso").
Set by the block's "Missão do curso" and by the booking dialog when the mission field was touched; removed by "Voltar
ao pedido" and by `deixarEmBranco`.

### 2.2 Identity of a request (question 1)

| Moment | What happens to `(stuId, mid)` |
|---|---|
| The pedido enters | `vooQueDaLugar` (a flying request of the same mission with no pedido, pin, pinning status or result gives way and keeps its `mid`); else `alvoDoNovoPedido`: the main request (mid 0) when it does not fly, its key has no leftovers and it carries no `solicitacao`; else a new extra with `proximoMid` |
| Load and save | `mid` is stored in the extra (0 is the student); `separar` and `juntar` round-trip it (test/unit/dias.test.js:17) |
| "Tirar da escala" | the request stays with `fly: false`; same key; the pin sleeps |
| The pedido is cancelled | the request leaves only if nothing happened to the voo (decision 4); the key is then clean, so reusing the number moves nothing |
| The approval is withdrawn elsewhere | nothing until the operator chooses "Aprovar" or "Tirar da escala" (decision 5) |
| Approved again after leaving | a new entry through the same allocator; it may get the same number (clean key) or the next |
| A booking for the same student | same allocator, same number space |
| Bounds | numbers are 0, or 1 + the largest of the student in the day; the module's tests assert positive integers up to 999,999, unique per student; a pedido id (13 digits in local mode) is stored only in `solicitacao` and `importadas` |

### 2.3 The conciliation (question 4)

`conciliarPedidos(estado, solicitacoes, resultado, ambiente)` returns a plan and changes nothing.
`ambiente = { data, hoje, agora }` (the open date, today and the minute of the day, São Paulo), given by the handler.

| List of the plan | Rule | What "Atualizar a escala" does |
|---|---|---|
| `entram` | `entraNaEscala(s)` (approved and not cancelled; js/agenda.js) and the student is in the cadastro and active and `s.id` is not in `importadas` and no request has `solicitacao === s.id`; sorted by the pedido's minute, then id | adds the request (2.2), binds the course mission (2.4), pushes the id to `importadas` |
| `saem` | a request with `solicitacao === s.id` whose pedido is cancelled, and none of the reasons of `ficam` | deletes the request (an extra leaves the list; the main one is blanked with `deixarEmBranco`), deletes `fixos[fKey]`, `fStatus[fKey]`, `fObs[fKey]`, takes the id out of `importadas` |
| `ficam` | the same, kept because: `em-andamento` (Atrasado, Em Voo, Pousou), `cancelado-na-escala`, `com-resultado` (`resultadoDoVoo(doDia, fKey)`), `ja-decolou` (`ambiente.data === hoje` and the row's effective start is not after `agora`), `data-passada`, `sem-os-resultados` (`estado.indisponiveis` has `resultados`) | nothing; the row says why |
| `semAprovacao` | a request whose pedido is active and not approved | nothing by itself; "Aprovar" calls D's RPC, "Tirar da escala" removes as in `saem`; ids passed in `retirar` (a withdrawal just made here) are removed |
| `dispensados` | approved, id in `importadas`, no request (cleared before the cut-over by "Limpar demanda" or "✕") | nothing; "Trazer de volta" takes the id out of `importadas` and it enters |
| `semAluno`, `inativos` | the student is not in the cadastro, or is `inativo` | nothing; not marked as received, as today (js/agenda.js:113-115) |
| `duplicados` | a pedido of `entram` whose student already has a pinned voo of the same mission with no pedido | it enters as another voo (today's rule, test/unit/agenda.test.js:229); the notice names it |
| `missoes` | 2.4: voos whose course mission the programme would now give differently, changeable without changing resource or hours | changes `etapa` and `cursoDaEtapa` |
| a request whose `solicitacao` is in no row of the date | never touched (missing data is not a cancellation) | nothing |

| Question | Answer |
|---|---|
| When is the plan computed | whenever the date's pedidos are read: the date opens; a pedido is registered, approved, withdrawn or cancelled here; the Processamento or the Escala stage is opened; "Ler os pedidos de novo"; the window regains focus (once a minute at most); before "Aprovar escala" |
| Who applies it | Operador and Administrador (local mode: not the Gestor), after `aindaNaoAbriu()`. The handler reads the pedidos again, checks that `DATA` did not change (as js/eventos/agenda.js:33-47), computes the plan again and applies that one |
| When it applies by itself | after an approval, a withdrawal or a cancellation made in this browser for the open date, when `S.importadas.length > 0` |
| What is saved | one write of `dia:<data>` through `gravarAlteracao` (the first History text), then `logChange` for the others in the same event (the precedent is js/eventos/agendamento.js:36-38). The schedule is recomputed |
| History | `inc` "Pedido: <aluno> entrou na escala (<missão> · às HH:MM · N h[ · <código>])"; `exc` "Pedido cancelado: <aluno> saiu da escala (<missão>[ · estava às HH:MM–HH:MM no <recurso> com <instrutor>][ · voo fixo solto])"; `mod` "Missão do curso de <aluno>: PE-03 → PE-04 (o programa andou)". No personal data, no Observação. No revert |
| A read-only profile | sees the stored voos and the notice as text ("2 pedidos aprovados ainda não estão na escala · 1 cancelado ainda está: um Operador atualiza"), no button; never a recomputed schedule |
| An approved schedule | a pedido that enters is placed around the pins and is not pinned; one that leaves frees its place; `aprovacao` stays. Aprovar (step H) shows "N voos entraram ou saíram depois da aprovação" |
| A voo in progress whose pedido is cancelled | stays whole (request, pin, status, detail); the row reads "Pedido cancelado às HH:MM por <quem>; o voo está em andamento: fica". It is not counted as pending |
| A date before today | nothing leaves; a pedido may enter, by the click |
| Two operators | the second save gets PT409 and the screen locks (the day's version); after the reload the plan is empty or smaller. Applying twice equals applying once |
| No pedidos read | the notice reads "Não foi possível ler os pedidos desta data · Tentar de novo"; no button to apply |

### 2.4 The course mission (question 5)

| Case | Rule |
|---|---|
| When it is bound | on entry. The voos of the student in the day are walked in time order (the exact minute of `jan`; else the pin's `a`; else the saved row's `a`; unknown last, in the order of `extra[]`). A voo counts as planned for another only when it ends before the other starts (as js/agendamento.js:217); every flying voo's mission is excluded from being offered again; a cancelled voo does not count (`missoesDoDia`) |
| Which mission | the first released or conditional mission of the student's course whose type is the pedido's (`proximasMissoes(...).candidatas.find(m => m.mis === missao)`), as today; its `eq` (when valid for the type) becomes the resource |
| No match | the pedido enters "as it came", with a reason for the screen: `sem-curso`, `sem-programa`, `sem-dados` (results or programmes not read), `curso-encerrado`, `outro-tipo` ("o programa pede TMA-01 (Voo Local)"), `fora-da-ordem` ("o programa pede antes AVP-SOLO-01") |
| AV PROF. SOLO and SOLO (docs/PLAN.md:418) | "Voo Solo" 06:30 and "Voo Local" 08:20 on one date, in either order of registration: the 08:20 voo gets AVP-SOLO-01 and the Solo gets none, with "o programa pede antes AVP-SOLO-01". The operator binds SOLO-01 out of order, with the confirmation, or moves a voo to another date |
| The voo that gave way had a mission the operator chose | it keeps it, and gets `etapaEscolhida: true` (today's rule, test/unit/agenda.test.js:193, :296) |
| What shows when the programme or the results now say otherwise | per voo, `missoesDoCursoDoDia` gives the mission the programme gives now. Same as the bound one: "PE-03 · do programa". Bound and already approved by another voo or date: "PE-03 já aprovada em 20/11: o programa agora dá PE-04", needs attention. No mission and one exists: "o programa daria PE-03 · Usar". With `etapaEscolhida`: "PE-07 · escolhida pelo operador (fora da ordem: falta PE-04)", information, no attention. The voo with a result, in progress or landed: "PE-03 · Aprovado", never compared |
| "Atualizar a escala" and the missions | changes the voos of `missoes`: not `etapaEscolhida`, no result, no status that pins, and the new mission has the resource type the voo has and the voo's hours stay. A change that would move the resource is listed with its own "Trocar" (it releases a booked pin; a pin by approval becomes the `tipo-de-aviao` conflict, as today) |
| Closed course, by hand | the block's select lists "Liberadas no <sigla> (curso encerrado: pede confirmação)" and arms "Confirmar: <código> do curso encerrado" (moved from js/views/etapas.js:98-131); History "<aluno>: <código> no voo (<missão> · <recurso> · <duração>), com o curso <sigla> encerrado" |
| Out of order, by hand | group "Fora da ordem (pede confirmação)", armed "Confirmar: <código> fora da ordem"; History "…, fora da ordem (<motivo>)". Both set `etapaEscolhida` |
| The code lock of Cursos | `codigosDaDemanda` (js/views/cursos.js:56-68) becomes `codigosDosVoos`, same reader; text "nos voos de amanhã (Maria e João)" in place of "na Demanda de amanhã (…)" |
| A booked voo whose mission, resource or hours change | one pure rule in js/fixos.js: the booked pin is released only when `mis`, `eq` or `nb` really change (`semAgendados`), whoever changes them. The clause "Usar releases it even when the mission is the same" (docs/PLAN.md:422) ends with "Usar" |

### 2.5 The pure modules (question 6)

**`js/rejeicoes.js`** (step E)

| Export | Input → output | Reuses |
|---|---|---|
| `naOrdemDoMotor(estado, voos)` | moved unchanged from js/agendamento.js:132-155 | js/voo.js, js/rules.js |
| `rejeicoesPorVoo(estado, resultado)` | → `Map<fKey, { codigo, texto, curto }>`: the flying requests whose key is not in `resultado.out`, in engine order, paired one to one with `resultado.al.filter(a => a.t === 'err')`; when the counts or a label differ (a schedule saved by another version), it falls back to the first alert with the same label | `naOrdemDoMotor`, `chaveDoVoo` |
| `MOTIVO_CURTO_DA_REJEICAO` | the 21 short texts, moved from `FORA_DA_ESCALA` (js/agendamento.js:223-232) | js/conflitos.js codes |

**`js/processamento.js`**

| Export | Step | Input → output | Reuses |
|---|---|---|---|
| `conciliarPedidos(estado, solicitacoes, resultado, ambiente)` | E | → the plan of 2.3; no mutation | `entraNaEscala` (js/agenda.js), `chaveDoVoo`, `pedidoDoAluno`, `fixoPeloStatus`, `resultadoDoVoo`, `intervaloEfetivo`, `STATUS_EM_ANDAMENTO` |
| `aplicarConciliacao(estado, plano, { situacao, programa, retirar = [] })` | E | mutates `estado` (as `importarSolicitacoes`, `aplicarAgendamento` and `limparDemanda` do) → `{ entraram, sairam, trocadas, historico: [[tipo, texto]…] }` | `pedidoDaSolicitacao`, `alvoDoNovoPedido`, `deixarEmBranco`, `normalizeMissionFields`, `migrateLegacyMissionName`; `vooQueDaLugar` moves here from js/agenda.js:86-93 |
| `missaoDoCursoNaEntrada(estado, aluno, solicitacao, { situacao, programa })` | E | → `{ missao, curso, porque }` | `indiceDoPrograma`, `situacaoPorMissao`, `proximasMissoes`, `missoesDoDia` |
| `missoesDoCursoDoDia(estado, aluno, resultado, { situacao, programa })` | G | → `Map<mid, { atual, doPrograma, estado, texto, trocavel }>` | `estadoDoAluno`, `motivoDoBloqueio`, `rotuloDaMissao` |
| `cabeSozinho(estado, alvo, motor = runAllocationEngine)` | G | `alvo` = `{ stuId, mid }` or a request not yet in the day → `{ cabe: true }` or `{ cabe: false, codigo, texto, curto }`; the state copy has every other request with `fly: false`, `fixos: {}`, and keeps `noturnosDaVespera` | js/engine.js, `rejeicoesPorVoo` |
| `restricoesDoVoo(estado, aluno, pedido, solicitacao, programa)` | G | → `[{ campo, valor, doPedido, texto }]` for `mis`, `etapa`, `eq`, `nb`, `horario` (`p1`, `p2`, `jan`), `pr`, `insId`, `fly` | `pedidoDaSolicitacao`, `rotuloDaDisponibilidade` |
| `aplicarRestricao(estado, resultado, alvo, campo, valor, contexto)` | G | mutates → `{ antes, depois, soltou, reverter }` (`reverter` only for `insId`: `restaurarEscolha`) | `escolherInstrutor`, `ajustarPreferencias`, `horariosDaMissao`, `duracaoDigitada`, `fixosSemOAgendadoQueMudou` (new, js/fixos.js) |
| `quadroDoProcessamento(estado, solicitacoes, resultado, ambiente)` | G | → `{ plano, linhas, contagens }`, memoised per `resultado` (as `ocupacoesDaBase`, js/agendamento.js:159) | everything above; `ocupacaoDaEscala`, `avioesQueServem`, `instrutoresQueServem`, `problemaDoAluno` (js/candidatos.js); `descreverExigencias`; `doesGroundGateFlight` |
| `recomecarPelosPedidos(estado, solicitacoes, resultado, ambiente, contexto)` | G | `limparDemanda` (kept, with Cancelado kept too), `importadas` reduced to the voos that stayed, then `aplicarConciliacao` → `{ ficam, reaberta, entraram, semPedido }` | js/fixos.js |
| `removerVooSemPedido(estado, alvo)` | G | removes the extra or blanks the main request; `semAgendados` on its key | js/fixos.js, js/rules.js |

One line of `quadroDoProcessamento().linhas`:

```
{ chave: fKey | 'p:<id>', origem: 'pedido' | 'agendado' | 'sem-pedido', situacao, stuId, mid, fKey,
  pedido: { id, missao, horario, horas, observacao, excecao, registrado_por, aprovada_em, cancelada_em } | null,
  voo: { mis, eq, nb, p1, p2, jan, pr, insId, etapa, cursoDaEtapa, etapaEscolhida, fly } | null,   (what the engine receives)
  restricoes: […], missaoDoCurso: {…}, preferencias: { priorizarCom: [nomes], naoEscalarCom: [nomes] },
  exige: 'Voo Local + C152', recursos: [{ r, problema }], instrutores: [{ id, nm, problemas }],
  motivo: { quando: 'sozinho' | 'na-escala', codigo, texto, curto, onde } | null, naEscala: linha de out | null }
contagens: { aprovados, naEscala, paraEntrar, paraSair, semAprovacao, foraPeloOperador, naoCabemSozinhos, naoCouberam,
             semMissaoDoCurso, missoesParaTrocar, comRestricao, semPedido }
```

How it stays in real use: from E, `conciliarPedidos` and `aplicarConciliacao` are called by `importarDaAgenda`
(js/eventos/agenda.js), which applies only `entram` (it passes the plan with `saem` and `semAprovacao` emptied; the
button still says "Importar", and the History text stays "Agenda: <aluno> incluído (…)" until G); the list `missoes`
is added to the plan in G, with `missoesDoCursoDoDia`. `rejeicoesPorVoo` and `MOTIVO_CURTO_DA_REJEICAO` are called by
`motivoDeFora` and `motivoDaSaida` (js/agendamento.js); `missaoDoCursoNaEntrada` is exported for its tests and used by
the module. From G every export has a caller in js/eventos/processamento.js or js/views/processamento.js, and D's
handlers (register and approve, approve, withdraw, cancel) call `depoisDeMudarPedidos({ retirar })`, exported by
js/eventos/processamento.js: it reads the date's pedidos again and applies the plan when the date has received pedidos.
Step H reads `contagens` and `plano`.

Time and order inside the module: a voo's time is known from an exact `jan`, a pin or a saved row; a pedido by period
(rows older than 2026-11-14, and the 21 import tests, whose helper uses `janela: 'tarde'`) has no known time and counts
as planned for the others, which is today's rule: those tests pass unchanged with the time order.

### 2.6 Why a pedido cannot be scheduled (question 7)

| Situação of the line | Decided by | Icon | Third line of the row, and the detail |
|---|---|---|---|
| `na-escala` | its key is in `resultado.out` | done | "Na escala 10:10–11:10 · PR-VOB · Instrutor 02"; with `conflito`: needs attention, "Em conflito: … · Sugestões" |
| `nao-cabe-sozinho` | not in `out`, and `cabeSozinho` is false | failed | "Não cabe nem sozinho: sem instrutor habilitado", the engine's full text, and where to fix it |
| `nao-coube` | not in `out`, `cabeSozinho` is true; the text comes from `rejeicoesPorVoo` | failed | "Não coube: sem instrutor livre" and "Encaixar…" (the booking dialog on this request) |
| `fora-pelo-operador` | `fly: false` with a pedido approved | pending | "Fora da escala nesta data, pelo operador · Pôr de volta" |
| `para-entrar` | in `plano.entram` | pending | "Aprovado: entra com Atualizar a escala"; when `cabeSozinho` of the request it would become is false: "…e não caberia nem sozinho: <curto>" |
| `para-sair` | in `plano.saem` | attention | "Pedido cancelado por <quem>: sai com Atualizar a escala" |
| `fica` | in `plano.ficam` | muted | "Pedido cancelado; o voo já pousou: fica" (one text per reason) |
| `sem-aprovacao` | in `plano.semAprovacao` | attention | "Na escala sem aprovação · Aprovar · Tirar da escala" |
| `dispensado` | in `plano.dispensados` | muted | "Aprovado, tirado desta data antes · Trazer de volta" |
| `aguardando-aprovacao`, `cancelado` | the pedido's state, no request | muted | "Aguardando aprovação" (link to Pedidos); "Cancelado por <quem>" |
| `sem-aluno`, `inativo` | `plano.semAluno`, `plano.inativos` | failed | "O aluno não está no cadastro: entra depois de cadastrado"; "Aluno inativo" |

"Where to fix it" (`motivo.onde`), from the code:

| Codes | Place |
|---|---|
| `instrutor-escolhido` | the block, "Instrutor" |
| `sem-horario`, `disponibilidade-do-aluno` | the block, "Horário"; the date's closed periods; Horários de decolagem |
| `sem-aviao`, `so-parafuso`, `revisao`, `equipamento-da-missao` | Recursos (this date: Disponível, horas até a revisão); the block, "Recurso" |
| `sem-instrutor-habilitado`, `instrutores-indisponiveis`, `habilitacao-do-aviao`, `limite-da-lei` | INVAs (this date: Vem and the availability; cadastro: habilitações) |
| `bloqueio`, `peso` | Alunos (Não escalar com; peso) |
| `ground-pendente`, `depois-do-ground`, `ground-antes-do-voo-fixo` | the student's Ground of the same date (its line) |
| `aluno-ocupado`, `avioes-ocupados`, `sala-ocupada`, `instrutores-ocupados`, `limite-de-locais` | the Escala ("Encaixar…") |

Also shown without being a rejection: "depende do Ground C152 do mesmo dia" (`doesGroundGateFlight`); "Priorizar com:
Instrutor 03 fora nesta data" (the three static tests of `motivoSemPar`, js/engine.js:246-250, recomputed outside the
engine from `on`, `hab` and `bl`). A request that does not fit alone still goes to the engine: `tot`, the PDF's
"Missões na demanda" and the BI's `rej` keep their meaning (lacuna-1-motivos suggestion 9).

### 2.7 The operator restrictions (question 2)

| Restriction | Stored field | Control (the block, unless said) | History | Revert |
|---|---|---|---|---|
| Chosen instructor | `insId` on the request; with a pin, also `fixos[fKey].insId` (and `escolhido` when chosen in the Escala) | select "Instrutor" (first option "Automático" or "Automático (prioriza …)", `instrutoresDoPedido`); in the Escala, the name button and its list, as today | "Voo <aluno>: instrutor <nome ou automático> (<missão>)" | `restaurarEscolha` |
| Priority | `pr` (3 = none) | select "Prioridade" 1 to 5 | "Voo <aluno>: prioridade 5 (<missão>)" | none |
| Another mission type | `mis` (and `eq`, `nb`, `p1`, `p2`, `jan` adjusted as js/eventos/demanda.js:250-264 does; `etapa` and `cursoDaEtapa` removed) | select "Missão" | "Voo <aluno>: <missão> · <recurso> · <duração> (o pedido pede <missão>)[ (deixa de ser fixo)]" | none |
| Another course mission | `etapa`, `cursoDaEtapa`, `etapaEscolhida`; `mis`, `eq`, `nb` when the mission has another type | select "Missão do curso" with the groups and the armed confirmation; button "Usar <rótulo>" when there is none | as today, "no voo" in place of "na demanda" | none |
| Another resource type | `eq` (`p1`, `p2`, `jan` adjusted to the new list) | select "Recurso" (`MIS[mis].eq`; off for Ground) | "…: recurso C172 (o pedido daria C152)[ (deixa de ser fixo)]" | none |
| Another duration | `nb` | number field, 0.1 to 5 (off for Ground and Noturno) | "…: duração 1,5 h (o pedido pede 1 h)[ (deixa de ser fixo)]" | none |
| A loosened time | `jan` removed or `manha`, `tarde`, `noite` | select "Disponibilidade": "Só às HH:MM (o pedido)", "Manhã", "Tarde", "Noite", "Qualquer horário" | "…: disponibilidade <rótulo>" | none |
| A moved preference | `p1`, `p2` | selects "1ª preferência", "2ª preferência" | "…: preferências HH:MM e HH:MM" | none |
| A moved voo (time, resource, instructor fixed) | the request's `eq`, `nb`, `p1`, `p2 = -1`, `insId`, `jan` removed when it excludes the time; pin `agendado` | `#dlg-agendar`, "Mover" or "Encaixar" | as today | `desfazerAgendamento` |
| Exclusion | `fly: false` | Escala: "✕ Tirar da escala" (list and map popup); block: "Tirar da escala" and "Pôr de volta" | "Tirado da escala: <aluno> (<missão> · <recurso>)"; "De volta à escala: …" | `setFly` |
| Approval, status, Sugestões pins | `fixos`, `aprovacao`, `fStatus`, `fObs` | unchanged (Escala, Aprovar) | unchanged | unchanged |

"Voltar ao pedido" (one button of the block, for a voo with a pedido): the request becomes what the pedido gives now
(`pedidoDaSolicitacao` with the programme's mission), `insId`, `etapaEscolhida` and a `pr` other than 3 leave, `fly`
stays; the booked pin is released when `mis`, `eq` or `nb` change. For the Gestor the block is text.

### 2.8 Bookings and requests without a pedido (question 3)

| Today | After |
|---|---|
| "+ Agendar voo" (six entry points) | unchanged. What "Agendar" writes is unchanged (mapa-restricoes 5.3), with two additions: `etapaEscolhida: true` when the mission field was touched in the dialog, and the main request bound to a pedido is not the target. No pedido is created (docs/PLAN.md:421 kept) |
| "Mover" and "Encaixar" of a voo born from a pedido | unchanged; the request keeps `solicitacao`, so the conciliation leaves it alone, and the block shows "horário movido pelo operador: 14:30 (o pedido pede 08:20)". "Encaixar…" is also offered on a `nao-coube` line (a new context of `contextoInicial`: `{ pedido: { stuId, mid } }`) |
| "↶ Desfazer" | unchanged payload and guards. Two texts change: "O pedido deste voo saiu da escala: não há o que desfazer." and "O voo mudou depois do agendamento: desfazer agora mexeria em outro voo. Ajuste o voo nas restrições." (js/reversoes.js:141-142) |
| "+ missão" | removed. A second voo is a second pedido, or a booking |
| "+ Pôr um aluno na demanda…" | removed. "Registrar e aprovar" in Pedidos (D), or a booking |
| A request with no pedido in a stored day | stays, flies, is listed as "sem pedido", accepts every restriction, and has "Remover este voo" (two clicks; History `exc` "Voo sem pedido removido: <aluno> (<missão> · <recurso>)"; no revert) |

### 2.9 The sixteen sites that write a request (question 8; the rows of mapa-demanda 5.6)

| # | Site today | Becomes |
|---|---|---|
| 1 | js/eventos/demanda.js:41 ("Pôr um aluno") | removed (G) |
| 2 | js/eventos/demanda.js:94-99 `usarMissaoDoCurso` | `aplicarRestricao(…, 'missaoDoCurso', …)`; also used by `aplicarConciliacao` for `missoes` |
| 3 | js/eventos/demanda.js:153-182 (push and remove an extra) | pushing: only `alvoDoNovoPedido`; removing: the conciliation, `desfazerAgendamento`, `removerVooSemPedido`, `recomecarPelosPedidos` |
| 4 | js/eventos/demanda.js:184-194 `rm-fly` | kept; the handler moves to js/eventos/escala.js; "Pôr de volta" writes `fly = true` with the same revert kind |
| 5 | js/eventos/demanda.js:197-273 (the field handler) | `aplicarRestricao`, called from js/eventos/processamento.js. The `fly` branch and its cascade to the extras go; a change of `eq` or `nb` no longer removes `etapa` |
| 6 | js/fixos.js:95-117 `limparDemanda` | kept as the first half of `recomecarPelosPedidos`; keeps Cancelado too |
| 7 | js/rules.js:86-100, 142-179 | `deixarEmBranco` also removes `etapaEscolhida`; `alvoDoNovoPedido` skips a main request with `solicitacao`; `normalizeMissionFields` keeps `etapaEscolhida` only when `true`, and checks the type before converting `mis`, `nb`, `pr`, `jan` (the open bug of docs/PLAN.md:440) |
| 8 | js/agenda.js:107-140 `importarSolicitacoes` | deleted in E; `conciliarPedidos` and `aplicarConciliacao` |
| 9 | js/agendamento.js:899-940 `aplicarAgendamento` | kept; the two additions of 2.8 |
| 10 | js/instrutor-escolhido.js:104-183 | kept |
| 11 | js/eventos/escala.js:177-186, 283-285 | kept |
| 12 | js/reversoes.js:165-191 `desfazerAgendamento` | kept; the snapshot carries `etapaEscolhida` through `CAMPOS_DO_PEDIDO` |
| 13 | js/eventos/historico.js:53-61, 96-106 (`setFly`, `restaurarHorarios`) | kept, old entries included (`extras` still applied) |
| 14 | js/eventos/recursos.js:205-210 (take-off times) | kept; the requests it adjusts are the same stored ones (step B owns the editor) |
| 15 | js/eventos/cadastros.js:84-90, 123, 128 | kept |
| 16 | js/storage.js:149-171; js/dias.js:96-101, 121; js/migracoes.js | `CAMPOS_DO_PEDIDO` gains `etapaEscolhida`; step 28; a new date still starts empty with `importadas: []` |

The nine revert kinds:

| Kind | After |
|---|---|
| `setFly` | kept. Created by "Tirar da escala" and "Pôr de volta". Old entries with `extras` keep working |
| `restaurarEscolha` | kept. Created by the block's "Instrutor" and by the Escala |
| `restaurarFixos` | kept |
| `restaurarHorarios` | kept |
| `desfazerAgendamento` | kept; `pedidoDeAntes` accepts the boolean `etapaEscolhida` because it is in `CAMPOS_DO_PEDIDO` |
| `setAv`, `setAtributo`, `setInsOn`, `readicionarRecurso` | other topics; nothing here touches them |

No kind is added and none is dropped: every entry stored before the cut-over keeps its button.

### 2.10 The Processamento screen (step G)

- Left pane (the list component of F2): a notice bar when the plan is not empty ("12 pedidos aprovados para entrar ·
  1 cancelado para sair · 3 missões do curso para trocar", button "Atualizar a escala", `data-act="atualizar-escala"`;
  its items open below it); search by name (`chaveDeBusca`); filters Curso (the multi-value component) and Missão; a
  segmented filter "Todos" / "Pendências"; "Ler os pedidos de novo"; menu "Mais" with "Recomeçar pelos pedidos". One row
  per line of `quadroDoProcessamento`: status dot, initials, the name; second line "Voo Local · 10:10 · PE-03" with
  the hours at the right; third line the text of 2.6; a lock when booked; a small count of restrictions.
- Middle pane (the detail), sections in this order: "Pedido" (Label: value lines: aluno, missão, horário e duração
  pedidos, registrado por e em, exceção, observação, situação; read-only; "Abrir em Pedidos"); "Missão do curso";
  "Preferências do aluno" (Priorizar com, Não escalar com; read-only; "Abrir o aluno"); "O que a missão exige";
  "Recursos" and "INVAs" (each candidate at the voo's first preference, against the schedule without this voo, with
  what stops it); "Na escala" (the row, or the reason with "Encaixar…"); "Restrições do operador (valem só nesta
  data)". With nothing selected: the counts and the notice.
- The container of the block is `div[data-k="d"][data-id][data-mid]`, so `aoMudarCampo('d', …)` (js/eventos/registro.js)
  and the focus keeping of js/dom.js:171-178 work as they do for the Demanda row.
- Read-only profiles: the Gestor sees the list and the detail, the block as text, no button; the Secretaria does not
  see the stage (as the Demanda today).
- Phone: the list, then the detail as a second view (F2).

### 2.11 The cut-over and the interims (question 9)

| Case | What happens |
|---|---|
| Stored days of past dates | not converted. Their requests read as "pedido" (with `solicitacao`) or "sem pedido". Nothing ever leaves a past date |
| Stored days of future dates (tomorrow, built before G) | requests imported: their pedidos are approved by D's backfill, so the plan is empty. "Voa" off on an imported request reads as "fora da escala pelo operador" (same data). Requests made by hand: "sem pedido", they fly |
| `importadas` | kept. An id in it with no request (cleared before) is `dispensado`: it does not come back by itself |
| A pedido imported by the old client after D's migration and before D's merge | `semAprovacao`: never removed by "Atualizar"; the operator approves it. The plan should also ask D to run its backfill once more after its merge |
| Tabs still open on the old version | after the first Operador opens the new version (the cadastro is written at 28), the old tab's next save is refused (PT409, hint `formato`) and it must reload. Before that, what it writes is today's shape, which the new version reads |
| Local mode | same pure code; no format check (existing limit); pedido ids of 13 digits are never numbers of voos |
| Two operators at once | 2.3 |
| The Secretaria cancels at any time | the row changes on the server; the day changes only when an Operador's browser reads it and applies it; guards of decision 4 |
| Between D and E | approval exists; "Importar da agenda" brings only approved pedidos because D changes the one predicate `entraNaEscala` (created in F0 with today's body). A pedido cancelled after the import stays, as today |
| Between E and G | the same button, now through the module, entries only. "Voa", "+ missão", "Pôr um aluno" and "Limpar demanda" still exist; what they write is the legacy the new version reads |
| E merges before D | the predicate still has today's body; nothing changes on screen |
| The first opening after G | `atualizarFormatoGravado` rewrites every stored day at 28 (no content change), then the cadastro |

### 2.12 The ten columns (question 10)

| Column | After | Kind | Why |
|---|---|---|---|
| Aluno (the name) | the pedido's student | field of the pedido | exists (`aluno`) |
| Aluno: the course code, "Usar", "Outra missão…" | bound on entry; another one through "Missão do curso" | derived, then an operator restriction | 2.4 |
| Aluno: "+ missão", "✕" of an extra | a second pedido or a booking; "Remover este voo" only for a voo without pedido | removed | decision 11 |
| Aluno: the tag "agendado" | on the line and in "Na escala" | derived (the pin) | — |
| Voa | on: the approved pedido has entered; off: "Tirar da escala" (`fly: false`) | derived; off is an operator restriction | decision 7 |
| Missão | the pedido's `missao`; another type through "Missão" | field of the pedido; override is an operator restriction | decision 10 |
| Recurso (type) | the programme's for the bound mission, else `MIS[mis].defEq`; another through "Recurso" | derived; override is an operator restriction | — |
| Instrutor | "Instrutor" (`insId`) | operator restriction | no other source |
| 1ª preferência, 2ª preferência | the pedido's time (both); other times through the two selects. If D adds a second time to the pedido, `pedidoDaSolicitacao` reads it into `p2` | field of the pedido; override is an operator restriction | mapa-pedidos 5.3 |
| Disponibilidade | "Só às HH:MM" from the pedido; looser through "Disponibilidade" | field of the pedido; override is an operator restriction | the only way the Horários setting has room |
| Duração | the pedido's `horas` (else the programme's, else the mission's default; fixed ones always); another through "Duração" | field of the pedido; override is an operator restriction | decision 14 |
| Prioridade | "Prioridade" (`pr`) | operator restriction | no other source |

### 2.13 The operator's day, counted

| Task | Today | After |
|---|---|---|
| Bring tomorrow's pedidos into the schedule (after 13:00) | 1 click ("Importar N pedidos da agenda") | 1 click ("Atualizar a escala"). Approving is D's: none extra with "Registrar e aprovar" |
| A late pedido on a date already built | register, then 1 click to import | register and approve; it enters by itself |
| A student cancels | cancel the pedido (2 clicks), then find the row and turn "Voa" off (1); forgotten, the voo stays | cancel the pedido (2 clicks); the voo leaves by itself |
| The mission of the course for each student | bound by the import when the type matches; else "Usar" per row | bound on entry; none per row |
| Students who flew yesterday and fly today | nothing shows the mission is stale; "Outra missão…" per student (2) or a result on the wrong code | 1 click for all ("Atualizar a escala") |
| Instructor, priority, resource, duration, time of one voo | 1 (the cell) | 2 (select the pedido, then the control); the instructor also in the Escala, as today |
| A mission out of order | 2 (select, confirm) | 3 |
| Take a voo off and put it back | 1 and 1 | 1 and 1 |
| A student with no pedido | 1 (type the name), then the cells | the booking dialog (3 or more), or a pedido registered and approved (the form) |
| A second voo for a student | 1 ("+ missão"), then the cells | a second pedido, or a booking |
| Restart the date | 3 clicks, then every pedido again by hand (the import does not bring them back) | 3 clicks; the pedidos come back |

## 3. Where each existing control goes (a table: control today (label, id or data attribute) | destination (stage, screen, pane) | kept, moved, replaced by or removed)

| Control today | Destination | Kept, moved, replaced by or removed |
|---|---|---|
| Tab "Demanda", `button[data-t="dem"]` | the pipeline card "Processamento" (F1 points it at `#s-dem` until G) | replaced by the card; `#s-dem` is deleted in G |
| "Importar da agenda" / "Importar N pedido(s) da agenda", `#importar-agenda` | Processamento, left pane, notice bar | replaced by "Atualizar a escala", `data-act="atualizar-escala"` |
| "Importar N pedido(s) para a demanda", `#agenda-importar` (Agenda page) | Pedidos shows the same count as a link to Processamento | removed (G; the page is D's) |
| Badge `#selo-age` | the value of the Processamento card and a rail notification (H, F1) | replaced by `contagens.paraEntrar + paraSair` |
| "+ Pôr um aluno na demanda…", `#incluir-aluno`, `#alunos-fora` | — | removed; "Registrar e aprovar" (Pedidos) or "+ Agendar voo" (Escala) |
| "Só quem voa", `#onlyfly` | Processamento, left pane | replaced by the segmented filter "Todos" / "Pendências" (the list has no student without a pedido) |
| "Buscar na demanda…", `#flt-dem` | Processamento, left pane, search | moved |
| "Todos os cursos", `#flt-dem-cur`, `#flt-dem-cur-painel` | Processamento, left pane, filter | moved (same component; its ticks stop being shared with Alunos) |
| "Todas as missões", `#flt-dem-mis` | Processamento, left pane, filter | moved |
| "Mais", `#btn-mais-dem`, `#menu-mais-dem` | Processamento, left pane | moved |
| "Limpar demanda" → "Confirmar limpeza", `#clr` | Processamento, menu "Mais" | replaced by "Recomeçar pelos pedidos" → "Confirmar", `data-act="recomecar"` |
| Count line `#cnt` | Processamento, middle pane with nothing selected; the pipeline card | replaced by `contagens` |
| Column "?" buttons, `button.dica-btn` with `data-dica` = `voa`, `instrutor-escolhido`, `preferencias`, `disponibilidade`, `duracao`, `prioridade` | Processamento, detail, beside each label of the block | moved; `voa` replaced by `fora-da-escala` (js/glossario.js:60-65 rewritten in G) |
| The row `tr[data-k="d"][data-id][data-mid]` | Processamento: one list row and its detail; the block's container keeps `data-k="d"` | replaced |
| Student name in `.stu-cell` | list row, first line | moved |
| Course code `span.etapa` | list row, second line; detail "Missão do curso" | moved |
| "Próxima: <rótulo> · Usar", `data-act="usar-proxima"` | detail "Missão do curso", only when the voo has none and the programme gives one: "Usar <rótulo>" | moved |
| "Outra missão…", `select[data-f="outra-missao"]` | the block, "Missão do curso" | moved |
| "Usar <código> fora da ordem" / "… do curso encerrado", `data-act="usar-fora-da-ordem"` | the block, beside "Missão do curso" | moved |
| Tag "agendado HH:MM · <recurso>", `span.tag[data-dica="voo-agendado"]` | list row, third line; detail "Na escala" | moved |
| "+ missão", `data-act="add-mis"` | — | removed |
| "↳ missão extra" and "✕" → "Confirmar", `data-act="del-mis"` | detail of a voo without pedido | replaced by "Remover este voo" → "Confirmar", `data-act="remover-voo"`; removed for a voo with a pedido |
| Voa, `input.sw[data-f="fly"]` | the block: "Tirar da escala" / "Pôr de volta", `data-act="rm-fly"`, `data-act="por-de-volta"` | replaced |
| Missão, `select[data-f="mis"]` | the block, "Missão" | moved |
| Recurso, `select[data-f="eq"]` | the block, "Recurso" | moved |
| Instrutor, `select[data-f="insId"]` | the block, "Instrutor" | moved |
| 1ª preferência, `select[data-f="p1"]`; 2ª preferência, `select[data-f="p2"]` | the block, "Horário" | moved |
| Disponibilidade, `select[data-f="jan"]` | the block, "Horário" | moved; first option "Só às HH:MM (o pedido)" |
| Duração, `input.duracao[data-f="nb"]` | the block, "Duração" | moved |
| Prioridade, `select[data-f="pr"]` | the block, "Prioridade" | moved |
| "Nenhum aluno com esses filtros." and "Limpar filtros", `#limpar-filtros-dem` | the list's empty state (F2) | replaced |
| "Nenhum aluno cadastrado. Cadastre os alunos na aba Alunos.", `tr.empty-dem` | "Nenhum pedido para esta data.", with "Abrir Pedidos" | replaced |
| "Abrir a Demanda" in Alunos, `button[data-go="dem"]` | — | removed (the Alunos screen is A's) |
| "✕" (Tirar da escala) and "✕ Excluir da escala", `data-act="rm-fly"` | Escala, list row and map popup | kept; the handler moves to js/eventos/escala.js |
| Instructor name and list in the Escala, `data-act="trocar-instrutor"`, `select[data-a="insVoo"]` | Escala | kept |
| `#dlg-agendar` and its six entry points | Escala | kept; one more entry: "Encaixar…" on a line of Processamento |
| "↶ Reverter", "↶ Restaurar", "✕ Excluir", "↶ Desfazer", `data-act="rev-log"` | Histórico | kept |

## 4. Data-format steps and migrations (the number or the migration file name, what changes, the conversion, its tests, the deploy order)

| Item | Content |
|---|---|
| Format 28 (js/migracoes.js, step G) | `PASSOS[28] = { cadastro: c => c, dia: d => d }`, with the comment that names what it protects: the request field `etapaEscolhida`, which a tab on the old version would drop from the main request when saving |
| What comes with it | `CAMPOS_DO_PEDIDO` gains `'etapaEscolhida'` (js/dias.js:22); `normalizeMissionFields` keeps it only when `true`; `deixarEmBranco` removes it; `ESQUEMA = 28` |
| Conversion | none: no stored day changes content; `importadas` and every request stay as they are |
| Tests | test/unit/migracoes.test.js: a day and a cadastro at 27 come out equal plus `esquema: 28`, an unknown field survives, `ESQUEMA >= 28`; test/unit/dias.test.js:25-35 and :164 (the key lists; the day still has no names or weights, now asserted on the extras too); test/unit/rules.test.js (the mark: only `true`, any other value leaves); test/unit/reversoes.test.js (a `desfazerAgendamento` snapshot with the mark validates; with a tampered value it does not throw) |
| Deploy order | client only. Merge in number order: 26 (foundation), 27 (C), 28 (G). No SQL reads the requests (mapa-demanda section 1) |
| SQL migrations of this topic | none |
| What this design needs from D's migration | on each row `aprovada_em` (null or a time) and who approved; an RPC to approve and one to withdraw (posicao.md B3); the backfill from `dias.conteudo -> 'importadas'`, run again after D's merge |
| Steps E and F0 | no format number |

## 5. Files created, changed and deleted, by step (the step names are F0, F1, F2, F3, A, B, C, D, E, G, H, I as in posicao.md and the request)

| Step | Created | Changed | Deleted |
|---|---|---|---|
| F0 | — | js/agenda.js: `export const entraNaEscala = s => !s.cancelada_em`, used at js/agenda.js:112, js/eventos/agenda.js:48 and js/views/selos.js:48 (no visible change). js/views/selos.js: the date's pedidos go to `S.solicitacoes` (`lerPedidosDaData` stays the only reader). js/rules.js: the type check of docs/PLAN.md:440, in its own commit | — |
| F1, F2, F3, A, B, C | not applicable to this topic (B keeps the take-off times editor adjusting the stored requests; A removes "Abrir a Demanda") | | |
| D | — | js/agenda.js: the body of `entraNaEscala` becomes approved and not cancelled. Nothing else of this topic | — |
| E | js/processamento.js; js/rejeicoes.js; test/unit/processamento.test.js; test/unit/rejeicoes.test.js | js/agenda.js (loses `importarSolicitacoes` and `vooQueDaLugar`, and the imports only they used); js/eventos/agenda.js (`importarDaAgenda` calls the module, entries only); js/agendamento.js (`naOrdemDoMotor` and `FORA_DA_ESCALA` leave; `motivoDeFora` and `motivoDaSaida` use `rejeicoesPorVoo`); test/unit/agenda.test.js; test/unit/agendamento.test.js; test/unit/instrutor-escolhido.test.js:268; test/unit/progresso.test.js:544 | — |
| G | js/views/processamento.js; js/eventos/processamento.js; the stage's stylesheet; test/e2e/processamento.spec.js | js/processamento.js (the G exports of 2.5); js/migracoes.js, js/dias.js, js/rules.js (format 28, `etapaEscolhida`, `alvoDoNovoPedido`); js/fixos.js (`fixosSemOAgendadoQueMudou`; `limparDemanda` keeps Cancelado); js/agendamento.js and js/views/agendamento.js (the mark; the context `pedido`); js/eventos/escala.js (`rm-fly`); js/eventos/agenda.js (D's handlers call `depoisDeMudarPedidos`; `importarDaAgenda` goes); js/views/etapas.js (keeps `programaParaInferir`, `progressoDoAluno`, `faseDoAluno`, `cursoDoResultado`, `resultadoNaEscala`; the Demanda's five exports go: `proximaDoPedido`, `outraMissaoDoPedido`, `confirmacaoDaMissao`, `botaoForaDaOrdem`, `etapaNaDemanda`, their rules now in the module and their HTML in js/views/processamento.js); js/views/cursos.js and js/eventos/cursos.js (`codigosDosVoos`, the texts); js/reversoes.js (two texts); js/views/selos.js (`atualizarSeloDaAgenda` and the import button go); js/engine.js:994, in its own commit (the warning `escolhido-saiu` stops naming "Demanda"; no golden holds it: grep of test/fixtures/goldens-do-motor, 0 files); index.html (`#s-dem` becomes the stage's section); js/glossario.js and js/manual.js (this screen); js/actions.js, js/main.js, js/eventos/registro.js, js/eventos/historico.js, js/eventos/agendamento.js, js/eventos/cadastros.js, js/eventos/recursos.js, js/eventos/cursos.js (`rDem` leaves, through F0's redraw registry) | js/views/demanda.js; js/eventos/demanda.js; test/e2e/demanda.spec.js; the Demanda's CSS |
| H | — | reads `quadroDoProcessamento().contagens` and `plano` for the pipeline rows; "Aprovar escala" reads the pedidos again and asks for the confirmation when the plan is not empty | — |
| I | — | README "Estrutura", the Manual and the glossary: the last mentions of "Demanda" and "Importar da agenda" | — |

## 6. Tests (what is written first; which existing tests change, with file names and rough counts)

Written first, step E (about 40 unit tests):

| File | Tests |
|---|---|
| test/unit/processamento.test.js | the 21 tests of the describe "Importar as solicitações da agenda para a demanda" (test/unit/agenda.test.js:89-334), moved and calling a helper that conciliates and applies: all must pass unchanged before any rule moves. Then: the lists of the plan (12); the guards of `ficam`, one per reason (6); exit: the pin is deleted, `importadas` loses the id, the main request is blanked, an extra leaves, a pinned Ground class keeps the others (5); a pedido that leaves and enters again inherits no pin, status or result (2); applying twice equals once (1); `juntar(separar())` of the result (1); the written request has only `CAMPOS_DO_PEDIDO` and `mid`, no name, no Observação (1); numbers are positive integers up to 999,999, unique per student, also with a 13-digit pedido id (1) |
| the same file, each in its own commit, as a rule of the next-mission logic | time order: the two runs of lacuna-2 2.4 (AV PROF. SOLO and SOLO in both orders of registration) (2); a closed course enters without the mission (1) |
| test/unit/rejeicoes.test.js | two extras of one mission; two students with one name; with pins; with a chosen instructor (4); the invariant of the first run above over the 41 golden states and 300 seeds in three variants (1); a saved schedule whose counts differ falls back to the label (1) |

Written first, step G (about 40 unit tests, about 25 e2e tests):

| File | Tests |
|---|---|
| test/unit/processamento.test.js | every `situacao` of 2.6 (11); `cabeSozinho` drops the pins and keeps the Noturno's return (3); `restricoesDoVoo` per field (8); `aplicarRestricao`: each field, the booked pin released only when `mis`, `eq` or `nb` change, `eq` and `nb` keep `etapa` (8); `missoesDoCursoDoDia`: stale after a result, `etapaEscolhida` untouched, a change of resource not automatic, a voo with a result never compared (5); `recomecarPelosPedidos` (3); `removerVooSemPedido` (2) |
| test/unit/rules.test.js, test/unit/migracoes.test.js, test/unit/dias.test.js, test/unit/reversoes.test.js | section 4 |
| test/e2e/processamento.spec.js | the notice and "Atualizar a escala"; a cancelled pedido leaves, one in progress stays; the Gestor sees the notice without the button; each restriction of the block with its History text; out of order and closed course with the confirmation; "Tirar da escala" and "Pôr de volta" keep the place; "Recomeçar pelos pedidos"; a voo without pedido and "Remover este voo"; phone (390 px) |

Existing tests that change:

| File | Change | Rough count |
|---|---|---|
| test/unit/agenda.test.js | the import describe leaves (E); 10 tests stay | 21 moved |
| test/unit/instrutor-escolhido.test.js, test/unit/progresso.test.js | one call each to `importarSolicitacoes` (E) | 2 |
| test/unit/agendamento.test.js | imports of `naOrdemDoMotor` (E); :497 loses `solicitacao: 7` in its fixture and gains the case "o pedido principal ligado a um pedido não é reaproveitado" (G) | 3 |
| test/unit/rules.test.js:190-209 | the main request with `solicitacao` (G) | 1 changed, 1 added |
| test/unit/fixos.test.js, describe "Limpar demanda" (7 tests) | the Cancelado case (G) | 1 or 2 |
| test/unit/reversoes.test.js:328; test/unit/agendamento.test.js:539, :865; test/e2e/historico.spec.js:222 | the two refusal texts of "↶ Desfazer" (G) | 4 |
| test/e2e/demanda.spec.js (23 tests, 119 selector lines) | deleted; its rules are rewritten in processamento.spec.js | 23 |
| test/e2e/cursos-no-dia.spec.js (9 tests) | "Usar" and "Outra missão…" in the block | 9 |
| 20 other e2e files that touch `#dem`, `#importar-agenda`, `#clr`, `#onlyfly`, `data-f="fly"` or `irPara(page, 'dem')` (historico 18 lines, cursos 17, abertura 14, noturno 14, perfis 13, instrutor-escolhido 9, agenda 8, agendamento 8, selos 8, acessibilidade 7, cadastros 7, datas 6, atributos 5, aprovacao 4, dicas 4, app 2, compartilhado 2, agenda-compartilhado 1, celular 1, login 1) | a voo is seeded in the state given to `abrir` (test/e2e/fixtures.js:57-66 already seeds `estado`), or enters through an approved pedido pushed to the fake server; the selectors move to the block | about 157 lines |
| test/helpers/montar.js (`aluno`, `missaoExtra`) and the 41 goldens | none | 0 |

## 7. Departures from Pedro's request (a table: what the request says | what this design does | why | what Pedro can choose instead)

| What the request says | What this design does | Why | What Pedro can choose instead |
|---|---|---|---|
| Processamento is "an aggregation and enrichment stage with no data of its own" | the stage has no screen input of its own and the pure module stores nothing, but the day keeps the requests it produced, with the restrictions on them | pins, statuses, results and History reverts are keyed by the request; nothing is re-keyed | a restriction store keyed by pedido and requests derived at each opening: every writer and five revert kinds rewritten, and a guard against saving a schedule built without the pedidos |
| "Input: the approved pedidos of the date" | two inputs: the approved pedidos and the voos the operator booked (plus the requests without pedido already stored) | "+ Agendar voo" is on the request's own list of operator restrictions and creates no pedido (docs/PLAN.md:421) | every booking registers a pedido: the server then needs a path past the deadline and the 6-local limit |
| "Demanda will consume approved pedidos" | they enter on "Atualizar a escala": one click per date, then by themselves | a save creates the date's day document, which freezes the aircraft hours and the rodízio copied from the day before | every approval enters at once, on any date |
| A column is "a field of the pedido, something derived, or an operator restriction in the Escala stage" | the restrictions are Escala-stage data, edited in the detail pane of the Processamento screen | a pedido that did not fit or was taken off has no row in the Escala | the block only in the Escala, with a second list of every voo there |
| "Voa" derived | on is derived; off stays an operator restriction of the date (`fly: false`), not a state of the pedido | one write, an undo that restores the place, works offline | "Tirar da escala" withdraws the approval |
| The screen "shows … why any of them cannot be scheduled" | two reasons with two names: "não cabe nem sozinho" (before the allocation) and "não coube" (the engine's rejection) | most reasons depend on the other voos; the first is the part that never does | one mixed list, as the red box of the Escala today |
| "in the spirit of `importarSolicitacoes`" | the module replaces it and also takes voos out | a cancelled pedido stays in the Demanda forever today | entries only |
| "missão definida pelo programa" | bound on entry and kept; a stale one is flagged and changed by the same click | recomputed live it advances after the voo's own result | — |
| "E. The Processamento module and its tests (no UI)" | E delivers the conciliation, the course mission and the pairing of rejections, called by today's import button and by the booking dialog; the reading functions come in G with the screen | the lint refuses exports that only tests use | the whole module in E, with a caller in the Demanda table that G deletes |
| "G. … the engine reading its output" | the engine keeps reading `S`; the module's output reaches `S` through `gravarAlteracao` | no second path into the engine | — |
| "Decisions this reverses" lists three | three more recorded decisions are restated: "Limpar demanda" (docs/PLAN.md:437) becomes "Recomeçar pelos pedidos"; the confirmation of a course mission "in Demanda" (:371) moves to the block; the release of a booked voo (:422) becomes one rule, without the "Usar" clause | the Demanda table is where they lived | keep "Limpar demanda" as a pure clearing |
| Operator restrictions "override any rule" | not changed here: a restriction overrides the app's choice; what breaks a rule is a conflict, and a chosen instructor who cannot fly the mission rejects it | posicao.md B7 | a rule change, in its own commits |

## 8. Questions for Pedro, each with the default this design implements

1. A student with no pedido, or a second voo for a student: only through a pedido ("Registrar e aprovar") or a booking? **Default: yes; "Pôr um aluno na demanda" and "+ missão" end** (1 action becomes 3 or more).
2. "Tirar da escala": a reversible restriction of the date, the pedido staying approved, or the withdrawal of the approval? **Default: the restriction.**
3. The pedidos enter a date by one click the first time, and by themselves after that. **Default: as described.** The other choice (every approval enters at once) creates the date's data days ahead.
4. A pedido cancelled when its voo is fixed or the schedule approved: the voo leaves and the schedule stays approved; it stays when in progress, landed, cancelled with its reason, with a result, after its take-off time, or on a past date. **Default: as described.**
5. A pedido without approval whose voo is already in the schedule: never removed without a choice ("Aprovar" or "Tirar da escala"). **Default: as described.**
6. The course mission follows the day's times, not the order of registration; a Solo at 06:30 gets none while its AV PROF. is later the same day. **Default: yes** (it changes what today's import gives for the same pedidos).
7. A closed course: the pedido enters without the course mission, with a notice. **Default: yes** (today it binds silently).
8. Hours: the pedido's win; the programme's are shown. **Default: yes.** The other choice: the programme's whenever a course mission is bound.
9. May the operator override the mission type of a pedido, as she can today? **Default: yes.**
10. "Limpar demanda" becomes "Recomeçar pelos pedidos", and a voo cancelled with its reason stays cancelled. **Default: yes.**
11. Stale course missions are changed by "Atualizar a escala" only when the resource type and the hours stay. **Default: yes.**
12. The restrictions block in the detail pane of Processamento. **Default: yes.**
13. May the warning `escolhido-saiu` (js/engine.js:994) stop naming "Demanda", in its own commit, with no golden changed? **Default: yes.**
14. Read the pedidos again when the window regains focus. **Default: yes.**

## 9. Risks, and what would make this design wrong

- **Numbers reused.** A pedido that leaves and another voo of the same student that enters can get the same number;
  pins, statuses and results cannot be inherited (the key must be clean), but an old `setFly` or `restaurarEscolha`
  entry of the History would act on the new voo. The same exists today with "✕" and "+ missão".
- **The pairing mirrors the engine's order.** If the queue sort changes and `naOrdemDoMotor` does not, reasons go to
  the wrong line. Guards: the invariant test, and the fallback to the label.
- **Dormant code in E.** The exit rules are tested in E and first used in G.
- **The 200 newest History entries of a date** (js/backends/supabase.js:172). A first conciliation writes one entry
  per pedido, as the import does. If D also logs approvals in the date's History, the read must be paged first:
  `agendamentosEmVolta` scans that list.
- **A date built early by the operator's own click** freezes the aircraft hours and the rodízio, as "Importar" does
  today. The design does not make it worse, and does not fix it.
- **D's choices this design assumes:** pedidos are not editable (an edit would need "follow the pedido" per field);
  withdrawal clears `aprovada_em`; the Secretaria does not cancel an approved pedido. If D adds flexible times to the
  pedido, only `pedidoDaSolicitacao` changes.
- **The detail pane holds the editing.** If the final screen design forbids inputs in Processamento, the block moves
  to the Escala and needs a list of every voo there.
- **Two steps that change next-mission results** (time order, closed course) ship in E as separate commits; if Pedro
  refuses one, that commit is dropped and nothing else depends on it.
- **What would make this design wrong:** a decision that the day must store nothing about requests (then decision 1
  falls and the restriction store is the only way); a decision that every booking is a pedido; or a volume of late
  cancellations by people who are not operators large enough that "leaves only on an operator's browser" is too slow
  (then the exit needs a server function, which cannot see the requests today).

<!-- fim -->
