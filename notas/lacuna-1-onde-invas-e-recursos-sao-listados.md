# Lacuna: where every INVA and every Recurso is listed, whatever the per-date `on` or `av` says

Read on the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to the worktree root.
"(ran)" marks a fact confirmed by running a pure module with `node` on fictitious data (nothing was written);
"(inferred)" marks a conclusion with no single line that proves it. Nothing in the worktree was changed.

Words used below, for what a place does with the per-date flag (`ins[].on`, "Vem"; `av[reg]`, "Disponível"):

- **ignores**: every item of the roster or of the fleet is listed, and the flag is not read there.
- **marks**: every item is listed; the flag only changes a label, a style, or disables the option.
- **filters**: the flag already takes the item out.

A cadastro-level inactive switch that reached the code as `on: false` or `av: false` would be honoured only by the
"filters" rows. Every "ignores" and "marks" row needs its own gate.

## Answer

### 1. Five facts that frame every gate

1. **No cadastro-level flag exists** for instructors or resources. `grep -rn "inativ\|desativ"` over `js/` and
   `index.html` finds one line, the History text "Janela HH:MM inativa" (js/eventos/recursos.js:118). For a person,
   "ativo" means "comes on this date": `ativos = state.ins.filter(x => x.on)` (js/engine.js:172; js/compactar.js:81) and
   the rejection text "nenhum instrutor ativo tem a habilitação de …" (js/engine.js:747, 938), which is recorded in 3
   golden files, 27 alerts (ran: grep over test/fixtures/goldens-do-motor).
2. **One object does three jobs.** `S` is what the screens draw, what the engine receives (`runAllocationEngine(S)`,
   js/actions.js:367) and what is split and saved (`ApiClient.salvarDia(DATA, S, RES)`, js/actions.js:169, then
   `separar(estado)`, js/storage.js:231). `separar` writes `dia.av` and `dia.ins[id].on` straight from it
   (js/dias.js:57-58), and a new date copies both from the latest saved day (js/dias.js:120-122). A value forced into
   `S.ins[].on` or `S.av` is therefore saved in the day and inherited by the new dates that follow.
3. **A new field does not survive today.** Instructor: `separar` rebuilds each one from `{ id, nm, lv, kg, hab,
   horasExternas }` (js/dias.js:41-45), so any other key is gone at the next save (ran); pinned by
   test/unit/dias.test.js:28. Resource: `separar` keeps every key (`{ ...f }`, js/dias.js:48), but the next load drops
   it, because `normalizarFrota` rebuilds each resource from `reg`, `tipo` and the known attributes (`recurso()`,
   js/frota.js:62, called at js/dias.js:81 and js/storage.js:89) (ran); pinned by test/unit/atributos.test.js:55-62 and
   by the round trip of test/unit/dias.test.js:17.
4. **Defaults.** An instructor with no entry in the day is on (js/dias.js:94). A fleet resource the day does not know
   is available (js/dias.js:90; js/storage.js:114).
5. **`av` is read in two ways.** Falsy means unavailable for the engine, the candidates, the Recursos table, the BI and
   the map (`!av[r]`: js/engine.js:101, 437, 842; js/compactar.js:143; js/candidatos.js:57; js/views/recursos.js:38, 64,
   86; js/views/bi.js:127, 142; js/views/escala.js:158). Only an explicit `false` counts for the hangar tag, the Excel,
   the badge and the 50 h stop (js/views/recursos.js:163; js/planilha.js:195; js/views/selos.js:28; js/engine.js:1018).
   The two agree today because `juntar` and the normalisation give every fleet resource a boolean; a resource missing
   from `av` would be unavailable for the first group and available for the second.

### 2. Instructors: every list and picker

