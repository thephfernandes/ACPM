export const meta = {
  name: 'linha-desenho',
  description: 'Design of the production-line redesign from the discovery maps: eight design notes (three competing proposals for the core data flow), adversarial reviews of each, revisions, and a reconciliation',
  phases: [
    { title: 'Desenhar', detail: 'one designer per topic; three architects and a synthesis for the core' },
    { title: 'Revisar', detail: 'reviewers try to break each design against the code and against the request' },
    { title: 'Fechar', detail: 'each design is revised with the findings that hold' },
    { title: 'Conciliar', detail: 'one pass over all notes: contradictions, file ownership, numbers, questions' },
  ],
}

const W = '~/ACPM/.redesenho/wt-plano'
const N = '~/ACPM/.redesenho/notas'

const REGRAS = `You are part of the DESIGN of a large redesign of AutoEscala (the ACPM flight school's daily scheduling app: vanilla ES modules, no build step, no dependencies, GitHub Pages, Supabase). A discovery already mapped the code; you design from those maps and check the code when a decision depends on a detail. Your output is working material for the plan that will be written into docs/PLAN.md and shown to Pedro for approval. Nothing is implemented now.

WHERE TO WORK
- The code is the git worktree at ${W} (branch linha-0-plano, at upstream/main 48875e3). Use absolute paths under it.
- The session's current directory, ~/ACPM, is a STALE checkout: never read code from it. The only thing you use there is the notes folder ${N}.
- Change NOTHING in the worktree (no edits, no git command that writes, no npm install). Never run npm run test:db, never use the network, never touch Supabase. You may run read-only commands (grep -n, wc, sed -n, git log, git show) and, when an experiment is the fastest way to settle a fact, node -e on pure modules or on a scratch copy OUTSIDE the worktree (under /tmp or the notes folder), never writing inside the worktree.
- You write at most one file, the one named in your brief, inside ${N}. If writing is refused, say so in what you return and put the content there.

READ FIRST, IN THIS ORDER
1. ${N}/pedido.md: Pedro's request, all of it. It is the specification.
2. ${N}/referencias-visuais.md: the two visual references, in words.
3. ${N}/posicao.md: the orchestrator's working position after the discovery: facts the design has to live with (section A) and default positions (section B). A position is a default, not a ruling. Follow it where the evidence supports it; where the maps or the code show it is wrong, costly or incoherent, say so with the evidence and design the alternative.
4. The discovery notes named in your brief, in ${N}. A note named for full reading is read from top to bottom. Every statement in them carries path:line evidence; when a decision of yours rests on one of those facts and the stakes are high, open the code and check it.

RULES OF THE DESIGN
- Pedro's guardrails hold: runAllocationEngine stays a pure function and its goldens change only in commits whose purpose is a rule change; gravarAlteracao stays the only way events change the cadastro and the day, and nothing is saved before the date's data is read; data-format steps never delete fields and the server refuses older formats; personal data stays out of CSV, PDF, BI and the History; tests use only fictitious names and weights; what is replaced is deleted (never two versions of a screen); no build step and no new dependency; identifiers, file names and commit messages in Portuguese, as the repo does.
- The repo's working rules hold: tests first; the lint and npm test green on every step; an independent review per step; database tests only on the preview project; migrations applied to the preview, then production, before the merge (say so explicitly when a step needs a different order, and why).
- Where the request conflicts with the code, do not guess and do not smooth it over: record the conflict, the default the plan implements, and what Pedro can choose instead. Every question for Pedro carries the default the work proceeds on.
- Be concrete. Name files, functions, ids, fields, format numbers, migration files, tests. An implementer who reads only your note must be able to start.
- Think of the one operator who builds the escala every day: for anything that changes her routine, count what she does before and after.`

const FORMATO_DA_NOTA = `THE NOTE (write it in English; identifiers and UI labels in Portuguese, verbatim), with these sections in this order:
# Desenho: <topic>
## 1. Decisions (numbered; for each: the decision, why, the evidence as a map section or path:line, and the alternative rejected with the reason)
## 2. How it works (data shapes with field names, function signatures, screen structure, states: enough for an implementer)
## 3. Where each existing control goes (a table: control today (label, id or data attribute) | destination (stage, screen, pane) | kept, moved, replaced by or removed). Only for the screens your topic owns; write 'not applicable' otherwise.
## 4. Data-format steps and migrations (the number or the migration file name, what changes, the conversion, its tests, the deploy order)
## 5. Files created, changed and deleted, by step (the step names are F0, F1, F2, F3, A, B, C, D, E, G, H, I as in posicao.md and the request)
## 6. Tests (what is written first; which existing tests change, with file names and rough counts)
## 7. Departures from Pedro's request (a table: what the request says | what this design does | why | what Pedro can choose instead)
## 8. Questions for Pedro, each with the default this design implements
## 9. Risks, and what would make this design wrong
The last line of the file must be exactly: <!-- fim -->
Tables and lists over prose. Do not pad, and do not restate the maps: cite them.

WHAT YOU RETURN (the structured output) is the digest of your note. It must stand alone.`

