export const meta = {
  name: 'linha-descoberta',
  description: 'Read-only discovery of the AutoEscala code for the production-line redesign: fourteen area maps with file:line evidence, then a critic and gap-filling readers',
  phases: [
    { title: 'Mapear', detail: 'one reader per area writes a map with file:line evidence' },
    { title: 'Criticar', detail: 'a critic checks the maps against the request and lists what is still unknown' },
    { title: 'Completar', detail: 'one targeted reader per gap' },
  ],
}

const W = '/Users/pedrofernandes/ACPM/.redesenho/wt-plano'
const N = '/Users/pedrofernandes/ACPM/.redesenho/notas'

const REGRAS = `You are part of a read-only discovery of the AutoEscala code base (the ACPM flight school's daily scheduling app: vanilla ES modules, no build step, GitHub Pages, Supabase) before a large redesign. What you write is working material for the people who will write the redesign plan in docs/PLAN.md. They will not re-read the code you read, so precision matters more than brevity.

WHERE TO WORK
- The code to read is the git worktree at ${W} (branch linha-0-plano, at upstream/main 48875e3). Use absolute paths under it.
- The session's current directory, /Users/pedrofernandes/ACPM, is a STALE checkout, many versions behind: never read code from it. The only thing you use there is the notes folder ${N}.
- This is discovery: change NOTHING in the worktree (no edits, no git command that writes, no npm install, no formatter). Never run npm run test:db, never use the network, never touch Supabase. You may run read-only commands (grep -n, wc, sed -n, git log, git show, git blame) and, when running something is the fastest way to confirm a fact about a pure module, node -e or node --test on a unit test file.
- You write at most one file, the one named in your brief, inside ${N}. If writing it is refused, say so in what you return and put the most important content there instead.

READ FIRST
1. ${N}/pedido.md: Pedro's request for the redesign, all of it. The app becomes a left-to-right production line (Pedidos, then Processamento, then Escala, then Aprovar); the cadastros (Alunos, INVAs, Recursos) become master-detail screens; a right rail holds the only date control and the date's notifications. Your questions come from it.
2. ${N}/referencias-visuais.md: the two visual references, described in words.
3. ${W}/README.md (sections 'Formato dos dados' and 'Estrutura') and ${W}/docs/PLAN.md lines 442 to 461 (the sections 'Abas de cadastro, Recursos e Cursos (2026-11-19)' and 'The Painel'), which describe the latest state of the screens.

HOW TO READ
- Read every file listed for you from top to bottom (not excerpts), then follow the references with grep across ${W}/js, ${W}/test, ${W}/supabase, ${W}/scripts, ${W}/index.html and ${W}/css. When a question says EVERY reader or EVERY writer, grep the whole repo and list them all with file:line.
- Every statement of fact carries its evidence as path:line (paths relative to the worktree root, for example js/engine.js:412), with identifiers, ids, data attributes and UI labels quoted exactly as in the code (they are in Portuguese; keep them). If you infer something without having seen the line that proves it, mark it (inferred).
- If the request assumes something the code contradicts (a name, a count, a behaviour, who may do what), record it as a conflict with its evidence. Do not smooth it over and do not guess.
- Suggestions are welcome but stay in their own section, marked as suggestions, each with its cost and its risk.
- This repo's rules: tests use only fictitious names and weights; personal data never goes to CSV, PDF, BI or the History; runAllocationEngine is a pure function with golden files; gravarAlteracao is the only way events change data; data-format steps never delete fields. Note anything in your area that touches those rules.`

const FORMATO_DO_MAPA = `THE MAP (write it in English; code identifiers and UI labels verbatim), with these sections in this order:
# Mapa: <area title>
## 1. What exists
## 2. Data (every field: where it is stored, per date or for all dates, who writes it)
## 3. Controls inventory (one table row per control on screen: label | element (id, data-act, data-f, class) | handler (function, file:line) | state read and written | profiles that can use it)
## 4. Rules and the tests that pin them (file and test name)
## 5. Answers (one subsection per question of your brief, in order)
## 6. Conflicts with the request
## 7. Implications and options for the redesign (suggestions)
## 8. Open questions for Pedro
The last line of the file must be exactly: <!-- fim -->
A section that does not apply to your area says so in one line. Do not pad: tables and lists over prose. A thorough map of a large area runs to several hundred lines, and that is expected.

IF YOU ARE A RETRY: if your map file already exists and its last line is <!-- fim -->, do not redo the work. Read it and return the digest from it.

WHAT YOU RETURN (the structured output) is the digest of your map. It must stand alone: someone who reads only the digest must learn the facts the plan most depends on, every conflict with the request, and what you could not cover.`

