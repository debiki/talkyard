
declare namespace rb {
  var ReactBootstrap;
  var Modal;
  var ModalHeader;
  var ModalTitle;
  var ModalBody;
  var ModalFooter;

  var ReactSelect;
  var TabbedArea;
  var TabPane;
  var Tabs;
  var Tab;
  var Alert;
  var ProgressBar;

  var FormGroup;
  var ControlLabel;
  var FormControl;
  var HelpBlock;
  var Checkbox;
  var Radio;
  var InputGroupAddon;
}


declare namespace debiki2 {

  namespace morekit {
    function openProxyDiag(ps: ProxyDiagParams, childrenFn: (close: () => V) => RElm);
  }

  var Expandable;
  function Input(props: InputProps, children?): RElm;

  namespace forum {
    function getEditCategoryDialog(handler: (dialog) => void);
  }

  namespace utils {
    var PatternInput;  // REFACTOR RENAME move to debiki2
    var PageUnloadAlerter;
  }

  namespace util {
    function makeStupidDialogGetter();
    function makeResizableUp(elem, handle, onResize): (stop: Bo) => Vo;
  }

  namespace topbar {
    function openMyMenu(store, where);
  }

  namespace editor {
    var PageRoleDropdown;
  }

  namespace search {
    function searchRoute(): any;
  }

  namespace help {
    function openHelpDialogUnlessHidden(message);
  }
}


declare namespace debiki2.pagedialogs {

  function openAddPeopleDialog(ps: { curPatIds?: PatId[], curPats?: Pat[],
        mayClear?: Bo, onChanges: (PatsToAddRemove) => Vo });
  function openDeletePostDialog(post: Post, at: Rect);
  function openFlagDialog(postId: PostId, at: Rect);
  function openMovePostsDialog(store: Store, post: Post, closeCaller, at: Rect);
  function openSeeWrenchDialog();
  function openShareDialog(post: Post, button);
  function openTagsDialog(ps: TagDiagProps);
  function openWikifyDialog(post: Post);
  function openLikesDialog(post: Post, voteType: PostVoteType, at: Rect)
  function openDiscLayoutDiag(state: DiscLayoutDiagState);

  function getAboutUserDialog();
  function getProgressBarDialog();
}

declare namespace debiki2.anon {
  function openAnonDropdown(ps: any); //AnonStatusState);
  function whichAnon_titleShort(doAsAnon: WhichAnon | U, ps: { me: Me, pat?: Pat }): St | RElm;
  function whichAnon_title(doAsAnon: WhichAnon | U, ps: { me: Me, pat?: Pat }): St | RElm;
  function whichAnon_descr(doAsAnon: WhichAnon | U, ps: { me: Me, pat?: Pat }): St | RElm;
}

declare namespace debiki2.subcommunities {
  function joinOrCreateSubCommunity(store: Store);
}

declare namespace debiki2.edithistory {

  function getEditHistoryDialog();

}


declare namespace debiki2.login {

  function getLoginDialog(): AuthnDlgIf;

}


declare namespace debiki2.util {
  function openDefaultStupidDialog(stuff: StupidDialogStuff);
}

declare namespace debiki2.nopage {
  var NonExistingPage;
}

declare namespace debiki2.tags {
  var routes;
  function openTagDropdown(atRect, ps);
  function openBookmarkDropdown(atRect, ps);
}

declare namespace debiki2.titleeditor {
  var TitleEditor;
}
declare namespace debiki2.help {
}

declare namespace debiki2.forum {
  function openEditIntroDialog();
}

declare namespace debiki2.tags {
  const TagsAppComponent;
}

declare namespace debiki2.users {
  function InviteRowWithKey(props: { store: Store, invite: Invite, nowMs: WhenMs, showSender? });
  function openInviteDialog(onDone: (invites: Invite[]) => void);
  const UsersHomeComponent;
}

declare namespace debiki2.pagetools {
  function getPageToolsDialog();
  function openPageIdsUrlsDialog(pageId: PageId);
}
