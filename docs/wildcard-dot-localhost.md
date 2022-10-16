Making \*.localhost addresses work
=============================

The e2e tests generate website addresses like: `e2e-test-site-random_id.localhost` and we need
to make them resolve to localhost, 127.0.0.1.

Chrome seems to handle `*.localhost` addresses in a good way, i.e. it sends the HTTP request
to 127.0.0.1. However, for other browsers, and for test suites that send API requests
outside the browser, we need to make `*.localhost` addresses work (resolve to localhost).

Try this: `ping abc.localhost`, probably it won't work — yet.

It'd been great if we could just have added a `127.0.0.1  *.localhost` entry to `/etc/hosts`,
But wildcard `/etc/hosts` entries are not allowed. Instead, we can ...



Linux
-----------------------------


Use dnsmasq (see http://serverfault.com/a/118589/44112 ).

#### Linux Mint and Ubuntu

NetworkManager already runs its own instance of
dnsmasq. You can make `*.localhost` work like so: (do this only once)

    echo 'address=/localhost/127.0.0.1' | sudo tee -a /etc/NetworkManager/dnsmasq.d/wildcard.localhost.conf

Then restart NetworkManager:

    sudo service network-manager restart

    # Hmm seems now it's instead: (Debian 11)
    sudo systemctl restart NetworkManager

Wait half a minute, then this should work: `ping whatever.localhost`.

#### Debian

1\. Add `wildcard.localhost.conf` as described in the Ubuntu section just above.
2\. Tell NetworkManager to use dnsmasq:

```
sudo tee /etc/NetworkManager/conf.d/00-use-dnsmasq.conf << 'EOF'

# Start a local dnsmasq DNS server that we can configure to resolve *.localhost.
[main]
dns=dnsmasq
EOF
```

#### Qubes OS, Debian 11 Standalone VM

Assuming you use a stand-alone Debian qube (i.e. VM) for developing
Talkyard, then, **follow the instructions** for **Debian** (!) just above.

And, you also need to tell Qubes OS to actually start NetworkManager
in the qube — starting it from
inside the qube itself won't work. In dom0, do this:

    qvm-service --enable YOUR_DEBIAN_QUBE_NAME network-manager
    qvm-service YOUR_DEBIAN_QUBE_NAME network-manager on   #  ?

And apparently you need to reboot the qube too.

#### Qubes OS, Debian 11 AppVM

In the relevant Debian 11 TemplateVM:

- Add the file `/etc/NetworkManager/dnsmasq.d/wildcard.localhost.conf` ans shown in the Ubuntu section above.
- Add the file `/etc/NetworkManager/conf.d/00-use-dnsmasq.conf` ans shown in the Debian section above.

In dom0, type this: (type, since you cannot cross-VM-paste to dom0)

    qvm-service --enable YOUR_APPVM_QUBE_NAME network-manager
    qvm-service YOUR_APPVM_QUBE_NAME network-manager on
    # It worked? Should show:  network-manager  on
    qvm-service YOUR_APPVM_QUBE_NAME

Shut down the TemplateVM. Restart the AppVM.

### Afterwards

(Do this in the AppVM if you're using a Qubes AppVM.)

This should show NetworkManager running: `sudo systemctl status NetworkManager` — this text should appear: `Active: active (running)`.

Also, try this again: `ping abc.localhost` — should work now.


Mac
-----------------------------

Use dnsmasq (see http://serverfault.com/a/118589/44112 ).

I don't have a Mac, but this supposedly works:

    sudo port install dnsmasq

    vi /opt/local/etc/dnsmasq.conf # edit it, ...
    # ... add the following line: (without the #)
    # address=/localhost.com/127.0.0.1

    # then:
    sudo port load dnsmasq


Windows
-----------------------------

I don't know. Ideas welcome
