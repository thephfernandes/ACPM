export const meta = {
  name: 'linha-plano',
  description: 'Write the docs/PLAN.md section of the production-line redesign from the reconciled design, verify it with four independent lenses, and fix what holds',
  phases: [
    { title: 'Redigir', detail: 'one writer drafts the section from the reconciled design and the rulings', model: 'opus' },
    { title: 'Verificar', detail: 'four verifiers: the code, the request, the coherence with the design, the reader', model: 'opus' },
    { title: 'Corrigir', detail: 'the writer fixes what the verifiers proved', model: 'opus' },
  ],
}

const W = '~/ACPM/.redesenho/wt-plano'
const N = '~/ACPM/.redesenho/notas'
const SECAO = N + '/secao-do-plan.md'
const MODELO = 'opus'
const CHAVES = ['nucleo', 'casca', 'lista', 'cadastros', 'disponibilidade', 'pedidos', 'escala-aprovar', 'entrega']
const NOTAS = CHAVES.map(k => N + '/desenho-' + k + '.md').join(', ')

const CONTEXTO = `You work on the PLAN of a large redesign of AutoEscala, the ACPM flight school's daily scheduling app (vanilla ES modules, no build step, no dependencies, GitHub Pages, Supabase; UI and identifiers in Portuguese). Pedro (the developer who requested it) asked for a new section of docs/PLAN.md and will read it to approve or change the plan before any code is written. After his approval the section is also the brief of the implementers of each step, together with the design notes.

WHERE THINGS ARE
- The code: the git worktree ${W} (branch linha-0-plano, at upstream/main 48875e3). Read it with absolute paths. Change NOTHING there: no edit, no git command that writes, no npm install. Never run npm run test:db, never use the network, never touch Supabase. Read-only commands (grep -n, sed -n, wc, git log, git show) and node -e on pure modules are fine.
- The design, all in ${N}:
  - pedido.md: Pedro's request, verbatim. It is the specification.
  - desenho-conciliacao.md: the reconciled design in one note (the design in one page; the contradictions between the topic notes and how each is settled; the stack and the ownership matrix; the format numbers and migrations; the departures from the request; the questions for Pedro with defaults). Where it settles a point, it wins over the topic notes.
  - decisoes-do-orquestrador.md: the orchestrator's rulings. They win over everything else.
  - The eight final topic notes: ${NOTAS}. Each has the sections 1 Decisions, 2 How it works, 3 Where each existing control goes, 4 Data-format steps and migrations, 5 Files by step, 6 Tests, 7 Departures, 8 Questions, 9 Risks. Find a note's sections with grep -n '^## ' and read them by line ranges.
  - posicao.md (the orchestrator's earlier position; background only) and referencias-visuais.md (the two visual references Pedro sent, in words).
- docs/PLAN.md in the worktree: the document the section goes into. Its lines 366-461 (the sections "Courses as their own data, and booking in the Escala" and "Abas de cadastro, Recursos e Cursos" and "The Painel") are the model of the style.

RULES FOR THE SECTION (they come from the rulings; read them there in full)
- English prose with the Portuguese identifiers, UI labels, file names and branch names verbatim. Pedro's words quoted verbatim (his request is in English).
- It is a plan waiting for approval: every step is [ ], nothing is claimed as done, the date is "requested 2026-11-21".
- Public repository: no personal data (no real names of students or instructors; Pedro and Gabriel may be named, as PLAN.md already does); the visual references described by structure only (a three-pane mail client; a workflow graph), never as files and never with anything they show; no local paths (no .redesenho, no notes, no /Users); no secret, key value or Supabase project reference.
- Every count comes from the reconciliation or the notes; nothing is estimated anew. Every question carries the default the plan implements.`

