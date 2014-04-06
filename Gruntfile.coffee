###
Build file for client scripts and styles. See http://gruntjs.com/
Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
###


module.exports = (grunt) ->

  grunt.loadNpmTasks('grunt-livescript')
  grunt.loadNpmTasks('grunt-typescript')
  grunt.loadNpmTasks('grunt-wrap')
  grunt.loadNpmTasks('grunt-contrib-concat')
  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-contrib-stylus')

  copyrightAndLicenseBanner = """
      /*!
       * This file is copyrighted and licensed under the AGPL license.
       * Some parts of it might be licensed under more permissive
       * licenses, e.g. MIT or Apache 2. Find the source code and
       * exact details here:
       *   https://github.com/debiki/debiki-server
       */
      """

  thisIsAConcatenationMessage = """
      /*
       * This file is a concatenation of many different files.
       * Each such file has its own copyright notices. Some parts
       * are released under other more permissive licenses
       * than the AGPL. Files are separated by a '======' line.
       */
      """

  debikiDesktopFiles = [
      'client/third-party/bootstrap/tooltip.js', #
      'client/third-party/bootstrap/dropdown.js',
      'client/third-party/bootstrap/tab.js',
      'client/third-party/diff_match_patch.js',
      'client/third-party/html-sanitizer-bundle.js',
      'client/third-party/jquery-cookie.js',
      'client/third-party/jquery-scrollable.js', #
      'client/third-party/jquery.browser.js', #
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
      'target/client/page/scripts/debiki-action-reply-form-html.js',
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
      'target/client/page/scripts/debiki-iframe.js',
      'target/client/util/scripts/debiki-jquery-dialogs.js',
      'target/client/page/scripts/debiki-jquery-find.js',
      'target/client/page/scripts/debiki-keyboard-shortcuts.js', #
      'target/client/page/scripts/debiki-layout.js',
      'target/client/page/scripts/debiki-load-page-parts.js',
      'target/client/page/scripts/debiki-login.js',
      'target/client/page/scripts/debiki-login-popup.js',
      'target/client/login-popup/scripts/debiki-login-dialog.js',
      'target/client/login-popup/scripts/debiki-login-guest.js',
      'target/client/login-popup/scripts/debiki-login-password.js',
      'target/client/login-popup/scripts/debiki-login-openid.js',
      'target/client/login-popup/scripts/debiki-login-openid-dialog-html.js',
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
      #'target/client/page/scripts/debiki-unread.js',
      'target/client/page/scripts/debiki-util.js',
      'target/client/page/scripts/debiki-util-browser.js',
      'target/client/page/scripts/debiki-util-play.js',
      'target/client/page/scripts/debiki-utterscroll-init-tips.js',#
      'client/page/scripts/debiki-utterscroll.js',#
      'target/client/page/scripts/debiki-page-path.js',
      'target/client/page/scripts/debiki-create-page.js',
      'target/client/util/scripts/debiki-utils.js',
      'target/client/all-typescript.js',
      'target/client/page/scripts/debiki.js']

  debikiTouchFiles = [
      'client/third-party/bootstrap/dropdown.js',
      'client/third-party/bootstrap/tab.js',
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
      'target/client/page/scripts/debiki-action-reply-form-html.js',
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
      'target/client/page/scripts/debiki-iframe.js',
      'target/client/util/scripts/debiki-jquery-dialogs.js',
      'target/client/page/scripts/debiki-jquery-find.js',
      'target/client/page/scripts/debiki-layout.js',
      'target/client/page/scripts/debiki-load-page-parts.js',
      'target/client/page/scripts/debiki-login.js',
      'target/client/page/scripts/debiki-login-popup.js',
      'target/client/login-popup/scripts/debiki-login-dialog.js',
      'target/client/login-popup/scripts/debiki-login-guest.js',
      'target/client/login-popup/scripts/debiki-login-password.js',
      'target/client/login-popup/scripts/debiki-login-openid.js',
      'target/client/login-popup/scripts/debiki-login-openid-dialog-html.js',
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
      #'target/client/page/scripts/debiki-unread.js',
      'target/client/page/scripts/debiki-util.js',
      'target/client/page/scripts/debiki-util-browser.js',
      'target/client/page/scripts/debiki-util-play.js',
      'target/client/page/scripts/debiki-page-path.js',
      'target/client/page/scripts/debiki-create-page.js',
      'target/client/util/scripts/debiki-utils.js',
      'target/client/all-typescript.js',
      'target/client/page/scripts/debiki.js']


  # For both touch devices and desktops.
  loginPopupFiles = [
      'client/third-party/jquery-cookie.js',
      'target/client/util/scripts/debiki-jquery-dialogs.js',
      'target/client/util/scripts/debiki-utils.js',
      'target/client/login-popup/scripts/debiki-login-dialog.js',
      'target/client/login-popup/scripts/debiki-login-guest.js',
      'target/client/login-popup/scripts/debiki-login-password.js',
      'target/client/login-popup/scripts/debiki-login-openid.js',
      'target/client/login-popup/scripts/debiki-login-openid-dialog-html.js']

  # For both touch devices and desktops.
  debikiEmbeddedCommentsFiles = [
      'client/third-party/jquery-scrollable.js',
      'client/third-party/jquery.browser.js',
      'target/client/embedded-comments/scripts/debiki-utterscroll-iframe-parent.js',
      'target/client/page/scripts/debiki-utterscroll-init-tips.js',
      'target/client/embedded-comments/scripts/iframe-parent.js']

  stylusFiles = [
      'public/res/jquery-ui/jquery-ui-1.9.2.custom.css',
      'client/page/styles/debiki.styl',
      'client/page/styles/tips.styl',
      'client/page/styles/debiki-play.styl',
      'client/page/styles/forum.styl']

  iframeParentStylusFiles = [
      'client/page/styles/tips.styl']

  stylusAdminDartFiles = [
      'client/admin-dart/styles/*.styl']

  stylusAdminFiles = [
      'client/admin/styles/admin-theme.styl',
      'client/admin/styles/admin-page.styl',
      'client/util/styles/debiki-shared.styl']

  grunt.initConfig({
    pkg: '<json:package.json>',
    livescript: {
      options: {
        # See <https://github.com/DavidSouther/grunt-livescript/blob/master/
        #        tasks/livescript.js>
      },
      server: {
        files: [{
          # Transpiled files will appear in target/client/**/*.js.
          expand: true,
          cwd: 'client/',
          src: '**/*.ls',
          dest: 'target/client',
          ext: '.js'
        }]
      }
    },
    typescript: {
      all:
        src: [ 'client/**/*.ts' ]
        dest: 'target/client/all-typescript.js'
        options:
          target: 'es5'
          sourceMap: true
          comments: true
          newLine: 'lf'
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
          'public/res/debiki-embedded-comments.css': iframeParentStylusFiles,
          'client/admin-dart/admin-dart/web/styles.css': stylusAdminDartFiles,
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
          'public/res/debiki-embedded-comments.min.css': iframeParentStylusFiles,
          'client/admin-dart/admin-dart/web/styles.min.css': stylusAdminDartFiles,
          'public/res/admin.min.css': stylusAdminFiles
        }
      }
    },
    wrap: {
      server_javascript: {
        src: 'client/**/*.js',
        # Files will appear in target/client/**/*.js — apparently, 
        # the whole `src` path is appendet to `dest` (unlike the
        # `livescript` task above, which only appends the `/**/*.ls`
        # path to the destination path).
        dest: 'target/',
        wrapper: ['(function() {\n', '\n}).call(this);']
      }
    },
    concat: {
      server: {
       options: {
        # See https://npmjs.org/package/grunt-contrib-concat
        banner: """
          #{copyrightAndLicenseBanner}
          #{thisIsAConcatenationMessage}

          /*=== The first file: ==========================================*/


          """
        separator: """


          /*=== Next file: ===============================================*/


          """
       },
       files: {
        'public/res/combined-debiki-desktop.js': debikiDesktopFiles

        'public/res/combined-debiki-touch.js': debikiTouchFiles

        'public/res/login-popup.js': loginPopupFiles

        'public/res/debiki-spa-common.js': [
            'target/client/third-party/livescript/prelude-browser-min.js',
            'target/client/third-party/bootstrap/tooltip.js', # -popup.js dependee
            'target/client/third-party/bootstrap/*.js',
            'target/client/third-party/angular-ui/module.js',
            'target/client/third-party/angular-ui/directives/jq/jq.js',
            'target/client/third-party/angular-ui/directives/modal/modal.js',
            'target/client/page/scripts/debiki-util.js'],

        'public/res/debiki-spa-admin.js': [
            'client/third-party/diff_match_patch.js',
            'target/client/page/scripts/debiki-diff-match-patch.js',
            'target/client/page/scripts/debiki-page-path.js',
            # Include the module first; it's needed by modal-dialog.js.
            'target/client/admin/scripts/module-and-services.js',
            'target/client/admin/scripts/*.js'],

        'public/res/debiki-spa-install-first-site.js': [
            'target/client/install/scripts/install-ng-app.js'],

        'public/res/debiki-spa-new-website-choose-owner.js': [
            'target/client/new-site/scripts/new-website-choose-owner.js'],

        'public/res/debiki-spa-new-website-choose-name.js': [
            'target/client/new-site/scripts/new-website-choose-name.js'],

        # Warning: Duplicated rule. A corresponding rule is also present
        # in the Makefile. Keep in sync.
        'public/res/debiki-pagedown.js': [
          'modules/pagedown/Markdown.Converter.js',
          'client/compiledjs/PagedownJavaInterface.js'],
       },
      },
      editor: {
        options: {
          banner: """
            /*!
             * Copyright (C) 2013 Marijn Haverbeke <marijnh@gmail.com>\
             * Source code available under the MIT license, see:
             *   http://github.com/marijnh/CodeMirror
             *
             * Parts Copyright (C) 2013 Kaj Magnus Lindberg
             * (a certain codemirror-show-markdown-line-breaks addon only)
             */
            """
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
            # No:
            #'client/third-party/codemirror/addon/edit/trailingspace.js',
            # Instead:
            'client/third-party/codemirror-show-markdown-line-breaks.js',
          ],
          'public/res/codemirror-3-13-custom.css': [
            'client/third-party/codemirror/lib/codemirror.css',
            'client/third-party/codemirror/addon/dialog/dialog.css', # for the search dialog
            'client/third-party/codemirror-show-markdown-line-breaks.css',
          ],
        }
      },
      # Finds theme specific files in app/views/themes/<themeName>/<bundleName>/*.css
      # and concatenates them to public/themes/<themeName>/<bundleName>
      # and <bundleName> must currently be 'styles.css'.
      themes: {
        files: [{
          expand: true,
          cwd: 'app/views/themes/',
          src: '*/styles.css/*.css',
          dest: 'public/themes/',
          rename: (dest, src) ->
            # `dest` is:  public/themes/
            # `src` is:  <themeName>/<bundleName>/<fileName>
            grunt.verbose.writeln('Placing source file: ' + src)
            matchesArray = src.match(
                #<theme name>   <bundle name>  <file name>
                #e.g. ex_theme e.g. styles.css e.g. some-file.css
                /^([a-z0-9_]+)\/([a-z0-9_.]+)\/[a-z0-9_.-]+$/)
            themeName = matchesArray[1]
            bundleName = matchesArray[2]
            grunt.verbose.writeln('in theme/bundle: ' + themeName + '/' + bundleName)
            dest + themeName + '/' + bundleName
        }]
      },
      # This produces embedded-comments.js which will use LaizyLoad.js to automatically load
      # jQuery and Modernizr unless they've already been loaded. Afterwards it runs Debiki's
      # code. I've accomplished this by wrapping Debiki's code in a function, runDebikisCode(),
      # that I'm executing once LaizyLoad is done loading.
      embeddedComments: {
        files:
          'public/res/embedded-comments.js': debikiEmbeddedCommentsFiles
        options: {
          # See https://npmjs.org/package/grunt-contrib-concat
          banner: """
            #{copyrightAndLicenseBanner}
            #{thisIsAConcatenationMessage}


            window.debiki = { internal: {}, v0: { util: {} } };

            // Finds Debiki server origin, by extracting origin of the debiki-embedded-comments.js script.
            // We need it when loading CSS, and when loading the <iframe> with embedded comments.
            debiki.internal.debikiServerOrigin = (function() {
              var origin;
              var scripts = document.getElementsByTagName('script');
              for (var i = 0; i < scripts.length; ++i) {
                script = scripts[i];
                var srcAttr = script.src;
                var isEmbeddedCommentsScript = srcAttr.search(/\\/-\\/debiki-embedded-comments.js/) !== -1;
                if (isEmbeddedCommentsScript) {
                  origin = srcAttr.match(/^[^/]*\\/\\/[^/]+/)[0];
                }
              }
              if (!origin && console.error) {
                console.error(
                  'Error extracting Debiki server origin, is there no "/-/debiki-embedded-comments.js" script?');
              }
              return origin;
            })();


            debiki.internal.runDebikisCode = function() {

            debiki.internal.$ = jQuery;


            /*=== The first file: ==========================================*/

            """
          separator: """


            /*=== Next file: ===============================================*/


            """
          footer: """

            }; // end of runDebikisCode()


            // You'll find the code below inlined in Gruntfile.coffee:
            // ----------------------

            // Inline LazyLoad minified, https://github.com/rgrove/lazyload/
            // version 7ac401a8 from Jan 11, 2014
            // LazyLoad is Copyright (c) 2011 Ryan Grove, all rights reserved,
            // and licensed under the MIT license, see the GitHub repo linked above.
            // Minified by: http://jscompress.com/ January 16 2014.
            // After minifying it and pasting it into this Coffescript string,
            // I had to change two '\' to '\\'.
            LazyLoad=function(e){function u(t,n){var r=e.createElement(t),i;for(i in n){if(n.hasOwnProperty(i)){r.setAttribute(i,n[i])}}return r}function a(e){var t=r[e],n,o;if(t){n=t.callback;o=t.urls;o.shift();i=0;if(!o.length){n&&n.call(t.context,t.obj);r[e]=null;s[e].length&&l(e)}}}function f(){var n=navigator.userAgent;t={async:e.createElement("script").async===true};(t.webkit=/AppleWebKit\\//.test(n))||(t.ie=/MSIE|Trident/.test(n))||(t.opera=/Opera/.test(n))||(t.gecko=/Gecko\\//.test(n))||(t.unknown=true)}function l(i,o,l,p,d){var v=function(){a(i)},m=i==="css",g=[],y,b,w,E,S,x;t||f();if(o){o=typeof o==="string"?[o]:o.concat();if(m||t.async||t.gecko||t.opera){s[i].push({urls:o,callback:l,obj:p,context:d})}else{for(y=0,b=o.length;y<b;++y){s[i].push({urls:[o[y]],callback:y===b-1?l:null,obj:p,context:d})}}}if(r[i]||!(E=r[i]=s[i].shift())){return}n||(n=e.head||e.getElementsByTagName("head")[0]);S=E.urls.concat();for(y=0,b=S.length;y<b;++y){x=S[y];if(m){w=t.gecko?u("style"):u("link",{href:x,rel:"stylesheet"})}else{w=u("script",{src:x});w.async=false}w.className="lazyload";w.setAttribute("charset","utf-8");if(t.ie&&!m&&"onreadystatechange"in w&&!("draggable"in w)){w.onreadystatechange=function(){if(/loaded|complete/.test(w.readyState)){w.onreadystatechange=null;v()}}}else if(m&&(t.gecko||t.webkit)){if(t.webkit){E.urls[y]=w.href;h()}else{w.innerHTML='@import "'+x+'";';c(w)}}else{w.onload=w.onerror=v}g.push(w)}for(y=0,b=g.length;y<b;++y){n.appendChild(g[y])}}function c(e){var t;try{t=!!e.sheet.cssRules}catch(n){i+=1;if(i<200){setTimeout(function(){c(e)},50)}else{t&&a("css")}return}a("css")}function h(){var e=r.css,t;if(e){t=o.length;while(--t>=0){if(o[t].href===e.urls[0]){a("css");break}}i+=1;if(e){if(i<200){setTimeout(h,50)}else{a("css")}}}}var t,n,r={},i=0,s={css:[],js:[]},o=e.styleSheets;return{css:function(e,t,n,r){l("css",e,t,n,r)},js:function(e,t,n,r){l("js",e,t,n,r)}}}(this.document);


            // Load jQuery and Modernizr unless already done. Then CSS. Then run Debiki's code.

            debiki.internal.loadJQueryEtcThenRunDebiki = function() {
              if (!window.jQuery) {
                LazyLoad.js('//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js', function() {
                  debiki.internal.loadModernizrEtcThenRunDebiki();
                });
              }
              else {
                debiki.internal.loadModernizrEtcThenRunDebiki();
              }
            }

            debiki.internal.loadModernizrEtcThenRunDebiki = function() {
              if (!window.Modernizr) {
                LazyLoad.js('//cdnjs.cloudflare.com/ajax/libs/modernizr/2.7.1/modernizr.min.js', function() {
                  debiki.internal.loadCssThenRunDebiki();
                });
              }
              else {
                debiki.internal.loadCssThenRunDebiki();
              }
            }

            debiki.internal.loadCssThenRunDebiki = function() {
              LazyLoad.css(debiki.internal.debikiServerOrigin + '/-/debiki-embedded-comments.css', function() {
                debiki.internal.runDebikisCode();
              });
            }

            debiki.internal.loadJQueryEtcThenRunDebiki();

            """
        }
      }
    },
    uglify: {
      # Minifies ./public/res/*.js to *.min.js in the same directory.
      server: {
        options: {
          # Preserves bang comments: /*!  ... */ added by the 'concat' target.
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
            'client/**/*.ts',
            'client/**/*.styl'],
        tasks: ['default']
      },
      themes: {
        files: [
            'app/views/themes/**/*.js',
            'app/views/themes/**/*.css']
        # tasks: ['???'],
      },
      embeddedComments: {
        files: [
            'client/**/*.js',
            'client/**/*.ls']
      }
    }
  })

  grunt.registerTask('default', ['livescript', 'typescript', 'wrap', 'stylus', 'concat'])
  grunt.registerTask('release', ['livescript', 'typescript', 'wrap', 'stylus', 'concat', 'uglify'])


# vim: et ts=2 sw=2 list
