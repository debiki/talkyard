/*
 * Copyright (c) 2016-2018 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// In this file: Constructs links, e.g. to a user's profile page.
//
// Usage example: MenuItemLink({ to: linkToPatsProfile(user) }, "View your profile")


// Don't: Could rename link...() fns that return a complete url, [complete_origin]
// incl origin (e.g. https://www.ex.co/embedded-forum#/-123/talkyarg-page-slug)
// to sth different than  link...() fns that return just a relative url
// (e.g. /-123/page-slug), maybe:
// - linkToPageId —> relUrlToPageId(pageId)
// - linkToEmbeddedDiscussions —> fullUrlToEmbDiscList()  ?
// If in an embedded forum, the fullUrl...() would construct links to embedded
// pages, rather than external links to the Ty forum (so ppl stay on the embedd*ing*
// website).  But if in emb comts, maybe the links should be to the Talkyard site,
// could be confusing if navigating away in the comments iframe? [_blog_comts_lns_are_ext]
// For example, linkToUserProfilePage() should maybe be _split_in_2?
//
// Or isn't it **better** to let all linkTo...() be relative, and in the few cases
// when it's needed, prefix w  `origin() +`.  Let's do that. Later. CLEAN_UP


/// <reference path="prelude.ts"/>
/// <reference path="utils/utils.ts"/>

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

// Just so can find all usages of '' where it means the current origin.
const CurOrigin = '';

// In embedded comments and embedded forums, need incl the Talkyard server url,
// otherwise links will [EMBCMTSORIG] resolve to the embeddING server.
//
// But in *not* embedded forums, we do *not* want to include the Talkyard server url,
// because if we did, and changing the forum address from e.g.  something.talkyard.net
// to  something.com  (start using our own domain), all links would keep pointing
// to the *old* domain.
//
export function origin(): string {
  // Currently there's always exactly one store, and it always has embeddedOriginOrEmpty
  // set. When in the embedded editor, it's undefined (or maybe ''), [60MRKDJ56]
  // so get it from the main store instead.
  //
  // This needs to happen in a function, so gets reevaluated server side, where the same script
  // engine gets reused, for rendering pages at different sites, different origins.
  //
  // We cache the origin, so, if many Ty comments iframes,  [many_embcom_iframes]
  // so we won't need to access a different iframe all the time.
  // But if server side, don't cache — the origin will change when rendering pages
  // for different sites. (Also, then no need to cache, aren't any iframes.)
  //
  if (notDef(cachedEmbOrig) || isServerSide()) {
    const mainWin = getMainWin();
    const mainStore: SessWinStore = mainWin.theStore;
    cachedEmbOrig = mainStore.embeddedOriginOrEmpty;  // [ONESTORE]
    // Doesn't work, not set in the session iframe. But not needed, can use eds.* in the
    // comment iframes, and eds.* copied from the comments frame, in the embedded editor frame.
    // see [many_embcom_iframes].
    //cachedIsInEmbForum = mainWin.eds.isInEmbForum;
    //cachedEmbgUrl = mainWin.eds.embgUrl || mainWin.eds.embeddingUrl || '';
    //cachedEmbPathParam = mainWin.eds.embPathParam;
  }
  return cachedEmbOrig;
}

let cachedEmbOrig: St | U;
let cachedIsInEmbForum: Bo;
let cachedEmbgUrl: St | U;
let cachedEmbPathParam: St | U;


/// We actually can't use ReactRouter's <Link> and <NavLink> — they generate hrefs
/// that don't work at all, when Talkyard is embedded in an iframe. Look:
///
///  (But what about: node_modules/react-router-dom/modules/NavLink.js ?)
///
///  node_modules/react-router-dom/modules/Link.js :
///
///      /**
///       * The public API for rendering a history-aware <a>.
///       */
///      const Link = forwardRef(
///        (
///          {
///            component = LinkAnchor,
///            replace,
///            to,
///            innerRef, // TODO: deprecate
///            ...rest
///          },
///          forwardedRef
///        ) => {
///          return (
///            <RouterContext.Consumer>
///              {context => {
///                invariant(context, "You should not use <Link> outside a <Router>");
///
///                const { history } = context;
///
///   ———>         const location = normalizeToLocation(
///                  resolveToLocation(to, context.location),
///                  context.location
///                );
///         ...
///
///  node_modules/react-router-dom/modules/utils/locationUtils.js :
///
///      export const normalizeToLocation = (to, currentLocation) => {
///        return typeof to === "string"
///  ——>     ? createLocation(to, null, null, currentLocation)
///          : to;
///      };
///
///  node_modules/history/umd/history.js :
///
///      function createLocation(path, state, key, currentLocation) {
///        var location;   <—— the new location
///        ...
///        if (currentLocation) {
///          // Resolve incomplete/relative pathname relative to current location.
///          if (!location.pathname) {
///            location.pathname = currentLocation.pathname;
///          } else if (location.pathname.charAt(0) !== '/') {
///  ———>      location.pathname = resolvePathname(location.pathname, currentLocation.pathname);
///          }
///        } else {
///          // When there is no prior location and pathname is empty, set it to /
///          if (!location.pathname) {
///            location.pathname = '/';
///          }
///        }
///
///        return location;
///      }
///
///      ...
///
///      function resolvePathname(to, from) {
///        if (from === undefined) from = '';
///
///        var toParts = (to && to.split('/')) || [];
///        var fromParts = (from && from.split('/')) || [];
///
///        var isToAbs = to && isAbsolute(to);
///        var isFromAbs = from && isAbsolute(from);
///        var mustEndAbs = isToAbs || isFromAbs;
///
///        if (to && isAbsolute(to)) {
///          // to is absolute
///          fromParts = toParts;
///        } else if (toParts.length) {
///          // to is relative, drop the filename
///          fromParts.pop();
///  ——>     fromParts = fromParts.concat(toParts);   <——— won't work, if embedded in <iframe>
///        }                                            the <a href=...> won't make sense.
///        ...
///
/// That is, if the current location is  https://talkyard.forum/aaa/bbb/ccc
/// and we do:  <Link to="https://embedding.site/forum#/-talkyardPageId",
/// then ReactRouter constructs this: (after having popped() 'ccc')
///     https://talkyard.forum/aaa/bbb/ + https://embedding.site/forum#/-talkyardPageId
///     https://talkyard.forum/aaa/bbb/https://embedding.site/forum#/-talkyardPageId
/// which doesn't make sense at all (and tends to result in 404 Not Found).
///
/// ReactRouter doesn't expect links to be to a parent embedd*ing* website + a parameter
/// telling the Talkyard embedded-forum script on the embedding page what Talkyard page
/// we actually want.
///
/// So we need our own <Link> component instead?
///
export const TyLink: any = makeTyLink('');

