-- Please sort tables alphabetically.
-- And columns in what seems like a "good to know first" order,
-- maybe primary key first?


--@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
--  Domains
--@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

------------------------------------------------------------------------
comment on domain  can_see_who_d  is $_$
Says if a pat can see other pats related to something, e.g. see who
is assigned to a task, or see which others also can see a private
page.  See: can_see_assigned_c and  can_see_who_can_see_c.
$_$;

------------------------------------------------------------------------
comment on domain  creator_status_d  is $_$
Says if the poster is still author and owner. And if others have been
added as authors or owners, or assigned to this post — then, they'd
be looked up in pat_node_*_rels_t.
$_$;  -- '

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
comment on domain  ref_id_d  is $_$
Reference id. Can be provided by API clients, when they create posts, users, tag types,
categories, whatever, via the API. Talkyard remembers the ref id, and in subsequent
API requests, the clients can reference the reference id, use it as a stable identifier
— it stays the same, also if the-referenced-thing gets renamed or gets a new URL path.

Previously called "external id", but "reference id" is a more precise name? And
used by lots of other software.
$_$;

------------------------------------------------------------------------
comment on domain  pat_rel_type_d  is $_$
Says what a relationship from a pat to a post (or sth else) means. Ex:
PatRelType.AssignedTo or VotedOn, from a pat to a post.
Is a thing_type_d.
$_$;

--  ------------------------------------------------------------------------
--  comment on domain page_id_st_d is $_$
--  
--  Currently, page ids are strings — later, those will become aliases,
--  and there'll be numeric ids instead?
--  $_$;  -- '

--  ------------------------------------------------------------------------
--  pat_type_d  REMOVE
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
comment on domain  private_status_d  is $_$
If not null, the page or post and all descendants, are private.
The value will show if more private pats can bee added, but for now, always 1.
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
comment on domain  trust_level_or_staff_d  is $_$

Trust levels from Stranger = 0 to Core Member = 6, plus dummy trust levels
for staff, i.e. mods = 7 and admins = 8.
$_$;

------------------------------------------------------------------------



--@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
--  Tables
--@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@


--======================================================================
--  drafts3
--======================================================================

------------------------------------------------------------------------
comment on table  drafts3  is $_$
Should remove, and store drafts in posts_t/nodes_t instead. [drafts3_2_nodes_t]
With negative nrs, to indicate that they're private (others can't see
one's drafts). Then, once published, the nr changes to the next public nr
on the relevant page (i.e. 1, 2, 3, ...).
But what about the `title` column — there's no title column in posts_t.
Maybe wait until pages are stored in nodes_t, and then create both a
title & a body post that together become the new page draft.
$_$; -- '

------------------------------------------------------------------------
comment on column  drafts3.order_c  is $_$
For sorting drafts in one's todo list (with tasks, bookmarks, drafts).
Once drafts3 has been merged into posts_t, maybe merge posts_t.pinned_position
into order_c? Then use it both for sorting personal posts
(drafts, bookmarks) and for public post pin order (if any — rarely used).
$_$; -- '


--======================================================================
--  pats_t
--======================================================================

------------------------------------------------------------------------
comment on column  users3.why_may_not_mention_msg_me_html_c is $_$
A help text explaining why this user or group cannot be @mentioned or DM:d,
and who to contact instead.
$_$;

------------------------------------------------------------------------
comment on column  users3.mod_conf_c  is $_$
Moderation settings for this group (or user), e.g. max posts per week
before they get a "You're creating a lot of posts" soft warning.
$_$;

------------------------------------------------------------------------
comment on column  users3.may_set_rel_follow_c  is $_$
If this group (or user) can set rel=follow for all links (even if not in
settings_t.follow_links_to_c).
$_$;


--======================================================================
--  pat_rels_t
--======================================================================

