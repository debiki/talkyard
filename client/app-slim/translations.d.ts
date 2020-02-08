// translations.d.ts

/* Bash 'grep' for finding unused translation strings:

echo "Unused translation fields, should be ok to remove:"
all_field_names=$(sed -nr 's/^ +([a-zA-Z0-9_]+): +[^{]+$/\1/p' client/app-slim/translations.d.ts)
for x in $all_field_names; do
  matches=$(egrep -lr "\<t\>[.a-zA-Z_]*\.$x\>" client/);
  if [ -z "$matches" ]; then
    echo "$x"
  fi
done

 * How find *missing* translation strings? VSCode and the Typescript transpiler will
 * show you errors + fail the build for you.
 */


interface TalkyardTranslations {

  // Common words / phrases, to reuse everywhere. Sorted alphabetically.
  Active: string;
  Activity: string;
  Add: string;
  AddingDots: string;
  Admin: string;
  AdvSearch: string;
  Away: string;
  Back: string;
  BlogN: string;
  Bookmarks: string;
  Cancel: string;
  Categories: string;
  Category: string;
  ChangeV: string;
  ClickToShow: string;
  Continue: string;
  ChangeDots: string;
  ChatN: string;
  Chatting: string;
  CheckYourEmail: string;
  Close: string;
  closed: string;
  Created: string;
  Delete: string;
  Deleted: string;
  DirectMessage: string;
  Discussion: string;
  discussion: string;
  done: string;
  EditV: string;
  Editing: string;
  EmailAddress: string;
  EmailAddresses: string;
  EmailSentD: string;
  Forum: string;
  GetNotifiedAbout: string;
  GroupsC: string;
  Hide: string;
  Home: string;
  Idea: string;
  Join: string;
  KbdShrtcsC: string;
  Loading: string;
  LoadMore: string;
  LogIn: string;
  LoggedInAs: string;
  LogOut: string;
  Maybe: string;
  Manage: string;
  Members: string;
  MessageN: string;
  MoreDots: string;
  Move: string;
  Name: string;
  NameC: string;
  NewTopic: string;
  NoCancel: string;
  Notifications: string;
  NotImplemented: string;
  NotYet: string;
  NoTitle: string;
  NoTopics: string;
  Okay: string;
  OkayDots: string;
  Online: string;
  onePerLine: string;
  PreviewV: string;
  Problem: string;
  progressN: string;
  Question: string;
  Recent: string;
  Remove: string;
  Reopen: string;
  ReplyV: string;
  Replying: string;
  Replies: string;
  replies: string;
  Save: string;
  SavingDots: string;
  SavedDot: string;
  Search: string;
  SendMsg: string;
  ShowPreview: string;
  SignUp: string;
  Solution: string;
  started: string;
  Summary: string;
  Submit: string;
  Tag?: string;  // MISSING
  Tags?: string;  // MISSING
  Tools: string;
  Topics: string;
  TopicTitle: string;
  TopicType: string;
  UploadingDots: string;
  Username: string;
  Users: string;
  Welcome: string;
  Wiki: string;
  Yes: string;
  YesBye: string;
  // YesDelete — use t.upp.YesDelete, REFACTOR: move it to here instead
  YesDoThat: string;
  You: string;
  you: string;

  // Trust levels.
  Guest: string;
  NewMember: string;
  BasicMember: string;
  FullMember: string;
  TrustedMember: string;
  RegularMember: string;
  CoreMember: string;

  // Time periods.
  PastDay: string;
  PastWeek: string;
  PastMonth: string;
  PastQuarter: string;
  PastYear: string;
  AllTime: string;

  // Time ago.
  daysAgo: (numDays: number) => string;
  hoursAgo: (numHoursAgo: number) => string;
  minutesAgo: (numMins: number) => string;
  secondsAgo: (numSecs: number) => string;

  // Time letters.
  monthsLtr: string;
  daysLtr: string;
  hoursLtr: string;
  minsLtr: string;
  secsLtr: string;


  // Input fields, e.g. email, name etc.
  inp: {
    // Email address input field:
    EmReq: string;
    NoSpcs: string;
    InvldAddr: string;
    NoBadChrs: string;

    // Full name input field:
    NotOnlSpcs: string;
    NoAt: string;

    // Username input field:
    NoDash: string;
    DontInclAt: string;
    StartEndLtrDgt: string;
    OnlLtrNumEtc: string;
    UnUnqShrt_1: string;
    UnUnqShrt_2: string;
    UnUnqShrt_3: string;

    // Generic messages for all input fields:
    TooShort: (minLength: number) => string;
    TooLong: (maxLength: number) => string;
  },


