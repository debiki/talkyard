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

var t_en: TalkyardTranslations = t = {

  // A single or a few words, sorted alphabetically, to reuse everywhere.

  Active: "Ativo",
  Activity: "Atividade",
  Add: "Adicionar",
  AddingDots: "Adicionando ...",
  Admin: "Administrador",
  Away: "Ausente",
  BlogN: "Blog",
  Bookmarks: "Favoritos",
  Cancel: "Cancelar",
  Categories: "Categorias",
  Category: "Categoria",
  Continue: "Continuar",
  ChangeDots: "Modificar ...",
  ChatN: "Chat",
  Close: "Fechar",
  closed: "fechado",
  Created: "Criado",
  Delete: "Deletar",
  Discussion: "Discussão",
  EditV: "Editar",
  EmailAddress: "Email",
  Forum: "Fórum",
  Hide: "Ocultar",
  Idea: "Ideia",
  Loading: "Carregando...",
  LoadMore: "Mostrar mais ...",
  LogIn: "Logado",
  LoggedInAs: "Logado como ",
  LogOut: "Encerrar sessão",
  MessageN: "Mensagem",
  MoreDots: "Mais...",
  Move: "Mover",
  Name: "Nomear",
  NameC: "Nome:",
  None: "Nenhum",
  NotImplemented: "(Não implementado)",
  NotYet: "Ainda não",
  NoTopics: "Nenhum tópico.",
  Okay: "Ok",
  OkayDots: "Ok ...",
  Online: "Online",
  PreviewV: "Prever",
  Problem: "Problema",
  Question: "Pergunta",
  Recent: "Recente",
  Remove: "Remover",
  Reopen: "Reabrir",
  ReplyV: "Responder",
  Replies: "Respostas",
  Save: "Salvar",
  SavingDots: "Salvando ...",
  SavedDot: "Salvo.",
  SendMsg: "Enviar Mensagem",
  SignUp: "Cadastrar-se",
  Solution: "Solução",
  Summary: "Resumo",
  Submit: "Enviar",
  Topics: "Tópicos",
  TopicType: "Tipo do tópico",
  UploadingDots: "Fazendo upload...",
  Username: "Nome de usuário",
  Users: "Usuários",
  Welcome: "Bem-vindo",
  Wiki: "Wiki",
  you: "você",

  // Trust levels.
  Guest:  "Convidado",
  NewMember: "Novo membro",
  BasicMember: "Membro básico",
  FullMember: "Membro completo",
  TrustedMember: "Membro confiável",
  RegularMember: "Membro comum",
  CoreMember: "Membro do núcleo",

  // Periods.
  PastDay: "Último dia",
  PastWeek: "Semana Passada",
  PastMonth: "Mês Passado",
  PastQuarter: "Trimestre Passado",
  PastYear: "Ano Passado",
  AllTime: "Todos os Períodos",


  // Notification levels.
  nl: {
    WatchingAll: "Observando Tudo",
    WatchingFirst: "Observando o Primeiro",
    Tracking: "Rastreando",
    Normal: "Normal",
    Muted: "Mudo",
  },


  // Forum intro text

  fi: {
    Edit: "Editar",
    Hide_1: "Ocultar",
    Hide_2: ", clique ",
    Hide_3: " para reabrir",
  },


  // Forum buttons

  fb: {

    TopicList: "Lista de tópicos",

    // Select category dropdown

    AllCats: "Todas as categorias",

    // Topic sort order

    Active: "Ativo",
    ActiveTopics: "Tópicos ativos",
    ActiveDescr: "Mostra tópicos mais recentemente ativos primeiro",

    New: "Novo",
    NewTopics: "Novos tópicos",
    NewDescr: "Mostra tópicos mais novos primeiro",

    Top: "Topo",
    TopTopics: "Tópicos populares",
    TopDescr: "Mostra tópicos mais populares primeiro",

    // Topic filter dropdown

    AllTopics: "Todos os tópicos",

    ShowAllTopics: "Mostrar todos os tópicos",
    ShowAllTopicsDescr: "Não mostra tópicos deletados",

    OnlyWaiting: "Somente aguardando",
    OnlyWaitingDescr_1: "Mostra somente perguntas ",
    OnlyWaitingDescr_2: "aguardando ",
    OnlyWaitingDescr_3: "por uma solução, além de ideias e problemas ainda não tratados",

    ShowDeleted: "Mostrar deletados",
    ShowDeletedDescr: "Mostrar todos os tópicos, incluindo deletados",

    // Rightmost buttons

    EditCat: "Editar Categoria",
    CreateCat: "Criar Categoria",
    CreateTopic: "Criar Tópico",
    PostIdea: "Postar uma Ideia",
    AskQuestion: "Fazer uma Pergunta",
    ReportProblem: "Reportar um Problema",
    CreateMindMap: "Criar Mapa Menal",
    CreatePage: "Criar Página",

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
    LeaveThisChat: "Leave this chat",
    LeaveThisCommunity: "Leave this community",
    JoinThisCommunity: "Join this community",
  },


  // Contextbar (the sidebar to the right), code currently in sidebar.ts (not renamed yet)

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


  // About user dialog

  aud: {
    ViewComments: "View other comments",
    ThisIsGuest: "This is a guest user, could in fact be anyone.",
  },


  // User's profile page

  upp: {
    // ----- Links

    Notifications: "Notifications",
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
    EnterEmail: "Enter email",
    InvDone: "Done. I'll send him/her an email.",
    InvErrJoinedAlready: "He or she has joined this site already",
    InvErrYouInvAlready: "You have invited him or her already",

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
    ForLoginWithDot: (provider: string) => `For login with ${provider}. `,
    MakePrimary: "Make Primary",
    AddEmail: "Add email address",
    TypeNewEmailC: "Type a new email address:",
    MaxEmailsInfo: (numMax: number) => `(You cannot add more than ${numMax} addresses.)`,
    EmailAdded_1: "Added. We've sent you a verification email — ",
    EmailAdded_2: "check your email inbox.",

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
    Accept_3_Owner: " for site owners?",

    YesAccept: "Yes I accept",
  },


  // Password input

  pwd: {
    PasswordC: "Password:",
    StrengthC: "Strength: ",
    FairlyWeak: "Fairly weak.",
    toShort: "too short",
    TooShortMin10: "Too short. Should be at least 10 characters",
    PlzInclDigit: "Please include a digit or special character",
    TooWeak123abc: "Too weak. Don't use passwords like '12345' or 'abcde'.",
    AvoidInclC: "Avoid including (parts of) your name or email in the password:",
  },


  // Login dialog

  ld: {
    NotFoundOrPrivate: "Page not found, or Access Denied.",
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


