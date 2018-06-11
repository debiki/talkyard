
/// <reference path="server-vars.d.ts" />
/// <reference path="model.ts" />
/// <reference path="translations.d.ts" />

declare const t: TalkyardTranslations;


// In constants.ts:

declare const ReactCSSTransitionGroup: any;
declare const ReactDOMFactories: any;
declare const createReactClass: any;
declare function reactCreateFactory(x);
declare const rFragment: any;

declare function doNextFrameOrNow(x);
declare function getSetCookie(cookieName: string, value?: string, options?: any): string;
declare const parseQueryString: (s: string) => any;
declare const stringifyQueryString: (s: any) => string;

declare const ReactStartedClass;

declare const EmptyPageId;
declare const FirstSiteId;

declare const NoId;
declare const NoCategoryId;
declare const NoPermissionId;

declare const NoPostId;
declare const TitleNr;
declare const BodyNr: number;
declare const BodyNrStr: string;
declare const FirstReplyNr;

declare let NoUserId;
declare const SystemUserId;
declare const MinMemberId;
declare const LowestAuthenticatedUserId;

declare const MaxGuestId;
declare const UnknownUserId;

declare const ReviewDecisionUndoTimoutSeconds;

declare function makeNoPageData(): MyPageData;
declare function makeAutoPage(): any;

declare const ManualReadMark;
declare const YellowStarMark;
declare const FirstStarMark;
declare const BlueStarMark;
declare const LastStarMark;

declare const MaxNumFirstPosts;

declare const MaxEmailsPerUser;

declare const IgnoreThisError: number;


declare const SiteStatusStrings: string[];


declare const ApiUrlPathPrefix;
declare const UsersRoot;
declare const SearchRootPath;


declare const RoutePathLatest;
declare const RoutePathNew;
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

  let iframeOffsetWinSize;

  function $first(selector: string): HTMLElement;
  function $all(selector: string): HTMLCollectionOf<HTMLElement>;
  function $byId(elemId: string): HTMLElement;
  function $$byClass(className: string): HTMLCollectionOf<Element>;
  const $h: any;

  // React-Router:
  const Router: any;
  const Switch: any;
  const Route: any;
  const Redirect: any;
  function RedirToNoSlash({ path: string });
  function RedirAppend({ path, append });
  var Link; // ReactRouterDOM.Link
  var NavLink; // ReactRouterDOM.NavLink
  function LiNavLink(props, ...contents); // A NavLink in a <li>

  var createComponent: any;       // don't use — I'm renaming to createFactory
  var createClassAndFactory: any; // don't use — I'm renaming to createFactory
  function createFactory(componentDefinition);

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

  namespace topbar {
    function getTopbarHeightInclShadow(): number;
    const TopBar: any;
  }

  // should be moved to inside the editor bundle
  namespace editor {
    var SelectCategoryDropdown;

    // from editor-bundle-not-yet-loaded.ts:
    function toggleWriteReplyToPost(postId: number, inclInReply: boolean, anyPostType?: number);
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
        loginReason: LoginReason | string, anchor: string, success?: () => void, willCompose?: boolean);
    function loginIfNeededReturnToPost(
        loginReason: LoginReason | string, postNr: PostNr, success?: () => void, willCompose?: boolean);
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
  function user_isGone(user: Myself | BriefUser | MemberInclDetails | UserAnyDetails): boolean;

  function uppercaseFirst(text: string): string;
  function firstDefinedOf(x, y, z?): any;
  function isNullOrUndefined(x): boolean;
  function isDefined2(x): boolean;  // = !_.isUndefined
  function nonEmpty(x): boolean;
  function isBlank(x: string): boolean;

  function whenMsToIsoDate(whenMs: number): string;

  var isWikiPost;
  var isStaff;
  var threatLevel_toString;
  var isGuest;
  var user_isGuest;
  function store_nowMs(store: Store): WhenMs;
  function store_maySendDirectMessageTo(store: Store, user: MemberInclDetails): boolean;
  var page_isGroupTalk;
  let store_getUserOrMissing;
  var store_thisIsMyPage;
  var hasErrorCode;
  var page_mayChangeRole;
  var maySendInvites;
  var isMember;
  var userId_isGuest;
  function store_canDeletePage(store: Store): boolean;
  function store_canUndeletePage(store: Store): boolean;
  function store_canPinPage(store: Store): boolean;
  var siteStatusToString;
  var cloneRect;
  var cloneEventTargetRect;

  var linkToPageId;
  var linkToPostNr;
  var linkToNotificationSource;
  var linkToAdminPageAdvancedSettings;
  var linkToRedirToAboutCategoryPage;
  var linkToUserInAdminArea;
  function linkToSendMessage(idOrUsername: UserId | string): string;
  function linkToUserProfilePage(idOrUsername: Myself | User | UserId | string): string;
  function linkToUsersNotfs(userIdOrUsername: UserId | string): string;
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
    var TopicsList;
  }

  namespace page {
    var openNotfsLevelDropdown;
    var Post;
    namespace Hacks {
      function processPosts(startElemId?: string);
    }
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
  var PrimaryLinkButton;
  var ExtLinkButton;
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