  // Notification levels.
  nl: {
    EveryPost: string;
    EveryPostInTopic: string;
    EveryPostInCat: string;
    EveryPostInTopicsWithTag: string;
    EveryPostWholeSite: string;
    NewTopics: string;
    NewTopicsInCat: string;
    NewTopicsWithTag: string;
    NewTopicsWholeSite: string;
    Tracking: string;
    Normal: string;
    NormalDescr: string;
    Hushed: string;
    HushedDescr: string;
    Muted: string;
    MutedTopic: string;
  }


  // Forum intro text
  fi: {
    Edit: string;
    Hide_1: string;
    Hide_2: string;
    Hide_3: string;
  },


  // Forum categories
  fcs: {
    All: string; // "All (categories)", shorter than AllCats
  },


  // Forum buttons
  fb: {
    TopicList: string;
    from: String;
    in: String;
    AllCats: string;  // REFACTOR move to  fcs  above
    Active: string;
    ActiveDescr: string;
    New: string;
    NewDescr: string;
    Top: string;
    TopDescr: string;
    AllTopics: string;
    ShowAllTopics: string;
    ShowAllTopicsDescr: string;
    WaitingTopics: string;
    OnlyWaitingDescr_1: string;
    OnlyWaitingDescr_2: string;
    OnlyWaitingDescr_3: string;
    YourTopics: string;
    AssignedToYou: string;
    DeletedTopics: string;
    ShowDeleted: string;
    ShowDeletedDescr: string;
    ViewCategories: string;
    EditCat: string;
    CreateCat: string;
    CreateTopic: string;
    PostIdea: string;
    AskQuestion: string;
    ReportProblem: string;
    CreateMindMap: string;
    CreatePage: string;
  },


  // Forum topics
  ft: {
    ExplIcons: string;
    IconExplanation: string;
    ExplGenDisc: string;
    ExplQuestion: string;
    ExplAnswer: string;
    ExplIdea: string;
    ExplProblem: string;
    ExplPlanned: string;
    ExplDone: string;
    ExplClosed: string;
    ExplPinned: string;

    PopularTopicsComma: string;
    TopFirstAllTime: string;
    TopFirstPastDay: string;

    CatHasBeenDeleted: string;

    TopicsActiveFirst: string;
    TopicsNewestFirst: string;

    CreatedOn: string;
    LastReplyOn: string;
    EditedOn: string;

    createdTheTopic: string;
    frequentPoster: string;
    mostRecentPoster: string;

    inC: string;

    TitleFixed: string;
    TitleDone: string;
    TitleStarted: string;
    TitleStartedFixing: string;
    TitleUnsolved: string;
    TitleIdea: string;
    TitlePlanningFix: string;
    TitlePlanningDo: string;
    TitleChat: string;
    TitlePrivateChat: string;
    TitlePrivateMessage: string;
    TitleInfoPage: string;
    TitleDiscussion: string;
    IsPinnedGlobally: string;
    IsPinnedInCat: string;
  },


  // Forum categories
  fc: {
    RecentTopicsWaiting: string;
    RecentTopicsInclDel: string;
    RecentTopics: string;
    _replies: string;
    _deleted: string;
    _defCat: string;
  },


  // Topbar
  tb: {
    RecentPosts: string;
    NumOnlChat: string;
    NumOnlForum: string;
    WatchbBtn: string;
    WatchbToolt: string;
    AbtUsr: string;
    BackFromUsr: string;
    BackFromAdm: string;
    SearchPg: string;
  },


  // Watchbar
  wb: {
    AddCommunity: string;
    RecentlyViewed: string;
    JoinedChats: string;
    ChatChannels: string;
    CreateChat: string;
    DirectMsgs: string;
    NoChats: string;
    NoDirMsgs: string;

    // The click-topic dropdown menu:
    TopicActions: string;
    ViewPeopleHere: string;
    ViewAddRemoveMembers: string;
    ViewChatMembers: string;
    EditChat: string;
    LeaveThisChat: string;
    LeaveThisCommunity: string;
    JoinThisCommunity: string;
  },


