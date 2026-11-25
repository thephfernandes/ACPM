<!-- Design note for the production-line redesign. Local working note: never commit this file. -->

# Desenho: Escala e Aprovar (H), os estados da linha e os avisos do trilho

Code read at the worktree `.redesenho/wt-plano` (`48875e3`); paths are relative to it. Marks: **(ran)** = measured in this revision with `node` on the worktree's pure modules, read-only, fictitious generated data only, from the scratch folder `/private/tmp/claude-501/-Users-pedrofernandes-ACPM/5d1f0955-e20a-47d4-acd8-3ee432e7a836/scratchpad/dono-h/` (scripts `aprovar-laco.mjs`, `priorizar-regra.mjs`, `impressao-conflito.mjs`, `impressao-sensivel.mjs`, `pedido-tardio.mjs`); **(ran, review)** = measured by the independent reviews of this note; **(computed)** = arithmetic from CSS values; **(assumed)** = an interface another design note owns, stated so the plan can check it. "Edit" = Operador and Administrador; "Read" = Gestor and Secretaria. Other notes of this folder are cited by name: "the core notes" are `desenho-nucleo-a`, `-b` and `-c` (three candidate designs of step G), "the shell note" is `desenho-casca`, "the delivery note" is `desenho-entrega`.

What this revision changed against the first version of the note: H is one step after G (not split around it); the editor of a flight's restrictions is G's, and H only lists and links; the pipeline adapter follows the shell's contract; an export is recorded without recalculating the schedule; approving also fixes what enters because of the approval; the flight pane `#voo` is no longer the default, it is the costed alternative of 2.14.

## 1. Decisions

1. **H is one step after G: the stack is E → G → H, branch `linha-h-escala-e-aprovar`, format 29. The editor of one flight's restrictions (the instructor without a pin, the priority, the resource type, the course mission, the duration, the time, "Tirar da escala" and "Pôr de volta na escala") is G's "Restrições do voo". H builds no second editor and writes no request field.**
   - Why: the three core notes give that editor to G, because it is today's Demanda row with today's handlers, so no value is ever left without a control; the delivery note stacks one H after G.
   - Evidence: `desenho-nucleo-a` decisions 11, 12, 17 and 2.5, files at :410-411; `desenho-nucleo-b` decisions 8, 10, 17; `desenho-nucleo-c` decisions 7, 9; `desenho-entrega` 2.1 (:67) and :389-390; `js/eventos/registro.js:49-51` (the `data-k="d"` dispatch works on any element).
   - Rejected: H1 before G (the first version of this note): two controls with two rules for one field in one release, three files with the names G also creates (`js/views/restricoes.js`, `test/e2e/restricoes.spec.js`, the context `p:` of `contextoInicial`), and `#tl-pop` deleted under the panel that opens from it.
2. **The Escala stage is one wide pane beside the rail: `#out` with the four views. A flight keeps the surfaces it has: its row in the Lista, the map pop-up `#tl-pop`, the Sugestões drawer `#painel-reparo` and, from G, the panel "Restrições do voo". H adds no detail pane for a flight.**
   - Why: with G's panel the pedido the engine left out has its place; a pane saves no click (2.13), costs the map about a third of its width while open (57 px per hour against 88, computed) and about 40 rewritten tests; nobody knows which view the operator works in.
   - Evidence: mapa-escala 5.7; posicao B4; `desenho-casca` D12, D26, 2.6 and its question 11 (an open drawer sits to the left of the docked rail; the pop-up and the Sugestões stay); `desenho-nucleo-a` 2.5.
   - Rejected as the default, kept as the alternative of 2.14 and question 2: one pane `aside#voo` that replaces the pop-up and the two drawers.
3. **The stage opens with its three inputs in the request's priority order, as one row `#entradas`: "Restrições do operador · N", "Pedidos processados · N", "Critérios · INVA · Na disponibilidade". The row is always shown.**
   - Why: the request defines the stage by its inputs in that order, and the engine applies them in that order (pins, then the queue, then the compaction). Today one `hidden` flag hides the criteria and the approval together when there is no flight.
   - Evidence: pedido.md:44-50; `js/engine.js:399-406, 556, 968-979`; `js/views/escala.js:396-399`.
   - Rejected: keeping the second toolbar (it hides that the criteria are configuration and has no room for the restrictions).
4. **The operator restrictions of the date are listed in one place, the panel `#restricoes-da-data`, by one pure function, `restricoesDoOperador` (`js/restricoes-da-data.js`), with no stored field.** Kinds: closed periods, booked flights, chosen instructors, priorities other than 3, another resource type, another course mission, a time or a duration other than the pedido's, flights taken off the escala; and, as two derived lines, flights fixed by status and by approval. The pins and the periods come from the day; what differs from the pedido comes from G's own function. Each row has its release (2.4).
   - Evidence: mapa-restricoes 5.1, 5.6 (the 16 inputs); `js/fixos.js:40-69`; `js/dias.js:22`; `desenho-nucleo-a` 2.2 (`restricoesDoRegistro`), `desenho-nucleo-c` :311 (`restricoesDoVoo`).
   - Rejected: a per-date `restricoes` store (mapa-restricoes 7.2: every writer and five revert kinds rewritten); a list of pins only (the first version: it left out the flights taken off, the time, the duration and the mission).
5. **A release reuses an action that exists. H adds one: "Soltar" for a booked flight that is in the escala and not in conflict.** It runs the Sugestões' own function, is not offered with the status Atrasado, Em Voo, Pousou or Cancelado, asks for the second click and has its own History text.
   - Evidence: `js/reparo.js:104-106, 119-125`; `js/eventos/escala.js:281-291`; `js/instrutor-escolhido.js:89-125, 155-170`.
   - Rejected: `semAgendados` (`js/fixos.js:78-85`): it keeps the chosen instructor on the request, so "Soltar" would mean two things in the app.
6. **Criteria: the group names become the request's ("Redução de ociosidade", "Prioridade de horários dos alunos"); the option labels and their order stay ("INVA", "Avião", "Maior buraco"; "Na disponibilidade", "Só 1ª e 2ª", "Não mudar"); the stored ids stay. The second group says when it cannot act.**
   - Why: "Recurso" and "Não considerar" misdescribe the code (the cost counts aircraft only; `fixos` keeps every time). The second criterion only moves a flight that has more than one possible start, and a pedido is one exact time.
   - Evidence: `js/criterios.js:3-13`; `js/compactar.js:69, 95, 107-112`; `js/agenda.js:52-56, 63-80`; mapa-escala 6.1 to 6.4. (ran, review) With every request at one exact time the three `horarios` options give the identical schedule in 200 of 200 generated days, and in 360 of 360 runs over the three `buracos` values.
   - Rejected: the request's two option labels as the default (2.5 lists them with their cost); hiding the group (a stored setting with no control).
7. **An operator restriction keeps today's meaning: it overrides the app's choice, never the rules.** The engine never moves or drops it, checks it on every run and flags what breaks; the booking dialog refuses a booking that would create a conflict. "Override any rule" is question 1.
   - Evidence: `js/engine.js:420-449, 533, 576-583`; `js/agendamento.js:1093-1108`; mapa-restricoes 6.1.
8. **The Aprovar stage is a new screen, `section#s-apr`: the list pane holds the pending items by kind, each a link to where it is resolved; the detail pane holds "Aprovação", "Exportações" and "Depois da aprovação".** Nothing is resolved inside Aprovar.
   - Why: after approval the operator works in the Escala all day (status, Sugestões, bookings, results); a second place for Sugestões would make her alternate.
   - Evidence: mapa-escala 6.10, 6.11; `index.html:451-452`; posicao B7.
   - Rejected: Sugestões inside Aprovar.
9. **Approving with pending items asks for one confirmation and never blocks. The counts stay in a sentence beside the button; the armed text is short and fixed: "Confirmar aprovação com pendências" when there is a rejection or a conflict, "Confirmar aprovação" otherwise. Warnings never change it.** The one block that exists stays: the instructors' hours not read.
   - Why: the armed button disarms after 3.5 s and a screen reader hears the armed text plus a second sentence inside that window; a text that changes every day cannot be read and confirmed in that time.
   - Evidence: `js/eventos/confirmacao.js:9, 23-40`; `js/views/escala.js:386-390`; mapa-avisos 5.2.
   - Rejected: the counts inside the armed text (the first version); a dialog (a second confirmation pattern); blocking on conflicts (mapa-escala 7.6).
10. **Approving also fixes the flights that enter because of the approval, in the same save; flights that enter later are fixed by one button, "Fixar os N voos novos".**
    - Why: with everything pinned, the next run can find room for a request that had been rejected; today that flight enters without a lock right after "Aprovar escala". Reopening to fix a late flight recalculates the whole day.
    - Evidence: (ran) approving lets a rejected request in on 3 of the 41 golden input states and on 31 of 300 generated days (37 flights); pinning what entered and running again leaves no flight without a lock, in at most 2 simulated runs, stable on 641 of 641 states, about 2 to 3 ms a day. (ran) With one request entering after the approval, reopening changed the time, the resource or the instructor of already approved flights on 145 of 299 generated days (557 of 5,194 flights; 27 left the escala).
    - Rejected: today's behaviour (the stage would turn amber the moment she approves); "Reabrir" and "Aprovar" again as the only way.
11. **"Exportada" is new data: `dia.exportacoes`, one record per kind (`csv`, `pdf`, `xlsx`) with when, who and a fingerprint of what was exported; `dia.reabertura` (who reopened and when) ships in the same format number, 29.**
    - Evidence: mapa-escala 5.3; `js/export.js:32-35, 100, 150-154`; 2.7.
    - Rejected: a History entry only (not a state; read by text); comparing times (the day stores no time of last change).
12. **Exporting never changes the schedule. The record is written by an Edit profile, after the download succeeded, only when the fingerprint is new, through `gravarAlteracao` with a new option that saves the schedule on screen without running the engine.**
    - Why: `gravarAlteracao` → `save()` → `refazerEscala()` runs the engine with the cadastro of now. A date opened with a saved schedule shows the saved one, so today a download writes nothing; recorded through a normal save, the first download of each kind would recalculate the date, and the file would differ from what is saved right after.
    - Evidence: `js/actions.js:166-169, 189-195, 309, 370-371`; `js/storage.js:229-242` (`salvarDia` writes the state and the schedule it is given). (ran, review) 200 generated days saved, then one roster-only change (the busiest instructor loses his habilitações): a normal save changed the exported schedule on 200 of 200. A constructed worst case: it shows the mechanism, not a frequency.
    - Rejected: a normal save (above); saving the record before the file and removing it when the download fails (two writes and a History line for a file that never existed).
