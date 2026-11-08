FROM node:22-alpine
WORKDIR /app
COPY server.mjs index.html manifest.json ./
COPY icon-192.png icon-512.png apple-touch-icon.png ./
ENV HOST=0.0.0.0 PORT=8794 FEIRA_DATA=/data
EXPOSE 8794
USER node
CMD ["node", "server.mjs"]