  // Contextbar
  cb: {
    RecentComments: string;
    NoComments: string;

    YourBookmarks: string;

    UsersOnline: string;
    UsersOnlineForum: string;
    UsersInThisChat: string;
    UsersInThisTopic:  string;

    GettingStartedGuide: string;
    AdminGuide: string;
    Guide: string;

    CloseShortcutS: string;

    AddPeople: string;

    thatsYou: string;
    OnlyYou: string;
    YouAnd: string;
    NumStrangers: (numStrangers: number) => string;

    RepliesToTheLeft: string;
    bestFirst: string;
    ButBelow: string;
    insteadBy: string;
    newestFirst: string;

    SoIfLeave: string;
    allNewReplies: string;
    Click: string;
    aReplyToReadIt: string;
  },


  // Metabar
  mb: {
    NotfsAbtThisC: string;
    Msg: string;
    SmrzRepls: string;
    EstTime: (numReplies: number, minutes: number) => string;
    DoneSummarizing: (numSummarized: number, numShownBefore: number) => string;
  },


  // Post actions
  pa: {
    CloseTopic?: string;
    CloseOwnQuestionTooltip: string;
    CloseOthersQuestionTooltip: string;
    CloseToDoTooltip: string;
    CloseTopicTooltip: string;

    AcceptBtnExpl: string;
    SolutionQ: string;
    ClickUnaccept: string;
    PostAccepted: string;

    NumLikes: (num: number) => string;
    NumDisagree: (num: number) => string;
    NumBury: (num: number) => string;
    NumUnwanted: (num: number) => string;

    MoreVotes: string;
    LikeThis: string;
    LinkToPost: string;
    Report: string;
    ReportThisPost: string;
    Admin: string;
    DiscIx: string;

    Disagree: string;
    DisagreeExpl: string;
    Bury: string;
    BuryExpl: string;
    Unwanted: string;
    UnwantedExpl: string;

    AddTags: string;
    UnWikify: string;
    Wikify: string;
    PinDeleteEtc: string;
  },

  // Share dialog
  sd: {
    Copied: string;
    CtrlCToCopy: string;
    ClickToCopy: string;
  },


  // Change page dialog
  cpd: {
    ClickToChange: string;
    ClickToViewAnswer: string;
    ViewAnswer: string;
    ChangeStatusC: string;
    ChangeCatC: string;
    ChangeTopicTypeC: string;
  },


  // Page doing status, PageDoingStatus
  pds: {
    aQuestion: string;
    hasAccptAns: string;
    aProblem: string;
    planToFix: string;
    anIdea: string;
    planToDo: string;
  },


  // Discussion / non-chat page
  d: {
    ThisFormClosed_1: string;
    ThisFormClosed_2: string;

    ThisTopicClosed_1: string;
    ThisTopicClosed_2: string;

    ThisPageDeleted: string;
    CatDeldPageToo: string;

    ThreadDeld: string;
    CmntDeld: string;
    PostDeld: string;
    DiscDeld: string;
    PageDeld: string;
    TitlePendAppr: string;
    TextPendingApproval: string;

    TooltipQuestClosedNoAnsw: string;
    TooltipTopicClosed: string;

    TooltipQuestSolved: string;
    TooltipQuestUnsolved: string;

    // RENAME 13? x "Tooltip..." below to "Status*", because now also used
    // in the Change Page dialog (cpd: ).
    // No, instead, remove the "Tooltip" prefix, and
    // move to  "Page doing status"  pds  above?

    StatusDone: string;
    TooltipProblFixed: string;
    TooltipDone: string;

    StatusStarted: string;
    TooltipFixing: string;
    TooltipImplementing: string;

    StatusPlanned: string;
    TooltipProblPlanned: string;
    TooltipIdeaPlanned: string;

    StatusNew: string;
    StatusNewDtl: string;
    TooltipUnsProbl: string;
    TooltipIdea: string;

    TooltipPersMsg: string;
    TooltipChat: string;
    TooltipPrivChat: string;

    TooltipPinnedGlob: string;
    TooltipPinnedCat: string;

    SolvedClickView_1: string;
    SolvedClickView_2: string;

    PostHiddenClickShow: string;
    ClickSeeMoreRepls: string;
    ClickSeeMoreComments: string;
    ClickSeeThisComment: string;
    clickToShow: string;

    ManyDisagree: string;
    SomeDisagree: string;

    CmtPendAppr: string;
    CmtBelowPendAppr: (isYour) => string;

    _and: string;

    repliesTo: string;
    InReplyTo: string;
    YourReplyTo: string;
    YourChatMsg: string;
    YourDraft: string;
    YourEdits: string;
    YourProgrNoteC: string;
    aProgrNote: string;

    ReplyingToC: string;
    ScrollToPrevw_1: string;
    ScrollToPrevw_2: string;

    UnfinEdits: string;
    ResumeEdting: string;
    DelDraft: string;

    ClickViewEdits: string;

    By: string;

    // Discussion ...
    aboutThisIdea: string;
    aboutThisProbl: string;

    AddProgrNote: string;
    // Progress ...
    withThisIdea: string;
    withThisProbl: string;
    withThis: string;
  },