| # | Place (label, element) | What it lists today | Per-date `on` there | Evidence | Test that pins it |
|---|---|---|---|---|---|
| I1 | Instrutores › "Disponibilidade do dia", `#inst-dia` | one row per `S.ins` item, in roster order; redrawn on every recalculation (js/actions.js:375) | marks: `class="off"` (50% opacity, css/app.css:577, 1050) and the switch "Vem" (aria-label "<nome> vem no dia") | js/views/cadastros.js:84-86, 126-128 | test/e2e/cadastros.spec.js:993 |
| I2 | Instrutores › "Cadastro", `#inst`, and the count "12 de 40 instrutores" | every `S.ins` item; the count is the number of rows | ignores | js/views/cadastros.js:170, 410-422, 440-451 | test/e2e/cadastros.spec.js:673, 691 |
| I3 | "Editar habilitações" (`#painel-instrutor`) and "Dados pessoais", opened from a row | any instructor of the table | ignores | js/views/cadastros.js:115, 182-197 | test/e2e/cadastros.spec.js:1050 |
| I4 | Alunos › "Não escalar com…", `select[data-f="bl"]` | `S.ins.filter(x => !s.bl.includes(x.id))`: every instructor not yet in the list; every option enabled | ignores | js/views/cadastros.js:252 | test/e2e/instrutor-escolhido.spec.js:102 picks "Instrutor 03", who is `on: false` in the scenario (:6); test/e2e/cadastros.spec.js:1124 |
| I5 | Alunos › "Priorizar com…", `select[data-f="voaCom"]` | `S.ins.filter(x => !pares.includes(x.id) && !s.bl.includes(x.id))` | ignores | js/views/cadastros.js:260 | test/e2e/instrutor-escolhido.spec.js:93-103 |
| I6 | Alunos › the chips of both lists | the name of each id through `insBy`; an id with no instructor draws nothing | ignores | js/views/cadastros.js:251, 259 | same |
| I7 | Demanda › "Instrutor", `select[data-f="insId"]` | `instrutoresDoPedido(S, stu, d)` maps every `estado.ins` and keeps those whose note is `''` or `'fora nesta data'`, plus the chosen one | marks: "Instrutor 03 (fora nesta data)", still selectable; choosing him rejects the request, "Rejeitado: o instrutor escolhido (Instrutor 03) não está disponível nesta data." | js/views/demanda.js:36; js/instrutor-escolhido.js:22, 30-32; js/engine.js:576-582 | test/unit/instrutor-escolhido.test.js:188; test/e2e/instrutor-escolhido.spec.js:19, 37-43 |
| I8 | Demanda › first option "Automático (prioriza A, B)" | every `voaCom` id found in `S.ins` | ignores | js/views/demanda.js:37-38 | test/e2e/instrutor-escolhido.spec.js:106 |
| I9 | Escala › the instructor's name opens a list, `select.ins-sel[data-a="insVoo"]` (list and map popup) | `instrutoresDoVoo(S, RES, fKey)`: every `estado.ins`, those without a problem first | marks: "Instrutor 03 (indisponível)"; every option enabled, and choosing one pins the flight with him, in conflict ("o operador pode escolher mesmo assim") | js/views/escala.js:354-357; js/instrutor-escolhido.js:38-41, 46-49, 59-70 | test/unit/instrutor-escolhido.test.js:124, 133 |
| I10 | "Agendar voo" › "Instrutor", `#agd-instrutor` | `opcoesDeInstrutor` over `instrutoresQueServem`, which returns every `estado.ins` with all the problems; three groups, "Servem neste horário", "Com aviso", "Não servem" | marks: an instructor whose only problem is `instrutor-indisponivel` goes to "Com aviso" as "<nome> — indisponível", enabled; the block then offers "Marcar <nome> disponível às HH:MM", which sets `x.on = true` and the windows of the flight | js/candidatos.js:105-119; js/agendamento.js:546-574 (564-565), 934-939, 1098; js/views/agendamento.js:49-50, 86 | test/unit/agendamento.test.js:599, 760; test/e2e/agendamento.spec.js:222 |
| I11 | "Agendar voo" › the default instructor | the first option that is not disabled (`habilitadas[0]`), so with nobody serving it can be an "indisponível" one; an instructor from the context (the row's "+", a moved request's `insId`) is accepted when he is anywhere in the list, and everyone is | marks (inherits I10) | js/agendamento.js:297, 345, 603, 697-704, 716-717 | test/unit/agendamento.test.js:201, 224 |
| I12 | "Agendar voo" › alternatives "Instrutores livres", "Instrutores que cabem no peso"; the note "Na fila do rodízio (…), a vez é de …" | only the group "Servem neste horário" | filters | js/agendamento.js:992-993, 1004-1005, 1206-1212 | test/unit/agendamento.test.js:1085, 1153, 1190 |
| I13 | Sugestões drawer (`#painel-reparo`): "Trocar o instrutor: …", "Trocar o avião e o instrutor: …", "Passar para as HH:MM, …, com …" | only instructors with no problem | filters | js/reparo.js:39-40, 60, 63, 92-93 | test/unit/reparo.test.js:25, 59 |
| I14 | Rodízio tab, `#rodizio` | `ajustarFilas(S.filas, S.ins)`: every instructor qualified for the category (`participa`), in queue order | marks: tag "indisponível"; position and the three buttons stay | js/rodizio.js:7-12, 24-31; js/views/rodizio.js:9-24 | membership: test/unit/rodizio.test.js:23; the tag has no test (grep "indisponível" in the two rodízio test files: none). (ran) `ajustarFilas({}, [on, off])` puts both in `c172` and `mlte` |
| I15 | Escala › "Por instrutor" map, free rows | `S.ins.filter(x => x.on)`, and only with no Categoria, Recurso or search filter | filters | js/views/escala.js:580-582 | test/e2e/agendamento-mapa.spec.js:138 |
| I16 | Escala › "Por instrutor" map, rows with flights, their "+" ("Agendar com <nome>", `data-agendar="i:<id>"`) and the click on the track | one row per `insId` among the visible flights, whoever he is: off on the date with a pinned flight, back from yesterday's Noturno, or out of the roster (label from the stored name). The "+" and the click exist whenever the id is in `S.ins` | ignores | js/views/escala.js:133-137, 150-153; js/eventos/escala.js:52-55 | test/e2e/agendamento-mapa.spec.js:282 |
| I17 | BI › fourth tile, small text "N/M instrutores" | `S.ins.filter(x => x.on).length` over `S.ins.length`, from the open date's state | N filters, M ignores | js/views/bi.js:127 | the snapshots of test/e2e/bi.spec.js:12: "26/26 Recursos disponíveis 40/40 instrutores" (test/e2e/__snapshots__/bi.spec.js/bi-dia.json:6, also bi-30-dias.json:6 and bi-filtrado.json:6) |
| I18 | BI › "Horas por instrutor (dia, semana e mês)" and "Buscar instrutor…" | one row per roster instructor, keyed by NAME (`insStats[x.nm]`), plus one per name found in the saved schedules; two instructors with the same name share a row; a roster instructor with no hours is a row (behind "Ver todos (N)" past the 10th). The `on` copied into the row is never read | ignores | js/views/bi.js:18-27, 44, 86, 113-115, 165-178 | test/e2e/bi.spec.js:58 |
| I19 | BI › "Simular 30 dias" (local mode only) | the mission pool asks for `x.on`, but each simulated flight's instructor is drawn among everyone qualified | ignores for the draw | js/eventos/bi.js:35, 56-58 | test/e2e/bi.spec.js:12 |
| I20 | Login › "Este navegador tem dados da escala (N instrutores e M alunos)…" | `local.ins.length` | ignores | js/sessao.js:53 | — |

