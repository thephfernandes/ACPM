<!-- Pedro's request of 2026-11-21, verbatim. Local working note: never commit this file. -->

Redesign: AutoEscala as a left-to-right production line
Two reference screenshots go with this prompt (Outlook three-pane, GitHub Actions graph). They are described in full under "Visual references" so subagents can work without them. The Outlook one shows work e-mail: never add it to the repo, which is public.

(Note from the orchestrator: the "Visual references" text is in `referencias-visuais.md`, next to this file, written from the two screenshots.)

Why
The app overloads our champion operator, the one person at ACPM who builds the escala every day. Nine tabs sit side by side (Escala · Demanda · Agenda | Recursos · Instrutores · Alunos · Cursos · Rodízio | BI) and nothing shows that they are steps of one process. We are reorganising the app around what actually happens, left to right:

```
Pedidos → Processamento (Demanda) → Escala → Aprovar

```

This is a restructuring of screens and of how data flows into the engine. The allocation rules themselves do not change unless a section below says so.

How to work

1. Start from `upstream/main` (gdruumond/ACPM) after a fetch; local `main` may be far behind. Read `README.md` and `docs/PLAN.md` first, especially "Abas de cadastro, Recursos e Cursos (2026-11-19)": this redesign supersedes three decisions recorded there (see "Decisions this reverses").
2. Discovery, no code changes. Then add a section to `docs/PLAN.md`, in the style of the existing ones, with: the current → target map, where every existing control ends up, data-format steps and database migrations, the workstreams with the files each owns, the order, what is deleted, and open questions. Stop there and wait for my approval.
3. After approval: shared foundation first, serially. Then independent workstreams in parallel with subagents, one git worktree and branch each, one PR per step from the fork to upstream, as the `abas-*` branches did.
4. Keep the repo's working rules: tests first; `npm test` green on every step (node:test, Playwright, ESLint); an independent review of each step before its PR; database tests only on the preview project; migrations applied to preview, then production, before the merge; README "Estrutura", the in-app Manual and the glossary updated with the change; identifiers and commit messages in Portuguese; no build step and no new dependencies.

Target model

1. Pedidos (today: Agenda de Solicitações)
The registro de pedidos dos alunos. Rename the tab and the user-facing text to "Pedidos". Recommend in the plan whether `js/agenda.js`, `js/views/agenda.js`, `js/eventos/agenda.js` and the `solicitacoes` table are renamed too.
Today a pedido is only registered or cancelled, and "Importar da agenda" copies it into the Demanda. Demanda will consume approved pedidos, so a pedido needs an approval state. Propose who approves (default: Operador and Administrador; the Secretaria keeps registering) and the migration with its pgTAP tests. Keep the existing rules: the 13:00 deadline, Exceção da Coordenação, no Sundays, the local-flight limit.
The page's own month calendar (`calendarioHTML`) goes away; the right-rail calendar replaces it.

2. Processamento (Demanda)
Today the Demanda is a table the operator edits by hand for each date (Voa, Missão, Recurso, Instrutor, 1ª and 2ª preferência, Disponibilidade, Duração, Prioridade), stored in the day as `stu[].fly` and `stu[].extra`, which `runAllocationEngine(state)` reads directly. That is the confusing part.
It becomes an aggregation and enrichment stage with no data of its own. Input: the approved pedidos of the date. It joins them with:

* the student's registered preferences (Priorizar com, Não escalar com) and course progress (the next mission, `js/progresso.js`)
* the mission's requirements (`js/rules.js`, `exigencias` in `js/habilitacoes.js`)
* the restrictions of the resources (availability, hours until the 50 h inspection, attributes) and of the INVAs (availability, habilitações, legal limits)

Output: what the engine consumes. Build it as one pure module, tested without the DOM, in the spirit of `importarSolicitacoes`. Say in the plan whether it emits today's `state` shape, so the engine and its 41 goldens stay untouched (my preference), or whether the engine's input changes.
For every column of today's Demanda table, the plan must say where it lives afterwards: a field of the pedido, something derived, or an operator restriction in the Escala stage. The screen for this stage shows the enriched pedidos and why any of them cannot be scheduled.

3. Escala
The result of the algorithm. Inputs, in priority order:

