/*
 * Copyright (C) 2016 Kaj Magnus Lindberg
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

/// <reference path="Server.ts" />
/// <reference path="more-bundle-already-loaded.d.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.morebundle {
//------------------------------------------------------------------------------


// Lazy loaded dialogs
//========================


export function openAboutUserDialog(who: number | string | BriefUser) {
  Server.loadMoreScriptsBundle(() => {
    if (_.isString(who) || _.isNumber(who)) {
      debiki2.pagedialogs.getAboutUserDialog().openForUserIdOrUsername(who);
    }
    else {
      debiki2.pagedialogs.getAboutUserDialog().openForUser(who);
    }
  });
}


export function openAboutUserDialogForAuthor(post: Post) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.getAboutUserDialog().openForPost(post);
  });
}


export function openAddPeopleDialog() {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openAddPeopleDialog();
  });
}


export function openDeletePostDialog(post: Post) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openDeletePostDialog(post);
  });
}


export function openEditHistoryDialog(postId: number) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.edithistory.getEditHistoryDialog().open(postId);
  });
}


export function openEditIntroDialog() {
  Server.loadMoreScriptsBundle(() => {
    debiki2.forum.openEditIntroDialog();
  });
}


export function openFlagDialog(postId: PostId) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openFlagDialog(postId);
  });
}


export function openHelpDialogUnlessHidden(message) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.help.openHelpDialogUnlessHidden(message);
  });
}


export function openLoginDialog(purpose: LoginReason | string) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.login.getLoginDialog().openToLogIn(purpose);
  });
}


export function openLoginDialogToSignUp(purpose: LoginReason | string) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.login.getLoginDialog().openToSignUp(purpose);
  });
}


export function openMovePostsDialog(store: Store, post: Post, closeCaller) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openMovePostsDialog(store, post, closeCaller);
  });
}


export function openPageToolsDialog() {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagetools.getPageToolsDialog().open();
  });
}


export function getEditCategoryDialog(handler: (dialog) => void) {
  // We need the editor-bundle.js, because it contains window.debikiSlugify [5FK2W08].
  // And the more-bundle.js too. This loads both.
  Server.loadEditorEtcScriptsAndLater(() => {
    debiki2.forum.getEditCategoryDialog(handler);
  });
}


export function getProgressBarDialog(handler: (dialog) => void) {
  Server.loadMoreScriptsBundle(() => {
    handler(pagedialogs.getProgressBarDialog());
  });
}


export function openSeeWrenchDialog() {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openSeeWrenchDialog();
  });
}


export function openShareDialog(post: Post, button) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openShareDialog(post, button);
  });
}


export function openTagsDialog(store: Store, post: Post) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openTagsDialog(store, post);
  });
}


export function openWikifyDialog(post: Post) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openWikifyDialog(post);
  });
}


export function loginIfNeeded(loginReason: LoginReason | string,
      anyReturnToUrl?: string, success?: () => void) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.login.loginIfNeeded(loginReason, anyReturnToUrl, success);
  });
}


/**
 * Logs in and calls success(). Or, if verification email needed, afterwards returns to this page
 * + the anchor (URL hash), and the user should then click the button (or whatever) again.
 */
export function loginIfNeededReturnToAnchor(loginReason: LoginReason | string,
      anchor: string, success: () => void) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.login.loginIfNeededReturnToAnchor(loginReason, anchor, success);
  });
}


export function loginIfNeededReturnToPost(loginReason: LoginReason | string, postId: PostNr,
      success: () => void) {
  loginIfNeededReturnToAnchor('LoginToEdit', '#post-' + postId, success);
}


// Lazy loaded menus
//========================

export function openMyMenu(store, where) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.topbar.openMyMenu(store, where);
  });
}


// Lazy loaded components
//========================


// Later: break out lazy-loading component?
var LazyMoreBundleComponent = createComponent({
  getInitialState: function() {
    return { bundleLoaded: false };
  },

  componentWillMount: function() {
    Server.loadMoreScriptsBundle(() => {
      if (this.isGone) return;
      this.setState({ bundleLoaded: true });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  render: function() {
    if (!this.state.bundleLoaded)
      return null;

    return this.props.lazyContent();
  }
});



export function TitleEditor(editorProps) {
  return LazyMoreBundleComponent({
    lazyContent: function() {
      return debiki2.titleeditor.TitleEditor(editorProps)
    }
  });
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
