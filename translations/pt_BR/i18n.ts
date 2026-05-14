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
  AdvSearch: "Pesquisa avançada",
  Away: "Ausente",
  Back: "Voltar",
  BlogN: "Blog",
  Bookmarks: "Favoritos",
  Cancel: "Cancelar",
  Categories: "Categorias",
  Category: "Categoria",
  ChangeV: "Alterar",
  Continue: "Continuar",
  ClickToShow: "Clique para mostrar",
  ChangeDots: "Modificar ...",
  ChatN: "Chat",
  Chatting: "Chat",
  CheckYourEmail: "Verifique seu email",
  Close: "Fechar",
  closed: "fechado",
  Created: "Criado",
  Delete: "Deletar",
  Deleted: "Excluído",
  DirectMessage: "Mensagem direta",
  Discussion: "Discussão",
  discussion: "discussão",
  done: "concluído",
  EditV: "Editar",
  Editing: "Editando",
  EmailAddress: "Email",
  EmailAddresses: "Endereços de email",
  EmailSentD: "Email enviado.",
  Forum: "Fórum",
  GetNotifiedAbout: "Receber notificações sobre",
  GroupsC: "Grupos:",
  Hide: "Ocultar",
  Home: "Início",
  Idea: "Ideia",
  Join: "Participar",
  KbdShrtcsC: "Atalhos de teclado: ",
  Loading: "Carregando...",
  LoadMore: "Mostrar mais ...",
  LogIn: "Entrar",
  LoggedInAs: "Logado como ",
  LogOut: "Sair",
  Maybe: "Talvez",
  Manage: "Gerenciar",
  Members: "Membros",
  MessageN: "Mensagem",
  MoreDots: "Mais...",
  Move: "Mover",
  Name: "Nome",
  NameC: "Nome:",
  NewTopic: "Novo tópico",
  NoCancel: "Não, cancelar",
  Notifications: "Notificações",
  NotImplemented: "(Não implementado)",
  NotYet: "Ainda não",
  NoTitle: "Sem título",
  NoTopics: "Nenhum tópico.",
  Okay: "Ok",
  OkayDots: "Ok ...",
  Online: "Online",
  onePerLine: "um por linha",
  PreviewV: "Prever",
  Problem: "Problema",
  progressN: "progresso",
  Question: "Pergunta",
  Recent: "Recente",
  Remove: "Remover",
  Reopen: "Reabrir",
  ReplyV: "Responder",
  Replying: "Respondendo",
  Replies: "Respostas",
  replies: "respostas",
  Save: "Salvar",
  SavingDots: "Salvando ...",
  SavedDot: "Salvo.",
  Search: "Pesquisar",
  SendMsg: "Enviar Mensagem",
  ShowPreview: "Mostrar visualização",
  SignUp: "Cadastrar-se",
  Solution: "Solução",
  started: "iniciado",
  Summary: "Resumo",
  Submit: "Enviar",
  Tag: "Tag",
  Tags: "Tags",
  Tools: "Ferramentas",
  Topics: "Tópicos",
  TopicTitle: "Título do tópico",
  TopicType: "Tipo do tópico",
  UploadingDots: "Fazendo upload...",
  Username: "Nome de usuário",
  Users: "Usuários",
  Welcome: "Bem-vindo",
  Wiki: "Wiki",
  Yes: "Sim",
  YesBye: "Sim, tchau",
  YesDoThat: "Sim, faça isso",
  You: "Você",
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

  // Time ago letters.
  // English examples: "3d" in forum topic list means 3 days ago. "5h" is 5 hours.
  monthsLtr: "mes",  // months
  daysLtr: "d",      // days
  hoursLtr: "h",     // hours
  minsLtr: "m",      // minutes
  secsLtr: "s",      // seconds

  // Time ago, long text versions.
  daysAgo: (numDays: number) =>
    numDays === 1 ? "há 1 dia" : `há ${numDays} dias`,

  hoursAgo: (numHours: number) =>
    numHours === 1 ? "há 1 hora" : `há ${numHours} horas`,

  minutesAgo: (numMins: number) =>
    numMins === 1 ? "há 1 minuto" : `há ${numMins} minutos`,

  secondsAgo: (numSecs: number) =>
    numSecs === 1 ? "há 1 segundo" : `há ${numSecs} segundos`,


  // Input fields, e.g. email, name etc.

  inp: {
    // Email address input field:
    EmReq: "Email obrigatório",
    NoSpcs: "Sem espaços, por favor",
    InvldAddr: "Não é um endereço de email válido",
    NoBadChrs: "Sem caracteres estranhos, por favor",

    // Full name input field:
    NotOnlSpcs: "Não apenas espaços, por favor",
    NoAt: "Sem @, por favor",

    // Username input field:
    NoDash: "Sem traços (-), por favor",
    DontInclAt: "Não inclua o @",
    StartEndLtrDgt: "Comece e termine com uma letra ou um dígito",
    OnlLtrNumEtc: "Apenas letras (a-z, A-Z) e números, e _ (sublinhado)",
    // This shown just below the username input:
    UnUnqShrt_1: "Seu ",
    UnUnqShrt_2: "@nome_de_usuário",
    UnUnqShrt_3: ", único e curto",

    // Generic messages for all input fields:
    TooShort: (minLength: number) => `Deve ter pelo menos ${minLength} caracteres`,
    TooLong: (maxLength: number) => `Muito longo. Deve ter no máximo ${maxLength} caracteres`,
  },


  // Notification levels.

  nl: {
    EveryPost: "Todas as publicações",
    EveryPostInTopic: "Você será notificado sobre todas as novas respostas neste tópico.",
    EveryPostInCat: "Você será notificado sobre todos os novos tópicos e respostas nesta categoria.",
    EveryPostInTopicsWithTag: "Você será notificado sobre novos tópicos com esta tag e todas as publicações nesses tópicos",
    EveryPostWholeSite: "Você será notificado sobre todos os novos tópicos e respostas em qualquer lugar.",

    // One will be notified about the *first* post in a new topic, only. That is, the Original Post
    // (that's what the first post is called, in a discussion forum topic).
    NewTopics: "Novos tópicos",
    NewTopicsInCat: "Você será notificado sobre novos tópicos nesta categoria.",
    NewTopicsWithTag: "Você será notificado sobre novos tópicos com esta tag",
    NewTopicsWholeSite: "Você será notificado sobre novos tópicos em qualquer lugar.",

    Tracking: "Rastreando",

    Normal: "Normal",
    NormalDescr: "Você será notificado se alguém falar com você, também indiretamente, ex: uma " +
      "resposta a uma resposta para você.",

    Hushed: "Suave",
    HushedDescr: "Você será notificado apenas se alguém falar diretamente com você.",

    Muted: "Silenciado",
    MutedTopic: "Sem notificações sobre este tópico.",
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

    from: "de",
    in: "em",
    AllCats: "Todas as categorias",

    // Topic sort order

    Active: "Ativo primeiro",
    ActiveDescr: "Mostra tópicos recentemente ativos primeiro",

    New: "Novo",
    NewDescr: "Mostra tópicos mais novos primeiro",

    Top: "Popular",
    TopDescr: "Mostra tópicos populares primeiro",

    // Topic filter dropdown

    AllTopics: "Todos os tópicos",

    ShowAllTopics: "Mostrar todos os tópicos",
    ShowAllTopicsDescr: "Mas não tópicos excluídos",

    WaitingTopics: "Tópicos aguardando",
    OnlyWaitingDescr_1: "Mostra apenas tópicos ",
    OnlyWaitingDescr_2: "aguardando ",
    OnlyWaitingDescr_3: "por uma solução ou para serem implementados e concluídos",

    YourTopics: "Seus tópicos",
    AssignedToYou: "Atribuídos a você",

    DeletedTopics: "Mostrar excluídos",
    ShowDeleted: "Mostrar excluídos",
    ShowDeletedDescr: "Mostra todos os tópicos, incluindo tópicos excluídos",

    // Rightmost buttons

    ViewCategories: "Ver categorias",
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

  tb: {

    // Opens the right hand sidebar and litst the most recent posts in the current topic.
    RecentPosts: "Postagens recentes",

    // Open right-hand-sidebar button tooltip, if mouse-hovering online-user-count.
    NumOnlChat: " online neste chat",    // example: "5 online in this chat"
    NumOnlForum: " online neste fórum",

    // Open left-sidebar button title.
    WatchbBtn: "Seus tópicos",

    // Tooltip, shown if mouse-hovering the open-left-sidebar button.
    WatchbToolt: "Seus tópicos recentes, chats associados, mensagens diretas",

    // Title shown on user profile pages.
    AbtUsr: "Sobre o Usuário",

    // Shortcuts to leave the user profile page, or staff area, and go back to the discussion topics.
    BackFromUsr: "Voltar do perfil do usuário",
    BackFromAdm: "Voltar da área de administração",

    // Title shown on full text search page.
    SearchPg: "Página de pesquisa",
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

    ThreadDeld: "Tópico excluído",
    CmntDeld: "Comentário excluído",
    PostDeld: "Publicação excluída",
    DiscDeld: "Discussão excluída",
    PageDeld: "Página excluída",
    TitlePendAppr: "Título pendente de aprovação",
    TextPendingApproval: "Texto pendente de aprovação",

    TooltipQuestClosedNoAnsw: "Esta pergunta foi fechada sem resposta aceita.",
    TooltipTopicClosed: "Este tópico está fechado.",

    TooltipQuestSolved: "Isto é uma pergunta respondida",
    TooltipQuestUnsolved: "Isto é uma pergunta não respondida",

    StatusDone: "Concluído",
    TooltipProblFixed: "Isto foi consertado",
    TooltipDone: "Isto foi concluído",

    StatusStarted: "Iniciado",
    TooltipFixing: "No momento estamos consertando isto",
    TooltipImplementing: "No momento estamos implementando isto",

    StatusPlanned: "Planejado",
    TooltipProblPlanned: "Estamos planejando consertar isto",
    TooltipIdeaPlanned: "Estamos planejando implementar isto",

    StatusNew: "Novo",
    StatusNewDtl: "Novo tópico, em discussão",
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

    repliesTo: "responde a",
    InReplyTo: "Em resposta a",
    YourReplyTo: "Sua resposta para ",
    YourChatMsg: "Sua mensagem de chat: ",
    YourDraft: "Seu rascunho",
    YourEdits: "Suas edições: ",
    YourProgrNoteC: "Sua nota de progresso:",
    aProgrNote: "uma nota de progresso: ",

    ReplyingToC: "Respondendo a:",
    ScrollToPrevw_1: "Rolar para ",
    ScrollToPrevw_2: "visualizar",

    UnfinEdits: "Edições inacabadas",
    ResumeEdting: "Continuar editando",
    DelDraft: "Excluir rascunho",

    ClickViewEdits: "Clique para visualizar edições antigas",

    By: "Por ", // ... someones name

    // Discussion ...
    aboutThisIdea: "sobre como e se deve realizar esta ideia",
    aboutThisProbl: "sobre como e se deve consertar isto",

    AddProgrNote: "Adicionar nota de progresso",
    // Progress ...
    withThisIdea: "com a realização desta ideia",
    withThisProbl: "com a resolução deste problema",
    withThis: "com a realização disto",
  },


  // Metabar

  // Shown between the original post and all replies.

  mb: {
    NotfsAbtThisC: "Notificações sobre este tópico:",

    // If is a direct message topic, members listed below this text.
    Msg: "Mensagem",

    SmrzRepls: "Resumir respostas",

    // Don't bother about being correct with "1 reply", "2,3,4 replies".
    // Just write "replies" always instead? (also if only one)

    EstTime: (numReplies: number, minutes: number) =>
        `Há ${numReplies} respostas. Tempo estimado de leitura: ${minutes} minutos`,

    DoneSummarizing: (numSummarized: number, numShownBefore: number) =>
        `Concluído. Resumidas ${numSummarized} respostas, das ${numShownBefore} exibidas anteriormente.`,
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
    DiscIx: "Índice de discussões",

    Disagree: "Discordar",
    DisagreeExpl: "Clique aqui para discordar desta publicação, ou para avisar outras pessoas sobre erros factuais.",
    Bury: "Enterrar",
    BuryExpl: "Clique aqui para posicionar outras publicações antes desta. Apenas a equipe do fórum pode ver seu voto.",
    Unwanted: "Indesejado",
    UnwantedExpl: "Se você não quer esta publicação neste site. Isso vai diminuir a minha confiança no autor da publicação. Apenas a equipe do fórum pode ver seu voto.",

    AddTags: "Adicionar/remover tags",
    UnWikify: "Remover da Wiki",
    Wikify: "Tornar Wiki",
    PinDeleteEtc: "Fixar / Excluir / Categoria ...",
  },


  // Share dialog

  sd: {
    Copied: "Copiado.",
    CtrlCToCopy: "Pressione CTRL+C para copiar.",
    ClickToCopy: "Clique para copiar o link.",
  },


  // Chat

  c: {
    About_1: "Este é o canal de chat ",
    About_2: ", criado por ",
    ScrollUpViewComments: "Role para cima para ver comentários anteriores",
    Purpose: "Propósito:",
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
    StaffHelp: "Ajuda da equipe ",
    DraftsEtc: "Rascunhos, favoritos, tarefas",
    MoreNotfs: "Ver todas as notificações",
    DismNotfs: "Marcar todas como lidas",
    ViewProfile: "Ver seu perfil",
    ViewGroups: "Ver grupos",
    LogOut: "Sair",
    UnhideHelp: "Mostrar mensagens de ajuda",
  },


  // Scroll buttons

  sb: {
    ScrollToC: "Rolar para:",
    Scroll: "Rolar",

    // The Back button, and the letter B is a keyboard shortcut.
    // If in your language, "Back" doesn't start with 'B', then instead
    // set Back_1 to '' (empty text), and Back_2 to:  "Back (B)" — and "Back" (but not "B")
    // translated to your language.
    Back_1: "V",
    Back_2: "oltar",
    BackExpl: "Rolar de volta para a sua posição anterior nesta página",

    // These are useful on mobile — then, no keybard with Home (= scroll to top) and End buttons.
    // And, on a keyboard, once you get used to it, it's quite nice to click 1 to go to the
    // top, and 2 to see the first reply, and B to go back, F forward, so on.
    PgTop: "Topo da página",
    PgTopHelp: "Ir para o topo da página. Atalho: 1 (no teclado)",
    Repl: "Respostas",
    ReplHelp: "Ir para a seção de Respostas. Atalho: 2",
    Progr: "Progresso",
    // The Progress section is at the end of the page, and there, things like
    // "Alice changed status to Doing" and "Alise marked this as Done" and "Topic closed by ..."
    // are shown. (And, optionally, comments by staff or the people working with the issue.)
    ProgrHelp: "Ir para a seção de Progresso. Atalho: 3",
    PgBtm: "Fim da página",
    Btm: "Fim",
    BtmHelp: "Ir para o fim da página. Atalho: 4",

    // "Keyboard shrotcuts: ..., and B to scroll back"
    Kbd_1: ", e ",
    // then the letter 'B' (regardless of language)
    Kbd_2: " para rolar de volta",
  },


  // Select users dialog
  sud: {
    SelectUsers: "Selecionar usuários",
    AddUsers: "Adicionar usuários",
  },


  // About user dialog

  aud: {
    IsMod: "É moderador.",
    IsAdm: "É administrador.",
    IsDeld: "Está desativado ou excluído.",
    ThisIsGuest: "Este é um usuário convidado; na realidade, pode ser qualquer pessoa.",
    ViewInAdm: "Ver na Área de Administração",
    ViewProfl: "Ver Perfil",
    ViewComments: "Ver outros comentários",
    RmFromTpc: "Remover do tópico",
    EmAdrUnkn: "Endereço de email desconhecido — este convidado não será notificado sobre respostas.",
  },


  // User's profile page

  upp: {
    // ----- Links

    Preferences: "Preferências",
    Invites: "Convites",
    DraftsEtc: "Rascunhos, etc.",
    About: "Sobre",
    Privacy: "Privacidade",
    Security: "Segurança",
    Account: "Conta",
    Interface: "Interface",

    // ----- Overview stats

    JoinedC: "Membro desde: ",
    PostsMadeC: "Publicações feitas: ",
    LastPostC: "Última publicação: ",
    LastSeenC: "Visto por último: ",
    TrustLevelC: "Nível de confiança: ",

    // ----- Action buttons

    // ----- Profile pic

    UploadPhoto: "Carregar foto",
    ChangePhoto: "Mudar foto",
    ImgTooSmall: "Imagem pequena demais: deve ter pelo menos 100 x 100",

    // ----- Activity

    OnlyStaffCanSee: "Apenas a equipe e membros principais confiáveis podem ver isso.",
    OnlyMbrsCanSee: "Apenas pessoas que são membros ativos há algum tempo podem ver isso.",
    Nothing: "Nada para mostrar",
    Posts: "Publicações",
    NoPosts: "Nenhuma publicação.",
    Topics: "Tópicos",
    NoTopics: "Nenhum tópico.",

    // ----- User status

    UserBanned: "Este usuário foi banido",
    UserSuspended: (dateUtc: string) => `Este usuário foi suspenso até ${dateUtc} UTC`,
    ReasonC: "Motivo: ",

    DeactOrDeld: "Foi desativado ou deletado.",
    isGroup: " (um gruop)",
    isGuest: " — um usuário convidado, pode ser qualquer pessoa",
    isMod: " – moderador",
    isAdmin: " – administrador",
    you: "(você)",

    // ----- Notifications page

    NoNotfs: "Nenhuma notificação",
    NotfsToYouC: "Notificações para você:",
    NotfsToOtherC: (name: string) => `Notificações para ${name}:`,
    DefNotfsSiteWide: "Notificações padrão de todo o site",
    // The "for" in:  "Default notifications, site wide, for (someone's name)".
    forWho: "para",

    // ----- Drafts Etc page

    NoDrafts: "Nenhum rascunho",
    YourDraftsC: "Seus rascunhos:",
    DraftsByC: (name: string) => `Rascunhos de ${name}:`,

    // ----- Invites page

    InvitesIntro: "Aqui você pode convidar pessoas para se associar a este site. ",
    InvitesListedBelow: "Convites que você já enviou são listados abaixo..",
    NoInvites: "Você não citou ninguém ainda.",

    InvitedEmail: "Email do convidado",
    WhoAccepted: "Membro que aceitou",
    InvAccepted: "Convite aceito",
    InvSent: "Convite enviado",
    JoinedAlready: "Já se juntou",

    SendAnInv: "Convidar pessoas",
    SendInv: "Enviar convites",
    SendInvExpl:
        "Enviaremos aos seus amigos um curto convite por email. Eles poderão clicar em um link " +
        "para se juntar imediatamente, sem necessidade de login. " +
        "Eles se tornarão membros comuns, não moderadores ou administradores.",
    //EnterEmail: "Digite o email",
    InvDone: "Concluído. Enviarei um email para eles.",
    NoOneToInv: "Ninguém para convidar.",
    InvNotfLater: "Avisarei você mais tarde, quando eu os tiver convidado.",
    AlreadyInvSendAgainQ: "Estes já foram convidados — talvez você queira convidá-los novamente?",
    InvErr_1: "Estes resultaram em ",
    InvErr_2: "erros",
    InvErr_3: ":",
    TheseJoinedAlrdyC: "Estes já se juntaram, por isso não os convidei:",
    ResendInvsQ: "Reenviar convites para estas pessoas? Elas já foram convidadas.",
    InvAgain: "Convidar novamente",

    // ----- Preferences, About

    AboutYou: "Sobre você",
    WebLink: "Seu site ou página da web.",

    NotShownCannotChange: "Não mostrado publicamente. Não pode ser alterado.",

    // The full name or alias:
    NameOpt: "Nome (opcional)",

    NotShown: "Não mostrado publicamente.",

    // The username:
    MayChangeFewTimes: "Você só pode alterá-lo algumas vezes.",
    notSpecified: "(não especificado)",
    ChangeUsername_1: "Você só pode alterar seu nome de usuário algumas vezes.",
    ChangeUsername_2: "Alterá-lo frequentemente pode confundir os outros — " +
        "eles não saberão como @mencionar você.",

    NotfAboutAll: "Receba notificações sobre cada nova publicação (a menos que você silencie o tópico ou a categoria)",
    NotfAboutNewTopics: "Receba notificações sobre novos tópicos (a menos que você silencie a categoria)",

    ActivitySummaryEmails: "Emails de resumo de atividade",

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

    // Password:
    ChangePwdQ: "Alterar senha?",
    CreatePwdQ: "Criar senha?",
    WillGetPwdRstEml: "Você receberá um email para redefinir sua senha.",
    // This is the "None" in:  "Password: None"
    PwdNone: "Nenhuma",

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

    //OrCreateAcct_1: "Ou ",
    //OrCreateAcct_2: "crie uma conta",
    //OrCreateAcct_3: " com ",
    //OrCreateAcct_4: "@nomedeusuario",
    //OrCreateAcct_5: " & senha",

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

    //AlreadyHaveAcctQ: "Já tem uma conta? ",
    OrLogIn_1: "",
    OrLogIn_2: "Fazer login",   // "Log in" (this is a button)
    OrLogIn_3: " em vez disso", // "instead"

    //NewUserQ: "Novo usuário? ",
    SignUpInstead_1: "",
    SignUpInstead_2: "Cadastre-se",
    SignUpInstead_3: " em vez disso",

    // MAYBE x3:
    OrTypeName_1: ", ou apenas ",
    OrTypeName_2: "digite seu nome",   // is a button
    OrTypeName_3: "",

    OrCreateAcctHere: "Ou crei uma conta:",
    OrTypeName: "Ou digite seu nome:",
    OrLogIn: "Ou faça login:", // was: "Ou preencha:"" = "fill in".  MAYBE
    YourNameQ: "Seu nome?",  // MAYBE

    BadCreds: "Nome de usuário ou senha incorretos",

    UsernameOrEmailC: "Nome de usuário ou email:",
    PasswordC: "Senha:",
    ForgotPwd: "Esqueceu sua senha?",

    NoPwd: "Você ainda não escolheu uma senha.",
    CreatePwd: "Criar senha",
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


  // Help message dialog
  help: {
    YouCanShowAgain_1: "Você pode mostrar as mensagens de ajuda novamente, se estiver logado, " +
        "clicando em seu nome e depois em ",
    YouCanShowAgain_2: "Mostrar mensagens de ajuda",
  },


  // Editor

  e: {
    SimilarTopicsC: "Tópicos semelhantes:",

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
    AddCommentC: "Adicionar um comentário:",

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

    PreviewInfo: "Aqui você pode pré-visualizar como seu post vai ficar.",
    CannotType: "Você não pode digitar aqui.",

    LoadingDraftDots: "Carregando rascunho...",
    DraftUnchanged: "Sem alterações.",
    CannotSaveDraftC: "Não foi possível salvar o rascunho:",
    DraftSavedBrwsr: "Rascunho salvo no navegador.",
    DraftSaved: (nr: string | number) => `Rascunho ${nr} salvo.`,
    DraftDeleted: (nr: string | number) => `Rascunho ${nr} excluído.`,
    WillSaveDraft: (nr: string | number) => `Salvando rascunho ${nr} ...`,
    SavingDraft: (nr: string | number) => `Salvando rascunho ${nr} ...`,
    DeletingDraft: (nr: string | number) => `Excluindo rascunho ${nr} ...`,
  },


  // Select category dropdown

  scd: {
    SelCat: "Selecionar categoria",
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
    NoMoreToJoin: "Não há mais comunidades para participar.",
    SelCmty: "Selecionar comunidade ...",
  },


  // Search dialogs and the search page.

  s: {
    TxtToFind: "Texto para pesquisar",
  },


  // No internet

  ni: {
    NoInet: "Sem conexão com a internet",
    PlzRefr: "Atualize a página para ver as alterações mais recentes. (Houve uma desconexão)",
    RefrNow: "Atualizar agora",
  },


  PostDeleted: (postNr: number) => `Esta publicação, nr ${postNr}, foi excluída.`,
  NoSuchPost: (postNr: number) => `Não há publicação nr ${postNr} nesta página.`,
  NoPageHere: "Esta página foi excluída, ou nunca existiu, ou você não tem permissão para acessá-la.",
  GoBackToLastPage: "Voltar para a página anterior",

};


