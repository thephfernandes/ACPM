# Mapa: O motor: contrato de entrada, win, aw e os goldens

Worktree read: `/Users/pedrofernandes/ACPM/.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths below are relative to it.
Evidence is `path:line`. "(measured)" = obtained by running node read-only against the worktree, or against a scratch copy outside the repo (nothing in the worktree was changed). "(inferred)" = not proven by a line I read.

## 1. What exists

| Module | Role | Evidence |
|---|---|---|
| `js/engine.js` | `runAllocationEngine(state, opcoes = {})`: pure allocation; also `equalizarHoras`, `manterInstrutorNoMesmoAviao`, `avisosDeLimite`, `sumUniqueOperationalHours`, `consolidateTimelineSlots` | js/engine.js:258, 171, 90, 139, 1054, 1075 |
| `js/viabilidade.js` | The shared feasibility rules: `sobrepoe`, `livre`, `cobre`, `cabeNoSaldo`, `saldoAteARevisao`, `folgaAte`, `problemasDoInstrutor` | js/viabilidade.js:11-71 |
| `js/compactar.js` | Local search after allocation (`compactar`) and the day cost (`custoDaEscala`); the only reader of `state.criterios` | js/compactar.js:63, 75, 64, 77 |
| `js/criterios.js` | The two compaction criteria, their values, labels and default | js/criterios.js:3-20 |
| `js/config.js` | Constants: `WIN`, `NI`, `DAY`, `T`, `MIS`, `NOTURNO`, `DEFAULT_LIM`, `COMBUSTIVEL`, `PESOS_DA_COMPACTACAO`, `LIMITES_DA_COMPACTACAO`, `PRE` | js/config.js:4-8, 51-73, 79-83, 96, 100, 109-116, 118-124 |
| `js/horarios.js` | Take-off times per category, `periodoDoMinuto`, `fimDasMissoesDoDia`, preference ordering | js/horarios.js:13, 33-36, 47-52, 55-59, 98-102 |
| `js/rules.js` | Mission rules, student availability (`jan`), request normalisation, `alvoDoNovoPedido`, `proximoMid` | js/rules.js:19-27, 44-50, 67-72, 95-100, 142-179 |
| `js/noturno.js` | Two-day Noturno: yesterday's nights, `historicoDoDia`, rest before the return leg | js/noturno.js:17-30, 44-52, 64-65 |
| `js/limites.js` | Lei do Aeronauta limits: `normalizarLimites`, `dentroDosLimites`, hours history | js/limites.js:9-18, 21-30, 101-117 |
| `js/combustivel.js` | Weight above the limit flies with less fuel if the rest covers flight + taxi + reserve | js/combustivel.js:8-32 |
| `js/hangar.js` | Hangar order per date | js/hangar.js:9-26 |
| `js/voo.js` | Flight key, status in force, unit (Ground class), occupation of the Noturno return | js/voo.js:4-36 |
| `js/candidatos.js` | Same rules applied to "who serves this flight now" (Sugestões, booking lists) | js/candidatos.js:38-119 |
| `js/conflitos.js` | The code lists: conflicts, warnings, rejections; conflict texts | js/conflitos.js:5-77 |
| `js/escala-gravada.js` | Validator of the saved schedule (`dia.resultado`) | js/escala-gravada.js:28-123 |
| `js/metricas.js` | Metrics for `scripts/medir-escalas.mjs` and the Escala's idle-time box | js/metricas.js:32-64 |
| Goldens | `test/fixtures/goldens-do-motor/`: 42 files = `exemplo-estado.json` (frozen input) + `exemplo.json` + `cenario-01..40.json` | test/helpers/goldens.js:8-12 |

The engine's transitive import closure is 24 modules, all without DOM, clock or randomness (measured with an import walk; grep for `Date`, `Math.random`, `document.`, `window.`, `localStorage` gives 0 hits in every one except `js/format.js`, whose date helpers the engine does not call: js/engine.js:5 imports only `hm`, `fmtH`, `numeroBr`, `duracaoHm`). The closure includes `js/migracoes.js` and `js/escala-gravada.js` through `js/noturno.js:12-13`: a DOM import added to `js/migracoes.js` would break every engine unit test.

Callers of `runAllocationEngine`: js/actions.js:367 (`escalaCalculada`, used by `refazerEscala` 370-380 and by `lerData` 309); js/agendamento.js:960 (`simularAgendamento`, on a copy of the state); js/views/agendamento.js:181, 338, 356 (booking dialog); scripts/capturar-goldens-motor.mjs:14, 18; scripts/medir-escalas.mjs:25; scripts/semear-dias-previa.mjs:69. None passes `opcoes`; `opcoes.compactar`, `opcoes.dividirHoras`, `opcoes.trocarMatriculas` (js/engine.js:255-257, 968-979) are used only by tests.

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

The app state `S` has the engine's shape; `separar` splits it into `cadastro` (all dates) and `dia` (one date), `juntar` rebuilds it (js/dias.js:36-74, 78-112). A new date is a copy of the nearest earlier saved day through `diaParaCopiar` (js/dias.js:118-123; js/storage.js:189-190).

| State path | Stored in | Scope | Writers |
|---|---|---|---|
| `win` (9 booleans) | `dia.win` (js/dias.js:56) | per date; copied to each new date (js/dias.js:120-122) | `aoMudarCampo('win')` js/eventos/recursos.js:115-120; defaults js/dias.js:34, 89, js/storage.js:49, 85; legacy 7-window conversion js/backends/local.js:75 |
| `ins[].on`, `ins[].aw` (9 booleans) | `dia.ins[id] = { on, aw }` (js/dias.js:58) | per date; copied to each new date (js/dias.js:120-122) | see 5.4 |
| `ins[].id`, `nm`, `kg`, `hab`, `lv` (copy only), `horasExternas` | `cadastro.ins` (js/dias.js:41-45) | all dates | js/eventos/cadastros.js:140-181 (nm 148-151, kg 152-156, hab 157-160, ext 161-171), 74-81 (new) |
| `stu[].id`, `nm`, `kg`, `bl`, `voaCom`, `curso` | `cadastro.stu` (js/dias.js:47) | all dates | js/eventos/cadastros.js:189-222, 84-90, 92-109, 111-129 |
| Request fields on `stu[]` and `stu[].extra[]`: `fly`, `mis`, `eq`, `p1`, `p2`, `nb`, `ss`, `pr`, `jan`, `etapa`, `solicitacao`, `insId`, `cursoDaEtapa` (`CAMPOS_DO_PEDIDO`) | `dia.pedidos[stuId]` (js/dias.js:22, 59-62) | per date; a new date starts blank (js/dias.js:121) | Demanda js/eventos/demanda.js:33-48, 94-99, 153-194, 197-273; Agenda import js/agenda.js:107-140; booking js/agendamento.js:905-919; chosen instructor js/instrutor-escolhido.js:107, 143, 169; take-off list change js/eventos/recursos.js:205-211; `limparDemanda` js/fixos.js:95-117; reversals js/reversoes.js:165-190, js/eventos/historico.js:57-58, 103 |
| `av{reg}` | `dia.av` (js/dias.js:57) | per date; copied | js/eventos/recursos.js:122-129, 62 |
| `horas{reg}` | `dia.horas` (js/dias.js:65) | per date; a new date gets `horasDoDiaSeguinte` (js/dias.js:127-137) | js/eventos/recursos.js:131-145, 171-176 |
| `hangar[]` | `dia.hangar` (js/dias.js:67) | per date; copied | js/eventos/recursos.js:162-168 |
| `filas{}` | `dia.filas` (js/dias.js:66) | per date; a new date gets `filasDoDiaSeguinte` (js/rodizio.js:34-46) | js/eventos/rodizio.js:11-18 |
| `fixos{}` | `dia.fixos` (js/dias.js:68) | that date only | js/eventos/escala.js:135, 204, 213, 286; js/agendamento.js:920-923; js/instrutor-escolhido.js; js/eventos/demanda.js:28, 179; js/fixos.js:95-117 |
| `fStatus{}`, `fObs{}` | `dia.fStatus`, `dia.fObs` (js/dias.js:63-64) | that date only | js/eventos/escala.js:124-130 |
| `criterios{ buracos, horarios }` | `dia.criterios` (js/dias.js:70, 109) | per date; copied to each new date (js/dias.js:120-122) | js/eventos/escala.js:222-231 |
| `frota[]` | `cadastro.frota` (js/dias.js:48) | all dates | js/eventos/recursos.js:56-70, 75-90, 149-159 |
| `horarios{}` | `cadastro.horarios` (js/dias.js:49) | all dates | js/eventos/recursos.js:192-216 |
| `limites{}` | `cadastro.limites` (js/dias.js:50) | all dates | js/eventos/cadastros.js:230-246 |
| `horasDosInstrutores{}` | not stored: computed at load | derived | js/storage.js:202; js/actions.js:96; js/eventos/cadastros.js:169 |
| `noturnosDaVespera[]` | not stored: read from yesterday's saved schedule | derived | js/storage.js:200-201; js/noturno.js:17-30 |
| `resultado` (the saved schedule) | `dia.resultado` (js/storage.js:241) | per date | `save()` js/actions.js:166-182 |

Not engine inputs but in the same state: `aprovacao`, `importadas`, `cursos`, `painel`, `nid`, `schemaVer`, `horasBase`, `resultados`, `programa`, `indisponiveis` (js/dias.js:39-53, 69, 71; js/actions.js:305).

Format rules that touch this area: `ESQUEMA = 25` (js/migracoes.js:13); steps keep unknown fields (js/migracoes.js:1-4; README.md:164-167); the server refuses a day or roster in an older format than the stored one (supabase/migrations/20261114143242_formato_e_status_do_dia.sql:22-26, 73-74). `separar` rebuilds `dia.ins[id]` with only `on` and `aw` (js/dias.js:58), so a field a step adds inside `dia.ins[id]` is dropped at the next save unless `separar` is changed too; test/unit/dias.test.js:31-32 and :164 pin the day's key list (with `win`) and `['aw', 'on']`.

## 3. Controls inventory (one table row per control on screen: label | element (id, data-act, data-f, class) | handler (function, file:line) | state read and written | profiles that can use it)

Only the controls that write the inputs this map covers (`win`, `on`, `aw`, `criterios`). The other engine inputs (Demanda columns, `av`, `horas`, hangar, frota, take-off times, limits, Alunos) belong to the other maps.

Who edits: in shared mode `sessao.js` gives the role `operador` to Operador and Administrador and `gestor` plus `ApiClient.readOnly` to everyone else (js/sessao.js:171; js/perfis.js:6); the change and click registries refuse the gestor role (js/eventos/registro.js:24, 41) and `somente-leitura.js` disables the inputs (js/somente-leitura.js:5-9). In local mode the `#role-sel` selector switches Operador and Gestor (js/eventos/topo.js:18).

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| "Janelas de operação": nine switches "06:30 1º" … "16:20 8º", "17:30 noturno" | `#wins` (index.html:167-168) › `label.janela` (`.off` when closed) › `input.sw[type=checkbox][data-a="win"][data-i="0..8"]` (js/views/recursos.js:146) | `aoMudarCampo('win', …)` js/eventos/recursos.js:115-120: `S.win[idx] = t.checked`, `gravarAlteracao('inc' or 'exc', 'Janela HH:MM ativa' or 'inativa')`, `rRec()` | reads and writes `S.win`; History entry without a revert action (no `setWin` kind exists) | Operador, Administrador |
| "Vem" (column of the Instrutores day grid) | `#inst-dia tr[data-k="i"][data-id]` › `input.sw[data-f="on"]`, aria-label "<nome> vem no dia" (js/views/cadastros.js:84-86) | `aoMudarCampo('i', …)` js/eventos/cadastros.js:140-147 | writes `x.on`; History "<nome>: Disponível" or "Indisponível" with revert `setInsOn` | Operador, Administrador |
| Window cells of the Instrutores day grid (header = the nine `WIN` times) | `td.jan` › `label.cel` (`.on` available, `.voo` has a flight in that window) › `input[type=checkbox][data-f="aw"][data-w="0..8"]`, aria-label "<nome> às HH:MM" (js/views/cadastros.js:80-83, 123) | same handler, js/eventos/cadastros.js:173-174: `x.aw[+t.dataset.w] = t.checked` | writes `x.aw[w]`; saved with no History entry (`gravarAlteracao()` with no description: js/eventos/cadastros.js:179-181; js/actions.js:186-187) | Operador, Administrador |
| "Aplicar turno…" with the options "Dia inteiro", "Manhã", "Tarde", "Noturno", "Dia + noturno" | `select.edit-only[data-f="pre"]`, aria-label "Aplicar um turno a <nome>" (js/views/cadastros.js:90) | same handler, js/eventos/cadastros.js:175-177: `x.aw = WIN.map((_, i) => PRE[t.value].includes(i))` | writes the whole `x.aw`; no History entry | Operador, Administrador |
| "Marcar <nome> disponível às HH:MM" (booking dialog, offered on the blocker `instrutor-indisponivel`) | `button.btn.quiet[data-agd-opcao="disponibilizar"]` (js/views/agendamento.js:110; js/agendamento.js:1098) | `escolherOpcao` js/views/agendamento.js:241-255; applied by `aplicarAgendamento` js/agendamento.js:934-939 | on confirm: `x.on = true` and every window the flight touches turned on; "↶ Desfazer" restores `{ on, aw }` (js/reversoes.js:186-188) | Operador, Administrador |
| "Buracos" with "INVA", "Avião", "Maior buraco" (plus the "?" tip) | `#compactacao` › `#criterios` (index.html:366-367) › `span.seg[role=group][aria-label="Buracos"]` › `button[data-criterio="buracos"][data-valor="inva" or "aviao" or "maior"]`, `aria-pressed`; tip `button.dica-btn[data-dica="buracos"]` (js/views/escala.js:396-408) | document click listener js/eventos/escala.js:222-231 | reads and writes `S.criterios.buracos`; History "Compactação: buracos X → Y", no revert | Operador, Administrador; `aria-disabled` for the Gestor and while `S.aprovacao` (js/views/escala.js:401, 406; js/eventos/escala.js:224) |
| "Horários" with "Na disponibilidade", "Só 1ª e 2ª", "Não mudar" (plus the "?" tip) | same bar › `button[data-criterio="horarios"][data-valor="disponibilidade" or "preferencias" or "fixos"]`; tip `data-dica="horarios"` | same listener | reads and writes `S.criterios.horarios`; History "Compactação: horários X → Y" | same |

