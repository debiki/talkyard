/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.$showRatingForm = function(event) {
  event.preventDefault();
  if (lazyInit) {
    lazyInit();
    lazyInit = null;
  }

  var $thread = $(this).closest('.dw-t');
  var $post = $thread.children('.dw-p');
  var $formParent = findRateFormTemplate().clone(true);
  var $rateForm = $formParent.children('form');
  var $rateAction = $thread.find(' > .dw-p-as > .dw-a-rate');
  var $submitBtn = $rateForm.find('input[type="submit"]');
  var $cancelBtn = $rateForm.find('input.dw-fi-cancel');
  var postId = $post.dwPostId();

  // The rating-value inputs are labeled checkboxes. Hence they
  // have ids --- which right now remain the same as the ids
  // in the rate form template. Make the cloned ids unique:
  d.u.makeIdsUniqueUpdateLabels($formParent);

  // If the user has already rated the $post, show a
  // you're-changing-your-ratings tips, instead of
  // the you-can-select-many-tags tips.
  if ($post.find('.dw-p-hd > .dw-p-r-by-me').length) {
    $rateForm.find('.dw-f-r-inf-many').hide();
    $rateForm.find('.dw-f-r-inf-changing').css('display', 'block');
  }

  // People sometimes unintentionally open many rating forms, unless:
  $rateAction.dwActionLinkDisable();
  $cancelBtn.click(function() { $rateAction.dwActionLinkEnable(); });

  // Enable submit *button* when ratings specified
  $formParent.find("input[type='checkbox']").click(function(){
    var numChecked = $rateForm.find('.ui-button.ui-state-active').length;
    $submitBtn.button('option', 'disabled', numChecked == 0)
    if (numChecked > 0) $rateForm.find('input.dw-fi-submit').focus();
  });

  // Ajax-post ratings on submit.
  //  - Disable form until request completed.
  //  - When completed, highlight the user's own ratings.
  $formParent.submit(function(){
    // Find selected rating tags, so they can be highlighted later.
    var ratedTags = $formParent.find("input:checked").map(function(){
      return $(this).val().toLowerCase();
    }).get();

    $.post('?rate='+ postId +'&view='+ d.i.rootPostId, $rateForm.serialize(),
        'html')
        .done(function(recentChangesHtml) {
      d.i.slideAwayRemove($formParent);
      $rateAction.dwActionLinkEnable();
      d.i.mergeChangesIntoPage(recentChangesHtml);
      var $ratings = d.i.showMyRatings(postId, ratedTags);
      // Minor bug: On my Android phone, when I rate a post at the very
      // bottom of the page, then, since the `slideAwayRemove` animation
      // plays at the same time as the below `dwScrollToThenHighlight`
      // animation, the dwScrollIntoView animation is distorted, and
      // the ratings won't be properly scrolled into view.
      $post.dwPostFindHeader().dwScrollToThenHighlight($ratings);
      $post.each(d.i.SVG.$drawParentsAndTree);
    });

    d.i.disableSubmittedForm($rateForm);
    return false;
  });

  // Fancy fancy
  // Seems this must be done *after* the rate form template has been
  // copied --- otherwise, if the Cancel button is clicked,
  // the rate form template itself has all its jQueryUI markup removed.
  // (Is that a jQuery bug? Only the *clone* ought to be affected?)
  $formParent.find('.dw-r-tag-set input, .dw-submit-set input').button();
  // Disable the submit button (until any checkbox clicked)
  $formParent.find("input[type='submit']").button("option", "disabled", true);
  $formParent.find('.dw-show-more-r-tags').
    button().addClass('dw-ui-state-default-linkified');

  var $actionBtns = $thread.children('.dw-p-as');

  $formParent.insertAfter($actionBtns).show()
      .find('input[type="submit"]').each(d.i.$loginSubmitOnClick());
  $post.each(d.i.SVG.$drawParentsAndTree);

  $rateForm.dwScrollIntoView();
};


function lazyInit() {
  // Show more rating tags on "More..." click.
  findRateFormTemplate().find('.dw-show-more-r-tags').click(function () {
    $(this).hide().closest('form').find('.dw-more-r-tags').show();
  });
};


function findRateFormTemplate() {
  return $("#dw-hidden-templates .dw-fs-r");
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
