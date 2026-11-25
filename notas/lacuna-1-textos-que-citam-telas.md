# Lacuna: user-facing texts that name a screen, tab or view (outside the Manual and the glossary)

Read at the worktree `wt-plano` (48875e3). Paths are relative to the worktree root. Texts are quoted as in the code.
"Ran" means the pure module was executed with `node -e`; "(inferred)" marks what no line proves.

What counts as "renamed or removed" here, from the request: the tab **Agenda** becomes **Pedidos** (pedido.md:27-28);
the tab **Demanda** becomes the derived stage **Processamento** and "Importar da agenda" disappears (pedido.md:29,
32-36); the nine **abas** become four stages plus cadastros (pedido.md:9, 94-100); **Instrutores** is called **INVAs**
(pedido.md:64); the views **Disponibilidade do dia | Cadastro** may go (pedido.md:115); **Janelas de operação** is
removed (pedido.md:62); the header date ("no topo") moves to the right rail (pedido.md:90); the drawers give way to a
detail pane (pedido.md:56); approval and the exports leave the Escala toolbar (pedido.md:52-53).

## Answer

### 0. Totals

- **js/, outside `js/glossario.js` and `js/manual.js`: 30 lines in 12 files** hold a user-facing literal that names a
  tab or a view the redesign renames or removes (31 lines in 13 files counting the History prefix "Rodízio ·", a tab
  that stays). By word: "Demanda"/"demanda" 18 lines in 10 files; "Agenda"/"agenda" 8 lines in 3 files (2 lines carry
  both); other tabs and views 6 lines in 5 files. Three more lines show the same phrase without holding the literal
  (they embed `codigoNaDemanda`). The lists are in sections 1 to 3.
- Of those 30: **3 are in the pure engine** (section 1), **6 are History descriptions** (section 2.1), 1 goes to the
  PDF header (js/export.js:54), 20 are screen-only (section 3).
- **index.html outside `#s-manual` (lines 429-649): 20 lines** (section 4).
- **SQL: 2 distinct error messages** name the Agenda, in 4 `raise exception` statements, 3 of them in function bodies
  that are live; **no screen shows them** (section 5).
- "no topo" appears in **one** user-facing text outside the Manual and the glossary: index.html:165.
- Nothing in the code parses a History description, and nothing reads a screen name out of an alert. The two places
  that read prose at all are `motivoDaSaida`, which strips the prefix "Rejeitado: " (js/agendamento.js:1033), and
  js/eventos/cursos.js:144, which reads "missão (\S+) já tem resultados" out of a server message. So every rename
  below is text-only for the app; the cost is in stored data, goldens and tests.

### 1. The pure engine: three texts, and where each one travels

| Line | Kind and code | Text (the part that names a screen in bold) | When |
|---|---|---|---|
| js/engine.js:932 | `err`, `so-parafuso` | "Rejeitado: não há na frota um C152 marcado como “Só Parafuso” **(aba Recursos)**." | a Parafuso request on the C152 and no C152 in the fleet has `soParafuso` (ran: the engine returned exactly this string) |
| js/engine.js:961 | `err`, `habilitacao-do-aviao` | "Rejeitado: os <tipo> livres exigem a habilitação própria deles, e nenhum instrutor livre a tem **(marque em Instrutores › Cadastro)**." (with a chosen instructor: "…e <nome> não a tem (marque em Instrutores › Cadastro).") | the request found no place and the most frequent cause over the possible times was `aviaoProprio`: a free aircraft that requires its own habilitação (js/engine.js:946, 961) |
| js/engine.js:994 | `warn`, `escolhido-saiu` | "O instrutor escolhido saiu do cadastro: o voo ficou com <INVA>. **Escolha outro na Demanda** ou deixe no Automático." | the request's chosen instructor is no longer in the roster (ran) |

Where an alert text `m` goes once the engine returns it (all three follow the same path):

1. **The Escala boxes**: the red box of rejections and the amber box of warnings print `a.m` (`item`,
   js/views/escala.js:458, 467-468, 476); conflicts too (js/views/escala.js:472-475).
2. **Stored data, per date**: every save writes the engine output as `resultado` of the day document
   (`salvarDia`, js/storage.js:229-241, called by `save`, js/actions.js:166-169). On opening a date the app shows the
   **stored** schedule, not a fresh one (`setRES(escala || escalaCalculada())`, js/actions.js:309; the stored one is
   accepted by `normalizarEscalaGravada`, js/storage.js:205, with `m` any text up to 1,000 characters,
   js/escala-gravada.js:88). It is recomputed only when an operator changes that date (`refazerEscala`,
   js/actions.js:370-371, from `save`, :168). So a date saved before a rename keeps showing the old screen names, to
   every profile, until someone with write access changes something on it. Whoever only consults never saves
   (js/actions.js:167; js/storage.js:230).
