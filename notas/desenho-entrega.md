<!-- Design note for the production-line redesign. Local working note: never commit this file. -->

# Desenho: Delivery: the steps, the files each owns, the order, the numbers, the tests and the deploys

Designed on the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to its root; a bare
`mapa-x 5.y`, `lacuna-…` or `desenho-…` is a note of `.redesenho/notas`. Checked in the code: `package.json`,
`playwright.config.js`, `scripts/serve.mjs`, `scripts/exportacoes-sem-uso.mjs:85-146`, `.github/workflows/testes.yml`,
`js/main.js:14-145`, `js/actions.js:100-200, 300-382`, `js/eventos/registro.js`, `js/eventos/navegacao.js`,
`js/eventos/escala.js:1-30, 230-300`, `js/eventos/historico.js`, `js/agenda.js:1-160`, `js/reversoes.js:43-116`,
`js/views/demanda.js:81`, `js/dias.js`, `js/frota.js`, `js/migracoes.js`, `js/storage.js:44-242, 380-400`,
`js/dom.js:262-314`, `index.html:14-20, 260`, `painel.html:1-25`, `test/e2e/fixtures.js`, `test/e2e/app.spec.js:66-92`,
`docs/PLAN.md:84, 118-122, 156-166, 190-192`, two SQL files (`20261114151953`, `20261114230012`) and
`git log --first-parent --format='%an | %cn'` (every merge into upstream shown, 30 of 30, is Gabriel Drumond's, committer
GitHub; #43 to #47 within one minute on 2026-11-20). Experiment of the first version, in a scratch repository outside the
worktree: two branches that edit adjacent lines conflict; one unchanged line between the edits is enough to merge; two
insertions at the same place conflict. Nothing was run against a server.

This revision answers the two reviews (`revisoes-entrega.json`) and aligns with the sibling notes as they stand:
desenho-nucleo (the final core), desenho-pedidos (revised), desenho-escala-aprovar (revised), desenho-disponibilidade
(revised), desenho-casca, desenho-lista, desenho-cadastros. Where two siblings disagree on something this note schedules,
the default is chosen here and the other reading is a question (section 8).

Assumptions taken from the other topics:
- **S1** The engine's only input stays `dia.pedidos`; requests without a pedido stay valid in stored days (desenho-nucleo
  decisions 1, 11). So seeds built with `aluno(id, pedido)` keep producing flights after G.
- **S2** `js/agenda.js`, `js/views/agenda.js`, `js/eventos/agenda.js` and `solicitacoes` keep their names (posicao B3;
  desenho-pedidos 2.1).
- **S3** BI, Histórico, Manual and the account menu stay in the header; `painel.html` is not edited (posicao B4;
  desenho-casca D6, D29).
- **S4** `inativo` and `exige` share format 26 in F3, which ships the gate and no switch (desenho-cadastros 2.3, 4;
  desenho-lista 7); "nome completo" is a column of `dados_pessoais` (desenho-cadastros, M1).
- **S5** `win` stays in the data; closing a period for one date moves to the Escala stage in B (desenho-disponibilidade
  D21-D23).
- **S6** The record of exports is day data (`exportacoes`, `reabertura`), no SQL (desenho-escala-aprovar 4).
- **S7** The server state of posicao A15. It does not settle the Auth `config push` recorded as pending on 2026-11-11
  (docs/PLAN.md:192; lacuna-1-pendencias H1).
- **S8** Operator restrictions stay on the record and are edited in the Escala stage (desenho-nucleo decisions 9-10;
  desenho-escala-aprovar decision 1).
- **S9** D is three PRs, D1 being the server (desenho-pedidos 5); E's module receives D's predicate (desenho-nucleo
  decision 19).
- **S10** Format 28 changes no stored data (desenho-nucleo decision 18).

## 1. Decisions

| # | Decision | Why | Evidence | Rejected, and why |
|---|---|---|---|---|
| 1 | **Eighteen PRs after the plan, one stack** (table 2.1): F0a, F0b, F0c, F3, F1, F2, A, A2, B, C, D1, D2, D3, E, G1, G2, H, I; a nineteenth, C2, only if Pedro says yes to the rule change. Changes to the request's list: a step zero in three PRs; F3 before F1 and F2; F2 lands with Alunos; A's tightening in its own PR (A2); D in three PRs (its owner's split, D1 being the server); G in two (G1 the editor of a flight's restrictions, G2 the screen that deletes the Demanda). | Each change removes a collision, a red CI, a migration that would need an exception, or a deletion before its replacement exists. | Decisions 2-9 and 17. | The list as written: F2 and E cannot be green alone (4); 26 and 27 split across F2 and F3 (3); the Secretaria rule needs an exception (8); G deletes the only control of `pr`, `eq`, `nb`, the times and `insId` without a pin (17). |
| 2 | **F0 has no visible change and is three PRs:** `linha-f0a-testes` (the e2e reaches the app only through per-screen drivers; screen-specific tests leave the two cross-screen spec files; the lint inside `npm test`; a port per folder for Playwright and for `npm run serve`; the e2e duration measured), `linha-f0b-costuras` (a redraw registry, the save before the redraws, a revert registry, the shared modules split, the result handler and two screen branches of the navigation moved to their screens, the import half of `js/agenda.js` out, `js/main.js` importing one module per screen), `linha-f0c-estilos` (one stylesheet per owner; the Manual one sentence per line). | Without them the parallel phase edits the same lines: six hand-written redraw lists; 21 lines that call two or more of `rDem`, `rAlu`, `rIns`, `rRec`, `rAgenda`; one revert chain; adjacent screen branches in `js/eventos/navegacao.js`; CSS rules that name several screens; spec files nobody owns (`#eqs` in 13 files, `#inst-dia` in 11, `data-f="fly"` in 11). Three PRs because one "everything moved" diff cannot be reviewed. | lacuna-1-importadores 4, 7; lacuna-1-css 4, 5; mapa-testes 5.3, 5.7 item 8; `js/eventos/historico.js:46-124`; `js/eventos/navegacao.js:11-13, 49-53`; `js/eventos/escala.js:233-262`. | One F0 PR: unreviewable. "Parallel steps add, the last step deletes" (lacuna-1-css suggestion 3): dead selectors and two homes for one rule until I, and nothing for the JavaScript and the specs. |
| 3 | **F3 comes right after F0 and carries format 26 for the whole foundation** (`inativo` on students, instructors and resources; `exige`), gating every reader of the three rosters through `js/inativos.js` with nobody inactive yet. A, B and C add only the switch and the filter of their own list. | The number sits at the bottom of Onda 1, so after the wave's opening everything above it can still be reverted top-down (2.8). Whichever of F2 or A draws the switch on Alunos (desenho-lista 7 puts it in A), the flag is storable and gated before. One number instead of two. F3 and F1 share files (`js/actions.js`, `js/views/selos.js`, `js/views/agenda.js`, `index.html`, `js/glossario.js`), so they stack anyway. | mapa-dados 5.3 ("one number can carry several changes" that reach `main` in one merge); desenho-cadastros 4-5 (`js/dias.js:41-47`, `js/frota.js:62`, the readers); lacuna-1-onde-invas-e-recursos-sao-listados. | The request's order (F1, F2, F3) with 26 in F2 and 27 in F3: every later number shifts and the conversion of `habilitacaoPropria` is stored before its reader exists. |
| 4 | **A module never lands without a caller in `js/`.** F2 lands with Alunos; E lands as the body of today's "Importar da agenda"; G1 lands with the Escala rows that open its editor. | The unused-exports lint, a CI step, refuses an export that only tests import. The repo's precedent: the multi-value filter landed with Instrutores › Habilitações. | `scripts/exportacoes-sem-uso.mjs:134-143`; `.github/workflows/testes.yml:18-19`; docs/PLAN.md:446. | A throw-away caller in `scripts/` or a demo page: "delete what is replaced" forbids it. |
| 5 | **The parallel phase is four lines from F2's tip: [A → A2 → D1 → D2 → D3], [B], [C], [E's pure module]. They rejoin as one line in the order A, A2, B, C, D1, D2, D3, E. The SQL reaches the preview in name order as each file is ready (A, A2, D1), independent of the PR order: D1's branch is cut from A2, so its migration and pgTAP run on the preview while B and C are still being built.** | The preview is one database and `supabase db push` sends every file the checkout holds, refusing a checkout that lacks a version the remote has: the SQL needs one lineage. D's migration is the largest of the plan and must meet a real database before its screen is built ("tests first"). A and D both edit `js/backends/supabase.js`, `js/storage.js` and the fake server: stacking D1 on A2 makes them serial. B and C carry no SQL. E needs only F0b's module until its last commit, which wires it into D's import handler. | mapa-banco 5.7-5.8; lacuna-1-pendencias implication 3; desenho-pedidos 4 ("D's push waits for both", "D1 … the migration reaches production before its merge"); desenho-cadastros 5 (A edits `js/backends/supabase.js:241-255`, `js/storage.js:303-305`); the reviewers' scratch run (D after `js/storage.js:290` and A at `:292` conflict). | Five independent branches rejoined A, A2, B, C, D, E (the first version): D's SQL first met a database at the end of the parallel phase, and A and D collided in two files. Independent PRs merged as each finishes: the order of migrations and numbers would follow who finishes first. |
| 6 | **Ownership: one owner per file per step; files with two parallel editors have named regions (2.3); frozen shared files change only through a shared-fix branch (2.4).** | Adjacent edits conflict, so "different functions of one file" is safe only when the regions are named and apart. | The scratch experiment; lacuna-1-importadores 7. | "Parallel steps add, the last step deletes": decision 2. |
| 7 | **Format numbers: 26 in F3, 27 in C, 28 in G2; none elsewhere. 28 converts nothing: it protects `etapaDoPrograma`, the new use of `importadas`, and the two day keys H writes (`exportacoes`, `reabertura`), which G2 whitelists and normalises before anyone writes them. H takes no number.** The only literal pin of the number moves to `test/unit/migracoes.test.js` (F0a). | Contiguous, merged in number order by the stack; only one parallel branch carries a number. Folding H's keys into 28 uses the same rule as 26 ("one number can carry several changes"; a tab on G2's code keeps the keys, a tab before 28 is refused): one sweep fewer and H stays revertible. | `js/migracoes.js:13, 224-229`; `test/unit/config-do-painel.test.js:127, 129`; mapa-dados 5.3; desenho-nucleo decision 18; desenho-escala-aprovar 4 (29 was `dia => dia`). | 29 in H (desenho-escala-aprovar 4; the first version): a third forward-only sweep, for two keys with no conversion. Reserving slots per branch: a slot filled after a database was written past it never runs. |
| 8 | **Five migration files, one lineage** (section 4): A's expand, A2's tightening, D1's approval, G2's re-run of the conversion, I's contract. A2 exists so "preview, then production, before the merge" holds for every file. **Every push is made from a checkout of that step's own branch tip, after `supabase db push --dry-run` lists exactly that step's file.** | `salvar_dados_pessoais` ignores keys it does not know, so A's column must exist before A's client; the tightening must come after A's client is live. G2's file catches the pedidos an old tab imported between D1's production push and D2. The integration worktree holds later files (in Onda 1 its tip already holds A2's): a push from the tip would send two. | `20261114151953_dados_pessoais_versionados.sql:20-25, 103-107`; mapa-banco 5.7 b; desenho-pedidos 2.9 (the conversion and G's run of it), 4; lacuna-1-pendencias implication 8. | Four files (the first version: no re-run at G). posicao B5's single file with "the one exception to migration before the merge": not needed once the file is split. |
| 9 | **The three legacy drops ride with the redesign's own files:** the 3-argument `salvar_dados_pessoais` in A2, the 9-argument `registrar_solicitacao` in D1, the 10-argument one (D1's shim) and the conversion function in I. `importar_cursos` stays out. | No extra production deploy; D1 replaces the registration signature anyway. | lacuna-1-pendencias D; desenho-pedidos 4. | A first, separate contract migration (lacuna-1-pendencias suggestion 4): one more deploy for a bypass open since 2026-11-14 (risk 9.10). |
| 10 | **"Green" is `npm test` with the lint inside it, run in CI mode in the step's worktree (`CI=1`: `forbidOnly`, no snapshot created), plus the PR's own run on upstream before the merge, plus the gate of the step's kind (2.6). F0a measures the e2e duration and splits CI into two shards if the e2e step passes 10 of the job's 15 minutes.** | `npm test` runs no lint today. The workflow runs on upstream for the PRs (Pedro's flow watches `gh run watch … -R gdruumond/ACPM`); on the fork it runs only if Actions are on there, which the repo does not record. The duration was never measured and the plan adds about 160 e2e tests. | package.json:11, 15; `.github/workflows/testes.yml:3-5, 10, 18-34`; mapa-testes 5.1, 5.7 items 1 and 5. | A new `npm run verificar`: one more name for what Pedro calls `npm test`. Trusting "one CI run per push" for branches whose PR is not open yet. |
| 11 | **A place keeps its name until the step that changes it.** From F1 the cards read Agenda → Demanda → Escala → Aprovar (Aprovar opens the Escala at its approval until H); D2 renames the first to Pedidos, G2 the second to Processamento, C "Instrutores" to "INVAs". | The label, the screen's `h2`, the Manual's `h4` list and the glossary group are pinned together by tests; 24 lines of `js/` outside the glossary say "Demanda" or "Agenda", six of them History descriptions, and they change only with D2 and G2. | `test/e2e/app.spec.js:10, 159`; `test/unit/glossario.test.js:20`; lacuna-1-textos 0, 3, 4; desenho-casca D7. | Final names from F1: a card "Processamento" over a table whose texts and History lines say "demanda". Three cards until H: question 10. |
| 12 | **Manual, glossary, README and their tests change in the step that changes the screen; I is the last read-through.** F0c makes that mergeable: the Manual one sentence per line, `ABAS_DO_GLOSSARIO` one group per line, the Manual test's phrases grouped by owner in `test/e2e/manual-frases.js`. | The tests force it (the nine `h4`, 57 required phrases, `#manual-janelas` with 9 items); the reflow turns four steps editing one `<li>` into edits of separate lines. | mapa-testes conflict 5 and 5.5; index.html:445. | Everything in I: no step before I could be green. |
| 13 | **Release in five sittings: Onda 0 (plan, F0a, F0b, F0c), Onda 1 (F3, F1, F2, A, A2, B), Onda 2 (C), Onda 3 (D1, D2, D3, E, G1, G2), Onda 4 (H, I). Gabriel merges, at an hour agreed with Pedro (default: Saturday, after Monday's escala is approved and exported); Pedro runs every server command and opens production first. After an opening that sweeps the stored days, undo is a forward fix; Onda 1 stays revertible down to F3.** | Every merge into upstream is Gabriel's; two waves need a production push between two merges. Sunday has no operation and Monday's pedidos close on Saturday at 10:00, so a Saturday sitting leaves a full day for the sweep, the checks and a fix before anyone builds an escala. After a sweep the server refuses the previous format, so a revert below a number cannot save. The operator meets four changes (navigation and Recursos; INVAs; Pedidos and Processamento; Aprovar), one at a time. | `git log --first-parent` (30 of 30 by Gabriel); docs/PLAN.md:164 (three Administradores); `js/agenda.js:28-36`; `20261114143242_formato_e_status_do_dia.sql:22-27` (PT409, hint `formato`); `js/actions.js:138-145`; README.md:243-244. | Three waves with C inside Onda 1 (the first version): Onda 1 forward-only after its opening, and the INVAs change on the same day as the new navigation. Merge as ready: nine visible changes in a few days for one person. |
| 14 | **Worktrees are sibling folders, each with its own `npm ci`, two ports derived from the folder (one for `npm run serve`, one for Playwright), so each has its own `localStorage` origin; only the integration worktree is linked to Supabase.** | `eslint .` lints a nested worktree; the e2e serves three libraries from the worktree's own `node_modules`; port 4173 is reused silently today, and two manual servers on one port share one origin at different formats with no format guard in local mode. | eslint.config.js:8; test/e2e/fixtures.js:15-19; playwright.config.js:3, 27; mapa-dados 5.3 ("Local mode has no such protection"). | A table of ports in the plan: someone forgets it. |
| 15 | **One golden change that is text only is scheduled, as its own commit "texto" of C:** the alert of `js/engine.js:961` names "Instrutores › Cadastro", a view C removes; 7 lines of `cenario-06.json`. | The guardrail's letter forbids it; leaving the text points the operator at a screen that no longer exists, in the Escala, the CSV and the PDF. `:932` (B) and `:994` (G2) are in no golden. | lacuna-1-textos 1; desenho-disponibilidade D20. | Hiding it inside a rule-change commit. |
| 16 | **Every step gets an independent review before it joins the stack; each rejoin gets a second review of the merge commit against the cross-branch rules of 2.7.** | The repo's rule; a merge can be clean and still wrong (C's pane merges with no conflict and could keep offering the Secretaria a form after A). | docs/PLAN.md:329; pedido.md:23. | One review of the whole stack at the end. |
| 17 | **The editor of a flight's restrictions lands in G1, which also takes the matching columns out of the Demanda; G2 deletes what is left.** G1 moves `rm-fly` and the `setFly` revert to the Escala stage. | Nothing is deleted before its replacement; no merge ever holds two editors of one field; G stays reviewable. The two notes that own the editor disagree on the step (desenho-nucleo 1.4: H1 before G; desenho-escala-aprovar decision 1: G's own "Restrições do voo"); G1 satisfies both. | `js/views/demanda.js:81` (the only `data-f="pr"` in `js/`); `js/eventos/demanda.js:184-268` (the only writer of `pr`, `eq`, `nb`, `jan`, `p1`, `p2`, and of `insId` without a pin; `rm-fly` at :184); desenho-nucleo 5 (the H1 row); desenho-escala-aprovar 2.3. | G as one PR with the editor: about 80 tests rewritten and the cut-over in one review. H1 before G as desenho-nucleo has it: between H1 and G the Demanda and the Escala would both edit the same fields. |
| 18 | **The redraw registry is `js/redesenho.js` (`registrarDesenho`, `redesenhar`, `redesenharPorNome`, `desenhosRegistrados`).** | `js/telas.js` and `registrarTela` are F1's screen table (desenho-casca D8, 2.2); one name, one thing. | desenho-casca :74, :374, :500, :511; desenho-escala-aprovar 2.1 (the clash noted). | The first version's `js/telas.js`. |
| 19 | **`painel.html` is not edited: `css/app.css` stays as the TV page's entry, five `@import` lines (`base`, `componentes`, `painel`, `tv`, `toque`); `index.html` links the files one by one.** | posicao B4 and S3; a TV that fails to load stays blank until someone walks to it. A same-origin `@import` is allowed by `style-src-elem 'self'`. | desenho-casca D29; painel.html:14; lacuna-1-css 6; lacuna-2-exportacoes 7.6. | Five `<link>`s in `painel.html` (the first version), against S3. |
| 20 | **`js/main.js` imports one event module per screen; a screen's module imports its own sub-modules; no parallel step edits `js/main.js`.** | Every new event module of a parallel step (`js/eventos/periodos.js` in B, `js/eventos/disponibilidade-do-dia.js` in C) would otherwise be an insertion in the same import block (`js/main.js:18-30`), and C deletes a module F0b creates. | `js/main.js:18-30`; desenho-disponibilidade 5 (both modules imported by their screen); desenho-lista 2.11. | Each step adding its own line to `js/main.js`. |

