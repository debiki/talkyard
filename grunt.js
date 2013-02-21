// Config file for Javascript minification and concatenation.
// See http://gruntjs.com/

module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-mincss');
  grunt.loadNpmTasks('grunt-livescript');
  grunt.loadNpmTasks('grunt-wrap');

  var debikiDesktopFiles = [
      'client/vendor/bootstrap-tooltip.js', //
      'client/vendor/diff_match_patch.js',
      'client/vendor/html-sanitizer-bundle.js',
      'client/vendor/javascript-yaml-parser.js',
      'client/vendor/jquery-cookie.js',
      'client/vendor/jquery-scrollable.js', //
      'client/vendor/livescript/prelude-browser.js',
      'client/vendor/popuplib.js',
      'client/vendor/waypoints.js',
      'client/debiki/tagdog.js',
      'target/client/debiki/bootstrap-angularjs.js',
      'target/client/debiki/debiki-action-delete.js',
      'target/client/debiki/debiki-action-edit.js',
      'target/client/debiki/debiki-action-flag.js',
      'target/client/debiki/debiki-action-links.js',
      'target/client/debiki/debiki-action-rate.js',
      'target/client/debiki/debiki-action-reply.js',
      'target/client/debiki/debiki-actions-inline.js',
      'target/client/debiki/debiki-arrows-png.js',
      'target/client/debiki/debiki-arrows-svg.js',
      'target/client/debiki/debiki-cur-user.js',
      'target/client/debiki/debiki-edit-history.js',
      'target/client/debiki/debiki-form-anims.js',
      'target/client/debiki/debiki-http-dialogs.js',
      'target/client/debiki/debiki-inline-threads.js',
      'target/client/debiki/debiki-jquery-dialogs.js',
      'target/client/debiki/debiki-jquery-find.js',
      'target/client/debiki/debiki-keyboard-shortcuts.js', //
      'target/client/debiki/debiki-layout.js',
      'target/client/debiki/debiki-login-guest.js',
      'target/client/debiki/debiki-login.js',
      'target/client/debiki/debiki-login-openid.js',
      'target/client/debiki/debiki-logout-dialog.js',
      'target/client/debiki/debiki-markup.js',
      'target/client/debiki/debiki-merge-changes.js',
      'target/client/debiki/debiki-patch-page.js',
      'target/client/debiki/debiki-post-header.js',
      'target/client/debiki/debiki-resize.js',
      'target/client/debiki/debiki-scroll-into-view.js',
      'target/client/debiki/debiki-show-and-highlight.js',
      'target/client/debiki/debiki-show-interactions.js',
      'target/client/debiki/debiki-show-location-in-nav.js',
      'target/client/debiki/debiki-unread.js',
      'target/client/debiki/debiki-util.js',
      'target/client/debiki/debiki-util-browser.js',
      'target/client/debiki/debiki-util-play.js',
      'target/client/debiki/debiki-utterscroll-init-tips.js',//
      'client/debiki/debiki-utterscroll.js',//
      'target/client/debiki/debiki-forum.js',
      'target/client/debiki/debiki-page-path.js',
      'target/client/debiki/debiki-create-page.js',
      'target/client/debiki/debiki.js']

  var debikiTouchFiles = [
      'client/vendor/diff_match_patch.js',
      'client/vendor/html-sanitizer-bundle.js',
      'client/vendor/javascript-yaml-parser.js',
      'client/vendor/jquery-cookie.js',
      'client/vendor/livescript/prelude-browser.js',
      'client/vendor/popuplib.js',
      'client/vendor/waypoints.js',
      'client/debiki/tagdog.js',
      'target/client/debiki/android-zoom-bug-workaround.js', //
      'target/client/debiki/bootstrap-angularjs.js',
      'target/client/debiki/debiki-action-delete.js',
      'target/client/debiki/debiki-action-edit.js',
      'target/client/debiki/debiki-action-flag.js',
      'target/client/debiki/debiki-action-links.js',
      'target/client/debiki/debiki-action-rate.js',
      'target/client/debiki/debiki-action-reply.js',
      'target/client/debiki/debiki-actions-inline.js',
      'target/client/debiki/debiki-arrows-png.js',
      'target/client/debiki/debiki-arrows-svg.js',
      'target/client/debiki/debiki-cur-user.js',
      'target/client/debiki/debiki-edit-history.js',
      'target/client/debiki/debiki-form-anims.js',
      'target/client/debiki/debiki-http-dialogs.js',
      'target/client/debiki/debiki-inline-threads.js',
      'target/client/debiki/debiki-jquery-dialogs.js',
      'target/client/debiki/debiki-jquery-find.js',
      'target/client/debiki/debiki-layout.js',
      'target/client/debiki/debiki-login-guest.js',
      'target/client/debiki/debiki-login.js',
      'target/client/debiki/debiki-login-openid.js',
      'target/client/debiki/debiki-logout-dialog.js',
      'target/client/debiki/debiki-markup.js',
      'target/client/debiki/debiki-merge-changes.js',
      'target/client/debiki/debiki-patch-page.js',
      'target/client/debiki/debiki-post-header.js',
      'target/client/debiki/debiki-resize.js',
      'target/client/debiki/debiki-scroll-into-view.js',
      'target/client/debiki/debiki-show-and-highlight.js',
      'target/client/debiki/debiki-show-interactions.js',
      'target/client/debiki/debiki-show-location-in-nav.js',
      'target/client/debiki/debiki-unread.js',
      'target/client/debiki/debiki-util.js',
      'target/client/debiki/debiki-util-browser.js',
      'target/client/debiki/debiki-util-play.js',
      'target/client/debiki/debiki-forum.js',
      'target/client/debiki/debiki-page-path.js',
      'target/client/debiki/debiki-create-page.js',
      'target/client/debiki/debiki.js']

  grunt.initConfig({
    pkg: '<json:package.json>',
    banner: grunt.file.read('client/banner.js'),
    meta: {
      name: 'debiki-app-play',
      banner: '<%= banner %>'
    },
    livescript: {
      compile: {
        files: {
          // Transpiled files will appear in target/client/**/*.js.
          'target/client/*.js': 'client/**/*.ls'
        }
      }
    },
    wrap: {
      javascript: {
        src: 'client/**/*.js',
        // Files will appear in target/client/**/*.js — apparently, 
        // the whole `src` path is appendet to `dest` (unlike the
        // `livescript` task above, which only appends the `/**/*.ls`
        // path to the destination path).
        dest: 'target/',
        wrapper: ['(function() {\n', '\n}).call(this);']
      }
    },
    concat: {
      'public/res/combined-debiki.css': [
          'client/banner.css',
          'public/res/jquery-ui/jquery-ui-1.8.16.custom.css',
          'client/debiki/debiki.css',
          'client/debiki/debiki-play.css'],

      'public/res/admin.css': [
          'client/admin/admin-theme.css',
          'client/spa/admin/css/admin-page.css',
          'client/spa/debiki-spa-common.css'],

      'public/res/combined-debiki-desktop.js':
          debikiDesktopFiles,

      'public/res/combined-debiki-touch.js':
          debikiTouchFiles,

      'public/res/debiki-spa-common.js': [
          'target/client/vendor/livescript/prelude-browser-min.js',
          'target/client/vendor/bootstrap-tooltip.js', // -popup.js dependee
          'target/client/vendor/bootstrap-*.js',
          'target/client/vendor/angular-ui/module.js',
          'target/client/vendor/angular-ui/directives/jq/jq.js',
          'target/client/vendor/angular-ui/directives/modal/modal.js',
          'target/client/debiki/debiki-util.js',
          'target/client/spa/js/angular-util.js'],

      'public/res/debiki-spa-admin.js': [
          'target/client/debiki/debiki-page-path.js',
          'target/client/spa/admin/js/*.js',
          'target/client/spa/admin/js/modal-dialog.js'], // requires AngularJS module

      'public/res/debiki-spa-admin-server-mock.js': [
          'target/client/spa/admin/js/debiki-v0-server-mock.js'],

      'public/res/debiki-spa-new-website-choose-owner.js': [
          'target/client/spa/js/new-website-choose-owner.js'],

      'public/res/debiki-spa-new-website-choose-name.js': [
          'target/client/spa/js/new-website-choose-name.js'],

      'public/res/debiki-dashbar.js': [
          'target/client/debiki/debiki-dashbar.js'],

      'public/res/debiki-pagedown.js': [
        'modules/pagedown/Markdown.Converter.js',
        'client/compiledjs/PagedownJavaInterface.js']
    },
    min: {
      'public/res/combined-debiki-desktop.min.js': [
          '<banner>',
          'public/res/combined-debiki-desktop.js'],

      'public/res/combined-debiki-touch.min.js': [
          '<banner>',
          'public/res/combined-debiki-touch.js'],

      'public/res/debiki-pagedown.min.js': [
          'public/res/debiki-pagedown.js']
    },
    // This results in malfunctioning CSS?
    mincss: {
      compress: {
        files: {
          'public/res/combined-debiki.min.css':
              'public/res/combined-debiki.css'
        }
      }
    },
    watch: {
      all: {
        files: [
            'client/**/*.js',
            'client/**/*.ls',
            'client/**/*.css'],
        tasks: ['default'],
        options: {
          interrupt: true
        }
      }
    }
  });

  grunt.registerTask('default', 'livescript wrap concat min mincss');

};

// vim: et ts=2 sw=2 list
