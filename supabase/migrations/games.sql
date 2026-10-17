-- Module Jeux (démo). Deux tables, aucune modification de l'existant.

create table if not exists game_configs (
  id                text primary key,
  merchant_id       text not null references merchants(id) on delete cascade,
  game_key          text not null,              -- wheel | scratch | chests
  enabled           boolean not null default false,
  cost              integer not null default 2,
  cost_type         text    not null default 'stamps',
  daily_limit       integer not null default 3,
  lose_probability  integer not null default 40,
  -- [{ rewardId, probability, stock, wonCount }] — stock null = illimité
  prizes            jsonb   not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (merchant_id, game_key)
);

-- Une ligne par partie. Une partie gagnante EST le lot : tant que used_at
-- est nul, le lot est dans le stock du client et reste utilisable sans
-- rien lui coûter de plus — il a déjà payé en jouant.
create table if not exists game_plays (
  id                text primary key,
  merchant_id       text not null references merchants(id) on delete cascade,
  game_key          text not null,
  customer_id       text not null,
  customer_card_id  text not null,
  played_at         timestamptz not null default now(),
  cost              integer not null default 0,
  cost_type         text    not null default 'stamps',
  result_type       text    not null,           -- win | lose
  reward_id         text,
  reward_name       text,
  reward_emoji      text,
  -- UUID présenté en caisse. Même format que les récompenses classiques,
  -- donc reconnu tel quel par le scanner unifié.
  prize_code        text unique,
  used_at           timestamptz
);

create index if not exists game_plays_merchant_idx on game_plays (merchant_id, played_at desc);
create index if not exists game_plays_customer_idx on game_plays (customer_id, used_at);
