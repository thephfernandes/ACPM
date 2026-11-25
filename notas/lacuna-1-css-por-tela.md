<!-- Discovery note for the production-line redesign. Local working note: never commit this file. -->

# Lacuna: css/app.css, line ranges by screen and component

Read: `css/app.css` top to bottom (1,698 lines, worktree `wt-plano` at 48875e3), `painel.html`, `index.html` (all but the Manual's prose), `js/views/escala.js` and `js/views/demanda.js` in full, the other views by their class emitters. Every class and id in the stylesheet's selectors was matched by script against where `index.html`, `painel.html` and `js/**` emit it (a `class` attribute, `classList`, `className`); names built by concatenation (`st-…`, `tl-st-…`, `fids-…`, `fids-cia-…`, `res-…`, `p<N>`) were checked by hand. Nothing was run in a browser: a statement about which rule wins is marked (inferred).

Paths are relative to the worktree root. A bare number or range is a line of `css/app.css`.

## Answer

### 1. The file in numbers

- 1,698 lines, 915 style rules, 25 `@media` blocks, one of them print (all listed in mapa-casca 5.5, confirmed line by line), 2 `@keyframes` (428 `fids-embarque`, 1543 `fadeIn`).
- It is the site's only stylesheet of its own (`css/` holds one file; the other is Google Fonts, index.html:16) and both pages load all of it: index.html:17 and painel.html:14.
- 157 rules sit inside at-rules; 130 of them inside the eight `@media (max-width: 640px)` blocks (202-214, 465, 523-558, 679-685, 993-1040, 1088-1133, 1584-1612, 1693), 2 more in `(max-width: 640px), (pointer: coarse)` (1682-1688).
- Nothing reads the file but the browser: no unit test, lint or script opens it (grep `app.css` and `.css` over `test/`, `scripts/`, `package.json`, `eslint.config.js`, `playwright.config.js`, `.github/`: only the MIME type at scripts/serve.mjs:14). It is checked only through the e2e tests' computed styles and boxes.
- No JavaScript knows a width breakpoint: `matchMedia` is used only for the colour scheme (js/eventos/topo.js:70, 83). The one width threshold in code is the Painel's 1,600 px (js/config-do-painel.js:24).
- It changes often: 89 commits touched it between 2026-11-10 and 2026-11-20, 29 of them since 2026-11-17 (`git log -- css/app.css`).
- **It is not ordered by screen.** The Escala's rules are in 13 separate stretches between 309 and 1451, plus 8 lines of the 44 px block and the last rule of the print block (1579-1580); the Demanda's are in 7; the shared components are in 16. Section comments mislead in places:
  - 347 (`#dem select.escolhido`, Demanda) sits inside the Escala list rules.
  - 692 (`td.c-canac`, the cadastro tables) sits under "Painel dos dados pessoais" (686).
  - 723-731, under "Limites da lei", hold a grid column (724-725), a panel of Instrutores › Cadastro (726-728) and part of a drawer (729-731).
  - 977-992, "A missão do curso no dia", mix Demanda (979-987), Escala list (988-991) and Alunos (992).
  - 1162-1170 (Minha conta) split the Agenda in two (1146-1161 and 1172-1179).
  - 1328-1330 (Escala list) sit inside "Mapa de ocupação" (1259).
  - 1567 (`.hd-usuario`, the header) sits inside "Login" (1550).
  - 1694-1698 (Demanda, Recursos) come after the Manual's glossary: both were appended at the end of the file on 2026-11-14 (commits 8787709 and 45dbf5d, `git blame`).

### 2. The ledger, top to bottom

Every line has one row. A range includes the comment above its rules and the blank line after them. "No emitter" means no markup or script produces the class.

```
1-50       tokens       :root light (2-27); box-sizing and safe-area padding (28-30); dark by system (33-41); dark by data-theme (43-49)
51-60      base         html, *, body
61-76      shell        header.topo grid; the brand (.topo-marca, .topo-logo, .topo-titulo)
77-105     shell        header date: .topo-data, .topo-ico, .topo-data-campo, #dt-rotulo, .dt-semana(-curta) with @media 400 px (91-97), .topo-data-rel, #dt
106-131    shell        header tools: .hd-tools, .hd-btn, .hd-sel; .badge-cnt (the count on "Histórico")
132-164    shell        account menu: .menu-conta, .hd-conta, .hd-avatar, .hd-usuario, .menu-itens (also the Demanda's "Mais"), #btn-sair, the theme switch
165-181    shell        nav#nav, .aba-sep, .aba-selo (also #selo-rec-dia inside Recursos)
182-189    shell        what the Secretaria does not see
190-215    shell        header breakpoints: 1289 px (193-195), 1029 px (196-198), 640 px (202-214)
216-218    component    .ico
219-222    base         focus ring of button, select, input
223-227    shell        focus ring on the header
228-230    shell        main (the 1,280 px cap); section and section.on
231-233    base         h2, h3
234-248    profile      read-only: .edit-only, .so-dados, cursors, dimmed fields
249-256    component    .pn
257-270    BI           .chip (269 .chip.off: no emitter)
271-280    base         select, input, input[type=number]
281-282    cadastro     .nm
283-308    component    .btn (.sec, .quiet), .bar, .cresce, .seg
309-311    Escala       toolbar: the view buttons lose their icons up to 1,400 px
312-324    Escala       summary: .resumo, the tiles, tempo parado, details.caixa (erros, avisos)
325-341    Escala       list: .tabela-escala, the status select in the list
342-346    Escala       instructor of the flight (list and pop-up): .ins-btn, .ins-sel
347        Demanda      #dem select.escolhido
348-353    Escala       list: the ✕ appears on hover or focus
354-356    Escala       #out[data-vista]: which of list, map and painel shows
357-439    Painel       .painel-dia and .fids-controles (360-368, Escala only); the board (369-431); the whole screen (432-439)
440-461    Painel       METAR/TAF strip: .fids-meteo, .meteo-*
462-467    Painel       whole-screen layout (462-464); the strip on phones (465); the measuring clone (466-467)
468-470    Escala       .atualizada
471-477    component    .win-btn (Escala list) and .grupo-btn (Recursos table)
478        two screens  tr[hidden] of the Escala list and of table.frota
479-480    component    .flt-rotulo (Escala, BI, the compaction criteria)
481-510    Recursos     Horários de decolagem: .horarios*, .hr-chip, .hr-novo
511-514    Recursos     .form-recurso
515-516    component    .erro-campo
517        Recursos     table.frota .acoes-frota
518-521    Escala       map container: .mapa, .mapa .tl-wrap
522-559    phone block  mixed, see section 5
560-576    component    .tw, table, th, td (576 .num: no emitter)
577-579    two screens  tr.off td (Demanda and the Instrutores grid); tr.on td:first-child (Demanda)
580-596    Demanda      #s-dem table, the #dem fields, tr.extra-row, hover reveal, tr.p5, #incluir-aluno, #cnt
597        component    .chk
598-599    Demanda      .menu-mais
600-601    Escala       list: tr.st-Cancelado
602-610    Escala       .st-detalhe (list and pop-up)
611-623    dialogs      dialog.dlg, ::backdrop, .motivos, .campo, .dlg-acoes (also .form-dados .dlg-acoes)
624-640    dialogs      Configurar painel: dialog.dlg-painel, .pn-*
641-685    dialogs      Agendar voo: dialog.dlg-agendar, .campo-duplo, #agd-*, .agd-* (679-685 on phones)
686-691    drawers      Dados pessoais: .form-dados, .campo-dado
692        cadastro     td.c-canac
693-697    Escala       .aprovacao, .selo-aprovada
698        Escala       list: .ico.fixo
699-702    Escala       the conflicts box (699-700, 702); tr.em-conflito (701)
703-715    Escala       the compaction bar and its criteria (708-713 at 600 px)
716        Escala       .resumo .parado strong
717-722    drawers      Sugestões: .motivo-conflito, .opcoes-reparo
723-725    Instrutores  grid: td.mes
726-728    Instrutores  Cadastro: .limites-lei, .limites-grade
729-732    drawers      Habilitações: .horas-ins
733-750    Demanda      .stu-cell, .btn-add-mis
751-755    Escala       list: .win td
756-783    component    .tag (.fb, .grp, .er, .comb); input.sw; label.alvo
784-843    Recursos     janelas (784-791); the two views (792-799); day layout (800-808); frota (809-828); table.frota (829-835); .saldo (836: no emitter); .barra (837-840); .rev (841-843)
844-854    component    section[data-vista]; .contagem; tr.sem-resultado
855-873    filter       .filtro-botao, .filtro-painel, .filtro-cab, .filtro-regra, .filtro-grupos, .filtro-opcao
874-976    Cursos       program, bar, form, course header, students, switcher, phase index, phase, missions table
977-978    two screens  .etapa (Demanda and Escala list)
979-987    Demanda      .usar-proxima, select.outra-missao, .stu-cell:has(.outra-missao)
988-991    Escala       list: .resultado, .res-sel, .res
992        Alunos       td.c-curso .progresso
993-1040   Cursos       phones
1041-1067  Instrutores  grid: .legenda-disp, table.disp, .habs-resumo, .cel
1068-1069  Alunos       p.ir-para-demanda
1070-1075  cadastro     table.cadastro (Instrutores, Alunos and the Cursos missions table)
1076-1078  Alunos       table.alunos select[data-f="bl"], select[data-f="voaCom"]
1079-1083  cadastro     discreet inputs; .falta
1084-1087  drawers      Habilitações: .habs-painel
1088-1134  phone block  mixed, see section 5
1135-1145  Rodízio      .rodizio; .fila (also the hangar in Recursos)
1146-1161  Agenda       .agenda (1147-1149); the calendar (1150-1157); the form (1158-1161)
1162-1171  Minha conta  .conta, #form-nova-conta, .conta-msg
1172-1180  Agenda       who edits (1172-1173); the list (1174-1178); #agenda-importar (1179)
1181-1193  Escala       .st-sel, .st-<Status>
1194-1207  Escala       .al
1208-1219  BI           the .st tiles (also the base of the Escala's tiles)
1220-1223  base         p.h, a, .sr
1224-1228  shell        .pular
1229-1230  Alunos       .bl
1231-1244  component    .x
1245-1258  Alunos       .tg
1259-1327  Escala       map: legend, axis, rows, track, the "+" (1322-1327, also the list's)
1328-1331  Escala       list: where the "+" sits in tr.win
1332-1397  Escala       map: mission colours, bars
1398-1451  Escala       pop-up
1452-1463  drawers      .gaveta, .gaveta-cab, .gaveta .h
1464-1495  drawers      Histórico: #btn-clear-log, .audit-*
1496-1499  BI           .bi-bar-wrap, .bi-bar-fill, .bi-grid-2
1500-1519  Manual       .manual*
1520-1544  toasts       #toast-box, .toast
1545       base         [hidden]
1546       Demanda      .only tr.off
1547       component    .sm
1548-1549  dead         details.pn summary: no emitter
1550-1562  shell        login: #s-login, body[data-login], #role-sel, .login, #login-erro
1563-1566  shell        shared mode hides #btn-clear-log, #btn-bi-sim, #btn-bi-clr
1567       shell        .hd-usuario, a second time
1568-1574  shell        .aviso-sync, .aviso-link
1575-1582  print        see section 5
1583-1614  phone block  44 px, see section 5
1615-1645  TV           painel.html only
1646-1675  tooltips     .dica, .dica-btn, [data-dica]
1676-1678  component    [data-foco-neutro]
1679-1688  tooltips     focus of [data-dica]; the 44 px "?" (1682-1688)
1689-1693  Manual       dl.glossario
1694-1695  Demanda      #s-dem input.duracao
1696-1698  Recursos     .horas-disp
```

Lines by group (blank lines and comments counted with their rules; the two mixed phone blocks split rule by rule; 478 counted with the Escala and 577 with the Demanda): Escala 346; shell 193, plus 15 for the read-only profile; Cursos 151; shared components 128; Painel and strip 113; Recursos 98; dialogs 75; drawers 64; cadastro tables 53; Demanda 53; tokens 50; tooltips 40; Instrutores grid and limits 33; base 32; the 44 px block 32; TV 31; BI 30; filter 27; Agenda 25; Manual 25; toasts 25; Alunos only 22; Rodízio 11; Minha conta 10; print 8; the other 8 are the opening and closing lines of the block 523-558 (4), `.etapa` (2) and the dead rule at 1548 (2).

### 3. By screen and component (the question's list)

Phone and print lines are listed with the screen they serve, although they sit in the shared blocks of section 5.

**Escala** (markup: index.html:344-375; `#out` index.html:372; pop-up index.html:762)

| Part | Lines | Emitted by |
|---|---|---|
| Toolbar and view switch | 309-310; 354-355; 468-470; phone 529 | index.html:345-362; `#out.dataset.vista`, js/views/escala.js:593 |
| Summary: tiles, tempo parado, the three boxes | 312-324; 699-700; 702; 716; 1194-1206; phone 532-533, 1593 | js/views/escala.js:415-419, 460-477 |
| List | 325-341; 348-353; 478 (first selector); 600-601; 698; 701; 751-755; 988-991; 1328-1330; phone cards 534-557; phone 1606 | js/views/escala.js:517-552; the result, js/views/etapas.js:182-184 |
| Instructor of the flight, in the list and in the pop-up | 342-346; phone 1591 (`.ins-btn`) | js/views/escala.js:348, 357, called at :50 (pop-up) and :543 (list), swapped at js/eventos/escala.js:151-159 |
| Status select and its detail, in the list and in the pop-up | 602-609; 1181-1192; phone 1590 | js/views/escala.js:57, 335, 366-367; the class from `classeDoStatus`, js/status.js:60-61 |
| Approval and compaction criteria | 693-697; 703-715 (708-713 is `@media (max-width: 600px)`) | index.html:345, 366-370; js/views/escala.js:375-407 |
| Map | 518-520; 1259-1327; 1332-1396; phone 1599-1604 | js/views/escala.js:169-264 |
| Pop-up | 1398-1450; 609; phone 1605; print 1580 (third selector) | index.html:762; js/views/escala.js:47-64; placed by `posicionarJunto`, js/dom.js:97-106 |

- The "+" that books (`.tl-agendar, .win-agendar`, 1322-1327, phone 1600, print 1580) is one rule for the map rows (js/views/escala.js:199) and the list's time rows (js/views/escala.js:526).
- The class `st-Cancelado` is put on the status `<select>` (js/views/escala.js:335) and on the list's `<tr>` (js/views/escala.js:530, 549). Rule 1192 (`.st-Cancelado`) therefore also colours the row (inferred), next to 601.
- There is no `.st-Atrasado` rule outside the list: 1187-1192 cover Confirmado, EmVoo, Pousou, Pendente and Cancelado; Atrasado exists only as `.tabela-escala .st-sel.st-Atrasado` (340).

**Painel and TV**

| Part | Lines | Emitted by |
|---|---|---|
| Escala-only wrapper and buttons | 360; 361-364; 366-368 (the same rule also covers `.seg button.on`); phone 526-527 | js/views/escala.js:560; js/views/painel-aeroporto.js:183-190 |
| The board: frame, header, lists, tables, cells, model and status colours, the "embarque" blink | 369-431 | js/views/painel-aeroporto.js:36, 44, 134-160, 191; `fids-<classe>` from js/quadro.js:78-79 |
| Whole screen (the Escala's full screen and the TV) | 432-439; 462-464 | `requestFullscreen`, js/views/painel-aeroporto.js:319; `classList.add('fids', 'inteiro')`, js/views/painel-aeroporto.js:240 |
| The measuring clone | 404-405; 466-467 | js/views/painel-aeroporto.js:99 |
| METAR/TAF strip | 440-461; phone 465; whole screen 464 | js/views/meteorologia.js:16-38 |
| TV page only | 1615-1644 | painel.html:18, 25-43; `body[data-tela]`, js/painel.js:44; `body.mexeu`, js/painel.js:185-187 |

What else reaches `painel.html` is in section 6.

**Demanda** (index.html:299-341; rows js/views/demanda.js:53-82): 347; 577-578; 580-596; 598-599; 733-749; 978 (`.etapa`, shared with the Escala list); 979-987; 1546; 1694-1695; phone 1589 (`.btn-add-mis`); the read-only exception `#onlyfly` in 244. No phone block has a card layout for it: the table stays a table inside `.tw` (index.html:322; 581).

**Agenda** (index.html:274-296; calendar js/views/agenda.js:118-135; list js/views/agenda.js:150-166): 1146-1161 (two-column layout 1147-1149 with `@media (max-width: 760px)` at 1149; calendar 1150-1157; form 1158-1161); 1172-1179; phone 1587 (`.cal .dia`) and 1608 (`.cal`); the read-only exception `.agenda-campo` in 244-245. The calendar's day classes are `dia`, `fora`, `fechado`, `sel` (js/views/agenda.js:132): there is no style, and no class, for "today".

**Recursos** (index.html:149-211)

| Part | Lines | Emitted by |
|---|---|---|
| "+ Novo recurso" form | 511-514 | index.html:193-202 |
| Janelas de operação | 785-791 (comment at 784); the Gestor's cursor, 239 (first selector of the rule 239-241); phone `.janela` in 1594 | index.html:167-168; js/views/recursos.js:146 |
| The two views' wrappers | 792-799 | index.html:164-165, 189-190 |
| Day layout, Ordem no hangar beside the table from 1,100 px | 800-808 | index.html:171-187 |
| Aviões e simuladores table | 517; 821; 829-835; 837-843; 1696-1698; shared 471-478; phone `.grupo-btn` in 1598 | index.html:173-178; js/views/recursos.js:55, 64-70, 87 |
| Frota (Cadastro) | 809-810; 812-820; 822-828; phone `.frota-reg` in 1591 | index.html:203; js/views/recursos.js:110-117 |
| Horários de decolagem | 481-510; 811; phone `.hr-chip button` in 1589 and 1609-1611 | index.html:208; js/views/horarios.js:44-97, 118-123 |
| Ordem no hangar | no rule of its own: `ol.fila.hangar` (index.html:185) takes the Rodízio's `.fila` (1136-1144, phone 1597); the classes `hangar` and `rec-hangar` have no CSS | js/views/recursos.js:159-175 |

`.horarios-cat .hr.fechado` (495) is the struck-through take-off time of a closed window: it is the style of a reader of `S.win` (js/views/horarios.js:39, 47).

**Instrutores grid** (index.html:229-237; js/views/cadastros.js:79-93, 123): 1041-1043 (legend); 1044-1054 (`table.disp`); 1055 (`.habs-resumo`, used by the grid, js/views/cadastros.js:91, and by the Cadastro table, js/views/cadastros.js:114); 1056-1067 (`.cel`); 723-725 (`td.mes`); 577 with 1050 (`tr.off`); the Gestor's cursor, 240 (second selector of the rule 239-241); phone 1596; the sticky "Limpar filtros" text, 854. The "Limites da Lei do Aeronauta" panel of Instrutores › Cadastro is 726-728 (index.html:243; js/views/cadastros.js:218-229).

**Cadastro tables and their phone cards** (index.html:239-242 `table.cadastro.instrutores`, index.html:261-264 `table.cadastro.alunos`; rows js/views/cadastros.js:109-116, 276-284)

| Part | Lines |
|---|---|
| Base of `table.cadastro` | 1070-1075; 1079-1083 |
| The name input `.nm`; the CANAC cell | 281; 692 |
| Alunos only | 992; 1068-1069; 1076-1078; 1229 (`.bl`); 1245-1257 (`.tg`); phone `.tg button` in 1589 and 1607 |
| Phone cards | 1098-1128 inside the block 1088-1133; the read-only profiles on the cards, 1129-1132 |
| Count and "nothing with these filters" row | 848-854 (also Recursos; the row also the Demanda, js/views/demanda.js:163) |

**The Cursos missions table is a `table.cadastro` too**: `<table class="cadastro programa…">` (js/views/cursos.js:226), with `td.acoes` and `td.c-nome` cells (js/views/cursos.js:155-163). On desktop it takes 1070 (minimum width and font size), 1074 (the actions cell) and the discreet inputs 1080-1081; 1071 matches too and is overridden by 965. On phones its cards exist only because of the cadastro block: the Cursos block (993-1040) has no rule that hides the head or turns the table into blocks; `table.cadastro { min-width: 0 }` (1104), `table.cadastro thead { display: none }` (1105), `table.cadastro, table.cadastro tbody, table.cadastro td { display: block }` (1106), 1113 and 1126 do it.

**Cursos** (index.html:268-271; js/views/cursos.js): 874-976 (program and phases 876-904; bar, form, course header, students 907-931; switcher 934-936; phase index 939-951; collapsible phase 954-962; missions table 965-976) and the phone block 993-1040 (mission cards 996-1019 and 1028; fields and form 1020-1027; switcher, index and phase button 1033-1039). Plus the borrowed cadastro rules above.

**BI** (index.html:652-663; js/views/bi.js:122-205): 257-268 (`.chip`, emitted once, the "Data base" label, index.html:655); 1208-1218 (the `.st` tiles, js/views/bi.js:123); 1496-1498; the shared-mode hide of its two buttons inside 1564-1566; the read-only exception `#bi-dt` in 244.

**Drawers** (index.html:667-682)

| Part | Lines | Emitted by |
|---|---|---|
| Frame of the four | 1455-1463 (comment from 1452) | `abrirGaveta` sets `--camada`, js/dom.js:48 |
| Histórico | 1464-1494; the header count `.badge-cnt`, 123-130; hidden "Limpar" in shared mode, 1564 | index.html:667-675; js/views/escala.js:279-297 |
| Habilitações (`#painel-instrutor`) | 1084-1087; 729-731; phone `.habs-painel label.hab` in 1594 | js/views/cadastros.js:187-213 |
| Dados pessoais (`#painel-dados`) | 686-691; second selector of 623 | js/views/dados-pessoais.js:41-44, 91-103 |
| Sugestões (`#painel-reparo`) | 717-722 | js/views/reparo.js:27-41 |

**Dialogs** (index.html:684-760): base 611-623 (box and backdrop 612-616; `.motivos` 618-619, status dialog only, js/views/dialogo-status.js:13; `.campo` 620-622; `.dlg-acoes` 623); Configurar painel 624-640 (js/views/config-do-painel.js:26-47); Agendar voo 641-685 (its phone rules 679-685). The session dialog (index.html:712-722) has no rule of its own.

**Multi-value filter** (index.html:159-160, 224-225, 255-256, 309-310; js/views/filtro-multiplo.js:34-48): 855-873; phone 1090-1097; phone 1089, which sizes the toolbar's filters by id and lists Instrutores, Alunos and Recursos but not the Demanda's `#flt-dem-cur`. The panel's place "on its own line below the toolbar" is `order: 1; flex: 1 1 100%` (864): it works because the panel is a child of a `.bar`, a wrapping flex container (300).

**The 44 px phone block**: 1583-1612, rule by rule in section 5. **Print**: 1575-1581, in section 5.

**The rest**: Rodízio 1135-1144 (index.html:378-382; js/views/rodizio.js:16-28); Minha conta e Usuários 1162-1170 (index.html:385-426); Manual 1500-1518 and 1689-1693 (index.html:429-649); toasts 1520-1543 (js/dom.js:9-18); tooltips 1646-1675 and 1679-1688 (js/dicas.js:42-49); login 1550-1562 (index.html:126-145); the shell's ranges as in mapa-casca 5.10 plus the ones named under "What the maps got wrong or left out".

### 4. Rules that no single screen owns

| Rule | Lines | Every user |
|---|---|---|
| `.pn` | 250-256 | index.html:128, 134, 138, 166, 182, 191, 205, 243, 278, 279, 389, 399, 412, 424 and the Manual's eight blocks (442-622); js/views/bi.js:131, 159, 182; js/views/cursos.js:357, 413; js/views/escala.js:260 (the map); js/views/rodizio.js:28 |
| `.btn`, `.sec`, `.quiet` | 283-299; phone 1589 | every screen; painel.html:35, 43 |
| `.bar`, `.cresce` | 300-301; phone 531 | index.html:140, 151, 216, 251, 301, 346, 366, 654; js/views/cursos.js:390 |
| `.seg` | 302-308; 366-368; phone 524-525, 528, 1587 | Recursos index.html:152; Instrutores index.html:217; Escala index.html:347; Cursos js/views/cursos.js:391; the criteria js/views/escala.js:405; the Painel js/views/painel-aeroporto.js:184 |
| `.menu-itens` | 146-155; phone 1587 | the account menu index.html:82; the Demanda's "Mais" index.html:316 (placed by 598-599) |
| `.aba-selo` | 178-180 | the nav badges index.html:92, 94, 96; `#selo-rec-dia` in the Recursos view switch index.html:153; class written at js/views/selos.js:16 |
| `.win-btn, .grupo-btn` and 478 | 471-478; phone 1598 | Escala list js/views/escala.js:526; Recursos table js/views/recursos.js:87 |
| `.flt-rotulo` | 479-480; phone 530 | Escala index.html:355-356; BI index.html:656-657; the criteria js/views/escala.js:405 |
| `.erro-campo` | 515-516 | index.html:201, 689, 703, 717, 754; js/views/horarios.js:92; js/views/cursos.js:417; js/views/dados-pessoais.js:44, 98; painel.html:34 |
| `.tw`, `table`, `th`, `td` | 560-576 | index.html:174, 236, 239, 261, 293, 322, 424, 582; js/views/bi.js:133, 161, 184; js/views/cursos.js:226; js/views/escala.js:517; the board's `table.fids-tabela` on both pages (the element rules only) |
| `tr.off td` | 577 | Demanda rows js/views/demanda.js:53; Instrutores grid js/views/cadastros.js:84 |
| `.chk` | 597; phone 1594 | index.html:198, 306; js/views/recursos.js:102; js/views/horarios.js:84; js/views/config-do-painel.js:26, 27, 32; js/views/cursos.js:130, 139, 162, 392, 412; js/views/dialogo-status.js:15 |
| `.dlg-acoes` | 623; 917; phone 1023 | the dialogs index.html:690, 705, 718, 755; the Dados pessoais drawer js/views/dados-pessoais.js:99; the Cursos form js/views/cursos.js:418 |
| `.tag` and variants | 756-769 | Agenda js/views/agenda.js:145, 148, 162; BI js/views/bi.js:141-143; Cursos js/views/cursos.js:169, 336; Demanda js/views/demanda.js:46; Escala js/views/escala.js:316-318, 325, 331, 494, 539; Recursos js/views/recursos.js:38, 40, 97, 163-164; Rodízio js/views/rodizio.js:19-20 |
| `input.sw`, `label.alvo` | 770-782; phone 1594 | "Vem" js/views/cadastros.js:86; habilitações js/views/cadastros.js:194; "Voa" js/views/demanda.js:73; "Disponível" js/views/recursos.js:65; janelas js/views/recursos.js:146 |
| `section[data-vista]` | 845-847 | Recursos index.html:149; Instrutores index.html:214; written at js/views/vistas.js:24 |
| `.contagem`; `tr.sem-resultado` | 848-854 | index.html:161, 226, 257; js/views/cadastros.js:434 (Instrutores, Alunos, Demanda); js/views/recursos.js:91 |
| `.etapa` | 978 | Demanda js/views/etapas.js:138; Escala list js/views/etapas.js:180 |
| `.progresso` | 927; 992 | Cursos and Alunos, both from js/views/etapas.js:154 |
| `.fila` | 1136-1144; phone 1597 | Rodízio js/views/rodizio.js:28; the hangar index.html:185 |
| `.st` tiles | 1208-1218 | BI js/views/bi.js:123; Escala js/views/escala.js:461, restyled by 314-316 |
| `.x` | 1231-1243; phone 1589 | 18 emitter lines in 10 view files (agenda, cadastros, conta, cursos, dados-pessoais, demanda, escala, recursos, reparo, rodizio) and index.html:289, 419, 670 |
| `.sm` | 1547 | js/views/bi.js:146; js/views/demanda.js:57; js/views/escala.js:289-295, 326, 345; js/views/recursos.js:42, 66, 112 |

One rule, several screens in its selector list: 239-241 (Recursos janelas, the Instrutores grid, every switch label); 242-247 (the header date, the Escala's status select, and the exceptions for the filters, the Agenda, Minha conta, the Demanda's `#onlyfly`, the BI's `#bi-dt`); 184-188 (nav, the Alunos link, Histórico, "Compartilhar"); 366-368; 471-478; 577; 623; 1089; 1323-1327; 1564-1566; 1576; 1580; and 1587, 1589, 1591, 1594, 1597, 1598 and 1600 of the 44 px block.

Generic selectors that any new element inherits: `section` hidden unless `.on` (229-230); `main` capped (228); `h2`, `h3` (231-232); every `select` and text `input` (271-279) and their 44 px on phones (1592); every `table` at least 840 px wide (562), every `th` sticky (563-574), every `td` padded with a top border (575); `tr.on` and `tr.off` on any table (577-578); `a` (1221); in print, every `header` and `nav` hidden (1576).

### 5. The mixed blocks, rule by rule

**`@media (max-width: 640px)`, 523-558** (its comment names only the Escala's cards)

| Lines | Selector | Owner |
|---|---|---|
| 524-525, 528 | `.seg`, `.seg button`, `.seg .ico` | component |
| 527 | `.fids-controles .seg` | Painel buttons in the Escala |
| 529 | `#s-esc .flt-rotulo, #flt-esc-q` | Escala toolbar |
| 530 | `.flt-rotulo select` | Escala and BI |
| 531 | `.bar .cresce` | every toolbar |
| 532-533 | `.resumo .st, .resumo .parado`; `details.caixa` | Escala summary |
| 534-557 | `.tabela-escala …` | Escala list as cards |

**`@media (max-width: 640px)`, 1088-1133**

| Lines | Selector | Owner |
|---|---|---|
| 1089 | `[data-flt="inst"], #flt-ins-hab, [data-flt="alu"], #flt-alu-cur, #flt-rec-mat, #flt-rec-cat` | the toolbar filters of Instrutores, Alunos and Recursos |
| 1090-1097 | `.filtro-botao`, `.filtro-resumo`, `.filtro-grupos fieldset`, `.filtro-opcao` | multi-value filter |
| 1104-1106, 1113, 1126 | `table.cadastro` as blocks, no head, no cell padding, visible input borders | Instrutores, Alunos and the Cursos missions table |
| 1107-1110, 1112, 1114-1118, 1123, 1125 | `tr.cd` grid, `::before` labels from `data-rotulo`, the areas of `td.c-nome`, `td.c-peso`, `td.c-canac`, `td.acoes`, the name input | Instrutores and Alunos |
| 1119, 1124 | `td.c-habs`; `[data-act="editar-habs"]` | Instrutores |
| 1111, 1120-1122, 1127-1128 | `table.cadastro.alunos tr.cd`, `td.c-curso`, `td.c-voa-com`, `td.c-nao-escalar`, the Alunos selects | Alunos |
| 1129-1132 | `body[data-role="gestor"] …` | read-only profiles on the cards |

**`@media (max-width: 640px)`, 1583-1612, "Alvos de toque no celular"** (21 rules)

| Line | Selector | Owner |
|---|---|---|
| 1586 | `.topo-ico, .hd-btn, .hd-conta` | shell: date arrows, header tools, account button |
| 1587 | `.hd-sel, .topo-data-campo, .seg button, .menu-itens button, .cal .dia` | shell (profile select, date label, account menu); `.seg`; the Demanda's "Mais"; the Agenda's calendar |
| 1588 | `nav#nav button` | shell: the tabs |
| 1589 | `.btn, .x, .btn-add-mis, .tg button, .hr-chip button` | components; Demanda; Alunos; Horários de decolagem |
| 1590 | `button.st-detalhe` | Escala status |
| 1591 | `.ins-btn, .frota-reg` | Escala; Recursos › Frota |
| 1592 | `select, input:not([type="checkbox"]):not([type="radio"])` | base |
| 1593 | `details.caixa summary` | Escala summary |
| 1594 | `label.alvo, label.chk, .janela, .habs-painel label.hab` | switch and checkbox labels; Janelas de operação; Habilitações drawer |
| 1595 | `input[type="checkbox"]:not(.sw)` | base |
| 1596 | `.cel` | Instrutores grid |
| 1597 | `.fila li` | Rodízio and the hangar |
| 1598 | `.win-btn, .grupo-btn` | Escala list; Recursos table |
| 1599-1600 | `.tl-agendar, .win-agendar` | Escala map and list |
| 1601-1604 | `.tl-lbl > span, .tl-lbl > small` | Escala map (the labels wrap; not a 44 px rule) |
| 1605 | `.tl-pop-btn[data-act="agendar"]` | Escala pop-up |
| 1606 | `.tabela-escala tr.win .win-btn` | Escala list (padding; not a 44 px rule) |
| 1607 | `.tg` | Alunos (padding) |
| 1608 | `.cal` | Agenda calendar (gap) |
| 1609-1611 | `.horarios-nome`, `.horarios-lista` | Horários de decolagem (layout) |

44 px rules outside this block: 684 (`#agd-previa summary`), 1022 (`#cursos summary`), 1034, 1036, 1038 (Cursos), 1097 (`.filtro-opcao`), 1682-1688 (`.dica-btn`, also for `pointer: coarse`).

**`@media print`, 1575-1581**

- 1576: `header, .bar, nav, section:not(#s-esc), #toast-box { display: none !important }`. 1577: `section#s-esc { display: block }`. 1578: `body` white with black text. 1579-1580: the three "+" that book are hidden.
- It selects by tag. It does not hide the four drawers (`aside.gaveta`, index.html:667-682, outside `main`), the pop-up (index.html:762), the tooltip, the skip link (index.html:23) or the three banners (index.html:108-123).
- Nothing calls `window.print()` and no test emulates print (grep `print` over `js/` and `test/`: only css/app.css:1575). The "PDF" button is jsPDF (index.html:18-19, 360).

### 6. What reaches painel.html

The TV page's own rules are 1615-1644, but it loads the whole file (painel.html:14) and its markup (painel.html:18-44, plus what js/views/painel-aeroporto.js:236-244 and js/views/meteorologia.js:16-38 write into `#quadro`) matches about 210 more lines:

| Lines | Rule | Matches on the TV page |
|---|---|---|
| 1-49 | tokens | `.login-painel` uses `--pn` and `--ink` (1620); `.btn` uses `--ac` |
| 52-59 | `html`, `*`, `body` | the page |
| 219-222 | focus ring | the login's fields and buttons |
| 228 | `main` | painel.html:24 |
| 232 | `h3` | the board title is an `h3` (js/views/painel-aeroporto.js:157), restyled by 382-385 |
| 271-279 | fields | painel.html:30-31 |
| 283-297 | `.btn`, `.btn.sec` | painel.html:35, 43 |
| 369-467 | the board and the strip | `#quadro` receives `fids inteiro` (js/views/painel-aeroporto.js:240) |
| 515-516 | `.erro-campo` | painel.html:34 |
| 562-576 | `table`, `th`, `td` | `table.fids-tabela` (js/views/painel-aeroporto.js:137); 406-410 override part of them |
| 1220 | `p.h` | painel.html:29, 33 |
| 1223 | `.sr` | the table's caption (js/views/painel-aeroporto.js:138) |
| 1545 | `[hidden]` | painel.html:25, 28, 37, 39, 43 |
| 1561-1562 | `#login-erro` | the same id on both pages: painel.html:34 and index.html:132 |

Not on the TV page: `.painel-dia` (360; written at js/views/escala.js:560); `.fids-controles` (361-368; only `painelDaEscala` writes it, js/views/painel-aeroporto.js:176-191, and `painelNaTela`, :236-244, does not); `.fids:fullscreen` (the TV uses the class `inteiro`, not the Fullscreen API). The phone rules 465, 1589, 1592 and 1595 would apply to it below 640 px.

### 7. Order in the file and couplings with JavaScript

Pairs of equal specificity where the later rule must stay later:

- The phone rules after their base: 525 after 304-307; 532 after 314; 533 after 317; 535 after 325; 1104 after 1070; 1113 after 1071; 1126 after 1080; 1596 after 1058-1061; 1597 after 1137; 1604 after 1299; 1606 after 1329; 1607 after 1245-1254; 1608 after 1151.
- 467 (`.fids.fids-medida`) after 439 (`.fids.inteiro`): the comment at 466 says so.
- 1567 after 141, both `.hd-usuario`: the `font` shorthand at 1567 resets the `line-height: 1.1` of 141 (inferred).
- Overrides of `.btn` (283-299) that rely on coming later: `.pn-mover` (638), `.agd-chips .btn` (667), `.frota-item .ret` (818).

Values that JavaScript and the stylesheet share:

- `--camada` (1456), set by js/dom.js:48; `--seta` (1419, 1661) and the class `abaixo` (1425, 1664), set by js/dom.js:105-106.
- `--hora` (1310), set inline at js/views/escala.js:209; the bars' and ticks' `left` and `width` are inline (js/views/escala.js:174, 192).
- The map's axis margin of 166 px (1273) is the label's 155 px (1290) plus the row gap of 10 px (1283) plus the track's 1 px border (1312); the time of a click comes from the track's box (js/eventos/escala.js:29).
- `--fids-linha` and `--fids-vao` (370, 435) are read at js/views/painel-aeroporto.js:69, 104; `--fids-ajuste` (435) is written at js/views/painel-aeroporto.js:231; `PREENCHIMENTO = 20` (js/views/painel-aeroporto.js:91) is the cells' `padding: … 10px` (407, 410); the heights of `.fids-topo`, `.fids-tabela thead` and `.fids-meteo` are measured (js/views/painel-aeroporto.js:70-76); the board's width, taken from `#out` before the first drawing (js/views/painel-aeroporto.js:80-88), feeds the 1,600 px rule.
- `#out[data-vista]` (354-355) is written at js/views/escala.js:593; `section[data-vista]` (847) at js/views/vistas.js:24. The Painel's code addresses `#out` by name (js/views/painel-aeroporto.js:27, 83, 311, 326).
- Inline styles from the views: js/views/bi.js:134, 150, 162, 172, 185, 200; js/views/recursos.js:55; js/views/demanda.js:112.

Stacking order, all in the stylesheet: sticky table head 1 (573); the grid's sticky name column 1 and 2 (1048-1049); map bars 2, and 30 when hovered or open (1355, 1359); tooltip 60 (1648); menus and the skip link 100 (147, 1226); map pop-up 150 (1412); drawers 200 and up (1456); toasts 9999 (1527); on the TV page 2, 3 and 4 (1618, 1635, 1642). mapa-casca 1.5 already infers that a tooltip (60) opened inside a drawer (200 and up) is painted under it; the case exists, since the tooltip is appended to `body` (js/dicas.js:48) and the Habilitações drawer has "?" buttons (js/views/cadastros.js:193, 203), and test/e2e/dicas.spec.js has no test inside a drawer (not run here either).

### 8. Rules with no effect, and classes with no rule

No emitter in `index.html`, `painel.html` or `js/**`:

- `.chip.off` (269): `.chip` is emitted once, without `off` (index.html:655).
- `.num` in the selector list of 576.
- `.saldo` (836).
- `details.pn summary` (1548): the only `<details>` are the Cursos ones (js/views/cursos.js:131, 140, 246, 263, 297), the Escala's boxes (js/views/escala.js:467, 475, 476) and `#agd-previa` (index.html:752).

Overridden where they are used (inferred): `.al` and its two variants (1194-1205), since both emitters put it inside `details.caixa` (js/views/escala.js:458, 472) and 320 resets border, padding, margin and background there; only `.al b` (1206) is left.

Classes emitted with no rule (hooks for scripts and tests): `aba-rotulo` (index.html:92-102), `hangar`, `rec-hangar` (index.html:182, 185), `instrutores` (index.html:239), `empty-dem` (js/views/demanda.js:112), `por`, `situacao` (js/views/agenda.js:162-163), `voa-com`, `nao-escalar` (js/views/cadastros.js:281-282), `audit-autor`, `escolhido-marca` (js/views/escala.js:289, 345), `fids-hora`, `fids-vazia` (js/views/painel-aeroporto.js:135, 159), `meteo-metar`, `meteo-taf` (js/views/meteorologia.js:16, 18), `indice-modulo` (js/views/cursos.js:316-317).

### 9. Tests that pin a line directly (not exhaustive; layout tests by box are in mapa-casca section 4)

| Lines | Test |
|---|---|
| 228 | test/e2e/app.spec.js:88-91 (`principalMax: '1280px'`) |
| 363, 366-368 | test/e2e/escala-tela.spec.js:469-476 (pressed button; forced colours) |
| 427-430 | test/e2e/escala-tela.spec.js:345, 363, 368 (`animationName`) |
| 436 | test/e2e/painel-tv.spec.js:534 (`overflowX === 'hidden'`) |
| 455-456 | test/e2e/painel-meteorologia.spec.js:74 (monospace) |
| 469 | test/e2e/escala-tela.spec.js:219 (13 px) |
| 505 | test/e2e/cadastros.spec.js:433-437 |
| 539-542 | test/e2e/celular.spec.js:396 (`display: grid`) |
| 675 | test/e2e/acessibilidade.spec.js:723 |
| 678 | test/e2e/agendamento.spec.js:194-206 |
| 1107-1124 | test/e2e/celular.spec.js:81-93, 154 (grid rows, `::before` labels) |
| 1141-1142 | test/e2e/rodizio.spec.js:34 (opacity) |
| 1537 | test/e2e/escala.spec.js:82 (15 px) |
| 1604 | test/e2e/celular.spec.js:381-385 |
| 1642-1644 | test/e2e/painel-sessao.spec.js:199-201 |

### 10. The repo's rules in this area

- **Personal data.** The stylesheet touches it at 237 (`.so-dados`, the CANAC column and the "Dados pessoais" button), 692 and 1117-1118 (`td.c-canac`) and 1132 (the cards' buttons). The print rule shows only `#s-esc`, so the cadastro tables are not printed; but it does not hide the drawers, so "Dados pessoais" left open would go to paper with the Escala (inferred; print is untested).
- **Engine, goldens, `gravarAlteracao`, data format, fictitious names**: the stylesheet has no part in them.

## What the maps got wrong or left out

Checked: the 203 lines of the 14 maps that cite `css/app.css`.

1. **mapa-casca, section 1.1 (its line 12), and the brief: "TV page (1615-1644)".** Those are the TV-only rules. The page depends on about 210 more lines (section 6), among them generic `table`, `th`, `td`, `main`, `.btn`, `.erro-campo` and the id `#login-erro` that both pages share.
2. **mapa-casca 5.5, "Cards: … the Cursos program (996-1019)".** Left out: those cards also need 1104-1106, 1113 and 1126 of the cadastro block, because the missions table is `table.cadastro.programa` (js/views/cursos.js:226). mapa-alunos (its lines 204, 277) cites 1104-1132 as the roster tables' cards, without the Cursos table.
3. **mapa-casca 5.5, the row for 523-558** describes `.seg`, `.bar .cresce` and the Escala's cards; the block also holds the Painel's buttons (527), the Escala's filters (529-530) and the summary (532-533). Its list of 44 px selectors leaves out `.habs-painel label.hab` (1594), `details.caixa summary` (1593), `.fila li` (1597) and `.tl-pop-btn[data-act="agendar"]` (1605), and does not say that 1604, 1606, 1607, 1608 and 1610-1611 are layout rules, not 44 px rules.
4. **mapa-casca 5.10, the shell's ranges.** Left out: the header's focus ring (223-226); `.hd-usuario` a second time (1567); `.badge-cnt` (123-130); the skip link (1224-1227); the banners (1568-1573); `#role-sel` (1557). Not said: `.menu-itens` (146-155) is also the Demanda's "Mais" menu, and `.aba-selo` (178-180) also styles `#selo-rec-dia` inside Recursos.
5. **mapa-casca 5.10, "The Agenda's calendar styles `.cal*` (1150-1157, 1608) move to the rail".** Also `.cal .dia` in 1587 (mapa-pedidos has it, its line 120). And they cannot simply move: a day is a bordered button (1153), the chosen day an outline (1156), and "today" has neither a class nor a style (js/views/agenda.js:132).
6. **mapa-casca 1.5, the layers.** Left out: the z-indexes 1 and 2 of the sticky cells (573, 1048-1049), 2 and 30 of the map's bars (1355, 1359) and the TV page's 2, 3, 4.
7. **mapa-casca (5.5, 5.8 item 9, 5.10) and mapa-escala (its line 313), the print rule.** mapa-casca has the rule and its tag selectors. Left out by both: it leaves the drawers, the pop-up, the tooltip and the banners on the page, and nothing tests it or calls `window.print()`.
8. **mapa-motor, its line 234: the styles of the Janelas are "239, 784-791, 1594".** Left out: 495, the struck-through take-off time of a closed window, which the same map describes at its line 77 without the line.
9. **mapa-escala, its line 390: moving the Escala's phone rules costs "css/app.css:523-558".** The list's cards are 534-557; 524-528 and 530-531 belong to shared components, the Painel's buttons and the BI's filters; 529 and 532-533 are the Escala's toolbar and summary. Its line 352 writes `#tl-pop`: the rules are on the class `.tl-pop` (1399-1450).
10. **mapa-recursos** cites the shell's and the views' rules (184-186, 228, 235, 847) and, of the screen's own, only 802-808. Left out: "Ordem no hangar" has no CSS of its own and uses the Rodízio's `.fila`; `.saldo` (836) has no emitter.
11. **mapa-demanda** cites 1546, 184-188 and 235 only. The Demanda's rules are in seven stretches (section 3), two of them generic (`tr.off`, `tr.on`, 577-578).
12. **mapa-pedidos, its line 268: 24 occurrences of "agenda" in the stylesheet.** Confirmed. They are at 182 (twice, a comment), 244, 245, 1146-1149, 1158, 1159, 1172 (twice), 1173 (twice), 1175-1179, and five times the verb of the booking feature in comments (1288, 1315, 1322, 1448, 1599), which a rename must skip. `#ag-erro` (1160-1161) does not contain the word.
13. **No map lists** the rules with no emitter (section 8), the source-order pairs or the values shared with JavaScript (section 7).

One assumption of the request that the code's history does not support: "independent workstreams in parallel …, as the `abas-*` branches did". Those branches were stacked, one on top of the other (docs/PLAN.md:443, "One PR per step, stacked"; merges 7b377be and a0782fe carry a lower branch into the next one), and so were the Painel's (docs/PLAN.md:459, 461). The repo has no precedent of two branches editing this file at the same time.

## Implications for the plan (suggestions)

Each item is a suggestion, with its cost and its risk.

1. **Add a step zero to the foundation: regroup the stylesheet by owner, with no change of computed style.** Contiguous, labelled sections in the order tokens, base, components, shell, each screen, drawers and dialogs, phone blocks, print, TV; the four dead rules of section 8 removed. Every later step then has its own stretch. Cost: one mechanical commit that reorders most of the file (the rules of section 2 that are out of place, and the three mixed phone blocks split by owner or kept whole at the end). Risk: the source-order pairs of section 7; the full e2e suite is the only check, and print and the tooltip-in-drawer case are not covered by it.
2. **Or split it into files loaded in a fixed order** (for example base, shell, one per screen, `painel.css` for both pages, `tv.css`). The policy already allows it (`style-src-elem 'self'`, index.html:9; test/unit/csp.test.js:51 checks only external stylesheets), and there is no build step to change. Cost: step zero plus the `<link>` tags of two pages and the row of README.md:198. Risk: more requests per page on GitHub Pages; a forgotten file on `painel.html`; order across files is harder to see than order in one file.
3. **Parallel steps add, the last step deletes.** A to E write only new rules in their own section and leave their old selectors in the shared lists; step I prunes them. Without this, A, B and C all edit 1089; A, B and G edit 1589; B and C edit the rule 239-241 and 1594; A and C edit 237 and 1132; B and H edit 1591 and 1598; C and G edit 577. Cost: dead selectors live until step I. Risk: new markup that reuses an old class (`cd`, `tr.on`, `tr.off`, `.cel`) picks up the old rules.
4. **Ownership per step.**

   | Step | May touch |
   |---|---|
   | F1 | 1-49 (new tokens in three places); 61-230 except 216-222; 234-247; 1224-1227; 1550-1574; the print block; 1586-1588; new sections for the panes, the rail and the pipeline |
   | F2 | a new section for the list and the detail; 848-854; the filter (855-873, 1089-1097) |
   | F3 | nothing expected |
   | A | 992; 1068-1069; 1076-1078; 1229; 1245-1257; 686-691 |
   | B | 481-514; 517; 784-843; 1696-1698 |
   | C | 723-731; 1041-1067; 1084-1087 |
   | D | 1146-1161; 1172-1179 |
   | E | nothing |
   | G | 347; 577-578; 580-596; 598-599; 733-749; 979-987; 1546; 1694-1695 |
   | H | 309-346; 348-355; 468-470; 600-609; 693-722; 751-755; 988-991; 1181-1206; 1259-1450 |
   | I | the deletions of item 5; the shared lists of item 3 |
   | nobody (the request says their behaviour does not change) | the Painel and the TV (357-467, 1615-1644); Cursos (874-976, 993-1040); Rodízio (1135-1144); Minha conta (1162-1170); BI (257-269, 1208-1218, 1496-1498); Manual (1500-1518, 1689-1693); the dialogs (611-685); toasts and tooltips |

   Cost: none beyond writing it down. Risk: the components (216-217, 249-256, 283-308, 471-480, 515-516, 560-576, 597, 756-782, 844-854, 1231-1243, 1547) need one named owner for the whole parallel phase, or a rule that nobody changes them.
5. **What step I deletes, if the request is followed as written.**
   - Header date: 77-105; the `data` area in 68, 194, 197, 203; 208; `.topo-data` in 1555; `.topo-ico` and `.topo-data-campo` in 1586-1587; `#dt` in 242 and 244.
   - The nine tabs: 165-177; 184 and 186; `#nav` in 1554; 1588. `.aba-selo` (178-180) stays while any badge does.
   - The Agenda's calendar: 1150-1157; `.cal .dia` in 1587; 1608; 1147-1149 if the page stops having two columns.
   - Janelas de operação: 785-791; 239; `.janela` in 1594; 495 if nothing marks a closed time any more.
   - The wide cadastro tables: 281; 692; 992; 1068-1069 and `.ir-para-demanda` in 185; 1076-1078; 1107-1112; 1114-1125; 1127-1132; 1229; 1245-1257; `.tg` in 1589 and 1607.
   - The editing drawers: 1084-1087; 729-731; `.habs-painel label.hab` in 1594; 686-691; the second selector of 623. The frame (1455-1463) stays for the Histórico and the Sugestões.
   - The availability grid: 1041-1054; 1056-1067; 723-725; 240; 1596.
   - The Demanda table: the lines of step G above; `.btn-add-mis` in 1589; `#onlyfly` in 244.
   - Recursos in two views: 792-799; 800-808 once Ordem no hangar has its new place; 845-847 if Instrutores loses its split too.

   Cost: about 225 whole lines, an eighth of the file, plus single selectors in a dozen shared rules. Risk: the next item.
6. **Before deleting the cadastro rules, give the Cursos missions table its own.** Move what it borrows (1070, 1074, 1080-1081, 1104-1106, 1113, 1126) under `.programa`. Cost: about 10 lines. Risk: the Cursos phone tests (test/e2e/celular.spec.js:239, 251; test/e2e/cursos.spec.js:1164) are the only guard.
7. **Keep the TV page out of reach of the shell's rewrite.** mapa-casca 7.4 already suggests scoping every new shell rule to the app's page (a class on `index.html`'s `body`, or `body:not(.tela-painel)`). Add to it: treat the rows of section 6 as a contract (`main`, the generic table rules, the fields, `.btn`, `.erro-campo`, `#login-erro`, `p.h`, `[hidden]`), or give the TV page its own two files if the stylesheet is split (item 2). Cost: trivial.  Risk: forgetting one breaks `painel.html`; 45 e2e tests run only on that page (painel-tv 32, painel-sessao 13; mapa-testes-e-docs, its line 536).
8. **Scope the generic selectors before F2 writes the list.** mapa-casca 7.3 covers `section` and the print rule's tags. Add: `tr.on` and `tr.off` (577-578) to `#dem` and `table.disp`, and do not build the list as a bare `<table>` (562: 840 px minimum; 563-575: sticky head, padded cells). Cost: trivial. Risk: none found; the Demanda's and the grid's rows keep their classes.
9. **The multi-value filter needs a wrapping flex parent.** The request puts the filter "above the list, at the top of the pane": outside a `.bar`, the panel's own line (864) and the phone sizes by id (1089) stop working. Give the pane's top a `.bar`, or move those two declarations into the component. Cost: small. Risk: the two filter tests at 390 and 320 px (test/e2e/celular.spec.js:174, 217).
10. **Decide what print is.** Either keep it as the Escala's and add the rail, the panes, the pipeline and the drawers to 1576, or delete 1575-1581. Cost: trivial either way. Risk: nobody tests it; with the detail pane showing personal data, a print rule by tag is the only thing between that pane and the paper.
11. **Write the stacking order into the plan** (section 7) and say where the rail and a selected row's detail sit: below 60 they stay under every tooltip, menu, pop-up and drawer. Cost: none. Risk: the drawers (200 and up) cover the rail, as mapa-casca 7.14 already says.
12. **Keep the 44 px block keyed on the viewport and on the pointer even if the cards move to container queries** (mapa-casca 7.9): a touch target is about the device, not the pane. Cost: none. Risk: none.

<!-- fim -->
