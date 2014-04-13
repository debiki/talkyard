/**
 * Build file for client scripts and styles. Use `gulp` not `grunt`.
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

// To build Debiki's client resources, call `gulp`. It'll do some things, and
// then call Grunt, to do even more things, which I have not yet ported to
// Gulp.
//
// (I'm using both Gulp and Grunt. The reason is that there was some error with
// Grunt compiling TypeScript files over and over again forever, and I worked
// around the problem and by switching to Gulp instead since it's a lot faster
// anyway. But I have not yet ported everything to Gulp.)


var gulp = require('gulp');
require('gulp-grunt')(gulp);
var templateCache = require('gulp-angular-templatecache');
var typeScript = require('gulp-tsc');
var liveScript = require('gulp-livescript');
var stylus = require('gulp-stylus');
var minifyCSS = require('gulp-minify-css');
var concat = require('gulp-concat');
var header = require('gulp-header');
var wrap = require('gulp-wrap');
var es = require('event-stream');

var watchAndLiveForever = false;



var copyrightAndLicenseBanner =
  '/*!\n' +
  ' * This file is copyrighted and licensed under the AGPL license.\n' +
  ' * Some parts of it might be licensed under more permissive\n' +
  ' * licenses, e.g. MIT or Apache 2. Find the source code and\n' +
  ' * exact details here:\n' +
  ' *   https://github.com/debiki/debiki-server\n' +
  ' */\n';

var thisIsAConcatenationMessage =
  '/*!\n' +
  ' * This file is a concatenation of many different files.\n' +
  ' * Each such file has its own copyright notices. Some parts\n' +
  ' * are released under other more permissive licenses\n' +
  ' * than the AGPL. Files are separated by a "======" line.\n' +
  ' */\n';

var codeMirrorBanner =
  '/*!\n' +
  ' * Copyright (C) 2013 Marijn Haverbeke <marijnh@gmail.com>\\n' +
  ' * Source code available under the MIT license, see:\n' +
  ' *   http://github.com/marijnh/CodeMirror\n' +
  ' *\n' +
  ' * Parts Copyright (C) 2013 Kaj Magnus Lindberg\n' +
  ' * (a certain codemirror-show-markdown-line-breaks addon only)\n' +
  ' */\n';



var debikiDesktopFiles = [
      'client/third-party/bootstrap/tooltip.js', //
      'client/third-party/bootstrap/dropdown.js',
      'client/third-party/bootstrap/tab.js',
      'client/third-party/diff_match_patch.js',
      'client/third-party/html-sanitizer-bundle.js',
      'client/third-party/jquery-cookie.js',
      'client/third-party/jquery-scrollable.js', //
      'client/third-party/jquery.browser.js', //
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
      'target/client/page/scripts/debiki-keyboard-shortcuts.js', //
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
      //'target/client/page/scripts/debiki-unread.js',
      'target/client/page/scripts/debiki-util.js',
      'target/client/page/scripts/debiki-util-browser.js',
      'target/client/page/scripts/debiki-util-play.js',
      'target/client/page/scripts/debiki-utterscroll-init-tips.js',//
      'client/page/scripts/debiki-utterscroll.js',//
      'target/client/page/scripts/debiki-page-path.js',
      'target/client/page/scripts/debiki-create-page.js',
      'target/client/util/scripts/debiki-utils.js',
      'target/client/all-typescript.js',
      'target/client/all-angular-templates.js',
      'target/client/page/scripts/debiki.js'];


var debikiTouchFiles = [
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
      //'target/client/page/scripts/debiki-unread.js',
      'target/client/page/scripts/debiki-util.js',
      'target/client/page/scripts/debiki-util-browser.js',
      'target/client/page/scripts/debiki-util-play.js',
      'target/client/page/scripts/debiki-page-path.js',
      'target/client/page/scripts/debiki-create-page.js',
      'target/client/util/scripts/debiki-utils.js',
      'target/client/all-angular-templates.js',
      'target/client/all-typescript.js',
      'target/client/page/scripts/debiki.js'];


// For both touch devices and desktops.
var loginPopupFiles = [
      'client/third-party/jquery-cookie.js',
      'target/client/util/scripts/debiki-jquery-dialogs.js',
      'target/client/util/scripts/debiki-utils.js',
      'target/client/login-popup/scripts/debiki-login-dialog.js',
      'target/client/login-popup/scripts/debiki-login-guest.js',
      'target/client/login-popup/scripts/debiki-login-password.js',
      'target/client/login-popup/scripts/debiki-login-openid.js',
      'target/client/login-popup/scripts/debiki-login-openid-dialog-html.js'];


