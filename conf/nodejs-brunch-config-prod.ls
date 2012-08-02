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
        'res/combined-debiki-desktop.min.js':
          // ^client\/bundle-desktop
           | ^client\/vendor\/bootstrap-tooltip.js
           | ^client\/vendor\/diff_match_patch.js
           | ^client\/vendor\/html-sanitizer-bundle.js
           | ^client\/vendor\/javascript-yaml-parser.js
           | ^client\/vendor\/jquery-cookie.js
           | ^client\/vendor\/jquery-scrollable.js
           | ^client\/vendor\/popuplib.js
          //
        'res/combined-debiki-touch.min.js':
          // ^client\/bundle-touch
           | ^client\/vendor\/diff_match_patch.js
           | ^client\/vendor\/html-sanitizer-bundle.js
           | ^client\/vendor\/javascript-yaml-parser.js
           | ^client\/vendor\/jquery-cookie.js
           | ^client\/vendor\/popuplib.js
          //

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

