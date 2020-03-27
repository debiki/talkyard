/**
 * Build file for client scripts and styles.
 * Copyright (c) 2014-2019 Kaj Magnus Lindberg
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

const gulp = require('gulp');
const gDebug = require('gulp-debug');
const plumber = require('gulp-plumber');
const newer = require('gulp-newer');
const typeScript = require('gulp-typescript');
const stylus = require('gulp-stylus');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const insert = require('gulp-insert');
const replace = require('gulp-replace');
const del = require('del');
const rename = require("gulp-rename");
const gzip = require('gulp-gzip');
const merge2 = require('merge2');
const fs = require("fs");
// COULD remove, uses old gulp-util, deprecated and pulls in old cruft.
const save = require('gulp-save');
const execSync = require('child_process').execSync;
const preprocess = require('gulp-preprocess');

const uglify = require('gulp-uglify');
// Later, to use a more recent uglifyjs version:
//const composer = require('gulp-uglify/composer');
//const uglify = composer(require('uglify-js'), console);

const currentDirectorySlash = __dirname + '/';
const versionFilePath = 'version.txt';

// Gzip otions: Use max level = 9 for 0.5% better compression.
//
// Details:
// memLevel 8 is the default, and level 8 too?
// But 9 is max and results in better compression,
// see https://zlib.net/manual.html#Advanced
//
// With the defaults, supposedly 8:
//    # du -ks /opt/talkyard/assets/
//    5656	/opt/talkyard/assets/
// This:
//    { memLevel: 9 } —> du -ks /opt/talkyard/assets/ = 5656,  i.e. no difference.
// This:
//    { level: 9, memLevel: 9 }
//    —>  du -ks /opt/talkyard/assets/  =  5628   that's  0.5% smaller, nice (!).
// and   slim-bundle.min.js.gz is 157.6K  instead of  158.2K.
//
// (Adding windowBits: 15 has no effect — it's the default, supposedly,
// see: https://nodejs.org/api/zlib.html#zlib_for_zlib_based_streams )
//
// We'll keep uncompressed files too [UNCOMPRAST] — because sometimes Talkyard gets
// installed on an intranet behind a reverse proxy that requires non-gzipped
// files. (All browsers are fine with getting gzip though.)
// If you want to test with cURL, you need to set the Accept-Encoding
// header to something, whatever, but not gzip, e.g.:
// curl -v -v -H 'Accept-Encoding: NOTgzip'  \
//     https://talkyard-server/-/assets/v0.6.51-WIP-1/slim-bundle.min.js
// — that won't work; you'll get 404 Not Found, unless the non-gzipped file is present.
//
const gzipOptions = { level: 9, memLevel: 9 };

function readGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  }
  catch (ex) {
    return 'bad_git_repo';
  }
}


let version;
let versionTag;

let preprocessProdContext;

// Here we'll place the generated js, min.js and min.js.gz files. [GZPATHS]
const webDest = 'images/web/assets';
let webDestVersioned;
let webDestTranslations;
const serverDest = 'images/app/assets';
let serverDestTranslations;


function updateVersionVars() {
  version = fs.readFileSync(versionFilePath, { encoding: 'utf8' }).trim();
  versionTag = version + '-' + readGitHash();  // also in Bash and Scala [8GKB4W2]

  preprocessProdContext = { TALKYARD_VERSION: versionTag };

  webDestVersioned = `${webDest}/${version}`;
  webDestTranslations = `${webDestVersioned}/translations`;
  serverDestTranslations = `${serverDest}/translations`;
}

updateVersionVars();


/*
const chalk = require('chalk');
function logError(message) {
  // Doesn't work:
  // const errorColor = chalk.bold.rgb(255, 255, 100).bgRgb(100, 0, 0);
  // Changes the color to white and gray instead. Apparently the terminal "rounds" the colors
  // to something different :- (
  // Try this instead:  (so errors easy to notice! They can otherwise waste lots of time)
  // — this makes the error text look underlined, easier to notice.
  var starredMessage = '*** ' + message + ' ***';
  var spaces = ' '.repeat(starredMessage.length);
  console.log('');
  console.log(chalk.red(starredMessage));
  console.log(chalk.bgRed(spaces));
  console.log('');
}

// This would be nice, but has no effect, since Gulp runs in a Doker container.
// see: https://scotch.io/tutorials/prevent-errors-from-crashing-gulp-watch
// "beeper": "^1.1.1",
// "gulp-notify": "^3.2.0",
// const beeper = require('beeper');
// const notify = require('gulp-notify');
const plumberOpts = {
  errorHandler: function(err) {
    notify.onError({
      title: "Gulp error in " + err.plugin,
      message:  err.toString()
    })(err);
    // Beep (play sound)
    beeper();
  }
} */



