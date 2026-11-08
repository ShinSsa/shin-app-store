FROM node:22-alpine
WORKDIR /app
COPY server.mjs ramotion.html ./
COPY icon.png ./
ENV HOST=0.0.0.0 PORT=8790 RAMOTION_DATA=/data
EXPOSE 8790
USER node
CMD ["node", "server.mjs"]