export const LinkUnstyled = TyLink;  // deprecated name, renaming to TyLink

export const LinkButton: any        = makeTyLink(' btn btn-default');  // not blue [2GKR5L0]
export const PrimaryLinkButton: any = makeTyLink(' btn btn-primary');
export const ExtLinkButton: any     = makeTyLink(' btn btn-default', { ext: true });


function makeTyLink(spaceWidgetClasses: St, extraProps?) {
  return function(origProps, ...children) {
    const newProps: any = _.assign({}, origProps || {}, extraProps);
    newProps.className = (origProps.className || '') + spaceWidgetClasses;

    // React Bootstrap's Link uses 'to', so better if UnstyledLink works with 'to' too, not only 'href'.
    if (!newProps.href)
      newProps.href = newProps.to;

    // Make link buttons navigate within the single-page-app, no page reloads. Even if they're
    // in a different React root. The admin app is it's own SPA [6TKQ20] so, when in the admin area,
    // links to user profiles and discussions, are external. And vice versa.
    if (!newProps.onClick || eds.isInEmbForum && newProps.href) {
      let isExternal = newProps.ext || eds.isInEmbeddedCommentsIframe;
      // @ifdef DEBUG
      dieIf(isServerSide() && (eds.isInEmbeddedCommentsIframe || eds.isInEmbForum), 'TyE2KWT05');
      // @endif

      const href = newProps.href;
      const linksToAdminArea = href && href.indexOf(UrlPaths.AdminArea) === 0; // dupl [5JKSW20]
      isExternal = isExternal || eds.isInAdminArea !== linksToAdminArea;

      // Single-page-app navigate:
      //
      if (!isExternal && !newProps.onClick) {
        const afterClick = newProps.afterClick;  // field deleted below

        newProps.onClick = function(event) {
          event.preventDefault(); // avoids full page reload
          debiki2.page['Hacks'].navigateTo(href);
          // Some ancestor components ignore events whose target is not their own divs & stuff.
          // Not my code, cannot change that. I have in mind React-Bootstrap's Modal, which does this:
          // `if (e.target !== e.currentTarget) return; this.props.onHide();` — so onHide() never
          // gets called. But we can use afterClick: ...:
          if (afterClick) {
            afterClick();
          }
        }
      }

      // Make links work also if in an embedded forum.  [deep_emb_links]
      // Change from e.g.: /-123/ty-page-slug
      // to: https://www.ex.co/embedded-forum#/-123/ty-page-slug  (if embPathParam = '#/')
      //
      // (But don't modify links passed to the onClick handler above — they'll work fine
      // as is, e.g.  /-123/some-page  or  /-/users/some_username,  ReactRouter resolves
      // those relative the iframe origin (which is the Talkyard server addr), apparently,
      // not the embedding page's origin.)
      //
      if (eds.isInEmbForum && newProps.href) {
        if (!isExternal) {
          newProps.href = linkToPath(newProps.href);
        }
        else {
          // Don't open links to other websites, or to the admin area, inside the iframe.
          const hasOrigin = newProps.href.match(/^(https?:)?\/\/[^:/]+/);
          newProps.target = '_blank';
          newProps.rel = 'noopener';
          if (hasOrigin) {
            // To some external website? Use as-is.
          }
          else {
            // To the admin area, or some other Talkyard site section we want to open
            // in its own tab.
            // Add the origin, since we're in an iframe, and '/-/admin/' without origin would
            // be relative the embedding website.
            const missingSlash = newProps.href[0] !== '/' ? '/' : ''; // don't mangle the hostname
            newProps.href = location.origin + missingSlash + newProps.href;
          }
        }
      }
    }

    delete newProps.afterClick;
    delete newProps.ext;
    delete newProps.to;

    return r.a(newProps, ...children);
  }
}



