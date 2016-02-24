/**
 * Build file for client scripts and styles.
 * Copyright (c) 2014-2016 Kaj Magnus Lindberg
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
var typeScript = require('gulp-typescript');
var stylus = require('gulp-stylus');
var minifyCSS = require('gulp-minify-css');
var concat = require('gulp-concat');
var del = require('del');
var rename = require("gulp-rename");
var header = require('gulp-header');
var wrap = require('gulp-wrap');
var uglify = require('gulp-uglify');
var gzip = require('gulp-gzip');
var es = require('event-stream');
var fs = require("fs");
var path = require("path");
var nightwatch = require('gulp-nightwatch');
var exec = require('child_process').exec;

var watchAndLiveForever = false;
var currentDirectorySlash = __dirname + '/';


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


// What about using a CDN for jQuery + Modernizr + React? Perhaps, but:
// - jQuery + Modernizr + React is only 33K + 5K + 49K in addition to 160K
//   for everything else, so it's just 90K ~= 50% extra stuff, doesn't matter much?
//   (combined-debiki.min.js.gz is 254K now instead of 157K.
//   combined-debiki.min.css.gz is < 30K (incl Bootstrap) that seems small enough.)
// - I think I've noticed before that cdnjs.com was offline for a short while.
// - If people don't have our version of everything cached already, there
//   might be DNS lookups and SSL handshakes, which delays the page load with
//   perhaps some 100ms? See:
//      https://thethemefoundry.com/blog/why-we-dont-use-a-cdn-spdy-ssl/
// - Testing that fallbacks to locally served files work is boring.
// - Plus I read in comments in some blog that some countries actually sometimes
//   block Google's CDN.
var debikiJavascriptFiles = [
      // Place React first so we can replace it at index 0 & 1 with the optimized min.js versions.
      'bower_components/react/react-with-addons.js',
      'bower_components/react/react-dom.js',
      // About Modernizr:
      // Concerning when/how to use a CDN for Modernizr, see:
      // http://www.modernizr.com/news/modernizr-and-cdns
      // And: "For best performance, you should have them follow after your
      // stylesheet references", http://modernizr.com/docs/#installing
      // But placing Modernizr in the <head> is important mostly for IE8, which we don't support.
      // There might be a flash-of-unstyled-content now with Modnernizr here at the end
      // of <body>? But I haven't noticed any FOUC so ignore for now.
      // Evaluating all Modernizr tests takes long (~70ms on my core i7) so use a custom
      // build with only what's needed.
      'client/third-party/modernizr-custom.min.js',
      'bower_components/yepnope/yepnope.1.5.4-min.js',
      'bower_components/jquery/dist/jquery.js',
      'client/third-party/abbreviate-jquery.js',
      'client/third-party/stupid-lightbox.js',
      'bower_components/keymaster/keymaster.js',
      // keymaster.js declares window.key, rename it to window.keymaster instead,
      // see comment in file for details.
      'client/third-party/rename-key-to-keymaster.js',
      'bower_components/lodash/dist/lodash.js',
      'bower_components/moment/min/moment.min.js',
      'bower_components/eventemitter2/lib/eventemitter2.js',
      'bower_components/react-bootstrap/react-bootstrap.js',
      'bower_components/react-router/index.js',
      'node_modules/jquery-resizable/resizable.js',
      'client/third-party/gifffer/gifffer.js',
      'client/third-party/jquery-cookie.js',
      'client/third-party/jquery-scrollable.js', //
      'client/third-party/jquery.browser.js', //
      'client/third-party/popuplib.js',
      'target/client/app/actions/edit/edit.js',
      'target/client/app/actions/vote.js',
      'target/client/app/actions/reply.js',
      'target/client/app/iframe.js',
      'target/client/app/utils/jquery-find.js',
      'target/client/app/page/layout-threads.js',
      'target/client/app/page/resize-threads.js',
      'target/client/app/login/login.js',
      'target/client/app/login/login-popup.js',
      'target/client/app/editor/mentions-markdown-it-plugin.js',
      'target/client/app/editor/onebox-markdown-it-plugin.js',
      //'target/client/app/posts/monitor-reading-progress-unused.js',
      'target/client/app/posts/resize.js',
      'target/client/app/utils/show-and-highlight.js',
      //'target/client/app/posts/unread-unused.js',
      'target/client/app/utils/util.js',
      'target/client/app/utils/util-browser.js',
      'target/client/app/utils/util-play.js',
      'target/client/app/utterscroll/utterscroll-init-tips.js',//
      'client/app/utterscroll/utterscroll.js',//
      'target/client/app/utils/post-json.js',
      'target/client/all-typescript.js',
      'target/client/app/startup.js'];


var editorEtceteraScripts = [
      'bower_components/markdown-it/dist/markdown-it.js',
      'bower_components/Caret.js/dist/jquery.caret.js',
      'bower_components/jquery.atwho/dist/js/jquery.atwho.js',
      'bower_components/classnames/index.js', // needed by react-select
      'bower_components/react-input-autosize/dist/react-input-autosize.min.js', // needed by react-select
      'bower_components/react-select/dist/react-select.min.js',
      'bower_components/fileapi/dist/FileAPI.js',
      'client/third-party/diff_match_patch.js',
      'client/third-party/html-css-sanitizer-bundle.js',
      'client/third-party/non-angular-slugify.js'];


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


var nextFileTemplate =
    '\n\n' +
    '//=====================================================================================\n\n' +
    '// Next file: <%= file.path %>\n' +
    '//=====================================================================================\n\n' +
    '<%= contents %>\n';


gulp.task('wrap-javascript', function () {
  // Prevent Javascript variables from polluting the global scope.
  return gulp.src('client/**/*.js')
    .pipe(wrap('(function() {\n<%= contents %>\n}).call(this);'))
    .pipe(gulp.dest('./target/client/'));
});


