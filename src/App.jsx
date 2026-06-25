import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [statusText, setStatusText] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);

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

  const dist = (a, b) => {
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const isPeaceSign = (landmarks) => {
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const indexMcp = landmarks[5];
    const middleTip = landmarks[12];
    const middleMcp = landmarks[9];
    const ringTip = landmarks[16];
    const ringMcp = landmarks[13];
    const pinkyTip = landmarks[20];
    const pinkyMcp = landmarks[17];

    const indexExtended = dist(wrist, indexTip) > dist(wrist, indexMcp) * 1.3;
    const middleExtended = dist(wrist, middleTip) > dist(wrist, middleMcp) * 1.3;
    const ringFolded = dist(wrist, ringTip) < dist(wrist, ringMcp) * 1.25;
    const pinkyFolded = dist(wrist, pinkyTip) < dist(wrist, pinkyMcp) * 1.25;

    return indexExtended && middleExtended && ringFolded && pinkyFolded;
  };

  const onResults = (results) => {
    let detected = false;
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const lm of results.multiHandLandmarks) {
        if (isPeaceSign(lm)) {
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
        modelComplexity: 0,
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
      stage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
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
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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

  const takeSnapshot = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'foto-kita-blur.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

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
    };
  }, []);

  const getStartButtonText = () => {
    if (isConnecting) return 'Menghubungkan...';
    if (isModelLoading) return 'Memuat model...';
    return 'Mulai Kamera';
  };

  const transformStyle = {
    transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)',
  };

  return (
    <>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <div className="app-card">
        <header>
          <div className="header-logo-row">
            <h1>Foto Kita Blur</h1>
          </div>
        </header>

        <div className="stage-container">
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
              style={transformStyle}
            ></canvas>

            {statusText && <div id="status-text">{statusText}</div>}
          </div>
        </div>

        {/* Controls */}
        <div className="controls">
          <button
            id="btn-snapshot"
            className="btn btn-secondary"
            disabled={!cameraActive}
            onClick={takeSnapshot}
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
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="btn-text">Ambil Foto</span>
          </button>

          {!cameraActive ? (
            <button
              id="btn-start"
              className="btn btn-primary"
              disabled={isConnecting || isModelLoading}
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
              <span>{getStartButtonText()}</span>
            </button>
          ) : (
            <button
              id="btn-stop"
              className="btn btn-danger"
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
              <span>Matiin Kamera</span>
            </button>
          )}

          <button
            id="btn-switch"
            className="btn btn-secondary"
            disabled={!cameraActive}
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
        </div>

        {/* Footer info */}
        <div className="tip-footer">
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
    </>
  );
}
