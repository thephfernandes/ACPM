# Mapa: Recursos — the fleet, take-off times, Janelas de operação, the hangar and the habilitações registry

Read at worktree `/Users/pedrofernandes/ACPM/.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to it.
Words: *resource* = one item of `cadastro.frota` (aircraft or simulator); *reg* = its matrícula; *type* = `tipo` (5 values); *category* = the grouping of the filters (4, plus Sala Ground); *roster* = the `cadastro` document (all dates); *day* = the document `dia:<AAAA-MM-DD>` (one date).
Profiles: **Op/Adm** = Operador and Administrador (in local mode, `#role-sel` on Operador); **Gestor** = read-only; **all** = everyone who sees the tab (Op/Adm and Gestor). The Secretaria has no Recursos tab (`css/app.css:184-186` hides every `#nav` button except `age`, `esc`, `ins`, `alu`, `cur`); the TV profile only sees `painel.html`.
The area's 10 unit files pass at this commit (121 tests, `node --test`).

## 1. What exists

| File (lines) | What it is |
|---|---|
| `index.html:149-211` | `<section id="s-rec" data-vista="dia">`: toolbar, the view "Disponibilidade do dia" (`.vista-dia`) and the view "Cadastro" (`.vista-cadastro`). Tab button and badge at `index.html:96`. |
| `js/views/recursos.js` (176) | Draws the tab: `rRec` (windows + hangar + filtered parts), `rRevisao` (aircraft table), `rFrota` (private; the Frota list with the attribute editor), `rHangar`, `contarRecursos`, `aplicarFiltrosDosRecursos`, `alternarGrupoDaFrota`, `alternarAtributos`. |
| `js/eventos/recursos.js` (226) | Every handler of the tab: "+ Novo recurso" form, attributes, filters, `win`, `av`, `horas`, "Retirar", hangar moves, "Revisão feita", the take-off times editor (`salvarHorarios`). |
| `js/views/horarios.js` (206) | The take-off times summary and the inline editor with its draft (`rascunho`). |
| `js/horarios.js` (167) | Pure. Lists per category (`HORARIOS_INICIAIS`, `normalizarHorarios`, `horariosDoTipo`, `horariosDaMissao`), `periodoDoMinuto`, preferences (`ajustarPreferencias`, `preferenciasPadrao`, `ordenarPelaPreferencia`), `fimDaMissao`, `fimDasMissoesDoDia`, summary (`modeloDosHorarios`, `descreverHorarios`, `porPeriodo`), effect preview (`impactoDosHorarios`, `resumoDoImpacto`). |
| `js/frota.js` (88) | Pure. The resource record: `TIPOS_DA_FROTA`, `FROTA_INICIAL`, `ATRIBUTOS_DO_RECURSO`, `aviaoServe` / `motivoDoAviao`, `habilitacaoDoAviao`, `exigenciasDoAviao`, `instrutorVoaNoAviao`, `matriculasParaOVoo`, `matriculasDoTipo`, `MATRICULA`, `normalizarFrota`, `recursoDaFrota`, `novoRecurso`. |
| `js/categorias.js` (23) | `CATEGORIAS` (C152, C172, `sim` "Simulador", PA-34, `ground` "Sala Ground"), `categoriaDoTipo`, `nomeDoRecurso`, `opcoesDeCategoria` (Escala and BI selects). |
| `js/hangar.js` (26) | Pure. `normalizarHangar`, `posicaoNoHangar`, `moverNoHangar`. |
| `js/views/filtros-dos-recursos.js` (59) | Filter state of the tab (search + categories), `recursoAVista`, `horariosAVista`, `criarFiltroDasCategorias` (on `js/views/filtro-multiplo.js`). |
| `js/config.js` (128) | Constants: `WIN`/`T`/`NI`/`DAY`/`PRE` (the nine periods), `EQ` (initial fleet), `MIS`, `REVISAO_H = 50`, `MENOR_VOO_H = 1`, `DEFAULT_LIM`, `COMBUSTIVEL`, `SO_VFR_INICIAL`, `HABILITACAO_PROPRIA_INICIAL`. |
| `js/habilitacoes.js` (126) | Pure. The registry `HABILITACOES` (21 ids), `exigencias`, `podeFazer`, `descreverExigencias`, `nomeDaHabilitacao`, `normalizarHabilitacoes`, cheque marks, level migration. |
| `js/combustivel.js` (35) | Pure. Weight against the type's limit and fuel reduction (`pesoECombustivel`, `reducaoNecessaria`, `combustivelDoVoo`). Type-level only; nothing per resource. |
| `js/viabilidade.js` (71) | Pure. Resource side: `livre`, `cabeNoSaldo`, `saldoAteARevisao`, `folgaAte`. Instructor side: `cobre`, `problemasDoInstrutor` (where the per-aircraft habilitação is checked). There is **no** "resource available" function here: `av` is read directly by each caller (§5.5). |
| `js/candidatos.js` (119) | Pure. `ocupacaoDaEscala`, `problemaDoRecurso` (maintenance, occupied, 50 h), `avioesQueServem` (ordered by gap, then hangar), `instrutoresQueServem`. Used by Sugestões and by the booking dialog. |
| Plumbing read for this map | `js/dias.js` (`separar`, `juntar`, `diaPadrao`, `diaParaCopiar`, `horasDoDiaSeguinte`), `js/storage.js` (`normalizeAndMigrateState`, `carregarDia`, `salvarDia`), `js/migracoes.js` (steps 5, 7, 11, 12, 14, 23), `js/actions.js` (`gravarAlteracao`, `refazerEscala`), `js/reversoes.js` + `js/eventos/historico.js` (reverts), `js/engine.js` (all), `js/compactar.js:60-215`, `js/reparo.js`, `js/agendamento.js:85-135, 505-545`, `js/views/selos.js`, `js/views/vistas.js`, `js/eventos/registro.js`, `js/eventos/navegacao.js`, `js/somente-leitura.js`, `js/views/cadastros.js` + `js/eventos/cadastros.js` (habilitações panel and filter), `js/planilha.js:1-215`, `js/csv.js`, `js/export.js`, `js/views/bi.js`, `js/manual.js`, `js/glossario.js`. |

State of the screens today, in one paragraph: Recursos has **no modal and no drawer**. Everything is inline: the "+ Novo recurso" form (`#form-recurso`), the attribute checkboxes (a `fieldset` inside the open `li.frota-item`), the take-off times editor (inside its `div.horarios-cat`). The tab mixes three scopes: per-date things for the whole school (Janelas de operação, Ordem no hangar), per-date things per resource (Disponível, Horas disponíveis), and all-dates things (the Frota with attributes, and the take-off times, which are **per category**, not per resource).

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

### 2.1 The resource record (roster: `cadastro.frota[]`, all dates)

| Field | Shape and rule | Evidence | Written by |
|---|---|---|---|
| `reg` | Matrícula, the identity. `MATRICULA = /^[A-Z0-9][A-Z0-9-]{1,14}$/`, upper-cased, unique in the fleet. No rename exists. | `js/frota.js:60, 65-71, 81-88` | "+ Novo recurso" (`js/eventos/recursos.js:56-70`); removed by "Retirar" (`:149-159`); restored by the History revert `readicionarRecurso` (`js/eventos/historico.js:107-112`). |
| `tipo` | One of `TIPOS_DA_FROTA = ['C152','C172','PA-34','Sim. Mono','Sim. Multi']`. Never edited after creation. | `js/frota.js:11` | "+ Novo recurso". |
| `soParafuso` | `true` or absent. Valid only for `C152`. UI label "Só Parafuso". | `js/frota.js:23-28, 44` | Form checkbox `#rec-parafuso`; attribute editor (`js/eventos/recursos.js:75-90`); revert `setAtributo`. |
| `soVfr` | `true` or absent. Valid for `C172`, `PA-34`. UI label "Só VFR". | `js/frota.js:25, 45` | Attribute editor; revert `setAtributo`; data-format step 23 (PR-CPL). |
| `habilitacaoPropria` | `true` or absent. Valid for all 5 types. UI label "Habilitação própria". | `js/frota.js:26, 52` | Attribute editor; revert `setAtributo`; step 23 (PR-VOM). |

- The record has nothing else: no display name, no notes, no numeric id, no active flag. `normalizarFrota` rebuilds each item with **only** `reg`, `tipo` and the known attributes that are exactly `true` and valid for the type; any other field is dropped on load (`js/frota.js:62, 65-71`; pinned by `test/unit/atributos.test.js:55-62`).
- Initial fleet (`FROTA_INICIAL`, `js/frota.js:14-18`, from `EQ` in `js/config.js:11-17`): 26 resources = 13 C152 + 6 C172 + 3 PA-34 + 2 Sim. Mono + 2 Sim. Multi; PR-JPL `soParafuso`, PR-CPL `soVfr`, PR-VOM `habilitacaoPropria` (`js/config.js:27-31`; `test/unit/frota.test.js:19-26`).
- The Sala Ground is not a resource of the fleet: one room, code `SALA-GROUND`, always available (`js/frota.js:1-3`, `js/config.js:19-20`, `js/candidatos.js:57`).

### 2.2 Roster-level data that is by category or by type, not by resource (all dates)

| Data | Where | Shape | Written by |
|---|---|---|---|
| Take-off times | `cadastro.horarios` | `{ C152: [min…], C172: […], sim: […], 'PA-34': […] }` (`CATEGORIAS_COM_HORARIOS`, `js/horarios.js:13-14`). Minutes 06:00–17:00 accepted in storage, sorted, unique; an empty or missing list falls back to the initial one (`js/horarios.js:17-29`). Defaults: the 8 day windows; PA-34 every 30 min 06:30–16:30 (21 times) (`js/horarios.js:10-13`). | Take-off times editor "Salvar" (`js/eventos/recursos.js:192-216`); revert `restaurarHorarios` (`js/eventos/historico.js:96-106`); step 12 seeds it (`js/migracoes.js:97-106`). |
| Weight limit | code | `DEFAULT_LIM = { C152: 170, C172: 222, 'PA-34': 250 }` (`js/config.js:96`) | nobody (constant). Shown only in the Manual (`#manual-pesos`, `js/views/manual.js:13`). |
| Tank and endurance | code | `COMBUSTIVEL` (`js/config.js:100`) | constant. |
| 50 h control applies | code | only `AIRCRAFT_EQ_TYPES = ['C152','C172','PA-34']` (`js/config.js:25`; input drawn only for aircraft, `js/views/recursos.js:60, 67`) | constant. |
| Type habilitação | code | `DO_AVIAO = { C152: 'c152', C172: 'c172', 'PA-34': 'mlte' }`, `DO_SIMULADOR = { 'Sim. Mono': 'sim_mono', 'Sim. Multi': 'sim_multi' }`, both **not exported** (`js/habilitacoes.js:62, 82`) | constant. |
| Instructors' habilitações | `cadastro.ins[].hab` | array of registry ids plus `aviao:<reg>` ids (`js/dias.js:41-42`; normalised by `normalizarHabilitacoes`, `js/storage.js:159`) | "Editar habilitações" panel (`js/eventos/cadastros.js:157-160`). |

