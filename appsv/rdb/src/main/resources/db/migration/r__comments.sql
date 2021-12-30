-- Please sort tables alphabetically.
-- And columns in what seems like a "good to know first" order,
-- maybe primary key first?


--======================================================================
--  Domains
--======================================================================
--  pat_type_d  REMOVE
--  ------------------------------------------------------------------------
--  comment on domain page_id_st_d is $_$
--  
--  Currently, page ids are strings — later, those will become aliases,
--  and there'l be numeric ids instead?;
--  $_$;  -- '
--  ------------------------------------------------------------------------
--  comment on domain pat_type_d is $_$
--
--  Participant types:   — if null (the default), then, < 0 => Guest, > 0 => User?
--     and incl extra flag fields if different somehow, e.g. isBot,
--     isExtHelp, isSupRead, isSupAdm etc?
--
--  Maybe rename to specType?
--
--  ==== Anon, per page
--  %% -3 = Unknown pat
--  ==== Guests (semi anon blog commenters)
--  %% 1 = Guest or anonymous/unknown stranger.
--  ==== Not a real account, cannot add to groups etc:
--  %% 2 = Anonyn, with real_user_id identifying the real user.
--  ==== Cannot add to groups. Has all permisssions or gets in other ways:
--  1 = System user
--  2 = System bot ?
--  ==== Cannot log in, is just a pseudonym. But can add to groups etc:
--  21  = Anon
--  ====
--  <=  49 cannot have permissions?
--  51 = Group. Created by admins, top down. Can have security permissions
--      and config settings that get inherited by those in the group.
--  (? 52 = Circle, or bottom-up group. Created by ordinary members.
--      E.g. a study circle, or teacher circle. Doesn't have inheritable
--      settings? Nor permissions. Not impl.)
--  ==== Cannot config UI prefs — doesn't use any UI:
--  61 = Only bot, e.g. CI system? — cannot log in; can *only* do things via AIP.
--       A human + custom client should use type 9 User instead.
--  71  = Pen name. Not impl.
--  ====
--  %% 31 = User (a human, maybe a bot, sometimes cannot know. Maybe an extrenal Matrix
--      user who got an account auto generated).
--  ====
--  ? 101 = External management account: superbot, superadmin, superstaff (mod)
--  ? 111 = External help account — if site admins ask for help, and want to give access
--       only to some parts of their site? (e.g. dev/design help)
--  ====
--  ? 127 = temporary just one-request user, via API secret, mustn't store in db
--  
--  No!: Participant types:
--  1 = Unknown stranger or user.  — skip
--  2 = Anonymous stranger or user (no name).  — skip
--  3 = Guest.
--  4 = Pen name. Not impl.
--  7 = Built-in account, e.g. system, sysbot, superadmin.
--  8 = External management account: superbot, superadmin, superstaff?
--  9 = User (a human, maybe a bot, sometimes cannot no).
--  (10 = Bot, can only do things via AIP? But could be a human + a custom client?)
--  91 = Group. Created by admins, top down. Can have security permissions
--      and config settings that get inherited by those in the group.
--  (? 92 = Circle, or bottom-up group. Created by ordinary members.
--      E.g. a study circle, or teacher circle. Doesn't have inheritable
--      settings? Nor permissions. Not impl.)
--  $_$;
--  ------------------------------------------------------------------------
comment on domain  trust_level_or_staff_d  is $_$

Trust levels from Stranger = 0 to Core Member = 6, plus dummy trust levels
for staff, i.e. mods = 7 and admins = 8.
$_$;
------------------------------------------------------------------------
-- comment on domain  anon_level_d  is $_$
-- 
-- 10: Not anon, even if would have been by default. For example, a moderator
-- or maybe a school teacher who wants to say something more officially.
-- 
-- (20, not impl: Anon post, by an a bit traceable "virtual anon account":
-- The poster would use the same account accross different categories and pages,
-- during anon_incarnation_ttl_mins_c minutes. Then hen gets a new anon acct.
-- Except for when posting more on the same page — then hen will reuse hen's
-- last annon acct on that page.)
-- 
-- (30, not impl: Anon account, less traceable: The same in the same category only;
-- it cannot follow accross categories. After anon_incarnation_ttl_mins_c,
-- the poster will get a new virtual annon acct. Except for when posting more on
-- the same page; see above.  — Maybe skip forever? Things get complicated,
-- if moving a page to a different category, and continuing posting there.)
-- 
-- (40, not impl: Anon account, less traceable: The same in the same category,
-- excl sub categories.)
-- 
-- 50: Anon account: Same on the same page only.
-- 
-- (60: Anon account, even less less traceable: Same on the same page only,
-- and only during anon_incarnation_ttl_mins_c.)
-- 
-- (70: Anon account, unique per post / same-for-all-users-and-posts.)
-- $_$;  -- '
------------------------------------------------------------------------



