// O glossário (revisão de 14/11): os termos da tela, explicados numa frase curta. Os textos vão para a dica (o balão que
// aparece no mouse, no foco ou no toque) e para a seção Glossário do Manual.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GLOSSARIO, ABAS_DO_GLOSSARIO } from '../../js/glossario.js';
import { REVISAO_H, MENOR_VOO_H } from '../../js/config.js';
import { LIMITES_DA_LEI } from '../../js/limites.js';
import { INTERVALO_DO_HANGAR } from '../../js/metricas.js';

const raiz = new URL('../../', import.meta.url);
const fontes = [
  readFileSync(new URL('index.html', raiz), 'utf8'),
  ...readdirSync(new URL('js/', raiz)).filter(f => f.endsWith('.js')).map(f => readFileSync(new URL(`js/${f}`, raiz), 'utf8')),
  ...readdirSync(new URL('js/views/', raiz)).filter(f => f.endsWith('.js')).map(f => readFileSync(new URL(`js/views/${f}`, raiz), 'utf8'))
].join('\n');

describe('Glossário', () => {
  it('cada termo tem o nome, uma frase curta (até 240 caracteres, texto puro, termina com ponto) e a aba', () => {
    assert.ok(Object.keys(GLOSSARIO).length >= 25);
    for (const [id, { termo, texto, aba }] of Object.entries(GLOSSARIO)) {
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
    const desconhecidas = [...new Set(usadas)].filter(id => !Object.hasOwn(GLOSSARIO, id));
    assert.deepEqual(desconhecidas, []);
  });

  it('os números das regras vêm da configuração', () => {
    assert.match(GLOSSARIO['horas-desde-a-revisao'].texto, new RegExp(`revisão de ${REVISAO_H} horas`));
    assert.match(GLOSSARIO['saldo-da-revisao'].texto, new RegExp(`voo de ${MENOR_VOO_H} h`));
    assert.match(GLOSSARIO['tempo-parado'].texto, new RegExp(`${INTERVALO_DO_HANGAR / 60} h ou mais`));
    assert.match(GLOSSARIO['limites-da-lei'].texto, new RegExp(`${LIMITES_DA_LEI.vooMesH} h no mês`));
    assert.match(GLOSSARIO['limites-da-lei'].texto, new RegExp(`${LIMITES_DA_LEI.vooAnoH} h no ano`));
  });
});