const DESENHO = {
  type: 'object',
  properties: {
    chave: { type: 'string', description: 'the topic key given in the brief' },
    arquivo: { type: 'string', description: 'absolute path of the note written, or an empty string if writing was refused' },
    resumo: { type: 'string', description: 'up to 400 words: the design in brief' },
    decisoes: {
      type: 'array',
      description: 'up to 24 decisions, most important first',
      items: {
        type: 'object',
        properties: {
          tema: { type: 'string' },
          decisao: { type: 'string' },
          porque: { type: 'string' },
        },
        required: ['tema', 'decisao', 'porque'],
      },
    },
    desvios: {
      type: 'array',
      description: 'departures from the letter of the request',
      items: {
        type: 'object',
        properties: {
          pedido: { type: 'string', description: 'what the request says' },
          proposta: { type: 'string', description: 'what the design does instead' },
          porque: { type: 'string' },
        },
        required: ['pedido', 'proposta', 'porque'],
      },
    },
    perguntas: {
      type: 'array',
      description: 'questions for Pedro, most important first',
      items: {
        type: 'object',
        properties: {
          pergunta: { type: 'string' },
          padrao: { type: 'string', description: 'the default the design implements' },
        },
        required: ['pergunta', 'padrao'],
      },
    },
    contra_a_posicao: {
      type: 'array',
      description: 'where the design disagrees with posicao.md',
      items: {
        type: 'object',
        properties: {
          posicao: { type: 'string' },
          objecao: { type: 'string' },
          evidencia: { type: 'string' },
        },
        required: ['posicao', 'objecao', 'evidencia'],
      },
    },
    riscos: { type: 'array', items: { type: 'string' } },
    achados_recusados: {
      type: 'array',
      description: 'only for a revision: review findings rebutted, each with the evidence; empty otherwise',
      items: { type: 'string' },
    },
  },
  required: ['chave', 'arquivo', 'resumo', 'decisoes', 'desvios', 'perguntas', 'contra_a_posicao', 'riscos', 'achados_recusados'],
}

const REVISAO = {
  type: 'object',
  properties: {
    veredito: { type: 'string', enum: ['solido', 'com-ressalvas', 'refazer'] },
    achados: {
      type: 'array',
      description: 'concrete findings, most serious first',
      items: {
        type: 'object',
        properties: {
          gravidade: { type: 'string', enum: ['bloqueia', 'importante', 'menor'] },
          onde: { type: 'string', description: 'the section and decision of the note' },
          problema: { type: 'string' },
          evidencia: { type: 'string', description: 'path:line, a map section, a line of the request, or the experiment run' },
          correcao: { type: 'string', description: 'what the note should say instead' },
        },
        required: ['gravidade', 'onde', 'problema', 'evidencia', 'correcao'],
      },
    },
    faltou: { type: 'array', items: { type: 'string' }, description: 'things the brief or the request asks that the note does not cover' },
  },
  required: ['veredito', 'achados', 'faltou'],
}

const CONCILIACAO = {
  type: 'object',
  properties: {
    arquivo: { type: 'string' },
    resumo: { type: 'string', description: 'up to 500 words: the design as a whole and how solid it is' },
    contradicoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          entre: { type: 'string', description: 'which notes' },
          o_que: { type: 'string' },
          resolucao: { type: 'string', description: 'how the reconciliation settles it, or PENDENTE when the orchestrator must decide' },
        },
        required: ['entre', 'o_que', 'resolucao'],
      },
    },
    colisoes: {
      type: 'array',
      description: 'files that two steps of the parallel phase would both change',
      items: {
        type: 'object',
        properties: {
          arquivo: { type: 'string' },
          passos: { type: 'string' },
          saida: { type: 'string', description: 'how to remove the collision' },
        },
        required: ['arquivo', 'passos', 'saida'],
      },
    },
    numeros: { type: 'string', description: 'the format numbers and the migration files, in order, in a few lines' },
    pendentes: { type: 'array', items: { type: 'string' }, description: 'what the orchestrator must decide before the plan is written' },
    perguntas_principais: {
      type: 'array',
      description: 'the ten or so questions for Pedro that most change the work, each with its default',
      items: {
        type: 'object',
        properties: {
          pergunta: { type: 'string' },
          padrao: { type: 'string' },
        },
        required: ['pergunta', 'padrao'],
      },
    },
  },
  required: ['arquivo', 'resumo', 'contradicoes', 'colisoes', 'numeros', 'pendentes', 'perguntas_principais'],
}

