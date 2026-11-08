FROM node:22-alpine
WORKDIR /app
COPY server.mjs index.html sw.js manifest.webmanifest ./
COPY icon-192.png icon-512.png icon-maskable-512.png ./
ENV HOST=0.0.0.0 PORT=8796 FQ_DATA=/data
EXPOSE 8796
USER node
CMD ["node", "server.mjs"]