### 2.3 Per date (the day document; `separar`/`juntar`, `js/dias.js:36-112`)

| Field | Shape | Meaning | Written by | History / undo |
|---|---|---|---|---|
| `av` | `{ <reg>: boolean }` | "Disponível" on that date; `false` = "Em manutenção". A resource the day does not know starts `true` (`js/dias.js:25, 90`; `js/storage.js:113-114`). | Switch `data-a="av"` (`js/eventos/recursos.js:122-129`); "+ Novo recurso" sets `true` (`:62`); reverts `setAv`, `readicionarRecurso`. | "PR-BTB: Manutenção" / "PR-BTB: Disponível", with "↶ Reverter" (`setAv`). |
| `horas` | `{ <reg>: number }` | Hours flown **since the last 50 h inspection, at the start of the date**; absent = no control. Stored 0–60 accepted (`js/storage.js:82-83`); the screen shows and takes `50 − horas` ("Horas disponíveis"). | Input `data-a="horas"` (`js/eventos/recursos.js:131-145`); "Revisão feita" sets `0` (`:171-176`). | "PP-LJV: 2 h disponíveis até a revisão de 50 horas"; "…: horas disponíveis não informadas"; "…: revisão de 50 horas feita (50 h disponíveis)". **No revert.** |
| `hangar` | `[<reg>…]` | Aircraft only (no simulators), front to back. Normalised: only fleet aircraft, no repeats, missing ones appended in fleet order (`js/hangar.js:9-13`). | Buttons `hangar-subir/descer/frente` (`js/eventos/recursos.js:162-168`). | "Hangar: PR-VOB passou para 1º". **No revert.** |
| `win` | 9 booleans | Janelas de operação, one per `WIN` entry `['06:30','08:20','10:10','11:30','12:40','13:40','14:30','16:20','17:30']` (`js/config.js:4`). Not per resource. | Switch `data-a="win"` (`js/eventos/recursos.js:115-120`). | "Janela 11:30 inativa" / "… ativa". **No revert.** |

Other day fields exist (`ins`, `pedidos`, `fStatus`, `fObs`, `filas`, `fixos`, `aprovacao`, `criterios`, `importadas`); the full key list is pinned in `test/unit/dias.test.js:31, 164`.

### 2.4 Derived per date (engine output, saved in `dia.resultado`)

- `RES.revisao[<reg>] = { inicio, voadas, fim, paraAs }` for every fleet aircraft with informed hours (`js/engine.js:1010-1030`): `inicio = horas[reg]`, `voadas` = scheduled hours of its non-cancelled flights, `fim = inicio + voadas`, `paraAs` = minute where it stops (`null` when it does not) when `av !== false` and `50 − fim < 1`.
- Warning `{ t:'warn', codigo:'revisao' }` "Aeronave parou para revisão de 50 horas às HH:MM (X h desde a última revisão)." or "…: sem saldo para voar hoje (…)" (`js/engine.js:1021-1028`).
- The flights of the day by `o.r`; the pins `fixos[fKey].r`; the D+1 Noturno return `noturnosDaVespera[].r`.

### 2.5 How a new date gets the per-date fields

1. `carregarDia(data)` reads the roster and `dia:<data>`; with no stored day it reads `backend.diaAnterior(data)`, the **latest stored date before it** (not necessarily D−1; `js/backends/local.js:120-123`, `js/backends/supabase.js:135-141`) and builds `diaParaCopiar(anterior)` (`js/storage.js:182-191`).
2. `diaParaCopiar` (`js/dias.js:118-123`) copies `win`, `av`, `ins` (on/aw), `hangar`, `criterios`; sets `horas = horasDoDiaSeguinte(anterior)`; rotates `filas`; blanks `pedidos`, `fStatus`, `fObs`, `fixos`, `aprovacao`, `importadas`. A previous day without `ins` or `pedidos` (imported from the BI) gives `diaPadrao()`.
3. `horasDoDiaSeguinte` (`js/dias.js:127-137`): previous `horas[reg]` plus `o.h` of every line of the previous day's **saved** `resultado.out` on that reg, only for `AIRCRAFT_EQ_TYPES`, only for regs that already have hours, skipping `Cancelado`. Scheduled hours, not flown hours.
4. With no earlier stored day: `diaPadrao()` (`js/dias.js:34`): all windows open, every resource available, `horas: {}` (no control), hangar in fleet order.
5. Nothing is saved when a date is opened; the copied day is written with the first change (`novo: !dia`, `js/storage.js:212`; `escalaSoCalculada`, `js/actions.js:197-202, 310`).
6. Consequence: the copy happens **once**. A date that is already stored keeps its own `av`, `horas`, `hangar`, `win`; a later change on an earlier date does not reach it.

Tests: `test/unit/dias.test.js:156` ("copia do dia anterior a disponibilidade…"), `:250`, `:256`, `:262`, `:120`; `test/unit/storage-dias.test.js:111`, `:271`; e2e `test/e2e/revisao.spec.js:44` ("a nova data começa com as horas disponíveis do dia anterior menos os voos dele"), `test/e2e/hangar.spec.js:9` (last step), `test/e2e/datas.spec.js:58-111`.

### 2.6 Where the matrícula is the key (no other id exists)

`cadastro.frota[].reg`; keys of `dia.av` and `dia.horas`; items of `dia.hangar`; `dia.fixos[*].r`; `dia.resultado.out[*].r` and keys of `dia.resultado.revisao`; `noturnosDaVespera[].r` (`js/noturno.js:23-29`); `cadastro.ins[].hab` entries `aviao:<reg>`; History revert payloads (`reg`, `recurso.reg`); the BI aggregates by `o.r` (`js/views/bi.js:38-41`); the Excel template columns (`BLOCOS[].modelo`, `js/planilha.js:40-62`). Precedent for renaming a key: step 5 renamed the simulators in `dia.av` and `resultado.out[].r` (`js/migracoes.js:37-54`).

### 2.7 View-only state (module memory, lost on reload)

| State | Where | Meaning |
|---|---|---|
| `escolhidas.rec` | `js/views/vistas.js:14-16` | The view of the tab (`dia` or `cadastro`); default `dia` for every profile (`:12`). |
| `filtros = { matricula, categorias }`, `mantidos = { recursos, horarios }` | `js/views/filtros-dos-recursos.js:13-14` | Search text and ticked categories; the just-added resource and the just-edited category stay visible until the filters change. |
| `recolhidos` (Set) | `js/views/recursos.js:27` | Collapsed category groups of the day table. |
| `atributosAbertos` | `js/views/recursos.js:99` | The one resource whose attribute checkboxes are open. |
| `rascunho` | `js/views/horarios.js:31` | The one open take-off times draft `{ cat, lista, base, erro, erroDoCampo }`. |

### 2.8 Server

The server stores the roster and each day as opaque JSON with optimistic locking (`salvar_documento`, `salvar_dia`, version read vs version stored; `supabase/migrations/20261110213600_formato_nao_regride.sql`; `js/backends/supabase.js:53-63`). No SQL reads `win`, `av`, `horas`, `hangar`, `frota`, `horarios` or the attributes (grep over `supabase/`: no match). Only `perfil_atual() = 'operador'` (the Administrador counts as operador) may write; operador, gestor and secretaria read (`supabase/migrations/20261113140000_leitura_por_perfil.sql:14-36`). A new data-format number needs no migration (the guard reads `esquema` generically).

### 2.9 What the engine reads about resources (the shape any new input must keep)

| Input | Read at | Absent |
|---|---|---|
| `state.win` (9 booleans) | `js/engine.js:446, 601, 811` | **throws** (`TypeError`; checked with `node` on a state without `win`) |
| `state.av` (`{ reg: boolean }`) | `js/engine.js:101, 437, 842, 929-936, 1018` | **throws** |
| `state.frota` | `js/engine.js:261` | falls back to `FROTA_INICIAL` |
| `state.horarios` | `js/engine.js:273` | falls back to `HORARIOS_INICIAIS` |
| `state.hangar` | `js/engine.js:275` | fleet order (`normalizarHangar`) |
| `state.horas` | `js/engine.js:349` | no 50 h control |
| `state.ins[].hab` | through `podeFazer` and `instrutorVoaNoAviao` (§5.3) | no habilitação |
| `state.fixos[fKey].r`, `state.noturnosDaVespera[].r` | `js/engine.js:412, 370-393` | no pins, no return legs |

## 3. Controls inventory

Toolbar `#s-rec > .bar` (`index.html:151-163`); title `<h2>Recursos</h2>`.

| Label | Element (id, data-act, data-f, class) | Handler (function, file:line) | State read and written | Profiles |
|---|---|---|---|---|
| "Disponibilidade do dia" | `button[data-vista-rec="dia"]` in `.seg[role=group][aria-label="O que ver"]`, with `span.aba-selo#selo-rec-dia` inside (`index.html:153`) | `vistaDoBotao` + `mostrarVista` (`js/eventos/navegacao.js:52-53`; `js/views/vistas.js:19-39`) | writes `escolhidas.rec`, `#s-rec[data-vista]`, `aria-pressed`; CSS shows one part (`css/app.css:847`) | all (no `data-act`) |
| "Cadastro" | `button[data-vista-rec="cadastro"]` (`index.html:154`) | same | same | all |
| "Buscar matrícula…" | `input#flt-rec-mat.flt-ctrl[type=search]` (`index.html:157`) | `input` listener (`js/eventos/recursos.js:97-101`) → `filtrarRecursos({ matricula })`, `aplicarFiltrosDosRecursos({ esperar: 500 })` | `filtros.matricula`; clears `mantidos`; key = `chaveDeBusca` without spaces and hyphens (`js/views/filtros-dos-recursos.js:16-20`) | all |
| "Todas as categorias" / "Categoria: Simulador ou PA-34" | `button#flt-rec-cat.btn.sec.filtro-botao.flt-ctrl[aria-controls="flt-rec-cat-painel"]`; panel `#flt-rec-cat-painel[role=group][aria-label="Filtrar por categoria"]` with `input.flt-ctrl[type=checkbox][data-filtro="flt-rec-cat"][data-valor]` (values `C152`, `C172`, `sim`, `PA-34`), `button#flt-rec-cat-limpar[data-limpar-filtro="flt-rec-cat"]` "Limpar", rule "Mostra os recursos de alguma das categorias marcadas." with `?` `data-dica="filtro-das-categorias"` (`index.html:159-160`) | `criarFiltroDasCategorias` (`js/views/filtros-dos-recursos.js:51-59`) on `criarFiltroMultiplo` (`js/views/filtro-multiplo.js:29-117`); callback `js/eventos/recursos.js:102-105` | component's ticks; `filtros.categorias`; rule "alguma" (OR) | all |
| "26 recursos" / "3 de 26 recursos" | `span#rec-contagem.contagem[role=status]` (`index.html:161`) | `contarRecursos` (`js/views/recursos.js:122-134`) | reads `S.frota`, filters | display |
| "+ Novo recurso" | `button#btn-novo-recurso.btn.edit-only[aria-expanded][aria-controls="form-recurso"]` (`index.html:162`) | `onclick` (`js/eventos/recursos.js:42-47`) → `mostrarVista('rec','cadastro')`, `mostrarFormDoRecurso` (`:32-41`) | opens Cadastro; toggles `#form-recurso[hidden]`; focus to `#rec-reg` | Op/Adm (`.edit-only`, `css/app.css:235`) |
| "Limpar filtros" | `button#limpar-filtros-revisao[data-limpar-recursos]` (empty day table) and `button#limpar-filtros-frota[data-limpar-recursos]` (empty Frota) (`js/views/recursos.js:75-77, 90-91, 116-117`) | document `click` (`js/eventos/recursos.js:106-113`) | clears search and ticks, focus to `#flt-rec-mat` | all |
| badge on the tab | `span.aba-selo#selo-rec` in `button[data-t="rec"]` (`index.html:96`) | `atualizarSelosDaEscala` (`js/views/selos.js:20-33`) | reads `RES.revisao`, `S.av` | display |

