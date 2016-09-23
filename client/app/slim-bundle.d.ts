

declare var ReactSelect; // move to more-bundle.js
declare var React: any;
declare var ReactDOM: any;
declare var ReactCSSTransitionGroup: any;
declare var Router: any;
declare function reactCreateFactory(x);


declare namespace debiki2 {

  var NavLink: any;
  var createComponent: any;
  var createClassAndFactory: any;

  namespace utils {
    var scrollIntoViewInPageColumn;
    var PageUnloadAlerter;
    var makeMountNode;
    var loadDiffMatchPatch;
    var makeHtmlDiff;
    var DropdownModal;
    var FadeInOnClick;
  }

  namespace util {

  }

  namespace help {

  }

  // should be moved to inside the editor bundle
  namespace editor {
    var markdownToSafeHtml: any;
    var SelectCategoryDropdown;
    var PageRoleDropdown;
  }

  var Server: any;
  var StoreListenerMixin: any;
  var ReactActions: any;
  var ReactStore: any;
  var findDOMNode: any;
  var die: any;
  var dieIf: any;
  var scrollToBottom: any;
  var prettyBytes: any;
  var Server: any;
  var reactelements: any;
  var hashStringToNumber: any;
  var getFromLocalStorage: any;
  var putInLocalStorage: any;
  var event_isCtrlEnter: any;
  var page_isPrivateGroup: any;
  var isBlank: any;
  var page_isPrivateGroup: any;

  var isWikiPost;
  var isStaff;
  var threatLevel_toString;
  var isGuest;
  var me_maySendDirectMessageTo;
  var page_isGroupTalk;
  var store_thisIsMyPage;
  var hasErrorCode;
  var page_mayChangeRole;
  var maySendInvites;
  var isMember;
  var userId_isGuest;
  var store_canDeletePage;
  var store_canUndeletePage;

  var linkToNotificationSource;
  var linkToAdminPageAdvancedSettings;
  var linkToRedirToAboutCategoryPage;
  var linkToUserInAdminArea;

  var anyForbiddenPassword;

  var avatar;

  // Later: move to more-bundle.js
  namespace notification {
    var Notification;
  }
  namespace edithistory {

  }
  namespace help {

  }
  namespace pagedialogs {
    var getServerErrorDialog;
  }

  namespace notification {
    var Notification;
    var NotfLevelButton;
  }
  var SelectCategoryDropdown: any;
  var PageRoleDropdown: any;

  // From widgets.ts:
  var PrimaryButton;
  var Button;
  var InputTypeSubmit; // could move to more-bundle.js, but is just 1 line
  var MenuItem;
  var MenuItemLink;
  var MenuItemDivider;

  // More stuff, place where?
  //namespace reactelements {
  //  var NameLoginBtns;
  //}

}

// vim: et ts=2 sw=2 fo=r list
