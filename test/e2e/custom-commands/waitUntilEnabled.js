
exports.command = function(selector, timeout) {
  this.expect.element(selector).to.be.enabled.before(
      timeout || this.globals.waitForConditionTimeout);
  return this;
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
