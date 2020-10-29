const express = require('express');
const app = express();
const puppeteer = require('puppeteer');
const cors = require('cors');
const formatDurationString = require('./helpers/formatDurationString');

app.use(cors());
app.use(express.json());

app.post('/facebook', async(req, res) => {
    try {
        const { url } = req.body;

        if (!url.match(/^(http(s)?:\/\/)?((w){3}.)?facebook?(\.com)?\/\S+\/videos\/\S+/)) throw new Error('Invalid url');

        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle2' });

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
        res.status(400).json({ message: err.message });
    }
});

app.post('/other', async(req, res) => {
    try {
        const { url } = req.body;

        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle2' });
    } catch(err) {
        res.status(400).json({ message: err.message });
    }
});

app.listen(process.env.PORT || 5000, () => console.log(`Server listening on port ${process.env.PORT || 5000}`));