# AutoEscala - ACPM

Planejamento da escala diária de voo, simulador e Ground School do ACPM.
Publicada no Cloudflare em https://autoescala.autoescala-acpm.workers.dev/ (branch `main`, sem etapa de build; veja
"Publicação"). Código em https://github.com/AutoEscala-Project/ACPM.

A escala é automática: cada alteração refaz a escala da data na hora (o motor leva milissegundos) e grava os dados e
a escala juntos. O manual de uso está no botão "Manual", no topo do app.

## Modos de uso

- **Compartilhado (site publicado):** login com e-mail e senha; os dados ficam no Supabase e todos veem as mesmas escalas
  (uma por data).
  O perfil da conta define o acesso: **Operador** edita, **Gestor** só consulta, **Secretaria** registra pedidos na
  agenda de solicitações (a escala ela só consulta) e **Administrador** faz tudo o que o Operador faz e, além disso,
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
  `alunos.js`, `demanda.js`, `pedidos.js` (o formulário da Agenda), `escala.js` (ler, aprovar, reabrir, exportar) e
  `cursos.js`; `invariantes.js` tem as conferências de todas as telas (o nome para o leitor de tela, os 44 px, a página
  que não rola de lado) e `percorrerTelas`, que passa por todas as abas e pelos `ESTADOS` de cada driver. Um seletor
  reservado (`#btn-data`, `#eqs`, `#inst-dia`, `data-f="fly"`, `#ag-*`…) aparece só no driver dele e nos testes da tela dona
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
  regrave com `node scripts/capturar-goldens-motor.mjs` e revise o diff: ele mostra os voos que mudaram.
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
  senha do banco): `node scripts/semear-dias-previa.mjs [dias de operação] [data inicial]` (`SECO=1` só mostra).

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

## O recurso do pedido da agenda

O pedido da agenda guarda o recurso (o tipo: C152, PA-34, Sim. Mono…): a missão diz os permitidos, o recurso diz os
horários, e a importação põe o pedido na demanda nele. A migração `20261125230000_agenda_com_recurso.sql` acrescenta a
coluna `recurso` (vazia nos pedidos de antes, que entram no recurso padrão da missão) e a função
`registrar_solicitacao` com o recurso, o 11º argumento. A de 10 argumentos continua, para as abas abertas do app de antes.

