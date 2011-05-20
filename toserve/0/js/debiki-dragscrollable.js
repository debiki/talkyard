/* vim: ts=2 sw=2
 * jQuery dragscrollable Plugin
 * version: 1.0 (25-Jun-2009)
 * Copyright (c) 2009 Miquel Herrera
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 */
/*
 * Modified by Kaj Magnus Lindberg.
 * Those changes indicated with "[Debiki]".
 * Dual licensed under the above licenses: MIT, GPL.
 */

;(function($){ // secure $ jQuery alias

/**
 * Adds the ability to manage elements scroll by dragging
 * one or more of its descendant elements. Options parameter
 * allow to specifically select which inner elements will
 * respond to the drag events.
 * 
 * options properties:
 * ------------------------------------------------------------------------		
 *  dragSelector         | jquery selector to apply to each wrapped element 
 *                       | to find which will be the dragging elements. 
 *                       | Defaults to '>:first' which is the first child of 
 *                       | scrollable element
 * ------------------------------------------------------------------------
 *  [Debiki]
 *  scrollable           | Only scroll if the mouse-down event happened on
 *                       | something scrollable, i.e. on somethin in
 *                       | $(event.target).filter(scrollable).
 *                       | Defaults to any element, i.e. '*'.
 * ------------------------------------------------------------------------
 *  preventDefault       | Prevents the event to propagate further effectivey
 *                       | dissabling other default actions. Defaults to true
 * ------------------------------------------------------------------------
 *  
 *  usage examples:
 *
 *  To add the scroll by drag to the element id=viewport when dragging its 
 *  first child accepting any propagated events
 *	$('#viewport').debiki_dragscrollable();
 *		
 */
// [Debiki] Renamed from dragscrollable to debiki_dragscrollable,
// so as to not clash with unmodified versions of this plugin.
$.fn.debiki_dragscrollable = function( options ){
   
	var settings = $.extend(
		{   
			dragSelector:'>:first',
			scrollable: '*',
            preventDefault: true
		},options || {});
	 
	
	var dragscroll= {
		mouseDownHandler : function(event) {
			// Only left button drag-scrolls.
			if (event.which !=1 )
				return false;

			// [Debiki]
			// Only scroll if the mouse-down event was on something scrollable.
			if (! $(event.target).filter(settings.scrollable).length)
				return true;

			// Initial coordinates will be the last when dragging
			event.data.lastCoord = {left: event.clientX, top: event.clientY}; 

			// [Debiki] Remember start coordinates
			event.data.startCoord = {left: event.clientX, top: event.clientY};

			$.event.add( document, "mouseup", 
						 dragscroll.mouseUpHandler, event.data );
			$.event.add( document, "mousemove", 
						 dragscroll.mouseMoveHandler, event.data );
			if (event.data.preventDefault) {
                event.preventDefault();
                return false;
            }
		},
		mouseMoveHandler : function(event) { // User is dragging
			// How much did the mouse move?
			var delta = {left: (event.clientX - event.data.lastCoord.left),
						 top: (event.clientY - event.data.lastCoord.top)};

			// [Debiki]
			// Find movement since drag start.
			var deltaAccum = {
					left: Math.abs(event.clientX - event.data.startCoord.left),
					top: Math.abs(event.clientY - event.data.startCoord.top)};
			// If moved alot, move faster. Then can easily move viewport
			// large distances, and still retain high precision when
			// moving small distances. (The calculations below are just
			// heuristics that works well on my computer.)
			var mul;
			if (deltaAccum.left > 9){
				mul = Math.log((deltaAccum.left - 9) / 3);
				if (mul > 1) delta.left *= mul;
			}
			if (deltaAccum.top > 5){
				mul = Math.log((deltaAccum.top - 5) / 2);
				if (mul > 1) delta.top *= mul;
			}

			// Set the scroll position relative to what ever the scroll is now
			//--------------------------------
			// This won't work in Opera, debiki-core run:
			//   event.data.scrollable.scrollLeft(
			//			event.data.scrollable.scrollLeft() - delta.left);
			//event.data.scrollable.scrollTop(
			//			event.data.scrollable.scrollTop() - delta.top);
			// with this initialization:
			//   jQuery(window).load(function(){
			//     var selectors =
			//       '.dw-thread, .dw-cmts, .dw-cmt, .dw-cmt-wrap, .dw-cmt-bdy, '+
			//       '.dw-cmt-acts';
			//     $('body').debiki_dragscrollable({ scrollable: selectors });
			//   });
			// but works with debiki-jspwiki-forum, with this init:
			//  dragRoot = $('body');
			//  scrollSelectors = '#content, #page, .leftmenu, .userbox, '+
			//      '.dw-thread, .dw-cmts, .dw-cmt, .dw-cmt-wrap, .dw-cmt-acts';
			//  $(scrollSelectors).addClass('dw-dragscrollable'); //--> cursor: move
			//  dragRoot.debiki_dragscrollable({ scrollable: scrollSelectors });
			//
			//--------------------------------
			// This works in all browsers, but... it's a hack!
			// debiki_dragscrollable wasn't applied to `window'!
			window.scrollTo($(window).scrollLeft() - delta.left,
					$(window).scrollTop() - delta.top);
			//--------------------------------

			// Save where the cursor is
			event.data.lastCoord={left: event.clientX, top: event.clientY}
			if (event.data.preventDefault) {
                event.preventDefault();
                return false;
            }

		},
		mouseUpHandler : function(event) { // Stop scrolling
			$.event.remove( document, "mousemove", dragscroll.mouseMoveHandler);
			$.event.remove( document, "mouseup", dragscroll.mouseUpHandler);
			if (event.data.preventDefault) {
                event.preventDefault();
                return false;
            }
		}
	}
	
	// set up the initial events
	this.each(function() {
		// closure object data for each scrollable element
		var data = {scrollable : $(this),
					acceptPropagatedEvent : settings.acceptPropagatedEvent,
                    preventDefault : settings.preventDefault }
		// Set mouse initiating event on the desired descendant
		$(this).find(settings.dragSelector).
					bind('mousedown', data, dragscroll.mouseDownHandler)
					.filter(settings.scrollable)
					.addClass('dw-dragscrollable'); // sets cursor:move.
						
	});
}; //end plugin debiki_dragscrollable

})( jQuery ); // confine scope
