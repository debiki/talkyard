// vim: fdm=marker et ts=2 sw=2

// This script layouts the discussion, perhaps
// in a readable and concise manner.

jQuery.noConflict()(function($){

var dummyScope;

// Make root thread wide enough to contain all its child posts.
dummyScope = function(){
  var width = 200;
  var root = $('.debiki > .dw-thread');
  root.children('.dw-thread').each(function(){
    width += $(this).outerWidth(true);
  });
  root.css('width', width);
}();

});