**A ordem:** a migração na prévia (`supabase db push --remote`) com `npm run test:db`, depois na produção
(`supabase db push --remote=<ref de produção>`), e só então o merge. Ela só acrescenta: o app no ar continua igual com
ela. O app novo no ar **antes** da migração não perde nem repete pedidos: quando o servidor responde que a função com o
recurso não existe (PGRST202 ou 42883), o pedido no recurso padrão da missão vai pela função de antes, e o pedido noutro
recurso é recusado com o aviso de que o servidor precisa ser atualizado. Nenhum outro erro tenta de novo. Depois, com
nenhuma aba de antes aberta, outra migração pode tirar a função de 10 argumentos (e a chamada dela em
`js/backends/supabase.js`).

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

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | A marcação do app: o topo (com o botão da data, `#btn-data`), a linha de produção (`nav#linha`: os quatro cartões das etapas, os cadastros, o Rodízio e o BI), o trilho (`aside#trilho`: o calendário da data aberta e os avisos dela) e as onze telas (`main#conteudo > section.tela`), dentro de `div.casca`, com os avisos do app acima |
| `painel.html`, `js/painel.js` | TV da recepção: o painel de hoje na tela toda, no quadro, com as colunas e as listas da configuração do painel (com o servidor, a que `painel_do_dia` entrega; sem ela, o padrão), e a meteorologia no pé |
| `css/*.css` | Os estilos, uma folha por dona, que `index.html` carrega nesta ordem (a da cascata): `base` (as cores e os temas claro e escuro, os títulos, os campos), `componentes` (botões, barras, tabelas, etiquetas, o filtro de vários valores, os avisos, as dicas), `painel` (o painel no estilo dos aeroportos e a meteorologia), `tv`, `casca` (a barra do topo, a moldura `.casca`, as telas, o login, a impressão), `linha` (a linha de produção: os cartões, os estados, aberta, recolhida e a faixa do celular), `trilho` (o calendário e os avisos da data, ao lado da tela ou no painel do botão da data), uma por tela (`escala`, `demanda`, `agenda`, `recursos`, `instrutores`, `alunos`, `cadastros`, `cursos`, `rodizio`, `bi`, `conta`, `manual`), `gavetas`, `dialogos` e `toque` (os alvos de 44 px dos componentes no celular, por último). A TV carrega `css/app.css`, que importa as cinco das duas páginas (`base`, `componentes`, `painel`, `tv`, `toque`). `test/unit/estilos.test.js` confere as listas; `node scripts/medir-estilos.mjs` mede o estilo de cada elemento das duas páginas em várias larguras, temas e telas (com `--comparar antes.json depois.json`, a diferença entre duas versões) |
| `js/config.js` | Janelas, missões, limites de peso e a frota inicial |
| `js/frota.js` | A frota no cadastro (matrícula, tipo, os atributos "Só Parafuso", "Só VFR" e "Habilitação própria", o que o recurso exige do instrutor, `exige`, e o inativo): validação de um recurso novo, `comAtributo` (marcar e desmarcar um atributo; a habilitação própria também em `exige`) e as matrículas de cada tipo |
| `js/categorias.js` | Categorias de recurso dos filtros (C152, C172, Simulador, PA-34 e Sala Ground) |
| `js/inativos.js` | O inativo no cadastro (`inativo: true` em alunos, instrutores e recursos; ainda sem a chave na tela): vale na data aberta de hoje em diante. O motor, a simulação do agendamento e as listas da escala leem o estado derivado (`estadoParaEscalar`: o instrutor inativo não vem, o recurso inativo fica indisponível), nunca gravado, e só nele tiram o inativo (`inativoNoEstado`); as listas do cadastro ("Não escalar com", "Priorizar com", o formulário da Agenda, os alunos de um curso) ficam sem ele em qualquer data; as filas do rodízio e o hangar ficam com os ativos (`ativosNaData`); a Escala avisa dos voos de quem ficou inativo (`voosComInativos`), com "Refazer a escala"; o pedido do aluno inativo fica registrado, "Aluno inativo", fora dos pendentes e da importação |
| `js/habilitacoes.js` | O registro das habilitações: as individuais dos instrutores, os grupos do painel e do filtro (`GRUPOS_DE_HABILITACAO`), o que cada missão exige e o que cada recurso exige (`exige`: ids do registro ou a habilitação própria `aviao:<matrícula>`) |
| `js/rodizio.js` | Filas do rodízio (cheque, MLTE, noturno e C172) e a rotação de uma data para a seguinte |
| `js/cursos.js` | Os cursos iniciais (PP, PC e INVA), o formato da sigla e do código da missão, o curso de cada aluno e o programa guardado no cadastro (`cursos`, a cópia de antes do formato 24, que ninguém mais grava) |
| `js/programa.js` | O programa dos cursos em fases (as tabelas dos cursos; no modo local, `acpm4_cursos`): a regra de quando voar cada fase e cada missão, o Noturno em trechos, as operações do editor da aba Cursos e a gravação e a conversão única do cadastro, com as regras e os erros do servidor |
| `js/modelos-de-curso.js` | Os programas prontos que o Administrador põe num curso: o cronograma do Piloto Privado (P.I PPA 001A), com 9 fases e 47 missões |
| `js/progresso.js` | A próxima missão de cada aluno pelas regras do programa (a liberada; as fora da ordem, com o motivo) e o progresso no curso |
| `js/resultados.js` | Os resultados das missões (aprovado ou reprovado; pendente desfaz um engano): a situação de cada missão do aluno e as regras do registro, as do servidor |
| `js/agenda.js` | Prazo da agenda de solicitações (13:00 do dia anterior), as datas em que um pedido pode ser registrado (`datasParaRegistrar`, a "Data do pedido"), os recursos da missão do pedido, o limite de voos locais e o pedido que cada solicitação vira |
| `js/processamento.js` | A importação dos pedidos da agenda para a demanda da data (função pura; o botão "Importar da agenda" é `js/eventos/importacao.js`) |
| `js/csv.js` | CSV da escala agrupado por avião, para o lançamento no portal do aeroclube |
| `js/planilha.js`, `modelos/escala-cavok.xlsx` | A escala na planilha do modelo do aeroclube (o Excel do lançamento no CAVOK): onde cada voo cai e o arquivo preenchido. O modelo é o arquivo da operação sem os dados do dia; as células que o app preenche estão em `BLOCOS` e `GROUND` (um modelo novo precisa delas nos mesmos lugares, e `test/unit/planilha.test.js` confere) |
| `js/zip.js` | Leitura e montagem do ZIP do .xlsx, com a compressão do navegador |
| `js/status.js` | Status do voo com detalhes: o novo horário do atraso, o motivo do cancelamento e o atraso que invade outro voo |
| `js/sessao-da-tv.js` | A sessão da TV da recepção: a renovação antes de expirar, "Manter esta TV conectada" (o e-mail e a senha guardados neste navegador) e o que a TV mostra (o quadro, o aviso sem atualização ou o login) |
| `js/quadro.js` | As linhas do painel: os quadros Missões, Partidas e Chegadas (Escala e TV da recepção) e as páginas, com uma lista ou duas lado a lado |
| `js/config-do-painel.js` | A configuração do painel no cadastro (`painel`, do formato 25 em diante): o quadro com que ele abre, as colunas (ligadas ou não e na ordem) e as listas (`auto`, `uma` ou `duas` lado a lado) |
| `js/meteorologia.js`, `js/views/meteorologia.js` | A meteorologia do pé do painel (Escala e TV): a busca na função `meteorologia` a cada 10 minutos, que guarda as últimas mensagens boas quando falha, e a faixa com as duas caixas, SBBH e SBCF, cada uma com a hora da atualização |
| `supabase/functions/meteorologia/` | A Edge Function que busca o METAR e o TAF de SBBH e SBCF na REDEMET, com a chave do segredo `REDEMET_API_KEY` (`index.ts`; o atendimento e a leitura das mensagens em JavaScript puro, testados no Node) |
| `js/dados-pessoais.js` | Dados pessoais de alunos e instrutores: validação (CPF, CANAC, nascimento, celular e e-mail) e formatos |
| `js/perfis.js` | Perfis de acesso e o que cada um pode fazer na tela |
| `js/rules.js` | Regras das missões (Ground School, precedência, disponibilidade do aluno) |
| `js/engine.js` | Motor de alocação (função pura) |
| `js/viabilidade.js` | O que torna possível um voo num horário, num recurso e com um instrutor (disponível, habilitado, livre, fora do "Não escalar com", dentro da lei e do peso; o saldo até a revisão): as mesmas regras no motor, na compactação, nas Sugestões e no agendamento |
| `js/fixos.js` | Os voos fixos (pela escala aprovada, pelo status, pelo instrutor escolhido e pelo agendamento na Escala): o que acontece com eles ao mudar o status, aprovar, reabrir e mudar a demanda, e o motivo do cadeado |
| `js/candidatos.js` | Os recursos e os instrutores que servem a um voo num horário, contra os outros voos do dia, cada um com o que o impede (as Sugestões e o agendamento) |
| `js/reparo.js` | As Sugestões: para um conflito na escala aprovada (outro avião, outro instrutor, outro horário, soltar o voo ou cancelar), para o voo cancelado da data aberta (o motivo fora da busca; o mesmo horário, outro avião, o horário mais perto, outro tipo; aplicar e desfazer, `aproveitarCancelado`) e para o pedido recusado pelo instrutor escolhido (`sugestoesDoRejeitado`: o motor numa cópia com cada outro instrutor) |
| `js/rejeicoes.js` | As recusas do motor ligadas aos pedidos (`rejeicoesDosPedidos`): a i-ésima recusa é a do i-ésimo pedido que voa sem pino e sem linha, na ordem do motor (`naOrdemDoMotor`); dois alunos de mesmo nome não se confundem |
| `js/instrutor-escolhido.js` | O instrutor escolhido pelo operador: na Demanda (o motor encaixa o voo com ele) e na Escala (o voo fica fixo onde está, com ele), as opções de cada lista e a reversão |
| `js/agendamento.js` | O voo agendado na Escala, em funções puras: o formulário do diálogo (a missão pelo progresso, o recurso e o instrutor que servem, o horário pelo clique, a duração e o peso; o voo de hoje do aluno que muda de lugar ou entra na escala; a turma de Ground), a conferência pelo motor numa cópia do estado (os bloqueios, com as alternativas, e os avisos que pedem confirmação), o pedido com o voo fixo (a marca `agendado`) e a reversão |
| `js/views/agendamento.js`, `js/eventos/agendamento.js` | O diálogo "Agendar voo" (`#dlg-agendar`), aberto pelo "+ Agendar voo" da barra da Escala, pelo "+" de cada linha do mapa e de cada horário da lista, pelo clique numa linha livre do mapa e pelo "+ Aluno na turma" da turma de Ground; a gravação, com "↶ Desfazer" no Histórico |
| `js/storage.js` | Escala por data, migrações de dados e os programas dos cursos (a leitura, a gravação e a conversão única do cadastro), sobre um backend (`js/backends/`: local ou Supabase) |
| `js/dias.js` | Cadastro separado do dia, cópia do dia anterior, conversão dos dados da fase 2 e BI das escalas |
| `js/migracoes.js` | Versões do formato dos dados guardados e os passos de uma versão para a seguinte |
| `js/sessao.js`, `js/config-supabase.js` | Login, perfil de acesso e projeto Supabase de cada endereço |
| `js/funcionalidades.js` | As funcionalidades que podem ficar desligadas, hoje as duas em todos os endereços: `hangar` (a ordem no hangar, em Recursos; o motor segue a ordem da frota) e `progresso` (a próxima missão, o progresso, a fase dos alunos e os resultados; a tela Cursos continua). Ligar é trocar `false` por `true` em `LIGADAS`; nada do que está guardado muda. No localhost, `?funcionalidades=hangar,progresso` liga para testar (nos testes, `test.use({ funcionalidades })`, `comHangar` e `comProgresso`, em `test/e2e/fixtures.js`). No `index.html`, `data-funcionalidade` e `data-sem-funcionalidade` marcam os textos |
| `js/state.js`, `js/actions.js` | Estado da aplicação e ações (perfil, data, histórico e a escala refeita a cada alteração; o perfil trocado redesenha pelo momento `perfil`); `gravarAlteracao` é o único jeito de os eventos mudarem os dados, e nada grava antes de os dados da data aberta serem lidos (`lerData` lê uma data de cada vez; `aindaNaoAbriu` recusa a mudança com o aviso). A alteração é gravada antes de a tela ser redesenhada: um desenho que falha não impede a gravação nem o histórico |
| `js/redesenho.js` | O registro dos desenhos da tela: cada tela registra o dela no módulo de eventos (`registrarDesenho`, com o nome e os momentos `dados`, `consulta`, `releitura`, `escala`, `perfil`, `pedidos` e `data-aberta`; `sessao` fica reservado para a aprovação); quem muda os dados redesenha por momento (`redesenhar`) ou pelo nome (`redesenharPorNome`), sem importar a tela. `test/unit/desenhos-registrados.test.js` confere os nomes e os momentos |
| `js/sem-falhar.js` | Faz sem deixar o erro parar quem chamou (vai para o console): o foco depois de redesenhar e cada desenho da tela |
| `js/manual.js` | Tabelas do manual geradas das regras (missões, habilitações exigidas, janelas, pesos e rodízio) |
| `js/telas.js` | As telas, sem DOM (`TELAS`: o nome de cada uma, a etapa ou o grupo e quem a vê; `ESTAGIOS`, as quatro etapas da linha), a tela e a data da abertura de cada perfil (`telaDeAbertura`, `dataDeAbertura`), o endereço `#/<tela>[/<item>]` (`destinoDoEndereco`, `enderecoDoDestino`) e o trilho ao lado ou não, pela classe da largura da janela e pelo que a pessoa guardou (`classeDaLargura`, `trilhoFixo`, `lerPreferencias`) |
| `js/calendario.js` | O calendário do trilho, sem DOM: as semanas de um mês, o dia de cada tecla, a única parada do Tab, o que cada dia diz ao leitor de tela e a linha da data aberta |
| `js/endereco.js` | O endereço da página: a tela no histórico do navegador (`empilharTela`, `substituirTela`, com a rolagem de cada entrada), a data em `?data=` (fora do histórico: Voltar troca a tela, não a data) e o endereço sem a tela ao sair |
| `js/linha-do-dia.js` | A linha do dia, sem DOM: os quatro cartões das etapas (Agenda, Demanda, Escala, Aprovar), cada um com o valor, o estado (o pior das tarefas: feito, falhou, atenção, em andamento, pendente) e as tarefas, que levam à tela onde se resolvem; o selo de Recursos; e os avisos da data, no trilho (`avisosDaData`, cada um com a gravidade, o horário do voo e a tela onde se resolve). Uma função por cartão e uma por grupo de avisos |
| `js/views/` | Renderização de cada tela: a troca de tela (`telas.js`: `mostrarTela`, o que cada tela faz ao aparecer, `registrarTela`, e os links `#/`, Voltar e Avançar), a linha de produção (`linha.js`) e o trilho (`trilho.js`: o calendário com os pedidos de cada dia, os avisos da data, o estado dele, ao lado, aberto ou fechado, e o nome da data no topo); Instrutores (`instrutores.js`, com os limites da lei em `limites.js`), Alunos (`alunos.js`) e as linhas que os filtros escondem (`linhas-filtradas.js`, também da Demanda); os dados pessoais guardados fora do estado (`dados-pessoais.js`) e o painel que os edita (`painel-de-dados.js`) |
| `js/export.js` | CSV, PDF e a planilha (Excel) |
| `js/eventos/` | Os eventos de cada tela (um módulo por tela, que registra o que a tela faz ao aparecer, `registrarTela`, os desenhos dela e o que "↶ Reverter" faz com os tipos de reversão dela; `linha.js` é o da linha de produção: o desenho dela e o botão que abre e recolhe; `trilho.js`, o do trilho: o único que troca a data depois da abertura); `registro.js` recebe os botões com `data-act`, os campos das tabelas e as reversões do Histórico (`aoAcionar`, `aoMudarCampo`, `aoReverter`), com a trava de quem só consulta e a de antes de a data abrir, e `confirmacao.js` é o único jeito de confirmar (dois cliques). Um módulo que liga eventos ao ser carregado é importado por um arquivo só, `js/main.js` ou o módulo da tela dele (`limites.js`, `painel-de-dados.js` e `importacao.js` são de Instrutores e da Demanda), e cada seletor que ele lê existe em `index.html` (`test/unit/eventos-ligados.test.js`) |
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