View "Disponibilidade do dia": `div.rec-parte.vista-dia[data-parte="data"]` (`index.html:164-188`), heading "Nesta data" + "valem para a data aberta no topo; a data seguinte começa com eles".

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| "Janelas de operação": nine switches "06:30 1º" … "16:20 8º", "17:30 noturno" | `div.janelas#wins > label.janela[.off] > input.sw[type=checkbox][data-a="win"][data-i="0..8"]` (`index.html:167-168`; `js/views/recursos.js:146`) | `aoMudarCampo('win')` (`js/eventos/recursos.js:115-120`) | writes `S.win[i]`; `gravarAlteracao` 'inc'/'exc' "Janela HH:MM ativa/inativa"; `rRec()` | Op/Adm |
| table head "Disponível · Recurso · Horas disponíveis (?) · Na escala do dia · (Revisão)" | `div.tw#eqs > table.frota > thead`; `?` = `button.dica-btn[data-dica="horas-disponiveis"]`; last `th.edit-only[aria-label="Revisão"]` (`index.html:174-177`) | `js/dicas.js` | glossary | all |
| group row "C152 12 de 13 disponíveis" (groups C152, C172, PA-34, Simuladores) | `tr.grupo > td[colspan=5] > button.grupo-btn[data-recolher-grupo="C152 / C172 / PA-34 / sim"][aria-expanded]` (`js/views/recursos.js:18, 85-88`) | `alternarGrupoDaFrota` (`js/eventos/navegacao.js:49-50`; `js/views/recursos.js:28-35`) | `recolhidos` | all |
| "Disponível" switch | `tbody#revisao > tr[data-r][data-grupo][.manutencao] input.sw[type=checkbox][data-a="av"][data-id="<reg>"][aria-label="<reg> disponível"]` (`js/views/recursos.js:64-65`) | `aoMudarCampo('av')` (`js/eventos/recursos.js:122-129`) | writes `S.av[reg]`; History with revert `{ kind:'setAv', reg, val }`; `rRec()` | Op/Adm |
| "Recurso" cell | `<b>reg</b>`, type in `small.sm` for simulators, attribute tags `span.tag.fb[data-dica="so-parafuso / so-vfr / habilitacao-propria"]` (`js/views/recursos.js:66, 95-97`) | tooltip | reads `S.frota` | display |
| "Horas disponíveis" | `span.horas-disp > input.horas[type=number][min=0][max=50][step=0.1][inputmode=decimal][data-a="horas"][data-horas="<reg>"][placeholder="—"][aria-label="Horas disponíveis do <reg> até a revisão"]` + `span.barra[.wa / .er]` (aircraft only; `js/views/recursos.js:50-56, 67`) | `aoMudarCampo('horas')` (`js/eventos/recursos.js:131-145`) | writes `S.horas[reg] = round((50 − v)·10)/10`, or deletes it when empty; out of 0–50: toast "As horas disponíveis vão de 0 a 50." and no change | Op/Adm |
| "Na escala do dia" | text from `situacao()` (`js/views/recursos.js:37-44`): `span.tag` "Em manutenção"; `span.tag.er` "Parou para revisão de 50 horas às HH:MM" / "… (sem saldo hoje)"; "—"; "N h na escala · termina com X h disponíveis" | none | reads `S.av`, `RES.revisao`, `voosQueVoam()` | display |
| "Revisão feita" | `td.edit-only.acoes-frota > button.btn.quiet.rev[data-act="revisao"][data-id="<reg>"]` (aircraft only; `js/views/recursos.js:69`) | `aoAcionar('revisao')` (`js/eventos/recursos.js:171-176`), two clicks, armed text "Confirmar revisão" (`js/eventos/confirmacao.js:23-40`) | `S.horas[reg] = 0` | Op/Adm |
| "Ordem no hangar": rows "1º PR-VOB C152 [manutenção / 2 voos nesta data]" | `div.pn.rec-hangar > ol.fila.hangar#hangar > li[data-id="<reg>"]` with `span.pos`, `span.tag.fb` "manutenção" or `span.tag.grp` "N voo(s) nesta data" (`index.html:182-186`; `js/views/recursos.js:154-176`) | none | reads `S.hangar`, `S.frota`, `S.av`, `voosQueVoam()`; never filtered | display |
| hangar "Subir <reg>" / "Descer <reg>" / "Pôr <reg> na frente do hangar" (icon buttons, shown on hover or focus) | `span.acoes.edit-only > button.x[data-act="hangar-subir / hangar-descer / hangar-frente"][data-id="<reg>"][aria-label][title]`; `disabled` at the ends (`js/views/recursos.js:165-173`) | `aoAcionar([...])` (`js/eventos/recursos.js:162-168`) → `moverNoHangar` (`js/hangar.js:19-26`) | writes `S.hangar`; `rHangar()` | Op/Adm |

View "Cadastro": `div.rec-parte.vista-cadastro[data-parte="todas"]` (`index.html:189-210`), heading "Vale para todas as datas" + "muda também as datas já abertas".

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| form "Matrícula", "Categoria", "Só Parafuso", "Adicionar", "Cancelar" | `form#form-recurso.form-recurso.edit-only[hidden][novalidate]`: `input#rec-reg[maxlength=15][placeholder="PR-ABC"]`; `select#rec-tipo` (options "Escolha…", C152, C172, PA-34, Sim. Mono, Sim. Multi); `label#rec-parafuso-rotulo[hidden] > input#rec-parafuso` (shown only when the type is C152, `js/eventos/recursos.js:52-55`); `button[type=submit]`; `button#rec-cancelar`; error `p#rec-erro.erro-campo[role=alert]` with `aria-invalid` on the field (`index.html:193-202`; `js/eventos/recursos.js:22-26`) | `onsubmit` (`js/eventos/recursos.js:56-70`) → `novoRecurso` (`js/frota.js:81-88`) | `S.frota.push(recurso)`, `S.av[reg] = true`, `manterRecursoAVista`; History 'inc' "Recurso adicionado: PR-NEW (C152, só Parafuso)"; toast "<reg> adicionado à frota."; no revert | Op/Adm |
| "Frota": groups "C152 13 recursos" | `ul.frota-cadastro#frota[aria-label="Frota"] > li.grupo > h5` + `ul.frota-itens > li.frota-item[.aberto][data-r]` (`index.html:203`; `js/views/recursos.js:106-118`) | none | reads `S.frota`, filters | display |
| matrícula button | `button.frota-reg[data-act="atributos-recurso"][data-id][aria-expanded][aria-label="Atributos de <reg>"][title="Atributos (Só Parafuso, Só VFR, Habilitação própria)"]`; for the Gestor it is a plain `<b>` (`js/views/recursos.js:112`) | `aoAcionar('atributos-recurso')` → `alternarAtributos` (`js/eventos/recursos.js:74`; `js/views/recursos.js:99-100`) | `atributosAbertos` (one open at a time) | Op/Adm |
| attribute checkboxes "Só Parafuso", "Só VFR", "Habilitação própria" (only those valid for the type) | `fieldset.atributos-recurso > legend.sr + label.chk > input[type=checkbox][data-a="atributo"][data-r="<reg>"][data-atributo="soParafuso / soVfr / habilitacaoPropria"]` (`js/views/recursos.js:101-102`) | `aoMudarCampo('atributo')` → `marcarAtributo` (`js/eventos/recursos.js:75-90`) | sets `recurso[atributo] = true` or deletes it; History 'mod' "PR-HAR: Só VFR marcado/desmarcado" with revert `{ kind:'setAtributo', reg, atributo, val }`; redraws `rRec`, `rIns`, `rPainelDoInstrutor`, `rDem` | Op/Adm |
| "Retirar" | `button.btn.quiet.rev.ret.edit-only[data-act="retirar-recurso"][data-id][aria-label="Retirar <reg> da frota"]` (`js/views/recursos.js:113`) | `aoAcionar('retirar-recurso')` (`js/eventos/recursos.js:149-159`), two clicks, armed text "Confirmar retirada" | `S.frota` without the resource; History 'exc' "Recurso retirado: PT-KIW (PA-34)" with revert `{ kind:'readicionarRecurso', recurso, av }`; toast "<reg> retirado da frota."; redraws `rRec`, `rIns` | Op/Adm |
| "Horários de decolagem": one block per category (C152, C172, Simulador, PA-34) | `div.horarios#horarios > div.horarios-cat[.editando][data-cat="C152 / C172 / sim / PA-34"]`: `b.horarios-nome`, `span.horarios-modelo`, `small.horarios-qtd`, `div.horarios-periodo[data-periodo="manha / tarde"]` with `span.hr[.fechado][data-dica="horario-em-janela-fechada"]` (`index.html:205-209`; `js/views/horarios.js:45-71`) | `rHorarios` (`js/views/horarios.js:112-128`) | reads `S.horarios`, `S.win`, filters | display |
| "Editar" | `button.btn.quiet.edit-only[data-act="editar-horarios"][data-cat][aria-expanded][aria-label="Editar os horários do <categoria>"]` (`js/views/horarios.js:59-60`) | `abrirEditorDosHorarios` (`js/eventos/recursos.js:181`; `js/views/horarios.js:158-163`) | creates `rascunho` | Op/Adm |
| editor: "Modelo" radios "Janelas do dia", "De 30 em 30 min", "Personalizado"; chips with ✕; "Novo horário"; "Adicionar"; "Salvar"; "Cancelar" | `div.horarios-editor[role=group]`: `input[type=radio][name="hr-modelo"][value="janelas / de30 / personalizado"]`; `span.hr-chip > button[data-act="rascunho-tirar"][data-min][aria-label="Tirar HH:MM"]`; `input.hr-novo[type=time][step=300][min="06:00"][max="16:30"][aria-describedby="hr-dica hr-erro"]`; `button[data-act="rascunho-por"]`; `small#hr-dica`; `p#hr-erro.erro-campo[role=alert]`; `p.horarios-efeito[aria-live=polite]`; `button[data-act="salvar-horarios"]`; `button[data-act="cancelar-horarios"]` (`js/views/horarios.js:73-99`) | `escolherModelo` (document `change`, `js/eventos/recursos.js:219-221`); `tirarDoRascunho`, `porNoRascunho`, `fecharEditorDosHorarios`, `salvarHorarios` (`js/eventos/recursos.js:182-216`); Enter in `.hr-novo` adds (`:222-225`); Esc inside `#horarios` closes only the editor (`:226`, `fecharNoEsc`) | `rascunho`; on save `S.horarios[cat]` and the open date's requests | Op/Adm |