const NUCLEO = {
  key: 'nucleo',
  titulo: 'The core data flow: from approved pedidos to the engine input, and the operator restrictions',
  leitura: `Read in full: mapa-demanda.md, mapa-restricoes.md, lacuna-1-pedido-principal-e-extras.md, lacuna-1-motivos-antes-do-motor.md. Read by section: mapa-pedidos.md (sections 2, 4, 5.3, 5.4, 5.8 and 6), mapa-motor.md (sections 5.1, 5.6, 5.8 and 6), mapa-dados.md (sections 2, 5.2, 5.4 and 5.8), lacuna-2-itens-abertos-do-plan-md.md (the items that must be restated).`,
  perguntas: `1. The identity of a request: how each approved pedido keeps a stable mid and flight key across loads, saves, cancellations and re-approvals, within the bounds of mid (6 digits in painel_do_dia, 1e9 in the saved-schedule validator) and with proximoMid in the same number space.
2. Where operator restrictions live (the chosen instructor, the priority, another resource type, another duration, another course mission with its confirmation, a loosened or moved time, the exclusion) and how each is edited once the Demanda table is gone. Say exactly which stored fields carry each.
3. Bookings and the other requests that have no pedido ('+ Agendar voo', '+ missão', 'Pôr um aluno na demanda', Mover and Encaixar): what each becomes, what the booking dialog writes, and what happens to its undo.
4. The reconciliation: the exact rules for adding and removing, when it runs, who can trigger it, what is saved, the History entry and whether it has a revert; what a read-only profile sees; what happens on an approved schedule; what happens to a flight in progress whose pedido is cancelled.
5. The course mission: when it is bound, what shows when the program or the results now say otherwise, the closed-course and out-of-order confirmations, the AV PROF. and SOLO order case, the code lock of the Cursos tab.
6. The pure module: file name, exported functions with inputs and outputs, what it reuses from js/agenda.js, js/rules.js, js/progresso.js and js/candidatos.js, and its unit tests, written first. How it stays in real use from workstream E on, so the unused-exports lint passes.
7. Why a pedido cannot be scheduled: the reasons the module computes before the engine, how the engine's rejections are matched to requests after it without changing the engine's alerts (the goldens), and what the screen shows for each.
8. Every code site that writes a request field today (the sixteen sites of mapa-demanda), the nine History revert kinds, 'Limpar demanda', 'Tirar da escala', 'Voa', the extras, the take-off times editor's adjustment of requests: what each becomes.
9. The cut-over (data format 28): stored days of past and future dates, the importadas lists, hand-made requests already stored, tabs still open on the old version, local mode, two operators at once, the Secretaria cancelling at any time. And the interim between D and E and G, when approval exists but the Demanda table still does.
10. Where each of the ten columns of the Demanda table lives afterwards: a field of the pedido, something derived, or an operator restriction, with the reason for each.`,
  lentes: [
    { id: 'a', nome: 'the smallest change that is airtight', instrucao: `Your lens: the smallest change. Start from posicao.md B1: the day keeps dia.pedidos in today's stored shape, each record born from an approved pedido or from a booking, and a reconciliation adds and removes. Make that design airtight: find every way it breaks (the gap notes list several: nothing keeps the main request off, proximoMid, the label-joined rejections, fields written ON the request by bookings) and close each one with the least new machinery.` },
    { id: 'b', nome: 'truly derived', instrucao: `Your lens: a truly derived stage. Design the version in which the day stores only what cannot be derived: the binding of each pedido to its mid, and the operator restrictions keyed by pedido (or by flight key), in their own structure; the requests the engine reads are rebuilt from the approved pedidos, the cadastros and those two things at every load. Design it fully and cost it honestly: separar and juntar, the sixteen writers, the reverts, the stored days. Say where it is better than a materialised design and where it is worse.` },
    { id: 'c', nome: 'the operator and production first', instrucao: `Your lens: the operator's day and the data already in production. Start from the daily routine (pedidos arrive, the operator builds tomorrow's escala after 13:00, approves, exports, then runs the day: statuses, results, late changes) and from what is stored today (days of past and future dates, pins, statuses, results keyed by flight key, History reverts). Design the flow that is safest to cut over and simplest to operate. You are free to choose any storage design; judge every choice by what the operator does and by what can go wrong with real data.` },
  ],
}