var serverSideTypescriptProject = typeScript.createProject({
    target: 'ES5',
    allowBool: true,
    noExternalResolve: true,
    out: 'renderer.js'
});


function compileServerSideTypescript() {
  var typescriptStream = gulp.src([
        'client/server/**/*.ts',
        'client/shared/plain-old-javascript.d.ts',
        'client/typedefs/**/*.ts'])
    .pipe(wrap(nextFileTemplate))
    .pipe(typeScript(serverSideTypescriptProject));

  if (watchAndLiveForever) {
    typescriptStream.on('error', function() {
      console.log('\n!!! Error compiling server side TypeScript !!!\n');
    });
  }

  var javascriptStream = gulp.src([
        // Don't need any React addons server side (e.g. CSS transitions or performance measurements).
        'bower_components/react/react.min.js',
        'bower_components/react/react-dom-server.min.js',
        'bower_components/react-bootstrap/react-bootstrap.js',
        'bower_components/react-router/index.js',
        'bower_components/markdown-it/dist/markdown-it.js',
        'bower_components/lodash/dist/lodash.js',
        'client/third-party/html-css-sanitizer-bundle.js',
        'client/third-party/non-angular-slugify.js',
        'client/app/editor/mentions-markdown-it-plugin.js',
        'client/app/editor/onebox-markdown-it-plugin.js'])
      .pipe(wrap(nextFileTemplate));

  return es.merge(typescriptStream, javascriptStream)
      .pipe(concat('renderer.js'))
      .pipe(gulp.dest('public/res/'))
      .pipe(uglify())
      .pipe(rename('renderer.min.js'))
      .pipe(gulp.dest('public/res/'));
}


var clientSideTypescriptProject = typeScript.createProject({
    target: 'ES5',
    allowBool: true,
    noExternalResolve: true,
    out: 'all-typescript.js'
});


