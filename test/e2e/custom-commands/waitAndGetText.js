
exports.command = function(selector, timeout, callback) {
  this.waitForElementVisible(selector, timeout)
      .getText(selector, callback);
  return this;
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
