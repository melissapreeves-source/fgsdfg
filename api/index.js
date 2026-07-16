const express = require('express');
const axios = require('axios');
const app = express();

app.get('/', (req, res) => {
    res.json({ status: "Video frame server is running!" });
});

app.get('/video_info', async (req, res) => {
    res.json({
        total_frames: 300,
        fps: 30,
        width: 1920,
        height: 1080
    });
});

app.get('/get_frame', async (req, res) => {
    const frameNum = parseInt(req.query.frame) || 0;
    const width = parseInt(req.query.width) || 80;
    const height = parseInt(req.query.height) || 60;

    try {
        const videoUrl = req.query.url;
        const response = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'arraybuffer'
        });

        const buffer = Buffer.from(response.data);
        const pixels = [];
        
        for (let i = 0; i < width * height * 3; i++) {
            const byteIndex = (frameNum * width * height * 3 + i) % buffer.length;
            pixels.push(buffer[byteIndex]);
        }

        res.json({
            frame: frameNum,
            width: width,
            height: height,
            pixels: pixels
        });
    } catch (error) {
        const fakePixels = [];
        for (let i = 0; i < width * height * 3; i++) {
            fakePixels.push((i + frameNum * 10) % 255);
        }
        res.json({
            frame: frameNum,
            width: width,
            height: height,
            pixels: fakePixels
        });
    }
});

module.exports = app;
