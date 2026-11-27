// Os horários fechados de uma data (J, formato 28): { de, ate, categorias? } em minutos, [de, ate), 0 ≤ de < ate ≤ 1440,
// categorias as ids de CATEGORIAS (ausente: todos os recursos). fechamentosDoWin converte as nove janelas de antes
// (dias antes do 28 e os estados dos goldens) e fecha exatamente os minutos que elas fechavam.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarFechamentos, fechamentosDoWin, horarioAberto, rotuloDosFechamentos, horariosQueOIntervaloFecha, cabeOFechamento, MAXIMO_DE_FECHAMENTOS } from '../../js/fechamentos.js';
import { INICIOS_DOS_TEMPOS as T, periodoDoMinuto } from '../../js/horarios.js';

const TODAS = ['C152', 'C172', 'sim', 'PA-34', 'ground'];

describe('normalizarFechamentos', () => {
  test('o que não é lista, e cada item inválido, sai', () => {
    assert.deepEqual(normalizarFechamentos(null), []);
    assert.deepEqual(normalizarFechamentos({ de: 0, ate: 10 }), []);
    assert.deepEqual(normalizarFechamentos([
      null, 'x', { de: 600 }, { ate: 700 }, { de: 700, ate: 700 }, { de: 800, ate: 700 }, { de: -10, ate: 100 },
      { de: 100, ate: 1441 }, { de: 1.5, ate: 100 }, { de: '600', ate: 700 }
    ]), []);
  });

  test('os limites: 0 e 1440 valem', () => {
    assert.deepEqual(normalizarFechamentos([{ de: 0, ate: 1440 }]), [{ de: 0, ate: 1440 }]);
  });

  test('em ordem, e os que se tocam ou se cruzam, com as mesmas categorias, juntam', () => {
    assert.deepEqual(normalizarFechamentos([{ de: 900, ate: 1000 }, { de: 600, ate: 700 }, { de: 700, ate: 760 }, { de: 950, ate: 1050 }]),
      [{ de: 600, ate: 760 }, { de: 900, ate: 1050 }]);
  });

  test('com categorias diferentes, não juntam (cada um fecha só as suas)', () => {
    assert.deepEqual(normalizarFechamentos([{ de: 600, ate: 700, categorias: ['C152'] }, { de: 650, ate: 760 }]),
      [{ de: 600, ate: 700, categorias: ['C152'] }, { de: 650, ate: 760 }]);
  });

  test('as categorias: sem repetir, na ordem de CATEGORIAS, só as que existem', () => {
    assert.deepEqual(normalizarFechamentos([{ de: 600, ate: 700, categorias: ['ground', 'C152', 'C152', 'nada'] }]),
      [{ de: 600, ate: 700, categorias: ['C152', 'ground'] }]);
  });

  test('todas as categorias marcadas são o mesmo que nenhuma: todos os recursos', () => {
    assert.deepEqual(normalizarFechamentos([{ de: 600, ate: 700, categorias: [...TODAS].reverse() }]), [{ de: 600, ate: 700 }]);
    assert.deepEqual(normalizarFechamentos([{ de: 600, ate: 700, categorias: [] }]), [{ de: 600, ate: 700 }]);
  });

  test('categorias só inválidas: o fechamento sai (nunca vira "todos os recursos")', () => {
    assert.deepEqual(normalizarFechamentos([{ de: 600, ate: 700, categorias: ['PT-ABC'] }]), []);
    assert.deepEqual(normalizarFechamentos([{ de: 600, ate: 700, categorias: 'C152' }]), []);
  });

  test('nada além de de, ate e categorias fica guardado', () => {
    assert.deepEqual(normalizarFechamentos([{ de: 600, ate: 700, recursos: ['PT-ABC'], x: 1 }]), [{ de: 600, ate: 700 }]);
  });

  test(`no máximo ${MAXIMO_DE_FECHAMENTOS}, os primeiros na ordem`, () => {
    const muitos = Array.from({ length: 20 }, (_, i) => ({ de: 400 + 40 * i, ate: 420 + 40 * i }));
    const n = normalizarFechamentos(muitos);
    assert.equal(n.length, MAXIMO_DE_FECHAMENTOS);
    assert.deepEqual(n[0], { de: 400, ate: 420 });
  });

  test('duas vezes dá o mesmo, e a entrada não muda', () => {
    const entrada = [{ de: 700, ate: 760, categorias: ['sim', 'C152'] }, { de: 600, ate: 700 }];
    const copia = structuredClone(entrada);
    const uma = normalizarFechamentos(entrada);
    assert.deepEqual(normalizarFechamentos(uma), uma);
    assert.deepEqual(entrada, copia);
  });
});

