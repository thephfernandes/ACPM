<!-- The orchestrator's working position after the discovery (2026-11-21). Local working note: never commit. -->

# Working position for the design (challenge it with evidence)

This is where the orchestrator stands after reading the digests of the 14 maps and the 9 gap answers. It frames the
design work. A position here is a default, not a ruling: if the maps or the code show it is wrong, costly or
incoherent, say so with the evidence and propose the alternative. What must not happen is silence: every place where the
plan departs from the letter of Pedro's request is written down as a conflict, with the default the plan implements and
what Pedro can choose instead (he answered the last plan with "go with defaults", so every open question needs a
default the work can proceed on).

## A. Facts the design has to live with (from the maps; evidence is there)

1. A flight is addressed everywhere by `fKey = <stuId>_<mid>_1`: pins (`dia.fixos`), statuses (`fStatus`), notes
   (`fObs`), the saved schedule rows, mission results on the server (column `voo`, append-only) and five History
   revert kinds. `mid` is 0 for a student's main request and a per-day running number for extras (`proximoMid`). A
   pedido id cannot be a `mid` (6 digits in `painel_do_dia`, 1e9 in the saved-schedule validator, local ids are
   `Date.now()`).
2. Operator inputs live ON the day's request record today: `insId` (chosen instructor), `pr` (priority), `fly: false`,
   overrides of `eq` (resource TYPE), duration, `p1`/`p2`/`jan`, and `etapa` (a course mission out of order). Bookings
   ("+ Agendar voo"), "+ missão" and "Pôr um aluno na demanda" create requests that have no pedido. `separar` writes
   `dia.pedidos` from `S.stu` at every save.
3. A pedido (`solicitacoes`) is one exact time: the import sets `p1 = p2 = jan = 'h<minuto>'`, `pr: 3`. So neither the
   engine nor the `horarios` criterion can move a pedido-born flight today; the engine only picks the resource and the
   instructor, or rejects.
4. The course mission is bound when the request is made (import, Usar, booking), not recomputed: recomputed live it
   would advance after the flight's own result.
5. `runAllocationEngine(state)` throws without `state.win` and `state.av` and each instructor's `aw`. The 41 goldens
   feed generated states straight into the engine, each file stores a hash of its input, 22 inputs close a `win`
   window (ignoring `win` changes 18 files), all use `aw`; none has pins, chosen instructors, criteria or `voaCom`.
   Presence ranges (adjacent true windows merged; the whole mission inside one range) reproduce `cobre` exactly; a
   start-only reading changes 37 of 41 files.
6. `win` is the only per-date, school-wide closing, and the only one that reaches Ground classes, the Noturno and the
   Voo Solo. It is copied forward to each new date.
7. Rejections (`err` alerts) carry a label, a text and a code, no request id; alert fields are in the goldens (36 of 41
   files have alerts). A request rejected when alone in the day is never placed in the full day (0 of 3,866), and the
   engine on one request takes about 0.1 ms: schedule-independent reasons can be computed outside the engine.
8. The cadastro is ONE document with one version (a stale tab's first edit gets PT409 and the screen locks until
   reload); every cadastro edit also saves the open date's day and is logged in that date's History. `separar`,
   `juntar` and the normalizers (`normalizarFrota`…) are whitelists: a new key is erased at the next save unless they
   list it. Deleting a person from `stu`/`ins` makes the server delete that person's personal data.
9. There is no cadastro-level inactive flag for anyone, no "nome completo", no "missão anterior", no instructor-side
   preference, no record of an export, no state for "motor" or "compactação" (one synchronous call of a few ms).
   Approval stores `aprovacao: { em, por }` in the day; nothing blocks approval except unread instructor hours.
10. `le_dados_pessoais()` is both the RLS read policy and the write check of TWO `salvar_dados_pessoais` overloads; the
    same function serves students and instructors. The Gestor has no CANAC (it is personal data). Two legacy overloads
    (`registrar_solicitacao` with 9 arguments, `salvar_dados_pessoais` with 3) are still installed and bypass newer
    rules; the app calls neither.
11. Shell: `show()` toggles every `<section>`; nine event modules bind 66 selectors at import and throw when one is
    missing; `save()` redraws before it saves; every breakpoint is on the viewport (no container queries, though the
    stylesheet already uses `:has()`, `dvh` and `color-mix()`); wide screens have minimum widths (Escala list 760 px,
    map 720, Painel 860, availability grid 960, Cursos editor about 836); `main` is capped at 1,280 px (content 1,248)
    and a test pins it; the Painel shows one list in the page only because of that cap (two lists from 1,600 px).
