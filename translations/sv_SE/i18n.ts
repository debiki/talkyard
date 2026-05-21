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

var t_sv_SE: TalkyardTranslations = t = {

  // A single or a few words, sorted alphabetically, to reuse everywhere.

  Active: "Aktiva",
  Activity: "Aktivitet",
  Add: "Lägg till",
  AddingDots: "Lägger till ...",
  Admin: "Admin",
  AdvSearch: "Avancerad sökning",
  Away: "Borta",
  Back: "Tillbaks",
  BlogN: "Blogg",
  Bookmarks: "Bokmärken",
  Cancel: "Ångra",
  Categories: "Kategorier",
  Category: "Kategori",
  ChangeV: "Ändra",
  Continue: "Fortsätt",
  ClickToShow: "Tryck för att visa",
  ChangeDots: "Ändra ...",
  ChatN: "Chatt",
  Chatting: "Chattar",
  CheckYourEmail: "Kolla din mejl",
  Close: "Stäng",
  closed: "Stängd",
  Created: "Skapad",
  Delete: "Ta bort",
  Deleted: "Borttagen",
  DirectMessage: "Direktmeddelande",
  Discussion: "Diskussion",
  discussion: "diskussion",
  done: "klart",
  EditV: "Editera",
  Editing: "Editerar",
  EmailAddress: "Meljadress",
  EmailAddresses: "Mejladresser",
  EmailSentD: "Mejl skickat.",
  Forum: "Forum",
  GetNotifiedAbout: "Bli notifierad om",
  GroupsC: "Grupper:",
  Hide: "Göm",
  Home: "Hem",
  Idea: "Idé",
  Join: "Gå med",
  KbdShrtcsC: "Tangentbordsgenvägar: ",
  Loading: "Laddar...",
  LoadMore: "Mer ...",
  LogIn: "Logga in",
  LoggedInAs: "Inloggad som ",
  LogOut: "Logga ut",
  Maybe: "Kanske",
  Manage: "Hantera",
  Members: "Medlemmar",
  MessageN: "Meddelande",
  MoreDots: "Mer...",
  Move: "Flytta",
  Name: "Namn",
  NameC: "Namn:",
  NewTopic: "Nytt ämne",
  NoCancel: "Nej, ångra",
  Notifications: "Notifieringar",
  NotImplemented: "(Inte implementerat)",
  NotYet: "Inte än",
  NoTitle: "Ingen titel",
  NoTopics: "Inga ämnen.",
  Okay: "Okej",
  OkayDots: "Okej ...",
  Online: "Online",
  onePerLine: "en per rad",
  PreviewV: "Förhandsgranska",
  Problem: "Problem",
  progressN: "förlopp",
  Question: "Fråga",
  Recent: "Senaste",
  Remove: "Ta bort",
  Reopen: "Öppna",
  ReplyV: "Svara",
  Replying: "Svarar",
  Replies: "Svar",
  replies: "svar",
  Save: "Spara",
  SavingDots: "Sparar ...",
  SavedDot: "Sparat.",
  Search: "Sök",
  SendMsg: "Skicka Meddelande",
  ShowPreview: "Förhandsgranska",
  SignUp: "Gå med",
  Solution: "Lösning",
  started: "Påbörjat",
  Summary: "Sammanfattning",
  Submit: "Skicka",
  Tag: "Tagg",
  Tags: "Tagsar",
  Tools: "Verktyg",
  Topics: "Ämnen",
  TopicTitle: "Ämnenstitel",
  TopicType: "Ämnestyp",
  UploadingDots: "Laddar upp...",
  Username: "Användarnamn",
  Users: "Medlemmar",
  Welcome: "Välkommen",
  Wiki: "Wiki",
  Yes: "Ja",
  YesBye: "Ja, hej då",
  YesDoThat: "Ja, gör det",
  You: "Du",
  you: "du",

  // Trust levels.
  Guest:  "Gäst",
  NewMember: "Ny medlem",
  BasicMember: "Grundmedlem",
  FullMember: "Full medlem",
  TrustedMember: "Betrodd medlem",
  RegularMember: "Betrodd reguljär",
  CoreMember: "Kärnmedlem",

  // Periods.
  PastDay: "Senaste Dagen",
  PastWeek: "Senaste Veckan",
  PastMonth: "Senaste Månaden",
  PastQuarter: "Senaste Kvartalet",
  PastYear: "Senaste Året",
  AllTime: "All Tid",

  // Time ago letters.
  // English examples: "3d" in forum topic list means 3 days ago. "5h" is 5 hours.
  monthsLtr: "mån",  // months
  daysLtr: "d",      // days
  hoursLtr: "t",     // hours
  minsLtr: "m",      // minutes
  secsLtr: "s",      // seconds

  // Time ago, long text versions.
  daysAgo: (numDays: number) =>
    numDays === 1 ? "1 dag sedan" : `${numDays} dagar sedan`,

  hoursAgo: (numHours: number) =>
    numHours === 1 ? "1 timme sedan" : `${numHours} timmar sedan`,

  minutesAgo: (numMins: number) =>
    numMins === 1 ? "1 minut sedan" : `${numMins} minuter sedan`,

  secondsAgo: (numSecs: number) =>
    numSecs === 1 ? "1 sekund sedan" : `${numSecs} sekunder sedan`,


  // Input fields, e.g. email, name etc.

  inp: {
    // Email address input field:
    EmReq: "E-post krävs",
    NoSpcs: "Inga mellanslag tack",
    InvldAddr: "Inte en giltig e-postadress",
    NoBadChrs: "Inga konstiga tecken tack",

    // Full name input field:
    NotOnlSpcs: "Inte bara mellanslag tack",
    NoAt: "Inga @ tack",

    // Username input field:
    NoDash: "Inga bindestreck (-) tack",
    DontInclAt: "Inkludera inte @",
    StartEndLtrDgt: "Börja och sluta med en bokstav eller siffra",
    OnlLtrNumEtc: "Endast bokstäver (a-z, A-Z), siffror och _ (understreck)",
    // This shown just below the username input:
    UnUnqShrt_1: "Ditt ",
    UnUnqShrt_2: "@användarnamn",
    UnUnqShrt_3: ", unikt och kort",

    // Generic messages for all input fields:
    TooShort: (minLength: number) => `Ska vara minst ${minLength} tecken`,
    TooLong: (maxLength: number) => `För långt. Får vara max ${maxLength} tecken`,
  },


  // Notification levels.

  nl: {
    EveryPost: "Varje inlägg",
    EveryPostInTopic: "Du blir notifierad om alla nya svar i det här ämnet.",
    EveryPostInCat: "Du blir notifierad om alla nya ämnen och svar i den här kategorin.",
    EveryPostInTopicsWithTag: "Du blir notifierad om nya ämnen med den här taggen, och alla svar i dessa ämnen.",
    EveryPostWholeSite: "Du blir notifierad om alla nya ämnen och svar, var som helst.",

    // One will be notified about the *first* post in a new topic, only. That is, the Original Post
    // (that's what the first post is called, in a discussion forum topic).
    NewTopics: "Nya ämnen",
    NewTopicsInCat: "Du blir notifierad om nya ämnen i den här kategorin.",
    NewTopicsWithTag: "Du blir notifierad om nya ämnen med den här taggen.",
    NewTopicsWholeSite: "Du blir notifierad om nya ämnen, var som helst.",

    Tracking: "Spårar",

    Normal: "Normal",
    NormalDescr: "Du blir notifierad om någon pratar med dig, även indirekt, t.ex. ett " +
      "svar på ett svar till dig.",
    //NormalTopic_1: "You'll be notified if someone talks to you, or mentions your ",
    //NormalTopic_2: "@name",

    Hushed: "Dämpad",
    HushedDescr: "Du blir notifierad endast om någon pratar direkt med dig.",

    Muted: "Tystad",
    MutedTopic: "Inga notifieringar.",
  },


  // Forum intro text

  fi: {
    Edit: "Ändra",
    Hide_1: "Göm",
    Hide_2: ", klicka på ",
    Hide_3: " för att öppna igen",
  },


  // Forum categories

  fcs: {
    All: "Alla", // "All (categories)", shorter than AllCats
  },


  // Forum buttons

  fb: {

    TopicList: "Ämneslista",

    // Select category dropdown

    from: "från",
    in: "i",
    AllCats: "Alla kategorier",

    // Topic sort order

    Active: "Aktiva först",
    ActiveDescr: "Visar nyligen aktiva samtalsämnen först",

    New: "Nya",
    NewDescr: "Visar nyligen skapade ämnen först",

    Top: "Populära",
    TopDescr: "Visar populära ämnen först",

    // Topic filter dropdown

    AllTopics: "Alla ämnen",

    ShowAllTopics: "Visa alla ämnen",
    ShowAllTopicsDescr: "Dock inte raderade ämnen",

    WaitingTopics: "Väntande ämnen",
    OnlyWaitingDescr_1: "Visar bara ämnen som ",
    OnlyWaitingDescr_2: "väntar ",
    OnlyWaitingDescr_3: "på ett svar eller på att bli implementerade och gjorda",

    YourTopics: "Dina ämnen",
    AssignedToYou: "Tilldelade till dig",

    DeletedTopics: "Raderade ämnen",
    ShowDeleted: "Visa raderade",
    ShowDeletedDescr: "Visar alla ämnen, även raderade ämnen",

    // Rightmost buttons

    ViewCategories: "Visa kategorier",
    EditCat: "Editera Kategori",
    CreateCat: "Skapa Kategori",
    CreateTopic: "Skapa Ämne",
    PostIdea: "Posta en idé",
    AskQuestion: "Fråga något",
    ReportProblem: "Rapportera ett problem",
    CreateMindMap: "Skapa en Mind Map",
    CreatePage: "Skapa en sida",

  },


  // Forum topic list

  ft: {
    ExplIcons: "Förklara ikoner ...",
    IconExplanation: "Ikonförklaring:",
    ExplGenDisc: "En allmän diskussion.",
    ExplQuestion: "En fråga utan accepterat svar.",
    ExplAnswer: "En fråga med ett accepterat svar.",
    ExplIdea: "En idé / ett förslag.",
    ExplProblem: "Ett problem.",
    ExplPlanned: "Något vi planerar att göra eller fixa.",
    ExplDone: "Något som har gjorts eller fixats.",
    ExplClosed: "Ämnet är stängt.",
    ExplPinned: "Ämnet visas alltid först (kanske bara i sin egen kategori).",

    PopularTopicsComma: "Populära ämnen, ",
    TopFirstAllTime: "Visar de mest populära ämnena först, genom tiderna.",
    TopFirstPastDay: "Visar ämnen som varit populära det senaste dygnet.",

    CatHasBeenDeleted: "Den här kategorin har tagits bort",

    TopicsActiveFirst: "Ämnen, nyligen aktiva först",
    TopicsNewestFirst: "Ämnen, nya först",

    CreatedOn: "Skapat ",
    LastReplyOn: "\nSenaste svaret ",
    EditedOn: "\nÄndrat ",

    // These are shown as mouse-hover tooltips, or mobile-phone-touch-tips, over the user
    // avatar icons, in the forum topic list.
    createdTheTopic: "skapade ämnet",
    frequentPoster: "har skrivit mycket",
    mostRecentPoster: "senaste repliken",

    inC: "i: ",

    TitleFixed: "Detta har fixats",
    TitleDone: "Detta har gjorts",
    TitleStarted: "Har påbörjats",
    TitleStartedFixing: "Har börjat fixa",
    TitleUnsolved: "Detta är ett olöst problem",
    TitleIdea: "Detta är en ide",
    TitlePlanningFix: "Vi planerar att fixa detta",
    TitlePlanningDo: "Vi planerar att göraa detta",
    TitleChat: "Detta är en chatt",
    TitlePrivateChat: "Detta är en privat chatt",
    TitlePrivateMessage: "Detta är ett privat meddelande",
    TitleInfoPage: "Detta är en informationssida",
    TitleDiscussion: "Ett samtal",
    IsPinnedGlobally: "\nFastnålat, så visas först.",
    IsPinnedInCat: "\nFastnålat i sin kategori, så visas först, där.",
  },


  // Forum categories list

  fc: {
    RecentTopicsWaiting: "Senaste ämnena (som väntar på svar)",
    RecentTopicsInclDel: "Senaste ämnena (inkl. borttagna)",
    RecentTopics: "Senaste ämnena",
    _replies: " svar",
    _deleted: " (borttaget)",
    _defCat: " (default kategori)",
  },


  // Topbar

  // Shown at the top of the page. Includes login and signup buttons, or one's username menu.

  tb: {

    // Opens the right hand sidebar and litst the most recent posts in the current topic.
    RecentPosts: "Senaste replikerna",

    // Open right-hand-sidebar button tooltip, if mouse-hovering online-user-count.
    NumOnlChat: " online i denna chatt",    // example: "5 online in this chat"
    NumOnlForum: " online i detta forum",

    // Open left-sidebar button title.
    WatchbBtn: "Dina ämnen",

    // Tooltip, shown if mouse-hovering the open-left-sidebar button.
    WatchbToolt: "Dina ämnen, chattar, direkta meddelanden",

    // Title shown on user profile pages.
    AbtUsr: "Om hen",

    // Shortcuts to leave the user profile page, or staff area, and go back to the discussion topics.
    BackFromUsr: "Tillbaks från hens profil",
    BackFromAdm: "Tillbaks från Admin Area",

    // Title shown on full text search page.
    SearchPg: "Söksida",
  },


  // Watchbar (the sidebar to the left)

  wb: {
    AddCommunity: "Lägg till ...",
    RecentlyViewed: "Nyss besökt",
    JoinedChats: "Dina chattar",
    ChatChannels: "Chattkanaler",
    CreateChat: "Skapa chat",
    DirectMsgs: "Direkta meddelanden",
    NoChats: "Inget",    // meaning: "No chat messages"
    NoDirMsgs: "Inget",  // meaning: "No direct messages"

    // The click-topic dropdown menu:
    TopicActions: "Ämnesåtgärder",
    ViewPeopleHere: "Se vilka som är här",
    ViewAddRemoveMembers: "Visa / lägg till / ta bort medlemmar",
    ViewChatMembers: "Visa chattmedlemmar",
    EditChat: "Ändra chattens titel och syfte",
    LeaveThisChat: "Lämna chatten",
    LeaveThisCommunity: "Lämna denna community",
    JoinThisCommunity: "Gå med i denna community",
  },


  // Contextbar (the sidebar to the right)

  cb: {
    RecentComments: "Senaste inläggen i detta ämnet:",
    NoComments: "Inget.",

    YourBookmarks: "Dina bokmärken:",

    UsersOnline: "Folk online:",
    UsersOnlineForum: "Folk online i detta forum:",
    UsersInThisChat: "Folk i chatten:",
    UsersInThisTopic: "Folk i detta samtal:",

    GettingStartedGuide: "Kom igång-guide",
    AdminGuide: "Adminguide",
    Guide: "Guide",

    // How to hide the sidebar.
    CloseShortcutS: "Stäng (genväg: 'S')",

    // ----- Online users list / Users in current topic

    AddPeople: "Lägg till fler",

    // Shown next to one's own username, in a list of users.
    thatsYou: "det är du",

    // Info about which people are online.
    // Example, in English: "Online users: You, and 5 people who have not logged in"
    OnlyYou: "Bara du, tycks det",
    YouAnd: "Du, och ",
    NumStrangers: (numStrangers: number) => {
      const people = numStrangers === 1 ? "en annan" : `${numStrangers} andra`;
      return people + " som inte har loggat in";
    },

    // ----- Recent comments list

    // This explains how the Recent tab in the sidebar works.

    RepliesToTheLeft: "Replikerna till vänster är sorterade ",
    bestFirst: "bäst-först.",
    ButBelow: "Men nedan ",
    insteadBy: " är samma repliker istället sorterade ",
    newestFirst: "nyast-först.",

    SoIfLeave: "Så om du är borta en stund, och kommer tillbaks, så hittar du ",
    allNewReplies: "alla nya repliker, nedanför.",
    Click: "Clicka",
    aReplyToReadIt: " på en replik nedan, för att se hela — " +
        "ty nedan visas endast utdrag.",
  },


  // Change page dialog
  cpd: {
    ClickToChange: "Klicka för att ändra status",
    ClickToViewAnswer: "Klicka för att se svar",
    ViewAnswer: "Visa svar",
    ChangeStatusC: "Ändra status till:",
    ChangeCatC: "Ändra kategori:",
    ChangeTopicTypeC: "Ändra ämnestyp:",
  },


  // Page doing status, PageDoingStatus
  pds: {
    aQuestion: "en fråga",
    hasAccptAns: "har en lösning",
    aProblem: "ett problem",
    planToFix: "planerar fixa",
    anIdea: "en idé",
    planToDo: "planerar göra",
  },


  // Discussion / non-chat page

  d: {
    // These texts are split into parts 1,2 or 1,2,3 ec, because in between the texts,
    // icons are shown, to help people understand what those icons mean.

    ThisFormClosed_1: "Det här formuläret har ",
    // A Topic-has-been-Closed icon shown here, between text parts 1 (just above) and 2 (below).
    ThisFormClosed_2: "stängts; du kan inte längre fylla i och posta det.",

    ThisTopicClosed_1: "Det här ämnet har ",
    // A Topic-has-been-Closed icon, + the text "closed", shown here.
    ThisTopicClosed_2: ". Du kan fortfarande skriva kommentarer.",

    ThisPageDeleted: "Den här sidan har tagits bort",
    CatDeldPageToo: "Kategorin har tagits bort, så den här sidan togs också bort",

    ThreadDeld: "Tråden har tagits bort",
    CmntDeld: "Kommentaren har tagits bort",
    PostDeld: "Inlägget har tagits bort",
    DiscDeld: "Diskussionen har tagits bort",
    PageDeld: "Sidan har tagits bort",
    TitlePendAppr: "Titeln väntar på godkännande",
    TextPendingApproval: "Texten väntar på godkännande",

    TooltipQuestClosedNoAnsw: "Den här frågan har stängts utan något accepterat svar.",
    TooltipTopicClosed: "Det här ämnet är stängt.",

    TooltipQuestSolved: "Det här är en löst fråga",
    TooltipQuestUnsolved: "Det här är en olöst fråga",

    StatusDone: "Klart",
    TooltipProblFixed: "Detta har fixats",
    TooltipDone: "Detta har gjorts",

    StatusStarted: "Påbörjat",
    TooltipFixing: "Vi håller på att fixa detta",
    TooltipImplementing: "Vi håller på att implementera detta",

    StatusPlanned: "Planerat",
    TooltipProblPlanned: "Vi planerar att fixa detta",
    TooltipIdeaPlanned: "Vi planerar att implementera detta",

    StatusNew: "Nytt",
    StatusNewDtl: "Nytt ämne, under diskussion",
    TooltipUnsProbl: "Detta är ett olöst problem",
    TooltipIdea: "Detta är en idé",

    TooltipPersMsg: "Privat meddelande",
    TooltipChat: "# betyder chattkanal",
    TooltipPrivChat: "Det här är en privat chattkanal",

    TooltipPinnedGlob: "\nFastnålat globalt.",
    TooltipPinnedCat: "\nFastnålat i den här kategorin.",

    SolvedClickView_1: "Löst i inlägg #",
    SolvedClickView_2: ", klicka för att se",

    PostHiddenClickShow: "Inlägget är dolt; klicka för att visa",
    ClickSeeMoreRepls: "Visa fler svar",
    ClickSeeMoreComments: "Visa fler kommentarer",
    ClickSeeThisComment: "Klicka för att visa den här kommentaren",
    clickToShow: "klicka för att visa",

    ManyDisagree: "Många håller inte med om detta:",
    SomeDisagree: "Vissa håller inte med om detta:",

    CmtPendAppr: "Kommentaren väntar på godkännande, postad ",
    CmtBelowPendAppr: (isYour) => (isYour ? "Din" : "Kommentaren") + " nedan väntar på godkännande.",

    _and: " och",

    repliesTo: "svarar till",
    InReplyTo: "Svar till",
    YourReplyTo: "Ditt svar till ",
    YourChatMsg: "Ditt chattmeddelande: ",
    YourDraft: "Ditt utkast",
    YourEdits: "Dina redigeringar: ",
    YourProgrNoteC: "Din förloppsanteckning:",
    aProgrNote: "en förloppsanteckning: ",


    ReplyingToC: "Svarar till:",
    ScrollToPrevw_1: "Scrolla till ",
    ScrollToPrevw_2: "förhandsgranskning",

    UnfinEdits: "Påbörjade ändringar",
    ResumeEdting: "Fortsätt skriva",
    DelDraft: "Radera utkast",

    ClickViewEdits: "Klicka för att se gamla ändringar",

    By: "Av ", // ... someones name

    // Discussion ...
    aboutThisIdea: "om hur och om vi ska genomföra denna idé",
    aboutThisProbl: "om hur och om vi ska fixa detta",

    AddProgrNote: "Lägg till förloppsanteckning",
    // Progress ...
    withThisIdea: "med att genomföra denna idé",
    withThisProbl: "med att hantera detta problem",
    withThis: "med att göra detta",
  },


  // Metabar

  // Shown between the original post and all replies.

  mb: {
    NotfsAbtThisC: "Notifieringar om det här ämnet:",

    // If is a direct message topic, members listed below this text.
    Msg: "Meddelande",

    SmrzRepls: "Sammanfatta diskussionen",

    // Don't bother about being correct with "1 reply", "2,3,4 replies".
    // Just write "replies" always instead? (also if only one)

    EstTime: (numReplies: number, minutes: number) =>
        `Det finns ${numReplies} svar. Beräknad lästid: ${minutes} minuter`,

    DoneSummarizing: (numSummarized: number, numShownBefore: number) =>
        `Klart. Sammanfattade ${numSummarized} svar, av de ${numShownBefore} svar som visades tidigare.`,
  },


  // Post actions

  pa: {
    CloseOwnQuestionTooltip: "Stäng den här frågan om du inte behöver ett svar längre.",
    CloseOthersQuestionTooltip: "Stäng den här frågan om den inte behöver ett svar, t.ex. om " +
        "den är off-topic eller redan har besvarats i ett annat ämne.",
    CloseToDoTooltip: "Stäng den här uppgiften om den inte behöver göras eller fixas.",
    CloseTopicTooltip: "Stäng det här ämnet om det inte behöver mer uppmärksamhet.",

    AcceptBtnExpl: "Acceptera detta som svaret på frågan eller problemet",
    SolutionQ: "Lösning?",
    ClickUnaccept: "Klicka för att inte längre acceptera detta svar",
    PostAccepted: "Det här inlägget har accepterats som svaret",

    NumLikes: (num: number) => num + " Gillar",
    NumDisagree: (num: number) => num + " Håller ej med",
    NumBury: (num: number) => num + " Flytta nedåt",
    NumUnwanted: (num: number) => num + " Oönskad",

    MoreVotes: "Fler röster...",
    LikeThis: "Gilla",
    LinkToPost: "Länk till det här inlägget",
    Report: "Anmäl",
    ReportThisPost: "Anmäl detta",
    Admin: "Admin",
    DiscIx: "Andra diskussioner",

    Disagree: "Håller ej med",
    DisagreeExpl: "Klicka här för att visa att du inte håller med, eller för att varna andra om faktabrott.",
    Bury: "Flytta ner",
    BuryExpl: "Klicka för att sortera andra inlägg före det här. Endast forumets personal kan se din röst.",
    Unwanted: "Oönskad",
    UnwantedExpl: "Om du inte vill ha det här inlägget på den här webbplatsen. Detta skulle minska förtroendet jag har " +
            "för författaren. Endast forumets personal kan se din röst.",

    AddTags: "Lägg till/ta bort taggar",
    UnWikify: "Ta bort Wiki-status",
    Wikify: "Gör till Wiki",
    PinDeleteEtc: "Fäst / Ta bort / Kategori ...",
  },


  // Share dialog

  sd: {
    Copied: "Kopierat.",
    CtrlCToCopy: "Tryck på CTRL+C för att kopiera.",
    ClickToCopy: "Klicka för att kopiera länken.",
  },


  // Chat

  c: {
    About_1: "Det här är ",
    About_2: "-chattkanalen, skapad av ",
    ScrollUpViewComments: "Scrolla upp för att se äldre kommentarer",
    Purpose: "Syfte:",
    MessageDeleted: "(Meddelande borttaget)",
    JoinThisChat: "Gå med i denna chatt",
    PostMessage: "Skicka meddelande",
    AdvancedEditor: "Avancerad editor",
    TypeHere: "Skriv här. Du kan använda Markdown och HTML.",
  },


  // My Menu

  mm: {
    NeedsReview: "Behöver granskas ",
    AdminHelp: "Adminhjälp ",
    StaffHelp: "Personalhjälp ",
    DraftsEtc: "Utkast, bokmärken, uppgifter",
    MoreNotfs: "Visa alla notifieringar",
    DismNotfs: "Markera alla som lästa",
    ViewProfile: "Visa din profil",
    ViewGroups: "Visa grupper",
    LogOut: "Logga ut",
    UnhideHelp: "Visa hjälpmeddelanden",
  },


  // Scroll buttons

  sb: {
    ScrollToC: "Scrolla till:",
    Scroll: "Scroll",

    // The Back button, and the letter B is a keyboard shortcut.
    // If in your language, "Back" doesn't start with 'B', then instead
    // set Back_1 to '' (empty text), and Back_2 to:  "Back (B)" — and "Back" (but not "B")
    // translated to your language.
    Back_1: "T",
    Back_2: "illbaka",
    BackExpl: "Scrolla tillbaka till din tidigare position på den här sidan",

    // These are useful on mobile — then, no keybard with Home (= scroll to top) and End buttons.
    // And, on a keyboard, once you get used to it, it's quite nice to click 1 to go to the
    // top, and 2 to see the first reply, and B to go back, F forward, so on.
    PgTop: "Sidans topp",
    PgTopHelp: "Gå till toppen av sidan. Genväg: 1",
    Repl: "Svar",
    ReplHelp: "Gå till svarssektionen. Genväg: 2",
    Progr: "Förlopp",
    // The Progress section is at the end of the page, and there, things like
    // "Alice changed status to Doing" and "Alise marked this as Done" and "Topic closed by ..."
    // are shown. (And, optionally, comments by staff or the people working with the issue.)
    ProgrHelp: "Gå till förloppsektionen. Genväg: 3",
    PgBtm: "Sidans botten",
    Btm: "Botten",
    BtmHelp: "Gå till botten av sidan. Genväg: 4",

    // "Keyboard shrotcuts: ..., and B to scroll back"
    Kbd_1: ", och ",
    // then the letter 'B' (regardless of language)
    Kbd_2: " för att scrolla tillbaka",
  },


  // Select users dialog
  sud: {
    SelectUsers: "Välj användare",
    AddUsers: "Lägg till användare",
  },


  // About user dialog

  aud: {
    IsMod: "Är moderator.",
    IsAdm: "Är administratör.",
    IsDeld: "Är inaktiverad eller borttagen.",
    ThisIsGuest: "Det här är en gästanvändare, kan i själva verket vara vem som helst.",
    ViewInAdm: "Visa i adminområdet",
    ViewProfl: "Visa profil",
    ViewComments: "Visa andra kommentarer",
    RmFromTpc: "Ta bort från ämnet",
    EmAdrUnkn: "E-postadress okänd — den här gästen kommer inte att notifieras om svar.",
  },


  // User's profile page

  upp: {
    // ----- Links

    Preferences: "Inställningar",
    Invites: "Inbjudningar",
    DraftsEtc: "Utkast etc",
    About: "Om dig",
    Privacy: "Integritet",
    Security: "Säkerhet",
    Account: "Konto",
    Interface: "Gränssnitt",

    // ----- Overview stats

    JoinedC: "Gick med: ",
    PostsMadeC: "Inlägg gjorda: ",
    LastPostC: "Senaste inlägget: ",
    LastSeenC: "Senast sedd: ",
    TrustLevelC: "Förtroendenivå: ",

    // ----- Action buttons

    // ----- Profile pic

    UploadPhoto: "Ladda upp bild",
    ChangePhoto: "Byt bild",
    ImgTooSmall: "Bilden är för liten: bör vara minst 100 x 100",

    // ----- Activity

    OnlyStaffCanSee: "Endast personal och betrodda kärnmedlemmar kan se detta.",
    OnlyMbrsCanSee: "Endast personer som har varit aktiva medlemmar ett tag kan se detta.",
    Nothing: "Inget att visa",
    Posts: "Inlägg",
    NoPosts: "Inga inlägg.",
    Topics: "Ämnen",
    NoTopics: "Inga ämnen.",

    // ----- User status

    UserBanned: "Den här användaren är bannlyst",
    UserSuspended: (dateUtc: string) => `Den här användaren är avstängd till ${dateUtc} UTC`,
    ReasonC: "Anledning: ",

    DeactOrDeld: "Har inaktiverats eller tagits bort.",
    isGroup: " (en grupp)",
    isGuest: " — en gästanvändare, kan vara vem som helst",
    isMod: " – moderator",
    isAdmin: " – administratör",
    you: "(du)",

    // ----- Notifications page

    NoNotfs: "Inga notifieringar",
    NotfsToYouC: "Notifieringar till dig:",
    NotfsToOtherC: (name: string) => `Notifieringar till ${name}:`,
    DefNotfsSiteWide: "Standardnotifieringar, för hela webbplatsen",
    // The "for" in:  "Default notifications, site wide, for (someone's name)".
    forWho: "för",

    // ----- Drafts Etc page

    NoDrafts: "Inga utkast",
    YourDraftsC: "Dina utkast:",
    DraftsByC: (name: string) => `Utkast av ${name}:`,

    // ----- Invites page

    InvitesIntro: "Här kan du bjuda in folk till den här webbplatsen. ",
    InvitesListedBelow: "Inbjudningar som du redan har skickat visas nedan.",
    NoInvites: "Du har inte bjudit in någon än.",

    InvitedEmail: "Inbjuden e-post",
    WhoAccepted: "Medlem som accepterade",
    InvAccepted: "Inbjudan accepterad",
    InvSent: "Inbjudan skickad",
    JoinedAlready: "Har redan gått med",

    SendAnInv: "Bjud in folk",
    SendInv: "Skicka inbjudningar",
    SendInvExpl:
        "Vi skickar ett kort mejl till dina vänner. De kan klicka på en länk " +
        "för att gå med direkt, inget inlogg krävs. " +
        "De blir vanliga medlemmar, inte moderatorer eller administratörer.",
    //EnterEmail: "Enter email(s)",
    InvDone: "Klart. Jag skickar ett mejl till dem.",
    NoOneToInv: "Ingen att bjuda in.",
    InvNotfLater: "Jag meddelar dig senare när jag har bjudit in dem.",
    AlreadyInvSendAgainQ: "Dessa har redan bjudits in — kanske vill du bjuda in dem igen?",
    InvErr_1: "Dessa resulterade i ",
    InvErr_2: "fel",
    InvErr_3: ":",
    TheseJoinedAlrdyC: "Dessa har redan gått med, så jag bjöd inte in dem:",
    ResendInvsQ: "Skicka inbjudningar igen till dessa personer? De har redan bjudits in.",
    InvAgain: "Bjud in igen",

    // ----- Preferences, About

    AboutYou: "Om dig",
    WebLink: "Webbplats eller sida du har.",

    NotShownCannotChange: "Visas inte offentligt. Kan inte ändras.",

    // The full name or alias:
    NameOpt: "Namn (valfritt)",

    NotShown: "Visas inte offentligt.",

    // The username:
    MayChangeFewTimes: "Du kan bara ändra det ett fåtal gånger.",
    notSpecified: "(inte angivet)",
    ChangeUsername_1: "Du kan bara ändra ditt användarnamn ett fåtal gånger.",
    ChangeUsername_2: "Att ändra det för ofta kan göra andra förvirrade — " +
        "de kommer inte att veta hur de ska @nämna dig.",

    NotfAboutAll: "Bli notifierad om varje nytt inlägg (om du inte tystar ämnet eller kategorin)",
    NotfAboutNewTopics: "Bli notifierad om nya ämnen (om du inte tystar kategorin)",

    ActivitySummaryEmails: "E-post med sammanfattning av aktivitet",

    EmailSummariesToGroup:
        "När medlemmar i den här gruppen inte besöker webbplatsen, skicka då som standard e-post till dem " +
        "med sammanfattningar av populära ämnen och annat.",
    EmailSummariesToMe:
        "När jag inte besöker webbplatsen, skicka e-post till mig " +
        "med sammanfattningar av populära ämnen och annat.",

    AlsoIfTheyVisit: "Skicka e-post till dem även om de besöker webbplatsen regelbundet.",
    AlsoIfIVisit: "Skicka e-post till mig även om jag besöker webbplatsen regelbundet.",

    HowOftenWeSend: "Hur ofta ska vi skicka dessa mejl?",
    HowOftenYouWant: "Hur ofta vill du ha dessa mejl?",

    // ----- Preferences, Privacy

    HideActivityStrangers_1: "Dölja din senaste aktivitet för främlingar och nya medlemmar?",
    HideActivityStrangers_2: "(Men inte för de som har varit aktiva medlemmar ett tag.)",
    HideActivityAll_1: "Dölja din senaste aktivitet för alla?",
    HideActivityAll_2: "(Förutom personal och betrodda kärnmedlemmar.)",

    // ----- Preferences, Account

    // About email address:
    EmailAddresses: "E-postadresser",
    PrimaryDot: "Primär. ",
    VerifiedDot: "Verifierad. ",
    NotVerifiedDot: "Ej verifierad. ",
    ForLoginWithDot: (provider: string) => `För inloggning med ${provider}. `,
    MakePrimary: "Gör till primär",
    AddEmail: "Lägg till e-postadress",
    TypeNewEmailC: "Skriv en ny e-postadress:",
    MaxEmailsInfo: (numMax: number) => `(Du kan inte lägga till mer än ${numMax} adresser.)`,
    EmailAdded_1: "Tillagd. Vi har skickat ett verifieringsmejl till dig — ",
    EmailAdded_2: "kolla din inkorg.",
    SendVerifEmail: "Skicka verifieringsmejl",

    EmailStatusExpl:
        "('Primär' betyder att du kan logga in via denna adress, och vi skickar notifieringar till den. " +
        "'Verifierad' betyder att du klickade på en verifieringslänk i ett mejl.)",

    // Password:
    ChangePwdQ: "Byta lösenord?",
    CreatePwdQ: "Skapa lösenord?",
    WillGetPwdRstEml: "Du kommer att få ett mejl för att återställa lösenordet.",
    // This is the "None" in:  "Password: None"
    PwdNone: "Inget",

    // Logins:
    LoginMethods: "Inloggningsmetoder",
    commaAs: ", som: ",

    // One's data:
    YourContent: "Ditt innehåll",
    DownloadPosts: "Ladda ner inlägg",
    DownloadPostsHelp: "Skapar en JSON-fil med en kopia av ämnen och kommentarer du har postat.",
    DownloadPersData: "Ladda ner personuppgifter",
    DownloadPersDataHelp: "Skapar en JSON-fil med en kopia av dina personuppgifter, t.ex. ditt namn " +
        "(om du har angett ett namn) och e-postadress.",


    // Delete account:
    DangerZone: "Farozon",
    DeleteAccount: "Ta bort konto",
    DeleteYourAccountQ:
        "Ta bort ditt konto? Vi tar bort ditt namn, glömmer din e-postadress, lösenord och " +
        "alla online-identiteter (som Facebook- eller Twitter-inloggning). " +
        "Du kommer inte att kunna logga in igen. Detta kan inte ångras.",
    DeleteUserQ:
        "Ta bort den här användaren? Vi tar bort namnet, glömmer e-postadressen, lösenordet och " +
        "online-identiteter (som Facebook- eller Twitter-inloggning). " +
        "Användaren kommer inte att kunna logga in igen. Detta kan inte ångras.",
    YesDelete: "Ja, ta bort",
  },


  // Group profile page
  gpp: {
    GroupMembers: "Gruppmedlemmar",
    NoMembers: "Inga medlemmar.",
    MayNotListMembers: "Får inte lista medlemmar.",
    AddMembers: "Lägg till medlemmar",
    BuiltInCannotModify: "Det här är en inbyggd grupp; den kan inte ändras.",
    NumMembers: (num: number) => `${num} medlemmar`,
    YouAreMember: "Du är medlem.",
    CustomGroupsC: "Anpassade grupper:",
    BuiltInGroupsC: "Inbyggda grupper:",
    DeleteGroup: "Ta bort den här gruppen",
  },


  // Create user dialog

  cud: {
    CreateUser: "Skapa användare",
    CreateAccount: "Skapa konto",
    EmailC: "E-post:",
    keptPriv: "kommer att hållas privat",
    forNotfsKeptPriv: "för svarsnotifieringar, hålls privat",
    EmailVerifBy_1: "Din e-post har verifierats av ",
    EmailVerifBy_2: ".",
    UsernameC: "Användarnamn:",
    FullNameC: "Fullständigt namn:",
    optName: "valfritt",

    //OrCreateAcct_1: "Or ",
    //OrCreateAcct_2: "create an account",
    //OrCreateAcct_3: " with ",
    //OrCreateAcct_4: "@username",
    //OrCreateAcct_5: " & password",

    DoneLoggedIn: "Kontot har skapats. Du har loggats in.",  // COULD say if verif email sent too?
    AlmostDone:
        "Nästan klar! Du behöver bara bekräfta din e-postadress. Vi har " +
        "skickat ett mejl till dig. Klicka på länken i mejlet för att aktivera " +
        "ditt konto. Du kan stänga den här sidan.",
  },


  // Accept terms and privacy policy?

  terms: {
    TermsAndPrivacy: "Villkor och integritet",

    Accept_1: "Accepterar du våra ",
    TermsOfService: "Användarvillkor",
    TermsOfUse: "Användarvillkor",
    Accept_2: " och vår ",
    PrivPol: "Integritetspolicy",
    Accept_3_User: "?",
    Accept_3_Owner: " för webbplatsägare?",  // (see just below)

    // About "for site owners?" above:
    // That's if someone creates his/her own community, via this software provided as
    // Software-as-a-Service hosting. Then, there is / will-be a bit different
    // Terms-of-Service to agree with, since being a community maintainer/owner, is different
    // (more responsibility) than just signing up to post comments.

    YesAccept: "Ja, jag accepterar",
  },


  // Password input

  pwd: {
    PasswordC: "Lösenord:",
    StrengthC: "Styrka: ",
    FairlyWeak: "Ganska svagt.",
    toShort: "för kort",
    TooShort: (minLength: number) => `För kort. Ska vara minst ${minLength} bokstäver`,
    PlzInclDigit: "Ta med en siffra eller ett specialtecken (t.ex. !?@) också",
    TooWeak123abc: "För svagt. Använd inte lösenord som '12345' eller 'abcde'.",
    AvoidInclC: "Ha inte med (delar av) ditt namn eller email i lösenordet:",
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
    IsImpersonating: "Du företräder någon annan, som kanske inte har tillgång till alla delar " +
        "av den här webbplatsen.",

    IfYouThinkExistsThen: "Om du tror att sidan finns, logga in som någon som har tillgång till den. ",
    LoggedInAlready: "(Du är redan inloggad, men kanske på fel konto?) ",
    ElseGoToHome_1: "Annars kan du ",
    ElseGoToHome_2: "gå till startsidan.",

    CreateAcconut: "Skapa konto",
    ContinueWithDots: "Fortsätt med ...",
    SignUp: "Gå med",
    LogIn: "Logga in",
    LogInWithPwd: "Logga in med lösenord",
    CreateAdmAcct: "Skapa admin-konto:",
    AuthRequired: "Autentisering krävs för att få tillgång till denna webbplats",
    LogInToLike: "Logga in för att gilla det här inlägget",
    LogInToSubmit: "Logga in och skicka",
    LogInToComment: "Logga in för att skriva en kommentar",
    LogInToCreateTopic: "Logga in för att skapa ett ämne",

    //AlreadyHaveAcctQ: "Already have an account? ",
    OrLogIn_1: "Eller ",
    OrLogIn_2: "Logga in",   // "Log in" (this is a button)
    OrLogIn_3: " istället",  // "instead"

    //NewUserQ: "New user? ",
    SignUpInstead_1: "Eller ",
    SignUpInstead_2: "Skapa konto",
    SignUpInstead_3: " istället",

    OrTypeName_1: ", eller bara ",
    OrTypeName_2: "skriv ditt namn",   // is a button
    OrTypeName_3: "",

    OrCreateAcctHere: "Eller skapa konto här:",
    OrTypeName: "Eller skriv ditt namn:",
    OrLogIn: "Eller logga in:",
    YourNameQ: "Ditt namn?",

    BadCreds: "Fel användarnamn eller lösenord",

    UsernameOrEmailC: "Användarnamn eller e-post:",
    PasswordC: "Lösenord:",
    ForgotPwd: "Har du glömt ditt lösenord?",

    NoPwd: "Du har inte valt ett lösenord än.",
    CreatePwd: "Skapa lösenord",
  },


  // Flag dialog

  fd: {
    PleaseTellConcerned: "Berätta för oss vad du är orolig över.",
    ThanksHaveReported: "Tack. Du har rapporterat det. Forumets personal kommer att ta en titt.",
    ReportComment: "Rapportera kommentar",
    // Different reasons one can choose among when reporting a comment:
    OptPersonalData: "Det här inlägget innehåller personuppgifter, till exempel någons riktiga namn.",
    OptOffensive: "Det här inlägget innehåller kränkande eller stötande innehåll.",
    OptSpam: "Det här inlägget är oönskad reklam.",
    OptOther: "Meddela personalen om det här inlägget av någon annan anledning.",
  },


  // Help message dialog
  help: {
    YouCanShowAgain_1: "Du kan visa hjälpmeddelanden igen, om du är inloggad, genom att " +
        "klicka på ditt namn och sedan på ",
    YouCanShowAgain_2: "Visa hjälpmeddelanden",
  },


  // Editor

  e: {
    SimilarTopicsC: "Liknande ämnen:",

    //WritingSomethingWarning: "You were writing something?",
    UploadMaxOneFile: "Tyvärr kan du för närvarande bara ladda upp en fil åt gången",
    PleaseFinishPost: "Gör klart ditt inlägg först",
    PleaseFinishChatMsg: "Gör klart ditt chattmeddelande först",
    PleaseFinishMsg: "Gör klart ditt meddelande först",
    PleaseSaveEdits: "Spara dina nuvarande ändringar först",
    PleaseSaveOrCancel: "Spara eller avbryt ditt nya ämne först",
    CanContinueEditing: "Du kan fortsätta redigera din text om du öppnar editorn igen.",
        //"(But the text will currently be lost if you leave this page.)",
    PleaseDontDeleteAll: "Ta inte bort all text. Skriv något.",
    PleaseWriteSth: "Skriv någonting.",
    PleaseWriteTitle: "Skriv en rubrik på ämnet.",
    PleaseWriteMsgTitle: "Skriv en rubrik på meddelandet.",
    PleaseWriteMsg: "Skriv ett meddelande.",

    exBold: "fetstil",
    exEmph: "kursiv stil",
    exPre: "förformaterad text",
    exQuoted: "citerad text",
    ExHeading: "Rubrik",

    TitlePlaceholder: "Skriv en rubrik — vad handlar detta om, i en kort mening?",

    EditPost_1: "Editera ",
    EditPost_2: "post ",

    TypeChatMsg: "Skriv ett chattmeddelande:",
    YourMsg: "Ditt meddelande:",
    CreateTopic: "Skapa nytt ämne",
    CreateCustomHtml: "Skapa en anpassad HTML-sida (lägg till din egen <h1>-rubrik)",
    CreateInfoPage: "Skapa en informationssida",
    CreateCode: "Skapa en källkodssida",
    AskQuestion: "Fråga något",
    ReportProblem: "Rapportera problem",
    SuggestIdea: "Föreslå en idé",
    NewChat: "Titel och syfte för ny chattkanal",
    NewPrivChat: "Titel och syfte för ny privat chatt",
    AppendComment: "Lägg till en kommentar längst ner på sidan:",

    ReplyTo: "Svara till ",
    ReplyTo_theOrigPost: "första inlägget",
    ReplyTo_post: "replik ",
    AddCommentC: "Skriv en kommentar:",

    PleaseSelectPosts: "Välj ett eller flera inlägg att svara på.",

    Save: "Spara",
    edits: "ändringar",

    PostReply: "Posta svar",

    Post: "Posta",
    comment: "kommentar",
    question: "fråga",

    PostMessage: "Skicka meddelande",
    SimpleEditor: "Enkel editor",

    Send: "Skicka",
    message: "meddelande",

    Create: "Skapa",
    page: "sida",
    chat: "chatt",
    idea: "idé",
    topic: "ämne",

    Submit: "Posta",
    problem: "problem",

    ViewOldEdits: "Se gamla editeringar",

    UploadBtnTooltip: "Ladda upp bild eller fil",
    BoldBtnTooltip: "Fettext",
    EmBtnTooltip: "Kursivt",
    QuoteBtnTooltip: "Citat",
    PreBtnTooltip: "Monospace",
    HeadingBtnTooltip: "Rubrik",

    TypeHerePlaceholder: "Skriv här. Du kan anända Markdown och HTML, och dra-och-släppa bilder.",

    Maximize: "Maximera",
    ToNormal: "Tillbaks till vanligt",
    TileHorizontally: "Dela vågrätt",

    PreviewC: "Förhandsgranska:",
    TitleExcl: '', // " (titel visas ej)",
    ShowEditorAgain: "Visa editor istället",
    Minimize: "Minimera",

    PreviewInfo: "Här kan du förhandsgranska din text.",
    CannotType: "Du kan inte skriva här.",

    LoadingDraftDots: "Laddar utkast...",
    DraftUnchanged: "Inga ändringar.",
    CannotSaveDraftC: "Kunde inte spara utkastet:",
    DraftSavedBrwsr: "Utkastet sparat i webbläsaren.",
    DraftSaved: (nr: string | number) => `Utkast ${nr} sparat.`,
    DraftDeleted: (nr: string | number) => `Utkast ${nr} raderat.`,
    WillSaveDraft: (nr: string | number) => `Sparar utkast ${nr} ...`,
    SavingDraft: (nr: string | number) => `Sparar utkast ${nr} ...`,
    DeletingDraft: (nr: string | number) => `Raderar utkast ${nr} ...`,
  },


  // Select category dropdown

  scd: {
    SelCat: "Välj kategori",
  },

  // Page type dropdown

  pt: {
    SelectTypeC: "Välj ämnestyp:",
    DiscussionExpl: "En diskussion om något.",
    QuestionExpl: "Ett svar kan markeras som det accepterade svaret.",
    ProblExpl: "Om något är trasigt eller inte fungerar. Kan markeras som fixat/löst.",
    IdeaExpl: "Ett förslag. Kan markeras som klart/genomfört.",
    ChatExpl: "Ett kanske oändligt samtal.",
    PrivChatExpl: "Endast synligt för personer som blir inbjudna till chatten.",

    CustomHtml: "Anpassad HTML-sida",
    InfoPage: "Informationssida",
    Code: "Kod",
    EmbCmts: "Inbäddade kommentarer",
    About: "Om",
    PrivChat: "Privat chatt",
    Form: "Formulär",
  },


  // Join sub community dialog

  jscd: {
    NoMoreToJoin: "Inga fler communities att gå med i.",
    SelCmty: "Välj community ...",
  },


  // Search dialogs and the search page.

  s: {
    TxtToFind: "Text att söka efter",
  },


  // No internet

  ni: {
    NoInet: "Ingen internetanslutning",
    PlzRefr: "Ladda om sidan för att se de senaste ändringarna. (Anslutningen bröts)",
    RefrNow: "Ladda om nu",
  },


  PostDeleted: (postNr: number) => `Inlägget nr ${postNr} har tagits bort.`,
  NoSuchPost: (postNr: number) => `Det finns inget inlägg nr ${postNr} på den här sidan.`,
  NoPageHere: "Den här sidan har tagits bort, eller så har den aldrig funnits, eller så har du inte tillgång till den.",
  GoBackToLastPage: "Gå tillbaka till föregående sida",

};


