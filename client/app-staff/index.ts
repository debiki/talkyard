import { staffRoutes } from './admin/admin-app.staff';
import { AdminGuide } from './admin/AdminGuide.staff';
import { routes as superAdminRoutes } from './superadmin/superadmin-app.staff';
import { routes as createsiteRoutes } from './create-site/create-site.staff';

console.log(`ZZWW ****** RUNNING index.ts ***********`);
//debugger;

// Other Ty script bundles want old global Typescript namespaces, give them that:
// (see: ./staff-bundle-already-loaded.d.ts )
//
const d2 = {

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

// No, instead, [45656084535653]:
//const debiki2 = (window as any).debiki2;
//(window as any).debiki2 = { ...debiki2, ...d2 };

export const adminApi = d2;
