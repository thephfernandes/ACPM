# Mapa: The shell: header, navigation, the open date, layout and CSS

Read at the worktree `~/ACPM/.redesenho/wt-plano` (branch `linha-0-plano`, 48875e3). Paths are relative to the worktree root. Ids, data attributes and UI labels are verbatim. "(inferred)" marks a conclusion with no single line that proves it. "(computed)" marks a number I calculated (with `test/helpers/contraste.js`, or from the CSS) that is not written in the repo. Playwright was not run: every statement about layout comes from the code and the tests, not from a browser.

## 1. What exists

### 1.1 Files of the shell

| File | Lines | What it is |
|---|---|---|
| `index.html` | 770 | One page: CSP meta (9), icon sprite (26-53), `header.topo` (55-104), `main#conteudo` with 3 banners and 12 `section`s (106-664), 4 drawers (667-682), 4 dialogs (684-760), map pop-up, toast box and announcer (762-765), one module script (767) |
| `css/app.css` | 1,698 | One stylesheet, shared with `painel.html` (painel.html:14): tokens (2-49), header and nav (61-214), page cap (228), components, phone rules, print (1575-1581), TV page (1615-1644) |
| `js/main.js` | 143 | Imports every `js/eventos/*.js` (18-30) and runs `bootstrap()` (65-143) |
| `js/views/tabs.js` | 28 | `show(t)` (16-28) and `mostrarNaFaixa` (8-14) |
| `js/views/vistas.js` | 39 | `mostrarVista`, `vistaDa`, `vistaDoBotao`: the `.seg` views of Instrutores and Recursos |
| `js/views/selos.js` | 60 | Tab badges: `atualizarSelosDaEscala`, `lerPedidosDaData`, `atualizarSeloDaAgenda` |
| `js/eventos/navegacao.js` | 64 | One document click listener for `data-t`, `data-go`, `data-tl`, `data-fids`, `data-recolher-tempo`, `data-recolher-grupo`, `data-vista-*`, `data-bi-todos`, `data-manual` |
| `js/eventos/topo.js` | 117 | Header: `#role-sel`, the date control, the account menu, theme, Manual, Minha conta, Usuários, "Tentar de novo" |
| `js/eventos/registro.js` | 52 | `aoAcionar`, `aoMudarCampo` and the two delegated listeners with the locks |
| `js/eventos/confirmacao.js` | 47 | `confirmado` (two clicks within 3.5 s) and `comConfirmacao` |
| `js/dom.js` | 314 | `$`, toasts, the fixed banner, drawers, `fecharNoEsc`, `ligarMenu`, `posicionarJunto`, focus keeping (`trocarConteudo`, `trocarElemento`), `focarNoTitulo`, `anunciar` |
| `js/perfis.js` | 12 | `ROTULOS`, `PERFIS` and five predicates. It knows nothing about tabs |
| `js/somente-leitura.js` | 38 | Disables fields for `body[data-role="gestor"]`, with a `MutationObserver` |
| `js/views/conta.js`, `js/eventos/conta.js` | 59, 71 | Minha conta and Usuários (`#s-conta`) |
| `js/state.js` | 39 | `S`, `RES`, `AUDIT_LOG`, `BI_HISTORY`, `TL_MODE`, `DATA` and their setters; `isGestor`, `modoCompartilhado` |
| `js/actions.js` | 380 | `abrirData`, `setRole`, `lerData`, `carregarData`, `gravarAlteracao`, `aindaNaoAbriu`, `logChange`, `carregarBI` |
| `js/util.js`, `js/format.js` | 17, 65 | List helpers; `hojeISO`, `amanhaISO`, `somarDias`, `rotuloDaData`, `dataIsoValida`, `chaveDeBusca`, `esc`, `opts` |
| `img/` | 3 files | `acpm-aguia.png` (9,818 bytes), `apple-touch-icon.png` (3,788), `favicon-32.png` (789). No SVG file and no icon font |
| `test/unit/csp.test.js` | 70 | The policy of `index.html` and `painel.html`; no `on…=` attribute in the pages and in `js/**` |
| `test/unit/contraste.test.js`, `test/helpers/contraste.js` | 18, 18 | The WCAG contrast helper and the check of the helper itself |

### 1.2 DOM skeleton (index.html)

```
body[data-role="operador"]                                   22
  a.pular[href="#conteudo"]                                  23
  svg[hidden] (26 <symbol id="i-…">)                         26-53
  header.topo                                                55-104
    h1.topo-marca (img.topo-logo, span.topo-titulo)          56
    div.topo-data[role=group][aria-label="Data da escala"]   58-67
    div.hd-tools (#role-sel, #btn-open-log, #btn-manual, div.menu-conta)   68-89
    nav#nav[aria-label="Abas"] (9 button[data-t], 2 span.aba-sep)          91-103
  main#conteudo                                              106-664
    #aviso-sync, #aviso-link, #aviso-dados                   108-123
    section#s-login 126 | #s-rec 149 | #s-ins 214 | #s-alu 249 | #s-cur 268 | #s-age 274
    section#s-dem 299 | #s-esc.on 344 | #s-rod 378 | #s-conta 385 | #s-manual 429 | #s-bi 652
  aside.gaveta#historico 667 | #painel-instrutor 678 | #painel-dados 680 | #painel-reparo 682
  dialog.dlg#dlg-status 684 | #dlg-painel 698 | #dlg-sessao 712 | #dlg-agendar 726
  div.tl-pop#tl-pop[role=dialog] 762 | div#toast-box[aria-live] 764 | div#anuncio.sr[role=status] 765
  script[type=module][src="js/main.js"] 767
```

- The sections are in a DOM order that is not the nav order (rec, ins, alu, cur, age, dem, esc, rod, conta, manual, bi).
- `header.topo` is not sticky or fixed: css/app.css:62-72 has no `position`. The header and the nav scroll away with the page.
- The header is full width; only `main` is capped (css/app.css:228).
- Drawers, dialogs, the map pop-up, the toast box and the announcer are siblings of `main`, outside it.
- `painel.html` (the reception TV) is a second page with its own `<main>` (painel.html:24-44), its own 3-symbol sprite (painel.html:19-23) and the same `css/app.css`.

### 1.3 Attributes on `body` and `html` that drive the shell

| Attribute | Values | Set at | Used by |
|---|---|---|---|
| `body[data-role]` | `operador`, `gestor` (HTML default `operador`, index.html:22) | `setRole`, js/actions.js:47 | `isGestor` (js/state.js:25); js/somente-leitura.js:11; css/app.css:235-247, 1131-1132, 1317 |
| `body[data-perfil]` | `operador`, `gestor`, `secretaria`, `administrador` (shared mode only) | js/sessao.js:165 | css/app.css:184-188, 237, 1132 |
| `body[data-backend]` | `supabase` or absent | js/sessao.js:115 | `modoCompartilhado` (js/state.js:27); css/app.css:242, 1557, 1564-1566 |
| `body[data-login]` | `sim` or absent | js/sessao.js:15, 50, 131 (set), 149, 173 (removed) | css/app.css:1552-1556: only `#s-login` and `.menu-conta` show |
| `body[data-agenda]` | `edita`, `consulta` | js/actions.js:60, js/main.js:127 | css/app.css:1172-1173 |
| `body[data-pronto]` | `1` at the end of boot | js/main.js:142 | E2E `entrar` (test/e2e/fixtures.js:82-86) |
| `html[data-theme]` | `light`, `dark` or absent (system) | js/eventos/topo.js:75, 88 | css/app.css:33-49 |

### 1.4 Boot (js/main.js:65-143)

1. `iniciarTema()`, `iniciarDicas()`, `iniciarSomenteLeitura()`, `configurarMeteorologia(...)` (66-71).
2. Read the URL (74), compute tomorrow (76), `abrirData(amanha)` (77): the header shows tomorrow before any data.
3. `?share=` is removed with a notice (80-85). `?data=` is validated (87-90).
4. Shared mode: `iniciarSessaoSupabase` (97); a `painel` account is redirected to `painel.html` without `data` (js/sessao.js:140-147).
5. `migrarDocumentosAntigos`, `atualizarFormatoGravado`, `dadosPreparados()` (102-106).
6. `abrirData(data)`, `lerData(data)`, toasts for Sunday or an invalid date (110-114). On failure: `dadosPreparados(false)` and the fixed banner (115-120).
7. Local mode only: `?role=` (123).
8. Redraw `rRec(); rIns(); rAlu(); rCursos(); rRodizio(); rDem(); renderAuditPanel();` (126), `data-agenda` (127), `carregarDadosPessoais()` (129).
9. The Secretaria goes to the Agenda unless she already chose a tab or left the Escala (134); an open Agenda is read (135).
10. `rOut(); atualizarSelosDaEscala(); lerPedidosDaData(); carregarBI();` (137-140), then `body[data-pronto]` (142).

### 1.5 Layers

| Layer | Element | z-index | Who closes it with Esc |
|---|---|---|---|
| Toasts | `#toast-box`, fixed bottom right | 9999 (css/app.css:1527) | removed after 2.8 s (js/dom.js:18) |
| Native dialogs | `dialog.dlg` with `showModal()` | browser top layer | the browser (`cancel`), except `#dlg-sessao` (js/sessao.js:88) |
| Drawers | `.gaveta`, fixed right, `min(440px, 100vw)` | `calc(200 + var(--camada, 0))` (css/app.css:1456) | each drawer's own `keydown` on `document`, bubble phase |
| Map pop-up | `#tl-pop`, fixed | 150 (css/app.css:1412) | `document` capture listener, js/eventos/escala.js:60-65 |
| Menus | `.menu-itens`, absolute | 100 (css/app.css:147) | `document` capture listener, js/dom.js:132-137 |
| Skip link | `.pular` | 100 (css/app.css:1226) | not applicable |
| Tooltip | `#dica.dica`, fixed, created by js/dicas.js:42-49 | 60 (css/app.css:1648) | `window` capture listener, js/dicas.js:167-172 |
| In-page panels | Horários editor, `#form-curso`, `.filtro-painel` (in the page flow) | none | `fecharNoEsc`, `document` capture (js/dom.js:67-78) |

The tooltip (60) is below the drawers (200+), so a tooltip of a "?" inside a drawer would be painted under the drawer where they overlap (inferred from the two z-index values; not run).

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

Nothing of the shell's state lives in the day document or in the cadastro, and none of it goes through `gravarAlteracao`.

