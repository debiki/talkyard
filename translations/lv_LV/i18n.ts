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

  Active: "Aktīvs",
  Activity: "Aktivitāte",
  Add: "Pievienot",
  AddingDots: "Pievieno ...",
  Admin: "Admins",
  AdvSearch: "Papildināta meklēšana",
  Away: "Izgājis",
  Back: "Atpakaļ",
  BlogN: "Blogs",
  Bookmarks: "Grāmatzīmes",
  Cancel: "Atcelt",
  Categories: "Kategorijas",
  Category: "Kategorija",
  ChangeV: "Mainīt",
  Continue: "Turpināt",
  ClickToShow: "Klikšķināt, lai parādītu",
  ChangeDots: "Maina ...",
  ChatN: "Čats",
  Chatting: "Tērzēšana",
  CheckYourEmail: "Pārbaudi savu e-pastu",
  Close: "Aizvērt",
  closed: "aizvērts",
  Created: "Izveidots",
  Delete: "Dzēst",
  Deleted: "Dzēsts",
  DirectMessage: "Ziņojums",
  Discussion: "Diskusija",
  discussion: "diskusija",
  done: "kārtībā",
  EditV: "Labot",
  Editing: "Labo",
  EmailAddress: "E-pasta adrese",
  EmailAddresses: "E-pasta adreses",
  EmailSentD: "E-pasts nosūtīts.",
  Forum: "Forums",
  GetNotifiedAbout: "Saņemt paziņojumus par",
  GroupsC: "Grupas:",
  Hide: "Slēpt",
  Home: "Sākums",
  Idea: "Ideja",
  Join: "Pievienoties",
  KbdShrtcsC: "Klaviatūras īsceļi: ",
  Loading: "Atver...",
  LoadMore: "Atvērt vēl ...",
  LogIn: "Ienākt",
  LoggedInAs: "Ienāci kā ",
  LogOut: "Iziet",
  Maybe: "Varbūt",
  Manage: "Pārvaldīt",
  Members: "Biedri",
  MessageN: "Ziņa",
  MoreDots: "Vairāk...",
  Move: "Pārvietot",
  Name: "Vārds",
  NameC: "Vārds:",
  NewTopic: "Jauna tēma",
  NoCancel: "Nē, atcelt",
  Notifications: "Paziņojumi",
  NotImplemented: "(Nav ieviests)",
  NotYet: "Vēl nē",
  NoTitle: "Nav virsraksta",
  NoTopics: "Nav tēmas.",
  Okay: "Ok",
  OkayDots: "Ok ...",
  Online: "Online",
  onePerLine: "pa vienam katram rindā",
  PreviewV: "Priekšskatījums",
  Problem: "Problēma",
  progressN: "progress",
  Question: "Jautājums",
  Recent: "Nesens",
  Remove: "Aizvākt",
  Reopen: "Atvērt",
  ReplyV: "Atbildēt",
  Replying: "Atbild",
  Replies: "Atbildes",
  replies: "atbildes",
  Save: "Saglabāt",
  SavingDots: "Saglabā ...",
  SavedDot: "Saglabāts.",
  Search: "Meklēt",
  SendMsg: "Sūtīt ziņu",
  SignUp: "Reģistrēties",
  Solution: "Risinājums",
  started: "uzsākts",
  Summary: "Kopsavilkums",
  Submit: "Apstiprināt",
  Tools: "Rīki",
  Topics: "Tēmas",
  TopicTitle: "Tēmas virsraksts",
  TopicType: "Tēmas tips",
  UploadingDots: "Augšupielādē...",
  Username: "Lietotājvārds",
  Users: "Lietotāji",
  Welcome: "Laipni lūdzam",
  Wiki: "Wiki",
  Yes: "Jā",
  YesBye: "Jā, uz redzi",
  YesDoThat: "Jā",
  You: "Tu",
  you: "tu",

  // Trust levels.
  Guest:  "Viesis",
  NewMember: "Jauns lietotājs",
  BasicMember: "Pamata lietotājs",
  FullMember: "Pilns lietotājs",
  TrustedMember: "Uzticams lietotājs",
  RegularMember: "Uzticams regulārs",  // MISSING renamed Regular Member —> Trusted Regular [RENREGLS]
  CoreMember: "Galvenais biedrs",

  // Periods.
  PastDay: "Iepriekšējā diena",
  PastWeek: "Iepriekšējā nedēļa",
  PastMonth: "Iepriekšējais mēnesis",
  PastQuarter: "Iepriekšējais ceturksnis",
  PastYear: "Iepriekšējais gads",
  AllTime: "Visu laiku",

  // Time ago letters.
  // English examples: "3d" in forum topic list means 3 days ago. "5h" is 5 hours.
  monthsLtr: "mēn",  // months
  daysLtr: "d",      // days
  hoursLtr: "h",     // hours
  minsLtr: "m",      // minutes
  secsLtr: "s",      // seconds

  // Time ago, long text versions.
  daysAgo: (numDays: number) =>
    numDays === 1 ? "pirms 1 dienas" : `${numDays} days ago`,

  hoursAgo: (numHours: number) =>
    numHours === 1 ? "pirms 1 stundas" : `${numHours} hours ago`,

  minutesAgo: (numMins: number) =>
    numMins === 1 ? "pirms 1 minūtes" : `${numMins} minutes ago`,

  secondsAgo: (numSecs: number) =>
    numSecs === 1 ? "pirms 1 sekundes" : `${numSecs} seconds ago`,


  // Input fields, e.g. email, name etc.

  inp: {
    // Email address input field:
    EmReq: "Epasts ir obligāts",
    NoSpcs: "Nav atļautas atstarpes",
    InvldAddr: "Nederīga epasta adrese",
    NoBadChrs: "Nav atļautas īpašas rakstzīmes",

    // Full name input field:
    NotOnlSpcs: "Nav atļautas atstarpes",
    NoAt: "Nav atļauts simbols @",

    // Username input field:
    NoDash: "Nav atļautas domuzīmes (-)",
    DontInclAt: "Neiekļaut @",
    StartEndLtrDgt: "Sākas un beidzas ar burtu vai ciparu",
    OnlLtrNumEtc: "Tikai burti (a-z, A-Z) un cipari, un _ (apakšsvītra)",
    // This shown just below the username input:
    UnUnqShrt_1: "Tavs ",
    UnUnqShrt_2: "@lietotājvārds",
    UnUnqShrt_3: ", unikāls un īss",

    // Generic messages for all input fields:
    TooShort: (minLength: number) => `Par īsu - jāsatur vismaz ${minLength} rakstzīmes`,
    TooLong: (maxLength: number) => `Par garu - jāsatur ne vairāk kā ${maxLength} rakstzīmes`,
  },


  // Notification levels.

  nl: {
    EveryPost: "Katrs ieraksts",
    EveryPostInTopic: "Tiks paziņots par visām jaunām atbildēm šajā tēmā.",
    EveryPostInCat: "Tiks paziņots par visām jaunām tēmām un atbildēm šajā sadaļā.",
    EveryPostInTopicsWithTag: "Tiks paziņots par jaunām tēmām ar šo tagu, kā arī par atbildēm šajās tēmās.",
    EveryPostWholeSite: "Tiks paziņots par pilnīgi visām jaunām tēmām un ierakstiem.",

    // One will be notified about the *first* post in a new topic, only. That is, the Original Post
    // (that's what the first post is called, in a discussion forum topic).
    NewTopics: "Jaunas tēmas",
    NewTopicsInCat: "Tiks paziņots par jaunām tēmām šajā sadaļā.",
    NewTopicsWithTag: "Tiks paziņots par jaunām tēmām ar šo tagu.",
    NewTopicsWholeSite: "Tiks par paziņots par pilnīgi visām jaunām tēmām.",

    Tracking: "Izsekošana",

    Normal: "Normal",
    NormalDescr: "Tiks paziņots, kad kāds uzsāks saziņu, arī netiešā veidā, piemēram - " +
        "atbildot uz tavu atbildi.",
    //NormalTopic_1: "Tiks paziņots, ja kāds uzsāks saziņu vai pieminēs tavu ",
    //NormalTopic_2: "@lietotājvārdu",

    Hushed: "Apklusināts",
    HushedDescr: "Tiks paziņots tikai tad, ja kāds tiešā veidā uzsāks saziņu.",

    Muted: "Izslēgts",
    MutedTopic: "Bez paziņojumiem.",   // MISSING removed "about this topic"
  },


  // Forum intro text

  fi: {
    Edit: "Labot",
    Hide_1: "Slēpt",
    Hide_2: ", klikšķini ",
    Hide_3: " lai atvērtu",
  },


  // Forum categories

  fcs: {
    All: "Visas", // "All (categories)", shorter than AllCats
  },


  // Forum buttons

  fb: {

    TopicList: "Tēmu saraksts",

    // Select category dropdown

    from: "no",  // MISSING used like so:  "From <Category Name>" or "From All Categories"
    in: "iekš",      // MISSING used like so:  "in <Category Name>" or "in All Categories"
    AllCats: "Visas sadaļas",

    // Topic sort order

    Active: "Aktīvās",      // MISSING didn't add "first" yet to transls
    ActiveDescr: "Rāda vispirms aktīvās tēmas",

    New: "Jaunās",
    NewDescr: "Rāda vispirms jaunās tēmas",

    Top: "Populārās",              // MISSING didn't rename from Top to Popular in transls
    TopDescr: "Rāda vispirms populārās tēmas",

    // Topic filter dropdown

    AllTopics: "Visas tēmas",

    ShowAllTopics: "Rādīt visas tēmas",
    ShowAllTopicsDescr: "Dzēstās tēmas netiek rādītas",

    WaitingTopics: "Neatrisinātas tēmas",          // MISSING
    OnlyWaitingDescr_1: "Rāda tikai tēmas ", // MISSING changed "questions" to "topics"
    OnlyWaitingDescr_2: "gaidot",
    OnlyWaitingDescr_3: "risinājumu vai ieviešanu",  // MISSING rewrote

    YourTopics: "Tavas tēmas",       // MISSING
    AssignedToYou: "Nodotas tavā pārraudzībā", // MISSING

    DeletedTopics: "Rādīt dzēstās",   // MISSING
    ShowDeleted: "Rādīt dzēstās",
    ShowDeletedDescr: "Rādīt visas tēmas, ieskaitot arī dzēstās",

    // Rightmost buttons

    ViewCategories: "Skatīt sadaļas",  // MISSING
    EditCat: "Labot sadaļu",
    CreateCat: "Izveidot sadaļu",
    CreateTopic: "Izveidot tēmu",
    PostIdea: "Publicēt ideju",
    AskQuestion: "Uzdot jautājumu",
    ReportProblem: "Ziņot par problēmu",
    CreateMindMap: "Izveidot prāta karti",
    CreatePage: "Izveidot lapu",

  },


  // Forum topic list

  ft: {
    ExplIcons: "Paskaidro ikonas...",
    IconExplanation: "Ikonu paskaidrojumi:",
    ExplGenDisc: "Parasta diskusija.",
    ExplQuestion: "Jautājums bez apstiprinātas atbildes.",
    ExplAnswer: "Jautājums ar apstiprinātu atbildi.",
    ExplIdea: "Ideja / ierosinājums.",
    ExplProblem: "Problēma.",
    ExplPlanned: "Plānots jaunievedums vai labojums.",
    ExplDone: "Paveikts jaunievedums vai labojums.",
    ExplClosed: "Slēgta tēma.",
    ExplPinned: "Vienmēr augšpusē rādīt atēma (varbūt tikai savā sadaļā).",

    PopularTopicsComma: "Populāras tēmas, ",
    TopFirstAllTime: "Rāda vispirms visu laiku populārākās tēmas.",
    TopFirstPastDay: "Rāda pēdējās dienās populārās tēmas.",

    CatHasBeenDeleted: "Šī sadaļa tika izdzēsta",

    TopicsActiveFirst: "Tēmas, vispirms aktīvās",
    TopicsNewestFirst: "Tēmas, vispirms jaunās",

    CreatedOn: "Izveidots ",
    LastReplyOn: "\nPēdējā atbilde ",
    EditedOn: "\nLabots ",

    // These are shown as mouse-hover tooltips, or mobile-phone-touch-tips, over the user
    // avatar icons, in the forum topic list.
    createdTheTopic: "izveidoja šo tēmu",
    frequentPoster: "regulārs publicētājs",
    mostRecentPoster: "nesenākais publicētājs",

    inC: "in: ",

    TitleFixed: "Šis ir izlabots",
    TitleDone: "Šis ir paveikts",
    TitleStarted: "Šo mēs esam uzsākuši",
    TitleStartedFixing: "Šo mēs esam sākuši labot",
    TitleUnsolved: "Šī ir neatrisināta problēma",
    TitleIdea: "Šī ir ideja",
    TitlePlanningFix: "Šo mēs plānojam izlabot",
    TitlePlanningDo: "Šo mēs plānojam pabeikt",
    TitleChat: "Šis ir čata kanāls",
    TitlePrivateChat: "Šis ir privāts čata kanāls",
    TitlePrivateMessage: "Privāta ziņa",
    TitleInfoPage: "Šī ir info lapa",
    TitleDiscussion: "Diskusija",
    IsPinnedGlobally: "\nTas ir izcelts, lai tiktu attēlots kā pirmais.",
    IsPinnedInCat: "\nTas ir izcelts savā sadaļā, lai tiktu attēlots kā pirmais savā sadaļā.",
  },


  // Forum categories list

  fc: {
    RecentTopicsWaiting: "Nesenās tēmas (ieskaitot procesā)",
    RecentTopicsInclDel: "Nesenās tēmas (ieskaitot dzēstās)",
    RecentTopics: "Nesenās tēmas",
    _replies: " atbildes",
    _deleted: " (dzēstas)",
    _defCat: " (noklusētā sadaļa)",
  },


  // Topbar

  // Shown at the top of the page. Includes login and signup buttons, or one's username menu.

  tb: {

    // Opens the right hand sidebar and litst the most recent posts in the current topic.
    RecentPosts: "Nesenie ieraksti",

    // Open right-hand-sidebar button tooltip, if mouse-hovering online-user-count.
    NumOnlChat: " online šajā čatā",    // example: "5 online in this chat"
    NumOnlForum: " online šajā forumā",

    // Open left-sidebar button title.
    WatchbBtn: "Tavas tēmas",

    // Tooltip, shown if mouse-hovering the open-left-sidebar button.
    WatchbToolt: "Tavas nesenās tēmas, čati un ziņojumi",

    // Title shown on user profile pages.
    AbtUsr: "Par lietotāju",

    // Shortcuts to leave the user profile page, or staff area, and go back to the discussion topics.
    BackFromUsr: "Atpakaļ no lietotāja profila",
    BackFromAdm: "Atpakaļ no adminpaneļa",

    // Title shown on full text search page.
    SearchPg: "Meklēšanas lapa",
  },


  // Watchbar (the sidebar to the left)

  wb: {
    AddCommunity: "Pievienot ...",
    RecentlyViewed: "Nesen aplūkotas tēasm",  // MISSING " topics"
    JoinedChats: "Čati",
    ChatChannels: "Čata kanāli",
    CreateChat: "Izveidot čata kanālu",
    DirectMsgs: "Ziņojums",
    NoChats: "Nav",    // meaning: "No chat messages"
    NoDirMsgs: "Nav",  // meaning: "No direct messages"

    // The click-topic dropdown menu:
    TopicActions: "Tēmas opcijas",
    ViewPeopleHere: "Skatīt cilvēkus šeit",
    ViewAddRemoveMembers: "Skatīt / pievienot / noņemt biedrus",
    ViewChatMembers: "Skatīt čata biedrus",
    EditChat: "Labot čata aprakstu",
    //EditChat: "Labot čata nosaukumu un mērķi", // Keep, in case adds back edit-title input
    LeaveThisChat: "Pamest šo čatu",
    LeaveThisCommunity: "Pamest šo kopienu",
    JoinThisCommunity: "Pievienoties šai kopienai",
  },


  // Contextbar (the sidebar to the right)

  cb: {
    RecentComments: "Nesenie kometāri šajā tēmā:",
    NoComments: "Nav komentāru.",

    YourBookmarks: "Tavas grāmatzīmes:",

    UsersOnline: "Lietotāji online:",
    UsersOnlineForum: "Lietotāj online šajā forumā:",
    UsersInThisChat: "Lietotāji šajā čatā:",
    UsersInThisTopic: "Lietotāji šajā tēmā:",

    GettingStartedGuide: "Admina gids", // MISSING in other langs, was: "Getting Started Guide".
    AdminGuide: "Admina gids",          // ... but what? It's here already, just reuse this transl field
    Guide: "Gigs",

    // How to hide the sidebar.
    CloseShortcutS: "Aizvērt (keyboard shortcut: S)",

    // ----- Online users list / Users in current topic

    AddPeople: "Pievienot vēl cilvēkus",

    // Shown next to one's own username, in a list of users.
    thatsYou: "tas esi tu",

    // Info about which people are online.
    // Example, in English: "Online users: You, and 5 people who have not logged in"
    OnlyYou: "Izskatās, ka tikai tu",
    YouAnd: "Tu un ",
    NumStrangers: (numStrangers: number) => {
      const people = numStrangers === 1 ? " persona," : " cilvēki,";
      const have = numStrangers === 1 ? " kura" : " kuri";
      return numStrangers + people + " nav" + have + " ienākuši";
    },

    // ----- Recent comments list

    // This explains how the Recent tab in the sidebar works.

    RepliesToTheLeft: "Atbildes kreisajā pusē tiek kārtotas kā ",
    bestFirst: "labākās vispirms.",
    ButBelow: "Bet lejā ",
    insteadBy: "tās pašas atbildes tiek kārtotas kā ",
    newestFirst: "jaunākās vispirms.",

    SoIfLeave: "Līdz ar to, ja iziesi un atnāksi vēlāk atpakaļ, lejā atradīsi ",
    allNewReplies: "visas jaunās atbildes.",
    Click: "Klikšķini",
    aReplyToReadIt: " uz atbildes lejā, lai to izlasītu — jo lejā tiek rādīta tikai atbildes daļa.",
  },


  // Change page dialog
  cpd: {
    ClickToChange: "Klikšķini, lai mainītu statusu",
    ClickToViewAnswer: "Klikšķini, lai aplūkotu atbildi",
    ViewAnswer: "Skatīt atbildi",
    ChangeStatusC: "Mainīt statusu uz:",
    ChangeCatC: "Mainīt sadaļu:",
    ChangeTopicTypeC: "Mainīt tēmas tipu:",
  },


  // Page doing status, PageDoingStatus
  pds: {
    aQuestion: "jautājums",
    hasAccptAns: "ir apstiprināta atbilde",
    aProblem: "problēma",
    planToFix: "plāns izlabot",
    anIdea: "ideja",
    planToDo: "plāns ieviest",
  },


  // Discussion / non-chat page

  d: {
    // These texts are split into parts 1,2 or 1,2,3 ec, because in between the texts,
    // icons are shown, to help people understand what those icons mean.

    ThisFormClosed_1: "Šī forma ir ",
    // A Topic-has-been-Closed icon shown here, between text parts 1 (just above) and 2 (below).
    ThisFormClosed_2: "aizvērta; tu vairs nevari to aizpildīt un iesniegt.",

    ThisTopicClosed_1: "Šī tēma ir ",
    // A Topic-has-been-Closed icon, + the text "closed", shown here.
    ThisTopicClosed_2: ". Tu joprojām vari publicēt komentārus.",   // SYNC removed "won't make ... bump ..."

    ThisPageDeleted: "Šī lapa ir dzēsta",
    CatDeldPageToo: "Sadaļa dzēsta, līdz ar to arī šī lapa tika izdzēsta",

    ThreadDeld: "Tēma dzēsta",
    CmntDeld: "Komentārs dzēsts",
    PostDeld: "Ieraksts dzēsts",
    DiscDeld: "Diskusija dzēsta",
    PageDeld: "Lapa dzēsta",
    TitlePendAppr: "Nosaukums gaida apstiprinājumu",
    TextPendingApproval: "Teksts gaida apstiprinājumu",

    TooltipQuestClosedNoAnsw: "Šis jautājums tika aizvērts bez nevienas apstiprinātas atbides.",
    TooltipTopicClosed: "Šī tēma ir aizvērta.",

    TooltipQuestSolved: "Šis ir atrisināts jautājums",
    TooltipQuestUnsolved: "Šis ir neatrisināts jautājums",

    StatusDone: "Pabeigts",
    TooltipProblFixed: "Šis ir izlabots",
    TooltipDone: "Šis ir pabeigts",

    StatusStarted: "Uzsākts",
    TooltipFixing: "Mēs esam sākuši šo labot",      // MISSING "We're currently" —> "We've started"
    TooltipImplementing: "Mēs esam sākuši šo darīt", // MISSING  -""-

    StatusPlanned: "Plānots",
    TooltipProblPlanned: "Mēs plānojam šo izlabot",
    TooltipIdeaPlanned: "Mēs plānojam šo paveikt",   // or "to implement this"?

    StatusNew: "Jauns",
    StatusNewDtl: "Jauna diskusiju tēma",
    TooltipUnsProbl: "Šī ir neatrisināta problēma",
    TooltipIdea: "Šī ir ideja",

    TooltipPersMsg: "Privāta ziņa",
    TooltipChat: "# nozīmē čata kanāls",
    TooltipPrivChat: "Šis ir privāts čata kanāls",

    TooltipPinnedGlob: "\nPiesprausts globāli.",
    TooltipPinnedCat: "\nPiepsprausts šajā sadaļā.",

    SolvedClickView_1: "Atrisināts ierakstā #",
    SolvedClickView_2: " - klikšķini, lai apskatītu",

    PostHiddenClickShow: "Ieraksts paslēpts; klikškini, lai parādītu",
    ClickSeeMoreRepls: "Klikšķini, lai parādītu vairāk atbildes",
    ClickSeeMoreComments: "Klikšķini, lai parādītu vairāk komentārus",
    ClickSeeThisComment: "Klikšķini, lai parādītu šo komentāru",
    clickToShow: "klikšķini, lai parādītu",

    ManyDisagree: "Daudzi šim nepiekrīt:",
    SomeDisagree: "Daži šim nepiekrīt:",

    CmtPendAppr: "Komentārs gaida apstiprināšanu, publicēts ",
    CmtBelowPendAppr: (isYour) => (isYour ? "Tavs" : "The") + " komentārs lejā gaida apstiprinājumu.",

    _and: " un",

    repliesTo: "atbildes uz",
    InReplyTo: "Atbildē uz",

    ClickViewEdits: "Klikšķini, lai skatītu vecos labojumus",

    By: "Autors: ", // ... someones name

    // Discussion ...
    aboutThisIdea: "par to, kā šo ieviest šo ideju",
    aboutThisProbl: "par to, kā šo izlabot šo problēmu",

    AddProgrNote: "Pievienot progresa piezīmi",
    // Progress ...
    withThisIdea: "ieviešot šo ideju",
    withThisProbl: "labojot šo problēmu",
    withThis: "nodarbojoties ar šo",
  },


  // Metabar

  // Shown between the original post and all replies.

  mb: {
    NotfsAbtThisC: "Paziņojumi par šo tēmu:",

    // If is a direct message topic, members listed below this text.
    Msg: "Ziņa",

    SmrzRepls: "Apkopo atbildes",

    // Don't bother about being correct with "1 reply", "2,3,4 replies".
    // Just write "replies" always instead? (also if only one)

    EstTime: (numReplies: number, minutes: number) =>
        `Kopējais atbilžu skaits : ${numReplies}. Aptuvenais lasīšanas laiks: ${minutes} minūtes`,

    DoneSummarizing: (numSummarized: number, numShownBefore: number) =>
        `Pabeigts. Kopā ${numSummarized} atbildes, no iepriekš rādītām ${numShownBefore} atbildēm.`,
  },


  // Post actions

  pa: {
    CloseOwnQuestionTooltip: "Aizvērt šo jautājumu, ja tev vairs nav nepieciešama atbilde.",
    CloseOthersQuestionTooltip: "Aizvērt šo jautājumu, ja uz to nav nepieciešama atbilde, piemēram - ja " +
        "tā ir beztēma vai uz to ir sniegta atbilde jau kādā citā tēmā.",
    CloseToDoTooltip: "Aizvērt, ja šo nav nepieciešams ieviest vai izlabot.",
    CloseTopicTooltip: "Aizvērt šo tēmu, ja tā vairs nav aktuāla.",

    AcceptBtnExpl: "Apstiprināt šo kā atbildi",
    SolutionQ: "Risinājuns?",
    ClickUnaccept: "Klikšķināt, lai atceltu apstiprināto atbildi",
    PostAccepted: "Šis ieraksts ir apstiprināts kā atbilde",

    NumLikes: (num: number) => num === 1 ? "1 Patīk" : num + " Patīk",
    NumDisagree: (num: number) => num + " Nepiekrīt",
    NumBury: (num: number) => num === 1 ? "1 Aprakt" : num + " Aprakt",
    NumUnwanted: (num: number) => num === 1 ? "1 Nevajadzīgs" : num + " Nevajadzīgs",

    MoreVotes: "Vairāk balsis...",
    LikeThis: "Kā šis",
    LinkToPost: "Saite uz šo ierakstu",
    Report: "Ziņot",
    ReportThisPost: "Ziņot par šo ierakstu",
    Admin: "Admins",
    DiscIx: "Diskusijas saturs",

    Disagree: "Nepiekrīt",
    DisagreeExpl: "Klikšķināt šeit, ja nepiekrīti ar šo ierakstu, vai arī lai brīdinātu citus par kļūdām.",
    Bury: "Aprakt",
    BuryExpl: "Klikšķināt, lai sakārtotu pārējos ierakstus pirms šī ieraksta. Tikai foruma komanda var redzēt tavu balsi.",
    Unwanted: "Nevajadzīgs",
    UnwantedExpl: "Ja nevēlies, lai šis ieraksts atrodas lapā. Tas samazinātu manu ticību " +
            "šī ieraksta autoram. Tikai foruma komanda var redzēt tavu balsi.",

    AddTags: "Pievienot/noņemt tagus",
    UnWikify: "Un-Wikify",
    Wikify: "Wikify",
    PinDeleteEtc: "Piespraust / Dzēst / Sadaļa ...",
  },


  // Share dialog

  sd: {
    Copied: "Nokopēts.",
    CtrlCToCopy: "Spied CTRL+C, lai nokopētu.",
    ClickToCopy: "Klikšķini, lai nokopētu saiti.",
  },


  // Chat

  c: {
    About_1: "Šis ir ",
    About_2: "čata kanāls, ko izveidoja ",
    ScrollUpViewComments: "Skrollē uz augšu, lai redzētu vecākus komentārus",
    Purpose: "Mērķis:",
    edit: "labot",
    'delete': "dzēst",
    MessageDeleted: "(ziņa dzēsta)",
    JoinThisChat: "Pievienoties šim čatam",
    PostMessage: "Publicēt ziņu",
    AdvancedEditor: "Papildināts rediģētājs",
    TypeHere: "Raksti šeit. Vari izmantot Markdown un HTML.",
  },


  // My Menu

  mm: {
    NeedsReview: "Nepieciešams pārskats ",
    AdminHelp: "Admina palīdzība ",
    StaffHelp: "Komandas palīdzība ",
    DraftsEtc: "Melnraksti, grāmatzīmes, uzdevumi",
    MoreNotfs: "Skatīt visus paziņojumus",
    DismNotfs: "Atzīmēt visu kā izlasītu",
    ViewProfile: "Skatīt savu profilu",
    ViewGroups: "Skatīt grupas",
    LogOut: "Iziet",
    UnhideHelp: "Parādīt palīdzības ziņojumus",
  },


  // Scroll buttons

  sb: {
    ScrollToC: "Skrollēt uz:",
    Scroll: "Skrollēt",

    // The Back button, and the letter B is a keyboard shortcut.
    // If in your language, "Back" doesn't start with 'B', then instead
    // set Back_1 to '' (empty text), and Back_2 to:  "Back (B)" — and "Back" (but not "B")
    // translated to your language.
    Back_1: "",
    Back_2: "Atpakaļ (A)",
    BackExpl: "Skrollē atpakaļ uz iepriekšējo vietu šajā lapā",

    // These are useful on mobile — then, no keybard with Home (= scroll to top) and End buttons.
    // And, on a keyboard, once you get used to it, it's quite nice to click 1 to go to the
    // top, and 2 to see the first reply, and B to go back, F forward, so on.
    PgTop: "Lapas augša",
    PgTopHelp: "Doties uz lapas augšu. Klaviatūras īsceļš: 1",
    Repl: "Atbildes",
    ReplHelp: "Doties uz atbilžu sadaļu. Īsceļš: 2",
    Progr: "Progress",
    // The Progress section is at the end of the page, and there, things like
    // "Alice changed status to Doing" and "Alise marked this as Done" and "Topic closed by ..."
    // are shown. (And, optionally, comments by staff or the people working with the issue.)
    ProgrHelp: "Doties uz progresa sadaļu. Īsceļš: 3",
    PgBtm: "Lapas leja",
    Btm: "Lejasdaļa",
    BtmHelp: "Doties uz lapas lejasdaļu. Īsceļš: 4",

    // "Keyboard shrotcuts: ..., and B to scroll back"
    Kbd_1: ", un ",
    // then the letter 'B' (regardless of language)
    Kbd_2: " lai skrollētu atpakaļ",
  },


  // Select users dialog
  sud: {
    SelectUsers: "Izvēlēties lietotājus",
    AddUsers: "Pievienot lietotājus",
  },


  // About user dialog

  aud: {
    IsMod: "Ir moderators.",
    IsAdm: "Ir administrators.",
    IsDeld: "Ir deaktivizēts vai dzēsts.",
    ThisIsGuest: "Šis ir viesis, principā var būt jebkurš.",
    ViewInAdm: "Skatīt adminpanelī",
    ViewProfl: "Skatīt profilu",
    ViewComments: "Skatīt citus komentārus",
    RmFromTpc: "Izņemt no tēmas",
    EmAdrUnkn: "Epasta adrese nav zināma — šim viesim netiks paziņots par jaunām atbildēm.",
  },


  // User's profile page

  upp: {
    // ----- Links

    Preferences: "Iestatījumi",
    Invites: "Uzaicinājumi",
    DraftsEtc: "Melnraksti u.tml.",
    About: "Par",
    Privacy: "Privātums",
    Account: "Konts",
    Interface: "Saskarne",

    // ----- Overview stats

    JoinedC: "Pievienojās: ",
    PostsMadeC: "Izveidoti ieraksti: ",
    LastPostC: "Pēdējais ieraksts: ",
    LastSeenC: "Pēdējais apmeklējums: ",
    TrustLevelC: "Uzticamības līmenis: ",

    // ----- Action buttons

    // ----- Profile pic

    UploadPhoto: "Augšupielādēt attēlu",
    ChangePhoto: "Mainīt attēlu",
    ImgTooSmall: "Attēls ir pārāk mazs: minimālais izmērs ir 100 x 100",

    // ----- Activity

    OnlyStaffCanSee: "Tikai komandas biedri var šo redzēt.",
    OnlyMbrsCanSee: "Tikai aktīvi biedri var šo redzēt.",
    Nothing: "Nav nekā, ko rādīt",
    Posts: "Ieraksti",
    NoPosts: "Nav ierakstu.",
    Topics: "Tēmas",
    NoTopics: "Nav tēmu.",

    // ----- User status

    UserBanned: "Šis lietotājs ir bloķēts",
    UserSuspended: (dateUtc: string) => `Šis lietotājs ir bloķēts līdz ${dateUtc} UTC`,
    ReasonC: "Iemesls: ",

    DeactOrDeld: "Ir deaktivizēts vai dzēsts.",
    isGroup: " (grupa)",
    isGuest: " — viesis, var būt jebkurš",
    isMod: " – moderators",
    isAdmin: " – administrators",
    you: "(tu)",

    // ----- Notifications page

    NoNotfs: "Nav paziņojumu",
    NotfsToYouC: "Paziņojumi tev:",
    NotfsToOtherC: (name: string) => `Paziņojumi priekš ${name}:`,
    DefNotfsSiteWide: "Noklusējuma paziņojumi (visā lapā)",
    // The "for" in:  "Noklusējuma paziņojumi (visā lapā) ".
    forWho: "priekš",

    // ----- Drafts Etc page

    NoDrafts: "Nav melnrakstu",
    YourDraftsC: "Tavi melraksti:",
    DraftsByC: (name: string) => `Lietotāja ${name} melnraksti:`,

    // ----- Invites page

    InvitesIntro: "Šeit vari uzaicināt lietotājus pievienoties šai saitei. ",
    InvitesListedBelow: "Zemāk ir ielūgumi, kurus esi jau izsūtījis.",
    NoInvites: "tu vēl nevienu neesi uzaicinājis.",

    InvitedEmail: "Uzaicināts epasts",
    WhoAccepted: "Akceptējušais biedrs",
    InvAccepted: "Uzaicinājums apstiprināts",
    InvSent: "Uzaicinājums nosūtīts",
    JoinedAlready: "Jau pievienojies",

    SendAnInv: "Uzaicināt cilvēkus", // was: "Send an Invite",   MISSING I18N all other langs
    SendInv: "Sūtīt uzaicinājumus",   // MISSING I18N is just "Send invite" (singularis) in all other langs
    SendInvExpl:  // MISSING I18N changed to pluralis
        Mēs nosūtīsim taviem draugiem īsu vēstuli, un viņiem būs jānoklikšķina uz saites " +
        "lai uzreiz pievienotos, bez ienākšanas. " +
        "Viņi kļūs par normāliem lietotājiem (un nevis moderatoriem vai admninistratoriem).",
    //EnterEmail: "Ievadīt epastu(s)",
    InvDone: "Kārtībā, tagad nosūtīšu viņiem epasta vēstuli.",
    NoOneToInv: "Nav neviena, ko uzaicināt.",
    InvNotfLater: "Paziņosim vēlāk, kad būsim viņus ielūguši.",
    AlreadyInvSendAgainQ: "Šie ir jau uzaicināti — varbūt vēlies viņus uzaicināt atkārtoti?",
    InvErr_1: "Radās ",
    InvErr_2: "kļūdas",
    InvErr_3: ":",
    TheseJoinedAlrdyC: "Šie ir jau pievienojušies, līdz ar to netika uzaicināti:",
    ResendInvsQ: "Sūtit uzaicinājumus atkārtoti šiem cilvēkiem? Viņi jau ir uzaicināti.",
    InvAgain: "Uzaicināt atkārtoti",

    // ----- Preferences, About

    AboutYou: "Par tevi",
    WebLink: "Jebkura tava lapa.",

    NotShownCannotChange: "Nerādīt publiski - nevar tikt mainīts.",

    // The full name or alias:
    NameOpt: "Vārds (pēc izvēles)",

    NotShown: "Netiek rādīts publiski.",

    // The username:
    MayChangeFewTimes: "Vari to mainīt tikai dažas reizses.",
    notSpecified: "(nav noteikts)",
    ChangeUsername_1: "Savu lietotājvārdu vari mainīt tikai dažas reizes.",
    ChangeUsername_2: "Pārāk bieža tā mainīšana var mulsināt citus lietotājus — " +
        "viņi vairs nezinās, kā tevi @pieminēt.",

    NotfAboutAll: "Saņemt paziņojumu par katru jaunu ierakstu (kamēr vien netiek izslēgta tēma vai sadaļa)",
    NotfAboutNewTopics: "Saņemt paziņojumus par jaunām tēmām (ja vien nav apklusināta sadaļa)",

    ActivitySummaryEmails: "Aktivitāšu apkopojuma epasti",

    EmailSummariesToGroup:
        "Ja šīs grupas biedri neapmeklē šo vienu, tad pēc noklusējuma sūtīt viņiem e-pastu ar " +
        "populārāko tēmu apkopojumu un citām svarīgām lietām.",
    EmailSummariesToMe:
        "Ja es neapmeklēu šo vietu, sūtīt man e-pastu ar " +
        "populārāko tēmu apkopojumu un citām svarīgām lietām.",

    AlsoIfTheyVisit: "Sūtīt viņiem e-pastus arī tad, ja viņi šeit iegriežas regulāri.",
    AlsoIfIVisit: "Sūtīt man e-pastus arī tad, ja es šeit iegriežos regulāri.",

    HowOftenWeSend: "Cik bieži šādus e-pastu sūtīt?",
    HowOftenYouWant: "Cik bieži tu vēlies šādus e-pastus?",

    // ----- Preferences, Privacy

    HideActivityStrangers_1: "Paslēpt savas nesenās aktivitātes no svešiniekiem un jauniem lietotājiem?",
    HideActivityStrangers_2: "(Izņemot tos, kuri ir bijuši aktīvi jau kādu laiku.)",
    HideActivityAll_1: "Paslēpt savas nesenās aktivitātes no visiem?",
    HideActivityAll_2: "(Izņemot foruma komandas biedrus.)",

    // ----- Preferences, Account

    // About email address:
    EmailAddresses: "Epasta adreses",
    PrimaryDot: "Primārā. ",
    VerifiedDot: "Apstiprināta. ",
    NotVerifiedDot: "Nav apstiprināta. ",
    ForLoginWithDot: (provider: string) => `Ienākšanai ar ${provider}. `,
    MakePrimary: "Uzstādīt kā primāro",
    AddEmail: "Pievienot epasta adresi",
    TypeNewEmailC: "Ievadīt jaunu epasta adresi:",
    MaxEmailsInfo: (numMax: number) => `(Tu nevari pievienot vairāk kā ${numMax} adreses.)`,
    EmailAdded_1: "Pievienots. Tev tika nosūtīta apstiprinājuma vēstule — ",
    EmailAdded_2: "pārbaudi savu epastu.",
    SendVerifEmail: "Sūtīt apstiprinājuma epastu",

    EmailStatusExpl:
        "('Primārā: varat ar to ienākt, kā arī uz to tiek sūtīti paziņojumi. " +
        "'Apstiprināta: ir aktivizēta nosūtītā apstiprinājuma saite.)",

    // Password:
    ChangePwdQ: "Mainīt paroli?",
    CreatePwdQ: "Izveidot paroli?",
    WillGetPwdRstEml: "Saņemsi paroles atiestatīšanas epastu.",
    // This is the "None" in:  "Password: None"
    PwdNone: "Nav",

    // Logins:
    LoginMethods: "Ienākšanas veidi",
    commaAs: ", piemēram: ",

    // One's data:
    YourContent: "Tavs saturs",
    DownloadPosts: "Lejupielādēt ierakstus",
    DownloadPostsHelp: "Izveido JSON failu ar visu tevis publicēto tēmu un komentāru kopijām.",
    DownloadPersData: "Lejupielādēt privātos datus",
    DownloadPersDataHelp: "Izveido JSON failu ar visu tavu privāto datu kopijām, piemēram - tavu vārdu " +
        "(ja ir norādīts) un epasta adresi.",


    // Delete account:
    DangerZone: "Bīstama zona",
    DeleteAccount: "Dzēst kontu",
    DeleteYourAccountQ:
        "Dzēst savu kontu? Tiks aizvākts tavs vārds, aizmirsta epasta adrese, parole un " +
        "jebkādas online identitātes (piemēram - Facebook vai Twitter ienākšanas dati). " +
        "Nevarēsi vairs ienākt - šo darbību nevar atcelt.",
    DeleteUserQ:
        "Dzēst šo lietotāju? Tiks aizvākts vārds, aizmirsta epasta adrese, parole un " +
        "jebkādas online identitātes (piemēram - Facebook vai Twitter ienākšanas dati). " +
        "Šis lietotājs nevarēs vairs ienākt - šo darbību nevar atcelt.",
    YesDelete: "Jā, dzēst",
  },


  // Group profile page
  gpp: {
    GroupMembers: "Grupas biedri",
    NoMembers: "Nav biedru.",
    MayNotListMembers: "Var nerādīt biedrus.",
    AddMembers: "Pievienot biedrus",
    BuiltInCannotModify: "Šī ir iebūvēta grupa; to nav iespējams rediģēt.",
    NumMembers: (num: number) => `${num} biedri`,
    YouAreMember: "Tu esi biedrs.",
    CustomGroupsC: "Īpašas grupas:",
    BuiltInGroupsC: "Iebūvētas grupas:",
    DeleteGroup: "Dzēst šo grupu",
  },


  // Create user dialog

  cud: {
    CreateUser: "Izveidot lietotāju",
    CreateAccount: "Izveidot kontu",
    EmailC: "Epasts:",
    keptPriv: "tiks saglabāts privāti",
    forNotfsKeptPriv: "paziņojumiem par atbildēm, saglabāts privāti",
    EmailVerifBy_1: "Tavu epastu apstiprināja ",
    EmailVerifBy_2: ".",
    UsernameC: "Lietotājvārds:",
    FullNameC: "Pilns vārds:",
    optName: "pēc izvēles",

    OrCreateAcct_1: "Vai ",
    OrCreateAcct_2: "izveidot kontu",
    OrCreateAcct_3: " ar ",
    OrCreateAcct_4: "@lietotājvārds",
    OrCreateAcct_5: " & parole",

    DoneLoggedIn: "Konts izveidots. Tu esi ienācis.",  // COULD say if verif email sent too?
    AlmostDone:
        "Gandrīz jau gatavs! Tev vēl tikai vajag apstiprināt savu epasta adresi. Tev tika " +
        "nosūtīta epasta vēstule. Noklikšķini uz saņemtās saites, lai aktivizētu savu kontu." +
        " Vari aizvērt šo lapu.",
  },


  // Accept terms and privacy policy?

  terms: {
    TermsAndPrivacy: "Nosacījumi un Privātums",

    Accept_1: "Vai piekrīti mūsu ",
    TermsOfService: "Noteikumiem",
    TermsOfUse: "Lietošanas Nosacījumiem",
    Accept_2: " un ",
    PrivPol: "Privātuma Politikai",
    Accept_3_User: "?",
    Accept_3_Owner: " vietnes īpašniekiem?",  // (see just below)

    // About "for site owners?" above:
    // That's if someone creates his/her own community, via this software provided as
    // Software-as-a-Service hosting. Then, there is / will-be a bit different
    // Terms-of-Service to agree with, since being a community maintainer/owner, is different
    // (more responsibility) than just signing up to post comments.

    YesAccept: "Jā, es piekrītu",
  },


  // Password input

  pwd: {
    PasswordC: "Parole:",
    StrengthC: "Drošums: ",
    FairlyWeak: "Diezgan vāja.",
    toShort: "par īsu",
    TooShort: (minLength: number) => `Par īsu - jābūt vismaz ${minLength} rakstzīmes garai`,
    PlzInclDigit: "Iekļauj arī vismaz vienu ciparu vai simbolu.",
    TooWeak123abc: "Par vāju - neizmanto tādas paroles kā '12345' vai 'abcde'.",
    AvoidInclC: "Izvairies parolē iekļaut savu vārdu vai epastu, vai to daļas:",
  },


  // Login dialog

  ld: {
    NotFoundOrPrivate: "Lapa nav atrasta vai arī nav pieejas tiesību.",

    // This is if you're admin, and click the Impersonate button to become someone else
    // (maybe to troubleshoot problems with his/her account s/he has asked for help about),
    // and then you, being that other user, somehow happen to open a login dialog
    // (maybe because of navigating to a different part of the site that the user being
    // impersonated cannot access) — then, that error message is shown: You're not allowed
    // to login as *someone else* to access that part of the community, until you've first
    // stopped impersonating the first user. (Otherwise, everything gets too complicated.)
    IsImpersonating: "You're impersonating someone, who might not have access to all parts " +
        "of this website.",

    IfYouThinkExistsThen: "Ja domā, ka lapa pastāv, ienāc kā lietotājs ar pieeju tai. ",
    LoggedInAlready: "(Tu jau esi jau ienācis, bet varbūt ar nepareizu kontu?) ",
    ElseGoToHome_1: "Ja ne, tad vari ",
    ElseGoToHome_2: "doties uz sākumlapu.",

    CreateAcconut: "Izveidot kontu",
    ContinueWithDots: "Turpināt ar ...",
    SignUp: "Reģistrēties",
    LogIn: "Ienākt",
    LogInWithPwd: "Ienākt ar paroli",
    CreateAdmAcct: "Izveidot admina kontu:",
    AuthRequired: "Nepieciešama autorizācija, lai piekļūtu šai saitei",
    LogInToLike: "Ienāc, lai nobalsotu par šo ierakstu",
    LogInToSubmit: "Ienāc un iesūti",
    LogInToComment: "Ienāc, lai uzrakstītu komentāru",
    LogInToCreateTopic: "Ienāc, lai izveidotu tēmu",

    AlreadyHaveAcctQ: "Tev jau ir konts? ",  // MISSING changed "Already have...?" to "You have...?"
    LogInInstead_1: "",
    LogInInstead_2: "Ienākt",   // "Log in" (this is a button)
    LogInInstead_3: "", // "instead"

    NewUserQ: "Jauns lietotājs? ",
    SignUpInstead_1: "",
    SignUpInstead_2: "Reģistrēties",
    SignUpInstead_3: "",

    OrCreateAcctHere: "Vai izveido kontu:",
    OrTypeName: "Vai ievadi savu vārdu:",
    OrLogIn: "Vai ienāc:",
    YourNameQ: "Tavs vārds?",

    BadCreds: "Nepareizs lietotājvārds vai parole",

    UsernameOrEmailC: "Lietotājvārds vai epasts:",
    PasswordC: "Parole:",
    ForgotPwd: "Vai aizmirsi savu paroli?",

    NoPwd: "Tu neesi vēl izvēlējies paroli.",
    CreatePwd: "Izveidot paroli",
  },


  // Flag dialog

  fd: {
    PleaseTellConcerned: "Pastāsti, par vēlies ziņot.",
    ThanksHaveReported: "Paldies par ziņojumu, foruma komanda to izskatīs.",
    ReportComment: "Ziņojuma komentārs",
    // Different reasons one can choose among when reporting a comment:
    OptPersonalData: "Ieraksts satur privātu informāciju, piemēram - īsto vārdu vai epastu.",
    OptOffensive: "Šis ieraksts ir rupjš vai aizskarošs.",
    OptSpam: "Šis ieraksts satur nevajadzīgu reklāmu.",
    OptOther: "Paziņot foruma komandai par šo ierakstu cita iemesla dēļ.",
  },


  // Help message dialog
  help: {
    YouCanShowAgain_1: "Tu vari atkal rādīt palīdzības lapas, ja esi ienācis, " +
        "klik''skinot uz sava vārda un tad uz ",
    YouCanShowAgain_2: "Rādīt palīdzības ziņojumus",
  },


  // Editor

  e: {
    SimilarTopicsC: "Līdzīgas tēmas:",

    //WritingSomethingWarning: "Tu kaut ko raksti?",
    UploadMaxOneFile: "Diemžāl pašlaik vienlaicīgi tu vari augšupielādēt tikai vienu failu",
    PleaseFinishPost: "Pabeidz rakstīt savu ierakstu",
    PleaseFinishChatMsg: "Pabeidz rakstīt savu čata ziņu",
    PleaseFinishMsg: "Pabeidz vispirms savu ziņu",
    PleaseSaveEdits: "Pabeidz savu iesākto labojumu",
    PleaseSaveOrCancel: "Vispirms saglabā vai atcel savu jauno tēmu",
    CanContinueEditing: "Vari turpināt rediģēt savu tekstu, atverot rediģētāju no jauna.",
        //"(But the text will currently be lost if you leave this page.)",
    PleaseDontDeleteAll: "Neizdzēs visu tekstu, ieraksti kaut ko.",
    PleaseWriteSth: "Ieraksti kaut ko.",
    PleaseWriteTitle: "Ieraksti tēmas nosaukumu.",
    PleaseWriteMsgTitle: "Ieraksti ziņas nosaukumu.",
    PleaseWriteMsg: "Raksti ziņu.",

    exBold: "treknrakstā",
    exEmph: "ar pasvītrojumu ,
    exPre: "iepriekš formatēts",
    exQuoted: "citēts",
    ExHeading: "Virsraksts",

    TitlePlaceholder: "Ievadi nosaukumu - īsumā, par ko būs šī tēma?",

    EditPost_1: "Labot ",
    EditPost_2: "ieraksts ",

    TypeChatMsg: "Ievadi čata ziņu:",
    YourMsg: "Tava ziņa:",
    CreateTopic: "Izveidot jaunu tēmu",
    CreateCustomHtml: "Izveidot pielāgotu HTML lapu (pievienot savu <h1> nosaukumu)",
    CreateInfoPage: "Izveidot info lapu",
    CreateCode: "Izveidot izejas koda lapu",
    AskQuestion: "Uzdot jautājumu",
    ReportProblem: "Ziņot par kļūdu vai problēmu",
    SuggestIdea: "Ierosināt ideju",
    NewChat: "Jaunā čata kanāla nosaukums un mērķis",
    NewPrivChat: "Jaunā privātā čata nosaukums un mērķis",
    AppendComment: "Pievieno komentāru lapas lejasdaļā:",

    ReplyTo: "Atbildēt uz ",
    ReplyTo_theOrigPost: "oriģinālais ieraksts",
    ReplyTo_post: "ieraksts ",

    PleaseSelectPosts: "Izvēlies vienu vai vairākus ierakstus, uz kuriem atbildēt.",

    Save: "Saglabāt",
    edits: "izmaiņas",

    PostReply: "Ieraksta atbilde",

    Post: "Ieraksts",
    comment: "komentārs",
    question: "jautājums",

    PostMessage: "Publicēt ziņu",
    SimpleEditor: "Vienkāršs rediģētājs",

    Send: "Sūtīt",
    message: "ziņu",

    Create: "Izveidot",
    page: "lapu",
    chat: "čatu",
    idea: "ideju",
    topic: "tēmu",

    Submit: "Publicēt",
    problem: "problēmu",

    ViewOldEdits: "Skatīt iepriekšējos labojumus",

    UploadBtnTooltip: "Augšupielādēt failu vai attēlu",
    BoldBtnTooltip: "Pārveidot tekstu treknrakstā",
    EmBtnTooltip: "Pasvītrojums",
    QuoteBtnTooltip: "Citāts",
    PreBtnTooltip: "Iepriekš formatēts teksts",
    HeadingBtnTooltip: "Virsraksts",

    TypeHerePlaceholder: "Raksti šeit - vari izmantot Markdown and HTML. Ievelc un atlaid attēlus, lai iekopētu tos.",

    Maximize: "Maksimizēt",
    ToNormal: "Atpakaļ uz normālu",
    TileHorizontally: "Izkārtojums horizontāli",

    PreviewC: "Priekšskatījums:",
    TitleExcl: " (izņemot nosaukumu)",
    ShowEditorAgain: "Rādīt atkal rediģētāju",
    Minimize: "Minimizēt",

    IPhoneKbdSpace_1: "(Šis pelēkais laukums ir rezervēts ",
    IPhoneKbdSpace_2: "iPhone klaviatūrai.)",

    PreviewInfo: "Te vari apskatīties, kā tavs ieraksts izskatīsies pēc publicēšanas.",
    CannotType: "Te nav iespējams neko ievadīt.",

    LoadingDraftDots: "Tiek atvērts melnraksts...",
    DraftUnchanged: "Bez izmaiņām.",
    CannotSaveDraftC: "Nevar saglabāt melnrakstu.",
    DraftSaved: (nr: string | number) => `Melnraksts ${nr} saglabāts.`,
    DraftDeleted: (nr: string | number) => `Melnraksts ${nr} izdzēsts.`,
    WillSaveDraft: (nr: string | number) => `Melnraksts ${nr} tiks saglabāts ...`,
    SavingDraft: (nr: string | number) => `Saglabā melnrakstu ${nr} ...`,
    DeletingDraft: (nr: string | number) => `Dzēš melnrakstu ${nr} ...`,
  },


  // Select category dropdown

  scd: {
    SelCat: "Izvēlēties sadaļu",
  },

  // Page type dropdown

  pt: {
    SelectTypeC: "Izvēlēties tēmas tipu:",
    DiscussionExpl: "Diskusija par kaut ko.",
    QuestionExpl: "Viena no atbildēm var tikt atzīmēta kā apstiprināta atbilde.",
    ProblExpl: "Ja kaut kas ir salūzis vai nestrādā; var atzīmēt kā izlabotu/atrisinātu.",
    IdeaExpl: "Ieteikums; var atzīmēt kā pabeigtu/iestrādātu.",
    ChatExpl: "Iespējama nebeidzama saruna.",
    PrivChatExpl: "Redzams tikai uzaicinātiem lietotājiem.",

    CustomHtml: "Pielāgota HTML lapa",
    InfoPage: "Info lapa",
    Code: "Kods",
    EmbCmts: "Iegulti komentāri",
    About: "Par",
    PrivChat: "Privāts čats",
    Form: "Forma",
  },


  // Join sub community dialog

  jscd: {
    NoMoreToJoin: "Nav citu kopienu.",
    SelCmty: "Izvēlēties kopienu ...",
  },


  // Search dialogs and the search page.

  s: {
    TxtToFind: "Meklējamais teksts",
  },


  // No internet

  ni: {
    NoInet: "Nav pieslēguma",
    PlzRefr: "Ielādēt lapu atkārtoti, lai redzētu pēdējās izmaiņas (bija atslēgšanās).",
    RefrNow: "Pārlādēt",
  },


  PostDeleted: (postNr: number) => `Ieraksts nr ${postNr} ir ticis izdzēsts.`,
  NoSuchPost: (postNr: number) => `Šajā tēmā nav ieraksta nr ${postNr}.`,
  NoPageHere: "Šī lapa ir izdzēsta vai nekad nav eksistējusi, vai arī jums nav tai pieejas.",
  GoBackToLastPage: "Doties atpakaļ uz iepriekšējo lapu",

};


