# Mapa: Alunos: the roster, personal data, course progress and permissions

Read on the worktree `.redesenho/wt-plano` (branch `linha-0-plano`, `48875e3`). Paths are relative to the worktree root.
"(inferred)" marks what I concluded without a line that proves it; "(ran)" marks a fact confirmed by running a pure
module with `node`. Nothing in the worktree was changed. The area's unit tests pass as they are (`node --test` on
`test/unit/dados-pessoais.test.js`, `progresso.test.js`, `resultados.test.js`, `perfis.test.js`: 51 tests, 0 failures).

## 1. What exists

- **One tab, one wide table, one drawer.** `<section id="s-alu">` (index.html:249-265), opened by `#nav button[data-t="alu"]`
  (index.html:98): a toolbar (search, "Curso" filter, count, "+ Novo aluno"), the line "Os pedidos de cada data ficam na
  Demanda." with "Abrir a Demanda", and `table.cadastro.alunos` with `tbody#alu`. Personal data open in a side drawer,
  `aside.gaveta#painel-dados` (index.html:680), shared with Instrutores. There is **no detail view of a student** today.
- **Code.** `js/views/cadastros.js` (451 lines) draws Instrutores *and* Alunos; the Alunos part is lines 249-326, and the
  filter machinery of both tabs is lines 328-451. `js/eventos/cadastros.js` (249 lines) holds the events of both.
  `js/views/dados-pessoais.js` (153) is the drawer, `js/dados-pessoais.js` (113) its pure rules (the same rules the local
  mode and the fake server use). Progress: `js/progresso.js`, `js/resultados.js`, `js/views/etapas.js`.
- **A student in memory is roster + the open date's request.** `S.stu[]` items are the roster record merged with that
  date's main request and `extra[]` requests (`juntar`, js/dias.js:96-101); `separar` splits them again at every save
  (js/dias.js:36-74). Alunos and the Demanda both iterate the same `S.stu`.