const TOPICOS = [
  {
    key: 'casca',
    titulo: 'The shell (F0 and F1): pipeline navigation, three panes, the right rail and the single open date',
    leitura: `Read in full: mapa-casca.md, lacuna-1-css-por-tela.md, lacuna-1-importadores-do-que-sai.md. Read by section: mapa-outras-abas.md (section 5 and the conflicts), mapa-avisos.md (sections 5.1, 5.4 and 5.5), mapa-testes-e-docs.md (sections 5.2, 5.3 and 5.4), lacuna-2-exportacoes-que-a-tv-usa.md, lacuna-1-textos-que-citam-telas.md (skim).`,
    perguntas: `1. The pipeline as the primary navigation: the markup and its accessibility (landmark, what each card and each row is, aria-current, keyboard), the connector dots and lines with no inline script and inside the CSP, the cards per profile (Operador, Administrador, Gestor, Secretaria), what a card opens and what a row opens, and how it behaves at narrow widths and on phones.
2. The secondary navigation: where Alunos, INVAs (the tab says 'Instrutores' today: which word stays), Recursos, Cursos, the Rodízio, BI, the Painel view, the Histórico, the Manual, Minha conta and Usuários, the theme switch, Sair, the local-mode profile select and 'Compartilhar' go, and the three notices at the top of main. Decide the second-row 'Cadastros' card of posicao.md B4 or a better arrangement.
3. The three panes: the CSS (grid, container queries, which pane scrolls and what that does to code that assumes the window scrolls), how a screen declares that it spans the list and detail panes, and the cap. Give the pane widths at viewports of 1,280, 1,440, 1,600 and 1,920 px for at least two options (keep 1,280; move to about 1,600 with a rail of about 320) and check each wide screen's minimum width and the Painel's one-list rule in each.
4. The rail: the month calendar (today, the open date, the next month's first days, Sundays, days closed for pedidos, the per-day pedido count and who may see it, keyboard and screen-reader behaviour), the line naming the open date, and the notification list (its items come from the adapter designed in the escala-aprovar topic: define the container, the item markup and the empty state). What replaces #dt, #dt-ant, #dt-prox, #dt-rotulo and #dt-rel; what happens to ?data= and abrirData; the rule for who may change the date (the local-mode Gestor); the collapsed rail (a date button) and at which widths.
5. The other date controls: the BI's 'Data base' and the Agenda's own day. Decide and state the consequence of each.
6. Phones and 320 px: list first, the detail as a second view, the rail as a date button; the back gesture and the focus.
7. What replaces show() and the tag selectors (section, nav, header, main), whether the open screen and the selected item go into the URL, and the per-profile opening screen and date.
8. Tokens to add (a selected row, text on ok and warning fills, pending and running, avatar hues) with contrast figures in both themes, and the icons to add to the sprite.
9. The drawers and dialogs: which go and which stay under 'no modal or pop-up for viewing or editing a record', and how the Histórico drawer lives with a right rail.
10. Step F0 (no visible change) and step F1: exactly what each contains, in which commits; what the app looks like after F1 with the old screens inside the new shell; the test helpers F1 rewrites (abrir, irPara, the checkers' roots, the cap test), and the Manual and glossary changes F1 itself forces. painel.html must not change.`,
  },
  {
    key: 'lista',
    titulo: 'The master-detail list component (F2) and editing in place',
    leitura: `Read in full: mapa-alunos.md, lacuna-1-onde-invas-e-recursos-sao-listados.md. Read by section: mapa-invas.md (section 3), mapa-recursos.md (section 3), mapa-casca.md (sections 5.5 to 5.8), mapa-testes-e-docs.md (section 5.4), lacuna-1-importadores-do-que-sai.md (what binds the cadastros screens), mapa-dados.md (section 5.4, the write path and PT409).`,
    perguntas: `1. The component's API with no framework: the modules, the pure builders and the small controller, the row model (status dot, avatar with initials, up to three lines, the right-aligned meta, the active switch), group headers (collapsible, and selectable when a group has a detail of its own), the 'N de M' count and the empty state.
2. Search and filters: chaveDeBusca, the debounce, the reuse of the multi-value filter component, the toolbar filter that shows or hides inactive items, and how filter state survives redraws.
3. Selection, keyboard and screen readers: what the list and a row are (a list of buttons, a listbox, something else), the arrow keys, Home and End, Enter, where focus goes on selection, how the switch lives inside a row without nesting interactive elements, and how the selected row is announced.
4. Focus keeping across redraws (QUEM_E, DA_LINHA, DO_TIPO and trocarConteudo in js/dom.js): what the component reuses.
5. Editing in place in the detail pane: how a 'Label: value' line becomes editable and saves (roster fields save on change through gravarAlteracao; personal data are one versioned save of five fields), validation and error messages, the read-only lock and the lock of before the date opens inside a pane, and what a PT409 on the one-document cadastro does to someone editing in place (propose how to make that conflict survivable).
6. Phones: the list, then the detail as a second view; the way back; focus; the browser's back button.
7. Whether the selected item is kept in the URL or in memory, and what a reload and a date change do to the selection.
8. The split of the modules that Alunos and Instrutores share today (js/views/cadastros.js, js/eventos/cadastros.js, js/views/dados-pessoais.js) so that workstreams A and C do not collide: the new files and what F2 moves.
9. The collapsible sections of the detail and the icon actions at the right of the title.
10. Tests first: the unit tests of the pure builders, and the e2e for keyboard, accessible names, 44 px targets and 320 px; how the phone and accessibility checkers find the panes.`,
  },
  {
    key: 'cadastros',
    titulo: 'Alunos, INVAs and Recursos as master-detail screens (A, B, C), deactivation, permissions and the habilitações registry (F3)',
    leitura: `Read in full: mapa-alunos.md, mapa-invas.md, mapa-recursos.md, lacuna-1-onde-invas-e-recursos-sao-listados.md. Read by section: mapa-banco.md (sections 5.4 and 5.7), mapa-dados.md (sections 5.2, 5.3 and 5.7), mapa-outras-abas.md (how results are registered; the Rodízio).`,
    perguntas: `1. For each of Alunos, INVAs and Recursos: what a list row shows per profile (the Gestor has no CANAC), and the detail pane section by section and field by field (label, where it is stored, who edits it, how it saves). The per-date values and the cadastro values must be told apart on screen.
2. The destination of every control of today's #s-alu, #s-ins and #s-rec and of the drawers #painel-instrutor and #painel-dados.
3. Deactivation: the flag (posicao.md B5), its meaning in each of the places that list instructors and resources (the gap note has 20 and 16 rows: give an explicit decision per place), the same for students, what happens to an inactive student's pedidos and to pins and chosen instructors that point at an inactive INVA or resource, the Rodízio place and the hangar position of an inactive one, the wording on screen (the engine already says 'ativo' for 'Vem'), and how deleting differs and whether it stays.
4. Alunos: 'nome completo' (it does not exist: where it should live), 'missão anterior' and 'missão atual' (what exactly each shows, including several released missions), registering a result in the detail (the RPC, who may, what it means without a flight, how a student is placed in the middle of a course), and the search by name or CANAC.
5. Permissions: the Secretaria no longer edits (students and instructors: one function serves both). The migration (split the read and write predicates, drop the 3-argument overload), the pgTAP cases to change and to add, the fake server, js/perfis.js, the e2e tests, what she still sees, and the deploy order when a permission is tightened. The Gestor stays read-only and without personal data.
6. F3, the habilitações registry: the groups move into js/habilitacoes.js; a resource gets a list of required ids of the same registry; the conversion of habilitacaoPropria; normalizarFrota; the places that decide whether an INVA may operate a resource; the proof that no golden changes; orphan aviao: ids. Say exactly what data-format step 26 contains (the inativo flags for the three cadastros and the resource requirement list) and which whitelists it touches.
7. Recursos: the list grouped by category with the category's detail holding the Horários de decolagem editor (its draft and conflict rules), where 'Ordem no hangar' lives, the per-date section (Disponível, the hours until the inspection) and the cadastro section (type, attributes, required habilitações), '+ Novo recurso' and 'Retirar'.
8. INVAs: the per-date section (Vem and the ranges, whose editor the disponibilidade topic designs), the habilitações edited in place, the hours and the legal limits, the personal data, and 'preferences', which do not exist on the instructor's side. Today's availability grid shows everyone at once: say what replaces that overview in the daily routine and what it costs her.
9. The decision the request leaves open: the 'Disponibilidade do dia | Cadastro' split, kept inside the detail or dissolved into two labelled sections.
10. Files and tests per workstream A, B and C, assuming F2 has split the shared modules.`,
  },
  {
    key: 'disponibilidade',
    titulo: 'INVA availability as ranges (C) and the end of Janelas de operação (B)',
    leitura: `Read in full: mapa-motor.md, mapa-invas.md. Read by section: mapa-recursos.md (section 5.4), mapa-restricoes.md (the reverts that carry aw; the booking dialog's 'Marcar disponível'), mapa-dados.md (section 5.3), mapa-testes-e-docs.md (the goldens, their hashes and exemplo-estado.json; the Manual's janelas block), mapa-demanda.md (the other roles of WIN).`,
    perguntas: `1. The stored shape of the ranges (the field name, minutes, ordering, overlaps, bounds), per date, and the conversion from aw. posicao.md B6 proposes ONE shape (earliest and latest mission start) and one format number for both commits: test that idea hard. Show with the nine windows of WIN that commit 1 can read start ranges with today's meaning while the ranges are aligned to the windows, or show where it fails and give the alternative.
2. Commit 1: the reading rule, the single helper that reads the ranges and falls back to aw when a state has none (the golden inputs, exemplo-estado.json, old History payloads), every caller, and the proof obligation: the golden files and their hashes byte-identical. Say exactly how the golden test and the generator stay untouched.
3. Commit 2: the new rule (a mission may START inside a range), which goldens change and how the diff is reviewed, the engine texts that mention windows, and whether any stored number needs converting.
4. The History: reverts that keep aw (validarReversao demands nine booleans) and what keeps the old '↶ Desfazer' buttons working.
5. Every writer of aw today and what each becomes: the grid's checkboxes, 'Aplicar turno', the copy to a new date, the booking dialog's 'Marcar disponível', the reverts. And what happens to 'Vem' (on).
6. The editor of the ranges in the INVA detail's 'Nesta data' section: the controls, the allowed times (free minutes or the take-off times), validation, presets, accessibility and phones. Count what marking tomorrow's availability for every INVA costs before and after.
7. The other roles of the nine windows that stay (the student's manhã, tarde and noite, the Ground start times, the default take-off lists, the grouping in the Escala and the PDF) and the Manual and glossary texts and tests that change.
8. Janelas de operação: the section leaves Recursos. Decide where closing a period for one date lives afterwards (posicao.md B6 proposes an operator restriction of the date writing the same dia.win) and which step owns that markup, so no step leaves the app without a control to reopen a closed window. Decide whether win is still copied to new dates. List every reader that stays. Cost the alternative of dropping the capability (it is the only per-date closing that reaches Ground classes, the Noturno and the Voo Solo).
9. The e2e 'data loaded' signal, which is the first Janelas checkbox today, and the History texts 'Janela HH:MM ativa|inativa'.
10. Files and tests, by commit.`,
  },
  {
    key: 'pedidos',
    titulo: 'Pedidos (D): the rename, the approval state, the preferences on a pedido and the page',
    leitura: `Read in full: mapa-pedidos.md, mapa-banco.md, lacuna-1-pendencias-de-implantacao-registradas.md. Read by section: mapa-dados.md (sections 5.1, 5.4 and 5.8), mapa-avisos.md (section 5.4), mapa-demanda.md (section 5.4), lacuna-1-textos-que-citam-telas.md (the Agenda texts). Note posicao.md A15: the server state recorded there comes from this session's own history and overrides the gap note's inference.`,
    perguntas: `1. The rename: what is renamed (screen text, modules, the table) with the counts and the cost of each level, and the vocabulary afterwards, since 'pedido' already names the day's request in code and on screen, and 'aprovado' already names the approved schedule and a course result.
2. The states of a pedido and the transitions, by profile: who registers, approves, withdraws an approval, cancels; a pedido the Operador registers himself; an exception pedido; cancelling after approval; whether refusing needs its own state.
3. The migration: the columns, the RPC signatures, the role checks, the error codes and hints in the style of the existing ones, RLS, idempotency, and the legacy 9-argument overload. Give the file name. List the pgTAP cases to write first and the existing ones that change.
4. The rules to keep and the gaps the maps found: the deadline (13:00 of the previous operating day; Saturday 10:00 for Monday), the Exceção da Coordenação accepting a Sunday or a past date, the limit of 6 local flights (what it counts once approval exists).
5. The preferences: posicao.md B2 proposes two nullable columns (a second preference and an availability) so the Demanda's three time columns become fields of the pedido. Design the columns, their validation, the form, what the local-flight limit counts, and what Processamento maps them to (p1, p2, jan). Cost the alternative of keeping one exact time.
6. The page in three panes: the list rows and their states, the filters, the detail of a pedido (a pedido cannot be edited today: what the detail offers), the form for a new pedido in the middle pane, what each profile sees, the destination of every control of #s-age, and what replaces calendarioHTML and selo-age.
7. Freshness: pedidos are read only on a few events of this browser today. Say how the operator learns of a pedido registered or cancelled on another computer.
8. The per-day counts for the rail's calendar: the RPC, who may call it, the 1,000-row cap it removes.
9. The cut-over and the interim: pedidos already imported (the importadas lists of stored days) become approved, how and when; between D and G the Demanda's import consumes approved pedidos only; what the live app does between the production migration and the merge.
10. The fake server, local mode and the other copies of the rules; the files and tests of workstream D.`,
  },
  {
    key: 'escala-aprovar',
    titulo: 'The Escala and Aprovar stages (H), the pipeline sub-task states and the rail notifications',
    leitura: `Read in full: mapa-escala.md, mapa-avisos.md, mapa-restricoes.md. Read by section: mapa-motor.md (section 5.5 and the conflicts about the criteria), mapa-outras-abas.md (the Painel, how results are registered), lacuna-1-motivos-antes-do-motor.md (skim), mapa-demanda.md (section 3, the operator-only fields).`,
    perguntas: `1. The Escala stage in the three panes: what the list pane and the detail pane hold, how the four views (Lista, Por recurso, Por instrutor, Painel) fit, and the destination of every control of today's #s-esc (both bars, #out, the map pop-up, the Sugestões drawer, the status dialog).
2. The operator restrictions as the stage's first input: one place that lists them (pins by kind, chosen instructors, bookings, priorities, another resource type, closed periods) with the way to release each, and where the operator sets a restriction on a pedido-born flight now that the Demanda table is gone (the instructor, the priority, the resource type, the mission, the duration, the time), including for a pedido the engine could not place.
3. The criteria as the stage's configuration: the final group names, option labels and order. The request's labels 'Recurso' and 'Não considerar' misdescribe the stored values aviao and fixos (see the maps): propose the wording options, keep the stored ids, and list what a label change touches.
4. The request says operator restrictions override any rule; today a pin is never moved but is checked and flagged, and a booking that would conflict is refused. State today's meaning precisely and what 'override' would change, as a question with its default.
5. The Aprovar stage: its list of pending items by kind (rejections, conflicts, warnings) and where each is resolved, approving with pending items (confirm, never block), reopening, who and when, and the exports with a record of them (the data shape, who writes it, when it is stale). What follows approval (statuses, results, late bookings, the Painel) and where it lives.
6. The pipeline: for each of the four cards (and the Cadastros card if the shell keeps it), the final rows. For each row: the real condition behind each state (done, failed, pending, running, needs attention), the value shown, the click target, and the profiles that see it. Start from the request's first list and from what the code can back (mapa-avisos section 5.3): rename, move or drop what it cannot.
7. The pure adapter that computes those rows and the rail's notification items from S, the engine's result and the date's pedidos, with no new field on the engine's alerts: the file name, the functions, their tests.
8. The rail's notification items: for each, the source, the severity, the time when there is one, the title, the second line and the click target. Include pedidos waiting for approval, approved pedidos not yet in the escala, rejections, conflicts, warnings, resources stopped or near the inspection, and the three notices at the top of main.
9. Accessibility of the counts (today's badges are numbers with a mouse-only title).
10. Files and tests of workstream H, and what G must have delivered before it.`,
  },
  {
    key: 'entrega',
    titulo: 'Delivery: the steps, the files each owns, the order, the numbers, the tests and the deploys',
    leitura: `Read in full: mapa-testes-e-docs.md, lacuna-1-importadores-do-que-sai.md, lacuna-1-css-por-tela.md. Read by section: mapa-dados.md (section 5.3), mapa-banco.md (sections 5.5, 5.7 and 5.8), mapa-casca.md (section 5.10), lacuna-2-exportacoes-que-a-tv-usa.md, lacuna-1-pendencias-de-implantacao-registradas.md, lacuna-1-textos-que-citam-telas.md, lacuna-2-itens-abertos-do-plan-md.md. Note posicao.md A15 on the server state.`,
    perguntas: `1. The list of steps (F0, F1, F2, F3; A, B, C, D, E in parallel; G, H, I), adjusted where the discovery justifies it. For each: the branch name (linha-f0-… style), its purpose in one line, what the app looks like after it (it must be coherent and never hold two versions of a screen), and what it depends on.
2. File ownership: for every file shared by several steps (index.html by region, the stylesheets, js/eventos/registro.js, js/migracoes.js, js/main.js, js/actions.js, js/eventos/historico.js, js/dias.js, js/glossario.js, the Manual, test/e2e/fixtures.js, celular.spec.js, acessibilidade.spec.js, app.spec.js, test/e2e/supabase-falso.js, test/helpers/estado.js and montar.js), ONE owner per step, and how the seams of F0 (a redraw registry, the save before the redraws, the split of the shared cadastros modules, one stylesheet per screen) remove the collisions of the parallel phase. Say which collisions remain and how the merge order handles them.
3. The format numbers (posicao.md B8: 26, 27, 28, 29) and why the order is safe; the literal ESQUEMA assertions in tests; the cost of each number (the first Operador opening rewrites every stored day).
4. The migrations: file names with timestamps in the order they reach the shared preview, what each contains, which are expand-only and which tighten something, and the go-live checklist of each step that has one.
5. Tests: what 'green' means for a step (the lint and npm test), what each step writes first, and the size of the e2e rewrite per step (spec files and rough test counts), given that most tests reach the app through the helpers in test/e2e/fixtures.js.
6. Parallel worktrees: the port, node_modules and the Playwright browsers per worktree, the shared preview database, and how the branches rejoin (the merge order and who resolves what).
7. The Manual, the glossary, the README and the user-facing texts that name screens: which step changes which, since their tests force the change in the same PR.
8. The deletion ledger: every file, function, CSS range, test and Manual section that is deleted, and in which step, so nothing replaced is left behind and nothing is deleted before its replacement exists.
9. Release: the PRs are stacked as the abas-* branches were; say what reaches production at each merge, propose the release waves, and name the steps after which the operator's routine changes.
10. The independent review of each step, and the risks of the delivery as a whole (the size of the stack, the cut-over in G, rollback).`,
  },
]

