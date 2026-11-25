# Mapa: Notifications and pipeline states: badges, conflicts, warnings and what the app can compute

Read at worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to the worktree root. "(inferred)" marks what was deduced without a proving line; "(measured)" marks what was run with `node` on the pure modules, with fictitious data only. Nothing in the worktree was changed.

## 1. What exists

- **One list of alerts per date.** `runAllocationEngine(state)` returns `{ out, al, tot, revisao }` (js/engine.js:1050). `al` holds three types: `t: 'err'` (a request left out), `t: 'conf'` (a pinned flight that no longer fits) and `t: 'warn'` (js/escala-gravada.js:17). It is recomputed on every operator change (`save` → `refazerEscala`, js/actions.js:166-168, 370-380) and saved with the day as `resultado` (js/storage.js:241).
- **`js/conflitos.js` computes nothing.** It holds the code tables: `GRUPO_DO_CONFLITO` (19 conflict codes → repair group), `TEXTO_DO_PROBLEMA` (texts of the 7 instructor problems), `CODIGOS_DO_AGENDADO` (4), `CODIGOS_DE_AVISO` (11) and `CODIGOS_DE_REJEICAO` (21) (js/conflitos.js:5-77). The conflicts are computed in js/engine.js:420-449 with js/viabilidade.js:38-71.
- **Four badge elements, not three**, all drawn by `js/views/selos.js`: `#selo-esc`, `#selo-age`, `#selo-rec` on the tabs (index.html:92, 94, 96) and `#selo-rec-dia` on the "Disponibilidade do dia" button (index.html:153). A fifth counter is `#log-cnt` on "Histórico" (index.html:73; js/views/escala.js:273-274).
- **Where alerts are listed:** only in the Escala's summary (`resumo`, js/views/escala.js:453-478): a red open box for rejections, a red open box for conflicts with a "Sugestões" button each, an amber closed box for warnings with a grouped summary. Rows carry tags ("conflito", "fora da regra", "sem peso", "reduzir N gal", the padlock). The CSV and the PDF print the whole list (js/csv.js:60-64; js/export.js:87).
- **Repair:** `sugerirReparos` / `aplicarReparo` (js/reparo.js:22-125) behind the drawer `#painel-reparo` (js/views/reparo.js:19-45). Only for conflicts (`voo.conflito`, js/reparo.js:24).
- **Approval:** `S.aprovacao = { em, por }` plus `S.fixos` (js/eventos/escala.js:204-205; js/fixos.js:29-32, 59-69).
- **Exports:** CSV, PDF, Excel (js/export.js:32-35, 37-101, 119-155). They leave no record (5.3).
- **History:** per date, with author and time (js/actions.js:212-239, 254-265; table `historico`, supabase/migrations/20261110201618_dias_e_historico.sql:64-74 and 20261110202010_historico_autor.sql:3-27).
- **Pedido counts:** the Agenda's month calendar counts non-cancelled pedidos per day in the browser (js/views/agenda.js:118-135); `#selo-age` counts the open date's pedidos not yet imported (js/views/selos.js:47-54).
- **App-level notices** (not per date): `#aviso-sync` (conflict, waiting for the connection, refusal, failure; js/dom.js:24-37; js/actions.js:112-145), `#aviso-dados` (data not read; js/actions.js:70-79), toasts (2.8 s, js/dom.js:10-19), `#anuncio` for screen readers (js/dom.js:309-314).
- **No polling and no realtime in the main app** (grep of `setInterval`, `.channel(`, `visibilitychange` in js/: only js/views/painel-aeroporto.js:284, the Painel clock, and the save retry in js/backends/supabase.js:24).

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

| Field | Stored in | Scope | Shape | Written by |
|---|---|---|---|---|
| `RES` (`resultado`) | day document: `dias.conteudo.resultado` / `acpm4_dia_<data>` (js/storage.js:241; js/backends/local.js:15) | per date | `{ out, al, tot, revisao, data }` (js/actions.js:367); read back only if every row and alert passes `normalizarEscalaGravada` (js/escala-gravada.js:103-123) and the Noturno returns match (js/storage.js:205-206) | `save()` on every change (js/actions.js:166-170); `gravarEscalaCalculada()` on export (js/actions.js:199-202) |
| `RES.al[]` | inside `resultado` | per date | `{ t, s, m, fKey?, codigo?, stuId?, insId? }`; other fields are dropped on load, and a code outside its type's list invalidates the whole saved schedule (js/escala-gravada.js:85-94, 107) | the engine only |
| `RES.out[].conflito`, `.conflitoCodigos` | inside `resultado` | per date | texts and codes of a pinned flight's conflicts (js/engine.js:531; js/escala-gravada.js:65-66) | the engine |
| `RES.out[].comb` | inside `resultado` | per date | `{ reduzirGal, abastecerGal, minimoGal, autonomiaMin }` when the crew is over the weight limit with full tanks (js/combustivel.js:29-32) | the engine |
| `RES.out[].baseTag` / `.tag` | inside `resultado` | per date | 'Pref. 1', 'Pref. 2', 'Próximo livre', 'Horário ajustado' (js/escala-gravada.js:15) | the engine; 'Horário ajustado' by the compaction (js/compactar.js:293-299) |
| `RES.out[].fixo`, `.agendado`, `.insEscolhido`, `.insPar`, `.trecho`, `.livreAs` | inside `resultado` | per date | marks (js/escala-gravada.js:55-64) | the engine |
| `RES.revisao[reg]` | inside `resultado` | per date | `{ inicio, voadas, fim, paraAs }`, `paraAs` in minutes or null (js/engine.js:1011-1020) | the engine |
| `S.fStatus[fKey]`, `S.fObs[fKey]` | day (js/dias.js:63-64) | per date | status; `{ novoInicio }` or `{ motivo, texto? }` (js/status.js:9-14) | `aplicarStatus` (js/eventos/escala.js:123-138) |
| `S.fixos[fKey]` | day (js/dias.js:68) | per date | `{ a, b, r, insId, classKey?, escolhido?, agendado? }` (js/fixos.js:14-27) | approve, reopen, status, chosen instructor, booking, Sugestões, Limpar demanda |
| `S.aprovacao` | day (js/dias.js:69) | per date; a new date starts with `null` (js/dias.js:122) | `{ em: ISO string, por: string up to 80 }` or `null` (js/fixos.js:29-32) | set js/eventos/escala.js:205; cleared js/eventos/escala.js:214 and js/fixos.js:115 |
| `S.criterios` | day (js/dias.js:70) | per date, copied to the next new date (js/dias.js:120-122) | `{ buracos, horarios }`; `buracos` is 'inva', 'aviao' or 'maior'; `horarios` is 'disponibilidade', 'preferencias' or 'fixos' (js/criterios.js:3-20) | js/eventos/escala.js:222-231 |
| `S.importadas` | day (js/dias.js:71) | per date; a new date starts with `[]` | ids of pedidos already imported | `importarSolicitacoes` only (js/agenda.js:116); never shrinks (5.3) |
| `S.av[reg]`, `S.horas[reg]`, `S.win[i]`, `S.ins[].on`, `.aw` | day (js/dias.js:56-58, 65) | per date, copied forward | availability, hours since the inspection, open windows | js/eventos/recursos.js:115-145, 171-176; js/eventos/cadastros.js:140-181 |
| `S.limites` | cadastro (js/dias.js:50) | all dates | the eight law limits (js/limites.js:9-18) | Administrador (local: Operador), js/eventos/cadastros.js:229-248 |
| `S.horasDosInstrutores`, `S.horasBase`, `S.resultados`, `S.programa`, `S.indisponiveis`, `S.noturnosDaVespera` | memory only, read with the date (js/storage.js:197-212; js/actions.js:305) | per date | not saved | `lerData`, `lerDadosDeNovo` |
| `solicitacoes` (pedidos) | table (supabase/migrations/20261110222506_agenda_de_solicitacoes.sql:6-24, plus `horas` in 20261114222031:8) / `acpm4_agenda` (js/backends/local.js:17) | one row per pedido, with `data` | `id, data, aluno, aluno_nome, missao, janela, horario, horas, observacao, registrado_por, registrado_em, usuario, conta, excecao, cancelada_em, cancelada_por, cancelada_usuario` | `registrar_solicitacao`, `cancelar_solicitacao` only |
| `pedidosDaData` | module variable (js/views/selos.js:36) | open date | `{ data, lista }` | `lerPedidosDaData` (js/views/selos.js:38-45) |
| `pedidos`, `diaEscolhido`, `mesVisivel` | module variables (js/views/agenda.js:17-19) | the Agenda's own month and day, separate from `DATA` | rows of the month grid | `carregarMes`, `escolherDia`, `mudarMes` |
| History entry | table `historico` / `acpm4_historico`, last 1000 entries of all dates (js/backends/local.js:16, 125-132) | per date | `id, data, registrado_em, usuario, autor, tipo, descricao, reverter, reverte, importado`; read 200 per date (js/backends/supabase.js:169-175) | `registrar_historico`: operators and administrators only (20261110202010_historico_autor.sql:16) |
| `escalaSoCalculada`, `dadosLidos`, `gravacaoAtual` | module variables (js/actions.js:151, 163, 199) | session | schedule on screen not yet saved; date read; last save promise | js/actions.js |
| "Atualizada às HH:MM" | DOM only, `#escala-atualizada-texto` (js/actions.js:178-180); hidden on a date change (js/actions.js:323) | session | text | `save()` |
| `dias.versao`, `atualizado_por`, `atualizado_em` | columns of `dias` (20261110201618_dias_e_historico.sql:11-17) | per date | who saved the day last (uuid) and when | `salvar_dia`; the app never reads the last two (js/backends/supabase.js:102) |

## 3. Controls inventory (one table row per control on screen)

