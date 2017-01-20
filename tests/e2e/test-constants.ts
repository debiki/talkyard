

// Need to include here, for now, ? because client/app/ doesn't use any modules system,
// doesn't export any constants ?
// Name it 'TestPageRole' so name won't clash with enum 'PageRole' :-(
var TestPageRole = {  // dupl in client/app/constants.ts [5F8KW0P2]
  CustomHtmlPage: <PageRole> 1,
  WebPage: <PageRole> 2,  // rename to Info?
  Code: <PageRole> 3,
  SpecialContent: <PageRole> 4,
  EmbeddedComments: <PageRole> 5,
  Blog: <PageRole> 6,
  Forum: <PageRole> 7,
  About: <PageRole> 9,
  Question: <PageRole> 10,
  Problem: <PageRole> 14,
  Idea: <PageRole> 15,
  ToDo: <PageRole> 13,  // remove? [4YK0F24]
  MindMap: <PageRole> 11,
  Discussion: <PageRole> 12,
  FormalMessage: <PageRole> 17,
  OpenChat: <PageRole> 18,
  PrivateChat: <PageRole> 19,
    // DirectMessage: 20,
  Form: <PageRole> 20,  // try to remove?
  Critique: <PageRole> 16, // [plugin]
};

var TestTrustLevel = {
  New: <TrustLevel> 1,
  Basic: <TrustLevel> 2,
  Member: <TrustLevel> 3,
  Regular: <TrustLevel> 4,
  CoreMember: <TrustLevel> 5,
};

export = {
  TestPageRole: TestPageRole,
  TestTrustLevel: TestTrustLevel,
  TitleNr: 0,
  BodyNr: 1,
  FirstReplyNr: 2,  // [5FKF0F2]
};

