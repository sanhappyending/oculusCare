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
  const errorBox = document.getElementById('cameraError');
  const resultEmpty = document.getElementById('resultEmpty');
  const resultData = document.getElementById('resultData');
  const resultIntro = document.getElementById('resultIntro');
  const resultFootnote = document.getElementById('resultFootnote');
  let stream = null;
  let capturedBlob = null;

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
      video.srcObject = stream;
      video.hidden = false;
      placeholder.hidden = true;
      viewfinder.hidden = false;
      startButton.hidden = true;
      captureButton.hidden = false;
      retakeButton.hidden = true;
      canvas.classList.remove('preview');
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
  }

  function resetCapture() {
    capturedBlob = null;
    errorBox.hidden = true;
    video.hidden = false;
    canvas.classList.remove('preview');
    canvas.hidden = true;
    viewfinder.hidden = false;
    retakeButton.hidden = true;
    captureButton.hidden = false;
    resultEmpty.hidden = false;
    resultData.hidden = true;
    resultFootnote.hidden = true;
    resultIntro.textContent = 'Hasil persentase akan muncul setelah gambar mata dianalisis.';
  }

  function capturePhoto() {
    if (!video.videoWidth) {
      showError('Kamera sedang disiapkan. Tunggu sebentar, lalu ambil gambar.');
      return;
    }
    const size = Math.min(video.videoWidth, video.videoHeight);
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
      captureButton.hidden = true;
      retakeButton.hidden = false;
      errorBox.hidden = true;
      analyze(blob);
    }, 'image/jpeg', 0.92);
  }

  async function analyze(blob) {
    resultEmpty.hidden = true;
    resultData.hidden = true;
    resultFootnote.hidden = true;
    resultIntro.textContent = 'Gambar sedang dianalisis oleh model AI…';
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
      document.getElementById('mainPercent').textContent = `${likelyPercent.toFixed(1)}%`;
      document.getElementById('mainLabel').textContent = likelyLabel;
      document.getElementById('cataractPercent').textContent = `${cataract.toFixed(1)}%`;
      document.getElementById('normalPercent').textContent = `${normal.toFixed(1)}%`;
      document.getElementById('cataractBar').style.width = `${cataract}%`;
      document.getElementById('normalBar').style.width = `${normal}%`;
      document.getElementById('resultRing').style.background = `conic-gradient(#b3d2f5 ${likelyPercent * 3.6}deg, rgba(186,215,247,.08) 0deg)`;
      resultEmpty.hidden = true;
      resultData.hidden = false;
      resultFootnote.hidden = false;
      resultIntro.textContent = 'Perkiraan model untuk gambar yang kamu ambil.';
    } catch (error) {
      resultEmpty.hidden = false;
      resultIntro.textContent = 'Analisis belum berhasil diselesaikan.';
      showError(error.message);
    } finally {
      statusText.textContent = 'FOTO SIAP';
    }
  }

  startButton.addEventListener('click', startCamera);
  captureButton.addEventListener('click', capturePhoto);
  retakeButton.addEventListener('click', resetCapture);
  window.addEventListener('pagehide', stopCamera);
}
