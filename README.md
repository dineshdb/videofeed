# Readme
videofeed is a tool which generates _rss_ and _json_ feed in a directory of videos. It does not concern itself with deploying your rss files though.

## Directory Structure
You should call this tool at the root of your videos. It will generate _feed.json_ and _feed.rss_ at the root. There should be a file named __videofeed.toml__ at the root of your folder that describes some settings for the project.

It will search for all the video files in the directory and subdirectories and then tries to find following extra files. For a file as ``<filename>.<ext>``, It will search for:

For thumbnail
- _filename_.png
- _filename_.jpg
- _filename_.webp

For extra metadata:
- _filename_.toml

For thumbnail generation, you will need to install ffmpeg.
This tool has been tested in GNU/Linux. However, it should work in other platforms too.

## Example _videofeed.toml_

```toml
[videofeed]
title = "Example feed"
description = "Example feed"
baseUrl = "https://example.com"
copyright = "Example.com"
categories = ["Technology"]

[thumbnail]
generate = true
captureAt = 300
```


## Running this tool
Run this tool directly with
```npx videofeed```

## Copyright
[Dinesh Bhattarai](https://dbhattarai.info.np)