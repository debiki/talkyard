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


/// <reference path="prelude.ts"/>
/// <reference path="utils/utils.ts"/>

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

// In embedded comments, need incl the Talkyard server url, otherwise links will [EMBCMTSORIG]
// resolve to the embeddING server.
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
    const mainStore: SessWinStore = win_getSessWinStore();
    cachedEmbOrig = mainStore.embeddedOriginOrEmpty;  // [ONESTORE]
  }
  return cachedEmbOrig;
}

let cachedEmbOrig: St | U;


export function linkToPageId(pageId: PageId): string {
  return origin() + '/-' + pageId;
}


export function linkToPostNr(pageId: PageId, postNr: PostNr): string {
  return linkToPageId(pageId) + '#post-' + postNr;
}


export function linkToType(type: TagType): St {
  return origin() + UrlPaths.Tags + (type.urlSlug || type.id);
}


export function linkToAdminPage(): string {
  return origin() + '/-/admin/';
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
  const maybeNewOrigin = differentHostname ? '//' + differentHostname : origin();
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
  return origin();
}

export function linkToReviewPage(): string {
  return origin() + '/-/admin/review/all';
}

export function linkToStaffInvitePage(): string {
  return origin() + '/-/admin/users/invited';
}

export function linkToStaffUsersPage(): St {
  return origin() + '/-/admin/users/';
}

export function linkToGroups(): string {
  return origin() + '/-/groups/';
}


// RENAME to linkToPatsProfile, and remove that fn
export function linkToUserProfilePage(who: Who): St {
  return origin() + pathTo(who);
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
  const maybeNewPageUrl = (): string => origin() + '/-' + (pageId || locator.pageId);

  let theLink;

  switch (locator.draftType) {
    case DraftType.Topic:
      // Incl page url, so we'll go to the right place, also if the topic list is located at e.g.
      // /forum/  or  /sub-community/ instead of  /.
      theLink = origin() + '/-' + locator.pageId + FragActionHashComposeTopic;
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
    return origin() + '/-' + notf.pageId + FragParamPostNr + notf.postNr;
  }
  else {
    die("Unknown notification type [EsE5GUKW2]")
  }
}


export function linkToCat(cat: Cat): St {
  return origin() + '/latest/' + cat.slug;
}


export function linkToRedirToAboutCategoryPage(categoryId: CategoryId): string {
  return origin() + '/-/redir-to-about?categoryId=' + categoryId;
}


export function linkToResetPassword(): string {
  return origin() + '/-/reset-password/specify-email';
}


export function linkToTermsOfUse(): string {
  return origin() + '/-/terms-of-use';
}

export function linkToAboutPage(): string {
  return origin() + '/about';
}


export function linkToUpload(origins: Origins, uploadsPath: string): string {
  // If 1) there's a UGC CDN, always access uploaded pics via that. Or if 2) we're
  // in an embedded comments discussion, access the pics via the Talkyard server's
  // origin = the remote origin, otherwise the pic urls would resolve relative to
  // the *blog*'s address, but the blog doesn't host the pics (they'd be 404 Not Found).
  // Otherwise 3) no origin needed (empty string).
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
