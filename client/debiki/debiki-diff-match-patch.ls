# Copyright (c) 2012-2013 Kaj Magnus Lindberg. All rights reserved
# Parts copyright Google Inc. (search for "Copyright" in this file
# to find out which function(s) are concerned).

d = i: debiki.internal, u: debiki.v0.util
bug = d.u.die2


d.i.diffMatchPatch = new diff_match_patch()
d.i.diffMatchPatch.Diff_Timeout = 1  # seconds
d.i.diffMatchPatch.Match_Distance = 100*1000  # for now
d.i.diffMatchPatch.maxMatchLength = d.i.diffMatchPatch.Match_MaxBits


d.i.makeHtmlDiff = (oldText, newText) ->
  diff = d.i.diffMatchPatch.diff_main oldText, newText
  d.i.diffMatchPatch.diff_cleanupSemantic diff
  htmlString = d.i.prettyHtmlFor(diff)
  htmlString


/**
 * Converts a google-diff-match-patch diff array into a pretty HTML report.
 * Based on diff_match_patch.prototype.diff_prettyHtml(), here:
 *  http://code.google.com/p/google-diff-match-patch/source/browse/
 *    trunk/javascript/diff_match_patch_uncompressed.js
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @return {string} HTML representation.
 *
 * This function is:
 *     Copyright 2006 Google Inc.
 *     http://code.google.com/p/google-diff-match-patch/
 *
 *     Licensed under the Apache License, Version 2.0 (the "License");
 *     you may not use this file except in compliance with the License.
 *     You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *     Unless required by applicable law or agreed to in writing, software
 *     distributed under the License is distributed on an "AS IS" BASIS,
 *     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *     See the License for the specific language governing permissions and
 *     limitations under the License.
 */
d.i.prettyHtmlFor = (diffs) ->
  html = []
  x = i = 0
  pattern_amp = /&/g
  pattern_lt = /</g
  pattern_gt = />/g
  pattern_para = /\n/g
  for x from 0 to diffs.length - 1
    op = diffs[x][0]     # Operation (insert, delete, equal)
    data = diffs[x][1]   # Text of change.
    text = data.replace(pattern_amp, '&amp;').replace(pattern_lt, '&lt;')
        .replace(pattern_gt, '&gt;').replace(pattern_para, '¶<br />')
    switch op
    | DIFF_INSERT =>
      html[x] = "<ins>#text</ins>"
    | DIFF_DELETE =>
      html[x] = "<del>#text</del>"
    | DIFF_EQUAL =>
      html[x] = "<span>#text</span>"

    if op !== DIFF_DELETE
      i += data.length

  html.join ''


# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
