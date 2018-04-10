
To add a new language:

1. Copy `./en/i18n.ts` to a new directory whose name is the language code of the new language.

2. Translate the text fields in the new `i18n.ts` file.

3. When done translating, the Talkyard developers need to: [5JUKQR2]

    1. Update `app/debiki/Nashorn.scala` so the language file gets included in the
        server side Javascript bundle.

    2. Update `client/app/admin/admin-app.staff.ts`: add the language
        to the select-language dropdown.

    3. Build and deploy a new server version.