### 3. Instructors: whole-roster consumers that are not lists

| # | Consumer | What it does with the roster | Evidence |
|---|---|---|---|
| E1 | Rodízio membership | By habilitação only. `ajustarFilas(filas, instrutores)` is called by the engine (js/engine.js:345, order used at 781-783 and 859), the booking (js/agendamento.js:530), the load (js/storage.js:162), a queue move (js/eventos/rodizio.js:11) and the rotation to a new date, with `cadastro.ins` (`filasDoDiaSeguinte`, js/rodizio.js:34-46; js/dias.js:122; js/storage.js:187-190). Whoever flew goes to the end; an instructor who is off never flies, so he moves towards the front while he is off (inferred from js/rodizio.js:38-44) | as cited |
| E2 | Engine search | The pool is the whole `state.ins` (js/engine.js:588-589); the per-time rule `x.on && cobre(x.aw, a, b)` takes the off ones out (js/viabilidade.js:54). The hours split and the compaction start from `ativos` (js/engine.js:172; js/compactar.js:81). Filters | as cited |
| E3 | A request that chose him (`pedido.insId`, stored per date) | In `ins` and off: rejected, code `instrutor-escolhido`. Not in `ins`: the app chooses, with the warning `escolhido-saiu`; the Demanda shows "Instrutor fora do cadastro (o app escolhe)" | js/engine.js:330-331, 573-583, 993-994; js/instrutor-escolhido.js:33 |
| E4 | A pin with him (`fixos[fKey].insId`) | In `ins` and off: conflict `instrutor-indisponivel`, "o instrutor não está disponível". Not in `ins`: `instrutor-saiu`, "o instrutor saiu do cadastro", and the row says "Instrutor fora do cadastro" | js/engine.js:414, 429-432, 524; js/viabilidade.js:40, 54; js/conflitos.js:37-38 |
| E5 | A student's "Priorizar com" | Ids not in `ins` are skipped; all of them off gives the warning `voa-com`, "Sem o instrutor de “Priorizar com” (…: fora nesta data): o voo ficou com …" | js/engine.js:247, 586, 986 |
| E6 | Yesterday's Noturno return leg | Placed with its instructor without reading `on`; not in `ins`, the row keeps the stored name | js/engine.js:370-393 |
| E7 | Hours for the legal limits | `comHorasExternas(horasBase, estado.ins, data)` runs over every instructor (js/storage.js:202; js/actions.js:96; js/eventos/cadastros.js:169). The base hours come from the saved schedules by `insId`, not from the roster (js/limites.js:55-69; supabase/migrations/20261115151734_repouso_conta_o_atraso.sql:4-43) | as cited |
| E8 | Personal data | Kept only for ids present in `cadastro.ins`: the server deletes the others at every roster save and refuses a save for someone not in it (supabase/migrations/20261114151953_dados_pessoais_versionados.sql:44-51, 164-170; local mode js/dados-pessoais.js:75-79). CPF and CANAC are unique per `tipo` (supabase/migrations/20261113150000_dados_pessoais.sql:48-49), so an instructor who stays in the roster keeps holding his | as cited |
| E9 | History reverts | `setInsOn` and `desfazerAgendamento` change `on` (and `aw`) of any roster instructor | js/eventos/historico.js:74-80; js/reversoes.js:186-189 |
| E10 | CSV, PDF, Excel, Painel and TV, History | Read only the name stored in each schedule row (`o.ins`), never the roster | js/csv.js:48; js/export.js:67, 85; js/planilha.js:173; supabase/migrations/20261120150000_painel_do_dia_com_a_configuracao.sql:65 |

