
alter table pages3 add column num_posts_total int not null default 0;

update pages3 pg set num_posts_total = (
  select count(*) from posts3 po where pg.site_id = po.site_id and pg.page_id = po.page_id);

alter table pages3 add constraint pages_c_numpoststotal_ge_numrepliestotal check (
  num_posts_total >= num_replies_total);