------------------------------------------------------------------------
comment on table  post_actions3 is $_$
To be renamed to  pat_post_rels_t or pat_node_rels_t. Currently stores votes,
AssignedTo, and flags.  Later, flags will be kept in posts_t instead,
linked to the flagged things via the upcoming table post_rels_t.
Maybe assigned-to could be a post too? So can add a note about what the assignee 
is assigned to do — maybe assigned-to-review for example. [tasks_2_nodes_t]
$_$;

------------------------------------------------------------------------
comment on column  post_actions3.added_by_id_c  is $_$
If one pat assigns another to a task.
$_$;

------------------------------------------------------------------------
comment on column  post_actions3.from_true_id_c  is $_$
The true user behind an anonymous vote. Makes it possible to load all
one's votes, for the current page, also if one voted anonymously.
$_$;

------------------------------------------------------------------------
comment on index  patnoderels_i_pageid_fromtrueid  is $_$
For finding one's Like votes etc done anonymously on the current page.
$_$;

------------------------------------------------------------------------
comment on column  post_actions3.order_c  is $_$
For the assignee, so han can reorder the task as han wants, in hans
personal todo list (with tasks, bookmarks, drafts).
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

------------------------------------------------------------------------
comment on column  perms_on_pages3.can_see_others_priv_c  is $_$
If one may see a category, or a private message (a page),
or a private comments thread on a not-private page.
$_$;

------------------------------------------------------------------------
comment on column  perms_on_pages3.can_see_who_can_see_c  is $_$
If pat can see which other pats can see a page or comment tree.
null means inherit, and:
   1 = Cannot see if anyone else can see it.
   2 = See if anyone else can see it, but not who.
   3 = See the primary group(s) of those who can see it, e.g. Support Staff.
   4 = See precisely which individuals can see it, e.g. know which
       others are part of a private discussion — which
      can be important to know, depending on what one has in mind to say,
      and is the default.
$_$;

------------------------------------------------------------------------
comment on column  perms_on_pages3.can_see_assigned_c  is $_$
null means inherit, and:
   1 = Can not see if a task is assigned to anyone.
   2 = See if assigned or not (but not to whom).
   3 = See which group(s) assigned to, e.g. Support Staff, but not
       to which person(s) in the group.
   4 = See precisely which individuals are assigned.
$_$;


--======================================================================
--  posts_t
--======================================================================

------------------------------------------------------------------------
comment on table  posts3  is $_$
To be renamed to  posts_t.  No, to nodes_t.  Stores the actuall discussions:
the Original Post, a title post, reply/comment posts, meta posts,
chat messages, any private comments.
Later, categories and pages will be here too. [all_in_nodes_t]

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
comment on column  posts3.created_by_id  is $_$
If created by an anonym or pseudonym, is the id of that anonym or pseudonym.
And to find the true author, one looks up that anon/pseudonym in pats_t,
and looks at the true_id_c column.
$_$; -- '

------------------------------------------------------------------------
comment on column  posts3.order_c  is $_$
For sorting bookmarks in one's todo list (together with tasks, bookmarks, drafts).
Maybe merge posts_t.pinned_position into order_c, don't need both?
Can't have public posts directly in one's todo list — instead, they'd be
there via bookmarks or assigned-to relationships. So, don't need both order_c
and pinned_position?
> 0 means place first, ascending?
< 0 means place last (asc or desc? from end?), for less important bookmarks?
null (or 0) means in the middle (after the > 0 but before the < 0), newest first?
$_$;

------------------------------------------------------------------------
comment on column  posts3.pinned_position  is $_$
Rename to  order_c. Use for sorting one's private posts: bookmarks and drafts.
$_$; -- '

------------------------------------------------------------------------
comment on column  posts3.private_status_c  is $_$
NO, skip this. Instead, use private pages  [priv_comts_pages] 
for storing private comments? And all comments on such a page, are private,
private_status_c is overkill.

