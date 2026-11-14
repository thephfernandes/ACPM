// Cria uma conta (e-mail e senha) com perfil de acesso, direto no banco de um projeto Supabase.
// O cadastro aberto fica desligado: contas novas são criadas pelo administrador com este script.
//
// Uso: SUPABASE_DB_PASSWORD=... SENHA_NOVA=... node scripts/criar-conta.mjs <email> <operador|gestor|secretaria|administrador|painel> "<nome>"
//   Conexão: SUPABASE_DB_URL (sem a senha) ou o pooler do projeto vinculado (supabase/.temp/pooler-url).
//   A senha nova chega por variável de ambiente (lida pelo próprio psql): não aparece na linha de comando.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [email, perfil, nome = ''] = process.argv.slice(2);
if (!email || !['operador', 'gestor', 'secretaria', 'administrador', 'painel'].includes(perfil)) {
  console.error('Uso: node scripts/criar-conta.mjs <email> <operador|gestor|secretaria|administrador|painel> "<nome>"');
  process.exit(2);
}
if (!process.env.SUPABASE_DB_PASSWORD || !process.env.SENHA_NOVA) {
  console.error('Defina SUPABASE_DB_PASSWORD (senha do banco) e SENHA_NOVA (senha da conta).');
  process.exit(2);
}
if (process.env.SENHA_NOVA.length < 12) {
  console.error('Use uma senha com pelo menos 12 caracteres.');
  process.exit(2);
}

const url = process.env.SUPABASE_DB_URL || readFileSync(new URL('../supabase/.temp/pooler-url', import.meta.url), 'utf8').trim();

// Os campos de token sem valor padrão precisam ser '' (o Supabase Auth não aceita NULL neles)
const sql = String.raw`
\set ON_ERROR_STOP on
\set senha ${'`'}printf %s "$SENHA_NOVA"${'`'}
begin;
with novo as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', lower(:'email'),
    extensions.crypt(:'senha', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  returning id, email
), identidade as (
  insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
  from novo
  returning user_id
)
insert into public.perfis (usuario, perfil, nome)
select user_id, :'perfil', :'nome' from identidade;
commit;
`;

execFileSync('psql', [url, '-X', '-q', '-v', `email=${email}`, '-v', `perfil=${perfil}`, '-v', `nome=${nome}`, '-f', '-'], {
  input: sql,
  env: { ...process.env, PGPASSWORD: process.env.SUPABASE_DB_PASSWORD, PGSSLMODE: 'require' },
  stdio: ['pipe', 'inherit', 'inherit']
});
console.log(`Conta criada: ${email} (${perfil})`);
