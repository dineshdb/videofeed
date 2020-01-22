import { promises as fs } from "fs";
import toml from "toml";
import { basename, dirname, extname, join, relative } from "path";
import { promisify } from "util";
import { exec } from "child_process";

let execAsync = promisify(exec);
// Promise.any polyfill
const reverse = p =>
  new Promise((resolve, reject) => Promise.resolve(p).then(reject, resolve));
Promise.any = arr => reverse(Promise.all(arr.map(reverse)));

export async function loadIndex() {
  let tomlString = await fs.readFile("videofeed.toml", "utf8");
  return Object.assign(
    {
      videofeed : {
        baseUrl : "https://example.com",
        title: "Example Video Feed",
        description: "Example Description"
      },
      thumbnail: {
        generate: true,
        captureAt: 200
      }
    },
    toml.parse(tomlString)
  );
}

export function isVideo(path) {
  const videoTypes = [".mkv", ".mp4", ".mov", ".webm", ".avi", ".flv", ".wmv"];
  let ext = path.substr(path.lastIndexOf("."));
  return videoTypes.includes(ext);
}

export function generateThumbnail(episode, baseUrl, captureAt) {
  let thumbnail = baseUrl + ".jpg";
  console.info("Generating thumbnail for ", episode.url);
  let cmd = `ffmpeg -i ${episode.url} -ss ${captureAt} -vframes 1 ${thumbnail}`;
  return execAsync(cmd).then(() => thumbnail);
}

// For each video, identify it's subtitle, thumbnail and description file.
export async function extractEpisodeInformation(videoFile, index) {
  let dir = dirname(videoFile);
  let base = basename(videoFile);
  let ext = extname(videoFile);
  let nameOnly = base.replace(new RegExp(ext + "$"), "");
  let baseUrl = join(dir, nameOnly);

  let episode = {
    url: videoFile,
    captureAt: index.thumbnail.captureAt || 200
  };

  try {
    let contents = await fs.readFile(baseUrl + ".toml", "utf8");
    episode = Object.assign(episode, toml.parse(contents));
  } catch (e) {
    episode = Object.assign(episode, {
      title: titleCase(nameOnly)
    });
  }

  let thumbnail = await getThumbnail(baseUrl).catch(e => null);
  if (index.thumbnail.generate && thumbnail === null) {
    thumbnail = await generateThumbnail(
      episode,
      baseUrl,
      episode.captureAt
    ).catch(e => null);
  }

  return Object.assign(episode, { thumbnail });
}

export async function checkExists(file) {
  await fs.stat(file);
  return file;
}

export function getThumbnail(file) {
  const thumbnailTypes = [".png", ".jpg", ".jpeg",".webp"];
  return Promise.any(thumbnailTypes.map(ext => checkExists(file + ext)));
}

export function titleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map(function(word) {
      return word.replace(word[0], word[0].toUpperCase());
    })
    .join(" ");
}
