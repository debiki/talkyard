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

/// <reference path="../typedefs/angularjs/angular.d.ts" />
/// <reference path="../typedefs/lodash/lodash.d.ts" />
/// <reference path="../ForumApp.ts" />

//------------------------------------------------------------------------------
   module forum {
//------------------------------------------------------------------------------


class CategoryController {

  public static $inject = ['$scope', 'CategoryService'];
  constructor(private $scope: CategoryScope, private categoryService: CategoryService) {
    $scope.selectedCategories = categoryService.selectedCategories;
    $scope.allMainCategories = categoryService.allMainCategories;
    $scope.mv = this;
  }


  public changeCategory(newCategorySlug: string) {
    this.categoryService.changeCategory(newCategorySlug);
  }


  public get selectedCategoryId() {
    var anySelectedCategory = _.last<Category>(this.$scope.selectedCategories);
    if (!anySelectedCategory) {
      return null;
    }
    return anySelectedCategory.pageId;
  }


  public get selectedCategoryOrForumId() {
    var anyCategoryId = this.selectedCategoryId;
    if (!anyCategoryId) {
      // Return the forum id.
      return this.$scope.pageId;
    }
    return anyCategoryId;
  }


  public editCategory() {
    // No idea why, but in Chrome, this:
    //   window.open('/-' + this.selectedCategoryOrForumId, '_self');
    // results in an error:
    //   "Script on the page used too much memory. reload to enable scripts again"
    // However, this works fine:
    location.href = '/-' + this.selectedCategoryOrForumId;
  }


  public createCategory() {
    this.createChildPage('ForumCategory');
  }


  public createTopic() {
    this.createChildPage('ForumTopic');
  }


  private createChildPage(role: String) {
    debiki.internal.createChildPage({
      pageRole: role,
      parentPageId: this.selectedCategoryOrForumId,
      status: 'Published',
      window: window
    });
  }

}


forum.forumApp.controller("CategoryController", CategoryController);

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
