Building your own images and testing in Vagrant
---

Maybe you want to build Docker images yourself and test in Vagrant without pushing to any public
Docker image repository. To do this, start your own test Docker repository, on localhost:

```
sudo docker run -d -p 5000:5000 --name myregistry registry:2
```

This starts a container named `myregistry`, which runs Docker's `registry:2` image.

Now, edit `.env`, add these lines: (they're read by `s/build-and-release.sh`)

```
PUSH_TO_DOCKER_REPOSITORY=localhost:5000
PUSH_TO_DOCKER_TAG=latest
```

Don't forget to comment out the `PUSH_TO_DOCKER_TAG`, if later on you want to release
a real version — then, the tag name gets constructed automatically, from the
contents of the `version.txt` file and Git revision. Actually, it's a good idea to edit
the `version.txt` file: append `-test` to indicate you're building a test version
 — in case you somehow manage to push to the wrong repo: the upgrade scripts
 ignores *test* versions.

If for some reason you want to skip the end-to-end tests, comment out the `runAllE2eTests`
line in `s/run-e2e-tests.sh`.

Then build the Talkyard images and push to your local repository:

```
s/build-and-release.sh`.
```

(To list the images and better understand how they got tagged:
`sudo docker images | egrep 'localhost:5000|-test-'`)


Next, start a virtual machine in Vagrant, see & read `../modules/ed-prod-one-test/scripts/Vagrantfile`
— but do things a bit differently:

 - Step 4: When you `ssh` into the Vagrant vm, instead of `vagrant ssh`, do:
   `vagrant ssh -- -R 5000:localhost:5000`. This will let you access your local Docker repository,
   from inside the Vagrant vm.

 - Step 5, *"follow the instructions in README.md"*: after you've cloned the Git repo,
   edit `.env`:

    - Set `VERSION_TAG=latest`.
    - Set `DOCKER_REPOSITORY=localhost:5000` (instead of `debiki`).
    - Instead of running `upgrade-if-needed.sh`, do: `docker-compose up -d`
    - You can skip the *"Schedule ... backups ... deletion ... log files ... upgrades"* step.

And, lastly, point your browser to http://localhost:8080.

