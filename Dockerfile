FROM node:lts-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.js ./

ENV ZOHO_CLIENT_ID=placeholder
ENV ZOHO_CLIENT_SECRET=placeholder
ENV ZOHO_REFRESH_TOKEN=placeholder
ENV ZOHO_ACCOUNT_ID=placeholder
ENV ZOHO_SENDER=placeholder@example.com

CMD ["node", "index.js"]