function promptArquiteto(l) {
  return [
    REGRAS,
    '',
    'YOUR ROLE: one of three architects designing the SAME topic independently, each with a different lens. Another agent will compare the three proposals and write the final design, so make yours complete, honest about its costs, and easy to compare.',
    'TOPIC: ' + NUCLEO.titulo,
    'THE KEY TO RETURN: nucleo-' + l.id,
    'YOUR NOTE: ' + N + '/desenho-nucleo-' + l.id + '.md',
    '',
    'YOUR LENS (' + l.nome + '). ' + l.instrucao,
    '',
    'DISCOVERY NOTES. ' + NUCLEO.leitura,
    '',
    'QUESTIONS YOUR DESIGN MUST SETTLE:',
    NUCLEO.perguntas,
    '',
    FORMATO_DA_NOTA,
    'IF YOU ARE A RETRY: if your note already exists and its last line is <!-- fim -->, read it and return the digest from it.',
  ].join('\n')
}

function promptSintese(propostas) {
  return [
    REGRAS,
    '',
    'YOUR ROLE: write the final design of the core from three independent proposals. Three architects designed the same topic with different lenses: the smallest change that is airtight (desenho-nucleo-a.md), a truly derived stage (desenho-nucleo-b.md), and the operator and production first (desenho-nucleo-c.md), all in ' + N + '. Read the three in full, then the discovery notes below where the proposals disagree, then the code where the disagreement is about a fact.',
    'TOPIC: ' + NUCLEO.titulo,
    'THE KEY TO RETURN: nucleo',
    'YOUR NOTE: ' + N + '/desenho-nucleo.md',
    '',
    'METHOD',
    '1. Compare the three on: fidelity to the request (above all: no data of its own; the engine and its goldens untouched; where each Demanda column lives); the risk to data already stored in production; the size of the change (files, the request-writing sites, the reverts, the tests); what the operator does every day; how reversible the cut-over is; how it works in local mode and with two operators.',
    '2. Choose. The final design may be one proposal or a combination, but it must be ONE coherent design. Say in section 1 what you took from each proposal and what you rejected, with the reason.',
    '3. Settle every one of the questions below. Where the three proposals all left something open, settle it yourself from the maps and the code.',
    '4. Start section 1 with a short comparison table of the three proposals on the criteria above.',
    '',
    'The digests the three architects returned (their notes are the full versions):',
    JSON.stringify(propostas, null, 1),
    '',
    'DISCOVERY NOTES. ' + NUCLEO.leitura,
    '',
    'QUESTIONS THE FINAL DESIGN MUST SETTLE:',
    NUCLEO.perguntas,
    '',
    FORMATO_DA_NOTA,
    'IF YOU ARE A RETRY: if your note already exists and its last line is <!-- fim -->, read it and return the digest from it.',
  ].join('\n')
}

