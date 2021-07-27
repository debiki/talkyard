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


// Try to migrate to Webpack v5.
// (Continue using Gulp for some things, or maybe Makefile tasks instead somehow?)
//
// First, maybe good to convert all JS to Typescript?
// https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html
//
// And need to start using ES6 modules instead of Typescript's namespaces?
// Ideas about how to do that, gradually:
//  - websearch: "typescript migrate namespace to module"
//  - https://github.com/microsoft/TypeScript/issues/12473
//  - https://www.geekytidbits.com/typescript-progressively-convert-namespaces-to-modules/
//  - https://stackoverflow.com/questions/50458469/convert-namespace-to-module-based-typescript-code


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
const through2 = require('through2');
const g_del = require('del');
const rename = require("gulp-rename");
const gzip = require('gulp-gzip');
const merge2 = require('merge2');
const fs = require("fs");
// COULD remove, uses old gulp-util, deprecated and pulls in old cruft.
const save = require('gulp-save');
const execSync = require('child_process').execSync;
const spawnSync = require('child_process').spawnSync;
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
    const errCode = 'TyE_BAD_GIT_REPO';
    console.error(`Error finding Git revision [${errCode}]`, ex)
    return errCode;
  }
}


/// Only for Ty's own Typescript code. Not for 3rd party Javascript.
///
function expandCPreProcessorMacros(ps) {  // : { debug?: true, prod?: true }
  // See also: nextFileTemplate = function(contents, file) ...

  // And: http://www.nongnu.org/espresso/js-cpp.html
  // or: https://www.npmjs.com/package/c-preprocessor
  // or: https://www.reddit.com/r/javascript/comments/2ymw1q/using_gcccppclangs_cpreprocessor_in_javascript/
  // etc: https://www.google.com/search?q=javascript+%22c+preprocessor%22
  // (but they're doing it in an unsafe way, without our [cpp_sane] check.)

  if (!!ps.dev === !!ps.prod) throw Error('TyE396MFEG2');

  return insert.transform(function(sourceCodeSt, sourceFile) {
    const macrosFile = `macros-${ps.dev ? 'dev' : 'prod'}.h`;
    function makeArgs(macrosFile) {
      return [
            // Read from stdin — we'll pipe sourceCodeSt.
            '-',
            // Write to stdout.
            `-`,
            // C preprocessor macros defined in this file.
            `-imacros`, 'client/macros/' + macrosFile,
            // Interpret the source code file more as text, but "less" as C or CPP code,
            // otherwise the C preprocessor removes "unneeded" whitespace — but
            // such whitespace might mean something in javascript or typescript.
            // See: https://stackoverflow.com/questions/445986/how-to-force-gcc-preprocessor-to-preserve-whitespace
            // and: https://gcc.gnu.org/onlinedocs/cpp/Traditional-Mode.html
            `-traditional-cpp`,
            // Skip default C macros (only use Talkyard's own macros) and headers.
            `-nostdinc`,
            // Don't add any '#line 123' line markers (for C, not javascript).
            `-P`,
            // Keep comments.
            `-CC`];
            // Allow '//' comments — included the C99 standard, not C89. Doesn't work,
            // because of -traditional-cpp above?
            //`-x=c99`
            // This works, but deletes blanks before the '//', which fails the
            // safety test below. [cpp_sane]
            //`-x=c++`;
    }

    // Make #ifdef work if commented out — so can be used in Typescript files,
    // where #ifdef would cause a Typescript syntax error if on the first column,
    // without comments '//' before.
    // So, in Ty's Typescript, this will get processed by cpp:
    //   >   // #ifdef DEBUG
    //   >   debugStuff();
    //   >   // #endif
    // DO_AFTER soon: remove dependency 'gulp-preprocess', use cpp instead  [js_macros]
    // and change  '  // @ifdef DEBUG   .. // @endif'  to  '#ifdef DEBUG ... #endif'.
    const sourceCodeStWithIfdefUncommented = sourceCodeSt.replace(
            /^[ \t]*\/\/[ \t]*(#[a-z]+([ \t]+[a-zA-Z0-9_]+)?)[ \t]*$/gm, '$1');

    // cpp -traditional-cpp -nostdinc -P -E -CC /home/user/styd/d9/client/embedded-comments/blog-comments.ts ./blog-comments.ts.after-cpp.ts -imacros /home/user/styd/d9/client/macros-prod.cpp
    console.log(`CPP: spawnSync('cpp', ${makeArgs(macrosFile).join(' ')
          }, { input: contents, encoding: 'utf8', maxBuffer: .. }).trim();`)
    const resultObj = spawnSync(
            'cpp', makeArgs(macrosFile), {
              input: sourceCodeStWithIfdefUncommented,
              encoding: 'utf8',
              // Unminified script bundles can be large, 1 - 10 MiB,
              // but 50 MiB is impossibly much? If too little, there'll
              // be an ENOBUFS error (ENd Of BUFferS?) and the file
              // truncated.
              maxBuffer: 50 * 1024 * 1024,
             });
    const processedCodeSt = resultObj.stdout.toString();

    // Try once without any macros; we should get back sourceCode unchanged, [cpp_sane]
    // otherwise we cannot be sure that cpp didn't mess up anything — after all,
    // it's for C and C++ not Javascript.
    const resultObjUnchanged = spawnSync(
            'cpp', makeArgs('macros-none.h'), {
              input: sourceCodeStWithIfdefUncommented,
              encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, });
    const unchangedCodeSt = resultObjUnchanged.stdout.toString();
    if (unchangedCodeSt !== sourceCodeSt) {
      fs.writeFileSync('target/client/cpp-before.ts', sourceCodeSt);
      fs.writeFileSync('target/client/cpp-after.ts', unchangedCodeSt);
      throw Error(`The C Preprocessor messes up this file:  ${sourceFile.path} \n` +
          `  Look at this:\n` +
          `     gvimdiff target/client/cpp-before.ts target/client/cpp-after.ts  \n` +
          `\n` +
          `  Tips 1: cpp (the C Preprocessor) concatenates lines ending with '\\',\n` +
          `  so you can change from '\\' (backslash) to '＼' which is\n` +
          `  U+FF3C	FULLWIDTH REVERSE SOLIDUS (not backslash),\n` +
          `  see: https://unicode-search.net/unicode-namesearch.pl?term=BACKSLASH\n\n` +
          `\n` +
          `  Tips 2: cpp also doesn't know that // starts a comment, and\n` +
          `  will complain about an unterminated /* comment for lines like:\n` +
          `  // text text /* more text, so add a space between / and *: '/ *'\n` +
          `  (If enabling C++ or C99 mode, cpp then understands // *but* strips\n` +
          `  whitespace before, making our [cpp_sane] check sometimes fail.)\n\n`
          );
    }

    return processedCodeSt;
  });
}

let version;
let versionTag;

let preprocessProdContext;

// Here we'll place the generated js, min.js and min.js.gz files. [GZPATHS]
const webDest = 'images/web/assets';  // assets-dev (no min.js), assets-prod (only min.js)
const webDestDev = 'images/web/assets-dev';  // only .js, no min.js
const webDestProd = 'images/web/assets-prod';  // only min.js
let webDestVersioned;
let webDestVersionedDev;
let webDestVersionedProd;
let webDestTranslations;
let webDestTranslationsDev;
let webDestTranslationsProd;

const webDestFonts = `images/web/fonts`;

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


// Updates the mtime and atime of a generated bundle — otherwise Gulp uses some
// older mtmie/atime from some source file, only updates the ctime of the
// generated bundle. And then tools like GNU Make would always rebuild.
//
// See: https://github.com/gulp-community/gulp-less/issues/301#issuecomment-420780708
//
const updateAtimeAndMtime = function() {
  const now = new Date();
  return through2.obj(function(file, enc, cb) {
    // Don't know why `file` or `file.stat` is undefined sometimes.
    if (file && file.stat) {
      file.stat.atime = now;
      file.stat.mtime = now;
    }
    cb(null, file);
  });
}


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


// Sync w Makefile.  [sw_js_files]
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
//
// Sync w Makefile.  [slim_js_files]
var slimJsFiles = [
      // Place React first so we can replace it at index 0,1,2,3 with the optimized min.js versions.
      'node_modules/react/umd/react.development.js',
      'node_modules/react-dom/umd/react-dom.development.js',
      'node_modules/prop-types/prop-types.js',
      'node_modules/create-react-class/create-react-class.js',
      'node_modules/react-router-dom/umd/react-router-dom.js',
      'node_modules/react-dom-factories/index.js',
      'client/app-slim/utils/calcScrollRectIntoViewCoords.js',
      'client/third-party/smoothscroll-tiny.js',
      'client/third-party/bliss.shy.js',
      'client/app-slim/util/stupid-lightbox.js',
      'node_modules/keymaster/keymaster.js',
      // keymaster.js declares window.key, rename it to window.keymaster instead,
      // see comment in file for details.
      'client/third-party/rename-key-to-keymaster.js',
      'client/third-party/lodash-custom.js',
      'node_modules/eventemitter3/umd/eventemitter3.min.js',
      'client/third-party/tiny-querystring.umd.js',
      'client/third-party/gifffer/gifffer.js',
      'client/third-party/get-set-cookie.js',
      //'target/client/app-slim/posts/unread-unused.js',
      'client/app-slim/utils/util.js',
      'client/app-slim/utils/util-browser.js',
      'client/third-party/popuplib.js',
      'client/app-slim/login/login-popup.js',
      'target/client/slim-typescript.js',
      'client/app-slim/call-start-stuff.js'];

// Sync with Makefile [more_js_files].
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

// Sync w Makefile [edr_js_files]
var editorJsFiles = [
      // We use two different sanitizers, in case there's a security bug in one of them. [5FKEW2]
      // Find the code that "combines" them here: googleCajaSanitizeHtml [6FKP40]
      'modules/sanitize-html/dist/sanitize-html.js',     // 1
      'client/third-party/html-css-sanitizer-bundle.js', // 2
      'node_modules/markdown-it/dist/markdown-it.js',
      'node_modules/blacklist/dist/blacklist.js',  // needed by what?
      'node_modules/fileapi/dist/FileAPI.html5.js', // don't use the Flash version (w/o '.html5')
      'node_modules/@webscopeio/react-textarea-autocomplete/dist/react-textarea-autocomplete.umd.min.js',
      'client/third-party/diff_match_patch.js',
      'client/third-party/non-angular-slugify.js',
      'target/client/editor-typescript.js'];

/* For 2d layout horizontal scrolling, now disabled. [2D_LAYOUT]
var jqueryJsFiles = [
  'node_modules/jquery/dist/jquery.js',
  'client/third-party/abbreviate-jquery.js',
  'node_modules/jquery-resizable/resizable.js']; */


// For both touch devices and desktops.
// (parten-header.js and parent-footer.js wraps and lazy loads the files inbetween,
// see client/embedded-comments/readme.txt.)
// Sync w Makefile [embcmts_js_files]
var embeddedJsFiles = [
      'client/embedded-comments/parent-header.js',
      'client/third-party/bliss.shy.js',
      'client/third-party/smoothscroll-tiny.js',
      //'client/third-party/jquery-scrollable.js',
      //'client/third-party/jquery.browser.js',
      //'target/client/embedded-comments/debiki-utterscroll-iframe-parent.js',
      //'target/client/app-2d/utterscroll/utterscroll-init-tips.js',
      'client/app-slim/utils/calcScrollRectIntoViewCoords.js',
      'target/client/blog-comments-typescript.js',
      'client/embedded-comments/parent-footer.js'];


// TRY TO REMOVE THIS: (and pass all JS files to Typescript instead)
//
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
//  Translations
// ========================================================================


gulp.task('cleanTranslations', () => {
  return g_del([
          `${serverDestTranslations}/**/*`,
          `${webDestTranslations}/**/*`])
      .then(function(deletedPaths) {
        console.log('Deleted translations:\n  - ' + deletedPaths.join('\n  - '));
        return deletedPaths;
      });
});

// Transpiles ty-translations/ui/(language-code)/i18n.ts to one-js-file-per-source-file
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
      .pipe(updateAtimeAndMtime())
      .pipe(gulp.dest(webDestTranslations))
      .pipe(gulp.dest(serverDestTranslations))
      .pipe(gzip({ gzipOptions }))
      .pipe(gulp.dest(webDestTranslations));
});

