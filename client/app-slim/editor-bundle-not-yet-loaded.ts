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

/// <reference path="Server.ts" />
/// <reference path="../app-editor/editor-bundle-already-loaded.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.editor {
//------------------------------------------------------------------------------


function ensureEditorCreated(success: (editor: any) => void) {
  Server.loadEditorAndMoreBundles(() => {
    debiki2.editor.getOrCreateEditor(success);
  });
}


function ifEditorCreated(then: (editor: any) => V) {
  if (debiki2['_editorCreated']) {
    debiki2.editor.getOrCreateEditor(then);
  }
  // Else: Noop.
}


export function toggleWriteReplyToPostNr(postNr: PostNr, inclInReply: boolean,
      anyPostType?: PostType, inWhichFrame?: MainWin) {
  ensureEditorCreated(editor => {
    editor.toggleWriteReplyToPostNr(postNr, inclInReply, anyPostType, inWhichFrame);
  });
}


export function openToEditPostNr(postNr: PostNr, onDone?: EditsDoneHandler,
        inWhichFrame?: MainWin) {
  ensureEditorCreated(editor => {
    editor.editPost(postNr, onDone, inWhichFrame);
  });
}


export function editNewForumPage(category: RefOrId, role: PageRole, inFrame?: MainWin) {
  ensureEditorCreated(editor => {
    editor.editNewForumPage(category, role, inFrame);
  });
}


export function openToEditChatTitleAndPurpose() {
  ensureEditorCreated(editor => {
    editor.openToEditChatTitleAndPurpose();
  });
}


export function openToWriteChatMessage(text: string, draft: Draft | undefined,
      draftStatus, onDone: EditsDoneHandler) {
  ensureEditorCreated(editor => {
    editor.openToWriteChatMessage(text || '', draft, draftStatus, onDone);
  });
}


export function openToWriteMessage(userId: PatId, inFrame?: DiscWin) {
  ensureEditorCreated(editor => {
    editor.openToWriteMessage(userId, inFrame);
  });
}


export function stopAutoScrollingToPreview() {
  ifEditorCreated(editor => {
    editor.stopAutoScrollingToPreview();
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
