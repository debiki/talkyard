
// Public API Typescript types. [PUB_API]
//
// These shouldn't be used by the Talkyard client itself — because if
// the Ty client were to use the public stable API, there'd be a
// slightly higher risk that the Ty developers accidentally changed
// the public API just because the Talkyard client needed some
// API changes?  Instead, the Ty client uses an internal API that
// it's fine to change in any way at any time.
//
// ... So this file is placed in <root>/tests/... where the Talkyard
// client (located in <root>/client/) cannot access it.


interface ListUsersApiResponse {
  users: UserIdName[];
}

interface UserIdName {
  id: UserId;
  username: string;
  fullName?: string;
}