gulp.task('buildTranslations', gulp.series('cleanTranslations', 'compileTranslations'));



// ========================================================================
//  Runtime bundles
// ========================================================================


var serverTypescriptProject = typeScript.createProject("client/server/tsconfig.json");


// Sync w Makefile.  [srv_js_files]
var serverJavascriptSrc = [
    // Two different sanitizers. [5FKEW2]
    // Needs to be first. There's some missing ';' at the start of the script bug?
    'modules/sanitize-html/dist/sanitize-html.min.js',
    'client/third-party/html-css-sanitizer-bundle.js',
    'node_modules/react/umd/react.production.min.js',
    'node_modules/react-dom/umd/react-dom-server.browser.production.min.js',
    'node_modules/react-dom-factories/index.js',
    'node_modules/create-react-class/create-react-class.min.js',
    'node_modules/react-router-dom/umd/react-router-dom.min.js',
    'client/third-party/tiny-querystring.umd.js',
    'node_modules/markdown-it/dist/markdown-it.min.js',
    'client/third-party/lodash-custom.js',
    'client/third-party/non-angular-slugify.js'];

// This one also concatenates Javascript, so it's different from the other
// 'compile(Sth)Typescript' functions — so let's append 'ConcatJavascript' to the name.
function compileServerTypescriptConcatJavascript() {
  // Generates server-bundle.js, with Ty's own code.
  const typescriptStream = serverTypescriptProject.src()
      .pipe(plumber())
      .pipe(insert.transform(nextFileTemplate))
      .pipe(serverTypescriptProject())
      .pipe(expandCPreProcessorMacros({ dev: true }));

  // Third party code (and skip expandCPreProcessorMacros()).
  const javascriptStream = gulp.src(serverJavascriptSrc)
      .pipe(plumber())
      .pipe(insert.transform(nextFileTemplate));

  return merge2(javascriptStream, typescriptStream)
      .pipe(concat('server-bundle.js'))
      .pipe(updateAtimeAndMtime())
      .pipe(gulp.dest(serverDest));
}

