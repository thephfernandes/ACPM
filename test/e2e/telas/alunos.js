// O driver de Alunos (donos: F2, depois A) e do componente de lista e detalhe: a tela, as linhas da lista, o registro aberto
// no detalhe e os campos dele, o filtro dos cursos (o mesmo na Demanda) e as telas que os testes do celular e da
// acessibilidade percorrem (ESTADOS)
import { expect } from '@playwright/test';
import { irPara, marcarNoFiltro } from './casca.js';

export const abrirAlunos = page => irPara(page, 'alu');

// O componente, por lista ('alu'; a bancada dos testes, 'banco'): a linha de um registro, o detalhe e o registro aberto
export const linhaNaLista = (page, lista, id) => page.locator(`#${lista} > li[data-chave="i:${id}"]`);
export const detalheDa = (page, lista) => page.locator(`#det-${lista} .det`);
// Abre um registro: o clique na linha; o detalhe mostra o registro (numa vista só, ele aparece no lugar da lista)
export async function abrirNaLista(page, lista, id) {
  await linhaNaLista(page, lista, id).locator('.lista-botao').click();
  await expect(detalheDa(page, lista)).toHaveAttribute('data-id', String(id));
  await expect(page.locator(`#det-${lista}-titulo`)).toBeVisible();
}

// As linhas dos alunos, e os nomes dos que a lista mostra, na ordem
export const linhaDoAluno = (page, id) => linhaNaLista(page, 'alu', id);
export const linhasDosAlunos = page => page.locator('#alu > li.lista-linha');
export const nomesNaLista = page => page.locator('#alu > li.lista-linha .lista-titulo').allTextContents();
export const abrirAluno = (page, id) => abrirNaLista(page, 'alu', id);
// Um campo do aluno aberto no detalhe ('nm', 'kg', 'curso', 'voaCom', 'bl'), e o dele que se abre antes
export const campoDoAberto = (page, campo) => page.locator(`#det-alu .det [data-f="${campo}"]`);
export async function campoDoAluno(page, id, campo) {
  if (await page.locator(`#det-alu .det[data-id="${id}"]`).count() === 0 || !await page.locator('#det-alu-titulo').isVisible()) {
    await abrirAlunos(page);
    await abrirAluno(page, id);
  }
  return campoDoAberto(page, campo);
}
// As etiquetas de "Priorizar com" (classe par) e de "Não escalar com" do aluno aberto
export const etiquetasDoAberto = (page, campo) => page.locator(`#det-alu [data-campo="${campo}"] .tg`);
// O progresso no curso (com o progresso ligado): o fim da linha (a contagem e o resto) e a linha do detalhe
export const progressoNaLinha = (page, id) => linhaDoAluno(page, id).locator('.lista-meta, .lista-l3');
export async function textoDoProgresso(page, id) {
  const linha = linhaDoAluno(page, id);
  if (!await linha.locator('.lista-meta').count()) return null;
  return `${await linha.locator('.lista-meta').textContent()} · ${await linha.locator('.lista-l3').textContent()}`;
}

// O filtro dos cursos de Alunos ('alu') ou da Demanda ('dem'): os valores são as siglas ('PP', 'PC'…) e 'sem-curso'
export const filtrarCursos = (page, aba, valores, opcoes) => marcarNoFiltro(page, `flt-${aba}-cur`, valores, opcoes);

// A lista que os filtros deixam vazia: o item que diz por quê e a contagem já escrita (ela espera a digitação parar)
export async function nenhumNaLista(page, lista) {
  await expect(page.locator(`#${lista} > li.lista-vazia`)).toBeVisible();
  await expect(page.locator(`#${lista}-contagem`)).toHaveText(/^0 de \d+ /);
}

// As telas de Alunos que não são a de abertura (test/e2e/telas/invariantes.js, percorrerTelas): um aluno aberto, a lista
// sem nenhum com os filtros, o filtro dos cursos aberto, com duas marcas. No fim, a busca e as marcas voltam a vazias e a
// lista à vista. nome null: só o passo, sem conferir a tela
export const ESTADOS = [
  {
    nome: 'alunos: um aluno aberto no detalhe',
    preparar: async page => {
      await abrirAlunos(page);
      const primeira = page.locator('#alu > li.lista-linha .lista-botao').first();
      await primeira.click();
      await expect(page.locator('#det-alu-titulo')).toBeVisible();
    }
  },
  {
    nome: 'alunos: nenhum com os filtros',
    preparar: async page => {
      await abrirAlunos(page);
      await page.locator('[data-flt="alu"]').fill('nenhum assim');
      await nenhumNaLista(page, 'alu');
    }
  },
  {
    nome: 'alunos: o filtro dos cursos aberto, com duas marcas',
    preparar: async page => {
      await page.locator('[data-flt="alu"]').fill('');
      await abrirAlunos(page);
      await filtrarCursos(page, 'alu', ['PP', 'sem-curso'], { fechar: false });
      await expect(page.locator('#flt-alu-cur')).toHaveText('Curso: PP ou sem curso');
    }
  },
  { nome: null, preparar: page => filtrarCursos(page, 'alu', []) }
];