| Field | Stored in | Scope | Writers | Readers |
|---|---|---|---|---|
| `DATA`, the open date (`AAAA-MM-DD`) | module variable, js/state.js:13 | memory, one value for the app | only `setData` inside `abrirData` (js/actions.js:22) | js/actions.js (many); js/export.js:34, 44, 46, 125; js/eventos/escala.js:111, 242, 251; js/eventos/cadastros.js:43, 163, 169; js/eventos/topo.js:31, 41, 50; js/eventos/agenda.js:24, 33, 42, 50; js/eventos/historico.js:39; js/views/dados-pessoais.js:136; js/views/cadastros.js:206, 210, 211; js/views/reparo.js:23; js/views/agendamento.js:39; js/views/agenda.js:58, 140, 147; js/views/escala.js:269, 560; js/views/cursos.js:72; js/views/selos.js:39, 42, 47 |
| `?data=` | URL query | survives reload; the shared link | `abrirData`, by `history.replaceState` (js/actions.js:24-29); `linkDaData` builds the link (js/eventos/escala.js:95-102) | boot only (js/main.js:74, 87-90) |
| `#dt.value` | DOM | view of the date | `abrirData` (js/actions.js:33); the user; `irParaDia` (js/eventos/topo.js:52); reset on refusal (js/eventos/topo.js:31, 41) | js/eventos/topo.js:29; fallbacks in js/eventos/bi.js:28 and js/views/bi.js:33 |
| `#bi-dt.value`, the BI's "Data base" | DOM | memory; reset to the open date on every date change | `abrirData` (js/actions.js:34); the user (index.html:655) | `carregarBI` (js/actions.js:334); `rBI` (js/views/bi.js:33); "Simular 30 dias" (js/eventos/bi.js:28) |
| `diaEscolhido`, `mesVisivel`, `pedidos`: the Agenda's own day, month and loaded requests | module variables, js/views/agenda.js:17-19 | memory | `abrirAgenda` (59-63), `carregarMes` (65-74), `mudarMes` (76-82), `escolherDia` (84-91) | `rAgenda` (186), `diaDaAgenda` (27), js/eventos/agenda.js |
| `pedidosDaData` | js/views/selos.js:36 | memory, for the open date | `lerPedidosDaData` (38-45) | `atualizarSeloDaAgenda` (52-60) |
| `dadosLidos` | js/actions.js:151 | memory | `lerData` (js/actions.js:290, 312) | `aindaNaoAbriu` (154-158), `save` (167), `logChange` (213), js/eventos/escala.js:251 |
| The open tab | DOM: class `on` on one `section` and one `#nav button`, plus `aria-current="page"` | memory; not in the URL; a reload returns to Escala | `show` (js/views/tabs.js:16-28); HTML default (index.html:92, 344) | js/main.js:134-135; css/app.css:229-230 |
| `abaEscolhida` | js/eventos/navegacao.js:16 | memory | js/eventos/navegacao.js:22 | js/main.js:134 |
| `TL_MODE`, the Escala view | js/state.js:10 | memory | `setTLMode` (js/eventos/navegacao.js:35) | js/views/escala.js:127, 216, 582, 589-593, 625 |
| `escolhidas[aba]`, the view of Instrutores and Recursos | js/views/vistas.js:14 | memory | `mostrarVista` (js/views/vistas.js:20) | `vistaDa` (16); `section[data-vista]` (24); css/app.css:847 |
| Theme | `localStorage['acpm3_theme']` (`KEY_THEME`, js/storage.js:34) and `html[data-theme]` | this browser, all dates | `#btn-theme` (js/eventos/topo.js:73-82) | `iniciarTema` (js/eventos/topo.js:85-93) |
| "Registrado por" | `localStorage['acpm_agenda_registrado_por']` (js/views/agenda.js:15) | this browser | `lembrarRegistradoPor` (js/views/agenda.js:93) | `rAgenda` (js/views/agenda.js:205) |
| `ApiClient.perfil`, `.readOnly`, `.autorAtual`, `.emailAtual` | object fields, js/storage.js:37-45 | memory | js/sessao.js:167-171; `setRole` (js/actions.js:45) | every `perfis.js` caller (section 5.2) |
| `?role=` | URL | local mode only | not written | js/main.js:123 |
| `?supabase=` | URL | localhost and 127.0.0.1 only | kept in the shared link (js/eventos/escala.js:97-99) | js/config-supabase.js:17 |
| `?share=` | URL | removed at boot | js/main.js:80-85 | not read |
| Drawer order | `data-ordem` and `--camada` on each `.gaveta`; counter `gavetasJaAbertas` | memory | `abrirGaveta` (js/dom.js:42-49) | `gavetaDoEsc` (js/dom.js:53-59); css/app.css:1456 |
| `AUDIT_LOG`, shown in `#audit-log-list` and counted in `#log-cnt` | js/state.js:8 | per date; read from the History | `lerData` (js/actions.js:311), `logChange` (226), `mostrarNoHistorico` (250), `#btn-clear-log` (js/eventos/historico.js:40) | `renderAuditPanel` (js/views/escala.js:267-300) |
| The session | `localStorage['acpm-<projeto>']` (`chaveDaSessao`, js/config-supabase.js:23) | this browser | supabase-js | js/sessao.js:123-125 |
| An armed confirm button | `data-arm`, `data-o`, `data-rotulo`, `data-armado` and class `arm` on the button | 3.5 s | `confirmado` (js/eventos/confirmacao.js:23-40) | the same function |

## 3. Controls inventory

Profiles: O = Operador, A = Administrador, G = Gestor, S = Secretaria. "Local" is the mode without a server (localhost and any other host), where the only profiles are the two options of `#role-sel`.

| Label | Element (id, data attribute, class) | Handler (function, file:line) | State read and written | Profiles that can use it |
|---|---|---|---|---|
| "Pular para o conteúdo" | `a.pular[href="#conteudo"]` (index.html:23) | none: a native anchor (css/app.css:1226-1227) | none | all |
| Logo and "AutoEscala" | `h1.topo-marca` with `img.topo-logo` and `span.topo-titulo` (index.html:56) | none: not a link | none | all |
| "Dia anterior" | `button#dt-ant.topo-ico` (index.html:59) | `irParaDia(-1)`, js/eventos/topo.js:47-55 | reads `DATA` and `#dt.disabled`; writes `#dt.value` and dispatches `change` | all in shared mode; local Operador; disabled for the local Gestor (js/actions.js:56-57) |
| "Data da escala" (title "Escolher a data") | `label.topo-data-campo` holding `svg` `#i-calendario`, `span#dt-rotulo`, `span#dt-rel.topo-data-rel`, `input#dt[type=date]` (index.html:60-65) | `change`: js/eventos/topo.js:28-44, then `carregarData` (js/actions.js:321-328). `click`: `showPicker()` (js/eventos/topo.js:57-63) | reads `isGestor`, `modoCompartilhado`, `DATA`; through `lerData` and `abrirData` writes `DATA`, `?data=`, `#dt`, `#bi-dt`, `#dt-rotulo`, `#dt-rel` | same as "Dia anterior" |
| "Próximo dia" | `button#dt-prox.topo-ico` (index.html:66) | `irParaDia(1)`, js/eventos/topo.js:56 | same | same |
| "Perfil de acesso" | `select#role-sel.hd-sel`, options `Operador` and `Gestor` (index.html:69-72) | js/eventos/topo.js:17-21: `setRole` (js/actions.js:44-64), `rCursos`, `rOut` | writes `body[data-role]`, the date control's `disabled`, `body[data-agenda]` | local mode only: hidden with `body[data-backend="supabase"]` (css/app.css:1557); disabled when `ApiClient.readOnly` (js/actions.js:51) |
| "Histórico" with the count | `button#btn-open-log.hd-btn` with `span.hd-txt` and `span#log-cnt.badge-cnt` (index.html:73) | js/eventos/historico.js:30: `mostrarHistorico` (20-29) | toggles `#historico[hidden]` and the button's `aria-expanded` | O, A, G; hidden for S (css/app.css:187) |
| "Manual" | `button#btn-manual.hd-btn` (index.html:74) | js/eventos/topo.js:97-101: `show('manual')`, `focarNoTitulo`, `scrollTo(0, 0)` | the open section | all |
| Account menu (title "Conta e preferências") | `button#btn-menu-conta.hd-conta` with `span#usuario-iniciais.hd-avatar`, `span#usuario.hd-usuario`, `svg.hd-seta` (index.html:77-81) | `ligarMenu` (js/eventos/topo.js:65; js/dom.js:110-157) | `#menu-conta[hidden]`, `aria-expanded` | all, also on the login screen (css/app.css:1556) |
| "Minha conta" | `button#btn-conta[role=menuitem]`, `hidden` in the HTML (index.html:83) | js/eventos/topo.js:104: `show('conta')`, `abrirConta()` (js/views/conta.js:18-25), focus on the title | the open section | shared mode, every profile (shown at js/sessao.js:163) |
| "Usuários" | `button#btn-usuarios[role=menuitem]` (index.html:84) | js/eventos/topo.js:106-111 | the open section | A only (js/sessao.js:164) |
| "Tema escuro" | `button#btn-theme.tema[role=menuitemcheckbox][aria-checked]` (index.html:85) | js/eventos/topo.js:73-82 | `html[data-theme]`, `localStorage['acpm3_theme']` | all |
| "Sair" | `button#btn-sair[role=menuitem]` (index.html:86) | js/sessao.js:166: `sair` (66-69) signs out of this browser and reloads | the session | shared mode |
| "Escala" | `#nav button[data-t="esc"]` with `span.aba-rotulo` and `span#selo-esc.aba-selo` (index.html:92) | js/eventos/navegacao.js:19-32: `show` | the open tab; `abaEscolhida` | all |
| "Demanda" | `#nav button[data-t="dem"]` (index.html:93) | same | same | O, A, G |
| "Agenda" | `#nav button[data-t="age"]` with `span#selo-age.aba-selo` (index.html:94) | same, plus `abrirAgenda()` (navegacao.js:26) | same; `diaEscolhido` | all |
| "Recursos" | `#nav button[data-t="rec"]` with `span#selo-rec.aba-selo` (index.html:96) | same | same | O, A, G |
| "Instrutores" | `#nav button[data-t="ins"]` (index.html:97) | same | same | all |
| "Alunos" | `#nav button[data-t="alu"]` (index.html:98) | same | same | all |
| "Cursos" | `#nav button[data-t="cur"]` (index.html:99) | same, plus `rCursos()` (js/views/tabs.js:26) | same | all |
| "Rodízio" | `#nav button[data-t="rod"]` (index.html:100) | same, plus `rRodizio()` (js/views/tabs.js:27) | same | O, A, G |
| "BI" | `#nav button[data-t="bi"]` (index.html:102) | same, plus `rBI()` (js/views/tabs.js:25) and `carregarBI()` (navegacao.js:25) | same | O, A, G |
| "Recarregar" | `button#btn-recarregar` in `div#aviso-sync[role=alert]` (index.html:108-111) | js/dom.js:31: reload | none | whoever sees the banner |
| "OK" | `button#btn-fechar-aviso-link` in `div#aviso-link[role=status]` (index.html:114-117) | js/dom.js:85 | hides the banner | whoever sees it |
| "Tentar de novo" | `button#btn-tentar-dados` in `div#aviso-dados` (index.html:120-123) | js/eventos/topo.js:114-117: `lerDadosDeNovo` (js/actions.js:85-108) | `S.indisponiveis`; may call `save()` (js/actions.js:106) | whoever sees it |
| "E-mail", "Senha", "Entrar" | `form#form-login` with `#login-email`, `#login-senha`, `#btn-entrar` (index.html:128-133) | `pedirLogin`, js/sessao.js:14-41 | the session | shared mode, before login |
| "Sair" (account with no profile) | `button#btn-sair-sem-acesso` (index.html:136) | js/sessao.js:135 | the session | account without a profile |
| "Enviar os dados deste navegador", "Começar sem eles" | `#btn-enviar-local`, `#btn-ignorar-local` (index.html:141-142) | js/sessao.js:55-58 | sends the local documents | O, A on the first access to an empty server |
| "Disponibilidade do dia", "Cadastro" | `.seg button[data-vista-rec]` (index.html:153-154) and `[data-vista-ins]` (index.html:218-219), with `aria-pressed` | js/eventos/navegacao.js:52-53: `mostrarVista` (js/views/vistas.js:19-30) | `escolhidas`, `section[data-vista]` | every profile that sees the tab; no lock |
| "Lista", "Por recurso", "Por instrutor", "Painel" | `.seg button[data-tl="lista"]`, `eq`, `ins`, `painel` (index.html:348-351) | js/eventos/navegacao.js:33-38: `setTLMode`, `rOut` | `TL_MODE`, `#out[data-vista]` | all |
| "Abrir a Demanda" | `button.btn.quiet[data-go="dem"]` in `p.ir-para-demanda` (index.html:260) | js/eventos/navegacao.js:19-32, focus on the title of `#s-dem` | the open tab | O, A, G; hidden for S (css/app.css:185) |
| "Compartilhar" | `button#btn-share-link` (index.html:358) | js/eventos/escala.js:106-118: copies `linkDaData(DATA)` | reads `DATA` | O, A, G in shared mode; in local mode it only explains; hidden for S (css/app.css:188) |
| "Data base" (BI) | `input#bi-dt[type=date]` in `label.chip` (index.html:655) | js/eventos/bi.js:16: `carregarBI` | the BI's reference date only; never `DATA` | O, A, G; never disabled (js/somente-leitura.js:6) |
| "Mês anterior", "Próximo mês", the days (Agenda) | `button.x[data-cal="mes"][data-delta]`, `button.dia[data-cal="dia"][data-dia]` (js/views/agenda.js:126-133) | js/eventos/agenda.js:18-27: `mudarMes` or `escolherDia`, and `carregarData` when the day is not `DATA`, is valid and is not a Sunday | `diaEscolhido`, `mesVisivel`; `DATA` | every profile; no `isGestor` gate |
| "Fechar o histórico" (✕) | `button#btn-fechar-historico.x` (index.html:670) | js/eventos/historico.js:31 | `#historico[hidden]` | O, A, G |
| "↶ Reverter" and the other revert labels | `button.x.edit-only[data-act="rev-log"][data-logid]` (js/views/escala.js:286-288) | registro, then js/eventos/historico.js:46 | the day, through `gravarAlteracao` | O, A |
| "Limpar o histórico desta data" | `button#btn-clear-log.btn.quiet.edit-only` (index.html:674) | js/eventos/historico.js:37-43 | `AUDIT_LOG` | local Operador only (css/app.css:1564) |
| "Senha", "Entrar" (session expired) | `#sessao-senha`, `#sessao-entrar` in `dialog#dlg-sessao` (index.html:712-722) | `pedirNovoLogin`, js/sessao.js:79-105 | the session | shared mode |
| "Trocar a senha" | `form#form-senha` (index.html:391-397) | js/eventos/conta.js:9-24 | the account | shared mode, every profile |
| "Trocar o e-mail" | `form#form-email` (index.html:402-407) | js/eventos/conta.js:26-40 | the account | shared mode, every profile |
| "Nova conta": "Gerar senha", "Criar conta" | `form#form-nova-conta`, `button#nc-gerar` (index.html:414-422) | js/eventos/conta.js:43-59 | accounts on the server | A |
| "Excluir" (an account) | `button.x[data-act="excluir-conta"][data-id][data-email]` (js/views/conta.js:43) | registro with `confereAPermissao: true`, then js/eventos/conta.js:61-71 | accounts on the server | A; the server checks |
| Manual index | `nav.manual-indice a[href="#manual-…"]` (index.html:432-440) | native anchors | none | all |
| "Como funciona o rodízio" | `a[data-manual="manual-aba-rodizio"]` (index.html:380) | js/eventos/navegacao.js:57-63: `show('manual')`, scroll, focus | the open section | whoever sees Rodízio |

