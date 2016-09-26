/* Layouts comment threads, e.g. changes width depending on deepest reply.
 * Copyright (C) 2012 Kaj Magnus Lindberg
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


d.i.layoutThreads = function() {
  // (converted from LiveScript, therefore looks a bit funny)
  var i$, ref$, len$, thread, maxNesting, width, $thread;
  // Increase width if there are many replies.
  for (i$ = 0, len$ = (ref$ = $('.DW.dw-hz .dw-t.dw-depth-1')).length; i$ < len$; ++i$) {
    thread = ref$[i$];
    maxNesting = findMaxNesting(thread);
    width = 333 + maxNesting * 33;
    width = Math.min(500, width);
    $thread = $(thread);
    // Hack: Is this a YouTube video thread? Then set width 480, that's how wide
    // the videos want to be. Set 505px though because there's padding, and jQuery 1.7
    // doesn't understand box-sizing: border-box; [fix_when_upgraded_jquery]
    if ($thread.find('> .dw-p .dw-ob-youtube').length) {
      width = Math.max(width, 505);
    }
    $thread.css('width', width + 'px');
  }
};


function findMaxNesting(thread) {
  var $children = $(thread).find('> .dw-single-and-multireplies > .dw-res > .dw-t');
  var children = $children.toArray();
  var max = 0;
  for (var i = 0; i < children.length; ++i) {
    var child = children[i];
    var childMax = 1 + findMaxNesting(child);
    if (childMax > max) {
      max = childMax;
    }
  }
  return max;
}


/**
 * If the URL query string contains 2d=true/false, enables/disables
 * horizontal comments. If the screen is narrow, forces one-column-layout.
 * Returns the layout type in use: 'OneColumnLayout' or 'TreeLayout'.
 */
d.i.chooseLayout = function(){
  var shallEnable2d = window.location.toString().search('2d=true') !== -1;
  var shallDisable2d = window.location.toString().search('2d=false') !== -1 ||
      // use window.outerWidth — it doesn't force a layout reflow (and it's fine that it might
      // be a bit inexact because of browser window borders).
      Math.max(window.outerWidth, window.outerHeight) < 1000;
  var is2dEnabled = $('html').is('.dw-hz');
  if (is2dEnabled && shallDisable2d) {
    disableHzComments();
    return 'OneColumnLayout';
  }
  if (!is2dEnabled && shallEnable2d) {
    enableHzComments();
    return 'TreeLayout';
  }

  function disableHzComments(){
    $('html').removeClass('dw-hz').addClass('dw-vt');
    $('.dw-depth-0').removeClass('dw-hz');
    debiki2.ReactActions.setHorizontalLayout(false);
  }

  function enableHzComments(){
    $('html').removeClass('dw-vt').addClass('dw-hz');
    $('.dw-depth-0').addClass('dw-hz');
    debiki2.ReactActions.setHorizontalLayout(true);
  }

  if (is2dEnabled) {
    return 'TreeLayout';
  }
  else {
    return 'OneColumnLayout';
  }
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