/// Converts a Talkyard forum relative url, e.g. /-123/talkyard-page-slug,
/// to a url that works also if Talkyard forum is embedded in an iframe,
/// e.g.  https://www.ex.co/embedded-forum#/-123/talkyard-page-slug.
/// Uses some eds.* variables.  [deep_emb_links]
///
export function linkToPath(tyPath: St): St {
  // @ifdef DEBUG
  // The caller should add a hash later, if needed.
  //dieIf(tyPath.indexOf('#') !== -1, 'TyEEMBPATHHASH');
  // @endif

  // Blog comments should probably link to the Talkyard site — we don't want to
  // navigate to other pages inside the blog comments iframe. [_blog_comts_lns_are_ext]
  if (eds.isInEmbeddedCommentsIframe || eds.isInEmbeddedEditor) {
    return origin() + tyPath;
  }

  // If not embedded, we'll return links as is, e.g. /-123/page-slug, and that'll
  // be relative the Talkyard server origin.
  if (!eds.isInEmbForum) {
    return CurOrigin + tyPath;
  }

  // In an embedded forum.
  // We'll construct a link to the embedd*ing* page with a parameter (typically
  // the #hash-fragment) that tells the Talkyard script on the embedd*ing* page, that is,
  // talkyard-forum.min.js, to show `tyPath` in the Talkyard forum iframe. [embg_ty_url]

  // COULD_OPTIMIZE Do just once, also if many links.
  const embgUrl = new URL(eds.embgUrl || eds.embeddingUrl); // cachedEmbgUrl

  // The resulting link, e.g.  https://www.ex.co/emb-forum#/-123/talkyard-page-slug.
  let res: St | U;

  // This needed to make #hash and ?query=param links w/o paths work? But
  // it's better to incl a path always? Let's wait:
  // if (tyPath[0] === '#') {
  //   tyPath = location.pathname + location.search + tyPath;
  // }
  // else if (tyPath[0] === '?') {
  //   tyPath = location.pathname + tyPath;
  // }

  if (eds.embPathParam === '#/') {
    // This'll look like:  https://www.ex.co/embedded-forum#/-123/talkyard-slug#any-hash
    res = embgUrl.origin + embgUrl.pathname + embgUrl.search + '#' + tyPath;
  }
  else {
    // No deep link method configured. Link to the Talkyard forum instead (but not to
    // the embedd*ing* website).
    return origin() + tyPath;
  }
  /* Other embPathParam:s: Not impl.
  else if (eds.embPathParam === '?/') {
    UNTE STED
    // This'll look like:  https://www.ex.co/embedded-forum?/-123/talkyard-slug#any-hash
    // Is this ever useful? Probably '#' above is better.
    res = embgUrl.origin + embgUrl.pathname + '?' + tyPath;
  }
  else {
    UNT ESTED
    // This'll look like:  https://www.ex.com/embedded-forum?talkyardPath=/-/talkyard-page-slug
    // if `eds.embPathParam` is '?talkyardPath'.
    // We'll leave all query params intact, except for `eds.embPathParam` which we'll
    // replace with the new path.
    // @ifdef DEBUG
    dieIf(!eds.embPathParam.match(/\?[a-zA-Z_-]+/), 'TyEEMBPATHPARM');
    // @endif
    // No need to encode '/+:', but '?&' — yes.
    // No longer needed! Using URLSearchParams.set() which encodes for us.
    // const tyPathEncoded = encodeURIComponent(tyPath)
    //         .replace(/%2F/g, '/')
    //         .replace(/%2B/g, '+')
    //         .replace(/%3A/g, ':');
    // // `embgUrl.searchParams` is read-only, so create a new.
    // const params = new URLSearchParams(embgUrl.search);
    // params.set(eds.embPathParam, tyPathEncoded);
    embgUrl.searchParams.set(eds.embPathParam, tyPath);  // updates `embgUrl.search`
    res = embgUrl.origin + embgUrl.pathname + embgUrl.searchParams.toString();
  } */

  return res;
}


