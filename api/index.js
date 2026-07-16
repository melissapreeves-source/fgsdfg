const express = require('express');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();

// Use system ffmpeg on Vercel
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

app.get('/', (req, res) => {
    res.json({ status: "Video frame server is running!" });
});

app.get('/video_info', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream'
        });

        const tempFile = path.join('/tmp', `video_${Date.now()}.mp4`);
        const writer = fs.createWriteStream(tempFile);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const info = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(tempFile, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata);
            });
        });

        fs.unlinkSync(tempFile);

        const stream = info.streams.find(s => s.codec_type === 'video');
        const fpsParts = stream.r_frame_rate.split('/');
        const fps = parseInt(fpsParts[0]) / parseInt(fpsParts[1]);

        res.json({
            total_frames: parseInt(stream.nb_frames) || 300,
            fps: Math.round(fps),
            width: parseInt(stream.width),
            height: parseInt(stream.height)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/get_frame', async (req, res) => {
    const videoUrl = req.query.url;
    const frameNum = parseInt(req.query.frame) || 0;
    const width = parseInt(req.query.width) || 80;
    const height = parseInt(req.query.height) || 60;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream'
        });

        const tempFile = path.join('/tmp', `video_${Date.now()}.mp4`);
        const writer = fs.createWriteStream(tempFile);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const outputFile = path.join('/tmp', `frame_${Date.now()}.raw`);
        
        await new Promise((resolve, reject) => {
            ffmpeg(tempFile)
                .videoFilters(`scale=${width}:${height},format=rgb24`)
                .frames(1)
                .seekInput(frameNum / 30)
                .outputOptions(['-f rawvideo', '-pix_fmt rgb24'])
                .output(outputFile)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        const pixelData = fs.readFileSync(outputFile);
        const pixels = Array.from(pixelData);

        fs.unlinkSync(tempFile);
        fs.unlinkSync(outputFile);

        res.json({
            frame: frameNum,
            width: width,
            height: height,
            pixels: pixels
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = app;