const SECAO_FORMATO = `THE SECTION, in this order (Pedro asked for: the current → target map, where every existing control ends up, data-format steps and database migrations, the workstreams with the files each owns, the order, what is deleted, and open questions):

### Linha de produção: Pedidos → Processamento → Escala → Aprovar (requested 2026-11-21; plan, waiting for Pedro's approval)
An opening paragraph: the request in two or three sentences with one short verbatim quote of Pedro; nothing is built yet; how it will be delivered (one worktree, branch and PR per step, from the fork to upstream, stacked as the abas-* branches were); how Pedro approves (by answering "Left for Pedro", or "with the defaults", which leaves out the two golden changes C2 and "texto").

**The plan in one page.** Bullets: what does not move (the engine and its goldens, gravarAlteracao, dia.pedidos as the engine's input, the flight keys); Pedidos; Processamento; Escala and Aprovar; the cadastros; the shell; the delivery (the stack, the sittings, the sweeps); how solid the design is (what was measured, what was not); the operator's routine before and after, counted (33 → 42 interactions on a typical date, and what she gains).

**Decisions this reverses or restates.** Numbered: the request's three (of 2026-11-19); the decisions restated (reconciliation section 5 row 13: "Limpar demanda" becoming "Recomeçar pelos pedidos", the course-mission confirmation, the booked-flight release, the date and tabs on top, the History drawer); and Pedro's two decisions of 2026-11-17 left unbuilt (rulings, item 5). Cite the PLAN.md line or section each one comes from.

#### Today → target
One table: Today (tab, region or data) | Target (stage, screen, pane, module or data) | Step. Cover the nine tabs, the header and its date controls, the navigation, the record drawers, the dialogs and pop-ups, and the data that changes (solicitacoes, dia.pedidos and its records, importadas, aw → faixas, win, habilitacaoPropria → exige, the inativo flag, the exports record).

#### Where every existing control ends up
One table per today's screen or region (header and navigation; Agenda; Demanda; Escala; Alunos; Instrutores; Recursos; the drawers and dialogs). Columns: Control today (label, id or data attribute) | Ends up (stage, screen, pane) | How (kept, moved, replaced by …, removed) | Step. Take them from section 3 of every note, as settled by the reconciliation's section 2. Every control of today is placed exactly once; merge rows only where several controls go the same way.

#### Data-format steps and database migrations
The format table (26, 27, 28; no 29): step, what it carries, the conversion, the sweep. The migration table in the order the files reach the shared preview: file, step, content, database checks, preview, production. The deploy rules (preview first; production before the merge, with the one exception A2 and why; database checks only on the preview project, run by Pedro; local mode). The "Servers" table with the state on 2026-11-21 (rulings, item 7).

#### Steps, the files each owns, and the order
The stack as a table (step, branch → base, sitting, format number, migration). Then one entry per step, as "- [ ] **F0a · <name>** (branch \`linha-f0a-testes\`, on …):" followed by: its purpose; what it depends on; the files it creates, changes and deletes (the main ones; long lists condensed, the full list being the reconciliation's matrix); the tests written first; what the app looks like after it and whether the operator's routine changes; the Manual, glossary and README changes it carries. Then: the files two parallel steps both change and how each collision is removed; the files frozen from F2's tip; the parallel worktrees (port, node_modules, the shared preview, the rejoin order and who resolves); the release sittings Onda 0 to 4 (what reaches production at each, Gabriel merging, where the operator's routine changes, how each can be undone).

#### Names
A compact table of the settled names (modules, functions, redraw moments, ids, the stage list, migration files): name | what it is | step.

#### What is deleted, and when
A table: what (file, function, CSS, test, Manual section, glossary term, SQL function) | deleted in step | replaced by. Nothing is deleted before its replacement exists.

#### Go-live checklists (described, not performed)
Numbered [ ] items per sitting or step with a migration or a format sweep.

#### Departures from the request
One table: The request says | The plan does | Why | Pedro can choose instead. About 25 to 30 rows, merging small ones (rulings, item 10).

Left for Pedro (each with the default the plan implements):
Numbered: the reconciliation's tier 1 (its seventeen questions), item 1 being the INVA ranges (framed as the rulings say, item 2) and item 11 the "texto" commit. Then "Smaller defaults", grouped by step, each with its default (tiers 2 and 3, condensed).

Size: 55 to 75 KB. Tables where they compress; dense prose elsewhere, as the existing sections.`

const ESCRITA = {
  type: 'object',
  properties: {
    arquivo: { type: 'string' },
    tamanho_kb: { type: 'number' },
    secoes: { type: 'array', items: { type: 'object', properties: { titulo: { type: 'string' }, kb: { type: 'number' } }, required: ['titulo', 'kb'] } },
    perguntas: { type: 'number', description: 'numbered items in Left for Pedro' },
    desvios: { type: 'number', description: 'rows of the departures table' },
    nao_resolvido: { type: 'array', items: { type: 'string' }, description: 'points the writer could not settle from the sources, or where the sources disagree and the writer chose' },
    achados_recusados: { type: 'array', items: { type: 'string' }, description: 'only in the fixing pass: findings rebutted, each with the evidence' },
  },
  required: ['arquivo', 'tamanho_kb', 'secoes', 'perguntas', 'desvios', 'nao_resolvido', 'achados_recusados'],
}

