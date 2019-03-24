/// <reference path="../../client/app-slim/translations.d.ts"/>

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

var t_en_US: TalkyardTranslations = t = {

  // A single or a few words, sorted alphabetically, to reuse everywhere.

  Active: "在线",
  Activity: "行为",
  Add: "新增",
  AddingDots: "新增中 ...",
  Admin: "管理员",
  AdvSearch: "高级搜索",
  Away: "离开",
  Back: "返回",
  BlogN: "博客",
  Bookmarks: "书签",
  Cancel: "取消",
  Categories: "分类",
  Category: "分类",
  Continue: "继续",
  ClickToShow: "点击查看",
  ChangeDots: "更改 ...",
  ChatN: "对话",
  CheckYourEmail: "查看您的邮箱",
  Close: "关闭",
  closed: "已关闭",
  Created: "已创建",
  Delete: "删除",
  Discussion: "讨论",
  EditV: "编辑",
  EmailAddress: "邮箱地址",
  EmailAddresses: "邮箱地址",
  Forum: "论坛",
  Hide: "隐藏",
  Home: "主页",
  Idea: "想法",
  Join: "加入",
  KbdShrtcsC: "键盘快捷键: ",
  Loading: "读取中...",
  LoadMore: "加载更多",
  LogIn: "登录",
  LoggedInAs: "登录为",
  LogOut: "登出",
  MessageN: "消息",
  MoreDots: "更多...",
  Move: "移动",
  Name: "名字",
  NameC: "名字: ",
  Notifications: "提醒",
  NotImplemented: "(未实现)",
  NotYet: "未准备好",
  NoTopics: "缺少主题。",
  Okay: "OK",
  OkayDots: "Ok ...",
  Online: "在线",
  onePerLine: "每行一个",
  PreviewV: "预览",
  Problem: "错误",
  Question: "问题",
  Recent: "最近",
  Remove: "移除",
  Reopen: "重新打开",
  ReplyV: "回复",
  Replies: "回复",
  replies: "回复",
  Save: "保存",
  SavingDots: "保存中 ...",
  SavedDot: "已保存。",
  Search: "搜索",
  SendMsg: "发送消息",
  SignUp: "注册",
  Solution: "解决方案",
  Summary: "总结",
  Submit: "提交",
  Tools: "工具",
  Topics: "话题",
  TopicType: "话题类型",
  UploadingDots: "上传中...",
  Username: "用户名",
  Users: "用户",
  Welcome: "欢迎",
  Wiki: "维基",
  You: "你",
  you: "你",

  // Trust levels.
  Guest: "访客",
  NewMember: "新用户",
  BasicMember: "基础用户",
  FullMember: "完整用户",
  TrustedMember: "可信任的用户",
  RegularMember: "Trusted regular",  // MISSING renamed Regular Member —> Trusted Regular [RENREGLS]
  CoreMember: "核心用户",

  // Periods.
  PastDay: "最近一天",
  PastWeek: "最近一周",
  PastMonth: "最近一个月",
  PastQuarter: "最近一季度",
  PastYear: "最近一年",
  AllTime: "所有时间",

  // Time ago letters.
  // English examples: "3d" in forum topic list means 3 days ago. "5h" is 5 hours.
  monthsLtr: "月",  // months
  daysLtr: "日",      // days
  hoursLtr: "小时",     // hours 
  minsLtr: "分",      // minutes 
  secsLtr: "秒",      // seconds 

  // Time ago, long text versions.
  daysAgo: (numDays: number) =>
    numDays === 1 ? "1天前" : `${numDays}天前`,

  hoursAgo: (numHours: number) =>
    numHours === 1 ? "1小时前" : `${numHours}小时前`,

  minutesAgo: (numMins: number) =>
    numMins === 1 ? "1分钟前" : `${numMins}分钟前`,

  secondsAgo: (numSecs: number) =>
    numSecs === 1 ? "1秒钟前" : `${numSecs}秒钟前`,


  // Input fields, e.g. email, name etc.

  inp: {
    // Email address input field:
    EmReq: "需要邮箱地址",
    NoSpcs: "请不要填写空格",
    InvldAddr: "邮箱地址无效",
    NoBadChrs: "请不要输入非法符号",

    // Full name input field:
    NotOnlSpcs: "请不要只填写空格",
    NoAt: "请不要使用@",

    // Username input field:
    NoDash: "请不要使用破折号(-)",
    DontInclAt: "请不要包含@",
    StartEndLtrDgt: "开头及结尾请使用字母或数字",
    OnlLtrNumEtc: "仅允许使用字母(a-z, A-Z), 数字，和下划线_",
    // This shown just below the username input:
    UnUnqShrt_1: "你的",
    UnUnqShrt_2: "@username",
    UnUnqShrt_3: ", 独特且简短",

    // Generic messages for all input fields:
    TooShort: (minLength: number) => `请至少输入${minLength}个字符`,
    TooLong: (maxLength: number) => `太长了。最多输入${maxLength}个字符`,
  },


  // Notification levels.

  nl: {
    EveryPost: "所有帖子",
    EveryPostInTopic: "您将会收到这个话题下的所有新回复的提醒。",
    EveryPostInCat: "您将会收到这个分类下的所有新话题和回复的提醒。",
    EveryPostInTopicsWithTag: "您将会收到带有该标签的新话题，及这些话题下的所有回复的提醒。",
    EveryPostWholeSite: "您将会收到所有新话题及回复的提醒。",

    // One will be notified about the *first* post in a new topic, only. That is, the Original Post
    // (that's what the first post is called, in a discussion forum topic).
    NewTopics: "新的话题",
    NewTopicsInCat: "您将会收到这个分类下所有新主题的提醒。",
    NewTopicsWithTag: "您将会收到带有该标签的新话题的提醒。",
    NewTopicsWholeSite: "您将会收到所有新话题的提醒。",

    Tracking: "实时更新",

    Normal: "普通",
    NormalDescr: "如果有人和您对话，您将收到提醒。包括间接的消息，例如某人回复了曾回复您的消息。",
    //NormalTopic_1: "You'll be notified if someone talks to you, or mentions your ", "通知我新对话消息，或提到我的消息"
    //NormalTopic_2: "@name", "@名称"

    Hushed: "安静",
    HushedDescr: "只有某人直接和您对话时，您才会收到提醒。",

    Muted: "静音",
    MutedTopic: "不接收新提醒",   // MISSING removed "about this topic"
  },


  // Forum intro text

  fi: {
    Edit: "编辑",
    Hide_1: "隐藏",
    Hide_2: "，点击",
    Hide_3: "来重新打开",
  },


  // Forum buttons

  fb: {

    TopicList: "话题列表",

    // Select category dropdown

    from: "从",  // MISSING used like so:  "From <Category Name>" or "From All Categories"
    in: "属于",      // MISSING used like so:  "in <Category Name>" or "in All Categories"
    AllCats: "所有分类",

    // Topic sort order

    Active: "Active first",      // MISSING didn't add "first" yet to transls
    ActiveTopics: "Active topics", // REMOVE use "Active first" instead
    ActiveDescr: "优先显示被最新回复的话题",

    New: "新",
    NewTopics: "New topics",     // REMOVE no longer needed, after forum btns redone
    NewDescr: "优先显示最新发布的话题",

    Top: "热门",              // MISSING didn't rename from Top to Popular in transls
    TopTopics: "Popular topics", // REMOVE not needed, after forum btns redone
    TopDescr: "优先显示最热门话题",

    // Topic filter dropdown

    AllTopics: "所有话题",

    ShowAllTopics: "显示所有话题",
    ShowAllTopicsDescr: "Not deleted topics though",

    WaitingTopics: "Waiting topics",          // MISSING
    OnlyWaiting: "Only waiting",
    OnlyWaitingDescr_1: "Shows only topics ", // MISSING changed "questions" to "topics"
    OnlyWaitingDescr_2: "waiting ",
    OnlyWaitingDescr_3: "for a solution or to be implemented and done",  // MISSING rewrote

    YourTopics: "Your topics",       // MISSING
    AssignedToYou: "Assigned to you", // MISSING

    DeletedTopics: "Show deleted",   // MISSING
    ShowDeleted: "显示已删除",
    ShowDeletedDescr: "显示所有主题，包括已删除的主题",

    // Rightmost buttons

    ViewCategories: "View categories",  // MISSING
    EditCat: "编辑分类",
    CreateCat: "创建分类",
    CreateTopic: "创建话题",
    PostIdea: "发布新想法",
    AskQuestion: "提出新问题",
    ReportProblem: "报告新错误",
    CreateMindMap: "创建思维导图",
    CreatePage: "创建页面",

  },


  // Forum topic list

  ft: {
    ExplIcons: "解释图标...",
    IconExplanation: "图标说明: ",
    ExplGenDisc: "一个讨论。",
    ExplQuestion: "一个尚未有最佳答案的问题。",
    ExplAnswer: "一个已有最佳答案的问题。",
    ExplIdea: "一个新想法/建议。",
    ExplProblem: "一个错误。",
    ExplPlanned: "计划实现的功能或将要修复的错误。",
    ExplDone: "已实现的功能或已修复的错误。",
    ExplClosed: "已关闭话题。",
    ExplPinned: "置顶话题（或某一分类的置顶话题）。",

    PopularTopicsComma: "热门话题，",
    TopFirstAllTime: "优先展示所有时间的热门话题。",
    TopFirstPastDay: "优先展示昨天的热门话题。",

    CatHasBeenDeleted: "这个分类已被删除",

    TopicsActiveFirst: "最近活跃的话题",
    TopicsNewestFirst: "最新发布的话题",

    CreatedOn: "创建于",
    LastReplyOn: "\n最近回复于",
    EditedOn: "\n编辑于",

    // These are shown as mouse-hover tooltips, or mobile-phone-touch-tips, over the user
    // avatar icons, in the forum topic list.
    createdTheTopic: "创建该话题",
    frequentPoster: "活跃的发布者",
    mostRecentPoster: "最新的发布者",

    inC: "在: ",

    TitleFixed: "已被修复",
    TitleDone: "已完成",
    TitleStarted: "已开始",
    TitleStartedFixing: "正在修复",
    TitleUnsolved: "尚未解决的问题",
    TitleIdea: "新想法",
    TitlePlanningFix: "计划修复中",
    TitlePlanningDo: "计划中",
    TitleChat: "聊天频道",
    TitlePrivateChat: "私聊频道",
    TitlePrivateMessage: "一条私聊信息",
    TitleInfoPage: "信息页面",
    TitleDiscussion: "讨论",
    IsPinnedGlobally: "\nn已经被置顶，将会优先展示。",
    IsPinnedInCat: "\n已经在分类中被置顶，将会在所属分类中优先显示。",
  },


  // Forum categories list

  fc: {
    RecentTopicsWaiting: "最近的话题 (待回答)",
    RecentTopicsInclDel: "最近的话题 (包含已删除)",
    RecentTopics: "最近的话题",
    _replies: "回复",
    _deleted: " (已删除)",
    _defCat: " (默认分类)",
  },


  // Topbar

  // Shown at the top of the page. Includes login and signup buttons, or one's username menu.

  tb: {

    // Opens the right hand sidebar and litst the most recent posts in the current topic.
    RecentPosts: "最近的帖子",

    // Open right-hand-sidebar button tooltip, if mouse-hovering online-user-count.
    NumOnlChat: "用户在聊天中", // example: "5 online in this chat"
    NumOnlForum: "用户在线",

    // Open left-sidebar button title.
    WatchbBtn: "您的话题",

    // Tooltip, shown if mouse-hovering the open-left-sidebar button.
    WatchbToolt: "最近的话题，加入的聊天，发送的信息",

    // Title shown on user profile pages.
    AbtUsr: "关于用户",

    // Shortcuts to leave the user profile page, or staff area, and go back to the discussion topics.
    BackFromUsr: "返回到用户资料",
    BackFromAdm: "返回到管理员页",

    // Title shown on full text search page.
    SearchPg: "搜索页",
  },


  // Watchbar (the sidebar to the left)

  wb: {
    AddCommunity: "新增 ...",
    RecentlyViewed: "最近查看的",
    JoinedChats: "加入的聊天",
    ChatChannels: "聊天频道",
    CreateChat: "创建聊天频道",
    DirectMsgs: "发送信息",
    NoChats: "没有新聊天",    // meaning: "No chat messages"
    NoDirMsgs: "没有新信息",  // meaning: "No direct messages"

    // The click-topic dropdown menu:
    TopicActions: "话题操作",
    ViewPeopleHere: "查看所有用户",
    ViewAddRemoveMembers: "查看/新增/移除用户",
    ViewChatMembers: "查看聊天用户",
    EditChat: "编辑聊天描述",
    //EditChat: "Edit chat title and purpose", // Keep, in case adds back edit-title input
    LeaveThisChat: "离开对话",
    LeaveThisCommunity: "离开这个社群",
    JoinThisCommunity: "加入这个社群",
  },


  // Contextbar (the sidebar to the right)

  cb: {
    RecentComments: "这个话题下的新评论:",
    NoComments: "没有评论。",

    YourBookmarks: "你的书签:",

    UsersOnline: "在线用户:",
    UsersOnlineForum: "论坛在线用户:",
    UsersInThisChat: "聊天在线用户:",
    UsersInThisTopic: "话题在线用户:",

    GettingStartedGuide: "新手指南", // MISSING in other langs, was: "Getting Started Guide".
    AdminGuide: "Admin Guide",          // ... but what? It's here already, just reuse this transl field
    Guide: "指南",

    // How to hide the sidebar.
    CloseShortcutS: "关闭 (快捷键: S)",

    // ----- Online users list / Users in current topic

    AddPeople: "新增成员",

    // Shown next to one's own username, in a list of users.
    thatsYou: "这个是你",

    // Info about which people are online.
    // Example, in English: "Online users: You, and 5 people who have not logged in" "在线用户：你和其他五个未登录成员"
    OnlyYou: "看起来只有你",
    YouAnd: "你以及",
    NumStrangers: (numStrangers: number) => {
      return numStrangers + "人未登录";
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

    ThisFormClosed_1: "这个表格已经被",
    // A Topic-has-been-Closed icon shown here, between text parts 1 (just above) and 2 (below).
    ThisFormClosed_2: "关闭了；已不能在这里填写或发布。",


    ThisTopicClosed_1: "这个话题已经被",
    // A Topic-has-been-Closed icon, + the text "closed", shown here.
    ThisTopicClosed_2: "。你仍然可以在这里留言。",   // SYNC removed "won't make ... bump ..."

    ThisQuestSloved_1: "这个问题已经被",
    // A  Topic-has-been-Answered icon shown here.
    ThisQuestSloved_2: "回答了。",

    ThisQuestWaiting_1: "这是一个",
    ThisQuestWaiting_2: "问题，正等待",
    ThisQuestWaiting_3: "回答。",

    ThisProblSolved_1: "这个错误已经被",
    ThisProblSolved_2: "解决了。",

    ThisProblStarted_1: "这是一个错误，我们",
    ThisProblStarted_2: "正在修复它，还需要一些时间",
    ThisProblStarted_3: "完成。",

    ThisProblPlanned_1: "这是一个错误，我们",
    ThisProblPlanned_2: "计划尽快修复它。",
    ThisProblPlanned_3: "还需要一些时间",
    ThisProblPlanned_4: "完成。",

    ThisProblemNew_1: "这是一个",
    ThisProblemNew_2: "错误，目前还未被",
    ThisProblemNew_3: "解决。",

    ThisIdeaDone_1: "这个功能已经被",
    ThisIdeaDone_2: "实现。",

    ThisIdeaStarted_1: "我们正在",
    ThisIdeaStarted_2: "实现这个功能，还需要一些时间",
    ThisIdeaStarted_3: "完成。",

    ThisIdeaPlanned_1: "我们",
    ThisIdeaPlanned_2: "计划将要实现这个功能。",
    ThisIdeaPlanned_3: "还需要一些时间",
    ThisIdeaPlanned_4: "完成。",

    ThisIdeaNew_1: "这是一个",
    ThisIdeaNew_2: "新想法，还未",
    ThisIdeaNew_3: "列入计划中，未",
    ThisIdeaNew_4: "实现，未",
    ThisIdeaNew_5: "完成。",

    ThisPageDeleted: "这个页面已经被删除",
    CatDeldPageToo: "分类已删除，所以这个页面也被删除了",

    AboutCat: "关于分类:",

    ThreadDeld: "威胁已删除",
    CmntDeld: "评论已删除",
    PostDeld: "帖子已删除",
    DiscDeld: "讨论已删除",
    PageDeld: "页面已删除",
    TitlePendAppr: "标题等待审核中",
    TextPendingApproval: "信息等待审核中",

    TooltipQuestClosedNoAnsw: "这个问题没有最佳回答，已被关闭。",
    TooltipTopicClosed: "这个话题已被关闭。",

    TooltipQuestSolved: "这个问题已被解决",
    TooltipQuestUnsolved: "这个问题还未被解决",

    TooltipProblFixed: "已被修复",
    TooltipDone: "已完成",
    ClickStatusNew: "点击更新状态为新",

    TooltipFixing: "我们正在解决这个",
    TooltipImplementing: "我们正在实现这个",
    ClickStatusDone: "点击标记为完成",

    TooltipProblPlanned: "我们正计划去修复它",
    TooltipIdeaPlanned: "我们正计划去实现它",
    ClickStatusStarted: "点击标记为开始",

    TooltipUnsProbl: "这是一个未解决的错误",
    TooltipIdea: "这是一个想法",
    ClickStatusPlanned: "点击更改状态至计划中",

    TooltipPersMsg: "个人信息",
    TooltipChat: "# means Chat Channel",
    TooltipPrivChat: "这是一个私聊频道",

    TooltipPinnedGlob: "\n在全部论坛置顶。",
    TooltipPinnedCat: "\n在此分类中置顶。",

    SolvedClickView_1: "已解决：#",
    SolvedClickView_2: ", 点击查看",

    AboveBestFirst: "上面：回复，最佳优先",
    BelowCmtsEvents: "下面：评论和事件",

    /* Old. When were called "Bottom comments" instead of "Progress comments".
    BottomCmtExpl_1: "You're adding a comment that will stay at the bottom of the page. " +
        "It won't rise to the top even if it gets upvotes.",
    BottomCmtExpl_2: "This is useful for status messages, e.g. to clarify why you close/reopen " +
        "a topic. Or for suggesting changes to the original post.", */
    // I18N _1 and _2 MISSING, all languages  [BTM2PRGR]
    BottomCmtExpl_1: "You're adding a progress comment, to tell people how you're making progress " +
      "towards answering the question / solving the problem / implementing the idea.",
      //"or maybe why you postpone or close this topic.",
    BottomCmtExpl_2: "Progress comments are appended at the bottom of the page.",
      //"sorted by time (not Like votes).",
    BottomCmtExpl_3: "To reply to someone, click Reply instead.",

    AddComment: "新增评论",
    AddBottomComment: "Add progress comment", //"Add bottom comment", [BTM2PRGR]  I18N MISSING

    PostHiddenClickShow: "发布已隐藏，点击显示",
    ClickSeeMoreRepls: "点击查看更多回复",
    ClickSeeMoreComments: "点击查看更多评论",
    ClickSeeThisComment: "点击查看这条评论",
    clickToShow: "点击查看",

    ManyDisagree: "很多人不同意这条信息: ",
    SomeDisagree: "有些人不同意这条信息: ",

    CmtPendAppr: "评论审核中，已发布。",
    CmtBelowPendAppr: (isYour) => (isYour ? "Your" : "The") + " comment below is pending approval.",

    _and: " 和",

    repliesTo: "回复给",
    dashInReplyTo: "— 回复给",
    InReplyTo: "回复给",

    ClickViewEdits: "点击查看过去的编辑",

    By: "By ", // ... someones name
  },


  // Metabar

  // Shown between the original post and all replies.

  mb: {
    NotfsAbtThisC: "有关这个话题的新消息: ",

    // If is a direct message topic, members listed below this text.
    Msg: "信息",

    SmrzRepls: "总结所有评论",

    // Don't bother about being correct with "1 reply", "2,3,4 replies".
    // Just write "replies" always instead? (also if only one)

    EstTime: (numReplies: number, minutes: number) =>
        `共${numReplies}条回复。预计阅读时间: ${minutes}分钟`,

    DoneSummarizing: (numSummarized: number, numShownBefore: number) =>
        `完成。总结了${numSummarized}条回复, 包含之前显示的${numShownBefore}条回复。`,
  },


  // Post actions

  pa: {
    ReplyToOp: "回复原始帖子",

    CloseOwnQuestionTooltip: "因不再需要回答，关闭这个问题",
    CloseOthersQuestionTooltip: "因不需要回答，关闭这个问题。例如：偏离主题，或别的话题中已被回复。",
    CloseToDoTooltip: "因不再需要修复或完成，关闭这个任务",
    CloseTopicTooltip: "因不再需要关注该问题，关闭这个话题",

    AcceptBtnExpl: "接受它作为这个问题或错误的最佳答案",
    SolutionQ: "最佳答案？",
    ClickUnaccept: "不接受这个回答",
    PostAccepted: "已被选为最佳答案",

    NumLikes: (num: number) => num === 1 ? "1 赞" : num + " 赞",
    NumDisagree: (num: number) => num + " 反对",
    NumBury: (num: number) => num === 1 ? "1 抛弃" : num + " 抛弃",
    NumUnwanted: (num: number) => num === 1 ? "1 不需要" : num + " 不需要",

    MoreVotes: "更多投票...",
    LikeThis: "赞",
    LinkToPost: "到该帖子的链接",
    Report: "举报",
    ReportThisPost: "举报这个帖子",
    Admin: "管理员",

    Disagree: "反对",
    DisagreeExpl: "点击来反对该贴，或警告别人它存在真实性问题。",
    Bury: "抛弃",
    BuryExpl: "降低该贴的排名。只有管理员才能看到你的投票。",
    Unwanted: "不需要",
    UnwantedExpl: "如果您不希望看到这种消息。将会降低该作者的可信值。只有管理员才能看到你的投票。",

    AddTags: "增加/移除 标签",
    UnWikify: "从维基移除",
    Wikify: "加入维基",
    PinDeleteEtc: "置顶 / 删除 / 分类 ...",
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
    PgTopHelp: "Go to the top of the page. Keyboard shortcut: 1",
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

    SendAnInv: "Invite people", // was: "Send an Invite",   MISSING I18N all other langs
    SendInv: "Send invites",   // MISSING I18N is just "Send invite" (singularis) in all other langs
    SendInvExpl:  // MISSING I18N changed to pluralis
        "We'll send your friends a brief email. They'll click a link " +
        "to join immediately, no login required. " +
        "They'll become normal members, not moderators or admins.",
    //EnterEmail: "Enter email(s)",
    InvDone: "Done. I'll send them an email.",
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
    NotfAboutNewTopics: "Be notified about new topics (unless you mute the category)",

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
    PasswordC: "Password:",
    StrengthC: "Strength: ",
    FairlyWeak: "Fairly weak.",
    toShort: "too short",
    TooShort: (minLength: number) => `Too short. Should be at least ${minLength} characters`,
    PlzInclDigit: "Please include a digit or special character",
    TooWeak123abc: "Too weak. Don't use passwords like '12345' or 'abcde'.",
    AvoidInclC: "Avoid including (parts of) your name or email in the password:",
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


