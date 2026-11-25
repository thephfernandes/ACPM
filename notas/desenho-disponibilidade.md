<!-- Design note of the production-line redesign. Local working note: never commit. -->

# Desenho: INVA availability as ranges (C) and the end of Janelas de operação (B)

Code read at `~/ACPM/.redesenho/wt-plano` (`linha-0-plano`, `48875e3`). **Every path and line below is
as of 48875e3**; F0 renames some of the files before B and C start (table below). Maps are cited as `mapa-<nome> §n`,
sibling design notes as `desenho-<nome>`.

Evidence marks: **(measured)** = run for this revision with node on a scratch copy outside the repo (the design's
`js/disponibilidade.js` in place of `cobre`, the rule chosen by a variable; nothing in the worktree was changed);
**(reviews)** = measured by the two independent reviews of this note and not run again here (the browser experiments on
the time field; the unit suite with the whole data layer); **(not run)** = the e2e suite, for every step of this note.

| As of 48875e3 | What B and C edit after F0a, F0b and F0c (desenho-entrega 2.2) |
|---|---|
| `js/views/cadastros.js:23-247` | `js/views/instrutores.js` |
| `js/eventos/cadastros.js:49-54, 70-81, 140-186, 225-249` | `js/eventos/instrutores.js` |
| the `if` chain of `js/eventos/historico.js:53-123` | one `aoReverter(tipo, desfazer)` per kind, registered by the screen that owns it |
| the lists `rRec(); rIns(); …` | `registrarTela` and `redesenharTelas` (`js/telas.js`) |
| `css/app.css` | `css/recursos.css`, `css/instrutores.css`, `css/escala.css` |
| `test/e2e/cadastros.spec.js` | `recursos.spec.js`, `instrutores.spec.js`; selectors behind `test/e2e/telas/recursos.js` and `telas/instrutores.js` |
| `abrir` waiting for `#wins input[data-a="win"]` | `appPronto` (`body[data-pronto]`), in F0a |

Words: *period* = one of the nine entries of `WIN` (js/config.js:4); `fim(k)` = `T[k+1]`, and 1440 for the 17:30 one;
*run* = consecutive periods that are on; *range* = one item of the new `faixas`; *presence rule* = the mission fits whole
inside one range ("cabe"); *start rule* = the mission starts inside one range ("começa").

## 1. Decisions

### The data

**D1. One stored shape, per date: `dia.ins[<id>].faixas`, a list of `{ de, ate }` in minutes; a range is `[de, ate)`.**
- Rules of the list: integers; `390 <= de < ate <= 1440` (the escala's day starts at 06:30, `T[0]`; what a stored range
  holds before it is cut off); sorted by `de`; ranges that overlap or touch are merged; at most 8; `[]` is valid and means
  "sem faixa". Copied to each new date with `on`, as `aw` is today (js/dias.js:118-123).
- Why this shape: the same numbers are a true statement under either rule of D6. Only the rule can change, never a
  stored number.
- Evidence (measured): 512 period patterns converted and read back, 512 identical; the presence rule over ranges against
  today's `cobre` on every interval of a 10-minute grid, 0 differences in 5,345,280 cases; the 42 golden tests pass.
  mapa-motor §5.4, mapa-invas §5.7 and the code review measured the same.
- Rejected: posicao B6's shape (D2); `0 <= de` (a range before 06:30 is inert under the rule of D5 and would read as
  availability no take-off can use).

**D2. posicao B6 tested: its commit-1 reading holds arithmetically, and fails in six places. This design replaces it.**
B6: `{ de, ate }` = earliest and latest start, both inclusive; conversion of a run i..j = `{ T[i], T[j] }`; commit 1
reads "period k is on when `de <= T[k] <= ate`" and then applies today's `cobre`.

| Test | Result (first design, confirmed exact by the code review) |
|---|---|
| The nine periods, 512 patterns, converted and read back | identical in 512 of 512: while every range is aligned to period starts, B6's commit 1 is exact |
| 1. A range not aligned to the periods | `06:40–11:40` reads as the periods 08:20, 10:10, 11:30 (available until 12:40, an hour past the "latest start"); `11:40–12:30` reads as never available. So no free-minute editor can exist before commit 2, and a tab on commit 1 misreads what commit 2 stores under the same number |
| 2. The same numbers under the start rule | `ate = T[j]` drops every start inside the last period of a run. With today's lists that is the PA-34: a 1 h flight loses the starts 07:00, 08:30, 09:00, 10:30, 15:00 or 16:30 (768 of 10,752 pattern × start pairs); "Dia inteiro" loses the 16:30 take-off it has today |
| 3. The inclusive end at 17:30 | "06:30–17:30" typed for a day instructor includes the Noturno, which starts exactly at 17:30 (mapa-motor §5.4) |
| 4. The turnos | "Manhã" becomes 06:30–11:30 and "Noturno" 17:30–17:30; the student's `manha` (js/rules.js:12-27) admits the starts of periods 0–3, PA-34 12:00 and 12:30 included. Instructor and student would mean different things by the same word |
| 5. If today's meaning is kept (D6) | a "latest start" cannot express presence for free minutes (mapa-invas §5.7): the shape would have to change again |
| 6. What commit 1 stores | "latest start 11:30" while the engine refuses the 2 h simulator at 11:30: the name would not say what the engine does |

With `[de, ate)` and the conversion of D3: none of the six, under either rule.

**D3. Conversion from `aw`: each run i..j becomes `{ de: T[i], ate: fim(j) }`. Two functions, on purpose.**
- `faixasDasJanelas(aw)` is strict: exactly nine items (only `true` counts), else `TypeError`. The engine's reader, the
  turnos and the old History payloads use it.
- `normalizarFaixas(valor, { janelas })` is for stored content and never throws: a list is cleaned (D1); without a
  list, nine `janelas` are converted; without either, all periods (`06:30–24:00`), which is how an unreadable `aw` is
  treated today (js/storage.js:146; js/dias.js:94). `juntar`, the normaliser, step 27 and the copy to a new date use it.
- Why two: "anything unreadable means all periods" is a storage rule; inside the engine it would turn a missing
  availability into "available day and night" (D5). Table in §2.3.

**D4. One format number for C: 27, a `dia` step that adds `faixas` and keeps `aw`.** `aw` stays in the stored day as
the copy of before: `separar` writes it back unchanged while the day has it; nothing reads it once `faixas` exists; it is
not carried to new dates.
- Why: "never delete fields"; the repo keeps `lv` and `cadastro.cursos` this way (js/dias.js:40-42, 51); it is the
  ground truth if the conversion ever has to be redone.
- Evidence: the upgrade writes `migrarDia(dia)` directly, not through `separar` (js/storage.js:389-392); every read
  passes through `migrarDia` first (js/storage.js:185-190).
- Rejected: dropping `aw` at the next save (legal by the letter, but it destroys the original at the first edit of each
  day); a derived `aw` kept in sync (dead code writing dead data).

**D5. Commit "dados": today's rule, written over ranges, behind one reader; the engine stays loud.**
- `disponivelPara(x, a, b)` in the new pure module `js/disponibilidade.js`: with `a0 = max(a, T[0])`, true when
  `b <= a0` or one range has `de <= a0 && b <= ate`. The `max` and the first clause reproduce "time before 06:30 belongs
  to no period" (mapa-motor §5.4; the take-off lists accept 06:00, js/horarios.js:17-25). `cobre` (js/viabilidade.js:17)
  is deleted; js/viabilidade.js:54 becomes `x.on && disponivelPara(x, a, b)`. Its seven callers (js/engine.js:202, 429,
  674, 848; js/compactar.js:195; js/candidatos.js:113; js/instrutor-escolhido.js:62) do not change.
- `faixasDoInstrutor(x)` is the single reader: `x.faixas` when it is an array, else `faixasDasJanelas(x.aw)`.
- **The engine's input contract, stated:** every instructor with `on` carries `faixas` (normalised) or `aw` (nine items).
  With neither, the first availability check throws, as the engine throws today without `aw` (posicao A5; mapa-motor
  §5.1). Processamento (E, G) passes `on` and `faixas` through and never invents them.
- Who relies on the fallback: the 40 generated scenarios, the frozen `exemplo-estado.json`, the unit builders
  (`test/helpers/montar.js:7`, `estado.js:29`, `exemplo.js:24`), the seed scripts (`scripts/semear-previa.mjs:23`).
  Precedent: `minutoDaPreferencia` still reads the period indexes of before format 12, which the goldens use
  (js/horarios.js:62).
- Proof obligation: `git diff --stat` of the commit shows nothing under `test/fixtures/goldens-do-motor/` (42 files) and
  no change in `test/unit/engine.golden.test.js`, `test/helpers/goldens.js`, `scripts/capturar-goldens-motor.mjs`; in
  `test/helpers/cenarios.js` only an added generator (§6), `gerarCenario` untouched, so the 40 `hash` lines still pass
  (test/unit/engine.golden.test.js:19-23). Measured: with the strict reader the 42 golden tests pass.
- Rejected: converting the state inside the golden test (the test would no longer run the engine on its recorded
  input); switching the generator to `faixas` (40 `hash` lines change with no rule change, mapa-motor §5.2); a fallback
  inside the engine that fails open (the first version of this note; code review).

### The rule

**D6. The meaning stays "presence" by default: a mission must fit whole inside one range. The change to "a mission
may START inside a range" is designed (D7 to D9) and is made only with Pedro's explicit yes: "go with defaults" does not
cover it.** This departs from posicao B6 and from the request's wording ("ranges of earliest and latest mission start
time"); §7, and question 1 of §8.
- Why, all measured unless marked:

