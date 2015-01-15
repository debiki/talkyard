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

var nextFileLine =
  '\n\n//=== Next file: ===============================================================\n\n';


var debikiDesktopFiles = [
      'bower_components/keymaster/keymaster.js',
      'bower_components/lodash/dist/lodash.js',
      'bower_components/moment/min/moment.min.js',
      'bower_components/eventemitter2/lib/eventemitter2.js',
      'bower_components/react-bootstrap/react-bootstrap.js',
      'bower_components/react-router/dist/react-router.js',
      'bower_components/Caret.js/dist/jquery.caret.js',
      'bower_components/jquery.atwho/dist/js/jquery.atwho.js',
      'bower_components/nicescroll/jquery.nicescroll.js',
      'client/third-party/bootstrap/tooltip.js', //
      'client/third-party/bootstrap/dropdown.js',
      'client/third-party/bootstrap/tab.js',
      'client/third-party/diff_match_patch.js',
      'client/third-party/html-css-sanitizer-bundle.js',
      'client/third-party/jquery-cookie.js',
      'client/third-party/jquery-scrollable.js', //
      'client/third-party/jquery.browser.js', //
      'client/third-party/livescript/prelude-browser.js',
      'client/third-party/popuplib.js',
      'client/third-party/modernizr-positionfixed.js',
      'client/app/actions/edit/tagdog.js',
      'target/client/app/page-module.js',
      'target/client/app/actions/delete.js',
      'target/client/app/actions/dialogs.js',
      'target/client/app/actions/edit/edit.js',
      'target/client/app/actions/flag.js',
      'target/client/app/old/actions/show-actions.js',
      'target/client/app/actions/vote.js',
      'target/client/app/actions/reply.js',
      'target/client/app/current-user.js',
      'target/client/app/actions/edit/diff-match-patch.js',
      'target/client/app/actions/edit/history.js',
      'target/client/app/utils/http-dialogs.js',
      //'target/client/app/inline-threads-unused.js',
      'target/client/app/iframe.js',
      'target/client/shared/debiki-jquery-dialogs.js',
      'target/client/shared/show-server-response-dialog.js',
      'target/client/app/utils/jquery-find.js',
      'target/client/app/keyboard-shortcuts.js', //
      'target/client/app/posts/layout.js',
      'target/client/app/posts/load-page-parts.js',
      'target/client/app/login/login.js',
      'target/client/app/login/login-popup.js',
      'target/client/app/editor/mentions-remarkable-plugin.js',
      'target/client/shared/login-dialog/login-dialog.js',
      'target/client/shared/login-dialog/login-guest.js',
      'target/client/shared/login-dialog/login-password.js',
      'target/client/shared/login-dialog/login-openid.js',
      'target/client/shared/login-dialog/login-openid-dialog-html.js',
      'target/client/shared/login-dialog/create-user-dialog.js',
      'target/client/app/actions/edit/markup.js',
      'target/client/page/scripts/debiki-merge-changes.js',
      //'target/client/app/posts/monitor-reading-progress-unused.js',
      'target/client/app/posts/patch-page.js',
      'target/client/app/actions/pin.js',
      'target/client/app/posts/post-header.js',
      'target/client/app/posts/resize.js',
      'target/client/app/utils/scroll-into-view.js',
      'target/client/app/utils/show-and-highlight.js',
      'target/client/app/posts/show-comments-section.js',
      'target/client/app/utils/show-location-in-nav.js',
      //'target/client/app/posts/unread-unused.js',
      'target/client/app/utils/util.js',
      'target/client/app/utils/util-browser.js',
      'target/client/app/utils/util-play.js',
      'target/client/app/utterscroll/utterscroll-init-tips.js',//
      'client/app/utterscroll/utterscroll.js',//
      'target/client/app/utils/page-path.js',
      'target/client/app/utils/create-page.js',
      'target/client/shared/post-json.js',
      'target/client/all-typescript.js',
      'target/client/admin-app-angular-templates.js',
      'target/client/app/startup.js'];


