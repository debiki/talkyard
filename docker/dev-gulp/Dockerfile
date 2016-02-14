FROM node:5

RUN npm install -g bower gulp

COPY entrypoint.sh /opt/docker-entrypoint.sh
RUN  chmod ugo+x   /opt/docker-entrypoint.sh
ENTRYPOINT ["/opt/docker-entrypoint.sh"]

COPY install-and-watch.sh /opt/install-and-watch.sh
RUN  chmod ugo+x          /opt/install-and-watch.sh

WORKDIR /opt/debiki/server/

CMD ["npm install && bower install && gulp watch"]

