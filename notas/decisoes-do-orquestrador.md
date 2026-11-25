<!-- The orchestrator's rulings for the docs/PLAN.md section of the production-line redesign (2026-11-21).
     Local working note: never commit this file. -->

# Decisões do orquestrador

These rulings settle section 7 of `desenho-conciliacao.md` and fix the form of the plan's section. They override the
notes and the reconciliation where they differ. Everywhere else, the reconciliation's section 2 settles the notes, and
the notes give the detail.

## A. The six open points of the reconciliation (its section 7)

1. **The positions the notes overturned are ratified**, as the reconciliation settled them:
   - B1 → an approval enters the day at once only on a date already started, under D's five conditions; otherwise one
     click, "Atualizar a escala" (reconciliation row 45).
   - B3 → the Secretaria may cancel an approved pedido; its flight leaves at the operator's "Atualizar a escala" (row 46;
     question 7 keeps the alternative).
   - B4 → Cadastros, Rodízio and BI are links of the linha's secondary line; the cap moves to 1,612 px (rows 34, 50).
   - B5 → `estadoParaEscalar`, inactive from today on; past dates untouched (row 41).
   - B6 → ranges `[de, ate)` in minutes with today's presence meaning (the whole mission inside one range). The start
     rule is C2, designed and ready, made only with Pedro's explicit yes (row 42).
   - B8 → format 28 is E's last commit, after E rejoins on D3, and carries H's day keys; there is no format 29 (rows 3, 4).

2. **The golden guardrail.** Both golden changes are asked explicitly, as the first and the eleventh items of "Left for
   Pedro": C2 (the start rule, 37 of 41 golden files) and C's text-only commit "texto" (7 lines of `cenario-06.json`).
   The plan says plainly that approving it "with the defaults" leaves both out. Frame item 1 with Pedro's own words: his
   request defines the new model as "one or more ranges of earliest and latest mission start time, with gaps allowed",
   and its step 2 reads "If the meaning changes (a range limits when a mission may start, where today `cobre` requires
   the whole flight inside the windows), make that its own commit, re-record the goldens and review the diff". The plan
   builds his step 1 as written and has his step 2 ready as C2; by default it stops after step 1, and the item says why
   in two or three sentences (ranges converted from today's windows would let missions run past the end the INVA set,
   110 of 735 generated rows by a median of 70 min; a range can no longer keep an INVA free after a time, so a lunch
   break stops being one; every unapproved stored date changes at its next edit). With a yes, C2 is one more PR in its
   own sitting, revertible, and the editor's labels follow the rule.

3. **F2's scope is accepted as the reconciliation wrote it** (rows 21, 30, 33): `item.bloco`, `item.apagado`,
   `vazio: { elemento }`, the CSS of `data-vendo="ambos"`; the one-click active switch
   (`button.lista-chave[role=switch]`, `data-act="ativo"`) with one handler, `js/eventos/inativos.js`, for the three
   rosters and one revert kind, `setInativo { de, id, inativo }`; the two imports from `js/main.js`. F2's entry in the
   plan lists them as part of its interface.

4. **The server counts.** The plan goes to Pedro with the defaults. The read-only counts (a Secretaria account in
   production; closed periods on runs of dates; INVA-dates with part of the day off; stored days by `esquema`) are the
   first task of Onda 0, run by Pedro on production (read-only queries) or answered by him where he knows. Each default
   that rests on one of them names the count that would change it.

5. **Pedro's two decisions of 2026-11-17 that this design leaves unbuilt** (warn-and-confirm for the 7th local flight in
   the pedido form; resource type, INVA and priority on the pedido) are listed under "Decisions this reverses or
   restates", beside the request's three and the restated ones (reconciliation section 5, row 13), and they are
   questions 5 and 6.

6. **One table of names**: the plan carries a compact table of the settled names (reconciliation section 2 and the last
   item of its section 7), so every step uses the same identifiers.

## B. The form of the section

7. **Scope of the plan's commit**: only `docs/PLAN.md`, and in it only the new section, inserted after the section "The
   Painel: Missões, its settings and METAR/TAF" and before "### Phase 16: Later (nice to have)". No edit to the older
   sections or to README.md. The new section carries a short "Servers" table with the state on 2026-11-21 (posicao A15:
   migrations `20261117200000_cursos_e_missoes` and `20261120150000_painel_do_dia_com_a_configuracao` applied to the
   preview and to production; the function `meteorologia` deployed to both, its secret set on both), saying it
   supersedes the "Not applied" and "Not deployed" notes of the earlier sections.

8. **Length**: 55 to 75 KB of Markdown. Tables where they compress (today → target, the controls, the formats, the
   migrations, the stack, the deletions, the departures); dense prose elsewhere, as the existing sections are written.

9. **Questions**: "Left for Pedro" lists the reconciliation's tier 1 (its seventeen questions) as numbered items, each
   with the default, item 1 being the INVA ranges and item 11 the "texto" commit. Tiers 2 and 3 are condensed into
   "Smaller defaults", grouped by step, each still with its default. No question without a default.

10. **Departures**: one table with the departures that change what Pedro sees or decides (about 25 to 30 rows, merging
    small ones); the rest are said in the step they belong to.

11. **Status**: every step is `[ ]`; the title says it is a plan waiting for Pedro's approval; nothing claims work done.
    The date is "requested 2026-11-21".

12. **Public repository**: no personal data (no real names of students or instructors; Pedro and Gabriel, already named
    in PLAN.md, may be named); the visual references are described by structure only ("a three-pane mail client", "a
    workflow graph"), never as files and never with anything they show; no local paths (no `.redesenho`, no notes); no
    secret, key value or project reference.

13. **Language**: English, with the Portuguese identifiers, UI labels, file names and branch names verbatim. Pedro's
    words quoted verbatim (his request is in English).

14. **Numbers**: every count in the section comes from the reconciliation or the notes; nothing is estimated anew.