Gates that apply to every row above: a `data-act` click and a `data-a`/`data-f` change are refused for the Gestor and before the date's data is read (`js/eventos/registro.js:24, 41-46`; `aindaNaoAbriu`, `js/actions.js:154-158`); the Gestor's inputs are `disabled` except `.flt-ctrl` (`js/somente-leitura.js:5-21`); every write goes through `gravarAlteracao` (`js/actions.js:189-195`), which re-runs the engine and saves the roster (if it changed) and the open date's day (`js/storage.js:229-242`). The table and the hangar are redrawn on every recalculation (`refazerEscala`, `js/actions.js:370-380`).

## 4. Rules and the tests that pin them (file and test name)

| Rule | Code | Test |
|---|---|---|
| 26 initial resources; PR-JPL Só Parafuso, PR-CPL Só VFR, PR-VOM Habilitação própria | `js/frota.js:14-18` | `test/unit/frota.test.js` "começa com os 26 recursos…"; `test/unit/config.test.js` "frota com 26 recursos e o PR-JPL no C152" |
| Fleet normalisation: valid reg, known type, no repeats, attributes only where valid | `js/frota.js:62-71` | `frota.test.js` "normaliza: só recursos válidos…"; `test/unit/atributos.test.js` "os atributos ficam só nos tipos em que valem; um recurso novo pode vir com eles" |
| New resource: messages "Informe a matrícula.", "Matrícula inválida: use letras, números e hífen (por exemplo, PR-ABC).", "Escolha a categoria.", "Já existe um recurso com a matrícula X." | `js/frota.js:81-88` | `frota.test.js` "um recurso novo: matrícula única…"; e2e `test/e2e/cadastros.spec.js` "não aceita matrícula repetida nem sem categoria; "Só Parafuso" só no C152" |
| A resource unknown to a day starts available; `av` and `horas` only of fleet resources | `js/dias.js:90`; `js/storage.js:112-115` | `frota.test.js` "a frota fica no cadastro; um recurso novo começa disponível…", "estado inicial e normalização…" |
| Aircraft serves the flight: type; Parafuso on C152 only on Só Parafuso and it only flies Parafuso; IFR flight (also the PC Noturno) not on Só VFR | `js/frota.js:31-47` | `atributos.test.js` "o voo IFR não vai para o avião "Só VFR"…"; `test/unit/candidatos.test.js` "Só VFR: o voo IFR, e o noturno do PC…"; `test/unit/engine.rules.test.js` "Parafuso no C152 usa exclusivamente o PR-JPL", "Parafuso no C152 é rejeitado com o PR-JPL em manutenção" |
| Habilitação própria: the aircraft requires `aviao:<reg>` from the instructor; engine pairs instructor and aircraft; rejection code `habilitacao-do-aviao` | `js/frota.js:50-54`; `js/engine.js:826, 852-853, 961` | `atributos.test.js` "o recurso com habilitação própria exige do instrutor a dele", "o PR-VOM só com quem tem a habilitação dele…", "a divisão das horas, a compactação e a troca de matrículas não levam o voo para quem não voa no avião", "o voo fixo no avião que não serve mais, ou com o instrutor sem a habilitação dele, fica em conflito"; `candidatos.test.js` "habilitação própria: o avião que a exige só serve com o instrutor que a tem…"; e2e `test/e2e/atributos.spec.js` (the first two of its 3 tests); invariants `test/unit/engine.invariants.test.js:98, 112` |
| Format 23 marks PR-CPL and PR-VOM once; what is already set stays | `js/migracoes.js:183-197` | `atributos.test.js` "formato 23: o PR-CPL fica "Só VFR"…" |
| Attribute revert only in the app's own shape | `js/reversoes.js:59-63` | `atributos.test.js` "a reversão de um atributo vale só no formato do app"; `test/unit/reversoes.test.js` "o atributo é o nome de um atributo, em texto…" |
| Registry: level migration, non-cumulative, C152 needs `c152`, TGL, the three cheque marks | `js/habilitacoes.js:10-125` | `test/unit/habilitacoes.test.js` (9 tests); `engine.rules.test.js` "Habilitações exigidas…" block |
| `aviao:<reg>` is a valid habilitação, sorted after the registry ones | `js/habilitacoes.js:37-45` | `atributos.test.js` "a habilitação própria de um recurso é uma habilitação válida, depois das da grade"; `test/unit/filtro-multiplo.test.js` "a habilitação própria do recurso (aviao:PR-VOM) é uma marca como as outras" |
| Take-off times: defaults, normalisation, per type, period of a minute, default preferences, adjusting preferences, model, description, effect | `js/horarios.js` | `test/unit/horarios.test.js` (30 tests), e.g. "padrão: as 8 janelas do dia; o PA-34, de 30 em 30 minutos…", "a lista da categoria manda…", "o efeito nos pedidos da categoria…", "no editor, os horários vão das 06:00 às 16:30…" |
| A closed window closes the category's times that fall in it; pins there conflict `horario-fechado` | `js/engine.js:446, 601, 811` | `horarios.test.js` "a janela de operação fechada fecha os horários da categoria que caem nela"; `engine.rules.test.js` "não usa janelas de operação desativadas", "é rejeitado com a janela noturna desativada", "sem nenhum período do dia aberto, não há horário para a aula"; `test/unit/fixos.test.js` "o período fechado nesta data e fora da disponibilidade do aluno"; `test/unit/reparo.test.js` "o horário fechado nesta data: um horário mais tarde…"; `test/unit/agendamento.test.js:58, 611`; invariant `engine.invariants.test.js:135` |
| Hangar: normalise, move; engine takes the front one, joins flights on aircraft already out, skips maintenance | `js/hangar.js`; `js/engine.js:101, 275-276, 868-869` | `test/unit/hangar.test.js` (7 tests); `candidatos.test.js` "os que servem primeiro: um que já saiu, com a menor folga, e depois o da frente do hangar"; `reparo.test.js` "avião em manutenção: outro avião do mesmo tipo…"; e2e `test/e2e/hangar.spec.js` (2 tests) |
| 50 h: balance, whole flight must fit, stop warning, next date starts with hours plus flights | `js/viabilidade.js:20-23`; `js/engine.js:349-350, 844, 1010-1030`; `js/dias.js:127-137` | `test/unit/viabilidade.test.js` "o voo cabe no saldo…", "o saldo até a revisão…"; `engine.rules.test.js` "Revisão de 50 horas" (4 tests); `engine.invariants.test.js` "nenhum avião passa das 50 horas…"; `dias.test.js:250-262`; e2e `test/e2e/revisao.spec.js` (3 tests); `test/unit/csv.test.js` "observações: avião que para para a revisão…"; `test/unit/planilha.test.js` "indisponível em vermelho…; REVISÃO nas linhas livres…" |
| Badge: aircraft stopped or under 5 h, not counting those in maintenance; twin on the view button | `js/views/selos.js:26-31` | e2e `test/e2e/selos.spec.js` "Recursos: aviões parados ou com menos de 5 h…" |
| Two views, toolbar, hangar beside the table at 1,100 px | `index.html:149-211`; `css/app.css:802-808` | e2e `cadastros.spec.js` "Recursos em duas vistas…", "a ordem no hangar fica ao lado da tabela a partir de 1.100 px…" |
| Filters apply to table, Frota and take-off times, never to the hangar; kept across redraws | `js/views/filtros-dos-recursos.js` | e2e `cadastros.spec.js` "as categorias (uma ou outra) e a busca valem…", "o filtro das categorias: a regra, o foco…", "o recurso acrescentado e os horários editados continuam à vista…"; `hangar.spec.js` "os filtros de Recursos não valem no hangar…"; `test/e2e/perfis.spec.js:124` (Gestor) |
| Take-off times editor: draft, Enter, effect, Save, History undo; models; Cancel; last time kept; Esc closes only the editor; refuses a stale draft; keyboard and screen reader; phone width | `js/views/horarios.js`; `js/eventos/recursos.js:181-226` | e2e `cadastros.spec.js:241-472` (7 tests); `test/e2e/abertura.spec.js:683` "o editor dos horários aberto numa troca de data…" |
| Retirar with confirmation, History undo; Gestor cannot | `js/eventos/recursos.js:149-159` | e2e `cadastros.spec.js` "retira um recurso com confirmação; o histórico desfaz", "o Gestor não acrescenta nem retira recursos"; `cadastros.spec.js:891` (the habilitação própria leaves the filter and comes back) |
| Combustível and weight (type-level) | `js/combustivel.js` | `test/unit/combustivel.test.js` (11 tests) |
| Categories and their order | `js/categorias.js` | `test/unit/categorias.test.js` (2 tests) |

Repo rules this area touches:
- **Goldens.** The 40 generated scenarios carry `win` and `av` drawn at random and no `frota`, `horarios`, `hangar` or `horas` (`test/helpers/cenarios.js:83-91`); the example state has all windows open and every resource available (`test/fixtures/goldens-do-motor/exemplo-estado.json`). 22 of the 40 scenarios have at least one closed window; running the engine with all windows open changes the output of **18 of the 40** (seeds 5, 7, 8, 9, 10, 13, 14, 15, 18, 19, 26, 27, 28, 29, 35, 37, 39, 40; measured with `node` on the worktree, nothing written). `hashEstado` hashes the generated state (`cenarios.js:94`), so changing the generator's `win` also fails `engine.golden.test.js:21`.
- **Goldens and habilitação própria.** No golden output has a flight on PR-VOM (grep `"r":"PR-VOM"`: 0 files); `cenario-06.json` has 7 rejections with code `habilitacao-do-aviao`, whose text is pinned.
- **`gravarAlteracao`.** Every handler of the tab uses it (`js/eventos/recursos.js:65, 85, 118, 125, 143, 154, 166, 174, 212`).
- **Data-format steps never delete fields.** But `separar` writes only the fields it knows (`js/dias.js:36-74`) and `normalizarFrota` rebuilds each resource from known fields (`js/frota.js:62`): a field that code stops writing disappears from storage on the next save even without a step.
- **Personal data.** None in this area: resources carry no personal data. The CSV, the PDF and the Excel take resources only from the schedule lines (`o.r`), plus `frota` and `av` for the Excel (`js/export.js:125`).
- **Fictitious names.** People in the tests are fictitious ("Instrutor 01", "Aluno 1000", `test/helpers/estado.js:19-31`, `test/helpers/montar.js:5-15`). The registrations are the initial fleet of `js/config.js:11-17` (`test/helpers/estado.js:7-13`), which look like the school's real aircraft (inferred); a registration is not personal data.

## 5. Answers

### 5.1 The resource record

