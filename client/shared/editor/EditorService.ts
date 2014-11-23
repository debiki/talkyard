/*
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

/// <reference path="../../typedefs/angularjs/angular.d.ts" />
/// <reference path="../../typedefs/lodash/lodash.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="EditorModule.ts" />

var d = { i: debiki.internal, u: debiki.v0.util };


class EditorService {

  public static $inject = ['$http', '$q'];
  constructor(private $http: ng.IHttpService, private $q: ng.IQService) {
  }


  public loadCurrentText(postId): ng.IPromise<string> {
    var deferred = this.$q.defer<string>();
    var url = d.i.serverOrigin + '/-/edit?pageId='+ d.i.pageId + '&postId='+ postId;
    this.$http.get(url)
      .success((data: any, status, headers, config) => {
        // TODO also load info about whether the user may apply and approve the edits.
        deferred.resolve(data.currentText);
      })
      .error((data, status, headers, config) => {
        console.error('Error:\n' + data);
      });
    return deferred.promise;
  }


  public createNewPage(data): ng.IPromise<void> {
    var deferred = this.$q.defer<any>();
    this.$http.post(d.i.serverOrigin + '/-/create-page', data)
      .success((data, status, headers, config) => {
        deferred.resolve(data);
      })
      .error((data, status, headers, config) => {
        console.error('Error:\n' + data);
      });
    return deferred.promise;
  }


  public saveEdits(data): ng.IPromise<void> {
    var deferred = this.$q.defer<any>();
    this.$http.post(d.i.serverOrigin + '/-/edit', data)
      .success((data, status, headers, config) => {
        deferred.resolve(null);
        d.i.handleEditResult(data);
      })
      .error((data, status, headers, config) => {
        console.error('Error:\n' + data);
      });
    return deferred.promise;
  }


  public saveReply(data): ng.IPromise<void> {
    var deferred = this.$q.defer<any>();
    this.$http.post(d.i.serverOrigin + '/-/reply', data)
      .success((data, status, headers, config) => {
        deferred.resolve(null);
        d.i.handleReplyResult(data);
      })
      .error((data, status, headers, config) => {
        console.error('Error:\n' + data);
      });
    return deferred.promise;
  }


  public listUsernames(prefix: string): ng.IPromise<any> {
    var deferred = this.$q.defer<any>();
    var url = d.i.serverOrigin + '/-/list-usernames?pageId='+ d.i.pageId + '&prefix='+ prefix;
    this.$http.get(url)
      .success((data: any, status, headers, config) => {
        // TODO also load info about whether the user may apply and approve the edits.
        deferred.resolve(data);
      })
      .error((data, status, headers, config) => {
        console.error('Error:\n' + data);
      });
    return deferred.promise;
  }
}


debiki2.editor.editorModule.service("EditorService", EditorService);