## 4. Rules and the tests that pin them (file and test name)

| Rule | Code | Test |
|---|---|---|
| Nine tabs, in this order and with these labels; the app opens on Escala | index.html:92-102, 344 | test/e2e/app.spec.js:5 'abre na Escala, com as abas na ordem de uso e sem números' |
| Exactly one `section.on`; the only `data-go` is "Abrir a Demanda" | js/views/tabs.js:17; index.html:260 | test/e2e/app.spec.js:67 'navega pelas abas; sem os botões "Próximo" de um passo a passo' |
| `--ink` is `#12263A`, the body background is `rgb(238, 242, 245)`, `main` has `max-width: 1280px`, one request to Google Fonts | css/app.css:6, 3, 228; index.html:16 | test/e2e/app.spec.js:79 'aplica a folha de estilos (tokens de cor, layout e fontes)' |
| The Manual is as wide as the other pages and centred | css/app.css:228 | test/e2e/app.spec.js:194 'o manual tem a largura das outras páginas e fica centralizado' |
| The date is in the header on every tab; ‹ and › change the day; "amanhã", "hoje" | index.html:58-67; js/eventos/topo.js:47-56; js/format.js:36-43 | test/e2e/app.spec.js:34 'a data em uso fica no topo, em todas as abas; os botões ‹ e › trocam o dia' |
| The date control has a fixed size (1280, 560, 360 px) | css/app.css:85-88, 208 | test/e2e/app.spec.js:51 'o controle da data tem tamanho fixo: as setas não saem do lugar quando o texto muda (… px)' |
| `?data=` opens that date; an invalid date opens tomorrow with a toast | js/main.js:87-90, 113 | test/e2e/datas.spec.js:93 'o link com ?data= abre aquela data; uma data que não existe abre amanhã, com o aviso' |
| An empty date field goes back to the open date | js/eventos/topo.js:30-33 | test/e2e/datas.spec.js:101 'com o campo de data vazio, a tela volta para a data aberta e as alterações continuam indo para ela' |
| A reload stays on the open date | js/actions.js:24-29 | test/e2e/agenda.spec.js:228 'recarregar a página continua na data aberta' |
| No Sundays: the app opens on Monday, ‹ and › skip Sunday, a Sunday link opens Monday | js/main.js:76, 89-90; js/eventos/topo.js:35-39, 51 | test/e2e/agenda.spec.js:238 'sábado: o app abre na segunda; a agenda aceita pedidos para segunda até as 10:00; domingo não existe'; :256 'um link para um domingo abre a segunda, com o aviso' |
| The Agenda opens on the open date; a day chosen there becomes the open date | js/views/agenda.js:58-63; js/eventos/agenda.js:22-26 | test/e2e/agenda.spec.js:211 'a agenda abre na data aberta no topo; escolher um dia na agenda abre aquela data no app' |
| After 13:00 the Agenda opens on the next day while the app stays on tomorrow | js/views/agenda.js:58 | test/e2e/agenda.spec.js:202 'depois das 13:00, amanhã fecha e a agenda abre no dia seguinte' |
| The local Gestor cannot change the header date | js/actions.js:56-57; js/eventos/topo.js:30 | test/e2e/perfis.spec.js:5 'perfil Gestor oculta a edição e o Operador a restaura' |
| The shared-mode Gestor navigates the dates and nothing is saved | js/actions.js:56 | test/e2e/datas-compartilhado.spec.js:157 'gestor navega entre as datas, sem gravar nada' |
| Nothing is saved while a date opens; dates are read one at a time | js/actions.js:151-158, 286-317 | test/e2e/datas-compartilhado.spec.js:176 'alteração feita enquanto outra data carrega é recusada: …'; test/e2e/abertura.spec.js:160, 246, 290, 331, 364 |
| The History follows the date | js/actions.js:324; js/views/escala.js:268-269 | test/e2e/historico.spec.js:44 'com o histórico aberto, trocar a data troca também a data do histórico' |
| The shared link carries only the date | js/eventos/escala.js:95-102 | test/e2e/compartilhado.spec.js:289 'a escala gerada guarda a data, o link leva só a data e o gestor vê a mesma escala' |
| The open tab (or the Manual), the chosen view and the Agenda's day are said to the screen reader | js/views/tabs.js:20-23; js/views/vistas.js:28; js/views/agenda.js:133 | test/e2e/acessibilidade.spec.js:547 'a aba aberta (e o Manual), a vista escolhida e o dia da agenda são ditos, não só coloridos' |
| `data-go` moves the focus to the opened tab's title | js/eventos/navegacao.js:30 | test/e2e/cadastros.spec.js:1486 '"Abrir a Demanda", embaixo da barra, leva à Demanda com o foco no título; também para o Gestor' |
| On phones the opened tab scrolls into the visible part of the strip | js/views/tabs.js:8-14 | test/e2e/celular.spec.js:196 '"Abrir a Demanda" traz a aba Demanda para a parte à vista da faixa das abas' |
| The Secretaria sees Escala, Agenda, Instrutores, Alunos, Cursos and opens on the Agenda | css/app.css:184; js/main.js:134 | test/e2e/agenda-compartilhado.spec.js:49 'a Secretaria abre na agenda, registra pedidos e só consulta a escala'; test/e2e/dados-pessoais.spec.js:114 'a Secretaria vê Alunos e Instrutores e edita só os dados pessoais' |
| Badges on the tabs | js/views/selos.js:20-60 | test/e2e/selos.spec.js:14, 20, 32, 51, 66 |
| No tab scrolls sideways at 390 px; 44 px targets on every tab | css/app.css:1584-1612 | test/e2e/celular.spec.js:30 'nenhuma aba rola para o lado; o mapa rola dentro do próprio painel'; :49 'botões e campos com pelo menos 44 px para o dedo, em todas as abas' |
| No tab scrolls sideways at 320 px; the date fits | css/app.css:91-97, 208 | test/e2e/acessibilidade.spec.js:192 'nenhuma aba rola de lado'; :210; :220 |
| Every control of `.topo`, `#nav` and `main section.on` has an accessible name | index.html | test/e2e/acessibilidade.spec.js:36 'todo botão e todo campo tem nome para o leitor de tela, em todas as abas' |
| Focus ring at least 3:1 on the header in both themes, never clipped; more than 8 controls in `header.topo` | css/app.css:176, 225-226 | test/e2e/acessibilidade.spec.js:108 'o anel do foco contrasta com a barra em todos os controles, no tema …'; :147 |
| Nothing in the header overlaps between 641 and 1290 px; Tab order follows the rows | css/app.css:193-214 | test/e2e/acessibilidade.spec.js:240 'a … px (modo …), nada na barra cobre a marca, as setas da data ou as ferramentas'; :274; :287 |
| Text on colour at least 4.5:1 in both themes (listed items only) | css/app.css tokens | test/e2e/acessibilidade.spec.js:1027 'os textos sobre cor (…) contrastam, no tema …'; :1052 'o selo vermelho da aba (…) contrasta, no tema …' |
| Theme switch in the account menu, remembered | js/eventos/topo.js:68-93 | test/e2e/app.spec.js:100 'alterna o tema e lembra a escolha após recarregar' |
| The account menu: items, arrows, Esc, Tab | js/dom.js:110-157 | test/e2e/contas.spec.js:116 'reúne Minha conta, o tema e Sair; Esc fecha o menu'; :129; test/e2e/acessibilidade.spec.js:599 |
| The Manual opens from any tab and takes the focus | js/eventos/topo.js:97-101 | test/e2e/app.spec.js:122 'o botão Manual abre, de qualquer aba, o manual com as regras em vigor'; test/e2e/acessibilidade.spec.js:379 |
| The History is a drawer over the open tab; Esc and ✕ close it | js/eventos/historico.js:20-34 | test/e2e/historico.spec.js:25 'abre numa gaveta sobre a aba aberta, sem trocar de aba; Esc e ✕ fecham' |
| One Esc closes only the top layer (tooltip, menu, pop-up, dialog, in-page panel, top drawer) | js/dom.js:7, 42-78; js/dicas.js:167-172 | test/e2e/acessibilidade.spec.js:628, 642, 658, 682, 705, 736, 772, 787, 803, 826, 886, 898, 915, 930, 954, 972, 1004 |
| Focus survives a redraw and never scrolls the page | js/dom.js:159-296 | test/e2e/acessibilidade.spec.js:310, 321, 389, 410, 437, 452, 462, 484 |
| The first Tab is the skip link | index.html:23; css/app.css:1226-1227 | test/e2e/acessibilidade.spec.js:1072 |
| The date label is an `aria-live` region | index.html:62 | test/e2e/acessibilidade.spec.js:1085 |
| Two lists in the Painel only at 1,600 px of board width; one list on the 1,280 px page | js/config-do-painel.js:24, 69-73; js/views/painel-aeroporto.js:80-88 | test/unit/config-do-painel.test.js:89; test/e2e/painel-missoes.spec.js:103 'na tela grande, a tela cheia da Escala tem duas listas lado a lado; na página, uma'; :252 |
| Ordem no hangar beside the table from 1,100 px | css/app.css:806-808 | test/e2e/cadastros.spec.js:218 'a ordem no hangar fica ao lado da tabela a partir de 1.100 px, e embaixo dela nas telas menores' |
| CSP: no inline script, no `unsafe-inline` in scripts, connections only to the app's Supabase projects, no `on…=` attributes | index.html:9; painel.html:8 | test/unit/csp.test.js:33, 40, 56, 63 |
| The contrast helper matches WCAG | test/helpers/contraste.js | test/unit/contraste.test.js:7, 12, 15 |
| Every `data-dica` used in `index.html`, `js/*.js` and `js/views/*.js` exists in the glossary; each term's `aba` is in `ABAS_DO_GLOSSARIO` | js/glossario.js:14 | test/unit/glossario.test.js 'toda dica usada nas telas existe no glossário'; 'cada termo tem o nome, uma frase curta (…) e a aba' |
| Five profiles and what each may do | js/perfis.js | test/unit/perfis.test.js (3 tests) |
| `rotuloDaData`, `amanhaISO`, `somarDias`, `dataIsoValida` | js/format.js:25-51 | test/unit/format.test.js:61, 92, 107, 115 |

Shared test helpers that pin today's shell (test/e2e/fixtures.js):
- `abrir` (57-66) waits for `#wins input[data-a="win"]` (65): every local-mode test depends on the Janelas de operação being drawn.
- `entrar` waits for `body[data-pronto]` (82-86).
- `irPara(page, aba)` clicks `#nav button[data-t="<aba>"]` and expects `#s-<aba>` visible (88-91). `irPara(` and `irParaVista(` appear 478 times in 38 files of `test/e2e`, the helper file included (grep count).
- `irParaVista` uses `#s-<aba> [data-vista-<aba>="<vista>"]` and `section[data-vista]` (95-99).
- `percorrerVistasEFiltros` (129-183) and `nenhumComOsFiltros` (189-198), which requires the "Limpar filtros" button to be inside a `.tw` (193).
- `abrirMenuDaConta` uses `#btn-menu-conta` and `#menu-conta` (201-204).

