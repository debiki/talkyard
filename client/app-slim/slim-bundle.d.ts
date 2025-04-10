
/// <reference path="model.ts" />
/// <reference path="translations.d.ts" />
/// <reference path="../reactjs-types.ts" />

declare const t: TalkyardTranslations;

declare const Bliss: any;

// Legacy:
declare const debiki: {
  currentYear: Nr,
  prettyDuration: (thenMs: Date | Nr, nowMs: Date | Nr) => St,
  prettyLetterDuration: (thenOrDurationMs: Date | Nr, nowMs?: Date | Nr) => St,
  v0: {
    util: Ay,
  },
  internal: Ay,
  mentionsServerHelp: Ay,
};

declare const talkyard: {
  postElemPostProcessor?: Ay,
}


declare const eds: ServerVars;


// In constants.ts:

declare const ReactDOMFactories: any;

declare function createReactClass<P, S = {}>(spec: React.ComponentSpec<P, S>):
    React.ClassicComponentClass<P>;

declare function reactCreateFactory(x);

// React.Fragment
declare const rFragment: any;  // soo long! CLEAN_UP REMOVE
declare const rFr: any;      // better

declare function doNextFrameOrNow(x);

declare function getSetCookie(cookieName: string, value?: string, options?: any): string | null;
declare function getCookie(cookieName: St): St | N
declare function getXsrfCookie(): St | N

declare const parseQueryString: (s: St) => UrlParamsMap;
declare const stringifyQueryString: (s: UrlParamsMap) => St;

declare const ReactStartedClass: string;

declare const TooHighNumber: number;

declare const EmptyPageId: PageId;
declare const FirstSiteId: SiteId;

declare const NoId: number; // ?? won't work for page id
declare const NoCategoryId: CategoryId;
declare const NoPermissionId: number;

declare const NoPostId: PostId;
declare const TitleNr: PostNr;
declare const BodyNr: PostNr;
declare const BodyNrStr: string;
declare const FirstReplyNr: PostNr;
declare const NoDraftNr: number;

declare let NoUserId: UserId;
declare const SystemUserId: UserId;
declare const MinMemberId: UserId;
declare const LowestAuthenticatedUserId: UserId;
declare const LowestNormalMemberId: UserId;
declare const MaxUsernameLength: number;

declare const MaxGuestId: UserId;
declare const UnknownUserId: UserId;

declare const ReviewDecisionUndoTimoutSeconds: number;

declare const ManualReadMark;
declare const YellowStarMark;
declare const FirstStarMark;
declare const BlueStarMark;
declare const LastStarMark;

declare const MaxNumFirstPosts: number;

declare const MaxEmailsPerUser: number;

declare const IgnoreThisError: number;
declare const UseBeacon: string;


declare const SiteStatusStrings: string[];


declare const ApiUrlPathPrefix: string;
declare const UsersRoot: string;
declare const GroupsRoot: string;
declare const SearchRootPath: string;
declare const AdminRoot: string;
declare const AdminUsersRoot: St;


declare const RoutePathLatest: string;
declare const RoutePathNew: string;
declare const RoutePathTop: string;
declare const RoutePathCategories: string;


declare const ImpersonationCookieName: string;


declare const UseWideForumLayoutMinWidth: number;
declare const UseWidePageLayoutMinWidth: number;
declare const WatchbarWidth: number;
declare const ContextbarMinWidth: number;

declare const ServerSideWindowWidth: number;

declare const FragActionAndReplyToPost: string;
declare const FragActionAndEditPost: string;
declare const FragActionHashComposeTopic: string;
declare const FragActionHashComposeMessage: string;
declare const FragActionHashScrollLatest: string;


declare namespace ed {
  namespace editor {
    namespace CdnLinkifyer {
      function replaceLinks(md: any): void;
    }
  }
}


// prelude.ts:

declare function isServerSide(): Bo;
declare function isSelfHosted(): Bo;
declare function isAutoTestSite(): Bo;


// In other files:

declare namespace debiki2 {

  // Log error, warning, message, debug, trace.
  function logE(message: string, ex?);
  function logW(message: string, ex?);
  function logM(message: string, ex?);
  function logD(message: string, ex?);
  function logT(message: string, ex?);

  function win_isLoginPopup(): Bo;
  function getMainWin(): MainWin;
  function win_getSessWinStore(): SessWinStore;
  function win_canUseCookies(win: MainWin): boolean;