describe('fechamentosDoWin: as nove janelas de antes', () => {
  test('o dia todo aberto: nenhum fechamento; o que não é lista também', () => {
    assert.deepEqual(fechamentosDoWin(T.map(() => true)), []);
    assert.deepEqual(fechamentosDoWin(undefined), []);
  });

  test('a janela 0 também fechava o que sai antes das 06:30; a 8 vai até a meia-noite', () => {
    const win = T.map(() => true);
    win[0] = false;
    win[8] = false;
    assert.deepEqual(fechamentosDoWin(win), [{ de: 0, ate: T[1] }, { de: T[8], ate: 1440 }]);
  });

  test('janelas fechadas seguidas viram um intervalo só', () => {
    const win = T.map((_, i) => !(i >= 4 && i <= 7));
    assert.deepEqual(fechamentosDoWin(win), [{ de: T[4], ate: T[8] }]);
  });

  test('512 padrões × 1440 minutos: os mesmos minutos fechados que win[periodoDoMinuto(m)]', () => {
    let diferencas = 0;
    for (let p = 0; p < 512; p++) {
      const win = T.map((_, i) => Boolean(p & (1 << i)));
      const fech = fechamentosDoWin(win);
      for (let m = 0; m < 1440; m++) if (Boolean(win[periodoDoMinuto(m)]) !== horarioAberto(fech, m, 'C152')) diferencas++;
    }
    assert.equal(diferencas, 0);
  });

  test('fora do padrão, como o motor lê (!win[i]): curto, null ou 0 fecham', () => {
    assert.deepEqual(fechamentosDoWin([true, true, true, true, true, true, true, true]), [{ de: T[8], ate: 1440 }]);
    assert.deepEqual(fechamentosDoWin([true, true, true, true, null, true, true, true, true]), [{ de: T[4], ate: T[5] }]);
    assert.deepEqual(fechamentosDoWin([true, true, 0, true, true, true, true, true, true]), [{ de: T[2], ate: T[3] }]);
  });

  test('o que sai já está normalizado', () => {
    for (let p = 0; p < 512; p++) {
      const fech = fechamentosDoWin(T.map((_, i) => Boolean(p & (1 << i))));
      assert.deepEqual(normalizarFechamentos(fech), fech);
    }
  });
});

describe('horarioAberto', () => {
  const fech = [{ de: 760, ate: 1050 }, { de: 390, ate: 500, categorias: ['C152', 'ground'] }];
  test('[de, ate): o início fecha, o fim já está aberto', () => {
    assert.equal(horarioAberto(fech, 759, 'C172'), true);
    assert.equal(horarioAberto(fech, 760, 'C172'), false);
    assert.equal(horarioAberto(fech, 1049, 'C172'), false);
    assert.equal(horarioAberto(fech, 1050, 'C172'), true);
  });
  test('o fechamento de categorias só fecha as suas', () => {
    assert.equal(horarioAberto(fech, 400, 'C152'), false);
    assert.equal(horarioAberto(fech, 400, 'ground'), false);
    assert.equal(horarioAberto(fech, 400, 'C172'), true);
    assert.equal(horarioAberto(fech, 400, 'sim'), true);
  });
  test('sem categoria conhecida, só o de todos os recursos fecha', () => {
    assert.equal(horarioAberto(fech, 400, null), true);
    assert.equal(horarioAberto(fech, 800, null), false);
  });
  test('sem fechamentos, tudo aberto', () => {
    assert.equal(horarioAberto([], 0, 'C152'), true);
    assert.equal(horarioAberto(undefined, 800, 'C152'), true);
  });
});