1. Restrições impostas pelo operador, which override any rule. These exist: fixed flights (`js/fixos.js`), the chosen instructor (`js/instrutor-escolhido.js`), "+ Agendar voo".
2. The output of Processamento.
3. The optimisation settings. These exist in `js/criterios.js` and stay as they are, presented as this stage's configuration:
   * Redução de ociosidade (`buracos`): INVA | Recurso (today labelled "Avião") | Maior buraco, whichever kind
   * Prioridade de horários dos alunos (`horarios`): Só 1ª e 2ª | Na disponibilidade | Não considerar (today "Não mudar")

4. Aprovar
Approval exists as a control in the Escala toolbar (`#aprovacao`, `fixosAoAprovar`, reopen). It becomes the last stage: unresolved conflicts, approve or reopen, then the exports (CSV, PDF, Excel for CAVOK).

Cadastros that feed Processamento
Alunos, INVAs and Recursos all become master–detail screens (see Layout): a compact searchable list on the left and the selected item open in the middle pane, editable there. This replaces the wide tables and the editing drawer. No modal or pop-up for viewing or editing a record.

Alunos. Search by name or CANAC (accent-insensitive, `chaveDeBusca`). The detail shows and edits: CANAC, CPF, nome completo, curso matriculado, missão anterior, missão atual, celular, e-mail, peso, preferências (Priorizar com, Não escalar com), plus nascimento, which exists today. Missão anterior and atual come from the course results; say how editing them works (I expect through registering a result, not free text).
Permissions. Operador and Administrador edit every field. The Secretaria must not edit. Today `salvar_dados_pessoais` accepts the Secretaria, so this needs a migration and pgTAP tests, not only a hidden input. The Gestor stays read-only and without personal data.

Recursos. The detail shows the hours available until the inspection and the maintenance status, and the habilitações an INVA needs to operate that resource. The requirement must point at the same registry the INVAs' habilitações use (`HABILITACOES` plus `aviao:<matrícula>`, `js/habilitacoes.js` and `js/frota.js`): one type, referenced from both sides. Propose whether the `habilitacaoPropria` flag becomes a list of required ids.
Remove the top-level "Janelas de operação" (`state.win`). Take-off times are already set per category in the cadastro (`js/horarios.js`), so the two overlap. Find every reader of `win` and say what replaces closing a period for one date, if anything. The "Ordem no hangar" stays; place it.

INVAs. Search by name. The detail shows CANAC, contact data, habilitações, peso, preferences. Availability changes model: today it is one boolean per fixed window (`aw`, nine entries of `WIN`), which no longer fits, since take-off times vary by category and one INVA operates several resources. New model, per date: one or more ranges of earliest and latest mission start time, with gaps allowed (a lunch break). Do it in two commits:

1. Convert `aw` to ranges as a data-format step in `js/migracoes.js`, with `viabilidade.js` reading ranges. The goldens must not change.
2. If the meaning changes (a range limits when a mission may start, where today `cobre` requires the whole flight inside the windows), make that its own commit, re-record the goldens and review the diff.

Deactivating. Alunos and Recursos get a switch on the list row and a toolbar filter to show or hide inactive items. This is cadastro-level and applies to all dates; keep it distinct from "not available on this date" (find how `on`, "Vem", "Disponível" and "Retirar" work today). Apply the same to INVAs unless there is a reason not to.

Layout
Three panes on every screen, desktop first:

```
┌──────────────────┬────────────────────────────┬───────────────┐
│ [filter]         │ Title of the selected item │ Novembro  ‹ › │
│ search           │ ─────────────────────────  │ D S T Q Q S S │
│ ───────────────  │ ▸ collapsible section      │  month grid   │
│ ● Name      meta │ Label: value               │ ───────────── │
│   second line    │ Label: value               │ Hoje · sex 20 │
│   third line     │                            │ 11:00 ▌ item  │
│ ───────────────  │                            │ 11:30 ▌ item  │
└──────────────────┴────────────────────────────┴───────────────┘
    about 30%              about 48%               about 22%

```