- Roster fields (all dates): `reg`, `tipo`, `soParafuso`, `soVfr`, `habilitacaoPropria` (§2.1). Nothing else is stored per resource.
- Take-off times are **not** in the record: they belong to the category (`cadastro.horarios[categoriaDoTipo(tipo)]`), so all 13 C152 share one list (§2.2; `js/horarios.js:33-36`). The Voo Solo always uses 06:30 and the Noturno 17:30 whatever the list says; the Ground uses the 8 day windows (`js/horarios.js:38-52`; `js/engine.js:601`).
- Per date, per resource: `av[reg]`, `horas[reg]`, the position in `hangar` (§2.3). Per date, derived: `RES.revisao[reg]` and the flights (§2.4).
- Per date, not per resource: `win`.
- A new date copies `av`, `hangar` and `win` from the latest earlier stored date, and takes `horas` plus that day's non-cancelled scheduled hours; this happens once, when the date is first opened (§2.5).
- Type-level constants a detail pane could show without any data change: weight limit, tank and endurance, whether the 50 h control applies, the type habilitação (§2.2).
- "Categoria" means two things on the tab today: the **type** in the "+ Novo recurso" form (`<label>Categoria <select id="rec-tipo">` with 5 options, `index.html:195-197`) and the **category** in the toolbar filter (4 options, "Simulador" merging the two simulator types, `js/categorias.js:7-13`).
- Group order differs by place: day table and Frota: C152, C172, PA-34, Simuladores (`js/views/recursos.js:18`); filter and take-off times: C152, C172, Simulador, PA-34 (`js/categorias.js:7-13`; `js/horarios.js:13`).

### 5.2 The two views

The full inventory is §3. Summary of what each view holds and its scope:

| View | Block | Scope | Filtered by search/Categoria |
|---|---|---|---|
| Disponibilidade do dia | Janelas de operação (`#wins`) | date, whole school | no |
| Disponibilidade do dia | Aviões e simuladores (`#eqs`, `#revisao`): Disponível, Horas disponíveis, Na escala do dia, Revisão feita | date, per resource | yes |
| Disponibilidade do dia | Ordem no hangar (`#hangar`) | date, whole list of aircraft | never (`js/views/filtros-dos-recursos.js:4-5`) |
| Cadastro | Frota (`#frota`): attributes, Retirar; form `#form-recurso` | all dates, per resource | yes |
| Cadastro | Horários de decolagem (`#horarios`) | all dates, per category | by category (ticked ones and, with a search, those of the resources found; `js/views/filtros-dos-recursos.js:30-31`) |

- Default view `dia` for every profile; the chosen view lasts until reload (`js/views/vistas.js:10-16`).
- `#selo-rec` (tab) and `#selo-rec-dia` (view button) show the same count: fleet aircraft with informed hours that stop today or end the day with under 5 h, excluding those with `av === false`; titles "1 avião parado ou perto da revisão de 50 horas (Recursos › Disponibilidade do dia)" (plural "N aviões parados ou perto da revisão de 50 horas …") on the tab, and the same without the parenthesis on the view button (`js/views/selos.js:9, 26-31`). The badge does **not** count aircraft in maintenance.
- At 1,100 px and wider the hangar sits beside the aircraft table, otherwise below (`css/app.css:802-808`); the page is capped at 1,280 px (`css/app.css:228`).
- e2e footprint to budget for: `#eqs input[data-a="av"]` is the generic "make a change" action of 11 spec files (49 occurrences, e.g. `compartilhado.spec.js` 13, `datas-compartilhado.spec.js` 9, `datas.spec.js` 7); `#wins input[data-a="win"]` is the "app has loaded" signal of `abrir()` (`test/e2e/fixtures.js:65`) and of 9 other places (`cursos.spec.js:820, 1198, 1527`, `cursos-no-dia.spec.js:45`, `cadastros.spec.js:1323`, `historico.spec.js:15`, `contas.spec.js:175`, `datas-compartilhado.spec.js:203`, `seguranca.spec.js:94`); `cadastros.spec.js:10` asserts the nine switches themselves. `irParaVista(page, 'rec', …)` and `percorrerVistasEFiltros` (`fixtures.js:95-99, 129-183`) encode the two views.

### 5.3 Habilitações

**The registry** `HABILITACOES` (`js/habilitacoes.js:10-33`): 21 entries `{ id, nome, curto }`. The groups are **not** in the registry; they live in the Instrutores view (`GRUPOS_DE_HABILITACAO`, `js/views/cadastros.js:35-43`) and are reused by the filter (`:347-348`).

| Group (view) | id | nome | curto |
|---|---|---|---|
| Ground e simulador | `grounds` | Grounds (C152, C172 e Navegação) | Grounds C152/C172/Nav. |
| | `ground_pa34` | Ground (PA-34) | Ground PA-34 |
| | `sim_mono` | Simulador (Mono) | Sim. Mono |
| | `sim_multi` | Simulador (Multi) | Sim. Multi |
| Voo | `tgl` | TGL (TMA) | TGL (TMA) |
| | `local` | Voo Local | Local |
| | `navegacao` | Voo de Navegação | Navegação |
| | `solo` | Voo para liberação de Solo | Liberação de Solo |
| | `parafuso` | Voo de Parafuso (SPIN) | Parafuso (SPIN) |
| | `ifr` | Voo IFR | IFR |
| | `noturno` | Voo Noturno | Noturno |
| Aviões | `c152` | C152 | C152 |
| | `c172` | C172 | C172 |
| | `mlte` | MLTE (PA-34) | MLTE (PA-34) |
| Checador: curso | `checa_pp`, `checa_pc`, `checa_inva` | Checador do curso PP / PC / INVA | Checador PP / PC / INVA |
| Checador: motor | `checa_mnte`, `checa_mlte` | Checador MNTE / MLTE | same |
| Checador: regras | `checa_vfr`, `checa_ifr` | Checador VFR / IFR | same |
| Habilitação própria do recurso (only when some resource has the flag) | `aviao:<reg>` | "Avião <reg>" (`nomeDaHabilitacao`, `js/habilitacoes.js:38`) | same |

**The per-aircraft id.** `habilitacaoDoAviao(reg) = 'aviao:' + reg` (`js/frota.js:50-51`). It exists as a requirement only while the resource has `habilitacaoPropria` (`exigenciasDoAviao`, `js/frota.js:52`). It is offered in the "Editar habilitações" panel and in the filter only for fleet resources with the flag (`gruposDosRecursos`, `js/views/cadastros.js:176-179`). As a stored value it is valid by **pattern**, not by the fleet: `normalizarHabilitacoes` keeps any `aviao:<MATRICULA>` (`js/habilitacoes.js:37, 43-45`). So after "Retirar" or after the flag is unticked, the id stays in `ins[].hab` (nothing removes it: `js/eventos/recursos.js:75-90, 149-159`) and still shows in the instructor's summary column ("Avião PR-VOM", `js/views/cadastros.js:27-28`), while its checkbox is gone. That is what makes the History undo restore the pairing (`cadastros.spec.js:891-934`).

**What each mission requires** (`exigencias(mis, eq, { curso, recurso })`, `js/habilitacoes.js:89-97`): a list of groups, all required, one id of each group enough. In practice every group has one id.

| Mission | Requirement |
|---|---|
| Ground C152, Ground C172, Ground Navegação | `grounds` |
| Ground PA-34 | `ground_pa34` |
| Simulador | `sim_mono` on Sim. Mono, `sim_multi` on Sim. Multi |
| Voo Local, TGL (TMA), Navegação, Voo Solo, Parafuso, IFR | the mission's id (`local`, `tgl`, `navegacao`, `solo`, `parafuso`, `ifr`) + the type's (`c152`, `c172` or `mlte`) |
| Noturno | `noturno` + `c172`; + `ifr` when the student's course is PC (`MIS.Noturno.porCurso`, `js/config.js:66`) |
| Multimotor | `mlte` (mission and type are the same id) |
| Cheque PP / PC MNTE VFR / PC MNTE IFR / PC MLTE VFR / PC MLTE IFR | three checador marks (`CHEQUES`, `js/habilitacoes.js:65-71`); **no** type habilitação (`:92`) |
| any, on a resource with the flag | + `aviao:<reg>` (`:95`) |

**Where an instructor's habilitações are stored.** `cadastro.ins[].hab`, roster-level (`js/dias.js:41-42`); written only by `input[data-f="hab"][data-h]` in the drawer `#painel-instrutor` (`js/views/cadastros.js:192-194`; `js/eventos/cadastros.js:157-160`), History "Habilitação incluída/retirada: <nome> · <habilitação>", no revert. The old level `lv` is kept as an unused copy.

**Every place that decides whether an INVA may operate a resource.**

