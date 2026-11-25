# Mapa: INVAs: the Instrutores tab, availability (aw), habilitações, legal limits and the rodízio

Read on the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to the worktree root. "(inferred)" marks a statement read from the code without a test or a line that proves it alone. Profiles: **O** Operador, **A** Administrador, **G** Gestor, **S** Secretaria; "local" is the no-login mode, where `#role-sel` switches Operador/Gestor.

## 1. What exists

- **Tab "Instrutores"** (`#s-ins`, index.html:214-245; nav button `data-t="ins"`, index.html:97) with two views on a `.seg` switch (`data-vista-ins="dia"` | `"cadastro"`, index.html:218-219): **"Disponibilidade do dia"** (a grid, one row per instructor: "Vem", the 9 windows, "Voos", "Mês", "Turno", "Habilitações") and **"Cadastro"** (a table: "Nome", "CANAC", "Peso (kg)", "Habilitações", actions; under it the panel "Limites da Lei do Aeronauta"). Rendering: js/views/cadastros.js; events: js/eventos/cadastros.js.
- **Drawer "Habilitações <nome>"** (`aside.gaveta#painel-instrutor`, index.html:678; js/views/cadastros.js:182-197): the 21 habilitações in 6 groups, one extra group for the resources with "Habilitação própria", and the instructor's flight hours with the two "Fora do app" fields.
- **Drawer "Dados pessoais <nome>"** (`aside.gaveta#painel-dados`, index.html:680; js/views/dados-pessoais.js): CPF, CANAC, Nascimento, Celular, E-mail, shared with Alunos.
- **Tab "Rodízio"** (`#s-rod`, index.html:378-382; nav `data-t="rod"`, index.html:100): four queues per date, with up / down / to-the-front buttons (js/views/rodizio.js, js/eventos/rodizio.js).
- **Pure modules**: js/habilitacoes.js (the 21 ids, what each mission requires, `podeFazer`), js/viabilidade.js (`cobre`, `problemasDoInstrutor`: the single instructor-eligibility check), js/candidatos.js (candidates for one flight, used by Sugestões and the booking dialog), js/limites.js (legal limits), js/rodizio.js (queues), js/instrutor-escolhido.js (the operator's chosen instructor), js/dados-pessoais.js (validation of personal data), js/noturno.js (the rest after yesterday's Noturno).
- **Server**: RPC `horas_dos_instrutores(p_data date)` (supabase/migrations/20261113180000, redefined in 20261115151734); table `dados_pessoais` and RPC `salvar_dados_pessoais` (20261113150000, 20261114151953); `salvar_documento` deletes the personal data of whoever left the roster (20261114151953:164-170). The server never reads `aw`, `on`, `hab`, `filas` or `limites` (grep of supabase/: only `ins[].id`, `ins[].nm`, and `resultado.out[].insId/h/eqType/a/b/ins`).
- **Instructors elsewhere in the app** (other maps own these): Demanda column "Instrutor" (`select[data-f="insId"]`, js/views/demanda.js:76); Escala "trocar instrutor", the "Por instrutor" map (rows are `S.ins.filter(x => x.on)`, js/views/escala.js:582); Sugestões; the booking dialog (`#agd-instrutor`, `#agd-kg-instrutor`); Alunos' "Priorizar com" and "Não escalar com" selects; BI ("N/M instrutores", js/views/bi.js:127).

Who sees what today:

| Profile | Instrutores tab | Can change | Rodízio tab |
|---|---|---|---|
| O | both views, opens on "Disponibilidade do dia" (js/views/vistas.js:11) | everything except the legal limits in shared mode | sees and reorders |
| A | same | everything, legal limits included (js/views/cadastros.js:75) | sees and reorders |
| G | both views, read-only: `.edit-only` hidden (css/app.css:235), inputs disabled (js/somente-leitura.js:5-9); no CANAC column, no "Dados pessoais" (`.so-dados`, css/app.css:237) | nothing | sees, no buttons |
| S | both views, opens on "Cadastro" (js/views/vistas.js:11); read-only except "Dados pessoais" | only the personal data | tab hidden (css/app.css:184) |
| local Operador | as O, and edits the limits (`!isGestor()`, js/views/cadastros.js:75) | everything | sees and reorders |

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

Storage: the **cadastro** is ONE document (`documentos` row `cadastro` / local `acpm4_cadastro`), version-checked as a whole by `salvar_documento`; each **day** is one document (`dias` row / local `acpm4_dia_<data>`). `separar`/`juntar` (js/dias.js:36-112) split and join them. Every change saves the day always and the cadastro only when its JSON changed (js/storage.js:229-242; test/unit/storage-dias.test.js:100).

| Field | Stored in | Scope | Writers (file:line) | Notes |
|---|---|---|---|---|
| `ins[].id` | cadastro (js/dias.js:41) | all dates | js/eventos/cadastros.js:75 (`S.nid++`) | Counter `nid` is shared with students, starts at 1000 (js/storage.js:51, 86), never reused. Legacy and seeded instructors have small ids. |
| `ins[].nm` | cadastro | all dates | js/eventos/cadastros.js:150; js/storage.js:145 (default `Instrutor <id>`) | Up to 80 chars (`LIMITE_DO_NOME`, js/format.js:54). |
| `ins[].lv` | cadastro, only when present (js/dias.js:40-42) | all dates | none (legacy A01–A09) | "fica só como cópia"; used only when `hab` is not an array (js/storage.js:159; js/migracoes.js:57-60). |
| `ins[].kg` | cadastro | all dates | js/eventos/cadastros.js:155; js/agendamento.js:926-933 (weight typed in the booking dialog); js/storage.js:145 | 0 = "sem peso"; 1 to 300, one decimal (js/rules.js:130-140). Goes to the History ("Peso <nm>: 80 kg") and to the schedule rows (`insKg`, `kg`). |
| `ins[].hab` | cadastro | all dates | js/eventos/cadastros.js:75 (new: `habilitacoesDoNivel(1)`), :159 (toggle); js/storage.js:159; js/migracoes.js steps 6, 19, 20 | Ids of `HABILITACOES` (21) plus `aviao:<MATRÍCULA>`; normalised and sorted (js/habilitacoes.js:43-45). |
| `ins[].horasExternas` | cadastro, only when non-empty (js/dias.js:43-44) | all dates | js/eventos/cadastros.js:161-168; js/storage.js:106-111 | `{ 'AAAA-MM': h, 'AAAA-00': h }`; `AAAA-00` is "no ano, antes deste mês". |
| `limites` | cadastro (js/dias.js:50) | all dates, all instructors | js/eventos/cadastros.js:239, 246; js/storage.js:62, 95; js/migracoes.js step 15 | 8 keys (js/limites.js:9-18); only 6 have an input. |
| `frota[].habilitacaoPropria` | cadastro | all dates | js/eventos/recursos.js:75-88 | Creates the habilitação id `aviao:<reg>` (js/frota.js:50-52). |
| `stu[].bl`, `stu[].voaCom` | cadastro (js/dias.js:47) | all dates | js/eventos/cadastros.js:95, 104-105, 118-119, 202-205, 209 | Lists of instructor ids ("Não escalar com", "Priorizar com"). |
| `dia.ins[<id>].on` | day (js/dias.js:58) | per date | js/eventos/cadastros.js:144, :75; js/agendamento.js:937; js/eventos/historico.js:77; js/reversoes.js:188; js/storage.js:122, 145; js/dias.js:94 | "Vem". Missing entry means `true`. |
| `dia.ins[<id>].aw` | day (js/dias.js:58) | per date | see §5.3 (ten writers) | Nine booleans, one per `WIN` (js/config.js:4). Missing entry means all nine `true`. |
| `dia.filas` | day (js/dias.js:66) | per date ("no início do dia") | js/eventos/rodizio.js:11, 16; js/storage.js:162; js/dias.js:122 | `{ cheque, mlte, noturno, c172 }`, each a list of instructor ids. |
| `dia.pedidos[..].insId` (and `extra[].insId`) | day (js/dias.js:22, 59-62) | per date | js/instrutor-escolhido.js:107-108, 143-144, 169-170; js/agendamento.js:910; js/eventos/cadastros.js:123 | The operator's chosen instructor for a request. |
| `dia.fixos[fKey].insId`, `.escolhido`, `.agendado` | day (js/dias.js:68) | per date | js/instrutor-escolhido.js:111-122; js/agendamento.js:921-924; js/eventos/cadastros.js:124 | Pins. |
| `dia.resultado.out[].insId`, `.ins` (name), `.insKg`, `.insEscolhido`, `.insPar` | day (js/storage.js:241) | per date | the engine | The saved schedule keeps the instructor's NAME. |
| personal data (`cpf`, `canac`, `nascimento`, `celular`, `email`, `atualizado_em`, `atualizado_por`) | table `public.dados_pessoais`, key (`tipo` = 'instrutor', `id_cadastro`) (20261113150000:34-45); local `acpm4_dados_pessoais` (js/backends/local.js:18) | all dates | `salvar_dados_pessoais` only (js/backends/supabase.js:257-263) | Outside the state. In memory: `DADOS.instrutor` (js/views/dados-pessoais.js:11), loaded once at opening (js/main.js:129). |
| `S.horasBase`, `S.horasDosInstrutores` | NOT stored (js/actions.js:305; test/unit/dias.test.js:57) | recomputed per open date | js/storage.js:197-202; js/actions.js:94-96; js/eventos/cadastros.js:169 | `{ <id>: { mes, semestre, ano, fimAnterior, fimDoNoturno? } }`. Part of the engine's input `state`. |
| `S.noturnosDaVespera` | NOT stored | per open date | js/storage.js:200-201 | Yesterday's Noturno flights; part of the engine's input. |