### 4. Resources: every list and picker

`grep -rln "\.frota\b" js/` gives 18 files besides js/engine.js (17 if js/compactar.js, which the engine imports, is
counted with it).

| # | Place (label, element) | What it lists today | Per-date `av` there | Evidence | Test that pins it |
|---|---|---|---|---|---|
| R1 | Recursos › "Disponibilidade do dia", `#revisao` | every `S.frota` resource, in groups C152, C172, PA-34, Simuladores | marks: row class `manutencao`, tag "Em manutenção", the switch off; group header "12 de 13 disponíveis" | js/views/recursos.js:18-24, 38, 64-65, 81-92 | test/e2e/cadastros.spec.js:35, 177 |
| R2 | Recursos › "Cadastro" › Frota, `#frota`; group header "13 recursos" | every resource | ignores | js/views/recursos.js:106-118 | test/e2e/cadastros.spec.js:145, 177 |
| R3 | Recursos › count "26 recursos" / "3 de 26 recursos" | `S.frota.length` | ignores | js/views/recursos.js:123-134 | test/e2e/cadastros.spec.js:478 |
| R4 | Recursos › "Ordem no hangar", `#hangar` | `normalizarHangar(S.hangar, frota)`: every fleet aircraft (C152, C172, PA-34; no simulators). The tab's filters never apply here | marks: tag "manutenção"; position and the three move buttons stay | js/hangar.js:6-13, 19-26; js/views/recursos.js:157-173; js/views/filtros-dos-recursos.js:4-5 | test/unit/hangar.test.js:13, 61; test/e2e/hangar.spec.js:35 |
| R5 | Recursos › "Horários de decolagem" | per category; with a search, a category shows when some `S.frota` resource of it matches | ignores | js/views/filtros-dos-recursos.js:30-31; js/views/horarios.js:119 | test/e2e/cadastros.spec.js:478 |
| R6 | Escala › "Por recurso" map, free rows | every `S.frota` reg plus `SALA-GROUND`, by the Categoria filter, only with no Recurso or search filter | marks: row `tl-manutencao`, label "PR-VOB C152 · 0 h · em manutenção", no "+", inert track. A reg with flights that left the fleet: inert row | js/views/escala.js:156-164, 580-583; css/app.css:1319-1320 | test/e2e/agendamento-mapa.spec.js:204, 218 |
| R7 | "Agendar voo" › "Recurso", `#agd-recurso` | `opcoesDeRecurso`: for each type the mission allows (`MIS[mis].eq`), every fleet resource of the type (`avioesQueServem`) | marks: option disabled, "PP-LJV · C152 — em manutenção". (ran) for a Voo Local: 22 options of C152, C172 and PA-34, the one in maintenance disabled | js/candidatos.js:57, 86-96; js/agendamento.js:493, 511-525; js/views/agendamento.js:49, 85 | the list with the code `aviao-indisponivel`: test/unit/candidatos.test.js:80; the option text "— em manutenção" has no test (grep in test/: none) |
| R8 | "Agendar voo" › alternatives "Recursos livres"; Sugestões "Trocar o avião: …" | only resources with no problem | filters | js/agendamento.js:1002-1003; js/reparo.js:35-36, 58 | test/unit/agendamento.test.js:1104; test/unit/reparo.test.js:41 |
| R9 | Escala › filter "Recurso", `#flt-esc-eq` | only the resources in the date's schedule | neither | js/views/escala.js:567-569, 611-612 | test/e2e/escala-tela.spec.js:154 |
| R10 | BI › tile "n/N Recursos disponíveis" | `frota.filter(f => S.av[f.reg]).length` over `frota.length`, open date's state | n filters, N ignores | js/views/bi.js:127 | the same snapshot line as I17 |
| R11 | BI › "Horas por recurso (dia, semana e mês)" and filter "Recurso", `#bi-flt-eq` | one row per `S.frota` resource plus `SALA-GROUND`, plus every reg found in the saved schedules; tags "Retirado" (not in the fleet), "Manut." (`!S.av`), "Acrobat" (`soParafuso`) | marks | js/views/bi.js:39-41, 81, 100-107, 139-143 | test/e2e/bi.spec.js:37, 58 |
| R12 | BI › "Simular 30 dias" (local mode only) | `matriculasDoTipo(S.frota, …)` | ignores | js/eventos/bi.js:51 | test/e2e/bi.spec.js:12 |
| R13 | Excel (`#xlsx`) | Called with `{ frota: S.frota, av: S.av, … }`. In each block, every fleet resource of the block's types gets a column, plus any reg with a flight; a resource of the template keeps its own column | marks: the two header cells in red; the column stays. (ran) with the 13 template C152 unavailable and a 14th C152 flying, the flight goes to "Fora do modelo (sem coluna na planilha): …": an unavailable aircraft does not release its column, only leaving the fleet does | js/export.js:125; js/planilha.js:87-95, 177, 195, 199, 245-246 | test/unit/planilha.test.js:192, 203, 383 |
| R14 | Instrutores › drawer group "Habilitação própria do recurso" and the options of the Habilitações filter | every fleet resource with `habilitacaoPropria` ("Avião PR-VOM") | ignores | js/views/cadastros.js:176-179, 193, 347-348 | test/e2e/cadastros.spec.js:891 |
| R15 | Demanda › tooltip of "Missão", "Exige … (no PR-JPL)"; the same names in the engine's rejection texts; BI › "Horas por missão", column "Recursos permitidos" | every C152 marked "Só Parafuso". The BI does not read the fleet for this: the text "C152 (PR-JPL) / C172 / PA-34" is written in the code | ignores | js/views/demanda.js:59-60; js/engine.js:262-263, 931, 950; js/views/bi.js:190-192 | test/unit/frota.test.js:107; the BI text is in the snapshot bi-dia.json |
| R16 | Type pickers that never look at the fleet: Demanda "Recurso", the Cursos editor's "Recurso", "+ Novo recurso" "Categoria" | the types the mission allows, or the five types | not applicable; a type with no usable resource is still offered, and the engine rejects with "nenhum <tipo> disponível (todos em manutenção)", the same text when the fleet has none of the type, since the pool is empty (inferred from the condition at js/engine.js:935) | js/views/demanda.js:20-23, 75; js/views/cursos.js:108; index.html:195-197; js/engine.js:935-936 | — |

