/*

Copyright (c) 2008 Juriy Zaytsev (kangax@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

/*

From https://github.com/kangax/cft/blob/gh-pages/feature_tests.js#L159-187

And I added 3 CSS styles (visibility, display & transform) from:
  https://github.com/Modernizr/Modernizr/pull/539/files

*/

Modernizr.addTest('csspositionfixed', function () {

    var container = document.body;
    
    if (document.createElement && container && container.appendChild && container.removeChild) {
      var el = document.createElement('div');
      
      if (!el.getBoundingClientRect) return null;
          
      el.innerHTML = 'x';
      el.style.cssText = 'position:fixed;top:100px;visibility:visible;display:block;-webkit-transform:none;-moz-transform:none;transform:none;';
      container.appendChild(el);

      var originalHeight = container.style.height,
          originalScrollTop = container.scrollTop;

      container.style.height = '3000px';
      container.scrollTop = 500;

      var elementTop = el.getBoundingClientRect().top;
      container.style.height = originalHeight;
      
      var isSupported = (elementTop === 100);
      container.removeChild(el);
      container.scrollTop = originalScrollTop;

      return isSupported;
    }
    return false;

});