function makeCopyrightAndLicenseBanner() {
  return (
  '/*!\n' +
  ' * Talkyard ' + versionTag + '\n' +
  ' *\n' +
  ' * This file is copyrighted and licensed under the AGPL license.\n' +
  ' * Some parts of it might be licensed under more permissive\n' +
  ' * licenses, e.g. MIT or Apache 2. Find the source code and\n' +
  ' * exact details here:\n' +
  ' *   https://github.com/debiki/debiki-server\n' +
  ' */\n');
}

function makeTranslationsCopyrightAndLicenseBanner() {
  return '/*! Talkyard ' + versionTag + ', license: AGPL. */\n';
}


var thisIsAConcatenationMessage =
  '/*!\n' +
  ' * This file is a concatenation of many different files.\n' +
  ' * Each such file has its own copyright notices. Some parts\n' +
  ' * are released under other more permissive licenses\n' +
  ' * than the AGPL. Files are separated by "======" lines.\n' +
  ' */\n';


var swJsFiles = [
  'target/client/ty-sw-typescript.js'];


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
var slimJsFiles = [
      // Place React first so we can replace it at index 0,1,2,3 with the optimized min.js versions.
      'node_modules/react/umd/react.development.js',
      'node_modules/react-dom/umd/react-dom.development.js',
      'node_modules/prop-types/prop-types.js',
      'node_modules/create-react-class/create-react-class.js',
      // COULD_OPTIMIZE SMALLER_BUNDLE or perhaps even remove? add pure CSS anims instead?
      'node_modules/react-transition-group/dist/react-transition-group.js',  // try to move to more-bundle
      'node_modules/react-dom-factories/index.js',
      'target/client/app-slim/utils/calcScrollRectIntoViewCoords.js',
      'client/third-party/smoothscroll-tiny.js',
      'client/third-party/bliss.shy.js',
      'client/app-slim/util/stupid-lightbox.js',
      'node_modules/keymaster/keymaster.js',
      // keymaster.js declares window.key, rename it to window.keymaster instead,
      // see comment in file for details.
      'client/third-party/rename-key-to-keymaster.js',
      'client/third-party/lodash-custom.js',
      'node_modules/eventemitter3/umd/eventemitter3.min.js',
      'node_modules/react-router-dom/umd/react-router-dom.js',
      'client/third-party/tiny-querystring.umd.js',
      'client/third-party/gifffer/gifffer.js',
      'client/third-party/get-set-cookie.js',
      //'target/client/app-slim/posts/monitor-reading-progress-unused.js',
      //'target/client/app-slim/posts/unread-unused.js',
      'target/client/app-slim/utils/util.js',
      'target/client/app-slim/utils/util-browser.js',
      'client/third-party/popuplib.js',
      'target/client/app-slim/login/login-popup.js',
      'target/client/slim-typescript.js',
      'target/client/app-slim/start-stuff.js'];

var moreJsFiles = [
      'node_modules/react-bootstrap/dist/react-bootstrap.js',
      'node_modules/classnames/index.js',                               // needed by react-select
      'node_modules/react-input-autosize/dist/react-input-autosize.js', // needed by react-select
      'node_modules/react-select/dist/react-select.js',                 // <– react-select
      'node_modules/moment/min/moment.min.js',
      'target/client/more-typescript.js'];

/*
var _2dJsFiles = [   // temporarily broken,  [SLIMTYPE]  [2D_LAYOUT]
  'client/third-party/jquery-scrollable.js',
  'client/third-party/jquery.browser.js',
  'target/client/app-2d/page/layout-threads.2d.js',
  'target/client/app-2d/page/resize-threads.2d.js',
  'target/client/app-2d/utterscroll/utterscroll-init-tips.js',
  'client/app-2d/utterscroll/utterscroll.js',
  'target/client/2d-typescript.js']; */

var staffJsFiles = [
      'target/client/staff-typescript.js'];