| Label | Element (id, data-act, data-f, class) | Handler (function, file:line) | State read and written | Profiles that can use it |
|---|---|---|---|---|
| Badge on "Escala" | `span.aba-selo#selo-esc` in `#nav button[data-t="esc"]` (index.html:92); classes `erro` or `aviso` | display by `atualizarSelosDaEscala` (js/views/selos.js:20-24); the tab click is `show('esc')` (js/eventos/navegacao.js:19-25) | reads `RES.al` | Operador, Administrador, Gestor, Secretaria |
| Badge on "Agenda" | `span.aba-selo#selo-age` (index.html:94), no severity class | `atualizarSeloDaAgenda` (js/views/selos.js:52-60) | reads `pedidosDaData`, `S.importadas` | shown only when `!isGestor()`: Operador, Administrador (js/views/selos.js:53) |
| Badge on "Recursos" | `span.aba-selo#selo-rec` (index.html:96) and `#selo-rec-dia` in `[data-vista-rec="dia"]` (index.html:153), class `aviso` | js/views/selos.js:26-31 | reads `RES.revisao`, `S.av` | every profile that sees the tab; the Secretaria's Recursos tab is hidden (css/app.css:184) |
| "Histórico" with count | `#btn-open-log`, `span.badge-cnt#log-cnt` (index.html:73) | `mostrarHistorico` (js/eventos/historico.js:20-31); count in `renderAuditPanel` (js/views/escala.js:267-301) | reads `AUDIT_LOG` | hidden for the Secretaria (css/app.css:187) |
| "N missões não entraram na escala: nomes" | `details.caixa.erros[open]` with `li.al.err` (js/views/escala.js:466-469) | none: no button, no link | reads `RES.al` | all |
| "N voos em conflito na escala aprovada" / "N voos fixos em conflito" | `details.caixa.conflitos[open]` (js/views/escala.js:472-475) | native details | reads `RES.al`, `S.aprovacao` | all |
| "Sugestões" | `button.btn.quiet.edit-only[data-reparo="<fKey>"]`, title "O que pode voar no lugar deste voo" (js/views/escala.js:472) | click listener js/eventos/escala.js:266-268 → `abrirPainelDeReparo` (js/views/reparo.js:19) | reads `S`, `RES` | Operador, Administrador |
| "Aplicar" / "Soltar" / "Cancelar o voo" | `button[data-reparo-aplicar="<i>"]` in `#painel-reparo` (js/views/reparo.js:38-41); "✕" `#btn-fechar-reparo` | js/eventos/escala.js:266-294 | writes `S.fixos`, request `insId`; `gravarAlteracao('mod', 'Reparo: …', { kind: 'restaurarFixos' })` (js/eventos/escala.js:289-291); cancel opens `#dlg-status` | Operador, Administrador |
| "N avisos: …" | `details.caixa.avisos` (closed) (js/views/escala.js:476) | native details; text from `resumoDosAvisos` (js/views/escala.js:425-451) | reads `RES.al` | all |
| Row tags | `span.tag.er[data-dica="conflito"]` (js/views/escala.js:539); `span.tag.fb[data-dica="fora-da-regra"]` (:494); `span.tag.fb[data-dica="sem-peso"]` (:325); `span.tag.comb[data-dica="reduzir-combustivel"]` (:331); `svg.ico.fixo[data-dica="voo-fixo"]` (:536); row class `em-conflito` (:530) | glossary tips (js/dicas.js:114-150) | read only | all |
| Status of a flight | `select.st-sel[data-f="fstatus"][data-fkey]` (js/views/escala.js:335); detail `button.st-detalhe[data-act="detalhe-status"]` (:367) | `mudarStatus`, `aplicarStatus` (js/eventos/escala.js:123-144, 189-193) | writes `S.fStatus`, `S.fObs`, `S.fixos` | Operador, Administrador (disabled for the others) |
| Instructor of a flight | `button.ins-btn[data-act="trocar-instrutor"]` → `select.ins-sel[data-a="insVoo"]` (js/views/escala.js:348, 357) | js/eventos/escala.js:148-186 | writes the request's `insId`, `S.fixos` | Operador, Administrador |
| "Aprovar escala" | `button#btn-aprovar.btn.edit-only` in `#aprovacao` (js/views/escala.js:390; index.html:369); disabled with a `title` when `dadoIndisponivel('horas')` (js/views/escala.js:387-389) | click listener js/eventos/escala.js:197-209, two clicks ("Confirmar aprovação") | writes `S.fixos`, `S.aprovacao`; History "Escala aprovada: N voos fixados" | Operador, Administrador |
| "Reabrir" | `button#btn-reabrir.btn.sec.edit-only` (js/views/escala.js:384) | js/eventos/escala.js:210-218 ("Confirmar reabertura") | writes `S.fixos`, `S.aprovacao = null`; History "Escala reaberta: volta a ser refeita a cada alteração" | Operador, Administrador |
| "Aprovada às HH:MM por X" | `span#selo-aprovada.selo-aprovada` (index.html:345; js/views/escala.js:378-383) | display | reads `S.aprovacao` | all |
| "Buracos" / "Horários" | `button[data-criterio="buracos"][data-valor]` and `button[data-criterio="horarios"][data-valor]` in `#criterios` (js/views/escala.js:405-407) | js/eventos/escala.js:222-231 | writes `S.criterios`; History "Compactação: … → …" | Operador, Administrador; `aria-disabled` when approved or for the Gestor (js/views/escala.js:401-406) |
| "INVAs parados / aviões parados / saídas do hangar" | `div#tempo-parado.parado` (js/views/escala.js:413-420) | display | reads `metricasDaEscala(out)` | all |
| "Atualizada às HH:MM" | `#escala-atualizada[role="status"]` (index.html:345) | set in `save()` (js/actions.js:178-180) | session only | whoever saves |
| "CSV" / "PDF" / "Excel" | `#exp`, `#pdf`, `#xlsx` (index.html:359-361), class `btn sec` (not `edit-only`) | js/eventos/escala.js:90-92 → `exp`, `pdf`, `planilha` (js/export.js) | reads `RES`, `S`; writes nothing but `gravarEscalaCalculada()` | all four profiles; the Gestor exports without saving |
| "Compartilhar" | `#btn-share-link` (index.html:358) | js/eventos/escala.js:106-118 | copies the date link | hidden for the Secretaria (css/app.css:188) |
| "Tentar de novo" | `#btn-tentar-dados` in `#aviso-dados[role="status"]` (index.html:120-123) | js/eventos/topo.js:114-117 → `lerDadosDeNovo` (js/actions.js:85-108) | writes `S.indisponiveis`, hours, results, programs | all |
| "Recarregar" | `#btn-recarregar` in `#aviso-sync[role="alert"]` (index.html:108-111) | js/dom.js:26-32 | reload | all |
| History entry buttons | `button.x.edit-only[data-act="rev-log"][data-logid]`, labels "↶ Reverter", "↶ Desfazer", "✕ Excluir", "↶ Restaurar" (js/views/escala.js:285-288) | js/eventos/historico.js:46-124 | writes the state through `gravarAlteracao(…, null, entry.id)` | Operador, Administrador |
| "Limpar o histórico desta data" | `#btn-clear-log` (index.html:674) | js/eventos/historico.js:37-43 | deletes the date's local History | local mode only (css/app.css:1564) |
| Agenda month "‹" "›" | `button[data-cal="mes"][data-delta]` (js/views/agenda.js:126-128) | js/eventos/agenda.js:18-21 → `mudarMes` | writes `mesVisivel`, `diaEscolhido`; one query | all, the Gestor included (js/eventos/agenda.js:17) |
| Agenda day cell with count | `button.dia[data-cal="dia"][data-dia]`, classes `fora`, `fechado`, `sel`; `span.qtd` (js/views/agenda.js:130-134) | js/eventos/agenda.js:22-26 → `escolherDia`, then `carregarData` for a non-Sunday | writes `diaEscolhido` and the app's `DATA` | all; no role check (section 6, item 16) |
| "Importar da agenda" / "Importar N pedidos da agenda" | `#importar-agenda.btn.sec.edit-only` (index.html:302); text set in js/views/selos.js:56-59 | `importarDaAgenda` (js/eventos/agenda.js:31-60) | writes requests, `S.importadas`; one History entry per pedido | Operador, Administrador |
| "Importar N pedidos para a demanda" | `#agenda-importar.btn.edit-only` (index.html:292; js/views/agenda.js:192-194) | same function (js/eventos/agenda.js:61) | same | Operador, Administrador (`podeImportar`, js/views/agenda.js:24-26) |
| "Revisão feita" | `button.btn.quiet.rev[data-act="revisao"][data-id]` (js/views/recursos.js:69) | js/eventos/recursos.js:171-176 ("Confirmar revisão") | `S.horas[reg] = 0` | Operador, Administrador |
| Hours until the inspection | `input.horas[data-a="horas"][data-horas]` (js/views/recursos.js:67) | js/eventos/recursos.js:131-145 | `S.horas[reg]` | Operador, Administrador |
| Aircraft available | `input.sw[data-a="av"][data-id]` (js/views/recursos.js:65) | js/eventos/recursos.js:122-129 | `S.av[reg]` | Operador, Administrador |
| "Vem" and windows of an INVA | `input.sw[data-f="on"]`, `input[data-f="aw"][data-w]` in `#inst-dia` (js/views/cadastros.js:82, 86) | js/eventos/cadastros.js:140-181 | `x.on`, `x.aw` | Operador, Administrador |
| Law limits | `input[data-limite][data-divisor]`, `button[data-limites-padrao]` in `#limites-lei` (js/views/cadastros.js:228-230) | js/eventos/cadastros.js:229-248 | `S.limites` | Administrador; in local mode the Operador (js/views/cadastros.js:75) |

## 4. Rules and the tests that pin them (file and test name)