Per-resource decision (the resource's own requirement):

| # | Place | What it does |
|---|---|---|
| 1 | `js/frota.js:52-54` `exigenciasDoAviao`, `instrutorVoaNoAviao` | The rule itself: every id the resource requires is in `instrutor.hab`. |
| 2 | `js/habilitacoes.js:95` inside `exigencias` | Adds the resource's ids when `contexto.recurso` is passed; `podeFazer` then checks them. |
| 3 | `js/viabilidade.js:56-57` `problemasDoInstrutor`, rule `habilitacao` | With `recurso`, fails with `motivo: 'aviao:<reg>'` (or `'curso'`). |
| 4 | `js/engine.js:826, 852-853, 867` | Free search: keeps only instructors who fly some free aircraft (else counts `aviaoProprio` → rejection `habilitacao-do-aviao`, `:961`), then picks an aircraft the chosen instructor flies. |
| 5 | `js/engine.js:268-271` `serveAoVoo` → `manterInstrutorNoMesmoAviao` (`:64-67, 111, 972`) | Registration swap never moves a flight to an aircraft its instructor cannot fly. |
| 6 | `js/engine.js:201-203` `equalizarHoras.podeReceber` | The even split never hands a flight to an instructor without the aircraft's id. |
| 7 | `js/engine.js:428-432` | Re-check of pins: conflict `habilitacao`, text "o instrutor não tem a habilitação própria do <reg>" (`js/conflitos.js:39-41`). |
| 8 | `js/compactar.js:148-153` `recursoPara` and `:195-201` `viavel` | Compaction: aircraft choice and feasibility with the new instructor or time. |
| 9 | `js/candidatos.js:74-78` `problemaDoAviao` in `avioesQueServem` (`:86-96`) | With an instructor, marks the aircraft `{ codigo:'habilitacao', motivo:'aviao:<reg>' }`. Callers: `js/reparo.js:35, 58, 91`; `js/agendamento.js:517`. |
| 10 | `js/candidatos.js:105-119` `instrutoresQueServem` with `r` | Passes the resource to `problemasDoInstrutor`. Callers: `js/reparo.js:39-40`; `js/agendamento.js:179, 551, 671, 1209`. |
| 11 | `js/instrutor-escolhido.js:59-65` `instrutoresDoVoo` | The Escala's instructor list of a flight notes "sem a habilitação". |

Per-type or per-mission decision (not tied to one registration): `exigencias` via `DO_AVIAO` / `DO_SIMULADOR` (`js/habilitacoes.js:62, 82, 90-92`); `podeFazer` without `recurso` at `js/engine.js:248, 578, 598, 937`, `js/instrutor-escolhido.js:23`, `js/agendamento.js:298`, `js/rodizio.js:9-10`, `js/eventos/bi.js:35, 56-57`; and `js/rodizio.js:11`, which reads `x.hab.includes('c172')` directly.

Display only: `js/views/cadastros.js:176-179, 194, 347-348` (panel and filter options), `js/views/demanda.js:60` (tooltip "Exige …"), `js/manual.js:15-27` (Manual table "Habilitações exigidas", per mission and type, never per resource).

**The proposal (one registry on both sides; `habilitacaoPropria` as a list of required ids).**

What exists: the resource side stores a boolean; the only per-resource requirement it can express is "my own id". The type requirement is derived in code. So today the answer to "what does an INVA need to operate PR-VOM" can already be computed, with no data change, as: type habilitação (`mlte`) + `exigenciasDoAviao(recurso)` (`aviao:PR-VOM`); it only needs `DO_AVIAO`/`DO_SIMULADOR` exported. Mission-level ids (`local`, `ifr`…) depend on the mission, not on the resource.

What a list (say `exige: [ids]`) would change:
- `js/frota.js`: `exigenciasDoAviao` returns the list (`:52`); `instrutorVoaNoAviao` keeps its form (`:54`); `recurso()` and `normalizarFrota` must carry and validate the list, otherwise it is dropped on every load (`:62`); `ATRIBUTOS_DO_RECURSO.habilitacaoPropria` and `novoRecurso` (`:26, 81-88`); `FROTA_INICIAL` and `HABILITACAO_PROPRIA_INICIAL` (`:14-18`; `js/config.js:31`).
- `js/viabilidade.js:56-57`: one line. Today the `motivo` is hard-wired to the resource's own id (`` `aviao:${recurso.reg}` ``); with a list it has to be the id that is missing. `js/candidatos.js:77` builds the same motivo, and `TEXTO_DO_PROBLEMA.habilitacao` slices `'aviao:'` off it (`js/conflitos.js:41`): both assume an `aviao:` id.
- Engine: no structural change (items 4–7 call the two functions). The texts say "habilitação própria" (`js/engine.js:244, 961`).
- `js/views/cadastros.js:176-179`: the per-aircraft group must come from the ids the fleet references, not from the flag. `js/views/recursos.js:95-102` and `js/eventos/recursos.js:75-90`: the checkbox becomes a list editor.
- History: stored entries carry `{ kind:'setAtributo', atributo:'habilitacaoPropria' }` and `readicionarRecurso.recurso.habilitacaoPropria`; `validarReversao` accepts an attribute only while it is in `ATRIBUTOS_DO_RECURSO` (`js/reversoes.js:59-63, 93-96`). If the attribute leaves that table, old entries lose their "↶ Reverter" button (they do not throw).
- Tests and helpers: `test/helpers/cenarios.js:122-137` (`comAtributos`), `atributos.test.js`, `candidatos.test.js:182`, `reparo-horario.test.js:45`, `agendamento.test.js:276`, `filtro-multiplo.test.js:27`, e2e `atributos.spec.js`, `cadastros.spec.js:801-991`; glossary `habilitacao-propria` (`js/glossario.js:84`); Manual (`index.html:517, 528-529`).

Would the goldens change? **No**, if PR-VOM still requires exactly `aviao:PR-VOM` and the two engine texts stay: golden inputs have no `frota` (the engine falls back to `FROTA_INICIAL`, `js/engine.js:261`), no generated instructor holds an `aviao:` id (`test/helpers/cenarios.js:44-51`), no golden flies PR-VOM, and the state hash does not include the fleet. Only `cenario-06.json` (7 lines with the `habilitacao-do-aviao` text) would change if that text were reworded.

How the flag would be converted: one roster step in `js/migracoes.js` (the next free number after 25): for each `frota[]` item with `habilitacaoPropria === true`, add the list with `habilitacaoDoAviao(reg)`, keeping the old field (the step must not delete it); instructors' `hab` need no change, they already hold the `aviao:` ids. `normalizarFrota` has to accept both shapes for the History payloads above.

### 5.4 Janelas de operação (`state.win`)

**UI.** Nine switches in `#wins` (§3). The Manual's daily routine: "Recursos: em *Disponibilidade do dia*, desligue os aviões e simuladores indisponíveis (em manutenção) e as janelas de horário que não vão operar." (`index.html:446`); "**Janelas de operação:** os períodos do dia em que a escala opera. Desligar uma janela tira da escala do dia os horários de decolagem que caem nela. A disponibilidade dos instrutores e "manhã, tarde e noite" do aluno também valem por janela." (`index.html:514`); glossary: "Os períodos do dia em que a escola opera nesta data … Período fechado não recebe voo nem Ground." (`js/glossario.js:74`). No text anywhere says **why** a period would be closed (weather, aerodrome, event): the reason is not documented.

**Data.** `dia.win`, 9 booleans, per date, copied to a new date (§2.3, §2.5). Normalised to all-true when it is not an array of 9 (`js/storage.js:85`). A period is `[T[i], T[i+1])`; a minute before 06:30 falls in period 0 (`periodoDoMinuto`, `js/horarios.js:55-59`).

**Every reader** (grep `\bwin\b` over `js/`):

| # | Reader | What a closed window does there |
|---|---|---|
| 1 | `js/engine.js:811` (flights and simulator) | The category's take-off times whose **start** falls in a closed period are dropped. Only the start is checked: a flight may run through a closed period. |
| 2 | `js/engine.js:601` (Ground) | A class cannot start in a closed day window (again only the start: `engine.rules.test.js:548-551`). |
| 3 | `js/engine.js:446` (pins: approval, status, chosen instructor, booking) | The pin stays where it is with conflict code `horario-fechado`, text "o horário está fechado nesta data"; group `horario` (`js/conflitos.js:21`), so Sugestões offers a later time. |
| 4 | `js/engine.js:750-753, 939-944` (rejections, indirectly) | With no start left: `sem-horario` "nenhum horário aberto comporta …" / "nenhum período aberto comporta 01h30 de Ground", or `disponibilidade-do-aluno`, or `depois-do-ground`. |
| 5 | `js/compactar.js:111` | Compaction never moves a flight to a start in a closed period. |
| 6 | `js/reparo.js:89` | Sugestões "Passar para as HH:MM" skips starts in closed periods. |
| 7 | `js/agendamento.js:105-108` `horariosDoAgendamento` | The booking dialog's time list drops them; a typed "Outro horário" there is blocked with `horario-fechado` through the engine simulation (`agendamento.test.js:611-622`). |
| 8 | `js/views/horarios.js:39, 45-48` | The take-off times summary strikes the time through, tip `horario-em-janela-fechada` "A janela das HH:MM está fechada nesta data." |
| 9 | `js/views/recursos.js:146` | Draws the switches. |

Writers and plumbing: `js/eventos/recursos.js:115-120` (the only UI writer); `js/dias.js:34, 56, 89, 120-122`; `js/storage.js:49, 85`; `js/backends/local.js:71-83` (old 7-window format). Tests and helpers: `test/helpers/montar.js:31` (`janelasOff`), `test/helpers/cenarios.js:85`, `test/helpers/estado.js:36`.

Not readers (a closed window has no effect): the Agenda and its SQL (a pedido can be registered for a time in a closed period; no check in `js/agenda.js` or `supabase/migrations`); the Demanda's time selects (`js/views/demanda.js:51, 77-79`); `problemasDoInstrutor` (`cobre` reads the instructor's `aw` only, `js/viabilidade.js:17`); the D+1 Noturno return leg, which is placed without looking at `win` or `av` (`js/engine.js:370-393`); the CSV, the PDF, the Excel, the BI, the Painel.

**Overlap with the per-category take-off times.** Both feed one expression, `horariosDaMissao(horarios, mis, eq).filter(m => state.win[periodoDoMinuto(m)])` (`js/engine.js:811`; `js/compactar.js:111`; `js/agendamento.js:106-107`).

**Differences.**

| | Janelas (`win`) | Take-off times (`horarios`) |
|---|---|---|
| Scope in time | one date (copied forward to new dates) | all dates |
| Scope in resources | everything: all categories at once | one category (C152, C172, Simulador, PA-34) |
| Ground classes | closes them (`js/engine.js:601`) | no list: Ground uses the 8 day windows |
| Noturno (17:30) | period 8 closes it (`engine.rules.test.js:446`) | fixed at 17:30, not in any list (`js/horarios.js:52`) |
| Voo Solo (06:30) | period 0 closes it | fixed at 06:30, not in any list |
| Granularity | 9 fixed periods | any minute 06:00–16:30 in the editor |
| Undo | none | History revert `restaurarHorarios` |

So the two do not fully overlap: `win` is the only **per-date, school-wide** closing, and the only one that reaches Ground, the Noturno and the Voo Solo. The other per-date levers are per resource ("Disponível", whole day), per instructor (`on`, `aw`) and per request (`jan`).

**The nine periods outlive `state.win`.** `WIN`/`T`/`periodoDoMinuto` are also: the instructor availability grid `aw` and the turnos `PRE` (`js/views/cadastros.js:80-90`; `js/viabilidade.js:17`), the student's "manhã, tarde, noite" (`js/rules.js:12-27`), the Escala list grouping `o.w` and `WLB` (`js/views/escala.js:526`; `js/format.js:7`), the PDF section rows (`js/export.js:59-62`), the Ground start times (`js/engine.js:601`), the default take-off lists (`js/horarios.js:10`), the "Janelas do dia" model of the editor (`js/horarios.js:111-116`) and the Manual list `#manual-janelas` (`js/manual.js:43`).

**In practice (Manual and tests).** The Manual only says to switch off "as janelas de horário que não vão operar". In the tests, closing a window is used (a) to pin the rule itself, (b) as a device to force the engine into a given slot (`engine.rules.test.js:74, 342, 501, 549`), and (c) to create a `horario-fechado` conflict on an approved flight (`reparo.test.js:124`, `reparo-horario.test.js:45, 67`, `fixos.test.js:132`).

### 5.5 "Retirar", "Disponível" and maintenance; is there an "inactive" notion?

**"Disponível" (per date).** `dia.av[reg]`; `false` is shown as "Em manutenção". There is no maintenance record (no from–to dates, no reason): maintenance **is** this boolean, inherited by copy when a new date is first opened. Undo: History "↶ Reverter" (`setAv`), entry "Revertido: PR-BTB disponível / em manutenção" (`js/eventos/historico.js:62-65`); the revert is validated by pattern, not against the fleet (`js/reversoes.js:54-56`).

What reads `av[reg] === false`:

