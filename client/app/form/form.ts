/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/jquery/jquery.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../model.ts" />
/// <reference path="../page-methods.ts" />

//------------------------------------------------------------------------------
   module debiki2.form {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var $: any = d.i.$;  // type JQuery –> Typescript won't find parseHTML :- (


export function activateAnyCustomForm() {
   var $forms = $('.dw-p-bd form');
   $forms.on('submit', function (event) {
      var $form = $(this);
      var namesAndValues = $form.serializeArray();
      // This messes with stuff rendered by React, but works fine nevertheless.
      Server.submitCustomForm(namesAndValues, function() {
         $form.replaceWith($.parseHTML('<p class="esFormThanks">Thank you.</p>'));
      });
      $form.find('button[type=submit]').text("Submitting ...").attr('disabled', 'disabled');
      event.preventDefault();
   });
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
