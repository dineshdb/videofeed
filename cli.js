#!/bin/env node
import walk from "walkdir";
import Feed from "feed";
import { promises as fs } from "fs";
import {join, relative } from "path";
import {loadIndex, isVideo, extractEpisodeInformation} from "./index.js"
(async function() {
  try {
    let index = await loadIndex();
    let paths = await walk.sync("./");
    let videos = await Promise.all(
      paths.filter(isVideo).map(async p => {
        return await extractEpisodeInformation(p, index);
      })
    );

    videos.map(video => {
      let { url, thumbnail } = video;
      url = join(index.videofeed.baseUrl, relative(".", url));
      thumbnail = thumbnail
        ? join(index.videofeed.baseUrl, relative(".", thumbnail))
        : thumbnail;
      return Object.assign(video, { link: url, image: thumbnail });
    });

    let feed = new Feed.Feed(
      Object.assign(index.videofeed, {
        updated: new Date(),
        generator: "https://github.com/dineshdb/videofeed",
        link: index.videofeed.baseUrl,
        image: index.videofeed.baseUrl + "/favicon.png",
        favicon: index.videofeed.baseUrl + "/favicon.png",
        feedLinks: {
          json: index.videofeed.baseUrl + "/feed.json"
        }
      })
    );

    videos.forEach(feed.addItem);
    index.videofeed.categories.forEach(feed.addCategory);

    await Promise.all([
      fs.writeFile("feed.rss", feed.rss2()),
      fs.writeFile("feed.json", feed.json1())
    ]);
  } catch (e) {
    console.log(e);
  }
})();