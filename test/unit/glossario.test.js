// O glossário: os termos da tela, explicados numa frase curta. Os textos vão para a dica (o balão que aparece no
// mouse, no foco ou no toque) e para a seção Glossário do Manual.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GLOSSARIO, montarGlossario, ABAS_DO_GLOSSARIO } from '../../js/glossario.js';
import { REVISAO_H, MENOR_VOO_H, LIMITE_DE_VOOS_LOCAIS, T, NI } from '../../js/config.js';
import { hm } from '../../js/format.js';
import { ligada } from '../../js/funcionalidades.js';
import { LIMITES_DA_LEI } from '../../js/limites.js';
import { INTERVALO_DO_HANGAR } from '../../js/metricas.js';

const raiz = new URL('../../', import.meta.url);
const fontes = [
  readFileSync(new URL('index.html', raiz), 'utf8'),
  ...readdirSync(new URL('js/', raiz)).filter(f => f.endsWith('.js')).map(f => readFileSync(new URL(`js/${f}`, raiz), 'utf8')),
  ...readdirSync(new URL('js/views/', raiz)).filter(f => f.endsWith('.js')).map(f => readFileSync(new URL(`js/views/${f}`, raiz), 'utf8'))
].join('\n');

// O glossário inteiro (com todas as funcionalidades ligadas) e o de nenhuma (js/funcionalidades.js)
const INTEIRO = montarGlossario(() => true), SEM_FUNCIONALIDADES = montarGlossario(() => false);

describe('Glossário', () => {
  it('cada termo tem o nome, uma frase curta (até 240 caracteres, texto puro, termina com ponto) e a aba', () => {
    assert.ok(Object.keys(INTEIRO).length >= 25);
    for (const [id, { termo, texto, aba }] of [...Object.entries(INTEIRO), ...Object.entries(SEM_FUNCIONALIDADES)]) {
      assert.match(id, /^[a-z0-9-]+$/, id);
      assert.ok(termo && termo.length <= 40, id);
      assert.ok(texto.length <= 240, `${id}: ${texto.length} caracteres`);
      assert.ok(texto.endsWith('.'), `${id}: termina com ponto`);
      assert.doesNotMatch(texto, /[<>]/, `${id}: texto puro`);
      assert.ok(ABAS_DO_GLOSSARIO.includes(aba), `${id}: aba ${aba}`);
    }
  });

  it('toda dica usada nas telas existe no glossário', () => {
    const usadas = [...fontes.matchAll(/data-dica="([a-z0-9-]+)"/g)].map(m => m[1]);
    const desconhecidas = [...new Set(usadas)].filter(id => !Object.hasOwn(INTEIRO, id));
    assert.deepEqual(desconhecidas, []);
  });

  it('os números das regras vêm da configuração', () => {
    assert.match(GLOSSARIO['horas-disponiveis'].texto, new RegExp(`revisão de ${REVISAO_H} horas`));
    assert.match(GLOSSARIO['horas-disponiveis'].texto, new RegExp(`voo de ${MENOR_VOO_H} h`));
    assert.match(GLOSSARIO['tempo-parado'].texto, new RegExp(`${INTERVALO_DO_HANGAR / 60} h ou mais`));
    assert.match(GLOSSARIO['limites-da-lei'].texto, new RegExp(`${LIMITES_DA_LEI.vooMesH} h no mês`));
    assert.match(GLOSSARIO['limites-da-lei'].texto, new RegExp(`${LIMITES_DA_LEI.vooAnoH} h no ano`));
    assert.match(GLOSSARIO['fora-da-regra'].texto, new RegExp(`até as ${hm(T[NI])}, no máximo ${LIMITE_DE_VOOS_LOCAIS} voos locais`));
  });

  // A seção Glossário do Manual lista os termos de cada aba na ordem do glossário: os da aba Cursos ficam no bloco dela,
  // e o grupo começa pela fase do curso e pelos alunos nela (o índice das fases), não pelo trecho do Noturno, que fica no
  // fim
  it('os termos da aba Cursos, na ordem do bloco dela', () => {
    const daAba = Object.entries(INTEIRO).filter(([, t]) => t.aba === 'Cursos').map(([id]) => id);
    assert.deepEqual(daAba, ['fase-do-curso', 'alunos-na-fase', 'quando-voar', 'dispensada', 'trecho-do-noturno', 'habilitacoes-da-missao']);
  });

  it('com o hangar e o progresso desligados, os termos deles saem, e os outros não falam deles', () => {
    const saem = Object.keys(INTEIRO).filter(id => !Object.hasOwn(SEM_FUNCIONALIDADES, id));
    assert.deepEqual(saem, ['resultado', 'fora-da-ordem', 'curso-encerrado', 'hangar', 'progresso', 'alunos-na-fase']);
    for (const [id, { termo, texto }] of Object.entries(SEM_FUNCIONALIDADES)) {
      assert.doesNotMatch(`${termo} ${texto}`, /hangar|progresso|próxima missão|ainda não aprovou|sugerida|o resultado/i, id);
    }
    // Uma só: os termos dela saem, e os da outra ficam como estão
    const semHangar = montarGlossario(nome => nome !== 'hangar');
    assert.deepEqual(Object.keys(INTEIRO).filter(id => !Object.hasOwn(semHangar, id)), ['hangar']);
    assert.equal(semHangar['missao-do-curso'].texto, INTEIRO['missao-do-curso'].texto);
    assert.doesNotMatch(Object.values(semHangar).map(t => t.texto).join(' '), /hangar/i);
  });

  it('o glossário das telas é o das funcionalidades ligadas no app', () => assert.deepEqual(GLOSSARIO, montarGlossario(ligada)));
});

// A Agenda pelo curso do aluno (F1c): a missão do pedido e o 7º voo local, com o limite da configuração
describe('Glossário: a Agenda', () => {
  it('a missão do pedido vem do curso do aluno, e o 7º voo local pede a confirmação', () => {
    assert.match(GLOSSARIO['missao-do-pedido'].texto, /as missões do programa dele, por fase/);
    assert.equal(GLOSSARIO['setimo-voo-local'].termo, `${LIMITE_DE_VOOS_LOCAIS + 1}º voo local`);
    assert.match(GLOSSARIO['setimo-voo-local'].texto, new RegExp(`No máximo ${LIMITE_DE_VOOS_LOCAIS} voos locais .*“Registrar mesmo assim”`));
  });
});