| Rule | Test |
|---|---|
| `#selo-esc` shows the number of warnings in amber | test/e2e/selos.spec.js "Escala: o número de avisos, em âmbar" |
| Rejections come first, in red; nothing to report, no badge | test/e2e/selos.spec.js "Escala: missões que não entraram vêm primeiro, em vermelho; sem nada a avisar, sem selo" |
| `#selo-rec` and `#selo-rec-dia` count aircraft stopped or under 5 h; exact `title` texts; both go after "Revisão feita" | test/e2e/selos.spec.js "Recursos: aviões parados ou com menos de 5 h até a revisão de 50 horas, também no botão da Disponibilidade do dia" |
| `#selo-age` counts the date's pedidos not in the Demanda; the import button text follows | test/e2e/selos.spec.js "Agenda: pedidos da data que ainda não estão na demanda; somem depois de importar" |
| The Gestor never sees `#selo-age` | test/e2e/selos.spec.js "o Gestor não vê o selo da agenda (ele não importa pedidos)" |
| The red badge has enough contrast in both themes | test/e2e/acessibilidade.spec.js "o selo vermelho da aba (missões que não entraram na escala) contrasta, no tema …" |
| Every rejection has a code of the list; every marked mission is placed or rejected | test/unit/engine.invariants.test.js "toda rejeição tem um código da lista", "toda missão marcada é alocada ou recebe um alerta de rejeição" |
| The saved schedule keeps only known alert codes per type | test/unit/escala-gravada.test.js "os avisos do voo agendado fora das regras: os códigos valem no aviso; só o limite de locais vale também na rejeição", "alertas, total, revisão e data também no formato; os campos desconhecidos saem" |
| Pinned flights are checked again; each conflict has a code | test/unit/fixos.test.js "Voos fixos conferidos de novo" (11 tests), e.g. "os conflitos do instrutor indisponível e da missão ou do avião que mudou também têm código" |
| Booked flights: the conflict stays on the booked one; the four skipped rules become warnings; missing weight only on a booked flight | test/unit/fixos.test.js "Voos agendados no motor" (12 tests) |
| Summary boxes of the Escala | test/e2e/escala-tela.spec.js "resumo: os números numa linha; o que não entrou numa caixa vermelha aberta; os avisos agrupados numa caixa fechada", "resumo dos avisos: alunos e instrutores sem peso", "o voo agendado fora das regras: a etiqueta \"fora da regra\" com o caso na dica, e o resumo conta os agendamentos", "o voo fixo em conflito sem a escala aprovada: \"voo fixo em conflito\", com o conflito do agendado" |
| Sugestões | test/unit/reparo.test.js (14 tests), test/unit/reparo-horario.test.js, test/e2e/reparo.spec.js (6 tests, e.g. "no Gestor, a caixa de conflitos aparece sem o botão Sugestões") |
| Law limits and the 90 % warning | test/unit/limites.test.js "a partir de 90% do mês, a escala avisa", "sem instrutor dentro dos limites, o voo não entra e a mensagem diz por quê"; test/e2e/limites.spec.js |
| Weight and fuel | test/unit/combustivel.test.js (11 tests); test/unit/engine.rules.test.js "Peso da tripulação" (5 tests); test/e2e/escala-tela.spec.js "acima do limite com os tanques cheios, o voo sai com menos combustível: a coluna Peso diz quanto reduzir" |
| Delay that invades another flight | test/unit/status.test.js "Atraso que invade o voo seguinte" (6 tests); test/e2e/status.spec.js "Atrasado pede a nova decolagem, depois da original; o atraso que invade o voo seguinte vira aviso", "na escala aprovada, o atraso que invade o voo seguinte vira aviso" |
| 6 local flights per take-off time | test/unit/engine.rules.test.js "No máximo 6 voos locais no mesmo horário" (3 tests); test/unit/agenda.test.js "Agenda: o limite de voos locais no mesmo horário"; supabase/tests/database/agenda-locais.test.sql |
| 50 h inspection | test/unit/engine.rules.test.js "Revisão de 50 horas" (4 tests); test/e2e/revisao.spec.js |
| Rest before the Noturno return is a warning | test/unit/noturno.test.js "o repouso antes da volta é um aviso, e a regra do repouso não barra os voos novos do instrutor" |
| Approve, reopen, the padlock | test/e2e/aprovacao.spec.js (6 tests, e.g. "aprovar fixa os voos: o selo diz quando e quem; …", "no Gestor, o selo aparece e os botões não"); test/unit/fixos.test.js "O cadeado do voo", "O voo agendado na Escala" |
| Approval off without the instructors' hours | test/e2e/compartilhado.spec.js "sem as horas dos instrutores ou os resultados: aviso fixo, Aprovar escala desligado e \"Tentar de novo\"" |
| Export saves a schedule that was only calculated; the Gestor exports without saving | test/e2e/escala-automatica.spec.js "exportar uma escala só calculada a grava (BI e dia seguinte); exportar de novo não grava outra vez", "exportar o Excel também grava a escala só calculada", "o gestor exporta sem gravar" |
| Compaction and criteria | test/unit/compactar.test.js (22 tests); test/e2e/compactacao.spec.js "com a escala aprovada, os critérios só aparecem", "no Gestor, os critérios do dia aparecem travados" |
| History entry states and author | test/e2e/compartilhado.spec.js "enquanto a alteração é gravada, a entrada aparece \"gravando…\" sem Reverter; depois, registrada e com Reverter", "a alteração recusada … \"não gravada\", sem Reverter"; test/e2e/datas-compartilhado.spec.js "o histórico mostra quem fez cada alteração" |
| Agenda calendar counts | test/e2e/agenda.spec.js "registra pedidos para amanhã (antes das 13:00) com quem anotou e a hora" (`.qtd` 1 then 2), "cancelar pede confirmação e o pedido continua na agenda como cancelado" (`.qtd` gone) |
| Who reads `solicitacoes` | supabase/tests/database/leitura.test.sql ("operador/administrador/gestor/secretaria lê a agenda", "conta sem perfil não lê a agenda"); painel.test.sql:82 "painel não lê a agenda" |
| Next mission and progress | test/unit/progresso.test.js (34 tests) |
| Metrics | test/unit/metricas.test.js (7 tests) |

Repo rules touched in this area:
- **Goldens.** They record every alert, one per line (test/helpers/goldens.js:1-3), and `assert.deepEqual` compares the whole returned object (test/unit/engine.golden.test.js:15, 22). Any new field on an alert, or on the engine's return value, changes golden files.
- **`gravarAlteracao`.** Every change to the day's data in this area goes through it (approve, reopen, criteria, status, Sugestões, import). Three paths do not, by design: a course result is not day data, so it uses `logChange` or `ApiClient.registrarHistorico` directly (js/eventos/escala.js:254-256); an export calls `gravarEscalaCalculada()`, which saves the schedule already on screen with no History entry (js/actions.js:199-202; js/eventos/escala.js:90-92); "Tentar de novo" calls `save()` after the hours arrive (js/actions.js:106). None of the three changes the day's data. A recorded export would be a new write and must go through `gravarAlteracao`.
- **Personal data.** Alert items carry names (`a.s`) and texts with names; they already go to the CSV and the PDF (js/csv.js:63; js/export.js:87). The History gets names and weights ("Peso <nome>: <kg> kg", js/eventos/cadastros.js:156, 200; js/agendamento.js:1278), which is today's behaviour; the cancellation's free text never goes to the History, the CSV or the PDF (js/status.js:98-103; js/csv.js:22; js/export.js:65).
- **Data-format steps.** `aprovacao` came with format 16, `criterios` with 17, `importadas` with 10 (js/migracoes.js:79, 129, 134). A new per-date field ("exportada") needs format 26 or later (`ESQUEMA = 25`, js/migracoes.js:13).

## 5. Answers

### 5.1 The badges: what each counts, when it is recomputed, tooltip, accessible text

All four are filled by `selo(aba, quantidade, tipo, dica)` (js/views/selos.js:11-18): `hidden = !quantidade`, `textContent` = the number, `className = 'aba-selo' + tipo`, `title` = the text, or `''` at zero.

| Badge | Counts | Class (colour) | `title` (the only tooltip) |
|---|---|---|---|
| `#selo-esc` | If `RES.al` has any `t === 'err'`: only the rejections. Otherwise `RES.al.length`, which is warnings **plus conflicts** (js/views/selos.js:21-24) | `erro` (`#C62828`, css/app.css:180) or `aviso` (`--ye`, css/app.css:179) | "1 missão não entrou na escala" / "N missões não entraram na escala"; or "1 aviso na escala" / "N avisos na escala" |
| `#selo-rec` | Entries of `RES.revisao` with `S.av[r] !== false` and (`paraAs !== null` or `REVISAO_H - fim < 5`) (js/views/selos.js:9, 26-28) | `aviso` | "N avião parado ou perto da revisão de 50 horas (Recursos › Disponibilidade do dia)" / "N aviões parados ou perto …" (js/views/selos.js:29-30) |
| `#selo-rec-dia` | the same number | `aviso` | the same text without the parenthesis (js/views/selos.js:31) |
| `#selo-age` | `pedidosDaData.lista` of the open date with no `cancelada_em` and an id outside `S.importadas`; forced to 0 when `isGestor()` (js/views/selos.js:47-54) | none (translucent white, css/app.css:178) | "1 pedido da agenda ainda não está na demanda" / "N pedidos da agenda ainda não estão na demanda" |

Facts the plan needs:
- **`#selo-esc` never shows two things.** With one rejection and three conflicts it shows "1" in red; conflicts are counted only when there is no rejection, and then as "avisos", in amber, although the Escala draws them in a red box (js/views/escala.js:472-475; css/app.css:699).
- **`#selo-rec` uses a wider rule than the engine's warning.** The engine warns only when the aircraft stops (`REVISAO_H - fim < MENOR_VOO_H`, 1 h; js/engine.js:1018-1028). The badge also counts aircraft that end the day under 5 h. (measured) An aircraft at 47 h with no flight gives no alert in `al` and still counts in the badge, which test/e2e/selos.spec.js:33-36 pins (`#selo-rec` "1" and `#selo-esc` hidden).
- **`#selo-age` never clears for a pedido whose student is not in the cadastro**: the import skips it without adding it to `S.importadas` (js/agenda.js:113-115; (measured) `semAluno: 1` on every import).
- **Recomputed:** `atualizarSelosDaEscala()` runs at the end of the app's opening (js/main.js:138), after a date change (js/actions.js:325) and in every `refazerEscala` (js/actions.js:379), that is, on every saved change. It ends by calling `atualizarSeloDaAgenda()` (js/views/selos.js:32), which also runs in `setRole` (js/actions.js:61) and after each fetch (js/views/selos.js:44).
- **The pedidos behind `#selo-age` are fetched** by `lerPedidosDaData()` at the opening (js/main.js:139), on a date change (js/actions.js:326) and after this browser registers or cancels a pedido (js/eventos/agenda.js:120, 153). A pedido registered on another computer shows up only at the next of those moments. A failed fetch counts as no pedidos (`.catch(() => [])`, js/views/selos.js:41). Between a date change and the answer the badge is hidden, because the cached list belongs to the other date (js/views/selos.js:47-49).
- **Accessible text: none of its own.** No `aria-label`, no `.sr` text, no live region; the number is plain text inside the tab button after `span.aba-rotulo` (index.html:92-96). (inferred) The tab's accessible name is the label followed by the bare number. The `title` sits on a span that cannot take focus, so it is a mouse-only tooltip, and it does not use the app's keyboard-reachable tips (`data-dica`, js/dicas.js:114-150). The one related assertion is for another button: `#btn-open-log` keeps a name starting with "Histórico" (test/e2e/acessibilidade.spec.js:263-266).
- **The Manual describes them** (index.html:456): "Os números ao lado do nome das abas avisam o que pede atenção: na Escala, as missões que não entraram (em vermelho) ou os avisos (em amarelo); na Agenda, os pedidos que ainda não estão na demanda; em Recursos, os aviões parados ou perto da revisão de 50 horas (na Disponibilidade do dia, cujo botão mostra o mesmo número)."

### 5.2 Every kind of conflict and warning for a date