No other field exists on an instructor: no active/inactive flag, no preference, no contact data in the roster.

History entries written by this area (all on the OPEN date, also for all-dates data): "Instrutor adicionado: Novo instrutor" (inc); "Instrutor excluído: <nm>" (exc, no revert); "<nm>: Disponível" / "<nm>: Indisponível" (inc/exc, revert `setInsOn`, label "↶ Reverter"); "Instrutor: <antes> → <depois>"; "Peso <nm>: N kg"; "Habilitação incluída: <nm> · <nome>" / "Habilitação retirada: …"; "Horas de voo fora do app de <nm> (neste mês): N h" / "(no ano, antes deste mês)"; "Limites da lei: <rótulo> X h → Y h"; "Limites da lei: de volta aos valores da lei"; "Rodízio · <categoria>: <nm> passou para Nº"; from the server, "Dados pessoais de <nome> atualizados: CPF, CANAC" (field names only). Window (`aw`) and "Aplicar turno" changes write NO History entry (js/eventos/cadastros.js:179-181; js/actions.js:186).

## 3. Controls inventory

| Label | Element (id, data-act, data-f, class) | Handler (function, file:line) | State read and written | Profiles |
|---|---|---|---|---|
| "Instrutores" (tab) | `#nav button[data-t="ins"]` (index.html:97) | `show('ins')` (js/eventos/navegacao.js:19-32; js/views/tabs.js:17) | shows `#s-ins` | O A G S |
| "Disponibilidade do dia" / "Cadastro" | `.seg button[data-vista-ins="dia"]`, `[data-vista-ins="cadastro"]` (index.html:218-219), no `data-act` | `vistaDoBotao` then `mostrarVista('ins', vista)` (js/eventos/navegacao.js:52-53; js/views/vistas.js:19-30) | in-memory `escolhidas.ins` (lost on reload); sets `#s-ins[data-vista]`; CSS hides the other part (css/app.css:847) | O A G S |
| "Buscar instrutor…" | `input[type=search].flt-ctrl[data-flt="inst"]` (index.html:222) | `input` listener then `filtrar('ins', { nome })` (js/eventos/cadastros.js:59-63; js/views/cadastros.js:367-371) | `filtros.ins.nome` (memory); hides rows in `#inst-dia` and `#inst` by `data-nm` (`chaveDeBusca`) | O A G S |
| "Todas as habilitações" / "Habilitações: Noturno + C172" | `button#flt-ins-hab.filtro-botao.flt-ctrl[aria-controls="flt-ins-hab-painel"]` (index.html:224); panel `#flt-ins-hab-painel` (index.html:225) with `input.flt-ctrl[data-filtro="flt-ins-hab"][data-valor="<id>"]`, sentence "Mostra quem tem todas as marcadas." with "?" `filtro-das-habilitacoes`, and "Limpar" `#flt-ins-hab-limpar[data-limpar-filtro]` | `criarFiltroMultiplo` (js/views/filtro-multiplo.js:30-116), created in `prepararFiltros` (js/views/cadastros.js:354-358), `aoMudar: () => filtrar('ins')` | ticks kept in the component (memory); rule `todas` (AND) over `tr[data-hab]` (js/views/cadastros.js:392-397) | O A G S |
| "12 de 40 instrutores" | `span#ins-contagem.contagem[role=status]` (index.html:226) | `contar` (js/views/cadastros.js:440-451) | display only | O A G S |
| "+ Novo instrutor" | `button.btn.edit-only[data-act="addi"]` (index.html:227) | `aoAcionar('addi')` (js/eventos/cadastros.js:74-81) | pushes `{ id: S.nid++, nm: 'Novo instrutor', on: true, hab: habilitacoesDoNivel(1), kg: 0, aw: WIN.map((_, i) => i < 8) }` to `S.ins`; switches to Cadastro; `gravarAlteracao('inc', …)`; focus on the new name | O A |
| "Limpar filtros" (in the row "Nenhum instrutor com esses filtros.") | `button#limpar-filtros-inst-dia` / `#limpar-filtros-inst` `[data-limpar-filtros="ins"]` (js/views/cadastros.js:428-435) | `limparFiltros('ins')` (js/eventos/cadastros.js:65-68; js/views/cadastros.js:379-386) | clears the search and the ticks, focus to the search | O A G S |
| **Disponibilidade do dia** (`table.disp`, head `#inst-dia-cab`, body `#inst-dia`; row `tr[data-k="i"][data-id][data-hab][data-nm]`, class `off` when not `on`) | | `rInsDia` (js/views/cadastros.js:121-135), redrawn on every recalculation (js/actions.js:375) | | |
| "Instrutor" | `td.nome > b` (sticky) | none | reads `x.nm` | O A G S |
| "Vem" with "?" `vem-nesta-data` | `input[type=checkbox].sw[data-f="on"]`, aria-label "<nome> vem no dia" (js/views/cadastros.js:86) | `aoMudarCampo('i')`, branch `on` (js/eventos/cadastros.js:143-147) | writes `x.on` (day); History with revert `{ kind: 'setInsOn', insId, val }`; redraws the Demanda | O A (disabled for G S) |
| "06:30" … "17:30" (9 columns) | `td.jan > label.cel[.on][.voo][title] > input[type=checkbox][data-f="aw"][data-w="0..8"]`, aria-label "<nome> às <janela>" (js/views/cadastros.js:80-83) | branch `aw` (js/eventos/cadastros.js:173-174) | writes `x.aw[w]` (day), saved without a History entry | O A |
| "Voos" with "?" `voos-do-instrutor` | `td.voos` | none (`ocupacaoDosInstrutores`, js/views/cadastros.js:46-58) | reads the schedule: units of the instructor, cancelled ones left out | O A G S |
| "Mês" with "?" `horas-do-mes` | `td.mes[.perto][title]` | none (`colunaDoMes`, js/views/cadastros.js:95-103) | reads `S.horasDosInstrutores`, the schedule, `S.limites`; `.perto` from 90% of the month, semester or year limit | O A G S |
| "Turno" with "?" `turno`: "Aplicar turno…" | `select.edit-only[data-f="pre"]`, options "Dia inteiro", "Manhã", "Tarde", "Noturno", "Dia + noturno" (js/views/cadastros.js:90; js/config.js:118-124) | branch `pre` (js/eventos/cadastros.js:175-177) | overwrites `x.aw` (day), no History entry | O A (hidden for G S) |
| "Habilitações" | `td.habs-resumo[title]` | none (`resumoNaGrade`, js/views/cadastros.js:30-34): "Checador" once, then up to 3 short labels and "+N" | reads `x.hab` | O A G S |
| legend "disponível", "com voo ou aula na escala", "não vem", "Clique numa janela para mudar a disponibilidade desta data." | `p.legenda-disp` (index.html:230-235) | none | none | O A G S |
| **Cadastro** (`table.cadastro.instrutores`, body `#inst`; row `tr.cd[data-k="i"][data-id][data-hab][data-nm]`) | | `rIns` (js/views/cadastros.js:165-173); `atualizarLinhaDoCadastro` updates the row in place (146-163) | | |
| "Nome" | `td.c-nome > input.nm[data-f="nm"][maxlength=80]`, aria-label "Nome do instrutor" | branch `nm` (js/eventos/cadastros.js:148-151) | `x.nm` (cadastro); redraws Alunos and Demanda | O A |
| "CANAC" | `td.c-canac.so-dados[data-rotulo="CANAC"]` | none (`canacDe`, js/views/dados-pessoais.js:16) | reads `DADOS.instrutor` | O A S |
| "Peso (kg)" | `td.c-peso > input[type=number][min=1][max=300][data-f="kg"][placeholder="sem peso"]`, class `falta` when 0 | branch `kg` (js/eventos/cadastros.js:152-156) | `x.kg` (cadastro); invalid value: toast "O peso vai de 1 a 300 kg." | O A |
| "Habilitações" | `td.c-habs > span.habs-resumo` ("Nenhuma" when empty) | none | reads `x.hab` | O A G S |
| "Editar habilitações" | `button.btn.quiet.edit-only[data-act="editar-habs"][data-id]` | `abrirPainelDoInstrutor(id)` (js/eventos/cadastros.js:70; js/views/cadastros.js:234-240) | opens `#painel-instrutor` | O A |
| "Dados pessoais" | `button.btn.quiet.so-dados[data-dados="instrutor:<id>"]`, aria-label "Dados pessoais de <nome>" | `abrirPainelDeDados` (js/eventos/cadastros.js:24-30; js/views/dados-pessoais.js:54-79) | reads and writes `dados_pessoais` | O A S |
| "✕" | `button.x.edit-only[data-act="deli"]`, aria-label "Excluir <nome>" | `aoAcionar(['deli','dels'])`, two clicks (`confirmado(b, 'Confirmar')`) (js/eventos/cadastros.js:111-132) | see §5.6; History "Instrutor excluído: <nm>" with NO revert | O A |
| **Drawer "Habilitações <nome>"** (`#painel-instrutor`, container `.habs-painel[data-k="i"][data-id]`) | | `rPainelDoInstrutor` (js/views/cadastros.js:182-197) | stays open across tabs; closes when its instructor is removed | O A only (the opener is `.edit-only`) |
| "✕" | `button.x#btn-fechar-painel-instrutor`, aria-label "Fechar o painel" | click or Esc then `fecharPainelDoInstrutor(true)` (js/eventos/cadastros.js:49-54) | hides, focus back to "Editar habilitações" | O A |
| one switch per habilitação | `label.hab > input[type=checkbox].sw[data-f="hab"][data-h="<id>"]` | branch `hab` (js/eventos/cadastros.js:157-160) | `x.hab` (cadastro), normalised; redraws the Demanda | O A |
| "Horas de voo (limites da lei)": "No mês: X h de 100 h · No semestre: … · No ano: … (com a escala desta data)" | `fieldset.horas-ins p` | none (`horasDoInstrutor`, js/views/cadastros.js:201-213) | reads hours and limits | O A |
| "Fora do app, neste mês (<mês>)" | `input[type=number][min=0][max=999][step=0.1][data-f="ext-mes"]` | branch `ext-mes` (js/eventos/cadastros.js:161-172) | `x.horasExternas['AAAA-MM']` (cadastro); recomputes `S.horasDosInstrutores` | O A |
| "Fora do app, neste ano, antes de <mês>" | `input[…][max=2000][data-f="ext-ano"]` | same branch, key `AAAA-00` | same | O A |
| **Panel "Limites da Lei do Aeronauta"** (`#limites-lei`, index.html:243) | | `rLimites` (js/views/cadastros.js:220-231) | | |
| "Voo por jornada (h)", "Jornada (h)", "Voo no mês (h)", "Voo no semestre (h)", "Voo no ano (h)", "Repouso entre jornadas (h)" | `input[type=number][min=0.5][step=0.5][data-limite="<chave>"][data-divisor="60 or 1"]` | document `change` listener (js/eventos/cadastros.js:229-242) | `S.limites[chave]` (cadastro); empty = no limit; zero refused with a toast | A in shared mode; Operador role in local mode (`podeEditarLimites`, js/views/cadastros.js:75); disabled for the others |
| "Voltar aos valores da lei" | `button.btn.quiet[data-limites-padrao]` | click listener, two clicks ("Confirmar valores da lei") (js/eventos/cadastros.js:243-249) | `S.limites = { ...LIMITES_DA_LEI }` | same |
| **Rodízio** (`#rodizio`, one `div.pn[data-cat]` per category, `ol.fila > li[data-id]`) | | `rRodizio` (js/views/rodizio.js:8-30), drawn when the tab opens, on a date change and after a move | | |
| "Rodízio" (tab) | `#nav button[data-t="rod"]` (index.html:100) | `show('rod')` (js/views/tabs.js:28) | reads `S.filas`, `S.ins`, the schedule | O A G |
| position, name, "N voos nesta data", "indisponível" | `span.pos`, `b`, `span.tag.grp`, `span.tag.fb` | none | reads | O A G |
| "Subir" | `button.x[data-act="fila-subir"][data-cat][data-id]`, aria-label "Subir <nome>" | `aoAcionar(['fila-subir','fila-descer','fila-inicio'])` (js/eventos/rodizio.js:8-20) | `S.filas[cat]` (day) | O A |
| "Descer" | `[data-act="fila-descer"]` | same | same | O A |
| "Pôr no início da fila" | `[data-act="fila-inicio"]`, aria-label "Pôr <nome> no início da fila" | same | same | O A |
| "Como funciona o rodízio" | `a[data-manual="manual-aba-rodizio"]` (index.html:380) | js/eventos/navegacao.js:57-63 | opens the Manual | O A G |
| **Elsewhere, writing instructor data** | | | | |
| History "↶ Reverter" of "<nm>: Indisponível" | `[data-act="rev-log"]` | js/eventos/historico.js:74-80 | `ins.on` | O A |
| Booking: "Marcar <nome> disponível às HH:MM" | option `disponibilizar` in `#agd-conferencia` | js/views/agendamento.js:241-248; js/agendamento.js:934-939 | `x.on = true` and every window the flight touches; undone by "↶ Desfazer" (js/reversoes.js:186-189) | O A |
| Booking: "Instrutor (kg)" | `#agd-kg-instrutor` (index.html:745) | js/agendamento.js:926-933 | `x.kg` (cadastro) | O A |
| "Dados pessoais" drawer: "CPF", "CANAC", "Nascimento", "Celular", "E-mail", "Cancelar", "Salvar" | `#form-dados`, `#dado-cpf` …, `#btn-cancelar-dados`, `#btn-fechar-dados` | js/eventos/cadastros.js:24-44; js/views/dados-pessoais.js:127-153 | `dados_pessoais` | O A S |
| "Tentar de novo" (hours not read) | `#btn-tentar-dados` in `#aviso-dados` (index.html:120-123) | js/eventos/topo.js:114-116; `lerDadosDeNovo` (js/actions.js:85-108) | `S.horasBase`, `S.horasDosInstrutores` | all |

