/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference path="UsersModule.ts" />
/// <reference path="action-list/ActionListItem.ts" />

//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------



export class UsersQueryService {


  public static $inject = ['$http', '$q'];
  constructor(private $http: ng.IHttpService, private $q: ng.IQService) {
  }


  public loadActions(): ng.IPromise<ActionListItem[]> {
    var deferred = this.$q.defer<ActionListItem[]>();
    // For now
    var actions: ActionListItem[] = DummyActions;
    deferred.resolve(actions);
    return deferred.promise;
  }

}


var DummyActions: ActionListItem[] = [
  ActionListItem.fromJson({
    pageUrl: 'http://example.com',
    pageTitle: 'Title',
    postId: 1234,
    actionId: 1234,
    actingUserId: '345',
    actingUserDisplayName: 'Actor',
    targetUserId: '123',
    targetUserDisplayName: 'Target User',
    createdAt: new Date(),
    excerpt: 'reitsns insrt gpupfu kitebtc 0wfk.',
    anyReplyToPostId: 123
  }),
  ActionListItem.fromJson({
    pageUrl: 'http://example.com',
    pageTitle: 'Title',
    postId: 1234,
    actionId: 1234,
    actingUserId: '345',
    actingUserDisplayName: 'Actor',
    targetUserId: '123',
    targetUserDisplayName: 'Target User',
    createdAt: new Date(),
    excerpt: 'reitsns insrt gpupfu kitebtc 0wfk.',
    anyLike: 1
  }),
  ActionListItem.fromJson({
    pageUrl: 'http://example.com',
    pageTitle: 'Title',
    postId: 1234,
    actionId: 1234,
    actingUserId: '345',
    actingUserDisplayName: 'Actor',
    targetUserId: '123',
    targetUserDisplayName: 'Target User',
    createdAt: new Date(),
    excerpt: 'reitsns insrt gpupfu kitebtc 0wfk.',
    anyWrong: 1
  }),
  ActionListItem.fromJson({
    pageUrl: 'http://example.com',
    pageTitle: 'Title',
    postId: 1234,
    actionId: 1234,
    actingUserId: '345',
    actingUserDisplayName: 'Actor',
    targetUserId: '123',
    targetUserDisplayName: 'Target User',
    createdAt: new Date(),
    excerpt: 'reitsns insrt gpupfu kitebtc 0wfk.',
    anyOffTopic: 1
  })];


usersModule.service('UsersQueryService', UsersQueryService);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
