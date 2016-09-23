/*
 * Copyright (c) 2015-2016 Kaj Magnus Lindberg
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

/// <reference path="../Server.ts" />

// Things in editor-bundle.js that we can access from outside the bundle,
// once it's been loaded already.
declare namespace  debiki2.editor {
  function getOrCreateEditor(success: (editor: any) => void);
  function startMentionsParserImpl(textarea, onTextEdited);
}


//------------------------------------------------------------------------------
   module debiki2.editor {
//------------------------------------------------------------------------------


function ensureEditorCreated(success: (editor: any) => void) {
  Server.loadEditorEtcScriptsAndLater(() => {
    debiki2.editor.getOrCreateEditor(success);
  });
}


export function startMentionsParser(textarea, onTextEdited) {
  Server.loadEditorEtcScriptsAndLater(() => {
    debiki2.editor.startMentionsParserImpl(textarea, onTextEdited);
  });
}


export function toggleWriteReplyToPost(postId: number, anyPostType?: number) {
  ensureEditorCreated(editor => {
    editor.toggleWriteReplyToPost(postId, anyPostType);
  });
}


export function openEditorToEditPost(postId: number, onDone?) {
  ensureEditorCreated(editor => {
    editor.editPost(postId, onDone);
  });
}


export function editNewForumPage(categoryId: number, role: PageRole) {
  ensureEditorCreated(editor => {
    editor.editNewForumPage(categoryId, role);
  });
}


export function openToEditChatTitleAndPurpose() {
  ensureEditorCreated(editor => {
    editor.openToEditChatTitleAndPurpose();
  });
}


export function openToWriteChatMessage(text: string, onDone) {
  ensureEditorCreated(editor => {
    editor.openToWriteChatMessage(text || '', onDone);
  });
}


export function openToWriteMessage(userId: number) {
  ensureEditorCreated(editor => {
    editor.openToWriteMessage(userId);
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