  function getNowMs(): WhenMs;
  function getNowMins(): WhenMins;

  let iframeOffsetWinSize;

  function firstToLower(text: St, doIt?: Bo): St;
  function oneIfDef(x: any): number;

  function elm_isBtn(elm: HTMLElement | EventTarget): Bo;
  function $first(selector: string): HTMLElement;
  function $all(selector: string): HTMLCollectionOf<HTMLElement>;
  function $byId(elemId: string): HTMLElement;
  function $$byClass(className: string): HTMLCollectionOf<Element>;
  const $h: any;

  function flashPostNrIfThere(nr: PostNr);

  // React-Router:
  const Router: any;
  const Switch: any;
  const Route: any;
  const Redirect: any;
  function RedirPath(props: RedirPathProps);
  function RedirToNoSlash({ path: string });
  function RedirAppend({ path, append });
  var Link; // ReactRouterDOM.Link
  var NavLink; // ReactRouterDOM.NavLink
  function LiNavLink(props, ...contents); // A NavLink in a <li>
  function LiExtLink(props, ...contents); // An <a href=...> in a <li>

  function Tag(ps: { tag?: Tag, tagType: TagType, canEdit?: Bo,
      onClickDropdown?: Bo, me: Me }): RElm;
  function tag_getVal(tag: Tag, tagType: TagType): Nr | St | U;

  var createComponent: any;       // don't use — I'm renaming to createFactory
  var createClassAndFactory: any; // don't use — I'm renaming to createFactory
  function createFactory<P, S = any>(compSpec: React.ComponentSpec<P, S>): React.Factory<any>;

  // (Move to obj_* elsewhere in this file?)
  function arr_replaceMany<Item>(arr: Item[],
        newerItems: Item[], isSame: ArrItemIsSameFn<Item>): Item[];

  function arr_replaceManyInPl<Item>(arr: Item[],
        newerItems: Item[], isSame: ArrItemIsSameFn<Item>);

  function arr_replaceOneInPl<Item>(arr: Item[],
        newerItem: Item, isSame: ArrItemIsSameFn<Item>);

  function replaceById(itemsWithId: any[], replacement);
  function deleteById(itemsWithId: any[], id);
  function url_getHost(url: St): St;
  function arr_concat<V>(a: V[] | NU, b: V[] | NU): V[];
  function arr_sortAlphaInPlace<V>(vs: V[], strFn: (v: V) => St);

  namespace notfs {
    function PageNotfPrefButton(props: {
        className?: St,
        target: PageNotfPrefTarget, store: Store, ownPrefs: OwnPageNotfPrefs,
        ppsById?: { [ppId: number]: Participant },
        saveFn?: (notfLevel: PageNotfLevel) => void });
  }

  namespace utils {
    function makeShowPostFn(currentPostNr: PostNr, postToShowNr: PostNr);
    var scrollIntoViewInPageColumn;
    function makeMountNode();
    var DropdownModal;
    var ModalDropdownButton;
    var FadeInOnClick;
    function FadeGrowIn(props: {}, content, c2?, c3?): any;

    function maybeRunTour(tour: TalkyardTour);
  }

  namespace util {
    // var ExplainingListItem;
    function ExplainingListItem(props: ExplainingListItemProps): RElm;
  }

  namespace help {
    var HelpMessageBox;
    function isHelpMessageClosedAnyVersion(store: Store, messageId: string): boolean;
    function getServerAnnouncements(store: Store): RElm;
    function anyMaintMsg(): RElm | N;
  }

  namespace topbar {
    function getTopbarHeightInclShadow(): number;
    function TopBar(props): RElm; // TopbarProps
    function OpenWatchbarButton(): RElm;
  }

  namespace sidebar {
    const contextBar: {
      closeSidebar: () => void;
      openSidebar: () => void;
      showAdminGuide: () => void;
      showUsers: () => V;
      highligtDuringMillis: (ms: Nr) => V;
    }
  }

  // should be moved to inside the editor bundle
  namespace editor {
    var SelectCategoryDropdown;

    // from editor-bundle-not-yet-loaded.ts:
    function toggleWriteReplyToPostNr(postNr: PostNr, inclInReply: boolean, anyPostType?: number);
    function openToEditPostNr(postNr: PostNr, onDone?);
    function editNewForumPage(category: RefOrId, role: PageRole);
    function openToEditChatTitleAndPurpose();
    function openToWriteChatMessage(text: string, onDone);
    function openToWriteMessage(userId: UserId);
  }