  // Chat
  c: {
    About_1: string;
    About_2: string;
    ScrollUpViewComments: string;
    Purpose: string;
    edit: string;
    delete: string;
    MessageDeleted: string;
    JoinThisChat: string;
    PostMessage: string;
    AdvancedEditor: string;
    TypeHere: string;
  }


  // My Menu
  mm: {
    NeedsReview: string;
    AdminHelp: string;
    StaffHelp: string;
    DraftsEtc: string;
    MoreNotfs: string;
    DismNotfs: string;
    ViewProfile: string;
    ViewGroups: string;
    LogOut: string;
    UnhideHelp: string;
  },


  // Scroll buttons
  sb: {
    ScrollToC: string;
    Scroll: string;
    Back_1: string;
    Back_2: string;
    BackExpl: string;

    PgTop: string;
    PgTopHelp: string;
    Repl: string;
    ReplHelp: string;
    Progr: string;
    ProgrHelp: string;
    PgBtm: string;
    Btm: string;
    BtmHelp: string;

    Kbd_1: string;
    Kbd_2: string;
  },


  // Select users dialog
  sud: {
    SelectUsers: string;
    AddUsers: string;
  },


  // About user dialog
  aud: {
    IsMod: string;
    IsAdm: string;
    IsDeld: string;
    ThisIsGuest: string;
    ViewInAdm: string;
    ViewProfl: string;
    ViewComments: string;
    RmFromTpc: string;
    EmAdrUnkn: string;
  },


  // User's profile page
  upp: {
    // ----- Links

    Preferences: string;
    Invites: string;
    DraftsEtc: string;
    About: string;
    Privacy: string;
    Account: string;
    Interface: string;

    // ----- Overview stats

    JoinedC: string;
    PostsMadeC: string;
    LastPostC: string;
    LastSeenC: string;
    TrustLevelC: string;

    // ----- Action buttons

    // ----- Profile pic

    UploadPhoto: string;
    ChangePhoto: string;
    ImgTooSmall: string;

    // ----- Activity

    OnlyStaffCanSee: string;
    OnlyMbrsCanSee: string;
    Nothing: string;
    Posts: string;
    NoPosts: string;
    Topics: string;
    NoTopics: string;

    // ----- User status

    UserBanned: string;
    UserSuspended: (dateUtc: string) => string;
    ReasonC: string;

    DeactOrDeld: string;
    isGroup: string;
    isGuest: string;
    isMod: string;
    isAdmin: string;
    you: string;

    // ----- Notifications page

    NoNotfs: string;
    NotfsToYouC: string;
    NotfsToOtherC: (name: string) => string;
    DefNotfsSiteWide: string;
    forWho: string;

    // ----- Drafts Etc page

    NoDrafts: string;
    YourDraftsC: string;
    DraftsByC: (name: string) => string;

    // ----- Invites page

    InvitesIntro: string;
    InvitesListedBelow: string;
    NoInvites: string;

    InvitedEmail: string;
    WhoAccepted: string;
    InvAccepted: string;
    InvSent: string;
    JoinedAlready: string;

    SendAnInv: string;
    SendInv: string;
    SendInvExpl: string;
    //EnterEmail: string;
    InvDone: string;
    NoOneToInv: string;
    InvNotfLater: string;
    AlreadyInvSendAgainQ: string;
    InvErr_1: string;
    InvErr_2: string;
    InvErr_3: string;
    TheseJoinedAlrdyC: string;
    ResendInvsQ: string;
    InvAgain: string;

    // ----- Preferences, About

    AboutYou: string;
    WebLink: string;

    NotShownCannotChange: string;

    // The full name or alias:
    NameOpt: string;

    NotShown: string;

    // The username:
    MayChangeFewTimes: string;
    notSpecified: string;
    ChangeUsername_1: string;
    ChangeUsername_2: string;

    NotfAboutAll: string;
    NotfAboutNewTopics: string;

    ActivitySummaryEmails: string;

    EmailSummariesToGroup: string;
    EmailSummariesToMe: string;

    AlsoIfTheyVisit: string;
    AlsoIfIVisit: string;

    HowOftenWeSend: string;
    HowOftenYouWant: string;

    // ----- Preferences, Privacy

    HideActivityStrangers_1: string;
    HideActivityStrangers_2: string;
    HideActivityAll_1: string;
    HideActivityAll_2: string;

    // ----- Preferences, Account

    // About email address:
    EmailAddresses: string;
    PrimaryDot: string;
    VerifiedDot: string;
    NotVerifiedDot: string;
    ForLoginWithDot: (provider: string) => string;
    MakePrimary: string;
    AddEmail: string;
    TypeNewEmailC: string;
    MaxEmailsInfo: (numMax: number) => string;
    EmailAdded_1: string;
    EmailAdded_2: string;
    SendVerifEmail: string;

    EmailStatusExpl: string;

    // Password:
    ChangePwdQ: string;
    CreatePwdQ: string;
    WillGetPwdRstEml: string;
    PwdNone: string;


    // Logins:
    LoginMethods: string;
    commaAs: string;

    // One's data:
    YourContent: string;
    DownloadPosts: string;
    DownloadPostsHelp: string;
    DownloadPersData: string;
    DownloadPersDataHelp: string;

    // Delete account:
    DangerZone: string;
    DeleteAccount: string;
    DeleteYourAccountQ: string;
    DeleteUserQ: string;
    YesDelete: string;
  },


