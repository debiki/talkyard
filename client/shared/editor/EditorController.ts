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
var d$: any = $;


class EditorController {

  public static $inject = ['$scope', 'EditorService'];
  constructor(private $scope: any, private editorService: EditorService) {
    this.closeEditor();
    $scope.vm = this;
  }


  public toggleReplyToPost(postId) {
    if (this.$scope.editingPostId) {
      alert('Please finish editing before writing a reply');
      return;
    }
    var index = this.$scope.replyToPostIds.indexOf(postId);
    if (index === -1) {
      this.$scope.replyToPostIds.push(postId);
      return true;
    }
    else {
      this.$scope.replyToPostIds.splice(index, 1);
      if (this.$scope.replyToPostIds.length == 0) {
        this.closeEditor();
      }
      return false;
    }
  }


  public startEditing(postId) {
    if (this.$scope.replyToPostIds.length > 0) {
      alert('Please finish writing your post before starting editing another one');
      return;
    }
    this.$scope.editingPostId = postId;
    this.editorService.loadCurrentText(postId).then((currentText) => {
      this.$scope.text = currentText;
      this.$scope.visible = true;
    });
  }


  public cancel() {
    this.closeEditor();
  }


  public save() {
    if (typeof this.$scope.editingPostId === 'number') {
      this.saveEdits();
    }
    else {
      this.saveNewPost();
    }
  }


  private saveEdits() {
    var editingPostId = this.$scope.editingPostId;

    // Here follows some old non-Angular code moved to here from actions/edit/edit.js.
    var pageMeta = d$('#post-' + editingPostId).dwPageMeta();
    var pagesToCreate = [];
    if (!pageMeta.pageExists) {
      // When the server generated this page, which doesn't exist,
      // it included a passhash in the URL, which we need to send back
      // to the server, so it knows that the server itself actually
      // generated the page creation data (and that the client cannot e.g.
      // forge a mallicious id).
      // (It's okay to mutate pageMeta a little bit.)
      pageMeta.passhash = d.i.parsePasshashInPageUrl();
      pageMeta.newPageApproval = d.i.parseApprovalInPageUrl();
      // Push don't unshift; http://server/-/edit expects them in that order.
      pagesToCreate.push(pageMeta);
    }

    var data = {
      createPagesUnlessExist: pagesToCreate,
      editPosts: [{
        pageId: pageMeta.pageId,
        postId: '' + editingPostId, // COULD stop requiring a number
        text: this.$scope.text
        // markup — skip, don't allow changing markup no more?
      }]
    };

    this.editorService.saveEdits(data).then(() => {
      this.closeEditor();
    });
  }


  private saveNewPost() {
    if (this.$scope.replyToPostIds.length > 1) {
      alert('Replying to more than one person not yet implemented – please ' +
        'de-select some comments, so only one reply button remains selected.');
      return;
    }
    var data = {
      pageId: d.i.pageId,
      parentPageId: undefined, // ??? anyParentPageId,
      pageUrl: d.i.iframeBaseUrl || undefined,
      postId: this.$scope.replyToPostIds[0],
      text: this.$scope.text
      // where: ...
    };
    this.editorService.saveReply(data).then(() => {
      this.closeEditor();
    });
  }


  public closeEditor() {
    if (this.$scope.editingPostId) {
      this.$scope.text = '';
    }
    else {
      // The user was authoring a reply. Don't reset $scope.text in case
      // s/he clicked Cancel by mistake.
    }
    this.$scope.visible = false;
    this.$scope.replyToPostIds = [];
    this.$scope.editingPostId = null;
    // Not Angular style, well I'll port to React instead anyway:
    $('.dw-replying').removeClass('dw-replying');
  }

}


debiki2.editor.editorModule.controller("EditorController", EditorController);
