# Mapa: Demanda (a tabela que o operador edita por data) e os dados dos pedidos do dia

Read on the worktree `.redesenho/wt-plano` at 48875e3 (branch `linha-0-plano`). Paths are relative to the worktree root.
"(ran)" = confirmed by running node on the pure modules. "(inferred)" = read from the code path, not executed.
"E" = profiles that edit (Operador and Administrador; in local mode, "Operador"). "R" = also the read-only Gestor.

## 1. What exists

- The Demanda is tab 2 of 9 (`<button data-t="dem">`, index.html:93), section `#s-dem` (index.html:299-341): a toolbar (`.bar`), the count line `#cnt`, and one table (10 columns) whose body is `#dem`.
- The table lists EVERY roster student, always: one row per student (the "pedido principal", `data-mid="0"`) plus one row per extra mission (`tr.extra-row`, `data-mid="<mid>"`): `S.stu.map(studentDemandRowsHTML)` (js/views/demanda.js:85-91, 117). "Só quem voa" only hides the rows that do not fly (css/app.css:1546).
- In memory the main request IS the student object: `pedidoDoAluno(aluno, 0)` returns `aluno` (js/voo.js:26; "o pedido principal é o próprio aluno", js/dias.js:18). Extra missions are objects in `stu.extra[]`, each with a `mid`.
- One request = one flight. Flight key: `chaveDoVoo(stuId, mid)` = `` `${stuId}_${mid}_1` `` (js/voo.js:4-5). Pins (`fixos`), statuses (`fStatus`), status details (`fObs`), saved schedule rows (`resultado.out[].fKey`), course results on the server (column `voo`) and History reverts are all keyed by it.
- The request holds a resource TYPE (`eq`), never a registration; only the engine output (`o.r`) and a pin (`fixos[fKey].r`) hold a registration.
- Path of one edit: DOM `change`/`click` → js/eventos/registro.js (guards: `isGestor() || aindaNaoAbriu()`, lines 24 and 41) → handler in js/eventos/demanda.js mutates `S.stu[…]` → `gravarAlteracao(tipo, descricao, reverter)` (js/actions.js:189-195) → `save()` → `refazerEscala()` → `runAllocationEngine(S)` (js/actions.js:166-182, 367-380) → `ApiClient.salvarDia(DATA, S, RES)` → `separar(estado)` writes `cadastro` (only when changed) and the whole `dia:<data>` with `resultado` (js/storage.js:229-242) → the History entry.
- The server never reads the requests: no migration reads `conteudo->'pedidos'`; it reads only `resultado.out`, `fStatus`, `fObs` (supabase/migrations/20261113180000_horas_dos_instrutores.sql:15-19; 20261115151734_repouso_conta_o_atraso.sql:12-18) and validates only the format number and `fStatus` in `salvar_dia` (20261114143242_formato_e_status_do_dia.sql:9-55).

