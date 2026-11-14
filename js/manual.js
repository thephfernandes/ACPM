// Partes do manual geradas das regras do código (missões, janelas, pesos e rodízio): quando uma regra muda, o
// manual muda junto. O texto explicativo fica em index.html (seção Manual).
import { MIS, WIN, NI, DEFAULT_LIM, GROUND_DURATION_MIN, COMBUSTIVEL } from './config.js';
import { HABILITACOES, exigencias } from './habilitacoes.js';
import { CATEGORIAS_DO_RODIZIO } from './rodizio.js';

// Os rótulos curtos são os da grade de habilitações da aba Instrutores
const ROTULO = new Map(HABILITACOES.map(h => [h.id, h.curto]));
const ou = itens => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} ou ${itens.at(-1)}` : itens[0]);
const duracao = min => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;

// Habilitações que a missão exige, por equipamento: a da missão e, no C172 e no PA-34, também a do avião
export function quemPodeDar(mis, equipamentos) {
  const porEquipamento = equipamentos.map(eq => [eq, exigencias(mis, eq).map(grupo => ou(grupo.map(h => ROTULO.get(h))))]);
  if (equipamentos.length === 1) return porEquipamento[0][1].join(' + ');
  if (new Set(porEquipamento.map(([, grupos]) => grupos[0])).size > 1) {
    return porEquipamento.map(([eq, grupos]) => `${grupos.join(' + ')} no ${eq}`).join('; ');
  }
  const extras = porEquipamento.filter(([, grupos]) => grupos.length > 1).map(([eq, grupos]) => `+ ${grupos.slice(1).join(' + ')} no ${eq}`);
  const base = porEquipamento[0][1][0];
  return extras.length ? `${base} (${extras.join(', ')})` : base;
}

function observacao(missao, regra) {
  if (regra.isGround) return `Aula de ${duracao(GROUND_DURATION_MIN)}, em turma; antes do primeiro voo de ${regra.gatesEq || regra.gatesMis} do aluno no dia`;
  if (missao === 'Parafuso') return 'No C152, sempre num avião marcado “Só Parafuso” em Recursos (que só voa Parafuso)';
  if (missao === 'Noturno') return `Só na janela das ${WIN[NI]}`;
  return '';
}

export const missoesDoManual = () => Object.entries(MIS).map(([missao, regra]) => ({
  missao,
  equipamentos: ou(regra.eq),
  quem: quemPodeDar(missao, regra.eq),
  obs: observacao(missao, regra)
}));

export const janelasDoManual = () => WIN.map((w, i) => (i === NI ? `${w} (noturno)` : w));
export const pesosDoManual = () => Object.entries(DEFAULT_LIM).map(([tipo, kg]) => [tipo, `${kg} kg`]);
// Tanque e autonomia de cada avião (o limite de peso vale com os tanques cheios)
export const combustivelDoManual = () => Object.entries(COMBUSTIVEL).map(([tipo, { galoes, autonomiaMin }]) =>
  `${tipo}: ${galoes} gal, ${Math.floor(autonomiaMin / 60)}h${autonomiaMin % 60 ? String(autonomiaMin % 60).padStart(2, '0') : ''}`);
export const rodizioDoManual = () => CATEGORIAS_DO_RODIZIO.map(c => c.nome);