12. There are three date controls today, not one: the header's, the Agenda's own day (it opens on the first date still
    open for pedidos, and can show a Sunday) and the BI's "Data base" (`#bi-dt`).
13. Tests: `abrir` waits for `#wins input[data-a="win"]` as its "data loaded" signal; `irPara` has about 425 call
    sites; the phone and accessibility checkers only look inside `.topo`, `#nav` and `main section.on`; port 4173 is
    hard-coded and silently reused; the unused-exports lint fails a module that only tests import; `npm test` does not
    include the lint (CI runs `npm run lint` first); the Manual, the glossary and their tests name today's nine tabs.
14. Formats: `ESQUEMA` is 25; numbers must be contiguous and merged in number order; one number can carry several
    changes that ship together; each new number makes the first Operador opening rewrite every stored day. No SQL
    reads `aw`, `win` or the day's requests, so those are client format steps only. The preview database is shared by
    every branch.
15. Server state, from this session's own history (the PLAN.md notes saying "Not applied" and "Not deployed" are
    stale): migration `20261117200000_cursos_e_missoes` is applied to production (Pedro, 2026-11-19) and to the preview
    (2026-11-20); migration `20261120150000_painel_do_dia_com_a_configuracao` is applied to both (2026-11-20); the
    function `meteorologia` is deployed to both and the secret `REDEMET_API_KEY` is set on both (2026-11-20).

## B. Positions

