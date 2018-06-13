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
    Muted: "Silenciado",
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


  // Chat

  c: {
    About_1: "Este é o canal de chat",
    About_2: " , criado por ",
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
    MoreNotfs: "Ver mais notificações...",
    ViewProfile: "Visualizar/editar seu perfil",
    LogOut: "Encerrar sessão",
    UnhideHelp: "Revelar mensagens de ajuda",
  },


  // About user dialog

  aud: {
    ViewComments: "Visualizar outros comentários",
    ThisIsGuest: "Este é um usuário convidado; na realidade, pode ser qualquer pessoa.",
  },


  // User's profile page

  upp: {
    // ----- Links

    Notifications: "Notificações",
    Preferences: "Preferências",
    Invites: "Convites",
    About: "Sobre",
    Privacy: "Privacidade",
    Account: "Conta",

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
    ImgTooSmall: "Imagem pequena demais: deve ser 100 x 100",

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
    NotfsToYouC: "Notificação para você:",
    NotfsToOtherC: (name: string) => `Notificação para ${name}:`,

    // ----- Invites page

    InvitesIntro: "Aqui você pode convidar pessoas para se associar a este site. ",
    InvitesListedBelow: "Convites que você já enviou são listados abaixo..",
    NoInvites: "Você não citou ninguém ainda.",

    InvitedEmail: "Email do convidado",
    WhoAccepted: "Membro que aceitou",
    InvAccepted: "Convite aceito",
    InvSent: "Convite enviado",

    SendAnInv: "Enviar um Convite",
    SendInv: "Enviar Convite",
    SendInvExpl:
        "Vamos enviar um email curto para seu amigo, e a pessoa deve então clicar em um link " +
        "para se associar imediatamente, sem necessidade de login. " +
        "A pessoa vai se tornar um membro comum, não um moderador ou administrador.",
    EnterEmail: "Digite o email",
    InvDone: "Concluído. Enviando um email para a pessoa.",
    InvErrJoinedAlready: "A pessoa já se associou a este site",
    InvErrYouInvAlready: "Você já convidou a pessoa",

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
    ForLoginWithDot: (provider: string) => `Para login com ${provider}. `,
    MakePrimary: "Tornar Primário",
    AddEmail: "Adicione endereço de email",
    TypeNewEmailC: "Digite um novo endereço de email:",
    MaxEmailsInfo: (numMax: number) => `(Você não pode adicionar mais do que ${numMax} endereços.)`,
    EmailAdded_1: "Adicionado. Acabamos de enviar um email de verificação — ",
    EmailAdded_2: "cheque sua caixa de entrada de email.",

    EmailStatusExpl:
        "('Primário' significa que você pode fazer login usando este endereço, e que nós enviamos notificações para ele. " +
        "'Verificado' significa que você clicou no link de verificação em um email de verificação.)",

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


  // Create user dialog

  cud: {
    CreateUser: "Criar Usuário",
    CreateAccount: "Criar Conta",
    LoginAsGuest: "Fazer login como convidado",
    EmailPriv: "Email: (será mantido privado)",
    EmailOptPriv: "Email: (opcional, será mantido privado)",
    EmailVerifBy_1: "Seu email foi verificado por ",
    EmailVerifBy_2: ".",
    Username: "Nome de usuário: (único e curto)",
    FullName: "Nome completo: (opcional)",

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
    Accept_3_Owner: " para dono de sites?",

    YesAccept: "Sim eu acieto",
  },


  // Password input

  pwd: {
    PasswordC: "Senha:",
    StrengthC: "Força: ",
    FairlyWeak: "Bem fraca.",
    toShort: "muit curta",
    TooShortMin10: "Muito curta. Tem que ter pelo menos 10 caracteres",
    PlzInclDigit: "Por favor, inclua um dígito ou caractere especial",
    TooWeak123abc: "Muito fraca. Não use senhas como '12345' ou 'abcde'.",
    AvoidInclC: "Evite incluir (partes de) seu nome ou email na senha:",
  },


  // Login dialog

  ld: {
    NotFoundOrPrivate: "Página não encontrada, ou Acesso Negado.",
    IsImpersonating: "Vocês está personificando alguém, que pode não ter acesso a todas as partes " +
        "deste site.",

    IfYouThinkExistsThen: "Se você acha que a página existe, faça login como alguém que tenha acesso a ela. ",
    LoggedInAlready: "(Você já está logado, mas talvez esta é a conta errada?) ",
    ElseGoToHome_1: "Como alternativa, você pode ",
    ElseGoToHome_2: "ir à página inicial.",

    CreateAcconut: "Criar conta",
    SignUp: "Cadastrar-se",
    LogIn: "Fazer login",
    with_: "com ",
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
    OrFillIn: "Ou preencha:",

    BadCreds: "Nome de usuário ou senha incorretos",

    UsernameOrEmailC: "Nome de usuário ou email:",
    PasswordC: "Senha:",
    ForgotPwd: "Esqueceu sua senha?",
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


  // Editor

  e: {
    WritingSomethingWarning: "Você estava escrevendo alguma coisa?",
    UploadMaxOneFile: "Desculpe, mas atualmente você só pode fazer upoad de apenas um arquivo por vez",
    PleaseFinishPost: "Por favor termine primeiro de escrever seu post",
    PleaseFinishChatMsg: "Por favor termine primeiro de escrever sua mensagem de chat",
    PleaseFinishMsg: "Por favor termine primeiro de escrever sua mensagem",
    PleaseSaveEdits: "Por favor salve primeiro suas edições atuais",
    PleaseSaveOrCancel: "Por favor salve ou cancele seu seu novo tópico",
    CanContinueEditing: "Você pode continuar editando seu texto, se você abrir o editor novamente. " +
        "(Mas o texto atual vai ser perdido se você for embora desta página.)",
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


};