const VERIFICACAO = {
  type: 'object',
  properties: {
    veredito: { type: 'string', enum: ['pronto', 'com-ressalvas', 'refazer'] },
    achados: {
      type: 'array',
      description: 'concrete findings, most serious first, at most 25',
      items: {
        type: 'object',
        properties: {
          gravidade: { type: 'string', enum: ['bloqueia', 'importante', 'menor'] },
          onde: { type: 'string', description: 'the heading and the first words of the passage' },
          problema: { type: 'string' },
          evidencia: { type: 'string', description: 'path:line, a note section, a line of the request, or the experiment run' },
          correcao: { type: 'string', description: 'what the section should say instead' },
        },
        required: ['gravidade', 'onde', 'problema', 'evidencia', 'correcao'],
      },
    },
    faltou: { type: 'array', items: { type: 'string' }, description: 'what the section should cover and does not' },
  },
  required: ['veredito', 'achados', 'faltou'],
}

const LENTES = [
  {
    id: 'codigo',
    instrucao: `Your lens: the code. Check every statement the section makes about today's code against the worktree: file paths, ids, functions, data fields, line numbers, counts of tests and goldens, what each control does today. Check that every file a step creates does not exist yet, that every file a step changes or deletes exists, and that the deletion table has nothing replaced left behind and nothing deleted before its replacement exists (compare with the reconciliation's matrix, section 3.2). Check the format and migration facts against js/migracoes.js, js/dias.js and supabase/migrations/. Default to doubt: a claim you could not confirm is a finding. Do not re-litigate design decisions; report what is false or missing.`,
  },
  {
    id: 'pedido',
    instrucao: `Your lens: Pedro's request. Go through ${N}/pedido.md line by line against the section: everything it asks is delivered, decided, or listed as a departure with what Pedro can choose instead; the six things he asked the section to contain are all there (the current → target map, where every existing control ends up, data-format steps and database migrations, the workstreams with the files each owns, the order, what is deleted, open questions); every question has a default; the guardrails hold; nothing departs from his explicit preferences without saying so. Then read it as the operator who builds the escala every day: is what changes for her, and when, said plainly?`,
  },
  {
    id: 'coerencia',
    instrucao: `Your lens: coherence and fidelity to the design. Check the section against desenho-conciliacao.md, decisoes-do-orquestrador.md and the eight topic notes: names (the reconciliation's section 2 settles them), format numbers, migration files and their order, the steps, their bases and dependencies, the owners of shared files, the sittings; that every control of today appears exactly once in the control tables (compare with section 3 of each note) and that none is lost; that the questions keep the reconciliation's defaults and the rulings' framing; that the section says nothing the design does not support, and leaves out nothing the implementers of a step would need to start (they will also have the notes). Also check internal consistency: a step, number or name stated two ways in two places of the section is a finding.`,
  },
  {
    id: 'leitor',
    instrucao: `Your lens: Pedro, who must approve this, and the public repository it goes into. Can he see quickly what changes for the operator, what he must decide, and what each step delivers? Look for jargon used before it is defined, passages that are too dense or too long for what they say, questions he cannot answer with a yes, a no or a choice, defaults hidden in prose, and departures from the style of the existing sections of docs/PLAN.md (lines 366-461 of the worktree's copy). Then the publication check: any personal data, any local path, any mention of the reference screenshots as files or of what they show beyond structure, any secret or project reference, any claim that work is done. Each is a finding.`,
  },
]

