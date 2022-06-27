Getting Talkyard up and running
=============================


#### Before you start

As operating system, you can use Debian 10 or 11 or Ubuntu 20.04.

You need about 6 GB RAM for the development environment (whereas the production environment needs about 2 GB).
And an internet connection — you'll download perhaps 1 GB Docker images and other files.

Install Docker and Docker-Compose, see: https://docs.docker.com/compose/install/.
On Linux, you can:

```
sudo -i
curl -fsSL https://get.docker.com -o install-docker.sh
sh install-docker.sh
curl -L "https://github.com/docker/compose/releases/download/1.28.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version  # should print "docker-compose version ... build ..."
```

Read [A brief intro to Docker-Compose](./intro-to-docker-compose.md) — unless you know
how to use docker-compose already.


#### The instructions


1. Append some settings to the system config, so ElasticSearch will work.
   ElasticSearch will get downloaded later, in a Docker image (don't install it yourself).
   — Run this as one single command, not one line at a time:

       sudo tee -a /etc/sysctl.conf <<EOF

       ###################################################################
       # Talkyard settings

       # Up the max backlog queue size (num connections per port), default = 128
       net.core.somaxconn=8192

       # ElasticSearch requires (at least) this, default = 65530
       # Docs: https://www.kernel.org/doc/Documentation/sysctl/vm.txt
       vm.max_map_count=262144

       # VSCode and IntelliJ Idea want to watch many files — without this, there'll be
       # a "Unable to watch for file changes in this large workspace" error in VSCode.
       # Also an "User limit of inotify watches reached" error can happen, when
       # tailing logs, if too few watches. (The default is sometimes only 8192.)
       fs.inotify.max_user_watches=524288
       EOF

    Reload the system config:

       sudo sysctl --system

1. You need Git, Make, cURL, `jq` for viewing logs, `gpg2` for checking signatures,
    and a file change notifier:  (hmm maybe use `gpg` instead, it's the same as gpg2
    at least in Debian 11?)

    ```
    sudo apt install git make curl jq gpg gnupg2 inotify-tools
    ```

1.  Install the Nix package manager 2.5.1 or a later 2.x,
    see https://nixos.org/download.html#nix-verify-installation.
    Nix gives you all build tools, no need to modify your host OS.
    For example, Nodejs 14. And later, Deno, and Rust build stuff.

    Get the installation script and signature:

    ```
    curl -o install-nix-2.5.1      https://releases.nixos.org/nix/nix-2.5.1/install
    curl -o install-nix-2.5.1.asc  https://releases.nixos.org/nix/nix-2.5.1/install.asc
    ```

    Import the public signing key:
    ```
    # Try this:
    gpg2 --keyserver hkps://keyserver.ubuntu.com --recv-keys B541D55301270E0BCF15CA5D8170B4726D7198DE

    # If that won't work, the key is in the vendors/ dir:
    gpg2 vendors/nixos-signing-pub-key.gpg
    # should print:  B541D55301270E0BCF15CA5D8170B4726D7198DE
    # then:
    gpg2 --import vendors/nixos-signing-pub-key.gpg
    ```

    Verify the signature — this should say "Good signature", and print:
    `Primary key fingerprint: B541 D553 0127 0E0B CF15  CA5D 8170 B472 6D71 98DE`:

    ```
    gpg2 --verify ./install-nix-2.5.1.asc
    ```

    Install Nix: (and, optionally, Niv) (this'll run sudo for you)

    ```
    sh ./install-nix-2.5.1

    # nix-env -iA nixpkgs.niv  # optionally, if you want to upgrade Ty's build tools
    ```

    (To uninstall Nix, remove `/nix`, a line in `~/.profile`, and:
    `~/{.nix-channels,.nix-defexpr,.nix-profile,.config/nixpkgs}`)


1. Clone the Talkyard repository:

    ```
    git clone https://github.com/debiki/talkyard.git talkyard
    cd talkyard
    ```

1. Download dependencies — they're in Git submodules:
    (this might take long — you'll be downloading about 1 GB files)

    ```
    git submodule update --init
    ```

1. Start Talkyard: (`s/tyd` is a Talkyard development helper script)

    ```
    s/tyd up
    ```

    And have a coffee — it takes a while before Talkyard starts the first time:
    Typescript, Stylus and Scala code gets compiled and packaged, Docker images get built.
    To view log messages, type `s/tyd logs -f` (or `docker-compose logs -f`).

    Wait for these "Server started" log messages to appear:

        app_1  |
        app_1  | --- (Running the application, auto-reloading is enabled) ---
        app_1  |
        app_1  | [info] p.c.s.NettyServer - Listening for HTTP on /0:0:0:0:0:0:0:0:9000
        app_1  | [info] p.c.s.NettyServer - Listening for HTTPS on /0:0:0:0:0:0:0:0:9443
        app_1  |
        app_1  | (Server started, use Ctrl+D to stop and go back to the console...)
        app_1  |


1. Point your browser to http://localhost/. This sends a request to the Docker container
   named 'web', in which Nginx listens on port 80. Nginx sends the request to Play Framework
   in the 'app' container, port 9000. Play Framework then starts compiling more Scala files — this
   take a little while; the browser might show a 502 Bad Gateway error message.

   Soon, when done compiling, Play Framework will start. Then this gets logged:

       app_1  | [info] application - Starting... [TyMHELLO]
       ...
       ...
       app_1  | [info] application - Started. [TyMSTARTED]

   If you don't see these messages (maybe they scroll past too fast), you can
   continue with the next step just below anyway — just keep reloading the browser page until
   any "is starting" message in the browser window disappears.


1. Create a forum

   Reload the browser at http://localhost/. A page with a button should appear.
   Sign up as admin with this email: `admin@example.com` (must be that email).
   As username and password you can type `admin` and `public1234`.

<!-- Not needed any longer.
   You'll be asked to confirm your email address, by clicking a link in an email
   that was sent to you — but in fact the email couldn't be sent, because you haven't configured
   any email server, and `admin@example.com` isn't your address anyway.

   Instead look at the log messages. (Run `sudo docker-compose logs app` if you've closed
   the terminal with log messages.) There you'll find
   the email — it's written to the log files, in development mode. Copy the
   confirmation link from the `<a href=...>` and paste it in the browser's address bar.
   -->

Shut down everything like so: `s/tyd kill`. (To remove all containers: `s/tyd down`.)




Troubleshooting
-----------------------------

See [tips.md](./tips.md).



Talkyard development
-----------------------------

Continue here: [developing-talkyard.md](./developing-talkyard.md).
