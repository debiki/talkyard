
exports.command = function(selector, timeout, callback) {
  if (!callback)
    callback = timeout;

  this.waitForElementVisible(selector, timeout)
      .getText(selector, callback);
  return this;
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
