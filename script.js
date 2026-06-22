(function () {
  const video = document.getElementById('video');
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const statusBadge = document.getElementById('status-badge');
  const statusLabel = document.getElementById('status-label');
  const statusText = document.getElementById('status-text');
  const btnStart = document.getElementById('btn-start');
  const btnSnapshot = document.getElementById('btn-snapshot');
  const btnSwitch = document.getElementById('btn-switch');
  const blurSlider = document.getElementById('blur-amount');
  const blurVal = document.getElementById('blur-amount-val');
  const fadeSlider = document.getElementById('fade-speed');
  const fadeVal = document.getElementById('fade-speed-val');

  let stream = null;
  let hands = null;
  let facingMode = 'user';
  let running = false;

  let blurAmount = 22;
  let fadeStep = 0.04;
  let currentBlur = 0;
  let peaceDetected = false;

  blurSlider.addEventListener('input', () => {
    blurAmount = parseInt(blurSlider.value, 10);
    blurVal.textContent = blurAmount + 'px';
  });

  fadeSlider.addEventListener('input', () => {
    const v = parseInt(fadeSlider.value, 10);
    fadeStep = v * 0.01;
    fadeVal.textContent = v;
  });

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
    statusBadge.classList.remove('loading', 'blurred');
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
      if (video.videoWidth > video.videoHeight) {
        stage.style.maxWidth = '640px';
      } else {
        stage.style.maxWidth = '480px';
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
        statusText.textContent = 'Memori tersimpan, gambarnya memudar...';
      } else {
        setBadge(null, 'Live');
        statusText.textContent = '';
      }
    }

    requestAnimationFrame(renderLoop);
  }

  async function processFrame() {
    if (!running) return;
    if (hands && video.readyState >= 2) {
      await hands.send({ image: video });
    }
    requestAnimationFrame(processFrame);
  }

  async function startCamera() {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      resizeCanvas();

      if (!hands) {
        await initHands();
      }

      running = true;
      setBadge(null, 'Live');
      processFrame();
      renderLoop();
    } catch (err) {
      setBadge('loading', 'Akses kamera ditolak');
      statusText.textContent = 'Periksa izin kamera di browser Anda.';
      console.error(err);
    }
  }

  btnStart.addEventListener('click', () => {
    startCamera();
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
