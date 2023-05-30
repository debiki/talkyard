/*
 * Copyright (c) 2023 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/// <reference path="../editor-prelude.editor.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.editor {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const formattingHelp: () => StupidDialogStuff = () => {
  const mkSampleRow = (before, text, after, fn, after2 = null) =>
          r.tr({},
            r.td({}, before, text, after),
            r.td({}, fn({}, text), after2));

  const body = rFr({},  // I18N
    r.h1({}, "Formatting your text"),
    r.p({}, "You can uss ",
        r.b({}, "bold"), ", ",
        r.i({}, "italics"), ", add images and code, using CommonMark:"),
    r.table({},
      r.thead({},
        r.th({}, r.h3({}, r.span({}, "Type this ..."), r.span({}, "..."))),
        r.th({}, r.h3({}, "to get this")),
        ),
      r.tbody({},
        mkSampleRow("_", "Italic text", "_", r.i),
        mkSampleRow("**", "Bold text", "**", r.b),
        mkSampleRow("~~", "Strikethrough", "~~", r.s), // ! not impl !
        mkSampleRow("## ", "Heading <h2>", "", r.h2),
        mkSampleRow("### ", "Smaller <h3>", "", r.h3),
        r.tr({},
          r.td({},
            "To type a literal _ or **, use '\\':", r.br(), r.br(),
            "\\_not italics\\_ and \\*\\*not bold\\*\\*"),
          r.td({},
            r.p({}, "To type a literal _ or **, use '\\':"),
            r.p({}, "_not italics_ and **not bold**"))),
        r.tr({},
          r.td({},
            "[A link](",
            r.span({ className: 'n_Link' }, "https://www.example.com"),
            ") to somewhere"),
          r.td({}, r.a({ href: 'https://www.example.com' }, "A link"), " to somewhere")),
        r.tr({},
          r.td({},
            "An image, with Alt text:", r.br(), r.br(),
            "![", r.span({ className: 'n_Link' }, "Alt text"),
            "](", r.span({ className: 'n_Link' }, "https://forum.talkyard.io/favicon.ico"),
            ")", r.br(),
            r.br(),
            r.i({ className: 'n_NoteThe' },
              "(Note the '", r.b({}, "!"),"' in front. The Alt text is for screen readers.)")),
          r.td({},
            r.p({}, "An image, with Alt text:"),
            r.img({ src: 'https://forum.talkyard.io/favicon.ico', alt: "Alt text" }))),
        r.tr({},
          r.td({},
            "Quoting someone:", r.br(),
            r.br(),
            // Let's use two lines, to show how to write a multiline quote.
            "> Quoted text, in own", r.br(),
            "> paragraph"),
          r.td({},
            r.p({}, "Quoting someone:"),
            r.blockquote({}, "Quoted text, in own paragraph"))),
        r.tr({},
          r.td({},
              "- List", r.br(),
              "- List item 2", r.br(),
              "- Item 3 long text", r.br(),
              "  many lines"),
          r.td({},
            r.ul({},
              r.li({}, "List"),
              r.li({}, "List item 2"),
              r.li({}, "Item 3 long text many lines")))),
        r.tr({},
          r.td({},
            "1. Ordered list", r.br(),
            "2. Item two", r.br(),
            "3. Item 3", r.br(),
            "   - Nested list", r.br(),
            "   - Nested item 2"),
          r.td({},
            r.ol({},
              r.li({}, "Ordered list"),
              r.li({}, "Item two"),
              r.li({}, "Item 3",
                r.ol({}, r.li({}, "Nested list"), r.li({}, "Nested item 2")))))),
        mkSampleRow("`", "Inline code", "` with backticks", r.code, " with backticks"),
        r.tr({},
          r.td({},
            "Code block — wrap in three backticks:", r.br(),
            r.br(),
            "```", r.br(),
            "for (let x = 1; x < 10; ++x) {", r.br(),
            "  console.log(x! ** x!)", r.br(),
            "}", r.br(),
            "// Go have a coffee", r.br(),
            "```", r.br()),
          r.td({},
            r.p({},
              "Code block — wrap in three backticks:"),
           r.pre({}, r.code({},
              "for (let x = 1; x < 10; ++x) {", r.br(),
              "  console.log(x! ** x!)", r.br(),
              "}", r.br(),
              "// Go have a coffee",
              )))),
      )),
    r.p({},
      "You can read more about CommonMark at ",
      r.a({ href: 'https://commonmark.org/help/', target: '_blank' },
          "commonmark.org ", r.span({ className: 'icon-link-ext' })), '.)'));

  return { body, large: true, dialogClassName: 'c_FmtHlpD', showCloseButton: true };
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
