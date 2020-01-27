# Readme

## Running this tool
- Enter your prepared repo
- Run ``docker run -it -v .:/repo videofeed``

## Directory Structure
- Create *index.toml* in the root of your repo.
- Create a folder named _data_ to store your data.
- Inside _data_, create one folder for each episode and then add all the parts inside that folder.
- Add as much episodes.
- Finally run this tool. It will sync all your data to upstream s3 bucket.

It will search for all the video files in the directory and subdirectories and then tries to find following extra files. For a file as `<filename>.<ext>`, It will search for:

For thumbnail

- _filename_.png
- _filename_.jpg
- _filename_.webp

For extra metadata:

- _filename_.toml
- episode/index.toml

## Example _index.toml_

```toml
title = "My World - BBC"
description = "Watch exclusive videos on Hamropatro."
link = "https://sgp1.digitaloceanspaces.com/hamro-video"
copyright = "BBC"

[thumbnail]
capture = true
captureAt = 3

[remote]
url="sgp1.digitaloceanspaces.com"
bucket="hamro-video"
accessKey="<yourkey>"
secretKey="<your key>"
```

## Episode metadata