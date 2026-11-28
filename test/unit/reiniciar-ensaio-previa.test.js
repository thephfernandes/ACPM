// O reinício do ensaio da Onda 3 na prévia (scripts/reiniciar-ensaio-previa.mjs, G2): recusa a produção antes de qualquer
// consulta; apaga as datas do ensaio (2098) e volta o formato guardado ao 29; com --converter, só a regra (a) de novo. O
// Supabase CLI de verdade nunca é chamado: um CLI falso, rodado pelo node (SUPABASE_CLI_JS), guarda cada consulta
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PROJETOS } from '../../js/config-supabase.js';
import { refDaPrevia, REF_DA_PRODUCAO } from '../../scripts/pedidos-da-previa.mjs';

// O CLI falso: guarda os argumentos de cada chamada (o projeto, a escrita, a consulta) num arquivo ao lado e responde a
// contagem do ensaio e a conversão
const CLI_FALSO = `const fs = require('fs'); const path = require('path');
const arquivo = path.join(path.dirname(__filename), 'chamadas.json');
const chamadas = fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, 'utf8')) : [];
const args = process.argv.slice(2);
chamadas.push(args);
fs.writeFileSync(arquivo, JSON.stringify(chamadas));
const q = args[args.length - 1];
const rows = q.startsWith('select (select count(*)') ? [{ dias: 12, pedidos: 40, formato: 31 }] : q.startsWith('select public.aprovar_') ? [{ aprovados: 3 }] : [];
process.stdout.write(JSON.stringify({ rows }));`;

function rodar(argumentos = [], env = {}) {
  const pasta = mkdtempSync(join(tmpdir(), 'reiniciar-ensaio-'));
  const cli = join(pasta, 'supabase-falso.cjs');
  writeFileSync(cli, CLI_FALSO);
  const r = spawnSync(process.execPath, ['scripts/reiniciar-ensaio-previa.mjs', ...argumentos],
    { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', env: { ...process.env, SECO: '', SUPABASE_CLI_JS: cli, ...env } });
  const arquivo = join(pasta, 'chamadas.json');
  return { ...r, chamadas: existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : [] };
}

describe('O reinício do ensaio na prévia (scripts/reiniciar-ensaio-previa.mjs)', () => {
  const PREVIA = refDaPrevia(PROJETOS);

  it('recusa a produção antes de qualquer consulta (o --ref de produção, ou vazio)', () => {
    for (const ref of [REF_DA_PRODUCAO, new URL(PROJETOS.producao.url).hostname.split('.')[0], '']) {
      const r = rodar(['--ref', ref]);
      assert.equal(r.status, 2, r.stdout);
      assert.match(r.stderr, /só na prévia/);
      assert.deepEqual(r.chamadas, [], 'nenhuma chamada ao CLI');
    }
    // No arquivo, a recusa vem antes da primeira consulta
    const script = readFileSync(new URL('../../scripts/reiniciar-ensaio-previa.mjs', import.meta.url), 'utf8');
    assert.ok(script.indexOf('process.exit(2)') < script.indexOf('function sql('));
    assert.ok(script.indexOf('refDaPrevia(PROJETOS)') < script.indexOf('function sql('));
  });

  it('outro projeto que não o da prévia é recusado antes de qualquer consulta (o --ref só aceita a prévia)', () => {
    const r = rodar(['--ref', 'abcdefghijklmnopqrst']);
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /só na prévia/);
    assert.deepEqual(r.chamadas, [], 'nenhuma chamada ao CLI');
    assert.equal(rodar(['--ref', PREVIA]).status, 0);
  });

  it('na prévia: lê quanto há e apaga só as datas de 2098; o formato guardado do cadastro e das outras datas não muda', () => {
    const r = rodar();
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.chamadas.every(a => a.slice(0, 4).join(' ') === `db query --remote=${PREVIA} -o`), 'sempre o projeto da prévia');
    const consultas = r.chamadas.map(a => [a[5], a[6]]);
    assert.match(consultas[0][1], /^select \(select count\(\*\) from public\.dias where data between '2098-01-01' and '2098-12-31'\)/);
    assert.equal(consultas[0][0], '--read-only');
    assert.deepEqual(consultas.slice(1).map(([modo, q]) => [modo, q.split(' ').slice(0, 3).join(' ')]), [
      ['--yes', 'delete from public.historico'], ['--yes', 'delete from public.solicitacoes'], ['--yes', 'delete from public.dias']
    ]);
    assert.ok(consultas.slice(1).every(([, q]) => q.endsWith("where data between '2098-01-01' and '2098-12-31'")), 'só as datas do ensaio');
    assert.ok(consultas.every(([, q]) => !/update|esquema/.test(q.replace(/esquema_do_conteudo\(conteudo\) from public\.documentos/, ''))), 'nenhuma escrita no formato');
    assert.match(r.stdout, /12 dias e 40 pedidos do ensaio; o cadastro no formato 31/);
  });

  it('--converter: só a regra (a) de novo (a migração do G2), depois da leitura', () => {
    const r = rodar(['--converter']);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.chamadas.slice(1).map(a => [a[5], a[6]]), [['--yes', 'select public.aprovar_solicitacoes_de_antes_da_aprovacao(false) as aprovados']]);
    assert.match(r.stdout, /3 pedidos aprovados por "importação anterior"/);
  });

  it('SECO=1: só mostra as consultas, sem chamar o CLI', () => {
    const r = rodar([], { SECO: '1' });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.chamadas, []);
    assert.match(r.stdout, /delete from public\.dias where data between '2098-01-01' and '2098-12-31';/);
    assert.match(r.stdout, /SECO: nada foi feito\./);
  });
});