function promptDesenho(t) {
  return [
    REGRAS,
    '',
    'YOUR ROLE: the designer of one topic of the redesign. Other designers work on the other topics at the same time (the core data flow, the shell, the list component, the cadastros, the availability ranges and Janelas, Pedidos, Escala and Aprovar, the delivery); where your topic touches theirs, follow posicao.md and say what you assume.',
    'TOPIC: ' + t.titulo,
    'THE KEY TO RETURN: ' + t.key,
    'YOUR NOTE: ' + N + '/desenho-' + t.key + '.md',
    '',
    'DISCOVERY NOTES. ' + t.leitura,
    '',
    'QUESTIONS YOUR DESIGN MUST SETTLE:',
    t.perguntas,
    '',
    FORMATO_DA_NOTA,
    'IF YOU ARE A RETRY: if your note already exists and its last line is <!-- fim -->, read it and return the digest from it.',
  ].join('\n')
}

const LENTES = {
  codigo: `Your lens: the code. Try to refute the design. Look for claims about the code that are wrong, consumers it forgot (other screens, the TV page painel.html, local mode, the fake server, exports, BI, the History reverts), stored data it would corrupt or orphan, tests it would break without saying so, files whose ownership it gets wrong, and steps that would leave the app broken or with two versions of a screen. Check the path:line evidence it cites. Run a read-only experiment when that is the fastest way to settle a point (node -e on pure modules, or on a scratch copy outside the worktree). Default to doubt: a claim you could not confirm is a finding.`,
  pedido: `Your lens: Pedro's request and the operator. Go through ${N}/pedido.md line by line against the note: what the request asks that the note neither delivers nor decides; departures that section 7 does not declare; questions without a default; guardrails bent; scope that the request did not ask for and that adds risk. Then take the side of the one operator who builds the escala every day: walk her routine (pedidos arrive, she approves them, marks who comes and which aircraft are available, fixes what does not fit, approves the escala, exports, runs the day) through this design and count what she does before and after; say where it got slower or more confusing. Also check the note against posicao.md: a disagreement must be argued with evidence, not slipped in.`,
  producao: `Your lens: production. Simulate the cut-over and daily use on real stored data, step by step, and say what the user sees: days already stored for past and future dates, the importadas lists, requests typed by hand before the release, pins, statuses and results keyed by flight key, History reverts persisted with old payloads, a tab left open on the old version while the new one is published, two operators editing at once (PT409), local mode with no server, the Secretaria cancelling a pedido at any time, an approved escala receiving a new approved pedido, a flight in progress whose pedido is cancelled, and a rollback if the release goes wrong. Each sequence that ends badly is a finding with the exact sequence.`,
}

