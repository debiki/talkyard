-- Please sort tables alphabetically.
-- And columns in what seems like a "good to know first" order,
-- maybe primary key first?


--@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
--  Domains
--@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

------------------------------------------------------------------------
comment on domain  dormant_status_d  is $_$
If not null, shows why a relationship (from a post or pat to something)
should be ignored. Then, indexes can exclude these relationships, e.g.
not looking up Assigned-To for a post that's been closed or
deleted. But if the post is reopened, the relationships are activated
again (which wouldn't be possible if they'd been deleted instead of
marked as dormant).
  Let this be a bitfield? An AssignedTo relationship could get bits
DormantBits.PostDone and PostClosed set, if the post got done.
Or if postponed, could get DormantBits.Postponed set?
$_$;  -- '

------------------------------------------------------------------------
comment on domain  pat_rel_type_d  is $_$
Says what a relationship from a pat to a post (or sth else) means. Ex:
PatRelType.AssignedTo or VotedOn, from a pat to a post.
Is a thing_type_d.
$_$;

------------------------------------------------------------------------
comment on domain  post_nr_d  is $_$
On each page, the Orig Post is nr 1, the first reply is nr 2, and so on.
Title posts currently have nr = 0. Comments in private sub threads will have nrs < 0?
$_$;

------------------------------------------------------------------------
comment on domain  post_rel_type_d  is $_$
Says what a relationship from a post to somehting means, e.g.
PostRelType.AnswerTo (other post) / FlagOf (posts or pats) / DuplicateOf (other post).
Is a thing_type_d.
$_$;

------------------------------------------------------------------------
comment on domain  rev_nr_d  is $_$
Post revision number (if it's been edited).
 $_$;  --'

------------------------------------------------------------------------
comment on domain smtp_msg_ids_out_d is $_$
Talkyard generated SMTP Message-IDs, e.g. ["aa@b.c", "dd-11+22@ff.gg"].
 $_$;

------------------------------------------------------------------------
comment on domain  sub_type_d  is $_$
Clarifies what this thing is, in more detail. E.g. for a PostType.Flag thing,
the sub type clarifies why the post was flagged — e.g. FlagType.Spam.
Or if the type of a relationship is PatRelType.AssignedTo, then, the sub type
can mean assigned-to-do-what. See Scala PatRelType.
$_$;

------------------------------------------------------------------------
comment on domain  thing_type_d  is $_$
What is something — e.g. a flag, or a comment, or a Like vote, or a group.
In the types_t table, this is the thing_type_c.
PostType.* and PatRelType.* and PostRelType.* are all thing types
so e.g. PostType and PatRelType ids must not overlap (if they did, in types_t,
they'd try to use the same table row).
$_$; -- '

------------------------------------------------------------------------
comment on domain trust_level_or_staff_d is $_$

Trust levels from Stranger = 0 to Core Member = 6, plus dummy trust levels
for staff, i.e. mods = 7 and admins = 8.
$_$;



--@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
--  Tables
--@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@


--======================================================================
--  pats_t
--======================================================================

------------------------------------------------------------------------
comment on column  users3.why_may_not_mention_msg_me_html_c is $_$
A help text explaining why this user or group cannot be @mentioned or DM:d,
and who to contact instead.
$_$;


--======================================================================
--  pat_rels_t
--======================================================================

------------------------------------------------------------------------
comment on table  post_actions3 is $_$
To be renamed to  pat_rels_t.  Later, will store AssignedTo,
votes, and who knows what more. Currently stores
votes and flags, but later, flags will be kept in posts_t instead,
linked to the flagged things via the upcoming table post_rels_t.
$_$;


--======================================================================
--  perms_on_pages_t
--======================================================================

------------------------------------------------------------------------
comment on table  perms_on_pages3 is $_$
Permissions on categories and pages.

But not one private comments, except for  may_see_private_flagged,
which says if someone can see a private comment *if it got flagged*
— because then someone needs to have a look.

A future  [can_post_private_c]  setting would apply to both private
comments and private messages, and would be for a pat and *the whole site*.
Maybe it'd be in  pats_t  not  prems_on_pats_t.
Reasoning: Private comments don't disturb anyone, so, if one may post
private *messages* (on new pages), one might as well be allowed to post
private comments sub threads too, since otherwise one could just
start a new private message page and link to the comments page.

RENAME to perms_on_pages_t.
$_$;  -- '


--======================================================================
--  posts_t
--======================================================================

------------------------------------------------------------------------
comment on table  posts3  is $_$
To be renamed to  posts_t.  Stores the actuall discussions:
the Original Post, a title post, reply/comment posts, meta posts,
chat messages, any private comments.

Later, other things too: Flags. Flags are nicely represented as posts of
type PostType.Flag on pages of type PageType.Flag, visible to oneself and mods
— since a text is often needed, to describe the reason one flagged something?
And it's nice if this text can be edited afterwards, with edit revisions,
hence, storing it, and thereby flags, in posts_t makes sense?
The staff can ask the flagging user for clarifications, and staff can post
private comments if they want to discuss the flag privately (without the flagger).
For flags, posts_t.sub_type_c is the flag types, e.g.
FlagType.Inappropriate/Spam/Astroturfing/... See Scala, PostType.Flag_later.

And bookmarks. Later.
$_$;  -- '

------------------------------------------------------------------------
comment on column  posts3.authors_id_c  is $_$
The person who posted a post, is shown as author by default.  [post_authors]
But this can be changed, by specifying a member or a list of members
if there's more than one author.
$_$; -- '

------------------------------------------------------------------------
comment on column  posts3.owners_id_c  is $_$
The person who posted a post, is the owner of the post — *unless*  [post_owners]
owners_id_c is set to someone else. Can be set to a member or a list of
members. The owners of a post, may edit it, change the authors, make it
private (but not make a private post public), add/remove owners, etc.

Changing the owner, can be good if 1) someone starts working on an article,
and leaves for vacation, and another person is to finish the article,
publish it etc.  Or if 2) mods have deleted a post, and want to prevent
the original author from un-deleting it or editing it any further. Then,
the mods can make the Moderators group the owner of the post —
thereafter the original author cannot edit it, un/delete it or anything.
$_$;

