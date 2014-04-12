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


gulp.task('compile-livescript', function () {
  return gulp.src('client/**/*.ls')
    .pipe(liveScript())
    .pipe(gulp.dest('./target/client/'));
  console.log('lsc done?');
});


gulp.task('compile-typescript', function () {
  return gulp.src(['client/forum/**/*.ts'])
    .pipe(typeScript({
      target: 'ES5',
      allowBool: true,
      tmpDir: 'target/client/',
      out: 'all-typescript.js'
    }))
    .pipe(gulp.dest('target/client/'));
  console.log('tsc done?');
});


gulp.task('compile-angularjs-templates', function () {
  return gulp.src('client/forum/html/**/*.html')
      .pipe(templateCache({
        module: 'ForumApp',
        filename: 'all-angular-templates.js'
      }))
      .pipe(gulp.dest('target/client/'));
  console.log('ang done?');
});


gulp.task('run-grunt',
    ['compile-livescript', 'compile-typescript', 'compile-angularjs-templates'],
    function () {
  return gulp.run('grunt-default');
});


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


gulp.task('default', ['run-grunt', 'compile-stylus'], function () {
});


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


// vim: et ts=2 sw=2 tw=0 list
