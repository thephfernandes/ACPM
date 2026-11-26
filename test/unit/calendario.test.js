// O calendário do trilho (js/calendario.js): as semanas do mês, as teclas, a parada do Tab, o que cada dia diz ao leitor de
// tela e a linha da data aberta
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { semanasDoMes, diaDaTecla, paradaDoTab, descricaoDoDia, linhaDaData, somarMeses, nomeDoMes } from '../../js/calendario.js';

const HOJE = '2026-11-10';

describe('As semanas do mês', () => {
  it('semanas inteiras, de domingo a sábado, que cobrem o mês', () => {
    const nov = semanasDoMes('2026-11');
    assert.equal(nov.length, 5);
    assert.deepEqual(nov[0], ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
    assert.equal(nov[4][6], '2026-12-05');
  });

  it('um mês de quatro semanas e um de seis', () => {
    assert.equal(semanasDoMes('2026-02').length, 4);
    const ago = semanasDoMes('2026-08');
    assert.equal(ago.length, 6);
    assert.equal(ago[0][0], '2026-07-26');
    assert.equal(ago[5][6], '2026-09-05');
  });

  it('a virada do ano', () => {
    const dez = semanasDoMes('2026-12');
    assert.equal(dez[0][0], '2026-11-29');
    assert.equal(dez.at(-1).at(-1), '2027-01-02');
  });

  it('os meses somados e o nome', () => {
    assert.equal(somarMeses('2026-11', 1), '2026-12');
    assert.equal(somarMeses('2026-12', 1), '2027-01');
    assert.equal(somarMeses('2026-01', -1), '2025-12');
    assert.equal(nomeDoMes('2026-11'), 'Novembro de 2026');
  });
});

describe('As teclas', () => {
  it('as setas: o dia antes e depois, a semana antes e depois', () => {
    assert.equal(diaDaTecla('2026-11-11', 'ArrowLeft'), '2026-11-10');
    assert.equal(diaDaTecla('2026-11-11', 'ArrowRight'), '2026-11-12');
    assert.equal(diaDaTecla('2026-11-11', 'ArrowUp'), '2026-11-04');
    assert.equal(diaDaTecla('2026-11-11', 'ArrowDown'), '2026-11-18');
    assert.equal(diaDaTecla('2026-11-30', 'ArrowRight'), '2026-12-01');
  });

  it('Home e End: o domingo e o sábado da semana', () => {
    assert.equal(diaDaTecla('2026-11-11', 'Home'), '2026-11-08');
    assert.equal(diaDaTecla('2026-11-11', 'End'), '2026-11-14');
    assert.equal(diaDaTecla('2026-11-08', 'Home'), '2026-11-08');
  });

  it('PageUp e PageDown: o mesmo dia do mês antes e depois (o último, no mês mais curto)', () => {
    assert.equal(diaDaTecla('2026-11-11', 'PageUp'), '2026-10-11');
    assert.equal(diaDaTecla('2026-11-11', 'PageDown'), '2026-12-11');
    assert.equal(diaDaTecla('2027-01-31', 'PageDown'), '2027-02-28');
    assert.equal(diaDaTecla('2026-03-31', 'PageUp'), '2026-02-28');
  });

  it('outra tecla: nada', () => {
    assert.equal(diaDaTecla('2026-11-11', 'Enter'), null);
    assert.equal(diaDaTecla('2026-11-11', 'a'), null);
  });
});

describe('A parada do Tab', () => {
  const semanas = semanasDoMes('2026-11');
  it('a data aberta, quando está nas semanas à vista', () => {
    assert.equal(paradaDoTab(semanas, { aberta: '2026-11-20', hoje: HOJE }), '2026-11-20');
  });
  it('senão, hoje, quando está à vista', () => {
    assert.equal(paradaDoTab(semanas, { aberta: '2027-01-04', hoje: HOJE }), HOJE);
  });
  it('senão, o dia 1 do mês à vista', () => {
    assert.equal(paradaDoTab(semanasDoMes('2027-01'), { aberta: '2026-11-11', hoje: HOJE }), '2027-01-01');
  });
});

describe('O que cada dia diz', () => {
  const base = { hoje: HOJE, aberta: '2026-11-11', qtd: 0 };
  it('a data completa; hoje, amanhã, a data aberta e os pedidos', () => {
    assert.equal(descricaoDoDia('2026-11-12', base), 'quinta-feira, 12 de novembro de 2026');
    assert.equal(descricaoDoDia(HOJE, base), 'terça-feira, 10 de novembro de 2026, hoje');
    assert.equal(descricaoDoDia('2026-11-11', { ...base, qtd: 3 }), 'quarta-feira, 11 de novembro de 2026, amanhã, data aberta: 3 pedidos');
    assert.equal(descricaoDoDia('2026-11-13', { ...base, qtd: 1 }), 'sexta-feira, 13 de novembro de 2026: 1 pedido');
  });
  it('o domingo e a data abrindo', () => {
    assert.equal(descricaoDoDia('2026-11-15', base), 'domingo, 15 de novembro de 2026, domingo: o aeroclube não opera');
    assert.equal(descricaoDoDia('2026-11-12', { ...base, abrindo: '2026-11-12' }), 'quinta-feira, 12 de novembro de 2026, abrindo');
  });
});

describe('A linha da data aberta', () => {
  it('o relativo, o dia da semana e a data; o ano só em outro ano', () => {
    assert.equal(linhaDaData('2026-11-11', HOJE), 'Amanhã · quarta-feira · 11 de novembro');
    assert.equal(linhaDaData(HOJE, HOJE), 'Hoje · terça-feira · 10 de novembro');
    assert.equal(linhaDaData('2026-11-20', HOJE), 'Sexta-feira · 20 de novembro');
    assert.equal(linhaDaData('2027-01-04', HOJE), 'Segunda-feira · 4 de janeiro de 2027');
  });
});
