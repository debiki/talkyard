{
  description = "Talkyard's dev env Nix flake. Install Nix and type 'nix develop'.";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-24.11";
  };

  outputs = { self , nixpkgs ,... }: let
    system = "x86_64-linux";
    pkgs = import nixpkgs { inherit system; };
  in {
    devShells."${system}" = {
      default = let
      in pkgs.mkShell {
        packages = with pkgs; [
          ripgrep

          # Webdriver.io supports only LTS versions. 22 is an LTS, 23 is not.
          # 24 is, but not yet available in Nix.
          nodejs_22

          deno
          (yarn.override { nodejs = nodejs_22; })  # what's Yarn's default Nodejs?
          #yarn  # or just this?
          gnumake
        ];

        shellHook = ''
          export PS1="\[\e[00;32m\]\t \[\e[01;34m\]\w\[\033[0;33m\] \[\e[00;33m\]\$(__git_ps1 \"%s\" )\[\033[1;32m\] ty\[\033[0m\]\[\e[01;36m\]\$\[\e[00m\] "
          echo
          echo "Welcome to Talkyard's Nix flake shell dev env."
          echo
        '';
      };
    };
  };
}

