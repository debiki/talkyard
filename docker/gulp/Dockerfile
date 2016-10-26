FROM node:6.9.1

RUN npm install -g yarn gulp

COPY entrypoint.sh /opt/docker-entrypoint.sh
RUN  chmod ugo+x   /opt/docker-entrypoint.sh
ENTRYPOINT ["/opt/docker-entrypoint.sh"]

WORKDIR /opt/debiki/server/

CMD ["yarn install && gulp watch"]