* Left, the list. Rows tightly stacked, a hairline between them, no card around each row. A row has a small status dot at the far left, a round avatar with initials, then up to three lines: the name (largest, semibold), a second line in the accent colour (CANAC and course; category for a resource), a muted third line cut with an ellipsis. Small right-aligned meta on the second line. The selected row has a lighter background across the full width. The filter control sits above the list, at the top of the pane; the list scrolls on its own. Each row carries its active switch; inactive rows are dimmed.
* Middle, the detail. A large title, with icon actions at its right. Sections stack below, the first ones collapsible bars with a chevron. Fields read as "Label: value" lines with generous spacing and are edited in place. With nothing selected, an empty state.
* Right, a fixed rail. A month calendar: the month name, a weekday-initial row, a grid of plain numbers, today as a filled accent circle, the open date distinct from today, the next month's first days shown after the last week. It is the app's only date control: it replaces the header's `.topo-data` (previous day, next day and the native date input, which feedback called confusing) and the Agenda's calendar. Days could carry the pedido count the Agenda calendar shows today. Under it, a line naming the open date, then the notifications of that date as an agenda list: a time at the left, a thin coloured bar for severity, a bold title cut with an ellipsis, a muted second line. Sources that exist: the tab badges (`selo-esc`, `selo-age`, `selo-rec`), the conflicts (`js/conflitos.js`), the engine's warnings.

Use the app's existing light and dark tokens in `css/app.css`; the references show structure, not colours. The page is capped at 1,280 px today, so say what happens to that cap. Phones and 320 px are tested (`celular.spec.js`, `percorrerVistasEFiltros`) and must keep passing: propose list, then detail as a second view, with the rail collapsed into a date button.

Pipeline view
The four stages are the primary navigation and read as a workflow graph:

* One rounded card per stage, in a row, left to right, the same height when they have the same number of rows.
* Each card has a small connector dot at mid-height on its left and right edges; a thin line joins one card's right dot to the next card's left dot.
* Inside a card, the sub-tasks are stacked rows: a round status icon at the left (green with a check when done, red with an x when failed, plus pending, running and needs-attention), the name, and a right-aligned muted value (a count or a time).
* A click on a stage opens it; a click on a sub-task opens the place where it is resolved.

A first list of sub-tasks, to be checked against the code:

* Pedidos: registrados · fora do prazo ou com exceção · aguardando aprovação · aprovados
* Processamento: missão definida pelo programa · preferências aplicadas · recursos disponíveis · INVAs disponíveis · pedidos que não cabem
* Escala: restrições do operador · motor · compactação · conflitos e avisos
* Aprovar: conflitos pendentes · aprovada por quem e quando · exportada

Say where Cursos, Rodízio, BI, Painel, Histórico and Manual go; their behaviour does not change.

Decisions this reverses (PLAN.md, 2026-11-19)

* "No sidenav, the segmented switch everywhere": the cadastros become master–detail lists.
* "The Demanda stays the students' day view": it becomes the derived Processamento stage.
* Recursos and Instrutores split into "Disponibilidade do dia | Cadastro": decide whether the detail pane shows both or the split stays inside it.

Reuse what that work built: `chaveDeBusca`, the multi-value filter component, `mostrarVista`, the focus keeping.

Workstreams
Adjust after discovery and justify the changes. `index.html`, `css/app.css`, `js/eventos/registro.js` and `js/migracoes.js` are shared by everything, so each needs one owner per step. `ESQUEMA` is 25: give every data-format step its number in the plan, so parallel branches do not collide.

Foundation, serial:

* F1. The shell: pipeline navigation, the three-pane layout, the right rail with the single open date
* F2. The master–detail list component (search, filters, row switch, selection, keyboard and screen-reader behaviour)
* F3. Habilitações as one registry referenced by INVAs and by resource requirements

Parallel, after the foundation:

* A. Alunos, with the Secretaria permission migration
* B. Recursos, with the removal of Janelas de operação
* C. INVAs, with the availability ranges
* D. Pedidos: the rename, the approval state, the page rework
* E. The Processamento module and its tests (no UI)

Serial, last:

* G. Processamento screen and the engine reading its output
* H. Escala settings and Aprovar as stages; the pipeline's sub-task states
* I. Removal of everything replaced; Manual, glossary and README

Guardrails

* `runAllocationEngine` stays a pure function. The goldens change only in commits whose purpose is a rule change.
* `gravarAlteracao` stays the only way events change data; nothing is saved before the date's data is read.
* Data-format steps never delete fields. The server refuses older formats.
* Personal data stays out of CSV, PDF, BI and the History, as today.
* Tests use only fictitious names and weights.
* Delete what is replaced; do not leave two versions of a screen.
* Where this prompt conflicts with the code, raise it in the plan instead of guessing.
