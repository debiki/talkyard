// vim: fdm=marker et ts=2 sw=2

// This script layouts the discussion, perhaps
// in a readable and concise manner.
// It also creates a public DebikiLayout object with layout methods.

jQuery.noConflict()(function($){

// Public layout class.
DebikiLayout = {

  // Makes the root thread wide enough to contain all its child posts.
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
