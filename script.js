(function () {
  const video = document.getElementById('video');
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const cameraPlaceholder = document.getElementById('camera-placeholder');
  
  const statusBadge = document.getElementById('status-badge');
  const statusLabel = document.getElementById('status-label');
  const statusText = document.getElementById('status-text');
  
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnSnapshot = document.getElementById('btn-snapshot');
  const btnSwitch = document.getElementById('btn-switch');

  let stream = null;
  let hands = null;
  let facingMode = 'user';
  let running = false;

  // Fixed parameters (8px blur, transition speed 4)
  const blurAmount = 8;
  const fadeStep = 0.04;
  
  let currentBlur = 0;
  let peaceDetected = false;

  let processFrameId = null;
  let renderLoopId = null;

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function isPeaceSign(landmarks) {
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
  }

  function setBadge(state, label) {
    statusBadge.classList.remove('loading', 'blurred', 'online', 'offline');
    if (state) statusBadge.classList.add(state);
    statusLabel.textContent = label;
  }

  function onResults(results) {
    let detected = false;
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const lm of results.multiHandLandmarks) {
        if (isPeaceSign(lm)) {
          detected = true;
          break;
        }
      }
    }
    peaceDetected = detected;
  }

  async function initHands() {
    hands = new Hands({
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
  }

  function resizeCanvas() {
    if (video.videoWidth && video.videoHeight) {
      stage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      if (window.innerWidth >= 768) {
        stage.style.maxWidth = '100%';
      } else {
        if (video.videoWidth > video.videoHeight) {
          stage.style.maxWidth = '100%';
        } else {
          stage.style.maxWidth = '480px';
        }
      }
    }
    canvas.width = video.videoWidth || stage.clientWidth;
    canvas.height = video.videoHeight || stage.clientHeight;
  }

  function renderLoop() {
    if (!running) return;

    if (video.videoWidth && video.videoHeight) {
      if (canvas.width !== video.videoWidth) resizeCanvas();

      const targetBlur = peaceDetected ? blurAmount : 0;
      if (currentBlur < targetBlur) {
        currentBlur = Math.min(targetBlur, currentBlur + blurAmount * fadeStep);
      } else if (currentBlur > targetBlur) {
        currentBlur = Math.max(targetBlur, currentBlur - blurAmount * fadeStep);
      }

      ctx.filter = currentBlur > 0.05 ? `blur(${currentBlur}px)` : 'none';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (currentBlur > 1) {
        setBadge('blurred', 'Foto kita blur ✌️');
        statusText.textContent = 'Foto Kita Blur...';
      } else {
        setBadge('online', 'Live');
        statusText.textContent = '';
      }
    }

    renderLoopId = requestAnimationFrame(renderLoop);
  }

  async function processFrame() {
    if (!running) return;
    if (hands && video.readyState >= 2) {
      try {
        await hands.send({ image: video });
      } catch (e) {
        console.error("Hands detection error:", e);
      }
    }
    processFrameId = requestAnimationFrame(processFrame);
  }

  async function startCamera() {
    try {
      setBadge('loading', 'Menghubungkan...');
      statusText.textContent = '';
      
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      
      if (cameraPlaceholder) cameraPlaceholder.classList.add('hidden');
      video.classList.add('active');
      
      resizeCanvas();

      if (!hands) {
        setBadge('loading', 'Memuat model...');
        await initHands();
      }

      running = true;
      setBadge('online', 'Live');
      
      // Toggle button visibility & state
      btnStart.classList.add('hidden');
      btnStop.classList.remove('hidden');
      btnSnapshot.disabled = false;
      btnSwitch.disabled = false;

      // Start loops
      processFrame();
      renderLoop();
    } catch (err) {
      setBadge('loading', 'Kamera Gagal');
      statusText.textContent = 'Periksa izin kamera di browser Anda.';
      console.error(err);
      stopCamera();
    }
  }

  function stopCamera() {
    running = false;
    peaceDetected = false;
    currentBlur = 0;

    if (processFrameId) {
      cancelAnimationFrame(processFrameId);
      processFrameId = null;
    }
    if (renderLoopId) {
      cancelAnimationFrame(renderLoopId);
      renderLoopId = null;
    }

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    
    video.srcObject = null;
    video.classList.remove('active');
    
    if (cameraPlaceholder) cameraPlaceholder.classList.remove('hidden');
    
    // Clear canvas content
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset button visibility & state
    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
    btnSnapshot.disabled = true;
    btnSwitch.disabled = true;
    
    setBadge('offline', 'Kamera Mati');
    statusText.textContent = '';
    
    // Reset stage dimensions to default 3/4 aspect ratio
    stage.style.aspectRatio = '';
    stage.style.maxWidth = '';
  }

  btnStart.addEventListener('click', () => {
    startCamera();
  });

  btnStop.addEventListener('click', () => {
    stopCamera();
  });

  btnSwitch.addEventListener('click', () => {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    canvas.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    startCamera();
  });

  btnSnapshot.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'foto-kita-blur.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
})();
