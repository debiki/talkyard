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

var t_de_DE: TalkyardTranslations = t = {

  // A single or a few words, sorted alphabetically, to reuse everywhere.

  Active: "Aktiv",
  Activity: "Aktivität",
  Add: "Hinzufügen",
  AddingDots: "Füge hinzu ...",
  AddComment: "Kommentar hinzufügen",  // MISSING, & dupl t.e.AddCommentC
  Admin: "Admin",
  AdvSearch: "Erweiterte Suche",
  Away: "Abwesend",
  Back: "Zurück",
  BlogN: "Blog",
  Bookmarks: "Lesezeichen",
  Cancel: "Abbrechen",
  Categories: "Kategorien",
  Category: "Kategorie",
  ChangeV: "Ändern",
  ClickToShow: "Klicke zum Anzeigen",
  ChangeDots: "Ändern ...",
  ChatN: "Chat",
  Chatting: "Chattend",
  CheckYourEmail: "Prüfe Deine eMail",
  Close: "Schließen",
  closed: "geschlossen",
  comments: "Kommentare",   // as in:  "123 comments"
  Continue: "Fortfahren",
  Created: "Erstellt",
  Delete: "Löschen",
  Deleted: "Gelöscht",
  DirectMessage: "Private Nachricht",
  Discussion: "Diskussion",
  discussion: "diskussion",
  done: "erledigt",
  EditV: "Bearbeiten",
  Editing: "Bearbeitend",
  EmailC: "eMail: ",   // MISSING  copy t.cud.EmailC to here
  EmailAddress: "eMail-Adresse",
  EmailAddresses: "eMail-Adressen",
  EmailSentD: "eMail gesendet.",
  Forum: "Forum",
  GetNotifiedAbout: "Benachrichtige mich über",
  GroupsC: "Gruppen:",
  Hide: "Verstecken",
  Home: "Home",
  Idea: "Idee",
  Join: "Beitreten",
  KbdShrtcsC: "Tastaturkürzel: ",
  Loading: "Lade...",
  LoadMore: "Mehr laden ...",
  LogIn: "Anmelden",
  LoggedInAs: "Angemeldet als ",
  LogOut: "Abmelden",
  Maybe: "Vielleicht",
  Manage: "Verwalten",
  Members: "Mitglieder",
  MessageN: "Nachricht",
  MoreDots: "Mehr...",
  Move: "Bewegen",
  Name: "Name",
  NameC: "Name:",
  NewTopic: "Neues Thema",
  NoCancel: "Nein, abbrechen",
  Notifications: "Benachrichtigungen",
  NotImplemented: "(Nicht implementiert)",
  NotYet: "Nicht jetzt",
  NoTitle: "Kein Titel",
  NoTopics: "Keine Themen.",
  Okay: "Okay",
  OkayDots: "Okay ...",
  Online: "Online",
  onePerLine: "eine pro Zeile",
  PreviewV: "Vorschau",
  Problem: "Problem",
  progressN: "Fortschritt",
  Question: "Frage",
  Recent: "Kürzliche",
  Remove: "Entfernen",
  Reopen: "Wiedereröffnen",
  ReplyV: "Antwort",
  Replying: "Antwortend",
  Replies: "Antworten",
  replies: "antworten",
  Save: "Speichern",
  SavingDots: "Speichern ...",
  SavedDot: "Gespeichert.",
  Search: "Suche",
  SendMsg: "Sende Nachricht",
  ShowPreview: "Zeige Vorschau",  // MISSING
  SignUp: "Beitreten",  // don't change to "Sign Up" [join_or_signup]
  Solution: "Lösung",
  started: "gestartet",
  Summary: "Zusammenfassung",
  Submit: "Absenden",
  Tag: "Etikett",  // MISSING
  Tags: "Etiketten",  // MISSING
  Tools: "Werkzeuge",
  Topics: "Themen",
  TopicTitle: "Themenüberschrift",
  TopicType: "Themenart",
  UploadingDots: "Hochladend...",
  Username: "Benutzername",
  Users: "Benutzer",
  Welcome: "Willkommen",
  Wiki: "Wiki",
  Yes: "Ja",
  YesBye: "Ja, Tschüß",
  YesDoThat: "Ja, mache das",
  You: "Du",
  you: "Du",

  // Trust levels.
  Guest:  "Gast",
  NewMember: "Neues Mitglied",
  BasicMember: "Mitglied",
  FullMember: "Stamm-Mitglied",
  TrustedMember: "Zuverlässiges Mitglied",
  RegularMember: "Vertrautes Stamm-Mitglied",  // MISSING renamed Regular Member —> Trusted Regular [RENREGLS]
  CoreMember: "Zuverlässiger Stammbenutzer",

  // Periods.
  PastDay: "Letzter Tag",
  PastWeek: "Letzte Woche",
  PastMonth: "Letzter Monat",
  PastQuarter: "Letztes Quartal",
  PastYear: "Letztes Jahr",
  AllTime: "Von Anfang an",

  // Time ago letters.
  // English examples: "3d" in forum topic list means 3 days ago. "5h" is 5 hours.
  monthsLtr: "mon",  // months
  daysLtr: "d",      // days
  hoursLtr: "h",     // hours
  minsLtr: "m",      // minutes
  secsLtr: "s",      // seconds

  // Time ago, long text versions.
  daysAgo: (numDays: number) =>
    numDays === 1 ? "Vor 1 Tag" : `Vor ${numDays} Tagen`,

  hoursAgo: (numHours: number) =>
    numHours === 1 ? "Vor 1 Stunde" : `Vor ${numHours} Stunden`,

  minutesAgo: (numMins: number) =>
    numMins === 1 ? "Vor 1 Minute" : `Vor ${numMins} Minuten`,

  secondsAgo: (numSecs: number) =>
    numSecs === 1 ? "Vor 1 Sekunde" : `Vor ${numSecs} Sekunden`,


  // Input fields, e.g. email, name etc.

  inp: {
    // Email address input field:
    EmReq: "eMail benötigt",
    NoSpcs: "Bitte keine Leerzeichen",
    InvldAddr: "Keine gültige eMail-Adresse",
    NoBadChrs: "Bitte keine Sonderzeichen",

    // Full name input field:
    NotOnlSpcs: "Bitte nicht nur Leerzeichen",
    NoAt: "Bitte kein @",

    // Username input field:
    NoDash: "Bitte keine Bindestriche (-)",
    DontInclAt: "Bitte ohne das @",
    StartEndLtrDgt: "Beginne und ende mit einem Buchstaben oder einer Ziffer",
    OnlLtrNumEtc: "Nur Buchstaben (a-z, A-Z), Ziffern und _ (Unterstrich)",
    // This shown just below the username input:
    UnUnqShrt_1: "Dein ",
    UnUnqShrt_2: "@Benutzername",
    UnUnqShrt_3: ", einzigartig und kurz",

    // Generic messages for all input fields:
    TooShort: (minLength: number) => `Mindestens ${minLength} Zeichen`,
    TooLong: (maxLength: number) => `Zu lang. Bitte nicht mehr als ${maxLength} Zeichen`,
  },


  // Notification levels.

  nl: {
    EveryPost: "Jedes Posting",
    EveryPostInTopic: "Du wirst bei allen neuen Antworten in diesem Thema benachrichtigt.",
    EveryPostInCat: "Du wirst bei allen neuen Themen und Antworten in dieser Kategorie benachrichtig.",
    EveryPostInTopicsWithTag: "Du wirst bei allen neuen Themen mit diesem Etikett sowie allen Antworten in diesen Themen benachrichtigt.",
    EveryPostWholeSite: "Du wirst bei allen neuen Themen und Antworten überall benachrichtigt.",

    // One will be notified about the *first* post in a new topic, only. That is, the Original Post
    // (that's what the first post is called, in a discussion forum topic).
    NewTopics: "Neue Themen",
    NewTopicsInCat: "Du wirst bei neuen Themen in dieser Kategorie benachrichtigt.",
    NewTopicsWithTag: "Du wirst bei neuen Themen mit diesem Etikett benachrichtigt.",
    NewTopicsWholeSite: "Du wirst bei neuen Themen überall benachrichtigt.",

    Tracking: "Nachverfolgen",

    Normal: "Normal",
    NormalDescr: "Du wirst benachrichtigt wenn jemand zu Dir spricht, auch indirekt - z.B. eine " +
        "Antwort auf eine Antwort an Dich.",
    //NormalTopic_1: "Du wirst benachrichtigt wenn jemand zu Dir spricht oder Deinen Namen erwähnt ",
    //NormalTopic_2: "@Name",

    Hushed: "Gedämpft",
    HushedDescr: "Du wirst nur benachrichtigt wenn jemand direkt zu Dir spricht.",

    Muted: "Unterdrückt",
    MutedTopic: "Keine Benachrichtigungen.",   // MISSING removed "about this topic"
  },


  // Forum intro text

  fi: {
    Edit: "Bearbeiten",
    Hide_1: "Verstecken",
    Hide_2: ", klicke ",
    Hide_3: " zum Wiedereröffnen",
  },


  // Forum categories

  fcs: {
    All: "Alle", // "Alle (Kategorien)", shorter than AllCats
  },


  // Forum buttons

  fb: {

    TopicList: "Themenliste",

    // Select category dropdown

    from: "von",  // MISSING used like so:  "From <Category Name>" or "From All Categories"
    in: "in",      // MISSING used like so:  "in <Category Name>" or "in All Categories"
    AllCats: "Allen Kategorien",

    // Topic sort order

    Active: "Aktive zuerst",      // MISSING didn't add "first" yet to transls
    ActiveDescr: "Zeigt Themen mit neuen Aktivitäten zuerst",

    New: "Neu",
    NewDescr: "Zeigt neue Themen zuerst",

    Top: "Beliebt",              // MISSING didn't rename from Top to Popular in transls
    TopDescr: "Zeigt beliebte Themen zuerst",

    // Topic filter dropdown

    AllTopics: "Alle Themen",

    ShowAllTopics: "Zeige alle Themen",
    ShowAllTopicsDescr: "Es gibt jedoch keine gelöschten Themen",

    WaitingTopics: "Wartende Themen",          // MISSING
    OnlyWaitingDescr_1: "Zeigt nur Themen ", // MISSING changed "questions" to "topics"
    OnlyWaitingDescr_2: "die auf eine Lösung warten ",
    OnlyWaitingDescr_3: "oder erledigt werden müssen",  // MISSING rewrote

    YourTopics: "Deine Themen",       // MISSING
    AssignedToYou: "Dir zugewiesen", // MISSING

    DeletedTopics: "Zeige Gelöschte",   // MISSING
    ShowDeleted: "Zeige Gelöschte",
    ShowDeletedDescr: "Zeige alle Themen, auch Gelöschte",

    // Rightmost buttons

    ViewCategories: "Zeige Kategorien",  // MISSING
    EditCat: "Kategorie bearbeiten",
    CreateCat: "Kategorie erstellen",
    CreateTopic: "Thema erstellen",
    PostIdea: "Eine Idee veröffentlichen",
    AskQuestion: "Eine Frage stellen",
    ReportProblem: "Ein Problem berichten",
    CreateMindMap: "Mind Map erstellen ",
    CreatePage: "Seite erstellen",

  },


  // Forum topic list

  ft: {
    ExplIcons: "Icon-Bedeutungen...",
    IconExplanation: "Bedeutung der Icons:",
    ExplGenDisc: "Eine allgemeine Diskussion.",
    ExplQuestion: "Eine Frage ohne akzeptierte Lösung.",
    ExplAnswer: "Eine Frage mit akzeptierter Lösung.",
    ExplIdea: "Eine Idee / ein Vorschlag.",
    ExplProblem: "Ein Problem.",
    ExplPlanned: "Etwas, was wir erledigen wollen.",
    ExplDone: "Etwas, was erledigt wurde.",
    ExplClosed: "Thema geschlossen.",
    ExplPinned: "Angeheftetes Thema (ggfs. in seiner eigenen Kategorie).",

    PopularTopicsComma: "Beliebte Themen, ",
    TopFirstAllTime: "Zeigt alle beliebten Themen zuerst.",
    TopFirstPastDay: "Zeigt alle beliebten Themen des letzten Tages.",

    CatHasBeenDeleted: "Diese Kategorie wurde gelöscht",

    TopicsActiveFirst: "Themen, aktive zuerst",
    TopicsNewestFirst: "Themen, neue zuerst",

    CreatedOn: "Erstellt am ",
    LastReplyOn: "\nLetzte Antwort am ",
    EditedOn: "\nBearbeitet am ",

    // These are shown as mouse-hover tooltips, or mobile-phone-touch-tips, over the user
    // avatar icons, in the forum topic list.
    createdTheTopic: "erstellte das Thema",
    frequentPoster: "regelmäßiger Autor",
    mostRecentPoster: "neuester Autor",

    inC: "in: ",

    TitleFixed: "Das wurde behoben",
    TitleDone: "Das wurde erledigt",
    TitleStarted: "Wir haben das begonnen",
    TitleStartedFixing: "Wir haben begonnen das zu beheben",
    TitleUnsolved: "Das ist ein ungelöstes Problem",
    TitleIdea: "Das ist eine Idee",
    TitlePlanningFix: "Wir planen das zu beheben",
    TitlePlanningDo: "Wir planen das zu erledigen",
    TitleChat: "Das ist ein Chat-Kanal",
    TitlePrivateChat: "Das ist ein privater Chat-Kanal",
    TitlePrivateMessage: "Eine private Nachricht",
    TitleInfoPage: "Das ist eine Info-Seite",
    TitleDiscussion: "Eine Diskussion",
    IsPinnedGlobally: "\nEs wurde angeheftet, also wird es zuerst angezeigt.",
    IsPinnedInCat: "\nEs wurde in seiner Kategorie angeheftet, also wird es in seiner Kategorie zuerst angezeigt.",
  },


  // Forum categories list

  fc: {
    RecentTopicsWaiting: "Neueste Themen (welche warten)",
    RecentTopicsInclDel: "Neueste Themen (inklusive Gelöschter)",
    RecentTopics: "Neueste Themen",
    _replies: " Antworten",
    _deleted: " (gelöscht)",
    _defCat: " (Default-Kategorie)",
  },


  // Topbar

  // Shown at the top of the page. Includes login and signup buttons, or one's username menu.

  tb: {

    // Opens the right hand sidebar and litst the most recent posts in the current topic.
    RecentPosts: "Neueste Beiträge",

    // Open right-hand-sidebar button tooltip, if mouse-hovering online-user-count.
    NumOnlChat: " online in diesem Chat",    // example: "5 online in this chat"
    NumOnlForum: " online in diesem Forum",

    // Open left-sidebar button title.
    WatchbBtn: "Deine Themen",  // REMOVE

    // Tooltip, shown if mouse-hovering the open-left-sidebar button.
    WatchbToolt: "Deine neuesten Themen, Chats und Direktnachrichten",

    // Title shown on user profile pages.
    AbtUsr: "Über den Benutzer",

    // Shortcuts to leave the user profile page, or staff area, and go back to the discussion topics.
    BackFromUsr: "Zurück vom Benutzerprofil",
    BackFromAdm: "Zurück aus dem Admin-Bereich",

    // Title shown on full text search page.
    SearchPg: "Suche auf der Seite",
  },


  // Watchbar (the sidebar to the left)

  wb: {
    AddCommunity: "Hinzufügen ...",
    RecentlyViewed: "Zuletzt betrachtete Themen",  // MISSING " topics"
    JoinedChats: "Beigetretene Chats",
    ChatChannels: "Chat-Kanäle",
    CreateChat: "Erstelle Chat-Kanal",
    DirectMsgs: "Direktnachrichten",
    NoChats: "Keine",    // meaning: "No chat messages"
    NoDirMsgs: "Keine",  // meaning: "No direct messages"

    // The click-topic dropdown menu:
    TopicActions: "Themen-Aktionen",
    ViewPeopleHere: "Zeige die Leute hier",
    ViewAddRemoveMembers: "Zeige, erstelle oder lösche Mitglieder",
    ViewChatMembers: "Zeige Chat-Mitglieder",
    EditChat: "Bearbeite die Chat-Beschreibung",
    //EditChat: "Bearbeite Chat-Titel und Zweck", // Keep, in case adds back edit-title input
    LeaveThisChat: "Verlasse diesen Chat",
    LeaveThisCommunity: "Verlasse diese Community",
    JoinThisCommunity: "Trete dieser Community bei",
  },


  // Contextbar (the sidebar to the right)

  cb: {
    RecentComments: "Neueste Kommentare in diesem Thema:",
    NoComments: "Keine Kommentare.",

    YourBookmarks: "Deine Lesezeichen:",

    UsersOnline: "Benutzer online:",
    UsersOnlineForum: "Benutzer online in diesem Forum:",
    UsersInThisChat: "Benutzer in diesem Chat:",
    UsersInThisTopic: "Benutzer in diesem Thema:",

    GettingStartedGuide: "Admin-Anleitung", // MISSING in other langs, was: "Getting Started Guide".
    AdminGuide: "Admin-Anleitung",          // ... but what? It's here already, just reuse this transl field
    Guide: "Anleitung",

    // How to hide the sidebar.
    CloseShortcutS: "Schließen (Tastenkürzel: S)",

    // ----- Online users list / Users in current topic

    AddPeople: "Mehr Leute hinzufügen",

    // Shown next to one's own username, in a list of users.
    thatsYou: "das bist Du",

    // Info about which people are online.
    // Example, in English: "Benutzer online: Du, und 5 Personen, die nicht angemeldet sind"
    OnlyYou: "Scheinbar nur Du",
    YouAnd: "Du, und ",
    NumStrangers: (numStrangers: number) => {
      const people = numStrangers === 1 ? " Person" : " Personen";
      const have = numStrangers === 1 ? "ist" : "sind";
      return numStrangers + people + " die nicht angemeldet " + have;
    },

    // ----- Recent comments list

    // This explains how the Recent tab in the sidebar works.

    RepliesToTheLeft: "Die Antworten links sind sortiert nach ",
    bestFirst: "Beste zuerst.",
    ButBelow: "Aber unten ",
    insteadBy: " sind die gleichen Antworten stattdessen sortiert nach ",
    newestFirst: "Neueste zuerst.",

    SoIfLeave: "Wenn Du also gehst und später hierher wiederkommst, findet Du unten ",
    allNewReplies: "alle neuen Antworten.",
    Click: "Klicke",
    aReplyToReadIt: " auf eine Antwort unten um sie vollständig zu lesen, da hier nur Auszüge sichtbar sind.",
  },


  // Change page dialog
  cpd: {
    ClickToChange: "Klicke um den Status zu ändern",
    ClickToViewAnswer: "Klicke um die Antwort zu zeigen",
    ViewAnswer: "Zeige Antwort",
    ChangeStatusC: "Ändere dem Status zu:",
    ChangeCatC: "Ändere die Kategorie:",
    ChangeTopicTypeC: "Ändere den Thementyp:",
  },


  // Page doing status, PageDoingStatus
  pds: {
    aQuestion: "eine Frage",
    hasAccptAns: "hat eine akzeptierte Antwort",
    aProblem: "ein Problem",
    planToFix: "geplant zu beheben",
    anIdea: "eine Idee",
    planToDo: "geplant zu erledigen",
  },


  // Discussion / non-chat page

  d: {
    // These texts are split into parts 1,2 or 1,2,3 ec, because in between the texts,
    // icons are shown, to help people understand what those icons mean.

    ThisFormClosed_1: "Dieses Formular wurde ",
    // A Topic-has-been-Closed icon shown here, between text parts 1 (just above) and 2 (below).
    ThisFormClosed_2: "geschlossen - Du kannst es nicht ausfüllen und absenden.",

    ThisTopicClosed_1: "Dieses Thema wurde ",
    // A Topic-has-been-Closed icon, + the text "geschlossen", shown here.
    ThisTopicClosed_2: ". Du kannst immer noch kommentieren.",   // SYNC removed "won't make ... bump ..."

    ThisPageDeleted: "Diese Seite wurde gelöscht",
    CatDeldPageToo: "Kategorie gelöscht, also wurde diese Seite ebenfalls gelöscht",

    ThreadDeld: "Thema gelöscht",
    CmntDeld: "Kommentar gelöscht",
    PostDeld: "Beitrag gelöscht",
    DiscDeld: "Diskussion gelöscht",
    PageDeld: "Seite gelöscht",
    PagePendAppr: "Seite wartet auf Freigabe",
    TitlePendAppr: "Titel wartet auf Freigabe",
    TextPendingApproval: "Text wartet auf Freigabe",

    TooltipQuestClosedNoAnsw: "Diese Frage wurde ohne eine akzeptierte Antwort geschlossen.",
    TooltipTopicClosed: "Dieses Thema ist geschlossen.",

    TooltipQuestSolved: "Dies ist eine gelöste Frage",
    TooltipQuestUnsolved: "Dies ist eine ungelöste Frage",

    StatusDone: "Erledigt",
    TooltipProblFixed: "Dies wurde behoben",
    TooltipDone: "Dies wurde erledigt",

    StatusStarted: "Gestartet",
    TooltipFixing: "Wir haben begonnen, das zu beheben",      // MISSING "We're currently" —> "We've started"
    TooltipImplementing: "Wir haben begonnen, das zu erledigen", // MISSING  -""-

    StatusPlanned: "Geplant",
    TooltipProblPlanned: "Wir planen das zu beheben",
    TooltipIdeaPlanned: "Wir planen das zu erledigen",   // or "to implement this"?

    StatusNew: "Neu",
    StatusNewDtl: "Neues Thema, in Diskussion",
    TooltipUnsProbl: "Dies ist ein ungelöstes Problem",
    TooltipIdea: "Dies ist eine Idee",

    TooltipPersMsg: "Persönliche Nachricht",
    TooltipChat: "# bedeutet Chat-Kanal",
    TooltipPrivChat: "Dies ist ein privater Chat-Kanal",

    TooltipPinnedGlob: "\nGlobal angeheftet.",
    TooltipPinnedCat: "\nIn dieser Kategorie angeheftet.",

    SolvedClickView_1: "Gelöst in Beitrag #",
    SolvedClickView_2: ", klicke zum Anzeigen",

    PostHiddenClickShow: "Beitrag versteckt, klicke zum Anzeigen",
    ClickSeeMoreRepls: "Zeige weitere Antworten",      // MISSING  removed "Click to .." but only in en_US
    ClickSeeMoreComments: "Zeige weitere Kommentare",  // MISSING
    ClickSeeThisComment: "Klicke, um diesen Kommentar anzuzeigen",
    clickToShow: "klicke zum Anzeigen",

    ManyDisagree: "Viele widersprechen dem:",
    SomeDisagree: "Einige widersprechen dem:",

    PendAppr: "Wartet auf Freigabe",
    CmtPendAppr: "Kommentar wartet auf Freigabe, geschrieben ",  // REMOVE  too complicated
    CmtBelowPendAppr: (isYour) => (isYour ? "Dein" : "Der") + " Kommentar unten wartet auf Freigabe.",

    _and: " und",

    repliesTo: "antwortete auf",
    InReplyTo: "Als Antwort auf",
    YourReplyTo: "Deine Antwort auf ",  // MISSING
    YourChatMsg: "Deine Chat-Nachricht: ",   // MISSING
    YourDraft: "Dein Entwurf",    // MISSING
    YourEdits: "Deine Bearbeitung: ",   // MISSING
    YourProgrNoteC: "Deine Fortschrittsnotiz:",  // MISSING
    aProgrNote: "eine Fortschrittsnotiz: ",  // MISSING

    ReplyingToC: "Antwortend auf:",    // MISSING
    ScrollToPrevw_1: "Scrolle zu ",  // MISSING
    ScrollToPrevw_2: "Vorschau",     // MISSING

    UnfinEdits: "Unfertige Bearbeitungen",  // MISSING
    ResumeEdting: "Setze Bearbeitung fort",  // MISSING
    DelDraft: "Lösche Entwurf",   // MISSING

    ClickViewEdits: "Klicke um alte Bearbeitungen anzuzeigen",

    By: "Von ", // ... someones name

    // Discussion ...
    aboutThisIdea: "darüber, ob und wie diese Idee zu erledigen ist",
    aboutThisProbl: "darüber, ob und wie dies zu beheben ist",

    AddProgrNote: "Füge Fortschrittsnotiz hinzu",
    // Progress ...
    withThisIdea: "mit Erledigung dieser Idee",
    withThisProbl: "mit dem Handling dieses Problems",
    withThis: "mit der Erledigung",
  },


  // Metabar

  // Shown between the original post and all replies.

  mb: {
    NotfsAbtThisC: "Benachrichtigungen über dieses Thema:",

    // If is a direct message topic, members listed below this text.
    Msg: "Nachricht",

    SmrzRepls: "Zusammenfassung der Antworten",

    // Don't bother about being correct with "1 reply", "2,3,4 replies".
    // Just write "replies" always instead? (also if only one)

    EstTime: (numReplies: number, minutes: number) =>
        `Dort sind ${numReplies} Antworten. Geschätzte Lesezeit: ${minutes} Minuten`,

    DoneSummarizing: (numSummarized: number, numShownBefore: number) =>
        `Erledigt. ${numSummarized} der vorher ${numShownBefore} angezeigten Antworten zusammengefasst.`,
  },


  // Post actions

  pa: {
    CloseTopic: "Thema schließen",  // MISSING
    CloseOwnQuestionTooltip: "Schließe diese Frage, wenn Du keine Antwort mehr benötigst.",
    CloseOthersQuestionTooltip: "Schließe diese Frage, wenn Du keine Antwort benötigst, z.B. wenn " +
        "es Off-Topic ist oder Du woanders schon eine Antwort bekommen hast.",
    CloseToDoTooltip: "Schließe diese Aufgabe wenn sie nicht mehr erledigt oder behoben werden muss.",
    CloseTopicTooltip: "Schließe dieses Thema wenn es keine weiteren Antworten mehr benötigt.",

    AcceptBtnExpl: "Azeptiere dies als Antwort auf die Frage oder das Problem",
    SolutionQ: "Lösung?",
    ClickUnaccept: "Klicke um diese Antwort nicht mehr zu akzeptieren",
    PostAccepted: "Dieser Beitrag wurde als Antwort akzeptiert",

    NumLikes: (num: number) => num === 1 ? "1 Like" : num + " Likes",
    NumDisagree: (num: number) => num === 1 ? "1 Widerspruch" : num + " Widersprüche",
    NumBury: (num: number) => num === 1 ? "1 Vergraben" : num + " Vergrabene",
    NumUnwanted: (num: number) => num === 1 ? "1 Ungewollt" : num + " Ungewollte",

    MoreVotes: "Mehr Abstimmungen...",
    LikeThis: "Like das",
    LinkToPost: "Link zu diesem Beitrag",
    Report: "Melden",
    ReportThisPost: "Melde diesen Beitrag",
    Admin: "Admin",
    DiscIx: "Diskussionsindex",

    Disagree: "Widerspruch",
    DisagreeExpl: "Klicke hier, um dem Beitrag zu widersprechen oder andere vor falschen Aussagen zu warnen.",
    Bury: "Vergraben",
    BuryExpl: "Klicke hier, um andere Beiträge vor diesen Beitrag zu sortieren. Nur das Admin-Team kann Deine Anstimmung sehen.",
    Unwanted: "Ungewollt",
    UnwantedExpl: "Wenn Du diesen Beitrag hier nicht sehen willst. Das reduziert Dein Vertrauen in den Verfasser " +
            "des Beitrags. Nur das Admin-Team kann Deine Abstimmung sehen.",

    AddTags: "Lösche oder füge Tags hinzu",
    UnWikify: "Un-Wikify",
    Wikify: "Wikify",
    PinDeleteEtc: "Anheften / Löschen / Kategorie ...",
  },


  // Share dialog

  sd: {
    Copied: "Kopiert.",
    CtrlCToCopy: "Drücke STRG+C zum Kopieren.",
    ClickToCopy: "Klicke um den Link zu kopieren.",
  },


  // Chat

  c: {
    About_1: "Dies ist der ",
    About_2: " Chat-Kanal, erstellt von ",
    ScrollUpViewComments: "Scrolle hoch, um ältere Kommentare zu sehen",
    Purpose: "Zweck:",
    edit: "bearbeiten",
    'delete': "löschen",
    MessageDeleted: "(Nachricht gelöscht)",
    JoinThisChat: "Trete diesem chat bei",
    PostMessage: "Sende Nachricht",
    AdvancedEditor: "Erweiterter Editor",
    TypeHere: "Schreibe hier. Du kannst Markdown und HTML benutzen.",
  },


  // My Menu

  mm: {
    NeedsReview: "Benötigt Überprüfung ",
    AdminHelp: "Admin Hilfe ",
    StaffHelp: "Team Hilfe ",
    DraftsEtc: "Entwürfe, Lesezeichen, Aufgaben",
    MoreNotfs: "Zeige alle Benachrichtigungen an",
    DismNotfs: "Markiere alle als gelesen",
    ViewProfile: "Zeige Dein Profil an",
    ViewGroups: "Zeige Gruppen",
    LogOut: "Abmelden",
    UnhideHelp: "Zeige Hilfetexte an",
  },


  // Scroll buttons

  sb: {
    ScrollToC: "Scrolle zu:",
    Scroll: "Scrolle",

    // The Back button, and the letter B is a keyboard shortcut.
    // If in your language, "Back" doesn't start with 'B', then instead
    // set Back_1 to '' (empty text), and Back_2 to:  "Back (B)" — and "Back" (but not "B")
    // translated to your language.
    Back_1: "",
    Back_2: "Zurück (B)",
    BackExpl: "Scrolle zu Deiner vorherigen Position auf dieser Seite zurück",

    // These are useful on mobile — then, no keybard with Home (= scroll to top) and End buttons.
    // And, on a keyboard, once you get used to it, it's quite nice to click 1 to go to the
    // top, and 2 to see the first reply, and B to go back, F forward, so on.
    PgTop: "Seitenanfang",
    PgTopHelp: "Gehe zum Seitenanfang. Tastenkürzel: 1",
    Repl: "Antworten",
    ReplHelp: "Gehe zu den Antworten. Tastenkürzel: 2",
    Progr: "Fortschritt",
    // The Progress section is at the end of the page, and there, things like
    // "Alice changed status to Doing" and "Alise marked this as Done" and "Topic closed by ..."
    // are shown. (And, optionally, comments by staff or the people working with the issue.)
    ProgrHelp: "Gehe zu den Fortschrittsnotizen. Tastenkürzel: 3",
    PgBtm: "Seitenende",
    Btm: "Ende",
    BtmHelp: "Gehe zum Seitenende. Tastenkürzel: 4",

    // "Keyboard shrotcuts: ..., and B to scroll back"
    Kbd_1: ", und ",
    // then the letter 'B' (regardless of language)
    Kbd_2: " um zurück zu scrollen",
  },


  // Select users dialog
  sud: {
    SelectUsers: "Wähle Benutzer",
    AddUsers: "Füge Benutzer hinzu",
  },


  // About user dialog

  aud: {
    IsMod: "Ist Moderator.",
    IsAdm: "Ist Administrator.",
    IsDeld: "Ist deaktiviert oder gelöscht.",
    ThisIsGuest: "Dies ist ein Gastbenutzer, es könnte also Jeder sein.",
    ViewInAdm: "Zeige im Adminbereich",
    ViewProfl: "Zeige Profil",
    ViewComments: "Zeige andere Kommentare",
    RmFromTpc: "Aus dem Thema entfernen",
    EmAdrUnkn: "Unbekannte eMail-Adresse - dieser Gast wird nicht über Antworten benachrichtigt.",
  },


  // User's profile page

  upp: {
    // ----- Links

    Preferences: "Einstellungen",
    Invites: "Einladungen",
    DraftsEtc: "Entwürfe etc",
    About: "Über",
    Privacy: "Privatsphäre",
    Account: "Konto",
    Interface: "Interface",

    // ----- Overview stats

    JoinedC: "Beigetreten: ",
    PostsMadeC: "Geschriebene Beiträge: ",
    LastPostC: "Letzter Beitrag: ",
    LastSeenC: "Zuletzt gesehen: ",
    TrustLevelC: "Vertrauensstufe: ",

    // ----- Action buttons

    // ----- Profile pic

    UploadPhoto: "Lade Bild hoch",
    ChangePhoto: "Ändere Bild",
    ImgTooSmall: "Bild zu klein: Es sollten mindestens 100 x 100 Pixel sein",

    // ----- Activity

    OnlyStaffCanSee: "Nur das Team und zuverlässige Stammbenutzer können das sehen.",
    OnlyMbrsCanSee: "Nur Benutzer, die schon eine ganze Weile hier aktiv sind, können das sehen.",
    Nothing: "Nichts anzuzeigen",
    Posts: "Beiträge",
    NoPosts: "Keine Beiträge.",
    Topics: "Themen",
    NoTopics: "Keine Themen.",

    // ----- User status

    UserBanned: "Dieser Benutzer ist verbannt",
    UserSuspended: (dateUtc: string) => `Dieser Benutzer ist bis ${dateUtc} UTC suspendiert`,
    ReasonC: "Grund: ",

    DeactOrDeld: "Wurde deaktiviert oder gelöscht.",
    isGroup: " (eine Gruppe)",
    isGuest: " — ein Gastbenutzer, könnte Jeder sein",
    isMod: " – Moderator",
    isAdmin: " – Administrator",
    you: "(Du)",

    // ----- Notifications page

    NoNotfs: "Keine Benachrichtigungen",
    NotfsToYouC: "Benachrichtigungen für Dich:",
    NotfsToOtherC: (name: string) => `Benachrichtigungen an ${name}:`,
    DefNotfsSiteWide: "Seitenübergreifende Default-Benachrichtugungen",
    // The "for" in:  "Seitenübergreifende Default-Benachrichtigungen für (someone's name)".
    forWho: "für",

    // ----- Drafts Etc page

    NoDrafts: "Keine Entwürfe",
    YourDraftsC: "Deine Entwürfe:",
    DraftsByC: (name: string) => `Entwürfe von ${name}:`,

    // ----- Invites page

    InvitesIntro: "Hier kannst Du jemanden zu dieser Seite einladen. ",
    InvitesListedBelow: "Einladungen, die Du schon verschickt hast, sind unten aufgelistet.",
    NoInvites: "Du hast noch niemanden eingeladen.",

    InvitedEmail: "Eingeladene eMail",
    WhoAccepted: "Benutzer, die akzeptiert haben",
    InvAccepted: "Einladung akzeptiert",
    InvSent: "Einladung gesendet",
    JoinedAlready: "Bereits beigetreten",

    SendAnInv: "Lade jemanden ein", // was: "Send an Invite",   MISSING I18N all other langs
    SendInv: "Verschicke Einladungen",   // MISSING I18N is just "Send invite" (singularis) in all other langs
    SendInvExpl:  // MISSING I18N changed to pluralis
        "Wir senden Deinen Freunden eine kurze eMail. Sie klicken auf einen Link " +
        "um sofort beizutreten, keine Anmeldung ist erforderlich. " +
        "Sie werden dann normale Benutzer, keine Moderatoren oder Admins.",
    //EnterEmail: "Gebe die eMail-Adresse(n) ein",
    InvDone: "Erledigt. Wir werden ihnen eine eMail schicken.",
    NoOneToInv: "Niemanden einzuladen.",
    InvNotfLater: "Du wirst später benachrichtigt, wenn sie eingeladen wurden.",
    AlreadyInvSendAgainQ: "Diese wurden bereits eingeladen - möchtest Du sie vielleicht nochmal einladen?",
    InvErr_1: "Diese ergaben einen ",
    InvErr_2: "Fehler",
    InvErr_3: ":",
    TheseJoinedAlrdyC: "Diese sind bereits hier, sie wurden daher nicht eingeladen:",
    ResendInvsQ: "Sende diesen Leuten die Einladung erneut? Sie wurden schon eingeladen.",
    InvAgain: "Erneut einladen",

    // ----- Preferences, About

    AboutYou: "Über Dich",
    WebLink: "Irgendwelche Webseiten von Dir..",

    NotShownCannotChange: "Nicht öffentlich (kann nicht geändert werden).",

    // The full name or alias:
    NameOpt: "Name (optional)",

    NotShown: "Nicht öffentlich.",

    // The username:
    MayChangeFewTimes: "Du kannst es nur wenige Mal ändern.",
    notSpecified: "(nicht spezifiziert)",
    ChangeUsername_1: "Du kannst Deinen Benutzernamen nur wenige Male ändern.",
    ChangeUsername_2: "Zu viele Änderungen verwirren andere — " +
        "sie wissen dann nicht, wie sie dich @erwähnen sollen.",

    NotfAboutAll: "Werde über jeden neuen Beitrag benachrichtigt (so lange Du das Thema oder die Kategorie nicht stummschaltest)",
    NotfAboutNewTopics: "Werde über jedes neue Thema benachrichtigt (so lange Du die Kategorie nicht stummschaltest)",

    ActivitySummaryEmails: "eMail-Zusammenfassungen",

    EmailSummariesToGroup:
        "Wenn Benutzer dieser Gruppe diese nicht regelmäßig besuchen, dann schicke ihnen " +
        "Zusammenfassungen über beliebte Themen und andere Dinge per eMail.",
    EmailSummariesToMe:
        "Wenn ich hier nicht vorbeischaue, maile mir " +
        "Zusammenfassungen über beliebte Themen und andere Dinge.",

    AlsoIfTheyVisit: "Maile ihnen, auch wenn sie hier regelmäßig vorbeischauen.",
    AlsoIfIVisit: "Maile mir, auch wenn ich hier regelmäßig vorbeischaue.",

    HowOftenWeSend: "Wie oft sollen wir diese Mails senden?",
    HowOftenYouWant: "Wie oft möchtest Du diese Mails?",

    // ----- Preferences, Privacy

    HideActivityStrangers_1: "Verstecke Deine Aktivitäten vor Fremden und neuen Mitgliedern?",
    HideActivityStrangers_2: "(aber nicht vor Benutzern, die hier schon länger aktiv sind.)",
    HideActivityAll_1: "Verstecke Deine Aktivitäten vor Jedem?",
    HideActivityAll_2: "(außer dem Team und zuverlässigen Stammbenutzern.)",

    // ----- Preferences, Account

    // About email address:
    EmailAddresses: "eMail-Adresse",
    PrimaryDot: "Primär. ",
    VerifiedDot: "Verifiziert. ",
    NotVerifiedDot: "Nicht verifiziert. ",
    ForLoginWithDot: (provider: string) => `Für die Anmeldung mit ${provider}. `,
    MakePrimary: "Mache primär",
    AddEmail: "Füge eMail-Adresse hinzu",
    TypeNewEmailC: "Gebe eine neue eMail-Adresse ein:",
    MaxEmailsInfo: (numMax: number) => `(Du kannst nicht mehr als ${numMax} Adressen hinzufügen.)`,
    EmailAdded_1: "Hinzugefügt. Wir haben Dir eine Verifizierungs-Mail geschickt — ",
    EmailAdded_2: "prüfe Dein Postfach.",
    SendVerifEmail: "Sende Verifizierungs-Mail",

    EmailStatusExpl:
        "('Primär' bedeutet, Du kannst Dich mit dieser Adresse anmelden und bekommst Benachrichtigungen dorthin. " +
        "'Verifiziert' bedeutet, Du hast Deine eMail-Adresse mit dem Verifizierungslink bestätigt.)",

    // Password:
    ChangePwdQ: "Ändere Dein Paßwort?",
    CreatePwdQ: "Erstelle Dein Paßwort?",
    WillGetPwdRstEml: "Du bekommst eine eMail zum Zurücksetzen Deines Paßwortes.",
    // This is the "None" in:  "Password: None"
    PwdNone: "Keins",

    // Logins:
    LoginMethods: "Login-Methode",
    commaAs: ", als: ",

    // One's data:
    YourContent: "Dein Inhalt",
    DownloadPosts: "Download Deiner Beiträge",
    DownloadPostsHelp: "Erzeugt eine JSON-Datei mit Deinen Themen und Kommentaren, die Du geschrieben hast.",
    DownloadPersData: "Download Deiner persönlichen Daten",
    DownloadPersDataHelp: "Erzeugt eine JSON-Datei mit Deinen persönlichen Daten, z.B. Dein Name " +
        "(wenn Du ihn angegeben hast) und eMail-Adresse(n).",


    // Delete account:
    DangerZone: "Danger zone",
    DeleteAccount: "Lösche das Konto",
    DeleteYourAccountQ:
        "Lösche Deine Konto? Wir werden Deinen Namen entfernen und Deine eMail-Adresse(n), Paßwort und " +
        "alle anderen Identitäten (wie Facebook- oder Twitter-Anmeldedaten) löschen. " +
        "Du kannst Dich nicht mehr einloggen. DIES KANN NICHT RÜCKGÄNGIG GEMACHT WERDEN!",
    DeleteUserQ:
        "Lösche diesen Benutzer? Wir werden den Namen entfernen und die eMail-Adresse(n), Paßwort und " +
        "alle anderen Identitäten (wie Facebook- oder Twitter-Anmeldedaten) löschen. " +
        "Der Benutzer kann sich nicht mehr einloggen. DIES KANN NICHT RÜCKGÄNGIG GEMACHT WERDEN!",
    YesDelete: "Ja, löschen",
  },


  // Group profile page
  gpp: {
    GroupMembers: "Gruppenmitglieder",
    NoMembers: "Keine Mitglieder.",
    MayNotListMembers: "Kann keine Mitglieder auflisten.",
    AddMembers: "Mitglieder hinzufügen",
    BuiltInCannotModify: "Das ist eine vorgegebene Gruppe, nicht modifizierbar.",
    NumMembers: (num: number) => `${num} Mitglieder`,
    YouAreMember: "Du bist Mitglied.",
    CustomGroupsC: "Benutzergruppen:",
    BuiltInGroupsC: "Vorgegebene Gruppen:",
    DeleteGroup: "Lösche diese Gruppe",
  },


  // Create user dialog

  cud: {
    CreateUser: "Lege Benutzer an",
    CreateAccount: "Erstelle Konto",
    EmailC: "eMail:",  // REMOVE move to t.EmailC instead
    keptPriv: "wird nicht beröffentlicht",
    forNotfsKeptPriv: "für Benachrichtigungen, nicht öffentlich",
    EmailVerifBy_1: "Deine eMail wurde verifiziert von ",
    EmailVerifBy_2: ".",
    UsernameC: "Benutzername:",
    FullNameC: "Voller Name:",
    optName: "optional",

    // OrCreateAcct_1: "Oder ",
    // OrCreateAcct_2: "erstelle ein Konto",
    // OrCreateAcct_3: " mit ",
    // OrCreateAcct_4: "@Benutzername",
    // OrCreateAcct_5: " & Paßwort",

    DoneLoggedIn: "Konto erstellt. Du bist angemeldet.",  // COULD say if verif email sent too?
    AlmostDone:
        "Fast fertig! Du musst nur noch Deine eMail-Adresse bestätigen. Wir haben Dir " +
        "eine eMail geschickt. Bitte klicke auf den Link in dieser Mail um " +
        "Dein Konto zu aktivieren. Da kannst diese Seite nun schließen.",
  },


  // Accept terms and privacy policy?

  terms: {
    TermsAndPrivacy: "Nutzungsbedingungen und Datenschutz",

    Accept_1: "Akzeptierst Du unsere ",
    TermsOfService: "Servicebedingungen",
    TermsOfUse: "Nutzungsbedingungen",
    Accept_2: " und ",
    PrivPol: "Datenschutzerklärung",
    Accept_3_User: "?",
    Accept_3_Owner: " für Seitenbetreiber?",  // (see just below)

    // About "for site owners?" above:
    // That's if someone creates his/her own community, via this software provided as
    // Software-as-a-Service hosting. Then, there is / will-be a bit different
    // Terms-of-Service to agree with, since being a community maintainer/owner, is different
    // (more responsibility) than just signing up to post comments.

    YesAccept: "Ja, ich akzeptiere",
  },


  // Password input

  pwd: {
    PasswordC: "Paßwort:",
    StrengthC: "Stärke: ",
    FairlyWeak: "Ziemlich schwach.",
    toShort: "zu kurz",
    TooShort: (minLength: number) => `Zu kurz. Es sollten mindestens ${minLength} Zeichen sein`,
    PlzInclDigit: "Bitte füge eine Ziffer oder ein Sonderzeichen ein",
    TooWeak123abc: "Zu schwach. Benutze keine Paßworte wie '12345' oder 'abcde'.",
    AvoidInclC: "Vermeide die Benutzung Teile Deines Namens oder der eMail-Adresse im Paßwort:",
  },


  // Login dialog

  ld: {
    NotFoundOrPrivate: "Seite nicht gefunden oder Zugriff verweigert.",

    // This is if you're admin, and click the Impersonate button to become someone else
    // (maybe to troubleshoot problems with his/her account s/he has asked for help about),
    // and then you, being that other user, somehow happen to open a login dialog
    // (maybe because of navigating to a different part of the site that the user being
    // impersonated cannot access) — then, that error message is shown: You're not allowed
    // to login as *someone else* to access that part of the community, until you've first
    // stopped impersonating the first user. (Otherwise, everything gets too complicated.)
    IsImpersonating: "Du agierst als jemand, der nicht alle Rechte zum Zugriff auf " +
        "diese Seite hat.",

    IfYouThinkExistsThen: "Wenn Du glaubst dass diese Seite existiert, melde Dich als jemand an der Zugriff hat. ",
    LoggedInAlready: "(Du bist bereits angemeldet, ist es das richtige Konto?) ",
    ElseGoToHome_1: "Ansonsten kannst Du ",
    ElseGoToHome_2: "zur Homepage gehen.",

    CreateAcconut: "Erstelle Konto",
    ContinueWithDots: "Fortfahren mit ...",
    SignUp: "Beitreten",
    LogIn: "Anmelden",
    LogInWithPwd: "Mit Paßwort anmelden",
    CreateAdmAcct: "Admin-Konto anlegen:",
    AuthRequired: "Anmeldung erforderlich um auf die Seite zuzugreifen",
    LogInToLike: "Melde Dich an um diesen Beitrag zu liken",
    LogInToSubmit: "Anmelden und absenden",
    LogInToComment: "Melde Dich an um einen Kommentar zu schreiben",
    LogInToCreateTopic: "Melde Dich an um ein Thema zu erstellen",

    //AlreadyHaveAcctQ: "You have an account? ",  // MISSING changed "Already have...?" to "You have...?"
    OrLogIn_1: "Oder ",         // "Or "
    OrLogIn_2: "Melde Dich an",      // "Log in" (this is a button)
    OrLogIn_3: " ",    // " instead"

    //NewUserQ: "New user? ",
    SignUpInstead_1: "Oder ",
    SignUpInstead_2: "Registriere Dich", // (this is a button)
    SignUpInstead_3: "",

    OrTypeName_1: ", oder ",
    OrTypeName_2: "schreibe einen Namen",   // is a button
    OrTypeName_3: "",

    OrCreateAcctHere: "Oder registriere Dich:",
    OrTypeName: "Oder schreibe Deinen Namen:",
    OrLogIn: "Oder melde Dich an:",
    YourNameQ: "Dein Name?",

    BadCreds: "Falscher Benutzername oder Paßwort",

    UsernameOrEmailC: "Benutzername oder eMail:",
    PasswordC: "Paßwort:",
    ForgotPwd: "Hast Du Dein Paßwort vergessen?",

    NoPwd: "Du hast noch kein Paßwort vergeben.",
    CreatePwd: "Erstelle ein Paßwort",
  },


  // Flag dialog

  fd: {
    PleaseTellConcerned: "Bitte schreibe uns, worüber Du besorgt bist.",
    ThanksHaveReported: "Danke. Deine Meldung wurde aufgenommen. Das Team wird sie sich ansehen.",
    ReportComment: "Melde Kommentar",
    // Different reasons one can choose among when reporting a comment:
    OptPersonalData: "Dieser Beitrag enthält persönliche Daten, z.B. den Namen einer Person.",
    OptOffensive: "Dieser Beitrag enthält Beleidigungen, Verleumdungen oder verbotene/unerwünschte Äußerungen.",
    OptSpam: "Dieser Beitrag ist unerwünschte Werbung / Spam.",
    OptOther: "Melde den Beitrag aus anderen Gründen.",
  },


  // Help message dialog (as in "Tips", not "Private message").
  help: {
    YouCanShowAgain_1: "Du kannst die Hilfetexte erneut anzeigen, wenn Du angemeldet bist, " +
        "auf Deinen Namen klickst und dann auf ",
    YouCanShowAgain_2: "Hilfetexte anzeigen",
  },


  // Editor

  e: {
    SimilarTopicsC: "Ähnliche Themen:",

    //WritingSomethingWarning: "You were writing something?",
    UploadMaxOneFile: "Sorry, aber im Moment kannst Du nur eine Datei auf einmal hochladen",
    PleaseFinishPost: "Bitte schreibe zuerst Deinen Beitrag zu Ende",
    PleaseFinishChatMsg: "Bitte schreibe zuerst Deine Chatnachricht zu Ende",
    PleaseFinishMsg: "Bitte schreibe zuerst Deine Nachricht zu Ende",
    PleaseSaveEdits: "Bitte speichere zuerst Deine aktuellen Änderungen",
    PleaseSaveOrCancel: "Bitte speichere zuerst Dein neues Thema oder breche ab",
    CanContinueEditing: "Du kannst mit der Bearbeitung fortfahren, wenn Du den Editor wieder öffnest.",
        //"(But the text will currently be lost if you leave this page.)",
    PleaseDontDeleteAll: "Bitte lösche nicht den gesamten Text. Schreibe etwas.",
    PleaseWriteSth: "Bitte schreibe etwas.",
    PleaseWriteTitle: "Bitte schreibe einen Thementitel.",
    PleaseWriteMsgTitle: "Bitte schreibe einen Nachrichtentitel.",
    PleaseWriteMsg: "Bitte schreibe ein Nachricht.",

    exBold: "Fettschrift",
    exEmph: "hervorgehobener Text",
    exPre: "Vorformatierter Text",
    exQuoted: "zitierter Text",
    ExHeading: "Überschrift",

    TitlePlaceholder: "Schreibe einen Titel - worum geht es, in einem kurzen Satz?",

    EditPost_1: "Bearbeite ",
    EditPost_2: "Beitrag ",

    TypeChatMsg: "Schreibe eine Chatnachricht:",
    YourMsg: "Deine Nachricht:",
    CreateTopic: "Erstelle ein neues Thema",
    CreateCustomHtml: "Erstelle eine HTML-Seite (füge Deinen eigenen <h1>-Titel hinzu)",
    CreateInfoPage: "Erstelle eine Infoseite",
    CreateCode: "Erstelle eine Sourcecode-Seite",
    AskQuestion: "Stelle eine frage",
    ReportProblem: "Melde ein Problem",
    SuggestIdea: "Schlage eine Idee vor",
    NewChat: "Titel und Zweck des Chat-Kanals",
    NewPrivChat: "Titel und Zewck des privaten Chats",
    AppendComment: "Füge einen Kommentar am Seitenende hinzu:",

    ReplyTo: "Antwort auf ",
    ReplyTo_theOrigPost: "den Originalbeitrag",
    ReplyTo_post: "den Beitrag ",
    AddCommentC: "Füge einen Kommentar hinzu:",   // MISSING, & dupl t.AddComment

    PleaseSelectPosts: "Bitte wähle einen oder mehrere Beiträge zur Antwort aus.",

    Save: "Speichern",
    edits: "Bearbeitungen",

    PostReply: "Schreibe Antwort",
    PostComment: "Schreibe Kommentar",

    Post: "Beitrag",
    comment: "Kommentar",
    question: "Frage",

    PostMessage: "Schreibe Beitrag",
    SimpleEditor: "Einfacher Editor",

    Send: "Sende",
    message: "Nachricht",

    Create: "Erstelle",
    page: "Seite",
    chat: "Chat",
    idea: "Idee",
    topic: "Thema",

    Submit: "Absenden",
    problem: "Problem",

    ViewOldEdits: "Zeige alte Bearbeitungen",

    UploadBtnTooltip: "Lade eine Datei oder ein Bild hoch",
    BoldBtnTooltip: "Ändere den Text zu Fettschrift",
    EmBtnTooltip: "Hervorheben",
    QuoteBtnTooltip: "Zitat",
    PreBtnTooltip: "Vorformatierter Text",
    HeadingBtnTooltip: "Überschrift",

    TypeHerePlaceholder: "Schreibe hier. Du kannst Markdown und HTML benutzen. Drag and drop um Bilder einzufügen.",

    Maximize: "Maximieren",
    ToNormal: "Zurück zur Normaldarstellung",
    TileHorizontally: "Horizontal teilen",

    PreviewC: "Vorschau:",
    TitleExcl: " (ohne Titel)",
    ShowEditorAgain: "Zeige wieder den Editor",
    Minimize: "Minimieren",

    IPhoneKbdSpace_1: "(Dieser graue Bereich ist reserviert",
    IPhoneKbdSpace_2: "für die iPhone-Tastatur.)",

    PreviewInfo: "Hier kannst Du sehen, wie Dein Beitrag aussehen wird.",
    CannotType: "Du kannst hier nicht schreiben.",

    LoadingDraftDots: "Lade alle Entwürfe...",
    DraftUnchanged: "Nicht verändert.",
    CannotSaveDraftC: "Kann Entwurf nicht speichern:",
    DraftSavedBrwsr: "Entwurf im Browser gespeochert.",   // MISSING
    DraftSaved: (nr: string | number) => `Entwurf ${nr} gespeichert.`,
    DraftDeleted: (nr: string | number) => `Entwurf ${nr} gelöscht.`,
    WillSaveDraft: (nr: string | number) => `Werde Entwurf ${nr} speichern ...`,
    SavingDraft: (nr: string | number) => `Speichere Entwirf ${nr} ...`,
    DeletingDraft: (nr: string | number) => `Lösche Entwurf ${nr} ...`,
  },


  // Select category dropdown

  scd: {
    SelCat: "Wähle Kategorie",
  },

  // Page type dropdown

  pt: {
    SelectTypeC: "Wähle Kategorietyp:",
    DiscussionExpl: "Eine Diskussion über etwas.",
    QuestionExpl: "Eine Antwort kann als die akzeptierte Antwort markiert werden.",
    ProblExpl: "Wenn etwas kaputt ist oder nicht richtig arbeitet. Kann als erledigt/behoben markiert werden.",
    IdeaExpl: "Ein Vorschlag. Kann als erledigt markiert werden.",
    ChatExpl: "Eine vielleicht nie endende Konversation.",
    PrivChatExpl: "Nur sichtbar für Leute die zu diesem Chat eingeladen werden.",

    CustomHtml: "Eigene HTML-Seite",
    InfoPage: "Infoseite",
    Code: "Code",
    EmbCmts: "Eingebettete Kommentare",
    About: "Über",
    PrivChat: "Privater Chat",
    Form: "Formular",
  },


  // Join sub community dialog

  jscd: {
    NoMoreToJoin: "Keine weiteren Communities zum Beitreten.",
    SelCmty: "Wähle Community ...",
  },


  // Search dialogs and the search page.

  s: {
    TxtToFind: "Text, nach dem gesucht werden soll",
  },


  // No internet

  ni: {
    NoInet: "Keine Internetverbindung",
    PlzRefr: "Lade die Seite neu um Änderungen zu sehen. (Es gab eine Verbindungsunterbrechung)",
    RefrNow: "Refresh now",
  },


  PostDeleted: (postNr: number) => `Dieser Beitrag, Nr. ${postNr}, wurde gelöscht.`,
  NoSuchPost: (postNr: number) => `Es gibt keinen Beitrag Nr. ${postNr} auf dieser Seite.`,
  NoPageHere: "Diese Seite wurde gelöscht oder hat nie existiert - oder Du hast keine Zugangsberechtigung.",
  GoBackToLastPage: "Gehe zurück zur letzten Seite",

};


