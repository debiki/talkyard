/* An AngularJS module for the whole page.
 * Copyright (C) 2012 - 2013 Kaj Magnus Lindberg (born 1979)
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

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


# The ui.* module is Angular's UI Utils,
#   http://angular-ui.github.io/ui-utils/

DebikiPageModule =
  angular.module('DebikiPageModule', ['DebikiDashbarModule', 'ui.scrollfix'])



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