const AREAS = [
  {
    key: 'casca',
    titulo: 'The shell: header, navigation, the open date, layout and CSS',
    arquivos: `index.html (all of it: the header, the nav, the skeleton of every section, the drawers and the dialogs); css/app.css (all of it); js/main.js; js/views/tabs.js; js/views/vistas.js; js/views/selos.js; js/eventos/navegacao.js; js/eventos/topo.js; js/eventos/registro.js; js/eventos/confirmacao.js; js/dom.js; js/perfis.js; js/somente-leitura.js; js/views/conta.js; js/eventos/conta.js; js/state.js; js/actions.js (the open date, lerData, the profile); js/util.js; js/format.js; the img folder (list it); test/unit/csp.test.js; test/unit/contraste.test.js; test/helpers/contraste.js`,
    perguntas: `1. The header: the exact structure of the date control (.topo-data: previous day, next day, the native date input, anything else), how a date change flows from the event to lerData, everything else that reads or sets the open date (URL, sessionStorage, other tabs' own dates such as the Agenda's), and the rule for the date the app opens on.
2. The nav: the nine tabs, their groups and separators, ids, roles and ARIA, per-profile visibility (js/perfis.js), how a tab is shown (js/views/tabs.js: show), data-go, focus handling, and the phone tab strip.
3. Where Manual, Histórico, Painel, Minha conta, the theme switch and Sair live, and how each opens (a section, a drawer or a dialog).
4. The 1,280 px page cap: the selector that sets it and everything that depends on it (the Painel's two-lists rule at 1,600 px, table minimum widths, the map, the full-screen modes).
5. Every CSS breakpoint and what changes at each; the phone rules (cards, the tab strip, 44 px targets) and the 320 px guarantees.
6. The colour tokens by name, in light and dark: accent, main and muted text, hairlines, surfaces, a selected-row background, status colours (ok, error, warning, pending). Which exist, which the new layout would have to add, and what test/unit/contraste.test.js demands of any new pair.
7. The drawers (.gaveta: historico, painel-instrutor, painel-dados, painel-reparo) and the dialogs (dlg-status, dlg-painel, dlg-sessao, dlg-agendar): what each is for and how Esc and focus work (abrirGaveta, gavetaDoEsc, fecharNoEsc, algumDialogoAberto), since the request allows no modal or pop-up for viewing or editing a record.
8. js/eventos/registro.js: how data-act, data-f and data-a are dispatched, the read-only lock and the lock of before the date opens. What a new shell must keep working.
9. Icons and avatars: how the app draws icons today (inline SVG, characters, images), since the redesign needs status icons, chevrons, switches and avatars with initials with no new dependency. What the CSP test allows (inline styles, inline scripts, data URIs).
10. What a primary navigation made of four stage cards plus a secondary navigation would replace in index.html, css/app.css and the JS above, and which tests pin today's nav (name the selectors).`,
  },
  {
    key: 'pedidos',
    titulo: 'Pedidos: the Agenda de Solicitações today',
    arquivos: `js/agenda.js; js/views/agenda.js; js/eventos/agenda.js; the Agenda parts of js/storage.js, js/backends/local.js and js/backends/supabase.js; index.html section #s-age; supabase/migrations/20261110222505_perfil_secretaria.sql; supabase/migrations/20261110222506_agenda_de_solicitacoes.sql; supabase/migrations/20261114222031_agenda_com_duracao.sql; supabase/migrations/20261114230012_agenda_limite_de_locais.sql; supabase/migrations/20261114230509_agenda_sem_domingo.sql (and any later migration that touches solicitacoes: grep); supabase/tests/database/agenda.test.sql, agenda-horas.test.sql, agenda-locais.test.sql, agenda-prazo.test.sql; test/unit/agenda.test.js; test/e2e/agenda.spec.js; test/e2e/agenda-compartilhado.spec.js; the Agenda part of test/e2e/supabase-falso.js; the Agenda text of the Manual (index.html #s-manual) and the glossary terms about it (js/glossario.js)`,
    perguntas: `1. The solicitacoes table: every column, constraint and index, the RLS policies, the RPCs (name, arguments, who may call), and the states a pedido can be in today (is cancelling a delete or a flag?).
2. The rules and where each is enforced (server, client or both): the 13:00 deadline of the day before, 'Exceção da Coordenação', no Sundays, the local-flight limit, duration. Who can do what per profile (Secretaria, Operador, Administrador, Gestor, Painel).
3. What a pedido carries (student, date, mission or type, period or times, duration, note, author, exception) and what it lacks compared with a request of the Demanda (resource, instructor, 1st and 2nd preference, availability, priority).
4. importarSolicitacoes: the exact mapping from a pedido to a Demanda request (which fields it sets, alvoDoNovoPedido, chaveTemSobras, what it never overwrites, the closed-course gap noted in PLAN.md) and its tests.
5. The Agenda page: every control (the form's fields, buttons, the list, cancelling, filters), calendarioHTML (what the month calendar shows: counts per day? how the month's data is fetched), selo-age (what it counts) and how the Agenda's own date relates to the app's open date.
6. Local mode: where pedidos live and how the server's rules are mirrored.
7. Renaming: every place the words agenda, solicitação and solicitacoes appear (file names, exports, ids, CSS classes, RPC, table and policy names, History kinds, glossary keys, the Manual, tests, the fake server), with counts per file, so the plan can recommend what to rename: the UI text only, the JS modules too, or the table too. State the cost and the risk of each level (a table rename against a live app in production that reads the old name).
8. For an approval state: what would change in SQL (a column, an RPC, RLS), which pgTAP files would cover it, how the fake server models the table, and what approval could mean for a pedido that an Operador registers himself, for a pedido past the deadline with the exception, and for a pedido cancelled after approval.`,
  },
  {
    key: 'demanda',
    titulo: 'Demanda: the table the operator edits per date, and the requests data',
    arquivos: `js/views/demanda.js; js/eventos/demanda.js; js/views/etapas.js; js/rules.js; js/state.js; js/dias.js; js/voo.js; js/noturno.js; js/config.js (MIS and the mission types); js/instrutor-escolhido.js (the Demanda side); js/fixos.js (limparDemanda and what a Demanda change does to pins); index.html section #s-dem; test/e2e/demanda.spec.js; test/e2e/cursos-no-dia.spec.js; test/e2e/noturno.spec.js; test/unit/rules.test.js; test/unit/dias.test.js; test/unit/noturno.test.js`,
    perguntas: `1. The exact data shape of a day's requests: every field of a student entry in the DAY (fly, extra, mis, nb, pr, p1, p2, jan, the duration, insId, etapa, cursoDaEtapa, solicitacao, and any other), which fields belong to the roster (cadastro) and which to the day, how js/dias.js splits and joins them, and how a new date starts (copied from the previous day? empty?).
2. For EVERY column of the Demanda table and every control of its toolbar (Voa, Missão, Recurso, Instrutor, 1ª preferência, 2ª preferência, Disponibilidade, Duração, Prioridade, Usar, 'Outra missão…', the extra missions and their removal, 'Só quem voa', the search, the mission filter, the Curso filter, 'Pôr um aluno na demanda', 'Importar da agenda', 'Limpar demanda', the booked tag, and anything else on screen): the label, the element (id, data-act, data-f), the handler, the state field it reads and writes, the allowed values and the default, who can use it, and what the engine does with that field.
3. Which of those values can be DERIVED today from other data (the mission from the program through js/progresso.js; the resource type and the duration from the mission or the program; the instructor from 'Priorizar com'; the availability and the preferences from the pedido) and which are pure operator input with no other source. Be exact: this decides where each column lives after the redesign.
4. What a pedido imported from the Agenda fills in and what it leaves to the operator.
5. The mission types and normalizeMissionFields: the valid combinations of mission, resource and duration; Ground School classes; the two-day Noturno; Voo Solo; Cheque; how many missions a student can have in one day (the extras).
6. EVERY reader and writer of the day's requests (stu[].fly, stu[].extra and their fields) outside the engine: views, exports, BI, the History reverts, agendamento, fixos, compactar, reparo, the Painel. List them by file with line numbers, so the plan knows what a derived Demanda must keep feeding.
7. The History entries the Demanda writes and their revert kinds (js/reversoes.js).
8. If the Demanda had no data of its own (requests derived from approved pedidos plus the cadastros), which of today's behaviours have nowhere to live: list each one (for example a student put on the Demanda by hand with no pedido, an extra mission, a priority, a mission chosen out of order with its confirmation, Limpar demanda).`,
  },
  {
    key: 'motor',
    titulo: 'The engine: its input contract, win, aw and the goldens',
    arquivos: `js/engine.js; js/viabilidade.js; js/rules.js; js/config.js; js/horarios.js; js/noturno.js; js/limites.js; js/combustivel.js; js/hangar.js; js/voo.js; js/compactar.js; js/criterios.js; js/metricas.js; js/candidatos.js; js/conflitos.js; js/escala-gravada.js; test/unit/engine.golden.test.js; test/unit/engine.invariants.test.js; test/unit/engine.rules.test.js; test/unit/equalizar.test.js; test/unit/viabilidade.test.js; test/unit/compactar.test.js; test/helpers/goldens.js; test/helpers/cenarios.js; test/helpers/estado.js; test/helpers/exemplo.js; test/helpers/montar.js; scripts/capturar-goldens-motor.mjs; scripts/medir-escalas.mjs; two or three files of test/fixtures/goldens-do-motor (to see the format) and exemplo-estado.json`,
    perguntas: `1. The engine's input contract: EVERY property path of the state that runAllocationEngine and the functions it calls read, grouped by entity (student request, instructor, resource, the day's settings, the roster's settings), each with the line where it is read and what it means. Then the output shape (flights, conflicts, warnings, what was left out) with every conflict and warning code.
2. The goldens: how many files, how the scenarios are generated (test/helpers/cenarios.js), which input fields they vary (win? aw? the criteria? pinned flights? chosen instructors?), and how they are recorded again. The plan must say which changes keep them byte-identical.
3. state.win (Janelas de operação): the data shape, EVERY reader in the whole repo (js, test, scripts, supabase, index.html) with file:line, what a closed window does to each mission type (flights, simulator, Ground School, the Noturno), and how win interacts with the per-category take-off times of js/horarios.js. List each behaviour that would be lost if win were removed (closing a period for one date) and what could replace it.
4. aw (an instructor's availability, one boolean per fixed window) and WIN: the data shape, the count of windows and their times, EVERY reader and writer in the repo with file:line, and the function cobre: exactly what it requires (the whole flight inside available windows? the turnaround? the Noturno? Ground classes?). Then: what a model of 'ranges of earliest and latest mission start time' has to reproduce so the goldens stay identical when aw is converted (the request's step 1), and what would change in the request's step 2 (a range limits only when a mission may start).
5. The criteria (js/criterios.js: buracos and horarios): the values, their UI labels today, where they are stored (roster or day), and how the engine and the compaction use each value.
6. The order in which the engine places things (pins in two passes, Ground, flights, priorities, the even split, the rodízio) and its purity guarantees (no clock, no DOM, no randomness); how the saved schedule (js/escala-gravada.js) relates to running the engine again on every change.
7. Which inputs come from the cadastros: the students' 'Priorizar com' and 'Não escalar com', the legal limits, the hours until the 50 h inspection, the fleet attributes, the hangar order, the weights and the fuel rule.
8. For Pedro's question (does Processamento emit today's state shape, so the engine and its goldens stay untouched): list exactly what a module would have to emit for the engine to run unchanged, and which engine-read fields have no source other than the Demanda table today.`,
  },
  {
    key: 'escala',
    titulo: 'The Escala tab: toolbar, views, criteria, compaction, approval and exports',
    arquivos: `js/views/escala.js; js/eventos/escala.js; js/actions.js; js/escala-gravada.js; js/criterios.js; js/compactar.js; js/metricas.js; js/export.js; js/csv.js; js/planilha.js; js/conflitos.js; js/dicas.js; js/views/painel-aeroporto.js (only how the Painel view hangs off the Escala); index.html section #s-esc; test/e2e/aprovacao.spec.js; test/e2e/escala.spec.js; test/e2e/escala-tela.spec.js; test/e2e/escala-automatica.spec.js; test/e2e/compactacao.spec.js; test/e2e/planilha.spec.js; test/e2e/revisao.spec.js; test/unit/compactar.test.js; test/unit/escala-gravada.test.js; test/unit/csv.test.js; test/unit/planilha.test.js`,
    perguntas: `1. A complete inventory of the Escala tab: every toolbar control and every view (the list, the maps by resource and by instructor, the Painel), the filters, the criteria controls with their labels today, the compaction switches, '+ Agendar voo', the exports (CSV, PDF, Excel), #aprovacao (Aprovar, Reabrir and the text beside it), the conflict list, the Sugestões entry, the status changes, the padlock. For each: label, id or data-act, handler, the state it touches, the profiles.
2. Approval: the data it stores (is who approved and when stored? where: the day, the History?), fixosAoAprovar, what Reabrir does, what can still change on an approved schedule, and what blocks approval today (do unresolved conflicts block, or only warn?).
3. Exports: what each one contains, whether an export is recorded anywhere (is there any 'exported' mark in the data or the History?), and what exporting does to a schedule that was only calculated (PLAN.md says it saves).
4. The automatic schedule: when the engine runs again (on every change?), where the result is stored, what the compaction is and when it runs (a button, a switch, automatic), so the plan can define the pipeline sub-tasks 'motor' and 'compactação' honestly.
5. The criteria as 'this stage's configuration': where the controls are today, their exact labels and values, and what renaming 'Avião' to 'Recurso' and 'Não mudar' to 'Não considerar' touches (the Manual, the glossary, tests, History texts).
6. What of this tab would move to a separate 'Aprovar' stage (unresolved conflicts, approve or reopen, the exports) and what stays in 'Escala'; which tests pin today's placement (name the selectors and the spec files).
7. Width: what in this tab needs the full page width (the maps, the Painel) and what happens to it in a three-pane layout where the middle pane has about 48 percent.`,
  },
  {
    key: 'restricoes',
    titulo: 'Operator restrictions: pins, the chosen instructor, booking, Sugestões, status and reverts',
    arquivos: `js/fixos.js; js/instrutor-escolhido.js; js/agendamento.js; js/views/agendamento.js; js/eventos/agendamento.js; js/candidatos.js; js/reparo.js; js/views/reparo.js; js/reversoes.js; js/status.js; js/views/dialogo-status.js; index.html dialogs #dlg-agendar and #dlg-status and the drawer #painel-reparo; test/e2e/instrutor-escolhido.spec.js; test/e2e/agendamento.spec.js; test/e2e/agendamento-mapa.spec.js; test/e2e/status.spec.js; test/e2e/reparo.spec.js; test/e2e/historico.spec.js; test/unit/fixos.test.js; test/unit/instrutor-escolhido.test.js; test/unit/agendamento.test.js; test/unit/reparo.test.js; test/unit/reparo-horario.test.js; test/unit/reversoes.test.js; test/unit/status.test.js; test/unit/candidatos.test.js`,
    perguntas: `1. Pins (voos fixos): the kinds and their marks (by approval, by status, escolhido, agendado), the data shape in the day, how each is created and released, the precedence between them, what a Demanda change does to them (Limpar demanda, Usar, a mission change) and how the engine treats each kind.
2. The chosen instructor: in the Demanda (insId on the request, the engine fits the flight with him) and in the Escala (the flight pinned where it is): the data, the UI and the revert.
3. The booking dialog ('+ Agendar voo' and its other entry points): exactly what a booking writes (the request in the Demanda, main or extra; the pin; weights to the roster). In the target model the Demanda has no data of its own: what would a booking write when requests are derived from approved pedidos? Does a booking create a pedido today?
4. The Sugestões (js/reparo.js) and the status changes as operator inputs: what each writes.
5. History reverts (js/reversoes.js): every revert kind and the data it assumes (requests in stu[].fly and stu[].extra, pins, the chosen instructor), since moving the requests' source of truth changes what a revert has to restore.
6. In the target model, operator restrictions override any rule and are the first input of the Escala stage. List precisely which operator inputs exist today, where each is stored, and which of today's Demanda columns are really operator restrictions (a Recurso or an Instrutor fixed on a request, a Prioridade) and not data of the pedido.
7. The dialogs and the drawer in this area (#dlg-agendar, #dlg-status, #painel-reparo): are they 'viewing or editing a record' in the sense of the request (which forbids modals for records), or actions that may stay as dialogs? Give the facts that decide it.`,
  },
  {
    key: 'alunos',
    titulo: 'Alunos: the roster, personal data, course progress and permissions',
    arquivos: `js/views/cadastros.js; js/eventos/cadastros.js; js/views/dados-pessoais.js; js/dados-pessoais.js; js/views/filtro-dos-cursos.js; js/filtro-multiplo.js; js/views/filtro-multiplo.js; js/cursos.js; js/progresso.js; js/resultados.js; js/views/etapas.js; js/format.js; js/perfis.js; index.html section #s-alu and the drawer #painel-dados; supabase/migrations/20261113150000_dados_pessoais.sql; supabase/migrations/20261114151953_dados_pessoais_versionados.sql; supabase/migrations/20261113140000_leitura_por_perfil.sql; supabase/migrations/20261114120000_resultados_de_missao.sql (and later migrations that touch those objects: grep); supabase/tests/database/dados-pessoais.test.sql, resultados.test.sql, leitura.test.sql, acesso.test.sql; the Alunos parts of test/e2e/cadastros.spec.js; test/e2e/dados-pessoais.spec.js; test/e2e/perfis.spec.js; test/e2e/seguranca.spec.js; test/unit/dados-pessoais.test.js; test/unit/progresso.test.js; test/unit/resultados.test.js`,
    perguntas: `1. The student record: every field in the roster (id, name, weight, course, 'Priorizar com', 'Não escalar com', and any other) and every field of the personal data (CANAC, CPF, nome completo, nascimento, celular, e-mail, and any other): where each is stored (the roster document or the dados_pessoais table), and who can read and write each per profile, in SQL (RLS and salvar_dados_pessoais: quote the exact role check and name the pgTAP cases that pin the Secretaria's permission) and in the UI (js/perfis.js).
2. How the CANAC reaches the Alunos table (which query or RPC; does the Gestor get it?), since the new list searches by name or CANAC and shows the CANAC and the course on a row's second line. Is the CANAC personal data for the Gestor?
3. The Alunos tab today: every column and control (the search, the Curso filter, 'N de M', '+ Novo aluno', the inline fields, the Dados pessoais drawer and each field in it, the delete button and its confirmation, 'Abrir a Demanda'), with element ids and data attributes, handlers, the state touched and the profiles.
4. 'Missão anterior' and 'missão atual': what js/progresso.js and js/resultados.js can give for a student (the last result, the next mission or missions, the progress in the course), where results are registered in the UI today (which screen, which control, which RPC, which profiles) and what 'editing through registering a result' would mean in a student's detail pane.
5. Is there any notion of an inactive student today? What does deleting a student do to the day's requests, the results, the personal data and the History? What would a cadastro-level 'ativo' flag have to gate (the Demanda or Processamento, new pedidos, the lists and filters, BI)?
6. The Secretaria today: everything she can see and do in Alunos and in Dados pessoais, in the UI and on the server. The request removes her edit rights with a migration: what must change in SQL, in the fake server, in js/perfis.js and in the tests, and does she keep READING personal data?
7. Local mode: where personal data lives and what a profile means there.
8. The focus-keeping machinery of js/views/cadastros.js (QUEM_E, DO_TIPO, manterRolagens) and the filter state kept across redraws: what a master-detail list must keep and what it can drop.`,
  },
  {
    key: 'invas',
    titulo: 'INVAs: the Instrutores tab, availability (aw), habilitações, legal limits and the rodízio',
    arquivos: `js/views/cadastros.js and js/eventos/cadastros.js (the Instrutores parts); js/habilitacoes.js; js/limites.js; js/rodizio.js; js/views/rodizio.js; js/eventos/rodizio.js; js/viabilidade.js; js/candidatos.js; js/config.js (WIN and the instructors' defaults); js/dias.js (what of an instructor belongs to the day); js/instrutor-escolhido.js; js/dados-pessoais.js; index.html sections #s-ins and #s-rod and the drawer #painel-instrutor; supabase/migrations/20261113180000_horas_dos_instrutores.sql; supabase/migrations/20261115151734_repouso_conta_o_atraso.sql; supabase/tests/database/limites.test.sql; the Instrutores parts of test/e2e/cadastros.spec.js; test/e2e/limites.spec.js; test/e2e/rodizio.spec.js; test/unit/habilitacoes.test.js; test/unit/limites.test.js; test/unit/rodizio.test.js; test/unit/viabilidade.test.js; test/unit/candidatos.test.js`,
    perguntas: `1. The instructor record: every field in the roster and in the day (name, weight, the habilitações, aw, on or 'Vem', any preference, the CANAC and the contact data in dados_pessoais, the hours for the legal limits), which are per date and which for all dates, and how a new date gets its instructors' availability (copied from the previous day? a default?).
2. The two views (Disponibilidade do dia | Cadastro): every column and control in each, with ids and data attributes, handlers, the state touched and the profiles; the 'Editar habilitações' drawer (its groups, each resource's own habilitação); removing an instructor and its undo.
3. aw on screen: how the windows are drawn and edited per instructor per date, what 'Vem' is (stored or derived), any bulk action, and EVERY writer of aw with file:line.
4. The legal limits: the data they need (hours flown, rest), where it comes from (which table and RPC), who edits it, and how they block or warn.
5. Which 'preferences' an instructor has today: is there any instructor-side preference, or only the students' 'Priorizar com' and 'Não escalar com' pointing at instructors? The request's INVA detail lists 'preferences': say what exists to show.
6. Is there any notion of an inactive instructor? What does removing an instructor do to the days, the pins, the rodízio queues and the students' preferences that point at him?
7. For the availability-ranges model (per date, one or more ranges of earliest and latest mission start time, gaps allowed): what the data and the UI would need, and the exact equivalence between today's windows and ranges, given that take-off times differ by category (js/horarios.js) and one INVA flies several resources.
8. The rodízio: what it is, its data (per date?), and how it depends on the instructors, since the request says its behaviour does not change but it needs a place in the new navigation.`,
  },
  {
    key: 'recursos',
    titulo: 'Recursos: the fleet, take-off times, Janelas de operação, the hangar and the habilitações registry',
    arquivos: `js/views/recursos.js; js/eventos/recursos.js; js/views/horarios.js; js/horarios.js; js/frota.js; js/categorias.js; js/hangar.js; js/views/filtros-dos-recursos.js; js/config.js; js/habilitacoes.js; js/combustivel.js; js/viabilidade.js (the resource side: available, the balance until the inspection); js/candidatos.js; index.html section #s-rec; test/e2e/atributos.spec.js; test/e2e/hangar.spec.js; the Recursos parts of test/e2e/cadastros.spec.js; test/unit/frota.test.js; test/unit/atributos.test.js; test/unit/horarios.test.js; test/unit/hangar.test.js; test/unit/categorias.test.js; test/unit/habilitacoes.test.js; test/unit/combustivel.test.js; test/unit/config.test.js`,
    perguntas: `1. The resource record: every field in the roster (the matrícula, the type or category, attributes such as 'Só Parafuso' and habilitacaoPropria, the take-off times per category) and in the day (available or in maintenance, the hours until the 50 h inspection, the hangar order), which are per date and which for all dates, and how a new date gets them.
2. The two views (Disponibilidade do dia | Cadastro): every table, column and control (Janelas de operação, the aircraft table with 'Disponível' and the hours, Ordem no hangar with its move buttons, the Frota with the attributes and 'Retirar', the Horários de decolagem editor, '+ Novo recurso', the search, the Categoria filter, #selo-rec), with ids and data attributes, handlers, the state touched and the profiles.
3. Habilitações: the registry HABILITACOES (ids, groups, labels), the per-aircraft id aviao:<matrícula> (how it comes from the fleet and from habilitacaoPropria), exigencias (what each mission requires), where an instructor's habilitações are stored, and EVERY place that decides whether an INVA may operate a resource. For the request's proposal (a resource's requirement points at the same registry; habilitacaoPropria may become a list of required ids): what exists, what a list would change in js/viabilidade.js and the engine (would the goldens change?), and how the flag would be converted.
4. Janelas de operação (state.win): the UI, the data, EVERY reader with file:line and what each does with a closed window; where it overlaps with and differs from the per-category take-off times; what closing a period for one date is used for in practice (look at the Manual and the tests).
5. 'Retirar' (a resource leaves the fleet), 'Disponível' (per date) and maintenance: the exact meaning and data of each, the undo, and what the engine, the maps, the hangar and the exports do with each. Is there any 'inactive' notion for a resource today, and how would a cadastro-level switch differ from 'Retirar'?
6. The hours until the 50 h inspection: the data, who edits it, whether flights consume it, how js/viabilidade.js uses it, what the screen shows.
7. The hangar order: the data, the rules (moverNoHangar), where it is used (the engine? the exports? the Painel?), and where it could live in a master-detail Recursos screen.
8. The take-off times editor (js/views/horarios.js): its draft and conflict rules, since it is a multi-row editor that has to live in a detail pane or elsewhere.`,
  },
  {
    key: 'dados',
    titulo: 'The client data layer: formats, storage, the write path and the History',
    arquivos: `js/migracoes.js; js/storage.js; js/backends/local.js; js/backends/supabase.js; js/dias.js; js/state.js; js/actions.js; js/sessao.js; js/config-supabase.js; js/eventos/historico.js; js/reversoes.js (only what the History needs from it); js/perfis.js; js/somente-leitura.js; test/unit/migracoes.test.js; test/unit/storage.test.js; test/unit/storage-dias.test.js; test/unit/backend-local.test.js; test/unit/backend-supabase.test.js; test/unit/dias.test.js; test/unit/perfis.test.js; README sections 'Banco de dados' and 'Formato dos dados'`,
    perguntas: `1. The data model seen from the client: the documents (the cadastro and each dia) and their top-level fields; the data kept beside them (pedidos, personal data, mission results, instructors' hours, course programs, the History); what the client reads at opening and on each date change.
2. A precise table of what is stored PER DATE and what FOR ALL DATES today, field by field (students, instructors, resources, win, the criteria, the hangar, the rodízio, the painel settings, the take-off times), since the redesign moves per-date data around (availability ranges, deactivation flags, the pedidos' approval).
3. js/migracoes.js: ESQUEMA (25 is expected: confirm), every step so far and the pattern of a step (a pure function, its test), FORMATO_DOS_CURSOS and the mirror test; how the client upgrades stored data (the order days then roster, what happens to a tab on the old version), and what a step may and may not do. Then: how to add steps 26, 27 and 28 safely when several branches add steps in parallel (what a renumbering costs), and whether one format number can carry several independent changes.
4. The write path: gravarAlteracao, save, logChange, lerData, dadosLidos, aindaNaoAbriu; versions and conflicts (PT409 and what the user sees); what a new screen has to do to stay inside those guarantees.
5. The History: the kinds of entry, who and when, the revert kinds, and how personal data is kept out of it.
6. Local mode: every localStorage key, and the rules that keep it equal to the server.
7. Profiles on the client (js/perfis.js, js/somente-leitura.js): the full matrix of who sees and edits what, as the client enforces it.
8. For a derived Demanda (requests computed from approved pedidos instead of stored in the day): what the day document would still need to store, what the saved schedule depends on, and what reading the pedidos of the open date on every date change would cost (queries, offline and local mode).`,
  },
  {
    key: 'banco',
    titulo: 'The server: migrations, RPCs, RLS, pgTAP and the fake Supabase',
    arquivos: `every file in supabase/migrations (read all of them: they are the server contract); every file in supabase/tests/database; supabase/config.toml; scripts/testar-banco.mjs; scripts/semear-previa.mjs; scripts/semear-dias-previa.mjs; scripts/criar-conta.mjs; test/e2e/supabase-falso.js; test/unit/espelho-do-banco.test.js; test/unit/supabase-falso.test.js; test/helpers/casos-do-programa.js`,
    perguntas: `1. Inventory: every table (columns, constraints), every function and RPC (signature, security definer, the role check: which profiles may call it, the error codes and hints), every RLS policy, the profiles and how a profile is read in SQL, and the grants.
2. The format guard: how the server refuses an older format (the function or trigger) and what stores the format.
3. solicitacoes in full: columns, checks, policies, the RPCs, and the deadline, exception, Sunday and local-limit rules in SQL.
4. Personal data in full: the table, the versioning, who can read, and salvar_dados_pessoais: quote its exact role check and list every pgTAP case that pins the Secretaria's permission (file and test text).
5. How migrations are written here (file naming, expand-only style, create or replace, security definer with an empty search_path, grants, comments in Portuguese) and the conventions of the pgTAP files (plan counts, the helpers that create a user of each profile, how a test takes a profile), with the number of checks per file.
6. What the fake server (test/e2e/supabase-falso.js) models for each table and RPC, and which tests keep it equal to the SQL.
7. What new migrations would have to touch, with the deploy order (the migration reaches the preview and then production BEFORE the merge, so the live app must keep working with the new schema): (a) an approval state for a pedido; (b) the Secretaria no longer saving personal data; (c) anything the server knows about the day's format that the availability ranges or a removed win would affect (does any SQL read aw, win or the requests inside the day document: painel_do_dia, the legal limits, the hours?).
8. How the database tests are run (the preview project only; the throwaway local Postgres mentioned in PLAN.md) and what a plan step that adds a migration must list in its go-live checklist.`,
  },
  {
    key: 'testes-e-docs',
    titulo: 'Tests, CI, the Manual, the glossary and the README',
    arquivos: `test/e2e/fixtures.js; test/helpers/navegador.js and the other files of test/helpers; test/e2e/celular.spec.js; test/e2e/acessibilidade.spec.js; test/e2e/app.spec.js; test/e2e/dicas.spec.js; test/e2e/selos.spec.js; test/e2e/datas.spec.js; test/e2e/datas-compartilhado.spec.js; test/e2e/perfis.spec.js; test/e2e/compartilhado.spec.js; test/e2e/abertura.spec.js; test/e2e/login.spec.js; test/e2e/contas.spec.js; playwright.config.js; eslint.config.js; scripts/exportacoes-sem-uso.mjs; scripts/serve.mjs; .github/workflows/testes.yml; test/unit/manual.test.js; test/unit/glossario.test.js; test/unit/csp.test.js; test/unit/contraste.test.js; test/unit/perfis.test.js; js/manual.js; js/views/manual.js; js/glossario.js; js/dicas.js; index.html section #s-manual; README.md`,
    perguntas: `1. How the suites run: the commands, the CI steps, parallelism, the static server and its port, how long they take if anything records it, and what a green 'npm test' includes (is the lint part of CI?).
2. The shared e2e helpers (test/e2e/fixtures.js, test/helpers/navegador.js: irParaVista, percorrerVistasEFiltros and the others): what each does and which spec files use it.
3. A census of what the redesign breaks. For each spec file: how many tests it has and which navigation it depends on. Use grep counts per selector per file for at least: the nav buttons and tab ids (#s-esc, #s-dem, #s-age, #s-rec, #s-ins, #s-alu, #s-cur, #s-rod, #s-bi), .topo-data and the date input, the drawers (#painel-dados, #painel-instrutor), the Demanda table's fields, the Agenda calendar, Janelas de operação, the aw checkboxes, #aprovacao. The plan has to size the test rewrite per workstream.
4. The invariants the tests enforce on ANY screen, which the new screens must meet: the phone widths tested, 320 px without horizontal overflow, 44 px targets, accessible names, contrast pairs, focus order, the CSP, the unused-exports lint, and the consistency tests of the glossary and the Manual (say exactly what they compare).
5. The Manual and the glossary: how they are built (static HTML in index.html, tables generated by js/manual.js, the terms of js/glossario.js, js/dicas.js), and a list of the sections and terms the redesign must rewrite (the nine tabs, the Demanda, the Agenda, Janelas de operação, the instructors' windows, the date control, approval in the Escala toolbar).
6. README 'Estrutura': the rows that will change.
7. The working rule 'tests first, npm test green on every step': what a step's PR has to run locally and what CI runs; anything flaky or slow that parallel worktrees should know (ports, shared state, the Playwright browsers).`,
  },
  {
    key: 'outras-abas',
    titulo: 'Cursos, Rodízio, BI, the Painel, Histórico, Manual and Minha conta',
    arquivos: `js/views/cursos.js; js/eventos/cursos.js; js/programa.js (its exported surface); js/progresso.js; js/resultados.js; js/views/rodizio.js; js/eventos/rodizio.js; js/rodizio.js; js/views/bi.js; js/eventos/bi.js; js/metricas.js; js/dias.js (the BI part); js/views/painel-aeroporto.js; js/quadro.js; js/config-do-painel.js; js/views/config-do-painel.js; js/painel.js; painel.html; js/views/meteorologia.js; js/eventos/historico.js; js/views/manual.js; js/views/conta.js; js/eventos/conta.js; index.html sections #s-cur, #s-rod, #s-bi, #s-manual, #s-conta, the drawer #historico and the dialog #dlg-painel; test/e2e/cursos.spec.js (skim: structure and what it pins about navigation); test/e2e/bi.spec.js; test/e2e/rodizio.spec.js; test/e2e/historico.spec.js; test/e2e/painel-missoes.spec.js (skim)`,
    perguntas: `1. For each of Cursos, Rodízio, BI, the Painel (the Escala's Painel view, its full screen and painel.html), Histórico, Manual and Minha conta: where it is reached today and by which profiles, what it depends on (the open date? the roster? the day?), its width needs (the 1,280 px cap, the Painel's 1,600 px rule, wide editor tables) and its phone behaviour.
2. What each would need from a new shell: does it fit the three-pane layout (list, detail, rail) or is it a full-width page? (Cursos already has a course switcher and a phase index; BI has filters and tables; the Rodízio has queues per date; the Histórico is a drawer over any tab.) Does each of them need the right rail's date?
3. How mission results are registered (which screen, which control) and how the Cursos tab's student lists link to Alunos.
4. The Histórico drawer: what opens it, what it shows (the open date only?), the reverts, and whether it conflicts with 'no modal or pop-up for viewing or editing a record' (it is a log, not a record: give the facts).
5. Suggestions (marked as such) for where each goes in a navigation whose primary row is the four stage cards: for example a secondary group for the cadastros (Alunos, INVAs, Recursos, Cursos, Rodízio) and a utilities group (BI, Painel, Histórico, Manual, Minha conta), with the reasons, the costs and the tests that pin today's placement.`,
  },
  {
    key: 'avisos',
    titulo: 'Notifications and pipeline states: badges, conflicts, warnings and what the app can compute',
    arquivos: `js/views/selos.js; js/conflitos.js; js/engine.js (where conflicts and warnings are produced); js/limites.js; js/combustivel.js; js/status.js; js/escala-gravada.js; js/views/escala.js (how conflicts and warnings are listed); js/reparo.js; js/agenda.js and js/views/agenda.js (the per-day counts of the calendar); js/eventos/historico.js; js/actions.js (the History entries with author and time; approval); js/fixos.js (approval); js/export.js; js/compactar.js; js/metricas.js; js/progresso.js; test/e2e/selos.spec.js`,
    perguntas: `1. The three badges (selo-esc, selo-age, selo-rec): exactly what each counts, when it is recomputed, its tooltip and its accessible text.
2. Every kind of conflict and warning the app can show for a date (the engine's conflicts and warnings with their codes and texts, the legal limits, missing weights, students left out, a delay that invades another flight, the fuel and weight rule, the take-off-times rule, and any other): where each is computed, whether it blocks or warns today, whether it has a time of day attached (the rail's list shows a time at the left), and where it is resolved (which screen and control).
3. For EACH proposed pipeline sub-task, check against the code whether the app can compute its state and its value today, from which data, or what is missing. Pedidos: registrados; fora do prazo ou com exceção; aguardando aprovação; aprovados. Processamento: missão definida pelo programa; preferências aplicadas; recursos disponíveis; INVAs disponíveis; pedidos que não cabem. Escala: restrições do operador; motor; compactação; conflitos e avisos. Aprovar: conflitos pendentes; aprovada por quem e quando; exportada. In particular: is 'approved by whom and when' stored anywhere? is an export recorded anywhere? does the compaction have a done or not-done state? what can 'running' mean for an engine that takes milliseconds?
4. The pedido counts per day for the calendar: how the Agenda calendar gets them today (one query per month? an RPC?), which profiles may read them, and what showing them on a rail that is on every screen would cost (queries per date change, local mode, the Gestor and the Painel profile).
5. A proposed list (marked as a suggestion) of notification items for the rail, each with its source, severity, time if any, title, second line and click target, plus the states a pipeline row can take (done, failed, pending, running, needs attention) mapped to real conditions in the data.`,
  },
]

