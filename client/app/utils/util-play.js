/* Utilities related to Debiki's Play Framework application.
 * Copyright (C) 2010-2013 Kaj Magnus Lindberg (born 1979)
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

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.pageConfigPostId = '65503';


function confirmClosePage() {
  // If there're any reply forms with non-empty replies (textareas),
  // or any edit forms, then return a confirm close message.
  // (COULD avoid counting unchanged edits too.)
  // Count only :visible forms — non-visible forms are 1) hidden template
  // forms and 2) forms the user has closed. They aren't removed, because
  // it's nice to have your text reappear should you accidentally close
  // a form, but open it again.
  var replyCount = $('.dw-fs-re:visible').filter(function() {
    return $(this).find('textarea').val().length > 0;
  }).length;
  var editCount = $('.dw-f-e:visible').length;
  var msg = replyCount + editCount > 0 ?  // i18n
    'You have started writing but not saved your work. Really close page?' :
    undefined;  // don't return null, or IE asks roughly `confirm null?'
  return msg;
};


window.onbeforeunload = confirmClosePage;


/**
 * Returns the text of the title of the page in which the current $ elem
 * is located.
 */
$.fn.dwPageTitleText = function() {
  var $page = this.closest('.dw-page');
  var $title = $page.find('.dw-p.dw-p-ttl .dw-p-ttl');
  return $title.text();
};


/**
 * For now only. Would be better to hide stuff via CSS? Perhaps add a
 * clarifying message at the top of the page, server side?
 */
d.i.isViewingOldPageVersion = function() {
  return window.location.toString().search('&version=') !== -1;
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