export function linkToPageId(pageId: PageId): St {
  return CurOrigin + '/-' + pageId;
}


export function linkToPostNr(pageId: PageId, postNr: PostNr): string {
  return linkToPageId(pageId) + '#post-' + postNr;
}


export function linkToPost(post: PostWithPageId): St {
  return linkToPageId(post.pageId) + '#post-' + post.nr;
}


export function linkToType(type: TagType): St {
  return CurOrigin + UrlPaths.Tags + (type.urlSlug || type.id);
}


export function linkToAdminPage(): string {
  // Don't use linkToPath() — admin pages need to be accessed
  // directly [dont_embed_amind_pages].
  return CurOrigin + '/-/admin/';
}

export function linkToAdminPageLoginSettings(): string {
  return linkToAdminPage() + 'settings/login';
}

export function linkToAdminPageFeatures(): St {
  return linkToAdminPage() + 'settings/features';
}

export function linkToAdminApi(): string {
  return linkToAdminPage() + 'api';
}

export function linkToAdminPageModerationSettings(): string {
  return linkToAdminPage() + 'settings/moderation';
}

export function linkToAdminPageEmbeddedSettings(): string {
  return linkToAdminPage() + 'settings/embedded-comments';
}

export function linkToAdminPageAdvancedSettings(differentHostname?: string): string {
  // This fn is called if we change the hostname, to jump to site settings at the new address.
  const maybeNewOrigin = differentHostname ? '//' + differentHostname : CurOrigin;
  return maybeNewOrigin + '/-/admin/settings/site';
}

export function linkToUserInAdminArea(user: Myself | Participant | UserId): string {
  // If Myself specified, should be logged in and thus have username or id. (2UBASP5)
  // @ifdef DEBUG
  dieIf(!user, 'TyE4KPWQT6');
  dieIf(_.isObject(user) && !(<any> user).id, 'TyE4KPWQT5');
  // @endif
  const userId = _.isObject(user) ? (<any> user).id : user;
  return linkToStaffUsersPage() + 'id/' + userId;
}

export function linkToEmbeddedDiscussions(): string {
  // Later: link to the correct category, when emb comments topics have their own category.
  // This is for opening the embedded comments page index in a new tab, so,
  // we want the [complete_origin].
  return linkToPath('');
}