## 5. Answers

### 5.1 The header date control and the open date

Structure (index.html:58-67), inside `div.topo-data[role="group"][aria-label="Data da escala"]`:
1. `button#dt-ant.topo-ico` with `aria-label="Dia anterior"` and the `#i-esquerda` icon.
2. `label.topo-data-campo[title="Escolher a data"]` holding: the `#i-calendario` icon (`aria-hidden`); `span#dt-rotulo[aria-live="polite"][aria-atomic="true"]`; `span#dt-rel.topo-data-rel` (hidden when empty); `input#dt[type="date"][aria-label="Data da escala"]`.
3. `button#dt-prox.topo-ico` with `aria-label="Próximo dia"` and the `#i-direita` icon.

Details:
- The native input is invisible and covers the label: `#dt { position: absolute; inset: 0; opacity: 0 }` (css/app.css:104). A click calls `showPicker()` (js/eventos/topo.js:57-63). The focus ring is drawn on the label with `:focus-within` (css/app.css:101).
- `#dt-rotulo` is filled by `abrirData` with `span.dt-semana` ("quarta-feira"), `span.dt-semana-curta` ("qua.") and the text ", 11/11" (js/actions.js:36-38). CSS shows one of the two weekday spans (css/app.css:90-97). The year is added when it is not the current one (js/format.js:40).
- `#dt-rel` shows `hoje`, `amanhã` or `ontem` (js/format.js:39) in a yellow pill (css/app.css:102).
- `.topo-data-campo` is 256 px wide so the arrows never move (css/app.css:85-88); on phones it takes the row (css/app.css:208).
- There is no "today" button and no month view in the header.

Flow of a change:
1. The user picks or types a date in `#dt`, or `irParaDia` sets `#dt.value` to the next or previous day (skipping Sunday) and dispatches `change` (js/eventos/topo.js:47-54).
2. `#dt.onchange` (js/eventos/topo.js:28-44): refuses and puts `DATA` back when `(isGestor() && !modoCompartilhado()) || !dataIsoValida(data)`; a Sunday becomes Monday with the toast of `avisoDeDomingo` (js/eventos/topo.js:24); then `carregarData(data)`; on failure the field goes back to `DATA` with the toast "Não foi possível abrir essa data. Verifique a conexão e tente de novo.".
3. `carregarData` (js/actions.js:321-328): `if (!await lerData(data)) return;`, hides `#escala-atualizada`, redraws `rRec(); rIns(); rAlu(); rCursos(); rRodizio(); rDem(); renderAuditPanel(); rOut(); rAgenda();`, then `atualizarSelosDaEscala(); lerPedidosDaData(); await carregarBI();`.
4. `lerData` (js/actions.js:288-317): `dadosLidos = false`; waits for `dadosProntos` and for the previous read (one date at a time); drops a request that was superseded before reading; `ApiClient.carregarDia(data)` and the History; then `abrirData(data)`, `setS`, `setRES`, `setAuditLog`, `dadosLidos = maisNova`.
5. `abrirData` (js/actions.js:21-41): `setData(data)`; `?data=` by `history.replaceState`; `#dt.value`; `#bi-dt.value`; `#dt-rotulo`; `#dt-rel`.

While a date loads, `#dt` already shows the new date but `DATA` and the label are still the old one (js/state.js:11-12), and every change is refused with "A escala ainda não abriu: nada foi mudado. Espere os dados chegarem ou recarregue a página." (js/actions.js:154-158).

Everything else that reads or sets the open date:
- **URL**: `?data=` is written by `abrirData` and read only at boot (js/main.js:74, 87-90). "Compartilhar" builds a link with only `data` (and `supabase` on localhost) (js/eventos/escala.js:95-102).
- **sessionStorage**: the app never uses it. The only uses are in tests (test/e2e/datas.spec.js:139-140, 162-163; test/e2e/envio-local.spec.js:20-21).
- **The Agenda** has its own day, `diaEscolhido`, and its own month, `mesVisivel` (js/views/agenda.js:17-18). `abrirAgenda()` starts on `DATA`, or on `primeiraDataAberta()` when `DATA` is already closed for requests (js/views/agenda.js:58-63). A click on a day calls `escolherDia` and, when the day is not `DATA`, is valid and is not a Sunday, also `carregarData` (js/eventos/agenda.js:22-26). The month arrows call `mudarMes`, which sets `diaEscolhido` to the first of that month and does not open that date (js/views/agenda.js:76-82; js/eventos/agenda.js:21). So the Agenda's day and the open date can differ: on a Sunday, after a month arrow, and after 13:00. `carregarData` redraws the Agenda with `rAgenda()` but does not change `diaEscolhido` (js/actions.js:324).
- **The BI** has its own date input, `#bi-dt` "Data base" (index.html:655). `abrirData` resets it to the open date (js/actions.js:34); the user can then change it without changing `DATA` (js/eventos/bi.js:16).
- **The History drawer** title shows the open date (js/views/escala.js:268-269).
- **The Painel** shows the date beside the title when it is not today (js/views/painel-aeroporto.js:157); the TV always shows today (js/sessao.js:141-145).
- **Booking, Sugestões, exports, results, personal data, extra hours** read `DATA` (the list is in section 2).
- **`setRole`** disables `#dt`, `#dt-ant` and `#dt-prox` for the local Gestor (js/actions.js:54-58); css/app.css:242 dims `#dt` for him; js/somente-leitura.js:6 excludes `#dt` and `#bi-dt` from the read-only disabling.

The date the app opens on (js/main.js:74-114):
- Without `?data=`: tomorrow by the browser's clock (`amanhaISO`, js/format.js:27), or Monday when tomorrow is a Sunday (js/main.js:76).
- With a valid `?data=`: that date; a Sunday becomes Monday, with a toast (js/main.js:89-90, 112).
- With an invalid `?data=`: tomorrow, with the toast "A data do link não existe (…). A escala aberta é a de amanhã." (js/main.js:113).
- Because `abrirData` always writes `?data=`, a reload opens the date that was open, not tomorrow (test/e2e/agenda.spec.js:228).
- "Today" and "tomorrow" here use the browser's time zone (js/format.js:25-27). The Agenda's deadline uses `America/Sao_Paulo` (js/agenda.js:13, 25).

### 5.2 The nav

- `nav#nav[aria-label="Abas"]` is the last child of `header.topo` (index.html:91-103) and sits on the header grid's `abas` row (css/app.css:68, 166).
- Nine `button[data-t]`, no `type`, no `role`: `esc` "Escala", `dem` "Demanda", `age` "Agenda", `rec` "Recursos", `ins` "Instrutores", `alu` "Alunos", `cur` "Cursos", `rod` "Rodízio", `bi` "BI". Each label is in `span.aba-rotulo`.
- Three groups, split by two `span.aba-sep[aria-hidden="true"]` (index.html:95, 101): esc, dem, age; rec, ins, alu, cur, rod; bi. The comment calls them "a escala e o que a alimenta no dia; o cadastro; o BI" (index.html:90).
- Badges: `span.aba-selo#selo-esc`, `#selo-age`, `#selo-rec`, all `hidden` in the HTML (index.html:92, 94, 96). A fourth, `#selo-rec-dia`, is on the "Disponibilidade do dia" button (index.html:153). `selo()` sets `hidden`, the text, `className` (it overwrites the whole class list with `aba-selo`, `aba-selo aviso` or `aba-selo erro`) and `title` (js/views/selos.js:11-18). There is no `aria-label`: the count is part of the button's text.
- It is not a `tablist`. The open tab has class `on` and `aria-current="page"` (index.html:92; js/views/tabs.js:18-23). The active mark is a yellow underline, `border-bottom-color: var(--ye)` (css/app.css:174).
- `show(t)` (js/views/tabs.js:16-28): toggles `on` on **every** `section` of the document by `s.id === 's-' + t`; toggles `on` on every `#nav button`; sets `aria-current` on `#nav button[data-t]` and `#btn-manual` (the Manual counts as `t === 'manual'`); calls `mostrarNaFaixa`; redraws BI, Cursos or Rodízio when they open. `show('conta')` leaves no nav item current.
- The click listener (js/eventos/navegacao.js:19-32) takes any element with `data-t` or `data-go`, anywhere in the document: sets `abaEscolhida`, calls `show`, `carregarBI()` for `bi`, `abrirAgenda()` for `age`, `window.scrollTo(0, 0)`, and for `data-go` only, `focarNoTitulo($('#s-' + aba))`.
- Focus: a click on a tab leaves the focus on the tab button. `data-go`, the Manual, Minha conta, Usuários and `data-manual` move the focus to a title, which gets `tabindex="-1"` (js/dom.js:300-305).
- Per-profile visibility is CSS only. `js/perfis.js` has no list of tabs. css/app.css:184-188 hides for `body[data-perfil="secretaria"]`: every `#nav button` except `age`, `esc`, `ins`, `alu`, `cur`; `.ir-para-demanda`; `.aba-sep`; `#btn-open-log`; `#btn-share-link`. The Gestor sees the nine tabs. The Painel profile never reaches this page (js/sessao.js:140-147).
- What `js/perfis.js` decides elsewhere: `operaEscala` (js/sessao.js:171-172; js/views/agenda.js:24), `registraNaAgenda` (js/views/agenda.js:23), `gerenciaContas` (js/sessao.js:164; js/views/conta.js:20; js/views/cadastros.js:75; js/views/cursos.js:36), `veDadosPessoais` (js/views/dados-pessoais.js:15), `soPainel` (js/sessao.js:140; js/painel.js:123, 197, 244; js/sessao-da-tv.js:83). Tab views per profile: `DO_PERFIL` in js/views/vistas.js:10-13.
- In shared mode the Gestor and the Secretaria both get `data-role="gestor"` and `ApiClient.readOnly = true` (js/sessao.js:171; js/actions.js:45-47).
- The open tab is not in the URL: no code reads `location.hash` for it (the only reader is the e-mail link return, js/sessao.js:118).
- Phone strip: `nav#nav { overflow-x: auto; scrollbar-width: none }` (css/app.css:166-167); buttons are at least 44 by 44 px and never shrink (css/app.css:1588); the focus ring is drawn inside (`outline-offset: -4px`, css/app.css:176); `mostrarNaFaixa` scrolls the opened tab into view (js/views/tabs.js:8-14).

### 5.3 Where Manual, Histórico, Painel, Minha conta, the theme switch and Sair live

| Thing | Where | How it opens | Kind |
|---|---|---|---|
| Manual | `section#s-manual.manual` (index.html:429-649); text in the HTML, tables filled once by `rManual()` (js/views/manual.js:10-21; js/eventos/topo.js:96) | `#btn-manual` in the header (js/eventos/topo.js:97-101); any `[data-manual]` link (js/eventos/navegacao.js:57-63) | a section, outside the nav |
| Histórico | `aside.gaveta#historico` (index.html:667-675) | `#btn-open-log` in the header toggles it (js/eventos/historico.js:30) | a drawer |
| Painel | the fourth view of the Escala, `[data-tl="painel"]` (index.html:351), drawn by `painelDaEscala` inside `#out` (js/views/painel-aeroporto.js:176-192; js/views/escala.js:560, 625). "Tela cheia" calls `requestFullscreen` on `#out .fids` (js/views/painel-aeroporto.js:317-320). "Configurar painel" opens `dialog#dlg-painel`. The reception TV is the separate page `painel.html` | the `.seg` of the Escala | a view of a section, a dialog for its settings, a second page |
| Minha conta and Usuários | `section#s-conta` (index.html:385-426); `#usuarios` is inside it | `#btn-conta` and `#btn-usuarios` in the account menu (js/eventos/topo.js:104-111) | a section, outside the nav |
| Theme switch | `#btn-theme` in the account menu (index.html:85) | the account menu; it stays open after the click (test/e2e/app.spec.js:113) | a menu item (`menuitemcheckbox`) |
| Sair | `#btn-sair` in the account menu (index.html:86) | the account menu | a menu item |

### 5.4 The 1,280 px page cap