// A linha do formulário "+ Fechar horários" (js/views/fechamentos.js): o que o intervalo fecha, por categoria, como o motor
// fecha. Os horários da lista e os fixos das missões: o Noturno às 17:30 (C172) e o Voo Solo às 06:30 (revisão do J)
describe('horariosQueOIntervaloFecha', () => {
  const resumo = r => r.map(({ categoria, minutos }) => `${categoria.id} ${minutos.map(m => m).join(',')}`);
  test('17:30–24:00 fecha o Noturno do C172, que nenhuma lista tem (o motor o tira da escala)', () => {
    assert.deepEqual(resumo(horariosQueOIntervaloFecha([], undefined, { de: 1050, ate: 1440, categorias: [] })), ['C172 1050']);
    assert.deepEqual(resumo(horariosQueOIntervaloFecha([], undefined, { de: 1050, ate: 1440, categorias: ['C152'] })), []);
  });
  test('12:40–17:30: os quatro horários de cada lista; a Sala Ground, os dela; o Noturno não (17:30 já está aberto)', () => {
    assert.deepEqual(resumo(horariosQueOIntervaloFecha([], undefined, { de: 760, ate: 1050, categorias: ['C152', 'C172', 'ground'] })),
      ['C152 760,820,870,980', 'C172 760,820,870,980', 'ground 760,820,870,980']);
  });
  test('o Voo Solo das 06:30 conta mesmo fora da lista da categoria', () => {
    const horarios = { C152: [500, 610], C172: [500], sim: [500], 'PA-34': [500], ground: [500] };
    assert.deepEqual(resumo(horariosQueOIntervaloFecha([], horarios, { de: 360, ate: 400, categorias: [] })), ['C152 390', 'C172 390', 'PA-34 390']);
  });
  test('o que já está fechado não conta de novo', () => {
    assert.deepEqual(resumo(horariosQueOIntervaloFecha([{ de: 1050, ate: 1440, categorias: ['C172'] }], undefined, { de: 1000, ate: 1440, categorias: ['C172'] })), []);
  });
  test('o motor fecha os mesmos: o Noturno não sai num intervalo que a linha diz fechar', async () => {
    const { runAllocationEngine } = await import('../../js/engine.js');
    const { cenario, aluno, instrutor } = await import('../helpers/montar.js');
    const estado = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, { mis: 'Noturno', eq: 'C172', p1: 1050, p2: -1 })] });
    assert.equal(runAllocationEngine(estado).out.length, 1);
    const fecha = horariosQueOIntervaloFecha([], undefined, { de: 1050, ate: 1440, categorias: [] });
    assert.equal(fecha.length, 1);
    assert.equal(runAllocationEngine({ ...estado, fechamentos: [{ de: 1050, ate: 1440 }] }).out.length, 0);
  });
});

describe(`cabeOFechamento: no máximo ${MAXIMO_DE_FECHAMENTOS} por data (revisão do J)`, () => {
  const doze = Array.from({ length: MAXIMO_DE_FECHAMENTOS }, (_, i) => ({ de: 420 + 60 * i, ate: 430 + 60 * i }));
  test('o 13º separado não cabe (normalizarFechamentos tiraria o último da lista)', () => {
    assert.equal(cabeOFechamento(doze, { de: 360, ate: 370 }), false);
    assert.equal(cabeOFechamento(doze.slice(1), { de: 360, ate: 370 }), true);
  });
  test('o que junta com um deles cabe', () => {
    assert.equal(cabeOFechamento(doze, { de: 425, ate: 440 }), true);
    assert.equal(cabeOFechamento(doze, { de: 430, ate: 480 }), true);
  });
  test('com outras categorias, não junta: não cabe', () => {
    assert.equal(cabeOFechamento(doze, { de: 425, ate: 440, categorias: ['C152'] }), false);
  });
});

describe('rotuloDosFechamentos', () => {
  test('o intervalo e para quem, como em "Horários fechados nesta data"', () => {
    assert.deepEqual(rotuloDosFechamentos([{ de: 760, ate: 1050 }, { de: 390, ate: 500, categorias: ['C152', 'ground'] }, { de: 1050, ate: 1440 }]),
      ['12:40–17:30 · todos os recursos', '06:30–08:20 · C152, Sala Ground', '17:30–24:00 · todos os recursos']);
  });
  test('o simulador pelo nome', () => {
    assert.deepEqual(rotuloDosFechamentos([{ de: 0, ate: 1440, categorias: ['sim'] }]), ['00:00–24:00 · Simulador']);
  });
});