Dispatch: fields with `data-f` inside a `[data-k="i"][data-id]` container go to the one handler `aoMudarCampo('i')` (js/eventos/registro.js:37-52); the drawer reuses it through `.habs-painel[data-k="i"]`. `registro.js` refuses any change for a read-only profile or before the date's data is read (`isGestor() || aindaNaoAbriu()`).

## 4. Rules and the tests that pin them (file and test name)

| Rule | Code | Tests |
|---|---|---|
| An instructor serves a flight only when `x.on && cobre(x.aw, a, b)`: available in EVERY window the whole flight touches | js/viabilidade.js:17, 54 | test/unit/viabilidade.test.js "o instrutor cobre o voo quando está disponível em todos os períodos que o voo toca", "fora do cadastro, inativo ou sem disponibilidade em todo o voo"; test/unit/engine.rules.test.js "respeita a disponibilidade do instrutor", "o simulador que passa das 17:30 precisa do instrutor disponível na noite"; test/unit/engine.invariants.test.js "instrutor ativo, habilitado para a missão no equipamento (…), disponível em todo o período e não bloqueado" |
| Order of the instructor rules: indisponível, habilitação, ocupado, bloqueio, limite da lei, peso | js/viabilidade.js:53-62 | test/unit/viabilidade.test.js "só o primeiro problema, na ordem do motor; todos com todos: true" |
| Day entry is exactly `{ on, aw }`; a missing entry means on and all nine windows | js/dias.js:58, 92-95 | test/unit/dias.test.js "o cadastro não tem dados do dia e o dia não tem nomes nem pesos" (asserts the keys `['aw', 'on']`), "dia vazio: instrutores disponíveis em todas as janelas, alunos sem missão, frota toda disponível" |
| A new date copies the availability of the latest saved day before it; nothing is saved on open | js/dias.js:118-123; js/storage.js:182-191 | test/unit/dias.test.js "copia do dia anterior a disponibilidade, sem a demanda (…)", "dia sem disponibilidade nem demanda (importado do BI) copia como dia padrão"; test/unit/storage-dias.test.js "data nova começa com uma cópia do dia anterior (…) e não grava nada" |
| `aw` normalisation: nine booleans or all true | js/storage.js:146 | test/unit/storage.test.js "valores gravados fora do formato: status desconhecidos saem; pessoas e pedidos voltam aos tipos certos", "migra o formato acpm2 (7 janelas) para as 9 janelas atuais" |
| Day grid, "Vem", window click, "Aplicar turno" | js/views/cadastros.js:78-135 | test/e2e/cadastros.spec.js "disponibilidade do dia: a grade mostra as janelas e os voos de cada instrutor", "cadastra instrutor e altera habilitações (no painel), peso e turno", "instrutor indisponível pode ser revertido pelo histórico" |
| Booking makes an unavailable instructor available, and the undo restores `{ on, aw }` | js/agendamento.js:934-939; js/reversoes.js:38-40, 186-189 | test/unit/agendamento.test.js "os pesos digitados vão para o cadastro, um texto do histórico cada; "Marcar disponível" liga o instrutor nos períodos do voo"; test/unit/reversoes.test.js "o pedido, o voo fixo ou a disponibilidade de antes que não vêm valem null; …", "fora do formato não vale: não vira botão nem é aplicada"; test/e2e/agendamento.spec.js "o instrutor indisponível: "Marcar disponível" deixa agendar, e desfazer devolve a disponibilidade" |
| Habilitações: 21 ids, not cumulative; a mission needs its own and, on C152, C172 and PA-34, the aircraft's; a cheque needs three checker marks and no aircraft habilitação; the PC Noturno needs IFR; a resource with "Habilitação própria" needs `aviao:<reg>` | js/habilitacoes.js:10-103; js/frota.js:50-54 | test/unit/habilitacoes.test.js (9 tests, e.g. "não são cumulativas: instrutor de C172 sem simulador, de PA-34 sem parafuso", "voos de cheque exigem as três marcas do checador: …"); test/unit/candidatos.test.js "habilitação própria: o avião que a exige só serve com o instrutor que a tem (…)", "o noturno do PC também exige do instrutor a habilitação IFR (…)"; test/e2e/cadastros.spec.js "o checador por partes: …", "as habilitações não são cumulativas e valem na escala" |
| Habilitações filter (AND), options follow the fleet | js/views/cadastros.js:347-358, 392-397 | test/e2e/cadastros.spec.js "o filtro das habilitações: várias marcas mostram quem tem todas, …", "as opções do filtro das habilitações acompanham a frota: …", "o filtro das habilitações dura aos redesenhos: …" |
| Legal limits: defaults, normalisation, hours, duty, rest | js/limites.js | test/unit/limites.test.js (17 tests in 4 groups); supabase/tests/database/limites.test.sql (8 checks); test/e2e/limites.spec.js (4 tests) |
| Without the hours: banner, "Aprovar escala" disabled, "Tentar de novo" | js/storage.js:210; js/views/escala.js:387-390 | test/unit/storage-dias.test.js "sem as horas dos instrutores, os resultados ou os programas dos cursos, a data abre e diz o que ficou indisponível"; test/e2e/compartilhado.spec.js "sem as horas dos instrutores ou os resultados: aviso fixo, Aprovar escala desligado e "Tentar de novo"" |
| Rest after yesterday's Noturno is a warning, not a block | js/noturno.js:44-52 | test/unit/noturno.test.js "o repouso antes da volta é um aviso, e a regra do repouso não barra os voos novos do instrutor"; test/unit/candidatos.test.js "o repouso de quem volta hoje é um aviso, não barra os voos novos; com a volta cancelada, barra" |
| Rodízio: categories, membership, rotation | js/rodizio.js | test/unit/rodizio.test.js (3 tests); test/unit/dias.test.js "as filas fazem parte do dia e a nova data começa com quem voou na categoria no fim da fila"; test/unit/noturno.test.js "a volta não conta de novo no rodízio do noturno"; test/e2e/rodizio.spec.js (3 tests) |
| Removed instructor: chosen-instructor requests, pins | js/eventos/cadastros.js:111-125; js/engine.js:330-331, 993-994; js/viabilidade.js:40 | test/e2e/instrutor-escolhido.spec.js "o escolhido excluído: na data aberta, o pedido volta ao Automático; em outra data, o app escolhe e avisa", "o escolhido excluído de um voo agendado na Escala: o voo fica no lugar, em conflito, com as sugestões"; test/unit/dias.test.js "ignora no dia instrutores e alunos que saíram do cadastro" |
| Whoever leaves the roster loses the personal data | 20261114151953:164-170; js/backends/local.js:99-103 | test/unit/dados-pessoais.test.js "quem sai do cadastro leva os dados pessoais junto"; supabase/tests/database/dados-pessoais.test.sql "os dados pessoais de quem saiu do cadastro saem junto" |
| The Secretaria edits only the personal data and opens Instrutores on Cadastro | js/views/vistas.js:11; css/app.css:184, 237 | test/e2e/dados-pessoais.spec.js "a Secretaria vê Alunos e Instrutores e edita só os dados pessoais", "Instrutores abre no Cadastro para a Secretaria e na Disponibilidade do dia para o Operador; a vista escolhida fica até recarregar" |
| Goldens: output AND the hash of the generated input state | test/unit/engine.golden.test.js:19-24 | each `cenario-NN.json` stores `hash`; the assertion message is "o gerador de cenários mudou: recapture os goldens" |

