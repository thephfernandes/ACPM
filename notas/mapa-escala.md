# Mapa: The Escala tab: toolbar, views, criteria, compaction, approval and exports

Worktree `.redesenho/wt-plano` at `48875e3` (branch `linha-0-plano`). Every path is relative to it. Marks used: **(inferred)** = not read on a proving line; **(computed)** = arithmetic from CSS values; **(ran)** = confirmed by running a pure module with `node` on fictitious data.

Coverage: the 25 files of the brief were read top to bottom, plus `js/fixos.js`, `js/dias.js`, `js/storage.js`, `js/state.js`, `js/main.js`, `js/reparo.js`, `js/views/reparo.js`, `js/status.js`, `js/views/dialogo-status.js`, `js/glossario.js`, `js/categorias.js`, `js/voo.js`, `js/perfis.js`, `js/somente-leitura.js`, `js/views/selos.js`, `js/views/tabs.js`, `js/eventos/registro.js`, `navegacao.js`, `confirmacao.js`, `agendamento.js` and `test/e2e/fixtures.js`. Read in part: `js/engine.js` (lines 236-565 and 900-1097: pins, compaction call, output; the allocation loop 566-899 only by grep), `js/agendamento.js` and `js/views/agendamento.js` (entry points and the save path only), `js/instrutor-escolhido.js`, `js/eventos/demanda.js`, `js/eventos/historico.js`, `js/views/etapas.js`, `js/views/config-do-painel.js`, `js/config-do-painel.js`, `js/quadro.js`, `css/app.css` (224-562, 686-722, 1256-1340, 1395-1466, 1570-1610, the rest by grep), the Manual in `index.html` (429-649), three migrations. The other e2e specs were grepped for selectors and test names, not read whole. No e2e or database test was run; two `node` snippets ran pure modules.

Profile shorthand:
- **Edit** = on-screen role `operador`: accounts Operador and Administrador (`js/sessao.js:171`, `js/perfis.js:6`; the server counts the Administrador as `operador`: `supabase/migrations/20261111122858_contas_e_administracao.sql:5-14`). Local mode: `#role-sel` = "Operador" (`index.html:69-72`).
- **Read** = on-screen role `gestor`: accounts Gestor and Secretaria, and any screen locked after a save conflict (`js/actions.js:44-46`, `:138-139`). Local mode: `#role-sel` = "Gestor" or `?role=gestor` (`js/main.js:123`).
- The Painel (TV) account never reaches these screens (`js/sessao.js:140`).
- Edits are refused in four layers: CSS `body[data-role="gestor"] .edit-only { display: none !important }` (`css/app.css:235`); `js/eventos/registro.js:24`, `:41` (every `data-act`, `data-f`, `data-a`); `js/somente-leitura.js:5-9` (disables `main input/select` except `.flt-ctrl`); `save()` and `logChange()` return for `isGestor()` (`js/actions.js:167`, `:213`); the server's `salvar_dia` and `registrar_historico` accept only `operador` (`supabase/migrations/20261114143242_formato_e_status_do_dia.sql:18`, `20261110202010_historico_autor.sql:16`).

## 1. What exists

### 1.1 Markup of the tab

`section#s-esc.on` (`index.html:344-375`), in this order:
1. `h2` "Escala do dia" holding two inline elements: `#escala-atualizada` (`role="status"`, hidden until this browser saves) and `#selo-aprovada` (hidden unless approved) (`index.html:345`).
2. First `.bar`, the toolbar (`index.html:346-362`): view switch, "+ Agendar voo", `.cresce`, Categoria, Recurso, search, "Compartilhar", "CSV", "PDF", "Excel".
3. Second `.bar.compactacao#compactacao`, `hidden` in the markup (`index.html:366-370`): `#criterios`, `.cresce`, `#aprovacao`. Both spans are filled by JS.
4. `#out` (`index.html:372-374`): the summary, the list, the map and the Painel are drawn here by `rOut()`.

Outside `main`, used by this tab: `aside#painel-reparo.gaveta` (Sugestões, `index.html:682`), `dialog#dlg-status` (`index.html:684-695`), `dialog#dlg-painel` (`index.html:698-710`), `dialog#dlg-agendar` (`index.html:726-760`), `div#tl-pop[role="dialog"]` (`index.html:762`), `aside#historico.gaveta` (`index.html:667-675`), `#toast-box`, `#anuncio` (`index.html:764-765`). Tab button: `#nav button[data-t="esc"]` with the badge `#selo-esc` (`index.html:92`). The app opens on this tab (`index.html:344`; `test/e2e/app.spec.js:11-12`), except the Secretaria, moved to the Agenda (`js/main.js:134`).

### 1.2 What `rOut()` draws in `#out` (`js/views/escala.js:588-632`)

| Block | Selector | Built by | Shown when |
|---|---|---|---|
| Day numbers | `.resumo > .st` (3 `div`s) | `resumo()` `js/views/escala.js:460-465` | always (with flights or alerts) |
| Idle time | `#tempo-parado.parado[data-dica="tempo-parado"]` | `tempoParado()` `:413-420` | always |
| Rejections | `details.caixa.erros[open]` | `resumo()` `:466-469` | any alert with `t === 'err'` |
| Conflicts | `details.caixa.conflitos[open]` | `resumo()` `:472-475` | any alert with `t === 'conf'` |
| Warnings | `details.caixa.avisos` (closed) | `resumo()` `:476`, `resumoDosAvisos()` `:425-451` | any other alert |
| List | `.tw.tabela-escala > table` | `tabela()` `:499-553` | `#out[data-vista="lista"]` |
| Map | `.pn.mapa` (`.tl-legend`, `.tl-wrap`) | `renderVisualTimeline()` `:214-264` | `#out[data-vista="mapa"]` (views `eq` and `ins`) |
| Painel | `.painel-dia` (`.fids-controles`, `.fids`) | `painelDoDia()` `:558-561` | only drawn when `TL_MODE === 'painel'` (`:625`) |

- The list and the map are both in the DOM at all times; CSS shows one (`css/app.css:354-355`; `js/views/escala.js:593`, `:625`). In the Lista and Painel views the hidden map has only rows with flights, no free rows and no "+" (`:125-127`, `:580-584`).
- No flights and no alerts: `<p class="h">Nenhum voo nesta data. Marque quem vai voar na aba Demanda: a escala é montada automaticamente.</p>` plus the free-row grid in map views (`:594-603`; same text in `index.html:373`).
- Flights exist but none passes the filters: "Nenhum voo na escala com esses filtros." or, with `tot === 0`, "Nenhuma missão marcada na Demanda." (`:624`). When every request was rejected and no filter is set, the first text still says "com esses filtros" (`:624`).
- `rOut()` also calls `rAprovacao`, `rCompactacao`, `reancorarPopupDoMapa`, `atualizarPainelDeReparo`, `atualizarAgendamento` (`:598-601`, `:620-630`).
- Callers of `rOut()`: `js/actions.js:107`, `:141`, `:324`, `:376`; `js/main.js:137`; `js/eventos/navegacao.js:36`; `js/eventos/registro.js:44`; `js/eventos/topo.js:20`; `js/eventos/escala.js:76`, `:142`, `:239`, `:260`.

### 1.3 Modules

| File | Role |
|---|---|
| `js/views/escala.js` | Draws everything in `#out`, `#criterios`, `#aprovacao`, `#selo-aprovada`, the map popup, the History drawer list (`renderAuditPanel`, `:267-301`) |
| `js/eventos/escala.js` | Map clicks and popup, filters, exports, share link, status, instructor swap, approve/reopen, criteria, mission result, Sugestões |
| `js/eventos/navegacao.js` | `data-tl` view switch (`:33-38`), `data-fids` Painel buttons (`:40-45`), `data-recolher-tempo` (`:47-48`) |
| `js/actions.js` | `save`, `gravarAlteracao`, `gravarEscalaCalculada`, `logChange`, `lerData`, `refazerEscala` |
| `js/fixos.js` | Pins: `fixosAoAprovar`, `fixosAoReabrir`, `fixosAoMudarStatus`, `normalizarAprovacao`, `motivoDoFixo`, `limparDemanda` |
| `js/criterios.js` | The two criteria, their options, default and normalizer (20 lines) |
| `js/compactar.js` | `compactar()` local search and `custoDaEscala()` |
| `js/metricas.js` | `metricasDaEscala()` (idle time, hangar exits…), `INTERVALO_DO_HANGAR = 120` |
| `js/escala-gravada.js` | Whitelist validation of the saved schedule on load |
| `js/conflitos.js` | Code tables only: conflict codes and groups, warning codes, rejection codes, conflict texts |
| `js/export.js`, `js/csv.js`, `js/planilha.js`, `js/zip.js` | CSV, PDF, Excel |
| `js/reparo.js`, `js/views/reparo.js` | Sugestões: options and drawer |
| `js/status.js`, `js/views/dialogo-status.js` | Status details, History text, `#dlg-status` |
| `js/views/painel-aeroporto.js` | The Painel view (and the TV) |
| `js/dicas.js`, `js/glossario.js` | Tooltips for every `data-dica` |
| `js/views/selos.js` | Tab badges |

README "Estrutura" lists `js/csv.js`, `js/planilha.js`, `js/status.js`, `js/quadro.js`, `js/fixos.js`, `js/reparo.js`, `js/export.js` (`README.md:210-237`) and does not list `js/criterios.js`, `js/compactar.js`, `js/metricas.js`, `js/conflitos.js`, `js/escala-gravada.js`, `js/dicas.js`, `js/glossario.js` (grep of README, no hit).

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

"Day document" = `dia:<AAAA-MM-DD>`: table `public.dias.conteudo` (jsonb, with `versao`, `atualizado_por`, `atualizado_em`: `supabase/migrations/20261110201618_dias_e_historico.sql:11-17`) or `localStorage` key `acpm4_dia_<data>` (`js/backends/local.js:15`). Written only by `ApiClient.salvarDia` (`js/storage.js:229-242`).

