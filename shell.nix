#{ pkgs ? import <nixpkgs> {} }:

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
