/// <reference path="../../client/app/translations.d.ts"/>

// Note:
// - If the first char in the field name is Uppercase, then the
//   textual value also starts with an Uppercase letter.
//   E.g. `Close: "Close"`, and `close: "close"`.
// - The text value of a field that ends with ...Q, ends with ?. E.g. `DeleteQ: "Delete?"`.
// - The text value of a field that ends with ...C, ends with :. E.g. `PasswordC: "Password:"`.
// - If the field ends with an S, then it's a noun (not a verb). Example:
//   In English, the word "chat" is both a noun and a verb, but in other languages,
//   two different words might be needed — and then there're two fields for the translators
//   `ChatN: "...(noun here)..."` and `ChatV: "...(verb here)..."`.
// - If the field ends with an V, then it's a verb (not a noun)

var t: TalkyardTranslations;

var t_en: TalkyardTranslations = t = {

  // A single or a few words, sorted alphabetically, to reuse everywhere.

  Active: "Active",
  Activity: "Activity",
  Admin: "Admin",
  Away: "Away",
  BlogN: "Blog",
  Bookmarks: "Bookmarks",
  Cancel: "Cancel",
  Categories: "Categories",
  Category: "Category",
  ChatN: "Chat",
  Close: "Close",
  closed: "closed",
  Created: "Created",
  Delete: "Delete",
  Discussion: "Discussion",
  EditV: "Edit",
  Forum: "Forum",
  Hide: "Hide",
  Idea: "Idea",
  Loading: "Loading...",
  LoadMore: "Load more ...",
  Login: "Login",
  LoggedInAs: "Logged in as ",
  LogOut: "Log out",
  MessageN: "Message",
  MoreDots: "More...",
  Move: "Move",
  None: "None",
  NotImplemented: "(Not implemented)",
  NoTopics: "No topics.",
  Okay: "Okay",
  OkayDots: "Okay ...",
  Online: "Online",
  PreviewV: "Preview",
  Problem: "Problem",
  Question: "Question",
  Recent: "Recent",
  Reopen: "Reopen",
  ReplyV: "Reply",
  Replies: "Replies",
  Save: "Save",
  SavingDots: "Saving ...",
  Solution: "Solution",
  Submit: "Submit",
  Topics: "Topics",
  TopicType: "Topic type",
  UploadingDots: "Uploading...",
  Users: "Users",
  Wiki: "Wiki",
  you: "you",


  // Forum intro text

  fi: {
    Edit: "Edit",
    Hide_1: "Hide",
    Hide_2: ", click ",
    Hide_3: " to reopen",
  },


  // Forum buttons

  fb: {

    TopicList: "Topic list",

    // Select category dropdown

    AllCats: "All categories",

    // Topic sort order

    Active: "Active",
    ActiveTopics: "Active topics",
    ActiveDescr: "Shows recently active topics first",

    New: "New",
    NewTopics: "New topics",
    NewDescr: "Shows newest topics first",

    Top: "Top",
    TopTopics: "Popular topics",
    TopDescr: "Shows popular topics first",

    // Topic filter dropdown

    AllTopics: "All topics",

    ShowAllTopics: "Show all topics",
    ShowAllTopicsDescr: "Doesn't show deleted topics though",

    OnlyWaiting: "Only waiting",
    OnlyWaitingDescr_1: "Shows only questions ",
    OnlyWaitingDescr_2: "waiting ",
    OnlyWaitingDescr_3: "for a solution, plus ideas and problems not yet handled",

    ShowDeleted: "Show deleted",
    ShowDeletedDescr: "Shows all topics, including deleted topics",

    // Rightmost buttons

    EditCat: "Edit Category",
    CreateCat: "Create Category",
    CreateTopic: "Create Topic",
    PostIdea: "Post an Idea",
    AskQuestion: "Ask a Question",
    ReportProblem: "Report a Problem",
    CreateMindMap: "Create Mind Map",
    CreatePage: "Create Page",

  },


  // Forum topic list

  ft: {
    ExplIcons: "Explain icons...",
    IconExplanation: "Icon explanation:",
    ExplGenDisc: "A general discussion.",
    ExplQuestion: "A question with no accepted answer.",
    ExplAnswer: "A question with an accepted answer.",
    ExplIdea: "An idea / suggestion.",
    ExplProblem: "A problem.",
    ExplPlanned: "Something we're planning to do or fix.",
    ExplDone: "Something that's been done or fixed.",
    ExplClosed: "Topic closed.",
    ExplPinned: "Topic always listed first (perhaps only in its own category).",

    PopularTopicsComma: "Popular topics, ",
    TopFirstAllTime: "Shows the most popular topics first, all time.",
    TopFirstPastDay: "Shows topics popular during the past day.",

    CatHasBeenDeleted: "This category has been deleted",

    TopicsActiveFirst: "Topics, recently active first",
    TopicsNewestFirst: "Topics, newest first",

    CreatedOn: "Created on ",
    LastReplyOn: "\nLast reply on ",
    EditedOn: "\nEdited on ",

    createdTheTopic: "created the topic",
    frequentPoster: "frequent poster",
    mostRecentPoster: "most recent poster",

    inColon: "in: ",

    TitleFixed: "This has been fixed",
    TitleDone: "This has been done",
    TitleStarted: (fixing: string) => `We've started ${fixing} this`,
    TitleUnsolved: "This is an unsolved problem",
    TitleIdea: "This is an idea",
    TitlePlanningFix: "We're planning to fix this",
    TitlePlanningDo: "We're planning to do this",
    TitleChat: "This is a chat channel",
    TitlePrivateChat: "This is a private chat channel",
    TitlePrivateMessage: "A private message",
    TitleInfoPage: "This is an info page",
    TitleDiscussion: "A discussion",
    IsPinnedGlobally: "\nIt has been pinned, so it's listed first.",
    IsPinnedInCat: "\nIt has been pinned in its category, so is listed first, in its category.",
  },


  // Forum categories list

  fc: {
    RecentTopicsWaiting: "Recent topics (those waiting)",
    RecentTopicsInclDel: "Recent topics (including deleted)",
    RecentTopics: "Recent topics",
    _replies: " replies",
    _deleted: " (deleted)",
    _defCat: " (default category)",
  },


  // Watchbar (the sidebar to the left)

  wb: {
    AddCommunity: "Add ...",
    RecentlyViewed: "Recently viewed",
    JoinedChats: "Joined Chats",
    ChatChannels: "Chat Channels",
    CreateChat: "Create chat channel",
    DirectMsgs: "Direct Messages",

    // The click-topic dropdown menu:
    TopicActions: "Topic actions",
    ViewPeopleHere: "View people here",
    ViewAddRemoveMembers: "View / add / remove members",
    ViewChatMembers: "View chat members",
    EditChat: "Edit chat title and purpose",
    LeaveThisX: (isChat: boolean) => "Leave this " + (isChat ? "chat" : "community"),
    JoinThisCommunity: "Join this community",
  },


  // Contextbar (the sidebar to the right), code currently in sidebar.ts (not renamed yet)

  cb: {
    RecentComments: "Recent comments in this topic:",
    NoComments: "No comments.",

    YourBookmarks: "Your bookmarks:",

    UsersOnline: "Users online:",
    UsersOnlineForum: "Users online in this forum:",
    UsersInThis: (isChat: boolean) => "Users in this " + (isChat ? "chat: " : "topic:"),

    GettingStartedGuide: "Getting Started Guide",
    AdminGuide: "Admin Guide",
    Guide: "Guide",

    AddPeople: "Add more people",

    thatsYou: "that's you",
    YouAnd: "You, and ",
    OnlyYou: "Only you, it seems",
    NumStrangers: (numStrangers: number) => {
      const people = numStrangers === 1 ? " person" : " people";
      const have = numStrangers === 1 ? "has" : "have";
      return numStrangers + people + " who " + have + " not logged in";
    },

    RepliesToTheLeft: "The replies to the left are sorted by ",
    bestFirst: "best-first.",
    ButBelow: "But below ",
    insteadBy: " the same replies are instead sorted by ",
    newestFirst: "newest-first.",

    SoIfLeave: "So if you leave, and come back here later, below you'll find ",
    allNewReplies: "all new replies.",
    Click: "Click",
    aReplyToReadIt: " a reply below to read it — because only an excerpt is shown, below.",

    CloseShortcutS: "Close (keyboard shortcut: S)",
  },


  // Discussion / non-chat page

  d: {
    ThisFormClosed_1: "This form has been ",
    ThisFormClosed_2: "closed; you can no longer fill it in and post it.",

    ThisTopicClosed_1: "This topic has been ",
    // ... "closed" ...
    ThisTopicClosed_2: ". You can still post comments, " +
          "but that won't make this topic bump to the top of the latest-topics list.",

    ThisQuestSloved_1: "This is a question and it has been ",
    ThisQuestSloved_2: "answered.",

    ThisQuestWaiting_1: "This is a ",
    ThisQuestWaiting_2: "question, waiting for an ",
    ThisQuestWaiting_3: "answer.",

    ThisProblSolved_1: "This is a problem and it has been ",
    ThisProblSolved_2: " solved.",

    ThisProblStarted_1: "This is a problem. We have ",
    ThisProblStarted_2: " started fixing it, but it's not yet ",
    ThisProblStarted_3: " done.",

    ThisProblPlanned_1: "This is a problem. We ",
    ThisProblPlanned_2: " plan to fix it, but it's not yet ",
    ThisProblPlanned_3: " started, not yet ",
    ThisProblPlanned_4: " done.",

    ThisProblemNew_1: "This is a ",
    ThisProblemNew_2: " problem. It's not yet ",
    ThisProblemNew_3: " solved.",

    ThisIdeaDone_1: "This has been ",
    ThisIdeaDone_2: " implemented.",

    ThisIdeaStarted_1: "We have ",
    ThisIdeaStarted_2: " started implementing this. But it's not yet ",
    ThisIdeaStarted_3: " done.",

    ThisIdeaPlanned_1: "We ",
    ThisIdeaPlanned_2: " plan to implement this. But it's not yet ",
    ThisIdeaPlanned_3: " started, not yet ",
    ThisIdeaPlanned_4: " done.",

    ThisIdeaNew_1: "This is an ",
    ThisIdeaNew_2: " idea, not yet ",
    ThisIdeaNew_3: " planned, not ",
    ThisIdeaNew_4: " started, not ",
    ThisIdeaNew_5: " done.",

    ThisPageDeleted: "This page has been deleted",
    CatDeldPageToo: "Category deleted, so this page was deleted too",

    AboutCat: "About category:",

    PageDeleted: "(Page deleted)",
    TitlePendAppr: "(Title pending approval)",
    TextPendingApproval: "(Text pending approval)",

    TooltipQuestClosedNoAnsw: "This question has been closed without any accepted answer.",
    TooltipTopicClosed: "This topic is closed.",

    TooltipQuestSolved: "This is a solved question",
    TooltipQuestUnsolved: "This is an unsolved question",

    TooltipProblFixed: "This has been fixed",
    TooltipDone: "This has been done",
    ClickStatusNew: "Click to change status to new",

    TooltipFixing: "We're currently fixing this",
    TooltipImplementing: "We're currently implementing this",
    ClickStatusDone: "Click to mark as done",

    TooltipProblPlanned: "We're planning to fix this",
    TooltipIdeaPlanned: "We're planning to implement this",
    ClickStatusStarted: "Click to mark as started",

    TooltipUnsProbl: "This is an unsolved problem",
    TooltipIdea: "This is an idea",
    ClickStatusPlanned: "Click to change status to planned",

    TooltipPersMsg: "Personal message",
    TooltipChat: "# means Chat Channel",
    TooltipPrivChat: "This is a private chat channel",

    TooltipPinnedGlob: "\nPinned globally.",
    TooltipPinnedCat: "\nPinned in this category.",

    SolvedClickView_1: "Solved in post #",
    SolvedClickView_2: ", click to view",

    AboveBestFirst: " Above: Replies, best first. ",
    BelowCmtsEvents: " Below: Comments and events.",

    BottomCmtExpl_1: "You're adding a comment that will stay at the bottom of the page. " +
        "It won't rise to the top even if it gets upvotes.",
    BottomCmtExpl_2: "This is useful for status messages, e.g. to clarify why you close/reopen " +
        "a topic. Or for suggesting changes to the original post.",
    BottomCmtExpl_3: "To reply to someone, click Reply instead.",

    AddComment: "Add comment",
    AddBottomComment: "Add bottom comment",

    PostHiddenClickShow: "Post hidden; click to show",
    ClickSeeMoreRepls: "Click to show more replies",
    ClickSeeMoreComments: (many: boolean) => "Click to show " + (many ? "more comments" : "this comment"),
    clickToShow: "click to show",

    ManyDisagree: "Many disagree with this:",
    SomeDisagree: "Some disagree with this:",

    CmtPendAppr: "Comment pending approval, posted ",
    CmtBelowPendAppr: (isYour) => (isYour ? "Your" : "The") + " comment below is pending approval.",

    _and: " and",

    dashInReplyTo: "— in reply to",
    InReplyTo: "In reply to",

    ClickViewEdits: "Click to view old edits",

    By: "By ", // ... someones name
  },

  // Post actions

  pa: {
    ReplyToOp: "Reply to the Original Post",

    CloseOwnQuestionTooltip: "Close this question if you don't need an answer any more.",
    CloseOtherQuestionTooltip: "Close this question if it doesn't need an answer, e.g. if " +
                  "it is off-topic or already answered in another topic.",
    CloseToDoTooltip: "Close this To-Do if it does not need to be done or fixed.",
    CloseTopicTooltip: "Close this topic if it needs no further consideration.",

    AcceptBtnExpl: "Accept this as the answer to the question or problem",
    SolutionQ: "Solution?",
    ClickUnaccept: "Click to un-accept this answer",
    PostAccepted: "This post has been accepted as the answer",

    NumLikes: (num: number) => num === 1 ? "1 Like" : num + " Likes",
    NumDisagree: (num: number) => num + " Disagree",
    NumBury: (num: number) => num === 1 ? "1 Bury" : num + " Burys",
    NumUnwanted: (num: number) => num === 1 ? "1 Unwanted" : num + " Unwanteds",

    MoreVotes: "More votes...",
    LikeThis: "Like this",
    LinkToPost: "Link to this post",
    More: "More...",
    Report: "Report",
    ReportThisPost: "Report this post",
    Admin: "Admin",

    Disagree: "Disagree",
    DisagreeExpl: "Click here to disagree with this post, or to warn others about factual errors.",
    Bury: "Bury",
    BuryExpl: "Click to sort other posts before this post. Only the forum staff can see your vote.",
    Unwanted: "Unwanted",
    UnwantedExpl: "If you do not want this post on this website. This would reduce the trust I have " +
            "in the post author. Only the forum staff can see your vote.",

    AddTags: "Add/remove tags",
    UnWikify: "Un-Wikify",
    Wikify: "Wikify",
    PinDeleteEtc: "Pin / Delete / Category ...",
  },


  // Chat

  c: {
    About_1: "This is the ",
    About_2: " chat channel, created by ",
    ScrollUpViewComments: "Scroll up to view older comments",
    Purpose: "Purpose:",
    edit: "edit",
    'delete': "delete",
    MessageDeleted: "(Message deleted)",
    JoinThisChat: "Join this chat",
    PostMessage: "Post message",
    AdvancedEditor: "Advanced editor",
    TypeHere: "Type here. You can use Markdown and HTML.",
  },


  // My Menu

  mm: {
    NeedsReview: "Needs review ",
    AdminHelp: "Admin help ",
    StaffHelp: "Staff help ",
    MoreNotfs: "View more notifications...",
    ViewProfile: "View/edit your profile",
    LogOut: "Log out",
    UnhideHelp: "Unhide help messages",
  },


  // Login dialog

  ld: {
    NotFoundOrPrivate: "Page not found, or Access Denied.",
    IsImpersonating: "You're impersonating someone, who might not have access to all parts " +
        "of this website.",

    IfYouThinkExistsThen: "If you think the page exists, log in as someone who may access it. ",
    LoggedInAlready: "(You are logged in already, but perhaps it's the wrong account?) ",
    OtherwiesGoToHome_1: "Otherwise, you can ",
    OtherwiesGoToHome_2: "go to the homepage.",

    CreateAcconut: "Create account",
    SignIn: "Sign in ...",
    LogIn: "Log in",
    LogInWithPwd: "Log in with Password",
    CreateAdmAcct: "Create admin account:",
    AuthRequired: "Authentication required to access this site",
    LoginToLike: "Log in to Like this post",
    LoginToSubmit: "Log in and submit",
    LoginToComment: "Log in to write a comment",
    LoginToCreateTopic: "Log in to create topic",

    AlreadyHaveAcctQ: "Already have an account? ",
    LoginInstead_1: "",
    LoginInstead_2: "Log in",   // "Log in" (this is a button)
    LoginInstead_3: " instead", // "instead"

    NewUserQ: "New user? ",
    SignUpInstead_1: "",
    SignUpInstead_2: "Sign up",
    SignUpInstead_3: " instead",

    OrCreateAcctHere: "Or create account here:",
    OrFillin: "Or fill in:",

    BadCreds: "Wrong username or password",

    UsernameOrEmailC: "Username or email:",
    PasswordC: "Password:",
    ForgotPwd: "Did you forget your password?",
  },


  // Flag dialog

  fd: {
    PleaseTellConcerned: "Please tell us what you are concerned about.",
    ThanksHaveReported: "Thanks. You have reported it. The forum staff will take a look.",
    ReportComment: "Report Comment",
    // Different reasons one can choose among when reporting a comment:
    OptPersonalData: "This post contains personal data, for example someones' real name.",
    OptOffensive: "This post contains offensive or abusive content.",
    OptSpam: "This post is an unwanted advertisement.",
    OptOther: "Notify staff about this post for some other reason.",
  },


  // Editor

  e: {
    WritingSomethingWarning: "You were writing something?",
    UploadMaxOneFile: "Sorry but currently you can upload only one file at a time",
    PleaseFinishPost: "Please first finish writing your post",
    PleaseFinishChatMsg: "Please first finish writing your chat message",
    PleaseFinishMsg: "Please first finish writing your message",
    PleaseSaveEdits: "Please first save your current edits",
    PleaseSaveOrCancel: "Please first either save or cancel your new topic",
    CanContinueEditing: "You can continue editing your text, if you open the editor again. " +
        "(But the text will currently be lost if you leave this page.)",
    PleaseDontDeleteAll: "Please don't delete all text. Write something.",
    PleaseWriteSth: "Please write something.",
    PleaseWriteTitle: "Please write a topic title.",
    PleaseWriteMsgTitle: "Please write a message title.",
    PleaseWriteMsg: "Please write a message.",

    exBold: "bold text",
    exEmph: "emphasized text",
    exPre: "preformatted text",
    exQuoted: "quoted text",
    ExHeading: "Heading",

    TitlePlaceholder: "Type a title — what is this about, in one brief sentence?",

    EditPost_1: "Edit ",
    EditPost_2: "post ",

    TypeChatMsg: "Type a chat message:",
    YourMsg: "Your message:",
    CreateTopic: "Create new topic",
    CreateCustomHtml: "Create a custom HTML page (add your own <h1> title)",
    CreateInfoPage: "Create an info page",
    CreateCode: "Create a source code page",
    AskQuestion: "Ask a question",
    ReportProblem: "Report a problem",
    SuggestIdea: "Suggest an idea",
    NewChat: "New chat channel title and purpose",
    NewPrivChat: "New private chat title and purpose",
    AppendComment: "Append a comment at the bottom of the page:",

    ReplyTo: "Reply to ",
    ReplyTo_theOrigPost: "the Original Post",
    ReplyTo_post: "post ",

    PleaseSelectPosts: "Please select one or more posts to reply to.",

    Save: "Save",
    edits: "edits",

    PostReply: "Post reply",

    Post: "Post",
    comment: "comment",
    question: "question",

    PostMessage: "Post message",
    SimpleEditor: "Simple editor",

    Send: "Send",
    message: "message",

    Create: "Create",
    page: "page",
    chat: "chat",
    idea: "idea",
    topic: "topic",

    Submit: "Submit",
    problem: "problem",

    ViewOldEdits: "View old edits",

    UploadBtnTooltip: "Upload a file or image",
    BoldBtnTooltip: "Make text bold",
    EmBtnTooltip: "Emphasize",
    QuoteBtnTooltip: "Quote",
    PreBtnTooltip: "Preformatted text",
    HeadingBtnTooltip: "Heading",

    TypeHerePlaceholder: "Type here. You can use Markdown and HTML. Drag and drop to paste images.",

    Maximize: "Maximize",
    ToNormal: "Back to normal",
    TileHorizontally: "Tile horizontally",

    PreviewC: "Preview:",
    TitleExcl: " (title excluded)",
    ShowEditorAgain: "Show editor again",
    Minimize: "Minimize",

    IPhoneKbdSpace_1: "(This gray space is reserved",
    IPhoneKbdSpace_2: "for the iPhone keyboard.)",

    PreviewInfo: "Here you can preview how your post will look.",
    CannotType: "You cannot type here.",
  },


  // Page type dropdown

  pt: {
    SelectTypeC: "Select topic type:",
    DiscussionExpl: "A discussion about something.",
    QuestionExpl: "One answer can be marked as the accepted answer.",
    ProblExpl: "If something is broken or doesn't work. Can be marked as fixed/solved.",
    IdeaExpl: "A suggestion. Can be marked as done/implemented.",
    ChatExpl: "A perhaps never-ending conversation.",
    PrivChatExpl: "Only visible to people that get invited to join the chat.",

    CustomHtml: "Custom HTML page",
    InfoPage: "Info page",
    Code: "Code",
    EmbCmts: "Embedded comments",
    About: "About",
    PrivChat: "Private Chat",
    Form: "Form",
  },


};