// For both touch devices and desktops.
var debikiEmbeddedCommentsFiles = [
      'client/third-party/jquery-scrollable.js',
      'client/third-party/jquery.browser.js',
      'target/client/embedded-comments/scripts/debiki-utterscroll-iframe-parent.js',
      'target/client/page/scripts/debiki-utterscroll-init-tips.js',
      'target/client/embedded-comments/scripts/iframe-parent.js'];


var codeMirrorScripts = [
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
      'client/third-party/codemirror-show-markdown-line-breaks.js'];


var codeMirrorStyles = [
      'client/third-party/codemirror/lib/codemirror.css',
      'client/third-party/codemirror/addon/dialog/dialog.css', // for the search dialog
      'client/third-party/codemirror-show-markdown-line-breaks.css'];



gulp.task('wrap-javascript', function () {
  // Prevent Javascript variables from polluting the global scope.
  return gulp.src('client/**/*.js')
    .pipe(wrap('(function() {\n<%= contents %>\n}).call(this);'))
    .pipe(gulp.dest('./target/client/'));
});


gulp.task('compile-livescript', function () {
  return gulp.src('client/**/*.ls')
    .pipe(liveScript())
    .pipe(gulp.dest('./target/client/'));
});


gulp.task('compile-typescript', function () {
  var stream = gulp.src(['client/forum/**/*.ts'])
    //.pipe(cache('typescript'))
    .pipe(typeScript({
      target: 'ES5',
      allowBool: true,
      tmpDir: 'target/client/',
      out: 'all-typescript.js'
    }));

  if (watchAndLiveForever) {
    stream.on('error', function() {
      console.log('\n!!! Error compiling TypeScript !!!\n');
    });
  }

  return stream.pipe(gulp.dest('target/client/'));
});


gulp.task('compile-angularjs-templates', function () {
  return gulp.src('client/forum/**/*.html')
      .pipe(templateCache({
        module: 'ForumApp',
        filename: 'all-angular-templates.js'
      }))
      .pipe(gulp.dest('target/client/'));
});



/**
 * Concatenates Javascripts but lists no dependencies, although it does depend
 * on some tasks above. By not listing dependencies, it's possible to avoid
 * compiling some dependencies that have already been compiled, when
 * using `gulp.watch`.
 */
gulp.task('concat-scripts-ignore-dependencies', function() {
  function makeConcatStream(outputFileName, filesToConcat) {
    return gulp.src(filesToConcat)
        .pipe(header('\n\n//=== Next file: ===============================================================\n\n'))
        .pipe(concat(outputFileName))
        .pipe(header(thisIsAConcatenationMessage))
        .pipe(header(copyrightAndLicenseBanner))
        .pipe(gulp.dest('public/res/'));
  }

  return es.merge(
      makeConcatStream('combined-debiki-desktop.js', debikiDesktopFiles),
      makeConcatStream('combined-debiki-touch.js', debikiTouchFiles),
      makeConcatStream('login-popup.js', loginPopupFiles),

      makeConcatStream('debiki-spa-common.js', [
          'target/client/third-party/livescript/prelude-browser-min.js',
          'target/client/third-party/bootstrap/tooltip.js', // -popup.js dependee
          'target/client/third-party/bootstrap/*.js',
          'target/client/third-party/angular-ui/module.js',
          'target/client/third-party/angular-ui/directives/jq/jq.js',
          'target/client/third-party/angular-ui/directives/modal/modal.js',
          'target/client/page/scripts/debiki-util.js']),

      makeConcatStream('debiki-spa-admin.js', [
          'client/third-party/diff_match_patch.js',
          'target/client/page/scripts/debiki-diff-match-patch.js',
          'target/client/page/scripts/debiki-page-path.js',
          // Include the module first; it's needed by modal-dialog.js.
          'target/client/admin/scripts/module-and-services.js',
          'target/client/admin/scripts/*.js']),

      makeConcatStream('debiki-spa-install-first-site.js', [
          'target/client/install/scripts/install-ng-app.js']),

      makeConcatStream('debiki-spa-new-website-choose-owner.js', [
          'target/client/new-site/scripts/new-website-choose-owner.js']),

      makeConcatStream('debiki-spa-new-website-choose-name.js', [
          'target/client/new-site/scripts/new-website-choose-name.js']),

      // Warning: Duplicated rule. A corresponding rule is also present
      // in the Makefile. Keep in sync.
      makeConcatStream('concat-debiki-pagedown.js', 'debiki-pagedown.js', [
          'modules/pagedown/Markdown.Converter.js',
          'client/compiledjs/PagedownJavaInterface.js']));
});


gulp.task('concat-code-mirror-editor', function() {
  function makeConcatStream(outputFileName, filesToConcat) {
    return gulp.src(filesToConcat)
        .pipe(concat(outputFileName))
        .pipe(header(codeMirrorBanner))
        .pipe(gulp.dest('public/res/'));
  }
  return es.merge(
      makeConcatStream('codemirror-3-13-custom.js', codeMirrorScripts),
      makeConcatStream('codemirror-3-13-custom.css', codeMirrorStyles));
});


