export const meta = {
  name: 'linha-f0a',
  description: 'Implement step F0a of the production-line redesign (test drivers, no visible change) in its worktree, review it independently with two lenses, and fix what holds',
  phases: [
    { title: 'Implementar', detail: 'one implementer builds F0a with tests green', model: 'opus' },
    { title: 'Revisar', detail: 'two independent reviewers: mechanics and conformity to the plan', model: 'opus' },
    { title: 'Corrigir', detail: 'the implementer fixes what the reviews proved', model: 'opus' },
  ],
}

const W = '/Users/pedrofernandes/ACPM/.redesenho/wt-f0a'
const N = '/Users/pedrofernandes/ACPM/.redesenho/notas'
const MODELO = 'opus'

const CONTEXTO = `You work on AutoEscala, the ACPM flight school's scheduling app (vanilla ES modules, no build step, no new dependencies; UI, identifiers, file names and commit messages in Portuguese). The step is F0a of the production-line redesign: "Test drivers", which changes NO behaviour of the app and NO assertion of any test.

WHERE
- Your worktree: ${W}, branch linha-f0a-testes (on linha-0-plano). Work only there, with absolute paths. node_modules and the Playwright browsers are installed. Never touch /Users/pedrofernandes/ACPM itself or any other worktree. Never push, never open a PR, never run npm run test:db, never use Supabase or the network.
- The plan: ${W}/docs/PLAN.md, section "Linha de produção" (from line 463): read "Pedro's decisions (2026-11-24)", the stack table, the paragraph that starts "Every step:", the F0a entry and the deletion table's F0a row.
- The design behind it, in ${N}: desenho-entrega.md section 2.2 g (lines 252-290: the drivers, their exports and owners, the split of cadastros.spec.js, the fake server split, the ports, package.json, publicado.spec.js, testar-banco.mjs), the F0a rows of its sections 2.3, 5 and 6 (grep -n F0a), and desenho-conciliacao.md section 3.2, row F0a (the file list, settled). Where they disagree the conciliation wins, then the plan.

WHAT F0a DELIVERS (in short; the notes have the detail)
- Per-screen e2e drivers test/e2e/telas/{casca,invariantes,recursos,instrutores,alunos,demanda,pedidos,escala,cursos}.js, re-exported by test/e2e/fixtures.js so no spec changes its import line; specs reach screen controls through them. appPronto waits on body[data-pronto] (the app already sets it, js/main.js:142) and replaces the waits on #wins.
- test/e2e/cadastros.spec.js split by its describes into recursos.spec.js, instrutores.spec.js, alunos.spec.js; the Esc-layer tests that open #painel-dados or #painel-instrutor into gavetas-de-cadastro.spec.js; screen tests of acessibilidade.spec.js and celular.spec.js moved, unchanged, to their screen's spec.
- test/e2e/supabase-falso.js keeps the router; the agenda and personal-data handlers move to test/e2e/falso/agenda.js and falso/dados-pessoais.js.
- test/e2e/manual-frases.js; percorrerTelas replacing percorrerVistasEFiltros and the four literal nine-tab lists.
- test/unit/donos-dos-seletores.test.js: each reserved selector appears only in its driver (and its owner's specs).
- scripts/porta.mjs (portaDaPasta), used by scripts/serve.mjs and playwright.config.js (reuseExistingServer false); package.json "test" runs the lint first.
- The one literal pin of ESQUEMA moved to test/unit/migracoes.test.js; test/unit/config-do-painel.test.js:126-130 rewritten not to pin 25.
- publicado.spec.js start address from ACPM_INICIO; scripts/testar-banco.mjs refuses the production ref like scripts/semear-previa.mjs does.
- README 'Testes' updated (the drivers, the ports, the lint in npm test, the measured duration).

RULES
- No assertion of any test changes: only selectors and files move. The number of e2e tests run stays 578 (572 passed, 6 skipped at the baseline) unless a test moves file; the unit tests keep passing and only grow by the new ones.
- Tests first where there is something new to test (the selector-owner test, porta).
- Green = "npm run lint" and "CI=1 npm test" both exit 0 in ${W}. Run them; the e2e suite takes about 4 minutes.
- Small, reviewable commits in Portuguese, in the repo's style (git log upstream/main: "test: …", "refactor: …", "docs: …"), each ending with the line: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- No personal data in tests; fictitious names only.`

