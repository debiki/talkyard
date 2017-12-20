

// Need to include here, for now, ? because client/app/ doesn't use any modules system,
// doesn't export any constants ?
// Name it 'TestPageRole' so name won't clash with enum 'PageRole' :-(
const TestPageRole = {  // dupl in client/app/constants.ts [5F8KW0P2]
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

const TestTrustLevel = {
  New: <TrustLevel> 1,
  Basic: <TrustLevel> 2,
  Member: <TrustLevel> 3,
  Trusted: <TrustLevel> 4,
  Regular: <TrustLevel> 5,
  CoreMember: <TrustLevel> 6,
};

export = {
  TestPageRole: TestPageRole,
  TestTrustLevel: TestTrustLevel,
  TitleNr: 0,
  BodyNr: 1,
  FirstReplyNr: 2,  // [5FKF0F2]
  SystemUserId: 1,
  EveryoneId: 10,
  NewMembersId: 11,
  BasicMembersId: 12,
  FullMembersId: 13,
  TrustedMembersId: 14,
  RegularMembersId: 15,
  CoreMembersId: 16,
  StaffId: 17,
  ModeratorsId: 18,
  AdminsId: 19,
};

