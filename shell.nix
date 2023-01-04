# How use Niv:
#   First install Nix, then create Niv files:
#     nix-env -iA nixpkgs.niv # download Niv
#     niv init                # creates ./niv/sources.{nix,json}
#   Switch to newer Nix channel, e.g.:
#     nix-env -iA nixpkgs.niv            # add Niv to $PATH
#     niv update nixpkgs -b nixos-22.11  # use newer branch
#     # And sometimes also update niv/sources.nix:
#     niv init  # (updates instead of inits)

# This would import [whatever nixpkgs is defined to in ~/.nix-channels]?
#{ pkgs ? import <nixpkgs> {} }:
# But we want the nixpkgs specified in ./nix/sources.json, so:
{ sources ? import ./nix/sources.nix }:

with (import <nixpkgs> {});
mkShell {
  buildInputs = [
    ripgrep
    nodejs-14_x
    deno
    yarn
    gnumake
    # 'git' doesn't include git-gui, but 'gitFull' does.
    gitFull
    #gcc
    #readline
    #openssl
    #zlib
    #libiconv
    #postgresql_11
    #pkgconfig
    #libxml2
    #libxslt

    ## This'll give everyone the same version of Rust — reproducible builds.
    ## But don't! Because Rust will generate a binary that depends on libc 2.32, .33 or .34
    ## — however, Debian 11 (the current stable release) has 2.31 installed,
    ## so the binary will exit with a "no such file" error when it cannot
    ## dyn link to libc:  ("maint" was the name of the binary)
    ##    $ docker run --rm -it e72476584e2b       <—— runs /maint
    ##    exec /maint: no such file or directory   <—— libc not found
    ##    $ docker run --rm -it e72476584e2b bash
    ##    root@e0f6b47be653:/# ./maint
    ##    bash: ./maint: No such file or directory
    ##    root@e0f6b47be653:/# ldd maint
    ##    ./maint: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.33' not found (required by ./maint)
    ##    ./maint: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.32' not found (required by ./maint)
    ##    ./maint: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.34' not found (required by ./maint)
    ##    ...
    ## So skip, for now: (later, cross-build somehow)
    #
    #cargo
    #rustc
    #rustfmt
    #libclang
  ];

  shellHook = ''
    alias ll='ls -l'
    alias lal='ls -al'
    alias t='tree'
    alias ft='tree -f'

    # The default nix-shell prompt is:  "\n\[\033[1;32m\][nix-shell:\w]\$\[\033[0m\] "
    # \[\e starts color.
    # \#  commant count.
    # \A  hour24:min
    # \t  hour24:min:sec
    # Current time, dark green:  \[\e]0;\a\e[00;32m\]\t
    # My default: (space before PWD)
    #       PS1="\[\e]0;$  {PWD}\a\e[00;32m\]\t \[\e[00;33m\]\# \[\e[01;34m\]\w\[\033[0;33m\]\$(__git_ps1 \" %s \")\[\033[0m\]\[\e[01;36m\]\$\[\e[00m\] "
    # but let's skip the current time?
    #export PS1="\[\e[00;33m\]\# \[\e[01;34m\]\w\[\033[0;33m\] \[\033[1;32m\]Ty \[\033[0m\]\$(__git_ps1 \"%s\")\[\033[0m\]\[\e[01;36m\]\$\[\e[00m\] "
    #export PS1="\[\e[00;33m\]\# \[\e[01;34m\]\w\[\033[0;33m\] \[\033[1;32m\]Ty \[\e[00;33m\]\$(__git_ps1 \"%s\")\[\033[0m\]\[\e[01;36m\]\$\[\e[00m\] "
    export PS1="\[\e[00;32m\]\t \[\e[01;34m\]\w\[\033[0;33m\] \[\e[00;33m\]\$(__git_ps1 \"%s\" )\[\033[1;32m\] ty\[\033[0m\]\[\e[01;36m\]\$\[\e[00m\] "
    echo
    echo "Welcome to Talkyard's Nix shell."
    echo
  '';

}
