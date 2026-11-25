<!-- Discovery map for the production-line redesign. Local working note: never commit this file. -->

# Mapa: Cursos, Rodízio, BI, the Painel, Histórico, Manual and Minha conta

Worktree `.redesenho/wt-plano` at `48875e3` (branch `linha-0-plano`). Every path is relative to it. Marks: **(inferred)** = not read on a proving line; **(computed)** = arithmetic from CSS or code values, not measured in a browser; **(ran)** = confirmed by running a pure module or a unit test file with `node`.

Coverage: every file of the brief was read top to bottom (`js/programa.js` included, all 913 lines; `test/e2e/cursos.spec.js` lines 1-60, 134-278, 1140-1181 and 1494-1734 in full, the rest by test name; `test/e2e/painel-missoes.spec.js` lines 1-170 in full, the rest by test name). Also read in full: `js/eventos/navegacao.js`, `js/views/tabs.js`, `js/eventos/topo.js`, `js/eventos/registro.js`, `js/eventos/confirmacao.js`, `js/eventos/escala.js`, `js/views/escala.js`, `js/views/etapas.js`, `js/perfis.js`, `js/actions.js`, `js/state.js`, `js/main.js`, `js/sessao.js`, `js/somente-leitura.js`, `js/storage.js`, `js/backends/local.js`, `js/backends/supabase.js` (115-329), `js/reversoes.js`, `js/dom.js`, `js/manual.js`, `js/glossario.js`, `js/meteorologia.js`, `js/cursos.js`, `js/views/selos.js`, `js/views/vistas.js`, `test/e2e/fixtures.js`, `test/e2e/app.spec.js`, `test/e2e/contas.spec.js`, `supabase/migrations/20261114120000_resultados_de_missao.sql`. The 10 unit test files of the area's pure modules pass at this commit (118 tests, **ran**).

Profile shorthand:
- **Op**, **Adm**, **Ges**, **Sec** = the accounts Operador, Administrador, Gestor, Secretaria (`js/perfis.js:3-12`). **TV** = the account "Painel (TV da recepção)", which never reaches `index.html`: it is sent to `painel.html` (`js/sessao.js:140-147`).
- **Edit** = on-screen role `operador` (`body[data-role="operador"]`): Op and Adm (`js/sessao.js:171`; `js/perfis.js:6`). Local mode: `#role-sel` = "Operador" (`index.html:69-72`).
- **Read** = on-screen role `gestor`: Ges and Sec (both with `ApiClient.readOnly = true`, `js/actions.js:44-46`; `js/sessao.js:171`), any screen locked after a save conflict (`js/actions.js:138-139`), and local mode with `#role-sel` = "Gestor" or `?role=gestor` (`js/main.js:123`).
- **Local mode** = `localhost` without `?supabase=`: no login, data in `localStorage` (`README.md:19-20`; `js/config-supabase.js:14-19`). **Shared mode** = `body[data-backend="supabase"]` (`js/sessao.js:115`; `js/state.js:27`).

## 1. What exists

### 1.1 The seven things, where they live and how they are opened

| Thing | Markup | View | Events | Pure modules | Opened by |
|---|---|---|---|---|---|
| Cursos | `section#s-cur` › `div#cursos` (`index.html:268-271`), all drawn by JS | `js/views/cursos.js` (`rCursos` `:434-464`), `js/views/etapas.js` | `js/eventos/cursos.js` | `js/programa.js`, `js/progresso.js`, `js/resultados.js`, `js/cursos.js`, `js/modelos-de-curso.js` | tab `#nav button[data-t="cur"]` "Cursos" (`index.html:99`) |
| Rodízio | `section#s-rod` › `div#rodizio.rodizio` (`index.html:378-382`) | `js/views/rodizio.js` (`rRodizio` `:8-30`) | `js/eventos/rodizio.js` | `js/rodizio.js` | tab `[data-t="rod"]` "Rodízio" (`index.html:100`) |
| BI | `section#s-bi` (`index.html:652-663`) | `js/views/bi.js` (`rBI` `:29-208`) | `js/eventos/bi.js` | `biDosDias` (`js/dias.js:172-180`); `js/metricas.js` is **not** used by the BI (see 1.5) | tab `[data-t="bi"]` "BI" (`index.html:102`) |
| Painel, in the Escala | `div.painel-dia` inside `#out`, drawn by `painelDoDia()` (`js/views/escala.js:558-561`) | `js/views/painel-aeroporto.js`, `js/views/meteorologia.js` | `[data-fids]` clicks in `js/eventos/navegacao.js:40-45` | `js/quadro.js`, `js/config-do-painel.js`, `js/meteorologia.js` | view button `#s-esc [data-tl="painel"]` "Painel" (`index.html:351`) |
| "Configurar painel" | `dialog#dlg-painel.dlg.dlg-painel` (`index.html:698-710`) | `js/views/config-do-painel.js` (view **and** its own listeners, `ligar()` `:79-142`) | same file | `js/config-do-painel.js` | button `[data-fids="configurar"]` inside the Painel (`js/views/painel-aeroporto.js:189`) |
| TV da recepção | `painel.html` (47 lines), its own page and CSP | `js/views/painel-aeroporto.js` (`painelNaTela` `:236-252`) | `js/painel.js` | `js/quadro.js`, `js/sessao-da-tv.js`, `js/config-do-painel.js` | the address `…/painel.html`; the TV account that logs into the app is redirected (`js/sessao.js:140-147`) |
| Histórico | `aside#historico.gaveta` (`index.html:667-675`), outside `main` | `renderAuditPanel` (`js/views/escala.js:267-301`) | `js/eventos/historico.js` | `js/reversoes.js` | header button `#btn-open-log` "Histórico" with the counter `#log-cnt` (`index.html:73`) |
| Manual | `section#s-manual.manual` (`index.html:429-649`): static text; six generated parts | `js/views/manual.js` (`rManual` `:10-21`, called once at import, `js/eventos/topo.js:96`) | `js/eventos/topo.js:97-101`; `[data-manual]` links in `js/eventos/navegacao.js:57-63` | `js/manual.js`, `js/glossario.js` | header button `#btn-manual` "Manual" (`index.html:74`); the link "Como funciona o rodízio" (`index.html:380`) |
| Minha conta / Usuários | `section#s-conta` with `div#usuarios` (`index.html:385-426`) | `js/views/conta.js` | `js/eventos/conta.js`; `js/eventos/topo.js:104-111` | none | account menu `#btn-menu-conta` › `#btn-conta` "Minha conta", `#btn-usuarios` "Usuários" (`index.html:76-88`) |

### 1.2 How navigation works today (what a new shell replaces)

- The nine tabs are `button[data-t]` in `nav#nav`, in this order with two `span.aba-sep` separators: `esc dem age | rec ins alu cur rod | bi` (`index.html:91-103`). One document click listener handles `[data-t]` and `[data-go]`: `show(aba)`, `carregarBI()` for `bi`, `abrirAgenda()` for `age`, `window.scrollTo(0, 0)`, focus on the opened tab's title for `data-go` (`js/eventos/navegacao.js:19-32`).
- `show(t)` (`js/views/tabs.js:16-28`): toggles `.on` on **every `<section>` of the document** by id `s-<t>`; toggles `.on` on `#nav button`; puts `aria-current="page"` on the open tab or on `#btn-manual`; scrolls the tab strip (`mostrarNaFaixa`); and **re-renders three screens only when they open**: `rBI()` for `bi`, `rCursos()` for `cur`, `rRodizio()` for `rod` (`:25-27`). CSS: `section { display: none } section.on { display: block }` (`css/app.css:229-230`).
- `manual` and `conta` are sections without a tab: `show('manual')` (`js/eventos/topo.js:98`, `js/eventos/navegacao.js:60`), `show('conta')` (`js/eventos/topo.js:104`, `:107`). With Minha conta open no tab has `.on` and nothing has `aria-current` (`js/views/tabs.js:18-23` only knows `#nav button[data-t]` and `#btn-manual`).
- The header tools `.hd-tools` hold, in order: `#role-sel` (local mode only: `body[data-backend="supabase"] #role-sel { display: none }`, `css/app.css:1557`), `#btn-open-log`, `#btn-manual`, the account menu (`index.html:68-89`). At the login screen everything but the account menu is hidden (`css/app.css:1553-1556`).
- The Secretaria's tabs are cut by CSS only: `body[data-perfil="secretaria"]` hides every tab but `age`, `esc`, `ins`, `alu`, `cur`, plus `.ir-para-demanda`, `.aba-sep`, `#btn-open-log` and `#btn-share-link` (`css/app.css:184-188`). The app opens for her on `age` (`js/main.js:134`).
- Page scrolling is the window's: the header is not sticky or fixed (no `position` on `header.topo`, `css/app.css:62-72`); code relies on `window.scrollTo(0, 0)` (`js/eventos/navegacao.js:27`; `js/eventos/topo.js:100`), `scrollIntoView` (`js/views/cursos.js:487`; `js/eventos/topo.js:109`; `js/eventos/navegacao.js:61`), native `#manual-…` anchors (`index.html:433-439`) and `scroll-margin-top` (`css/app.css:954`, `:1508`).
- Elements bound at module import, with no null guard (a missing id throws at import and no later module loads): `#historico`, `#btn-open-log`, `#btn-fechar-historico`, `#btn-clear-log` (`js/eventos/historico.js:19-37`); `#bi-dt`, `#bi-flt-eq`, `#bi-flt-cat`, `#btn-bi-sim`, `#btn-bi-clr` (`js/eventos/bi.js:16-26`, `:78`); `#form-senha`, `#form-email`, `#nc-gerar`, `#form-nova-conta` (`js/eventos/conta.js:9-44`); `#role-sel`, `#dt`, `#dt-ant`, `#dt-prox`, `#btn-menu-conta`, `#menu-conta`, `#btn-theme`, `#btn-manual`, `#btn-conta`, `#btn-usuarios`, `#btn-tentar-dados` and the six Manual targets (`js/eventos/topo.js:17-114`; `js/views/manual.js:11-19`). `abrirData` writes `#dt`, `#bi-dt`, `#dt-rotulo`, `#dt-rel` unguarded on every date load (`js/actions.js:33-40`).

### 1.3 Cursos

- One course at a time. `rCursos()` draws, in order: the bar (`barraDosCursos`, `js/views/cursos.js:387-396`: a `.seg.seg-dos-cursos` with one button per visible course, "Mostrar encerrados", "+ Novo curso"); the hidden form `#form-curso` (editor only, `:410-420`); a sentence; the card of the course on screen (`cartaoDoCurso`, `:347-366`): header, `details.alunos-do-curso`, `nav.indice-das-fases`, the phases (each a `div.fase` with a header and one table), "+ Fase", `details.retiradas`, `details.alteracoes`.
- The course on screen: the chosen one if visible, else the first active, else the first closed with "Mostrar encerrados" (`cursoNaTela`, `:379-382`). Choice and "Mostrar encerrados" live in the module (`filtro`, `:370`), lost on reload. Collapsed phases: a `Set` of phase ids (`recolhidas`, `:184`), kept across redraws and course switches, lost on reload.
- Two renderings of the same table: for the editor, inputs and selects (`linhaQueEdita`, `:148-165`; 9 columns: `#`, Código, Nome, Missão, Recurso, Horas, Quando voar, Marcas, Ações, `:224`); for everybody else, text (`linhaDeConsulta`, `:168-180`; 8 columns).
- Who edits: `podeEditarCursos()` = not `readOnly` and (shared mode: the account is `administrador`; local mode: not the Gestor role) (`:36`). The server enforces it: `salvar_curso` raises 42501 unless `administrador_atual()` (`supabase/migrations/20261117200000_cursos_e_missoes.sql:508-510`).
- Saving does **not** go through `gravarAlteracao`: each change is a pure operation of `js/programa.js` on the course, checked with `validarCurso`, shown at once, and queued per course for `ApiClient.salvarCurso(sigla, versão lida, conteúdo, descrição)`, one save at a time (`alterar`, `js/eventos/cursos.js:215-225`; `enviar`, `:179-208`). A refusal re-reads the programs and shows them (`mostrarOGravado`, `:155-175`). Nothing is queued before the open date is read (`aindaNaoAbriu()`, `:216`, `:498`, `:615`). Program changes are not in the History of the date; each course lists its last 20 under "Alterações do programa" (`:36`; `js/views/cursos.js:255-264`).
- Closing the page with a program save pending asks for confirmation (`programaSendoGravado`, `js/eventos/cursos.js:47`; `js/main.js:58-62`).
- Without the programs (read failed, or still waiting for the one-time conversion from the roster) the tab shows only a sentence (`SEM_OS_PROGRAMAS`, `js/views/cursos.js:29-33`, `:437-441`).

