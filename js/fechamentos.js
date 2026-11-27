// Os horários fechados de uma data (J, formato 28; no lugar das nove "Janelas de operação"): cada um é
// { de, ate, categorias? }, em minutos, [de, ate), 0 ≤ de < ate ≤ 1440. categorias são as ids de CATEGORIAS
// (js/categorias.js); ausente, o fechamento vale para todos os recursos. Nunca por matrícula (S3).
// Um horário de decolagem está aberto quando nenhum fechamento da data o cobre para a categoria do recurso.
// Os dias antes do 28 (e os estados dos goldens) guardam win, as nove janelas: fechamentosDoWin dá os mesmos minutos
// fechados que win[periodoDoMinuto(m)] lia, com a leitura do motor (!win[i]: o que não é true fecha). O passo do formato
// 28 (js/migracoes.js) lê antes o win gravado como a data aberta o lia (só false fecha; sem as nove posições, nada).
import { CATEGORIAS } from './categorias.js';
import { hm } from './format.js';
import { MINUTOS_DO_DIA } from './config.js';
import { INICIOS_DOS_TEMPOS } from './horarios.js';

export const MAXIMO_DE_FECHAMENTOS = 12;
const IDS = CATEGORIAS.map(c => c.id);

const minutoValido = m => Number.isInteger(m) && m >= 0 && m <= MINUTOS_DO_DIA;

// As categorias de um fechamento: sem repetir, na ordem de CATEGORIAS. undefined: todos os recursos (nenhuma, ou
// todas, marcadas); null: nenhuma válida, e o fechamento sai (não vira "todos os recursos", que fecharia mais)
function categoriasDe(lista) {
  if (lista === undefined) return undefined;
  if (!Array.isArray(lista)) return null;
  if (!lista.length) return undefined;
  const validas = IDS.filter(id => lista.includes(id));
  if (!validas.length) return null;
  return validas.length === IDS.length ? undefined : validas;
}

const mesmasCategorias = (a, b) => (a || []).join('|') === (b || []).join('|');

export function normalizarFechamentos(fechamentos) {
  if (!Array.isArray(fechamentos)) return [];
  const itens = [];
  for (const f of fechamentos) {
    if (!f || typeof f !== 'object' || !minutoValido(f.de) || !minutoValido(f.ate) || f.de >= f.ate) continue;
    const categorias = categoriasDe(f.categorias);
    if (categorias === null) continue;
    itens.push(categorias ? { de: f.de, ate: f.ate, categorias } : { de: f.de, ate: f.ate });
  }
  itens.sort((a, b) => a.de - b.de || a.ate - b.ate);
  // Junta os que se tocam ou se cruzam com as mesmas categorias (com outras, cada um fecha só as suas)
  const juntos = [];
  for (const f of itens) {
    const igual = juntos.find(g => mesmasCategorias(g.categorias, f.categorias) && f.de <= g.ate && g.de <= f.ate);
    if (igual) {
      igual.de = Math.min(igual.de, f.de);
      igual.ate = Math.max(igual.ate, f.ate);
    } else juntos.push({ ...f, ...(f.categorias ? { categorias: [...f.categorias] } : {}) });
  }
  juntos.sort((a, b) => a.de - b.de || a.ate - b.ate);
  return juntos.slice(0, MAXIMO_DE_FECHAMENTOS);
}

// As nove janelas de antes em fechamentos: cada sequência i..j de janelas fechadas vira um intervalo; a janela 0 também
// fechava o que sai antes das 06:30 (periodoDoMinuto põe na 0 todo minuto antes dela) e a 8 vai até a meia-noite
export function fechamentosDoWin(win) {
  if (!Array.isArray(win)) return [];
  const n = INICIOS_DOS_TEMPOS.length;
  const fechada = i => !win[i];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!fechada(i)) continue;
    let j = i;
    while (j + 1 < n && fechada(j + 1)) j++;
    out.push({ de: i === 0 ? 0 : INICIOS_DOS_TEMPOS[i], ate: j < n - 1 ? INICIOS_DOS_TEMPOS[j + 1] : MINUTOS_DO_DIA });
    i = j;
  }
  return out;
}

// O minuto está aberto para a categoria (id de CATEGORIAS; null: um tipo sem categoria, que só o fechamento de todos
// os recursos fecha)
export function horarioAberto(fechamentos, minuto, categoria) {
  return !(fechamentos || []).some(f => minuto >= f.de && minuto < f.ate && (!f.categorias || f.categorias.includes(categoria)));
}

const nomeDaCategoria = id => (CATEGORIAS.find(c => c.id === id) || { nome: id }).nome;
const intervalo = f => `${hm(f.de)}–${hm(f.ate)}`;

// "12:40–17:30 · todos os recursos", "06:30–08:20 · C152, Sala Ground": a lista de "Horários fechados nesta data"
export function rotuloDosFechamentos(fechamentos) {
  return (fechamentos || []).map(f => `${intervalo(f)} · ${f.categorias ? f.categorias.map(nomeDaCategoria).join(', ') : 'todos os recursos'}`);
}

// Os fechamentos de um estado (o dia, a escala): os dele; sem eles (os dias antes do formato 28 e os estados dos goldens),
// os das nove janelas de antes. Uma lista vazia quer dizer nada fechado (o win deixa de valer)
export const fechamentosDoEstado = estado => (Array.isArray(estado && estado.fechamentos) ? estado.fechamentos : fechamentosDoWin(estado && estado.win));

// O fechamento que fecha o minuto para a categoria, ou null: o intervalo que as Sugestões dizem ("12:40–17:30")
export const fechamentoDoMinuto = (fechamentos, minuto, categoria) => (fechamentos || [])
  .find(f => minuto >= f.de && minuto < f.ate && (!f.categorias || f.categorias.includes(categoria))) || null;