Repo rules touched by this area:
- `gravarAlteracao` is used by every event here. Two things are outside it by design: the personal data (own RPC, the server writes the History) and `lerDadosDeNovo`, which calls `save()` directly after re-reading the hours (js/actions.js:106).
- "Only the Administrador changes the limits" is enforced ONLY on screen. `salvar_documento` accepts any `operador`, and the Administrador counts as `operador` (20261111122858:5-14; 20261114151953:124-134); no field-level check exists.
- Personal data stay out of the cadastro, CSV, PDF, BI and History (field names only). The instructor's weight is not one of the five personal fields: it is in the cadastro, the History and the schedule. The reception TV receives the instructor's full name (`left(o->>'ins', 80)`, 20261120150000:65), while student names are shortened.
- Tests use fictitious names and weights (`test/helpers/estado.js`, `montar.js`, `cenarios.js`).

## 5. Answers

### 5.1 The instructor record

- **Roster (all dates)**: `id`, `nm`, `lv` (legacy copy), `kg`, `hab`, `horasExternas` (js/dias.js:41-45). Nothing else.
- **Day (per date)**: `on` and `aw` only (js/dias.js:58).
- **Outside both**: CANAC and contact data in `dados_pessoais` (all dates; O, A and S read; G does not); the hours for the legal limits, computed at every opening and never stored.
- **Name, weight, habilitações**: all dates; changing them rewrites the whole cadastro document and recalculates the open date.
- **Preference**: none on the instructor (see 5.5).
- **How a new date gets availability**: `carregarDia` reads the day; with none saved, it takes `backend.diaAnterior(data)`, which is the LATEST SAVED day before the date, not necessarily yesterday (js/backends/local.js:120-123; js/backends/supabase.js:135-141), and `diaParaCopiar` copies its `ins` map (`on` and `aw` of every instructor) unchanged (js/dias.js:118-123). So "Vem" off carries forward to new dates until someone turns it on, but dates already saved keep their own value. With no earlier saved day, or one without `ins`/`pedidos` (a day imported from the BI), the date starts as `diaPadrao()`: everyone on, all nine windows (js/dias.js:34, 119).
- **A brand-new instructor**: on the open date, on with the eight day windows and the 17:30 window OFF (js/eventos/cadastros.js:75). On every other date already saved he has no entry, so he is on with all NINE windows, night included (js/dias.js:94). (inferred from the two lines; no test covers the difference.)
- A date only opened is not saved; the first change, or an export, saves it. Editing an instructor's roster data while a date is open therefore also saves that date's day document.

