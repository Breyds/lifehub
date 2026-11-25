FROM node:22-alpine
WORKDIR /app
COPY electron/ ./electron/
COPY server/telegram-server.cjs ./server/telegram-server.cjs
ENV PORT=8080 LIFEHUB_STATE_FILE=/data/telegram.json
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
CMD ["node","server/telegram-server.cjs"]
