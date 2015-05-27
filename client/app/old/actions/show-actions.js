/*
 * Copyright (C) 2010 - 2014 Kaj Magnus Lindberg (born 1979)
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


d.i.showPostActions = function(node) {
    if (!debiki2.utils.isMouseDetected)
      return;

    var $i = $(node);

    // If a more-actions dropdown has been opened, let it stay in focus, don't
    // show any new actions.
    if ($('.dw-p-as-more:visible').length)
      return;

    // If actions are already shown for an inline child post, ignore event.
    // (Sometimes the mouseenter event is fired first for an inline child
    // post, then for its parent — and then actions should be shown for the
    // child post; the parent should ignore the event.)
    var inlineChildActionsShown = $i.find('#dw-p-as-shown').length;

    // If the post is being edited, show no actions.
    // (It's rather confusing to be able to Reply to the edit <form>.)
    var isBeingEdited = $i.children('.dw-f-e:visible').length;

    if (isBeingEdited)
      hideActions();
    else if (!inlineChildActionsShown)
      $i.each(d.i.$showActions);
    // else leave actions visible, below the inline child post.
};


// Shows actions for the current post, or the last post hovered.
d.i.$showActions = function() {
  if (!debiki2.utils.isMouseDetected)
    return;

  var actions = $(this).closest('.dw-t').children('.dw-as');
  // Hide any action links already shown; show actions for one post only.
  hideActions(actions);
  // Show links for the the current post.
  actions
    .stop()
    .addClass('dw-p-as-shown')
    .animate({ opacity: 1 }, 400, 'linear') // [8GUfB0]
    .attr('id', 'dw-p-as-shown');
};


function hideActions(anyActionsToShowInstead) {
  if (!debiki2.utils.isMouseDetected)
    return;

  var actionsToHide = $('#dw-p-as-shown');
  if (actionsToHide.length && anyActionsToShowInstead && anyActionsToShowInstead.length &&
      actionsToHide[0] === anyActionsToShowInstead[0])
    return;

  actionsToHide
      .stop()
      .animate({ opacity: 0.15 }, 400, 'linear', function() { // [8GUfB0]
        $(this).removeClass('dw-p-as-shown');
      })
      .removeAttr('id');
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
