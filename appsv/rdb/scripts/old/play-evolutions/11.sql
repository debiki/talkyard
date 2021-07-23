-- This evolution adds a settings table.


# --- !Ups


create table DW1_SETTINGS(
  TENANT_ID varchar not null,
  TARGET varchar not null,
  PAGE_ID varchar,
  NAME varchar not null,
  DATATYPE varchar not null,
  TEXT_VALUE varchar,
  LONG_VALUE bigint,
  DOUBLE_VALUE double precision,
  constraint DW1_STNGS_DATATYPE__C check (
    case DATATYPE
      when 'Text' then TEXT_VALUE is not null and LONG_VALUE is null and DOUBLE_VALUE is null
      when 'Long' then LONG_VALUE is not null and TEXT_VALUE is null and DOUBLE_VALUE is null
      when 'Double' then DOUBLE_VALUE is not null and TEXT_VALUE is null and LONG_VALUE is null
      when 'Bool' then TEXT_VALUE in ('T', 'F') and LONG_VALUE is null and DOUBLE_VALUE is null
    end),
  constraint DW1_STNGS_TRGT__C_FKS check (
    case TARGET
      when 'WholeSite'   then PAGE_ID is null
      when 'PageTree'    then PAGE_ID is not null
      when 'SinglePage'  then PAGE_ID is not null
      else false
    end),
  constraint DW1_STNGS_TNT_TRGT_PAGE_NAME__U unique (TENANT_ID, TARGET, PAGE_ID, NAME),
  constraint DW1_STNGS_NAME__C check ((length(NAME) between 1 and 50) and (trim(NAME) = NAME)),
  constraint DW1_STNGS_TEXTVALUE__C_LEN check (length(TEXT_VALUE) < 10*1000),
  constraint DW1_STNGS_PAGEID__R__PAGES foreign key (TENANT_ID, PAGE_ID) references DW1_PAGES(TENANT, GUID)
);


create unique index DW1_STNGS_TNT_TRGT_NAME__U on Dw1_SETTINGS(TENANT_ID, TARGET, NAME)
    where PAGE_ID is null;


# --- !Downs


drop table DW1_SETTINGS;