const DIGEST = {
  type: 'object',
  properties: {
    chave: { type: 'string', description: 'the area or gap key given in the brief' },
    arquivo: { type: 'string', description: 'absolute path of the file written, or an empty string if writing was refused' },
    resumo: { type: 'string', description: 'up to 350 words: the facts the redesign plan most depends on' },
    fatos: { type: 'array', items: { type: 'string' }, description: 'up to 25 key facts, one sentence each, each ending with its evidence as path:line' },
    conflitos: {
      type: 'array',
      description: 'what the request assumes that the code contradicts',
      items: {
        type: 'object',
        properties: {
          suposicao: { type: 'string' },
          realidade: { type: 'string' },
          evidencia: { type: 'string' },
        },
        required: ['suposicao', 'realidade', 'evidencia'],
      },
    },
    opcoes: { type: 'array', items: { type: 'string' }, description: 'design options or recommendations, one or two sentences each with the main cost or risk' },
    perguntas: { type: 'array', items: { type: 'string' }, description: 'open questions for Pedro' },
    nao_coberto: { type: 'array', items: { type: 'string' }, description: 'files or questions not covered, each with the reason; empty when everything was covered' },
  },
  required: ['chave', 'arquivo', 'resumo', 'fatos', 'conflitos', 'opcoes', 'perguntas', 'nao_coberto'],
}

