
exports.command = function(selector, timeout, value) {
  if (typeof value === 'undefined')
    value = timeout;

  this.waitForElementVisible(selector, timeout)
      .setValue(selector, value);
  return this;
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