### 5.2 The two views

Every column and control is in §3. Points the table does not show:
- Filters (search and Habilitações) apply to BOTH views and survive redraws; a row just created or edited stays visible outside the filters until they change (`manterAVista`, js/views/cadastros.js:374-376).
- The day grid is redrawn with every recalculation and restores keyboard focus by `tr[data-id]` plus `data-f`/`data-w` (js/views/cadastros.js:125, 137-142).
- **"Editar habilitações" groups** (js/views/cadastros.js:35-43), with the full names as labels: "Ground e simulador" (`grounds`, `ground_pa34`, `sim_mono`, `sim_multi`); "Voo" (`tgl`, `local`, `navegacao`, `solo`, `parafuso`, `ifr`, `noturno`); "Aviões" (`c152`, `c172`, `mlte`); "Checador: curso" (`checa_pp`, `checa_pc`, `checa_inva`, with "?" `checador`); "Checador: motor" (`checa_mnte`, `checa_mlte`); "Checador: regras" (`checa_vfr`, `checa_ifr`). Then **"Habilitação própria do recurso"** (with "?" `habilitacao-propria`): one switch `aviao:<reg>` per fleet resource whose `habilitacaoPropria` is true (`gruposDosRecursos`, js/views/cadastros.js:176-179), labelled "Avião PR-VOM". Then the hours fieldset.
- The "Aviões" group is per TYPE (C152, C172, PA-34 through `mlte`), mapped in code (`DO_AVIAO`, js/habilitacoes.js:82); only "Habilitação própria" is per resource.
- When a resource loses "Habilitação própria" or leaves the fleet, its switch and filter option disappear, but nothing removes `aviao:<reg>` from the instructors' `hab` (js/eventos/recursos.js:75-88, 149-158; `normalizarHabilitacoes` accepts any valid `aviao:` id, js/habilitacoes.js:37-45). The Cadastro column would keep showing "Avião PR-XXX" with no switch to remove it. (inferred; the e2e test checks only the filter.)
- G and S cannot open the drawer, so they cannot see the grouped habilitações or an instructor's month/semester/year hours; they see the one-line summary and the "Mês" column.
- **Removing an instructor**: "✕" (`data-act="deli"`), two clicks. **There is no undo**: `gravarAlteracao('exc', 'Instrutor excluído: …')` carries no revert (js/eventos/cadastros.js:125), and `validarReversao` has no kind for it (kinds: `setFly`, `setAv`, `setAtributo`, `setInsOn`, `restaurarFixos`, `restaurarEscolha`, `restaurarHorarios`, `readicionarRecurso`, `desfazerAgendamento`; js/reversoes.js:43-117). Only resources have a removal undo (`readicionarRecurso`). Effects in 5.6.

### 5.3 aw on screen

- **Drawn** as nine checkbox cells per instructor row, headed by the `WIN` labels. Cell classes: `cel` (striped: window off), `cel on` (light blue: available), `cel voo` (blue: a flight or class of his overlaps that window). The row gets `off` (50% opacity) when "Vem" is off; the cells stay editable and keep their values.
- **Edited** one click per window, or with "Aplicar turno…" per row (five presets, js/config.js:118-124). Neither writes a History entry, so neither can be reverted from the History.
- **"Vem" is stored**, not derived: `dia.ins[id].on`. It is independent of the windows: on with no window is never available; off keeps the windows for when it is turned on again. The engine uses `x.on && cobre(x.aw, a, b)`. The legend's "não vem" labels a window that is off, which overlaps in wording with the "Vem" switch.
- **Bulk actions**: only "Aplicar turno…", one instructor at a time. Nothing acts on several instructors, and the window headers have no handler.
- **Every writer of `aw`** (production code):
  1. js/eventos/cadastros.js:75: new instructor, eight day windows.
  2. js/eventos/cadastros.js:173-174: one window (`x.aw[+t.dataset.w] = t.checked`).
  3. js/eventos/cadastros.js:175-177: "Aplicar turno" (`x.aw = WIN.map((_, i) => PRE[t.value].includes(i))`).
  4. js/agendamento.js:936-938: booking with "Marcar disponível": `x.on = true` and every window the booked flight touches.
  5. js/reversoes.js:188: "↶ Desfazer" of that booking restores `{ on, aw }`.
  6. js/dias.js:94: `juntar` builds it from the day, or all true.
  7. js/storage.js:146 (and :125 for schema before v3): normalisation on load.
  8. js/backends/local.js:76: legacy `acpm2` conversion from 7 to 9 windows.
  9. js/dias.js:58: `separar` writes it to the day document.
  10. js/dias.js:120-122: `diaParaCopiar` carries it to a new date.
- **Readers**: js/viabilidade.js:17, 54 (the only rule, `cobre` has one production caller); js/views/cadastros.js:81-82; js/reversoes.js:39-40 (validation of a stored History reversal: nine booleans); js/agendamento.js:936.
- Test and fixture writers: test/helpers/montar.js:7, estado.js:29, exemplo.js:24, cenarios.js:50 (random, each window true with probability 0.85); test/fixtures/goldens-do-motor/exemplo-estado.json (40 instructors, all nine true).

### 5.4 The legal limits

