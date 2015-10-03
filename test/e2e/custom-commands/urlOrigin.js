
exports.command = function(callback) {
  this.url(function(url) {
    var matches = url.value.match(/(https?:\/\/[^\/]+)\//);
    callback(matches[1]);
  });
  return this;
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
