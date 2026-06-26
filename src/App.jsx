import React, { useState, useEffect, useRef } from 'react';
import salPriadiMusic from './assets/Sal Priadi - Foto kita blur Official Lyric Video.mp3';

export default function App() {
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [statusText, setStatusText] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);

  // New States for Orientation Mode, Timer, and Session Gallery
  const [orientationMode, setOrientationMode] = useState(null); // 'portrait' | 'landscape' | null
  const [timerDuration, setTimerDuration] = useState(3); // default 3s
  const [countdown, setCountdown] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [confirmModalState, setConfirmModalState] = useState(null); // null | 'open' | 'closing-confirm' | 'closing-cancel'
  const [deleteTarget, setDeleteTarget] = useState(null); // null | 'all' | photoId (string)
  const [captureMode, setCaptureMode] = useState('photo'); // 'photo' | 'video'
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [musicUrl] = useState(salPriadiMusic);
  const [musicStartTime, setMusicStartTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(15);
  const [audioDuration, setAudioDuration] = useState(244); // default 4:04 fallback
  const [activePreviewItem, setActivePreviewItem] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Derived music end time
  const musicEndTime = musicStartTime + videoDuration;

  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const previewAudioRef = useRef(null);
  const autoplayTimeoutRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const streamDestRef = useRef(null);

  const timerIntervalRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);

  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const runningRef = useRef(false);
  const peaceDetectedRef = useRef(false);
  const currentBlurRef = useRef(0);
  const processFrameIdRef = useRef(null);
  const renderLoopIdRef = useRef(null);

  const dist = (a, b, aspect = 1) => {
    const dx = (a.x - b.x) * aspect;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  };

  const isPeaceSign = (landmarks, aspect = 1) => {
    // Index: MCP (5), PIP (6), TIP (8)
    const indexExtended = dist(landmarks[8], landmarks[5], aspect) > dist(landmarks[6], landmarks[5], aspect) * 1.5;
    // Middle: MCP (9), PIP (10), TIP (12)
    const middleExtended = dist(landmarks[12], landmarks[9], aspect) > dist(landmarks[10], landmarks[9], aspect) * 1.5;
    // Ring: MCP (13), PIP (14), TIP (16)
    const ringFolded = dist(landmarks[16], landmarks[13], aspect) < dist(landmarks[14], landmarks[13], aspect) * 1.3;
    // Pinky: MCP (17), PIP (18), TIP (20)
    const pinkyFolded = dist(landmarks[20], landmarks[17], aspect) < dist(landmarks[18], landmarks[17], aspect) * 1.3;

    return indexExtended && middleExtended && ringFolded && pinkyFolded;
  };

  const onResults = (results) => {
    let detected = false;
    let aspect = 1;
    if (videoRef.current && videoRef.current.videoWidth && videoRef.current.videoHeight) {
      aspect = videoRef.current.videoWidth / videoRef.current.videoHeight;
    }
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const lm of results.multiHandLandmarks) {
        if (isPeaceSign(lm, aspect)) {
          detected = true;
          break;
        }
      }
    }
    peaceDetectedRef.current = detected;
  };

  const initHands = () => {
    return new Promise((resolve, reject) => {
      if (!window.Hands) {
        reject(new Error('MediaPipe Hands library is not loaded on the window object.'));
        return;
      }
      const hands = new window.Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.6,
      });
      hands.onResults(onResults);
      handsRef.current = hands;
      resolve();
    });
  };

  const resizeCanvas = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!video || !canvas || !stage) return;

    if (video.videoWidth && video.videoHeight) {
      // Force aspect ratio according to selection
      if (orientationMode === 'portrait') {
        stage.style.aspectRatio = '3 / 4';
      } else {
        stage.style.aspectRatio = '16 / 9';
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    } else {
      canvas.width = stage.clientWidth;
      canvas.height = stage.clientHeight;
    }
  };

  const renderLoop = () => {
    if (!runningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.videoWidth && video.videoHeight) {
      if (canvas.width !== video.videoWidth) {
        resizeCanvas();
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const blurAmount = 8;
        const fadeStep = 0.04;
        const targetBlur = peaceDetectedRef.current ? blurAmount : 0;

        if (currentBlurRef.current < targetBlur) {
          currentBlurRef.current = Math.min(targetBlur, currentBlurRef.current + blurAmount * fadeStep);
        } else if (currentBlurRef.current > targetBlur) {
          currentBlurRef.current = Math.max(targetBlur, currentBlurRef.current - blurAmount * fadeStep);
        }

        ctx.filter = currentBlurRef.current > 0.05 ? `blur(${currentBlurRef.current}px)` : 'none';
        ctx.save();
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (currentBlurRef.current > 1) {
          setStatusText('Foto Kita Blur...');
        } else {
          setStatusText('');
        }
      }
    }

    renderLoopIdRef.current = requestAnimationFrame(renderLoop);
  };

  const processFrame = async () => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const hands = handsRef.current;
    if (hands && video && video.readyState >= 2) {
      try {
        await hands.send({ image: video });
      } catch (e) {
        console.error('Hands detection error:', e);
      }
    }
    processFrameIdRef.current = requestAnimationFrame(processFrame);
  };

  const startCamera = async () => {
    try {
      setIsConnecting(true);
      setStatusText('');

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      resizeCanvas();

      if (!handsRef.current) {
        setIsModelLoading(true);
        await initHands();
        setIsModelLoading(false);
      }

      runningRef.current = true;
      setCameraActive(true);
      setIsConnecting(false);

      processFrame();
      renderLoop();
    } catch (err) {
      setIsConnecting(false);
      setIsModelLoading(false);
      setStatusText('Periksa izin kamera di browser Anda.');
      console.error(err);
      stopCamera();
    }
  };

  const stopCamera = () => {
    runningRef.current = false;
    peaceDetectedRef.current = false;
    currentBlurRef.current = 0;

    // Clear active timer interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setCountdown(0);

    // Clear recording timer & components
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopPreview();
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsRecording(false);

    if (processFrameIdRef.current) {
      cancelAnimationFrame(processFrameIdRef.current);
      processFrameIdRef.current = null;
    }
    if (renderLoopIdRef.current) {
      cancelAnimationFrame(renderLoopIdRef.current);
      renderLoopIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setStatusText('');

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    if (stageRef.current) {
      stageRef.current.style.aspectRatio = '';
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const triggerCapture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Camera flash visual effect
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 250);

    // Determine target aspect ratio based on orientationMode
    let targetRatio = 16/9; // landscape default
    if (orientationMode === 'portrait') {
      targetRatio = 3/4; // portrait default
    }

    const currentRatio = canvas.width / canvas.height;
    let finalDataUrl = '';

    // If ratios match closely, don't crop
    if (Math.abs(currentRatio - targetRatio) < 0.05) {
      finalDataUrl = canvas.toDataURL('image/png');
    } else {
      // Create temporary canvas to crop the image
      const tempCanvas = document.createElement('canvas');
      let sX = 0, sY = 0, sW = canvas.width, sH = canvas.height;
      let dW = canvas.width, dH = canvas.height;

      if (currentRatio > targetRatio) {
        // Source is wider (e.g. landscape camera stream in portrait mode) - Crop sides
        sW = canvas.height * targetRatio;
        sX = (canvas.width - sW) / 2;
        dW = sW;
        dH = sH;
      } else {
        // Source is narrower (e.g. portrait camera stream in landscape mode) - Crop top/bottom
        sH = canvas.width / targetRatio;
        sY = (canvas.height - sH) / 2;
        dW = sW;
        dH = sH;
      }

      tempCanvas.width = dW;
      tempCanvas.height = dH;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, sX, sY, sW, sH, 0, 0, dW, dH);
        finalDataUrl = tempCanvas.toDataURL('image/png');
      } else {
        finalDataUrl = canvas.toDataURL('image/png');
      }
    }

    if (finalDataUrl) {
      setCapturedPhotos((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          dataUrl: finalDataUrl,
        },
      ]);
    }
  };

  const handleModeChange = (newMode) => {
    if (isRecording || isSwitchingMode) return;
    setIsSwitchingMode(true);
    setCaptureMode(newMode);
    stopPreview();
    setTimeout(() => {
      setIsSwitchingMode(false);
    }, 500);
  };

  const handleCaptureClick = () => {
    if (countdown > 0) return; // already counting down

    if (timerDuration > 0) {
      setCountdown(timerDuration);
      let count = timerDuration;
      timerIntervalRef.current = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count === 0) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          if (captureMode === 'video') {
            startRecording();
          } else {
            triggerCapture();
          }
        }
      }, 1000);
    } else {
      if (captureMode === 'video') {
        startRecording();
      } else {
        triggerCapture();
      }
    }
  };


  const startRecording = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    stopPreview();

    try {
      setIsRecording(true);
      setRecordingSeconds(0);
      setStatusText('Sedang merekam video TikTok...');

      let hasAudio = false;
      let audioCtx = null;
      let destNode = null;
      let audio = null;

      try {
        // 1. Set up audio context
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = audioCtx;

        // 2. Set up audio element
        audio = new Audio(musicUrl);
        audio.crossOrigin = 'anonymous';
        audio.loop = true;
        audio.currentTime = musicStartTime;
        audioRef.current = audio;

        // 3. Connect nodes
        const sourceNode = audioCtx.createMediaElementSource(audio);
        destNode = audioCtx.createMediaStreamDestination();
        streamDestRef.current = destNode;

        sourceNode.connect(destNode);
        sourceNode.connect(audioCtx.destination);

        // 4. Start audio playback
        await audio.play();
        hasAudio = true;
      } catch (audioErr) {
        console.warn('Gagal memutar audio backsound, merekam video saja:', audioErr);
        setStatusText('Musik tidak ditemukan / gagal dimuat. Merekam tanpa musik...');
        hasAudio = false;
      }

      // 5. Capture canvas video stream
      const canvasStream = canvas.captureStream(30);

      // 6. Combine tracks
      const tracks = [...canvasStream.getVideoTracks()];
      if (hasAudio && destNode) {
        const audioTracks = destNode.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          tracks.push(audioTracks[0]);
        }
      }

      const combinedStream = new MediaStream(tracks);

      // 7. Initialize recorder
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      mediaRecorderRef.current = recorder;

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);

        setCapturedPhotos((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            dataUrl: videoUrl,
            type: 'video',
          },
        ]);
        setStatusText('Video TikTok berhasil disimpan di galeri.');
      };

      recorder.start();

      let elapsed = 0;
      recordingIntervalRef.current = setInterval(() => {
        elapsed += 1;
        setRecordingSeconds(elapsed);
        if (elapsed >= videoDuration) {
          stopRecording();
        }
      }, 1000);

    } catch (err) {
      console.error('Error starting video recording:', err);
      setIsRecording(false);
      setStatusText('Gagal memulai perekaman video. Coba pilih file lagu lain.');
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    setIsRecording(false);
  };

  const downloadSinglePhoto = (dataUrl, index, type = 'photo') => {
    const link = document.createElement('a');
    const ext = type === 'video' ? 'webm' : 'png';
    link.download = `foto-kita-blur-${index + 1}.${ext}`;
    link.href = dataUrl;
    link.click();
  };

  const downloadAllPhotos = () => {
    capturedPhotos.forEach((photo, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        const ext = photo.type === 'video' ? 'webm' : 'png';
        link.download = `foto-kita-blur-${index + 1}.${ext}`;
        link.href = photo.dataUrl;
        link.click();
      }, index * 200);
    });
  };

  const deletePhoto = (id) => {
    setDeleteTarget(id);
    setConfirmModalState('open');
  };

  const clearAllPhotos = () => {
    setDeleteTarget('all');
    setConfirmModalState('open');
  };



  const triggerAutoplayPreview = (startVal, endVal) => {
    if (autoplayTimeoutRef.current) {
      clearTimeout(autoplayTimeoutRef.current);
    }
    autoplayTimeoutRef.current = setTimeout(() => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(musicUrl);
      audio.crossOrigin = 'anonymous';
      audio.currentTime = startVal;
      audio.volume = 0.8;
      previewAudioRef.current = audio;

      audio.play().then(() => {
        setIsPreviewPlaying(true);
      }).catch((err) => {
        console.log("Autoplay failed:", err);
      });

      const checkTimeInterval = setInterval(() => {
        if (!previewAudioRef.current || previewAudioRef.current.paused) {
          clearInterval(checkTimeInterval);
          setIsPreviewPlaying(false);
          return;
        }
        if (previewAudioRef.current.currentTime >= endVal) {
          stopPreview();
          clearInterval(checkTimeInterval);
        }
      }, 50);
    }, 150);
  };

  const handleStartSliderChange = (val) => {
    const maxStart = Math.max(0, audioDuration - videoDuration);
    const newStart = Math.min(val, maxStart);
    setMusicStartTime(newStart);
    triggerAutoplayPreview(newStart, newStart + videoDuration);
  };

  const handleEndSliderChange = (val) => {
    const minEnd = Math.min(audioDuration, videoDuration);
    const newEnd = Math.max(minEnd, val);
    const newStart = newEnd - videoDuration;
    setMusicStartTime(newStart);
    triggerAutoplayPreview(newStart, newEnd);
  };

  const handleDurationSelect = (selectedSecs) => {
    setVideoDuration(selectedSecs);
    const maxStart = Math.max(0, audioDuration - selectedSecs);
    if (musicStartTime > maxStart) {
      setMusicStartTime(maxStart);
    }
    stopPreview();
  };

  const startPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(musicUrl);
    audio.crossOrigin = 'anonymous';
    audio.currentTime = musicStartTime;
    audio.volume = 0.8;
    previewAudioRef.current = audio;

    audio.play().then(() => {
      setIsPreviewPlaying(true);
    }).catch((err) => {
      console.error("Error playing preview:", err);
    });

    const checkTimeInterval = setInterval(() => {
      if (!previewAudioRef.current || previewAudioRef.current.paused) {
        clearInterval(checkTimeInterval);
        setIsPreviewPlaying(false);
        return;
      }
      if (previewAudioRef.current.currentTime >= musicEndTime) {
        stopPreview();
        clearInterval(checkTimeInterval);
      }
    }, 50);
  };

  const stopPreview = () => {
    if (autoplayTimeoutRef.current) {
      clearTimeout(autoplayTimeoutRef.current);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
  };

  // Load Sal Priadi music duration metadata
  useEffect(() => {
    const audioObj = new Audio(salPriadiMusic);
    const handleLoadedMetadata = () => {
      setAudioDuration(audioObj.duration);
    };
    audioObj.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioObj.load();
    return () => {
      audioObj.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);



  // Restart camera when facingMode changes, if it is currently active
  useEffect(() => {
    if (runningRef.current) {
      startCamera();
    }
  }, [facingMode]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopPreview();
    };
  }, []);

  const getStartButtonText = () => {
    if (isConnecting) return 'Menghubungkan...';
    if (isModelLoading) return 'Memuat model...';
    return 'Mulai Kamera';
  };

  // Stop preview when switching capture modes or when camera is deactivated
  useEffect(() => {
    stopPreview();
  }, [captureMode, cameraActive]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const transformStyle = {
    transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)',
  };

  const startPercent = audioDuration > 0 ? (musicStartTime / audioDuration) * 100 : 0;
  const endPercent = audioDuration > 0 ? (musicEndTime / audioDuration) * 100 : 0;

  return (
    <>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Landing Selector Screen */}
      {!orientationMode ? (
        <div className="app-card mode-selector-card">
          <header className="fade-in-element">
            <div className="header-logo-row">
              <h1>Foto Kita Blur</h1>
            </div>
            <p className="subtitle">
              Pilih mode tampilan kamera yang sesuai dengan perangkat dan gaya foto Anda.
            </p>
          </header>

          <div className="mode-options-container fade-in-element fade-in-delay-1">
            <button 
              className="mode-option-btn"
              onClick={() => setOrientationMode('portrait')}
            >
              <div className="mode-icon-wrapper">
                <svg className="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12" y2="18" />
                </svg>
              </div>
              <div className="mode-text-wrapper">
                <div className="mode-title">Mode Portrait (Tegak)</div>
                <div className="mode-desc">Cocok untuk HP, reels, story, dan foto gaya vertikal.</div>
              </div>
            </button>

            <button 
              className="mode-option-btn"
              onClick={() => setOrientationMode('landscape')}
            >
              <div className="mode-icon-wrapper">
                <svg className="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div className="mode-text-wrapper">
                <div className="mode-title">Mode Landscape (Mendatar)</div>
                <div className="mode-desc">Cocok untuk laptop, PC, dan tangkapan layar lebar.</div>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className={`app-card mode-${orientationMode}`}>
          <header className="fade-in-element header-top-row">
            <button
              id="btn-back-header"
              className="btn-back-header"
              disabled={isRecording}
              onClick={() => {
                stopCamera();
                setOrientationMode(null);
              }}
              title="Kembali ke pemilihan layout"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Kembali</span>
            </button>
            <h1>Foto Kita Blur</h1>
          </header>

          <div className="stage-container fade-in-element fade-in-delay-1">
            <div
              ref={stageRef}
              className={`stage ${cameraActive ? 'active-camera' : ''}`}
              id="stage"
            >
              {/* Camera Placeholder */}
              <div className={`camera-placeholder ${cameraActive ? 'hidden' : ''}`}>
                <div className="placeholder-icon-wrapper">
                  <div className="pulse-ring"></div>
                  <svg
                    className="placeholder-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <div className="placeholder-text-group">
                  <div className="placeholder-title">Kamera Nonaktif</div>
                  <div className="placeholder-desc">
                    Tekan tombol "Mulai Kamera" di bawah untuk memulai tren foto estetik ini.
                  </div>
                </div>
              </div>

              {/* Video Stream & Output Canvas */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={cameraActive ? 'active' : ''}
                style={transformStyle}
              ></video>

              <canvas
                ref={canvasRef}
                id="output"
              ></canvas>

              {statusText && <div id="status-text">{statusText}</div>}

              {/* Timer Countdown Overlay */}
              {countdown > 0 && <div className="countdown-overlay">{countdown}</div>}

              {/* Shutter Flash Effect */}
              {isFlashing && <div className="flash-overlay"></div>}

              {/* Mode Switch Overlay */}
              {isSwitchingMode && (
                <div className="mode-switch-overlay">
                  <div className="mode-switch-badge">
                    {captureMode === 'video' ? 'VIDEO' : 'FOTO'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="controls fade-in-element fade-in-delay-2">
            <button
              id="btn-toggle-capture-mode"
              className="btn btn-secondary"
              disabled={isRecording}
              onClick={() => handleModeChange(captureMode === 'photo' ? 'video' : 'photo')}
              title="Ganti mode Foto / Video TikTok"
            >
              {captureMode === 'photo' ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span className="btn-text">Mode Video</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="btn-text">Mode Foto</span>
                </>
              )}
            </button>

            {captureMode === 'video' && isRecording ? (
              <button
                id="btn-stop-recording"
                className="btn btn-danger btn-recording"
                disabled={!cameraActive}
                onClick={stopRecording}
              >
                <span className="recording-dot"></span>
                <span className="timer-val">{recordingSeconds}s / {videoDuration}s</span>
              </button>
            ) : (
              <button
                id="btn-snapshot"
                className="btn btn-secondary"
                disabled={!cameraActive || countdown > 0}
                onClick={handleCaptureClick}
              >
                {captureMode === 'video' ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" fill="red" />
                    </svg>
                    <span className="btn-text">Rekam Video</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span className="btn-text">Ambil Foto</span>
                  </>
                )}
              </button>
            )}

            {!cameraActive ? (
              <button
                id="btn-start"
                className="btn btn-primary"
                disabled={isConnecting || isModelLoading || isRecording}
                onClick={startCamera}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                <span className="btn-text">{getStartButtonText()}</span>
              </button>
            ) : (
              <button
                id="btn-stop"
                className="btn btn-danger"
                disabled={isRecording}
                onClick={stopCamera}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <rect x="9" y="9" width="6" height="6" />
                </svg>
                <span className="btn-text">Matiin Kamera</span>
              </button>
            )}

            <button
              id="btn-switch"
              className="btn btn-secondary"
              disabled={!cameraActive || isRecording}
              onClick={switchCamera}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span className="btn-text">Mirror Kamera</span>
            </button>

            <button
              id="btn-timer"
              className="btn btn-secondary"
              disabled={!cameraActive || isRecording}
              onClick={() => {
                setTimerDuration((prev) => {
                  if (prev === 0) return 3;
                  if (prev === 3) return 5;
                  if (prev === 5) return 10;
                  if (prev === 10) return 15;
                  return 0; // cycles: 3 -> 5 -> 10 -> 15 -> 0 (off)
                });
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="btn-text-long">Timer: </span>
              <span className="timer-val">{timerDuration === 0 ? 'Off' : `${timerDuration}s`}</span>
            </button>

            <button
              id="btn-duration"
              className={`btn btn-secondary btn-duration-control ${captureMode === 'video' ? 'visible' : 'hidden-mode'}`}
              disabled={isRecording}
              onClick={() => {
                const next = videoDuration === 15 ? 30 : videoDuration === 30 ? 45 : videoDuration === 45 ? 60 : 15;
                handleDurationSelect(next);
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 15 12" />
              </svg>
              <span className="btn-text-long">Durasi: </span>
              <span className="duration-val">{videoDuration}s</span>
            </button>
          </div>

          {/* Music Selector & Trim Controls */}
          <div className={`music-trim-wrapper ${captureMode === 'video' ? 'visible' : 'collapsed'}`}>
              <div className="music-trim-container">
                {/* Row 1: Song Info & Play Button */}
                <div className="music-trim-header-row">
                  <div className="music-title-container">
                    <span className="music-icon-note">🎵</span>
                    <span className="music-title-text" title="Sal Priadi - Foto kita blur">
                      Sal Priadi - Foto kita blur
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`btn-play-icon-only ${isPreviewPlaying ? 'playing' : ''}`}
                    disabled={isRecording}
                    onClick={isPreviewPlaying ? stopPreview : startPreview}
                    title={isPreviewPlaying ? "Hentikan Pratinjau Lagu" : "Putar Lagu"}
                  >
                    {isPreviewPlaying ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6 3 20 12 6 21 6 3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Row 2: Slider with flanking timestamps */}
                <div className="music-trim-slider-row">
                  <span className="time-label time-label-start">{formatTime(musicStartTime)}</span>
                  <div className="double-slider-wrapper">
                    <div className="double-slider-container">
                      <div 
                        className="slider-track" 
                        style={{
                          '--track-bg': `linear-gradient(to right, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.08) ${startPercent}%, var(--accent) ${startPercent}%, var(--accent) ${endPercent}%, rgba(255, 255, 255, 0.08) ${endPercent}%, rgba(255, 255, 255, 0.08) 100%)`
                        }}
                      ></div>
                      <input
                        type="range"
                        min="0"
                        max={audioDuration}
                        value={musicStartTime}
                        disabled={isRecording}
                        onChange={(e) => handleStartSliderChange(parseFloat(e.target.value))}
                        className="slider-thumb slider-start"
                      />
                      <input
                        type="range"
                        min="0"
                        max={audioDuration}
                        value={musicEndTime}
                        disabled={isRecording}
                        onChange={(e) => handleEndSliderChange(parseFloat(e.target.value))}
                        className="slider-thumb slider-end"
                      />
                    </div>
                  </div>
                  <span className="time-label time-label-end">{formatTime(musicEndTime)}</span>
                </div>
              </div>
            </div>

          {/* Session Gallery */}
          <div className={`gallery-section ${capturedPhotos.length > 0 ? 'visible' : 'collapsed'}`}>
            <div className="gallery-header">
              <h3>Hasil Foto & Video Sesi Ini ({capturedPhotos.length})</h3>
              <div className="gallery-actions">
                <button className="btn-gallery-action download-all" onClick={downloadAllPhotos}>
                  Download Semua
                </button>
                <button className="btn-gallery-action delete-all" onClick={clearAllPhotos}>
                  Hapus Semua
                </button>
              </div>
            </div>
            <div className="gallery-scroll-container">
               {capturedPhotos.map((photo, index) => (
                <div 
                  key={photo.id} 
                  className={`gallery-item ${photo.id === deletingPhotoId ? 'removing' : ''}`}
                  onClick={() => setActivePreviewItem(photo)}
                  style={{ cursor: 'pointer' }}
                >
                    {photo.type === 'video' ? (
                      <video src={photo.dataUrl} loop muted playsInline autoPlay />
                    ) : (
                      <img src={photo.dataUrl} alt={`Captured ${index + 1}`} />
                    )}
                    {photo.type === 'video' && (
                      <div className="video-badge" title="Video TikTok">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    )}
                    <div className="item-overlay">
                      <button 
                        className="item-btn btn-download" 
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadSinglePhoto(photo.dataUrl, index, photo.type);
                        }}
                        title="Unduh file"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                      </button>
                      <button 
                        className="item-btn btn-delete" 
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePhoto(photo.id);
                        }}
                        title="Hapus file"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          {/* Footer info */}
          <div className="tip-footer fade-in-element fade-in-delay-3">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Pose ✌️ untuk mengaktifkan efek blur lambat secara otomatis.</span>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal Dialog */}
      {confirmModalState && (
        <div className={`modal-overlay ${confirmModalState === 'closing-confirm' || confirmModalState === 'closing-cancel' ? 'closing' : ''}`}>
          <div className={`modal-card ${confirmModalState}`}>
            <div className="modal-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <h3>{deleteTarget === 'all' ? 'Hapus Semua Media?' : 'Hapus Media Ini?'}</h3>
            <p>
              {deleteTarget === 'all'
                ? 'Tindakan ini akan menghapus semua foto dan video di galeri sesi ini. Anda tidak dapat membatalkan tindakan ini.'
                : 'Tindakan ini akan menghapus file foto/video ini dari galeri. Anda tidak dapat membatalkan tindakan ini.'}
            </p>
            <div className="modal-buttons">
              <button 
                className="btn btn-danger" 
                onClick={() => {
                  setConfirmModalState('closing-confirm');
                  setTimeout(() => {
                    if (deleteTarget === 'all') {
                      setCapturedPhotos([]);
                      setConfirmModalState(null);
                      setDeleteTarget(null);
                    } else {
                      // Trigger removing animation in gallery first
                      setDeletingPhotoId(deleteTarget);
                      // Close the modal
                      setConfirmModalState(null);
                      
                      // After the animation finishes, remove from state
                      setTimeout(() => {
                        setCapturedPhotos((prev) => prev.filter((p) => p.id !== deleteTarget));
                        if (activePreviewItem && activePreviewItem.id === deleteTarget) {
                          setActivePreviewItem(null);
                        }
                        setDeletingPhotoId(null);
                        setDeleteTarget(null);
                      }, 350); // Matches CSS transition duration
                    }
                  }, 400); // Wait for exit animation to complete
                }}
              >
                Ya, Hapus
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setConfirmModalState('closing-cancel');
                  setTimeout(() => {
                    setConfirmModalState(null);
                    setDeleteTarget(null);
                  }, 300); // Wait for exit animation to complete
                }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {activePreviewItem && (
        <div className="lightbox-overlay" onClick={() => setActivePreviewItem(null)}>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-media-wrapper">
              {activePreviewItem.type === 'video' ? (
                <video key={activePreviewItem.id} src={activePreviewItem.dataUrl} controls autoPlay loop playsInline />
              ) : (
                <img src={activePreviewItem.dataUrl} alt="Lightbox Preview" />
              )}
            </div>
            <div className="lightbox-actions">
              <button 
                className="btn btn-secondary btn-lightbox-download"
                onClick={() => {
                  const index = capturedPhotos.findIndex(p => p.id === activePreviewItem.id);
                  downloadSinglePhoto(activePreviewItem.dataUrl, index, activePreviewItem.type);
                }}
                title="Unduh file"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                <span>Unduh</span>
              </button>
              <button 
                className="btn btn-danger btn-lightbox-retake"
                onClick={() => {
                  deletePhoto(activePreviewItem.id);
                  setActivePreviewItem(null);
                }}
                title="Hapus file dan ambil ulang"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>Hapus & Take Ulang</span>
              </button>
              <button 
                className="btn btn-secondary btn-lightbox-close"
                onClick={() => setActivePreviewItem(null)}
                title="Tutup pratinjau"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Tutup</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
