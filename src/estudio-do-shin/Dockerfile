FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY server.mjs estudio-do-shin.html mcp.mjs ./
ENV HOST=0.0.0.0 PORT=8787 SHIN_DATA=/data
EXPOSE 8787
USER node
CMD ["node", "server.mjs"]