If non-null, the post is private, and all descendants (the whole
comments tree or page if it's the orig post) are private too. Its
post nr (and those of all its descendants) must be negative, <=
PageParts.MaxPrivateNr.

In  perms_on_pages3.{may_post_comment, may_see}  we see who may
reply to (or only see) the private tree.

The private_status_c value says if it's ok to add more people to this private
tree, and if someone added, can see already existing private comments
(otherwise they can see new, only).
These things can only be changed in the more-private direction,
once the private tree has been created.  Maybe values could be:

Edit: Isn't it better to store the below "was previously public" in a separate
field, e.g.  was_public_until_c  — then we'd know for about how long too.
Or don't store at all in posts3, only in the audit log. [_skip_was_pub]  /Edit

Null: Not private. Edit: Or it can be a bookmark? [bookm_0_priv_status]
4:  Like 5, but was previously public for a while?  EDIT: _skip_was_pub? See above.
5:  Can add more private members, and make it public. The default.
    All other values below, won't be implemented the nearest ... years?:
8:  Like 9, but previously_public.
9:  Can add more people to the private tree, that is, make it less private, sort of.
    And they get to see the alreday existing comments.
12:  Like 12, but previously_public.
13: Can add more people to a private tree, but they don't get to see any
    already existing comments; they can see only comments posted after they
    (the new people) got added. Will use  perms_on_posts3.can_see_priv_aft_c
    to remember when?
16:  Like 17, but previously_public.
17: If adding more people to a private page, instead, a new private page
    gets created, with the original people plus the ones now added.
    (And you can keep adding people, until a comment has been posted on this
    new page — thereafter, adding more, cerates yet another page.)
    Then new people won't see that there was an earlier discussion,
    with fewer participants.
20:  Like 9, but previously_public.
21: Cannot add more private pats (except for by adding to a group who can see).
24:  Like 9, but previously_public.
25: Cannot add more private pats, not even by adding sbd to a group.
    (How's that going to get implemented? And does it ever make sense)

Since private comments have nr:s <= -1001 (PageParts.MaxPrivateNr), they can be
effectively skipped when loading comments to show by default on a page, *and*
so there won't be any gaps in the not-private comment nr sequence (> 0).
Comments on private *pages* though, can have nrs > 0? Because anyone who can
see the private page, can see those comments, so we want to load all of them.

It's not allowed to start new private sub trees inside private trees
or on private pages, because then the permission system would become
unnecessarily complicated? ('New' here means that a different group of
people could see those private-tree-in-tree.)
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
--  job_queue_t
--======================================================================

------------------------------------------------------------------------
comment on table  job_queue_t  is $_$

Remembers for example 1) what posts to (re)index, when new posts got posted,
or old got edited.  Or 2) what posts to reindex, after a category got moved
to another parent category.  3) What posts to *rerender* (not reindex),
if e.g. the CDN address has changed, so links to user generated contents
need to get updated, or some other renderer settings changed.

The time_range_from_c and ..._to_c are for (re)indexing parts of, or everything in,
a site — without adding all posts
at once to the index queue and possibly runnign out disk — instead, we add a
time range row, and then we add the most recent say 100 posts in that time range
to the job queue, and decrease the range's upper bound, handle those 100, pick the
next 100 and so on.

Reindexing everything can be needed, when upgrading to new versions of ElasticSearch,
or if switching to some other search engine (if we'll support othersearch engines
too), or more fields are to be searchable.

If combining a time range with a category id, then, pages & comments in that
category that got posted during that time, will get processed (e.g. reindexed,
depending on do_what_c).  — Since a page might get moved from one category,
to another category B that is getting reindexed, then, the app server could,
before it starts indexing a page in category B in the time range,
ask ElasticSearch if that page is in fact already up-to-date.

If combining a time range with a tag, then, the cached HTML for pages with that
tag, could be rerendered — maybe the tag name got changed, for example,
so the html is stale. There's no do_what_c value for rerendering posts or
page html yet though.

