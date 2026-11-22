-- ═══════════════════════════════════════════════════════════════════
-- Suivi d'acquisition maison : visites des landings et source des
-- inscriptions. À exécuter dans le SQL Editor Supabase (préprod puis
-- production), AVANT de mettre en ligne le code qui s'en sert.
-- Aucune modification destructive : une table, une fonction, des colonnes.
-- ═══════════════════════════════════════════════════════════════════

-- Un évènement par ligne : page vue, clic sur le bouton, scroll à 75 %.
-- Aucune donnée personnelle : `visitor` est une empreinte anonyme qui
-- change chaque jour (voir lib/acquisition.ts), jamais une adresse IP.
create table if not exists lp_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  site          text not null,          -- foodtruck | caviste | site
  event         text not null,          -- pageview | cta_click | scroll_75
  visitor       text not null,
  position      text,                   -- emplacement du bouton cliqué
  etape         text,                   -- "derniere" = arrive d'un formulaire Meta
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  referrer      text,                   -- nom de domaine seulement
  device        text                    -- mobile | desktop
);

create index if not exists lp_events_created_at_idx on lp_events (created_at);
create index if not exists lp_events_site_event_idx on lp_events (site, event, created_at);

-- Table écrite et lue uniquement par le serveur (clé service_role) :
-- RLS activée sans aucune règle, donc fermée à la clé publique.
alter table lp_events enable row level security;

-- Source d'une inscription : la landing d'origine et les UTM de la pub.
alter table merchants add column if not exists acq_site         text;
alter table merchants add column if not exists acq_utm_source   text;
alter table merchants add column if not exists acq_utm_campaign text;
alter table merchants add column if not exists acq_utm_content  text;

-- Entonnoir agrégé côté base : évite de rapatrier toutes les lignes
-- (l'API Supabase plafonne une lecture à 1 000 lignes).
create or replace function lp_funnel(since timestamptz)
returns table (site text, event text, visitors bigint, hits bigint)
language sql stable as $$
  select site, event, count(distinct visitor) as visitors, count(*) as hits
    from lp_events
   where created_at >= since
   group by site, event
$$;
