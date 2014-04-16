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
 * current category selection, clears the current choice of categories.
 */
export class CategoryService {

  private _selectedCategories = [];
  private _allCategories;


  public static $inject = ['$rootScope'];
  constructor(private $rootScope) {
    this.setupCategories();
  }


  public get selectedCategories() {
    return this._selectedCategories;
  }


  public get allMainCategories() {
    // Currently the same as:
    return this._allCategories;
  }


  public clearCurrentCategories() {
    // Keep the original array, there might be other references to it that
    // should be updated too.
    this._selectedCategories.length = 0;
  }


  /**
   * Updates currentMainCategory and currentSubCategory given
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

    for (var i = 0; i < this._allCategories.length; ++i) {
      var category = this._allCategories[i];
      if (category.slug === categoryPath[0]) {
        this._selectedCategories.push(category);
        break;
      }
    }

    // In the future: if $categoryPath.length > 1, then push that category
    // to _selectedCategories.

    if (!this._selectedCategories.length) {
      this.changeCategory('');
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
   * $rootScope. (Ooops services shouldn't update scopes!)
   */
  private setupCategories() {
    var pageDataText = $('#dw-page-data').text() || '{}'
    var pageDataJson = JSON.parse(pageDataText)
    this._allCategories = pageDataJson.categories || []
  }


  public changeCategory(newCategorySlug: string) {
    var $state = this.$rootScope.$state;
    var nextState = '.';
    // The 'categories' and 'index' states cannot be combined with any category,
    // so switch to the 'latest' state instead.
    if ($state.is('categories') || $state.is('index')) {
      nextState = 'latest';
    }
    $state.go(nextState, { categoryPath: newCategorySlug });
    // The relevant `state.onEnter` function in ForumApp-impl.ts will call
    // `this.updateCurrentCategories` once the state transition has happened.
  }
}


forum.forumApp.service('CategoryService', CategoryService);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: et ts=2 sw=2 tw=0 fo=tcqwn list
