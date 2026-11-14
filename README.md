# AutoEscala - ACPM

Planejamento da escala diária de voo, simulador e Ground School do ACPM.
Publicada pelo GitHub Pages em https://gdruumond.github.io/ACPM/ (branch `main`, sem etapa de build).

A escala é automática: cada alteração refaz a escala da data na hora (o motor leva milissegundos) e grava os dados e
a escala juntos. O manual de uso está no botão "Manual", no topo do app.

## Modos de uso

- **Compartilhado (site publicado):** login com e-mail e senha; os dados ficam no Supabase e todos veem as mesmas escalas
  (uma por data).
  O perfil da conta define o acesso: **Operador** edita, **Gestor** só consulta, **Secretaria** registra pedidos na
  agenda de solicitações (a escala ela só consulta) e **Administrador** faz tudo o que o Operador faz e, além disso,
  cria e exclui contas (em "Minha conta" › Usuários). O cadastro aberto é desligado. Em "Minha conta", cada pessoa
  troca a própria senha e o e-mail (o e-mail novo vale depois dos links de confirmação, que dependem do SMTP do
  Supabase). A primeira conta de administrador sai de `scripts/criar-conta.mjs`.
- **Local (`localhost`):** sem login, dados só no `localStorage` do navegador. Em localhost, `?supabase=previa` usa o
  projeto de prévia (com login).

| Endereço | Projeto Supabase |
|---|---|
| https://gdruumond.github.io/ACPM/ | `acpm-escala` (produção) |
| https://thephfernandes.github.io/ACPM/ (prévia) | `acpm-escala-preview` |

## Rodar localmente

A aplicação usa módulos ES, então precisa ser servida por HTTP (abrir o `index.html` direto do disco não funciona):

```sh
npm install
npm run serve      # http://localhost:4173
```

## Testes

```sh
npm test               # unitários + E2E
npm run test:unit      # motor de alocação, regras e camada de dados (node:test)
npm run test:e2e       # aplicação no navegador (Playwright)
```

- Na primeira vez, `npx playwright install chromium` baixa o navegador dos testes.
  Para usar o Google Chrome já instalado: `PW_CHANNEL=chrome npm run test:e2e`.
- Para testar uma versão publicada em vez do servidor local:
  `BASE_URL=https://gdruumond.github.io/ACPM/ npm run test:e2e` (com a barra final).
- Os testes E2E comparam a escala gerada com snapshots em `test/e2e/__snapshots__/`. Se uma mudança
  de comportamento for intencional, atualize-os com `npx playwright test --update-snapshots` e revise o diff.
- `test/fixtures/motor-goldens.json` guarda a escala aprovada do motor para 40 cenários aleatórios e para o
  dia de exemplo (`test/helpers/exemplo.js`, a demanda do antigo botão "Preencher exemplo"). Depois de mudar uma
  regra do motor de propósito, regrave com
  `node scripts/capturar-goldens-motor.mjs` e revise a diferença.
- Os testes usam somente nomes e pesos fictícios.
- O modo compartilhado é testado com um servidor Supabase falso (`test/e2e/supabase-falso.js`) que segue o mesmo
  contrato do banco. `test/e2e/publicado.spec.js` entra no site publicado com login real (só roda com as senhas
  das contas no ambiente: veja o cabeçalho do arquivo).

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

## Formato dos dados

O cadastro e cada dia guardam a versão do formato (campo `esquema`). Para mudar o formato, acrescente um passo em
`js/migracoes.js` (com teste): as leituras aplicam os passos que faltam, o primeiro acesso de um operador regrava
no formato novo tudo o que estiver gravado (os dias e, por último, o cadastro) e o banco recusa conteúdo num formato
mais antigo do que o guardado. Nunca apague campos num passo: mantenha o que o passo não conhece.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Marcação das oito abas |
| `painel.html`, `js/painel.js` | TV da recepção: o painel de partidas e chegadas de hoje na tela toda |
| `css/app.css` | Estilos e temas claro/escuro |
| `js/config.js` | Janelas, missões, limites de peso e a frota inicial |
| `js/frota.js` | A frota no cadastro (matrícula, tipo e "Só Parafuso"): validação de um recurso novo e as matrículas de cada tipo |
| `js/categorias.js` | Categorias de recurso dos filtros (C152, C172, Simulador, PA-34 e Sala Ground) |
| `js/habilitacoes.js` | Habilitações individuais dos instrutores e o que cada missão exige |
| `js/rodizio.js` | Filas do rodízio (cheque, MLTE, noturno e C172) e a rotação de uma data para a seguinte |
| `js/agenda.js` | Prazo da agenda de solicitações (13:00 do dia anterior) e a importação para a demanda |
| `js/csv.js` | CSV da escala agrupado por avião, para o lançamento no portal do aeroclube |
| `js/status.js` | Status do voo com detalhes: o novo horário do atraso, o motivo do cancelamento e o atraso que invade outro voo |
| `js/quadro.js` | As linhas do painel de partidas e chegadas (Escala e TV da recepção) |
| `js/dados-pessoais.js` | Dados pessoais de alunos e instrutores: validação (CPF, CANAC, nascimento, celular e e-mail) e formatos |
| `js/perfis.js` | Perfis de acesso e o que cada um pode fazer na tela |
| `js/rules.js` | Regras das missões (Ground School, precedência, disponibilidade do aluno) |
| `js/engine.js` | Motor de alocação (função pura) |
| `js/storage.js` | Escala por data, migrações de dados e link compartilhado, sobre um backend (`js/backends/`: local ou Supabase) |
| `js/dias.js` | Cadastro separado do dia, cópia do dia anterior, conversão dos dados da fase 2 e BI das escalas |
| `js/migracoes.js` | Versões do formato dos dados guardados e os passos de uma versão para a seguinte |
| `js/sessao.js`, `js/config-supabase.js` | Login, perfil de acesso e projeto Supabase de cada endereço |
| `js/state.js`, `js/actions.js` | Estado da aplicação e ações (perfil, data, histórico e a escala refeita a cada alteração) |
| `js/manual.js` | Tabelas do manual geradas das regras (missões, habilitações exigidas, janelas, pesos e rodízio) |
| `js/views/` | Renderização de cada aba |
| `js/export.js` | CSV e PDF |
| `js/main.js` | Eventos da interface e inicialização |

## Fluxo de trabalho

Alterações entram por branch + pull request. O GitHub Actions roda todos os testes em cada push e PR;
ao entrar na `main`, o GitHub Pages publica a nova versão.