| File | Role in this area |
|---|---|
| index.html:299-341 | markup of `#s-dem` (toolbar, table head) |
| js/views/demanda.js | row HTML (`singleDemandRowHTML`), `rDem`, `cnt`, filters |
| js/eventos/demanda.js | every Demanda handler (12 History writers) |
| js/views/etapas.js | course mission on the request: `proximaDoPedido`, `outraMissaoDoPedido`, `etapaNaDemanda`, `cursoDoResultado` (reads the global `S`) |
| js/rules.js | `blank`, `deixarEmBranco`, `alvoDoNovoPedido`, `proximoMid`, `normalizeMissionFields`, availability, durations |
| js/dias.js | `CAMPOS_DO_PEDIDO`, `separar`, `juntar`, `diaParaCopiar` |
| js/voo.js | `chaveDoVoo`, `pedidoDoAluno`, `pedidosDosVoos` |
| js/agenda.js, js/eventos/agenda.js | `pedidoDaSolicitacao`, `importarSolicitacoes`, `importarDaAgenda` |
| js/fixos.js | `limparDemanda`, `semAgendados` |
| js/instrutor-escolhido.js | `instrutoresDoPedido`, `escolherInstrutor` and its reverts |
| js/config.js | `MIS` (18 mission types), `NOTURNO`, `T`, `WIN` |
| js/noturno.js | the D+1 return leg (reads yesterday's saved schedule, not requests) |

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

### 2.1 Stored shape

```
document "cadastro" (all dates)      js/dias.js:38-54
  stu: [{ id, nm, kg, bl: [insId…], voaCom?: [insId…], curso?: 'PP' }]      (js/dias.js:47)

document "dia:<AAAA-MM-DD>" (one date)      js/dias.js:55-72, js/storage.js:241
  pedidos: { "<stuId>": { fly, mis, eq, p1, p2, nb, ss, pr, jan?, etapa?, solicitacao?, insId?, cursoDaEtapa?,
                          extra: [ { mid, fly, mis, eq, p1, p2, nb, ss, pr, jan?, etapa?, solicitacao?, insId?, cursoDaEtapa? } ] } }
  fixos: { "<fKey>": { a, b, r, insId, classKey?, escolhido?, agendado? } }
  fStatus, fObs, importadas: [solicitacaoId…], aprovacao: { em, por } | null,
  win, av, ins: { id: { on, aw } }, horas, filas, hangar, criterios, resultado: { out, al, tot, revisao, data } | null, esquema: 25
```

- `separar` copies the MAIN request through the whitelist `CAMPOS_DO_PEDIDO = ['fly','mis','eq','p1','p2','nb','ss','pr','jan','etapa','solicitacao','insId','cursoDaEtapa']` (js/dias.js:22, 60): a field not in the list is dropped from the main request on save. Extras are cloned whole (`structuredClone(s.extra || [])`, js/dias.js:61).
- `separar` builds the day from a fixed set of keys (js/dias.js:55-72) and `juntar` reads only known keys (js/dias.js:78-112): an unknown top-level day field does not survive a save. Each new field so far came with an `ESQUEMA` bump, even with an identity step (js/migracoes.js:63-83, 107-118, 176-182, 198-206).
- `juntar` spreads the stored request over the roster student: `{ ...s, …, ...(pedidos[s.id] ? structuredClone(pedidos[s.id]) : { ...blank(), extra: [] }) }` (js/dias.js:96-101). A student missing from the day gets a blank request. A student removed from the roster is ignored in the day (test/unit/dias.test.js 'ignora no dia instrutores e alunos que saíram do cadastro').

### 2.2 Fields of one student in memory (`S.stu[i]`)

| Field | Values | Default | Scope | Stored in | Writers |
|---|---|---|---|---|---|
| `id` | integer > 0 | `S.nid++` | roster | `cadastro.stu[]` | "+ Novo aluno" (js/eventos/cadastros.js:84-90) |
| `nm` | text, up to 80 | `'Novo aluno'` | roster | cadastro | Alunos (js/eventos/cadastros.js:192-195) |
| `kg` | 0 (none) or up to 300 | 0 | roster | cadastro | Alunos (:196-200); booking dialog (js/agendamento.js:925-931) |
| `bl` | instructor ids ("Não escalar com") | `[]` | roster | cadastro | Alunos (:201-207) |
| `voaCom` | instructor ids ("Priorizar com"), absent when empty | absent | roster | cadastro | Alunos (:208-211) |
| `curso` | sigla | absent | roster | cadastro | Alunos (:212-217) |
| `fly` | boolean | `false` | date, per request | `dia.pedidos[id]` | see 5.6 |
| `mis` | one of the 18 keys of `MIS` | `'Voo Local'` | date | same | see 5.6 |
| `eq` | resource type in `MIS[mis].eq` | `'C152'` | date | same | see 5.6 |
| `p1` | minute 360..1050, or -1 ("—") | `T[1]` = 500 (08:20); "+ missão" uses `T[4]` = 760 | date | same | see 5.6 |
| `p2` | same | `T[2]` = 610 (10:10); "+ missão" uses `T[6]` = 870 | date | same | see 5.6 |
| `nb` | hours in tenths, 0.1..5; Ground 1.5; Noturno 4 | 1 | date | same | see 5.6 |
| `ss` | always 1 (`normalizeMissionFields`, js/rules.js:146) | 1 | date | same | never shown (no column); the engine ignores it |
| `pr` | integer 1..5 | 3 (js/rules.js:82); "+ missão": `s.pr \|\| 3` | date | same | Demanda only (plus resets, see 5.4) |
| `jan` | `'manha'`, `'tarde'`, `'noite'`, `'h<minuto>'`; absent = any time | absent | date | same | see 5.6 |
| `etapa` | course mission code (`/^[A-Z0-9][A-Z0-9.-]{0,14}$/`, js/cursos.js:9) | absent | date | same | Usar, Outra missão, import, booking |
| `cursoDaEtapa` | sigla, only together with `etapa` (js/rules.js:162) | absent | date | same | same as `etapa` |
| `solicitacao` | integer > 0: id of the Agenda pedido | absent | date | same | import only (js/agenda.js:128) |
| `insId` | integer > 0: instructor chosen by the operator | absent | date | same | Demanda, Escala, Sugestões, booking |
| `extra` | array of requests, each with `mid` | `[]` | date | `dia.pedidos[id].extra` | see 5.6 |
| `mid` (extras) | integer > 0 | `proximoMid(estado, aluno)` (js/rules.js:67-72) | date | inside the extra | "+ missão", import, booking |

Personal data (CPF, CANAC, nascimento, celular, e-mail) is outside the state. The day has no names or weights (test/unit/dias.test.js 'o cadastro não tem dados do dia e o dia não tem nomes nem pesos').

### 2.3 Other day data tied to the requests

| Data | What it is | Per date? | Writers |
|---|---|---|---|
| `fixos[fKey]` | pin: time, registration, instructor, marks `escolhido`, `agendado` | yes | Aprovar, Reabrir, status, Escala instructor, booking, Sugestões, and the Demanda (releases: `soltarAgendado`, `del-mis`, `limparDemanda`) |
| `fStatus[fKey]`, `fObs[fKey]` | flight status and its detail | yes | Escala; cleared by `limparDemanda` |
| `importadas` | ids of Agenda pedidos already seen for this date | yes | `importarSolicitacoes` (js/agenda.js:110, 116) only |
| `aprovacao` | `{ em, por }` | yes | Aprovar, Reabrir, `limparDemanda` |
| `resultado` | the saved engine output | yes | `salvarDia` |
| not saved | `S.resultados`, `S.programa`, `S.horasDosInstrutores`, `S.noturnosDaVespera`, `S.indisponiveis` (js/actions.js:305; js/storage.js:197-212) | read on open | — |

### 2.4 Normalization on load

`normalizeAndMigrateState` (js/storage.js:149-171): `extra` becomes an array of objects; every main request and extra goes through `normalizeMissionFields`; an extra without a valid `mid` gets `proximoMid`. `normalizeMissionFields` (js/rules.js:142-179): legacy mission names, `ss = 1`, `jan` to the current format or removed, `p1`/`p2` to minutes or -1, `pr` 1..5 else 3, `fly` to boolean, invalid `etapa`/`cursoDaEtapa`/`solicitacao`/`insId` removed, `eq` forced into `MIS[mis].eq`, Ground forced to `Sala Ground` and 1.5 h, fixed duration applied, and for Noturno and Voo Solo `p1` = the fixed time and `p2 = -1`.

## 3. Controls inventory (one table row per control on screen: label | element (id, data-act, data-f, class) | handler (function, file:line) | state read and written | profiles that can use it)

The Secretaria never sees the tab (css/app.css:184-188). The Gestor sees it read-only: `.edit-only` is hidden (css/app.css:235) and row fields are disabled by js/somente-leitura.js:5-9, which leaves `.flt-ctrl` and `#onlyfly` enabled. Every edit is refused before the date's data is read (`aindaNaoAbriu`, js/actions.js:154-158).

| Label | Element | Handler | State read and written | Profiles |
|---|---|---|---|---|
| "Demanda" (tab) | `button[data-t="dem"]` (index.html:93), no badge | js/eventos/navegacao.js:18-31 | — | E, R |
| "Importar da agenda" / "Importar N pedido(s) da agenda" | `button#importar-agenda.btn.sec.edit-only` (index.html:302); label set by `atualizarSeloDaAgenda` (js/views/selos.js:52-59) | `importarDaAgenda` (js/eventos/agenda.js:31-61) | reads `ApiClient.agenda(DATA, DATA)`, `S.importadas`, `S.resultados.situacao`, `programaParaInferir()`; writes requests and `S.importadas` through `importarSolicitacoes` (js/agenda.js:107-140) | E |
| "+ Pôr um aluno na demanda…" | `input#incluir-aluno.edit-only[list="alunos-fora"]` + `datalist#alunos-fora` (index.html:303-304) | `incluirAluno` (js/eventos/demanda.js:33-55): Enter, or a datalist pick | reads `S.stu[].nm` (exact lower-case match, line 37), `.fly`; writes `s.fly = true` | E |
| "Só quem voa" | `input#onlyfly[type=checkbox]`, checked in the HTML (index.html:306); `#dem` starts with class `only` (index.html:338) | `change` listener (js/eventos/demanda.js:65-69) | no data: toggles class `only` on `#dem`; not kept across reloads | E, R |
| "Buscar na demanda…" | `input#flt-dem.flt-ctrl[type=search]` (index.html:307) | `filtrarDemanda` (js/views/demanda.js:136-152) | no data; matches `tr.dataset.nm` (`chaveDeBusca(stu.nm)`): the name only | E, R |
| "Todos os cursos" / "Curso: PP ou PC" | `button#flt-dem-cur.filtro-botao.flt-ctrl` + `div#flt-dem-cur-painel` (index.html:309-310) | `prepararFiltroDosCursos` (js/views/demanda.js:125-128); js/views/filtro-dos-cursos.js:47-61 | ticks in one `Set` shared with Alunos (js/views/filtro-dos-cursos.js:26); matches `tr.dataset.curso` (the roster `curso`) | E, R |
| "Todas as missões" | `select#flt-dem-mis.flt-ctrl` (index.html:311-313); options = `Object.keys(MIS)` (js/eventos/demanda.js:63) | `filtrarDemanda` (js/eventos/demanda.js:62) | matches `tr.dataset.mis` | E, R |
| "Mais" | `button#btn-mais-dem` + `div#menu-mais-dem[role=menu]` in `.menu-mais.edit-only` (index.html:314-319) | `ligarMenu(…, { fecharAoEscolher: false })` (js/eventos/demanda.js:20) | — | E |
| "Limpar demanda" → "Confirmar limpeza" | `button#clr[role=menuitem]` (index.html:317) | `comConfirmacao('#clr', …)` (js/eventos/demanda.js:81-89) → `limparDemanda(S)` (js/fixos.js:95-117) | blanks every request, removes extras, clears `fStatus`, `fObs`, `fixos` of the cleared keys, sets `aprovacao = null`; keeps Atrasado, Em Voo, Pousou flights; does NOT touch `importadas` | E |
| count "N / M aluno(s) · K missão(ões) marcada(s)" | `p#cnt.h` (index.html:321) | `cnt()` (js/views/demanda.js:93-106) | reads `fly` of main and extras | display |
| column "?" buttons | `button.dica-btn[data-dica="voa"\|"instrutor-escolhido"\|"preferencias"\|"disponibilidade"\|"duracao"\|"prioridade"]` (index.html:327-335) | js/dicas.js; texts in js/glossario.js:60-65 | — | E, R |
| the row | `tr[data-k="d"][data-id][data-mid][data-nm][data-curso][data-mis]`, class `on p<pr>` or `off`, plus `extra-row` (js/views/demanda.js:53, 71) | — | — | — |
| student name | `<span>` in `.stu-cell` (js/views/demanda.js:58) | — | reads `stu.nm` | display |
| course mission code | `span.etapa[title="Missão do curso <sigla>"]` (js/views/etapas.js:138) | — | reads `d.etapa`, `d.cursoDaEtapa` (else `stu.curso`) | display |
| "Próxima: <rótulo> · Usar" | `button.btn.quiet.edit-only.usar-proxima[data-act="usar-proxima"][data-id][data-mid][title]` (js/views/etapas.js:142); only when the request has no `etapa` | `aoAcionar('usar-proxima')` (js/eventos/demanda.js:109-117) → `usarMissaoDoCurso` (:94-99) | reads `S.programa`, `S.resultados.situacao`, `S.fStatus`, the student's other requests; writes `fly: true, mis, eq, nb, etapa, cursoDaEtapa`, adjusts `p1`/`p2`/`jan`, releases a booked pin | E |
| "Outra missão…" | `select.edit-only.outra-missao[data-f="outra-missao"]` with groups "Liberadas no <sigla>" and "Fora da ordem (pede confirmação)" (js/views/etapas.js:110-122) | `escolherOutraMissao` (js/eventos/demanda.js:123-138, 201) | a liberada acts like Usar; any other inserts the armed button | E |
| "Usar <código> fora da ordem" / "Usar <código> do curso encerrado", shown armed as "Confirmar: <código> fora da ordem" | `button[data-act="usar-fora-da-ordem"][data-codigo][data-dica]` (js/views/etapas.js:126-131) | `aoAcionar('usar-fora-da-ordem')` (js/eventos/demanda.js:140-151) | same writes as Usar | E |
| "agendado HH:MM · <recurso>" | `span.tag[data-dica="voo-agendado"]` (js/views/demanda.js:43-47) | none | reads `S.fixos[fKey]` with `agendado` | display |
| "+ missão" | `button.btn-add-mis.edit-only[data-act="add-mis"][data-id]` (js/views/demanda.js:58), main rows only | `aoAcionar('add-mis')` (js/eventos/demanda.js:153-172) | pushes `{ mid: proximoMid(S, s), fly: true, mis: 'Voo Local', eq: 'C152', p1: T[4], p2: T[6], nb: 1, ss: 1, pr: s.pr \|\| 3 }` to `s.extra` | E |
| "↳ missão extra" + "✕" → "Confirmar" | `button.x.edit-only[data-act="del-mis"][data-id][data-mid]` (js/views/demanda.js:57) | `aoAcionar('del-mis')` (js/eventos/demanda.js:174-182) | removes the extra; `S.fixos = semAgendados(…)` | E |
| Voa | `input.sw[type=checkbox][data-f="fly"]` (js/views/demanda.js:73) | `aoMudarCampo('d')`, branch `fly` (js/eventos/demanda.js:213-223) | writes `fly`; turning the main one off also turns off every flying extra | E |
| Missão | `select[data-f="mis"][title="Exige …"]` (js/views/demanda.js:74) | same handler (js/eventos/demanda.js:229-266) | writes `mis`; changes `eq`, `nb`, `p1`, `p2`, `jan`; deletes `etapa`, `cursoDaEtapa`; releases a booked pin | E |
| Recurso | `select[data-f="eq"]`, disabled for Ground (js/views/demanda.js:75) | same | writes `eq`; adjusts `p1`, `p2`, `jan`; deletes `etapa`, `cursoDaEtapa`; releases a booked pin | E |
| Instrutor | `select[data-f="insId"]`, class `escolhido` when set (js/views/demanda.js:76) | branch `insId` (js/eventos/demanda.js:203-212) → `escolherInstrutor` (js/instrutor-escolhido.js:89-125) | writes or deletes `insId`; when the flight is already pinned, also the pin's `insId` (a whole Ground class) | E |
| 1ª preferência | `select[data-f="p1"]` (js/views/demanda.js:77) | generic branch (js/eventos/demanda.js:244, 265) | writes `p1` | E |
| 2ª preferência | `select[data-f="p2"]` (js/views/demanda.js:78) | same | writes `p2` | E |
| Disponibilidade | `select[data-f="jan"]` (js/views/demanda.js:79) | branch `jan` (js/eventos/demanda.js:224-228) | writes or deletes `jan` | E |
| Duração | `input.duracao[type=number][data-f="nb"]`, min 0.1, max 5, step 0.1; Ground: disabled select "1h30"; Noturno: disabled select "4 h" (js/views/demanda.js:63-69) | generic branch with `duracaoDigitada` (js/eventos/demanda.js:231-239) | writes `nb`; a changed value deletes `etapa`, `cursoDaEtapa` and releases a booked pin | E |
| Prioridade | `select[data-f="pr"]`, 1 to 5 (js/views/demanda.js:81) | generic branch | writes `pr` | E |
| "Nenhum aluno com esses filtros." + "Limpar filtros" | `tr.sem-resultado` + `button#limpar-filtros-dem`, no `data-act` (js/views/cadastros.js:428-435) | `limparFiltrosDaDemanda` (js/views/demanda.js:168-174) | clears the search, the mission filter and the shared Curso ticks | E, R |
| "Nenhum aluno cadastrado. Cadastre os alunos na aba Alunos." | `tr.empty-dem` (js/views/demanda.js:112) | — | — | display |
| "Abrir a Demanda" (in Alunos) | `button[data-go="dem"]` in `p.ir-para-demanda` (index.html:260) | js/eventos/navegacao.js:18-31 | — | E, R |
| "✕" Tirar da escala (Escala list) and "✕ Excluir da escala" (map popup) | `button[data-act="rm-fly"]` (js/views/escala.js:371, 64) | `aoAcionar('rm-fly')` (js/eventos/demanda.js:184-194) | `target.fly = false` (does not touch the extras) | E |
| "Importar N pedido(s) para a demanda" (in the Agenda) | `button#agenda-importar` (index.html:292; js/views/agenda.js:192-194) | `importarDaAgenda` (js/eventos/agenda.js:61) | same as the Demanda button | E |

## 4. Rules and the tests that pin them (file and test name)

Run here: `node --test` on test/unit/rules, dias, noturno and agenda: 93 pass, 0 fail. Playwright was not run.

| Rule | Code | Tests |
|---|---|---|
| Roster and day split and join back | js/dias.js:36-112 | test/unit/dias.test.js 'juntar(separar(estado)) devolve o mesmo estado em 300 cenários e no exemplo'; 'o cadastro não tem dados do dia e o dia não tem nomes nem pesos' |
| A new date starts with an empty Demanda | js/dias.js:118-123; js/storage.js:189-191 | dias.test.js 'copia do dia anterior a disponibilidade, sem a demanda (zerada a cada dia), sem status dos voos nem escala gerada'; test/unit/storage-dias.test.js 'data nova começa com uma cópia do dia anterior (sem status, sem escala e com a demanda vazia) e não grava nada'; test/e2e/datas.spec.js 'cada data tem a sua escala; a nova data começa com a demanda vazia' |
| The blank request | js/rules.js:82 | test/unit/rules.test.js 'pedido em branco é um objeto novo a cada chamada' |
| Normalization of a request | js/rules.js:142-179 | rules.test.js 'normaliza pedidos de Ground: sala, 01h30, sessão única e sem horário noturno'; 'uma sessão por missão: pedidos antigos com 2 ou 3 sessões passam a ter uma só (para dividir, "+ missão")'; 'normaliza pedidos de voo: equipamento permitido e preferências em minutos'; 'a duração do voo: de 0,1 h a 5 h, em décimos; acima de 5 h fica 5; fora disso, 1 h'; 'missão de horário fixo: a 1ª preferência é o horário dela, sem 2ª'; 'o curso da missão do curso: uma sigla, só com o código da missão'; 'o id da solicitação da agenda: inteiro positivo; o resto sai' |
| Availability | js/rules.js:12-36 | rules.test.js 'disponibilidade do aluno: em que horários o voo pode começar (por período ou num horário exato)'; test/e2e/demanda.spec.js 'disponibilidade do aluno: o voo só começa nas janelas escolhidas' |
| Numbering of extras; no reuse of a key with leftovers | js/rules.js:54-100 | rules.test.js 'o próximo depois das missões do aluno e do que o dia ainda guarda (voo fixo, status ou detalhe de uma missão retirada)'; the three tests of 'O pedido que recebe um voo novo'; test/e2e/compartilhado.spec.js 'uma missão extra grava só o dia (o cadastro, de todas as datas, não muda)' |
| 10 columns, no Sessões | index.html:326-335 | demanda.spec.js '10 colunas que cabem na tela (sem Sessões); "Limpar demanda" fica no menu Mais' |
| A mission change adjusts resource, duration and times | js/eventos/demanda.js:240-264 | demanda.spec.js 'trocar a missão ajusta equipamento, duração e horários'; 'os horários do pedido são os da categoria: o PA-34 de 30 em 30 minutos; trocar de avião ajusta as preferências'; test/e2e/noturno.spec.js 'a Demanda e a Agenda travam a duração do Noturno (4 h no dia e a volta no dia seguinte)' |
| Typed duration | js/rules.js:117-121 | rules.test.js 'de 0,1 h a 5 h, em décimos, com vírgula ou ponto; fora disso, nenhuma'; demanda.spec.js 'a duração é um número de horas, fracionado, até 5 h; acima disso, não vale' |
| Voa off takes the extras; the revert brings them back | js/eventos/demanda.js:213-223; js/eventos/historico.js:53-61 | demanda.spec.js 'tirar o "Voa" do aluno tira também as missões extras; reverter volta todas' |
| Extras | js/eventos/demanda.js:153-182 | demanda.spec.js '"+ Missão" adiciona e remove uma missão extra do aluno' |
| Pôr um aluno | js/eventos/demanda.js:33-48 | demanda.spec.js '"Pôr um aluno na demanda" inclui quem ainda não voa (com "Só quem voa" ligado)'; '"Pôr um aluno na demanda" fora dos filtros: o pedido incluído fica à vista até os filtros mudarem' |
| Limpar demanda | js/fixos.js:95-117 | test/unit/fixos.test.js, describe 'Limpar demanda' (7 tests); demanda.spec.js '"Limpar demanda" deixa o pedido sem nada do voo de antes: …'; '"Limpar demanda" solta os voos que limpa (o cadeado e o status de antes) e reabre a escala; o voo que pousou fica' |
| A booked pin follows the request | js/eventos/demanda.js:25-30, 245-249; js/fixos.js:78-85 | demanda.spec.js, describe 'Voo agendado na Escala' (6 tests) |
| Course mission on the request | js/views/etapas.js:36-144; js/eventos/demanda.js:94-151 | test/e2e/cursos-no-dia.spec.js (9 tests); test/unit/progresso.test.js 'as etapas dos pedidos do aluno que voam; o cancelado, o que não voa e o pedido que recebe a missão não contam' |
| Chosen instructor in the Demanda | js/instrutor-escolhido.js:30-35, 89-125 | test/unit/instrutor-escolhido.test.js, describe 'Instrutor escolhido na Demanda: o motor encaixa o voo com ele' (8 tests); 'as opções da Demanda: os habilitados, sem os de "Não escalar com"; quem não vem na data, marcado' |
| Engine order of requests | js/engine.js:328-338 | test/unit/engine.rules.test.js 'maior prioridade escolhe o horário primeiro'; describe 'A ordem dos agendamentos' (3 tests); instrutor-escolhido.test.js 'o pedido com o instrutor escolhido vem antes dos outros, mesmo os de prioridade maior' |
| Agenda import | js/agenda.js:63-140 | test/unit/agenda.test.js, describe 'Importar as solicitações da agenda para a demanda' (20 tests); test/e2e/agenda.spec.js '"Importar Solicitações da Agenda" põe os pedidos da data na demanda, prontos para a escala' |
| Two-day Noturno | js/noturno.js; js/engine.js:370-393 | test/unit/noturno.test.js (16 tests); test/e2e/noturno.spec.js (3 tests) |
| Filters | js/views/demanda.js:136-174 | demanda.spec.js 'filtros "Só quem voa", nome e missão' and four more filter tests; test/e2e/perfis.spec.js 'o Gestor busca, filtra pelas habilitações e pelos cursos e troca de vista em Instrutores, Alunos e na Demanda; …' |
| Engine output unchanged | js/engine.js | test/unit/engine.golden.test.js 'cenário de exemplo mantém a escala aprovada' plus 40 × 'cenário aleatório #N mantém a escala aprovada' (41 goldens; the 42nd file is `exemplo-estado.json`) |

22 e2e spec files drive the Demanda screen (`#dem`, `#incluir-aluno`, `#importar-agenda`, `#clr`, `#onlyfly`, `flt-dem`), 109 selector lines in demanda.spec.js alone.

## 5. Answers (one subsection per question of your brief, in order)

### 5.1 The data shape of a day's requests

- Fields: section 2.2. Roster: `id, nm, kg, bl, voaCom, curso`. Day: `fly, mis, eq, p1, p2, nb, ss, pr, jan, etapa, solicitacao, insId, cursoDaEtapa, extra[]` (and `mid` on extras).
- Split and join: section 2.1.
- A new date starts EMPTY, not copied: `carregarDia` uses `diaParaCopiar(anterior)` when the date has no stored day (js/storage.js:189-191). It copies `win`, `av`, `ins` (availability), `hangar`, `criterios`, advances `horas` and `filas`, and gives every student of the previous day `{ ...blank(), extra: [] }`; `fStatus`, `fObs`, `fixos` empty, `aprovacao` null, `importadas` `[]` (js/dias.js:118-123). "anterior" is the latest stored day before the date, not necessarily yesterday (js/backends/local.js:120-123). Nothing is saved on open; the first change saves (js/actions.js:197-202).

### 5.2 Every column and toolbar control: values, default, and what the engine does

Element, handler and profiles are in section 3. Engine use:

| Column | Field | Allowed values and default | What the engine does with it |
|---|---|---|---|
| Aluno | — | every roster student | the student's position in `state.stu` is a tie-breaker (`stuOrder`, js/engine.js:294, 337) |
| Voa | `fly` | boolean, default `false` | only requests with `fly` enter the queue `act` (js/engine.js:292-303); a pin of a request that does not fly stays dormant |
| Missão | `mis` | the 18 keys of `MIS`, default `'Voo Local'`; the select always lists all 18, whatever the student's course | Ground or flight branch; allowed-resource check (rejection `equipamento-da-missao`, js/engine.js:786-794); qualifications; local-flight limit; rodízio category; fixed times of Noturno and Voo Solo |
| Recurso | `eq` | `MIS[mis].eq`, default `MIS[mis].defEq`; disabled for Ground | fleet pool of that type, take-off times of its category, weight limit `DEFAULT_LIM[eq]`, qualifications (js/engine.js:773, 811, 823-824) |
| Instrutor | `insId` | "Automático" (or "Automático (prioriza A, B)" when the student has `voaCom`) plus the instructors that can fly the mission and are not in `bl`; one absent on the date shows "(fora nesta data)" (js/instrutor-escolhido.js:30-35) | second sort key; the search uses only that instructor (js/engine.js:587); an instructor who cannot fly it at all rejects the request with `instrutor-escolhido` (:573-583); mark `insEscolhido` keeps equalization and compaction from changing him |
| 1ª preferência, 2ª preferência | `p1`, `p2` | "—" (-1) or a take-off time of the mission's list (`horariosDaMissao`) | order of the start times tried: 1st, 2nd, then by distance from the 1st (js/engine.js:817); the tag "Pref. 1" / "Pref. 2" / "Próximo livre"; cost of a lost preference in compaction (js/compactar.js:55-58) |
| Disponibilidade | `jan` | "Qualquer horário", "Manhã", "Tarde", "Noite", "Só às HH:MM" (js/rules.js:35-36) | hard filter on start times (js/engine.js:564-565, 811); rejection `disponibilidade-do-aluno`; conflict `disponibilidade` on a pin (:447-448) |
| Duração | `nb` | 0.1 to 5 h; default 1 (Simulador 2); fixed for Ground (1.5) and Noturno (4) | flight length (js/engine.js:133, 775); ignored for Ground and Noturno; a pin whose length differs gets the conflict `duracao` (:449) |
| Prioridade | `pr` | 1 to 5, default 3 | third sort key, 5 first (js/engine.js:337); weight `pr / 3` on the lost preference in compaction (js/compactar.js:57) |
| (no column) | `etapa` | course code | copied to the output row (js/engine.js:523, 731, 902); not used to decide anything |
| (no column) | `solicitacao` | pedido id | fifth sort key: the lower id first; a hand-made request counts as `Infinity` (js/engine.js:328, 337) |
| (no column) | `cursoDaEtapa`, `ss` | — | not read by the engine |

Full sort (js/engine.js:333-338): Grounds first; then a request with a chosen instructor; then `pr` descending; then a student with `voaCom`; then `solicitacao` ascending; then roster order; then main before extras in order. Pinned requests are placed before all of them (js/engine.js:400-406).

Roster fields the engine reads on its own: `voaCom` (search first with those instructors in every time, then with all, with the warning `voa-com`: js/engine.js:586-589, 982-987), `bl` (never with them), `kg`, `curso`.

### 5.3 What can be derived today and what is pure operator input

| Value | Derivable today from | Function | Limits |
|---|---|---|---|
| Mission type `mis` | the pedido's `missao` (a key of `MIS`, chosen in the Agenda form "Fase / missão") | `pedidoDaSolicitacao` (js/agenda.js:63-80) | — |
| Course mission `etapa` + `cursoDaEtapa` (and through it `mis`, `eq`, `nb`) | the program plus results plus the student's other requests of the day | `proximaDoPedido` (js/views/etapas.js:36-45) → `proximasMissoes` (js/progresso.js:87-95) | only for a student with `curso` whose course has a program, and only when results and programs were read (`programaParaInferir`, js/views/etapas.js:26-29). PC and INVA start with empty programs (`cursosIniciais`, js/programa.js:23) |
| Resource type `eq` | the program mission's `eq`; else `MIS[mis].defEq` | js/agenda.js:65-66, 125 | another type (Voo Local in the C172, Sim. Multi) is operator input |
| Duration `nb` | fixed (Ground 1.5, Noturno 4) > the pedido's `horas` > the program's `nb` > the mission default (Simulador 2, else 1) | js/agenda.js:71-74; `duracaoPadraoDaMissao` (js/rules.js:76-77) | the Agenda form always sends `horas` (js/eventos/agenda.js:79-84, 99-102), so on import the pedido's hours always win over the program's. "Usar" does the opposite: it applies the program's `nb` (js/eventos/demanda.js:95) |
| Availability `jan` | the pedido's `horario` → `'h<minuto>'` ("Só às HH:MM") | `disponibilidadeDaSolicitacao` (js/agenda.js:52-56) | every new pedido is `janela: 'horario'` (js/eventos/agenda.js:100), so the result is always one exact time |
| `p1`, `p2` | the first two times of the mission's list that the availability allows | js/agenda.js:67-70 | with an exact time both are that same time (ran: `p1: 610, p2: 610, jan: 'h610'`) |
| `solicitacao` | the pedido id | js/agenda.js:128 | — |
| Instructor from "Priorizar com" | NOT derived into the request: `voaCom` is a roster field the engine applies itself | js/engine.js:586-589 | the Demanda only shows it in the "Automático (prioriza …)" label (js/views/demanda.js:35-39) |

Pure operator input, with no other source: `pr` (always 3 otherwise); `insId`; `fly` turned off and on by hand; a second flight for the student ("+ missão") unless a second pedido exists; a looser or tighter `jan`; a real 2nd preference; a resource type other than the default or the program's; a duration other than the pedido's; a mission type for a student with no program; a course mission out of order or in a closed course.

### 5.4 What an imported pedido fills in, and what it leaves

`importarSolicitacoes` (js/agenda.js:107-140), per active pedido of the date not yet in `importadas`:

- Fills: `fly: true`, `mis`, `eq`, `p1`, `p2`, `nb`, `ss: 1`, `pr: 3`, `jan`, `solicitacao`; and `etapa` + `cursoDaEtapa` when the first available program mission OF THE REQUESTED TYPE exists (`candidatas.find(m => m.mis === solicitacao.missao)`, js/agenda.js:121-122, 127). With no match, it enters "as it came", with no course code.
- Where it lands: (a) over a flying request of the same mission type that has no `solicitacao`, no pin, no pinning status and no result (`vooQueDaLugar`, js/agenda.js:86-93, 129-133); (b) else the main request, when it does not fly and its key has no leftovers; (c) else a new extra (`alvoDoNovoPedido`, js/rules.js:95-100).
- It only adds. A pedido cancelled after the import stays in the Demanda: nothing reconciles (`cancelada_em` is read only to skip, js/agenda.js:112).
- Not carried over: `observacao`, `registrado_por`, `excecao`.
- (ran) The pedido that takes the place of a hand-made request resets its `pr` to 3 and keeps its `insId`. The pedido that becomes an extra gets `pr: 3` even when the student's main request has another priority.
- (ran) After "Limpar demanda" the pedidos already imported are not imported again: `limparDemanda` does not clear `importadas`, and the Agenda keeps showing "Na demanda" (js/views/agenda.js:139-148).
- A pedido of a student not in the roster is counted (`semAluno`) and not marked as seen (js/agenda.js:114-115).
- History: one entry per pedido, "Agenda: <aluno> incluído (<missão> · às HH:MM · N h)", no revert (js/eventos/agenda.js:54-55).
- Left to the operator: the priority; the instructor; another resource type; a looser time (the import makes the time exact, so a busy slot rejects the flight); the course mission when the type does not match; extra flights; removing the request of a cancelled pedido.

### 5.5 Mission types and `normalizeMissionFields`

(ran) The 18 types of `MIS` (js/config.js:51-73):

| Missão | Recursos (default first) | Default hours | Fixed | Times |
|---|---|---|---|---|
| Ground C152, Ground C172, Ground PA-34, Ground Navegação | Sala Ground | 1.5 | 1.5 h | the 8 day windows |
| Simulador | Sim. Mono, Sim. Multi | 2 | — | the Simulador list |
| Voo Local, TGL (TMA), Navegação, Parafuso | C152, C172, PA-34 | 1 | — | the list of the type's category |
| Voo Solo | C152, C172, PA-34 | 1 | time 06:30, `p2 = -1` | 06:30 only |
| IFR | C172, PA-34 | 1 | — | category list |
| Noturno | C172 | 4 | 4 h, time 17:30, `p2 = -1` | 17:30 only |
| Multimotor | PA-34 | 1 | — | PA-34 list (every 30 min) |
| Cheque PP, Cheque PC MNTE VFR | C152, C172 | 1 | — | category list |
| Cheque PC MNTE IFR | C172 | 1 | — | category list |
| Cheque PC MLTE VFR, Cheque PC MLTE IFR | PA-34 | 1 | — | PA-34 list |

- Ground: resource and duration forced; a class is the students of the same Ground at the same time with the same instructor, one room, 1.5 h counted once. A Ground gates the same day's flight: by resource type (`gatesEq`) or, for Ground Navegação, by mission (`gatesMis`) (js/config.js:52-55; js/rules.js:44-50). The flight is rejected (`ground-pendente`) when its Ground did not fit (js/engine.js:797-807).
- Noturno: 17:30 to 21:30 on day D. The return leg on D+1 (07:30 to 08:30, free at 10:10) is added by the engine from `state.noturnosDaVespera`, read from D's SAVED schedule (js/noturno.js:17-30; js/storage.js:200-201). It has key `<stuId>_<mid>_2`, no request on D+1 (js/voo.js:29-36) and no "✕". A PC student's Noturno is IFR (js/config.js:66). In a program in legs the request carries the night's code (`etapa: 'NOT'`).
- Voo Solo: always 06:30; counts in the limit of 6 local flights; still gets an instructor.
- Cheque: the instructor needs the three checker marks (js/habilitacoes.js:65-71); rodízio category `cheque`.
- Missions per student per day: 1 main + any number of extras. No cap in `add-mis` (js/eventos/demanda.js:153-172). The only bound is 20 extras in the `setFly` revert payload (js/reversoes.js:49).
- (inferred) A Noturno picked by hand from a 1 h mission keeps `nb: 1` in memory until the date is reloaded (js/eventos/demanda.js:258 does not fire); the screen shows "4 h" and the engine uses 4 h, but the History entry says "1 h" (js/eventos/demanda.js:265). Also by hand `p2` becomes 1050 (test demanda.spec.js:213) while a reload sets -1.

### 5.6 Every reader and writer of the day's requests outside the engine

Writers:

| File:line | What it writes |
|---|---|
| js/eventos/demanda.js:41 | `fly = true` ("Pôr um aluno") |
| js/eventos/demanda.js:94-99 | `usarMissaoDoCurso`: `fly, mis, eq, nb, etapa, cursoDaEtapa`, then `ajustarPreferencias` and `normalizeMissionFields` |
| js/eventos/demanda.js:153-172, 174-182 | push and remove an extra |
| js/eventos/demanda.js:184-194 | `rm-fly`: `fly = false` |
| js/eventos/demanda.js:197-273 | the field handler: `fly` (and the extras' `fly`), `jan`, `mis`, `eq`, `nb`, `p1`, `p2`, `pr`; deletes `etapa`, `cursoDaEtapa` |
| js/fixos.js:95-117 | `limparDemanda` |
| js/rules.js:86-90, 95-100, 142-179 | `deixarEmBranco`, `alvoDoNovoPedido`, `normalizeMissionFields` |
| js/agenda.js:107-140 | `importarSolicitacoes` (also `importadas`) |
| js/agendamento.js:899-940 | `aplicarAgendamento`: `fly, eq, nb, p1, p2 = -1, insId, mis, etapa, cursoDaEtapa`, deletes `jan` (called by js/eventos/agendamento.js:34-47) |
| js/instrutor-escolhido.js:104-109, 140-145, 165-172, 177-183 | `insId` (choice, its revert, Sugestões, their revert) |
| js/eventos/escala.js:177-186, 283-285 | Escala instructor change and Sugestões write `insId` on the request |
| js/reversoes.js:165-191 | `desfazerAgendamento`: restores or removes a request |
| js/eventos/historico.js:53-61, 96-106 | reverts `setFly` (`fly`) and `restaurarHorarios` (`p1`, `p2`, `jan`) |
| js/eventos/recursos.js:205-210 | saving take-off times adjusts `p1`, `p2`, `jan` of the open date's requests |
| js/eventos/cadastros.js:84-90, 123, 128 | new student gets `blank()`; deleting an instructor deletes `insId`; deleting a student removes the requests |
| js/storage.js:149-171; js/dias.js:96-101, 121; js/migracoes.js:21-35, 103-105 | load, join, new date, format step 12 |

Readers:

| File:line | What it reads, and why |
|---|---|
| js/views/demanda.js:49-121 | the table and the count |
| js/views/etapas.js:36-80, 135-144 | next mission and "Outra missão" (other requests' `etapa`) |
| js/views/etapas.js:170-173 | `cursoDoResultado`: `etapa`, `cursoDaEtapa` decide the course a result goes to (js/eventos/escala.js:240) |
| js/progresso.js:144-149 | `missoesDoDia`: `fly`, `etapa`, `mid` |
| js/horarios.js:47-50 | `fimDasMissoesDoDia`: a flying Noturno in the day (engine, compaction, Sugestões) |
| js/compactar.js:55-58, 63-71, 104-112, 292-299 | `p1`, `p2`, `pr`, `jan` (runs inside the engine) |
| js/reparo.js:29, 76, 85-88 | `jan` and the Noturno rule for the Sugestões |
| js/instrutor-escolhido.js:30-35, 98-100, 156-161 | instructor options and the "before" of a choice |
| js/agendamento.js:44, 132-160, 234-237, 242-250, 343-367, 1252-1257 | booking dialog: flying requests, engine order, why a request was left out, course mission, student list, History text |
| js/reversoes.js:136-149, 202-229; js/fixos.js:120-125 | whether a booking can be undone or a pin returns |
| js/views/cursos.js:56-68 | `codigosDaDemanda`: the Cursos tab locks a mission code while a request of the open date carries it (js/eventos/cursos.js:395-401) |
| js/views/horarios.js:42-43 | impact summary of a take-off times edit |
| js/views/agenda.js:139-148, 192-194; js/views/selos.js:47-59; js/eventos/agenda.js:48 | `importadas`: "Na demanda" / "Ainda não importado", the `#selo-age` badge, the import button label |
| js/dias.js:59-62 | `separar` (persistence) |
| scripts/medir-escalas.mjs:34-38 | `p1` for metrics |

NOT readers of the requests: CSV, PDF and Excel (js/export.js, js/csv.js, js/planilha.js), the BI (js/views/bi.js, `biDosDias` js/dias.js:172-180), the Painel and the TV (js/quadro.js, js/painel.js, `painel_do_dia`), `horas_dos_instrutores`, the rodízio and the 50 h hours of the next date. They read only the engine output (`RES.out`, `resultado`), `fStatus`, `fObs`. What reaches them from the request, through the output row: `mis`, `eqType`, `h`, `etapa`, `insEscolhido`, the preference tag, `stuId`, `mid`, `fKey`; and `tot` = number of flying requests (js/engine.js:1050), shown in the PDF as "Missões na demanda" (js/export.js:54) and used by the BI.

### 5.7 History entries the Demanda writes

| Action | Type and text | Revert |
|---|---|---|
| Pôr um aluno | `inc` "<aluno> incluído na demanda" (js/eventos/demanda.js:42) | `setFly`, label "↶ Reverter" |
| Voa | `inc`/`exc` "<aluno> incluído\|retirado (<missão> · <recurso> · <duração>)[, com a missão extra\|as N missões extras]" (:218-222) | `setFly` with `extras`, label "✕ Excluir" or "↶ Restaurar" |
| ✕ in the Escala | `exc` "Tirado da escala: <aluno> (<missão> · <recurso>)" (:189-191) | `setFly`, label "↶ Restaurar" |
| Instrutor | `mod` "Pedido <aluno>: instrutor <nome>\|automático (<missão>)" (:208) | `restaurarEscolha` |
| Missão, Recurso, Duração, 1ª, 2ª, Prioridade | `mod` "Pedido <aluno>: <missão> · <recurso> · <duração>[ (deixa de ser fixo)]" (:265): the same text for all six; a change of preference or priority is not named | none |
| Disponibilidade | `mod` "Pedido <aluno>: disponibilidade <rótulo> (<missão>)" (:228) | none |
| Usar | `inc` "<aluno>: <código> na demanda (<missão> · <recurso> · <duração>)[, com o curso <sigla> encerrado][ (deixa de ser fixo)]" (:115) | none |
| Outra missão | `inc` same text (:129), or "<aluno>: <código> na demanda, fora da ordem (<motivo>)…" (:148-149) | none |
| + missão | `inc` "Missão extra adicionada para <aluno>" (:169) | none |
| ✕ extra | `exc` "Missão extra removida de <aluno>" (:180) | none |
| Limpar demanda | `exc` "Demanda limpa[ e escala reaberta][ (N voo(s) em andamento fica(m))]" (:84-85) | none |
| Importar da agenda | `inc`, one per pedido (js/eventos/agenda.js:54-55) | none |

Revert kinds that touch a request (js/reversoes.js:43-117; applied in js/eventos/historico.js:46-124): `setFly` (`stuId`, `mid`, `val`, `extras`), `restaurarEscolha` (`pedidos[{stuId, mid, insId}]`, `fixos`, `soltar`), `restaurarFixos` (with `pedidos` insId), `restaurarHorarios` (`pedidos[{stuId, mid, p1, p2, jan}]`), `desfazerAgendamento` (the whole request before, `criadoComo`). All address a request by `stuId` + `mid`. Entries carry names of students and instructors; none carries personal data.

### 5.8 Behaviours with nowhere to live if the Demanda had no data of its own

1. A student put on the Demanda by hand with no pedido ("Pôr um aluno", Voa on).
2. Voa off while keeping the request, its pin and its status ("Tirar da escala e pôr de volta mantém o voo no lugar", demanda.spec.js:511), including the "✕" of the Escala.
3. An extra mission by hand (Ground in the morning and a flight in the afternoon), unless it becomes a second pedido.
4. The priority (`pr`): no other source exists.
5. The chosen instructor of the Demanda (`insId` with no pin: the engine looks for any time with only him). It is stored on the request, not in `fixos`.
6. A course mission out of order, or in a closed course, with its two-step confirmation and its History reason.
7. A mission type, resource type or duration set by hand, and the removal of the course code that follows.
8. The 1st and 2nd preferences and the Disponibilidade edited by hand (today the only way to loosen the exact time an imported pedido brings).
9. The frozen course mission: `etapa` + `cursoDaEtapa` are fixed when Usar or the import runs. A mission recomputed live would advance to the next one as soon as the flight's own result is registered, and a pinned flight whose derived mission, resource or duration changed would fall into the conflicts `tipo-de-aviao` or `duracao` (js/engine.js:436, 449).
10. "+ Agendar voo", Mover and Encaixar: they create or rewrite a request (js/agendamento.js:899-940) and "a booking creates no Agenda request" (docs/PLAN.md:421).
11. Limpar demanda (nothing to clear), with its side effects: release of every pin and status, reopening of the approved schedule.
12. The stable flight key: `stuId_mid_1` is assigned incrementally (`alvoDoNovoPedido`, `proximoMid`, "sobras"). A derivation from scratch has no stored pedido → `mid` mapping, so adding or cancelling a pedido could shift pins, statuses and results to another flight.
13. The reverts of 5.7, which restore fields of a request.
14. The take-off times edit that adjusts the open date's requests, with its revert (js/eventos/recursos.js:192-215).
15. The removal of `insId` from the requests when an instructor is deleted (js/eventos/cadastros.js:123).
16. The code lock of the Cursos tab, which reads the open date's requests (js/views/cursos.js:56-68).
17. The Demanda as the list of ALL students with a per-date switch, linked from Alunos ("Abrir a Demanda") with a shared Curso filter.
18. The Gestor's read access to the day's requests.

## 6. Conflicts with the request

1. "stored in the day as `stu[].fly` and `stu[].extra`": the day stores `dia.pedidos[<stuId>]` (with `extra` inside); `stu[]` is the joined state in memory (js/dias.js:59-62, 96-101). The engine does read `state.stu[].fly` and `.extra` (js/engine.js:292-303).
2. The column list in the request has 9 names; the table has 10 columns (it omits "Aluno", which holds the course code, "Usar", "Outra missão…", "+ missão", the booked tag and the "✕" of an extra) (index.html:326-335).
3. "Restrições impostas pelo operador … exist: fixed flights, the chosen instructor, '+ Agendar voo'": two of the three are stored on the day's REQUEST, not only as pins. The Demanda's chosen instructor is `pedidos[…].insId` with no pin (js/instrutor-escolhido.js:104-109), and "+ Agendar voo" writes the request's mission, course code, resource, hours, time and instructor besides the pin (js/agendamento.js:905-914). Both need writable per-date request data.
4. "missão definida pelo programa": derivable only for a student with a course that has a program, with results read; the import also requires the next mission to be of the type the pedido asks (js/agenda.js:121-122). PC and INVA have empty programs (js/programa.js:23). The pedido's mission type stays necessary.
5. "preferências aplicadas (Priorizar com, Não escalar com)" as a Processamento step: today nothing outside the engine applies them; the engine reads `voaCom` and `bl` from the roster (js/engine.js:586-589; js/viabilidade.js:38). With the engine untouched, Processamento can only show them.
6. "in the spirit of `importarSolicitacoes`": that function is DOM-free but mutates the state ("Só acrescenta", js/agenda.js:95-107, 116, 132, 135). The next-mission logic of the Demanda lives in a view module that reads the global `S` (js/views/etapas.js:10, 26-45).
7. "the screen … shows … why any of them cannot be scheduled": the engine's rejections are `{ t: 'err', s, m, codigo }` with no `stuId`, `mid` or `fKey` (js/engine.js:581, 765, 787-792, 800-805, 964). Today they are matched to a request by the label text (js/agendamento.js:234-237), which is ambiguous for two students with the same name or two extras of the same mission.
8. "Demanda will consume approved pedidos": `solicitacoes` has no approval state, only `cancelada_em` and `excecao` (supabase/migrations/20261110222506_agenda_de_solicitacoes.sql:6-24). A pedido also has one exact time and no resource type, instructor, priority or course code.
9. The accent-insensitive search the request asks to reuse (`chaveDeBusca`) is not what "Pôr um aluno na demanda" uses: it matches `x.nm.toLowerCase() === nome` (js/eventos/demanda.js:37).

## 7. Implications and options for the redesign (suggestions)

- S1. Materialize at approval. Approving a pedido writes the enriched request into `dia.pedidos` (what the import does today), and operator overrides stay where they are. Cost: small; the engine, the 41 goldens, the reverts, `fixos` and the booking stay as they are. Risk: the Demanda still has data of its own in storage; only the screen is "derived". A pedido cancelled later must be reconciled explicitly.
- S2. Pure derivation plus a per-date restriction store. `processar(cadastro, pedidos aprovados, restrições, programa, resultados, dia) → state` in today's shape, with a new day field keyed by pedido id (priority, instructor, resource, hours, availability, off, frozen `etapa`). Cost: a new data-format step with an `ESQUEMA` bump, new keys in `separar`/`juntar`/`diaPadrao`/`diaParaCopiar`, and every writer of 5.6 redirected. Risk: stable `mid` (item 12 of 5.8); two sources with different versioning (the day document is versioned whole, `solicitacoes` is not).
- S3. Key every derived request by the pedido id: emit all pedidos as extras with `mid = solicitacao id` and leave the main request off. Cost: the engine and goldens stay untouched, and keys are stable. Risk: every rejection label becomes "Nome (Missão)" (js/engine.js:561); modules that assume `mid` 0 is the main request change; old dates keep small `mid` numbers that could collide with pedido ids.
- S4. Freeze the course mission on the pedido at approval (`etapa`, `cursoDaEtapa`), instead of recomputing it. Cost: two columns or a JSON field in `solicitacoes`, with pgTAP tests. Risk: a code renamed in Cursos after approval; the existing lock reads only the open date.
- S5. To show why a pedido does not fit, either keep matching by label (free, ambiguous) or add `stuId` and `mid` to the engine's rejections. The second changes the `al` entries and therefore the goldens: its own commit.
- S6. Decide the hours rule once: today the import prefers the pedido's hours and "Usar" prefers the program's. Cost: one line. Risk: changes what operators see for imported flights.
- S7. Old dates keep `pedidos` made by hand with no `solicitacao`. Format steps never delete fields, so a derived stage needs a rule for dates before the cut-over (read-only in the old shape, or converted). Risk: History reverts of old entries address `stuId` + `mid`.

## 8. Open questions for Pedro

1. Priority (1 to 5): does it stay? As a field of the pedido set at approval, or as an operator restriction in the Escala stage?
2. An imported pedido is "Só às HH:MM" (one exact time). Should an approved pedido stay that strict, and where does the operator loosen it?
3. A student with no pedido: does the operator register a pedido on the spot (and which deadline rule applies), or does an operator-made request outside the pedidos remain?
4. Two flights for one student on one date: always two pedidos?
5. "+ Agendar voo": does it create an approved pedido, or does it keep creating a request with no pedido?
6. Is the course mission fixed at approval (and who confirms an out-of-order one), or recomputed until some point?
7. Hours: the pedido's (always filled, default 1 h) or the program's?
8. Resource type: a field of the pedido, or derived, with the override placed where?
9. A pedido cancelled after approval, when the flight is already pinned, approved or in progress: what happens to the flight?
10. Does "Limpar demanda" disappear, or become "release every pin and reopen"?
11. Voa off for one date keeping the pin and the status: an operator restriction ("fora da escala") or a cancelled pedido?
12. The chosen instructor with no fixed time (today's Demanda column): keep it as a kind of restriction?
13. Does the Gestor read the Processamento screen as he reads the Demanda today?
14. Dates before the cut-over, with requests made by hand: stay editable in the old model?
15. Old pedidos by period (`manha`, `tarde`, `noite`) still exist in the table: convert or keep reading them?

<!-- fim -->