var editorJsFiles = [
      // We use two different sanitizers, in case there's a security bug in one of them. [5FKEW2]
      // Find the code that "combines" them here: googleCajaSanitizeHtml [6FKP40]
      'modules/sanitize-html/dist/sanitize-html.js',     // 1
      'client/third-party/html-css-sanitizer-bundle.js', // 2
      'node_modules/markdown-it/dist/markdown-it.js',
      'node_modules/blacklist/dist/blacklist.js',  // needed by what?
      'node_modules/fileapi/dist/FileAPI.html5.js', // don't use the Flash version (w/o '.html5')
      'node_modules/@webscopeio/react-textarea-autocomplete/umd/rta.min.js',
      'client/third-party/diff_match_patch.js',
      'client/third-party/non-angular-slugify.js',
      'target/client/app-editor/editor/mentions-markdown-it-plugin.js',
      'target/client/app-editor/editor/onebox-markdown-it-plugin.js',
      'target/client/editor-typescript.js'];

/* For 2d layout horizontal scrolling, now disabled. [2D_LAYOUT]
var jqueryJsFiles = [
  'node_modules/jquery/dist/jquery.js',
  'client/third-party/abbreviate-jquery.js',
  'node_modules/jquery-resizable/resizable.js']; */


// For both touch devices and desktops.
// (parten-header.js and parent-footer.js wraps and lazy loads the files inbetween,
// see client/embedded-comments/readme.txt.)
var embeddedJsFiles = [
      // Don't use target/client/... for the parent-header.js and -footer.js, because if processed
      // individually, they contain unbalanced {} braces.
      'client/embedded-comments/parent-header.js',  // not ^target/client/...
      'client/third-party/bliss.shy.js',
      'client/third-party/smoothscroll-tiny.js',
      //'client/third-party/jquery-scrollable.js',
      //'client/third-party/jquery.browser.js',
      //'target/client/embedded-comments/debiki-utterscroll-iframe-parent.js',
      //'target/client/app-2d/utterscroll/utterscroll-init-tips.js',
      'target/client/app-slim/utils/calcScrollRectIntoViewCoords.js',
      'target/client/blog-comments-typescript.js',
      'client/embedded-comments/parent-footer.js'];  // not ^target/client/...


// Separating different source files with ==== and including the file name at the top,
// simplifies reading the generated bundles, and debugging.
// Don't insert any newline before the contents — that'd result in incorrect line numbers reported,
// in compilation error messages.
//
// Remove 'use strict', or uglifyjs refuses to minify the combined slim-bundle.js,
// because functions end up declared in a non-strict order (all fns not first).
//
const nextFileTemplate = function(contents, file) {
  // Matching ^['"]use strict["']  (with  /s so ^ matches newlines) still leaves
  // some 'use strict' that breaks minification. So remove them all.
  contents = contents.replace(/['"]use strict["']/g, '');
  return (
    // Don't use file.relative (https://github.com/gulpjs/vinyl#filerelative),
    // it doesn't inc 'client/app-*/'.
    `/* Next file: ${file.path.replace(file.cwd + '/', '')}  */ ${contents}\n` +
                                                                      // no newline before contents
    '\n' +
    '//=====================================================================================\n' +
    '//=====================================================================================\n' +
    '//=====================================================================================\n' +
    '\n\n');
}



// ========================================================================
//  End-to-end Tests
// ========================================================================


gulp.task('clean-e2e', () => {
  return del(['target/e2e/**/*']);
});

gulp.task('compile-e2e-scripts', () => {
  var stream = gulp.src([
        'client/app-slim/constants.ts',
        'client/app-slim/model.ts',
        'tests/e2e/**/*ts'])
      .pipe(plumber())
      .pipe(typeScript({
        declarationFiles: true,
        module: 'commonjs',
        lib: ['es5', 'es2015', 'dom'],
        types: ['lodash', 'core-js', 'assert', 'node']
      }));
  // stream.dts.pipe(gulp.dest('target/e2e/...')); — no, don't need d.ts files

  return stream.js
      // .pipe(sourcemaps.write('.', { sourceRoot: '../../../../externalResolve/' }))
      .pipe(gulp.dest('target/e2e'));
});

// Compiles TypeScript code in test/e2e/ and places it in target/e2e/transpiled/,
//
gulp.task('build-e2e', gulp.series('clean-e2e', 'compile-e2e-scripts'));



// ========================================================================
//  Translations
// ========================================================================