### 5. Resources: whole-fleet consumers that are not lists

| # | Consumer | What it does with the fleet | Evidence |
|---|---|---|---|
| F1 | Engine free search, registration swap, compaction | Build the pool from `frota`, then ask `av`. Filters | js/engine.js:101, 824, 842; js/compactar.js:143, 152 |
| F2 | A pin on the resource (`fixos[fKey].r`) | Not in `frota`, or another type: conflict `tipo-de-aviao`, "a missão ou o avião do pedido mudou". In `frota` and unavailable: `aviao-indisponivel`, "o avião está indisponível" | js/engine.js:435-437 |
| F3 | The day's `av`, `horas` and `hangar` | `juntar` gives every fleet resource `true` unless the day says otherwise (js/dias.js:90); the normalisation keeps `av` and `horas` only of fleet resources (js/storage.js:112-115); a new date copies `av` and `hangar` and carries `horas` plus the day's flights (js/dias.js:120-122, 127-137) | as cited |
| F4 | Hangar order as an engine input | `normalizarHangar(hangar, frota)` in the engine, the candidates, `juntar`, the load and the move handler: all fleet aircraft; one that leaves the fleet leaves the order, one that enters goes to the back | js/hangar.js:11-12; js/engine.js:275; js/candidatos.js:88; js/dias.js:106; js/storage.js:93; js/eventos/recursos.js:165 |
| F5 | 50 h summary | Every fleet aircraft with numeric `horas` gets `RES.revisao[reg]`; the stop and its warning only when `av !== false`; the badge `#selo-rec` skips `av === false`. An "available" aircraft with under 1 h of balance warns on every date, even with no flight (ran, with 49.5 h): "Aeronave parou para revisão de 50 horas: sem saldo para voar hoje (49,5 h desde a última revisão)." | js/engine.js:1012-1028; js/views/selos.js:26-28 |
| F6 | Yesterday's Noturno return leg | Occupies its aircraft without reading `av` or the fleet | js/engine.js:370-393 |
| F7 | "+ Novo recurso" and the History | A matrícula is unique against the whole fleet: "Já existe um recurso com a matrícula X." (js/frota.js:86; js/eventos/recursos.js:59); the revert `readicionarRecurso` goes through the same check (js/reversoes.js:93-96). `setAv` is valid by pattern and written to `S.av` without looking at the fleet (js/reversoes.js:54-56; js/eventos/historico.js:62-65); `setAtributo` needs the resource in the fleet (js/eventos/historico.js:66-73) | as cited |
| F8 | CSV, PDF, Painel and TV | Only `o.r` of the schedule rows | js/csv.js:48; js/export.js:67, 86 |
| F9 | Server | No SQL reads `frota` or `av` (grep over supabase/migrations: one comment, 20261117200000_cursos_e_missoes.sql:22) | — |

