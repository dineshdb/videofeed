import Index from "./src/index.js";
import Mirror from "./src/mirror.js"
import chalk from "chalk"
import terminalLink from "terminal-link"
const repo = ".";

(async function() {
  try {
    let index = new Index(repo)
    try{
      await index.loadIndex()
    } catch(e) {
      console.log(chalk.red("Could not load index. Make sure index.toml exists in current folder."))
    }

    let items = await index.items()
    let mirror = new Mirror(repo)
    try{
      await mirror.init()
    } catch(e) {
      console.error(chalk.red("Could not initialize repo."))
    }
 
    for (let episode of items){
      try {
        await mirror.addEpisode(episode)
      } catch(e) {
        console.error(chalk.red("Error adding episode to mirror", e))
      }
    }

    let feed = await mirror.feed(index.config)
    try{
      await mirror.sync(feed, index.config)
      console.info("Successfully synced all the files to server.")
      console.log(chalk.blue(terminalLink("Please update the permission of the Cloud storage to make it public", `https://${index.config.remote.url}/${index.config.remote.bucket}`)))
      } catch(e){
      console.error(chalk.red("Error syncing files to server."))
    }
  } catch (e) {
    console.error(chalk.red("One or more errors were found. Please see above."))
    console.log(e)
  }
})();