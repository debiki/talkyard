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

var t_en_US: TalkyardTranslations = (t = {
  // A single or a few words, sorted alphabetically, to reuse everywhere.

  Active: "活跃",
  Activity: "活动",
  Add: "添加",
  AddingDots: "正在添加...",
  AddComment: "添加评论",
  Admin: "管理员",
  AdvSearch: "高级搜索",
  Away: "离开",
  Back: "返回",
  BlogN: "博客",
  Bookmarks: "书签",
  Cancel: "取消",
  Categories: "分类",
  Category: "分类",
  ChangeV: "更改",
  ClickToShow: "点击显示",
  ChangeDots: "正在更改...",
  ChatN: "聊天",
  Chatting: "聊天中",
  CheckYourEmail: "检查你的电子邮件",
  Close: "关闭",
  closed: "已关闭",
  comments: "评论数",
  Continue: "继续",
  Created: "已创建",
  Delete: "删除",
  Deleted: "已删除",
  DirectMessage: "私信",
  Discussion: "讨论",
  discussion: "讨论",
  done: "完成",
  EditV: "编辑",
  Editing: "编辑中",
  EmailC: "电子邮件：",
  EmailAddress: "电子邮件地址",
  EmailAddresses: "电子邮件地址",
  EmailSentD: "电子邮件已发送。",
  Forum: "论坛",
  GetNotifiedAbout: "获取通知",
  GroupsC: "群组：",
  Hide: "隐藏",
  Home: "主页",
  Idea: "想法",
  Join: "加入",
  KbdShrtcsC: "键盘快捷键：",
  Loading: "正在加载...",
  LoadMore: "加载更多...",
  LogIn: "登录",
  LoggedInAs: "登录为",
  LogOut: "退出",
  Maybe: "或许",
  Manage: "管理",
  Members: "成员",
  MessageN: "消息",
  MoreDots: "更多...",
  Move: "移动",
  Name: "名称",
  NameC: "名称：",
  NewTopic: "新话题",
  NoCancel: "不取消",
  Notifications: "通知",
  NotImplemented: "（未实现）",
  NotYet: "尚未",
  NoTitle: "无标题",
  NoTopics: "无话题",
  Okay: "好的",
  OkayDots: "好的...",
  Online: "在线",
  onePerLine: "每行一个",
  PreviewV: "预览",
  Problem: "问题",
  progressN: "进度",
  Question: "问题",
  Recent: "最近",
  Remove: "移除",
  Reopen: "重新开启",
  ReplyV: "回复",
  Replying: "回复中",
  Replies: "回复",
  replies: "回复",
  Save: "保存",
  SavingDots: "正在保存...",
  SavedDot: "已保存。",
  Search: "搜索",
  SendMsg: "发送消息",
  ShowPreview: "显示预览",
  SignUp: "加入",
  Solution: "解决方案",
  started: "开始",
  Summary: "摘要",
  Submit: "提交",
  Tag: "标签",
  Tags: "标签",
  Tools: "工具",
  Topics: "话题",
  TopicTitle: "话题标题",
  TopicType: "话题类型",
  UploadingDots: "上传中...",
  Username: "用户名",
  Users: "用户",
  Welcome: "欢迎",
  Wiki: "维基",
  Yes: "是",
  YesBye: "是的，再见",
  YesDoThat: "是的，去做",
  You: "你",
  you: "你",

  // 信任级别
  Guest: "游客",
  NewMember: "新成员",
  BasicMember: "基础成员",
  FullMember: "完整成员",
  TrustedMember: "受信任成员",
  RegularMember: "普通成员", // 之前的 Regular Member 已经更名为 Trusted Regular [RENREGLS]
  CoreMember: "核心成员",

  // 时间段
  PastDay: "过去一天",
  PastWeek: "过去一周",
  PastMonth: "过去一个月",
  PastQuarter: "过去一个季度",
  PastYear: "过去一年",
  AllTime: "全部时间",

  // 时间距离的字母缩写
  // 例如：英文中的“3d”在论坛主题列表中表示3天前。“5h”表示5小时。
  monthsLtr: "月", // 月份
  daysLtr: "天", // 天数
  hoursLtr: "小时", // 小时数
  minsLtr: "分", // 分钟数
  secsLtr: "秒", // 秒数

  // 时间距离的长文本版本。
  daysAgo: (numDays: number) => (numDays === 1 ? "1天前" : `${numDays}天前`),

  hoursAgo: (numHours: number) =>
    numHours === 1 ? "1小时前" : `${numHours}小时前`,

  minutesAgo: (numMins: number) =>
    numMins === 1 ? "1分钟前" : `${numMins}分钟前`,

  secondsAgo: (numSecs: number) =>
    numSecs === 1 ? "1秒钟前" : `${numSecs}秒钟前`,

  // 输入框，例如电子邮件、姓名等。

  inp: {
    // 电子邮件地址输入框：
    EmReq: "必须输入电子邮件地址",
    NoSpcs: "请勿输入空格",
    InvldAddr: "不是有效的电子邮件地址",
    NoBadChrs: "请勿输入奇怪的字符",

    // 全名输入框：
    NotOnlSpcs: "请勿只输入空格",
    NoAt: "请勿输入@符号",

    // 用户名输入框：
    NoDash: "请勿输入破折号（-）",
    DontInclAt: "请勿包含@符号",
    StartEndLtrDgt: "必须以字母或数字开头和结尾",
    OnlLtrNumEtc: "仅允许字母（a-z，A-Z）和数字、_（下划线）",
    // 此消息显示在用户名输入框下面：
    UnUnqShrt_1: "您的",
    UnUnqShrt_2: "@用户名",
    UnUnqShrt_3: "，唯一且简短",

    // 适用于所有输入字段的通用消息：
    TooShort: (minLength: number) => `至少应为${minLength}个字符`,
    TooLong: (maxLength: number) => `过长。最多应为${maxLength}个字符`,
  },

  // 通知级别。

  nl: {
    EveryPost: "每篇文章",
    EveryPostInTopic: "您将收到此主题中所有新回复的通知。",
    EveryPostInCat: "您将收到此分类中所有新主题和回复的通知。",
    EveryPostInTopicsWithTag:
      "您将收到带有此标签的新主题和这些主题中的所有回复的通知。",
    EveryPostWholeSite: "您将收到任何地方的所有新主题和回复的通知。",

    // 只会收到新主题的*第一篇*帖子的通知。也就是原始帖子
    // （在讨论论坛主题中，第一篇帖子就是原始帖子）。
    NewTopics: "新主题",
    NewTopicsInCat: "您将收到此分类中的新主题的通知。",
    NewTopicsWithTag: "您将收到带有此标签的新主题的通知。",
    NewTopicsWholeSite: "您将收到任何地方的新主题的通知。",

    Tracking: "跟踪",

    Normal: "普通",
    NormalDescr:
      "如果有人与您交谈，即使是间接地，例如回复您的回复，您也会收到通知。",
    //NormalTopic_1: "如果有人与您交谈，或提到您的",
    //NormalTopic_2: "@name",

    Hushed: "静音",
    HushedDescr: "只有当有人直接与您交谈时，您才会收到通知。",

    Muted: "已静音",
    MutedTopic: "没有通知。", // MISSING 移除“关于这个主题”
  },

  // 论坛介绍文本

  fi: {
    Edit: "编辑",
    Hide_1: "隐藏",
    Hide_2: "，单击",
    Hide_3: "重新打开",
  },

  // 论坛分类

  fcs: {
    All: "所有分类", // "所有（分类）"，比AllCats更短
  },

  // 论坛按钮

  fb: {
    TopicList: "主题列表",

    // 选择分类下拉菜单

    from: "来自", // MISSING 使用方式：“来自<Category Name>”或“来自所有分类”
    in: "在", // MISSING 使用方式：“在<Category Name>”或“在所有分类中”
    AllCats: "所有分类",

    // 主题排序顺序
    Active: "活跃优先", // MISSING 尚未添加“优先”到翻译中
    ActiveDescr: "首先显示最近活跃的主题",

    New: "最新",
    NewDescr: "首先显示最新的主题",

    Top: "热门", // MISSING 从“置顶”改名为“热门”。
    TopDescr: "首先显示热门主题",

    // 主题过滤下拉菜单
    AllTopics: "所有话题",
    ShowAllTopics: "显示所有话题",
    ShowAllTopicsDescr: "不包括已删除的话题",
    WaitingTopics: "等待的话题",
    OnlyWaitingDescr_1: "仅显示",
    OnlyWaitingDescr_2: "等待",
    OnlyWaitingDescr_3: "解决方案或被实施和完成的话题",
    YourTopics: "您的话题",
    AssignedToYou: "分配给您的话题",
    DeletedTopics: "显示已删除的",
    ShowDeleted: "显示已删除的话题",
    ShowDeletedDescr: "显示所有话题，包括已删除的话题",

    // 右侧按钮

    ViewCategories: "查看分类",
    EditCat: "编辑分类",
    CreateCat: "创建分类",
    CreateTopic: "创建话题",
    PostIdea: "发布想法",
    AskQuestion: "提问",
    ReportProblem: "报告问题",
    CreateMindMap: "创建思维导图",
    CreatePage: "创建页面",
  },

  // 论坛主题列表

  ft: {
    ExplIcons: "解释图标...",
    IconExplanation: "图标说明：",
    ExplGenDisc: "一般讨论。",
    ExplQuestion: "一个没有被接受的答案的问题。",
    ExplAnswer: "一个有被接受答案的问题。",
    ExplIdea: "一个想法/建议。",
    ExplProblem: "一个问题。",
    ExplPlanned: "我们正在计划做或修复的事情。",
    ExplDone: "已经完成或修复的事情。",
    ExplClosed: "主题已关闭。",
    ExplPinned: "主题始终排在第一位（可能仅在其自己的类别中）。",
    PopularTopicsComma: "热门话题，",
    TopFirstAllTime: "首先显示最受欢迎的话题，所有时间。",
    TopFirstPastDay: "显示过去一天受欢迎的话题。",
    CatHasBeenDeleted: "此类别已被删除",
    TopicsActiveFirst: "主题，最近活跃的首位",
    TopicsNewestFirst: "主题，最新的首位",
    CreatedOn: "创建于 ",
    LastReplyOn: "\n上次回复时间 ",
    EditedOn: "\n编辑于 ",

    // 这些被显示为鼠标悬停工具提示或移动电话触摸提示，在论坛主题列表中用户头像图标上。
    createdTheTopic: "创建了主题",
    frequentPoster: "常发帖者",
    mostRecentPoster: "最新的发帖者",
    inC: "在：",
    TitleFixed: "此问题已解决",
    TitleDone: "此事情已完成",
    TitleStarted: "我们已经开始了",
    TitleStartedFixing: "我们已经开始修复这个问题",
    TitleUnsolved: "这是一个未解决的问题",
    TitleIdea: "这是一个想法",
    TitlePlanningFix: "我们正在计划修复这个问题",
    TitlePlanningDo: "我们正在计划做这件事",
    TitleChat: "这是一个聊天频道",
    TitlePrivateChat: "这是一个私人聊天频道",
    TitlePrivateMessage: "一条私人消息",
    TitleInfoPage: "这是一个信息页面",
    TitleDiscussion: "一次讨论",
    IsPinnedGlobally: "\n它被置顶，所以排在首位。",
    IsPinnedInCat: "\n它在它的类别中被置顶，所以在它的类别中排在首位。",
  },

  // 论坛类别列表

  fc: {
    RecentTopicsWaiting: "最近的主题（等待中）",
    RecentTopicsInclDel: "最近的主题（包括已删除的）",
    RecentTopics: "最近的主题",
    _replies: " 回复",
    _deleted: "（已删除）",
    _defCat: "（默认类别）",
  },

  // 顶部栏

  // 显示在页面顶部。包括登录和注册按钮，或用户的用户名菜单。

  tb: {
    // 打开右侧边栏并列出当前主题中最近的帖子。
    RecentPosts: "最近的帖子",

    // 在线用户数鼠标悬停时，打开右侧边栏按钮的提示信息。
    NumOnlChat: "当前聊天室在线人数为", // 示例："当前聊天室在线人数为 5"
    NumOnlForum: "当前论坛在线人数为",

    // 打开左侧边栏按钮的标题。
    WatchbBtn: "您的主题", // REMOVE

    // 鼠标悬停在打开左侧边栏按钮时显示的提示信息。
    WatchbToolt: "您的最近主题、已加入聊天室、直接消息",

    // 在用户个人资料页面上显示的标题。
    AbtUsr: "关于用户",

    // 快捷方式，离开用户个人资料页面或工作人员区域，返回讨论主题。
    BackFromUsr: "从用户资料返回",
    BackFromAdm: "从管理区返回",

    // 在全文搜索页面上显示的标题。
    SearchPg: "搜索页面",
  },

  // 左侧边栏

  wb: {
    AddCommunity: "添加 ...",
    RecentlyViewed: "最近查看的主题", // MISSING "主题"
    JoinedChats: "已加入的聊天室",
    ChatChannels: "聊天室频道",
    CreateChat: "创建聊天室频道",
    DirectMsgs: "直接消息",
    NoChats: "没有聊天消息", // 意思是：“没有聊天消息”
    NoDirMsgs: "没有直接消息", // 意思是：“没有直接消息”

    // 单击主题下拉菜单：
    TopicActions: "主题操作",
    ViewPeopleHere: "查看这里的人员",
    ViewAddRemoveMembers: "查看/添加/删除成员",
    ViewChatMembers: "查看聊天成员",
    EditChat: "编辑聊天描述",
    //EditChat: "编辑聊天标题和目的", // 保留，以防添加回编辑标题输入
    LeaveThisChat: "离开此聊天室",
    LeaveThisCommunity: "退出此社区",
    JoinThisCommunity: "加入此社区",
  },

  // 右侧边栏

  cb: {
    RecentComments: "本主题的最近评论：",
    NoComments: "没有评论。",

    YourBookmarks: "你的书签：",

    UsersOnline: "在线用户：",
    UsersOnlineForum: "本论坛在线用户：",
    UsersInThisChat: "本聊天中的用户：",
    UsersInThisTopic: "本主题中的用户：",

    GettingStartedGuide: "入门指南",
    AdminGuide: "管理指南",
    Guide: "指南",

    // 如何隐藏侧边栏。
    CloseShortcutS: "关闭（键盘快捷键：S）",

    // ----- 在线用户列表 / 当前主题中的用户

    AddPeople: "添加更多人",

    // 在用户列表中显示在自己的用户名旁边。
    thatsYou: "就是你",

    // 关于哪些人在线的信息。
    // 例如，在英文中：“在线用户：您和5个未登录的人”
    OnlyYou: "只有你似乎在线",
    YouAnd: "你和",
    NumStrangers: (numStrangers: number) => {
      const people = numStrangers === 1 ? " 个人" : " 人";
      const have = numStrangers === 1 ? "还没有" : "没有";
      return numStrangers + people + " " + have + "登录";
    },

    // ----- 最近评论列表

    // 这解释了侧边栏中“最近”选项卡的工作原理。

    RepliesToTheLeft: "左侧的回复可能会按照最好的顺序排序",
    bestFirst: "（最佳优先）。",
    ButBelow: "但是在下面，",
    insteadBy: " 相同的回复将按",
    newestFirst: "最新的先排序。",

    SoIfLeave: "因此，如果您离开并稍后返回这里，则将找到",
    allNewReplies: "所有新的回复。",
    Click: "点击",
    aReplyToReadIt: "下面的回复以阅读它-因为下面仅显示摘录。",
  },

  // Change page dialog
  cpd: {
    ClickToChange: "点击更改状态",
    ClickToViewAnswer: "点击查看答案",
    ViewAnswer: "查看答案",
    ChangeStatusC: "更改状态为：",
    ChangeCatC: "更改类别：",
    ChangeTopicTypeC: "更改主题类型：",
  },

  // Page doing status, PageDoingStatus
  pds: {
    aQuestion: "一个问题",
    hasAccptAns: "有一个被采纳的答案",
    aProblem: "一个问题",
    planToFix: "计划修复",
    anIdea: "一个想法",
    planToDo: "计划去做",
  },

  // 讨论/非聊天页面

  d: {
    // 这些文本被分成1、2或1、2、3等部分，因为在文本之间，
    // 会显示图标以帮助人们理解这些图标的含义。

    ThisFormClosed_1: "这个表单已经被",
    // 在此处显示了一个主题已关闭的图标，在文本部分1（上面）和部分2（下面）之间。
    ThisFormClosed_2: "关闭，你不能再填写和发布它。",

    ThisTopicClosed_1: "这个话题已经被",
    // 在此处显示了一个主题已关闭的图标和文本“已关闭”。
    ThisTopicClosed_2: "。你仍然可以发布评论。", // SYNC 删除了“不会让...提高...”

    ThisPageDeleted: "此页面已被删除",
    CatDeldPageToo: "类别已删除，因此此页面也已被删除",

    ThreadDeld: "主题已删除",
    CmntDeld: "评论已删除",
    PostDeld: "帖子已删除",
    DiscDeld: "讨论已删除",
    PageDeld: "页面已删除",
    PagePendAppr: "页面等待批准",
    TitlePendAppr: "标题等待批准",
    TextPendingApproval: "文本等待批准",

    TooltipQuestClosedNoAnsw: "此问题已关闭，没有接受的答案。",
    TooltipTopicClosed: "此主题已关闭。",

    TooltipQuestSolved: "这是一个已解决的问题",
    TooltipQuestUnsolved: "这是一个未解决的问题",

    StatusDone: "完成",
    TooltipProblFixed: "已经解决了这个问题",
    TooltipDone: "已经完成了这个事情",

    StatusStarted: "已开始",
    TooltipFixing: "我们已经开始解决这个问题", // MISSING "我们目前正在" —> "我们已经开始"
    TooltipImplementing: "我们已经开始做这个事情", // MISSING  -""-

    StatusPlanned: "已计划",
    TooltipProblPlanned: "我们正在计划解决这个问题",
    TooltipIdeaPlanned: "我们正在计划做这个事情", // 或者“实施这个事情”？

    StatusNew: "新的",
    StatusNewDtl: "新的主题，正在讨论中",
    TooltipUnsProbl: "这是一个未解决的问题",
    TooltipIdea: "这是一个想法",

    TooltipPersMsg: "个人消息",
    TooltipChat: "# 表示聊天频道",
    TooltipPrivChat: "这是一个私人聊天频道",

    TooltipPinnedGlob: "\n被全局置顶。",
    TooltipPinnedCat: "\n被该类别置顶。",

    SolvedClickView_1: "在帖子#中已解决",
    SolvedClickView_2: "，点击查看",
    PostHiddenClickShow: "帖子已隐藏，点击显示",
    ClickSeeMoreRepls: "显示更多回复",
    ClickSeeMoreComments: "显示更多评论",
    ClickSeeThisComment: "点击显示此评论",
    clickToShow: "点击显示",

    ManyDisagree: "很多人不同意此观点：",
    SomeDisagree: "一些人不同意此观点：",

    PendAppr: "待批准",
    CmtPendAppr: "评论待批准，发布于",
    CmtBelowPendAppr: (isYour) => (isYour ? "您的" : "该") + "评论待批准。",
    _and: "和",
    repliesTo: "回复",
    InReplyTo: "回复",
    YourReplyTo: "您的回复",
    YourChatMsg: "您的聊天消息：",
    YourDraft: "您的草稿",
    YourEdits: "您的编辑：",
    YourProgrNoteC: "您的进展记录：",
    aProgrNote: "一条进展记录：",
    ReplyingToC: "回复",
    ScrollToPrevw_1: "滚动到",
    ScrollToPrevw_2: "预览",
    UnfinEdits: "未完成的编辑",
    ResumeEdting: "继续编辑",
    DelDraft: "删除草稿",
    ClickViewEdits: "单击查看旧的编辑",
    By: "作者：", // ... someones name

    // Discussion ...
    aboutThisIdea: "关于如何以及是否执行此想法",
    aboutThisProbl: "关于如何以及是否修复此问题",

    AddProgrNote: "添加进展记录",
    // Progress ...
    withThisIdea: "与执行此想法有关",
    withThisProbl: "与解决此问题有关",
    withThis: "与此有关",
  },

  // Metabar（元栏）

  // 在原始帖子和所有回复之间显示。

  mb: {
    NotfsAbtThisC: "关于此话题的通知：",
    // 如果是直接消息主题，则在此文本下方列出成员。
    Msg: "消息",

    SmrzRepls: "总结回复",

    // 不必担心“1个回复”，“2,3,4个回复”的正确性。
    // 只需始终写“回复”？（即使只有一个）

    EstTime: (numReplies: number, minutes: number) =>
      `有${numReplies}个回复。预计阅读时间：${minutes}分钟`,

    DoneSummarizing: (numSummarized: number, numShownBefore: number) =>
      `完成。总结了${numSummarized}个回复，之前显示了${numShownBefore}个回复。`,
  },

  // 帖子操作

  pa: {
    CloseTopic: "关闭主题", // MISSING（缺少）
    CloseOwnQuestionTooltip: "如果您不需要回答，请关闭此问题。",
    CloseOthersQuestionTooltip:
      "如果此问题不需要回答（例如，如果属于非主题或已在另一个主题中回答），请关闭此问题。",
    CloseToDoTooltip: "如果此 To-Do 不需要完成或修复，请关闭。",
    CloseTopicTooltip: "如果不需要进一步考虑此主题，请关闭此主题。",
    AcceptBtnExpl: "接受此作为问题或问题的答案",
    SolutionQ: "解决方案？",
    ClickUnaccept: "单击取消接受此答案",
    PostAccepted: "此帖子已被接受为答案",

    NumLikes: (num: number) => (num === 1 ? "1 赞" : num + " 赞"),
    NumDisagree: (num: number) => num + " 不同意",
    NumBury: (num: number) => (num === 1 ? "1 掩埋" : num + " 掩埋"),
    NumUnwanted: (num: number) => (num === 1 ? "1 不需要" : num + " 不需要"),

    MoreVotes: "更多投票...",
    LikeThis: "喜欢这个",
    LinkToPost: "链接到此帖子",
    Report: "报告",
    ReportThisPost: "报告此帖子",
    Admin: "管理员",
    DiscIx: "讨论索引",

    Disagree: "不同意",
    DisagreeExpl: "单击此处不同意此帖子，或警告其他人存在事实错误。",
    Bury: "掩埋",
    BuryExpl:
      "单击此处将其他帖子排序在此帖子之前。只有论坛工作人员可以看到您的投票。",
    Unwanted: "不想要",
    UnwantedExpl:
      "如果你不想要这个帖子出现在这个网站上。这会减少我对帖子作者的信任。只有论坛工作人员能看到你的投票。",
    AddTags: "添加/删除标签",
    UnWikify: "取消维基化",
    Wikify: "维基化",
    PinDeleteEtc: "置顶/删除/分类 ...",
  },

  // 分享对话框
  sd: {
    Copied: "已复制。",
    CtrlCToCopy: "按Ctrl+C键复制。",
    ClickToCopy: "点击复制链接。",
  },

  // 聊天
  c: {
    About_1: "这是由",
    About_2: "创建的聊天频道。",
    ScrollUpViewComments: "向上滚动查看旧评论",
    Purpose: "目的：",
    edit: "编辑",
    delete: "删除",
    MessageDeleted: "（消息已删除）",
    JoinThisChat: "加入此聊天",
    PostMessage: "发布消息",
    AdvancedEditor: "高级编辑器",
    TypeHere: "在此输入。您可以使用Markdown和HTML。",
  },

  // 我的菜单
  mm: {
    NeedsReview: "需要审核",
    AdminHelp: "管理员帮助",
    StaffHelp: "工作人员帮助",
    DraftsEtc: "草稿、书签、任务",
    MoreNotfs: "查看所有通知",
    DismNotfs: "全部标记为已读",
    ViewProfile: "查看您的个人资料",
    ViewGroups: "查看群组",
    LogOut: "退出",
    UnhideHelp: "取消隐藏帮助消息",
  },

  // 滚动按钮
  sb: {
    ScrollToC: "滚动到：",
    Scroll: "滚动",
    // 返回按钮，字母B是一个键盘快捷键。
    // 如果在您的语言中，“返回”不以“B”开头，则将 Back_1 设置为空字符串（空文本），并将 Back_2 设置为：“返回（B）” - 而不是“返回”（但不是“B”）
    // 翻译成您的语言。
    Back_1: "B",
    Back_2: "ack",
    BackExpl: "滚动回到页面上的上一个位置",

    // 这些在移动设备上很有用-然后，没有Home（=滚动到顶部）和End按钮的键盘。
    // 一旦你习惯了键盘，点击1到达顶部，点击2查看第一个回复，B返回，F前进等等，这样挺好的。
    PgTop: "页面顶部",
    PgTopHelp: "转到页面顶部。键盘快捷键：1",
    Repl: "回复",
    ReplHelp: "转到回复部分。快捷键：2",
    Progr: "进展",
    // 进展部分在页面的末尾，那里会显示类似于“ Alice将状态更改为Doing”和“ Alice标记为Done”以及“主题由...关闭”之类的内容。
    // （如果需要，还可以显示工作人员或参与该问题的人员的评论。）
    ProgrHelp: "转到进展部分。快捷键：3",
    PgBtm: "页面底部",
    Btm: "底部",
    BtmHelp: "转到页面底部。快捷键：4",

    // “键盘快捷键：...，B滚动回退”
    Kbd_1: "，并且",
    // 然后是字母'B'（不管语言如何）
    Kbd_2: "滚动回退",
  },

  // 选择用户对话框
  sud: {
    SelectUsers: "选择用户",
    AddUsers: "添加用户",
  },

  // 关于用户对话框

  aud: {
    IsMod: "是版主。",
    IsAdm: "是管理员。",
    IsDeld: "已停用或删除。",
    ThisIsGuest: "这是一个访客用户，实际上可能是任何人。",
    ViewInAdm: "在管理区域查看",
    ViewProfl: "查看个人资料",
    ViewComments: "查看其他评论",
    RmFromTpc: "从主题中删除",
    EmAdrUnkn: "电子邮件地址未知-此访客不会收到有关回复的通知。",
  },

  upp: {
    // ----- 链接
    Preferences: "偏好设置",
    Invites: "邀请",
    DraftsEtc: "草稿等",
    About: "关于",
    Privacy: "隐私",
    Security: "安全",
    Account: "账户",
    Interface: "界面",

    // ----- 总览统计

    JoinedC: "加入日期：",
    PostsMadeC: "发表帖子：",
    LastPostC: "最后发帖：",
    LastSeenC: "最后活动时间：",
    TrustLevelC: "信任等级：",

    // ----- 操作按钮

    // ----- 头像

    UploadPhoto: "上传头像",
    ChangePhoto: "更改头像",
    ImgTooSmall: "图片太小：应至少为100 x 100",

    // ----- 活动

    OnlyStaffCanSee: "只有工作人员和受信任的核心成员才能查看。",
    OnlyMbrsCanSee: "只有活跃成员一段时间后才能查看。",
    Nothing: "无内容",
    Posts: "帖子",
    NoPosts: "无帖子。",
    Topics: "话题",
    NoTopics: "无话题。",

    // ----- 用户状态

    UserBanned: "此用户已被禁止",
    UserSuspended: (dateUtc: string) =>
      `此用户已被暂停使用，直到${dateUtc} UTC`,
    ReasonC: "原因：",

    DeactOrDeld: "已停用或已删除。",
    isGroup: "（一个组）",
    isGuest: " — 访客用户，可能是任何人",
    isMod: " – 版主",
    isAdmin: " – 管理员",
    you: "（你）",

    // ----- 通知页面

    NoNotfs: "无通知",
    NotfsToYouC: "发给你的通知：",
    NotfsToOtherC: (name: string) => `发给${name}的通知：`,
    DefNotfsSiteWide: "默认通知，整个站点",
    // The "for" in:  "Default notifications, site wide, for (someone's name)".
    forWho: "发给",

    // ----- 草稿等页面

    NoDrafts: "无草稿",
    YourDraftsC: "你的草稿：",
    DraftsByC: (name: string) => `${name}的草稿：`,

    // ----- 邀请页面
    InvitesIntro: "在这里您可以邀请其他人加入本站。",
    InvitesListedBelow: "您已经发送的邀请如下所示。",
    NoInvites: "您还没有邀请任何人。",

    InvitedEmail: "邀请电子邮件",
    WhoAccepted: "接受邀请的成员",
    InvAccepted: "接受邀请",
    InvSent: "已发送邀请",
    JoinedAlready: "已经加入",

    SendAnInv: "邀请人", //原文："Send an Invite"，其他语言缺失
    SendInv: "发送邀请", //其他语言中只有单数形式："Send invite"
    SendInvExpl:
      "我们将向您的朋友发送一封简短的电子邮件。他们将点击链接立即加入，无需登录。他们将成为普通成员，而不是版主或管理员。",
    //EnterEmail: "输入电子邮件",
    InvDone: "完成。我将发送电子邮件。",
    NoOneToInv: "没有人可邀请。",
    InvNotfLater: "稍后我会通知您，当我邀请他们时。",
    AlreadyInvSendAgainQ: "这些人已经被邀请了 - 您是否想再次邀请他们？",
    InvErr_1: "出现了",
    InvErr_2: "个错误",
    InvErr_3: "：",
    TheseJoinedAlrdyC: "这些人已经加入了，所以我没有邀请他们：",
    ResendInvsQ: "再次向这些人发送邀请？他们已经被邀请过了。",
    InvAgain: "再次邀请",

    // ----- 首选项，关于

    AboutYou: "关于您",
    WebLink: "您的任何网站或页面。",

    NotShownCannotChange: "不公开显示。无法更改。",

    // 全名或别名：
    NameOpt: "名称（可选）",

    NotShown: "不公开显示。",

    // 用户名：
    MayChangeFewTimes: "您只能更改几次。",
    notSpecified: "（未指定）",
    ChangeUsername_1: "您只能更改用户名几次。",
    ChangeUsername_2:
      "过于频繁的更改会让其他人感到困惑- 他们不知道如何@提到您。",

    NotfAboutAll: "通知每个新帖子（除非您将主题或类别静音）",
    NotfAboutNewTopics: "通知新主题（除非您将类别静音）",

    ActivitySummaryEmails: "活动摘要电子邮件",

    EmailSummariesToGroup:
      "当此组的成员不访问此处时，默认情况下会向他们发送热门主题和其他内容的摘要电子邮件。",
    EmailSummariesToMe:
      "当我不在这里访问时，向我发送热门话题和其他内容的摘要邮件。",

    AlsoIfTheyVisit: "即使他们经常访问这里，也要给他们发送电子邮件。",
    AlsoIfIVisit: "即使我经常访问这里，也要给我发送电子邮件。",

    HowOftenWeSend: "我们应该多久发送这些电子邮件？",
    HowOftenYouWant: "你想多久收到这些电子邮件？",

    // ----- Preferences, Privacy

    HideActivityStrangers_1: "为陌生人和新成员隐藏您最近的活动？",
    HideActivityStrangers_2: "（但不包括那些成为活跃成员一段时间的人。）",
    HideActivityAll_1: "对所有人隐藏您最近的活动？",
    HideActivityAll_2: "（除了工作人员和受信任的核心成员。）",

    // ----- Preferences, Account

    // 关于电子邮件地址：
    EmailAddresses: "电子邮件地址",
    PrimaryDot: "主要。",
    VerifiedDot: "已验证。",
    NotVerifiedDot: "未验证。",
    ForLoginWithDot: (provider: string) => `用于${provider}登录。`,
    MakePrimary: "设为主要",
    AddEmail: "添加电子邮件地址",
    TypeNewEmailC: "输入一个新的电子邮件地址：",
    MaxEmailsInfo: (numMax: number) => `(您不能添加超过 ${numMax} 个地址。)`,
    EmailAdded_1: "已添加。我们已向您发送了一封验证电子邮件——",
    EmailAdded_2: "请查收您的电子邮件收件箱。",
    SendVerifEmail: "发送验证电子邮件",

    EmailStatusExpl:
      "（'主要'表示您可以通过此地址登录，并且我们向其发送通知。" +
      " '已验证'表示您在地址验证电子邮件中单击了验证链接。）",

    // 密码：
    ChangePwdQ: "更改密码？",
    CreatePwdQ: "创建密码？",
    WillGetPwdRstEml: "您将收到一封重置密码电子邮件。",
    // 这是“无”的翻译："密码：无"
    PwdNone: "无",

    // 登录：
    LoginMethods: "登录方式",
    commaAs: "，作为：",

    // 个人数据：
    YourContent: "您的内容",
    DownloadPosts: "下载帖子",
    DownloadPostsHelp: "创建一个带有您发布的主题和评论副本的 JSON 文件。",
    DownloadPersData: "下载个人数据",
    DownloadPersDataHelp:
      "创建一个包含您的个人数据副本的JSON文件，例如您的姓名（如果您指定了姓名）和电子邮件地址。",

    // 删除账号:
    DangerZone: "危险区",
    DeleteAccount: "删除账户",
    DeleteYourAccountQ:
      "是否删除您的账户？我们将删除您的姓名，忘记您的电子邮件地址、密码和任何在线身份（例如Facebook或Twitter登录）。" +
      "您将无法再次登录。此操作无法撤销。",
    DeleteUserQ:
      "是否删除此用户？我们将删除该用户的姓名，忘记其电子邮件地址、密码和在线身份（例如Facebook或Twitter登录）。" +
      "该用户将无法再次登录。此操作无法撤销。",
    YesDelete: "是的，删除",
  },

  gpp: {
    GroupMembers: "小组成员",
    NoMembers: "暂无成员。",
    MayNotListMembers: "可能无法列出成员。",
    AddMembers: "添加成员",
    BuiltInCannotModify: "这是一个内置的组，无法修改。",
    NumMembers: (num: number) => `${num}名成员`,
    YouAreMember: "你是成员。",
    CustomGroupsC: "自定义组:",
    BuiltInGroupsC: "内置组:",
    DeleteGroup: "删除该组",
  },

  // 创建用户对话框

  cud: {
    CreateUser: "创建用户",
    CreateAccount: "创建账户",
    EmailC: "邮箱：", // REMOVE move to t.EmailC instead
    keptPriv: "将被保密",
    forNotfsKeptPriv: "用于回复通知，将被保密",
    EmailVerifBy_1: "你的邮箱已被",
    EmailVerifBy_2: "验证。",
    UsernameC: "用户名：",
    FullNameC: "全名：",
    optName: "选填",
    // OrCreateAcct_1: "Or ",
    // OrCreateAcct_2: "create an account",
    // OrCreateAcct_3: " with ",
    // OrCreateAcct_4: "@username",
    // OrCreateAcct_5: " & password",

    DoneLoggedIn: "账户已创建，你已登录。", // COULD say if verif email sent too?
    AlmostDone:
      "快完成了！你只需要确认你的邮箱地址。我们已经发送了一封邮件给你。请点击邮件中的链接以激活你的账户。你可以关闭此页面。",
  },

  // 接受条款和隐私政策？

  terms: {
    TermsAndPrivacy: "条款和隐私政策",
    Accept_1: "您是否接受我们的",
    TermsOfService: "服务条款",
    TermsOfUse: "使用条款",
    Accept_2: "和",
    PrivPol: "隐私政策",
    Accept_3_User: "？",
    Accept_3_Owner: "适用于网站管理员？", // (see just below)

    // 关于上面的“适用于网站管理员？”：
    // 如果有人通过此提供的软件作为软件即服务托管创建自己的社区，则需要同意略有不同的服务条款，
    // 因为成为社区维护者/所有者与仅注册发表评论是不同的（责任更大）。

    YesAccept: "是的，我接受",
  },

  // 密码输入

  pwd: {
    PasswordC: "密码：",
    StrengthC: "强度：",
    FairlyWeak: "相当弱。",
    toShort: "太短",
    TooShort: (minLength: number) => `太短了，应至少为${minLength}个字符`,
    PlzInclDigit: "请包含数字或特殊字符",
    TooWeak123abc: "太弱了。不要使用像'12345'或'abcde'这样的密码。",
    AvoidInclC: "避免在密码中包含（部分）您的姓名或电子邮件：",
  },

  // 登录对话框

  ld: {
    NotFoundOrPrivate: "页面未找到或访问被拒绝。",
    // 这是管理员单击“冒充”按钮以成为其他人的情况下，如果您以其他用户的身份打开登录对话框
    // （可能是因为导航到了该用户无法访问的站点的不同部分）- 那么就会显示该错误消息：在你停止模拟第一个用户之前，你不能以“其他人”的身份登录以访问社区的那部分。（否则，一切都会变得太复杂。）
    IsImpersonating:
      "您正在扮演其他人的角色，该用户可能无法访问本网站的所有部分。",

    IfYouThinkExistsThen:
      "如果您认为该页面存在，请登录为可能访问该页面的某个人。 ",
    LoggedInAlready: "（您已经登录了，但也许是错误的帐户？）",
    ElseGoToHome_1: "否则，您可以 ",
    ElseGoToHome_2: "返回主页。",

    CreateAcconut: "创建帐号",
    ContinueWithDots: "继续...",
    SignUp: "注册",
    LogIn: "登录",
    LogInWithPwd: "用密码登录",
    CreateAdmAcct: "创建管理员帐户：",
    AuthRequired: "需要身份验证才能访问此站点",
    LogInToLike: "登录以喜欢此帖子",
    LogInToSubmit: "登录并提交",
    LogInToComment: "登录以撰写评论",
    LogInToCreateTopic: "登录以创建主题",

    //AlreadyHaveAcctQ: "You have an account? ",  // MISSING changed "Already have...?" to "You have...?"
    OrLogIn_1: "或者 ", // "Or "
    OrLogIn_2: "登录", // "Log in" (this is a button)
    OrLogIn_3: "。", // " instead"

    //NewUserQ: "New user? ",
    SignUpInstead_1: "或者 ",
    SignUpInstead_2: "创建帐号", // (this is a button)
    SignUpInstead_3: "",

    OrTypeName_1: "，或者只需",
    OrTypeName_2: "输入名称", // is a button
    OrTypeName_3: "",

    OrCreateAcctHere: "或在此处创建帐户：",
    OrTypeName: "或输入您的名称：",
    OrLogIn: "或登录：",
    YourNameQ: "您的姓名？",

    BadCreds: "用户名或密码错误",

    UsernameOrEmailC: "用户名或电子邮件：",
    PasswordC: "密码：",
    ForgotPwd: "忘记密码了吗？",

    NoPwd: "您尚未选择密码。",
    CreatePwd: "创建密码",
  },

  // Flag dialog

  fd: {
    PleaseTellConcerned: "请告诉我们您的关注点。",
    ThanksHaveReported:
      "谢谢，您已经举报了此内容。论坛工作人员将会查看此内容。",
    ReportComment: "举报评论",
    // Different reasons one can choose among when reporting a comment:
    OptPersonalData: "此帖包含个人数据，例如某人的真实姓名。",
    OptOffensive: "此帖包含冒犯或滥用内容。",
    OptSpam: "此帖为不受欢迎的广告。",
    OptOther: "因其他原因通知工作人员有关此帖。",
  },

  // Help message dialog (as in "Tips", not "Private message").
  help: {
    YouCanShowAgain_1: "如果您已经登录，可以通过单击您的名称然后点击 ",
    YouCanShowAgain_2: "显示帮助消息",
  },

  // 编辑器

  e: {
    SimilarTopicsC: "类似主题：",
    //WritingSomethingWarning: "You were writing something?",
    UploadMaxOneFile: "抱歉，目前您一次只能上传一个文件",
    PleaseFinishPost: "请先完成您的帖子",
    PleaseFinishChatMsg: "请先完成您的聊天信息",
    PleaseFinishMsg: "请先完成您的消息",
    PleaseSaveEdits: "请先保存您当前的编辑",
    PleaseSaveOrCancel: "请先保存或取消您的新主题",
    CanContinueEditing: "如果您再次打开编辑器，可以继续编辑您的文本。",
    //"(But the text will currently be lost if you leave this page.)",
    PleaseDontDeleteAll: "请不要删除所有文本。请写点东西。",
    PleaseWriteSth: "请写点东西。",
    PleaseWriteTitle: "请写一个主题标题。",
    PleaseWriteMsgTitle: "请写一条消息标题。",
    PleaseWriteMsg: "请写一条消息。",

    exBold: "粗体文本",
    exEmph: "强调文本",
    exPre: "预格式化文本",
    exQuoted: "引用文本",
    ExHeading: "标题",

    TitlePlaceholder: "输入一个标题——简洁地说明这是关于什么的？",

    EditPost_1: "编辑 ",
    EditPost_2: " 帖子 ",

    TypeChatMsg: "输入聊天信息：",
    YourMsg: "您的消息：",
    CreateTopic: "创建新主题",
    CreateCustomHtml: "创建自定义 HTML 页面（添加您自己的 <h1> 标题）",
    CreateInfoPage: "创建信息页面",
    CreateCode: "创建源代码页面",
    AskQuestion: "提出问题",
    ReportProblem: "报告问题",
    SuggestIdea: "建议一个想法",
    NewChat: "新聊天频道的标题和目的",
    NewPrivChat: "新的私人聊天标题和目的",
    AppendComment: "在页面底部添加评论：",

    ReplyTo: "回复 ",
    ReplyTo_theOrigPost: "原始帖子",
    ReplyTo_post: "帖子 ",
    AddCommentC: "添加评论：", // MISSING, & dupl t.AddComment

    PleaseSelectPosts: "请选择一个或多个帖子进行回复。",

    Save: "保存",
    edits: "次编辑",

    PostReply: "发布回复",
    PostComment: "发布评论",
    Post: "发布",
    comment: "评论",
    question: "问题",

    PostMessage: "发布信息",
    SimpleEditor: "简单编辑器",

    Send: "发送",
    message: "信息",

    Create: "创建",
    page: "页面",
    chat: "聊天",
    idea: "想法",
    topic: "话题",

    Submit: "提交",
    problem: "问题",

    ViewOldEdits: "查看旧编辑",

    UploadBtnTooltip: "上传文件或图像",
    BoldBtnTooltip: "加粗文字",
    EmBtnTooltip: "强调",
    QuoteBtnTooltip: "引用",
    PreBtnTooltip: "预格式文本",
    HeadingBtnTooltip: "标题",

    TypeHerePlaceholder:
      "在此处输入。您可以使用Markdown和HTML。拖放以粘贴图像。",

    Maximize: "最大化",
    ToNormal: "恢复正常",
    TileHorizontally: "水平平铺",

    PreviewC: "预览：",
    TitleExcl: "（不包括标题）",
    ShowEditorAgain: "再次显示编辑器",
    Minimize: "最小化",

    IPhoneKbdSpace_1: "（此灰色空间为",
    IPhoneKbdSpace_2: "iPhone键盘保留。）",

    PreviewInfo: "您可以在此处预览您的发布内容。",
    CannotType: "您无法在此处键入。",

    LoadingDraftDots: "正在加载任何草稿...",
    DraftUnchanged: "未更改。",
    CannotSaveDraftC: "无法保存草稿：",
    DraftSavedBrwsr: "草稿已保存，在浏览器中。", // 缺失翻译
    DraftSaved: (nr: string | number) => `已保存草稿${nr}。`,
    DraftDeleted: (nr: string | number) => `已删除草稿${nr}。`,
    WillSaveDraft: (nr: string | number) => `将保存草稿${nr}...`,
    SavingDraft: (nr: string | number) => `正在保存草稿${nr}...`,
    DeletingDraft: (nr: string | number) => `正在删除草稿${nr}...`,
  },

  // 选择分类下拉框

  scd: {
    SelCat: "选择分类",
  },

  // 页面类型下拉框

  pt: {
    SelectTypeC: "选择主题类型：",
    DiscussionExpl: "讨论某个话题。",
    QuestionExpl: "一个答案可以被标记为被接受的答案。",
    ProblExpl: "如果有什么东西坏了或不起作用。可以被标记为已修复/已解决。",
    IdeaExpl: "一个建议。可以被标记为已完成/已实施。",
    ChatExpl: "一个或许永无止境的对话。",
    PrivChatExpl: "只有被邀请加入聊天的人才能看到。",
    CustomHtml: "自定义 HTML 页面",
    InfoPage: "信息页面",
    Code: "代码",
    EmbCmts: "嵌入式评论",
    About: "关于",
    PrivChat: "私人聊天",
    Form: "表单",
  },

  // 加入子社区对话框

  jscd: {
    NoMoreToJoin: "没有更多的社区可加入。",
    SelCmty: "选择社区...",
  },

  // 搜索对话框和搜索页面。

  s: {
    SearchForHelp: "搜索帮助", // MISSING
    TxtToFind: "要搜索的文本",
  },

  // 无网络

  ni: {
    NoInet: "无网络连接",
    PlzRefr: "刷新页面以查看最新更改。(发生了断网)",
    RefrNow: "立即刷新",
  },

  PostDeleted: (postNr: number) => `该帖子，编号${postNr}，已被删除。`,
  NoSuchPost: (postNr: number) => `本页上没有编号为${postNr}的帖子。`,
  NoPageHere: "该页面已被删除，或从未存在，或您无权访问它。",
  GoBackToLastPage: "返回上一页",
});