| Under the start rule | Evidence |
|---|---|
| Nothing bounds how far a mission runs past the range except its own duration (up to 5 h, js/config.js:92) and the legal limits | "Manhã" (06:30–12:40), a 4 h Navegação asked at 11:30: placed 08:20–12:20 under presence, 11:30–15:30 under start. (reviews) a 4 h Multimotor asked at 12:30 goes from 08:30–12:30 to 12:30–16:30; a 5 h simulator from 06:30–11:30 to 11:30–16:30 |
| No range can say "free by HH:MM" | C152, C172 and simulator share the same eight take-off times (js/horarios.js:10-13): a 1 h and a 4 h mission at 11:30 are the same start. Ending the range before 11:30 also removes the 1 h flight |
| The request's own example, "a lunch break", is not a break | ranges 06:30–11:30 · 12:40–17:30, a 2 h simulator asked at 10:10: 08:20–10:20 under presence, 10:10–12:10 (through the gap) under start |
| Cutting a range during the day stops flagging approved flights | an approved 13:40–14:40 flight, the INVA's range cut to end at 14:00: conflict `instrutor-indisponivel` with Sugestões under presence, no conflict under start (js/engine.js:429) |
| The size | on the 40 generated scenarios, 110 of 735 rows run past the end of the range they start in: by a median of 70 min, mean 73, maximum 230; 56 by more than 1 h, 24 by more than 2 h. Minutes spent outside any range: median 50, maximum 130, 43 rows over 1 h |
| Every stored date that is not approved changes at its next edit | a saved date keeps its schedule until its next change, then the engine runs with the rule in force (mapa-motor §5.6) |

- What the request wants from the new model is met without the rule change: free minutes. "13:30–15:10" gives the
  PA-34 its 13:30 and 14:00 take-offs and the C152 and C172 the 13:40 one (§2.3), which the nine periods cannot express.
- It costs nothing to wait: the shape serves both rules (D1), no stored number is converted (D7), and the rule is one
  function, four texts and the goldens. Made by default it would reach every stored date at once.