var swTypescriptProject = typeScript.createProject("client/serviceworker/tsconfig.json");
var headTypescriptProject = typeScript.createProject("client/app-head/tsconfig.json");
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
    .pipe(expandCPreProcessorMacros({ dev: true }))
    .pipe(updateAtimeAndMtime())
    .pipe(gulp.dest('target/client/'));
}

function compileSlimTypescript() {
  return slimTypescriptProject.src()
    .pipe(plumber())
    .pipe(insert.transform(nextFileTemplate))
    .pipe(slimTypescriptProject())
    .pipe(expandCPreProcessorMacros({ dev: true }))
    .pipe(updateAtimeAndMtime())
    .pipe(gulp.dest('target/client/'));
}

function compileOtherTypescript(typescriptProject) {
  return typescriptProject.src()
    .pipe(plumber())
    .pipe(insert.transform(nextFileTemplate))
    .pipe(typescriptProject())
    .pipe(expandCPreProcessorMacros({ dev: true }))
    .pipe(updateAtimeAndMtime())
    .pipe(gulp.dest('target/client/'));
}

gulp.task('compileServerTypescriptConcatJavascript', () => {
  return compileServerTypescriptConcatJavascript();
});


gulp.task('compileSwTypescript', () => {
  return compileSwTypescript();
});
gulp.task('compileSwTypescript-concatScripts',
        gulp.series('compileSwTypescript',() => {
  return makeConcatStream('talkyard-service-worker.js', swJsFiles, 'DoCheckNewer', false);
}));