const CRITICA = {
  type: 'object',
  properties: {
    lacunas: {
      type: 'array',
      description: 'at most ten missing or doubtful FACTS, most important first',
      items: {
        type: 'object',
        properties: {
          chave: { type: 'string', description: 'short kebab-case id, ASCII only' },
          pergunta: { type: 'string', description: 'a concrete question one reader can answer by reading code' },
          por_que: { type: 'string', description: 'which part of the plan needs it' },
          onde_olhar: { type: 'string', description: 'files, functions or greps to start from' },
        },
        required: ['chave', 'pergunta', 'por_que', 'onde_olhar'],
      },
    },
    contradicoes: {
      type: 'array',
      description: 'maps that disagree with each other or with the code',
      items: {
        type: 'object',
        properties: {
          chave: { type: 'string', description: 'short kebab-case id, ASCII only' },
          mapas: { type: 'string', description: 'which map files' },
          o_que: { type: 'string', description: 'what disagrees, with the evidence found so far' },
          resolvida: { type: 'boolean', description: 'true when you settled it yourself against the code' },
          certo: { type: 'string', description: 'when resolved: the right value with its path:line; otherwise an empty string' },
        },
        required: ['chave', 'mapas', 'o_que', 'resolvida', 'certo'],
      },
    },
    cobertura: { type: 'string', description: 'one paragraph: is the discovery enough to write the plan, and what are its weakest parts' },
  },
  required: ['lacunas', 'contradicoes', 'cobertura'],
}

