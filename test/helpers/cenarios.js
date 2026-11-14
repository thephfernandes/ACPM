// Gerador determinístico de cenários de demanda para testar o motor de alocação.
// O mesmo seed sempre produz o mesmo estado, o que permite comparar a saída com os goldens capturados
// do motor original (index.html no commit 9b5de75) sem versionar os estados de entrada.
import { createHash } from 'node:crypto';
import { FROTA, JANELAS, LIMITES, dois } from './estado.js';
import { habilitacoesDoNivel } from '../../js/habilitacoes.js';

const EQUIP_MISSAO = {
  'Ground C152': ['Sala Ground'],
  'Ground C172': ['Sala Ground'],
  'Ground PA-34': ['Sala Ground'],
  'Ground Navegação': ['Sala Ground'],
  'Simulador': ['Sim. Mono', 'Sim. Multi'],
  'Voo Local': ['C152', 'C172', 'PA-34'],
  'Navegação': ['C152', 'C172', 'PA-34'],
  'Voo Solo': ['C152', 'C172', 'PA-34'],
  'Parafuso': ['C152', 'C172', 'PA-34'],
  'IFR': ['C172', 'PA-34'],
  'Noturno': ['C172'],
  'Multimotor': ['PA-34']
};
const MISSOES = Object.keys(EQUIP_MISSAO);
const EQUIPAMENTOS = ['Sim. Mono', 'Sim. Multi', 'C152', 'C172', 'PA-34'];
const NOTURNO = 8;

export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gerarCenario(seed) {
  const r = mulberry32(seed);
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = a => a[Math.floor(r() * a.length)];

  // As habilitações saem do nível sorteado (sem sorteio a mais): os cenários são os mesmos de antes das habilitações
  const ins = Array.from({ length: int(6, 40) }, (_, i) => ({
    id: i + 1,
    nm: `Instrutor ${dois(i + 1)}`,
    on: r() > 0.1,
    lv: int(1, 9),
    kg: r() < 0.05 ? 0 : int(50, 110),
    aw: Array.from({ length: JANELAS }, () => r() > 0.15)
  })).map(x => ({ ...x, hab: habilitacoesDoNivel(x.lv) }));

  let nid = 1000;
  const missao = () => {
    const mis = pick(MISSOES);
    const ground = mis.startsWith('Ground');
    // ~5% dos pedidos de voo usam equipamento incompatível (dados legados), exercitando a rejeição
    const eq = ground ? 'Sala Ground' : (r() < 0.05 ? pick(EQUIPAMENTOS) : pick(EQUIP_MISSAO[mis]));
    const nb = ground ? 1.5 : int(1, 4);
    const noturno = mis === 'Noturno';
    const pref = () => (noturno ? NOTURNO : int(-1, ground ? 7 : 8));
    const fly = r() > 0.15, p1 = pref(), p2 = pref();
    // Uma sessão por pedido (revisão de 14/11); o sorteio das sessões de antes continua, para os outros campos dos
    // cenários não mudarem
    if (!ground) int(1, Math.min(3, nb));
    return { fly, mis, eq, p1, p2, nb, ss: 1, pr: int(1, 5) };
  };

  const stu = Array.from({ length: int(4, 30) }, (_, i) => ({
    id: nid++,
    nm: `Aluno ${dois(i + 1)}`,
    kg: r() < 0.08 ? 0 : int(48, 105),
    bl: ins.filter(() => r() < 0.04).map(x => x.id),
    ...missao(),
    extra: Array.from({ length: r() < 0.3 ? int(1, 2) : 0 }, () => ({ mid: nid++, ...missao() }))
  }));

  const fStatus = {};
  stu.forEach(s => {
    if (r() < 0.1) fStatus[`${s.id}_0_1`] = pick(['Confirmado', 'Em Voo', 'Pendente', 'Cancelado']);
  });

  return {
    schemaVer: 4,
    win: Array.from({ length: JANELAS }, () => r() > 0.08),
    av: Object.fromEntries(FROTA.map(reg => [reg, r() > 0.15])),
    lim: { ...LIMITES },
    nid,
    ins,
    stu,
    fStatus
  };
}

export const hashEstado = estado => createHash('sha256').update(JSON.stringify(estado)).digest('hex').slice(0, 16);