gulp.task('cleanTranslations', () => {
  return del([
      `${serverDestTranslations}/**/*`,
      `${webDestTranslations}/**/*`]);
});

// Transpiles translations/(language-code)/i18n.ts to one-js-file-per-source-file
// in public/res/translations/... .
gulp.task('compileTranslations', () => {
  const stream = gulp.src(['translations/**/*.ts'])
      .pipe(plumber())
      .pipe(typeScript({
        declarationFiles: true,
        lib: ['es5', 'es2015', 'dom'],
        types: ['core-js']
      }));
  return stream.js
      .pipe(gulp.dest(webDestTranslations))
      .pipe(gulp.dest(serverDestTranslations))
      .pipe(gzip({ gzipOptions }))
      .pipe(gulp.dest(webDestTranslations));
});

gulp.task('buildTranslations', gulp.series('cleanTranslations', 'compileTranslations'));



// ========================================================================
//  Runtime bundles
// ========================================================================


gulp.task('wrapJavascript', () => {
  // Prevent Javascript variables from polluting the global scope.
  return gulp.src('client/**/*.js')
    .pipe(plumber())
    // Avoid any line breaks before 'contents', so any error will be reported
    // with the correct line number.
    .pipe(insert.wrap('(function() { ', '\n}).call(this);'))
    .pipe(gulp.dest('./target/client/'));
});


var serverTypescriptProject = typeScript.createProject("client/server/tsconfig.json");


var serverJavascriptSrc = [
    // Two different sanitizers. [5FKEW2]
    // Needs to be first. There's some missing ';' at the start of the script bug?
    'modules/sanitize-html/dist/sanitize-html.min.js',
    'client/third-party/html-css-sanitizer-bundle.js',
    'node_modules/react/umd/react.production.min.js',
    'node_modules/react-dom/umd/react-dom-server.browser.production.min.js',
    'node_modules/react-dom-factories/index.js',
    'node_modules/create-react-class/create-react-class.min.js',
    // Don't need React CSS transitions server side.
    'node_modules/react-router-dom/umd/react-router-dom.js',
    'client/third-party/tiny-querystring.umd.js',
    'node_modules/markdown-it/dist/markdown-it.min.js',
    'client/third-party/lodash-custom.js',
    'client/third-party/non-angular-slugify.js',
    'client/app-editor/editor/mentions-markdown-it-plugin.js',
    'client/app-editor/editor/onebox-markdown-it-plugin.js'];

// This one also concatenates Javascript, so it's different from the other
// 'compile(Sth)Typescript' functions — so let's append 'ConcatJavascript' to the name.
function compileServerTypescriptConcatJavascript() {
  var typescriptStream = serverTypescriptProject.src()
      .pipe(plumber())
      .pipe(insert.transform(nextFileTemplate))
      .pipe(serverTypescriptProject());

  var javascriptStream = gulp.src(serverJavascriptSrc)
      .pipe(plumber())
      .pipe(insert.transform(nextFileTemplate));

  return merge2(javascriptStream, typescriptStream)
      .pipe(concat('server-bundle.js'))
      .pipe(gulp.dest(serverDest));
}

var swTypescriptProject = typeScript.createProject("client/serviceworker/tsconfig.json");
var slimTypescriptProject = typeScript.createProject("client/app-slim/tsconfig.json");
var moreTypescriptProject = typeScript.createProject("client/app-more/tsconfig.json");
var staffTypescriptProject = typeScript.createProject("client/app-staff/tsconfig.json");
var editorTypescriptProject = typeScript.createProject("client/app-editor/tsconfig.json");
var blogCommentsTypescriptProject = typeScript.createProject("client/embedded-comments/tsconfig.json");
/*
var _2dTypescriptProject = typeScript.createProject({  // [SLIMTYPE]
  target: 'ES5',
  outFile: '2d-typescript.js',
  lib: ['es5', 'es2015', 'dom'],
  types: ['react', 'react-dom', 'lodash', 'core-js']
}); */


function compileSwTypescript() {
  return swTypescriptProject.src()
    .pipe(plumber())
    .pipe(insert.transform(nextFileTemplate))
    .pipe(swTypescriptProject())
    .pipe(gulp.dest('target/client/'));
}

function compileSlimTypescript() {
  return slimTypescriptProject.src()
    .pipe(plumber())
    .pipe(insert.transform(nextFileTemplate))
    .pipe(slimTypescriptProject())
    .pipe(gulp.dest('target/client/'));
}