| Field | Shape | Stored in | Scope | Writers | Notes |
|---|---|---|---|---|---|
| `RES` / `resultado` | `{ out[], al[], tot, revisao, data }` (+ `rej` only on BI-imported days) | memory `RES` (`js/state.js:7`); day document field `resultado` (`js/storage.js:241`) | per date | `refazerEscala()` `js/actions.js:370-371` (through `save()`); `lerData()` `:309` | On load it must pass `normalizarEscalaGravada` (`js/escala-gravada.js:103-123`, `js/storage.js:205-206`): unknown fields are dropped, one bad line discards the whole saved schedule |
| `aprovacao` | `null` or `{ em: ISO string, por: string up to 80 }` | day document (`js/dias.js:69`, `:108`) | per date; a new date starts `null` (`js/dias.js:122`) | approve `js/eventos/escala.js:205`; reopen `:214`; `limparDemanda` `js/fixos.js:115` | Normalized by `normalizarAprovacao` (`js/fixos.js:29-32`; `js/storage.js:79`). The server does not check it |
| `fixos` | `{ [fKey]: { a, b, r, insId, classKey?, escolhido?, agendado? } }` | day document (`js/dias.js:68`, `:107`) | per date; new date `{}` (`js/dias.js:122`) | status `js/eventos/escala.js:135`; approve `:204`; reopen `:213`; Sugestões `:286`; instructor swap (`escolherInstrutor`, `js/instrutor-escolhido.js:89-125`); booking (`aplicarAgendamento`, via `js/eventos/agendamento.js:35`); Demanda (`semAgendados`, `js/eventos/demanda.js:179`; `limparDemanda`, `js/fixos.js:112-114`); instructor deleted `js/eventos/cadastros.js:124`; History reverts `js/eventos/historico.js:81-95` | Normalized by `normalizarFixos` (`js/fixos.js:14-27`) |
| `fStatus` | `{ [fKey]: status }` | day document (`js/dias.js:63`) | per date | `aplicarStatus` `js/eventos/escala.js:126`; `limparDemanda` `js/fixos.js:112` | Server checks keys and values (`supabase/migrations/20261114143242_formato_e_status_do_dia.sql:29-33`) |
| `fObs` | `{ [fKey]: { motivo, texto? } or { novoInicio } }` | day document (`js/dias.js:64`) | per date | `aplicarStatus` `js/eventos/escala.js:128-130` | Free text (`texto`) stays in the day only |
| `criterios` | `{ buracos: 'inva' / 'aviao' / 'maior', horarios: 'disponibilidade' / 'preferencias' / 'fixos' }` | day document (`js/dias.js:70`, `:109`) | per date, **copied to the next new date** (`js/dias.js:120-122`) | criteria click `js/eventos/escala.js:227` | Unknown values fall back to the default (`js/criterios.js:16-20`) |
| `painel` | `{ quadro, colunas: [{ id, on }], listas }` | roster (`cadastro.painel`, `js/dias.js:53`, `:88`) | all dates | "Configurar painel" (`js/views/config-do-painel.js`, through `gravarAlteracao`) | Data format 25 |
| `resultados` | `{ situacao[], doDia[] }` | server table of results, outside the day (`js/storage.js:307-312`) | all dates / per date | `ApiClient.registrarResultado` `js/eventos/escala.js:245` | `S.resultados` is only a memory copy (`:252`) |
| History entry | `{ data, registrado_em, usuario, autor, tipo, descricao (1 to 500), reverter, reverte, importado }` | table `public.historico` (`20261110201618_dias_e_historico.sql:64-73`, `20261110202010_historico_autor.sql:3`) or `localStorage` `acpm4_historico` (`js/backends/local.js:16`) | per date | `logChange()` `js/actions.js:212-239` | Append-only on the server; `autor` = the account's name, or its e-mail when it has no name (`20261110202010_historico_autor.sql:22`) |
| `TL_MODE` | `'lista' / 'eq' / 'ins' / 'painel'` | memory (`js/state.js:10`) | session; back to `'lista'` on reload | `setTLMode` `js/eventos/navegacao.js:35` | |
| Collapsed times | `Set` of period indexes | memory (`js/views/escala.js:481`) | until reload | `alternarTempo` `:482-489` | |
| Filters | values of `#flt-esc-cat`, `#flt-esc-eq`, `#flt-esc-q` | DOM only | session | the user | Not persisted |
| Painel view state | `{ modo, tela, pausado, … }` | memory (`js/views/painel-aeroporto.js:27`) | session | `acaoDoPainel` `:306-333` | |
| `escalaSoCalculada` | boolean | memory (`js/actions.js:199`) | open date | `lerData` `:310`; `save` `:176` | |
| "Atualizada às HH:MM" | text | DOM only (`js/actions.js:178-180`) | until the date changes (`:323`) | `save()` | The time of this browser's last save, not stored |

There is **no** field for "exported", for "changed since approval", for the number of compaction moves or for any engine timing (see 5.3 and 5.4).

## 3. Controls inventory