3. **The CSV**: a block "Alertas;Aluno;Mensagem" with `a.m` for every alert (js/csv.js:59-63).
4. **The PDF**: the table "Alertas e pendências" with `a.m` (js/export.js:87). The PDF leaves the app on paper.
5. **The booking dialog**: the rejection text of a flight that would leave the schedule, minus "Rejeitado: ", inside
   "Agendar aqui tira da escala: <voo> (<motivo>)" and the preview line "Sai: <voo> (<motivo>)"
   (js/agendamento.js:1031-1034, 1050, 1177). Not written to the History: the entry keeps only the short `resumo`
   (js/agendamento.js:1178, 1263-1264).
6. **Not** the Excel sheet, the BI, the Painel or the TV: none of them reads `al` texts (js/planilha.js has no `al`;
   the BI counts rejections only, js/dias.js:178; js/quadro.js and js/painel.js read `out`).

Goldens and tests:

- **`test/fixtures/goldens-do-motor/cenario-06.json:24-30`: 7 alerts** end with "(marque em Instrutores › Cadastro)."
  (students "Aluno 06", "Aluno 08 (Multimotor)", "Aluno 13", "Aluno 02", "Aluno 12", "Aluno 16", "Aluno 17", all on
  the PA-34). It is the only golden file with a screen name: "aba Recursos", "Demanda" and "agenda" appear in none of
  the 42 files (grep). The golden test compares the whole output, texts included (`assert.deepEqual`,
  test/unit/engine.golden.test.js:15, 22).
- js/engine.js:994 is pinned word for word by test/unit/instrutor-escolhido.test.js:73; its first sentence by
  test/e2e/instrutor-escolhido.spec.js:179 (`toContainText`, so the second sentence can change there).
- js/engine.js:961 is pinned up to "…nenhum instrutor livre a tem" by test/unit/atributos.test.js:120 (a regular
  expression) and test/e2e/atributos.spec.js:44 (`toContainText`): neither pins the parenthesis.
- js/engine.js:932 is pinned by **no test and no golden** (grep of "não há na frota" in `test/`: nothing).
- `js/conflitos.js:71-77` keeps `CODIGOS_DE_REJEICAO` "para dizer onde resolver", and no view uses the codes to point
  at a screen (mapa-escala 5.1): the only "where to fix it" the operator gets today is the prose inside these three
  texts.

Other engine texts do not name a screen but name something the redesign removes or renames; they are in section 6.

### 2. Texts written into stored data

**2.1 History descriptions that name a tab** (`historico.descricao`, 1 to 500 characters,
supabase/migrations/20261110201618_dias_e_historico.sql:70; in local mode `localStorage['acpm4_historico']`, the last
1,000 entries, js/backends/local.js:16, 125-130). All are written through `gravarAlteracao`.

| Written at | tipo | Text as stored | Names | Revert | Pinned by |
|---|---|---|---|---|---|
| js/eventos/agenda.js:54-55 | `inc` | "Agenda: <aluno> incluído (<missão> · <disponibilidade>[ · <horas>])", one entry per imported pedido | the Agenda, and the import | none | test/e2e/agenda.spec.js:191 |
| js/eventos/demanda.js:42 | `inc` | "<aluno> incluído na demanda" | Demanda | `setFly` | test/e2e/demanda.spec.js:35 |
| js/eventos/demanda.js:84-85 | `exc` | "Demanda limpa[ e escala reaberta][ (1 voo em andamento fica)\|(N voos em andamento ficam)]" (also the toast, :88) | Demanda | none | test/e2e/demanda.spec.js:118-119, 587, 614 |
| js/eventos/demanda.js:115 ("Usar") | `inc` | "<aluno>: <código> na demanda (<missão> · <recurso> · <duração>)[, com o curso <sigla> encerrado][ (deixa de ser fixo)]" | Demanda | none | test/e2e/cursos-no-dia.spec.js:188; test/e2e/demanda.spec.js:544; test/e2e/abertura.spec.js:575, 590 |
| js/eventos/demanda.js:129 ("Outra missão…", a liberada) | `inc` | "<aluno>: <código> na demanda (<missão> · <recurso> · <duração>)[ (deixa de ser fixo)]" | Demanda | none | test/e2e/cursos-no-dia.spec.js:90, 133, 145 |
| js/eventos/demanda.js:149 (the armed button: fora da ordem, or a liberada of a closed course) | `inc` | "<aluno>: <código> na demanda, fora da ordem (<motivo>)" or "<aluno>: <código> na demanda (<missão> · <recurso> · <duração>)", then "[, com o curso <sigla> encerrado][ (deixa de ser fixo)]" | Demanda | none | test/e2e/cursos-no-dia.spec.js:118, 202, 210 |