| Consumer | Effect |
|---|---|
| Engine free search | out of the pool (`js/engine.js:842`); rejections "nenhum C152 disponível (todos em manutenção)", "o PR-JPL (só para Parafuso no C152) está em manutenção" (`:929-936`). |
| Engine pins | conflict `aviao-indisponivel`, "o avião está indisponível" (`js/engine.js:437`); suggested cancel reason "Manutenção da aeronave" (`js/reparo.js:113`). |
| Registration swap, compaction, candidates | excluded (`js/engine.js:101`; `js/compactar.js:143`; `js/candidatos.js:57`). |
| 50 h | no "parou para revisão" warning and no badge for it (`js/engine.js:1018`; `js/views/selos.js:28`). |
| Escala map | idle row struck through with "em manutenção", no "+" (`js/views/escala.js:156-164`). |
| Hangar list | tag "manutenção"; it keeps its position (`js/views/recursos.js:163`). |
| Recursos table | row class `manutencao`, tag "Em manutenção", group count "N de M disponíveis" (`js/views/recursos.js:38, 64, 86`). |
| BI | tag "Manut." and "Recursos disponíveis n/N" (`js/views/bi.js:127, 142`). |
| Excel | the registration cells in red (`js/planilha.js:195`). |
| CSV, PDF | nothing (they list flights only). |
| D+1 Noturno return | not checked: the return leg is placed even on an aircraft in maintenance (`js/engine.js:370-393`). |

**"Retirar" (roster, all dates).** Deletes the item from `cadastro.frota` after two clicks. No check for flights or pins on it. Exact data effects:
- `S.frota` loses the record (reg, type and attributes). `S.av[reg]`, `S.horas[reg]` and the position in `S.hangar` are **not** removed by the handler (`js/eventos/recursos.js:149-159`); they stay in memory and in the open date's saved day until that date is loaded again, when normalisation drops them (`js/storage.js:93, 112-115`; `js/dias.js:106`). Other stored dates keep their `av`, `horas` and `hangar` entries for it until each is opened and saved again.
- Instructors keep `aviao:<reg>` in `hab`; its checkbox and filter option disappear (`js/views/cadastros.js:176-179`).
- Engine on the open date: unpinned flights move to other aircraft; a pin on it conflicts with `tipo-de-aviao`, "a missão ou o avião do pedido mudou" (`js/engine.js:435-436`).
- Other dates: a stored schedule is shown as saved (it is not checked against the fleet, `js/escala-gravada.js:45`); the first change on that date re-runs the engine without the resource, also on past dates.
- Escala map: the row of a retired resource with flights is inert (`js/views/escala.js:157-163`). Hangar: gone (`js/hangar.js:9-13`). BI: its hours stay, tagged "Retirado" (`js/views/bi.js:139-142`). Excel: its column goes to a new aircraft or shows "-" (`js/planilha.js:85-95, 190-193`; `planilha.test.js:203`).
- Undo: only the History entry of **the date that was open** ("↶ Reverter", `readicionarRecurso`): the record comes back with its attributes and `av` (`js/eventos/historico.js:107-112`), appended at the **end** of the fleet (`S.frota.push`), not in its old place. Not restored by the revert itself: the hours and the hangar position (they survive only if nothing normalised them away in between). The revert is refused when a resource with that reg exists again (`js/reversoes.js:93-96`). From another date the only way back is "+ Novo recurso", which takes only reg, type and "Só Parafuso" (`js/eventos/recursos.js:59`).

**Is there an "inactive" notion for a resource today?** No. A resource is either in the fleet or not, and per date available or not (grep for `inativ`/`ativo` finds only courses, `curso.ativo`). The engine's phrase "nenhum instrutor ativo" means `x.on` on the date (`js/engine.js:747, 938`).

**How a cadastro-level switch would differ from "Retirar".**

| | "Retirar" today | A roster `inativo` switch (not implemented) |
|---|---|---|
| Record | deleted | kept, with attributes and required habilitações |
| Reversible | only from that date's History, or by re-typing | from the list row, any time |
| Day data (`av`, `horas`, hangar position) | garbage-collected date by date | could be kept |
| Instructors' `aviao:<reg>` | orphaned | still meaningful |
| Pins on it | conflict "a missão ou o avião do pedido mudou" | depends on how the engine is told (§7 S4): as `av = false` it reads "o avião está indisponível" |
| Past dates | re-run without it on the first edit | same hazard unless inactivity is dated or past dates are exempted |
| BI | "Retirado" | needs its own tag |
| Excel column | lost | can stay |

### 5.6 The hours until the 50 h inspection

- **Data.** `dia.horas[reg]` = hours since the last inspection at the start of the date; absent = no control (`saldoAteARevisao` → `Infinity`, `js/viabilidade.js:23`). The constant is `REVISAO_H = 50`; the aircraft stops when it has no balance for a `MENOR_VOO_H = 1` h flight (`js/config.js:85-87`).
- **Who edits.** Op/Adm, per date: the operator types the hours **available** ("a operadora lança as disponíveis", `js/views/recursos.js:46-48`), the app stores `50 − available`; "Revisão feita" sets 0 stored (50 available). Simulators have no field. No undo for either.
- **Do flights consume it?** Inside the day, yes, in the engine: it adds the hours of each flight on the aircraft and refuses one that does not fit whole (`cabeNoSaldo(eu[r], h, saldo(r))`, `js/engine.js:844`; pins `:443`, conflict `revisao`, "o avião passaria da revisão de 50 horas"; rejection `revisao`, "os C152 livres estão sem saldo até a revisão de 50 horas", `:954`). The stored `horas` of the date does not change. Across days, only when a **new** date is created (§2.5 step 3), from the previous stored day's saved schedule, with scheduled hours and skipping cancelled flights. There is no ledger: a date already stored does not follow later changes of an earlier date, and actual flown time is never entered.
- **How `js/viabilidade.js` uses it.** Two pure helpers: `saldoAteARevisao(horas, r)` and `cabeNoSaldo(horasNoDia, h, saldo)` (`:20-23`). Callers: `js/engine.js:67, 76, 112, 350, 443, 844`; `js/compactar.js:143-144` (only when the flight changes aircraft); `js/candidatos.js:61` (`problemaDoRecurso` → `revisao`).
- **What the screen shows.** Column "Horas disponíveis": the input with `50 − horas` and a bar, amber under 10 h, red under 5 h (`js/views/recursos.js:50-56`); column "Na escala do dia": "N h na escala · termina com X h disponíveis" or the red tag "Parou para revisão de 50 horas às HH:MM" / "(sem saldo hoje)" (`:37-44`); the hint under the table (`index.html:180`); the badge (§5.2); the warning in the Escala; the CSV note "Avião para para a revisão de 50 horas às HH:MM" (`js/csv.js:36-37`); "REVISÃO" in the Excel rows after the stop (`js/planilha.js:202-209`).

### 5.7 The hangar order

- **Data.** `dia.hangar`: registrations of the fleet's aircraft (C152, C172, PA-34; 22 in the initial fleet), front to back; per date, copied to a new date. Simulators and the Ground room are never in it (`js/hangar.js:1-13`). A new aircraft is not inserted by the "+ Novo recurso" handler; normalisation appends it at the back (`js/hangar.js:12`).
- **Rules.** `moverNoHangar(hangar, r, 'subir' | 'descer' | 'frente')` (`js/hangar.js:19-26`): up or down one place over the **whole** list, or to position 0; an unknown reg returns a copy. This is why the tab's filters never apply to the hangar: moving within a filtered list would swap with hidden neighbours (`js/views/filtros-dos-recursos.js:4-5`; `hangar.spec.js:35`).
- **Where it is used.** Only as the last tie-break when choosing among aircraft that serve: engine free search, after "the aircraft the instructor already uses today", "not the student's previous aircraft" and "smallest gap to a flight already on it" (`js/engine.js:866-869`); registration swap, the order in which registrations are offered (`js/engine.js:101`); compaction (`js/compactar.js:153`, `posicao` passed at `js/engine.js:973`); Sugestões and the booking dialog's resource options (`js/candidatos.js:88, 94-95`; `js/agendamento.js:517-520`). **Not** used by the CSV, the PDF, the Excel, the BI or the Painel/TV (grep `hangar` over `js/`).
- **Where it could live in a master-detail screen.** It is a property of the whole list for one date, not of one record; options in §7 S6.

### 5.8 The take-off times editor (`js/views/horarios.js`)

- **One draft at a time**, module-level: `rascunho = { cat, lista, base, erro, erroDoCampo }` (`:28-35`). Opening the editor of another category replaces the draft **without asking** (the other "Editar" buttons stay enabled, `:59-60, 158-163`; `cadastros.spec.js:449-455` relies on it).
- **Nothing changes until "Salvar".** "Cancelar" and Esc (with the focus inside `#horarios`) discard; Esc closes only the editor, leaving an open History drawer (`js/eventos/recursos.js:226`; `cadastros.spec.js:340`).
- **Draft operations.** Remove a time by its ✕ (the last one cannot go: "Cada categoria precisa de pelo menos um horário.", `:183-187`); add the typed time with "Adicionar" or Enter, only 06:00–16:30 ("Escolha um horário entre 06:00 e 16:30.", `:189-200`; storage accepts up to 17:00, `js/horarios.js:19-20, 104-106`); pick a model: "Janelas do dia" (the 8 day windows) or "De 30 em 30 min" (21 times) replace the list, "Personalizado" only reflects a custom list (`:202-206`). The input has `step="300"` but any minute in range is accepted (`paraMinuto`, `js/horarios.js:69-72`).
- **Effect preview** before saving, live region: "Nenhum pedido muda.", or "1 pedido muda de preferência" / "N pedidos mudam de preferência", followed when it applies by "; 1 perde “Só às HH:MM”" or "; N perdem o “Só às”", and a final period (`resumoDoImpacto`, `js/horarios.js:161-167`); computed over the **open date's** requests (`efeitoDoRascunho`, `:41-43`; `impactoDosHorarios`, `js/horarios.js:148-167`).
- **Save** (`salvarHorarios`, `js/eventos/recursos.js:192-216`): unchanged list → just closes; if the category's list is no longer the `base` the draft started from (another person's change read with a date, or a History revert) → nothing is saved, the editor closes, toast "Os horários do <categoria> mudaram depois que o editor abriu: nada foi salvo. Confira a lista e edite de novo."; otherwise `S.horarios[cat] = lista`, each request of that category **on the open date** is moved to the nearest time of the new list and loses a "Só às" that no longer exists (`ajustarPreferencias`), and one History entry "Horários de decolagem do <categoria>: <resumo>" carries the revert `{ kind:'restaurarHorarios', cat, lista, pedidos }` that restores the list and those requests. Requests stored on other dates are not touched; a preference outside the list shows there as "HH:MM (fora da lista)" (`js/views/demanda.js:27-31`).
- **The draft survives** redraws of the tab (typed-but-not-added time and focus included, `:112-128`), the switch to the other view (the editor stays open, hidden), and a date change: it then saves into the date open at that moment, and the History entry is filed there (`abertura.spec.js:683-706`).
- **Filters.** The category being edited stays visible whatever the filters say; after closing it stays until the filters change (`:119, 167-175`).
- **Focus and screen reader.** Opens on `.hr-novo`; closes back to that category's "Editar"; a removed chip passes the focus to the next one; the error (`role="alert"`) and the effect (`aria-live`) keep the same elements so new text is announced (`:130-156`; `cadastros.spec.js:391`).
- **Dependency on `win`.** The summary strikes through times in a window closed on the open date (`:39, 45-48`); the section hint says "dentro das janelas de operação abertas" (`index.html:207`).