What "blocks" means today: **nothing in `RES.al` blocks saving, approving or exporting.** The approve handler checks only the role, `RES` and `aindaNaoAbriu()` (js/eventos/escala.js:197-201). The only gate is `dadoIndisponivel('horas')`, which disables "Aprovar escala" (js/views/escala.js:386-390). A rejection keeps that one request out; a conflict leaves the flight where it is.

**A. Conflicts of a pinned flight** (`t: 'conf'`). One alert per flight: `{ t: 'conf', s, fKey, m }`, with `m` = "Conflito na escala aprovada: …." or "Conflito no voo agendado: …." and the texts joined by "; " (js/engine.js:533). The codes are on the row (`conflitoCodigos`), not on the alert (js/escala-gravada.js:85). A pinned flight with status Cancelado is not checked (js/engine.js:426). **Time: yes**, through `fKey` → the row's `a` and `b`. **Resolved** in the Escala: "Sugestões" on the conflict line → `#painel-reparo` ("Aplicar", "Soltar", "Cancelar o voo"), or by undoing the cause where noted.

| Code (group) | Text | Computed at | Other place that undoes the cause (inferred from the rule) |
|---|---|---|---|
| `instrutor-saiu` (instrutor) | "o instrutor saiu do cadastro" | js/viabilidade.js:40; js/conflitos.js:37 | none (the INVA was deleted) |
| `instrutor-indisponivel` (instrutor) | "o instrutor não está disponível" | js/viabilidade.js:54 | Instrutores › Disponibilidade do dia: `[data-f="on"]`, `[data-f="aw"]` |
| `habilitacao` (instrutor) | "o instrutor não tem a habilitação da missão"; "… que o curso do aluno exige nesta missão (o noturno do PC é IFR)"; "… a habilitação própria do <REG>" | js/viabilidade.js:56-57; js/conflitos.js:39-41 | Instrutores › Cadastro: "Editar habilitações" |
| `instrutor-ocupado` (instrutor) | "o instrutor já tem outro compromisso neste horário" | js/viabilidade.js:58 | none |
| `bloqueio` (instrutor) | "o aluno não voa com este instrutor" | js/viabilidade.js:59 | Alunos: "Não escalar com" |
| `limite-da-lei` (instrutor) | "o instrutor passaria do limite da lei (horas de voo no dia / jornada / horas de voo no mês / horas de voo no semestre / horas de voo no ano / repouso)" | js/viabilidade.js:60; js/limites.js:101-117; js/conflitos.js:29-32, 44 | Instrutores: hours flown outside the app; the limits (Administrador) |
| `peso` (instrutor) | "o peso do aluno e do instrutor passa do limite do avião, mesmo com o mínimo de combustível" | js/viabilidade.js:61; js/combustivel.js:10-20 | Alunos or Instrutores: weight |
| `ground-ou-voo` (pedido) | "o pedido passou de voo para Ground" / "o pedido passou de Ground para voo" | js/engine.js:433 | only "Soltar" or "Cancelar" (js/reparo.js:46, 54, 73) |
| `duracao` (pedido) | "a duração do pedido mudou" | js/engine.js:449 | same |
| `tipo-de-aviao` (aviao) | "a missão ou o avião do pedido mudou" | js/engine.js:436 | Demanda: Missão, Recurso |
| `aviao-indisponivel` (aviao) | "o avião está indisponível" | js/engine.js:437 | Recursos › Disponibilidade do dia: `[data-a="av"]` |
| `aviao-ocupado` (aviao) | "o avião já está ocupado neste horário" | js/engine.js:438 | none |
| `so-parafuso` (aviao) | "o Parafuso só voa no <REGs>" / "o <REG> é só para o Parafuso" | js/engine.js:441 | Recursos › Cadastro: atributos |
| `so-vfr` (aviao) | "o <REG> não é homologado IFR, e o voo é IFR" | js/engine.js:442 | Recursos › Cadastro: atributos |
| `revisao` (aviao) | "o avião passaria da revisão de 50 horas" | js/engine.js:443 | Recursos: "Revisão feita", hours |
| `sala-ocupada` (aviao) | "a sala de Ground já está ocupada neste horário" | js/engine.js:444 | none |
| `aluno-ocupado` (horario) | "o aluno já tem outro voo neste horário" | js/engine.js:445 | none |
| `horario-fechado` (horario) | "o horário está fechado nesta data" | js/engine.js:446 (`state.win`) | Recursos: Janelas de operação `[data-a="win"]` |
| `disponibilidade` (horario) | "o horário está fora da disponibilidade do aluno" | js/engine.js:447-448 | Demanda: Disponibilidade `[data-f="jan"]` |

**B. Rejections** (`t: 'err'`): the request is not in `out`. Alert `{ t: 'err', s, m: 'Rejeitado: <why>.', codigo }`. **No `fKey`, no `stuId`, no time**: `s` is the student's name, or "name (mission)" for an extra (js/engine.js:561). The red box has **no control at all** (`item`, js/views/escala.js:458). The comment "para dizer onde resolver" (js/conflitos.js:71) is not implemented as navigation; the only consumer of the codes is the booking dialog's short reason `FORA_DA_ESCALA` (js/agendamento.js:223-237), which matches the alert to the request **by the label text**. The "resolved where" column below is therefore (inferred) from each rule.

| Code | Text after "Rejeitado: " | Line | Resolved where (inferred) |
|---|---|---|---|
| `instrutor-escolhido` | "o instrutor escolhido (<nome>) não está disponível nesta data" / "… não tem a habilitação de <mis> no <eq> (…)" / "… está em “Não escalar com” deste aluno" | js/engine.js:576-582 | Demanda: Instrutor `[data-f="insId"]` |
| `sem-instrutor-habilitado` | "nenhum instrutor ativo tem a habilitação de <mis> [no <eq>] (<exigências>)" | js/engine.js:747, 938 | Instrutores: "Vem", "Editar habilitações" |
| `ground-antes-do-voo-fixo` | "o Ground precisa terminar antes do voo fixo das HH:MM, e não há horário para ele antes disso" | js/engine.js:749 | Escala: the pinned flight |
| `disponibilidade-do-aluno` | "nenhum horário aberto na disponibilidade do aluno (<rótulo>) comporta <horas>" | js/engine.js:752, 940 | Demanda: Disponibilidade |
| `sem-horario` | "nenhum período aberto comporta 01h30 de Ground…" / "nenhum horário aberto comporta <horas> [a partir das 17:30 / até as HH:MM]" | js/engine.js:753, 944 | Recursos: Janelas de operação, Horários de decolagem; Demanda: Duração |
| `aluno-ocupado` | "o aluno já tem outra missão nos horários possíveis" | js/engine.js:757, 948 | Demanda |
| `sala-ocupada` | "a sala de Ground já está ocupada por outra turma nos horários possíveis" | js/engine.js:758 | Demanda |
| `instrutores-indisponiveis` | "nenhum instrutor habilitado (…) está disponível durante o voo inteiro nos horários possíveis" (Ground: "durante as 01h30") | js/engine.js:759, 955 | Instrutores › Disponibilidade do dia |
| `instrutores-ocupados` | "os instrutores habilitados (…) já têm outro compromisso nos horários possíveis" | js/engine.js:760, 956 | Demanda: Prioridade, preferências |
| `bloqueio` | "os instrutores habilitados (…) e livres estão em “Não escalar com” deste aluno" | js/engine.js:761, 957 | Alunos: "Não escalar com" |
| `limite-da-lei` | "nenhum instrutor dentro dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis" (it does not say which limit) | js/engine.js:762, 958 | Instrutores |
| `equipamento-da-missao` | "a missão “<mis>” só voa em <tipos> (o pedido está no <eq>)" | js/engine.js:786-793 | Demanda: Recurso |
| `ground-pendente` | "o “<Ground>” de hoje, que vem antes deste voo, não entrou na escala" | js/engine.js:799-806 | the Ground's own rejection |
| `so-parafuso` | "o <REG> (só para Parafuso no C152) está em manutenção" / "não há na frota um C152 marcado como “Só Parafuso” (aba Recursos)" | js/engine.js:929-932 | Recursos |
| `sem-aviao` | "nenhum <eq> homologado IFR disponível (…)" / "nenhum <eq> disponível (todos em manutenção)" | js/engine.js:933-936 | Recursos: `[data-a="av"]` |
| `depois-do-ground` | "nenhum horário aberto depois do Ground (HH:MM) comporta <horas> até as HH:MM" | js/engine.js:943 | Demanda |
| `avioes-ocupados` | "nenhum <eq> livre nos horários possíveis (ocupados por pedidos de prioridade maior)" and two variants | js/engine.js:949-953 | Demanda: Prioridade, preferências |
| `revisao` | "os <eq> livres estão sem saldo até a revisão de 50 horas" | js/engine.js:954 | Recursos: "Revisão feita" |
| `limite-de-locais` | "já há 6 voos locais (Voo Local, Voo Solo e TGL) em todos os horários possíveis, o máximo no mesmo horário" | js/engine.js:959 | Demanda: preferências |
| `peso` | "peso aluno + instrutor acima do limite de <lim> kg do <eq>, mesmo com o mínimo de combustível" | js/engine.js:960 | Alunos, Instrutores: weight |
| `habilitacao-do-aviao` | "os <eq> livres exigem a habilitação própria deles, e nenhum instrutor livre a tem (marque em Instrutores › Cadastro)" | js/engine.js:961 | Instrutores › Cadastro |

The same string is a different thing by type: `revisao` is a conflict, a rejection and a warning; `limite-de-locais` is a rejection and a warning; `peso`, `bloqueio`, `limite-da-lei`, `so-parafuso`, `aluno-ocupado` and `sala-ocupada` are conflicts and rejections (js/conflitos.js:5-25, 69, 72-77).

**C. Warnings** (`t: 'warn'`), none of which blocks anything.

