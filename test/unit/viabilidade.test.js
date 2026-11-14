// Regras de viabilidade da escala (fase 10): as mesmas para o motor, a divisão das horas e a troca de matrículas (antes
// repetidas em cada passo). A compactação, os limites legais e as sugestões de reparo vão usar estas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sobrepoe, livre, cobre, pesoCabe, cabeNoSaldo } from '../../js/viabilidade.js';

describe('Viabilidade', () => {
  it('dois intervalos se sobrepõem quando um começa antes de o outro terminar (encostar não conta)', () => {
    assert.equal(sobrepoe(390, 450, 420, 480), true);
    assert.equal(sobrepoe(390, 450, 450, 510), false);
    assert.equal(sobrepoe(450, 510, 390, 450), false);
  });

  it('livre: nenhum intervalo ocupado se sobrepõe (sem ocupação, livre)', () => {
    assert.equal(livre([[390, 450], [610, 670]], 500, 560), true);
    assert.equal(livre([[390, 450], [610, 670]], 440, 500), false);
    assert.equal(livre(undefined, 390, 450), true);
  });

  it('o instrutor cobre o voo quando está disponível em todos os períodos que o voo toca', () => {
    const todas = Array(9).fill(true);
    assert.equal(cobre(todas, 390, 450), true);
    const semManha = todas.map((v, k) => k > 0);
    assert.equal(cobre(semManha, 390, 450), false, '06:30 cai no 1º período');
    assert.equal(cobre(semManha, 500, 560), true, '08:20 em diante');
    const semTerceiro = todas.map((v, k) => k !== 2);
    assert.equal(cobre(semTerceiro, 560, 620), false, 'do 2º para o 3º período: precisa dos dois');
  });

  it('peso: aluno + instrutor dentro do limite; sem o limite ou sem um dos pesos não há como conferir (vale)', () => {
    assert.equal(pesoCabe(80, 80, 170), true);
    assert.equal(pesoCabe(100, 80, 170), false);
    assert.equal(pesoCabe(0, 80, 170), true);
    assert.equal(pesoCabe(100, 0, 170), true);
    assert.equal(pesoCabe(100, 100, 0), true);
    // Na divisão das horas o voo só passa para quem tem o peso informado
    assert.equal(pesoCabe(100, 0, 170, { exigirPesoDoInstrutor: true }), false);
    assert.equal(pesoCabe(0, 0, 170, { exigirPesoDoInstrutor: true }), true, 'sem o peso do aluno, não há o que conferir');
  });

  it('o voo cabe no saldo até a revisão de 50 horas', () => {
    assert.equal(cabeNoSaldo(48, 1, 49), true);
    assert.equal(cabeNoSaldo(48.5, 1, 49), false);
    assert.equal(cabeNoSaldo(10, 1, Infinity), true);
  });
});
