/// <reference path="Server.ts" />
/// <reference path="../app-staff/staff-bundle-already-loaded.d.ts" />


namespace debiki2.staffbundle {

  export function loadAdminGuide(handler: (adminGuide: RElm) => V) {
    Server.loadStaffScriptsBundle(() => {
      handler(debiki2.admin.AdminGuide);
    })
  }

  export function loadStaffTours(handler: (tours: StaffTours) => V) {
    Server.loadStaffScriptsBundle(() => {
      handler(debiki2.admin['staffTours']);
    })
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