gulp.task('compileHeadTypescript', () => {
  return compileOtherTypescript(headTypescriptProject);
});
gulp.task('compileHeadTypescript-concatScripts',
        gulp.series('compileHeadTypescript',() => {
  return makeConcatStream('head-bundle.js',
          // Sync w Makefile. [head_js_files]
          ['target/client/head-typescript.js'], 'DoCheckNewer');
}));


gulp.task('compileSlimTypescript', () => {
  return compileSlimTypescript();
});
gulp.task('compileSlimTypescript-concatScripts',
        gulp.series('compileSlimTypescript',() => {
  return makeConcatStream('slim-bundle.js', slimJsFiles, 'DoCheckNewer');
}));


gulp.task('compileMoreTypescript', () => {
  return compileOtherTypescript(moreTypescriptProject);
});
gulp.task('compileMoreTypescript-concatScripts',
        gulp.series('compileMoreTypescript',() => {
  return makeConcatStream('more-bundle.js', moreJsFiles, 'DoCheckNewer');
}));

/*
gulp.task('compile2dTypescript', () => { // [SLIMTYPE]
  return compileOtherTypescript(_2dTypescriptProject);
});
gulp.task('compile2dTypescript-concatScripts',
        gulp.series('compile2dTypescript',() => {
  return makeConcatStream('2d-bundle.js', _2dJsFiles, 'DoCheckNewer'); // [SLIMTYPE]
}));
 */

