// Substitutos mínimos de APIs do navegador para testar módulos no Node.

export class MemoriaLocal {
  #dados = new Map();
  getItem(k) { return this.#dados.has(k) ? this.#dados.get(k) : null; }
  setItem(k, v) { this.#dados.set(k, String(v)); }
  removeItem(k) { this.#dados.delete(k); }
  clear() { this.#dados.clear(); }
  get length() { return this.#dados.size; }
  key(i) { return [...this.#dados.keys()][i] ?? null; }
}

export function simularNavegador(href = 'https://gdruumond.github.io/ACPM/') {
  const url = new URL(href);
  globalThis.localStorage = new MemoriaLocal();
  globalThis.window = { location: { href: url.href, search: url.search } };
}

