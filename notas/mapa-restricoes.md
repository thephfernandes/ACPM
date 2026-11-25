# Mapa: Operator restrictions — pins, the chosen instructor, booking, Sugestões, status and reverts

Read at worktree `/Users/pedrofernandes/ACPM/.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to it.
Words: *pin* = "voo fixo" (an entry of `fixos`); *request* = "pedido da Demanda" (`stu[]` fields or one `stu[].extra[]`); *pedido* = a row of the Agenda (`solicitacoes`); *fKey* = flight key `<stuId>_<mid>_1`.

## 1. What exists

| File (lines) | What it is |
|---|---|
| `js/fixos.js` (186) | Pure. The pins: normalising (`normalizarFixos`, `normalizarAprovacao`), the pin built from a schedule line (`pinoDoVoo`), the lock cycle (`fixosAoMudarStatus`, `fixosAoReabrir`, `fixosAoAprovar`), what the Demanda releases (`semAgendados`, `limparDemanda`), what a revert gives back (`fixosQueVoltam`, `pinoDeVoltaNaTurma`) and the lock text (`motivoDoFixo`). |
| `js/instrutor-escolhido.js` (183) | Pure. The chosen instructor: option lists (`instrutoresDoPedido` for the Demanda, `instrutoresDoVoo` for the Escala), `escolherInstrutor` (mutates state), `reverterEscolha`, `escolhasDaUnidade`, `escolherNosPedidos`, `reverterReparo`. |
| `js/agendamento.js` (1278) | Pure. The booking: context (`contextoInicial`), times, the form (`formularioDoAgendamento`), `aplicarAgendamento` (the only writer), `simularAgendamento` (engine on a copy), `avaliarAgendamento` (blocks, warnings, notes, preview), History text and revert payload. |
| `js/views/agendamento.js` (359) | The dialog `#dlg-agendar`: draws the form, 150 ms debounce before the check, "Agendar mesmo assim", locking when the screen turns read-only. |
| `js/eventos/agendamento.js` (53) | `data-act="agendar"` handler, `confirmarAgendamento` (the save through `gravarAlteracao`), `agendarNoMapa`. |
| `js/candidatos.js` (119) | Pure. Occupation of the day from a schedule (`ocupacaoDaEscala`) and candidates with the reason each one fails (`problemaDoRecurso`, `problemaDoAluno`, `avioesQueServem`, `instrutoresQueServem`). Used by Sugestões and by the booking. |
| `js/reparo.js` (125) | Pure. `sugerirReparos` (options for a pinned flight in conflict) and `aplicarReparo` (returns the new `fixos`). |
| `js/views/reparo.js` (69) | The drawer `#painel-reparo` (title "Resolver o conflito"). |
| `js/reversoes.js` (229) | Pure. `validarReversao` (9 revert kinds), `motivoParaNaoDesfazer`, `desfazerAgendamento`, `agendamentosEmVolta`. |
| `js/status.js` (151) | Pure. Status details (`validarDetalhe`), normalising (`normalizarStatus`, `normalizarDetalhes`), texts, `intervaloEfetivo`, delay conflicts. |
| `js/views/dialogo-status.js` (77) | The dialog `#dlg-status` (`pedirDetalheDoStatus`). |
| Wiring outside the list, read because it holds the handlers | `js/eventos/escala.js` (status, instructor in the Escala, Aprovar/Reabrir, Sugestões, map click), `js/eventos/demanda.js` (every Demanda field, Limpar demanda, Usar), `js/eventos/historico.js` (`rev-log`), `js/eventos/registro.js` (the `data-act` / `data-f` / `data-a` dispatcher and the read-only gate), `js/actions.js` (`gravarAlteracao`), `js/views/escala.js`, `js/views/demanda.js`, `js/engine.js:352-555` (pins in the engine), `js/dias.js`, `js/rules.js`, `js/voo.js`, `js/conflitos.js`, `js/agenda.js`. |

Engine goldens: `test/fixtures/goldens-do-motor/` has 40 `cenario-NN.json` + `exemplo.json` (+ `exemplo-estado.json`). None contains `fixos` in a state, nor `"fixo"`, `"agendado"`, `"insEscolhido"`, `"insPar"` or `"conflito"` in an output (grep, 0 files); `exemplo-estado.json` has `"fStatus": {}` and priorities `pr` 2 to 5. So the 41 goldens exercise priority but **no pin, no chosen instructor, no "Priorizar com"**: those paths are pinned only by the unit tests of section 4.

## 2. Data

### 2.1 Per date (the day document, `separar`/`juntar` in `js/dias.js:36-112`)

| Field | Shape | Written by | Read by |
|---|---|---|---|
| `fixos` (state) / `dia.fixos` | `{ "<stuId>_<mid>_1": { a, b, r, insId, classKey?, escolhido?: true, agendado?: true } }`. `a`,`b` integer minutes, `b > a`; `r` a registration matching `MATRICULA` or `SALA-GROUND`; `classKey` string ≤ 80 (Ground class); the two marks only when exactly `true` (`js/fixos.js:14-27`). Unknown keys of a pin are dropped at load; an invalid pin is dropped whole. | `js/eventos/escala.js:135` (status), `:204` (Aprovar), `:213` (Reabrir), `:286` (Sugestões); `js/instrutor-escolhido.js:122` (`escolherInstrutor`), `:152` (`reverterEscolha`), `:179` (`reverterReparo`); `js/agendamento.js:921` (`aplicarAgendamento`); `js/fixos.js:114` (`limparDemanda`); `js/eventos/demanda.js:28` and `:179` (`semAgendados`); `js/reversoes.js:180-185` (`desfazerAgendamento`); `js/eventos/cadastros.js:124` (instructor deleted); normalised at `js/storage.js:78`, `js/dias.js:107`, `js/eventos/historico.js:86,93`. | `js/engine.js:354-359` (only keys of requests with `fly: true`, see 5.1); `js/agenda.js:90`; `js/rules.js:56` (`chavesGuardadas`); `js/views/demanda.js:44`; `js/views/escala.js:535`; `js/agendamento.js:133,140,881,909,1141`; `js/instrutor-escolhido.js:90`. The server never looks inside it (no `fixos` in `supabase/`). |
| `aprovacao` | `{ em: ISO string, por: string ≤ 80 }` or `null` (`js/fixos.js:29-32`) | `js/eventos/escala.js:205,214`; `js/fixos.js:115` | `js/views/escala.js:378-404,474,535`; `js/instrutor-escolhido.js:80`; `js/agendamento.js:1143,1214,1261`; `js/eventos/escala.js:135,224`; `js/eventos/cadastros.js:124` |
| `fStatus` | `{ fKey: 'Pendente'|'Confirmado'|'Atrasado'|'Em Voo'|'Pousou'|'Cancelado' }` (`FLIGHT_STATUSES`, `js/config.js:128`); no entry means `Confirmado` (`js/voo.js:8`). The return leg of yesterday's Noturno uses the key `<stuId>_<mid>_2`. | `js/eventos/escala.js:126`; `js/fixos.js:112`; `js/reversoes.js:180` | engine, views, `fixoPeloStatus`, exports |
| `fObs` | `{ fKey: { novoInicio } }` (Atrasado, kept in Em Voo/Pousou) or `{ motivo, texto? }` (Cancelado; `motivo` one of `MOTIVOS_DE_CANCELAMENTO`, `texto` ≤ 140 only with `Outro`) (`js/status.js:9-50,65-79`) | `js/eventos/escala.js:129-130`; `js/fixos.js:113`; `js/reversoes.js:180` | engine (`intervaloEfetivo`), views, CSV/PDF (category only, `textoLivre: false`: `js/csv.js:22`, `js/export.js:65`) |
| Request = `dia.pedidos[stuId]` + `extra[]` | The 13 `CAMPOS_DO_PEDIDO` (`js/dias.js:22`): `fly, mis, eq, p1, p2, nb, ss, pr, jan, etapa, solicitacao, insId, cursoDaEtapa`. The main request is stored flat on the student object in state (`mid` 0); each extra has `mid` ≥ 1 plus the same fields. **Only these 13 names are saved for the main request** (`js/dias.js:60`); extras are cloned whole. | Demanda handlers (`js/eventos/demanda.js`), `importarSolicitacoes` (`js/agenda.js:107-140`), `aplicarAgendamento` (`js/agendamento.js:910-918`), `escolherInstrutor`/`escolherNosPedidos`/`reverterEscolha`, `limparDemanda`, `desfazerAgendamento`, `rev-log` (`setFly`, `restaurarHorarios`), the Horários editor (`js/eventos/recursos.js:203-211`), instructor deleted (`js/eventos/cadastros.js:123`) | `runAllocationEngine` (`js/engine.js:291-303`), every view |
| `request.insId` | The instructor chosen by the operator for that request; only a positive integer survives (`js/rules.js:166`) | `js/instrutor-escolhido.js:107-108,143-144,169-170`; `js/agendamento.js:910`; `js/rules.js:88` (`deixarEmBranco` deletes it); `js/eventos/cadastros.js:123` | `js/engine.js:331,528,573-589,988-995`; `js/views/demanda.js:38,76`; `js/agendamento.js:142,693` |
| `request.pr` | Priority 1 to 5, default 3 (`js/rules.js:82,156`) | Demanda select `data-f="pr"` (generic branch, `js/eventos/demanda.js:244`); `pr: 3` on import (`js/agenda.js:74`); the student's main `pr` (else 3) on a new extra (`js/eventos/demanda.js:166`, `js/rules.js:97`) | `js/engine.js:337` (queue order), `js/compactar.js:57` (cost weight), `js/agendamento.js:142` |
| `dia.ins[id] = { on, aw[9] }` | Instructor availability of the date | In this area: "Marcar disponível" (`js/agendamento.js:934-939`) and its undo (`js/reversoes.js:186-189`) | engine, `impedimentoDoPedido` (`js/instrutor-escolhido.js:22`) |
| `dia.resultado.out[]` (saved schedule) | Lines may carry `fixo`, `agendado`, `insEscolhido`, `insPar`, `conflito`, `conflitoCodigos` (`js/escala-gravada.js:55-67`) | `save()` (`js/actions.js:166-182`) | `fixosAoAprovar` reads `RES.out` (`js/eventos/escala.js:204`) |
| `criterios`, `importadas`, `win`, `av` | other areas; read here at `js/agendamento.js:107` and `js/reparo.js:89` (`win`), `js/candidatos.js:57` (`av`) | | |

