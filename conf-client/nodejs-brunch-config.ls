exports.config =
  # See http://brunch.readthedocs.org/en/latest/config.html for documentation.

  paths:
    app: 'client'
    public: './'

  files:
    javascripts:
      defaultExtension: 'ls'
      joinTo:
        'public/res/combined-debiki-desktop.js':
          // ^client/debiki/debiki-action-delete.js
           | ^client/debiki/debiki-action-edit.js
           | ^client/debiki/debiki-action-flag.js
           | ^client/debiki/debiki-action-links.js
           | ^client/debiki/debiki-action-rate.js
           | ^client/debiki/debiki-action-reply.js
           | ^client/debiki/debiki-actions-inline.js
           | ^client/debiki/debiki-arrows-png.js
           | ^client/debiki/debiki-arrows-svg.js
           | ^client/debiki/debiki.css
           | ^client/debiki/debiki-cur-user.js
           | ^client/debiki/debiki-edit-history.js
           | ^client/debiki/debiki-form-anims.js
           | ^client/debiki/debiki-http-dialogs.js
           | ^client/debiki/debiki-inline-threads.js
           | ^client/debiki/debiki-jquery-dialogs.js
           | ^client/debiki/debiki-jquery-find.js
           | ^client/debiki/debiki.js
           | ^client/debiki/debiki-keyboard-shortcuts.js
           | ^client/debiki/debiki-login-guest.js
           | ^client/debiki/debiki-login.js
           | ^client/debiki/debiki-login-openid.js
           | ^client/debiki/debiki-logout-dialog.js
           | ^client/debiki/debiki-markup.js
           | ^client/debiki/debiki-merge-changes.js
           | ^client/debiki/debiki-patch-page.ls
           | ^client/debiki/debiki-play.css
           | ^client/debiki/debiki-post-header.js
           | ^client/debiki/debiki-resize.js
           | ^client/debiki/debiki-scroll-into-view.js
           | ^client/debiki/debiki-show-and-highlight.js
           | ^client/debiki/debiki-show-interactions.js
           | ^client/debiki/debiki-show-location-in-nav.js
           | ^client/debiki/debiki-util.js
           | ^client/debiki/debiki-util-browser.js
           | ^client/debiki/debiki-util-play.js
           | ^client/debiki/debiki-utterscroll-init-tips.js
           | ^client/debiki/debiki-utterscroll.js
           | ^client/debiki/tagdog.js
           | ^client/vendor/bootstrap-tooltip.js
           | ^client/vendor/diff_match_patch.js
           | ^client/vendor/html-sanitizer-bundle.js
           | ^client/vendor/javascript-yaml-parser.js
           | ^client/vendor/jquery-cookie.js
           | ^client/vendor/jquery-scrollable.js
           | ^client/vendor/popuplib.js
          //

        'public/res/combined-debiki-touch.js':
          // ^client/debiki/android-zoom-bug-workaround.js
           | ^client/debiki/debiki-action-delete.js
           | ^client/debiki/debiki-action-edit.js
           | ^client/debiki/debiki-action-flag.js
           | ^client/debiki/debiki-action-links.js
           | ^client/debiki/debiki-action-rate.js
           | ^client/debiki/debiki-action-reply.js
           | ^client/debiki/debiki-actions-inline.js
           | ^client/debiki/debiki-arrows-png.js
           | ^client/debiki/debiki-arrows-svg.js
           | ^client/debiki/debiki.css
           | ^client/debiki/debiki-cur-user.js
           | ^client/debiki/debiki-edit-history.js
           | ^client/debiki/debiki-form-anims.js
           | ^client/debiki/debiki-http-dialogs.js
           | ^client/debiki/debiki-inline-threads.js
           | ^client/debiki/debiki-jquery-dialogs.js
           | ^client/debiki/debiki-jquery-find.js
           | ^client/debiki/debiki.js
           | ^client/debiki/debiki-login-guest.js
           | ^client/debiki/debiki-login.js
           | ^client/debiki/debiki-login-openid.js
           | ^client/debiki/debiki-logout-dialog.js
           | ^client/debiki/debiki-markup.js
           | ^client/debiki/debiki-merge-changes.js
           | ^client/debiki/debiki-patch-page.ls
           | ^client/debiki/debiki-play.css
           | ^client/debiki/debiki-post-header.js
           | ^client/debiki/debiki-resize.js
           | ^client/debiki/debiki-scroll-into-view.js
           | ^client/debiki/debiki-show-and-highlight.js
           | ^client/debiki/debiki-show-interactions.js
           | ^client/debiki/debiki-show-location-in-nav.js
           | ^client/debiki/debiki-util.js
           | ^client/debiki/debiki-util-browser.js
           | ^client/debiki/debiki-util-play.js
           | ^client/debiki/tagdog.js
           | ^client/vendor/diff_match_patch.js
           | ^client/vendor/html-sanitizer-bundle.js
           | ^client/vendor/javascript-yaml-parser.js
           | ^client/vendor/jquery-cookie.js
           | ^client/vendor/popuplib.js
          //

        'public/res/debiki-spa-common.js':
          // ^client/vendor/bootstrap-.*.js
           | ^client/debiki/debiki-util.js
           | ^client/spa/js/angular-util.ls
           | ^client/vendor/livescript/prelude-browser-min.js
          //

        'public/res/debiki-spa-admin.js':
          // ^client/spa/admin/js/admin-page.ls
           | ^client/spa/admin/js/debiki-utils.ls
          //

        'public/res/debiki-spa-admin-server-mock.js':
          // ^client/spa/admin/js/debiki-v0-server-mock.ls
          //

        'public/res/debiki-spa-new-website-choose-owner.js':
          // ^client/spa/js/new-website-choose-owner.ls
          //

        'public/res/debiki-dashbar.js':
          // ^client/debiki/debiki-dashbar.ls
          //

      order:
        after: ['client/debiki/debiki.js']
        # bootstrap-popup.js extends -tooltip.js.
        before: ['client/vendor/bootstrap-tooltip.js']

    stylesheets:
      defaultExtension: 'styl'
      joinTo:
        'public/res/combined-debiki.css': /^client\/debiki/
        'public/res/debiki-spa-admin.css': //^client/spa/admin/css//
      order:
        before: ['client/debiki/debiki.css']

  modules:
    definition: false
    wrapper: (path, data) -> """
      (function() {
        #{data}
      })();\n\n
      """

# vim: et ts=2 sw=2 list