### 1.4 Rodízio

- Four fixed categories, in pay order, each a queue of qualified instructor ids: `cheque` "Voos de cheque", `mlte` "Voo MLTE (PA-34)", `noturno` "Voo noturno", `c172` "Voo C172" (`CATEGORIAS_DO_RODIZIO`, `js/rodizio.js:7-12`). A flight counts in the first category that applies (`categoriaDoRodizio`, `:14-20`).
- The screen: one `div.pn[data-cat]` per category with `ol.fila`; each `li[data-id]` shows the position, the name, "N voo(s) nesta data" (flights of the open date's schedule in that category, cancelled ones excluded, `voosQueVoam`, `js/state.js:30`), "indisponível" when the instructor's day switch `on` is off, and three buttons (`js/views/rodizio.js:11-29`).
- **The queues are an input of the engine**: `runAllocationEngine` reads `state.filas` (`js/engine.js:345`); the booking dialog reads them too (`js/agendamento.js:530`).

### 1.5 BI

- Four tiles (`.st`): hours "No dia (<data base>)", "Na semana (7 dias)", "No mês (<mm/aaaa>)", and "Recursos disponíveis" with "N/M instrutores" (`js/views/bi.js:123-128`). Three tables: "Horas por recurso (dia, semana e mês)" (`table[data-bi="eq"]`), "Horas por instrutor (dia, semana e mês)" (`table[data-bi="ins"]`), "Horas por missão" (`:130-206`). The first two show the 10 largest with "Ver todos (N)" (`MAIORES`, `:18-27`).
- Source: `BI_HISTORY`, one record per saved date `{ out, tot, rej }` (`biDosDias`, `js/dias.js:172-180`), read for the month of the base date plus the 6 days before it (`carregarBI`, `js/actions.js:333-348`), with the schedule on screen for the open date added in memory unless `readOnly` (`:351-363`). Cancelled flights are skipped and a Ground class counts once (`js/views/bi.js:62-75`).
- The fourth tile and the tags "Manut." and "Retirado" use the **open date's** state (`S.av`, `S.ins[].on`, `S.frota`), not the base date's (`js/views/bi.js:127`, `:139-142`).
- The BI renders no student name, weight or personal data: it reads `o.r`, `o.ins`, `o.mis`, `o.h`, `o.status`, `o.isGround`, `o.classKey`, `o.eqType`, `o.w`, `o.a` (`js/views/bi.js:65-95`).
- `js/metricas.js` (`metricasDaEscala`, `INTERVALO_DO_HANGAR`) is not part of the BI: its readers are the Escala's "tempo parado" box (`js/views/escala.js:414`), `js/compactar.js:19`, `js/glossario.js:6` and `scripts/medir-escalas.mjs:8`.

### 1.6 The Painel

- **In the Escala.** The fourth view of the Escala (`TL_MODE === 'painel'`, `js/state.js:10`; `index.html:351`). `painelDoDia(voos)` passes the flights **left by the Escala's filters** (Categoria, Recurso, search) through `quadroDoDia` (student name abbreviated, cancel reason reduced to its category: "as mesmas reduções da TV da recepção") to `painelDaEscala` (`js/views/escala.js:555-561`; `js/quadro.js:146-154`). It is drawn **only when at least one flight passes the filters**: with no flight the view shows only "Nenhum voo nesta data…" or "Nenhum voo na escala com esses filtros." (`js/views/escala.js:594-603`, `:624-625`), so "Configurar painel" cannot be opened on such a date.
- Boards (`QUADROS_DO_PAINEL`, `js/config-do-painel.js:8-13`): `missoes` "Missões" (default), `alternar` "Partidas e chegadas", `partidas`, `chegadas`. Columns (`COLUNAS_DO_PAINEL`, `:27-36`): Horário, Aeronave, Modelo, Aluno, Instrutor, Missão on; Previsto, Observação off. Lists (`LISTAS_DO_PAINEL`, `:18-22`): `auto`, `uma`, `duas`.
- Pages: 12 rows per list in the page (`POR_PAGINA`, `js/views/painel-aeroporto.js:17`); in full screen, the rows that fit above the weather strip (`porLista`, `:66-77`). A page changes every 10 s (`TROCA_MS`, `:16`); a 1 s interval runs while `#out .fids` is in the DOM, even with another tab open (`ligarRelogio`, `:280-303`).
- **Full screen**: `requestFullscreen()` on `#out .fids` (`acaoDoPainel`, `:317-320`).
- The module is tied to the Escala's container: `'#out .fids'`, `'#out [data-fids="pausar"]'`, `'#out [data-fids]'`, the fallback `#out` for the width (`:27`, `:84`, `:311-326`); the dialog returns the focus to `'#out [data-fids="configurar"]'` (`js/views/config-do-painel.js:139`).
- **Weather strip** under the board: METAR and TAF of SBBH and SBCF from the Edge Function `meteorologia`, asked when the Painel draws and every 10 minutes (`js/meteorologia.js:7`, `:69-100`); in local mode "Meteorologia indisponível" (`js/storage.js:345-347`).
- **`painel.html`** (`js/painel.js`): today only, full screen, no buttons. Shared mode: login with the TV account only, session renewal, `rpc('painel_do_dia')` every 60 s, which also returns the `painel` setting (`:23`, `:235-262`). Local mode: reads this browser's `dia:<hoje>` and `cadastro.painel`, no login (`:81-84`, `:264-268`). It loads `css/app.css` (`painel.html:14`) and its own 3-icon sprite (`painel.html:19-23`). Its import graph reaches `js/backends/local.js`, which imports `js/agenda.js`, `js/programa.js`, `js/resultados.js`, `js/dados-pessoais.js`, `js/limites.js`, `js/rules.js` (`js/painel.js:13-21`; `js/backends/local.js:4-11`).

### 1.7 Histórico

- A non-modal `<aside class="gaveta">`, `position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100vw)`, above the page (`css/app.css:1455-1459`). The page behind stays usable. Four drawers share that place and stack by opening order (`#historico`, `#painel-instrutor`, `#painel-dados`, `#painel-reparo`, `index.html:667-682`; `abrirGaveta`, `gavetaDoEsc`, `js/dom.js:42-59`).
- Content: the open date's entries, newest first (see 5.4).

### 1.8 Manual

- Static sections, in this order (`h3`): "Primeiros passos: a rotina do operador" (`#manual-rotina`), "Perfis de acesso" (`#manual-perfis`), "As abas" (`#manual-abas`, with one `h4` per tab: Escala, Demanda, Agenda, Recursos, Instrutores, Alunos, Cursos, Rodízio `#manual-aba-rodizio`, BI), "Como a escala é montada" (`#manual-regras`), "Para o gestor" (`#manual-gestor`), "TV da recepção" (`#manual-tv`), "Glossário" (`#manual-glossario`), "Perguntas frequentes" (`#manual-faq`) (`index.html:442-648`). The index `nav.manual-indice` has 7 links (no link to `#manual-tv`) (`index.html:432-440`).
- Generated from the code: `#manual-janelas` (the 9 `WIN`), `#manual-rodizio`, `#manual-pesos`, `#manual-combustivel`, `#manual-missoes tbody` (18 rows, **ran**), `#manual-glossario-lista` (66 terms in 9 groups, **ran**) (`js/views/manual.js:11-20`; `js/manual.js:36-53`).
- The glossary is grouped by tab name: `ABAS_DO_GLOSSARIO = ['Escala', 'Critérios', 'Demanda', 'Agenda', 'Recursos', 'Instrutores', 'Alunos', 'Cursos', 'Rodízio']` (`js/glossario.js:14`); terms per group: 21, 9, 8, 1, 9, 8, 4, 5, 1 (**ran**). The same texts feed the `data-dica` tooltips.

### 1.9 Minha conta and Usuários

- Shared mode only: `#btn-conta` and `#btn-sair` are `hidden` in the markup and shown after login; `#btn-usuarios` only for the Administrador (`index.html:83-86`; `js/sessao.js:162-164`). In local mode the account menu holds only the theme switch.
- `#s-conta`: a line with name, e-mail and profile (`#conta-dados`), "Trocar a senha", "Trocar o e-mail"; for the Administrador, `#usuarios` with "Nova conta" and the table of accounts (`js/views/conta.js:18-46`). The local backend has no account functions (`js/backends/local.js`).

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

### 2.1 Cursos and results

| Field | Shape | Stored | Scope | Written by |
|---|---|---|---|---|
| Course | `{ sigla, nome, ordem, ativo, versao }` | tables `cursos`, read by RPC `programa_dos_cursos` (`js/backends/supabase.js:289-293`); local `localStorage['acpm4_cursos'].cursos` (`js/backends/local.js:21`, `:54-59`) | all dates | RPC `salvar_curso` (Adm only; `js/backends/supabase.js:297-301`); local `gravarCurso` (`js/programa.js:446-466`). `sigla` never changes; `ativo: false` = "encerrado" (`mudarCurso`, `js/programa.js:846-853`) |
| Phase | `{ id (uuid made by the app), nome, modulo, ordem, regra: 'ordem'/'livre'/'depois', requer: [ids], removida }` | table `fases_do_curso`, `requisitos_das_fases` (`supabase/migrations/20261117200000_cursos_e_missoes.sql:76`, `:114`) | all dates | same save; a removed phase stays with `removida: true` (`js/programa.js:753-759`) |
| Mission | `{ id, fase, codigo, nome, mis, eq, nb, ordem, regra, requer, dispensada, avaliacao, removida, trecho?: 'ida'/'noite'/'volta' }`; `comResultados` is computed on read | tables `missoes_do_curso`, `requisitos_das_missoes` (`:88`, `:125`) | all dates | same save. Limits: 50 phases, 200 missions, names up to 80 (`js/programa.js:16`) |
| Program change log | `{ versao, descricao, registrado_em, registrado_por }`, last 20 shown | table `versoes_dos_cursos` (`:137`); local `acpm4_cursos.alteracoes` (last 200, `js/backends/local.js:22`) | all dates | the same save |
| Frozen copy | `cadastro.cursos` (`{ PP: [...], PC: [...], INVA: [...] }`) | roster document | all dates | nobody since format 24 (`README.md:174`; `js/dias.js:51`, `:87`) |
| Student's course | `cadastro.stu[].curso` (sigla) | roster (`js/dias.js:47`) | all dates | Alunos tab (other map) |
| Result | `{ id, aluno, curso, missao, resultado: 'aprovado'/'reprovado'/'pendente', data, voo, registrado_em, registrado_por }` | table `resultados_de_missao`, append-only (`supabase/migrations/20261114120000_resultados_de_missao.sql:5-22`); local `acpm4_resultados` (`js/backends/local.js:19`) | all dates; each row carries the flight's date | RPC `registrar_resultado` (Op and Adm, `:39-41`; defined again in `supabase/migrations/20261117200000_cursos_e_missoes.sql:635-658`, with the same profile check at `:644`); see 5.3 |
| In memory | `S.programa` (list of courses), `S.resultados = { situacao, doDia }`, `S.indisponiveis` | set on every date load (`js/actions.js:298-305`; `js/storage.js:218-227`) | session | `lerData`; `js/eventos/cursos.js:49-54`; `js/eventos/escala.js:252` |
| Screen state | `filtro = { curso, encerrados }` (`js/views/cursos.js:370`); `recolhidas` (`:184`); open `<details>` read from the DOM (`:443`); the new-course form (`:400-409`); the save queues `filas`, `confirmados` (`js/eventos/cursos.js:40-43`) | memory | until reload | the Cursos events |

### 2.2 Rodízio

| Field | Shape | Stored | Scope | Written by |
|---|---|---|---|---|
| `filas` | `{ cheque: [insId…], mlte: […], noturno: […], c172: […] }`, the queues at the start of the date | the day document (`dia.filas`, `js/dias.js:66`, `:105`; since data format 8, `js/migracoes.js:69`) | **per date** | the three buttons, through `gravarAlteracao('mod', 'Rodízio · <categoria>: <nome> passou para <n>º')` (`js/eventos/rodizio.js:8-20`) |
| Derivation | a date without a saved day starts from the previous saved day: who flew in the category (cancelled and the Noturno return leg excluded) goes to the end (`filasDoDiaSeguinte`, `js/rodizio.js:34-46`; `diaParaCopiar`, `js/dias.js:118-123`; `js/storage.js:189-190`) | not stored until the date is saved | per date | automatic |
| Normalisation | only qualified instructors; newly qualified at the end (`ajustarFilas`, `js/rodizio.js:24-31`; on load `js/storage.js:162`) | — | — | automatic |

A date already saved keeps its own `filas`: a change in an earlier date does not reach it (`js/storage.js:190` uses the copy only when the day does not exist).

### 2.3 BI

| Field | Shape | Stored | Scope | Written by |
|---|---|---|---|---|
| `BI_HISTORY` | `{ 'AAAA-MM-DD': { out, tot, rej } }` (`js/state.js:9`) | memory; derived from the saved days' `resultado` (`js/dias.js:172-180`; `js/storage.js:349-351`; `js/backends/supabase.js:121-126`) | the month of the base date plus 6 days before | `carregarBI` (`js/actions.js:333-348`); the open date's entry follows the screen (`:351-363`) |
| Base date | `#bi-dt` value | DOM; set to the open date on every date load (`js/actions.js:34`) | session | the user (`js/eventos/bi.js:16`) |
| Filters | `#bi-flt-cat`, `#bi-flt-eq`, `#bi-flt-ins` values; `verTodos = { eq, ins }` (`js/views/bi.js:19`) | DOM and memory | session | the user |
| Simulated days | `dia:<data> = { simulado: true, resultado: { out, al, tot, rej, data }, esquema }` | local mode only, written straight to the backend (`js/eventos/bi.js:71`), removed by `removerDiasSimulados` (`js/backends/local.js:146-151`) | per date | "Simular 30 dias", "Limpar BI" |

### 2.4 The Painel

| Field | Shape | Stored | Scope | Written by |
|---|---|---|---|---|
| `painel` | `{ quadro, colunas: [{ id, on }], listas }` | roster (`cadastro.painel`, `js/dias.js:53`, `:88`), data format 25 (`js/migracoes.js:207-210`); only when different from the default (`delete S.painel`, `js/views/config-do-painel.js:72-73`) | all dates | "Configurar painel", through `gravarAlteracao('mod', 'Painel: …')` (`:71-77`): one History line on the open date |
| For the TV | the same field, sanitised, in the answer of `painel_do_dia()` (`supabase/migrations/20261120150000_painel_do_dia_com_a_configuracao.sql:9-40`) | — | — | the server |
| View state | `TL_MODE` (`js/state.js:10`); `estado = { modo, tela, telas, pausado, fonte, relogio, ultimaTroca, minuto, chave, seletor, inteiro }` (`js/views/painel-aeroporto.js:27`) | memory | until reload | the Painel buttons |
| Weather | `{ gerado, estacoes: [{ icao, nome, metar, taf, observado }] }` (`js/meteorologia.js:26-35`) | memory | session | the fetch |
| TV session | `localStorage['acpm-<projeto>-painel']`; with "Manter esta TV conectada", e-mail and password in `'acpm-<projeto>-painel-entrada'` (`js/config-supabase.js:23-27`) | that browser | — | `js/painel.js`, `js/sessao-da-tv.js` |

### 2.5 Histórico

| Field | Shape | Stored | Scope | Written by |
|---|---|---|---|---|
| Entry | `{ id, data, registrado_em, autor, tipo: 'inc'/'exc'/'mod', descricao (up to 500), reverter (json), reverte (id), importado }` | table `historico`, append-only (`supabase/migrations/20261110201618_dias_e_historico.sql:64-106`); read with `.eq('data', data)…limit(200)`, newest first (`js/backends/supabase.js:169-175`); local `acpm4_historico`, the last 1,000 entries of all dates (`js/backends/local.js:126-138`) | **per date: the date that was open when the change was made** | `logChange` after the day's save succeeds (`js/actions.js:212-239`), called by `gravarAlteracao` (`:189-195`); also directly by the result (`js/eventos/escala.js:255-256`) and the typed weights (`js/eventos/agendamento.js:38`); the server itself for personal data (`mostrarNoHistorico`, `js/actions.js:249-252`; `js/eventos/cadastros.js:43`) |
| In memory | `AUDIT_LOG` entries `{ id, ts, type, desc, revert, reverte, autor, importado, estado: 'gravando'/'nao-gravada' }` (`js/state.js:8`; `js/actions.js:215-225`, `:254-265`) | memory | the open date | `lerData` (`:311`), `logChange` |

Roster-wide changes are filed under the open date too (a new student, a deleted instructor, a fleet attribute, the take-off times, the legal limits, the Painel setting): `logChange` always uses `DATA` (`js/actions.js:229-231`; callers in `js/eventos/cadastros.js:79-247`, `js/eventos/recursos.js:65-212`, `js/views/config-do-painel.js:76`).

### 2.6 Manual and Minha conta

| Field | Stored | Scope | Written by |
|---|---|---|---|
| Manual | none: text in `index.html`, tables from `MIS`, `WIN`, `DEFAULT_LIM`, `COMBUSTIVEL`, `CATEGORIAS_DO_RODIZIO`, `GLOSSARIO` (`js/manual.js:3-6`) | — | code |
| Account | Supabase Auth user; table `perfis` (`perfil`, `nome`) (`js/sessao.js:128`); RPCs `listar_contas`, `criar_conta`, `excluir_conta` (`js/backends/supabase.js:178-193`); `auth.updateUser` for password and e-mail (`:197-208`) | account | the person; the Administrador for the accounts |
| Theme | `localStorage['acpm3_theme']` (`js/storage.js:34`; `js/eventos/topo.js:73-82`) | that browser | the person |
| Local role | `body[data-role]`, from `#role-sel` or `?role=` (`js/eventos/topo.js:17-21`; `js/main.js:123`) | memory | the person |

## 3. Controls inventory

Profiles: "all" = Op, Adm, Ges, Sec. "editor" = whoever `podeEditarCursos()` accepts (shared mode: Adm; local mode: Edit).

### 3.1 Navigation controls of this area

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| "Cursos" | `#nav button[data-t="cur"]` (`index.html:99`) | `js/eventos/navegacao.js:19-32` → `show('cur')` → `rCursos()` (`js/views/tabs.js:26`) | `section.on`, `aria-current` | all |
| "Rodízio" | `#nav button[data-t="rod"]` (`index.html:100`) | same → `rRodizio()` (`js/views/tabs.js:27`) | same | Op, Adm, Ges (hidden for Sec, `css/app.css:184`) |
| "BI" | `#nav button[data-t="bi"]` (`index.html:102`) | same → `rBI()` and `carregarBI()` (`js/views/tabs.js:25`; `js/eventos/navegacao.js:25`) | same; `BI_HISTORY` | Op, Adm, Ges (hidden for Sec) |
| "Histórico" + count | `button.hd-btn#btn-open-log[title="Alterações desta data"]` with `span.badge-cnt#log-cnt` (`index.html:73`) | `mostrarHistorico` (`js/eventos/historico.js:20-30`) | `#historico[hidden]`, `aria-expanded` | Op, Adm, Ges (hidden for Sec, `css/app.css:187`) |
| "Manual" | `button.hd-btn#btn-manual` (`index.html:74`) | `js/eventos/topo.js:97-101` → `show('manual')`, focus on the title, `window.scrollTo(0, 0)` | `section.on`, `aria-current` on the button | all |
| account menu | `button.hd-conta#btn-menu-conta[aria-haspopup="menu"]` → `div#menu-conta[role="menu"]` (`index.html:77-87`) | `ligarMenu` (`js/eventos/topo.js:65`; `js/dom.js:110-157`) | `hidden`, `aria-expanded` | all, local mode too |
| "Minha conta" | `#btn-conta[role="menuitem"]` (`index.html:83`) | `js/eventos/topo.js:104` → `show('conta')`, `abrirConta()` | — | all, shared mode only |
| "Usuários" | `#btn-usuarios[role="menuitem"]` (`index.html:84`) | `js/eventos/topo.js:106-111` → `show('conta')`, scroll to `#usuarios` | — | Adm |
| theme switch | `#btn-theme[role="menuitemcheckbox"][aria-label="Tema escuro"]` (`index.html:85`) | `js/eventos/topo.js:73-82` | `html[data-theme]`, `localStorage` | all |
| "Sair" | `#btn-sair` (`index.html:86`) | `js/sessao.js:166` | session | all, shared mode |
| profile | `select#role-sel` "Operador" / "Gestor" (`index.html:69-72`) | `js/eventos/topo.js:17-21` → `setRole`, `rCursos()`, `rOut()` | `body[data-role]` | local mode only |
| "Painel" | `#s-esc .seg button[data-tl="painel"]` (`index.html:351`) | `js/eventos/navegacao.js:33-38` → `setTLMode`, `rOut()` | `TL_MODE` | all |
| "Como funciona o rodízio" | `a[href="#manual-aba-rodizio"][data-manual="manual-aba-rodizio"]` (`index.html:380`) | `js/eventos/navegacao.js:57-63` | opens the Manual at that part | Op, Adm, Ges |

### 3.2 Cursos

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| "PP · Piloto Privado" (one per course; "(encerrado)" mark) | `.seg.seg-dos-cursos[role="group"][aria-label="Curso"] > button#cur-ver-<SIGLA>[data-ver-curso][aria-pressed]` (`js/views/cursos.js:388`) | document click (`js/eventos/cursos.js:519-524`) → `filtrarCursos`, `rCursos()` | `filtro.curso` | all (no `data-act`) |
| "Mostrar encerrados" | `input[type="checkbox"]#cur-encerrados.flt-ctrl` (`js/views/cursos.js:392`) | change (`js/eventos/cursos.js:511-515`) | `filtro.encerrados` | all |
| "+ Novo curso" | `button.btn#cur-novo[data-act="curso-novo"][aria-expanded][aria-controls="form-curso"]` (`js/views/cursos.js:394`) | `aoAcionar('curso-novo')` (`js/eventos/cursos.js:599-601`) → `mostrarFormularioDoCurso` (`:579-589`) | `#form-curso[hidden]` | editor |
| "Sigla", "Nome", "Começar com": "Programa vazio" / "<modelo> (<documento>)", "Cancelar", "Criar o curso" | `form#form-curso.pn`: `#cur-sigla`, `#cur-nome`, `input[type="radio"][name="cur-comeco"]`, `#cur-erro[role="alert"]`, `#cur-cancelar`, submit (`js/views/cursos.js:410-420`) | submit (`js/eventos/cursos.js:612-631`) → `novoCurso` → `alterar(null, …)`; cancel `:602-604`; Esc `fecharNoEsc` `:605` | `S.programa`, save queue; course created at version 0 | editor |
| "Nome" of the course | `input[data-cc="nome"]` (`js/views/cursos.js:340`) | change (`js/eventos/cursos.js:495-507`) → `mudarCampoDoCurso` (`:482-490`) | course `nome` | editor |
| "Encerrar o curso" / "Reativar o curso" | `button.btn.sec[data-act="curso-encerrar"]` / `[data-act="curso-reativar"]` (`js/views/cursos.js:338-341`) | `js/eventos/cursos.js:542-555`; "Encerrar" asks 'Confirmar encerramento' | course `ativo`; sets `filtro.encerrados` | editor |
| "Usar o cronograma do PP (P.I PPA 001A)" | `button.btn.sec[data-act="curso-modelo"][data-modelo]`, only while the program is empty or has one phase (`js/views/cursos.js:326-329`, `:341`) | `js/eventos/cursos.js:565-575`; two clicks, 'Confirmar: N missões ficam, N entram, N saem' | whole program (`aplicarModelo`) | editor |
| "N alunos no <SIGLA>" | `details.alunos-do-curso > summary#alunos-<SIGLA>`; items are text (`js/views/cursos.js:284-298`) | native | open state kept by `rCursos` (`:443`) | all |
| phase index links, "N alunos" | `nav.indice-das-fases[aria-label="Fases do <SIGLA>"] a[href="#fase-<id>"][data-ir-fase]`; `span.alunos-na-fase[data-dica="alunos-na-fase"]` (`js/views/cursos.js:303-322`) | click (`js/eventos/cursos.js:527-529`) → `irParaFase` (`js/views/cursos.js:483-490`): opens the phase, `scrollIntoView({ block: 'start' })`, focus on its title | `recolhidas` | all |
| "Abrir todas", "Recolher todas" | `button.btn.quiet#fases-abrir`, `#fases-recolher` (`js/views/cursos.js:320`) | `js/eventos/cursos.js:530-531` → `recolherTodasAsFases` | `recolhidas` | all |
| phase title (collapses the phase) | `button.fase-btn[data-recolher-fase][aria-expanded]` inside `h4/h5.fase-titulo#fase-<id>` (`js/views/cursos.js:188-191`) | `js/eventos/cursos.js:525-526` → `recolherFase` (`js/views/cursos.js:467-475`) | `recolhidas` | all |
| phase "Nome", "Módulo", "Abre" (`Depois das fases anteriores` / `Desde o início do curso` / `Depois de…`), "Depois de: …" | `input[data-cfa="nome"]`, `input[data-cfa="modulo"][list="cur-modulos"]`, `select[data-cfa="regra"]`, `details.requisitos input[type="checkbox"][data-cfa="requer"]` (`js/views/cursos.js:196-207`, `:128-133`) | change → `mudarCampoDaFase` (`js/eventos/cursos.js:459-479`) | phase fields | editor |
| ↑, ↓, ✕ of a phase | `button.x[data-act="fase-subir"]`, `[data-act="fase-descer"]`, `[data-act="fase-retirar"]` (`js/views/cursos.js:205`) | `js/eventos/cursos.js:318-350`; ✕ asks 'Confirmar'; only a phase without missions leaves | order, `removida` | editor |
| mission "Código" (read-only with a padlock when locked), "Nome", "Missão", "Trecho" (Noturno only), "Recurso", "Horas", "Quando voar" (`Depois das anteriores` / `Livre na fase` / `Depois de…`), "Depois de: …", "Dispensada", "Avaliação", phase of the mission | `input.codigo[data-cf="codigo"]`, `input[data-cf="nome"]`, `select[data-cf="mis"]`, `select[data-cf="trecho"]`, `select[data-cf="eq"]`, `input.duracao[data-cf="nb"]`, `select[data-cf="regra"]`, `input[data-cf="requer"]`, `input[data-cf="dispensada"]`, `input[data-cf="avaliacao"]`, `select[data-cf="fase"]`, in `tr[data-missao][data-fase][data-i]` (`js/views/cursos.js:148-165`) | change → `mudarCampoDaMissao` (`js/eventos/cursos.js:407-456`); the code is checked by `recusaDoCodigo` (`:392-403`) | mission fields | editor |
| ↑, ↓, ✕ of a mission | `button.x[data-act="missao-subir"]`, `[data-act="missao-descer"]`, `[data-act="missao-retirar"]` (`js/views/cursos.js:163`) | `js/eventos/cursos.js:281-315` | order, `removida` | editor |
| "+ Missão" / "+ Missão na <fase>" | `button.btn.sec[data-act="missao-nova"][data-fase]` (`js/views/cursos.js:231`, `:356`) | `js/eventos/cursos.js:281-295` → `incluirMissao` | new mission; the code skips reserved ones (`codigosReservados`, `js/views/cursos.js:77-80`) | editor |
| "+ Fase" | `button.btn.sec[data-act="fase-nova"]` (`js/views/cursos.js:362`) | `js/eventos/cursos.js:318-330` | new phase | editor |
| "Retiradas (N)", "Voltar ao programa" | `details.retiradas > summary#retiradas-<SIGLA>`; `button.btn.quiet[data-act="fase-restaurar"][data-fase]`, `[data-act="missao-restaurar"][data-missao]` (`js/views/cursos.js:236-249`) | `js/eventos/cursos.js:355-382` | `removida` | list: all; buttons: editor |
| "Alterações do programa" | `details.alteracoes > summary#alteracoes-<SIGLA>` (`js/views/cursos.js:255-264`) | native | — | all |
| "?" of "Quando voar" | `button.dica-btn[data-dica="quando-voar"]` (`js/views/cursos.js:224`) | tooltip (`js/dicas.js`) | — | all |

### 3.3 Rodízio

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| "Subir <nome>" | `span.acoes.edit-only button.x[data-act="fila-subir"][data-cat][data-id]` (`js/views/rodizio.js:22`) | `aoAcionar` (`js/eventos/rodizio.js:8-20`) | reads `S.filas`, `S.ins`; writes `S.filas[cat]`; `gravarAlteracao` | Op, Adm |
| "Descer <nome>" | `button.x[data-act="fila-descer"]` (`:23`) | same | same | Op, Adm |
| "Pôr <nome> no início da fila" | `button.x[data-act="fila-inicio"]` (`:24`) | same | same | Op, Adm |

The buttons show on hover or focus; always on touch (`css/app.css:1141-1143`).

### 3.4 BI

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| "Data base" | `label.chip > input[type="date"]#bi-dt` (`index.html:655`) | `onchange` → `carregarBI()` (`js/eventos/bi.js:16`) | `BI_HISTORY`; does not change the open date | Op, Adm, Ges (kept enabled for Read, `js/somente-leitura.js:6`) |
| "Categoria" | `select#bi-flt-cat.flt-ctrl` (`index.html:656`) | `js/eventos/bi.js:18-20` | filter | Op, Adm, Ges |
| "Recurso" | `select#bi-flt-eq.flt-ctrl` (`index.html:657`) | `js/eventos/bi.js:17`; options rebuilt by `rBI` (`js/views/bi.js:100-108`) | filter | Op, Adm, Ges |
| "Buscar instrutor…" | `input[type="search"]#bi-flt-ins.flt-ctrl` (`index.html:658`) | input (`js/eventos/bi.js:21-23`) | filter (`chaveDeBusca`) | Op, Adm, Ges |
| "Simular 30 dias" | `button.btn.sec.edit-only#btn-bi-sim` (`index.html:659`) | `comConfirmacao(…, 'Confirmar simulação')` (`js/eventos/bi.js:26-75`) | writes simulated days straight to the local backend | local mode, Edit (hidden in shared mode, `css/app.css:1564-1566`) |
| "Limpar BI" | `button.btn.sec.edit-only#btn-bi-clr` (`index.html:660`) | `comConfirmacao(…, 'Confirmar limpeza')` (`js/eventos/bi.js:78-83`) | removes simulated days | local mode, Edit |
| "Ver todos (N)" / "Ver só os 10 maiores" | `button.btn.quiet[data-bi-todos="eq"]`, `[data-bi-todos="ins"]` (`js/views/bi.js:24-26`) | `js/eventos/navegacao.js:54-55` → `alternarTodosDoBI` | `verTodos` | Op, Adm, Ges |

### 3.5 The Painel, "Configurar painel" and the TV page

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| "Missões" / "Partidas e chegadas" / "Partidas" / "Chegadas" | `.fids-controles .seg[role="group"][aria-label="Quadros do painel"] > button[data-fids="missoes"]`, `"alternar"`, `"partidas"`, `"chegadas"` (`js/views/painel-aeroporto.js:172`, `:184-186`) | `js/eventos/navegacao.js:40-45` → `acaoDoPainel` (`js/views/painel-aeroporto.js:322-332`) | `estado.modo` (this screen only) | all |
| "?" of the boards | `button.dica-btn[data-dica="painel-missoes"]` (`js/views/escala.js:560`) | tooltip | — | all |
| "Pausar" | `button.btn.sec[data-fids="pausar"][aria-pressed]` (`js/views/painel-aeroporto.js:187`) | `acaoDoPainel` (`:307-316`) | `estado.pausado` | all |
| "Tela cheia" | `button.btn.sec[data-fids="tela-cheia"]` (`:188`) | `acaoDoPainel` (`:317-321`) → `requestFullscreen` | — | all |
| "Configurar painel" | `button.btn.sec[data-fids="configurar"][aria-haspopup="dialog"]` (`:189`) | `js/eventos/navegacao.js:42` → `abrirConfigDoPainel` (`js/views/config-do-painel.js:144-154`), `dlg.showModal()` | — | all open it; Read sees it disabled |
| "O painel abre em": the four boards | `input[type="radio"][name="pn-quadro"]` (`js/views/config-do-painel.js:26`) | dialog `change` (`:86-93`) → `mudar(…, { quadro: true })` | `S.painel.quadro`; `gravarAlteracao` | Op, Adm (`podeMudar`, `:20`) |
| "Listas": "Automático" / "Sempre uma lista" / "Sempre duas listas lado a lado" | `input[type="radio"][name="pn-listas"]` (`:27`) | dialog `change` (`:94-101`) | `S.painel.listas` | Op, Adm |
| "Colunas, na ordem do painel": one checkbox per column | `ol.pn-colunas li.pn-coluna input[type="checkbox"][data-pn-coluna]` (`:28-35`) | dialog `change` (`:102-111`); the last one on cannot be turned off | `S.painel.colunas[].on` | Op, Adm |
| "Subir <coluna>", "Descer <coluna>" | `button.btn.sec.pn-mover[data-pn-mover="-1"]`, `[data-pn-mover="1"]`, `[data-pn-coluna]` (`:30`) | dialog `click` (`:114-125`) | column order | Op, Adm |
| "Voltar ao padrão" | `button.btn.quiet#pn-padrao` (`index.html:706`) | dialog `click` (`js/views/config-do-painel.js:126-134`) | `delete S.painel` | Op, Adm |
| "Fechar" | `button.btn#pn-fechar` (`index.html:707`); Esc | `:135`; focus back to `#out [data-fids="configurar"]` (`:138-141`) | — | all |
| TV: "E-mail", "Senha", "Manter esta TV conectada", "Entrar" | `form#form-login.login-painel`: `#login-email`, `#login-senha`, `#login-manter`, `#btn-entrar` (`painel.html:25-36`) | `pedirLogin` (`js/painel.js:96-142`) | TV session | TV account |
| TV: "Sair desta TV" | `button.btn.sec.sair-da-tv#btn-sair-tv` (`painel.html:43`), shown while the mouse moves | `ligarSaida` (`js/painel.js:175-189`) | clears the session and the stored credentials | TV account |

### 3.6 Histórico

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| ✕ "Fechar o histórico" | `button.x#btn-fechar-historico` (`index.html:670`); Esc | `js/eventos/historico.js:31-34` | `#historico[hidden]` | Op, Adm, Ges |
| "↶ Reverter" / "↶ Restaurar" / "✕ Excluir" / "↶ Desfazer" (the label comes with the entry) | `button.x.edit-only[data-act="rev-log"][data-logid]` (`js/views/escala.js:285-288`) | `aoAcionar('rev-log')` (`js/eventos/historico.js:46-124`) | see 5.4 | Op, Adm |
| "Limpar o histórico desta data" | `button.btn.quiet.edit-only#btn-clear-log` (`index.html:674`) | `js/eventos/historico.js:37-43` → `limparHistorico(DATA)` | the local history of the date | local mode, Edit (hidden in shared mode, `css/app.css:1564`) |

### 3.7 Manual

| Label | Element | Handler | State | Profiles |
|---|---|---|---|---|
| "Primeiros passos", "Perfis de acesso", "As abas", "Como a escala é montada", "Para o gestor", "Glossário", "Perguntas frequentes" | `nav.manual-indice[aria-label="Índice do manual"] a[href="#manual-…"]` (`index.html:432-440`) | native anchors | the address fragment | all |
| inline links | `a[href="#manual-tv"]`, `a[href="#manual-regras"]` (`index.html:466`, `:525`, `:529`) | native | — | all |

### 3.8 Minha conta and Usuários

| Label | Element | Handler | State | Profiles |
|---|---|---|---|---|
| "Senha atual", "Nova senha (pelo menos 12 caracteres)", "Repita a nova senha", "Trocar a senha" | `form#form-senha`: `#senha-atual`, `#senha-nova`, `#senha-repetida`, submit; `#senha-msg` (`index.html:391-397`) | `js/eventos/conta.js:9-24` → `ApiClient.alterarSenha` | Auth password | all, shared mode |
| "Novo e-mail", "Senha atual", "Trocar o e-mail" | `form#form-email`: `#email-novo`, `#email-senha`, submit; `#email-msg` (`index.html:402-407`) | `js/eventos/conta.js:26-40` → `ApiClient.alterarEmail` | Auth e-mail, after two confirmation links | all, shared mode |
| "Nome", "E-mail", "Perfil", "Senha inicial (copie antes de criar)", "Gerar senha", "Criar conta" | `form#form-nova-conta`: `#nc-nome`, `#nc-email`, `#nc-perfil`, `#nc-senha`, `#nc-gerar`, submit; `#nc-msg` (`index.html:414-422`) | `js/eventos/conta.js:43-59` → `ApiClient.criarConta` | accounts | Adm |
| "Excluir" | `#lista-contas button.x[data-act="excluir-conta"][data-id][data-email]`, disabled on the own account (`js/views/conta.js:43`) | `aoAcionar('excluir-conta', …, { confereAPermissao: true })` (`js/eventos/conta.js:61-71`); asks 'Confirmar exclusão' | accounts | Adm |

## 4. Rules and the tests that pin them

Counts in parentheses are `test(` calls in the file (some sit in a loop and run more than once) or `it(` calls in a unit file; "plan N" is the pgTAP plan of a database test file.

| Rule | Code | Tests |
|---|---|---|
| Nine tabs, in the order of use | `index.html:91-103` | `test/e2e/app.spec.js` › 'abre na Escala, com as abas na ordem de uso e sem números' (`:5`); › 'navega pelas abas; sem os botões "Próximo" de um passo a passo' (`:67`, also: exactly one `[data-go]`) |
| The helper every spec uses to open a tab | `irPara` clicks `#nav button[data-t="<aba>"]` and expects `#s-<aba>` (`test/e2e/fixtures.js:88-91`) | `irPara(page, 'cur')` on 64 lines of 9 files; `'rod'` on 7 lines of 3 files; `'bi'` on 5 lines of 3 files |
| The loops over "all the tabs" | the list `['esc', 'dem', 'age', 'rec', 'ins', 'alu', 'cur', 'rod', 'bi']` | `test/e2e/celular.spec.js:32`, `:51`; `test/e2e/acessibilidade.spec.js:38`; `test/e2e/seguranca.spec.js:95`; 320 px: `acessibilidade.spec.js` › 'Telas de 320 px' › 'nenhuma aba rola de lado' (`:192`, tabs read from `#nav button[data-t]:visible`); other views through `percorrerVistasEFiltros` (`test/e2e/fixtures.js:129-183`, Cursos at `:177-182`) |
| The Secretaria sees Escala, Agenda, Instrutores, Alunos, Cursos | `css/app.css:184-188` | `test/e2e/agenda-compartilhado.spec.js` › 'a Secretaria abre na agenda, registra pedidos e só consulta a escala' (`:74`); `test/e2e/dados-pessoais.spec.js:116`. No test asserts that `#btn-open-log` is hidden for her |
| The open tab and the Manual are said to the screen reader; Cursos is a tab | `js/views/tabs.js:20-23` | `acessibilidade.spec.js` › 'a aba aberta (e o Manual), a vista escolhida e o dia da agenda são ditos, não só coloridos' (`:547`) |
| Page width 1,280 px | `css/app.css:228` | `app.spec.js` › 'aplica a folha de estilos (tokens de cor, layout e fontes)' (`:79`, `principalMax: '1280px'`) |
| Cursos: one course at a time, the choice kept until reload, closed courses behind "Mostrar encerrados" | `js/views/cursos.js:370-396` | `test/e2e/cursos.spec.js` › 'um curso de cada vez: a aba abre no primeiro ativo e fica no escolhido até recarregar; o encerrado, só com "Mostrar encerrados"' (`:1533`); › 'todos os cursos encerrados: o aviso; com "Mostrar encerrados", o primeiro deles' (`:1656`) |
| Cursos: students by phase and the phase index; the link brings the phase to 8 px from the top of the **window** and does not change the address | `js/views/cursos.js:269-322`, `:483-490`; `css/app.css:954` | `cursos.spec.js` › 'os alunos por fase e o índice das fases: o link leva à fase, sem mudar o endereço, com o foco no título dela' (`:1573`, `getBoundingClientRect().top` = 8 at `:1595`) |
| Cursos: phases collapse and stay so | `js/views/cursos.js:184-191`, `:467-479` | `cursos.spec.js` › 'as fases recolhem e abrem: …' (`:1605`) |
| Cursos: read-only profiles switch courses, collapse phases and use the index | no `data-act` on those controls (`js/eventos/cursos.js:517-533`) | `cursos.spec.js` › 'quem só consulta troca de curso, recolhe e abre as fases e usa o índice' (`:1675`) |
| Cursos: only the Administrador saves; the Operador is refused by the server | `js/views/cursos.js:36`; `supabase/migrations/20261117200000_cursos_e_missoes.sql:508-510` | `cursos.spec.js` › 'o Operador só consulta o programa: a gravação de um curso pela API é recusada pelo servidor (42501)' (`:593`); › 'no Gestor, o programa (em texto) e o curso dos alunos só aparecem' (`:144`); `supabase/tests/database/cursos.test.sql` (plan 91) |
| Cursos: program changes stay out of the History of the date | `js/eventos/cursos.js:179-225` | `cursos.spec.js` › 'o Administrador monta o programa: … tudo fica gravado nos cursos, fora do histórico da data' (`:28`) |
| Cursos: the editor table scrolls sideways at a 900 px viewport and keeps its scroll | `manterRolagens` (`js/views/cursos.js:424-432`) | `cursos.spec.js` › 'na tela estreita, a tabela da fase não volta ao começo a cada alteração' (`:1140`, `scrollLeft > 0` at `:1146-1148`) |
| Cursos on phones: sigla-only buttons, short index names, one card per mission, 44 px targets, 390 and 320 px | `css/app.css:993-1040` | `celular.spec.js` › 'a aba Cursos com o programa cabe na tela, com alvos de 44 px' (`:239`); › 'a aba Cursos em fases cabe na tela, com as caixas abertas e alvos de 44 px' (`:251`); › 'com muitos cursos, os botões dos cursos ficam inteiros no celular' (`:320`); `cursos.spec.js` › 'no celular, o cadeado do código travado fica ao lado do campo' (`:1164`) |
| Cursos: the tab open during a date change shows the program read again; the choice survives a date change | `js/actions.js:324` | `cursos.spec.js` › 'com a aba Cursos aberta, a data nova mostra o programa lido de novo' (`:316`); `:1557-1559` |
| Results: registered on the flight row, saved with who registered; the Gestor sees text | `js/views/etapas.js:176-185`; `js/eventos/escala.js:236-261` | `cursos.spec.js` › 'Usar a próxima missão; registrar o resultado na escala; o progresso e a próxima avançam; o resultado fica gravado' (`:184`); › 'no Gestor, o código e o resultado só aparecem' (`:230`); › 'o operador registra; o servidor guarda com quem registrou; o gestor vê o resultado e o progresso' (`:256`); › 'o resultado registrado antes de trocar de data fica no histórico da data do voo' (`:278`); `test/unit/resultados.test.js` (4); `supabase/tests/database/resultados.test.sql` (plan 27) |
| Next mission and progress | `js/progresso.js` | `test/unit/progresso.test.js` (34 tests) |
| Rodízio: queues, order buttons, the schedule follows the queue; cancelled flights do not count | `js/rodizio.js`; `js/eventos/rodizio.js` | `test/e2e/rodizio.spec.js` › 'mostra as filas, ajusta a ordem e a escala segue a fila' (`:9`); › 'compacto: os botões aparecem com o mouse ou o foco e a explicação leva ao Manual' (`:30`); 'o voo cancelado não conta no Rodízio, nos Recursos nem nos Instrutores' (`:53`); `test/unit/rodizio.test.js` (3) |
| Rodízio is per date: the open tab follows the date, and a change goes to the date on screen | `js/actions.js:319-324`; `js/dias.js:66` | `test/e2e/abertura.spec.js` › 'a aba Rodízio aberta numa troca de data mostra as filas da data nova, e o botão age sobre a fila que ela mostra' (`:641`); › 'a aba Rodízio aberta enquanto a escala abre mostra as filas quando os dados chegam' (`:662`); `test/unit/dias.test.js` › 'as filas fazem parte do dia e a nova data começa com quem voou na categoria no fim da fila' (`:271`) |
| BI: totals, filters, top 10; three snapshots | `js/views/bi.js` | `test/e2e/bi.spec.js` › 'registra o dia gerado, simula 30 dias, filtra e limpa' (`:12`, snapshots `bi-dia.json`, `bi-30-dias.json`, `bi-filtrado.json`); › 'os filtros seguem a Escala: Categoria e, dentro dela, Recurso; nada de "aviões e salas"' (`:37`); › 'horas por avião e por instrutor: os 10 maiores e "Ver todos"' (`:58`); `test/e2e/datas.spec.js` › 'o BI soma as escalas guardadas de cada data' (`:114`); `test/unit/dias.test.js:219-226` |
| `#bi-dt` follows the open date (three specs use it as the sign that a date loaded) | `js/actions.js:34` | `bi.spec.js:16`; `test/e2e/revisao.spec.js:50`; `test/e2e/publicado.spec.js:90` |
| The Painel is the fourth view of the Escala | `index.html:347-352` | `test/e2e/escala-tela.spec.js` › 'a barra troca entre Lista, Por recurso, Por instrutor e Painel' (`:12`); the describe 'Painel: partidas e chegadas como no aeroporto' (`:312`) |
| In the page the Painel has one list of 12 rows even at a 1,920 px viewport; two lists only in full screen | `js/config-do-painel.js:24`, `:69-73`; `js/views/painel-aeroporto.js:17`, `:111-126`; `css/app.css:228` | `test/e2e/painel-missoes.spec.js` › 'na tela grande, a tela cheia da Escala tem duas listas lado a lado; na página, uma' (`:103`); `test/unit/config-do-painel.test.js` › 'quantas listas: no Automático, duas a partir de 1.600 px de largura; nas outras, sempre as escolhidas' (`:89`) |
| "Configurar painel": every change at once, in the History; the Gestor only sees; Esc closes only the dialog | `js/views/config-do-painel.js` | `painel-missoes.spec.js` › 'liga, desliga e reordena as colunas e escolhe o quadro; cada mudança vale na hora e fica no Histórico' (`:169`); › 'o Gestor vê a configuração sem mudar nada; os quadros continuam à mão' (`:319`); › 'Esc fecha só o diálogo, a camada de cima' (`:344`); › 'no modo compartilhado, o Administrador grava a configuração no cadastro do servidor, com o Histórico' (`:356`) |
| The Painel and its dialog on phones | `css/app.css:373`, `:465`, `:626` | `celular.spec.js` › 'o painel e "Configurar painel" cabem no celular (390 e 320 px), com alvos de 44 px' (`:406`); `painel-missoes.spec.js` › 'sempre duas listas na tela de 390 px: …' (`:141`) |
| The board's content | `js/quadro.js` | `test/unit/quadro.test.js` (22 tests) |
| The TV page | `painel.html`; `js/painel.js`; `js/sessao-da-tv.js` | `test/e2e/painel-tv.spec.js` (21), `painel-sessao.spec.js` (13), `painel-meteorologia.spec.js` (13); `test/unit/sessao-da-tv.test.js` (28); `test/unit/csp.test.js` (both pages); `supabase/tests/database/painel.test.sql` (plan 58) |
| Histórico: a drawer over the open tab; follows the date; reverts | `js/eventos/historico.js`; `js/views/escala.js:267-301` | `test/e2e/historico.spec.js` (11 tests): › 'abre numa gaveta sobre a aba aberta, sem trocar de aba; Esc e ✕ fecham' (`:25`); › 'com o histórico aberto, trocar a data troca também a data do histórico' (`:44`); the undo and revert tests (`:53-377`); `datas.spec.js` › 'o histórico é separado por data' (`:66`); › 'reverter pelo histórico vale também depois de recarregar' (`:78`); `test/unit/reversoes.test.js` (26) |
| Histórico: focus and Esc layering with the other drawers, the dialogs, the menu and the map popup | `js/dom.js:42-78` | `acessibilidade.spec.js` › 'fechar o Histórico devolve o foco ao botão; o Manual leva o foco ao título dele' (`:379`); › 'com o Histórico aberto, o Esc dado na busca da Escala fecha a gaveta e o foco fica na busca' (`:499`); the 'o Esc fecha só a camada de cima…' and 'o Esc fecha só a gaveta de cima…' tests (`:642-1024`; 10 `test(` calls name the Histórico between `:499` and `:1024`, two of them looped over the other drawers, `:859-950`) |
| How much the specs lean on the drawer's ids | — | `#btn-open-log`: 65 lines in 21 spec files; `#audit-log-list`: 99 lines in 21 files (several read it while the drawer is closed, e.g. `rodizio.spec.js:25`); `#historico`: 50 lines in 13 files; `#log-cnt`: 19 lines in 9 files. Together (with `#historico-data`): 235 lines in 27 files under `test/e2e` |
| Manual: opens from any tab; headings, tab names and many phrases pinned; same width as the other pages | `index.html:429-649`; `js/views/manual.js` | `app.spec.js` › 'o botão Manual abre, de qualquer aba, o manual com as regras em vigor' (`:122`: the 8 `h3`, the 9 `#manual-abas h4`, `#manual-janelas li` = 9, 57 phrases that must be there and 33 that must not, `:140-185`); › 'o manual tem a largura das outras páginas e fica centralizado' (`:194`, measured against `#s-rec .vista-dia > .pn`); `test/unit/manual.test.js` (5); `test/unit/glossario.test.js` (4: every term's `aba` is in `ABAS_DO_GLOSSARIO`; every `data-dica` found in `index.html`, `js/*.js`, `js/views/*.js` exists) |
| Minha conta and the account menu | `js/eventos/conta.js`; `js/eventos/topo.js:65`, `:104-111` | `test/e2e/contas.spec.js` (10 tests): › 'reúne Minha conta, o tema e Sair; Esc fecha o menu' (`:116`); › 'o administrador tem Usuários no menu, que leva direto à lista de contas' (`:129`); `acessibilidade.spec.js` › 'o menu da conta: as setas, Home e End andam pelos itens; o Tab que sai do menu o fecha' (`:599`); `supabase/tests/database/contas.test.sql` (plan 28) |
| The header at intermediate widths | `css/app.css:193-214` | `acessibilidade.spec.js` › 'a <largura> px (modo <modo>), nada na barra cobre a marca, as setas da data ou as ferramentas' (`:240`, 11 widths; `#btn-open-log`, `#btn-manual`, `#btn-menu-conta`) |

Not covered by any phone, 320 px or accessible-name loop: the Manual and Minha conta (the loops walk the nine tabs and `main section.on`; `celular.spec.js:32-55`, `acessibilidade.spec.js:36-56`).

## 5. Answers

### 5.1 Where each is reached, by whom, what it depends on, its width needs and its phone behaviour

| Thing | Reached | Sees / changes | Depends on | Width | Phones (640 px and under) |
|---|---|---|---|---|---|
| Cursos | tab `cur` | sees: all four; changes: Adm in shared mode, Edit in local mode (`js/views/cursos.js:36`) | the course tables and the results of **all dates** (`S.programa`, `S.resultados.situacao`), the roster for the student lists (`S.stu[].curso`, `:270`). The **open date** matters in three places only: a code carried by a request or flight of the open date is locked, with the text "na Demanda <de amanhã> (<nomes>)" (`codigosDaDemanda`, `codigoNaDemanda`, `:56-73`, reading `S.stu`, `RES.out`, `DATA`); nothing is saved until a date is read (`aindaNaoAbriu`); the program is read again with every date (`js/storage.js:218-227`) | inside `main` (1,280 px cap). The editor table has 9 columns and `table.cadastro { min-width: 600px }` (`css/app.css:1070`) inside `.tw { overflow-x: auto }`; it already scrolls sideways at a 900 px viewport, about 836 px of room (**computed**; pinned by `cursos.spec.js:1140`) | course buttons with the sigla only, wrapping; index with short names; one card per mission (`css/app.css:993-1040`); `summary` and targets of 44 px |
| Rodízio | tab `rod` | sees: Op, Adm, Ges; changes: Op, Adm | the **open date**: `S.filas` of the day, the day's "Vem" (`x.on`), the day's schedule (`RES.out`, `S.fStatus`) (`js/views/rodizio.js:9-20`) | `.rodizio { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) }` (`css/app.css:1135`): 4 columns from 1,156 px, 2 from 572 px, 1 below (**computed**) | one column; rows of 48 px (`css/app.css:1597`); buttons always visible on touch |
| BI | tab `bi` | sees: Op, Adm, Ges; "Simular 30 dias" and "Limpar BI": local mode, Edit | the saved days of the period around its **own base date** `#bi-dt` (default: the open date); the open date's `S.frota`, `S.av`, `S.ins` for the fourth tile and the tags | tiles `repeat(auto-fit, minmax(160px, 1fr))` (`css/app.css:1208`); the two first tables side by side from 894 px of content (`.bi-grid-2`, `css/app.css:1498`, **computed**); tables with inline `min-width:100%` (`js/views/bi.js:134`), bars of 130 px (`css/app.css:1496`) | one column ("BI in one column on the phone", `docs/PLAN.md:188`) |
| Painel, Escala view | Escala › "Painel" | sees: all four; the board buttons, "Pausar", "Tela cheia": all; the setting: Op, Adm | the **open date**: the schedule after the Escala's filters, `S.fStatus`, `S.fObs`, `DATA` (the date shows in the title when it is not today, `js/views/painel-aeroporto.js:157`), the clock (rows leave "Missões" only on today's date, `minutoDoQuadro`, `js/quadro.js:113`), `S.painel` (roster), the weather function | `.fids-topo` and `table.fids-tabela` have `min-width: 860px`; `.fids { overflow-x: auto }` (`css/app.css:373-391`). Two lists on "Automático" from **1,600 px** of board width, if they fit (`js/config-do-painel.js:24`; `duasListasCabem`, `js/views/painel-aeroporto.js:96-109`); at the 1,280 cap the board is 1,248 px wide, so one list | the board scrolls sideways inside its frame; the four board buttons wrap; the two weather boxes stack (`css/app.css:465`) |
| Painel, full screen | "Tela cheia" | all four | same | the screen: letters in `vh`, shrink down to 60% to fit the width (`css/app.css:435`; `AJUSTE_MINIMO`, `js/views/painel-aeroporto.js:218-232`); two lists from 1,600 px | — |
| `painel.html` | its address | shared mode: the TV account only; local mode: anyone | **today**, always (server date in `America/Sao_Paulo`, `supabase/migrations/20261120150000…sql:17`; the app's open date is dropped on the redirect, `js/sessao.js:142-145`); the saved schedule of today; the roster's `painel` | the whole screen (`.fids.inteiro { position: fixed; inset: 0 }`, `css/app.css:439`) | not a phone page |
| "Configurar painel" | inside the Painel | opens: all four; changes: Op, Adm | `S.painel`; a loaded date for writing | `dialog.dlg-painel { width: min(460px, calc(100vw - 32px)) }` (`css/app.css:626`) | fits 390 and 320 px (`celular.spec.js:406`) |
| Histórico | header button | sees: Op, Adm, Ges; reverts: Op, Adm; "Limpar": local mode, Edit | the **open date** | drawer of `min(440px, 100vw)` at the right edge | full-width overlay; the header button shows only the icon and the count (`css/app.css:211`) |
| Manual | header button | all four | nothing (static, generated once) | `main` (1,280 px); `#manual-missoes` inside `.tw`, with the global `table { min-width: 840px }` (`css/app.css:562`) | flows; glossary in one column (`css/app.css:1693`) |
| Minha conta | account menu | all four, shared mode only; Usuários: Adm | the account; the account list | `.conta { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) }` (`css/app.css:1163`); `#lista-contas` table inside `.tw` (global 840 px minimum) | flows |

### 5.2 What each would need from a new shell

Pane widths used below (**computed** from the request's split on 1,248 px of content at the 1,280 px cap): about 374 / 599 / 275 px.

| Thing | List, detail and rail? | Needs the rail's date? | What the shell must give it |
|---|---|---|---|
| Cursos | It has the pieces: the course switcher is a list of courses, with an active flag and a "show inactive" filter already (`ativo`, "Mostrar encerrados"); the course card is a detail made of collapsible parts (students, index, phases). **The editor table does not fit a 599 px detail pane** (it scrolls at about 836 px). The read-only table (8 text columns) is narrower (not measured) | No. Only the code lock names the open date, and writing needs a loaded date | a wide detail (list + detail without the rail, or full width), or the phone card layout applied by pane width; `scrollIntoView` and the 8 px rule assume the window scrolls |
| Rodízio | It fits any pane: two columns at 599 px. A list of four categories and a detail with one queue is possible | **Yes**: the queues are the open date's, and the screen says "nesta data" and "na data seguinte" without naming the date (`index.html:380`; `js/views/rodizio.js:19`) | the date in sight; a redraw when the schedule changes (today only on open, see 7.1.3) |
| BI | Full-width page: four tiles, two tables side by side from 894 px, one more table. No record to select | Only if `#bi-dt` goes: the base date would then be the open date | either its own period control or the rail's date; see conflict 6.3 |
| Painel, Escala view | No: it needs 860 px at least and is "for a monitor or a TV" (`js/views/escala.js:556`); in a 599 px pane it scrolls sideways, as on a phone | **Yes** (the open date's schedule) | a wide area, the Escala's filters, and its container (`#out`) or a change of the selectors (1.6) |
| `painel.html` | Not part of the shell | No (always today) | `css/app.css` keeps working for `body.tela-painel`; the modules it imports keep their paths and exports |
| Histórico | It is the open date's log: it could be a list in the rail, a drawer, or a page. As a drawer at the right edge it covers the rail (440 px against about 275 px) | **Yes** | a place that does not hide the only date control; the stack of drawers if any drawer stays |
| Manual | Full-width reading page; its index could be a left list | No | native anchors and the 120 px `scroll-margin-top` assume the window scrolls |
| Minha conta, Usuários | Forms; the account table is a small list (6 rows in the test server, `contas.spec.js:136`) | No | a place in the account menu, shared mode only |

### 5.3 How mission results are registered; how the Cursos tab's student lists link to Alunos

**Registering a result**

- **Screen**: the Escala, view **Lista** only. The flight table `div.tw.tabela-escala` has, in the cell `td.c-status`, the status select followed by `resultadoNaEscala(o)` (`js/views/escala.js:545`, `:549`). The table is in the DOM in every view but hidden by CSS in the map and Painel views (`css/app.css:354-355`); the map popup has the status and no result (`conteudoDoPopup`, `js/views/escala.js:42-65`).
- **Control**: `select.res-sel.res-<atual>[data-resultado="<fKey>"][aria-label="Resultado de <aluno> em <código>"][data-dica="resultado"]`, options "Resultado" (`pendente`), "Aprovado", "Reprovado", after `span.etapa[data-dica="missao-do-curso"]` with the code (`js/views/etapas.js:176-185`). It exists only when the flight carries a course mission code (`o.etapa`) and a course is found (`cursoDoResultado`, `:170-173`: the request's `cursoDaEtapa`, else the student's course). For Read, or without a course, it is text ("Aprovado" / "Reprovado"). It is disabled when the results were not read.
- **Handler**: document `change` listener (`js/eventos/escala.js:236-261`). It refuses Read and a date not loaded; builds `{ aluno: o.stuId, curso, missao: o.etapa, resultado, data: DATA, voo: o.fKey }`; calls `ApiClient.registrarResultado` (`js/storage.js:309-312`) → RPC `registrar_resultado` (`js/backends/supabase.js:267-271`) or `acpm4_resultados`; replaces that mission's entry in `S.resultados.situacao`, appends to `doDia`; writes the History line "Resultado de <aluno> em <código>: <resultado>" with `logChange` **without saving the day** (it does not use `gravarAlteracao`); redraws `rOut(); rAlu(); rDem()` (not `rCursos()`: Cursos is redrawn when its tab opens).
- **Effects elsewhere**: the progress in Alunos and the next mission in the Demanda (`js/views/etapas.js:36-45`, `:148-155`); the mission's code becomes locked in Cursos (`codigoTravado`, `js/views/cursos.js:47`); a booked flight with a result cannot be undone from the History (`motivoParaNaoDesfazer`, `js/reversoes.js:147`).
- A result is never edited or deleted: a new row wins; "Resultado" (`pendente`) undoes a mistake (`js/resultados.js:1-3`).

**Cursos' student lists and Alunos**

- The list is `S.stu.filter(s => s.curso === curso.sigla)`, by name (`turmaDoCurso`, `js/views/cursos.js:269-280`), grouped by the phase each student is in (`faseDoAluno`, `js/views/etapas.js:160-165`), those who finished last.
- Each item is **text**: `<li>Nome · <small class="progresso" data-dica="progresso">2/8 · Fase 2 · próxima CT-01</small></li>` (`js/views/cursos.js:288-291`; `js/views/etapas.js:148-155`). There is no link, no button, no `data-go` and no student id in the markup.
- The only data link is the roster field `cadastro.stu[].curso`. Alunos edits it (`select[data-f="curso"]`, `js/views/cadastros.js:280`) with the active courses of `S.programa`, shows the same progress text, and filters by course (`opcoesDoFiltroDosCursos`, `js/cursos.js:53-62`). Alunos has no link to Cursos either.
- The app has one cross-tab button, "Abrir a Demanda" (`data-go="dem"`, `index.html:260`), and a test requires exactly one (`app.spec.js:75`). The `data-go` mechanism opens a tab; nothing today opens a tab on a given person.

### 5.4 The Histórico drawer

- **What opens it**: `#btn-open-log` toggles it (`js/eventos/historico.js:30`); ✕ and Esc close it (Esc only when it is the top drawer or holds the focus, and no `<dialog>` is open, `:32-34`; `js/dom.js:53-59`). On open the focus goes to ✕; on close it returns to the button if it was inside (`:20-29`). It is not modal: with it open a test changes the date with `#dt-prox` (`historico.spec.js:44-51`) and others type in the Escala's search (`acessibilidade.spec.js:499`).
- **What it shows**: the title "Histórico" with the open date ("quarta-feira, 11/11", `renderAuditPanel`, `js/views/escala.js:268-269`); the sentence "As alterações desta data, com quem fez e a hora. Algumas podem ser revertidas por aqui." (`index.html:672`); one `.audit-item` per entry, newest first: `[HH:MM:SS]` (an imported entry: `DD/MM HH:MM`, `js/actions.js:242-246`), the author, a badge "Inclusão" / "Exclusão" / "Edição", the description, "(importado)", and "gravando…" or "não gravada" while the save is pending or refused (`js/views/escala.js:281-298`). An entry that another entry reverted is hidden (`:271-272`). Empty: "Sem alterações registradas nesta data." The count of visible entries goes to `#log-cnt` (`:273-274`).
- **Only the open date**: yes. `lerData` reads `historicoDoDia(data)` with the date's data (`js/actions.js:254-265`, `:299`, `:311`); the server returns at most the 200 newest of that date (`js/backends/supabase.js:169-175`). But "of the date" means "made while that date was open": roster-wide changes are there too (2.5).
- **What is not in it**: course program changes (they are in "Alterações do programa", 1.3); registering and cancelling a request in the Agenda (only the import into the Demanda writes entries, `js/eventos/agenda.js:54`); accounts; the BI simulation; the values of personal data (only the names of the fields that changed, `index.html:535`).
- **What is in it that touches the privacy rule**: descriptions carry names of students and instructors, and the weight typed in the booking dialog with the person's name ("Peso <nome>: <kg> kg (agendamento)", `js/agendamento.js:1278`; `js/eventos/agendamento.js:38`). The cancel reason is logged by category only (`index.html:482`).
- **The reverts**: an entry with a `reverter` object that passes `validarReversao` (`js/reversoes.js:43-117`) gets a button with the entry's label. Reverting never deletes: it changes the data and writes a new entry "Revertido: …" that points to the reverted one (`reverte`), through `gravarAlteracao` (`js/eventos/historico.js:45-124`).

| `kind` | What the button does (`js/eventos/historico.js`) | Written by |
|---|---|---|
| `setFly` | sets "Voa" of a request and its extras (`:53-61`) | `js/eventos/demanda.js:42`, `:190`, `:221` |
| `setAv` | sets a resource available or in maintenance (`:62-65`) | `js/eventos/recursos.js:126` |
| `setAtributo` | sets a resource attribute (`:66-73`) | `js/eventos/recursos.js:86` |
| `setInsOn` | sets an instructor's "Vem" (`:74-80`) | `js/eventos/cadastros.js:146` |
| `restaurarFixos` | restores the pinned flights and chosen instructors from before a Sugestões repair (`:81-88`) | `js/eventos/escala.js:290` |
| `restaurarEscolha` | restores the chosen instructor and the pins (`:89-95`) | `js/eventos/escala.js:183`; `js/eventos/demanda.js:208` |
| `restaurarHorarios` | restores a category's take-off times and the requests that moved with them (`:96-106`) | `js/eventos/recursos.js:213` |
| `readicionarRecurso` | puts a removed resource back in the fleet (`:107-112`) | `js/eventos/recursos.js:155` |
| `desfazerAgendamento` | undoes a flight booked in the Escala; refused with a toast when the flight is in progress, has a result, or its request changed (`:113-123`; `motivoParaNaoDesfazer`, `js/reversoes.js:136-149`) | `js/agendamento.js:1274` |

Three of the nine kinds change roster data (`setAtributo`, `restaurarHorarios`, `readicionarRecurso`); they can be reverted only from the date on which they were made.

- **Against "No modal or pop-up for viewing or editing a record"**: the facts. The Histórico is an `<aside>`, not a `<dialog>`; it does not block the page; it shows log lines, not a record; its only editing controls are the revert buttons, which act on the open date's data (or on the roster, for the three kinds above). The plan of 2026-11 recorded it as a decision: "History as a side drawer over any tab" (`docs/PLAN.md:182`). The request's sentence stands in the paragraph about the cadastros (`pedido.md:56`); whether it reaches the Histórico is question 8.4. Independently of that sentence, the drawer's place collides with the rail (conflict 6.7).

### 5.5 Suggestions: where each goes in a navigation whose primary row is the four stage cards

These are suggestions. Each has its reason, cost, risk and the tests that pin today's placement.

1. **A "Cadastros" group with Alunos, INVAs, Recursos and Cursos; not the Rodízio.**
   - Reason: these four hold data for all dates. Cursos already behaves as the request wants the cadastros to behave (a list of items with an active flag and a filter for the inactive ones).
   - Cost: the nav markup and `show()`; Cursos keeps its screen. Risk: Cursos differs from the other three in who edits (Adm only) and in how it saves (its own queue, no History), so a shared master–detail component must not assume `gravarAlteracao`.
   - Tests: `app.spec.js:5`, `:67`; `acessibilidade.spec.js:547` ("Cursos é uma aba"); `irPara(page, 'cur')` in 9 files; the three nine-tab loops.
2. **The Rodízio inside the Escala stage, as one of its per-date inputs** (beside the compaction criteria and near "Ordem no hangar", which are per date too), or as a sub-task row of the Escala card ("rodízio").
   - Reason: `filas` is day data and an input of the engine (1.4, 2.2); grouping it with the cadastros would tell the operator it is valid for all dates.
   - Cost: moving `#rodizio` and its three buttons; the Manual. Risk: the Escala stage gets longer; the Gestor and the "Para o gestor" text point at a Rodízio tab (`index.html:599`).
   - Tests: `rodizio.spec.js` (3); `abertura.spec.js:641`, `:662`; `acessibilidade.spec.js:410`.
3. **A "utilities" group with BI and the Manual; Minha conta and Usuários stay in the account menu.**
   - Reason: none depends on the day's work. Cost: small. Risk for the BI: see conflict 6.3 (its own date).
   - Tests: `bi.spec.js`; `app.spec.js:122`, `:194`; `contas.spec.js:115-138`.
4. **The Painel stays a view of the Escala stage** (or of a later "operação do dia" place, see 8.2), with a wide layout, plus a visible link to the TV address.
   - Reason: it shows the Escala's filtered flights, it is drawn inside `#out`, and "Configurar painel" lives in it. Cost: none for the code if `#s-esc [data-tl="painel"]` stays. Risk: three panes do not fit it (6.6).
   - Tests: `escala-tela.spec.js:12`, `:312-510`; `painel-missoes.spec.js`; `painel-meteorologia.spec.js:55`, `:417`; `celular.spec.js:42`, `:406`.
5. **The Histórico as a part of the rail** ("Alterações desta data", under the notifications), or a drawer that opens over the list pane instead of over the rail.
   - Reason: it is the open date's log, and the rail is where the date is. Its entries already have the shape of the rail's agenda items: a time, a kind (three colours exist: `.audit-badge.inc`, `.exc`, `.mod`, `css/app.css:1488-1494`), a title, an author line.
   - Cost: high in tests (the ids `#btn-open-log`, `#historico`, `#audit-log-list`, `#log-cnt` are on 235 lines of 27 spec files; 10 Esc-layering `test(` calls name the Histórico). Keeping the ids and the `.gaveta` class on the new element lowers it. Risk: the rail is about 275 px wide at the cap and an entry has a description of up to 500 characters and a button.
   - Tests: `historico.spec.js`; `acessibilidade.spec.js:379`, `:499`, `:642-1024`; `datas.spec.js:66`, `:78`.

## 6. Conflicts with the request

1. **The Rodízio is not a cadastro.** The request lists it with "Recursos · Instrutores · Alunos · Cursos · Rodízio" (`pedido.md:9`), and the brief's example puts it in a cadastros group. Its queues are stored per date (`dia.filas`, `js/dias.js:66`), start each new date from the previous day's flights (`js/rodizio.js:34-46`) and are read by the engine (`js/engine.js:345`). Test: `abertura.spec.js:641` (the queue of 11/11 and of 12/11 differ; a change on 12/11 leaves 11/11 as it was).
2. **Cursos is not edited by the Operador.** The request's cadastros are edited by "Operador and Administrador" (`pedido.md:59`). The program is saved only by the Administrador (`js/views/cursos.js:36`; `supabase/migrations/20261117200000_cursos_e_missoes.sql:508-510`; Manual, `index.html:462-463`), outside the roster document, with its own versions, and never through `gravarAlteracao` or the History (1.3).
3. **The rail cannot be "the app's only date control" while the BI keeps "Data base".** The request names two controls to replace, `.topo-data` and the Agenda's calendar (`pedido.md:90`). There is a third, `input[type="date"]#bi-dt` (`index.html:655`), which changes the BI's period **without** opening another date (`js/eventos/bi.js:16`). Making the rail the BI's date means every BI period change loads a whole date (`carregarData`, `js/actions.js:321-328`) and moves the open date of every screen; that is a change of behaviour, against "their behaviour does not change" (`pedido.md:109`).
4. **The list "Cursos, Rodízio, BI, Painel, Histórico and Manual" leaves things out** (`pedido.md:109`): Minha conta and Usuários (`section#s-conta`), the account menu with the theme switch and Sair (`index.html:76-88`), the local-mode profile select `#role-sel` (`index.html:69-72`), and the TV page `painel.html`, which shares `css/app.css` and five modules with the app.
5. **"Painel" is not a tab.** It is the fourth view of the Escala (`index.html:351`), it shows the flights left by the Escala's filters, it is not drawn on a date without flights, and "Configurar painel" can only be opened from inside it (`js/views/escala.js:594-603`, `:624-625`; `js/views/painel-aeroporto.js:189`).
6. **"Three panes on every screen" against "their behaviour does not change".**
   - The Painel needs 860 px (`css/app.css:377`, `:391`) and the detail pane has about 599 px at the cap.
   - If the cap is raised or dropped so that the board reaches 1,600 px in the page, "Automático" shows two lists there. A test requires one list in the page at a 1,920 px viewport (`painel-missoes.spec.js:103-135`), and the plan and the Manual say the same (`docs/PLAN.md:456`; `index.html:480`).
   - The Cursos editor table scrolls sideways from about 836 px down (`cursos.spec.js:1140-1148`).
   - The BI's two tables stand side by side only from 894 px.
7. **The Histórico drawer covers the rail.** It is fixed at the right edge, 440 px wide (`css/app.css:1456`); the rail is the right 22%. With the drawer open the calendar would be under it, and a test changes the date with the drawer open (`historico.spec.js:44-51`).
8. **"No modal or pop-up for viewing or editing a record" and this area.** "Configurar painel" is a modal `<dialog>` (`dlg.showModal()`, `js/views/config-do-painel.js:152`) that edits a roster field, `cadastro.painel`. The Histórico is a non-modal drawer with revert buttons (5.4). The request's sentence is about the cadastros; the plan must say whether it reaches these two.
9. **"Missão anterior and atual … editing … through registering a result"** (`pedido.md:58`). Today a result can only be registered on a flight row of the open date in the Escala's Lista, for a flight that carries a course mission code (5.3). Neither Alunos nor Cursos has a result control, and the Cursos student list has no link to a student. (Details in `mapa-alunos.md`, 5.4.)
10. **The four stages end at Aprovar, but the day goes on after it.** The Manual's routine has two more steps after approval: the result of each course mission and the status of each flight during the day (`index.html:451-452`), and the Painel and the TV exist for that phase. None of the four cards names it.
11. **Precision on the phone tests.** The request says phones and 320 px are tested by `celular.spec.js` and `percorrerVistasEFiltros` (`pedido.md:92`). The 320 px loop is in `acessibilidade.spec.js:190-208`; `celular.spec.js` runs at 390 px, with 320 px in six of its tests (`:64`, `:174`, `:217`, `:251`, `:320`, `:406`). None of the loops opens the Manual or Minha conta.
12. **Notification sources.** The request lists `selo-esc`, `selo-age`, `selo-rec` (`pedido.md:90`). There are also `#selo-rec-dia` (`index.html:153`), the Histórico counter `#log-cnt` (`index.html:73`) and three notices at the top of `main`: `#aviso-sync`, `#aviso-link`, `#aviso-dados` (`index.html:108-123`).

## 7. Implications and options for the redesign (suggestions)

### 7.1 Facts the shell (F1) must handle

1. **`<section>` is reserved.** `show()` toggles every `<section>` of the document and the CSS hides every `section` without `.on` (`js/views/tabs.js:17`; `css/app.css:229-230`). A pane built as a `<section>` disappears. (The weather strip is a `div` for this reason: "um div: as seções do app são as abas", `js/views/meteorologia.js:36`.)
2. **Ids bound at import.** Removing `.topo-data`, the header buttons or the BI bar without editing the modules of 1.2 (last bullet) stops the app at import.
3. **Three screens redraw only when their tab opens** (`bi`, `cur`, `rod`, `js/views/tabs.js:25-27`), and `rRodizio()` is not in `refazerEscala()` (`js/actions.js:370-380`). This is correct only while one screen shows at a time. If the shell shows two of them together (a list and a detail, or the rail with data of another screen), the redraw must follow the data. The result handler does not redraw Cursos (`js/eventos/escala.js:260`).
4. **The window is the scroller.** `window.scrollTo(0, 0)`, `scrollIntoView`, the Manual's anchors, `scroll-margin-top` and one test value (8 px, `cursos.spec.js:1595`) assume it (1.2). With panes that scroll on their own these need a pane-aware version.
5. **Phone layouts are keyed on the viewport** (`@media (max-width: 640px)`, for example the Cursos cards, `css/app.css:993-1040`). A 599 px pane on a 1,280 px screen does not trigger them.
6. **`css/app.css` is shared with `painel.html`** (`painel.html:14`): rules on `body`, `main` and the tokens reach the TV login and notice. `test/unit/csp.test.js` reads both pages.
7. **The Painel module names `#out`** in seven places (`js/views/painel-aeroporto.js:27`, `:84`, `:178`, `:311`, `:313`, `:318`, `:326`) and the dialog in one more (`js/views/config-do-painel.js:139`). Moving the board out of the Escala means changing them and the Escala filters it receives.
8. **The Manual and the glossary are organised by tab.** `ABAS_DO_GLOSSARIO` has nine group names and every one of the 66 terms carries one (`js/glossario.js:14-121`); 13 term texts name a tab, a view or the top of the page (**ran**: `voo-agendado`, `sem-peso`, `curso-encerrado`, `horario-em-janela-fechada`, `janelas`, `horarios-de-decolagem`, `hangar`, `so-vfr`, `habilitacao-propria`, `so-parafuso`, `vem-nesta-data`, `nao-escalar-com`, `filtro-dos-cursos`). Tests pin the groups, the nine `h4` of "As abas" and 90 phrases of the text (`app.spec.js:122-192`; `test/unit/manual.test.js:41-46`; `test/unit/glossario.test.js:20-53`). The glossary test scans `index.html`, `js/*.js` and `js/views/*.js` only: a `data-dica` in a new folder is not checked.
9. **The History is per open date and includes roster edits** (2.5). In a design where the cadastros are "for all dates", their History lines and their reverts stay attached to whatever date the rail had.
10. **The drawer stack serves four drawers** (`js/dom.js:42-59`). If the two cadastro drawers go, the Histórico and the Sugestões still need it, unless both move.
11. **A new roster field must be added to `separar` and `juntar`** (`js/dias.js:38-54`, `:82-88`): the roster is rebuilt from a fixed list of fields on every save, which is why `painel` needed data format 25 (`js/migracoes.js:207-210`). Shell preferences of one person belong in `localStorage`, as the theme (`js/storage.js:34`).
12. **Renaming `js/agenda.js` touches this area**: `js/views/cursos.js:18` and `js/views/conta.js:6` import `FUSO_DO_AEROCLUBE` from it, and `painel.html` reaches it through `js/backends/local.js:4`.

### 7.2 Options, each with cost and risk

| # | Option | Cost | Risk |
|---|---|---|---|
| 1 | **Cursos, A: keep the screen as it is, full width, opened from the Cadastros group.** | lowest: nav only | an exception to "three panes on every screen" |
| 2 | **Cursos, B: list of courses on the left (row switch = `ativo`, filter = "Mostrar encerrados"), the course card in a wide detail, the rail collapsed on this screen.** | medium: the bar of `barraDosCursos` becomes the F2 list; `cursos.spec.js:1533`, `:1656`, `celular.spec.js:320` and `percorrerVistasEFiltros` change | the row switch needs Adm and a confirmation today ('Confirmar encerramento'); closing a course is not the same as hiding it (students stay enrolled) |
| 3 | **Cursos, C: full three panes, with the mission cards of the phone layout in the detail.** | high: the phone CSS moves from the viewport to the pane (container queries or a class), every Cursos layout test | the editor loses the table view on desktop; 47 e2e tests in `cursos.spec.js` |
| 4 | **Rodízio in the Escala stage** (5.5.2), with the date named on it. | medium: markup, the Manual, 3 specs | a longer Escala stage |
| 5 | **Rodízio stays a page, with the rail.** | low | it keeps looking like a cadastro if it sits in that group |
| 6 | **BI, A: drop `#bi-dt`; the base date is the open date.** | low in code (`js/actions.js:34`, `:334`; `js/views/bi.js:33`; `js/eventos/bi.js:16`, `:28`); three specs use `#bi-dt` as the "date loaded" sign | browsing months in the BI loads a full date each time and moves the open date (6.3) |
| 7 | **BI, B: keep "Data base" as the BI's period filter** and say in the plan that it is a filter, not a date control. | none | two calendars on screen when the rail shows |
| 8 | **Painel: keep it as the Escala's fourth view and let that view take the full width (rail collapsed).** | low | the cap decides whether two lists show in the page (6.6) |
| 9 | **"Configurar painel" inline** (a collapsible section beside the board) instead of the dialog, if "no modal" must reach it. | medium: `js/views/config-do-painel.js` already holds its own listeners; `painel-missoes.spec.js:169-376`, `celular.spec.js:406` | the board redraws under the controls at every change |
| 10 | **Histórico in the rail** (5.5.5), keeping the ids. | high in tests | the rail's width |
| 11 | **Histórico stays a drawer, anchored so that it does not cover the rail.** | low: one CSS rule; `historico.spec.js:44` keeps passing if the calendar stays reachable | it covers the detail pane instead |
| 12 | **A place for the day after approval** (status, results, the Painel, a link to the TV), as a fifth card or as the second half of Aprovar. | plan-level | it adds a stage the request did not ask for (question 8.2) |
| 13 | **A sub-task for the TV** in the last card: "painel de hoje publicado" (the TV shows "A escala de hoje ainda não foi publicada." when today's schedule is not saved, `js/views/painel-aeroporto.js:151`). | low | only meaningful when the open date is today |

## 8. Open questions for Pedro

1. Where do Minha conta, Usuários, the theme switch, Sair and (in local mode) the profile select go? The request does not place them.
2. Status, results and the Painel happen after Aprovar. Do they stay inside the Escala stage, move into Aprovar, or get a place of their own?
3. Is the Rodízio a per-date input of the Escala stage (what the data says) or a screen of its own? If a screen, in which group?
4. Does "no modal or pop-up for viewing or editing a record" reach "Configurar painel" (a modal dialog on a roster setting) and the Histórico drawer (a log with revert buttons)?
5. The Histórico: a part of the rail, a drawer that leaves the rail free, or a page? May the Secretaria keep not seeing it (today by CSS only)?
6. The BI's "Data base": does it stay as the BI's own period filter, or does the rail's date replace it (each period change then opens that date everywhere)?
7. The Painel in the page: one list always (today's rule at the 1,280 px cap), or two lists when the new shell gives it 1,600 px?
8. Cursos: is a wide two-pane screen (courses, then the course) acceptable as an exception to the three panes, or should the program editor be redesigned as cards?
9. Should a student's name in the Cursos list open that student in Alunos (and the course name in Alunos open Cursos)? Today there is no link either way.
10. Should the rail show on screens that do not depend on the date (Cursos, Manual, Minha conta)?
11. Is the Histórico counter (`#log-cnt`) one of the rail's notifications?
12. History lines of roster-wide changes are filed under the date that was open. Keep that, or give the cadastros their own log (as Cursos has)?
13. The Manual: one page as today, rewritten for the stages, or split with the index as a left list?
14. Should the app link to the TV address (`painel.html`) from the Painel, and should the pipeline show whether today's schedule is on the TV?

<!-- fim -->