New date: `diaParaCopiar` starts with `fixos: {}`, `aprovacao: null`, `fStatus: {}`, `fObs: {}` and blank requests (`js/dias.js:118-123`). Nothing of this area carries to the next date.

### 2.2 For all dates (the roster)

| Field | Written here by | Evidence |
|---|---|---|
| `stu[].kg`, `ins[].kg` | The weights typed in the booking dialog, when different from the roster | `js/agendamento.js:926-933`; e2e "grava só o dia; com um peso digitado, também o cadastro" (`test/e2e/agendamento.spec.js:538`) |
| `stu[].voaCom` ("Priorizar com"), `stu[].bl` ("Não escalar com") | not written here; read by the option lists and the engine | `js/instrutor-escolhido.js:24`, `js/agendamento.js:550,702` |

### 2.3 History (per date, append-only on the server)

Each entry: `{ id, ts, type: 'inc'|'exc'|'mod', desc ≤ 500 chars, revert (JSON or null), reverte (id of the entry it undoes), autor, importado }` (`js/actions.js:212-239,254-265`). The `revert` payload is persisted with the entry and **is not touched by the data-format steps** (`js/migracoes.js` `PASSOS` only have `cadastro` and `dia`): it is validated at read time by `validarReversao` (`js/reversoes.js:43-117`); out of format, the entry just has no button.

### 2.4 Server tables read by this area

`resultados` rows store `voo` = the fKey (`js/eventos/escala.js:242`). `motivoParaNaoDesfazer` (`js/reversoes.js:147`) and `chavesGuardadas`/`proximoMid` (`js/rules.js:54-72`) read `estado.resultados.doDia[].voo`.

### 2.5 The identity everything hangs on

`chaveDoVoo(stuId, mid) = "<stuId>_<mid>_1"` (`js/voo.js:5`). `mid` is 0 for the student's main request and, for an extra, `proximoMid` = 1 + the highest number among the student's extras and among the keys the day still keeps in `fixos`, `fStatus`, `fObs` and `resultados.doDia` (`js/rules.js:67-72`). Pins, statuses, details, results, the saved schedule, `noturnosDaVespera` and five of the nine revert kinds address a flight by `(stuId, mid)`.

## 3. Controls inventory

"Edit" below = Operador and Administrador in shared mode (`js/sessao.js:171`, `operaEscala`, `js/perfis.js:6`); in local mode, whoever is not on the "Gestor" role (`#role-sel`, `?role=gestor`). Gestor and Secretaria are read-only: `isGestor()` is `ApiClient.readOnly || body[data-role="gestor"]` (`js/state.js:25`), `.edit-only` is `display: none` (`css/app.css:235`), every `data-act` click and `data-f`/`data-a` change is refused in `js/eventos/registro.js:24,41`. The Secretaria has no Demanda tab and no Histórico button (`css/app.css:184-188`). Nothing is changed before the date's data is read (`aindaNaoAbriu`, `js/actions.js:154-158`).

### Escala (`#s-esc`, `#out`, `#tl-pop`)

| Label | Element | Handler | State read → written | Profiles |
|---|---|---|---|---|
| "+ Agendar voo" | `button#btn-agendar.btn.edit-only[data-act="agendar"][data-agendar="dia"]` (`index.html:353`) | `aoAcionar('agendar')` `js/eventos/agendamento.js:46` → `abrirAgendamento` `js/views/agendamento.js:333` | reads `S`, a fresh `runAllocationEngine(S)`, `S.programa`, `S.resultados`; writes nothing until "Agendar" | Edit |
| "+" (aria-label "Agendar às hh:mm") | `button.win-agendar.edit-only[data-act="agendar"][data-agendar="w:<0-8>"]` on each time header of the Lista (`js/views/escala.js:526`) | same | same; the search starts at `T[w]` (`js/agendamento.js:94-97`) | Edit |
| "+" (aria-label "Agendar no <REG>" / "Agendar na Sala Ground") | `button.tl-agendar.edit-only[data-act="agendar"][data-agendar="r:<REG>"]` on each row of "Por recurso" (`js/views/escala.js:163,199`); none on an aircraft in maintenance | same | same | Edit |
| "+" (aria-label "Agendar com <nome>") | `button.tl-agendar…[data-agendar="i:<insId>"]` on each row of "Por instrutor" (`js/views/escala.js:153,199`) | same | same | Edit |
| (click on the free part of a map row) | `div.tl-track:not(.inerte)[data-r]` or `[data-ins]` | document click `js/eventos/escala.js:40-56` → `agendarNoMapa({ r or insId, minuto })` `js/eventos/agendamento.js:50` | same; minute rounded to 5 (`minutoDoClique`, `js/eventos/escala.js:27-31`) | Edit (the Gestor is refused at `:53`) |
| "+ Aluno na turma" | `button.tl-pop-btn.edit-only[data-act="agendar"][data-agendar="t:<classKey>"]` in the map popup of a Ground class (`js/views/escala.js:63`) | same as "+ Agendar voo" | same | Edit |
| Status (aria-label "Status de <aluno>" / "Status do voo") | `select.st-sel[data-f="fstatus"][data-fkey]` in each row (`js/views/escala.js:335`) and in `#tl-pop` (`:57`) | `aoMudarCampo('fstatus')` `js/eventos/escala.js:144` → `mudarStatus` `:139` → `aplicarStatus` `:123` (through `#dlg-status` for Atrasado and Cancelado) | writes `S.fStatus[fKey]`, `S.fObs[fKey]`, `S.fixos` (`fixosAoMudarStatus`); History "Status de …", no revert | Edit (rendered `disabled` for the Gestor) |
| (status detail, e.g. "nova decolagem 10:40", "Meteorologia") | `button.st-detalhe[data-act="detalhe-status"][data-fkey]`, only while the status is Atrasado or Cancelado (`js/views/escala.js:362-368`) | `aoAcionar('detalhe-status')` `js/eventos/escala.js:189` → `#dlg-status` | rewrites `S.fObs[fKey]` | Edit |
| Instructor name (aria-label "<rótulo>: <nome>[, escolhido pelo operador | , do Priorizar com do aluno]. Trocar") | `button.ins-btn[.escolhido][data-act="trocar-instrutor"][data-fkey][data-rotulo]` (`js/views/escala.js:343-349`); plain text for the Gestor, for a line without `stuId` and for the Noturno return leg | `aoAcionar('trocar-instrutor')` `js/eventos/escala.js:148-155`: replaces the button by the select below | reads `RES` | Edit |
| Instructor list (first option "Automático (o app escolhe)" or "<nome> (escolhido pelo app)" / "(Priorizar com do aluno)") | `select.ins-sel[data-a="insVoo"][data-fkey]` (`js/views/escala.js:353-358`) | `aoMudarCampo('insVoo')` `js/eventos/escala.js:177-186` → `escolherInstrutor(S, RES, { stuId, mid }, id, { noLugar: true })` | writes `request.insId` (whole Ground class) and `S.fixos[fKey]` with `escolhido: true`; History "Instrutor de <quem> (hh:mm–hh:mm): <nome|automático>", revert `restaurarEscolha` | Edit |
| "✕" (title "Tirar da escala") / "✕ Excluir da escala" | `button.x[data-act="rm-fly"][data-id][data-mid]` (`js/views/escala.js:370-372`) / `button.tl-pop-btn.edit-only[data-act="rm-fly"]` (`:64`) | `aoAcionar('rm-fly')` `js/eventos/demanda.js:184-194` | writes `request.fly = false`; the pin stays; History "Tirado da escala: …", revert `setFly` ("↶ Restaurar") | Edit |
| "Aprovar escala" | `button#btn-aprovar.btn.edit-only` inside `span#aprovacao` (`js/views/escala.js:390`); `disabled` while the instructors' hours were not read | document click `js/eventos/escala.js:197-209`, second click "Confirmar aprovação" (`confirmado`) | writes `S.fixos = fixosAoAprovar(S.fixos, RES.out)`, `S.aprovacao = { em, por }`; History "Escala aprovada: N voos fixados", no revert | Edit |
| "Reabrir" | `button#btn-reabrir.btn.sec.edit-only` (`js/views/escala.js:384`) | `js/eventos/escala.js:210-218`, second click "Confirmar reabertura" | writes `S.fixos = fixosAoReabrir(S.fixos, S.fStatus)`, `S.aprovacao = null`; History "Escala reaberta: …", no revert | Edit |
| "Aprovada às hh:mm por <quem>" | `span#selo-aprovada.selo-aprovada` (`index.html:345`, `js/views/escala.js:383`) | display | reads `S.aprovacao` | all |
| "Sugestões" | `button.btn.quiet.edit-only[data-reparo="<fKey>"]` in `details.caixa.conflitos` (`js/views/escala.js:472`); the box title is "N voo(s) em conflito na escala aprovada" or "N voo(s) fixo(s) em conflito" (`:474`) | document click `js/eventos/escala.js:267-268` → `abrirPainelDeReparo` `js/views/reparo.js:19` | reads `S`, `RES` | Edit (present but hidden for the Gestor: `test/e2e/reparo.spec.js:111`) |
| Lock (aria-label = the reason) | `svg.ico.fixo[role="img"][data-dica="voo-fixo"]` (`js/views/escala.js:535-536`) | display, `motivoDoFixo` | reads `S.fStatus`, `S.aprovacao`, `S.fixos` | all |
| "conflito" / "fora da regra" / "escolhido" | `span.tag.er[data-dica="conflito"]` (`:539`), `span.tag.fb[data-dica="fora-da-regra"]` (`:494`), `span.sm.escolhido-marca` (`:345`) | display | reads `RES` | all |