------------------------------------------------------------------------
comment on column  posts3.private_pats_id_c  is $_$
If non-null, the post is private. Then, all descendants (the whole sub thread
or page if the Orig Post is private) should be too, otherwise it's a bug.
private_pats_id_c points to a pat or a list of pats (pats_t.is_pat_list_c = true).
Comments in private sub threads have nr:s < 0, so there's a quick way for Ty
to skip them when loading comments to show by default on a page, *and*
so there won't be any gaps in the not-private comment nr sequence (> 0).
Comments on private *pages* though, have positive nrs — because anyone who can
see the private page, can see those comments, so we want to load all of them.
It's not allowed to start new private sub threads inside private threads
or on private pages, because then the permission system would become
unnecessarily complicated. ('New' here means that a different set of
pats could see those private sub threads.)
$_$;  -- '

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

The start page id is left out — only the start post id is included,
because otherwise, if moving a post to another page, all links would
have to be updated, easy to forget somewhere. And, performance
wise, on large pages, we wouldn't want to load all posts anyway, 
only the ones to shown in the browser. (E.g. in a chat we might load
the most recent 100 posts). And to do this, we'd specify
ids of *posts* for which links should get loaded — no need to store any
page id in links_t.

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
$_$;


------------------------------------------------------------------------
comment on column  link_previews_t.status_code_c  is $_$

Is 0 if the request failed completely [ln_pv_netw_err], didn't get any response.
E.g. TCP RST or timeout. 0 means the same in a browser typically, e.g. request.abort().

However, currently (maybe always?) failed fetches are instead cached temporarily
only, in Redis, so cannot DoS attack the disk storage.  [ln_pv_fetch_errs]
$_$;


------------------------------------------------------------------------
comment on column  link_previews_t.content_json_c  is $_$

Null if the request failed, got no response json. E.g. an error status code,
or a request timeout or TCP RST?   [ln_pv_fetch_errs]
$_$;


--======================================================================
--  types_t   (currently named tagtypes_t)
--======================================================================

------------------------------------------------------------------------
comment on table  tagtypes_t  is $_$
(Will rename to types_t.)
Types, for 1) content tags. Content tags: E.g. issue tracking tags,
or blog article content tags. And 2) for user badges.

Also 3) for plugins who want their own types and sub types. Example:
Ty has Vote relationship and Vote sub types Like, Disagree, Do-It etc.
And in types_t, plugins can store their own Vote sub types, which would
correspond to custom "reactions" in other software. — Or a plugin
can create a new base type, and use for who knows what.

Why support sub types (or "enumerations", if you want), not just types?
Sub types are used often in Ty: Votes, and what type of vote.
Or flags, and what type of flag. Or assigned-to, and assigned-to-
-do-what.  *Sub sub*  types have never been needed though.
So, types and sub types, will be good enough for future plugins, too?

(Note that there's (will be) custom values too: each post, participant,
tag, relationship, etc can have its own custom integer or jsonb value.)
$_$;  -- '

------------------------------------------------------------------------


--======================================================================
--
--======================================================================