- **Three stores for a student:** the roster document (`documentos`, `chave = 'cadastro'`), the table `dados_pessoais`
  (personal data, by `(tipo, id_cadastro)`), and the append-only table `resultados_de_missao` (course results, by the
  student's integer id). The course program lives in the course tables (`S.programa`).
- **What does not exist:** an inactive/archived student (section 5.5), a "nome completo" field, a "missão anterior"
  value or function, a way to register a result outside a scheduled flight in the UI, a per-student page.
- **Profiles.** Shared mode: `operador`, `gestor`, `secretaria`, `administrador`, `painel` (js/perfis.js:3). On the screen
  only two roles exist: `body[data-role]` is `operador` or `gestor` (js/actions.js:44-47); the Secretaria is
  `data-role="gestor"` plus `data-perfil="secretaria"` and `ApiClient.readOnly = true` (js/sessao.js:165-171). Local mode
  has only `#role-sel` Operador | Gestor (index.html:69-72) and `ApiClient.perfil === null` (js/storage.js:43).

## 2. Data (every field: where it is stored, per date or for all dates, who writes it)

### 2.1 Roster record: `cadastro.stu[]` (all dates)

Stored in `public.documentos` row `chave = 'cadastro'`, field `conteudo.stu` (local mode: `localStorage` key
`acpm4_cadastro`, js/backends/local.js:13). Written as a whole document by `salvar_documento` (shared) through
`ApiClient.salvarDia` (js/storage.js:229-242), only when its JSON changed (js/storage.js:237).
**`separar` writes a whitelist** (js/dias.js:47): `{ id, nm, kg, bl, voaCom?, curso? }`. Any other key on a student is
dropped at the next save (ran: a student with `ativo` and `nomeCompleto` comes out as `{"id":1000,"nm":"Aluno 1000","kg":70,"bl":[]}`).

| Field | Meaning / UI label | Format and rules | Writers (file:line) |
|---|---|---|---|
| `id` | identity; key of `dados_pessoais.id_cadastro`, `resultados_de_missao.aluno`, `solicitacoes.aluno`, `dia.pedidos[id]`, flight keys `id_mid_ss` | integer > 0; from `S.nid++`, the counter shared with instructors and kept in the roster (`nid`, js/dias.js:39), so ids are not reused | "+ Novo aluno" (js/eventos/cadastros.js:85) |
| `nm` | "Nome" (aria-label "Nome do aluno") | `nomeLimpo`: trimmed, one space between words, up to `LIMITE_DO_NOME` = 80, empty keeps the previous (js/format.js:54-55); not unique | row input (js/eventos/cadastros.js:192-195) |
| `kg` | "Peso (kg)" | 0 = no weight; 1 to 300, tenths (`pesoValido`, `pesoDigitado`, `ERRO_DO_PESO` 'O peso vai de 1 a 300 kg.', js/rules.js:133-137) | row input (js/eventos/cadastros.js:196-200); the "Agendar voo" dialog, `#agd-kg-aluno` (index.html:744; js/agendamento.js:927-932, js/eventos/agendamento.js:34-39) |
| `curso` | "Curso" (curso matriculado) | a sigla checked only in format (`normalizarCursoDoAluno`, js/cursos.js:45: `^[A-Z][A-Z0-9-]{0,8}[A-Z0-9]$`); absent = no course; a course missing from the programs is kept | row select (js/eventos/cadastros.js:212-218) |
| `voaCom` | "Priorizar com" | list of instructor ids, no repeats, never one that is in `bl`; the key is absent when empty (js/storage.js:151-154) | select and ✕ (js/eventos/cadastros.js:208-211, 101-109); cleaned when an instructor is deleted (js/eventos/cadastros.js:119) |
| `bl` | "Não escalar com" | list of instructor ids | select and ✕ (js/eventos/cadastros.js:201-207, 92-99); adding to `bl` removes the id from `voaCom` (203-205); cleaned when an instructor is deleted (118) |

Readers of the preferences outside this tab (EVERY reader of `bl` / `voaCom`): js/engine.js:250, 332, 579, 586, 645,
656, 658, 665; js/viabilidade.js:59; js/instrutor-escolhido.js:24; js/agendamento.js:143, 360, 550, 702, 759, 1202;
js/views/demanda.js:37.

### 2.2 The open date's request, on the same object (per date; owned by the Demanda map, listed for context)

`dia.pedidos[id]` in `public.dias` (local: `acpm4_dia_<data>`): `CAMPOS_DO_PEDIDO` = `fly, mis, eq, p1, p2, nb, ss, pr,
jan, etapa, solicitacao, insId, cursoDaEtapa` plus `extra[]` (js/dias.js:22, 59-62). `juntar` gives a student without a
request `{ ...blank(), extra: [] }` (js/dias.js:100), `blank()` = `{ fly: false, mis: 'Voo Local', eq: 'C152', p1, p2, nb: 1, ss: 1, pr: 3 }` (js/rules.js:82).

### 2.3 Personal data: table `public.dados_pessoais` (all dates; never in the roster, the state, CSV, PDF or BI)

Table (supabase/migrations/20261113150000_dados_pessoais.sql:34-45); local mode: `localStorage` key
`acpm4_dados_pessoais`, an object `{ 'aluno:1000': {…} }` (js/backends/local.js:18, 203-221). In memory: the module
variable `DADOS = { aluno: {}, instrutor: {} }` (js/views/dados-pessoais.js:11), never in `S`.

| Column | UI label (`CAMPOS_PESSOAIS`, js/dados-pessoais.js:5-11) | Rule (client js/dados-pessoais.js:30-36; server check) |
|---|---|---|
| `tipo` | — | `'aluno'` or `'instrutor'` (PK with `id_cadastro`) |
| `id_cadastro` | — | the roster id, > 0 |
| `cpf` | "CPF" | 11 digits with valid check digits (`cpf_valido`); unique per `tipo` (index `dados_pessoais_cpf_unico`, :48) |
| `canac` | "CANAC" | exactly 6 digits; unique per `tipo` (index `dados_pessoais_canac_unico`, :49) |
| `nascimento` | "Nascimento" | date from 1900-01-01 to today (São Paulo) |
| `celular` | "Celular" | `^[1-9]{2}9[0-9]{8}$` (DDD + 9 digits) |
| `email` | "E-mail" | lowercased, up to 254 chars |
| `atualizado_em` | "Atualizado em …" | `clock_timestamp()`; it is the **row version** the save must send back (20261114151953_dados_pessoais_versionados.sql:31, 86-89) |
| `atualizado_por` | "… por …" | the account's name, else its e-mail (same file :30) |

Writer: only `salvar_dados_pessoais` (the drawer's "Salvar"). The call **replaces the five fields at once**: an absent or
empty field becomes NULL, and with all five empty the row is deleted (20261114151953:99-108). The same call inserts the
History entry of the date `p_data`, with the field names only (:110-116). Rows of people who left the roster are deleted
at the next roster save (`salvar_documento`, :164-170; local: `semQuemSaiu`, js/backends/local.js:100-103).

### 2.4 Course results: table `public.resultados_de_missao` (all dates; append-only)

Columns `id, aluno, curso, missao, resultado ('aprovado' | 'reprovado' | 'pendente'), data, voo, registrado_em,
registrado_por` (supabase/migrations/20261114120000_resultados_de_missao.sql:5-15; the `curso` check became the sigla
format in 20261117200000_cursos_e_missoes.sql:630-632). Local: `acpm4_resultados` (js/backends/local.js:19, 225-240).
No update or delete for anyone (20261114120000:22). Writer: `registrar_resultado` (latest definition
20261117200000:635-656). In memory: `S.resultados = { situacao, doDia }`, read with the date (js/storage.js:218-227,
js/actions.js:305): `situacao` is the last record of every (aluno, curso, missao) of **all students**
(`situacao_das_missoes()`, 20261114120000:54-66), `doDia` the records whose `data` is the open date.

### 2.5 Derived, never stored

Progress and next mission (`progressoNoCurso`, `proximasMissoes`, js/progresso.js:87-106), computed from `S.programa`
and `S.resultados.situacao`. It does **not** depend on the open date: a result registered for any date counts at once.

### 2.6 Screen state kept in memory (lost on reload)

| State | Where | Meaning |
|---|---|---|
| `filtros.alu.nome` | js/views/cadastros.js:334 | the search text, applied again after every redraw |
| `mantidos.alu` (Set of ids) | js/views/cadastros.js:335 | students just added or edited stay visible outside the filters until a filter changes |
| `marcados` (Set of course values) | js/views/filtro-dos-cursos.js:26 | the Curso ticks, **one set shared by Alunos and the Demanda** (`usos`, :27) |
| `DADOS` | js/views/dados-pessoais.js:11 | personal data cache, filled once at start (js/main.js:129) and per person when the drawer opens (:73) |
| `leitura = { pedido, atualizadoEm, lida }` | js/views/dados-pessoais.js:52 | the read the drawer's save is based on; without it "Salvar" does nothing (:135) |

### 2.7 Who reads and writes, on the server

`perfil_atual()` returns `operador` for an Administrador (supabase/migrations/20261111122858_contas_e_administracao.sql:5-15).

| Object | Check (quoted) | operador / administrador | secretaria | gestor | painel, no profile |
|---|---|---|---|---|---|
| roster, read (`documentos` policy "perfis da escala leem") | `public.perfil_atual()::text in ('operador', 'gestor', 'secretaria')` (20261113140000_leitura_por_perfil.sql:14) | yes | yes | yes | no |
| roster, write (`salvar_documento`) | `if public.perfil_atual() is distinct from 'operador' then raise exception 'somente operadores podem alterar a escala' using errcode = '42501'` (20261114151953:133-135) | yes | 42501 | 42501 | 42501 |
| `dados_pessoais`, read (policy "operadores e secretaria leem", 20261113150000:67-69) | `le_dados_pessoais()`: `select coalesce(public.perfil_atual()::text in ('operador', 'secretaria'), false)` (20261113150000:62) | yes | **yes** | 0 rows | 0 rows |
| `dados_pessoais`, write (`salvar_dados_pessoais`, both overloads) | `if not public.le_dados_pessoais() then raise exception 'somente operadores e a secretaria alteram dados pessoais' using errcode = '42501'` (20261114151953:36-38 and 20261113150000:88-90) | yes | **yes** | 42501 | 42501 |
| results, read (policy "quem lê a escala lê os resultados"; `situacao_das_missoes`) | `le_a_escala()` (20261114120000:24-26, 61) | yes | yes | yes | no / `[]` |
| results, write (`registrar_resultado`) | `if public.perfil_atual() is distinct from 'operador' then raise exception 'somente operadores registram resultados'` (20261117200000:644-646) | yes | 42501 | 42501 | 42501 |

Direct writes to the three tables are blocked for everyone (RLS with SELECT policies only; `revoke insert, update, delete`
on results). The server never inspects a student inside the roster JSON except to find the person by id
(20261114151953:44-51) and to prune personal data (:164-170).

### 2.8 Who reads and writes, on the screen

| What | Rule | Evidence |
|---|---|---|
| edit the roster (name, weight, course, preferences, add, delete) | `operaEscala(perfil)`: `operador` or `administrador`; everyone else gets `data-role="gestor"` + `readOnly` | js/perfis.js:6; js/sessao.js:171; js/eventos/registro.js:24, 41; js/actions.js:190 |
| see and edit personal data | `veDadosPessoais(perfil)`: `operaEscala(perfil) \|\| perfil === 'secretaria'`; local mode: `!isGestor()` | js/perfis.js:12; js/views/dados-pessoais.js:15 |
| CANAC column and "Dados pessoais" button | class `so-dados`, hidden by `body[data-role="gestor"]:not([data-perfil="secretaria"]) .so-dados` | css/app.css:237 |
| edit controls | class `edit-only`, hidden by `body[data-role="gestor"] .edit-only`; inputs and selects inside `main` are set `disabled` unless they have `.flt-ctrl` | css/app.css:235; js/somente-leitura.js:5-9 |
| the drawer's inputs for the Secretaria | `#painel-dados` is an `aside` outside `main`, so js/somente-leitura.js never disables it; its click and submit listeners do not go through `aoAcionar`; `ApiClient.salvarDadosPessoais` has no `readOnly` guard | index.html:680; js/eventos/cadastros.js:24-44; js/storage.js:303-305 |

## 3. Controls inventory

Row = `tr.cd[data-k="s"][data-id][data-nm][data-curso]` (js/views/cadastros.js:276). "Op/Adm" = Operador and
Administrador in shared mode, and the Operador role in local mode. "all" includes the Gestor and the Secretaria.

| Label | Element (id, data-act, data-f, class) | Handler (function, file:line) | State read and written | Profiles |
|---|---|---|---|---|
| "Buscar aluno…" | `input[type=search].flt-ctrl[data-flt="alu"]`, aria-label "Buscar aluno" (index.html:253) | `input` listener → `filtrar('alu', { nome })` (js/eventos/cadastros.js:60-63; js/views/cadastros.js:367-371) → `aplicarFiltrosDosAlunos` (400-404) | reads each row's `data-nm` (`chaveDeBusca` of the name); writes `filtros.alu.nome`, clears `mantidos.alu`, sets `tr.hidden`, `#alu-contagem` | all |
| "Todos os cursos" / "Curso: PP ou PC" | `button#flt-alu-cur.btn.sec.filtro-botao.flt-ctrl[aria-expanded][aria-controls="flt-alu-cur-painel"]` > `span.filtro-resumo` (index.html:255) | `criarFiltroDosCursos('flt-alu-cur', () => filtrar('alu'))` (js/views/cadastros.js:359); click toggles the panel (js/views/filtro-multiplo.js:81) | `aria-expanded`, panel `hidden`, class `com-marcas` | all |
| panel "Filtrar por curso": "Mostra os alunos de algum dos cursos marcados." + "?"; legend "Cursos"; one checkbox per option | `div#flt-alu-cur-painel.filtro-painel[role=group]` (index.html:256); `input[type=checkbox].flt-ctrl[data-filtro="flt-alu-cur"][data-valor="<sigla>\|sem-curso"]` (js/views/filtro-multiplo.js:48); `[data-dica="filtro-dos-cursos"]` | `change` on the panel (js/views/filtro-multiplo.js:82-89) → `marcasMudaram` (js/views/filtro-dos-cursos.js:33-42) → `filtrar('alu')` and the Demanda's filter | the shared `marcados`; options from `opcoesDoFiltroDosCursos` (js/cursos.js:53-62): active courses, closed "(encerrado)", "(curso desconhecido)", "Sem curso" | all |
| "Limpar" (panel) | `button#flt-alu-cur-limpar.btn.quiet[data-limpar-filtro="flt-alu-cur"]` (js/views/filtro-multiplo.js:36) | panel click (js/views/filtro-multiplo.js:90-94) | clears `marcados` (both tabs) | all |
| Esc, click outside the panel | — | `fecharNoEsc(…, { semFoco: true })` (js/views/filtro-multiplo.js:103; js/dom.js:67-78); document click (js/views/filtro-multiplo.js:97-102) | closes the panel, focus to the button | all |
| "N de M alunos" / "N alunos" | `span#alu-contagem.contagem[role=status]` (index.html:257) | `contar` (js/views/cadastros.js:440-451), 500 ms wait while typing (`ESPERA_DA_DIGITACAO`, :343) | output only | all |
| "+ Novo aluno" | `button.btn.edit-only[data-act="adds"]` (index.html:258) | `aoAcionar('adds', …)` (js/eventos/cadastros.js:84-90) | pushes `{ id: S.nid++, nm: 'Novo aluno', kg: 0, bl: [], extra: [], ...blank() }`; `manterAVista('alu', id)`; History 'Aluno cadastrado: Novo aluno' (`inc`); `rAlu(); rDem(); focusLast('#alu .nm')` | Op/Adm |
| "Os pedidos de cada data ficam na Demanda." "Abrir a Demanda" | `p.h.ir-para-demanda` > `button.btn.quiet[data-go="dem"]` (index.html:260) | click on `[data-t],[data-go]` → `show('dem')`, `focarNoTitulo` (js/eventos/navegacao.js:19-32) | none | Op/Adm, Gestor; hidden for the Secretaria (css/app.css:185) |
| "?" of "Priorizar com" and "Não escalar com" | `button.dica-btn[data-dica="voa-com"]`, `[data-dica="nao-escalar-com"]` (index.html:262) | js/dicas.js | glossary (js/glossario.js:101-102) | all |
| "Nome" | `input.nm[data-f="nm"][maxlength=80]`, aria-label "Nome do aluno" (js/views/cadastros.js:277) | `aoMudarCampo('s', …)`, `f === 'nm'` (js/eventos/cadastros.js:192-195) | `s.nm`; History 'Aluno: <antes> → <depois>'; `atualizarLinhaDoAluno`; `rDem()` | Op/Adm (disabled for the others) |
| "CANAC" | `td.c-canac.so-dados[data-rotulo="CANAC"]`, text only (js/views/cadastros.js:278); `th.so-dados` (index.html:262) | `canacDe('aluno', id)` (js/views/dados-pessoais.js:16); patched by `atualizarColunas()` (:18-21) | reads `DADOS.aluno[id].canac` | Op/Adm, Secretaria; hidden for the Gestor |
| "Peso (kg)" | `input[type=number][data-f="kg"][min=1][max=300][placeholder="sem peso"]`, class `falta` without a weight (js/views/cadastros.js:279) | `f === 'kg'` (js/eventos/cadastros.js:196-200; `pesoDoCampo`, :137) | `s.kg`; History 'Peso <nome>: <kg> kg'; invalid: toast 'O peso vai de 1 a 300 kg.' and the field goes back | Op/Adm |
| "Curso" | `select[data-f="curso"]`, aria-label "Curso de <nome>", drawn `disabled` when `isGestor()` (js/views/cadastros.js:280); options `opcoesDoCurso` (:266-272): "—", the active courses ("PP · Piloto Privado"), the student's own closed or unknown course | `f === 'curso'` (js/eventos/cadastros.js:212-218) | `s.curso` set or deleted; History 'Curso de <nome>: <sigla\|nenhum>'; `rDem()`; the filter options are rebuilt (js/views/cadastros.js:323) | Op/Adm |
| progress line "13/46 · Fase 5 · próxima NAV-01" or "… · concluído" | `small.progresso[data-dica="progresso"]`, after the select (js/views/etapas.js:148-155) | none | reads `S.programa`, `S.resultados.situacao`; empty when `dadoIndisponivel('resultados' \| 'cursos' \| 'cursos-pendentes')` (js/views/etapas.js:26-29) | all, read-only |
| "Priorizar com": tags and ✕ | `div.bl.voa-com` > `span.tg.par` + `button.edit-only[data-act="unvc"][data-b="<insId>"]`, aria-label "Tirar <instrutor> de Priorizar com" (js/views/cadastros.js:257-261) | `aoAcionar('unvc', …)` (js/eventos/cadastros.js:101-109) | `s.voaCom`; History '<nome>: deixa de priorizar <instrutor>' | Op/Adm (the tags show for all) |
| "Priorizar com…" | `select.edit-only[data-f="voaCom"]`, aria-label "Priorizar com"; lists instructors not in `voaCom` and not in `bl` (js/views/cadastros.js:260) | `f === 'voaCom'` (js/eventos/cadastros.js:208-211) | `s.voaCom`; History '<nome>: priorizar com <instrutor>'; focus back on the select (js/views/cadastros.js:320) | Op/Adm |
| "Não escalar com": tags and ✕ | `div.bl.nao-escalar` > `span.tg` + `button.edit-only[data-act="unbl"][data-b]`, aria-label "Voltar a escalar com <instrutor>" (js/views/cadastros.js:250-253) | `aoAcionar('unbl', …)` (js/eventos/cadastros.js:92-99) | `s.bl`; History '<nome>: volta a ser escalado com <instrutor>' | Op/Adm |
| "Não escalar com…" | `select.edit-only[data-f="bl"]`, aria-label "Não escalar com" (js/views/cadastros.js:252) | `f === 'bl'` (js/eventos/cadastros.js:201-207) | `s.bl`, and the id leaves `s.voaCom`; History '<nome>: não escalar com <instrutor>' (`exc`) | Op/Adm |
| "Dados pessoais" | `button.btn.quiet.so-dados[data-dados="aluno:<id>"]`, aria-label "Dados pessoais de <nome>" (js/views/cadastros.js:283) | document click (js/eventos/cadastros.js:24-30) → `abrirPainelDeDados` (js/views/dados-pessoais.js:54-79) | reads `ApiClient.lerDadosPessoais`; writes `DADOS`, `leitura` | Op/Adm, Secretaria |
| "✕" → "Confirmar" | `button.x.edit-only[data-act="dels"]`, aria-label "Excluir <nome>" (js/views/cadastros.js:283) | `aoAcionar(['deli', 'dels'], …)` (js/eventos/cadastros.js:111-132), `confirmado(b, 'Confirmar')`: second click within 3.5 s (js/eventos/confirmacao.js:9, 23-40) | `S.stu = S.stu.filter(…)`; History 'Aluno excluído: <nome>' (`exc`, **no revert**); `rIns(); rAlu(); rDem()` | Op/Adm |
| 'Nenhum aluno cadastrado. Clique em “+ Novo aluno” acima para cadastrar.' | `td[colspan=7].h` (js/views/cadastros.js:290) | — | — | all |
| 'Nenhum aluno com esses filtros.' "Limpar filtros" | `tr.sem-resultado` > `button#limpar-filtros-alu.btn.quiet[data-limpar-filtros="alu"]` (js/views/cadastros.js:428-435) | document click → `limparFiltros('alu')` (js/eventos/cadastros.js:65-68; js/views/cadastros.js:379-386) | clears the search, the shared Curso ticks (in the Demanda too, js/views/filtro-dos-cursos.js:55-58), `mantidos.alu`; focus to the search | all |
| drawer title "Dados pessoais <nome>", "✕" | `aside.gaveta#painel-dados` (`data-tipo`, `data-id`, `data-botao`); `h2#painel-dados-titulo`; `button.x#btn-fechar-dados`, aria-label "Fechar o painel" (js/views/dados-pessoais.js:86-94) | click → `fecharPainelDeDados(true)` (js/eventos/cadastros.js:31) | hides the drawer; focus back to the row's button | who opened it |
| drawer fields "CPF", "CANAC", "Nascimento", "Celular", "E-mail" | `input#dado-cpf`, `#dado-canac`, `#dado-nascimento[type=date]`, `#dado-celular[type=tel]`, `#dado-email[type=email]`, each with `small.erro-campo#erro-<id>[data-erro="<id>"]` (js/views/dados-pessoais.js:36-46) | none until "Salvar" | form values | Op/Adm, Secretaria |
| "Cancelar"; Esc | `button.btn.sec#btn-cancelar-dados` (js/views/dados-pessoais.js:100) | js/eventos/cadastros.js:31, 33-35 (`gavetaDoEsc`, js/dom.js:53-59) | closes without saving | who opened it |
| "Salvar" | `button[type=submit].btn` in `form#form-dados.form-dados[novalidate]` (js/views/dados-pessoais.js:96-101) | document `submit` (js/eventos/cadastros.js:36-44) → `salvarPainelDeDados` (js/views/dados-pessoais.js:127-153) → `ApiClient.salvarDadosPessoais` (js/storage.js:303-305) | the store, `DADOS`, `leitura.atualizadoEm`, the CANAC column; toast "Dados pessoais de <nome> salvos."; the History entry when the date did not change (`mostrarNoHistorico`, js/actions.js:249-252) | Op/Adm, Secretaria |
| drawer messages | `p.erro-campo#dados-erro[role=alert]` | js/views/dados-pessoais.js:62, 68, 142-144 | 'Lendo os dados…'; 'Não foi possível ler os dados pessoais. Feche e tente de novo.'; PT409 'Outra pessoa alterou estes dados enquanto você editava. Feche e abra de novo para ver a versão atual.'; P0002 'Esta pessoa não está no cadastro gravado. Espere a alteração ser gravada e tente de novo.'; otherwise 'Não foi possível salvar. Verifique a conexão e tente de novo.' | — |
| "Atualizado em <data e hora> por <quem>." | `p.h` (js/views/dados-pessoais.js:103) | — | `dados.atualizado_em`, `atualizado_por` | — |

Controls in other screens that write or feed the student record:

| Label | Element | Handler | Effect | Profiles |
|---|---|---|---|---|
| "Aluno (kg)" in "Agendar voo" ("O peso digitado fica no cadastro da pessoa.") | `input#agd-kg-aluno` (index.html:744, 747) | `aplicarAgendamento` (js/agendamento.js:927-932), `confirmarAgendamento` (js/eventos/agendamento.js:34-39) | writes `s.kg`, with its own History line | Op/Adm |
| "Resultado" on a flight row (Escala › Lista) | `select.res-sel[data-resultado="<fKey>"]`, options "Resultado" (pendente), "Aprovado", "Reprovado" (js/views/etapas.js:184; drawn in `td.c-status`, js/views/escala.js:545, 549) | document `change` (js/eventos/escala.js:236-261) | `registrar_resultado`; updates `S.resultados`; `rOut(); rAlu(); rDem()` | Op/Adm |
| "Perfil de acesso" (local mode only) | `select#role-sel` (index.html:69-72; hidden in shared mode, css/app.css:1557) | `onchange` → `setRole`, `rCursos()`, `rOut()` (js/eventos/topo.js:17-21) | `body[data-role]`; does **not** call `rAlu()` or `carregarDadosPessoais()` | local |

## 4. Rules and the tests that pin them

| Rule | Code | Test (file: name) |
|---|---|---|
| The roster keeps of a student only id, name, weight, `bl`, `voaCom`, `curso`; the day has no names or weights | js/dias.js:36-74 | test/unit/dias.test.js: 'o cadastro não tem dados do dia e o dia não tem nomes nem pesos'; 'juntar(separar(estado)) devolve o mesmo estado em 300 cenários e no exemplo'; exact shape `{ id: 1000, nm: 'Aluno 1000', kg: 70, bl: [], curso: 'PC' }` in 'o curso da missão do curso vai e volta com o pedido do dia, fora do cadastro' (:93) |
| A day's request of someone who left the roster is ignored | js/dias.js:96-101 | test/unit/dias.test.js: 'ignora no dia instrutores e alunos que saíram do cadastro' |
| Name up to 80 chars | js/format.js:54-55 | test/unit/format.test.js: 'o nome de uma pessoa: sem espaços a mais e com até 80 caracteres; vazio fica o anterior'; test/e2e/cadastros.spec.js: 'o nome tem até 80 caracteres, nos alunos e nos instrutores' |
| Weight 1 to 300 kg, empty = none | js/rules.js:133-137 | test/e2e/cadastros.spec.js: 'o peso vai até 300 kg, nos alunos e nos instrutores: acima disso, não vale'; test/unit/storage.test.js: 'o peso continua de 0 a 300 kg: acima, zero, negativo ou sem ser um número, a pessoa fica sem peso' |
| The student's course is a sigla checked only in format | js/cursos.js:45; js/storage.js:101-105 | test/unit/cursos.test.js: 'o curso do aluno: a sigla conferida só no formato (um curso fora de PP, PC e INVA também fica)'; test/unit/storage.test.js: 'o curso do aluno: a sigla no formato fica, também a de um curso desconhecido; fora do formato, sai' |
| "Priorizar com" is in the roster, only ids, never one of "Não escalar com" | js/storage.js:151-154; js/eventos/cadastros.js:203-205 | test/unit/instrutor-escolhido.test.js: 'ao abrir, o “Priorizar com” fica só com ids, sem repetir e sem os de “Não escalar com”; o instrutor do pedido, só um id'; 'o “Priorizar com” vai com o cadastro do aluno (só quando há)'; test/e2e/instrutor-escolhido.spec.js: 'Priorizar com (Alunos): o aluno voa com o instrutor dele; quando ele não vem, com outro, e a escala avisa'; 'o “Priorizar com” fica no cadastro: vale também na data seguinte' |
| Add, block an instructor, delete with two clicks; columns of the table | js/eventos/cadastros.js:84-132 | test/e2e/cadastros.spec.js: 'cadastra, bloqueia instrutor e exclui aluno com confirmação'; 'um padrão só: o ✕ armado fica vermelho e diz o que confirma; sem o segundo clique, volta ao que era'; 'o aluno renomeado com o ✕ armado: depois que ele desarma, o nome lido é o novo' |
| Search without accents, kept across redraws; "N de M"; "Limpar filtros"; new or edited row stays visible | js/views/cadastros.js:328-451; js/format.js:60 | test/unit/format.test.js: 'a chave da busca: sem acentos, em minúsculas e com um espaço só entre as palavras'; test/e2e/cadastros.spec.js: 'a busca acha o nome sem acentos e continua depois de cada redesenho: outra data, um instrutor renomeado, o aluno renomeado, + Novo aluno' |
| Curso filter (rule "alguma"), options, shared with the Demanda | js/views/filtro-dos-cursos.js; js/cursos.js:53-62; js/filtro-multiplo.js | test/unit/filtro-multiplo.test.js: '"alguma": passa quem tem pelo menos uma das marcadas (o curso, um só por aluno)'; test/unit/cursos.test.js: 'os ativos na ordem do programa, os encerrados marcados, o curso desconhecido de um aluno e "Sem curso" no fim'; test/e2e/cadastros.spec.js: 'a barra de Alunos é a de Instrutores: …'; 'o filtro dos cursos: os ativos, o encerrado e o desconhecido marcados e "Sem curso"; …'; 'o filtro dos cursos dura aos redesenhos e acompanha os programas e o curso de cada aluno'; '"Abrir a Demanda", embaixo da barra, leva à Demanda com o foco no título; também para o Gestor'; 'o filtro dos cursos é o mesmo em Alunos e na Demanda: "Abrir a Demanda" mostra os pedidos dos alunos marcados' |
| Read-only profiles use the filters | `.flt-ctrl`; no `data-act` / `data-f` / `data-a` in the filter | test/e2e/perfis.spec.js: 'o Gestor busca, filtra pelas habilitações e pelos cursos e troca de vista em Instrutores, Alunos e na Demanda; "Limpar filtros" mostra todos de novo'; 'perfil Gestor oculta a edição e o Operador a restaura' |
| Personal data: validation and formats | js/dados-pessoais.js:13-60 | test/unit/dados-pessoais.test.js (10 tests), e.g. 'os campos: CPF, CANAC, nascimento, celular e e-mail'; 'cada campo inválido tem a sua mensagem' |
| Personal data: save from the version read; only for people in the roster; CPF and CANAC unique per type; all empty deletes | js/dados-pessoais.js:87-113; 20261114151953:13-119 | test/unit/dados-pessoais.test.js: 'outra pessoa gravou antes (a versão lida não é a guardada): recusa com o código do servidor'; 'só quem está no cadastro'; supabase/tests/database/dados-pessoais.test.sql: 'gravar a partir de uma versão antiga é recusado', 'quem não está no cadastro é recusado', 'CPF repetido entre alunos é rejeitado', 'CANAC repetido entre alunos é rejeitado', 'sem nenhum dado, a linha sai'; test/e2e/dados-pessoais.spec.js: 'o CPF ou o CANAC de outro aluno é recusado; deixar tudo vazio apaga os dados'; 'duas pessoas editam a mesma pessoa: a segunda é avisada e não apaga o que a primeira gravou'; 'o painel lê a pessoa ao abrir; sem resposta, não deixa salvar' |
| Personal data stay out of the roster and of the History (field names only) | js/views/dados-pessoais.js:1-3; 20261114151953:92-116 | test/e2e/dados-pessoais.spec.js: 'Alunos: o painel valida e salva; a tabela mostra o CANAC; o histórico registra só os campos'; 'ficam fora do cadastro; no perfil Gestor não aparecem'; pgTAP 'o histórico registra só os nomes dos campos que mudaram'; test/unit/dados-pessoais.test.js: 'o histórico registra só os nomes dos campos que mudaram, nunca os valores' |
| Who leaves the roster takes the personal data along | 20261114151953:164-170; js/backends/local.js:100-103 | pgTAP 'os dados pessoais de quem saiu do cadastro saem junto'; test/unit/dados-pessoais.test.js: 'quem sai do cadastro leva os dados pessoais junto'; test/e2e/dados-pessoais.spec.js: 'excluir um aluno apaga os dados pessoais dele' |
| **The Secretaria reads and writes personal data** | `le_dados_pessoais()`; js/perfis.js:12 | pgTAP (dados-pessoais.test.sql): 'secretaria grava' (:109), 'a alteração da secretaria também vai para o histórico' (:110-111), 'secretaria lê todos os dados pessoais' (:112); test/unit/perfis.test.js: 'dados pessoais: operadores, administradores e a secretaria; a TV da recepção só vê o painel'; test/e2e/dados-pessoais.spec.js: 'a Secretaria vê Alunos e Instrutores e edita só os dados pessoais'; 'a alteração da secretaria vai para o histórico (só os nomes dos campos)'; 'no celular, o cartão de cada pessoa tem o "Dados pessoais" da Secretaria, em Instrutores e em Alunos' |
| The Gestor, the TV, an account without profile and anon do not read or write personal data | RLS; `le_dados_pessoais()` | pgTAP 'gestor não lê dados pessoais', 'gestor não grava dados pessoais', 'conta sem perfil não lê dados pessoais', 'conta sem perfil não grava dados pessoais', 'anônimo não acessa dados pessoais', 'anônimo não executa salvar_dados_pessoais'; painel.test.sql: 'painel não lê os dados pessoais', 'painel não grava dados pessoais'; test/e2e/dados-pessoais.spec.js: 'o operador grava pelo servidor; o gestor não vê os dados pessoais' |
| The legacy 3-argument `salvar_dados_pessoais` still exists | 20261113150000:73-139 (no `drop function` in any migration) | pgTAP 'a versão antiga continua enquanto o app anterior estiver no ar' (dados-pessoais.test.sql:43) |
| The Secretaria reads the roster, the days, the History, the agenda, the courses, and cannot change the schedule | `le_a_escala()` | leitura.test.sql: 'secretaria lê os documentos', 'secretaria lê os dias', 'secretaria lê o histórico', 'secretaria lê a agenda', 'secretaria lê os cursos (…)'; agenda.test.sql: 'a secretaria não altera a escala' |
| Results: append-only, last record wins, "pendente" undoes; only the operator registers; who reads the schedule reads them | 20261114120000; 20261117200000:635-656; js/resultados.js | resultados.test.sql: 'o operador registra um resultado', 'sem o voo também vale', 'pendente desfaz um engano', 'a situação de cada missão é o último registro, com quem registrou', 'ninguém altera', 'ninguém apaga', 'o gestor lê a situação', 'o gestor não registra', 'um curso criado pelo Administrador recebe resultados'; test/unit/resultados.test.js (4 tests) |
| Progress and next mission | js/progresso.js | test/unit/progresso.test.js (34 tests), e.g. 'as aprovadas sobre as que contam (a dispensada não conta), a fase em que o aluno está e a próxima'; 'a reprovada volta a ser a próxima e as seguintes esperam por ela; vale o último resultado'; 'o progresso: as aprovadas sobre as que contam, a fase (quando o curso tem mais de uma) e a próxima'; 'sem os resultados ou os programas, nem Usar, nem outra missão, nem progresso'; 'a data da reprovada é a do registro do aluno no curso, achado sem percorrer os resultados dos outros' |
| Registering a result in the Escala moves the progress shown in Alunos | js/eventos/escala.js:236-261 | test/e2e/cursos.spec.js: 'Usar a próxima missão; registrar o resultado na escala; o progresso e a próxima avançam; o resultado fica gravado'; 'no Gestor, o código e o resultado só aparecem'; 'o operador registra; o servidor guarda com quem registrou; o gestor vê o resultado e o progresso'; 'o resultado registrado antes de trocar de data fica no histórico da data do voo' |
| Phone cards of the roster tables; the drawer's Esc and stacking | css/app.css:1104-1132; js/dom.js:39-59 | test/e2e/celular.spec.js (lines 97-205 use `#alu`); test/e2e/acessibilidade.spec.js: 'o Esc fecha só a camada de cima: com os Dados pessoais abertos, …'; 'o Esc fecha só a gaveta de cima: com o Histórico aberto, os Dados pessoais abertos depois fecham primeiro' |
| Malicious stored text never becomes HTML in Alunos | `esc` everywhere | test/e2e/seguranca.spec.js: 'textos maliciosos nos campos de texto aparecem como texto, em todas as telas' (checks `#alu tr[data-id="1000"] [data-f="nm"]`); 'valores fora do formato gravados no dia, na escala, no histórico e no programa não viram HTML nem quebram a tela' (roster `kg`, `bl`, `curso` tampered) |

E2E spec files that use Alunos selectors (`#alu`, `#s-alu`, `[data-dados]`, `#painel-dados`, `#flt-alu-cur`,
`#alu-contagem`, `adds`, `dels`), with the number of matching lines: cadastros 74, cursos 32, dados-pessoais 26,
abertura 19, acessibilidade 15, demanda 14, celular 10, perfis 10, instrutor-escolhido 10, envio-local 6,
datas-compartilhado 4, noturno 4, seguranca 3, fixtures 3, and seven more with 1 or 2.

## 5. Answers

### 5.1 The student record: every field, where it lives, who reads and writes

Fields and stores: tables 2.1 (roster), 2.3 (personal data), 2.4 (results). Permissions: tables 2.7 and 2.8.

- Roster fields (`id`, `nm`, `kg`, `curso`, `voaCom`, `bl`) are in the roster document; read by Operador, Administrador,
  Gestor and Secretaria; written only by Operador and Administrador (`salvar_documento`).
- Personal data (`cpf`, `canac`, `nascimento`, `celular`, `email`, plus `atualizado_em`, `atualizado_por`) are in
  `dados_pessoais`; read and written by Operador, Administrador **and Secretaria**; the Gestor reads nothing.
- There is no other field: no full name, no status, no notes, no enrolment date, no photo.
- The exact role check of `salvar_dados_pessoais` (both overloads): `if not public.le_dados_pessoais() then raise exception
  'somente operadores e a secretaria alteram dados pessoais' using errcode = '42501'; end if;`, where
  `le_dados_pessoais()` is `select coalesce(public.perfil_atual()::text in ('operador', 'secretaria'), false)`. The same
  function is the `using` clause of the only policy of the table, "operadores e secretaria leem": **read and write share
  one check**.
- pgTAP cases that pin the Secretaria's permission, all in supabase/tests/database/dados-pessoais.test.sql:
  'secretaria grava' (:109), 'a alteração da secretaria também vai para o histórico' (:110-111),
  'secretaria lê todos os dados pessoais' (:112, expects 4 rows, one of them written by her), and the header comment
  (:1-5). `select plan(47)` (:11).
- UI rule: `veDadosPessoais = perfil => operaEscala(perfil) || perfil === 'secretaria'` (js/perfis.js:12); there is no
  separate "may edit" rule, so whoever sees the drawer can save.

### 5.2 How the CANAC reaches the Alunos table; the Gestor

- At the end of the app's start, after the first `rAlu()`, `carregarDadosPessoais()` runs once (js/main.js:126, 129). It
  returns at once unless `podeVerDadosPessoais()` (js/views/dados-pessoais.js:15, 24). Otherwise it calls
  `ApiClient.listarDadosPessoais('aluno')` and `('instrutor')` (:26), fills `DADOS` and patches the cells with
  `atualizarColunas()` (:18-21), which looks for `#alu tr[data-id] .c-canac`.
- Shared mode: it is a **direct table read, not an RPC**: `cliente.from('dados_pessoais').select('id_cadastro, cpf, canac,
  nascimento, celular, email, atualizado_em, atualizado_por').eq('tipo', tipo)` (js/backends/supabase.js:241-246). The
  whole table of that type, with every personal field, goes to the browser to fill one column. The API returns at most
  1,000 rows (`max_rows = 1000`, supabase/config.toml:19) and the query has no paging.
- Later renders use the cache: `canacDe('aluno', s.id)` in `linhaDoAluno` (js/views/cadastros.js:278). The cache of one
  person is refreshed when that person's drawer opens (js/views/dados-pessoais.js:73-75) or saves (:147-150). It is never
  read again otherwise: a CANAC saved by someone else shows after a reload.
- **The Gestor does not get it.** Client: `veDadosPessoais('gestor')` is false, so no request is made, and the column is
  hidden (css/app.css:237). Server: RLS returns no rows (pgTAP 'gestor não lê dados pessoais'). E2E: 'o operador grava
  pelo servidor; o gestor não vê os dados pessoais' expects the `CANAC` header hidden.
- **Is the CANAC personal data for the Gestor? In the code, yes**: it is one of `CAMPOS_PESSOAIS`
  (js/dados-pessoais.js:7), it exists only in `dados_pessoais`, and nothing else carries it (the History records the word
  "CANAC", never the value).
- Today the search matches only the name: `l.dataset.nm.includes(q)` (js/views/cadastros.js:403).
- Local mode, a gap (inferred): with `?role=gestor` the cache is not loaded (js/main.js:123 runs before :129), and
  switching `#role-sel` back to Operador does not load it (js/eventos/topo.js:17-21): the CANAC column shows empty until
  a drawer opens or the page reloads.

### 5.3 The Alunos tab today

Every control is in section 3. Summary of behaviour:

- Columns (index.html:262): "Nome", "CANAC" (`th.so-dados`), "Peso (kg)", "Curso", "Priorizar com", "Não escalar com",
  actions (`th[aria-label="Ações"]`).
- A full redraw is `rAlu()` (js/views/cadastros.js:286-292): it rebuilds the Curso filter options, sets
  `$('#alu').innerHTML` (plain `innerHTML`, not `trocarConteudo`) and applies the filters again. EVERY caller:
  js/main.js:126; js/actions.js:107, 140, 324; js/eventos/registro.js:43; js/eventos/cadastros.js:80, 89, 131, 183;
  js/eventos/escala.js:260; js/eventos/agendamento.js:39; js/eventos/cursos.js:172, 204, 223.
- A field change updates the row in place with `atualizarLinhaDoAluno` (js/views/cadastros.js:297-326), so the inputs
  (and the keyboard focus) are not replaced.
- Every roster change goes through `gravarAlteracao` (js/actions.js:189-195): it reruns the engine for the open date,
  saves the roster document (if changed) and **the open date's day document**, and logs in the History **of the open
  date**. None of the student changes carries a revert action. A change is refused before the date's data are read
  ('A escala ainda não abriu: nada foi mudado. …', js/actions.js:154-158).
- The drawer stays open when the tab changes and stacks with the Histórico and the other drawers (js/dom.js:39-49).
- On phones (up to 640 px) each row is a card laid out by grid areas, with the column name from `data-rotulo`
  (css/app.css:1104-1132).

### 5.4 "Missão anterior" and "missão atual"

What the pure modules give for one student (`curso` = the student's course in `S.programa`, `mapa` =
`situacaoPorMissao(S.resultados.situacao)`):

| Function | Returns | Use |
|---|---|---|
| `progressoNoCurso(curso, mapa, aluno)` (js/progresso.js:99-106) | `{ aprovadas, total, faseAtual, proxima, concluido }`; `proxima` is the first released mission in course order | the Alunos line (`progressoDoAluno`, js/views/etapas.js:148-155) and the Cursos tab (`faseDoAluno`, :160-165) |
| `proximasMissoes(curso, mapa, aluno, { planejadas, exceto, preferencia })` (:87-95) | `{ padrao, candidatas }`: **several missions can be released at once** (test: `['NAV-01', 'PE-04', 'NOT']`) | Demanda "Próxima: … · Usar", "Agendar voo", the agenda import |
| `estadoDoAluno(curso, mapa, aluno, …)` (:18-21) | `porMissao`: for each mission `{ estado, faltam, fasesFechadas, dependeDe }`, `estado` one of `'dispensada'`, `'aprovada'`, `'no-dia'`, `'liberada'`, `'condicional'`, `'bloqueada'`, `'no-noturno'`; and `candidatas` | "Outra missão do curso" |
| `motivoDoBloqueio(curso, m, estado, { mapa, aluno })` (:114-139) | a short reason, e.g. 'falta PE-03 (reprovada em 14/11)' | the out-of-order confirmation |
| `missoesDoDia(curso, aluno, { fStatus, mid })` (:144-149) | the course missions the student already has in the day's requests | chaining missions in one day |
| `situacaoDa`, `registroDa(mapa, aluno, curso, missao)` (js/resultados.js:19-23) | the last result of **one mission** (`'pendente'` without a record) and its record (`data`, `voo`, `registrado_em`, `registrado_por`) | everywhere |
| `resultadoDoVoo(doDia, fKey)` (js/resultados.js:26-29) | the last result registered for a flight of the open date | the select in the Escala |

- **"Missão atual" exists** as `progressoNoCurso(…).proxima` (shown as "próxima <código>"), with two caveats: it can be
  one of several released missions, and a Noturno in legs is offered by its night leg with the transfers in the label
  ("NOT (com TSL-01 e TSL-02)").
- **"Missão anterior" does not exist.** No function returns "the last result of a student". It can be derived from
  `S.resultados.situacao` (the records of the student and the course, the latest by `data`, then `registrado_em`), but
  that list holds only the last record of each mission: a mission whose last record is `'pendente'` hides what came
  before, and nothing reads a student's full history (`resultadosDoDia` reads by date only, js/backends/supabase.js:279-284).
  The test 'a data da reprovada é a do registro do aluno no curso, achado sem percorrer os resultados dos outros'
  forbids walking the whole map per mission, so a per-student index would be new code.
- Nothing is shown when the results or the programs were not read, or when the programs still wait for the one-time
  conversion (`programaParaInferir`, js/views/etapas.js:26-29).
- **Where results are registered today:** only on a flight row of the Escala, view Lista (`#out`), cell `td.c-status`,
  when the flight has a course mission code (`o.etapa`) and a course (`cursoDoResultado(o)`, js/views/etapas.js:170-173).
  Control `select.res-sel[data-resultado="<fKey>"]`; handler js/eventos/escala.js:236-261; `ApiClient.registrarResultado`
  (js/storage.js:309-312, refuses `readOnly` with 42501) → RPC `registrar_resultado(p_aluno, p_curso, p_missao,
  p_resultado, p_data, p_voo)` (js/backends/supabase.js:267-271) or `acpm4_resultados`. The record is `{ aluno:
  o.stuId, curso, missao: o.etapa, resultado, data: DATA, voo: o.fKey }` (:242). It writes one History line, 'Resultado
  de <nome> em <código>: <resultado>', on the flight's date, without saving the day (:253-256). Profiles: Operador and
  Administrador; for the Gestor and the Secretaria the result is text (js/views/etapas.js:181-183).
- **What "editing through registering a result" would mean in a detail pane:**
  - The server already accepts it: `p_voo` may be null (pgTAP 'sem o voo também vale'), any date, no check that the
    student is in the roster or that the code is in the course's program (only the format and that the course exists,
    20261117200000:647-649). The app's validation is `validarRegistro` (js/resultados.js:34-41).
  - There is no edit and no delete. "Changing the missão anterior" = adding a record for that mission (`'reprovado'`, or
    `'pendente'` to undo); "moving the missão atual forward" = adding `'aprovado'` for the current mission.
  - Placing a student in the middle of a course (a transfer, the first load) needs one `'aprovado'` per earlier mission:
    in the PP model, 13 records to reach NAV-01 (test: `[13, fase(5), 'NAV-01']`). There is no batch call; each record is
    one RPC and one History line.
  - A record without `voo` does not show on any flight row (`resultadoDoVoo` matches by `voo`), so a flight of that
    mission would still show "Resultado" while the mission counts as approved.
  - It needs a date for the record and for the History line; today that is always the open date.
  - The server does not check the order of the missions: the pane would have to apply `estadoDoAluno` and ask for
    confirmation, as the Demanda does with "Fora da ordem (pede confirmação)".
  - A mission code with results can no longer be renamed in Cursos (docs/PLAN.md:431), so records made here lock codes.

### 5.5 Inactive students; deleting a student; what an `ativo` flag would gate

- **No notion of an inactive student exists** (no match for `inativ` or `desativ` on people in js, index.html or the
  migrations). The nearest things are per date or per course: "Voa" (`fly`), the request's "Disponibilidade" (`jan`),
  a closed course (`curso.ativo === false`, "(encerrado)"), and `concluido` in the progress, which is derived.
- **Deleting** ("✕" → "Confirmar", js/eventos/cadastros.js:111-132) removes the student from `S.stu` and logs 'Aluno
  excluído: <nome>' without a revert (the History has no kind that brings a student back; kinds in js/reversoes.js:46-114).
  Effects:

| On | What happens | Evidence |
|---|---|---|
| the open date's requests | they disappear with the student: `pedidos` is rebuilt from `S.stu`, and the schedule is recalculated without the flights. Pins, statuses and notes of the student's flight keys stay in the day as orphans (ran) | js/dias.js:59-62; js/actions.js:166-170; the handler removes nothing else (js/eventos/cadastros.js:126-130) |
| other dates | stored days are not touched. When one is opened, `juntar` ignores the orphan request; the stored schedule still shows the flights (name from `o.s`) until the first edit on that date recalculates it (inferred from js/actions.js:309 and js/dias.js:96-101) | test 'ignora no dia instrutores e alunos que saíram do cadastro' |
| pedidos of the agenda (`solicitacoes`) | stay; at import they count as 'de aluno que não está no cadastro (entra depois de cadastrado)'. A student registered again gets a new id, so they never match (inferred) | js/agenda.js:113-115; js/eventos/agenda.js:58 |
| results | stay forever, keyed by the old id; `situacao_das_missoes()` keeps returning them | 20261114120000:22; pgTAP 'ninguém apaga' |
| personal data | deleted by the server at that roster save | 20261114151953:164-170; e2e 'excluir um aluno apaga os dados pessoais dele' |
| History | one `exc` line on the open date; older lines keep the name; a revert of an older booking answers 'O aluno deste voo saiu do cadastro: não há o que desfazer.' | js/reversoes.js:140 |
| BI | past flights stay (the BI reads the stored schedules, js/dias.js:172-180) | — |

- **What a cadastro-level `ativo` would have to gate** (every place that lists or picks students today):

| Place | Today | Evidence |
|---|---|---|
| Agenda / Pedidos form, "Aluno" | every student of `S.stu`, by name | `#ag-aluno`, js/views/agenda.js:198-199 |
| server, `registrar_solicitacao` | no check of the student against the roster | supabase/migrations/20261114230012_agenda_limite_de_locais.sql:5, 52 |
| Demanda rows; "+ Pôr um aluno na demanda…" | one row per student; the datalist has who does not fly; lookup by name | js/views/demanda.js:104-105, 117; js/eventos/demanda.js:37 |
| "Importar da agenda" | by `solicitacao.aluno`; a missing student is skipped | js/agenda.js:114 |
| "Agendar voo", "Aluno" | every student, in three groups | `opcoesDeAluno`, js/agendamento.js:348 |
| engine | every `state.stu` item with `fly` (and `extra[].fly`): it knows nothing but the request | js/engine.js:292-300 |
| Alunos list, count, Curso filter options | every student | js/views/cadastros.js:289; js/views/filtro-dos-cursos.js:22 |
| Cursos tab, "N alunos no PP" and the phase index | every student of the course | js/views/cursos.js:270 |
| BI | no per-student view; `S.stu` is used only by the local "Simular 30 dias" | js/eventos/bi.js:36 |

- Storage facts that constrain the flag: `separar` drops any student key outside its whitelist (ran), so the flag needs
  a line in js/dias.js:47 and, by the repo's pattern for a new roster field (step 22 for `voaCom`, js/migracoes.js:176-182),
  a data-format step with a new number so that an older tab is refused instead of erasing it. The exact roster shape is
  pinned by test/unit/dias.test.js:93, so "absent = active" keeps that test. No SQL is needed to store it.
- The flag must stay **inside `stu[]`**: a student moved out of `stu[]` loses the personal data at the next roster save
  and cannot have them saved (P0002).
- Naming: `ativo` already means "course not closed" (`curso.ativo`), "flight not cancelled" (`ativo(o, fStatus)`,
  js/agendamento.js:43), and the engine says "nenhum instrutor ativo" for an instructor with `on` in the date
  (js/engine.js:747, 938).

### 5.6 The Secretaria today, and what removing her edit rights takes

**On the screen** (shared mode; local mode has no Secretaria):

- Tabs: Escala, Agenda, Instrutores, Alunos, Cursos (css/app.css:184; e2e 'a Secretaria vê Alunos e Instrutores e edita
  só os dados pessoais'). No Demanda, no "Abrir a Demanda", no Histórico button, no share button (css/app.css:185-188).
- Alunos: she searches and filters; name, weight and course are disabled; "+ Novo aluno", "✕" and the two preference
  selects are hidden; she sees the CANAC column, the progress line and the "Dados pessoais" button.
- "Dados pessoais": she opens the drawer for any student or instructor and **saves** the five fields. The History line
  is written by the server in her name (she cannot open the Histórico).
- Instrutores opens for her on "Cadastro" because "o trabalho dela ali são os dados pessoais" (js/views/vistas.js:4-5, 11).

**On the server:** she reads the roster, the days, the History, the agenda, the results and the courses (`le_a_escala()`),
reads every row and column of `dados_pessoais`, writes personal data through either overload of
`salvar_dados_pessoais`, registers and cancels pedidos, and can write nothing else.

**What must change to remove the edit** (reading kept):

| Layer | Change | Where |
|---|---|---|
| SQL | `create or replace` the 5-argument `salvar_dados_pessoais` with the operator check used elsewhere (`if public.perfil_atual() is distinct from 'operador'`) and a new message; keep `security definer`, `set search_path = ''` and the grants | 20261114151953:36-38 |
| SQL | the **3-argument overload** still exists and also lets her write: drop it (the app calls only the 5-argument one, js/backends/supabase.js:258) or change its check too | 20261113150000:73-139 |
| SQL | `le_dados_pessoais()` and the policy stay as they are if she keeps reading; the table comment and the function's comment name the Secretaria | 20261113150000:54-69 |
| pgTAP | 'secretaria grava' becomes a `throws_ok` 42501; 'a alteração da secretaria também vai para o histórico' goes; 'secretaria lê todos os dados pessoais' expects 3 rows, not 4; `has_function … array['text', 'integer', 'jsonb']` becomes `hasnt_function` if the overload is dropped; `plan(47)` and the header change | supabase/tests/database/dados-pessoais.test.sql:1-5, 11, 43, 105-112 |
| fake server | `veDados` serves the read (:330) and the write (:418): split in two; the message at :418; the comment at :152 | test/e2e/supabase-falso.js:152, 268, 330, 418 |
| js/perfis.js | a second rule for editing (for example `operaEscala`), `veDadosPessoais` kept for reading; the comment at :11 | js/perfis.js:11-12; test/unit/perfis.test.js:12-15 |
| view | the drawer has one rule for seeing and editing (js/views/dados-pessoais.js:15, 56); `habilitarPainel(true, '')` enables every input (:77, 81-84); the note 'Só operadores, administradores e a secretaria veem estes dados. …' (:95); "Salvar" (:101) | js/views/dados-pessoais.js |
| storage | `salvarDadosPessoais` has no `readOnly` guard, unlike `registrarResultado` and `salvarCurso` | js/storage.js:292-305, 309-312, 330-333 |
| e2e | 'a Secretaria vê Alunos e Instrutores e edita só os dados pessoais' (asserts her save reached the server); 'a alteração da secretaria vai para o histórico (só os nomes dos campos)'; 'no celular, o cartão de cada pessoa tem o "Dados pessoais" da Secretaria, …'; 'Instrutores abre no Cadastro para a Secretaria e na Disponibilidade do dia para o Operador; …' | test/e2e/dados-pessoais.spec.js:114, 141, 171, 276 |
| texts | Manual: "…em Instrutores … e Alunos, edita os dados pessoais (o resto ela só consulta)…" and "Só operadores, administradores e a secretaria veem esses dados … (também as alterações da secretaria)"; comments in css/app.css:236, 1129-1130, js/dados-pessoais.js:1-3, js/backends/supabase.js:239, index.html:247-248 | index.html:465, 535 |

**Does she keep reading?** The request says only that she "must not edit". In the code, reading is a separate thing only
on the client; on the server it is the same function as the write. A migration that changes only the write check
leaves her reading all five fields of everyone, and the screen (`.so-dados`, `veDadosPessoais`) keeps showing her the
CANAC. Stopping the read too is a different change (`le_dados_pessoais()`, css/app.css:237, js/perfis.js:12 and their
tests). It is a decision for Pedro (section 8).

Rollout fact: migrations go to production before the merge. From then until the new app is published, her "Salvar" in
the app in production fails with 42501 and the drawer shows the generic 'Não foi possível salvar. Verifique a conexão e
tente de novo.' (js/views/dados-pessoais.js:144 has no text for 42501).

### 5.7 Local mode

- Personal data live in `localStorage`, key `acpm4_dados_pessoais`: `{ 'aluno:<id>' | 'instrutor:<id>': { cpf?, canac?,
  nascimento?, celular?, email?, atualizado_em, atualizado_por } }` (js/backends/local.js:18, 203-221). The save uses the
  same pure rule as the server (`gravarDadosPessoais`, js/dados-pessoais.js:87-113), writes the History line in
  `acpm4_historico` on the open date, and `atualizado_por` is null (`ApiClient.autorAtual` is null). Saving the roster
  prunes who left (js/backends/local.js:100-103). Results are in `acpm4_resultados`, the course programs in
  `acpm4_cursos`, the roster in `acpm4_cadastro`.
- A profile there is only the screen role: `#role-sel` (Operador | Gestor) or `?role=gestor` (js/main.js:123). There is no
  Secretaria and no Administrador: the Operador does what the Administrador does (`podeEditarLimites`,
  js/views/cadastros.js:75; README.md:173-174). `podeVerDadosPessoais()` is `!isGestor()`.
- The Gestor role there hides the data on the screen only: they stay in the same `localStorage`, and the select switches
  back. E2E: 'ficam fora do cadastro; no perfil Gestor não aparecem' (it also checks that no other key holds the CPF or
  the CANAC).
- "Enviar os dados deste navegador" sends the old documents (`estado`, `escala`, `historico`, `bi`), never the personal
  data (js/sessao.js:44-63; js/storage.js:359-379).
- Two small traps (inferred): the Curso select drawn while in the Gestor role carries `disabled` in its HTML
  (js/views/cadastros.js:280) and switching back to Operador redraws only Cursos and the Escala, so it stays disabled
  until the next `rAlu()`; and the CANAC cache is not loaded on a role change (5.2).

### 5.8 Focus keeping and filter state: what a master-detail list must keep and can drop

Where the machinery really is:

- `QUEM_E`, `DA_LINHA`, `DO_TIPO`, `LINHA`, `ITEM` and `trocarConteudo` / `trocarElemento` are in **js/dom.js**
  (:171-181, 284-296): after a redraw, the focused element is found again by its own attributes (`QUEM_E`) inside its row
  (`DA_LINHA`: `data-k`, `data-id`, `data-mid`, `data-fkey`, `data-cat`, `data-missao`, `data-fase`, `data-curso`); when
  it vanished, a field of the same kind in the same position (`DO_TIPO`) or the item itself gets a neutral focus. A Tab
  in progress is remembered (`tabEmAndamento`, :192-197).
- `manterRolagens` is in **js/views/cursos.js:425-433** and only restores the sideways scroll of the phase tables of the
  Cursos tab. Alunos does not use it.
- js/views/cadastros.js has none of the three. Alunos keeps the focus by **not redrawing**: in-place row updates
  (`atualizarLinhaDoAluno`), `focusLast('#alu .nm')` after "+ Novo aluno" (js/dom.js:88-91), and the "kept visible" set.
  `rAlu()` itself uses plain `innerHTML`, so a full redraw drops the focus inside `#alu` (after "✕", for instance).
  `seletorDoCampo` (js/views/cadastros.js:137-142) serves only the instructors' day grid.
- `'data-dados'` and `'data-id'` are already in `QUEM_E` (js/dom.js:173); the multi-value filter's checkboxes are found by
  `data-filtro` + `data-valor`.

| Keep | Why | Evidence |
|---|---|---|
| the search text in module state, compared by `chaveDeBusca`, applied again after every redraw | redraws happen on a date change, a result, a renamed instructor | js/views/cadastros.js:334, 400-404 |
| "N de M alunos" as `role="status"`, written after 500 ms while typing | screen readers | js/views/cadastros.js:440-451 |
| the "no item passes" row with "Limpar filtros", kept as the same node while it applies | the focus on the button stays | js/views/cadastros.js:428-435 |
| filter controls with `.flt-ctrl` and without `data-act`, `data-f`, `data-a` | read-only profiles must be able to filter (and now select a row) | js/somente-leitura.js:5-9; js/eventos/registro.js:19-52 |
| the multi-value filter as it is (`criarFiltroMultiplo`), options rebuilt on every redraw, a vanished ticked option dropped | reuse asked by the request | js/views/filtro-multiplo.js:29-117 |
| `trocarConteudo` for the list and the detail, with identity attributes on the row and on its focusable element | a redraw must not drop the focus; a new attribute (a row switch, a "select" button) has to join `QUEM_E` / `DO_TIPO` | js/dom.js:171-178, 224-225 |
| "the item just added or edited does not vanish" | in a master-detail list this becomes "the selected item stays in the list while selected" | `mantidos`, js/views/cadastros.js:335, 374-376 |
| a selection per session (new state) | same pattern as `escolhidas` (js/views/vistas.js:14) and the course in Cursos (js/views/cursos.js:452) | — |

| Can drop | Why |
|---|---|
| `atualizarLinhaDoAluno` and the inputs inside table rows | rows become read-only summaries; editing moves to the detail |
| `atualizarColunas()` and the `#alu`/`#inst` selectors inside js/views/dados-pessoais.js | the CANAC should be drawn by the list from the cache |
| the drawer plumbing for personal data: `abrirGaveta`, `gavetaDoEsc` for `#painel-dados`, `painel.dataset.botao`, the focus return to `[data-dados]` | no drawer |
| `focusLast('#alu .nm')` | the new student opens selected, with the focus on the name in the detail |
| the phone cards by grid areas and `data-rotulo` for `table.cadastro.alunos` | the list row replaces the card |
| "Abrir a Demanda" and the Curso ticks shared with the Demanda | only if the Demanda screen goes away; the sharing lives in `usos` (js/views/filtro-dos-cursos.js:27, 33-42, 55-58) |
| `manterRolagens` | never used by Alunos |

## 6. Conflicts with the request

1. **"nome completo" is not a field.** The request lists it among what the detail "shows and edits". The only name is
   `nm` ("Nome", up to 80 chars), in the roster, used on the schedule, CSV, PDF, History and copied into the agenda.
   Evidence: `CAMPOS_PESSOAIS` (js/dados-pessoais.js:5-11); the table's columns (20261113150000:34-45); the roster
   whitelist (js/dias.js:47); no match for `nome completo`, `nomeCompleto`, `nome_completo` in js, index.html, supabase.
2. **"missão anterior" does not exist**, and "missão atual" can be several missions. Evidence: 5.4;
   js/progresso.js:87-106; the unit test with candidates `['NAV-01', 'PE-04', 'NOT']`.
3. **"editing through registering a result" has no screen outside a scheduled flight.** The only control is the select on
   a flight row of the open date (js/views/etapas.js:176-185; js/eventos/escala.js:236-261). Results are append-only and
   the progress is not tied to the open date.
4. **CANAC on the row and in the search versus "the Gestor … without personal data".** The CANAC is personal data in the
   code and the Gestor cannot read it (5.2). For the Gestor the second line can carry only the course and the search
   only the name, unless the CANAC stops being personal data (a server change).
5. **`salvar_dados_pessoais` is two functions.** The request names one; the 3-argument overload from before 14/11 was
   never dropped and also accepts the Secretaria, and a pgTAP case asserts that it exists
   (dados-pessoais.test.sql:43). Also, the role check is shared with the read policy.
6. **"edited in place" versus how personal data are saved.** The request wants "Label: value" lines edited in place. The
   roster fields already save on change, but personal data are one call that replaces the five fields from a version
   read when the drawer opened, with a conflict message (PT409), and only for a person already in the **saved** roster
   (P0002). A new student's roster save is asynchronous in shared mode, so typing the CANAC right after "+ Novo aluno"
   can hit P0002. Evidence: 20261114151953:44-51, 86-89, 99-108; js/views/dados-pessoais.js:135-144.
7. **"a switch on the list row" for students: nothing to switch.** No flag exists, `separar` would drop a new one (ran),
   and the engine only sees the day's `fly`. Evidence: 5.5.
8. **The brief places `QUEM_E`, `DO_TIPO` and `manterRolagens` in js/views/cadastros.js.** They are in js/dom.js:171-178
   and js/views/cursos.js:425 (5.8). The request's "reuse … the focus keeping" stands; only the location differs.
9. **"applies to all dates" versus how a roster edit is saved.** Every roster change reruns and saves the open date and
   is logged in that date's History (js/actions.js:166-195). The roster document has one version: two operators editing
   two different students conflict, and the second screen is locked ('Outra pessoa alterou a escala enquanto você
   editava. …', js/actions.js:138-145; js/backends/supabase.js:63-68). Personal data use a per-person version instead.
10. **"The Gestor stays … without personal data" in local mode** is true only on the screen: the data are in the same
    browser storage and the role is a select (5.7).

## 7. Implications and options for the redesign (suggestions)

Each item is a suggestion, with its cost and its risk.

1. **One migration for the Secretaria, covering both overloads.** Replace the check of the 5-argument function with the
   operator check, drop the 3-argument one, leave `le_dados_pessoais()` and the policy for the read. *Cost:* one SQL
   file, about 6 pgTAP lines, 2 lines of the fake server, 1 rule in js/perfis.js, 4 e2e tests. *Risk:* the window between
   the production migration and the publish (5.6); forgetting the legacy overload leaves a write path open through the API.
2. **A separate "may edit personal data" rule** (`operaEscala` in shared mode, `!isGestor()` in local mode), with
   `veDadosPessoais` kept for the read. *Cost:* small. *Risk:* two rules to keep in step with SQL; pin both in
   test/unit/perfis.test.js.
3. **CANAC in the list from the cache, never from `S`.** Keep `DADOS` as a small store with `canacDe`, a load and a
   "changed" callback; the row gets the CANAC text and a search key only for who has it; apply the filters again when
   the cache arrives. *Cost:* small. *Risk:* putting the CANAC into `S.stu` would bring personal data next to what the
   exports and the History read. Option: an RPC that returns only `id` and `canac`, so the browser stops receiving every
   CPF to draw a list (*cost:* one function and its pgTAP; *risk:* one more server object; it also removes the
   1,000-row cap).
4. **Personal data as a section of the detail with its own "Salvar"**, not field-by-field saves: read on selection,
   keep the version, show PT409 and P0002 inside the section, disable it until the read answers. *Cost:* medium (the
   drawer's logic moves almost as it is). *Risk:* it is not literally "edited in place"; the alternative (one call per
   field) must still send the five fields and the version on every blur and makes conflicts more frequent.
5. **`ativo` as a roster field, absent = active, inside `stu[]`.** One data-format step (its number given by the plan;
   one step can serve students, instructors and resources), `separar`, the normalisation in js/storage.js:149-156, and
   the gates of 5.5. For a pedido of an inactive student that already exists, let the Processamento stage say why it
   cannot be scheduled rather than delete anything. *Cost:* medium (many readers of `S.stu`). *Risk:* dates already
   approved with that student's flights; the name `ativo` already has three other meanings in the code.
6. **Keep "Excluir" only for mistakes.** Deleting is irreversible, erases personal data and orphans results and
   pedidos. With `ativo` available, "Excluir" could be limited to students with no results and no pedidos, or get a
   History revert. *Cost:* small to medium. *Risk:* a rule the operator may not expect; a revert cannot restore personal
   data the server already deleted.
7. **Missão anterior and atual as read-only lines plus "Registrar resultado" in the pane.** A new pure helper for "the
   last result of the student" in js/resultados.js (indexed once per `situacao` list, as js/views/etapas.js:16-21 does);
   the control picks the mission (default: the current one), the result and the date, sends `voo: null`, applies
   `estadoDoAluno` and asks for confirmation out of order. *Cost:* medium, no SQL. *Risk:* 13 clicks to place a student
   at NAV-01; a batch RPC ("aprovar até aqui") would fix that at the cost of SQL and pgTAP; results without a flight do
   not show in the Escala.
8. **Split the shared modules before the parallel workstreams.** js/views/cadastros.js, js/eventos/cadastros.js and
   js/views/dados-pessoais.js serve Alunos and Instrutores together (shared `filtros`, `mantidos`, `multiplos`,
   `APLICAR`, one `deli`/`dels` handler, one drawer for both types). Workstreams A and C would both own them. Move the
   list machinery (`filtrarLinhas`, `contar`, `nenhumComOsFiltros`, `filtrar`, `limparFiltros`, `manterAVista`) into
   the F2 component first. *Cost:* part of F2. *Risk:* without it A and C collide in three files;
   `nenhumComOsFiltros` is also imported by js/views/demanda.js:18.
9. **The Processamento module can take the student's side from pure functions that exist:** `proximasMissoes`,
   `missoesDoDia`, `estadoDoAluno` (js/progresso.js) and the roster's `bl`, `voaCom`, `kg`, `curso`;
   `importarSolicitacoes` (js/agenda.js:108) already joins a pedido with the program and the progress. *Cost:* none
   here. *Risk:* the progress ignores the open date (2.5).
10. **Tests to rewrite, by size:** test/e2e/cadastros.spec.js (the two Alunos describes and "Confirmação"),
    dados-pessoais.spec.js (all 12), the `#alu` parts of celular, acessibilidade, perfis, cursos (the `.progresso`
    assertions) and abertura. *Cost:* high, mostly selectors. *Risk:* the phone and 320 px loops
    (`percorrerVistasEFiltros`, test/e2e/fixtures.js:143-148) use `[data-flt="alu"]` and the "no item" row.
11. **Texts that name the tab:** the glossary entries carry `aba: 'Alunos'` (js/glossario.js:101-104); the Manual
    section "Alunos" (index.html:531-535) and the profile list (index.html:462-466). *Cost:* small. *Risk:* none.
12. **`npm run lint` also runs scripts/exportacoes-sem-uso.mjs** (package.json): removing the drawer and the row
    updates leaves exports without use that the lint reports. *Cost:* none if deletions are complete.

## 8. Open questions for Pedro

1. Does the Secretaria keep **reading** personal data (all five fields, only the CANAC, or nothing)? Today she reads all
   of them on the server.
2. The Gestor's list: only the course on the second line and search by name only, or should the CANAC stop being
   personal data for him?
3. "Nome completo": a new field (in personal data, hidden from the Gestor and out of the exports; or in the roster), or
   is it today's "Nome"?
4. "Missão anterior": the last mission with a result (by flight date), or the mission before the current one in the
   program's order? And "missão atual" when several are released at once: the first, or all?
5. May a result be registered from the student's detail without a flight? With which date (today, the open date, a
   typed one)? Out of order with a confirmation, or refused?
6. How should a student who arrives in the middle of a course be placed (one result per mission, or an "aprovar até
   aqui" action)?
7. With deactivation, does "Excluir" stay? If it stays, for whom (only students without results and pedidos)?
8. What happens to the pedidos an inactive student already has on coming dates, and may an inactive student be picked
   in Pedidos with a warning?
9. Are the personal data of an inactive student kept without limit?
10. May the legacy 3-argument `salvar_dados_pessoais` be dropped in the same migration?
11. Is the window in which the Secretaria's "Salvar" fails in the published app (after the production migration, before
    the publish) acceptable?
12. Cadastro edits are logged in the History of whatever date is open: keep that?
13. In local mode, does the detail keep "the Operador does everything" (no Secretaria and no Administrador there)?
14. If the Demanda screen goes away, do the Curso ticks stay shared with the Processamento screen?

<!-- fim -->