13. **Exports are not gated by approval, and Read profiles keep exporting without a record. The screen and the Manual teach the order: resolve, approve, export.**
    - Evidence: `js/eventos/escala.js:90-92`; `index.html:449-450` (today's Manual downloads in step 5 and approves in step 6); test "o gestor exporta sem gravar".
14. **One pure adapter feeds the pipeline, the rail, the Escala's boxes and Aprovar's list, in the shell's module and with the shell's contract: `js/linha-do-dia.js`, `linhaDoDia(contexto)` and `avisosDaData(contexto)`, the states `feito`, `falhou`, `atencao`, `andamento`, `pendente`, `nenhum`, and `destino: { tela, item? }`.** F1 ships the shell's thin first version; D and G change only the rows their own data back; H writes the final bodies. No field is added to the engine's alerts and none to `destino`.
    - Evidence: `desenho-casca` D23, D24, 2.3, 2.14 and its risk 5; pedido.md:139; mapa-avisos 7.1, 7.3.
    - Rejected: two modules of this note's own with another vocabulary and 16 rows in F1 (the first version); deleting `js/views/selos.js` in F1 (it also writes `#selo-rec-dia` and the text of `#importar-agenda`, and holds `lerPedidosDaData`, imported by `js/actions.js:18`, `js/main.js:53` and `js/eventos/agenda.js:15`).
15. **A rejection is tied to its request by G's join by position (`rejeicoesDosPedidos`): the i-th `err` alert is the i-th flying request with no pin and no row, in the engine's queue order.**
    - Evidence: `desenho-nucleo-a` decision 20; `js/engine.js:291-338, 556-964`; (ran, review) 300 generated days, 1,890 rejections, 0 out of line, the 18 that share a label included.
    - Rejected: pairing by label (the first version: 18 of 1,890 ambiguous); ids on the engine's rejections (174 golden alerts change, mapa-avisos 7.2).
16. **The three warnings that approval hides (no weight, the "Priorizar com" instructor, the chosen instructor gone) are counted from the schedule's rows, with the engine's own rule,** so the counts do not drop when the escala is approved.
    - Evidence: mapa-avisos 5.2 D; `js/engine.js:573, 586-592, 982-995`. (ran) The row rule of 2.10 gives the engine's `voa-com` alerts flight by flight on 300 of 300 unapproved generated days (665 against 665), and on 293 of 293 with one "Priorizar com" instructor left out of the state (537 against 537); after approval the engine emits 7 and the items stay 672.
17. **One fact reddens one row per card.** A rejection is counted in "pedidos que não cabem" (only when it cannot fit alone), in "escala montada" and in "pendências"; "recursos disponíveis" and "INVAs disponíveis" stay about availability. An optional input with nothing in it has the state `nenhum`. A date before today has no states.
    - Evidence: `desenho-casca` 2.3 (a card's state is the worst of its rows; `nenhum` takes no part); pedido.md:99-100.
    - Rejected: `pendente` for "there is none" (a finished day could never show done); rejection codes reddening the two availability rows (four red rows on three cards for one pedido, with click targets that contradicted "Onde resolver").
18. **Pipeline rows: 4 + 6 + 4 + 3 = 17. The value of a row is one count ("3"), one pair ("19 de 21") or one time ("18:05", "2h40").** "Rodízio" is the shell's navigation row; the Cadastros are the shell's links, with no rows (2.9).
19. **"Running" is backed only by the two waits that exist: a date being read and a save on its way.** "Motor" and "compactação" become "escala montada" and "compactação", rows with a result and no running state of their own.
    - Evidence: mapa-avisos 5.3 (the four explicit questions).
20. **The three notices at the top stay banners above the panes.** The parts of `#aviso-dados` (per date) are also rail items; `#aviso-sync` and `#aviso-link` (app level) are not.
    - Evidence: `index.html:108-123`; `desenho-casca` 2.1; test "sem as horas dos instrutores ou os resultados: aviso fixo…".
21. **Every count is text.** A row and an item carry a spoken phrase; a state is an icon shape plus a word, never colour alone; nothing is said only in a `title` (2.11).
    - Evidence: mapa-avisos 5.1 (the badges: a bare number, a mouse-only `title`).
22. **"Compartilhar" moves with the exports, to Aprovar › "Exportações".**
    - Evidence: `desenho-casca` D30 and its question 15; `css/app.css:188` (hidden from the Secretaria, kept).

## 2. How it works

### 2.1 Order and what H needs from each step

| Step | What H needs from it | Owner's note |
|---|---|---|
| F0a | the driver `test/e2e/telas/escala.js` with `abrirEscala`, `lerEscala`, `aprovar`, `reabrir`, `exportar(page, 'csv' \| 'pdf' \| 'xlsx')`, written against today's ids | `desenho-entrega` 2.2 g |
| F0b | the redraw registry (`redesenhar(momento)`), the save before the redraws | `desenho-entrega` 2.2 a, b |
| F1 | `js/linha-do-dia.js` (first version), `js/views/linha.js`, `js/views/trilho.js`; the screen table `TELAS` and `ETAPAS`; `mostrarTela(id, { item })` and each screen's `aoMostrar(item)`; the Aprovar card opening `#/esc/aprovacao` until H; the states' tokens and icons; `js/views/selos.js` keeping `#selo-rec-dia`, the import button's text and `lerPedidosDaData` | `desenho-casca` 2.2, 2.3, 2.8, D24 |
| F3 | the engine called without the inactive records, as one function H can pass to its own pure code | `desenho-entrega` decision 3 |
| B | `select#fechar-periodo[data-a="fechar-periodo"]` in the Escala toolbar, the chips `#periodos-fechados` with `[data-act="reabrir-periodo"][data-i]`, `rPeriodos()` | `desenho-disponibilidade` 2.8 |
| D | `aprovada_em` on a pedido; the Pedidos list with a "Situação" filter that an address can preselect | `desenho-pedidos` 2 |
| E | `rejeicoesDosPedidos(estado, resultado)` → `Map<fKey, { codigo, m, s }>` | `desenho-nucleo-a` 2.2 |
| G | (a) "Restrições do voo", opened by `data-act="restricoes"` with `data-id` and `data-mid`, and `data-act="por-de-volta"`; (b) the context `p:<stuId>:<mid>` of `contextoInicial` ("Encaixar…", "Mover…"); (c) per record, what differs from its pedido: `[{ campo, rotulo, valor, doPedido }]`; (d) the difference between the approved pedidos and the day, and which requests cannot fit even alone; (e) `FORA_DA_ESCALA` and the "onde resolver" table exported from `js/conflitos.js`; (f) each line of the red box addressable by its flight key; (g) the open date's pedidos with the state of their read (`lendo`, `erro`, `lidos`); (h) the texts that name the Demanda rewritten | `desenho-nucleo-a` 2.2, 2.4, 2.5, 3 |

- H is serial after G, in Onda 3 with I. No step before H carries anything this note creates.
- Whichever core note wins, the contract above holds by role. If it is `-c`, the editor is a block in the detail pane of Processamento: "Abrir" then leads there, and nothing else in this note changes. If it is `-b`, (c) reads the explicit `restricoes` store.
- (assumed) Two notes use the same names for different things: `js/telas.js` is the redraw registry in `desenho-entrega` 2.2 and the screen table in `desenho-casca` 2.2 (where the registry is `js/redesenho.js`), and both export a `registrarTela`. This note says "the redraw registry" and "the screen registry"; the plan names the files.

### 2.2 The Escala stage (`section#s-esc`), top to bottom

1. Title row: the `h2` with `#escala-atualizada` and `#selo-aprovada` inside it, as today (`index.html:345`).
2. `div#entradas`, three controls in one row (44 px targets on phones):
   - `button#btn-restricoes-da-data[aria-expanded][aria-controls="restricoes-da-data"]`: "Restrições do operador · 3";
   - `a#entrada-pedidos` to Processamento: "Pedidos processados · 21" (`RES.tot`); plain text for a profile without that screen (the Secretaria);
   - `button#btn-criterios[aria-expanded][aria-controls="compactacao"]`: "Critérios · INVA · Na disponibilidade".
   Under the row, the two panels, closed by default, the open state kept in memory until reload: `div#restricoes-da-data` (2.4) and `div#compactacao` with `#criterios` inside (2.5).
3. Toolbar `.bar`: `.seg [data-tl]` (4 views), `#btn-agendar`, B's `select#fechar-periodo`, `.cresce`, `#flt-esc-cat`, `#flt-esc-eq`, `#flt-esc-q`. The three exports and "Compartilhar" leave it.
4. B's chips `#periodos-fechados`, shown while a period is closed (in sight, outside any collapsed panel).
5. `#out`: `.resumo` (`.st`, `#tempo-parado`, the three boxes), the table, the map, the Painel.
   - The three boxes are drawn from `avisosDaData` (group `escala`, 2.8): red "N missões não entraram" = the items `fora`; red "N voos em conflito" = `conflito`, each with `[data-reparo="<fKey>"]` "Sugestões"; amber "N avisos" = the items of gravidade `aviso`. Each line keeps its text; G adds "Encaixar…" and "Restrições" to the red box's lines.
   - Empty states: G rewrites the two that name the Demanda (`js/views/escala.js:597, 624`; `index.html:373`).
- No new field in `#s-esc` uses `label.flt-rotulo` (a test requires exactly "Categoria" and "Recurso", `test/e2e/escala-tela.spec.js:157`); the criteria keep `span.flt-rotulo`.
- No `<section>` inside a screen: the parts are `div`s (a nested `section` is hidden by `css/app.css:229-230` and by `js/views/tabs.js:17` until F1 narrows both).
- Print: the Escala's stylesheet adds `#entradas`, `#restricoes-da-data` and `#compactacao` to what does not go to paper (today `@media print` hides only `.bar`, `css/app.css:1575-1581`). `section#s-apr` never prints (the shell's rule hides every section but `#s-esc`); the PDF is the paper version.

### 2.3 A flight's surfaces after G, and how the other screens reach them

| Surface | Holds | Fate in H |
|---|---|---|
| The row of the Lista | status and its detail, the instructor's name and list, the result, the lock and its reason, "✕" | kept |
| `#tl-pop` (map views) | status, instructor, "+ Aluno na turma", "✕ Excluir da escala", and from G "Restrições" | kept |
| `aside#painel-reparo` (Sugestões) | "Aplicar", "Soltar", "Cancelar o voo" for a fixed flight in conflict | kept, a drawer to the left of the docked rail |
| G's "Restrições do voo" | the request's restrictions, one flight at a time | kept, as G delivers it |
| `#dlg-status`, `#dlg-agendar`, `#dlg-painel` | actions | kept |

The Escala registers `aoMostrar(item)` in the screen registry. The address is `#/esc/<item>`:

| `item` | What opens |
|---|---|
| `voo-<fKey>` | that flight: in the Lista, its time group is expanded, the row scrolls into view and its first control gets the focus (the row itself for a Read profile); in "Por recurso" and "Por instrutor", the flight's bar gets the focus |
| `conflito-<fKey>` | as `voo-`, then the Sugestões drawer on that flight for an Edit profile; for a Read profile, the conflict's line |
| `fora-<fKey>` | the red box, that pedido's line, focus on its first button |
| `restricoes-da-data`, `compactacao` | that panel of `#entradas`, opened, focus on its first control |
| `avisos` | the amber box, opened |

- Painel view on: the view changes to Lista first (the view is session memory, `js/state.js:10`), and `#anuncio` says so.
- The filters hide the flight: the three filters are cleared and `#anuncio` says "Filtros da escala limpos para mostrar o voo."
- The flight is no longer in the date (a stale address or a click after a change): the screen opens at its title with the toast "Esse voo não está mais na escala desta data."

### 2.4 Operator restrictions of the date (`js/restricoes-da-data.js`, pure)

```js
restricoesDoOperador(estado, escala, { doRegistro = null } = {}) → {
  periodos:    [{ i, rotulo }],                                              // estado.win[i] === false
  agendados:   [{ fKey, stuId, mid, s, mis, a, b, r, ins, conflito, foraDaRegra, solta }],  // pino agendado de pedido que voa
  escolhidos:  [{ fKey, stuId, mid, s, mis, insId, ins, fixa, problema }],   // problema: null | 'saiu' | 'rejeitado' | 'conflito'
  prioridades: [{ fKey, stuId, mid, s, mis, pr }],                           // pr !== 3
  doPedido:    [{ fKey, stuId, mid, s, mis, campo, rotulo, valor, doPedido }] | null,   // de doRegistro; null: pedidos não lidos
  tirados:     [{ fKey, stuId, mid, s, mis, comPino }],                      // fly false com pedido admitido, pino ou agendamento
  peloStatus:  [{ fKey, s, status }], pelaAprovacao: n,
  doOperador: n, quebradas: n, emAtencao: n }
```

`doRegistro(aluno, registro)` is G's function (contract (c) of 2.1); H passes it in, so this module imports nothing of G's and is tested without it. `solta` says whether "Soltar" is offered (the flight is in `escala.out` and its status is not Atrasado, Em Voo, Pousou or Cancelado).

| Kind in `#restricoes-da-data` | Source | Row text | Release |
|---|---|---|---|
| Períodos fechados nesta data | `S.win` | "11:30 · 5º tempo" | "Reabrir" (B's `data-act="reabrir-periodo"`); the chips under the toolbar do the same |
| Voos agendados | `S.fixos[fKey].agendado` | "<aluno> · <missão> · 08:20 · PR-VOB · <INVA>", plus "fora da regra" or "em conflito" | "Mover…" (`data-act="agendar"`, `data-agendar="p:<stuId>:<mid>"`); "Soltar" (`data-act="soltar-voo"`); the History's "↶ Desfazer" still undoes the whole booking |
| Instrutor escolhido | request `insId`; `fixa` when the pin has `escolhido` | "<aluno> · <INVA>" plus "fixa o voo às 08:20" or "o app procura o horário com ele" | "Automático" (`escolherInstrutor(…, null)`, History and revert `restaurarEscolha` as today) |
| Prioridade | `pr !== 3` | "<aluno> · prioridade 5" | "Abrir" (G's `data-act="restricoes"`) |
| Outro tipo de recurso | G: `campo` `eq` | "<aluno> · C172 (o pedido daria C152)" | "Abrir" |
| Outra missão do curso | G: `campo` `etapa` | "<aluno> · PE-05 (o programa diz PE-04)" | "Abrir" |
| Horário ou duração diferentes do pedido | G: `campo` `p1`, `p2`, `jan`, `nb` | "<aluno> · disponibilidade manhã (o pedido: 08:20)"; "<aluno> · 1,5 h (o pedido: 1 h)" | "Abrir" |
| Tirados da escala | `fly: false` on a record that carries an admitted pedido, a pin or a booking | "<aluno> · <missão> · tirado pelo operador" | "Pôr de volta" (G's `data-act="por-de-volta"`) |
| Fixos pelo status | `fixoPeloStatus` | one line: "7 voos fixos pelo status" | the flight's status |
| Escala aprovada | `S.aprovacao` | one line: "21 voos fixos pela aprovação" | a link to Aprovar › "Reabrir" |

- `doOperador` (the pipeline value and the number on the bar) counts the rows of the first eight kinds.
- The pedidos of the date not read: the three kinds that come from G are replaced by one line, "Pedidos não lidos: o que difere do pedido não foi conferido."
- Because those three kinds are a difference against the pedido, a side effect shows as a row. Today a type change runs `ajustarPreferencias`, which deletes an exact time the new list lacks and moves both preferences (`js/horarios.js:80-91`; (ran, review) an IFR pedido at 08:20 on the C172 changed to the PA-34 ends at 08:30 with no `jan`, and back on the C172 at 10:10); "Outra missão…" writes `mis`, `eq`, `nb` and re-fits the times (`js/eventos/demanda.js:94-99`). In the list both appear as two or three rows (type, time, duration), each with what the pedido asks.
- "Outra missão do curso" is "the bound mission differs from what the program says now". Under `desenho-nucleo-a` that also lists a mission the program has since moved past; telling "chosen by the operator" apart needs a mark on the request (`desenho-nucleo-c` proposes `etapaEscolhida`, a whitelisted field with G's format number). The row's wording follows what G exports.
- "Soltar" (`js/eventos/restricoes-da-data.js`): `confirmado(b, 'Confirmar: soltar o voo')`; then the steps of the Sugestões' "Soltar" (`escolhasDaUnidade`, `escolherNosPedidos(S, escolhas, null)`, `aplicarReparo(S.fixos, RES, fKey, { soltar: true })`); `gravarAlteracao('mod', 'Voo solto: <aluno> (08:20–09:20): o app escolhe de novo o horário, o recurso e o instrutor', { kind: 'restaurarFixos', … })`. No new revert kind.
- Read profiles see the list without the buttons.

### 2.5 The criteria (`div#compactacao`, `#criterios` inside)

| Group (stored field) | Final label | Options in order (label = id) | Default |
|---|---|---|---|
| `buracos` | "Redução de ociosidade" | "INVA" = `inva` · "Avião" = `aviao` · "Maior buraco" = `maior` | `inva` |
| `horarios` | "Prioridade de horários dos alunos" | "Na disponibilidade" = `disponibilidade` · "Só 1ª e 2ª" = `preferencias` · "Não mudar" = `fixos` | `disponibilidade` |

Wording options for the two labels the request changes:

| Id | Default here | Other truthful wording | The request's | What the request's needs to be true |
|---|---|---|---|---|
| `aviao` | "Avião" | "Aeronave" | "Recurso" | a tip that says "só os aviões; simuladores e sala não contam", or a rule change that counts them (the cost changes for all three options; goldens re-recorded) |
| `fixos` | "Não mudar" | "Manter os horários" | "Não considerar" | nothing makes it true: the value keeps every time. As a new behaviour (the compaction ignores preferences and availability) it is a new option value and a rule change |

When the second group can act: a flight can change its time only when it is not fixed, not a Ground, not a Noturno, not a Parafuso on the C152, has the status Pendente or Confirmado, and its request allows more than one start (`js/compactar.js:90-112`). `podemMudarDeHorario(estado, escala)`, exported by `js/linha-do-dia.js` and used by the criteria panel and by the row "compactação", counts the rows of `RES.out` with those conditions whose request's `jan` is not one exact time (`/^h\d+$/`); it errs on the side of "can act" (a period with a single take-off time still counts). With a count of zero the group shows the note `#criterios-sem-efeito`, "Sem efeito nesta data: todos os voos têm um horário só.", and the bar reads "Critérios · INVA". What gives a flight more than one start in the target model is not this note's: the "Disponibilidade" line of G's panel (`desenho-nucleo-a` decision 17) or D's two columns (`desenho-pedidos` decision 10).

What the default touches (group names only): `js/views/escala.js:407` (labels and the two `aria-label`), `js/glossario.js:20, 49, 53, 57` (`termo` and texts; ids `buracos` and `horarios` kept), `index.html:575-580` (Manual), `js/eventos/escala.js:230` (History: "Critérios: redução de ociosidade INVA → Avião", "Critérios: horários dos alunos Na disponibilidade → Não mudar"), `test/e2e/compactacao.spec.js:2, 11, 29`. Not touched: `js/criterios.js`, the unit tests, the goldens. Choosing the request's option labels adds `js/criterios.js:5, 11`, `js/glossario.js:51, 56`, `index.html:577-578` and `compactacao.spec.js:14, 23, 24, 34, 41, 42, 48`; entries already in the History keep the old words (mapa-escala 5.5).

The criteria stay locked while approved; the tip `criterios-travados` says "reabra a escala em Aprovar".

### 2.6 What an operator restriction means today (question 4 of the brief)

| Restriction | What the app does | Evidence |
|---|---|---|
| Any pin (approval, status, `escolhido`, `agendado`) | placed first at its time, resource and instructor; never moved or dropped; checked on every run (19 conflict codes: 7 of the instructor, 7 of the aircraft or room, 3 of the time, 2 of the pedido); what fails becomes `conflito` on the flight and a `conf` alert; the flight stays; nothing blocks saving, approving or exporting. Two exceptions: a Cancelado pin is not checked and occupies nothing; the pin of a request that does not fly is ignored | `js/engine.js:400, 406-449, 533`; `js/conflitos.js:5-25` |
| Order between pins | the Noturno return, then pins without `agendado`, then booked ones: the booked flight takes the conflict | `js/engine.js:399-406` |
| Booking ("+ Agendar voo") | refused when the simulated run gives the new flight any of the 19 conflicts, or puts another flight in conflict; confirmable ("Agendar mesmo assim"): the four rules the engine follows by itself, the course rules, a missing weight, flights that leave, a past time, a Sunday | `js/agendamento.js:1093-1194` |
| Instructor chosen for a request (no pin) | off for the date, unqualified or in "Não escalar com": the request is rejected (`instrutor-escolhido`), not forced | `js/engine.js:576-583` |
| Instructor chosen on a placed flight | any instructor can be chosen; one that does not fit leaves the flight fixed and in conflict: the only forced choice today | mapa-restricoes 5.2 |
| Sugestões | offers only what fits | `js/reparo.js:22-108` |

"Override any rule", taken literally, would change: (a) the booking's blocks become confirmations and the flight enters in conflict (a change in `avaliarAgendamento` only; the engine already keeps a pin in conflict; no golden has a pin); (b) a chosen instructor who cannot fly forces the flight instead of rejecting it (an engine change); (c) conflicts stop being flagged. Any of them lets two flights share an aircraft, an aircraft in maintenance fly, or a legal limit pass with one click.

### 2.7 The Aprovar stage (`section#s-apr`, `js/views/aprovar.js`, `js/eventos/aprovar.js`)

`section#s-apr.tela[data-forma="lista-detalhe"][data-vendo="ambos"]` (`TELAS.apr`, card Aprovar, address `#/apr`; the four profiles).

**List pane `div#pendencias[data-regiao="lista"]`** ("Pendências · N"; empty: "Nada pendente nesta data."; a date before today: "Data passada: nada a resolver."):

| Group | Items (2.10) | Click target |
|---|---|---|
| Fora da escala | `fora` | Escala, that pedido's line (`fora-<fKey>`), where G puts "Encaixar…" and "Restrições" |
| Conflitos | `conflito` | Escala, the Sugestões on that flight (`conflito-<fKey>`) |
| Avisos | the items of gravidade `aviso` of the groups `escala` and `recursos` | each item's own |
| Pedidos | `pedidos-aguardando`, `pedidos-fora`, `sem-aluno` | Pedidos; Processamento; Alunos |
| Dados | `dados`, `pedidos-nao-lidos` | "Tentar de novo" |

- Items of gravidade `info` are not pending items.
- A red item stays until its pedido flies or leaves, also after approval. The way out for a pedido that will not fly: "Tirar da escala" in G's panel (`fly: false`; the pedido stays approved and the flight is listed under "Tirados da escala" with "Pôr de volta"), or "Cancelar" in Pedidos (it leaves through the reconciliation).
- The second line of a `fora` item is the short reason; "onde resolver" is G's one table by code (`js/conflitos.js`), shown in Processamento. A code names one obstacle among several (risk in section 9).

**Detail pane `div[data-regiao="detalhe"]`:**

| Block | Content |
|---|---|
| "Aprovação" | `p#estado-da-aprovacao`: "Não aprovada" / "Aprovada em 19/11 às 18:05 por <por>" / "Reaberta em 19/11 às 18:20 por <por>" (without " por …" when the author is empty, as in local mode). `p#aprovacao-pendencias`: "2 missões fora da escala e 1 conflito. 3 avisos." `span#aprovacao` with `#btn-aprovar` or `#btn-reabrir` (ids kept). Without the hours: the button off and the sentence `p#aprovacao-sem-horas` visible beside it, tied by `aria-describedby`. Approved with flights without a lock: `p#voos-sem-cadeado` "2 voos entraram depois da aprovação (sem cadeado)" and `button#btn-fixar-novos` "Fixar os 2 voos novos" |
| "Exportações" (`div#exportacoes`) | three rows, each a button (`#exp`, `#pdf`, `#xlsx`, ids kept) and its record: "Ainda não exportado" / "Exportado em 19/11 às 18:10 por <por>" / the same plus "· a escala mudou depois". A fourth row, "Link da escala", with `#btn-share-link` "Copiar o link". Not approved: the note "A escala ainda não foi aprovada." For a Read profile: "Os arquivos baixados por quem só consulta não ficam registrados." |
| "Depois da aprovação" | "Status, resultados, novos voos e Sugestões ficam na Escala. O Painel e a TV mostram a escala gravada." and the link "Abrir a Escala" |

- No flight: "Nenhum voo nesta data: nada a aprovar." and no approve button (as today, `js/views/escala.js:390`).
- Read profiles: the list, the state and the downloads; no approve, reopen or fix.
- Below 800 px: one view, in the page's order (pendências, Aprovação, Exportações). `data-vendo="ambos"` keeps both regions on screen; nothing in the list opens a detail of its own.

**Approve** (`#btn-aprovar`):
1. `confirmado(b, temErros ? 'Confirmar aprovação com pendências' : 'Confirmar aprovação')`, where `temErros` is a `fora` or a `conflito` item.
2. `S.fixos = fixosDaAprovacao(S, RES, motor).fixos` (`js/aprovacao.js`, pure): `fixosAoAprovar(S.fixos, RES.out)`; then, on a copy, run the engine with those pins; while a row comes back without a lock, `fixosAoAprovar` again with that run's rows. Bounded by `RES.tot + 1` rounds. `motor` is the function the screen's schedule uses (F3's).
3. `S.aprovacao = { em, por }`; `S.reabertura = null`; `gravarAlteracao('mod', 'Escala aprovada: 20 voos fixados (com 1 fora da escala e 1 conflito)')`, the count being the final one. The focus goes to `#btn-reabrir` (test kept).

**Fix the newcomers** (`#btn-fixar-novos`): `confirmado(b, 'Confirmar: fixar 2 voos')`; the same `fixosDaAprovacao` from the current pins and rows; `S.aprovacao` is not touched; History "Escala aprovada: mais 2 voos fixados".
**Reopen** (`#btn-reabrir`): today's writes plus `S.reabertura = { em, por }`.

**The exports record** (`js/exportacoes.js`, pure):

```js
dia.exportacoes = { csv?: { em: ISO, por: string ≤ 80, impressao: 8 hex }, pdf?: {…}, xlsx?: {…} }     // {} on a new date
dia.reabertura  = { em: ISO, por: string ≤ 80 } | null                                                   // normalizarAprovacao
impressaoDaEscala(escala, { fStatus, fObs, av }) → FNV-1a (32 bits, 8 hex) of JSON.stringify([linhas, tot, param, indisponiveis])
  linhas: per flight, sorted by fKey: [fKey, a, b, r, s, ins, mis, etapa ?? '', h, limKg ? kg : 0, comb ? comb.abastecerGal : null,
          status === 'Cancelado', fObs[fKey]?.novoInicio ?? null, Boolean(conflito)]
  param: [[reg, revisao[reg].paraAs]] where paraAs !== null, sorted;  indisponiveis: the registrations with av === false, sorted
normalizarExportacoes(v) → only the three kinds, a valid date, por cut at 80, impressao /^[0-9a-f]{8}$/
situacaoDasExportacoes(exportacoes, impressaoAtual) → { csv: { estado: 'nunca' | 'igual' | 'mudou', em, por }, pdf, xlsx, estado, ultima }
```

| Question | Answer |
|---|---|
| What is in the fingerprint | who flies what, when, where, with whom; the crew weight and fuel on aircraft; cancelled or delayed; a flight in conflict; the number of missions asked; the aircraft that stop for the 50-hour inspection and the unavailable ones (the CSV note, the Excel's "REVISÃO" and red cells: `js/csv.js:20-38`, `js/planilha.js:195, 204`) |
| What is not, and why | `fixo`, `tag` and `baseTag` (a pinned flight changes "Horário ajustado" to "Próximo livre", `js/engine.js:516-517`); the alerts' texts (approval removes three kinds); Pendente, Confirmado, Em Voo and Pousou, and the category of a cancellation's reason (annotations of the day of operation: with them every status change would mark the files); the weight on Ground rows (0 when the engine places the class, the sum when it is pinned, `js/engine.js:736` against `:525`) |
| What the record says | "a escala mudou depois" means the list above changed, not "the file is current to the letter": the CSV and the PDF also print the statuses and the alerts |
| (ran) Approving after exporting | equal on every day where no flight enters at approval: 38 of 38 golden states, 269 of 269 and 272 of 272 generated days; where a flight enters, the file really lacks it. Not changed by Pendente, Em Voo, Pousou or the reason; changed by Cancelado, Atrasado and an aircraft marked unavailable. 0.011 ms on the 21-flight example day |
| Who writes | `aoExportar(tipo)` in `js/eventos/aprovar.js`: (1) `gravarEscalaCalculada()`, as today (a schedule that was only calculated is saved before the file); (2) the fingerprint and `DATA` are taken at the click; (3) `exp()`, `pdf()` and `planilha()` return whether the file was downloaded; (4) on success, for an Edit profile with the same date still open and read, when the recorded fingerprint differs: `S.exportacoes[tipo] = { em, por, impressao }` and `gravarAlteracao('mod', 'CSV exportado' \| 'PDF emitido' \| 'Excel exportado', null, null, { semRefazer: true })`; when it is equal, nothing |
| `semRefazer` | `save({ refazer: false })` in `js/actions.js`: `ApiClient.salvarDia(DATA, S, RES)` with the schedule on screen, no engine run, no "Atualizada às"; then the redraws. Allowed only for a write that touches no input of the engine; a unit test pins that the engine's result is identical with and without `exportacoes` and `reabertura` in the state |
| When it is stale | `exportacoes[tipo].impressao !== impressaoDaEscala(RES, S)`, computed on every redraw |
| New date | starts with `{}` and `null` (`diaParaCopiar`) |
| A date before today | the record is written as on any date (nothing is recalculated); the pipeline shows no state for it |
| Read profiles | download as today; nothing recorded; they see what the Edit profiles recorded |

### 2.8 The adapter (`js/linha-do-dia.js`, the shell's module; pure)

```js
linhaDoDia(contexto)   → [{ id, estado, valor, tarefas: [{ id, rotulo, estado, valor, dica?, destino: { tela, item? } | null }] }]   // one per ETAPAS id
avisosDaData(contexto) → [{ id, tipo, grupo, gravidade: 'erro' | 'aviso' | 'info', minuto: number | null, duracaoMin?, titulo, texto,
                            destino: { tela, item? } | null }]
contexto = { S, RES, pedidos: linhas da data | null, perfil, opera,                    // the shell's, F1
             data, hoje, leituraDosPedidos: 'lendo' | 'erro' | 'lidos',               // added by H (D and G may add theirs earlier)
             sessao: { lendo, gravando, recusada, soCalculada } }
```

- The shapes are the shell's (`desenho-casca` 2.3). H adds two optional fields to an item, `tipo` and `grupo`, which the rail ignores, and fields to `contexto`; `destino` is unchanged. Everything H needs to say about a target goes in `item` (2.3).
- `grupo`: `escala`, `recursos`, `pedidos` or `dados`. The Escala's boxes and the row "conflitos e avisos" read the group `escala`; "pendências" and Aprovar's list read the four.
- The module imports G's pure functions (`diferencaDosPedidos`, `rejeicoesDosPedidos`, the "alone" verdict) from `js/processamento.js` and `restricoesDoOperador` from `js/restricoes-da-data.js`. With `pedidos === null` the rows and items of the pedidos say "not read", never zero.
- One builder, `contextoDoDia()`, in the shell's view layer, is the only reader of `S`, `RES`, `DATA`, the pedidos cache and the session. The four drawers (the linha, the rail, the Escala's boxes, Aprovar's list) call it; the result is kept until the next redraw.
- `sessao` comes from a new export of `js/actions.js`, `situacaoDaSessao()` (`dadosLidos`, `ApiClient.temGravacoesPendentes()`, `avisoAberto()` equal to `erro` or `conflito`, `escalaSoCalculada`). Two calls of the redraw registry are added there, with a moment the linha registers for: at the start of `lerData` and when `gravacaoAtual` settles. Without them a row would stay "em andamento" after the save ended.
- A target the profile cannot open (`podeVer(tela, perfil)` false): the item or row is kept with `destino: null`.
- Order of the items: by gravidade (`erro`, `aviso`, `info`); inside each, those without a time first; then by `minuto`; then by `tipo`.
- A date before today (`data < hoje`): every row has the state `nenhum` and keeps its value, except a failed read (`falhou`) and the two waits (`andamento`); the only items are `dados` and `pedidos-nao-lidos`. The Escala's boxes keep listing what happened.
- A day imported from the old BI (`resultado` with `al: []` and `rej` as a number, `js/dias.js:162`): the rejections are counted from `rej`, with no item per pedido; missing row fields enter the fingerprint as empty.
- `FORA_DA_ESCALA` is the short reason of a rejection, moved by G from `js/agendamento.js:223-232` to `js/conflitos.js`. That module keeps no import: `painel.html` loads it (through `js/quadro.js` and `js/escala-gravada.js`).

### 2.9 The pipeline rows

P = the date's pedidos not cancelled; PW = those without `aprovada_em`; PA = approved; R = flying requests (`RES.tot`); F = flying requests with no row. "Sees" follows today's rules (`css/app.css:184-188`): the Secretaria has no Processamento card. `andamento` exists on two rows only: "registrados" while the pedidos are read, "escala montada" while the date is read or a save is on its way.

| Card · row (`id`) | feito | falhou | atencao | pendente | nenhum | Value | `destino` | Since |
|---|---|---|---|---|---|---|---|---|
| Pedidos · registrados (`registrados`) | P ≥ 1 | the read failed | — | P = 0 | — | "14" | `age` | F1, as "pedidos da data" |
| Pedidos · com exceção (`com-excecao`) | — | — | — | — | always | "2" | `age` / `excecao` | H |
| Pedidos · aguardando aprovação (`aguardando`) | PW = 0, P ≥ 1 | — | PW ≥ 1 | P = 0 | — | "3" | `age` / `aguardando` | D |
| Pedidos · aprovados (`aprovados`) | PA = P ≥ 1 | — | — | PA < P, or P = 0 | — | "11 de 14" | `age` / `aprovados` | D |
| Processamento · aprovados fora da escala (`aprovados-fora`) | nothing to enter or leave, PA ≥ 1 | the pedidos not read | something to enter or leave | PA = 0 | — | "2" | `dem` / `diferenca` | G |
| Processamento · missão do programa (`missao`) | every flying record has its course mission, or none applies (no program, or no released mission of the pedido's type) | — | a record without one where a released mission of its type exists; results or programs not read | R = 0 | — | "9 de 12" | `dem` / `sem-missao` | H |
| Processamento · preferências do aluno (`preferencias`) | some flying record's student has "Priorizar com" or "Não escalar com" | — | a "Priorizar com" whose instructors are all off, unqualified or in "Não escalar com" (the three static tests of `js/engine.js:246-250`) | — | no flying record has one | "4" | `dem` / `preferencias` | H |
| Processamento · recursos disponíveis (`recursos`) | otherwise | none available | an available aircraft stopped or under 5 h (today's badge rule, `js/views/selos.js:26-28`) | empty fleet | — | "17 de 19" | `rec` | F1 |
| Processamento · INVAs disponíveis (`invas`) | otherwise | nobody comes | the instructors' hours not read | no INVA | — | "9 de 11" | `ins` | F1, as "instrutores que vêm" |
| Processamento · pedidos que não cabem (`nao-cabem`) | 0, R ≥ 1 | ≥ 1 cannot fit even alone | — | R = 0 | — | "2" | `dem` / `nao-cabe` | G |
| Escala · restrições do operador (`restricoes`) | `doOperador` ≥ 1, all hold | a booked or chosen flight in conflict | a booked flight "fora da regra"; a chosen instructor gone, or whose pedido was rejected | — | `doOperador` = 0 | "3" | `esc` / `restricoes-da-data` | H |
| Escala · escala montada (`montada`) | R ≥ 1, F = 0, saved | F ≥ 1; the last save refused | calculated and not saved yet (Edit only) | R = 0 | — | "19 de 21" | `esc`; with F ≥ 1, the first `fora-` | F1, as "missões que não entraram" |
| Escala · compactação (`compactacao`) | there are flights | — | — | no flight | — | the idle time the first criterion fights, "2h40" (`aviao`: the aircraft's; else the INVAs') | `esc` / `compactacao` | H |
| Escala · conflitos e avisos (`conflitos`) | flights, none of either | ≥ 1 `conflito` | ≥ 1 aviso of the group `escala` | no flight | — | "4" | `esc`; the first `conflito-`, else `avisos` | F1, as "avisos" |
| Aprovar · pendências (`pendencias`) | flights, nothing pending | ≥ 1 item of gravidade `erro` | only items of gravidade `aviso` | no flight | — | "6" | `apr` / `pendencias` | H |
| Aprovar · aprovada (`aprovada`) | approved, every flight with its lock | — | approved with flights without a lock; not approved and the hours not read | not approved | — | "18:05" | `apr` / `aprovacao` | F1 |
| Aprovar · exportada (`exportada`) | ≥ 1 kind recorded, none stale | — | a recorded export is stale | none recorded | — | "18:11" (the latest) | `apr` / `exportacoes` | H |

- `dica`, the row's sentence, carries what the value leaves out: "19 de 21 escaladas, 2 fora da escala"; "Aprovada às 18:05 por Operador 01"; "1 conflito e 3 avisos"; "INVAs parados 2h40. Critérios: redução de ociosidade INVA; prioridade de horários Na disponibilidade"; "2 pedidos registrados depois do prazo, com a Exceção da Coordenação". The second criterion is named only when it can act (2.5).
- Until H: F1 ships the shell's rows (`desenho-casca` 2.3). D adds "aguardando aprovação" and "aprovados" and makes "ainda não importados" count approved pedidos only. G removes "ainda não importados" with the import button and adds "aprovados fora da escala" and "pedidos que não cabem". Each with its lines in `test/unit/linha-do-dia.test.js`. If D and G prefer to leave the cards alone, the minimum is G's removal.
- "Rodízio" is appended to the Escala card by the shell as a navigation row (`desenho-casca` D6). The Cadastros are four links with no rows (`desenho-casca` D5); if Pedro chooses the second-row card (the shell's question 3), its rows are navigation rows with a count, and "N sem peso" as `atencao` on Alunos and INVAs.
- Width (computed, to be confirmed by a test): with the linha in one row (from 1,180 px) four cards share what the Cadastros group and the button leave, about 180 to 290 px each. A name is at most 24 characters and takes the ellipsis; a value is at most 8 characters and never shrinks. A unit test pins both lengths over every state; an e2e at 1,280 px checks that no value is cut.

Against the request's first list:

| Request | Here | Why |
|---|---|---|
| Pedidos · fora do prazo ou com exceção | "com exceção", a count with no state | a pedido past the deadline without the exception is refused and not stored (mapa-avisos 6.14); an exception is a fact, not a task |
| Processamento · missão definida pelo programa | "missão do programa" | the same thing in 18 characters |
| Processamento · preferências aplicadas | "preferências do aluno", what can be known before the engine | only the engine applies them (mapa-avisos 6.12) |
| Processamento · pedidos que não cabem | kept, meaning "cannot fit even alone"; the engine's rejections are in "escala montada" | `desenho-nucleo-a` decision 19 |
| (not in the list) | Processamento · "aprovados fora da escala" | the reconciliation's difference needs a row (posicao B1) |
| Escala · motor | "escala montada" | no running or failed state of its own (mapa-avisos 6.10) |
| Escala · compactação | "compactação", value = the idle time left | no state; the move count is not returned (`js/engine.js:973`) |
| Aprovar · conflitos pendentes | "pendências" (rejections, conflicts, warnings) | the brief's three kinds |
| Aprovar · aprovada por quem e quando | "aprovada", value = the time; who is in the row's sentence and on the screen | one count or one time per row |

### 2.10 The rail's items

| `tipo` (`grupo`) | Source | Gravidade | Time | Title | Second line | `destino` | Since |
|---|---|---|---|---|---|---|---|
| `fora` (escala) | G's join: a flying request with no row, with its rejection | erro | the request's exact time (`jan` "h<min>"), else none | "<rótulo> não entrou na escala" | `FORA_DA_ESCALA[codigo]` | `esc` / `fora-<fKey>` | F1 (one per `err` alert), E (the join) |
| `conflito` (escala) | rows with `conflito` | erro | row `a` | "Conflito: <aluno>" | `o.conflito.join('; ')` | `esc` / `conflito-<fKey>` | F1 |
| `atraso` (escala) | `conflitosDeAtraso(RES.out, S.fStatus, S.fObs)` | aviso | the new take-off | "Atraso: <aluno>" | "sobrepõe o voo das HH:MM de <aluno>" | `esc` / `voo-<fKey>` | H |
| `fora-da-regra` (escala) | `RES.al` with `CODIGOS_DO_AGENDADO`, by `fKey` | aviso | row `a` | "Fora da regra: <aluno>" | the texts | `esc` / `voo-<fKey>` | H |
| `sem-peso` (escala), one per person | rows with `limKg` and no `stuKg` or no `insKg` | aviso | the person's first such flight | "<nome> sem peso" | "2 voos sem a conferência do limite de peso" | `alu` or `ins` / `<id>` | H |
| `limite-da-lei` (escala) | `RES.al` `perto-do-limite` | aviso | — | "<INVA> perto do limite da lei" | the alert's text | `ins` / `<id>` | H |
| `repouso` (escala) | `RES.al` `repouso-do-noturno` | aviso | the return leg's `a` | "<INVA>: repouso abaixo da lei" | the alert's text | `esc` / `voo-<fKey da volta>` | H |
| `sem-priorizar` (escala) | a row that is not a `trecho`; the pair = the student's `voaCom` ids that are in the state given to the engine, not empty; no chosen instructor who is in that state; the row's `insId` outside the pair | aviso | row `a` | "<aluno> sem o INVA de Priorizar com" | the engine's reason when its alert exists; else "o voo ficou com <INVA>" | `esc` / `voo-<fKey>` | H |
| `escolhido-saiu` (escala) | a row that is not a `trecho` whose request's `insId` is not in that state | aviso | row `a` | "<aluno>: o instrutor escolhido saiu do cadastro" | "o voo ficou com <INVA>" | `esc` / `voo-<fKey>` | H |
| `revisao-para` (escala) | `RES.revisao[reg].paraAs !== null`, available | aviso | `paraAs` | "<REG> para para a revisão de 50 horas" | "<fim> h desde a última revisão" | `rec` / `<REG>` | H |
| `sem-cadeado` (escala), one item | `S.aprovacao` and rows without `fixo` | aviso | — | "2 voos sem cadeado na escala aprovada" | "entraram depois da aprovação" | `apr` / `aprovacao` | H |
| `outros` (escala) | `warn` alerts with no known code | aviso | — | the alert's `s` | its `m` | `esc` / `avisos` | F1 |
| `combustivel` (escala), one item | rows with `comb` | info | the first | "3 voos saem com menos combustível" | "<aluno> (reduzir 4 gal), …" | `esc` / `voo-<the first>` | H |
| `periodos-fechados` (escala), one item | `S.win` | info | — | "2 períodos fechados nesta data" | "11:30 e 12:40" | `esc` / `restricoes-da-data` | B, as its own item; H |
| `revisao-perto` (recursos) | `REVISAO_H - fim < 5`, available, not stopped | aviso | — | "<REG> perto da revisão de 50 horas" | "restam X h no fim do dia" | `rec` / `<REG>` | F1 (one item for both kinds) |
| `pedidos-aguardando` (pedidos), one item | P without `aprovada_em` | aviso | the earliest `horario` | "3 pedidos aguardando aprovação" | "o primeiro às 06:30 · 1 com exceção" | `age` / `aguardando` | D (until D: the shell's "N pedidos … ainda não estão na demanda") |
| `pedidos-fora` (pedidos), one item | G's difference, on a date from today on | aviso | — | "2 pedidos aprovados fora da escala" / "1 cancelado ainda na escala" | "Atualizar em Processamento" (Edit); "O operador atualiza a escala." (Read) | `dem` / `diferenca` | G |
| `sem-aluno` (pedidos) | G's difference | aviso | `horario` | "<aluno_nome> não está no cadastro" | "o pedido não entra na escala" | `alu` | G |
| `pedidos-nao-lidos` (dados) | the read of the pedidos failed | aviso | — | "Pedidos desta data não lidos" | "a escala fica como está" | none ("Tentar de novo" is in the banner) | G |
| `dados` (dados), one per part | `S.indisponiveis` | erro for `horas`, aviso for the others | — | "Horas dos instrutores não lidas" and the like | the consequence | none | F1 |

- Dropped from the first version: `prazo` (the deadline is a sentence of the Pedidos screen, not a notice), one `combustivel` item per flight.
- Items of gravidade `erro` and `aviso` are never cut: they are what the Escala's boxes list today. The two `info` kinds are one item each, so the list does not grow with them.
- Left out: the History count `#log-cnt` (it stays on the Histórico button), each flight's status, the save states (the banners).

### 2.11 Accessibility of the counts (what H adds to the shell's markup)

| Element | Rule |
|---|---|
| A pipeline row | the shell's `a.tarefa`: the state icon is `aria-hidden`, the name and the value are text, and a `.sr` span says the state word ("feito", "falhou", "precisa de atenção", "em andamento", "pendente"). H asks one thing of `rLinha`: a row's `dica` is written in that `.sr` span after the state word. It may also be the `title`, never only the `title` |
| A rail item | the shell's `li.aviso > a.aviso-link`: the gravidade as a `.sr` word, the time as `<time>` or "—" with `.sr` "sem horário". Aprovar's list and the Escala's boxes use the same item markup |
| Headings with a count | text: "Pendências · 3" with `.sr` "1 erro, 2 avisos"; "Restrições do operador · 3"; the date button's `#avisos-cnt` with `.sr` "3 avisos nesta data" (the shell's) |
| A disabled action | the reason is a visible sentence tied by `aria-describedby` (the approve button without the hours), not a `title` |
| An armed button | a fixed text of at most five words; what varies stays in a sentence that does not disappear |
| Updates | drawn with `trocarConteudo` (the focus stays); not a live region; nothing is announced on each edit |
| Explanations | `data-dica` (keyboard and touch, `js/dicas.js`) for glossary terms only; every literal `data-dica` must be a term (`test/unit/glossario.test.js:32`) |
| Contrast | the state discs and their glyphs are the shell's tokens, checked in both themes (`desenho-casca` 2.11) |

### 2.12 What follows approval, and where it lives

| After "Aprovar escala" | Where | Changed? |
|---|---|---|
| Status of each flight, with the detail of Atrasado and Cancelado | Escala: the row, or the map pop-up; `#dlg-status` | no |
| Result of a course mission | Escala: the row (Lista) | no |
| Late bookings ("o voo novo entra fixo") | Escala: `#btn-agendar`, the "+" of a time or of a map row, the click on a free row | no |
| A conflict on a fixed flight | the rail, Aprovar's list and the Escala's box lead to the Sugestões drawer on that flight | two more ways in |
| A pedido approved after the escala | enters through the reconciliation (G), around the fixed flights, without a lock; Aprovar says "N voos entraram depois da aprovação" and offers "Fixar os N voos novos" | the count and the button are new |
| The Painel and the reception TV | Escala, fourth view; the TV shows the saved escala, approved or not | no |
| The files | Aprovar › "Exportações", each with when and who, and "a escala mudou depois" when it did | moved, with the record |
| Reopening | Aprovar › "Reabrir"; the criteria unlock; the day keeps who reopened and when | moved, with the record |

### 2.13 The operator's routine, counted (clicks or choices)

"After" is after G and H together.

| Task | Today | After | Note |
|---|---|---|---|
| A pedido left out because its minute is taken (two pedidos at 08:20, one INVA) | Demanda, find the row, loosen the time (1 to 3 selects), return: 2 screen changes | on its line of the red box, "Restrições", then "Disponibilidade": 2 or 3, one screen; or "Encaixar…", a free time, "Agendar": 3, and the flight is pinned | needs the time lines of G's panel; without them every clash is a pin |
| A pedido left out by its priority, type or instructor | read the reason in the Escala, open the Demanda, find the row, change the field, return: 5 or more, two screens | "Restrições" on its line, the field: 2, one screen | |
| A pedido that will not fly | Demanda, "Voa" off: 1 and a screen change | "Restrições" on its line, "Tirar da escala": 2; or "Cancelar" in Pedidos | the red rows stay until then |
| Status of a flight in the list | 2 | 2 | unchanged |
| Status of a flight from the map | 3 (bar, list, value) | 3 | unchanged |
| Instructor of a flight | 2 | 2 | unchanged |
| Resolve a conflict from the Escala | 2 ("Sugestões", "Aplicar") | 2 | unchanged |
| Resolve a conflict seen in Aprovar | — | 3 (the item, "Aplicar", back to Aprovar) | |
| Change a criterion | 1 | 2 the first time (open "Critérios"), then 1 | inherited from the previous date, so rare |
| Change a criterion on an approved day | 5 ("Reabrir" twice, the criterion, "Aprovar escala" twice) | 9, with three screen changes | rare |
| Close a period for the date | 2, in Recursos, where she also turns aircraft off | 2, on the Escala (B) | one more screen change when she does both |
| Release a booked flight that is not in conflict | Histórico, "↶ Desfazer": 2 (undoes the whole booking) | "Restrições do operador", "Soltar" twice: 3 (the flight stays, the app chooses again) | a new choice |
| See everything she imposed on the date | no single place | 1 (open "Restrições do operador") | |
| Approve and download the three files | 5 on the Escala (3 downloads, "Aprovar escala" twice) | 6 (the Aprovar card, then the same 5) | the pending list sits beside the button |
| Each later download during the day | 1 to 3 on the Escala | the Aprovar card, the files, back to the Escala: 2 more each time | the cost of the exports living in Aprovar |
| Fix a flight that entered after the approval | "Reabrir" twice, "Aprovar escala" twice: 4, and the day is recalculated in between | the Aprovar card, "Fixar os N voos novos" twice: 3, nobody moves | |
| Copy the link of the date | 1 on the Escala | 2 (the Aprovar card, "Copiar o link") | |
| See what is pending from another screen | a number on a tab, then the tab | the rail's list, one click to the place | when the rail is open; closed, the count on the date button |

### 2.14 The alternative: one flight pane `aside#voo` (not the default)

| Aspect | Rule |
|---|---|
| What it is | `div.escala-paineis` holds `#out` and `aside#voo` (`js/views/voo.js`, `js/eventos/voo.js`): one flight of `RES.out`, a Ground class, or a flying request that is not in `RES.out` ("Fora da escala · <aluno>") |
| What it replaces | `#tl-pop`, `aside#painel-reparo` and the frame of G's panel: their contents become the pane's parts ("Resolver o conflito", "Voo", "Restrições do voo", "Avisos deste voo"), each a `div`, with the same handlers |
| Opens from | the student's name in a row, a map bar, a line of a box, a row of `#restricoes-da-data`, "Sugestões", an address `voo-`, `conflito-` or `fora-` |
| Width (computed) | side by side from 1,132 px of stage width (760 + 12 + 360): at the shell's 1,248 and 1,236 px the schedule keeps 876 and 864 px. Below 1,132 px (1,076 and 916 px, the rail opened by choice on a 1,440 or 1,280 px window) the pane is a drawer to the left of the rail, as the Sugestões is today, so it never does worse than today; below 800 px it takes the screen, with "‹ Voltar à escala" |
| Closes | "Fechar"; Esc with the focus inside; when a date is read (`carregarData`: the key `<stuId>_0_1` exists on every date); when the screen locks after a save conflict; when the key is neither in `RES.out` nor a flying request |
| Painel view | the pane is not shown and nothing selects |
| Cost | about 40 e2e tests rewritten (`reparo.spec.js` 6 of 6, `acessibilidade.spec.js` about 10, `instrutor-escolhido.spec.js` 7 of 11, `escala-tela.spec.js` 7, `status.spec.js` 3, `seguranca.spec.js` 1, the helper of `agendamento-mapa.spec.js`; `#tl-pop` is on 19 lines of 6 spec files) and about 14 new (`test/e2e/voo.spec.js`); the map loses about a third of its width while the pane is open; no click saved (2.13) |
| Gain | one place for a flight instead of a pop-up and two drawers; the request's "list and detail" form on this stage too; no new drawer from G |
| If chosen | H becomes two PRs after G (the Escala stage, then Aprovar), or G mounts its panel in the pane from the start |

## 3. Where each existing control goes

| Control today (label, id or data attribute) | Destination | Fate |
|---|---|---|
| `h2` "Escala do dia" | Escala, the title, as F1 leaves it | kept |
| "Atualizada às HH:MM" `#escala-atualizada` | Escala, inside the `h2` | kept |
| "Aprovada às HH:MM por …" `#selo-aprovada` | Escala, inside the `h2`; Aprovar shows the full state in `#estado-da-aprovacao` | kept |
| "Lista", "Por recurso", "Por instrutor", "Painel" `[data-tl]` | Escala, toolbar | kept |
| "+ Agendar voo" `#btn-agendar` | Escala, toolbar | kept |
| "Categoria" `#flt-esc-cat`, "Recurso" `#flt-esc-eq`, search `#flt-esc-q` | Escala, toolbar | kept |
| "Compartilhar" `#btn-share-link` | Aprovar › "Exportações", the row "Link da escala" ("Copiar o link") | moved |
| "CSV" `#exp`, "PDF" `#pdf`, "Excel" `#xlsx` | Aprovar › "Exportações", each with its record | moved |
| Bar `#compactacao` | Escala › `#entradas`: the panel `div#compactacao`, opened by `#btn-criterios` | replaced |
| "Buracos" + "?" and "INVA", "Avião", "Maior buraco" `[data-criterio="buracos"]` | Escala › "Critérios", group "Redução de ociosidade" | moved, group renamed |
| "Horários" + "?" and its three options `[data-criterio="horarios"]` | Escala › "Critérios", group "Prioridade de horários dos alunos", with "Sem efeito nesta data…" when it cannot act | moved, group renamed |
| "Aprovar escala" `#btn-aprovar`, "Reabrir" `#btn-reabrir` (`#aprovacao`) | Aprovar › "Aprovação" | moved; the armed text is fixed, the counts are a sentence beside it |
| Day numbers `.resumo > .st` | Escala, `#out` | kept |
| `#tempo-parado` | Escala, `#out`; its first number is also the value of the row "compactação" | kept |
| "N missões não entraram na escala" `details.caixa.erros` | Escala, `#out`; also the rail and Aprovar's list | kept; drawn from the items; G adds "Encaixar…" and "Restrições" to each line |
| "N voos em conflito…" `details.caixa.conflitos` | Escala, `#out`; also the rail and Aprovar's list | kept; drawn from the items |
| "Sugestões" `[data-reparo]` | Escala; opens the drawer | kept |
| "Aplicar", "Soltar", "Cancelar o voo" `[data-reparo-aplicar]`; "✕" `#btn-fechar-reparo` | the drawer `#painel-reparo` | kept |
| "N avisos: …" `details.caixa.avisos` | Escala, `#out` | kept; counted by item, so the parts add up and approval does not shrink it |
| List header and rows `.tabela-escala` | Escala, `#out` | kept |
| Time header `[data-recolher-tempo]` and its "+" `[data-agendar="w:<w>"]` | Escala, `#out` | kept |
| Lock `svg.ico.fixo`, row tags | Escala, `#out` | kept |
| Instructor name `[data-act="trocar-instrutor"]` and list `[data-a="insVoo"]` | Escala, row and pop-up | kept |
| Status `[data-f="fstatus"]`, detail `[data-act="detalhe-status"]` | Escala, row and pop-up | kept |
| "Voltar" / "Confirmar" of `#dlg-status` | the same dialog | kept |
| Mission code and result `[data-resultado]` | Escala, row | kept |
| "✕" `[data-act="rm-fly"]` | Escala, row and pop-up | kept (G: `fly: false`, with "Pôr de volta") |
| Map legend, row "+" `[data-agendar="r:…" / "i:…"]`, free space of a row | Escala, `#out` | kept |
| Flight bar `button.tl-bar` and the pop-up `#tl-pop` | Escala, `#out` | kept |
| Painel boards, "?", "Pausar", "Tela cheia", "Configurar painel" `[data-fids]`, `#dlg-painel` | Escala, Painel view | kept |
| Tab badge `#selo-esc` | the rows of the Escala and Aprovar cards; the rail | replaced in F1 (the shell's) |
| (from B) "Fechar um período…" `select#fechar-periodo`, the chips `#periodos-fechados` | Escala, the toolbar and under it, where B puts them; `#restricoes-da-data` lists the same periods with the same "Reabrir" | kept |
| (from G) "Restrições do voo", "Encaixar…", "Pôr de volta na escala" | Escala, where G puts them; `#restricoes-da-data`, Aprovar's list and the rail link to them | kept |
| New in H | `#entradas` (`#btn-restricoes-da-data`, `#entrada-pedidos`, `#btn-criterios`), the list `#restricoes-da-data` with "Soltar", "Automático", "Abrir"; `section#s-apr` with `#pendencias`, `#estado-da-aprovacao`, `#aprovacao-pendencias`, `#btn-fixar-novos`, `#exportacoes` | created |

## 4. Data-format steps and migrations

| Number | Step | What changes | Conversion | Tests | Deploy order |
|---|---|---|---|---|---|
| 29 | H | the day may carry `exportacoes` and `reabertura`: `separar`, `juntar`, `diaPadrao`, `diaParaCopiar` (`js/dias.js:34, 55-72, 103-110, 118-123`), `normalizeAndMigrateState` (`js/storage.js:78-84`) | none: `dia => dia`, as steps 16, 17 and 25 (`js/migracoes.js:129-138, 207-210`); absent means `{}` and `null`; the number makes an older tab refuse to save instead of dropping the two fields | `test/unit/migracoes.test.js` (step 29; an unknown field survives); `test/unit/dias.test.js` (the key lists at `:31` and `:164` gain the two keys; a new date starts without them; round trip); `test/unit/storage-dias.test.js:428`; `test/unit/exportacoes.test.js` (hostile values) | client only: no SQL reads the day's keys and `salvar_dia` has no key list (`supabase/migrations/20261114143242_formato_e_status_do_dia.sql:9-52`). Merged after G's 28 |

- Cost for the operator: the first opening by an Operador or Administrador after the merge rewrites every stored day once (posicao A14), even though the step changes nothing in them; a tab left open on the version before loses its next change and asks for a reload. The delivery note has Pedro do that opening (its 2.8).
- No database migration in H. Nothing here is personal data in an export: `por` is the account's name (or its e-mail when it has none, as `aprovacao.por` today) and stays in the day.
- Modules H edits that `painel.html` loads gain no import (`js/conflitos.js`, `js/migracoes.js`); `test/unit/grafo-da-tv.test.js` (F0b) is the check.

## 5. Files created, changed and deleted, by step

| Step | Created | Changed | Deleted |
|---|---|---|---|
| F0a (the delivery note's) | `test/e2e/telas/escala.js` with `aprovar`, `reabrir`, `exportar` on today's ids | the 22 + 8 + 26 direct uses of `#btn-aprovar`, `#btn-reabrir`, `#exp` / `#pdf` / `#xlsx` in the specs | — |
| F1 (the shell's) | `js/linha-do-dia.js` and `test/unit/linha-do-dia.test.js`, first version | `js/views/selos.js` loses only the three tab badges (it keeps `#selo-rec-dia`, the import button's text and `lerPedidosDaData`) | the tab badges; their tests in `test/e2e/selos.spec.js` become rows and values |
| F2, F3, A, C | — | — | — |
| B (the availability note's) | `js/views/periodos.js`, `js/eventos/periodos.js` | `index.html`: the select and the chips in `#s-esc`; (assumed from its 2.8, "through the rail item") `js/linha-do-dia.js`: the item `periodos-fechados`; removes `#selo-rec-dia` | — |
| D | — | `js/linha-do-dia.js` (the two rows, the item `pedidos-aguardando`) and its test | — |
| E | — | (`rejeicoesDosPedidos` in `js/processamento.js`: the core note's) | — |
| G (the core note's) | its panel and its files | `js/linha-do-dia.js` (the two rows, the items `pedidos-fora`, `sem-aluno`, `pedidos-nao-lidos`); `js/conflitos.js` (`FORA_DA_ESCALA`, "onde resolver"); the texts of `js/views/escala.js:597, 624`, `index.html:373`, `js/engine.js:994` | the import button's writer and what is left of `js/views/selos.js` |
| H | `js/restricoes-da-data.js`, `js/views/restricoes-da-data.js`, `js/eventos/restricoes-da-data.js`, `js/exportacoes.js`, `js/aprovacao.js`, `js/views/aprovar.js`, `js/eventos/aprovar.js`, `css/aprovar.css`, `test/unit/restricoes-da-data.test.js`, `test/unit/exportacoes.test.js`, `test/unit/aprovacao.test.js`, `test/e2e/aprovar.spec.js`, `test/e2e/restricoes-da-data.spec.js` | `index.html` (`#s-esc`: `#entradas`, the toolbar without the exports and the link, no second bar; `section#s-apr`; the `<link>` of `css/aprovar.css`; the Manual: steps 5 and 6, the `h4` Escala, a new `h4` Aprovar, the two criteria); `js/linha-do-dia.js` (the final bodies) and its test; the shell's view layer (`contextoDoDia`, `dica` in `.sr`); the screen table (`TELAS.apr`, the Aprovar entry of `ETAPAS`); `js/views/escala.js` (the boxes from the items, the criteria panel, `aoMostrar`, `#selo-aprovada` only); `js/eventos/escala.js` (approval, exports and link out; the criteria's History text; the screen's registration); `js/export.js` (the three functions return success); `js/actions.js` (`semRefazer`, `situacaoDaSessao`, the two redraw calls); `js/dias.js`, `js/storage.js`, `js/migracoes.js` (29); `js/main.js` (imports the two new event modules); `js/glossario.js`; `css/escala.css`; the drivers `test/e2e/telas/escala.js` and `casca.js` (`apr` among the screens, `ESTADOS`); `README.md` "Estrutura" and "Formato dos dados" | the second bar of `#s-esc`; `#aprovacao` and the exports in the Escala with their bindings (`js/eventos/escala.js:90-92, 106, 197-219`); the button half of `rAprovacao`; the named place `#/esc/aprovacao`; the first-version bodies of the adapter |
| I | — | the sweep: texts that still say "barra da Escala" | — |

- H registers the Aprovar screen in the redraw registry (the moments of a date read, a read-only refresh, a re-read and a new schedule) and in the screen registry, each in its own event module; `js/main.js` only gains the two imports. Before F0b those are the hand-written lists of `js/eventos/registro.js:43-44`, `js/actions.js:107, 324, 373-379` and `js/main.js:137`.
- Not touched by the default: `js/criterios.js` (the labels stay), `#tl-pop`, `js/views/reparo.js`, G's panel. The delivery note's row for H lists `js/criterios.js:4-11` and deletes the labels "Avião" and "Não mudar": it follows question 3's default here until Pedro answers.
- Engine texts that name a screen and are shown by this stage, in the CSV and in the PDF: `js/engine.js:932` ("aba Recursos") is B's (no test and no golden holds it); `:961` ("Instrutores › Cadastro") is C's, as a text-only golden commit of 7 lines of `cenario-06.json` that needs Pedro's consent (the delivery note's decision 15 and question 5); `:994` ("na Demanda") is G's. H rewrites none; a schedule saved before keeps its old text.

## 6. Tests

Written first, in H:

| File | What (rough count) |
|---|---|
| `test/unit/linha-do-dia.test.js` (H rewrites the F1 file) | each row in each state; each item kind from a small day run through the real engine; over the 41 states and 300 generated days: every row has a state of the list, a name of at most 24 characters and a value of at most 8, escaladas + fora = `tot`; the `sem-priorizar` items equal the engine's `voa-com` alerts flight by flight on every unapproved generated day (with `comEscolhas` and `comVolta`: no pin but the Noturno return), also with one "Priorizar com" instructor out of the state; the approved day keeps "sem peso" and "sem Priorizar com"; the 47 h aircraft with no flight is an item; a date before today has no state but the waits and the failed reads; a day imported from the BI; the order; a profile gets no target it cannot open; the input is not changed (about 55) |
| `test/unit/restricoes-da-data.test.js` | each kind; the counts; a type change that moves the time shows as two rows; pedidos not read: one line; "Soltar" offered only for a booked flight in the escala without a fixing status (about 18) |
| `test/unit/exportacoes.test.js` | the fingerprint is equal before and after approval when no flight enters, over the generated days; changes with time, resource, instructor, weight, cancel, delay, a conflict, an aircraft that stops or is unavailable; not with Pendente, Em Voo, Pousou or the reason; the whitelist and hostile values; the engine's result is identical with and without the two new keys (about 14) |
| `test/unit/aprovacao.test.js` | over the 41 states and generated days: no flight without a lock after `fixosDaAprovacao`, at most 2 runs, a new run gives the same schedule, the marks `agendado` and `escolhido` kept (about 8) |
| `test/e2e/aprovar.spec.js` | the list by kind and its targets (with the Painel view on; with a filter hiding the flight); "Confirmar aprovação com pendências" only with a rejection or a conflict, and the sentence with the counts stays; never blocks; without the hours; approving fixes the flight that enters; "Fixar os N voos novos" after a late request; reopen says who and when; an export is recorded once and a repeated one writes nothing; **exportar uma data com escala gravada não muda o resultado gravado** (the stored `resultado` on the fake server is the same before and after, with the cadastro changed in between); stale after a cancel; the Excel; the Gestor exports without a record; local mode without the name; "Copiar o link"; 390 and 320 px (about 18) |
| `test/e2e/restricoes-da-data.spec.js` | the list by kind and each release ("Automático", "Soltar" with its second click and its History line, "Reabrir", "Pôr de volta", "Abrir"); the count on the bar; the Gestor reads; phones (about 9) |

Existing tests that change in H (after F0a moved the direct uses behind the driver):

| File | Tests touched | Change |
|---|---|---|
| `test/e2e/aprovacao.spec.js` | 6 of 6 | on the new screen, through the driver; the History text |
| `test/e2e/compactacao.spec.js` | 3 of 3 | open "Critérios"; the group names; the History text; one case added for "Sem efeito nesta data" |
| `test/e2e/dicas.spec.js`, `abertura.spec.js` | 3 and 2 | open the criteria panel first; the drivers |
| `test/e2e/acessibilidade.spec.js` | about 3 | approve ↔ reopen focus on the new screen (`:512-519`); the sweeps gain `apr` |
| `test/e2e/escala-automatica.spec.js` | 3 of 7 | "exportar … de novo não grava outra vez" counts the writes of the day: 2 for the first CSV of an only-calculated date (the schedule, then the record), 1 for the PDF, none for the repeated CSV, 1 for the Excel (4 where it expects 1, `:53-63`) |
| `test/e2e/planilha.spec.js`, `escala.spec.js`, `datas.spec.js`, `compartilhado.spec.js` | 6, 3, 1, 2 | through `exportar()` |
| `test/e2e/perfis.spec.js`, `login.spec.js`, `compartilhado.spec.js` | 1, 1, 1 | `#btn-share-link` is on Aprovar |
| `test/e2e/escala-tela.spec.js` | 3 of 26 | the amber box counts items |
| `agendamento`, `instrutor-escolhido`, `reparo`, `historico` specs | 2, 1, 1, 1 | one line each, the approve driver |
| `test/e2e/celular.spec.js`, `seguranca.spec.js` | the loops | `apr` among the screens (`percorrerTelas` after F0a; the literal lists at `celular.spec.js:32, 51`, `seguranca.spec.js:95`, `acessibilidade.spec.js:38` before it) |
| `test/unit/dias.test.js`, `storage-dias.test.js`, `migracoes.test.js` | 5 | the two keys, step 29 |
| `test/e2e/app.spec.js`, `test/e2e/manual-frases.js`, `test/unit/manual.test.js`, `glossario.test.js` | the Manual and glossary assertions | H's block |

About 45 existing e2e tests, most through one line of a driver; about 95 unit and 27 e2e tests new. Unchanged on purpose: `#out tbody tr:not(.win)` (49 lines, 19 files), `[data-f="fstatus"]` (71 lines), `.tl-bar` and `#tl-pop` (33 and 19 lines), `#painel-reparo` and `[data-reparo]` (29 lines), `#agd-*` (207 lines).

The Manual and the glossary, in the same PR:
- Manual: step 5 becomes the Escala alone ("confira as missões que não entraram e os avisos"); step 6 is Aprovar, in the order pendências, "Aprovar escala", then CSV, PDF and Excel; the `h4` Escala gains the three inputs; a new `h4` "Aprovar"; `index.html:575-580` with the two group names and "só age nos voos com mais de um horário possível".
- Glossary: renamed `buracos` ("Redução de ociosidade"), `horarios` ("Prioridade de horários dos alunos"), ids kept; texts changed in `criterios-travados` ("…reabra a escala em Aprovar") and `horario-ajustado`; `aprovar-escala` and `reabrir` move to a new group "Aprovar"; added `restricoes-do-operador`, `pendencias`, `exportacoes`, `voos-sem-cadeado`. None removed.

## 7. Departures from Pedro's request

| The request says | This design does | Why | Pedro can choose instead |
|---|---|---|---|
| Three panes on every screen (about 30 / 48 / 22) | the Escala is one wide pane and the rail; a flight has no detail pane | 760, 720 and 860 px minimums against a 599 px pane; no click saved by a pane | the pane of 2.14 |
| No modal or pop-up for viewing or editing a record (written for the cadastros) | not extended to a flight: the map pop-up and the Sugestões drawer stay, and G adds a panel | posicao B4; the shell's D26 | the pane of 2.14, which replaces the three |
| H: "the pipeline's sub-task states" | a thin first version ships with F1 (the shell's), D and G change the rows their data back, H writes the final rows and items | the shell needs content from F1; a row follows its data | everything in H, with empty cards until then |
| Recurso (today "Avião"); Não considerar (today "Não mudar") | "Avião" and "Não mudar" stay | the cost counts aircraft only; `fixos` keeps every time | either label (text only), or the rule changes behind them (2.5) |
| The settings "stay as they are" | the two group names change to the request's own; the option order stays today's, not the order the request lists | the request names them | keep "Buracos" and "Horários" |
| "Prioridade de horários dos alunos" as the stage's configuration | shown, and marked "Sem efeito nesta data" when no flight can change its time | the setting only limits the compaction, and a pedido is one exact time (mapa-escala 6.4) | hide the group on those dates; another name (question 4) |
| Operator restrictions override any rule | today's meaning: never moved, always checked, flagged; a booking that would conflict is refused | 2.6 | let "Agendar mesmo assim" pass the conflicts (question 1) |
| Aprovar: unresolved conflicts, approve or reopen, then the exports | Aprovar lists rejections, conflicts and warnings as links; they are resolved in the Escala; nothing blocks; the files can be downloaded before approval too | the day goes on after approval | block approval on conflicts; require approval to export |
| (not in the request) | approving also fixes the flights that enter because of it; "Fixar os N voos novos" for those that enter later | 3 of the 41 golden states; reopening recalculates the day | today's behaviour, with no button |
| (not in the request) | "Soltar" for a booked flight that is not in conflict | "the way to release each" restriction | only "↶ Desfazer" in the Histórico |
| Pipeline: fora do prazo ou com exceção · missão definida pelo programa · preferências aplicadas · motor · compactação · conflitos pendentes · aprovada por quem e quando | "com exceção" · "missão do programa" · "preferências do aluno" · "escala montada" · "compactação" · "pendências" · "aprovada"; one row added | what the code can back, in names that fit a row (2.9) | the request's names, cut by the ellipsis |
| A row's value is "a count or a time" | a count ("3"), a pair ("19 de 21") or a time ("18:05", "2h40"); who approved is in the row's sentence and on the screen | the row's width | — |
| Sub-task states: done, failed, pending, running, needs attention | "running" only while a date is read or a save is on its way; a sixth, no state, for an optional input with nothing in it and for dates before today | nothing else takes time; a finished day must be able to show done | — |
| Aprovar · exportada | new data (format 29); each first export of a kind is one save of the day and one History line, with no recalculation | no export is recorded today | a History line only, with no state |
| Notifications: a time at the left | sorted by severity first; inside each, the items without a time come first, marked "sem horário" | rejections, law limits and unread data have none | by time only |
| Sources: the badges, `js/conflitos.js`, the warnings | one adapter over `S`, `RES` and the pedidos; `js/conflitos.js` holds code tables only | mapa-avisos 6.2 | — |
| (the Escala's amber box) | counts items, so it no longer shrinks at approval | the rail and the box must agree | the engine's alerts, as today |
| Phones: list, then detail as a second view | Aprovar is one view: the list above the approval and the exports | nothing in its list opens a detail | two views |
| "Compartilhar" (not named) | moves to Aprovar, with the exports | the shell's D30 | leave it in the Escala's toolbar |

## 8. Questions for Pedro, each with the default this design implements

1. **"Override any rule".** Should "+ Agendar voo" accept a flight that conflicts (aircraft or instructor busy, maintenance, weight, legal limit) after "Agendar mesmo assim", leaving it in conflict? Default: no; today's meaning stays.
2. **A detail pane for the flight.** Which view does the operator work in during the day (Lista, the maps, the Painel), and at what window width? Default: no pane; the map pop-up, the Sugestões drawer and G's "Restrições do voo" stay as they are. Alternative: the pane of 2.14 (about 40 tests rewritten, the map narrower while it is open, H in two PRs).
3. **Criteria option labels.** "Avião" or "Aeronave" or "Recurso"; "Não mudar" or "Manter os horários" or "Não considerar"? Default: "Avião", "Não mudar". If "Recurso" must count simulators and the room, or "Não considerar" must ignore the students' times, each is a rule change with re-recorded goldens.
4. **Criteria group names.** Default: "Redução de ociosidade" and "Prioridade de horários dos alunos", options in today's order. The second name sits beside the per-pedido "Prioridade" (1 to 5) and promises more than the setting does; alternatives: "Até onde a compactação muda o horário", "Horários dos alunos".
5. **The second criterion on a date where it cannot act.** Default: shown with "Sem efeito nesta data: todos os voos têm um horário só." Alternative: hidden. It acts again as soon as a flight has more than one possible start, which depends on where a looser time lives: the "Disponibilidade" line of "Restrições do voo" (the core note's default) or two fields of the pedido (the Pedidos note's default). This note works with either and needs one of them.
6. **Which exports make "Exportada" done?** Default: any recorded export, none stale. Alternative: all three, or CSV and Excel.
7. **What makes an export stale.** Default: a change in who flies what, when, where and with whom, a cancelled or delayed flight, a conflict, an aircraft that stops or becomes unavailable. Not: Pendente, Confirmado, Em Voo, Pousou, the category of a cancellation's reason.
8. **Exporting before approval.** Default: allowed, with the note "A escala ainda não foi aprovada."; the Manual teaches approve, then export. With the exports in Aprovar, each later download during the day costs two clicks more than today.
9. **Who downloads the files?** Default: only a download by an Operador or Administrador is recorded (the Gestor and the Secretaria cannot write). If the Secretaria is the one who sends the files, "Exportada" would never be done.
10. **Reopening.** Default: the day keeps who reopened and when (`reabertura`), shown until the next approval. Alternative: the History line only.
11. **Flights that enter because of the approval** (3 of the 41 golden test days). Default: the same click fixes them too. Alternative: they stay without a lock, as today.
12. **Flights that enter after the approval** (a pedido approved later). Default: Aprovar says how many and offers "Fixar os N voos novos". Alternative: no button; "Reabrir" and "Aprovar escala" again, which recalculates the day.
13. **"Soltar" a booked flight that is not in conflict, also on an approved date.** Default: allowed, with the second click; never for a flight that is Atrasado, Em Voo, Pousou or Cancelado. Alternative: only through the Histórico's "↶ Desfazer".
14. **What "Restrições do operador" counts.** Default: what the operator placed by hand (bookings, chosen instructors, priorities, another type, mission, time or duration, flights taken off, closed periods); the status and approval locks are two lines apart.
15. **The amber box no longer shrinks at approval** (no weight, the "Priorizar com" instructor and the chosen instructor gone stay listed). Default: yes. The CSV and the PDF keep printing the engine's alerts as today.
16. **Flights that leave with less fuel** as one neutral rail item per date. Default: yes.
17. **Who sees the pedido rows and items.** Default: the four profiles (the Agenda badge is hidden from the Gestor and the Secretaria today).
18. **Severity.** The aircraft that stops for the inspection and the delay over another flight stay amber, as today. Alternative: red.
19. **Dates before today.** Default: the cards show values with no state, and the rail lists only unread data. Alternative: states as on any date (a past rejection stays red for good).
20. **The Secretaria** keeps seeing the Escala and now Aprovar, read-only, with the three downloads (the CSV and the PDF carry the crew weight sum). Default: as today.
21. **"Compartilhar".** Default: in Aprovar › "Exportações". Alternative: it stays in the Escala's toolbar.

Questions that belong to G and are raised here because this stage shows their effect:

22. **A type change in "Restrições do voo".** Today it drops the course code and can silently move the pedido's time (2.4). `desenho-nucleo-a` keeps both; `desenho-nucleo-c` keeps the code. Recommended: keep the code (the result is registered on it, `js/views/etapas.js:176-185`), and refuse a type whose take-off list lacks the pedido's minute, pointing to "Encaixar…". Whatever G decides, `#restricoes-da-data` shows each consequence as a row.
23. **"Outra missão do curso"** also changes the mission type, the resource type, the duration and possibly the time, while the same panel says the mission type is not edited. Recommended: say so in the panel and in the History line; the list shows each as a row.

## 9. Risks, and what would make this design wrong

| Risk | Consequence | Mitigation |
|---|---|---|
| Three surfaces for one flight after G (the pop-up and two drawers) | the operator learns three places | each opens from the flight itself; question 2 offers the pane |
| The adapter depends on shapes D, E and G own (`aprovada_em`, the join, the difference, the "alone" verdict, what differs from the pedido) and on the shell's contract | rows empty or wrong until the names agree | 2.1 lists each by owner; rows enter in the step that brings their data, with tests there |
| The core note is not chosen yet (A, B or C) | "Abrir" leads to a panel in the Escala or to a block in Processamento | the contract of 2.1 is by role; only the target of "Abrir" changes |
| A rejection's code names one obstacle among several | "onde resolver" can send her to a place that does not fix it (50 of the 116 count-picked golden rejections had more than one kind of obstacle; 3.1% print another cause than the one that holds alone: lacuna-1-motivos 3 and 5) | G's Processamento detail lists every resource and INVA with what stops it; "Encaixar…" is always offered |
| `semRefazer` is used for a write that does touch the engine's input | a saved day whose schedule does not match its data | one caller; the unit test "the engine does not read these keys"; the review of H checks the grep |
| Each first export of a kind saves the day (up to four versions in a few seconds on an only-calculated date) | a second Edit tab on the same date locks on its next save, as with any change today | written only when the fingerprint is new; the test for the count |
| The fingerprint's field list drifts from what the files print | a false "mudou depois" or a missed one | one constant, the unit test over generated days, the list in 2.7 |
| `fixosDaAprovacao` runs the engine on a copy up to twice more per approval | a few milliseconds | bounded; the booking dialog already does the same |
| "Prioridade de horários dos alunos" beside "Prioridade" 1 to 5 | the operator reads one as the other | question 4; the note "Sem efeito nesta data" |
| The cards' rows are narrow when the linha is in one row | names cut by the ellipsis | names of at most 24 characters, values of at most 8, the two tests of 2.9 |
| The boxes count items while the CSV and the PDF print the engine's alerts | "3 avisos" on screen, "Alertas: 5" in the PDF | question 15; the exports are untouched on purpose |
| H is the last big step and carries format 29 | it cannot be undone by a revert | the commits inside it are each green; the record is additive |
| `js/telas.js` and `registrarTela` mean two things in two notes | a collision at F0b or F1 | named in 2.1 for the plan |
| About 45 tests name something that moves | a review to read | the drivers go in first (F0a), so most moves are one line each |

Found on the way, outside the brief: a pinned Ground row carries `kg` = student + instructor while the same row placed by the engine carries 0 (`js/engine.js:525` against `:736`); the PDF prints `o.kg` on every row (`js/export.js:66`), so a Ground class shows a crew weight only after approval (inferred from the two lines).

What would make this design wrong:
- The operator works mainly in the map views and wants one place for a flight: then the pane of 2.14 is the better default, at its cost.
- The files are downloaded by the Secretaria or the Gestor: their downloads are not recorded, and "Exportada" would never be done.
- Pedro means a rule change by "override any rule", "Recurso" or "Não considerar": the defaults here change text only.
- G does not deliver the time and duration lines of "Restrições do voo": every clash at a minute becomes a pinned "Encaixar", and the second criterion never acts.
- G stores the operator's values somewhere the per-flight difference cannot read: the three kinds that come from G disappear from the list.
- The shell changes the adapter's shapes, or does not give an item's target to the screen (`aoMostrar`): the targets of 2.3 need another carrier.

<!-- revisado -->
<!-- fim -->
