-- Esquema inicial (PostgreSQL / Supabase).
-- O jogo acessa o banco só pelo servidor (conexão direta). RLS fica ligado e sem políticas em todas as tabelas,
-- para que a API pública do Supabase (chave anon) não leia nem escreva nada.

create table if not exists accounts (
  id bigserial primary key,
  username text not null,
  username_lower text not null unique,
  email text,
  email_lower text unique,
  pass_hash text not null,
  role text not null default 'player',          -- player | mod | admin
  muted_until timestamptz,
  banned boolean not null default false,
  crystals integer not null default 0 check (crystals >= 0),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  account_id bigint not null references accounts(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists sessions_account on sessions(account_id);

create table if not exists password_resets (
  token_hash text primary key,
  account_id bigint not null references accounts(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);

create table if not exists guilds (
  id bigserial primary key,
  name text not null,
  name_lower text not null unique,
  tag text not null,
  leader_id bigint not null references accounts(id),
  level integer not null default 1,
  funds bigint not null default 0,
  notice text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists characters (
  account_id bigint primary key references accounts(id) on delete cascade,
  name text not null,
  name_lower text not null unique,
  cls text not null,
  level integer not null,
  exp bigint not null,
  rank integer not null,
  rating integer not null default 1000,
  guild_id bigint references guilds(id) on delete set null,
  guild_role text,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists characters_ranking on characters(level desc, exp desc);
create index if not exists characters_rating on characters(rating desc);
create index if not exists characters_guild on characters(guild_id);

create table if not exists market_listings (
  id bigserial primary key,
  seller_id bigint not null references accounts(id) on delete cascade,
  seller_name text not null,
  item jsonb not null,
  slot text not null,
  level integer not null,
  rarity text not null,
  price bigint not null check (price > 0),
  created_at timestamptz not null default now()
);
create index if not exists market_slot on market_listings(slot, price);
create index if not exists market_seller on market_listings(seller_id);

-- Ouro, cristais ou itens a entregar a um jogador (venda no mercado com o vendedor offline, compra de cristais).
create table if not exists pending_credits (
  id bigserial primary key,
  account_id bigint not null references accounts(id) on delete cascade,
  gold bigint not null default 0,
  item jsonb,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists pending_account on pending_credits(account_id);

create table if not exists orders (
  id text primary key,
  account_id bigint not null references accounts(id),
  package_id text not null,
  crystals integer not null,
  amount_cents integer not null,
  provider text not null,
  provider_ref text,
  status text not null default 'pending',       -- pending | paid | cancelled
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists orders_account on orders(account_id);
create unique index if not exists orders_provider_ref on orders(provider, provider_ref) where provider_ref is not null;

create table if not exists crystal_ledger (
  id bigserial primary key,
  account_id bigint not null references accounts(id),
  delta integer not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_account on crystal_ledger(account_id);

create table if not exists chat_log (
  id bigserial primary key,
  account_id bigint not null,
  name text not null,
  channel text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_log_time on chat_log(created_at);

create table if not exists chat_reports (
  id bigserial primary key,
  reporter_id bigint not null,
  target_name text not null,
  reason text not null,
  context jsonb not null,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;
alter table sessions enable row level security;
alter table password_resets enable row level security;
alter table guilds enable row level security;
alter table characters enable row level security;
alter table market_listings enable row level security;
alter table pending_credits enable row level security;
alter table orders enable row level security;
alter table crystal_ledger enable row level security;
alter table chat_log enable row level security;
alter table chat_reports enable row level security;
