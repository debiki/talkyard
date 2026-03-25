---
name: Translate UI
description: How to translate the Talkyard user interface to a new language.
---

To translate the Talkyard user interface to a new language:

1. Copy `translations/en_US/i18n.ts` to a new directory named after the language and country code,
   say, `translations/nn_NN/`, where `nn` is the language code, `NN` the country code.

2. Translate the text fields in the new `nn_NN/i18n.ts` file to language `nn_NN`.

   Use your memory / built-in language knowledge.

   Do NOT install any packages.

   DO NOT USE PYTHON. DO NOT GENERATE ANY PYTHON SCRIPT.

   Just USE YOUR BUIL-IN LANGUAGE KNOWLEDGE.

   Do NOT search the code base for any already existing translations. There are none.

   Do NOT start fixing translations in other files. Only look at the language I told you to look at.

   Do NOT use any tools.

   Do NOT websearch.

   Do NOT remove comments, except for "// MISSING" comments — since that translation
   field is no longer missing, after you have translated it.

   Do NOT use Google Translate API. You already have translation knowledge built-in.

   Do NOT copy any other translation file instead of the `en_US/i18n.ts` file.
   Other files are *incomplete*.

   Instead, start with the English translation file (the one you copied in step 1 above),
   and edit the text `nn_NN/i18n.ts` in-place from English to language `nn_NN`.

   **Examples:**

   If you had been translating to Swedish (`sv_SE`), then, you'd translate for example this line:

   ```
   Bookmarks: "Bookmarks",
   ```

   to this:

   ```
   Bookmarks: "Bokmärken",
   ```

   That is, you translate only the text in quotes.

   And this line:

   ```
   CmtBelowPendAppr: (isYour) => (isYour ? "Your" : "The") + " comment below is pending approval.",
   ```

   would become:

   ```
   CmtBelowPendAppr: (isYour) => (isYour ? "Din kommentar" : "Kommentaren") + " väntar på att godkännas.",
   ```


3. Edit files: (so Talkyard becomes aware of the new translation)

        - Edit `app/debiki/Nashorn.scala` so the language file gets included in the
          server side Javascript bundle. (For server-side rendering.)

        - Edit `app/talkyard/server/emails/Emails.scala`, if any emails
          were translated.
          (You didn't translate any emails, though, so skip this.)

        - Edit `Makefile`: add the language to the `prod_asset_bundle_files` list,
          You'll need to add 3 lines, for the `i18n.min.js`, `i18n.js.gz` and `i18n.min.js.gz`
          files in language `nn_NN`.

4. See if there are any errors by compiling the new translation file: (replace `nn_NN` at the very end)

       ```
       docker compose run --rm nodejs gulp compileOneTranslation --language=nn_NN
       ```

   Fix any errors. But do NOT remove comments.


5. Don't commit any changes. A human will review and do that.


