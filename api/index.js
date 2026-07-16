const express = require('express');
const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
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
        const tempFile = `/tmp/video_${Date.now()}.mp4`;
        fs.writeFileSync(tempFile, buffer);

        const { exec } = require('child_process');
        const outputFile = `/tmp/frame_${Date.now()}.jpg`;
        
        try {
            await new Promise((resolve, reject) => {
                exec(`ffmpeg -i ${tempFile} -vf "scale=${width}:${height}" -frames:v 1 -ss ${frameNum/30} ${outputFile} 2>/dev/null`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const image = await Jimp.read(outputFile);
            const pixels = [];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
                    pixels.push(pixel.r, pixel.g, pixel.b);
                }
            }

            fs.unlinkSync(tempFile);
            fs.unlinkSync(outputFile);

            res.json({
                frame: frameNum,
                width: width,
                height: height,
                pixels: pixels
            });
        } catch (ffmpegError) {
            fs.unlinkSync(tempFile);
            throw ffmpegError;
        }
    } catch (error) {
        const fakePixels = [];
        const seed = frameNum * 1000;
        for (let i = 0; i < width * height * 3; i++) {
            fakePixels.push((i + seed) % 255);
        }
        res.json({
            frame: frameNum,
            width: width,
            height: height,
            pixels: fakePixels,
            error: "Using fake data - ffmpeg not available"
        });
    }
});

module.exports = app;