function lentesDe(t) {
  return t.key === 'nucleo' ? ['codigo', 'pedido', 'producao'] : ['codigo', 'pedido']
}

function leituraDe(t) {
  return t.key === 'nucleo' ? NUCLEO.leitura : t.leitura
}

function promptRevisao(t, lente) {
  return [
    REGRAS,
    '',
    'YOUR ROLE: an independent reviewer of one design note. You did not write it and you gain nothing from agreeing with it. You write no file.',
    'THE NOTE UNDER REVIEW: ' + N + '/desenho-' + t.key + '.md (topic: ' + t.titulo + '). Read it in full.',
    '',
    LENTES[lente],
    '',
    'DISCOVERY NOTES behind the design. ' + leituraDe(t),
    '',
    'THE QUESTIONS THE DESIGN HAD TO SETTLE:',
    t.perguntas,
    '',
    'RETURN your verdict (solido, com-ressalvas or refazer), the findings (each concrete, with its evidence and with what the note should say instead; most serious first; at most twenty), and what the note does not cover. Do not pad with matters of taste: a finding is something that would make the plan wrong, risky, or silent where Pedro has to decide.',
  ].join('\n')
}

function promptFechar(t, revisoes) {
  return [
    REGRAS,
    '',
    'YOUR ROLE: revise one design note with the findings of its independent reviews. You are the owner of the note now.',
    'TOPIC: ' + t.titulo,
    'THE KEY TO RETURN: ' + t.key,
    'THE NOTE: ' + N + '/desenho-' + t.key + '.md. Read it in full first.',
    '',
    'METHOD',
    '1. For each finding below, check it against the code and the discovery notes. A finding that holds is fixed in the note: change the decision, the data shape, the table, the question or the risk it touches, and keep the note coherent as a whole (a fix in one section often changes another). A finding that does not hold is rebutted with the evidence and listed in achados_recusados.',
    '2. Cover what the reviews say the note left out.',
    '3. Rewrite the note in place, in the same format, complete (not a list of patches). Put the line <!-- revisado --> immediately before the last line, which stays exactly <!-- fim -->.',
    '4. Return the digest of the revised note.',
    'IF YOU ARE A RETRY: if the note already contains the line <!-- revisado -->, the revision was done: read the note and return its digest.',
    '',
    'THE REVIEWS (one object per reviewer, each with its lens):',
    JSON.stringify(revisoes, null, 1),
    '',
    'DISCOVERY NOTES behind the design. ' + leituraDe(t),
    '',
    'THE QUESTIONS THE DESIGN MUST SETTLE:',
    t.perguntas,
    '',
    FORMATO_DA_NOTA,
  ].join('\n')
}

