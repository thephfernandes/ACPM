import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { hm, fmtH, fmtDurLabel, WLB, pad, esc, opts, amanhaISO, hojeISO, isoMenosDias, fimDoMes, rotuloDaData } from '../../js/format.js';

describe('Formatação', () => {
  it('minutos do dia em HH:MM', () => {
    assert.deepEqual([0, 390, 1050, 1439].map(hm), ['00:00', '06:30', '17:30', '23:59']);
  });

  it('horas com vírgula decimal e arredondamento de uma casa', () => {
    assert.deepEqual([2, 1.5, 1.25, 0, undefined, '3'].map(fmtH), ['2 h', '1,5 h', '1,3 h', '0 h', '0 h', '3 h']);
  });

  it('duração do Ground em 01h30', () => {
    assert.equal(fmtDurLabel(1.5), '01h30 (1,5 h)');
    assert.equal(fmtDurLabel(2), '2 h');
  });

  it('rótulo da janela de instrução', () => {
    assert.equal(WLB(0), '06:30 · 1º tempo');
    assert.equal(WLB(8), '17:30 · 9º tempo (noturno)');
  });

  it('nome padrão do aluno', () => {
    assert.equal(pad(0), 'Aluno 01');
    assert.equal(pad(19), 'Aluno 20');
  });

  it('escapa HTML', () => {
    assert.equal(esc('<b title="x">Ana & Bia</b>'), '&lt;b title=&quot;x&quot;&gt;Ana &amp; Bia&lt;/b&gt;');
    assert.equal(esc(42), '42');
    assert.equal(esc("x' onmouseover='1"), 'x&#39; onmouseover=&#39;1', 'aspas simples também (atributos com aspas simples)');
    assert.equal(opts([['a"><b>', '<i>x</i>'], ['2', 'Dois']], '2'),
      '<option value="a&quot;&gt;&lt;b&gt;">&lt;i&gt;x&lt;/i&gt;</option><option value="2" selected>Dois</option>', 'opções escapadas');
  });

  it('datas AAAA-MM-DD: amanhã, dias antes e fim do mês (com virada de mês, ano e bissexto)', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-12-31T15:00:00Z') });
    try { assert.equal(amanhaISO(), '2027-01-01'); } finally { mock.timers.reset(); }
    assert.equal(isoMenosDias('2026-11-11', 6), '2026-11-05');
    assert.equal(isoMenosDias('2026-03-02', 2), '2026-02-28');
    assert.equal(isoMenosDias('2027-01-01', 1), '2026-12-31');
    assert.deepEqual(['2026-11-11', '2026-12-01', '2026-02-10', '2028-02-10'].map(fimDoMes), ['2026-11-30', '2026-12-31', '2026-02-28', '2028-02-29']);
  });

  it('hoje no fuso local', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-12-31T15:00:00Z') });
    try { assert.equal(hojeISO(), '2026-12-31'); } finally { mock.timers.reset(); }
  });

  it('rótulo da data em uso: dia da semana, dia/mês (com o ano, se for outro) e hoje, amanhã ou ontem', () => {
    assert.deepEqual(rotuloDaData('2026-11-11', '2026-11-10'), { dia: 'quarta-feira, 11/11', relativo: 'amanhã' });
    assert.deepEqual(rotuloDaData('2026-11-10', '2026-11-10'), { dia: 'terça-feira, 10/11', relativo: 'hoje' });
    assert.deepEqual(rotuloDaData('2026-11-09', '2026-11-10'), { dia: 'segunda-feira, 09/11', relativo: 'ontem' });
    assert.deepEqual(rotuloDaData('2026-11-15', '2026-11-10'), { dia: 'domingo, 15/11', relativo: '' });
    assert.deepEqual(rotuloDaData('2027-01-04', '2026-12-31'), { dia: 'segunda-feira, 04/01/2027', relativo: '' });
    assert.deepEqual(rotuloDaData('2027-01-01', '2026-12-31'), { dia: 'sexta-feira, 01/01/2027', relativo: 'amanhã' });
  });
});