var debikiTouchFiles = [
      'bower_components/keymaster/keymaster.js',
      'bower_components/lodash/dist/lodash.js',
      'bower_components/moment/min/moment.min.js',
      'bower_components/eventemitter2/lib/eventemitter2.js',
      'bower_components/react-bootstrap/react-bootstrap.js',
      'bower_components/react-router/dist/react-router.js',
      'bower_components/Caret.js/dist/jquery.caret.js',
      'bower_components/jquery.atwho/dist/js/jquery.atwho.js',
      'bower_components/nicescroll/jquery.nicescroll.js',
      'client/third-party/bootstrap/dropdown.js',
      'client/third-party/bootstrap/tab.js',
      'client/third-party/diff_match_patch.js',
      'client/third-party/html-css-sanitizer-bundle.js',
      'client/third-party/jquery-cookie.js',
      'client/third-party/livescript/prelude-browser.js',
      'client/third-party/popuplib.js',
      'client/third-party/modernizr-positionfixed.js',
      'client/app/actions/edit/tagdog.js',
      'target/client/app/page-module.js',
      'target/client/app/actions/delete.js',
      'target/client/app/actions/dialogs.js',
      'target/client/app/actions/edit/edit.js',
      'target/client/app/actions/flag.js',
      'target/client/app/old/actions/show-actions.js',
      'target/client/app/actions/vote.js',
      'target/client/app/actions/reply.js',
      'target/client/app/current-user.js',
      'target/client/app/actions/edit/diff-match-patch.js',
      'target/client/app/actions/edit/history.js',
      'target/client/app/utils/http-dialogs.js',
      //'target/client/app/inline-threads-unused.js',
      'target/client/app/iframe.js',
      'target/client/shared/debiki-jquery-dialogs.js',
      'target/client/shared/show-server-response-dialog.js',
      'target/client/app/utils/jquery-find.js',
      'target/client/app/posts/layout.js',
      'target/client/app/posts/load-page-parts.js',
      'target/client/app/login/login.js',
      'target/client/app/login/login-popup.js',
      'target/client/app/editor/mentions-remarkable-plugin.js',
      'target/client/shared/login-dialog/login-dialog.js',
      'target/client/shared/login-dialog/login-guest.js',
      'target/client/shared/login-dialog/login-password.js',
      'target/client/shared/login-dialog/login-openid.js',
      'target/client/shared/login-dialog/login-openid-dialog-html.js',
      'target/client/shared/login-dialog/create-user-dialog.js',
      'target/client/app/actions/edit/markup.js',
      'target/client/page/scripts/debiki-merge-changes.js',
      //'target/client/app/posts/monitor-reading-progress-unused.js',
      'target/client/app/posts/patch-page.js',
      'target/client/app/actions/pin.js',
      'target/client/app/posts/post-header.js',
      'target/client/app/posts/resize.js',
      'target/client/app/utils/scroll-into-view.js',
      'target/client/app/utils/show-and-highlight.js',
      'target/client/app/posts/show-comments-section.js',
      'target/client/app/utils/show-location-in-nav.js',
      //'target/client/app/posts/unread-unused.js',
      'target/client/app/utils/util.js',
      'target/client/app/utils/util-browser.js',
      'target/client/app/utils/util-play.js',
      'target/client/app/utils/page-path.js',
      'target/client/app/utils/create-page.js',
      'target/client/shared/post-json.js',
      'target/client/all-typescript.js',
      'target/client/admin-app-angular-templates.js',
      'target/client/app/startup.js'];


// For both touch devices and desktops.
var loginDialogFiles = [
      'client/third-party/jquery-cookie.js',
      'target/client/shared/debiki-jquery-dialogs.js',
      'target/client/shared/show-server-response-dialog.js',
      'target/client/shared/post-json.js',
      'target/client/shared/login-dialog/login-dialog.js',
      'target/client/shared/login-dialog/login-guest.js',
      'target/client/shared/login-dialog/login-password.js',
      'target/client/shared/login-dialog/login-openid.js',
      'target/client/shared/login-dialog/login-openid-dialog-html.js',
      'target/client/shared/login-dialog/create-user-dialog.js'];