Other History texts that carry a name of this area without naming a tab that changes:

- "Rodízio · <categoria>: <instrutor> passou para Nº" (js/eventos/rodizio.js:18; pinned by test/e2e/rodizio.spec.js:25
  and test/e2e/abertura.spec.js:656). The tab stays; the prefix is its name.
- "Janela <HH:MM> ativa|inativa" (js/eventos/recursos.js:118; test/e2e/cadastros.spec.js:52): the control is removed
  with Janelas de operação.
- "Horários de decolagem do <categoria>: Janelas do dia" when the list equals the nine windows
  (js/eventos/recursos.js:212 with `descreverHorarios`, js/horarios.js:121-124; the label is pinned by
  test/unit/horarios.test.js:198 and test/e2e/cadastros.spec.js:245, 319, 385).
- "Compactação: buracos|horários <rótulo> → <rótulo>" with the option labels of js/criterios.js:4-11 ("INVA", "Avião",
  "Maior buraco", "Na disponibilidade", "Só 1ª e 2ª", "Não mudar") (js/eventos/escala.js:228-230; pinned by
  test/e2e/compactacao.spec.js:29 "Compactação: horários Na disponibilidade → Não mudar"). The request renames "Avião"
  and "Não mudar" (pedido.md:49-50).
- "Pedido <aluno>: …" (js/eventos/demanda.js:208, 228, 265): "pedido" here is the Demanda's request (section 6).
- "<reg>: Habilitação própria marcado|desmarcado" (js/eventos/recursos.js:85 with `ATRIBUTOS_DO_RECURSO`,
  js/frota.js:23-27; test/e2e/atributos.spec.js:33 pins the "Só VFR" variant). The request may turn this flag into a
  list (pedido.md:61).
- "Agendado na escala[ aprovada]: …" (js/agendamento.js:1261), "Escala aprovada: N voos fixados"
  (js/eventos/escala.js:206), "Tirado da escala: …" (js/eventos/demanda.js:189): "escala" is the schedule, not the tab.
- Written by the server, not by the app: "Dados pessoais de <nome> atualizados: <campos>"
  (supabase/migrations/20261114151953_dados_pessoais_versionados.sql:111-113; the local mirror js/dados-pessoais.js:111).
  It names no tab.

**2.2 The History cannot be rewritten.** "Só cresce: ninguém altera nem apaga entradas"
(supabase/migrations/20261110201618_dias_e_historico.sql:63); the table has a read policy only (:81;
20261113140000_leitura_por_perfil.sql:29-30) and is written only by `registrar_historico`, `importar_historico`
(:75) and `salvar_dados_pessoais` (20261114151953_dados_pessoais_versionados.sql:112). Rows written before a rename
keep "Agenda:", "na demanda", "Demanda limpa", "Janela … inativa". Only local mode can drop them: "Limpar o histórico
desta data" (index.html:674; js/eventos/historico.js:37-43).

**2.3 Reverting copies the old text into a new row.** Five revert kinds write "Revertido: " followed by the reverted
entry's own description (js/eventos/historico.js:71, 88, 94, 105, 120: `setAtributo`, `restaurarFixos`,
`restaurarEscolha`, `restaurarHorarios`, `desfazerAgendamento`). None of the six tab-naming descriptions of 2.1 has one
of those kinds (the only one with a revert is `setFly`, whose revert text is "Revertido: <aluno> (<missão>)",
js/eventos/historico.js:59), so no old tab name is copied this way; "Janelas do dia" (a `restaurarHorarios` entry) and
"Pedido <aluno>: instrutor …" (`restaurarEscolha`) are.

**2.4 The saved schedule** (section 1, item 2): `dias.conteudo.resultado.al[].m` holds the three engine texts for every
date saved while they were produced, and `resultado.out[].conflito[]` holds the row conflict texts (each up to 200
characters, js/escala-gravada.js:65). A data-format step could rewrite the day document: step 5 already rewrote values
inside a stored `resultado.out` (the simulator registrations, js/migracoes.js:43-54). No step has ever rewritten prose.

**2.5 Other stored text**: the course-change descriptions (`versoes_dos_cursos.descricao`) name no tab; one says
"Programa trazido do cadastro (N missões)" (supabase/migrations/20261117200000_cursos_e_missoes.sql:615-617;
js/programa.js:506), where "cadastro" is the roster document. In `solicitacoes` the app writes the student's name, the
mission, the time and what the person typed (js/eventos/agenda.js:99-102): no screen name.

