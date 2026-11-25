# Lacuna: which exports of the modules the redesign changes the reception TV really uses, and which painel tests notice

<!-- Discovery note for the production-line redesign. Local working note: never commit this file. -->

Read on the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to the worktree root; evidence is `path:line`. Nothing was changed in the worktree.
- **(static)** = read in the code. The 31 modules of the TV's graph were all read top to bottom, plus `painel.html`, the four `test/e2e/painel-*.spec.js`, `test/e2e/fixtures.js` (1-90), `test/e2e/supabase-falso.js` (1-150, 296-420), `test/helpers/montar.js`, `estado.js`, `exemplo.js`, `scripts/exportacoes-sem-uso.mjs`, `.github/workflows/testes.yml` and the migration `20261120150000_painel_do_dia_com_a_configuracao.sql`.
- **(ran)** = measured in Node 22.17, no browser, no network:
  1. an import walk from `js/painel.js`, from `js/main.js` and from each of the four spec files;
  2. a **scratch copy** (outside the repo) of `js/`, `test/helpers/` and `test/e2e/supabase-falso.js`, in which each of the 102 exports of the seven modules lost its `export` keyword, one at a time (the binding stays, so the module still evaluates: this models "the name is no longer exported and an importer was left behind"), and five entry points were imported: `js/painel.js`, `test/e2e/supabase-falso.js`, `test/helpers/montar.js`, `test/helpers/exemplo.js`, `js/engine.js`. A `SyntaxError: The requested module '…' does not provide an export named '…'` is a link failure. With the copy untouched, `js/painel.js` links and evaluates as far as `ReferenceError: document is not defined` (`js/views/painel-aeroporto.js:342`), and the other four load;
  3. the TV graph recomputed with single import lines taken out;
  4. `node --test` on `test/unit/quadro.test.js`, `sessao-da-tv.test.js`, `config-do-painel.test.js`, `csp.test.js`, `backend-local.test.js`, `escala-gravada.test.js`: 97 tests, all pass.
- **(inferred)** = no line or run proves it. Playwright is not installed in the worktree, so nothing here was seen in a browser: which e2e tests fail is derived from the code and from run 2.
- Scripts and the scratch copy: `/private/tmp/claude-501/-Users-pedrofernandes-ACPM/5d1f0955-e20a-47d4-acd8-3ee432e7a836/scratchpad/lacuna2/` (`walk.mjs`, `analise.mjs`, `ordem.mjs`, `experimento.mjs`, `sonda.mjs`, `cortes.mjs`, `copia/`); temporary.

## Answer

### 1. The short answer

1. **The count is right: 31 modules**, all through static imports from `js/painel.js` (ran); `painel.html` has one module script (`painel.html:45`) and `js/` has no `import()` at all (static: `grep -rn "import(" js` finds none). 29 of the 31 are also loaded by `index.html` (`index.html:767` → `js/main.js`, 100 of the 102 files of `js/`); the two that only the TV loads are `js/painel.js` and `js/sessao-da-tv.js` (ran; the same two that lacuna-1-importadores-do-que-sai names).
2. **The seven modules export 102 names** (`js/agenda.js` 11, `js/migracoes.js` 7, `js/habilitacoes.js` 10, `js/frota.js` 16, `js/horarios.js` 24, `js/rules.js` 22, `js/fixos.js` 12; ran, `Object.keys` of each module). Of them the TV page:
   - **needs 28 only to link** (a module of its graph names them in an `import`; section 3);
   - **calls 1**: `isGroundMission` (`js/rules.js:41`), in both modes;
   - **reads 1 more, in local mode only**: the regular expression `MATRICULA` (`js/frota.js:60`);
   - **never references the other 74** (section 4).
3. **In shared mode (the real reception TV) 15 of the 31 modules are loaded, linked and evaluated and nothing in them is ever used** (section 5). Six of the seven are among them: `js/agenda.js`, `js/migracoes.js`, `js/habilitacoes.js`, `js/horarios.js`, `js/fixos.js` and `js/frota.js` (local mode uses `js/frota.js`, for `MATRICULA`). Only `js/rules.js` has something the real TV runs.
4. **Three import lines put the seven in the graph** (ran, run 3):
   - `js/painel.js:15` (`backendLocal`, used only for two reads, `js/painel.js:82-83`) brings `js/agenda.js`, `js/fixos.js`, `js/migracoes.js`, `js/habilitacoes.js` and six more modules. Without it the graph has 21 modules, and of the seven only `js/frota.js`, `js/horarios.js` and `js/rules.js` stay.
   - `js/quadro.js:9` (`isGroundMission`) brings `js/rules.js`, which brings `js/horarios.js` (`js/rules.js:5`) and `js/cursos.js` (`js/rules.js:6`).
   - `js/quadro.js:11` (`normalizarLinhaGravada`) brings `js/escala-gravada.js`, which brings `js/frota.js` (`js/escala-gravada.js:10`).
5. **No test of the four `painel-*.spec.js` files singles out one export.** Every module that imports one of the 28 names is also part of the app's graph and (all but one name) of the Node side of the spec files, so a name left stale takes down the unit suite, the app and the TV together (section 6). The 74 other names can be renamed or removed without any effect on the TV page; 22 of them still stop the spec files from loading in Node if an importer is forgotten (section 4, marked \*).
6. **What notices a stale import first** (static): a stale *path* fails the lint (`scripts/exportacoes-sem-uso.mjs:66-73`: `o caminho "…" não existe`); a stale *name* is checked by nothing static and first fails in Node, when `npm run test:unit` links the module (section 6.4). The only import lines that only the TV's e2e tests cover are `js/painel.js:13-21` (20 names, section 7.1).
7. **`painel-missoes.spec.js` is not a TV test**: none of its 12 tests opens `painel.html` (section 6.1).

### 2. Why each of the seven modules is in the TV's graph

Every import line, inside the 31 modules, that reaches one of the seven (ran; 19 lines):

