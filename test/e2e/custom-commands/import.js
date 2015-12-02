/**
 * @param siteData – an object
 */
exports.command = function(siteData, success, anyErrorCallback) {
  this.post(this.globals.mainSiteOrigin + '/-/import-site', siteData, success, anyErrorCallback);
  return this
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
