import { staffRoutes } from './admin/admin-app.staff';
import { AdminGuide } from './admin/AdminGuide.staff';
import { routes as superAdminRoutes } from './superadmin/superadmin-app.staff';
import { routes as createsiteRoutes } from './create-site/create-site.staff';


// Other Ty script bundles want old global Typescript namespaces, give them that:
// (see: ./staff-bundle-already-loaded.d.ts )
//
(window as any).debiki2 = {

  admin: {
    staffRoutes,
    AdminGuide,
  },

  superadmin: {
    routes: superAdminRoutes,
  },

  createsite: {
    routes: createsiteRoutes,
  },

};
