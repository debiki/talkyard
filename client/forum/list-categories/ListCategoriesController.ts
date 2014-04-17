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
/// <reference path="../ForumApp.ts" />

//------------------------------------------------------------------------------
   module forum {
//------------------------------------------------------------------------------

interface ListCategoriesScope extends CategoryScope {
  categoryDetails: Category[];
}


class ListCategoriesController {

  public static $inject = ['$scope', 'QueryService'];
  constructor(private $scope: ListCategoriesScope, private queryService: QueryService) {
    $scope.mv = this;
    this.loadCategoryDetails();
  }


  private loadCategoryDetails() {
    this.queryService.loadCategoryDetails().then((categoryDetails: Category[]) => {
      this.$scope.categoryDetails = categoryDetails;
    });
  }

}


forum.forumApp.controller('ListCategoriesController', ListCategoriesController);


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
