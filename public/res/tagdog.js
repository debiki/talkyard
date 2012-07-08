/* Copyright (c) 2010 - 2011 Kaj Magnus Lindberg */
/* Parts Copyright (C) 2006 Google Inc. */

// The tag dog simplifies searching text inside html tags, without
// being so very confused by tags and attributes.
//
// Requirements: html-sanitizer-minified.js, from google-caja,
//  http://google-caja.googlecode.com/svn/trunk/src/com/google/caja
//  SVN r4338, 2010-12-20
//
// The tag dog has two functions:
//  sniffHtml: function(htmlText, opt_placeholder), returns sniffAndMem
// and
//  barkHtml: function(sniffAndMem), returns html text
//
// sniffHtml() converts each tag start/end placeholder in htmlText to
// a placeholder. The converted text is placed in sniffAndMem.sniffedHtml
// and the actual start/end tag is placeed in sniffAndMem.tagMemory.
// `sniffedHtml' can later be fuzzy-searched fairly efficiently,
// since each tag start/end is only one single character, instead
// of e.g. 3-4 characters (for e.g. <b> and </b>) or
// very very many characters (for tags with CSS classes and ids).
// HTML highlighting can then be inserted into sniffedHtml, where
// a search string was found, and the sniffedHtml can be converted
// back to HTML like so: barkHtml(sniffAndMem).

// TODO Instructions / utility functions that handle the case when
// [the search text hit] crosses tag boundaries.

// TODO A function that inserts text into sniffedHtml, but first 
// escapes the text.

//========================================
  var TagDog = (function(){
//========================================

// The function below, htmlSniffer, is based on
// function html.makeHtmlSanitizer, from html-sanitizer.js,
// from google-caja,
//    http://google-caja.googlecode.com/svn/trunk/src/com/google/caja
// {{{ It's licensed under the Apace 2 license:
// Copyright (C) 2006 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// }}}
//
var htmlSniffer = (function() {
  var stack;
  var ignoring;
  var pushTag = function(sniffAndMem, tag) {
    sniffAndMem.sniffedHtml.push(sniffAndMem.placeholder);
    sniffAndMem.tagMemory.push(tag);
  };
  var pushText = function(sniffAndMem, text) {
    sniffAndMem.sniffedHtml.push(text);
  };

  return html.makeSaxParser({
        startDoc: function (_) {
          stack = [];
          ignoring = false;
        },
        startTag: function (tagName, attribs, sniffAndMem) {
          if (ignoring) { return; }
          if (!html4.ELEMENTS.hasOwnProperty(tagName)) { return; }
          var eflags = html4.ELEMENTS[tagName];
          if (eflags & html4.eflags.FOLDABLE) {
            return;
          } else if (eflags & html4.eflags.UNSAFE) {
            ignoring = !(eflags & html4.eflags.EMPTY);
            return;
          }
          // This is no HTML sanitizer; sanitize nothing.
          //attribs = sanitizeAttributes(tagName, attribs);

          if (attribs) {
            if (!(eflags & html4.eflags.EMPTY)) {
              stack.push(tagName);
            }

            var tag = [];
            tag.push('<', tagName);
            for (var i = 0, n = attribs.length; i < n; i += 2) {
              var attribName = attribs[i],
                  value = attribs[i + 1];
              if (value !== null && value !== void 0) {
                tag.push(' ', attribName, '="', html.escapeAttrib(value), '"');
              }
            }
            tag.push('>');
            pushTag(sniffAndMem, tag.join(''));
          }
        },
        endTag: function (tagName, sniffAndMem) {
          if (ignoring) {
            ignoring = false;
            return;
          }
          if (!html4.ELEMENTS.hasOwnProperty(tagName)) { return; }
          var eflags = html4.ELEMENTS[tagName];
          if (!(eflags & (html4.eflags.UNSAFE | html4.eflags.EMPTY
                          | html4.eflags.FOLDABLE))) {
            var index;
            if (eflags & html4.eflags.OPTIONAL_ENDTAG) {
              for (index = stack.length; --index >= 0;) {
                var stackEl = stack[index];
                if (stackEl === tagName) { break; }
                if (!(html4.ELEMENTS[stackEl] & html4.eflags.OPTIONAL_ENDTAG)) {
                  // Don't pop non optional end tags looking for a match.
                  return;
                }
              }
            } else {
              for (index = stack.length; --index >= 0;) {
                if (stack[index] === tagName) { break; }
              }
            }
            if (index < 0) { return; }  // Not opened.
            for (var i = stack.length; --i > index;) {
              var stackEl = stack[i];
              if (!(html4.ELEMENTS[stackEl] & html4.eflags.OPTIONAL_ENDTAG)) {
                pushTag(sniffAndMem, '</'+ stackEl +'>');
              }
            }
            stack.length = index;
            pushTag(sniffAndMem, '</'+ tagName +'>');
          }
        },
        pcdata: function (text, sniffAndMem) {
          if (!ignoring) { pushText(sniffAndMem, text); }
        },
        rcdata: function (text, sniffAndMem) {
          if (!ignoring) { pushText(sniffAndMem, text); }
        },
        cdata: function (text, sniffAndMem) {
          if (!ignoring) { pushText(sniffAndMem, text); }
        },
        endDoc: function (sniffAndMem) {
          for (var i = stack.length; --i >= 0;) {
            pushTag(sniffAndMem, '</'+ stack[i] +'>');
          }
          stack.length = 0;
        }
      });
})();

return {
  sniffHtml: function(htmlText, opt_placeholder) {
    var placeholder = opt_placeholder || '·'; // TODO find a rarer utf-8 char?
                                              // (Also update Utterscroll)

    var escaped = htmlText; // TODO Escape any placeholder chars.
    var sniffAndMem = {
      sniffedHtml: [],
      tagMemory: [],
      placeholder: placeholder
    };
    htmlSniffer(escaped, sniffAndMem);
    sniffAndMem.sniffedHtml = sniffAndMem.sniffedHtml.join('');
    return sniffAndMem;
  },
  barkHtml: function(sniffAndMem) {
    // TODO Unescape escaped placeholder chars.
    var splits = sniffAndMem.sniffedHtml.split(sniffAndMem.placeholder);
    var result = [];
    for (var i = 0; i < splits.length; ++i) {
      result.push(splits[i]);
      if (i < splits.length - 1) result.push(sniffAndMem.tagMemory[i]);
    };
    // TODO: Make google-caja's html-sanitizer.js close tags that were closed.
    // See the exact same TODO in debiki/v0/html.scala.
    result = result.join('');
    result = result.replace(/<br>/gi, '<br />') // HTML5 now, need not do this?
    result = result.replace(/<hr>/gi, '<hr />')
    return result;
  }
};

//========================================
   })(); // end TagDog
//========================================

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