### B1. The core: pedidos in, the engine's state out
- Processamento is a pure module, `js/processamento.js`, with no DOM, that supersedes `importarSolicitacoes`. It emits
  today's `state` shape (`stu[].fly`, `stu[].extra` and their fields), so `runAllocationEngine` and the goldens stay
  untouched (Pedro's preference).
- "No data of its own" is honoured this way: the stage has no input on screen and stores no value that is typed into
  it. The day keeps `dia.pedidos` in today's shape, but each record has exactly one origin: an approved pedido
  (`solicitacao: <id>`) or a booking (the pin marked `agendado`), and what the day stores about it is (a) the binding
  of the pedido to its flight key (the `mid`) and to the course mission it received when it entered the date, as the
  import does today, and (b) operator restrictions, which belong to the Escala stage. Keeping today's stored shape is
  what keeps pins, statuses, results, History reverts, the TV, BI and the exports working without re-keying anything.
- The module's main function is a reconciliation, not a one-way import: it ADDS a request for each approved pedido of
  the date that has none (today's `pedidoDaSolicitacao` rules), and REMOVES the request of a pedido that is no longer
  approved (cancelled, or the approval withdrawn), releasing its pin, except a flight in progress (Atrasado, Em Voo,
  Pousou), which stays, as "Limpar demanda" does today. It never touches a request without `solicitacao`.
- It runs through `gravarAlteracao` right after an approval, a withdrawal or a cancellation made in this browser for
  the open date. When a date opens (or its pedidos are read again) and the approved set differs from the day, the
  difference is shown ("2 pedidos aprovados fora da escala · Atualizar"), and an Operador applies it with one click;
  nothing is written by a read, and read-only profiles only see the notice.
- The Processamento screen shows, per pedido: what was asked, the course mission bound and what the program says now,
  the student's Priorizar com and Não escalar com, what the mission requires, the resources and INVAs that could serve
  it with the reason for each one that cannot (from `js/candidatos.js`), and why it cannot be scheduled: before the
  engine, only the schedule-independent reasons (computed by the pure module); after it, the engine's rejection.
- Hand-made requests end: a flight enters the day as a pedido (the Operador registers and approves in one action) or as
  a booking. Requests without a pedido that already exist in stored days stay and keep flying.

### B2. Where each Demanda column goes (10 columns, not 9: the first is "Aluno")
| Today | After |
|---|---|
| Aluno (name, course mission code, "Próxima · Usar", "Outra missão…", "+ missão", booked tag, ✕ of an extra) | the pedido's student; the course mission is derived from the program and bound at entry; another mission (out of order, with the confirmation) is an operator restriction; "+ missão" is a second pedido; the booked tag shows on the flight |
| Voa | derived: the pedido is approved. Turning it off is withdrawing the approval |
| Missão (type) | a field of the pedido (exists) |
| Recurso (the TYPE) | derived from the mission and the program; another type is an operator restriction |
| Instrutor | an operator restriction (the chosen instructor, exists) |
| 1ª preferência, 2ª preferência, Disponibilidade | fields of the pedido. Today a pedido has one exact time, so the plan proposes two nullable columns (a second preference and an availability) in D's migration; the alternative (keep one exact time) leaves the `horarios` setting with nothing to act on |
| Duração | a field of the pedido (exists: `horas`), with the program's as the default |
| Prioridade | an operator restriction |

### B3. Pedidos (workstream D)
- Rename the screen text only ("Pedidos"). Keep `js/agenda.js`, `js/views/agenda.js`, `js/eventos/agenda.js` and the
  table `solicitacoes`: in code `pedido` already means the day's request, and a table rename would break the live app
  between the production migration and the merge.
- Approval is additive: nullable `aprovada_em`, `aprovada_por`, and RPCs to approve and to withdraw (Operador and
  Administrador only). States on screen: aguardando aprovação, aprovado, cancelado. Refusing is cancelling.
- An Operador's own registration offers "Registrar e aprovar" (the record shows no Secretaria account at go-live).
- The Secretaria cannot cancel an approved pedido (she asks the operator); a cancelled approved pedido leaves the day
  through the reconciliation.
- Sundays: the Exceção da Coordenação stops accepting a Sunday or a past date (today it does, and such a pedido can
  never be seen once the rail is the only date control). The 9-argument overload is dropped in the same migration.
- Pedidos already imported (`dia.importadas`) are marked approved at the cut-over.
- Between D and G the Demanda's "Importar da agenda" imports only approved pedidos.
- The month calendar leaves the page; the rail's calendar shows the per-day count through a small RPC that returns
  counts, not rows (today: one unpaged `select *`, capped at 1,000 rows).

### B4. The shell (F1)
- The pipeline is the primary navigation: four cards in a row. A second-row card "Cadastros" (rows Alunos, INVAs,
  Recursos, Cursos), joined into Processamento as in the second reference, is the secondary navigation. The Rodízio is
  per-date data and an engine input: a row of the Escala card. BI, Histórico, Manual and the account menu stay in the
  header. The Painel stays the Escala's fourth view, and painel.html is untouched.
- Three panes: the list, the detail, the rail. Screens that are overviews and need width (the Escala's list, maps and
  Painel, the Cursos editor, BI, the Rodízio) span the list and detail panes; the rail is always the third pane.
- The cap: `main` moves from 1,280 px to about 1,600 px with a rail of about 320 px, so the two content panes keep
  today's 1,248 px and the Painel still shows one list in the page. Below that width the rail collapses to a date
  button; on phones the list comes first and the detail is a second view.
- New components use container queries; old screens keep their viewport queries until their workstream rewrites them.
- The rail's calendar is the only control of the OPEN date. The BI's "Data base" stays (it is a report's period, and
  the BI's behaviour does not change). Pedidos uses the open date; for the Secretaria the app opens on the first date
  still open for pedidos.
- Until each stage's own screen exists, the cards open today's screens (Pedidos opens the Agenda, Processamento the
  Demanda, Escala the Escala, Aprovar the Escala's approval control). No step leaves two versions of a screen.
- "No modal for viewing or editing a record" applies to records (the drawers `#painel-instrutor` and `#painel-dados`
  go). Dialogs that are actions stay: "Agendar voo", the status detail, "Configurar painel", the re-login. The
  Histórico stays a drawer (a log, not a record), opened from the header, and must not cover the date control.

### B5. Cadastros (F2, F3, A, B, C)
- One cadastro-level flag, `inativo` (absent means active), for students, instructors and resources, added to the
  whitelists in ONE foundation format step (26), so A, B and C need no number of their own for it. An inactive record
  stays in the cadastro (the server deletes the personal data of anyone removed). The engine gets a state without the
  inactive ones; nothing is forced into `on`, `av` or `fly`. Deleting ("✕", "Retirar") stays, de-emphasised.
- The detail pane has two labelled scopes: "Nesta data (sex 20/11)" (Vem and the ranges; Disponível, the hours until
  the inspection) and "Cadastro (todas as datas)". The "Disponibilidade do dia | Cadastro" switch goes.
- Alunos: "nome completo" does not exist; proposal: a column in `dados_pessoais` (it is personal data), with `nm`
  staying the short name used on the schedule. "Missão atual" is the program's next released mission(s); "missão
  anterior" is the latest result. They change by registering a result in the detail pane (the RPC accepts a result
  without a flight), Operador and Administrador only.
- The Secretaria stops EDITING personal data, of students and instructors alike (one function serves both); she keeps
  reading. The migration splits the read and write predicates and drops the 3-argument overload. Because it tightens
  a permission, the client that stops offering her the form is merged BEFORE the migration reaches production (the
  one exception to "migration before the merge").
- Recursos: the list is grouped by category; the category's own detail holds the Horários de decolagem editor; "Ordem
  no hangar (nesta data)" is a pinned first item of the list whose detail is the full order.
- F3: a resource gets `exige`, a list of habilitação ids of the same registry (`HABILITACOES` plus
  `aviao:<matrícula>`); `habilitacaoPropria: true` converts to `exige: ['aviao:<reg>']` and stays in the data. The
  groups of the registry move from the Instrutores view into `js/habilitacoes.js`. No golden changes.
- INVAs: "preferences" do not exist on the instructor's side; the detail shows, read-only, the students who point at
  him (Priorizar com, Não escalar com).

### B6. Availability ranges and `win` (C, B)
- One stored shape for C, one format number (27): per date, `faixas`, a list of `{ de, ate }` in minutes, the earliest
  and the latest mission start. Commit 1 converts `aw` and reads the ranges with today's meaning (a window is on when
  its start is inside a range; the whole mission inside on-windows), with a read of `aw` when a state has no
  `faixas` (the golden inputs, old History payloads): goldens byte-identical. Commit 2 changes the meaning to "the
  mission STARTS inside a range", re-records the goldens (about 37 of 41 files) and brings the free-form editor.
  `on` ("Vem") stays.
- `win`: the "Janelas de operação" section leaves Recursos. The data and the engine's reads stay (the goldens depend
  on them). The per-date closing becomes an operator restriction of the date ("Fechar um período nesta data"), written
  to the same `dia.win`, re-homed in the same commit that removes the section, and no longer copied to new dates.

### B7. Escala and Aprovar (H)
- The Escala stage keeps its four views and every flight-level action, before and after approval (status, results,
  Sugestões, booking): what follows approval stays there.
- Its configuration is the two criteria, with the stored ids unchanged (`aviao`, `fixos`…): labels only. Two of the
  requested labels misdescribe the code and are raised as questions: "Recurso" (the cost counts aircraft only) and
  "Não considerar" (`fixos` means the compaction never changes a flight's time).
- Operator restrictions keep today's meaning: the engine never moves or drops them and flags what breaks a rule as a
  conflict. "Override any rule" as a rule change is a question for Pedro, not a default.
- Aprovar: the pending items (rejections, conflicts, warnings), approve or reopen with who and when, and the exports.
  Approving with pending items asks for a confirmation and never blocks. "Exportada" needs new data: a small per-date
  record of exports made by an Operador or Administrador.
- The pipeline rows are computed by one pure adapter over `S`, the engine's result and the date's pedidos, with no new
  field on the engine's alerts. Rows the code cannot back are renamed or moved ("preferências aplicadas" and "pedidos
  que não cabem" are engine outputs; "fora do prazo" is not a stored state; "motor" and "compactação" have no running
  state).

### B8. Delivery
- A step zero with no visible change comes first: test infrastructure (a port per worktree, `abrir` waiting for
  `body[data-pronto]`, the lint in each step's green check), a redraw registry so `main.js`, `actions.js`,
  `registro.js` and `historico.js` stop naming every screen, the save before the redraws, the split of the
  Alunos/Instrutores shared modules, one stylesheet per screen so parallel steps never edit the same lines, and the
  PLAN.md records brought up to date.
- Format numbers: 26 in the foundation (the `inativo` flags and `exige`), 27 in C (ranges), 28 in G (the day's requests
  bound to pedidos; `importadas` to approvals), 29 in H (the exports record). A, B, D and E need none.
- Migrations get their timestamps in the plan, in the order they are applied to the shared preview.
- E wires the new module into today's import button, so the lint passes and the 21 import tests guard it.
- Manual, glossary, README and their tests change in the step that changes each screen (the tests force it); step I is
  the final sweep.
- Branches `linha-f0-…` to `linha-i-…`, one PR per step, stacked, each leaving the app coherent.
