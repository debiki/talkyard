/* Starts AngularJS.
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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


angularStartup = void


/**
 * Starts AngularJS and initizlizes the root scope.
 *
 * Not called until after a while.
 *
 * Not implemented:
 * Not called until after certain Javascript has extracted some data
 * from the HTML that is used to initialize AngularJS, in addition
 * to some more JSON from the server. — By includin some data
 * in the HTML, I think it's possible to make search engines
 * happy, because they get their HTML, and at the same time make
 * AngularJS happy, becaues after having extracted the appropriate
 * Javascript objects from the HTML, Angular gets its Javascript
 * objects.
 */
bootstrapAngularJs = !->
  if angularStartup => return
  angularStartup := $.Deferred!

  # See http://docs.angularjs.org/guide/bootstrap, "Manual Initialization".
  angular.element(document).ready !->
    angular.bootstrap document, ['DebikiApp']
    angularStartup.resolve!



findRootScope = ->
  # (See:
  # http://stackoverflow.com/questions/10490570/
  #   call-angular-js-from-legacy-code )
  return void unless angular?
  angular.element($('html')).scope!



/**
 * Executes `f($rootScope)` inside $rootScope.$apply.
 * Bootstraps AngularJS if needed.
 */
d.i.angularApply = !(f) ->
  rootScope = findRootScope!
  if !rootScope
    bootstrapAngularJs!

  angularStartup.done ->
    rootScope = findRootScope!
    if rootScope.$$phase
      f(rootScope)
    else
      rootScope.$apply !->
        f rootScope



/**
 * Executes `f($rootScope)` inside $rootScope.$apply, but only if
 * AngularJS has already been bootstrapped; otherwise does nothing.
 */
d.i.anyAngularApply = !(f) ->
  rootScope = findRootScope!
  if rootScope
    if rootScope.$$phase
      f(rootScope)
    else
      rootScope.$apply !-> f rootScope


# Run Angular later, on dynamically loaded HTML??
# Perhaps read:
#   http://docs.angularjs.org/api/ng.$compile
#
# Copy? `childScope = scope.$new();` and 2 more lines from:
#   https://github.com/angular/angular.js/blob/master/src/ng/directive/
#       ngInclude.js
#
# 
# Read again?
#   https://groups.google.com/d/msg/angular/qhtpgsl22xE/BNC2mZ7kKvMJ
# and the reply below:
# """Thanks. This is the answer I was looking for. This code works perfectly:
# /* dynamically add the block with the directive to add the template */
# $(element).html("<div ng-include src=\"'templates/templateDynamic1.html'\">
#     </div>");
#  
# /* Get angular to process this block */
# var fnLink = $compile(element);     // returns a Link function used to bind template to the scope
# fnLink($scope);                     // Bind Scope to the template
# """
#
# ( Avoiding manual initialization
#  https://groups.google.com/forum/?fromgroups=#!topic/angular/pZLfkEBqUKw
#  angular.element(document).unbind('DOMContentLoaded'); 
#  angular.element(window).unbind('load'); 
# )
#
# Avancerat om `transclude`: http://blog.omkarpatil.com/2012_11_01_archive.html

# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
