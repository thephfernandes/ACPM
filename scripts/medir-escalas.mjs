// Compara as escalas de referência gravadas (antes) com o motor atual (depois), nas 41 escalas (o exemplo e as 40
// geradas), e imprime uma tabela em Markdown para o commit ou o PR. Rode antes de regravar as referências
// (node scripts/capturar-goldens-motor.mjs): depois disso, antes e depois ficam iguais.
// Uso: node scripts/medir-escalas.mjs [buracos] [horários]: com os critérios da compactação (fase 13), por exemplo
// "aviao fixos"; sem eles, os do padrão
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { runAllocationEngine } from '../js/engine.js';
import { metricasDaEscala } from '../js/metricas.js';
import { minutoDaPreferencia } from '../js/horarios.js';
import { gerarCenario } from '../test/helpers/cenarios.js';

const goldens = JSON.parse(await readFile(new URL('../test/fixtures/motor-goldens.json', import.meta.url), 'utf8'));
const [buracos, horarios] = process.argv.slice(2);
const criterios = buracos ? { criterios: { buracos, ...(horarios ? { horarios } : {}) } } : {};
const estados = [goldens.exemplo.estado, ...goldens.cenarios.map(c => gerarCenario(c.seed))].map(e => ({ ...e, ...criterios }));
const antes = [goldens.exemplo.saida, ...goldens.cenarios.map(c => c.saida)];

// O tempo do motor: a terceira rodada (as duas primeiras aquecem o JavaScript)
let tempos = [], depois = [];
for (let rodada = 0; rodada < 3; rodada++) {
  tempos = [];
  depois = estados.map(estado => {
    const inicio = performance.now();
    const saida = runAllocationEngine(estado);
    tempos.push(performance.now() - inicio);
    return saida;
  });
}

// Como na tela: o voo cancelado não voa e fica fora das métricas (revisão de 14/11)
const voam = out => out.filter(o => o.status !== 'Cancelado');
// O minuto da 1ª preferência do pedido de cada voo (-1 sem ela), para a distância até ela (revisão de 14/11)
const preferenciaNo = estado => o => {
  const aluno = estado.stu.find(x => x.id === o.stuId);
  const pedido = aluno && (o.mid ? (aluno.extra || []).find(ex => ex.mid === o.mid) : aluno);
  return pedido ? minutoDaPreferencia(pedido.p1) : -1;
};
const metricas = (s, i) => metricasDaEscala(voam(s.out), { ativos: estados[i].ins.filter(x => x.on).map(x => x.id), preferenciaDe: preferenciaNo(estados[i]) });
const total = (saidas, campo) => saidas.reduce((n, s, i) => n + campo(metricas(s, i), s), 0);
// A distância média até a 1ª preferência, em todos os voos das escalas (minutos)
function distanciaMedia(saidas) {
  const distancias = saidas.flatMap((s, i) => voam(s.out).map(o => [o, preferenciaNo(estados[i])(o)]).filter(([, p]) => p >= 0).map(([o, p]) => Math.abs(o.a - p)));
  return distancias.length ? Math.round(distancias.reduce((n, d) => n + d, 0) / distancias.length) : 0;
}
const LINHAS = [
  ['Missões escaladas', (m, s) => s.out.length],
  ['Missões que não entraram', (m, s) => s.al.filter(a => a.t === 'err').length],
  ['Aviões usados', m => m.avioesUsados],
  ['Aviões: o mínimo possível (pico)', m => m.avioesMinimo],
  ['Saídas do hangar (parada de 2 h ou mais)', m => m.saidasDoHangar],
  ['Tempo parado dos aviões (h)', m => m.avioesParadoMin / 60],
  ['Tempo parado dos instrutores (h)', m => m.instrutoresParadoMin / 60],
  ['Instrutores com 2 h ou mais parados', m => m.instrutoresComDuasHorasParado],
  ['Diferença de horas entre instrutores (soma)', m => m.diferencaDeHoras],
  ['Soma dos quadrados das horas', m => m.somaDosQuadrados],
  ['Na 1ª preferência', m => m.preferencias.p1],
  ['Na 2ª preferência', m => m.preferencias.p2],
  ['Em outro horário', m => m.preferencias.outro],
  ['Trocas de avião do mesmo tipo', m => m.trocasDeAviao]
];
const numero = v => (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('.', ',');
const diferenca = (a, d) => (Math.abs(d - a) < 1e-9 ? '=' : `${d > a ? '+' : '−'}${numero(Math.abs(d - a))}`);

console.log(`Nas ${estados.length} escalas de referência${buracos ? ` (compactação: ${buracos}${horarios ? `, ${horarios}` : ''})` : ''}:\n`);
console.log('| Métrica | Antes | Depois | Diferença |');
console.log('|---|---:|---:|---:|');
for (const [rotulo, campo] of LINHAS) {
  const a = total(antes, campo), d = total(depois, campo);
  console.log(`| ${rotulo} | ${numero(a)} | ${numero(d)} | ${diferenca(a, d)} |`);
}
{
  const a = distanciaMedia(antes), d = distanciaMedia(depois);
  console.log(`| Distância média até a 1ª preferência (min) | ${numero(a)} | ${numero(d)} | ${diferenca(a, d)} |`);
}
const ordenados = [...tempos].sort((x, y) => x - y);
const ms = v => `${v.toFixed(1).replace('.', ',')} ms`;
console.log(`\nTempo do motor (depois): mediana ${ms(ordenados[Math.floor(ordenados.length / 2)])}, p90 ${ms(ordenados[Math.floor(ordenados.length * 0.9)])}, máximo ${ms(ordenados.at(-1))}.`);
