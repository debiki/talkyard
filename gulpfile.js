/**
 * Build file for client scripts and styles.
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

/**
 * Commands:
 *
 *   gulp          - build everything for development
 *   gulp release  - build and minify everything, for release
 *   gulp watch    - continuously rebuild things that change
 */

var gulp = require('gulp');
var newer = require('gulp-newer');
var templateCache = require('gulp-angular-templatecache');
var typeScript = require('gulp-tsc');
var liveScript = require('gulp-livescript');
var stylus = require('gulp-stylus');
var minifyCSS = require('gulp-minify-css');
var concat = require('gulp-concat');
var rename = require("gulp-rename");
var header = require('gulp-header');
var wrap = require('gulp-wrap');
var uglify = require('gulp-uglify');
var es = require('event-stream');
var fs = require("fs");
var path = require("path");

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

var nextFileLine =
  '\n\n//=== Next file: ===============================================================\n\n';


var debikiDesktopFiles = [
      'bower_components/lodash/dist/lodash.js',
      'bower_components/moment/min/moment.min.js',
      'bower_components/angular-moment/angular-moment.min.js',
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
      'bower_components/lodash/dist/lodash.js',
      'bower_components/moment/min/moment.min.js',
      'bower_components/angular-moment/angular-moment.min.js',
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
// (parten-header.js and parent-footer.js wraps and lazy loads the files inbetween,
// see client/embedded-comments/scripts/readme.txt.)
var debikiEmbeddedCommentsFiles = [
      'client/embedded-comments/scripts/parent-header.js',  // not ^target/client/...
      'client/third-party/jquery-scrollable.js',
      'client/third-party/jquery.browser.js',
      'target/client/embedded-comments/scripts/debiki-utterscroll-iframe-parent.js',
      'target/client/page/scripts/debiki-utterscroll-init-tips.js',
      'target/client/embedded-comments/scripts/iframe-parent.js',
      'client/embedded-comments/scripts/parent-footer.js'];  // not ^target/client/...


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


gulp.task('compile-templates', function () {
  return gulp.src('client/forum/**/*.html')
      .pipe(templateCache({
        module: 'ForumApp',
        filename: 'all-angular-templates.js'
      }))
      .pipe(gulp.dest('target/client/'));
});



gulp.task('concat-debiki-scripts', [
    'wrap-javascript',
    'compile-livescript',
    'compile-typescript',
    'compile-templates'], function() {
  return makeConcatDebikiScriptsStream();
});

function makeConcatDebikiScriptsStream() {
  function makeConcatStream(outputFileName, filesToConcat) {
    return gulp.src(filesToConcat)
        // `newer` here avoids rebuilding debiki-pagedown.js which would cause the
        // Makefile to compile JS to Java followed by compilation of some Scala code.
        .pipe(newer('public/res/' + outputFileName))
        .pipe(header(nextFileLine))
        .pipe(concat(outputFileName))
        .pipe(header(thisIsAConcatenationMessage))
        .pipe(header(copyrightAndLicenseBanner))
        .pipe(gulp.dest('public/res/'));
  }

  return es.merge(
      makeConcatStream('combined-debiki-desktop.js', debikiDesktopFiles),
      makeConcatStream('combined-debiki-touch.js', debikiTouchFiles),
      makeConcatStream('login-popup.js', loginPopupFiles),
      makeConcatStream('embedded-comments.js', debikiEmbeddedCommentsFiles),

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
      makeConcatStream('debiki-pagedown.js', [
          'modules/pagedown/Markdown.Converter.js',
          'client/compiledjs/PagedownJavaInterface.js']));
};



gulp.task('concat-codemirror-scripts', function() {
  return makeCodeMirrorScriptsStream();
});

function makeCodeMirrorScriptsStream() {
  function makeConcatStream(outputFileName, filesToConcat) {
    return gulp.src(filesToConcat)
        .pipe(concat(outputFileName))
        .pipe(header(codeMirrorBanner))
        .pipe(gulp.dest('public/res/'));
  }
  return es.merge(
      makeConcatStream('codemirror-3-13-custom.js', codeMirrorScripts),
      makeConcatStream('codemirror-3-13-custom.css', codeMirrorStyles));
};



gulp.task('wrap-javascript-concat-scripts', ['wrap-javascript'], function () {
  // Perhaps some CodeMirror Javascript file has been upgraded, so
  // concatenate CodeMirror scripts too, not only Debiki's scripts.
  return makeConcatDebikiAndCodeMirrorScriptsStream();
});

gulp.task('compile-livescript-concat-scripts', ['compile-livescript'], function () {
  return makeConcatDebikiScriptsStream();
});

gulp.task('compile-typescript-concat-scripts', ['compile-typescript'], function () {
  return makeConcatDebikiScriptsStream();
});

gulp.task('compile-templates-concat-scripts', ['compile-templates'], function () {
  return makeConcatDebikiScriptsStream();
});

gulp.task('compile-concat-scripts',
    ['wrap-javascript', 'compile-livescript', 'compile-typescript', 'compile-templates'],
    function () {
  return makeConcatDebikiAndCodeMirrorScriptsStream();
});

function makeConcatDebikiAndCodeMirrorScriptsStream() {
  return es.merge(
      makeConcatDebikiScriptsStream(),
      makeCodeMirrorScriptsStream());
};



gulp.task('minify-scripts', ['concat-debiki-scripts', 'concat-codemirror-scripts'], function() {
  return gulp.src('public/res/*.js', { ignore: 'public/res/*.min.js' })
      .pipe(uglify())
      .pipe(rename({ extname: '.min.js' }))
      .pipe(header(copyrightAndLicenseBanner))
      .pipe(gulp.dest('public/res/'));
});



gulp.task('compile-stylus', function () {

  var stylusOpts = {
    linenos: true,
    // Could include:  use: [nib()]
  };

  var minifyOpts = {
    keepSpecialComments: 0
  };

  gulp.src([
      'public/res/jquery-ui/jquery-ui-1.9.2.custom.css',
      'client/page/styles/debiki.styl',
      'client/page/styles/minimap.styl',
      'client/page/styles/arrows.styl',
      'client/page/styles/tips.styl',
      'client/page/styles/dashbar.styl',
      'client/page/styles/debiki-play.styl',
      'client/page/styles/login-dialog.styl',
      'client/page/styles/third-party.styl',
      'client/forum/**/*.styl'])
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



/**
 * Copies app/views/themes/<themeName>/styles.css/*.css to
 * public/themes/<themeName>/styles.css.
 */
gulp.task('build-themes', function () {

  var themeDir = 'app/views/themes/';
  var themeNames = listDirectories(themeDir);

  function listDirectories(baseDirectory) {
    var dirs = fs.readdirSync(baseDirectory).filter(function(file) {
      return fs.statSync(path.join(baseDirectory, file)).isDirectory();
    });
    return dirs;
  }

  var themeStreams = themeNames.map(function(name) {
    return makeThemeStream(name);
  });

  function makeThemeStream(themeName) {
    var srcDir = themeDir + themeName + '/styles.css/**/*.css';
    var destDir = 'public/themes/' + themeName;
    return gulp.src(srcDir)
      // COULD pipe through Stylus or LESS here, but which one? Or both somehow?
      .pipe(concat('styles.css'))
      .pipe(gulp.dest(destDir))
      .pipe(minifyCSS())
      .pipe(concat('styles.min.css'))
      .pipe(gulp.dest(destDir));
  };

  // Also compile the default theme, which is placed in another folder.
  var defaultThemeStream = gulp.src('app/views/themesbuiltin/default20121009/styles.css/**/*.css')
      .pipe(concat('styles.css'))
      .pipe(gulp.dest('public/themes/default20121009/'))
      .pipe(minifyCSS())
      .pipe(concat('styles.min.css'))
      .pipe(gulp.dest('public/themes/default20121009/'));
  themeStreams.push(defaultThemeStream);

  return es.merge.apply(null, themeStreams);
});



gulp.task('watch', function() {

  watchAndLiveForever = true;

  function logChangeFn(fileType) {
    return function(event) {
      console.log(fileType + ' file '+ event.path +' was '+ event.type +', running tasks...');
    };
  };

  gulp.watch('client/forum/**/*.html', ['compile-templates-concat-scripts']).on('change', logChangeFn('HTML'));
  gulp.watch('client/forum/**/*.ts', ['compile-typescript-concat-scripts']).on('change', logChangeFn('TypeScript'));
  gulp.watch('client/**/*.ls', ['compile-livescript-concat-scripts']).on('change', logChangeFn('LiveScript'));
  gulp.watch('client/**/*.js', ['wrap-javascript-concat-scripts']).on('change', logChangeFn('Javascript'));
  gulp.watch('client/**/*.styl', ['compile-stylus']).on('change', logChangeFn('Stylus'));
  gulp.watch(['app/views/themes/**/*.css', 'app/views/themesbuiltin/default20121009/styles.css/**/*.css'],
      ['build-themes']).on('change', logChangeFn('CSS'));

  // what about theme files,?
  //   app/views/themes/** /*.js
  //   app/views/themes/** /*.css
});


gulp.task('default', ['compile-concat-scripts', 'compile-stylus', 'build-themes'], function () {
});


gulp.task('release', ['minify-scripts', 'compile-stylus', 'build-themes'], function() {
});



// vim: et ts=2 sw=2 tw=0 list