export function linkToReviewPage(ps: { patId?: PatId } = {}): St {
  // Don't use url_tyPathToEmbedded(), [dont_embed_amind_pages].
  let url = CurOrigin + '/-/admin/review';
  if (ps.patId) url += `?patId=${ps.patId}`;
  return url;
}

export function linkToStaffInvitePage(): string {
  return CurOrigin + '/-/admin/users/invited';
}

export function linkToInspect(what: 'priv-prefs'): St {
  return CurOrigin + '/-/admin/inspect#' + what;
}

export function linkToStaffUsersPage(): St {
  return CurOrigin + '/-/admin/users/';
}

export function linkToGroups(): string {
  return CurOrigin + '/-/groups/';
}


// RENAME to linkToPatsProfile, and remove that fn
// Maybe _split_in_2:  relUrlToPatProfile()  and  fullUrlToPatsProfile()?
export function linkToUserProfilePage(who: Who): St {
  return pathTo(who);
}

// RENAME to pathToProfile ?
export function pathTo(who: Who): St {
    // @ifdef DEBUG
    dieIf(!who, 'TyE7UKWQT2');
    // @endif
  let rootPath: St;
  let idOrUsername: PatId | St;
  if (_.isObject(who)) {
    const patOrStore: Pat | Me | Store = who;
    const pat: Me | Pat = (patOrStore as Store).me || (patOrStore as Me | Pat);
    // Guests have no username — instead, use their participant id.
    idOrUsername = pat.username || pat.id;
    // If Me specified, should be logged in and thus have username or id. (2UBASP5)
    // @ifdef DEBUG
    dieIf(!idOrUsername, 'TyE7UKWQT3');
    // @endif
    rootPath = pat.isGroup ? GroupsRoot : UsersRoot;
  }
  else {
    idOrUsername = who;
    rootPath = UsersRoot;  // will get redirected to GroupsRoot, if is group
  }

  if (_.isString(idOrUsername)) {
    idOrUsername = idOrUsername.toLowerCase();
  }
  return rootPath + idOrUsername;
}

export function linkToUsersNotfs(who: Who): St {
  return linkToUserProfilePage(who) + '/notifications';
}

// CLEAN_UP  change to  who: Who  for alll user link fns -----

export function linkToMembersNotfPrefs(userIdOrUsername: UserId | string): string {
  return linkToUserProfilePage(userIdOrUsername) + '/preferences/notifications';
}

export function linkToSendMessage(userIdOrUsername: UserId | string): string {
  return linkToUserProfilePage(userIdOrUsername) + '/activity/posts' + FragActionHashComposeMessage;
}

export function linkToInvitesFromUser(userId: UserId): string {
  return linkToUserProfilePage(userId) + '/invites';
}

export function linkToUsersEmailAddrs(userIdOrUsername: UserId | string): string {
  return linkToUserProfilePage(userIdOrUsername) + '/preferences/account';
}

export function linkToPatsPrivPrefs(who: Who): St {
  return linkToUserProfilePage(who) + '/preferences/privacy';
}

export function linkToPatsUiPrefs(who: Who): St {
  return linkToUserProfilePage(who) + '/preferences/ui';
}

export function linkToMyDraftsEtc(store: Store): string {
  return linkToMyProfilePage(store) + '/drafts-etc';
}

export function linkToMyProfilePage(store: Store): string {   // REMOVE use linkToPatsProfile instead
  return linkToPatsProfile(store);
}

// REMOVE use linkToUserProfilePage instead, but renamed to this name:
export function linkToPatsProfile(patOrStore: Me | Pat | Store): St {
  return linkToUserProfilePage(patOrStore);
}

// --- / CLEAN_UP  --------------------------------------------