// For both touch devices and desktops.
// (parten-header.js and parent-footer.js wraps and lazy loads the files inbetween,
// see client/embedded-comments/readme.txt.)
var debikiEmbeddedCommentsFiles = [
      'client/embedded-comments/parent-header.js',  // not ^target/client/...
      'client/third-party/jquery-scrollable.js',
      'client/third-party/jquery.browser.js',
      'target/client/embedded-comments/debiki-utterscroll-iframe-parent.js',
      'target/client/app/utterscroll/utterscroll-init-tips.js',
      'target/client/embedded-comments/iframe-parent.js',
      'client/embedded-comments/parent-footer.js'];  // not ^target/client/...


var adminOldFiles = [
      'target/client/third-party/livescript/prelude-browser-min.js',
      'target/client/third-party/bootstrap/tooltip.js', // -popup.js dependee
      'target/client/third-party/bootstrap/*.js',
      'target/client/third-party/angular-ui/module.js',
      'target/client/third-party/angular-ui/directives/jq/jq.js',
      'target/client/third-party/angular-ui/directives/modal/modal.js',
      'target/client/app/utils/util.js',
      'client/third-party/diff_match_patch.js',
      'target/client/app/actions/edit/diff-match-patch.js',
      'target/client/app/utils/page-path.js',
      // Include the module first; it's needed by modal-dialog.js.
      'target/client/admin-old/scripts/module-and-services.js',
      'target/client/admin-old/scripts/*.js'];



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


function compileServerSideTypescript() {
  var typescriptStream = gulp.src([
        'client/server/**/*.ts',
        'client/typedefs/**/*.ts'])
    .pipe(typeScript({
      target: 'ES5',
      allowBool: true,
      tmpDir: 'target/client/',
      out: 'renderer.js'
    }));

  if (watchAndLiveForever) {
    typescriptStream.on('error', function() {
      console.log('\n!!! Error compiling server side TypeScript !!!\n');
    });
  }

  var javascriptStream = gulp.src([
        'bower_components/react/react-with-addons.js',
        'bower_components/react-bootstrap/react-bootstrap.js',
        'bower_components/react-router/dist/react-router.js',
        'bower_components/remarkable/dist/remarkable.js',
        'bower_components/lodash/dist/lodash.js',
        'client/third-party/html-css-sanitizer-bundle.js',
        'client/app/editor/mentions-remarkable-plugin.js',
        'bower_components/moment/moment.js']);

  return es.merge(typescriptStream, javascriptStream)
      .pipe(concat('renderer.js'))
      .pipe(gulp.dest('public/res/'))
      .pipe(uglify())
      .pipe(rename('renderer.min.js'))
      .pipe(gulp.dest('public/res/'));
}


function compileClientSideTypescript() {
  var stream = gulp.src([
        'client/app/**/*.ts',
        'client/admin-app/**/*.ts',
        'client/typedefs/**/*.ts'])
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
}


gulp.task('compile-typescript', function () {
  return es.merge(
      compileServerSideTypescript(),
      compileClientSideTypescript());
});


gulp.task('compile-templates', function () {
  var adminAppTemplateStream = gulp.src('client/admin-app/**/*.html')
      .pipe(templateCache({
        module: 'DebikiAdminApp',
        filename: 'admin-app-angular-templates.js'
      }))
      .pipe(gulp.dest('target/client/'));

  return es.merge(
      adminAppTemplateStream);
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
      makeConcatStream('login-popup.js', loginDialogFiles),
      makeConcatStream('embedded-comments.js', debikiEmbeddedCommentsFiles),
      makeConcatStream('admin-old.js', adminOldFiles),

      makeConcatStream('debiki-spa-new-website-choose-owner.js', [
          'target/client/new-site/scripts/new-website-choose-owner.js']),

      makeConcatStream('debiki-spa-new-website-choose-name.js', [
          'target/client/new-site/scripts/new-website-choose-name.js']));
};