function promptDaArea(a) {
  return [
    REGRAS,
    '',
    'YOUR AREA: ' + a.titulo,
    'YOUR MAP FILE: ' + N + '/mapa-' + a.key + '.md',
    'THE KEY TO RETURN: ' + a.key,
    '',
    'FILES TO READ IN FULL (paths relative to ' + W + '): ' + a.arquivos,
    '',
    'QUESTIONS YOUR MAP MUST ANSWER:',
    a.perguntas,
    '',
    FORMATO_DO_MAPA,
  ].join('\n')
}

function promptDoCritico(rodada) {
  const chaves = AREAS.map(a => 'mapa-' + a.key + '.md').join(', ')
  return [
    REGRAS,
    '',
    'YOUR ROLE: the completeness critic of this discovery, round ' + rodada + '. You write no file.',
    'Fourteen readers mapped the code base, one area each. Their maps are in ' + N + ': ' + chaves + '.',
    rodada > 1 ? 'A first round of the critic already ran, and readers answered its gaps in the files ' + N + '/lacuna-*.md. Read those too. List only what is STILL unknown or still contradictory after them.' : '',
    '',
    'Decide whether this material is enough to write the plan section the request asks for (step 2 of its How to work: the current to target map, where every existing control ends up, the data-format steps and database migrations, the workstreams with the files each owns, the order, what is deleted, and the open questions), and list precisely what is still unknown.',
    '',
    'METHOD',
    '1. Read every map in full (a missing map file is itself a gap: say which).',
    '2. Go through the request paragraph by paragraph. For each thing the plan must state or decide, check that some map gives the facts needed, with evidence. Typical holes: a control of a screen that no inventory lists; a field whose storage (per date or for all dates) nobody states; the lists of EVERY reader of win or of aw that look incomplete; a permission nobody checked in SQL; a pipeline sub-task whose state nobody could compute; a test helper nobody described; a file of the repo that no map mentions although the redesign touches it.',
    '3. Cross-check the maps against each other. When two maps describe the same thing differently (the meaning of a field, a count, who may do something), that is a contradiction.',
    '4. Spot-check at least fifteen high-stakes facts against the code in ' + W + ', the ones the biggest decisions depend on: the fields the engine reads, the readers of win and of aw, what cobre requires, the role check in salvar_dados_pessoais, the columns of solicitacoes, what approval stores, ESQUEMA and the steps of js/migracoes.js, what importarSolicitacoes sets, the columns of the Demanda. A fact that is wrong goes in the contradictions, resolved, with the right value and its evidence.',
    '5. Run your own greps for the cross-cutting lists (win, aw, WIN, calendarioHTML, topo-data, habilitacaoPropria, salvar_dados_pessoais, aprovacao, fixosAoAprovar, importarSolicitacoes, selo-) and compare with what the maps list.',
    '',
    'RETURN the gaps (at most ten, most important first), the contradictions (settle the ones you can yourself and mark them resolved), and one paragraph on coverage. Do not list as a gap something a map already answers. Do not list design decisions (those belong to the plan): only missing or doubtful FACTS.',
  ].join('\n')
}