  namespace login {
    var anyContinueAfterLoginCallback;
    function continueAfterLogin(anyReturnToUrl?: string);
    function loginIfNeededReturnToAnchor(
        loginReason: LoginReason, anchor: St, success?: () => Vo, willCompose?: Bo);
    function loginIfNeededReturnToPost(
        loginReason: LoginReason, postNr: PostNr, success?: () => Vo, willCompose?: Bo);

    function loginIfNeeded(loginReason: LoginReason, pathOrHash: St, onOk?: () => V);
    function openLoginDialogToSignUp(purpose);
    function openLoginDialog(purpose);

    function makeSsoUrl(store: Store, returnToUrl: St, returnToUrl_legacy?: St | N,
          forTySsoTest?: true): St;
    function getOrCreateAuthnNonce(): [St, Bo];
    function getAuthnNonce(): St;
  }

  function reactGetRefRect(ref): Rect;
  var Server: any;
  var StoreListenerMixin: any;

  // Currenty read-only (never call the returned 'setState'). Instead, ...
  function useStoreState(): [Store, () => void];
  function useStoreEvent(listener: (patch: StorePatch) => V, dependencies: any[]);
  function usePostList(): [PostWithPage[] | N | false, (posts: PostWithPage[]) => V];
  // ... use ReactActions to update the store. For now. Would want to remove ReactActions,
  // and use only hooks instead? [4WG20ABG2]
  var ReactActions: any;

  var ReactStore: any;

  var findDOMNode: any;
  function randomNumSt(): St;
  function die(errMsg: St);
  function dieIf(test, errMsg: St);
  function scrollToBottom(node: Element);
  function prettyBytes(num: Nr): St;
  var Server: any;
  var reactelements: any;
  function hashStringToNumber(string: St): Nr;
  function urlEncodeSearchQuery(query: St): St;

  function stableStringify(obj: any): string;

  function canUseLocalStorage(): boolean;
  function putInLocalStorage(key: any, value: any);
  function putInSessionStorage(key: any, value: any);
  function getFromLocalStorage(key: any): any;
  function getFromSessionStorage(key: any): any;
  function removeFromLocalStorage(key);
  function removeFromSessionStorage(key);

  namespace BrowserStorage {
    function get(key: any): any;
    function set(key: any, value: any): any;
    function remove(key: any): any;
    function forEachDraft(pageId: PageId, fn: (draft: Draft, keyStr: string) => void);
  }

  function event_isCmdShiftClick(event): Bo;
  function event_isCtrlEnter(event): boolean;
  function event_isEscape(event): boolean;
  function event_isSpace(event): Bo;
  function page_isOpenChat(pageRole: PageRole): Bo;
  function page_isChat(pageRole: PageRole): boolean;
  function page_isPrivateGroup(pageRole: PageRole): boolean;
  function pageRole_iconClass(pageRole: PageRole): string;

  function me_hasSid(): Bo;
  function me_uiPrefs(me: Myself): UiPrefs;
  function pp_snoozeLeftMs(me: Myself): number;
  function member_isBuiltIn(member: Member): boolean;
  function user_isSuspended(user: UserInclDetails, nowMs: WhenMs): boolean;
  function pat_isBanned(user: Pat): Bo;
  function user_threatLevel(user: UserInclDetails): ThreatLevel;
  function user_trustLevel(user: Myself | UserInclDetails): TrustLevel;
  function user_isGone(user: Myself | BriefUser | UserInclDetails | ParticipantAnyDetails): boolean;

  function uppercaseFirst(text: string): string;
  function firstDefinedOf(x, y, z?): any; // RENAME QUICK to firstDefOf, next line.
  function firstDefOf<T>(x: T | U, y: T | U, z?: T | U): T | U;
  function firstValOf<T>(x: T | NU, y: T | NU, z?: T | NU, w?: T | NU): T | NU;
  // Renaming from...
  function groupByKeepOne<V>(vs: V[], fn: (v: V) => number): { [key: number]: V };
  // ...to:
  function arr_groupByKeepOne<Va>(vs: Va[], fn: (v: Va) => Nr): { [key: Nr]: Va };
  function arr_toMapKeepOne<It, Va>(items: It[], fn: (item: It, ix: Ix) => [St | Nr, Va]);
  function isNullOrUndefined(x): boolean;  // REMOVE  use  notVal(x)  instead
  function isVal(x): Bo;
  function notVal(x): Bo;
  function isDefined2(x): boolean;  // = !_.isUndefined  REMOVE
  function isDef(x): boolean;  // = !_.isUndefined
  function notDef(x): boolean;  // = _.isUndefined
  function nonEmpty(x): boolean;
  function isNum(value): Bo;
  function asIntOrNull(v: StV): Nr | Nl;
  function asFloatOrNull(v: StV): Nr | Nl;
  function isNumGeZ(value: St): Bo;
  function isDigitsOnly(maybeDigits: string): boolean;
  function prettyNum(num: number, digits?: Nr): number;
  function isBlank(x: string): boolean;

