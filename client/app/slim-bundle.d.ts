

declare var React: any;
declare var ReactDOM: any;
declare var ReactCSSTransitionGroup: any;
declare var Router: any;
declare function reactCreateFactory(x);
declare function doNextFrameOrNow(x);


declare namespace debiki2 {

  // ReactRouter:
  var Route;
  var IndexRoute;
  var Redirect;
  var DefaultRoute;

  var Link; // ReactRouter.Link
  var NavLink: any;
  var createComponent: any;
  var createClassAndFactory: any;

  namespace utils {
    var scrollIntoViewInPageColumn;
    var makeMountNode;
    var DropdownModal;
    var ModalDropdownButton;
    var FadeInOnClick;
  }

  namespace util {
    var ExplainingListItem;
  }

  namespace help {
    var HelpMessageBox;
    function isHelpMessageClosedAnyVersion(store: Store, messageId: string): boolean;
  }

  // should be moved to inside the editor bundle
  namespace editor {
    var markdownToSafeHtml: any;
    var SelectCategoryDropdown;

    // from editor-bundle-not-yet-loaded.ts:
    function toggleWriteReplyToPost(postId: number, anyPostType?: number);
    function openEditorToEditPost(postId: number, onDone?);
    function editNewForumPage(categoryId: number, role: PageRole);
    function openToEditChatTitleAndPurpose();
    function openToWriteChatMessage(text: string, onDone);
    function openToWriteMessage(userId: number);
  }

  function reactGetRefRect(ref): Rect;
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
  var page_isPrivateGroup: any;
  function pageRole_iconClass(pageRole: PageRole): string;

  function firstDefinedOf(x, y, z?): any;
  function isNullOrUndefined(x): boolean;
  function isDefined2(x): boolean;
  function nonEmpty(x): boolean;
  function isBlank(x: string): boolean;

  var isWikiPost;
  var isStaff;
  var threatLevel_toString;
  var isGuest;
  var user_isGuest;
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
  function store_canPinPage(store: Store);
  var trustLevel_toString;
  var siteStatusToString;
  var cloneRect;

  var linkToPageId;
  var linkToPostNr;
  var linkToNotificationSource;
  var linkToAdminPageAdvancedSettings;
  var linkToRedirToAboutCategoryPage;
  var linkToUserInAdminArea;
  var linkToUserProfilePage;
  var linkToAdminPage;
  var linkToReviewPage;
  var externalLinkToAdminHelp;
  var linkToMyProfilePage;

  var anyForbiddenPassword;

  namespace avatar {
    var Avatar;
  }

  // should move to more-bundle.js.
  var notfLevel_title;

  namespace edithistory {

  }
  namespace help {

  }

  namespace forum {
    var ListTopicsComponent;
  }

  namespace page {
    var openNotfsLevelDropdown;
    var Post;
  }
  namespace pagedialogs {
    var getServerErrorDialog;
  }

  var SelectCategoryDropdown: any;

  // From widgets.ts:
  var PrimaryButton;
  var Button;
  var LinkButton;
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
