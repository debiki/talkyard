/* Shows comments when clicking a "Show interactions" link/button.
 * Copyright (C) 2010-2012 Kaj Magnus Lindberg (born 1979)
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

(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Shows all comments, which should have been hidden via the
// DebateHtml$ hideCommentsStyle, in html.scala.
// Only do this if the article itself is shown though.
debiki.v0.showInteractionsOnClick = function() {
  // Always show comments if the page body is not the root post.
  // (That is, if the article isn't shown, but a plain comment.
  // Otherwise people could create "fake" pages, by creating 
  // a comment and linking it with ?view=<comment-id> and it would
  // seem to be a page itself!)
  if ($('.dw-ar-p').length === 0) {  // article post not present?
    $('html').removeClass('dw-hide-interactions');
    return;
  }

  var numComments = $('.dw-p').length - 1;  // don't count the article
  if ($('.dw-p-ttl').length) numComments -= 1; // don't count article title
  var text = numComments > 1 ?  'Visa '+ numComments +' kommentarer' : // i18n
     (numComments == 1 ?  'Visa 1 kommentar' : 'Lämna en kommentar');
  var $showBtn = $(
      '<li class="dw-as dw-p-as-hz">' +
      '<a class="dw-a dw-a-show-interactions"></a></li>');
  $showBtn.find('a')
      .text(text)  // xss safe
      .css('font-size', '80%')
      .end()
      .insertBefore('.dw-ar-t > .dw-res')
      .click(function() {
    $showBtn.remove();
    $('html').removeClass('dw-hide-interactions');
    d.i.SVG.drawEverything(); // *sometimes* needed
  });
};


d.i.showInteractionsIfHidden = function() {
  // If they're hidden, there's a button that shows them.
  $('.dw-a-show-interactions').click();
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