gulp.task('compileStaffTypescript', () => {
  return compileOtherTypescript(staffTypescriptProject);
});
gulp.task('compileStaffTypescript-concatScripts',
        gulp.series('compileStaffTypescript',() => {
  return makeConcatStream('staff-bundle.js', staffJsFiles, 'DoCheckNewer');
}));


gulp.task('compileEditorTypescript', () => {
  return compileOtherTypescript(editorTypescriptProject);
});
gulp.task('compileEditorTypescript-concatScripts',
        gulp.series('compileEditorTypescript',() => {
  return makeConcatStream('editor-bundle.js', editorJsFiles, 'DoCheckNewer');
}));


gulp.task('compileBlogCommentsTypescript', () => {
  return compileOtherTypescript(blogCommentsTypescriptProject);
});
gulp.task('compileBlogCommentsTypescript-concatScripts',
        gulp.series('compileBlogCommentsTypescript',() => {
  return makeConcatStream('talkyard-comments.js', embeddedJsFiles, 'DoCheckNewer', false);
}));



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
        .pipe(updateAtimeAndMtime())
        .pipe(gulp.dest(dest))  // <— not needed? deleted anyway by task 'delete-non-gzipped'
        .pipe(gzip({ gzipOptions }))
        .pipe(gulp.dest(dest));
}


gulp.task('bundleZxcvbn', () => {
  return gulp.src('node_modules/zxcvbn/dist/zxcvbn.js')  // this path also in Makefile
          .pipe(plumber())
          .pipe(updateAtimeAndMtime())
          .pipe(gulp.dest(webDestVersioned))  // <— not needed? deleted by 'delete-non-gzipped'
          .pipe(gzip({ gzipOptions }))
          .pipe(gulp.dest(webDestVersioned));
});


gulp.task('compileConcatAllScripts', gulp.series(  // speed up w gulp.parallel? (GLPPPRL)
  'compileServerTypescriptConcatJavascript',
  'compileSwTypescript-concatScripts',
  'compileHeadTypescript-concatScripts',
  'compileSlimTypescript-concatScripts',
  'compileMoreTypescript-concatScripts',
  // _2dTypescriptProject: disabled
  'compileStaffTypescript-concatScripts',
  'compileEditorTypescript-concatScripts',
  'compileBlogCommentsTypescript-concatScripts',
  'bundleZxcvbn'));


