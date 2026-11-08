FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=8792 CURSOS=/cursos DADOS=/dados TZ=America/Bahia
EXPOSE 8792
USER node
CMD ["node", "server.js"]
