// Sugestões para um conflito: o horário mais tarde (js/reparo.js). Sem nada no mesmo horário, o voo passa para o
// primeiro horário mais tarde no mesmo dia: com o avião de antes só quando ele ainda serve ao voo e está livre; senão,
// primeiro um avião em que o instrutor de antes voa, e só depois outro. Na turma de Ground, o horário novo termina antes
// do primeiro voo de hoje que depende dela; a volta do noturno de ontem não depende do Ground de hoje.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { sugerirReparos, aplicarReparo } from '../../js/reparo.js';
import { FROTA_INICIAL } from '../../js/frota.js';
import { aluno, cenario, instrutor, apenas } from '../helpers/montar.js';

const pino = o => ({ a: o.a, b: o.b, r: o.r, insId: o.insId, ...(o.isGround ? { classKey: o.classKey } : {}) });
// Monta, aprova e muda o dia; devolve o estado mudado e a escala com o conflito. A volta do noturno de ontem não é um voo
// fixo de hoje (ela vem da escala de ontem)
function aprovadoEMudado(base, mudar) {
  const antes = runAllocationEngine(base);
  const fixos = Object.fromEntries(antes.out.filter(o => !o.trecho).map(o => [o.fKey, pino(o)]));
  const estado = mudar({ ...base, fixos });
  return { estado, resultado: runAllocationEngine(estado) };
}
// A escala com a sugestão aplicada nos voos fixos
const aplicada = (estado, resultado, fKey, opcao) => runAllocationEngine({ ...estado, fixos: aplicarReparo(estado.fixos, resultado, fKey, opcao) });

describe('Sugestões: o horário mais tarde', () => {
  it('o avião de antes fica só quando ainda serve ao voo: o IFR no avião que passou a "Só VFR" vai para o outro C172', () => {
    // Dois C172 (os outros em manutenção): o IFR do aluno 1000 e o Voo Local do 1001, às 06:30. Depois da aprovação, o
    // avião do IFR passa a "Só VFR": às 06:30, o outro C172 está no Voo Local; às 08:20, os dois estão livres
    const base = cenario({
      ins: [instrutor(1, 9), instrutor(2, 9)],
      stu: [aluno(1000, { mis: 'IFR', eq: 'C172', p1: 390, p2: -1 }), aluno(1001, { mis: 'Voo Local', eq: 'C172', p1: 390, p2: -1 })],
      semAeronaves: apenas('C172', 'PR-HAR', 'PR-BUL')
    });
    const { estado, resultado } = aprovadoEMudado(base, e => ({
      ...e, frota: FROTA_INICIAL.map(f => (f.reg === e.fixos['1000_0_1'].r ? { ...f, soVfr: true } : f))
    }));
    const voo = resultado.out.find(o => o.stuId === 1000);
    assert.deepEqual(voo.conflitoCodigos, ['so-vfr']);
    // (o outro tipo, que a lista do conflito também ganha, fica de fora daqui)
    const opcoes = sugerirReparos(estado, resultado, voo.fKey, { maximo: 10 }).filter(o => o.tipo !== 'tipo');
    assert.deepEqual(opcoes.map(o => o.tipo), ['horario', 'soltar', 'cancelar'], 'no mesmo horário, nenhum C172 serve');
    const outro = ['PR-HAR', 'PR-BUL'].find(r => r !== voo.r);
    assert.deepEqual(opcoes[0].mudancas, { a: 500, b: 560, r: outro, insId: voo.insId }, 'o "Só VFR" está livre, mas não serve ao IFR');
    assert.deepEqual(aplicada(estado, resultado, voo.fKey, opcoes[0]).out.filter(o => o.conflito).map(o => [o.fKey, o.conflito]), []);
  });

  it('sem o avião de antes, primeiro um em que o instrutor de antes voa: o Multimotor fica com ele, não vai para o PR-VOM', () => {
    // O Multimotor do aluno 1000 às 06:30 com o instrutor 1, o único na aprovação (sem a habilitação do PR-VOM).
    // Depois da aprovação, o instrutor 2, que a tem, vem; o avião do voo entra em manutenção e as 06:30 fecham
    const doVom = instrutor(2, 9, { on: false });
    const base = cenario({
      ins: [instrutor(1, 9), { ...doVom, hab: [...doVom.hab, 'aviao:PR-VOM'] }],
      stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34', p1: 390, p2: -1 })]
    });
    const { estado, resultado } = aprovadoEMudado(base, e => ({
      ...e, ins: e.ins.map(x => ({ ...x, on: true })), av: { ...e.av, [e.fixos['1000_0_1'].r]: false }, win: e.win.map((v, w) => (w === 0 ? false : v))
    }));
    const [voo] = resultado.out;
    assert.deepEqual([voo.insId, voo.conflitoCodigos], [1, ['aviao-indisponivel', 'horario-fechado']]);
    const opcoes = sugerirReparos(estado, resultado, voo.fKey, { maximo: 10 });
    const horario = opcoes.find(o => o.tipo === 'horario');
    assert.ok(horario, JSON.stringify(opcoes));
    // O outro PA-34 sem habilitação própria, com o instrutor de antes (no PR-VOM, só com o instrutor 2)
    const outro = ['PT-JOB', 'PT-KIW'].find(r => r !== voo.r);
    assert.deepEqual(horario.mudancas, { a: 510, b: 570, r: outro, insId: 1 });
    assert.equal(aplicada(estado, resultado, voo.fKey, horario).out[0].conflito, undefined);
  });

  it('na turma de Ground de quem volta do noturno de ontem, a volta não depende do Ground: o horário mais tarde serve', () => {
    // O aluno 1000 volta de BH no PR-HAR com o instrutor 1 (07:30–08:30, livres às 10:10); ele e o 1001 têm o Ground
    // C172 às 10:10. Depois da aprovação, as 10:10 fecham: a turma passa para as 11:30
    const ground = { mis: 'Ground C172', eq: 'Sala Ground', nb: 1.5, p1: 610, p2: -1 };
    const base = cenario({ ins: [instrutor(1, 9), instrutor(2, 9)], stu: [aluno(1000, ground), aluno(1001, ground)] });
    base.noturnosDaVespera = [{ stuId: 1000, mid: 0, insId: 1, r: 'PR-HAR', eqType: 'C172', s: 'Aluno 1000', ins: 'Instrutor 01', stuKg: 70, fim: 1290 }];
    const { estado, resultado } = aprovadoEMudado(base, e => ({ ...e, win: e.win.map((v, w) => (w === 2 ? false : v)) }));
    assert.deepEqual(resultado.out.filter(o => o.trecho).map(o => [o.stuId, o.trecho, o.a, o.b]), [[1000, 'volta', 450, 510]]);
    const turma = resultado.out.filter(o => o.isGround);
    assert.deepEqual(turma.map(o => [o.stuId, o.a, o.conflitoCodigos]), [[1000, 610, ['horario-fechado']], [1001, 610, ['horario-fechado']]]);
    const opcoes = sugerirReparos(estado, resultado, turma[0].fKey, { maximo: 10 });
    const horario = opcoes.find(o => o.tipo === 'horario');
    assert.ok(horario, JSON.stringify(opcoes));
    assert.deepEqual(horario.mudancas, { a: 690, b: 780, insId: turma[0].insId });
    const depois = aplicada(estado, resultado, turma[0].fKey, horario);
    assert.deepEqual(depois.out.filter(o => o.isGround).map(o => [o.stuId, o.a, o.conflito]), [[1000, 690, undefined], [1001, 690, undefined]]);
  });
});
