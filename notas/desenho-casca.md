<!-- Design note for the production-line redesign. Local working note: never commit this file. -->

# Desenho: A casca (F0 e F1): navegação em linha, três painéis, o trilho e a data única

Designed on the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, 48875e3). Paths are relative to it. Ids, attributes and UI labels are verbatim. "(computed)" marks a number calculated from the CSS or with the WCAG formula of `test/helpers/contraste.js` (scripts outside the repo); nothing was run in a browser, so every layout number is to be pinned by the tests of section 6. "(inferred)" marks what no line proves.

What this revision changed against the first version, after its two reviews:
- Names and steps follow the sibling notes: F0 is `desenho-entrega`'s three PRs (F0a, F0b, F0c); the redraw registry is `js/redesenho.js`; the screens table stays `js/telas.js`; the stylesheet split is the delivery note's, with this note's one requirement (`painel.html` unchanged).
- The adapter contract is the one the revised `desenho-escala-aprovar` already consumes; F1's first bodies follow H's rules (order, `destino: null`, the "pedidos not read" item).
- The list–detail split, the one-view switch and the selection are F2's (`desenho-lista`); F1 builds only the fixed-height frame.
- The linha spans the full width; the trilho sits beside the content only. It is docked by default from 1,280 px and opened as a temporary panel below; only "Fixar ao lado" is stored, per width class.
- Rodízio and BI join the Cadastros in the linha's secondary line; the header keeps today's tools. The Recursos link carries the aircraft badge.
- The Agenda in F1 reads the open date's rows from one cache and gets D's "Data do pedido" field.
- The address: the screen and a one-shot item in the hash; the date never in the history; the skip link and "Sair" keep the address clean.
- F1 is two PRs.

Words used below: **linha** = the pipeline navigation (`nav#linha`); **trilho** = the rail (`aside#trilho`); **fixo** = the trilho docked as a column; **painel do trilho** = the trilho opened in the page flow when it is not docked; **tela** = a screen (`main#conteudo > section.tela`); **coluna** = `main#conteudo`, the content beside a docked trilho; **estágio** = a stage card (`li.estagio`; "etapa" is already the course mission).

## 1. Decisions