### 6. Measured: what the engine says for each way of telling it (ran)

Scenario with fictitious people: a flight pinned with Instrutor 02 on PR-BTB, and a second request that chose Instrutor 02.

| How the engine is told | The pinned flight | The request that chose him, or the pin on the aircraft |
|---|---|---|
| Instructor kept in `ins` with `on: false` | stays with "Instrutor 02", conflict `instrutor-indisponivel`: "Conflito na escala aprovada: o instrutor não está disponível." | "Rejeitado: o instrutor escolhido (Instrutor 02) não está disponível nesta data." (code `instrutor-escolhido`) |
| Instructor absent from `ins` | row name "Instrutor fora do cadastro", conflict `instrutor-saiu`: "… o instrutor saiu do cadastro." | scheduled with another instructor, warning `escolhido-saiu`: "O instrutor escolhido saiu do cadastro: o voo ficou com Instrutor 01. Escolha outro na Demanda ou deixe no Automático." |
| Aircraft kept in `frota` with `av: false` | — | conflict `aviao-indisponivel`: "… o avião está indisponível." (Sugestões then offers the cancel reason "Manutenção da aeronave", js/reparo.js:113) |
| Aircraft absent from `frota` | — | conflict `tipo-de-aviao`: "… a missão ou o avião do pedido mudou." |

None of these texts is in a golden: the 41 recorded outputs have no `conf` alert and no `escolhido-saiu` warning (their
inputs have no `fixos` and no `insId`; mapa-motor 5.2). The golden texts that mention availability are "nenhum instrutor
ativo…" (27 alerts, 3 files) and "…em manutenção" (3 alerts) (ran: grep).

### 7. Where `S` enters the pure modules

There is no single place where "the engine's state is assembled". The callers that hand `S` to code that iterates
`estado.ins`, `estado.frota` or `estado.av`:

- the engine: js/actions.js:367; js/views/agendamento.js:181 (on `comPesos(S, …)`), 338, 356; js/agendamento.js:960-966
  (`simularAgendamento`, on a clone);
- the list builders: js/views/demanda.js:36 (`instrutoresDoPedido`); js/views/escala.js:354 (`instrutoresDoVoo`);
  js/views/reparo.js:23 (`sugerirReparos`); js/views/agendamento.js:157 (`formularioDoAgendamento`), 185
  (`avaliarAgendamento`); js/views/rodizio.js:9 and js/eventos/rodizio.js:11 (`ajustarFilas`); js/export.js:125 (the Excel);
- the functions that change `S` and must keep receiving the real object: `aplicarAgendamento` (js/eventos/agendamento.js:35;
  it finds the instructor in `estado.ins` and writes `kg`, `on`, `aw`, js/agendamento.js:925-939), `escolherInstrutor`
  (js/eventos/escala.js:181; js/eventos/demanda.js:207), `escolherNosPedidos` (js/eventos/escala.js:284-285), the History
  reverts (js/eventos/historico.js:85, 92, 119);
- the views that read `S.ins`, `S.frota`, `S.av` and `S.hangar` directly: js/views/cadastros.js, js/views/recursos.js,
  js/views/escala.js (133-165, 567, 580-583), js/views/bi.js, js/views/filtros-dos-recursos.js;
- outside the app: scripts/capturar-goldens-motor.mjs, scripts/medir-escalas.mjs:39 and scripts/semear-dias-previa.mjs:61-70
  run the engine on states they generate or join themselves.

## What the maps got wrong or left out

- **mapa-motor 5.4** lists the readers of `on`. The sentence leaves out js/viabilidade.js:54 (it is in the `aw` table
  just above, as `x.on && cobre(…)`), js/views/cadastros.js:84-86 (the row class and the switch) and
  scripts/medir-escalas.mjs:39. It lists js/views/bi.js:44, where `on` is copied into the BI row and never read again.
  It does not list who ignores `on`: rows I2 to I6, I8, I16, I18 to I20 and E1, E6, E7 above.
- **mapa-invas 1** says the "Por instrutor" map's "rows are `S.ins.filter(x => x.on)`" (js/views/escala.js:582). That is
  only the free rows, and only with no filter. Rows with flights exist for any `insId` in the schedule, and their "+"
  for any roster instructor, off or not (js/views/escala.js:133-137, 150).
