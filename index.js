const express = require('express');
const app = express();
const puppeteer = require('puppeteer');
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.listen(process.env.PORT || 5000, () => console.log(`Server listening on port ${process.env.PORT || 5000}`));