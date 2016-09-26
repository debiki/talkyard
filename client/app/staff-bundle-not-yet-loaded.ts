/// <reference path="Server.ts" />
/// <reference path="staff-bundle-already-loaded.d.ts" />

namespace debiki2.staffbundle {

  export function loadAdminGuide(handler: (adminGuide) => void) {
    Server.loadStaffScriptsBundle(() => {
      handler(debiki2.admin.AdminGuide);
    })
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
