import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { hm, fmtH, fmtDurLabel, rotuloDoInicio, pad, esc, opts, amanhaISO, hojeISO, somarDias, fimDoMes, rotuloDaData, nomeLimpo, LIMITE_DO_NOME, dataIsoValida, minutoDoDia, lerHoras, numeroBr, duracaoHm, pesoBr, chaveDeBusca, iniciais } from '../../js/format.js';

// O relógio no fuso do aeroclube (São Paulo, UTC−3), qualquer que seja o da máquina (o CI roda em UTC): das 21:00 à
// meia-noite, a data local já não é a do UTC. O fuso de antes volta no fim
function emSaoPaulo(fn) {
  const antes = process.env.TZ;
  process.env.TZ = 'America/Sao_Paulo';
  try { return fn(); } finally {
    if (antes === undefined) delete process.env.TZ;
    else process.env.TZ = antes;
  }
}

describe('Formatação', () => {
  it('minutos do dia em HH:MM', () => {
    assert.deepEqual([0, 390, 1050, 1439].map(hm), ['00:00', '06:30', '17:30', '23:59']);
  });

  it('horas com vírgula decimal e arredondamento de uma casa', () => {
    assert.deepEqual([2, 1.5, 1.25, 0, undefined, '3'].map(fmtH), ['2 h', '1,5 h', '1,3 h', '0 h', '0 h', '3 h']);
    // O número com vírgula, sem arredondar; as horas digitadas, com vírgula ou ponto, em décimos de hora
    assert.deepEqual([2, 1.5, 0.25, 12.75].map(numeroBr), ['2', '1,5', '0,25', '12,75']);
    assert.deepEqual(['1,5', '1.5', ' 2,26 ', '3', '0'].map(lerHoras), [1.5, 1.5, 2.3, 3, 0]);
    for (const invalido of ['', 'abc', ',']) assert.ok(Number.isNaN(lerHoras(invalido)), invalido);
    assert.deepEqual([570, 600, 90, 5, 0].map(duracaoHm), ['9h30', '10h00', '1h30', '0h05', '0h00']);
  });

  // O peso da tripulação é a soma dos pesos do aluno e do instrutor, que podem ter décimos: a soma traz o resto do ponto
  // flutuante, que a tela, o PDF e o CSV não mostram
  it('peso em décimos de kg, com a vírgula e sem o resto do ponto flutuante da soma', () => {
    assert.equal(40.1 + 40.7, 80.80000000000001);
    assert.equal(85.3 + 88.6, 173.89999999999998);
    assert.deepEqual([40.1 + 40.7, 85.3 + 88.6, 150, 72.5, 70.25, 0, undefined].map(pesoBr), ['80,8', '173,9', '150', '72,5', '70,3', '0', '0']);
  });

  it('duração do Ground em 01h30', () => {
    assert.equal(fmtDurLabel(1.5), '01h30 (1,5 h)');
    assert.equal(fmtDurLabel(2), '2 h');
  });

  // J (S1): a Lista e o PDF agrupam pelo horário de início de cada voo; o das 17:30 diz que é o noturno
  it('rótulo do horário de início de um grupo da Lista', () => {
    assert.equal(rotuloDoInicio(420), '07:00');
    assert.equal(rotuloDoInicio(390), '06:30');
    assert.equal(rotuloDoInicio(1050), '17:30 · noturno');
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

  it('uma data AAAA-MM-DD que existe no calendário', () => {
    assert.deepEqual(['2026-11-11', '2024-02-29', '2026-12-31'].map(dataIsoValida), [true, true, true]);
    assert.deepEqual(['2026-02-30', '2025-02-29', '2026-13-01', '2026-11-1', '11/11/2026', '', null, undefined, 20261111].map(dataIsoValida),
      [false, false, false, false, false, false, false, false, false]);
  });

  it('o nome de uma pessoa: sem espaços a mais e com até 80 caracteres; vazio fica o anterior', () => {
    assert.equal(LIMITE_DO_NOME, 80);
    assert.equal(nomeLimpo('  Ana   Paula  ', 'Ana'), 'Ana Paula');
    assert.equal(nomeLimpo('A'.repeat(100), 'Ana'), 'A'.repeat(80));
    assert.equal(nomeLimpo('   ', 'Ana'), 'Ana');
  });

  // As buscas (Instrutores, Alunos, Demanda, Escala e BI) comparam as chaves: o nome digitado sem acento, em minúsculas ou
  // com espaços a mais acha o cadastrado
  it('a chave da busca: sem acentos, em minúsculas e com um espaço só entre as palavras', () => {
    assert.equal(chaveDeBusca('João'), 'joao');
    assert.equal(chaveDeBusca('  Maria   da CONCEIÇÃO '), 'maria da conceicao');
    assert.equal(chaveDeBusca('Ângela Müller Brandão'), 'angela muller brandao');
    // O mesmo nome escrito com a letra acentuada inteira (NFC) ou com o sinal separado (NFD) dá a mesma chave
    assert.equal(chaveDeBusca('Jos\u00e9'), chaveDeBusca('Jose\u0301'));
    assert.equal(chaveDeBusca('Jos\u00e9'), 'jose');
    // O que não é letra fica: o código da missão, o número e o hífen
    assert.equal(chaveDeBusca('PP-07 · Navegação C152'), 'pp-07 · navegacao c152');
    assert.equal(chaveDeBusca('Instrutor 01'), 'instrutor 01');
    assert.deepEqual([undefined, null, '', '   '].map(chaveDeBusca), ['', '', '', '']);
    // Quem digita com acento acha quem foi cadastrado sem ele, e o contrário
    assert.ok(chaveDeBusca('Joao Silva').includes(chaveDeBusca('joão')));
    assert.ok(chaveDeBusca('João Silva').includes(chaveDeBusca('JOAO  s')));
  });

  it('datas AAAA-MM-DD: amanhã, dias depois e antes, e fim do mês (com virada de mês, ano e bissexto)', () => {
    // 31/12/2026, 23:00 em São Paulo (no UTC, já 01/01): amanhã é 01/01, pelo relógio local
    emSaoPaulo(() => {
      mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-01T02:00:00Z') });
      try { assert.equal(amanhaISO(), '2027-01-01'); } finally { mock.timers.reset(); }
    });
    assert.equal(somarDias('2026-11-11', -6), '2026-11-05');
    assert.equal(somarDias('2026-03-02', -2), '2026-02-28');
    assert.equal(somarDias('2027-01-01', -1), '2026-12-31');
    assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
    assert.equal(somarDias('2028-02-28', 1), '2028-02-29');
    assert.equal(somarDias('2026-11-11', 0), '2026-11-11');
    assert.deepEqual(['2026-11-11', '2026-12-01', '2026-02-10', '2028-02-10'].map(fimDoMes), ['2026-11-30', '2026-12-31', '2026-02-28', '2028-02-29']);
  });

  it('hoje no fuso local', () => {
    // 31/12/2026, 23:00 em São Paulo, quando no UTC já é 01/01/2027
    emSaoPaulo(() => {
      mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-01T02:00:00Z') });
      try { assert.equal(hojeISO(), '2026-12-31'); } finally { mock.timers.reset(); }
    });
  });

  it('rótulo da data em uso: dia da semana, dia/mês (com o ano, se for outro) e hoje, amanhã ou ontem', () => {
    assert.deepEqual(rotuloDaData('2026-11-11', '2026-11-10'), { dia: 'quarta-feira, 11/11', semana: 'quarta-feira', semanaCurta: 'qua.', data: '11/11', relativo: 'amanhã' });
    assert.deepEqual(rotuloDaData('2026-11-10', '2026-11-10'), { dia: 'terça-feira, 10/11', semana: 'terça-feira', semanaCurta: 'ter.', data: '10/11', relativo: 'hoje' });
    assert.deepEqual(rotuloDaData('2026-11-09', '2026-11-10'), { dia: 'segunda-feira, 09/11', semana: 'segunda-feira', semanaCurta: 'seg.', data: '09/11', relativo: 'ontem' });
    assert.deepEqual(rotuloDaData('2026-11-15', '2026-11-10'), { dia: 'domingo, 15/11', semana: 'domingo', semanaCurta: 'dom.', data: '15/11', relativo: '' });
    assert.equal(rotuloDaData('2027-01-02', '2026-11-10').dia, 'sábado, 02/01/2027', 'outro ano: com o ano');
    assert.deepEqual(rotuloDaData('2027-01-04', '2026-12-31'), { dia: 'segunda-feira, 04/01/2027', semana: 'segunda-feira', semanaCurta: 'seg.', data: '04/01/2027', relativo: '' });
    assert.deepEqual(rotuloDaData('2027-01-01', '2026-12-31'), { dia: 'sexta-feira, 01/01/2027', semana: 'sexta-feira', semanaCurta: 'sex.', data: '01/01/2027', relativo: 'amanhã' });
  });

  it('o minuto do dia no relógio local', () => {
    // Em São Paulo, 12:30 no relógio local é 15:30 no UTC
    emSaoPaulo(() => {
      assert.equal(minutoDoDia(new Date(2026, 10, 11, 12, 30)), 750);
      assert.equal(minutoDoDia(new Date(2026, 10, 11, 0, 0)), 0);
      assert.equal(minutoDoDia(new Date(2026, 10, 11, 23, 59)), 1439);
    });
  });
});

// As iniciais (o menu da conta e os avatares das listas, F2): o primeiro e o último nome; o e-mail, a primeira letra
describe('iniciais', () => {
  it('o primeiro e o último nome, em maiúsculas; um nome só, a primeira letra; o e-mail, a primeira letra; vazio, "?"', () => {
    assert.equal(iniciais('Maria da Conceição Souza'), 'MS');
    assert.equal(iniciais('ana'), 'A');
    assert.equal(iniciais('ana.souza@exemplo.com'), 'A');
    assert.equal(iniciais(''), '?');
    assert.equal(iniciais(null), '?');
  });
});
