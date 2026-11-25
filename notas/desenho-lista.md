# Desenho: The master-detail list component (F2) and editing in place

<!-- Design note for the production-line redesign. Local working note: never commit this file. -->

Designed on the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`); paths are relative to it. "(ran)" marks a
fact confirmed with `node` on a pure module, or in Chromium 158 through Playwright on a scratch page with no app code and no
network (scripts in `/private/tmp/claude-501/-Users-pedrofernandes-ACPM/5d1f0955-e20a-47d4-acd8-3ee432e7a836/scratchpad/desenho-lista/revisao/`:
`adiar.mjs`, `custo.mjs`, `chave.mjs`); "(computed)" a number worked out from the CSS; "(not run)" what was only read. Nothing in
the worktree was changed. Revised after two independent reviews (revisoes-lista.json); every finding was accepted.

What this note assumes from the other topics:

| From | Assumption | Used in |
|---|---|---|
| Delivery (desenho-entrega) | The stack F0a, F0b, F0c, F3, F1, F2, A, A2, B, C, D, E, G, H, I: F3 (format 26, `inativo` in the whitelists, every reader gated) is merged before F2 | D6, D18 |
| | F0b: the redraw registry (`registrarTela` in `js/telas.js` in the delivery note, `registrarDesenho` in `js/redesenho.js` in the shell note: this note writes `registrarDesenho`, and the plan keeps one name), the save before the redraws, the revert registry `aoReverter`, and the split of the shared modules with the delivery note's file names plus the five additions of 2.11 | D17, 2.11 |
| | F0a: the drivers `test/e2e/telas/*.js` (F2 owns `telas/alunos.js`; F1 owns `telas/invariantes.js`); `test/e2e/cadastros.spec.js` split into `recursos`, `instrutores` and `alunos` spec files; the six whole-module `import()` lines destructured | 6 |
| | F0c: one stylesheet per owner (`css/alunos.css`, `css/cadastro.css`, `css/casca.css`, `css/toque.css` last) | 2.12, 5 |
| Shell (desenho-casca) | `main#conteudo > section.tela`; `mostrarTela(tela, { item, historico, focar })` with the address `#/<tela>/<item>`; the pane contract of its 2.7 (`data-forma="lista-detalhe"`, two `[data-regiao]` children, `data-vendo`, one view below 800 px of viewport, panes that scroll on their own from 800 px), which its section 5 gives F2 to build; `REGIOES` for the checkers; the tokens `--sel`, `--avT`, `--av1` to `--av5` (its 2.11; added by F1, or by F2 if the shell's review moves them) | D16, D21, 2.10 |
| Cadastros (desenho-cadastros) | each screen's row content and switch texts (its 2.5, D8, D11); personal data as one section with "Salvar" (its D17), which F2 builds for Alunos and C mounts for INVAs; `editaDadosPessoais(perfil)` in `js/perfis.js`. Two changes this note asks of it: the `ativo` handler is F2's, not F3's (D6), and "open this record" is `mostrarTela(tela, { item })`, not `abrirRegistro` (D16) | D6, D12 |
| A, B, C, D, G | consume the component and do not edit its files (section 5) | 5 |

## 1. Decisions

| # | Decision | Why | Evidence | Rejected, and why |
|---|---|---|---|---|
| 1 | **Three layers, no framework.** Pure builders `js/lista.js` and `js/detalhe.js` (a model in; HTML parts and small decisions out; no DOM, no `S`); controllers `js/views/lista.js` and `js/views/detalhe.js`; the wiring `js/views/mestre-detalhe.js`. A screen's event module calls `criarMestreDetalhe` and registers its draw; its view module builds the models from `S` | The builders are written test-first with node:test; only the screen reads `S` | Views that touch no DOM at evaluation are already imported by unit tests (test/unit/progresso.test.js:15); no view binds at evaluation (lacuna-1-importadores §1) | Custom elements: a shadow root hides `data-act`, `data-f` and the fields from the document listeners (js/eventos/registro.js:19, :37), from js/somente-leitura.js:5-9 and from the focus keeping |
| 2 | **Delegated listeners; a static toolbar; filters made at the first draw.** `criarMestreDetalhe` only registers (document listeners for its `data-lista`, the model functions). Each filter's `criar` runs once, at the first `desenhar()` that finds the list's container; a draw without its container returns. The toolbar (search, filter buttons and panels, "Mostrar inativos", count, "+ Novo") is markup of index.html, never redrawn | `criarFiltroMultiplo` reads `#<id>` and `#<id>-painel` when it is created, throws when either is missing, and binds its own listeners to them | js/views/filtro-multiplo.js:30, :35, :81-103; lacuna-1-importadores §1-2 (65 of the 66 selectors read at evaluation stop the load) | Creating the filters when the event module is evaluated (a missing button would stop the load); drawing the toolbar from the model (the filter's listeners would be lost at each draw) |
| 3 | **A draw never replaces what is in use, and replaces only what changed.** (a) While a mouse button is down the draw waits: it runs right after the click (`setTimeout` after `mouseup`), at the next key, or when the window loses focus. The state is read from `mousedown`/`mouseup` (`ponteiroApertado()`, moved to js/dom.js from js/eventos/cursos.js:90-93, which imports it). (b) Each pane is a list of keyed parts (a row; the header, the notice, each section and the foot of the detail). `trocarPorChave(lugar, partes)`, new in js/dom.js beside `trocarConteudo` and with its focus rules, keeps a part whose HTML is the same and whose controls show what was drawn, replaces the others, and holds (keeps as it is, draws later) a part that holds an armed button or the focused field while it has typed text. A redraw caused by an answer (a personal-data read or save, the re-read after a conflict) therefore touches only the parts it changes | A typed field's `change` fires at the `mousedown` that moves the focus; a redraw then removes the pressed element: no `click`, the focus on `body`, the next key lost (ran, mouse and touch). Held until the click, one click is enough and the digit lands (ran). On touch `pointerup` comes before the compatibility `mousedown` that moves the focus (ran: pointerdown, pointerup, mousedown, change, mouseup, click), so pointer events cannot bracket the `change`. Replacing 300 rows costs 15 ms here and 57 to 91 ms at CPU 4× to 6×; by key, a save that changes one row costs 1.0 to 3.3 ms (ran, 2.4) | adiar.mjs, custo.mjs, chave.mjs (ran); the reviewers' clique.mjs, foco.mjs, exp1-2.cjs; js/eventos/cursos.js:84-124 (`refazerAba`, the repo's own fix) and test/e2e/cursos.spec.js:1078; js/views/cadastros.js:144-145, :294-297 (rows updated in place today); js/dom.js:192-197 (only a Tab is remembered) | Full replacement with `trocarConteudo` (this note's first version: the click is lost); an updater per screen and per field, as `atualizarLinhaDoAluno` (the bug class of today's code); a pointer rule inside `trocarConteudo` (it would change every screen) |
| 4 | **A list of buttons with one Tab stop.** `ul.lista[role=list]`; each row is an `li` whose children are siblings: `button.lista-botao` (selects) and the row's controls (D6). Roving tabindex: one stop has `tabindex="0"` (the row last focused, else the selected, else the first); the controls of that row are in the Tab order, those of every other row and every group arrow have `tabindex="-1"`. The selected row's button has `aria-current="true"` | No interactive element is nested; `aria-selected` is valid only in listbox, grid and tab roles; the checkers already measure a `button` and a checkbox by its label; Tab must not walk 300 switches | test/e2e/celular.spec.js:13-27; test/e2e/acessibilidade.spec.js:11-33; no listbox and no `aria-selected` in `js/` (grep); the only arrow-key code is the menus' (js/dom.js:139-150) | `role=listbox` (an option cannot hold a switch); `role=grid` (two-dimensional keys and reading modes nobody here can test); a Tab stop per control (this note's first version) |
| 5 | **Selection follows the arrow keys.** ↓ ↑ Home End move the focus and select; Enter or → goes to the detail (D16 on one view); a click selects and leaves the focus on the row. With text in the search, ↓ and Enter skip the fixed items and the group headers | The mail reference; drawing a detail is synchronous; the personal-data read waits 250 ms on the same row; a matrícula typed and Enter must not open "Ordem no hangar" | (ran) filtering and building 300 rows: 0.19 ms; desenho-cadastros 2.5 (the fixed items "Ordem no hangar", "Limites da Lei do Aeronauta") | Selecting only with Enter (two keys per record when walking the list) |
| 6 | **A row carries up to two controls, as siblings of its select button.** `chave`, the all-dates switch: `button[role=switch][aria-checked]` with its word visible ("Ativo") and the screen's `data-act`; turned off in two steps by `confirmado` (its armed text in `data-confirma`), and while armed it takes a full-width line under the row; turned on in one click. `rapida`, a per-date toggle on the third line: today's `label.alvo > input.sw` with its word visible ("Vem", "Disponível") and the screen's `data-f` or `data-a`, one click. `acao`, one text button in the place of `chave` (D's "Aprovar"); it does not select. The `ativo` handler is F2's: `js/eventos/inativos.js`, generic for students, instructors and resources (`data-de`), with the History entry and the revert `setInativo` | The cadastros design needs the switch armed (its D8) and the per-date switch on the row (its D11), and A, B and C may not edit the component; `confirmado` arms a button by rewriting its text, so the switch's look is CSS and its text is its label; a full-width armed line gives the confirmation room at 320 px; the handler has one owner, the step that draws the first switch | desenho-cadastros D8, D11, 2.2, 2.5; js/eventos/confirmacao.js:23-40; js/views/cadastros.js:86 and js/views/recursos.js:65 (today's one-click switches); pedido.md:69, :88; reviews of desenho-cadastros (two notes named three owners) | One checkbox slot (this note's first version: the per-date switch would cost two clicks every day); confirming in the detail's notice (on one view the detail is not on screen); a component callback (it would need its own locks) |
| 7 | **List state lives in the controller, in memory, per list**: `busca`, `comInativos`, `recolhidos`, `mantidos`, `vistos`, `selecionado`, `parada`, `pedida`, `naoConfirmados`, `perdidos`; the marks stay inside each filter. Every draw applies all of them. The search compares `chaveDeBusca` (or the screen's key) of the text with each text of `item.busca`; filtering is immediate, only the "N de M" text waits 500 ms. A model read from the network may say `estado: 'lendo'` or `'falhou'`, with its text and "Tentar de novo" | Today's rules, kept; at this size a debounce adds a race with "type, then ↓"; Pedidos and Processamento read their rows | js/views/cadastros.js:334-343, :367-371, :440-451; js/views/filtros-dos-recursos.js:16-20; js/views/agenda.js:65-71 (`#ag-erro`) | A debounce on the filter; "Nenhum pedido…" while the read runs or after it failed |
| 8 | **A row stays until a filter changes; a filter never unselects.** A row drawn in the last draw stays while the filters are the same (a course changed, a switch turned off); a filter change applies to every row; the selected item keeps its detail open when its row is filtered out | A row must not vanish under the pointer or the keyboard focus; a search must not throw away the record she is editing | today's `mantidos` (js/views/cadastros.js:331-335, :374-376; js/views/filtros-dos-recursos.js:6-7, :14); mapa-alunos 5.8 | Keeping only the selected row (the switch of another row would make that row vanish) |
| 9 | **"Mostrar inativos"**: one toggle button (`aria-pressed`), hidden while the list has no inactive item. M of "N de M" counts the items in the toggle's scope. When the filters hide every active item and inactive ones would pass, the empty state says how many and offers the toggle | One click to find a student who came back; the count stays honest; the request asks for a toolbar filter | pedido.md:69; lacuna-1-onde-invas-e-recursos-sao-listados, implication 3 | A `.seg` "Ativos / Todos" (one more target at 320 px, no hint of how many are hidden); inside the multi-value filter (Recursos loses that filter, desenho-cadastros D21) |
| 10 | **Focus keeping is reused.** `trocarPorChave` shares `focoEm` and `devolverFoco` with `trocarConteudo`: a kept part keeps its focused element; a replaced one gives the focus to its equivalent, a Tab in progress included. Every focusable the component draws has an `id`; rows and the detail carry the screen's `data-k` and `data-id`. No list of js/dom.js changes. The detail of another record is drawn with `trocarConteudo` | `id`, `data-f`, `data-a`, `data-act`, `data-id` are in `QUEM_E`; `data-k`, `data-id` in `DA_LINHA`; `[data-k]` and `li[data-id]` in `LINHA` | js/dom.js:171-181, :213-271, :284-288 | New attributes in `QUEM_E` (not needed; those lists serve every screen) |
| 11 | **Roster fields are edited in place: a control drawn as a "Label: value" line, saved on `change`.** The value is an `input` or `select` with a thin underline (solid accent when focused); for who cannot edit the builder writes text. A field keeps its `data-f` or `data-a` inside `[data-k][data-id]`, so today's handlers and `gravarAlteracao` serve it unchanged. An invalid value stays in its field with `aria-invalid` and the message, kept by the detail controller (`erros`: `{ digitado, texto }` per field of the selected record) until the field is saved, Esc, or another record is selected; nothing is saved | One rule for the operator ("change it and leave the field"); an error that lives only in the DOM is erased by the next draw | js/eventos/registro.js:37-52; js/dom.js:192-203; js/eventos/cadastros.js:198 (today: a toast and the field put back) | Click-to-edit per field (a mode per field, one more key per field); a form per record with "Salvar" (not in place); a toast (2.8 s, far from the field, js/dom.js:18) |
| 12 | **Personal data are one section with "Salvar" and "Desfazer"** (desenho-cadastros D17). The five fields are drawn from the cache at once and enabled when the person has been read (250 ms after the selection settles, as the drawer reads on opening). What she types is a draft of that person, kept in memory when she selects another record and marked on her row. "Salvar" (or Enter) validates the five fields and sends them with the version the draft was typed on, after waiting for the save that created the person; nothing is sent when that save was refused. "Desfazer" drops the draft. A refusal stays with the person (row dot, a line in the list pane with "Abrir", the message at the field when she is opened again). Leaving the page with a draft, a save in flight or a refusal asks first | The RPC replaces the five fields from one version; a `type=date` field fires `change` at every digit of the year (the reviewers ran four changes for one date); one History entry per save, as today, on the open date's History, which lists the 200 newest; nothing undoes a personal-data change, so "Desfazer" is the only way back; one default in both notes | supabase/migrations/20261114151953_dados_pessoais_versionados.sql:86-108, :110-116; js/backends/supabase.js:170-172; js/views/dados-pessoais.js:50-79, :127-153; js/main.js:58-62; desenho-cadastros D17 | Saving field by field on `change` (this note's first version): five History entries per new student, a date saved at every digit, no undo, refusals arriving after she moved on, and two save models in one pane once A followed D17 |
| 13 | **The locks need no new mechanism inside a pane; the personal-data rules are written out.** Read-only: the builder writes text, `.edit-only` hides actions and switches, the panes are inside `main` (js/somente-leitura.js disables the rest). Before the date opens: registro refuses and the registry's `consulta` moment redraws (the refused control no longer shows what was drawn, so its part is replaced). Personal data: `podeVerDadosPessoais()` decides the section, the CANAC on the row and in the search, asked at every draw; `podeEditarDadosPessoais()` (new: `ApiClient.perfil ? editaDadosPessoais(ApiClient.perfil) : !isGestor()`) decides controls or text, by profile in shared mode, after a lock too (own versioned RPC, as the drawer today); `editaDadosPessoais` (js/perfis.js) stays true for the Secretaria until A flips it. The section's inputs carry `dado-campo`, exempt from the read-only disabling as `agenda-campo` is | The four lock layers act on any control inside `main`; the Secretaria is `isGestor()` too, so a lock cannot be the personal-data rule; in local mode the cache stays filled after a switch to Gestor | mapa-casca 5.8; js/somente-leitura.js:5-9; css/app.css:235-245; js/views/dados-pessoais.js:15; js/sessao.js:171; mapa-alunos 5.2, 5.7; review of desenho-entrega (F2 splits the predicate, A flips it) | Panes outside `main` (the fields would stay enabled for the Gestor); one rule for seeing and editing (today's `veDadosPessoais`) |
| 14 | **A PT409 on the cadastro re-reads the date instead of locking the screen.** For the document `cadastro`, without the hint `formato`, and only when the date's data had been read (`dadosLidos`), `aoConflito` answers `'releitura'`: the backend does not block; the app takes the list of the changes that were waiting (History entries still "gravando…" whose save was not confirmed), reads the open date again in a new task, and shows a fixed notice that names them, with "OK" and no "Recarregar". Every other conflict (a day, the format, during the opening) keeps today's lock. It is the first commit of F2, with its own tests | A stale tab's first cadastro write locks today, on any screen; a toast is too short and too far, and screens without a detail write the cadastro too (a weight typed in "Agendar voo", whose flight goes with it; "Configurar painel"; a History revert); the format upgrade at the opening writes the cadastro while no date is read | js/backends/supabase.js:63-68; js/actions.js:138-145, :212-239, :288-317; js/storage.js:229-242, :396; js/eventos/agendamento.js:31-39; js/views/config-do-painel.js:70-76; js/eventos/cursos.js:133-176 (the courses never lock); test/e2e/compartilhado.spec.js:16-46 (the lock tests are a day and a format conflict, unchanged) | Keeping the lock and restoring the place after "Recarregar" (a reload per conflict, and what was lost is never listed); replaying the changes automatically (the 49 `gravarAlteracao` call sites would become commands, mapa-dados 5.5) |
| 15 | **A record created in this tab stays out of the address until its save is confirmed, and is dropped if that save is refused.** "+ Novo" hands the component the save's promise (`ultimaGravacao()`); until it answers true the address says `#/alu/novo`; if it answers false the list drops the id from the selection, `parada`, `mantidos` and `pedida`, discards its drafts, the detail says "A inclusão do aluno novo não foi confirmada pelo servidor." and the personal-data save that waited sends nothing | Ids come from `S.nid++`, kept in the cadastro: a stale tab's new student gets the id a colleague's new student already has, so after a re-read the selection would show the colleague's record, and a reload of `#/alu/<id>` would open it | js/eventos/cadastros.js:75, :85; js/dias.js:39; 20261114151953:44-51 (the RPC only checks that the id exists); the reviewers' colisao.mjs (both ids 1002) | Keeping the selection "while the id is in the model" (this note's first version) |
| 16 | **The address, the frame and the phone's second view are the shell's.** The component never touches `history` or `location`: it calls the screen's `aoSelecionar(item, { abrir, empilhar })`, wired to `mostrarTela(tela, { item, historico, focar })`; the shell's listener calls the screen back (`selecionar(item, { origem: 'endereco' })`, which does not call `aoSelecionar`). Markup: `section.tela[data-forma="lista-detalhe"]` with the two `[data-regiao]` children; below 800 px of viewport one view by `data-vendo`, and Back returns to the list; inside the panes, container queries. F2 builds the pane rules and the item part of `mostrarTela`, as the shell note's section 5 says | One owner per mechanism; the shell chose the hash `#/alu/1012`, `mostrarTela` and `data-vendo`, and that below 800 px the body scrolls, a property of the viewport that the one-view switch must follow | desenho-casca D9, D13, D14, D27, 2.7, 2.14; posicao B4 | `?sel=` in `js/endereco.js` with its own `popstate`, and a container query at 720 px on `.md[data-vista-md]` (this note's first version): two addresses and two switches for one screen |
| 17 | **The F0 split is the delivery note's table, with five additions** (2.11); F2 moves the list machinery of Alunos into the component | A and C never edit the same file; one table in one note | desenho-entrega 2.2 d; lacuna-1-importadores §3.5-3.7, §7; js/views/dados-pessoais.js:11, :15, :18-21 (private names the drawer's code uses at :56, :59, :73-75, :147-150) | This note's own file names (`linhas-filtradas.js`, `gaveta-de-dados.js`, `limites.js`): two tables for one move |
| 18 | **F2 ships with its first screen: Alunos, with today's fields, the row switch and "Mostrar inativos".** What Alunos does not use yet (groups, a selectable header, fixed items, `rapida`, `acao`, `estado`) is exercised by a bench list the e2e mounts in the page with `const { criarMestreDetalhe } = await import('./js/views/mestre-detalhe.js')`. Other code opens a record with `mostrarTela(tela, { item })`; the component exports no `telaDaLista` | The lint refuses a module only tests import, and a whole-module `import()` hides a module from it; B and C must not discover a missing slot | scripts/exportacoes-sem-uso.mjs:89-96, :128-145; mapa-testes-e-docs 5.4 item 12; desenho-entrega decisions 1, 3, 4; test/e2e/cadastros.spec.js:976 | F2 and A in one PR (B and C would wait for A's migration); the request's order with the switch left to A (question 8) |
| 19 | **The detail**: a header (the back link on one view, avatar, title, subtitle, icon actions), a notice, sections, a foot for text actions. A section is `h4 > button.det-secao-btn[aria-expanded][aria-controls]` and a body with `hidden`; the collapsed ids are kept per list for the session; a section may carry a scope tag ("nesta data · sex 20/11", "todas as datas"). Its reading width is capped at 760 px | The state survives redraws without reading the DOM, as the fleet groups and the course phases do; a "Label: value" line across a 1,088 px pane puts the value far from its label | js/views/recursos.js:26-35; js/views/cursos.js:184-190, :443, :467-474; desenho-casca 2.7 ("the detail's reading width is F2's to cap") | `<details>` (its `open` must be read back from the DOM, as js/views/cursos.js:443 does) |
| 20 | **The icon actions at the right of the title are "Anterior" and "Próximo"** (the previous and next record drawn; `i-cima`, `i-baixo`). Ctrl+, and Ctrl+. do the same from anywhere in the detail and, from a field, commit it and land on the same field of the next record. Actions that destroy ("Excluir aluno…") are text buttons in the foot, armed by `confirmado`, unchanged | They destroy nothing, and they give back the walk down a column that the table offered ("a weight for one student after another": 1 key instead of about 8 Tabs); deleting stays, de-emphasised; an icon would be erased by `confirmado`, which writes `textContent` | posicao B5; desenho-cadastros D9; js/eventos/confirmacao.js:16, :28, :36; the mail client's Ctrl+. and Ctrl+, | "Excluir" as an icon beside the title (this note's first version: the first Tab stop after the title would be the one action with no revert); a "⋯" menu |
| 21 | **Colours: the shell's tokens.** Selected row: `--sel` and a 3 px bar in `--ac`; avatars: `--av1` to `--av5` by id, initials in `--avT`; an inactive row: the title in `--mu` and the tag "inativo", not opacity | One answer in both notes; every pair at 4.5:1 or more in both themes | desenho-casca D25, 2.11 (`--mu` on `--sel` 4.86 and 5.14; `--avT` on the five hues 5.97 to 8.82) | `--info-bg` and one neutral avatar (this note's first version: an `rgba` token the contrast helper cannot read without flattening, and two answers to one question) |
| 22 | **The checkers find the panes by `data-regiao` inside `main section.on`;** each pane is also checked for sideways overflow (`scrollWidth <= clientWidth`); the walk gains the states of Alunos (`ESTADOS` of `test/e2e/telas/alunos.js`) | A pane that scrolls on its own passes the document check without being measured; a hidden view is skipped by `checkVisibility` | mapa-testes-e-docs 5.4 items 1-4; mapa-casca 5.5; desenho-entrega 2.2 g | Leaving the checkers as they are (the detail on a phone would never be measured) |
| 23 | **Esc in the detail**: in a field with typed text, the stored value comes back (and its error goes); elsewhere in the detail it returns to the row (on one view, to the list). The rule acts only when `gavetaDoEsc(e) === null && !algumDialogoAberto()`; the panels that take Esc in the capture phase have stopped it before | Leaving a field with Esc would otherwise save the typed text (the blur fires `change`); the drawers listen in the bubble phase and do not stop the event, and `gavetaDoEsc` memoises the drawer chosen for the key press, so the rule holds in either evaluation order | js/eventos/historico.js:32-34; js/eventos/cadastros.js:33-35, :52-54; js/eventos/escala.js:297-299; js/dom.js:52-59, :67-78; mapa-casca 1.5, 5.7 | Asking "is a drawer open?" after the drawer's own listener ran (one Esc would close the Histórico and also move the focus) |

## 2. How it works

### 2.1 Modules

| File | Kind | Exports |
|---|---|---|
| `js/lista.js` | pure | `listaAVista(modelo, estado, opcoes)`, `textoDaContagem(vista, nomes)`, `partesDaLista(lista, vista, estado, opcoes)` → `[{ chave, html }]`, `linhaHtml(lista, item, marcas)`, `grupoHtml(lista, grupo, marcas)`, `vazioHtml(lista, motivo, textos)`, `teclaNaLista(vista, estado, tecla, em)`, `conciliar(estado, vista)`, `vizinhoNaLista(vista, id, passo)`, `corDoAvatar(id)` |
| `js/detalhe.js` | pure | `campoHtml(lista, campo, opcoes)`, `secaoHtml(lista, secao, opcoes)`, `acoesHtml(lista, acoes, opcoes)`, `partesDoDetalhe(lista, modelo, opcoes)` → `[{ chave, html }]`, `detalheHtml(lista, modelo, opcoes)`, `vazioDoDetalheHtml(texto)` |
| `js/views/lista.js` | controller | `criarLista(opcoes)` |
| `js/views/detalhe.js` | controller | `criarDetalhe(opcoes)` |
| `js/views/mestre-detalhe.js` | wiring | `criarMestreDetalhe(opcoes)` |
| `js/views/editor-de-dados-pessoais.js` | the personal-data section | `secaoDosDadosPessoais(lista, tipo, id)`, `pessoaEscolhida(tipo, id, aoMudar)`, `marcaDaPessoa(tipo, id)`, `dadosPessoaisPendentes()` |
| `js/eventos/editor-de-dados-pessoais.js` | listeners | `input`, `submit` and "Desfazer" inside `[data-pessoa]`; imported by js/eventos/alunos.js (and by js/eventos/instrutores.js in C) |
| `js/eventos/inativos.js` | listeners | `aoAcionar('ativo', …)`, `aoReverter('setInativo', …)`; imported by the screens' event modules |
| `js/dom.js` | plus | `trocarPorChave(lugar, partes)`, `ponteiroApertado()`; `mostrarAviso(tipo, texto, { recarregar, fechar })` |
| `js/views/dados-pessoais.js` | plus | `podeEditarDadosPessoais()`, `lerDadosDaPessoa(tipo, id)`, `gravarDadosDaPessoa(tipo, id, dados, versao)` (the read, the save and the refusal texts, shared by the section and the drawer) |
| `js/perfis.js` | plus | `editaDadosPessoais(perfil)` |
| `js/format.js` | plus | `iniciais(nome)`, moved from js/sessao.js:108-111 |
| `js/views/etapas.js` | plus | `progressoEmTexto(stu)` → `{ contagem: '13/46', resto: 'Fase 5 · próxima NAV-01' }`; `progressoDoAluno` is built on it |
| `js/actions.js` | plus | `ultimaGravacao()` (the latest `gravacaoAtual`), `aposConflito(documento, motivo)` |
| `js/reversoes.js` | plus | the revert kind `setInativo` |
| `js/views/telas.js` (the shell's) | plus | the item of `mostrarTela`, `data-forma`, `data-vendo`, `umaVista()`, the Back of `a.voltar` |
| `css/lista.css` | styles | 2.12 |

```js
// js/eventos/alunos.js: avaliado uma vez, sem ler nenhum elemento da página
const tela = criarMestreDetalhe({
  id: 'alu',            // ul#alu[data-lista="alu"], #det-alu, section#s-alu, [data-flt="alu"], #alu-contagem, #alu-inativos, #alu-aviso
  rotulo: 'Alunos',     // o aria-label da lista e o texto de "‹ Alunos"
  nomes: ['aluno', 'alunos'],          // "12 de 40 alunos", "Nenhum aluno com esses filtros."
  semItens: 'Nenhum aluno cadastrado. Clique em “+ Novo aluno” acima para cadastrar.',
  vazio: 'Escolha um aluno na lista.',
  chaveDaBusca: chaveDeBusca,          // em Recursos, a chave da matrícula (js/views/filtros-dos-recursos.js:16-20)
  filtros: [{ criar: aoMudar => criarFiltroDosCursos('flt-alu-cur', aoMudar), valores: item => item.valores.curso }],
  modelo: modeloDosAlunos,             // () => ({ fixos, grupos, itens, estado })
  detalhe: detalheDoAluno,             // id => o modelo do detalhe, ou null (saiu do cadastro)
  edita: () => !isGestor(),
  aoSelecionar: (item, { abrir, empilhar }) =>
    mostrarTela('alu', { item, historico: empilhar ? 'empilhar' : 'substituir', focar: abrir })
});
registrarDesenho('alunos', tela.desenhar, { quando: ['dados', 'consulta', 'releitura', 'perfil'], ordem: 30 });
// tela: { desenhar(momento), selecionar(id, { abrir, origem }), selecionado(), novo(id, gravacao),
//         voltarParaALista(), avisar(texto, { lugar, abrir }), erroNoCampo(campo, texto) }
```

The screen also tells the shell how to come back to it: `aoMostrar(item)` → `item ? tela.selecionar(item, { abrir: true, origem: 'endereco' }) : tela.voltarParaALista()`.

### 2.2 Data shapes

```js
// item: uma linha
{ id: 1000,                       // número ou texto, único na lista ('PR-VOB', 'cat:C152', 'fixo:hangar')
  titulo: 'Aluno 1000',           // 1ª linha
  linha2: 'CANAC 123456 · PP',    // 2ª linha, na cor de destaque; '' não desenha
  meta: '13/46',                  // pequeno, à direita da 2ª linha
  linha3: 'Fase 5 · próxima NAV-01',
  ponto: 'aviso',                 // '', 'ok', 'aviso', 'erro', 'info'
  pontoRotulo: 'sem peso',        // dito ao leitor de tela e no title do ponto
  iniciais: null, icone: null,    // o avatar: as iniciais do título, ou um símbolo do sprite ('i-aviao')
  inativo: false,                 // esmaece; some com "Mostrar inativos" desligado
  chave: { marcado: true, texto: 'Ativo', rotulo: 'Aluno 1000 ativo em todas as datas',
           confirma: 'Confirmar: inativo em todas as datas', atributos: 'data-act="ativo" data-de="aluno"' },   // ou null
  rapida: null,                   // ou { marcado, texto: 'Vem', rotulo: 'Instrutor 01 vem em 20/11', atributos: 'data-f="on"' }
  acao: null,                     // ou { texto: 'Aprovar', rotulo: 'Aprovar o pedido de Aluno 1000', atributos: 'data-act="…"' }, no lugar de chave
  grupo: null,                    // o id do grupo dele
  atributos: 'data-k="s" data-id="1000"',    // no li: registro.js acha o id, dom.js acha a linha
  busca: ['Aluno 1000', '123456'],           // os textos comparados pela chave da busca (o CANAC só para quem vê dados pessoais)
  valores: { curso: ['PP'] } }               // o que cada filtro de vários valores compara
// grupo: sem idDoDetalhe, só recolhe
{ id: 'C152', titulo: 'C152', resumo: '12 de 13 disponíveis', idDoDetalhe: 'cat:C152' }
// modelo da lista
{ fixos: [item], grupos: [grupo], itens: [item], estado: 'pronto',      // 'pronto', 'lendo' ou 'falhou'
  textoDoEstado: '', tentar: null }                                     // o texto e o "Tentar de novo" de 'lendo' e 'falhou'
// estado da lista (na memória, por lista)
{ busca: '', comInativos: false, recolhidos: new Set(), mantidos: new Set(), vistos: new Set(),
  selecionado: null, parada: null, pedida: null, naoConfirmados: new Map(), perdidos: new Set() }
// modelo do detalhe
{ atributos: 'data-k="s" data-id="1000"', titulo: 'Aluno 1000', subtitulo: 'CANAC 123456 · PP · Piloto Privado',
  avatar: { iniciais: 'A1', cor: 'av1' }, aviso: '',
  acoes: [],                      // os ícones da tela; "Anterior" e "Próximo" o componente põe sempre
  secoes: [{ id: 'cadastro', titulo: 'Cadastro', icone: 'i-conta', escopo: 'todas as datas', resumo: '', recolhida: false,
             campos: [campo], html: '' }],
  rodape: [{ id: 'excluir', texto: 'Excluir aluno…', rotulo: 'Excluir Aluno 1000', atributos: 'data-act="dels"',
             confirma: 'Confirmar exclusão', soEdicao: true }] }
// campo: uma linha "Rótulo: valor"
{ id: 'kg', rotulo: 'Peso (kg)', tipo: 'numero', valor: 82, texto: '82 kg',   // texto: para quem só consulta
  atributos: 'data-f="kg" min="1" max="300" step="0.1" placeholder="sem peso"', dica: null, falta: false,
  opcoes: [], itens: [], acrescentar: null }
// tipo: 'texto', 'numero', 'data', 'tel', 'email', 'selecao' (opcoes), 'etiquetas' (itens com ✕, e acrescentar),
//       'leitura' (só texto), 'html' (o que a tela desenha: o formulário dos dados pessoais, a grade das faixas)
// estado do detalhe (na memória, do registro escolhido)
{ id: 1000, erros: new Map() }  // idDoCampo → { digitado: '400', texto: 'O peso vai de 1 a 300 kg.' }
// o editor dos dados pessoais (na memória, por pessoa: 'aluno:1000')
{ versao: '2026-11-21T14:02:11Z', lida: true, lendo: false, rascunho: null, versaoDoRascunho: null, enviando: false,
  recusa: null }                  // recusa: { campo: 'canac' | null, texto }
```

Ids the builders write (all found again by the focus keeping, because `id` is in `QUEM_E`):

| Element | id |
|---|---|
| row button | `lin-<lista>-<id>` (a selectable group: `lin-<lista>-<idDoDetalhe>`) |
| the row's switch, toggle or action | none: found by `data-act`, `data-f` or `data-a` inside `li[data-k][data-id]` |
| group arrow | `grp-<lista>-<grupo>` |
| "Limpar filtros", "Tentar de novo" of the list | `limpar-filtros-<lista>` (today's id for Alunos), `tentar-<lista>` |
| the list's notice and its "Abrir" | `<lista>-aviso`, `<lista>-aviso-abrir` |
| detail title, back link, notice | `det-<lista>-titulo`, `det-<lista>-voltar`, `det-<lista>-aviso` |
| "Anterior", "Próximo" | `det-<lista>-anterior`, `det-<lista>-proximo` |
| field control, its error | `det-<lista>-<campo>`, `det-<lista>-<campo>-erro` |
| section button, its body | `sec-<lista>-<secao>`, `sec-<lista>-<secao>-corpo` |
| foot action | `det-<lista>-<acao>` (`det-alu-excluir`) |
| personal data: notice, "Salvar", "Desfazer", "Tentar de novo" | `det-<lista>-dados-aviso`, `det-<lista>-dados-salvar`, `det-<lista>-dados-desfazer`, `det-<lista>-dados-tentar` |

New global attribute names, none of them taken today (mapa-casca 5.8 item 8; grep): `data-lista`, `data-chave`, `data-lista-grupo`,
`data-lista-limpar`, `data-lista-tentar`, `data-lista-abrir`, `data-lista-anterior`, `data-lista-proximo`, `data-confirma`, `data-de`,
`data-pessoa`, `data-dado`, `data-desfazer-dados`. `data-regiao`, `data-forma` and `data-vendo` are the shell's.

### 2.3 Screen structure

```html
<section id="s-alu" class="tela" data-forma="lista-detalhe" data-vendo="lista">
  <div class="md-lista" data-regiao="lista">
    <h2>Alunos</h2>
    <div class="bar lista-barra">   <!-- estático: nunca é redesenhado -->
      <span class="lista-busca"><svg class="ico" aria-hidden="true"><use href="#i-busca"/></svg>
        <input type="search" class="flt-ctrl" data-flt="alu" placeholder="Buscar aluno…" aria-label="Buscar aluno"></span>
      <button type="button" class="btn sec filtro-botao flt-ctrl" id="flt-alu-cur" aria-expanded="false" aria-controls="flt-alu-cur-painel">
        <svg class="ico" aria-hidden="true"><use href="#i-filtro"/></svg><span class="filtro-resumo">Todos os cursos</span></button>
      <div class="filtro-painel" id="flt-alu-cur-painel" role="group" aria-label="Filtrar por curso" hidden></div>
      <button type="button" class="btn quiet lista-inativos" id="alu-inativos" aria-pressed="false" hidden>Mostrar inativos</button>
      <button type="button" class="btn edit-only" data-act="adds">+ Novo aluno</button>
      <span class="contagem" id="alu-contagem" role="status"></span>
    </div>
    <p class="lista-aviso" id="alu-aviso" role="status" hidden></p>
    <p class="h ir-para-demanda">Os pedidos de cada data ficam na Demanda. <a class="btn quiet" href="#/dem">Abrir a Demanda</a></p>
    <ul class="lista" id="alu" role="list" aria-label="Alunos" data-lista="alu"></ul>
  </div>
  <div class="md-detalhe" id="det-alu" data-regiao="detalhe" role="region" aria-label="Aluno escolhido" tabindex="-1"></div>
</section>
```

```html
<li class="lista-linha inativo" data-chave="i:1000" data-k="s" data-id="1000">
  <button type="button" class="lista-botao" id="lin-alu-1000" aria-current="true" tabindex="0">
    <span class="lista-ponto aviso" title="sem peso" aria-hidden="true"></span>
    <span class="lista-avatar av1" aria-hidden="true">A1</span>
    <span class="lista-texto">
      <b class="lista-titulo">Aluno 1000</b>
      <span class="lista-l2"><span>CANAC 123456 · PP</span> <span class="tag">inativo</span><small class="lista-meta">13/46</small></span>
      <small class="lista-l3">Fase 5 · próxima NAV-01</small>
      <span class="sr">sem peso</span>
    </span>
  </button>
  <button type="button" class="lista-chave edit-only" role="switch" aria-checked="false" data-act="ativo" data-de="aluno"
    data-confirma="Confirmar: inativo em todas as datas" aria-label="Aluno 1000 ativo em todas as datas" tabindex="0">Ativo</button>
  <!-- com rapida (INVAs, Recursos): <label class="alvo lista-rapida edit-only"><input type="checkbox" class="sw" data-f="on"
       aria-label="Instrutor 01 vem em 20/11" tabindex="-1"> Vem</label> -->
</li>
<li class="lista-grupo" data-chave="g:C152">   <!-- com detalhe próprio: a seta recolhe, o título seleciona -->
  <button type="button" class="lista-seta" id="grp-rec-C152" data-lista-grupo="C152" aria-expanded="true" aria-label="Recolher C152" tabindex="-1">…</button>
  <button type="button" class="lista-botao" id="lin-rec-cat:C152" tabindex="-1">C152 <small>12 de 13 disponíveis</small></button>
</li>
<li class="lista-vazia" data-chave="vazio">Nenhum aluno com esses filtros. <button type="button" class="btn quiet" id="limpar-filtros-alu" data-lista-limpar="alu">Limpar filtros</button></li>
```

```html
<div class="det" data-k="s" data-id="1000">
  <div class="det-cab" data-chave="cab">
    <a class="btn quiet voltar md-voltar" id="det-alu-voltar" href="#/alu">‹ Alunos</a>   <!-- só com uma vista -->
    <span class="lista-avatar grande av1" aria-hidden="true">A1</span>
    <div class="det-nome"><h3 class="det-titulo" id="det-alu-titulo" tabindex="-1">Aluno 1000</h3><p class="det-sub">CANAC 123456 · PP · Piloto Privado</p></div>
    <div class="det-acoes" role="group" aria-label="Ações">
      <button type="button" class="det-acao" id="det-alu-anterior" data-lista-anterior="alu" aria-label="Aluno anterior" title="Anterior (Ctrl+,)" aria-keyshortcuts="Control+Comma"><svg class="ico" aria-hidden="true"><use href="#i-cima"/></svg></button>
      <button type="button" class="det-acao" id="det-alu-proximo" data-lista-proximo="alu" aria-label="Próximo aluno" title="Próximo (Ctrl+.)" aria-keyshortcuts="Control+Period"><svg class="ico" aria-hidden="true"><use href="#i-baixo"/></svg></button>
    </div>
  </div>
  <p class="det-aviso" id="det-alu-aviso" role="alert" data-chave="aviso"></p>
  <div class="det-secao-bloco" data-chave="s:cadastro">
    <h4 class="det-secao"><button type="button" class="det-secao-btn" id="sec-alu-cadastro" aria-expanded="true" aria-controls="sec-alu-cadastro-corpo">
      <svg class="ico" aria-hidden="true"><use href="#i-conta"/></svg>Cadastro <small class="det-escopo">todas as datas</small><svg class="ico seta" aria-hidden="true"><use href="#i-baixo"/></svg></button></h4>
    <div class="det-secao-corpo" id="sec-alu-cadastro-corpo" role="group" aria-labelledby="sec-alu-cadastro">
      <div class="det-campo"><label class="det-rotulo" for="det-alu-kg">Peso (kg)</label>
        <div class="det-valor"><input id="det-alu-kg" type="number" data-f="kg" min="1" max="300" step="0.1" value="82" placeholder="sem peso" aria-describedby="det-alu-kg-erro">
          <small class="erro-campo" id="det-alu-kg-erro"></small></div></div>
    </div>
  </div>
  <div class="det-rodape" data-chave="rodape"><button type="button" class="btn quiet edit-only" id="det-alu-excluir" data-act="dels" aria-label="Excluir Aluno 1000">Excluir aluno…</button></div>
</div>
```

- No `<section>`, `<nav>` or `<header>` inside a pane: `section { display: none }`, `mostrarTela` and the print rule act on the
  tags (mapa-casca 5.8 item 9; desenho-casca D10 scopes them to `main#conteudo > section`).
- A group without a detail of its own has one button (the arrow and the title together, `data-lista-grupo`).
- Fixed items (`fixos`) come first, are never filtered and never counted.
- With nothing selected the detail is `<p class="det-vazio h">Escolha um aluno na lista.</p>`. Nothing is selected by itself.
- The personal-data section (`html`, drawn by the editor) is `div[data-pessoa="aluno:1000"] > form.dados-form[novalidate]` with
  the five `input.dado-campo[data-dado]` (`#det-alu-cpf` … `#det-alu-email`), the notice, "Salvar" (`type=submit`), "Desfazer"
  (`data-desfazer-dados`, drawn only with a draft) and the foot line "Atualizado em … por …".

### 2.4 What one draw does

0. **Wait** while `ponteiroApertado()`: the draw is marked pending and runs right after the click (`setTimeout` after
   `mouseup`, capture phase), at the next `keydown` (capture), or at the window's `blur`.
1. **Filters**: each `criar` runs once, at the first draw that finds `#<id>`; then each filter's `desenhar()` (the options follow
   the programs and the fleet; a mark whose option vanished leaves, as today).
2. **Model**: `modelo()`, then `listaAVista`. An item is drawn when it is in the scope of "Mostrar inativos" and passes the
   search and every filter, or when it is in `mantidos`, or was in `vistos` and no filter changed since. Order: `fixos`, each
   group with its items, the items without a group. A group with no item drawn is not drawn; while the search has text every
   group is drawn open (the collapsed set is kept for when it is empty).
3. **`conciliar`**: a selected, `parada` or `mantidos` id that left the model or is in `perdidos` is cleared; `pedida` (from
   the address) becomes the selection at the first draw whose model has it, and is dropped at her first selection.
4. **The list**: `trocarPorChave(ul, partesDaLista(…))`. Keys: `i:<id>`, `g:<grupo>`, `f:<id>`, `vazio`, `estado`. A part is
   kept when its HTML is the same and its controls show what was drawn (`checked` against `defaultChecked`, the selected
   option against `defaultSelected`); held while it holds an armed button (`[data-arm="1"]`; drawn 600 ms after it disarms);
   replaced otherwise. One stop has `tabindex="0"`: `parada` if drawn, else the selected row, else the first.
5. **The toolbar's texts**: "40 alunos", or "12 de 40 alunos" with a filter (`textoDaContagem`), written at once or 500 ms
   after the last key; `#alu-inativos` shown as "Mostrar inativos (2)" when the model has inactive items; the list's notice.
6. **The detail**: the same record → `trocarPorChave(div.det, partesDoDetalhe(…))`, with `erros` drawn and the part of the
   focused field held while the field's value differs from what the model would draw (her typed text, her caret); another
   record → `trocarConteudo(#det-alu, detalheHtml(…))`; nothing selected → the empty state.
7. **The moment `consulta`** (a change refused, js/eventos/registro.js:41-46): every part whose controls differ from what was
   drawn is replaced, the focused one too, and `erros` is cleared.

Cost (ran, Chromium 158, 390 px wide, rows of three lines and two controls, medians of 15 to 21 runs):

| Draw | CPU 1× | CPU 4× | CPU 6× |
|---|---|---|---|
| 300 rows replaced whole (`innerHTML`, as `trocarConteudo`) | 15 ms | 57 ms | 85 to 91 ms |
| by key: a save that changes one row of 300 | 1.0 ms | 2.4 ms | 3.3 ms |
| by key: a letter in the search (300 → 30 rows) | 2.9 ms | 9.4 ms | 14.2 ms |
| by key: the search cleared (30 → 300 rows) | 12.2 ms | 53.9 ms | 79.2 ms |

Empty states of the list:

| When | Text |
|---|---|
| the cadastro has no item | `semItens` |
| the filters hide every item | "Nenhum aluno com esses filtros." and "Limpar filtros" (the focus then goes to the search, as today) |
| the filters hide every active item and n inactive ones would pass | "Nenhum aluno ativo com esses filtros; 1 inativo passa." with "Mostrar inativos" and "Limpar filtros" |
| `estado: 'lendo'` | `textoDoEstado` ("Lendo os pedidos…") |
| `estado: 'falhou'` | `textoDoEstado` ("Não foi possível ler os pedidos.") and "Tentar de novo" (`tentar-<lista>`) |

### 2.5 Keys

| Where | Key | What happens |
|---|---|---|
| a row or a selectable group | ↓, ↑, Home, End | focus on the next, previous, first, last stop drawn; an item or a selectable group becomes the selection |
| | Enter, → | focus on the detail's title (on one view the detail opens) |
| | Space or a click | selects; the focus stays (on one view the detail opens) |
| | Tab | the controls of this row (only the stop row has them in the Tab order), then out of the list |
| a group | ←, → | ← collapses; → opens a collapsed group (on an open group with a detail of its own, goes to that detail) |
| the item `trocarPorChave` focused after its row vanished (`data-foco-neutro`) | the same keys | counted from that item's position |
| a row's `acao` | Enter, Space, a click | the screen's action; the row is not selected; the focus stays on the action, or on the row if the action left it |
| the search | ↓ | the first stop; with text, the first item (fixed items and group headers skipped) |
| | Enter | with text: selects the first item and goes to its detail's title; without text: nothing |
| anywhere in the detail | Ctrl+., Ctrl+, | the next or previous record drawn ("Próximo", "Anterior"); from a field: the field is committed first (`blur`, so its `change` saves), then the focus lands on the same field (`data-f`, `data-a` or `data-dado`) of the next record, or on its title |
| a text or number field with typed text | Esc | the stored value comes back and its error goes; the focus stays |
| anywhere else in the detail (not a `select`), with `gavetaDoEsc(e) === null` and no dialog | Esc | focus on the selected row (on one view, back to the list) |
| a roster field of the detail | Enter, Tab or leaving it | the browser fires `change`: the field is saved |
| a personal-data field | Enter | "Salvar" (the form's submit) |

The Esc listener is on `document` in the bubble phase; the tooltip, the menus, the in-page panels and the map pop-up take Esc in
the capture phase and stop it (js/dicas.js:167-172; js/dom.js:68-77, :132-137; js/eventos/escala.js:60-65).

### 2.6 What each event does to the selection

| Event | Selection | Focus | Address (through the shell) | On one view |
|---|---|---|---|---|
| click on a row | that item | stays on the row | `#/alu/<id>`, replaced | the detail opens (pushed), focus on its title |
| ↓ ↑ Home End | the row reached | the row | replaced 300 ms after the last key | the list stays |
| Enter, → | the same | the detail's title | unchanged | the detail opens (pushed) |
| "Anterior", "Próximo", Ctrl+, Ctrl+. | the previous or next item | the button, or the same field | replaced | stays on the detail |
| "+ Novo aluno" | the new item (`mantidos`, `naoConfirmados`) | the detail's first field, its text selected | `#/alu/novo`; `#/alu/<id>` when its save is confirmed | the detail opens (pushed) |
| the save that created it is refused (D15) | none | the detail's region, if the focus was in it | `#/alu` | back to the list |
| "Excluir aluno…" confirmed | none | the row that took its place, not selected | `#/alu` | back to the list |
| a filter changes | kept, even when its row leaves the list | unchanged | unchanged | unchanged |
| a redraw (a change saved, a result, a personal-data answer) | kept | kept (D3, D10) | unchanged | unchanged |
| the cadastro read again after a conflict (D14) | kept for a confirmed record | kept | unchanged | unchanged |
| the date changes | kept while the id is in the model (a per-date list, such as Pedidos, loses it because the ids change) | kept | `?data=` changes, the hash stays | stays on its view |
| the item left the cadastro (after a read) | cleared; the detail says "Este aluno saiu do cadastro." | the detail's region, if the focus was in it | `#/alu` | back to the list |
| reload | restored from the hash at the first draw whose model has the id (`novo` matches nothing) | none | unchanged | the detail, when the hash has an item |
| the browser's Back | kept | the row of the item | the previous entry | the list |
| Alunos opened from the navigation (`#/alu`) | kept (memory) | the shell's rule | two panes: `#/alu/<id>` replaced back in | the list |

### 2.7 Editing in place

| Kind | Examples | Control | Saves | What confirms it |
|---|---|---|---|---|
| a cadastro or day field | Nome, Peso (kg), Curso; later Vem, Disponível, Horas disponíveis | `input`, `select` or `input.sw` with the screen's `data-f` or `data-a` | on `change`: the screen's handler, `gravarAlteracao`, the registry's redraw | the History entry ("gravando…", then recorded) |
| a list of the record | Priorizar com, Não escalar com, habilitações | `tipo: 'etiquetas'`: `li.tg` with a ✕ (`data-act`) and a `select` that adds; or switches | the same | the same; after a ✕ the handler puts the focus on the `select` (the removed button has no successor) |
| personal data | CPF, CANAC, Nascimento, Celular, E-mail | `input.dado-campo[data-dado]` inside `[data-pessoa="aluno:1000"]` | "Salvar": the editor, then `gravarDadosDaPessoa` (`ApiClient.salvarDadosPessoais`) | the section's foot, `aria-live="polite"`: "Salvando…", then "Atualizado em 21/11/2026 14:02 por <quem>."; `anunciar`; the History entry the server wrote |

A roster handler shows an invalid value with `tela.erroNoCampo(campo, ERRO_DO_PESO)` and returns without saving (today it
toasts and puts the old value back, js/eventos/cadastros.js:198). The controller clears a field's entry of `erros` at that
field's next `change` (capture phase, before the handler) and at Esc.

Personal data, step by step (`js/views/editor-de-dados-pessoais.js`; the state per person of 2.2):

1. The section is built only when `podeVerDadosPessoais()`. Values: the draft, else the cache (`dadosDe(tipo, id)`). Controls
   when `podeEditarDadosPessoais()` and `lida`; disabled, with "Lendo os dados…", until the person is read; text otherwise.
2. `pessoaEscolhida(tipo, id, aoMudar)`: 250 ms after the selection settles on the person, `lerDadosDaPessoa`. A read that
   answers after another selection or after a save was sent is ignored. Success: `versao` is its `atualizado_em`, the cache
   follows (the row's CANAC too), `lida` is true, `aoMudar()` (the screen's `tela.desenhar()`; by key, only the section and the
   row change). Failure: "Não foi possível ler os dados pessoais." with "Tentar de novo"; the fields stay disabled (nothing is
   saved from data that was not read, today's rule, js/views/dados-pessoais.js:135).
3. `input` in a field: `rascunho` is the five fields as typed; the first keystroke records `versaoDoRascunho = versao`; the row
   gets the dot `aviso`, "dados pessoais não salvos".
4. "Salvar" (or Enter): `validarDadosPessoais(rascunho, hojeISO())` (js/dados-pessoais.js:39); errors at the fields
   (`aria-invalid`, `#det-alu-<campo>-erro`), the focus on the first. Valid: `DATA` is captured, then `await ultimaGravacao()`;
   false: nothing is sent, "O cadastro de <nome> não foi gravado: os dados pessoais não foram enviados."; true:
   `gravarDadosDaPessoa(tipo, id, dados, versaoDoRascunho)`.
5. Success: `versao` and the cache are the answer's, `rascunho` is null, the row's CANAC follows; `mostrarNoHistorico(resposta.historico)`
   when the date did not change (as js/eventos/cadastros.js:43); `anunciar('Dados pessoais de <nome> salvos.')`.
6. "Desfazer": `rascunho` is null; the focus goes to the section's first field.
7. Leaving the page: js/main.js:58-62 also asks `dadosPessoaisPendentes()` (a draft, a save in flight, or a refusal not seen).

| Server answer | On screen |
|---|---|
| a refusal with `campo` (22023, 23505) | the message at that field; the draft stays |
| `PT409` | the person is read again, the draft is dropped; the section's notice: "Outra pessoa alterou os dados de <nome> enquanto você editava: a tela mostra a versão atual. Refaça a alteração." |
| `P0002` | "Esta pessoa não está no cadastro gravado. Espere a alteração ser gravada e tente de novo." (today's text; after step 4's wait it means she left the cadastro) |
| `42501` | "A sua conta não pode alterar dados pessoais." (desenho-cadastros 2.6) |
| anything else | at the section, the draft kept: "Não foi possível salvar. Verifique a conexão e tente de novo." |
| any refusal when the person is no longer selected | `recusa` kept; the row's dot `erro`, "dados pessoais não salvos"; `#alu-aviso`: "Os dados pessoais de <nome> não foram salvos: <motivo>." with "Abrir"; the message at its field when she is opened again |

The instructors' drawer (until C) uses `lerDadosDaPessoa`, `gravarDadosDaPessoa` and `podeEditarDadosPessoais()`, opens only for
`[data-dados^="instrutor:"]`, and keeps its look, "Cancelar" and "Salvar".

### 2.8 The locks inside the panes

| Situation | List | Roster fields | Switches, "+ Novo", foot actions | Personal data |
|---|---|---|---|---|
| Operador, Administrador | search, filters, selection | controls | shown | controls |
| Gestor (shared and local) | the same; no CANAC on the rows or in the search | text | hidden (`.edit-only`) | the section is not built (`podeVerDadosPessoais()` false, asked at every draw: the local cache is ignored) |
| Secretaria | the same, with the CANAC | text | hidden | controls until A flips `editaDadosPessoais`; text after it |
| the date is being read | the same | a change is refused by registro ("A escala ainda não abriu…") and the `consulta` moment redraws | refused | not gated (own RPC; `DATA` captured before the `await`, as js/views/dados-pessoais.js:136) |
| after a lock (a day conflict, `formato`) | the same | text (`isGestor()` is true) | hidden | by profile, as the drawer today: controls for Operador, Administrador and, until A, the Secretaria |
| the role changes in `#role-sel` (local) | redrawn by the registry's `perfil` moment (today only Cursos and the Escala are, js/eventos/topo.js:17-21) | | | |

### 2.9 A PT409 on the cadastro

Today: a stale tab's first cadastro write is refused; the backend blocks every document and the History
(js/backends/supabase.js:63-68); `travarAposConflito` makes every profile `gestor` and shows "Outra pessoa alterou a escala
enquanto você editava…" with "Recarregar" (js/actions.js:138-145); the waiting entries become "não gravada". It happens for any
cadastro write: a field of Alunos, a weight typed in "Agendar voo" (whose booking goes with it, because the day is written only
after the cadastro, js/storage.js:237-241), "Configurar painel", a History revert.

The design (commit 1 of F2):

| Step | Where | What |
|---|---|---|
| 1 | js/backends/supabase.js, the PT409 branch of `enviar` (:63-68) | `const resposta = aoConflito(documento, { formato: error.hint === 'formato' })`; `bloqueado = resposta !== 'releitura'`; the pending content is dropped and `enviar` answers false, as today |
| 2 | js/sessao.js:151 | `aoConflito: (documento, motivo) => aposConflito(documento, motivo)` |
| 3 | js/actions.js, `aposConflito` | with `documento === 'cadastro' && !motivo.formato && dadosLidos`: `perdidas` = the descriptions of the `AUDIT_LOG` entries still `gravando` and without the mark of step 4; `setTimeout(() => relerAposConflito(perdidas))`; answers `'releitura'`. Otherwise `travarAposConflito(motivo)`, as today |
| 4 | js/actions.js, `logChange` (:212-239) | the entry gets `alteracaoGravada = true` as soon as its save answered true, before `registrarHistorico`, so a change already saved whose entry is still on its way is not listed |
| 5 | js/actions.js, `relerAposConflito` | `carregarData(DATA)`: `lerData` sets `dadosLidos = false` before its first `await`, so nothing is saved until the cadastro, the day and their versions are read again (:288-317); `ler` waits for the writes in flight. Then `mostrarAviso('refazer', texto, { recarregar: false, fechar: true })`. If the read fails: `travarAposConflito()`, as today |
| 6 | js/dom.js, index.html | `#aviso-sync` gains `button#btn-fechar-aviso` "OK", shown with `fechar: true`, which calls `fecharAviso('refazer')` |
| 7 | the list screens | redrawn by the read (`dados` moment) with the stored version; a confirmed record stays selected; a record created by a refused save is dropped (D15) |

The notice: "Outra pessoa alterou o cadastro enquanto você editava: a tela mostra a versão atual, e estas alterações não foram
gravadas: Peso Aluno 1000: 82 kg; Aluno cadastrado: Novo aluno. Refaça o que ainda for preciso." Up to five descriptions,
then "e mais N". They are History texts, so they carry no personal data.

What she does after a cadastro conflict: reads the notice and redoes what it lists. No reload; the same record open.

What it does not change: two people on the same date still lock each other on the day, because every cadastro edit also
rewrites the open day (js/storage.js:241); a conflict while a date is being read or during the format upgrade at the opening
(`dadosLidos` false; js/storage.js:396) keeps the lock; a format conflict keeps "O app foi atualizado…".

### 2.10 Phones and widths

- From 800 px of viewport (desenho-casca 2.7): the shell's fixed-height frame; the list region is `var(--lista)`
  (`clamp(300px, 38%, 480px)`), the detail the rest; each scrolls on its own. Inside the list region the title and the toolbar
  stay and `ul.lista` scrolls (`grid-template-rows: auto auto auto auto minmax(0, 1fr)`, `ul.lista { overflow-y: auto }`).
- Below 800 px: one view, chosen by `data-vendo` on the section; the document scrolls.
- Opening the detail on one view: the component calls `aoSelecionar(id, { abrir: true, empilhar: true })`; the shell pushes
  `#/alu/1000` (with the list's scroll in `history.state`), sets `data-vendo="detalhe"`, goes to the top and focuses the
  detail's title.
- The way back: `a.voltar#det-alu-voltar[href="#/alu"]` ("‹ Alunos", 44 px), drawn by the component in the detail's header and
  shown only below 800 px. Its click calls `history.back()` when the entry on top was pushed by opening the record, else lets the
  shell replace the address; Back (the button, the gesture or the link) gives `data-vendo="lista"`, the scroll back, and
  `voltarParaALista()` focuses the row (`scrollIntoView({ block: 'nearest' })`).
- "Anterior" and "Próximo" on one view replace the address, so Back still returns to the list.
- Inside the panes, container queries: the detail region is `container-type: inline-size`; under 480 px of pane a label sits
  above its value and the icon actions wrap under the title.
- 320 px (computed: the pane is 288 px): a row is 8 px of padding, the dot (8), 6, the avatar (28), 8, the text, 4, and a
  controls column of 56 px (a 44 px target with its word under the track; "Disponível" is the widest word): the text keeps
  170 px, each line cut with an ellipsis. With both controls the row is 88 px tall on touch (two 44 px targets stacked) and about
  72 px with a mouse. The armed switch takes a full-width line under its row.
- The toolbar in 288 to 480 px of pane: the search on its own line, full width, with `i-busca`; the filter button,
  "Mostrar inativos" and "+ Novo aluno" in one wrapping row ("+ Novo" pushed to the right); the count on a small line under
  them; an open filter panel in the flow under the toolbar (js/views/filtro-multiplo.js:7-8).
- The 44 px rules of the new classes stay in `@media (max-width: 640px), (pointer: coarse)`: a touch target follows the device,
  not the pane.
- The list is drawn whole (no paging); its costs are in 2.4.

### 2.11 The split of the shared modules

F0 (the delivery note's table, desenho-entrega 2.2 d, with its names): `js/views/instrutores.js`, `js/views/alunos.js`,
`js/views/filtros-das-pessoas.js` (`nenhumComOsFiltros` included), `js/eventos/instrutores.js`, `js/eventos/alunos.js`,
`js/views/painel-de-dados.js` and `js/eventos/painel-de-dados.js` (the drawer); `js/views/dados-pessoais.js` keeps the store;
the legal limits stay in the Instrutores files. What this design needs added to that table:

| # | Lines at 48875e3 | Go to | Why |
|---|---|---|---|
| 1 | js/eventos/cadastros.js:56-68 (the search listener, `prepararFiltros()` at :64, `[data-limpar-filtros]`) and js/views/cadastros.js:354-386 (`prepararFiltros`, `filtrar`, `manterAVista`, `limparFiltros`) | one part per screen: each event module creates its own filter and listens to its own search | the table's ranges leave them out; a shared `prepararFiltros` would bind both screens' buttons from one file |
| 2 | js/eventos/cadastros.js:111-132 (`deli` and `dels` in one handler) | `deli` to js/eventos/instrutores.js, `dels` to js/eventos/alunos.js | the same |
| 3 | js/eventos/cadastros.js:134-137 (`pesoDoCampo`) | js/rules.js as `pesoDoTexto(texto, naoENumero)`, beside `pesoDigitado` (:133-137); each screen passes `campo.value, campo.validity.badInput` | both handlers use it; a pure function gets a unit test |
| 4 | js/views/dados-pessoais.js:11-21 | exports `dadosDe(tipo, id)`, `guardarDados(tipo, id, dados)` (null removes), `podeVerDadosPessoais()` and `aoMudarDadosPessoais(fn)` in place of `atualizarColunas` (each screen patches its own cells) | the drawer's new file reads and writes `DADOS` and calls the two private functions (js/views/dados-pessoais.js:56, :59, :73-75, :147-150): without the exports F0b does not load |
| 5 | js/views/cadastros.js:328-451 | js/views/filtros-das-pessoas.js keeps `filtros`, `mantidos`, `multiplos` and `APLICAR` keyed by screen | F2 removes the `alu` keys without touching the instructors' |

F2 moves:

| What | From | To |
|---|---|---|
| the Alunos filter state and its application (`filtros.alu`, `mantidos.alu`, `aplicarFiltrosDosAlunos`, the count) | js/views/filtros-das-pessoas.js | the controller (`criarMestreDetalhe`) |
| the row with inputs, `linhaDoAluno`, `atualizarLinhaDoAluno`, `rAlu` | js/views/alunos.js | model builders there (`itemDoAluno(s)`, `modeloDosAlunos()`, `detalheDoAluno(id)`); the draw registered by js/eventos/alunos.js |
| the search listener of `[data-flt="alu"]`, "Limpar filtros" of Alunos | js/eventos/alunos.js | js/views/lista.js |
| the read, the save and the refusal texts of the drawer | js/views/painel-de-dados.js | js/views/dados-pessoais.js (`lerDadosDaPessoa`, `gravarDadosDaPessoa`), used by the drawer and the section |
| `iniciais` | js/sessao.js:108-111 | js/format.js |
| the progress as text, for the row | `progressoDoAluno` (js/views/etapas.js:148-155) | the same file: `progressoEmTexto`, with `progressoDoAluno` built on it |
| `apertado` and its three listeners | js/eventos/cursos.js:90-93 | js/dom.js (`ponteiroApertado()`) |

After F2: js/views/filtros-das-pessoas.js serves Instrutores (until C) and the Demanda's `nenhumComOsFiltros` (until G); the
drawer serves Instrutores (until C); `focusLast` (js/dom.js:88) serves "+ Novo instrutor" (until C).

### 2.12 Styles

| Thing | Rule |
|---|---|
| file | `css/lista.css`, linked only by index.html, after the screens' files and before `css/toque.css` (painel.html loads `css/app.css` and must not get it) |
| row | no card; `border-top: 1px solid var(--ln)`; the `li` is a grid `minmax(0, 1fr) auto` with the select button over the rows of its three lines, `chave` at the top right and `rapida` at the bottom right; the `li` holds the background, so the selected row is lighter edge to edge, controls included |
| selected | `li:has(> .lista-botao[aria-current])`: `background: var(--sel)` and `box-shadow: inset 3px 0 var(--ac)`; in `forced-colors`, an outline in `Highlight` (css/app.css:366-368) |
| lines | title 600 `--ink` (inactive: `--mu`); second line `--ac` 600; meta `--ac`, small, `margin-left: auto`; third line `--mu`; each one line with an ellipsis |
| dot | 8 px; `ok` `--ok`, `aviso` `--wa`, `erro` `--er`, `info` `--ac`; the space stays when there is none |
| avatar | 28 px (56 px in the detail); `--avN` from `corDoAvatar(id)` (`id % 5` for a number, the sum of the character codes for a text), initials in `--avT`, 600; a resource shows `i-aviao` |
| switch `.lista-chave` | the track and the knob are `::before` and `::after` of the button, its word under them (11 px); `aria-checked` places the knob; armed (`.arm`): `grid-column: 1 / -1` on a line of its own under the row, `--erT` on `--er` (the armed ✕'s pair today) |
| toggle `.lista-rapida` | `label.alvo` with today's `input.sw` and its word |
| field | `.det-campo`: a grid of the label (bold, ":" from `::after`) and the value; the control has a 1 px bottom border in `--ln` (solid `--ac` when focused) and no other border; stacked under 480 px of pane |
| detail width | `.det { max-width: 760px }`, at the left of its pane |
| section bar | full width, `--pn2`, radius 8 px, icon at the left, `.seta` at the far right, rotated when collapsed (the rule of css/app.css:476-477) |
| contrast | the pairs of D21 and the armed switch join test/e2e/acessibilidade.spec.js:1026-1057 |

Sprite (index.html:26-53): F2 adds `i-filtro` and `i-busca` (desenho-casca 2.11); `i-cima`, `i-baixo`, `i-conta` and `i-aviao`
exist.

### 2.13 What changes in the operator's routine, counted

| Routine | Today | With the component |
|---|---|---|
| change one student's weight, with the mouse | find the row, click the cell, type, click elsewhere: 2 clicks | find the row, click it, click the field, type, click elsewhere: 3 clicks |
| the same, with the keyboard | Tab through the bar and the table head to the row's weight, type, Tab | type the name in the search, Enter (the detail's title), Tab to "Peso (kg)", type, Tab |
| a weight for one student after another | type, then about 8 Tabs to the next row's weight (Curso, the two lists and their ✕, "Dados pessoais", "✕", Nome) | type, Ctrl+.: 1 key per student |
| a new student with personal data | "+ Novo aluno", 3 fields, "Dados pessoais", 5 fields, "Salvar": 3 clicks | "+ Novo aluno", 3 fields, Tab into the section, 5 fields, Enter: 1 click |
| look up a phone number | find the row, "Dados pessoais", wait for the read, ✕: 2 clicks | click the row: 1 click (the cached value shows at once) |
| stop offering a student who left | not possible (only "Excluir": irreversible, erases the personal data) | 2 clicks on the row's "Ativo" (arm, confirm) |
| mark that an INVA does not come (C) | 1 click ("Vem" in the day grid) | 1 click on the row's "Vem" (`rapida`); 2 without that slot (select, then the detail's switch) |
| mark an aircraft in maintenance (B) | 1 click ("Disponível") | 1 click on the row's "Disponível"; 2 without the slot |
| type the hours of one aircraft after another (B) | type, 3 Tabs (the switch, "Revisão feita", the next switch) | type, Ctrl+.: 1 key |
| approve a pedido (D) | no approval exists | 1 click on the row's "Aprovar" (`acao`) |
| a change refused by a cadastro conflict | "Recarregar", open the screen again, find the record, type again | read the notice (it lists what was lost), type again: no reload |
| compare one value across many students | read down one column | not at a glance: the dot marks "sem peso"; the rest is one click, or Ctrl+., per student |

## 3. Where each existing control goes

The fields and sections of each cadastro's detail belong to the cadastros note: not applicable here. This table covers the
list machinery the component replaces in the three cadastros, and Alunos as F2 ships it.

| Control today (label, id or data attribute) | Destination | Kept, moved, replaced by or removed |
|---|---|---|
| "Buscar aluno…" `input[data-flt="alu"]` (index.html:253) | Alunos, list pane, toolbar; also finds the CANAC for who sees personal data (`podeVerDadosPessoais()` at each draw) | moved (F2) |
| "Buscar instrutor…" `[data-flt="inst"]` (:222); "Buscar matrícula…" `#flt-rec-mat` (:157) | the list pane's toolbar of each screen | moved (C; B) |
| the filter buttons and panels `#flt-alu-cur`, `#flt-ins-hab`, `#flt-rec-cat` (with `-painel`, `-limpar`) | the list pane's toolbar, static, same ids, same component, created at the first draw | kept (F2 alu; C ins; B rec, unless desenho-cadastros D21 replaces it by the groups) |
| "N de M alunos" `#alu-contagem`, `#ins-contagem`, `#rec-contagem` | the list pane's toolbar, same ids, text from `textoDaContagem` | kept |
| "Nenhum … com esses filtros." and "Limpar filtros": `tr.sem-resultado`, `#limpar-filtros-alu[data-limpar-filtros]`, `#limpar-filtros-inst`, `#limpar-filtros-inst-dia`, `#limpar-filtros-revisao`, `#limpar-filtros-frota[data-limpar-recursos]` | `li.lista-vazia > button#limpar-filtros-<lista>[data-lista-limpar]`, one per list | replaced (F2 alu; C; B) |
| "Nenhum aluno cadastrado. Clique em “+ Novo aluno” acima para cadastrar." `td[colspan].h` | `li.lista-vazia` | replaced (F2) |
| "+ Novo aluno" `[data-act="adds"]`; "+ Novo instrutor" `addi`; "+ Novo recurso" `#btn-novo-recurso` | the list pane's toolbar; the new item opens selected (`#/alu/novo` until saved), focus on its first field | moved (F2 alu; C; B) |
| (new) "Mostrar inativos" | `button#alu-inativos[aria-pressed]` in the toolbar, hidden while nobody is inactive | new (F2 alu; C; B) |
| (new) the row's "Ativo" | `button.lista-chave[role=switch][data-act="ativo"][data-de]` | new (F2 alu; C; B) |
| `.seg` "Disponibilidade do dia", "Cadastro" (`[data-vista-ins]`, `[data-vista-rec]`) | the two scoped sections of the detail (posicao B5) | removed (C; B) |
| the fleet's group rows `button.grupo-btn[data-recolher-grupo]` | `li.lista-grupo` with `button[data-lista-grupo]` | replaced (B) |
| the row's fields: "Nome" `input.nm[data-f="nm"]`, "Peso (kg)" `[data-f="kg"]`, "Curso" `select[data-f="curso"]`, "Priorizar com" and "Não escalar com" (tags, ✕ `unvc`, `unbl`, `select[data-f="voaCom"]`, `[data-f="bl"]`) | Alunos, detail, section "Cadastro"; same `data-f` and `data-act`, inside `div.det[data-k="s"][data-id]` | moved (F2) |
| the "?" of "Priorizar com" and "Não escalar com" (table head) | beside the field's label | moved (F2) |
| "CANAC" column `td.c-canac.so-dados` | the row's second line ("CANAC 123456 · PP") and the detail's subtitle, for who sees personal data | moved (F2) |
| the progress line `small.progresso[data-dica="progresso"]` | the row's meta ("13/46") and third line; a read-only line under "Curso" in the detail | moved (F2) |
| "Dados pessoais" `button[data-dados="aluno:<id>"]` | the detail's section "Dados pessoais" | replaced (F2) |
| the drawer `#painel-dados` for a student: title, "✕" `#btn-fechar-dados`, "Cancelar" `#btn-cancelar-dados`, "Salvar" | the section: "Salvar" kept; "Desfazer" in the place of "Cancelar" (drops the draft); no ✕ | replaced for Alunos (F2); the drawer itself is deleted in C |
| the drawer's fields `#dado-cpf`, `#dado-canac`, `#dado-nascimento`, `#dado-celular`, `#dado-email` and `small.erro-campo[data-erro]` | `#det-alu-cpf` … `#det-alu-email` (`data-dado`), errors `#det-alu-<campo>-erro` | moved (F2) |
| the drawer's messages `#dados-erro` | the section's notice `#det-alu-dados-aviso` (texts of 2.7) | moved (F2) |
| "Atualizado em … por …" `p.h` | the section's foot | kept |
| "✕" then "Confirmar" `button.x[data-act="dels"]` | "Excluir aluno…" in the detail's foot, same `data-act`, two clicks | moved (F2) |
| "Os pedidos de cada data ficam na Demanda." "Abrir a Demanda" (`a.btn.quiet[href="#/dem"]` after F1) | the list pane, under the toolbar | kept until A replaces it |
| the phone card of a person (`table.cadastro tr.cd`, `data-rotulo`) | the row on one view, and the stacked fields of the detail | replaced (F2 alu; C ins) |
| "Editar habilitações" `[data-act="editar-habs"]` and `#painel-instrutor`; "Retirar" `[data-act="retirar-recurso"]`; "✕" `deli` | sections and foot actions of their details | not applicable here (C; B) |

## 4. Data-format steps and migrations

None in this topic.
- The component stores nothing: its state is memory, and the selected item is in the shell's address.
- Personal data keep `salvar_dados_pessoais(text, integer, jsonb, timestamptz, date)` as it is: one call per "Salvar".
- The re-read after a cadastro conflict changes no SQL: `salvar_documento` keeps answering PT409.
- What it needs from others: format 26 (`inativo` in the whitelists, F3) merged before F2, for the row switch of Alunos;
  A's M1 and A2's M2 (desenho-cadastros D18) for the Secretaria, after which `editaDadosPessoais` changes in one line; the paged
  `listarDadosPessoais` of desenho-cadastros D29 (A) for the CANAC on the rows past 1,000 people (the read of a selected person
  is not affected: its version comes from its own read).

## 5. Files created, changed and deleted, by step

| Step | Created | Changed | Deleted |
|---|---|---|---|
| F0 | nothing of this topic: the split of 2.11 is the delivery note's, with the five additions there | | |
| F1 | nothing of this topic (the shell's frame; F2 builds the pane rules of desenho-casca 2.7) | | |
| F3 | nothing of this topic (format 26 and the gated readers, merged before F2) | | |
| F2 | see the commits below | | |
| A | | js/views/alunos.js, js/eventos/alunos.js (the new fields and sections); `editaDadosPessoais` false for the Secretaria (one line, with M1 and A2's M2) | the line "Abrir a Demanda" |
| B | | js/views/recursos.js, js/eventos/recursos.js, index.html `#s-rec` (groups, the selectable category, the fixed item, `rapida` "Disponível", the switch with `data-de="recurso"`) | js/views/filtros-dos-recursos.js's own `mantidos` and count; js/views/vistas.js if C merged first |
| C | | js/views/instrutores.js, js/eventos/instrutores.js (it imports js/eventos/editor-de-dados-pessoais.js and js/eventos/inativos.js), index.html `#s-ins` | js/views/painel-de-dados.js, js/eventos/painel-de-dados.js, `aside#painel-dados`, `aside#painel-instrutor` with their Esc listeners, `focusLast`; js/views/vistas.js if B merged first |
| D, G | | their screens call `criarMestreDetalhe` (D: `acao`, `estado`) | G: js/views/filtros-das-pessoas.js, when the Demanda table goes |
| E, H, I | nothing of this topic | | |

F2 (branch `linha-f2-lista`), five commits, each green:

| Commit | Created | Changed | Deleted |
|---|---|---|---|
| 1. `feat: um conflito no cadastro relê a data e diz o que não foi gravado` | | js/backends/supabase.js (:63-68), js/actions.js (`aposConflito`, `relerAposConflito`, `ultimaGravacao`, the mark in `logChange`), js/sessao.js:151, js/dom.js (`mostrarAviso` … `fechar`), index.html (`#btn-fechar-aviso`), test/unit/backend-supabase.test.js, test/e2e/compartilhado.spec.js | |
| 2. `refactor: o redesenho espera o clique e troca só o que mudou` | | js/dom.js (`ponteiroApertado`, `trocarPorChave`), js/eventos/cursos.js:90-93 | the copy of `apertado` in js/eventos/cursos.js |
| 3. `feat: o componente de lista e detalhe, com Alunos` | js/lista.js, js/detalhe.js, js/views/lista.js, js/views/detalhe.js, js/views/mestre-detalhe.js, css/lista.css, test/unit/lista.test.js, test/unit/detalhe.test.js, test/e2e/lista.spec.js | index.html (`#s-alu`, the stylesheet link, `i-filtro`, `i-busca`, the Manual's "Alunos"), js/views/telas.js, js/views/alunos.js, js/eventos/alunos.js, js/views/filtros-das-pessoas.js, js/views/etapas.js, js/format.js, js/sessao.js, css/alunos.css, css/cadastro.css, test/e2e/telas/alunos.js, test/e2e/telas/invariantes.js, the specs of section 6, README "Estrutura" | `table.cadastro.alunos` (index.html:261-264) and its phone cards; `linhaDoAluno`, `atualizarLinhaDoAluno`, `rAlu`; the Alunos half of js/views/filtros-das-pessoas.js |
| 4. `feat: os dados pessoais do aluno no detalhe, com Salvar e Desfazer` | js/views/editor-de-dados-pessoais.js, js/eventos/editor-de-dados-pessoais.js | js/views/dados-pessoais.js, js/views/painel-de-dados.js, js/eventos/painel-de-dados.js (only `instrutor:`), js/perfis.js, js/somente-leitura.js, the stylesheet that holds css/app.css:241-245 after F0c (`.dado-campo` in the list of exemptions), js/main.js:58-62, test/unit/perfis.test.js, test/e2e/dados-pessoais.spec.js, test/e2e/acessibilidade.spec.js | the "Dados pessoais" button that commit 3 leaves in the detail's header to open the drawer |
| 5. `feat: Ativo e Mostrar inativos em Alunos` | js/eventos/inativos.js | js/reversoes.js, js/views/alunos.js, js/eventos/alunos.js, index.html (`#alu-inativos`), test/unit/reversoes.test.js, test/e2e/alunos.spec.js | |

Commit 1 depends on nothing else of F2: the plan can make it its own PR before F2 for a separate review.

Ownership: after F2, js/lista.js, js/detalhe.js, js/views/lista.js, js/views/detalhe.js, js/views/mestre-detalhe.js,
js/views/editor-de-dados-pessoais.js, js/eventos/editor-de-dados-pessoais.js, js/eventos/inativos.js and css/lista.css change
only in a fix PR merged to the base branch, never inside A, B, C, D or G.

## 6. Tests

Written first, in this order:

| File | What | About |
|---|---|---|
| test/unit/lista.test.js (new) | `listaAVista`: the search without accents, by CANAC, with the matrícula key; the filters; the inactive scope; `mantidos` and `vistos`; fixed items; a group without items; groups open while searching. `textoDaContagem`. `partesDaLista` and `linhaHtml`: the controls are siblings of the select button; `aria-current`; only the stop row's controls in the Tab order; `chave` as `button[role=switch]` with `aria-checked`, its word and `data-confirma`; `rapida` with its word; `acao` in the place of `chave`; no control without them; hostile text escaped. `grupoHtml`. `vazioHtml` (five states). `teclaNaLista` (ends, collapsed groups, a group's ← →, the search skipping fixed items and headers). `conciliar` (an id that left, a `perdido`, `pedida`). `vizinhoNaLista`. `corDoAvatar` | 36 tests |
| test/unit/detalhe.test.js (new) | `campoHtml` per `tipo`: the label's `for`, `aria-describedby`, text for who only reads, an error drawn from `erros` (`aria-invalid`, the message, the typed value), escaping; `secaoHtml` (`aria-expanded`, `hidden`, the scope tag); `acoesHtml` (every action has a name; "Anterior" and "Próximo" `aria-disabled` at the ends); `partesDoDetalhe` (the keys `cab`, `aviso`, one per section, `rodape`) | 18 tests |
| test/unit/backend-supabase.test.js | a PT409 on `cadastro` whose `aoConflito` answers `'releitura'`: `gravar` answers false, the next `gravar('cadastro')` after a `ler` is sent, the History is not blocked; any other answer blocks as today (the tests at :248-269 unchanged) | plus 2 |
| test/unit/reversoes.test.js | `setInativo`: valid for the three `de`; hostile values refused | plus 3 |
| test/unit/perfis.test.js | `editaDadosPessoais`: Operador, Administrador and, until A, the Secretaria; not the Gestor nor the TV | plus 1 |
| test/unit/format.test.js, test/unit/progresso.test.js | `iniciais`; `progressoEmTexto` | plus 2, plus 1 |
| test/e2e/lista.spec.js (new) | The bench: groups, a selectable group, fixed items, `rapida`, `acao`, `estado` lendo and falhou; the keys of 2.5; names; 44 px at 390 and 320; at 320 a row with both controls keeps at least 120 px of text; the armed switch on its own line, confirmed by a second click; no sideways scroll in each pane. Alunos, typed with `keyboard.type` and clicked with the mouse, with no `blur()` between: the next field gets the focus and the digit lands; another row is selected in one click; a row's switch arms in one click; "Excluir aluno…" arms; the row's case again with a touch (`hasTouch`, `tap`). A row whose HTML did not change keeps its node across a save (an expando survives). Selection follows the arrows; Enter and Esc; the Tab from a typed field lands on the neighbour; Ctrl+. lands on the same field of the next student; with the Histórico open, Esc closes only it, the second restores the field, the third goes to the row; the selection survives a date change, a rename and a reload (`#/alu/1000`); a new student is `#/alu/novo` until saved; on a phone: list, detail, "‹ Alunos", `page.goBack()`; the Gestor selects and reads text, with no CANAC; the detail's width at most 760 px; "Mostrar inativos", its count, the switch's two clicks, its History entry and its revert | 26 tests |
| test/e2e/compartilhado.spec.js | the cadastro conflict: the notice lists what was not saved, the screen is not locked, the change redone is saved without a reload; the same from "Agendar voo" with a typed weight (the notice on the Escala); a stale tab adds a student after a colleague added one (same id): the colleague's name and personal data are untouched, the detail closes with "A inclusão do aluno novo não foi confirmada pelo servidor.", and the address never names the colleague's id | plus 3 |
| test/e2e/dados-pessoais.spec.js | the section's "Salvar" and "Desfazer"; the draft kept across selections and marked on the row; leaving the page with a draft asks (`page.close({ runBeforeUnload: true })`); a refusal arriving after she moved to another row (the fake server's answer held by a route): the row's dot, the list's line, "Abrir"; a new student's data wait for the save that created him (shared mode, `salvar_documento` held) | plus 4 |

Existing tests that change in F2:

| File | What changes | About |
|---|---|---|
| test/e2e/telas/alunos.js (F0a's driver) | `abrirAlunos`, `filtrarCursos` on the new markup; new `abrirNaLista(page, lista, id)`, `detalheDa(page, lista)`, `campoDoAluno(page, id, campo)`; `ESTADOS`: the list, an item open, no item with the filters, the Curso panel open, on one view the detail | 1 file |
| test/e2e/telas/invariantes.js (F1's driver) | the sideways-overflow check of each `[data-regiao]` | 1 function |
| test/e2e/alunos.spec.js (split from cadastros.spec.js in F0a) | "Alunos" (:1124-1224 today), "Alunos: o filtro dos cursos…" (:1329-1507), "Confirmação" (:1536, :1556) | 11 tests |
| test/e2e/dados-pessoais.spec.js | the 11 of 12 that open a student (:20, :52, :83, :114, the Alunos half of :141, :171 at :199, :219, :236, :258, :276, :287): the section instead of the drawer. :258 keeps its rule (the person is read on selection; without an answer, nothing is saved) | 11 of 12 |
| test/e2e/celular.spec.js | :64 (the card becomes a row and a detail), :174, and the two loops (:30, :49) through the walk | 4 tests |
| test/e2e/acessibilidade.spec.js | the walk (:47, :206); the armed "✕" of the contrast list (:1026-1057) becomes the armed "Excluir aluno…" and the armed switch; the Esc tests that open `#painel-dados` from Alunos open it from Instrutores | 5 lines, 3 tests |
| test/e2e/perfis.spec.js | :5, :46 | 2 tests |
| test/e2e/app.spec.js (or `test/e2e/manual-frases.js` after F0c) | the Manual's phrases about Alunos (:159-185) | 1 test |
| test/e2e/cursos.spec.js | the `.progresso` assertions of Alunos: the row's meta and third line, the detail | selectors |
| abertura, demanda, instrutor-escolhido, envio-local, noturno, datas-compartilhado, seguranca and 4 more | selectors only: `#alu tr[data-id] [data-f]` becomes the driver's `campoDoAluno` | 165 lines in 21 files name an Alunos selector today (grep); fewer if F0a's driver already hides them |

How the checkers find the panes: both regions are inside `main#conteudo > section.on` and carry `data-regiao`; on one view the
hidden region is skipped by `checkVisibility`, so the walk visits the list and then an open item (desenho-casca D28's
`REGIOES`).

A check no automated test makes: F2's implementer reads the bench and Alunos with VoiceOver on macOS Safari (the list's one Tab
stop, `aria-current`, the switch and its armed state, the section buttons, the personal-data errors) and records what is said
in the PR; it is the plan's only check with a real screen reader.

No e2e pins a lock after a cadastro conflict today: where another person changes the cadastro, a date change reads it again
before the next write (test/e2e/abertura.spec.js:350, :713; test/e2e/datas-compartilhado.spec.js:180).

Traps for who implements: test/unit/csp.test.js:67 fails any line of `js/` with a space, a name starting with `on`, `=` and a
quote, which includes a parameter default such as `{ onde = 'lista' }` (hence `lugar` in `avisar`); test/unit/glossario.test.js:32
wants every literal `data-dica="…"` of `js/views/` in the glossary.

Each commit runs `npm run lint` and `npm test`; F2 has no database test.

## 7. Departures from Pedro's request

| What the request says | What this design does | Why | What Pedro can choose instead |
|---|---|---|---|
| "F2. The master-detail list component", a foundation step without a screen | F2 also converts Alunos (today's fields, the row switch, "Mostrar inativos"); A adds what is new for Alunos | the lint refuses a module only tests import; B and C start from a component already in use | merge F2 and A as one step, and start B and C after it |
| the order F1, F2, F3, with "Alunos and Recursos get a switch on the list row" | F3 (format 26) before F2, as the delivery note orders it, so the switch ships with F2's Alunos | the switch must deactivate something the day it appears | keep the request's order: the switch arrives with A, and a bench list covers it in F2 |
| "edited in place" | the roster fields save as she leaves each one; personal data are edited in place too but saved by one "Salvar" per section, with "Desfazer" | one versioned call replaces the five fields; a date field fires `change` at every digit; one History entry per save, as today; nothing undoes a saved personal-data change | save personal data field by field (five History entries for a new student on the open date's History, which lists the 200 newest; a date saved when the field is left; no undo) |
| "inactive rows are dimmed" | the title in the muted colour and the tag "inativo"; no opacity | contrast of at least 4.5:1 on a row that still acts | opacity, accepting the lower contrast |
| "icon actions at its right" | the icons are "Anterior" and "Próximo"; "Excluir aluno…" is a text button in the foot, armed by two clicks | icons for what destroys nothing; deleting stays de-emphasised (posicao B5) | "Excluir" as an icon at the title |
| "Reuse … `mostrarVista`" | not reused: the phone's switch between list and detail is the shell's `data-vendo` through the address, so Back works; `mostrarVista` serves only the two switches B and C remove, and js/views/vistas.js goes with the second of them | a remembered view per screen has no Back | the phone's switch through `mostrarVista` (no Back to the list) |
| "No modal or pop-up for viewing or editing a record" | between F2 and C the instructors keep their two drawers | one screen per step | nothing: the end state is the request's |
| "`celular.spec.js`, `percorrerVistasEFiltros` … must keep passing" | the walk is rewritten for the screens that change, and the checks are extended to each pane | the screens it walks cease to exist; a pane that scrolls alone escapes the document check | nothing |
| (not in the request) a cadastro conflict locks the screen until a reload | it reads the date again and lists what was not saved; a conflict on the day or the format keeps the lock | the lock costs a reload and loses the place | keep the lock (the address restores the record after "Recarregar") |

## 8. Questions for Pedro, each with the default this design implements

| # | Question | Default |
|---|---|---|
| 1 | Personal data: one "Salvar" per section (with "Desfazer"), or saved field by field as she leaves each one? Field by field costs one History entry per field on the open date (only the 200 newest are listed), a birth date saved when the field is left rather than at each digit, and no way back | One "Salvar" per section, as desenho-cadastros D17 |
| 2 | After someone else changed the cadastro: read it again and list what was not saved, or keep today's lock with "Recarregar"? | Read again, no lock (cadastro only, after the date opened; the day and the format keep the lock) |
| 3 | Should a cadastro edit stop rewriting the open day when the day's content did not change? It would spare two people on the same date some locks; it changes the core write path | No, as today |
| 4 | Do the arrow keys select as they move, as in the mail reference, or does only Enter or a click select? | They select |
| 5 | The per-date toggle on the row's third line (INVAs "Vem", Recursos "Disponível"): does F2 build the slot, or does the availability note's board replace it? | F2 builds it (desenho-cadastros D11); if the board is chosen, the slot is not built |
| 6 | "Mostrar inativos" as one toggle, or a two-option switch "Ativos / Todos"? | One toggle, hidden while nobody is inactive |
| 7 | The order of the list: the cadastro's order, as the tables today, or alphabetical? | The cadastro's order (the component draws what the screen gives) |
| 8 | Does F2 convert Alunos (with the switch, F3 first), or do F2 and A merge into one step? | F2 converts Alunos |
| 9 | A student's name, weight, course and preferences have no "↶ Reverter" in the History today. Give them one now that the fields read as text? | No, as today; Esc before leaving the field puts the stored value back |

The avatars' colours and the selected item in the address are the shell's questions 12 and 10 (defaults: five hues by id; yes).

## 9. Risks, and what would make this design wrong

- **The table's overview is lost.** A wide table shows one value for everybody; a list shows three lines per row. If the daily
  routine is "check every INVA's availability" or "check every aircraft", the lines, the dot, the meta and the `rapida` slot
  must carry that state, or B and C keep a board (the availability note's pinned item). The component only gives the slots.
- **The draw waits for `mouseup`.** A button released outside the window (a drag) leaves `ponteiroApertado()` true until the
  next key, `mouseup` or the window's `blur`; a missing reset would leave the panes stale until then. The Cursos tab has lived
  with the same rule (js/eventos/cursos.js:84-124).
- **A kept part keeps what scripts did to it.** `trocarPorChave` compares HTML and control values only; a script that changes
  something else inside a part (a class, an attribute) must call for a draw that changes its HTML, or the change stays.
  `confirmado` and js/somente-leitura.js are covered (armed parts are held; the role change redraws).
- **F2 grows.** Converting Alunos, the personal-data section, the switch and the conflict commit delay B, C, D and E by the
  rewrites of section 6. If that is too much, commit 1 becomes its own PR, or question 8's other answer.
- **Decision 14 is in the write path** (js/backends/supabase.js, js/actions.js), which the core and delivery notes own. If it
  is refused, the address still returns her to a confirmed record after "Recarregar"; nothing else here depends on it.
- **The armed switch moves.** The second click is on the full-width line under the row, not where the first was. It protects
  against a double click, and it is new to her; the bench tests mouse, touch and keyboard.
- **Drafts live in memory.** A crash or a closed laptop loses an unsaved personal-data draft; the page asks only on a normal
  unload.
- **`aria-current` on a button** is read as "current", not "selected"; roving tabindex with redraws is new here. Only the manual
  VoiceOver check of section 6 covers it, and Safari is not run by the suite (container queries, `:has()`, the History API).
- **Names across the sibling notes.** The redraw registry has two names (`registrarTela` in `js/telas.js`, `registrarDesenho`
  in `js/redesenho.js`) and the shell also calls its screen hook `registrarTela`; F0's file names and the `ativo` handler's
  owner must be the same in the plan. This note follows the delivery note's F0 names and asks the cadastros note for two
  changes (D6, D16).
- **Wrong if** Pedro wants the detail to be a place to read, with an explicit "Editar": D11, D12 and D23 change, the rest
  stands. **Wrong if** F1 takes the panes out of `main` or out of `section.on`: D13 and D22 need the selectors of
  js/somente-leitura.js and of the checkers widened first. **Wrong if** the board replaces the row toggles: the `rapida` slot
  is not built and the counts of 2.13 for B and C are the availability note's.

<!-- revisado -->
<!-- fim -->
