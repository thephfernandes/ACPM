// As recusas do motor, cada uma ligada ao pedido dela. Os alertas de recusa ('err') não trazem o aluno, só o rótulo (o
// nome, e a missão nas extras), e dois alunos de mesmo nome, ou duas extras da mesma missão, têm o mesmo rótulo: o
// pedido de cada recusa vem da ordem. O motor percorre os pedidos que voam numa ordem só (js/engine.js) e recusa cada um
// no máximo uma vez; os que entram ficam com uma linha, e os fixos são conferidos à parte (ficam em conflito, não são
// recusados). Então a i-ésima recusa é a do i-ésimo pedido que voa sem pino e sem linha, na ordem do motor
import { isGroundMission } from './rules.js';
import { chaveDoVoo, pedidoDoAluno } from './voo.js';

// Os voos da escala na ordem em que o motor confere os fixos (js/engine.js): a volta do noturno de ontem, os fixos pelo
// status, pela escala aprovada e pelo instrutor escolhido, os agendados e os outros; em cada grupo, a ordem dos pedidos do
// motor (o Ground antes, o instrutor escolhido, a prioridade, o "Priorizar com", a agenda, o cadastro e a missão). A turma
// de Ground ocupa a sala e o instrutor pelo primeiro aluno dela que o motor confere (js/candidatos.js)
export function naOrdemDoMotor(estado, out) {
  const fixos = estado.fixos || {};
  const alunos = new Map(estado.stu.map((s, i) => [s.id, { s, i }]));
  const noCadastro = new Set(estado.ins.map(x => x.id));
  const chave = o => {
    const { s, i } = alunos.get(o.stuId) || {};
    const ref = s && !o.trecho ? pedidoDoAluno(s, o.mid || 0) : null;
    if (!ref) return [o.trecho ? 0 : 4];
    const pino = fixos[o.fKey];
    return [
      !pino ? 3 : pino.agendado ? 2 : 1, isGroundMission(ref.mis) ? 0 : 1, ref.insId && noCadastro.has(ref.insId) ? 0 : 1, -(ref.pr || 3),
      (s.voaCom || []).length ? 0 : 1, Number.isInteger(ref.solicitacao) ? ref.solicitacao : Infinity, i,
      o.mid ? (s.extra || []).findIndex(ex => ex.mid === o.mid) + 1 : 0
    ];
  };
  const comparar = (p, q) => {
    for (let k = 0; k < Math.max(p.length, q.length); k++) {
      const x = p[k] ?? 0, y = q[k] ?? 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  };
  return out.map((o, k) => ({ o, k, c: chave(o) })).sort((p, q) => comparar(p.c, q.c) || p.k - q.k).map(p => p.o);
}

// Os pedidos que voam no estado (o principal e as extras com fly), como as chaves dos voos que eles seriam
function pedidosQueVoam(estado) {
  const pedidos = [];
  for (const s of estado.stu || []) {
    if (s.fly) pedidos.push({ stuId: s.id, mid: 0, fKey: chaveDoVoo(s.id, 0) });
    for (const ex of Array.isArray(s.extra) ? s.extra : []) if (ex.fly) pedidos.push({ stuId: s.id, mid: ex.mid, fKey: chaveDoVoo(s.id, ex.mid) });
  }
  return pedidos;
}

// A recusa de cada pedido recusado: um Map da chave do voo (aluno_missão_1) para o alerta 'err' do motor. estado: o que o
// motor leu (o da escala, js/state.js estadoDaEscala); resultado: o que ele devolveu. Sem recusas (ou numa escala gravada
// que não bate mais com os pedidos, quando há mais recusas que pedidos sem linha), as que sobram ficam sem pedido
export function rejeicoesDosPedidos(estado, resultado) {
  const mapa = new Map();
  if (!estado || !resultado) return mapa;
  const recusas = (resultado.al || []).filter(a => a.t === 'err');
  if (!recusas.length) return mapa;
  const fixos = estado.fixos || {};
  const comLinha = new Set((resultado.out || []).map(o => o.fKey));
  const semLugar = pedidosQueVoam(estado).filter(p => !Object.hasOwn(fixos, p.fKey) && !comLinha.has(p.fKey));
  naOrdemDoMotor(estado, semLugar).forEach((p, i) => { if (recusas[i]) mapa.set(p.fKey, recusas[i]); });
  return mapa;
}
