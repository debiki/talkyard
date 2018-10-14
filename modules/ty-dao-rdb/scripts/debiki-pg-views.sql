-- Views
-----------------
-- (Don't use for anything but statistics right now. Don't
-- base Scala code on any views.)

-- Most recent posts
--    ('Post', 'Rtng', 'Edit', 'EdAp', 'EdRv')
-- Flagged posts
-- Edit suggestions

-- Page tree:
--  - Pages per directory
--     New pages - sort by ctime
--  - Posts per page
--  - Users per page

-- New authenticated users
-- New anonymous users

-- Posts by user
-- & links to everything
-- & filters


-- Login identities
create or replace view dw1v_logins as
select l.tenant tid, l.sno lid, l.login_time, l.logout_time,
    l.login_ip, l.prev_login, l.id_type, o.sno idid, o.first_name fname,
    o.email, o.country loc, N'-' url
  from dw1_logins l, dw1_ids_openid o
  where l.id_type = 'OpenID'
    and l.id_sno = o.sno
union
select l.tenant tid, l.sno lid, l.login_time, l.logout_time,
    l.login_ip, l.prev_login, l.id_type, s.sno idid, s.name fname,
    s.email, s.location loc, s.website url
  from dw1_logins l, dw1_ids_simple s
  where l.id_type = 'Simple'
    and l.id_sno = s.sno
order by login_time;


-- All identities
create or replace view dw1v_ids_all as
select 'OpenID' id_type, o.sno idid, o.usr usrid, o.first_name fname,
    o.email, o.country loc, N'-' url
  from dw1_ids_openid o
union
select 'Simple' id_type, sno idid, -sno usrid, name fname,
    email, location loc, website url
  from dw1_ids_simple;


-- Page actions
create or replace view dw1v_page_actions as
select
  t.name tenant,
  pt.folder, pt.page_name, pt.page_guid, pt.guid_in_path gip,
  -- pt.folder || case pt.guid_in_path
  --      when 'T' then '-'||pt.page_guid|| '-' || pt.page_name
  --      else pt.page_name ||' ('|| pt.page_guid ||')'
  --      end
  --   path,
  pg.sno page_sno,
  lg.lid, lg.fname, lg.email, lg.id_type, lg.idid,
  a.time, a.type, a.paid, a.relpa, a.text, a.wheere, a.new_ip
from dw1_page_actions a, dw1_pages pg, dw1_paths pt, dw1_tenants t,
  dw1v_logins lg
where
  a.page = pg.sno and
  pt.page_guid = pg.guid and
  t.id = pg.tenant and
  a.login = lg.lid;


-- RENAME? There's another dw1v_pages below
create or replace view dw1v_pages as
--with posts_per_page as (
--  select page page_sno, count(*) num from dw1_page_actions where type = 'Post'
--)
select
  folder, page_name, gip, page_guid, page_sno,
  count(distinct idid) n_ids,
  count(*) n_as,
  max(time) mtime,
  min(time) ctime
  -- posts_per_page.num
from dw1v_page_actions -- , posts_per_page
--where posts_per_page.page_sno = dw1v_page_actions.page_sno
group by folder, page_name, gip, page_guid, page_sno
;

-- Pages and paths
create or replace view dw1v_pages as
select 
  t.tenant, g.page_role, g.parent_page_id, t.page_id, t.parent_folder, t.page_slug, t.show_id, t.page_status, t.cdati
from dw1_page_paths t left join dw1_pages g
  on t.page_id = g.guid and t.tenant = g.tenant
;

-- vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