The selector: `main { max-width: 1280px; margin: 0 auto; padding: 16px 16px 60px; }` (css/app.css:228). The content is at most 1,248 px wide. It is pinned by test/e2e/app.spec.js:79 (`principalMax: '1280px'`) and by test/e2e/app.spec.js:194.

What is not under the cap: `header.topo` (full width, css/app.css:62-72); drawers, dialogs, the pop-up, the tooltip and the toasts (fixed, relative to the viewport); the full-screen Painel.

What depends on it:
- **The header breakpoints** (1289, 1029, 640 px) come from the header's own need of "cerca de 1290 px" (css/app.css:190-192), not from the cap.
- **The Painel's two lists**: `larguraDoQuadro()` measures the `.fids` box, not the window (js/views/painel-aeroporto.js:80-88). `listasNaLargura` gives two lists in "Automático" from `LARGURA_DAS_DUAS_LISTAS = 1600` (js/config-do-painel.js:24, 69-73), and `duasListasCabem` then checks that they fit (js/views/painel-aeroporto.js:96-109). On the page the board is at most 1,248 px, so "Automático" always gives one list there; two lists appear only in full screen, on the TV, or with "Sempre duas listas lado a lado" (docs/PLAN.md:456; test/e2e/painel-missoes.spec.js:103, 252).
- **The board's minimum width**: `.fids-topo` and `table.fids-tabela` have `min-width: 860px`, also `.fids-listas.duas` (css/app.css:377, 391, 401); below it the board scrolls inside `.fids` (css/app.css:373).
- **Table minimum widths**, each inside a `.tw { overflow-x: auto }` (css/app.css:561): 840 px by default (css/app.css:562); 760 px for the Escala list (325); 640 px for `table.frota` (829); 960 px for the availability grid `table.disp` (1044); 600 px for `table.cadastro` (1070); 0 for the Demanda (581).
- **The map**: `.mapa .tl-wrap { min-width: 720px }` inside `.mapa { overflow-x: auto }` (css/app.css:519-520), with a 155 px label column (1290) and a 166 px axis margin (1273).
- **The Escala toolbar** fits one row "sem os ícones das visões" up to 1,400 px of viewport (css/app.css:309-310).
- **Ordem no hangar** goes beside the aircraft table from 1,100 px of viewport (css/app.css:806-808; test/e2e/cadastros.spec.js:218).
- **Full-screen modes**: `.fids:fullscreen, .fids.inteiro` size everything in `vh` and `vw` and the TV uses `position: fixed; inset: 0` (css/app.css:435-439, 462-464). They ignore `main`.
- **`calc(100vw - …)`**: the "Limpar filtros" row assumes the table is as wide as the screen (`max-width: calc(100vw - 50px)`, css/app.css:854). Dialogs, the pop-up, the tooltip, toasts and drawers also size against `100vw` (css/app.css:613, 626, 642, 1403, 1456, 1531, 1649).
- **`painel.html`** has a `<main>` too, so the `main` rule applies to the TV page (painel.html:24).
- **Scrolling**: the document is the scroller. `window.scrollTo(0, 0)` on a tab change (js/eventos/navegacao.js:27; js/eventos/topo.js:100), `scrollIntoView` (js/dom.js:90; js/eventos/navegacao.js:61; js/eventos/topo.js:109; js/eventos/demanda.js:47; js/views/cursos.js:487), and tests that read `scrollY` (test/e2e/acessibilidade.spec.js:462-473) or `document.documentElement.scrollWidth` (test/e2e/celular.spec.js:9) assume it.

### 5.5 Breakpoints, phone rules and the 320 px guarantees

There is no `@container` rule: every breakpoint is on the viewport.

| Condition | Lines | What changes |
|---|---|---|
| `max-width: 400px` | 91-97 | short weekday ("qua."); the date label may wrap |
| `max-width: 600px` | 708-713 | the compaction criteria stack, one control per row |
| `max-width: 640px` | 202-214 | header: brand and tools on row 1, the date on row 2 (full width), tabs on row 3; tool buttons show only the icon (`.hd-txt` is visually hidden); the account name and arrow are hidden |
| `max-width: 640px` | 465 | METAR and TAF boxes stack |
| `max-width: 640px` | 523-558 | `.seg` takes the row, icons hidden; `.bar .cresce` hidden; the Escala list becomes one card per flight |
| `max-width: 640px` | 679-685 | the booking dialog: one column |
| `max-width: 640px` | 993-1040 | Cursos: one card per mission; courses by sigla; 44 px index links |
| `max-width: 640px` | 1088-1133 | Instrutores and Alunos: one card per person by grid areas and `data-rotulo`; the filter panel stacks |
| `max-width: 640px` | 1584-1612 | 44 px targets (below) |
| `max-width: 640px`, or `pointer: coarse` | 1682-1688 | the "?" button is 44 px |
| `max-width: 640px` | 1693 | glossary in one column |
| `max-width: 760px` | 1149 | the Agenda: calendar above the form and list |
| `max-width: 1029px` | 196-198 | header: brand and date on row 1, tools on row 2 |
| `min-width: 1100px` | 806-808 | Recursos: Ordem no hangar beside the table |
| `max-width: 1289px` | 193-195 | header: the date is no longer centred |
| `max-width: 1400px` | 310 | the Escala's view buttons lose their icons |
| 1,600 px of board width (JavaScript) | js/config-do-painel.js:24 | two lists in the Painel |
| `hover: none` or `pointer: coarse` | 353, 592, 820, 843, 1143 | controls that appear on hover are always visible |
| `forced-colors: active` | 366-368 | pressed buttons use `Highlight` |
| `prefers-reduced-motion: reduce` | 429 | no blinking on "embarque" |
| `prefers-color-scheme: dark` | 33-41 | dark tokens unless `data-theme="light"` |
| `print` | 1575-1581 | hides `header`, `.bar`, every `nav`, every `section` but `#s-esc`, the toasts |

Phone rules:
- **Cards**: the Escala list (css/app.css:534-557), Instrutores and Alunos (1104-1132), the Cursos program (996-1019). The Demanda and the availability grid stay tables and scroll inside `.tw`.
- **Tab strip**: section 5.2.
- **44 px targets** (css/app.css:1584-1612): `.topo-ico`, `.hd-btn`, `.hd-conta`, `.hd-sel`, `.topo-data-campo`, `.seg button`, `.menu-itens button`, `.cal .dia`, `nav#nav button`, `.btn`, `.x`, `.btn-add-mis`, `.tg button`, `.hr-chip button`, `button.st-detalhe`, `.ins-btn`, `.frota-reg`, every `select` and text `input`, `label.alvo`, `label.chk`, `.janela`, `.cel`, `.win-btn`, `.grupo-btn`, `.tl-agendar`, `.win-agendar`; checkboxes are 24 px inside a 44 px label.
- The test (test/e2e/celular.spec.js:13-27) checks, at 390 px, every visible `button`, `select`, `input` of `.topo`, every `#nav button`, and every `button, select, input, summary, a[href]` of `main section.on`: height at least 44; width at least 44 except for `select`, text `input` and `summary`; a checkbox is measured by its label; links inside a paragraph and `.sr` are skipped. Anything outside `.topo`, `#nav` and `main section.on` is not checked.

320 px guarantees:
- No horizontal scroll of the document on any visible tab and on every screen of `percorrerVistasEFiltros` (test/e2e/acessibilidade.spec.js:192).
- The date label fits, with the short weekday, also with the year and "amanhã" (test/e2e/acessibilidade.spec.js:210, 220).
- At 390 and 320 px: the cadastro cards, the two Curso filters, the Habilitações filter, Cursos in phases, many courses, the Painel and "Configurar painel" (test/e2e/celular.spec.js:64, 174, 217, 251, 320, 406).
- The 44 px test over all tabs runs only at 390 px (test/e2e/celular.spec.js:7, 49). At 320 px the Agenda's calendar days are about 35 px wide (computed: 320 minus 32 of `main` padding, 2 of border, 28 of `.pn` padding and 12 of gaps, over 7 columns; css/app.css:228, 250-256, 1151, 1608). At 390 px they are about 45 px.
- The overflow tests read `document.documentElement.scrollWidth`. A pane that clips or scrolls its own overflow would pass them without being checked.

### 5.6 Colour tokens

All tokens are on `:root` (css/app.css:2-27). The dark values are written twice: under `prefers-color-scheme: dark` for `:root:not([data-theme="light"])` (33-41) and for `:root[data-theme="dark"]` (43-49). A new token must be added in three places.

| Token | Light | Dark | Role today |
|---|---|---|---|
| `--bg` | `#EEF2F5` | `#0F1822` | page background |
| `--pn` | `#FFFFFF` | `#17232F` | surface (panels, tables, drawers, dialogs) |
| `--pn2` | `#F6F8FA` | `#1C2B39` | second surface (table head, group rows, editors) |
| `--ink` | `#12263A` | `#E6EDF3` | main text |
| `--mu` | `#5B6B7A` | `#93A3B2` | muted text |
| `--ln` | `#DCE3E9` | `#2B3B4A` | hairline |
| `--ln2` | `#C5CFD8` | `#3A4E60` | stronger border (fields, `.seg`) |
| `--ac` | `#1F5FA8` | `#6AA8F0` | accent (buttons, links, focus ring) |
| `--acT` | `#ffffff` | `#0F1822` | text on the accent |
| `--ye` | `#F2B705` | same (not redefined) | yellow mark: active tab, "amanhã" pill, avatar, toast edge |
| `--er`, `--erT`, `--er-bg` | `#B3261E`, `#ffffff`, `#FCEBEA` | `#FF8A80`, `#0F1822`, `rgba(255,138,128,.14)` | error |
| `--wa`, `--wa-bg` | `#8A5A00`, `#FFF5DB` | `#F2C94C`, `rgba(242,201,76,.14)` | warning |
| `--ok`, `--ok-bg` | `#197A47`, `#E7F4EC` | `#5FD39A`, `rgba(95,211,154,.14)` | ok |
| `--info-bg` | `#E8F1FB` | `rgba(106,168,240,.14)` | soft accent background (menu hover, `.etapa`, `.cel.on`, the neutral focus row) |
| `--neutro-bg` | `#EDF1F4` | `rgba(147,163,178,.14)` | neutral background (`.tag`, Pendente) |
| `--fly` | `#01639E` | `#4FC3F7` | "Em Voo" |
| `--hd`, `--hdT` | `#12263A`, `#EAF0F5` | `#0A1119`, `#E6EDF3` | header bar and its text; also `.seg button.on` and toasts |
| `--pop-bg`, `--pop-txt` | `#12263A`, `#F8FAFB` | `#223446`, `#E6EDF3` | pop-up and tooltip |
| `--at` | `#D9711C` | `#F0954A` | "Atrasado" on the map |

Which exist for the redesign's needs:
- Accent: `--ac`, `--acT`. Main and muted text: `--ink`, `--mu`. Hairlines: `--ln`, `--ln2`. Surfaces: `--bg`, `--pn`, `--pn2`.
- Status: ok (`--ok`, `--ok-bg`), error (`--er`, `--erT`, `--er-bg`), warning (`--wa`, `--wa-bg`).
- The header is dark in both themes and uses hard-coded colours on top of `--hd`: `#C9D6E2`, `#fff`, `rgba(255,255,255,…)`, and `#C62828` for the red badge (css/app.css:79-82, 169-180).

Which do not exist:
- **A selected-row background.** No token and no list selection style. Today's "selected" marks are an outline (`.cal .dia.sel`, css/app.css:1156), a dark fill (`.seg button.on`, 308) and an underline (the nav, 174). The nearest token is `--info-bg`.
- **Text on ok and on warning.** There is `--erT` and `--acT`, but no `--okT` or `--waT`. In the dark theme white fails on the status colours: 1.86 on `--ok`, 1.59 on `--wa`, 2.28 on `--er`; `#0F1822` gives 9.60, 11.27 and 7.84 (computed). In the light theme white gives 5.36, 5.93 and 6.54 (computed).
- **Pending, running, needs attention.** No token by those names. "Pendente" uses `--wa` for the text and border (css/app.css:1191), `--neutro-bg` in the list (339) and a dashed `--ye` on the map (1371-1374). "Em Voo" uses `--fly` and `--info-bg`.
- **Avatar hues.** One avatar style exists: `--ye` with a hard-coded `#12263A` (css/app.css:140).
- **Connector dots and lines, severity bars, the "today" circle**: no tokens; they can be built from the ones above.