| Module | Reached through | Still in the graph without `js/painel.js:15`? |
|---|---|---|
| `js/agenda.js` | `js/backends/local.js:4` `{ prazoDaAgendaPermite }`, and nothing else | no |
| `js/fixos.js` | `js/agenda.js:11` `{ fixoPeloStatus }`, and nothing else | no |
| `js/migracoes.js` | `js/programa.js:12` `{ FORMATO_DOS_CURSOS }`, and nothing else (`js/programa.js` itself: `js/backends/local.js:9`, `js/agenda.js:7`, `js/progresso.js:9`) | no |
| `js/habilitacoes.js` | `js/migracoes.js:6` `{ habilitacoesDoNivel, marcasDoChecadorAntigo }`, and nothing else | no |
| `js/frota.js` | `js/escala-gravada.js:10` `{ MATRICULA }`; `js/fixos.js:7` `{ MATRICULA }`; `js/habilitacoes.js:7` `{ exigenciasDoAviao, PREFIXO_DA_HABILITACAO_DO_AVIAO, MATRICULA }`; `js/migracoes.js:7` `{ FROTA_INICIAL }` | yes (`js/escala-gravada.js:10`) |
| `js/horarios.js` | `js/rules.js:5` `{ periodoDoMinuto, minutoDaPreferencia, preferenciaValida, HORARIO_DO_SOLO }`; `js/agenda.js:5` `{ horariosDaMissao, preferenciasPadrao, paraMinuto }`; `js/fixos.js:9` `{ periodoDoMinuto }`; `js/migracoes.js:8` `{ HORARIOS_INICIAIS, minutoDaPreferencia, ajustarPreferencias }` | yes (`js/rules.js:5`) |
| `js/rules.js` | `js/quadro.js:9` `{ isGroundMission }`; `js/cursos.js:6` `{ duracaoValida }`; `js/agenda.js:4` (six names); `js/backends/local.js:11` `{ duracaoDigitada }`; `js/fixos.js:10` `{ deixarEmBranco }`; `js/migracoes.js:9` `{ disponibilidadeAtual }`; `js/programa.js:11` `{ duracaoValida }` | yes (`js/quadro.js:9`, `js/cursos.js:6`) |

Single lines taken out (ran, run 3):
- without `js/backends/local.js:4`: 28 modules; `js/agenda.js`, `js/fixos.js` and `js/progresso.js` leave; 17 of the 28 link names remain;
- without `js/programa.js:12`: 29 modules; `js/migracoes.js` and `js/habilitacoes.js` leave; 20 names remain;
- without both: 26 modules; 8 names remain (`isGroundMission`, `duracaoDigitada`, `duracaoValida`; `periodoDoMinuto`, `minutoDaPreferencia`, `preferenciaValida`, `HORARIO_DO_SOLO`; `MATRICULA`);
- without `js/painel.js:15`: 21 modules; `js/backends/local.js`, `js/agenda.js`, `js/programa.js`, `js/progresso.js`, `js/resultados.js`, `js/limites.js`, `js/dados-pessoais.js`, `js/migracoes.js`, `js/habilitacoes.js`, `js/fixos.js` leave; 7 names remain (the 8 above less `duracaoDigitada`);
- without `js/painel.js:15`, `js/quadro.js:9` and the two imports `js/escala-gravada.js:6` and `:10`: 17 modules and none of the seven.

What the local backend gives the TV: `backendLocal.ler('cadastro')` and `backendLocal.ler('dia:<hoje>')` (`js/painel.js:82-83`), which are `chaveLocal` plus `JSON.parse(localStorage.getItem(…))` and call no imported function (`js/backends/local.js:25-30`, `:86-93`). The other imports of that file (`js/backends/local.js:4-11`) serve methods the TV never calls.

Evaluation: none of the seven calls an imported function while it is evaluated (static: no top-level call in any of them). What runs at load on the TV is constants only: `HORARIOS_PADRAO`, `DE_30_EM_30`, `HORARIOS_INICIAIS`, `HORARIO_DO_SOLO` from `DAY` and `T` (`js/horarios.js:10-13`, `:40`); `PERIODOS` from `PRE` (`js/rules.js:12`); `FROTA_INICIAL` from `EQ`, `ACROBAT_REG`, `SO_VFR_INICIAL`, `HABILITACAO_PROPRIA_INICIAL` (`js/frota.js:14-18`); the tables of `js/habilitacoes.js:10-35` and the `PASSOS` literal (`js/migracoes.js:41-214`). So the window constants of `js/config.js` (`WIN`, `T`, `NI`, `DAY`, `PRE`: `js/config.js:4-8`, `:118-124`) are read on the TV at load, and by `js/format.js:2`, `js/fixos.js:8`, `js/escala-gravada.js:5` in functions. The only import cycle, `js/cursos.js:6` ↔ `js/rules.js:6`, evaluates in the same order on both pages (`js/cursos.js` first: position 7 then 9 of 31 on the TV, 8 then 10 of 100 in the app; ran).

### 3. The 28 names the TV graph needs to link

Each row was confirmed in run 2: without the `export`, importing `js/painel.js` fails with `SyntaxError: The requested module '<path>' does not provide an export named '<name>'`, before any line of the page's code runs.

