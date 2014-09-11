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


/// <reference path="../plain-old-javascript.d.ts" />

var d = { i: debiki.internal, u: debiki.v0.util };
var ui$: any = $; // allows jQuery UI functions without Typescript complaining


if (!d.i.isInIframe) {
  $(document).on('dwEvAngularStarted', makeEditorResizable);
}


/**
 * Makes the editor resizable. Could be an Angular directive, but then it'd be
 * activated also for the embedded editor, which it shouldn't be (when the editor
 * is placed in an iframe, we need to resize the iframe not just the editor inside).
 */
function makeEditorResizable() {
  var placeholder = ui$('#debiki-editor-placeholder');
  var editor = ui$('#debiki-editor-controller');
  editor.css('border-top', '8px solid #888');
  editor.resizable({
    handles: 'n',
    resize: function() {
      placeholder.height(editor.height());
    }
  });
}
