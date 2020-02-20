/**
 * angular-slugify -- provides slugification for AngularJS
 *
 * Copyright © 2013 Paul Smith <paulsmith@pobox.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the “Software”), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Parts Copyright (c) 2015 Kaj Magnus Lindberg
// I removed the Angular stuff and exposed a global function named debikiSlugify.
// And added some lines marked with [kajmagnus]; they remove all weird characters.


// Unicode (non-control) characters in the Latin-1 Supplement and Latin
// Extended-A blocks, transliterated into ASCII characters.
var __nonAngularSlugifyCharmap = {
    ' ': " ",
    '¡': "!",
    '¢': "c",
    '£': "lb",
    '¥': "yen",
    '¦': "|",
    '§': "SS",
    '¨': "\"",
    '©': "(c)",
    'ª': "a",
    '«': "<<",
    '¬': "not",
    '­': "-",
    '®': "(R)",
    '°': "^0",
    '±': "+/-",
    '²': "^2",
    '³': "^3",
    '´': "'",
    'µ': "u",
    '¶': "P",
    '·': ".",
    '¸': ",",
    '¹': "^1",
    'º': "o",
    '»': ">>",
    '¼': "-1-in-4-", // was:  " 1/4 ",  [kajmagnus]
    '½': "-1-in-2-", // was:  " 1/2 ",  [kajmagnus]
    '¾': "-3-in-4-", // was:  " 3/4 ",  [kajmagnus]
    '¿': "?",
    'À': "`A",
    'Á': "'A",
    'Â': "^A",
    'Ã': "~A",
    'Ä': '"A',
    'Å': "A",
    'Æ': "AE",
    'Ç': "C",
    'È': "`E",
    'É': "'E",
    'Ê': "^E",
    'Ë': '"E',
    'Ì': "`I",
    'Í': "'I",
    'Î': "^I",
    'Ï': '"I',
    'Ð': "D",
    'Ñ': "~N",
    'Ò': "`O",
    'Ó': "'O",
    'Ô': "^O",
    'Õ': "~O",
    'Ö': '"O',
    '×': "x",
    'Ø': "O",
    'Ù': "`U",
    'Ú': "'U",
    'Û': "^U",
    'Ü': '"U',
    'Ý': "'Y",
    'Þ': "Th",
    'ß': "ss",
    'à': "`a",
    'á': "'a",
    'â': "^a",
    'ã': "~a",
    'ä': '"a',
    'å': "a",
    'æ': "ae",
    'ç': "c",
    'è': "`e",
    'é': "'e",
    'ê': "^e",
    'ë': '"e',
    'ì': "`i",
    'í': "'i",
    'î': "^i",
    'ï': '"i',
    'ð': "d",
    'ñ': "~n",
    'ò': "`o",
    'ó': "'o",
    'ô': "^o",
    'õ': "~o",
    'ö': '"o',
    '÷': ":",
    'ø': "o",
    'ù': "`u",
    'ú': "'u",
    'û': "^u",
    'ü': '"u',
    'ý': "'y",
    'þ': "th",
    'ÿ': '"y',
    'Ā': "A",
    'ā': "a",
    'Ă': "A",
    'ă': "a",
    'Ą': "A",
    'ą': "a",
    'Ć': "'C",
    'ć': "'c",
    'Ĉ': "^C",
    'ĉ': "^c",
    'Ċ': "C",
    'ċ': "c",
    'Č': "C",
    'č': "c",
    'Ď': "D",
    'ď': "d",
    'Đ': "D",
    'đ': "d",
    'Ē': "E",
    'ē': "e",
    'Ĕ': "E",
    'ĕ': "e",
    'Ė': "E",
    'ė': "e",
    'Ę': "E",
    'ę': "e",
    'Ě': "E",
    'ě': "e",
    'Ĝ': "^G",
    'ĝ': "^g",
    'Ğ': "G",
    'ğ': "g",
    'Ġ': "G",
    'ġ': "g",
    'Ģ': "G",
    'ģ': "g",
    'Ĥ': "^H",
    'ĥ': "^h",
    'Ħ': "H",
    'ħ': "h",
    'Ĩ': "~I",
    'ĩ': "~i",
    'Ī': "I",
    'ī': "i",
    'Ĭ': "I",
    'ĭ': "i",
    'Į': "I",
    'į': "i",
    'İ': "I",
    'ı': "i",
    'Ĳ': "IJ",
    'ĳ': "ij",
    'Ĵ': "^J",
    'ĵ': "^j",
    'Ķ': "K",
    'ķ': "k",
    'Ĺ': "L",
    'ĺ': "l",
    'Ļ': "L",
    'ļ': "l",
    'Ľ': "L",
    'ľ': "l",
    'Ŀ': "L",
    'ŀ': "l",
    'Ł': "L",
    'ł': "l",
    'Ń': "'N",
    'ń': "'n",
    'Ņ': "N",
    'ņ': "n",
    'Ň': "N",
    'ň': "n",
    'ŉ': "'n",
    'Ō': "O",
    'ō': "o",
    'Ŏ': "O",
    'ŏ': "o",
    'Ő': '"O',
    'ő': '"o',
    'Œ': "OE",
    'œ': "oe",
    'Ŕ': "'R",
    'ŕ': "'r",
    'Ŗ': "R",
    'ŗ': "r",
    'Ř': "R",
    'ř': "r",
    'Ś': "'S",
    'ś': "'s",
    'Ŝ': "^S",
    'ŝ': "^s",
    'Ş': "S",
    'ş': "s",
    'Š': "S",
    'š': "s",
    'Ţ': "T",
    'ţ': "t",
    'Ť': "T",
    'ť': "t",
    'Ŧ': "T",
    'ŧ': "t",
    'Ũ': "~U",
    'ũ': "~u",
    'Ū': "U",
    'ū': "u",
    'Ŭ': "U",
    'ŭ': "u",
    'Ů': "U",
    'ů': "u",
    'Ű': '"U',
    'ű': '"u',
    'Ų': "U",
    'ų': "u",
    'Ŵ': "^W",
    'ŵ': "^w",
    'Ŷ': "^Y",
    'ŷ': "^y",
    'Ÿ': '"Y',
    'Ź': "'Z",
    'ź': "'z",
    'Ż': "Z",
    'ż': "z",
    'Ž': "Z",
    'ž': "z",
    'ſ': "s"
};

function debikiSlugify(s) {
   if (!s) return "";
   var ascii = [];
   var ch, cp;
   for (var i = 0; i < s.length; i++) {
     if ((cp = s.charCodeAt(i)) < 0x180) {
       ch = String.fromCharCode(cp);
       ascii.push(__nonAngularSlugifyCharmap[ch] || ch);
     }
   }
   s = ascii.join("");

   // Tested here: [TyT692SKBDWJ74]

   // URLs should not be mixed case; people would not remember the correct casing.
   s = s.trim().toLowerCase();  // [kajmagnus]

   // For now, allow only ASCII [30BDAH256]  (and [ -] which we'll replace with '-' later).
   s = s.replace(/[^a-z0-9 -]/g, '')  // [kajmagnus]

   // Don't think this is needed any longer?
   s = s.replace(/[^\w\s-]/g, "");

   // Collapse-replace blanks with a single '-':
   s = s.replace(/[-\s]+/g, "-");

   // Remove start '-':  (would it make sense to keep any leading '-'? in case
   // a page title starts with a negative number? — I don't think so)
   s = s.replace(/^-+/, '');

   // There server restricts the slug length.
   var MaxSlugLength = 100;  // sync with Scala [MXPGSLGLN]
   s = s.substr(0, MaxSlugLength);

   // Remove trailing '-':  (do here after truncation)
   s = s.replace(/-+$/, '');

   // Not impossible that the slug is now just '' (the empty string).
   return s;
}

window.debikiSlugify = debikiSlugify;  // [5FK2W08]

