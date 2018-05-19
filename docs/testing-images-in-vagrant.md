
Maybe you want to build a Docker image and test it in Vagrant without pushing to Docker's public
image repository. To do this, start your own test Docker repository, on localhost:

    sudo docker run -d -p 5000:5000 --name myregistry registry:2
    
This starts a container named `myregistry`, which runs Docker's `registry:2` image.

Now, edit the `version.txt` file to indicate it's a test version: append `-test`.
Then build all Talkyard images: run `s/release.sh`.

(If for some reason you want to skip the end-to-end tests, comment out the `runAllE2eTests`
line in `s/run-e2e-tests.sh`.)

But don't publish to the official Docker repository — hit CTRL+C when the script asks
*"Publish to the official Docker image registry?"*.

Then tag them prefixed with 'localhost:5000' — because when the first part of the tag
is a hostname and port, Docker interprets this as the location of a registry, when pushing.
(See: https://docs.docker.com/registry/deploying/#copy-an-image-from-docker-hub-to-your-registry)

    sudo docker tag debiki/talkyard-web localhost:5000/talkyard-web:latest
    sudo docker tag debiki/talkyard-app localhost:5000/talkyard-app:latest
    sudo docker tag debiki/talkyard-cache localhost:5000/talkyard-cache:latest
    sudo docker tag debiki/talkyard-search localhost:5000/talkyard-search:latest
    sudo docker tag debiki/talkyard-rdb localhost:5000/talkyard-rdb:latest
    sudo docker tag debiki/talkyard-certgen localhost:5000/talkyard-certgen:latest

(To list the images and better understand how you just tagged them:
`sudo docker images | egrep 'localhost:5000|-test-'`)

Then you can push to your local registry:

    sudo docker push localhost:5000/talkyard-web:latest
    sudo docker push localhost:5000/talkyard-app:latest
    sudo docker push localhost:5000/talkyard-cache:latest
    sudo docker push localhost:5000/talkyard-search:latest
    sudo docker push localhost:5000/talkyard-rdb:latest
    sudo docker push localhost:5000/talkyard-certgen:latest

Start a virtual machine in Vagrant, see `../modules/ed-prod-one-test/scripts/Vagrantfile`
— but do things a bit differently:

 - Step 4: When you `ssh` into the Vagrant vm, instead of `vagrant ssh`, do:
   `vagrant ssh -- -R 5000:localhost:5000`. This will let you access your local Docker repository,
   from inside the Vagrant vm.

 - Step 5, *"follow the instructions in README.md"*: after you'v cloned the Git repo,
   edit `.env`:

    - Set `VERSION_TAG=latest`.
    - Set `DOCKER_REPOSITORY=localhost:5000` (instead of `debiki`).
    - Instead of running `upgrade-if-needed.sh`, do: `docker-compose up -d`
    - You can skip the *"Schedule ... backups ... deletion ... log files ... upgrades"* step.

And, lastly, point your browser to http://localhost:8080.