| Module | Export (line) | Imported in the TV graph at | Used at | Runs on the TV? |
|---|---|---|---|---|
| `js/agenda.js` | `prazoDaAgendaPermite` (:38) | `js/backends/local.js:4` | `js/backends/local.js:165`, inside `registrarSolicitacao` (:161-184) | no |
| `js/migracoes.js` | `FORMATO_DOS_CURSOS` (:18) | `js/programa.js:12` | `js/programa.js:448` (`gravarCurso`), `:491` (`importarProgramas`) | no |
| `js/habilitacoes.js` | `habilitacoesDoNivel` (:123) | `js/migracoes.js:6` | `js/migracoes.js:59` (format step 6) | no |
| | `marcasDoChecadorAntigo` (:80) | `js/migracoes.js:6` | `js/migracoes.js:165` (step 20) | no |
| `js/frota.js` | `FROTA_INICIAL` (:14) | `js/migracoes.js:7` | `js/migracoes.js:91` (step 11) | no (built at load) |
| | `MATRICULA` (:60) | `js/escala-gravada.js:10`; `js/fixos.js:7`; `js/habilitacoes.js:7` | `js/escala-gravada.js:45`, `:112`; `js/fixos.js:18`; `js/habilitacoes.js:37` | **local mode only**: `js/escala-gravada.js:45`, for each stored row with `r` |
| | `PREFIXO_DA_HABILITACAO_DO_AVIAO` (:50) | `js/habilitacoes.js:7` | `js/habilitacoes.js:37-38` | no |
| | `exigenciasDoAviao` (:52) | `js/habilitacoes.js:7` | `js/habilitacoes.js:95` | no |
| `js/horarios.js` | `HORARIOS_INICIAIS` (:13) | `js/migracoes.js:8` | `js/migracoes.js:32`, `:101` (step 12) | no (built at load) |
| | `ajustarPreferencias` (:83) | `js/migracoes.js:8` | `js/migracoes.js:32` | no |
| | `minutoDaPreferencia` (:62) | `js/migracoes.js:8`; `js/rules.js:5` | `js/migracoes.js:24-25`; `js/rules.js:15` | no |
| | `periodoDoMinuto` (:55) | `js/rules.js:5`; `js/fixos.js:9` | `js/rules.js:23`; `js/fixos.js:171` | no |
| | `preferenciaValida` (:64) | `js/rules.js:5` | `js/rules.js:153-154` | no |
| | `HORARIO_DO_SOLO` (:40) | `js/rules.js:5` | `js/rules.js:178` | no (built at load) |
| | `horariosDaMissao` (:52) | `js/agenda.js:5` | `js/agenda.js:67`, `:150` | no |
| | `preferenciasPadrao` (:75) | `js/agenda.js:5` | `js/agenda.js:70` | no |
| | `paraMinuto` (:69) | `js/agenda.js:5` | `js/agenda.js:54` | no |
| `js/rules.js` | `isGroundMission` (:41) | `js/quadro.js:9` | `js/quadro.js:19`, `:33` | **yes, both modes** |
| | `duracaoDigitada` (:118) | `js/backends/local.js:11` | `js/backends/local.js:163` | no |
| | `duracaoValida` (:124) | `js/cursos.js:6`; `js/programa.js:11` | `js/cursos.js:28`; `js/programa.js:228` | no |
| | `deixarEmBranco` (:86) | `js/fixos.js:10` | `js/fixos.js:107` (`limparDemanda`) | no |
| | `disponibilidadeAtual` (:30) | `js/agenda.js:4`; `js/migracoes.js:9` | `js/agenda.js:53`, `:55`; `js/migracoes.js:27` | no |
| | `disponibilidadeDoAluno` (:19) | `js/agenda.js:4` | `js/agenda.js:68` | no |
| | `normalizeMissionFields` (:142) | `js/agenda.js:4` | `js/agenda.js:78` | no |
| | `migrateLegacyMissionName` (:102) | `js/agenda.js:4` | `js/agenda.js:117` | no |
| | `duracaoPadraoDaMissao` (:76) | `js/agenda.js:4` | `js/agenda.js:74` | no |
| | `alvoDoNovoPedido` (:95) | `js/agenda.js:4` | `js/agenda.js:135` | no |
| `js/fixos.js` | `fixoPeloStatus` (:41) | `js/agenda.js:11` | `js/agenda.js:91` | no |

Per module: `js/agenda.js` 1, `js/migracoes.js` 1, `js/habilitacoes.js` 2, `js/frota.js` 4, `js/horarios.js` 9, `js/rules.js` 10, `js/fixos.js` 1.

The ten modules that hold those import lines (`js/backends/local.js`, `js/agenda.js`, `js/programa.js`, `js/migracoes.js`, `js/habilitacoes.js`, `js/fixos.js`, `js/rules.js`, `js/cursos.js`, `js/escala-gravada.js`, `js/quadro.js`) are all part of the app's graph too (ran). None is one of the two TV-only modules: `js/painel.js:13-21` and `js/sessao-da-tv.js:12` import nothing from the seven (static).

### 4. The 74 names the TV graph never references

Renaming or removing any of these cannot change what `painel.html` loads (ran, run 2: `js/painel.js` still links without each of them). \* = an importer of the Node side of the spec files names it (section 6.3): 22 names.

- `js/agenda.js` (10 of 11): `FUSO_DO_AEROCLUBE` (:13), `JANELAS_DA_AGENDA` (:15), `hojeEmSaoPaulo` (:25), `ehDomingo` (:28), `prazoDaData` (:32), `primeiraDataAberta` (:45), `disponibilidadeDaSolicitacao` (:52), `pedidoDaSolicitacao` (:63), `importarSolicitacoes` (:107), `vagaDeVooLocal` (:145).
- `js/migracoes.js` (6 of 7): `ESQUEMA` (:13), `renomearSimulador` (:39), `precisaMigrar` (:218), `antesDosCursosProprios` (:222), `migrarCadastro`\* (:231), `migrarDia`\* (:232).
- `js/habilitacoes.js` (8 of 10): `HABILITACOES` (:10), `nomeDaHabilitacao` (:38), `normalizarHabilitacoes` (:43), `ehCheque`\* (:72), `exigencias` (:89), `podeFazer`\* (:100), `podeAlgumCheque`\* (:106), `descreverExigencias`\* (:108).
- `js/frota.js` (12 of 16): `TIPOS_DA_FROTA` (:11), `ATRIBUTOS_DO_RECURSO` (:23), `atributoVale` (:28), `aviaoServe`\* (:40), `motivoDoAviao`\* (:42), `habilitacaoDoAviao` (:51), `instrutorVoaNoAviao`\* (:54), `matriculasParaOVoo`\* (:57), `normalizarFrota`\* (:65), `matriculasDoTipo`\* (:74), `recursoDaFrota`\* (:78), `novoRecurso` (:81).
- `js/horarios.js` (15 of 24): `HORARIOS_PADRAO` (:10), `DE_30_EM_30` (:11), `CATEGORIAS_COM_HORARIOS` (:14), `PRIMEIRO_HORARIO` (:17), `normalizarHorarios`\* (:21), `horariosDoTipo` (:33), `fimDaMissao` (:43), `fimDasMissoesDoDia`\* (:47), `ordenarPelaPreferencia`\* (:98), `ULTIMO_HORARIO` (:106), `modeloDosHorarios` (:111), `descreverHorarios` (:121), `porPeriodo` (:141), `impactoDosHorarios` (:148), `resumoDoImpacto` (:161).
- `js/rules.js` (12 of 22): `disponibilidadeValida` (:28), `rotuloDaDisponibilidade`\* (:32), `opcoesDeDisponibilidade` (:35), `doesGroundGateFlight`\* (:44), `chaveTemSobras` (:62), `proximoMid` (:67), `duracaoFixaDaMissao`\* (:79), `blank`\* (:82), `ERRO_DA_DURACAO` (:117), `pesoValido` (:133), `ERRO_DO_PESO` (:136), `pesoDigitado` (:137).
- `js/fixos.js` (11 of 12): `normalizarFixos`\* (:14), `normalizarAprovacao`\* (:29), `pinoDoVoo` (:35), `fixosAoMudarStatus` (:44), `fixosAoReabrir` (:52), `fixosAoAprovar` (:59), `semAgendados` (:78), `limparDemanda` (:95), `fixosQueVoltam` (:141), `pinoDeVoltaNaTurma` (:161), `motivoDoFixo` (:179).

