// vim: fdm=marker et ts=2 sw=2

// This script layouts the discussion, perhaps
// in a readable and concise manner.
// It also creates a public DebikiLayout object with layout methods.

jQuery.noConflict()(function($){

// Public layout class.
DebikiLayout = {

  // Makes the root thread wide enough to contain all its child posts.
  // Is this not done e.g. when child posts are resized eastwards,
  // or stacked eastwards, the east-most threads will wrap below the other
  // threads.
  resizeRootThread: function(){
    var width = 200;
    var root = $('.debiki > .dw-thread');
    root.children('.dw-thread').each(function(){
      width += $(this).outerWidth(true);
    });
    root.css('width', width);
  }
}

// Layout discussion.
DebikiLayout.resizeRootThread();

});