**2.6 Exported files** carry a screen word in one fixed place: the PDF's second header line "Missões na demanda: N
Atendidas: N     Horas escaladas: …     Alertas: N" (js/export.js:54). No test pins it: test/e2e/escala.spec.js:72-73
checks other fragments of the PDF ("Escala de Voo - ACPM", "Data da escala: 11/11/2026", "Quadro por instrutor"…). The
Escala summary already says "missões pedidas" for the same number (js/views/escala.js:462; snapshot
test/e2e/__snapshots__/escala.spec.js/exclusao-resumo.json:2).

### 3. Screen-only texts in js/ (toasts, labels, tooltips, empty states)

| Line | Where it shows | Text | Pinned by |
|---|---|---|---|
| js/views/escala.js:597 | Escala, no flights | "Nenhum voo nesta data. Marque quem vai voar na aba Demanda: a escala é montada automaticamente." (the same sentence is static in index.html:373) | test/e2e/agendamento-mapa.spec.js:172 |
| js/views/escala.js:624 | Escala, nothing requested | "Nenhuma missão marcada na Demanda." | none |
| js/views/demanda.js:112 | Demanda, empty roster | "Nenhum aluno cadastrado. Cadastre os alunos na aba Alunos." | none |
| js/eventos/demanda.js:38 | toast | "Aluno não encontrado. Cadastre-o na aba Alunos." | none |
| js/eventos/demanda.js:40 | toast | "<aluno> já está na demanda." | none |
| js/reversoes.js:141 | toast on "↶ Desfazer" | "O pedido deste voo saiu da Demanda: não há o que desfazer." | test/unit/reversoes.test.js:328; test/e2e/historico.spec.js:222 |
| js/reversoes.js:142 | toast on "↶ Desfazer" | "O pedido mudou depois do agendamento: desfazer agora mexeria em outro voo. Mude o pedido na Demanda." | test/unit/agendamento.test.js:539, 865 |
| js/agendamento.js:347 | booking dialog, group label of the Aluno list | "Na demanda de amanhã" (also "de hoje", "de 11/11", "do dia") | test/unit/agendamento.test.js:157, 186, 190, 194; test/e2e/agendamento.spec.js:395 |
| js/views/cursos.js:72 | Cursos (builder of the phrase) | "na Demanda de amanhã (Maria e João)" | through the three lines below |
| js/views/cursos.js:85 (used at :156 as `title` and `aria-label` of the padlock) | Cursos, code field | "Este código está na Demanda de amanhã (…): ele não muda enquanto um pedido o leva (o nome muda)" | test/e2e/cursos.spec.js:1032 |
| js/eventos/cursos.js:396 | toast | "O código X está na Demanda de amanhã (…): ele não muda enquanto um pedido o leva (o nome muda)." | test/e2e/cursos.spec.js:1048 |
| js/eventos/cursos.js:402 | toast | "O código X está na Demanda de amanhã (…): ele não vai para outra missão (o resultado do voo passaria para ela)." | test/e2e/cursos.spec.js:1066 |
| js/eventos/cursos.js:554 | toast | "<sigla> encerrado: ele sai da lista dos cursos em Alunos; quem já está nele continua." | test/e2e/cursos.spec.js:1327 |
| js/views/selos.js:30 | `title` of `#selo-rec` | "N avião parado ou perto da revisão de 50 horas (Recursos › Disponibilidade do dia)" | test/e2e/selos.spec.js:35 |
| js/views/selos.js:54 | `title` of `#selo-age` | "1 pedido da agenda ainda não está na demanda" / "N pedidos da agenda ainda não estão na demanda" | none (the test checks the number only, test/e2e/selos.spec.js:55) |
| js/views/selos.js:58 | text of `#importar-agenda` | "Importar N pedido(s) da agenda" / "Importar da agenda" | test/e2e/selos.spec.js:58, 62 |
| js/views/agenda.js:71 | Agenda, `#ag-erro` | "Não foi possível carregar a agenda. Verifique a conexão." | none |
| js/views/agenda.js:148 | Agenda list, Situação | "Na demanda" / "Ainda não importado" | test/e2e/agenda.spec.js:158, 162, 173; test/e2e/agenda-compartilhado.spec.js:65 |
| js/views/agenda.js:194 | Agenda, `#agenda-importar` | "Importar N pedido(s) para a demanda" | test/e2e/agenda.spec.js:160, 174 |
| js/eventos/agenda.js:38 | toast | "Não foi possível ler a agenda. Verifique a conexão e tente de novo." | none |
| js/eventos/agenda.js:43 | toast | "A data mudou durante a importação da agenda: nada foi importado. Importe de novo na data certa." | test/e2e/agenda-compartilhado.spec.js:118 |
| js/eventos/agenda.js:50 | toast | "Nenhum pedido novo na agenda para DD/MM." | test/e2e/agenda.spec.js:194 |
| js/eventos/agenda.js:57-58 | toast | "N pedido(s) da agenda na demanda[ · N de aluno que não está no cadastro (entra depois de cadastrado)]." | none |