- Rejected: start as the default (the first version of this note, following posicao B6). Its mitigation ("the operator
  answers by shortening ranges") does not hold for mixed durations, as the second row shows.

**D7. The commit "regra", if Pedro says yes: `disponivelPara` becomes `b <= a0 || one range has de <= a0 && a0 < ate`.**
- One rule for flights, simulator, Ground and the Noturno; a pinned flight is checked on its scheduled `a`
  (js/engine.js:429); the return leg of yesterday's Noturno stays unchecked (js/engine.js:370-393).
- The clause `b <= a0` stays: without it the rule refuses what today accepts in 199,680 of 5,345,280 cases, all of them
  missions that end at or before 06:30 (measured; code review). With it: 0 refusals, 1,811,232 new acceptances.
- No stored number is converted and the generator stays untouched: the 40 `hash` lines stay identical, so the diff of
  the goldens is the rule and nothing else. Rejected: shortening every range by the shortest flight (`ate − 60`): it
  writes times nobody typed and still changes every longer mission.
- Measured on the 41 goldens: 37 files change (`exemplo`, `cenario-04`, `-13`, `-16` do not); flight rows 749 → 756; 282
  rows change time, resource or instructor, 15 enter, 8 leave; rejections 174 → 167; of the 110 rows past the end, 66 are
  flights, 26 Ground and 18 simulator; 0 rows start outside a range.
- Existing unit tests whose expectation changes: 6, in 4 files (4 by the rule, measured; 2 more by the texts of D9,
  code review), plus the oracle test of the new file (§6).

**D8. How that golden diff is reviewed and how the commit reaches production.**
- Two machine checks land in the same commit: the invariant "every row starts inside a range of its instructor" over
  the generated scenarios, and the property "the new rule never refuses what the nine-period rule accepted" (512
  patterns × the 10-minute grid, starts before 06:30 included).
- The PR carries the table of `node scripts/medir-escalas.mjs` run before the re-record, the numbers of D6 and D7, and a
  person reads the 8 flights that left (`cenario-09`, `-11`, `-17`, `-24` ×2, `-27` ×2, `-35`) and a sample of the 110.
- Deploy: no format number (the stored numbers do not change; the two-day Noturno shipped that way). Merged when the
  date being built is approved (approval pins every flight, js/fixos.js:59-69), with Pedro present. The operator is told
  that a range now limits when a mission starts, that an INVA with a partial range can get a mission that ends after it,
  and which INVAs those are on the open dates (the list filter of §2.10).

**D9. Its texts.** Four engine strings state the whole-flight rule: js/engine.js:955 ("…durante o voo inteiro nos
horários possíveis", two variants; 12 golden alerts in `cenario-07`, `-21`, `-25`, `-39`) and :759 ("…durante as 01h30
nos horários possíveis", two variants; no golden) become "…disponível para começar o voo…" and "…para começar a aula…".
The same commit changes the hint and the glossary text of §2.11, the Manual sentences that state the rule
(index.html:529, :565, :570, :574), and `oQueCabe`, which then also shows, per list, how late a mission may end.
Unchanged under either rule: js/engine.js:242, :577; js/conflitos.js:38; every text about open and closed times (they are
about `win`).

### Writers and the History

**D10. "Vem" (`on`) stays a stored per-date switch beside the ranges**, with its History entry and its revert
`setInsOn` (js/eventos/cadastros.js:143-147). Off keeps the ranges for when it is turned on again. Why: `on` alone
decides who counts in the hours split and in `sem-instrutor-habilitado`, and gives different texts and codes
(mapa-motor §5.4). Rejected: deriving it from "no range". It is distinct from the cadastro flag `inativo` (posicao B5).

**D11. Defaults stay as today.** New INVA: `06:30–17:30` (today the eight day periods, js/eventos/cadastros.js:75).
INVA with no entry in a stored day: on, `06:30–24:00` (today all nine, js/dias.js:94). The difference is today's
(mapa-invas §5.1); question 6 of §8.

**D12. Every writer of `aw` has one successor** (§2.5).

**D13. "Marcar <nome> disponível às HH:MM" keeps its place.** In the commit "dados", while the grid is still the
screen, it turns on the periods the flight touches, so the grid shows what it did. From the commit "tela" on it adds the
flight's own interval `[a0, b)`, which clears the blocker under either rule. A flight that ends by 06:30 adds nothing:
turning "Vem" on is enough (D5).

**D14. The History: old reverts keep working, and range edits gain an entry with a revert.**
- `disponibilidadeDeAntes` (js/reversoes.js:38-40) accepts the new payload `{ insId, on, faixas }` and the old
  `{ insId, on, aw }` with exactly nine booleans, and always returns `{ insId, on, faixas }`; `desfazerAgendamento`
  (js/reversoes.js:186-189) restores `on` and `faixas`. No History row is rewritten (no step reaches the History,
  mapa-dados §5.3).
- From the commit "tela": every write of an INVA's ranges from the screen is one entry, "Faixas de <nome>: 06:30–11:30 ·
  12:40–17:30", with the revert `{ kind: 'setFaixas', insId, faixas: <the ranges of before>, label: '↶ Reverter' }`.
  Why (review): a turno replaces every range of the date, a period chip on a free-minute range is not undone by a second
  click (§2.6), and typed times are easy to get wrong; today the cells write no entry (js/eventos/cadastros.js:179-181).
  Question 7 of §8.

### The screen

**D15. The date's overview of the INVAs is the list itself; there is no board.** Each row says whether he comes, his
ranges and his flights, carries "Vem" as a quick toggle (desenho-cadastros D11, D12) and a nine-cell strip drawn from the
ranges with his flights on it, so the times line up down the list as the grid's columns do today.
- Why: one answer shared with desenho-cadastros and desenho-entrega; the request replaces the wide tables; and a board
  cannot be the detail of a pinned item: the grid needs 960 px (css/app.css:1044) and the detail pane has about 599 px
  (48% of the 1,248 px that posicao B4 keeps for the two content panes). It would be an overview spanning both panes, a
  second surface for the same switches.
- The cost is counted in §2.7 (one selection more per INVA whose periods change; half as many INVAs per screen) and is
  question 5 of §8, the same question as desenho-cadastros 8.3.
- Rejected: the board "Disponibilidade nesta data" as a pinned first item (the first version of this note). Its e2e
  argument (13 uses of `[data-f="on"]` in 8 files) ends with F0a, which puts that selector behind `alternarVem`.

**D16. Whole periods and turnos stay one click: nine period chips and five turno buttons in the INVA's "Nesta data"
block, with exact arithmetic on the ranges.** A chip adds or takes out `[T[k], fim(k))`; nothing is rounded to the
periods.
- Why: the daily pass (§2.7). Without them a lunch break on a period is six interactions, two of them typed (select,
  "Editar faixas", the end, "+ Faixa", the new start, "Salvar faixas"), against one today.
- Evidence (measured): on ranges aligned to the periods, `alternarPeriodo` equals toggling the cell of today's grid in
  all 4,608 pattern × period pairs.
- Rejected: only typed ranges (the first version); a select "Aplicar turno…" (two interactions where a button is one).

**D17. Typed ranges are a draft saved by "Salvar faixas"; nothing is written on `change`.**
- Why (reviews, Chromium): a time field fires `change` on every keystroke that yields a valid time and not on blur.
  Keys 1, 4, 3, 0 over 12:40 fire it with 01:40, 14:40, 14:03, 14:30. The first version saved on `change`, merged and
  redrew: typing 13:10 over the second "Das" of 06:30–11:30 · 12:40–17:30 stored "01:40–17:30" at the first key. Playwright's
  `fill()` fires one `change`, so the planned e2e would have passed.
- Evidence: every `change` of a `[data-f]` inside `[data-k]` reaches a handler and a save (js/eventos/registro.js:37-52;
  js/actions.js:166-195). No time field of the app saves on `change`: the take-off editor is a draft with "Adicionar",
  Enter and "Salvar" (js/views/horarios.js:1-4, 88; js/eventos/recursos.js:192-224); the other two sit in dialogs with a
  confirm button (index.html:740; js/views/dialogo-status.js:26).
- How: the two time fields carry no `data-f` and no `data-a`, so `registro.js:39` ignores them; "Salvar faixas" and
  "Cancelar" are `data-act` buttons, so `registro.js` stays the single gate; validation, sorting and merging run once, at
  the save (§2.6).
- Rejected: committing each field on `focusout` or Enter (changing both ends of a range passes through `de >= ate`; on
  phones the moment a native picker gives up the focus is not ours to define).

**D18. Free minutes.** `input[type=time]` with `step="300"`, any minute accepted, from 06:30 to the end of the day, as
the take-off editor does (js/views/horarios.js:88). Rejected: only the take-off times (the lists differ by category and
are edited, so a stored end would go stale, and an arrival time is not a take-off time).

**D19. Neither the ranges nor the closed periods are locked on an approved date, as today.** A change puts the pinned
flights it breaks in conflict (`instrutor-indisponivel`, `horario-fechado`) with their Sugestões: that is how the
operator handles an INVA who leaves early on the day (js/engine.js:429, 446). Under the start rule the first of the two
stops working for a range cut after the flight's start (D6).

### Delivery

**D20. C is one PR (`linha-c-invas`, from F2, rejoined on B), never ahead of F3: commits "dados", "tela", "texto";
"regra" is the last one and exists only with Pedro's yes.**
- Why: format 26 is F3's step, and merging 27 before 26 leaves `PASSOS[26]` missing (js/migracoes.js:227: the app does
  not open); F0a and F0b have already split the files C edits; and with one PR the grid drawn over ranges exists only
  between two commits, never in production, so one number is enough (mapa-dados §5.3: changes that reach `main` in one
  merge share a number).
- "texto" is the text-only golden commit of desenho-entrega decision 15 (`js/engine.js:961` names "Instrutores ›
  Cadastro", a view the commit "tela" removes; 7 alerts of `cenario-06.json`). It is not a rule change, never rides in
  "regra", and needs the yes that desenho-entrega question 5 asks for.
- "regra" can also be its own PR at any later date: it needs no number (D8).
- Rejected: commits "dados" and "regra" as an early PR (the first version; 26 does not exist then, and the operator
  would have the new rule on the old grid).

### Janelas de operação

**D21. The section leaves Recursos; `dia.win` and the engine's reads stay.** 22 golden inputs close a period and 18
golden files change if the engine stops honouring them (mapa-motor §5.2); the engine throws without `state.win` (posicao
A5). The shape, `separar`, `juntar` and the normaliser do not change; no format number.

**D22. Closing a period for one date is the same nine switches, in the Escala stage: `details#periodos`, placed by B
in the commit that deletes `#wins`; H1 moves the list into `#restricoes` with ids and handler unchanged.**
- One markup for the three notes: `input.sw[data-a="win"][data-i]` and `aoMudarCampo('win', …)` keep their names
  (desenho-escala-aprovar 2.4 and its row "moved (H1)"; desenho-entrega 2.8: "one click per period").
- It is a block of its own between the two bars of `#s-esc`, **not inside `#compactacao`**: that bar is hidden while the
  date has no flight and no approval (js/views/escala.js:394-399), and a date with every period closed has no flight, so
  the control to reopen would disappear with it.
- Rejected: the select "Fechar um período…" with chips (the first version: an action that fires on `change`, school-wide,
  beside two selects that only filter the view; reviews); the right rail (it collapses into a date button, posicao B4);
  leaving it in Recursos (the request removes it).

**D23. `win` is no longer copied to new dates** (posicao B6): `diaParaCopiar` starts every new date with the nine
periods open. Dates already stored keep what they have, visible in the summary of `#periodos`. The default is settled by
a read-only count on the stored days before B merges (question 4 of §8): if the same period is closed on runs of dates,
closings are standing ones and the copy stays.

**D24. Dropping the capability was costed and rejected** (§2.8, last table).

**D25. The e2e "data loaded" signal is `body[data-pronto]` from F0a on, before B.** `abrir` (test/e2e/fixtures.js:65)
and the nine repeated waits each follow a page load, and js/main.js:126-142 draws `#wins` and sets `data-pronto` in the
same synchronous block, so the two signals are equivalent there (code review). The History texts become "Período das
HH:MM fechado nesta data" and "Período das HH:MM reaberto nesta data"; entries already stored keep "Janela HH:MM
ativa|inativa" (the History only grows; they have no revert).

**D26. The other roles of the nine periods stay** (§2.9). On the two screens of this topic the word is "período";
"janela" leaves their user-facing text; "tempo" stays in the Escala's group headers (`WLB`, js/format.js:7).

**D27. Manual, glossary, README and their tests change in the step that changes each behaviour** (posicao B8); §2.11
and §5.

## 2. How it works

### 2.1 Data

```
dia.ins[<id>]  = { on: true, faixas: [{ de: 390, ate: 690 }, { de: 760, ate: 1050 }], aw?: [9 booleans] }
S.ins[i]       = { id, nm, kg, hab, …, on, faixas, aw? }        // aw: only the copy a converted day carries
dia.win        = [9 booleans]                                    // unchanged
reverts        = { kind: 'desfazerAgendamento', …, disponibilidade: { insId, on, faixas } | null }
                 // stored before format 27: { insId, on, aw[9] }, still accepted
                 { kind: 'setFaixas', insId, faixas: [≤ 8 ranges, already normalised], label }   // new, commit "tela"
```

### 2.2 `js/disponibilidade.js` (new, pure, imports only `js/config.js`)

It enters the engine's closure through js/viabilidade.js and js/migracoes.js (24 modules become 25), and the TV's through
js/migracoes.js (`js/painel.js` imports it, measured): F0b's `test/unit/grafo-da-tv.test.js` gains the module in the
commit "dados". Each export appears in the commit of its first user in `js/`, because the unused-exports lint refuses an
export only tests import (scripts/exportacoes-sem-uso.mjs:126-142).

| Export | Commit | Does | First users in `js/` |
|---|---|---|---|
| `faixasDasJanelas(aw)` | dados | D3, strict | the reader; `faixasDoTurno`; js/reversoes.js |
| `normalizarFaixas(valor, { janelas } = {})` | dados | D3, for stored content; idempotent; cuts at 06:30, at 1440 and at 8 ranges | js/dias.js, js/storage.js, js/migracoes.js, js/reversoes.js |
| `faixasDoInstrutor(x)` | dados | the single reader (D5) | `disponivelPara`; js/dias.js (`separar`); js/agendamento.js |
| `disponivelPara(x, a, b)` | dados | the rule (D5; D7 only with the yes) | js/viabilidade.js |
| `faixasDoTurno(nome)` | dados | `faixasDasJanelas(WIN.map((_, i) => PRE[nome].includes(i)))`: the five turnos come from `PRE` (js/config.js:118-124), which stays for the student's periods | the instructors' events (new INVA, turno) |
| `periodoNasFaixas(faixas, k)` | dados | "inteiro" (the period lies whole inside a range), "parte" (it overlaps one) or "fora" | the grid's cells, then the chips and the strip |
| `alternarPeriodo(faixas, k)` | dados | "inteiro": takes `[T[k], fim(k))` out; otherwise: adds it. Exact on any ranges | the cell handler, then the chip handler |
| `comAFaixa(faixas, faixa)` | dados | `normalizarFaixas([...faixas, faixa])` | js/agendamento.js |
| `descreverFaixas(faixas)` | tela | "06:30–12:40 · 13:40–17:30"; 1440 prints "24:00"; `[]` prints "sem faixa" | the row, the block, the History text |
| `turnoDasFaixas(faixas)`, `mesmasFaixas(a, b)`, `proximaFaixa(faixas)` | tela | the turno of `PRE` whose ranges equal these, or `null`; equality; what "+ Faixa" proposes, or `null` | the block and its events |
| `oQueCabe(x, horarios)` | tela | per list (C152, C172, Simulador, PA-34, Ground, Noturno), the take-off times `disponivelPara` accepts for the default duration (1 h; simulator 2 h; Ground 01h30; Noturno 4 h, js/rules.js:76-80): correct under either rule by construction | the block |
| `MAXIMO_DE_FAIXAS = 8` | tela, only if the editor imports it | bound | — |

### 2.3 The nine periods as ranges

| Periods on | `faixas`, as `de`–`ate` in minutes | On screen |
|---|---|---|
| 0–7 ("Dia inteiro"; a new INVA) | 390–1050 | 06:30–17:30 |
| 0–3 ("Manhã") | 390–760 | 06:30–12:40 |
| 4–7 ("Tarde") | 760–1050 | 12:40–17:30 |
| 8 ("Noturno") | 1050–1440 | 17:30–24:00 |
| 0–8 ("Dia + noturno"; no entry in the day; unreadable `aw` in stored content) | 390–1440 | 06:30–24:00 |
| 0–2 and 4–7 (11:30 off) | 390–690 and 760–1050 | 06:30–11:30 · 12:40–17:30 |
| only 5 | 820–870 | 13:40–14:30 |
| none | `[]` | sem faixa |

What each rule accepts, as `oQueCabe` prints it (measured, default lists and durations):

| Ranges | Presence (today, and the default) | Start (only with the yes) |
|---|---|---|
| "Manhã" | C152 and C172: 06:30 a 11:30 (4) · Simulador: 06:30 a 10:10 (3) · PA-34: 06:30 a 11:30 (11) · Ground: 06:30 a 10:10 (3) · Noturno: não | Simulador and Ground: a 11:30 (4) · PA-34: a 12:30 (13); the rest equal |
| "Dia inteiro" | C152 and C172: a 16:20 (8) · Simulador and Ground: a 14:30 (7) · PA-34: a 16:30 (21) · Noturno: não | Simulador and Ground: a 16:20 (8), ending after 17:30; the rest equal |
| 06:30–11:30 · 12:40–17:30 | C152 and C172: 7 · Simulador and Ground: 5 · PA-34: 17 | Simulador and Ground: 7 · PA-34: 18 |
| 13:30–15:10 | C152, C172 and Ground: 13:40 (1) · PA-34: 13:30 a 14:00 (2) · Simulador: não | C152, C172, Simulador and Ground: 13:40 a 14:30 (2) · PA-34: 13:30 a 15:00 (4) |
| "Dia + noturno" | everything of "Dia inteiro", Simulador and Ground a 16:20 (8), Noturno: 17:30 | the same |
| any, a take-off at 06:00 | accepted when a range starts at 06:30 (the part before 06:30 is not checked) | the same |

### 2.4 Where the day is read and written (commit "dados")

| Place | After |
|---|---|
| `separar` (js/dias.js:58) | `{ on: x.on, faixas: faixasDoInstrutor(x).map(f => ({ ...f })), ...(Array.isArray(x.aw) ? { aw: [...x.aw] } : {}) }`. The reader, so a state built with only `aw` (seed scripts, tests) still saves; with neither it throws, as `[...x.aw]` does today |
| `juntar` (js/dias.js:92-95) | `faixas: normalizarFaixas(d && d.faixas, { janelas: d && d.aw })`, plus `aw` when the day has nine; no entry: on, all periods |
| `diaParaCopiar` (js/dias.js:118-123) | each instructor copied as `{ on, faixas }` only. Same statement as B's change of `win`: B merges first, C rebases on it (§5) |
| `normalizeAndMigrateState` (js/storage.js:146; the legacy block at :125 stays) | `i.faixas = normalizarFaixas(i.faixas, { janelas: i.aw })`; `i.aw` kept only when it is nine items |
| `PASSOS[27].dia` (js/migracoes.js) | for each `dia.ins[id]` that is an object without an array `faixas`: `{ ...d, faixas: normalizarFaixas(undefined, { janelas: d.aw }) }`; everything else untouched (`null`, `{}`, `importado`, `simulado`, non-object items, a day without `ins`) |

### 2.5 Every writer of `aw` today, and what it becomes

| Writer today | Becomes | Commit |
|---|---|---|
| New INVA: eight day periods (js/eventos/cadastros.js:75) | `faixas: faixasDoTurno('Dia inteiro')` | dados |
| One cell of the grid (`[data-f="aw"][data-w]`, js/eventos/cadastros.js:173-174) | dados: the cell is drawn from `periodoNasFaixas` and writes `alternarPeriodo(x.faixas, w)`. tela: gone; the period chip writes the same | dados, then tela |
| "Aplicar turno…" (`select[data-f="pre"]`, :175-177) | dados: `x.faixas = faixasDoTurno(t.value)`. tela: five buttons `[data-act="faixas-turno"]` | dados, then tela |
| Booking "Marcar disponível" (js/agendamento.js:934-939) | keeps `x.on = true`; stores the previous `{ insId, on, faixas }`; D13 | dados, then tela |
| "↶ Desfazer" of that booking (js/reversoes.js:188) | restores `on` and `faixas`; old payloads converted on read (D14) | dados |
| `juntar`, `separar`, `diaParaCopiar`, the normaliser | §2.4 | dados |
| Legacy 7-period conversion (js/backends/local.js:76) | unchanged: it produces the oldest format, which step 27 converts | — |
| "Vem" (`[data-f="on"]`), its History entry and "↶ Reverter" | unchanged | — |
| (new) typed ranges | the draft and "Salvar faixas" (§2.6) | tela |

### 2.6 The INVA's "Nesta data" block (commit "tela")

One component, `js/views/disponibilidade-do-dia.js`, mounted by the cadastros design as the first block of "Nesta data ·
sex 20/11" in the INVA's detail (`#det-ins[data-k="i"][data-id]`), with its handlers in
`js/eventos/disponibilidade-do-dia.js` (imported by `js/eventos/instrutores.js`; `js/main.js` is not touched). The rule
the operator learns is the app's: **what is one click is saved at once; what is typed has a "Salvar"** (as "Disponível"
and the take-off editor in Recursos).

**Read state**

| Part | Element | Saves |
|---|---|---|
| "Vem nesta data" + "?" `vem-nesta-data` | `label.alvo > input.sw[type=checkbox][data-f="on"]`, aria-label "<nome> vem no dia" (unchanged) | at once, as today (History, `setInsOn`) |
| "Faixas" + "?" `faixas-do-instrutor` | `span.faixas-texto`: `descreverFaixas`, or "Sem faixa nesta data: não recebe missão." | — |
| "Turno" | `div.turnos.edit-only[role=group]`, five `button.btn.quiet[data-act="faixas-turno"][data-turno]` ("Dia inteiro", "Manhã", "Tarde", "Noturno", "Dia + noturno"); `aria-pressed="true"` on the one `turnoDasFaixas` names; aria-label "Manhã: 06:30 às 12:40" | at once: `x.faixas = faixasDoTurno(nome)` |
| "Períodos" | `div.periodos-do-inva.edit-only[role=group]`, nine `button.periodo-chip[data-act="faixas-periodo"][data-w]` showing the start time; `aria-pressed` "true" (inteiro), "mixed" (parte), "false" (fora); class `voo` when a flight or class of his overlaps the period; aria-label "<nome>: período das 11:30 às 12:40, disponível" ("em parte", "fora da faixa"; ", com voo ou aula") | at once: `x.faixas = alternarPeriodo(x.faixas, w)` |
| legend | `p.legenda-periodos`: "disponível · em parte · fora da faixa · com voo ou aula na escala"; the three fills differ in pattern, not only in hue | — |
| "Editar faixas" | `button.btn.quiet.edit-only[data-act="faixas-editar"]`, aria-label "Editar as faixas de <nome>" | opens the draft |
| "O que cabe nestas faixas" | `details.faixas-cabe`, from `oQueCabe` (the lines of §2.3). It is where the 06:30 rule shows: a list with a 06:00 take-off lists it for a range that starts at 06:30 | — |
| "Na escala desta data" | `ul.voos-do-instrutor` (time, student, mission, resource) | — |

Every one-click write is `gravarAlteracao('mod', 'Faixas de <nome>: <descreverFaixas>', { kind: 'setFaixas', … })` (D14),
then `anunciar` the same text.

**Draft state** ("Editar faixas" swaps the text, the turnos and the chips for the form; the take-off editor's pattern,
js/views/horarios.js)

- `fieldset.faixas-edicao > legend` "Faixas de <nome> nesta data"; `ol.faixas-lista > li.faixa[data-i]`, each with "Das"
  `input[type=time][step=300].faixa-de` (aria-label "Início da 1ª faixa"), "até" `input[type=time][step=300].faixa-ate`
  and `button.x[data-act="faixa-tirar"][data-i]` (aria-label "Tirar a 1ª faixa"). **No `data-f`, no `data-a`.**
- `button.btn.quiet[data-act="faixa-por"]` "+ Faixa": with no range, 06:30–17:30; otherwise from one hour after the last
  end to 17:30 (to 24:00 when that start is 17:30 or later); `aria-disabled` when no half hour is left or there are 8.
- `p.h#faixas-dica`: "A missão precisa caber inteira numa faixa, das 06:30 às 24:00 (para o fim do dia, 23:59)."
- `p.erro-campo#faixas-erro[role=alert]`; `button.btn[data-act="faixas-salvar"]` "Salvar faixas";
  `button.btn.quiet[data-act="faixas-cancelar"]` "Cancelar".

| State or rule | Behaviour |
|---|---|
| The draft | `{ data, insId, linhas: [{ de, ate }] as typed text, base }`, one per INVA, in the view module's memory; lost on reload. A module listener on `input` copies the field into the draft: no validation, no redraw, no save |
| Typing | nothing is checked or redrawn while a field has the focus; intermediate values (01:40) are only text in the draft |
| "Salvar faixas", or Enter in a time field | once: every row has both times ("Informe o início e o fim de cada faixa (hh:mm)."); none starts before 06:30 ("As faixas vão das 06:30 às 24:00."); `de < ate` ("O fim da faixa vem depois do início."); the first row in error gets `aria-invalid` and the focus. Then `mesmasFaixas(x.faixas, base)`, else nothing is saved: "As faixas de <nome> mudaram depois que a edição abriu: nada foi salvo. Confira e edite de novo." (as js/eventos/recursos.js:187-202). Then `x.faixas = normalizarFaixas(…)`, one `gravarAlteracao`, the draft closes |
| After the save | the focus goes to "Editar faixas"; `#anuncio` says the result, and says so when ranges were joined ("Faixas de <nome>: 06:30 às 14:30 (duas faixas viraram uma).") |
| "Cancelar", or Esc inside the form (`fecharNoEsc`) | discards the draft; the focus goes to "Editar faixas" |
| End of the day | the field shows and takes "23:59" for 1440; the text says "24:00" |
| A redraw while a draft is open (another save, the schedule redone) | while one of the form's fields has the focus, the `fieldset` node is left as it is and the rest of the block is drawn around it: a time field with the focus is never replaced. Otherwise the form is drawn again from the draft's text, as `rHorarios` keeps the typed time (js/views/horarios.js:112-128) |
| A chip in the state "parte" | the click adds the whole period; a second click then takes the whole period out, which is not the ranges of before: "↶ Reverter" in the Histórico is the way back (D14) |
| Another INVA selected | the draft stays; the row shows "faixas em edição" (as desenho-cadastros D17 and D22 keep their drafts) |
| The date changes | every draft is discarded, with the toast "A edição das faixas de <nome> foi descartada: a data mudou." |
| A chip or turno that would make a ninth range | refused: "No máximo 8 faixas: junte ou tire uma antes." |
| "Vem" off | the block is dimmed and stays usable (today's `tr.off`) |
| Approved date | not locked (D19) |
| Gestor, Secretaria | text, strip and lists; the `.edit-only` controls are hidden; "Vem" is `disabled` by js/somente-leitura.js |
| Before the date's data is read | `registro.js` refuses every action; the Enter listener calls the same function, which starts with `isGestor() \|\| aindaNaoAbriu()` |
| Phones, 320 px | chips and turnos wrap, each 44 × 44; one `li.faixa` per line, labels above the fields, the ✕ at 44 × 44; no sideways scroll. Native pickers change nothing here: no field saves |

**The row of the list** (owned by the cadastros design; this topic supplies the parts)

| Part | Content |
|---|---|
| third line | "20/11 · vem 06:30–11:30 · 12:40–17:30 · 3 voos", or "20/11 · não vem"; "faixas em edição" while a draft is open |
| "Vem" | the quick toggle `input.sw[data-f="on"]` of desenho-cadastros D11, the same control as in the block |
| strip, under the three lines | `span.tira[aria-hidden="true"]` from `tiraDoDia(x, voos)`: nine cells of equal width, one per period, each "inteiro", "parte" or "fora", with the mark `voo`. Not interactive; the text of the third line says the same |

### 2.7 What the daily pass costs

Interactions; T = a typed time; the date starts as a copy of the last saved day, before and after.

| Action | Today (grid) | After (list and detail) |
|---|---|---|
| Open the screen | 1 | 1 |
| An INVA does not come | 1 | 1, on the row |
| A turno | 2 (open the select, choose) | 2 (select the INVA, the button) |
| A whole period on or off (a lunch break on a period; leaves a period earlier) | 1 per period | 1 selection + 1 per period |
| One end at a free minute ("from 13:30"; "leaves at 15:00") | not possible | 4: select, "Editar faixas", 1 T, "Salvar faixas" |
| A break at free minutes (12:00–13:00) | not possible | 5: select, "Editar faixas", 1 T (the end, 12:00), "+ Faixa" (proposes 13:00–17:30), "Salvar faixas" |
| Further changes to the same INVA | — | no new selection |

| A day | Today | After | With an overview board (question 5) |
|---|---|---|---|
| Light: 1 does not come, 1 leaves two periods earlier | 3 | 4 | 3 |
| Typical: 3 do not come, 2 turnos, 1 lunch break on a period | 8 | 9 | 8 |
| Heavy: 5 do not come, 4 turnos, 3 INVAs with two periods changed | 19 | 22 | 19 |
| The same heavy day plus one "from 13:30" | not possible | 26 | 23 |

| Reading | Today | After |
|---|---|---|
| INVAs on one screen | a grid line is about 34 px (css/app.css:1045, 1059) | a three-line row is 72 to 80 px (referencias-visuais §1): about half as many |
| "Who is around at 14:30?" | one column of the grid | the same column of the strips down the list; exact times in each row's text |
| "Who can take this flight?" | not answered by the grid | the booking dialog's instructor list and Sugestões, unchanged (js/candidatos.js) |
| Only the ones that differ today | not possible | the filter "Nesta data" of §2.10 |

### 2.8 Períodos fechados (step B)

Markup, in `#s-esc`, after the first `.bar` (index.html:346-362) and before `#compactacao` (:366):

- `details.pn.periodos#periodos`, with `summary` "Períodos fechados nesta data: " + `span#periodos-resumo` ("nenhum", or
  "11:30 · 12:40"). Drawn open when the date opens with a period closed, closed otherwise; after that the browser keeps
  what the person chose.
- inside: `button.dica-btn[data-dica="periodos-fechados"]`; `div.periodos-lista#periodos-lista` with nine
  `label.periodo[.off] > input.sw[type=checkbox][data-a="win"][data-i]` + `<b>11:30</b> <small>4º</small>` ("noturno" on
  the last), aria-label "Período das 11:30 às 12:40"; checked = open, as today.

Code: `js/views/periodos.js` (`rPeriodos()`, registered as the screen `periodos` for the moments "dados" and
"consulta") and `js/eventos/periodos.js`, which takes `aoMudarCampo('win', …)` from js/eventos/recursos.js:115-120:
`S.win[i] = t.checked`; `gravarAlteracao(t.checked ? 'inc' : 'exc', 'Período das 11:30 reaberto nesta data' | '…fechado
nesta data')`; `rPeriodos()`; `redesenharTelas('recursos')` (the struck times of "Horários de decolagem"). The module is
imported by one line of `js/eventos/escala.js`. Read profiles see the list with the switches `disabled`
(js/somente-leitura.js). Not locked by approval (D19).

| Action | Today (Recursos › Disponibilidade do dia) | After (Escala) |
|---|---|---|
| Close or reopen one period | 1 | 1 (2 the first time: the block opens) |
| Close the afternoon | 4 | 4 |
| See what is closed | open Recursos | the summary on the Escala; the count in the Escala card's "Restrições do operador" |
| A standing closing | once (it is copied to each new date) | once per date (D23) |
| A one-off closing | undo it on the next date | nothing |

Readers and writers of `win` that stay:

| Where | Role |
|---|---|
| js/engine.js:446, 601, 811; js/compactar.js:111; js/reparo.js:89; js/agendamento.js:107 | the rule (pins in conflict, Ground starts, take-off candidates, compaction, Sugestões, booking list) |
| js/views/horarios.js:39-47 | the take-off summary strikes the time of a closed period; tip renamed `horario-em-periodo-fechado`, "O período das HH:MM está fechado nesta data.", and the `.sr` text "(período fechado nesta data)" |
| js/dias.js:34, 56, 89; js/storage.js:49, 85; js/backends/local.js:75 | default, save, load, normalisation, legacy conversion |
| js/dias.js:120-122 | changes: a new date gets `WIN.map(() => true)` |
| `test/helpers/montar.js:31` (`janelasOff`), `cenarios.js:85`, `estado.js:36` | unchanged |

Removed by B: js/views/recursos.js:146 (the switches in `#wins`), js/eventos/recursos.js:115-120 (the handler moves),
index.html:166-169, the `.janela` and `.janelas` rules (css/app.css:239, 784-791, 1594; `css/recursos.css` after F0c).

What each option costs:

| | Keep and re-home (this design) | Drop the control, keep the engine's reads | Drop it from the engine too |
|---|---|---|---|
| Code | two small modules, one `details` | `juntar` emits nine `true`; stored closed periods open at the next edit of each date, past dates included | four engine lines, js/compactar.js:111, js/reparo.js:89, js/agendamento.js:107, the code `horario-fechado` kept for saved schedules |
| Goldens | none | none | 18 files in a rule-change commit |
| Tests | 3 e2e tests moved, a few added | the same e2e tests deleted | plus 18 uses of a closed period in 7 unit files (mapa-testes-e-docs §5.3) |
| The afternoon closed by weather | 4 clicks. A request whose availability is one exact time in a closed period leaves the escala with the reason, and needs a new time: every pedido today (posicao A3; measured: "nenhum horário aberto na disponibilidade do aluno (às 14:30) comporta 1 h"). A request with a wider availability moves by itself (measured: to its 2ª preferência, or inside "tarde") | cancel each flight (about 3 interactions each; a cancelled flight is not placed again), or edit every INVA's ranges and restore them the next day | the same |
| No Noturno tonight; no Ground at 16:20; no Voo Solo at 06:30 | 1 click | only by not approving the pedido, or through the night range of each INVA | the same |

### 2.9 The roles of the nine periods that stay

| Role | Evidence |
|---|---|
| The student's "Manhã", "Tarde", "Noite" (`PERIODOS` from `PRE`) | js/rules.js:12-27 |
| Ground start times (the eight day periods) | js/engine.js:454, 601; js/agendamento.js:106; js/reparo.js:75 |
| Default take-off lists, the model "Janelas do dia", the PA-34 from `T[0]` | js/horarios.js:10-13; js/views/horarios.js:24 |
| Noturno at `T[NI]`, Voo Solo at `T[0]`, the 17:30 daylight limit | js/horarios.js:40-52 |
| Default preferences of a request | js/rules.js:82; js/horarios.js:75-78; js/eventos/demanda.js:162-163 |
| The Escala groups "06:30 · 1º tempo", the row's `w`, the "+" of each tempo, Ground class keys, PDF sections | js/format.js:7; js/views/escala.js:526; js/engine.js:388, 520, 819; js/agendamento.js:94-97; js/export.js:59-61; js/escala-gravada.js:32 |
| The Excel row of the Noturno | js/planilha.js:47 |
| `win` and `periodoDoMinuto`; the switches of `#periodos` | §2.8 |
| The turnos, the period chips and the strip of the INVAs; the reading of a state from before format 27; the 06:30 rule | `faixasDoTurno`, `alternarPeriodo`, `periodoNasFaixas`, `faixasDasJanelas`, `disponivelPara` |
| Legacy readings | js/horarios.js:62; js/backends/local.js:71-83 |

The label of the take-off model "Janelas do dia" (js/views/horarios.js:24; js/horarios.js:124) belongs to the Recursos
design; it does not depend on `win`.

### 2.10 What the other topics get from this one, and what they must change if this note stands

| For | Hook |
|---|---|
| The INVAs list (desenho-cadastros D11, D12) | the third line from `descreverFaixas`, the strip `tiraDoDia`, the mark "faixas em edição"; a group "Nesta data" in the list's filter: "vêm", "não vêm", "faixa parcial" (`x.on` and `turnoDasFaixas` neither "Dia inteiro" nor "Dia + noturno") |
| F2 (list component) | a sub-block slot under a row's three lines (the first reference has one) and a text mark on the row. Without the slot the strip lives only in the detail |
| Pipeline and rail (desenho-escala-aprovar 2.9, 2.10) | closed periods are `S.win.flatMap((aberto, i) => (aberto ? [] : [i]))`. The row "Escala · Restrições do operador" exists from F1, before B: until B its click must lead to Recursos for this kind (the switches are still in `#wins`), or the kind stays out of its count; B points it at `#periodos`, H1 at `#restricoes`. Suggested: B adds one rail item of severity info, "2 períodos fechados nesta data" / "11:30 · 12:40", with the same target. "INVAs disponíveis" counts `x.on && faixasDoInstrutor(x).length` |
| H1 | moves `#periodos-lista` into `#restricoes`; `[data-a="win"]`, the handler, the History texts and the driver helper stay |
| Processamento (E, G) | passes `win`, `on` and `faixas` through; D5's contract |
| F0 | `appPronto`; the registry names `periodos` (B) and `instrutores-dia` (it stays, pointing at the redraw of the rows' third line, the strip and the open block, which depend on the schedule) |

| Note | What changes there |
|---|---|
| desenho-entrega 2.3, 5 | B's region of `#s-esc` is a `details` between the two bars, not "beside `#criterios`" (D22). B creates `js/views/periodos.js`, `js/eventos/periodos.js` and `test/e2e/periodos.spec.js`, adds one import line to `js/eventos/escala.js` and does not edit `js/views/escala.js`; this topic does not need C's region `linhasLivres`. `js/dias.js`: C also edits the `ins` of `diaParaCopiar`, rebased on B. `js/reversoes.js`: C adds `setFaixas` right after `setInsOn` (:64), away from B's insertion |
| desenho-entrega 1 (decision 15), 2.6, 2.8, 9.8 | C's golden gate is conditional: "dados", "tela" and "texto" change no flight; the 37 files only with the yes of D6. For the operator, C reads "the nine cells become nine one-click periods and five turnos in the INVA's detail; typing only for free minutes" |
| desenho-entrega 5 (C's ledger) | goes as listed: `table.disp`, `#inst-dia-cab`, `#inst-dia`, `rInsDia`, the select "Aplicar turno…", the glossary term `turno`. Stays: the registry name `instrutores-dia`. Added: `js/disponibilidade.js` in `test/unit/grafo-da-tv.test.js` |
| desenho-escala-aprovar 2.4, 5 | as written there (nine `[data-a="win"]`, block `#periodos`); the list inside is `#periodos-lista` |
| desenho-cadastros 2.5, 3 | "the ranges and the presets … on change" becomes: turnos and periods at once, typed ranges on "Salvar faixas"; the presets are buttons; its question 8.3 and this note's question 5 are one question |

### 2.11 Glossary and Manual texts

Glossary (each under 240 characters, counted; test/unit/glossario.test.js):

| Id (step) | `termo` | `texto` |
|---|---|---|
| `periodos-fechados` (B; replaces `janelas`; group Escala) | "Períodos fechados" | "O período fechado não recebe decolagem nem aula de Ground nesta data (o das 17:30 é o do Noturno). O pedido com horário só nele fica fora da escala, e o voo fixo que cai nele fica em conflito. A data seguinte começa com todos abertos." |
| `horario-em-periodo-fechado` (B; replaces `horario-em-janela-fechada`) | "Horário apagado" | "O horário cai num período fechado nesta data: nesta data, nenhum voo sai nele. Ele continua na lista para as outras datas." |
| `vem-nesta-data` (C tela) | "Vem" | "Marcado, o instrutor vem nesta data (a aberta, que nem sempre é hoje) e pode receber missões dentro das faixas dele." |
| `faixas-do-instrutor` (C tela, new) | "Faixas" | "Os horários em que o instrutor está disponível nesta data: a missão precisa caber inteira numa faixa. Um clique num turno ou num período troca as faixas; Editar faixas aceita qualquer minuto. A data seguinte começa com as mesmas." |
| the same, in the commit "regra" | "Faixas" | "Os horários em que o instrutor pode começar uma missão nesta data; ela pode terminar depois da faixa, e o fim não entra: até 17:30 não inclui o Noturno. Um turno ou um período troca as faixas com um clique." |
| `turno` (C tela) | — | deleted; the block has one "?" |

Manual sentences that state a rule (index.html; after F0c one sentence per line; the word "Desfazer" must not appear,
test/e2e/app.spec.js:142):

| Line | Step | Becomes |
|---|---|---|
| :446, :510, :514-516, :559, :570 ("começa na janela das 17:30"), the hint :207 | B | "períodos": the closing lives in the Escala (`#manual-periodos` under Manual › Escala, in place of `#manual-janelas`); "dentro dos períodos abertos nesta data"; "começa às 17:30" |
| :514, "A disponibilidade dos instrutores e “manhã, tarde e noite” do aluno também valem por janela." | B | "“Manhã, tarde e noite” do aluno também valem por período." The instructors' half goes; the INVAs section states the ranges, in C tela |
| :445, "…com os aviões, as janelas e os horários dos instrutores da anterior" | B, then C tela | B: "…com os aviões e os horários dos instrutores da anterior, com todos os períodos abertos"; C tela: "as faixas dos instrutores". C resolves on B (desenho-entrega 2.4) |
| :447, :521-529 | C tela | the list, "o interruptor Vem" on the row, the block; :529 ends "…e se a missão couber inteira numa faixa dele nesta data." |
| :485, "ele passa a vir na data, nos períodos do voo" | C tela (D13) | "…ele passa a vir na data, no horário do voo." |
| :570, "(o instrutor precisa estar disponível na noite)" | C tela | "(a faixa do instrutor precisa ir até o fim da aula)" |
| :565 ("durante o voo inteiro"), :574 ("disponibilidade durante todo o voo") | none by default; commit "regra" | "disponível para começar o voo", "disponibilidade para começar o voo"; and :529 and :570 again |

## 3. Where each existing control goes

| Control today (label, id or data attribute) | Destination (stage, screen, pane) | Kept, moved, replaced by or removed |
|---|---|---|
| "Janelas de operação": nine switches, `#wins input.sw[data-a="win"][data-i]` (Recursos › Disponibilidade do dia) | Escala stage: `details#periodos` › `#periodos-lista`, the same nine switches; from H1 inside `#restricoes` | moved (B), moved again (H1) |
| Struck time in "Horários de decolagem", `span.hr.fechado[data-dica="horario-em-janela-fechada"]` | wherever the cadastros design puts the take-off summary (the category's detail); tip `horario-em-periodo-fechado` | kept, renamed (B) |
| Manual list `#manual-janelas` | Manual › Escala, `#manual-periodos` | replaced (B) |
| "Vem", `#inst-dia input.sw[data-f="on"]` | INVAs: the row's third line, and the detail › "Nesta data" | moved (C tela) |
| The nine period cells, `td.jan > label.cel > input[data-f="aw"][data-w]` | INVA detail › "Nesta data": nine `button.periodo-chip[data-act="faixas-periodo"][data-w]` and "Editar faixas"; on the row, the strip `span.tira` (read only) | replaced (C tela) |
| "Aplicar turno…", `select[data-f="pre"]` | INVA detail › "Nesta data": five buttons `[data-act="faixas-turno"][data-turno]` | replaced (C tela) |
| "Voos" (`td.voos`) and the blue cells `.cel.voo` | the row's third line ("3 voos") and the strip's mark; in the detail, the chips' mark and "Na escala desta data" | moved; the cells replaced (C tela) |
| "Mês" (`td.mes`), "Habilitações" (`td.habs-resumo`) | the row (cadastros design) | moved |
| Legend `p.legenda-disp` ("disponível", "com voo ou aula na escala", "não vem", "Clique numa janela…") | `p.legenda-periodos` in the block | replaced (C tela) |
| Switch "Disponibilidade do dia · Cadastro", `[data-vista-ins]` | none (desenho-cadastros D10) | removed (C tela) |
| Booking: "Marcar <nome> disponível às HH:MM", `button[data-agd-opcao="disponibilizar"]` | the same dialog | kept (D13) |
| History "↶ Reverter" of "<nome>: Indisponível" (`setInsOn`) | Histórico | kept |
| History "↶ Desfazer" of a booking that marked an INVA available | Histórico; payloads with `aw` still valid | kept (D14) |
| History entries "Janela HH:MM ativa" and "inativa" | stay as written; new ones say "Período das HH:MM fechado nesta data" and "reaberto nesta data" | replaced from B on |
| (new) History "Faixas de <nome>: …" with "↶ Reverter" | Histórico | new (C tela) |

## 4. Data-format steps and migrations

| Number or file | Step | What changes | Conversion | Tests | Deploy order |
|---|---|---|---|---|---|
| `ESQUEMA` 27 | C, commit "dados" | `dia.ins[<id>]` gains `faixas`; `aw` kept; the cadastro only carries the number | D3; idempotent; a day without `ins` untouched | `migracoes.test.js`: a day at 26 with a lunch gap, an all-off instructor, an unreadable `aw`, a non-object entry and an unknown field; `aw` still there; the one pin of the number (moved there by F0a) | no database migration (no SQL reads `aw`, posicao A14). C merges after B, as the last PR of Onda 1 (desenho-entrega 2.1), so 26 is on `main` before it. Pedro's first opening rewrites every stored day once; a tab on 26 is refused with the hint `formato` |
| none | C, commit "tela" | free-minute ranges are stored under 27 | none | §6 | same PR and same merge as "dados": no build that draws the grid over ranges reaches production |
| none | C, commit "regra" (only with the yes) | the rule | none (D7) | §6 | D8 |
| none | B | `dia.win` keeps its shape; a new date stops copying it | none | `dias.test.js` | none |
| not covered by `ESQUEMA` | C | the stored reverts: `desfazerAgendamento.disponibilidade` (`aw` read as ranges); the new kind `setFaixas` | read-time | `reversoes.test.js` | none; both shapes of the first accepted for good; a tab from before C shows a `setFaixas` entry without its button |

No migration file in `supabase/migrations/` for this topic. The shared preview database: C's build writes there only at
C's turn, from the integration worktree (desenho-entrega 2.5); the branches that rejoin after C carry 27 by then, and a
build at 26 that reads a day at 27 can show the stale `aw` copy but is refused when it saves.

## 5. Files created, changed and deleted, by step

**F0** (owned by the delivery topic; needed by this one): F0a: `appPronto` in place of the wait on `#wins`
(test/e2e/fixtures.js:65 and `cadastros.spec.js:1323`, `contas.spec.js:175`, `cursos.spec.js:820, 1198, 1527`,
`cursos-no-dia.spec.js:45`, `datas-compartilhado.spec.js:203`, `historico.spec.js:15`, `seguranca.spec.js:94`); the
drivers `telas/recursos.js` and `telas/instrutores.js` (`alternarVem`); the split spec files; the pin of the format
number. F0b: `js/telas.js`, `aoReverter`, the split modules, `test/unit/grafo-da-tv.test.js`. F0c: the stylesheets.

**B, first commit: "os períodos fechados da data vão para a Escala"** (this topic's part of B; the rest of B is the
cadastros design)
- Created: `js/views/periodos.js`, `js/eventos/periodos.js`, `test/e2e/periodos.spec.js`.
- Changed: `index.html` (delete :166-169; the `details#periodos` in `#s-esc`; the hint :207; the Manual lines of §2.11);
  `js/dias.js:118-123` (only `win` in `diaParaCopiar`); `js/views/recursos.js:146` and its imports;
  `js/eventos/recursos.js:115-120` and the `WIN` import; `js/eventos/escala.js` (one import line);
  `js/views/horarios.js:39-47`; `js/glossario.js:73-74`; `js/manual.js:32` ("Só às 17:30"), `:43` (`janelasDoManual` →
  `periodosDoManual`); `js/views/manual.js:11`; `css/escala.css` (`.periodos`, `.periodo`, the 44 px rule);
  `README.md:199, 231, 235`; `test/unit/dias.test.js`, `manual.test.js:35-36`; `test/e2e/app.spec.js:133, 194-205`;
  `test/e2e/recursos.spec.js`; `test/e2e/telas/recursos.js` (`fecharPeriodo`, `reabrirPeriodo`: they open whichever
  `details` holds `#periodos-lista`, so H1 does not edit them); B's block of `test/e2e/manual-frases.js`.
- Deleted: the Janelas panel, the `.janela` and `.janelas` rules, the glossary ids `janelas` and
  `horario-em-janela-fechada`, `#manual-janelas`.
- Not touched: `js/eventos/registro.js` (its comment at :31 stays true: `data-a` "win"), `js/views/escala.js`,
  `js/main.js`.

**C, commit "dados"**
- Created: `js/disponibilidade.js`, `test/unit/disponibilidade.test.js`.
- Changed: `js/viabilidade.js:16-17` (delete `cobre`), `:54`; `js/migracoes.js:13` and step 27; `js/dias.js:58, 92-95` and
  the `ins` of `diaParaCopiar` (rebased on B); `js/storage.js:146`; `js/agendamento.js:934-939`;
  `js/reversoes.js:11, 38-40, 186-189`; the instructors' events (`js/eventos/cadastros.js:75, 173-177`) and view
  (`js/views/cadastros.js:80-83`); `test/helpers/cenarios.js` (the added generator `comFaixas`); `test/unit/grafo-da-tv.test.js`;
  `README.md` ("Formato dos dados", the row of `js/viabilidade.js` at :223, a new row for `js/disponibilidade.js`).
- Untouched, by obligation: `test/fixtures/goldens-do-motor/*`, `test/unit/engine.golden.test.js`, `gerarCenario`,
  `test/helpers/goldens.js`, `montar.js`, `estado.js`, `exemplo.js`, `scripts/capturar-goldens-motor.mjs`.

**C, commit "tela"** (this topic's part; the list, the detail and the drawers are the cadastros design)
- Created: `js/views/disponibilidade-do-dia.js`, `js/eventos/disponibilidade-do-dia.js`.
- Changed: `js/disponibilidade.js` (the exports of §2.2 marked "tela"); `js/agendamento.js:938` (D13) and the comment at
  `js/views/agendamento.js:266`; `js/reversoes.js` (`setFaixas`, after :64); `js/eventos/instrutores.js` (imports the new
  module; the `aw` and `pre` branches go); `js/views/instrutores.js` (the row's third line and strip; `ocupacaoDosInstrutores`
  gives intervals); `js/glossario.js:88, 93` and the new term; `index.html` (`#s-ins`; the Manual lines of §2.11);
  `css/instrutores.css`; `test/e2e/telas/instrutores.js` (`alternarVem` on the row; `abrirInstrutor`, `aplicarTurno`,
  `alternarPeriodoDoInstrutor`, `digitarFaixas`, which types key by key; `ESTADOS` gains "INVA aberto" and "faixas em
  edição"); `test/e2e/instrutores.spec.js`; C's block of `test/e2e/manual-frases.js`.
- Deleted: the grid (`linhaDoDia`, the header and body of `rInsDia`, js/views/cadastros.js:78-93, 121-135), the window
  part of `ocupacaoDosInstrutores` (:46-58), `index.html:230-236` (the legend and `table.disp`), the rules `.cel`, `td.jan`,
  `.legenda-disp` and `table.disp` (css/app.css:240, 1041-1067, 1596), the glossary term `turno`.

**C, commit "texto"**: desenho-entrega decision 15 (`js/engine.js:961`; 7 lines of `cenario-06.json`). Not this topic's.

**C, commit "regra"** (only with the yes; or its own PR later)
- Changed: `js/disponibilidade.js` (`disponivelPara`; `oQueCabe` also gives, per list, the latest end: the last accepted
  start plus 5 h, up to `fimDaMissao`); `js/engine.js:759, 955` and the comments at :25, :166; the hint, the glossary text
  and the Manual sentences of §2.11; 37 files of `test/fixtures/goldens-do-motor/`, re-recorded by the script; the tests
  of §6.

## 6. Tests

**Written first**

| Step | Test | What it pins |
|---|---|---|
| B | e2e `periodos.spec.js` (about 7) | one click closes and reopens; the History texts; the summary; the block opens by itself on a date with a period closed; **with every period closed and no flight, the list is still there**; a request "só às" in the closed period leaves with the reason and one with a wider availability moves; the struck take-off time and its tip; keyboard (Enter on the summary, Space on the switch); the Gestor sees the switches disabled; 44 px at 390 and 320 px |
| B | `dias.test.js`: "a data nova começa com todos os períodos abertos" | D23 |
| C dados | `disponibilidade.test.js` (about 16) | the table of §2.3; 512 patterns through `faixasDasJanelas` and back by `periodoNasFaixas`; `disponivelPara` against the nine-period definition, kept in the test as the oracle, on 512 patterns × a 10-minute grid, starts before 06:30 included: 0 differences; `alternarPeriodo` against toggling the pattern (4,608 pairs) and on free-minute ranges ("parte" adds the whole period); the reader's fallback and its `TypeError` with neither field; `normalizarFaixas` on tampered content (never throws; cuts at 06:30, at 1440 and at 8; idempotent) |
| C dados | `migracoes.test.js` (step 27); `reversoes.test.js`: "a reversão de antes do formato 27 continua valendo: volta como faixas"; `engine.rules.test.js`: 3 cases on ranges not aligned to the periods (13:30–15:10 and the PA-34; a break at 12:00–13:00; an empty list); `engine.invariants.test.js`: the presence rule, `juntar(separar())` and the saved schedule over `comFaixas` | D4, D14, D5. `comFaixas(estado, seed)` in `test/helpers/cenarios.js` gives free minutes, gaps and an empty list; it never enters `gerarCenario`, so no hash changes |
| C tela | `disponibilidade.test.js`: `oQueCabe` (the lines of §2.3), `descreverFaixas`, `turnoDasFaixas`, `proximaFaixa`; `reversoes.test.js`: `setFaixas` (hostile values); a test that greps `js/` and fails on `.aw` outside `js/disponibilidade.js`, `js/dias.js`, `js/storage.js`, `js/reversoes.js`, `js/backends/local.js` | §2.2, D14, D4 |
| C tela | e2e `instrutores.spec.js`, typing with `pressSequentially`, never `fill` (about 14) | 13:10 typed over 12:40 in the second "Das" of 06:30–11:30 · 12:40–17:30: nothing is saved at any key (01:40 would touch the first range), then "Salvar faixas" gives 06:30–11:30 · 13:10–17:30 and one History entry; 14:30 typed in an "até" (the first digit gives a time before the start: no error while typing); the three errors; a merge at the save, its announcement and the focus on "Editar faixas"; Enter and Esc; 23:59; the draft kept across a redraw and another INVA, discarded by a date change; the base changed by a revert; a chip: one click, "parte", the mark of a flight, the History entry and its "↶ Reverter"; a turno and its pressed state; "Marcar disponível" adding the flight's interval; the read-only profiles; 390 and 320 px |
| C regra | the oracle test becomes "nunca recusa o que as janelas aceitavam; aceita o que começa numa faixa"; `engine.rules.test.js`: "o instrutor da manhã recebe o voo das 12:00 no PA-34", "o simulador das 16:20 não precisa da noite", "até as 17:30 não inclui o Noturno", "o voo que termina até as 06:30 continua aceito"; `engine.invariants.test.js`: "o voo começa numa faixa do instrutor"; `oQueCabe` with the latest end | D7, D8 |

**Existing tests that change**

| Step | File (as of 48875e3) | What | Count |
|---|---|---|---|
| B | `test/e2e/cadastros.spec.js` (in `recursos.spec.js` after F0a) | :10-11 and :46-53 move to `periodos.spec.js`; :187, :213 lose `#wins`; :259, :445 close the period through `fecharPeriodo`; :262 the tip id and the `.sr` text | 6 tests |
| B | `test/e2e/app.spec.js` | :133 `#manual-periodos li`; :194-205 compares the Manual's width with the Janelas panel: pointed at a panel that still exists | 2 |
| B | `test/unit/manual.test.js`, `glossario.test.js` | the Noturno note, `periodosDoManual`, the two term ids. No existing test pins the copy of `win` to a new date (grep over `test/`): `dias.test.js` only gains the new test | 2 to 3 |
| C dados | `dias.test.js` | :32 keys `['aw', 'faixas', 'on']`; :40 the empty day; :148; the copy to a new date | 4 changed, 1 new |
| C dados | `storage.test.js` | :50, :84-86, :99, :156 (instructors now carry `faixas`) | 4 |
| C dados | `migracoes.test.js:27`, `storage-dias.test.js:373-375` | the day's `ins` gains `faixas` | 2 |
| C dados | `reversoes.test.js` (9 occurrences of `aw`), `agendamento.test.js:551-563` | payloads and the expected ranges (the periods the flight touches) | about 7 |
| C dados | `viabilidade.test.js:5, 22-30` (the `cobre` test moves to the new file), `engine.invariants.test.js:335` (the import) | | 2 |
| C dados | e2e | none expected: the grid shows the same cells (not run) | 0 |
| C tela | `agendamento.test.js:551-563` and the reversal tests, a second time | "Marcar disponível" now writes the flight's interval (610–670, not 610–690) | 2 to 3 |
| C tela | `test/e2e/cadastros.spec.js:951-953, 1000-1016, 1079-1080` (in `instrutores.spec.js`), `perfis.spec.js:19, 31` | the cells and the select become chips and buttons | about 8 |
| C tela | `historico.spec.js:64` | stays as the e2e of an old `aw` payload; its "Vem" selector goes through `alternarVem` | 1 |
| C tela | the 13 uses of `#inst-dia … [data-f="on"]` in 8 files | none in the spec files: the body of the driver `alternarVem` changes | 0 |
| C tela | the walks of `celular.spec.js` and `acessibilidade.spec.js` | through the driver's `ESTADOS` | the two new states |
| C regra | `test/fixtures/goldens-do-motor/` | re-recorded; the 40 hashes identical | 37 files |
| C regra | `viabilidade.test.js:64`; `engine.invariants.test.js:98`; `engine.rules.test.js:62`; `instrutor-escolhido.test.js:344` | fail by the rule (measured) | 4 |
| C regra | `engine.rules.test.js:524-536` ("…disponível para começar a aula nos horários possíveis"); `instrutor-escolhido.test.js:59-66` ("…não está disponível para começar o voo nos horários possíveis") | fail by the texts of D9 (code review) | 2 |
| C regra | the 9 e2e snapshots | none expected (the example's instructors have every period); to be confirmed by running | 0 |

Go-live check that no test can make: on a real iPhone and a real Android phone, open a time field of "Editar faixas",
choose a time in the native picker, "Salvar faixas" (the 390 and 320 px e2e run in desktop Chromium).

## 7. Departures from Pedro's request

| What the request says | What this design does | Why | What Pedro can choose instead |
|---|---|---|---|
| Ranges of "earliest and latest mission start time" | a range is `[de, ate)` and, by default, a presence range: the mission fits whole inside it | D2, D6 | the start rule: the commit "regra", with his yes; the stored numbers do not change |
| Commit 2 "if the meaning changes" | designed, measured and not made by default | D6: it is the topic's only allocation-rule change and its consequences are larger than the request's example suggests | say yes: one more commit in C, or a PR later |
| Commit 1: `viabilidade.js` reading ranges, goldens unchanged | the reader is `js/disponibilidade.js`, called by `viabilidade.js`, with a fallback to `aw`; the generator and `exemplo-estado.json` keep `aw` | the hashes cover the generated input | converting the state inside the golden test and requiring `faixas` in the engine |
| `aw` "no longer fits" | the stored model is ranges; the nine periods stay as one-click chips and as the row's strip | §2.7 | typed ranges only (a lunch break on a period: 6 interactions, 2 of them typed) |
| Fields "edited in place" | turnos and periods are saved at the click; typed ranges by "Salvar faixas" | D17 | — |
| Availability as ranges (the request does not mention "Vem") | "Vem" stays beside the ranges | D10 | derive it from "no range" (the History revert loses its meaning) |
| (not in the request) | every change of an INVA's ranges is a History entry with "↶ Reverter" | D14 | no entry, as the cells today |
| "Remove the top-level Janelas de operação (`state.win`)" | the section leaves Recursos; `dia.win` and the engine's reads stay; the nine switches move to the Escala stage | D21, D22, §2.8 | drop the control (second column of the cost table) or the rule (third column, a golden change) |
| "Take-off times are already set per category…, so the two overlap" | recorded as partly true: they overlap for flights only; Ground, the Noturno and the Voo Solo have no list | mapa-recursos §5.4 | — |
| "Data-format steps never delete fields" | honoured: `aw` stays in each converted day as a copy nothing reads | D4 | drop it at the next save of each day |

## 8. Questions for Pedro, each with the default this design implements

1. **Presence or start?** A range of an INVA can mean (A) he is there from … to …: the mission must fit whole inside
   it; or (B) he may start a mission from … to …, as the request words it. With (B) no range keeps an INVA free after a
   given time: marked 06:30–12:40 he can get a 4 h Navegação at 11:30 (lands 15:30); a 2 h simulator at 10:10 runs
   through an 11:30–12:40 lunch gap; an approved flight stops showing a conflict when his range is cut after its start;
   and every stored date that is not approved changes at its next edit. On the generated scenarios 110 of 735 rows run
   past the end of their range, by a median of 70 minutes and up to 3h50. With (A) "from 13:30" for the PA-34 already
   works, and nothing the engine schedules changes. *Default: (A). (B) is ready as one commit and is made only if you
   say yes; "go with defaults" leaves it out.*
2. **Only if (B): is the end of a range excluded?** *Default: yes ("até 17:30" does not include the 17:30 Noturno);
   then "até 12:40" also leaves the 12:40 take-off out, so the last take-off wanted must be before the end.*
3. **Does "Vem" stay as its own switch beside the ranges?** *Default: yes.*
4. **Closing a period for one date:** keep it, as nine switches in the Escala stage? *Default: yes.* Should a closed
   period pass to the next new date, as today? *Default: no: each new date starts with every period open. If the count
   of question 10 shows the same period closed on runs of dates, the copy stays.*
5. **The date's overview of the INVAs** (one question with desenho-cadastros 8.3): the list, with "Vem", the ranges and
   a strip on each row, and periods and turnos in the INVA's detail. *Default: yes.* Alternative: an overview that spans
   the two panes, one line per INVA with the same switches: today's cost exactly (8 instead of 9 on the typical day, 19
   instead of 22 on a heavy one), at the price of a second surface and a wide table.
6. **Defaults:** a new INVA starts with the day, without the night; an INVA missing from a date already saved counts
   as available day and night. *Default: both as today.* Alternative: day only in both cases.
7. **Should changes of an INVA's ranges enter the History** with a "↶ Reverter"? *Default: yes (one entry per turno,
   per period clicked and per "Salvar faixas").* Alternative: no entry, as the cells today.
8. **A usual week per INVA in the cadastro** instead of copying the last saved day? It would remove most of the daily
   pass. *Default: not in this redesign; the copy stays.*
9. **Free minutes in "Editar faixas", with the nine periods kept as one-click shortcuts?** *Default: yes.*
10. **Two read-only counts on the stored days, before B and C are built**, to ground questions 1, 4 and 5. They were
    not run here (this design never touches the server); they return dates and counts, no name. *Default while nobody
    runs them: the defaults above.* The two queries:

```sql
-- the dates of the last 60 days with a closed period, and which periods
select data, (select string_agg(i::text, ',' order by i) from generate_series(0, 8) as i
              where d.conteudo->'win'->>i = 'false') as fechados
from public.dias d where data >= current_date - 60 and d.conteudo->'win' @> '[false]'::jsonb order by data;
-- INVA-dates: how many do not come, and how many have part of the day off
select count(*) as invas_data,
       count(*) filter (where i.value->>'on' = 'false') as nao_vem,
       count(*) filter (where exists (select 1 from generate_series(0, 7) k where i.value->'aw'->>k = 'false')
                          and exists (select 1 from generate_series(0, 7) k where i.value->'aw'->>k = 'true')) as dia_parcial
from public.dias d cross join lateral jsonb_each(case when jsonb_typeof(d.conteudo->'ins') = 'object'
                                                      then d.conteudo->'ins' else '{}'::jsonb end) as i
where d.data >= current_date - 60;
```

The engine text "(marque em Instrutores › Cadastro)" is desenho-entrega's question 5, asked once, there.

## 9. Risks, and what would make this design wrong

- **The meaning.** If Pedro wants the start rule, the commit "regra" changes 37 golden files and every unapproved stored
  date at its next edit; the review leans on the two machine checks of D8. If he does not, the request's words "earliest
  and latest start" stay unmet on purpose: the plan has to say so where he will read it.
- **The scenarios are not the school.** The sizes of D6 and D7 come from random scenarios with many holes (709 of 936
  instructors have a period off); the counts of question 10 are the only real measure, and nobody ran them.
- **The e2e suite was not run for any step of this note.** "None expected" for the commits "dados" and "regra" is
  unconfirmed.
- **The daily pass.** One selection more per INVA whose periods change, and half as many INVAs per screen. If the
  operator's days look like the heavy mix, the board of question 5 is an additive step over the same component and the
  same data.
- **The strip needs F2's sub-block slot.** Without it the list has only text to line up by, and the loss the cadastros
  design accepts in its D12 is larger.
- **Period chips on free-minute ranges.** A chip in the state "parte" adds the whole period, and a second click then
  takes the whole period out: not the ranges of before. The History revert is the way back, which is one reason for D14.
- **Tabs left open.** (1) Local mode has no format refusal (js/backends/local.js:95-106): a tab on 26 saves `{ on, aw }`
  from the stale copy (or all nine periods for a date created after the upgrade), the day goes back to 26 and the next
  read rebuilds `faixas` from that `aw`, losing the ranges edited since. Reach: local mode only, which has the same
  hazard at every format step (mapa-dados §5.6). (2) Shared mode: a tab on 26 shows the periods of the copy until its
  first save is refused. (3) The grid drawn over ranges would rewrite an INVA's free-minute ranges; it exists only
  between two commits of one PR (D20).
- **The first opening after format 27** rewrites every stored day in series; a failure stops with the existing message
  and resumes at the next opening (js/storage.js:385-399).
- **The TV.** `js/painel.js` gains a module through `js/migracoes.js`; a TV that fails to link stays blank until someone
  reloads it. The graph test and the wave's opening of `painel.html` are the checks (desenho-entrega 2.6).
- **Not locked on an approved date (D19).** A period closed or a range cut by mistake puts approved flights in conflict
  at once; the conflict is visible and one click undoes it. If Pedro reads that as a bug, both blocks get the criteria's
  lock (`S.aprovacao`).
- **"23:59 means the end of the day"** is a convention of the field; a range typed to 23:59 is stored as 1440.
- **The rejection texts say "instrutor ativo" for "Vem"** (js/engine.js:747, 938; 27 golden alerts) while the cadastro
  gains `inativo`. Rewording them is a text-only golden change, outside this topic; it must not ride in "regra".
- **Three notes have to agree** on the period switches, on the absence of a board and on C's commits; §2.10 lists what
  each one changes. Until they do, the plan holds two answers.
- **This design is wrong if:** availability has to be per resource or per category rather than per INVA (the request says
  ranges per date, and the engine has one availability per instructor); closing a period is never used (then the second
  column of §2.8 is cheaper, and question 10 would show it); or H1 places the operator's restrictions outside
  `#restricoes` (the list `#periodos-lista` moves there, nothing else).

<!-- revisado -->
<!-- fim -->