| Code | Text | Computed at | Fields | Time? | Resolved where |
|---|---|---|---|---|---|
| `sem-peso` | "Peso do aluno não informado (0 kg): verificação de limite (<lim> kg) no <eq> não realizada." (or "Peso de <INVA> …", "Pesos do aluno e de <INVA> …") | js/engine.js:921-925 (flights the engine placed); :473-476 (booked flights) | `stuId` and/or `insId`; `fKey` only on a booked flight | not on the alert; the row has it (`limKg && !kg`, js/views/escala.js:323-325) | Alunos `[data-k="s"] [data-f="kg"]`; Instrutores › Cadastro `[data-f="kg"]`; the booking dialog `#agd-kg-aluno`, `#agd-kg-instrutor` |
| `perto-do-limite` | "Limite da lei: com esta escala, <X> h de voo no mês (limite de <L> h)." (also "semestre", "ano"), at 90 % | js/engine.js:139-158 | `insId`; `s` = the INVA | no (a day total) | nowhere directly: Instrutores shows the month's hours (`td.mes.perto`, js/views/cadastros.js:96-102) |
| `revisao` | "Aeronave parou para revisão de 50 horas às HH:MM (<h> desde a última revisão)." / "…: sem saldo para voar hoje (…)." | js/engine.js:1018-1028 | `s` = the registration | yes: `RES.revisao[reg].paraAs` | Recursos › Disponibilidade do dia: "Revisão feita" `[data-act="revisao"]`, hours `[data-a="horas"]` |
| `atraso` | "Atraso: a nova decolagem às HH:MM (pouso às HH:MM) se sobrepõe ao voo das HH:MM de <aluno>: mesmo recurso (<REG>) e mesmo instrutor (<nome>)." | js/status.js:114-151; js/engine.js:1049 | `s` only; `conflitosDeAtraso` has `{ fKey, com, motivos }`, but the alert drops them | derivable: `S.fObs[fKey].novoInicio` | Escala: the delayed flight's detail `[data-act="detalhe-status"]` or either flight's status; **no Sugestões** |
| `voa-com` | "Sem o instrutor de “Priorizar com” (<nomes>: <motivo>): o voo ficou com <INVA>." | js/engine.js:982-987; reasons js/engine.js:241-253 | `stuId`, `insId` | not on the alert | Demanda: Instrutor; Alunos: "Priorizar com"; Instrutores: availability |
| `escolhido-saiu` | "O instrutor escolhido saiu do cadastro: o voo ficou com <INVA>. Escolha outro na Demanda ou deixe no Automático." | js/engine.js:990-995 | `stuId`, `insId` | not on the alert | Demanda: Instrutor `[data-f="insId"]` |
| `repouso-do-noturno` | "Limite da lei: <9h00> de repouso entre o noturno de ontem (até <21:30>) e o translado de volta (<07:30>), menos que as <12h00> da lei." (the numbers are the ones the default limits give, docs/PLAN.md:404) | js/engine.js:999-1008; js/noturno.js:64-65 | `insId` | yes, in the text: the return leg's take-off | nowhere: a decision to warn, not exempt (js/noturno.js:5-9) |
| `fora-dos-horarios` | "Agendado às HH:MM, fora dos horários de decolagem do <eq>." / "… fora dos horários das aulas de Ground." / "Agendado às HH:MM: o <mis> sai às HH:MM." | js/engine.js:454-459 | `fKey`, `stuId` | yes (row) | Escala: move it with "+ Agendar voo", or "↶ Desfazer" in the History |
| `depois-das-17h30` | "Agendado até as HH:MM: o voo de dia pousa até as 17:30." / "…: com o Noturno no dia, o aluno termina as outras missões até as HH:MM." | js/engine.js:462-466 | `fKey`, `stuId` | yes | same |
| `limite-de-locais` | "Agendado às HH:MM como o Nº voo local do horário: no máximo 6 voos locais saem no mesmo horário." | js/engine.js:468-471 | `fKey`, `stuId` | yes | same |
| `antes-do-ground` | "Agendado às HH:MM, antes do fim do <Ground> do aluno (HH:MM): o Ground vem antes do voo." / the Ground-side text | js/engine.js:540-553 | `fKey`, `stuId` | yes | same |

The four booked-flight codes exist only on flights with the `agendado` pin that are not in progress (js/engine.js:450); the row shows one "fora da regra" tag (js/views/escala.js:492-495). A warning with no code (a schedule saved before the codes) is counted as "outros" (js/views/escala.js:437).

The amber box's summary already groups the warnings into ten phrases, which are the labels in use today (js/views/escala.js:438-450): "N alunos sem peso", "N instrutores sem peso", "N aviões param para a revisão de 50 horas", "N atrasos com conflito", "N instrutores perto do limite da lei", "N voos sem o instrutor de Priorizar com", "N voos com o instrutor escolhido fora do cadastro", "N instrutores sem o repouso da lei antes da volta do noturno", "N agendamentos fora da regra", "N outros"; the whole reads "N avisos: … · …". It counts people for the weights and the limits (distinct `stuId` or `insId`) and flights for the booked ones (distinct `fKey`), so its parts do not add up to N.

**D. Approving hides three kinds of warning (measured).** `sem-peso`, `voa-com` and `escolhido-saiu` are emitted only for flights the engine places itself; a pinned flight gets `sem-peso` only when it is a booked one (js/engine.js:450, 473; docs/PLAN.md:421), never `voa-com` (js/engine.js:592, 982-987) and never `escolhido-saiu` (js/engine.js:992). Run: a student with no weight and an unavailable "Priorizar com" gives 2 warnings; after `fixosAoAprovar` the same day gives 0 alerts, and the row still has no weight. So `#selo-esc` goes to zero on approval while the "sem peso" tag stays.

**E. The named rules, by where they surface.**

| Rule | Hard (the engine refuses) | Conflict on a pin | Warning | Elsewhere |
|---|---|---|---|---|
| Legal limits | rejection `limite-da-lei`; the instructor is skipped (js/viabilidade.js:60) | `limite-da-lei` with the limit named | `perto-do-limite` (90 % of month, semester, year), `repouso-do-noturno` | "Aprovar escala" off and the banner without the hours (js/actions.js:71); the booking dialog's `lei-nao-conferida` (js/agendamento.js:1192-1194) |
| Missing weights | never refuses: without a weight the limit is not checked (js/combustivel.js:14) | no | `sem-peso` (not on approval pins) | row tag "sem peso"; CSV note (js/csv.js:25-26) |
| Students left out | the rejection itself | no | no | "N missões pedidas / N escaladas" (js/views/escala.js:462-463); BI `rej` (js/actions.js:358) |
| Delay invading another flight | no | no: "é um aviso de atraso, não um conflito dele" (js/engine.js:478-480) | `atraso` | the engine places new flights around the new time (js/engine.js:416, 491-492) |
| Fuel and weight | rejection `peso` when even the minimum fuel does not fit | `peso` | **none** | the flight carries `comb`; row tag "reduzir N gal" with the tip (js/views/escala.js:331); map popup "Combustível:" (:54); CSV note (js/csv.js:27-30); PDF "abastecer N gal" (js/export.js:66). **Not in `al`, not in any badge.** Weight within 10 kg of the limit is only bold amber (`PERTO_DO_LIMITE_KG`, js/views/escala.js:303, 326) |
| Take-off times | the engine only tries the category's list, in open windows and inside the availability (js/engine.js:811); with none: `sem-horario`, `disponibilidade-do-aluno`, `depois-do-ground` | `horario-fechado` only; a pin outside the category's list is not a conflict | `fora-dos-horarios`, booked flights only | Demanda marks a preference "(fora da lista)" (js/views/demanda.js:29) |
| 6 local flights per time | skipped, then rejection `limite-de-locais` | no | `limite-de-locais`, booked flights only | the Agenda refuses the 7th pedido (PT422, 20261114230012:31-39; js/eventos/agenda.js:88-89) |
| 50 h inspection | rejection `revisao` | `revisao` | `revisao` (the aircraft stops) | `#selo-rec`, also under 5 h; Recursos "Parou para revisão de 50 horas às HH:MM" (js/views/recursos.js:39-41) |

**F. Other conditions the app shows for a date, outside `RES.al`.**

| Condition | Where computed | Blocks? | Time? | Resolved where |
|---|---|---|---|---|
| Data not read: 'horas', 'resultados', 'cursos', 'cursos-pendentes' | `S.indisponiveis` (js/storage.js:210-211); texts `SEM_OS_DADOS` (js/actions.js:70-74) | 'horas' turns "Aprovar escala" off; the others turn off the next mission, the progress and the result select (js/views/etapas.js:26-29, 184) | no | "Tentar de novo" `#btn-tentar-dados` |
| Change being saved, or not saved | History entry `estado: 'gravando'` / `'nao-gravada'` (js/actions.js:224-236; js/views/escala.js:292-293) | no | the entry's time | automatic retry |
| No connection: N changes waiting | `avisarAlteracoesEsperando` (js/actions.js:124-135) | no; closing the page asks (js/main.js:58-62) | no | automatic |
| Save conflict, or the app was updated | `travarAposConflito` (js/actions.js:138-145) | the screen turns read-only until a reload | no | "Recarregar" |
| The date has not opened | `aindaNaoAbriu` (js/actions.js:154-158) | every change is refused with a toast | no | wait or reload |
| Pedidos not yet in the Demanda | js/views/selos.js:47-49; js/views/agenda.js:139-149 ("Ainda não importado", "Na demanda") | no | the pedido's `horario` | "Importar da agenda" |
| Deadline of a date for pedidos | `prazoDaData`, `prazoDaAgendaPermite` (js/agenda.js:32-43); text `prazoDoDia` (js/views/agenda.js:105-116) | registration is refused (PT403) unless the "Exceção da Coordenação" is used by whoever operates the schedule | the deadline is 13:00, or 10:00 on a Saturday for a Monday (js/agenda.js:35), on another day | `#ag-excecao` |
| Pedido registered by exception | `excecao` on the row; tag "Exceção da coordenação" (js/views/agenda.js:162) | no | `horario` | none |
| Booking dialog checks | `avaliarAgendamento` → `bloqueios`, `avisos`, `notas` (js/agendamento.js:1077-1244) | a bloqueio blocks the booking; an aviso asks for "Agendar mesmo assim" (js/views/agendamento.js:304-305) | the flight's | in the dialog; only "· confirmado: …" survives, in the History text (js/agendamento.js:1263-1264) |
| Mission out of the course order, or a closed course | `motivoDoBloqueio` (js/progresso.js:114-139); `confirmacaoDaMissao` (js/views/etapas.js:98-102) | asks for a second click; not kept anywhere but the History text | no | Demanda |
| Sunday | `ehDomingo` (js/agenda.js:28) | the date does not open: the Monday opens, with a toast (js/eventos/topo.js:24, 35-39) | no | none |

### 5.3 Can the app compute each proposed sub-task today?

**Pedidos**