gulp.task('wrap-javascript-concat-scripts', ['wrap-javascript'], function () {
  return makeConcatAllScriptsStream();
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
  return makeConcatAllScriptsStream();
});

function makeConcatAllScriptsStream() {
  // I've removed some other scripts (CodeMirror) so now suddenly there's nothing to merge.
  return es.merge(
      makeConcatDebikiScriptsStream());
};



gulp.task('minify-scripts', ['concat-debiki-scripts'], function() {
  return gulp.src(['public/res/*.js', '!public/res/*.min.js'])
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

  function makeStyleStream(destDir, destFile, sourceFiles) {
    var stream = gulp.src(sourceFiles)
      .pipe(stylus(stylusOpts));

    if (watchAndLiveForever) {
      // This has no effect, why not?
      stream.on('error', function() {
        console.log('\n!!! Error compiling Stylus !!!\n');
      });
    }

    return stream
      .pipe(concat(destFile))
      .pipe(gulp.dest(destDir))
      .pipe(minifyCSS(minifyOpts))
      .pipe(header(copyrightAndLicenseBanner))
      .pipe(rename({ extname: '.min.css' }))
      .pipe(gulp.dest(destDir));
  }

  return es.merge(
    makeStyleStream('public/res/', 'combined-debiki.css', [
        'bower_components/jquery.atwho/dist/css/jquery.atwho.css',
        'public/res/jquery-ui/jquery-ui-1.9.2.custom.css',
        'client/app/debiki.styl',
        'client/app/posts/layout.styl',
        'client/app/sidebar/minimap.styl',
        'client/app/renderer/arrows.styl',
        'client/app/tips.styl',
        'client/app/dashbar/dashbar.styl',
        'client/app/debiki-play.styl',
        'client/app/actions/action-links.styl',
        'client/app/forms-and-dialogs.styl',
        'client/app/login/login.styl',
        'client/app/third-party.styl',
        'client/app/**/*.styl',
        'client/app/**/theme.css']),

    makeStyleStream('public/res/', 'debiki-embedded-comments.css', [
        'client/app/tips.styl']),

    makeStyleStream('public/res/', 'admin-app.css', [
        'client/app/dashbar/dashbar.styl',
        'client/admin-app/**/*.styl']),

    makeStyleStream('client/admin-dart/admin-dart/web/', 'styles.css', [
        'client/admin-dart/styles/*.styl']),

    makeStyleStream('public/res/', 'admin-old.css', [
        'client/admin-old/styles/admin-theme.styl',
        'client/admin-old/styles/admin-page.styl',
        'client/admin-old/styles/debiki-shared.styl']));
});



gulp.task('watch', ['default'], function() {

  watchAndLiveForever = true;

  function logChangeFn(fileType) {
    return function(event) {
      console.log(fileType + ' file '+ event.path +' was '+ event.type +', running tasks...');
    };
  };

  gulp.watch('client/**/*.html', ['compile-templates-concat-scripts']).on('change', logChangeFn('HTML'));
  gulp.watch('client/**/*.ts', ['compile-typescript-concat-scripts']).on('change', logChangeFn('TypeScript'));
  gulp.watch('client/**/*.ls', ['compile-livescript-concat-scripts']).on('change', logChangeFn('LiveScript'));
  gulp.watch('client/**/*.js', ['wrap-javascript-concat-scripts']).on('change', logChangeFn('Javascript'));
  gulp.watch('client/**/*.styl', ['compile-stylus']).on('change', logChangeFn('Stylus'));
  gulp.watch(['app/views/themes/**/*.css', 'app/views/themesbuiltin/default20121009/styles.css/**/*.css']).on('change', logChangeFn('CSS'));
});


gulp.task('default', ['compile-concat-scripts', 'compile-stylus'], function () {
});


gulp.task('release', ['minify-scripts', 'compile-stylus'], function() {
});



// vim: et ts=2 sw=2 tw=0 list
