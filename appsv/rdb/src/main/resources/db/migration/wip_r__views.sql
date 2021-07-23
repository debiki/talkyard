create or replace function pretty_email_status(status integer) returns varchar
language plpgsql as $$
begin
  return case status
    when 1 then 'undecided'
    when 2 then 'skipped'
    when 3 then 'created'
    else '' || status
  end;
end;
$$;


select *, pretty_email_status(email_status) as pr_email_status from notifications3 where site_id = -16;


