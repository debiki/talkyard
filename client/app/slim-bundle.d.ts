
/// <reference path="model.ts" />

// In constants.ts:

declare const ReactCSSTransitionGroup: any;
declare const Router: any;
declare function reactCreateFactory(x);
declare function doNextFrameOrNow(x);
declare function getSetCookie(cookieName: string, value?: string, options?: any): string;

declare const ReactStartedClass;

declare const EmptyPageId;
declare const FirstSiteId;

declare const NoId;
declare const NoCategoryId;
declare const NoPermissionId;

declare const NoPostId;
declare const TitleNr;
declare const BodyNr;
declare const FirstReplyNr;

declare let NoUserId;
declare const SystemUserId;
declare const MinMemberId;
declare const LowestAuthenticatedUserId;

declare const MaxGuestId;
declare const UnknownUserId;


declare const ManualReadMark;
declare const YellowStarMark;
declare const FirstStarMark;
declare const BlueStarMark;
declare const LastStarMark;

declare const MaxNumFirstPosts;

declare const IgnoreThisError: number;


declare const SiteStatusStrings: string[];


declare const ApiUrlPathPrefix;


declare const RoutePathLatest;
declare const RoutePathTop;
declare const RoutePathCategories;


declare const ImpersonationCookieName;


declare const UseWideForumLayoutMinWidth;
declare const UseWidePageLayoutMinWidth;
declare const WatchbarWidth;
declare const ContextbarMinWidth;

declare const ServerSideWindowWidth;


// In other files:

declare namespace debiki2 {

  function $byId(elemId: string): HTMLElement;
  function $$byClass(className: string): HTMLCollectionOf<Element>;
  const $h: any;

  // ReactRouter:
  var Route;
  var IndexRoute;
  var Redirect;
  var DefaultRoute;

  var Link; // ReactRouter.Link
  var NavLink: any;
  var createComponent: any;
  var createClassAndFactory: any;

  function replaceById(itemsWithId: any[], replacement);
  function deleteById(itemsWithId: any[], id);

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
    function openToWriteMessage(userId: UserId);
  }

  namespace login {
    var anyContinueAfterLoginCallback;
    function continueAfterLogin(anyReturnToUrl?: string);
    function loginIfNeededReturnToAnchor(
        loginReason: LoginReason | string, anchor: string, success: () => void, willCompose?: boolean);
    function loginIfNeededReturnToPost(
        loginReason: LoginReason | string, postNr: PostNr, success: () => void, willCompose?: boolean);
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
  let store_getUserOrMissing;
  var store_thisIsMyPage;
  var hasErrorCode;
  var page_mayChangeRole;
  var maySendInvites;
  var isMember;
  var userId_isGuest;
  var store_canDeletePage;
  var store_canUndeletePage;
  function store_canPinPage(store: Store);
  var siteStatusToString;
  var cloneRect;

  var linkToPageId;
  var linkToPostNr;
  var linkToNotificationSource;
  var linkToAdminPageAdvancedSettings;
  var linkToRedirToAboutCategoryPage;
  var linkToUserInAdminArea;
  function linkToUserProfilePage(idOrUsername: UserId | string);
  function linkToAdminPage(me: Myself): string;
  var linkToReviewPage;
  var externalLinkToAdminHelp;
  var linkToMyProfilePage;

  var anyForbiddenPassword;

  function settings_showCategories(settings: SettingsVisibleClientSide, me: Myself): boolean;
  function settings_showFilterButton(settings: SettingsVisibleClientSide, me: Myself): boolean;
  function settings_showTopicTypes(settings: SettingsVisibleClientSide, me: Myself): boolean;
  function settings_selectTopicType(settings: SettingsVisibleClientSide, me: Myself): boolean;


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
    var openSharePopup;
    const Facebook;
    const Twitter;
    const Google;
    const LinkedIn;
    const Email;
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
  var UserName;

  // More stuff, place where?
  //namespace reactelements {
  //  var NameLoginBtns;
  //}

  // From oop-methods.ts:
  function userStats_totalNumPosts(stats: UserStats): number;
  function userStats_totalNumPostsRead(stats: UserStats): number;
  function trustLevel_toString(trustLevel: TrustLevel): string;

}

// vim: et ts=2 sw=2 fo=r list