## 2. How it works

### 2.1 The steps

`→` is "stacked on". Every branch is pushed to the fork; a PR to upstream is opened only when Pedro asks.

| Step | Branch (→ base) | Purpose | The app after it | Nº | SQL | Onda |
|---|---|---|---|---|---|---|
| plan | `linha-0-plano` (→ upstream/main) | The PLAN.md section; the "Servidores" table; the open items of docs/PLAN.md re-filed | as today | | | 0 |
| F0a | `linha-f0a-testes` (→ plan) | Test tooling (2.2 g) | as today | | | 0 |
| F0b | `linha-f0b-costuras` (→ F0a) | Seams (2.2 a-e) | as today; `normalizeMissionFields` refuses hostile types (own commit) | | | 0 |
| F0c | `linha-f0c-estilos` (→ F0b) | One stylesheet per owner (2.2 f) | as today (the census identical) | | | 0 |
| F3 | `linha-f3-cadastro-base` (→ F0c) | `exige` and `inativo`, every reader gated | as today; the "Habilitação própria" box writes `exige` | 26 | | 1 |
| F1 | `linha-f1-casca` (→ F3) | The shell | cards Agenda → Demanda → Escala → Aprovar (Aprovar opens the Escala at its approval bar) and the Cadastros links; the rail with the only date control (open by default from 1,600 px of window, else the date button); the cards' rows and the rail's items in a first version from today's badges (desenho-casca D23, D24); `#selo-rec-dia` and the import button's count stay until B and G2; "Abrir a Demanda" is a link to `#/dem` | | | 1 |
| F2 | `linha-f2-lista` (→ F1) | The list and detail component, with Alunos | Alunos is list + detail with today's fields; personal data in the pane, edited under `editaDadosPessoais` (still true for the Secretaria); the instructors keep their two drawers | | | 1 |
| A | `linha-a-alunos` (→ F2) | Alunos: nome completo, missão anterior and atual, results; the Secretaria only reads | the detail gains those sections; the Secretaria reads, in Alunos and in Instrutores, with no form; no "Abrir a Demanda" | | expand | 1 |
| A2 | `linha-a2-secretaria-so-le` (→ A) | The server refuses the Secretaria's write; the 3-argument overload goes | no change on screen | | tighten | 1 |
| B | `linha-b-recursos` (→ F2; rejoins on A2) | Recursos as list + detail; Janelas de operação out; the requirement editor | Recursos by category; "Períodos fechados nesta data" on the Escala | | | 1 |
| C | `linha-c-invas` (→ F2; rejoins on B) | INVAs as list + detail; ranges with today's meaning | "Vem" on the row; ranges, period chips and turno buttons in the INVA's "Nesta data"; no grid, no drawers; the link reads "INVAs" | 27 | | 2 |
| C2 | `linha-c2-regra-das-faixas` (→ C) | Only with Pedro's yes: a range limits when a mission starts | the same screens; 37 of 41 golden files | | | alone |
| D1 | `linha-d1-aprovacao-no-servidor` (→ A2; rejoins on C) | Approval on the server; the mirrors and the shared cases | no change on screen; from its production push an Operador's pedido is born approved through the 10-argument shim | | expand, one drop | 3 |
| D2 | `linha-d2-pagina-dos-pedidos` (→ D1) | The Pedidos page | the first card is Pedidos; states; "Registrar e aprovar"; the import takes approved pedidos only | | | 3 |
| D3 | `linha-d3-pedidos-em-dia` (→ D2) | The reads every 60 s, the toasts | news from another computer within 60 s | | | 3 |
| E | `linha-e-processamento` (→ F2 for the pure module; rejoins on D3) | The Processamento module, as the body of the import | the import's result changes in four documented ways, each its own commit (desenho-nucleo decision 19) | | | 3 |
| G1 | `linha-g1-restricoes-do-voo` (→ E) | The editor of a flight's restrictions in the Escala stage | the Demanda keeps Aluno, Voa, Missão and its bar; Instrutor, Prioridade, Recurso, the preferences, Disponibilidade, Duração and the course mission are set from the flight's "Restrições" | | | 3 |
| G2 | `linha-g2-tela-do-processamento` (→ G1) | The Processamento screen; the day follows the approved pedidos | the second card is Processamento; no Demanda, no import button, no "Pôr um aluno" | 28 | the conversion again | 3 |
| H | `linha-h-escala-e-aprovar` (→ G2) | The Escala's inputs and the Aprovar stage | approve, reopen, the exports and the link in Aprovar; the cards' final states | | | 4 |
| I | `linha-i-limpeza` (→ H) | What is left over; the Manual read through; the last contract | no leftovers | | contract | 4 |

Dependencies beyond the stack: B and C need F3's data and F2's component; D2 needs F1's rail, `js/telas.js` and `js/linha-do-dia.js`, and F2's component; E's module needs only F0b and F3, its wiring needs D2's handler; G1 needs E's pairing of rejections (`js/rejeicoes.js`) and D's approvals ("Pôr de volta"); G2 needs G1 and C's number; A2 needs A live in production; C2 needs C live.

### 2.2 The seams of F0

**a. The redraw registry, `js/redesenho.js` (new, imports no screen).**

```js
// Momentos (F0b): 'dados' (os dados de uma data chegaram: a abertura e carregarData), 'consulta' (a tela volta ao que
// está gravado: quem só consulta, e depois de um conflito), 'releitura' (lerDadosDeNovo), 'escala' (a escala foi refeita).
// F1 acrescenta 'perfil', 'pedidos' (a resposta da leitura dos pedidos da data) e 'data-aberta'.
export function registrarDesenho(nome, desenhar, { em = [], ordem = 50 } = {})  // nome repetido ou momento desconhecido: Error
export function redesenhar(momento)          // os desenhos do momento, por ordem, lidos por desenhosRegistrados(); cada um por semFalhar
export function redesenharPorNome(...nomes)  // pelo nome, na ordem dada; nome sem registro: Error
export function desenhosRegistrados()        // [{ nome, em, ordem }]: o próprio módulo usa (redesenhar) e os testes leem
```

Each screen registers in its own event module, so a parallel step edits only its own line. The table reproduces the six
lists (`js/main.js:126, 137-138`; `js/actions.js:107, 140-141, 324-327, 373-379`; `js/eventos/registro.js:43-44`):

| Nome | Função hoje | `em` | Ordem | Registered in |
|---|---|---|---|---|
| `revisao`, `hangar` | `rRevisao`, `rHangar` | escala | 5, 6 | `js/eventos/recursos.js` |
| `instrutores-dia` | `rInsDia` | escala | 7 | `js/eventos/instrutores.js` (C deletes it) |
| `recursos` | `rRec` | dados, consulta | 10 | `js/eventos/recursos.js` |
| `instrutores` | `rIns` | dados, consulta, releitura | 20 | `js/eventos/instrutores.js` |
| `alunos` | `rAlu` | dados, consulta, releitura | 30 | `js/eventos/alunos.js` |
| `cursos` | `rCursos` | dados, consulta, releitura | 40 | `js/eventos/cursos.js` |
| `rodizio` | `rRodizio` | dados | 50 | `js/eventos/rodizio.js` |
| `pedidos-do-dia` | `rDem` | dados, consulta, releitura | 60 | `js/eventos/demanda.js` (G2 re-registers the role) |
| `escala` | `() => { if (RES) rOut(); }` | dados, consulta, releitura, escala | 80 | `js/eventos/escala.js` |
| `historico` | `renderAuditPanel` | dados, escala | 85 | `js/eventos/historico.js` |
| `bi` | `rBI` | escala | 90 | `js/eventos/bi.js` |
| `pedidos` | `rAgenda` | dados | 95 | `js/eventos/agenda.js` |
| `selos` | `atualizarSelosDaEscala` | dados, escala | 99 | `js/eventos/topo.js` |
| `habilitacoes-do-instrutor` | `rPainelDoInstrutor` | (by name only) | | `js/eventos/instrutores.js` (C deletes it) |

- The names are roles, not files: G2 registers its screen as `pedidos-do-dia`, D2 keeps `pedidos`. No importer changes
  when a view module is replaced. `lerPedidosDaData()` and `carregarBI()` stay direct calls (reads, not drawings).
- Two differences from today, both between independent areas: `historico` is drawn after `escala` on a date change (today
  before), and the opening draws the Escala in the same pass as the rest (today a few lines later, `js/main.js:137`).
  `rAgenda` also runs at the opening; it returns at once until the Agenda was opened (`js/views/agenda.js:187`).
- A module still calls its own view directly; only calls to another screen go through `redesenharPorNome` (the 21 lines of
  lacuna-1-importadores 7).
- The moment names are a contract: desenho-pedidos calls the pedidos moment `'solicitacoes'` and desenho-disponibilidade
  calls `redesenharTelas`; the plan writes one list, this one, and the guard of 2.2 e refuses any other name.

**b. The save before the redraws** (`js/actions.js:166-182, 370-380`). `save()` becomes: `setRES(escalaCalculada())`;
`syncBIHistoryForCurrentDate()`; `gravacaoAtual = ApiClient.salvarDia(DATA, S, RES)`; then `redesenhar('escala')`; then
the "Atualizada às" text, guarded. `salvarDia` copies the state before its first `await` (`separar` and `JSON.stringify`,
`js/storage.js:229-234`), so a later redraw cannot change what is saved. `semFalhar` (`js/dom.js:274-281`, exported)
logs with `console.error`, so a redraw that throws still fails every e2e test, while in production the change is saved
and its History entry written. The same order in the course queue (`js/eventos/cursos.js:222-224`: send, then redraw).