Contrast of pairs the new layout would use (computed; the `-bg` tokens over `--pn`):

| Pair | Light | Dark |
|---|---|---|
| `--ink` on `--pn` | 15.40 | 13.49 |
| `--mu` on `--pn` / `--pn2` / `--bg` | 5.48 / 5.15 / 4.87 | 6.16 / 5.59 / 6.92 |
| `--ac` on `--pn` / `--pn2` | 6.44 / 6.05 | 6.43 / 5.83 |
| `--acT` on `--ac` | 6.44 | 7.22 |
| `--ac` on `--info-bg` | 5.65 | 4.99 |
| `--mu` on `--info-bg` | 4.81 | 4.78 |
| `--mu` on `--neutro-bg` | 4.83 | 4.85 |
| `--ok` on `--ok-bg` | 4.74 | 6.33 |
| `--ln` on `--pn` (a hairline) | 1.30 | 1.39 |
| `--pn2` on `--pn` (a row tint) | 1.06 | 1.10 |

What the tests demand of a new pair:
- `test/unit/contraste.test.js` demands nothing of the CSS. It checks the helper only: black on white is 21, the order does not matter, the same colour is 1, `#767676` on white is 4.54, and a colour that is not `rgb(…)` or `rgba(…)` throws.
- The helper `razaoDeContraste(a, b)` (test/helpers/contraste.js:15-18) takes colours as `getComputedStyle` returns them and ignores alpha. The caller must flatten semi-transparent backgrounds first, as `coresDoTexto` does (test/e2e/acessibilidade.spec.js:523-533).
- The E2E checks are a fixed list, in both themes: text at least 4.5:1 for "Em Voo", "Pousou", the pop-up button, the approval seal, the armed ✕ and the red tab badge (test/e2e/acessibilidade.spec.js:1027, 1052); focus ring at least 3:1 and not clipped on every control of `header.topo`, and on the account menu items (test/e2e/acessibilidade.spec.js:108, 147).
- So a new pair is checked only if it is added to that list. A colour that the browser reports outside `rgb()` (for example from `color-mix()`, used once at css/app.css:1062 for a border) would make the helper throw (inferred).

### 5.7 Drawers and dialogs

Drawers are `aside.gaveta[hidden][aria-labelledby]`, fixed on the right, `width: min(440px, 100vw)`, full height (css/app.css:1455-1459). They are not modal: no backdrop, no focus trap, the page behind stays usable, and they stay open when the tab changes (test/e2e/acessibilidade.spec.js:736).

| Drawer | What it is for | Opens | Focus on open | Closes; focus on close |
|---|---|---|---|---|
| `#historico` (index.html:667-675) | the History of the open date, with revert buttons | `#btn-open-log` toggles it (js/eventos/historico.js:30) | `#btn-fechar-historico` (28) | the same button, ✕, Esc (31-34); back to `#btn-open-log` only when the focus was inside (23, 27) |
| `#painel-instrutor` (index.html:678) | "Habilitações" of one INVA: the switches (`data-k="i"`, `data-f="hab"`) and the flight hours with `ext-mes` and `ext-ano` (js/views/cadastros.js:182-197) | `data-act="editar-habs"` (js/eventos/cadastros.js:70), so never for the Gestor | `#btn-fechar-painel-instrutor` (js/views/cadastros.js:234-240) | ✕ and Esc (js/eventos/cadastros.js:49-54); back to the row's "Editar habilitações" (js/views/cadastros.js:242-247) |
| `#painel-dados` (index.html:680) | "Dados pessoais" of a student or INVA: CPF, CANAC, nascimento, celular, e-mail, "Cancelar", "Salvar" (js/views/dados-pessoais.js:86-105) | a click on `[data-dados="tipo:id"]`, outside registro, so it works for the Secretaria (js/eventos/cadastros.js:24-30) | `#dado-cpf`, after the read (js/views/dados-pessoais.js:54-79) | ✕, "Cancelar", Esc, a successful save (js/eventos/cadastros.js:31-44); back to the row's button (js/views/dados-pessoais.js:107-113) |
| `#painel-reparo` (index.html:682) | "Resolver o conflito": the Sugestões for a pinned flight in conflict | a click on `[data-reparo]` (js/eventos/escala.js:266-268) | the first suggestion (js/views/reparo.js:19-45) | ✕, Esc (js/eventos/escala.js:297-299), or by itself when the conflict is gone (js/views/reparo.js:64-69); back to the "Sugestões" button (48-54) |

How Esc and focus work:
- `abrirGaveta(gaveta)` (js/dom.js:45-49) un-hides it, stamps `data-ordem` with a growing counter, and sets `--camada` on every open drawer in opening order, so the last opened is on top. Opening an already open drawer moves it to the top.
- `gavetaDoEsc(evento)` (js/dom.js:53-59) picks, once per key press, the open drawer that holds `document.activeElement`, otherwise the last opened. Each drawer has its own `keydown` listener and closes only when it is the one picked and `!algumDialogoAberto()`.
- `algumDialogoAberto()` is `Boolean(document.querySelector('dialog[open]'))` (js/dom.js:7). `#tl-pop` has `role="dialog"` but is a `div`, so it does not count.
- `fecharNoEsc(aberto, fechar, { semFoco })` (js/dom.js:67-78) is for a panel in the page: a capture-phase listener that acts only when the focus is inside the panel (or nowhere, with `semFoco` and no open drawer), and stops the event so the drawers behind stay open. Used by the Horários editor (js/eventos/recursos.js:226), `#form-curso` (js/eventos/cursos.js:605) and the multi-value filter (js/views/filtro-multiplo.js:103).
- Still open in docs/PLAN.md:437: "Esc with the focus in a lower drawer closes that drawer, not the one on top."

Dialogs are native `dialog.dlg` opened with `showModal()` (backdrop at css/app.css:616); the browser traps the focus and returns it to the opener.

| Dialog | What it is for | Opens | Focus on open | Esc |
|---|---|---|---|---|
| `#dlg-status` (index.html:684-695) | "Cancelar o voo" (the reason) or "Voo atrasado" (the new take-off) | `pedirDetalheDoStatus` (js/views/dialogo-status.js:66-77), from a status change or `data-act="detalhe-status"` (js/eventos/escala.js:189) | the checked reason or `#st-novo` | closes; the status stays as it was (js/views/dialogo-status.js:58-63) |
| `#dlg-painel` (index.html:698-710) | "Configurar painel": board, lists, columns | `[data-fids="configurar"]` (js/eventos/navegacao.js:42; js/views/config-do-painel.js:144-154) | the checked board or `#pn-fechar` | closes; focus to the redrawn button (js/views/config-do-painel.js:138-141) |
| `#dlg-sessao` (index.html:712-722) | "Entre de novo": the session expired while changes wait | `pedirNovoLogin` (js/sessao.js:79-105) | `#sessao-senha` | does **not** close (`dlg.oncancel = e => e.preventDefault()`, js/sessao.js:88) |
| `#dlg-agendar` (index.html:726-760) | "Agendar voo": book, move or fit a flight | `data-act="agendar"` (js/eventos/agendamento.js:46) and a click on a free map row (js/eventos/escala.js:52-55); `abrirAgendamento` (js/views/agendamento.js:333-349) | `#agd-aluno` | closes; nothing changes (js/views/agendamento.js:280-284) |

Other overlays: the map pop-up `#tl-pop` (index.html:762; js/eventos/escala.js:40-70; js/views/escala.js:70-103), the tooltip `#dica` (js/dicas.js), the menus `.menu-itens` (the account, and "Mais" in the Demanda), a native `prompt()` when the clipboard fails in "Compartilhar" (js/eventos/escala.js:116), and the browser's own confirmation on leaving with pending saves (js/main.js:58-62).

Against the request ("no modal or pop-up for viewing or editing a record"): the two that view or edit a cadastro record are `#painel-instrutor` and `#painel-dados`. The resource attributes and the take-off times editor are already in the page.

### 5.8 js/eventos/registro.js

Clicks (js/eventos/registro.js:19-28):
- One listener on `document` finds `e.target.closest('[data-act]')` and looks the name up in the `acoes` map. An unknown name is ignored.
- The lock: `if (!acao.confereAPermissao && (isGestor() || aindaNaoAbriu())) { e.preventDefault(); return; }`. `isGestor()` comes first, so the Gestor gets no toast; before the date opens, the Operador gets the toast of `aindaNaoAbriu`.
- `id` is the number in the `data-id` of the closest `[data-k]` row, otherwise the number in the button's own `data-id`, otherwise 0. A text id such as a registration becomes 0, and those handlers read `b.dataset.id` themselves (js/eventos/recursos.js:74). `mid` is the button's `data-mid`, otherwise the row's, otherwise 0.
- `aoAcionar(nomes, fazer, { confereAPermissao })` registers one name or several (js/eventos/registro.js:15-17). Registered: `editar-habs`, `addi`, `adds`, `unbl`, `unvc`, `deli`, `dels` (js/eventos/cadastros.js:70-111); `cancelar-pedido` (js/eventos/agenda.js:155); `agendar` (js/eventos/agendamento.js:46); `usar-proxima`, `usar-fora-da-ordem`, `add-mis`, `del-mis`, `rm-fly` (js/eventos/demanda.js:109-184); the Cursos actions (js/eventos/cursos.js:281, 318, 355, 542, 565, 599); `excluir-conta` (js/eventos/conta.js:71); `trocar-instrutor`, `detalhe-status` (js/eventos/escala.js:148, 189); `fila-subir`, `fila-descer`, `fila-inicio` (js/eventos/rodizio.js:8); `rev-log` (js/eventos/historico.js:46); `atributos-recurso`, `retirar-recurso`, `hangar-subir`, `hangar-descer`, `hangar-frente`, `revisao`, `editar-horarios`, `rascunho-tirar`, `rascunho-por`, `cancelar-horarios`, `salvar-horarios` (js/eventos/recursos.js:74-185).
- Only two skip the lock with `confereAPermissao: true`: `cancelar-pedido` and `excluir-conta`.

Changes (js/eventos/registro.js:37-52):
- One listener on `document` takes any target with `data-f` or `data-a`.
- The lock: with `isGestor() || aindaNaoAbriu()` it calls `e.preventDefault()`, redraws `rRec(); rIns(); rAlu(); rCursos(); rDem();` and `rOut()` (so the screen shows the stored data again) and stops.
- Dispatch: `data-f="fstatus"` goes to the `fstatus` handler; otherwise `data-a` goes to its handler; otherwise the closest `[data-k]` row's type gets `(t, { f, c, id, mid })`.
- Registered: `fstatus`, `insVoo` (js/eventos/escala.js:144, 177); `atributo`, `win`, `av`, `horas` (js/eventos/recursos.js:82-131); rows `i`, `s` (js/eventos/cadastros.js:140, 189) and `d` (js/eventos/demanda.js:197). The comment at js/eventos/registro.js:31 names only `win`, `av` and `horas`.

The two locks, in full:
- **Read-only**: `isGestor()` is `ApiClient.readOnly || body[data-role] === 'gestor'` (js/state.js:25). Four layers: `.edit-only` is hidden by CSS (css/app.css:235); js/somente-leitura.js disables `main input` and `main select` (except `.flt-ctrl`, `.agenda-campo`, `.conta-campo`, `#onlyfly`, `#bi-dt`, `#dt`) and `#painel-instrutor input` (5-9), also for nodes added later (32-38); registro refuses; `gravarAlteracao` and `save` refuse (js/actions.js:167, 190); and the server checks again.
- **Before the date opens**: `dadosLidos` is false from the start and during every `lerData` (js/actions.js:151, 290, 312). `aindaNaoAbriu()` refuses with a toast (154-158). `gravarAlteracao` starts with `if (isGestor() || aindaNaoAbriu()) return;` (189-195).

What does not go through registro and carries its own checks: filters (`.flt-ctrl`), views (`data-vista-*`, `data-tl`), `data-t`, `data-go`, `data-cal`, `data-dados`, `data-reparo`, `data-criterio`, `data-resultado`, `data-limite`, `#btn-aprovar`, `#btn-reabrir`, the Cursos fields (`data-cc`, `data-cf`, `data-cfa`), `data-pn-*`, `data-agd-*`, `data-fids`, the forms, `comConfirmacao` buttons and the exports.

