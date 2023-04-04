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
  NoTopics: "缺少话题。",
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
  NewMember: "新成员",
  BasicMember: "基础成员",
  FullMember: "完整成员",
  TrustedMember: "可信任的成员",
  RegularMember: "Trusted regular",  // MISSING renamed Regular Member —> Trusted Regular [RENREGLS] "值得信赖的"
  CoreMember: "核心成员",

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
    EveryPost: "所有贴子",
    EveryPostInTopic: "您将会收到这个话题下的所有新贴子提醒。",
    EveryPostInCat: "您将会收到这个分类下的所有新贴子提醒。",
    EveryPostInTopicsWithTag: "您将会收到带有该标签的新话题，及这些话题下的所有新贴子提醒。",
    EveryPostWholeSite: "您将会收到站内所有新贴子提醒。",

    // One will be notified about the *first* post in a new topic, only. That is, the Original Post
    // (that's what the first post is called, in a discussion forum topic).
    NewTopics: "新的话题",
    NewTopicsInCat: "您将会收到这个分类下所有新话题的提醒。",
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
    ShowAllTopicsDescr: "不包括已删除话题",

    WaitingTopics: "等待中的话题",          // MISSING
    OnlyWaiting: "仅等待中",
    OnlyWaitingDescr_1: "仅显示话题 ", // MISSING changed "questions" to "topics"
    OnlyWaitingDescr_2: "等待",
    OnlyWaitingDescr_3: "一个解决方案被执行或完成",  // MISSING rewrote

    YourTopics: "你的话题",       // MISSING
    AssignedToYou: "分配给你", // MISSING

    DeletedTopics: "显示已删除",   // MISSING
    ShowDeleted: "显示已删除",
    ShowDeletedDescr: "显示所有话题，包括已删除的话题",

    // Rightmost buttons

    ViewCategories: "查看所有分类",  // MISSING
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
    frequentPoster: "活跃的发帖者",
    mostRecentPoster: "最新的发贴者",

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
    RecentPosts: "最近的贴子",

    // Open right-hand-sidebar button tooltip, if mouse-hovering online-user-count.
    NumOnlChat: "聊天用户在线中", // example: "5 online in this chat"
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
    ViewPeopleHere: "查看所有成员",
    ViewAddRemoveMembers: "查看/新增/移除成员",
    ViewChatMembers: "查看聊天成员",
    EditChat: "编辑聊天描述",
    //EditChat: "Edit chat title and purpose", // Keep, in case adds back edit-title input
    LeaveThisChat: "离开对话",
    LeaveThisCommunity: "离开这个社区",
    JoinThisCommunity: "加入这个社区",
  },


  // Contextbar (the sidebar to the right)

  cb: {
    RecentComments: "这个话题下的新评论:",
    NoComments: "没有评论。",

    YourBookmarks: "你的书签:",

    UsersOnline: "在线成员:",
    UsersOnlineForum: "论坛在线成员:",
    UsersInThisChat: "聊天在线成员:",
    UsersInThisTopic: "话题在线成员:",

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
    // Example, in English: "Online users: You, and 5 people who have not logged in" "在线成员：你和其他五个未登录成员"
    OnlyYou: "看起来只有你",
    YouAnd: "你以及",
    NumStrangers: (numStrangers: number) => {
      return numStrangers + "人未登录";
    },

    // ----- Recent comments list

    // This explains how the Recent tab in the sidebar works.

    RepliesToTheLeft: "对左边的回复按 ",
    bestFirst: "最好的排序。",
    ButBelow: "在此之下",
    insteadBy: "相同的回复按照",
    newestFirst: "最新的排序。",

    SoIfLeave: "如果你稍后回来, 会发现",
    allNewReplies: "所有的新回复",
    Click: "点击",
    aReplyToReadIt: "一个回复去阅读它 — 它将只显示摘要在下面。",
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
    PostDeld: "贴子已删除",
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

    PostHiddenClickShow: "贴子已隐藏，点击显示",
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
    NotfsAbtThisC: "有关此帖的新消息: ",

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
    ReplyToOp: "回复原始帖文",

    CloseOwnQuestionTooltip: "因不再需要回答，关闭这个问题",
    CloseOthersQuestionTooltip: "因不需要回答，关闭这个问题。例如：偏离话题，或别的话题中已被回复。",
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
    LinkToPost: "到该贴子的链接",
    Report: "举报",
    ReportThisPost: "举报这个贴子",
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
    Copied: "已复制", 
    CtrlCToCopy: "按Ctrl+C复制", 
    ClickToCopy: "点击复制链接", 
  },


  // Chat

  c: {
    About_1: "这是",
    About_2: "聊天频道，创建者：",
    ScrollUpViewComments: "向上滑动浏览之前的评论",
    Purpose: "目的: ",
    edit: "编辑",
    'delete': "删除",
    MessageDeleted: "(信息已删除)",
    JoinThisChat: "加入聊天",
    PostMessage: "发布信息",
    AdvancedEditor: "高级编辑",
    TypeHere: "在此输入. 你可以使用Markdown和HTML",
  },


  // My Menu

  mm: {
    NeedsReview: "需要评论",
    AdminHelp: "管理员帮助",
    StaffHelp: "员工帮助",
    MoreNotfs: "查看所有通知",
    DismNotfs: "全部标记为已读",
    ViewProfile: "查看您的个人资料",
    LogOut: "登出",
    UnhideHelp: "取消隐藏帮助信息",
  },


  // Scroll buttons

  sb: {
    ScrollToC: "滚动到：",
    Scroll: "滚动",

    // The Back button, and the letter B is a keyboard shortcut.
    // If in your language, "Back" doesn't start with 'B', then instead
    // set Back_1 to '' (empty text), and Back_2 to:  "Back (B)" — and "Back" (but not "B")
    // translated to your language.
    Back_1: "",
    Back_2: "返回 (B)",
    BackExpl: "滚动回到此页面的上一个位置",

    // These are useful on mobile — then, no keybard with Home (= scroll to top) and End buttons.
    // And, on a keyboard, once you get used to it, it's quite nice to click 1 to go to the
    // top, and 2 to see the first reply, and B to go back, F forward, so on.
    PgTop: "页面顶部",
    PgTopHelp: "回到页面顶部，快捷方式 1",
    Repl: "回复",
    ReplHelp: "回到回复部分. 快捷方式 2",
    Progr: "进程",
    // The Progress section is at the end of the page, and there, things like
    // "Alice changed status to Doing" and "Alise marked this as Done" and "Topic closed by ..." "Alice将状态更改为Doing"和"Alise将此标记为已完成"和"注意已被...关闭"
    // are shown. (And, optionally, comments by staff or the people working with the issue.)
    ProgrHelp: "转到进程部分. 快捷方式 3",
    PgBtm: "页面底部",
    Btm: "底部",
    BtmHelp: "转到页面底部. 快捷方式 4",

    // "Keyboard shrotcuts: ..., and B to scroll back" "键盘快捷方式：..., B向后滚动"
    Kbd_1: "和",
    // then the letter 'B' (regardless of language)
    Kbd_2: "向后滚动",
  },


  // About user dialog

  aud: {
    IsMod: "是版主",
    IsAdm: "是管理员",
    IsDeld: "已停用或已删除",
    ThisIsGuest: "这是一个访客用户，事实上可能是任何人",
    ViewInAdm: "在管理员界面查看",
    ViewProfl: "查看个人资料",
    ViewComments: "查看其他评论",
    RmFromTpc: "从话题中删除",
    EmAdrUnkn: "电子邮件地址位置 - 此访客不会收到有关回复的通知",
  },


  // User's profile page

  upp: {
    // ----- Links

    Preferences: "偏好",
    Invites: "邀请",
    About: "关于",
    Privacy: "隐私",
    Account: "账户",

    // ----- Overview stats

    JoinedC: "加入: ",
    PostsMadeC: "贴子：: ",
    LastPostC: "上一篇贴子: ",
    LastSeenC: "上次浏览: ",
    TrustLevelC: "信任级别: ",

    // ----- Action buttons

    // ----- Profile pic

    UploadPhoto: "上传照片",
    ChangePhoto: "更改照片",
    ImgTooSmall: "图像尺寸太小，至少应该是100*100像素",

    // ----- Activity

    OnlyStaffCanSee: "只有员工和受信任的核心成员，才可以看到这些。",
    OnlyMbrsCanSee: "只有长期的活跃成员才能看到的内容",
    Nothing: "没什么可展示的",
    Posts: "贴子",
    NoPosts: "没有贴子.",
    Topics: "话题",
    NoTopics: "没有话题.",

    // ----- User status

    UserBanned: "此用户被禁言",
    UserSuspended: (dateUtc: string) => `此用户被禁言，直到 ${dateUtc} UTC`,
    ReasonC: "理由: ",

    DeactOrDeld: "已停用或已删除",
    isGroup: " (组)",
    isGuest: " — 访客成员，可能是任何人",
    isMod: " – 版主",
    isAdmin: " – 管理员",
    you: "(你)",

    // ----- Notifications page

    NoNotfs: "没有通知",
    NotfsToYouC: "给你的通知:",
    NotfsToOtherC: (name: string) => `${name}的通知:`,

    // ----- Invites page

    InvitesIntro: "您可以邀请其他人加入论坛。",
    InvitesListedBelow: "您已经发送的邀请列表如下。",
    NoInvites: "您还没有邀请任何人。",

    InvitedEmail: "邀请的电子邮件",
    WhoAccepted: "已接受的成员",
    InvAccepted: "接受邀请",
    InvSent: "发送邀请",

    SendAnInv: "邀请别人", // was: "Send an Invite",   MISSING I18N all other langs
    SendInv: "发送邀请",   // MISSING I18N is just "Send invite" (singularis) in all other langs
    SendInvExpl:  // MISSING I18N changed to pluralis
        "我们会给你的朋友发一封简短的电子邮件. 他们需要点击链接 " +
        "即可立即加入，无需登录。" +
        "他们将成为普通会员，而不是版主或管理员。",
    //EnterEmail: "Enter email(s)",
    InvDone: "已完成。我们会尽快给他们发送邮件。",
    //InvErrJoinedAlready: "He or she has joined this site already",
    //InvErrYouInvAlready: "You have invited him or her already",

    // ----- Preferences, About

    AboutYou: "关于你",
    WebLink: "您的任何网站或网页。",

    NotShownCannotChange: "未公开显示，无法更改。",

    // The full name or alias:
    NameOpt: "名称 (可选)",

    NotShown: "未公开显示。",

    // The username:
    MayChangeFewTimes: "更改用户名的次数是受限制的。",
    notSpecified: "(未指定)",
    ChangeUsername_1: "更改用户名的次数是受限制的。",
    ChangeUsername_2: "频繁地更改用户名会让其他用户感到困惑 — " +
        "他们将不知道该如何 @你。",

    NotfAboutAll: "收到有关每个新贴子的通知(除非您将话题或分类屏蔽)",
    NotfAboutNewTopics: "收到有关新话题的通知(除非您将分类屏蔽)",

    ActivitySummaryEmails: "活动摘要电子邮件",

    EmailSummariesToGroup:
        "当这个小组的成员未访问时，默认情况下，通过电子邮件发送给他们" +
        "热门话题和其他内容的摘要。",
    EmailSummariesToMe:
        "当我未访问时，通过电子邮件发送给我" +
        "热门话题和其他内容的摘要。",

    AlsoIfTheyVisit: "即便他们定期访问这里，也会给他们发送电子邮件。",
    AlsoIfIVisit: "即便我定期访问这里，也会给我发送电子邮件。",

    HowOftenWeSend: "我们多久发送一次这些电子邮件？",
    HowOftenYouWant: "您想多久收到一次这些电子邮件？",

    // ----- Preferences, Privacy

    HideActivityStrangers_1: "对陌生人和新访客隐藏您最近的发言?",
    HideActivityStrangers_2: "(但对那些经常活跃的成员不隐藏)",
    HideActivityAll_1: "对所有人隐藏您最近的发言?",
    HideActivityAll_2: "(除了员工和可信任的核心会员)",

    // ----- Preferences, Account

    // About email address:
    EmailAddresses: "电子邮件地址",
    PrimaryDot: "首要的.",
    VerifiedDot: "已验证。",
    NotVerifiedDot: "未验证。",
    ForLoginWithDot: (provider: string) => `用于登录${provider}。`,
    MakePrimary: "设为首要的",
    AddEmail: "添加邮箱地址",
    TypeNewEmailC: "输入新的邮箱地址:",
    MaxEmailsInfo: (numMax: number) => `(你不能添加超过${numMax}的邮箱地址)`,
    EmailAdded_1: "已添加。我们已向您发送了验证邮件 — ",
    EmailAdded_2: "查看您的收件箱。",
    SendVerifEmail: "发送验证邮件",

    EmailStatusExpl:
        "('首要的'意味着您可以通过这个地址登录，我们会向这个地址发送通知。" +
        "'已验证'意味着您已经点击了我们发送的验证邮件中的验证链接)",

    // Logins:
    LoginMethods: "登录方式",
    commaAs: ", as: ",

    // One's data:
    YourContent: "你的内容",
    DownloadPosts: "下载贴子",
    DownloadPostsHelp: "创建一个包含您发布的话题和评论的副本的JSON文件。",
    DownloadPersData: "下载个人数据",
    DownloadPersDataHelp: "创建一个包含您个人数据副本的JSON文件，例如您的名字" +
        "和电子邮件地址（如果您有特定名称）",


    // Delete account:
    DangerZone: "危险区域",
    DeleteAccount: "删除账户",
    DeleteYourAccountQ:
        "删除您的账户？我们会删除您的姓名，电子邮件地址，密码和 " +
        "任何在线的身份信息(如Facebook或Twitter的登录信息)。" +
        "您将无法再次登录. 这是无法撤销的。",
    DeleteUserQ:
        "删除这个账户？我们会删除您的姓名、电子邮件地址、密码和" +
        "任何在线的身份信息(如Facebook或Twitter的登录信息)。" +
        "此账户将无法再次登录. 这是无法撤销的。",
    YesDelete: "是的, 确认删除",
  },


  // Create user dialog

  cud: {
    CreateUser: "创建用户",
    CreateAccount: "创建账户",
    LoginAsGuest: "以访客身份登录",
    EmailPriv: "邮箱地址:(只有您自己可见)",
    EmailOptPriv: "邮箱地址(可选，只有您自己可见):",
    EmailVerifBy_1: "您的电子邮件已验证",
    EmailVerifBy_2: "。",
    Username: "用户名(简短且唯一):",
    FullName: "全名(可选):",

    OrCreateAcct_1: "或",
    OrCreateAcct_2: "创建一个账户",
    OrCreateAcct_3: "通过",
    OrCreateAcct_4: "@用户名",
    OrCreateAcct_5: "和密码",

    DoneLoggedIn: "账户已创建. 您现在可以登录.",  // COULD say if verif email sent too?
    AlmostDone:
        "快完成了！只需要填写您的邮箱地址. 我们会" +
        "发一封验证邮件给您. 请点击邮件中的链接激活" +
        "您的账户. 现在您可以关闭此页面了。",
  },


  // Accept terms and privacy policy?

  terms: {
    TermsAndPrivacy: "条款和隐私",

    Accept_1: "是否接受我们的",
    TermsOfService: "服务条款",
    TermsOfUse: "使用条款",
    Accept_2: "和",
    PrivPol: "隐私政策",
    Accept_3_User: "?",
    Accept_3_Owner: "对于网站所有者?",  // (see just below)

    // About "for site owners?" above:
    // That's if someone creates his/her own community, via this software provided as
    // Software-as-a-Service hosting. Then, there is / will-be a bit different
    // Terms-of-Service to agree with, since being a community maintainer/owner, is different
    // (more responsibility) than just signing up to post comments.

    YesAccept: "是的，我接受",
  },


  // Password input

  pwd: {
    PasswordC: "密码:",
    StrengthC: "强度: ",
    FairlyWeak: "相当弱.",
    toShort: "太短了",
    TooShort: (minLength: number) => `太短了. 应该至少${minLength}个字符`,
    PlzInclDigit: "请至少包含一个数字或特殊字符",
    TooWeak123abc: "太弱了. 请不要使用像'12345'或'abcde'这样的密码",
    AvoidInclC: "请不要在密码中包含您的姓名和邮箱地址:",
  },


  // Login dialog

  ld: {
    NotFoundOrPrivate: "找不到页面, 或访问被拒绝.",

    // This is if you're admin, and click the Impersonate button to become someone else
    // (maybe to troubleshoot problems with his/her account s/he has asked for help about),
    // and then you, being that other user, somehow happen to open a login dialog
    // (maybe because of navigating to a different part of the site that the user being
    // impersonated cannot access) — then, that error message is shown: You're not allowed
    // to login as *someone else* to access that part of the community, until you've first
    // stopped impersonating the first user. (Otherwise, everything gets too complicated.)
    IsImpersonating: "您的身份信息不真实, 可能无法访问网站的所有部分。",

    IfYouThinkExistsThen: "如果您认为该页面存在, 请以该页面允许的身份登录.",
    LoggedInAlready: "(您已登录, 但可能是错误的账户?) ",
    ElseGoToHome_1: "否则, 你可以",
    ElseGoToHome_2: "跳转到主页.",

    CreateAcconut: "创建账户",
    SignUp: "注册",
    LogIn: "登录",
    with_: "通过",
    LogInWithPwd: "通过密码登录",
    CreateAdmAcct: "创建管理员账号:",
    AuthRequired: "访问此站点所需的身份认证",
    LogInToLike: "登录并喜欢这篇贴子",
    LogInToSubmit: "登录并提交",
    LogInToComment: "登录并评论",
    LogInToCreateTopic: "登录并创建话题",

    AlreadyHaveAcctQ: "已经拥有账号? ",
    LogInInstead_1: "",
    LogInInstead_2: "登录",   // "Log in" (this is a button)
    LogInInstead_3: " 替代", // "instead"

    NewUserQ: "新用户? ",
    SignUpInstead_1: "",
    SignUpInstead_2: "注册",
    SignUpInstead_3: " 替代",

    OrCreateAcctHere: "或创建账户:",
    OrTypeName: "或输入你的用户名:",
    OrFillIn: "或填写:",

    BadCreds: "用户名或密码错误",

    UsernameOrEmailC: "用户名或电子邮件:",
    PasswordC: "密码:",
    ForgotPwd: "您是否忘记了密码?",

    NoPwd: "您还没有选择密码.",
    CreatePwd: "创建密码",
  },


  // Flag dialog

  fd: {
    PleaseTellConcerned: "请告诉我们您所关心的事情.",
    ThanksHaveReported: "谢谢您. 我们已经汇报给管理员，他们会查看该事件.",
    ReportComment: "举报评论",
    // Different reasons one can choose among when reporting a comment:
    OptPersonalData: "这条贴文中包含个人信息，如别人的真实姓名.",
    OptOffensive: "这个贴文中包含攻击性或煽动性内容.",
    OptSpam: "这个贴文是一个不受欢迎的广告.",
    OptOther: "出于其他原因通知管理员.",
  },


  // Help message dialog
  help: {
    YouCanShowAgain_1: "您可以再次显示帮助信息, 如果您已登录, 可以" +
        "点击您的用户名, 然后",
    YouCanShowAgain_2: "取消隐藏帮助信息",
  },


  // Editor

  e: {
    //WritingSomethingWarning: "You were writing something?",
    UploadMaxOneFile: "抱歉, 目前您只能一次上传一个文件",
    PleaseFinishPost: "请先编辑完您的贴子",
    PleaseFinishChatMsg: "请先编辑完您的聊天信息",
    PleaseFinishMsg: "清闲编辑完您的信息",
    PleaseSaveEdits: "请先保存当前编辑的内容",
    PleaseSaveOrCancel: "请先保存或取消您的新话题",
    CanContinueEditing: "再次打开编辑器的时候，可以继续编辑文本.",
        //"(But the text will currently be lost if you leave this page.)", "(但如果您离开此页面，文本将会丢失)"
    PleaseDontDeleteAll: "请不要删除所有文字. 请编辑一点内容.",
    PleaseWriteSth: "请编辑一点内容.",
    PleaseWriteTitle: "请编辑一个话题标题.",
    PleaseWriteMsgTitle: "请编辑一个消息标题.",
    PleaseWriteMsg: "请填写一条消息.",

    exBold: "粗体文字",
    exEmph: "强调文字",
    exPre: "带格式的文字",
    exQuoted: "引用的文字",
    ExHeading: "标题",

    TitlePlaceholder: "添加一个标题 - 简要描述这篇内容梗概?",

    EditPost_1: "编辑",
    EditPost_2: "发布",

    TypeChatMsg: "输入聊天信息:",
    YourMsg: "你的留言:",
    CreateTopic: "创建新话题",
    CreateCustomHtml: "创建自定义的HTML页面(添加您自己的<h1>标题)",
    CreateInfoPage: "创建信息页面",
    CreateCode: "创建源代码页面",
    AskQuestion: "提出一个问题",
    ReportProblem: "报告一个错误",
    SuggestIdea: "表达一个想法",
    NewChat: "新的聊天频道标题和目的",
    NewPrivChat: "新的私聊标题和目的",
    AppendComment: "在页面底部附加评论:",

    ReplyTo: "回复",
    ReplyTo_theOrigPost: "原贴",
    ReplyTo_post: "发布",

    PleaseSelectPosts: "请选择一个或多个贴子进行回复.",

    Save: "保存",
    edits: "编辑",

    PostReply: "发表回复",

    Post: "贴子",
    comment: "评论",
    question: "问题",

    PostMessage: "发布消息",
    SimpleEditor: "简单编辑",

    Send: "发送",
    message: "消息",

    Create: "创建",
    page: "页面",
    chat: "聊天",
    idea: "想法",
    topic: "话题",

    Submit: "提交",
    problem: "错误",

    ViewOldEdits: "查看旧的编辑",

    UploadBtnTooltip: "上传文件或图片",
    BoldBtnTooltip: "使文字加粗",
    EmBtnTooltip: "强调",
    QuoteBtnTooltip: "引用",
    PreBtnTooltip: "带格式的文字",
    HeadingBtnTooltip: "标题",

    TypeHerePlaceholder: "在此输入. 您可以使用Markdown和HTML. 拖放以粘贴图片.",

    Maximize: "最大化",
    ToNormal: "恢复正常",
    TileHorizontally: "水平平铺",

    PreviewC: "预览:",
    TitleExcl: " (不包含标题)",
    ShowEditorAgain: "再次显示编辑器",
    Minimize: "最小化",

    IPhoneKbdSpace_1: "(此灰色空间已保留",
    IPhoneKbdSpace_2: "用于iPhone键盘)",

    PreviewInfo: "在这里，您可以在预览将发布的帖子",
    CannotType: "您不能在里面编辑",
  },


  // Page type dropdown

  pt: {
    SelectTypeC: "选择话题类型",
    DiscussionExpl: "关于某件事的讨论",
    QuestionExpl: "一个答案可以标记为已接受的答案",
    ProblExpl: "如果某些内容被破坏或已不存在. 可以标记为已解决",
    IdeaExpl: "一个建议. 可以被标记为已完成/已执行.",
    ChatExpl: "一段可能永无止境的对话",
    PrivChatExpl: "只有被邀请加入聊天的人才能看到",

    CustomHtml: "自定义HTML页面",
    InfoPage: "信息页面",
    Code: "代码",
    EmbCmts: "嵌入式评论",
    About: "关于",
    PrivChat: "私聊",
    Form: "表单",
  },


  // Join sub community dialog

  jscd: {
    NoMoreToJoin: "没有更多的社区可以加入。",
    SelCmty: "选择社区 ...",
  },


  // Search dialogs and the search page.
  s: {
    TxtToFind: "要搜索的文字",
  }

};