### Drawer `#painel-reparo` ("Resolver o conflito <aluno>")

| Label | Element | Handler | State | Profiles |
|---|---|---|---|---|
| "Aplicar" (one per suggestion: "Trocar o avião: …", "Trocar o instrutor: …", "Trocar o avião e o instrutor: …", "Passar para as hh:mm, no …, com …") | `button.btn[data-reparo-aplicar="<i>"]` (`js/views/reparo.js:40`) | document click `js/eventos/escala.js:270-294` → `aplicarReparo` | writes `S.fixos` (the unit's pins) and, when the instructor changes, `insId` of the unit's requests that already had one; History "Reparo: …", revert `restaurarFixos` | Edit |
| "Soltar" ("Soltar o voo: o app escolhe de novo o horário, o avião e o instrutor") | `button.btn.sec[data-reparo-aplicar]` | same | deletes the unit's pins, deletes `insId` of the unit's requests that had one; same revert | Edit |
| "Cancelar o voo" ("Motivo: <motivo>" or "Pede o motivo") | `button.btn.sec[data-reparo-aplicar]` | same, then `pedirDetalheDoStatus` (`js/eventos/escala.js:276-279`) | as the Cancelado status | Edit |
| "✕" (aria-label "Fechar as sugestões") | `button#btn-fechar-reparo.x` | `js/eventos/escala.js:269`; Esc at `:297-299` | none | all who opened it |

### Dialog `#dlg-status` ("Cancelar o voo" / "Voo atrasado")

| Label | Element | Handler | State | Profiles |
|---|---|---|---|---|
| "Motivo" (Meteorologia, Manutenção da aeronave, Aluno ausente, Instrutor indisponível, Operacional, Outro) | `input[type="radio"][name="motivo"]` ×6 in `fieldset.motivos` (`js/views/dialogo-status.js:13-16`) | change `:49-54` shows "Descreva o motivo" | dialog only | Edit |
| "Descreva o motivo" | `input#st-outro[maxlength="140"]` with the hint "Sem dados de saúde ou outros dados pessoais." | read on submit | dialog only | Edit |
| "Nova decolagem" | `input#st-novo[type="time"][step="300"]` | read on submit | dialog only | Edit |
| "Voltar" / "Confirmar" | `button#st-voltar`, `button#st-confirmar` (submit of `form#form-status`, `index.html:685-694`) | submit `js/views/dialogo-status.js:35-47` → `validarDetalhe` → `aoConfirmar(detalhe)` = `aplicarStatus`; close without confirming → `aoDesistir` (`rOut()`, the select returns to the previous status) | see Status above | Edit |

### Dialog `#dlg-agendar` ("Agendar voo" / "Mover o voo" / "Encaixar o voo")

All fields change only the dialog's own state (`escolhas`, `tocados`; `js/views/agendamento.js:191-236`) and re-run `formularioDoAgendamento`; nothing here uses `data-f`, `data-a` or `data-act` (`index.html:723-725`).

| Label | Element | Notes |
|---|---|---|
| "Aluno" | `select#agd-aluno` | groups "Ficaram fora da escala", "Na demanda de <data>", "Outros alunos" (`js/agendamento.js:347`) |
| "Missão" | `select#agd-missao` | groups "Voos de <data> do aluno" (options "Mover …" / "Encaixar …"), "Liberadas no <curso>", "Fora da ordem (pede confirmação)", "Missões do <curso> (a ordem não foi conferida)", "Sem missão do curso" (with "Outro tipo de missão…") (`js/agendamento.js:405,436,437,450,467-470`) |
| "Tipo de missão" | `select#agd-tipo` (hidden unless "Outro tipo de missão…") | |
| "Recurso" | `select#agd-recurso` | a specific resource; unusable ones `disabled` with the reason; "— ocupado agora (o app reorganiza)" (`js/agendamento.js:523`) |
| "Instrutor" | `select#agd-instrutor` | groups "Turmas de <data>" (Ground: "Entrar na turma das hh:mm com … (N alunos)"), "Servem neste horário", "Com aviso", "Não servem" (`js/agendamento.js:572,762`) |
| "Decolagem" | `select#agd-horario` | the type's take-off times, "(ocupado)", "(turma)", plus "Outro horário…" (not for Ground) |
| "Outro horário" | `input#agd-outro-horario[type="time"][step="300"]` | |
| "Duração (h)" | `input#agd-horas[type="number"][min="0.1"][max="5"][step="0.1"]` | disabled for Ground and Noturno |
| "Peso da tripulação": "Aluno (kg)", "Instrutor (kg)" | `input#agd-kg-aluno`, `input#agd-kg-instrutor` in `fieldset#agd-peso` | "O peso digitado fica no cadastro da pessoa." (`index.html:747`) |
| alternatives of a block ("Horários livres", "Recursos livres", "Instrutores livres", "Instrutores que cabem no peso") and "Marcar <nome> disponível às hh:mm" | `button.btn.quiet[data-agd-opcao="horario:<min>"|"recurso:<reg>"|"instrutor:<id>"|"disponibilizar"]` (`js/views/agendamento.js:110`) | click `js/views/agendamento.js:269-277` → `escolherOpcao` |
| "O que muda na escala" | `details#agd-previa` | the preview lines (`linhasDaPrevia`, `js/agendamento.js:1040-1058`) |
| "Voltar" / "Agendar" → "Agendar mesmo assim" | `button#agd-voltar`, `button#agd-confirmar` (submit of `form#form-agendar`) | `enviar` `js/views/agendamento.js:287-316` → `aoConfirmar` = `confirmarAgendamento` `js/eventos/agendamento.js:32-44` |

Profiles: Edit only (`abrirAgendamento` returns at once for `isGestor() || ApiClient.readOnly`, `js/views/agendamento.js:334`; `enviar` checks again at `:290`; the open dialog is locked when the screen turns read-only, `travar` `:321-329`).

### Demanda controls that are operator inputs or that touch pins (`#s-dem`, rows `tr[data-k="d"][data-id][data-mid]`)

| Label | Element | Handler | State written | Profiles |
|---|---|---|---|---|
| "Instrutor" (first option "Automático" or "Automático (prioriza <nomes>)") | `select[data-f="insId"][.escolhido]` (`js/views/demanda.js:76`) | `aoMudarCampo('d')` `js/eventos/demanda.js:203-212` → `escolherInstrutor(S, RES, { stuId, mid }, id)` | `request.insId`; if the flight is already pinned, the pin's `insId` too (whole Ground class); History "Pedido <aluno>: instrutor <nome|automático> (<missão>)", revert `restaurarEscolha` | Edit |
| "Prioridade" | `select[data-f="pr"]` (`js/views/demanda.js:81`) | generic branch `js/eventos/demanda.js:229-266` | `request.pr`; History "Pedido <aluno>: <mis> · <eq> · <duração>"; no revert | Edit |
| "Voa" | `input.sw[type="checkbox"][data-f="fly"]` (`:73`) | `js/eventos/demanda.js:213-223` | `request.fly` (off on the main request also turns the extras off); revert `setFly` ("✕ Excluir" / "↶ Restaurar") | Edit |
| "Missão", "Recurso", "Duração" | `select[data-f="mis"]`, `select[data-f="eq"]`, `input.duracao[data-f="nb"]` (`:74,75,69`) | generic branch | the field; a real change also deletes `etapa` and `cursoDaEtapa` and releases the request's **booked** pin (`soltarAgendado`, `js/eventos/demanda.js:245-249`); no revert | Edit |
| "1ª preferência", "2ª preferência", "Disponibilidade" | `select[data-f="p1"]`, `[data-f="p2"]`, `[data-f="jan"]` (`:77-79`) | generic branch; `jan` at `:224-228` | the field; pins untouched; no revert | Edit |
| "Próxima: <rótulo> · Usar" | `button.usar-proxima[data-act="usar-proxima"]` (`js/views/etapas.js:142`) | `js/eventos/demanda.js:109-117` → `usarMissaoDoCurso` | `fly: true, mis, eq, nb, etapa, cursoDaEtapa`, preferences adjusted; releases the booked pin; no revert | Edit |
| "Outra missão…" | `select.outra-missao[data-f="outra-missao"]` (`js/views/etapas.js:116`) and the armed `button[data-act="usar-fora-da-ordem"]` (`:130`) | `js/eventos/demanda.js:123-151` | as "Usar" | Edit |
| "+ missão" / "✕" (title "Tirar esta missão extra") | `button.btn-add-mis[data-act="add-mis"]`, `button.x[data-act="del-mis"]` (`js/views/demanda.js:57-58`) | `js/eventos/demanda.js:153-182` | adds an extra (`mid: proximoMid`) / removes it and releases its booked pin (`semAgendados`); no revert | Edit |
| "Limpar demanda" | `button#clr[role="menuitem"]` in the "Mais" menu (`index.html:314-318`), second click "Confirmar limpeza" | `js/eventos/demanda.js:81-89` → `limparDemanda(S)` | requests, `fixos`, `fStatus`, `fObs`, `aprovacao` (see 5.1); History "Demanda limpa[ e escala reaberta][ (N voo(s) em andamento fica(m))]", **no revert** | Edit |
| "+ Pôr um aluno na demanda…" | `input#incluir-aluno` (`index.html:303`) | `js/eventos/demanda.js:33-55` | `fly = true` on the main request; revert `setFly` | Edit |
| "agendado hh:mm · <recurso>" | `span.tag[data-dica="voo-agendado"]` (`js/views/demanda.js:43-47`) | display | reads `S.fixos` | all with the tab |

### Histórico (`#historico`) and Instrutores

| Label | Element | Handler | Profiles |
|---|---|---|---|
| "↶ Reverter", "↶ Restaurar", "✕ Excluir", "↶ Desfazer" (the label comes from the stored revert) | `button.x.edit-only[data-act="rev-log"][data-logid]` (`js/views/escala.js:287`), only when `validarReversao` accepts the payload and the entry has an id | `aoAcionar('rev-log')` `js/eventos/historico.js:46-124` | Edit |
| "✕" on an instructor (Instrutores › Cadastro) | `[data-act="deli"]` | `js/eventos/cadastros.js:111-125`: deletes `insId` of every request that chose him and the pins that are `escolhido`, not `agendado`, with him, outside approval and a pinning status | Edit |

## 4. Rules and the tests that pin them

| Rule | Test (file · name) |
|---|---|
| Pinned flights enter first, same time, resource and instructor; new requests fit around | `test/unit/fixos.test.js` · "a escala fixada não muda quando a demanda muda: o pedido novo entra em volta"; "com a escala fixada, pedidos novos de prioridade máxima nunca mexem num voo fixo" (100 generated days) |
| A pin is re-checked on every run; what fails becomes `conflito` + `conflitoCodigos`, the flight stays | same file · describe "Voos fixos conferidos de novo" (11 tests: sem conflito, Parafuso, peso, revisão, lei, bloqueio, período fechado e disponibilidade, duração, voo↔Ground, instrutor e tipo de avião, cancelado não conferido) |
| The pin of a request that is not flying is ignored | same · "pedido que saiu da demanda: o voo fixo dele não aparece" |
| Dividing hours and swapping registrations never touch a pin | same · "a divisão das horas e a troca de matrículas não mexem nos fixos" |
| Lock cycle by status | same · describe "O cadeado do voo" (4 tests); `test/e2e/status.spec.js` · "Pousou: fixa o voo e vai para o histórico; no Ground, a opção se chama \"Concluída\"" |
| Marks survive only when `true`; unknown keys dropped | same · "os dados guardam a marca só quando ela é true: adulterada, sai (o voo fixo continua)" |
| Booked pin survives Pendente/Confirmado, Reabrir, Aprovar (even outside the schedule) | same · "Pendente e Confirmado não soltam o agendado…", "Reabrir mantém o agendado…", "Aprovar fixa cada voo da escala com as marcas…", "Aprovar mantém o agendado que está fora da escala…", "com o motor: o agendado tirado da escala volta ao lugar dele…"; `test/e2e/agendamento.spec.js` · "Confirmado, Aprovar e Reabrir mantêm o voo agendado no lugar" |
| Lock text precedence | same · "o cadeado: o status primeiro, depois o agendamento, a escala aprovada e o instrutor escolhido" |
| `semAgendados` | same · "semAgendados: só os agendados das chaves saem…", "semAgendados com o status: …continua fixo pelo status, só sem a marca" |
| Booked pins go after the other pins; the conflict lands on the booked one | same · describe "Voos agendados no motor" (12 tests) |
| The four rules a booking may break + missing weight become warnings with the fKey | same · "fora dos horários de decolagem…", "depois das 17:30…", "o 7º voo local no mesmo horário…", "o Ground antes do voo…", "o peso que falta…", "o agendado cancelado, em andamento ou que mudou de tipo não avisa…" |
| "Limpar demanda" | same · describe "Limpar demanda" (7 tests) |
| Chosen instructor in the Demanda (engine) | `test/unit/instrutor-escolhido.test.js` · describe "Instrutor escolhido na Demanda: o motor encaixa o voo com ele" (8 tests); e2e `test/e2e/instrutor-escolhido.spec.js` · "na Demanda: o voo sai com o escolhido; o histórico volta para o automático", "o escolhido que não pode voar: o pedido fica fora da escala, com o motivo" |
| Chosen instructor in the Escala | unit · describes "Instrutor escolhido na Escala: o voo fica onde está" (7 tests) and "…o ciclo do voo fixo pela escolha" (5 tests); e2e · "na Escala: o voo fica no horário e no avião dele, fixo, com o escolhido; \"Automático\" solta", "aprovar e reabrir a escala não soltam o voo fixo pela escolha na Escala", "o escolhido excluído…" (2 tests), "no mapa: o nome do instrutor no popup abre a lista…" |
| `insId` and the marks in the stored data | unit · describe "Instrutor escolhido nos dados" (6 tests) |
| What a booking writes; main vs extra; weights; "Marcar disponível"; preview = result | `test/unit/agendamento.test.js` · describe "Agendamento: o pedido e o voo fixo" (5 tests); e2e `test/e2e/agendamento.spec.js` · "pela barra: …o voo fica fixo, vai para a Demanda e o Histórico desfaz", "o peso digitado vai para o cadastro…", "o instrutor indisponível: \"Marcar disponível\" deixa agendar…", "grava só o dia; com um peso digitado, também o cadastro" |
| Blocks, warnings, notes | unit · describe "Agendamento: a conferência" (11 tests); e2e · "a missão fora da ordem pede \"Agendar mesmo assim\"…", "o 7º voo local do horário pede \"Agendar mesmo assim\"…", "o avião com um voo fixo no horário não serve…" |
| Mover / Encaixar | unit · describe "Agendamento: os voos de hoje do aluno (mover e encaixar)" (10 tests); e2e · "mover o voo de hoje: …", "encaixar o pedido que ficou fora: …" |
| Ground classes in a booking | unit · describe "Agendamento: as turmas de Ground" (4 tests); e2e · "no Ground, a aluna entra na turma do dia…" |
| Entry points | `test/e2e/agendamento-mapa.spec.js` · "um clique na linha livre do PR-VOB…", "o \"+\" da linha pelo teclado…", "a linha livre de um instrutor disponível…", "o \"+\" de cada horário da lista agenda a partir dele…", "\"+ Aluno na turma\", no popup da turma de Ground…", "no Gestor, nem o \"+\" nem o clique na linha livre agendam" |
| Sugestões | `test/unit/reparo.test.js` · describe "Sugestões para um conflito" (13 tests) and "toda sugestão aplicada tira o conflito do voo, não cria outro e deixa o instrutor dentro da lei"; `test/unit/reparo-horario.test.js` (3 tests); e2e `test/e2e/reparo.spec.js` (6 tests) |
| Candidates | `test/unit/candidatos.test.js` (5 describes, 18 tests) |
| Status details | `test/unit/status.test.js` (3 describes, 19 tests); e2e `test/e2e/status.spec.js` (8 tests) |
| Revert payloads are validated and never throw | `test/unit/reversoes.test.js` · describe "Reversões do histórico" (6 tests, including "qualquer campo adulterado, de qualquer tipo de reversão, não lança…") |
| Undo of a booking | same · describe "Desfazer um voo agendado na Escala" (13 tests); e2e `test/e2e/historico.spec.js` · "desfazer um voo agendado na Escala: …", "…adulterada não vira botão…", "sem os resultados dos cursos, o voo agendado não é desfeito…", "desfazer um voo movido: …" (3 variants) |
| Revert of an instructor change or of a Sugestão after a booking | same unit file · describe "Reverter depois de um agendamento na Escala" (7 tests); e2e · "desfazer o agendamento e depois reverter a troca de instrutor…", "…reverter o \"Soltar o voo\" das Sugestões…", "desfazer um voo movido e depois reverter a troca de instrutor…" |

All of these use fictitious names ("Aluno 1000", "Instrutor 01", "Maria Silva", "Operador 01") and weights.

### Repo rules this area touches

- **Personal data.** The free text of a cancellation (`fObs[fKey].texto`, "Outro") stays in the day only: the History gets the category (`textoParaOHistorico`, `js/status.js:99-103`), CSV and PDF too (`textoLivre: false`, `js/csv.js:22`, `js/export.js:65`); the dialog says "Sem dados de saúde ou outros dados pessoais." Pinned by `test/unit/status.test.js` "textos: na escala e no CSV o detalhe completo; no histórico só a categoria do motivo" and `test/e2e/status.spec.js` "\"Outro\" pede a descrição, que aparece na escala e não vai para o histórico". The booking writes **weights with the person's name into the History** ("Peso <nome>: <kg> kg (agendamento)", `js/agendamento.js:1278`), as the roster edit already does (`js/eventos/cadastros.js:156`); weight is not in the repo's personal-data list (CPF, CANAC, nascimento, celular, e-mail: `README.md:219`). Every History text of this area carries the student's and the instructor's names.
- **`runAllocationEngine` is pure.** The booking check runs it on a copy (`simularAgendamento` clones `stu`, `ins`, `fixos`, `fStatus`, `fObs`, `js/agendamento.js:960-967`) and the dialog recomputes the base with it (`js/views/agendamento.js:338,356`). The modules of this area have no DOM or network, but `aplicarAgendamento`, `escolherInstrutor`, `escolherNosPedidos`, `limparDemanda`, `desfazerAgendamento`, `reverterEscolha` and `reverterReparo` mutate the state object they receive.
- **`gravarAlteracao` is the only way events change data.** Every handler of this area saves through it: `js/eventos/agendamento.js:36`, `js/eventos/escala.js:137,183,206,215,289`, `js/eventos/demanda.js:42,85,115,129,149,169,180,189,208,267`, `js/eventos/historico.js:59-120`. Two History lines are written with `logChange` directly: the typed weights, right after the save of the same event (`js/eventos/agendamento.js:38`), and a mission result, which is stored on the server and not in the day (`js/eventos/escala.js:255-256`).
- **Data-format steps never delete fields.** `insId` (format 22) and the `agendado` mark and `cursoDaEtapa` (format 24) came as no-op steps whose only effect is that an older tab refuses to save (`js/migracoes.js:176-206`). Separately from the steps, the load-time normalisers drop what is out of format by design: `normalizarFixos` (invalid pins, unknown keys), `normalizarStatus`, `normalizarDetalhes`, `normalizeMissionFields`.

## 5. Answers

### 5.1 Pins

**Kinds.** There is one pin object per flight key; "kind" is a combination of two marks on the pin and two facts outside it.

| Kind | How it is recognised | Created by | Released by |
|---|---|---|---|
| by approval | pin present and `aprovacao` not null (no mark) | "Aprovar escala": every line of `RES.out` gets a pin (`fixosAoAprovar`, `js/fixos.js:59-69`) | "Reabrir" (`fixosAoReabrir`, `:52-53`), "Limpar demanda", "Soltar" in Sugestões. At approval time, any pin that is not `agendado` (also one with `escolhido`) and whose flight is not in the schedule is dropped by `fixosAoAprovar` (`:67-68`). |
| by status | `fStatus[fKey]` in `['Em Voo','Atrasado','Pousou','Cancelado']` (`STATUS_QUE_FIXAM`, `js/fixos.js:40-41`); no mark | choosing one of those statuses pins the flight where it is, keeping an existing pin (`fixosAoMudarStatus`, `:44-46`) | going back to Pendente or Confirmado, only outside approval and only if the pin has no mark (`:47-49`). "Limpar demanda" keeps Atrasado, Em Voo and Pousou (`STATUS_EM_ANDAMENTO`) and clears Cancelado (`:102`). |
| `escolhido` | `pin.escolhido === true` | choosing an instructor on a flight **in the Escala** (`noLugar: true`, `js/instrutor-escolhido.js:116`) | "Automático" (Escala or Demanda): the pin is deleted only if `soltavel` (no approval, no pinning status, not `agendado`), otherwise only the mark goes (`:80,117-120`); a new booking on the key replaces the pin without the mark (`js/agendamento.js:921-924`); deleting the instructor (`js/eventos/cadastros.js:124`); "Soltar"; "Limpar demanda". |
| `agendado` | `pin.agendado === true` | `aplicarAgendamento` (`js/agendamento.js:921-924`) | "↶ Desfazer" in the History; in the Demanda: a real change of `mis`, `eq` or `nb`, "Usar", "Outra missão…", removing the extra (`semAgendados`, `js/fixos.js:78-85`: with a pinning status the pin stays without the mark), "Limpar demanda"; "Soltar". **Not** released by Pendente/Confirmado, Reabrir, Aprovar (kept even when the request is out of the schedule, `:67`), nor by "Automático". |

Both marks may be on the same pin (`{ …, escolhido: true, agendado: true }`, `test/unit/fixos.test.js` "Reabrir mantém o agendado…").

**Precedence.**
- Lock text (`motivoDoFixo`, `js/fixos.js:179-186`): "Voo fixo: <status>" (with "Concluída" for Ground/simulator) → "Voo fixo: agendado na escala" → "Voo fixo: escala aprovada" → "Voo fixo: instrutor escolhido na escala" → "Voo fixo".
- Engine order (`js/engine.js:399-406`): the return leg of yesterday's Noturno first (`:370-393`), then every pin without `agendado`, then the `agendado` ones; inside each group, the request queue order (Ground first, request with a chosen instructor, `pr` 5 to 1, "Priorizar com", Agenda order, roster order: `:333-338`). The later flight takes the conflict, so a booked flight yields to approved, status and chosen pins.
- The engine never reads `pin.escolhido`. It reads `pin.agendado` (order, warnings, alert text). The line mark `insEscolhido` on a pinned flight comes from the request: `d.insId === x.id` (`js/engine.js:528`).

**What a Demanda change does.**

| Change | Requests | Pins / status |
|---|---|---|
| "Limpar demanda" (`limparDemanda`, `js/fixos.js:95-117`) | every request blanked with `deixarEmBranco` (also drops `jan`, `etapa`, `cursoDaEtapa`, `solicitacao`, `insId`), every extra removed; except flights in Atrasado, Em Voo, Pousou, kept whole | pin, status and detail of each blanked key removed, whatever the kind; in-progress flights keep pin (with marks), status, detail; approval reopened (`fixosAoReabrir` on what is left, `aprovacao = null`). `importadas` is not reset (its only writer is `js/agenda.js:116`), so pedidos already imported are not brought back by "Importar da agenda" after the clearing. No revert. |
| "Usar", "Outra missão…", "usar-fora-da-ordem" (`usarMissaoDoCurso`, `js/eventos/demanda.js:94-99`) | `fly: true`, `mis`, `eq`, `nb`, `etapa`, `cursoDaEtapa`; `insId` kept | only the `agendado` pin of that key goes (`soltarAgendado`, `:25-30`); other pins stay and are re-checked (may become `duracao`, `tipo-de-aviao`, `ground-ou-voo`, `habilitacao`… conflicts) |
| `mis`, `eq` or `nb` by hand, when the value really changes (`js/eventos/demanda.js:245-249`) | `etapa` and `cursoDaEtapa` deleted | same as above |
| `p1`, `p2`, `pr`, `jan`, `insId` | the field | no pin released. With `jan` outside the pinned time the flight gets the `disponibilidade` conflict (`js/engine.js:447-448`); `insId` also rewrites the pin's `insId` when a pin exists (`js/instrutor-escolhido.js:93,116`). |
| "Voa" off / "✕" in the Escala | `fly = false` | pin untouched but dormant: the engine only walks pins of requests in the queue (`comPino = act.filter(chaveFixa)`, `js/engine.js:400`). Back on, the flight returns to the pinned place. |
| Removing an extra | the extra goes | its `agendado` pin goes; any other pin, status or detail of that key stays as a leftover, which makes `proximoMid` skip the number (`js/rules.js:54-72`) |
| "Importar da agenda" | a hand-made request of the same mission gives way to the pedido only if its key has **no pin**, no pinning status and no result (`vooQueDaLugar`, `js/agenda.js:86-93`) | none |
| Deleting a student (`dels`) | the student leaves `S.stu` | `fixos`, `fStatus`, `fObs` of that student are not cleaned (`js/eventos/cadastros.js:127-129`); the engine ignores them |

**How the engine treats a pin** (`js/engine.js:406-534`). Same code for every kind: the flight is put at `pin.a`–`pin.b` on `pin.r` with `pin.insId` and checked with the engine's own rules (instructor problems from `problemasDoInstrutor`, aircraft type and attributes, maintenance, aircraft or room busy, 50 h balance, student busy, `win` period closed, student availability, duration vs the request, flight↔Ground). Each failure adds a text and a code; the flight stays in place with `conflito`, and an alert `t: 'conf'` is emitted: "Conflito no voo agendado: …" for a booked pin, "Conflito na escala aprovada: …" for **every other pin, approved or not** (`:533`). A Cancelado pin is not checked and occupies nothing (`:426`). A delayed pin occupies the new interval after the other pins were checked (`:491-492,536`). Extra for `agendado` only (not in progress, not cancelled, not changed of type): warnings `fora-dos-horarios`, `depois-das-17h30`, `limite-de-locais`, `sem-peso` (`:450-477`) and `antes-do-ground` (`:537-553`), each with `fKey`. Pinned flights are excluded from the hour division (`presa`, `:186`), from the registration swap (`preso`, `:95`) and from compaction (`js/compactar.js:90`). A pinned Ground class stays open for new students of the same Ground when it has no conflict (`:505-511`).

### 5.2 The chosen instructor

| | Demanda | Escala |
|---|---|---|
| Data | `request.insId` only (per date). If the flight already has a pin, `pin.insId` follows, marks unchanged (`js/instrutor-escolhido.js:93,116`). | `request.insId` **and** a pin `{ a, b, r, insId, classKey?, escolhido: true }` built from the current line (`pinoDoVoo`, `:116`). In a Ground class, every student of the class (`unidadeDe`, `:44,94-95`). |
| Engine | The request goes to the front of the queue after the Grounds (`semEscolha`, `js/engine.js:331-337`); only that instructor is tried (`passadas`, `:587`); refused at once with code `instrutor-escolhido` if he is off for the date, lacks the habilitação or is in "Não escalar com" (`:576-583`); hour division and compaction do not change him (`:186`, `js/compactar.js:97`). An `insId` no longer in the roster counts as no choice, with the warning `escolhido-saiu` (`:330-331,988-995`). | As any pin (5.1). An instructor who does not fit may be chosen: the flight stays, in conflict (`test/unit/instrutor-escolhido.test.js` "o instrutor que não serve no horário pode ser escolhido: o voo fica fixo, em conflito"). |
| UI | `select[data-f="insId"]`, class `escolhido` when set; options from `instrutoresDoPedido` (qualified, not blocked; "(fora nesta data)"; the chosen one always listed, with "(em Não escalar com)", "(sem a habilitação)" or "Instrutor fora do cadastro (o app escolhe)") | the name is `button.ins-btn` (class `escolhido`, plus `span.escolhido-marca` "escolhido" for the Gestor); click swaps it for `select.ins-sel[data-a="insVoo"]` from `instrutoresDoVoo` with notes "ocupado com <aluno | a turma de <missão>>", "indisponível", "sem a habilitação", "em Não escalar com", "limite da lei", "peso acima do limite" (`NOTA_DO_PROBLEMA`, `:38-41`); also inside the map popup. Toasts: "<nome> fica com o voo; o resto da escala foi refeito em volta." / "O app volta a escolher o instrutor deste voo." |
| Revert | `restaurarEscolha` with `{ pedidos: [{ stuId, mid, insId }] (0 = Automático), fixos: { fKey: pin before }, soltar: [fKeys that had no pin] }`, label "↶ Reverter" (`js/eventos/demanda.js:208`, `js/eventos/escala.js:183`). Applied by `reverterEscolha` (`js/instrutor-escolhido.js:138-153`): requests back, pins back; a flight that was not pinned is unpinned unless meanwhile approved, status-pinned or booked (then only the mark goes); booked pins come back only while the booking still stands (`fixosQueVoltam` + `agendamentosEmVolta`). | same |

### 5.3 The booking dialog

Entry points (six, all the same dialog): `#btn-agendar` (`dia`), the "+" of a time header (`w:<n>`), the "+" of a resource row (`r:<REG>`), the "+" of an instructor row (`i:<id>`), "+ Aluno na turma" (`t:<classKey>`), and a click on the free part of a map row (`{ r | insId, minuto }`).

What "Agendar" writes (`aplicarAgendamento`, `js/agendamento.js:899-943`, then `gravarAlteracao`, `js/eventos/agendamento.js:36`):

1. **A request in the Demanda.**
   - New flight: target = `alvoDoNovoPedido` (`js/rules.js:95-100`): the main request when the student is not flying and the day keeps nothing for `<stuId>_0_1` (no pin, status, detail or result), blanked first with `deixarEmBranco` (so a previous `solicitacao`, `jan`, `etapa`, `insId` are lost); otherwise a new extra `{ mid: proximoMid, …blank(), pr: aluno.pr || 3 }`.
   - Fields written: `fly: true`, `mis`, `eq` (the resource type), `nb`, `p1: a`, `p2: -1`, `insId`; `etapa` + `cursoDaEtapa` when a course mission was picked, else both deleted; then `normalizeMissionFields`.
   - "Mover" / "Encaixar" (an existing request of the student): the same request receives `fly: true, eq, nb, p1, p2, insId`; `mis`, `etapa`, `cursoDaEtapa`, `solicitacao`, `pr` stay; `jan` is deleted when it excludes the new time (`:916-917`).
2. **The pin** `fixos[fKey] = { a, b, r, insId, classKey?, agendado: true }`, replacing whatever pin was there (`:921-924`). Ground: `r` is `SALA-GROUND`; `classKey` is the joined class's key, or a new key only when the flight's own key is already another class's key (`chaveDaTurmaNova`, `:880-887`).
3. **Weights to the roster**: `aluno.kg` and/or `instrutor.kg` when the typed value differs (`:926-933`); one History line each, "Peso <nome>: <kg> kg (agendamento)", no revert (`js/eventos/agendamento.js:38`).
4. **Instructor availability of the date**, only with "Marcar disponível": `x.on = true` and `x.aw[k] = true` for each of the nine windows the flight overlaps (`:934-939`).
5. **History**: type `inc` (new) or `mod` (moved or fitted), text "Agendado na escala[ aprovada]: <aluno> · <etapa (missão) | missão> · hh:mm–hh:mm · <recurso> · <instrutor>[ (era hh:mm no <recurso>) | (estava fora da escala)][ · entrou na turma][ · confirmado: <resumos>][ · <instrutor> marcado disponível às hh:mm]" (`descricaoDoAgendamento`, `:1252-1270`), revert `desfazerAgendamento`.

In shared mode this is one write of `dia:<data>`, plus `cadastro` when a weight changed (`test/e2e/agendamento.spec.js:538-555`).

**Does a booking create a pedido today? No.** No file of the booking calls `registrarSolicitacao`; its only callers are `js/eventos/agenda.js:99` (register) and `:147` (cancel). The only mention of `solicitacao` in `js/agendamento.js` is the sort key at `:143`. A booked request has no `solicitacao` (and loses one if it took over a blanked main request).

**What a booking would write when requests are derived from approved pedidos** (facts that constrain the answer; options in section 7):
- A pedido today holds `data, aluno, aluno_nome, missao, janela, horario, horas, observacao, registrado_por, excecao` (`js/backends/supabase.js:218`). It has no resource type, no course mission, no instructor, no specific resource, no priority.
- A booking decides more than a pedido holds: the course mission (possibly out of order, of another course, already approved: confirmed warnings, `js/agendamento.js:1111-1123`), the resource type, the specific resource, the instructor, the exact time and end, and optionally weights and availability.
- The server function that registers a pedido refuses what a booking only warns about: a date past the 13:00 deadline without "Exceção da Coordenação", and the 7th local flight at the same time (`supabase/migrations/20261114230012_agenda_limite_de_locais.sql:32-48`); a booking gives the confirmable warnings `limite-de-locais`, `domingo`, `data-passada`, `horario-passado` (`js/agendamento.js:1162-1191`).
- Everything the booking pins is addressed by `(stuId, mid)`; a derived Demanda must give each pedido a stable `mid`, or the pin, status, result and History of a booked flight move to another flight when a pedido is added or cancelled.

### 5.4 Sugestões and status changes as operator inputs

Sugestões exist only for a pinned flight with `conflito` (`sugerirReparos` returns `[]` otherwise, `js/reparo.js:24`). The conflict groups decide the options (`gruposDoConflito`, `js/conflitos.js:49-57`).

| Option (`tipo`) | Offered when | Writes |
|---|---|---|
| `aviao` "Trocar o avião: <recurso>" | aircraft-group conflict only, same time, an aircraft the current instructor flies | `pin.r` |
| `instrutor` "Trocar o instrutor: <nome>[ · reduzir N gal]" | instructor-group conflict only | `pin.insId`; `insId` of the unit's requests that already had a chosen instructor (`escolhasDaUnidade`, `escolherNosPedidos`, `js/eventos/escala.js:283-285`) |
| `ambos` "Trocar o avião e o instrutor: <recurso>, com <nome>" | both groups | `pin.r`, `pin.insId` (+ requests as above) |
| `horario` "Passar para as hh:mm, no|na <recurso>, com <nome>" | nothing fits at the same time; first later take-off time with `win` open, inside each student's `jan`, before `fimDasMissoesDoDia` and, for a Ground, before the flights it gates (`js/reparo.js:73-102`) | `pin.a`, `pin.b`, `pin.r` (not for Ground), `pin.insId`. The request's `p1`/`p2` are not changed. |
| `soltar` "Soltar o voo: o app escolhe de novo o horário, o avião e o instrutor" | always, except with a status in progress (`:105-106`); the only suggestion when the request changed (group `pedido`) | deletes the unit's pins, whatever their marks (`aplicarReparo`, `:123`), and the chosen instructor of the unit's requests that had one |
| `cancelar` "Cancelar o voo (pede o motivo)" | always | opens `#dlg-status` with the suggested reason ("Instrutor indisponível" or "Manutenção da aeronave", `motivoDoConflito`, `:111-115`); on confirm, as the Cancelado status, for that one flight key |

The three same-time options are offered only when the conflict has no `horario`-group and no `pedido`-group code (`js/reparo.js:54`). At most 3 change options (`maximo = 3`). A change keeps the pin's marks (`{ ...fixos[k], ...mudancas }`, `:124`) and applies to every pinned student of a Ground class. History: "Reparo: <aluno> (hh:mm–hh:mm): <texto | Soltar o voo>", revert `restaurarFixos { fixos: the changed pins as they were, pedidos?: [{ stuId, mid, insId }] }` (`js/eventos/escala.js:289-291`).

Status (`aplicarStatus`, `js/eventos/escala.js:123-138`): writes `fStatus[fKey]` (also an explicit `Confirmado`), `fObs[fKey]` (the validated detail; without the dialog, `detalheAoMudarStatus` keeps `novoInicio` for Em Voo and Pousou and deletes the detail otherwise), and `fixos` through `fixosAoMudarStatus`. History "Status de <aluno> (hh:mm–hh:mm): <status[ (nova decolagem hh:mm) | (<motivo>)]>" with the reason's category only (`textoParaOHistorico`, `js/status.js:99-103`). **A status change has no revert kind**; it is undone by choosing another status.

### 5.5 History reverts

Nine kinds (`validarReversao`, `js/reversoes.js:43-117`; applied in `js/eventos/historico.js:46-124`). Each revert writes a new entry "Revertido: …" with `reverte = entry.id`; the reverted entry stops showing (`js/views/escala.js:271-272`).

| Kind (label) | Created at | Payload | What applying it writes, and what it assumes |
|---|---|---|---|
| `setFly` ("↶ Reverter", "↶ Restaurar", "✕ Excluir") | `js/eventos/demanda.js:42,190,221` | `{ stuId, mid, val, extras?: [mid…] }` | `request.fly = val` on `(stuId, mid)` and on each listed extra. Assumes a stored `fly` per request and stable `mid`s. |
| `setAv` | `js/eventos/recursos.js:126` | `{ reg, val }` | `S.av[reg]` (other area) |
| `setAtributo` | `js/eventos/recursos.js:86` | `{ reg, atributo, val }` | a fleet attribute (other area) |
| `setInsOn` | `js/eventos/cadastros.js:146` | `{ insId, val }` | `ins[].on` of the date (other area; touched by the availability redesign) |
| `restaurarFixos` | `js/eventos/escala.js:290` (Sugestões) | `{ fixos: { fKey: pin }, pedidos?: [{ stuId, mid, insId }] }` (≤ 100) | `reverterReparo` (`js/instrutor-escolhido.js:177-183`): merges the old pins into `S.fixos`, restores `insId` on the requests. Assumes `fixos` keyed by fKey, `insId` stored on the request. Reads the whole date's History (`agendamentosEmVolta`) and the requests' `fly`, `mis`, `eq`, `nb`, `etapa`. |
| `restaurarEscolha` | `js/eventos/demanda.js:208`, `js/eventos/escala.js:183` | `{ pedidos: [{ stuId, mid, insId (0 = Automático) }], fixos, soltar: [fKey…] }` | `reverterEscolha`: `insId` back on each request, pins back, the `soltar` keys unpinned (or only unmarked). Same assumptions, plus `aprovacao` and `fStatus`. |
| `restaurarHorarios` | `js/eventos/recursos.js:213` | `{ cat, lista, pedidos: [{ stuId, mid, p1, p2, jan? }] }` (≤ 500) | `S.horarios[cat]` and `p1`, `p2`, `jan` of each listed request. Assumes those three fields are stored on the request. |
| `readicionarRecurso` | `js/eventos/recursos.js:155` | `{ recurso, av }` | fleet (other area) |
| `desfazerAgendamento` ("↶ Desfazer") | `js/agendamento.js:1273-1274` via `js/eventos/agendamento.js:36` | `{ stuId, mid, criado, pedido (the 13-field request before, or null when an extra was created), fixo (pin before or null), disponibilidade ({ insId, on, aw[9] } or null), criadoComo (the request as the booking left it) }` | `desfazerAgendamento` (`js/reversoes.js:165-191`): created extra → removed from `stu[].extra`; otherwise the 13 fields are deleted from the request and the old ones assigned (a request no longer flying stays not flying); created → `fixos`, `fStatus`, `fObs` of the key deleted; moved → the old pin back (`pinoDeVoltaNaTurma` for a Ground class), or the pin deleted, or kept without the mark if a status pins it; `ins[].on` and `aw` back. Weights are never reverted. |

Guards on the booking undo (`motivoParaNaoDesfazer`, `js/reversoes.js:136-149`): student gone; request gone (moved flight); the request no longer equals `criadoComo` on `mis, eq, nb, etapa, p1, p2` ("O pedido mudou depois do agendamento…"); status Em Voo, Atrasado or Pousou; results not read (`estado.indisponiveis` has `resultados`); a result recorded for the fKey.

Interaction rule: reverting an instructor change or a Sugestão after a booking (`agendamentosEmVolta`, `js/reversoes.js:202-229`) scans the date's History for `desfazerAgendamento` entries before and after the reverted one and compares the current request with `criadoComo`, to decide which booked pins must not come back.

Consequences of moving the requests' source of truth:
- `setFly`, `restaurarEscolha`, `restaurarFixos` (its `pedidos`), `restaurarHorarios` and `desfazerAgendamento` write request fields by `(stuId, mid)`: `fly`, `insId`, `p1`, `p2`, `jan`, and for the booking all 13 fields and the `extra` list itself.
- The payloads already stored on the server keep today's shape forever. `validarReversao` is the only gate; a kind it stops accepting silently loses its button on old dates.
- `disponibilidade.aw` is validated as exactly `WIN.length` (9) booleans (`js/reversoes.js:39-40`).

### 5.6 Operator inputs that exist today

| # | Input | Where the operator gives it | Stored in | Kind |
|---|---|---|---|---|
| 1 | Pin by approval | "Aprovar escala" / "Reabrir" | `dia.fixos` + `dia.aprovacao` | restriction on every flight (time, resource, instructor) |
| 2 | Pin by status | Status select (Em Voo, Atrasado, Pousou, Cancelado) + detail | `dia.fStatus`, `dia.fObs`, `dia.fixos` | day-of-operation fact that also pins |
| 3 | Instructor chosen in the Escala | name → list in the Escala or map popup | `request.insId` + `dia.fixos[fKey].escolhido` | restriction (instructor + place) |
| 4 | Booked flight | `#dlg-agendar` | request (main or extra) + `dia.fixos[fKey].agendado` (+ roster weights, + `dia.ins`) | restriction that also creates or rewrites the request |
| 5 | Edited pin | Sugestões "Aplicar" | `dia.fixos` | restriction edit |
| 6 | Released pin | Sugestões "Soltar"; "Automático" | `dia.fixos` (deleted), `request.insId` (deleted) | removal of a restriction |
| 7 | Instructor chosen in the Demanda | `select[data-f="insId"]` | `request.insId` | restriction (instructor only) |
| 8 | Priority | `select[data-f="pr"]` | `request.pr` | operator weighting; not in the pedido (import always sets 3) |
| 9 | Taken off the schedule | "Voa" off, "✕" in the Escala, "✕ Excluir da escala" | `request.fly = false` | exclusion |
| 10 | Mission override | "Usar", "Outra missão…", `data-f="mis"` | `request.mis`, `etapa`, `cursoDaEtapa` | override of a derived value |
| 11 | Resource type override | `select[data-f="eq"]` | `request.eq` | override of a derived value (type, not a tail number) |
| 12 | Duration override | `input[data-f="nb"]` | `request.nb` | override (the pedido has `horas`) |
| 13 | Preference / availability override | `data-f="p1"`, `"p2"`, `"jan"` | `request.p1`, `p2`, `jan` | override (derived from the pedido's `janela`/`horario`, `js/agenda.js:63-80`) |
| 14 | Requests made by hand | "+ Pôr um aluno na demanda…", "+ missão" | request with no `solicitacao` | a request without a pedido |
| 15 | Optimisation settings | `[data-criterio]` buttons | `dia.criterios` | the request's input 3; locked while approved (`js/eventos/escala.js:224`) |
| 16 | "Marcar disponível" | inside the booking | `dia.ins[id].on`, `aw` | changes a resource-side restriction of the date |

Columns of today's Demanda table (`index.html:326-335`):

| Column | Field | Is it pedido data? |
|---|---|---|
| Aluno | the roster student | pedido (`aluno`) |
| Voa | `fly` | derived (an approved pedido exists); "off" by hand is an operator exclusion (#9) |
| Missão | `mis` (+ `etapa`, `cursoDaEtapa` shown beside the name) | `mis` is pedido data (`missao`); the course mission is derived by the progress on import (`js/agenda.js:119-127`) and overridable (#10) |
| Recurso | `eq`, a **type** from `MIS[mis].eq` (`js/views/demanda.js:20-23`) | derived (the program's `eq` or the mission's `defEq`, `js/agenda.js:66`); a change is an override (#11). No specific resource is ever stored on a request. |
| Instrutor | `insId` | **operator restriction** (#7); not in the pedido |
| 1ª preferência, 2ª preferência | `p1`, `p2` | derived from the pedido's time (`js/agenda.js:67-70`); a change is an override (#13) |
| Disponibilidade | `jan` | pedido data (`janela`/`horario` → `disponibilidadeDaSolicitacao`, `js/agenda.js:52-56`) |
| Duração | `nb` | pedido data (`horas`), else the program's, else the mission default (`js/agenda.js:60-74`) |
| Prioridade | `pr` | **operator input** (#8); not in the pedido |

### 5.7 The two dialogs and the drawer

| | `#dlg-agendar` | `#dlg-status` | `#painel-reparo` |
|---|---|---|---|
| Element | `<dialog class="dlg dlg-agendar">`, opened with `showModal()` (`js/views/agendamento.js:347`) | `<dialog class="dlg">`, `showModal()` (`js/views/dialogo-status.js:74`) | `<aside class="gaveta" hidden>`, non-modal, stacked by `abrirGaveta` (`js/dom.js:45`) |
| Opens from | six entry points (5.3) | the status select changing to Atrasado or Cancelado; a click on the detail text; "Cancelar o voo" in the drawer | "Sugestões" in the conflicts box |
| Fields | up to 10 inputs, option lists rebuilt on every change, an engine run on a copy 150 ms after the last change, blocks with one-click alternatives, warnings that need a second "Agendar mesmo assim" | one group: 6 radios + a text ≤ 140, or one time input | none; a list of up to 5 one-click actions |
| Does it show a stored record? | No list of bookings and no "open this booking": a booked flight is shown in the Escala (lock) and the Demanda (tag). It does load an existing request when the choice is "Mover …" or "Encaixar …" (title "Mover o voo" / "Encaixar o voo"), then rewrites that request and its pin. | Opened from the detail text it shows the stored detail of that flight (`detalhe`, `js/eventos/escala.js:192`) and rewrites it. | Shows the flight's line and conflict text, read-only. |
| Does it edit roster records? | Yes, as a side effect: the weights of the student and the instructor ("O peso digitado fica no cadastro da pessoa.") and the instructor's availability of the date ("Marcar … disponível"). | No. The free text never leaves the day (not in History, CSV or PDF). | No. |
| Cancel | Esc or "Voltar": nothing changes (`js/views/agendamento.js:278-284`) | Esc or "Voltar": the previous status stays (`js/views/dialogo-status.js:55-63`) | Esc (top drawer) or "✕"; closes itself when the conflict disappears (`js/views/reparo.js:64-69`) |
| Coupled to the page | redrawn when the schedule changes underneath (`atualizarAgendamento`, called by `rOut`, `js/views/escala.js:630`) | none | redrawn by `rOut` (`:628`) |

There is also `#tl-pop` (`<div class="tl-pop" role="dialog" aria-label="Detalhes do voo">`, `index.html:762`): a non-modal popup that shows one flight (time, student or class, instructor, resource, mission, weight, fuel, status) and holds the status select, the instructor button, "+ Aluno na turma" and "✕ Excluir da escala" (`js/views/escala.js:42-65`).

## 6. Conflicts with the request

1. **"Restrições impostas pelo operador, which override any rule."** In the code an operator restriction overrides the app's *choice*, not the rules. (a) Every pin is re-checked on every run and flagged with one of 19 conflict codes while staying in place (`js/engine.js:421-449`, `js/conflitos.js:5-25`). (b) The booking dialog refuses to save when the engine would flag the new flight or any other flight (`bloqueios`, `js/agendamento.js:1093-1108`; `test/unit/agendamento.test.js` "o avião, o aluno e o instrutor ocupados por um voo fixo, o horário fechado e o peso acima do limite bloqueiam" and "o voo de outro aluno que fica em conflito por causa do agendamento bloqueia"); only the four `CODIGOS_DO_AGENDADO` rules, the course rules and a missing weight can be confirmed past (`js/conflitos.js:63`, `js/agendamento.js:1110-1194`). (c) A request whose chosen instructor cannot fly it is rejected (`instrutor-escolhido`, `js/engine.js:576-583`), not forced. The only place the operator can force an infeasible choice is the instructor list of the Escala (the flight then sits in conflict).
2. **"These exist: fixed flights, the chosen instructor, '+ Agendar voo'."** The list is short by: the pins created by a status (four statuses), the pins created by Aprovar itself, the pin edits of Sugestões, the priority, the exclusion ("Voa" off / "✕"), the per-request overrides and hand-made requests (5.6 #8 to #14), and "Marcar disponível".
3. **"a Recurso … fixed on a request"** (brief, question 6). The Demanda's "Recurso" column is the resource *type* (`eq`: C152, C172, PA-34, Sim. Mono, Sim. Multi, Sala Ground). A specific resource is only ever fixed by a pin (`fixos[fKey].r`).
4. **"[The Demanda] becomes an aggregation and enrichment stage with no data of its own."** Today the request record is where operator inputs live (`insId`, `pr`, the overrides, `fly`), where bookings, "+ missão" and "Pôr um aluno na demanda" create flights that have no pedido, and what every pin, status, detail, result and five revert kinds are keyed on (`(stuId, mid)`). A booking creates no pedido (5.3).
5. **"Approval … becomes the last stage."** In the code approval is not terminal and is itself the largest source of pins: `fixosAoAprovar` pins every flight (`js/eventos/escala.js:204`); afterwards the operator keeps booking ("Agendado na escala aprovada", `js/agendamento.js:1261`), changing statuses, applying Sugestões (the drawer's own comment and texts say "na escala aprovada", `js/views/reparo.js:1,36`), and new requests fit around. Reopening is also triggered by "Limpar demanda" (`js/fixos.js:111-115`). The optimisation settings are locked while approved (`js/eventos/escala.js:224`).
6. **"No modal or pop-up for viewing or editing a record."** The booking modal writes roster fields (student and instructor weight) and the instructor's availability of the date; the map popup `#tl-pop` shows and edits a flight. (Whether a flight is a "record" in the request's sense is for the plan to decide; the request states the rule for the cadastros.)
7. **"the engine and its 41 goldens stay untouched" as the safety net.** The 41 goldens contain no pin, no chosen instructor and no "Priorizar com" (section 1), so they cannot detect a regression in the operator-restriction paths if Processamento rebuilds the state.
8. **The conflict alert text.** "Conflito na escala aprovada: …" is emitted for any pin that is not `agendado`, including a pin by chosen instructor or by status on a schedule that was never approved (`js/engine.js:533`); the Escala box title is correct in that case ("N voos fixos em conflito", `js/views/escala.js:474`).

## 7. Implications and options for the redesign (suggestions)

Facts that bind any option:
- `normalizarFixos` rebuilds each pin with known keys only (`js/fixos.js:19-25`), `separar` saves only `CAMPOS_DO_PEDIDO` for the main request (`js/dias.js:60`), `validarReversao` returns known fields only. A new pin mark, request field or revert field must be added in those three places and come with a format number (an older tab would otherwise strip it on save; this is how formats 22 and 24 were introduced as no-op steps, `js/migracoes.js:176-206`).
- Readers of `win` in this area: `js/agendamento.js:107`, `js/reparo.js:89`, `js/engine.js:446` (conflict code `horario-fechado`, group `horario`), with tests "o período fechado nesta data e fora da disponibilidade do aluno" (`test/unit/fixos.test.js`), "o horário fechado nesta data: um horário mais tarde…" (`test/unit/reparo.test.js`), "os horários de cada missão, só nas janelas abertas…" (`test/unit/agendamento.test.js`).
- Users of the nine-window availability `aw` in this area: "Marcar disponível" (`js/agendamento.js:934-939`), its stored undo payload (`js/reversoes.js:38-40,186-189`), the booking context `w:<0-8>` and the Ground class key `GND_<missão>_<período>_<instrutor>` (`js/agendamento.js:94-97,883`).
- The naming collision: `criterios.horarios === 'fixos'` ("Não mudar") is unrelated to `fixos` the pins (`js/criterios.js:11`).
- This area's e2e tests address the header date controls the request replaces: `#dt-prox` and `#dt` (`test/e2e/historico.spec.js:48-49`), `#dt-rel` (`test/e2e/agendamento.spec.js:392`); and the tab ids through the `irPara(page, 'dem' | 'ins' | 'alu')` helper and `#s-esc [data-tl="eq" | "ins" | "lista"]`.
- Phone rules already pinned for the booking dialog: at 390 px it fits the screen and every `select`, `input`, `button` and `summary` in it is at least 44 px tall (`test/e2e/agendamento.spec.js` "no celular (390 px), o diálogo cabe na tela e os campos e botões têm 44 px" and "…\"O que muda na escala\" e as alternativas de um bloqueio também têm 44 px").
- The dialog's texts name the open date relative to today ("hoje", "amanhã" or "11/11"; `nomeDaData`, `js/agendamento.js:61-65`), reading `DATA` and `hojeISO()` (`js/views/agendamento.js:39`); with the right rail as the only date control this keeps working as long as `DATA` stays the single open date.

Suggestions (each is a suggestion, not a finding):

1. **Keep `(stuId, mid)` as the flight identity and make Processamento assign it stably.** Persist, in the day, the map pedido id → `mid` (today's `request.solicitacao` already links a request to its pedido) and never renumber. Cost: one new day field and its data-format step; Processamento is no longer a pure function of the pedidos alone (it needs the stored map). Risk: if the map is recomputed instead of stored, pins, statuses, results (server rows hold the fKey) and History reverts attach to the wrong flight.
2. **Give operator restrictions their own per-date store** (for example a `restricoes` object in the day keyed by fKey: `insId`, `pr`, the overrides, the exclusion), next to `fixos`, and have Processamento merge approved pedidos + that store into today's state shape. Cost: rewrite every writer in `js/eventos/demanda.js`, `escolherInstrutor`, `aplicarAgendamento`, `limparDemanda` and five revert kinds; a data-format step that copies the fields out of the requests without deleting them. Risk: two places for `insId` during the transition; old History payloads (see 4).
3. **Booking, option A: a booking registers a pedido** (origin "operador", approved at creation) and then pins it. Cost: a server path that skips or relaxes the deadline, the Sunday rule and the 6-local limit for the operator (migration + pgTAP), plus fields the pedido lacks (course mission, resource type). Risk: the Pedidos stage starts holding rows the Secretaria did not register; "Agendar mesmo assim" rules must be mirrored on the server. **Option B: a booking stays an Escala-stage restriction that carries its own request** (in the store of suggestion 2). Cost: Processamento must emit requests from two sources. Risk: the Pedidos counts and the pipeline card "Pedidos" do not include booked flights unless joined.
4. **Old History entries.** Either keep `validarReversao` and the apply code accepting today's payloads after the model changes (cost: an adapter per kind that writes to the new store), or accept that entries recorded before the change lose their button (cost: none; risk: an operator cannot undo yesterday's booking on a date opened after the release). The 9 kinds and their payloads are in 5.5.
5. **Pipeline card "Escala › restrições do operador".** A pure function over the state can count by kind: pins with `agendado`, pins with `escolhido`, status pins (`fixoPeloStatus`), pins by approval (`aprovacao` and no mark), requests with `insId` and no pin, requests with `pr !== 3`. "conflitos e avisos" already exist as `RES.al` with `t: 'conf'` and `t: 'warn'` (codes in `js/conflitos.js:63-77`). Cost: small. Risk: none identified.
6. **Keep `#dlg-agendar` and `#dlg-status` as dialogs** (they are actions with validation and a cancel path; 5.7) and decide separately about the weight fields. Moving the booking form into the middle pane would cost the rewrite of `js/views/agendamento.js` focus handling and of three e2e files that address `#dlg-agendar` and its `#agd-*` ids. Dropping the weight fields from the dialog would remove the in-flow fix for the `sem-peso` warning (tests "o peso digitado vai para o cadastro…").
7. **`#painel-reparo` in a three-pane layout.** Its content (a flight, its conflict, a list of actions) fits the middle pane as the detail of a conflict selected from the right rail's notifications. Cost: the drawer stacking and Esc rules (`gavetaDoEsc`, `test/e2e/reparo.spec.js` "com o Histórico aberto, o Esc fecha primeiro as Sugestões…") change. Risk: the History drawer and the Sugestões are used together today.
8. **Reword the engine alert** "Conflito na escala aprovada" to a neutral "Conflito no voo fixo" when `aprovacao` is null. Cost: unit tests assert the text; no golden contains a conflict. Risk: it is an engine output change, so by the repo's rule it needs its own commit.
9. **Decide what "Limpar demanda" becomes.** With derived requests it can only mean "clear the operator restrictions of the date" (today it also blanks requests, removes pins of every kind, statuses, details and reopens the approval, with no undo). Cost: a product decision. Risk: operators rely on it to restart a date.

## 8. Open questions for Pedro

1. Is a booked flight ("+ Agendar voo") a pedido in the target model (visible in Pedidos, approved when created), or only an Escala-stage restriction that carries its own flight? If it is a pedido, does it keep bypassing the 13:00 deadline, the Sunday rule and the 6-local limit with "Agendar mesmo assim", as today?
2. "Override any rule": should an operator restriction be allowed to break feasibility rules (instructor off or unqualified, aircraft busy or in maintenance, legal limits, weight), or does it only override the app's choice, as today (conflict shown, booking refused)?
3. When a pedido is cancelled or loses its approval after its flight is pinned (approved schedule, booked, chosen instructor, a status): keep the pin dormant (today's behaviour for "Voa" off), drop it, or refuse the cancellation?
4. Where do Prioridade and the Demanda's Instrutor go: per-flight restrictions edited in the Escala stage? And may the operator still override Recurso (type), Duração, 1ª/2ª preferência, Disponibilidade and the course mission ("Usar", "Outra missão…", out of order with confirmation), or do those change only through the pedido?
5. Do "+ missão" and "Pôr um aluno na demanda" (flights made by hand without a pedido) survive, or must every flight start as a pedido?
6. Does "Limpar demanda" survive, and meaning what?
7. After Aprovar, where does the day of operation happen (status changes, Sugestões, late bookings "na escala aprovada")? In the Escala stage, in Aprovar, or in a stage the request does not name?
8. Is it acceptable that History entries recorded before the change lose their "↶" button, or must old reverts keep working?
9. May the booking dialog keep writing the student's and the instructor's weight to the roster and marking an instructor available for the date?
10. Should the pipeline's "restrições do operador" count status pins and approval pins, or only what the operator placed by hand (booked flights, chosen instructors)?

<!-- fim -->