What a new shell must keep working:
1. The attribute contract (`data-act`, `data-f`, `data-a`, `data-k`, `data-id`, `data-mid`) and the listeners on `document`: a control works wherever it is in the page.
2. The class contract: `.edit-only`, `.so-dados`, `.flt-ctrl`, `.agenda-campo`, `.conta-campo`.
3. The `main` scope of the read-only disabling (js/somente-leitura.js:6-7; css/app.css:241-245). A field placed outside `<main>` would stay enabled for the Gestor; registro would still refuse the change.
4. The focus keeping: redraw with `trocarConteudo` or `trocarElemento`, and add any new identifying attribute to `QUEM_E`, `DA_LINHA`, `DO_TIPO`, `LINHA` or `ITEM` (js/dom.js:171-181).
5. The redraw lists are written by hand in five places: js/eventos/registro.js:43-44; js/actions.js:107, 140-141, 324; js/main.js:126. A new screen (or the rail) must be added to each, or they must become one function.
6. `body[data-pronto]` at the end of boot (js/main.js:142).
7. `confirmado` as the only way to confirm (js/eventos/confirmacao.js:23-40).
8. Global attribute names are taken: `data-t`, `data-go`, `data-tl`, `data-fids`, `data-cal`, `data-dados`, `data-manual`, `data-dica`, `data-reparo`, `data-criterio`, `data-resultado`, `data-limite`, `data-recolher-tempo`, `data-recolher-grupo`, `data-bi-todos`, `data-limpar-filtros`, `data-limpar-recursos`. A new component must not reuse one by accident; the booking dialog's comment warns of the same (index.html:723-725).
9. Tag selectors: `section { display: none }` and `section.on` (css/app.css:229-230), `show()` toggling every `section` (js/views/tabs.js:17), `body[data-login] main > section` (css/app.css:1553), and the print rule hiding every `header` and `nav` (css/app.css:1576). A new `<section>` anywhere is hidden, and is switched off by `show()`.

### 5.9 Icons and avatars; what the CSP allows

How icons are drawn today:
- **An inline SVG sprite** at the top of `index.html` (26-53): 26 `<symbol>`s with `viewBox="0 0 24 24"`, used as `<svg class="ico"><use href="#i-nome"/></svg>` (index.html:25). `.ico` is 16 px, stroke only: `stroke: currentColor; fill: none; stroke-width: 2` (css/app.css:217).
- The symbols: `i-historico`, `i-manual`, `i-compartilhar`, `i-tema`, `i-calendario`, `i-aviao`, `i-instrutor`, `i-lista`, `i-decolagem`, `i-pouso`, `i-cadeado`, `i-painel`, `i-sair`, `i-conta`, `i-esquerda`, `i-direita`, `i-baixo`, `i-cima`, `i-topo`, `i-fechar`, `i-relogio`, `i-ok`, `i-sol`, `i-lua`, `i-aviso`, `i-mais`.
- `i-tema`, `i-sair` and `i-aviso` are defined and never referenced (grep over `js`, `index.html`, `painel.html`). `i-decolagem` and `i-pouso` are referenced by name from js/views/painel-aeroporto.js:20-21, 158. `i-historico` and `i-relogio` have the same path (index.html:27, 47).
- `painel.html` has its own sprite with three symbols (painel.html:19-23).
- **Characters**: ✕ (29 uses), ↶ (18), › (16), ↑ and ↓ (7 each), ‹ (3), ▾ (1) in `js` and the HTML (grep count); the "?" of `.dica-btn` is drawn with `::before` (css/app.css:1671).
- **CSS shapes**: the switch `input.sw` (css/app.css:771-780), the theme switch (158-163), the availability cell `.cel` with a striped gradient (1058-1063), the legend squares `.tl-dot` (1261-1265), the bars `.barra` and `.bi-bar-fill`, the pills `.tag`, `.aba-selo`, `.badge-cnt`, `.cal .dia .qtd`.
- **Images**: one, `img/acpm-aguia.png` (index.html:56; js/views/painel-aeroporto.js:156; painel.html:26, 40), plus the two page icons.

What exists for the redesign's parts:
- **Chevrons**: `i-baixo`, `i-cima`, `i-esquerda`, `i-direita`, and the rotation pattern for collapsible things, `[aria-expanded="false"] .seta { transform: rotate(-90deg) }` (css/app.css:476-477, 861-862, 961-962).
- **Switches**: `input.sw` is a checkbox drawn as a switch, 32 by 18 px, `--ok` when on; `label.alvo` gives it a 44 px target on phones (css/app.css:782, 1594).
- **Status icons**: `i-ok` (a circle with a check, outline only), `i-relogio`, `i-aviso` (a triangle), `i-fechar` (an x with no circle), `i-cadeado`. There is no filled round icon, no x in a circle, no "running" icon and no filter icon. `.ico` forces `fill: none`, so a filled disc needs its own class or a CSS circle around a stroke icon. A symbol can carry its own fill, as `i-tema` does (index.html:30).
- **Avatars with initials**: one, the account's, `span.hd-avatar#usuario-iniciais`, a 26 px circle (css/app.css:140). The function `iniciais(nome)` (first and last initial, or the first letter of an e-mail) is private to js/sessao.js:108-111. Before login the avatar shows the `i-conta` icon.

What the policy allows (index.html:9; the same directives in painel.html:8):
- `script-src 'self'` plus three pinned library folders, no `unsafe-inline`: no inline `<script>` and no `onclick=` attributes.
- `style-src-attr 'unsafe-inline'`: `style="…"` attributes are allowed and are used today for widths and positions (js/views/bi.js:150; js/views/recursos.js:55; js/views/escala.js:174, 192, 209). Styles set from JavaScript are used too (js/dom.js:48, 103-105).
- `style-src-elem 'self' https://fonts.googleapis.com`: an inline `<style>` element is **not** allowed; CSS must be in a file of the site.
- `img-src 'self'`: `data:` images are **not** allowed, in `<img>` or in CSS `url(…)`. Inline SVG and `<use href="#…">` are not images for the policy. CSS gradients are fine.
- `font-src https://fonts.gstatic.com`: a font file of the site itself (an icon font) would be blocked.

