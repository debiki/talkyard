Making *.localhost addresses work
-----------------------------

Chrome seems to handle `*.localhost` addresses in a good way, i.e. it sends the HTTP request
to 127.0.0.1. However, for other browsers, and for test suites that send API requests
outside the browser, you need to make `*.localohst` addresses work (resolve to localhost).

Why? Because the tests generates website addresses like: `e2e-test-site-random_id.localhost`.

It'd been great if we could just have added a `127.0.0.1  *.localhost` entry to `/etc/hosts`,
But wildcard `/etc/hosts` entries are not allowed. Instead, we can ...


#### Linux

Use dnsmasq (see http://serverfault.com/a/118589/44112 ).

**Linux Mint and Ubuntu:** NetworkManager already runs its own instance of
dnsmasq. You can make `*.localhost` work like so: (do this only once)

    sudo sh -c 'echo "address=/localhost/127.0.0.1" >> /etc/NetworkManager/dnsmasq.d/wildcard.localhost.conf'

Then restart NetworkManager:

    sudo service network-manager restart

Wait half a minute, then this should work: `ping whatever.localhost`.

**Debian:** Like Ubuntu, plus, you need this, to tell NetworkManager to use dnsmasq:

    $ cat /etc/NetworkManager/conf.d/00-use-dnsmasq.conf

    # Start a local dnsmasq DNS server that we can configure to resolve *.localhost.
    # On Ubuntu, Netw-Mgr uses dnsmasq by default, but on Debian, we need this:
    [main]
    dns=dnsmasq

**Qubes OS:** Assuming you use a stand-alone Debian qube (i.e. VM) for developing
Talkyard, then, follow the instructions for Debian just above. And, you also need
to tell Qubes OS to actually start NetworkManager in the qube — starting it from
inside the qube itself won't work. In dom0, do this:

    qvm-service --enable YOUR_DEBIAN_QUBE_NAME network-manager

And apparently you need to reboot the qube too.


#### Mac

Use dnsmasq (see http://serverfault.com/a/118589/44112 ).

I don't have a Mac, but this supposedly works:

    sudo port install dnsmasq

    vi /opt/local/etc/dnsmasq.conf # edit it, ...
    # ... add the following line: (without the #)
    # address=/localhost.com/127.0.0.1

    # then:
    sudo port load dnsmasq


#### Windows

I don't know. Ideas welcome
