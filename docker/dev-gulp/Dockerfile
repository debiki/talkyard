FROM node:5

RUN npm install -g bower gulp

COPY entrypoint.sh /opt/docker/entrypoint.sh
RUN  chmod ugo+x   /opt/docker/entrypoint.sh
ENTRYPOINT ["/opt/docker/entrypoint.sh"]

COPY npm-bower-install.sh /opt/docker/npm-bower-install.sh
RUN  chmod ugo+x          /opt/docker/npm-bower-install.sh

WORKDIR /opt/debiki/server/

CMD gulp watch