  function any_isDeepEqIgnUndef(a: any, b: any): Bo;
  function obj_isDeepEqIgnUndef(a: Object, b: Object): Bo;

  function whenMsToIsoDate(whenMs: WhenMs): string;

  function seemsSelfHosted(): boolean;
  function isInSomeEmbCommentsIframe(): boolean;
  function isBlogCommentsSite(): boolean;
  function isCommunitySite(): boolean;

  var isWikiPost;
  var isStaff;
  function user_isTrustMinNotThreat(me: UserInclDetails | Myself, trustLevel: TrustLevel): boolean;
  //function threatLevel_toString(threatLevel: ThreatLevel): [St, St];
  function threatLevel_toElem(threatLevel: ThreatLevel);
  function persMode_toStr(mode: PersonaMode, verb: Verbosity): St;
  function pat_name(pat: Me | Pat | LazyCreatedAnon | NewAnon): St;
  function pat_isMe(pat: UserInclDetails | Me | Pat | PatId): pat is Me;
  function pat_isMember(pat: UserInclDetails | Me | Pat | PatId): Bo;
  function me_isPageMember(me: Me, page: Page): Bo;  // change to `pat_isPageMember`?
  var isGuest;
  function pat_isGuest(pat: UserInclDetails | Me | Pat): Bo;
  function user_isGuest(pat: UserInclDetails | Me | Pat): Bo;
  function pat_isSys(pat: Pat): Bo;
  function pat_isStaff(pat: Me | Pat): Bo;
  function user_isStaffOrCoreMember(pat: Me | UserInclDetails): Bo;
  function store_maySendDirectMessageTo(store: Store, user: UserInclDetails): boolean;
  function pat_isBitAdv(pat: PatVb | Me): Bo;
  function pat_isMoreAdv(pat: PatVb | Me): Bo;
  function anonStatus_toStr(anonStatus: AnonStatus, verb?: Verbosity): St;
  var page_isGroupTalk;

  function pat_isAuthorOf(pat: Me | Pat, post: Post, patsById: PpsById): Bo;

  function store_getAuthorOrMissing(store: DiscStore, post: Post): Pat;
  function store_getUserOrMissing(store: DiscStore, userId: PatId, errorCode2?: St): Pat;
  function store_thisIsMyPage(store: DiscStore): Bo;
  function disc_findMyPersonas(discStore: DiscStore, ps: {
                forWho: Pat | Me | U, startAtPostNr?: PostNr }): MyPersonasThisPage;

  function findPersonaOptions(ps: { myPersonasThisPage?: MyPersonasThisPage, me: Me,
        discProps: DiscPropsDerived }): PersonaOptions;
  function patToMaybeAnon(p: Pat | KnownAnonym | NewAnon, me: Me): MaybeAnon;

  function draftType_toPostType(draftType: DraftType): PostType | U;
  function postType_toDraftType(postType: PostType): DraftType | U;
  function store_findTheDefaultCategory(store: Store): Category | U;
  function store_findCatByRefOrId(store: Store, ref: RefOrId): Category | U;
  function store_ancestorCatsCurLast(store: Store, categoryId: CatId): Cat[];
  function store_findCatsWhereIMayCreateTopics(store: Store): Category[];
  function store_getPostId(store: DiscStore, pageId: PageId, postNr: PostNr): PostId | U;

  function categories_sortTree(categories: Category[]): CatsTree;

  function makeNoPageData(): MyPageData;
  function makeAutoPage(pageId?: PageId): Page;

  function store_curPage(store: Store): Page | U;

  function page_makePostPatch(page: Page, post: Post): StorePatch;
  function store_makeDraftPostPatch(store: Store, page: Page, draft: Draft): StorePatch;

