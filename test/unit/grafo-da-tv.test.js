// Os módulos que o painel da TV (painel.html → js/painel.js) carrega, numa lista escrita: um módulo que entra no grafo da
// TV (ou sai dele) muda esta lista no mesmo commit, e o PR diz por quê. A TV roda sozinha na recepção, sem ninguém para
// recarregar: um módulo do app que entra no grafo dela sem querer (uma tela, o registro dos desenhos) a faria parar
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const JS = resolve(RAIZ, 'js');

// Os módulos alcançados a partir de js/painel.js pelos import e export … from estáticos (o painel não usa import())
function grafo(inicio) {
  const vistos = new Set();
  const visitar = arquivo => {
    if (vistos.has(arquivo)) return;
    vistos.add(arquivo);
    const arvore = espree.parse(readFileSync(arquivo, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
    for (const no of arvore.body) {
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(no.type) && no.source && no.source.value.startsWith('.')) {
        visitar(resolve(dirname(arquivo), no.source.value));
      }
    }
  };
  visitar(inicio);
  return [...vistos].map(a => relative(JS, a).split(sep).join('/')).sort();
}

// Desde o F0b: js/agenda.js não leva mais a importação dos pedidos (js/processamento.js), e com ela js/fixos.js e
// js/progresso.js saíram da TV. Desde o J: js/tempos.js (os nove inícios congelados, sem nenhum import) entra pelo
// js/format.js e pelo js/horarios.js, que já eram da TV; com o formato 28, js/fechamentos.js (puro: os horários fechados
// da data e os do win de antes, que o passo 28 converte) entra pelo js/migracoes.js, e os imports dele já eram da TV
const DA_TV = [
  'agenda.js', 'backends/local.js', 'backends/supabase.js', 'categorias.js', 'config-do-painel.js',
  'config-supabase.js', 'config.js', 'conflitos.js', 'cursos.js', 'dados-pessoais.js', 'escala-gravada.js',
  'fechamentos.js', 'format.js', 'frota.js', 'habilitacoes.js', 'horarios.js', 'limites.js', 'meteorologia.js', 'migracoes.js',
  'painel.js', 'perfis.js', 'programa.js', 'quadro.js', 'resultados.js', 'rules.js', 'sessao-da-tv.js', 'status.js',
  'tempos.js', 'views/meteorologia.js', 'views/painel-aeroporto.js', 'voo.js'
];

describe('O grafo da TV', () => {
  it('js/painel.js carrega exatamente estes módulos', () => {
    assert.deepEqual(grafo(resolve(JS, 'painel.js')), DA_TV);
  });

  it('nenhuma tela, evento ou o registro dos desenhos entra na TV', () => {
    const daTv = grafo(resolve(JS, 'painel.js'));
    const fora = daTv.filter(m => m.startsWith('eventos/') || ['actions.js', 'redesenho.js', 'main.js', 'processamento.js'].includes(m)
      || (m.startsWith('views/') && !['views/painel-aeroporto.js', 'views/meteorologia.js'].includes(m)));
    assert.deepEqual(fora, []);
  });
});
