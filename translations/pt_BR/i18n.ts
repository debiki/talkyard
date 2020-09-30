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

var t_pt_BR: TalkyardTranslations = t = {

  // A single or a few words, sorted alphabetically, to reuse everywhere.

  Active: "Ativo",
  Activity: "Atividade",
  Add: "Adicionar",
  AddingDots: "Adicionando ...",
  Admin: "Administrador",
  AdvSearch: "Advanced search",  // MISSING
  Away: "Ausente",
  Back: "Back",  // MISSING
  BlogN: "Blog",
  Bookmarks: "Favoritos",
  Cancel: "Cancelar",
  Categories: "Categorias",
  Category: "Categoria",
  ChangeV: "Change",   // MISSING
  Continue: "Continuar",
  ClickToShow: "Click to show",  // MISSING
  ChangeDots: "Modificar ...",
  ChatN: "Chat",
  Chatting: "Chatting",  // MISSING
  CheckYourEmail: "Check your email",  // MISSING
  Close: "Fechar",
  closed: "fechado",
  Created: "Criado",
  Delete: "Deletar",
  Deleted: "Deleted",  // MISSING
  DirectMessage: "Direct message",  // MISSING
  Discussion: "Discussão",
  discussion: "discussão",
  done: "done",  // MISSING
  EditV: "Editar",
  Editing: "Editing",  // MISSING
  EmailAddress: "Email",
  EmailAddresses: "Email addresses",  // MISSING
  EmailSentD: "Email sent.",  // MISSING
  Forum: "Fórum",
  GetNotifiedAbout: "Get notified about",  // MISSING
  GroupsC: "Groups:",  // MISSING
  Hide: "Ocultar",
  Home: "Home",    // MISSING
  Idea: "Ideia",
  Join: "Join",    // MISSING
  KbdShrtcsC: "Keyboard shortcuts: ",   // MISSING
  Loading: "Carregando...",
  LoadMore: "Mostrar mais ...",
  LogIn: "Logado",
  LoggedInAs: "Logado como ",
  LogOut: "Encerrar sessão",
  Maybe: "Maybe",  // MISSING
  Manage: "Manage",  // MISSING
  Members: "Members",  // MISSING
  MessageN: "Mensagem",
  MoreDots: "Mais...",
  Move: "Mover",
  Name: "Nomear",
  NameC: "Nome:",
  NewTopic: "New topic",  // MISSING
  NoCancel: "No, cancel",  // MISSING
  Notifications: "Notifications",  // MISSING
  NotImplemented: "(Não implementado)",
  NotYet: "Ainda não",
  NoTitle: "No title",  // MISSING
  NoTopics: "Nenhum tópico.",
  Okay: "Ok",
  OkayDots: "Ok ...",
  Online: "Online",
  onePerLine: "one per line",  // MISSING
  PreviewV: "Prever",
  Problem: "Problema",
  progressN: "progress",  // MISSING
  Question: "Pergunta",
  Recent: "Recente",
  Remove: "Remover",
  Reopen: "Reabrir",
  ReplyV: "Responder",
  Replying: "Replying",  // MISSING
  Replies: "Respostas",
  replies: "respostas",
  Save: "Salvar",
  SavingDots: "Salvando ...",
  SavedDot: "Salvo.",
  Search: "Search",  // MISSING
  SendMsg: "Enviar Mensagem",
  ShowPreview: "Show preview",  // MISSING
  SignUp: "Cadastrar-se",
  Solution: "Solução",
  started: "started",  // MISSING
  Summary: "Resumo",
  Submit: "Enviar",
  Tag: "Tag",  // MISSING
  Tags: "Tags",  // MISSING
  Tools: "Tools",  // MISSING
  Topics: "Tópicos",
  TopicTitle: "Topic title",  // MISSING
  TopicType: "Tipo do tópico",
  UploadingDots: "Fazendo upload...",
  Username: "Nome de usuário",
  Users: "Usuários",
  Welcome: "Bem-vindo",
  Wiki: "Wiki",
  Yes: "Yes",  // MISSING
  YesBye: "Yes, bye",  // MISSING
  YesDoThat: "Yes, do that",  // MISSING
  You: "You",  // MISSING
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

  // MISSING  5 letter fields below
  // Time ago letters.
  // English examples: "3d" in forum topic list means 3 days ago. "5h" is 5 hours.
  monthsLtr: "mon",  // months
  daysLtr: "d",      // days
  hoursLtr: "h",     // hours
  minsLtr: "m",      // minutes
  secsLtr: "s",      // seconds

  // MISSING  4  "N nnnn ago" fields below:
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

  inp: {   // MISSING  15 fields here:
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
    UnUnqShrt_3: ", único e curto",

    // Generic messages for all input fields:
    TooShort: (minLength: number) => `Should be at least ${minLength} characters`,
    TooLong: (maxLength: number) => `Too long. Should be at most ${maxLength} characters`,
  },


  // Notification levels.

  nl: {
    EveryPost: "Observando Tudo",   // MISSING renamed from "Watching All" to "Every Post"
    EveryPostInTopic: "You'll be notified of all new replies in this topic.",  // MISSING
    EveryPostInCat: "You'll be notified of all new topics and replies, in this category.",  // MISSING
    EveryPostInTopicsWithTag: "You'll be notified of new topics with this tag, and every post in those topics",  // MISSING
    EveryPostWholeSite: "You'll be notified of all new topics and replies, anywhere.",  // MISSING

    // One will be notified about the *first* post in a new topic, only. That is, the Original Post
    // (that's what the first post is called, in a discussion forum topic).
    NewTopics: "Observando o Primeiro",   // MISSING renamed "Watching First" to "New Topics"
    NewTopicsInCat: "You'll be notified of new topics in this category.",  // MISSING
    NewTopicsWithTag: "You'll be notified of new topics with this tag",  // MISSING
    NewTopicsWholeSite: "You'll be notified of new topics, anywhere.",  // MISSING

    Tracking: "Rastreando",

    Normal: "Normal",
    NormalDescr: "You'll be notified if someone talks to you, also indirectly, e.g. a " +   // MISSING
      "reply to a reply to you.",

    Hushed: "Hushed",  // MISSING
    HushedDescr: "You'll be notified only if someone talks directly to you.",  // MISSING

    Muted: "Silenciado",
    MutedTopic: "No notifications about this topic.",  // MISSING
  },


  // Forum intro text

  fi: {
    Edit: "Editar",
    Hide_1: "Ocultar",
    Hide_2: ", clique ",
    Hide_3: " para reabrir",
  },


  // Forum categories

  fcs: {
    All: "Todas", // "All (categories)", shorter than AllCats
  },


  // Forum buttons

  fb: {

    TopicList: "Lista de tópicos",

    // Select category dropdown

    from: "from",  // MISSING used like so:  "From <Category Name>" or "From All Categories"
    in: "in",      // MISSING used like so:  "in <Category Name>" or "in All Categories"
    AllCats: "Todas as categorias",

    // Topic sort order

    Active: "Ativo",
    ActiveDescr: "Mostra tópicos mais recentemente ativos primeiro",

    New: "Novo",
    NewDescr: "Mostra tópicos mais novos primeiro",

    Top: "Topo",
    TopDescr: "Mostra tópicos mais populares primeiro",

    // Topic filter dropdown

    AllTopics: "Todos os tópicos",

    ShowAllTopics: "Mostrar todos os tópicos",
    ShowAllTopicsDescr: "Não mostra tópicos deletados",

    WaitingTopics: "Waiting topics",          // MISSING
    OnlyWaitingDescr_1: "Mostra somente perguntas ",
    OnlyWaitingDescr_2: "aguardando ",
    OnlyWaitingDescr_3: "por uma solução, além de ideias e problemas ainda não tratados",

    YourTopics: "Your topics",       // MISSING
    AssignedToYou: "Assigned to you", // MISSING

    DeletedTopics: "Show deleted",   // MISSING
    ShowDeleted: "Mostrar deletados",
    ShowDeletedDescr: "Mostrar todos os tópicos, incluindo deletados",

    // Rightmost buttons

    ViewCategories: "View categories",  // MISSING
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

    // These are shown as mouse-hover tooltips, or mobile-phone-touch-tips, over the user
    // avatar icons, in the forum topic list.
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
    IsPinnedInCat: "\nFoi fixado nesta categoria, por isso é listado primeiro, nesta categoria.",
  },


  // Forum categories list

  fc: {
    RecentTopicsWaiting: "Tópicos recentes (os que estão aguardando)",
    RecentTopicsInclDel: "Tópicos recentes (incluindo deletados)",
    RecentTopics: "Tópicos recentes",
    _replies: " respostas",
    _deleted: " (deletado)",
    _defCat: " (categoria padrão)",
  },


  // Topbar

  // Shown at the top of the page. Includes login and signup buttons, or one's username menu.

  tb: {  // MISSING, all fields in this section:

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
    AddCommunity: "Adicionar ...",
    RecentlyViewed: "Visualizada recentemente",
    JoinedChats: "Chats associados",
    ChatChannels: "Canais de chat",
    CreateChat: "Criar canal de chat",
    DirectMsgs: "Mensagens Diretas",
    NoChats: "Nenhum",     // meaning: "No chat messages"
    NoDirMsgs: "Nenhuma",  // meaning: "No direct messages"

    // The click-topic dropdown menu:
    TopicActions: "Ações do tópico",
    ViewPeopleHere: "Visualizar pessoas aqui",
    ViewAddRemoveMembers: "Visualizar / adicionar / remover membros",
    ViewChatMembers: "Visualizar membros do chat",
    EditChat: "Editar propósito do chat",            // REVIEW
    //EditChat: "Editar título e propósito do chat", // Keep, in case adds back edit-title input
    LeaveThisChat: "Desassociar-se deste chat",
    LeaveThisCommunity: "Desassociar-se desta comunidade",
    JoinThisCommunity: "Associar-se a esta comunidade",
  },


  // Contextbar (the sidebar to the right)

  cb: {
    RecentComments: "Comentários recentes neste tópico:",
    NoComments: "Nenhum comentário.",

    YourBookmarks: "Seus favoritos:",

    UsersOnline: "Usuários online:",
    UsersOnlineForum: "Usuários online neste fórum:",
    UsersInThisChat: "Usuários neste chat:",
    UsersInThisTopic: "Usuários neste tópico:",

    GettingStartedGuide: "Guia de Introdução",
    AdminGuide: "Guia do Administrador",
    Guide: "Guia",

    // How to hide the sidebar.
    CloseShortcutS: "Fechar (atalho do teclado: S)",

    // ----- Online users list / Users in current topic

    AddPeople: "Adicionar mais pessoas",

    // Shown next to one's own username, in a list of users.
    thatsYou: "é você",

    // Info about which people are online.
    // Example, in English: "Online users: You, and 5 people who have not logged in"
    OnlyYou: "Só você, parece",
    YouAnd: "Você, e ",
    NumStrangers: (numStrangers: number) => {
      const people = numStrangers === 1 ? "pessoa" : "pessoas";
      const loggedIn = numStrangers === 1 ? "logou" : "logaram";
      return `${numStrangers} ${people} que não se ${loggedIn}`;
    },

    // ----- Recent comments list

    // This explains how the Recent tab in the sidebar works.

    RepliesToTheLeft: "As respostas à esquerda são ordenadas por ",
    bestFirst: "melhores primeiro.",
    ButBelow: "Mas abaixo ",
    insteadBy: " as mesmas respostas são ordenadas por ",
    newestFirst: "mais recentes primeiro.",

    SoIfLeave: "Então se você sair, e voltar aqui mais tarde, você vai encontrar abaixo ",
    allNewReplies: "todas as respostas mais recentes.",
    Click: "Clique",
    aReplyToReadIt: " em uma resposta abaixo para ler — porque só um trecho é exibido abaixo.",
  },


  // Change page dialog    MISSING
  cpd: {
    ClickToChange: "Click to change status",
    ClickToViewAnswer: "Click to view answer",
    ViewAnswer: "View answer",
    ChangeStatusC: "Change status to:",
    ChangeCatC: "Change category:",
    ChangeTopicTypeC: "Change topic type:",
  },


  // Page doing status, PageDoingStatus    MISSING
  pds: {
    aQuestion: "a question",
    hasAccptAns: "has an accepted answer",
    aProblem: "a problem",
    planToFix: "plan to fix",
    anIdea: "an idea",
    planToDo: "plan to do",
  },


  // Discussion / non-chat page

  d: {
    // These texts are split into parts 1,2 or 1,2,3 ec, because in between the texts,
    // icons are shown, to help people understand what those icons mean.

    ThisFormClosed_1: "Este formulário foi foi ",
    // A Topic-has-been-Closed icon shown here, between text parts 1 (just above) and 2 (below).
    ThisFormClosed_2: "fechado; você não pode mais preenchê-lo e enviá-lo.",

    ThisTopicClosed_1: "Este tópico foi ",
    // A Topic-has-been-Closed icon, + the text "closed", shown here.
    ThisTopicClosed_2: ". Você ainda pode postar comentários.",  // REVIEW removed "won't make ... bump ..."

    ThisPageDeleted: "Esta página foi deletada",
    CatDeldPageToo: "Categoria deletada; esta página foi deletada também",

    ThreadDeld: "Thread deleted",   // MISSING
    CmntDeld: "Comment deleted",    // MISSING
    PostDeld: "Post deleted",       // MISSING
    DiscDeld: "Discussion deleted", // MISSING
    PageDeld: "Página deletada",
    TitlePendAppr: "Titulo pendente de aprovação",
    TextPendingApproval: "Texto pendente de aprovação",

    TooltipQuestClosedNoAnsw: "Esta questão foi fechada sem respostas aceitas.",
    TooltipTopicClosed: "Este tópico está fechado.",

    TooltipQuestSolved: "Isto é uma pergunta respondida",
    TooltipQuestUnsolved: "Isto é uma pergunta não respondida",

    StatusDone: "Done",  // MISSING
    TooltipProblFixed: "Isto foi consertado",
    TooltipDone: "Isto foi concluído",

    StatusStarted: "Started",  // MISSING
    TooltipFixing: "No momento estamos consertando isto",
    TooltipImplementing: "No momento estamos implementando isto",

    StatusPlanned: "Planned",  // MISSING
    TooltipProblPlanned: "Estamos planejando consertar isto",
    TooltipIdeaPlanned: "Estamos planejando implementar isto",

    StatusNew: "New",  // MISSING
    StatusNewDtl: "New topic, under discussion",  // MISSING
    TooltipUnsProbl: "Isto é um problema não resolvido",
    TooltipIdea: "Isto é uma ideia",

    TooltipPersMsg: "Mensagem pessoal",
    TooltipChat: "# significa Canal de Chat",
    TooltipPrivChat: "Isto é um canal de chat privado",

    TooltipPinnedGlob: "\nFixado globalmente.",
    TooltipPinnedCat: "\nFixado nesta categoria.",

    SolvedClickView_1: "Resolvido no post #",
    SolvedClickView_2: ", clique para visualizar",

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

    repliesTo: "replies to",  // MISSING
    InReplyTo: "Em resposta a",
    YourReplyTo: "Your reply to ",  // MISSING
    YourChatMsg: "Your chat message: ",   // MISSING
    YourDraft: "Your draft",    // MISSING
    YourEdits: "Your edits: ",   // MISSING
    YourProgrNoteC: "Your progress note:",  // MISSING
    aProgrNote: "a progress note: ",  // MISSING

    ReplyingToC: "Replying to:",    // MISSING
    ScrollToPrevw_1: "Scroll to ",  // MISSING
    ScrollToPrevw_2: "preview",     // MISSING

    UnfinEdits: "Unfinished edits",  // MISSING
    ResumeEdting: "Resume editing",  // MISSING
    DelDraft: "Delete draft",   // MISSING

    ClickViewEdits: "Clique para visualizar edições antigas",

    By: "Por ", // ... someones name

    // Discussion ...
    aboutThisIdea: "about how and if to do this idea",  // MISSING
    aboutThisProbl: "about how and if to fix this",  // MISSING

    AddProgrNote: "Add progress note",  // MISSING
    // Progress ...
    withThisIdea: "with doing this idea",  // MISSING
    withThisProbl: "with handling this problem",  // MISSING
    withThis: "with doing this",  // MISSING
  },


  // Metabar

  // Shown between the original post and all replies.

  mb: {  // MISSING, the 5 texts in this section:
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
    CloseOwnQuestionTooltip: "Feche esta pergunta se você não precisa mais de uma resposta.",
    CloseOthersQuestionTooltip: "Feche esta pergunta se você não precisa de uma resposta, por exemplo, se " +
        "é uma pergunta não-relacionada ou já respondida em outro tópico.",
    CloseToDoTooltip: "Feche esta tarefa se ela não precisar ser concluída ou consertada.",
    CloseTopicTooltip: "Feche este tópico se ele não precisa mais de consideração.",

    AcceptBtnExpl: "Aceitar isto como a resposta para a pergunta ou problema",
    SolutionQ: "Solução?",
    ClickUnaccept: "Clique para desafazer a aceitação desta resposta",
    PostAccepted: "Este post foi aceitado como resposta",

    NumLikes: (num: number) => num === 1 ? "1 Curte" : num + " Curtem",
    NumDisagree: (num: number) => num === 1 ? "1 Discorda" : `${num} Discordam`,
    NumBury: (num: number) => num === 1 ? `1 Enterra` : `${num} Enterras`,
    NumUnwanted: (num: number) => num === 1 ? "1 Indesejado" : `${num} Indesejados`,

    MoreVotes: "Mais votos...",
    LikeThis: "Curtir isso",
    LinkToPost: "Link para este post",
    Report: "Denunciar",
    ReportThisPost: "Denunciar este post",
    Admin: "Administrador",
    DiscIx: "Discussions index",  // MISSING

    Disagree: "Discordar",
    DisagreeExpl: "Clique aqui para discordar deste post, ou para avisar outras pessoas sobre erros factuais.",
    Bury: "Enterrar",
    BuryExpl: "Clique aqui para posicionar outros posts antes deste post. Só o staff do fórum pode ver seu voto.",
    Unwanted: "Indesejado",
    UnwantedExpl: "Se você não quer este post neste site. Isso vai diminuir a confiança que eu tenho no autor do post" +
            "Só o staff do fórum pode ver seu voto.",

    AddTags: "Adicionar/remover marcadores",
    UnWikify: "Desfazer Wikificação",
    Wikify: "Wikificar",
    PinDeleteEtc: "Fixar / Deletar / Categoria ...",
  },


  // Share dialog

  sd: {
    Copied: "Copied.",                   // MISSING
    CtrlCToCopy: "Hit CTRL+C to copy.",  // MISSING
    ClickToCopy: "Click to copy link.",  // MISSING
  },


  // Chat

  c: {
    About_1: "Este é o canal de chat ",
    About_2: ", criado por ",
    ScrollUpViewComments: "Role para cima para ver comentários anteriores",
    Purpose: "Propósito:",
    edit: "editar",
    'delete': "deletar",
    MessageDeleted: "(Mensagem deletada)",
    JoinThisChat: "Associar-se a este chat",
    PostMessage: "Postar mensagem",
    AdvancedEditor: "Editor avançado",
    TypeHere: "Digite aqui. Você pode usar Markdown e HTML.",
  },


  // My Menu

  mm: {
    NeedsReview: "Precisa de revisão ",
    AdminHelp: "Ajuda do administrador ",
    StaffHelp: "Ajuda do staff ",
    DraftsEtc: "Drafts, bookmarks, tasks",  // MISSING
    MoreNotfs: "Ver mais notificações",    // MISSING changed from "View more..." to "...all.."
    DismNotfs: "Mark all as read",         // MISSING
    ViewProfile: "Visualizar seu perfil",  // MAYBE, I removed "/editar"
    ViewGroups: "View groups",  // MISSING
    LogOut: "Encerrar sessão",
    UnhideHelp: "Revelar mensagens de ajuda",
  },


  // Scroll buttons

  sb: {    // MISSING  all fields in this section
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


  // Select users dialog
  sud: {
    SelectUsers: "Select users",  // MISSING
    AddUsers: "Add users",  // MISSING
  },


  // About user dialog

  aud: {
    IsMod: "Is moderator.",                // MISSING
    IsAdm: "Is administrator.",            // MISSING
    IsDeld: "Is deactivated or deleted.",  // MISSING
    ThisIsGuest: "Este é um usuário convidado; na realidade, pode ser qualquer pessoa.",
    ViewInAdm: "View in Admin Area",       // MISSING
    ViewProfl: "View Profile",             // MISSING
    ViewComments: "Visualizar outros comentários",
    RmFromTpc: "Remove from topic",        // MISSING
    EmAdrUnkn: "Email address unknown — this guest won't be notified about replies.",  // MISSING
  },


  // User's profile page

  upp: {
    // ----- Links

    Preferences: "Preferências",
    Invites: "Convites",
    DraftsEtc: "Drafts etc",  // MISSING
    About: "Sobre",
    Privacy: "Privacidade",
    Account: "Conta",
    Interface: "Interface",  // MISSING

    // ----- Overview stats

    JoinedC: "Associados: ",
    PostsMadeC: "Posts feitos: ",
    LastPostC: "Último post: ",
    LastSeenC: "Visto por último em: ",
    TrustLevelC: "Nível de confiança: ",

    // ----- Action buttons

    // ----- Profile pic

    UploadPhoto: "Fazer upload de foto",
    ChangePhoto: "Mudar foto",
    ImgTooSmall: "Imagem pequena demais: deve ser >= 100 x 100",

    // ----- Activity

    OnlyStaffCanSee: "Only staff and trusted core members, can see this.",  // MISSING
    OnlyMbrsCanSee: "Only people who have been active members for a while can see this.",  // MISSING
    Nothing: "Nothing to show",  // MISSING
    Posts: "Posts",              // MISSING
    NoPosts: "No posts.",        // MISSING
    Topics: "Topics",            // MISSING
    NoTopics: "No topics.",      // MISSING

    // ----- User status

    UserBanned: "Este usuário foi banido",
    UserSuspended: (dateUtc: string) => `Este usuário foi suspenso até ${dateUtc} UTC`,
    ReasonC: "Motivo: ",

    DeactOrDeld: "Foi desativado ou deletado.",
    isGroup: " (um grupo)",
    isGuest: " — um usuário convidado, pode ser qualquer pessoa",
    isMod: " – moderador",
    isAdmin: " – administrador",
    you: "(você)",

    // ----- Notifications page

    NoNotfs: "Nenhuma notificação",
    NotfsToYouC: "Notificação para você:",
    NotfsToOtherC: (name: string) => `Notificação para ${name}:`,
    DefNotfsSiteWide: "Default notifications, site wide",  // MISSING
    // The "for" in:  "Default notifications, site wide, for (someone's name)".
    forWho: "for",  // MISSING

    // ----- Drafts Etc page

    NoDrafts: "No drafts",  // MISSING
    YourDraftsC: "Your drafts:",  // MISSING
    DraftsByC: (name: string) => `Drafts by ${name}:`,  // MISSING

    // ----- Invites page

    InvitesIntro: "Aqui você pode convidar pessoas para se associar a este site. ",
    InvitesListedBelow: "Convites que você já enviou são listados abaixo..",
    NoInvites: "Você não citou ninguém ainda.",

    InvitedEmail: "Email do convidado",
    WhoAccepted: "Membro que aceitou",
    InvAccepted: "Convite aceito",
    InvSent: "Convite enviado",
    JoinedAlready: "Joined already",  // MISSING

    SendAnInv: "Enviar um Convite",
    SendInv: "Enviar Convite",
    SendInvExpl:
        "Vamos enviar um email curto para seu amigo, e a pessoa deve então clicar em um link " +
        "para se associar imediatamente, sem necessidade de login. " +
        "A pessoa vai se tornar um membro comum, não um moderador ou administrador.",
    //EnterEmail: "Digite o email",
    InvDone: "Concluído. Enviando um email para a pessoa.",
    // MISSING x 9:
    NoOneToInv: "No one to invite.",
    InvNotfLater: "I'll notify you later, when I've invited them.",
    AlreadyInvSendAgainQ: "These have been invited already — maybe you'd like to invite them again?",
    InvErr_1: "These resulted in ",
    InvErr_2: "errors",
    InvErr_3: ":",
    TheseJoinedAlrdyC: "These have joined already, so I didn't invite them:",
    ResendInvsQ: "Re-send invitations to these people? They have been invited already.",
    InvAgain: "Invite again",

    // ----- Preferences, About

    AboutYou: "Sobre você",
    WebLink: "Qualquer site ou página sua.",

    NotShownCannotChange: "Não mostrado publicamente. Não pode ser mudado.",

    // The full name or alias:
    NameOpt: "Nome (opcional)",

    NotShown: "Não mostrado publicamente.",

    // The username:
    MayChangeFewTimes: "Você só pode mudá-lo algumas vezes.",
    notSpecified: "(não especificado)",
    ChangeUsername_1: "Você só pode mudar seu nome de usuário algumas vezes.",
    ChangeUsername_2: "Mudá-lo frequentemente pode deixar outras pessoas confusas — " +
        "eles não vão saber como @mencionar você.",

    NotfAboutAll: "Seja notificado de qualquer novo post (exceto se você silenciar o tópico ou categoria)",
    NotfAboutNewTopics: "Be notified about new topics (unless you mute the category)",  // MISSING

    ActivitySummaryEmails: "Emails com resumo de atividades",

    EmailSummariesToGroup:
        "Quando membros deste grupo não fizerem uma visita por aqui, então, por padrão, envie email para eles " +
        "com resumos de tópicos populares e outras coisas.",
    EmailSummariesToMe:
        "Quando não fizer uma visita por aqui, me envie email com " +
        "resumos de tópicos populares e outras coisas.",

    AlsoIfTheyVisit: "Envie emails para eles também se eles fizerem visitas por aqui regularmente.",
    AlsoIfIVisit: "Envie emails para mim também se eu fizer visitas por aqui regularmente.",

    HowOftenWeSend: "Com que frequência devemos enviar estes emails?",
    HowOftenYouWant: "Com que frequência você quer receber estes emails?",

    // ----- Preferences, Privacy

    HideActivityStrangers_1: "Ocultar sua atividade recente para estranhos e membros novos?",
    HideActivityStrangers_2: "(Mas não para aqueles que não foram membros ativos por um tempo.)",
    HideActivityAll_1: "Ocultar sua atividade recente para todo mundo?",
    HideActivityAll_2: "(Exceto para staff e membros do núcleo e confiáveis.)",

    // ----- Preferences, Account

    // About email address:
    EmailAddresses: "Endereços de email",
    PrimaryDot: "Primário. ",
    VerifiedDot: "Verificado. ",
    NotVerifiedDot: "Não verificado. ",  // was [google-translate]
    ForLoginWithDot: (provider: string) => `Para login com ${provider}. `,
    MakePrimary: "Tornar Primário",
    AddEmail: "Adicione endereço de email",
    TypeNewEmailC: "Digite um novo endereço de email:",
    MaxEmailsInfo: (numMax: number) => `(Você não pode adicionar mais do que ${numMax} endereços.)`,
    EmailAdded_1: "Adicionado. Acabamos de enviar um email de verificação — ",
    EmailAdded_2: "cheque sua caixa de entrada de email.",
    SendVerifEmail: "Enviar email de verificação",  // [google-translate]

    EmailStatusExpl:
        "('Primário' significa que você pode fazer login usando este endereço, e que nós enviamos notificações para ele. " +
        "'Verificado' significa que você clicou no link de verificação em um email de verificação.)",

    // Password:     // MISSING x 4
    ChangePwdQ: "Change password?",
    CreatePwdQ: "Create password?",
    WillGetPwdRstEml: "You'll get a reset password email.",
    // This is the "None" in:  "Password: None"
    PwdNone: "None",

    // Logins:
    LoginMethods: "Métodos de login",
    commaAs: ", como: ",

    // One's data:
    YourContent: "Seu conteúdo",
    DownloadPosts: "Fazer download de posts",
    DownloadPostsHelp: "Cria um arquivo JSON com uma cópia de tópicos e comentários que você postou.",
    DownloadPersData: "Fazer download de dados pessoais",
    DownloadPersDataHelp: "Cria um arquivo JSON com uma cópia dos seus dados pessoais, por exemplo seu nome, " +
        "(se você especificou um nome) e endereço de email.",


    // Delete account:
    DangerZone: "Zona de perigo",
    DeleteAccount: "Deletar conta",
    DeleteYourAccountQ:
        "Deletar sua conta? Vamos remover seu nome, esquecer seu endereço de email, senha e " +
        "quaisquer identidades online (como o login do Facebook ou do Twitter). " +
        "Você não vai poder mais fazer login novamente. Esta operação não pode ser desfeita.",
    DeleteUserQ:
        "Deletar este usuário? Vamos remover o nome, esquecer o endereço de email, senha e " +
        "quaisquer identidades online (como o login do Facebook ou do Twitter). " +
        "Este usuário não vai poder mais fazer login novamente. Esta operação não pode ser desfeita.",
    YesDelete: "Sim, deletar",
  },


  // Group profile page   MISSING
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
    CreateUser: "Criar Usuário",
    CreateAccount: "Criar Conta",
    EmailC: "Email:",
    keptPriv: "será mantido privado",
    forNotfsKeptPriv: "para notificações de resposta, mantido privado",  // MAYBE I used Google Translate
    EmailVerifBy_1: "Seu email foi verificado por ",
    EmailVerifBy_2: ".",
    UsernameC: "Nome de usuário:",
    FullNameC: "Nome completo:",
    optName: "opcional",

    OrCreateAcct_1: "Ou ",
    OrCreateAcct_2: "crie uma conta",
    OrCreateAcct_3: " com ",
    OrCreateAcct_4: "@nomedeusuario",
    OrCreateAcct_5: " & senha",

    DoneLoggedIn: "Conta criada. Você está logado.",  // COULD say if verif email sent too?
    AlmostDone:
        "Quase concluído! VOcê só precisa confirmar seu endereço de email. Enviamos " +
        "um email para você. Por favor, clique no link no email para ativar " +
        "sua conta. Você pode fechar esta página.",
  },


  // Accept terms and privacy policy?

  terms: {
    TermsAndPrivacy: "Termos e Privacidade",

    Accept_1: "Você aceita nossos ",
    TermsOfService: "Termos de Serviço",
    TermsOfUse: "Termos de Uso",
    Accept_2: " e ",
    PrivPol: "Política de Privacidade",
    Accept_3_User: "?",
    Accept_3_Owner: " para dono de sites?",  // (see just below)

    // About "for site owners?" above:
    // That's if someone creates his/her own community, via this software provided as
    // Software-as-a-Service hosting. Then, there is / will-be a bit different
    // Terms-of-Service to agree with, since being a community maintainer/owner, is different
    // (more responsibility) than just signing up to post comments.

    YesAccept: "Sim eu acieto",
  },


  // Password input

  pwd: {
    PasswordC: "Senha:",
    StrengthC: "Força: ",
    FairlyWeak: "Bem fraca.",
    toShort: "muit curta",
    TooShort: (minLength: number) => `Muito curta. Tem que ter pelo menos ${minLength} caracteres`,
    PlzInclDigit: "Por favor, inclua um dígito ou caractere especial",
    TooWeak123abc: "Muito fraca. Não use senhas como '12345' ou 'abcde'.",
    AvoidInclC: "Evite incluir (partes de) seu nome ou email na senha:",
  },


  // Login dialog

  ld: {
    NotFoundOrPrivate: "Página não encontrada, ou Acesso Negado.",

    // This is if you're admin, and click the Impersonate button to become someone else
    // (maybe to troubleshoot problems with his/her account s/he has asked for help about),
    // and then you, being that other user, somehow happen to open a login dialog
    // (maybe because of navigating to a different part of the site that the user being
    // impersonated cannot access) — then, that error message is shown: You're not allowed
    // to login as *someone else* to access that part of the community, until you've first
    // stopped impersonating the first user. (Otherwise, everything gets too complicated.)
    IsImpersonating: "Vocês está personificando alguém, que pode não ter acesso a todas as partes " +
        "deste site.",

    IfYouThinkExistsThen: "Se você acha que a página existe, faça login como alguém que tenha acesso a ela. ",
    LoggedInAlready: "(Você já está logado, mas talvez esta é a conta errada?) ",
    ElseGoToHome_1: "Como alternativa, você pode ",
    ElseGoToHome_2: "ir à página inicial.",

    CreateAcconut: "Criar conta",
    ContinueWithDots: "Continue com ...",  // MAYBE
    SignUp: "Cadastrar-se",
    LogIn: "Fazer login",
    LogInWithPwd: "Login com Senha",
    CreateAdmAcct: "Criar conta de administrador:",
    AuthRequired: "Autenticação obrigatória para acessar este site",
    LogInToLike: "Faça login para Curtir este post",
    LogInToSubmit: "Faça login para enviar",
    LogInToComment: "Faça login para escrever um comentário",
    LogInToCreateTopic: "Faça login para criar um tópico",

    AlreadyHaveAcctQ: "Já tem uma conta? ",
    LogInInstead_1: "",
    LogInInstead_2: "Fazer login",   // "Log in" (this is a button)
    LogInInstead_3: " em vez disso", // "instead"

    NewUserQ: "Novo usuário? ",
    SignUpInstead_1: "",
    SignUpInstead_2: "Cadastre-se",
    SignUpInstead_3: " em vez disso",

    OrCreateAcctHere: "Ou crei uma conta:",
    OrTypeName: "Ou digite seu nome:",
    OrLogIn: "Ou faça login:", // was: "Ou preencha:"" = "fill in".  MAYBE
    YourNameQ: "Seu nome?",  // MAYBE

    BadCreds: "Nome de usuário ou senha incorretos",

    UsernameOrEmailC: "Nome de usuário ou email:",
    PasswordC: "Senha:",
    ForgotPwd: "Esqueceu sua senha?",

    NoPwd: "You have not yet chosen a password.",  // MISSING
    CreatePwd: "Create password",                  // MISSING
  },


  // Flag dialog

  fd: {
    PleaseTellConcerned: "Por favor informe o que perturba você.",
    ThanksHaveReported: "Obrigado. Você denunciou isto. O staff do fórum vai examinar.",
    ReportComment: "Reportar Comentário",
    // Different reasons one can choose among when reporting a comment:
    OptPersonalData: "Este post contém dados pessoais, por exemplo o nome real de alguém.",
    OptOffensive: "Este post contém conteúdo ofensivo ou abusivo.",
    OptSpam: "Este post é uma propaganda indesejada.",
    OptOther: "Notificar staff sobre este post por uma outra razão.",
  },


  // Help message dialog   // MISSING the 2 fields below:
  help: {
    YouCanShowAgain_1: "You can show help messages again, if you are logged in, by " +
        "clicking your name and then ",
    YouCanShowAgain_2: "Unhide help messages",
  },


  // Editor

  e: {
    SimilarTopicsC: "Similar topics:",  // MISSING

    //WritingSomethingWarning: "Você estava escrevendo alguma coisa?",
    UploadMaxOneFile: "Desculpe, mas atualmente você só pode fazer upoad de apenas um arquivo por vez",
    PleaseFinishPost: "Por favor termine primeiro de escrever seu post",
    PleaseFinishChatMsg: "Por favor termine primeiro de escrever sua mensagem de chat",
    PleaseFinishMsg: "Por favor termine primeiro de escrever sua mensagem",
    PleaseSaveEdits: "Por favor salve primeiro suas edições atuais",
    PleaseSaveOrCancel: "Por favor salve ou cancele seu seu novo tópico",
    CanContinueEditing: "Você pode continuar editando seu texto, se você abrir o editor novamente.",
        //"(Mas o texto atual vai ser perdido se você for embora desta página.)",
    PleaseDontDeleteAll: "Por favor, não delete todo o texto. Escreva algo.",
    PleaseWriteSth: "Por favor escreva algo.",
    PleaseWriteTitle: "Por favor, escreva um título do tópico.",
    PleaseWriteMsgTitle: "Por favor escreva o título da mensagem.",
    PleaseWriteMsg: "Por favor escreva uma mensagem.",

    exBold: "negrito",
    exEmph: "itálico",
    exPre: "preformatado",
    exQuoted: "citação",
    ExHeading: "Cabeçalho",

    TitlePlaceholder: "Digite um título — do que se trata, em uma frase curta?",

    EditPost_1: "Editar ",
    EditPost_2: "post ",

    TypeChatMsg: "Digite uma mensagem de chat:",
    YourMsg: "Sua mensagem:",
    CreateTopic: "Criar novo tópico",
    CreateCustomHtml: "Criar uma página HTML personalizada (adicione seu próprio título em <h1>)",
    CreateInfoPage: "Criar uma página de informação",
    CreateCode: "Criar uma página de código fonte",
    AskQuestion: "Fazer uma pergunta",
    ReportProblem: "Reportar um problema",
    SuggestIdea: "Sugerir uma ideia",
    NewChat: "Novo título e propósito do canal de chat",
    NewPrivChat: "Novo título e propósito do canal de chat privado",
    AppendComment: "Adicionar um comentário ao fim da página:",

    ReplyTo: "Responder ao ",
    ReplyTo_theOrigPost: "Post Original",
    ReplyTo_post: "post ",
    AddCommentC: "Add a comment:",   // MISSING

    PleaseSelectPosts: "Por favor selecione um ou mais posts para responder.",

    Save: "Salvar",
    edits: "edições",

    PostReply: "Postar resposta",

    Post: "Postar",
    comment: "comentário",
    question: "pergunta",

    PostMessage: "Postar mensagem",
    SimpleEditor: "Editor simples",

    Send: "Enviar",
    message: "mensagem",

    Create: "Criar",
    page: "página",
    chat: "chat",
    idea: "ideia",
    topic: "tópico",

    Submit: "Enviar",
    problem: "problema",

    ViewOldEdits: "Visualizar edições anteriores",

    UploadBtnTooltip: "Fazer upload de arquivo ou imagem",
    BoldBtnTooltip: "Tornar texto negrito",
    EmBtnTooltip: "Tornar texto itálico",
    QuoteBtnTooltip: "Citação",
    PreBtnTooltip: "Texto pré-formatado",
    HeadingBtnTooltip: "Cabeçalho",

    TypeHerePlaceholder: "Digite aqui. Você pode usar Markdown e HTML. Arraste e solte para colar imagens.",

    Maximize: "Maximizar",
    ToNormal: "De volta ao normal",
    TileHorizontally: "Dispor horizontalmente",

    PreviewC: "Pré-visualização:",
    TitleExcl: " (título excluído)",
    ShowEditorAgain: "Mostrar editor novamente",
    Minimize: "Minimizar",

    IPhoneKbdSpace_1: "(Este espaço cinza está reservado",
    IPhoneKbdSpace_2: "para o teclado do iPhone.)",

    PreviewInfo: "Aqui você pode pré-visualizar como seu post vai ficar.",
    CannotType: "Você não pode digitar aqui.",

    LoadingDraftDots: "Loading any draft...",  // MISSING
    DraftUnchanged: "Unchanged.",     // MISSING
    CannotSaveDraftC: "Cannot save draft:",     // MISSING
    DraftSavedBrwsr: "Draft saved, in browser.",   // MISSING
    DraftSaved: (nr: string | number) => `Draft ${nr} saved.`,     // MISSING
    DraftDeleted: (nr: string | number) => `Draft ${nr} deleted.`,     // MISSING
    WillSaveDraft: (nr: string | number) => `Will save draft ${nr} ...`,     // MISSING
    SavingDraft: (nr: string | number) => `Saving draft ${nr} ...`,     // MISSING
    DeletingDraft: (nr: string | number) => `Deleting draft ${nr} ...`,     // MISSING
  },


  // Select category dropdown

  scd: {
    SelCat: "Select category",  // MISSING
  },


  // Page type dropdown

  pt: {
    SelectTypeC: "Selecionar tipo de tópico:",
    DiscussionExpl: "Uma discussão sobre algo.",
    QuestionExpl: "Uma resposta pode ser marcada como a resposta aceita.",
    ProblExpl: "Se algo está quebrado ou não funciona. Pode ser marcado como consertado/resolvido.",
    IdeaExpl: "Uma sugestão. Pode ser marcado como concluído/implementado.",
    ChatExpl: "Uma conversação provavelmente sem fim.",
    PrivChatExpl: "Só visível para pessoas convidadas a se associar ao chat.",

    CustomHtml: "Página HTML personalizada",
    InfoPage: "Página de informação",
    Code: "Código",
    EmbCmts: "Comentários incorporados",
    About: "Sobre",
    PrivChat: "Chat Privado",
    Form: "Formulário",
  },


  // Join sub community dialog

  jscd: {
    NoMoreToJoin: "No more communities to join.",  // MISSING
    SelCmty: "Select community ...",               // MISSING
  },


  // Search dialogs and the search page.

  s: {
    TxtToFind: "Text to search for",  // MISSING
  },


  // No internet    // MISSING x 3

  ni: {
    NoInet: "No internet connection",
    PlzRefr: "Refresh page to see any latest changes. (There was a disconnection)",
    RefrNow: "Refresh now",
  },


  // MISSING:
  PostDeleted: (postNr: number) => `That post, nr ${postNr}, has been deleted.`,
  NoSuchPost: (postNr: number) => `There's no post nr ${postNr} on this page.`,
  NoPageHere: "This page has been deleted, or it never existed, or you may not access it.",
  GoBackToLastPage: "Go back to last page",

};