  function post_makePreviewIdNr(parentPostNr: PostNr, newPostType: PostType): PostNr & PostId;

  function store_makeNewPostPreviewPatch(
      store: Store, page: Page, parentPostNr: PostNr, safePreviewHtml: string,
      newPostType?: PostType, doAsAnon?: MaybeAnon): StorePatch;
  function store_makeEditsPreviewPatch(
      store: Store, page: Page, post: Post, safePreviewHtml: string): StorePatch;
  function store_makeDeletePreviewPostPatch(
      store: Store, parentPostNr: PostNr, newPostType?: PostType): StorePatch;

  var hasErrorCode;
  var page_mayChangeRole;
  function page_canToggleClosed(page: Page): boolean;
  function store_maySendInvites(store: Store, user: Myself | UserInclDetails): MayMayNot;
  var isMember;
  var userId_isGuest;
  function store_isFeatFlagOn(store: Store, featureFlag: St, defaultOn?: Bo): Bo;
  function isNoPage(pageId: PageId): Bo;
  function store_isPageDeleted(store: Store): boolean;
  function page_isAncCatDeld(page: Page): Bo;
  function store_canDeletePage(store: Store): boolean;
  function store_canUndeletePage(store: Store): boolean;
  function store_canPinPage(store: Store): boolean;

  function siteStatusToString(siteStatus: SiteStatus);
  var cloneRect;
  var cloneEventTargetRect;

  function perms_join(pA: PermsOnPage, pB: PermsOnPageNoIdOrPp | U): PermsOnPageNoIdOrPp;

  function origin(): string;
  function linkToPageId(pageId: PageId): string;
  function linkToPostNr(pageId: PageId, postNr: PostNr): string;
  function linkToPost(post: PostWithPageId): St;
  function linkToType(type: TagType): St;
  function linkToDraftSource(draft: Draft, pageId?: PageId, postNr?: PostNr): string;
  function linkToNotificationSource(notf: Notification): string;
  function linkToAdminPageAdvancedSettings(hostname?: string): string;
  function linkToRedirToAboutCategoryPage(categoryId: CategoryId): string;
  function linkToCat(cat: Cat): St;
  function linkToUserInAdminArea(user: Myself | UserInclDetails | Participant | UserId): string;
  function linkToSendMessage(idOrUsername: UserId | string): string;
  function linkToUserInAdminArea(userId: UserId): string;

  // Don't use:
  function linkToUserProfilePage(idOrUsername: Myself | Participant | UserId | string): string;
  function pathTo(user: Participant | Myself | UserId | string): string;
  // Use instead, better name:
  function linkToPatsProfile(who: Who): St;

  function linkToUsersNotfs(who: Who): string;
  function linkToMembersNotfPrefs(userIdOrUsername: UserId | string): string;
  function linkToSendMessage(userIdOrUsername: UserId | string): string;
  function linkToInvitesFromUser(userId: UserId): string;
  function linkToUsersEmailAddrs(userIdOrUsername: UserId | string): string;
  function linkToPatsPrivPrefs(who: Who): St;
  function linkToPatsUiPrefs(who: Who): St;
  function linkToAdminPage(): string;
  function linkToAdminPageLoginSettings(): string;
  function linkToAdminPageFeatures(): St;
  function linkToAdminApi(): string;
  function linkToAdminPageModerationSettings(): string;
  function linkToAdminPageEmbeddedSettings(): string;
  function linkToReviewPage(): string;
  function linkToStaffInvitePage(): string;
  function linkToInspect(what: 'priv-prefs'): St;
  function externalLinkToAdminHelp(): string;
  function linkToGroups(): string;
  function linkToMyDraftsEtc(store: Store): string;
  function linkToMyProfilePage(store: Store): string;
  function linkToUpload(origins: Origins, uploadsPath: string): string;
  function linkToResetPassword(): string;

  var anyForbiddenPassword;

  function tags_mkSortFn(tagTypesById: TagTypesById): (a: Tag, b: Tag) => Nr;

  function isSection(pageRole: PageRole): boolean;
  function page_unsafeTitle(page: Page): St | U;
  function page_isClosedUnfinished(page: Page): Bo;
  function page_isDone(page: Page | Topic): Bo;
  function page_canBeDone(page: Page | Topic): Bo;
  function page_isSolved(page: Page | Topic): Bo;
  function page_canBeSolved(page: Page | Topic): Bo;
  function page_canChangeCategory(page: Page): boolean;
  function page_mostRecentPostNr(page: Page): number;