function promptEscrever() {
  return [
    CONTEXTO,
    '',
    'YOUR ROLE: write the section. You are its only author.',
    'YOUR FILE: ' + SECAO + ' (the section only, in Markdown, starting with its ### heading; the last line of the file must be exactly <!-- fim -->). Write nothing else anywhere.',
    '',
    'METHOD',
    '1. Read, in this order: decisoes-do-orquestrador.md (all of it); desenho-conciliacao.md (all of it); pedido.md (all of it); docs/PLAN.md lines 366-461 in the worktree (the style); then, for each of the eight topic notes, sections 1, 3, 4, 5, 7 and 8 (section 2 where you need a data shape or a behaviour to state something exactly).',
    '2. Plan the section against the format below, then write it in one pass. Prefer the reconciliation\'s wording and numbers; take detail from the notes; settle any remaining disagreement by the rulings, then the reconciliation, then the evidence, and list it in nao_resolvido.',
    '3. Check your own text for the publication rules before you finish (no personal data, no local paths, no screenshots, no secrets, nothing claimed as done).',
    'IF YOU ARE A RETRY: if the file already exists and its last line is <!-- fim -->, read it and return the digest from it.',
    '',
    SECAO_FORMATO,
    '',
    'RETURN the digest of the file you wrote.',
  ].join('\n')
}

function promptVerificar(l) {
  return [
    CONTEXTO,
    '',
    'YOUR ROLE: an independent verifier of the draft section ' + SECAO + '. You did not write it and you gain nothing from agreeing with it. You write no file.',
    'Read the draft in full first, then what your lens needs.',
    '',
    l.instrucao,
    '',
    'What the section was asked to contain, for reference:',
    SECAO_FORMATO,
    '',
    'RETURN your verdict (pronto, com-ressalvas or refazer), the findings (concrete, each with its evidence and with what the section should say instead; most serious first; at most 25), and what the section leaves out. Matters of taste are not findings: a finding is something that would make the plan wrong, risky, misleading for Pedro, or silent where he has to decide.',
  ].join('\n')
}

function promptCorrigir(verificacoes) {
  return [
    CONTEXTO,
    '',
    'YOUR ROLE: fix the draft section with the findings of four independent verifiers. You own the section now.',
    'THE FILE: ' + SECAO + '. Read it in full first.',
    '',
    'METHOD',
    '1. Check each finding against the code, the design notes, the reconciliation and the rulings. A finding that holds is fixed in the section, keeping it coherent as a whole (a fix in one table often changes another place). A finding that does not hold is rebutted with the evidence and listed in achados_recusados.',
    '2. Cover what the verifiers say the section leaves out, within the size of 55 to 75 KB (tighten elsewhere if needed).',
    '3. Rewrite the file in place, complete. Put the line <!-- revisado --> immediately before the last line, which stays exactly <!-- fim -->.',
    'IF YOU ARE A RETRY: if the file already contains the line <!-- revisado -->, the fixing was done: read the file and return its digest.',
    '',
    'THE VERIFICATIONS (one object per verifier, each with its lens):',
    JSON.stringify(verificacoes, null, 1),
    '',
    SECAO_FORMATO,
    '',
    'RETURN the digest of the fixed file, with achados_recusados.',
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

phase('Redigir')
const rascunho = await tentar(() => agent(promptEscrever(), { label: 'redigir', phase: 'Redigir', schema: ESCRITA, model: MODELO }), 3)
if (!rascunho) {
  log('no draft was written')
  return { rascunho: null, verificacoes: [], final: null }
}
log('draft: ' + rascunho.tamanho_kb + ' KB, ' + rascunho.perguntas + ' questions, ' + rascunho.desvios + ' departures')

phase('Verificar')
const verificacoes = (await parallel(LENTES.map(l => () =>
  tentar(() => agent(promptVerificar(l), { label: 'verificar:' + l.id, phase: 'Verificar', schema: VERIFICACAO, model: MODELO }), 2)
    .then(r => (r ? { lente: l.id, veredito: r.veredito, achados: r.achados, faltou: r.faltou } : null))
))).filter(Boolean)
log('verified: ' + verificacoes.map(v => v.lente + '=' + v.veredito + ' (' + v.achados.length + ')').join(', '))

phase('Corrigir')
const final = verificacoes.length
  ? await tentar(() => agent(promptCorrigir(verificacoes), { label: 'corrigir', phase: 'Corrigir', schema: ESCRITA, model: MODELO }), 3)
  : null

return {
  rascunho,
  verificacoes: verificacoes.map(v => ({ lente: v.lente, veredito: v.veredito, achados: v.achados.length, bloqueiam: v.achados.filter(a => a.gravidade === 'bloqueia').length, faltou: v.faltou })),
  achados: verificacoes,
  final,
}
