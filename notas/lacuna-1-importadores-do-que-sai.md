# Lacuna: who imports what the redesign removes, and which elements those modules bind while they are evaluated

<!-- Discovery note for the production-line redesign. Local working note: never commit this file. -->

Read on the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to the worktree root; evidence is `path:line`. Nothing was changed in the worktree.
- **(static)** = read in the code, and counted with the ESLint parser (espree 11.2.0, the version in `package.json:22`) from scripts kept outside the repo: every `import`, `export … from` and `import()` of `js/`, `test/`, `scripts/` and the root files.
- **(ran)** = measured in Node 22.17 by loading the app's real modules under a recording fake DOM (every `document.querySelector` is logged with its caller; one selector at a time is made to return `null`), in local mode, with an in-memory `localStorage`, no network, and a fictitious roster ("Instrutor Um", "Aluno Um", "Aluno Dois"). Not run in a browser: Playwright is not installed in the worktree. The fake DOM answers every selector with an element and every `querySelectorAll` with an empty list, so each "(ran)" line was also checked against the line it cites.
- **(inferred)** = no line or run proves it.
- The scripts and their outputs are in `/private/tmp/claude-501/-Users-pedrofernandes-ACPM/5d1f0955-e20a-47d4-acd8-3ee432e7a836/scratchpad/lacuna-importadores-do-que-sai/` (`importadores.mjs`, `topo.mjs`, `avaliar.mjs`, `faltando.mjs`, `chamadas.mjs`, `gravar.mjs`, `esc.mjs`, `abertura.mjs`, `abertura-faltando.mjs`, `lint-sim.mjs`, `ciclos.mjs`, with `dom-falso.mjs` as the fake DOM); that folder is temporary and can be cleared.

## Answer

### 1. The short answer

1. **Only `js/eventos/` binds at evaluation.** None of the 25 modules of `js/views/` touches the DOM while it is evaluated (static; ran). Nine of the 15 modules of `js/eventos/` do: together they read **66 selectors of `index.html`** before `js/main.js` runs one line of its own, and **65 of them stop the load when the element is missing** (ran; the exception is `#historico`). Where they are: 38 on lines that begin with `$('#`; 7 in the top-level calls of `ligarMenu()` (`js/eventos/demanda.js:20`, `js/eventos/topo.js:65`) and `comConfirmacao()` (`js/eventos/demanda.js:81`, `js/eventos/bi.js:26`, `:78`); 1 in a `const` (`js/eventos/historico.js:19`); and **20 that no search for `$('#` finds**, because they are bound inside view functions called at the top level: `prepararFiltros()` (`js/eventos/cadastros.js:64`, 8), `prepararFiltroDosCursos()` (`js/eventos/demanda.js:61`, 3), `criarFiltroDasCategorias()` (`js/eventos/recursos.js:102`, 3) and `rManual()` (`js/eventos/topo.js:96`, 6).
2. **A second tier stops the opening after the import.** 15 more elements are read or written without a null check by what the opening calls (`js/main.js:77`, `:126`, `:135`, `:137`): the app never reaches `body[data-pronto]` (ran). Two more (`#aviso-dados`, `#aviso-dados-texto`) end in the notice "Não foi possível preparar os dados da escala…" (ran).
3. **A third tier stops the save.** `save()` redraws before it saves (`js/actions.js:168-169`): with `#revisao`, `#inst-dia-cab`, `#inst-dia`, `#out` or `#criterios` missing, `gravarAlteracao` throws and `ApiClient.salvarDia` is never called (ran).
4. **Imports.** The four event modules of the list (`demanda`, `agenda`, `cadastros`, `recursos`) export nothing and are imported once each, for their side effects, by `js/main.js:20`, `:23`, `:25`, `:27`. The view modules are held by four redraw functions: `rDem` (11 importers, 39 calls), `rIns` (7, 14), `rAlu` (7, 14), `rRec` (5, 17); plus `show` (3, 6). Every other export has one or two importers (three for `podeEditarAgenda`), mostly the event module of the same name; section 3 lists each. Removing the ten modules whole (all of the list but `js/eventos/topo.js`) leaves **31 broken import lines in 10 files** and makes the lint refuse **41 exports** of other modules (ran on a simulation of `scripts/exportacoes-sem-uso.mjs`).
5. **The lint does not look at five modules today**, among them `js/views/cadastros.js` and `js/actions.js`: an e2e test imports each with a non-destructured `import()`, which the script counts as "uses everything" (`scripts/exportacoes-sem-uso.mjs:89-96`, `:110`, `:133`).

### 2. How the event modules are evaluated, and what a missing element does

- `js/main.js` has 37 static imports (`js/main.js:18-54`): 13 for side effects (`:18-30`, the event modules) and 24 with names. 100 of the 102 files of `js/` are reachable from it (the other two are `js/painel.js` and `js/sessao-da-tv.js`). The only import cycle of the graph is `js/cursos.js` ↔ `js/rules.js`; no view, event module or `js/actions.js` is in a cycle (static).
- Evaluation order of what matters here, by position among the 100 (static, post-order as ES modules evaluate; ran, same order): `js/actions.js` 70, `js/views/tabs.js` 72, `js/eventos/navegacao.js` 73, `registro.js` 78, `agendamento.js` 79 (before `escala.js`, which imports it at `js/eventos/escala.js:15`), `confirmacao.js` 80, **`escala.js` 82, `cadastros.js` 83, `historico.js` 84, `topo.js` 88, `demanda.js` 89, `bi.js` 90, `recursos.js` 91, `conta.js` 92, `agenda.js` 93**, `rodizio.js` 94, `cursos.js` 95, `js/main.js` 100.
- **Ran:** with everything present the 37 imports evaluate without an exception. With one selector missing, the import rejects with a `TypeError` at the line the table gives and nothing later in the order is evaluated (with `#dt` missing the record ends at `js/eventos/topo.js:28`; `demanda`, `bi`, `recursos`, `conta` and `agenda` never bind). So `js/main.js:58-143` does not run: no bootstrap, no `body[data-pronto]`. The first missing element hides all the later ones. The modules evaluated before the failing one keep their `document` listeners, so the tab buttons still switch sections (`js/eventos/navegacao.js:19-32`) over a page with no data (inferred).
- Every e2e test fails on a page error: the `page` fixture collects `pageerror` and console errors and expects none (`test/e2e/fixtures.js:38-39`, `:47-52`).

**The 66 selectors, in evaluation order** (module line; `index.html` line):

