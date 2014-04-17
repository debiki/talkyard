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

/// <reference path="ForumApp.ts" />
/// <reference path="plain-old-javascript.d.ts" />

//------------------------------------------------------------------------------
   module forum {
//------------------------------------------------------------------------------


export class QueryService {

  private forumId: string = this.getForumId();
  private forumData: ForumData = new ForumData();


  public static $inject = ['$http', '$q', 'CategoryService'];
  constructor(private $http: ng.IHttpService, private $q: ng.IQService,
      private categoryService: CategoryService) {

    // Initialize forumData.categoriesById.
    var categories = categoryService.allCategories;
    for (var i = 0; i < categories.length; ++i) {
      var category: Category = categories[i];
      this.forumData.categoriesById[category.pageId] = category;
    }
  }


  public loadTopics(categoryId: string): ng.IPromise<Topic[]> {
    var deferred = this.$q.defer<Topic[]>();
    if (!categoryId) {
      categoryId = this.forumId;
    }
    this.$http.get('/-/list-topics?categoryId=' + categoryId).success((response) => {
      var topics: Topic[] = [];
      for (var i = 0; i < response.topics.length; ++i) {
        var data = response.topics[i];
        var t = new Topic(this.forumData, data.id);
          t.title = data.title;
          t.url = data.url;
          t.mainCategoryId = data.mainCategoryId;
          t.numPosts = data.numPosts;
          t.numLikes = data.numLikes;
          t.numWrongs = data.numWrongs;
          t.firstPostAt = data.firstPostAt;
          t.lastPostAt = data.lastPostAt;
        topics.push(t);
      }
      deferred.resolve(topics);
    });

    return deferred.promise;
  }

  /**
   * The fourm id is the same as the page id.
   */
  private getForumId(): string {
    // The page id is encoded in the HTML.
    return debiki.getPageId();
  }
}


forum.forumApp.service('QueryService', QueryService);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
