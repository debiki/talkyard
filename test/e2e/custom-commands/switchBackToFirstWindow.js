// Switches back to the original window. Seems that's always handle [0] — is it always?
exports.command = function() {
  this.window_handles(function(result) {
    var handle = result.value[0];
    this.switchWindow(handle);
  });
  return this;
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