function compileOtherTypescript(typescriptProject) {
  return typescriptProject.src()
    .pipe(plumber())
    .pipe(insert.transform(nextFileTemplate))
    .pipe(typescriptProject())
    .pipe(gulp.dest('target/client/'));
}

gulp.task('compileServerTypescriptConcatJavascript', () => {
  return compileServerTypescriptConcatJavascript();
});

gulp.task('compileSwTypescript', () => {
  return compileSwTypescript();
});

gulp.task('compileSlimTypescript', () => {
  return compileSlimTypescript();
});

gulp.task('compileMoreTypescript', () => {
  return compileOtherTypescript(moreTypescriptProject);
});

/*
gulp.task('compile2dTypescript', () => { // [SLIMTYPE]
  return compileOtherTypescript(_2dTypescriptProject);
}); */

gulp.task('compileStaffTypescript', () => {
  return compileOtherTypescript(staffTypescriptProject);
});

gulp.task('compileEditorTypescript', () => {
  return compileOtherTypescript(editorTypescriptProject);
});

gulp.task('compileBlogCommentsTypescript', () => {
  return compileOtherTypescript(blogCommentsTypescriptProject);
});

gulp.task('compileAllTypescript', () => {
  return merge2(  // can speed up with gulp.parallel?  (GLPPPRL)
      compileServerTypescriptConcatJavascript(),
      compileSwTypescript(),
      compileSlimTypescript(),
      compileOtherTypescript(moreTypescriptProject),
      //compileOtherTypescript(_2dTypescriptProject), // [SLIMTYPE]
      compileOtherTypescript(staffTypescriptProject),
      compileOtherTypescript(editorTypescriptProject),
      compileOtherTypescript(blogCommentsTypescriptProject));
});


var compileTsTaskNames = [
  'compileServerTypescriptConcatJavascript',
  'compileSwTypescript',
  'compileSlimTypescript',
  'compileMoreTypescript',
  //'compile2dTypescript', [SLIMTYPE]
  'compileStaffTypescript',
  'compileEditorTypescript',
  'compileBlogCommentsTypescript'];

for (var i = 0; i < compileTsTaskNames.length; ++i) {
  var compileTaskName = compileTsTaskNames[i];
  gulp.task(compileTaskName + '-concatScripts', gulp.series(compileTaskName, () => {
    // Don't need to do this for more than the relevant bundle, but simpler to do for
    // all. Talkes almost no time.
    return makeConcatWebScriptsStream();
  }));
}



gulp.task('compileConcatAllScripts', gulp.series('wrapJavascript', 'compileAllTypescript', () => {
  return makeConcatWebScriptsStream();
}));


// Skips compilation.
gulp.task('concatAllScripts', gulp.series(() => {
  return makeConcatWebScriptsStream();
}));



function makeConcatWebScriptsStream() {
  function makeConcatStream(outputFileName, filesToConcat, checkIfNewer, versioned) {
    let stream = gulp.src(filesToConcat).pipe(plumber());
    const dest = versioned === false ? webDest : webDestVersioned;
    if (checkIfNewer) {
      stream = stream.pipe(newer(dest + '/' + outputFileName));
    }
    return stream
        .pipe(insert.transform(nextFileTemplate))
        .pipe(concat(outputFileName))
        .pipe(insert.prepend(thisIsAConcatenationMessage))
        .pipe(insert.prepend(makeCopyrightAndLicenseBanner()))
        .pipe(gulp.dest(dest))
        .pipe(gzip({ gzipOptions }))
        .pipe(gulp.dest(dest));
  }

  return merge2(
      makeConcatStream('talkyard-service-worker.js', swJsFiles, 'DoCheckNewer', false),
      makeConcatStream('slim-bundle.js', slimJsFiles, 'DoCheckNewer'),
      makeConcatStream('more-bundle.js', moreJsFiles, 'DoCheckNewer'),
      //makeConcatStream('2d-bundle.js', _2dJsFiles, 'DoCheckNewer'), [SLIMTYPE]
      makeConcatStream('staff-bundle.js', staffJsFiles, 'DoCheckNewer'),
      makeConcatStream('editor-bundle.js', editorJsFiles, 'DoCheckNewer'),
      //makeConcatStream('jquery-bundle.js', jqueryJsFiles, 'DoCheckNewer'),
      makeConcatStream('talkyard-comments.js', embeddedJsFiles, 'DoCheckNewer', false),
      gulp.src('node_modules/zxcvbn/dist/zxcvbn.js')
          .pipe(plumber())
          .pipe(gulp.dest(webDestVersioned))
          .pipe(gzip({ gzipOptions }))
          .pipe(gulp.dest(webDestVersioned)))
      .pipe(plumber());
}



