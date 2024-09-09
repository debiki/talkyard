/*
 * Copyright (c) 2016, 2018 Kaj Magnus Lindberg
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
/// <reference path="../app-more/more-bundle-already-loaded.d.ts" />
/// <reference path="utils/react-utils.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.morebundle {
//------------------------------------------------------------------------------


// Lazy loaded dialogs
//========================


export function openTagDropdown(atRect, ps: {
      tag?: Tag, tagName: St, tagType: TagType, anyValue?, me: Me }) {
  Server.loadMoreScriptsBundle(() => {
    tags.openTagDropdown(atRect, ps);
  });
}


export function openDropdown(ps: ProxyDiagParams, childrenFn: (close: () => V) => RElm) {
  Server.loadMoreScriptsBundle(() => {
    morekit.openProxyDiag(ps, childrenFn);
  });
}


export function openDefaultStupidDialog(props: StupidDialogStuff) {
  Server.loadMoreScriptsBundle(() => {
    util.openDefaultStupidDialog(props);
  });
}


export function showCreateUserDialog(params: CreateUserParams) {
  Server.loadMoreScriptsBundle(() => {
    debiki.internal._showCreateUserDialog(params);
  });
}


export function chooseEditorPersona(ps: ChooseEditorPersonaPs, then?: (_: DoAsAndOpts) => V) {
  Server.loadMoreScriptsBundle(() => {
    persona.chooseEditorPersona(ps, then);
  });
}


export function choosePosterPersona(ps: ChoosePosterPersonaPs,
          then: (_: DoAsAndOpts | 'CANCEL') => V) {
  Server.loadMoreScriptsBundle(() => {
    persona.choosePosterPersona(ps, then);
  });
}

export function openPersonaInfoDiag(ps: { atRect: Rect, isSectionPage: Bo,
        me: Me, personaOpts: PersonaOptions, discProps: DiscPropsDerived }): V {
  Server.loadMoreScriptsBundle(() => {
    persona.openPersonaInfoDiag(ps);
  });
}

export function openAboutUserDialog(who: number | string | BriefUser, at, extraInfo?: string) {
  Server.loadMoreScriptsBundle(() => {
    if (_.isString(who) || _.isNumber(who)) {
      debiki2.pagedialogs.getAboutUserDialog().openForUserIdOrUsername(who, at, extraInfo);
    }
    else {
      debiki2.pagedialogs.getAboutUserDialog().openForUser(who, at, extraInfo);
    }
  });
}


export function openAboutUserDialogForAuthor(post: Post, at) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.getAboutUserDialog().openForPostAt(post, at);
  });
}


export function openAddPeopleDialog(ps: { curPatIds?: PatId[], curPats?: Pat[],
          onChanges: (res: PatsToAddRemove) => Vo }) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openAddPeopleDialog(ps);
  });
}


export function openDeletePostDialog(ps: { post: Post, at: Rect, doAsAnon?: MaybeAnon }) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openDeletePostDialog(ps);
  });
}


export function openLikesDialog(post: Post, voteType: PostVoteType, at) {
 Server.loadMoreScriptsBundle(() => {
   debiki2.pagedialogs.openLikesDialog(post, voteType, at);
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


export function openFlagDialog(postId: PostId, at: Rect) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openFlagDialog(postId, at);
  });
}


export function openHelpDialogUnlessHidden(message) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.help.openHelpDialogUnlessHidden(message);
  });
}


export function openMovePostsDialog(store: Store, post: Post, closeCaller, at: Rect) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openMovePostsDialog(store, post, closeCaller, at);
  });
}


export function openChangePageDialog(atRect: Rect, props: ChangePageDiagParams) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs['openChangePageDialog'](atRect, props);
  });
}


export function openPageToolsDialog() {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagetools.getPageToolsDialog().open();
  });
}


export function openDiscLayoutDiag(state: DiscLayoutDiagState) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs['openDiscLayoutDiag'](state);
  });
}


export function getEditCategoryDialog(handler: (dialog) => void) {
  // We need the editor-bundle.js, because it contains window.debikiSlugify [5FK2W08].
  // And the more-bundle.js too. This loads both.
  Server.loadEditorAndMoreBundles(() => {
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


export function openTagsDialog(ps: TagDiagProps) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openTagsDialog(ps);
  });
}


export function openWikifyDialog(post: Post) {
  Server.loadMoreScriptsBundle(() => {
    debiki2.pagedialogs.openWikifyDialog(post);
  });
}


export function joinOrCreateSubCommunity(store: Store) {
   Server.loadMoreScriptsBundle(() => {
     debiki2.subcommunities.joinOrCreateSubCommunity(store);
   });
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

  UNSAFE_componentWillMount: function() {
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