- **mapa-invas 7, item 6** proposes the inactive instructor "filtered out where the engine's state is assembled". No such
  place exists (section 7 above): `S` goes straight to the engine and to `separar`. The item counts "the list switch and
  filter" as the screen cost and names none of the pickers I4, I5, I7, I9, I10, the Rodízio tab or the BI.
- **mapa-invas 5.8** is right that membership ignores "Vem". It does not say the consequence: an instructor who is off
  moves up the queues, because only those who flew go to the end (E1).
- **mapa-recursos 5.5** is complete for the readers of `av === false` (one more line with the same rule, js/engine.js:951).
  One entry is misleading: "Registration swap, compaction, candidates: excluded". For the candidates that holds in the
  Sugestões only (js/reparo.js:35-36); in the booking dialog the resource is listed, disabled, "— em manutenção" (R7).
  It leaves out the places that ignore `av`: R2, R3, R5, R12, R14, R15, R16, F4 and F7.
- **mapa-recursos 7, S4** (emit `av[reg] = false` for an inactive resource) names the map, the hangar and the Excel as
  views to adapt. It leaves out the booking list (R7), the BI tile and tag (R10, R11), the group headers and counts (R1
  to R3) and the habilitação própria switches (R14); that the Excel column is not released (R13, ran); and fact 2 of
  section 1: written into `S.av`, the value is saved in the day and copied to every new date.
- **mapa-avisos 5.3** computes "recursos disponíveis" and "INVAs disponíveis" from `S.frota`, `S.av` and `S.ins[].on`.
  Both denominators are the whole fleet and the whole roster (R1, R10, I17).
- **mapa-restricoes** (controls table, Escala) puts the "+" "on each row of Por instrutor". It is there only when the
  id is in `S.ins`, and it is there for an instructor who is off on the date (I16).
- **mapa-outras-abas 1.5** is right about the BI. Missing: the instructor table is seeded from the roster and keyed by
  name (I18).
- **The brief of this question** says the Sugestões lists "also show who does not serve". They do not: js/candidatos.js
  returns everyone with the problems, and js/reparo.js keeps only those with none (I13, R8). Only the booking dialog
  shows who does not serve.

## Implications for the plan (suggestions)

Everything below is a suggestion, each with its cost and its risk.

1. **Is there a reason not to give INVAs the switch? None in the code.** The tables give 15 instructor rows that ignore
   or only mark `on` (I1 to I11, I14, I16 to I18, leaving out the local simulation and the login text), plus the rodízio
   membership (E1), against 12 resource rows for `av` (R1 to R7, R10, R11, R13 to R15, leaving out the local simulation
   and the type pickers). The nearest thing today, "Vem" switched off once, already carries to new dates by copy
   (js/dias.js:120-122), but saved dates keep their own value and the instructor stays in every one of those rows.
   *Cost:* the gates. *Risk:* the rodízio (item 4) and the wording (item 8).

2. **Tell the engine and the list builders by absence, not by `on: false` or `av: false`.** One pure function gives a
   derived state where inactive instructors are out of `ins` and inactive resources are out of `frota`, passed at the
   callers of section 7. Nothing else has to change in it: (ran) with `av`, `horas`, `hangar` and `filas` still naming
   the absent aircraft and instructor, the engine ignores them, gives no 50 h warning for the aircraft, and leaves its
   input untouched. Every pure module iterates `estado.ins` or `estado.frota`, so absence gates the "ignores", "marks"
   and "filters" rows of those modules at once: I7, I9 to I13, R7, R8, R13, and E1, F1 and F4 inside the engine and the
   candidates. With `on: false` or `av: false` only the "filters" rows are gated, the "marks" rows mislabel the item
   ("fora nesta data", "indisponível", "Em manutenção", "Manut."), the booking offers "Marcar disponível" for an
   inactive instructor (I10), and the Excel column stays taken (R13). *Cost:* the function, about a dozen call sites,
   their tests; the engine and the goldens are not touched (no golden input has the flag). *Risk:*
   (a) the derived object must never reach `salvarDia`, or the stored per-date `on` and `av` are lost (fact 2); (b) the
   functions that change `S` keep taking `S`; (c) pins and chosen requests of an inactive item read "saiu do cadastro",
   "Instrutor fora do cadastro" and "a missão ou o avião do pedido mudou" (section 6). Those texts are in no golden, so
   a rewording ("saiu do cadastro ou está inativo") changes no golden file, but it is still an engine text change
   (js/conflitos.js:37; js/engine.js:436, 524, 994; js/instrutor-escolhido.js:33).