gulp.task('enable-prod-stuff', (done) => {
  // This script isn't just a minified script — it contains lots of optimizations.
  // So we want to use react-with-addons.min.js, rather than minifying the .js ourselves.
  slimJsFiles[0] = 'node_modules/react/umd/react.production.min.js';
  slimJsFiles[1] = 'node_modules/react-dom/umd/react-dom.production.min.js';
  slimJsFiles[2] = 'node_modules/prop-types/prop-types.min.js';
  slimJsFiles[3] = 'node_modules/create-react-class/create-react-class.min.js';
  slimJsFiles[4] = 'node_modules/react-router-dom/umd/react-router-dom.min.js';
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
      .pipe(updateAtimeAndMtime())
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
      .pipe(preprocess({ context: preprocessProdContext })) // comment above [js_macros]
      .pipe(expandCPreProcessorMacros({ prod: true }))
      .pipe(gulp.dest('target/client/before-uglify'))
      .pipe(uglify())
      .pipe(rename({ extname: '.min.js' }))
      .pipe(insert.prepend(makeCopyrightAndLicenseBanner()))
      .pipe(updateAtimeAndMtime())
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
      makeMinJsGzStream(webDest, true),  // webDevDest, webProdDest
      makeMinJsGzStream(webDestVersioned, true));  // webDevDestVersioned, webProdDestVersioned
}));



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
      // Don't: .pipe(expandCPreProcessorMacros())
      // — cpp thinks #some-tag-id is a macro keyword.
      // Make the .rtl styles work by removing this hacky text.
      .pipe(replace('__RTL__', ''))
      .pipe(concat(`styles-bundle${rtlSuffix}.css`))
      .pipe(updateAtimeAndMtime())
      // Generate non-minified files:
      .pipe(save('111'))
        .pipe(gulp.dest(webDestVersioned))  // <— not needed? deleted by 'delete-non-gzipped'
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
        // --- These first three get replaced, if RTL --------
        'node_modules/bootstrap/dist/css/bootstrap.css',
        'node_modules/@webscopeio/react-textarea-autocomplete/style.css',
        'node_modules/react-select/dist/react-select.css',
        // ---------------------------------------------------
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



// This is in its own bundle, so can do assets versioning separately,
// and [the urls to the woff2 files in the 300.css etc] will still work.
// ('v1' below is the version.)
//
gulp.task('bundleFonts', () => {
  const stylusOpts = {
    linenos: true,
  };

  // Change to only 300 and 700, skip 400 and 600?
  // Sync -vN and font sizes with Makefile and Dockerfile woff2 file list. [sync_fonts]
  const fontDir = webDestFonts + '/open-sans-v2';
  const fontFiles = [
        'images/web/node_modules/fontsource-open-sans/300.css',
        'images/web/node_modules/fontsource-open-sans/400.css',
        'images/web/node_modules/fontsource-open-sans/600.css'];

  const stream = gulp.src(fontFiles)
      .pipe(plumber())
      .pipe(stylus(stylusOpts))
      .pipe(concat(`open-sans.css`))
      .pipe(updateAtimeAndMtime())
      // Generate non-minified files:
      .pipe(save('111'))
        .pipe(gzip({ gzipOptions }))
        .pipe(gulp.dest(fontDir))
      .pipe(save.restore('111'))
      // Generate minified files:
      .pipe(cleanCSS())
      .pipe(insert.prepend(makeCopyrightAndLicenseBanner()))
      .pipe(rename({ extname: '.min.css' }))
      // We need uncompressed files too [UNCOMPRAST].
      .pipe(gulp.dest(fontDir))
      .pipe(gzip({ gzipOptions }))
      .pipe(gulp.dest(fontDir));
  return stream;
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
  ));