- **Limit values**: `cadastro.limites`, all dates and all instructors (js/limites.js:9-18): `vooPorJornadaMin` 570, `jornadaMin` 660, `vooMesH` 100, `vooSemestreH` null, `vooAnoH` 960, `repousoMin` 720, `apresentacaoMin` 30, `encerramentoMin` 30. The last two have no input. Edited in the panel under Instrutores › Cadastro, by A (local: Operador role).
- **Hours flown**: nobody types them. They come from the SAVED schedules: shared mode, RPC `horas_dos_instrutores(p_data)` reading `public.dias` (`conteudo->'resultado'->'out'`, status from `fStatus`, delay from `fObs`), `security invoker`, so the row policy of `dias` applies (O, A, G, S read; the TV profile gets `{}`); local mode, `acumularHoras` over the stored days (js/backends/local.js:196-200; js/limites.js:55-69). Aircraft only (C152, C172, PA-34); cancelled flights excluded; calendar month, semester and year of the date.
- **Rest**: `fimAnterior` = the end of the instructor's last commitment on the calendar day before (flight, simulator or Ground; a delayed flight ends at the new take-off plus the duration). Derived, not editable.
- **Hours outside the app**: `ins[].horasExternas`, typed by O or A in the drawer: this month (`AAAA-MM`) and "earlier this year" (`AAAA-00`). `comHorasExternas` adds them to month and year; `AAAA-00` never counts for the semester (js/limites.js:72-86).
- **Assembly**: `S.horasDosInstrutores = comRepousoDoNoturno(comHorasExternas(horasBase, ins, data), noturnos)` (js/storage.js:202). Not stored. `historicoDoDia` removes `fimAnterior` for whoever returns today from yesterday's Noturno (js/noturno.js:44-52).
- **Block**: `dentroDosLimites` (js/limites.js:101-117) inside `problemasDoInstrutor`, code `limite-da-lei` with a reason (`voo-dia`, `jornada`, `mes`, `semestre`, `ano`, `repouso`). The engine skips that instructor for that time; with nobody left the request is rejected: "nenhum instrutor dentro dos limites da Lei do Aeronauta (horas de voo, jornada ou repouso) nos horários possíveis" (js/engine.js:762, 958). A pinned flight gets the conflict "o instrutor passaria do limite da lei (…)" (js/conflitos.js:44). Sugestões and the booking dialog list it as a problem.
- **Warn**: `perto-do-limite` from 90% of month, semester or year with the day's schedule (js/engine.js:138-158); `repouso-do-noturno` (js/engine.js:1000-1006); the "Mês" cell turns `perto`; the Escala summary says "1 instrutor perto do limite da lei".
- **Hours not read** (RPC failed): `'horas'` in `S.indisponiveis`; banner "Não foi possível ler as horas de voo dos instrutores: os limites do mês e do ano não estão sendo conferidos, e Aprovar escala fica desligado." with "Tentar de novo"; the engine then checks only the day's limits; `#btn-aprovar` is disabled.
- Daily duty and daily flight time depend on the schedule being built, so only the engine can decide them. Month, year and rest could be pre-checked before the engine.

### 5.5 Preferences

No instructor-side preference exists: no field in the roster or the day, no control, no rule (grep for "prefer" in the instructor modules finds none). What points at an instructor today:
- the student's **"Priorizar com"** (`stu[].voaCom`) and **"Não escalar com"** (`stu[].bl`), edited in Alunos;
- the operator's **chosen instructor** for a request of the date (`pedido.insId`) and the pin (`fixos[].insId`);
- the instructor's position in the rodízio queues.
So an INVA detail can only show the reverse view: which students prioritise him, which students must not fly with him, his queue positions, and the date's requests that chose him. All of it is derivable from `S.stu`, `S.filas` and the day.

### 5.6 Inactive instructor, and what removal does

There is NO notion of an inactive instructor. The only switch is the per-date "Vem". The word "ativo" in user-facing text already means "Vem on this date": "nenhum instrutor ativo tem a habilitação de …" (js/engine.js:746-747, 937-938). Courses are the only records with an active flag (`ativo`, "(encerrado)", "Mostrar encerrados").

Removing an instructor (js/eventos/cadastros.js:111-125):
1. His habilitações drawer closes.
2. He leaves `S.ins` (roster, all dates).
3. Every student's `bl` and `voaCom` lose his id (roster, all dates).
4. On the OPEN date, requests that chose him go back to "Automático".
5. On the OPEN date, pins are released only when they exist just because of the choice (`escolhido && !agendado`, schedule not approved, no status pin). Approved, status-pinned and booked flights stay, in conflict "o instrutor saiu do cadastro" (`instrutor-saiu`), with Sugestões; the row shows "Instrutor fora do cadastro" (js/engine.js:524).
6. History: "Instrutor excluído: <nm>", no revert.
7. Rodízio: `ajustarFilas` drops him wherever the queues are read; the stored `filas` may keep the id until rewritten.
8. Other dates are not touched: a request that chose him falls back to the app's choice with the warning "O instrutor escolhido saiu do cadastro: o voo ficou com …" (`escolhido-saiu`, js/engine.js:993-994) and the Demanda shows "Instrutor fora do cadastro (o app escolhe)"; a pin with him becomes a conflict when that date is recalculated; stale `dia.ins[<id>]` entries are ignored by `juntar`.
9. Saved schedules keep his `insId` and name, so the BI still shows him by name (js/views/bi.js:86).
10. **His personal data are deleted for good** when the cadastro is saved: `salvar_documento` deletes every `dados_pessoais` row whose id is no longer in `ins` (20261114151953:164-170); local mode does the same. The Manual says so (index.html:535).
11. `horasExternas` go with him.
12. Re-creating him gives a NEW id (`S.nid++`): the hours flown (keyed by `insId` in the saved schedules), the rodízio position, the students' preferences and the personal data do not come back.

### 5.7 The availability-ranges model

**Today's geometry.** `T` = 06:30, 08:20, 10:10, 11:30, 12:40, 13:40, 14:30, 16:20, 17:30 in minutes (390, 500, 610, 690, 760, 820, 870, 980, 1050). Window k covers `[T[k], T[k+1])`; window 8 covers `[1050, 1440)`. Lengths: 110, 110, 80, 70, 60, 50, 110, 70 and 390 minutes. `cobre(aw, a, b)` is true when every window the flight `[a, b)` overlaps is on.

**Exact equivalence with ranges, presence meaning.** Merge consecutive true windows k..m into one range `[T[k], T[m+1])` (with `T[9]` = 1440). Then, for every flight with `b <= 1440`:

`cobre(aw, a, b)` is true exactly when `b <= max(a, 390)` or one range `[de, ate)` has `de <= max(a, 390)` and `b <= ate`.

Confirmed by running the real `cobre` against this formula in memory: 512 window patterns × 1,610 intervals = 824,320 cases, 0 differences (no file written). Two details the formula carries:
- Time before 06:30 belongs to no window, so it is never checked: a flight entirely before 06:30 passes with every window off (take-off lists accept 06:00, js/horarios.js:17-25).
- The return leg of yesterday's Noturno (07:30) is never checked against availability (js/engine.js:370-393).

| Preset ("Aplicar turno") | Windows | Range (presence) |
|---|---|---|
| "Dia inteiro" | 0-7 | 06:30–17:30 |
| "Manhã" | 0-3 | 06:30–12:40 |
| "Tarde" | 4-7 | 12:40–17:30 |
| "Noturno" | 8 | 17:30–24:00 |
| "Dia + noturno" | 0-8 | 06:30–24:00 |
| new instructor | 0-7 | 06:30–17:30 |
| missing day entry | 0-8 | 06:30–24:00 |
| a window off in the middle | e.g. 0-2 and 4-7 | 06:30–11:30 and 12:40–17:30 (the lunch break) |

**Why a start-time range cannot reproduce today.** With "the range limits when a mission may START", today's behaviour would need a different latest start per duration: `ate` minus the flight's duration. For "Manhã" (ends 12:40) the latest start is 11:40 for 1 h, 11:10 for a 1h30 Ground, 10:40 for a 2 h simulator. One stored "latest start" cannot serve all durations, so commit 1 (goldens unchanged) must read the ranges as presence (the whole flight inside one range), and the start meaning can only arrive in commit 2. Cases that change with the start meaning:
- "Dia inteiro" and a 2 h simulator or a 1h30 Ground at 16:20: refused today (they touch the 17:30 window; pinned by engine.rules "o simulador que passa das 17:30 precisa do instrutor disponível na noite"), accepted by start.
- "Manhã" and a PA-34 flight of 1 h at 12:00: refused today, accepted by start.
- With the default lists, a 1 h flight at 13:40 touches windows 5 and 6 (the 13:40 window lasts 50 minutes), so turning off 14:30 also removes the 13:40 slot today.
- The Noturno starts exactly at 17:30, so a range ending at 17:30 exclusive still excludes it under both meanings.