If lots of posts were imported simultaneously, they might all have the same
externally generated timestamp. Or if two posts are created at the exact same time
(e.g. page title and body).  Then, to remember where to continue indexing,
a date isn't enough — we also need a post id offset (combined with a date);
that's what time_range_from_ofs_c and ...to_ofs_c are for.
(But can't use just a tsrange.)
$_$;  -- '
------------------------------------------------------------------------



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
-- RM:  comment on column  posts3.anon_level_c  is $_$
-- 
-- If this post was done anonymously, by a member (not a guest), and how
-- much it is anonymized.
-- $_$;
-- ------------------------------------------------------------------------
-- RM:  comment on column  posts3.anonym_nr_c  is $_$
-- 
-- Others can see that one's anonymous posts with the same virtual anon
-- account incarnation, were made by the same anonymous person (but of course
-- not who hen is).
-- $_$; -- '
-- ------------------------------------------------------------------------


-- ------------------------------------------------------------------------
comment on column  posts3.answered_status_c  is $_$

1: Waiting for solutions. 2: There's some solutions, still waiting for more.
3: There's a solution, no more needed (and then page typically closed).
$_$; -- '

-- ------------------------------------------------------------------------
comment on column  posts3.closed_status  is $_$

1: Closed, 2: Locked, 3: Frozen.
$_$;

-- ------------------------------------------------------------------------
comment on column  posts3.doing_status_c  is $_$

1: Planned, 2: Started, 3: Paused, 4: Done.
$_$;


--======================================================================
--  notifications3
--======================================================================

-- ------------------------------------------------------------------------
comment on index  notfs_i_totrueid_createdat  is $_$
For listing notifications to one's aliases.
$_$;


--======================================================================
--  settings_t
--======================================================================

------------------------------------------------------------------------
comment on column  settings3.ai_conf_c  is $_$
AI configuration. Can be long, if includes custom prompts.
$_$;

------------------------------------------------------------------------
comment on column  settings3.enable_online_status_c  is $_$
If there should be any sidebar users-online list.
$_$;

------------------------------------------------------------------------
comment on column  settings3.follow_links_to_c  is $_$
List of domains for which links should be rel=follow.
$_$;


--======================================================================
--  tags_t
--======================================================================

------------------------------------------------------------------------
comment on table  tags_t  is $_$
Stores tags and user badges. The tag / badge titles, colors etc are
in types_t (currently named tagtypes_t)

Tags can have values, e.g. 'Version: 1.23.4', 'Event-Location: Some-Where',
'Event-Date: Aug 22 20:00 to Aug 23 03:00', 'Published-Year: 1990'.

Use val_i32_c, val_f64_c etc primarily, and val_*_b_c only if two fields
are needed e.g. to store a location (long & lat).
$_$;
------------------------------------------------------------------------


------------------------------------------------------------------------
comment on column  tags_t.val_type_c  is $_$

1 (one) means it's a "simple" value, meaning, it's just what's stored:
if val_i32_c is not null, the value is an integer, if val_f64_c is
not null, it's a decimal value and so on.

Later there might be more complex values, e.g. val_f64_c might be
used to instead store a date (Unix time), or val_f64_c and val_i32_c
to store the start and duration (seconds) of an event.

The url in val_url_c can be combined with any other value, and makes
it a link?  However, disabled for now.

Or if the type is html, then val_str_c would be interpreted as
unsanitized unsafe html. But if type is simple, then it's plain text.

Later, could allow jsonb together with other vals too? Could display
a '{}' after any numeric or text value, to indicate that there's json.

For now, urls and jsonb aren't allowed — only numbers and plain text.
$_$; -- '


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
comment on constraint  types_c_wantsval_valtype_null  on  tagtypes_t  is $_$
It's ok to remember any value type this type wanted, previously, so
value_type_c != null, when wants_value_c is null or <= NeverButCanContinue = 2,
is ok.
$_$;  -- '

------------------------------------------------------------------------



--======================================================================
--
--======================================================================



