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


class EditorController {

  public static $inject = ['$scope', 'EditorService'];
  constructor(private $scope: any, private editorService: any) {
    this.closeEditor();
    $scope.vm = this;
  }


  public toggleReplyToPost(postId) {
    var index = this.$scope.replyToPostIds.indexOf(postId);
    if (index === -1) {
      this.$scope.replyToPostIds.push(postId);
      return true;
    }
    else {
      this.$scope.replyToPostIds.splice(index, 1);
      return false;
    }
  }


  public cancel() {
    this.closeEditor();
  }


  public save() {
    if (this.$scope.editor.replyToPostIds.length > 1) {
      alert('Replying to more than one person not yet implemented – please ' +
        'de-select some comments, so only one reply button remains selected.');
      return;
    }
    var data = {
      pageId: d.i.pageId,
      parentPageId: undefined, // ??? anyParentPageId,
      pageUrl: d.i.iframeBaseUrl || undefined,
      postId: this.$scope.editor.replyToPostIds[0],
      text: this.$scope.text
      // where: ...
    };
    this.editorService.save(data).then(() => {
      this.closeEditor();
    });
  }


  public closeEditor() {
    this.$scope.visible = false;
    this.$scope.replyToPostIds = [];
  }

}


debiki2.editor.editorModule.controller("EditorController", EditorController);
