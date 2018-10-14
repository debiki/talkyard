
-- Email info by email id

select e.id email_id, e.sent_to, e.sent_on, e.failure_type err,
p.email_notfs p_eml_ntfs, p.version p_version, p.ctime p_ctime,
n.ctime n_ctime, n.mtime n_mtime,
n.email_sent, n.email_status, n.debug n_dbg,
'-'||s.sno idty_id, s.name idty_name, s.email idty_email
-- select *
from dw1_emails_out e
left join dw1_ids_simple_email p
on e.sent_to = p.email
left join dw1_notfs_page_actions n
on e.id = n.email_sent
left join dw1_ids_simple s
on s.sno = n.rcpt_id_simple
where
  e.id = '100rl38s'
  -- rcpt_id_simple = '50'


-- The most recent notifications

select n.ctime n_ctime, n.mtime n_mtime,
n.email_sent, n.email_status, n.debug n_dbg,
'-'||s.sno idty_id, s.name idty_name, s.email idty_email,
e.id email_id, e.sent_to, e.sent_on, e.failure_type err,
p.email_notfs p_eml_ntfs, p.ctime p_ctime
-- select *
from dw1_notfs_page_actions n
left join dw1_ids_simple s
on s.sno = n.rcpt_id_simple
left join dw1_emails_out e
on n.email_sent = e.id
left join dw1_ids_simple_email p
on e.sent_to = p.email and p.version = 'C'
order by n.ctime desc
limit 30


/* Generic PostgreSQL queries
 * ===========================
 *
 * From http://wiki.postgresql.org/wiki/Disk_Usage
 */

-- Disk usage: largest tables.

SELECT nspname || '.' || relname AS "relation",
    pg_size_pretty(pg_total_relation_size(C.oid)) AS "total_size"
  FROM pg_class C
  LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
  WHERE nspname NOT IN ('pg_catalog', 'information_schema')
    AND C.relkind <> 'i'
    AND nspname !~ '^pg_toast'
  ORDER BY pg_total_relation_size(C.oid) DESC
  LIMIT 20;