  // Group profile page
  gpp: {
    GroupMembers: string;
    NoMembers: string;
    MayNotListMembers: string;
    AddMembers: string;
    BuiltInCannotModify: string;
    NumMembers: (num: number) => string;
    YouAreMember: string;
    CustomGroupsC: string;
    BuiltInGroupsC: string;
    DeleteGroup: string;
  },


  // Create user dialog
  cud: {
    CreateUser: string;
    CreateAccount: string;
    EmailC: string;
    keptPriv: string;
    forNotfsKeptPriv: string;
    EmailVerifBy_1: string;
    EmailVerifBy_2: string;
    UsernameC: string;
    FullNameC: string;
    optName: string;

    OrCreateAcct_1: string,
    OrCreateAcct_2: string,
    OrCreateAcct_3: string,
    OrCreateAcct_4: string,
    OrCreateAcct_5: string,

    DoneLoggedIn: string;
    AlmostDone: string;
  },


  // Accept terms and privacy policy
  terms: {
    TermsAndPrivacy: string;

    Accept_1: string;
    TermsOfService: string;
    TermsOfUse: string;
    Accept_2: string;
    PrivPol: string;
    Accept_3_User: string;
    Accept_3_Owner: string;

    YesAccept: string;
  },


  // Password input
  pwd: {
    PasswordC: string;
    StrengthC: string;
    FairlyWeak: string;
    toShort: string;
    TooShort: (minLength: number) => string;
    PlzInclDigit: string;
    TooWeak123abc: string;
    AvoidInclC: string;
  },


  // Login dialog
  ld: {
    NotFoundOrPrivate: string;
    IsImpersonating: string;

    IfYouThinkExistsThen: string;
    LoggedInAlready: string;
    ElseGoToHome_1: string;
    ElseGoToHome_2: string;

    CreateAcconut: string;
    ContinueWithDots: string;
    SignUp: string;
    LogIn: string;
    LogInWithPwd: string;
    CreateAdmAcct: string;
    AuthRequired: string;
    LogInToLike: string;
    LogInToSubmit: string;
    LogInToComment: string;
    LogInToCreateTopic: string;

    AlreadyHaveAcctQ: string;
    LogInInstead_1: string;
    LogInInstead_2: string;
    LogInInstead_3: string;

    NewUserQ: string;
    SignUpInstead_1: string;
    SignUpInstead_2: string;
    SignUpInstead_3: string;

    OrCreateAcctHere: string;
    OrTypeName: string;
    OrLogIn: string;
    YourNameQ: string;

    BadCreds: string;

    UsernameOrEmailC: string;
    PasswordC: string;
    ForgotPwd: string;

    NoPwd: string;
    CreatePwd: string;
  },


