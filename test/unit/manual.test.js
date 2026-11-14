// Partes do manual geradas das regras do código: o manual não fica desatualizado quando uma regra muda.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MIS } from '../../js/config.js';
import { missoesDoManual, quemPodeDar, janelasDoManual, pesosDoManual, combustivelDoManual, rodizioDoManual } from '../../js/manual.js';

describe('Manual', () => {
  it('quem pode dar cada missão, com os rótulos da grade de habilitações (e o que o avião acrescenta)', () => {
    assert.equal(quemPodeDar('Voo Local', ['C152', 'C172', 'PA-34']), 'Local (+ C172 no C172, + MLTE (PA-34) no PA-34)');
    assert.equal(quemPodeDar('Noturno', ['C172']), 'Noturno + C172');
    assert.equal(quemPodeDar('Multimotor', ['PA-34']), 'MLTE (PA-34)');
    assert.equal(quemPodeDar('Cheque PP', ['C152', 'C172']), 'Checador VFR, Checador IFR ou Checador MLTE IFR');
    assert.equal(quemPodeDar('Cheque PC MLTE IFR', ['PA-34']), 'Checador MLTE IFR');
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
    assert.equal(linha('Noturno').obs, 'Só na janela das 17:30');
  });

  it('tanque e autonomia de cada avião (fase 10)', () => {
    assert.deepEqual(combustivelDoManual(), ['C152: 26 gal, 4h', 'C172: 53 gal, 6h', 'PA-34: 93 gal, 4h30']);
  });

  it('janelas, limites de peso e categorias do rodízio', () => {
    assert.deepEqual(janelasDoManual(), ['06:30', '08:20', '10:10', '11:30', '12:40', '13:40', '14:30', '16:20', '17:30 (noturno)']);
    assert.deepEqual(pesosDoManual(), [['C152', '170 kg'], ['C172', '222 kg'], ['PA-34', '250 kg']]);
    assert.deepEqual(rodizioDoManual(), ['Voos de cheque', 'Voo MLTE (PA-34)', 'Voo noturno', 'Voo C172']);
  });
});
