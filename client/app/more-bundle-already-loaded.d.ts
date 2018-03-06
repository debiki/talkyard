
declare namespace rb {
  var ReactBootstrap;
  var Modal;
  var ModalHeader;
  var ModalTitle;
  var ModalBody;
  var ModalFooter;

  var TabbedArea;
  var TabPane;
  var Alert;
  var ProgressBar;

  var Expandable;
}


declare namespace debiki2 {

  var Input;

  namespace forum {
    function getEditCategoryDialog(handler: (dialog) => void);
  }

  namespace utils {
    var PatternInput;  // REFACTOR RENAME move to debiki2
    var PageUnloadAlerter;
  }

  namespace util {
    function makeStupidDialogGetter();
    function makeResizableUp(elem, handle, onResize);
  }

  namespace topbar {
    function openMyMenu(store, where);
  }

  namespace editor {
    var PageRoleDropdown;
  }

  namespace search {
    function searchRoute(): any;
    function urlEncodeSearchQuery(query: string): string;
  }

  namespace help {
    function openHelpDialogUnlessHidden(message);
  }
}


declare namespace debiki2.pagedialogs {

  function openAddPeopleDialog();
  function openDeletePostDialog(post: Post);
  function openFlagDialog(postId: PostId);
  function openMovePostsDialog(store: Store, post: Post, closeCaller);
  function openSeeWrenchDialog();
  function openShareDialog(post: Post, button);
  function openTagsDialog(store: Store, post: Post);
  function openWikifyDialog(post: Post);
  function openLikesDialog(post: Post, voteType: PostVoteType, at)

  function getAboutUserDialog();
  function getProgressBarDialog();
}

declare namespace debiki2.subcommunities {
  function joinOrCreateSubCommunity(store: Store);
}

declare namespace debiki2.edithistory {

  function getEditHistoryDialog();

}


declare namespace debiki2.login {

  function loginIfNeeded(
      loginReason: LoginReason | string, anyReturnToUrl?: string, success?: () => void,
      willCompose?: boolean);

  function getLoginDialog();

}


declare namespace debiki2.util {
  var openDefaultStupidDialog;
}

declare namespace debiki2.nopage {
  var NonExistingPage;
}

declare namespace debiki2.tags {
  var routes;
}

declare namespace debiki2.titleeditor {
  var TitleEditor;
}
declare namespace debiki2.help {
}

declare namespace debiki2.forum {
  function openEditIntroDialog();
}

declare namespace debiki2.users {
  function usersRoute();
  var InviteRow;
  function openInviteSomeoneDialog(addInvite);
}

declare namespace debiki2.pagetools {
  function getPageToolsDialog();
}
