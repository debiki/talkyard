

-- up to 7 so can bump from 0..6 (current) to  1..7 (better).
create or replace function is_ok_trust_level(trust_level int) returns boolean
language plpgsql as $_$
begin
    return trust_level between 0 and 7;
end;
$_$;

alter table settings3 add column appr_before_if_trust_lte smallint;
alter table settings3 add column review_after_if_trust_lte smallint;
alter table settings3 add column max_posts_pend_revw_aftr smallint;
alter table settings3 rename column num_first_posts_to_allow to max_posts_pend_appr_before;


alter table settings3 add constraint settings_c_apprbeforeiftrustlte check (
    is_ok_trust_level(appr_before_if_trust_lte));

alter table settings3 add constraint settings_c_reviewafteriftrustlte check (
    is_ok_trust_level(review_after_if_trust_lte));

alter table settings3 add constraint settings_c_maxpostspendrevwaftr check (
    max_posts_pend_revw_aftr between 0 and 10);


