exports.config =
  # See http://brunch.readthedocs.org/en/latest/config.html for documentation.

  paths:
    app: 'client'

  files:
    javascripts:
      defaultExtension: 'ls'
      joinTo:
        'res/debiki-app-play.js': /^client/
    stylesheets:
      defaultExtension: 'styl'
      joinTo:
        'res/debiki-app-play.css': /^client/
      order:
        before: ['app/assets/debiki.css']

  conventions:
    # By default, Brunch copies everything in app/assets/ as is
    # to public/, without compiling it.
    assets: /disable-because-play-framework-stores-assets-in-public/

  modules:
    definition: false
    wrapper: false
