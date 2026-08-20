alter table public.game_credentials
  add constraint game_credentials_order_id_fkey
  foreign key (order_id) references public.orders (id);
