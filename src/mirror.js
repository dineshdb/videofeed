import { promises as fs, ReadStream } from "fs";
import {join, relative , extname, basename} from "path";
import crypto from "crypto"
import xmlbuilder from "xmlbuilder"
import Minio from "minio"

export default class Mirror {
    constructor(repo) {
        this.repo = repo
        this.mirror = join(repo, ".mirror")
        this.items = []
    }

    async init(){
        await fs.mkdir(this.mirror).catch(e => {
            if(e.code === "EEXIST") {

            } else {
                throw new Error(e)
            }
        })
    }

    silentLink(e){
        if(e.code === "EEXIST"){
            
        } else {
            throw new Error(e)
        }
    }

    async addEpisode(episode){
        try {
            let ext = extname(episode.link)
            let filehash = await this.fileHash(episode.link)
            let newFile = join(this.mirror, filehash) + ext
            await fs.link(episode.link, newFile).catch(this.silentLink)
            episode.link = relative(this.mirror, newFile)
            episode.guid = filehash
            if(episode.image){
                let thumbHash = await this.fileHash(episode.image)
                let thumbext = extname(episode.image)
                console
                let thumbFile = join(this.mirror, thumbHash + thumbext)
                await fs.link(episode.image, thumbFile).catch(this.silentLink)
                episode.image = relative(this.mirror, thumbFile)
            }
        } catch(e) {
            console.log("Error adding episode ", e)
        }
        this.items.push(episode)
    }

    fileHash(filename, algorithm = 'sha256') {
        console.info("Hashing ", relative(this.repo,filename))
        return new Promise((resolve, reject) => {
            let shasum = crypto.createHash(algorithm);
            try {
               let s = ReadStream(filename)
               s.on('data', data => shasum.update(data))
               s.on('end', () => resolve(shasum.digest('hex')))
            } catch (error) {
                return reject('calc fail' + filename + error);
            }
        });
    }

    async feed(meta) {
        meta = Object.assign(meta, {
            item: [],
            thumbnail: null,
            remote: null,
        })

        this.items.forEach(item => {
            let link = `${meta.link}/${item.link}`
            meta.item.push(Object.assign({
                description: "",
            }, item, {
                link,
                "media:thumbnail": {
                    "@url": `${meta.link}/${item.image}`,
                    "@width"  : 1360,
                    "@height": 720,
                },
                'media:content': Object.assign({}, item.enclosure, {
                    "@fileSize" : item.enclosure["@length"],
                    "@url" : link,
                    "@length": null,
                    "@width"  : 1360,
                    "@height": 720,
                    "@id": item.guid,
                    "media:copyright":"BBC",
                    "media:title": item.title,
                    'media:description': "",
                    "media:thumbnail": {
                        "@url": `${meta.link}/${item.image}`,
                        "@width"  : 1360,
                        "@height": 720,
                    },    
                }),
                "content:encoded": item.title,
                'itunes:summary': item.description,
                'itunes:duration': item.enclosure["@duration"],
                guid: {
                    "@isPermaLink": false,
                    "#text": `urn:bbc:podcast:${item.guid}`,
                },
                'ppg:canonical': link,
                enclosure: Object.assign({}, item.enclosure, {
                    "@url" : link,
                    '@duration': null    
                }),
                pubDate: item.pubDate.toUTCString().substr(5),
                // Artifact removal
                type: null,
                image: null
            }))
        })
        let f = {
            'rss' : {
                "@xmlns:media": 'http://search.yahoo.com/mrss/',
                "@xmlns:itunes": 'http://www.itunes.com/dtds/podcast-1.0.dtd',
                '@xmlns:atom': 'http://www.w3.org/2005/Atom',
                "@xmlns:ppg": "http://bbc.co.uk/2009/01/ppgRss",
                "@xmlns:content": "http://purl.org/rss/1.0/modules/content/",
                '@version': '2.0',
                'itunes:summary': "Summary",
                'itunes:author': "Author",
                'itunes:owner' : {
                    'itunes:name' : 'BBC',
                    'itunes:email': "",
                },
                'language': 'en',
                'channel': Object.assign({}, {
                    "atom:link" :{
                        "@href"  :meta.link + "/feed.rss",
                        "@rel": "self",
                        "@type": "application/rss+xml"                                    
                    },
                    "language" : "en-us",
                    pubDate: new Date().toUTCString().substr(5),
                    lastBuildDate: new Date().toUTCString().substr(5),
                    ttl: 20,
                }, meta)
            }
        }
        return f
    }

    async sync(feed, meta){
        var feedRss = xmlbuilder.create(feed, { encoding: 'utf-8' }).end({pretty:true})
        await fs.writeFile(join(this.mirror, "feed.rss"), feedRss)

        let {accessKey, secretKey, url, bucket} = meta.remote
        let mc = new Minio.Client({
            endPoint: url,
            useSSL: true,
            accessKey,
            secretKey,
        })

        let thumbs = Promise.all(feed.rss.channel.item.map(item => {
            let thumbnail = item['media:thumbnail']["@url"]
            if(thumbnail){
                thumbnail = basename(thumbnail)
                console.log(thumbnail)
            }

            return mc.statObject(bucket, thumbnail).then(stat => {
                console.log("Skipping already available file ", thumbnail)
            }).catch(e => {
                console.log("Uploading new file.")
                return mc.fPutObject(bucket, thumbnail, join(this.mirror, thumbnail))
            })
        }))


        feed.rss.channel.item.map(async item => {
            let filename = basename(item.link)
            return await mc.statObject(bucket, filename).then(stat => {
                console.log("Skipping already available file ", filename)
            }).catch(e => {
                console.log("Uploading new file.")
                return mc.fPutObject(bucket, filename, join(this.mirror, filename))
            })
        })
        
        await thumbs
        console.log("Uploading feed.rss")
        await mc.fPutObject(bucket, "feed.rss", join(this.mirror, "feed.rss"))

        let policy = {
            Version: "2012-10-17",
            Statement:[
              {
                Sid :"PublicRead",
                Effect:"Allow",
                Principal: "*",
                Action:["s3:GetObject"],
                Resource:["arn:aws:s3:::hamro-video"]
              }
            ]
          }

        // console.info("Setting bucket policy to ", bucket)
        try {
            // await mc.setBucketPolicy(bucket, JSON.stringify(policy))
        } catch(e) {
            // console.log(e)
        }
        
        policy = await mc.getBucketPolicy(bucket)
        console.log(policy)
        console.log("Upload Complete.")
    }
}