--======================================================================
--  cont_prefs_t
--======================================================================

------------------------------------------------------------------------
comment on table  cont_prefs_t  is $_$

Settings and preferences that make sense for all of categories, tags
and specific pages. Usually they're default, for everyone in the forum;
then, memb_id_c is 10 (Everyone) and prefs_id_c is > 0.

But some preferences can be overridden by user groups or individual users
themselves — then, prefs_id_c is < 0 and memb_id_c is the user/group id.
Let's say you want to always post anonymously in a specific
category. Then, you can (not impl though) set ops_start_anon_c and cmts_start_anon_c
to true, for yourself only, in that category. And thereafter you cannot
forget to be anonyomus, there. Whilst others are unaffected.
Or maybe you're the teacher, and don't care about being anonymous in one
specific category — whilst the default (for all students) is to be anonymous. 

Maybe later, there'll be a table cont_mixed_prefs_t for specifying
content preferences for many categories, optionally combined with tags,
in one single row. But currently there's one cont_prefs_t per category,
maybe "soon" per tag too.

Wikis: cont_prefs_t lets you implement wikis by making a forum
category a wiki category: set ops_start_wiki_c to true, and set
base_folder_c to e.g. '/wiki/' and show_page_ids_c to false.
Alternatively, you can create a *tag* named 'wiki', and configure the
same settings for that tag (instaed of a category).
Then wiki pages can be placed in the categories where it makes the most sense
whilst still being part of a wiki — just tag them with the wiki tag.
So, a wiki via a category, or a tag. What makes sense, is community
specific I suppose.

Docs: In a documentation / articles category, you might want to set
show_op_author_c = false and allow_cmts_c = false,
and maybe base_folder_c = '/docs/'.
Or you can use a 'docs' tag, and have docs in different categories,
whilst still appearing below the '/docs/' URL path'
$_$;  -- '
------------------------------------------------------------------------
-- comment on column  cont_prefs_t.anon_by_def_c  is $_$
-- 
-- If posts in this category, are anonymous, by default.
-- $_$;
-- ------------------------------------------------------------------------
-- comment on column  cont_prefs_t.def_anon_level_c  is $_$
-- 
-- Default anonymity level, in this category.
-- $_$; -- '
------------------------------------------------------------------------



--======================================================================
--  identities3
--======================================================================

------------------------------------------------------------------------
comment on column  identities3.idp_user_id_c  is $_$

For OIDC, this is the 'sub', Subject Identifier.
$_$;
------------------------------------------------------------------------



--======================================================================
--  idps_t
--======================================================================

------------------------------------------------------------------------
comment on table  idps_t  is $_$

OIDC and OAuth2 providers, e.g. a company's private Keycloak server.
$_$;  -- '


------------------------------------------------------------------------
comment on column  idps_t.protocol_c  is $_$

Lowercase, because is lowercase in the url path. Is incl in the primary
key, so one can change from say  /-/authn/oauth2/the-alias to
/-/authn/oidc/the-alias  without having to change the alias (or disable
the old authn for a short while).
$_$;


------------------------------------------------------------------------
comment on column  idps_t.alias_c  is $_$

Alnum lowercase, because appears in urls.
$_$;


------------------------------------------------------------------------
comment on column  idps_t.gui_order_c  is $_$

When logging in, identity providers with lower numbers are shown first.
(If one has configured more than one provider.)
$_$;


------------------------------------------------------------------------
comment on column  idps_t.sync_mode_c  is $_$

What to do, when logging in, if there's already a user in the Ty database
with the same email address, or the same external identity id.
E.g. just login, don't sync. Or overwrite fields in the Ty database
with values from the IDP, maybe even update the email address.'
$_$;


------------------------------------------------------------------------
comment on column  idps_t.oau_access_token_auth_method_c  is $_$

How the Talkyard server authenticates with the ID provider, when
sending the auth code to get the OAuth2 access token.
Null and 'client_secret_basic' means
HTTP Basic Auth, whilst 'client_secret_post' means 'client_id' and
'client_secret' in the form-data encoded POST body (not recommended).

OIDC also mentions 'client_secret_jwt', 'private_key_jwt' and 'none',
see https://openid.net/specs/openid-connect-core-1_0.html#ClientAuthentication,
— Talkyard doesn't support these.

Also see: https://openid.net/specs/openid-connect-core-1_0.html#TokenRequest
> ... Client, then it MUST authenticate to the Token Endpoint using
> the authentication method registered for its client_id ...
$_$;


------------------------------------------------------------------------
comment on column  idps_t.oidc_user_info_fields_map_c  is $_$

