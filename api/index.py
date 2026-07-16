from flask import Flask, jsonify, request
import cv2
import urllib.request
import os
import tempfile
import numpy as np

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"status": "Video frame server is running!"})

@app.route('/video_info')
def video_info():
    video_url = request.args.get('url')
    if not video_url:
        return jsonify({'error': 'Missing url parameter'}), 400
    
    temp_file = None
    try:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        urllib.request.urlretrieve(video_url, temp_file.name)
        temp_file.close()
        
        cap = cv2.VideoCapture(temp_file.name)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()
        
        os.unlink(temp_file.name)
        
        return jsonify({
            'total_frames': total_frames,
            'fps': int(fps),
            'width': width,
            'height': height
        })
    except Exception as e:
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
            except:
                pass
        return jsonify({'error': str(e)}), 500

@app.route('/get_frame')
def get_frame():
    video_url = request.args.get('url')
    frame_num = int(request.args.get('frame', 0))
    width = int(request.args.get('width', 80))
    height = int(request.args.get('height', 60))
    
    if not video_url:
        return jsonify({'error': 'Missing url parameter'}), 400
    
    temp_file = None
    try:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        urllib.request.urlretrieve(video_url, temp_file.name)
        temp_file.close()
        
        cap = cv2.VideoCapture(temp_file.name)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        cap.release()
        
        # Delete video file immediately after reading
        os.unlink(temp_file.name)
        temp_file = None
        
        if not ret:
            return jsonify({'error': 'Frame not found'}), 404
        
        frame = cv2.resize(frame, (width, height))
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pixels = frame_rgb.flatten().tolist()
        
        # Limit pixel data size
        if len(pixels) > 100000:
            pixels = pixels[:100000]
        
        return jsonify({
            'frame': frame_num,
            'width': width,
            'height': height,
            'pixels': pixels
        })
    except Exception as e:
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
            except:
                pass
        return jsonify({'error': str(e)}), 500

app = app
