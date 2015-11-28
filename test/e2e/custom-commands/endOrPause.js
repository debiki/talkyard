
exports.command = function() {
  if (this.globals.pauseForeverAfterTest) {
    console.log(this.globals.unusualColor("Now I'll pause forever, like you said."));
    this.pause();
  }
  this.end();
  return this;
};

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
