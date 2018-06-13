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
  PastDay: "Últimas 24 horas",
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
    ExplIcons: "Explicar ícones...",
    IconExplanation: "Explicação do ícone:",
    ExplGenDisc: "Uma discussão geral.",
    ExplQuestion: "Uma pergunta sem resposta aceita.",
    ExplAnswer: "Uma pergunta sem resposta aceita.",
    ExplIdea: "Uma ideia / sugestão.",
    ExplProblem: "Um problema.",
    ExplPlanned: "Algo que estamos planejando fazer ou consertar.",
    ExplDone: "Algo que já foi concluído ou consertado.",
    ExplClosed: "Tópico fechado.",
    ExplPinned: "Tópico sempre listados primeiro (talvez somente em sua própria categoria).",

    PopularTopicsComma: "Tópicos populares, ",
    TopFirstAllTime: "Mostra os tópicos mais populares primeiro, em qualquer período.",
    TopFirstPastDay: "Mostra tópicos populares durante as últimas 24 horas.",

    CatHasBeenDeleted: "Esta categoria foi deletada",

    TopicsActiveFirst: "Tópicos, mais recentemente ativo primeiro",
    TopicsNewestFirst: "Tópicos, mais novo primeiro",

    CreatedOn: "Criado em ",
    LastReplyOn: "\nÚltima resposta em ",
    EditedOn: "\nEditado em ",

    createdTheTopic: "criado no tópico",
    frequentPoster: "membro frequente",
    mostRecentPoster: "membro mais recente",

    inC: "em: ",

    TitleFixed: "Consertado",
    TitleDone: "Concluído",
    TitleStarted: "Iniciamos",
    TitleStartedFixing: "Começamos a consertar",
    TitleUnsolved: "É um problema não resolvido",
    TitleIdea: "É uma ideia",
    TitlePlanningFix: "Planejamos consertar",
    TitlePlanningDo: "Planejamos fazer",
    TitleChat: "É um canal de chat",
    TitlePrivateChat: "É um canal privado de chat",
    TitlePrivateMessage: "Uma mensagem privada",
    TitleInfoPage: "Uma página de informação",
    TitleDiscussion: "Uma discussão",
    IsPinnedGlobally: "\nFoi fixado, por isso é listado primeiro.",
    IsPinnedInCat: "\Foi fixado nesta categoria, por isso é listado primeiro, nesta categoria.",
  },


  // Forum categories list

  fc: {
    RecentTopicsWaiting: "Tópicos recents (those waiting)",
    RecentTopicsInclDel: "Recent topics (including deleted)",
    RecentTopics: "Recent topics",
    _replies: " replies",
    _deleted: " (deleted)",
    _defCat: " (default category)",
  },


  // Watchbar (the sidebar to the left)

  wb: {
    AddCommunity: "Adicionar ...",
    RecentlyViewed: "Visualizada recentemente",
    JoinedChats: "Chats associados",
    ChatChannels: "Canais de chat",
    CreateChat: "Criar canal de chat",
    DirectMsgs: "Mensagens Diretas",

    // The click-topic dropdown menu:
    TopicActions: "Ações do tópico",
    ViewPeopleHere: "Visualizar pessoas aqui",
    ViewAddRemoveMembers: "Visualizar / adicionar / remover membros",
    ViewChatMembers: "Visualizar membros do chat",
    EditChat: "Editar título e propósito do chat",
    LeaveThisChat: "Desassociar-se deste chat",
    LeaveThisCommunity: "Desassociar-se desta comunidade",
    JoinThisCommunity: "Associar-se a esta comunidade",
  },


  // Contextbar (the sidebar to the right), code currently in sidebar.ts (not renamed yet)

  cb: {
    RecentComments: "Comentários recentes neste tópico: ",
    NoComments: "Nenhum comentário.",

    YourBookmarks: "Seus favoritos:",

    UsersOnline: "Usuários online:",
    UsersOnlineForum: "Usuários online neste fórum:",
    UsersInThisChat: "Usuários neste chat:",
    UsersInThisTopic: "Usuários neste tópico:",

    GettingStartedGuide: "Guia de Introdução",
    AdminGuide: "Guia do Administrador",
    Guide: "Guia",

    AddPeople: "Adicionar mais pessoas",

    thatsYou: "é você",
    YouAnd: "Você, e ",
    OnlyYou: "Só você, parece",
    NumStrangers: (numStrangers: number) => {
	  const people = numStrangers === 1 ? "pessoa" : "pessoas";
	  const loggedIn = numStrangers === 1 ? "logou" : "logaram";
      return `${numStrangers} ${people} que não se ${loggedIn}`;
    },

    RepliesToTheLeft: "As respostas à esquerda são ordenadas por ",
    bestFirst: "melhores primeiro.",
    ButBelow: "Mas abaixo ",
    insteadBy: " as mesmas respostas são ordenadas por ",
    newestFirst: "mais recentes primeiro.",

    SoIfLeave: "Então se você sair, e voltar aqui mais tarde, você vai encontrar abaixo ",
    allNewReplies: "todas as respostas mais recentes.",
    Click: "Clique",
    aReplyToReadIt: " em uma resposta abaixo para ler — porque só um trecho é exibido abaixo.",

    CloseShortcutS: "Fechar (atalho do teclado: S)",
  },


  // Discussion / non-chat page

  d: {
    ThisFormClosed_1: "Este formulário foi foi ",
    ThisFormClosed_2: "fechado; você não pode mais preenchê-lo e enviá-lo.",

    ThisTopicClosed_1: "Este tópico foi ",
    // ... "closed" ...
    ThisTopicClosed_2: ". Você ainda pode postar comentários, " +
          "mas isso não fará com que esse tópico seja alçado ao topo da lista dos últimos tópicos.",

    ThisQuestSloved_1: "isto é uma pergunta e foi ",
    ThisQuestSloved_2: "respondida.",

    ThisQuestWaiting_1: "Isto é uma ",
    ThisQuestWaiting_2: "pergunta, aguardando uma ",
    ThisQuestWaiting_3: "resposta.",

    ThisProblSolved_1: "Isto é um problema e foi ",
    ThisProblSolved_2: " resolvido.",

    ThisProblStarted_1: "Isto é um problema. Nós ",
    ThisProblStarted_2: " começamos a corrigir, mas ainda não foi ",
    ThisProblStarted_3: " concluído.",

    ThisProblPlanned_1: "Isto é um problema. Nós ",
	ThisProblPlanned_2: " planejamos consertá-lo, mas ainda não ",
    ThisProblPlanned_3: " começamos, ainda não está ",
    ThisProblPlanned_4: " conclúido.",

    ThisProblemNew_1: "Isto é um ",
    ThisProblemNew_2: " problema. Ainda não está ",
    ThisProblemNew_3: " resolvido.",

    ThisIdeaDone_1: "Isto foi ",
    ThisIdeaDone_2: " implementado.",

    ThisIdeaStarted_1: "Nós ",
    ThisIdeaStarted_2: " começamos a implementar. Mas ainda não está ",
    ThisIdeaStarted_3: " concluído.",

    ThisIdeaPlanned_1: "Nós ",
    ThisIdeaPlanned_2: " planejamos implementar. Mas ainda não ",
    ThisIdeaPlanned_3: " começamos, ainda não está ",
    ThisIdeaPlanned_4: " concluído.",

    ThisIdeaNew_1: "Isto é uma ",
    ThisIdeaNew_2: " ideia, ainda não ",
    ThisIdeaNew_3: " planejada, não ",
    ThisIdeaNew_4: " iniciada, não ",
    ThisIdeaNew_5: " concluída.",

    ThisPageDeleted: "Esta página foi deletada",
    CatDeldPageToo: "Categoria deletada; esta página foi deletada também",

    AboutCat: "Sobre a categoria:",

    PageDeleted: "(Página deletada)",
    TitlePendAppr: "(Titulo pendente de aprovação)",
    TextPendingApproval: "(Texto pendente de aprovação)",

    TooltipQuestClosedNoAnsw: "Esta questão foi fechada sem respostas aceitas.",
    TooltipTopicClosed: "Este tópico está fechado.",

    TooltipQuestSolved: "Isto é uma pergunta respondida",
    TooltipQuestUnsolved: "Isto é uma pergunta não respondida",

    TooltipProblFixed: "Isto foi consertado",
    TooltipDone: "Isto foi concluído",
    ClickStatusNew: "Clique para mudar o status para novo",

    TooltipFixing: "No momento estamos consertando isto",
    TooltipImplementing: "No momento estamos implementando isto",
    ClickStatusDone: "Clique para marcar como concluído",

    TooltipProblPlanned: "Estamos planejando consertar isto",
    TooltipIdeaPlanned: "Estamos planejando implementar isto",
    ClickStatusStarted: "Clique para marcar como iniciado",

    TooltipUnsProbl: "Isto é um problema não resolvido",
    TooltipIdea: "Isto é uma ideia",
    ClickStatusPlanned: "Clique para mudar o status para planejado",

    TooltipPersMsg: "Mensagem pessoal",
    TooltipChat: "# significa Canal de Chat",
    TooltipPrivChat: "Isto é um canal de chat privado",

    TooltipPinnedGlob: "\Fixado globalmente.",
    TooltipPinnedCat: "\nFixado nesta categoria.",

    SolvedClickView_1: "Resolvido no post #",
    SolvedClickView_2: ", clique para visualizar",

    AboveBestFirst: "Acima: Respostas, as melhores aparecem primeiro.",
    BelowCmtsEvents: "Abaixo: Comentários e eventos.",

    BottomCmtExpl_1: "Você está adicionando um comentário que vai ficar no final da página. " +
        "Ele não vai subir ao topo mesmo que obtenha votos.",
    BottomCmtExpl_2: "Isto é útil para mensagens de status, por exemplo para esclarecer por que você está fechando/reabrindo " +
        "um tópico. Ou para sugerir mudançås no post original.",
    BottomCmtExpl_3: "Em vez disso, para responder par alguém, clique em Responder.",

    AddComment: "Adicionar comentário",
    AddBottomComment: "Adicionar comentário no final",

    PostHiddenClickShow: "Post ocultado; clique para mostrar",
    ClickSeeMoreRepls: "Clique para mostrar mais respostas",
    ClickSeeMoreComments: "Clique para mostrar mais comentários",
    ClickSeeThisComment: "Clique para mostrar este comentário",
    clickToShow: "clique para mostrar",

    ManyDisagree: "Muitos discordam disso:",
    SomeDisagree: "Alguns discordam disso:",

    CmtPendAppr: "Comentário pendente de aprovação, postado ",
    CmtBelowPendAppr: (isYour) => (isYour ? "Seu" : "O") + " comentário abaixo está pendente de aprovação.",

    _and: " e",

    dashInReplyTo: "— em resposta a",
    InReplyTo: "Em resposta a",

    ClickViewEdits: "Clique para visualizar edições antigas",

    By: "Por ", // ... someones name
  },

  // Post actions

  pa: {
    ReplyToOp: "Responder ao Post Original",

    CloseOwnQuestionTooltip: "Feche esta pergunta se você não precisa mais de uma resposta.",
    CloseOthersQuestionTooltip: "Feche esta pergunta se você não precisa de uma resposta, por exemplo, se " +
        "é uma pergunta não-relacionada ou já respondida em outro tópico.",
    CloseToDoTooltip: "Feche esta tarefa se ela não precisar ser concluída ou consertada.",
    CloseTopicTooltip: "Feche este tópico se ele não precisa mais de consideração.",

    AcceptBtnExpl: "Aceitar isto como a resposta para a pergunta ou problema",
    SolutionQ: "Solução?",
    ClickUnaccept: "Clique para desafazer a aceitação desta resposta",
    PostAccepted: "Este post foi aceitado como resposta",

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