gulp.task('wrap-javascript-concat-scripts', gulp.series('wrapJavascript', () => {
  return makeConcatWebScriptsStream();
}));



gulp.task('enable-prod-stuff', (done) => {
  // This script isn't just a minified script — it contains lots of optimizations.
  // So we want to use react-with-addons.min.js, rather than minifying the .js ourselves.
  slimJsFiles[0] = 'node_modules/react/umd/react.production.min.js';
  slimJsFiles[1] = 'node_modules/react-dom/umd/react-dom.production.min.js';
  slimJsFiles[2] = 'node_modules/prop-types/prop-types.min.js';
  slimJsFiles[3] = 'node_modules/create-react-class/create-react-class.min.js';
  slimJsFiles[4] = 'node_modules/react-transition-group/dist/react-transition-group.min.js';
  done();
});


gulp.task('minifyTranslations', gulp.series('buildTranslations', () => {
  return gulp.src([`${serverDestTranslations}/**/*.js`, `!${serverDestTranslations}/**/*.min.js`])
      .pipe(plumber())
      .pipe(gDebug({ title: `gulp-debug: minifying transl:` }))
      .pipe(preprocess({ context: preprocessProdContext }))
      .pipe(uglify())
      .pipe(rename({ extname: '.min.js' }))
      .pipe(insert.prepend(makeTranslationsCopyrightAndLicenseBanner()))
      // The Scala app server code wants non-gz files. Nginx wants both non-gz
      // and gz [UNCOMPRAST].
      .pipe(gulp.dest(serverDestTranslations))
      .pipe(gulp.dest(webDestTranslations))
      .pipe(gzip({ gzipOptions }))
      .pipe(gulp.dest(webDestTranslations));
}));


gulp.task('minifyScriptsImpl', gulp.series(() => {
  // preprocess() removes all @ifdef DEBUG — however (!) be sure to not place '// @endif'
  // on the very last line in a {} block, because it would get removed, by... by what? the
  // Typescript compiler? This results in an impossible-to-understand "Unbalanced delimiter
  // found in string" error with a meaningless stacktrace, in preprocess().
  function makeMinJsGzStream(sourceAndDest, gzipped) {
    let stream = gulp.src([`${sourceAndDest}/*.js`, `!${sourceAndDest}/*.min.js`])
      .pipe(plumber())
      .pipe(gDebug({
        minimal: false,
        title: `gulp-debug: minifying scripts: ${JSON.stringify(sourceAndDest)}`,
      }))
      .pipe(preprocess({ context: preprocessProdContext })) // see comment above
      .pipe(uglify())
      .pipe(rename({ extname: '.min.js' }))
      .pipe(insert.prepend(makeCopyrightAndLicenseBanner()))
      .pipe(gulp.dest(sourceAndDest));
    if (gzipped) {
      stream = stream
        .pipe(gzip({ gzipOptions }))
        .pipe(gulp.dest(sourceAndDest));
    }
    return stream;
  }
  return merge2(  // can speed up with gulp.parallel? (GLPPPRL)
      // The Scala app server wants a min.js (no gzip compression), for Nashorn.
      makeMinJsGzStream(serverDest, false),
      // Nginx wants both min.js and min.js.gz [UNCOMPRAST].
      makeMinJsGzStream(webDest, true),
      makeMinJsGzStream(webDestVersioned, true));
}));


gulp.task('minifyScripts', gulp.series(
    'compileConcatAllScripts', 'minifyTranslations', 'minifyScriptsImpl'));


gulp.task('testProdMinify', gulp.series(
    'enable-prod-stuff', 'minifyScriptsImpl'));