| Label | Element (id, data-act, data-f, class) | Handler (function, file:line) | State read and written | Profiles |
|---|---|---|---|---|
| "Atualizada às HH:MM" (clock icon) | `span#escala-atualizada.atualizada[role="status"]` > `#escala-atualizada-texto`, in the `h2` (`index.html:345`) | written by `save()` `js/actions.js:178-180`; hidden by `carregarData` `:323` | reads nothing stored | shown to Edit only (only they save) |
| "Aprovada às HH:MM por &lt;nome&gt;" (padlock icon) | `span#selo-aprovada.selo-aprovada[data-dica="aprovar-escala"]`, in the `h2` (`index.html:345`) | `rAprovacao()` `js/views/escala.js:375-384` | reads `S.aprovacao.em`, `.por` | all (display) |
| "Lista" / "Por recurso" / "Por instrutor" / "Painel" | `.seg[role="group"][aria-label="Como ver a escala"] > button[data-tl="lista" / "eq" / "ins" / "painel"][aria-pressed]` (`index.html:347-352`) | document click, `js/eventos/navegacao.js:33-38` → `setTLMode` + `rOut()`; pressed state `js/views/escala.js:589-593` | writes `TL_MODE` | all |
| "+ Agendar voo" | `button#btn-agendar.btn.edit-only[data-act="agendar"][data-agendar="dia"][aria-haspopup="dialog"]` (`index.html:353`) | `aoAcionar('agendar')` `js/eventos/agendamento.js:46` → `abrirAgendamento` (`js/views/agendamento.js:333`) → `confirmarAgendamento` `js/eventos/agendamento.js:32-44` | writes the request, `S.fixos[fKey]` with `agendado`, possibly the instructor's day availability and roster weights; `gravarAlteracao('inc' or 'mod', …, reversaoDoAgendamento)` | Edit |
| "Categoria" | `label.flt-rotulo > select#flt-esc-cat.flt-ctrl`; options "Todos", "C152", "C172", "Simulador", "PA-34", "Sala Ground" (`index.html:355`; `js/categorias.js:7-13`, `:22-23`) | `onchange` → `filtrar()` `js/eventos/escala.js:86-87` | reads the DOM value in `filtrosDaEscala()` `js/views/escala.js:565-574` | all |
| "Recurso" | `label.flt-rotulo > select#flt-esc-eq.flt-ctrl`; "Todos" + the resources in the day's schedule within the category (`index.html:356`; `js/views/escala.js:569-571`, `:609-613`) | `onchange` → `filtrar()` `js/eventos/escala.js:84` | DOM value | all |
| search (placeholder "Buscar aluno, instrutor ou missão…", `aria-label="Filtrar na escala"`) | `input#flt-esc-q.flt-ctrl[type="search"]` (`index.html:357`) | document `input` → `filtrar(500)` `js/eventos/escala.js:81-83`; match on `o.s`, `o.ins`, `o.mis` with `chaveDeBusca` `js/views/escala.js:616`; count announced in `#anuncio` `js/eventos/escala.js:75-80` | DOM value | all |
| "Compartilhar" | `button#btn-share-link.btn.sec[title="Copiar o link da escala desta data (no app publicado, com login)"]` (`index.html:358`) | `onclick` `js/eventos/escala.js:106-118`: copies the URL with only `?data=<DATA>`; in local mode only a toast | reads `DATA` | all except the Secretaria (`css/app.css:188`) |
| "CSV" | `button#exp.btn.sec[title="Exportar o CSV para o lançamento no portal"]` (`index.html:359`) | `onclick` `js/eventos/escala.js:90` → `gravarEscalaCalculada(); exp()` (`js/export.js:32-35`) | reads `RES`, `S.fStatus`, `S.fObs`, `DATA`; may save the day (5.3) | all (no `edit-only`) |
| "PDF" | `button#pdf.btn.sec[title="Emitir o PDF da escala para impressão"]` (`index.html:360`) | `js/eventos/escala.js:91` → `pdf()` (`js/export.js:37-101`) | same | all |
| "Excel" | `button#xlsx.btn.sec[title="Baixar a escala no modelo Excel do aeroclube, para o lançamento no CAVOK"]` (`index.html:361`) | `js/eventos/escala.js:92` → `planilha()` (`js/export.js:119-155`) | reads `RES`, `DATA`, `S.frota`, `S.av`, `S.fStatus`, `S.fObs` (copied at the click, `:125`) | all |
| "Buracos" + "?" | `span.flt-rotulo > span` + `button.dica-btn[data-dica="buracos"][aria-label="O que é Buracos?"]`, inside `#criterios` (`js/views/escala.js:405-407`) | tooltip only (`js/dicas.js`) | — | all |
| "INVA" / "Avião" / "Maior buraco" | `.seg[role="group"][aria-label="Buracos"] > button[data-criterio="buracos"][data-valor="inva" / "aviao" / "maior"][aria-pressed][data-dica="criterio-<id>" or "criterios-travados"]`; `aria-disabled="true"` when locked (`js/views/escala.js:400-407`) | document click `js/eventos/escala.js:222-231` | writes `S.criterios.buracos`; `gravarAlteracao('mod', 'Compactação: buracos A → B')` | Edit, and only while not approved (`:224`; `js/views/escala.js:401`) |
| "Horários" + "?" | same pattern, `data-dica="horarios"`, `aria-label="O que é Horários?"` | tooltip | — | all |
| "Na disponibilidade" / "Só 1ª e 2ª" / "Não mudar" | `button[data-criterio="horarios"][data-valor="disponibilidade" / "preferencias" / "fixos"]` (`js/criterios.js:8-12`) | same handler | writes `S.criterios.horarios`; History "Compactação: horários A → B" (`js/eventos/escala.js:230`) | Edit, not approved |
| "Aprovar escala" | `span#aprovacao > button#btn-aprovar.btn.edit-only[data-dica="aprovar-escala"]`; without the instructors' hours: `disabled` + `title="As horas de voo dos instrutores não foram lidas: os limites do mês e do ano não foram conferidos"`; absent with no flights (`js/views/escala.js:385-391`) | document click `js/eventos/escala.js:197-209`; first click arms ("Confirmar aprovação", `js/eventos/confirmacao.js:23-40`) | reads `RES.out`, `S.fixos`; writes `S.fixos` (`fixosAoAprovar`), `S.aprovacao`; `gravarAlteracao('mod', 'Escala aprovada: N voo(s) fixado(s)')`; toast "Escala aprovada: os voos ficam fixos."; focus to `#btn-reabrir` | Edit |
| "Reabrir" | `span#aprovacao > button#btn-reabrir.btn.sec.edit-only[data-dica="reabrir"]` (`js/views/escala.js:384`) | same listener `js/eventos/escala.js:210-218`; arms with "Confirmar reabertura" | writes `S.fixos` (`fixosAoReabrir`), `S.aprovacao = null`; History "Escala reaberta: volta a ser refeita a cada alteração"; toast "Escala reaberta."; focus to `#btn-aprovar` | Edit |
| "N missões pedidas" / "N escaladas" / "X h de voo e aula" | `.resumo > .st > div` (`js/views/escala.js:461-465`) | display | reads `RES.tot`, rejections, `sumUniqueOperationalHours` | all |
| "XhYY INVAs parados" / "XhYY aviões parados" / "N saída(s) do hangar" | `#tempo-parado.parado[data-dica="tempo-parado"] > div` (`js/views/escala.js:413-420`) | display; `metricasDaEscala` without the cancelled flights | reads `RES.out`, `S.fStatus` | all |
| "1 missão não entrou na escala: &lt;nomes&gt;" / "N missões não entraram na escala: …" | `details.caixa.erros[open] > summary`; items `li.al.err` (`js/views/escala.js:466-469`) | native `details` | reads `RES.al` (`t: 'err'`) | all |
| "N voo(s) em conflito na escala aprovada" / "N voo(s) fixo(s) em conflito" | `details.caixa.conflitos[open] > summary`; items `li.al.conf` (`js/views/escala.js:472-475`) | native `details` | reads `RES.al` (`t: 'conf'`), `S.aprovacao` | all |
| "Sugestões" | `button.btn.quiet.edit-only[data-reparo="<fKey>"][title="O que pode voar no lugar deste voo"]`, one per conflict (`js/views/escala.js:472`) | document click `js/eventos/escala.js:267-268` → `abrirPainelDeReparo` `js/views/reparo.js:19-45` | reads `S`, `RES` (`sugerirReparos`, `js/reparo.js:22-108`) | Edit |
| "Aplicar" / "Soltar" / "Cancelar o voo" | `#painel-reparo ol.opcoes-reparo button[data-reparo-aplicar="<i>"]`; close: `#btn-fechar-reparo` (`js/views/reparo.js:27-41`) | `js/eventos/escala.js:269-294` | writes `S.fixos` (`aplicarReparo`, `js/reparo.js:119-125`) and the requests' `insId`; History "Reparo: &lt;aluno&gt; (hh:mm–hh:mm): &lt;texto&gt;" with `{ kind: 'restaurarFixos', label: '↶ Reverter' }`; cancel opens `#dlg-status` | Edit |
| "N aviso(s): …" | `details.caixa.avisos > summary`; items `li.al.warn` (`js/views/escala.js:476`) | native `details` | reads `RES.al` | all |
| List header "Horário", "Aluno", "Missão", "Recurso", "Instrutor", "Peso", "Status", (Ação) | `.tabela-escala thead th` (`js/views/escala.js:517`) | — | — | last column `edit-only` |
| "06:30 · 1º tempo N decolagem ou aula / decolagens e aulas" | `tr.win[data-w] button.win-btn[data-recolher-tempo="<w>"][aria-expanded]` (`js/views/escala.js:526`) | `js/eventos/navegacao.js:47-48` → `alternarTempo` `js/views/escala.js:482-489` | writes the memory `Set` | all |
| "+" of a time ("Agendar às HH:MM") | `button.win-agendar.edit-only[data-act="agendar"][data-agendar="w:<w>"]` (`js/views/escala.js:526`) | `aoAcionar('agendar')` | as "+ Agendar voo" | Edit |
| padlock | `svg.ico.fixo[role="img"][aria-label="<motivo>"][data-dica="voo-fixo"][data-dica-termo="<motivo>"]` (`js/views/escala.js:535-536`) | tooltip; text from `motivoDoFixo` `js/fixos.js:179-186`: "Voo fixo: &lt;status&gt;", "Voo fixo: agendado na escala", "Voo fixo: escala aprovada", "Voo fixo: instrutor escolhido na escala", "Voo fixo" | reads `o.fixo`, `S.fStatus`, `S.fixos`, `S.aprovacao` | all |
| row tags "2ª preferência", "horário livre", "horário ajustado", "fora da regra", "conflito", "sem peso", "reduzir N gal", "Turma de N alunos", noturno note | `.tag[data-dica="segunda-preferencia" / "horario-livre" / "horario-ajustado" / "fora-da-regra" / "conflito" / "sem-peso" / "reduzir-combustivel"]`, `small[data-dica="turma" / "noturno"]` (`js/views/escala.js:310-331`, `:492-495`, `:539-541`) | tooltip | reads the row and `RES.al` | all |
| instructor name (button) | `button.ins-btn[.escolhido][data-act="trocar-instrutor"][data-fkey][data-rotulo][title="Trocar o instrutor"]` (`js/views/escala.js:343-349`); plain text for Read, for a flight without `stuId` and for the Noturno return leg (`:347`) | `aoAcionar('trocar-instrutor')` `js/eventos/escala.js:148-155` swaps it for the list | — | Edit |
| instructor list | `select.ins-sel[data-a="insVoo"][data-fkey][data-rotulo]`; first option "Automático (o app escolhe)" or "&lt;nome&gt; (escolhido pelo app / Priorizar com do aluno)" (`js/views/escala.js:353-358`) | `aoMudarCampo('insVoo')` `js/eventos/escala.js:177-186`; blur/Esc restore the name `:156-172` | `escolherInstrutor(S, RES, …, { noLugar: true })`: writes the request's `insId` and `S.fixos[fKey]` with `escolhido`; History "Instrutor de &lt;quem&gt; (hh:mm–hh:mm): &lt;nome or automático&gt;" with `{ kind: 'restaurarEscolha', label: '↶ Reverter' }` | Edit |
| status | `select.st-sel.st-<classe>[data-f="fstatus"][data-fkey][aria-label="Status de <aluno>"][data-dica="status"]`; options "Pendente", "Confirmado", "Atrasado", "Em Voo", "Pousou" (shown "Concluída" on Ground and simulator), "Cancelado" (`js/views/escala.js:333-338`; `js/config.js:128`; `js/status.js:18`) | `aoMudarCampo('fstatus')` `js/eventos/escala.js:144` → `mudarStatus` `:139-143` → (`#dlg-status` for Atrasado and Cancelado) → `aplicarStatus` `:123-138` | writes `S.fStatus`, `S.fObs`, `S.fixos` (`fixosAoMudarStatus`); History "Status de &lt;aluno&gt; (hh:mm–hh:mm): &lt;texto&gt;", reason category only | Edit (`disabled` for Read, `:335`) |
| status detail | `button.st-detalhe[data-act="detalhe-status"][data-fkey][title="Alterar o detalhe do status"]`; a `span` for Read and for Em Voo/Pousou (`js/views/escala.js:362-368`) | `aoAcionar('detalhe-status')` `js/eventos/escala.js:189-193` | writes `S.fObs` | Edit |
| "Voltar" / "Confirmar" (status dialog) | `#dlg-status #st-voltar`, `#st-confirmar` (`index.html:691-692`) | `js/views/dialogo-status.js:35-63` | returns the validated detail | Edit |
| mission code + result | `span.etapa[data-dica="missao-do-curso"]` + `select.res-sel[data-resultado="<fKey>"][data-dica="resultado"]`, options "Resultado", "Aprovado", "Reprovado" (`js/views/etapas.js:176-185`) | document `change` `js/eventos/escala.js:236-261` | `ApiClient.registrarResultado` (server), `S.resultados` in memory, then `logChange` only: **the day is not saved and `gravarAlteracao` is not used** (`:253-256`) | Edit |
| "✕" ("Tirar &lt;aluno&gt; da escala") | `td.c-acao.edit-only.acao > button.x[data-act="rm-fly"][data-id][data-mid][title="Tirar da escala"]`; absent on the return leg (`js/views/escala.js:370-372`) | `aoAcionar('rm-fly')` `js/eventos/demanda.js:184-194` | writes the request's `fly = false`; History "Tirado da escala: …" with `{ kind: 'setFly', label: '↶ Restaurar' }` | Edit |
| map legend | `.tl-legend` (`js/views/escala.js:248-259`) | — | — | all |
| "+" of a map row ("Agendar no &lt;reg&gt;" / "Agendar na Sala Ground" / "Agendar com &lt;nome&gt;") | `button.tl-agendar.edit-only[data-act="agendar"][data-agendar="r:<reg>" or "i:<insId>"]` (`js/views/escala.js:147-165`, `:199`) | `aoAcionar('agendar')` | as "+ Agendar voo" | Edit |
| free space of a map row | `.tl-track:not(.inerte)[data-r or data-ins]` (`js/views/escala.js:205`) | document click `js/eventos/escala.js:52-55` → `agendarNoMapa({ r or insId, minuto })`; minute from the click position, rounded to 5 (`:27-31`) | opens `#dlg-agendar` | Edit (`isGestor()` returns, `:53`) |
| flight bar | `button.tl-bar.<m-class>.tl-st-<status>[data-pop="<unidade>"][aria-haspopup="dialog"][aria-controls="tl-pop"][aria-expanded]` (`js/views/escala.js:192-196`) | document click `js/eventos/escala.js:40-46` → `abrirPopupDoMapa` `js/views/escala.js:70-80` | opens `#tl-pop` | all |
| map popup | `#tl-pop[role="dialog"][aria-label="Detalhes do voo"]`: status select (`data-f="fstatus"`), instructor button, "+ Aluno na turma" `button.tl-pop-btn.edit-only[data-act="agendar"][data-agendar="t:<unidade>"]`, "✕ Excluir da escala" `button.tl-pop-btn.edit-only[data-act="rm-fly"]` (`js/views/escala.js:42-65`) | the same handlers as the list; Esc and outside click `js/eventos/escala.js:47-65` | as the list | status and buttons Edit; popup itself all |
| "Missões" / "Partidas e chegadas" / "Partidas" / "Chegadas" | `.fids-controles .seg[role="group"][aria-label="Quadros do painel"] > button[data-fids="missoes" / "alternar" / "partidas" / "chegadas"]` (`js/views/painel-aeroporto.js:172`, `:184-186`; `js/config-do-painel.js:8-13`) | `js/eventos/navegacao.js:40-45` → `acaoDoPainel` `js/views/painel-aeroporto.js:306-333` | memory only (`estado.modo`) | all |
| "?" beside the boards | `button.dica-btn[data-dica="painel-missoes"]` (`js/views/escala.js:560`) | tooltip | — | all |
| "Pausar" / "Tela cheia" | `button.btn.sec[data-fids="pausar"][aria-pressed]`, `[data-fids="tela-cheia"]` (`js/views/painel-aeroporto.js:187-188`) | `acaoDoPainel` `:307-321` (`requestFullscreen` on `#out .fids`) | memory | all |
| "Configurar painel" | `button.btn.sec[data-fids="configurar"][aria-haspopup="dialog"]` (`js/views/painel-aeroporto.js:189`) | `js/eventos/navegacao.js:42` → `abrirConfigDoPainel` `js/views/config-do-painel.js:144` (`#dlg-painel`) | writes `S.painel` (roster) through `gravarAlteracao` | Edit changes; Read sees it disabled (`js/views/config-do-painel.js:20`) |
| tab badge | `span#selo-esc.aba-selo` (`index.html:92`) | `atualizarSelosDaEscala` `js/views/selos.js:20-24` | reads `RES.al`: rejections in red, otherwise the count of **all** alerts (warnings and conflicts together) in amber | all |

