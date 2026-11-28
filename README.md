# AutoEscala - ACPM

Planejamento da escala diária de voo, simulador e Ground School do ACPM.
Publicada no Cloudflare em https://autoescala.autoescala-acpm.workers.dev/ (branch `main`, sem etapa de build; veja
"Publicação"). Código em https://github.com/AutoEscala-Project/ACPM.

A escala é automática: cada alteração refaz a escala da data na hora (o motor leva milissegundos) e grava os dados e
a escala juntos. O manual de uso está no botão "Manual", no topo do app.

## Modos de uso

- **Compartilhado (site publicado):** login com e-mail e senha; os dados ficam no Supabase e todos veem as mesmas escalas
  (uma por data).
  O perfil da conta define o acesso: **Operador** edita e aprova os pedidos, **Gestor** só consulta, **Secretaria**
  registra pedidos em Pedidos, que aguardam a aprovação (a escala, o cadastro e os dados pessoais de alunos e instrutores ela só consulta: quem altera
  os dados pessoais são o Operador e o Administrador, e o servidor confere) e **Administrador** faz tudo o que o Operador faz e, além disso,
  cria e exclui contas (em "Minha conta" › Usuários) e muda os cursos e o programa de cada um (aba Cursos). O cadastro
  aberto é desligado. Em "Minha conta", cada pessoa troca a própria senha e o e-mail (o e-mail novo vale depois dos
  links de confirmação, que dependem do SMTP do Supabase). A primeira conta de administrador sai de
  `scripts/criar-conta.mjs`.
- **Local (`localhost`):** sem login, dados só no `localStorage` do navegador. Em localhost, `?supabase=previa` usa o
  projeto de prévia (com login).

| Endereço | Projeto Supabase |
|---|---|
| https://autoescala.autoescala-acpm.workers.dev/ | `acpm-escala` (produção) |
| https://autoescala-previa.autoescala-acpm.workers.dev/ (prévia, branch `previa`) | `acpm-escala-preview` |
| https://gdruumond.github.io/ACPM/, https://thephfernandes.github.io/ACPM/ | os mesmos, enquanto os endereços antigos existirem |

Um endereço fora desta tabela (e fora do localhost) abre o app no modo local, sem banco: `js/config-supabase.js` só
liga a produção ou a prévia pelo nome exato do site. Ali o app mostra no alto um aviso que não se fecha (`#aviso-endereco`): o que se
faz fica só naquele navegador, e o endereço do app é o da produção. No localhost o modo local não tem o aviso.

## Rodar localmente

A aplicação usa módulos ES, então precisa ser servida por HTTP (abrir o `index.html` direto do disco não funciona):

```sh
npm install
npm run serve      # o endereço sai no terminal: http://localhost:<a porta desta pasta>
```

Cada pasta do repositório (o clone e cada worktree) tem a sua porta, tirada do caminho dela (`scripts/porta.mjs`: de
4200 a 4898, par): o app de duas pastas roda ao mesmo tempo sem disputar a porta. `PORT=4173 npm run serve` escolhe
outra (a 4173 é a que o login do Supabase aceita na volta de um link de e-mail, `supabase/config.toml`). Duas pastas
coincidem 1 vez em 350: na segunda, `npm run serve` para com `EADDRINUSE` e os testes E2E com o "is already used" do
Playwright; `PORT=<outra porta par> npm run serve` e `PORT=<a mesma> npm test` mudam o app e os testes juntos (os testes
na porta seguinte à de `PORT`).

## Testes

```sh
npm test               # lint + unitários + E2E (o "verde" de cada mudança: CI=1 npm test)
npm run lint           # ESLint e as exportações sem uso (scripts/exportacoes-sem-uso.mjs)
npm run test:unit      # motor de alocação, regras e camada de dados (node:test)
npm run test:e2e       # aplicação no navegador (Playwright)
```

- Quanto leva: `CI=1 npm test` leva uns 4 minutos num Mac de 10 núcleos (medido em 24/11/2026: o lint em segundos, os
  unitários em uns 5 s, os 578 testes E2E em 3,6 min, 6 deles pulados sem as senhas do site publicado). No CI, o E2E
  roda em duas partes paralelas (`npx playwright test --shard=1/2` e `2/2`), cada uma com 15 minutos.