| Sub-task | Today | From | Missing or wrong |
|---|---|---|---|
| registrados | **Yes**, a count | rows of `solicitacoes` for the date (`ApiClient.agenda(data, data)`, js/views/selos.js:41); the calendar counts the non-cancelled ones (js/views/agenda.js:120, 131) | A failed read is indistinguishable from zero (js/views/selos.js:41). Decide whether cancelled ones count |
| fora do prazo ou com exceção | **Half** | `excecao` on the row; the server sets it to `not no_prazo` (20261114230012:50-56) | A pedido past the deadline without the exception is refused and not stored (PT403). The date's own state (open until when, or closed) is computable: `prazoDaData(data)`, `prazoDaAgendaPermite(data)` (js/agenda.js:32-43) |
| aguardando aprovação | **No such state** | nearest: not cancelled and not in `S.importadas` ("Ainda não importado") | No approval column, RPC, who or when (table columns in section 2) |
| aprovados | **No such state** | nearest: the id is in `S.importadas` ("Na demanda") | `S.importadas` means "seen by an import", not "in the Demanda" (below) |

(measured, js/agenda.js and js/fixos.js with fictitious rows) Three ways `S.importadas` differs from what is in the Demanda:
1. A pedido cancelled after the import stays in the Demanda: the request keeps `fly: true` and `solicitacao: <id>`; no code removes it (every reader of `.solicitacao`: js/rules.js:88, 164; js/agenda.js:90, 128; js/agendamento.js:143; js/engine.js:328; js/dias.js:22).
2. After "Limpar demanda" the list still holds the ids (`limparDemanda` does not touch it, js/fixos.js:95-117), so nothing is pending and a new import brings nothing back (`novos: 0`) while the Demanda is empty.
3. A pedido of a student who is not in the cadastro is never marked (js/agenda.js:113-115) and stays pending forever.

**Processamento**

| Sub-task | Today | From | Missing or wrong |
|---|---|---|---|
| missão definida pelo programa | **Yes per request**, when the results and programs were read | `etapa` and `cursoDaEtapa` on the request (js/dias.js:22); for one without them, `proximaDoPedido(stu, mid)` gives the next mission (js/views/etapas.js:36-45; `proximasMissoes`, js/progresso.js:87-95). Value "N de M pedidos com a missão do curso" | Needs `programaParaInferir()` not empty: with 'resultados', 'cursos' or 'cursos-pendentes' in `S.indisponiveis` nothing is inferred (js/views/etapas.js:26-29). A stored `etapa` is never re-checked after later results; `estadoDoAluno(...).porMissao` could do it (js/progresso.js:18-21). The logic lives in a view module that reads the global `S` |
| preferências aplicadas | **Only as an outcome of the engine** | "Priorizar com": row mark `insPar` (js/engine.js:588, 985) or the warning `voa-com` with the reason. "Não escalar com" is a hard rule (js/viabilidade.js:59), seen only as the rejection or conflict `bloqueio`. Times: `baseTag` per row; `metricasDaEscala().preferencias` gives `{ p1, p2, outro }` (js/metricas.js:47-48, 60) | Not a step with a state. After approval `insPar` and `voa-com` are gone (5.2 D); it must then be recomputed from `stu.voaCom.includes(o.insId)` |
| recursos disponíveis | **Yes** | `S.av`, `S.frota`: "N de M disponíveis" is already drawn per category (js/views/recursos.js:86-87); balance from `S.horas`; `RES.revisao` | The hours and availability are per date, copied forward (js/dias.js:120-137) |
| INVAs disponíveis | **Yes** | `S.ins[].on`, `.aw` (per date); `S.horasDosInstrutores` for the law | Without 'horas' the month and year limits are not checked (js/actions.js:71) |
| pedidos que não cabem | **Yes, but only after the engine has run** | `RES.al.filter(a => a.t === 'err')`, or the flying requests whose `chaveDoVoo(stuId, mid)` is not in `RES.out` (the invariant test pins that the two counts agree) | The rejection has no id of its request; it is an output of the Escala stage, not of Processamento |

**Escala**

| Sub-task | Today | From | Missing or wrong |
|---|---|---|---|
| restrições do operador | **Yes** | `S.fixos` with the marks `escolhido` and `agendado`; the reason per flight from `motivoDoFixo` (js/fixos.js:179-186); requests with `insId`; statuses that pin (`STATUS_QUE_FIXAM`, js/fixos.js:40) | Pins in conflict and booked flights "fora da regra" are the states to show |
| motor | **A result, no state** | `RES` exists once a date is open (js/actions.js:309); `tot`, `out.length`, the rejections | It is synchronous and pure: (measured) median 1.8 ms, maximum 7.6 ms over the 40 golden scenarios (up to 47 requests), 2.6 ms on the example day. It cannot fail short of an exception. "Atualizada às HH:MM" is DOM-only and session-only |
| compactação | **Settings yes, state no** | `S.criterios`; the metrics in `#tempo-parado` | `compactar()` returns the number of moves (js/compactar.js:300), but the engine uses it only as a truth test (js/engine.js:973) and returns `{ out, al, tot, revisao }` (js/engine.js:1050). The compacted schedule is kept only if it costs less (js/engine.js:976). The only trace is `baseTag: 'Horário ajustado'` on a flight whose time changed to neither preference (js/compactar.js:293-299); an instructor swap leaves none. (measured) It changed the schedule in 28 of the 40 scenarios. With an approved schedule every flight is pinned and it changes nothing (js/compactar.js:90) |
| conflitos e avisos | **Yes** | counts of `RES.al` by `t` | 5.2 D: the warning count drops on approval |

**Aprovar**

| Sub-task | Today | From | Missing or wrong |
|---|---|---|---|
| conflitos pendentes | **Yes** | `RES.al.filter(a => a.t === 'conf')` or `RES.out.filter(o => o.conflito)` | They do not block approval. Before approval a conflict can only be on a flight pinned by status, chosen instructor or booking ("N voos fixos em conflito", js/views/escala.js:474) |
| aprovada por quem e quando | **Stored, only while approved** | `S.aprovacao = { em: new Date().toISOString(), por: ApiClient.autorAtual || '' }` (js/eventos/escala.js:205), in the day document | `em` is the browser's clock; `por` is the account's name or e-mail (js/sessao.js:167), written by the client, and `''` in local mode (js/storage.js:38), so the badge reads "Aprovada às 12:00" (test/e2e/aprovacao.spec.js:17). The server does not check either; it only stamps `dias.atualizado_por` and `atualizado_em`, which the app never reads. "Reabrir" and "Limpar demanda" set it to `null` (js/eventos/escala.js:214; js/fixos.js:115). After that only the History has it: "Escala aprovada: N voos fixados" with `autor` and `registrado_em`; in local mode `autor` is `null` and the History can be cleared (js/backends/local.js:129, 141-144). The badge shows the time without the date (js/views/escala.js:380-383) |
| exportada | **No. Nothing records an export.** | none | `exp()`, `pdf()` and `planilha()` build the file, download it and show a toast (js/export.js:34, 100, 153-154). No state field, no History entry, no server call. The only side effect is `gravarEscalaCalculada()` (js/eventos/escala.js:90-92), which saves a schedule that was only calculated. The PDF prints "Emitida em:" inside the file (js/export.js:53). The Gestor and the Secretaria can export and cannot write |

**The four explicit questions.**
- *Approved by whom and when:* yes, `S.aprovacao`, per date, client-written, lost on reopening; the History keeps the event.
- *An export recorded anywhere:* no.
- *Compaction done or not done:* no state. It is part of every engine run unless called with `{ compactar: false }` (js/engine.js:255-258, 971), an option only tests and scripts use. What exists is its settings and its effect on the metrics.
- *"Running" for the engine:* nothing observable. The whole chain `save()` → `refazerEscala()` → `runAllocationEngine(S)` → redraw runs inside one event handler (js/actions.js:166-182, 370-380), so the page cannot paint between start and end. The states that do take time are: the date being read (`dadosLidos === false`, js/actions.js:151, 288-317), a save on its way (`estado: 'gravando'`, `ApiClient.temGravacoesPendentes()`, js/storage.js:245-247), a save waiting for the connection, and the booking dialog's check, which waits 150 ms and shows "calculando…" (js/views/agendamento.js:21, 136, 169), the only "running" text in the app.

### 5.4 The pedido counts per day

- **How the Agenda calendar gets them.** No RPC. `carregarMes()` calls `ApiClient.agenda(inicio, fim)` for the whole weeks (Sunday to Saturday) that cover the visible month, 28 to 42 days (`gradeDoMes`, js/views/agenda.js:48-54, 65-74). In shared mode that is one request: `from('solicitacoes').select('*').gte('data', de).lte('data', ate).order('data').order('registrado_em')` (js/backends/supabase.js:211-215), every column of every row, cancelled ones included. The count is made in the browser: non-cancelled rows per day (js/views/agenda.js:120, 131), drawn as `span.qtd` and said in the cell's `aria-label` ("…: N pedido(s)", js/views/agenda.js:133).
- **When it is fetched.** On every click on the Agenda tab (`abrirAgenda`, js/eventos/navegacao.js:25), on "‹" and "›" (`mudarMes`), when a chosen day is in another month (`escolherDia`, js/views/agenda.js:84-91) and after this browser registers or cancels (js/eventos/agenda.js:119, 152). A date change redraws the Agenda from the cached rows without a fetch (`rAgenda()`, js/actions.js:324).
- **Every reader of the table in the app:** js/views/agenda.js:68 (month grid), js/views/selos.js:41 (open date) and js/eventos/agenda.js:36 (open date, at import). Three callers, two caches that can disagree (`pedidos` and `pedidosDaData`).
- **Row cap.** `max_rows = 1000` (supabase/config.toml:19); the fake server follows it (test/e2e/supabase-falso.js:95-99). The grid query is not paged, and its order is by date, so a month with more than 1,000 rows would lose the **last** days' counts without an error. 42 days at 24 pedidos a day reaches the cap (the golden scenarios have up to 47 requests in one day).
- **Who may read.** Policy "perfis da escala leem": `le_a_escala()` is true for 'operador', 'gestor' and 'secretaria', and the Administrador counts as operador (supabase/migrations/20261113140000_leitura_por_perfil.sql:7-15, 34-37; 20261111122858_contas_e_administracao.sql:5-14). An account with no profile and the Painel profile read nothing (leitura.test.sql; painel.test.sql:82).
- **Cost of a rail on every screen.**
  - *Per date change today, shared mode:* 10 requests (inferred from the calls): `documentos` (cadastro), `dias` (the date), `dias` (the previous day), rpc `horas_dos_instrutores`, rpc `situacao_das_missoes`, `resultados_de_missao`, rpc `programa_dos_cursos` (js/storage.js:182-227), `historico` (js/actions.js:299), `solicitacoes` for the date (js/actions.js:326) and `dias` for the month's BI (js/actions.js:327, 333-348). A rail calendar click is a date change, as an Agenda day click is today (js/eventos/agenda.js:24-26); reads are queued one at a time and a superseded one is skipped (js/actions.js:280-317).
  - *Month counts on the rail:* one more request per visible month. It can replace the per-date request while the open date is inside the loaded grid, so the net cost can be zero per date change; then the counts and the pending list are only as fresh as the last month fetch. Today's freshness is "at each date change and after my own action"; there is no polling.
  - *Payload:* `select('*')` brings names, `observacao` (up to 300 characters), `registrado_por`, `conta`. A count needs `data` and `cancelada_em`; the open date needs the full rows.
  - *Local mode:* no network; `listarSolicitacoes` parses the whole `acpm4_agenda` list and filters it on each call (js/backends/local.js:154-158).
  - *Gestor:* may read; today he browses the Agenda calendar and sees the counts there, while `#selo-age` is forced to 0 for him. `lerPedidosDaData` has no profile check, so the per-date request is already made for the Gestor and the Secretaria and its result is thrown away (js/views/selos.js:38-54). Showing them the count costs no new request and no new permission.
  - *Secretaria:* the same; she is read-only for the schedule, so `isGestor()` is true for her (js/sessao.js:171; js/state.js:25).
  - *Painel profile:* never reaches index.html. `iniciarSessaoSupabase` sends it to painel.html before the app opens (js/sessao.js:139-146); it cannot read the table; painel.html always shows today. A rail costs it nothing and is never seen by it.

