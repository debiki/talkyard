/// <reference path="../../client/app/translations.d.ts"/>

// Note:
// - If the first char in the field name is Uppercase, then the
//   textual value also starts with an Uppercase letter.
//   E.g. `Close: "Close"`, and `close: "close"`.
// - The text value of a field that ends with ...Q, ends with ?. E.g. `DeleteQ: "Delete?"`.
// - The text value of a field that ends with ...C, ends with :. E.g. `PasswordC: "Password:"`.
// - If the field ends with an N, then it's a noun (not a verb). Example:
//   In English, the word "chat" is both a noun and a verb, but in other languages,
//   two different words might be needed — and then there're two fields for the translators
//   `ChatN: "(noun here)"` and `ChatV: "(verb here)"`.
// - If the field ends with an V, then it's a verb (not a noun)

var t: TalkyardTranslations;

var t_sv_SE: TalkyardTranslations = t = {

  // A single or a few words, sorted alphabetically, to reuse everywhere.

  Active: "Active",
  Activity: "Activity",
  Add: "Add",
  AddingDots: "Adding ...",
  Admin: "Admin",
  AdvSearch: "Advanced search",
  Away: "Away",
  Back: "Back",
  BlogN: "Blog",
  Bookmarks: "Bookmarks",
  Cancel: "Cancel",
  Categories: "Categories",
  Category: "Category",
  Continue: "Continue",
  ClickToShow: "Click to show",
  ChangeDots: "Change ...",
  ChatN: "Chat",
  Close: "Close",
  closed: "closed",
  Created: "Created",
  Delete: "Delete",
  Discussion: "Discussion",
  EditV: "Edit",
  EmailAddress: "Email address",
  EmailAddresses: "Email addresses",  // MISSING
  Forum: "Forum",
  Hide: "Göm",
  Home: "Home",
  Idea: "Idé",
  Join: "Joina",
  KbdShrtcsC: "Keyboard shortcuts: ",
  Loading: "Laddar...",
  LoadMore: "Mer ...",
  LogIn: "Log In",
  LoggedInAs: "Logged in as ",
  LogOut: "Log out",
  MessageN: "Message",
  MoreDots: "More...",
  Move: "Move",
  Name: "Name",
  NameC: "Name:",
  Notifications: "Notifications",
  NotImplemented: "(Not implemented)",
  NotYet: "Not yet",
  NoTopics: "No topics.",
  Okay: "Okay",
  OkayDots: "Okay ...",
  Online: "Online",
  onePerLine: "one per line",
  PreviewV: "Preview",
  Problem: "Problem",
  Question: "Fråga",
  Recent: "Recent",
  Remove: "Ta bort",
  Reopen: "Öppna",
  ReplyV: "Svara",
  Replies: "Svar",
  replies: "svar",
  Save: "Spara",
  SavingDots: "Sparar ...",
  SavedDot: "Saved.",
  Search: "Search",
  SendMsg: "Send Message",
  SignUp: "Sign Up",
  Solution: "Solution",
  Summary: "Summary",
  Submit: "Submit",
  Tools: "Tools",
  Topics: "Topics",
  TopicType: "Topic type",
  UploadingDots: "Uploading...",
  Username: "Username",
  Users: "Users",
  Welcome: "Welcome",
  Wiki: "Wiki",
  You: "You",
  you: "you",

  // Trust levels.
  Guest:  "Guest",
  NewMember: "New member",
  BasicMember: "Basic member",
  FullMember: "Full member",
  TrustedMember: "Trusted member",
  RegularMember: "Regular member",
  CoreMember: "Core member",

  // Periods.
  PastDay: "Past Day",
  PastWeek: "Past Week",
  PastMonth: "Past Month",
  PastQuarter: "Past Quarter",
  PastYear: "Past Year",
  AllTime: "All Time",

  // Time ago letters.
  // English examples: "3d" in forum topic list means 3 days ago. "5h" is 5 hours.
  monthsLtr: "mon",  // months
  daysLtr: "d",      // days
  hoursLtr: "h",     // hours
  minsLtr: "m",      // minutes
  secsLtr: "s",      // seconds

  // Time ago, long text versions.
  daysAgo: (numDays: number) =>
    numDays === 1 ? "1 day ago" : `${numDays} days ago`,

  hoursAgo: (numHours: number) =>
    numHours === 1 ? "1 hour ago" : `${numHours} hours ago`,

  minutesAgo: (numMins: number) =>
    numMins === 1 ? "1 minute ago" : `${numMins} minutes ago`,

  secondsAgo: (numSecs: number) =>
    numSecs === 1 ? "1 second ago" : `${numSecs} seconds ago`,


  // Input fields, e.g. email, name etc.

  inp: {
    // Email address input field:
    EmReq: "Email required",
    NoSpcs: "No spaces please",
    InvldAddr: "Not a valid email address",
    NoBadChrs: "No weird characters please",

    // Full name input field:
    NotOnlSpcs: "Not just spaces please",
    NoAt: "No @ please",

    // Username input field:
    NoDash: "No dashes (-) please",
    DontInclAt: "Don't include the @",
    StartEndLtrDgt: "Start and end with a letter or a digit",
    OnlLtrNumEtc: "Only letters (a-z, A-Z) and numbers, and _ (underscore)",
    // This shown just below the username input:
    UnUnqShrt_1: "Your ",
    UnUnqShrt_2: "@username",
    UnUnqShrt_3: ", unique and short",

    // Generic messages for all input fields:
    TooShort: (minLength: number) => `Should be at least ${minLength} characters`,
    TooLong: (maxLength: number) => `Too long. Should be at most ${maxLength} characters`,
  },


  // Notification levels.

  nl: {
    WatchingAll: "Watching All",
    WatchingAllTag: "You'll be notified of new topics with this tag, and every post in those topics",
    WatchingAllTopic: "You'll be notified of all new replies in this topic.",

    // One will be notified about the *first* post in a new topic, only. That is, the Original Post
    // (that's what the first post is called, in a discussion forum topic).
    WatchingFirst: "Watching First",
    WatchingFirstTag: "You'll be notified of new topics with this tag",

    Tracking: "Tracking",

    Normal: "Normal",
    NormalTopic_1: "You'll be notified if someone replies to you or mentions your ",
    NormalTopic_2: "@name",

    Muted: "Muted",
    MutedTopic: "No notifications about this topic.",
  },


  // Forum intro text

  fi: {
    Edit: "Edit",
    Hide_1: "Hide",
    Hide_2: ", click ",
    Hide_3: " to reopen",
  },


  // Forum buttons

  fb: {

    TopicList: "Ämneslista",

    // Select category dropdown

    AllCats: "Alla kategorier",

    // Topic sort order

    Active: "Aktiva",
    ActiveTopics: "Aktiva ämnen",
    ActiveDescr: "Visar nyligen aktiva samtalsämnen först",

    New: "Nya",
    NewTopics: "Nya ämnen",
    NewDescr: "Visar nyligen skapade ämnen först",

    Top: "Topp",
    TopTopics: "Populara ämnen",
    TopDescr: "Shows popular topics first",

    // Topic filter dropdown

    AllTopics: "All topics",

    ShowAllTopics: "Show all topics",
    ShowAllTopicsDescr: "Not deleted topics though",

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

    // These are shown as mouse-hover tooltips, or mobile-phone-touch-tips, over the user
    // avatar icons, in the forum topic list.
    createdTheTopic: "created the topic",
    frequentPoster: "frequent poster",
    mostRecentPoster: "most recent poster",

    inC: "in: ",

    TitleFixed: "This has been fixed",
    TitleDone: "This has been done",
    TitleStarted: "We've started this",
    TitleStartedFixing: "We've started fixing this",
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


  // Topbar

  // Shown at the top of the page. Includes login and signup buttons, or one's username menu.

  tb: {

    // Opens the right hand sidebar and litst the most recent posts in the current topic.
    RecentPosts: "Recent posts",

    // Open right-hand-sidebar button tooltip, if mouse-hovering online-user-count.
    NumOnlChat: " online in this chat",    // example: "5 online in this chat"
    NumOnlForum: " online in this forum",

    // Open left-sidebar button title.
    WatchbBtn: "Your topics",

    // Tooltip, shown if mouse-hovering the open-left-sidebar button.
    WatchbToolt: "Your recent topics, joined chats, direct messages",

    // Title shown on user profile pages.
    AbtUsr: "About User",

    // Shortcuts to leave the user profile page, or staff area, and go back to the discussion topics.
    BackFromUsr: "Back from user profile",
    BackFromAdm: "Back from admin area",

    // Title shown on full text search page.
    SearchPg: "Search Page",
  },


  // Watchbar (the sidebar to the left)

  wb: {
    AddCommunity: "Add ...",
    RecentlyViewed: "Recently viewed",
    JoinedChats: "Joined Chats",
    ChatChannels: "Chat Channels",
    CreateChat: "Create chat channel",
    DirectMsgs: "Direct Messages",
    NoChats: "None",    // meaning: "No chat messages"
    NoDirMsgs: "None",  // meaning: "No direct messages"

    // The click-topic dropdown menu:
    TopicActions: "Topic actions",
    ViewPeopleHere: "View people here",
    ViewAddRemoveMembers: "View / add / remove members",
    ViewChatMembers: "View chat members",
    EditChat: "Edit chat title and purpose",
    LeaveThisChat: "Leave this chat",
    LeaveThisCommunity: "Leave this community",
    JoinThisCommunity: "Join this community",
  },


  // Contextbar (the sidebar to the right)

  cb: {
    RecentComments: "Recent comments in this topic:",
    NoComments: "No comments.",

    YourBookmarks: "Your bookmarks:",

    UsersOnline: "Users online:",
    UsersOnlineForum: "Users online in this forum:",
    UsersInThisChat: "Users in this chat:",
    UsersInThisTopic: "Users in this topic:",

    GettingStartedGuide: "Getting Started Guide",
    AdminGuide: "Admin Guide",
    Guide: "Guide",

    // How to hide the sidebar.
    CloseShortcutS: "Close (keyboard shortcut: S)",

    // ----- Online users list / Users in current topic

    AddPeople: "Add more people",

    // Shown next to one's own username, in a list of users.
    thatsYou: "that's you",

    // Info about which people are online.
    // Example, in English: "Online users: You, and 5 people who have not logged in"
    OnlyYou: "Only you, it seems",
    YouAnd: "You, and ",
    NumStrangers: (numStrangers: number) => {
      const people = numStrangers === 1 ? " person" : " people";
      const have = numStrangers === 1 ? "has" : "have";
      return numStrangers + people + " who " + have + " not logged in";
    },

    // ----- Recent comments list

    // This explains how the Recent tab in the sidebar works.

    RepliesToTheLeft: "The replies to the left are sorted by ",
    bestFirst: "best-first.",
    ButBelow: "But below ",
    insteadBy: " the same replies are instead sorted by ",
    newestFirst: "newest-first.",

    SoIfLeave: "So if you leave, and come back here later, below you'll find ",
    allNewReplies: "all new replies.",
    Click: "Click",
    aReplyToReadIt: " a reply below to read it — because only an excerpt is shown, below.",
  },


  // Discussion / non-chat page

  d: {
    // These texts are split into parts 1,2 or 1,2,3 ec, because in between the texts,
    // icons are shown, to help people understand what those icons mean.

    ThisFormClosed_1: "This form has been ",
    // A Topic-has-been-Closed icon shown here, between text parts 1 (just above) and 2 (below).
    ThisFormClosed_2: "closed; you can no longer fill it in and post it.",

    ThisTopicClosed_1: "This topic has been ",
    // A Topic-has-been-Closed icon, + the text "closed", shown here.
    ThisTopicClosed_2: ". You can still post comments.",

    ThisQuestSloved_1: "This is a question and it has been ",
    // A  Topic-has-been-Answered icon shown here.
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

    ThreadDeld: "Thread deleted",
    CmntDeld: "Comment deleted",
    PostDeld: "Post deleted",
    DiscDeld: "Discussion deleted",
    PageDeld: "Page deleted",
    TitlePendAppr: "Title pending approval",
    TextPendingApproval: "Text pending approval",

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

    AboveBestFirst: "Above: Replies, best first.",
    BelowCmtsEvents: "Below: Comments and events.",

    BottomCmtExpl_1: "You're adding a comment that will stay at the bottom of the page. " +
        "It won't rise to the top even if it gets upvotes.",
    BottomCmtExpl_2: "This is useful for status messages, e.g. to clarify why you close/reopen " +
        "a topic. Or for suggesting changes to the original post.",
    BottomCmtExpl_3: "To reply to someone, click Reply instead.",

    AddComment: "Add comment",
    AddBottomComment: "Add bottom comment",

    PostHiddenClickShow: "Post hidden; click to show",
    ClickSeeMoreRepls: "Click to show more replies",
    ClickSeeMoreComments: "Click to show more comments",
    ClickSeeThisComment: "Click to show this comment",
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


  // Metabar

  // Shown between the original post and all replies.

  mb: {
    NotfsAbtThisC: "Notifications about this topic:",

    // If is a direct message topic, members listed below this text.
    Msg: "Message",

    SmrzRepls: "Summarize Replies",

    // Don't bother about being correct with "1 reply", "2,3,4 replies".
    // Just write "replies" always instead? (also if only one)

    EstTime: (numReplies: number, minutes: number) =>
        `There are ${numReplies} replies. Estimated reading time: ${minutes} minutes`,

    DoneSummarizing: (numSummarized: number, numShownBefore: number) =>
        `Done. Summarized ${numSummarized} replies, of the ${numShownBefore} replies previously shown.`,
  },


  // Post actions

  pa: {
    ReplyToOp: "Reply to the Original Post",

    CloseOwnQuestionTooltip: "Close this question if you don't need an answer any more.",
    CloseOthersQuestionTooltip: "Close this question if it doesn't need an answer, e.g. if " +
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


  // Share dialog

  sd: {
    Copied: "Copied.",
    CtrlCToCopy: "Hit CTRL+C to copy.",
    ClickToCopy: "Click to copy link.",
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
    MoreNotfs: "View all notifications",
    DismNotfs: "Mark all as read",
    ViewProfile: "View your profile",
    LogOut: "Log out",
    UnhideHelp: "Unhide help messages",
  },


  // Scroll buttons

  sb: {
    ScrollToC: "Scroll to:",
    Scroll: "Scroll",

    // The Back button, and the letter B is a keyboard shortcut.
    // If in your language, "Back" doesn't start with 'B', then instead
    // set Back_1 to '' (empty text), and Back_2 to:  "Back (B)" — and "Back" (but not "B")
    // translated to your language.
    Back_1: "B",
    Back_2: "ack",
    BackExpl: "Scroll back to your previous position on this page",

    // These are useful on mobile — then, no keybard with Home (= scroll to top) and End buttons.
    // And, on a keyboard, once you get used to it, it's quite nice to click 1 to go to the
    // top, and 2 to see the first reply, and B to go back, F forward, so on.
    PgTop: "Page top",
    PgTopHelp: "Go to the top of the page. Shortcut: 1 (on a keyboard)",
    Repl: "Replies",
    ReplHelp: "Go to the Replies section. Shortcut: 2",
    Progr: "Progress",
    // The Progress section is at the end of the page, and there, things like
    // "Alice changed status to Doing" and "Alise marked this as Done" and "Topic closed by ..."
    // are shown. (And, optionally, comments by staff or the people working with the issue.)
    ProgrHelp: "Go to the Progress section. Shortcut: 3",
    PgBtm: "Page bottom",
    Btm: "Bottom",
    BtmHelp: "Go to the bottom of the page. Shortcut: 4",

    // "Keyboard shrotcuts: ..., and B to scroll back"
    Kbd_1: ", and ",
    // then the letter 'B' (regardless of language)
    Kbd_2: " to scroll back",
  },


  // About user dialog

  aud: {
    IsMod: "Is moderator.",
    IsAdm: "Is administrator.",
    IsDeld: "Is deactivated or deleted.",
    ThisIsGuest: "This is a guest user, could in fact be anyone.",
    ViewInAdm: "View in Admin Area",
    ViewProfl: "View Profile",
    ViewComments: "View other comments",
    RmFromTpc: "Remove from topic",
    EmAdrUnkn: "Email address unknown — this guest won't be notified about replies.",
  },


  // User's profile page

  upp: {
    // ----- Links

    Preferences: "Preferences",
    Invites: "Invites",
    About: "About",
    Privacy: "Privacy",
    Account: "Account",

    // ----- Overview stats

    JoinedC: "Joined: ",
    PostsMadeC: "Posts made: ",
    LastPostC: "Last post: ",
    LastSeenC: "Last seen: ",
    TrustLevelC: "Trust level: ",

    // ----- Action buttons

    // ----- Profile pic

    UploadPhoto: "Upload photo",
    ChangePhoto: "Change photo",
    ImgTooSmall: "Image too small: should be at least 100 x 100",

    // ----- Activity

    OnlyStaffCanSee: "Only staff and trusted core members, can see this.",
    OnlyMbrsCanSee: "Only people who have been active members for a while can see this.",
    Nothing: "Nothing to show",
    Posts: "Posts",
    NoPosts: "No posts.",
    Topics: "Topics",
    NoTopics: "No topics.",

    // ----- User status

    UserBanned: "This user is banned",
    UserSuspended: (dateUtc: string) => `This user is suspended until ${dateUtc} UTC`,
    ReasonC: "Reason: ",

    DeactOrDeld: "Has been deactivated or deleted.",
    isGroup: " (a group)",
    isGuest: " — a guest user, could be anyone",
    isMod: " – moderator",
    isAdmin: " – administrator",
    you: "(you)",

    // ----- Notifications page

    NoNotfs: "No notifications",
    NotfsToYouC: "Notifications to you:",
    NotfsToOtherC: (name: string) => `Notifications to ${name}:`,

    // ----- Invites page

    InvitesIntro: "Here you can invite people to join this site. ",
    InvitesListedBelow: "Invites that you have already sent are listed below.",
    NoInvites: "You have not invited anyone yet.",

    InvitedEmail: "Invited email",
    WhoAccepted: "Member who accepted",
    InvAccepted: "Invitation accepted",
    InvSent: "Invitation sent",

    SendAnInv: "Send an Invite",
    SendInv: "Send Invite",
    SendInvExpl:
        "We'll send your friend a brief email, and he or she then clicks a link " +
        "to join immediately, no login required. " +
        "He or she will become a normal member, not a moderator or admin.",
    //EnterEmail: "Enter email",
    InvDone: "Done. I'll send him/her an email.",
    //InvErrJoinedAlready: "He or she has joined this site already",
    //InvErrYouInvAlready: "You have invited him or her already",

    // ----- Preferences, About

    AboutYou: "About you",
    WebLink: "Any website or page of yours.",

    NotShownCannotChange: "Not shown publicly. Cannot be changed.",

    // The full name or alias:
    NameOpt: "Name (optional)",

    NotShown: "Not shown publicly.",

    // The username:
    MayChangeFewTimes: "You may change it only a few times.",
    notSpecified: "(not specified)",
    ChangeUsername_1: "You may change your username only a few times.",
    ChangeUsername_2: "Changing it too often can make others confused — " +
        "they won't know how to @mention you.",

    NotfAboutAll: "Be notified about every new post (unless you mute the topic or category)",
    NotfAboutNewTopics: "Be notified about new topics (unless you mute the category)",  // MISSING

    ActivitySummaryEmails: "Activity summary emails",

    EmailSummariesToGroup:
        "When members of this group don't visit here, then, by default, email them " +
        "summaries of popular topics and other stuff.",
    EmailSummariesToMe:
        "When I don't visit here, email me " +
        "summaries of popular topics and other stuff.",

    AlsoIfTheyVisit: "Email them also if they visit here regularly.",
    AlsoIfIVisit: "Email me also if I visit here regularly.",

    HowOftenWeSend: "How often shall we send these emails?",
    HowOftenYouWant: "How often do you want these emails?",

    // ----- Preferences, Privacy

    HideActivityStrangers_1: "Hide your recent activity for strangers and new members?",
    HideActivityStrangers_2: "(But not for those who have been active members for a while.)",
    HideActivityAll_1: "Hide your recent activity for everyone?",
    HideActivityAll_2: "(Except for staff and trusted core members.)",

    // ----- Preferences, Account

    // About email address:
    EmailAddresses: "Email addresses",
    PrimaryDot: "Primary. ",
    VerifiedDot: "Verified. ",
    NotVerifiedDot: "Not verified. ",
    ForLoginWithDot: (provider: string) => `For login with ${provider}. `,
    MakePrimary: "Make Primary",
    AddEmail: "Add email address",
    TypeNewEmailC: "Type a new email address:",
    MaxEmailsInfo: (numMax: number) => `(You cannot add more than ${numMax} addresses.)`,
    EmailAdded_1: "Added. We've sent you a verification email — ",
    EmailAdded_2: "check your email inbox.",
    SendVerifEmail: "Send verification email",

    EmailStatusExpl:
        "('Primary' means you can login via this address, and we send notifications to it. " +
        "'Verified' means you clicked a verification link in an address verification email.)",

    // Logins:
    LoginMethods: "Login methods",
    commaAs: ", as: ",

    // One's data:
    YourContent: "Your content",
    DownloadPosts: "Download posts",
    DownloadPostsHelp: "Creates a JSON file with a copy of topics and comments you've posted.",
    DownloadPersData: "Download personal data",
    DownloadPersDataHelp: "Creates a JSON file with a copy of your personal data, e.g. your name " +
        "(if you specified a name) and email address.",


    // Delete account:
    DangerZone: "Danger zone",
    DeleteAccount: "Delete account",
    DeleteYourAccountQ:
        "Delete your account? We'll remove your name, forget your email address, password and " +
        "any online identities (like Facebook or Twitter login). " +
        "You won't be able to login again. This cannot be undone.",
    DeleteUserQ:
        "Delete this user? We'll remove the name, forget the email address, password and " +
        "online identities (like Facebook or Twitter login). " +
        "The user won't be able to login again. This cannot be undone.",
    YesDelete: "Yes, delete",
  },


  // Create user dialog

  cud: {
    CreateUser: "Create User",
    CreateAccount: "Create Account",
    LoginAsGuest: "Login as Guest",
    EmailPriv: "Email: (will be kept private)",
    EmailOptPriv: "Email: (optional, will be kept private)",
    EmailVerifBy_1: "Your email has been verified by ",
    EmailVerifBy_2: ".",
    Username: "Username: (unique and short)",
    FullName: "Full name: (optional)",

    OrCreateAcct_1: "Or ",
    OrCreateAcct_2: "create an account",
    OrCreateAcct_3: " with ",
    OrCreateAcct_4: "@username",
    OrCreateAcct_5: " & password",

    DoneLoggedIn: "Account created. You have been logged in.",  // COULD say if verif email sent too?
    AlmostDone:
        "Almost done! You just need to confirm your email address. We have " +
        "sent an email to you. Please click the link in the email to activate " +
        "your account. You can close this page.",
  },


  // Accept terms and privacy policy?

  terms: {
    TermsAndPrivacy: "Terms and Privacy",

    Accept_1: "Do you accept our ",
    TermsOfService: "Terms of Service",
    TermsOfUse: "Terms of Use",
    Accept_2: " and ",
    PrivPol: "Privacy Policy",
    Accept_3_User: "?",
    Accept_3_Owner: " for site owners?",  // (see just below)

    // About "for site owners?" above:
    // That's if someone creates his/her own community, via this software provided as
    // Software-as-a-Service hosting. Then, there is / will-be a bit different
    // Terms-of-Service to agree with, since being a community maintainer/owner, is different
    // (more responsibility) than just signing up to post comments.

    YesAccept: "Yes I accept",
  },


  // Password input

  pwd: {
    PasswordC: "Lösenord:",
    StrengthC: "Styrka: ",
    FairlyWeak: "Ganska svagt.",
    toShort: "för kort",
    TooShort: (minLength: number) => `För kort. Ska vara minst ${minLength} bokstäver`,
    PlzInclDigit: "Ta med en siffra eller ett specialtecken (t.ex. !?@) också",
    TooWeak123abc: "För svagt. Använd inte lösenord som '12345' eller 'abcde'.",
    AvoidInclC: "Ha inte med (delar av) ditt namn eller email i lösenordet:",
  },


  // Login dialog

  ld: {
    NotFoundOrPrivate: "Page not found, or Access Denied.",

    // This is if you're admin, and click the Impersonate button to become someone else
    // (maybe to troubleshoot problems with his/her account s/he has asked for help about),
    // and then you, being that other user, somehow happen to open a login dialog
    // (maybe because of navigating to a different part of the site that the user being
    // impersonated cannot access) — then, that error message is shown: You're not allowed
    // to login as *someone else* to access that part of the community, until you've first
    // stopped impersonating the first user. (Otherwise, everything gets too complicated.)
    IsImpersonating: "You're impersonating someone, who might not have access to all parts " +
        "of this website.",

    IfYouThinkExistsThen: "If you think the page exists, log in as someone who may access it. ",
    LoggedInAlready: "(You are logged in already, but perhaps it's the wrong account?) ",
    ElseGoToHome_1: "Otherwise, you can ",
    ElseGoToHome_2: "go to the homepage.",

    CreateAcconut: "Create account",
    SignUp: "Sign up",
    LogIn: "Log in",
    with_: "with ",
    LogInWithPwd: "Log in with Password",
    CreateAdmAcct: "Create admin account:",
    AuthRequired: "Authentication required to access this site",
    LogInToLike: "Log in to Like this post",
    LogInToSubmit: "Log in and submit",
    LogInToComment: "Log in to write a comment",
    LogInToCreateTopic: "Log in to create topic",

    AlreadyHaveAcctQ: "Already have an account? ",
    LogInInstead_1: "",
    LogInInstead_2: "Log in",   // "Log in" (this is a button)
    LogInInstead_3: " instead", // "instead"

    NewUserQ: "New user? ",
    SignUpInstead_1: "",
    SignUpInstead_2: "Sign up",
    SignUpInstead_3: " instead",

    OrCreateAcctHere: "Or create account:",
    OrTypeName: "Or type your name:",
    OrFillIn: "Or fill in:",

    BadCreds: "Wrong username or password",

    UsernameOrEmailC: "Username or email:",
    PasswordC: "Password:",
    ForgotPwd: "Did you forget your password?",

    NoPwd: "You have not yet chosen a password.",
    CreatePwd: "Create password",
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


  // Help message dialog
  help: {
    YouCanShowAgain_1: "You can show help messages again, if you are logged in, by " +
        "clicking your name and then ",
    YouCanShowAgain_2: "Unhide help messages",
  },


  // Editor

  e: {
    //WritingSomethingWarning: "You were writing something?",
    UploadMaxOneFile: "Sorry but currently you can upload only one file at a time",
    PleaseFinishPost: "Please first finish writing your post",
    PleaseFinishChatMsg: "Please first finish writing your chat message",
    PleaseFinishMsg: "Please first finish writing your message",
    PleaseSaveEdits: "Please first save your current edits",
    PleaseSaveOrCancel: "Please first either save or cancel your new topic",
    CanContinueEditing: "You can continue editing your text, if you open the editor again.",
        //"(But the text will currently be lost if you leave this page.)",
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


  // Join sub community dialog

  jscd: {
    NoMoreToJoin: "No more communities to join.",
    SelCmty: "Select community ...",
  },


  // Search dialogs and the search page.
  s: {
    TxtToFind: "Text to search for",
  }

};


