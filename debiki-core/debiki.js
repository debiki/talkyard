// vim: fdm=marker et ts=2 sw=2

jQuery.noConflict()(function($){

var threadHovered = null;
var didResize = false;
var posts = $(".debiki .dw-post");

$(".dw-post, .dw-thread-info").hover(
  function(event){
    var nextThread = $(this).closest('.dw-thread');

    if ($(this).hasClass('dw-post')) {
      // Show the #action-menu, unless the thread is closing (A)
      // and unless the thread itself is already a .reply thread (B)
      // and unless the thread doesn't already have a vote-form (C)
      // or a reply-form child (D).
      // (C and D: Better not open many action forms at once.)
      if (!nextThread.hasClass('dw-collapsed') &&  // A
          !nextThread.hasClass('dw-reply') &&  // B
          !nextThread.children()
              .filter('.dw-reply, .dw-vote').length) {  // C, D
        $(this).after($('#dw-action-menu'))
      }
    }
    else if (nextThread.find('#dw-action-menu').length) {
      // This is a .thread-info and it has the #action-menu inside.
      // This is not a safe place for the menu! If this
      // .thread-info is clicked, the thread will
      // collapsed itself, and the #action-menu will be hidden inside
      // the collapsed thread -- the menu becomes buggy gone -- unless
      // moved to somewhere safe.
      $('#dw-hidden-menus').append($('#dw-action-menu'));
    }

    if (threadHovered && threadHovered[0] == nextThread[0])
      return;

    if ($(this).hasClass('dw-thread-info') &&
        !threadHovered.hasClass('dw-collapsed')) {
      // This .thread-info is not visible (it's only visible by default
      // if the thread is collapsed). Don't fade it in, because the user
      // might be navigating the #action-menu, and then we don't want
      // this .thread-info to appear below that menu. Instead,
      // only open the .thread-info if the threaad's *post* is hovered.
      return;
    }

    // Fade last thread-info, unless thread collapsed.
    if (threadHovered && !threadHovered.hasClass('dw-collapsed')) {
      threadHovered.children('.dw-thread-info')
                      .stop(true, true).fadeTo(1000, 0);
      threadHovered.stop(true, true)
          .removeClass('dw-demarcated')
          .removeClass('dw-demarcated-fx', 1000);
    }
    // Show thread-info for current thread.
    nextThread.children('.dw-thread-info').stop(true, true).fadeTo(600, 1);
    nextThread.stop(true, true)
        .addClass('dw-demarcated') // gives functionality instantly
        .addClass('dw-demarcated-fx', 600); // just for class animation effects
    threadHovered = nextThread;
  },
  function(event){
  });

$(".dw-thread-info").click(function() {
  var thread = $(this).closest(".dw-thread");
  if (! thread.hasClass('dw-demarcated')) return;
  thread
    .children(":not(.dw-thread-info)").stop(true,true).slideToggle(800)
    .end()
    .stop(true, true)
    .toggleClass('dw-collapsed')
    .toggleClass('dw-collapsed-fx', 600);
});

// Outline new posts
(function(){
  var myLastVersion = $.cookie('myLastPageVersion') || myLastPageVersion;
  var lastChangeDate =
        $('.dw-debate-info .dw-last-changed .dw-date').attr('title');
  var newPosts = posts.filter(function(index){
    return $(this).find('.dw-date').attr('title') > myLastVersion;
  })
  newPosts.closest('.dw-thread').addClass('dw-new');
})()

// Indicate which posts are cropped.
posts.filter('.dw-cropped-s').append(
    '<div class="dw-cropped-mark">. . . truncated</div>');

// Makes whole post visible on click.
//
posts.filter('.dw-cropped-s').click(function(){
  console.log('click: Removind cropped-s.');
  // (Some rather long posts are cropped, using max-width and -height.
  // Don't remove max-width, or some posts might end up rather wide.)
  $(this).closest('.dw-post').removeClass('dw-cropped-s');
})

// Make posts and threads resizable.
// Fails with a TypeError on Android: Cathching it and ignoring it.
// (On Android, posts and threads won't be resizable.)
try {
  posts
  .resizable({
      autoHide: true,
      start: function(event, ui) {
        // Remove max height and width restrictions.
        $(this).closest('.dw-post').removeClass('dw-cropped-s dw-cropped-e');
        didResize = true;
      }
     })
  .find('.ui-resizable-se')
    // Make the resize grip larger.
    .removeClass('.ui-icon-gripsmall-diagonal-se')  // exchange small grip...
    .addClass('ui-icon-grip-diagonal-se')  // ...against the normal one
  .end()
  // Remove max-height and -width when mouse *up* on the resize-e handle.
  // (This is a shortcut to reveal the whole post - only triggered if
  // *clicking* the resize handle, but not dragging it.)
  .find('.ui-resizable-e')
    .mouseup(function(){
      // (Removing only max-width usually results in nothing:
      // The thread usually has a max-width.).
      var post = $(this).closest('.dw-post');
      post.removeClass('dw-cropped-s dw-cropped-e');
      // Expand post eastwards if resize handle was clicked not dragged.
      // (Also expands southwards, but browsers usually expand to east first.)
      if (!didResize) post.css('width', null).css('height', null);
    })
  .end()
  .find('.ui-resizable-s, .ui-resizable-se')
    // Expand post southwards if resize handle was clicked not dragged.
    .mouseup(function(){
      if (!didResize) $(this).closest('.dw-post').css('height', null);
    })
  .end()
  .find('.ui-resizable-handle')
    .mousedown(function(){
      didResize = false;
    })
  .end();

  // Resize threads.
  // Bug: Resizing a thread might toggle it collapsed / expanded, since
  // a click on the .thread-info might happen.
  $('.debiki .dw-thread-info').each(function(index) {
    var thread = $(this).closest('.dw-thread');
    $(this).resizable({
        alsoResize: thread,
        handles: 'e',
        stop: function(event, ui) {
          // jQuery has added `height: ...' to the thread's style attribute.
          // Unless removed, the therad won't resize itself when child
          // threads are opened/closed.
          thread.css('height', null);
        }
      })
      // Add a resize icon.
      .children('.ui-resizable-e')
      .addClass('ui-icon ui-icon-grip-solid-vertical');
  });
}
catch (e) {
  if (e.name == 'TypeError') console.log(e.name +': Failed to make '+
      'post resizable. Ignoring error (this is a smartphone?)');
  else throw e;
}

$('#dw-action-menu .dw-vote').click(function(){
  // Warning: Some duplicated code, see .dw-reply click() below.
  var post = $(this).closest('.dw-thread').children('.dw-post');
  var vote = $('#dw-hidden-menus .dw-vote-template').children().clone(true);
  var postId = post.attr('id').substr(8, 999); // drop initial 'dw-post-'
  vote.find("input[name='post']").attr('value', postId);
  post.after(vote);
  // Dismiss action menu
  $('#dw-action-menu').appendTo($('#dw-hidden-menus'));
  // Enable submit button when votes specified
  vote.find("input[type='radio']").click(function(){
    vote.find("input[type='submit']")[0].disabled = false;
  });
});

$("#dw-hidden-menus .dw-vote .dw-cancel").click(function() {
  $(this).closest('form.dw-vote').remove();
});

$("#dw-action-menu .dw-reply").click(function() {
  // Warning: Some duplicated code, see .dw-vote click() above.
  var post = $(this).closest(".dw-thread").children(".dw-post");
  var reply = $("#dw-hidden-menus .dw-reply-template").children().clone(true);
  var postId = post.attr('id').substr(8, 999); // drop initial "dw-post-"
  reply.find("input[name='parent']").attr('value', postId);
  post.after(reply);
  // Dismiss action menu
  $('#dw-action-menu').appendTo($('#dw-hidden-menus'));
  // Resize the root thread (in case this reply-thread is a new child of it).
  DebikiLayout.resizeRootThread(); // see debiki-layout.js
});

$("#dw-hidden-menus .dw-reply .dw-cancel").click(function() {
  $(this).closest('.dw-thread.dw-reply.dw-preview').remove();
});

// Don't show the crosshair cursor for menu items that trigger no action.
$(".dw-menu li:has(.dw-sub.dw-menu)").css("cursor", "default");

// Highlight the parent post when hovering over a reference.
$(".dw-parent-ref").hover(
  function(event){
    $(this).closest(".dw-thread").parent().closest(".dw-thread").
            children(".dw-post").addClass("dw-highlight");
  },
  function(event){
    $(this).closest(".dw-thread").parent().closest(".dw-thread").
            children(".dw-post").removeClass("dw-highlight");
  });

// When the .reply.preview is not inside the #hidden-menu,
// but under a real .thread, leave it visible after hovering.
$(".dw-thread. .dw-reply.dw-preview").hover(
  function(event){
    $(this).parents().css("overflow", "visible");
  },
  function(event){
    // leave overflow visible for now.
    // (It's (perhaps) annoying if the reply-textarea
    // is overflow-hidden, since the outline around it
    // will be cropped in a usually ugly manner.)
  });

// Lazy adding (less important) CSS classes.
// (So all these classes won't clutter the Scala source code files
// and waste bandwidth.)
//posts.find('.dw-post-info .dw-vote, .dw-thread-info .dw-vote')
//  .addClass('ui-corner-all');

});
