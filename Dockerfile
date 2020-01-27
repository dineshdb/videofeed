FROM node
RUN apt update && apt install -y ffmpeg
COPY . /app
WORKDIR /app
RUN npm i
WORKDIR /repo
CMD ["/usr/local/bin/node", "/app/cli.js"]