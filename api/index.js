const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();

app.get('/', (req, res) => {
    res.json({ status: "Video frame server is running!" });
});

app.get('/video_info', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const tempFile = path.join('/tmp', `video_${Date.now()}.mp4`);
        
        await execPromise(`curl -L -o ${tempFile} "${videoUrl}"`);
        
        const { stdout } = await execPromise(`ffprobe -v error -show_entries stream=width,height,nb_frames,r_frame_rate -of json ${tempFile}`);
        const info = JSON.parse(stdout);
        
        fs.unlinkSync(tempFile);

        const stream = info.streams[0];
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
        const tempFile = path.join('/tmp', `video_${Date.now()}.mp4`);
        const outputFile = path.join('/tmp', `frame_${Date.now()}.raw`);
        
        await execPromise(`curl -L -o ${tempFile} "${videoUrl}"`);
        
        await execPromise(
            `ffmpeg -i ${tempFile} -vf "scale=${width}:${height},format=rgb24" -frames:v 1 -f rawvideo -pix_fmt rgb24 -ss ${frameNum/30} ${outputFile}`
        );

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