function promptDaLacuna(l, arquivo) {
  return [
    REGRAS,
    '',
    'YOUR ROLE: answer one question the first maps left open. The maps are in ' + N + ' (mapa-*.md): read the ones that touch your question first, then the code.',
    'THE KEY TO RETURN: ' + l.chave,
    'YOUR FILE: ' + arquivo,
    '',
    'THE QUESTION: ' + l.pergunta,
    'WHY THE PLAN NEEDS IT: ' + l.por_que,
    'WHERE TO START: ' + l.onde_olhar,
    '',
    'Write the file in English, with these sections: # Lacuna: <the question in a few words>; ## Answer (the facts, each with path:line); ## What the maps got wrong or left out (name the map); ## Implications for the plan (suggestions, marked as such). The last line of the file must be exactly: <!-- fim -->',
    'IF YOU ARE A RETRY: if your file already exists and its last line is <!-- fim -->, read it and return the digest from it.',
    'WHAT YOU RETURN is the digest of your file, standing alone.',
  ].join('\n')
}

async function tentar(fazer, vezes) {
  for (let i = 0; i < vezes; i++) {
    try {
      const r = await fazer()
      if (r) return r
    } catch (e) {
      log('an agent threw: ' + String((e && e.message) || e).slice(0, 200))
    }
    if (i < vezes - 1) log('retrying (attempt ' + (i + 2) + ' of ' + vezes + ')')
  }
  return null
}