- Os testes E2E sobem o próprio servidor na porta seguinte à da pasta (com `PORT`, na seguinte a ela;
  `playwright.config.js`), sem reaproveitar um servidor que já esteja rodando: uma porta ocupada é erro ("is already
  used"), nunca os arquivos de outra pasta.
- Os testes E2E chegam às telas pelos drivers de `test/e2e/telas/` (reexportados por `test/e2e/fixtures.js`): `casca.js`
  (abrir e entrar, `appPronto`, as abas, a data, o Histórico, o menu da conta), `recursos.js`, `instrutores.js`,
  `alunos.js`, `processamento.js` (a lista do Processamento, o detalhe, "Atualizar a escala", a linha de estado, `voarPeloPedido`), `pedidos.js` (a lista, o detalhe e o formulário de Pedidos), `escala.js` (ler, aprovar, reabrir, exportar) e
  `cursos.js`; `invariantes.js` tem as conferências de todas as telas (o nome para o leitor de tela, os 44 px, a página
  que não rola de lado) e `percorrerTelas`, que passa por todas as abas e pelos `ESTADOS` de cada driver. Um seletor
  reservado (`#btn-recolher-trilho`, `#rec`, `#ins`, `#det-ins*`, `#proc-atualizar`, `#ag-*`…) aparece só no driver dele e nos testes da tela dona
  dele (`test/unit/donos-dos-seletores.test.js`): quando uma tela muda, mudam o driver e os testes dela. As frases que o
  Manual precisa dizer (e as que saíram) ficam em `test/e2e/manual-frases.js`, num bloco por tela.
- Na primeira vez, `npx playwright install chromium` baixa o navegador dos testes.
  Para usar o Google Chrome já instalado: `PW_CHANNEL=chrome npm run test:e2e`.
- Para testar uma versão publicada em vez do servidor local:
  `BASE_URL=https://autoescala.autoescala-acpm.workers.dev/ npm run test:e2e` (com a barra final).
- Os testes E2E comparam a escala gerada com snapshots em `test/e2e/__snapshots__/`. Se uma mudança
  de comportamento for intencional, atualize-os com `npx playwright test --update-snapshots` e revise o diff.
- `test/fixtures/goldens-do-motor/` guarda a escala aprovada do motor para 40 cenários aleatórios e para o
  dia de exemplo (a entrada dele, a demanda do antigo botão "Preencher exemplo", fica congelada em
  `exemplo-estado.json`), um arquivo por cenário e um voo por linha. Depois de mudar uma regra do motor de propósito,
  regrave com `node scripts/capturar-goldens-motor.mjs` e revise o diff: ele mostra os voos que mudaram. Os dias com
  voos fixos (`test/fixtures/conferencia-do-motor.json`, uma impressão por dia) se regravam com
  `node scripts/capturar-conferencia-motor.mjs`.
- Os testes usam somente nomes e pesos fictícios.
- A planilha do Excel (o modelo do aeroclube) é conferida por fora em `test/helpers/xlsx.js`: o ZIP é lido com o zlib
  do Node, a estrutura é comparada com a do modelo e o lugar de cada voo sai dos rótulos da própria planilha, em dias
  aleatórios (`test/unit/planilha.test.js`) e contra o CSV da mesma tela (`test/e2e/planilha.spec.js`).
- O modo compartilhado é testado com um servidor Supabase falso (`test/e2e/supabase-falso.js`, o roteador; a agenda e
  os dados pessoais em `test/e2e/falso/`) que segue o mesmo contrato do banco. `test/e2e/publicado.spec.js` entra no
  site publicado com login real (só roda com as senhas das contas no ambiente: veja o cabeçalho do arquivo);
  `ACPM_INICIO='./?supabase=previa'` o faz entrar na prévia pelo app de uma pasta (`BASE_URL=http://localhost:<porta>/`).
- `npm run test:db` (os testes pgTAP, no banco da prévia) recusa o projeto de produção.

## Banco de dados (Supabase)

- Esquema e regras de acesso em `supabase/migrations/`; testes pgTAP em `supabase/tests/database/`.
- Rode os testes do banco **somente no projeto de prévia** (o `supabase/` local fica vinculado a ele):
  `SUPABASE_DB_PASSWORD=... npm run test:db` (cada teste roda numa transação desfeita no final).
- Aplicar migrações: `supabase db push --remote` (prévia) ou `--remote=<ref de produção>`.
- Contas: `SUPABASE_DB_PASSWORD=... SENHA_NOVA=... node scripts/criar-conta.mjs <email> <operador|gestor|secretaria|administrador> "<nome>"`
  (depois da primeira conta de administrador, as outras saem de "Minha conta" › Usuários).
- Configuração do Auth (SMTP, senha mínima de 12 caracteres e o e-mail da troca de endereço, em
  `supabase/templates/`): `SUPABASE_AUTH_SMTP_USER=<gmail> SUPABASE_AUTH_SMTP_PASS=<senha de app> supabase config push`
  (prévia) ou com `--remote=<ref de produção>`. Confira antes com `supabase config diff`.
- Dados fictícios na prévia (só num banco sem dados): `node scripts/semear-previa.mjs`.
- Escalas fictícias nas próximas datas da prévia (só nas datas sem escala; usa o Supabase CLI autenticado, sem a
  senha do banco): `node scripts/semear-dias-previa.mjs [dias de operação] [data inicial]` (`SECO=1` só mostra). Com cada
  data, os pedidos da agenda (`scripts/pedidos-da-previa.mjs`): um aprovado para cada aluno com voo, ligado ao registro dele
  e a `importadas`, dois que aguardam a aprovação e um cancelado, gravados com a data numa consulta só (a data que falhou
  fica sem eles, e rodar de novo grava só as que faltam). O script recusa a produção antes de qualquer consulta.
- O ensaio da Onda 3 (o item 9 da lista dela, no plano): `node scripts/reiniciar-ensaio-previa.mjs` apaga as datas do
  ensaio (2098: os dias, os pedidos e o Histórico delas) e nada mais (o formato do cadastro e das outras datas fica como
  está; o `--ref`, se dado, só aceita o da prévia); numa repetição, depois da semeadura e dos CSVs, `--converter` chama a regra (a) da migração do
  G2. `SECO=1` só mostra; `--ref` escolhe outro projeto de prévia. Recusa a produção antes de qualquer consulta.
- Os testes do banco que tocam a agenda (`agenda*.test.sql`, `contas.test.sql`, `painel.test.sql`) contam os dias pelo
  horário de São Paulo: o `current_date` do servidor é o de UTC, e um pedido num domingo ou numa data que já passou é
  recusado mesmo pela exceção da coordenação.

## Meteorologia no painel (função `meteorologia`)

O pé do painel (a vista Painel da Escala e a TV da recepção) mostra o METAR e o TAF oficiais de Pampulha (SBBH) e de
Confins (SBCF), lado a lado, cada caixa com o nome do aeródromo em letras grandes e as mensagens; "Atualizado às" a hora
da observação do METAR (a local e a Z) só aparece quando a última busca falhou ou a observação passou de 90 minutos. As
mensagens vêm da REDEMET (https://api-redemet.decea.mil.br, a API do DECEA), a única fonte. A REDEMET pede uma chave,
que não pode ir para o navegador, então quem busca é a Edge Function `supabase/functions/meteorologia` (Deno): ela exige
a sessão de uma conta do app (o JWT, conferido pelo gateway e pelo Auth do projeto), manda a chave só no cabeçalho
`x-api-key` (nunca no endereço), pede o METAR das últimas 3 horas (`data_ini` e `data_fim`, em UTC: sem eles, a REDEMET
manda só a hora de agora, e a estação cujo METAR da hora ainda não chegou ficaria sem) e fica com o mais recente de cada
estação, pede o TAF sem janela (os em vigor) e fica com o que cobre agora, o emitido por último, guarda as mensagens 5
minutos na memória, desiste da REDEMET em 12 segundos e responde `{ gerado, estacoes: [{ icao, nome, metar, taf,
observado }] }` só às origens do app. A leitura das mensagens (`mensagens.js`) e o atendimento (`atendimento.js`) são
JavaScript puro,
testados também no Node (`test/unit/meteorologia-funcao.test.js`, com respostas de verdade da REDEMET em
`test/fixtures/meteorologia/`).

A TV da recepção também passa a seguir o "Configurar painel" com o servidor: a migração
`20261120150000_painel_do_dia_com_a_configuracao.sql` faz `painel_do_dia()` entregar, além do quadro do dia, o campo
`painel` do cadastro (só o quadro da lista, as colunas conhecidas, com `on` booleano, e as listas `auto`, `uma` ou
`duas`; o quadro ou as listas fora do formato saem; sem a configuração, `null`). O perfil da TV continua sem ler o
cadastro.

### Publicar (a função e a migração)

```sh
# 1. Prévia (acpm-escala-preview): a chave da REDEMET, a função, a migração e os testes do banco
supabase secrets set REDEMET_API_KEY=<a chave da REDEMET> --project-ref <ref da prévia>
supabase functions deploy meteorologia --project-ref <ref da prévia>
supabase db push --remote                       # a migração painel_do_dia_com_a_configuracao
SUPABASE_DB_PASSWORD=... npm run test:db

# 2. Produção (acpm-escala), depois de conferir a prévia
supabase secrets set REDEMET_API_KEY=<a chave da REDEMET> --project-ref <ref de produção>
supabase functions deploy meteorologia --project-ref <ref de produção>
supabase db push --remote=<ref de produção>
```

O `verify_jwt = true` de `supabase/config.toml` vale no deploy (é o padrão; não use `--no-verify-jwt`). O único segredo
da função é `REDEMET_API_KEY` (a chave da REDEMET, que ela lê com `Deno.env.get`); nunca a escreva no repositório, nos
testes nem em mensagens de commit. Sem ela, a função responde 503 ("A meteorologia não está configurada no servidor…") e
o pé do painel diz "Meteorologia indisponível". `SUPABASE_URL` e `SUPABASE_ANON_KEY` o Supabase já dá. No Supabase CLI 3, o projeto vai em
`--remote=<ref>` (o `--project-ref <ref>` das versões anteriores). Antes do deploy, `npx deno check
supabase/functions/meteorologia/index.ts` confere os tipos.

Se, na prévia, o pé do painel disser "Meteorologia indisponível" com a conta conectada e os logs da função mostrarem
401 "Invalid JWT" (o gateway pode recusar a sessão nos projetos que passaram às chaves de assinatura novas do JWT),
publique a função de novo com `--no-verify-jwt`: ela continua exigindo a sessão de uma conta, que confere no Auth
do projeto.

**A ordem:** a função e a migração na prévia, conferidas na prévia (https://thephfernandes.github.io/ACPM/: o pé do
painel com as duas caixas, e a TV com o quadro, as colunas e as listas do "Configurar painel"), depois as duas na produção, e só
então o merge. As duas só acrescentam: o app no ar continua igual com elas (ele não chama a função e ignora o campo
novo). E o app novo não depende delas:

- **Sem a função publicada** (404), sem a chave da REDEMET (503), com a REDEMET fora do ar ou sem conexão, o painel e
  a TV abrem e funcionam como antes, e o pé do painel diz **"Meteorologia indisponível"** (com mensagens já recebidas,
  elas ficam, cada caixa com a hora da observação do METAR dela). No modo local (sem servidor), o pé diz sempre "Meteorologia indisponível", sem busca.
- **Sem a migração**, `painel_do_dia()` responde como antes, sem o campo `painel`, e a TV mostra o padrão (Missões, com
  as colunas do padrão e as listas no Automático: duas lado a lado na TV Full HD), como hoje; a Escala segue a configuração de qualquer jeito (ela lê o cadastro).

## O recurso, a missão do curso e o 7º voo local do pedido da agenda

O pedido da agenda guarda o recurso (o tipo: C152, PA-34, Sim. Mono…): a missão diz os permitidos, o recurso diz os
horários, e a importação põe o pedido na demanda nele. A migração `20261125230000_agenda_com_recurso.sql` acrescentou a
coluna `recurso` (vazia nos pedidos de antes, que entram no recurso padrão da missão) e a função
`registrar_solicitacao` com o recurso, o 11º argumento.

A migração `20261127100000_missao_do_curso_e_limite_do_pedido.sql` acrescenta as colunas `missao_do_curso` (o id da missão
do programa do curso que o aluno vai voar; vazia sem curso e nos pedidos de antes), `limite_confirmado_por` e
`limite_confirmado_em` (quem confirmou o 7º voo local no mesmo horário, e quando) e a função `registrar_solicitacao` de 13
argumentos (`p_missao_do_curso`, `p_confirmar_limite`, nenhum com valor padrão), a que o app chamava até o passo D1. Ela recusa
(`22023`, com a dica do campo) o pedido sem recurso ou num recurso que a missão não permite (`recurso`), o Noturno fora das
17:30 e o Voo Solo fora das 06:30 (`horario`) e a missão do curso que não existe, saiu do programa ou é de outro tipo
(`missao`); o 7º voo local passa com a confirmação, que fica registrada (sem ela, `PT422`, como antes). As funções de 11 e
de 10 argumentos ficam como estavam, para as abas abertas do app de antes. As regras estão também no modo local
(`js/backends/local.js`), no servidor falso dos testes (`test/e2e/falso/agenda.js`) e no cliente falso de
`test/unit/backend-supabase.test.js`, com os mesmos casos (`test/helpers/casos-da-agenda.js`), que são verificações de
`agenda-missao-do-curso.test.sql` e `agenda-locais.test.sql`.

**A ordem:** a migração na prévia (`supabase db push --remote`) com `npm run test:db`, e só então o merge: o app novo só
chama a função de 13 argumentos, e não tenta outra quando o servidor não a tem (o pedido não é registrado, e o app diz que
não foi possível registrar). Ela só acrescenta: o app no ar continua igual com ela. Depois, com nenhuma aba de antes aberta,
outra migração pode tirar as funções de 10 e de 11 argumentos.

## A aprovação dos pedidos da agenda (o passo D1)

A migração `20261129100000_aprovacao_dos_pedidos.sql` dá ao pedido uma situação: aguardando a aprovação, aprovado ou
cancelado, tirada das colunas (sem coluna de situação). Ela acrescenta sete colunas, todas vazias nos pedidos de antes:
`aprovada_em`, `aprovada_por` e `aprovada_usuario` (quem aprovou e quando), `aprovacao_retirada_em`, `_por` e `_usuario` (a
última retirada da aprovação; aprovado ou retirado, nunca os dois) e `horario2`, a 2ª preferência: outro horário exato, só
no pedido num horário específico e diferente do 1º (o pedido é um horário exato: não há disponibilidade).

As funções (todas `security definer` com o `search_path` vazio, menos a contagem; só quem está conectado as chama):

- `registrar_solicitacao` de 16 argumentos (a de 13 com `p_horario2`, `p_aprovar` e `p_esperar`, nenhum com valor padrão),
  a que o app chama. As de 13, 11 e 10 argumentos ficam como atalhos para as abas abertas do app de antes, e as quatro
  passam por uma função interna (`registrar_solicitacao_interna`, que ninguém chama pela API, nem com a chave
  `service_role`): a de 16 e a de 13 com as regras da de 13 (o recurso, os horários fixos e a missão do curso); a de 11 e a
  de 10 sem elas, como eram (o recurso pode faltar, e o que vem não é comparado com a missão). A de 9 argumentos (o pedido
  por período) saiu. Além das regras de antes, ela recusa a 2ª preferência igual à 1ª, fora do
  formato ou no Noturno e no Voo Solo (`22023`, `horario2`), o domingo e a data que já passou, mesmo pela exceção da
  coordenação (`PT403`, `domingo` ou `passada`, pela data de São Paulo) e `p_aprovar` de quem não é operador (`42501`,
  `aprovar`); o prazo agora diz a dica `prazo`, e a exceção da secretaria, `excecao`. O 7º voo local no mesmo horário
  passa com a confirmação (registrada) ou na lista de espera (`p_esperar`, sem nada registrado: quem espera é o motor);
  as duas juntas são recusadas (`22023`, `esperar`), e sem nenhuma, `PT422`, como antes. O pedido nasce aprovado com
  `p_aprovar` ou pela exceção; pelos atalhos, o do operador (e do administrador) nasce aprovado e o da secretaria aguarda.
  Desde o passo D2, o formulário manda `p_aprovar` com "Registrar e aprovar" (de quem opera a escala) e desligado com
  "Registrar sem aprovar" e "Registrar pedido" (a secretaria), e `p_esperar` com "Registrar na lista de espera".
- `cancelar_solicitacao`: como antes, mas o pedido aprovado de uma data que já passou não é cancelado (`PT403`, `passada`).
- `aprovar_solicitacoes(ids)`: os operadores aprovam de 1 a 200 pedidos (`22023`, `ids`) e recebem os ids aprovados agora;
  o já aprovado, o cancelado, o de uma data que já passou e o id que não existe ficam fora, e quem aprovou primeiro fica.
- `retirar_aprovacao_da_solicitacao(id)`: o pedido aprovado volta a aguardar, com o rastro (`P0002` para o que não está
  aprovado ou foi cancelado; `PT403`, `passada`, numa data que já passou).
- `solicitacoes_por_dia(de, até)` (`security invoker`): `{ "AAAA-MM-DD": { "aguardando": n, "aprovadas": n } }`, sem os
  cancelados; quem não lê a agenda (a TV, a conta sem perfil) recebe `{}`.
- `aprovar_solicitacoes_de_antes_da_aprovacao(dos_operadores)`, interna: a conversão dos pedidos de antes, que a migração
  roda uma vez (com `true`) e a do passo G2, `20261129100100_importados_ja_aprovados.sql`, de novo (com `false`: o que
  uma aba de antes do D2 importou depois do D1 e ainda aguarda; os casos em `test/helpers/casos-dos-importados.js`, no
  pgTAP `importados-ja-aprovados.test.sql`, que a roda duas vezes, e no modo local). Aprova o que a importação levou para o dia (numa
  data que já passou, todo id em `importadas`; de hoje em diante, só o que um registro da data ainda leva, voando ou não:
  "importação anterior") e, só com `true`, o que um operador ou administrador registrou de hoje em diante sem ter sido
  importado. Nunca o cancelado nem o de aprovação retirada; rodar de novo não muda nada.

As regras estão também no modo local (`js/backends/local.js`, sem contas: quem usa tem os direitos de operador, e os
pedidos de antes, sem as colunas da aprovação, são convertidos uma vez, com a marca `acpm4_agenda_aprovacoes`, gravada só quando há pedidos; a regra (a) do G2 de novo, uma vez, com a marca `acpm4_agenda_aprovacoes_g`), no servidor falso dos testes
(`test/e2e/falso/agenda.js`, com o atalho de 13) e no cliente falso de `test/unit/backend-supabase.test.js`, com os casos
de `test/helpers/casos-da-agenda.js` e `test/helpers/casos-das-solicitacoes.js`, que são verificações de
`agenda-aprovacao.test.sql`, `agenda-preferencias.test.sql`, `agenda-locais.test.sql` e `agenda-missao-do-curso.test.sql`
(`test/unit/espelho-do-banco.test.js` confere os nomes, as recusas e as constantes).

**A ordem:** a migração na prévia com `npm run test:db`, e só então o merge: o app novo chama a função de 16 argumentos e
não tenta outra. O app no ar continua igual com ela (o da produção chama a de 11 e, sem ela, a de 10; o da prévia antes do
D1, a de 13: as três agora são atalhos), exceto que o pedido do operador nasce aprovado e que o domingo, a data que já
passou e o cancelamento do aprovado de uma data que já passou são recusados. Na produção, ela vai antes do merge do D1, no
dia da publicação.

## O que a missão do curso exige do INVA

O que o INVA tem (`ins[].hab`), o que um recurso exige (`frota[].exige`) e o que uma missão do curso exige são listas de
ids do mesmo registro, `js/habilitacoes.js`. A migração `20261127110000_habilitacoes_da_missao_do_curso.sql` acrescenta a
coluna `missoes_do_curso.exige` (`text[]`, vazia em toda missão: nenhuma é marcada por ela; até 10 ids com letras
minúsculas, números e `_`) e recria `programa_do_curso` (a leitura, que devolve a lista) e `gravar_programa` (por onde
`salvar_curso` e `importar_cursos` gravam): a lista fora do formato é recusada (`22023`, `exige`), e a missão que vem sem
ela fica com a que tinha. A regra está também em `gravarCurso` (`js/programa.js`), que o modo local, o servidor falso e o
cliente falso usam, com os casos de `test/helpers/casos-do-programa.js` (verificações de `cursos.test.sql`). O estado da
escala deriva a lista de cada pedido pela missão do curso dele (`exige`, nunca gravado), e o motor também a pede do INVA.

**A ordem:** a migração na prévia com `npm run test:db`, e só então o merge (o app novo manda a lista em cada missão). Ela
só acrescenta: o app no ar continua igual com ela.

## A sessão da TV da recepção

A TV fica ligada dias seguidos, sem ninguém por perto, e nunca mostra um quadro velho como se fosse o de agora
(`js/sessao-da-tv.js`, usado por `js/painel.js`):

- **A sessão se renova sozinha** antes de expirar: faltando menos de 10 minutos, a cada busca do quadro e a cada 30
  segundos, e na hora quando a TV acorda, quando a página volta à vista e quando a conexão volta. Um 401 (o JWT recusado)
  em `painel_do_dia` ou na função `meteorologia` renova e tenta mais uma vez. A renovação sem resposta em 20 segundos
  (a conexão que caiu no meio) não segura as buscas: elas seguem com a sessão que ainda vale.
- **"Manter esta TV conectada"**, no login da TV (marcado por quem entra; só para a conta com o perfil Painel): **a senha
  da conta da TV fica guardada no navegador daquela TV** (`localStorage`, chave `acpm-<projeto>-painel-entrada`, em
  texto, ao lado da sessão). Quando a renovação é recusada (a sessão revogada ou perdida), a TV entra de novo sozinha
  com ela. A senha recusada (trocada) sai, e a TV pede o login. Outra conta nunca fica guardada (e o que estava guardado
  sai). *Sair desta TV* (o botão aparece com o mouse) apaga a sessão e a senha guardada. Use só na TV da recepção, com a
  conta da TV, que vê só o quadro do dia.
- **Sem uma busca boa há mais de 3 minutos**, o quadro sai da tela e fica o aviso "Painel sem atualização desde HH:MM:
  tentando de novo…"; quando renovar e entrar de novo não dão certo, o login aparece com "Sessão expirada: entre de novo
  nesta TV". O quadro volta sozinho na busca boa seguinte. Sem conexão não é sessão expirada: a TV ligada antes da
  internet, com a sessão guardada já vencida, mostra o aviso (não o login) e renova quando a conexão volta.
- **A recarga das 03:00** (as versões novas do app) só acontece com o endereço do app respondendo; sem conexão, a TV
  continua na página e tenta de novo a cada 5 minutos (recarregar sem conexão a deixaria na página de erro do navegador).
- No login da TV, a senha recusada, ou a de uma conta que não é a da TV, sai do campo (a tela é pública).
- Cada busca traz a configuração do painel (`painel_do_dia`, com a migração `20261120150000`): a mudança do
  "Configurar painel" chega a todas as TVs em até um minuto. Nada disso depende da migração nem da função: sem elas, a
  TV mostra o padrão e "Meteorologia indisponível", como antes.

## Formato dos dados

O cadastro e cada dia guardam a versão do formato (campo `esquema`). Para mudar o formato, acrescente um passo em
`js/migracoes.js` (com teste): as leituras aplicam os passos que faltam, o primeiro acesso de um operador regrava
no formato novo tudo o que estiver gravado (os dias e, por último, o cadastro) e o banco recusa conteúdo num formato
mais antigo do que o guardado. Nunca apague campos num passo: mantenha o que o passo não conhece.

Do formato 24 em diante, o formato dos cursos, o programa de cada curso vive em tabelas próprias. O número fica num
lugar só em cada ponta, `FORMATO_DOS_CURSOS` (`js/migracoes.js`) e `public.formato_dos_cursos()` (migração
`20261117200000_cursos_e_missoes.sql`), e `test/unit/espelho-do-banco.test.js` confere que é o mesmo. Se outro formato
chegar antes com o mesmo número, o aumento é essa linha em cada ponta, com o passo dos cursos (e o `ESQUEMA`)
renumerado em `js/migracoes.js`. O app lê os programas das tabelas e só o Administrador grava, por `salvar_curso` (no
modo local, os programas ficam em `acpm4_cursos`, e o Operador grava); o cadastro guarda a cópia de antes (`cursos`),
que ninguém mais grava. A conversão é única: no primeiro acesso de um Operador ou Administrador ao app no formato 24,
o programa do cadastro vai para as tabelas (`importar_cursos`, cada curso numa fase só, "Programa", com as missões na
ordem) depois dos dias e antes do cadastro, que, gravado no formato 24, a encerra. Até lá, quem só consulta vê o aviso
de que os programas ainda não foram trazidos do cadastro, com a próxima missão e o progresso desligados.

Para pôr o formato 24 no ar, nesta ordem:

1. a migração na prévia (`supabase db push --remote`) e `npm run test:db` na prévia;
2. a mesma migração na produção (`--remote=<ref de produção>`), **antes do merge**: ela acrescenta as tabelas e as
   funções e só alarga a regra dos resultados (PP, PC e INVA já vêm na tabela dos cursos, ainda sem programa), então o
   app no ar, no formato 23, continua como está;
3. o merge, e o app vai para o ar ("Publicação") no formato 24;
4. **uma abertura do app como Operador ou Administrador**, que faz a conversão única.

Depois, num PR à parte, com a conversão feita e nenhuma aba de antes do formato 24 aberta: tirar `importar_cursos` do
banco (e a chamada dela no app). A cópia `cadastro.cursos` fica.

No formato 26, o que um recurso exige do instrutor é uma lista no cadastro, `frota[].exige` (ids do registro de
`js/habilitacoes.js` ou a habilitação própria `aviao:<matrícula>`); o recurso com a habilitação própria e sem a lista
ganha `exige: ['aviao:<matrícula>']`, e a marca `habilitacaoPropria` fica como espelho dela. O número também protege o
`inativo` de alunos, instrutores e recursos (`stu[].inativo`, `ins[].inativo`, `frota[].inativo`, só `true`), que a aba
do formato 25 tiraria ao gravar o cadastro. O dia não muda. Só o app muda (o banco recusa o conteúdo de antes pelo
número): o primeiro acesso de um Operador ou Administrador regrava os dias e o cadastro no 26.

No formato 27, os instrutores podem ter duas habilitações novas do registro, `endosso_solo` (Endosso Solo) e
`navegacao_150` (Voo de Navegação ≥ 150 NM), que a aba do formato 26 tiraria como desconhecidas ao gravar o cadastro.
Nada é convertido: ninguém as recebe (são marcadas em INVAs › "Habilitações"), e nenhum tipo de missão as
exige; só uma missão do curso que as peça (Cursos). O número também protege, no dia, a confirmação do 7º voo local do
horário no pedido (`pedidos[].limiteConfirmado`, só `true`, vinda do pedido da agenda confirmado com "Registrar mesmo
assim"): com ela, o motor deixa esse voo passar do limite no minuto exato do pedido, sem tomar a vaga dos outros seis. Só
o app muda: o primeiro acesso de um Operador ou Administrador regrava os dias e o cadastro no 27.

No formato 28 (J), os horários fechados de uma data são `dia.fechamentos`, uma lista de `{ de, ate, categorias? }` em
minutos (`[de, ate)`; sem `categorias`, todos os recursos), no lugar das nove janelas de operação: o passo converte cada
sequência de janelas fechadas num intervalo (a janela 0 desde a meia-noite, a das 17:30 até 24:00) e mantém o `win`,
que só é lido onde não há `fechamentos`. Os pedidos perdem os períodos do dia (`jan` `manha`, `tarde`, `noite`; a
confirmação do 7º local sai junto) e o horário antigo `hN` e a preferência de 0 a 8 viram o horário da janela; o
horário exato fica. O cadastro não muda: sem `horarios.ground`, a Sala Ground usa os oito horários padrão, e sem a chave
dela em `av`, fica disponível. A aba do formato 27 tiraria `fechamentos` ao gravar o dia; o número novo a faz recusar.

No formato 29 (C), a disponibilidade de cada instrutor na data é `dia.ins[<id>].faixas`, uma lista de `{ de, ate }` em
minutos (`[de, ate)`, 06:30 ≤ `de` < `ate` ≤ 24:00, em ordem, sem se tocar, no máximo 8), quando ele pode começar uma missão, e
`dia.ins[<id>].pausas`, no mesmo formato, quando ele não voa de jeito nenhum (`js/disponibilidade.js`). O passo converte
os nove tempos de antes (`aw`, lido como a data aberta o lia: só `true` marca; com outro tamanho, o dia todo) com os
inícios congelados do J (`INICIOS_DOS_TEMPOS`): cada sequência de tempos marcados vira uma faixa e cada intervalo entre
duas sequências, uma pausa, então o almoço guardado continua almoço; o instrutor que já tem `faixas` fica com elas. O
`aw` fica e só é lido onde não há `faixas` (os dias antes do 29, os estados dos goldens), pelas faixas e pausas dele. A
regra é a do início (o commit "regra" do C, decisão 1 do Pedro): a missão começa dentro de uma faixa (o fim não entra: até
17:30 não inclui o Noturno) e pode terminar depois dela, sem tocar nenhuma pausa; a que termina até as 06:30 não pede
faixa, e a que começa antes delas começa às 06:30 para a regra. Do `aw`, só o fim da última faixa do dia muda de sentido
(o intervalo entre duas sequências continua pausa); nenhum número gravado muda, então o formato continua o 29. A aba do
formato 28 tiraria `faixas` e `pausas` ao gravar o dia; o número novo a faz recusar. Desde a tela do C, nada muda o `aw`
(os turnos, "Editar faixas" e o "Marcar disponível" do agendamento mudam as faixas e as pausas; a reversão de um
agendamento de antes, que guardou o `aw`, devolve as faixas dele): o dia gravado leva o `aw` só de quem ainda não tem
faixas, e a data nova copiada da anterior leva as faixas de cada instrutor (as do `aw`, de quem não as tinha), sem o `aw`.

No formato 30 (E), nada é convertido: o número protege o que a aba do formato 29 tiraria ao gravar o dia. Nos pedidos, a
marca de que a missão do curso veio do programa na entrada do pedido da agenda (`pedidos[].etapaDoPrograma`, só `true`,
só com a missão do curso) e os dois horários exatos do pedido com a 2ª preferência (`jan` `h<minuto1>|h<minuto2>`, dois
minutos diferentes, o 1º primeiro: o voo começa num dos dois, o motor tenta o 1º e depois o 2º); no dia, as exportações
da data (`exportacoes`: `csv`, `pdf` e `xlsx`, cada um com `em`, `por` e a `impressao` do que foi exportado, 8
hexadecimais; `{}` sem nenhuma, `js/exportacoes.js`) e quem reabriu a escala (`reabertura`: `{ em, por }`, como a
aprovação; `null` sem), que o H escreve e que valem só para a própria data; e os ids que saem de `importadas` com a
saída do pedido (a partir do G2). Só o app muda: o primeiro acesso de um Operador ou Administrador regrava os dias e o
cadastro no 30.

No formato 31 (L), nada é convertido: o número protege as limitações do aluno no cadastro (`stu[].limitacoes`: `recursos`,
os tipos de avião ou de simulador em que ele voa, e `horarios`, `{ de, ate, dias? }` em minutos, `[de, ate)`, das 06:30 à
meia-noite, no máximo 8, com `dias` de 0, domingo, a 6, sábado, ou sem eles, todas as datas; `js/limitacoes.js`;
sem nenhuma, o campo não existe), que a aba do formato 30 tiraria ao gravar o cadastro. Decisão do Pedro, 28/11: o De
começa às 06:30, o `PRIMEIRO_HORARIO` dos horários de decolagem (`js/horarios.js`); o guardado das 06:00 às 06:29 é lido
como 06:30 (`noInicioDoDia`, a conversão do #106), o que então termina até as 06:30 sai e o que a mudança fez igual a
outro fica um só, sem número de formato (a leitura é idempotente, e nenhum início que a escala oferece muda de lado). `bl`, `voaCom` e `kg` ficam onde
estão. Só o app muda: o primeiro acesso de um Operador ou Administrador regrava os dias e o cadastro no 31.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | A marcação do app: o topo (a marca e as ferramentas; sem a data), a linha de produção (`nav#linha`: os quatro cartões das etapas, os cadastros, o Rodízio e o BI), o trilho (`aside#trilho`, sempre à vista: no alto a data aberta, quantos avisos e `#btn-recolher-trilho`, que recolhe o calendário; embaixo o calendário e os avisos da data, que recolhem em `#btn-avisos`, com o resumo dos grupos da escala em `#avisos-resumo`) e as onze telas (`main#conteudo > section.tela`), dentro de `div.casca`, com os avisos do app acima |
| `painel.html`, `js/painel.js` | TV da recepção: o painel de hoje na tela toda, no quadro, com as colunas e as listas da configuração do painel (com o servidor, a que `painel_do_dia` entrega; sem ela, o padrão), e a meteorologia no pé |
| `css/*.css` | Os estilos, uma folha por dona, que `index.html` carrega nesta ordem (a da cascata): `base` (as cores e os temas claro e escuro, os títulos, os campos), `componentes` (botões, barras, tabelas, etiquetas, o filtro de vários valores, os avisos, as dicas), `painel` (o painel no estilo dos aeroportos e a meteorologia), `tv`, `casca` (a barra do topo, a moldura `.casca`, as telas, o login, a impressão), `linha` (a linha de produção: os cartões, os estados, aberta, recolhida e a faixa do celular), `trilho` (a data aberta, o calendário e os avisos da data, ao lado da tela ou em cima dela; recolhido, a faixa estreita ou a linha), uma por tela (`escala`, `processamento`, `agenda`, `recursos`, `instrutores`, `alunos`, `cursos`, `rodizio`, `bi`, `conta`, `manual`), `gavetas`, `dialogos`, `lista` (o componente de lista e detalhe) e `toque` (os alvos de 44 px dos componentes no celular, por último). A TV carrega `css/app.css`, que importa as cinco das duas páginas (`base`, `componentes`, `painel`, `tv`, `toque`). `test/unit/estilos.test.js` confere as listas; `node scripts/medir-estilos.mjs` mede o estilo de cada elemento das duas páginas em várias larguras, temas e telas (com `--comparar antes.json depois.json`, a diferença entre duas versões) |
| `js/config.js` | Janelas, missões, limites de peso e a frota inicial |
| `js/frota.js` | A frota no cadastro (matrícula, tipo, os atributos "Só Parafuso", "Só VFR" e "Habilitação própria", o que o recurso exige do instrutor, `exige`, e o inativo): validação de um recurso novo, `comAtributo` (marcar e desmarcar um atributo; a habilitação própria também em `exige`), `comExigencias` (a lista `exige` de uma vez, sem a habilitação do tipo), `comExigencia` (uma caixa de "Exigir também…", em "Habilitações que o INVA precisa", e a reversão dela, `setExigencias`: só aquela habilitação muda), `quemOpera` (os INVAs ativos que podem operar o recurso) e as matrículas de cada tipo |
| `js/categorias.js` | Categorias de recurso (C152, C172, Simulador, PA-34 e Sala Ground): os filtros da Escala e do BI e os grupos da lista de Recursos |
| `js/inativos.js`, `js/eventos/inativos.js` | O inativo no cadastro (`inativo: true` em alunos, instrutores e recursos; a chave "Ativo" na linha de Alunos, na de INVAs e na de Recursos, um clique em cada sentido, com o aviso do que muda na data, `usoNaData` e `avisoDoInativo`, e a reversão `setInativo`): vale na data aberta de hoje em diante. O motor, a simulação do agendamento e as listas da escala leem o estado derivado (`estadoParaEscalar`: o instrutor inativo não vem, o recurso inativo fica indisponível), nunca gravado, e só nele tiram o inativo (`inativoNoEstado`); as listas do cadastro ("Não escalar com", "Priorizar com", o formulário da Agenda, os alunos de um curso) ficam sem ele em qualquer data; as filas do rodízio e o hangar ficam com os ativos (`ativosNaData`); a Escala avisa dos voos de quem ficou inativo (`voosComInativos`), com "Refazer a escala"; o pedido do aluno inativo fica registrado, "Aluno inativo", fora dos pendentes e da importação |
| `js/habilitacoes.js` | O registro das habilitações: as individuais dos instrutores, os grupos do painel e do filtro (`GRUPOS_DE_HABILITACAO`), o que cada missão exige, o que cada tipo de recurso exige (`habilitacoesDoTipo`) e o que cada recurso exige (`exige`: ids do registro ou a habilitação própria `aviao:<matrícula>`) |
| `js/rodizio.js` | Filas do rodízio (cheque, MLTE, noturno e C172) e a rotação de uma data para a seguinte |
| `js/cursos.js` | Os cursos iniciais (PP, PC e INVA), o formato da sigla e do código da missão, o curso de cada aluno e o programa guardado no cadastro (`cursos`, a cópia de antes do formato 24, que ninguém mais grava) |
| `js/programa.js` | O programa dos cursos em fases (as tabelas dos cursos; no modo local, `acpm4_cursos`): a regra de quando voar cada fase e cada missão, o Noturno em trechos, as operações do editor da aba Cursos e a gravação e a conversão única do cadastro, com as regras e os erros do servidor |
| `js/modelos-de-curso.js` | Os programas prontos que o Administrador põe num curso: o cronograma do Piloto Privado (P.I PPA 001A), com 9 fases e 47 missões |
| `js/progresso.js` | A próxima missão de cada aluno pelas regras do programa (a liberada; as fora da ordem, com o motivo), o progresso no curso e "Colocar no curso até…" (as missões que a colocação aprova e as que se escolhem) |
| `js/resultados.js` | Os resultados das missões (aprovado ou reprovado; pendente desfaz um engano): a situação de cada missão do aluno, as regras do registro, as do servidor, a missão anterior do aluno e a data e o voo do resultado sem voo |
| `js/resultado-na-tela.js` | O resultado registrado pela tela (a linha do voo, o resultado sem voo e a colocação no curso): o servidor, a situação do aluno e o histórico |
| `js/agenda.js` | Prazo da agenda de solicitações (13:00 do dia anterior), as datas em que um pedido pode ser registrado (`datasParaRegistrar`, a "Data do pedido"), os recursos da missão do pedido, o limite de voos locais e o pedido que cada solicitação vira; e, da página Pedidos (D2), o estado de cada pedido (`situacaoDaSolicitacao`, `solicitacaoAprovada`), o resumo da data, se o pedido voa no dia (`pedidoVoaNoDia`), as cinco condições da escala mudar na hora depois de uma ação de Pedidos (`motivoSemEntrada`), a regra (a) de novo para o modo local (`aprovarOsImportadosDeNovo`, G2), a contagem do trilho e a 2ª preferência; e o que mudou entre duas leituras, com o texto do aviso (`novidadesDasSolicitacoes`, `textoDasNovidades`, D3) |
| `js/solicitacoes-da-data.js` | Os pedidos da data aberta, um cache só (a lista de Pedidos, o cartão, o trilho, o Processamento): a leitura mais nova vale, a de outra data não entra, a que falha guarda o erro e a lista de antes, e a escala que mudou em outro computador fica marcada até a data ser lida de novo (`js/main.js` a lê na abertura). A vigia (`vigiarSolicitacoesDaData`, ligada por `js/eventos/agenda.js`) lê de novo a cada minuto com a página à vista, na volta à página e da conexão (com a última leitura de mais de 30 s) e quando outra aba muda a agenda (modo local), perguntando também se a escala da data mudou (uma pergunta de cada vez; no modo local, também quando outra aba grava o dia da data aberta: `diaMudou` compara o dia guardado com o que esta aba leu ou gravou); o que mudou entre duas leituras, menos o que este navegador mudou (até uma leitura boa o mostrar), vira o aviso das novidades, que fica o tempo de ler (com o 1º da lista de espera da vaga de um cancelado que ainda espera, `primeiroDaListaDeEspera` em `js/rejeicoes.js`). Ela só lê |
| `js/views/agenda.js`, `js/eventos/agenda.js` | Pedidos como lista e detalhe (D2): a lista por estado (aguardando aprovação, aprovados, cancelados), "Aprovar" na linha, "Aprovar todos", o detalhe só de leitura (aprovar, retirar a aprovação, cancelar, "Registrar de novo…"; "Na escala", a situação do pedido no Processamento: "Na escala 08:20", "Em espera às 08:20 · 1º", "Entra com Atualizar a escala"…, a mesma da linha), os avisos (a leitura que falhou, a escala que mudou em outro computador) e o formulário do pedido novo (os tipos e os horários fora das limitações do aluno, na data do pedido, desligados, com o porquê; a duração do pedido sem a missão do curso, a da missão com que ele entraria na escala, `missaoDaEntrada`, G2) e, com nada escolhido, para quem só consulta, o vazio do componente. Depois de registrar e aprovar, aprovar, retirar a aprovação e cancelar, a escala da data muda na hora (`depoisDeMudarPedidos`, em `js/conciliacao.js`: o aprovado entra, o cancelado e o sem aprovação saem), só na data aberta já gravada (`diaJaGravado`, em `js/actions.js`), com os resultados e os cursos lidos, sem mudança em outro computador (`ApiClient.diaMudou`) e para quem opera a escala; senão, "Atualizar a escala", no Processamento. As últimas novidades da vigia ficam também nos avisos do trilho (`novidadesDosPedidos`) |
| `js/processamento.js` | O processamento dos pedidos da agenda (funções puras): a conciliação dos pedidos da data com o dia (`conciliarPedidos`, o plano: quem entra, volta, sai ou fica; `aplicarConciliacao`, a única que muda `importadas`, com a vaga do pedido cancelado dada pela rodada do motor ao 1º da lista de espera do horário, e, quando a rodada a daria a um pedido de outro horário ou da lista de outro horário, ao 1º da lista que cabe, fixo no lugar, com os dela que já entraram: `vezDaListaDeEspera`), por que um voo que sai fica (`ficaNaEscala`; `porQueOVooFica`, a pergunta sem mudar nada, do aviso de Pedidos e dos avisos de cancelar e de retirar a aprovação), a missão do curso com que o pedido entra, pelo horário do dia (`missaoDaEntrada`), e o resumo dela, o aviso (`resumoDaConciliacao`: quem entrou, os que esperam, quem saiu, de onde e quem entrou no lugar, os que ficam até o status ser conferido e os que ficam, com o porquê). O quadro do Processamento (G2: `quadroDoProcessamento`, a situação de cada pedido da data e de cada voo sem pedido: na escala, em espera às 08:20 · 1º, não coube com o motivo e onde resolver, `ONDE_RESOLVER` em `js/conflitos.js`, para entrar, para sair, fica, conferir, sem aprovação, tirado pelo operador, tirado desta data antes, aguardando, cancelado, fora do cadastro), as missões do curso que o programa passou (`plano.missoes`, trocadas por "Atualizar a escala"), "Pôr de volta na escala" (`podeVoltarAEscala`) e "Recomeçar pelos pedidos" (`recomecarPelosPedidos`). Quem a chama é `js/conciliacao.js` (`conciliarADataAberta`, `depoisDeMudarPedidos`) e a tela do Processamento |
| `js/conciliacao.js` | A conciliação na data aberta (G2): o ambiente dela (`ambienteDaData`: a data, o hoje e o agora de São Paulo, os programas, os resultados, os inativos), a gravação numa vez só, com as linhas do Histórico de quem entrou, voltou, saiu e trocou de missão (`conciliarADataAberta`), o que as ações de Pedidos fazem na hora (`depoisDeMudarPedidos`) e o que o aviso diz além de quantos entraram (`notasDaConciliacao`) |
| `js/views/processamento.js`, `js/eventos/processamento.js`, `css/processamento.css` | O Processamento (G2), no lugar da Demanda: a lista de `quadroDoProcessamento` (o componente de lista e detalhe, por grupo: para atualizar a escala, fora da escala, na escala, aguardando aprovação, cancelados; os filtros da situação, sem os cancelados quando nenhuma está marcada, do curso, com marcas próprias, e da missão), o detalhe só de leitura (a situação, o voo, a lista de espera do horário, o motivo e onde resolver, o pedido; "Abrir em Pedidos", "Abrir na Escala"), o aviso do alto com "Atualizar a escala" (`#proc-atualizacao`), a contagem (`#proc-cnt`) e as ações: "Atualizar a escala", "Trazer de volta", "Pôr de volta na escala" e "Tirar da escala" (com o "✕" da Escala, em `js/eventos/restricoes-do-voo.js`), "Recomeçar pelos pedidos" (no "Mais", com a confirmação armada e a frase do que vai acontecer). Cada ação responde na linha de estado (`#proc-status`, `role="status"`) e no toast, com o aluno e a data, com o foco na linha do pedido, marcada pela barra e por "agora" (`responderNoProcessamento`) |
| `js/csv.js` | CSV da escala agrupado por avião, para o lançamento no portal do aeroclube |
| `js/planilha.js`, `modelos/escala-cavok.xlsx` | A escala na planilha do modelo do aeroclube (o Excel do lançamento no CAVOK): onde cada voo cai e o arquivo preenchido. O modelo é o arquivo da operação sem os dados do dia; as células que o app preenche estão em `BLOCOS` e `GROUND` (um modelo novo precisa delas nos mesmos lugares, e `test/unit/planilha.test.js` confere) |
| `js/zip.js` | Leitura e montagem do ZIP do .xlsx, com a compressão do navegador |
| `js/status.js` | Status do voo com detalhes: o novo horário do atraso, o motivo do cancelamento e o atraso que invade outro voo |
| `js/sessao-da-tv.js` | A sessão da TV da recepção: a renovação antes de expirar, "Manter esta TV conectada" (o e-mail e a senha guardados neste navegador) e o que a TV mostra (o quadro, o aviso sem atualização ou o login) |
| `js/quadro.js` | As linhas do painel: os quadros Missões, Partidas e Chegadas (Escala e TV da recepção) e as páginas, com uma lista ou duas lado a lado |
| `js/config-do-painel.js` | A configuração do painel no cadastro (`painel`, do formato 25 em diante): o quadro com que ele abre, as colunas (ligadas ou não e na ordem) e as listas (`auto`, `uma` ou `duas` lado a lado) |
| `js/meteorologia.js`, `js/views/meteorologia.js` | A meteorologia do pé do painel (Escala e TV): a busca na função `meteorologia` a cada 10 minutos, que guarda as últimas mensagens boas quando falha, e a faixa com as duas caixas, SBBH e SBCF, cada uma com a hora da atualização |
| `supabase/functions/meteorologia/` | A Edge Function que busca o METAR e o TAF de SBBH e SBCF na REDEMET, com a chave do segredo `REDEMET_API_KEY` (`index.ts`; o atendimento e a leitura das mensagens em JavaScript puro, testados no Node) |
| `js/dados-pessoais.js` | Dados pessoais de alunos e instrutores: validação (nome completo, CPF, CANAC, nascimento, celular e e-mail), formatos e a regra da gravação (a mesma do servidor, para o modo local e o servidor dos testes) |
| `js/perfis.js` | Perfis de acesso e o que cada um pode fazer na tela |
| `js/rules.js` | Regras das missões (Ground School, precedência, disponibilidade do aluno) |
| `js/engine.js` | Motor de alocação (função pura); com o almoço do INVA (#104): a busca de cada pedido com o almoço em todas as passadas e, só se ele não couber assim, sem ele (o almoço vem antes do "Priorizar com"; o pareamento no horário também o guarda); a guarda que tira o almoço de um INVA por vez enquanto um pedido que o motor escala sem o almoço ficar fora; e `devolverAlmocos`, a busca que muda outras missões antes de desistir de um almoço ou de um "Priorizar com" (Pedro, 28/11): para cada INVA sem almoço, o almoço de volta, os pedidos que levaram a hora dele antes na fila, a hora dele reservada, e cada voo dele na janela, de quem poderia voar um deles no horário ou do mesmo tipo de avião perto da janela em outro horário, com outro INVA ou em outro avião (`mudancasParaOAlmoco`; com outro INVA também o voo do "Priorizar com", nenhum almoço cede a ele, e o aviso do "Priorizar com" diz de quem é o almoço); para cada voo que perdeu o "Priorizar com", o pedido antes na fila, o voo em outro horário, a hora do INVA dele reservada e os voos desse INVA mudados (`mudancasParaOPar`); uma mudança por montagem, até nenhuma melhorar, no máximo 600 montagens (`opcoes.almoco: false`, o motor sem ele; `montarComOAlmoco`, a configuração em que ele terminou e as montagens, para os testes; `almocoDa`, com `evitar`, as missões mudadas) |
| `js/almoco.js` | O almoço do INVA (#104): a hora livre seguida entre 11:00 e 14:00 (`horaLivre`, `tiraOAlmoco`, a regra que `js/viabilidade.js` confere no motor e na compactação), quem tem o almoço do motor (quem vem, sem uma pausa que já cubra 1 h da janela), as horas que o motor tenta reservar (`horasParaOAlmoco`), o aviso "Sem almoço" da escala pronta (`avisosDoAlmoco`, em `concluirEscala`; sem código, reconhecido pelo começo do texto, `ehAvisoDoAlmoco`; um item do trilho, contado no resumo dos avisos, `resumosDaEscala`) e o da mudança à mão (`semAlmocoComAMudanca`: o editor do voo e "+ Agendar voo"). Nada é gravado: sem número de formato |
| `js/conferencia.js` | A conferência dos voos fixos, fora do motor, que a usa: a fila dos pedidos na ordem do motor, a volta do noturno de ontem, a linha de cada voo fixo conferida com as regras do motor (`linhaDoFixo`: os conflitos e os avisos do agendado) e o que o motor confere depois de montar a escala (`concluirEscala`); `conferirEscala` confere uma escala montada sem o motor (a escala aprovada que o operador muda na Escala): não põe, não move nem tira voo, e refaz os conflitos, os avisos, a revisão, o total, as turmas e os pesos pelo cadastro |
| `js/edicao-do-voo.js` | A alteração de um voo feita na Escala (F1g): a escala que ela deixa (`escalaDaAlteracao`: na escala aprovada, sem o motor) e o editor do voo, puro: o voo a editar e as travas, as opções de cada campo (nada desligado: o que não serve avisa), o que muda, o resumo da pergunta, o que "Salvar" grava (`aplicarEdicao`, com a reversão `desfazerEdicao`) e os avisos de cada campo |
| `js/disponibilidade.js` | A disponibilidade de um INVA na data (formato 29): as faixas e as pausas, a conversão dos nove tempos de antes (`aw`) e `disponivelPara`, a regra que o motor, a compactação, as Sugestões e o agendamento leem (por `js/viabilidade.js`); para a tela, os três turnos (`TURNOS`, cada um uma faixa), o Almoço, o texto e a tira das faixas, o que cabe nelas (`oQueCabe`: em cada lista de decolagem, os horários em que a missão começa e até quando pode ir), a conferência de "Editar faixas" (`conferirFaixas`) e o "Marcar disponível" do agendamento (`comOIntervalo`) |
| `js/limitacoes.js` | As limitações do aluno (formato 31): os tipos de recurso em que ele voa e os horários em que pode voar, em todas as datas ou nos dias da semana nomeados; a normalização do que vem gravado, as regras duras do motor (o tipo, `tipoPermitido`; o início, `inicioPermitido`, a regra do início das faixas dos INVAs), os horários da data (`limitacoesNaData`, `comLimitacoesDaData`, que o estado da escala usa) e os textos |
| `js/viabilidade.js` | O que torna possível um voo num horário, num recurso e com um instrutor (disponível, habilitado, livre, fora do "Não escalar com", dentro da lei e do peso; o saldo até a revisão): as mesmas regras no motor, na compactação, nas Sugestões e no agendamento; no motor e na compactação, a última, branda, o almoço do INVA (`js/almoco.js`) |
| `js/exportacoes.js` | O registro das exportações da data (formato 30: o CSV, o PDF e o Excel, com quando, por quem e a impressão do que foi exportado), que o H escreve; por enquanto, só a normalização do que vem gravado (`normalizarExportacoes`) |
| `js/fixos.js` | Os voos fixos (pela escala aprovada, pelo status, pelo instrutor escolhido e pelo agendamento na Escala): o que acontece com eles ao mudar o status, aprovar, reabrir e mudar a demanda, e o motivo do cadeado |
| `js/candidatos.js` | Os recursos e os instrutores que servem a um voo num horário, contra os outros voos do dia, cada um com o que o impede (as Sugestões e o agendamento) |
| `js/reparo.js` | As Sugestões: para um conflito na escala aprovada (outro avião, outro instrutor, outro horário, soltar o voo ou cancelar; depois, o horário mais perto, também fora da disponibilidade do pedido, e outro tipo, que mudam o pedido junto, `repararComOPedido`), para o voo cancelado da data aberta (o motivo fora da busca; o mesmo horário, outro avião, o horário mais perto, outro tipo; aplicar e desfazer, `aproveitarCancelado`) e para o pedido recusado pelo instrutor escolhido (`sugestoesDoRejeitado`: o motor numa cópia com cada outro instrutor), de hoje em diante (`dataQueAindaVoa`); cada sugestão é conferida no motor numa cópia (`conferirNoMotor`: o voo fica onde ela diz; a que muda ou tira outros voos diz quais); a sugestão fora da disponibilidade ou em outro tipo pede a confirmação com o aluno, e a que faz do voo local o 7º do horário ou muda outros voos, "Aplicar mesmo assim" |
| `js/rejeicoes.js` | As recusas do motor ligadas aos pedidos (`rejeicoesDosPedidos`): a i-ésima recusa é a do i-ésimo pedido que voa sem pino e sem linha, na ordem do motor (`naOrdemDoMotor`); dois alunos de mesmo nome não se confundem; o 1º da lista de espera do horário que o voo de um pedido cancelado deixa (`primeiroDaListaDeEspera`) |
| `js/instrutor-escolhido.js` | O instrutor escolhido pelo operador: nas restrições do pedido (o motor encaixa o voo com ele) e na Escala (o voo fica fixo onde está, com ele), as opções de cada lista e a reversão |
| `js/agendamento.js` | O voo agendado na Escala, em funções puras: o formulário do diálogo (a missão pelo progresso, o recurso e o instrutor que servem, o horário pelo clique, a duração e o peso; o voo de hoje do aluno que muda de lugar ou entra na escala; a turma de Ground), a conferência pelo motor numa cópia do estado (os bloqueios, com as alternativas, e os avisos que pedem confirmação), o pedido com o voo fixo (a marca `agendado`) e a reversão |
| `js/restricoes.js`, `js/views/restricoes-do-voo.js`, `js/eventos/restricoes-do-voo.js` | As restrições de um voo (G1): a gaveta "Restrições" (`aside.gaveta#painel-restricoes`) com o que o motor lê para encaixar o pedido (a missão do curso, o tipo de recurso, o instrutor, a prioridade, o horário e a duração: as colunas que saíram da Demanda), aberta pelo editor do voo, pelo item do trilho da missão que não entrou e pelo detalhe do pedido no Processamento (G2; o voo tirado da escala tem nela "Pôr de volta na escala"). O módulo puro dá as opções de cada campo, o aviso das limitações do aluno (o tipo e o horário avisam e pedem a confirmação; o INVA de "Não escalar com" fica desligado), o campo aplicado no pedido (`aplicarRestricao`: o horário exato do pedido da agenda nunca muda ali, N14), a regra que solta o voo agendado (`fixosSemOAgendadoQueMudou`: só outra missão, outro tipo ou outras horas) e a recusa de cada pedido (`pedidosDasRecusas`); os eventos levaram da Demanda os campos do pedido, a missão do curso, o "✕" da Escala e a reversão `setFly` |
| `js/views/edicao-do-voo.js`, `js/eventos/edicao-do-voo.js` | O editor do voo (`#dlg-voo`), aberto pela barra do mapa e pelo "Editar" da Lista: os campos, os avisos a cada campo, "Salvar mesmo assim" na escala aprovada e a pergunta fora dela; quem só consulta vê os campos como texto |
| `js/views/dialogo-refazer.js` | A pergunta antes de refazer a escala não aprovada (`#dlg-refazer`): o que muda, que a escala inteira será refeita e os avisos; o editor, o status, o instrutor, o "✕", as Sugestões e os critérios da Escala perguntam por ela, e o agendamento põe a frase na confirmação dele |
| `js/views/agendamento.js`, `js/eventos/agendamento.js` | O diálogo "Agendar voo" (`#dlg-agendar`), aberto pelo "+ Agendar voo" da barra da Escala, pelo "+" de cada linha do mapa e de cada horário da lista, pelo clique numa linha livre do mapa e pelo "+ Aluno na turma" da turma de Ground; a gravação, com "↶ Desfazer" no Histórico |
| `js/storage.js` | Escala por data, migrações de dados e os programas dos cursos (a leitura, a gravação e a conversão única do cadastro), sobre um backend (`js/backends/`: local ou Supabase) |
| `js/dias.js` | Cadastro separado do dia, cópia do dia anterior, conversão dos dados da fase 2 e BI das escalas |
| `js/migracoes.js` | Versões do formato dos dados guardados e os passos de uma versão para a seguinte |
| `js/sessao.js`, `js/config-supabase.js` | Login, perfil de acesso e projeto Supabase de cada endereço |
| `js/funcionalidades.js` | As funcionalidades que podem ficar desligadas, hoje as duas em todos os endereços: `hangar` (a ordem no hangar, em Recursos; o motor segue a ordem da frota) e `progresso` (a próxima missão, o progresso, a fase dos alunos e os resultados; a tela Cursos continua). Ligar é trocar `false` por `true` em `LIGADAS`; nada do que está guardado muda. No localhost, `?funcionalidades=hangar,progresso` liga para testar (nos testes, `test.use({ funcionalidades })`, `comHangar` e `comProgresso`, em `test/e2e/fixtures.js`). No `index.html`, `data-funcionalidade` e `data-sem-funcionalidade` marcam os textos |
| `js/state.js`, `js/actions.js` | Estado da aplicação e ações (perfil, data, histórico e a escala refeita a cada alteração; o perfil trocado redesenha pelo momento `perfil`); `gravarAlteracao` é o único jeito de os eventos mudarem os dados, e nada grava antes de os dados da data aberta serem lidos (`lerData` lê uma data de cada vez; `aindaNaoAbriu` recusa a mudança com o aviso). A alteração é gravada antes de a tela ser redesenhada: um desenho que falha não impede a gravação nem o histórico. Um conflito no cadastro (outra pessoa gravou antes; sem ser pelo formato, com a data já lida) não trava a tela: a data é lida de novo e o aviso lista as alterações que não foram gravadas (`aposConflito`); o conflito no dia, pelo formato ou enquanto a data abre trava, como antes |
| `js/redesenho.js` | O registro dos desenhos da tela: cada tela registra o dela no módulo de eventos (`registrarDesenho`, com o nome, `comMomento` para o desenho que recebe o momento, e os momentos `dados`, `consulta`, `releitura`, `escala`, `perfil`, `pedidos` e `data-aberta`; `sessao` fica reservado para a aprovação); quem muda os dados redesenha por momento (`redesenhar`) ou pelo nome (`redesenharPorNome`), sem importar a tela. `test/unit/desenhos-registrados.test.js` confere os nomes e os momentos |
| `js/sem-falhar.js` | Faz sem deixar o erro parar quem chamou (vai para o console): o foco depois de redesenhar e cada desenho da tela |
| `js/manual.js` | Tabelas do manual geradas das regras (missões, habilitações exigidas, janelas, pesos e rodízio) |
| `js/telas.js` | As telas, sem DOM (`TELAS`: o nome de cada uma, a etapa ou o grupo e quem a vê; `ESTAGIOS`, as quatro etapas da linha), a tela e a data da abertura de cada perfil (`telaDeAbertura`, `dataDeAbertura`), o endereço `#/<tela>[/<item>]` (`destinoDoEndereco`, `enderecoDoDestino`) e o que o trilho guarda neste navegador, o calendário e os avisos abertos ou recolhidos (`lerPreferencias`) |
| `js/calendario.js` | O calendário do trilho, sem DOM: as semanas de um mês, o dia de cada tecla, a única parada do Tab, o que cada dia diz ao leitor de tela e a linha da data aberta |
| `js/endereco.js` | O endereço da página: a tela no histórico do navegador (`empilharTela`, `substituirTela`, com a rolagem de cada entrada), a data em `?data=` (fora do histórico: Voltar troca a tela, não a data) e o endereço sem a tela ao sair |
| `js/linha-do-dia.js` | A linha do dia, sem DOM: os quatro cartões das etapas (Pedidos, Processamento, Escala, Aprovar; o de Pedidos com os registrados, os que aguardam aprovação, os aprovados e os aprovados fora da escala, que levam ao Processamento), cada um com o valor, o estado (o pior das tarefas: feito, falhou, atenção, em andamento, pendente) e as tarefas, que levam à tela onde se resolvem; o selo de Recursos; e os avisos da data, no trilho (`avisosDaData`, cada um com a gravidade, o horário do voo e a tela onde se resolve; os da escala, o que eram as caixas do resumo da Escala, com o grupo e a ação: "Sugestões", "Refazer a escala"; e o resumo de cada grupo da escala com dois itens ou mais, `resumosDaEscala`, o título que as caixas tinham, com os INVAs sem almoço (#104), o trecho com a dica do glossário; os voos com inativos e as habilitações não conferidas; os horários fechados da data, `horarios-fechados`, uma informação que leva ao bloco deles na Escala, `#/esc/fechamentos`). Uma função por cartão e uma por grupo de avisos |
| `js/lista.js`, `js/detalhe.js` | O componente de lista e detalhe (F2), sem DOM: o que a lista mostra (a busca, os filtros, "Mostrar inativos", os fixos, os grupos, as linhas que ficam até um filtro mudar), a contagem, o HTML de cada linha (o botão que escolhe e, ao lado dele, a chave "Ativo", a chave desta data ou a ação; o bloco embaixo das três linhas; o apagado e o inativo), as teclas, a escolha conciliada com o modelo; e o detalhe: os campos "Rótulo: valor" editados no lugar, as seções, o cabeçalho com "Anterior" e "Próximo", o rodapé e o vazio (nada escolhido: no meio do painel, o ícone da tela, o texto e a dica de quem cria, `vazioDoDetalheHtml`). Cada parte tem `data-chave`: o desenho troca só a que mudou (`trocarPorChave`, `js/dom.js`, que também espera o clique acabar: `ponteiroApertado`, `depoisDoClique`) |
| `js/views/mestre-detalhe.js`, `js/views/lista.js`, `js/views/detalhe.js` | O componente na página: `criarMestreDetalhe` (uma chamada por tela, no módulo de eventos dela) registra os ouvintes no documento e devolve o desenho, a escolha e o que a tela faz ao aparecer. O registro escolhido fica no endereço (`#/alu/1000`, `itemNoEndereco` em `js/views/telas.js`); abaixo de 800 px, uma vista de cada vez (`data-vendo` na seção: `lista`, `detalhe` ou `ambos`), e Voltar devolve a lista. Os estilos em `css/lista.css` |
| `js/views/recursos.js`, `js/eventos/recursos.js`, `js/views/horarios.js` | Recursos como lista e detalhe (B): a lista por categoria (os cabeçalhos com o detalhe da categoria: os horários de decolagem, uma categoria de cada vez, e o que vem do tipo), a Sala Ground no grupo dela, "Ordem no hangar" o item fixo do alto (com o hangar ligado), o "Disponível" desta data e o "Ativo" do cadastro na linha; o detalhe do recurso ("Nesta data": Disponível, as horas até a revisão de 50 horas, Revisão feita, o que voa; "Cadastro · todas as datas": os atributos e "Habilitações que o INVA precisa"), "Agendar voo no <reg>", "Retirar da frota…" e "+ Novo recurso" no detalhe vazio |
| `js/views/fechamentos.js`, `js/eventos/fechamentos.js` | Os horários fechados nesta data (J), na Escala desde o B: o bloco `details#fechamentos` entre a barra das vistas e a dos critérios, com o resumo, a lista dos intervalos (o ✕ abre de novo) e "+ Fechar horários"; na escala não aprovada, cada mudança pergunta pelo `#dlg-refazer`; o endereço `#/esc/fechamentos` abre o bloco |
| `js/views/editor-de-dados-pessoais.js`, `js/eventos/editor-de-dados-pessoais.js` | Os dados pessoais no detalhe de uma pessoa (Alunos): os campos lidos 250 ms depois da escolha, o rascunho de cada pessoa, "Salvar" depois da gravação que incluiu a pessoa, "Desfazer", as recusas (no campo, na linha e no aviso da lista), o texto para a Secretaria (que só lê) e "Apagar os dados pessoais" |
| `js/views/` | Renderização de cada tela: a troca de tela (`telas.js`: `mostrarTela`, o que cada tela faz ao aparecer, `registrarTela`, e os links `#/`, Voltar e Avançar), a linha de produção (`linha.js`) e o trilho (`trilho.js`: o calendário com os pedidos de cada dia, os avisos da data, o calendário e os avisos abertos ou recolhidos, e o nome da data no alto dele); INVAs (`instrutores.js`: os modelos da lista e do detalhe que o componente desenha: a linha com as faixas e a tira do dia, o item fixo dos limites da lei, "Nesta data" com os turnos e "Editar faixas", o cadastro, as habilitações, as horas de voo e os dados pessoais; os limites da lei em `limites.js`), Alunos (`alunos.js`: "Nesta data", "Curso e missões", o cadastro, as limitações (L: "Só voa no", "Pode voar", "Priorizar com", "Não escalar com" e a linha do peso, gravadas por `js/eventos/alunos.js`, com a reversão `setLimitacoes`) e os dados pessoais), Recursos (`recursos.js`, na linha acima); os dados pessoais guardados fora do estado (`dados-pessoais.js`, com quem os vê e quem os altera) e a seção que os edita no detalhe (`editor-de-dados-pessoais.js`, de Alunos e de INVAs) |
| `js/export.js` | CSV, PDF e a planilha (Excel) |
| `js/eventos/` | Os eventos de cada tela (um módulo por tela, que registra o que a tela faz ao aparecer, `registrarTela`, os desenhos dela e o que "↶ Reverter" faz com os tipos de reversão dela; `linha.js` é o da linha de produção: o desenho dela e o botão que abre e recolhe; `trilho.js`, o do trilho: o único que troca a data depois da abertura, e os botões que recolhem o calendário e os avisos; sem nada guardado, o calendário começa aberto a partir de 1024 px e recolhido abaixo disso); `registro.js` recebe os botões com `data-act`, os campos das tabelas e as reversões do Histórico (`aoAcionar`, `aoMudarCampo`, `aoReverter`), com a trava de quem só consulta e a de antes de a data abrir, e `confirmacao.js` é o único jeito de confirmar (dois cliques). Um módulo que liga eventos ao ser carregado é importado por um arquivo só, `js/main.js` ou o módulo da tela dele (`limites.js` é de INVAs; `edicao-do-voo.js` e `fechamentos.js`, da Escala; `restricoes-do-voo.js`, do Processamento), e cada seletor que ele lê existe em `index.html` (`test/unit/eventos-ligados.test.js`) |
| `js/main.js` | A abertura do app (liga os eventos e o endereço, lê a sessão e os dados, abre a data e a tela: a escolhida enquanto os dados carregavam, a do endereço ou a do perfil) |

## Fluxo de trabalho

Alterações entram por branch + pull request. O GitHub Actions (`.github/workflows/testes.yml`) roda todos os testes em
todo PR e em cada push no `main` e no `previa`; um push num branch sem PR não roda nada (o PR roda), e um commit novo no
mesmo PR cancela os testes do anterior; os pushes num mesmo branch rodam um de cada vez, na ordem. Um PR com conflito
com a base não roda os testes (o GitHub não monta o merge): resolva o conflito primeiro. O lint e os unitários rodam
num job, o E2E em duas partes paralelas (`--shard`). Ao entrar no `main` (ou no `previa`) com os testes verdes, a nova
versão vai para o ar (veja "Publicação"; no fork, o `main` é servido pelo GitHub Pages).

## Publicação

O site é estático e vai para o Cloudflare (Workers com arquivos estáticos, a versão atual do Cloudflare Pages), pela
configuração `wrangler.jsonc`. Depois de um push em `main` ou `previa` com os testes verdes, o workflow
`.github/workflows/publicar.yml` monta a pasta `publicar/` (`scripts/pasta-publicada.mjs`: só `index.html`,
`painel.html`, `css/`, `js/`, `img/` e `modelos/`) e a publica: `main` na produção, `previa` na prévia. Ele usa os
segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` do repositório e só roda em `AutoEscala-Project/ACPM`: no
fork `thephfernandes/ACPM`, o `main` é a prévia do redesenho, servida pelo GitHub Pages (no banco da prévia).

À mão (com `npx wrangler login` feito): `node scripts/pasta-publicada.mjs && npx --yes wrangler@4.165.0 deploy`
(produção) ou `... deploy --env previa`. Nunca publique a raiz do repositório.

`test/unit/pasta-publicada.test.js` monta a pasta e confere que tudo o que as páginas carregam (as tags, os módulos, o
CSS, os caminhos que o JS pede) está nela, e nada além do app: os testes E2E servem o repositório inteiro e não pegariam
um arquivo novo fora da lista, que no ar daria 404. Uma pasta nova do app entra em `scripts/pasta-publicada.mjs` e na lista
exata que esse teste espera.

O Cloudflare serve `painel.html` também como `/painel` (redireciona o primeiro para o segundo). O login do Supabase
(`supabase/config.toml`, `site_url` e `additional_redirect_urls`) e as origens da função `meteorologia` precisam
listar todo endereço novo do app.

## Licença

Software proprietário: todos os direitos reservados a Gabriel Drumond e Pedro Henrique Fernandes. Veja `LICENSE`. O
código estar visível não concede nenhum direito de uso, cópia, modificação ou revenda.