| Module | Read while it is evaluated | Request item that touches the element |
|---|---|---|
| `js/eventos/escala.js` (6) | `#flt-esc-eq` (`:84`; html 356), `#flt-esc-cat` (`:86`, `:87`; 355), `#exp` (`:90`; 359), `#pdf` (`:91`; 360), `#xlsx` (`:92`; 361), `#btn-share-link` (`:106`; 358) | the exports go to the Aprovar stage (`pedido.md:52-53`) |
| `js/eventos/cadastros.js` (8), all inside `prepararFiltros()` called at `:64` (`js/views/cadastros.js:354-363`) | `#flt-ins-hab`, `#flt-ins-hab-painel`, `#flt-ins-hab .filtro-resumo` (`js/views/cadastros.js:355` → `js/views/filtro-multiplo.js:30`, `:35`, `:44`, `:81`; html 224-225); `#flt-alu-cur`, `#flt-alu-cur-painel`, `#flt-alu-cur .filtro-resumo` (`js/views/cadastros.js:359` → `js/views/filtro-dos-cursos.js:47`; html 255-256); `[data-flt="inst"]`, `[data-flt="alu"]` (`js/views/cadastros.js:362`; html 222, 253) | Alunos and INVAs become master–detail (`pedido.md:56`) |
| `js/eventos/historico.js` (4) | `#historico` (`:19`; 667; **no throw when missing**), `#btn-open-log` (`:30`; 73), `#btn-fechar-historico` (`:31`; 670), `#btn-clear-log` (`:37`; 674) | the shell (F1) |
| `js/eventos/topo.js` (17) | date part: `#dt` (`:28`, `:57`; 64), `#dt-ant` (`:55`; 59), `#dt-prox` (`:56`; 66). Rest: `#role-sel` (`:17`; 69), `#btn-menu-conta` and `#menu-conta` (`:65` → `js/dom.js:112`, `:122`; 77, 82), `#btn-theme` (`:73`; 85), six Manual targets through `rManual()` (`:96` → `js/views/manual.js:11-19`: `#manual-janelas` 515, `#manual-rodizio` 545, `#manual-pesos` 566, `#manual-combustivel` 568, `#manual-missoes tbody` 583, `#manual-glossario-lista` 619), `#btn-manual` (`:97`; 74), `#btn-conta` (`:104`; 83), `#btn-usuarios` (`:106`; 84), `#btn-tentar-dados` (`:114`; 122) | `.topo-data` is replaced by the rail (`pedido.md:90`); the rest is the shell |
| `js/eventos/demanda.js` (8) | `#btn-mais-dem` and `#menu-mais-dem` (`:20` → `js/dom.js:112`, `:139`; 315, 316), `#incluir-aluno` (`:49`, `:55`; 303), `#flt-dem-cur`, `#flt-dem-cur-painel`, `#flt-dem-cur .filtro-resumo` (`:61` → `js/views/demanda.js:127` → `js/views/filtro-dos-cursos.js:47` → `js/views/filtro-multiplo.js:30…`; 309-310), `#flt-dem-mis` (`:62`, `:63`; 311), `#clr` (`:81` → `js/eventos/confirmacao.js:43`; 317) | the Demanda table becomes Processamento (`pedido.md:33-41`) |
| `js/eventos/bi.js` (5) | `#bi-dt` (`:16`; 655), `#bi-flt-eq` (`:17`; 657), `#bi-flt-cat` (`:18`, `:20`; 656), `#btn-bi-sim` (`:26`; 659), `#btn-bi-clr` (`:78`; 660) | none (BI keeps its behaviour) |
| `js/eventos/recursos.js` (8) | `#btn-novo-recurso` (`:42`; 162), `#rec-cancelar` (`:48`; 200), `#rec-tipo` (`:52`; 195), `#form-recurso` (`:56`; 193), `#flt-rec-mat` (`:97`, `:98`; 157), `#flt-rec-cat`, `#flt-rec-cat-painel`, `#flt-rec-cat .filtro-resumo` (`:102` → `js/views/filtros-dos-recursos.js:52` → `js/views/filtro-multiplo.js:30…`; 159-160) | Recursos becomes master–detail (`pedido.md:56`, `:61-62`) |
| `js/eventos/conta.js` (4) | `#form-senha` (`:9`; 391), `#form-email` (`:26`; 402), `#nc-gerar` (`:43`; 419), `#form-nova-conta` (`:44`; 414) | none |
| `js/eventos/agenda.js` (6) | **`#importar-agenda` (`:60`; html 302, which is in the Demanda's bar)**, `#agenda-importar` (`:61`; 292), `#form-agenda` (`:133`; 281), `#ag-excecao` (`:134`; 289), `#ag-aluno` (`:135`; 282), `#ag-missao` (`:136`; 283) | Pedidos is reworked; the import goes away with the derived Processamento (`pedido.md:27-30`) |

Notes on the table:
- The filter component needs three things per use: the button `#<id>`, the panel `#<id>-painel` and a `.filtro-resumo` inside the button (`js/views/filtro-multiplo.js:30`, `:35`, `:44`, `:81`; `index.html:159`, `:224`, `:255`, `:309`). The `.filtro-grupos` it also reads is markup it writes itself (`:35-37`) and is not counted.
- `#historico` is only stored at evaluation (`const gavetaDoHistorico = $('#historico')`, `js/eventos/historico.js:19`). Missing, it throws later: on the "Histórico" button and on **every Escape key press with no drawer open**, because `gavetaDoEsc(e)` returns `null` and `null === gavetaDoHistorico` (`js/eventos/historico.js:23`, `:30`, `:32-34`; ran).
- The six modules of `js/eventos/` that bind nothing at evaluation: `navegacao`, `registro`, `confirmacao`, `agendamento`, `rodizio`, `cursos` (`js/eventos/cursos.js:605` only registers an Esc listener that reads `#form-curso` with a guard).

### 3. The eleven modules

"Importers" gives the import line and, in brackets, the lines that use the name. "Guarded" means a missing element is skipped; "unguarded" means a `TypeError` when the function runs.

#### 3.1 `js/views/demanda.js` (174 lines)

| Export | Importers |
|---|---|
| `rDem` (`:108`) | **11 modules, 39 calls**: `js/actions.js:12` (`:107`, `:140`, `:324`); `js/eventos/agenda.js:13` (`:56`); `js/eventos/agendamento.js:19` (`:39`); `js/eventos/cadastros.js:18` (`:80`, `:89`, `:98`, `:108`, `:131`, `:185`, `:222`); `js/eventos/cursos.js:33` (`:172`, `:204`, `:223`); `js/eventos/demanda.js:15` (`:45`, `:86`, `:116`, `:130`, `:144`, `:150`, `:170`, `:181`, `:192`, `:210`, `:223`); `js/eventos/escala.js:19` (`:184`, `:260`, `:292`); `js/eventos/historico.js:12` (`:60`, `:72`, `:87`, `:95`, `:106`, `:121`); `js/eventos/recursos.js:14` (`:88`, `:214`); `js/eventos/registro.js:7` (`:43`); `js/main.js:49` (`:126`) |
| `singleDemandRowHTML` (`:49`) | `js/eventos/demanda.js:15` (`:125`, `:235`, `:268`) |
| `cnt` (`:93`) | `js/eventos/demanda.js:15` (`:271`) |
| `prepararFiltroDosCursos` (`:126`) | `js/eventos/demanda.js:15` (`:61`, at evaluation) |
| `manterNaDemanda` (`:133`) | `js/eventos/demanda.js:15` (`:44`) |
| `filtrarDemanda` (`:136`) | `js/eventos/demanda.js:15` (`:58`, `:62`) |
| `conferirNenhumNaDemanda` (`:158`) | `js/eventos/demanda.js:15` (`:68`, `:270`) |
| `limparFiltrosDaDemanda` (`:168`) | `js/eventos/demanda.js:15` (`:73`) |

- No test imports it. It imports four other views: `renderAuditPanel` (`./escala.js`, `:12`), `etapaNaDemanda` (`./etapas.js`, `:13`), `criarFiltroDosCursos` and `cursoDaLinha` (`./filtro-dos-cursos.js`, `:17`), `nenhumComOsFiltros` (`./cadastros.js`, `:18`).
- Evaluated: binds nothing (`:132` is a `new Set()`).
- When called: unguarded `#dem` (`:112`, `:117`, through `trocarConteudo`, `js/dom.js:286`), `#cnt` (`:102`), `#alunos-fora` (`:105`), `#flt-dem-cur .filtro-resumo` (`:110` → `js/views/filtro-multiplo.js:63`, `:44`), and in `limparFiltrosDaDemanda` `#flt-dem` (`:169`, `:173`) and `#flt-dem-mis` (`:170`). Guarded: `#flt-dem` and `#flt-dem-mis` in the filter (`:143-144`), `#dem` in `conferirNenhumNaDemanda` (`:159-160`). `rDem` also calls `renderAuditPanel` (`:114`, `:120`), which is guarded (`js/views/escala.js:267-276`).

#### 3.2 `js/eventos/demanda.js` (273 lines)

- No export. One importer: `js/main.js:23`.
- Evaluated: the 8 selectors of section 2.
- What it registers, which other screens depend on without importing it: `aoAcionar` `usar-proxima` (`:109`), `usar-fora-da-ordem` (`:140`), `add-mis` (`:153`), `del-mis` (`:174`), **`rm-fly` (`:184`), whose buttons are drawn by the Escala** ("✕" of the list and "✕ Excluir da escala" of the map popup, `js/views/escala.js:371`, `:64`); `aoMudarCampo('d')` (`:197`), the rows `tr[data-k="d"]` of `js/views/demanda.js:71` and the `data-f="outra-missao"` select of `js/views/etapas.js:116`. Document listeners: `input` on `#flt-dem` (`:57-59`), `change` on `#onlyfly` (`:65-69`, unguarded `#dem`), `click` on `#limpar-filtros-dem` (`:72-74`).
- It imports from views: the eight names of `js/views/demanda.js` (`:15`), `renderAuditPanel` (`:16`), and `proximaDoPedido`, `outraMissaoDoPedido`, `botaoForaDaOrdem`, `confirmacaoDaMissao` (`js/views/etapas.js`, `:17`).
- A deleted `js/eventos/demanda.js` leaves the Escala's `rm-fly` buttons doing nothing, with no error and no lint message (`js/eventos/registro.js:22-23` ignores an unknown name). Tests that would notice: `test/e2e/escala.spec.js:48`.

#### 3.3 `js/views/agenda.js` (213 lines)

| Export | Importers |
|---|---|
| `podeEditarAgenda` (`:23`) | `js/actions.js:17` (`:60`, in `setRole`); `js/eventos/agenda.js:12` (`:68`, `:139`); `js/main.js:45` (`:127`) |
| `diaDaAgenda` (`:27`) | `js/eventos/agenda.js:12` (`:85`); `js/main.js:45` (`:135`) |
| `abrirAgenda` (`:59`) | `js/eventos/navegacao.js:6` (`:26`); `js/main.js:45` (`:135`) |
| `rAgenda` (`:186`) | `js/actions.js:17` (`:324`, in `carregarData`); `js/eventos/agenda.js:12` (`:56`) |
| `carregarMes` (`:65`) | `js/eventos/agenda.js:12` (`:119`, `:152`) |
| `mudarMes` (`:76`), `escolherDia` (`:84`) | `js/eventos/agenda.js:12` (`:21`, `:22`) |
| `pedidosCarregados` (`:43`), `pedidosDoAluno` (`:44`), `descreverPedido` (`:45`) | `js/eventos/agenda.js:12` (`:88`, `:110`; `:91`; `:95`) |
| `lembrarRegistradoPor` (`:93`), `preencherHorariosDaAgenda` (`:169`) | `js/eventos/agenda.js:12` (`:114`; `:136`) |

- No test imports it. `calendarioHTML` is not exported (`:118-135`); its only caller is `rAgenda` (`:190`). What exists only for the page's calendar: `gradeDoMes` (`:48-54`), `mesVisivel` (`:18`), `mudarMes`, `escolherDia`, the `data-cal` buttons (`:126-133`) and the listener of `js/eventos/agenda.js:18-27`. `diaEscolhido` (`:17`) is also the date of the pedido being registered (`js/eventos/agenda.js:85`).
- Evaluated: binds nothing.
- When called: `rAgenda` returns at `:187` until the Agenda has been opened once in the session; after that, every date change calls it (`js/actions.js:324`) and it is unguarded on `#agenda-prazo` (`:188`), `#agenda-data` (`:189`), `#agenda-cal` (`:190`), `#agenda-lista` (`:191`), `#agenda-importar` (`:193-194`), `#ag-aluno` (`:197-200`), `#ag-missao` (`:201-202`), `#form-agenda [type="submit"]` (`:211`), `#ag-excecao` (`:212`); `#ag-por` is inside a `try` (`:204-208`). `preencherHorariosDaAgenda`: `#ag-missao` (`:170`), `#ag-horas` (`:173-180`), `#ag-horario` (`:182-183`). `carregarMes`: `#ag-erro` on a failed read (`:71`).

#### 3.4 `js/eventos/agenda.js` (155 lines)

- No export. One importer: `js/main.js:27`.
- Evaluated: the 6 selectors of section 2. **`#importar-agenda` belongs to the Demanda's markup** (`index.html:302`), so taking the Demanda's bar out stops this module, not only `js/eventos/demanda.js`. The same button is rewritten, guarded, by `js/views/selos.js:56-59`.
- Registers: document `click` on `[data-cal]` (`:18-27`), which is one of the two callers of `carregarData` in the app (`:25`; the other is `js/eventos/topo.js:40`); `aoAcionar('cancelar-pedido', …, { confereAPermissao: true })` (`:155`).
- It imports from views: 11 names of `js/views/agenda.js` (`:12`), `rDem` (`:13`), `programaParaInferir` (`js/views/etapas.js`, `:14`), `lerPedidosDaData` (`js/views/selos.js`, `:15`).

#### 3.5 `js/views/cadastros.js` (451 lines)

| Export | Importers |
|---|---|
| `rIns` (`:165`) | **7 modules, 14 calls**: `js/actions.js:13` (`:107`, `:140`, `:324`); `js/eventos/agendamento.js:18` (`:39`); `js/eventos/cadastros.js:16` (`:80`, `:131`); `js/eventos/historico.js:11` (`:72`, `:79`, `:112`, `:121`); `js/eventos/recursos.js:18` (`:88`, `:157`); `js/eventos/registro.js:5` (`:43`); `js/main.js:46` (`:126`). Also `test/e2e/cadastros.spec.js:976` (`(await import('./js/views/cadastros.js')).rIns()`) |
| `rAlu` (`:286`) | **7 modules, 14 calls**: `js/actions.js:13` (`:107`, `:140`, `:324`); `js/eventos/agendamento.js:18` (`:39`); `js/eventos/cadastros.js:16` (`:80`, `:89`, `:131`, `:183`); `js/eventos/cursos.js:32` (`:172`, `:204`, `:223`); `js/eventos/escala.js:18` (`:260`); `js/eventos/registro.js:5` (`:43`); `js/main.js:46` (`:126`) |
| `rInsDia` (`:121`) | `js/actions.js:13` (`:375`, in `refazerEscala`, before every save) |
| `rPainelDoInstrutor` (`:182`) | `js/eventos/cadastros.js:16` (`:171`); `js/eventos/recursos.js:18` (`:88`) |
| `nenhumComOsFiltros` (`:428`) | `js/views/demanda.js:18` (`:163`); own use `:418` |
| `podeEditarLimites` (`:75`), `rLimites` (`:220`) | `js/eventos/cadastros.js:16` (`:231`, `:245`; `:232`, `:236`, `:238`, `:241`, `:248`) |
| `atualizarLinhaDoCadastro` (`:146`), `abrirPainelDoInstrutor` (`:234`), `fecharPainelDoInstrutor` (`:242`) | `js/eventos/cadastros.js:16` (`:182`; `:70`; `:50`, `:53`, `:116`) |
| `atualizarLinhaDoAluno` (`:297`) | `js/eventos/cadastros.js:16` (`:97`, `:107`, `:220`) |
| `prepararFiltros` (`:354`), `filtrar` (`:367`), `manterAVista` (`:374`), `limparFiltros` (`:379`) | `js/eventos/cadastros.js:16` (`:64`, at evaluation; `:62`; `:78`, `:87`; `:67`) |

- It imports from views: `canacDe` (`./dados-pessoais.js`, `:13`), `progressoDoAluno` (`./etapas.js`, `:17`), `mostrarVista` (`./vistas.js`, `:19`), `criarFiltroMultiplo` (`:20`), `criarFiltroDosCursos`, `cursosConhecidos`, `cursoDaLinha` (`:21`).
- Evaluated: binds nothing.
- When called, unguarded: `#inst` (`:170`), `#inst-dia-cab` (`:123`), `#inst-dia` (`:125-133`), `#alu` (`:289`), `#painel-instrutor` in `abrirPainelDoInstrutor` and `fecharPainelDoInstrutor` (`:235-236`, `:243-244`), the two search boxes in `limparFiltros` (`:383`, `:385`), `.filtro-resumo` of each filter on every `rIns` and `rAlu` (`:168`, `:288`, `:323`). Guarded: `#s-ins` (`js/views/vistas.js:22-23`), `#limites-lei` (`:221-222`), `#painel-instrutor` in `rPainelDoInstrutor` (`:183-184`), the table bodies in the filters (`:413-414`), `#ins-contagem` and `#alu-contagem` (`:446-447`).
- One file, two screens: Instrutores is `:23-247` (labels and groups, the day grid, the cadastro row, `rIns`, the habilitações drawer, the legal limits); Alunos is `:249-326`; `:328-451` is shared (the filter state `filtros`, `mantidos`, `multiplos`, `APLICAR`, `filtrarLinhas`, `nenhumComOsFiltros`, `contar`), with one filter function per screen inside it (`applyInstructorFilters`, `:392-397`; `aplicarFiltrosDosAlunos`, `:400-404`).

#### 3.6 `js/eventos/cadastros.js` (249 lines)

- No export. One importer: `js/main.js:20`.
- Evaluated: the 8 selectors of section 2, all through `prepararFiltros()` (`:64`).
- Registers: `aoAcionar` `editar-habs` (`:70`), `addi` (`:74`), `adds` (`:84`), `unbl` (`:92`), `unvc` (`:101`), `deli` and `dels` in one handler (`:111`); `aoMudarCampo('i')` (`:140`) and `('s')` (`:189`). Document listeners: `click` on `[data-dados]`, `#btn-fechar-dados`, `#btn-cancelar-dados` (`:24-32`); `submit` of `#form-dados` (`:36-44`); `click` on `#btn-fechar-painel-instrutor` (`:49-51`); `input` on `[data-flt]` (`:60-63`); `click` on `[data-limpar-filtros]` (`:65-68`); `change` on `[data-limite]` (`:229-242`); `click` on `[data-limites-padrao]` (`:243-249`).
- **Two Escape listeners throw when their drawer is not in the page** (ran): `gavetaDoEsc(e) === $('#painel-dados')` and `=== $('#painel-instrutor')` are `null === null` with no drawer open (`:33-35`, `:52-54`), and the close functions then dereference the missing element (`js/views/dados-pessoais.js:108-109`; `js/views/cadastros.js:243-244`). The same test for `#painel-reparo` does not throw (`js/eventos/escala.js:297-299`; ran).
- One file, two screens: Instrutores is `:49-54`, `:70-81`, `:140-186`, `:225-249`; Alunos is `:84-109`, `:189-223`; both are `:24-44` (dados pessoais), `:59-68` (filters), `:111-132` (`deli` and `dels`), `:137` (the weight field).
- It imports from views: 13 names of `js/views/cadastros.js` (`:16`), three of `js/views/dados-pessoais.js` (`:17`), `rDem` (`:18`), `mostrarVista` (`:19`).

#### 3.7 `js/views/dados-pessoais.js` (153 lines)

| Export | Importers |
|---|---|
| `canacDe` (`:16`) | `js/views/cadastros.js:13` (`:112`, `:278`) |
| `carregarDadosPessoais` (`:23`) | `js/main.js:48` (`:129`) |
| `abrirPainelDeDados` (`:54`) | `js/eventos/cadastros.js:17` (`:28`) |
| `fecharPainelDeDados` (`:107`) | `js/eventos/cadastros.js:17` (`:31`, `:34`, `:41`) |
| `salvarPainelDeDados` (`:127`) | `js/eventos/cadastros.js:17` (`:39`) |

- No test imports it. Evaluated: binds nothing.
- The only element it needs from `index.html` is `aside#painel-dados` (`index.html:680`; unguarded at `:87-88`, `:108-109`, `:128-129`). It draws the rest inside it (`:91-104`: `#painel-dados-titulo`, `#btn-fechar-dados`, `#form-dados`, `#dado-<campo>`, `#dados-erro`, `#btn-cancelar-dados`). It also writes the `.c-canac` cells of `#alu tr[data-id]` and `#inst tr[data-id]` with `querySelectorAll` (`:19-20`), which never throws.
- The personal data live in the module (`DADOS`, `:11`), outside `S`.

#### 3.8 `js/views/recursos.js` (176 lines)

| Export | Importers |
|---|---|
| `rRec` (`:144`) | **5 modules, 17 calls**: `js/actions.js:15` (`:140`, `:324`); `js/eventos/historico.js:14` (`:65`, `:72`, `:106`, `:112`); `js/eventos/recursos.js:17` (`:66`, `:88`, `:119`, `:128`, `:138`, `:144`, `:157`, `:175`, `:214`); `js/eventos/registro.js:9` (`:43`); `js/main.js:51` (`:126`) |
| `rRevisao` (`:81`) | `js/actions.js:15` (`:373`, in `refazerEscala`) |
| `rHangar` (`:154`) | `js/actions.js:15` (`:374`, in `refazerEscala`); `js/eventos/recursos.js:17` (`:167`) |
| `alternarGrupoDaFrota` (`:28`) | `js/eventos/navegacao.js:11` (`:50`) |
| `alternarAtributos` (`:100`), `aplicarFiltrosDosRecursos` (`:137`) | `js/eventos/recursos.js:17` (`:74`; `:100`, `:104`, `:111`) |

- No test imports it. It imports from views: `rHorarios` (`./horarios.js`, `:13`), `recursoAVista` and `filtrandoRecursos` (`./filtros-dos-recursos.js`, `:14`), `mostrarVista` (`:15`).
- Evaluated: binds nothing.
- When called: unguarded `#wins` (`:146`) and `#revisao` (`:90`); guarded `#s-rec` (`js/views/vistas.js:22-23`), `#hangar` (`:155-156`), `#frota` (`:107-108`), `#horarios` (`js/views/horarios.js:113-114`), `#rec-contagem` (`:129-130`).

#### 3.9 `js/eventos/recursos.js` (226 lines)

- No export. One importer: `js/main.js:25`.
- Evaluated: the 8 selectors of section 2; `:226` also registers an Esc listener that reads `#horarios` only when it fires.
- Registers: `aoAcionar` `atributos-recurso` (`:74`), `retirar-recurso` (`:149`), `hangar-subir`, `hangar-descer`, `hangar-frente` (`:162`), `revisao` (`:171`), `editar-horarios` (`:181`), `rascunho-tirar` (`:182`), `rascunho-por` (`:183`), `cancelar-horarios` (`:184`), `salvar-horarios` (`:185`); `aoMudarCampo` `atributo` (`:82`), `win` (`:115`), `av` (`:122`), `horas` (`:131`). Document listeners: `click` on `[data-limpar-recursos]` (`:106-113`), `change` of `hr-modelo` and `keydown` Enter inside `#horarios` (`:219-225`).
- In its handlers, unguarded: `#form-recurso`, `#btn-novo-recurso`, `#rec-erro`, `#rec-parafuso-rotulo`, `#rec-reg` (`:33-40`), `#rec-tipo`, `#rec-parafuso` (`:53-54`, `:59`), `#flt-rec-mat` (`:109`, `:112`).
- It imports from views: `rDem` (`:14`); four names of `js/views/filtros-dos-recursos.js` (`:15`); eight of `js/views/horarios.js` (`:16`); `rRec`, `rHangar`, `alternarAtributos`, `aplicarFiltrosDosRecursos` (`:17`); `rIns`, `rPainelDoInstrutor` (`js/views/cadastros.js`, `:18`); `mostrarVista`, `vistaDa` (`:19`).

#### 3.10 `js/views/tabs.js` (28 lines)

- One export, `show` (`:16`): `js/eventos/navegacao.js:12` (`:24` the tab and `data-go` clicks, `:60` the `data-manual` links); `js/eventos/topo.js:13` (`:98` Manual, `:104` and `:107` Minha conta and Usuários); `js/main.js:54` (`:134`, the Secretaria's opening tab). No test imports it.
- It imports `rBI` (`:2`), `rCursos` (`:3`), `rRodizio` (`:4`) and redraws them only when their tab opens (`:25-27`).
- Evaluated: binds nothing. When called it never throws on the navigation itself: every `<section>` by id `s-<t>` (`:17`; 12 sections, `index.html:126-652`, `#s-login` included), `#nav button` (`:18`), `#nav button[data-t], #btn-manual` (`:20`), all with `querySelectorAll`; the strip scroll is guarded (`:9-10`, `:24`). Of what it redraws, `rRodizio` is unguarded on `#rodizio` (`js/views/rodizio.js:11`); `rBI` and `rCursos` are guarded (`js/views/bi.js:30-31`; `js/views/cursos.js:435-436`).
- Who else reads the open tab: `js/main.js:134-135` (`$('#s-esc').classList`, `$('#s-age').classList`, the second one unguarded for every profile).

#### 3.11 `js/eventos/topo.js` (117 lines): the date part is `:23-63`

| Export | Importers |
|---|---|
| `avisoDeDomingo` (`:24`) | `js/main.js:43` (`:112`); own use `:38` |
| `iniciarTema` (`:85`) | `js/main.js:43` (`:66`, the first line of the bootstrap; unguarded `#btn-theme`, `:72`) |

- Also imported for its side effects by `js/main.js:22`. No test imports it.
- The date part: `$('#dt').onchange` (`:28-44`), `irParaDia` (`:47-54`, reads `#dt`), `#dt-ant` (`:55`), `#dt-prox` (`:56`), the click that opens the native picker (`:57-63`). Imports used only there: `carregarData` (`:3`; `:40`), `ehDomingo` (`:4`; `:35`, `:51`), `showToast` (`:5`; `:38`, `:42`), `somarDias` and `dataIsoValida` (`:6`; `:30`, `:36`, `:50-51`), `DATA`, `isGestor`, `modoCompartilhado` (`:7`; `:30-31`, `:41`, `:50`). Taking the date part out leaves these eight imports unused, which ESLint refuses (`eslint.config.js:9`, `:17`).
- Every other reader or writer of the header's date elements (static, whole repo): `abrirData` writes `#dt`, `#bi-dt`, `#dt-rotulo`, `#dt-rel` unguarded (`js/actions.js:33-40`; callers `js/main.js:77`, `:110`, `js/actions.js:302`); `setRole` disables `#dt` (guarded) and `#dt-ant`, `#dt-prox` (unguarded inside the guard, `js/actions.js:54-57`); `js/somente-leitura.js:6` (`:not(#dt)`); the BI's fallback read, guarded (`js/views/bi.js:33`; `js/eventos/bi.js:28`); `css/app.css:77-105`, `:208`, `:242`, `:244`, `:1555`, `:1587`. Tests: 129 lines in 21 e2e spec files name `#dt`, `#dt-ant`, `#dt-prox`, `#dt-rotulo`, `#dt-rel`, `.topo-data` or `.dt-semana` (the largest: `abertura.spec.js` 30, `agenda.spec.js` 17, `app.spec.js` 15, `acessibilidade.spec.js` 11, `cursos.spec.js` 10).
- `carregarData` is the app's only way to change the date after the opening, and it has two callers: `js/eventos/topo.js:40` and the Agenda's calendar (`js/eventos/agenda.js:25`).
- What stays in the module binds 14 of its 17 elements, all of the header and the Manual (section 2).

### 4. What the opening and the save need after the import

**The opening** (ran: the real `js/main.js` in local mode read 126 selectors from the first import to `body[data-pronto]`, sub-queries inside an element included; one missing at a time, 126 = 69 + 18 + 2 + 37):
- 69 stop the import: the 65 elements of section 2 and the 4 `.filtro-grupos` the filter component writes itself.
- 18 end the opening with an unhandled rejection: the 15 elements below and 3 fields inside `#form-curso`, which the Cursos view draws itself (`js/views/cursos.js:401-421`).
- **The 15 elements of `index.html` that end the opening before `body[data-pronto]`:** `#dt-rotulo`, `#dt-rel` (`js/actions.js:38-40` ← `js/main.js:77`, which comes before the session and before the `try`); `#wins`, `#revisao` (`js/views/recursos.js:146`, `:90`), `#inst`, `#inst-dia-cab`, `#inst-dia`, `#alu` (`js/views/cadastros.js:170`, `:123`, `:125`, `:289`), `#rodizio` (`js/views/rodizio.js:11`), `#dem`, `#cnt`, `#alunos-fora` (`js/views/demanda.js:117`, `:102`, `:105`), all ← `js/main.js:126`; `#s-age` (`js/main.js:135`); `#out`, `#criterios` (`js/views/escala.js:593`, `:407`) ← `js/main.js:137`.
- **2 are caught and blamed on the connection:** `#aviso-dados`, `#aviso-dados-texto` (`js/actions.js:77-78` ← `:306` ← `js/main.js:111`) throw inside the `try` of `js/main.js:94-120`, so the screen says "Não foi possível preparar os dados da escala. Verifique a conexão e recarregue a página; nada foi perdido." (`js/main.js:118`) and nothing opens.
- The other 37 selectors are guarded (some are sub-queries inside an element) and change nothing: among them `#hangar`, `#frota`, `#horarios`, `#rec-contagem`, `#limites-lei`, `#painel-instrutor`, `#ins-contagem`, `#alu-contagem`, `#cursos`, `#flt-dem`, `#historico-data`, `#log-cnt`, `#audit-log-list`, `#aprovacao`, `#selo-aprovada`, `#compactacao`, `#painel-reparo`, the four `#selo-*`, `#bi-content`, `#s-rec`, `#s-ins`.
- Not measured: shared mode (the login and `js/sessao.js`).

**The save** (ran, with `ApiClient.salvarDia` counted):
- `gravarAlteracao` (`js/actions.js:189-195`) → `save()` (`:166-182`) → `refazerEscala()` (`:168`, `:370-380`) → `rRevisao(); rHangar(); rInsDia(); rOut(); renderAuditPanel(); rBI(); atualizarSelosDaEscala();` (`:373-379`) → only then `ApiClient.salvarDia` (`:169`).
- With `#revisao`, `#inst-dia-cab`, `#inst-dia`, `#out` or `#criterios` missing: `gravarAlteracao` throws, **`salvarDia` is called 0 times**, no History entry. The change stays in memory only.
- With `#escala-atualizada-texto` or `#escala-atualizada` missing: `salvarDia` is called, then `save()` throws at `js/actions.js:179-180`, so the History entry is never written (`:192-194` are not reached).
- With `#hangar`, `#bi-content`, `#audit-log-list`, the `#selo-*`, `#importar-agenda`, `#wins`, `#dem`, `#cnt`, `#inst`, `#alu`, `#compactacao` or `#aprovacao` missing: saved, no exception.
- The same shape, not run: the course queue redraws `rAlu(); rDem();` before `enviar` (`js/eventos/cursos.js:222-224`), so a throw there leaves the program change on screen and unsent.
- After the save most handlers call their redraws (`rDem()` and the others); a throw there loses nothing but ends the handler (its toast, its focus) and fails the e2e fixture.

### 5. Helper views that go along, and who imports them

| Module | Export → importers |
|---|---|
| `js/views/etapas.js` (10 exports; 7 app modules and 2 unit tests import it) | Demanda only: `proximaDoPedido` (`:36`) → `js/eventos/demanda.js:17` (`:111`); `outraMissaoDoPedido` (`:85`) → `js/eventos/demanda.js:17` (`:124`, `:142`), `test/unit/progresso.test.js:15`; `confirmacaoDaMissao` (`:98`) → `js/eventos/demanda.js:17` (`:136`, `:146`), `progresso.test.js:15`; `botaoForaDaOrdem` (`:126`) → `js/eventos/demanda.js:17` (`:134`), `progresso.test.js:15`; `etapaNaDemanda` (`:135`) → `js/views/demanda.js:13` (`:55`), `progresso.test.js:15`. Agenda only: `programaParaInferir` (`:26`) → `js/eventos/agenda.js:14` (`:53`), `test/unit/agenda.test.js:11`. Others: `progressoDoAluno` (`:148`) → `js/views/cadastros.js:17` (`:280`, `:314`), `js/views/cursos.js:25` (`:289`), `progresso.test.js:15`; `faseDoAluno` (`:160`) → `js/views/cursos.js:25` (`:271`); `cursoDoResultado` (`:170`) → `js/eventos/escala.js:21` (`:240`), `js/views/cursos.js:25` (`:66`), `progresso.test.js:15`; `resultadoNaEscala` (`:176`) → `js/views/escala.js:15` (`:545`, `:549`) |
| `js/views/vistas.js` | `mostrarVista` (`:19`) → `js/eventos/cadastros.js:19` (`:77`), `js/eventos/navegacao.js:13` (`:53`), `js/eventos/recursos.js:19` (`:44`), `js/views/cadastros.js:19` (`:166`), `js/views/recursos.js:15` (`:145`); `vistaDa` (`:16`) → `js/eventos/recursos.js:19` (`:43`); `vistaDoBotao` (`:33`) → `js/eventos/navegacao.js:13` (`:52`) |
| `js/views/filtro-multiplo.js` | `criarFiltroMultiplo` (`:29`) → `js/views/cadastros.js:20` (`:355`), `js/views/filtro-dos-cursos.js:10` (`:47`), `js/views/filtros-dos-recursos.js:11` (`:52`) |
| `js/views/filtro-dos-cursos.js` | `criarFiltroDosCursos` (`:46`) → `js/views/cadastros.js:21` (`:359`), `js/views/demanda.js:17` (`:127`); `cursoDaLinha` (`:64`) → the same two (`:403`; `:149`); `cursosConhecidos` (`:15`) → `js/views/cadastros.js:21` (`:267`). The ticks are one `Set` for Alunos and the Demanda (`:26-27`) |
| `js/views/filtros-dos-recursos.js` (8 exports) | only `js/views/recursos.js:14`, `js/views/horarios.js:21` and `js/eventos/recursos.js:15` |
| `js/views/horarios.js` (9 exports) | `rHorarios` (`:112`) → `js/views/recursos.js:13` (`:140`); the other eight → `js/eventos/recursos.js:16` |
| `js/views/selos.js` | `atualizarSelosDaEscala` (`:20`) → `js/actions.js:18` (`:325`, `:379`), `js/main.js:53` (`:138`); `lerPedidosDaData` (`:38`) → `js/actions.js:18` (`:326`), `js/eventos/agenda.js:15` (`:120`, `:153`), `js/main.js:53` (`:139`); `atualizarSeloDaAgenda` (`:52`) → `js/actions.js:18` (`:61`) |

Other references to the eleven modules: none in `test/`, `scripts/`, `eslint.config.js`, `playwright.config.js`, `package.json` or the README besides `test/e2e/cadastros.spec.js:976` and comments (`js/reversoes.js:120`, `js/views/etapas.js:125`, `js/views/horarios.js:4`, `:29`, `js/views/filtro-multiplo.js:4`, `js/views/filtros-dos-recursos.js:6`, `js/views/cadastros.js:427`, `index.html:679`, `test/unit/reversoes.test.js:397`, `test/unit/fixos.test.js:517`, `test/unit/agenda.test.js:321`). `js/painel.js` (the TV) imports none of them (`js/painel.js:13-21`).

### 6. What `npm run lint` refuses after each removal

Ran on a copy of the script's rules (same parser, same three messages, `scripts/exportacoes-sem-uso.mjs:128-145`), with the named files treated as absent. On today's tree the simulation prints 0 problems, as the real script does. A relative import of a file that does not exist is also an error (`:66-75`). The check is first-order: an export stops counting as used only when its last importer is gone, so it has to be run again after each deletion.

| Removed | Import lines left broken | Exports the lint then refuses |
|---|---|---|
| `js/views/demanda.js`, `js/eventos/demanda.js` | 11: `js/actions.js:12`; in `js/eventos/`: `agenda.js:13`, `agendamento.js:19`, `cadastros.js:18`, `cursos.js:33`, `escala.js:19`, `historico.js:12`, `recursos.js:14`, `registro.js:7`; `js/main.js:23`, `:49` | 8: `js/fixos.js` `limparDemanda`, `semAgendados`; `js/instrutor-escolhido.js` `instrutoresDoPedido`; `js/rules.js` `opcoesDeDisponibilidade`; `js/views/etapas.js` `botaoForaDaOrdem`, `etapaNaDemanda`, `outraMissaoDoPedido` (all "só os testes usam"), `proximaDoPedido` ("só o próprio módulo usa"). Hidden by the exemption below: `js/views/cadastros.js` `nenhumComOsFiltros` |
| `js/views/agenda.js`, `js/eventos/agenda.js` | 4: `js/actions.js:17`, `js/eventos/navegacao.js:6`, `js/main.js:27`, `:45` | 7: `js/agenda.js` `hojeEmSaoPaulo`, `JANELAS_DA_AGENDA` ("ninguém usa"), `importarSolicitacoes`, `primeiraDataAberta`, `vagaDeVooLocal` ("só os testes usam"), `prazoDaData` ("só o próprio módulo usa"); `js/perfis.js` `registraNaAgenda` ("só os testes usam") |
| `js/views/cadastros.js`, `js/eventos/cadastros.js`, `js/views/dados-pessoais.js` | 12: `js/actions.js:13`; in `js/eventos/`: `agendamento.js:18`, `cursos.js:32`, `escala.js:18`, `historico.js:11`, `recursos.js:18`, `registro.js:5`; `js/main.js:20`, `:46`, `:48`; `js/views/demanda.js:18`; `test/e2e/cadastros.spec.js:976` | 6: `js/dados-pessoais.js` `formatarCpf`, `formatarCelular`; `js/format.js` `nomeLimpo`; `js/perfis.js` `veDadosPessoais` ("só os testes usam"); `js/dom.js` `focusLast` ("ninguém usa"); `js/views/filtro-dos-cursos.js` `cursosConhecidos` ("só o próprio módulo usa"). Hidden by the exemption: `js/actions.js` `mostrarNoHistorico` |
| `js/views/recursos.js`, `js/eventos/recursos.js` | 6: `js/actions.js:15`; in `js/eventos/`: `historico.js:14`, `navegacao.js:11`, `registro.js:9`; `js/main.js:25`, `:51` | 17: `js/hangar.js` `moverNoHangar` ("só os testes usam"); 6 of `js/views/filtros-dos-recursos.js` (`criarFiltroDasCategorias`, `filtrandoRecursos`, `filtrarRecursos`, `limparFiltrosDosRecursos`, `manterRecursoAVista`, `recursoAVista`); all 9 of `js/views/horarios.js`; `js/views/vistas.js` `vistaDa` |
| `js/views/tabs.js` | 3: `js/eventos/navegacao.js:12`, `js/eventos/topo.js:13`, `js/main.js:54` | 0 |
| all ten together | 31 lines in 10 files (`js/main.js` 10, `js/actions.js` 4; in `js/eventos/`: `historico.js` 3, `navegacao.js` 3, `registro.js` 3, `agendamento.js` 2, `cursos.js` 2, `escala.js` 2, `topo.js` 1; `test/e2e/cadastros.spec.js` 1) | 41 (40 as the lint runs today) |

**The exemption.** A module is skipped when any file imports it whole (`scripts/exportacoes-sem-uso.mjs:133`), and a `import()` that is not `const { a, b } = await import(…)` counts as whole (`:89-96`, `:110`). Five modules are skipped today for that reason (ran): `js/actions.js` (`test/e2e/agendamento.spec.js:342`), `js/views/cadastros.js` (`test/e2e/cadastros.spec.js:976`), `js/views/escala.js` (`test/e2e/acessibilidade.spec.js:401`, `:470`), `js/views/cursos.js` (`test/e2e/cursos.spec.js:1704`), `js/eventos/cursos.js` (`test/e2e/cursos.spec.js:420`). With the exemption switched off the simulation still prints 0 problems on today's tree, so nothing is hidden now; exports left behind in these five during the redesign would be.

### 7. Lines that parallel workstreams would edit at the same time

- **The redraw lists are written by hand in six places** (static): `js/main.js:126` (and `:137-140`); `js/actions.js:107` (`lerDadosDeNovo`), `:140-141` (`travarAposConflito`), `:324-327` (`carregarData`), `:373-379` (`refazerEscala`); `js/eventos/registro.js:43-44` (the read-only bounce).
- **21 source lines in 10 files call two or more of `rDem`, `rAlu`, `rIns`, `rRec`, `rAgenda`** (static): `js/actions.js:107`, `:140`, `:324`; `js/main.js:126`; `js/eventos/cadastros.js:80`, `:89`, `:131`; `js/eventos/agendamento.js:39`; `js/eventos/recursos.js:88`, `:157`, `:214`; `js/eventos/registro.js:43`; `js/eventos/escala.js:260`; `js/eventos/agenda.js:56`; `js/eventos/historico.js:72`, `:106`, `:112`, `:121`; `js/eventos/cursos.js:172`, `:204`, `:223`.
- **Four import lines name both an Alunos and an INVAs function:** `js/actions.js:13`, `js/eventos/agendamento.js:18`, `js/eventos/registro.js:5`, `js/main.js:46` (`rIns` with `rAlu`).
- So workstreams A (Alunos), B (Recursos), C (INVAs), D (Pedidos) and G (Processamento) of `pedido.md:128-138` all touch `js/main.js`, `js/actions.js`, `js/eventos/registro.js` and `js/eventos/historico.js`, and A and C share `js/views/cadastros.js`, `js/eventos/cadastros.js` and `js/views/dados-pessoais.js` whole (3.5 to 3.7).

### 8. The repo's rules in this area

- **`gravarAlteracao` is the only way events change data:** unchanged by anything here, but its save sits behind seven redraws (section 4). During the redesign the failure is "the change looked applied and was never saved", not a wrong save.
- **Nothing is saved before the date's data is read:** `aindaNaoAbriu` and `dadosLidos` (`js/actions.js:151-158`, `:167`, `:190`) are not touched by any of the eleven modules; `js/eventos/demanda.js:36`, `js/eventos/agenda.js:32`, `:47`, `js/eventos/recursos.js:58` and `js/eventos/cadastros.js:232`, `:245` call `aindaNaoAbriu` themselves for what does not pass through `registro.js`. A screen that replaces them has to keep those checks.
- **Personal data stay out of CSV, PDF, BI and the History:** `js/views/dados-pessoais.js` keeps them in `DADOS` (`:11`), never in `S`; the only place they reach a table is the CANAC column (`.so-dados`), through `canacDe` (`js/views/cadastros.js:112`, `:278`). A detail pane that shows CPF, CANAC or e-mail must keep reading from there (or its successor), not from the roster object that `salvarDia` writes.
- **Tests use only fictitious names:** the experiments here used "Instrutor Um", "Aluno Um", "Aluno Dois".
- The engine and the data format are not involved.

## What the maps got wrong or left out

- **mapa-outras-abas 1.2** (and 7.1 item 2) lists the elements bound at import for `historico`, `bi`, `conta`, `topo` and the Manual only: 30 of the 66. The other 36 are in `js/eventos/escala.js` (6), `cadastros.js` (8), `demanda.js` (8), `recursos.js` (8) and `agenda.js` (6); section 2 has them all. It marks the consequence as inferred, not tried: it is now run (in Node, not in a browser) and holds for 65 of 66. It is wrong for `#historico`: the element is read at `js/eventos/historico.js:19` but a missing one does not stop the import; it throws on the button and on every Escape (`:23`, `:30`, `:32-34`).
- **mapa-outras-abas 1.2** says `abrirData` writes `#dt`, `#bi-dt`, `#dt-rotulo`, `#dt-rel` "on every date load". Left out: its first call is `js/main.js:77`, before the session and outside the `try`, so a missing `#dt-rotulo` or `#dt-rel` ends the opening there (ran), and in shared mode the login is never asked for (inferred from the order of `js/main.js:77` and `:97`).
- **mapa-casca 5.8 item 5** counts five hand-written redraw lists and leaves out the sixth, `refazerEscala` (`js/actions.js:370-380`), the one that runs before `ApiClient.salvarDia` (`:168-169`). **mapa-dados 5.4** gives that order without the consequence: a redraw that throws skips the save (ran, section 4).
- **mapa-alunos 7 item 12** says the lint reports the exports left unused by removing the drawer and the row updates ("Cost: none if deletions are complete"). For `js/views/cadastros.js` and `js/actions.js` the lint reports nothing while `test/e2e/cadastros.spec.js:976` and `test/e2e/agendamento.spec.js:342` import them whole. **mapa-testes-e-docs 5.4 item 12** describes that rule but not that five modules fall under it today.
- **mapa-pedidos 5.7** gives the four importers of `js/views/agenda.js` without the names each one uses (3.3), and counts "13 importers" for the three Agenda modules: there are 14 files outside them (`js/actions.js`, `js/main.js`, `js/eventos/navegacao.js`, `js/eventos/topo.js`, `js/agendamento.js`, `js/views/conta.js`, `js/views/cursos.js`, `js/backends/local.js`, `scripts/semear-dias-previa.mjs`, `test/e2e/supabase-falso.js`, and the unit tests `agenda`, `atributos`, `instrutor-escolhido`, `progresso`). No map says that `js/eventos/agenda.js:60` binds an element of the Demanda's markup at evaluation.
- **No map** records the two Escape listeners that throw once the drawers `#painel-dados` and `#painel-instrutor` leave the page (`js/eventos/cadastros.js:33-35`, `:52-54`), nor the 15 elements of the opening (section 4), nor `js/main.js:135` reading `#s-age` unguarded for every profile.
- **mapa-alunos 7 item 8** already says A and C collide in `js/views/cadastros.js`, `js/eventos/cadastros.js` and `js/views/dados-pessoais.js`. Left out: the collision goes on in the importers (section 7), which no split of those three files removes.

## Implications for the plan (suggestions)

Facts the order of the steps has to respect (not suggestions):
- A step that takes an element of section 2 out of `index.html` must, in the same commit, remove or change the line that binds it; a step that takes an element of section 4 out must change the redraw that writes it. Otherwise that commit does not open, or does not save.
- A step that deletes one of the ten modules must edit, in the same commit, every importer of section 6 (11 lines for the Demanda, 4 for the Agenda, 12 for the cadastros, 6 for Recursos, 3 for `tabs.js`), and decide for each export the lint then refuses whether a new screen imports it or it is deleted with its tests.
- The Demanda's markup cannot leave before `js/eventos/agenda.js:60` is changed, and `js/eventos/demanda.js` cannot leave while the Escala draws `rm-fly` (`js/views/escala.js:64`, `:371`) unless `rm-fly` is registered somewhere else in the same commit.
- A new screen that reuses an old id (`#dem`, `#alu`, `#inst`, `#revisao`) while the old markup is still in the page gets the old element: `$` returns the first match (`js/dom.js:3`). Old and new cannot coexist under the same ids.

Suggestions, each with its cost and its risk:

1. **(suggestion) Keep the four redraw names as the seam until the last step.** `rDem`, `rIns`, `rAlu`, `rRec` are what the rest of the app calls (84 calls from 11 modules). A workstream that rewrites a screen can keep the name and change the body and the markup together, and the importers stay untouched; the name is renamed or removed once, in step I. Cost: none now; names that no longer describe the screen for a while (`rDem` drawing Processamento). Risk: low; it only postpones the 31 import edits.
2. **(suggestion) Or replace the hand-written lists by one registry in the foundation** (each screen registers its redraw; `js/actions.js`, `js/main.js`, `js/eventos/registro.js` and `js/eventos/historico.js` call "redraw what depends on X"). Cost: one mechanical PR over the six lists and the 21 shared lines of section 7, before F1. Risk: today's calls are selective on purpose (a row updated in place keeps the keyboard focus: `atualizarLinhaDoCadastro`, `atualizarLinhaDoAluno`, `trocarElemento` in `js/eventos/demanda.js:268`); a registry that redraws more would change focus behaviour that the e2e focus tests pin. Without 1 or 2, workstreams A, B, C, D and G conflict on the same lines of four files.
3. **(suggestion) Make the save independent of the screen, in the foundation.** In `save()`, compute the schedule, call `ApiClient.salvarDia`, then redraw; or run each redraw of `refazerEscala` through the `semFalhar` pattern the focus code already uses for the same reason (`js/dom.js:273-281`). Cost: a few lines in `js/actions.js:166-182`, `:370-380` and one test (a redraw that throws still saves and still writes the History entry). Risk: low; the order of what the user sees does not change. It removes the worst failure of a half-migrated screen (section 4).
4. **(suggestion) Turn the import-time crash into a named test failure.** A unit test that parses `js/eventos/*.js` with espree (already a devDependency, used by `scripts/exportacoes-sem-uso.mjs:9`), collects the selectors read at the top level and through `prepararFiltros`, `prepararFiltroDosCursos`, `criarFiltroDasCategorias`, `ligarMenu`, `comConfirmacao` and `rManual`, and checks each against `index.html`, as `test/unit/glossario.test.js:14-16` does for `data-dica`. Cost: about 60 lines; the list of section 2 is its expected value today. Risk: none; it fails in 1 second with the selector's name instead of in every e2e spec with a timeout.
5. **(suggestion) Alternatively, stop binding at evaluation in the modules a workstream will rebuild:** make each event module export a `ligar()` that `js/main.js` calls, or turn the `$('#id').onclick =` lines into `document` listeners with `closest('#id')`, which is already the app's main pattern (`js/eventos/registro.js:19`, `:37`). Cost: 66 lines in nine modules, plus `ligarMenu`, `comConfirmacao` and `criarFiltroMultiplo`, which take elements. Risk: a mistyped id then fails silently, so do it only together with suggestion 4.
6. **(suggestion) Close the lint's blind spot before deleting anything.** Rewrite the six lines of section 6 as `const { rIns } = await import('./js/views/cadastros.js')` and the like. Cost: six lines in four spec files; every name they use is also used by the app, so nothing new is refused. Risk: none. Without it, "delete what is replaced" is not checked in `js/views/cadastros.js`, `js/actions.js`, `js/views/escala.js`, `js/views/cursos.js` and `js/eventos/cursos.js`.
7. **(suggestion) Split the two cadastros files in the foundation, along the line ranges of 3.5 and 3.6** (an Instrutores pair, an Alunos pair, the shared filter machinery, the legal limits), with no change on screen, and move `nenhumComOsFiltros` out of `js/views/cadastros.js` so the Demanda's view stops importing the cadastros' (`js/views/demanda.js:18`). Cost: one PR that only moves code; `test/e2e/cadastros.spec.js:976` follows. Risk: low; it goes with mapa-alunos 7 item 8.
8. **(suggestion) Give F1 the whole date control, not only its markup:** the date part of `js/eventos/topo.js` (`:23-63`), the DOM half of `abrirData` and the three lines of `setRole` (`js/actions.js:33-40`, `:54-57`), `avisoDeDomingo` (which `js/main.js:112` needs), the BI's fallback read (`js/views/bi.js:33`; `js/eventos/bi.js:28`), `js/somente-leitura.js:6`, and the Agenda's calendar click (`js/eventos/agenda.js:18-27`), the second caller of `carregarData`. Cost: F1 touches `js/actions.js` and `js/eventos/agenda.js` besides the shell; 129 test lines in 21 spec files name the old control. Risk: if the calendar click stays in the Agenda module until workstream D, the app has two date controls for the length of D.
9. **(suggestion) Remove the drawers and their Escape listeners in one commit** (`aside#painel-dados`, `aside#painel-instrutor`, `index.html:678-680`, with `js/eventos/cadastros.js:24-54`). Cost: none beyond the workstream. Risk: forgetting it makes every Escape press throw, which fails every e2e test that presses Esc.
10. **(suggestion) Say in the plan, per export of section 6 that becomes "só os testes usam", what happens to it.** The pure ones are the question: `importarSolicitacoes`, `limparDemanda`, `semAgendados`, `instrutoresDoPedido`, `opcoesDeDisponibilidade`, `vagaDeVooLocal`, `primeiraDataAberta`, `moverNoHangar`, `nomeLimpo`, `formatarCpf`, `formatarCelular`. Each either gets a new importer in the screen that replaces the old one, or goes with its unit tests. Cost: a table in the plan. Risk: without it a workstream finds out at its last push that the lint refuses a function its replacement was meant to keep.

<!-- fim -->