function limpa(texto) {
  return String(texto).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 48)
}

phase('Mapear')
const brutos = await parallel(AREAS.map(a => () =>
  tentar(() => agent(promptDaArea(a), { label: 'mapa:' + a.key, phase: 'Mapear', schema: DIGEST }), 3)
))
const mapas = brutos.map((d, i) => d || { chave: AREAS[i].key, falhou: true })
const falhos = mapas.filter(m => m.falhou).map(m => m.chave)
if (falhos.length) log('maps that failed after 3 attempts: ' + falhos.join(', '))
log('maps written: ' + (mapas.length - falhos.length) + ' of ' + mapas.length)

const rodadas = []
for (let r = 1; r <= 2; r++) {
  const critica = await tentar(() => agent(promptDoCritico(r), { label: 'critico:' + r, phase: 'Criticar', schema: CRITICA }), 3)
  if (!critica) {
    log('the critic failed in round ' + r)
    break
  }
  const abertas = critica.contradicoes.filter(c => !c.resolvida).map(c => ({
    chave: 'contradicao-' + limpa(c.chave),
    pergunta: 'Maps disagree, or a map disagrees with the code: ' + c.o_que + ' (maps: ' + c.mapas + '). Establish from the code which is right.',
    por_que: 'the plan must not carry a wrong fact',
    onde_olhar: c.mapas,
  }))
  const pendentes = critica.lacunas.map(l => ({ chave: limpa(l.chave), pergunta: l.pergunta, por_que: l.por_que, onde_olhar: l.onde_olhar })).concat(abertas)
  log('round ' + r + ': ' + critica.lacunas.length + ' gaps, ' + abertas.length + ' open contradictions')
  if (!pendentes.length) {
    rodadas.push({ rodada: r, critica, respostas: [] })
    break
  }
  const respostas = await parallel(pendentes.map(l => () =>
    tentar(() => agent(promptDaLacuna(l, N + '/lacuna-' + r + '-' + l.chave + '.md'), { label: 'lacuna:' + l.chave, phase: 'Completar', schema: DIGEST }), 3)
  ))
  const semResposta = pendentes.filter((l, i) => !respostas[i]).map(l => l.chave)
  if (semResposta.length) log('gaps left unanswered in round ' + r + ': ' + semResposta.join(', '))
  rodadas.push({ rodada: r, critica, respostas: respostas.filter(Boolean), semResposta })
}

return { mapas, rodadas }