Some of them are used inside their own module by a function of section 3 (`horariosDoTipo` by `horariosDaMissao`, `js/horarios.js:52`; `blank` by `deixarEmBranco`, `js/rules.js:87`; `chaveTemSobras` and `proximoMid` by `alvoDoNovoPedido`, `js/rules.js:96-97`; `duracaoFixaDaMissao` by `normalizeMissionFields`, `js/rules.js:175`): that is internal to the module, not a TV dependency.

### 5. What the TV page executes

Entry: `iniciar()` (`js/painel.js:264-278`, called at `:280`).

- **Shared mode** (`projetoSupabase()` gives a project, `js/painel.js:265-267`): `conectar` (`:235-262`); the board comes from `cliente.rpc('painel_do_dia')` (`:254-258`) every 60 s (`:23`, `:274`) and is kept as `{ data, voos, fStatus, fObs, painel }` (`:65`); the weather from `servidor.meteorologia()` (`:259-260`). Drawing: `painelNaTela(tela, fonte)` (`:272`; `js/views/painel-aeroporto.js:236-252`), where `fonte()` calls `linhasDoQuadro(quadro.voos, quadro.fStatus, quadro.fObs)` (`js/painel.js:34-39`).
- **Local mode** (no project, `js/painel.js:268`): `buscarNesteNavegador` (`:81-84`) reads `acpm4_cadastro` and `acpm4_dia_<hoje>` (`js/backends/local.js:13`, `:15`) **raw**, with no `migrarCadastro` or `migrarDia` and no look at `esquema`, and passes the day to `quadroDoDia` (`js/quadro.js:146-154`), which runs every stored row through `normalizarLinhaGravada` (`js/escala-gravada.js:73-82`). From the cadastro it keeps only `painel` (`js/painel.js:83`).
- **`isGroundMission`** runs inside `linhasDoQuadro`: `(o.isGround || isGroundMission(o.mis)) && o.classKey` (`js/quadro.js:19`) and `Boolean(principal.isGround || isGroundMission(principal.mis))` (`:33`), on every redraw (`fonte()` at `js/views/painel-aeroporto.js:112` and `:150`; redraws at each poll, `js/painel.js:72`, at each page change and each minute, `js/views/painel-aeroporto.js:284-302`). The engine writes `isGround` on every row (`js/engine.js:388`, `:519`, `:721`, `:894`), the server always sends a boolean (`supabase/migrations/20261120150000_painel_do_dia_com_a_configuracao.sql:63`) and so does `quadroDoDia` (`js/quadro.js:151`). So the function is called for every row not marked as Ground, where it must answer false, and it decides alone only for a Ground row stored without `isGround`. It needs `MIS` and nothing else (`js/rules.js:39-41`; `js/config.js:51-73`).
- **`MATRICULA`**: `r: v => typeof v === 'string' && MATRICULA.test(v)` (`js/escala-gravada.js:45`); a row that fails any known field is dropped whole (`:78`; `js/quadro.js:148`). Local mode only on the page. The same code is the e2e fake's `painel_do_dia` (`test/e2e/supabase-falso.js:407-413`), in Node.
- **Nothing else of the seven.** `prazoDaAgendaPermite`, the format steps, `FORMATO_DOS_CURSOS`, the habilitações, the take-off times and the fixed flights are behind methods of `backendLocal` and functions the page never calls (section 3, "Used at").
- **Modules with something used at run time in shared mode: 16** (`js/painel.js`, `js/config-supabase.js`, `js/perfis.js`, `js/backends/supabase.js`, `js/meteorologia.js`, `js/views/meteorologia.js`, `js/quadro.js`, `js/views/painel-aeroporto.js`, `js/config-do-painel.js`, `js/format.js`, `js/sessao-da-tv.js`, `js/status.js`, `js/voo.js`, `js/categorias.js`, `js/config.js`, `js/rules.js`). **Loaded and never used in shared mode: 15** (`js/backends/local.js`, `js/agenda.js`, `js/programa.js`, `js/progresso.js`, `js/resultados.js`, `js/limites.js`, `js/dados-pessoais.js`, `js/migracoes.js`, `js/habilitacoes.js`, `js/horarios.js`, `js/fixos.js`, `js/frota.js`, `js/cursos.js`, `js/conflitos.js`, `js/escala-gravada.js`). Local mode uses five of those: `js/backends/local.js` (`ler`), `js/escala-gravada.js`, `js/frota.js` (`MATRICULA`), `js/cursos.js` (`codigoValido`, `js/escala-gravada.js:67`, for a row with `etapa`), `js/conflitos.js` (`CODIGOS_DE_CONFLITO`, `:66`, for a row with `conflitoCodigos`).
- **The page writes no schedule data**: its only writes are the session keys (`js/painel.js:198-199`) and the stored login (`entrada.guardar` and `limpar`, `:127-134`, `:179`, `:246`); it calls `rpc('painel_do_dia')` and the function `meteorologia`, nothing else (`:255`, `:260`).

### 6. Which tests fail

#### 6.1 Which tests open the TV page (static)

