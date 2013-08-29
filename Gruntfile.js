/* Build file for client scripts and styles. See http://gruntjs.com/
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// COULD compile certain coffeescript files in test/ and test-client/
// or translate it to LiveScript.

module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-livescript');
  grunt.loadNpmTasks('grunt-wrap');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-stylus');
  //grunt.loadNpmTasks('grunt-contrib-cssmin');

  var debikiDesktopFiles = [
      'client/vendor/bootstrap-tooltip.js', //
      'client/vendor/diff_match_patch.js',
      'client/vendor/html-sanitizer-bundle.js',
      'client/vendor/jquery-cookie.js',
      'client/vendor/jquery-scrollable.js', //
      'client/vendor/livescript/prelude-browser.js',
      'client/vendor/popuplib.js',
      'client/vendor/waypoints.js',
      'client/debiki/tagdog.js',
      'target/client/debiki/bootstrap-angularjs.js',
      'target/client/debiki/debiki-action-delete.js',
      'target/client/debiki/debiki-action-dialogs.js',
      'target/client/debiki/debiki-action-edit.js',
      'target/client/debiki/debiki-action-flag.js',
      'target/client/debiki/debiki-action-links.js',
      'target/client/debiki/debiki-action-rate.js',
      'target/client/debiki/debiki-action-reply.js',
      'target/client/debiki/debiki-actions-inline.js',
      'target/client/debiki/debiki-arrows-png.js',
      'target/client/debiki/debiki-arrows-svg.js',
      'target/client/debiki/debiki-cur-user.js',
      'target/client/debiki/debiki-diff-match-patch.js',
      'target/client/debiki/debiki-edit-history.js',
      'target/client/debiki/debiki-form-anims.js',
      'target/client/debiki/debiki-http-dialogs.js',
      'target/client/debiki/debiki-inline-threads.js',
      'target/client/debiki/debiki-jquery-dialogs.js',
      'target/client/debiki/debiki-jquery-find.js',
      'target/client/debiki/debiki-keyboard-shortcuts.js', //
      'target/client/debiki/debiki-layout.js',
      'target/client/debiki/debiki-load-page-parts.js',
      'target/client/debiki/debiki-login-guest.js',
      'target/client/debiki/debiki-login.js',
      'target/client/debiki/debiki-login-openid.js',
      'target/client/debiki/debiki-logout-dialog.js',
      'target/client/debiki/debiki-markup.js',
      'target/client/debiki/debiki-merge-changes.js',
      'target/client/debiki/debiki-monitor-reading-progress.js',
      'target/client/debiki/debiki-patch-page.js',
      'target/client/debiki/debiki-post-header.js',
      'target/client/debiki/debiki-resize.js',
      'target/client/debiki/debiki-scroll-into-view.js',
      'target/client/debiki/debiki-show-and-highlight.js',
      'target/client/debiki/debiki-show-interactions.js',
      'target/client/debiki/debiki-show-location-in-nav.js',
      'target/client/debiki/debiki-toggle-collapsed.js',
      //'target/client/debiki/debiki-unread.js',
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
      'client/vendor/jquery-cookie.js',
      'client/vendor/livescript/prelude-browser.js',
      'client/vendor/popuplib.js',
      'client/vendor/waypoints.js',
      'client/debiki/tagdog.js',
      'target/client/debiki/android-zoom-bug-workaround.js', //
      'target/client/debiki/bootstrap-angularjs.js',
      'target/client/debiki/debiki-action-delete.js',
      'target/client/debiki/debiki-action-dialogs.js',
      'target/client/debiki/debiki-action-edit.js',
      'target/client/debiki/debiki-action-flag.js',
      'target/client/debiki/debiki-action-links.js',
      'target/client/debiki/debiki-action-rate.js',
      'target/client/debiki/debiki-action-reply.js',
      'target/client/debiki/debiki-actions-inline.js',
      'target/client/debiki/debiki-arrows-png.js',
      'target/client/debiki/debiki-arrows-svg.js',
      'target/client/debiki/debiki-cur-user.js',
      'target/client/debiki/debiki-diff-match-patch.js',
      'target/client/debiki/debiki-edit-history.js',
      'target/client/debiki/debiki-form-anims.js',
      'target/client/debiki/debiki-http-dialogs.js',
      'target/client/debiki/debiki-inline-threads.js',
      'target/client/debiki/debiki-jquery-dialogs.js',
      'target/client/debiki/debiki-jquery-find.js',
      'target/client/debiki/debiki-layout.js',
      'target/client/debiki/debiki-load-page-parts.js',
      'target/client/debiki/debiki-login-guest.js',
      'target/client/debiki/debiki-login.js',
      'target/client/debiki/debiki-login-openid.js',
      'target/client/debiki/debiki-logout-dialog.js',
      'target/client/debiki/debiki-markup.js',
      'target/client/debiki/debiki-merge-changes.js',
      'target/client/debiki/debiki-monitor-reading-progress.js',
      'target/client/debiki/debiki-patch-page.js',
      'target/client/debiki/debiki-post-header.js',
      'target/client/debiki/debiki-resize.js',
      'target/client/debiki/debiki-scroll-into-view.js',
      'target/client/debiki/debiki-show-and-highlight.js',
      'target/client/debiki/debiki-show-interactions.js',
      'target/client/debiki/debiki-show-location-in-nav.js',
      'target/client/debiki/debiki-toggle-collapsed.js',
      //'target/client/debiki/debiki-unread.js',
      'target/client/debiki/debiki-util.js',
      'target/client/debiki/debiki-util-browser.js',
      'target/client/debiki/debiki-util-play.js',
      'target/client/debiki/debiki-forum.js',
      'target/client/debiki/debiki-page-path.js',
      'target/client/debiki/debiki-create-page.js',
      'target/client/debiki/debiki.js']

  grunt.initConfig({
    pkg: '<json:package.json>',
    livescript: {
      options: {
        // See <https://github.com/DavidSouther/grunt-livescript/blob/master/
        //        tasks/livescript.js>
      },
      server: {
        files: [{
          // Transpiled files will appear in target/client/**/*.js.
          expand: true,
          cwd: 'client/',
          src: '**/*.ls',
          dest: 'target/client',
          ext: '.js'
        }]
      }
    },
    stylus: {
      server: {
        options: {
          compress: false, // for now
          linenos: true,
          firebug: true
        },
        files: {
          'public/res/combined-debiki.css': [
            'public/res/jquery-ui/jquery-ui-1.9.2.custom.css',
            'client/debiki/debiki.styl',
            'client/debiki/debiki-play.styl']
        }
      }
    },
    wrap: {
      server_javascript: {
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
      server: {
       options: {
        // See https://npmjs.org/package/grunt-contrib-concat
        banner:
          "/*!\n" +
          " * This file is copyrighted and licensed under the AGPL license.\n" +
          " * Some parts of it might be licensed under more permissive\n" +
          " * licenses, e.g. MIT or Apache 2. Find the source code and\n" +
          " * exact details here:\n" +
          " *   https://github.com/debiki/debiki-server\n" +
          " *//*\n" +
          " * This file is a concatenation of many different files.\n" +
          " * Each such file has its own copyright notices. Some parts\n" +
          " * are released under other more permissive licenses\n" +
          " * than the AGPL. Files are separated by a '======' line.\n" +
          " */\n" +
          "\n" +
          "/*=== The first file: ==========================================*/\n",
        separator:
          "\n" +
          "/*=== Next file: ===============================================*/\n"
       },
       files: {
        // The `cssmin` plugin is broken (see below, search for `cssmin`)
        // so right now simply copy the complete CSS file.
        'public/res/combined-debiki.min.css': [
          'public/res/combined-debiki.css'],

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
            'client/vendor/diff_match_patch.js',
            'target/client/debiki/debiki-diff-match-patch.js',
            'target/client/debiki/debiki-page-path.js',
            // Include the module first; it's needed by modal-dialog.js.
            'target/client/spa/admin/js/module-and-services.js',
            'target/client/spa/admin/js/*.js'],

        'public/res/debiki-spa-install-first-site.js': [
            'target/client/spa/install/install-ng-app.js'],

        'public/res/debiki-spa-new-website-choose-owner.js': [
            'target/client/spa/js/new-website-choose-owner.js'],

        'public/res/debiki-spa-new-website-choose-name.js': [
            'target/client/spa/js/new-website-choose-name.js'],

        'public/res/debiki-dashbar.js': [
            'target/client/debiki/debiki-dashbar.js'],

        // Warning: Duplicated rule. A corresponding rule is also present
        // in the Makefile. Keep in sync.
        'public/res/debiki-pagedown.js': [
          'modules/pagedown/Markdown.Converter.js',
          'client/compiledjs/PagedownJavaInterface.js'],
       },
      },
      editor: {
        options: {
          banner:
            "/*!\n" +
            " * Copyright (C) 2013 Marijn Haverbeke <marijnh@gmail.com>\n" +
            " * Source code available under the MIT license, see:\n" +
            " *   http://github.com/marijnh/CodeMirror\n" +
            " *\n" +
            " * Parts Copyright (C) 2013 Kaj Magnus Lindberg\n" +
            " * (a certain codemirror-show-markdown-line-breaks addon only)\n" +
            " */\n" +
            "\n",
        },
        files: {
          'public/res/codemirror-3-13-custom.js': [
            'client/third-party/codemirror/lib/codemirror.js',
            'client/third-party/codemirror/mode/css/css.js',
            'client/third-party/codemirror/mode/xml/xml.js',
            'client/third-party/codemirror/mode/javascript/javascript.js',
            'client/third-party/codemirror/mode/markdown/markdown.js',
            'client/third-party/codemirror/mode/yaml/yaml.js',
            'client/third-party/codemirror/mode/htmlmixed/htmlmixed.js',
            'client/third-party/codemirror/addon/dialog/dialog.js',
            'client/third-party/codemirror/addon/search/search.js',
            'client/third-party/codemirror/addon/search/searchcursor.js',
            'client/third-party/codemirror/addon/edit/matchbrackets.js',
            // No:
            //'client/third-party/codemirror/addon/edit/trailingspace.js',
            // Instead:
            'client/third-party/codemirror-show-markdown-line-breaks.js',
          ],
          'public/res/codemirror-3-13-custom.css': [
            'client/third-party/codemirror/lib/codemirror.css',
            'client/third-party/codemirror/addon/dialog/dialog.css', // for the search dialog
            'client/third-party/codemirror-show-markdown-line-breaks.css',
          ],
        }
      },
      // Finds theme specific files in app/views/themes/<themeName>/<bundleName>/*.css
      // and concatenates them to public/themes/<themeName>/<bundleName>
      // and <bundleName> must currently be 'styles.css'.
      themes: {
        files: [{
          expand: true,
          cwd: 'app/views/themes/',
          src: '*/styles.css/*.css',
          dest: 'public/themes/',
          rename: function(dest, src) {
            // `dest` is:  public/themes/
            // `src` is:  <themeName>/<bundleName>/<fileName>
            grunt.verbose.writeln('Placing source file: ' + src);
            var matchesArray = src.match(
                //<theme name>   <bundle name>  <file name>
                //e.g. ex_theme e.g. styles.css e.g. some-file.css
                /^([a-z0-9_]+)\/([a-z0-9_.]+)\/[a-z0-9_.-]+$/);
            var themeName = matchesArray[1];
            var bundleName = matchesArray[2];
            grunt.verbose.writeln('in theme/bundle: ' + themeName + '/' + bundleName);
            return dest + themeName + '/' + bundleName;
          }
        }]
      }
    },
    uglify: {
      // Minifies ./public/res/*.js to *.min.js in the same directory.
      server: {
        options: {
          // Preserves bang comments: /*!  ... */ added by the 'concat' target.
          preserveComments: 'some'
        },
        expand: true,
        cwd: 'public/res/',
        src: ['*.js', '!*.min.js'],
        dest: 'public/res/',
        ext: '.min.js',
      }
    },
    // This results in malfunctioning CSS?
    // Try grunt-csso instead? Or CSSTidy?
    // And a """Warning: Object #<Object> has no method 'expandFiles'
    // Use --force to continue.""" error, as of Grunt v0.4.1 (May 2013),
    // see <https://github.com/gruntjs/grunt/wiki/Configuring-tasks
    //        #building-the-files-object-dynamically>
    // for info on how to perhaps fix that error.
    // Therefore, for now, only `combine:` but don't `minify:`.
    // Ooops, both `combine` and `compress` strips my `.DW [class*=" icon-"]`
    // rules! Comment out this weird plugin ("grunt-contrib-cssmin": "~0.6.0".)
    /*cssmin: {
      compress: {
        files: {
          'public/res/combined-debiki.min.css': [
            'public/res/combined-debiki.css']
        }
      }
    },*/
    watch: {
      options: {
        interrupt: true
      },
      server: {
        files: [
            'client/**/*.js',
            'client/**/*.ls',
            'client/**/*.css'],
        tasks: ['default']
      },
      themes: {
        files: [
            'app/views/themes/**/*.js',
            'app/views/themes/**/*.css']
        // tasks: ['???'],
      }
    }
  });

  grunt.registerTask('default', ['livescript', 'wrap', 'stylus', 'concat', 'uglify']);//, 'cssmin']);

};

// vim: et ts=2 sw=2 list
