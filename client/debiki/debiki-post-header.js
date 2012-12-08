/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


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

  // Show detailed rating and flags info, on post header click.
  // Show exact creation date and edit date, if you click again.
  // On a third click, hide everything.
  if ($hdr.dwPostHeaderFindStats().length
      ) $hdr.css('cursor', 'help').click(function(event) {
    if ($(event.target).is('a'))
      return;  // don't expand header on link click
    var $i = $(this);
    var $stats = $i.dwPostHeaderFindStats();
    var $times = $i.dwPostHeaderFindExactTimes();
    if ($stats.is(':hidden')) {
      $stats.show();
    }
    /// Skip this for now, rewrite so dates are appended, don't
    /// insert in the middle.
    // else if ($times.is(':hidden')) {
    //  $times.show();
    else {
      $times.hide();
      $stats.hide();
    }
    // This might have expanded the post, so redraw arrows.
    $i.closest('.dw-p').each(d.i.SVG.$drawParents);
  });

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
};


// Create tooltips lazily.
$(function() {
  $('.debiki').delegate('.dw-p-hd', 'mouseenter', $makePostHeadTooltips);
});


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