  function node_deriveLayout(props: DiscLayoutDropdownBtnProps): NodePropsDerivedAndDefault;
  function discProps_pluckFrom(source: DiscPropsSource): DiscPropsSource;
  function page_deriveLayout(page: PageDiscPropsSource, store: DiscStore, layoutFor: LayoutFor): DiscPropsDerived;
  function cat_deriveLayout(cat: Cat, store: DiscStore, layoutFor: LayoutFor): DiscPropsDerived;

  function settings_showCategories(settings: SettingsVisibleClientSide, me: Myself): boolean;
  function settings_showFilterButton(settings: SettingsVisibleClientSide, me: Myself): boolean;
  function settings_showTopicTypes(settings: SettingsVisibleClientSide, me: Myself): boolean;
  function settings_selectTopicType(settings: SettingsVisibleClientSide, me: Myself): boolean;


  function timeExact(whenMs: number, clazz?: string);

  namespace avatar {
    function Avatar(props: AvatarProps): RElm;
  }

  function pageNotfPrefTarget_findEffPref(target: PageNotfPrefTarget, store: Store, ownPrefs: OwnPageNotfPrefs): EffPageNotfPref;
  function notfPref_title(notfPref: EffPageNotfPref): string;
  function notfLevel_descr(notfLevel: PageNotfLevel, effPref: EffPageNotfPref, ppsById: PpsById): any;
  function makeWhyNotfLvlInheritedExpl(effPref: EffPageNotfPref, ppsById: PpsById);

  function emailPref_title(emailNotfPref: EmailNotfPrefs): RElm | St;
  function emailPref_descr(emailNotfPref: EmailNotfPrefs): RElm | St;

  namespace edithistory {

  }
  namespace help {

  }

  namespace forum {
    var TopicsList;
  }

  namespace page {
    function Post(props: PostProps): RElm;
    function PostBody(props: PostProps): RElm;
    function CatsOrHomeLink(ps: { page: PageTypeAncestors,
          store: Store, forTopbar?: Bo, skipHome?: true }): RElm | N;
    namespace Hacks {
      function navigateTo(path: St): V;
      function processPosts(startElemId?: string);
    }
  }
  namespace pagedialogs {
    function getServerErrorDialog(): any;
    function showClientError(errorMessage: St);
    function showAndThrowClientSideError(errorMessage: St);
    var openSharePopup;
    const Facebook;
    const Twitter;
    const Google;
    const LinkedIn;
    const Email;
  }

  namespace widgets {
    function openAssignToDiag(post: Post, store: Store, onOk?: () => Vo);
    function DiscLayoutDropdownBtn(props: DiscLayoutDropdownBtnProps);
    function comtOrder_title(comtOrder: PostSortOrder): St;
    //function comtOrder_descr — is in the more-bundle
  }

  var SelectCategoryDropdown: any;

  // From widgets.ts:
  var OnlyAdminsSee;
  var PrimaryButton;
  var Button;
  var PrimaryLinkButton;
  function ExtVerbLink(url: St): RElm;
  var ExtLinkButton;
  var LinkUnstyled;
  var LinkButton;
  var InputTypeSubmit; // could move to more-bundle.js, but is just 1 line
  var MenuItem;
  var MenuItemLink;
  var MenuItemsMany;
  var MenuItemDivider;

  function UserNameLink(props: {
      user: Pat, store: Store, onClick?: Ay, avoidFullName?: Bo });

  function UserName(props: {
      user?: Pat, patId?: PatId, // either or
      store?: Store, settings?: SettingsVisibleClientSide,
      makeLink?: Bo, onClick?: Ay, avoidFullName?: Bo,
      key?: St | Nr });

  function TagListLive(ps: TagListLiveProps): RElm | U;
  function TagList(ps: TagListProps): RElm | U;

  var FacebookLogoImage;

  // More stuff, place where?
  //namespace reactelements {
  //  var NameLoginBtns;
  //}

  // From oop-methods.ts:
  function userStats_totalNumPosts(stats: UserStats | NU): Nr | N;
  function userStats_totalNumPostsRead(stats: UserStats | NU): Nr | N;
  function trustLevel_toString(trustLevel: TrustLevel | TrustLevelOrStaff): St;

}

// vim: et ts=2 sw=2 fo=r list
