FROM node:22 AS build

WORKDIR /app

RUN apt-get update -y && apt-get upgrade -y



COPY . .

COPY package* .


RUN npm install

RUN npm run build

FROM node:alpine AS production

WORKDIR /app

ENV NODE_ENV production

RUN apk add --no-cache git

COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app/package.json

RUN npm install --omit=dev

FROM --platform=amd64 build as dev

ENTRYPOINT [ "npx" ]

CMD [ "nest","start" ]