  // Flag dialog
  fd: {
    PleaseTellConcerned: string;
    ThanksHaveReported: string;
    ReportComment: string;
    OptPersonalData: string;
    OptOffensive: string;
    OptSpam: string;
    OptOther: string;
  },


  // Help message dialog
  help: {
    YouCanShowAgain_1: string;
    YouCanShowAgain_2: string;
  },


  // Editor
  e: {
    SimilarTopicsC: string;

    //WritingSomethingWarning: string;
    UploadMaxOneFile: string;
    PleaseFinishPost: string;
    PleaseFinishChatMsg: string;
    PleaseFinishMsg: string;
    PleaseSaveEdits: string;
    PleaseSaveOrCancel: string;
    CanContinueEditing: string;
    PleaseDontDeleteAll: string;
    PleaseWriteSth: string;
    PleaseWriteTitle: string;
    PleaseWriteMsgTitle: string;
    PleaseWriteMsg: string;

    exBold: string;
    exEmph: string;
    exPre: string;
    exQuoted: string;
    ExHeading: string;

    TitlePlaceholder: string;

    EditPost_1: string;
    EditPost_2: string;

    TypeChatMsg: string;
    YourMsg: string;
    CreateTopic: string;
    CreateCustomHtml: string;
    CreateInfoPage: string;
    CreateCode: string;
    AskQuestion: string;
    ReportProblem: string;
    SuggestIdea: string;
    NewChat: string;
    NewPrivChat: string;
    AppendComment: string;

    ReplyTo: string;
    ReplyTo_theOrigPost: string;
    ReplyTo_post: string;
    AddCommentC: string;

    PleaseSelectPosts: string;

    Save: string;
    edits: string;

    PostReply: string;

    Post: string;
    comment: string;
    question: string;

    PostMessage: string;
    SimpleEditor: string;

    Send: string;
    message: string;

    Create: string;
    page: string;
    chat: string;
    idea: string;
    topic: string;

    Submit: string;
    problem: string;

    ViewOldEdits: string;

    UploadBtnTooltip: string;
    BoldBtnTooltip: string;
    EmBtnTooltip: string;
    QuoteBtnTooltip: string;
    PreBtnTooltip: string;
    HeadingBtnTooltip: string;

    TypeHerePlaceholder: string;

    Maximize: string;
    ToNormal: string;
    TileHorizontally: string;

    PreviewC: string;
    TitleExcl: string;
    ShowEditorAgain: string;
    Minimize: string;

    IPhoneKbdSpace_1: string;
    IPhoneKbdSpace_2: string;

    PreviewInfo: string;
    CannotType: string;

    LoadingDraftDots: string;
    DraftUnchanged: string;
    CannotSaveDraftC: string;
    DraftSavedBrwsr: string;
    DraftSaved: (nr: string | number) => string;
    DraftDeleted: (nr: string | number) => string;
    WillSaveDraft: (nr: string | number) => string;
    SavingDraft: (nr: string | number) => string;
    DeletingDraft: (nr: string | number) => string;
  },


  // Select category dropdown
  scd: {
    SelCat: string;
  },


  // Page type dropdown
  pt: {
    SelectTypeC: string;
    DiscussionExpl: string;
    QuestionExpl: string;
    ProblExpl: string;
    IdeaExpl: string;
    ChatExpl: string;
    PrivChatExpl: string;

    CustomHtml: string;
    InfoPage: string;
    Code: string;
    EmbCmts: string;
    About: string;
    PrivChat: string;
    Form: string;
  },


  // Join sub community dialog
  jscd: {
    NoMoreToJoin: string;
    SelCmty: string;
  },


  // Search dialogs and the search page.
  s: {
    TxtToFind: string;
  },


  // Refresh page dialog
  ni: {
    NoInet: string;
    PlzRefr: string;
    RefrNow: string;
  },


  PostDeleted: (postNr: number) => string;
  NoSuchPost: (postNr: number) => string;
  NoPageHere: string;
  GoBackToLastPage: string;

}


