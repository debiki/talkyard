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

var t_ru_RU: TalkyardTranslations = t = {

  // A single or a few words, sorted alphabetically, to reuse everywhere.

  Active: "Активный",
  Activity: "Активность",
  Add: "Добавить",
  AddingDots: "Добавить ...",
  Admin: "Админ",
  AdvSearch: "Расширенный поиск",
  Away: "Прочь",
  Back: "Назад",
  BlogN: "Блог",
  Bookmarks: "Закладки",
  Cancel: "Отмена",
  Categories: "Категории",
  Category: "Категория",
  ChangeV: "Изменить",
  Continue: "Продолжить",
  ClickToShow: "Нажмите, чтобы показать",
  ChangeDots: "Изменить ...",
  ChatN: "Чат",
  Chatting: "Беседы",
  CheckYourEmail: "Проверьте свой email",
  Close: "Закрыть",
  closed: "закрыто",
  Created: "Created",
  Delete: "Удалить",
  Deleted: "Удалено",
  DirectMessage: "Прямое сообщение",
  Discussion: "Обсуждение",
  discussion: "обсуждение",
  done: "готово",
  EditV: "Ред.",
  Editing: "Редактировать",
  EmailAddress: "Email адрес",
  EmailAddresses: "Email адрес",
  EmailSentD: "Email отправлен.",
  Forum: "Форум",
  GetNotifiedAbout: "Получать уведомления об",
  GroupsC: "Группы:",
  Hide: "Спрятать",
  Home: "Главная",
  Idea: "Идея",
  Join: "Присоединиться",
  KbdShrtcsC: "Горячие клавиши: ",
  Loading: "Загрузка...",
  LoadMore: "Загрузить больше ...",
  LogIn: "Войти",
  LoggedInAs: "Войти как ",
  LogOut: "Выйти",
  Maybe: "Возможно",
  Manage: "Управлять",
  Members: "Участники",
  MessageN: "Сообщение",
  MoreDots: "Больше...",
  Move: "Переехать",
  Name: "Имя",
  NameC: "Имя:",
  NewTopic: "Новая тема",
  NoCancel: "Нет, отменить",
  Notifications: "Уведомления",
  NotImplemented: "(Не реализована)",
  NotYet: "Еще нет",
  NoTitle: "Без названия",
  NoTopics: "Нет тем.",
  Okay: "Хорошо",
  OkayDots: "Хорошо ...",
  Online: "В сети",
  onePerLine: "по одному в строке",
  PreviewV: "Предварительный просмотр",
  Problem: "Проблема",
  progressN: "прогресс",
  Question: "Вопрос",
  Recent: "Последний",
  Remove: "Удалить",
  Reopen: "Возобновить",
  ReplyV: "Ответить",
  Replying: "Ответ",
  Replies: "Ответы",
  replies: "ответы",
  Save: "Сохранить",
  SavingDots: "Сохранение ...",
  SavedDot: "Сохраненный.",
  Search: "Поиск",
  SendMsg: "Отправить сообщение",
  SignUp: "Войти",
  Solution: "Решение",
  started: "началось",
  Summary: "Итого",
  Submit: "Submit",
  Tools: "Инструменты",
  Topics: "Темы",
  TopicTitle: "Название темы",
  TopicType: "Тип темы",
  UploadingDots: "Выгрузка...",
  Username: "Имя пользователя",
  Users: "Пользователи",
  Welcome: "Добро пожаловать!",
  Wiki: "Вики",
  Yes: "Да",
  YesBye: "Да, пока",
  YesDoThat: "Да, сделать",
  You: "Ты",
  you: "ты",

  // Trust levels.
  Guest:  "Гость",
  NewMember: "Новый участник",
  BasicMember: "Основной участник",
  FullMember: "Полноценный участник",
  TrustedMember: "Доверенный участник",
  RegularMember: "Доверенный постоянный",  // MISSING renamed Regular Member —> Trusted Regular [RENREGLS]
  CoreMember: "Основной участник",

  // Periods.
  PastDay: "Вчера",
  PastWeek: "Прошлая Неделя",
  PastMonth: "Прошлый Месяц",
  PastQuarter: "Прошлый Квартал",
  PastYear: "Прошлый Год",
  AllTime: "Все Время",

  // Time ago letters.
  // English examples: "3d" in forum topic list means 3 days ago. "5h" is 5 hours.
  monthsLtr: "м",  // months
  daysLtr: "д",      // days
  hoursLtr: "ч",     // hours
  minsLtr: "м",      // minutes
  secsLtr: "с",      // seconds

  // Time ago, long text versions.
  daysAgo: (numDays: number) =>
    numDays === 1 ? "1 день назад" : `${numDays} дней назад`,

  hoursAgo: (numHours: number) =>
    numHours === 1 ? "1 час назад" : `${numHours} часов назад`,

  minutesAgo: (numMins: number) =>
    numMins === 1 ? "1 минуту назад" : `${numMins} минут назад`,

  secondsAgo: (numSecs: number) =>
    numSecs === 1 ? "1 секунду назад" : `${numSecs} секунд назад`,


  // Input fields, e.g. email, name etc.

  inp: {
    // Email address input field:
    EmReq: "Требуется Email",
    NoSpcs: "Без пробелов, пожалуйста",
    InvldAddr: "Неверный email",
    NoBadChrs: "Без странных символов, пожалуйста",

    // Full name input field:
    NotOnlSpcs: "Без пробелов, пожалуйста",
    NoAt: "Без @ пожалуйста",

    // Username input field:
    NoDash: "Без тире (-) пожалуйста",
    DontInclAt: "Не вставляйте @",
    StartEndLtrDgt: "В начали и в конце должна быть буква или цифра.",
    OnlLtrNumEtc: "Только буквы (a-z, A-Z) и цифры, и _ (нижнее подчеркивание)",
    // This shown just below the username input:
    UnUnqShrt_1: "Твой ",
    UnUnqShrt_2: "@username",
    UnUnqShrt_3: ", уникальный и короткий",

    // Generic messages for all input fields:
    TooShort: (minLength: number) => `Должно быть минимум ${minLength} символов`,
    TooLong: (maxLength: number) => `Слишком длинный. Должно быть максимум ${maxLength} символов`,
  },


  // Notification levels.

  nl: {
    EveryPost: "Каждый пост",
    EveryPostInTopic: "Вы будете уведомлены обо всех новых ответах в этой теме.",
    EveryPostInCat: "Вы будете уведомлены обо всех новых темах и ответах в этой категории.",
    EveryPostInTopicsWithTag: "Вы будете уведомлены о новых темах с этим тегом, и все ответах в этих темах.",
    EveryPostWholeSite: "Вы будете получать уведомления обо всех новых темах и ответах, где угодно",

    // One will be notified about the *first* post in a new topic, only. That is, the Original Post
    // (that's what the first post is called, in a discussion forum topic).
    NewTopics: "Новые темы",
    NewTopicsInCat: "Вы будете получать уведомления о новых темах в этой категории.",
    NewTopicsWithTag: "Вы будете получать уведомления о новых темах с этим тегом.",
    NewTopicsWholeSite: "Вы будете получать уведомления о всех новых темах.",

    Tracking: "Отслеживать",

    Normal: "Обычный",
    NormalDescr: "Вы будете уведомлены, если кто-то говорит с вами, также косвенно, например, " +
        "ответить на ответ вам.",
    //NormalTopic_1: "You'll be notified if someone talks to you, or mentions your ",
    //NormalTopic_2: "@name",

    Hushed: "Замяли",
    HushedDescr: "Вы будете уведомлены, только если кто-то говорит напрямую с вами.",

    Muted: "Приглушенный",
    MutedTopic: "Нет уведомлений.",   // MISSING removed "about this topic"
  },


  // Forum intro text

  fi: {
    Edit: "Ред.",
    Hide_1: "Скрыть",
    Hide_2: ", щелчок ",
    Hide_3: " вновь открыть",
  },


  // Forum categories

  fcs: {
    All: "Все", // "All (categories)", shorter than AllCats
  },


  // Forum buttons

  fb: {

    TopicList: "Список тем",

    // Select category dropdown

    from: "с",  // MISSING used like so:  "From <Category Name>" or "From All Categories"
    in: "в",      // MISSING used like so:  "in <Category Name>" or "in All Categories"
    AllCats: "Все категории",

    // Topic sort order

    Active: "Активен первым",      // MISSING didn't add "first" yet to transls
    ActiveDescr: "Сначала показать последние активные темы",

    New: "Новый",
    NewDescr: "Сначала показать новые темы",

    Top: "Популярные",              // MISSING didn't rename from Top to Popular in transls
    TopDescr: "Сначала показать популярные темы",

    // Topic filter dropdown

    AllTopics: "Все темы",

    ShowAllTopics: "Показать все темы",
    ShowAllTopicsDescr: "Не удаленные темы, хотя",

    WaitingTopics: "Ожидание темы",          // MISSING
    OnlyWaitingDescr_1: "Показывает только темы ", // MISSING changed "questions" to "topics"
    OnlyWaitingDescr_2: "ожидания ",
    OnlyWaitingDescr_3: "для решения или для реализации и выполнения",  // MISSING rewrote

    YourTopics: "Ваши темы",       // MISSING
    AssignedToYou: "Назначено вам", // MISSING

    DeletedTopics: "Показать удаленные",   // MISSING
    ShowDeleted: "Показать удаленные",
    ShowDeletedDescr: "Показать все темы, включая удаленные темы",

    // Rightmost buttons

    ViewCategories: "Посмотреть категории",  // MISSING
    EditCat: "Изменить Категорию",
    CreateCat: "Создать Категорию",
    CreateTopic: "Создать Тему",
    PostIdea: "Добавить Идею",
    AskQuestion: "Задать вопрос",
    ReportProblem: "Сообщить о проблеме",
    CreateMindMap: "Создать Mind Map",
    CreatePage: "Создать Страницу",

  },


  // Forum topic list

  ft: {
    ExplIcons: "Поясняющие иконки...",
    IconExplanation: "Поясняющие иконки:",
    ExplGenDisc: "Общее обсуждение.",
    ExplQuestion: "Вопрос без ответа.",
    ExplAnswer: "Вопрос с принятым ответом.",
    ExplIdea: "Идея / предложение.",
    ExplProblem: "Проблема.",
    ExplPlanned: "Что-то, что мы планируем сделать или исправить.",
    ExplDone: "Что-то, что было сделано или исправлено.",
    ExplClosed: "Тема закрыта.",
    ExplPinned: "Тема всегда указана первой (возможно, только в своей категории).",

    PopularTopicsComma: "Популярные темы, ",
    TopFirstAllTime: "Сначала показать самые популярные темы, за все время.",
    TopFirstPastDay: "Показать темы, популярные за прошедший день.",

    CatHasBeenDeleted: "Эта категория была удалена",

    TopicsActiveFirst: "Темы, недавно активные в первую очередь",
    TopicsNewestFirst: "Темы, сначала новые",

    CreatedOn: "Создано на ",
    LastReplyOn: "\nПоследний ответить на ",
    EditedOn: "\nОтредактировано на ",

    // These are shown as mouse-hover tooltips, or mobile-phone-touch-tips, over the user
    // avatar icons, in the forum topic list.
    createdTheTopic: "создал тему",
    frequentPoster: "частый постер",
    mostRecentPoster: "самый последний постер",

    inC: "в: ",

    TitleFixed: "Было исправлено",
    TitleDone: "Было сделано",
    TitleStarted: "Мы начали это",
    TitleStartedFixing: "Мы начали это исправлять",
    TitleUnsolved: "Нерешенная проблема",
    TitleIdea: "Идея",
    TitlePlanningFix: "Мы планируем это исправить",
    TitlePlanningDo: "Мы планируем сделать это",
    TitleChat: "Канал чата",
    TitlePrivateChat: "Частный канал чата",
    TitlePrivateMessage: "Личное сообщение",
    TitleInfoPage: "Информационная страница",
    TitleDiscussion: "Обсуждение",
    IsPinnedGlobally: "\nОн был закреплен, поэтому он указан первым.",
    IsPinnedInCat: "\nОн был закреплен в своей категории, поэтому занял первое место в своей категории.",
  },


  // Forum categories list

  fc: {
    RecentTopicsWaiting: "Последние темы (что ждут)",
    RecentTopicsInclDel: "Последние темы (включая удаленные)",
    RecentTopics: "Последние темы",
    _replies: " ответы",
    _deleted: " (удален)",
    _defCat: " (категория по умолчанию)",
  },


  // Topbar

  // Shown at the top of the page. Includes login and signup buttons, or one's username menu.

  tb: {

    // Opens the right hand sidebar and litst the most recent posts in the current topic.
    RecentPosts: "Недавние Посты",

    // Open right-hand-sidebar button tooltip, if mouse-hovering online-user-count.
    NumOnlChat: " онлайн в этом чате",    // example: "5 online in this chat"
    NumOnlForum: " онлайн на этом форуме",

    // Open left-sidebar button title.
    WatchbBtn: "Ваши темы",

    // Tooltip, shown if mouse-hovering the open-left-sidebar button.
    WatchbToolt: "Ваши последние темы, присоединенные чаты, прямые сообщения",

    // Title shown on user profile pages.
    AbtUsr: "О пользователе",

    // Shortcuts to leave the user profile page, or staff area, and go back to the discussion topics.
    BackFromUsr: "Вернуться из профиля пользователя",
    BackFromAdm: "Вернуться из админки",

    // Title shown on full text search page.
    SearchPg: "Страница поиска",
  },


  // Watchbar (the sidebar to the left)

  wb: {
    AddCommunity: "Добавить ...",
    RecentlyViewed: "Недавно просмотренные темы",  // MISSING " topics"
    JoinedChats: "Вступившие в Чаты",
    ChatChannels: "Каналы чата",
    CreateChat: "Создать канал чата",
    DirectMsgs: "Прямые сообщения",
    NoChats: "Нет",    // meaning: "No chat messages"
    NoDirMsgs: "Нет",  // meaning: "No direct messages"

    // The click-topic dropdown menu:
    TopicActions: "Тематические действия",
    ViewPeopleHere: "Посмотреть людей здесь",
    ViewAddRemoveMembers: "Просмотреть / добавить / удалить участников",
    ViewChatMembers: "Просмотр участников чата",
    EditChat: "Изменить описание чата",
    //EditChat: "Edit chat title and purpose", // Keep, in case adds back edit-title input
    LeaveThisChat: "Покинуть этот чат",
    LeaveThisCommunity: "Покинуть это сообщество",
    JoinThisCommunity: "Присоединяйтесь к этому сообществу",
  },


  // Contextbar (the sidebar to the right)

  cb: {
    RecentComments: "Последние комментарии в этой теме:",
    NoComments: "Комментариев нет.",

    YourBookmarks: "Ваши закладки:",

    UsersOnline: "Пользователи онлайн:",
    UsersOnlineForum: "Пользователи онлайн на этом форуме:",
    UsersInThisChat: "Пользователи в этом чате:",
    UsersInThisTopic: "Пользователи в этой теме:",

    GettingStartedGuide: "Руководство Админа", // MISSING in other langs, was: "Getting Started Guide".
    AdminGuide: "Руководство Админа",          // ... but what? It's here already, just reuse this transl field
    Guide: "Руководство",

    // How to hide the sidebar.
    CloseShortcutS: "Закрыть (сочетание клавиш: S)",

    // ----- Online users list / Users in current topic

    AddPeople: "Добавить больше людей",

    // Shown next to one's own username, in a list of users.
    thatsYou: "это ты",

    // Info about which people are online.
    // Example, in English: "Online users: You, and 5 people who have not logged in"
    OnlyYou: "Кажется, только ты",
    YouAnd: "Ты и ",
    NumStrangers: (numStrangers: number) => {
      const people = numStrangers === 1 ? " человек" : " люди";
      const have = numStrangers === 1 ? "имеет" : "имеют";
      return numStrangers + people + " кто " + have + " не вошел";
    },

    // ----- Recent comments list

    // This explains how the Recent tab in the sidebar works.

    RepliesToTheLeft: "Ответы слева отсортированы по ",
    bestFirst: "самый первый.",
    ButBelow: "Но ниже ",
    insteadBy: " одни и те же ответы сортируются по ",
    newestFirst: "новые впереди.",

    SoIfLeave: "Так что если вы уйдете и вернетесь сюда позже, ниже вы найдете ",
    allNewReplies: "все новые ответы.",
    Click: "Нажмите",
    aReplyToReadIt: " ответ ниже, чтобы его прочитать - потому что только выдержка показана ниже.",
  },


  // Change page dialog
  cpd: {
    ClickToChange: "Нажмите, чтобы изменить статус",
    ClickToViewAnswer: "Нажмите, чтобы посмотреть ответ",
    ViewAnswer: "Посмотреть ответ",
    ChangeStatusC: "Изменить статус на:",
    ChangeCatC: "Изменить категорию:",
    ChangeTopicTypeC: "Изменить тип темы:",
  },


  // Page doing status, PageDoingStatus
  pds: {
    aQuestion: "вопрос",
    hasAccptAns: "имеет принятый ответ",
    aProblem: "проблема",
    planToFix: "планирую исправить",
    anIdea: "идея",
    planToDo: "планирую сделать",
  },


  // Discussion / non-chat page

  d: {
    // These texts are split into parts 1,2 or 1,2,3 ec, because in between the texts,
    // icons are shown, to help people understand what those icons mean.

    ThisFormClosed_1: "Эта форма была ",
    // A Topic-has-been-Closed icon shown here, between text parts 1 (just above) and 2 (below).
    ThisFormClosed_2: "закрыто; Вы больше не можете заполнить и опубликовать его.",

    ThisTopicClosed_1: "Эта тема была ",
    // A Topic-has-been-Closed icon, + the text "closed", shown here.
    ThisTopicClosed_2: ". Вы все еще можете оставлять комментарии.",   // SYNC removed "won't make ... bump ..."

    ThisPageDeleted: "Эта страница была удалена",
    CatDeldPageToo: "Категория удалена, поэтому эта страница также была удалена",

    ThreadDeld: "Тема удалена",
    CmntDeld: "Комментарий удален",
    PostDeld: "Пост удален",
    DiscDeld: "Обсуждение удалено",
    PageDeld: "Страница удалена",
    TitlePendAppr: "Название в ожидании утверждения",
    TextPendingApproval: "Текст в ожидании утверждения",

    TooltipQuestClosedNoAnsw: "Вопрос был закрыт без принятого ответа.",
    TooltipTopicClosed: "Тема закрыта.",

    TooltipQuestSolved: "Решенный вопрос",
    TooltipQuestUnsolved: "Нерешенный вопрос",

    StatusDone: "Готово",
    TooltipProblFixed: "Исправлено",
    TooltipDone: "Сделано",

    StatusStarted: "Началось",
    TooltipFixing: "Мы начали исправлять",      // MISSING "We're currently" —> "We've started"
    TooltipImplementing: "Мы начали делать", // MISSING  -""-

    StatusPlanned: "Запланированные",
    TooltipProblPlanned: "Мы планируем исправить",
    TooltipIdeaPlanned: "Мы планируем сделать",   // or "to implement this"?

    StatusNew: "НОвый",
    StatusNewDtl: "Новая тема, обсуждается",
    TooltipUnsProbl: "Нерешенная проблема",
    TooltipIdea: "Эта идея",

    TooltipPersMsg: "Личное сообщение",
    TooltipChat: "# означает канал чата",
    TooltipPrivChat: "Это частный канал чата",

    TooltipPinnedGlob: "\nПрикреплено глобально.",
    TooltipPinnedCat: "\nЗакреплено в этой категории.",

    SolvedClickView_1: "Решено в посте #",
    SolvedClickView_2: ", нажмите, чтобы посмотреть",

    PostHiddenClickShow: "Сообщение скрыто; нажмите, чтобы показать",
    ClickSeeMoreRepls: "Нажмите, чтобы показать больше ответов",
    ClickSeeMoreComments: "Нажмите, чтобы показать больше комментариев",
    ClickSeeThisComment: "Нажмите, чтобы показать этот комментарий",
    clickToShow: "нажмите, чтобы показать",

    ManyDisagree: "Многие с этим не согласны:",
    SomeDisagree: "Некоторые не согласны с этим:",

    CmtPendAppr: "Комментарий в ожидании одобрения, опубликовано ",
    CmtBelowPendAppr: (isYour) => (isYour ? "Ваш" : "") + " комментарий ниже ожидает одобрения.",

    _and: " и",

    repliesTo: "ответы на",
    InReplyTo: "В ответ на",

    ClickViewEdits: "Нажмите, чтобы посмотреть старые правки",

    By: " ", // ... someones name

    // Discussion ...
    aboutThisIdea: "о том, как и если сделать эту идею",
    aboutThisProbl: "о том, как и если это исправить",

    AddProgrNote: "Добавить заметку о прогрессе",
    // Progress ...
    withThisIdea: "с выполнением этой идеи",
    withThisProbl: "с решением этой проблемы",
    withThis: "с этим",
  },


  // Metabar

  // Shown between the original post and all replies.

  mb: {
    NotfsAbtThisC: "Уведомления на эту тему:",

    // If is a direct message topic, members listed below this text.
    Msg: "Сообщение",

    SmrzRepls: "Подытожить ответы",

    // Don't bother about being correct with "1 reply", "2,3,4 replies".
    // Just write "replies" always instead? (also if only one)

    EstTime: (numReplies: number, minutes: number) =>
        `There are ${numReplies} replies. Estimated reading time: ${minutes} minutes`,

    DoneSummarizing: (numSummarized: number, numShownBefore: number) =>
        `Done. Summarized ${numSummarized} replies, of the ${numShownBefore} replies previously shown.`,
  },


  // Post actions

  pa: {
    CloseOwnQuestionTooltip: "Закройте этот вопрос, если вам больше не нужен ответ.",
    CloseOthersQuestionTooltip: "Закройте этот вопрос, если он не нуждается в ответе, например, если " +
        "это не по теме или уже ответили в другой теме.",
    CloseToDoTooltip: "Закройте это задание, если это не нужно делать или исправлять.",
    CloseTopicTooltip: "Закройте эту тему, если она не нуждается в дальнейшем рассмотрении.",

    AcceptBtnExpl: "Примите это как ответ на вопрос или проблему",
    SolutionQ: "Решение?",
    ClickUnaccept: "Нажмите, чтобы отменить этот ответ",
    PostAccepted: "Пост был принят в качестве ответа",

    NumLikes: (num: number) => num === 1 ? "1 Нравится" : num + " Нравится",
    NumDisagree: (num: number) => num + " не соглашаться",
    NumBury: (num: number) => num === 1 ? "1 Закопал" : num + " Закопали",
    NumUnwanted: (num: number) => num === 1 ? "1 Против" : num + " Против",

    MoreVotes: "Больше голосов...",
    LikeThis: "Нравится",
    LinkToPost: "Ссылка на этот пост",
    Report: "Сообщить",
    ReportThisPost: "Сообщить об этом сообщении",
    Admin: "Админ",
    DiscIx: "Указатель дискуссий",

    Disagree: "Не согласен",
    DisagreeExpl: "Нажмите здесь, чтобы не согласиться с этим сообщением или предупредить других о фактических ошибках.",
    Bury: "Похронить",
    BuryExpl: "Нажмите, чтобы отсортировать другие сообщения перед этим сообщением. Только сотрудники форума могут видеть ваш голос.",
    Unwanted: "Ненужный",
    UnwantedExpl: "Если вы не хотите этот пост на этом сайте. Это уменьшило бы мое доверие " +
            "в посте автора. Только сотрудники форума могут видеть ваш голос.",

    AddTags: "Добавить/Удалить теги",
    UnWikify: "Un-Wikify",
    Wikify: "Wikify",
    PinDeleteEtc: "Прикрипить / Удалить / Категория ...",
  },


  // Share dialog

  sd: {
    Copied: "Скопировать.",
    CtrlCToCopy: "Нажмите CTRL + C, чтобы скопировать.",
    ClickToCopy: "Нажмите, чтобы скопировать ссылку.",
  },


  // Chat

  c: {
    About_1: "Это ",
    About_2: " канал чата, созданный ",
    ScrollUpViewComments: "Прокрутите вверх, чтобы просмотреть старые комментарии",
    Purpose: "Цель:",
    edit: "ред.",
    'delete': "удалить",
    MessageDeleted: "(Сообщение удалено)",
    JoinThisChat: "Присоединяйтесь к чату",
    PostMessage: "Отправить сообщение",
    AdvancedEditor: "Расширенный редактор",
    TypeHere: "Введите здесь. Вы можете использовать Markdown и HTML.",
  },


  // My Menu

  mm: {
    NeedsReview: "Нужен обзор ",
    AdminHelp: "Справка Админа ",
    StaffHelp: "Помощь персонала ",
    DraftsEtc: "Черновики, закладки, задания",
    MoreNotfs: "Посмотреть все уведомления",
    DismNotfs: "отметить все как прочитанное",
    ViewProfile: "Просмотр вашего профиля",
    ViewGroups: "Просмотр групп",
    LogOut: "Выйти",
    UnhideHelp: "Показать справочные сообщения",
  },


  // Scroll buttons

  sb: {
    ScrollToC: "Прокрутить до:",
    Scroll: "Прокрутить",

    // The Back button, and the letter B is a keyboard shortcut.
    // If in your language, "Back" doesn't start with 'B', then instead
    // set Back_1 to '' (empty text), and Back_2 to:  "Back (B)" — and "Back" (but not "B")
    // translated to your language.
    Back_1: "",
    Back_2: "Назад (B)",
    BackExpl: "Вернитесь к своей предыдущей позиции на этой странице.",

    // These are useful on mobile — then, no keybard with Home (= scroll to top) and End buttons.
    // And, on a keyboard, once you get used to it, it's quite nice to click 1 to go to the
    // top, and 2 to see the first reply, and B to go back, F forward, so on.
    PgTop: "Верх страницы",
    PgTopHelp: "Перейти к началу страницы. Клавиша: 1",
    Repl: "Ответы",
    ReplHelp: "Перейдите в раздел Ответы. Клавиша: 2",
    Progr: "Прогресс",
    // The Progress section is at the end of the page, and there, things like
    // "Alice changed status to Doing" and "Alise marked this as Done" and "Topic closed by ..."
    // are shown. (And, optionally, comments by staff or the people working with the issue.)
    ProgrHelp: "Перейти в раздел Прогресс. Клавиша: 3",
    PgBtm: "Вниз страницы",
    Btm: "Низ",
    BtmHelp: "Перейти в конец страницы. Клавиша: 4",

    // "Keyboard shrotcuts: ..., and B to scroll back"
    Kbd_1: ", и ",
    // then the letter 'B' (regardless of language)
    Kbd_2: " прокрутить назад",
  },


  // Select users dialog
  sud: {
    SelectUsers: "Выберите пользователей",
    AddUsers: "Добавить пользователей",
  },


  // About user dialog

  aud: {
    IsMod: "Модератор.",
    IsAdm: "Администратор.",
    IsDeld: "Деактивирован или удален.",
    ThisIsGuest: "Гостем, может быть кто угодно.",
    ViewInAdm: "Посмотреть в админке",
    ViewProfl: "Просмотреть профиль",
    ViewComments: "Посмотреть другие комментарии",
    RmFromTpc: "Удалить из темы",
    EmAdrUnkn: "Email адрес неизвестен - этот гость не будет уведомлен об ответах.",
  },


  // User's profile page

  upp: {
    // ----- Links

    Preferences: "Предпочтения",
    Invites: "Пригласить",
    DraftsEtc: "Черновики",
    About: "About",
    Privacy: "Конфиденциальность",
    Account: "Аккаунт",
    Interface: "Интерфейс",

    // ----- Overview stats

    JoinedC: "Регистрация: ",
    PostsMadeC: "Посты сделаны: ",
    LastPostC: "Последний пост: ",
    LastSeenC: "В последний раз смотрел: ",
    TrustLevelC: "Уровень доверия: ",

    // ----- Action buttons

    // ----- Profile pic

    UploadPhoto: "Загрузить фото",
    ChangePhoto: "Изменить фото",
    ImgTooSmall: "Изображение слишком маленькое: должно быть не менее 100 х 100",

    // ----- Activity

    OnlyStaffCanSee: "Могут видеть только сотрудники и доверенные основные участники.",
    OnlyMbrsCanSee: "Только люди, которые были активными участниками некоторое время, могут видеть это.",
    Nothing: "Нечего показать",
    Posts: "Посты",
    NoPosts: "Нет Постов.",
    Topics: "Темы",
    NoTopics: "Нет Тем.",

    // ----- User status

    UserBanned: "Пользователь забанен",
    UserSuspended: (dateUtc: string) => `Пользователь приостановлен до ${dateUtc} UTC`,
    ReasonC: "Причина: ",

    DeactOrDeld: "Был деактивирован или удален.",
    isGroup: " (группа)",
    isGuest: " — гостем, может быть кто угодно",
    isMod: " – модератор",
    isAdmin: " – администратор",
    you: "(ты)",

    // ----- Notifications page

    NoNotfs: "Нет уведомлений",
    NotfsToYouC: "Уведомления для вас:",
    NotfsToOtherC: (name: string) => `Уведомления для ${name}:`,
    DefNotfsSiteWide: "Уведомления по умолчанию для всего сайта",
    // The "for" in:  "Default notifications, site wide, for (someone's name)".
    forWho: "for",

    // ----- Drafts Etc page

    NoDrafts: "Нет Черновиков",
    YourDraftsC: "Ваши черновики:",
    DraftsByC: (name: string) => `Черновики ${name}:`,

    // ----- Invites page

    InvitesIntro: "Здесь вы можете пригласить людей присоединиться к этому сайту. ",
    InvitesListedBelow: "Приглашения, которые вы уже отправили, перечислены ниже.",
    NoInvites: "Вы еще никого не пригласили.",

    InvitedEmail: "Приглашенный email",
    WhoAccepted: "Участник, который принял",
    InvAccepted: "Приглашение принято",
    InvSent: "Приглашение отправлено",
    JoinedAlready: "Уже присоединился",

    SendAnInv: "Пригласить людей", // was: "Send an Invite",   MISSING I18N all other langs
    SendInv: "Отправить приглашения",   // MISSING I18N is just "Send invite" (singularis) in all other langs
    SendInvExpl:  // MISSING I18N changed to pluralis
        "Мы отправим вашим друзьям краткое email. They'll click a link " +
        "присоединиться немедленно, не требуется вход в систему. " +
        "Они станут обычными участниками, а не модераторами или администраторами.",
    //EnterEmail: "Enter email(s)",
    InvDone: "Готово. Я отправлю им email.",
    NoOneToInv: "Никого не приглашать.",
    InvNotfLater: "Я сообщу тебе позже, когда я их пригласил.",
    AlreadyInvSendAgainQ: "Они уже были приглашены - может быть, вы хотели бы пригласить их снова?",
    InvErr_1: "Это привело к ",
    InvErr_2: "ошибке",
    InvErr_3: ":",
    TheseJoinedAlrdyC: "Они уже присоединились, поэтому я не пригласил их:",
    ResendInvsQ: "Повторно отправить приглашения этим людям? Их уже пригласили.",
    InvAgain: "Пригласить снова",

    // ----- Preferences, About

    AboutYou: "О вас",
    WebLink: "Любой ваш сайт или страница.",

    NotShownCannotChange: "Не показывается публично. Не может быть изменено.",

    // The full name or alias:
    NameOpt: "Имя (необязательно)",

    NotShown: "Не показывается публично.",

    // The username:
    MayChangeFewTimes: "Вы можете изменить это только несколько раз.",
    notSpecified: "(не определено)",
    ChangeUsername_1: "Вы можете изменить свое имя пользователя только несколько раз.",
    ChangeUsername_2: "Слишком частое изменение может запутать других — " +
        "они не будут знать, как вас упомянуть.",

    NotfAboutAll: "Получать уведомления о каждом новом сообщении (если вы не отключите тему или категорию)",
    NotfAboutNewTopics: "Получать уведомления о новых темах (если вы не заглушите категорию)",

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

    // Password:
    ChangePwdQ: "Change password?",
    CreatePwdQ: "Create password?",
    WillGetPwdRstEml: "You'll get a reset password email.",
    // This is the "None" in:  "Password: None"
    PwdNone: "None",

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


  // Group profile page
  gpp: {
    GroupMembers: "Group members",
    NoMembers: "No members.",
    MayNotListMembers: "May not list members.",
    AddMembers: "Add Members",
    BuiltInCannotModify: "This is a built-in group; it cannot be modified.",
    NumMembers: (num: number) => `${num} members`,
    YouAreMember: "You're a member.",
    CustomGroupsC: "Custom groups:",
    BuiltInGroupsC: "Built-in groups:",
    DeleteGroup: "Delete this group",
  },


  // Create user dialog

  cud: {
    CreateUser: "Create User",
    CreateAccount: "Create Account",
    EmailC: "Email:",
    keptPriv: "will be kept private",
    forNotfsKeptPriv: "for reply notifications, kept private",
    EmailVerifBy_1: "Your email has been verified by ",
    EmailVerifBy_2: ".",
    UsernameC: "Username:",
    FullNameC: "Full name:",
    optName: "optional",

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
    ContinueWithDots: "Continue with ...",
    SignUp: "Sign up",
    LogIn: "Log in",
    LogInWithPwd: "Log in with Password",
    CreateAdmAcct: "Create admin account:",
    AuthRequired: "Authentication required to access this site",
    LogInToLike: "Log in to Like this post",
    LogInToSubmit: "Log in and submit",
    LogInToComment: "Log in to write a comment",
    LogInToCreateTopic: "Log in to create topic",

    AlreadyHaveAcctQ: "You have an account? ",  // MISSING changed "Already have...?" to "You have...?"
    LogInInstead_1: "",
    LogInInstead_2: "Log in",   // "Log in" (this is a button)
    LogInInstead_3: " instead", // "instead"

    NewUserQ: "New user? ",
    SignUpInstead_1: "",
    SignUpInstead_2: "Sign up",
    SignUpInstead_3: " instead",

    OrCreateAcctHere: "Or create account:",
    OrTypeName: "Or type your name:",
    OrLogIn: "Or log in:",
    YourNameQ: "Your name?",

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
    SimilarTopicsC: "Similar topics:",

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

    LoadingDraftDots: "Loading any draft...",
    DraftUnchanged: "Unchanged.",
    CannotSaveDraftC: "Cannot save draft:",
    DraftSaved: (nr: string | number) => `Draft ${nr} saved.`,
    DraftDeleted: (nr: string | number) => `Draft ${nr} deleted.`,
    WillSaveDraft: (nr: string | number) => `Will save draft ${nr} ...`,
    SavingDraft: (nr: string | number) => `Saving draft ${nr} ...`,
    DeletingDraft: (nr: string | number) => `Deleting draft ${nr} ...`,
  },


  // Select category dropdown

  scd: {
    SelCat: "Select category",
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
  },


  // No internet

  ni: {
    NoInet: "No internet connection",
    PlzRefr: "Refresh page to see any latest changes. (There was a disconnection)",
    RefrNow: "Refresh now",
  },


  PostDeleted: (postNr: number) => `That post, nr ${postNr}, has been deleted.`,
  NoSuchPost: (postNr: number) => `There's no post nr ${postNr} on this page.`,
  NoPageHere: "This page has been deleted, or it never existed, or you may not access it.",
  GoBackToLastPage: "Go back to last page",

};
