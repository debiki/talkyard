
declare namespace debiki2 {

  var Input;

  namespace utils {
    var PatternInput;  // REFACTOR RENAME move to debiki2
    var PageUnloadAlerter;
  }

}


declare namespace debiki2.pagedialogs {

  function openDeletePostDialog(post: Post);
  function openMovePostsDialog(store: Store, post: Post, closeCaller);
  function openSeeWrenchDialog();
  function openShareDialog(post: Post, button);
  function openTagsDialog(store: Store, post: Post);
  function openWikifyDialog(post: Post);

  function getAboutUserDialog();
  function getProgressBarDialog();
}


declare namespace debiki2.edithistory {

  function getEditHistoryDialog();

}


declare namespace debiki2.login {

  function loginIfNeeded(
      loginReason: LoginReason | string, anyReturnToUrl?: string, success?: () => void);

  export function loginIfNeededReturnToAnchor(loginReason: LoginReason | string,
      anchor: string, success: () => void);

  function continueAfterLogin();
  function getLoginDialog();

}


declare namespace debiki2.util {
  var openDefaultStupidDialog;
}

declare namespace debiki2.nopage {
  var NonExistingPage;
}

declare namespace debiki2.createsite {
  var routes;
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
  var routes;
  function openInviteSomeoneDialog(addInvite);
}

declare namespace debiki2.pagetools {
  function getPageToolsDialog();
}
