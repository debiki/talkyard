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
var templateCache = require('gulp-angular-templatecache');
require('gulp-grunt')(gulp);


gulp.task('default', function () {

  /*
  // Compile typescript.
  gulp.src(['src/**          /*.ts'])
    .pipe(typescript())
    .pipe(gulp.dest('dest/')); */

  // Compile AngularJS templates.
  gulp.src('client/forum/html/**/*.html')
      .pipe(templateCache({
        module: 'ForumApp',
        filename: 'all-angular-templates.js'
      }))
      .pipe(gulp.dest('target/client/'));

  gulp.run('grunt-default');
});


// vim: et ts=2 sw=2 tw=0 list
