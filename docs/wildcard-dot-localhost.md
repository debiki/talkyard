Making *.localhost addresses work
-----------------------------

Chrome seems to handle `*.localhost` addresses in a good way, i.e. it sends the HTTP request
to 127.0.0.1. However, for other browsers, and perhaps for the security test suite,
you need to somehow make `*.localohst` addresses work.

Why? Because the tests generates website addresses like: `e2e-test-site-random_id.localhost`.

It'd been great if we could just have added a `127.0.0.1  *.localhost` entry to `/etc/hosts`,
But wildcard `/etc/hosts` entries are not allowed. Instead, we can ...


#### Linux (and Mac?)

Use dnsmasq, see http://serverfault.com/a/118589/44112

*On Linux Mint (and Ubuntu?)*, Network Manager already runs its own instance of
dnsmasq. You can make `*.localhost` work like so: (do this only once)

    sudo sh -c 'echo "address=/localhost/127.0.0.1" >> /etc/NetworkManager/dnsmasq.d/wildcard.localhost.conf'

Then restart Network Manager:

    sudo service network-manager restart

Wait half a minute, then this should work: `ping whatever.localhost`.