Readers of `win` on screen that are not controls: the "Horários de decolagem" summary strikes through the times that fall in a closed window, class `hr fechado`, tip `horario-em-janela-fechada` (js/views/horarios.js:39-47); the booking dialog's time list (js/agendamento.js:104-108).

## 4. Rules and the tests that pin them (file and test name)

| Rule | Test |
|---|---|
| The 41 approved schedules stay exactly as recorded | test/unit/engine.golden.test.js: 'cenário de exemplo mantém a escala aprovada', 'cenário aleatório #N mantém a escala aprovada' (40), 'os goldens são os arquivos esperados, cada um no formato de revisão (um voo por linha)' |
| Pure and deterministic | test/unit/engine.invariants.test.js: 'é determinístico e não altera o estado recebido (também com as escolhas do operador)' (241), 'é determinístico, não altera o estado recebido, e a escala gravada aceita a escala inteira' (522) |
| Every flying request is placed or rejected with a listed code | test/unit/engine.invariants.test.js: 'toda missão marcada é alocada ou recebe um alerta de rejeição' (63), 'toda rejeição tem um código da lista' (59) |
| A closed window takes no start | test/unit/engine.rules.test.js: 'não usa janelas de operação desativadas' (127), 'é rejeitado com a janela noturna desativada' (446), 'sem nenhum período do dia aberto, não há horário para a aula' (553), 'é rejeitado quando a sala está ocupada em todos os horários possíveis' (497), 'sem horário possível na disponibilidade, o pedido é rejeitado dizendo por quê' (341); test/unit/horarios.test.js: 'a janela de operação fechada fecha os horários da categoria que caem nela' (72); test/unit/engine.invariants.test.js: 'horários da categoria em períodos habilitados, Noturno às 17:30, voo de dia no avião até 17:30 (simulador e Ground até o fim do dia)' (135) |
| A pinned flight in a period closed afterwards becomes a conflict | test/unit/fixos.test.js: 'o período fechado nesta data e fora da disponibilidade do aluno' (132); Sugestões skip closed windows: test/unit/reparo-horario.test.js:54, 73, test/unit/reparo.test.js:126 |
| Booking: closed windows are not offered; a typed time in one is the blocker `horario-fechado`; the Noturno with the night closed has no time | test/unit/agendamento.test.js:68-70, 394-398, 621-622 |
| Instructor available during the whole flight | test/unit/viabilidade.test.js: 'o instrutor cobre o voo quando está disponível em todos os períodos que o voo toca' (22), 'fora do cadastro, inativo ou sem disponibilidade em todo o voo' (64); test/unit/engine.rules.test.js: 'respeita a disponibilidade do instrutor' (120), 'o simulador que passa das 17:30 precisa do instrutor disponível na noite' (62), 'o voo é rejeitado quando o Ground pré-requisito não pode ser alocado' (524); test/unit/engine.invariants.test.js: 'instrutor ativo, habilitado para a missão no equipamento (com o curso do aluno e a habilitação própria do avião), disponível em todo o período e não bloqueado' (98) |
| Hours split and compaction respect availability | test/unit/equalizar.test.js: 'não move um voo para quem não pode recebê-lo: sem a habilitação, fora da disponibilidade ou bloqueado pelo aluno' (30); test/unit/compactar.test.js: 'passa o voo para o instrutor que já voa ao lado dele, sem piorar a divisão das horas' (116), 'usa os limites do estado' (249) |
| Booking can make the instructor available, and undo restores it | test/unit/agendamento.test.js:554-563; test/unit/reversoes.test.js:219-221, 231-239 (a reversal's `aw` must have exactly 9 booleans) |
| Criteria: default, each value, cost never rises | test/unit/compactar.test.js: 'o padrão: os buracos dos INVAs, dentro da disponibilidade; valor inválido volta ao padrão' (32), 'dentro da disponibilidade: o voo da tarde vem para logo depois do primeiro; o horário fica "ajustado"' (44), 'só entre a 1ª e a 2ª preferência: vai para a 2ª, mais perto; sem a 2ª, fica' (55), 'sem mudar os horários: o voo fica onde a escala pôs' (61), 'INVA x Maior buraco: com o mesmo tempo parado, o maior buraco divide o buraco; o INVA deixa na 1ª preferência' (96), 'INVA x Avião: cada instrutor com um voo, no mesmo avião, às 06:30 e às 13:40; só o critério do avião aproxima os voos' (104), 'o custo do critério escolhido nunca aumenta' (178), 'os horários respeitam a regra escolhida e a disponibilidade de cada aluno' (182), 'em média, o critério escolhido é o que mais reduz o que ele mede' (239) |
| Criteria, availability and windows travel with the day and to the next date | test/unit/dias.test.js: 'os critérios da compactação vão e voltam com o dia; sem eles, os do padrão' (110), 'copia do dia anterior a disponibilidade, sem a demanda (zerada a cada dia), sem status dos voos nem escala gerada' (156), 'dia vazio: instrutores disponíveis em todas as janelas, alunos sem missão, frota toda disponível' (37), 'juntar(separar(estado)) devolve o mesmo estado em 300 cenários e no exemplo' (17) |
| Saved schedule accepted only in the engine's format | test/unit/escala-gravada.test.js: 'as escalas do motor passam inteiras (o dia de exemplo e as 40 geradas), com a data' (17), 'um campo adulterado em qualquer linha invalida a escala gravada' (72), 'alertas, total, revisão e data também no formato; os campos desconhecidos saem' (86) |
| Order of placement | test/unit/engine.rules.test.js: 'maior prioridade escolhe o horário primeiro' (38), describe 'A ordem dos agendamentos' (287-303), describe 'Rodízio' (388-412), 'precede o voo da mesma temática e é antecipado para liberar a Pref. 1 do voo' (512); test/unit/fixos.test.js: 'com a escala fixada, pedidos novos de prioridade máxima nunca mexem num voo fixo' (304); test/unit/engine.invariants.test.js: describe 'Voos agendados num dia aprovado, em 150 cenários' (431) |
| Legacy 7-window data converts to 9 | test/unit/storage.test.js:148-156 |
| End-to-end snapshots that follow the engine's output through the screen | test/e2e/escala.spec.js:13, 19, 28, 42, 49, 61 and test/e2e/bi.spec.js:18, 24, 28 (9 files in test/e2e/__snapshots__) |

## 5. Answers

### 5.1 The engine's input contract and output

Required versus optional was checked by running the engine in node on a minimal state (measured): `state.win` and `state.av` are read without a guard and the engine throws without them as soon as a request is processed; an instructor without `aw` throws; a student without `bl` throws when a Ground mission is requested (js/engine.js:645, 656, 658, 665); everything else has a default.

**Student request** (the main request lives on the student object itself, mid 0: js/engine.js:293-295; the others in `stu[].extra[]`: js/engine.js:296-302)

| Path | Read at | Meaning |
|---|---|---|
| `fly` | js/engine.js:293, 298; js/horarios.js:48 | truthy puts the request in the queue; also "this student has a Noturno in the day's demand" |
| `extra[].mid` | js/engine.js:299 | mission number; the flight key is `chaveDoVoo(stuId, mid)` = `` `${stuId}_${mid}_1` `` (js/voo.js:5), which keys `fixos`, `fStatus`, `fObs`, the results and `out[].fKey` |
| `mis` | js/engine.js:307, 334, 411, 559, 604, 658, 776-781, 786 | a key of `MIS` (js/config.js:51-73); an unknown name uses the 'Voo Local' rule (js/engine.js:559) |
| `eq` | js/engine.js:417-418, 436, 440, 574, 773, 786, 811, 823, 831, 848 | resource type; outside `MIS[mis].eq` the request is rejected `equipamento-da-missao` (786-794); ignored for Ground (417, 574) |
| `p1`, `p2` | js/engine.js:516, 567, 609; js/compactar.js:56-57, 108, 297 | 1ª and 2ª preferência in minutes, −1 for none; integers 0 to 8 are read as window indexes (js/horarios.js:62). The goldens use the indexes |
| `nb` | js/engine.js:133, 775 | hours; ignored for Ground (90 min) and for a mission with `duracaoFixaH` (the Noturno, 4 h: js/rules.js:79-80; js/config.js:66); invalid gives 1 h (js/rules.js:124-128) |
| `pr` | js/engine.js:337; js/compactar.js:57 | priority 1 to 5, higher first; weight of a lost preference in the compaction cost |
| `jan` | js/engine.js:447, 564, 752, 940; js/compactar.js:107 | student availability 'manha', 'tarde', 'noite' or 'h<minuto>' (js/rules.js:12-27): limits the start minute only |
| `insId` | js/engine.js:331, 528, 573-583, 993 | instructor chosen by the operator for the request |
| `solicitacao` | js/engine.js:328 | pedido id: the earlier id goes first within the same priority; a request without one goes after |
| `etapa` | js/engine.js:523, 731, 902 | course mission code, copied to the row |
| not read | — | `ss` (the row's `ss` is the literal '1/1': js/engine.js:522, 729, 901) and `cursoDaEtapa` |

**Student** (roster)

| Path | Read at | Meaning |
|---|---|---|
| order of `stu[]` | js/engine.js:292-294, 337, 388, 1047 | `stuOrder`: last tie-break of the queue, the row's `o`, and the final sort |
| `id`, `nm` | js/engine.js:266, 294, 389, 410, 522, 560 | key; row `s` and alert label |
| `kg` | js/engine.js:386, 429, 473, 525-526, 733, 831, 848, 857, 904-908, 921 | weight; 0 or missing means "not informed" (warning `sem-peso`) |
| `bl` | js/engine.js:250, 579, 645, 656-658, 665; js/viabilidade.js:59 | "Não escalar com": instructor ids |
| `voaCom` | js/engine.js:332, 586 | "Priorizar com": instructor ids |
| `curso` | js/engine.js:266, 248, 429, 440, 578, 779, 823, 848, 937, 202; js/compactar.js:140 | course sigla: the Noturno of the PC is IFR (js/config.js:66; js/frota.js:31-36; js/habilitacoes.js:93-95) |
| `extra` | js/engine.js:296; js/horarios.js:48; js/voo.js:26 | the other requests of the day |

**Instructor**

| Path | Read at | Meaning |
|---|---|---|
| order of `ins[]` | js/engine.js:588-589, 172 | pool order; ties of the stable sorts |
| `id`, `nm` | throughout; js/engine.js:153, 228, 524, 575, 592, 732, 903, 923 | key; row `ins`, texts |
| `on` | js/engine.js:172, 247-250, 577, 746, 937; js/viabilidade.js:54; js/compactar.js:81 | comes on this date ("Vem") |
| `aw` | js/viabilidade.js:54 through `cobre` (17) and nowhere else in the engine's closure | one boolean per fixed window |
| `hab` | js/engine.js:22; js/habilitacoes.js:100-103; js/frota.js:54; js/rodizio.js:9-11 | habilitações, including `aviao:<matrícula>` |
| `kg` | js/engine.js:229-230, 386, 473, 525-526, 734, 831, 857, 905-908, 921; js/viabilidade.js:44-45; js/compactar.js:242-243 | weight |
| not read | — | `lv`, `horasExternas` (already summed into `horasDosInstrutores` at load: js/storage.js:202; js/limites.js:72-86) |

**Resource**

| Path | Read at | Meaning |
|---|---|---|
| `frota[]` and its order | js/engine.js:261; js/frota.js:57, 74-76; js/hangar.js:9-13 | not an array: `FROTA_INICIAL`. The goldens have no `frota` |
| `frota[].reg`, `tipo` | js/frota.js:43, 75, 78; js/engine.js:435-436, 933, 951, 1013 | registration and type |
| `frota[].soParafuso` | js/frota.js:44, 75; js/engine.js:262 | C152 that flies only Parafuso |
| `frota[].soVfr` | js/frota.js:45 | no IFR flight |
| `frota[].habilitacaoPropria` | js/frota.js:52-54 | requires `aviao:<reg>` from the instructor |
| `av[reg]` | js/engine.js:101, 437, 842, 929, 933, 935, 951, 1018; js/compactar.js:143 | available on this date |
| `horas[reg]` | js/engine.js:349-350, 1012-1020; js/viabilidade.js:23 | hours flown since the last 50 h inspection at the start of the day; not a number: no control |
| `hangar[]` | js/engine.js:275-276; js/hangar.js:9-16 | front-to-back order |

**The day's settings**

| Path | Read at | Meaning |
|---|---|---|
| `win[0..8]` | js/engine.js:446, 601, 811; js/compactar.js:111 | open operation windows |
| `filas{ cheque, mlte, noturno, c172 }` | js/engine.js:345; js/rodizio.js:24-31 | rodízio queues at the start of the day |
| `fixos[fKey]` | js/engine.js:354-359, 399-413, 687 | pins: `a`, `b`, `r`, `insId` (412), `classKey` (413, 687), `agendado` (399, 450, 530, 533). `escolhido` is not read by the engine |
| `fStatus[fKey]` | js/engine.js:95, 99-100, 181-186, 372, 415, 739, 911, 999, 1049; js/noturno.js:47 | status in force |
| `fObs[fKey].novoInicio` | js/engine.js:100, 184, 379, 416, 1015, 1049; js/status.js:106-109 | new take-off of a delayed flight |
| `criterios` | js/compactar.js:64, 77 | see 5.5 |

**The roster's settings**: `horarios` (js/engine.js:273; js/compactar.js:80; missing: `HORARIOS_INICIAIS`, js/horarios.js:13), `limites` (js/engine.js:279; js/limites.js:21-30; missing: `LIMITES_DA_LEI`).

**Computed at load, not stored**: `horasDosInstrutores[id] = { mes, semestre, ano, fimAnterior, fimDoNoturno }` (js/noturno.js:45-51 through js/engine.js:281; js/engine.js:147-150, 1000-1002; js/limites.js:108-115); `noturnosDaVespera[] = { stuId, mid, insId, r, eqType, s, ins, stuKg, fim }` (js/engine.js:370-393; js/noturno.js:24-29).

The engine reads no personal data (CPF, CANAC, nascimento, celular, e-mail): only `nm` and `kg`.

**Output** `{ out, al, tot, revisao }` (js/engine.js:1050; the header comment at js/engine.js:2 omits `revisao`). `escalaCalculada` adds `data` (js/actions.js:367).

- `out[]`, one row per student per flight, sorted by `a`, Ground first, then `o` (js/engine.js:1047). Fields: `fKey`, `classKey`, `isGround`, `w` (period index), `a`, `b`, `o`, `stuId`, `mid`, `insId`, `eqType`, `s`, `mis`, `h`, `ss`, `r`, `ins`, `stuKg`, `insKg`, `limKg`, `kg`, `baseTag`, `tag`, `status`, and when they apply `etapa`, `comb { reduzirGal, abastecerGal, minimoGal, autonomiaMin }`, `fixo`, `insEscolhido`, `insPar`, `agendado`, `trecho: 'volta'`, `livreAs`, `conflito[]`, `conflitoCodigos[]`, `groupSize` (js/engine.js:387-392, 518-532, 718-741, 891-913, 1039-1044; the same list is `CAMPOS` in js/escala-gravada.js:28-68). `baseTag` is 'Pref. 1', 'Pref. 2', 'Próximo livre' or, after compaction, 'Horário ajustado' (js/compactar.js:297).
- `al[]`: `{ t, s, m, codigo?, fKey?, stuId?, insId? }` with `t` = 'err' (left out), 'warn', 'conf' (conflict of a pinned flight; no `codigo`, the codes are on the row).
- `tot`: number of requests marked to fly (`act.length`); placed + rejected = `tot` (test/unit/engine.invariants.test.js:63-68). The Noturno return rows are not requests.
- `revisao[reg] = { inicio, voadas, fim, paraAs }` for each aircraft with numeric `horas` that is in the fleet (js/engine.js:1011-1030).
- What was left out is only the `err` alerts. They carry `s` (the label "Nome" or "Nome (Missão)"), `m` and `codigo`, and **no `stuId`, `mid` or `fKey`** (js/engine.js:581, 765, 787-792, 800-805, 964). The app matches a rejection to its request by the label text (js/agendamento.js:235, 1032).

Rejection codes (`CODIGOS_DE_REJEICAO`, 21: js/conflitos.js:72-77) and where each is raised: `instrutor-escolhido` js/engine.js:581; Ground branch 747-765: `sem-instrutor-habilitado`, `ground-antes-do-voo-fixo`, `disponibilidade-do-aluno`, `sem-horario`, `aluno-ocupado`, `sala-ocupada`, `instrutores-indisponiveis`, `instrutores-ocupados`, `bloqueio`, `limite-da-lei`; flight branch: `equipamento-da-missao` 791, `ground-pendente` 804, `so-parafuso` 930, `sem-aviao` 934, 936, `sem-instrutor-habilitado` 938, `disponibilidade-do-aluno` 940, `depois-do-ground` 943, `sem-horario` 944, `aluno-ocupado` 948, `avioes-ocupados` 949, `revisao` 954, `instrutores-indisponiveis` 955, `instrutores-ocupados` 956, `bloqueio` 957, `limite-da-lei` 958, `limite-de-locais` 959, `peso` 960, `habilitacao-do-aviao` 961.

Warning codes (`CODIGOS_DE_AVISO`, 11: js/conflitos.js:63, 69): `sem-peso` js/engine.js:475, 924; `perto-do-limite` 153; `revisao` 1027; `atraso` js/status.js:148; `voa-com` js/engine.js:986; `escolhido-saiu` 994; `repouso-do-noturno` 1005; for booked flights `fora-dos-horarios` 456, `depois-das-17h30` 464, `limite-de-locais` 470, `antes-do-ground` 543.

Conflict codes (`GRUPO_DO_CONFLITO`, 19: js/conflitos.js:5-25), raised when a pinned flight is checked again: from `problemasDoInstrutor(..., todos: true)` js/engine.js:429-432: `instrutor-saiu`, `instrutor-indisponivel`, `habilitacao`, `instrutor-ocupado`, `bloqueio`, `limite-da-lei`, `peso`; `ground-ou-voo` 433; `tipo-de-aviao` 436; `aviao-indisponivel` 437; `aviao-ocupado` 438; `so-parafuso` 441; `so-vfr` 442; `revisao` 443; `sala-ocupada` 444; `aluno-ocupado` 445; `horario-fechado` 446; `disponibilidade` 448; `duracao` 449. The alert text is "Conflito no voo agendado: …" or "Conflito na escala aprovada: …" (js/engine.js:533).

### 5.2 The goldens

- **Files**: 42 in `test/fixtures/goldens-do-motor/`: `cenario-01.json` to `cenario-40.json`, `exemplo.json` (41 recorded outputs) and `exemplo-estado.json`, the frozen input of the example, never re-recorded (test/helpers/goldens.js:8-12; scripts/capturar-goldens-motor.mjs:3; README.md:50-53). Each scenario file is `{ seed, hash, out, al, tot, revisao }`, one flight per line with `a, b, r, s, ins, mis, status` first (test/helpers/goldens.js:15-38).
- **The test** (test/unit/engine.golden.test.js:14-32; 42 tests pass, measured): the example state must give `exemplo.json`; for each seed `hashEstado(gerarCenario(seed))` must equal the recorded `hash` (sha256 of `JSON.stringify(estado)`, 16 hex: test/helpers/cenarios.js:94) and the engine's output must deep-equal the file; the folder must hold exactly `ARQUIVOS` and each file must equal its own re-formatting. The states go straight into the engine: no `juntar`, no `normalizeAndMigrateState`, no migration step.
- **The generator** `gerarCenario(seed)` (test/helpers/cenarios.js:37-92, `mulberry32`): 6 to 40 instructors with `on` (10% off), `lv` 1 to 9 turned into `hab` by `habilitacoesDoNivel` from `js/habilitacoes.js` (cenarios.js:6, 51), `kg` (5% zero), `aw` (each window 15% false); 4 to 30 students with `kg` (8% zero), `bl` (4% per instructor), a main request and, 30% of the time, 1 or 2 `extra`; each request has `fly` (15% false), `mis` among 12 missions (no cheque, no TGL), `eq` (5% incompatible on purpose), `p1` and `p2` as **window indexes** −1 to 8, `nb` 1 to 4, `ss: 1`, `pr` 1 to 5; `fStatus` for 10% of the main requests; `win` (each window 8% closed); `av` (each resource 15% off).
- **What the 41 inputs vary** (measured over the 41 states): top-level keys are only `schemaVer`, `win`, `av`, `nid`, `ins`, `stu`, `fStatus` (plus the legacy `lim` in the example). `win`: 22 of 41 inputs have a closed window (27 closed in all; 3 inputs close the night). `aw`: 709 of 936 instructors have some window off (118 with the night off); `on` false: 91. `fStatus`: Pendente 27, Confirmado 11, Em Voo 15, Cancelado 17, all on mid 0 and without a pin.
- **What they do not vary**: `criterios` (always the default `inva` / `disponibilidade`), `fixos` (no pinned flight), `insId` (no chosen instructor), `voaCom`, `jan`, `solicitacao`, `etapa`, `curso`, `frota` (so `FROTA_INICIAL`: PR-VOM requires `aviao:PR-VOM`, which no generated instructor has, so PR-VOM never flies in a golden), `horarios` (so `HORARIOS_INICIAIS`: no start before 06:30), `hangar`, `horas`, `limites`, `filas`, `fObs`, `noturnosDaVespera`, `horasDosInstrutores`. Those are covered by the invariants with other generators (`comEscolhas`, `comAtributos`, `comVolta`: test/helpers/cenarios.js:100-155; `comAgendados`: test/unit/engine.invariants.test.js:437-468) and by test/unit/compactar.test.js:152-157 for the nine criteria combinations, never by the goldens.
- **What the outputs contain** (measured): 749 flight rows, 174 `err`, 36 `warn` (all `sem-peso`), no `conf`; 43 rows moved by the compaction ('Horário ajustado'). The alert texts `m` are recorded, including a screen name: `cenario-06.json` has 7 alerts ending "(marque em Instrutores › Cadastro)" (js/engine.js:961) and 3 golden alerts quote "“Não escalar com”" (js/engine.js:957).
- **Recording again**: `node scripts/capturar-goldens-motor.mjs` rewrites `exemplo.json` and the 40 scenario files (scripts/capturar-goldens-motor.mjs:13-21); before it, `node scripts/medir-escalas.mjs [buracos] [horários]` prints the before and after table for the PR (scripts/medir-escalas.mjs:1-5). Four commits touch the folder; the last is `105cfc0`, the two-day Noturno (git log on the folder).

**Changes that keep the goldens byte-identical**
- Anything outside the engine's 24-module closure and outside `gerarCenario`: views, events, `js/dias.js`, `js/storage.js`, a new module that assembles the state, the database.
- New state fields the engine does not read, as long as they are not added to the generated state.
- A new rule that only acts on an input the goldens do not have (`fixos`, `insId`, `voaCom`, `frota`, `horas`, `filas`, `criterios`, `jan`…), when the absent input keeps the old behaviour.
- Reading availability as ranges, with `cobre` answering the same for every flight (see 5.4; measured: 0 of 41 change).

**Changes that alter them**
- Any change to `gerarCenario`'s output, including a new key, and any change to what `habilitacoesDoNivel` returns (ids or their order in `HABILITACOES`): the 40 hashes fail with 'o gerador de cenários mudou: recapture os goldens' (test/unit/engine.golden.test.js:21).
- A new or renamed field on rows or alerts; any alert text, including "Instrutores › Cadastro", the habilitação names used by `descreverExigencias` (js/habilitacoes.js:10-33, 108) and mission names.
- The constants the engine reads: `WIN`, `MIS`, `DEFAULT_LIM`, `COMBUSTIVEL`, `PESOS_DA_COMPACTACAO`, `LIMITES_DA_COMPACTACAO`, `LIMITES_DA_LEI`, `HORARIOS_INICIAIS`, `FROTA_INICIAL` and its attributes.
- The engine no longer honouring `win`: 18 of 41 files change, 147 flight rows (measured on a scratch copy).
- Availability limiting only the start: 37 of 41 files change, 314 flight rows (measured on a scratch copy).

### 5.3 `state.win` (Janelas de operação)

**Shape**: array of 9 booleans, index = window of `WIN = ['06:30','08:20','10:10','11:30','12:40','13:40','14:30','16:20','17:30']` (js/config.js:4); normalised to exactly 9, anything but `false` is open (js/storage.js:85). Stored per date and copied to each new date (js/dias.js:56, 89, 120-122), so a closed window stays closed on the following new dates until reopened.

**Every reader and writer**

| Where | What it does |
|---|---|
| js/engine.js:446 | a pinned flight whose start falls in a closed window gets the conflict `horario-fechado`, "o horário está fechado nesta data" |
| js/engine.js:601 | Ground: a class may start only at the day windows that are open |
| js/engine.js:811 | flights and simulator: a take-off time is a candidate only if its period is open |
| js/compactar.js:111 | the compaction never moves a flight to a start in a closed window |
| js/reparo.js:89 | Sugestões, "Passar para as HH:MM": skips closed windows |
| js/agendamento.js:107 | booking dialog: times in a closed window are not offered (the only reader that tolerates a missing `win`) |
| js/views/horarios.js:39-47 | "Horários de decolagem": the time in a closed window is struck through, tip `horario-em-janela-fechada` |
| js/views/recursos.js:146 | draws the nine switches in `#wins` |
| js/eventos/recursos.js:115-120 | the only writer on screen |
| js/eventos/registro.js:31 | comment listing `data-a` 'win' |
| js/dias.js:34, 56, 89, 120-122 | default, save, load, copy to the next date |
| js/storage.js:49, 85 | fresh state and normalisation |
| js/backends/local.js:75 | legacy `acpm2` conversion from 7 to 9 windows |
| index.html:167-168, 207, 446, 510, 514-515; js/glossario.js:73-74; js/manual.js:43; js/views/manual.js:11; css/app.css:239, 784-791, 1594 | markup, Manual text and its generated list `#manual-janelas`, glossary terms `janelas` and `horario-em-janela-fechada`, styles |
| scripts | none directly; `scripts/semear-dias-previa.mjs:61-70` and `scripts/semear-previa.mjs:23` write it through `juntar`, `separar`, `estadoSintetico` |
| supabase | none (grep over migrations and tests) |
| Unit tests | test/helpers/cenarios.js:85; test/helpers/montar.js:24, 31 (`janelasOff`); test/helpers/estado.js:36; test/fixtures/goldens-do-motor/exemplo-estado.json:3; test/unit/engine.rules.test.js:74, 128, 342, 447, 501, 549, 554; test/unit/engine.invariants.test.js:137, 332; test/unit/horarios.test.js:73; test/unit/fixos.test.js:134; test/unit/reparo.test.js:126; test/unit/reparo-horario.test.js:54, 73; test/unit/agendamento.test.js:68, 394, 621, 983; test/unit/dias.test.js:31, 44, 150, 164; test/unit/migracoes.test.js:14, 27; test/unit/storage.test.js:19, 78, 148, 155; test/unit/storage-dias.test.js:373; test/unit/frota.test.js:66; test/unit/manual.test.js:36 |
| E2E tests | test/e2e/fixtures.js:65: `abrir` waits for `#wins input[data-a="win"]` as the sign that the app is ready, and every spec opens through it; the same wait at test/e2e/cadastros.spec.js:1323, contas.spec.js:175, datas-compartilhado.spec.js:203, cursos.spec.js:820, 1198, 1527, cursos-no-dia.spec.js:45, historico.spec.js:15, seguranca.spec.js:94; behaviour at test/e2e/cadastros.spec.js:10-11, 259, 445; test/e2e/app.spec.js:133 |

**What a closed window does, per mission type**

| Mission | Start times considered | Effect of a closed window |
|---|---|---|
| Aircraft flights | the category list, `horariosDoTipo` (js/horarios.js:33-36, 52) | the starts whose period is closed drop out (js/engine.js:811). Only the start is checked: a 2 h flight at 06:30 with the 08:20 window closed is still placed 06:30 to 08:30 (measured) |
| Voo Solo | only 06:30 (js/horarios.js:40, 52) | window 0 closed: no start, rejection |
| Simulador | the `sim` list | as flights; it may run through a closed window and past 17:30 |
| Ground School | the 8 day windows `DAY.map(w => T[w])`; the take-off lists do not apply | a class cannot start at a closed window (js/engine.js:601); it may run into one; joining an existing pinned class is not checked against `win` (js/engine.js:632-650) |
| Noturno | only 17:30 (js/horarios.js:52) | window 8 closed: rejection `sem-horario`, "nenhum horário aberto comporta 4 h a partir das 17:30" (js/engine.js:944; test/unit/engine.rules.test.js:446-452) |
| Yesterday's Noturno return, 07:30 | fixed | not affected (js/engine.js:370-393 never reads `win`) |
| Any pinned flight (approved, by status, chosen in the Escala, booked) | the pin's `a` | conflict `horario-fechado` (js/engine.js:446); the flight stays |

With no start left the rejection is `disponibilidade-do-aluno` when the request has `jan`, `depois-do-ground`, or `sem-horario` (js/engine.js:750-753, 939-944).

**Interaction with `js/horarios.js`**: `win` is a per-date mask over the roster-level lists. For each candidate start `m` the engine asks `state.win[periodoDoMinuto(m)]`, and `periodoDoMinuto` is the last window that begins at or before `m` (js/horarios.js:55-59; a 06:00 start counts in window 0). The default lists of C152, C172 and the simulators are the 8 day windows themselves (js/horarios.js:10, 13), so there one window is one start; the PA-34 leaves every 30 minutes, so one window covers several starts. The lists are for all dates and editing one adjusts the stored preferences of that category's requests (js/eventos/recursos.js:192-216); Ground, the Noturno and the Voo Solo have no list.

**What is lost if `win` is removed, and what could replace it**

| Lost behaviour | Evidence | Possible replacement |
|---|---|---|
| Closing a period on one date for every category at once | js/engine.js:811 | an operator restriction of the date; or nothing |
| Closing a Ground start time on one date (no other control does it) | js/engine.js:601; js/horarios.js:31-36 | the same restriction; or nothing |
| Switching the Noturno off on one date ("17:30 noturno") | js/engine.js:811, 944 | the same restriction; otherwise only by not approving the pedido, or by the C172s or the instructors' night availability |
| Conflict `horario-fechado` on approved, pinned and booked flights, and its Sugestões | js/engine.js:446; js/reparo.js:89 | none |
| The compaction keeping out of the closed period | js/compactar.js:111 | none |
| Booking: closed times not offered, the blocker for a typed time | js/agendamento.js:107; test/unit/agendamento.test.js:621-622 | none |
| The struck-through times in "Horários de decolagem" and the tip | js/views/horarios.js:39-47 | removed with it |
| The closing carried to the following new dates | js/dias.js:120-122 | removed with it |
| History entries 'Janela HH:MM ativa' and 'inativa' | js/eventos/recursos.js:118 | removed with it |
| The e2e ready signal | test/e2e/fixtures.js:65 | another element drawn after the data is read |
| 22 golden inputs with closed windows; 18 golden outputs depend on them | measured | see 5.2 and section 7 |

Removing `state.win` does not remove the constant `WIN`. The grid stays in use for: the Ground start times (js/engine.js:601, 454), the student's 'manha', 'tarde', 'noite' (js/rules.js:12, 19-27), the row's `w` and the Escala list and PDF groups "06:30 · 1º tempo" (js/format.js:7; js/views/escala.js:521-526; js/export.js:59-61), the Noturno at `T[NI]`, the Voo Solo at `T[0]`, the 17:30 daylight limit (js/horarios.js:43), the default preferences (js/horarios.js:75-78; js/rules.js:82), `HORARIOS_PADRAO`, the Ground class keys (js/engine.js:688; js/fixos.js:171), the Excel layout (js/planilha.js:47) and the Manual list.

### 5.4 `aw`, `WIN` and `cobre`

**Shape**: `ins[].aw` is an array of 9 booleans, one per window of `WIN` (js/config.js:4); `NI = 8` is the night, `DAY = [0..7]` (js/config.js:7); `T` in minutes is 390, 500, 610, 690, 760, 820, 870, 980, 1050 (js/config.js:8). Window k spans `[T[k], T[k+1])` and the last one `[1050, 1440)` (js/viabilidade.js:17): 06:30–08:20, 08:20–10:10, 10:10–11:30, 11:30–12:40, 12:40–13:40, 13:40–14:30, 14:30–16:20, 16:20–17:30, 17:30–24:00. Presets `PRE`: 'Dia inteiro' 0–7, 'Manhã' 0–3, 'Tarde' 4–7, 'Noturno' 8, 'Dia + noturno' 0–8 (js/config.js:118-124). Stored per date in `dia.ins[id] = { on, aw }` and copied to each new date (js/dias.js:58, 120-122).

**Every reader and writer**

| Where | Read or write |
|---|---|
| js/viabilidade.js:17, 54 | the only reader in the engine's closure: `x.on && cobre(x.aw, a, b)` inside `problemasDoInstrutor` |
| Callers of `problemasDoInstrutor` | js/engine.js:202 (hours split), 429 (pinned flight), 674 (Ground), 848 (flights); js/compactar.js:195; js/candidatos.js:113 (Sugestões and booking lists); js/instrutor-escolhido.js:62 (instructor list of a flight in the Escala) |
| js/views/cadastros.js:80-83 | draws the nine cells; `ocupacaoDosInstrutores` (46-57) marks the windows where the instructor has a flight |
| js/eventos/cadastros.js:173-174 | writer: one window |
| js/eventos/cadastros.js:175-177 | writer: preset |
| js/eventos/cadastros.js:75 | writer: a new instructor starts with `WIN.map((_, i) => i < 8)`, the 8 day windows on and the night off |
| js/agendamento.js:934-938 | writer: booking with "disponibilizar" sets `x.on = true` and turns on every window the flight touches; keeps the previous `{ insId, on, aw }` for the undo |
| js/reversoes.js:38-40, 108-114, 186-188 | reads and writes `aw` of the 'desfazerAgendamento' reversal stored in the History; valid only with exactly `WIN.length` booleans |
| js/dias.js:58, 94 | save; load (an instructor absent from the day gets all 9 true, the night included) |
| js/storage.js:125, 146 | normalisation: 9 entries, only `true` counts |
| js/backends/local.js:76 | legacy 7 to 9 conversion |
| scripts, supabase | none directly (scripts only through `juntar`, `separar`, `estadoSintetico`); no SQL reads `aw` or `win` |
| Tests | helpers: test/helpers/cenarios.js:50, estado.js:29, exemplo.js:24, montar.js:7; unit: test/unit/viabilidade.test.js:56, 67; engine.rules.test.js:65, 121-123, 528; engine.invariants.test.js:107, 335; equalizar.test.js:33; compactar.test.js:119, 253; combustivel.test.js:60; instrutor-escolhido.test.js:65, 312; reparo.test.js:140-144; agendamento.test.js:554-563; reversoes.test.js:35, 132, 146, 219-221, 231, 239, 265; dias.test.js:32, 40, 148; migracoes.test.js:16; storage.test.js:39-41, 50, 75-86, 99, 150, 156; storage-dias.test.js:375; e2e: test/e2e/cadastros.spec.js:951, 1010-1016, 1079-1080; historico.spec.js:64 |

`on` is a separate input with its own readers: js/engine.js:172, 247-250, 577, 746, 937; js/compactar.js:81; js/instrutor-escolhido.js:22; js/views/escala.js:582; js/views/rodizio.js:20; js/views/bi.js:44, 127; js/eventos/bi.js:35.

**What `cobre` requires**: `cobre(aw, a, b)` is true when `aw[k]` is truthy for every window that `[a, b)` overlaps; touching does not count (js/viabilidade.js:11, 17).
- The whole mission, from take-off `a` to landing `b`, must be inside available windows.
- No turnaround margin: only `[a, b)`. The 30 minutes before and after are part of the legal journey (js/limites.js:91-97), not of availability.
- The Noturno, 17:30 to 21:30, touches only window 8 and needs `aw[8]`. The return leg of the next day is never checked against `aw` (js/engine.js:370-393).
- Ground classes follow the same rule (js/engine.js:674): 90 minutes from the window start. The classes of 10:10, 11:30, 12:40 and 13:40 need two windows, and the 16:20 class (to 17:50) needs the night window too.
- A simulator session that passes 17:30 needs the night window (test/unit/engine.rules.test.js:62-67).
- A pinned flight is checked on its scheduled `a` and `b`, not on the delayed time (js/engine.js:429); failing gives the conflict `instrutor-indisponivel`, the same code as `on` false.
- The minutes before 06:30 belong to no window: a flight from 06:00 to 06:30 passes with every `aw` false, one from 06:00 to 07:00 needs window 0 (measured; the take-off editor accepts 06:00: js/horarios.js:17, 25).
- `win` and `aw` differ: `win` checks the start only, `aw` the whole flight (measured, same 2 h flight at 06:30).

**Step 1 of the request (convert, goldens identical): what the ranges must reproduce**
1. Conversion: each run of consecutive true windows i to j becomes one half-open range `[T[i], T[j+1])`, ending at 1440 when j is 8. Examples: a new instructor gives `[390, 1050)`; night only `[1050, 1440)`; lunch off gives `[390, 690)` and `[760, 1050)`.
2. Reading: the mission `[a, b)` is covered when it fits whole inside one range, looking only at the part from 06:30 on. Checked against today's `cobre` for all 512 `aw` combinations and every interval on a 10-minute grid: 0 differences in 5,345,280 cases (measured). Without the 06:30 clause it differs only for flights that start before 06:30.
3. With that reading every golden stays identical: 0 of 41 files change (measured on a scratch copy with `cobre` rewritten over ranges).
4. So in step 1 a range is a presence range (the mission must fit inside it), not a range of start times. Labelled "earliest and latest start" it would not say what the engine does.
5. `on` stays a separate boolean: `on` false and "no window" give different texts and codes (js/engine.js:247 against 242; 577 against 955), and `on` alone decides who counts in the hours split and in `sem-instrutor-habilitado` (js/engine.js:172, 746, 937; js/compactar.js:81).
6. The golden inputs carry `aw` and their hash covers it (test/helpers/cenarios.js:50, 94; test/unit/engine.golden.test.js:21), and `exemplo-estado.json` carries `aw` for its 40 instructors. For byte-identical files the generator must keep emitting `aw`: either `viabilidade.js` reads the ranges and falls back to `aw`, or the tests convert the generated state after the hash is checked.
7. Every caller of `problemasDoInstrutor` must see the same answer: allocation, pinned-flight check, hours split, compaction, Sugestões, booking, the Escala's instructor list.
8. Outside the engine, the same commit has to deal with: `separar` and `juntar` (js/dias.js:58, 94) and their pinned key list (test/unit/dias.test.js:32); the default of an instructor absent from a day (all 9 windows) against the default of a new instructor (night off); "disponibilizar" (js/agendamento.js:938); the History reversals already stored on the server with `aw` (js/reversoes.js:39-40), which `js/migracoes.js` does not reach since it migrates only the roster and the days; the day grid and the "Aplicar turno…" presets.

**Step 2 of the request (a range limits only when a mission may start): what changes**
- `cobre` becomes "the start `a` is inside a range". 37 of 41 goldens change, 314 of 764 flight rows (measured on a scratch copy; unchanged: `exemplo`, `cenario-04`, `-13`, `-16`). On the 10-minute grid, over the 512 `aw` combinations, it differs from today in 28.5% of the flights that start between 06:30 and 17:30 and last up to 5 h.
- A flight may start inside a range and run past its end: through a lunch gap, past the end of a morning-only day, past 17:30 for the simulator and the 16:20 Ground class without night availability.
- The end of a range needs a decision: today a run of windows ending at 17:30 excludes a start at 17:30 (the Noturno). A converted "latest start 17:30" read as inclusive would let every day-only instructor take the Noturno; the night is off by default for a new instructor (js/eventos/cadastros.js:75).
- The hours split and the compaction use the same rule, so they move more flights.
- Tests to rewrite: test/unit/viabilidade.test.js:22-30, 64-68; engine.rules.test.js:62-67, 524-536; engine.invariants.test.js:98-110, 335; equalizar.test.js:30-37; compactar.test.js:116-124, 249-263; combustivel.test.js:60; reparo.test.js:140-144; agendamento.test.js:554-563; plus the 9 e2e snapshots if their scenarios are touched.

### 5.5 The criteria (`js/criterios.js`)

Stored in the day, `dia.criterios` (js/dias.js:70, 109), copied to each new date (js/dias.js:120-122); default `{ buracos: 'inva', horarios: 'disponibilidade' }` (js/criterios.js:13); unknown values fall back to the default (js/criterios.js:16-20). Locked while the schedule is approved and for the Gestor (js/eventos/escala.js:224; js/views/escala.js:401). Read only by `compactar` and `custoDaEscala` (js/compactar.js:64, 77); the allocation before the compaction never reads them.

| Field | Value | Label today | Tip text | Use |
|---|---|---|---|---|
| `buracos`, group label "Buracos" (js/views/escala.js:407) | `inva` | "INVA" | 'Menos tempo parado dos instrutores' | weights `{ invaParado: 1, aviaoParado: 0.1, saida: 10 }` (js/config.js:110) |
| | `aviao` | "Avião" | 'Menos tempo parado dos aviões e menos saídas do hangar' | weights `{ invaParado: 0.1, aviaoParado: 1, saida: 60 }` (js/config.js:111) |
| | `maior` | "Maior buraco" | 'Os maiores buracos primeiro, de instrutor ou de avião' | each gap costs its square divided by 60 (js/config.js:112) |
| `horarios`, group label "Horários" | `disponibilidade` | "Na disponibilidade" | 'O voo pode mudar de horário dentro da disponibilidade do aluno' | a flight may move to any take-off time of its category inside the student's `jan` (js/compactar.js:111-112) |
| | `preferencias` | "Só 1ª e 2ª" | 'O voo só muda entre a 1ª e a 2ª preferência do aluno' | candidate starts limited to `p1` and `p2` (js/compactar.js:112) |
| | `fixos` | "Não mudar" | 'Os horários ficam onde a escala pôs; só os instrutores podem trocar' | no flight changes time: `mudaHorario` is false (js/compactar.js:95); instructors may still change |

Cost: instructor days are the idle minutes between commitments times `invaParado`, or the squared gaps (js/compactar.js:44-47); aircraft days are idle minutes times `aviaoParado` plus `saida` for each hangar exit, a gap of 120 minutes or more counting as a new exit (js/compactar.js:48-53; js/metricas.js:9). **Only aircraft enter the resource cost**: `AIRCRAFT_EQ_TYPES`, never the simulators or the Ground room (js/compactar.js:69, 93, 162). A lost preference costs 0 at `p1`, 30 at `p2`, 60 elsewhere, times `pr / 3`, the same under the three `buracos` values (js/compactar.js:55-58; js/config.js:113).

The search (js/compactar.js:255-290): each round applies the single move that lowers the cost most, in a fixed order (units by `a`, then key), up to 200 moves, 20,000 feasibility checks and 200,000 evaluations (js/config.js:116). Moves: change the time with the same instructor; pass to another active instructor at the same time when the hours split does not get worse; both, to an instructor who already flies within 60 minutes; swap two flights of the same duration. Never moved: pinned flights, flights with a status other than Confirmado or Pendente, the Noturno, the Parafuso on the C152, the time of a Ground class (js/compactar.js:90, 95); the instructor of rodízio flights and of flights marked `insEscolhido` or `insPar` (js/compactar.js:97). The engine keeps the compacted schedule only when it costs less after the registration swap (js/engine.js:971-979). A moved flight gets 'Pref. 1', 'Pref. 2' or 'Horário ajustado' (js/compactar.js:293-299).

### 5.6 Order of placement, purity, and the saved schedule

**Order** (js/engine.js)
1. Queue: for each student in roster order, the main request when `fly`, then each `extra` with `fly` (291-303).
2. Sort (333-338): Ground missions first; then requests with a chosen instructor who is still in the roster; then `pr` from 5 to 1; then students with "Priorizar com"; then the pedido id (`solicitacao`), earlier first, hand-made requests last; then the student's position; then the mission's position.
3. The return legs of yesterday's Noturno enter as fixed rows 07:30 to 08:30, occupying instructor, student and aircraft from 00:00 to 10:10 (370-393; js/voo.js:14).
4. Pinned flights, in two passes (406): first the pins that are not `agendado` (approved schedule, status, instructor chosen in the Escala), then the booked ones, each pass in queue order. Each pin stays where it is and is checked again; what no longer holds becomes a conflict on that flight (420-449, 533). A delayed flight occupies its new time only after all pins are checked (491-492, 536). Booked flights also get the warnings for the four rules the engine follows by itself (450-477, 540-553).
5. The rest of the queue (556-966). A chosen instructor who is off, lacks the habilitação or is in "Não escalar com" rejects the request at once (576-583). Instructor passes: only the chosen one; or the "Priorizar com" instructors over every time and, failing that, everyone, with the warning at the end; or everyone (586-589).
   - Ground (597-768): candidate windows by preference, those ending before the student's dependent flight first (601-621); join an open class of the same mission, or open one with the instructor that nobody of the group blocked, then fewest habilitações, then lowest load (679-683). One room.
   - Flights and simulator (773-966): equipment check, Ground precedence, the starts in preference order (1ª, 2ª, then by distance from the 1ª, earliest on a tie: js/horarios.js:98-102); two attempts, full tank first and less fuel only if weight was the obstacle (834-875); at each start: the 6 local flights limit, student free, aircraft available and free, balance to the 50 h inspection, instructors by `problemasDoInstrutor`, then those who may fly one of the free aircraft. Instructor order (858-860): least fuel reduction, weight informed when it matters, not the student's previous instructor of the day, fewest flights today in the rodízio category, queue position, fewest habilitações, lowest load. Aircraft order (866-869): the one the instructor already used today, not the student's previous aircraft, smallest gap to a flight of an aircraft already out, hangar position.
6. Even split of hours, `equalizarHoras` (968; 171-237): up to 1000 rounds, a unit passes from the instructor with most hours to one with fewer when every rule still holds; rodízio flights, pinned flights, `insEscolhido`, `insPar` and flights in progress stay (186, 214).
7. Compaction on a copy, then `manterInstrutorNoMesmoAviao` on both, and the cheaper one wins (971-979).
8. Warnings `voa-com`, `escolhido-saiu`, `perto-do-limite`, `repouso-do-noturno` (982-1008); the 50 h summary and its warnings (1011-1030); Ground class sizes and tags (1033-1045); final sort (1047); delay warnings (1049).

The rodízio inside the engine is the pair "fewest flights today in the category, then queue position" (js/engine.js:781-783, 859) over `ajustarFilas(state.filas, state.ins)` (345); the rotation to the next date is `filasDoDiaSeguinte`, from the saved schedule (js/rodizio.js:34-46).

**Purity**: no clock, DOM or randomness anywhere in the 24-module closure (measured); the state is never changed (test/unit/engine.invariants.test.js:241-248); the search limits are counts, not time (js/config.js:115-116).

**The saved schedule and running again**
- Every operator change goes through `gravarAlteracao` → `save()` → `refazerEscala()` (the engine on `S`) → `ApiClient.salvarDia(DATA, S, RES)`, which writes the roster if it changed and then the day with `resultado` (js/actions.js:166-195, 367-380; js/storage.js:229-242).
- Opening a date does **not** run the engine when the day has a valid saved schedule: `RES` is the saved one (js/actions.js:309). It is valid when every row and alert passes `normalizarEscalaGravada` (js/escala-gravada.js:103-123) and its Noturno return rows match yesterday's nights (`voltasConferem`: js/storage.js:205-206; js/noturno.js:56-61). Otherwise the engine runs, and that schedule is saved with the first change or an export (js/actions.js:197-202). Opening never writes.
- So a saved date keeps showing the schedule of its last change. A roster change made while another date was open, or a new version of the engine, reaches it only at the next change on that date, and then unpinned flights may move. Approval is what freezes: `fixosAoAprovar` pins every flight (js/eventos/escala.js:204; js/fixos.js:59-69).
- The validator drops unknown row fields, and one invalid row, or one alert whose code is not in the list for its type, discards the whole saved schedule (js/escala-gravada.js:73-94). test/unit/engine.invariants.test.js:525 requires `normalizarEscalaGravada(depois)` to equal the engine's output, so a new row field or alert code must enter `CAMPOS` or the code lists in the same commit. Alerts already accept `fKey`, `stuId` and `insId` (js/escala-gravada.js:89-93).
- Other readers of the saved rows: the next date's hours and queues (js/dias.js:127-137; js/rodizio.js:34-46), yesterday's nights (js/noturno.js:17-30), the BI (js/dias.js:172-180), the instructors' hours (js/limites.js:32-69) and two database functions, `horas_dos_instrutores` (supabase/migrations/20261115151734_repouso_conta_o_atraso.sql:14) and `painel_do_dia` (supabase/migrations/20261120150000_painel_do_dia_com_a_configuracao.sql:55-69).

### 5.7 Inputs that come from the cadastros

| Input | State path | Stored | How the engine uses it |
|---|---|---|---|
| "Priorizar com" | `stu[].voaCom` | roster (js/dias.js:47); `select[data-f="voaCom"]`, `data-act="unvc"` (js/views/cadastros.js:259-260; js/eventos/cadastros.js:101-109, 208-211) | the request goes ahead of others of the same priority (js/engine.js:332, 337); first pass only with those instructors over every time (586-588); the flight is marked `insPar` and is not moved later; if none could, warning `voa-com` with the reason (590-592, 982-987). Not used when the request has a chosen instructor |
| "Não escalar com" | `stu[].bl` | roster; `select[data-f="bl"]`, `data-act="unbl"` (js/views/cadastros.js:251-252; js/eventos/cadastros.js:92-99, 201-207; adding one removes it from `voaCom`) | rule `bloqueio` (js/viabilidade.js:59); a Ground class with a blocked instructor is not joined (js/engine.js:645, 665); the class instructor avoids anyone blocked by the group (656-659, 680); a chosen instructor in the list rejects the request (579) |
| Legal limits | `limites` | roster (js/dias.js:50); `[data-limite]`, `[data-limites-padrao]`, Administrador only in shared mode (js/eventos/cadastros.js:230-246; js/views/cadastros.js:75) | `dentroDosLimites`: flight per journey, journey, month, semester, year, rest (js/limites.js:101-117); warning from 90% (js/engine.js:139-158) |
| Hours behind the limits | `horasDosInstrutores` | not stored: saved schedules + `ins[].horasExternas` (roster) + yesterday's Noturno (js/storage.js:197-202) | history for the limits; unread, only the day's limits are checked (js/storage.js:192-196) |
| Hours until the 50 h inspection | `horas[reg]` = hours flown since the inspection at the start of the day | **the day**, not the roster (js/dias.js:65); the screen shows 50 minus it as "Horas disponíveis" (js/views/recursos.js:48, 67; js/eventos/recursos.js:131-145); a new date starts with the previous day's hours plus its flights (js/dias.js:127-137) | `cabeNoSaldo` when choosing the aircraft (js/engine.js:844), conflict `revisao` (443), the `revisao` output and warning (1011-1030) |
| Maintenance | `av[reg]` | **the day** (js/dias.js:57), copied forward | js/engine.js:842, 437, 929-936 |
| Fleet attributes | `frota[].soParafuso`, `soVfr`, `habilitacaoPropria` | roster (js/dias.js:48) | `aviaoServe`, `motivoDoAviao`, `instrutorVoaNoAviao` (js/frota.js:40-54) |
| Hangar order | `hangar[]` | **the day** (js/dias.js:67), copied forward | last tie-break when choosing an aircraft (js/engine.js:869) and the order of the registration swap (101) |
| Weights | `stu[].kg`, `ins[].kg` | roster | limit per type is the constant `DEFAULT_LIM` (js/config.js:96); a stored `lim` is deleted at load (js/storage.js:70-72) |
| Fuel rule | none: constants `COMBUSTIVEL`, `KG_POR_GALAO`, `TAXI_MIN` (js/config.js:100-103) | code | above the limit the aircraft leaves with less fuel if the rest covers the flight, 10 min of taxi and the reserve, 30 min by day and 45 at night and in IFR (js/combustivel.js:8-20); full tank first (js/engine.js:834-849) |
| Take-off times | `horarios` | roster (js/dias.js:49) | js/engine.js:273, 811 |
| Rodízio queues | `filas` | the day (js/dias.js:66) | js/engine.js:345, 781-783 |

### 5.8 Does Processamento emit today's state shape

**What a module must emit for the engine to run unchanged**: a state with the paths of 5.1.
- Required: `ins[]` with `id`, `on`, `aw` (9 booleans), `hab`, `kg`, `nm`; `stu[]` in roster order with `id`, `nm`, `kg`, `bl` (array), and optionally `voaCom`, `curso`; `win` (9 booleans); `av`.
- The requests: on each student, `fly` and the main request's fields; in `extra[]`, one object per further request with a `mid` that is unique and stable for that student. Fields: `fly`, `mis`, `eq`, `p1`, `p2`, `nb`, `pr`, and when present `jan`, `insId`, `solicitacao`, `etapa`. A student may have `fly: false` on the main request and every pedido in `extra` (js/engine.js:292-303).
- The rest passes through from the roster, the day and the load: `frota`, `horarios`, `limites`, `hangar`, `horas`, `filas`, `criterios`, `fixos`, `fStatus`, `fObs`, `horasDosInstrutores`, `noturnosDaVespera`.
- Two identities must hold across every re-derivation: the flight key `` `${stuId}_${mid}_1` `` (it keys the pins, the statuses, the results of the date and the History reversals: js/voo.js:5; js/rules.js:54-72) and the order of `stu[]`.

**Where each engine-read request field comes from today**

| Field | From the pedido (`solicitacoes`: `aluno`, `missao`, `janela`, `horario`, `horas`, `id`: supabase/migrations/20261110222506_agenda_de_solicitacoes.sql:6-24; 20261114222031_agenda_com_duracao.sql:8) | Other sources |
|---|---|---|
| `mis` | `missao` (js/agenda.js:73) | Demanda "Missão"; "Usar" and "Outra missão do curso"; booking |
| `jan` | `janela` and `horario` (js/agenda.js:52-56) | Demanda "Disponibilidade"; booking may remove it |
| `nb` | `horas`, else the course programme, else the mission default (js/agenda.js:71-74) | Demanda "Duração"; booking |
| `solicitacao` | `id` (js/agenda.js:128) | none |
| `etapa` | derived at import from the programme and the results (js/agenda.js:119-127) | Demanda "Usar"; booking |
| `fly` | the import sets `true` (js/agenda.js:73) | **Demanda only** to take an imported request off without cancelling the pedido ("Voa", "Tirar da escala"), and to add one with no pedido ("Pôr um aluno na demanda", "+ missão") |
| `eq` | none: the mission's `defEq` or the programme's `eq` (js/agenda.js:65-66) | **Demanda "Recurso"** or the booking dialog, for any other allowed type |
| `p1`, `p2` | derived: the first two times of the list inside the availability, else the defaults (js/agenda.js:67-70) | **Demanda "1ª" and "2ª preferência"**; booking sets `p1` to the booked time |
| `pr` | none: always 3 (js/agenda.js:74) | **Demanda "Prioridade" only** |
| `insId` | none | **Demanda "Instrutor"**, the Escala's instructor change, booking |
| `mid` | assigned by `alvoDoNovoPedido` and `proximoMid`, from what the day already holds (js/rules.js:67-72, 95-100) | "+ missão" |

Fields with no source other than the Demanda table (or the booking dialog): `pr`; `eq` when it is not the default; a 2ª preferência or any preference other than the derived one; `insId` (also settable in the Escala); `fly: false` on an imported request; every request made by hand, with no pedido.

## 6. Conflicts with the request

| # | The request assumes | The code | Evidence |
|---|---|---|---|
| 1 | `win` and the per-category take-off times overlap, so `win` can go | They overlap only for flights. `win` is per date and cuts across every category; the lists are for all dates. Ground has no list (the 8 day windows) and the Noturno is fixed at 17:30: for those two, `win` is the only per-date time switch | js/engine.js:601, 811; js/horarios.js:31-36, 52; js/dias.js:49, 56 |
| 2 | `win` can be removed and the engine and goldens stay untouched | The engine indexes `state.win` without a guard and throws without it (measured). 22 golden inputs close windows, and 18 golden outputs change if the engine stops honouring them (measured) | js/engine.js:446, 601, 811; js/compactar.js:111; test/helpers/cenarios.js:85 |
| 3 | Step 1 converts `aw` to "ranges of earliest and latest mission start time" with identical goldens | Identical goldens need presence ranges (the whole mission inside one range). A start-time reading is step 2 and changes 37 of 41 goldens (measured). The same stored numbers would mean two different things in the two steps | js/viabilidade.js:17, 54 |
| 4 | The goldens only need `viabilidade.js` to read ranges | The generated inputs and `exemplo-estado.json` carry `aw`, and the recorded hash covers it: the generator cannot switch to ranges without changing all 40 scenario files | test/helpers/cenarios.js:50, 94; test/unit/engine.golden.test.js:21 |
| 5 | The goldens change only in commits whose purpose is a rule change | The goldens record alert texts. One names a screen the redesign renames: "(marque em Instrutores › Cadastro)", 7 alerts in `cenario-06.json`. Other engine texts name "Demanda" and "aba Recursos". Habilitação names also appear in golden texts | js/engine.js:961, 994, 932; js/habilitacoes.js:10-33, 108 |
| 6 | F3 (habilitações as one registry) is independent of the goldens | The scenario generator builds `hab` with `habilitacoesDoNivel` from `js/habilitacoes.js`, and the golden inputs have no `frota`, so they use `FROTA_INICIAL` with `habilitacaoPropria` on PR-VOM. A change of ids, of their order, or of what PR-VOM requires changes hashes or outputs | test/helpers/cenarios.js:6, 51; js/frota.js:14-18, 52; js/config.js:31 |
| 7 | "Recurso (today labelled Avião)" for `buracos` | The value `aviao` counts only aircraft; simulators and the Ground room are not in that cost | js/compactar.js:69, 93, 162 |
| 8 | "Não considerar (today Não mudar)" under "Prioridade de horários dos alunos" | `fixos` means the compaction changes no flight time. The allocation still tries the 1ª, the 2ª and the nearest time; nothing ignores the student's preferences. Group labels today are "Buracos" and "Horários", and the code's order is disponibilidade, preferencias, fixos | js/compactar.js:95; js/engine.js:817; js/criterios.js:8-12; js/views/escala.js:407 |
| 9 | Operator restrictions "override any rule" | A pin is never moved, but it is checked against the rules and becomes a conflict; a chosen instructor who is off, unqualified or blocked rejects the request; a booked flight outside the engine's own four rules gets warnings. A fourth kind of pin is not in the request's list: the status (Em Voo, Atrasado, Pousou, Cancelado) | js/engine.js:420-449, 576-583, 450-477; js/fixos.js:40-41 |
| 10 | Processamento shows "why any of them cannot be scheduled" before the Escala stage | Almost every reason is an output of the allocation and depends on the other requests (aircraft, instructors, room, limits). The rejection carries no id of its request, only the label text | js/engine.js:765, 964; js/agendamento.js:235, 1032 |
| 11 | The Recursos cadastro detail holds the hours until the inspection and the maintenance status | Both are per-date fields of the day, carried to new dates by copy, as is the hangar order | js/dias.js:57, 65, 67, 120-137 |
| 12 | Processamento has no data of its own | `pr`, a non-default `eq`, the 2ª preferência, `insId`, `fly: false` and hand-made requests exist only in the day's stored `pedidos` | 5.8; js/dias.js:59-62 |
| 13 | "41 goldens" | 41 recorded outputs in 42 files; the 42nd is the frozen input `exemplo-estado.json`. Not a contradiction | test/helpers/goldens.js:8-12 |

## 7. Implications and options for the redesign (suggestions)

1. **Processamento emits today's state shape** (Pedro's preference). The engine, its 24 modules, the goldens and the 62 test files built on `test/helpers/montar.js` stay. Cost: a stable rule for `mid` (for example the pedido id, with the main request left `fly: false`) and a home for the operator-only fields of 5.8, either new columns on the pedido or a per-date map of adjustments keyed by pedido id. Risk: saved days key their pins, statuses and results by today's `mid`; re-keying them is a data-format step over every stored day, and the History reversals already stored keep the old keys.
2. **`win`, option A: keep the input, move or drop the control.** The engine keeps reading `win`; the module always emits it (all open, or from an operator restriction "períodos fechados nesta data" in the Escala stage). Cost: small; the data and its copy to the next date stay. Risk: if the control is simply dropped, days already saved with closed windows keep them closed with no way to reopen, unless a data-format step opens them. Goldens identical.
3. **`win`, option B: remove it from the engine** in its own commit, as a rule change. Cost: guards or deletion at four lines, the conflict code `horario-fechado` kept in the list for old saved schedules, the unit tests listed in 5.3, the booking and Sugestões paths, goldens re-recorded. Risk: 18 golden files change if the generator keeps emitting `win` (ignored), all 40 if it stops; Ground and the Noturno lose their only per-date time switch (conflict 1).
4. **`aw` step 1**: a step that adds presence ranges to `dia.ins[id]` and keeps `aw` as a copy (as `lv` was kept); `separar` and `juntar` write and read the new field; `cobre` over ranges with the 06:30 clause; `validarReversao` accepts both shapes. Cost: medium: every reader and writer listed in 5.4, and their tests. Risk: two readings in the code while `aw` survives in the generator and the example; without the fallback (or a conversion inside the test) the hashes change.
5. **`aw` step 2** as its own commit with the goldens re-recorded and `scripts/medir-escalas.mjs` in the PR. Cost: the tests listed in 5.4 and a decision on the range end. Risk: 37 of 41 goldens change, so the review of the diff is large; instructors silently gain availability on every stored date unless the conversion shortens the ranges.
6. **Engine texts and screen names**: stop naming screens in engine messages (keep the code, let the view add "where to fix it"), or accept one text-only golden change. Cost: one commit touching `cenario-06.json` and three strings. Risk: it is a golden change that is not a rule change, which the guardrail forbids as written.
7. **An id on rejections**: add `stuId` and `fKey` to `err` alerts so the pipeline's "pedidos que não cabem" can open the right pedido. The saved-schedule validator already accepts both. Cost: one engine commit; the 174 golden `err` alerts change. Risk: same guardrail question as item 6; without it, the link stays a match on the student's name.
8. **The e2e ready signal**: replace `#wins input[data-a="win"]` in `test/e2e/fixtures.js:65` and in the 9 other places that repeat the wait (7 spec files, listed in 5.3) before the Recursos screen is rebuilt. Cost: small. Risk: every e2e spec fails at once if it is forgotten.
9. **F3 and the goldens**: keep `habilitacoesDoNivel`'s output, the ids and their order in `HABILITACOES`, and PR-VOM's requirement `aviao:PR-VOM` exactly; if the flag becomes a list of ids, `exigenciasDoAviao` must return the same for `FROTA_INICIAL`. Cost: a constraint on F3. Risk: 40 hashes fail on any drift.
10. **Labels of the criteria**: rename only the text in `js/criterios.js`, the glossary and the Manual; keep the stored values. Cost: small, plus e2e text assertions. Risk: conflicts 7 and 8, labels that say more or the opposite of what the value does.

## 8. Open questions for Pedro

1. Is closing a period for one date still needed (weather in the afternoon, no Noturno tonight, no Ground at 16:20)? If yes, where does the control live: an operator restriction in the Escala stage? If no, do days already saved with closed windows get reopened by a data-format step?
2. Step 1 of the INVA availability: do you accept that the stored ranges mean "the mission must fit inside" until step 2, or should step 1 and step 2 be one commit with the goldens re-recorded once?
3. Step 2: is the end of a range inclusive? A day-only instructor converted to "06:30 to 17:30" must not gain the Noturno, which starts exactly at 17:30. Do Ground classes and the simulator follow the same start-only rule?
4. Does "Vem" (`on`) stay as a per-date switch beside the ranges, separate from the new cadastro-level active switch?
5. Defaults: a new instructor starts with the night off, but an instructor missing from a saved day gets all nine windows, the night included. Which one for ranges? Does the availability keep being copied to each new date?
6. Criteria labels: "Recurso" for a criterion that counts only aircraft, and "Não considerar" for a value that freezes the times. Keep the wording of the request, or "Avião" and "Não mudar"?
7. May a commit change a golden only in its texts (the screen name in the PR-VOM message, an id added to rejections), or do engine messages stay as they are even when they name a screen that no longer exists?
8. Where do the operator-only values live once the Demanda table is gone: Prioridade, a Recurso other than the default, the 2ª preferência, a request taken off without cancelling the pedido, a request with no pedido at all?
9. May saved days be re-keyed so a flight's key comes from the pedido id, or must past dates keep their stored `pedidos` as they are?
10. Should Processamento show the reasons a pedido does not fit by reading the engine's rejections of the current schedule, or only the reasons it can know before the allocation (no available aircraft of the type, no qualified instructor on the date, equipment not allowed)?

<!-- fim -->
