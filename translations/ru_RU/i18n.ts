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

    ActivitySummaryEmails: "Emails с описанием активности",

    EmailSummariesToGroup:
        "Когда члены этой группы не заходят сюда, по умолчанию отправьте им электронное письмо " +
        "Сводка популярных тем и прочего.",
    EmailSummariesToMe:
        "Когда я не посещаю здесь, напишите мне " +
        "Сводка популярных тем и прочего.",

    AlsoIfTheyVisit: "Напишите им также, если они посещают здесь регулярно.",
    AlsoIfIVisit: "Напишите мне также, если я посещаю здесь регулярно.",

    HowOftenWeSend: "Как часто отправлять письма?",
    HowOftenYouWant: "Как часто вы хотите получать письма?",

    // ----- Preferences, Privacy

    HideActivityStrangers_1: "Скрыть свою недавнюю активность для незнакомцев и новых членов?",
    HideActivityStrangers_2: "(Но не для тех, кто некоторое время был активным участником.)",
    HideActivityAll_1: "Скрыть свою недавнюю активность для всех?",
    HideActivityAll_2: "(За исключением администрации и доверенных основных членов.)",

    // ----- Preferences, Account

    // About email address:
    EmailAddresses: "Email адрес",
    PrimaryDot: "Основной. ",
    VerifiedDot: "Подтвержденный. ",
    NotVerifiedDot: "Не подтверждено. ",
    ForLoginWithDot: (provider: string) => `Для входа через ${provider}. `,
    MakePrimary: "Сделать основной",
    AddEmail: "Добавить email адрес",
    TypeNewEmailC: "Введите новый email адрес:",
    MaxEmailsInfo: (numMax: number) => `(Вы не можете добавить больше, чем ${numMax} адресов.)`,
    EmailAdded_1: "Добавлен. Мы отправили вам письмо с подтверждением — ",
    EmailAdded_2: "проверьте свою электронную почту.",
    SendVerifEmail: "Отправить письмо с подтверждением",

    EmailStatusExpl:
        "('Основной' означает, что вы можете войти через этот адрес, и мы отправляем на него уведомления. " +
        "'Подтвержден' означает, что вы нажали ссылку для подтверждения в электронном письме с подтверждением адреса.)",

    // Password:
    ChangePwdQ: "Измени пароль?",
    CreatePwdQ: "Создать пароль?",
    WillGetPwdRstEml: "Вы получите код для сброса пароля по электронной почте.",
    // This is the "None" in:  "Password: None"
    PwdNone: "Нет",

    // Logins:
    LoginMethods: "Способы входа",
    commaAs: ", как: ",

    // One's data:
    YourContent: "Ваш контент",
    DownloadPosts: "Скачать посты",
    DownloadPostsHelp: "Создает JSON файл с копией опубликованных вами тем и комментариев.",
    DownloadPersData: "Скачать личные данные",
    DownloadPersDataHelp: "Создает файл JSON с копией ваших личных данных, например, твое имя " +
        "(если вы указали имя) и адрес электронной почты.",


    // Delete account:
    DangerZone: "Опасная зона",
    DeleteAccount: "Удалить аккаунт",
    DeleteYourAccountQ:
        "Удалить ваш аккаунт? Мы удалим ваше имя, забудем ваш адрес электронной почты, пароль и " +
        "любые онлайн-идентификаторы (например, Facebook или Twitter). " +
        "Вы не сможете снова войти. И это не может быть отменено.",
    DeleteUserQ:
        "Удалить этого пользователя? Мы удалим имя, забудем адрес электронной почты, пароль и " +
        "онлайн-идентификаторы (например, Facebook или Twitter). " +
        "Пользователь не сможет снова войти. И это не может быть отменено.",
    YesDelete: "Да, удалить",
  },


  // Group profile page
  gpp: {
    GroupMembers: "Участники группы",
    NoMembers: "Нет участников.",
    MayNotListMembers: "Может не быть списка участников.",
    AddMembers: "Добавить участников",
    BuiltInCannotModify: "Встроенная группа; не может быть изменена.",
    NumMembers: (num: number) => `${num} участников`,
    YouAreMember: "Вы участник.",
    CustomGroupsC: "Пользовательские группы:",
    BuiltInGroupsC: "Встроенные группы:",
    DeleteGroup: "Удалить эту группу",
  },


  // Create user dialog

  cud: {
    CreateUser: "Создать пользователя",
    CreateAccount: "Регистрация",
    EmailC: "Email:",
    keptPriv: "будет храниться в тайне",
    forNotfsKeptPriv: "для ответных уведомлений, закрытых",
    EmailVerifBy_1: "Ваш адрес электронной почты был подтвержден ",
    EmailVerifBy_2: ".",
    UsernameC: "Имя:",
    FullNameC: "Полное имя:",
    optName: "по желанию",

    OrCreateAcct_1: "Или ",
    OrCreateAcct_2: "завести аккаунт",
    OrCreateAcct_3: "с участием ",
    OrCreateAcct_4: "@username",
    OrCreateAcct_5: " & пароль",

    DoneLoggedIn: "Аккаунт создан. Вы вошли.",  // COULD say if verif email sent too?
    AlmostDone:
        "Почти сделано! Вам просто нужно подтвердить свой адрес электронной почты. У нас есть " +
        "отправил вам электронное письмо. Пожалуйста, нажмите на ссылку в письме, чтобы активировать " +
        "ваш аккаунт. Вы можете закрыть эту страницу.",
  },


  // Accept terms and privacy policy?

  terms: {
    TermsAndPrivacy: "Условия и Конфиденциальность",

    Accept_1: "Вы принимаете наши ",
    TermsOfService: "Условия Использования",
    TermsOfUse: "Условия Эксплуатации",
    Accept_2: " и ",
    PrivPol: "Политику конфиденциальности",
    Accept_3_User: "?",
    Accept_3_Owner: " для владельцев сайтов?",  // (see just below)

    // About "for site owners?" above:
    // That's if someone creates his/her own community, via this software provided as
    // Software-as-a-Service hosting. Then, there is / will-be a bit different
    // Terms-of-Service to agree with, since being a community maintainer/owner, is different
    // (more responsibility) than just signing up to post comments.

    YesAccept: "Да я принимаю",
  },


  // Password input

  pwd: {
    PasswordC: "Пароль:",
    StrengthC: "Сложность: ",
    FairlyWeak: "Очень слабый.",
    toShort: "слишком короткий",
    TooShort: (minLength: number) => `Слишком короткий. Должно быть хотя бы ${minLength} символов`,
    PlzInclDigit: "Пожалуйста, включите цифру или специальный символ",
    TooWeak123abc: "Слишком слабый. Не используйте пароли, такие как '12345' или 'abcde'.",
    AvoidInclC: "Не используйте в пароле ваше имя или адрес электронной почты:",
  },


  // Login dialog

  ld: {
    NotFoundOrPrivate: "Страница не найдена или Доступ запрещен.",

    // This is if you're admin, and click the Impersonate button to become someone else
    // (maybe to troubleshoot problems with his/her account s/he has asked for help about),
    // and then you, being that other user, somehow happen to open a login dialog
    // (maybe because of navigating to a different part of the site that the user being
    // impersonated cannot access) — then, that error message is shown: You're not allowed
    // to login as *someone else* to access that part of the community, until you've first
    // stopped impersonating the first user. (Otherwise, everything gets too complicated.)
    IsImpersonating: "Вы выдает себя за кого-то, кто не может иметь доступ к этой части " +
        "сайта.",

    IfYouThinkExistsThen: "Если вы считаете, что страница существует, войдите в систему как пользователь, который может получить к ней доступ. ",
    LoggedInAlready: "(Вы уже вошли в систему, но, возможно, это не та учетная запись?) ",
    ElseGoToHome_1: "В противном случае вы можете ",
    ElseGoToHome_2: "перейти на главную страницу.",

    CreateAcconut: "Регистрация",
    ContinueWithDots: "Продолжить с ...",
    SignUp: "Зарегистрироваться",
    LogIn: "Войти",
    LogInWithPwd: "Войти с паролем",
    CreateAdmAcct: "Создать аккаунт администратора:",
    AuthRequired: "Требуется аутентификация для доступа к сайту",
    LogInToLike: "Войдите, чтобы поставить Нравится посту",
    LogInToSubmit: "Войдите и отправьте",
    LogInToComment: "Войдите, чтобы оставить комментарий",
    LogInToCreateTopic: "Войдите, чтобы создать тему",

    AlreadyHaveAcctQ: "У вас есть аккаунт? ",  // MISSING changed "Already have...?" to "You have...?"
    LogInInstead_1: "",
    LogInInstead_2: "Войти",   // "Log in" (this is a button)
    LogInInstead_3: " вместо", // "instead"

    NewUserQ: "Новый пользователь? ",
    SignUpInstead_1: "",
    SignUpInstead_2: "Зарегистрироваться",
    SignUpInstead_3: " вместо",

    OrCreateAcctHere: "Или создать аккаунт:",
    OrTypeName: "Или введите свое имя:",
    OrLogIn: "Или войти:",
    YourNameQ: "Твое имя?",

    BadCreds: "Неверное имя пользователя или пароль",

    UsernameOrEmailC: "Имя пользователя или адрес email:",
    PasswordC: "Пароль:",
    ForgotPwd: "Вы забыли свой пароль?",

    NoPwd: "Вы еще не выбрали пароль.",
    CreatePwd: "Создать пароль",
  },


  // Flag dialog

  fd: {
    PleaseTellConcerned: "Пожалуйста, расскажите нам, что вас беспокоит.",
    ThanksHaveReported: "Благодарю. Вы сообщили об этом. Сотрудники форума посмотрят.",
    ReportComment: "Пожаловаться на комментарий",
    // Different reasons one can choose among when reporting a comment:
    OptPersonalData: "Этот пост содержит личные данные, например, чье-то настоящее имя.",
    OptOffensive: "Этот пост содержит оскорбительное или оскорбительное содержание.",
    OptSpam: "Этот пост является нежелательной рекламой.",
    OptOther: "Сообщить сотрудникам об этой посте по какой-то другой причине.",
  },


  // Help message dialog
  help: {
    YouCanShowAgain_1: "Вы можете снова видеть справочные сообщения, если вы вошли в систему, " +
        "щелкнув свое имя, а затем ",
    YouCanShowAgain_2: "Показать справочные сообщения",
  },


  // Editor

  e: {
    SimilarTopicsC: "Похожие темы:",

    //WritingSomethingWarning: "You were writing something?",
    UploadMaxOneFile: "Извините, но в настоящее время вы можете загружать только один файл за раз",
    PleaseFinishPost: "Пожалуйста, сначала закончите писать свой пост",
    PleaseFinishChatMsg: "Пожалуйста, сначала закончите писать свое сообщение в чате",
    PleaseFinishMsg: "Пожалуйста, сначала закончите писать свое сообщение",
    PleaseSaveEdits: "Пожалуйста, сначала сохраните ваши текущие изменения",
    PleaseSaveOrCancel: "Пожалуйста, сначала сохраните или отмените новую тему",
    CanContinueEditing: "Вы можете продолжить редактировать свой текст, если снова откроете редактор.",
        //"(But the text will currently be lost if you leave this page.)",
    PleaseDontDeleteAll: "Пожалуйста, не удаляйте весь текст. Напиши что-нибудь.",
    PleaseWriteSth: "Пожалуйста, напишите что-нибудь.",
    PleaseWriteTitle: "Пожалуйста, напишите название темы.",
    PleaseWriteMsgTitle: "Пожалуйста, напишите название сообщения.",
    PleaseWriteMsg: "Пожалуйста, напишите сообщение.",

    exBold: "жирный текст",
    exEmph: "выделенный текст",
    exPre: "преформатированный текст",
    exQuoted: "цитируемый текст",
    ExHeading: "Заголовок",

    TitlePlaceholder: "Введите название - что это, в одном коротком предложении?",

    EditPost_1: "Ред. ",
    EditPost_2: "пост ",

    TypeChatMsg: "Введите сообщение чата:",
    YourMsg: "Твое сообщение:",
    CreateTopic: "Создать новую тему",
    CreateCustomHtml: "Создать пользовательскую HTML-страницу (добавь свой <h1> заголовок)",
    CreateInfoPage: "Создать информационную страницу",
    CreateCode: "Создать страницу с исходным кодом",
    AskQuestion: "Задайте вопрос",
    ReportProblem: "Сообщить о проблеме",
    SuggestIdea: "Предложить идею",
    NewChat: "Название и назначение нового канала чата",
    NewPrivChat: "Название и цель нового приватного чата",
    AppendComment: "Добавить комментарий внизу страницы:",

    ReplyTo: "Ответить на ",
    ReplyTo_theOrigPost: "Оригинальный Пост",
    ReplyTo_post: "пост ",

    PleaseSelectPosts: "Пожалуйста, выберите одно или несколько сообщений для ответа.",

    Save: "Сохранить",
    edits: "ред.",

    PostReply: "Ответить",

    Post: "Пост",
    comment: "комментарий",
    question: "вопрос",

    PostMessage: "Отправить сообщение",
    SimpleEditor: "Простой редактор",

    Send: "Отправить",
    message: "сообщение",

    Create: "Создать",
    page: "страницу",
    chat: "чат",
    idea: "идею",
    topic: "тему",

    Submit: "Отправить",
    problem: "проблема",

    ViewOldEdits: "Посмотреть старые правки",

    UploadBtnTooltip: "Загрузить файл или изображение",
    BoldBtnTooltip: "Сделать текст жирным",
    EmBtnTooltip: "Подчеркнуть",
    QuoteBtnTooltip: "Цитата",
    PreBtnTooltip: "Предварительно отформатированный текст",
    HeadingBtnTooltip: "Заголовок",

    TypeHerePlaceholder: "Введите здесь. Вы можете использовать Markdown и HTML. Перетащите, чтобы вставить изображения.",

    Maximize: "Максимизация",
    ToNormal: "Вернуться к нормальному",
    TileHorizontally: "Плитка горизонтально",

    PreviewC: "Превью:",
    TitleExcl: " (название исключено)",
    ShowEditorAgain: "Показать редактор снова",
    Minimize: "Минимизировать",

    IPhoneKbdSpace_1: "(Это серое пространство зарезервировано",
    IPhoneKbdSpace_2: "для клавиатуры iPhone.)",

    PreviewInfo: "Здесь вы можете просмотреть, как будет выглядеть ваш пост.",
    CannotType: "Вы не можете здесь печатать.",

    LoadingDraftDots: "Загрузка любого черновика ...",
    DraftUnchanged: "Без изменений.",
    CannotSaveDraftC: "Не удается сохранить черновик:",
    DraftSaved: (nr: string | number) => `Черновик ${nr} сохранен.`,
    DraftDeleted: (nr: string | number) => `Черновик ${nr} удален.`,
    WillSaveDraft: (nr: string | number) => `Сохранит черновик ${nr} ...`,
    SavingDraft: (nr: string | number) => `Сохранение черновика ${nr} ...`,
    DeletingDraft: (nr: string | number) => `Удаление черновика ${nr} ...`,
  },


  // Select category dropdown

  scd: {
    SelCat: "Выберите категорию",
  },

  // Page type dropdown

  pt: {
    SelectTypeC: "Выберите тип темы:",
    DiscussionExpl: "Дискуссия о чем-то.",
    QuestionExpl: "Один ответ может быть помечен как принятый ответ.",
    ProblExpl: "Если что-то сломано или не работает. Может быть помечен как исправленный/решенный.",
    IdeaExpl: "Предложение. Может быть помечено как выполненное/выполненное.",
    ChatExpl: "Возможно, бесконечный разговор.",
    PrivChatExpl: "Видны только тем, кого пригласили присоединиться к чату.",

    CustomHtml: "Пользовательская HTML-страница",
    InfoPage: "Информационная страница",
    Code: "Код",
    EmbCmts: "Встроенные комментарии",
    About: "About",
    PrivChat: "Приватный чат",
    Form: "Форма",
  },


  // Join sub community dialog

  jscd: {
    NoMoreToJoin: "Нет больше сообществ, чтобы присоединиться.",
    SelCmty: "Выберите сообщество ...",
  },


  // Search dialogs and the search page.

  s: {
    TxtToFind: "Текст для поиска",
  },


  // No internet

  ni: {
    NoInet: "Подключение к Интернету отсутствует",
    PlzRefr: "Обновите страницу, чтобы увидеть последние изменения. (Было отключение)",
    RefrNow: "Обновить сейчас",
  },


  PostDeleted: (postNr: number) => `Пост, номер ${postNr}, был удален.`,
  NoSuchPost: (postNr: number) => `На этой странице нет поста, номер ${postNr}.`,
  NoPageHere: "Эта страница была удалена, или ее никогда не было, или вы не можете получить к ней доступ.",
  GoBackToLastPage: "Вернуться на последнюю страницу",

};
