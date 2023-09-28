


export function makeCreateTypeAction(doHow: UpsertTypeParams): UpsertTypeAction {
  return {
    asWho: 'username:sysbot',
    doWhat: 'UpsertType',
    doHow,
  };
}


export function makeCreatePageAction(asWho: St, doHow: CreatePageParams): CreatePageAction {
  return {
    asWho,
    doWhat: 'CreatePage',
    doHow,
  };
}


export function makeCreateCommentAction(asWho: St, doHow: CreateCommentParams
          ): CreateCommentAction {
  return {
    asWho,
    doWhat: 'CreateComment',
    doHow,
  };
}


export function makeVoteAction(asWho: St, params: SetVoteParams): Action {
  return {
    asWho,
    doWhat: 'SetVote',
    doHow: params,
  };
}


export function makeSubscribeAction(asWho: St, whatPage: St, undo?: true): Action {
  return {
    asWho,
    doWhat: 'SetNotfLevel',
    doHow: { whatPage, whatLevel: undo ? 'Normal' : 'NewPosts', }
  };
}
