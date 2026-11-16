const landingPage = document.getElementById('landing');
const checkPage = document.getElementById('check');
const isCheckPage = window.location.pathname.replace(/\/$/, '') === '/periksa';
landingPage.hidden = isCheckPage;
checkPage.hidden = !isCheckPage;
document.querySelector('body > .footer').hidden = !isCheckPage;
document.querySelectorAll('.nav-link').forEach((link) => {
  link.classList.toggle('active', link.dataset.page === (isCheckPage ? 'check' : 'home'));
});

if (isCheckPage) {
  const video = document.getElementById('camera');
  const canvas = document.getElementById('captureCanvas');
  const placeholder = document.getElementById('cameraPlaceholder');
  const viewfinder = document.getElementById('viewfinder');
  const status = document.getElementById('cameraStatus');
  const statusText = document.getElementById('cameraStatusText');
  const startButton = document.getElementById('startCamera');
  const captureButton = document.getElementById('capturePhoto');
  const retakeButton = document.getElementById('retakePhoto');
  const zoomControls = document.getElementById('cameraZoom');
  const zoomRange = document.getElementById('zoomRange');
  const zoomValue = document.getElementById('zoomValue');
  const zoomOut = document.getElementById('zoomOut');
  const zoomIn = document.getElementById('zoomIn');
  const errorBox = document.getElementById('cameraError');
  const resultEmpty = document.getElementById('resultEmpty');
  const resultData = document.getElementById('resultData');
  const resultDate = document.getElementById('resultDate');
  const printReceipt = document.getElementById('printReceipt');
  let stream = null;
  let capturedBlob = null;
  let cameraTrack = null;
  let hardwareZoom = false;
  let nativeZoomLevel = 1;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function setCameraActive(active) {
    status.classList.toggle('on', active);
    statusText.textContent = active ? 'KAMERA AKTIF' : 'MENUNGGU KAMERA';
  }

  async function startCamera() {
    errorBox.hidden = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      showError('Browser ini belum mendukung kamera. Buka website melalui localhost atau HTTPS.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      cameraTrack = stream.getVideoTracks()[0];
      const zoomCapability = cameraTrack.getCapabilities?.().zoom;
      hardwareZoom = Boolean(zoomCapability && zoomCapability.max > zoomCapability.min && cameraTrack.applyConstraints);
      if (hardwareZoom) {
        const settingsZoom = cameraTrack.getSettings?.().zoom;
        const minZoom = Number(zoomCapability.min) || 1;
        const maxZoom = Math.min(5, Number(zoomCapability.max));
        nativeZoomLevel = Math.min(maxZoom, Math.max(minZoom, Number(settingsZoom) || minZoom));
        zoomRange.min = String(minZoom);
        zoomRange.max = String(maxZoom);
      } else {
        nativeZoomLevel = 1;
        zoomRange.min = '1';
        zoomRange.max = '3';
      }
      zoomRange.value = String(nativeZoomLevel);
      zoomValue.textContent = `${nativeZoomLevel.toFixed(1)}×`;
      video.srcObject = stream;
      video.hidden = false;
      placeholder.hidden = true;
      viewfinder.hidden = false;
      startButton.hidden = true;
      captureButton.hidden = false;
      retakeButton.hidden = true;
      zoomControls.hidden = false;
      canvas.classList.remove('preview');
      video.style.transform = `scaleX(-1) scale(${hardwareZoom ? 1 : nativeZoomLevel})`;
      setCameraActive(true);
    } catch (error) {
      const message = error.name === 'NotAllowedError'
        ? 'Akses kamera belum diizinkan. Ubah izin kamera di browser, lalu coba lagi.'
        : 'Kamera tidak dapat dibuka. Pastikan perangkat memiliki kamera dan tidak sedang digunakan aplikasi lain.';
      showError(message);
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    cameraTrack = null;
  }

  async function updateZoom() {
    const requestedZoom = Number(zoomRange.value);
    zoomValue.textContent = `${requestedZoom.toFixed(1)}×`;
    errorBox.hidden = true;

    if (hardwareZoom && cameraTrack) {
      try {
        await cameraTrack.applyConstraints({ advanced: [{ zoom: requestedZoom }] });
        nativeZoomLevel = requestedZoom;
        video.style.transform = 'scaleX(-1)';
        return;
      } catch {
        hardwareZoom = false;
      }
    }

    const digitalZoom = requestedZoom / nativeZoomLevel;
    video.style.transform = `scaleX(-1) scale(${digitalZoom})`;
  }

  function resetCapture() {
    capturedBlob = null;
    errorBox.hidden = true;
    video.hidden = false;
    canvas.classList.remove('preview');
    canvas.hidden = true;
    viewfinder.hidden = false;
    zoomControls.hidden = false;
    retakeButton.hidden = true;
    captureButton.hidden = false;
    resultEmpty.hidden = false;
    resultData.hidden = true;
    printReceipt.hidden = true;
  }

  function capturePhoto() {
    if (!video.videoWidth) {
      showError('Kamera sedang disiapkan. Tunggu sebentar, lalu ambil gambar.');
      return;
    }
    const zoom = hardwareZoom ? 1 : Number(zoomRange.value) / nativeZoomLevel;
    const size = Math.min(video.videoWidth, video.videoHeight) / zoom;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    canvas.width = 720;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return showError('Foto tidak dapat diproses. Coba lagi.');
      capturedBlob = blob;
      video.hidden = true;
      canvas.hidden = false;
      canvas.classList.add('preview');
      viewfinder.hidden = true;
      zoomControls.hidden = true;
      captureButton.hidden = true;
      retakeButton.hidden = false;
      errorBox.hidden = true;
      analyze(blob);
    }, 'image/jpeg', 0.92);
  }

  async function analyze(blob) {
    resultEmpty.hidden = true;
    resultData.hidden = true;
    printReceipt.hidden = true;
    statusText.textContent = 'MENGANALISIS GAMBAR';
    const form = new FormData();
    form.append('image', blob, 'eye.jpg');
    try {
      const response = await fetch('/api/predict', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analisis tidak berhasil. Silakan coba lagi.');
      const cataract = Number(data.cataract);
      const normal = Number(data.normal);
      const likelyLabel = cataract >= normal ? 'Katarak' : 'Normal';
      const likelyPercent = Math.max(cataract, normal);
      resultDate.textContent = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date());
      document.getElementById('mainPercent').textContent = `${likelyPercent.toFixed(1)}%`;
      document.getElementById('mainLabel').textContent = likelyLabel;
      document.getElementById('cataractPercent').textContent = `${cataract.toFixed(1)}%`;
      document.getElementById('normalPercent').textContent = `${normal.toFixed(1)}%`;
      document.getElementById('cataractBar').style.width = `${cataract}%`;
      document.getElementById('normalBar').style.width = `${normal}%`;
      document.getElementById('resultRing').style.background = `conic-gradient(#b3d2f5 ${likelyPercent * 3.6}deg, rgba(186,215,247,.08) 0deg)`;
      resultEmpty.hidden = true;
      resultData.hidden = false;
      printReceipt.hidden = false;
    } catch (error) {
      resultEmpty.hidden = false;
      printReceipt.hidden = true;
      showError(error.message);
    } finally {
      statusText.textContent = 'FOTO SIAP';
    }
  }

  startButton.addEventListener('click', startCamera);
  captureButton.addEventListener('click', capturePhoto);
  retakeButton.addEventListener('click', resetCapture);
  zoomRange.addEventListener('input', updateZoom);
  zoomOut.addEventListener('click', () => zoomRange.stepDown());
  zoomIn.addEventListener('click', () => zoomRange.stepUp());
  printReceipt.addEventListener('click', () => window.print());
  window.addEventListener('pagehide', stopCamera);
}