/// COULD_OPTIMIZE, SMALLER_BUNDLE: Move to more-bundle?
/// And many other link fns?
///
export function linkToDraftSource(draft: Draft, pageId?: PageId, postNr?: PostNr): string {
  const locator = draft.forWhat;

  // The current page id and post nr, might be different from draft.pageId and draft.postNr,
  // if the post was moved to another page. So better use pageId, it's up-to-date the correct
  // page id directly from the server.
  const maybeNewPageUrl = (): St => CurOrigin + '/-' + (pageId || locator.pageId);

  let theLink;

  switch (locator.draftType) {
    case DraftType.Topic:
      // Incl page url, so we'll go to the right place, also if the topic list is located at e.g.
      // /forum/  or  /sub-community/ instead of  /.
      theLink = CurOrigin + '/-' + locator.pageId + FragActionHashComposeTopic;
      if (draft.topicType) theLink += FragParamTopicType + draft.topicType;
      if (locator.categoryId) theLink += FragParamCategoryId + locator.categoryId;  // [305RKTJ33]
      break;
    case DraftType.DirectMessage:
      theLink = linkToSendMessage(locator.toUserId);
      break;
    case DraftType.Reply: // fall through
    case DraftType.ProgressPost:
      let hashFragAction: string;
      if (draft.postType === PostType.ChatMessage) {
        // No fragment action needed for chat messages — then the chat message input box is shown
        // by default, and will load the draft. Do incl a '#' hash though so + &draftNr=... works.
        hashFragAction = '#';
      }
      else {
        hashFragAction =
            FragParamPostNr + locator.postNr +
            FragActionAndReplyToPost +
            FragParamReplyType + draft.postType;
      }
      theLink = maybeNewPageUrl() + hashFragAction;
      break;
    case DraftType.Edit:
      theLink = maybeNewPageUrl() + FragParamPostNr + postNr + FragActionAndEditPost;
      break;
    default:
      die(`Unknown draft type: ${locator.draftType} [TyE5AD2M4]`);
  }

  theLink += FragParamDraftNr + draft.draftNr;
  return theLink;
}


export function linkToNotificationSource(notf: Notification): string {
  if (notf.pageId && notf.postNr) {
    return CurOrigin + '/-' + notf.pageId + FragParamPostNr + notf.postNr;
  }
  else {
    die("Unknown notification type [EsE5GUKW2]")
  }
}


export function linkToCat(cat: Cat): St {
  return CurOrigin + '/latest/' + cat.slug;
}


export function linkToRedirToAboutCategoryPage(categoryId: CategoryId): string {
  return CurOrigin + '/-/redir-to-about?categoryId=' + categoryId;
}


export function linkToResetPassword(): string {
  // Use the Talkyard server origin if any. Otherwise, a <a href... target=_blank> would open in
  // new tab, possibly resolved against the embedd*ing* website origin, but we wan't Ty's
  // origin, to reset a Ty password.
  // [complete_origin]
  return origin() + '/-/reset-password/specify-email';
}


export function linkToTermsOfUse(): string {
  // [complete_origin]
  return origin() + '/-/terms-of-use';
}


export function linkToUpload(origins: Origins, uploadsPath: string): string {
  // If 1) there's a UGC CDN, always access uploaded pics via that. Or if 2) we're
  // in an embedded comments discussion, access the pics via the Talkyard server's
  // origin = the remote origin, otherwise the pic urls would resolve relative to
  // the *blog*'s address, but the blog doesn't host the pics (they'd be 404 Not Found).
  // Otherwise 3) no origin needed (empty string).
  // [complete_origin]
  const origin = origins.anyUgcOrigin || origins.anyCdnOrigin || origins.embeddedOriginOrEmpty;
  const uploadsUrlBasePath = '/-/u/';
  return origin + uploadsUrlBasePath + origins.pubSiteId + '/' + uploadsPath;
}


export function rememberBackUrl(url?: string) {
  const theUrl = url || location.pathname + location.search + location.hash;
  // Skip API pages — those are the ones we're returning *from*.
  if (url && url.indexOf(ApiUrlPathPrefix) >= 0 ||  // not === 0, might be a hostname
      location.pathname.indexOf(ApiUrlPathPrefix) === 0) {
    return;
  }
  debiki2.putInSessionStorage('returnToSiteUrl', theUrl);
}


/**
 * The page that the user viewed before s/he entered the admin or
 * about-user area, or to the homepage ('/') if there's no previous page.
 * COULD use store.settings.forumMainView instead of '/' as fallback? [what_rootPathView]
 */
export function linkBackToSite(): string {
  return getFromSessionStorage('returnToSiteUrl') || '/';
}


export function externalLinkToAdminHelp(): string {
  return 'https://www.talkyard.io/forum/latest/support';
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