### 5.5 Proposed notification items and row states (SUGGESTION)

Everything in this subsection is a suggestion. Cost and risk are in section 7.

**Items for the rail's list.** "Time" is the flight's time of day in minutes unless noted. Items with no time would go to a group above the timed ones (the calendar reference's all-day place). Severity follows today's type where there is one (`err` and `conf` red, `warn` amber), except items 3 and 7, which are warnings today and are raised to red here; "neutral" is information the app shows today without any alert.

| # | Item | Source (all exist today) | Severity | Time | Title | Second line | Click target |
|---|---|---|---|---|---|---|---|
| 1 | Conflict of a pinned flight | `RES.al` `t: 'conf'` + the row by `fKey` | red | row `a` | "Conflito: <aluno>" | `o.conflito.join('; ')` | Escala, that flight, Sugestões open (`data-reparo`) |
| 2 | Request left out | `RES.al` `t: 'err'`; exact request = flying request whose key is not in `RES.out` | red | none; optionally the request's `p1` | "<aluno> não entrou na escala" | the short reason by code (the texts of `FORA_DA_ESCALA`, js/agendamento.js:223-232) | by code: the request in Processamento, or the resource, INVA or student record (5.2 B) |
| 3 | Delay over another flight | `conflitosDeAtraso(RES.out, S.fStatus, S.fObs)` (js/status.js:114) | red | the new take-off | "Atraso: <aluno>" | "sobrepõe o voo das HH:MM de <aluno> (mesmo recurso…)" | Escala, the delayed flight's status |
| 4 | Booked flight outside a rule | `RES.al` with `CODIGOS_DO_AGENDADO` | amber | row `a` | "Fora da regra: <aluno>" | `a.m` | Escala, that flight |
| 5 | No weight | rows with `limKg && !kg` (covers approved days too); one item per person | amber | the person's first such flight | "<nome> sem peso" | "N voos sem a conferência do limite de peso" | Alunos or INVAs, the weight field |
| 6 | Reduced fuel | rows with `comb` | neutral | row `a` | "Reduzir N gal: <aluno>" | `textoDoCombustivel(o.comb)` | Escala, that flight |
| 7 | Aircraft stops for the inspection | `RES.revisao[reg].paraAs !== null` | red | `paraAs` | "<REG> para para a revisão de 50 horas" | hours since the inspection | Recursos, that resource |
| 8 | Aircraft near the inspection | `REVISAO_H - fim < 5` and available (the badge's rule) | amber | none | "<REG> perto da revisão de 50 horas" | hours available at the end of the day | Recursos, that resource |
| 9 | INVA near a law limit | `RES.al` `perto-do-limite` | amber | none | "<INVA> perto do limite da lei" | `a.m` | INVAs, that INVA |
| 10 | Rest before the Noturno return | `RES.al` `repouso-do-noturno` | amber | the return leg's `a` (07:30) | "<INVA>: repouso abaixo da lei" | `a.m` | Escala, the return flight |
| 11 | Without the "Priorizar com" INVA | `RES.al` `voa-com`, or recomputed from `stu.voaCom` and the row | neutral | row `a` | "<aluno> sem o INVA de Priorizar com" | the reason | Escala, that flight's instructor |
| 12 | Chosen instructor left the cadastro | `RES.al` `escolhido-saiu` | amber | row `a` | "<aluno>: instrutor escolhido saiu do cadastro" | "o voo ficou com <INVA>" | the request, Instrutor |
| 13 | Pedido waiting (today: not imported; after the redesign: waiting for approval) | rows of the date, not cancelled, not yet taken | amber | the pedido's `horario` | "<aluno_nome>: pedido aguardando" | "<missao> · <horas> h · registrado por <registrado_por>" | Pedidos, that pedido |
| 14 | Pedido by exception | `excecao === true` | neutral | `horario` | "<aluno_nome>: exceção da coordenação" | "<missao> · registrado por <registrado_por>" | Pedidos, that pedido |
| 15 | Pedido cancelled but still in the Demanda | a request with `solicitacao` = the id of a row with `cancelada_em` | amber | `horario` | "<aluno_nome>: pedido cancelado, voo ainda na escala" | "cancelado por <cancelada_por>" | the request |
| 16 | Pedido of someone not in the cadastro | no `S.stu` entry with `id === aluno` | amber | `horario` | "<aluno_nome> não está no cadastro" | "o pedido não entra na demanda" | Alunos, new student |
| 17 | Data not read | `S.indisponiveis` | red for 'horas', amber for the others | none | "Horas dos instrutores não lidas" and the like | the text of `SEM_OS_DADOS` | "Tentar de novo" |
| 18 | Deadline for pedidos | `prazoDaData(DATA)`, `prazoDaAgendaPermite(DATA)` | neutral | none | "Pedidos até <dia> às 13:00" / "Prazo encerrado" | none | Pedidos |

Left out on purpose: History entries (they have a time, but they are a log and already have a drawer); the save states (they belong to a fixed status line of the app, not to a date); every flight's status (the Painel and the list already show them).

**Row states mapped to real conditions.** "pending" = nothing to judge yet; "attention" = amber; "failed" = red; "running" = a network wait.

| Card, row | done | failed | pending | running | needs attention | Value |
|---|---|---|---|---|---|---|
| Pedidos · registrados | at least one non-cancelled row | the read failed (needs the error kept, 5.1) | zero rows | the month or date fetch is on its way | none | the count |
| Pedidos · fora do prazo ou com exceção | no `excecao` rows | none | none | none | some `excecao` rows | the count; or the date's deadline |
| Pedidos · aguardando aprovação | none waiting | none | no pedidos | none | some waiting | the count |
| Pedidos · aprovados | all non-cancelled taken | none | no pedidos | none | none | "N de M" |
| Processamento · missão definida pelo programa | every flying request has `etapa` or its student has no program | none | no requests | none | a request without `etapa` where a next mission exists; or 'resultados', 'cursos', 'cursos-pendentes' not read | "N de M" |
| Processamento · preferências aplicadas | no `voa-com` and no `bloqueio` | a `bloqueio` rejection or conflict | no flights | none | some `voa-com` | "N sem o INVA preferido", or p1/p2/outro |
| Processamento · recursos disponíveis | no stopped or near aircraft | a rejection `sem-aviao`, `so-parafuso` or `revisao` | none | none | the `#selo-rec` count above zero | "N de M" |
| Processamento · INVAs disponíveis | some come, hours read | no INVA with `on`; a rejection `sem-instrutor-habilitado` | no INVAs registered | none | 'horas' not read; `perto-do-limite` | "N de M" |
| Processamento · pedidos que não cabem | `tot > 0` and no rejection | rejections above zero | `tot === 0` | none | none | the count |
| Escala · restrições do operador | pins without conflict | a pin in conflict | no pins | none | a booked flight "fora da regra" | the number of pins |
| Escala · motor | `RES` computed and saved | the last save was refused ('nao-gravada', notice 'erro' or 'conflito') | `tot === 0` | the date is loading, or a save is on its way | computed, not saved yet (`escalaSoCalculada`) | "N de M escaladas" |
| Escala · compactação | always, once there are flights | none | no flights | none | none; "travada" when approved | the two criteria labels |
| Escala · conflitos e avisos | no `conf` and no `warn` | `conf` above zero | no flights | none | `warn` above zero, or rows without weight | "N conflitos · M avisos" |
| Aprovar · conflitos pendentes | zero | above zero | no flights | none | none | the count |
| Aprovar · aprovada por quem e quando | `S.aprovacao` set | none | not approved | the approval's save is on its way | "Aprovar escala" off because 'horas' was not read | "HH:MM · <por>" |
| Aprovar · exportada | **no data today** | none | none | the Excel being built (`montando`, js/export.js:118-128) | none | none |

## 6. Conflicts with the request

| # | The request assumes | The code | Evidence |
|---|---|---|---|
| 1 | Three badges are sources of notifications | Four badge elements (`#selo-rec-dia` repeats `#selo-rec`) plus `#log-cnt`. They are counts derived from `RES.al`, `RES.revisao` and the date's pedidos, not sources of their own | js/views/selos.js:20-33; index.html:73, 92-96, 153 |
| 2 | "the conflicts (`js/conflitos.js`)" | That module holds code tables and texts only. Conflicts are computed by the engine and live in `RES.al` and on the rows | js/conflitos.js:1-77; js/engine.js:420-449, 531-533 |
| 3 | The date's notifications read "a time at the left" | Rejections have no time, no flight key and no student id. Of the 11 warning codes only the four booked-flight ones always carry `fKey`; `sem-peso`, `voa-com`, `escolhido-saiu`, `perto-do-limite`, `repouso-do-noturno`, `revisao` and `atraso` do not. `perto-do-limite` has no time at all | js/engine.js:153, 452, 475, 581, 765, 924, 964, 986, 994, 1005, 1023; js/status.js:144-149 |
| 4 | `selo-esc` stands for the Escala's problems | It shows only the rejections when there is one; otherwise warnings and conflicts added together, in amber, under a tooltip that says "avisos" | js/views/selos.js:21-24 |
| 5 | The engine's warnings are a stable list for a date | Approving removes `sem-peso` (except on booked flights), `voa-com` and `escolhido-saiu` (measured), while the rows still lack the weight | js/engine.js:450, 473, 592, 982-995; docs/PLAN.md:421 |
| 6 | The fuel and weight rule is a warning | A flight leaving with less fuel raises no alert: only a row tag, a popup line and export notes | js/combustivel.js:29-32; js/views/escala.js:331; js/csv.js:27-30 |
| 7 | "Aprovar: unresolved conflicts, approve or reopen, then the exports" | Conflicts do not block approval, and most can only exist after it (a conflict needs a pin). Exports work at any time, for the Gestor too | js/eventos/escala.js:197-209; js/engine.js:399-534; js/eventos/escala.js:90-92 |
| 8 | "aprovada por quem e quando" is a state the app has | Only while approved: `{ em, por }` in the day, written by the client, `por` empty in local mode, erased by "Reabrir" and "Limpar demanda". The badge shows a time without a date | js/eventos/escala.js:205, 214; js/fixos.js:115; js/views/escala.js:380-383 |
| 9 | "exportada" | No export is recorded anywhere | js/export.js:32-35, 100, 150-154; js/eventos/escala.js:90-92 |
| 10 | "motor" and "compactação" are sub-tasks with states (done, running, failed) | One synchronous pure call of 0.3 to 7.6 ms (measured). The compaction is inside it, returns its move count to nobody and has no done or not-done state | js/engine.js:968-979, 1050; js/compactar.js:300 |
| 11 | "pedidos que não cabem" is a Processamento sub-task, before "Escala · motor" | Which requests do not fit is the engine's output; it does not exist before the engine runs, and it depends on the other requests | js/engine.js:556-966 |
| 12 | "preferências aplicadas" is a Processamento step | Nothing outside the engine applies "Priorizar com" or "Não escalar com"; only outcomes can be read (`insPar`, `voa-com`, `bloqueio`) | js/engine.js:586-589; js/viabilidade.js:59 |
| 13 | "aguardando aprovação · aprovados" map onto today's data | There is no approval state. The nearest, `S.importadas`, is not "in the Demanda": it survives "Limpar demanda", ignores a later cancellation and never includes a student missing from the cadastro (measured) | supabase/migrations/20261110222506_agenda_de_solicitacoes.sql:6-24; js/agenda.js:112-116; js/fixos.js:95-117 |
| 14 | "fora do prazo" pedidos can be counted | A pedido past the deadline without the exception is refused and not stored; only `excecao` exists | supabase/migrations/20261114230012_agenda_limite_de_locais.sql:41-48 |
| 15 | "Days could carry the pedido count the Agenda calendar shows today" | That count is made in the browser from one unpaged `select *` of up to 42 days, capped at 1,000 rows, fetched on a tab click, with no refresh from other computers. `#selo-age` is hidden from the Gestor and the Secretaria | js/views/agenda.js:65-74, 118-135; js/backends/supabase.js:212; supabase/config.toml:19; js/views/selos.js:53 |
| 16 | The rail's calendar replaces "the app's only date control" | Two date controls already behave differently for the local-mode Gestor: `#dt`, `#dt-ant` and `#dt-prox` are disabled (js/actions.js:54-58; js/eventos/topo.js:30-33), while a click on an Agenda day calls `carregarData` with no role check (js/eventos/agenda.js:17-26). The Agenda also keeps its own day and month, apart from `DATA` | js/views/agenda.js:17-19, 58-63 |
| 17 | The rail is on every screen for every profile | The Painel profile never loads index.html and cannot read pedidos; the Secretaria has no Histórico button and no Recursos tab | js/sessao.js:139-146; css/app.css:184-188; painel.test.sql:82 |
| 18 | The rejections tell "where to resolve" | The codes exist "para dizer onde resolver", but no screen maps a code to a place; the red box is text only | js/conflitos.js:71; js/views/escala.js:458, 466-469 |

## 7. Implications and options for the redesign (suggestions)

1. **Build the rail's list as one pure module over `S`, `RES` and the pedidos, with no engine change.** It joins each alert to its row for the time and adds what `al` lacks (rows without weight, `comb`, `conflitosDeAtraso`, the pedidos, `S.indisponiveis`). *Cost:* one module with unit tests, plus exporting two things that are private today (`FORA_DA_ESCALA`, js/agendamento.js:223; the pending-pedido filter, js/views/selos.js:47). *Risk:* a rejection can only be tied to its request by the label text, which is ambiguous for two students with the same name or two extras of the same mission; the alternative, "flying requests missing from `RES.out`", is exact for the request but then the reason text is paired by label or by order.
2. **Or give the alerts ids in the engine** (`fKey` and `stuId` on rejections; `fKey` on `sem-peso`, `voa-com`, `escolhido-saiu`; `fKey` and `com` on `atraso`). The saved-schedule check already accepts `fKey`, `stuId` and `insId` on any alert type (js/escala-gravada.js:89-93), so no data-format step is needed. *Cost:* every golden with a rejection or one of those warnings is re-recorded ((measured) the 41 golden outputs hold 174 rejections and 36 warnings, all `sem-peso`, and no conflict; 36 of the 41 files carry an alert, 32 a rejection); days saved before lack the fields, so option 1's fallback is still needed. *Risk:* it is a golden change with no rule change, against the guardrail unless Pedro accepts it as its own reviewed commit.
3. **Keep one refresh hook.** `atualizarSelosDaEscala()` is already called at the three moments the data change (js/main.js:138; js/actions.js:325, 379); the rail and the pipeline cards can be drawn from the same hook, plus `setRole` and the pedido fetch. *Cost:* small. *Risk:* the rail redraws on every edit; it must use `trocarConteudo` (focus keeping) and must not be an assertive live region.
4. **One cache of pedidos for the rail calendar, the Pedidos list, the count and the import.** Today three callers fetch the same rows into two caches. *Cost:* a refactor of js/views/agenda.js, js/views/selos.js and js/eventos/agenda.js; tests in agenda.spec.js and selos.spec.js move. *Risk:* staleness if the per-date fetch is dropped; the 1,000-row cap. An RPC returning `(data, count)` avoids both the payload and the cap. *Cost of the RPC:* a migration, pgTAP tests, the fake server, preview then production before the merge. *Risk:* low; it only adds.
5. **Count what approval hides.** If the cards or the rail count `al` warnings, the numbers drop when the schedule is approved. Counting from the rows (weight) and from `stu.voaCom` keeps them. *Cost:* part of option 1. *Risk:* two counts on screen during the transition (the amber box in the Escala against the rail) if the Escala's summary is not moved to the same source.
6. **"Exportada" needs data.** A per-date field such as `exportacoes: { csv: { em, por }, pdf: …, xlsx: … }` is a data-format step (format 26 or later) and a save. *Cost:* the step, its test, `separar`/`juntar`, `diaParaCopiar` (must start empty). *Risk:* the Gestor and the Secretaria export without being able to write, so their exports would not count; "exported, then changed" needs something to compare (the History length or a hash kept at export). A cheaper variant is a History entry ("CSV exportado"), which only operators can write and which is not a state.
7. **"Aprovada por quem e quando" after reopening.** Either keep the last approval in the day (`aprovacao` plus a `reaberta` mark, a data-format step) or read it from the History (no data change, but the local History has no author and can be cleared, and only 200 entries per date are read). *Risk of the first:* every reader of `.aprovacao` treats non-null as "approved" (24 lines in 8 modules: js/agendamento.js, js/dias.js, js/fixos.js, js/instrutor-escolhido.js, js/storage.js, js/views/escala.js, js/eventos/cadastros.js, js/eventos/escala.js; e.g. js/fixos.js:184; js/views/escala.js:378-404; js/eventos/escala.js:224), so a new field is safer than changing its meaning.
8. **Compaction's value.** To show what it saved, run the engine a second time with `{ compactar: false }` and compare `metricasDaEscala`. *Cost:* 1 to 8 ms more per change. *Risk:* low. Returning the move count from the engine instead changes all 41 goldens.
9. **Decide whether anything gates "Aprovar".** Today only the missing hours do. Making conflicts or rejections block it is a rule change for the operator (after approval the schedule lives on all day with conflicts being repaired). *Cost:* small code. *Risk:* blocks the operator at the worst moment; a count with a confirmation is the milder form.
10. **Give the counts a text.** The badges are a bare number with a mouse-only `title`. On the rail and the cards, a visible or `.sr` text ("3 avisos") and the existing `data-dica` tips cost little and remove an accessibility gap. *Risk:* the accessible-name loops (`percorrerVistasEFiltros`, acessibilidade.spec.js) need new expectations.
11. **Severity tokens exist for three levels only:** `--er`/`--er-bg`, `--wa`/`--wa-bg`, `--ok`/`--ok-bg` (css/app.css:12-19, 36-37), and the tab badge's red is a literal (`#C62828`, css/app.css:180). "Pending" and "running" icons need a neutral token choice; contrast is tested per theme (test/e2e/acessibilidade.spec.js:1052-1057).
12. **Tests that will move with the badges:** test/e2e/selos.spec.js (5 tests), agenda.spec.js:164, acessibilidade.spec.js:1052-1057, and the Manual sentence at index.html:456.

## 8. Open questions for Pedro

1. Should conflicts, or requests left out, block "Aprovar", ask for a confirmation, or only be shown as today?
2. Is "exportada" worth a new per-date field? If yes: does an export by the Gestor count, and does a change after the export clear it?
3. After "Reabrir", should the last approval (who and when) stay visible, or is the History entry enough?
4. On the rail, is the time at the left the flight's time? Where do items with no time go (requests left out, law limits, data not read)?
5. Should the warnings that approval hides today (no weight, "Priorizar com", chosen instructor gone) stay visible after approval?
6. Who sees the pedido counts and the "pedido waiting" items: also the Gestor and the Secretaria, from whom the Agenda badge is hidden today?
7. Is "fresh at each date change and after my own action" enough for pedidos, or must the operator see the Secretaria's new pedido without touching the app (polling or realtime would be new behaviour)?
8. With an approval state on pedidos, does approval replace "Importar da agenda", or are there three states (registrado, aprovado, na demanda)? What happens to a request when its pedido is cancelled afterwards, and to the approved pedidos after "Limpar demanda"?
9. Can "motor" and "compactação" drop the "running" state, keeping it for loading a date and for "gravando…"?
10. Should a flight that leaves with less fuel ("reduzir N gal") become a notification? It is in no list and no count today.
11. Keep the two thresholds as they are on the rail: under 5 h to the inspection (badge) and 90 % of the law limit (warning)?
12. In local mode, may the Gestor change the date from the rail? Today the header says no and the Agenda calendar says yes.

<!-- fim -->