gulp.task('wrap-javascript-run-grunt', ['wrap-javascript'], function () {
  concatFiles();
});

gulp.task('compile-livescript-run-grunt', ['compile-livescript'], function () {
  concatFiles();
});

gulp.task('compile-typescript-run-grunt', ['compile-typescript'], function () {
  concatFiles();
});

gulp.task('compile-angularjs-templates-run-grunt', ['compile-angularjs-templates'], function () {
  concatFiles();
});

gulp.task('compile-all-run-grunt',
    ['wrap-javascript', 'compile-livescript', 'compile-typescript', 'compile-angularjs-templates'],
    function () {
  concatFiles();
});


function concatFiles() {
  gulp.run('concat-scripts-ignore-dependencies');
  gulp.run('concat-code-mirror-editor');
  gulp.run('grunt-default');
}



gulp.task('compile-stylus', function () {

  var stylusOpts = {
    linenos: true,
    // Currently need to specify `filename: 'stdin'` because of a bug in gulp-stylus or stylus
    // when specifying `linenos: true`, see:
    //    https://github.com/stevelacy/gulp-stylus/issues/30#issuecomment-40267124
    ///filename: 'stdin'
    // Could include:  use: [nib()]
  };

  var minifyOpts = {
    keepSpecialComments: 0
  };

  gulp.src([
      'public/res/jquery-ui/jquery-ui-1.9.2.custom.css',
      'client/page/styles/debiki.styl',
      'client/page/styles/minimap.styl',
      'client/page/styles/tips.styl',
      'client/page/styles/debiki-play.styl',
      'client/page/styles/forum.styl'])
    .pipe(stylus(stylusOpts))
    .pipe(concat('combined-debiki.css'))
    .pipe(gulp.dest('public/res/'))
    .pipe(minifyCSS(minifyOpts))
    .pipe(header(copyrightAndLicenseBanner))
    .pipe(concat('combined-debiki.min.css'))
    .pipe(gulp.dest('public/res/'));

  gulp.src([
      'client/page/styles/tips.styl'])
    .pipe(stylus(stylusOpts))
    .pipe(concat('debiki-embedded-comments.css'))
    .pipe(gulp.dest('public/res/'))
    .pipe(minifyCSS(minifyOpts))
    .pipe(header(copyrightAndLicenseBanner))
    .pipe(concat('debiki-embedded-comments.min.css'))
    .pipe(gulp.dest('public/res/'));

  gulp.src([
      'client/admin-dart/styles/*.styl'])
    .pipe(stylus(stylusOpts))
    .pipe(concat('styles.css'))
    .pipe(gulp.dest('client/admin-dart/admin-dart/web/'))
    .pipe(minifyCSS(minifyOpts))
    .pipe(header(copyrightAndLicenseBanner))
    .pipe(concat('styles.min.css'))
    .pipe(gulp.dest('client/admin-dart/admin-dart/web/'));

  gulp.src([
      'client/admin/styles/admin-theme.styl',
      'client/admin/styles/admin-page.styl',
      'client/util/styles/debiki-shared.styl'])
    .pipe(stylus(stylusOpts))
    .pipe(concat('admin.css'))
    .pipe(gulp.dest('public/res/'))
    .pipe(minifyCSS(minifyOpts))
    .pipe(header(copyrightAndLicenseBanner))
    .pipe(concat('admin.min.css'))
    .pipe(gulp.dest('public/res/'));
});


gulp.task('watch', function() {

  watchAndLiveForever = true;

  function logChangeFn(fileType) {
    return function(event) {
      console.log(fileType + ' file '+ event.path +' was '+ event.type +', running tasks...');
    };
  };

  gulp.watch('client/forum/**/*.html', ['compile-angularjs-templates-run-grunt']).on('change', logChangeFn('HTML'));
  gulp.watch('client/forum/**/*.ts', ['compile-typescript-run-grunt']).on('change', logChangeFn('TypeScript'));
  gulp.watch('client/**/*.ls', ['compile-livescript-run-grunt']).on('change', logChangeFn('LiveScript'));
  gulp.watch('client/**/*.js', ['wrap-javascript-run-grunt']).on('change', logChangeFn('Javascript'));
  gulp.watch('client/**/*.styl', ['compile-stylus']).on('change', logChangeFn('Stylus'));

  // what about theme files,?
  //   app/views/themes/** /*.js
  //   app/views/themes/** /*.css
});


gulp.task('default', ['compile-all-run-grunt', 'compile-stylus'], function () {
});


// vim: et ts=2 sw=2 tw=0 list