## 4. Rules and the tests that pin them (file and test name)

| Rule | Evidence | Test |
|---|---|---|
| Every operator change recalculates and saves data and schedule together | `js/actions.js:166-182`, `:189-195` | `test/e2e/escala-automatica.spec.js` › "cada alteração refaz a escala na hora: o avião em manutenção sai e, religado, volta" |
| A date with no saved schedule shows the calculated one and saves it with the first change | `js/actions.js:309-310` | same file › "data sem escala gravada: a escala calculada aparece na hora e é gravada junto com a primeira alteração" |
| Exporting a merely calculated schedule saves it once; exporting again does not save again | `js/eventos/escala.js:90-92`, `js/actions.js:199-202` | same file › "exportar uma escala só calculada a grava (BI e dia seguinte); exportar de novo não grava outra vez"; › "exportar o Excel também grava a escala só calculada" |
| Read-only profiles export without saving and see the calculated schedule | `js/actions.js:167` | same file › "o gestor exporta sem gravar"; › "o gestor também vê a escala calculada de uma data ainda sem escala gravada, sem gravar nada" |
| While another date is opening, export does not save | `js/actions.js:167` (`!dadosLidos`) | `test/e2e/abertura.spec.js` › "enquanto outra data abre, exportar e \"Tentar de novo\" não gravam" |
| Approve pins every flight, the badge says when and who, a new priority-5 request moves nobody, reopen undoes it | `js/eventos/escala.js:197-219`, `js/fixos.js:59-69` | `test/e2e/aprovacao.spec.js` › "aprovar fixa os voos: o selo diz quando e quem; um pedido novo de prioridade 5 não tira ninguém do lugar; reabrir volta ao normal" |
| A pinned flight that became impossible stays in place, in conflict | `js/engine.js:422-449`, `:533` | same file › "o instrutor que não vem mais: o voo fixo dele fica no lugar, em conflito"; `test/unit/fixos.test.js` › describe "Voos fixos conferidos de novo" |
| Em Voo pins without approval; Confirmado unpins outside an approved schedule; Reabrir keeps status pins | `js/fixos.js:40-53` | `test/e2e/aprovacao.spec.js` › "Em Voo fixa o voo mesmo sem aprovar"; › "fora da escala aprovada, Em Voo fixa o voo e Confirmado o solta; o cadeado diz por quê"; › "Reabrir mantém fixo o voo em andamento"; `test/unit/fixos.test.js` › describe "O cadeado do voo" |
| Aprovar keeps the `agendado` and `escolhido` marks; Reabrir does not release them | `js/fixos.js:42`, `:52-69` | `test/unit/fixos.test.js` › "Aprovar fixa cada voo da escala com as marcas: o agendado (do pino ou da linha) e o escolhido (do pino)"; › "Reabrir mantém o agendado, com os fixados pelo status e pela escolha do instrutor; o fixo só pela aprovação sai"; `test/e2e/instrutor-escolhido.spec.js` › "aprovar e reabrir a escala não soltam o voo fixo pela escolha na Escala" |
| The Gestor sees the badge and no buttons | `css/app.css:235` | `test/e2e/aprovacao.spec.js` › "no Gestor, o selo aparece e os botões não" |
| Without the instructors' hours, "Aprovar escala" is disabled | `js/views/escala.js:386-390` | `test/e2e/compartilhado.spec.js` › "sem as horas dos instrutores ou os resultados: aviso fixo, Aprovar escala desligado e \"Tentar de novo\"" |
| Approve moves the focus to Reabrir and back | `js/eventos/escala.js:209`, `:217` | `test/e2e/acessibilidade.spec.js` › "aprovar a escala leva o foco ao Reabrir, e reabrir, ao Aprovar" |
| "Limpar demanda" reopens an approved schedule | `js/fixos.js:111-115`; `js/eventos/demanda.js:81-89` | `test/unit/fixos.test.js` › "a escala aprovada é reaberta, como em Reabrir: só o voo em andamento continua fixo"; `test/e2e/demanda.spec.js:118-129` |
| The approval travels with the day | `js/dias.js:69`, `:108` | `test/unit/dias.test.js` › "a escala aprovada (os voos fixos e quem aprovou) vai e volta com o dia" |
| The exact list of the day's keys | `js/dias.js:55-72` | `test/unit/dias.test.js:31`, `:164` (`['aprovacao','av','criterios','fObs','fStatus','filas','fixos','hangar','horas','importadas','ins','pedidos','win']`) |
| Criteria defaults, normalization, kept with the day and inherited by the next date | `js/criterios.js:13-20`; `js/dias.js:120-122` | `test/unit/compactar.test.js` › "o padrão: os buracos dos INVAs, dentro da disponibilidade; valor inválido volta ao padrão"; `test/unit/dias.test.js` › "os critérios da compactação vão e voltam com o dia; sem eles, os do padrão"; `:167` |
| The criteria on screen, the idle-time box, the History text, kept after reload | `js/views/escala.js:396-420`; `js/eventos/escala.js:222-231` | `test/e2e/compactacao.spec.js` › "o padrão fecha o buraco do instrutor; \"Não mudar\" volta o voo para a 1ª preferência; o critério fica com o dia" |
| Criteria locked when approved and for the Gestor; the tooltip says why | `js/views/escala.js:401-406` | `test/e2e/compactacao.spec.js` › "com a escala aprovada, os critérios só aparecem"; › "no Gestor, os critérios do dia aparecem travados"; `test/e2e/dicas.spec.js` › "na escala aprovada, os critérios ficam travados e a dica diz por quê; o clique não muda nada" |
| Compaction invariants (same flights, hours split not worse, cost never grows, time rule and availability respected, rotation instructor kept, legal limits, pins untouched) | `js/compactar.js:75-301` | `test/unit/compactar.test.js` › describe "Compactação: em dias gerados" (8 tests over 25 seeds × 9 criteria combinations) |
| The engine's output for 41 scenarios | `js/engine.js:258-1051` | `test/unit/engine.golden.test.js` (goldens in `test/fixtures/goldens-do-motor/`, default criteria, compaction on) |
| The saved schedule is used only in the engine's format | `js/escala-gravada.js:103-123` | `test/unit/escala-gravada.test.js` › "as escalas do motor passam inteiras (o dia de exemplo e as 40 geradas), com a data"; › "um campo adulterado em qualquer linha invalida a escala gravada" |
| CSV: grouping, columns, observations, formula guard, BOM, `;`, CRLF | `js/csv.js:10-66` | `test/unit/csv.test.js` (11 tests); `test/e2e/escala.spec.js` › "exporta CSV com BOM, separador \";\" e quebras CRLF" (snapshot `escala-exemplo.csv`) |
| PDF: title, boards, more than one page, toast | `js/export.js:37-101` | `test/e2e/escala.spec.js` › "emite o PDF da escala com título, quadros e mais de uma página" |
| Weights with decimals in PDF and CSV | `js/export.js:66`; `js/csv.js:30-33` | `test/e2e/escala.spec.js` › "o PDF e o CSV levam o peso da tripulação com décimos em décimos, com a vírgula" |
| Excel: the model's structure and each flight's cell | `js/planilha.js:40-69`, `:142-252` | `test/unit/planilha.test.js` (30 tests, 60 random days); `test/e2e/planilha.spec.js` (6 tests) |
| Free text of a cancellation never leaves the app or reaches the History | `js/status.js:92-103`; `js/csv.js:22`; `js/export.js:65` | `test/unit/csv.test.js` › "observações: o detalhe do status (novo horário do atraso, motivo do cancelamento)"; `test/e2e/status.spec.js` › "\"Outro\" pede a descrição, que aparece na escala e não vai para o histórico" |
| View switch and what each view shows | `js/eventos/navegacao.js:33-38`; `css/app.css:354-355` | `test/e2e/escala-tela.spec.js` › "a barra troca entre Lista, Por recurso, Por instrutor e Painel" |
| Summary boxes and their texts | `js/views/escala.js:453-478` | `test/e2e/escala-tela.spec.js` › "resumo: os números numa linha; o que não entrou numa caixa vermelha aberta; os avisos agrupados numa caixa fechada"; › "o voo fixo em conflito sem a escala aprovada: \"voo fixo em conflito\", com o conflito do agendado" |
| Sugestões: apply, release, cancel, Esc, Gestor | `js/eventos/escala.js:266-299` | `test/e2e/reparo.spec.js` (6 tests); `test/unit/reparo.test.js` (14 tests) |
| Tab badge | `js/views/selos.js:20-24` | `test/e2e/selos.spec.js` › "Escala: o número de avisos, em âmbar"; › "Escala: missões que não entraram vêm primeiro, em vermelho; sem nada a avisar, sem selo" |
| Phones: no sideways page scroll, the map scrolls inside its panel, cards per flight | `css/app.css:519-558` | `test/e2e/celular.spec.js` › "nenhuma aba rola para o lado; o mapa rola dentro do próprio painel"; › "a escala vira um cartão por voo, com horário, aluno, missão, avião, instrutor e status à vista" |
| Painel in the page: one list of 12 rows that fits at a 1,920 px viewport; two lists only in full screen | `js/views/painel-aeroporto.js:17`, `:66-77`; `js/config-do-painel.js:24` | `test/e2e/painel-missoes.spec.js` › "na tela grande, a tela cheia da Escala tem duas listas lado a lado; na página, uma" |