3. **Decide each place that reads `S` directly.** Suggested defaults: the two master lists show inactive items only
   when the toolbar filter says so, dimmed, and count only the active ones ("12 de 40" needs a rule for the 40). Alunos'
   two selects offer only active instructors; a chip of an inactive one stays, marked. The Rodízio tab follows item 4.
   The BI tile counts active items in both numbers; the BI tables drop zero-hour rows of inactive items and keep rows
   that have hours in the period. The map's free rows skip inactive resources instead of striking them "em manutenção";
   rows with flights stay, inert. The "Habilitação própria" switch of an inactive resource stays, so the pairing
   survives reactivation. *Cost:* one filter per place and the e2e tests of section 2 and 4. *Risk:* a place forgotten
   shows an item that the engine no longer uses; the tables of sections 2 and 4 are the checklist.

4. **Rodízio: ask Pedro, then choose one of two behaviours.** (a) The stored queues keep the inactive instructor and
   only the derived state drops him: on return he is where the rotation left him, usually near the front. (b) The load
   and the tab use the active roster: `ajustarFilas` drops him, the next save of each date writes the queue without
   him, and on return he enters at the end (js/rodizio.js:28-29). *Cost:* small either way. *Risk:* fairness; the queues
   decide who gets the better-paid flights.

5. **Hangar: normalise against the active fleet.** The inactive aircraft leaves the order and returns at the back
   (js/hangar.js:11-12). Hiding it while it stays in the list would make "Subir" and "Descer" swap with a hidden
   neighbour, the reason the tab's filters never apply there (js/views/filtros-dos-recursos.js:4-5). *Cost:* the callers
   of F4 take the active fleet. *Risk:* the position is lost on reactivation; the Manual and the glossary say "sempre
   com todos os aviões" (index.html:518; js/glossario.js:81).

6. **Excel: pass the active fleet.** An inactive aircraft then releases its column to a new one; a reg with a flight
   still gets a column (js/planilha.js:177). *Cost:* one argument at js/export.js:125 and a case next to
   test/unit/planilha.test.js:203. *Risk:* the columns the operator knows shift when an aircraft is deactivated.

7. **Storage: one flag name, one format number, set in the foundation.** `inativo: true` with absent meaning active, on
   `cadastro.ins[]`, `cadastro.frota[]` and, per mapa-alunos 5.5, `cadastro.stu[]`. Add it to the `separar` whitelists
   (js/dias.js:41-47) and to `recurso()` (js/frota.js:62), but not to `ATRIBUTOS_DO_RECURSO`, which also drives the
   attribute editor and the `setAtributo` revert (js/views/recursos.js:96, 101; js/reversoes.js:61). A number-only step,
   as 22 and 25 (js/migracoes.js:176-182, 207-213), makes an older tab refuse the data instead of stripping the field.
   *Cost:* small; tests test/unit/dias.test.js:28, test/unit/atributos.test.js:55-62, test/unit/frota.test.js:28.
   *Risk:* workstreams A, B and C each claiming a number for the same idea.

8. **Wording.** Avoid "ativo" and "inativa" as they stand: "instrutor ativo" already means "Vem" in a golden text, and
   the History says "Janela HH:MM inativa". Texts that describe today's lists and would change: index.html:479 ("todos
   os recursos … e os instrutores disponíveis no dia"), 493, 518, 544; js/glossario.js:81, 88. *Cost:* text and the
   Manual tests. *Risk:* rewording "nenhum instrutor ativo" changes 3 golden files and needs a rule-change commit.

9. **History.** Give the switch an entry with a revert, as `setAv` and `setInsOn` have (js/reversoes.js:54-56, 64).
   *Cost:* one revert kind with its hostile-value tests. *Risk:* the entry is filed in the History of whatever date is
   open (mapa-recursos C10).

10. **Other saved dates.** A saved date shows its saved schedule until its first edit, then recalculates without the
    inactive item and its unpinned flights move (js/actions.js:309; mapa-motor 5.6). That is what deleting an
    instructor or "Retirar" does today. Option: date the flag and keep the item for dates before it. *Cost:* the
    derived state needs the open date. *Risk:* without it, editing a past date after a deactivation rewrites history.

11. **With the switch, restrict "✕ Excluir" for instructors.** Deletion still erases the personal data for good (E8).
    *Cost:* low. *Risk:* a roster that only grows (mapa-invas 7, item 7).

Questions this leaves for Pedro: the rodízio place of an inactive INVA (item 4); whether an inactive aircraft keeps its
hangar position and its Excel column (items 5, 6); whether past dates may change when edited after a deactivation
(item 10); the label of the switch, given what "ativo" already means (item 8); and whether pins and chosen requests of
an inactive item should read "inativo" instead of "saiu do cadastro" (item 2).

<!-- fim -->
