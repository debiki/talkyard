exports.config =
  # See http://brunch.readthedocs.org/en/latest/config.html for documentation.

  # Has no effect, why?
  minify: true

  paths:
    app: 'client'

  files:
    javascripts:
      defaultExtension: 'ls'
      joinTo:
        'res/combined-debiki-desktop.min.js': /^client\/(vendor|bundle-desktop)/
        'res/combined-debiki-touch.min.js': /^client\/(vendor|bundle-touch)/
    stylesheets:
      defaultExtension: 'styl'
      joinTo:
        'res/combined-debiki.min.css': /^client\/debiki/
      order:
        before: ['client/debiki/debiki.css']

  conventions:
    # By default, Brunch copies everything in app/assets/ as is
    # to public/, without compiling it.
    assets: /disable-because-play-framework-stores-assets-in-public/

  modules:
    definition: false
    wrapper: false