The glossary's own sentences reach these screens too, as tooltips (the same string goes to the balloon and to the
Manual, mapa-testes-e-docs 5.5), so "outside the glossary" is true of the source file, not of what the operator sees.

Checked and clean (no text naming a tab or view that changes): `painel.html` and js/painel.js (they say "Painel");
css/app.css (one generated text, "Instr. ", css/app.css:551); the Edge Function `supabase/functions/meteorologia/`;
`supabase/templates/troca-de-email.html`; `scripts/`; js/planilha.js (its `aba` is the sheet name, js/planilha.js:251);
js/views/bi.js ("Recursos disponíveis" is the noun, js/views/bi.js:127); the e2e snapshots (grep).

### 4. index.html outside the Manual

| Line | Text | Changes with |
|---|---|---|
| 91 | `<nav id="nav" aria-label="Abas">` | the navigation |
| 93, 94, 97 | tab labels "Demanda", "Agenda", "Instrutores" (the nine labels are 92-102; pinned by test/e2e/app.spec.js:10; the Secretaria's five by test/e2e/agenda-compartilhado.spec.js:74 and test/e2e/dados-pessoais.spec.js:116) | the stages and the cadastros |
| 153-154, 218-219 | view buttons "Disponibilidade do dia", "Cadastro" under `aria-label="O que ver"` (152, 217), in Recursos and in Instrutores (test/e2e/cadastros.spec.js:183) | the split of views |
| 165 | "Nesta data <small>valem para a data aberta no topo; a data seguinte começa com eles</small>" (test/e2e/cadastros.spec.js:186 pins "Nesta data" only) | the date control |
| 167 | `<h4>Janelas de operação</h4>` | Janelas removed |
| 207 | "Os horários em que um voo pode sair, por categoria, dentro das janelas de operação abertas. O voo noturno sai às 17:30." | Janelas removed |
| 234 | "Clique numa janela para mudar a disponibilidade desta data." (test/e2e/cadastros.spec.js:1002) | availability ranges |
| 260 | "Os pedidos de cada data ficam na Demanda." and the button "Abrir a Demanda" (test/e2e/cadastros.spec.js:1489; test/e2e/app.spec.js:76) | Demanda; and "pedidos" will mean the Pedidos stage |
| 275 | `<h2>Agenda de Solicitações</h2>` | Pedidos |
| 300 | `<h2>Demanda</h2>` | Processamento |
| 302 | button "Importar da agenda", `title` "Traz os pedidos da agenda da secretaria para esta data (só acrescenta; não repete)" | the import |
| 303 | placeholder "+ Pôr um aluno na demanda…", `aria-label` "Pôr um aluno na demanda" | Demanda |
| 307 | placeholder "Buscar na demanda…", `aria-label` "Filtrar aluno na demanda" | Demanda |
| 317 | menu item "Limpar demanda" | Demanda |
| 373 | "Nenhum voo nesta data. Marque quem vai voar na aba Demanda: a escala é montada automaticamente." | Demanda; "aba" |

That is 20 lines. Lines that name a tab that keeps its name: `<h2>` "Recursos" (150), "Alunos" (250), "Cursos" (269),
"Rodízio" (379), "BI" (653), "Escala do dia" (345), "Histórico" (669). The link "Como funciona o rodízio" (380) targets
the anchor `#manual-aba-rodizio` (index.html:543; test/e2e/rodizio.spec.js:46-48): an id with "aba" in it, not shown
(the click is intercepted, js/eventos/navegacao.js:57-63).

### 5. SQL error messages

- **Two messages name the Agenda**: 'somente a secretaria e os operadores registram pedidos na agenda'
  (supabase/migrations/20261110222506_agenda_de_solicitacoes.sql:62; 20261114222031_agenda_com_duracao.sql:26;
  20261114230012_agenda_limite_de_locais.sql:20) and 'somente a secretaria e os operadores cancelam pedidos da agenda'
  (20261110222506_agenda_de_solicitacoes.sql:95). Live bodies: the old 9-argument `registrar_solicitacao`
  (20261110222506:47), the 10-argument one as replaced by 20261114230012:4, and `cancelar_solicitacao`
  (20261110222506:87); 20261114222031:26 was superseded by the `create or replace` of 20261114230012.
- **No screen shows them.** The Agenda maps the error **code** to its own sentence (`PT403`, `42501`, `23514`, `22023`,
  `PT422`, js/eventos/agenda.js:104-111) and uses a fixed sentence for a failed cancel (:150). The backend does pass
  the message along (js/backends/supabase.js:223, 229), unused.
- **No test pins their wording**: every pgTAP `throws_ok` of the Agenda gives `null` as the message
  (supabase/tests/database/agenda.test.sql:41-58, 69-70; agenda-horas.test.sql:29-36; agenda-locais.test.sql:19-20),
  and the fake server has its own ('sem permissão na agenda', test/e2e/supabase-falso.js:370).
- The local mirror's messages name no screen (js/backends/local.js:162-190).
- Also not user-facing: `comment on table public.solicitacoes is 'Agenda de solicitações de voo. …'`
  (20261110222506:25).
- **Server messages that do reach the user**, none of which names a screen: a definitive refusal of a save prints the
  message in the banner, "O servidor recusou a última alteração (<mensagem>)…" (js/actions.js:114-118; code 42501 is
  replaced by "a sua conta não tem permissão"); the Cursos tab prints the message for codes 22023, 23505, 23514 and
  P0002 (js/eventos/cursos.js:147); the personal-data form prints it under the field named in `hint`
  (js/views/dados-pessoais.js:141). The words in them that the redesign touches are permissions, not screens:
  'somente operadores e a secretaria alteram dados pessoais'
  (20261114151953_dados_pessoais_versionados.sql:37; never shown: without a `hint` the form falls to "Não foi possível
  salvar. Verifique a conexão e tente de novo.", js/views/dados-pessoais.js:144).

### 6. Texts that name no screen but name something the redesign removes or renames

- **Janelas de operação**: the History "Janela <HH:MM> ativa|inativa" (js/eventos/recursos.js:118); the tip "A janela
  das <HH:MM> está fechada nesta data." and the screen-reader text "(janela fechada nesta data)" (js/views/horarios.js:47;
  test/e2e/cadastros.spec.js:261); the preset "Janelas do dia" (js/horarios.js:124; js/views/horarios.js:24); the
  engine's conflict text 'o horário está fechado nesta data' (js/engine.js:446, code `horario-fechado`, stored on the
  row; test/unit/fixos.test.js:135) and the rejections "nenhum período aberto comporta 01h30 de Ground…"
  (js/engine.js:753) and "nenhum horário aberto…" (js/engine.js:940, 943-944), where "aberto" is the open window (the
  starts are filtered by `state.win`, js/engine.js:811). "horário aberto" is in **15 golden alerts in 11 files** (grep).
