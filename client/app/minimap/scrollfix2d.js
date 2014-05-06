/**
 * Copyright (c) 2012 the AngularUI Team, http://angular-ui.github.com
 *
 * Parts Copyright (c) 2013 Kaj Magnus Lindberg (added horizontal scrollfix)
 *
 * The MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * Adds a 'ui-scrollfix' class to an element when the page scrolls past it's
 * position, horizontally or vertically. (Angular's UI Utils scrollfix.js only
 * considers vertical scrolling.)
 *
 * There is no offset option; scrollfix always starts directly when you
 * scroll past the element [not true! +90px horizontally!]. (Not after +-NNN pixels.)
 * See [Angular's UI Utils]/modules/scrollfix/scrollfix.js should you want
 * to implement offsets again. (I (KajMagnus) removed them rather than
 * implementing offsets in X too which I didn't need)
 */
angular.module('ui.scrollfix',[]).directive('uiScrollfix2d', ['$window', function ($window) {
  'use strict';
  return {
    require: '^?uiScrollfixTarget',
    link: function (scope, elm, attrs, uiScrollfixTarget) {
      var top = elm[0].offsetTop,
          left = elm[0].offsetLeft,
          width = elm.width(),
          $target = uiScrollfixTarget && uiScrollfixTarget.$element || angular.element($window);
      attrs.uiScrollfixY = top;
      attrs.uiScrollfixX = left + width;

      // For now. Good for Debiki and I won't need to parse any attributes.
      // Also somewhat takes any scrollbars into account — seems `innerWidth` doesn't.
      attrs.uiScrollfixX += 90;

      $target.bind('scroll', function () {
        // if pageYOffset is defined use it, otherwise use other crap for IE
        var offsetY, offsetX;
        if (angular.isDefined($window.pageYOffset)) {
          offsetY = $window.pageYOffset;
          offsetX = $window.pageXOffset;
        } else {
          var iebody = (document.compatMode && document.compatMode !== "BackCompat") ? document.documentElement : document.body;
          offsetY = iebody.scrollTop;
          offsetX = iebody.scrollLeft; // I hope this works, haven't tested
        }
        var offsetXRightEdge = offsetX + window.innerWidth;
        if (!elm.hasClass('ui-scrollfix') &&
            (offsetY > attrs.uiScrollfixY || offsetXRightEdge > attrs.uiScrollfixX)) {
          elm.addClass('ui-scrollfix');
        }
        else if (elm.hasClass('ui-scrollfix') &&
            (offsetY < attrs.uiScrollfixY &&
              // use <= not < so 0 resets to original positioning.
              offsetXRightEdge <= attrs.uiScrollfixX)) {
          elm.removeClass('ui-scrollfix');
        }
      });
    }
  };
}]).directive('uiScrollfixTarget', [function () {
  'use strict';
  return {
    controller: function($element) {
      this.$element = $element;
    }
  };
}]);