| File | Tests | Open `painel.html` | Do not |
|---|---|---|---|
| `test/e2e/painel-tv.spec.js` | 32 (21 `test(` calls; the loops at :125, :161, :383 make 5, 6 and 3) | all 32: 20 in local mode (declared at :59, :75, :93, :104, :126, :163, :199, :216, :231, :250, :271) and 12 with the fake server (:276, :305, :329, :347, :384, :413, :430, :444, :458, :474) | none; three also open the app (:432 and :436; :460 and :468, with `#usuario` at :462, :469; :486) |
| `test/e2e/painel-sessao.spec.js` | 13 | all 13, with the fake server (:69, :98, :121, :143, :166, :193, :214, :241, :270, :298, :324, :359 and :361, :402) | none |
| `test/e2e/painel-meteorologia.spec.js` | 15 (13 `test(` calls; the loop at :301 makes 3) | 11 (:86, :109, :150, :186, :198, :272, :302 ×3, :320, :376) | 4: :55, :174, :217, :417, the Painel view of the Escala |
| `test/e2e/painel-missoes.spec.js` | 12 (11 `test(` calls; the loop at :140 makes 2) | **none** | all 12: `abrir` at :45, :79, :106, :143, :160, :170, :253, :301, :321, :345 and `entrar` at :362 |
| `test/e2e/seguranca.spec.js` | | 2 (:255, :263) | |

So 58 e2e tests load the TV page. `test/e2e/publicado.spec.js:57-62` does it against the published site and only with the accounts' passwords.

#### 6.2 A name of section 3 left stale: the page never starts

- The module graph fails to link, so `iniciar()` never runs (`js/painel.js:280`). Everything in the page starts hidden and only that script shows it: `#form-login` (`painel.html:25`; shown at `js/painel.js:103`), `#quadro` (`painel.html:37`; `js/painel.js:271`), `#aviso-da-tv` (`painel.html:39`), `#btn-sair-tv` (`painel.html:43`). The screen stays empty (inferred: not seen in a browser).
- All 58 tests fail: the local-mode ones at their first `.fids` assertion (for example `test/e2e/painel-tv.spec.js:63`), since `#quadro` only gets the class `fids` at `js/views/painel-aeroporto.js:240`; the others at the login, `expect(page.locator('#form-login')).toBeVisible()` (`test/e2e/painel-sessao.spec.js:48`) or `preencherLogin` (`test/e2e/fixtures.js:74-78`) on a hidden form. The uncaught error also fails the `page` fixture (`test/e2e/fixtures.js:38-39`, `:48-52`) (inferred).
- **And the app fails with it.** The ten importer modules are in the app's graph, so `index.html` does not start either: `abrir` waits for `#wins input[data-a="win"]` (`test/e2e/fixtures.js:65`) and `entrar` for `body[data-pronto]` (`:85`). The 12 tests of `painel-missoes.spec.js` and the 4 app tests of `painel-meteorologia.spec.js` fail too, with every other spec. No test of the four files fails alone, for any of the 28 names.

#### 6.3 The Node side of the spec files

The four files import app modules in Node, so a missing export stops the whole file from loading (every test of the file is lost):

- All four import `test/e2e/supabase-falso.js` (`painel-tv.spec.js:7`, `painel-sessao.spec.js:7`, `painel-meteorologia.spec.js:7`, `painel-missoes.spec.js:6`), which imports `separar` (`js/dias.js`), `migrarCadastro`, `migrarDia`, `prazoDaAgendaPermite`, `gravarDadosPessoais`, `semQuemSaiu`, `quadroDoDia`, `acumularHoras`, `situacaoPorMissao`, `validarRegistro`, `normalizarCursos`, `cursosIniciais`, `gravarCurso`, `importarProgramas`, `programaComResultados`, `programaDoLegado` (`test/e2e/supabase-falso.js:8-16`). 23 spec files and `test/unit/supabase-falso.test.js` import it.
- Three import `runAllocationEngine` (`painel-tv.spec.js:8`, `painel-sessao.spec.js:8`, `painel-meteorologia.spec.js:8`) and build today's schedule in Node from the helpers' states (`painel-tv.spec.js:20-48`, `:232-238`; `painel-sessao.spec.js:19-27`; `painel-meteorologia.spec.js:20-29`).
- The helpers import `habilitacoesDoNivel` (`test/helpers/montar.js:3`, `estado.js:3`, `exemplo.js:6`), `blank` (`exemplo.js:5`) and `WIN`, `NI`, `GROUND_EQ_TYPE`, `GROUND_DURATION_H`, `SIM_EQ_TYPES`, `MIS` (`exemplo.js:3`).
- Run 2: without the export, `test/e2e/supabase-falso.js` fails to load for **37** of the 102 names (27 of the 28 of section 3, all but `duracaoDigitada`, plus `migrarCadastro`, `migrarDia`, `ehCheque`, `podeAlgumCheque`, `podeFazer`, `normalizarFrota`, `normalizarHorarios`, `blank`, `normalizarAprovacao`, `normalizarFixos`, which `js/dias.js:5`, `:8`, `:9`, `:12` and `js/rodizio.js:4` import); `js/engine.js` for **33**, of which 12 are not among the 37 (`descreverExigencias`, `aviaoServe`, `instrutorVoaNoAviao`, `matriculasDoTipo`, `matriculasParaOVoo`, `motivoDoAviao`, `recursoDaFrota`, `fimDasMissoesDoDia`, `ordenarPelaPreferencia`, `doesGroundGateFlight`, `duracaoFixaDaMissao`, `rotuloDaDisponibilidade`; `js/engine.js:4`, `:7`, `:8`, `:9`, `js/viabilidade.js:5-6`, `js/compactar.js:12`, `:17`, `:18`); the helpers for **10**, all among the 37. Together: 49 names for `painel-tv`, `painel-sessao` and `painel-meteorologia`; 37 for `painel-missoes`, whose Node side has no engine. The 22 names marked \* in section 4 are the ones of these 49 that the TV page itself does not need.
- The lines in test files that name the seven directly, to update with a rename: `test/e2e/supabase-falso.js:9` (`migrarCadastro`, `migrarDia`), `:10` (`prazoDaAgendaPermite`); `test/helpers/montar.js:3`, `estado.js:3`, `exemplo.js:6` (`habilitacoesDoNivel`); `exemplo.js:5` (`blank`).

#### 6.4 What notices first (static)