How to convert custom OAuth2 user json fields to standard OIDC user info fields
— so Talkyard can work together with custom OAuth2 implementations,
as long as the authn flow is similar to OIDC, except for in the last
user info step: the OAuth2 user info endpoint can return its own
non-standard json.
$_$;



------------------------------------------------------------------------


--======================================================================
--  links_t
--======================================================================

------------------------------------------------------------------------
comment on table  links_t  is $_$

There's no foreign key to link_previews_t, because maybe no preview has
been fetched yet (or maybe never — maybe broken external link).
$_$;  -- '



--======================================================================
--  link_previews_t
--======================================================================

------------------------------------------------------------------------
comment on table  link_previews_t  is $_$

Caches html <title> and <meta description> tags and any OpenGraph tags,
and/or oEmbed json, for generating html previews of links to external
things, e.g. Twitter tweets.

Sometimes Ty fetches both 1) html and OpenGraph tags directly from
the linked page, and 2) oEmbed json.
Then, there'll be two rows in this table — one with fetched_from_url_c
= link_url_c, and one with fetched_from_url_c = the oEmbed request url.
The oEmbed data might not include a title, and then,
if the external link is inside a paragraph, so we want to show the
title of the extenal thing only, then it's good to have any html <title>
tag too.

[defense] [lnpv_t_pk] Both link_url_c and fetched_from_url_c are part of
the primary key — otherwise maybe an attacker could do something weird,
like the following:

    An attacker's website atkws could hijack a widget from a normal
    website victws, by posting an external link to Talkyard
    that looks like: https://atkws/widget, and then the html at
    https://atkws/widget pretends in a html tag that its oEmbed endpoint is
    VEP = https://victws/oembed?url=https://victws/widget
    and then later when someone tries to link to https://victws/widget,
    whose oEmbed endpoint is VEP for real,
    then, if looking up by fetched_from_url_c = VEP only,
    there'd already be a link_previews_t row for VEP,
    with link_url_c: https//atkws/widget — atkws not victws (!).
    (Because VEP initially got saved via the request to https://atkws/widget.)
    That is, link_url_c would point to the attacker's site.
    Then, maybe other code in Talkyard adds a "View at: $link_url_c"
    which would send a visitor to the attacker's website.

But by including both link_url_c and fetched_from_url_c in the primary key,
that cannot happen — when looking up https://victws/widget + VEP,
the attacker's entry wouldn't be found (because it's link_url_c is
https://atkws/..., the wrong website).

There's an index  linkpreviews_i_g_fetch_err_at  to maybe retry failed fetches
after a while.
$_$;


------------------------------------------------------------------------
comment on column  link_previews_t.link_url_c  is $_$

An extenal link that we want to show a preview for. E.g. a link to a Wikipedia page
or Twitter tweet or YouTube video, or an external image or blog post, whatever.
$_$;


------------------------------------------------------------------------
comment on column  link_previews_t.fetched_from_url_c  is $_$

oEmbed json was fetched from this url. Later: can be empty '' if
not oEmbed, but instead html <title> or OpenGraph tags — then
fetched_from_url_c would be the same as link_url_c, need not save twice.
$_$;


------------------------------------------------------------------------
comment on column  link_previews_t.content_json_c  is $_$

Why up to 27 000 long? Well, this can be lots of data — an Instagram
oEmbed was 9 215 bytes, and included an inline <svg> image, and
'background-color: #F4F4F4' repeated at 8 places, and the Instagram post text
repeated twice. Better allow at least 2x more than that.
There's an appserver max length check too [oEmb_json_len].
$_$;  -- '


------------------------------------------------------------------------
comment on column  link_previews_t.status_code_c  is $_$

Is 0 if the request failed completely [ln_pv_netw_err], didn't get any response.
E.g. TCP RST or timeout. 0 means the same in a browser typically, e.g. request.abort().

However, currently (maybe always?) failed fetches are instead cached temporarily
only, in Redis, so cannot DoS attack the disk storage.  [ln_pv_fetch_errs]
$_$; -- '


------------------------------------------------------------------------
comment on column  link_previews_t.content_json_c  is $_$

Null if the request failed, got no response json. E.g. an error status code,
or a request timeout or TCP RST?   [ln_pv_fetch_errs]
$_$;



-- --======================================================================
-- --  posts3
-- --======================================================================
-- 
-- ------------------------------------------------------------------------
-- comment on column  posts3.anon_level_c  is $_$
-- 
-- If this post was done anonymously, by a member (not a guest), and how
-- much it is anonymized.
-- $_$;
-- ------------------------------------------------------------------------
-- comment on column  posts3.anonym_nr_c  is $_$
-- 
-- Others can see that one's anonymous posts with the same virtual anon
-- account incarnation, were made by the same anonymous person (but of course
-- not who hen is).
-- $_$; -- '
-- ------------------------------------------------------------------------


--======================================================================
--
--======================================================================



