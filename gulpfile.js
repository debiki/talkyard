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
var concat = require('gulp-concat');


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

gulp.task('default', ['run-grunt'], function () {
});


// vim: et ts=2 sw=2 tw=0 list