## 5. Answers

### 5.1 Inventory of the tab
Section 3 is the inventory. Points that the table cannot carry:
- **The text beside Aprovar/Reabrir is not in `#aprovacao`.** `#aprovacao` holds only the button (`js/views/escala.js:384`, `:390`). The approval text is the badge `#selo-aprovada`, beside the title in the `h2` (`index.html:345`; `js/views/escala.js:378-383`).
- The bar `#compactacao` (criteria + `#aprovacao`) is hidden as one block when there are no flights and no approval (`js/views/escala.js:399`).
- Three kinds of alert exist in `RES.al`: `err` (rejection: `{ t, s, m, codigo }`, **no `stuId`, no `fKey`, no time**: `js/engine.js:581`, `:765`, `:787-792`, `:800-805`, `:964`), `conf` (conflict of a pinned flight: `{ t, s, fKey, m }`, `js/engine.js:533`; the codes are on the row, `conflitoCodigos`), `warn` (with `codigo` and sometimes `stuId`, `insId`, `fKey`: `js/engine.js:153`, `:452`, `:475`, `:924`, `:986`, `:994`, `:1005`, `:1023`; `js/status.js:144-149`).
- The rejection codes (`CODIGOS_DE_REJEICAO`, `js/conflitos.js:72-77`, "para dizer onde resolver") are only validated on load (`js/escala-gravada.js:85-90`); no view uses them to link to a screen (grep of `js/`).
- The conflict message says "Conflito na escala aprovada: …" for any pin that is not a booking, also when the schedule is not approved (a flight pinned by Em Voo whose instructor was switched off: `js/engine.js:533`; (ran)). Only the box's summary tells the two cases apart (`js/views/escala.js:474`).
- The filters (Categoria, Recurso, search) apply to the list, the map and the Painel (`js/views/escala.js:614-625`); they do **not** apply to the summary, the alert boxes, the idle-time box or the exports, which use the whole day (`:622`; `js/export.js:34`, `:42`, `:125`).
- The Painel is the fourth view of this tab: `painelDoDia(voos)` passes the filtered flights through `quadroDoDia` (student name abbreviated, reason category only) to `painelDaEscala` (`js/views/escala.js:558-561`; `js/quadro.js:146-153`). Its code is tied to `#out` by selector (`js/views/painel-aeroporto.js:27`, `:84`, `:178`, `:311`, `:313`, `:318`, `:326`; `js/views/config-do-painel.js:139`).
- Engine messages shown here name screens: "(marque em Instrutores › Cadastro)" (`js/engine.js:961`), "(aba Recursos)" (`js/engine.js:932`), "Escolha outro na Demanda ou deixe no Automático." (`js/engine.js:994`). The first is in one golden, 7 times (`test/fixtures/goldens-do-motor/cenario-06.json`).

### 5.2 Approval
**Data stored.** `S.aprovacao = { em: new Date().toISOString(), por: ApiClient.autorAtual || '' }` (`js/eventos/escala.js:205`), in the day document (`js/dias.js:69`). So *who* and *when* are stored, in the **day**, only while the schedule is approved.
- `por` is the account's name, or its e-mail when the profile has no name (`js/sessao.js:167`); in local mode it is `''` and the badge shows only the time (`test/e2e/aprovacao.spec.js:17`).
- The badge shows the time only, never the date: "Aprovada às 18:05 por Operador 01" (`js/views/escala.js:380-383`; `test/e2e/aprovacao.spec.js:71`), although `em` has the full date.
- The History gets one entry, "Escala aprovada: N voos fixados", with the History's own `autor` and time (`js/eventos/escala.js:206`). It has no revert button (no `reverter` argument).
- The server's `dias.atualizado_por`/`atualizado_em` are the day's last writer, not the approver (`20261114143242_formato_e_status_do_dia.sql:43`).

**`fixosAoAprovar(fixos, out)`** (`js/fixos.js:59-69`): every flight of `RES.out` becomes a pin `{ a, b, r, insId, classKey? }` keeping `escolhido` (from the old pin) and `agendado` (from the pin or the row); booked pins whose request is out of the schedule are kept; any other pin outside the schedule is dropped.

**Reabrir** (`js/eventos/escala.js:210-218`): `S.fixos = fixosAoReabrir(S.fixos, S.fStatus)` keeps the pins made by the operator (`escolhido` or `agendado`) and by status (Em Voo, Atrasado, Pousou, Cancelado) (`js/fixos.js:40-53`); `S.aprovacao = null` (the who/when is erased from the day); History "Escala reaberta: volta a ser refeita a cada alteração"; no revert button.

**What can still change on an approved schedule** (nothing is frozen except the criteria):

| Action | Allowed? | Evidence |
|---|---|---|
| Status of a flight | yes; the pin stays whatever the status | `js/fixos.js:44-50` (`aprovada`) |
| Instructor swap on the row | yes | `js/eventos/escala.js:177-186` |
| Sugestões (Aplicar, Soltar, Cancelar) | yes | `js/eventos/escala.js:266-294` |
| "+ Agendar voo" and the map "+" | yes; note "A escala está aprovada: o voo novo entra fixo e os outros não mudam." | `js/agendamento.js:1214` |
| "✕" Tirar da escala | yes; the pin stays in `fixos`, the flight leaves | `js/eventos/demanda.js:184-194` |
| New or changed requests in the Demanda | yes; new ones are placed around the pins and are **not pinned**; a changed pinned request becomes a conflict | `js/engine.js:556-557`, `:433-449` |
| Recursos and Instrutores of the day | yes; pinned flights become conflicts | `js/engine.js:429-446` |
| Mission result | yes | `js/eventos/escala.js:236-261` |
| Exports, Compartilhar, Painel, Configurar painel | yes | no `S.aprovacao` check in those handlers |
| Compaction criteria | **no** | `js/eventos/escala.js:224`; `js/views/escala.js:401` |
| "Limpar demanda" | yes, and it reopens the schedule | `js/fixos.js:111-115` |

- Compaction still runs on an approved day, with the stored criteria, on the flights that are not pinned (`js/compactar.js:90`).
- There is no mark for "flights added after approval": they simply have no padlock.

**What blocks approval today.**
- No flight: the button is not drawn (`js/views/escala.js:390`, `:599`, `:620`).
- The instructors' hours were not read: `disabled` with a native `title` (`js/views/escala.js:386-390`).
- Read-only role, no `RES`, or the date's data not read yet (toast "A escala ainda não abriu: nada foi mudado. …") (`js/eventos/escala.js:199`; `js/actions.js:154-158`).
- The second click within 3.5 s (`js/eventos/confirmacao.js:9`).
- **Unresolved conflicts do not block and do not warn.** Neither do rejections, warnings or missing weights: the handler never reads `RES.al` (`js/eventos/escala.js:200-209`); `fixosAoAprovar` pins a flight in conflict like any other ((ran): 2 of 2 flights pinned with one in conflict).

### 5.3 Exports
None of the three reads the on-screen filters or the approval; all three use the whole `RES` (`js/export.js:34`, `:42`, `:125`).

| Export | File | Content | Evidence |
|---|---|---|---|
| CSV | `escala-acpm-<data>.csv`, UTF-8 with BOM, `;`, CRLF | Header "Avião / Equipamento", "Horário", "Aluno", "Fase / Missão", "Instrutor", "Observações". One row per flight (cancelled ones included), grouped by type (C152, C172, PA-34, Sim. Mono, Sim. Multi, Sala Ground), then registration, then time. Observações: status other than Confirmado with the detail's category only; "Turma de Ground com N alunos"; the crew weight sum against the limit, or whose weight is missing, or the fuel to load; "Avião para para a revisão de 50 horas às HH:MM". Then, when there are alerts, a blank line and a block "Alertas;Aluno;Mensagem" where rejections are "Rejeitado" and **everything else, conflicts included, is "Aviso"**. Cells that look like formulas get an apostrophe | `js/csv.js:10-66` |
| PDF | `escala-acpm-<aaaa-mm-dd>.pdf`, A4 landscape, jsPDF from the CDN | "Escala de Voo - ACPM"; "Data da escala: … Emitida em: &lt;now&gt;"; "Missões na demanda: N Atendidas: N Horas escaladas: X Alertas: N"; main table "Horário", "Aluno", "Missão", "Equipamento", "Instrutor", "Duração", "Peso tripulação", "Encaixe", "Status" grouped by period; "Quadro por instrutor"; "Quadro por equipamento / sala"; "Alertas e pendências" ("Rejeitado" or "Aviso"); a paper signature line "Responsável pela escala: ____ Visto do Chefe de Operações: ____"; footer "ACPM - Escala de dd/mm/aaaa - Página i de n" | `js/export.js:37-101`; `index.html:18-19` |
| Excel | `escala-acpm-<data>.xlsx`, the model `modelos/escala-cavok.xlsx` filled in | Sheet `DD-MM-AAAA`; month, day, year in V31, V34, V39; per aircraft or simulator a pair of columns Aluno/Instrutor, one row per time; Ground classes by theme; only **names** of students and instructors (no weight, no status, no mission); cancelled flights are left out, delayed ones go at the new time; unavailable aircraft in red; "REVISÃO" after the 50-hour stop; what does not fit goes to A41 | `js/planilha.js:31-69`, `:142-252`; `js/export.js:105-155` |