gulp.task('compile-stylus', () => {
  const stylusOptsLeftToRight = {
    linenos: true,
    import: [
      currentDirectorySlash + 'client/app-slim/mixins.styl',
      currentDirectorySlash + 'client/app-slim/variables.styl']
  };

  const stylusOptsRightToLeft = {
        ...stylusOptsLeftToRight,
        import: [
          currentDirectorySlash + 'client/rtl/right-to-left-mixins.styl',
          ...stylusOptsLeftToRight.import],
      };

  function makeStyleStream(rtlSuffix) {
    const sourceFiles = makeFileList(!!rtlSuffix);
    const stylusOpts = rtlSuffix ? stylusOptsRightToLeft : stylusOptsLeftToRight;

    let stream = gulp.src(sourceFiles)
        .pipe(plumber());

    if (rtlSuffix) {
      // Then the file list includes Bootstrap CSS files, softlinked with a .styl
      // suffix so Stylus processes them and flips left to right. However,
      // in the Bootstrap CSS, there's some filter: ... styles, which tend to cause
      // Stylus parsing errors, so remove them. (I think they aren't needed.)
      stream = stream.
          pipe(replace(/(\sfilter:.*;)/g, '/* $1   — tends to break Stylus [TyM502WAJB5] */'))
    }

    stream = stream
      .pipe(stylus(stylusOpts))
      // Make the .rtl styles work by removing this hacky text.
      .pipe(replace('__RTL__', ''))
      .pipe(concat(`styles-bundle${rtlSuffix}.css`))
      // Generate non-minified files:
      .pipe(save('111'))
        .pipe(gulp.dest(webDestVersioned))
        .pipe(gzip({ gzipOptions }))
        .pipe(gulp.dest(webDestVersioned))
      .pipe(save.restore('111'))
      // Generate minified files:
      .pipe(cleanCSS())
      .pipe(insert.prepend(makeCopyrightAndLicenseBanner()))
      .pipe(rename({ extname: '.min.css' }))
      // We need uncompressed files too [UNCOMPRAST].
      .pipe(gulp.dest(webDestVersioned))
      .pipe(gzip({ gzipOptions }))
      .pipe(gulp.dest(webDestVersioned));
    return stream;
  }

  const makeFileList = (rtl) => {
    const files = [
        'node_modules/bootstrap/dist/css/bootstrap.css',
        'node_modules/@webscopeio/react-textarea-autocomplete/style.css',
        'node_modules/react-select/dist/react-select.css',
        'client/third-party/stupid-lightbox.css',
        'client/app-slim/theme.styl',
        'client/app-slim/third-party.styl',
        'client/app-slim/page/page.styl',
        'client/app-slim/page/threads.styl',
        'client/app-slim/page/posts.styl',
        'client/app-slim/page/arrows.styl',
        'client/app-slim/**/*.styl',
        'client/app-more/**/*.styl',
        'client/app-editor/**/*.styl',
        'client/app-staff/**/*.styl'];

    if (rtl) {
      // Use softlinks with .styl suffix instead, so Stylus will process these
      // files and use the RTL mixins to replace margin-left and float:left etc
      // with margin-right and float:right etc.
      files[0] = 'client/rtl/bootstrap.styl';
      files[1] = 'client/rtl/react-textarea-autocomplete.styl';
      files[2] = 'client/rtl/react-select.styl';
      // Add a few rtl specifig styles, e.g. mirroring icons from left to right.
      files.push('client/rtl/right-to-left-props.styl');
    }
    return files;
  }

  return merge2(
      makeStyleStream(''),
      makeStyleStream('.rtl'));
});


function logChangeFn(fileType) {
  return function(filePath) {
    // This logs messages like:
    //  "Slim typescript file changed: client/app-slim/utils/talkyard-tour.ts"
    console.log(`${fileType} file changed: ${filePath}`);
  };
}


gulp.task('updateVersion', (done) => {
  updateVersionVars();
  done();
});


gulp.task('updateVersionGenBundles', gulp.series(
  'updateVersion',
  'compileConcatAllScripts',
  'compile-stylus',
  'minifyTranslations',
));


gulp.task('default', gulp.series(
  'compileConcatAllScripts',
  'compile-stylus',
  'minifyTranslations',
  'build-e2e',
  //'build-security-tests',
  ));


