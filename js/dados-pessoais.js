// Dados pessoais de alunos e instrutores (fase 9): CPF, CANAC (o código da ANAC), nascimento, celular e e-mail. Ficam
// fora do cadastro, numa tabela que só operadores, administradores e a secretaria leem (o servidor valida tudo de
// novo), e nunca vão para o link compartilhado, o CSV, o PDF ou o BI. O histórico registra só quais campos mudaram.
export const CAMPOS_PESSOAIS = [
  { id: 'cpf', rotulo: 'CPF' },
  { id: 'canac', rotulo: 'CANAC' },
  { id: 'nascimento', rotulo: 'Nascimento' },
  { id: 'celular', rotulo: 'Celular' },
  { id: 'email', rotulo: 'E-mail' }
];

const digitos = texto => String(texto ?? '').replace(/\D/g, '');

// Os dois dígitos verificadores do CPF (11 dígitos, não todos iguais)
export function cpfValido(cpf) {
  const d = digitos(cpf);
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const verificador = n => {
    const soma = [...d.slice(0, n)].reduce((total, c, i) => total + Number(c) * (n + 1 - i), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return verificador(9) === Number(d[9]) && verificador(10) === Number(d[10]);
}

const dataValida = (iso, hoje) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const data = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === iso && iso >= '1900-01-01' && iso <= hoje;
};
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const REGRAS = {
  cpf: { normalizar: digitos, valido: cpfValido, erro: 'CPF inválido.' },
  canac: { normalizar: digitos, valido: v => /^\d{6}$/.test(v), erro: 'O CANAC tem 6 dígitos.' },
  nascimento: { normalizar: v => String(v ?? '').trim(), valido: (v, hoje) => dataValida(v, hoje), erro: 'Data de nascimento inválida.' },
  celular: { normalizar: digitos, valido: v => /^[1-9]{2}9\d{8}$/.test(v), erro: 'Celular com DDD e 9 dígitos, como (37) 99123-4567.' },
  email: { normalizar: v => String(v ?? '').trim().toLowerCase(), valido: v => v.length <= 254 && EMAIL.test(v), erro: 'E-mail inválido.' }
};

// Os dados normalizados (só os campos preenchidos) ou, por campo, a mensagem do erro. hoje: AAAA-MM-DD
export function validarDadosPessoais(entrada, hoje) {
  const dados = {}, erros = {};
  for (const { id } of CAMPOS_PESSOAIS) {
    const bruto = entrada && entrada[id];
    // Campo vazio (ou só com espaços e pontuação) fica de fora
    if (String(bruto ?? '').trim() === '') continue;
    const regra = REGRAS[id];
    const valor = regra.normalizar(bruto);
    if (regra.valido(valor, hoje)) dados[id] = valor;
    else erros[id] = regra.erro;
  }
  return { dados, erros };
}

export const formatarCpf = cpf => {
  const d = digitos(cpf);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;
};
export const formatarCelular = celular => {
  const d = digitos(celular);
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d;
};

// Os nomes dos campos que mudaram (para o histórico, que não guarda os valores)
export const camposAlterados = (antes, depois) => CAMPOS_PESSOAIS
  .filter(({ id }) => ((antes && antes[id]) || '') !== ((depois && depois[id]) || ''))
  .map(c => c.rotulo);

// O nome de um aluno ou instrutor no cadastro, ou null (não está no cadastro)
export function nomeNoCadastro(cadastro, tipo, id) {
  const lista = cadastro && cadastro[tipo === 'aluno' ? 'stu' : 'ins'];
  const p = Array.isArray(lista) ? lista.find(x => x && x.id === id) : null;
  return p ? String(p.nm || '').slice(0, 80) : null;
}

// Sem os dados pessoais de quem não está mais no cadastro (só com as duas listas no cadastro)
export function semQuemSaiu(tabela, cadastro) {
  if (!cadastro || !Array.isArray(cadastro.stu) || !Array.isArray(cadastro.ins)) return tabela;
  const ficam = new Set([...cadastro.stu.map(x => `aluno:${x.id}`), ...cadastro.ins.map(x => `instrutor:${x.id}`)]);
  return Object.fromEntries(Object.entries(tabela).filter(([chave]) => ficam.has(chave)));
}

// O que o servidor faz ao gravar (salvar_dados_pessoais), para o modo local e o servidor dos testes seguirem a mesma
// regra: só para quem está no cadastro; valida; confere que o CPF e o CANAC não se repetem entre pessoas do mesmo tipo;
// recusa quando a versão lida (atualizadoEmLido) não é a guardada (outra pessoa gravou antes); sem nenhum dado, apaga.
// tabela: { 'aluno:1000': {...} }. Devolve a tabela nova, a versão nova e a descrição para o histórico (null sem
// mudança); o erro traz o código do servidor e o campo
const erroDosDados = (code, message, campo = null) => Object.assign(new Error(message), { code, campo });
export function gravarDadosPessoais(tabela, tipo, id, entrada, { hoje, autor = null, agora = null, atualizadoEmLido = null, cadastro }) {
  if (!['aluno', 'instrutor'].includes(tipo) || !Number.isInteger(id) || id <= 0) throw erroDosDados('22023', 'aluno ou instrutor inválido');
  const nome = nomeNoCadastro(cadastro, tipo, id);
  if (nome === null) throw erroDosDados('P0002', `${tipo} que não está no cadastro`);
  const { dados, erros } = validarDadosPessoais(entrada, hoje);
  const [campo] = Object.keys(erros);
  if (campo) throw erroDosDados('22023', erros[campo], campo);
  const chave = `${tipo}:${id}`;
  for (const c of ['cpf', 'canac']) {
    const repetido = dados[c] && Object.entries(tabela).some(([outra, d]) => outra !== chave && outra.startsWith(`${tipo}:`) && d[c] === dados[c]);
    if (repetido) throw erroDosDados('23505', `${c === 'cpf' ? 'CPF' : 'CANAC'} já cadastrado para outro ${tipo}.`, c);
  }
  const atual = tabela[chave] || null;
  if ((atual ? atual.atualizado_em : null) !== (atualizadoEmLido ?? null)) {
    throw erroDosDados('PT409', 'os dados pessoais foram alterados por outra pessoa; abra de novo para ver a versão atual');
  }
  const nova = { ...tabela };
  const preenchido = Object.keys(dados).length > 0;
  if (preenchido) nova[chave] = { ...dados, atualizado_em: agora, atualizado_por: autor };
  else delete nova[chave];
  const alterados = camposAlterados(atual, dados);
  return {
    tabela: nova,
    atualizado_em: preenchido ? agora : null,
    descricao: alterados.length ? `Dados pessoais de ${nome || tipo} atualizados: ${alterados.join(', ')}` : null
  };
}