**c. The revert registry.** `aoReverter(tipo, desfazer)` in `js/eventos/registro.js`, beside `aoAcionar` and
`aoMudarCampo`; `desfazer(rev, entrada)`. `js/eventos/historico.js` keeps the drawer, "Limpar" and one dispatcher
(`validarReversao`, then the registered function). The nine branches move to their screens: `setFly` to `demanda.js` (G1
moves it, with `rm-fly`, to the Escala stage); `setAv`, `setAtributo`, `restaurarHorarios`, `readicionarRecurso` to
`recursos.js`; `setInsOn` to `instrutores.js`; `restaurarFixos`, `restaurarEscolha` to `escala.js`;
`desfazerAgendamento` to `agendamento.js`. `validarReversao` stays whole in `js/reversoes.js`: its `if (rev.kind === '…')`
chain (:46-114) is the list of kinds; B adds `setExigencias` before the final `return null` (:116), C adds `setFaixas`
after :64.

**d. Modules split, with no change of behaviour** (desenho-lista 2.11, completed; line ranges at 48875e3):

| Today | Becomes | Owner in the parallel phase |
|---|---|---|
| `js/views/cadastros.js:23-72, 76-213, 233-247` and the Instrutores half of 328-451 | `js/views/instrutores.js` | C |
| `js/views/cadastros.js:73-75, 215-231` (`podeEditarLimites`, `rLimites`) | `js/views/limites.js` | C |
| `js/views/cadastros.js:249-326` and the Alunos half of 328-451 | `js/views/alunos.js` | F2, then A |
| `js/views/cadastros.js:407-451` (`filtrarLinhas`, `nenhumComOsFiltros`, `contar`, parametrised) | `js/views/linhas-filtradas.js` (also imported by `js/views/demanda.js:18`) | nobody; G2 deletes it with its last user |
| `js/eventos/cadastros.js:46-54, 70-81, 139-186`, the `inst` half of 56-68, `deli` of 111-132 | `js/eventos/instrutores.js` | C |
| `js/eventos/cadastros.js:83-109, 188-223`, the `alu` half of 56-68, `dels` of 111-132 | `js/eventos/alunos.js` | F2, then A |
| `js/eventos/cadastros.js:21-44` (the drawer's listeners) | `js/eventos/dados-pessoais.js`, imported by the two modules above | C deletes it |
| `js/eventos/cadastros.js:134-137` (`pesoDoCampo`) | `js/eventos/peso-do-campo.js` | F2; C deletes it if nothing imports it then |
| `js/eventos/cadastros.js:225-249` | `js/eventos/limites.js`, imported by `js/eventos/instrutores.js` | C |
| `js/views/dados-pessoais.js:11-33` (the cache: `DADOS`, `canacDe`, `carregarDadosPessoais`) | stays | F2, then A |
| `js/views/dados-pessoais.js:35-153` (the drawer) | `js/views/gaveta-de-dados.js` | C deletes it |
| `js/eventos/escala.js:233-262` (a course mission's result, with `vooDaChave`) | `js/eventos/resultados.js`, imported by `js/eventos/escala.js` | A (the shared function the Alunos detail calls) |
| `js/eventos/navegacao.js:11, 49-50` (`[data-recolher-grupo]`, the fleet's groups) | `js/eventos/recursos.js` | B |
| `js/eventos/navegacao.js:13, 51-53` (the view switch) | `[data-vista-rec]` in `js/eventos/recursos.js`, `[data-vista-ins]` in `js/eventos/instrutores.js`; `js/views/vistas.js` stays until C | B, C |
| `js/agenda.js`: `vooQueDaLugar`, `importarSolicitacoes` (:82-141) | `js/processamento.js`; their 21 tests (`test/unit/agenda.test.js:89-336`) to `test/unit/processamento.test.js` | E |
| `js/agenda.js`: the deadline, Sunday, the local-flight limit, `pedidoDaSolicitacao`, `disponibilidadeDaSolicitacao`, plus `entraNaEscala = s => !s.cancelada_em` | stays | D1-D2 (desenho-nucleo 1.4: D edits the two functions for its new columns) |
| `js/eventos/agenda.js:28-61` (`importarDaAgenda` and its two buttons) | `js/eventos/importacao.js`, imported by `js/eventos/demanda.js`, bound by `aoAcionar('importar-agenda', …)`; `index.html:292, 302` get `data-act="importar-agenda"` | D2 (filter and texts), E (the call); G2 deletes it |

- `entraNaEscala` is read by the import handler, by `js/processamento.js` and by `js/views/selos.js:48`. D2 changes its body
  (approved and not cancelled) in its own file; E never edits that line.
- The buttons are delegated because `js/eventos/agenda.js:60` binds an element of the Demanda's markup while it is
  evaluated: the page would stop loading when either step removed its button (lacuna-1-importadores 2).
- Side effect: `painel.html` stops loading the modules only the import half reached (`js/fixos.js`, `js/progresso.js`;
  lacuna-2-exportacoes 2). `test/unit/grafo-da-tv.test.js` pins the TV's module list from then on.
- After F0b `js/main.js` imports `navegacao`, `escala`, `instrutores`, `alunos`, `historico`, `topo`, `demanda`, `bi`,
  `recursos`, `conta`, `agenda`, `rodizio`, `cursos`, `agendamento`: one per screen or area. Sub-modules
  (`dados-pessoais`, `peso-do-campo`, `limites`, `resultados`, `importacao`) are imported by their screen's module.

**e. Guards added by F0b.**
- `test/unit/eventos-ligados.test.js`: every selector an event module binds while it is evaluated (the 66 of
  lacuna-1-importadores 2, found with espree) exists in `index.html`; every module of `js/eventos/` is imported exactly once,
  by `js/main.js` or by one screen module.
- `test/unit/desenhos-registrados.test.js`: every name passed to `redesenharPorNome` is registered once; every `em` uses a
  moment of the list.
- `test/unit/reversoes-registradas.test.js`: the kinds of `validarReversao` (the literals compared with `rev.kind`) and the
  literal first arguments of `aoReverter(` across `js/eventos/*.js` are the same set, each registered once. A revert kind
  with no handler (a History button that does nothing) fails here.
- `test/unit/grafo-da-tv.test.js`: the modules reachable from `js/painel.js`, as an explicit list.
- `scripts/exportacoes-sem-uso.mjs`: an imported name must be exported by its target (nothing static checks it today,
  lacuna-2-exportacoes 6.4); a non-destructured `import()` of a `js/` module from `test/` is an error. The six such lines
  become destructured in the same commit (lacuna-1-importadores 6), so the lint's blind spot is closed from F0b on.
- `normalizeMissionFields` checks the type before converting, with a hostile-value test (docs/PLAN.md:440), as its own
  commit; every later normaliser follows the rule.

**f. One stylesheet per owner (F0c).** The file names are desenho-casca's (its section 5) plus `toque.css`. `index.html`
links them in this order; `css/app.css` becomes `@import` of the five marked TV, in this order, and `painel.html` keeps
linking `css/app.css` byte for byte.

| File | Holds (lines of `css/app.css` at 48875e3; lacuna-1-css 2 has every line) | Owner after F0 |
|---|---|---|
| `base.css` (TV) | tokens 1-50; `html`, `*`, `body`; the focus ring 219-222; `h2`, `h3`; fields 271-280; `p.h`, `a`, `.sr`; `[hidden]`; and, until F1 scopes them (desenho-casca D10), `main` (228) and `#login-erro` (1561-1562), which both pages match | F1, then frozen |
| `componentes.css` (TV) | `.ico`, `.pn`, `.btn`/`.bar`/`.seg`, `.win-btn`/`.grupo-btn`/478, `.flt-rotulo`, `.erro-campo`, `table`/`th`/`td` 560-576, `.chk`, `.tag`/`input.sw`/`label.alvo`, `section[data-vista]`/`.contagem`/`tr.sem-resultado`, the filter 855-873 and its phone rules 1089-1097, `.fila`, the `.st` tiles, `.x`, `.sm`, toasts, tooltips, `[data-foco-neutro]` | F1, then frozen |
| `painel.css` (TV) | the board and the METAR strip 357-467 | nobody |
| `tv.css` (TV) | 1615-1645 | nobody (F1 adds `.tela-painel main`) |
| `casca.css` | header, date, nav, badges, profiles, read-only, `section`, skip link, login, shared mode, banners, print | F1 |
| `escala.css` | the Escala, its pop-up, the Sugestões' content, the Escala's phone rules | B (the periods block), G1 (the editor), H |
| `demanda.css` | 347, 577-578, 580-596, 598-599, 733-750, 979-987, 1546, 1694-1695 | G1, then G2 deletes it |
| `agenda.css` | 1146-1161, 1172-1180 | F1 (the calendar leaves), then D2 |
| `recursos.css` | 481-514, 517, 784-843, 1696-1698 | B |
| `instrutores.css` | 723-732, 1041-1067, 1084-1087 | C |
| `alunos.css` | 992, 1068-1069, 1076-1078, 1229-1230, 1245-1258 | F2, then A |
| `cadastros.css` | `.nm`, `td.c-canac`, `table.cadastro` 1070-1083 and its phone cards 1098-1133 | F2 (the Alunos half), C deletes it |
| `cursos.css` | 874-976, 993-1040, plus its own copies of the `table.cadastro` rules its missions table borrows (1070, 1074, 1080-1081, 1104-1106, 1113, 1126) | nobody |
| `rodizio.css`, `bi.css`, `conta.css`, `manual.css` | `.rodizio`; 257-270, 1496-1499; 1162-1171; 1500-1519, 1689-1693 | nobody (`manual.css`: I) |
| `gavetas.css` | the frame 1452-1463, the Histórico 1464-1495, the Dados pessoais drawer 686-691 | F1 (a drawer to the left of the rail), C (the record drawers' rules go) |
| `dialogos.css` | 611-685 | nobody |
| `toque.css` (TV), **last** | the 44 px rules of 1583-1612 on base components (`.btn, .x`; `select, input`; `label.alvo, label.chk`; checkboxes; `.seg button`; `.menu-itens button`; `.fila li`) | frozen |

- Rules that name several screens are split into one rule per owner with the same declarations: 239-241, 577, 1089, 1587,
  1589, 1591, 1594, 1597, 1598, 1600 (lacuna-1-css 4, 5). A screen's own 44 px selectors go to its file, after its base
  rules. `toque.css` is last because the generic 44 px rules are last today.
- The four rules with no emitter go (`.chip.off`, `.num`, `.saldo`, `details.pn summary`).
- **The census, `scripts/medir-estilos.mjs`** (new; Playwright's Chromium, its own server; no dependency), run before and
  after F0c, prints one hash per state and must print the same output:
  - pages: `index.html` and `painel.html`, each seeded in local mode;
  - widths 320, 390, 640, 760, 1029, 1100, 1280, 1400, 1600;
  - contexts: `data-theme` light and dark; the system dark scheme with no `data-theme`; `hasTouch`; `forcedColors:
    'active'`; `reducedMotion: 'reduce'`; `media: 'print'`;
  - profiles: Operador, Gestor, Secretaria (local `role=`), shared mode with the fake server, the login screen;
  - states: every tab, view, drawer, dialog and the map pop-up;
  - per state: the computed styles of every element and of its `::before`, `::after` and, for open dialogs, `::backdrop`;
  - a static ledger read from `document.styleSheets`: the multiset of (media, selector, declarations) is equal apart from
    the listed splits and the four deletions, which covers `:hover`, `:focus-visible`, `:disabled` and `:fullscreen` rules
    a resting computed style never shows;
  - a printed list of every pair of rules of equal specificity matching a common element whose order changed, for the
    reviewer.
- New files of later serial steps: `linha.css`, `trilho.css` (F1), `lista.css` (F2), `processamento.css` (G2),
  `aprovar.css` (H); G1's editor lives in `escala.css`. No parallel step adds a `<link>`.

**g. The e2e reaches the app through drivers (F0a).** `test/e2e/fixtures.js` keeps the base `test`, the clock,
`prepararContexto`, `vigiarErros`, `confirmar`, `json`, and re-exports `test/e2e/telas/*.js`, so no spec changes its
import line.

| Driver | Exports (the selectors they hide) | Owner |
|---|---|---|
| `telas/casca.js` | `abrir`, `entrar`, `appPronto` (`body[data-pronto]`, replacing the wait on `#wins` in `abrir` and in 9 other places), `irPara`, `ABAS`, `ABAS_DA_SECRETARIA`, `mudarData`, `diaSeguinte`, `diaAnterior`, `rotuloDaData` (`#dt`, `#dt-prox`, `#dt-ant`, `#dt-rotulo`: 129 lines in 21 files today), `abrirMenuDaConta`, `abrirHistorico`, `entradasDoHistorico` | F1 |
| `telas/invariantes.js` | `REGIOES`, `alvosPequenos`, `semNome`, `larguraDaPagina`, `percorrerTelas(page, conferir)` over `ABAS` and every driver's `ESTADOS` (replaces `percorrerVistasEFiltros` and the four literal nine-tab lists) | F1 |
| `telas/recursos.js` | `abrirRecursos`, `alternarDisponivel` (`#eqs`: 58 uses in 13 files), `filtrarCategorias`, `ESTADOS` | B |
| `telas/instrutores.js` | `abrirInstrutores`, `alternarVem` (`#inst-dia`, `data-f="on"`), `filtrarHabilitacoes`, `ESTADOS` | C |
| `telas/alunos.js` | `abrirAlunos`, `filtrarCursos`, `ESTADOS` | F2, then A |
| `telas/demanda.js` | `voar(page, id, sim, { mid })` (`data-f="fly"`: 33 uses in 11 files), `campoDoPedido`, `importarDaAgenda`, `ESTADOS` | G1 (`campoDoPedido` → the editor), G2 (becomes `telas/processamento.js`) |
| `telas/pedidos.js` | `registrarPedido(page, { … })` (`#ag-*`: 56 uses in 6 files) | D2 |
| `telas/escala.js` | `abrirEscala`, `lerEscala`, `aprovar`, `reabrir`, `exportar(page, 'csv' \| 'pdf' \| 'xlsx')` | G1 (`abrirRestricoes`), H |
| `telas/cursos.js` | `ESTADOS` (one: PC) | nobody |

- **Screen tests leave the cross-screen files.** A test of `acessibilidade.spec.js` or `celular.spec.js` that addresses one
  screen's controls moves, unchanged, to that screen's spec (the reviewers name acessibilidade.spec.js:324-335 and
  :482-483, the Demanda's Voa and Duração; :414, `#eqs input[data-a="av"]` and `#revisao`; celular.spec.js:178). The 11
  Esc-layer tests that open `#painel-dados` or `#painel-instrutor` move to `test/e2e/gavetas-de-cadastro.spec.js`. After F0a
  the two cross-screen files hold only the shell and the walks, and a new screen joins the walks through its driver's
  `ESTADOS`.
- `test/unit/donos-dos-seletores.test.js` keeps the seam: each reserved selector appears only in its driver and in the spec
  files of its owner.
- `test/e2e/cadastros.spec.js` (44 tests) is split by its describes: `recursos.spec.js` (22), `instrutores.spec.js` (11),
  `alunos.spec.js` (11).
- `test/e2e/supabase-falso.js` keeps the router; the handlers of the agenda (`:369-400`) and of the personal data
  (`:417-437`, `:152`) move to `test/e2e/falso/agenda.js` (D1, D2) and `test/e2e/falso/dados-pessoais.js` (A, A2).
- **Ports.** `scripts/porta.mjs` exports `portaDaPasta(raiz)` = 4200 + 2 × (the first six hex digits of sha1(raiz) mod 350).
  `scripts/serve.mjs` uses it (`PORT` wins) and prints the address; `playwright.config.js` uses it + 1, passes it to the
  server, and sets `reuseExistingServer: false`, so a busy port is an error, never another checkout's files. Two folders
  collide 1 time in 350: the second fails with `EADDRINUSE` and sets `PORT`.
- `package.json`: `"test": "npm run lint && npm run test:unit && npm run test:e2e"`. CI keeps its three named steps.
- The duration: F0a records the time of `npm test` and of the PR's CI run in README 'Testes'. Above 10 of the 15 minutes,
  the workflow's e2e step becomes a matrix of two shards (`npx playwright test --shard=1/2`, `2/2`).
- `test/e2e/publicado.spec.js`: the start address from `ACPM_INICIO` (so it runs from a worktree's server with
  `./?supabase=previa`), the stale board title at `:62` fixed, the drivers. `scripts/testar-banco.mjs` refuses the
  production ref, as `scripts/semear-previa.mjs:12-17` does.

### 2.3 Ownership of the shared files

**Files with one owner per step** (blank: the step must not touch it; in the F0 column, a, b and c are F0a, F0b and F0c;
"region" points to the table of parallel editors).

| File | F0 | F3 | F1 | F2 | A, A2 | B | C | D1-D3 | E | G1 | G2 | H | I |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `js/main.js` | b | | ✔ | | | | | | | | ✔ (`processamento`) | ✔ (`aprovar`) | ✔ |
| `js/actions.js` | b | `escalaCalculada` | `abrirData`, `setRole` | the cadastro re-read | | | | D2: `lerData`, `diaJaGravado` | | | | ✔ | |
| `js/eventos/registro.js` | b | | | | | | | | | | | | |
| `js/eventos/historico.js` | b | | ✔ (beside the rail) | | | | | | | | | | |
| `js/eventos/navegacao.js` | b | | ✔ | | | | | | | | | | |
| `js/eventos/escala.js` | b | | `:95-102` | | | one import line | | | | one import line | | ✔ | |
| `js/eventos/resultados.js` | b | | | | A | | | | | | | | |
| `js/redesenho.js`, `js/telas.js`, the list component | b | | `js/telas.js` | the component | | region | region | region | | | ✔ | ✔ | |
| `js/linha-do-dia.js` | | | ✔ | | | region | | region | | | ✔ | ✔ | |
| `js/migracoes.js` | | 26 | | | | | 27 | | | | 28 | | |
| `js/dias.js` | | `separar` (41-47) | | | | region | region | | region | | ✔ | | |
| `js/storage.js` | | normalizers | `contagemDaAgenda` | | A: 303-305 | | region | D1: agenda methods; D2: `contagemDaAgenda`, `diaMudou` | | | normaliser of H's keys | ✔ | |
| `js/backends/supabase.js` | | | | decision 14 of desenho-lista | A: 239-255 | | | D1, D2 | | | `:172` | | |
| `js/backends/local.js` | | | | | | | | D1, D2 | | | | | |
| `js/views/selos.js` | b (`:48`) | 26-28 | ✔ | | | region | | region | the count | | deletes it | | |
| `js/reversoes.js` | | ✔ | | | | region | region | | | | 141-142 | | |
| `js/perfis.js` | | | | `editaDadosPessoais` | A flips it | | | | | | | | |
| `js/manual.js`, `js/views/manual.js` | | ✔ | | | | ✔ | | | | | | | ✔ |
| `test/e2e/fixtures.js` | a | | | | | | | | | | | | ✔ |
| `test/e2e/celular.spec.js`, `acessibilidade.spec.js` | a | | ✔ | | | | | | | | | | ✔ |
| `test/e2e/app.spec.js` | a | | ✔ | | | `:133`, `:194-205` | | | | | | | ✔ |
| `test/e2e/gavetas-de-cadastro.spec.js` | a | | | ✔ | | | deletes it | | | | | | |
| `test/e2e/manual-frases.js` | a | by block: each step its own block | | | | | | | | | | | |
| `test/e2e/supabase-falso.js` (the router) | a | | | | | | | | | | | | |
| `test/e2e/falso/dados-pessoais.js`, `falso/agenda.js` | a | | | | A, A2 | | | D1, D2 | | | | | I |
| `test/helpers/estado.js`, `montar.js`, `cenarios.js` | | ✔ | | | | | `cenarios.js` (`comFaixas`) | | | | ✔ | | |
| `docs/PLAN.md` | plan | each step ticks its own item and adds what its review changed, on its own lines | | | | | | | | | | | |
| `README.md` 'Estrutura' | b, c | each step its own rows; a new row right after the row of the module it replaces | | | | | | | | | | | |

**`js/telas.js` (F1's screen table).** F1 writes one screen per line, in an order where no two screens edited in the
parallel phase are adjacent (`rec`: B; `ins`: C; `age`: D2; `alu`: A, which is serial with D2): for instance `age`, `alu`,
`dem`, `ins`, `esc`, `rec`, `apr`, `cur`, `rod`, `bi`. The linha's order comes from `ETAPAS` (desenho-casca 2.2), not from
this one.

**`index.html` by region** (lines at 48875e3).

| Region | Owner by step |
|---|---|
| head: the stylesheet links (16-17) | F0c; then F1, F2, G2, H (each its own `<link>`) |
| sprite (25-53) | F1 and F2 add every symbol the designs need; frozen in A to E (a missing icon goes through the shared-fix rule) |
| header and nav (55-104), banners (108-123), the frame of `main`, `#s-login` | F1 |
| `#s-rec` (149-211) | B |
| `#s-ins` (214-245); `#painel-instrutor` (678); `#painel-dados` (680) | C |
| `#s-alu` (249-265) | F1 (only line 260: "Abrir a Demanda" becomes a link), F2, then A (deletes line 260) |
| `#s-age` (274-296) | F1 (the calendar leaves), then D2 |
| `#s-dem` (299-341) | F0b (two attributes), D2 (the import button's text and title, 302), G1 (the moved columns), then G2 (deletes it) |
| `#s-esc` (344-375), dialogs (684-760), `#tl-pop` | B (`details#periodos` between the first `.bar` and `#compactacao`), then G1 (the editor and its entry points), then H |
| `#s-cur`, `#s-rod`, `#s-conta`, `#s-bi` | nobody (F1 only frames them) |
| `#historico` (667-675) | F1 |
| `#s-manual` (429-649) | by block, below |

**The Manual by block** (after F0c's reflow; lines of today).

| Block | Step |
|---|---|
| 445 step 1: the date sentences; 456 (the badges); 469 (Histórico); 474 and the `h4` order; 595 (the date); 644 | F1 |
| 445: "Uma data nova começa com os aviões, as janelas e os horários dos instrutores da anterior" | B ("as janelas"), then C ("os horários dos instrutores") |
| 445: "a agenda é o centro dos agendamentos, e Importar da agenda monta a demanda do dia" | D2, then G2 |
| 446 step 2; 507-519 `h4` Recursos; 642 | B |
| 447 step 3; 521-529 `h4` Instrutores; 565 (only with C2) | C |
| 462-465 Perfis: the personal data; 531-535 `h4` Alunos (fields, permissions, "Abrir a Demanda") | A (F2 the list-and-detail sentences of 531-535) |
| 462-465 Perfis: pedidos and approval; 503-505 `h4` Agenda | D2 (F1 the calendar sentence of 503) |
| 465, the Secretaria's sentence | A, then C, then D2 |
| 448 step 4: the adjustments clause; 489-501 `h4` Demanda: the columns part; 636; one new sentence in the `h4` Escala on "Restrições" | G1 |
| 431 intro; 448 step 4: the rest; 489-501: the rest; 538-541; 557-559; one sentence on stored texts that keep the old names | G2 |
| 449-450 steps 5 and 6; 475-487 `h4` Escala; 575-580 the two criteria; 595-596 (the exports); 628; 632 | H |
| "Primeiros passos" rewritten as the four stages; the final list of retired phrases | I |

**The glossary** (`js/glossario.js`, one term per line, one group per line in `ABAS_DO_GLOSSARIO`): F1 `vem-nesta-data`,
`curso-encerrado` (desenho-casca 5); F3 `habilitacao-propria` (84), new `inativo`; F2 and A the Alunos terms; B 73-85
(`janelas`, `horario-em-janela-fechada` out; `horario-em-periodo-fechado`); C the 'Instrutores' group line and 88-93
(`turno` replaced by its new term, desenho-disponibilidade 5); D2 the 'Agenda' group line, `excecao` (70), new
`pedido-aprovado`; G1 61-66 (`preferencias`, `instrutor-escolhido`, `disponibilidade`, `duracao`, `prioridade`,
`fora-da-ordem`); G2 the 'Demanda' group line, `voa` (60), `curso-encerrado` (67); H 41-42, 49-57 and the new group
'Aprovar'. The limits of `test/unit/glossario.test.js:20-30` (240 and 40 characters) hold for every rewrite.

**Files with two or more parallel editors, by region** (the later branch of the rejoin order resolves).

| File | Regions |
|---|---|
| `js/dias.js` | B: `diaParaCopiar` (118-123); C: the `ins` lines of `separar` (58) and `juntar` (92-95) and of `diaParaCopiar`; E: `juntar` hardened (59-62, 96-101). C and E are adjacent: E resolves |
| `js/storage.js` | C: the instructors' block of `normalizeAndMigrateState` (144-147); A: the personal-data guard (303-305); D1 and D2 (278-300) are serial with A |
| `js/views/selos.js` | B: the `#selo-rec-dia` part (20-33); D2: the agenda part (38-60) |
| `js/linha-do-dia.js` | B: the item `periodos-fechados`; D2: the Pedidos card's rows and the item `pedidos-aguardando` |
| `js/telas.js` | B, C, D2: one entry each, never adjacent (above) |
| `js/reversoes.js` | B: `setExigencias` before :116; C: `setFaixas` after :64, 11, 38-40, 186-189 |
| `js/agendamento.js` | C: 934-939 (the booking's "Marcar disponível"); E: `naOrdemDoMotor`, `FORA_DA_ESCALA`, 234-237, 1031-1034 |
| `js/engine.js` | B: the text at 932 (no golden); C: the text at 961 (decision 15) |
| `js/views/vistas.js` | B: removes `rec` from `DO_PERFIL`; C: deletes the module |
| `js/glossario.js`, `index.html`, `README.md` | by term, by region and by row, above |

### 2.4 Collisions that remain, and how the order handles them

Each resolution is its own commit and gets the rejoin review of 2.7.

| Where | Who | Handled by |
|---|---|---|
| Manual, index.html:445, "Uma data nova começa com…" | B, C | C resolves on B |
| Manual, index.html:465, the Secretaria's sentence | A, C, D2 | C on A; D2 on C |
| `js/dias.js` 58-62 and 92-101 | C, E | E resolves on D3, which holds C |
| `js/views/selos.js`, `js/linha-do-dia.js` | B, D2 | D2 resolves on C, which holds B |
| `js/eventos/importacao.js` | D2 (filter, re-read, texts), E (the call) | E resolves on D3 |
| `test/e2e/dados-pessoais.spec.js` | A (the four Secretaria tests: 114, 141, 171, 276), C (the instructor tests leave the drawer) | C resolves on A |
| A selector hidden in a driver changes meaning (`campoDoPedido` in G1, `voar` in G2) | G1, G2 | the step reads every caller of the driver it changes; the review checks the list |

**The shared-fix rule.** A frozen file (the list component, `css/base.css`, `componentes.css`, `toque.css`, `linha.css`,
`trilho.css`, `lista.css`, the sprite, `js/redesenho.js`, the order of `js/telas.js`, `js/eventos/registro.js`,
`js/main.js`, `test/e2e/fixtures.js`, F1's drivers) changes only in a small branch `linha-fix-<assunto>` cut from the
common base of the open branches (the lowest unmerged step, or `main` when every step below is merged), with its test and
its review. Every open branch merges it the same day; its PR enters the stack right above that base. This also covers a
change needed after the file's own wave is in production.

### 2.5 Worktrees, the machine and the preview

| What | Rule |
|---|---|
| Folders | `git worktree add ../ACPM-linha-<letra> -b linha-<letra>-… <base>`, beside the clone, never inside one. One more, `../ACPM-linha`, is the integration worktree: the tip of the rejoined line, and the only folder that pushes to Supabase. |
| `node_modules` | `npm ci` in each (never `npm install`; no dependency changes during the redesign, so the lock and the browser cache stay valid). |
| Browsers | Shared in `~/Library/Caches/ms-playwright` while `@playwright/test` stays 1.65.0. |
| Ports and origins | Two per folder (2.2 g). Each folder's manual server is its own `localStorage` origin, so local mode never mixes formats 26, 27 and 28 between branches. |
| Load | While developing, a branch runs its own spec files; the whole suite in CI mode before a push, with `--workers=3`; at most two whole suites at once on the machine. |
| Supabase | Only the integration worktree has `supabase/.temp` (the link). Parallel branches use the fake server and local mode. Each push, to the preview or to production, is made from a checkout of that step's own branch tip (`git checkout --detach linha-<passo>` in the integration worktree), after `supabase migration list` and `supabase db push --dry-run` list exactly that step's file. On the preview the order is A, A2, D1 as each is ready (D1 while B and C are built), then G2 and I. `npm run test:db` means something only from a checkout that holds every file the preview has: once D1's file is there, the agenda pgTAP files of any branch below D1 fail (they call the dropped overload). |
| Preview check with real logins | The integration worktree's server with `?supabase=previa` (README.md:19-20), in stack order (the preview's stored format only moves forward); `publicado.spec.js` through `ACPM_INICIO`. |
| `main` during the redesign | Fixes only. A fix is merged into the lowest unmerged branch the same day and carried up by merging, as the repo's stacks are. A fix to a screen the stack rewrote is made again by the step that owns the file. A client fix is checked in local mode and with the fake server, then on production after its merge (main's code cannot save on a preview at a higher format). A fix that needs SQL: its file takes the current timestamp; preview from the integration worktree with the fix merged in, `npm run test:db`; production from `main` plus the fix (the dry-run lists only it); a redesign file dated earlier then reaches production with `--include-all`, after the dry-run lists exactly it. |

### 2.6 What "green" means, and the go-live of the steps that have one

**Every step:** `CI=1 npm test` green in the step's worktree before a push and the PR's run green before the merge; the
diff touches only what 2.3 gives the step, or a line of PLAN.md names the region of the extra file before the push; the
TV specs (`painel-tv`, `painel-sessao`, `painel-meteorologia`, `seguranca`: 65 tests) and the census unchanged for
`painel.html`; `test/unit/grafo-da-tv.test.js` updated only when a module joins or leaves the TV's graph, and said in the
PR.

| Step | Extra gate | Go-live |
|---|---|---|
| plan, Onda 0 | Before any code, Pedro's read-only inventory of both projects: `supabase migration list`; `supabase functions list`; `supabase secrets list` (names); read-only SQL (`supabase db query --read-only`): the cadastro's `esquema`, `select conteudo->>'esquema', count(*) from public.dias group by 1`, the overloads in `pg_proc`, `count(*)` of Secretaria profiles; the Auth configuration compared with `config.toml` (README.md:70-72). Then `npm run test:db` on the preview from unchanged upstream/main: 433 checks (131 never recorded on real pgTAP; a red one is fixed first in the reserved file). F0a: the 578 e2e tests, no assertion changed. F0c: the census identical. | The "Servidores" table filled from the inventory; the four merges; open the app and `painel.html`. Undo: revert. |
| F3 | goldens byte-identical; `scripts/medir-escalas.mjs` unchanged | at the opening of Onda 1: dates open, the cadastro is at 26, PR-VOM has `exige` and still `habilitacaoPropria` |
| A | `npm run test:db` on the preview (red, then green with the file) | in Onda 1, before A's merge: production push; the live app saves personal data as before (it never sends the key) |
| A2 | the same | in Onda 1, with A live: the push; a Secretaria login (if any) reads in Alunos and in Instrutores and cannot save, on screen and through the API. Undo: a migration that restores the check |
| B | a read-only count before the merge: whether the same period is closed on runs of stored dates (desenho-disponibilidade D23 decides the copy of `win` from it) | the next escala built with a period closed from the Escala |
| C | commit "dados": `git diff --stat test/fixtures/goldens-do-motor` empty; commit "texto": 7 lines of `cenario-06.json`, with Pedro's yes | Onda 2: the opening converts the days to 27; one INVA's ranges compared with the cells he had; on Monday's build Pedro and the operator read each INVA's ranges once |
| C2 | the golden diff reviewed and reported (37 of 41 files; 282 rows change; 8 flights leave; desenho-disponibilidade D7, D8) | alone, when the date being built is approved, Pedro present; the operator told which INVAs have partial ranges. Undo: revert |
| D1 | `npm run test:db` from D1's branch on the preview, red then green, during the parallel phase; the old-client check: the commit production runs, served with `?supabase=previa`, registers and cancels a pedido (desenho-pedidos 4, item 4) | Onda 3, first: the production push; the live app registers and cancels |
| D2 | real logins on the preview: an Operador registers and approves; a Secretaria registers, has no "Aprovar" | merged in Onda 3 |
| G2 | **the rehearsal** (below); before the merge, the read-only count of production in three classes (below) | Onda 3: G2's file after D2 is live; the merge; Pedro opens; Monday's date shows the flights of its CSV; nothing is written by opening a date |
| H | snapshots reviewed if the Escala's text changes | Onda 4: no sweep |
| I | `npm run test:db`; the guard of retired names | Onda 4: the push, then the merge. A tab older than D2 that registers afterwards gets an error; such a tab was already refused by 28 |

**The rehearsal of G2's cut-over, on the preview** (every branch has rejoined by then, so a read-write reset of the preview
is acceptable):
1. From the integration worktree at E's tip (format 27; D1's file already on the preview), `scripts/semear-dias-previa.mjs`
   (extended by D1, refuses production) seeds dates in 2098 that are not stored, with fictitious students and pedidos in
   these cases: imported and flying; imported with Voa off; imported, then cleared by "Limpar demanda"; a request typed by
   hand; a booking; approved and not imported; waiting and not imported (a Secretaria's); waiting and imported after D1's
   conversion (what an old tab would do); imported, then cancelled. Export each date's CSV.
2. Push G2's file to the preview (rule (a) again), open the preview with G2's build as Operador (the sweep to 28, no data
   change), and run "Atualizar a escala" on each seeded date.
3. Compare each date with its CSV. Expected: flying stays; Voa off stays off ("fora pelo operador"); cleared does not come
   back; typed by hand and the booking stay; approved-not-imported enters; waiting-not-imported does not; the old tab's
   import is approved by the re-run and stays; the cancelled one leaves unless a status keeps it (desenho-nucleo decision 6).
4. Reset for another run: `scripts/reiniciar-ensaio-previa.mjs` (new, refuses the production ref) deletes the days and
   pedidos of 2098 and sets `esquema` back to 27 on every day and on the cadastro stored at 28. Since 28 converts nothing,
   the number is the only difference. A second run calls `aprovar_solicitacoes_de_antes_da_aprovacao(false)` directly (the
   migration is already applied). If a run shows a difference, G2 does not merge.

**The count before G2's merge** (read-only, production, dates from today on), each class with its expected answer:
ids in `importadas` with a record that flies: all approved; with a record off: all approved (rule (a), any `fly`); ids in
`importadas` with no record: waiting, and they never enter; approved pedidos not in `importadas`: the ones "Atualizar a
escala" will bring (rule (b) and approvals made after D2).

**The sittings** (Gabriel merges; Pedro pushes and opens first; the operator and everyone else with an Operador or
Administrador account, three Administradores in production (docs/PLAN.md:164), are told the day before not to edit or
open the app between the first merge and Pedro's opening, since any of them opening first runs the sweep; Pages publishes
each merge in about a minute):

| Onda | When | Script |
|---|---|---|
| 0 | any day | the inventory and `npm run test:db`; Gabriel merges plan, F0a, F0b, F0c |
| Prévia 1 | after F2 is green, before A to E start | Pedro and the operator try the shell and Alunos for about 30 minutes on the integration worktree's server with `?supabase=previa`; what they ask changes F1 or F2 before the parallel phase |
| 1 | Saturday, after Monday's escala is approved and exported | 1. Pedro pushes A's file (from `linha-a-alunos`). 2. Gabriel merges F3, F1, F2, A. 3. Pedro pushes A2's file (from `linha-a2-secretaria-so-le`) and checks. 4. Gabriel merges A2, B. 5. Pedro opens production (sweep to 26) and `painel.html`; the checks of F3, A2, B |
| 2 | Saturday | Gabriel merges C; Pedro opens (sweep to 27); the INVAs' ranges read with the operator on Monday's build |
| Prévia 2 | before Onda 3 | the rehearsal; the operator tries Pedidos, Processamento and "Restrições" on the preview |
| 3 | Saturday | 1. Pedro pushes D1's file. 2. Gabriel merges D1, D2, D3, E, G1. 3. Pedro runs the count, then pushes G2's file. 4. Gabriel merges G2. 5. Pedro opens (sweep to 28) |
| 4 | after the day's escala is approved and exported | Gabriel merges H; Pedro pushes I's file; Gabriel merges I; no sweep |

Before each visible sitting Pedro sends the operator a short note in Portuguese built from the rows of 2.9 for that wave.

### 2.7 The independent review

- **Who and when:** an agent that did not write the step, given the plan's item and `git diff <base>...<branch>` only;
  after the step is green on its base and before it joins the stack. Every finding is confirmed before it is acted on
  (docs/PLAN.md:329). Fixes go in `fix: o que a revisão independente achou em <passo>`, and PLAN.md says what the review
  changed.
- **After a rejoin**, a second review reads the merge commit with the cross-branch rules: C's pane asks
  `editaDadosPessoais` (A flipped it); D2's texts and the Pedidos card's rows sit beside B's item; E's call sits on D2's
  filter; G1's editor writes only the fields the Demanda no longer edits.
- **Every review checks:** the guardrails (engine and goldens untouched unless the step says so; no write outside
  `gravarAlteracao`; a handler with its own listener calls `aindaNaoAbriu()`; personal data never in `S`, CSV, PDF, BI or
  the History; fictitious names; no new dependency); ownership (2.3); the step's rows of the ledger (section 5) are gone,
  with a grep; each new test fails without the change; Manual, glossary, README and PLAN.md moved with the screen; the
  step's states are in its driver's `ESTADOS`.

| Step | What its review must prove |
|---|---|
| F0a | no assertion changed (only selectors and files moved); each reserved selector lives in one driver |
| F0b | the registry's table equals the six lists; a redraw that throws still saves (the test fails on the old order); the moved modules are moves (`git diff -M`); every revert kind has one handler |
| F0c | the census identical, every context and profile; `painel.html` byte-identical |
| F3 | goldens identical; an inactive record seeded in a test leaves every list, picker, export and the engine; a document at 25 converts and an unknown field survives |
| F1 | one date control (no second caller of `carregarData`); the checkers fail when a 30 px button is injected into the rail, the linha and each pane; the TV's census unchanged |
| F2 | keyboard and screen reader on the list; focus after a redraw; the phone path list → detail → back; the pane and the drawer ask the same predicate |
| A, A2 | the fake, the local backend and the SQL agree, case by case; the saved full name comes back in both reads of `js/backends/supabase.js`; the Secretaria reads and cannot write, in Alunos and Instrutores, on screen and through the API |
| B | every reader of `win` still works with the section gone; nothing copies `win` to a new date unless the count said otherwise; the Manual has no "janela" left |
| C | commit "dados" changes no golden; old History payloads with `aw` still revert; the Secretaria has no form in the INVA detail |
| D1 | each profile against each RPC; the count function returns no row data; the 9-argument function is gone and nothing called it; the old-client check |
| D2, D3 | the import takes approved pedidos only; the cache never writes |
| E | the import gives the same day as before for the 21 moved tests, apart from the four documented differences |
| G1 | the Demanda and the editor never edit the same field; `rm-fly` and the `setFly` revert work from the Escala, on stored and new History rows |
| G2 | no flight of a stored day disappears; nothing is written by opening a date; the rehearsal's table |
| H | approve, reopen and the three exports from the new stage; the cards' states come from one pure function |
| I | no retired name in `js/` literals or `index.html` |

### 2.8 What reaches production at each merge, and the undo

| Merge | Visible | Stored days rewritten at the next opening | Undo after the wave's opening |
|---|---|---|---|
| plan, F0a, F0b, F0c | nothing | no | revert |
| F3 | nothing | to 26 | forward only (it is Onda 1's floor) |
| F1, F2, A, B | navigation and the date; Alunos; Recursos | no | revert top-down to F3, as one PR of reverts (A's column stays, harmless) |
| A2 | nothing | no | a new migration restores her write |
| C | INVAs | to 27 | forward only |
| C2 | the start rule | no | revert |
| D1 | nothing on screen (server rules: an Operador's pedido born approved; PT403 for an approved pedido of a past date and for the exception on a Sunday or a past date) | no | forward only |
| D2, D3, E, G1 | Pedidos; restrictions in the Escala | no | forward only (28 on top in the same wave) |
| G2 | Processamento | to 28 | forward only |
| H | Aprovar | no | revert (I's SQL stays) |
| I | nothing | no | its SQL: a new migration |

"Forward only" means a fix PR at the top of the stack that keeps every `PASSOS` entry; a screen can be taken back only
inside such a commit, never by `git revert` of a merge below a number. Prepared in advance: for C, the reading of the
ranges is one function (`disponivelPara`), so a correction is one commit with the goldens of commit "dados"; for G2, the
stored days are unchanged by 28, so a fix can always re-read them. If the app cannot build Tuesday's escala on Monday,
the operator has Monday's CSV, PDF and Excel exported on Saturday, and Pedro (on call Sunday and at Monday's 13:00
build) fixes forward.

Each wave with a number costs one sweep: one read and one `salvar_dia` per stored day, in series, then the cadastro
(`js/storage.js:385-399`). Production opened on 2026-11-10, so its days are counted in tens; the inventory gives the
number and `publicado.spec.js:24` already allows 30 s. If the opening fails half-way, every Operador sees "Não foi
possível preparar os dados da escala…" (`js/main.js:115-119`) until an opening completes; the next opening resumes from
the days still below the number; the count query shows where it stopped.

### 2.9 The operator's typical day, counted

One date: 15 pedidos she registers herself (the same form before and after, not counted), 1 aircraft out, the afternoon
closed, 3 INVAs absent, 2 turnos, 1 lunch break on a period, 3 adjustments (an instructor, a priority, a resource type), 1
student with no pedido after the deadline, 1 student taken off, 1 cancellation, approve and the three files, then the next
date. Interactions (clicks, choices, typed fields), from the topic notes:

| Task | Today | After | Wave | Source |
|---|---|---|---|---|
| Open the next date | 1 (‹ ›) | 1 with the rail open (window from 1,600 px, or her stored choice); 2 with it closed | 1 | desenho-casca 2.13, D12 |
| One aircraft out | 2 | 2 (the switch on the row) | 1 | desenho-cadastros 2.7 |
| Close the afternoon | 4, in Recursos | 4, on the Escala (5 the first time: the block opens) | 1 | desenho-disponibilidade 2.8 |
| The INVAs | 1 + 8 | 1 + 9 | 2 | desenho-disponibilidade 2.7 |
| Bring the pedidos into the day | 2 (Demanda, "Importar N") | 2 (Processamento, "Atualizar a escala"); 0 for pedidos registered after the date started | 3 | desenho-nucleo 2.13; desenho-pedidos 2.9 |
| 3 adjustments | 3 (a select each, in the Demanda) | 6 ("Restrições" on the flight, the field) | 3 (G1) | desenho-escala-aprovar 2.13 |
| A student with no pedido, after the deadline | about 3 (name, Enter, a field) | about 7 (Pedidos, aluno, missão, horário, duração, "Exceção da Coordenação", "Registrar e aprovar"), or the booking dialog | 3 (G2) | desenho-nucleo 2.13; `js/eventos/agenda.js:67-111` |
| Take a student off | 1 ("Voa") | 1 ("Tirar da escala") | 3 | desenho-nucleo 2.13 |
| A student cancels | 3 (cancel 2, then "Voa" 1) | 2 (cancel: the flight leaves) | 3 | desenho-nucleo 2.13 |
| Approve and download the three files | 5 | 6 (the Aprovar card, then the same 5) | 4 | desenho-escala-aprovar 2.13 |
| Back to the Escala to run the day | 0 | 1 | 4 | |
| **Total** | **33** | **42** with the rail open, **43** closed | | |

- **Slower:** the date on a laptop (+1 while the rail is closed), the INVAs' pass (+1), a closed period the first time
  (+1), each adjustment (+1), a student with no pedido (+4), the trip to Aprovar and back (+2), each later download during
  the day (+2).
- **Faster:** pedidos registered after the date started enter by themselves (−2 per batch); a cancelled pedido leaves by
  itself (−1, and nothing forgotten); stale course missions are fixed for all students with one click (today one select
  per student); "Recomeçar pelos pedidos" brings the pedidos back (today each by hand); every restriction of the date in
  one place.
- Two counts depend on the width of her screen (question 14).

## 3. Where each existing control goes

Not applicable: this topic owns no screen. F0 moves code, tests and styles and changes no control; where each step moves a
control is in its topic's note, and when, in the ledger of section 5.

## 4. Data-format steps and migrations

**Format numbers.**

| Nº | Step | What changes | Conversion | Tests written first | Deploy |
|---|---|---|---|---|---|
| 26 | F3 | cadastro: `stu[].inativo`, `ins[].inativo`, `frota[].inativo` (only `true` stays) and `frota[].exige` | cadastro: a resource with `habilitacaoPropria: true` and no `exige` gets `exige: ['aviao:<reg>']`, the flag kept; day: none | `test/unit/migracoes.test.js` (a cadastro at 25, an unknown field survives, hostile values, a round trip), `dias.test.js:28-32, 164`, `storage-dias.test.js:428`, `atributos.test.js`, `frota.test.js`, the pin `ESQUEMA === 26`; e2e `datas-compartilhado.spec.js:53, 78, 96` | no SQL; Onda 1; Pedro's opening |
| 27 | C | day: `ins[id].faixas` beside `aw`, which stays | the day's step builds the ranges from `aw` with constants (a step sees only its own document) | the same pattern; the goldens identical in commit "dados" | no SQL; Onda 2 |
| 28 | G2 | nothing converted. It protects `etapaDoPrograma` on the records, the new use of `importadas` (an id may leave it), and the day keys `exportacoes` and `reabertura`, whitelisted in `separar`, `juntar`, `diaPadrao`, `diaParaCopiar` and `normalizeAndMigrateState` (absent means `{}` and `null`; a new date starts without them), normalised by `normalizarExportacoes` in `js/exportacoes.js` (created by G2, extended by H) | `{ cadastro: c => c, dia: d => d }` | `migracoes.test.js` (a day and a cadastro at 27 come out equal plus `esquema: 28`; `{ importado: true }`, `{ simulado: true }`); the key lists of `dias.test.js` and `storage-dias.test.js:428`; `test/unit/exportacoes.test.js` (hostile values of the two keys); `rules.test.js` (the mark kept only when `true`) | no SQL of its own format; G2's migration is the conversion's re-run; Onda 3 |

- **Why the order is safe:** the stack merges F3, C, G2 in that order, so `PASSOS` is always contiguous on `main`; one
  number per PR; C is the only parallel branch with one. A number means something once a database holds documents at it:
  the preview is written in stack order from the integration worktree, so nothing is renumbered after being stored. H
  writes keys that a tab on G2's code already keeps, and a tab before 28 is refused.
- **The literal assertions:** `test/unit/config-do-painel.test.js:127` (`assert.equal(ESQUEMA, 25)`) and `:129`
  (`esquema: 25`) would break at every step. F0a rewrites them (`assert.ok(ESQUEMA >= 25)`, `esquema: ESQUEMA`) and adds
  one pin, 'o formato dos dados gravados é o 25', in `test/unit/migracoes.test.js`. Each numbered step edits
  `js/migracoes.js:13`, its `PASSOS` entry, that pin, its own test and README 'Formato dos dados'.
  `test/unit/migracoes.test.js:220` (`[24, 25]`) needs no edit.
- **Cost of a number:** the sweep of 2.8, even when the step converts nothing (28), because
  `dias_em_formato_antigo(ESQUEMA)` lists every day below the number.
- Local mode has no format guard; the pedidos of `acpm4_agenda` get their approval keys by D1's one-off local conversion
  (rule (b) for every pedido, marker `acpm4_agenda_aprovacoes`; desenho-pedidos 2.5), which no format step covers.

**Migrations, in the order they reach the preview.** The dates may move; the order may not; all are later than
`20261120150000`. A file is renamed only before its first push.

| File | Step | Contains | Kind | pgTAP | Preview | Production |
|---|---|---|---|---|---|---|
| `20261122100000_<correção>.sql` (reserved, only if needed) | plan | the correction of an applied migration that Onda 0's `npm run test:db` finds red | corrective | the red check | Onda 0 | Onda 0 |
| `20261123100000_nome_completo_nos_dados_pessoais.sql` | A | nullable `dados_pessoais.nome_completo` (1 to 120 characters); `create or replace` of the 5-argument `salvar_dados_pessoais` reading the key (an absent key keeps the stored value, so a tab of the previous app does not erase it), "Nome completo" first in the History's list of fields, counted in "all empty deletes the row" (desenho-cadastros M1) | expand | `dados-pessoais.test.sql`: `plan(47)` to about 52 | as soon as written | Onda 1, before A's merge |
| `20261123100100_secretaria_nao_grava_dados_pessoais.sql` | A2 | the 5-argument function refuses anyone who is not operador or administrador (42501); `drop function` of the 3-argument overload; `le_dados_pessoais()` and the read policy untouched (desenho-cadastros M2) | tighten, contract | `:43` becomes `hasnt_function`; `:109` `throws_ok` 42501; `:110-111` nothing of hers in the History | right after A's | Onda 1, with A live, before A2's merge |
| `20261124100000_aprovacao_dos_pedidos.sql` | D1 | eight nullable columns of `solicitacoes` and two table checks; `drop function` of the 9-argument overload; a 13-argument `registrar_solicitacao`; the 10-argument one replaced as a shim (an Operador's pedido born approved, a Secretaria's waiting); `cancelar_solicitacao` replaced (an approved pedido of a past date: PT403; the Secretaria may cancel, desenho-pedidos' choice against posicao B3); `aprovar_solicitacoes`, `retirar_aprovacao_da_solicitacao`, `solicitacoes_por_dia`, `aprovar_solicitacoes_de_antes_da_aprovacao(boolean)`; grants; ends with `select …(true)`: rule (a) approves what a day still holds (on past dates the id in `importadas`; from today on the id and a record carrying it, any `fly`), rule (b) approves an Operador's or Administrador's own future pedidos not in `importadas` (desenho-pedidos 2.9) | expand, one contract | new `agenda-aprovacao.test.sql`, `agenda-preferencias.test.sql` (users in block `d300`); `agenda.test.sql`, `agenda-horas.test.sql`, `contas.test.sql`, `painel.test.sql` on the new signatures (53 checks rewritten, about 20 new) | during the parallel phase, from D1's branch | Onda 3, before D1's merge |
| `20261124100100_importados_ja_aprovados.sql` | G2 | `select public.aprovar_solicitacoes_de_antes_da_aprovacao(false);` rule (a) again, for what an old tab imported after D1's push | data | the conversion cases of `agenda-aprovacao.test.sql`, run twice | after the rehearsal | Onda 3, with D2 live, before G2's merge |
| `20261125100000_agenda_sem_a_versao_anterior.sql` | I | `drop function` of the 10-argument `registrar_solicitacao` and of `aprovar_solicitacoes_de_antes_da_aprovacao(boolean)` | contract | `agenda-horas.test.sql` and `agenda-locais.test.sql` on the 13 arguments; two `has_function` become `hasnt_function` | Onda 4 | Onda 4, before I's merge |

Each file is frozen once it is on the preview: a correction is a new file. Every step that changes a server rule updates in
the same PR its three JavaScript mirrors (`test/e2e/falso/*.js`, `clienteFalso` in
`test/unit/backend-supabase.test.js:17-199`, `js/backends/local.js`) and adds shared cases checked on CI
(`test/helpers/casos-das-solicitacoes.js` for D1, a personal-data equivalent for A, in the pattern of
`test/helpers/casos-do-programa.js` and `test/unit/espelho-do-banco.test.js`), because CI never runs pgTAP. Ten pushes in
all: five files, preview and production.

## 5. Files created, changed and deleted, by step

For F0 the list is complete. For the other steps it holds the shared files and **the deletion ledger**: every deletion is
in the same PR as its replacement; each step's own new files are in its topic's note.

| Step | Created | Changed | Deleted (in the same PR as the replacement) |
|---|---|---|---|
| plan | | `docs/PLAN.md`: the section; a "Servidores" table (migrations, the `meteorologia` function and its secret, `importar_cursos` with its condition, the Auth `config push` of :192, the three legacy overloads; columns prévia, produção, date, who) in place of the stale boxes at 159-160, 408-411, 457-458; the 17 items of :415-431 re-filed as carried, reworded or moved (lacuna-2-itens-abertos 2, implications A and B), with :437 ("Limpar demanda") and :421 ("a booking creates no Agenda request", kept: desenho-nucleo decision 11) among the decisions it reverses or keeps; :471 and :473 struck as answered. `README.md:180-190` (the format-24 procedure, in the past) | |
| F0a | `test/e2e/telas/{casca,invariantes,recursos,instrutores,alunos,demanda,pedidos,escala,cursos}.js`; `test/e2e/falso/{agenda,dados-pessoais}.js`; `test/e2e/{recursos,instrutores,alunos,gavetas-de-cadastro}.spec.js`; `test/e2e/manual-frases.js`; `test/unit/donos-dos-seletores.test.js`; `scripts/porta.mjs` | `package.json`, `playwright.config.js`, `scripts/serve.mjs`, `test/e2e/fixtures.js`, about 35 spec files (selectors behind drivers; screen tests moved out of `acessibilidade` and `celular`), `test/e2e/supabase-falso.js`, `test/e2e/publicado.spec.js`, `scripts/testar-banco.mjs`, `test/unit/config-do-painel.test.js:126-130`, `test/unit/migracoes.test.js`, README 'Testes' (the lint, the ports, the duration); `.github/workflows/testes.yml` only if the duration needs shards | `test/e2e/cadastros.spec.js`; the two local `mudarData`; the local `alvosPequenos` and `semNome`; `percorrerVistasEFiltros`; the four literal nine-tab lists; the ten waits on `#wins` |
| F0b | `js/redesenho.js`; `js/processamento.js`; `js/views/{instrutores,limites,alunos,linhas-filtradas,gaveta-de-dados}.js`; `js/eventos/{instrutores,alunos,dados-pessoais,peso-do-campo,limites,importacao,resultados}.js`; `test/unit/{redesenho,desenhos-registrados,eventos-ligados,reversoes-registradas,grafo-da-tv,processamento}.test.js`; `test/e2e/gravacao.spec.js` | `js/actions.js`, `js/main.js`, `js/dom.js` (`semFalhar` exported), `js/eventos/registro.js` (`aoReverter`), `js/eventos/historico.js`, `js/eventos/navegacao.js`, `js/eventos/escala.js`, `js/eventos/recursos.js`, `js/eventos/agenda.js`, every `js/eventos/*.js` (one registration), `js/agenda.js`, `js/rules.js` (the type check, own commit), `js/views/selos.js:48`, `js/views/dados-pessoais.js`, `js/views/demanda.js:18`, `index.html:292, 302`, `scripts/exportacoes-sem-uso.mjs`, the import lines of the files that named moved functions, four spec files (`import()` destructured), README 'Estrutura' (new rows; the stale rows of `js/frota.js` and `js/manual.js`) | `js/views/cadastros.js`, `js/eventos/cadastros.js`; the six redraw lists; the `if` chain of `js/eventos/historico.js:53-123`; the import half of `js/agenda.js` and of `test/unit/agenda.test.js:89-336` (moved) |
| F0c | `css/{base,componentes,painel,tv,casca,escala,demanda,agenda,recursos,instrutores,alunos,cadastros,cursos,rodizio,bi,conta,manual,gavetas,dialogos,toque}.css`; `scripts/medir-estilos.mjs`; `test/unit/estilos.test.js` (every file linked or imported; `app.css` imports exactly the five; `painel.html` links only `css/app.css`) | `css/app.css` (five `@import` lines), `index.html` (the links; `#s-manual` one sentence per line), `js/glossario.js:14` (one group per line), `README.md:198` | the rules of `css/app.css` (moved); `.chip.off` (269), `.num` (576), `.saldo` (836), `details.pn summary` (1548-1549) |
| F3 | `js/inativos.js`, `js/eventos/inativos.js`, their tests (desenho-cadastros 5) | `js/migracoes.js`, `js/dias.js:41-47`, `js/frota.js`, `js/habilitacoes.js`, `js/storage.js` (normalizers), `js/actions.js:367`, `js/processamento.js` (the gate in the moved import), `js/reversoes.js`, the readers of the rosters, README rows 200, 202 and 'Formato dos dados' | `GRUPOS_DE_HABILITACAO` and `gruposDosRecursos` leave the views (they live in `js/habilitacoes.js`) |
| F1 | the shell's modules and tests (desenho-casca 5: `js/telas.js`, `js/views/telas.js`, `js/linha-do-dia.js`, `js/views/linha.js`, `js/calendario.js`, `js/views/trilho.js`, `js/eventos/trilho.js`); `css/linha.css`, `css/trilho.css` | `index.html` (its regions; line 260), `css/casca.css`, `css/base.css`, `css/tv.css`, `css/gavetas.css`, `css/agenda.css`, `js/eventos/navegacao.js`, `js/eventos/topo.js`, `js/actions.js:20-41, 54-58`, `js/main.js`, `js/views/selos.js`, `js/somente-leitura.js:6`, `js/views/agenda.js`, `js/eventos/agenda.js`, `js/eventos/bi.js:16, 28`, `js/views/bi.js:33`, `js/storage.js` (`contagemDaAgenda`), `js/eventos/escala.js:95-102`, `js/dom.js:171-178`, `js/glossario.js`, the drivers `casca.js` and `invariantes.js`, README | `nav#nav` and its buttons (index.html:90-103); `#dt`, `#dt-ant`, `#dt-prox` (57-67; `#dt-rotulo` and `#dt-rel` move into `button#btn-data`); `js/eventos/topo.js:23-63` (`avisoDeDomingo` moves to `js/eventos/trilho.js`); `js/views/tabs.js`; the `data-t` and `data-go` branch of `js/eventos/navegacao.js:19-32`; the Agenda's calendar and own day (`calendarioHTML`, `gradeDoMes`, `mesVisivel`, `mudarMes`, `escolherDia`, `diaEscolhido`, `diaDaAgenda`, `abrirAgenda`, `#agenda-cal`, the `[data-cal]` listener); the tab badges `#selo-esc`, `#selo-age`, `#selo-rec` and `test/e2e/selos.spec.js` as it is (its tests become rows and values); their CSS (old 77-105, 165-177, 184, 186, 208, 242, 244, 1147-1157, 1555, 1586-1588, 1608); the pin `principalMax: '1280px'` (app.spec.js:88-92), replaced by the cap of 1,612 px |
| F2 | the list component (desenho-lista 5); `css/lista.css` | `index.html` `#s-alu` (not line 260), `js/views/alunos.js`, `js/eventos/alunos.js`, `js/views/dados-pessoais.js`, `js/eventos/dados-pessoais.js` (the drawer opens only for `instrutor:`), `js/perfis.js` (`editaDadosPessoais`: true for operador, administrador and secretaria) and `test/unit/perfis.test.js`, `css/alunos.css`, `css/cadastros.css`, `js/backends/supabase.js`, `js/actions.js`, the driver `alunos.js`, `gavetas-de-cadastro.spec.js` (student cases point at an instructor) | `table.cadastro.alunos` and its toolbar (index.html:251-259, 261-264); `linhaDoAluno`, `atualizarLinhaDoAluno`; the Alunos filter state; the Alunos half of `css/cadastros.css` (old 1111, 1120-1122, 1127-1128) |
| A | its migration; the shared cases for personal data | `index.html` `#s-alu`, the Manual blocks of 2.3, `css/alunos.css`, `js/views/alunos.js`, `js/eventos/alunos.js`, `js/eventos/resultados.js`, `js/views/dados-pessoais.js`, `js/dados-pessoais.js`, `js/perfis.js` (`editaDadosPessoais` false for the Secretaria), `js/storage.js:303-305`, `js/backends/supabase.js:239-255`, `js/resultados.js`, `js/progresso.js`, `js/glossario.js`, `test/e2e/falso/dados-pessoais.js`, `test/e2e/dados-pessoais.spec.js`, `dados-pessoais.test.sql`, README.md:13-15 | "Abrir a Demanda" (index.html:260) with `.ir-para-demanda` (old 185, 1068-1069) and app.spec.js:74-76; the opener `[data-dados="aluno:…"]`; the sentence "Só operadores, administradores e a secretaria veem estes dados…" as an edit permission (`js/views/dados-pessoais.js:95`) |
| A2 | its migration | `dados-pessoais.test.sql`, `test/e2e/falso/dados-pessoais.js` (the write asks operador), `test/unit/supabase-falso.test.js` | the 3-argument `salvar_dados_pessoais` |
| B | `js/views/periodos.js`, `js/eventos/periodos.js` (imported by `js/eventos/escala.js`) and their tests | `index.html` `#s-rec` and `details#periodos` in `#s-esc`, `css/recursos.css`, `css/escala.css`, `js/views/recursos.js`, `js/eventos/recursos.js`, `js/views/horarios.js`, `js/habilitacoes.js`, `js/frota.js`, `js/reversoes.js`, `js/dias.js:118-123`, `js/views/selos.js`, `js/linha-do-dia.js`, `js/telas.js`, `js/engine.js:932`, `js/manual.js:32, 43`, `js/views/manual.js:11`, `test/unit/manual.test.js:35-36`, `test/e2e/app.spec.js:133, 194-205`, the driver `recursos.js` | `#wins` (index.html:166-169) and its rules (old 239, 784-791, `.janela` in 1594); the two views of Recursos (`[data-vista-rec]`, `#selo-rec-dia`, old 792-808), `rFrota`, `alternarAtributos`, `table.frota`; `js/views/filtros-dos-recursos.js`; `#manual-janelas` and `janelasDoManual`; the glossary ids `janelas` and `horario-em-janela-fechada`; the section's tests |
| C | `js/disponibilidade.js`, `js/views/disponibilidade-do-dia.js`, `js/eventos/disponibilidade-do-dia.js` (imported by `js/eventos/instrutores.js`), their tests | `js/migracoes.js` (27), `js/viabilidade.js`, `js/dias.js`, `js/storage.js:144-147`, `js/agendamento.js:934-939`, `js/reversoes.js`, `js/views/instrutores.js`, `js/eventos/instrutores.js`, `js/views/limites.js`, `js/eventos/limites.js`, `js/somente-leitura.js:8`, `js/views/escala.js:580`, `js/engine.js:961` and 7 lines of `cenario-06.json` (commit "texto"), `js/telas.js`, `index.html` `#s-ins`, `css/instrutores.css`, `js/glossario.js`, `test/helpers/cenarios.js`, `test/unit/grafo-da-tv.test.js`, the driver `instrutores.js`, README | the availability grid (`table.disp`, `#inst-dia-cab`, `#inst-dia`, the legend, `.cel`, `td.jan`, old 240, 1041-1067, 1596), `rInsDia` and the registration `instrutores-dia`; the select "Aplicar turno…" (replaced by five `faixas-turno` buttons) and the term `turno` (replaced by its new term); `aside#painel-instrutor` with `rPainelDoInstrutor`, `abrirPainelDoInstrutor`, `fecharPainelDoInstrutor`, its Esc listener and the registration `habilitacoes-do-instrutor`; `aside#painel-dados`, `js/views/gaveta-de-dados.js`, `js/eventos/dados-pessoais.js` and its Esc listener; `table.cadastro.instrutores` and `css/cadastros.css`; `js/views/vistas.js`, `section[data-vista]` (old 845-847) and the drivers' `vista` argument; `test/e2e/gavetas-de-cadastro.spec.js` (what survives goes to `instrutores.spec.js`); `js/eventos/peso-do-campo.js` if nothing imports it |
| C2 | | `js/disponibilidade.js` (`disponivelPara`, `oQueCabe`), `js/engine.js:759, 955`, the glossary and Manual sentences (index.html:529, 565, 570, 574), 37 golden files re-recorded | |
| D1 | its migration; `agenda-aprovacao.test.sql`, `agenda-preferencias.test.sql`; `test/helpers/casos-das-solicitacoes.js` | `js/backends/supabase.js`, `js/backends/local.js` (and the one-off local conversion), `js/storage.js`, `test/e2e/falso/agenda.js`, `clienteFalso`, the four pgTAP files of 4, `test/unit/backend-local.test.js`, `backend-supabase.test.js`, `supabase-falso.test.js`, `espelho-do-banco.test.js`, `scripts/semear-dias-previa.mjs`, README "Banco" | the 9-argument path of the fake and of `clienteFalso`; the 9-argument `registrar_solicitacao` |
| D2 | `js/solicitacoes-da-data.js` and its test | `js/agenda.js`, `js/views/agenda.js`, `js/eventos/agenda.js`, `js/eventos/importacao.js`, `js/views/selos.js`, `js/actions.js`, `js/telas.js`, `js/storage.js`, `js/backends/*.js`, `js/linha-do-dia.js`, `js/views/reparo.js:34`, `js/glossario.js`, `index.html` (`#s-age`, line 302, the Manual), `css/agenda.css`, README (:13-14, :209, 'Estrutura'), the driver `pedidos.js` | the column Situação "Na demanda" / "Ainda não importado" (`js/views/agenda.js:147-148`); `listaHTML`, `situacao`, `pendentesDaDataAberta`, `pedidosCarregados` and its cache; in `js/views/selos.js` `lerPedidosDaData`, `pedidosDaData`, `pedidosPendentes`; F1's row "ainda não importados" and its rail item |
| D3 | | `js/solicitacoes-da-data.js`, `js/agenda.js`, `js/views/agenda.js`, their tests | |
| E | `js/rejeicoes.js` and its test | `js/processamento.js`, `test/unit/processamento.test.js`, `js/eventos/importacao.js` (the call), `js/views/selos.js` (the count), `js/agendamento.js`, `js/views/agendamento.js:184`, `js/rules.js`, `js/dias.js` (`juntar`), `test/unit/agendamento.test.js`, `rules.test.js`, `agenda.test.js` (the three tests that pin the reuse of a main request carrying a pedido), README | `importarSolicitacoes`, `vooQueDaLugar`, `naOrdemDoMotor` (replaced by the conciliation and the pairing) |
| G1 | `js/restricoes.js`, `js/views/restricoes-do-voo.js`, `js/eventos/restricoes-do-voo.js` (imported by `js/eventos/escala.js`), their tests (`test/e2e/restricoes-do-voo.spec.js`) | `index.html` (`#s-dem` headers, `#s-esc`, the Manual blocks of 2.3), `js/views/escala.js`, `js/eventos/escala.js`, `js/views/demanda.js`, `js/eventos/demanda.js`, `js/views/etapas.js`, `js/instrutor-escolhido.js`, `js/rules.js`, `js/fixos.js` (`fixosSemOAgendadoQueMudou`), `css/escala.css`, `css/demanda.css`, `js/glossario.js:61-66`, the drivers `demanda.js` and `escala.js` | the Demanda's columns Recurso, Instrutor, 1ª e 2ª preferência, Disponibilidade, Duração, Prioridade, and "Usar" / "Outra missão…" in the Aluno cell (their handlers in `aoMudarCampo('d')` and `aoAcionar('usar-proxima', 'usar-fora-da-ordem')`); `rm-fly` and `aoReverter('setFly')` leave `js/eventos/demanda.js` (moved) |
| G2 | the Processamento screen (desenho-nucleo 5), `css/processamento.css`, its migration, `js/exportacoes.js` (the normaliser only), `scripts/reiniciar-ensaio-previa.mjs` | `js/processamento.js`, `js/migracoes.js`, `js/dias.js`, `js/rules.js`, `js/storage.js`, `js/fixos.js` (`limparDemanda(estado, { fica })` for "Recomeçar pelos pedidos"), `js/agendamento.js`, `js/eventos/restricoes-do-voo.js` (`podeVoltarAEscala`), `js/eventos/agenda.js`, `js/views/agenda.js`, `js/views/cursos.js:72, 85`, `js/eventos/cursos.js:396, 402`, `js/reversoes.js:141-142`, `js/views/etapas.js`, `js/engine.js:994` (own commit; no golden; `test/unit/instrutor-escolhido.test.js:73`), `js/export.js:54` ("Missões pedidas"), `js/views/escala.js:597, 624`, `index.html:373`, `js/conflitos.js`, `js/backends/supabase.js:172`, `js/linha-do-dia.js`, `js/telas.js`, `js/main.js`, `index.html` (`#s-proc`, the Manual), `js/glossario.js`, `scripts/semear-dias-previa.mjs`, README; the driver `demanda.js` becomes `processamento.js` | `#s-dem` (index.html:299-341); `js/views/demanda.js`; `js/eventos/demanda.js`; `js/eventos/importacao.js`, `#importar-agenda`, `#agenda-importar` and their texts; what is left of `js/views/selos.js`; `css/demanda.css`; `js/views/linhas-filtradas.js`; "+ Pôr um aluno na demanda", "+ missão", the "✕" of an extra, the Voa switch; D2's until-G functions (`situacaoNaDemanda`, `solicitacoesParaImportar`, `solicitacoesAindaNaDemanda`, `entrarNaDemanda`, the "…demanda" tags, the row "Fora da demanda"); `etapaNaDemanda`; each export the lint then refuses, re-homed or deleted with its tests one by one (lacuna-1-importadores 6); `test/e2e/demanda.spec.js` (its "Limpar demanda" and filter tests return in `processamento.spec.js`) |
| H | the Aprovar stage and the restrictions of the date (desenho-escala-aprovar 5), `css/aprovar.css` | `index.html` (`#s-esc`, `section#s-apr`, the Manual), `js/linha-do-dia.js` (the final bodies), `js/telas.js`, `js/views/escala.js`, `js/eventos/escala.js`, `js/export.js`, `js/exportacoes.js`, `js/actions.js`, `js/main.js`, `js/glossario.js`, `css/escala.css`, the drivers `escala.js` and `casca.js`, README | the second bar of `#s-esc`; `#aprovacao` and the exports' buttons in the Escala's bars (index.html:358-361, 369) with their bindings (`js/eventos/escala.js:90-92, 106, 197-219`); the button half of `rAprovacao`; the named place `#/esc/aprovacao`; the first-version bodies of the adapter. Kept by default: the labels "Avião" and "Não mudar" (question in desenho-escala-aprovar) |
| I | its migration; `test/unit/nomes-aposentados.test.js` | the Manual, `test/e2e/manual-frases.js`, README, `test/e2e/fixtures.js` and the drivers (aliases removed), `agenda-horas.test.sql`, `agenda-locais.test.sql`, the fake and `clienteFalso` (the 10-argument path), `test/unit/backend-supabase.test.js` | the 10-argument `registrar_solicitacao` and the conversion function; old selectors left in shared rules; whatever the guard of retired names finds |

## 6. Tests

**Written first, per step.** A step's first commits are its tests, red; for a step with SQL, the pgTAP files and the shared
cases come before the screen, and D1's run red then green on the preview during the parallel phase.

| Step | First tests |
|---|---|
| F0a | `donos-dos-seletores.test.js`; the pin of the format in `migracoes.test.js`; the measured duration |
| F0b | `redesenho.test.js` (order, moments, unknown and repeated names, a drawing that throws); `gravacao.spec.js` (with `#out` removed from the page, a change is saved and its History entry written: red on today's order); `eventos-ligados.test.js`; `desenhos-registrados.test.js`; `reversoes-registradas.test.js`; `grafo-da-tv.test.js`; the hostile type of `normalizeMissionFields` |
| F0c | `estilos.test.js`; the census before and after |
| F3 | the unit tests of 26, of the registry and of `js/inativos.js`; `inativos.spec.js` with an inactive record seeded in `acpm3` |
| F1 | `calendario.test.js`, `linha-do-dia.test.js` (first version), `casca.spec.js`, `trilho.spec.js`; the checkers failing on an injected small button |
| F2 | `lista.test.js`, `detalhe.test.js`, `lista.spec.js`; `perfis.test.js` for `editaDadosPessoais` |
| A, A2 | pgTAP and the shared cases; then `alunos.spec.js`; the Secretaria in Alunos and Instrutores |
| B, C | the unit tests of the pure part (`disponibilidade.test.js`: ranges reproduce `cobre` on every pattern); then the screen's e2e; C: "the Secretaria reads an INVA's personal data and has no form" |
| D1 | `agenda-aprovacao.test.sql`, `agenda-preferencias.test.sql`, `casos-das-solicitacoes.js` with its mirror test |
| D2, D3 | `solicitacoes-da-data.test.js`; the timers |
| E | `processamento.test.js` beyond the 21 moved tests; `rejeicoes.test.js` |
| G1 | `restricoes.test.js`; `restricoes-do-voo.spec.js`; a stored `setFly` History row restores from the Escala |
| G2 | `processamento.spec.js`; the tests of 28; a local-mode day with imported pedidos (`acpm4_agenda` and `acpm4_dia_*` seeded) through the first conciliation; the rehearsal |
| H | the final `linha-do-dia.test.js`, `restricoes-da-data.test.js`, `exportacoes.test.js`, `aprovacao.test.js`, `aprovar.spec.js`, `restricoes-da-data.spec.js` |
| I | `nomes-aposentados.test.js` |

**Size of the e2e rewrite** (578 tests in 45 files today; estimates on mapa-testes 5.3 and the topic notes, by file).

| Step | Spec files it owns (tests today) | Rewritten or deleted, about | New, about |
|---|---|---|---|
| F0a | 35 files touched mechanically; 4 created by the split and the moves | 0 | 2 unit |
| F0b | | 6 lines | 20 unit, 2 e2e |
| F3 | `atributos` (3), three assertions of `datas-compartilhado` | 6 | 30 unit, 6 e2e |
| F1 | `app` (8 of 11), `selos` (5), the shell's tests of `acessibilidade` (about 30) and `celular` (3), the date tests of `agenda` (4) and `datas` (4) | 55 (about 80 without the drivers) | 30 |
| F2 | `alunos` (11), `dados-pessoais` (the student half, about 6), `perfis` (2), `gavetas-de-cadastro` (6 pointed at an instructor) | 28 | 15 unit, 20 e2e |
| A, A2 | `dados-pessoais` (the four Secretaria tests) | 4 | 10 e2e; pgTAP about 6, then 3 inverted |
| B | `recursos` (22), `hangar` (2), `revisao` (3), `atributos` (3), `app` (2) | 33 | 12 |
| C | `instrutores` (11), `limites` (4), `gavetas-de-cadastro` (11), `perfis` (1) | 30 | 12; unit `viabilidade` (14) kept on `aw` in commit "dados" |
| D1 | none | 0 | pgTAP: 53 checks rewritten, about 20 new; unit about 15 |
| D2, D3 | `agenda` (16), `agenda-compartilhado` (9), `selos`' rows (2), `noturno` (1), `atributos` (1), `publicado` (1) | 30 | 15 |
| E | | 0 to 3 | 25 unit |
| G1 | `instrutor-escolhido` (11), `cursos-no-dia` (9), the restriction tests of `demanda` (about 10), `noturno` (2), `dicas` (2) | 35 | 20 (and 15 unit) |
| G2 | the rest of `demanda` (about 13), `historico` (6), `cursos` (about 15), `abertura` (the import and "Pôr um aluno"), `perfis` (1) | 45 | 30 |
| H | `aprovacao` (6), `compactacao` (3), `dicas` (3), `escala` (3), `planilha` (6), `escala-automatica` (3) and one line in about 20 others | 45 | 27 (and 95 unit) |
| I | `app` (the Manual test), `rodizio` (1) | 3 | 1 unit |

About 310 of the 578 tests are rewritten once; the others reach the app only through drivers and seeds and change with a
driver's body (S1).

## 7. Departures from Pedro's request

| The request says | This design does | Why | Pedro can choose instead |
|---|---|---|---|
| "`npm test` green on every step (node:test, Playwright, ESLint)" | F0a puts the lint inside `npm test` | today it runs no lint (package.json:11) | keep the lint separate and name both in the rule |
| Foundation: F1, F2, F3, serial | a step zero in three PRs; then F3, F1, F2 | decisions 2 and 3 | the request's order, with 26 in F2, 27 in F3 and every later number one higher |
| "F2. The master–detail list component" | F2 is the component plus Alunos with today's fields; A is what is new | the lint refuses a module nothing in `js/` calls | F2 and A as one step: B and C start later |
| "E. The Processamento module and its tests (no UI)" | E is the body of today's "Importar da agenda" | the same lint | E and G as one step |
| "`index.html`, `css/app.css`, `js/eventos/registro.js` and `js/migracoes.js` are shared by everything" | every shared file of 2.3 gets an owner, the tests included; `css/app.css` is split, and kept as the TV's `@import` entry | lacuna-1-importadores 7; mapa-testes 5.7 item 8; lacuna-2-exportacoes 5 | regroup `css/app.css` in place |
| "independent workstreams in parallel …, as the `abas-*` branches did" | four parallel lines rejoined as one in a fixed order; D's SQL on the preview early | the `abas-*` PRs were a stack, merged in one minute; the preview is one database | fewer parallel branches (B and C serial), at the price of time |
| "one PR per step" | F0 is three PRs; A has A2; D is three (its owner's split); G is two | reviewability; decisions 8 and 17 | one F0 PR; A and A2 as one file if no Secretaria account exists; G as one PR |
| "migrations applied to preview, then production, before the merge" | kept for every file, by splitting A's | decision 8 | posicao's single file applied after A's merge, as a declared exception |
| "I. Removal of everything replaced; Manual, glossary and README" | each step deletes what it replaces and updates the three; I is the read-through and the last contract | the tests force it; the guardrail forbids two versions | nothing: the tests leave no other order |
| "G. Processamento screen and the engine reading its output" | G1 brings the editor of a flight's restrictions to the Escala stage; G2 the screen | nothing deleted before its replacement (decision 17) | the editor before G as an H1 (desenho-nucleo), or G as one PR |
| "The goldens change only in commits whose purpose is a rule change" | one golden commit in C, text only (7 lines of `cenario-06.json`) | decision 15 | keep the text, pointing at a view that is gone |
| "Rename the tab … to 'Pedidos'" (D); the pipeline (F1) | the cards carry Agenda and Demanda from F1 until D2 and G2 rename them | decision 11 | final names from F1 |
| "Reuse … `mostrarVista`" | `js/views/vistas.js` is deleted by C with the last view switch | the request itself ends the "Disponibilidade do dia \| Cadastro" split; the lint refuses an export nobody uses | keep a view switch inside a detail pane (a topic decision, not a delivery one) |
| (not in the request) "Limpar demanda", Pedro's decision of 2026-11-19 (docs/PLAN.md:437) | becomes "Recomeçar pelos pedidos" in G2: the same clearing, then the approved pedidos enter again | desenho-nucleo decision 17; the request's list of reversals does not name it | remove it, or keep today's clearing |
| "Recurso" and "Não considerar" as the criteria's labels | H keeps "Avião" and "Não mudar" until Pedro answers | the requested labels misdescribe the code (desenho-escala-aprovar decision 6) | the requested labels |
| (not in the request) | five release sittings; `main` takes only fixes meanwhile | decision 13 | merge each PR when it is green, or three visible waves |

## 8. Questions for Pedro, each with the default this design implements

1. **The waves and the undo.** Default: Onda 0 (plan, F0a, F0b, F0c), Onda 1 (F3, F1, F2, A, A2, B), Onda 2 (C), Onda 3
   (D1, D2, D3, E, G1, G2), Onda 4 (H, I), each a Saturday after Monday's escala is approved and exported. After an
   opening that sweeps (Ondas 1, 2, 3) there is no revert below the number: Onda 1 can be undone down to F3, the others
   only forward. Alternatives: C inside Onda 1 (one sitting less, Onda 1 forward-only), or every PR as it turns green.
2. **Who merges, and when.** Default: Gabriel merges each sitting at an hour agreed with Pedro; Pedro runs the ten pushes
   and opens production first; the operator and the other Administradores are told not to edit or open during it.
3. **May `npm test` include the lint?** Default: yes.
4. **F3 before F1 and F2, and F2 landing with Alunos?** Default: yes (one number, 26).
5. **Is there a Secretaria account in production?** Default: assume there may be, so A and A2 are two files and two PRs.
   With none (as on 2026-11-10, docs/PLAN.md:158) they become one file applied before A's merge.
6. **The text-only golden change in C** ("Instrutores › Cadastro"). Default: allowed, as its own commit.
7. **The availability rule ("a range limits when a mission starts").** Default: not built; C keeps today's meaning
   (desenho-disponibilidade D6). With a yes: C2, its own PR and sitting, revertible.
8. **Where the editor of a flight's restrictions lands.** Default: G1, the PR before the one that deletes the Demanda.
   Alternative: an H1 before G, as desenho-nucleo has it (the Demanda and the Escala then edit the same fields for one PR).
9. **Format 29 folded into 28 (H with no number)?** Default: yes. Alternative: 29 in H, one more sweep and H forward-only.
10. **Cards during the work.** Default: four cards from F1 (Agenda, Demanda, Escala, Aprovar; Aprovar opens the Escala's
    approval until H); D2 and G2 rename. Alternative: three cards until H.
11. **Where the preview checks run.** Default: the integration worktree's server with `?supabase=previa`, with two sessions
    with the operator (Prévia 1 after F2, Prévia 2 before Onda 3). Alternative: the fork's Pages at the stack's tip (which
    branch it publishes is not written in the repo).
12. **CI on the fork.** Default: a CI-mode local run before each push and the PR's run on upstream before the merge.
    Alternative: Pedro turns Actions on for the fork, so every push runs CI.
13. **Changes to `main` during the redesign.** Default: fixes only, carried up the stack the same day; SQL fixes by the
    rule of 2.5.
14. **The width of the operator's screen.** Default assumption: a laptop below 1,600 px, so the rail starts closed and the
    next date costs 2 clicks unless she keeps it open (2.9).
15. **`importar_cursos`.** Default: outside the redesign, an open line of the "Servidores" table with its condition.
16. **The 131 database checks never recorded on real pgTAP.** Default: `npm run test:db` on the preview from unchanged
    upstream/main before F0a starts; a red check is fixed first, in the reserved file.
17. **The Auth configuration push of 2026-11-11.** Default: Pedro compares it in Onda 0's inventory and pushes it if it is
    pending, as its own server command, outside the redesign's files.

## 9. Risks, and what would make this design wrong

1. **The stack.** Eighteen PRs after the plan; up to six unmerged inside Onda 1; four lines in parallel. A fix on `main`
   crosses all of them. Mitigation: the sittings, fixes carried up the same day, the shared-fix rule.
2. **F0 claims no change and moves most of the code's seams.** The registry changes the order of two independent redraws;
   the save moves before the redraws; the stylesheets are reordered. The e2e suite, the extended census and Onda 0 released
   alone are the checks. A tooltip opened inside a drawer is still covered by no test (lacuna-1-css 7).
3. **The stylesheet split could change a style the census cannot show equal.** Then F0c falls back to regrouping
   `css/app.css` in place, with the multi-screen rules still split; the ownership works by section instead of by file.
4. **The parallel phase.** The list component is the likeliest unknown: B (groups, a pinned item), C and D2 will ask it for
   more than Alunos proved. If its interface has to change rather than grow, B, C and D2 stop being parallel.
5. **The preview is one database.** A push from the wrong checkout blocks every branch below it; D1's early push means
   `npm run test:db` means something only from a checkout that holds its files. Only the integration worktree is linked,
   and every push starts with a dry-run.
6. **The cut-over in G2 is forward only.** The rehearsal with its reset and the count in three classes are the checks; if
   either shows a difference, G2 does not merge.
7. **Sweeps.** Three; a sweep that fails half-way closes the app for Operadores until an opening completes; Pedro, not the
   operator, opens first, on a Saturday.
8. **The TV.** Every wave changes modules it loads; a link failure shows only at its 03:00 reload and leaves it blank. The
   graph test, the 65 TV tests and one opening of `painel.html` per wave are the checks.
9. **The machine and CI.** Five worktrees running Playwright with no retries produce false reds; the e2e duration is
   unknown against a 15-minute cap; CI on the fork may be off.
10. **The 9-argument `registrar_solicitacao` stays reachable until Onda 3**, without the duration rule and the local-flight
    limit (lacuna-1-pendencias D).
11. **Two people per sitting.** Gabriel merges, Pedro pushes and opens: every wave waits for both, five sittings, ten
    pushes.
12. **The operator's typical day costs 9 more interactions** (33 to 42, 2.9), most of them in adjustments and late
    additions; on a narrow screen one more per date change.
13. **The sibling notes still disagree on names**: the redraw moments (`'pedidos'` here, `'solicitacoes'` in
    desenho-pedidos), the edit predicate (`editaDadosPessoais` in desenho-cadastros, `podeEditarDadosPessoais` in
    desenho-lista), the registry (`redesenharTelas` in desenho-disponibilidade), the step of the editor (desenho-nucleo).
    The plan must write one table of these names before F0 starts.
14. **What would make this design wrong:** Pedro wanting each step in production as it turns green (then decision 11
    matters more and the D-without-G state reaches the operator); another topic adding SQL or a number to F1, F2, G1 or H
    (the lineage of section 4 grows and needs its slot); S1 failing (if tests must seed approved pedidos instead of
    requests, G2 rewrites the seeds of 36 spec files); the list component failing on Recursos (risk 4); a hotfix migration
    during the redesign (later files then need `--include-all`).

<!-- revisado -->
<!-- fim -->
