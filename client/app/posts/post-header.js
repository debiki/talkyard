/* Prettifies date and author info about a post, shows tooltips.
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


var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.makePostHeaderPretty = function($hdr) {
  var $postedAt = $hdr.children('.dw-p-at'),
      postedAtTitle = $postedAt.attr('title'),
      postedAt = d.u.isoDateToMillis(postedAtTitle),
      $editedAt = $hdr.find('> .dw-p-hd-e > .dw-p-at'),
      editedAtTitle = $editedAt.attr('title'),
      editedAt = d.u.isoDateToMillis(editedAtTitle),
      now = new Date();  // COULD cache? e.g. when initing all posts

  // Show pretty how-long-ago info. (The $posted/editedAt are already hidden.)
  $postedAt.before(timeAgoAbbr(postedAtTitle, postedAt, now));
  $editedAt.before(timeAgoAbbr(editedAtTitle, editedAt, now));

  function timeAgoAbbr(title, then, now) {
    return $('<abbr title="'+ title +'">'+ d.u.prettyTimeBetween(then, now) +
        '</abbr>');
  };
};


function $makePostHeadTooltips() {  // i18n
  if (!$.fn.tooltip) return; // tooltips not loaded
  var $postHead = $(this);
  if ($postHead.find('[data-original-title]').length)
    return; // tooltips already added

  // Tooltips explaining '?' and '??' login type indicators.
  $postHead.find('.dw-lg-t-spl').each(function() {
    var tip;
    var $i = $(this);
    if ($i.text() == '??') {
      tip = '<b>??</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' and not specified any email address.'
      // better?: does not receive email notifications.'
    }
    else if ($i.text() == '?') {
      tip = '<b>?</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' but has specified an email address.'
        // and receives email notifications.'
    }
    else d.u.die();

    $i.tooltip({
      title: tip,
      placement: 'right' // or '?' cursor hides tooltip arrow
    });
  });

  $postHead.find('.dw-p-link').each(function() {
    var $i = $(this);
    $i.tooltip({
      title: 'The ID of this post. Click to copy permalink.',
      // Re placement: I'd prefer 'left'a or 'top' but then some bug
      // (not mine?!) breaks the tooltip in two:
      //    [tooltip text]  ...whitespace...  |> (the tip)
      placement: 'right'
    });
    if (!Modernizr.touch) $i.click(function() {
      var hash = '#post-' + $i.text().substring(1); // drops '#' from '#id'
      var url = window.location.host + '/-' + debiki.getPageId() + hash;
      window.prompt("To copy permalink, press Ctrl+C then Enter", url);
    });
  });
};


// Create tooltips lazily.
$(function() {
  $('.debiki').delegate('.dw-p-hd', 'mouseenter', $makePostHeadTooltips);
});


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
