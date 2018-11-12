/**
 * Shows trailing Markdown spaces and line breaks, like so:·↵
 *
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
 *
 * License: (MIT)
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


CodeMirror.defineOption("showMarkdownLineBreaks", false,
    function(codeMirror, newValue, oldValue) {

  if (oldValue == CodeMirror.Init) {
    oldValue = false;
  }
  if (oldValue && !newValue) {
    codeMirror.removeOverlay("show-markdown-line-breaks");
  }
  else if (!oldValue && newValue) {
    codeMirror.addOverlay({
      name: "show-markdown-line-breaks",
      token: markMarkdownTrailingSpaces
    });
  }
});


function markMarkdownTrailingSpaces(stream) {

  // Possible stream.string:s and how they're handled: (`n` is text
  // with no trailing spaces)
  // ""
  // "n"    case 1
  // "_"    case 3
  // "n_"   case 1, case 3
  // "__"   case 2, case 3
  // "n__"  case 1, case 2, case 3
  // "___"  case 2, case 3
  // "n___" case 1, case 2, case 3

  // Returns separate CSS classes for each trailing space;
  // otherwise CodeMirror merges contiguous spaces into
  // one single <span>, and then I don't know how to via CSS
  // replace each space with exact one '·'.
  function singleTrailingSpace() {
    return stream.pos % 2 == 0 ?
      "markdown-single-trailing-space-even" :
      "markdown-single-trailing-space-odd";
  };

  if (!stream.string.length) // can this happen?
    return null;

  // Case 1: Non-space characters. Eat until last non-space char.
  var eaten = stream.match(/.*[^ ]/);
  if (eaten)
    return null;

  // Case 2, more than one trailing space left before end-of-line.
  // Match one space at a time, so each space gets its own
  // `singleTrailingSpace()` CSS class. Look-ahead (`(?=`) for more spaces.
  if (stream.match(/ (?= +$)/))
    return singleTrailingSpace();

  // Case 3: the very last char on this line, and it's a space.
  // Count num trailing spaces up to including this last char on this line.
  // If there are 2 spaces (or more), we have a line break.
  var str = stream.string;
  var len = str.length;
  var twoTrailingSpaces = len >= 2 && str[len - 2] == ' ';
  stream.eat(/./);
  if (twoTrailingSpaces)
    return "markdown-line-break";
  return singleTrailingSpace();
};


// vim: et ts=2 sw=2 list
