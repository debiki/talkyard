/*
 * Copyright (c) 2024 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/// <reference path="../../macros/macros.d.ts" />
/// <reference path="../ReactActions.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../page-methods.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../avatar/avatar.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.personas {
//------------------------------------------------------------------------------

// [persona_indicator]
export function PersonaIndicator(ps: { store: Store, isSectionPage: Bo }): RElm | N {
  const store = ps.store;
  const me = store.me;
  const personaOpts: PersonaOptions | U = store.curPersonaOptions;
  const discProps: DiscPropsDerived | U = store.curDiscProps;
  const mode: PersonaMode | U = store.indicatedPersona;

  if (!personaOpts || !discProps || !mode)
    return null;

  const fullName = persMode_toStr(mode, Verbosity.Brief);
  const shortName = persMode_toStr(mode, Verbosity.VeryTerse);

  const title: RElm = rFr({},
      // If using a pseudonym, show it's avatar image, if any: [pseudonyms_later]
      !mode.pat ? null : avatar.Avatar({ user: mode.pat, origins: store, ignoreClicks: true }),
      // If screen wide:
      r.span({ className: 'esAvtrName_name' }, fullName),
      // If screen narrow, always visible if narrow:  [narrow]
      r.span({ className: 'esAvtrName_Anon' }, shortName),
      // If we'll need to ask pat which persona to use, then, show a question mark:
      !personaOpts.isAmbiguous ? null : r.span({ className: 'c_AliAmbig' }, ' ?'));

  const e2eClass =  // [pers_mode_2_class]
          mode.anonStatus === AnonStatus.IsAnonOnlySelfCanDeanon ? 'e_Prs-PrmAno' : (
          mode.anonStatus === AnonStatus.IsAnonCanAutoDeanon ? 'e_Prs-TmpAno' : (
          mode.self ? 'e_Prs-Self' :
          mode.pat ? 'e_Prs-Usr-' + mode.pat.id :
          'TyEUNKPRSMOD'));

  const aliasElm =
      Button({ className: 'esAvtrName esMyMenu c_Tb_Ali ' + e2eClass +
                      (!me.usePersona ? '' : ' c_Tb_Ali-Switched'),
          onClick: (event: MouseEvent) => {
            const atRect: Rect = cloneEventTargetRect(event);
            morebundle.openPersonaInfoDiag({ atRect, isSectionPage: ps.isSectionPage,
                me, personaOpts, discProps });
          }},
      title);

  return aliasElm;
}



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