gulp.task('watch', gulp.series((done) => {
  gulp.watch(
      ['client/server/**/*.js', 'client/server/**/*.ts', ...serverJavascriptSrc],
      gulp.series('compileServerTypescriptConcatJavascript'))
    .on('change', logChangeFn('Server typescript'));

  gulp.watch(
      ['client/serviceworker/**/*.js', 'client/serviceworker/**/*.ts'],
      gulp.series('compileSwTypescript-concatScripts'))
    .on('change', logChangeFn('Service worker typescript'));

  // Missing: Watch 'compileHeadTypescript-concatScripts',")
  // See throw Error below.

  gulp.watch(
      ['client/app-slim/**/*.js', 'client/app-slim/**/*.ts'],
         // ...slimJsFiles], — maybe generating the typescript.js would trigger a 2nd build?
      gulp.series('compileSlimTypescript-concatScripts'))
    .on('change', logChangeFn('Slim typescript'));

  gulp.watch(
      ['client/app-more/**/*.js', 'client/app-more/**/*.ts'],
      gulp.series('compileMoreTypescript-concatScripts'))
    .on('change', logChangeFn('More typescript'));

  gulp.watch(
      ['client/app-staff/**/*.js', 'client/app-staff/**/*.ts'],
      gulp.series('compileStaffTypescript-concatScripts'))
    .on('change', logChangeFn('Staff typescript'));

  gulp.watch(['client/app-editor/**/*.js', 'client/app-editor/**/*.ts'],
      gulp.series('compileEditorTypescript-concatScripts'))
    .on('change', logChangeFn('Editor typescript'));

  gulp.watch(['client/embedded-comments/**/*.js', 'client/embedded-comments/**/*.ts'],
      gulp.series('compileBlogCommentsTypescript-concatScripts'))
    .on('change', logChangeFn('Blog comments typescript'));

  gulp.watch(
      'client/**/*.styl',
      gulp.series('compile-stylus'))
    .on('change', logChangeFn('Stylus'));

  gulp.watch(
      ['translations/**/*.ts'],
      gulp.series('minifyTranslations'))
    .on('change', logChangeFn('Translations typescript'));

  gulp.watch([versionFilePath],
      gulp.series('updateVersionGenBundles'))
    .on('change', logChangeFn("Version changed"));

  //gulp.watch(_2dTsProj.src(), ['compile2dTypescript-concatScripts']).on('change', logChangeFn('2D TypeScript')); [SLIMTYPE]

  //gulp.watch('tests/security/**/*.ts',
  //    gulp.series('build-security-tests'))
  //  .on('change', logChangeFn('security test files'));

  throw Error("Missing: Watch 'compileHeadTypescript-concatScripts',");
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
  return g_del([
          `${webDest}/**/*.js`,
          `!${webDest}/**/*.min.js`,
          `${webDest}/**/*.css`,
          `!${webDest}/**/*.min.css`,
          // Needed in dev mode:
          //`${serverDest}/**/*.js`,
          //`!${serverDest}/**/*.min.js`,
          ])
      .then(function(deletedPaths) {
        console.log('Deleted some non-gzipped:\n  - ' + deletedPaths.join('\n  - '));
        return deletedPaths;
      });
});


gulp.task('clean', gulp.series('cleanTranslations', () => {
  return g_del([
          `target/client`,
          `${webDest}/*`,
          `!${webDest}/.gitkeep`,
          // `!${webDestProd}/*`,
          // `!${webDestProd}/.gitkeep`,
          `${webDestFonts}/*`,
          `!${webDestFonts}/.gitkeep`,
          `${serverDest}/*`,
          `!${serverDest}/.gitkeep`])
      .then(function(deletedPaths) {
        console.log('Deleted clean:\n  - ' + deletedPaths.join('\n  - '));
        return deletedPaths;
      });
}));


gulp.task('build_release_dont_clean_before', gulp.series(  // [MKBUNDLS]
    'enable-prod-stuff',
    // Need to build everything from scratch, because now using prod versions
    // of dependenceis.
    'compileConcatAllScripts',
    'minifyTranslations',
    'minifyScriptsImpl',
    'compile-stylus',
    'bundleFonts',
    'delete-non-gzipped'));  //  [del_non_min_js]


// ========================================================================
//  Security tests
// ========================================================================

//gulp.task('clean-security-tests', function () {
//  return g_del([
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
