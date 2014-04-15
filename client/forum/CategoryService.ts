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

//------------------------------------------------------------------------------
   module forum {
//------------------------------------------------------------------------------


/**
 * Knows about all categories in the forum: lists categories, changes the
 * current category, clears the current choice of main and sub categories.
 *
 * Ooops! Modifies a scope. Then it should be a controller instead, only
 * controllers should modify scopes? Perhps I should split it into 1 service
 * and 1 controller?
 */
export class CategoryService {

  public static $inject = ['$rootScope'];
  constructor(private $rootScope) {
    this.setupCategories();
  }


  public listCategories() {
    return this.$rootScope.categories;
  }


  public clearCurrentCategories() {
    this.$rootScope.currentMainCategory = null;
    this.$rootScope.currentSubCategory = null;
  }


  /**
   * Updates $rootScope.currentMainCategory and $rootScope.currentSubCategory given
   * the categories listed in the URL.
   */
  public updateCurrentCategories($stateParams) {
    var categoryPath = this.parseCategoryPath($stateParams.categoryPath);
    console.log('$stateParams: ' + $stateParams);
    console.log('$stateParams.categoryPath: ' + $stateParams.categoryPath);
    console.log('cat path: ' + categoryPath);

    this.clearCurrentCategories();
    if (categoryPath.length == 0)
      return;

    var categories = this.$rootScope.categories;
    for (var i = 0; i < categories.length; ++i) {
      var category = categories[i];
      if (category.slug === categoryPath[0]) {
        this.$rootScope.currentMainCategory = category;
        break;
      }
    }

    // In the future: if $categoryPath.length > 1, then update $rootScope.currentSubCategory.

    if (!this.$rootScope.currentMainCategory) {
      this.$rootScope.changeCategory('');
    }
  }


  private parseCategoryPath(categoryPath: string): string[] {
    var path = categoryPath;
    if (!path || path.length == 0)
      return [];

    var paths = path.split('/');
    return paths;
  }


  /**
   * The server includes info on any blog or forum categories so we won't need
   * to ask for that separately. This function parses that data and adds  it to the
   * $rootScope. And also adds a function `$rootScope.changeCategory(newCategorySlug)`.
   */
  private setupCategories() {
    var pageDataText = $('#dw-page-data').text() || '{}'
    var pageDataJson = JSON.parse(pageDataText)
    var $state = this.$rootScope.$state;
    this.$rootScope.categories = pageDataJson.categories || []

    this.$rootScope.changeCategory = function(newCategorySlug: string) {
      var nextState = '.';
      // The 'categories' and 'index' states cannot be combined with any category,
      // so switch to the 'latest' state instead.
      if ($state.is('categories') || $state.is('index')) {
        nextState = 'latest';
      }
      $state.go(nextState, { categoryPath: newCategorySlug });
    }
  }
}


forum.forumApp.service('CategoryService', CategoryService);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
