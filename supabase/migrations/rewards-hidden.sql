-- Récompense masquée : utilisable comme lot de jeu, mais absente de la
-- liste que le client peut échanger contre ses tampons.
alter table rewards add column if not exists hidden boolean not null default false;