- **A stale path** (a file renamed or deleted, an importer left): `scripts/exportacoes-sem-uso.mjs:66-73` reports `o caminho "…" não existe` and exits 1 (`:149-152`). It is the first check of the CI job (`.github/workflows/testes.yml:18-19`), and it is not part of `npm test` (`package.json:11`, `:15`; mapa-testes-e-docs, its line 668, already has this).
- **A stale name**: nothing static. That script compares exports with imports only to find unused exports (`:128-146`), and ESLint runs the recommended rules, which have no rule for imported names (`eslint.config.js:9`). It first shows when Node links the module in `npm run test:unit` (`package.json:12`): each of the ten importer modules has a unit test that imports it (`test/unit/backend-local.test.js:4`, `agenda.test.js:4`, `programa.test.js:11`, `migracoes.test.js:5`, `habilitacoes.test.js:4`, `fixos.test.js:7`, `rules.test.js:7`, `cursos.test.js:5`, `escala-gravada.test.js:6`, `quadro.test.js:6`). In CI the unit step runs before Playwright (`.github/workflows/testes.yml:31-34`), so the painel specs would not even start.
- **Covered only by the 58 TV tests**: the import lines of `js/painel.js:13-21`, because that module cannot be imported in Node (it starts the page at `:280`) and the app does not load it.

#### 6.5 Behaviour, with no rename

- `isGroundMission` answering true for a flight would draw that row as a Ground class: "Ground" as the model and "1 aluno" in place of the name (`js/quadro.js:33`, `:73`, `:75`); the board tests that expect names notice at once (for example `test/e2e/painel-tv.spec.js:65`). Answering false for a Ground mission changes nothing for rows that carry `isGround: true`, which is every row the engine writes; the fixtures of the tests carry it too (`test/unit/quadro.test.js:9`, `:13`), so no painel test would notice that one (static).
- `MATRICULA` made stricter than the matrículas already stored would drop rows from the local-mode TV and from the fake server's board (the 20 local-mode tests of `painel-tv.spec.js`, the shared-mode ones through `test/e2e/supabase-falso.js:411`), and not from the real server, whose SQL only cuts `r` to 15 characters (`20261120150000…sql:64`).
- The same gap for the other fields: the fake's `painel_do_dia` is the app's `quadroDoDia`, which drops a row with a `mis` outside `MIS`, an `eqType` outside `ALL_EQ_TYPES`, a `w` outside 0 to `NI` or a `status` outside the list (`js/escala-gravada.js:32`, `:39`, `:42`, `:53`, `:78`); the SQL keeps every row with a valid key and valid times and turns an unknown status into 'Confirmado' (`20261120150000…sql:67`, `:74`). The shared-mode painel tests exercise the JavaScript, not the SQL.

### 7. What else the TV shares with things the redesign changes (not exports of the seven)

1. **The 20 names `js/painel.js` imports** (`js/painel.js:13-21`): `projetoSupabase`, `chaveDaSessao`, `chaveDaEntradaDaTV` (`js/config-supabase.js`); `soPainel` (`js/perfis.js`, also `js/sessao-da-tv.js:12`); `backendLocal` and its method `ler` (`js/backends/local.js`); `criarBackendSupabase` and its method `meteorologia` (`js/backends/supabase.js`); `configurarMeteorologia` (`js/meteorologia.js`); `linhasDoQuadro`, `quadroDoDia` (`js/quadro.js`); `painelNaTela`, `atualizarPainel` (`js/views/painel-aeroporto.js`; only `js/painel.js` imports these two); `hm`, `hojeISO`, `minutoDoDia` (`js/format.js`); `TIQUE_MS`, `acordou`, `criarSessaoDaTV`, `falhaPassageira`, `guardaDaEntrada`, `telaDaTV` (`js/sessao-da-tv.js`). Workstreams A and D change `js/perfis.js` and the two backends.
2. **Any new import at the top of a module of the graph joins the TV's graph.** A data-format step that imports a helper (`js/migracoes.js:6-11` today), or an approval rule imported by `js/backends/local.js`, becomes a file the TV downloads and must link.
3. **The stored fields the board reads**: in the day, `resultado.out[]` (`fKey`, `classKey`, `isGround`, `a`, `b`, `r`, `eqType`, `s`, `ins`, `mis`, `etapa`, `status`), `fStatus`, `fObs`; in the cadastro, `painel` (`js/quadro.js:148-153`; `js/painel.js:83`; `20261120150000…sql:37`, `:53`, `:61-82`). No data-format step reaches the TV unless it changes those.
4. **The app's side of the TV account**: the redirect to `painel.html` (`js/sessao.js:139-147`, tested at `test/e2e/painel-tv.spec.js:430-440`), `#usuario` (`index.html:79`; `painel-tv.spec.js:462`, `:469`) and the login ids both pages share through `preencherLogin` (`#login-email`, `#login-senha`, `#btn-entrar`: `index.html:129-131`; `painel.html:30-31`, `:35`).
5. **The helpers' state**: `aw: Array(JANELAS).fill(true)` (`test/helpers/montar.js:7`; `estado.js:29`; `exemplo.js:24`), `win` (`estado.js:36`; `montar.js:31`) and the request on the student (`montar.js:11-15`). Three of the four spec files pass that state straight to `runAllocationEngine` in Node, without `migrarDia` (section 6.3); `documentosAtuais` migrates only the stored copy (`test/e2e/supabase-falso.js:63-70`). The engine reads `x.aw` at `js/viabilidade.js:54` and `state.win` at `js/engine.js:446`, `:601`, `:811`.
6. **When a broken page would show.** A TV already on keeps the modules it loaded (no `import()` in `js/`), so a deploy reaches it only at its 03:00 reload (`js/painel.js:210-231`), which checks that the page's address answers a HEAD request, not that the modules load (`:216`). If the graph then fails to link, the script that would schedule the next reload never runs (`:277`, inside `iniciar`), and `painel.html` has no other script or refresh (`painel.html:1-47`): the TV stays blank until someone reloads it by hand (inferred from the code; not run).
7. The stylesheet and the icons: `css/app.css` (lacuna-1-css-por-tela has the rules that reach the page); the page's own sprite `i-aviao`, `i-decolagem`, `i-pouso` (`painel.html:20-22`; `js/views/painel-aeroporto.js:19-21`, `:158`).

