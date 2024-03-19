/// <reference path="../app-slim/model.ts" />
/// <reference path="../app-slim/translations.d.ts" />
/// <reference path="../reactjs-types.ts" />

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
    function openSimpleProxyDiag(ps: ProxyDiagParams & { body: RElm });
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

  namespace todos {
    function ToDos(props);
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
  function openDeletePostDialog(ps: { post: Post, at: Rect, doAsAnon?: MaybeAnon });
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

  var NeverAlwaysBtn: any;
  function neverAlways_title(neverAlways: NeverAlways): St;
}

declare namespace debiki2.persona {
  function chooseEditorPersona(ps: ChooseEditorPersonaPs, then?: (_: DoAsAndOpts) => V): V;
  function choosePosterPersona(ps: ChoosePosterPersonaPs, then?: (_: DoAsAndOpts | 'CANCEL') => V)
        : DoAsAndOpts;
  function openAnonDropdown(ps: ChoosePersonaDlgPs): V;
  function whichAnon_titleShort(doAsAnon: MaybeAnon, ps: { me: Me, pat?: Pat }): RElm;
  function whichAnon_title(doAsAnon: MaybeAnon, ps: { me: Me, pat?: Pat }): St | RElm;
  function whichAnon_descr(doAsAnon: MaybeAnon, ps: { me: Me, pat?: Pat }): St | RElm;

  function openPersonaInfoDiag(ps: { atRect: Rect, isSectionPage: Bo,
        me: Me, personaOpts: PersonaOptions, discProps: DiscPropsDerived }): V;
}

declare namespace debiki2.subcommunities {
  function joinOrCreateSubCommunity(store: Store);
}

declare namespace debiki2.edithistory {

  function getEditHistoryDialog();

}


declare namespace debiki2.login {

  function getLoginDialog(): AuthnDlgIf;
  function isSocialLoginEnabled(settings: SettingsVisibleClientSide | Settings): Bo;
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
