### Linha de produção: Pedidos → Processamento → Escala → Aprovar (requested 2026-11-21; plan, waiting for Pedro's approval)
Pedro's request: nine tabs side by side hide that they are steps of one process, and the operator who builds the escala every day carries that load. "We are reorganising the app around what actually happens, left to right": four stages as the primary navigation, drawn as a workflow graph (Pedidos with an approval state; the Demanda turned into a derived Processamento stage that feeds the engine; the Escala with its inputs; Aprovar last, with the exports), and Alunos, INVAs and Recursos as list-and-detail screens beside a rail whose month calendar is the only date control, laid out as a three-pane mail client. Nothing below is built. Delivery: one git worktree, branch and PR per step, stacked as the `abas-*` branches were; each branch is pushed to the fork, its PR to upstream opened when Pedro asks; Gabriel merges in five sittings. Pedro approves by answering "Left for Pedro" (each item carries the default the plan implements) or by saying "with the defaults", which leaves out the two golden changes, C2 (item 1) and C's commit "texto" (item 11).

**The plan in one page.**
- **What does not move.** `runAllocationEngine(state)` keeps its input shape, its rules and its 41 goldens (two alert texts no golden holds are reworded, `js/engine.js:932` in F1a and `:994` in G2); the only golden changes are C2 (37 of 41 files) and "texto" (7 lines of `cenario-06.json`), each only with Pedro's explicit yes. `gravarAlteracao` stays the only writer and `dia.pedidos` the engine's only input, so pins, statuses, results, the nine History revert kinds, the TV, the BI and the exports keep today's flight keys (`<stuId>_<mid>_1`). `painel.html` is not edited; no build step, no new dependency.
- **Pedidos (D1, D2, D3).** `solicitacoes` gains an approval state, "2ª preferência" and "Disponibilidade" (eight nullable columns, one migration). Operador and Administrador approve and withdraw; the Secretaria registers and cancels; an Operador's own pedido is born approved ("Registrar e aprovar"). The deadline, the exception (now refused on Sundays and past dates) and the local-flight limit stay. The page: the open date's list with the form ("Data do pedido" its own field) or a read-only detail, read again every 60 s. `js/agenda.js`, its view and events and `solicitacoes` keep their names (in code `pedido` already names the day's record).
- **Processamento (E, G1, G2).** The pure `js/processamento.js` conciliates the approved pedidos with the day (entries, returns and exits under guards; the course mission bound at entry by the day's times), applied by one logged write, "Atualizar a escala", and at once after an approval only on a date already started (five conditions: the open date, its data read, a stored day, results and courses read, no change elsewhere). `js/rejeicoes.js` pairs the engine's rejections with requests; `js/restricoes.js` writes the operator's restrictions. `#s-proc` shows each pedido enriched and why it cannot be scheduled ("não cabe nem sozinho", "não coube na escala"), with no input; restrictions are edited in G1's drawer "Restrições do voo". "Limpar demanda" becomes "Recomeçar pelos pedidos"; "+ Pôr um aluno" and "+ missão" end.
- **Escala and Aprovar (B, H).** The Escala keeps its views and flight actions and opens with its inputs, `#entradas` (restrições do operador, pedidos processados, critérios); closing a period for one date moves there (`details#periodos`; `win` stays). `#s-apr`: pending items as links, approve and reopen (approving pins what it lets in), the three exports recorded, "Compartilhar"; nothing blocks.
- **Cadastros (F3, F2, A, A2, B, C).** `inativo` (from today on; the engine reads `estadoParaEscalar`) and `exige` (ids of the habilitações registry) in format 26; F2's list–detail component lands with Alunos; A adds nome completo, missão anterior and atual and results without a flight, and the Secretaria stops editing personal data (A2 on the server); B groups Recursos by category; C gives INVAs per-date ranges `faixas` (format 27, today's presence meaning) with one-click periods and turnos, and deletes the grid and both record drawers.
- **The shell (F1a, F1b).** Four stage cards in `nav#linha` with 17 sub-task rows and states, then links (Cadastros, Rodízio, BI); the rail `aside#trilho` with the calendar (docked from 1,280 px; the cap moves to 1,612 px) and the date's notifications; screens in the address `#/<tela>[/<item>]`.
- **Delivery.** plan → F0a, F0b, F0c (no visible change) → F3 → F1a → F1b → F2 → [A → A2 → D1 → D2 → D3], [B], [C], [E's module] in parallel, rejoined A, A2, B, C, D1, D2, D3, E → G1 → G2 → H → I; C2 alone. 19 PRs after the plan (20 with C2), five sittings, three sweeps of the stored days (formats 26, 27, 28), five migration files.
- **How solid.** Measured: the conciliation (two property runs of 24,000 steps), the golden-neutral reading of ranges (5,345,280 interval cases, no difference), the rejection pairing (9,040 rejections, none out of line), the approval pinning (641 states), the export fingerprint, the list's redraw during a click. Not run: the layout numbers are computed, no e2e test of any step ran, the server counts were not taken, the operator's screen width is unknown. Risks: the start-versus-presence rule (item 1), G2's cut-over (rehearsed; with 28 in E, G2 reverts alone), F2 as the parallel phase's single dependency.
- **The operator's routine** on a typical date (15 pedidos, an aircraft out, the afternoon closed, 3 INVAs absent, 2 turnos, a lunch break, 3 adjustments, a student with no pedido after 13:00, one taken off, one cancellation, approval and three files): 33 interactions today, 42 after H (43 with the rail not docked): +1 per restriction edit, +4 for the student with no pedido, +2 for Aprovar and back, +1 for the INVAs, +1 the first time a period is closed on the Escala. In return late pedidos on a started date enter by themselves (−2 per batch), a cancelled pedido's flight leaves by itself (−1), stale course missions are fixed for every student by one click, the date's restrictions are in one list, and news from another computer arrives within 60 s.

**Decisions this reverses or restates.**
1. "No sidenav, the segmented switch everywhere" (docs/PLAN.md:443): the cadastros become list–detail screens; the `.seg` switches of Recursos and Instrutores go, and `mostrarVista` (:445) with the last (C).
2. "The Demanda stays the students' day view" (:443; Alunos links to it, :447): it becomes the derived Processamento stage (G2); "Abrir a Demanda" goes (A).
3. Recursos and Instrutores split into "Disponibilidade do dia" and "Cadastro" (:443, :445, :448): the detail shows both, sections with a scope tag, "Nesta data" first (B, C).
4. "Limpar demanda" (Pedro's decision of 2026-11-19, :437) becomes "Recomeçar pelos pedidos" (G2): each approved pedido's flight back, in place, to what the pedido gives; hand-made flights leave; flown, cancelled, taken-off and dismissed ones stay; an approved schedule reopens.
5. The course-mission confirmation "in Demanda" (:371; P16, :397; the closed course of :404) moves to G1's drawer, with the same armed texts.
6. The release of a booked flight whose mission changes in Demanda (:422) becomes one pure rule (`fixosSemOAgendadoQueMudou`): only a real change of mission, resource type or hours releases it.
7. "The date always on top, tabs in the order of use with attention badges" (Phase 6, :181): the date's name stays on top as the button to the calendar; tabs become cards and links, badges states and values.
8. "History as a side drawer over any tab" (:182): still a drawer, now to the left of a docked rail.
9. Pedro's decision of 2026-11-17 that an over-limit local flight warns and asks for a confirmation, for every local mission (:375, item 6), built only in the booking dialog, stays unbuilt in Pedidos: the 7th local flight at the same 1st preference is refused (`PT422`), as today. Item 6.
10. The same 2026-11-17 batch asked for the resource, the 2nd preference, the instructor and the priority on the Agenda's pedido (not recorded in this file): only the 2nd preference, with "Disponibilidade", is added; resource type, INVA and priority stay operator restrictions. Item 5.

From the courses section's "Left for Pedro": :421 stays (a booking creates no pedido); :418 and the import half of :424 are settled by the binding at entry by time; :425, :430, :431 and :435 stand, two refusal texts reworded; :440 is fixed in F0b.

#### Today → target

| Today (tab, region or data) | Target (stage, screen, pane, module or data) | Step |
|---|---|---|
| Tab "Agenda" (`#s-age`), its calendar and own day | stage 1, card "Pedidos" ("Agenda" until D2): the open date's list, the form or a read-only detail; the calendar to the rail | F1a, F1b, D2 |
| Tab "Demanda" (`#s-dem`), edited by hand each date | stage 2, card "Processamento" ("Demanda" until G2), `#s-proc`: read-only lines, five writes; its columns to the Pedidos form or the drawer | G1, G2 |
| Tab "Escala" (`#s-esc`) and its two bars | stage 3, card "Escala": four views, `#entradas`, `details#periodos` | B, H |
| Approval in the Escala's bar (`#aprovacao`), the exports, "Compartilhar" | stage 4, card "Aprovar" (`#/apr`, the Escala's approval bar until H), `section#s-apr` | F1a, H |
| Tabs "Alunos", "Instrutores", "Recursos", "Cursos", "Rodízio", "BI" | links of the secondary line; Alunos, INVAs ("Instrutores" until C) and Recursos as list–detail screens; Cursos, Rodízio, BI as today | F1a, F2, A, B, C |
| Painel (the Escala's fourth view), `painel.html` | unchanged; the TV page byte-identical | — |
| Header tools; `.topo-data` (‹, ›, the native field) | tools kept; `button#btn-data` and the rail's calendar | F1a, F1b |
| `nav#nav`: nine tabs, separators, three badges | `nav#linha`: four cards with 17 rows and states, the secondary line; badges become states, values, the Recursos link's badge, rail items | F1a, H |
| The screen shown (memory only) | the address; a list's selection `#/alu/<id>`; Back never changes the date | F1a, F2 |
| Record drawers `aside#painel-dados`, `aside#painel-instrutor` | sections of the Alunos and INVAs details | F2, C |
| Histórico, Sugestões, four dialogs, the map pop-up | kept; G1 adds `aside.gaveta#painel-restricoes` | G1 |
| `solicitacoes`: registered or cancelled | plus approved and withdrawn (who, when), `horario2`, `disponibilidade` | D1 |
| `dia.pedidos` and its records | still the engine's only input; one record per pedido that entered, never deleted or renumbered (leaving is `fly: false`); plus `etapaDoPrograma` | E (28), G2 |
| `dia.importadas` | the pedidos the date received and still holds; an id leaves with its pedido's exit or by "Trazer de volta" | G2 (28) |
| `dia.ins[id].aw` | `dia.ins[id].faixas` (`[de, ate)` in minutes); `aw` kept as the copy of before | C (27) |
| `dia.win`, edited in Recursos | kept with its readers; edited on the Escala; not copied to a new date | B |
| `frota[].habilitacaoPropria` | `frota[].exige`, the flag kept as a mirror | F3 (26) |
| (nothing) inactive | `inativo: true` on `stu[]`, `ins[]`, `frota[]`; "Ativo", "Mostrar inativos" | F3 (26); F2, B, C |
| (nothing) a record of exports | `dia.exportacoes` (`csv`, `pdf`, `xlsx`: when, who, a fingerprint), `dia.reabertura` | E (28), H |
| `dados_pessoais`, written by the Secretaria too | plus `nome_completo`; only Operador and Administrador write | A, A2 |

#### Where every existing control ends up
Each control of today appears once; new controls close each table.

**Header, navigation and the screens whose behaviour does not change**

| Control today | Ends up | How | Step |
|---|---|---|---|
| "Pular para o conteúdo", the logo, "Histórico", the login; Cursos, BI ("Data base" `#bi-dt`), Minha conta, the Manual's anchors | where they are | kept | — |
| "Dia anterior" `#dt-ant`, "Próximo dia" `#dt-prox`, "Data da escala" `input#dt` | the rail's day and month buttons | replaced | F1b |
| `#dt-rotulo`, `#dt-rel`; "Perfil de acesso" `#role-sel` | inside `button#btn-data`; the header | kept | F1b |
| "Manual"; the account menu ("Minha conta", "Usuários", "Tema escuro", "Sair"); "Como funciona o rodízio" | links to `#/manual`, `#/conta`, `#/conta/usuarios`, the Manual's anchor | kept, as links | F1a |
| Tabs "Agenda", "Demanda", "Escala", badges `#selo-age`, `#selo-esc` | cards 1 to 3 ("Pedidos" from D2, "Processamento" from G2); badges become rows, states, values | replaced | F1a, D2, G2 |
| Tab "Recursos" and `#selo-rec`; "Instrutores", "Alunos", "Cursos", "Rodízio", "BI"; `span.aba-sep` | links of the secondary line (Recursos keeps the badge; "INVAs" from C); no separators | replaced | F1a, C |
| "Recarregar", "OK", "Tentar de novo" of the three notices | `div.avisos-do-app` | moved out of `main` | F1a |
| (new) card 4 "Aprovar", `#btn-data`, `#btn-linha`, the links, `#btn-fixar-trilho`, `#btn-fechar-trilho` | linha, header, rail | new | F1a, F1b |

**Agenda (`#s-age`)**

| Control today | Ends up | How | Step |
|---|---|---|---|
| "Agenda de Solicitações", `h3#agenda-data` | "Pedidos de <data>"; the form's title | replaced | D2 |
| `p#agenda-prazo` | top of the form, following "Data do pedido" | moved | F1b, D2 |
| The calendar (`[data-cal]`, `span.qtd`, `.dia.fechado`) and its own day | the rail (counts from `solicitacoes_por_dia` from D2); "Data do pedido" `select#ag-data`, closed days "· prazo encerrado"; no Sunday opens | replaced | F1b |
| "Aluno" (active students only), "Fase / missão", "Duração (h)", "Registrado por", "Observação", `#ag-erro`, "Exceção da Coordenação" (now registering approved) | the form | kept | D2 |
| "Horário" | "1ª preferência" | relabelled | D2 |
| "Registrar pedido" / "Registrar mesmo assim" | "Registrar pedido" (Secretaria); "Registrar e aprovar", "Registrar sem aprovar" (Operador, Administrador) | split by profile | D2 |
| "Importar N pedido(s) para a demanda" | "N pedidos aprovados fora da demanda · Importar"; from G2 "Atualizar a escala" | replaced | D2, G2 |
| The table `#agenda-lista`, its six columns | F2 rows grouped by state, the mark "Fora do prazo", a read-only detail; tags "Na demanda", "Tirado da demanda", "Fora da demanda" until G2 | replaced | D2 |
| "Cancelar" `cancelar-pedido` | the detail's "Cancelar pedido" | moved | D2 |
| (new) "Aprovar", "Aprovar todos (N)", "Retirar aprovação", "+ Novo pedido", "Atualizar", search, "Situação", "2ª preferência", "Disponibilidade", "Registrar de novo…" | Pedidos | new | D2 |

**Demanda (`#s-dem`)**

| Control today | Ends up | How | Step |
|---|---|---|---|
| "Importar da agenda" `#importar-agenda` | "Importar N pedidos aprovados" until G2; then "Atualizar a escala" in `#proc-aviso` | replaced | D2, G2 |
| "+ Pôr um aluno na demanda…"; "+ missão" `add-mis`; the ✕ of an extra `del-mis` | none: a pedido ("Registrar e aprovar") or "+ Agendar voo"; "Tirar da escala" | removed | G2 |
| "Só quem voa"; the search, "Todos os cursos", "Todas as missões", "Mais"; the count `#cnt` | `#flt-proc-sit`; `#flt-proc`, `#flt-proc-cur` (not shared with Alunos), `#flt-proc-mis`, `#btn-mais-proc`; `#proc-cnt` | replaced; moved | G2 |
| "Limpar demanda" `#clr` | "Mais" › "Recomeçar pelos pedidos" | replaced | G2 |
| The row `tr[data-k="d"]`, name, `span.etapa`, the tag "agendado HH:MM" | a read-only Processamento line and detail; the drawer's body; the lock in the Escala | replaced | G1, G2 |
| Recurso `eq`, Instrutor `insId`, Prioridade `pr`, 1ª and 2ª preferência `p1`, `p2`, Disponibilidade `jan`, Duração `nb`, their "?" | the drawer (Tipo de recurso, Instrutor, Prioridade, Horário with "Só às HH:MM (o pedido)", Duração); preferences and duration also in the Pedidos form | moved | G1 |
| "Próxima · Usar"; "Outra missão…", "Usar … fora da ordem" | bound at entry; the drawer's "Usar a do programa" and "Trocar…", armed as today | replaced; moved | G1 |
| Missão `[data-f="mis"]` | the Pedidos form's "Fase / missão" | removed as an input | G2 |
| Voa `[data-f="fly"]` and its "?" | on: derived; off: "Tirar da escala"; back: "Pôr de volta na escala"; the tip becomes `fora-da-escala` | replaced | G2 |
| "Nenhum aluno com esses filtros.", `tr.empty-dem` | F2's empty state; "Nenhum pedido para esta data." | replaced | G2 |

The ten columns, as the request asks: Aluno and Missão are fields of the pedido; 1ª and 2ª preferência, Disponibilidade and Duração are fields the drawer can override; the course mission, the resource type (the programme's) and "Voa" on are derived, the first two overridable, "Voa" off being "Tirar da escala"; Instrutor and Prioridade (3 at entry) are operator restrictions only.

**Escala (`#s-esc`)**

| Control today | Ends up | How | Step |
|---|---|---|---|
| The title, "Atualizada às", "Aprovada às"; views; "+ Agendar voo"; filters; the day's numbers; Lista and maps, "Sugestões", status, result, the Painel | the Escala | kept | — |
| "CSV", "PDF", "Excel"; "Compartilhar" | Aprovar › "Exportações", each export recorded; "Copiar o link" | moved | H |
| "Aprovar escala", "Reabrir" (`#aprovacao`) | Aprovar › "Aprovação": a fixed armed text, the counts beside it | moved | H |
| The second bar `#compactacao` ("Buracos", "Horários", their "?") | `#entradas` › "Critérios": "Redução de ociosidade", "Prioridade de horários dos alunos" ("Sem efeito nesta data" when no flight can move); labels and ids kept | moved, renamed | H |
| "N missões não entraram…", "N voos em conflito…", "N avisos…" | kept, drawn from the items; each missing line gains "Restrições" and "Encaixar…"; the avisos no longer shrink at approval | kept | G1, H |
| "✕" `rm-fly` (row and `#tl-pop`) | the same; its handler in `js/eventos/restricoes-do-voo.js`, with "Pôr de volta" | kept | G1 |
| "…na aba Demanda…", "Nenhuma missão marcada na Demanda.", the PDF's "Missões na demanda" | "aba" out; then texts pointing at Processamento; "Missões pedidas" | replaced | F1a, G2 |
| (new) "Refazer a escala"; `details#periodos`; "Restrições" on rows and `#tl-pop`; `#entradas`, `#restricoes-da-data` ("Soltar", "Automático", "Abrir") | the Escala | new | F3, B, G1, H |

**Alunos (`#s-alu`)**

| Control today | Ends up | How | Step |
|---|---|---|---|
| "Buscar aluno…", "Todos os cursos", "N de M alunos", "+ Novo aluno" | the list's toolbar (search also by CANAC and nome completo; a new student opens selected, `#/alu/novo` until saved) | kept; moved | F2, A |
| "Os pedidos de cada data ficam na Demanda." "Abrir a Demanda" | none | removed | A |
| "Nome", "Peso (kg)", "Curso", "Priorizar com", "Não escalar com" (chips, ✕, selects, "?") | the detail › "Cadastro", same `data-f` and `data-act`, saved on leaving the field | moved | F2 |
| CANAC cell; progress `small.progresso` | the row's second line and the subtitle; the row's meta and third line | moved | F2 |
| "Dados pessoais" | the detail's section, "Salvar" and "Desfazer" | replaced | F2 |
| "✕" `dels`; empty rows; the phone card | "Excluir aluno…" at the foot; `li.lista-vazia`; list, then detail on phones | moved; replaced | F2 |
| (new) "Ativo", "Mostrar inativos", "Anterior", "Próximo" (F2); "Nesta data", "Curso e missões", "Registrar resultado sem voo", "Colocar no curso até…", "Nome completo", "Apagar os dados pessoais" (A) | row, toolbar, detail | new | F2, A |

**Instrutores (`#s-ins`)**

| Control today | Ends up | How | Step |
|---|---|---|---|
| "Disponibilidade do dia" / "Cadastro" | none: one detail, both scopes | removed | C |
| "Buscar instrutor…", "Todas as habilitações", the count, "+ Novo instrutor"; two "Limpar filtros" | the list's toolbar; one, in the empty state | moved; replaced | C |
| "Vem" `[data-f="on"]` | the row's quick switch; the detail › "Nesta data" | moved | C |
| The nine cells `[data-f="aw"]`, "Aplicar turno…", the legend, "Voos" and `.cel.voo` | "Nesta data": nine period chips, five turno buttons, "Editar faixas" and "Salvar faixas"; on the row a read-only strip and "3 voos" | replaced | C |
| "Instrutor", "Mês", "Habilitações", CANAC; "Nome", "Peso (kg)" | the row; the detail › "Cadastro" | moved | C |
| "Editar habilitações", "Dados pessoais" | the detail's sections | replaced | C |
| "✕" `deli`; `#limites-lei` | "Excluir instrutor…"; the pinned item "Limites da Lei do Aeronauta" | moved | C |
| (new) "Ativo", "Mostrar inativos", "Agendar voo com <nome>" | row, toolbar, title | new | C |

**Recursos (`#s-rec`)**

| Control today | Ends up | How | Step |
|---|---|---|---|
| "Disponibilidade do dia" / "Cadastro", `#selo-rec-dia` | none; the count goes to the rows' dots and the rail | removed | B |
| "Buscar matrícula…", the count, "+ Novo recurso" and its form; two "Limpar filtros" | the toolbar (the form in the detail pane); one, in the empty state | moved; replaced | B |
| "Todas as categorias"; the group rows | the list grouped by category, headers selectable | replaced | B |
| "Janelas de operação" `#wins` | the Escala, `details#periodos` | moved | B |
| "Disponível", "Horas disponíveis", "Na escala do dia", "Revisão feita" | the row's quick switch and values; the detail › "Nesta data" | moved | B |
| "Ordem no hangar" `#hangar` | the list's pinned first item | moved | B |
| "Frota", "Só Parafuso", "Só VFR", "Habilitação própria", "Retirar" | the list; the detail › "Cadastro" with "Habilitações que o INVA precisa" (writes `exige`); "Retirar da frota…" at the foot | replaced; moved | B |
| "Horários de decolagem" and its editor | the category's detail | moved | B |
| (new) "Ativo", "Mostrar inativos", "Agendar voo no <reg>" | row, toolbar, title | new | B |

**Drawers, dialogs and pop-ups**

| Control today | Ends up | How | Step |
|---|---|---|---|
| `aside#painel-dados` (the five fields, errors, "Atualizado em", ✕, "Cancelar", "Salvar") | the "Dados pessoais" section of the Alunos and INVAs details ("Nome completo" first; "Desfazer" for "Cancelar") | replaced; drawer deleted | F2, C |
| `aside#painel-instrutor` (habilitações, hours, `ext-mes`, `ext-ano`) | the INVA's "Habilitações" and "Horas de voo e limites da lei" | replaced; drawer deleted | C |
| Histórico; Sugestões `#painel-reparo`; `#dlg-agendar`, `#dlg-status`, `#dlg-painel`, `#dlg-sessao`; `#tl-pop` | the same (the Histórico left of a docked rail; "Marcar <nome> disponível" adds the flight's interval; `#tl-pop` gains "Restrições") | kept | F1b, C, G1 |
| (new) `aside.gaveta#painel-restricoes` | opened from the Escala and Processamento | new | G1, G2 |

#### Data-format steps and database migrations
`ESQUEMA` is 25. F0a moves the one literal pin of the number to `test/unit/migracoes.test.js` and rewrites `test/unit/config-do-painel.test.js:127, 129`; each numbered step edits `js/migracoes.js:13`, its `PASSOS` entry, that pin, its test and README "Formato dos dados". F3, C and E merge in that order; no other step has a number, and there is no 29.

| Nº | Step | What it carries | Conversion | Sweep |
|---|---|---|---|---|
| 26 | F3, commits "registro" and "inativos" | cadastro: `stu[].inativo`, `ins[].inativo`, `frota[].inativo` (only `true` stays), `frota[].exige` | a resource with `habilitacaoPropria: true` and no `exige` gets `exige: ['aviao:<reg>']`, the flag kept as a mirror; days: none | Onda 1 opening |
| 27 | C, commit "dados" | day: `ins[<id>].faixas`, `{ de, ate }` in minutes, `[de, ate)`, 390 ≤ de < ate ≤ 1440, sorted, merged, at most 8; `aw` kept, not copied to new dates | each run i..j of `aw` → `{ de: T[i], ate: fim(j) }`; goldens byte-identical | Onda 2 opening |
| 28 | E's last commit, after E rejoins on D3 | nothing converted; protects `etapaDoPrograma` (only `true`), the ids that leave `importadas` from G2 on, and the day keys `exportacoes` (`{}`) and `reabertura` (`null`) H writes | `{ cadastro: c => c, dia: d => d }` | Onda 3 opening |

A sweep is one read and one `salvar_dia` per stored day, then the cadastro, at the first Operador or Administrador opening; a tab on the previous number is refused at its next save (`PT409`, hint `formato`), and no revert below the number can save. 28 sits in E because `salvar_dia` refuses a day below the stored `esquema` (`supabase/migrations/20261114143242_formato_e_status_do_dia.sql:22-26`): in G2 it would make G2 unrevertable after Pedro's opening; in E, G1 and G2 stay revertible.

Migrations, in the order the files reach the shared preview (all later than `20261120150000`; a file is frozen once on the preview, a correction is a new file):

| # | File | Step | Content | Database checks | Preview | Production |
|---|---|---|---|---|---|---|
| 0 | `20261122100000_<correção>.sql` (reserved) | plan | only if Onda 0's `npm run test:db` on unchanged upstream/main finds a red check | the red check | Onda 0 | Onda 0 |
| 1 | `20261123100000_nome_completo_nos_dados_pessoais.sql` | A | nullable `dados_pessoais.nome_completo` (1 to 120 characters); the 5-argument `salvar_dados_pessoais` reads the key, absent keeping the stored value | `dados-pessoais.test.sql` plan 47 → 54 | as soon as written | Onda 1, before A's merge |
| 2 | `20261123100100_secretaria_nao_grava_dados_pessoais.sql` | A2 | `grava_dados_pessoais()`; the 5-argument function refuses who is not operador or administrador (`42501`); the 3-argument overload dropped; reading untouched | 54 → 56 | right after #1 | Onda 1, after A is live, before A2's merge |
| 3 | `20261124100000_aprovacao_dos_pedidos.sql` | D1 | eight nullable columns and two checks of `solicitacoes`; the 9-argument `registrar_solicitacao` dropped, a 13-argument one, the 10-argument one as a shim (an Operador's pedido born approved); `cancelar_solicitacao` replaced; `aprovar_solicitacoes`, `retirar_aprovacao_da_solicitacao`, `solicitacoes_por_dia`, `aprovar_solicitacoes_de_antes_da_aprovacao(boolean)`, run with `true` | new `agenda-aprovacao.test.sql` (about 50) and `agenda-preferencias.test.sql` (about 16); four files changed | in the parallel phase, from D1's branch | Onda 3, first, before D1's merge |
| 4 | `20261124100100_importados_ja_aprovados.sql` | G2 | `select public.aprovar_solicitacoes_de_antes_da_aprovacao(false);` (rule a again) | the conversion cases, run twice | after the rehearsal | Onda 3, with D2 live, before G2's merge |
| 5 | `20261125100000_agenda_sem_a_versao_anterior.sql` | I | drops the 10-argument `registrar_solicitacao` and the conversion function | `agenda-horas`, `agenda-locais` on 13 arguments; two `hasnt_function` | Onda 4 | Onda 4, before I's merge, with G2 live |

The conversion: (a) on a past date, every non-cancelled pedido whose id is in its day's `importadas` is approved; from today on, only while a record still carries it, flying or not; (b) once, in D1, the non-cancelled pedidos from today on that an Operador or Administrador registered and that are not in `importadas`. A withdrawn pedido is never approved by it; pedidos cleared before D1 stay waiting: approved later they are "dispensados", back only with "Trazer de volta".

Deploy rules:
- **Preview first.** Every push is made from a checkout of the step's own branch tip in the integration worktree, after `supabase migration list` and `supabase db push --dry-run` list exactly that step's file. Preview order: A, A2, D1 (while B and C are built), then G2 and I.
- **Production before the merge**, for every file. The one ordering exception is A2: its production push waits until A is live, because the app before A offers the Secretaria a "Salvar" that A2 would turn into an error; that is why A2 is its own PR.
- **Database checks only on the preview project, run by Pedro** (`npm run test:db`, from a checkout holding every file the preview has). CI never runs pgTAP, so a server rule's PR also updates its three JavaScript mirrors (`test/e2e/falso/*.js`, `clienteFalso`, `js/backends/local.js`) and shared cases checked on CI. Ten pushes in all.
- **Local mode** has no format guard: D1 converts `acpm4_agenda` once (marker `acpm4_agenda_aprovacoes`), G2 runs rule (a) once more (marker `acpm4_agenda_aprovacoes_g`).

Servers, state on 2026-11-21 (this table supersedes the "Not applied" and "Not deployed" notes of the sections above, at :379, :408-411 and :457-459):

| What | Preview | Production | Note |
|---|---|---|---|
| `20261117200000_cursos_e_missoes.sql` | applied (2026-11-20) | applied (2026-11-19, Pedro) | dropping `importar_cursos` (:412) stays outside this redesign |
| `20261120150000_painel_do_dia_com_a_configuracao.sql` | applied (2026-11-20) | applied (2026-11-20) | |
| Edge Function `meteorologia` and its secret | deployed, secret set (2026-11-20) | deployed, secret set (2026-11-20) | |
| The Auth `config push` recorded as pending (:192) | not checked | not checked | compared in Onda 0, pushed on its own if pending |
| 3-argument `salvar_dados_pessoais`, 9-argument `registrar_solicitacao` | installed | installed | the app calls neither; dropped by A2 and D1 |

#### Steps, the files each owns, and the order

| Step | Branch (→ base) | Sitting | Nº | Migration |
|---|---|---|---|---|
| plan | `linha-0-plano` (→ upstream/main) | Onda 0 | | #0, reserved |
| F0a, F0b, F0c | `linha-f0a-testes` (→ plan); `linha-f0b-costuras` (→ F0a); `linha-f0c-estilos` (→ F0b) | Onda 0 | | |
| F3 | `linha-f3-cadastro-base` (→ F0c) | Onda 1 | 26 | |
| F1a, F1b | `linha-f1a-linha` (→ F3); `linha-f1b-trilho` (→ F1a) | Onda 1 | | |
| F2 | `linha-f2-lista` (→ F1b) | Onda 1 | | |
| A, A2 | `linha-a-alunos` (→ F2); `linha-a2-secretaria-so-le` (→ A) | Onda 1 | | #1; #2 |
| B | `linha-b-recursos` (→ F2; rejoins on A2) | Onda 1 | | |
| C | `linha-c-invas` (→ F2; rejoins on B) | Onda 2 | 27 | |
| C2 | `linha-c2-regra-das-faixas` (→ C), only with a yes | alone | | |
| D1, D2, D3 | `linha-d1-aprovacao-no-servidor` (→ A2; rejoins on C); `linha-d2-pagina-dos-pedidos` (→ D1); `linha-d3-pedidos-em-dia` (→ D2) | Onda 3 | | #3 |
| E | `linha-e-processamento` (→ F2 for the module; rejoins on D3) | Onda 3 | 28 (last commit) | |
| G1, G2 | `linha-g1-restricoes-do-voo` (→ E); `linha-g2-tela-do-processamento` (→ G1) | Onda 3 | | #4 (G2) |
| H | `linha-h-escala-e-aprovar` (→ G2) | Onda 4 | | |
| I | `linha-i-limpeza` (→ H) | Onda 4 | | #5 |

Every step: tests first, red; `CI=1 npm test` green in its worktree and on the PR before the merge; an independent review (an agent that did not write it, given this item and the diff; findings confirmed first; this section records what it changed), and one more of each rejoin; the TV's 65 specs and `painel.html` unchanged; Manual, glossary and README move with the screen.

- [ ] **plan · This section** (branch `linha-0-plano`, on upstream/main): only this section of `docs/PLAN.md`; nothing else is edited.
- [ ] **F0a · Test drivers** (branch `linha-f0a-testes`, on the plan): the e2e reaches the app only through nine per-screen drivers (`test/e2e/telas/*.js`), so later steps edit a driver instead of dozens of specs; the fake server split by topic (`test/e2e/falso/`); `cadastros.spec.js` split in four; `test/e2e/manual-frases.js`; the lint inside `npm test`; two ports per folder (`scripts/porta.mjs`); the format pin. Tests first: `test/unit/donos-dos-seletores.test.js`; the suite's duration measured. The app: as today; no assertion of the 578 e2e tests changes. README "Testes".
- [ ] **F0b · Seams** (branch `linha-f0b-costuras`, on F0a): `js/redesenho.js` replaces six hand-written redraw lists; `aoReverter` registers the nine revert kinds by screen; `save()` saves before it redraws; the cadastros modules split per screen; `importarSolicitacoes` and its 21 tests move to `js/processamento.js`; `pesoDoTexto`; `normalizeMissionFields` checks types (own commit, :440); `js/main.js` imports one module per screen. Tests first: `test/unit/{redesenho,desenhos-registrados,eventos-ligados,reversoes-registradas,grafo-da-tv}.test.js`, `test/e2e/gravacao.spec.js`. The app: as today. README "Estrutura".
- [ ] **F0c · Stylesheets** (branch `linha-f0c-estilos`, on F0b): twenty stylesheets, one per owner; `css/app.css` the TV's five `@import` lines, `painel.html` byte-identical; four dead rules out; the Manual one sentence per line, the glossary one group per line. Tests first: `test/unit/estilos.test.js`; the census `scripts/medir-estilos.mjs` identical before and after. The app: identical. README.
- [ ] **F3 · Registry and inactive flag** (branch `linha-f3-cadastro-base`, on F0c; format 26): "registro" (the groups in `js/habilitacoes.js`; `exige` and its readers; the engine untouched) and "inativos" (`js/inativos.js`; every reader of the three rosters gated; the Escala's warning with "Refazer a escala"; "Aluno inativo" on a pedido); no switch yet. Tests first: goldens byte-identical after each commit; `test/unit/inativos.test.js` (about 16), `test/e2e/inativos.spec.js` (about 10). The app: as today. README "Formato dos dados"; glossary `habilitacao-propria`.
- [ ] **F1a · The linha** (branch `linha-f1a-linha`, on F3): screens with a name and an address (`js/telas.js`, `js/endereco.js`, `js/views/telas.js`); the tokens, F2's included; `nav#linha` with four cards and the secondary line (`js/linha-do-dia.js`, `js/views/linha.js`, `js/eventos/linha.js`, `css/linha.css`); the moments `perfil`, `pedidos`, `data-aberta`, `sessao`; the "aba" texts; the Aprovar card shows the Escala's approval bar until H. Tests first: `test/unit/{telas,linha-do-dia}.test.js`, `test/e2e/casca.spec.js` (about 32); about 40 existing tests change. The app: cards and links instead of tabs. Manual "As telas"; glossary; README.
- [ ] **F1b · The rail** (branch `linha-f1b-trilho`, on F1a): `aside#trilho` (the calendar with each day's count; docked from 1,280 px; "Fixar ao lado" per width class), `button#btn-data` for `.topo-data`, the cap 1,612 px (1,248 + 12 + 320 + 32), the fixed-height frame, drawers left of the rail; the Agenda follows the open date, with "Data do pedido"; the avisos. Tests first: `test/unit/calendario.test.js`, `test/e2e/trilho.spec.js` (about 32); about 45 existing tests change. The app: the next date is one click on the rail. Manual's date and Agenda sentences; README.
- [ ] **F2 · List and detail, with Alunos** (branch `linha-f2-lista`, on F1b): five commits: a cadastro `PT409` re-reads the date instead of locking; a redraw waits for the click and replaces only what changed; the component (`js/lista.js`, `js/detalhe.js`, `js/views/{lista,detalhe,mestre-detalhe}.js`, `css/lista.css`) with Alunos; personal data in the detail; "Ativo" and "Mostrar inativos". Its interface, frozen at its tip: `item.rapida`, `item.acao`, `item.bloco`, `item.apagado`, `vazio: { elemento }`, pinned items, selectable group headers, the CSS of `data-vendo="ambos"`; the switch `button.lista-chave[role=switch][data-act="ativo"]`, one click each way, one handler (`js/eventos/inativos.js`) for the three rosters, one revert kind (`setInativo { de, id, inativo }`); `js/main.js` imports it and `js/eventos/editor-de-dados-pessoais.js`. Tests first: `test/unit/lista.test.js` (about 36), `detalhe.test.js` (about 18), `test/e2e/lista.spec.js` (about 26, with a bench list); a VoiceOver read in the PR. The app: Alunos as list and detail. Manual's Alunos sentences; glossary `inativo`.
- [ ] **A · Alunos** (branch `linha-a-alunos`, on F2; migration #1): nome completo; missão anterior and atual; "Nesta data"; "Registrar resultado sem voo"; "Colocar no curso até…" (`desfazerColocacao`); search by CANAC and nome completo; "Apagar os dados pessoais"; `editaDadosPessoais = operaEscala` (the Secretaria reads, edits nothing); "Abrir a Demanda" out. Tests first: pgTAP (47 → 54), the shared cases and mirrors, unit, e2e. The app: Alunos' new sections. Manual, glossary, README:13-15.
- [ ] **A2 · The Secretaria only reads** (branch `linha-a2-secretaria-so-le`, on A; migration #2): the server refuses her write; the 3-argument overload goes; pgTAP 54 → 56; the fake's mirror. Its own PR: its production push follows A's merge. The app: unchanged.
- [ ] **B · Recursos** (branch `linha-b-recursos`, from F2, rejoining on A2): the list by category (headers hold "Horários de decolagem"), "Ordem no hangar" pinned, details "Nesta data" then "todas as datas" with "Habilitações que o INVA precisa" (`setExigencias`); `details#periodos` on the Escala (`js/views/periodos.js`, `js/eventos/periodos.js`); `win` not copied to new dates; the rail item `periodos-fechados`. Tests first: `test/e2e/periodos.spec.js` (about 7); `recursos.spec.js` rewritten. The app: the afternoon closed on the Escala (5 interactions the first time). Manual `#manual-periodos`; glossary; README.
- [ ] **C · INVAs** (branch `linha-c-invas`, from F2, rejoining on B; format 27): "dados" (`js/disponibilidade.js`: `disponivelPara`, today's presence rule over ranges, falling back to `aw`; `cobre` out; step 27; `git diff --stat test/fixtures/goldens-do-motor` empty); "tela" (the list with ranges, strip, "Vem", "Ativo"; the detail with chips, turnos and "Editar faixas" saved by "Salvar faixas", reverted by `setFaixas`; the grid, both drawers and `js/views/vistas.js` deleted; the label "INVAs"); "texto" only with a yes. Tests first: `test/unit/disponibilidade.test.js` (about 16: 512 period patterns on a 10-minute grid, no difference), old History payloads, e2e instrutores (about 14, typed key by key). The app: the INVAs' pass 9 → 10. Manual, glossary (`turno` replaced), README.
- [ ] **C2 · The start rule** (branch `linha-c2-regra-das-faixas`, on C; only with a yes): a mission may start inside a range; `oQueCabe` says how late it may end; the texts of `js/engine.js:759, 955` and the Manual; 37 golden files re-recorded (282 rows change, 15 enter, 8 leave), the 8 read by a person; the invariant "every row starts inside a range" in the same commit.
- [ ] **D1 · Approval on the server** (branch `linha-d1-aprovacao-no-servidor`, on A2, rejoining on C; migration #3): the migration, two new pgTAP files, `test/helpers/casos-das-solicitacoes.js` (about 36 cases) against the local backend and the fake, the mirrors (with the one-off local conversion), `scripts/semear-dias-previa.mjs`. The app: nothing on screen; from the production push an Operador's pedido is born approved. README "Banco".
- [ ] **D2 · The Pedidos page** (branch `linha-d2-pagina-dos-pedidos`, on D1): card and screen "Pedidos"; F2's list grouped by state ("Aprovar" on a waiting row, "Aprovar todos (N)", cancelled rows muted); the form while nothing is selected; a read-only detail; an approval enters the day at once only under the five conditions, else "Importar" (approved pedidos only); `js/solicitacoes-da-data.js`, `solicitacaoAprovada`, `diaJaGravado()`, `ApiClient.diaMudou`, the card's rows. Tests first: `test/unit/agenda.test.js` (about 24 more), `solicitacoes-da-data.test.js` (about 8), e2e agenda (about 28), agenda-compartilhado (about 11). The app: "Registrar e aprovar". Manual "Pedidos"; glossary; README.
- [ ] **D3 · Pedidos kept current** (branch `linha-d3-pedidos-em-dia`, on D2): the cache read every 60 s while visible, on return, on reconnection and on "Atualizar", each read checking whether the day changed elsewhere; the toasts. Tests first: the timers with an injected clock; e2e "um pedido registrado em outro computador aparece em até um minuto".
- [ ] **E · The Processamento module** (branch `linha-e-processamento`, from F2, rejoining on D3; format 28): parallel commits that touch no D file (`conciliarPedidos`, which receives `aprovada`; `aplicarConciliacao`; `ficaNaEscala`; `missaoDaEntrada`; `js/rejeicoes.js`, also used by the booking dialog; the guards of a record carrying a pedido); after the rejoin the import and D's approval handler call it (`religar` until G2); then 28. Tests first: `test/unit/processamento.test.js` (about 100, with a property test of 300 sequences), `rejeicoes.test.js` (the 41 golden states, 300 seeds). The app: the import with five documented differences, each its own commit. README "Formato dos dados".
- [ ] **G1 · A flight's restrictions** (branch `linha-g1-restricoes-do-voo`, on E): `aside.gaveta#painel-restricoes` from the Lista row, `#tl-pop` and the red box (`js/restricoes.js`, `js/views/restricoes-do-voo.js`, `js/eventos/restricoes-do-voo.js`, which takes `rm-fly`, `usar-proxima`, `usar-fora-da-ordem`, the field handler and the `setFly` revert); the Demanda loses the same columns in the same PR; a pedido's exact minute is never loosened. Tests first: `test/unit/restricoes.test.js` (about 18), `test/e2e/restricoes-do-voo.spec.js` (about 24). The app: "Restrições" on the flight, then the field (+1). Manual; glossary.
- [ ] **G2 · Processamento** (branch `linha-g2-tela-do-processamento`, on G1; migration #4): `#s-proc` (F2's list of `quadroDoProcessamento`, a read-only detail, the five writes); overtaken course missions changed by "Atualizar a escala"; `depoisDeMudarPedidos` for D's handlers, `religar` out; the History read 200 → 500; the form's Duração and 1st preference from `missaoDaEntrada`; `js/engine.js:994` in its own commit; the Demanda deleted. Tests first: `test/unit/processamento.test.js` (about 60 more), `test/e2e/processamento.spec.js` (about 18), the rehearsal; about 150 e2e lines reseeded. The app: no Demanda; a student with no pedido through Pedidos (+4); a cancellation applies itself (−1). Manual, glossary, README.
- [ ] **H · Escala inputs and Aprovar** (branch `linha-h-escala-e-aprovar`, on G2): `#entradas`, `#restricoes-da-data` ("Soltar" new), the criteria panel; `section#s-apr` (pendências, Aprovação pinning what it lets in, "Fixar os N voos novos", the exports recorded without running the engine); the final `js/linha-do-dia.js`; `js/restricoes-da-data.js`, `js/aprovacao.js`, `js/views/aprovar.js`, `js/eventos/aprovar.js`, `css/aprovar.css`. Tests first: about 95 unit and 27 e2e; about 45 e2e tests change. The app: approve and download in Aprovar (+2 with the way back). Manual steps 5 and 6, an `h4` "Aprovar"; glossary; README.
- [ ] **I · Cleanup** (branch `linha-i-limpeza`, on H; migration #5): `test/unit/nomes-aposentados.test.js`; the Manual read through ("Primeiros passos" as the four stages); the "aba" identifiers; the drivers' aliases; the mirrors' 10-argument paths. The app: unchanged.

Files two parallel steps both change (the later branch in the rejoin order resolves, in its own commit, read by the rejoin review):

| File | Steps | How the collision is removed |
|---|---|---|
| `index.html`, `js/glossario.js`, `test/e2e/manual-frases.js` | A, B, C, D2 | by region, term and block; the Manual one sentence per line, one clause per line in :445 and :465; `habilitacao-propria` has a B half and a C half; C resolves on B and A, D2 on C |
| `README.md` | A, B, C, D1, D2 | by row and section; A's :13-15 and D2's :13-14 serial |
| `js/reversoes.js` and its test | A, B, C, E | named regions at least one line apart; E resolves |
| `js/dias.js`, `js/agendamento.js` and their tests | B, C, E | C resolves on B in `diaParaCopiar`; E resolves on D3, which holds C |
| `js/storage.js` | A, C, D1, D2 | C far from the others; A and D on one line |
| `js/views/selos.js`, `js/linha-do-dia.js` | B, D2 | four lines apart; one function per card and aviso group; D2 resolves on C |
| `js/telas.js`; `js/views/vistas.js`; `js/views/painel-de-dados.js`; `test/e2e/dados-pessoais.spec.js` | C, D2; B, C; A, C; A, C | one entry per line; C resolves by deleting, or on A |

**Frozen from F2's tip:** the list component, `css/base.css`, `css/componentes.css`, `css/toque.css`, `css/linha.css`, `css/trilho.css`, the sprite, `js/redesenho.js`, the order of `js/telas.js`, `js/eventos/registro.js`, `js/main.js`, `test/e2e/fixtures.js`, the fake's router and F1's drivers: a change goes through a branch `linha-fix-<assunto>` cut from the lowest open base, merged by every open branch the same day; G1, G2, H and I may edit them once no branch below is open.

**Parallel worktrees.** Sibling folders of the clone (`ACPM-linha-<letra>`), each with its own `npm ci` and two ports derived from the folder (its own `localStorage` origin); the whole suite in CI mode before a push, at most two at once. The integration worktree `ACPM-linha` holds the rejoined line, is the only folder linked to Supabase (the shared preview) and serves the preview checks with real logins (`?supabase=previa`). Rejoin order A, A2, B, C, D1, D2, D3, E; the later branch resolves, and the rejoin review checks the cross-branch rules (C's pane asks A's `editaDadosPessoais`; E's call sits on D2's filter). `main` takes fixes only meanwhile, carried up the same day.

**Release sittings.** Gabriel merges; Pedro runs every server command and opens production first; the day before, every Operador and Administrador is asked not to open the app until then (whoever opens first runs the sweep), and the operator gets a short note in Portuguese.

| Sitting | When | Order | Reaches production; the routine | Undo |
|---|---|---|---|---|
| Onda 0 | any day | inventory and `npm run test:db`; Gabriel merges plan, F0a, F0b, F0c | nothing visible | revert |
| Prévia 1 | F2 green, before the parallel phase | the operator tries the shell and Alunos on the preview (about 30 minutes) | — | — |
| Onda 1 | Saturday, after Monday's escala is approved and exported | Pedro pushes #1; Gabriel merges F3, F1a, F1b, F2, A; Pedro pushes #2; Gabriel merges A2, B; Pedro opens (sweep to 26) and `painel.html` | the linha and the rail, Alunos, Recursos, periods on the Escala | down to F3, one PR of reverts (A's column stays); A2 by a migration; F3 forward only |
| Onda 2 | Saturday | Gabriel merges C; Pedro opens (sweep to 27) | INVAs; their pass 9 → 10 | forward only |
| Prévia 2 | before Onda 3 | the rehearsal; the operator tries Pedidos, Processamento and "Restrições" | — | — |
| Onda 3 | Saturday | Pedro pushes #3; Gabriel merges D1, D2, D3, E, G1; Pedro counts and pushes #4; Gabriel merges G2; Pedro opens (sweep to 28) | Pedidos, the drawer, Processamento; +1 per restriction, +4 per student without a pedido; late pedidos and cancellations apply themselves | G1, G2 by revert (28 is in E); D1 to E forward only |
| Onda 4 | after the day's escala is approved and exported | Gabriel merges H; Pedro pushes #5; Gabriel merges I | Aprovar; +2 for Aprovar and back | H by revert; I's SQL by a migration |
| C2 | alone, with a yes, the date being built approved, Pedro present | Gabriel merges C2 | the start rule; she is told which INVAs have partial ranges | revert |

"Forward only" means a fix PR at the top of the stack that keeps every `PASSOS` entry. If the app cannot build Tuesday's escala on Monday, the operator has the files exported on Saturday and Pedro fixes forward.

#### Names

| Name | What it is | Step |
|---|---|---|
| `js/redesenho.js` (`registrarDesenho`, `redesenhar`, `redesenharPorNome`); moments `dados`, `consulta`, `releitura`, `escala`, `perfil`, `pedidos`, `data-aberta`, `sessao` | the redraw registry; no other moment is accepted | F0b, F1a |
| `aoReverter(tipo, desfazer)`; the modules `painel-de-dados`, `linhas-filtradas`, `resultados`, `importacao`; `pesoDoTexto` | the revert registry; F0b's split | F0b |
| `TELAS` (`age`, `dem`, `esc`, `apr`, `alu`, `ins`, `rec`, `cur`, `rod`, `bi`, `manual`, `conta`); `ESTAGIOS`; `registrarTela`, `mostrarTela`; `#/<tela>[/<item>]` | the screens, the four stages (not "etapas", the course missions), the address | F1a |
| `nav#linha`, `li.estagio`, `aside#trilho`, `button#btn-data`, `div.casca`, `main#conteudo`; `acpm_linha`, `acpm_trilho` | the shell; its stored preferences | F1a, F1b |
| `js/linha-do-dia.js` (`linhaDoDia`, `avisosDaData`); states `feito`, `falhou`, `atencao`, `andamento`, `pendente`, `nenhum` | the adapter of the cards and the rail | F1a, H |
| `registrados`, `com-excecao`, `aguardando`, `aprovados`; `aprovados-fora`, `missao`, `preferencias`, `recursos`, `invas`, `nao-cabem`; `restricoes`, `montada`, `compactacao`, `conflitos`; `pendencias`, `aprovada`, `exportada` | the 17 rows ("com exceção", "aprovados fora da escala", "escala montada", "pendências"…) | F1a, D2, G2, H |
| `criarMestreDetalhe`, `item.rapida`, `item.acao`, `item.bloco`, `item.apagado`, `vazio`, `data-vendo`; `js/eventos/inativos.js`, `setInativo`; `podeEditarDadosPessoais` | the list–detail component | F2 |
| `inativo`, `exige`; `estadoParaEscalar`, `voosComInativos` (`js/inativos.js`) | format 26 and its rules | F3 |
| `nome_completo`, `desfazerColocacao`, `grava_dados_pessoais()`; `details#periodos`, `setExigencias`, `periodos-fechados` | Alunos and the Secretaria's write; closed periods | A, A2, B |
| `faixas`, `js/disponibilidade.js` (`disponivelPara`, `faixasDoInstrutor`), `setFaixas` | INVA ranges | C |
| `solicitacaoAprovada`, `js/solicitacoes-da-data.js`, `diaJaGravado`, `ApiClient.diaMudou`; `aprovar_solicitacoes`, `retirar_aprovacao_da_solicitacao`, `solicitacoes_por_dia`, `aprovar_solicitacoes_de_antes_da_aprovacao` | Pedidos in the app and on the server | D1, D2 |
| `conciliarPedidos`, `aplicarConciliacao`, `ficaNaEscala`, `missaoDaEntrada`, `religar`; `rejeicoesDosPedidos`; `etapaDoPrograma`, `exportacoes`, `reabertura` | the conciliation, the pairing, what 28 protects | E |
| `aside.gaveta#painel-restricoes`, `js/restricoes.js`, `js/eventos/restricoes-do-voo.js`, `data-act="restricoes"` | a flight's restrictions | G1 |
| `#s-proc`, `quadroDoProcessamento`, `cabeSozinho`, `atualizarAEscala`, `depoisDeMudarPedidos`, `recomecarPelosPedidos` | Processamento | G2 |
| `#entradas`, `#restricoes-da-data` (`restricoesDoOperador`), `section#s-apr`, `js/aprovacao.js`, `#exportacoes` | the Escala's inputs; Aprovar | H |
| `linha-<passo>-…`, `linha-fix-<assunto>`; the files of the migration table | branches; server changes | all |

#### What is deleted, and when

| What | Deleted in | Replaced by |
|---|---|---|
| `test/e2e/cadastros.spec.js`; the local `mudarData`, `alvosPequenos`, `semNome`; `percorrerVistasEFiltros`; four nine-tab lists; ten waits on `#wins` | F0a | four spec files; the drivers; `percorrerTelas`; `appPronto` |
| `js/views/cadastros.js`, `js/eventos/cadastros.js`; six redraw lists; the `if` chain of `js/eventos/historico.js:53-123`; the rules of `css/app.css`, four with no emitter | F0b, F0c | per-screen modules; `js/redesenho.js`; `aoReverter`; per-owner stylesheets |
| `GRUPOS_DE_HABILITACAO`, `gruposDosRecursos` in the views | F3 | `js/habilitacoes.js` |
| `js/views/tabs.js`; `nav#nav`, its buttons, separators, badges and CSS; `test/e2e/selos.spec.js` as it is | F1a | `js/views/telas.js`; `nav#linha`; rows and values |
| `.topo-data`; `js/eventos/topo.js:23-63`; the Agenda's calendar and own day (`calendarioHTML`, `gradeDoMes`, `mudarMes`, `escolherDia`, `carregarMes`, `diaEscolhido`, `#agenda-cal`, the `[data-cal]` listener); the pin `principalMax: '1280px'` | F1b | the rail; "Data do pedido"; the cap 1,612 px |
| `table.cadastro.alunos` and its phone cards; `linhaDoAluno`, `atualizarLinhaDoAluno`; the copy of `apertado` | F2 | the component; `ponteiroApertado` |
| "Abrir a Demanda"; the sentence that lets the Secretaria edit | A | nothing; "a secretaria consulta" |
| the 3-argument `salvar_dados_pessoais` | A2 | the guarded 5-argument function |
| `#wins`; the Recursos views and `#selo-rec-dia`; `rFrota`, `table.frota`; `js/views/filtros-dos-recursos.js`; `#manual-janelas`; the terms `janelas`, `horario-em-janela-fechada`, `filtro-das-categorias` | B | `details#periodos`; the list by category; `#manual-periodos`; `horario-em-periodo-fechado` |
| `cobre`; the grid (`table.disp`, `#inst-dia`, `.cel`, the legend); "Aplicar turno…", the term `turno`; both record drawers, their modules and Esc listeners; `table.cadastro.instrutores`; `css/cadastros.css`; `js/views/vistas.js`; `test/e2e/gavetas-de-cadastro.spec.js` | C | `disponivelPara`; the INVAs list and detail; chips and turnos; F2's editor |
| the 9-argument `registrar_solicitacao`, its path in the fake and `clienteFalso` | D1 | the 13-argument function, the 10-argument shim |
| `listaHTML`, `situacao`, `pendentesDaDataAberta`, `pedidosCarregados`; `lerPedidosDaData`, `pedidosDaData`, `pedidosPendentes`; F1's row "ainda não importados" | D2 | F2's list; `js/solicitacoes-da-data.js`; D's rows |
| `importarSolicitacoes`; D's `entrarNaDemanda` (its tests become the `religar` cases) | E | `conciliarPedidos`, `aplicarConciliacao` |
| the Demanda's columns Recurso, Instrutor, 1ª and 2ª preferência, Disponibilidade, Duração, Prioridade; "Usar", "Outra missão…" | G1 | the drawer (handlers moved) |
| `#s-dem`, `js/views/demanda.js`, `js/eventos/demanda.js`, `css/demanda.css`; `js/eventos/importacao.js`, both import buttons; the rest of `js/views/selos.js`; `js/views/linhas-filtradas.js`; "+ Pôr um aluno", "+ missão", the ✕ of an extra, "Voa"; D2's interim functions, tags and row; `test/e2e/demanda.spec.js`; `religar` | G2 | `#s-proc` and its writes; `processamento.spec.js`; the shared helpers re-homed |
| the second bar of `#s-esc`; `#aprovacao`, the exports and the link in the Escala; the button half of `rAprovacao`; F1's `apr` behaviour; the adapter's first bodies | H | `#entradas`; `#s-apr`; the final adapter |
| the 10-argument `registrar_solicitacao`; `aprovar_solicitacoes_de_antes_da_aprovacao(boolean)`; the "aba" identifiers, `.aba-selo`; `.so-dados` if unused | I | the 13-argument function; nothing; the new names |

#### Go-live checklists (described, not performed)
**Onda 0**
1. [ ] Pedro's read-only inventory of both projects: `supabase migration list`, `supabase functions list`, `supabase secrets list` (names only); read-only queries: stored days by `esquema` (the sweeps' size), the installed overloads, the Secretaria profiles (item 8), dates of the last 60 days with a closed period (B's default), INVA-dates with part of the day off (item 1); the Auth configuration against `config.toml`. The "Servers" table updated.
2. [ ] `npm run test:db` on the preview from unchanged upstream/main: 433 checks, 131 never recorded on real pgTAP; a red one is fixed first, in #0.
3. [ ] Gabriel merges plan, F0a, F0b, F0c; the app and `painel.html` opened.

**Onda 1**
4. [ ] #1 and #2 on the preview as soon as written, with `npm run test:db` (54, then 56 checks).
5. [ ] Pedro pushes #1 to production from `linha-a-alunos`; the live app saves personal data as before. Gabriel merges F3, F1a, F1b, F2, A.
6. [ ] Pedro pushes #2 from `linha-a2-secretaria-so-le`, with A live; a Secretaria login, if any, reads and cannot save, on screen or through the API.
7. [ ] Gabriel merges A2 and B; Pedro opens first (sweep to 26) and `painel.html`: dates open, the cadastro at 26, the aircraft marked "Habilitação própria" has `exige` and keeps the flag.

**Onda 2**
8. [ ] Gabriel merges C; Pedro opens (sweep to 27); one INVA's ranges compared with the cells he had; on Monday's build each INVA's ranges read once with the operator.

**Onda 3**
9. [ ] #3 on the preview during the parallel phase, from D1's branch, `npm run test:db` red then green; the old-client check: the commit production runs, served with `?supabase=previa`, registers and cancels a pedido.
10. [ ] The rehearsal: fictitious dates in 2098 seeded at 27 with nine origins of a record (imported, flying or off; cleared; typed by hand; booked; approved or waiting, not imported; imported by an old tab; cancelled), each date's CSV exported; #4 on the preview; G2's build opens it; "Atualizar a escala" on each date, compared with its CSV; `scripts/reiniciar-ensaio-previa.mjs` resets. Any difference: G2 does not merge.
11. [ ] Pedro pushes #3 to production, outside the operator's afternoon; the live app registers and cancels. Gabriel merges D1, D2, D3, E, G1.
12. [ ] The CSV of every date from today on with a stored day exported; the read-only count on production in three classes (ids in `importadas` with a record: approved; with no record: waiting, never entering; approved pedidos not in `importadas`: what "Atualizar a escala" will bring).
13. [ ] #4 to production with D2 live; Gabriel merges G2; Pedro opens (sweep to 28): Monday's date shows the flights of its CSV, opening a date writes nothing, and a count lists any flying record whose pedido waits with no withdrawal trace.

**Onda 4**
14. [ ] Gabriel merges H (no sweep); #5 pushed (preview, `npm run test:db`, production) with G2 live; Gabriel merges I.

**C2** (only with a yes)
15. [ ] The golden diff reported in the PR and read; merged alone when the date being built is approved, Pedro present; the operator told which INVAs have partial ranges.

#### Departures from the request

| The request says | The plan does | Why | Pedro can choose instead |
|---|---|---|---|
| Processamento has "no data of its own"; input: the approved pedidos | no input; the day keeps one record per pedido that entered, and `importadas`; bookings and records without a pedido also fly | pins, statuses, results and five revert kinds hang on the record; a booking creates no pedido | records rebuilt at every load |
| the stage "shows the enriched pedidos and why any of them cannot be scheduled" | also five writes, and it opens the Escala's drawer over itself | each acts on the line she reads | only "Atualizar a escala" there |
| "Demanda will consume approved pedidos" | at once only on a started date; otherwise one click | a save creates the day and freezes its hours and Rodízio | every approval at once; always one click |
| "one pure module"; E "no UI"; G "the engine reading its output" | three modules; E replaces the import behind today's button and carries 28 | the booking uses the pairing alone; the lint refuses exports only tests use | one module; E and G as one step |
| each column a pedido field, derived, or a restriction; "Voa" derived | as asked, plus six overrides, not the mission type; "Voa" off is "Tirar da escala" | no other source; one write, an undo that keeps the place | fewer overrides; "Tirar da escala" withdraws the approval |
| restrictions "in the Escala stage"; no modal for a record | a drawer of the Escala stage, also over Processamento | the same count as a block in Processamento, reachable from the red box | a block in Processamento; a flight pane |
| "why any of them cannot be scheduled" | two verdicts and one note before the engine | 11 of the 21 reasons exist only against other flights | one mixed list |
| "missão definida pelo programa" | bound at entry by the day's times; an overtaken one changes with the same click, never after the start | recomputed live it advances after the flight's own result | display only |
| (not in the request) | "+ Pôr um aluno" and "+ missão" end; her additions are pedidos or bookings | one way in for a pedido's flight | a booking option "o app escolhe o horário" |
| "Decisions this reverses" lists three | five more restated; two decisions of 2026-11-17 left unbuilt | they lived in the Demanda and the tabs; the request keeps "the local-flight limit" | keep "Limpar demanda" as a pure clearing; items 5, 6 |
| restrictions "override any rule" | they override the app's choice; a broken rule is a conflict; a conflicting booking is refused | two flights could share an aircraft with one click | item 10 |
| three panes on every screen, about 30/48/22; the 1,280 px cap | the Escala, Cursos, BI, Rodízio, Manual and Minha conta are one block beside the rail; the cap is 1,612 px | 760, 720 and 860 px minimums against a 599 px pane; the content keeps 1,248 px | sideways scrolling; keep 1,280 |
| the rail "fixed"; cards with their rows | docked from 1,280 px; the rows fold unless the linha fits in one row and the window is 760 px tall | the screens' widths; open, the linha costs 82 px | docked from 1,600 px (item 16); always open |
| the four stage names | "Agenda" and "Demanda" until D2 and G2, "Instrutores" until C | one vocabulary per screen at every merge | final names from F1 |
| the calendar "is the app's only date control"; the Agenda's calendar goes with D | the BI keeps "Data base", the form "Data do pedido"; the Agenda's calendar goes in F1 | the BI does not change; one click after 13:00 instead of three | one date strictly |
| notifications with "a time at the left" | by severity, items without a time first, with "—" | rejections, limits and unread data have no time | by time only |
| no modal or pop-up for a record | the record drawers go; the Histórico, Sugestões, G1's drawer, four dialogs and the map pop-up stay; Cadastros, Rodízio and BI are links | a log, actions, a setting; one click in every state | bring them into the page; a Cadastros card |
| (not in the request) | no Sunday opens; the local Gestor changes the date; the Secretaria opens on the first open date; screens in the address | one date control for all; a reload keeps the screen | the shell's smaller defaults |
| F2 "the master–detail list component"; the foundation F1, F2, F3 | F2 converts Alunos with the switch; F3 first | the lint refuses a module only tests import; the switch must work when it appears | F2 and A as one step; the request's order |
| "edited in place"; "icon actions"; inactive rows "dimmed"; reuse `mostrarVista` | fields save on leaving them, personal data by "Salvar" with "Desfazer"; icons "Anterior", "Próximo", "Agendar voo"; delete at the foot; a muted title and "inativo"; `mostrarVista` deleted | no undo of personal data; delete destroys; contrast 4.5:1; its switches go | per field (item 17); opacity |
| INVA ranges of "earliest and latest mission start time"; commit 2 "if the meaning changes" | `[de, ate)` with today's presence meaning; the start rule is C2, with a yes; the reader falls back to `aw` | 110 of 735 rows would run past their range (median 70 min); the golden hashes cover the input | item 1 |
| `aw` "no longer fits" | ranges stored; the nine periods as one-click chips and a strip; "Salvar faixas"; "Vem" stays; History reverts | the daily pass; a time field fires `change` per key | typed ranges only |
| remove Janelas de operação; take-off times "overlap" | the section leaves Recursos for the Escala; `win` and its readers stay, not copied to new dates; the overlap is partial | 18 golden files depend on `win`; Ground, the Noturno and the Voo Solo have no take-off list | drop the control, or the rule |
| deactivating "applies to all dates" | from today on; an inactive student's flights keep flying; the rows also carry "Vem" and "Disponível" | flown and approved history must not move; the daily pass stays one click | every date; from a typed date |
| Alunos' nome completo, missão anterior and atual; the Secretaria "must not edit"; INVAs' "preferences"; the filter on Recursos | a new personal-data column; the latest result and the first released mission, plus "Colocar no curso até…"; she stops editing INVAs' data too; read-only INVA preferences; groups replace "Categoria" | none exists; 13 to 43 records for a student arriving mid-course; one function serves both | today's "Nome"; no bulk placement; she stops reading |
| Pedidos keep the deadline, the exception, no Sundays; an approval state; items "editable" | the exception refuses Sundays and past dates; nothing changes a past date; an Operador's pedido can be born approved; a read-only detail; the row "com exceção" | a past schedule must not change through a pedido; no Secretaria account is recorded; an edit needs new rules | keep past dates; every pedido waits; editable pedidos |
| other screens' "behaviour does not change" | Pedidos reads every 60 s with the day's version | news from another computer without a touch | events only |
| the Escala's and Aprovar's rows; criteria labelled "Recurso" and "Não considerar"; Aprovar's order | 17 rows the code can back, a sixth state "nenhum"; "Avião" and "Não mudar" kept; pending items as links, nothing blocks, approval pins, "Soltar"; one view on phones | motor and compactação have no running state; the labels would misdescribe the code; the day goes on after approval | the request's names and labels; block on conflicts |
| `npm test` green; A to E in parallel, as the `abas-*` branches; "I. Removal…" | the lint inside `npm test`; F0 in three PRs; four lines in a fixed order; A2, D in three, G in two; each step deletes what it replaces; five sittings | no lint in `npm test` today; collisions, migrations before the merge; one person, four changes | fewer branches; merge when green |

Left for Pedro (each with the default the plan implements):
1. **The INVA ranges: presence or start?** Your request defines the new model as "one or more ranges of earliest and latest mission start time, with gaps allowed", and its step 2 reads "If the meaning changes (a range limits when a mission may start, where today `cobre` requires the whole flight inside the windows), make that its own commit, re-record the goldens and review the diff". The plan builds your step 1 as written (C) and has your step 2 ready as C2; by default it stops after step 1. Ranges converted from today's windows would let missions run past the end the INVA set (110 of 735 generated rows, by a median of 70 minutes); a range could no longer keep an INVA free after a time, so a lunch break stops being one; and every unapproved stored date would change at its next edit. With a yes, C2 is one more PR in its own sitting, revertible, and the editor's labels follow the rule (the end of a range excluded). Onda 0's count of INVA-dates with part of the day off weighs this. *Default: presence; C2 not made.*
2. **May the day keep one record per pedido that entered** (key, course mission, your restrictions), Processamento having no input? *Default: yes.*
3. **Do pedidos enter a date by one click ("Atualizar a escala") the first time and by themselves afterwards on a started date?** Do other Operador accounts register pedidos while she builds that date? *Default: yes; one person does both (if not, only the click writes the day).*
4. **Where are a flight's restrictions edited:** a drawer opened from the Escala and from Processamento (2 actions per edit), a block in Processamento's detail, or always the Escala? A detail pane for the flight? *Default: the drawer, from both; no flight pane.*
5. **"2ª preferência" and "Disponibilidade" on the pedido** (your 2026-11-17 ask); resource type, INVA and priority too? *Default: yes to the two ("Só na 1ª preferência" by default); no to the three (operator restrictions).*
6. **The 6 local flights in Pedidos:** refuse the 7th, or your 2026-11-17 rule (warn, confirm, record who)? *Default: refuse, as today; "+ Agendar voo" with "Agendar mesmo assim" is the way around.*
7. **The Secretaria cancels an approved pedido:** allowed, the flight leaving at the operator's "Atualizar a escala" (the notice within 60 s; on the flight's day, the status Cancelado), or refused with a reason? *Default: allowed; no reason stored.*
8. **Is there a Secretaria account in production? Does she keep reading all personal data?** *Default: assume there may be (A and A2 as two files and PRs); she reads every field, students and INVAs, and edits none.* Onda 0's count of Secretaria profiles settles the first: with none, A and A2 can be one file applied before A's merge.
9. **Deactivating:** from today on (past dates untouched), one click on the row, reverted from the History; an inactive student's flights keep flying; a pinned flight with an inactive INVA or aircraft stays in conflict; a request whose chosen INVA is inactive is rejected? *Default: as described.*
10. **"Override any rule":** should "+ Agendar voo" accept a conflicting flight after "Agendar mesmo assim"? *Default: no.*
11. **The text-only golden commit "texto" in C:** may the alert "(marque em Instrutores › Cadastro)" (`js/engine.js:961`, 7 lines of `cenario-06.json`) be reworded, and "habilitação própria" with it? Without it the text names a view C removes. *Default: not made without your explicit yes.*
12. **A pedido's exact minute when its resource type's take-off list lacks it:** keep the minute and say so ("o pedido pediu 08:20; o PA-34 decola às 08:30"), refuse a type change, leave pedido flights out of the take-off editor's adjustment? *Default: keep the minute.*
13. **"Limpar demanda" becomes "Recomeçar pelos pedidos"** (each pedido's flight back to the pedido, in place; hand-made flights leave; flown, cancelled, taken-off and dismissed ones stay)? *Default: yes.*
14. **A student with no pedido, or a second flight:** a pedido ("Registrar e aprovar"; after 13:00 through the exception; a 7th local refused) or a booking, "+ Pôr um aluno" and "+ missão" ending? *Default: yes.*
15. **Releases:** five Saturday sittings, Gabriel merging, Pedro pushing and opening first; forward only after a sweep (Onda 1 revertible down to F3; in Onda 3, G1 and G2 revertible)? *Default: as described.*
16. **From which window width is the rail docked? What is the operator's screen?** *Default: 1,280 px (the next date one click; on a 1,280 px laptop the Escala is 954 px wide).*
17. **Personal data:** one "Salvar" per section with "Desfazer", saved when she leaves the section, or field by field? *Default: one "Salvar" with "Desfazer".*

**Smaller defaults**, by step (each states the plan's default):
- **Shell (F1a, F1b):** "Agenda" and "Demanda" until D2 and G2, the Aprovar card on the Escala's approval bar until H; Cadastros, Rodízio and BI as links; the linha open by default only when it fits in one row and the window is at least 760 px tall; screens and the selected record in the address, Back never changing the date; avatars in five hues by id; avisos without a time first, with "—"; the local-mode Gestor may change the date; the BI keeps "Data base"; a Sunday muted; the browser's clock for "hoje"; the Secretaria sees Pedidos, Escala and Aprovar read-only with the downloads, Alunos, INVAs, Cursos and the Manual; "Compartilhar" in Aprovar from H; the Painel may end below the fold at 1,920 px; the rail on every screen; F1 as two PRs.
- **Cadastros (F3, F2, A, B, C):** F3 before F1 and F2, F2 with Alunos; the date's overview of INVAs and resources is the list with the per-date switch on the row, not a board (a typical day 8 → 9 interactions; Onda 0's count of partial INVA days weighs it); a cadastro conflict re-reads the date and lists what was not saved, no lock (today's lock stays for a day or format conflict), and a cadastro edit keeps rewriting the open day; arrows select; one "Mostrar inativos" toggle; the cadastro's order; no History revert for name, weight, course and preferences; "Nome completo" a new field, INVAs too; "Colocar no curso até…" offered; a result without a flight dated the open date when not after today, else today; inactive people's personal data kept until an Operador clears them; deleting as today; a resource may require any habilitação; the Gestor and the Secretaria see an INVA's habilitações and hours; who comes back goes to the end of the Rodízio queue and the back of the hangar; an inactive aircraft's Excel column released; "INVAs" on screen, "instrutor" in texts; a closed period is not copied to a new date unless Onda 0's count shows the same period closed on runs of dates; "Vem" its own switch; range changes in the History; free minutes with periods and turnos as shortcuts; today's defaults for a new or missing INVA; no usual week per INVA.
- **Pedidos (D1, D2, D3):** a pedido is not editable (cancel and "Registrar de novo…"; the flight's time on the day's record); "Registrar e aprovar" the main button, "Registrar sem aprovar" beside it, a pedido past the deadline always approved; "Data do pedido" from F1; the exception refused on Sundays and past dates, its name kept, the mark "Fora do prazo"; reads every 60 s while visible, on return and on "Atualizar"; the History only for what changes the day; no server refusal for an unknown or inactive student; no availability "só na 1ª ou na 2ª"; your words "Aprovar pedido", "Aprovado", "Aguardando aprovação"; a rail day counts every pedido not cancelled; module and table names kept.
- **Processamento (E, G1, G2):** the course mission by the day's times, a closed course's pedido entering without one, with a notice; overridable: instrutor, prioridade, tipo de recurso, duração, disponibilidade and both preferences, missão do curso (the mission type only through another course mission), a type or duration change keeping the course mission; "Atualizar a escala" also changes overtaken course missions (same type, never on past dates or after the start; its own commit); "Tirar da escala" a restriction of the date, the pedido staying approved; a cancelled pedido's flight leaves, but stays when Em Voo, Pousou, Cancelado, with a result or on a past date, and asks for the status when Atrasado or past its pinned time; a withdrawn approval takes the flight off keeping its place asleep, and approving again brings back exactly that; an old tab's import never removed without a choice; pedidos cleared before the cut-over and approved later are "dispensados"; the cut-over approves what was imported and the operators' own future pedidos; a pedido that cannot fit even alone still goes to the engine; the pedido taking a hand-made flight's place keeps its priority; from G2 the form's Duração and 1st preference come from the programme; a second flight of a booked mission gets a warning; the Gestor reads Processamento, the Secretaria does not; `escolhido-saiu` stops naming the Demanda; rejections gain no `stuId` or `fKey` (174 golden alerts would change).
- **Escala and Aprovar (H):** approving pins the flights it lets in, "Fixar os N voos novos" for later ones; "exportada" when a recorded export is not stale (stale: who flies what, when, where or with whom changed, a cancellation, delay, conflict or stopped aircraft); only an Operador's or Administrador's download recorded; export before approval allowed with a note; reopening recorded; "Soltar" for a booked flight not in conflict, also on an approved date; "Avião" and "Não mudar" kept, the request's group names, the second group shown with "Sem efeito nesta data"; "Restrições do operador" counts what she placed by hand; the amber box no longer shrinks at approval; one "less fuel" item per date; pedido rows for the four profiles; the inspection stop and the delay stay amber; past dates without states.
- **Delivery:** the lint inside `npm test`; preview checks on the integration worktree, two sessions with the operator; CI by a local CI-mode run plus the PR's run; `main` taking fixes only; `importar_cursos` outside the redesign; the 131 never-recorded database checks first; the Auth `config push` compared in Onda 0.
<!-- fim -->
