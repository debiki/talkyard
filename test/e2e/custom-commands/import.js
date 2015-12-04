/**
 * @param siteData – an object
 */
exports.command = function(siteData, success, anyErrorCallback) {
  var self = this;
  var url = this.globals.mainSiteOrigin + '/-/import-site?' + this.globals.e2eTestPasswordUrlParam;
  self.post(url, siteData, function(response, body) {
    if (!body.site || !body.site.id) {
      throw new Error("No site.id in /-/import-site response [EsE7UGK2]:\n" + JSON.stringify(body))
    }
    success(body.site);
  }, anyErrorCallback);
  return this
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
