FROM node:20-alpine as builder

ENV NODE_ENV build

WORKDIR /home/node

COPY package*.json ./
RUN npm install --no-optional

# Temporarily switch to root to install global packages
USER root
RUN npm install -g @nestjs/cli
USER node

COPY --chown=node:node . .
RUN npm run build

# ---

FROM node:20-alpine

ENV NODE_ENV production

USER node
WORKDIR /home/node

COPY --from=builder --chown=node:node /home/node/package*.json ./
COPY --from=builder --chown=node:node /home/node/node_modules/ ./node_modules/
COPY --from=builder --chown=node:node /home/node/dist/ ./dist/

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT 8080

# Expose the port the app runs on
EXPOSE 8080

CMD ["npm", "run", "start:prod"]
