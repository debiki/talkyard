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

  var copyrightAndLicenseBanner =
      "/*!\n" +
      " * This file is copyrighted and licensed under the AGPL license.\n" +
      " * Some parts of it might be licensed under more permissive\n" +
      " * licenses, e.g. MIT or Apache 2. Find the source code and\n" +
      " * exact details here:\n" +
      " *   https://github.com/debiki/debiki-server\n" +
      " */\n";

  var debikiDesktopFiles = [
      'client/third-party/bootstrap/tooltip.js', //
      'client/third-party/bootstrap/dropdown.js',
      'client/third-party/diff_match_patch.js',
      'client/third-party/html-sanitizer-bundle.js',
      'client/third-party/jquery-cookie.js',
      'client/third-party/jquery-scrollable.js', //
      'client/third-party/livescript/prelude-browser.js',
      'client/third-party/popuplib.js',
      'client/third-party/waypoints.js',
      'client/util/scripts/modernizr-positionfixed.js',
      'client/util/scripts/scrollfix2d.js',
      'client/page/scripts/tagdog.js',
      'target/client/page/scripts/debiki-page-module.js',
      'target/client/page/scripts/bootstrap-angularjs.js',
      'target/client/page/scripts/debiki-action-delete.js',
      'target/client/page/scripts/debiki-action-dialogs.js',
      'target/client/page/scripts/debiki-action-edit.js',
      'target/client/page/scripts/debiki-action-flag.js',
      'target/client/page/scripts/debiki-action-links.js',
      'target/client/page/scripts/debiki-action-rate.js',
      'target/client/page/scripts/debiki-action-reply.js',
      'target/client/page/scripts/debiki-actions-inline.js',
      'target/client/page/scripts/debiki-arrows-png.js',
      'target/client/page/scripts/debiki-arrows-svg.js',
      'target/client/page/scripts/debiki-dashbar.js',
      'target/client/page/scripts/debiki-cur-user.js',
      'target/client/page/scripts/debiki-diff-match-patch.js',
      'target/client/page/scripts/debiki-edit-history.js',
      'target/client/page/scripts/debiki-form-anims.js',
      'target/client/page/scripts/debiki-http-dialogs.js',
      'target/client/page/scripts/debiki-inline-threads.js',
      'target/client/page/scripts/debiki-jquery-dialogs.js',
      'target/client/page/scripts/debiki-jquery-find.js',
      'target/client/page/scripts/debiki-keyboard-shortcuts.js', //
      'target/client/page/scripts/debiki-layout.js',
      'target/client/page/scripts/debiki-load-page-parts.js',
      'target/client/page/scripts/debiki-login-guest.js',
      'target/client/page/scripts/debiki-login.js',
      'target/client/page/scripts/debiki-login-openid.js',
      'target/client/page/scripts/debiki-login-openid-dialog-html.js',
      'target/client/page/scripts/debiki-logout-dialog.js',
      'target/client/page/scripts/debiki-markup.js',
      'target/client/page/scripts/debiki-merge-changes.js',
      'target/client/page/scripts/debiki-minimap.js',
      'target/client/page/scripts/debiki-monitor-reading-progress.js',
      'target/client/page/scripts/debiki-patch-page.js',
      'target/client/page/scripts/debiki-pin.js',
      'target/client/page/scripts/debiki-post-header.js',
      'target/client/page/scripts/debiki-resize.js',
      'target/client/page/scripts/debiki-scroll-into-view.js',
      'target/client/page/scripts/debiki-show-and-highlight.js',
      'target/client/page/scripts/debiki-show-interactions.js',
      'target/client/page/scripts/debiki-show-location-in-nav.js',
      'target/client/page/scripts/debiki-toggle-collapsed.js',
      //'target/client/page/scripts/debiki-unread.js',
      'target/client/page/scripts/debiki-util.js',
      'target/client/page/scripts/debiki-util-browser.js',
      'target/client/page/scripts/debiki-util-play.js',
      'target/client/page/scripts/debiki-utterscroll-init-tips.js',//
      'client/page/scripts/debiki-utterscroll.js',//
      'target/client/page/scripts/debiki-forum.js',
      'target/client/page/scripts/debiki-page-path.js',
      'target/client/page/scripts/debiki-create-page.js',
      'target/client/page/scripts/debiki.js']

  var debikiTouchFiles = [
      'client/third-party/bootstrap/dropdown.js',
      'client/third-party/diff_match_patch.js',
      'client/third-party/html-sanitizer-bundle.js',
      'client/third-party/jquery-cookie.js',
      'client/third-party/livescript/prelude-browser.js',
      'client/third-party/popuplib.js',
      'client/third-party/waypoints.js',
      'client/util/scripts/modernizr-positionfixed.js',
      'client/util/scripts/scrollfix2d.js',
      'client/page/scripts/tagdog.js',
      'target/client/page/scripts/debiki-page-module.js',
      'target/client/page/scripts/bootstrap-angularjs.js',
      'target/client/page/scripts/debiki-action-delete.js',
      'target/client/page/scripts/debiki-action-dialogs.js',
      'target/client/page/scripts/debiki-action-edit.js',
      'target/client/page/scripts/debiki-action-flag.js',
      'target/client/page/scripts/debiki-action-links.js',
      'target/client/page/scripts/debiki-action-rate.js',
      'target/client/page/scripts/debiki-action-reply.js',
      'target/client/page/scripts/debiki-actions-inline.js',
      'target/client/page/scripts/debiki-arrows-png.js',
      'target/client/page/scripts/debiki-arrows-svg.js',
      'target/client/page/scripts/debiki-dashbar.js',
      'target/client/page/scripts/debiki-cur-user.js',
      'target/client/page/scripts/debiki-diff-match-patch.js',
      'target/client/page/scripts/debiki-edit-history.js',
      'target/client/page/scripts/debiki-form-anims.js',
      'target/client/page/scripts/debiki-http-dialogs.js',
      'target/client/page/scripts/debiki-inline-threads.js',
      'target/client/page/scripts/debiki-jquery-dialogs.js',
      'target/client/page/scripts/debiki-jquery-find.js',
      'target/client/page/scripts/debiki-layout.js',
      'target/client/page/scripts/debiki-load-page-parts.js',
      'target/client/page/scripts/debiki-login-guest.js',
      'target/client/page/scripts/debiki-login.js',
      'target/client/page/scripts/debiki-login-openid.js',
      'target/client/page/scripts/debiki-login-openid-dialog-html.js',
      'target/client/page/scripts/debiki-logout-dialog.js',
      'target/client/page/scripts/debiki-markup.js',
      'target/client/page/scripts/debiki-merge-changes.js',
      'target/client/page/scripts/debiki-minimap.js',
      'target/client/page/scripts/debiki-monitor-reading-progress.js',
      'target/client/page/scripts/debiki-patch-page.js',
      'target/client/page/scripts/debiki-pin.js',
      'target/client/page/scripts/debiki-post-header.js',
      'target/client/page/scripts/debiki-resize.js',
      'target/client/page/scripts/debiki-scroll-into-view.js',
      'target/client/page/scripts/debiki-show-and-highlight.js',
      'target/client/page/scripts/debiki-show-interactions.js',
      'target/client/page/scripts/debiki-show-location-in-nav.js',
      'target/client/page/scripts/debiki-toggle-collapsed.js',
      //'target/client/page/scripts/debiki-unread.js',
      'target/client/page/scripts/debiki-util.js',
      'target/client/page/scripts/debiki-util-browser.js',
      'target/client/page/scripts/debiki-util-play.js',
      'target/client/page/scripts/debiki-forum.js',
      'target/client/page/scripts/debiki-page-path.js',
      'target/client/page/scripts/debiki-create-page.js',
      'target/client/page/scripts/debiki.js']

  var stylusFiles = [
      'public/res/jquery-ui/jquery-ui-1.9.2.custom.css',
      'client/page/styles/debiki.styl',
      'client/page/styles/debiki-play.styl'];

  var stylusAdminFiles = [
      'client/admin/styles/admin-theme.styl',
      'client/admin/styles/admin-page.styl',
      'client/util/styles/debiki-shared.styl'];

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
      serverMax: {
        options: {
          compress: false,
          linenos: true,
          firebug: true
        },
        files: {
          'public/res/combined-debiki.css': stylusFiles,
          'public/res/admin.css': stylusAdminFiles
        }
      },
      serverMin: {
        options: {
          compress: true,
          banner: copyrightAndLicenseBanner
        },
        files: {
          'public/res/combined-debiki.min.css': stylusFiles,
          'public/res/admin.min.css': stylusAdminFiles
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
          copyrightAndLicenseBanner +
          "/*\n" +
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
        'public/res/combined-debiki-desktop.js':
            debikiDesktopFiles,

        'public/res/combined-debiki-touch.js':
            debikiTouchFiles,

        'public/res/debiki-spa-common.js': [
            'target/client/third-party/livescript/prelude-browser-min.js',
            'target/client/third-party/bootstrap/tooltip.js', // -popup.js dependee
            'target/client/third-party/bootstrap/*.js',
            'target/client/third-party/angular-ui/module.js',
            'target/client/third-party/angular-ui/directives/jq/jq.js',
            'target/client/third-party/angular-ui/directives/modal/modal.js',
            'target/client/page/scripts/debiki-util.js'],

        'public/res/debiki-spa-admin.js': [
            'client/third-party/diff_match_patch.js',
            'target/client/page/scripts/debiki-diff-match-patch.js',
            'target/client/page/scripts/debiki-page-path.js',
            // Include the module first; it's needed by modal-dialog.js.
            'target/client/admin/scripts/module-and-services.js',
            'target/client/admin/scripts/*.js'],

        'public/res/debiki-spa-install-first-site.js': [
            'target/client/install/scripts/install-ng-app.js'],

        'public/res/debiki-spa-new-website-choose-owner.js': [
            'target/client/new-site/scripts/new-website-choose-owner.js'],

        'public/res/debiki-spa-new-website-choose-name.js': [
            'target/client/new-site/scripts/new-website-choose-name.js'],

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
    watch: {
      options: {
        interrupt: true
      },
      server: {
        files: [
            'client/**/*.js',
            'client/**/*.ls',
            'client/**/*.styl'],
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

  grunt.registerTask('default', ['livescript', 'wrap', 'stylus', 'concat']);
  grunt.registerTask('release', ['livescript', 'wrap', 'stylus', 'concat', 'uglify']);

};

// vim: et ts=2 sw=2 list