**Measured size of commit 2.** Replacing `cobre` in memory by "the window in which the flight starts must be on" (control run with the real rule: 0 differences): 37 of the 41 goldens change, 305 of 749 flights differ in time, instructor or resource, and rejections go from 174 to 167. The example does not change (all windows on). The random scenarios have many holes, so real days should change less, but the golden diff will be large.

**Category take-off times and several resources.** Lists per category (js/horarios.js:10-13): C152, C172 and simulator start at the eight day windows; PA-34 every 30 minutes 06:30–16:30; lists are editable (06:00–16:30 in the editor); Noturno 17:30; Voo Solo 06:30; Ground at the eight day windows. Availability today is per instructor per date, NOT per category or resource, and stays so with ranges: one set of ranges limits all his flights. Ranges in minutes can express "from 13:30" for a PA-34, which the grid cannot.

**Contrast already in the code**: the STUDENT's availability ("manhã", "tarde", "noite", "Só às HH:MM") is already start-based (`permitidas(minuto)` on the start, js/rules.js:19-27); only the instructor's is whole-flight.

**What the data would need**
- `dia.ins[<id>]` gains the ranges (minutes 0–1440, sorted, merged, `de < ate`), keeps `on`, and keeps `aw` (steps never delete fields; precedent: `lv` kept as a copy, js/dias.js:40-42). Defaults must mirror today: missing entry = 06:30–24:00; new instructor = 06:30–17:30.
- A `dia` step in js/migracoes.js with its own `ESQUEMA` number; `separar`/`juntar` (js/dias.js:58, 94) and the normalisation (js/storage.js:125, 146) read and write the ranges. No server change: the server never reads availability.
- Stored History reversals are NOT migrated by any step: `desfazerAgendamento` entries hold `disponibilidade: { insId, on, aw }` and `validarReversao` demands nine booleans (js/reversoes.js:38-40). It must accept the old shape, or those "↶ Desfazer" buttons disappear.
- The engine's input: `problemasDoInstrutor` reads `x.aw` from the state. The golden test hashes the GENERATED state, which contains `aw` (test/unit/engine.golden.test.js:22), and `exemplo-estado.json` is a frozen input with `aw`. If the helpers start emitting ranges, all 40 scenario files change (the `hash` line) even with identical schedules.
- Other code tied to the nine windows for instructors: js/agendamento.js:938 ("Marcar disponível"), js/views/cadastros.js:46-58 (which windows are busy), :80-83 and :123-130 (cells and header), js/eventos/cadastros.js:75, 173-177, js/backends/local.js:76.
- Tests to rewrite: test/unit/dias.test.js (keys `['aw', 'on']`), viabilidade, storage, reversoes, agendamento, engine.rules, engine.invariants (checks `x.aw[k]` directly), compactar, equalizar, combustivel, reparo, instrutor-escolhido, migracoes; e2e cadastros (`[data-f="aw"]`, `[data-f="pre"]`), historico.spec.js:64, seguranca.spec.js:306.

**What the UI would need**: per instructor per date, an editor of one or more ranges (add, remove, two times each) with "Vem"; the presets as one-click ranges; the instructor's flights of the date drawn against the ranges (today's blue cells); the booking's "Marcar disponível às HH:MM" adding or widening a range; a compact text of the ranges for the list row; phone layout. User-facing texts that state the whole-flight rule and change with commit 2: js/engine.js:955 ("durante o voo inteiro") and :759 ("durante as 01h30"), index.html:514, 529, 565, 570, 574 (Manual), glossary `vem-nesta-data` and `turno` (js/glossario.js:88, 93).

### 5.8 The rodízio

- **What**: fair rotation of the better-paid flights. Four queues, a flight counts in the first that applies (js/rodizio.js:7-20): `cheque` "Voos de cheque", `mlte` "Voo MLTE (PA-34)" (any flight on a PA-34), `noturno` "Voo noturno", `c172` "Voo C172". Ground, simulator and C152 flights have no queue.
- **Data**: `dia.filas`, per date, the queues "at the start of the date". A new date gets `filasDoDiaSeguinte(previous saved day, roster)`: whoever flew a category (not cancelled, not the Noturno return leg) goes to the end. It is a snapshot: changing an earlier day afterwards does not recompute a later saved date.
- **Dependence on instructors**: membership comes from the habilitações, not from "Vem" (`participa`: can give some cheque; has what a Multimotor on a PA-34 needs; has what a Noturno on a C172 needs; has `c172`). `ajustarFilas` keeps the stored order, drops whoever left the roster or lost the habilitação, and appends the newly qualified at the end in roster order. An instructor who is off on the date keeps his place, tagged "indisponível".
- **Use in the engine**: among the instructors that serve a flight, after fuel, known weight and "not the student's previous instructor", the order is fewer flights of that category today, then queue position (js/engine.js:781-783, 858-860). The even split of hours and the compaction never move a rodízio flight to another instructor (js/engine.js:214; js/compactar.js:97). The booking dialog orders its instructor list the same way and notes "Na fila do rodízio (…), a vez é de …" (js/agendamento.js:529-555, 1206-1212).
- **Screen**: one panel per category, "1º Nome", "N voos nesta data", "indisponível", three buttons; O and A reorder, G reads, S does not see the tab. No revert in the History.
- Small inconsistency: the tab's "N voos nesta data" has no `!o.trecho` filter (js/views/rodizio.js:15), so it counts yesterday's Noturno return leg, which the rotation and the booking dialog exclude. (inferred from the code; not tested.)

## 6. Conflicts with the request

| # | The request assumes | The code says | Evidence |
|---|---|---|---|
| 1 | The INVA detail shows "preferences" | No instructor-side preference exists. Only the students' "Priorizar com" and "Não escalar com", the chosen instructor of a request, and the rodízio position point at an instructor | js/dias.js:41-47; js/views/cadastros.js:109-117 |
| 2 | (This brief) removing an instructor has an undo; the request groups it with "Retirar" | Instructors have "✕" / "Excluir <nome>" with NO undo, and removal permanently deletes the personal data on the server. "Retirar" with an undo exists only for resources | js/eventos/cadastros.js:111-125; js/reversoes.js:43-117; 20261114151953:164-170 |
| 3 | Availability "is one boolean per fixed window" | Also a second stored per-date switch, "Vem" (`on`), ANDed by the engine and with its own History revert. The ranges model does not say what happens to it | js/dias.js:58; js/viabilidade.js:54; js/eventos/cadastros.js:143-147 |
| 4 | Commit 1: ranges of "earliest and latest mission start time", goldens unchanged | A start range cannot reproduce `cobre` for all durations. Unchanged goldens need presence ranges (whole flight inside); the start meaning exists only in commit 2 | js/viabilidade.js:17; §5.7 |
| 5 | "The goldens must not change" with `viabilidade.js` reading ranges | Each golden stores the hash of the generated INPUT state, which has `aw`; `exemplo-estado.json` is a frozen input with `aw`; a step in js/migracoes.js only converts stored documents, not the state the tests hand to the engine | test/unit/engine.golden.test.js:19-24; test/helpers/cenarios.js:44-51; test/fixtures/goldens-do-motor/exemplo-estado.json |
| 6 | A data-format step converts `aw` | History reversals of bookings keep `aw` in the `historico` table, which no step migrates, and their validation demands nine booleans | js/reversoes.js:38-40; js/agendamento.js:1273-1274 |
| 7 | "Deactivating … applies to all dates", same for INVAs | No roster-level flag exists for instructors, and "ativo" already means "Vem on this date" in rejection texts. An inactive instructor must stay in `cadastro.ins`, or the server deletes his personal data | js/engine.js:746-747, 937-938; 20261114151953:164-170 |
| 8 | The Secretaria must not edit (stated for Alunos); `salvar_dados_pessoais` needs a migration | The same function and the same permission (`le_dados_pessoais()`, which also gates READING) serve instructors. The Secretaria opens Instrutores on Cadastro because the personal data are her work there. The request does not say whether she keeps editing, or reading, the INVAs' personal data | 20261113150000:55-70; js/views/vistas.js:4-11; test/e2e/dados-pessoais.spec.js:114, 171 |
| 9 | Remove "Janelas de operação" because take-off times per category overlap with it | Only `state.win` can go. The nine windows (`WIN`, `T`, `PRE`) also define instructor availability, "Aplicar turno", the student's "manhã/tarde/noite" (js/rules.js:12), the Ground start times, the default take-off lists and the Escala and PDF grouping | js/config.js:4-8, 118-124; js/horarios.js:10; js/engine.js:601; js/format.js:7 |
| 10 | Processamento shows "why any of them cannot be scheduled" from the INVAs' restrictions, legal limits included | Daily flight time, duty and occupancy depend on the schedule being built; only the engine decides them. Time-independent reasons already exist as a pure function (`instrutoresDoPedido`: "fora nesta data", "sem a habilitação", "em Não escalar com") | js/instrutor-escolhido.js:20-35; js/limites.js:101-117 |
| 11 | The cadastro screen is called "INVAs" | The app says "Instrutores" everywhere; "INVA" today is a course sigla, a checker mark (`checa_inva`) and the compaction option | index.html:97; js/habilitacoes.js:28; js/views/escala.js:416 |

