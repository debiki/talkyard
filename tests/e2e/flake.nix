{
  description = "For running Talkyard's old Webdriverio 6 tests (haven't been ported to Wdio 9)";

  inputs = {
    # Here you'll find Nodejs 14.
    nixpkgs.url = "github:nixos/nixpkgs/nixos-22.11";
  };

  outputs = { self , nixpkgs ,... }: let
    system = "x86_64-linux";
    pkgs = import nixpkgs { inherit system; };
  in {

    devShells."${system}" = {
      default = let
      in pkgs.mkShell {
        packages = with pkgs; [
          # Later versions of Nodejs doesn't work w Webdriverio 6, at least >= 20 doesn't.
          nodejs-14_x
          deno
          yarn
          gnumake
        ];

        shellHook = ''
          export PS1="\[\e[00;32m\]\t \[\e[01;34m\]\w\[\033[0;33m\] \[\e[00;33m\]\$(__git_ps1 \"%s\" )\[\033[1;32m\] ty\[\033[0m\]\[\e[01;36m\]\$\[\e[00m\] "
          echo
          echo "Welcome to Talkyard's Webdriverio 6 Nix shell."
          echo
        '';
      };
    };
  };
}

