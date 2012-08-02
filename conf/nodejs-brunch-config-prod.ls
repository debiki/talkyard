exports.config =
  # See http://brunch.readthedocs.org/en/latest/config.html for documentation.
  minify: true
  paths:
    public: 'public'
  files:
    javascripts:
      defaultExtension: 'ls'
      joinTo:
        'res/debiki-app-play.min.js': /^app/
        'javascripts/vendor.js': /^_nowhere_\/vendor/
        'test/javascripts/test.js': /^_nowhere_\/test(\/|\\)(?!vendor)/
        'test/javascripts/test-vendor.js': /^_nowhere_\/test(\/|\\)(?=vendor)/
      order:
        # Files in `vendor` directories are compiled before other files
        # even if they aren't specified in order.before.
        before:
          * 'vendor/scripts/console-helper.js'
          * 'vendor/scripts/jquery-1.7.2.js'
          * 'vendor/scripts/underscore-1.3.3.js'
          * 'vendor/scripts/backbone-0.9.2.js'

    stylesheets:
      defaultExtension: 'styl'
      joinTo:
        'res/debiki-app-play.min.css': /^(app\/assets|vendor)/
        'test/stylesheets/test.css': /^_nowhere_\/test/
      order:
        before: ['app/assets/debiki.css']

    templates:
      defaultExtension: 'hbs'
      joinTo: 'javascripts/app.js'

  conventions:
    # By default, Brunch copies everything in app/assets/ as is
    # to public/, without compiling it.
    assets: /disable-because-play-framework-stores-assets-in-public/

  modules:
    definition: false
    wrapper: false

  framework: 'chaplin'
