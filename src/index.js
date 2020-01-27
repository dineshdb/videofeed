import {promises as fs} from "fs"
import toml from "toml";
import { join } from "path";
import walk from "walkdir"
import Episode from "./episode.js"

const reverse = p =>
  new Promise((resolve, reject) => Promise.resolve(p).then(reject, resolve));
Promise.any = arr => reverse(Promise.all(arr.map(reverse)));

export default class Index {
    constructor(root = "."){
        this._root = root
        this._episodes = []
    }

    get episodes(){
        return this._episodes
    }

    async loadIndex() {
        let contents = await fs.readFile(join(this._root, "index.toml"))
        this._index = Object.assign(this.config, toml.parse(contents))
    }

    async loadEpisodes() {
        let episodes = []
        let paths = await walk.async(join(this._root, "data"), {
            return_object:true,
            no_recurse: true
        })
        for(let key in paths) {
            if(paths[key].isDirectory()) {
                episodes.push(new Episode(key, this._index))
            }
        }

        this._episodes = episodes
    }

    async items() {
        await this.loadIndex()
        await this.loadEpisodes()
        let links = await Promise.all(this._episodes.map(episode => episode.scanVideos()))
        links = links.flat()
        return links
    }

    static get default(){
        let link = "https://example.com"
        return {
            title: "Example Feed",
            categories: [],
            link,
            description: "Add some description"
        }
    }

    get config() {
        let updatedConfig = Object.assign(Index.default, this._index)
        return Object.assign(updatedConfig, {
            "media:rating" :{
                "@scheme": "urn:simple",
                "#text": "nonadult"
            }
        })
    }
}