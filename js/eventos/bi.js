// O BI: a data base, os filtros e, só no modo local, os dias simulados
import { carregarBI } from '../actions.js';
import { opcoesDeCategoria } from '../categorias.js';
import { T, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, GROUND_DURATION_H, MIS } from '../config.js';
import { $, showToast } from '../dom.js';
import { pad, somarDias } from '../format.js';
import { matriculasDoTipo } from '../frota.js';
import { habilitacoesDoNivel, podeFazer } from '../habilitacoes.js';
import { ESQUEMA } from '../migracoes.js';
import { isGroundMission } from '../rules.js';
import { S, DATA, isGestor, modoCompartilhado } from '../state.js';
import { ApiClient } from '../storage.js';
import { comConfirmacao } from './confirmacao.js';
import { rBI } from '../views/bi.js';
import { registrarDesenho } from '../redesenho.js';
import { registrarTela } from '../views/telas.js';
import { inativo } from '../inativos.js';

// O desenho do BI (js/redesenho.js): a escala refeita entra no BI da data
registrarDesenho('bi', rBI, { em: ['escala'], ordem: 90 });
// A data base do BI volta para a data aberta a cada troca de data
registrarDesenho('bi-data', () => { $('#bi-dt').value = DATA; }, { em: ['data-aberta'], ordem: 2 });
// Aberto (também de novo, pelo link dele), o BI é desenhado e lido outra vez
registrarTela('bi', { aoMostrar: () => { rBI(); carregarBI(); } });

$('#bi-dt').onchange = () => carregarBI();
$('#bi-flt-eq').onchange = () => rBI();
$('#bi-flt-cat').onchange = () => rBI();
// Categoria; o filtro de recurso mostra só os da categoria escolhida
$('#bi-flt-cat').innerHTML = opcoesDeCategoria();
document.addEventListener('input', e => {
  if (e.target.id === 'bi-flt-ins') rBI();
});

// Só no modo local: grava 30 dias simulados (marcados como simulados) nas datas que ainda não têm escala
comConfirmacao('#btn-bi-sim', 'Confirmar simulação', async () => {
  if (isGestor() || modoCompartilhado()) return;
  const refStr = ($('#bi-dt') && $('#bi-dt').value) || DATA;
  const existentes = new Set((await ApiClient.backend.listarDias(somarDias(refStr, -30), refStr)).map(d => d.data));
  const baseDate = new Date(refStr + 'T12:00:00');
  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  // Só missões que algum instrutor ativo pode fazer (sem checadores cadastrados, não há voo de cheque simulado)
  // Só os ativos do cadastro (os inativos não voam)
  const instrutores = S.ins.filter(x => !inativo(x));
  const alunos = S.stu.filter(s => !inativo(s));
  const frota = (S.frota || []).filter(f => !inativo(f));
  const allMis = Object.keys(MIS).filter(m => instrutores.some(x => x.on && MIS[m].eq.some(eq => podeFazer(x, m, eq))));
  const stuPool = alunos.length ? alunos : Array.from({ length: 15 }, (_, i) => ({ nm: pad(i) }));

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const d = new Date(baseDate.getTime() - dayOffset * 864e5);
    const iso = d.toISOString().slice(0, 10);
    if (existentes.has(iso)) continue;

    const flights = [];
    const numFlights = 10 + Math.floor(rnd() * 14);
    for (let f = 0; f < numFlights; f++) {
      const mis = pick([...allMis, 'Voo Local', 'Voo Local', 'Navegação', 'IFR']);
      const isGnd = isGroundMission(mis);
      const eqType = isGnd ? GROUND_EQ_TYPE : pick(MIS[mis].eq);
      // Um recurso da frota do tipo (o Parafuso no C152, num avião "Só Parafuso"); tipo sem recurso: sem esse voo.
      // Com um recurso só (a sala de Ground, o avião do Parafuso), não há sorteio
      const doTipo = isGnd ? [GROUND_REG] : matriculasDoTipo(frota, eqType, { parafuso: mis === 'Parafuso' });
      if (!doTipo.length) continue;
      const reg = doTipo.length === 1 ? doTipo[0] : pick(doTipo);
      // Grounds simulados com os instrutores menos habilitados (até o nível 2)
      const qualIns = isGnd
        ? instrutores.filter(x => podeFazer(x, mis, eqType) && x.hab.length <= habilitacoesDoNivel(2).length)
        : instrutores.filter(x => podeFazer(x, mis, eqType));
      const ins = pick(qualIns.length ? qualIns : instrutores);
      const stu = pick(stuPool);
      const h = isGnd ? GROUND_DURATION_H : 1 + Math.floor(rnd() * 3);
      const durMin = isGnd ? GROUND_DURATION_MIN : h * 60;
      const w = mis === 'Noturno' ? 8 : Math.floor(rnd() * 7);
      flights.push({
        isGround: isGnd,
        classKey: isGnd ? `SIM_${iso}_${mis}_${w}_${ins.id}` : `SIM_${iso}_${f}`,
        w, a: T[w], b: T[w] + durMin,
        s: stu.nm, mis, h, ss: '1/1',
        r: reg, eqType, ins: ins.nm, status: 'Confirmado'
      });
    }
    await ApiClient.backend.gravar(`dia:${iso}`, { simulado: true, resultado: { out: flights, al: [], tot: numFlights, rej: 0, data: iso }, esquema: ESQUEMA });
  }
  await carregarBI();
  showToast('Histórico de 30 dias simulado.', 'ok');
});

// Só no modo local: remove os dias simulados (as escalas reais continuam)
comConfirmacao('#btn-bi-clr', 'Confirmar limpeza', async () => {
  if (isGestor() || !ApiClient.backend.removerDiasSimulados) return;
  await ApiClient.backend.removerDiasSimulados();
  await carregarBI();
  showToast('Dias simulados removidos do BI.', 'ok');
});
