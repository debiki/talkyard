// Switches to the first window that is not the current window.
exports.command = function() {
  this.window_handle(function(result) {
    var currentHandle = result.value;
    this.window_handles(function(result) {
      for (var i = 0; i < result.value.length; ++i) {
        var handle = result.value[i];
        if (handle !== currentHandle) {
          this.switchWindow(handle);
        }
      }
    });
  });
  return this;
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
