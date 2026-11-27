// Partes do manual geradas das regras do código: o manual não fica desatualizado quando uma regra muda.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MIS } from '../../js/config.js';
import * as manual from '../../js/manual.js';
import { missoesDoManual, quemPodeDar, pesosDoManual, combustivelDoManual, rodizioDoManual, glossarioDoManual } from '../../js/manual.js';
import { GLOSSARIO, ABAS_DO_GLOSSARIO } from '../../js/glossario.js';

describe('Manual', () => {
  it('quem pode dar cada missão, com os rótulos da grade de habilitações (e o que o avião acrescenta)', () => {
    assert.equal(quemPodeDar('Voo Local', ['C152', 'C172', 'PA-34']), 'Local (+ C152 no C152, + C172 no C172, + MLTE (PA-34) no PA-34)');
    assert.equal(quemPodeDar('Noturno', ['C172']), 'Noturno + C172');
    assert.equal(quemPodeDar('Multimotor', ['PA-34']), 'MLTE (PA-34)');
    assert.equal(quemPodeDar('Cheque PP', ['C152', 'C172']), 'Checador PP + Checador MNTE + Checador VFR');
    assert.equal(quemPodeDar('Cheque PC MLTE IFR', ['PA-34']), 'Checador PC + Checador MLTE + Checador IFR');
    assert.equal(quemPodeDar('Simulador', ['Sim. Mono', 'Sim. Multi']), 'Sim. Mono no Sim. Mono; Sim. Multi no Sim. Multi');
    assert.equal(quemPodeDar('Ground PA-34', ['Sala Ground']), 'Ground PA-34');
  });

  it('uma linha por missão, na ordem do cadastro de missões, com equipamentos e observações', () => {
    const linhas = missoesDoManual();
    assert.deepEqual(linhas.map(l => l.missao), Object.keys(MIS));
    const linha = nome => linhas.find(l => l.missao === nome);
    assert.deepEqual(linha('IFR'), { missao: 'IFR', equipamentos: 'C172 ou PA-34', quem: 'IFR (+ C172 no C172, + MLTE (PA-34) no PA-34)', obs: '' });
    assert.equal(linha('Voo Local').equipamentos, 'C152, C172 ou PA-34');
    assert.equal(linha('Ground C152').obs, 'Aula de 1h30, em turma; antes do primeiro voo de C152 do aluno no dia');
    assert.equal(linha('Ground Navegação').obs, 'Aula de 1h30, em turma; antes do primeiro voo de Navegação do aluno no dia');
    assert.equal(linha('Parafuso').obs, 'No C152, sempre num avião marcado “Só Parafuso” em Recursos (que só voa Parafuso)');
    assert.equal(linha('Noturno').obs, 'Só às 17:30');
  });

  it('tanque e autonomia de cada avião', () => {
    assert.deepEqual(combustivelDoManual(), ['C152: 26 gal, 4h', 'C172: 53 gal, 6h', 'PA-34: 93 gal, 4h30']);
  });

  it('limites de peso e categorias do rodízio (as janelas de operação saíram no J)', () => {
    assert.equal(Object.hasOwn(manual, 'janelasDoManual'), false);
    assert.deepEqual(pesosDoManual(), [['C152', '170 kg'], ['C172', '222 kg'], ['PA-34', '250 kg']]);
    assert.deepEqual(rodizioDoManual(), ['Voos de cheque', 'Voo MLTE (PA-34)', 'Voo noturno', 'Voo C172']);
  });

  it('o glossário, aba por aba, com todos os termos das dicas', () => {
    const grupos = glossarioDoManual();
    assert.deepEqual(grupos.map(g => g.aba), ABAS_DO_GLOSSARIO);
    assert.equal(grupos.flatMap(g => g.termos).length, Object.keys(GLOSSARIO).length);
    assert.deepEqual(grupos[0].termos[0], { termo: GLOSSARIO['horario-livre'].termo, texto: GLOSSARIO['horario-livre'].texto });
  });
});