gulp.task('watch', gulp.series('default', (done) => {
  gulp.watch(
      ['client/server/**/*.ts', ...serverJavascriptSrc],
      gulp.series('compileServerTypescriptConcatJavascript-concatScripts'))
    .on('change', logChangeFn('Server typescript'));

  gulp.watch(
      ['client/serviceworker/**/*.ts'],
      gulp.series('compileSwTypescript-concatScripts'))
    .on('change', logChangeFn('Service worker typescript'));

  gulp.watch(
      ['client/app-slim/**/*.ts'],
      gulp.series('compileSlimTypescript-concatScripts'))
    .on('change', logChangeFn('Slim typescript'));

  gulp.watch(
      ['client/app-more/**/*.ts'],
      gulp.series('compileMoreTypescript-concatScripts'))
    .on('change', logChangeFn('More typescript'));

  gulp.watch(
      ['client/app-staff/**/*.ts'],
      gulp.series('compileStaffTypescript-concatScripts'))
    .on('change', logChangeFn('Staff typescript'));

  gulp.watch(['client/app-editor/**/*.ts'],
      gulp.series('compileEditorTypescript-concatScripts'))
    .on('change', logChangeFn('Editor typescript'));

  gulp.watch(['client/embedded-comments/**/*.js', 'client/embedded-comments/**/*.ts'],
      gulp.series('compileBlogCommentsTypescript-concatScripts'))
    .on('change', logChangeFn('Blog comments typescript'));

  gulp.watch('client/**/*.js',
      gulp.series('wrap-javascript-concat-scripts'))
    .on('change', logChangeFn('Javascript'));

  gulp.watch(
      'client/**/*.styl',
      gulp.series('compile-stylus'))
    .on('change', logChangeFn('Stylus'));

  gulp.watch(
      ['translations/**/*.ts'],
      gulp.series('minifyTranslations'))
    .on('change', logChangeFn('Translations typescript'));

  gulp.watch('tests/e2e/**/*.ts',
      gulp.series('build-e2e'))
    .on('change', logChangeFn('End-to-End test files'));

  gulp.watch([versionFilePath],
      gulp.series('updateVersionGenBundles'))
    .on('change', logChangeFn("Version changed"));

  //gulp.watch(_2dTsProj.src(), ['compile2dTypescript-concatScripts']).on('change', logChangeFn('2D TypeScript')); [SLIMTYPE]

  //gulp.watch('tests/security/**/*.ts',
  //    gulp.series('build-security-tests'))
  //  .on('change', logChangeFn('security test files'));

  done();
}));


// Keep min.{js,css}, in addition to min.{js,css}.gz.  [UNCOMPRAST]
// (This makes the Web image assets dir 5.5 MB large instead of just 2.7 MB,
// as of Jan 2020.  (An alternative, to keep the image small, could be to
// unzip the files in a docker-entrypoint script. But scratch that — the assets dir
// is mounted read-only here in this dev repo; would need to mount read-write?
// Or using ngx_http_gunzip_module — but that'd cause slightly higher CPU load?))
//
gulp.task('delete-non-gzipped', () => {
  return del([
      `${webDest}/**/*.js`,
      `!${webDest}/**/*.min.js`,
      `${webDest}/**/*.css`,
      `!${webDest}/**/*.min.css`,
      // Needed in dev mode:
      //`${serverDest}/**/*.js`,
      //`!${serverDest}/**/*.min.js`,
      ]);
});


gulp.task('clean', () => {
  return del([
    `${webDest}/*`,
    `!${webDest}/.gitkeep`,
    `${serverDest}/*`,
    `!${serverDest}/.gitkeep`]);
});


gulp.task('release', gulp.series(  // [MKBUNDLS]
    'clean',
    'enable-prod-stuff',
    'minifyScripts',
    'compile-stylus',
    'delete-non-gzipped'));


// ========================================================================
//  Security tests
// ========================================================================

//gulp.task('clean-security-tests', function () {
//  return del([
//    'target/security-tests/**/*']);
//});
//
//gulp.task('compile-security-tests', function() {
//  var stream = gulp.src([
//    //'tests/sync-tape.ts',
//    'tests/security/**/*.ts'])
//    .pipe(plumber())
//    .pipe(typeScript({
//      declarationFiles: true,
//      module: 'commonjs',
//      lib: ['es5', 'es2015', 'dom'],
//      types: ['lodash', 'core-js', 'assert', 'node']
//    })
//    .pipe(plumber()));
//  return stream.js
//  // .pipe(sourcemaps.write('.', { sourceRoot: '../../../../externalResolve/' }))
//    .pipe(gulp.dest('target/security-tests'));
//});
//
//
//gulp.task('build-security-tests', gulp.series('clean-security-tests', 'compile-security-tests', () => {
//});


// vim: et ts=2 sw=2 tw=0 list