function promptConciliar(chaves) {
  return [
    REGRAS,
    '',
    'YOUR ROLE: reconcile the design. Eight design notes were written in parallel, reviewed and revised, one per topic: ' + chaves.map(k => 'desenho-' + k + '.md').join(', ') + ', all in ' + N + '. (Ignore desenho-nucleo-a.md, -b.md and -c.md: they are the proposals behind desenho-nucleo.md.) They were written without seeing each other, so they may disagree on names, numbers, owners and order.',
    'YOUR NOTE: ' + N + '/desenho-conciliacao.md',
    '',
    'METHOD',
    '1. Read every note: sections 1, 4, 5, 7 and 8 in full, the rest as needed.',
    '2. Find every contradiction between notes: a field, function or file named differently; two designs for the same thing; a format number or a migration used twice or in a different order; a step that needs something another note delivers later; a control that two notes send to different places or that no note places. Settle each one: by the evidence first, then by posicao.md, then by the request. Mark as PENDENTE only what really needs the orchestrator.',
    '3. Build the ownership matrix: for each step (F0, F1, F2, F3, A, B, C, D, E, G, H, I), the files it creates, changes and deletes, taken from section 5 of every note. List every file that two steps of the parallel phase (A, B, C, D, E) both change, and how to remove the collision.',
    '4. Fix the numbers: the data-format steps in order with what each contains, and the migration files in the order they reach the preview.',
    '5. Merge the departures from the request into one list, and the questions for Pedro into one list without repeats, most consequential first, each with its default.',
    '',
    'Write the note in English with these sections: # Conciliação do desenho; ## 1. The design in one page; ## 2. Contradictions and how each is settled; ## 3. Ownership matrix (step by file) and the collisions; ## 4. Format numbers and migrations, in order; ## 5. Departures from the request (merged); ## 6. Questions for Pedro (merged, with defaults); ## 7. What the orchestrator must decide. The last line must be exactly: <!-- fim -->',
    'IF YOU ARE A RETRY: if your note already exists and its last line is <!-- fim -->, read it and return the digest from it.',
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

async function desenharNucleo() {
  const propostas = await parallel(NUCLEO.lentes.map(l => () =>
    tentar(() => agent(promptArquiteto(l), { label: 'nucleo:arquiteto-' + l.id, phase: 'Desenhar', schema: DESENHO }), 3)
  ))
  const boas = propostas.filter(Boolean)
  log('core proposals written: ' + boas.length + ' of 3')
  if (!boas.length) return null
  return tentar(() => agent(promptSintese(boas), { label: 'nucleo:sintese', phase: 'Desenhar', schema: DESENHO }), 3)
}

const TODOS = [NUCLEO].concat(TOPICOS)

const finais = await pipeline(
  TODOS,
  t => t.key === 'nucleo'
    ? desenharNucleo()
    : tentar(() => agent(promptDesenho(t), { label: 'desenho:' + t.key, phase: 'Desenhar', schema: DESENHO }), 3),
  async (desenho, t) => {
    if (!desenho) {
      log('no design for ' + t.key)
      return null
    }
    const revisoes = await parallel(lentesDe(t).map(lente => () =>
      tentar(() => agent(promptRevisao(t, lente), { label: 'revisao:' + t.key + ':' + lente, phase: 'Revisar', schema: REVISAO }), 2)
        .then(r => (r ? { lente, veredito: r.veredito, achados: r.achados, faltou: r.faltou } : null))
    ))
    return { desenho, revisoes: revisoes.filter(Boolean) }
  },
  async (x, t) => {
    if (!x) return null
    const total = x.revisoes.reduce((n, r) => n + r.achados.length, 0)
    log(t.key + ': ' + x.revisoes.map(r => r.lente + '=' + r.veredito).join(', ') + ' (' + total + ' findings)')
    if (!x.revisoes.length) return { chave: t.key, desenho: x.desenho, revisoes: [], revisado: false }
    const fechado = await tentar(() => agent(promptFechar(t, x.revisoes), { label: 'fechar:' + t.key, phase: 'Fechar', schema: DESENHO }), 3)
    return {
      chave: t.key,
      desenho: fechado || x.desenho,
      revisado: Boolean(fechado),
      vereditos: x.revisoes.map(r => ({ lente: r.lente, veredito: r.veredito, achados: r.achados.length, bloqueiam: r.achados.filter(a => a.gravidade === 'bloqueia').length })),
    }
  }
)

const prontos = finais.filter(Boolean)
const faltam = TODOS.filter((t, i) => !finais[i]).map(t => t.key)
if (faltam.length) log('topics without a design: ' + faltam.join(', '))

phase('Conciliar')
const conciliacao = await tentar(() => agent(promptConciliar(prontos.map(p => p.chave)), { label: 'conciliacao', phase: 'Conciliar', schema: CONCILIACAO }), 3)

return { finais: prontos, faltam, conciliacao }
