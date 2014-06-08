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

/// <reference path="AdminApp.ts" />
/// <reference path="model/Settings.ts" />
/// <reference path="../typedefs/angularjs/angular.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------



export class QueryService {

  private RecentPostsUrl = '/-/list-recent-posts';
  private PagesUrl = '/-/list-pages?in-tree';
  private LoadSiteSettingsUrl = '/-/load-site-settings';
  private LoadSectionSettingsUrl = '/-/load-section-settings';
  private SaveSettingUrl = '/-/save-setting';
  private LoadSpecialContentUrl = '/-/load-special-content';
  private SaveSpecialContentUrl = '/-/save-special-content';


  public static $inject = ['$http', '$q'];
  constructor(private $http: ng.IHttpService, private $q: ng.IQService) {
  }


  public loadSettings(settingsTarget: model.SettingsTarget): ng.IPromise<model.Settings> {
    var deferred = this.$q.defer<model.Settings>();
    var url;
    if (settingsTarget.type == 'WholeSite') {
      url = this.LoadSiteSettingsUrl;
    }
    else if (settingsTarget.type == 'PageTree') {
      url = this.LoadSectionSettingsUrl +'?rootPageId=' + settingsTarget.pageId;
    }
    else {
      // error('Unsupported settings target type: "${settingsTarget.type}" [DwE52FH435]');
    }
    this.$http.get(url).success((response) => {
      var settings = model.Settings.fromJsonMap(settingsTarget, response);
      deferred.resolve(settings);
    });
    return deferred.promise;
  }


  public saveSetting(setting: model.Setting<any>): ng.IPromise<void> {
    var deferred = this.$q.defer<void>();
    this.$http.post(this.SaveSettingUrl, setting.toJson()).success(() => {
      deferred.resolve();
    });
    return deferred.promise;
  }


  public loadSpecialContent(rootPageId: string, contentId: string):
        ng.IPromise<model.SpecialContent> {
    var deferred = this.$q.defer<model.SpecialContent>();
    var url = this.LoadSpecialContentUrl +'?rootPageId='+ rootPageId +'&contentId='+ contentId;
    this.$http.get(url).success((response) => {
      var specialContent = model.SpecialContent.fromJsonMap(response);
      deferred.resolve(specialContent);
    });
    return deferred.promise;
  }


  public saveSpecialContent(specialContent: model.SpecialContent): ng.IPromise<void> {
    var deferred = this.$q.defer<void>();
    this.$http.post(this.SaveSpecialContentUrl, specialContent.toJson()).success(() => {
      deferred.resolve();
    });
    return deferred.promise;
  }


  public loadRecentPosts(): ng.IPromise<moderation.Post[]> {
    var deferred = this.$q.defer<moderation.Post[]>();
    this.$http.get(this.RecentPostsUrl).success((response) => {
      var posts: moderation.Post[] = [];
      for (var i = 0; i < response.actions.length; ++i) {
        var postJson = response.actions[i];
        var post: moderation.Post = moderation.Post.fromJson(postJson);
        posts.push(post);
      }
      deferred.resolve(posts);
    });
    return deferred.promise;
  }


  public approvePost(post: moderation.Post): ng.IPromise<void> {
    return this.doSomethingWithPost2(post, '/-/approve');
  }

  public hideNewPostSendPm(post: moderation.Post): ng.IPromise<void> {
    return this.doSomethingWithPost2(post, '/-/hide-new-send-pm');
  }

  public hideFlaggedPostSendPm(post: moderation.Post): ng.IPromise<void> {
    return this.doSomethingWithPost2(post, '/-/hide-flagged-send-pm');
  }

  public deletePost(post: moderation.Post): ng.IPromise<void> {
    return this.doSomethingWithPost2(post, '/-/delete');
  }

  public clearFlags(post: moderation.Post): ng.IPromise<void> {
    return this.doSomethingWithPost2(post, '/-/clear-flags');
  }

  private doSomethingWithPost2(post: moderation.Post, actionUrl: string): ng.IPromise<void> {
    var deferred = this.$q.defer<void>();
    this.$http.post(actionUrl, this.postToJson2(post)).success((data) => {
      deferred.resolve();
    });
    return deferred.promise;
  }

  private postToJson2(post: moderation.Post): string {
    return '[{ "pageId": "'+ post.pageId +'", "postId": '+ post.id +' }]';
  }
}


adminApp.service('QueryService', QueryService);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
