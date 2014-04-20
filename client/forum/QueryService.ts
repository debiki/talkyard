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


export enum TopicSortOrder {
  ByBumpTime,
  ByNumLikes,
}


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


  public loadTopics(categoryId: string, sortOrder: TopicSortOrder): ng.IPromise<Topic[]> {
    var deferred = this.$q.defer<Topic[]>();
    if (!categoryId) {
      categoryId = this.forumId;
    }
    var url = '/-/list-topics?categoryId=' + categoryId +
        '&sortOrder=' + TopicSortOrder[sortOrder];

    this.$http.get(url).success((response) => {
      var topics: Topic[] = [];
      for (var i = 0; i < response.topics.length; ++i) {
        var data = response.topics[i];
        var t = Topic.fromJson(this.forumData, data);
        topics.push(t);
      }
      deferred.resolve(topics);
    });
    return deferred.promise;
  }


  /**
   * Loads all categories including descriptions and topic counts and links to
   * a few recent topics.
   */
  public loadCategoryDetails(): ng.IPromise<Category[]> {
    var deferred = this.$q.defer<Category[]>();
    this.$http.get('/-/list-categories?forumId=' + this.forumId).success((response) => {
      var categories: Category[] = [];
      for (var i = 0; i < response.categories.length; ++i) {
        var data = response.categories[i];
        var c = Category.fromJson(this.forumData, data);
        categories.push(c);
      }
      deferred.resolve(categories);
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