## 6. Conflicts with the request

| # | The request assumes | The code says | Evidence |
|---|---|---|---|
| C1 | Janelas de operação and the per-category take-off times overlap, so the first can go. | They overlap only for daytime flights of the four categories. `win` is per date, closes all categories at once, and is the only thing that closes Ground classes, the Noturno (17:30) and the Voo Solo (06:30), none of which is in any take-off list. Nothing else closes a period for the whole school on one date. | `js/engine.js:601, 811`; `js/horarios.js:52`; §5.4 |
| C2 | "Remove the top-level Janelas de operação (`state.win`)" is listed inside the Recursos screen workstream (B), while the guardrail keeps the goldens unchanged outside rule-change commits. | Removing the **reads** of `win` is a rule change: the engine, the compaction, Sugestões and the booking read it; 22 of the 40 golden scenarios have a closed window, and ignoring `win` changes 18 of them. The goldens stay only if the engine keeps reading `win` and the new input simply carries it (all open). | `js/engine.js:446, 601, 811`; `js/compactar.js:111`; `test/helpers/cenarios.js:85`; measurement in §4 |
| C3 | (implicit) Dropping the control is enough. | `win` is copied to every new date. A window closed on the last stored date would keep propagating with no control left to reopen it, unless the copy or the read is changed too. | `js/dias.js:120-122` |
| C4 | The requirement "must point at the same registry the INVAs' habilitações use (`HABILITACOES` plus `aviao:<matrícula>`)". | The resource side references nothing today: it has one boolean, and its only possible requirement is its own id. The type requirement lives in two private maps in code; the registry has no groups (they are in the Instrutores view); `aviao:` ids are valid by pattern, so orphans persist after "Retirar" or after unticking the flag. | `js/frota.js:26, 52`; `js/habilitacoes.js:37, 62, 82`; `js/views/cadastros.js:35-43, 176-179` |
| C5 | "The detail shows the hours available until the inspection and the maintenance status" (as fields of a cadastro record). | Both are per-date values (`dia.horas`, `dia.av`), copied once to each new date; there is no maintenance record and no hours ledger. A roster detail would be showing the open date's values. | `js/dias.js:57, 65, 118-137` |
| C6 | "Take-off times are already set per category in the cadastro". | True, and therefore they are not a field of a resource: all resources of a category share the list, and the editor adjusts only the open date's requests. A resource detail pane cannot own it. | `js/horarios.js:13-14, 33-36`; `js/eventos/recursos.js:203-211` |
| C7 | "Deactivating … Recursos get a switch on the list row … (find how … "Disponível" and "Retirar" work today)". | No inactive notion exists. "Retirar" deletes the record; its undo exists only in the History of the date that was open and does not by itself bring back hours or hangar position. | `js/eventos/recursos.js:149-159`; `js/eventos/historico.js:107-112`; §5.5 |
| C8 | The rail's notification sources include `selo-rec`. | It exists, with a twin `selo-rec-dia`; it counts only aircraft stopped or under 5 h to the inspection. No badge counts aircraft in maintenance; maintenance surfaces only when it causes a rejection ("nenhum C152 disponível (todos em manutenção)") or a pin conflict. | `js/views/selos.js:26-31`; `index.html:96, 153` |
| C9 | "No modal or pop-up for viewing or editing a record" replaces "the wide tables and the editing drawer". | For Recursos there is no drawer or modal today; everything is already inline. The drawer belongs to Instrutores (`#painel-instrutor`), where the habilitações are edited. | `index.html:149-211`; `js/views/cadastros.js:181-197` |
| C10 | Roster screens "apply to all dates". | Every roster edit is saved together with the open date's day and filed in **that date's** History, where its "↶ Reverter" lives; saved schedules of other dates are not recalculated until those dates are edited. | `js/actions.js:166-195`; `js/storage.js:229-242`; `abertura.spec.js:706` |

Confirmed as stated in the request: nine tabs in that order (`index.html:91-103`); `ESQUEMA` is 25 (`js/migracoes.js:13`); 41 goldens = 40 scenarios + the example (`test/helpers/goldens.js:8-12`); the page cap of 1,280 px (`css/app.css:228`).

## 7. Implications and options for the redesign (suggestions)

Each item is a suggestion, with its cost and its risk.

- **S1. Keep `win` as an engine input; remove only the control.** The Processamento output carries `win` (all open, or whatever replaces the control). *Cost:* none in the engine; goldens, `test/helpers/cenarios.js` and `montar.js` untouched. *Risk:* an input with no screen; must be paired with S2 or stored closed windows keep acting.
- **S2. Decide the fate of stored closed windows in the same step.** Options: (a) `juntar`/Processamento ignores the stored `dia.win` and emits all-true, while `separar` keeps writing the stored value (no field deleted); (b) stop copying `win` in `diaParaCopiar` and keep honouring it on dates that already have it; (c) a data-format step that opens every window in stored days. *Cost:* (a) and (b) small, with tests in `dias.test.js:31, 156-171`; (c) rewrites days. *Risk:* (a) and (c) change what a past date recalculates to when edited; (b) leaves invisible state on old dates.
- **S3. If a per-date closing is still wanted, move it to the date, not to Recursos.** For example "Fechar um período nesta data" in the right rail under the open date, stored in the same `dia.win`. *Cost:* one small control plus the 9 switches' tests moved. *Risk:* keeps the nine fixed periods alive in the UI while the INVAs move to ranges.
- **S4. Implement "inativo" without touching the engine.** A boolean on the roster record; the Processamento step emits `av[reg] = false` for inactive resources. The engine then excludes them and marks pins "o avião está indisponível" with today's code path. *Cost:* `normalizarFrota` must keep the new field (`js/frota.js:62`); views must hide or dim inactive rows in the map, the hangar and the Excel; a data-format number. *Risk:* past dates recalculate without the aircraft when edited (same as "Retirar" today); the map would label it "em manutenção" unless the views tell the two apart.
- **S5. Keep "Retirar" only as "added by mistake", or drop it.** With S4, "Retirar" could be limited to resources that never flew, or removed. *Cost:* small. *Risk:* removing it loses the only way to delete a typo; keeping both needs clear wording.
- **S6. Place the hangar order at list level.** Options: (a) the detail pane's empty state (nothing selected) shows "Ordem no hangar" for the open date; (b) a sort mode of the master list ("Ordem: hangar") with the three move buttons on the rows, disabled while a search or filter is on; (c) a section of the Escala stage's settings, since it is an allocation input per date. *Cost:* (a) lowest, the list `ol#hangar` and its handlers move as they are; (b) needs the F2 list component to support reordering; (c) moves it out of Recursos. *Risk:* (b) repeats the reason filters were kept off the hangar; (c) separates it from the aircraft availability it is read with.
- **S7. Place the take-off times editor at category level.** Options: (a) category headers in the master list open a category detail holding the times (and the type-level facts); (b) a shared section inside each resource's detail, titled with the category and the count ("vale para os 13 C152"). *Cost:* (a) needs group rows that can be selected; (b) is the smallest move. *Risk:* (b) invites the reading "this aircraft's times"; in both, the single module-level draft is discarded silently when another editor opens, so selecting another item with a dirty draft needs a rule.
- **S8. Registry first (F3), list second.** Step 1: move `GRUPOS_DE_HABILITACAO` into `js/habilitacoes.js`, export the type habilitação, and add one function "what an INVA needs to operate this resource"; the detail pane can show it with no data change. Step 2, only if a resource must require something other than its own id: the list, the conversion step and the History compatibility of §5.3. *Cost:* step 1 small, no format number; step 2 touches `frota.js`, `viabilidade.js:56-57`, `candidatos.js:77`, `conflitos.js:41`, the views and about 10 test files. *Risk:* step 2 rewording the two engine texts changes `cenario-06.json`.
- **S9. Label per-date fields as such in the detail.** "Disponível nesta data" and "Horas disponíveis no início desta data" next to the rail's open date, keeping the data model. *Cost:* wording. *Risk:* low; the alternative (a maintenance period or an hours ledger at roster level) is a rule change with new data.
- **S10. Replace the e2e "loaded" signal before removing `#wins`.** `abrir()` can wait for `body[data-pronto]`, which the bootstrap already sets in both modes (`js/main.js:142`; `fixtures.js:85`). *Cost:* `fixtures.js:65` and 9 other lines. *Risk:* low; do it in the foundation so workstream B does not break every spec.
- **S11. Keep the ids the tests click.** `input[data-a="av"][data-id]`, `input[data-a="horas"][data-horas]`, `[data-act="hangar-*"]`, `[data-act="retirar-recurso"]`, `[data-act="editar-horarios"]` can keep their attributes inside the new panes, so `registro.js` and most specs keep working with only container selectors changed (`#eqs`, `#revisao`, `#frota`, `#horarios`). *Cost:* discipline. *Risk:* container ids used as layout hooks in CSS.
- **S12. One roster document, more roster editing.** The roster is one JSON document with optimistic locking; two people editing any roster field conflict and the second screen locks. *Cost of doing nothing:* none. *Risk:* more frequent "Outra pessoa alterou…" once Alunos, INVAs and Recursos are edited in place all day.

## 8. Open questions for Pedro

1. Is closing a period for one date used in real operation, and for what (weather, aerodrome closed, an event)? If it goes, should stored days with closed windows open up, and what should a past date show?
2. If it stays in some form, should it also close Ground classes, the Noturno and the Voo Solo, as it does today?
3. Is "inativo" for a resource meant to replace "Retirar", or do both stay (inactive for an aircraft out for months, Retirar for a typo)?
4. Should an inactive aircraft keep its place in the hangar, its hours, its column in the Excel, and should it appear in the Escala map?
5. Should deactivating (or retiring) leave past dates as they were, even when someone edits them later?
6. Does any resource need to require something other than its own id (for example IFR for one aircraft, or one shared id for two aircraft)? If not, is the list still wanted?
7. When a resource loses its own habilitação or leaves the fleet, should the id be removed from the instructors who have it, or kept as today?
8. Should "Disponível" and the hours until the inspection stay per date (copied forward once), or become roster-level with a maintenance period and an hours ledger? Today a date already saved does not follow a change made on an earlier date.
9. Is the hangar order one order per date, as today, or one order for all dates?
10. Where should the take-off times live: with the category, or repeated inside each resource? Is a per-resource exception wanted?
11. Should the detail show the type's fixed facts (weight limit, tank, 50 h control) read-only?
12. Is renaming a matrícula needed? Today the only way is "Retirar" plus "+ Novo recurso", which breaks the link with past schedules and the BI.
13. On the list row's second line the request says "category for a resource": the type (Sim. Mono, Sim. Multi) or the category (Simulador)?
14. Roster changes are filed in the History of whatever date is open. In the new layout, where should the undo of a roster change be found?

<!-- fim -->
