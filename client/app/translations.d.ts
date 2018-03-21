// translations.d.ts


interface TalkyardTranslations {

  // Single or a few words, alphabetically
  Active: string;
  Activity: string;
  Admin: string;
  Away: string;
  BlogN: string;
  Bookmarks: string;
  Cancel: string;
  Categories: string;
  Category: string;
  ChatN: string;
  Close: string;
  closed: string;
  Created: string;
  Delete: string;
  Discussion: string;
  EditV: string;
  Forum: string;
  Hide: string;
  Idea: string;
  Loading: string;
  LoadMore: string;
  Login: string;
  LoggedInAs: string;
  LogOut: string;
  MessageN: string;
  MoreDots: string;
  Move: string;
  None: string;
  NotImplemented: string;
  NoTopics: string;
  Okay: string;
  OkayDots: string;
  Online: string;
  PreviewV: string;
  Problem: string;
  Question: string;
  Recent: string;
  Reopen: string;
  ReplyV: string;
  Replies: string;
  Save: string;
  SavingDots: string;
  Solution: string;
  Submit: string;
  Topics: string;
  TopicType: string;
  UploadingDots: string;
  Users: string;
  Wiki: string;
  you: string;

  // fi = forum intro text
  fi: {
    Edit: string;
    Hide_1: string;
    Hide_2: string;
    Hide_3: string;
  },


  // fb = forum buttons
  fb: {
    TopicList: string;
    AllCats: string;
    Active: string;
    ActiveTopics: string;
    ActiveDescr: string;
    New: string;
    NewTopics: string;
    NewDescr: string;
    Top: string;
    TopTopics: string;
    TopDescr: string;
    AllTopics: string;
    ShowAllTopics: string;
    ShowAllTopicsDescr: string;
    OnlyWaiting: string;
    OnlyWaitingDescr_1: string;
    OnlyWaitingDescr_2: string;
    OnlyWaitingDescr_3: string;
    ShowDeleted: string;
    ShowDeletedDescr: string;
    EditCat: string;
    CreateCat: string;
    CreateTopic: string;
    PostIdea: string;
    AskQuestion: string;
    ReportProblem: string;
    CreateMindMap: string;
    CreatePage: string;
  },


  // ft = forum topic list
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


  // Forum categories list
  fc: {
    RecentTopicsWaiting: string;
    RecentTopicsInclDel: string;
    RecentTopics: string;
    _replies: string;
    _deleted: string;
    _defCat: string;
  },


  // Watchbar
  wb: {
    AddCommunity: string;
    RecentlyViewed: string;
    JoinedChats: string;
    ChatChannels: string;
    CreateChat: string;
    DirectMsgs: string;
    ViewPeopleHere: string;
    ViewAddRemoveMembers: string;
    ViewChatMembers: string;
    EditChat: string;
    LeaveThisChat: string;
    LeaveThisCommunity: string;
    JoinThisCommunity: string;
    TopicActions: string;
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

    AddPeople: string;

    thatsYou: string;
    YouAnd: string;
    OnlyYou: string;
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

    CloseShortcutS: string;
  },


  // Post actions
  pa: {
    ReplyToOp: string;

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


  // Discussion / non-chat page
  d: {
    ThisFormClosed_1: string;
    ThisFormClosed_2: string;

    ThisTopicClosed_1: string;
    ThisTopicClosed_2: string;

    ThisQuestSloved_1: string;
    ThisQuestSloved_2: string;

    ThisQuestWaiting_1: string;
    ThisQuestWaiting_2: string;
    ThisQuestWaiting_3: string;

    ThisProblSolved_1: string;
    ThisProblSolved_2: string;

    ThisProblStarted_1: string;
    ThisProblStarted_2: string;
    ThisProblStarted_3: string;

    ThisProblPlanned_1: string;
    ThisProblPlanned_2: string;
    ThisProblPlanned_3: string;
    ThisProblPlanned_4: string;

    ThisProblemNew_1: string;
    ThisProblemNew_2: string;
    ThisProblemNew_3: string;

    ThisIdeaDone_1: string;
    ThisIdeaDone_2: string;

    ThisIdeaStarted_1: string;
    ThisIdeaStarted_2: string;
    ThisIdeaStarted_3: string;

    ThisIdeaPlanned_1: string;
    ThisIdeaPlanned_2: string;
    ThisIdeaPlanned_3: string;
    ThisIdeaPlanned_4: string;

    ThisIdeaNew_1: string;
    ThisIdeaNew_2: string;
    ThisIdeaNew_3: string;
    ThisIdeaNew_4: string;
    ThisIdeaNew_5: string;

    ThisPageDeleted: string;
    CatDeldPageToo: string;

    AboutCat: string;

    PageDeleted: string;
    TitlePendAppr: string;
    TextPendingApproval: string;

    TooltipQuestClosedNoAnsw: string;
    TooltipTopicClosed: string;

    TooltipQuestSolved: string;
    TooltipQuestUnsolved: string;

    TooltipProblFixed: string;
    TooltipDone: string;
    ClickStatusNew: string;

    TooltipFixing: string;
    TooltipImplementing: string;
    ClickStatusDone: string;

    TooltipProblPlanned: string;
    TooltipIdeaPlanned: string;
    ClickStatusStarted: string;

    TooltipUnsProbl: string;
    TooltipIdea: string;
    ClickStatusPlanned: string;

    TooltipPersMsg: string;
    TooltipChat: string;
    TooltipPrivChat: string;

    TooltipPinnedGlob: string;
    TooltipPinnedCat: string;

    SolvedClickView_1: string;
    SolvedClickView_2: string;

    AboveBestFirst: string;
    BelowCmtsEvents: string;

    BottomCmtExpl_1: string;
    BottomCmtExpl_2: string;
    BottomCmtExpl_3: string;

    AddComment: string;
    AddBottomComment: string;

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

    dashInReplyTo: string;
    InReplyTo: string;

    ClickViewEdits: string;

    By: string;
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
    MoreNotfs: string;
    ViewProfile: string;
    LogOut: string;
    UnhideHelp: string;
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
    SignIn: string;
    LogIn: string;
    LogInWithPwd: string;
    CreateAdmAcct: string;
    AuthRequired: string;
    LoginToLike: string;
    LoginToSubmit: string;
    LoginToComment: string;
    LoginToCreateTopic: string;

    AlreadyHaveAcctQ: string;
    LoginInstead_1: string;
    LoginInstead_2: string;
    LoginInstead_3: string;

    NewUserQ: string;
    SignUpInstead_1: string;
    SignUpInstead_2: string;
    SignUpInstead_3: string;

    OrCreateAcctHere: string;
    OrFillin: string;

    BadCreds: string;

    UsernameOrEmailC: string;
    PasswordC: string;
    ForgotPwd: string;
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


  // Editor

  e: {
    WritingSomethingWarning: string;
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

    PleaseSelectPosts: string;

    Save: string;
    edits: string;

    PostReply: "Post reply",

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
}


