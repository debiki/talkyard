// vim: fdm=marker et ts=2 sw=2

jQuery.noConflict()(function($){

var threadHovered = null;
var didResize = false;

$(".post, .thread-summary").hover(
  function(event){
    var nextThread = $(this).closest('.thread');

    if ($(this).hasClass('post')) {
      // Show the #action-menu, unless the thread is closing,
      // and unless the thread itself is already a .reply thread.
      if (!nextThread.hasClass('collapsed') && !nextThread.hasClass('reply')) {
        $(this).after($('#action-menu'))
      }
    }
    else if (nextThread.find('#action-menu').length) {
      // This is a .thread-summary and it has the #action-menu inside.
      // This is not a safe place for the menu! If this
      // .thread-summary is clicked, the thread will
      // collapsed itself, and the #action-menu will be hidden inside
      // the collapsed thread -- the menu becomes buggy gone -- unless
      // moved to somewhere safe.
      $('#hidden-menus').append($('#action-menu'));
    }

    if (threadHovered && threadHovered[0] == nextThread[0])
      return;

    if ($(this).hasClass('thread-summary') &&
        !threadHovered.hasClass('collapsed')) {
      // This .thread-summary is not visible (it's only visible by default
      // if the thread is collapsed). Don't fade it in, because the user
      // might be navigating the #action-menu, and then we don't want
      // this .thread-summary to appear below that menu. Instead,
      // only open the .thread-summary if the threaad's *post* is hovered.
      return;
    }

    // Fade last summary, unless thread collapsed.
    if (threadHovered && !threadHovered.hasClass('collapsed')) {
      threadHovered.children('.thread-summary')
                      .stop(true, true).fadeTo(1000, 0);
      threadHovered.stop(true, true)
          .removeClass('demarcated')
          .removeClass('demarcated-fx', 1000);
    }
    // Show summary for current thread.
    nextThread.children('.thread-summary').stop(true, true).fadeTo(600, 1);
    nextThread.stop(true, true)
        .addClass('demarcated') // gives functionality instantly
        .addClass('demarcated-fx', 600); // just for class animation effects
    threadHovered = nextThread;
  },
  function(event){
  });

$(".thread-summary").click(function() {
  var thread = $(this).closest(".thread");
  if (! thread.hasClass('demarcated')) return;
  thread
    .children(":not(.thread-summary)").stop(true,true).slideToggle(800)
    .end()
    .stop(true, true)
    .toggleClass('collapsed')
    .toggleClass('collapsed-fx', 600);
});

/*
$(".vote-summary").click(function() {
  $(this).closest(".thread").children(".post")
      .children(":not(.vote-summary)").slideToggle(200);
}); */

var posts = $(".debiki .post");

// Makes whole post visible on click.
//
posts.filter('.cropped-s').click(function(){
  console.log('click: Removind cropped-s.');
  // (Some rather long posts are cropped, using max-width and -height.
  // Don't remove max-width, or some posts might end up rather wide.)
  $(this).closest('.post').removeClass('cropped-s');
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
        $(this).closest('.post').removeClass('cropped-s cropped-e');
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
      var post = $(this).closest('.post');
      post.removeClass('cropped-s cropped-e');
      // Expand post eastwards if resize handle was clicked not dragged.
      // (Also expands southwards, but browsers usually expand to east first.)
      if (!didResize) post.css('width', null).css('height', null);
    })
  .end()
  .find('.ui-resizable-s, .ui-resizable-se')
    // Expand post southwards if resize handle was clicked not dragged.
    .mouseup(function(){
      if (!didResize) $(this).closest('.post').css('height', null);
    })
  .end()
  .find('.ui-resizable-handle')
    .mousedown(function(){
      didResize = false;
    })
  .end();

  // Resize threads.
  // Bug: Resizing a thread might toggle it collapsed / expanded, since
  // a click on the .thread-summary might happen.
  $('.debiki .thread-summary').each(function(index) {
    var thread = $(this).closest('.thread');
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

$(".edit").hover(
  function(event){ $(this).append($("#edit-menu")); },
  function(event){ $("#hidden-menus").append($("#edit-menu")); }
  );

$(".vote").hover(
  function(event){ $(this).append($("#vote-menu")); },
  function(event){ $("#hidden-menus").append($("#vote-menu")); }
  );

/*
$(".reply").hover(
  function(event){ $(this).append($("#reply-menu")); },
  function(event){ $("#hidden-menus").append($("#reply-menu")); }
  );
*/

$("#action-menu .reply").click(function() {
  var post = $(this).closest(".thread").children(".post");
  var reply = $("#hidden-menus .reply-template").clone(true);
  var postId = post.attr('id').substr(5, 999); // drop initial "post-"
  reply.find("input[name='parent']").attr('value', postId);
  reply.find("input[name='author']").attr('value', 'Author unknown');
  post.after(reply);
  // Dismiss action menu
  $('#action-menu').appendTo($('#hidden-menus'));
});

$("#hidden-menus button.cancel").click(function() {
  $(this).closest('.thread.reply.preview').remove();
});

  //function(event){
  //  $(this).append($(
  //      "<ul class='menu'>"+
  //        "<li>Edit</li>"+
  //        "<li>Copy&#160;&amp;&#160;edit</li>"+
  //        "<li>Delete</li>"+
  //        "<li>Move</li>"+
  //      "</ul>"));
  //},
  //function(event){
  //  $(this).remove(".menu");
  //});

// Don't show the crosshair cursor for menu items that trigger no action.
$(".menu li:has(.sub.menu)").css("cursor", "default");

// Highlight the parent post when hovering over a reference.
$(".parent-ref").hover(
  function(event){
    $(this).closest(".thread").parent().closest(".thread").
            children(".post").addClass("highlight");
  },
  function(event){
    $(this).closest(".thread").parent().closest(".thread").
            children(".post").removeClass("highlight");
  });

// When the .reply.preview is not inside the #hidden-menu,
// but under a real .thread, leave it visible after hovering.
$(".thread. .reply.preview").hover(
  function(event){
    $(this).parents().css("overflow", "visible");
  },
  function(event){
    // leave overflow visible for now.
    // (It's (perhaps) annoying if the reply-textarea
    // is overflow-hidden, since the outline around it
    // will be cropped in a usually ugly manner.)
  });

});