- **Is an export recorded?** No. No field in the day, no History entry, no flag: the handlers only download and show a toast ("CSV exportado.", "PDF emitido.", "Planilha exportada.") (`js/export.js:34`, `:100`, `:153-154`; grep of `js/`, `supabase/` and `index.html` for `exportad`, `emitid`, `baixad` finds only these). The PDF prints "Emitida em" inside the file (`js/export.js:53`).
- **What exporting does to a schedule that was only calculated.** Each button calls `gravarEscalaCalculada()` first (`js/eventos/escala.js:90-92`): when `escalaSoCalculada` is true it calls `save()` (`js/actions.js:199-202`), which runs the engine again (same input, same output), writes the day with `resultado` and shows "Atualizada às HH:MM" (`js/actions.js:166-182`). No History entry is made. From then on the date counts in the BI, in the next day's aircraft hours and Rodízio, in the instructors' hours, and it is what the reception TV shows (`index.html:455`, `:613`; `js/dias.js:127-137`, `:172-180`; `js/quadro.js:146-153`).
- It does **not** save when: the role is read-only, the date's data is not read, or the schedule was already saved (`js/actions.js:167`, `:201`).
- The comment at `js/actions.js:197-198` and `docs/PLAN.md:176` say "CSV ou PDF"; the Excel does it too (`js/eventos/escala.js:92`).
- The TV shows the **saved** schedule, approved or not; "A escala de hoje ainda não foi publicada." means no saved `resultado` (`js/views/painel-aeroporto.js:151`; `js/quadro.js:146-149`).

### 5.4 The automatic schedule
**When the engine runs.**

| Moment | Call | Saved? |
|---|---|---|
| A date opens and has no valid saved schedule | `setRES(escala or escalaCalculada())` `js/actions.js:309` | no (`escalaSoCalculada = true`, `:310`) |
| Every operator change (49 `gravarAlteracao` call sites in `js/`) | `save()` → `refazerEscala()` `js/actions.js:166-168`, `:370-380` | yes, data and schedule together |
| Export of a merely calculated schedule | `gravarEscalaCalculada()` → `save()` `js/actions.js:200-202` | yes, once |
| "Tentar de novo" brought the instructors' hours | `lerDadosDeNovo()` → `save()` `js/actions.js:106` | yes |
| The booking dialog (previews on copies) | `runAllocationEngine(S)` `js/views/agendamento.js:181`, `:338`, `:356`; `js/agendamento.js:960` | no |

It does not run on a tab switch, a view switch or a filter: `rOut()` only draws (`js/views/escala.js:586-588`). A date with a valid saved schedule shows the saved one, not a fresh calculation (`js/storage.js:205-206`). Nothing is pushed between browsers; a second writer gets a version conflict and a locked screen (`js/actions.js:138-145`).

**Where the result is stored.** `RES` in memory (`js/state.js:7`) and `resultado` in the day document (`js/storage.js:241`), validated on load (`js/escala-gravada.js`).

**What the compaction is.** A step inside the one synchronous pure call `runAllocationEngine(state)`, after the placement of pins, the allocation and the hours split (`equalizarHoras`, `js/engine.js:968`): `compactar()` runs on a copy; if it made at least one move, the registration swap runs on both, and the compacted copy replaces the schedule only when `custoDaEscala` is lower (`js/engine.js:969-979`).
- It is a deterministic local search: move a flight's time, hand it to another instructor, both, or swap two flights of equal length; best move per round; caps of 200 moves, 20,000 checks, 200,000 evaluations (`js/compactar.js:1-10`, `:252-290`; `js/config.js:116`).
- It never moves pinned flights, flights with a status other than Confirmado or Pendente, Noturno, Parafuso in the C152, Ground times, the instructor of rotation flights, a chosen instructor or a "Priorizar com" instructor (`js/compactar.js:29`, `:90-97`).
- **When it runs:** always, in every engine run. There is no button and no on/off switch. The only switch-off is `opcoes.compactar === false`, used by tests and scripts and never by the app (`js/engine.js:255-258`, `:971`; grep of `js/`).
- The two "switches" are the criteria; with `horarios: 'fixos'` it still swaps instructors (`js/compactar.js:95-97`).
- The engine returns only `{ out, al, tot, revisao }` (`js/engine.js:1050`; (ran)). The number of moves that `compactar()` returns (`js/compactar.js:300`) is used once and dropped (`js/engine.js:973`). There is no status, no "running", no "failed", no timing. The only trace on a flight is the tag "Horário ajustado" for a time change (`js/compactar.js:293-299`); an instructor swap leaves none.
- Cost (ran, this machine): the frozen example day (21 flights) takes about 2.5 ms with compaction and 1.2 ms without; a 2-flight day 0.3 ms.

**For the pipeline's sub-tasks.** "motor" and "compactação" are not two runs and never fail or wait. What can be shown honestly from today's data: for the engine, `tot`, `tot − rejections` and the rejections; for compaction, the idle time and hangar exits of `metricasDaEscala` (the same numbers as `#tempo-parado`) and the count of "horário ajustado" flights.

### 5.5 The criteria as this stage's configuration
**Where.** `#criterios`, inside the second bar `#compactacao`, under the toolbar (`index.html:366-370`), drawn by `rCompactacao()` (`js/views/escala.js:396-408`).

| Group label today | Stored field | Options today, in order (label = stored value) | Default |
|---|---|---|---|
| "Buracos" | `criterios.buracos` | "INVA" = `inva`; "Avião" = `aviao`; "Maior buraco" = `maior` (`js/criterios.js:3-7`) | `inva` (`js/criterios.js:13`) |
| "Horários" | `criterios.horarios` | "Na disponibilidade" = `disponibilidade`; "Só 1ª e 2ª" = `preferencias`; "Não mudar" = `fixos` (`js/criterios.js:8-12`) | `disponibilidade` |

- The third item of each option (a sentence) is not used by the view (`js/views/escala.js:405-406` reads only id and name); the tooltips come from the glossary.
- Weights: `inva` { invaParado 1, aviaoParado 0.1, saida 10 }; `aviao` { invaParado 0.1, aviaoParado 1, saida 60 }; `maior` { quadrado 1/60 }; lost preference { p2 30, outro 60 } × priority / 3 (`js/config.js:109-114`; `js/compactar.js:44-58`).
- The "Avião" cost counts **aircraft only** (C152, C172, PA-34): `js/compactar.js:69`, `:162`, `:169`; `js/config.js:25`; the box says "aviões parados" (`js/views/escala.js:417`; `js/metricas.js:33`). Simulators and the Ground room are not in it.
- `horarios` is read only by the compaction (`js/compactar.js:77`). The engine's own placement (1st preference, 2nd, nearest free time, inside the availability) does not depend on it.
- A change is a History entry, "Compactação: buracos INVA → Avião" or "Compactação: horários Na disponibilidade → Não mudar", built from the labels (`js/eventos/escala.js:228-230`), with no revert button.

**What renaming "Avião" to "Recurso" and "Não mudar" to "Não considerar" touches** (labels only, stored values `aviao` and `fixos` kept):

| Place | Lines |
|---|---|
| The labels | `js/criterios.js:5`, `:11` (and the unused sentences `:5`, `:6`, `:11`, the comment `:1-2`) |
| Glossary (tooltips and the Manual's Glossário) | `js/glossario.js:49` ("…o dos aviões (Avião)…"), `:51` (`criterio-aviao`, termo "Avião"), `:53` ("…ou não mudar."), `:56` (`criterio-fixos`, termo "Não mudar"); `:20` and `:57` name "Horários" and "critérios" |
| Manual text | `index.html:575` ("Dois controles embaixo da barra da Escala dizem como:"), `:577` ("<b>Buracos</b>: <i>INVA</i> … <i>Avião</i> … <i>Maior buraco</i>"), `:578` ("<b>Horários</b>: … <i>Não mudar</i> …"), `:580` |
| Group labels, if they change too | `js/views/escala.js:407` ("Buracos", "Horários"; the `aria-label` "O que é Buracos?" follows) |
| History text | `js/eventos/escala.js:230`: new entries take the new labels; entries already recorded keep "Avião" and "Não mudar" for good (append-only) |
| E2E tests by label | `test/e2e/compactacao.spec.js:14`, `:23`, `:24`, `:29`, `:34`, `:42` ("Não mudar"), `:41`, `:48` ("Avião"); the header comment `:2` |
| E2E tests by id (not touched by a label change) | `test/e2e/dicas.spec.js:107`, `:149`; `test/e2e/abertura.spec.js:176-178` |
| Unit tests (ids only, not touched) | `test/unit/compactar.test.js:33-36`; `test/unit/dias.test.js:112-117`, `:161-167`; `test/unit/migracoes.test.js:133` |
| Docs | `docs/PLAN.md:242` (the record of the names) |
| Not touched | the goldens (default criteria, no labels); the CSV header "Avião / Equipamento" (`js/csv.js:13`) is another word |

Renaming the stored **ids** instead would make `normalizarCriterios` reset every saved day's choice to the default (`js/criterios.js:16-20`), so it would need a data-format step.

### 5.6 What would move to an "Aprovar" stage, what stays, and the tests that pin today's placement
**Candidates to move** (they are what the request names): the conflicts box `details.caixa.conflitos` with its "Sugestões" buttons; `#aprovacao` (Aprovar, Reabrir) and the badge `#selo-aprovada`; `#exp`, `#pdf`, `#xlsx`. Not named by the request: `#btn-share-link`.

**Stays in "Escala":** the view switch and the three views, the filters, "+ Agendar voo" and the "+" entries, the criteria and `#tempo-parado`, the day numbers, the rejections box, the warnings box, and on each flight the status, the detail, the instructor swap, the result, "✕" and the padlock.

**Couplings the move must cut or keep:**
- `resumo()` builds the three boxes in one string inside `.resumo` in `#out` (`js/views/escala.js:453-478`); the conflicts box is not separately addressable.
- The Sugestões drawer returns the focus to `#out [data-reparo="…"]` (`js/views/reparo.js:52`) and is redrawn from `rOut()` (`js/views/escala.js:600`, `:628`).
- A conflict is also marked on the flight's row (`tr.em-conflito`, the tag "conflito": `js/views/escala.js:530`, `:539`), which stays in the list.
- `rAprovacao` and `rCompactacao` write by id (`#aprovacao`, `#selo-aprovada`, `#compactacao`, `#criterios`), so the elements can be anywhere; but one `hidden` hides criteria and approval together (`js/views/escala.js:399`).
- Approve and reopen hand the focus to each other by id (`js/eventos/escala.js:209`, `:217`).
- The criteria's locked tooltip says "reabra a escala para mudar os critérios" (`js/glossario.js:57`).
- The exports need only `RES`, `S`, `DATA`, `HT` from `js/views/escala.js` (`js/export.js:7`) and the jsPDF global; nothing of `#s-esc`'s DOM.
- Print: `@media print` shows `section#s-esc` and hides `.bar` (`css/app.css:1575-1581`).
- After approval the operator's work (status, Sugestões, booking, results) happens on the list and the map (the Manual's step "Durante o dia", `index.html:452`).

