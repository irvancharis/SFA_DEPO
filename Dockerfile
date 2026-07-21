FROM node:20-alpine

WORKDIR /usr/src/app

COPY ENGGINE/package*.json ./ENGGINE/

RUN cd ENGGINE && npm install

COPY . .

WORKDIR /usr/src/app/ENGGINE

EXPOSE 3000

CMD ["node", "index.js"]