const RESULTADO = {
  type: 'object',
  properties: {
    verde: { type: 'boolean', description: 'lint and CI=1 npm test both exit 0 at HEAD' },
    commits: { type: 'array', items: { type: 'string' }, description: 'git log --oneline of the step' },
    e2e: { type: 'string', description: 'the Playwright summary line (passed, skipped, failed, duration)' },
    unit: { type: 'string', description: 'the node:test summary (tests, pass, fail)' },
    resumo: { type: 'string', description: 'what was done, in up to 250 words' },
    desvios: { type: 'array', items: { type: 'string' }, description: 'where the step departs from the plan or the notes, and why' },
    pendencias: { type: 'array', items: { type: 'string' }, description: 'what is left undone' },
    achados_recusados: { type: 'array', items: { type: 'string' }, description: 'only in the fixing pass: review findings rebutted, with the evidence' },
  },
  required: ['verde', 'commits', 'e2e', 'unit', 'resumo', 'desvios', 'pendencias', 'achados_recusados'],
}

const REVISAO = {
  type: 'object',
  properties: {
    veredito: { type: 'string', enum: ['aprovar', 'com-ressalvas', 'refazer'] },
    achados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gravidade: { type: 'string', enum: ['bloqueia', 'importante', 'menor'] },
          onde: { type: 'string' },
          problema: { type: 'string' },
          evidencia: { type: 'string' },
          correcao: { type: 'string' },
        },
        required: ['gravidade', 'onde', 'problema', 'evidencia', 'correcao'],
      },
    },
  },
  required: ['veredito', 'achados'],
}

const LENTES = [
  { id: 'mecanica', texto: `Your lens: the mechanics. Diff the branch against linha-0-plano (git diff linha-0-plano...HEAD) and prove that no assertion changed: for every moved or rewritten test, compare the expectations before and after; a test whose meaning changed, a test lost, a skipped or weakened check, a wait replaced by something that can pass early, or a selector still used outside its driver is a finding. Run npm run lint and CI=1 npm test yourself and compare the counts with the baseline (572 passed, 6 skipped, 578 total). Check the ports logic and that a busy port fails instead of reusing another server.` },
  { id: 'plano', texto: `Your lens: conformity to the plan and the design notes. Check every item of F0a in the plan section, desenho-entrega.md 2.2 g and desenho-conciliacao.md 3.2 (row F0a) against the diff: delivered, or a stated departure with a reason. Check the drivers' names and exports and owners, the split files, the fake server split, the README, the commit messages (Portuguese, the Co-Authored-By line), and that nothing outside F0a's files changed (no app code: js/, css/, index.html, painel.html untouched).` },
]

function promptImplementar() {
  return [CONTEXTO, '', 'YOUR ROLE: implement F0a completely, commit it on the branch, and leave the worktree clean and green.', 'IF YOU ARE A RETRY: read git log linha-0-plano..HEAD and git status first and continue from there.', '', 'RETURN the summary of the result.'].join('\n')
}
function promptRevisar(l) {
  return [CONTEXTO, '', 'YOUR ROLE: an independent reviewer of F0a as committed on linha-f0a-testes. You did not write it. You change no file and make no commit.', '', l.texto, '', 'RETURN your verdict and findings (concrete, each with evidence and the correction; most serious first; at most 20). Matters of taste are not findings.'].join('\n')
}
function promptCorrigir(revs) {
  return [CONTEXTO, '', 'YOUR ROLE: fix F0a with the findings of two independent reviews. Check each finding; fix what holds (in new commits), rebut what does not with evidence. Leave the worktree clean and green (run the lint and CI=1 npm test at the end).', '', 'THE REVIEWS:', JSON.stringify(revs, null, 1), '', 'RETURN the summary, with achados_recusados.'].join('\n')
}

async function tentar(fazer, vezes) {
  for (let i = 0; i < vezes; i++) {
    try { const r = await fazer(); if (r) return r } catch (e) { log('an agent threw: ' + String((e && e.message) || e).slice(0, 200)) }
  }
  return null
}

phase('Implementar')
const feito = await tentar(() => agent(promptImplementar(), { label: 'implementar', phase: 'Implementar', schema: RESULTADO, model: MODELO }), 2)
if (!feito) return { feito: null }
log('implemented: green=' + feito.verde + '; ' + feito.e2e)

phase('Revisar')
const revs = (await parallel(LENTES.map(l => () =>
  tentar(() => agent(promptRevisar(l), { label: 'revisar:' + l.id, phase: 'Revisar', schema: REVISAO, model: MODELO }), 2)
    .then(r => (r ? { lente: l.id, veredito: r.veredito, achados: r.achados } : null))
))).filter(Boolean)
log('reviews: ' + revs.map(r => r.lente + '=' + r.veredito + ' (' + r.achados.length + ')').join(', '))

const precisa = revs.some(r => r.achados.some(a => a.gravidade !== 'menor')) || revs.some(r => r.achados.length)
phase('Corrigir')
const final = precisa ? await tentar(() => agent(promptCorrigir(revs), { label: 'corrigir', phase: 'Corrigir', schema: RESULTADO, model: MODELO }), 2) : feito
return { feito, revisoes: revs, final }