**Tests that pin today's placement.** Almost every test reaches these controls through `abrirEscala(page)` (`irPara(page, 'esc')` + `#out .st` visible, `test/e2e/fixtures.js:218-221`) and then acts on a bare id, which Playwright requires to be visible. Counts by grep of `test/e2e`:

| Selector | Occurrences | Spec files |
|---|---|---|
| `#btn-aprovar` | 22 | `aprovacao` (4), `acessibilidade` (5), `demanda` (3), `agendamento` (2), `compartilhado` (2), `abertura` (2), `reparo`, `instrutor-escolhido`, `compactacao`, `dicas` (1 each) |
| `#btn-reabrir` | 8 | `aprovacao` (3), `acessibilidade` (2), `agendamento`, `demanda`, `instrutor-escolhido` |
| `#selo-aprovada` | 11 | `aprovacao` (3), `demanda` (3), `agendamento` (2), `acessibilidade`, `seguranca`, `dicas` |
| `#exp`, `#pdf`, `#xlsx` | 26 | `planilha` (11), `escala-automatica` (7), `escala` (4), `abertura` (2), `compartilhado`, `datas` |
| `details.caixa.conflitos`, `details.conflitos`, `[data-reparo]`, `#painel-reparo` | 29 lines | `reparo` (15), `acessibilidade` (6), `instrutor-escolhido` (3), `historico` (3), `aprovacao`, `escala-tela` |
| `#btn-share-link` | 3 | `compartilhado`, `perfis`, `login` |
| `#compactacao`, `#criterios`, `[data-criterio]`, `#tempo-parado` | 6 | `compactacao` (3), `dicas` (2), `abertura` (1) |

Tests that name the **container** (they break on any move, not only on a new stage):
- `test/e2e/escala-tela.spec.js` › "cada alteração mostra a hora em que a escala foi refeita": `#s-esc h2 #escala-atualizada` and `#s-esc .bar #escala-atualizada` with count 0 (`:215-218`).
- same file › "Categoria e Recurso: os dois começam em \"Todos\"…": `#s-esc label.flt-rotulo > span` must be exactly ["Categoria", "Recurso"] (`:157`), so no other `label.flt-rotulo` may enter `#s-esc`.
- same file › "a barra troca entre Lista, Por recurso, Por instrutor e Painel": `#s-esc [data-tl]` texts (`:15`).
- `test/e2e/compactacao.spec.js:11`: `page.locator('#compactacao').getByRole('button', { name, exact: true })`.
- `test/e2e/dicas.spec.js:107`, `:149`: `#criterios …`.
- `test/e2e/acessibilidade.spec.js` › "aprovar a escala leva o foco ao Reabrir, e reabrir, ao Aprovar" (`:512-519`).
- `test/e2e/reparo.spec.js` and `acessibilidade.spec.js:766`: `#out details.caixa.conflitos …`, `#out details.conflitos [data-reparo]`.
- The tab loops over `['esc','dem','age','rec','ins','alu','cur','rod','bi']` (`test/e2e/celular.spec.js:32`, `:51`; `test/e2e/seguranca.spec.js:95`), and `irPara` itself (`#nav button[data-t="…"]`, `#s-…`, `test/e2e/fixtures.js:88-91`).
- `abrir()` waits for `#wins input[data-a="win"]`, the Janelas de operação (`test/e2e/fixtures.js:65`): every e2e test that starts in local mode depends on that element (area B removes it).

### 5.7 Width
Today the tab assumes the full content width: `main { max-width: 1280px; padding: 16px }` (`css/app.css:228`), about 1,248 px of content.

| Part | Fixed minimum | What a middle pane of about 48 % does to it |
|---|---|---|
| Toolbar | built to fit one line at 1,280 px: "Até 1400 px, a barra da Escala fica numa linha só sem os ícones" (`css/app.css:309-310`); `.bar { flex-wrap: wrap }` (`:300`) | 12 controls wrap into three lines or more (inferred) |
| Summary | `details.caixa { flex: 1; min-width: 280px }` (`css/app.css:317`) | the boxes stack |
| List | `.tabela-escala table { min-width: 760px }` inside `.tw { overflow-x: auto }` (`css/app.css:325`, `:561`) | scrolls sideways inside its panel |
| List as cards | only under `@media (max-width: 640px)`, a **viewport** query (`css/app.css:523-558`); the stylesheet has no container query (grep) | on a desktop viewport the cards never switch on, however narrow the pane |
| Map | `.mapa .tl-wrap { min-width: 720px }`, `.mapa { overflow-x: auto }` (`css/app.css:519-520`); label column 155 px + 10 px gap (`:1283`, `:1290`); the axis starts at 06:00 and ends at 18:00 or the last landing (`js/views/escala.js:219-220`) | at 1,280 px the track has about 1,053 px, 88 px per hour; in a pane of about 600 px it stays at the 720 px minimum and scrolls, 46 px per hour, with two lines of text per bar (computed) |
| Click-to-book on the map | the minute comes from the click's fraction of the track, rounded to 5 min (`js/eventos/escala.js:27-31`) | still works, with 1.3 min per pixel at the minimum width (computed) |
| Painel | `.fids-topo` and `table.fids-tabela { min-width: 860px }`, `.fids { overflow-x: auto }` (`css/app.css:373-391`) | scrolls sideways; the test "na tela grande, a tela cheia da Escala tem duas listas lado a lado; na página, uma" requires it to fit in the page at a 1,920 px viewport (`test/e2e/painel-missoes.spec.js:119`) |
| Painel, two lists | only from 1,600 px of board width (`js/config-do-painel.js:24`), so never in the page on Automático (`docs/PLAN.md:456`) | unchanged; "Tela cheia" does not depend on the pane (`js/views/painel-aeroporto.js:317-320`) |
| Map popup | `#tl-pop { position: fixed; width: min(280px, …) }` (`css/app.css:1399-1403`) | works in any pane; may cover the rail |
| Drawers (Histórico, Sugestões) | `.gaveta { position: fixed; right: 0; width: min(440px, 100vw) }` (`css/app.css:1455-1456`) | cover the whole right rail (about 280 px at 1,280) and part of the middle pane (computed) |

Widths of the request's split (computed): at the 1,280 px cap, about 374 / 599 / 275 px; at a 1,920 px viewport without the cap, about 576 / 922 / 422 px. Only the second fits the Painel (860) and the list (760) in the middle pane. With the list and detail panes joined (about 78 %): 973 px at the cap, which fits all three.

## 6. Conflicts with the request

1. **"Não considerar" inverts what `fixos` does.** The request files "Não considerar (today \"Não mudar\")" under "Prioridade de horários dos alunos". In the code `horarios: 'fixos'` means the compaction never changes a flight's time: the time the engine chose from the student's preferences is kept, and only instructors may swap (`js/compactar.js:95`; `js/criterios.js:11`; `js/glossario.js:56`). "Do not consider the students' time priority" reads as the opposite (move freely).
2. **"Recurso" is not what `aviao` measures.** The request renames "Avião" to "Recurso". The cost counts aircraft only (C152, C172, PA-34) and hangar exits; simulators and the Ground room are not counted (`js/compactar.js:48-53`, `:69`, `:162`, `:169`; `js/config.js:25`; `js/metricas.js:33`), and the box beside it says "aviões parados" (`js/views/escala.js:417`). "Maior buraco, whichever kind" is likewise instructor or aircraft only (`js/criterios.js:6`).
3. **The group names differ.** The request calls the two settings "Redução de ociosidade" and "Prioridade de horários dos alunos"; on screen they are "Buracos" and "Horários" (`js/views/escala.js:407`), and the glossary and Manual use those words (`js/glossario.js:49`, `:53`; `index.html:577-578`). The option order also differs: today "Na disponibilidade", "Só 1ª e 2ª", "Não mudar" (`js/criterios.js:8-12`); the request lists "Só 1ª e 2ª | Na disponibilidade | Não considerar".
4. **`horarios` is not the students' time priority in the engine.** It only limits how far the compaction may move a time (`js/compactar.js:77`, `:95`, `:111-112`). The engine's placement by 1st and 2nd preference and availability never reads it. Presented as "this stage's configuration: priority of the students' times", it would promise more than it does.
5. **"These … stay as they are" against the two renames.** Keeping the stored values and changing only labels is compatible; the request does not say which it means (see 5.5).
6. **"motor" and "compactação" are not separate tasks with states.** One synchronous pure call does pins, allocation, hours split, compaction and registration swap in milliseconds and returns `{ out, al, tot, revisao }` (`js/engine.js:968-979`, `:1050`). There is nothing "pending", "running" or "failed", no duration and no move count to show; and two steps the list omits exist (the hours split and the registration swap).
7. **"exportada" has no data.** The request's Aprovar sub-task "exportada" assumes a state. No export is recorded anywhere (5.3).
8. **"aprovada por quem e quando" exists only while approved.** Reabrir and "Limpar demanda" erase it from the day (`js/eventos/escala.js:214`; `js/fixos.js:115`); afterwards only the History entries remain. The badge has no date, and `por` may be an e-mail (`js/sessao.js:167`).
9. **"Approval exists as a control in the Escala toolbar (`#aprovacao`…)".** `#aprovacao` is in the second bar `#compactacao`, with the criteria, not in the toolbar (`index.html:366-370`); the approval text is `#selo-aprovada` in the title (`index.html:345`).
10. **"unresolved conflicts, approve or reopen, then the exports" is not today's order, and nothing enforces any order.** Conflicts do not block approval (5.2). Most conflicts can only exist *after* approval, since a conflict needs a pinned flight (`js/engine.js:399-534`); before it, only flights pinned by status, by a chosen instructor or by a booking can conflict (`js/views/escala.js:474`). Exports work on any schedule, approved or not, for every profile that sees the tab (`index.html:359-361`; `js/eventos/escala.js:90-92`). The Manual's routine downloads in step 5 and approves in step 6 (`index.html:449-450`).
11. **Aprovar is not where the work ends.** After approval the operator keeps working on the schedule all day: status, Sugestões, bookings, results (`index.html:452`; 5.2 table). A "last stage" that holds the conflicts would be visited repeatedly during the operation, while the status changes stay on the list and the map.
12. **The rail's "notifications of that date" with "a time at the left".** Rejections carry no time, no flight key and no student id, only a name and a text (`js/engine.js:964`); most warnings carry no flight key either (5.1). `js/conflitos.js`, named as a source, holds only code tables; the conflicts are in `RES.al` and on the rows. The badge `selo-esc` is a count that mixes warnings and conflicts (`js/views/selos.js:23-24`).
13. **"Three panes on every screen" against the maps and the Painel.** Their fixed minimums (720 and 860 px) do not fit a 48 % pane at the 1,280 px cap, and one test requires the Painel to fit in the page (5.7).
14. **The brief's "#aprovacao (… and the text beside it)".** There is no text in `#aprovacao` (5.1).