### 8. The repo's rules in this area

- **Personal data**: `js/dados-pessoais.js` is in the TV's graph as code only (`js/backends/local.js:5`); the page calls none of it. The board shows the student's short name and only the category of a cancel reason (`js/quadro.js:136-141`, `:151`, `:157-167`). In local mode the page reads the whole cadastro document of that browser and keeps `painel` (`js/painel.js:82-83`).
- **`gravarAlteracao`**: not involved; the page changes no data (section 5).
- **The engine and its goldens**: not on the page. Three painel spec files call `runAllocationEngine` in Node with today's `state` shape (section 6.3), so they depend on the answer to the request's question about the engine's input (`pedido.md:40`).
- **Data-format steps**: the page reads its local documents without migrating them and never reads `ESQUEMA` (section 5); `test/unit/config-do-painel.test.js:127` asserts `ESQUEMA === 25` and changes with every step.
- **Fictitious names**: the fixtures of the four files use invented names ('Maria Silva Santos', 'João', 'Ana Lima', 'Bruno Melo', 'Carla Dias': `test/e2e/painel-tv.spec.js:23`, `:234-235`).

## What the maps got wrong or left out

1. **mapa-outras-abas, its line 343** (the `painel.html` row of table 6): "the modules it imports keep their paths and exports". It lists no module and no export, and read literally it freezes 102 names and seven paths. The page needs 28 of the 102 names to link and calls one; D's rename of `js/agenda.js` meets the TV in one import line (`js/backends/local.js:4`).
2. **mapa-outras-abas, section 1.6 (its line 73)**: "Its import graph reaches `js/backends/local.js`, which imports `js/agenda.js`, `js/programa.js`, `js/resultados.js`, `js/dados-pessoais.js`, `js/limites.js`, `js/rules.js`". That is the first level only. Left out: `js/migracoes.js` (through `js/programa.js:12`) and `js/habilitacoes.js` (through `js/migracoes.js:6`), `js/fixos.js` and `js/progresso.js` (through `js/agenda.js:11`, `:8`), `js/frota.js`, `js/horarios.js`, `js/cursos.js`; and that `js/quadro.js` brings `js/rules.js`, `js/horarios.js` and `js/frota.js` on its own (`js/quadro.js:9`, `:11`), whatever happens to the local backend.
3. **mapa-outras-abas, section 7.2 item 12 (its line 448)** is right that `painel.html` reaches `js/agenda.js` through `js/backends/local.js:4`, and does not say that this is the only line, for one name out of eleven.
4. **mapa-outras-abas, its line 297**: "`test/e2e/painel-tv.spec.js` (21) … `painel-meteorologia.spec.js` (13)" counts `test(` calls. The loops make 32 and 15 tests, the numbers mapa-testes-e-docs has.
5. **mapa-testes-e-docs, its line 536**: "Files that need little or nothing if `abrir`, `abrirEscala` and `#out` survive: painel-tv (32), painel-sessao (13), painel-meteorologia (15), painel-missoes (12)".
   - `painel-tv` and `painel-sessao` use none of the three (`test/e2e/painel-tv.spec.js:6`; `painel-sessao.spec.js:6`). What they need is the 31-module graph linking, the Node-side imports of section 6.3, the helpers' `aw` and `win` that B and C change, and, for three tests of `painel-tv`, the app's redirect, `#usuario` and login form (section 7.4).
   - `painel-missoes` is the opposite case: it never opens `painel.html` and is an app test, with `abrir` in 11 of its 12 tests (10 call sites), so it does depend on `abrir` and on the `#wins` wait that B removes.
   - "painel-tv (32) and painel-sessao (13) run only on that page": three `painel-tv` tests also open the app (`:432`, `:460`, `:486`).
6. **No map** says that the TV's local mode reads its documents raw, with no migration (`js/painel.js:81-84`), that 15 of its 31 modules are never called on the real TV, or that the unit suite, not the painel specs, is what first fails on a stale name (section 6.4). mapa-banco (its line 355) already has that the fake's board is the app's `quadroDoDia` with no automated link to the SQL; section 6.5 adds what differs.
7. **`pedido.md:109`** ("Painel … their behaviour does not change") and **`pedido.md:120`** (the shared files: `index.html`, `css/app.css`, `js/eventos/registro.js`, `js/migracoes.js`) do not mention that the TV page links seven of the modules the redesign changes, nor `js/backends/local.js`, the file through which four of them reach it and which A and D both edit.

## Implications for the plan (suggestions)

Everything below is a suggestion.

1. **Tell each workstream its lines, instead of "keep the paths and exports".** (Cost: a table in the plan. Risk: none.)
   - **D (rename of `js/agenda.js`)**: one TV line, `js/backends/local.js:4`, and one line of the specs' Node side, `test/e2e/supabase-falso.js:10`; both for `prazoDaAgendaPermite`, which the local `registrarSolicitacao` and the fake call (`js/backends/local.js:165`; `test/e2e/supabase-falso.js:390`). The other ten exports are free. Renaming `js/views/agenda.js` and `js/eventos/agenda.js` does not touch the TV (they are not among the 31).
   - **F3 (habilitações and frota)**: the registry itself is free (`HABILITACOES`, `exigencias`, `podeFazer`, `nomeDaHabilitacao`, `normalizarHabilitacoes`, `habilitacaoDoAviao`, `ATRIBUTOS_DO_RECURSO`…). Linked: `habilitacoesDoNivel` and `marcasDoChecadorAntigo` (helpers of format steps 6 and 20, `js/migracoes.js:6`), `FROTA_INICIAL` (`js/migracoes.js:7`), `exigenciasDoAviao`, `PREFIXO_DA_HABILITACAO_DO_AVIAO` and `MATRICULA` (`js/habilitacoes.js:7`), `MATRICULA` (`js/escala-gravada.js:10`, `js/fixos.js:7`). Only `MATRICULA` runs, and it must keep accepting every `r` already stored (section 6.5).
   - **B and C (`js/horarios.js`, `js/migracoes.js`)**: nine names of `js/horarios.js`, held by `js/rules.js:5`, `js/agenda.js:5`, `js/fixos.js:9`, `js/migracoes.js:8`; of `js/migracoes.js` only `FORMATO_DOS_CURSOS` (`js/programa.js:12`). `ESQUEMA`, `migrarDia`, `migrarCadastro` and new steps are free for the TV; a new step's imports join its graph (section 7.2), and its data only matter if they touch the fields of section 7.3. If the window constants of `js/config.js` go, `js/horarios.js:10-13`, `:40` and `js/rules.js:12` must still evaluate at load, and `js/escala-gravada.js:32` must still accept the `w` the engine writes (`js/engine.js:388`).
   - **I (deletions)**: anything in section 4 can go; a name of section 3 goes together with its import line, which the app needs updated anyway. A module file of the 31 can be deleted or moved only with its importer lines; the lint catches a path left behind, nothing static catches a name (section 6.4).