| # | Decision | Why, and the evidence | Alternative rejected, and why |
|---|---|---|---|
| D1 | The page is `header.topo` (one row), then `div.casca#casca` holding, in this DOM and Tab order, `div.avisos-do-app`, `nav#linha`, `aside#trilho`, `main#conteudo`. The grid places them: the notices and the linha across the full width; below them the coluna and, when docked, the trilho at its right. | The skip link must land in the content, and the next Tab inside it (test/e2e/acessibilidade.spec.js:1072-1083); the read-only disabling is scoped to `main` and the trilho has no data field (js/somente-leitura.js:5-9). With the trilho before `main`, Tab from the date button reaches the calendar before the whole screen (review: the only date control was the last Tab stop). The linha does not reflow when the trilho docks. | The trilho last in the DOM (a keyboard user crosses the screen to reach the date); the linha beside the trilho (the cards rearrange whenever the trilho docks); everything inside `<main>` (mapa-casca 7.6). |
| D2 | The linha is `nav#linha[aria-label="Navegação"]` › `ol#linha-estagios` (four `li.estagio`, each a title link and a `ul.estagio-tarefas` of row links) › `div.linha-mais` (the Cadastros group, Rodízio, BI) › `button#btn-linha`. Every control that goes to a screen is a real link `a[href="#/<tela>"]`; exactly one `[data-nav]` link has `aria-current="page"`. Native Tab order. Every class, id and attribute of the shell is its own (`estagio`, `linha-…`) and every selector is under `#linha`. | A link goes somewhere and works with the address bar; the test "exactly one `[aria-current="page"]`" keeps its meaning (acessibilidade.spec.js:547-569). `.etapa` is the course-mission tag of the Demanda and of the Escala's list (css/app.css:978; js/views/etapas.js:138, 180): `li.etapa` would inherit its padding and colours, and `.etapa::before` would draw dots on every mission code. | Buttons with `data-t` under `id="nav"` (mapa-casca 7.1): no address. A menubar with arrow keys. The word "etapa" for the stages. |
| D3 | Connector dots are `#linha .estagio::before` and `::after` with `box-sizing: border-box`; the line is one `linear-gradient` background on the `ol`, behind opaque cards. No element, script or inline style draws them. | The CSP forbids inline `<script>` and `<style>` and `data:` images (index.html:9; test/unit/csp.test.js:40-54). `* { box-sizing: border-box }` does not reach pseudo-elements (css/app.css:53): without the rule a 12 px dot with a 3 px border is 18 px wide, centred 3 px below the line. A hidden card needs no special case. | SVG lines sized by script; `data:` SVG backgrounds (blocked). |
| D4 | The linha has two states, **aberta** (cards with their rows) and **recolhida** (one 44 px row per card). `#btn-linha` switches from 700 px of linha width; the choice is kept in `localStorage['acpm_linha']`. With nothing stored: aberta only when the linha fits in one row (about 1,540 px of its own width) and the window is at least 760 px tall; otherwise recolhida. Below 700 px of linha it is always the one-line strip (D27). | Heights (computed, 2.6): content starts at about 108 px today; 126 recolhida in one row; 166 recolhida in two lines; 190 aberta with F1's two rows per card. Deciding by height alone gave a 390×844 phone the stacked cards, several hundred pixels before any content (review; test/e2e/celular.spec.js:7). | Height only (the first version); always aberta (82 px more than today on every screen of a laptop); always recolhida (the request draws the cards with their rows). |
| D5 | **The secondary line**: the Cadastros group (Alunos, Instrutores, Recursos, Cursos, under a small visible label "Cadastros"), then a divider, then **Rodízio** and **BI** as standalone links. When the linha is recolhida it shares the cards' row from about 1,200 px of linha (each card then shows its state and name; its value shows from 180 px of card width); otherwise it takes a second line, with `#btn-linha` at its end. The **Recursos** link carries today's aircraft badge (count and amber state). | Every screen is one click away in every state, also when recolhida (review: the Rodízio was hidden in the compact state). The badge's job is to point at where the fix is (js/views/selos.js:26-31: aircraft stopped or under 5 h, fixed in Recursos). A second-row card costs a row in every state (posicao B4). BI in the header overflows 320 px in local mode (2.5). | B4's second-row "Cadastros" card with the elbow line (Pedro's alternative, question 3). Rodízio as a row of the Escala card (invisible when recolhida). Rodízio inside the Cadastros group (it is per-date data, mapa-outras-abas conflict 1). |
| D6 | The header keeps today's tools: `#role-sel` (local mode), "Histórico" `#btn-open-log`, "Manual" (`a#btn-manual[href="#/manual"]`), the account menu. `#btn-data` replaces `.topo-data` at a fixed width of 310 px. The Painel stays the Escala's fourth view; `painel.html` is not touched. | `.topo-data` is 330 px wide today (computed: 2 × 32 px arrows, 256 px label, gaps, padding, border; css/app.css:77-105), so a 310 px button and the same tools keep the three header breakpoints of css/app.css:193-214 and their tests (acessibilidade.spec.js:238-300) true. | BI as a fifth header tool (posicao B4): local mode at 320 px needs about 345 px (computed: today's tools about 260 px plus padding and gap, plus a 44 px tool and its gap). |
| D7 | **A card carries the name of the screen it opens.** F1 ships `Agenda → Demanda → Escala → Aprovar` and the link "Instrutores"; D renames card and screen to "Pedidos", G to "Processamento", C to "INVAs". | Each merged step is live (README.md:243-244); 20 of the 30 texts that name these screens are pinned by tests and belong to D and G (lacuna-1-textos-que-citam-telas 0, 3). The delivery and pedidos notes agree (desenho-entrega decision 11; desenho-pedidos decision 1). | The final names from F1 (posicao B4's wording). |
| D8 | Who sees what is one table, `TELAS` in `js/telas.js`, read by the linha, the header and `mostrarTela` (`podeVer(tela, perfil)`). `conta` exists only in shared mode; its item `usuarios` only for `gerenciaContas`. `apr` is a screen id from F1. | With screens in the address, hiding a link is not enough: `#/dem` typed by the Secretaria must fall back. `#btn-conta` is hidden in local mode today, and `abrirConta` would write "null · null · null" there (index.html:83; js/sessao.js:163-164; js/views/conta.js:18-25). | The CSS list of css/app.css:184 (cannot guard the address). |
| D9 | **The address is `#/<tela>[/<item>]`.** A screen change adds a history entry. An `item` is one-shot: the screen applies it (`aoMostrar(item)`) and the shell then rewrites the hash to `#/<tela>`. The selected record of a list is F2's `?sel=`, never the hash. **The date is not part of the history**: after Back or Forward the shell writes `?data=<DATA>` back. Each entry keeps its scroll (`history.scrollRestoration = 'manual'`). The skip link and "Sair" do not leave a stray fragment. `linkDaData` also clears the fragment. | A reload is what the app asks for after a conflict (js/actions.js:138-145), and it must return to the screen. `abrirData` rewrites `?data=` only on the current entry (js/actions.js:24-29): without the rewrite, Back then F5 would reopen an older date and she would edit another day (review). `linkDaData` clears only the search today (js/eventos/escala.js:95-102), so the fragment would enter the shared link. Supabase's return fragments never start with `#/` (js/sessao.js:118-122). An id, a code or a place name is not personal data. | Memory only (a reload loses the place). `?tela=` (enters the shared link). Back reopening the entry's date (Pedro's alternative, question 10). The selected record in the hash (two places for one selection with F2's `?sel=`). |
| D10 | Tag selectors become scoped: `section` → `main#conteudo > section`; the bare `main { … }` (kept by F0c in `css/base.css`, which both pages load) → `.casca` in `css/casca.css` for the app and `.tela-painel main` in `css/tv.css` for the TV (desenho-entrega 2.2 f); the print rule names `header.topo`, `#linha`, `#trilho`, `.avisos-do-app`, `.gaveta`, `#tl-pop`, and shows `main#conteudo > section#s-esc` explicitly; the fixed-height rules are `@media screen and (…)`. | `show` and the CSS switch off any `<section>` (js/views/tabs.js:17; css/app.css:229-230); scoped to `main#conteudo`, today's `section#s-esc { display: block }` (1,0,1) loses to the base rule (1,0,2) and printing from another screen would give a blank page; a `min-width` query without a media type also applies to paper. | A class on `body` to keep the TV out (no bare `main` rule is left). |
| D11 | **The cap moves from 1,280 to 1,612 px, on `.casca`; the trilho is `clamp(280px, 22vw, 320px)` wide.** 1,612 = 1,248 + 12 (gap) + 320 + 32 (padding). | With the trilho docked on a wide monitor the coluna is today's 1,248 px; the coluna never exceeds 1,580 px, so the Painel's "Automático" (two lists from 1,600 px of board, js/config-do-painel.js:24) still gives one list in the page (test/e2e/painel-missoes.spec.js:103). At 1,280 px the trilho is 282 px and the coluna 954 px (2.6). | Keep 1,280 (option K, 2.6): 292 px less for every wide screen on every monitor. No cap (two lists in the page). A fixed 320 px trilho (a 922 px coluna at 1,280). |
| D12 | **The trilho is docked by default from 1,280 px of window.** Below that, and whenever she undocks it, `#btn-data` opens it as the **painel do trilho**, in the page flow between the linha and the content; it closes when a date opens, on Esc and on the button, and nothing is stored. "Fixar ao lado" (`#btn-fixar-trilho`, `aria-pressed`, from 1,024 px) docks or undocks and is the only thing stored: `localStorage['acpm_trilho']`, one value per width class (média 1,024-1,279, larga from 1,280). Below 1,024 px it never docks. | The request asks for "a fixed rail" and three panes, desktop first (pedido.md:72, 90). Docked at 1,280 px every screen still fits except two old views until B and C, which scroll inside their own boxes by at most 23 px (2.6). Looking is not pinning: in the first version a laptop that opened the calendar once kept it open, and so did every test that changed the date (review). One stored value for two screens squeezed the laptop or hid the rail on the monitor. | Docked only from 1,600 px (the first version: below it, two clicks for the next day, every day). Storing every open. Docking per screen (the layout would jump between screens). |
| D13 | **Who scrolls.** On a wide screen the document scrolls, as today, and a docked trilho is `position: sticky` with its own overflow. On a list–detail screen (`data-forma="lista-detalhe"`), from 800 × 600 px of window, the page has the window's height: the coluna's panes and the trilho scroll on their own. Below that the document always scrolls. F1 builds this frame. | The code that assumes the window scrolls is two `window.scrollTo(0, 0)` that F1 rewrites (js/eventos/navegacao.js:27; js/eventos/topo.js:100); `scrollIntoView`, the tooltip and the map pop-up follow any scroller (js/dicas.js:174; js/eventos/escala.js:69). The frame sizes `body`, `.casca`, `#linha` and `#trilho`, all shell elements, and F2 expects "F1 gives the content area a height" (desenho-lista 2.10). A height floor keeps short windows usable. | Panes scrolling on every screen (acessibilidade.spec.js:462, cursos.spec.js:1595 and the overflow checks rewritten for nothing). The frame left to F2 (nobody built it; review). |
| D14 | **The list and detail split is F2's.** A list–detail screen declares `data-forma="lista-detalhe"` on its `section.tela` (the shell's signal for the frame); inside it F2's `.md[data-md][data-vista-md]` holds `[data-regiao="lista"]` and `[data-regiao="detalhe"]` and chooses one or two views by its own container query (720 px of content). | desenho-lista decisions 15, 16 and 2.10: the component owns the panes, the one-view switch, "‹ Alunos" and its history entry. The first version's `data-vendo` and its 799 px viewport switch would have been a second switch for the same thing. | Three tracks on `.casca` with a span per wide screen (posicao B4's letter). |
| D15 | The calendar is a `table[role="grid"]` of day buttons with **one Tab stop**: the open date when it is in the weeks shown, else today when shown, else the 1st of the month shown. Arrows, Home, End, PageUp and PageDown move inside. Opening the panel by `#btn-data` moves the focus to that stop; with the trilho docked, `#btn-data` takes the focus there. `aria-current="date"` marks the open date. | Today's calendar is up to 42 Tab stops (js/views/agenda.js:130-134). After "Mês anterior" the open date may be off the grid: without the rule the grid would have no Tab stop (review). `aria-current="date"` on the chosen day is the app's tested convention (acessibilidade.spec.js:570-578). | `aria-selected` on the open date and `aria-current` on today (two conventions in one app). |
| D16 | Sundays are drawn muted and `aria-disabled`; a click says `O aeroclube não opera aos domingos: não há escala nem pedidos.` and the date stays. The last days of the previous month and the first of the next are shown, muted, and open their date. A day closed for pedidos has no look and no spoken text in the calendar. | A Sunday cannot be the open date (js/main.js:89-90; js/eventos/topo.js:35-39). Every past day and today are closed for pedidos: dimmed, a calendar for the whole app would read "cannot be opened". The deadline is said where pedidos are registered: the options of "Data do pedido" ("· prazo encerrado") and `#agenda-prazo` (2.10). | Dim closed days (css/app.css:1155). A spoken-only "prazo encerrado" (the first version: shown to nobody who sees). |
| D17 | Each day shows its number of pedidos not cancelled, for the four profiles, through `ApiClient.contagemDaAgenda(de, até)`, which F1 builds over `ApiClient.agenda` and D replaces by its count function. The first read waits for the first `lerData` to answer. | Every profile of `index.html` may read `solicitacoes` (mapa-avisos 5.4). `abrirData` first runs before the session, while the backend is still the local one (js/main.js:77, 97; js/storage.js:36): a read there would show this browser's local numbers in shared mode (review). desenho-pedidos decision 15 keeps the name and shape. | Waiting for D's function (the Secretaria would lose her numbers from F1 to D). Calling `agenda()` from the view (D would have to edit the trilho). |
| D18 | `input#dt`, `#dt-ant` and `#dt-prox` are deleted. `#dt-rotulo` and `#dt-rel` stay, inside `button#btn-data`. The change of date is announced through `anunciar()` (`#anuncio`, `role="status"`); `#dt-rotulo` loses `aria-live`. `abrirData` stays the only writer of `DATA` and `?data=`, writes no DOM, sets `body[data-data]` and calls `redesenhar('data-aberta')`. | The request replaces the arrows and the native field (pedido.md:90), not the name of the date. A live region inside a button that has the focus is read twice (the name changes too) (inferred). Keeping the two ids keeps 35 test references (mapa-testes-e-docs 5.3). | No date in the header while the trilho is docked (the control would move as the window resizes). |
| D19 | **Every profile may change the date, in every mode**, the local-mode Gestor too. | Opening a date writes nothing (js/storage.js:182-212); the shared-mode Gestor already navigates (test/e2e/datas-compartilhado.spec.js:157) and the local one already does it through the Agenda's calendar (js/eventos/agenda.js:17-26; mapa-casca conflict 11). | Today's header rule (js/actions.js:54-58). |
| D20 | The BI keeps "Data base" (`#bi-dt`), reset to the open date at every date change, as today; its two fallback reads of `#dt` become `DATA`. | It is the report's period and the BI's behaviour does not change (pedido.md:109; mapa-outras-abas conflict 3). | The trilho as the BI's date (each period change would open a whole date). |
| D21 | **The Agenda follows the open date from F1.** Its list is the open date's rows from one cache (`lerPedidosDaData`, js/views/selos.js:36-45, now keeping a failed read); `carregarMes` and the month cache go with the calendar. The date of a new pedido is the form's own field "Data do pedido" (`select#ag-data`, the field and rule of desenho-pedidos decision 12), and its two checks read that date's rows. | Two calendars that both call `carregarData` are two date controls (js/eventos/topo.js:40; js/eventos/agenda.js:25). `carregarMes` needs `gradeDoMes` and `mesVisivel`, and its cache feeds the list, the local-flight limit and the "já tem voo marcado" warning (js/views/agenda.js:43-74; js/eventos/agenda.js:85-91, 119, 152): deleting the calendar without replacing it leaves the page unbuildable (review). After 13:00 today the Agenda opens on the next open date in one click (js/views/agenda.js:58); the field keeps that. | Leave the calendar to D (two date controls until D). One date strictly with "Abrir <primeira data aberta>" (four to six clicks and two date loads after 13:00; D rejects it too). |
| D22 | Opening: a valid `?data=` wins for every profile (a Sunday opens Monday, with today's toast). Without it the Secretaria opens on the first date still open for pedidos, the others on tomorrow (Monday when tomorrow is a Sunday). The screen: the one in the address if the profile has it; else the Escala, or the Agenda for the Secretaria. | `abrirData` writes `?data=` at every opening (js/actions.js:24-29), so any override of a closed `?data=` would fire on every reload and on every shared link, which carries only the date (review). With "Data do pedido" the form starts on an open date anyway. | Replacing a closed `?data=` by the first open date for the Secretaria (the first version). |
| D23 | The trilho's list is `ol#avisos-da-data` of `li.aviso`, from `avisosDaData(contexto)` in `js/linha-do-dia.js`. F1 writes a first body from what exists, with H's rules: items by gravidade, those without a time first, then by minute; an item whose target the profile cannot open keeps `destino: null`; a failed read of the pedidos is an item. Empty: `Nada a resolver nesta data.` | pedido.md:90; mapa-avisos 5.5; desenho-escala-aprovar 2.8 (the revised H note consumes this contract and these rules). | An empty container until H. |
| D24 | The three tab badges go with the tabs: their numbers become each card's state and value and, for the aircraft, the badge of the Recursos link. `#selo-rec-dia` and the text of `#importar-agenda` keep their writer until B and G. | js/views/selos.js:20-33, 52-60; "delete what is replaced" applies to what F1 replaces. | Delete `js/views/selos.js` whole in F1 (it holds `lerPedidosDaData` and two controls of other steps). |
| D25 | New tokens, only the ones F1 uses: `--okT`, `--waT`, `--pe`, `--an`, `--anT`. New icons: `i-certo`, `i-exclamacao`, `i-andamento`, `i-trilho`, `i-grafico`. A focus ring for links (`a:focus-visible`). The selected row and the avatars are F2's, with no new token (desenho-lista decision 21). | White on the dark theme's status colours fails (1.86:1 on `--ok`, mapa-casca 5.6). Every navigation control becomes a link, and css/app.css:219-222 rings only buttons, selects and inputs. | `--sel` and five avatar hues in F1 (no merged step would use them; kept as Pedro's option, 2.12). |
| D26 | "No modal or pop-up for viewing or editing a record" removes the two record drawers, `#painel-instrutor` (in C) and `#painel-dados` (by the second of A and C to merge), each with its Esc listener in the same commit. The Histórico and the Sugestões stay drawers; the four dialogs and the map pop-up stay. **An open drawer sits to the left of a docked trilho**; with the trilho not docked a drawer covers the right of the page, as today. | posicao B4; mapa-casca 5.7. The two Esc listeners throw on every Esc once their drawer leaves the page (lacuna-1-importadores-do-que-sai 3.6). A 440 px drawer at `right: 0` would cover a docked trilho (css/app.css:1456), and a test changes the date with the Histórico open (test/e2e/historico.spec.js:44). | The Histórico as a part of the trilho (235 test lines in 27 files; 500-character entries in 320 px). |
| D27 | Phones and narrow windows: the linha is one strip that scrolls sideways inside itself (stage chips, a divider, the Cadastros links, Rodízio, BI); the trilho is the date button's panel, full-bleed below 1,024 px so seven 44 px days fit 320 px; a list–detail screen is F2's second view. | pedido.md:92; today's strip already scrolls inside itself and brings the open tab into sight (js/views/tabs.js:8-14; test/e2e/celular.spec.js:196). Inside `.casca`'s 16 px gutters a 320 px phone leaves 288 px, about 41 px per day (review; mapa-casca 5.5). | A menu button hiding the stages. A 44 px check at 390 px only. |
| D28 | Test drivers: F0a's `test/e2e/telas/casca.js` and `test/e2e/telas/invariantes.js`. F1 rewrites their bodies: `irPara` clicks the visible link of the screen; `mudarData` goes through the trilho and leaves it as it found it; `REGIOES` gains `#linha` and `#trilho`. The suite's context seeds `acpm_trilho` (not docked) and `acpm_linha` (recolhida), so the old tests keep today's widths; `casca.spec.js` and `trilho.spec.js` test the product defaults on purpose. | `irPara` has 425 call sites (mapa-testes-e-docs 5.2); every screen now has a visible link in every state, and a click keeps exercising the navigation and the focus moves the tests pin (review). Both checkers look only inside `.topo`, `#nav` and `main section.on` (mapa-testes-e-docs 5.4.4). The product default must not be chosen by the test count (review). | `irPara` by the address (focus left where it was; no click on the navigation in 425 places). Running the old suite docked at 1,280 px (layout churn in tests of screens B, C and H rewrite anyway). |
| D29 | The stylesheet split is F0c's (desenho-entrega 2.2 f, which takes this note's first file names plus `toque.css`). This note's requirement, which the revised delivery note adopts (its decision 19): `painel.html` stays byte-identical, so `css/app.css` stays as the TV page's entry, five `@import` lines (`base`, `componentes`, `painel`, `tv`, `toque`), and `index.html` links the files itself with `css/toque.css` last. F1 edits `css/base.css` (tokens, the focus ring, the bare `main` out), `css/tv.css` (`.tela-painel main`), `css/casca.css`, `css/gavetas.css` (the drawer beside the trilho), `css/agenda.css` (the calendar out), and adds `css/linha.css` and `css/trilho.css`. | painel.html:14; posicao B4 ("painel.html is untouched"); lacuna-1-css-por-tela 6 (about 210 lines reach the TV) and 5 (the generic 44 px rules work because they are last). `style-src-elem 'self'` allows a same-origin `@import`. The delivery note's own review asks for the same. | Four `<link>`s in `painel.html` (the delivery note's first version). A split designed in this note (two notes owning one commit). |
| D30 | "Compartilhar" stays in the Escala's bar in F1 and moves with the exports in H; `#role-sel`, the theme switch, "Minha conta", "Usuários" and "Sair" stay where they are; the three notices move to `div.avisos-do-app`, across the full width above the linha. | None of them is replaced by anything in the request (mapa-casca conflict 7; mapa-outras-abas conflict 4); the notices are app-level, not part of a screen. | "Compartilhar" on the trilho's date line (hidden whenever the trilho is). |
| D31 | **The Aprovar card opens `#/apr`.** In F1 it shows the Escala, brings `#compactacao` into view, outlines `#aprovacao` (or `#selo-aprovada` when approved) for 1.2 s, moves the focus to its first control and announces the approval state; with no control there (a read-only profile, or no flight) the focus goes to the Escala's title and the announcement says why. The Aprovar card is the current one. H gives `apr` its own section. | `#aprovacao` is at the top of the Escala (index.html:366-370), so a link to it from the Escala changes nothing visible, and a focus moved after a mouse click shows no ring (review). desenho-escala-aprovar 2.7 already uses `TELAS.apr` and `#/apr`. | `#/esc/aprovacao` (the highlight stayed on the Escala card). Three cards until H (Pedro's alternative, question 18). |
| D32 | **F1 is two PRs**: F1a `linha-f1a-linha` (the screens and their addresses, the tokens, the linha; the header keeps today's date control) and F1b `linha-f1b-trilho` (the trilho, the single date, the Agenda, the avisos), both in Onda 1. | Each half is coherent alone (5); together they change about 85 existing tests (6), more than one review should hold. | One PR (the first version, and desenho-entrega's `linha-f1-casca`). |

## 2. How it works

### 2.1 The page after F1

```
body[data-role][data-perfil][data-backend][data-aberta="esc"][data-data="2026-11-11"][data-trilho="fixo|aberto|fechado"][data-forma?]
  a.pular[href="#conteudo"]                      handled in script: focus on main#conteudo, the address untouched
  svg[hidden]                                    sprite: + i-certo, i-exclamacao, i-andamento, i-trilho, i-grafico
  header.topo[data-regiao="topo"]                one row: brand · #btn-data · tools
    h1.topo-marca
    button#btn-data.topo-data-botao[aria-controls="trilho"][aria-expanded when not docked]
    div.hd-tools                                 #role-sel · #btn-open-log (#log-cnt) · a#btn-manual · div.menu-conta (unchanged)
  div.casca#casca
    div.avisos-do-app                            #aviso-sync, #aviso-link, #aviso-dados (ids and scripts unchanged)
    nav#linha.linha[aria-label="Navegação"][data-regiao="linha"][data-estado="aberta|recolhida"]
    aside#trilho.trilho[aria-label="Data e avisos"][data-regiao="trilho"][hidden when closed]
    main#conteudo[tabindex="-1"][data-regiao="tela"]   section#s-login, then the eleven section.tela (#s-esc.on …)
  aside.gaveta ×4 · dialog.dlg ×4 · #tl-pop · #toast-box · #anuncio · script[type=module]
```

- `body[data-aberta]` is the open screen, `body[data-data]` the open date, `body[data-trilho]` the trilho's presentation, `body[data-forma]` the open screen's frame. `data-tela` is not used: the TV page owns `body[data-tela]` (js/painel.js:44).
- New global attribute names: `data-regiao`, `data-estagio`, `data-tarefa`, `data-aviso`, `data-estado`, `data-nav`, `data-focar`, `data-forma`; `data-dia` is reused by the calendar. `data-t`, `data-go`, `data-manual`, `data-cal` and `data-delta` leave the page. `QUEM_E` (js/dom.js:171-174) gains `data-estagio`, `data-tarefa`, `data-aviso` and loses `data-cal`, `data-delta`; `DO_TIPO` loses `data-cal`.
- Two traps: test/unit/csp.test.js:67 also matches JavaScript such as `const onde = '…'` (any name starting with `on`, after a space, assigned a string); test/unit/glossario.test.js:32 checks every literal `data-dica="…"` of `index.html`, `js/*.js` and `js/views/*.js`. The shell uses no `data-dica`.

### 2.2 Screens, profiles and addresses

`js/telas.js` (pure, no DOM):

```js
export const TELAS = {   // rotulo: the word on the navigation, equal to the screen's title (D7)
  age:    { rotulo: 'Agenda',      estagio: 'pedidos',       perfis: TODOS },
  dem:    { rotulo: 'Demanda',     estagio: 'processamento', perfis: SEM_SECRETARIA },
  esc:    { rotulo: 'Escala',      estagio: 'escala',        perfis: TODOS },
  apr:    { rotulo: 'Aprovar',     estagio: 'aprovar',       perfis: TODOS, secao: 's-esc', item: 'aprovacao' }, // H: secao 's-apr', no item
  alu:    { rotulo: 'Alunos',      grupo: 'cadastros',       perfis: TODOS },
  ins:    { rotulo: 'Instrutores', grupo: 'cadastros',       perfis: TODOS },
  rec:    { rotulo: 'Recursos',    grupo: 'cadastros',       perfis: SEM_SECRETARIA },
  cur:    { rotulo: 'Cursos',      grupo: 'cadastros',       perfis: TODOS },
  rod:    { rotulo: 'Rodízio',     grupo: 'mais',            perfis: SEM_SECRETARIA },
  bi:     { rotulo: 'BI',          grupo: 'mais',            perfis: SEM_SECRETARIA },
  manual: { rotulo: 'Manual',      grupo: 'topo',            perfis: TODOS },
  conta:  { rotulo: 'Minha conta', grupo: 'conta',           perfis: TODOS, soCompartilhado: true }
};
export const ESTAGIOS = ['pedidos', 'processamento', 'escala', 'aprovar'];  // the four cards, in order
export const podeVer = (tela, perfil) => …          // perfil null (local mode): every screen but conta
export const telaDeAbertura = perfil => (perfil === 'secretaria' ? 'age' : 'esc');
export const dataDeAbertura = ({ pedida, perfil, amanha, primeiraAberta }) => …  // → { data, aviso: 'domingo' | 'invalida' | null } (D22)
export const destinoDoEndereco = hash => …          // '#/alu/1012' → { tela: 'alu', item: '1012' }; '#/apr' → { tela: 'apr', item: null }; else null
export const enderecoDoDestino = ({ tela, item }) => …  // the inverse
export const classeDaLargura = largura => …        // 'estreita' < 1,024 ≤ 'media' < 1,280 ≤ 'larga'
export const trilhoFixo = (classe, guardado) => …  // guardado = the parsed acpm_trilho; default: larga fixo, media solto, estreita never
export const linhaAbertaPorPadrao = (larguraDaLinha, alturaDaJanela) => larguraDaLinha >= 1540 && alturaDaJanela >= 760;
export const lerPreferencias = texto => …          // JSON of acpm_trilho; anything else → {}
```

- `item` grammar: `/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,39}$/`: a roster id, a matrícula (`PR-VOB`), a pedido id, a place of H (`fora-1012_0_1`, `conflito-1012_0_1`, `restricoes-da-data`) or of D (`aguardando`). Never a name (a space or an accent is refused).

What each profile sees (today's rule of css/app.css:184-188, plus Aprovar):

| | Operador, Administrador | Gestor | Secretaria | Local mode |
|---|---|---|---|---|
| Cards | Agenda, Demanda, Escala, Aprovar | the same, read-only | Agenda, Escala, Aprovar | all |
| Cadastros | Alunos, Instrutores, Recursos, Cursos | the same | Alunos, Instrutores, Cursos | all |
| Rodízio, BI, "Histórico" | yes | yes | no | yes |
| "Manual" | yes | yes | yes | yes |
| Account menu | Minha conta (Usuários: Administrador), theme, Sair | the same | the same | the theme only |
| "ainda não importados" (row and aviso) | yes | no | no | Operador of `#role-sel` |

`js/endereco.js` (F1 creates it; F2 adds its `sel` functions, desenho-lista 2.2):

```js
export function lerEndereco()                   // → { hash, data: the ?data= text }
export function empilharTela(destino)            // first saves scrollY in the current entry's history.state.rolagem, then pushState('#/…')
export function substituirTela(destino)          // replaceState('#/…'), history.state kept
export function escreverDataNoEndereco(data)     // the address half of abrirData (js/actions.js:24-29): ?data= by replaceState; the hash and the other parameters stay
export function limparTelaDoEndereco()           // replaceState without the fragment ("Sair")
```

All five run inside `try`, as `abrirData` does today (a page in an iframe cannot change the address).

`js/views/telas.js` (DOM) replaces `js/views/tabs.js`:

```js
export function registrarTela(id, { aoMostrar = () => {} } = {})   // called by the event module of each screen when it is evaluated
export async function mostrarTela(id, { item = null, historico = 'empilhar', focar = false, rolagem = null } = {})
export const telaAberta = () => …
export const telaFoiEscolhida = () => …         // replaces abaFoiEscolhida (js/eventos/navegacao.js:16-17)
export function ligarEndereco()                 // the listeners below; js/main.js calls it once
export function destinoDoHash(hash)             // destinoDoEndereco, or { tela, item: id, nativo: true } for the id of an element inside a tela
```

`mostrarTela`, in order:
1. A screen the profile cannot see becomes `telaDeAbertura(perfil)` and its item is dropped. A counter marks this navigation; a later one wins after every `await`.
2. The address: `'empilhar'` → `empilharTela`; `'substituir'` → `substituirTela`; `'nenhum'` (it came from the address) → nothing.
3. `.on` on one `main#conteudo > section.tela` (`TELAS[id].secao ?? 's-' + id`); `body[data-aberta]`; `body[data-forma]` from the section's `data-forma`.
4. `aria-current="page"` on the screen's one `[data-nav]` link: a card title, a Cadastros link, Rodízio, BI or `#btn-manual`; none for `conta`, as today.
5. `await aoMostrar(item ?? TELAS[id].item)`. These replace the special cases of `show` and of the click listeners (js/views/tabs.js:25-27; js/eventos/navegacao.js:25-26; js/eventos/topo.js:97-111): `bi` → `rBI(); carregarBI()`; `cur` → `rCursos()`; `rod` → `rRodizio()`; `age` → `agendaAberta = true; lerPedidosDaData(); rAgenda()`; `conta` → `await abrirConta()` and, for the item `usuarios` and an Administrador, the place `#usuarios`; `apr` → D31; `manual` → the place `#<item>`.
6. Scroll: `rolagem` (Back and Forward) → `scrollTo(0, rolagem)`; an item that names an element of the section (or a place the screen returned) → `scrollIntoView({ block: 'start' })`; else `scrollTo(0, 0)`. Native in-screen anchors (`nativo`) are left to the browser.
7. Focus, when `focar`: the item's element or the section's title (`focarNoTitulo`, js/dom.js:300-305).
8. A one-shot item (one that is not `TELAS[id].item`): `substituirTela({ tela: id })`.
9. On the strip, the open link comes into sight (`mostrarNaFaixa`, moved from js/views/tabs.js:8-14, on `#linha`).
10. `escreverDataNoEndereco(DATA)`.

Who moves the focus (`data-focar`): the row links, the aviso links, "Abrir a Demanda", "Como funciona o rodízio", `#btn-manual`, `#btn-conta`, `#btn-usuarios` (today's behaviour of js/eventos/topo.js:97-111 and js/eventos/navegacao.js:28-30; pinned by acessibilidade.spec.js:379 and cadastros.spec.js:1486). The card titles, the Cadastros links, Rodízio and BI keep the focus on themselves, as the tabs do.

`ligarEndereco()`:
- A click on `a[href^="#/"]` with the main button and no modifier key: `preventDefault`; the person chose a screen; `mostrarTela(tela, { item, historico: 'empilhar', focar })`. On the link of the screen already open and with no item: `mostrarTela(tela, { historico: 'nenhum' })`, which reads the BI or the pedidos again, as a click on today's tab does. With a modifier key the browser opens a new tab with `#/tela` (the query, `?data=` included, is kept by the relative href).
- A click on `a.pular`: `preventDefault`; `main#conteudo.focus()`. The next Tab is inside the content (acessibilidade.spec.js:1072-1083 unchanged).
- `popstate` and `hashchange` share one handler: it reads `destinoDoHash(location.hash)`; when that is the screen already open with no item, it only writes `?data=` back and restores `history.state.rolagem`; else the person chose a screen and `mostrarTela(…, { historico: 'nenhum', rolagem: history.state?.rolagem ?? null })`. Two events for one change (a fragment navigation fires both, inferred from browser behaviour) therefore run the screen once.
- `history.scrollRestoration = 'manual'` (the shell restores each entry's own `rolagem`).

The boot (js/main.js):
1. At the start, before the session: `ligarEndereco()`; a screen named in the address is shown at once (`historico: 'nenhum'`); the login covers it in shared mode.
2. After the session: `dataDeAbertura(…)` gives the date (D22), then `abrirData` and `lerData` as today.
3. Where js/main.js:131-135 are today: `mostrarTela(telaFoiEscolhida() ? telaAberta() : (destinoDoHash(location.hash)?.tela ?? telaDeAbertura(perfil)), { item, historico: 'substituir' })`. Any navigation made while the data loaded (a click, Back, an address typed) counts as chosen and wins; the call checks the profile again and reads the open screen's data now that they exist.
4. "Sair" (js/sessao.js:66-69) calls `limparTelaDoEndereco()` before reloading, so the next account opens on its own screen.

### 2.3 The linha

```html
<nav class="linha" id="linha" aria-label="Navegação" data-regiao="linha" data-estado="recolhida">
  <ol class="linha-estagios" id="linha-estagios">
    <li class="estagio" data-estagio="pedidos" data-estado="atencao">
      <a class="estagio-titulo" href="#/age" data-nav title="14 pedidos nesta data; 3 ainda não importados">
        <span class="estado" aria-hidden="true"><svg class="ico"><use href="#i-exclamacao"/></svg></span>
        <span class="estagio-nome">Agenda</span><span class="estagio-valor" aria-hidden="true">14</span>
        <span class="sr">: 14 pedidos nesta data, precisa de atenção: 3 ainda não importados</span>
      </a>
      <ul class="estagio-tarefas" hidden>
        <li><a class="tarefa" href="#/age" data-tarefa="registrados" data-focar>
          <span class="estado" aria-hidden="true">…</span><span class="tarefa-nome">pedidos da data</span>
          <span class="tarefa-valor">14</span><span class="sr">: feito</span></a></li>
        <li><a class="tarefa" href="#/age" data-tarefa="nao-importados" data-focar>…</a></li>
      </ul>
    </li>
    <!-- processamento (#/dem), escala (#/esc), aprovar (#/apr) -->
  </ol>
  <div class="linha-mais">
    <div class="linha-cadastros" role="group" aria-labelledby="linha-cadastros-titulo">
      <span class="linha-grupo" id="linha-cadastros-titulo">Cadastros</span>
      <a href="#/alu" data-nav>Alunos</a><a href="#/ins" data-nav>Instrutores</a>
      <a href="#/rec" data-nav>Recursos<span class="linha-selo atencao" aria-hidden="true">2</span><span class="sr">, 2 aviões parados ou perto da revisão de 50 horas</span></a>
      <a href="#/cur" data-nav>Cursos</a>
    </div>
    <span class="linha-sep" aria-hidden="true"></span>
    <a href="#/rod" data-nav>Rodízio</a>
    <a href="#/bi" data-nav><svg class="ico" aria-hidden="true"><use href="#i-grafico"/></svg>BI</a>
  </div>
  <button type="button" class="x linha-alternar" id="btn-linha" aria-expanded="false" aria-controls="linha-estagios"
    aria-label="Mostrar as tarefas das etapas"><svg class="ico" aria-hidden="true"><use href="#i-baixo"/></svg></button>
</nav>
```

- The four `li.estagio`, their title links and the secondary links are static in `index.html`; `rLinha()` (`js/views/linha.js`) fills states, values, the `.sr` sentences and the rows with `trocarConteudo` (the focus survives a redraw), and sets `hidden` on what the profile does not have (`podeVer`). Recolhida: the `ul.estagio-tarefas` are `hidden`; `#btn-linha` says "Mostrar as tarefas das etapas" with `aria-expanded="false"`.
- States, one vocabulary for cards, rows and the adapter of H: `feito` (disc `--ok`, `i-certo`, said "feito"), `falhou` (`--er`, `i-fechar`, "falhou"), `atencao` (`--wa`, `i-exclamacao`, "precisa de atenção"), `andamento` (`--an`, `i-andamento`, "em andamento"; F1's rows never emit it, H adds the two waits), `pendente` (a hollow ring `--pe`, "pendente"), `nenhum` (no icon, nothing said). The shape differs in every state, so colour is never the only sign.
- A card: `--pn` on the page's `--bg`, 1 px `--ln`, radius 8 px; the open one has a 2 px `--ac` border (5.72:1 on `--bg` light, 7.22:1 dark, computed). Title row 44 px; rows 28 px (44 px at 640 px and below). Each card is a container (`container-type: inline-size`): its value shows from 180 px of card width; a name never takes an ellipsis in the title row (the value gives way first).
- Dots: `#linha .estagio::before, #linha .estagio::after { box-sizing: border-box; width: 12px; height: 12px; border-radius: 50%; background: var(--mu); border: 3px solid var(--ln2); top: 16px }`, at `left: -6px` and `right: -6px`. Line: `#linha .linha-estagios { background: linear-gradient(var(--ln2), var(--ln2)) left 21px / 100% 2px no-repeat; column-gap: 24px; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr) }`. The dot is centred at 22 px, the line runs 21 to 23 px.
- Layout by the linha's own width (`container-name: linha`; numbers computed, pinned in casca.spec.js):

| Linha width | Recolhida | Aberta |
|---|---|---|
| from about 1,540 px | one row: cards, the secondary links, `#btn-linha` | one row |
| about 1,200 to 1,539 px | one row (card values hidden below 180 px of card) | cards in one row; the secondary links and `#btn-linha` on a second line |
| 700 to about 1,199 px | cards in one row; the secondary line under them | the same, with the rows |
| below 700 px | one strip that scrolls sideways: stage chips (state and name, 44 px), a divider, the Cadastros links, Rodízio, BI; no `#btn-linha` | not offered |

Where the content comes from, `js/linha-do-dia.js` (pure; the contract H consumes, desenho-escala-aprovar 2.8):

```js
/** contexto: { S, RES, pedidos: lista | null, leituraDosPedidos: 'lendo' | 'erro' | 'lidos', perfil, opera, data, hoje } */
export function linhaDoDia(contexto)        // → [{ id, estado, valor, dica, tarefas: [{ id, rotulo, estado, valor, dica?, destino: { tela, item? } | null }] }]  one per ESTAGIOS id
export function selosDosCadastros(contexto) // → { rec?: { valor, estado, dica } }
export function avisosDaData(contexto)      // → [{ id, gravidade: 'erro' | 'aviso' | 'info', minuto: number | null, duracaoMin?, titulo, texto, destino: { tela, item? } | null }]
```

- `contextoDoDia()` (`js/views/linha.js`) is the only reader of `S`, `RES`, `DATA`, the pedidos cache and the profile; the linha and the trilho call it once per redraw. H extends it (its `sessao`); D and G add their fields.
- A card's **value has a fixed meaning per card** (its `dica` and `.sr` sentence name it); a card's **state is the worst of its rows** (`falhou`, `atencao`, `andamento`, `pendente`, `feito`; `nenhum` takes no part; all `nenhum` → `nenhum`). The row's sentence is in the link's accessible name (`.sr`) and in `title`, never in `title` alone.

F1's rows (H keeps the ids where its table has them, desenho-escala-aprovar 2.9). P = the date's pedidos not cancelled; N = those not in `S.importadas`; R = `RES.tot`; F = `err` alerts; C = `conf`; W = `warn`:

| Card (its value) · row `id` "rótulo" | Value | `feito` | `falhou` | `atencao` | `pendente` | `nenhum` | Destino | Who |
|---|---|---|---|---|---|---|---|---|
| Agenda (P, "pedidos nesta data") · `registrados` "pedidos da data" | P | P ≥ 1 | the read failed | — | P = 0 | — | `age` | all |
| · `nao-importados` "ainda não importados" | N | N = 0, P ≥ 1 | the read failed | N ≥ 1 | — | P = 0 | `age` | who operates the escala |
| Demanda (R, "missões pedidas") · `recursos` "recursos disponíveis" | "17 de 19" | otherwise | none available | an available aircraft stopped or under 5 h (the rule of js/views/selos.js:26-28) | empty fleet | — | `rec` | who sees the card |
| · `invas` "instrutores que vêm" | "9 de 11" | otherwise | nobody comes, R ≥ 1 | the instructors' hours not read | no instructor | nobody comes, R = 0 | `ins` | who sees the card |
| Escala ("19 de 21", "na escala") · `montada` "escala montada" | "19 de 21" | F = 0, R ≥ 1 | F ≥ 1 | — | R = 0 | — | `esc` | all |
| · `conflitos` "conflitos e avisos" | C + W | R ≥ 1, C + W = 0 | C ≥ 1 | W ≥ 1 | R = 0 | — | `esc` | all |
| Aprovar ("18:05" or "—") · `aprovada` "aprovada às 18:05 por Operador 01" / "não aprovada" | "18:05" | `S.aprovacao` | — | not approved and the hours not read | not approved, R ≥ 1 | R = 0 ("nenhum voo") | `apr` | all |

- `selosDosCadastros`: `rec` with `valor` = today's `#selo-rec` count (js/views/selos.js:26-30), `estado: 'atencao'` above zero, `dica` "2 aviões parados ou perto da revisão de 50 horas"; nothing at zero. H may add others (for example "N sem peso" on Alunos).

### 2.4 The frame

```css
:root { --teto: 1612px; --trilho: clamp(280px, 22vw, 320px); --vao: 12px; }
.casca { max-width: var(--teto); margin: 0 auto; padding: 16px 16px 60px; display: grid; grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "avisos" "linha" "trilho" "tela"; column-gap: var(--vao); align-items: start; }
.avisos-do-app { grid-area: avisos; }  #linha { grid-area: linha; }  #trilho { grid-area: trilho; }  main#conteudo { grid-area: tela; min-width: 0; }
main#conteudo > section { display: none; }  main#conteudo > section.on { display: block; }
@media (max-width: 1023px) { #trilho { margin-inline: -16px; } }                        /* full-bleed panel: 320 = 7 × 44 + 12 */
@media (min-width: 1024px) {
  body[data-trilho="fixo"] .casca { grid-template-columns: minmax(0, 1fr) var(--trilho);
    grid-template-areas: "avisos avisos" "linha linha" "tela trilho"; }
  body[data-trilho="fixo"] #trilho { position: sticky; top: 12px; max-height: calc(100dvh - 24px); overflow-y: auto; }
  body[data-trilho="fixo"] .gaveta { right: calc(max(0px, (100% - var(--teto)) / 2) + 16px + var(--trilho) + var(--vao)); }
}
```

- The trilho is only in the `tela` row, so a tall trilho can only make that row taller; no band opens between the linha and the screen (review). casca.spec.js pins it: on an empty date, the distance from the bottom of `#linha` to the top of the screen is the same docked and not docked.
- `mostrarTrilho({ fixo, aberto, guardar })` (`js/views/trilho.js`) sets `body[data-trilho]`, `#trilho[hidden]` and `#btn-data`'s state. At load and when the window crosses 1,024 or 1,280 px (`matchMedia` listeners): `trilhoFixo(classeDaLargura(innerWidth), lerPreferencias(localStorage.acpm_trilho))`. An open painel do trilho closes when the class changes.
- Not docked, the painel do trilho sits between the linha and the content, the calendar (at most 320 px) on the left and the list beside it from 700 px of width, stacked below that.
- Drawers: the offset above is one formula over the cap and the trilho's width; a test pins the drawer's right edge to the trilho's left edge minus 12 px (2.13). For a fixed element the percentage is the viewport's width without the scrollbar (inferred).
- Stacking: the linha and the trilho have no `z-index`, so they stay under the tooltip (60), the menus (100), the map pop-up (150), the drawers (200 and up) and the toasts (lacuna-1-css-por-tela 7).
- Login: `body[data-login]` hides `#linha`, `#trilho` and `#btn-data` (today `#nav` and `.topo-data`, css/app.css:1553-1556); `.avisos-do-app` stays (`#aviso-link` shows on the login, index.html:113).
- Print: `header.topo, #linha, #trilho, .avisos-do-app, .gaveta, #tl-pop, .bar, main#conteudo > section:not(#s-esc), #toast-box { display: none !important }`, `main#conteudo > section#s-esc { display: block }`, `.casca { display: block; max-width: none }`. A detail pane with personal data is in a section that is not `#s-esc`, so it never prints.

The fixed-height mode (built in F1; used from F2 on):

```css
@media screen and (min-width: 800px) and (min-height: 600px) {
  body[data-forma="lista-detalhe"] { height: 100dvh; overflow: hidden; display: flex; flex-direction: column; }
  body[data-forma="lista-detalhe"] .casca { flex: 1; min-height: 0; width: 100%; padding-bottom: 16px;
    grid-template-rows: auto auto auto minmax(0, 1fr); }                                  /* avisos, linha, trilho (panel), tela */
  body[data-forma="lista-detalhe"] #linha { max-height: 40dvh; overflow-y: auto; }
  body[data-forma="lista-detalhe"] #trilho { max-height: 50dvh; overflow-y: auto; }      /* the panel */
  body[data-forma="lista-detalhe"] main#conteudo, body[data-forma="lista-detalhe"] main#conteudo > section.on { min-height: 0; height: 100%; }
}
@media screen and (min-width: 1024px) and (min-height: 600px) {
  body[data-forma="lista-detalhe"][data-trilho="fixo"] .casca { grid-template-rows: auto auto minmax(0, 1fr); }
  body[data-forma="lista-detalhe"][data-trilho="fixo"] #trilho { position: static; align-self: stretch; max-height: none; min-height: 0; overflow-y: auto; }
}
```

- Below 800 px wide or 600 px tall the document scrolls; F2's component then shows one view at a time in the document's flow.

### 2.5 The header

- One row at every width above 640 px: the brand, `#btn-data`, the tools. Today's grid and its three breakpoints stay (css/app.css:61-72, 193-214), with the `data` area holding `#btn-data`; the `abas` row goes. At 640 px and below, as today: brand and tools on the first row, `#btn-data` alone on the second, full width.
- `#btn-data` (310 px, fixed, so nothing moves when the date changes):

```html
<button type="button" class="topo-data-botao" id="btn-data" aria-controls="trilho" aria-expanded="false">
  <svg class="ico" aria-hidden="true"><use href="#i-calendario"/></svg>
  <span class="sr">Data da escala: </span><span id="dt-rotulo"></span>
  <span class="topo-data-rel" id="dt-rel" hidden></span>
  <span class="badge-cnt" id="avisos-cnt" hidden><span aria-hidden="true">3</span><span class="sr">, 3 avisos nesta data</span></span>
  <svg class="ico hd-seta" aria-hidden="true"><use href="#i-baixo"/></svg>
</button>
```

- Its name is its content ("Data da escala: quarta-feira, 11/11 amanhã, 3 avisos nesta data"). Not docked: a disclosure (`aria-expanded`); activating it opens the painel do trilho and moves the focus to the calendar's Tab stop. Docked: no `aria-expanded`; activating it moves the focus to the calendar's Tab stop.
- `#dt-rotulo` ("quarta-feira, 11/11"; "qua., 11/11" at 400 px and below, as today, css/app.css:91-97) and `#dt-rel` are written by the drawing registered on the moment `data-aberta` (2.11), never by `abrirData` itself. `#avisos-cnt` counts the avisos of gravidade `erro` or `aviso`; hidden at zero.
- `.hd-btn`, `.hd-sel`, `.hd-conta` and the 44 px rules (css/app.css:1586-1588) are unchanged; `.topo-data-botao` takes the place of `.topo-data-campo` in them.
- The focus ring: `a:focus-visible` joins the base rule of css/app.css:219-222; in the header it is white (css/app.css:225). In the strip it is drawn inside (`outline-offset: -4px`), as on today's tabs (css/app.css:176).

### 2.6 Widths

`.casca` padding 16 + 16, gap 12. F2's panes are its `minmax(280px, 5fr) minmax(360px, 8fr)` with an assumed 12 px gap (desenho-lista 2.10). All numbers computed; a classic scrollbar takes about 15 px more where the document scrolls.

**Option K, keep 1,280 px** (trilho 280 px, docked at every desktop width):

| Viewport | Side margins | Coluna | Lista | Detalhe | Trilho |
|---|---|---|---|---|---|
| 1,280 | 0 | 956 | 363 | 581 | 280 |
| 1,440 / 1,600 / 1,920 | 80 / 160 / 320 | 956 | 363 | 581 | 280 |

**Option M, cap 1,612 px, trilho `clamp(280px, 22vw, 320px)` (chosen):**

| Viewport | Trilho | Coluna, docked | Lista / Detalhe, docked | Coluna, not docked | Lista / Detalhe, not docked |
|---|---|---|---|---|---|
| 1,280 (docked by default) | 282 | 954 | 362 / 580 | 1,248 | 475 / 761 |
| 1,366 | 301 | 1,021 | 388 / 621 | 1,334 | 509 / 813 |
| 1,440 | 317 | 1,079 | 410 / 657 | 1,408 | 537 / 859 |
| 1,600 | 320 | 1,236 | 471 / 753 | 1,568 | 598 / 958 |
| 1,920 | 320 | 1,248 (today's) | 475 / 761 | 1,580 | 603 / 965 |

At 1,920 px docked the three panes are 30%, 48% and 20% of 1,580 px; at 1,280 px, 29%, 46% and 23% of 1,248 px. Below 1,024 px the trilho is the full-bleed panel (320 px on a 320 px phone).

What each wide screen needs, box included (mapa-casca 5.4; mapa-outras-abas 5.1), against the coluna:

| Screen | Needs | K: 956 | M docked: 954 | 1,021 | 1,079 | 1,236 and 1,248 | M not docked: 1,248 to 1,580 |
|---|---|---|---|---|---|---|---|
| Escala, Lista (760 + border) | 762 | fits | fits | fits | fits | fits | fits |
| Escala, map (720 + panel) | 750 | fits | fits | fits | fits | fits | fits |
| Painel (860 + frame) | 872 | fits | fits | fits | fits | fits | fits |
| Painel "Automático": one list in the page | board under 1,600 | yes | yes | yes | yes | yes | yes (at most 1,580) |
| BI, two tables side by side | 894 | yes | yes | yes | yes | yes | yes |
| Cursos, the editor's table | above 868 | fits | fits | fits | fits | fits | fits |
| Rodízio, four columns | 1,156 | three | three | three | three | four | four |
| Default tables (840 + border) | 842 | fit | fit | fit | fit | fit | fit |
| Escala toolbar in one row (until H moves the exports and "Compartilhar") | about 1,180 | two lines | two lines | two lines | two lines | one | one |
| Until C: the availability grid | 962 | scrolls 6 px in its box | scrolls 8 px | fits | fits | fits | fits |
| Until B: aircraft table beside the hangar | 954 | fits | at the limit | fits | fits | fits | fits |

Vertical space (computed): today the header is about 92 px (two rows) and the content starts at about 108 px. After F1 the header is about 54 px (one row): the content starts at about 126 px with the linha recolhida in one row, 166 in two lines, 190 aberta with F1's two rows per card (H's six-row Processamento card would make it about 302).

### 2.7 Panes and phones: the contract with F2

| Window | Screen | Who scrolls | Layout | Built by |
|---|---|---|---|---|
| any | wide (no `data-forma`) | the document | one block in the coluna | F1 |
| from 800 × 600 px | `data-forma="lista-detalhe"` | the panes and the trilho, each on its own; never the document | the section fills the coluna's height | F1 (frame), F2 (panes) |
| narrower or shorter | `data-forma="lista-detalhe"` | the document | F2's one view (`data-vista-md`) or two views in the flow | F2 |

- Inside the section: F2's `.md[data-md][data-vista-md]` with `[data-regiao="lista"]` and `[data-regiao="detalhe"]`, two columns from 720 px of content (desenho-lista 2.10).
- The selection: F2's `?sel=<lista>:<id>` (replaceState). A link that should open a record uses `#/alu/1012`: the shell calls `aoMostrar('1012')`, the Alunos controller selects it and writes `?sel=`, the shell rewrites the hash to `#/alu`. One place holds the selection.
- One view: F2's `empilharDetalhe` pushes an entry with the same address; "‹ Alunos" calls `history.back()` when the entry on top is the one pushed, else only switches the view (desenho-lista 2.10). The shell's listener sees the same screen and only rewrites `?data=`.
- The 44 px rules stay keyed on the viewport and the pointer (lacuna-1-css-por-tela implication 12).

### 2.8 The trilho

```html
<aside class="trilho" id="trilho" aria-label="Data e avisos" data-regiao="trilho" data-mes="2026-11">
  <div class="trilho-cab">
    <h2 class="trilho-mes" id="cal-mes" aria-live="polite">Novembro de 2026</h2>
    <button type="button" class="x" id="cal-mes-ant" aria-label="Mês anterior"><svg class="ico" aria-hidden="true"><use href="#i-esquerda"/></svg></button>
    <button type="button" class="x" id="cal-mes-prox" aria-label="Próximo mês"><svg class="ico" aria-hidden="true"><use href="#i-direita"/></svg></button>
    <button type="button" class="x" id="btn-fixar-trilho" aria-pressed="true" aria-label="Fixar o calendário ao lado da tela"><svg class="ico" aria-hidden="true"><use href="#i-trilho"/></svg></button>
    <button type="button" class="x" id="btn-fechar-trilho" aria-label="Fechar o calendário" hidden><svg class="ico" aria-hidden="true"><use href="#i-fechar"/></svg></button>
  </div>
  <table class="cal" id="cal" role="grid" aria-labelledby="cal-mes">
    <thead><tr><th scope="col" aria-label="domingo">D</th><th scope="col" aria-label="segunda-feira">S</th>…</tr></thead>
    <tbody><tr><td role="gridcell"><button type="button" class="cal-dia aberta" data-dia="2026-11-11" tabindex="0"
      aria-current="date" aria-label="quarta-feira, 11 de novembro de 2026, amanhã, data aberta: 3 pedidos">11<span class="cal-qtd" aria-hidden="true">3</span></button></td>…</tr></tbody>
  </table>
  <div class="trilho-avisos" role="region" aria-labelledby="trilho-data">
    <h2 class="trilho-data" id="trilho-data">Amanhã · quarta-feira · 11 de novembro</h2>
    <ol class="avisos-da-data" id="avisos-da-data">…</ol>
    <p class="h" id="avisos-vazio" hidden>Nada a resolver nesta data.</p>
  </div>
</aside>
```

- `#btn-fixar-trilho` shows from 1,024 px; `#btn-fechar-trilho` only on the painel do trilho (a touch target for closing it).
- The calendar (`semanasDoMes`, `diaDaTecla`, `paradaDoTab`, `descricaoDoDia`, `linhaDaData`, `somarMeses` and `nomeDoMes` are pure, in `js/calendario.js`; the grid is whole weeks, Sunday first, six rows at most, as `gradeDoMes` builds it today, js/views/agenda.js:48-54). Each day button is 44 × 44 px below 1,024 px; docked it is a seventh of the trilho less its padding (about 37 to 42 px, computed).

| Day | Look | Said, after the full date | Click, Enter or Space |
|---|---|---|---|
| a day of the month shown | the number, `--ink` | (nothing) | opens the date |
| today (`hojeISO()`) | filled circle `--ac`, number `--acT` (6.44:1 light, 7.22:1 dark) | ", hoje" | opens it |
| tomorrow | as any day | ", amanhã" | opens it |
| the open date (`DATA`) | 2 px ring `--ac` (6.44:1 and 6.43:1 on `--pn`); class `aberta`; `aria-current="date"` | ", data aberta" | nothing |
| today and open | the circle with the ring outside it | both | nothing |
| a day of the month before or after | `--mu` (5.48:1, 6.16:1); class `fora`; the 1st carries a small "dez" | (nothing) | opens it; the calendar goes to its month |
| a Sunday | `--mu`; class `domingo`; `aria-disabled="true"` | ", domingo: o aeroclube não opera" | the toast of D16; the date stays |
| a day with pedidos | `span.cal-qtd` at the top right, `--acT` on `--ac` (on today's circle, `--ac` on `--pn`); "99+" above 99 | ": 3 pedidos" | (as the day) |
| the date being opened | class `abrindo`, `aria-busy="true"`, a ring that turns (still under `prefers-reduced-motion`) | ", abrindo" | (nothing) |

Keys, with the focus in the grid (moving past an edge changes the month shown and keeps the focus on the target day):

| Key | Focus goes to |
|---|---|
| ←, → | the day before, the day after |
| ↑, ↓ | the same weekday of the week before, after |
| Home, End | the Sunday, the Saturday of the week |
| PageUp, PageDown | the same day of the month before, after (its last day when it is shorter) |
| Esc | not docked: closes the panel and focuses `#btn-data` (the pattern of `fecharNoEsc`, js/dom.js:67-78); docked: focuses `#btn-data` |

The Tab stop (`paradaDoTab(semanas, { aberta, hoje })`): the open date when it is in the weeks shown, else today when shown, else the 1st of the month shown.

Changing the date (`js/eventos/trilho.js`, the only caller of `carregarData` after the opening):
1. `escolherData(dia)`: nothing when `dia === DATA`; a Sunday or an invalid date is refused; every profile may (D19). The day gets `abrindo` and `#trilho-data` reads "Abrindo quinta-feira, 12/11…".
2. `carregarData(dia)` (js/actions.js:321-328, with F0b's registry). `lerData` keeps "one date at a time" and the refusal of changes while a date opens (js/actions.js:154-158, 288-317): until the data arrive, `DATA`, the ring, the list and `#dt-rotulo` stay on the date before.
3. `abrirData(dia)` (js/actions.js:21-41) becomes: `setData`, `escreverDataNoEndereco`, `body[data-data]`, `redesenhar('data-aberta')`. Who draws on that moment, from memory only: the header's label, the trilho's calendar (its month becomes the date's), the BI's `#bi-dt`.
4. Success: `anunciar('Data aberta: quinta-feira, 12/11')`. Not docked: the panel closes and the focus returns to `#btn-data`. Docked: the focus stays on the day.
5. Failure: the mark leaves and the toast is today's, `Não foi possível abrir essa data. Verifique a conexão e tente de novo.` (js/eventos/topo.js:42).

The month arrows change only the month shown (`mesVisivel`, a module variable) and read its numbers; the month returns to the open date's at every date change and every time the panel opens.

Numbers on the days: `ApiClient.contagemDaAgenda(de, até)` → `{ 'AAAA-MM-DD': n }` for the weeks shown. F1 implements it in `js/storage.js` over `this.agenda(de, até)` (not cancelled, per day). Read first on the moment `dados` of the first date read (never before the session), then when the month shown changes, when the panel opens, when the Agenda opens, and after this browser registers or cancels; the open date's own number follows the date's rows. Drawn even while the trilho is hidden. A failed read shows no numbers.

The list:

```html
<li class="aviso erro" data-aviso="conf:1012_0_1"><a class="aviso-link" href="#/esc" data-focar>
  <span class="aviso-hora"><time>08:20</time><small>1 h</small></span><span class="aviso-barra" aria-hidden="true"></span>
  <span class="aviso-corpo"><b class="aviso-titulo">Aluno 03 · Voo Local</b><small class="aviso-texto">Conflito: o PR-VOB está em manutenção.</small></span>
  <span class="sr">, erro</span></a></li>
<li class="aviso aviso" data-aviso="recursos"><div class="aviso-corpo">…</div></li>       <!-- destino null: no link -->
```

F1's first body of `avisosDaData` (H replaces it with its own, desenho-escala-aprovar 2.8 and 2.10):

| Item | Source | Gravidade | Time | Title / second line | Destino |
|---|---|---|---|---|---|
| each rejection, conflict and warning of the engine | `RES.al` (`err`, `conf` → `erro`; `warn` → `aviso`) | as said | the flight's `a` when `fKey` is in `RES.out` | `a.s` / `a.m` | `esc` |
| aircraft stopped or near the inspection | the `#selo-rec` rule | `aviso` | none | "2 aviões parados ou perto da revisão de 50 horas" | `rec` (null for the Secretaria) |
| pedidos not imported (who operates) | P and `S.importadas` | `aviso` | none | "3 pedidos da agenda ainda não estão na demanda" | `age` |
| the pedidos could not be read | the cache's error | `aviso` | none | "Não foi possível ler os pedidos desta data." | `age` |
| data not read | each entry of `S.indisponiveis` | `erro` for `horas`, else `aviso` | none | the text of `SEM_OS_DADOS` | null (the banner has "Tentar de novo") |

- Order: `erro`, `aviso`, `info`; inside each, the items with no time first ("—", with `.sr` "sem horário"), then by minute, then by `id`. The bar is `--er`, `--wa` or `--mu` (each at least 5.48:1 on `--pn`, computed).
- While a date opens the list stays on the open date's items; it is redrawn when the new date's data arrive. The list is not a live region (redrawn with `trocarConteudo`); the date change is announced (step 4).

### 2.9 One date: the rules

| Case | Today | After F1 |
|---|---|---|
| Who may change the date | everyone, except the local-mode Gestor in the header (not in the Agenda's calendar) | everyone |
| A Sunday | the header skips it; `?data=` opens Monday with a toast; the Agenda's calendar shows "não opera" for it | cannot be opened from the calendar (toast); `?data=` opens Monday with today's toast; "Data do pedido" lists no Sunday |
| The month arrows | in the Agenda, move its own day to the 1st and open nothing | only the month shown |
| After 13:00, the Operador opens the Agenda | the page shows the day after tomorrow; the app stays on tomorrow | the list shows the open date (tomorrow); the form's "Data do pedido" starts on the day after tomorrow, with its deadline sentence |
| After 13:00, the Secretaria opens the app (no `?data=`) | the Agenda on the first open date; the app on tomorrow | the whole app on the first open date |
| A `?data=` already closed for pedidos (a reload, a shared link, a tab left open) | the app on that date; the Agenda on the first open date | the app on that date, for every profile; the form starts on the first open date |
| `?data=` invalid | tomorrow, with the toast | the same |
| A reload | stays on the date | stays on the date and on the screen |
| Back and Forward | (one history entry) | change the screen, never the date (`?data=` written back) |
| The BI's "Data base" | its own, reset to the open date at each date change | the same |
| The date of a new pedido | the Agenda's own day | the form's "Data do pedido" |

### 2.10 The Agenda in F1

| Part | Today | After F1 |
|---|---|---|
| Rows of the page | `pedidos` of the month, by `carregarMes` (js/views/agenda.js:19, 65-74) | the open date's rows of the one cache: `lerPedidosDaData()` (js/views/selos.js:38-45) keeps `{ data, lista, erro }` instead of turning a failure into `[]`; `pedidosDaData()` returns it |
| The list (`#agenda-lista`) | the rows of `diaEscolhido` | the cache's rows when `data === DATA`; "Lendo os pedidos desta data…" while it is another date's; "Não foi possível ler os pedidos desta data. Verifique a conexão." on a failed read |
| `#agenda-data` | `diaEscolhido` | the open date |
| `rAgenda()` | returns until `diaEscolhido` is set (:187) | returns until the Agenda was opened once (`agendaAberta`, set by `aoMostrar('age')`) |
| The form's date | `diaDaAgenda()` (js/eventos/agenda.js:85) | `select#ag-data.agenda-campo` "Data do pedido": the operating days from today to today plus 14, and the open date when later; the Secretaria gets only the dates inside the deadline; each option "sex 20/11", with "(hoje)" or "(amanhã)" and "· prazo encerrado"; it starts on the open date when that date takes pedidos, else on `primeiraDataAberta()`; it goes back to that when the open date changes (desenho-pedidos decision 12 and 2.7). The options come from `datasParaRegistrar(hoje, dataAberta, { excecao })` in `js/agenda.js` (pure; D's name) |
| `#agenda-prazo`, the submit, `#ag-excecao` | follow `diaEscolhido` | follow "Data do pedido" |
| The local-flight limit and "já tem voo marcado" | `pedidosCarregados()` and `pedidosDoAluno(aluno, dia)` over the month cache | over the rows of the form's date: the cache when it is the open date; else one read `ApiClient.agenda(d, d)` when the field changes; without that read the two checks are skipped (the server still refuses the 7th, PT422) |
| After registering or cancelling | `carregarMes()` and `lerPedidosDaData()` (three reads into two caches) | `lerPedidosDaData()` and the counts of the weeks shown: two requests |
| Deleted | | `calendarioHTML`, `gradeDoMes`, `mudarMes`, `escolherDia`, `carregarMes`, `diaEscolhido`, `mesVisivel`, `pedidos`, `pedidosCarregados`, `diaDaAgenda`, `abrirAgenda`; the `[data-cal]` listener (js/eventos/agenda.js:17-27); `#agenda-cal` and its CSS |

D2 then moves the cache to `js/solicitacoes-da-data.js` under its own names and adds `diaMudou` and the timer (desenho-pedidos decision 14), and builds the rest of its page around the same field.

### 2.11 Redraws

F0b's registry is `js/redesenho.js` (`registrarDesenho(nome, desenhar, { em, ordem })`, `redesenhar(momento)`, `redesenharPorNome(...nomes)`, `desenhosRegistrados()`; moments `dados`, `consulta`, `releitura`, `escala`; an unknown moment is an error; desenho-entrega 2.2 a, revised). F1 adds the three moments that note already reserves for it, and these registrations:

| Moment (new in F1) | Who calls it |
|---|---|
| `data-aberta` | `abrirData` (memory only: no read) |
| `perfil` | `setRole` (js/actions.js:44-64), which stops touching the date control and calls `atualizarSeloDaAgenda` through this moment |
| `pedidos` | `lerPedidosDaData` after each answer (desenho-entrega 2.2 a; desenho-pedidos 2.5 calls it `solicitacoes`: the plan keeps `pedidos`, and D2's cache calls it) |

| Name | Draws | Moments | Order | Registered in |
|---|---|---|---|---|
| `rotulo-da-data` | `#dt-rotulo`, `#dt-rel` | data-aberta | 1 | `js/eventos/trilho.js` |
| `bi-data` | `#bi-dt.value = DATA` | data-aberta | 2 | `js/eventos/bi.js` |
| `linha` | `rLinha` | dados, consulta, releitura, escala, perfil, pedidos | 96 | `js/eventos/linha.js` (F1 creates it with the `#btn-linha` handler) |
| `trilho` | `rTrilho` (calendar, date line, list, `#avisos-cnt`; the first count read) | data-aberta, dados, consulta, releitura, escala, perfil, pedidos | 97 | `js/eventos/trilho.js` |
| `selos` (F0b's) | now only `#selo-rec-dia` and the text of `#importar-agenda` | dados, escala, perfil, pedidos | 99 | `js/eventos/topo.js` |
| `pedidos` (F0b's drawing, not the moment) | `rAgenda` | dados, pedidos | 95 | `js/eventos/agenda.js` |

### 2.12 Tokens and icons

Each token is written in the three token blocks (css/app.css:2-27, 33-41, 43-49; `css/base.css` after F0c, a file both pages load, so the TV gets the tokens and uses none), except the aliases, which are written once. All values are opaque, so `razaoDeContraste` reads them as the browser returns them. Figures computed with the WCAG formula; both reviews recomputed them and found them equal.

| Token (F1) | Light | Dark | For | Contrast, light / dark |
|---|---|---|---|---|
| `--okT` | `#FFFFFF` | `#0F1822` | glyph on `--ok` | 5.36 / 9.60 |
| `--waT` | `#FFFFFF` | `#0F1822` | glyph on `--wa` | 5.93 / 11.27 |
| (`--erT`, exists) | `#FFFFFF` | `#0F1822` | glyph on `--er` | 6.54 / 7.84 |
| `--pe` | `var(--mu)` | (alias) | the ring of "pendente" | on `--pn` 5.48 / 6.16 |
| `--an`, `--anT` | `var(--ac)`, `var(--acT)` | (alias) | "em andamento" | glyph 6.44 / 7.22; disc on `--pn` 6.44 / 6.43 |

- Status discs on a card (`--pn`): `--ok` 5.36 / 8.55, `--er` 6.54 / 6.98, `--wa` 5.93 / 10.04. Each new pair joins the list of acessibilidade.spec.js:1027; the focus-ring checks gain the linha (ring `--ac` on `--bg`: 5.72 / 7.22) and the trilho (on `--pn`: 6.44 / 6.43).
- Not added (F2's choice, desenho-lista decision 21: the selected row `--info-bg` with a 3 px `--ac` bar, `--mu` on it 4.81 / 4.78 after flattening; one avatar pair `--neutro-bg`/`--mu`). If Pedro wants hues (question 12), the pairs are ready: `--sel` `#EAF2FB`/`#1F3144` (`--ink` 13.63 / 11.24, `--mu` 4.86 / 5.14); `--avT` `#FFFFFF`/`#0F1822` on `--av1` `#1F5FA8`/`#8AB8F2` (6.44 / 8.70), `--av2` `#0B6E78`/`#62C3CC` (5.97 / 8.69), `--av3` `#6A4BB0`/`#B79CF0` (6.47 / 7.69), `--av4` `#A1387C`/`#F09AC8` (6.23 / 8.65), `--av5` `#4B5D6E`/`#A9B8C6` (6.80 / 8.82); none green, red or amber.
- Sprite (`index.html:26-53` only; the TV's sprite is not touched): F1 adds `i-certo` (a check without the circle), `i-exclamacao`, `i-andamento` (an open arc), `i-trilho` (a panel with a side column), `i-grafico` (bars, for BI); it uses `i-fechar` for "falhou" and `i-calendario`, `i-esquerda`, `i-direita`, `i-baixo`, `i-cima` as they are. A status disc is a CSS circle around a stroke icon (`.ico` forces `fill: none`, css/app.css:217). F2 adds its own (desenho-lista: `i-lixeira`).

### 2.13 Drawers, dialogs and pop-ups

| Thing | Verdict | When, and how |
|---|---|---|
| `#painel-instrutor` (Habilitações) | goes | C, with its Esc listener (js/eventos/cadastros.js:52-54) in the same commit |
| `#painel-dados` (Dados pessoais) | goes | each of A and C stops opening it for its screen; the second to merge deletes the `aside`, its code and its Esc listener (js/eventos/cadastros.js:33-35) |
| `#historico` | stays a drawer | a log, not a record; opened by `#btn-open-log`; to the left of a docked trilho (2.4). At 1,280 px docked it leaves about 514 px of the Escala in sight (today about 824). Not docked, it covers the right of the page as today; below about 780 px it also covers part of the painel do trilho, and on a phone all of it (the drawer is `min(440px, 100vw)`): she closes it (✕ or Esc) to reach the date, as today |
| `#painel-reparo` (Sugestões) | stays a drawer | it helps an action on a flight (desenho-escala-aprovar decision 2). The frame `.gaveta`, `abrirGaveta` and `gavetaDoEsc` (js/dom.js:42-59) stay for these two |
| `#dlg-agendar`, `#dlg-status`, `#dlg-painel`, `#dlg-sessao` | stay | actions and a setting, not records (posicao B4) |
| `#tl-pop` (flight details on the map) | stays | a flight on the map, not a cadastro record; question 11 |
| The account menu, the "Mais" menu, the tooltip, the toasts | stay | |
| The painel do trilho | new, in the page flow | a disclosure (`aria-expanded`, `aria-controls`), not a dialog |

### 2.14 After F1

At 1280×720 with nothing stored (the product default: the trilho docked, the linha recolhida in one row):

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ [águia] AutoEscala        [▦ quarta-feira, 11/11 (amanhã) 3 ▾]       Histórico 4   Manual   (OT) │ header.topo
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ (!) Agenda ●─● (✓) Demanda ●─● (✕) Escala ●─● (○) Aprovar │ CADASTROS Alunos Instrutores Recursos 2 Cursos │ Rodízio BI ⌄ │ nav#linha
│ ┌───────────────────────────────────────────────────────────────┐ ┌──────────────────────────┐ │
│ │ Escala do dia  [Lista|Por recurso|Por instrutor|Painel] + Agendar│ │ Novembro de 2026    ‹ › ▥ │ │
│ │ Categoria · Recurso · Buscar … Compartilhar CSV PDF Excel        │ │ D  S  T  Q  Q  S  S        │ │
│ │ (the toolbar on two lines until H)                               │ │ …  9 10 (11) 12 13 14      │ │
│ │ the Escala, 954 px                                                │ │ Amanhã · quarta · 11 de nov│ │
│ │                                                                   │ │ —     ▌ Horas dos instrut… │ │
│ │                                                                   │ │ 08:20 ▌ Aluno 03 · Voo Lo… │ │
│ └───────────────────────────────────────────────────────────────┘ └──────────────────────────┘ │
```

At 1920×1080 with nothing stored: the linha aberta in one row (each card with its rows), the Escala in 1,248 px, the trilho docked at its right. On a 390 px phone: the header (brand and tools; the date button on its own row), the strip, the screen; the date button opens the full-bleed panel above the screen. With the suite's seeded preferences (D28) every old test sees today's 1,248 px content.

What changes in a routine (clicks):

| Who · task | Today | F1, from 1,280 px (docked) | F1, below 1,280 px or undocked | Phone |
|---|---|---|---|---|
| Operador · another screen (stage, cadastro, Rodízio, BI) | 1 | 1 | 1 | 1 |
| · the next or the previous day | 1 (‹ ›) | 1 (the day) | 2 (date button, day) | 2 |
| · another day of the month | 2 (the label, the browser's picker) | 1 | 2 | 2 |
| · a day of another month | 3 or more | 2 (arrow, day) | 3 | 3 |
| · see what asks for attention | three numbers; open the Escala for the boxes | the cards' shapes, the Recursos badge, the list with times beside the screen, each item a link: 0 | the count on the date button; 1 for the list | 1 |
| · aircraft stopped or near the inspection | 1 (the badge on the Recursos tab) | 1 (the badge on the Recursos link) | 1 | 1 |
| · approve | scroll to the bar, 1 | 1 (the card), 1 (the button) | the same | the same |
| · reload after "recarregue" | back on the Escala; 1 to return | stays on the screen | stays | stays |
| · register a pedido after 13:00 | 1 (the Agenda opens on the day after) | 1 (the form starts on the day after) | 1 | 1 |
| · tomorrow's pedidos after 13:00 | 2 (the Agenda, then tomorrow in its calendar) | 1 | 1 | 1 |
| · Histórico, Manual, account menu | 1 | 1 | 1 | 1 |
| Secretaria · open the app and register | 0, then the form | the same | the same | the same |
| · tomorrow's escala after 13:00 | 1 (the Escala tab; the app is on tomorrow) | 2 (the Escala card, tomorrow in the trilho; the app opened on the first open date) | 3 | 3 |
| Gestor · another date in local mode | impossible in the header (possible through the Agenda's calendar) | 1 | 2 | 2 |

### 2.15 What this note gives to and assumes of the other topics

| Topic | This note relies on | This note gives |
|---|---|---|
| F0, `desenho-entrega` | F0a: `test/e2e/telas/casca.js` (`abrir` waiting for `body[data-pronto]`, `entrar`, `irPara`, `mudarData`, `diaSeguinte`, `diaAnterior`, `rotuloDaData`, `abrirMenuDaConta`, `abrirHistorico`) and `test/e2e/telas/invariantes.js` (`REGIOES`, `alvosPequenos`, `semNome`, `larguraDaPagina`, `percorrerTelas`), written on today's controls, with `test/unit/donos-dos-seletores.test.js`. F0b: the registry of 2.11, the save before the redraws, the split modules, `test/unit/eventos-ligados.test.js`. F0c: the stylesheets of its 2.2 f and `scripts/medir-estilos.mjs`, with `css/app.css` as the TV's five `@import` lines (desenho-entrega, revised, decisions 18 and 19) | the requirement on F0c (D29); the three moments; the change to its F1 row, which still says "open by default from 1,600 px of window" (this note's first version): docked from 1,280 px, and two PRs |
| F2, `desenho-lista` | `.md[data-md][data-vista-md]`, the two `[data-regiao]`, its 720 px container query, `?sel=`, `empilharDetalhe`, "‹ Alunos", no new token | `data-forma="lista-detalhe"` and the fixed-height frame; `mostrarTela(tela, { item })` and `aoMostrar(item)`; `js/endereco.js` to extend; `REGIOES` with the panes inside `main#conteudo > section.on` |
| H, `desenho-escala-aprovar` (revised) | its bodies of `linhaDoDia` and `avisosDaData` with the shapes above, plus its optional `tipo`, `grupo` and context fields; its `TELAS.apr` section `#s-apr`; its `data-vendo="ambos"` is F2's option or a plain two-region section | the module, the shapes, the states and their tokens; `contextoDoDia()`; `ESTAGIOS` (its "ETAPAS"); `TELAS.apr` opening the Escala at `#aprovacao` until H; Rodízio is a link of the secondary line, not an Escala card row |
| D, `desenho-pedidos` (revised) | its decision 12 (the field), 14 (the cache, moved in D2), 15 (the count function) | assumption S2 holds, and F1 also brings `select#ag-data`, `datasParaRegistrar` and the cache's read state, so D2 keeps them instead of creating them; the moment its cache calls is `pedidos` (its 2.5 says `solicitacoes`) |
| C | renames `TELAS.ins.rotulo` to "INVAs" and the row "instrutores que vêm" | |
| B | removes `#selo-rec-dia` and its writer; the Recursos link's badge keeps today's rule | |
| G (G2 in desenho-entrega) | renames `TELAS.dem` to "Processamento"; removes "ainda não importados" and the `#importar-agenda` writer | |
| I | the words "aba" and "abas" in identifiers (`ABAS_DO_GLOSSARIO`, the `aba` field, `#manual-abas`, `#manual-aba-rodizio`) | |

If the delivery note keeps `js/telas.js` and `registrarTela` for its registry, this note's table becomes `js/lugares.js` and `registrarLugar`; nothing else here changes.

## 3. Where each existing control goes

| Control today (label, id or attribute) | Destination | Kept, moved, replaced by or removed |
|---|---|---|
| "Pular para o conteúdo", `a.pular` | first Tab stop; target `main#conteudo` | kept; handled in script so the address keeps the screen |
| Logo and "AutoEscala", `h1.topo-marca` | header | kept |
| "Dia anterior", `#dt-ant`; "Próximo dia", `#dt-prox` | (none) | removed (F1b); replaced by the day buttons of the trilho, `button.cal-dia[data-dia]` |
| "Data da escala", `input#dt` in `label.topo-data-campo` | (none) | removed (F1b); replaced by the trilho's calendar |
| `#dt-rotulo`, `#dt-rel` | header, inside `button#btn-data` | kept (the name of the open date); `#dt-rotulo` loses `aria-live` (the change is announced through `#anuncio`) |
| "Perfil de acesso", `#role-sel` | header tools, local mode | kept; it no longer disables the date |
| "Histórico", `#btn-open-log`, `#log-cnt` | header tools | kept; the drawer opens to the left of a docked trilho |
| "Manual", `#btn-manual` | header tools | kept, now `a#btn-manual[href="#/manual"]`; the focus still goes to the Manual's title |
| Account menu, `#btn-menu-conta`, `#menu-conta`; "Minha conta" `#btn-conta`; "Usuários" `#btn-usuarios`; "Tema escuro" `#btn-theme`; "Sair" `#btn-sair` | header | kept (the two screens open by `#/conta` and `#/conta/usuarios`, shared mode only); "Sair" also clears the screen from the address |
| Tab "Escala", `[data-t="esc"]`, `#selo-esc` | linha, third card | replaced by the card "Escala"; the badge by its state, its value and the rows "escala montada" and "conflitos e avisos" |
| Tab "Demanda", `[data-t="dem"]` | linha, second card | replaced by the card "Demanda" ("Processamento" in G) |
| Tab "Agenda", `[data-t="age"]`, `#selo-age` | linha, first card | replaced by the card "Agenda" ("Pedidos" in D); the badge by the row "ainda não importados" |
| Tab "Recursos", `[data-t="rec"]`, `#selo-rec` | linha, secondary line | replaced by the link "Recursos" with the same badge (count, amber, spoken) |
| `#selo-rec-dia` (on "Disponibilidade do dia") | Recursos screen | kept until B |
| Tabs "Instrutores", "Alunos", "Cursos" | linha, secondary line, Cadastros group | replaced by the links ("Instrutores" becomes "INVAs" in C) |
| Tab "Rodízio", `[data-t="rod"]` | linha, secondary line, after the Cadastros | replaced by the link "Rodízio" |
| Tab "BI", `[data-t="bi"]` | linha, secondary line, last | replaced by the link "BI" |
| `span.aba-sep` | (none) | removed |
| "Recarregar" in `#aviso-sync`; "OK" in `#aviso-link`; "Tentar de novo" in `#aviso-dados` | `div.avisos-do-app`, top of `.casca`, full width | kept, moved out of `main` |
| "E-mail", "Senha", "Entrar"; "Sair" (no profile); "Enviar os dados deste navegador", "Começar sem eles" | `#s-login` | kept |
| "Abrir a Demanda", `[data-go="dem"]` | Alunos | kept until A, now `a.btn.quiet[href="#/dem"][data-focar]` |
| "Compartilhar", `#btn-share-link` | Escala's bar | kept in F1 (the link carries only the date: no fragment, no `sel`); moved by H |
| "Data base", `#bi-dt` | BI | kept |
| Agenda: "Mês anterior", "Próximo mês", the days (`[data-cal]`, `#agenda-cal`) | trilho | replaced by `#cal-mes-ant`, `#cal-mes-prox` and `button.cal-dia`; removed from the page (F1b) |
| Agenda: the closed day's dimmed look (`.fechado`) | form | replaced by the options of "Data do pedido" ("· prazo encerrado") and `#agenda-prazo` |
| Agenda: its own day (`diaEscolhido`) | form | replaced by "Data do pedido", `select#ag-data` (a field of the pedido, not a control of what the page shows) |
| "Fechar o histórico" ✕, "↶ Reverter", "Limpar o histórico desta data" | the Histórico drawer | kept |
| "Como funciona o rodízio", `a[data-manual]` | Rodízio | kept, now `a[href="#/manual/manual-aba-rodizio"][data-focar]` |
| Manual index, `nav.manual-indice a` | Manual | kept (native anchors; a reload returns to the place) |
| "Senha", "Entrar" in `#dlg-sessao` | dialog | kept |
| View switches (`data-vista-rec`, `data-vista-ins`, `data-tl`), the forms of Minha conta, "Excluir" | their screens | not applicable (other topics) |
| New: `#btn-data`, `#btn-linha`, the card and row links, the secondary links, `#cal-mes-ant`, `#cal-mes-prox`, `#btn-fixar-trilho`, `#btn-fechar-trilho`, the day buttons, the aviso links, `select#ag-data` | header, linha, trilho, Agenda | created by F1 |

## 4. Data-format steps and migrations

None. The shell stores nothing in the day or in the cadastro, and no SQL changes.
- No format number: 26 is F3's (desenho-entrega decision 7), not F0's or F1's.
- This browser only, read inside `try` as the theme is (js/eventos/topo.js:85-93): `localStorage['acpm_linha']` (`aberta` or `recolhida`) and `localStorage['acpm_trilho']` (JSON `{ "media": "fixo" | "solto", "larga": "fixo" | "solto" }`; anything else reads as nothing stored).
- `ApiClient.contagemDaAgenda` is client code over an existing read; D's migration (its count function) replaces the body.
- Deploy order for F1a and F1b: none beyond the merge (Onda 1). After the merge, open production's `painel.html` once (desenho-entrega 2.7), although F1 does not touch it.

## 5. Files created, changed and deleted, by step

**F0** (desenho-entrega's three PRs, every row starred: the delivery note specifies them; listed because F1 stands on them): F0a `linha-f0a-testes` (the drivers of 2.15, `prepararContexto`, the port, the lint in `npm test`); F0b `linha-f0b-costuras` (`js/redesenho.js` and its tests, the save before the redraws, `aoReverter`, the split modules, `test/unit/eventos-ligados.test.js`); F0c `linha-f0c-estilos` (the 14 stylesheets with `css/app.css` kept as the TV's four `@import` lines, `painel.html` byte-identical, `scripts/medir-estilos.mjs` as the gate). This note adds no commit to F0.

**F1a** (`linha-f1a-linha` → F3; Onda 1; three commits, each green):

| Commit | Created | Changed | Deleted |
|---|---|---|---|
| 1. `refactor: as telas têm nome e endereço` | `js/telas.js`, `js/endereco.js`, `js/views/telas.js`, `test/unit/telas.test.js` | `index.html` (class `tela` on the eleven screens; `div.casca`; `div.avisos-do-app` out of `main`; `main#conteudo[tabindex="-1"]`; "Abrir a Demanda" and "Como funciona o rodízio" as links); `css/casca.css` (D10; the cap still 1,280 px, now on `.casca`; the login and print rules); `css/base.css` (the bare `main` rule out); `css/tv.css` (`.tela-painel main`, the same declarations: the TV's census unchanged); `js/eventos/navegacao.js` (the `[data-t]` buttons call `mostrarTela`; the `data-go` and `data-manual` branches go); `js/eventos/topo.js` (Manual, Minha conta, Usuários through `mostrarTela`); `js/main.js` (the boot of 2.2); the event modules that own a screen (`registrarTela`); `js/eventos/escala.js:95-102` (`linkDaData` clears the fragment); `js/sessao.js:66-69` (`sair`); `test/e2e/app.spec.js:88` (`principalMax` reads `.casca`, still `1280px`) and `:67` (no `[data-go]` left) | `js/views/tabs.js` |
| 2. `feat: os tokens, os ícones e as regiões da casca` | | `css/base.css` (five tokens in three blocks; `a:focus-visible`); `index.html` (five symbols; `data-regiao` on `header.topo` and `main#conteudo`); `test/e2e/telas/invariantes.js` (`REGIOES`); `test/e2e/acessibilidade.spec.js` (the contrast list) | |
| 3. `feat: a linha de produção no lugar das abas` | `js/linha-do-dia.js` (`linhaDoDia`, `selosDosCadastros`), `js/views/linha.js` (`rLinha`, `contextoDoDia`), `js/eventos/linha.js`, `css/linha.css`, `test/unit/linha-do-dia.test.js`, `test/e2e/casca.spec.js` | `index.html` (`nav#linha`; the header in one row; the Manual's navigation texts, section 6); `css/casca.css` (the header; the Secretaria's rule keeps only `#btn-open-log`, `#btn-share-link`, `.ir-para-demanda`); `js/views/selos.js` (the three tab badges go); `js/views/telas.js` (`mostrarNaFaixa` on `#linha`); `js/actions.js` (`setRole` → `redesenhar('perfil')`); `js/redesenho.js` (moments `perfil`, `pedidos`); `js/glossario.js` (`curso-encerrado`); the four texts that say "aba" (`js/views/escala.js:597` with `index.html:373`, `js/views/demanda.js:112`, `js/eventos/demanda.js:38`, `js/engine.js:932`: "(aba Recursos)" → "(em Recursos)", text only, `node scripts/capturar-goldens-motor.mjs` leaves `test/fixtures/goldens-do-motor` unchanged); `test/e2e/telas/casca.js` (`irPara` clicks the visible link), `test/e2e/telas/invariantes.js` (`percorrerTelas` over the links); `README.md` | `nav#nav`, its buttons, separators and badges, and their CSS (css/app.css:165-180, 184, 186, 1554, 1588 in their F0c files) |

**F1b** (`linha-f1b-trilho` → F1a; Onda 1; three commits):

| Commit | Created | Changed | Deleted |
|---|---|---|---|
| 4. `feat: o trilho, com o calendário e a única data` | `js/calendario.js`, `js/views/trilho.js`, `js/eventos/trilho.js`, `css/trilho.css`, `test/unit/calendario.test.js`, `test/e2e/trilho.spec.js` | `index.html` (`#btn-data`; `aside#trilho`; the Manual's date texts, section 6); `css/casca.css` (the frame of 2.4: the cap 1,612 px, docking, the fixed-height mode, the full-bleed panel, print); `css/gavetas.css` (the drawer's offset when docked); `js/actions.js:21-41, 54-58` (`abrirData`; `setRole`); `js/endereco.js` (`escreverDataNoEndereco`); `js/eventos/topo.js` (the date part goes); `js/eventos/bi.js:16, 28`, `js/views/bi.js:33` (`#dt` → `DATA`; `#bi-dt` on `data-aberta`); `js/somente-leitura.js:6` (`#dt` out); `js/storage.js` (`contagemDaAgenda`); `js/dom.js:171-178`; `js/main.js` (`dataDeAbertura`; the Sunday toast from `js/eventos/trilho.js`); `js/redesenho.js` (moment `data-aberta`); `test/e2e/telas/casca.js` (`mudarData`, `diaSeguinte`, `diaAnterior`, `rotuloDaData`, `dataAberta`, `contagemDoDia`); `test/e2e/fixtures.js` (`prepararContexto` seeds the two preferences unless a test asks for none, option `preferencias`); `test/e2e/app.spec.js` (the cap `1612px`) | `.topo-data` with `#dt`, `#dt-ant`, `#dt-prox` and its CSS (css/app.css:77-105, 208, 242, 244, 1555, 1586-1587); `js/eventos/topo.js:23-63` (`avisoDeDomingo` moves to `js/eventos/trilho.js`) |
| 5. `feat: a Agenda segue a data aberta` | | `js/views/agenda.js`, `js/eventos/agenda.js` (2.10); `js/views/selos.js` (the cache keeps the error; `pedidosDaData()`); `js/agenda.js` (`datasParaRegistrar`); `index.html` (`#agenda-cal` out; `select#ag-data` in `#form-agenda`; the Manual's Agenda, section 6); `css/agenda.css` (the calendar's rules out: css/app.css:1147-1157, 1608, `.cal .dia` in 1587); `js/main.js:135` out; `test/unit/agenda.test.js`; `test/e2e/agenda.spec.js`, `test/e2e/agenda-compartilhado.spec.js` | `calendarioHTML`, `gradeDoMes`, `mudarMes`, `escolherDia`, `carregarMes`, `diaEscolhido`, `mesVisivel`, `pedidos`, `pedidosCarregados`, `diaDaAgenda`, `abrirAgenda`; the `[data-cal]` listener (js/eventos/agenda.js:17-27) |
| 6. `feat: os avisos da data no trilho` | | `js/linha-do-dia.js` (`avisosDaData`), `js/views/trilho.js` (the list, `#avisos-cnt`), `css/trilho.css`, their tests | |

`painel.html` is not edited in F0 or in F1: it keeps linking `css/app.css`, and its 58 tests are the guard.

**Later steps, in the shell's files** (one owner per step):

| Step | What it changes |
|---|---|
| F2 | `data-forma="lista-detalhe"` on its first screen; `js/endereco.js` (`sel`); `css/lista.css`; its sprite symbols; moves `iniciais` out of js/sessao.js:108-111 |
| F3, E | nothing |
| A | removes "Abrir a Demanda" and its rule (css/app.css:185) |
| B | removes `#selo-rec-dia` and its writer |
| C | `TELAS.ins.rotulo = 'INVAs'`; the row's label |
| D (D2) | `TELAS.age.rotulo = 'Pedidos'` with the screen; `ApiClient.contagemDaAgenda` by its function; the cache to `js/solicitacoes-da-data.js` (it calls the moment `pedidos`); its rows in `js/linha-do-dia.js` |
| G (G2) | `TELAS.dem` becomes Processamento; removes "ainda não importados" and the `#importar-agenda` writer, and with it the rest of `js/views/selos.js` |
| H | the bodies of `linhaDoDia` and `avisosDaData`; `TELAS.apr` gets `#s-apr`; "Compartilhar" |
| I | the words "aba" and "abas" in identifiers; `.aba-selo` if no badge is left |

## 6. Tests

**Written first** (each before the commit that makes it pass):

| File | What it pins |
|---|---|
| `test/unit/telas.test.js` (about 16) | `podeVer` for the four profiles and local mode (the table of 2.2; `conta` never in local mode); `telaDeAbertura`; `dataDeAbertura` (`?data=` wins for every profile, a Sunday → Monday, an invalid one → tomorrow, the Secretaria without `?data=` → the first open date); `destinoDoEndereco` accepts `#/alu`, `#/alu/1012`, `#/rec/PR-VOB`, `#/esc/fora-1012_0_1`, `#/apr` and refuses `#access_token=…`, `#/`, `#/xyz`, an item with a space, an accent or over 40 characters; `enderecoDoDestino` is its inverse; `classeDaLargura` at 1,023, 1,024, 1,279, 1,280; `trilhoFixo` defaults and stored values; `linhaAbertaPorPadrao`; `lerPreferencias` with bad JSON |
| `test/unit/calendario.test.js` (about 16) | `semanasDoMes` (months of four, five and six weeks; the year turn); `diaDaTecla` for the eight keys, at the grid's edges, on the 31st into a shorter month; `paradaDoTab` (open date shown; open date off the grid, today shown; neither); `descricaoDoDia` for each row of 2.8's table; `linhaDaData` ("Amanhã · quarta-feira · 11 de novembro", the year in another year) |
| `test/unit/linha-do-dia.test.js` (about 18) | each row of 2.3's table at zero and above zero, from fictitious `S`, `RES` and pedidos; a card's state is the worst, `nenhum` takes no part; each card's value keeps its meaning in every state; the Secretaria and the Gestor get no "ainda não importados"; `selosDosCadastros` at zero and above; `avisosDaData`: one item per alert, the flight's time by `fKey`, the order, `destino: null` for the Secretaria's aircraft item, the pedidos-not-read item |
| `test/unit/agenda.test.js` (plus about 4) | `datasParaRegistrar`: Sundays out, today to today plus 14, the open date when later, the Secretaria's dates inside the deadline, the starting date |
| `test/e2e/casca.spec.js` (about 32) | per profile, the cards, the Cadastros links, Rodízio and BI, each clicked; exactly one `aria-current="page"` on every screen, also on `#/apr` (the Aprovar card), Rodízio, BI and the Manual; Aprovar: the bar in view, the outline, the focus, the announcement; for the Gestor and on a date without flights, the title and the reason; the address follows, a reload stays, Back returns; screen, date, Back, reload: the same date; Back restores the scroll; a navigation during the load is kept (a click and Back); `#/dem` for the Secretaria and `#/conta` in local mode fall back; the skip link leaves the address; "Sair" leaves no screen in it; the shared link has no fragment; a `.etapa` tag in the Escala's list has no `::before` content; dots and line (computed styles of the pseudo-elements and the `ol`); the linha's default at 1920×1080 (aberta), 1280×720 (recolhida, one row, no card name cut) and 390×844 (the strip), and the remembered choice; the strip at 390 and 320 px scrolls inside itself, brings the open link into sight, 44 px targets; the Recursos badge spoken; the cap `1612px`; the Painel's one list at 1,920 px docked and not docked; the fixed-height frame with an injected two-region section (the document does not scroll, the section and the docked trilho do; below 600 px tall the document scrolls) |
| `test/e2e/trilho.spec.js` (about 32) | the days: today, the open date, tomorrow, the other months' days, a Sunday (the toast, the date stays); the numbers for the Operador, the Gestor and the Secretaria; with the fake server, no request to `solicitacoes` before the login; the keys of 2.8 and the one Tab stop in its three cases; `#btn-data` opens and moves the focus, or focuses the docked grid; a date opening (mark, ring, `body[data-data]`, `?data=`, the announcement), a failure (toast, nothing moves), a date chosen while the opening loads; docking by width (1,023, 1,024, 1,279, 1,280 px), "Fixar ao lado" remembered per class, the panel closing after a date and on Esc; the full-bleed panel at 320 px (seven 44 px days) and 390 px, no sideways scroll; the local-mode Gestor changes the date and nothing is saved; the Histórico's right edge is the trilho's left edge minus 12 px, and the date changes with it open; on an empty date the gap between `#linha` and the screen is the same docked and not docked; the list (items, order, links, the Secretaria's item without a link, the empty sentence, the pedidos-not-read item) |

**Existing tests that change in F1** (after F0a moved the direct uses behind the drivers):

| File | Tests, roughly | Why | Commit |
|---|---|---|---|
| `test/e2e/telas/casca.js`, `test/e2e/telas/invariantes.js`, `test/e2e/fixtures.js` | drivers | `irPara` clicks the link; `mudarData` and the date helpers on the trilho; `REGIOES` = `header.topo, #linha, #trilho:not([hidden]), main#conteudo > section.on`; the seeded preferences | 1, 3, 4 |
| `test/e2e/app.spec.js` | 8 of 11 (:5, :34, :51 ×3, :67, :79, :194) plus the Manual's phrases in :122 | the nine tab labels, `[data-go]`, the header date, `principalMax` (`.casca` and 1280px in commit 1, 1612px in commit 4), "As abas" | 1, 3, 4 |
| `test/e2e/acessibilidade.spec.js` | about 30 of 74 (:36, :108 ×2 and :147 ×2 with `:is(a[href], button, select)` and "at least 4", :175, :192, :210, :220, :228, :240 ×11 with `#btn-data` for the arrows, :263, :274 ×5 with links, :287 ×2, :547, :1052 ×2 for the "falhou" disc, :1085 for the announcement) | the roots, the header's controls, the 320 px loop, `aria-current`, the date label | 2, 3, 4 |
| `test/e2e/celular.spec.js` | 3 (:30, :49, :196) | the nine-tab loops become `percorrerTelas`; the strip | 3 |
| `test/e2e/selos.spec.js` | 5 of 5 | the badges become rows, values and the Recursos link's badge (`#selo-rec-dia` stays) | 3 |
| `test/e2e/agenda.spec.js` | 8 (:35, :41, :146 read `#agenda-cal … .qtd`; :164, :202, :211, :228, :238, :256) | the counts move to the trilho (`contagemDoDia`); the list on the open date, the form on its own date; the Sunday | 5 |
| `test/e2e/agenda-compartilhado.spec.js` | 5 (:40-47 the day chosen while loading, on the trilho; :49-77 the Secretaria's landing, her links, the closed day through `#ag-data`; :80-90 the Operador's exception through `#ag-data`; :101-122 the date helpers) | the Agenda's calendar and own day go | 3, 5 |
| `test/e2e/agendamento-mapa.spec.js` | 1 (:172) | "na aba Demanda" becomes "na Demanda" | 3 |
| `test/e2e/abertura.spec.js` | the date steps of 12 tests, through the drivers; :243, :290 by hand | the Agenda's calendar was a date control | 4, 5 |
| `test/e2e/perfis.spec.js` | 1 (:5) | the local-mode Gestor changes the date | 4 |
| `test/e2e/datas.spec.js`, `datas-compartilhado.spec.js` | 2 (:93 adjusted, :101 deleted with the field) and 1 (:157) | the empty date field no longer exists | 4 |
| `test/e2e/login.spec.js`, `envio-local.spec.js`, `dados-pessoais.spec.js` (:116), `seguranca.spec.js` (:95, :325), `historico.spec.js` (:44), `rodizio.spec.js` (:46-48), `cadastros.spec.js` (:1486), `publicado.spec.js` | 1 to 3 each | `#nav` at login; the Secretaria's links; the tab lists; `#dt-prox`; `data-manual`; `data-go`; the published site's selectors | 1, 3, 4 |
| `test/unit/telas-registradas.test.js`, `test/unit/donos-dos-seletores.test.js` (F0's) | lists | the three new moments; the shell's reserved selectors (`#linha`, `#trilho`, `#btn-data`, `.cal-dia`) | 3, 4 |
| `test/unit/manual.test.js`, `test/unit/glossario.test.js`, `test/unit/csp.test.js` | 0 | the group names and the page policy do not change | |

About 85 existing tests in all (about 40 in F1a, 45 in F1b). Not changed, and guards of F1: the 58 tests that open `painel.html` (lacuna-2-exportacoes-que-a-tv-usa 6.1); `test/e2e/painel-missoes.spec.js:103` (with the seeded recolhida linha); `cursos.spec.js:1595` and `acessibilidade.spec.js:462` (the window still scrolls on wide screens); `acessibilidade.spec.js:379` (the Manual takes the focus) and `:1072` (the skip link); `compartilhado.spec.js:289` (the link carries only the date); `agenda-compartilhado.spec.js:22-38` (the Secretaria who opened Alunos, the Manual or Minha conta while the data loaded stays there).

**The Manual, the glossary and the README, in the same commits (the tests force them):**
- Commit 3 (navigation): `index.html:435` and `:472-474` ("As abas" becomes "As telas"; the ids stay until I; the nine `h4` in the linha's order: Agenda, Demanda, Escala, Alunos, Instrutores, Recursos, Cursos, Rodízio, BI); `:454` ("em qualquer aba" → "em qualquer tela"); `:456` (the numbers beside the tabs → the cards' states and values, the Recursos link's number, the avisos of the trilho; "cujo botão mostra o mesmo número" kept for `#selo-rec-dia`); `:465` ("nessa aba" → "nessa tela, na primeira data que ainda aceita pedidos"); `:469` ("sem sair da aba" → "sem sair da tela"); `:500` ("na aba Cursos" → "em Cursos"); `:511` ("na barra da aba" → "na barra da tela"); `:534` ("nas duas abas" → "nas duas telas"); `:538` ("a aba mostra" → "a tela mostra"); `:588` ("da aba Instrutores" → "de Instrutores"); `js/glossario.js` `curso-encerrado` ("na aba Cursos" → "em Cursos").
- Commits 4 and 5 (the date and the Agenda): `:445` (step 1: the date button and the calendar beside the screen, instead of "as setas ‹ ›" and the browser's calendar); `:595` ("na aba Escala; para outro dia, use as setas ou o calendário da data no topo" → the Escala and the calendar); `:504-505` (the Agenda "com um calendário" → the list of the open date and "Data do pedido"). The sentences that say "a data aberta no topo" (`index.html:165, 505, 510, 524`; `vem-nesta-data`) stay: the open date is still named at the top.
- README "Estrutura": the rows of `index.html`, `css/`, `js/views/`, `js/eventos/` and `js/actions.js`, and new rows for `js/telas.js`, `js/endereco.js`, `js/linha-do-dia.js`, `js/calendario.js`, `js/views/telas.js`, `js/views/linha.js`, `js/views/trilho.js`, `js/eventos/linha.js`, `js/eventos/trilho.js`.

## 7. Departures from Pedro's request

| The request says | This design does | Why | Pedro can choose instead |
|---|---|---|---|
| "Three panes on every screen" | the Escala, Cursos, BI, the Rodízio, the Manual, Minha conta and every old screen until its step are one block beside the trilho; list and detail exist inside a list–detail screen (F2) | their minimum widths (2.6) do not fit a 48% pane | three panes there too, with their tables scrolling sideways |
| The panes are about 30%, 48% and 22% | so from 1,280 px with the trilho docked (29/46/23 at 1,280, 30/48/20 at 1,920); below 1,280 the trilho opens on demand | 954 px is the narrowest coluna every screen fits (2.6) | docked from 1,600 px only; or never by default |
| "The page is capped at 1,280 px today" | the cap becomes 1,612 px | D11 | keep 1,280 (option K) |
| F1 holds "the three-pane layout" | F1 builds the frame (the docked trilho, the fixed-height mode); the list and detail panes come with F2 | no screen is a list before F2 (D14) | |
| The pipeline is cards with their sub-task rows | the rows fold away; folded by default unless the linha fits in one row and the window is at least 760 px tall; always folded on phones | open, the linha takes 82 px more than today's tabs on every screen; folded, 18 (D4, 2.6) | always open |
| The stages are Pedidos, Processamento, Escala, Aprovar | F1 shows Agenda, Demanda, Escala, Aprovar; D and G bring the names with their screens | one vocabulary per screen at every merged step (D7) | the final names from F1 |
| The calendar "is the app's only date control" and replaces `.topo-data` and the Agenda's calendar | the BI keeps "Data base"; the header keeps the name of the open date as the button that reaches the calendar; the Agenda's form gets "Data do pedido" | D18, D20, D21 | the BI on the trilho's date; one date strictly in the Agenda ("Abrir <primeira data aberta>") |
| The calendar shows "the next month's first days" | also the last days of the month before | whole weeks, as today's grid | only the next month's |
| The Agenda's calendar goes in "1. Pedidos" (D) | in F1 | two date controls otherwise (D21) | in D, with both calendars until then |
| Notifications have "a time at the left" | an item with no time shows "—" and comes first | alerts carry no time (mapa-avisos conflict 3) | hide them from the list |
| The tab badges are sources of notifications | the badges go; their numbers are card states and values, the Recursos link's badge and avisos | they sat on the tabs | |
| "No modal or pop-up for viewing or editing a record" | the two record drawers go; the Histórico, the Sugestões, the four dialogs and the map pop-up stay | they are a log, actions and a setting (D26) | bring any of them into the page |
| (posicao B4, not the request) a second-row "Cadastros" card; BI in the header; Rodízio as a row of the Escala card | links of the secondary line, BI and Rodízio included | one click in every state; the header at 320 px (D5, D6) | the card with the elbow line; BI in the header; Rodízio in the card |
| (not in the request) the Painel's board ends above the fold at 1920×1080 (Pedro, 2026-11-20) | with the linha aberta (the default there) the board may end below the fold; the test runs with it recolhida | about 82 px more chrome than today with the linha aberta, 18 recolhida (2.6) | the Painel view folds the linha while it is open |
| (not in the request) | a Sunday cannot be opened from the calendar; the local-mode Gestor may change the date; the Secretaria opens on the first open date when there is no `?data=`; the screen is in the address and Back never changes the date; a closed day has no look in the calendar | 2.9, D9, D16 | each has a one-line alternative in section 8 |
| Decisions this reverses, beyond the request's three (docs/PLAN.md:181-182, 2026-11-11) | "the date always on top, tabs in the order of use with attention badges": the date's name stays on top, its control moves to the trilho, the tabs become cards and links, the badges states; "History as a side drawer over any tab": still a side drawer, now to the left of a docked trilho | mapa-outras-abas conflict 13 | |
| (plan level) F1 is one step | two PRs, F1a and F1b, both in Onda 1 | review size (D32) | one PR |

## 8. Questions for Pedro, each with the default this design implements

1. **From which window width is the calendar docked beside the screen by default?** Default: 1,280 px. Then the next day is one click, the avisos are always in sight, and on a 1,280 px laptop the Escala is 954 px wide (its toolbar on two lines until H, the Rodízio in three columns, an open Histórico leaves about 514 px of it). Alternative: 1,600 px (below it, two clicks for the next day and the old screens at today's width). Either way her choice is remembered per screen width. What is the operator's screen?
2. **Is the linha open or folded by default?** Default: open only when the cards fit in one row and the window is at least 760 px tall; folded on laptops and phones; remembered.
3. **Cadastros: links in the linha's secondary line, or a second-row card joined into the second stage, as in the reference?** Default: the links.
4. **The cards' names until D and G.** Default: "Agenda" and "Demanda" until their screens change, then "Pedidos" and "Processamento".
5. **"Instrutores" or "INVAs"?** Default: "Instrutores" until C rebuilds the screen, "INVAs" from then on ("INVA" is also a course sigla, mapa-invas conflict 11).
6. **May the Gestor change the date in local mode?** Default: yes.
7. **Does the BI keep "Data base"?** Default: yes, as its own period filter.
8. **A Sunday in the calendar.** Default: muted, and a click only says the aeroclube does not operate. Alternative: open Monday.
9. **Which clock says "hoje"?** Default: the browser's, as the header does today; the pedidos deadline keeps São Paulo's.
10. **The screen in the address, with Back and Forward.** Default: yes, and Back never changes the date. Alternative: Back also reopens the date that entry had.
11. **Does "no pop-up" reach the map's flight pop-up, the Sugestões drawer, "Configurar painel", the status dialog or "Agendar voo"?** Default: no, they stay.
12. **Avatars: one colour, or five hues by id?** Default: one neutral colour (F2's); the five pairs of 2.12 are ready.
13. **Avisos with no time.** Default: first in the list, with "—".
14. **What the Secretaria sees.** Default: Agenda, Escala and Aprovar; Alunos, Instrutores and Cursos; the Manual. Not the Demanda, Recursos, the Rodízio, the BI or the Histórico, as today.
15. **"Compartilhar".** Default: where it is in F1; beside the exports from H.
16. **Rodízio.** Default: a link of the secondary line, after the Cadastros. Alternatives: a row of the Escala card (hidden when folded); a fifth Cadastros link.
17. **BI.** Default: the last link of the secondary line. Alternative: a header tool (at 320 px in local mode the header would scroll sideways unless the profile select moves into the account menu).
18. **The Aprovar card until H.** Default: it opens the Escala at the approval bar, with a highlight. Alternative: three cards until H, with the approval as a row of the Escala card.
19. **The Painel at 1920×1080 with the linha open.** Default: the board may end below the fold. Alternative: the Painel view folds the linha while it is open.
20. **The trilho on screens that do not depend on the date (Cursos, the Manual, Minha conta).** Default: shown, as everywhere (no layout jump between screens). Alternative: hidden there.
21. **"Data do pedido" from F1.** Default: yes, so registering after 13:00 stays one click between F1 and D. Alternative: leave it to D (four to six clicks and two date loads after 13:00 until D).
22. **F1 as two PRs.** Default: yes, F1a and F1b.

## 9. Risks, and what would make this design wrong

1. **The default guesses the operator's screen.** Docked at 1,280 px costs the Escala 294 px until H (the toolbar on two lines, the map narrower). If she lives on the Escala of a 1,280 px laptop, question 1's alternative is better. The thresholds are two constants.
2. **The suite runs in a seeded state.** The old tests see today's widths because the context stores "not docked" and "recolhida"; a regression visible only in the product's default could slip. `casca.spec.js`, `trilho.spec.js` and `percorrerTelas` at 1,280 px docked are the guard.
3. **The linha's widths are computed, not measured.** One row recolhida from about 1,200 px of linha is close to 1,248 px; if it does not fit, the secondary line goes under the cards at 1,280 px (40 px more chrome). G's "Processamento" hides its value at 1,280 px.
4. **Two ways of scrolling** (the document on wide screens, the panes on list screens). If Pedro wants the mail client's feel everywhere, `acessibilidade.spec.js:462`, `cursos.spec.js:1595` and the overflow checks change.
5. **The Agenda changes before D.** F1 builds D's "Data do pedido" and changes the cache; D2 must keep the field and move the cache, and D's assumption S2 grows by those two items.
6. **Sibling notes in flux.** The delivery and list notes may keep their first names (`js/telas.js` as the registry; `data-vendo`); 2.15 gives the mapping, but the plan must carry one set.
7. **F1's first `linhaDoDia` and `avisosDaData` are partly throwaway.** The same items show twice (the trilho and the Escala's boxes) until H decides about the boxes; H's 17 rows make the open linha about 300 px tall.
8. **The drawer's offset is a formula over the cap and the trilho's width.** A change of either without the other puts the drawer over the rail; one test pins it.
9. **The hash.** A third party that writes the fragment (Supabase's return links) replaces the screen in the address; the app then opens the profile's screen. Anything that starts using `#` for something else must avoid `#/`.
10. **Browser support.** Container queries, `dvh` and `clamp()` need a current browser; the stylesheet already depends on `:has()` and `dvh` (posicao A11).
11. **Counting pedidos from rows** runs for every profile at every opening until D: one unpaged read of up to 42 days, capped at 1,000 rows (mapa-avisos 5.4), so a very busy month can show low numbers on its last days, as the Agenda does today.
12. **The engine text** "(aba Recursos)" changes in F1 (text only; no golden holds it, lacuna-1-textos-que-citam-telas 1); dates saved before keep the old sentence in their stored alerts until someone changes them.

<!-- revisado -->
<!-- fim -->