## 7. Implications and options for the redesign (suggestions)

Each item is a suggestion, not a finding.

1. **Rename labels only, keep the ids `aviao` and `fixos`.** Cost: the lines listed in 5.5 (two labels, four glossary texts, three Manual lines, eight lines of `compactacao.spec.js`). No data-format step, no golden. Risk: the History of past dates keeps the old words; conflicts 1 and 2 stay unless the wording is settled first (for example "Aeronave" instead of "Recurso", and a label for `fixos` that says the time is kept).
2. **If "Não considerar" is meant as a new behaviour** (the compaction ignores preferences and availability), it is a rule change: a new option value, `compactar.js` and its invariants test, the glossary, the Manual. Cost: medium. Risk: it moves students outside their availability, which every other part of the app treats as a hard limit (`js/engine.js:447-448` makes it a conflict).
3. **If "Recurso" is meant to count simulators and the Ground room,** change `custoDoAviao`'s filter and the metrics. Cost: small in code. Risk: the cost function changes for all three criteria, so the 41 goldens may change; it needs its own commit with the goldens re-recorded.
4. **Split `resumo()` into three drawers of boxes** (rejections, conflicts, warnings), each into its own container, before any move. Cost: small, and the existing selectors (`details.caixa.conflitos`) survive if the classes stay. Risk: tests that say `#out details.caixa.conflitos` (reparo, acessibilidade) need the new container.
5. **Aprovar as a screen over the same data, with one helper for the tests.** Draw there the conflicts box, Aprovar/Reabrir with the badge, and the three exports; keep the row's "conflito" tag in the list as a link to it. Add `aprovarEscala(page)` and `exportar(page, qual)` to `fixtures.js` so the 22 + 26 direct uses change in one place. Cost: medium (about 14 spec files touched mechanically). Risk: during the day the operator alternates between two stages (conflict 11); the focus hand-off and the Sugestões focus return need the new place.
6. **Decide whether conflicts block approval.** Blocking is one check of `RES.al` in the handler plus a disabled state with its reason. Cost: small. Risk: a day with a flight pinned by Em Voo in conflict could never be approved until resolved; and conflicts created after approval are unaffected, so the rule would cover the rarer case.
7. **Record exports.** (a) A History entry per export by an Edit profile ("CSV exportado"): no data-format step, but the pipeline would have to find it by text in the History, and read-only exports cannot write (`20261110202010_historico_autor.sql:16`). (b) A field in the day, for example `exportacoes: { csv: { em, por }, pdf, xlsx }`: a data-format step (26 or later, in `js/migracoes.js`, with test), `separar`/`juntar`/`diaPadrao`/`diaParaCopiar` in `js/dias.js`, the key-list tests (`test/unit/dias.test.js:31`, `:164`). Cost: medium. Risk of (b): every export becomes a write of the day, which bumps the version and locks a second operator's screen on their next save (`js/actions.js:138-145`); and "exported" goes stale after any later change, so it needs a rule (compare with the time of the last change, which the day does not store today).
8. **Keep the approval's who and when after a reopen** only if Pedro wants it: today the History already has both entries with author and time. A field in the day would be another data-format step.
9. **Compute the pipeline's Escala and Aprovar states in one pure function** from `S` and `RES` (operator pins: `fixos` with `escolhido` or `agendado`; engine: `tot`, rejections; compaction: `metricasDaEscala` and the "Horário ajustado" count; conflicts and warnings by `t`; approval: `S.aprovacao`). Cost: a small module with unit tests, no stored data. Risk: showing "motor" and "compactação" as rows with a status icon suggests they can fail; label them by their result instead.
10. **To show what the compaction changed without touching the engine's output,** run `runAllocationEngine(S, { compactar: false })` beside the normal run and compare. Cost: about one more millisecond per change on the example day (ran). Risk: two runs to keep in step; do not add fields to the engine's return (goldens, and `normalizarEscalaGravada` drops unknown fields).
11. **Width, option A: the Escala and Aprovar stages join the list and detail panes** into one wide pane beside the rail. Cost: an exception to "three panes on every screen"; little CSS. Risk: inconsistency with the cadastros. At the 1,280 px cap it gives about 973 px, enough for the list, the map and the Painel (computed).
12. **Width, option B: master–detail for the flights** (left: one row per flight by time; middle: the selected flight with status, instructor, result, padlock reason and the Sugestões inline), with the maps and the Painel opening wide. Cost: large; it replaces `tabela()` and `#tl-pop`, and `#out tbody tr:not(.win)` appears 50 times in 19 spec files. Risk: the day at a glance and click-to-book lose room; highest test churn of the area.
13. **Width, either option: raise or drop the 1,280 px cap and move the Escala's phone rules from the viewport query to the pane.** Cost: `css/app.css:523-558` and the phone tests. Risk: the 390 and 320 px tests (`celular.spec.js`, `acessibilidade.spec.js`) pin today's breakpoints.
14. **Drawers and the rail.** Histórico and Sugestões are fixed at the right edge, 440 px wide: they will cover the rail. Either they become rail content or they open over it on purpose. Cost: small to medium. Risk: 16 accessibility test declarations (two of them loops) pin the order in which Esc closes layers (`test/e2e/acessibilidade.spec.js:628-1004`).
15. **Engine texts that name screens** (`js/engine.js:932`, `:961`, `:994`) should change with the screens' names in one commit made for that: `cenario-06.json` is re-recorded (a text-only diff), and saved schedules of past dates keep the old text.

Repo rules touched in this area:
- *gravarAlteracao only:* approve, reopen, criteria, status, instructor swap and Sugestões all use it (`js/eventos/escala.js:137`, `:183`, `:206`, `:215`, `:230`, `:289`). Three paths beside it exist: the export's `gravarEscalaCalculada()` → `save()` with no History entry (`js/actions.js:200-202`); the mission result, stored by `ApiClient.registrarResultado` with `logChange` alone (`js/eventos/escala.js:245-256`); "Tentar de novo" → `save()` (`js/actions.js:106`).
- *Personal data out of CSV, PDF, BI and History:* the CSV and the PDF carry student and instructor names and the crew weight sum, and the CSV says whose weight is missing (`js/csv.js:24-34`; `js/export.js:66`); the free text of a cancellation is cut (`textoLivre: false`); the Excel carries names only. The approval's `por`, and the History's `autor`, can be an operator's e-mail when the account has no name (`js/sessao.js:167`).
- *Pure engine and goldens:* the app calls it in one place for the screen (`js/actions.js:367`) and in the booking dialog for previews (`js/views/agendamento.js:181`, `:338`, `:356`).
- *Format steps never delete:* formats 16 (approval) and 17 (criteria) are empty steps (`js/migracoes.js:129-138`); `ESQUEMA` is 25 (`js/migracoes.js:13`).
- *Fictitious names and weights:* the tests read use "Aluno 1000", "Instrutor 01", "Ana", "Bruno", "Maria Fernanda Souza"; `test/unit/planilha.test.js` › "o modelo está limpo: sem nomes…" guards the Excel model.

## 8. Open questions for Pedro

1. "Não considerar": is it only a new name for today's "Não mudar" (the compaction keeps every time), or a new behaviour where the compaction ignores the students' preferences? The two are opposite.
2. "Recurso": only a new name for a cost that counts aircraft and hangar exits, or should simulators and the Ground room start counting (a rule change, goldens re-recorded)?
3. Do the groups become "Redução de ociosidade" and "Prioridade de horários dos alunos" on screen, replacing "Buracos" and "Horários"? In which option order?
4. Should unresolved conflicts block "Aprovar escala", or stay as today (no block, no warning)? And rejections?
5. "exportada": what counts (any of the three files, or each one), by whom (the Gestor and the Secretaria export too and cannot write), and does a later change make it "not exported" again? Is a stored mark (a data-format step, one write per export) wanted, or is a History entry enough?
6. Must the schedule be approved before it can be exported? Today it need not be, and the Manual tells the operator to download first.
7. After approval the operator still changes status, uses Sugestões and books flights. Do the conflicts and Sugestões live in "Aprovar" (visited all day) or stay reachable from the flight in "Escala"?
8. Should the who and when of an approval survive a reopen (a list of approvals), and should the badge show the date?
9. Flights that enter after approval are not pinned and carry no mark. Should "Aprovar" show them (for example "N voos entraram depois da aprovação")?
10. May the Escala and Aprovar stages use a wide pane (list and detail joined, or the rail collapsed) for the maps and the Painel, as an exception to the three panes?
11. Where does "Compartilhar" go? And does the Painel stay a view of the Escala stage?
12. The CSV and the PDF carry the crew weight sum. With `peso` now among the Alunos fields the Secretaria may not edit, does it stay in the exports that the Secretaria can download?
13. Should the engine's messages that name screens ("Instrutores › Cadastro", "aba Recursos", "na Demanda") be rewritten with the new names, accepting one re-recorded golden?
<!-- fim -->
