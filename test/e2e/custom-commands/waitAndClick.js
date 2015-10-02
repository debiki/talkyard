
exports.command = function(selector, timeout) {
  this.waitForElementVisible(selector, timeout)
      .click(selector);
  return this;
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