## 7. Implications and options for the redesign (suggestions)

1. **Store the ranges as presence in commit 1, and name the field for what it is.** `dia.ins[id] = { on, faixas: [[de, ate], …], aw }`, conversion by merging true windows. Cost: one `dia` step, `separar`/`juntar`, the normaliser, about a dozen test files. Risk: if the field is named or documented as "latest start", commit 2 changes its meaning under the same name; decide the name once.
2. **Keep the goldens byte-identical by letting `viabilidade.js` accept both shapes** (ranges when present, else derived from `aw`), so the test helpers and the frozen example keep emitting `aw`. Cost: a small dual reader that lives until the helpers move. Risk: two shapes in the engine's input for a while. Alternative: move the helpers to ranges and accept that 40 files change only in the `hash` line; cost: a diff that looks like a rule change and is not.
3. **Commit 2 (start meaning) is a real rule change.** Measured: 37 of 41 goldens, 305 of 749 flights. Cost: re-record and review; rewrite "durante o voo inteiro" in the engine messages, Manual and glossary. Risk: an instructor marked "Manhã" gets a flight that ends after his range; a day-only instructor gets a Ground or simulator ending after 17:30. Pedro should confirm these are wanted.
4. **Make `validarReversao` accept the old `disponibilidade.aw`** (convert on read). Cost: a few lines and tests. Risk if skipped: old "↶ Desfazer" buttons vanish.
5. **Keep "Vem" as the stored per-date switch**, next to the ranges. Cost: none. Risk of deriving it from "no ranges": turning it off would erase the ranges, and the History revert `setInsOn` would lose its meaning.
6. **Inactive INVA as a flag in the roster** (`ins[].ativo: false`), the instructor staying in `cadastro.ins`, filtered out where the engine's state is assembled so the engine and goldens are untouched. Cost: a number-only `ESQUEMA` step (old tabs would strip the field, as in formats 22 and 25), `separar`, the list switch and filter. Decisions needed: rodízio (dropped from the queues means he re-enters at the end), pins and chosen requests on other dates (reuse the "saiu do cadastro" conflict and warning, with a new wording), students' lists (keep), BI. Risk: the word "ativo" already used for "Vem" in rejection texts.
7. **With an inactive switch, restrict or remove hard delete**, since it destroys personal data, external hours and the link to the flown hours with no undo. Cost: low. Risk: a roster that only grows; a delete limited to never-scheduled instructors answers it.
8. **INVA detail sections**: Dados (nome, peso); Dados pessoais (CANAC and contact, profile-gated, saved by their own RPC with the version check); Habilitações (the same groups); Disponibilidade na data (Vem, ranges, flights of the date); Horas e limites (month, semester, year, "Fora do app"); and, for "preferences", a read-only reverse view (students that prioritise him, students that must not fly with him, queue positions). Cost: the reverse view is new but derivable. Risk: the personal-data form saves with an explicit "Salvar" and a version check, unlike the other fields edited in place; mixing both in one pane needs a clear boundary.
9. **Keep a cross-instructor view of the date.** The day grid is the only place that shows who is available when and who is already flying. A one-instructor detail loses it. Options: a board under Processamento's "INVAs disponíveis", or the list row's meta ("Vem · 06:30–12:40 · 3 voos · 42 h"). Cost: a new compact view. Risk if dropped: the operator's daily check (Manual step "Instrutores") gets slower.
10. **The legal-limits panel is a global setting**, not an instructor's data: place it with the Escala stage's configuration or as a settings block of the INVAs screen. Consider enforcing "Administrador only" on the server; cost: a migration comparing `limites` in `salvar_documento`; risk: none functional.
11. **Rodízio placement**: it is a per-date engine input, like the compaction criteria. Options: a sub-task of the Escala stage ("rodízio"), or a secondary view of the INVAs screen. Cost: navigation only (`show('rod')` and `rRodizio` stay). Risk: under INVAs it looks like roster data while it belongs to the date.
12. **F3 registry**: today the type requirement is hard-coded (`DO_AVIAO`, `DO_SIMULADOR`) and only "Habilitação própria" is per resource, as a flag that generates `aviao:<reg>`. A list of required ids per resource would replace the flag; note that cheque flights skip the type habilitação but not the resource's own, and that dangling `aviao:` ids stay on instructors. Cost: a cadastro step and `exigencias`. Risk: engine inputs change; goldens with `comAtributos` scenarios must stay equal.
13. **One cadastro document**: every roster edit rewrites the whole cadastro with a version check, and a second editor gets the screen locked ("Outra pessoa alterou a escala…"). In-place editing in master–detail makes concurrent edits more likely. Cost of changing it: high (server model). Risk of keeping it: more lock-outs; at least say it in the plan.
14. **Reuse as is**: `chaveDeBusca`, the Habilitações filter component, `mostrarVista`, focus keeping (`atualizarLinhaDoCadastro`, `seletorDoCampo`), the `data-k="i"` plus `data-f` dispatch (a detail pane with `data-k="i" data-id` gets the existing handler for free), and `somente-leitura.js` (covers inputs inside `main`; a pane outside `main` needs its selector added, as `#painel-instrutor input` was).

## 8. Open questions for Pedro

1. "Preferences" of an INVA: nothing exists. Show the students' "Priorizar com" / "Não escalar com" in reverse (read-only), or create a real instructor preference (which one)?
2. Availability, commit 2: do you want the start meaning with its consequences (an instructor of "Manhã" flying past 12:40; a day-only instructor giving a Ground or simulator that ends after 17:30)? Or should a range keep meaning "present from … to …"?
3. Does "Vem" stay as a separate per-date switch next to the ranges?
4. Should a new date keep copying the availability of the latest saved day, or start from a default per instructor (a usual schedule in the roster)?
5. Inactive INVA: what happens to his rodízio place, to pins and chosen requests on other dates, and to the students' lists? Does he still appear in the BI and in the hours?
6. With an inactive switch, does hard delete stay? Today it erases the personal data with no undo.
7. Does the Secretaria keep editing, and reading, the INVAs' personal data? The permission is shared with Alunos.
8. Is the screen named "INVAs" or "Instrutores"? "INVA" is also a course sigla.
9. Should availability edits enter the History (today windows and "Aplicar turno" do not)?
10. Where does the day overview of all instructors go (who is available when, who is flying)?
11. Where do the "Limites da Lei do Aeronauta" and the Rodízio go? Should the server enforce "Administrador only" for the limits?
12. Keep `aw` in the stored days as a frozen copy after the conversion (as `lv` was), or is the copy unnecessary?
13. Should the Gestor and the Secretaria see the grouped habilitações and the instructor's hours in the detail? Today they cannot open the drawer.

Not covered: js/views/demanda.js, js/views/escala.js, js/reparo.js, js/compactar.js and js/agendamento.js were read only where they touch instructors; supabase/tests/database/dados-pessoais.test.sql only by its descriptions; no browser run (facts about the screen come from the code and the e2e specs).

<!-- fim -->
