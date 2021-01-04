/// <reference path="server-vars.d.ts" />

declare const talkyard: TalkyardApi;

// REMOVE? shouldn't access, if in emb cmts editor or login popup,
// instead, should use getMainWin().typs.
declare const typs: PageSession;

declare const eds: ServerVars;  // RENAME to tys  ?  And is there any way to make all fields 'const' ?

// Old:
declare const debiki: any;