function compileClientSideTypescript() {
  var stream = gulp.src([
        'client/app/**/*.ts',
        'client/shared/plain-old-javascript.d.ts',
        'client/typedefs/**/*.ts'])
    .pipe(wrap(nextFileTemplate))
    .pipe(typeScript(clientSideTypescriptProject));

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



gulp.task('concat-debiki-scripts', ['wrap-javascript', 'compile-typescript'], function() {
  return makeConcatDebikiScriptsStream();
});



function makeConcatDebikiScriptsStream() {
  function makeConcatStream(outputFileName, filesToConcat, checkIfNewer) {
    var stream = gulp.src(filesToConcat);
    if (checkIfNewer) {
      stream = stream.pipe(newer('public/res/' + outputFileName));
    }
    return stream
        .pipe(wrap(nextFileTemplate))
        .pipe(concat(outputFileName))
        .pipe(header(thisIsAConcatenationMessage))
        .pipe(header(copyrightAndLicenseBanner))
        .pipe(gulp.dest('public/res/'));
  }

  return es.merge(
      makeConcatStream('combined-debiki.js', debikiJavascriptFiles, 'DoCheckNewer'),
      makeConcatStream('editor-etcetera.js', editorEtceteraScripts),
      makeConcatStream('embedded-comments.js', debikiEmbeddedCommentsFiles),
      gulp.src('bower_components/zxcvbn/zxcvbn.js').pipe(gulp.dest('public/res/')));
};



gulp.task('wrap-javascript-concat-scripts', ['wrap-javascript'], function () {
  return makeConcatAllScriptsStream();
});

gulp.task('compile-typescript-concat-scripts', ['compile-typescript'], function () {
  return makeConcatDebikiScriptsStream();
});

gulp.task('compile-concat-scripts',
    ['wrap-javascript', 'compile-typescript'],
    function () {
  return makeConcatAllScriptsStream();
});

function makeConcatAllScriptsStream() {
  // I've removed some other scripts (CodeMirror) so now suddenly there's nothing to merge.
  return es.merge(
      makeConcatDebikiScriptsStream());
};



gulp.task('insert-prod-scripts', function() {
  // This script isn't just a minified script — it contains lots of optimizations.
  debikiJavascriptFiles[0] = 'bower_components/react/react-with-addons.min.js';
  debikiJavascriptFiles[1] = 'bower_components/react/react-dom.min.js';
});


gulp.task('minify-scripts', ['concat-debiki-scripts'], function() {
  return gulp.src(['public/res/*.js', '!public/res/*.min.js'])
      .pipe(uglify())
      .pipe(rename({ extname: '.min.js' }))
      .pipe(header(copyrightAndLicenseBanner))
      .pipe(gulp.dest('public/res/'))
      .pipe(gzip())
      .pipe(gulp.dest('public/res/'));
});



gulp.task('compile-stylus', function () {
  var stylusOpts = {
    linenos: true,
    import: [
      currentDirectorySlash + 'client/app/mixins.styl',
      currentDirectorySlash + 'client/app/variables.styl'],
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
      .pipe(gulp.dest(destDir))
      .pipe(gzip())
      .pipe(gulp.dest(destDir));
  }

  return es.merge(
    makeStyleStream('public/res/', 'combined-debiki.css', [
        'bower_components/bootstrap/dist/css/bootstrap.css',
        'bower_components/jquery.atwho/dist/css/jquery.atwho.css',
        'bower_components/react-select/dist/default.css',
        'node_modules/jquery-resizable/resizable.css',
        'client/third-party/stupid-lightbox.css',
        'client/app/theme.styl',
        'client/app/third-party.styl',
        'client/app/page/page.styl',
        'client/app/page/threads.styl',
        'client/app/page/posts.styl',
        'client/app/page/arrows.styl',
        'client/app/page/action-links.styl',
        'client/app/**/*.styl']),

    makeStyleStream('public/res/', 'debiki-embedded-comments.css', [
        'client/app/tips.styl']));
});


function logChangeFn(fileType) {
  return function(event) {
    console.log(fileType + ' file '+ event.path +' was '+ event.type +', running tasks...');
  };
}


gulp.task('watch', ['default'], function() {
  watchAndLiveForever = true;
  gulp.watch(['client/**/*.ts', '!client/test/**/*.ts'] ,['compile-typescript-concat-scripts']).on('change', logChangeFn('TypeScript'));
  gulp.watch('client/**/*.js', ['wrap-javascript-concat-scripts']).on('change', logChangeFn('Javascript'));
  gulp.watch('client/**/*.styl', ['compile-stylus']).on('change', logChangeFn('Stylus'));
  gulp.watch('client/test/e2e/**/*.ts', ['prepare-e2e']).on('change', logChangeFn('TypeScript test files'));
});

gulp.task('default', ['compile-concat-scripts', 'compile-stylus'], function () {
});


gulp.task('release', ['insert-prod-scripts', 'minify-scripts', 'compile-stylus'], function() {
});


// ---- Tests -------------------------------------------------------------

gulp.task('clean-e2e', function () {
  return del([
    'target/e2e/**/*']);
});

gulp.task('compile-e2e-scripts', function() {
  var stream = gulp.src([
        'client/app/constants.ts',
        'client/app/model.ts',
        'client/test/e2e/**/*ts'])
      .pipe(typeScript({
        declarationFiles: true,
        module: 'commonjs',
        //typescript: lib,  ? what
      }));
  // stream.dts.pipe(gulp.dest('target/e2e/...')); — no, don't need d.ts files
  if (watchAndLiveForever) {
    stream.on('error', function() {
      console.log('\n!!! Error compiling End-to-End tests TypeScript !!!\n');
    });
  }
  return stream.js
      // .pipe(sourcemaps.write('.', { sourceRoot: '../../../../externalResolve/' }))
      .pipe(gulp.dest('target/e2e'));
});


// Compiles TypeScript code in test/e2e/ and places it in target/e2e/transpiled/,
//
gulp.task('prepare-e2e', ['clean-e2e', 'compile-e2e-scripts'], function() {
});


// vim: et ts=2 sw=2 tw=0 list