What `test/unit/csp.test.js` checks: the policy comes before any script or stylesheet (33); `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, no `'unsafe…'` in `script-src`, every external script and stylesheet covered, no inline script (40); `connect-src` is exactly `'self'` plus the app's Supabase projects (56); no `on…=` attribute in the two pages and in every `js/**/*.js` (63). It does not test `style-src-attr`, `img-src` or `font-src`.

A trap in that last test: the pattern is `/\son[a-z]+\s*=\s*["'`$]/`. It also matches JavaScript such as `const onde = '…'` or `let only = \`…\``: any name that starts with `on`, after a space, assigned a string or template (read from the pattern, csp.test.js:67).

Another pin: test/e2e/app.spec.js:79 expects exactly one request to `https://fonts.googleapis.com/css2?family=Barlow…`. The stylesheet loads Barlow 400, 500, 600 and Barlow Semi Condensed 500, 600, 700 (index.html:16).

### 5.10 What a pipeline of four stage cards plus a secondary navigation would replace

In `index.html`:
- `nav#nav` and its nine buttons, two separators and three badges (90-103).
- `div.topo-data` (57-67), once the rail holds the date.
- The flat list of `section`s under `main#conteudo` (106-664) gains a pane structure; the three banners (108-123) need a place that spans the panes.
- "Abrir a Demanda" (`data-go="dem"`, 260) and the title "Agenda de Solicitações" (275).
- The Manual's text about the header, the tabs and the badges (445, 456, 468-469, 474-475, 505, 510, 524, 595, 598, 643-644) and the hint "valem para a data aberta no topo" (165).

In `css/app.css`:
- The header grid and its areas (61-72); the date control (77-105); the nav and the badges (165-180).
- The Secretaria's tab visibility (182-188), which is written against `#nav button[data-t]`.
- The header breakpoints (190-214) and their phone rules for `.topo-ico` and `nav#nav button` (1586-1588).
- `main`'s cap and the `section` switch (228-230).
- The login rule that hides `#nav` and `.topo-data` (1553-1556); the print rule (1575-1581).
- The Agenda's calendar styles `.cal*` (1150-1157, 1608) move to the rail.

In the JavaScript of this area:
- js/views/tabs.js, all of it: `show` works on `#nav button` and `section`; `mostrarNaFaixa` on `#nav`.
- js/eventos/navegacao.js:19-32, the `data-t` and `data-go` branch, with `window.scrollTo(0, 0)`.
- js/eventos/topo.js:23-63, the date control. `avisoDeDomingo` is also used by js/main.js:112.
- js/actions.js:33-40 (`abrirData` writes `#dt`, `#dt-rotulo`, `#dt-rel`) and 54-58 (`setRole` disables `#dt`, `#dt-ant`, `#dt-prox`).
- js/views/selos.js: `selo()` writes `#selo-<aba>` and `#selo-rec-dia`; `atualizarSeloDaAgenda` also rewrites the `#importar-agenda` button (56-59).
- js/main.js:134-135: the Secretaria's opening tab, tested through `#s-esc.on`.
- js/somente-leitura.js:6 and css/app.css:242-244: the `#dt` exceptions.
- js/eventos/bi.js:28 and js/views/bi.js:33: the `#dt` fallback of the BI.
- Outside this area but tied to it: `calendarioHTML` (js/views/agenda.js:118-135) and its click handler (js/eventos/agenda.js:18-27); `ABAS_DO_GLOSSARIO` (js/glossario.js:14); texts that name a tab (js/views/escala.js:597; js/eventos/demanda.js:38; js/views/demanda.js:112; js/glossario.js:67, 88; js/engine.js:932).

Tests that pin today's nav, by selector:
- `#nav button[data-t="<aba>"]` and `#s-<aba>`: the helper `irPara` (test/e2e/fixtures.js:88-91) and direct clicks in test/e2e/datas.spec.js:15, 103; agenda-compartilhado.spec.js:75, 83, 97, 111; datas-compartilhado.spec.js:28; seguranca.spec.js:325; publicado.spec.js:86.
- `#nav button .aba-rotulo` with the nine labels in order (test/e2e/app.spec.js:10); `#nav button:visible .aba-rotulo` and `#nav button[data-t]:visible` with the Secretaria's five (agenda-compartilhado.spec.js:74; dados-pessoais.spec.js:116).
- Class `on` on `#nav button[data-t=…]` (app.spec.js:12, 71; selos.spec.js:70; celular.spec.js:209); `section.on` count 1 (app.spec.js:72).
- `[aria-current="page"]` carrying `data-t`, or being `#btn-manual` (acessibilidade.spec.js:549-569; cadastros.spec.js:1494).
- `[data-go]` count 1 and `#s-alu [data-go="dem"]` (app.spec.js:74-75).
- `#nav` hidden on the login screen (login.spec.js:14, 29, 79; envio-local.spec.js:35-73).
- `.topo, #nav, main section.on` for accessible names (acessibilidade.spec.js:40); `.topo button, .topo select, .topo input, #nav button` for 44 px (celular.spec.js:15).
- `header.topo :is(button, select):visible:not(:disabled)` with more than 8 controls (acessibilidade.spec.js:112-114); `#nav button[data-t]:visible` with more than 5 at 320 px (acessibilidade.spec.js:194-195).
- The strip's scroll: `#nav` `scrollLeft` (celular.spec.js:199-210).
- `#selo-esc`, `#selo-age`, `#selo-rec`, `#selo-rec-dia` (selos.spec.js:16-71; agenda.spec.js:164; acessibilidade.spec.js:1055-1056).
- `#manual-abas h4` with the nine tab names and the sentence about the tabs (app.spec.js:122).
- `main` `max-width` `1280px` (app.spec.js:88-91).

Tests that pin the header date (exact-string counts over `test/`): `'#dt'` 54 times in 15 files; `#dt-prox` 33 in 12; `#dt-rotulo` 30 in 8; `#dt-ant` 7 in 4; `#dt-rel` 5 in 3; `.topo-data` 3 in 2; `#bi-dt` 3 in 3; `#agenda-cal` 12 in 3.

Other shell ids used widely by tests: `#btn-open-log` 65 times in 21 files; `#toast-box` 56 in 15; `#historico` 53 in 13; `data-vista` 52 in 13; `[data-tl` 44 in 11; `#aviso-sync` 24 in 5; `#log-cnt` 19 in 9; `#role-sel` 19 in 7; `#menu-conta` 18 in 4.

## 6. Conflicts with the request

1. **"The right-rail calendar is the app's only date control."** The code has a third date control that the request does not mention: the BI's `#bi-dt` "Data base" (index.html:655), which starts on the open date at every date change (js/actions.js:34) and which the user changes without changing the open date (js/eventos/bi.js:16). The request also says the BI's behaviour does not change. Both cannot hold.
2. **The Agenda's calendar is treated as a date control to be replaced.** It is also the selector of the Agenda's own day, which can differ from the open date: a Sunday can be chosen there (the page says "O aeroclube não opera aos domingos: não há escala nem pedidos." and the open date stays; js/eventos/agenda.js:24; test/e2e/agenda.spec.js:238); the month arrows move the Agenda to the first of the month without opening it (js/views/agenda.js:76-82); after 13:00 the Agenda opens on the next day while the app stays on tomorrow (js/views/agenda.js:58; test/e2e/agenda.spec.js:202). One date for everything needs a rule for these three cases.
3. **"Under it, the notifications of that date as an agenda list: a time at the left."** The engine's alerts have no time: an item is `{ t, s, m, codigo }`, sometimes with `fKey`, `stuId` or `insId` (js/engine.js:153, 533, 581, 765, 787-803, 1004-1026). The badges are counts with a `title` (js/views/selos.js:11-33). Only an alert with `fKey` can borrow its flight's time.
4. **"Three panes on every screen."** The middle pane would be about 48% of the window: about 614 px at 1,280 px (computed). Today's wide screens need more: the Escala list 760 px (css/app.css:325), the map 720 px (520), the availability grid 960 px (1044), the Painel 860 px (377, 391), default tables 840 px (562). They would scroll sideways inside their boxes.
5. **"The page is capped at 1,280 px today."** Only `main` is (css/app.css:228). The header is full width, and its three breakpoints (1289, 1029, 640 px) come from its own content (css/app.css:190-214).
6. **Painel behaviour "does not change" while the cap is to be reconsidered.** "Automático" shows two lists when the board is at least 1,600 px wide (js/config-do-painel.js:24, 69-73). On the page it never is, only because of the cap (docs/PLAN.md:456; test/e2e/painel-missoes.spec.js:103). A wider page would start showing two lists there.
7. **"Say where Cursos, Rodízio, BI, Painel, Histórico and Manual go."** These are four different kinds of thing today: Cursos, Rodízio and BI are tabs; the Painel is a view of the Escala plus the page `painel.html`; the Histórico is a drawer; the Manual is a section opened from the header. Minha conta and Usuários (`section#s-conta`), the theme switch, Sair, the local-mode `#role-sel` and "Compartilhar" are not mentioned at all.
8. **"Phones and 320 px are tested (`celular.spec.js`, `percorrerVistasEFiltros`)."** `celular.spec.js` runs at 390 px (test/e2e/celular.spec.js:7), with six of its tests also at 320 px. The 320 px check over every tab is in test/e2e/acessibilidade.spec.js:190-226. The 44 px test over every tab runs only at 390 px.
9. **"Use the app's existing light and dark tokens."** They do not cover a selected row, text on a green or amber fill, pending or running states, or avatar hues (section 5.6). The reference's "green with a check" in white fails in the dark theme with today's `--ok` (1.86:1, computed).
10. **"No modal or pop-up for viewing or editing a record."** The request keeps "+ Agendar voo", which is a modal dialog (`#dlg-agendar`, index.html:726), and does not say whether the status dialog, "Configurar painel", the map pop-up and the Sugestões drawer fall under the rule.
11. **The local Gestor and the date.** The header control is disabled for him (js/actions.js:56-57; test/e2e/perfis.spec.js:5), but the Agenda's calendar opens any date for him: its handler has no `isGestor` check (js/eventos/agenda.js:18-27; read from the code, not run). The request's rail inherits one of two contradictory rules.
12. **Pipeline sub-task "exportada" (found outside my area).** Nothing records an export: the three buttons call `gravarEscalaCalculada()` and the export, and the export only shows a toast (js/eventos/escala.js:90-92; js/export.js:34, 153-154).
13. **Pipeline status "running" (found outside my area).** The engine runs synchronously inside `save()` (js/actions.js:166-168, 370-372); there is no state in which it is running.
14. **The name "INVAs" for the cadastro.** The tab and the section are "Instrutores" (index.html:97, 215). The request does not say whether the label changes.

## 7. Implications and options for the redesign (suggestions)

Each item is a suggestion, with its cost and its risk.

1. **Keep the `section#s-<id>` plus `on` contract and `show()`, and put `data-t` on the stage cards and on the secondary navigation, inside an element that keeps `id="nav"`.** `irPara` and about 470 call sites keep working. Cost: small. Risk: the nine-label test, the Secretaria's five-label tests and the `aria-current` tests still change; the primary and secondary navigation share one id.
2. **First, a preparatory change with no behaviour change: move every direct `#nav button[data-t=…]` click and every `#dt`, `#dt-prox`, `#dt-ant` use in the tests behind two helpers (`irPara`, and a new one to change the date).** Later steps then change two helpers instead of about 20 files. Cost: one mechanical change over the tests. Risk: low.
3. **Scope the tag selectors before adding markup:** `section` to `main > section` in css/app.css:229-230 and js/views/tabs.js:17, and the print rule's `header` and `nav` to the shell's own. Cost: trivial. Risk: none found; `section.on` count 1 is tested.
4. **Scope the new layout away from the TV page**, which shares the stylesheet and has a `<main>`: a class on `index.html`'s `body`, or `body:not(.tela-painel)`. Cost: trivial. Risk: forgetting it breaks `painel.html`, which has its own tests.
5. **The rail calls `carregarData` exactly as `#dt.onchange` does**, and `abrirData` keeps being the only writer of `DATA` and `?data=`. The Sunday rule, the local-Gestor rule, the failure toast and the "one date at a time" queue stay in one place. Cost: small. Risk: the rail must show the loading state, since `DATA` changes only when the data arrives.
6. **Keep the rail inside `<main>`**, so the read-only disabling and the phone and accessibility tests reach it. Alternative: widen the selectors of js/somente-leitura.js:6-7 and css/app.css:241-245. Cost: small either way. Risk: inside `main`, the rail must respect the 44 px rule on phones.
7. **Two layout modes instead of three panes everywhere:** list, detail and rail for Alunos, INVAs, Recursos and Pedidos; one wide pane and the rail (collapsible) for Escala, Processamento, BI, Cursos, Rodízio, Manual and Minha conta. Cost: one more layout to design and test. Risk: it departs from "three panes on every screen" (conflict 4).
8. **If panes scroll on their own, expect to rework what assumes the document scrolls:** `window.scrollTo(0, 0)`, `scrollIntoView`, the `scrollY` test, and the overflow tests that read the document's width (section 5.4). Alternative: keep the document as the scroller and make only the rail and the list sticky. Cost: medium for own scrollers, small for sticky. Risk: with own scrollers the overflow tests pass without checking anything.
9. **Use container queries for the card layouts** (`@container`), because the existing phone rules key on the viewport and a narrow pane on a wide screen would not trigger them. Cost: rewrite of the three card blocks. Risk: no precedent in this stylesheet; the phone tests must still pass.
10. **Raise the cap rather than remove it, and keep the Painel's board under 1,600 px on the page**, or accept two lists there and say so in the plan. Cost: one line plus the pin in test/e2e/app.spec.js:79. Risk: conflict 6.
11. **Add the missing tokens in the three token blocks:** a selected-row background (or reuse `--info-bg`), `--okT` and `--waT` after the pattern of `--erT`, and names for pending and running. Add each new pair to the list in test/e2e/acessibilidade.spec.js:1027. Cost: small. Risk: `--mu` on `--info-bg` is 4.81 and 4.78, close to the 4.5 limit.
12. **Extend the sprite, not the stack:** new symbols for a check, an x, a spinner or dot for running, a filter; a class for filled status discs, since `.ico` is stroke only. `i-aviso` and `i-relogio` already exist. Cost: small. Risk: `painel.html` has its own sprite; no change needed there.
13. **Move `iniciais` from js/sessao.js to js/format.js and test it**, for the list avatars. For the hue, a fixed set of token pairs chosen by the record's id. Cost: small. Risk: more tokens to keep at 4.5:1 in two themes; one colour for all avatars avoids it.
14. **Drawers and the rail share the right edge.** Options: the History becomes a block of the rail or a secondary screen; or drawers keep opening over the rail and hide the date while open; the Sugestões move to the middle pane. Cost: medium (the Esc and focus tests of section 4 are many). Risk: the 17 "Esc fecha só a camada de cima" tests.
15. **One function for "redraw everything"**, replacing the five hand-written lists (section 5.8, item 5), so each new screen registers once. Cost: small, in shared files. Risk: the order of the calls matters in places (`rOut` last).
16. **Feed the rail and the badges from one place**, `atualizarSelosDaEscala`: errors, conflicts and warnings from `RES.al`, aircraft from `RES.revisao`, pending pedidos from `pedidosDaData`, unread data from `S.indisponiveis`. Items with `fKey` take the flight's time; the rest go in an untimed group. Cost: medium. Risk: the Escala's own red, conflict and yellow boxes would show the same items twice.
17. **On phones, the rail as a date button that opens the calendar in the page flow**, with the disclosure pattern of the multi-value filter (`aria-expanded`, `aria-controls`, `fecharNoEsc`), not a dialog. Cost: small. Risk: seven 44 px columns need 308 px plus gaps, more than a 320 px screen leaves inside today's paddings (section 5.5).
18. **For the sub-tasks' "open the place where it is resolved", extend `data-go`** with the view and a target to focus, on top of `show`, `mostrarVista` and `focarNoTitulo`. Putting the stage in the URL is a separate, larger choice. Cost: small for the extension; medium for a URL. Risk: a URL must never carry a name or personal data, and it interacts with `?data=` and `replaceState`.
19. **Shell state stays out of the data.** The selected record, the open stage and a collapsed rail are memory or `localStorage` (as the theme is), never the day or the cadastro, so no data-format step is needed. Cost: none. Risk: none.

Repo rules touched in this area:
- **`gravarAlteracao`**: nothing in the shell writes data. Two existing calls reach `save()` without it, both inside js/actions.js: `lerDadosDeNovo` (106) and `gravarEscalaCalculada` (200-202).
- **Personal data**: the shell shows the account's name and initials only. The shared link carries only the date (js/eventos/escala.js:95-102). The History drawer shows descriptions of at most 500 characters (js/actions.js:205-206).
- **The pure engine**: js/engine.js:932 has the text "(aba Recursos)" in a rejection reason. Renaming screens means editing a string in the engine file. No golden contains it today (grep over `test/fixtures/goldens-do-motor`).
- **Fictitious names**: the header tests use invented account names (test/e2e/acessibilidade.spec.js:289).

## 8. Open questions for Pedro

1. Does the BI keep its own "Data base", or does it follow the rail's date?
2. With one date for everything: after 13:00, does Pedidos move the whole app to the first date still open for requests, or show the open date as closed? Can a Sunday be picked in the rail (to see "não opera"), or is it disabled? Do the month arrows change only the month shown?
3. In local mode, may the Gestor change the date? Today the header says no and the Agenda's calendar says yes.
4. Do Escala, Processamento, BI, Cursos, Rodízio, the Manual and Minha conta get three panes, or one wide pane with a collapsible rail?
5. What replaces the 1,280 px cap, and may the Painel then show two lists on the page when it reaches 1,600 px?
6. Where do the Histórico, Minha conta and Usuários, the theme switch, Sair, the local `#role-sel`, "Compartilhar" and the Manual go? May the Histórico stay a drawer on the side where the rail is?
7. Are the status dialog, "Agendar voo", "Configurar painel", the map pop-up and the Sugestões drawer outside the "no modal or pop-up" rule, since none is a cadastro record?
8. Where do notifications without a time go in a list ordered by time?
9. Should the open stage, and the selected record, survive a reload or travel in a link? Today only the date does.
10. What do the Secretaria and the Gestor see of the pipeline? Today the Secretaria has Escala, Agenda, Instrutores, Alunos and Cursos.
11. Avatars: one colour for all, as in the header today, or a hue per person?
12. Which clock decides "today" in the rail: the browser's, as the header uses, or São Paulo's, as the Agenda's deadline uses?
13. Does the label "Instrutores" become "INVAs"?

<!-- fim -->
