import { promises as fs } from "fs";
import toml from "toml";
import { basename, dirname, extname, join, relative } from "path";
import { promisify } from "util";
import { exec } from "child_process";
import walk from "walkdir"
import mediainfo from 'node-mediainfo';


let execAsync = promisify(exec);
// Promise.any polyfill
const reverse = p =>
  new Promise((resolve, reject) => Promise.resolve(p).then(reject, resolve));
Promise.any = arr => reverse(Promise.all(arr.map(reverse)));

const datePattern = /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))/

export default class Episode {
    constructor(root, options) {
        this.link = root
        this._extractTitle()
        this._options = Object.assign({
            thumbnail : {
                capture: false,
                captureAt: 2,
            }
        }, options)
    }

    _extractTitle() {
        let title = basename(this.link)
        let lastIndex = title.lastIndexOf(" ")
        if(lastIndex === -1) {
            this.title = this._dirname
        } else {
            let date = title.substring(lastIndex + 1)
            let isDate = datePattern.test(date)
            if(isDate) {
                this.published = new Date(date.trim())
                this.date = this.published
                this.title = title.substr(0, lastIndex).trim()
            } else {
                this.title = title.trim()
            }
        }
    }

    async loadIndex() {
        let contents = await fs.readFile(join(this._root, "index.toml")).catch(e => "")
        Object.assign(this, this.config, toml.parse(contents))
    }

    async loadVideoInfo(file){
        let {published} = this
        let info = {
            published,
        }
        try {
            let videoContents = await fs.readFile(file.replace(ext, ".toml"))
            return Object.assign(info, toml.parse(videoContents))
        } catch(e) {
            return info
        }
    }

    async scanVideos() {
        let clips = []
        let videos = await walk.async(this.link, {
            return_object:true,
            no_recurse: true
        })
        for(let file in videos) {
            if(videos[file].isFile() && this.isVideo(file)) {
                let base = basename(file);
                let ext = extname(file);
                let nameOnly = base.substr(0, base.length - ext.length)        
                let image = await this.getThumbnail(file)
                let title = titleCase( `${nameOnly}`)

                let videoInfo = await this.loadVideoInfo(file.replace(ext, ".toml"))
                videoInfo.published = (videoInfo.published ? videoInfo.published : videos[file].mtime).getTime() + clips.length * 1000
                
                const info = await mediainfo(file);

                clips.push(Object.assign({}, videoInfo, {
                    link: file,
                    pubDate: new Date(videoInfo.published),
                    image,
                    title,
                    enclosure : {
                        "@type": "video/" + ext.replace(".", ""),
                        "@length" : videos[file].size,
                        "@duration": Number.parseInt(info.media.track[0]["Duration"])
                    }
                }))
            }
        }
        return clips
    }
    
    async getThumbnail(file) {
        let base = basename(file);
        let ext = extname(file);
        let nameOnly = base.substr(0, base.length - ext.length)
        let baseUrl = join(dirname(file), nameOnly)
        return this.getExistingThumbnail(baseUrl).catch(e => {
            if (this._options.thumbnail.capture) {
                return this.generateThumbnail(
                    file,
                    baseUrl,
                    this._options.thumbnail.captureAt
                ).catch(e => {
                    console.log("Error generating thumbnail for", file)
                });
            }
            return null
        })
    }

    getExistingThumbnail(path){
        const thumbnailTypes = [".png", ".jpg"];
        return Promise.any(thumbnailTypes.map(ext => checkExists(path + ext)))
    }


    isVideo(path) {
        const videoTypes = [".mkv", ".mp4", ".mov", ".webm", ".avi", ".flv", ".wmv"];
        let ext = path.substr(path.lastIndexOf("."));
        return videoTypes.includes(ext);      
    }

    generateThumbnail(videoFile, baseUrl, captureAt) {
        let thumbnail = baseUrl + ".jpg";
        console.info("Generating thumbnail for ", videoFile);
        let cmd = `ffmpeg -i '${videoFile}' -ss ${captureAt} -vframes 1 '${thumbnail}'`;
        return execAsync(cmd).then(() => thumbnail);
    }
            
    async items() {
        this.loadIndex()
        let clips = await this.scanVideos()
    }
}

export async function checkExists(file) {
  await fs.stat(file);
  return file;
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