2. **Make the lint refuse an imported name its target does not export.** `scripts/exportacoes-sem-uso.mjs` already parses every file and has both lists (`exportacoes`, `:52-63`; the imports, `:98-107`). Cost: about ten lines there. Risk: low; `js/`, `test/` and `scripts/` have no re-export, no namespace import of an app module and no default export today, the three forms that would need care. It would catch a stale name in `js/painel.js:13-21` without a browser, and before the unit suite.
3. **Or pin the TV's graph in a unit test**: walk the imports from `js/painel.js` with espree (a devDependency, `package.json:22`) and compare the module list with an explicit list of 31. Cost: one small test file. Risk: the list has to be edited whenever the graph changes, which is the purpose: a workstream that adds a module to the reception TV sees it in its own diff.
4. **Shrink the TV's graph in the foundation, before the parallel work**, so D, F3, B, C and I mostly stop reaching it. Three independent cuts, with what run 3 measured:
   - (a) Move the deadline rule (`js/agenda.js:13-50`: `FUSO_DO_AEROCLUBE`, `hojeEmSaoPaulo`, `ehDomingo`, `prazoDaData`, `prazoDaAgendaPermite`, `primeiraDataAberta`; it needs only `somarDias`, `js/agenda.js:34`, `:47-48`) to a module of its own. The TV drops `js/agenda.js`, `js/fixos.js`, `js/progresso.js`; 17 link names remain. Cost: one file and eleven import lines (`js/backends/local.js:4`, `test/e2e/supabase-falso.js:10`, `js/views/agenda.js:12`, `js/views/conta.js:6`, `js/views/cursos.js:18`, `js/agendamento.js:40`, `js/main.js:32`, `js/eventos/topo.js:4`, `js/eventos/agenda.js:3`, `scripts/semear-dias-previa.mjs:16`, `test/unit/agenda.test.js:4`). Risk: low; it is the part of `js/agenda.js` the request keeps (`pedido.md:29`), so D would split it anyway.
   - (b) Move `FORMATO_DOS_CURSOS` out of `js/migracoes.js` to a module both sides already import (`js/cursos.js`: `js/programa.js:9`, `js/migracoes.js:11`). The TV drops `js/migracoes.js` and `js/habilitacoes.js`; with (a), 26 modules and 8 names. Cost: the constant, `js/programa.js:12`, `js/migracoes.js:18` and `:222`, nine test import lines (or one re-export in `js/migracoes.js`, which the lint accepts: `scripts/exportacoes-sem-uso.mjs:55`, `:102-103`) and `README.md:169-172`, which names `js/migracoes.js` as the one place of that number. Risk: low.
   - (c) Give the TV a reader of its own for the two local documents, shared with `backendLocal.ler` (the keys and `chaveLocal`, `js/backends/local.js:13-30`, `:86-93`), so `js/painel.js:15` stops importing the whole local backend. The TV drops ten modules (21 left); 7 names remain: `isGroundMission` (`js/quadro.js:9`), `MATRICULA` (`js/escala-gravada.js:10`), `duracaoValida` (`js/cursos.js:6`) and the four of `js/rules.js:5`. Cost: one small file, about ten lines in `js/backends/local.js`, three in `js/painel.js`. Risk: low; the 20 local-mode tests of `painel-tv.spec.js` and the 23 of `test/unit/backend-local.test.js` cover it.
   - (d) To take the last three out as well, `isGroundMission` would move next to `MIS` and `MATRICULA` and `codigoValido` to leaf modules (17 modules, none of the seven). Cost: higher, import lines in many modules of the app (`isGroundMission` has 10 importer files). Risk: churn next to the engine, import lines only; I would not do it for the TV alone.
5. **Name `js/backends/local.js`, `js/backends/supabase.js` and `test/e2e/supabase-falso.js` among the files with one owner per step** (`pedido.md:120` has four). A and D both edit them, and the first is the TV's door to four of the seven modules. Cost: three lines in the plan's ownership table. Risk: A and D wait on each other for those files unless the order says who goes first.
6. **Decide in C's first commit what the engine does with instructors that still have only `aw`.** The helpers feed the engine raw (section 7.5): either the engine accepts both shapes or the helpers change in that commit; otherwise every instructor of the painel fixtures is unavailable and the boards come out empty (inferred). Cost: a fallback in `js/viabilidade.js` or three helper lines (`test/helpers/montar.js:7`, `estado.js:29`, `exemplo.js:24`). Risk: a fallback kept for the tests is a second meaning of availability in the engine; changing the helpers changes the input of every test that uses them, in the commit whose goldens must not change (`pedido.md:66`).
7. **Run the TV tests as a named check of every step that touches one of the 31 modules** (`npx playwright test painel-tv painel-sessao painel-meteorologia seguranca`: 65 tests, 58 of them on the TV page; they are in `npm test` already) and open `…/painel.html` once on the published site after such a merge, since a TV that fails at its 03:00 reload does not recover by itself (section 7.6). Cost: a line in each step's checklist. Risk: none. A watchdog on the page would remove that risk, at the cost of a change to the TV's behaviour, which the request says does not change, and of a second script the page must load.
8. **Keep in F1** the app's redirect of the TV account and the shared login ids (section 7.4): three tests of `painel-tv.spec.js` pass through the app's shell. Cost: none if `#usuario` and the login form keep their ids; otherwise those three tests and `preencherLogin` change with the shell. Risk: the redirect lives in the bootstrap (`js/sessao.js:139-147`) that F1 reorganises.

<!-- fim -->
