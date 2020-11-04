require('dotenv').config();

const express = require('express');
const app = express();
const puppeteer = require('puppeteer');
const cors = require('cors');
const formatDurationString = require('./helpers/formatDurationString');
const Youtube = require('simple-youtube-api');
const youtube = new Youtube(process.env.YOUTUBE_API_KEY);
const ffmpeg = require('fluent-ffmpeg');

app.use(cors());
app.use(express.json());

app.post('/youtube-playlist', async(req, res) => {
    try {
        const { url } = req.body;

        if (!/^(?!.*\?.*\bv=)https:\/\/www\.youtube\.com\/.*\?.*\blist=.*$/.test(url)) return res.status(400).json({ message: 'Invalid URL' });

        const link = url.match(/^(?!.*\?.*\bv=)https:\/\/www\.youtube\.com\/.*\?.*\blist=.*$/)[0];
        const playlist = await (await youtube.getPlaylist(link)).getVideos();
        const videos = new Array();

        await Promise.all(playlist.map(async playlistVideo => {
            const video = await youtube.getVideoByID(playlistVideo.id);
            const durationString = formatDurationString(video.duration.hours, video.duration.minutes, video.duration.seconds);
            const data = {
                type: 'youtube',
                link: `https://www.youtube.com/watch?v=${video.id}`,
                title: video.title,
                published: video.publishedAt,
                by: video.channel.title,
                duration: durationString !== '00:00:00' ? durationString : 'Live Stream',
                thumbnail: video.thumbnails.high.url
            };

            videos.push(data);
        }));

        res.json(videos.sort((videoOne, videoTwo) => {
            if (new Date(videoOne.published).getTime() < new Date(videoTwo.published).getTime()) return -1; else return 1;
        }));
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/youtube', async(req, res) => {
    try {
        const { url } = req.body;

        if (!/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/\S+/.test(url)) return res.status(400).json({ message: 'Invalid URL' });

        const link = url.match(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/\S+/)[0];
        const id = link.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/)[2].split(/[^0-9a-z_\-]/i)[0];
        const video = await youtube.getVideoByID(id);
        const durationString = formatDurationString(video.duration.hours, video.duration.minutes, video.duration.seconds);
        const data = {
            type: 'youtube',
            link,
            title: video.title,
            by: video.channel.title,
            duration: durationString !== '00:00:00' ? durationString : 'Live Stream',
            thumbnail: video.thumbnails.high.url
        };

        res.json(data);
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/youtube-search', async(req, res) => {
    try {
        const { query, results } = req.body;

        const videos = await youtube.searchVideos(query, results);
        const searchResults = new Array();

        if (videos.length === 0) return res.status(404).json({ message: 'Nothing found' });

        if (results > 1) {
            await Promise.all(videos.map(async resultsVideo => {
                const video = await youtube.getVideoByID(resultsVideo.id);
                const durationString = formatDurationString(video.duration.hours, video.duration.minutes, video.duration.seconds);
                const data = {
                    type: 'youtube',
                    link: `https://www.youtube.com/watch?v=${video.id}`,
                    title: video.title,
                    published: video.publishedAt,
                    by: video.channel.title,
                    duration: durationString !== '00:00:00' ? durationString : 'Live Stream',
                    thumbnail: video.thumbnails.high.url
                };

                searchResults.push(data);
            }));
            res.json(searchResults);
        }

        const video = await youtube.getVideoByID(videos[0].raw.id.videoId);
        const durationString = formatDurationString(video.duration.hours, video.duration.minutes, video.duration.seconds);
        const data = {
            type: 'youtube',
            link: `https://www.youtube.com/watch?v=${video.id}`,
            title: video.title,
            by: video.channel.title,
            duration: durationString !== '00:00:00' ? durationString : 'Live Stream',
            thumbnail: video.thumbnails.high.url,
        };

        res.json(data);
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/facebook', async(req, res) => {
    try {
        const { url } = req.body;

        if (!/^(http(s)?:\/\/)?((w){3}.)?facebook?(\.com)?\/\S+\/videos\/\S+/.test(url)) return res.status(400).json({ message: 'Invalid URL' });

        const link = url.match(/^(http(s)?:\/\/)?((w){3}.)?facebook?(\.com)?\/\S+\/videos\/\S+/)[0];
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        await page.goto(link, { waitUntil: 'networkidle2' });

        const titleHandle = await page.$('title');
        const metaHandle = await page.$('meta[property="og:video:url"]');

        let durationCode = (await page.content()).match(/mediaPresentationDuration=\\"\S+\\"/) || (await page.content()).match(/"duration":"\S+"/) || false;
        let durationArr = [0, 0, 0];

        if (durationCode && durationCode.toString().match(/mediaPresentationDuration=\\"\S+\\"/)) {
            durationArr = durationCode.toString().replace(/mediaPresentationDuration=\\"/, '').replace(/\\"/, '').trim().split(/\D/).slice(2, 5).map(time => parseInt(time));
        } else if (durationCode && durationCode.toString().match(/"duration":"\S+"/)) {
            durationCode.toString().match(/"duration":"T(\d+H)?(\d+M)?(\d+S")?/)[0].replace(/"duration":"/, '').replace(/"/, '').trim().match(/(\d+H)|(\d+M)|(\d+S)/g).forEach(time => {
                if (time.toString().match(/\d+H/)) durationArr[0] = parseInt(time.match(/\d+/));
                if (time.toString().match(/\d+M/)) durationArr[1] = parseInt(time.match(/\d+/));
                if (time.toString().match(/\d+S/)) durationArr[2] = parseInt(time.match(/\d+/));
            });
        }

        const durationString = durationArr ? formatDurationString(durationArr[0], durationArr[1], durationArr[2] + 1) : 'Live Stream';
        const title = await page.evaluate(title => title.innerText.replace(/\s\|\sfacebook/i, ''), titleHandle);
        const videoLink = await page.evaluate(meta => meta.getAttribute('content'), metaHandle);
        const data = {
            type: 'facebook',
            link: videoLink,
            title: title.split(' - ')[1],
            by: title.split(' - ')[0],
            duration: durationString
        };

        res.json(data);
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/other', async(req, res) => {
    try {
        const { url } = req.body;

        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle2' });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.listen(process.env.PORT || 5000, () => console.log(`Server listening on port ${process.env.PORT || 5000}`));