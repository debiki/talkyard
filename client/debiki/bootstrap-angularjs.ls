# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


angularStartup = void


/**
 * Starts AngularJS and initizlizes the root scope.
 *
 * Not called until really needed, for performance reasons (so mobile
 * phones don't need to download and parse the AngularJS lib, and
 * run the page through Angular's template engine).
 */
bootstrapAngularJs = !->
  if angularStartup => return
  angularStartup := $.Deferred!

  cdnDir = 'https://ajax.googleapis.com/ajax/libs/angularjs/1.0.1/'

  bootstrapAngular = !->
    # See http://docs.angularjs.org/guide/bootstrap, "Manual Initialization".
    angular.element(document).ready !->
      angular.bootstrap document, ['DebikiPageModule']
      initRootScope!
      angularStartup.resolve!

  Modernizr.load(
    both: [
      cdnDir + 'angular.min.js',
      cdnDir + 'angular-sanitize.min.js',
      d.i.assetsUrlPathStart + 'debiki-dashbar.js']
    complete: bootstrapAngular)



findRootScope = ->
  # (See:
  # http://stackoverflow.com/questions/10490570/
  #   call-angular-js-from-legacy-code )
  return undefined unless angular?
  angular.element($('html')).scope!



!function initRootScope
  $rootScope = findRootScope!

  $pageDataTag = $ '.dw-page'  # or are there > 1 on blog main page?
  $rootScope <<< $pageDataTag.dwPageMeta!

  $rootScope.setCurrentUser = !(userProps) ->
    $rootScope.currentUser ?= {}
    $rootScope.currentUser <<< userProps

  $rootScope.clearCurrentUser = !->
    $rootScope.currentUser = undefined



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
    rootScope.$apply !->
      f rootScope



/**
 * Executes `f($rootScope)` inside $rootScope.$apply, but only if
 * AngularJS has already been bootstrapped; otherwise does nothing.
 */
d.i.anyAngularApply = !(f) ->
  rootScope = findRootScope!
  if rootScope
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
