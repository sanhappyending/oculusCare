import io
import json
import os
from pathlib import Path

import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from PIL import Image, UnidentifiedImageError


ROOT = Path(__file__).resolve().parent
model = None


def create_app():
    app = Flask(__name__, static_folder=str(ROOT / "public"), static_url_path="")
    app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

    @app.get("/")
    @app.get("/periksa")
    def home():
        return send_from_directory(ROOT / "public", "index.html")

    @app.post("/api/predict")
    def predict():
        uploaded = request.files.get("image")
        if uploaded is None:
            return jsonify(error="Gambar tidak ditemukan. Ambil foto mata terlebih dahulu."), 400

        try:
            image = Image.open(io.BytesIO(uploaded.read())).convert("RGB")
            image = image.resize((224, 224), Image.Resampling.LANCZOS)
        except (UnidentifiedImageError, OSError, ValueError):
            return jsonify(error="Gambar tidak dapat dibaca. Coba ambil foto kembali."), 400

        pixels = np.asarray(image, dtype=np.float32)
        pixels = (pixels / 127.5) - 1.0
        output = float(np.asarray(get_model().predict(pixels[None, ...], verbose=0)).reshape(-1)[0])
        output = min(1.0, max(0.0, output))

        # Sigmoid class order is not in the supplied metadata; default to alphabetical
        # Cataract/Normal folders. Set MODEL_POSITIVE_CLASS=cataract if training differed.
        positive_class = os.environ.get("MODEL_POSITIVE_CLASS", "normal").strip().lower()
        if positive_class not in {"normal", "cataract"}:
            positive_class = "normal"
        normal = output if positive_class == "normal" else 1.0 - output
        cataract = 1.0 - normal
        return jsonify(
            cataract=round(cataract * 100, 1),
            normal=round(normal * 100, 1),
            positive_class=positive_class,
        )

    @app.errorhandler(413)
    def image_too_large(_error):
        return jsonify(error="Ukuran gambar terlalu besar. Coba ambil foto kembali."), 413

    return app


def get_model():
    """Build the saved architecture from config.json and load its trained weights."""
    global model
    if model is None:
        from tensorflow import keras

        architecture = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
        model = keras.models.model_from_json(json.dumps(architecture))
        model.load_weights(ROOT / "model.weights.h5")
    return model


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