- **Criteria labels**: js/criterios.js:4-11, shown at js/views/escala.js:405-407 under the group names "Buracos" and
  "Horários", and written to the History (section 2.1).
- **Drawers**: `aria-label="Fechar o painel"` (js/views/dados-pessoais.js:93; js/views/cadastros.js:189); "Só
  operadores, administradores e a secretaria veem estes dados. Eles não vão para a escala, o CSV, o PDF nem o link
  compartilhado." (js/views/dados-pessoais.js:95), which also states today's permission.
- **Position words**: "Clique em “+ Novo instrutor” acima para cadastrar." (js/views/cadastros.js:76), "Clique em
  “+ Novo aluno” acima…" (js/views/cadastros.js:290); 'clique em "Tentar de novo" no aviso' (js/reversoes.js:145).
- **Controls that move to Aprovar**: "…e Aprovar escala fica desligado." (js/actions.js:71); the button "Aprovar
  escala" (js/views/escala.js:390).
- **The word "pedido"**: on screen it already means the Demanda's request in the History "Pedido <aluno>: …"
  (js/eventos/demanda.js:208, 228, 265), in js/reversoes.js:141-142, in the engine's stored texts ("o pedido passou de
  voo para Ground", "a missão ou o avião do pedido mudou", "a duração do pedido mudou", js/engine.js:433, 436, 449;
  "(o pedido está no <tipo>)", js/engine.js:790; "(ocupados por pedidos de prioridade maior)", js/engine.js:953), in
  js/horarios.js:162-163, js/agendamento.js:430, 1139, 1234, js/views/reparo.js:34 and index.html:260. In the goldens:
  **14 alerts in 11 files** contain "pedido" (13 × "(o pedido está no", 1 × "pedidos de prioridade maior"; grep).
- **The word "aprovação"**: "O pedido mudou depois da aprovação: solte o voo…" (js/views/reparo.js:34) means the
  approval of the schedule; with an approval state on pedidos the sentence reads both ways.
