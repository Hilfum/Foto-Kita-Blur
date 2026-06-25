import React, { useState, useEffect, useRef } from 'react';

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

    // Clear active timer interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setCountdown(0);

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
          triggerCapture();
        }
      }, 1000);
    } else {
      triggerCapture();
    }
  };

  const downloadSinglePhoto = (dataUrl, index) => {
    const link = document.createElement('a');
    link.download = `foto-kita-blur-${index + 1}.png`;
    link.href = dataUrl;
    link.click();
  };

  const downloadAllPhotos = () => {
    capturedPhotos.forEach((photo, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.download = `foto-kita-blur-${index + 1}.png`;
        link.href = photo.dataUrl;
        link.click();
      }, index * 200);
    });
  };

  const deletePhoto = (id) => {
    setCapturedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const clearAllPhotos = () => {
    setConfirmModalState('open');
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
          <header className="fade-in-element">
            <div className="header-logo-row">
              <h1>Foto Kita Blur</h1>
            </div>
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
                style={transformStyle}
              ></canvas>

              {statusText && <div id="status-text">{statusText}</div>}

              {/* Timer Countdown Overlay */}
              {countdown > 0 && <div className="countdown-overlay">{countdown}</div>}

              {/* Shutter Flash Effect */}
              {isFlashing && <div className="flash-overlay"></div>}
            </div>
          </div>

          {/* Session Gallery */}
          {capturedPhotos.length > 0 && (
            <div className="gallery-section fade-in-element fade-in-delay-2">
              <div className="gallery-header">
                <h3>Hasil Foto Sesi Ini ({capturedPhotos.length})</h3>
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
                  <div key={photo.id} className="gallery-item">
                    <img src={photo.dataUrl} alt={`Captured ${index + 1}`} />
                    <div className="item-overlay">
                      <button 
                        className="item-btn btn-download" 
                        onClick={() => downloadSinglePhoto(photo.dataUrl, index)}
                        title="Unduh foto"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                      </button>
                      <button 
                        className="item-btn btn-delete" 
                        onClick={() => deletePhoto(photo.id)}
                        title="Hapus foto"
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
          )}

          {/* Controls */}
          <div className="controls fade-in-element fade-in-delay-2">
            <button
              id="btn-change-mode-control"
              className="btn btn-secondary"
              onClick={() => {
                stopCamera();
                setOrientationMode(null);
              }}
              title="Kembali ke pemilihan layout"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span className="btn-text">Ubah Tampilan</span>
            </button>

            <button
              id="btn-snapshot"
              className="btn btn-secondary"
              disabled={!cameraActive || countdown > 0}
              onClick={handleCaptureClick}
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
                <span className="btn-text">{getStartButtonText()}</span>
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
                <span className="btn-text">Matiin Kamera</span>
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

            <button
              id="btn-timer"
              className="btn btn-secondary"
              disabled={!cameraActive}
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
            <h3>Hapus Semua Foto?</h3>
            <p>Tindakan ini akan menghapus semua foto di galeri sesi ini. Anda tidak dapat membatalkan tindakan ini.</p>
            <div className="modal-buttons">
              <button 
                className="btn btn-danger" 
                onClick={() => {
                  setConfirmModalState('closing-confirm');
                  setTimeout(() => {
                    setCapturedPhotos([]);
                    setConfirmModalState(null);
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
                  }, 300); // Wait for exit animation to complete
                }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
