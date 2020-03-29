
To add a new language:

1. Copy `./en_US/i18n.ts` to a new directory whose name is the language code of the new language,
   say, `nn_NN`.

2. Translate the text fields in the new `nn_NN/i18n.ts` file.

   Tips: Use a diff tool, to see English and your new language nn_NN side by side.
   For example, if you use Meld:

       meld translations/en_US/i18n.ts translations/nn_NN/i18n.ts

   — then, to the left, you'll see see the English version, and to the right,
   the new `nn_NN` translation, compared line by line,
   and you can edit and save your new translation
   (and still see the English version to the left).

3. When done translating, the Talkyard developers (but not you, the translator) need to: [5JUKQR2]

    1. Update `app/debiki/Nashorn.scala` so the language file gets included in the
        server side Javascript bundle.

    2. Update `client/app/admin/admin-app.staff.ts`: add the language
        to the select-language dropdown.

    3. Have a look in Google Translate that the translated texts looks okay.
       By creating a Talkyard site in the new language, and then, in the browser dev console:

       ```js
       var result = '';
       _.forOwn(t, function(tField, tKey) {
         if (_.isString(tField)) {
           result = result + '_' + tKey + '_: ' + tField + '\n';
         }
         else {
           result = result + '\n*** _' + tKey + '_***\n';
           _.forOwn(tField, function(subField, subKey) {
             result = result + '_' + subKey + '_: ' + subField + '\n';
           });
         }
       });
       console.log(result);
       ```

       That'll print all translated texts, and the field names as `_fieldName_` —
       the underscores make Google Translate not translate the field names.

       Copy-paste into a text editor. Select the lines up to at most 5 000 chars,
       paste into Google Translate (which has a 5 000 chars max limit), look at the result.
       And repeat, until have had a look at all translations.

    4. Automatically find whitespace and punctuation chars errors. Some translation strings
       should start or end with a space, or a '?' or ':' or newline '\n',
       and here's how to automatically check for such chars having gotten lost when translating:
       (There's kind of *always* a typo somewhere, related to this, which can
       result in for example a question becoming a statement, or two words getting joined
       together and becoming "impossible" to read.)

       Go to the site, in the new language (step iii just above). Then load English:

       ```js
       var t_nn_NN = t; // remember your new language, otherwise gets overwritten
       // This'll create a variable t_en_US, i.e. English language values (and also overwrite `t`).
       debiki2.Server.loadJs(eds.assetUrlPrefix + 'translations/en_US/i18n.js');
       ```

       Now, compare all English and new-language values, to find missing or extra spaces/punctuation,
       by running this Javascript in the browser dev console:

       ```js
       var maybeTranslErrors = {};

       _.forOwn(t_en_US, function(englishValue, key) {
         var otherValue = t_nn_NN[key];
         if (_.isString(englishValue)) {
           findMaybeError(englishValue, otherValue, key);
         }
         else if (!otherValue) {
           maybeTranslErrors[key] = [eng, undefined];
         }
         else {
           _.forOwn(englishValue, function(englishSubValue, subKey) {
             var otherSubValue = otherValue[subKey];
             findMaybeError(englishSubValue, otherSubValue, key + '.' + subKey);
           });
         }
       });

       // Returns the character, if it's whitespace or punctuation, otherwise returns '' or false.
       function punctSpace(text) {
         if (!text) return '';
         var notAsciiMatch = text.match(/[^\u0000-\u007F]/g);
         // Unicode chars in language nn_NN probably aren't punctuation or whitespace.
         if (notAsciiMatch) return false;
         // Now: \s = is whitespace, \W = is not alphanumeric.
         var whitePunctMatch = text.match(/[\s\W]/g);
         if (!whitePunctMatch) return false;
         return whitePunctMatch[0];
       }

       function findMaybeError(eng, otr, path) {
         var weird = false;
         if (_.isUndefined(otr)) {
           weird = true;
         }
         else {
          var firstEng = punctSpace(eng[0]);
          var firstOtr = punctSpace(otr[0]);
          var lastEng = punctSpace(eng[eng.length - 1]);
          var lastOtr = punctSpace(otr[otr.length - 1]);
          weird = firstEng !== firstOtr || lastEng !== lastOtr;
         }
         if (weird) {
           maybeTranslErrors[path] = [eng, otr];
         }
       }

       console.log("Found " + _.size(maybeTranslErrors) + " differences, saved in 'maybeTranslErrors':");
       console.log(maybeTranslErrors);
       ```

       Then, try to fix the errors. Maybe ask the translator if something is unclear.

    5. Build and deploy a new server version.

    6. Later, when adding new per language values, they'll be missing in the new language, nn_NN.
       Then, see if Google Translate can do a seemingly ok translation (e.g. translate back
       to English, see if still means the same thing) if so, add the translation and mark
       with `[google-translate]` in a comment on the same line. Maybe every 3rd? 6th? month?,
       ask people who speak the relevant language, if those new translations are ok or not,
       and update & fix. If you feel rather unsure about if the Google Translate result is okay,
       add the text in English instead, and append  `//   MISSING`.
       Or use the Google Translate result, and append `//  MAYBE` — meaning, a *maybe* ok translation.
       Later on, some day, someone who knows the language, can look at the *missing* and *maybe*
       fields.

