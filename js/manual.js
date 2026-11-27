// Partes do manual geradas das regras do código (missões, pesos, combustível, rodízio e glossário): quando
// uma regra muda, o manual muda junto. O texto explicativo fica em index.html (seção Manual).
import { MIS, DEFAULT_LIM, GROUND_DURATION_MIN, COMBUSTIVEL } from './config.js';
import { HORARIO_DO_NOTURNO } from './horarios.js';
import { HABILITACOES, exigencias } from './habilitacoes.js';
import { CATEGORIAS_DO_RODIZIO } from './rodizio.js';
import { GLOSSARIO, ABAS_DO_GLOSSARIO } from './glossario.js';
import { hm, duracaoHm } from './format.js';

// Os rótulos curtos são os da grade de habilitações da aba Instrutores
const ROTULO = new Map(HABILITACOES.map(h => [h.id, h.curto]));
const ou = itens => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} ou ${itens.at(-1)}` : itens[0]);

// Habilitações que a missão exige, por equipamento: a da missão e, no C152, no C172 e no PA-34, também a do avião;
// nos voos de cheque, só as três marcas do checador
export function quemPodeDar(mis, equipamentos) {
  const porEquipamento = equipamentos.map(eq => [eq, exigencias(mis, eq).map(grupo => ou(grupo.map(h => ROTULO.get(h))))]);
  if (equipamentos.length === 1) return porEquipamento[0][1].join(' + ');
  if (new Set(porEquipamento.map(([, grupos]) => grupos[0])).size > 1) {
    return porEquipamento.map(([eq, grupos]) => `${grupos.join(' + ')} no ${eq}`).join('; ');
  }
  // O que vale em todos os equipamentos vem primeiro; o que cada avião acrescenta, entre parênteses
  const comuns = porEquipamento[0][1].filter(g => porEquipamento.every(([, grupos]) => grupos.includes(g)));
  const extras = porEquipamento.map(([eq, grupos]) => [eq, grupos.filter(g => !comuns.includes(g))])
    .filter(([, grupos]) => grupos.length).map(([eq, grupos]) => `+ ${grupos.join(' + ')} no ${eq}`);
  const base = comuns.join(' + ');
  return extras.length ? `${base} (${extras.join(', ')})` : base;
}

function observacao(missao, regra) {
  if (regra.isGround) return `Aula de ${duracaoHm(GROUND_DURATION_MIN)}, em turma; antes do primeiro voo de ${regra.gatesEq || regra.gatesMis} do aluno no dia`;
  if (missao === 'Parafuso') return 'No C152, sempre num avião marcado “Só Parafuso” em Recursos (que só voa Parafuso)';
  if (missao === 'Noturno') return `Só às ${hm(HORARIO_DO_NOTURNO)}`;
  return '';
}

export const missoesDoManual = () => Object.entries(MIS).map(([missao, regra]) => ({
  missao,
  equipamentos: ou(regra.eq),
  quem: quemPodeDar(missao, regra.eq),
  obs: observacao(missao, regra)
}));

export const pesosDoManual = () => Object.entries(DEFAULT_LIM).map(([tipo, kg]) => [tipo, `${kg} kg`]);
// Tanque e autonomia de cada avião (o limite de peso vale com os tanques cheios)
export const combustivelDoManual = () => Object.entries(COMBUSTIVEL).map(([tipo, { galoes, autonomiaMin }]) =>
  `${tipo}: ${galoes} gal, ${autonomiaMin % 60 ? duracaoHm(autonomiaMin) : `${autonomiaMin / 60}h`}`);
export const rodizioDoManual = () => CATEGORIAS_DO_RODIZIO.map(c => c.nome);

// O Glossário: os termos das dicas, aba por aba, na ordem das abas
export const glossarioDoManual = () => ABAS_DO_GLOSSARIO.map(aba => ({
  aba, termos: Object.values(GLOSSARIO).filter(t => t.aba === aba).map(({ termo, texto }) => ({ termo, texto }))
}));
