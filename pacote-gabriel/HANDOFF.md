# Handoff: the production-line redesign of AutoEscala

For Gabriel, from Pedro's Claude Code session (2026-11-24). Everything here is private working material: **do not commit
this folder to any public repo.** The plan itself is public, in `docs/PLAN.md`.

## 1. Status

- **The plan is approved and merged** into the fork's `main`
  ([thephfernandes/ACPM#1](https://github.com/thephfernandes/ACPM/pull/1), merge 690a2d3). It is the section "Linha de
  produção: Pedidos → Processamento → Escala → Aprovar" of `docs/PLAN.md` (from line 463). Read its block **"Pedro's
  decisions (2026-11-24)"** first: where it differs from the rest of the section, it wins.
- **F0a (test drivers) is done**: branch `linha-f0a-testes`, PR
  [thephfernandes/ACPM#2](https://github.com/thephfernandes/ACPM/pull/2) into the fork's `main`, green locally (lint,
  1,201 unit, 572 e2e passed and 6 skipped, as before), reviewed independently with its findings fixed. Merge it once
  its CI is green, if it is still open. Its departures are written in the F0a item of the plan. Two follow-ups it left:
  record the CI run's duration in README "Testes" (shards only if the e2e step passes 10 minutes), and F0b updates the
  comment at `js/main.js:141` to name `test/e2e/telas/casca.js`.
- Known flaky test on `main`: `test/e2e/painel-sessao.spec.js:316` (the TV's dawn reload while offline) timed out once in
  CI on a docs-only commit; rerun before suspecting a change.
- **Next is F0b** (`linha-f0b-costuras`, on `linha-f0a-testes` or on `main` once #2 is merged), then F0c, F3, F1a, F1b,
  F2, then the parallel lines (A; B; C; D1 → D2 → D3; E's module), rejoined in the order A, B, C, D1, D2, D3, E, then
  G1, G2, H, I. The stack table in the section has every branch name and base.

## 2. Pedro's rules for this work

- **PRs go to the fork's `main`** (`thephfernandes/ACPM`), one per step, and are merged there once green and reviewed.
  The fork's GitHub Pages serves `main` (https://thephfernandes.github.io/ACPM/), which the app points at the **preview**
  Supabase project (`js/config-supabase.js`, by address). That site is the redesign's preview.
- **Only the preview database.** Migrations and database checks (`npm run test:db`) only on the preview project.
  Production and upstream (`gdruumond/ACPM`) stay untouched until Pedro asks for the upstream PR.
- The guardrails of his request (in `notas/pedido.md`, "Guardrails"): `runAllocationEngine` stays pure and its goldens
  change only in commits whose purpose is a rule change (approved: C's "regra" and "texto"); `gravarAlteracao` stays the
  only writer, nothing saved before the date's data is read; data-format steps never delete fields; personal data stays
  out of CSV, PDF, BI and the History; tests use fictitious names and weights only; delete what is replaced, never two
  versions of a screen; no build step, no new dependency; identifiers, file names and commit messages in Portuguese.
- Tests first; `npm run lint` and `CI=1 npm test` green on every step (F0a puts the lint inside `npm test`); an
  independent review per step before its PR; README "Estrutura", the in-app Manual and the glossary updated in the same
  step that changes what they describe.
- Pedro sent two reference screenshots with his request (a three-pane mail client, a GitHub Actions graph). They are
  **not** in this package and must never go into the repo (one shows work e-mail). `notas/referencias-visuais.md`
  describes their structure in words; use it instead.

## 3. What is in this package

Read in this order:

| File | What it is |
|---|---|
| `notas/pedido.md` | Pedro's request, verbatim: the specification |
| `notas/decisoes-do-orquestrador.md` | the rulings that settled the reconciliation's open points before the plan was written (superseded only by Pedro's decisions in PLAN.md) |
| `notas/desenho-conciliacao.md` | the whole design reconciled in one note: names, owners, the ownership matrix (step × file, section 3.2), format numbers and migrations (section 4), contradictions between the topic notes and how each was settled (section 2). **Where it disagrees with a topic note, it wins** |
| `notas/desenho-*.md` (8) | the final design per topic: `nucleo` (the data flow: pedidos → day → engine, restrictions), `casca` (shell, linha, rail), `lista` (the list–detail component), `cadastros` (Alunos, INVAs, Recursos, inactive, permissions, habilitações), `disponibilidade` (INVA ranges, Janelas), `pedidos` (approval, the page, the migration), `escala-aprovar` (Escala inputs, Aprovar, the cards' rows, the rail's notifications), `entrega` (steps, files, tests, worktrees, ports). Each has: 1 Decisions, 2 How it works, 3 Controls, 4 Formats and migrations, 5 Files by step, 6 Tests, 7 Departures, 8 Questions, 9 Risks |
| `notas/posicao.md` | the orchestrator's earlier position (background; several points were overturned by the notes) |
| `notas/referencias-visuais.md` | the two screenshots in words |
| `notas/descoberta/` | the discovery: 14 maps of today's code (`mapa-*.md`) and 9 gap answers (`lacuna-*.md`), every fact with `path:line` at commit 48875e3 |
| `notas/propostas-do-nucleo/` | the three competing core proposals behind `desenho-nucleo.md` |
| `notas/revisoes/` | the independent reviews of each design note and of the plan section (JSON) |
| `workflows/linha-f0a.js` | the Claude Code workflow script used for F0a (implement → two reviews → fix), a template for the next steps: change the paths `W` and `N` at its top to your own, and the step's description |

Pedro's decisions of 2026-11-24 change some notes: the INVA ranges use the **start rule plus explicit pauses**
(`faixas` + `pausas`; format 27 converts `aw` runs into ranges and the gaps between runs into pauses; C2 becomes C's
last commit, "regra"); the 7th local flight in Pedidos **warns and confirms**, recording who (D1); **A2 is folded into
A** (one migration); **"+ Agendar voo" accepts a conflict** after "Agendar mesmo assim" (G1); the "texto" commit is made
(C). The notes predate these; the PLAN.md block is the source.

## 4. How a step was run

1. A worktree per step, branched from the previous step's branch:
   ```bash
   git worktree add -b linha-f0b-costuras ../ACPM-linha-f0b linha-f0a-testes
   ```
   then `npm ci` inside it (Node ≥ 22.13) and `npx playwright install chromium` once per machine.
2. Baseline in the worktree before any change: `npm run lint` and `CI=1 npm test` (on 48875e3: lint clean, 572 e2e
   passed, 6 skipped, about 4 minutes). Until F0a lands, the e2e server port is fixed (4173): one test run at a time per
   machine. From F0a on, `scripts/porta.mjs` gives each folder its own port.
3. Implement from the PLAN.md entry, `desenho-conciliacao.md` section 3.2 (the step's row) and the topic notes; tests
   first; commits in Portuguese in the repo's style (`test:`, `refactor:`, `feat:`, `fix:`, `docs:`).
4. An independent review (Pedro's rule): an agent that did not write the step, given the plan entry and the diff, with
   two lenses (the mechanics, and conformity to the plan and notes); fix what holds; green again.
5. Push the branch to the fork, open the PR into the fork's `main` (title and body in Portuguese), merge when CI is
   green. Steps with a migration push it to the **preview** first (`supabase migration list`, `supabase db push
   --dry-run` listing exactly that file, then the push), then run the database checks there.
6. Tick the step's `[ ]` in the PLAN.md section in the same PR, with what its review changed.

## 5. Things learned the hard way

- The fork's `main` was 208 commits behind upstream; it was fast-forwarded to upstream's 48875e3 on 2026-11-24. Keep it
  moving only through these PRs.
- The PRs are stacked: each step's branch starts from the previous one, so merge them in order and merge `main` back
  into the open branches (merge, never rebase).
- The whole redesign is large: 18 PRs after the plan, each with an implement pass, two reviews and a fix pass. Watch
  your weekly Claude limit and pace the steps.
- To pin the model of every subagent in a workflow script, pass `model` to each `agent()` call (the F0a script does).