// Os leitores (J, commit "fechamentos"): o motor, a compactação, as Sugestões, o agendamento e o editor de horários leem
// estado.fechamentos; sem ele (os dias antes do formato 28 e os estados dos goldens), fechamentosDoWin(estado.win)
describe('fechamentosDoEstado e o motor', () => {
  test('o dia com fechamentos usa os dele; sem eles, os do win', async () => {
    const { fechamentosDoEstado } = await import('../../js/fechamentos.js');
    const win = T.map(() => true);
    win[4] = false;
    assert.deepEqual(fechamentosDoEstado({ win }), [{ de: T[4], ate: T[5] }]);
    assert.deepEqual(fechamentosDoEstado({ win, fechamentos: [{ de: 600, ate: 700 }] }), [{ de: 600, ate: 700 }]);
    assert.deepEqual(fechamentosDoEstado({ win, fechamentos: [] }), [], 'a lista vazia: nada fechado, o win não vale mais');
  });

  test('os 40 cenários e o exemplo com o win trocado pelos fechamentos dele dão os goldens', async () => {
    const { runAllocationEngine } = await import('../../js/engine.js');
    const { gerarCenario } = await import('../helpers/cenarios.js');
    const { lerGoldens } = await import('../helpers/goldens.js');
    const semWin = estado => {
      const { win, ...resto } = estado;
      return { ...resto, win: T.map(() => true), fechamentos: fechamentosDoWin(win) };
    };
    const goldens = lerGoldens();
    assert.deepEqual(JSON.parse(JSON.stringify(runAllocationEngine(semWin(goldens.exemplo.estado)))), goldens.exemplo.saida);
    for (const { seed, saida } of goldens.cenarios) assert.deepEqual(JSON.parse(JSON.stringify(runAllocationEngine(semWin(gerarCenario(seed))))), saida, `cenário ${seed}`);
  });

  test('um fechamento só do C152 deixa o C172 e o Ground; o de todos fecha os três', async () => {
    const { runAllocationEngine } = await import('../../js/engine.js');
    const { aluno, cenario, instrutor, GROUND_C152 } = await import('../helpers/montar.js');
    const estado = fechamentos => ({
      ...cenario({ ins: [instrutor(1, 9), instrutor(2, 9), instrutor(3, 9)], stu: [
        aluno(1000, { mis: 'Voo Local', eq: 'C152', p1: 500, p2: -1 }), aluno(1001, { mis: 'Voo Local', eq: 'C172', p1: 500, p2: -1 }),
        aluno(1002, { ...GROUND_C152, p1: 500, p2: -1 })] }),
      fechamentos
    });
    const inicio = (res, id) => (res.out.find(o => o.stuId === id) || {}).a;
    const soC152 = runAllocationEngine(estado([{ de: 500, ate: 610, categorias: ['C152'] }]), { compactar: false });
    assert.notEqual(inicio(soC152, 1000), 500, 'o C152 não sai às 08:20');
    assert.equal(inicio(soC152, 1001), 500, 'o C172 sai às 08:20');
    assert.equal(inicio(soC152, 1002), 500, 'o Ground às 08:20');
    const todos = runAllocationEngine(estado([{ de: 500, ate: 610 }]), { compactar: false });
    for (const id of [1000, 1001, 1002]) assert.notEqual(inicio(todos, id), 500, `aluno ${id}`);
  });

  test('o Noturno fechado por 17:30–24:00; o pino num horário fechado fica em conflito horario-fechado', async () => {
    const { runAllocationEngine } = await import('../../js/engine.js');
    const { aluno, cenario, instrutor } = await import('../helpers/montar.js');
    const noturno = { mis: 'Noturno', eq: 'C172', p1: 1050, p2: -1 };
    const base = cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, noturno)] });
    assert.equal(runAllocationEngine({ ...base, fechamentos: [] }).out.length, 1);
    const fechado = runAllocationEngine({ ...base, fechamentos: [{ de: 1050, ate: 1440 }] });
    assert.equal(fechado.out.length, 0);
    const voo = runAllocationEngine(base).out[0];
    const pino = { [voo.fKey]: { a: voo.a, b: voo.b, r: voo.r, insId: voo.insId, agendado: true } };
    const comPino = runAllocationEngine({ ...base, fixos: pino, fechamentos: [{ de: 1000, ate: 1100, categorias: ['C172'] }] });
    assert.ok((comPino.out[0].conflitoCodigos || []).includes('horario-fechado'));
    const deOutra = runAllocationEngine({ ...base, fixos: pino, fechamentos: [{ de: 1000, ate: 1100, categorias: ['C152'] }] });
    assert.ok(!(deOutra.out[0].conflitoCodigos || []).includes('horario-fechado'), 'o fechamento de outra categoria não o pega');
  });
});
