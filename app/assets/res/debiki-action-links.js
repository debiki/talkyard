/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Shows actions for the current post, or the last post hovered.
d.i.$showActions = function() {
  // Hide any action links already shown; show actions for one post only.
  d.i.hideActions();
  // Show links for the the current post.
  $(this).closest('.dw-t').children('.dw-as')
    .css('visibility', 'visible')
    .attr('id', 'dw-p-as-shown');
}


d.i.hideActions = function() {
  $('#dw-p-as-shown')
      .css('visibility', 'hidden')
      .removeAttr('id');
}


$.fn.dwActionLinkEnable = function() {
  setActionLinkEnabled(this, true);
  return this;
}


$.fn.dwActionLinkDisable = function() {
  setActionLinkEnabled(this, false);
  return this;
}


function setActionLinkEnabled($actionLink, enabed) {
  if (!$actionLink.length) return;
  d.u.bugIf(!$actionLink.is('.dw-a'));
  if (!enabed) {
    // (Copy the event list; off('click') destroys the original.)
    var handlers = $actionLink.data('events')['click'].slice();
    $actionLink.data('DisabledHandlers', handlers);
    $actionLink.addClass('dw-a-disabled').off('click');
  } else {
    var handlers = $actionLink.data('DisabledHandlers');
    $actionLink.removeData('DisabledHandlers');
    $.each(handlers, function(index, handler) { 
      $actionLink.click(handler);
    });
    $actionLink.removeClass('dw-a-disabled');
  }
}


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