- **"cadastro"** in lower case ("saiu do cadastro", js/engine.js:994, js/reversoes.js:140, js/conflitos.js:37; "Instrutor
  fora do cadastro", js/engine.js:524, js/instrutor-escolhido.js:33; "fica no cadastro da pessoa", index.html:747) is
  the roster, not the view called "Cadastro"; it stays true as long as Alunos, INVAs and Recursos are still called
  cadastros (pedido.md:55).

### 7. Repo rules this touches

- **The pure engine and its goldens**: three strings in js/engine.js and 7 lines of one golden file (section 1).
- **`gravarAlteracao`**: all six tab-naming History texts are arguments of it; no text is written around it.
- **Personal data**: none of these texts carries personal data. The alert texts that go to the CSV and the PDF carry
  the student's and the instructor's names, as today.
- **Fictitious names**: every test line cited uses "Aluno NNNN", "Instrutor NN", "Maria", "João", "Maria Silva".
- **Data-format steps**: none needed for a rename; a step that rewrote stored prose would be the first of its kind
  (2.4).

## What the maps got wrong or left out

- **mapa-casca 5.10** (line 542) lists the "texts that name a tab" as js/views/escala.js:597, js/eventos/demanda.js:38,
  js/views/demanda.js:112, js/glossario.js:67, 88 and js/engine.js:932. That is 4 of the 30 lines of js/ outside the
  glossary. Its section 7 (line 606) names only js/engine.js:932 under "The pure engine" and says "No golden contains it
  today": true of that string, but the engine has two more (961, 994) and the 961 one is in a golden 7 times.
- **mapa-escala 5.1 and suggestion 15** and **mapa-motor 5.2 and conflict 5** have the three engine lines and the 7
  golden alerts right. Left out: the same texts go to the CSV (js/csv.js:62-63), the PDF (js/export.js:87) and the
  booking dialog (js/agendamento.js:1031-1034); js/engine.js:932 has no test at all; the two tests on 961 do not pin
  the parenthesis, so only the golden does.
- **mapa-pedidos 5.7** counts the Agenda words and, for the History, says "Only the description text 'Agenda: …
  incluído (…)'": right for the Agenda. Left out: the Agenda page itself says "demanda" in three user-facing places
  that the rename to Processamento also hits (js/views/agenda.js:148, 194; js/eventos/agenda.js:57), and the badge
  tooltip (js/views/selos.js:54) carries both words. Its level-1 estimate ("a dozen strings in js/views/agenda.js,
  js/eventos/agenda.js, js/views/selos.js") is close: 8 lines say "agenda" and 2 more say only "demanda". It lists "the
  error messages" among the SQL names without saying that no screen shows them and no test pins their wording
  (section 5).
- **mapa-demanda 5.7** lists the History entries the Demanda writes, correctly, without marking which name a tab (5
  of its 12 rows: Pôr um aluno, Usar, Outra missão, Limpar demanda and Importar da agenda) or that they are
  append-only on the server.
- **mapa-dados 5.5** has the 49 `gravarAlteracao` call sites right (recounted). Left out: "Revertido: <descrição>"
  copies stored text into new rows (js/eventos/historico.js:71, 88, 94, 105, 120).
- **mapa-avisos** records `RES.al[]` as stored with `m` (its section 2) and gives, in 5.2, a "Resolved where" column
  marked (inferred). Left out: on opening a date the stored texts are what is shown (js/actions.js:309), so old screen
  names survive on saved dates; and three of the alert texts already carry their own "resolved where" in prose
  (section 1).
- **mapa-testes-e-docs 5.5** covers the Manual and the glossary only, as its title says. Its conflict 5 (the tests force
  the Manual to change with each step) holds for these texts too: 20 of the 30 lines of js/ are pinned by at least one
  test or golden (sections 1 to 3). The 10 that nothing pins: js/engine.js:932, js/export.js:54,
  js/eventos/agenda.js:38, 57, js/eventos/demanda.js:38, 40, js/views/agenda.js:71, js/views/demanda.js:112,
  js/views/escala.js:624 and js/views/selos.js:54.
- **mapa-invas** (conflict 11, question 8) already says that "INVA" is a course sigla, a checker mark
  (js/habilitacoes.js:28) and "the compaction option", for which it cites js/views/escala.js:416. That line is the
  idle-time box ("INVAs parados"); the option's label is js/criterios.js:4, and the sigla is js/cursos.js:8. It matters
  here because js/engine.js:961 names the screen "Instrutores".
- **The brief** says "about 30 such lines in 10 files of js/": 30 lines in 12 files (section 0).

## Implications for the plan (suggestions)

Each item is a suggestion, with its cost and its risk.

1. **Take the screen names out of the three engine texts, once, and let the view say where to fix it.** The engine
   keeps `codigo`; the Escala adds the hint from the code (`CODIGOS_DE_REJEICAO` exists "para dizer onde resolver",
   js/conflitos.js:71-77), and the pipeline's "open the place where it is resolved" can use the same table. Cost: one
   commit with three strings, `cenario-06.json` re-recorded (7 lines, text only), test/unit/instrutor-escolhido.test.js:73
   edited, a small code-to-place table and its test. Risk: it is a golden change with no rule change, which the
   guardrail forbids as written (pedido.md:144), so it needs Pedro's word; dates saved before it keep the old sentence
   in `resultado.al`, and a view that appends a hint would then show two hints on those dates unless it only adds one
   when the text has none.
2. **Alternative: keep the texts and rename them in one commit when the names are final.** Cost: the same golden
   change, later. Risk: from F1 to that commit the Escala, the CSV and the PDF point at screens that no longer exist
   under those names; and every later rename repeats the golden change.
3. **Do not try to rewrite stored text.** The History is append-only by design (2.2); the saved schedules could be
   rewritten by a format step (2.4) but that would be the first step to edit prose. Cost of leaving it: none. Risk: a
   date's History and saved alerts mix old and new names; say so in the Manual in one sentence.
4. **Decide the History prefixes with the names, not in step I.** New entries take the new names ("Pedidos: …" in
   place of "Agenda: …"; a word for "na demanda", "Demanda limpa"). Five of the six rows of 2.1 belong to controls of
   the editable Demanda table and the sixth to the import: if Processamento stores nothing and the import goes, the
   question becomes which new actions write to the History (approving a pedido, an operator restriction), not how to
   reword these. Cost: 6 literals and the 16 test lines listed in 2.1. Risk: none technical; the wording must be
   Pedro's.
5. **Give each text an owner by workstream, because the tests force the text to change with the screen** (20 of 30
   lines are pinned). From the tables: F1 owns index.html:91-102, 165 and js/views/selos.js; B owns js/engine.js:932
   (if suggestion 1 is refused), js/views/selos.js:30, index.html:167, 207, js/eventos/recursos.js:118 and
   js/views/horarios.js:47; C owns js/engine.js:961, index.html:234 and js/views/cadastros.js:76; D owns
   js/views/agenda.js, js/eventos/agenda.js, js/views/selos.js:54-58, index.html:275, 302; G owns js/eventos/demanda.js,
   js/views/demanda.js:112, js/views/escala.js:597, 624, js/reversoes.js:141-142, js/agendamento.js:347,
   js/views/cursos.js:72, 85, js/eventos/cursos.js:396, 402, js/engine.js:994, js/export.js:54 and index.html:260,
   300-317, 373; H owns js/criterios.js:4-11 and js/eventos/escala.js:230. Cost: a table in the plan. Risk: without it
   the same files are edited by parallel branches (js/views/selos.js is touched by F1, B and D).
6. **One place for the screen names used in prose** (a small module exporting the user-facing names of the stages and
   cadastros, used by every text of section 3, never by the engine). Cost: about 25 lines edited once. Risk: sentences
   built from a variable need the article and the preposition to agree ("na Demanda", "em Processamento", "nos
   Pedidos"), so some sentences still have to be rewritten by hand.
7. **A guard against retired names**, like the Manual's list of old phrases (test/e2e/app.spec.js:139-151): a unit test
   that reads the string literals of `js/` and `index.html` and fails on "aba Demanda", "na Demanda", "da agenda",
   "Importar da agenda", "Instrutores › Cadastro", "Disponibilidade do dia", "Janelas de operação", "no topo" once step
   I is done. Cost: one test file. Risk: comments and identifiers use the same words (js/eventos/demanda.js,
   `importarDaAgenda`), so it must look at user-facing literals only or carry an allow list.
8. **SQL messages: leave them, or reword them only inside a migration that replaces those functions anyway** (the
   approval migration of workstream D will `create or replace` `registrar_solicitacao` or add beside it). Cost: zero
   extra. Risk: none found; no screen shows them and pgTAP does not compare them (section 5). A migration made only to
   reword a message nobody sees is not worth the deploy.
9. **Settle the word "pedido" before the texts are rewritten.** If "Pedidos" is the stage, the 14 golden alerts and the
   stored conflict texts that say "pedido" for the engine's request stay readable only if both things are the same
   thing to the operator (they are, if Processamento is a view of the approved pedidos). Cost of changing the engine's
   word: 11 golden files, text only. Risk of keeping it: low; "O pedido mudou depois da aprovação" (js/views/reparo.js:34)
   should gain "da escala".
10. **The PDF header**: "Missões na demanda" (js/export.js:54) can become "Missões pedidas", the Escala's own words
    (js/views/escala.js:462). Cost: one line, no test. Risk: none.

<!-- fim -->
