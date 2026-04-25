import os
import shutil
import urllib.request
import zipfile
from pathlib import Path

MODEL_ROOT = Path(os.path.expanduser(os.getenv("INSIGHTFACE_MODEL_ROOT", "./.insightface/models")))
MODEL_PACK = os.getenv("INSIGHTFACE_MODEL_PACK", "buffalo_sc")
MODEL_BASE_URL = os.getenv(
    "INSIGHTFACE_MODEL_BASE_URL",
    "https://github.com/deepinsight/insightface/releases/download/v0.7",
)


def has_onnx(model_name: str) -> bool:
    return any((MODEL_ROOT / model_name).glob("*.onnx"))


def normalize_layout(model_name: str) -> None:
    pack_dir = MODEL_ROOT / model_name
    nested_pack_dir = pack_dir / model_name

    if nested_pack_dir.exists() and any(nested_pack_dir.glob("*.onnx")) and not has_onnx(model_name):
        pack_dir.mkdir(parents=True, exist_ok=True)
        for item in nested_pack_dir.iterdir():
            target = pack_dir / item.name
            if target.exists():
                continue
            shutil.move(str(item), str(target))
        try:
            nested_pack_dir.rmdir()
        except OSError:
            pass

    if not has_onnx(model_name):
        root_onnx = list(MODEL_ROOT.glob("*.onnx"))
        if root_onnx:
            pack_dir.mkdir(parents=True, exist_ok=True)
            for onnx in root_onnx:
                target = pack_dir / onnx.name
                if target.exists():
                    continue
                shutil.move(str(onnx), str(target))


def preload() -> None:
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    normalize_layout(MODEL_PACK)
    if has_onnx(MODEL_PACK):
        print(f"Model already present: {MODEL_PACK}")
        return

    url = f"{MODEL_BASE_URL}/{MODEL_PACK}.zip"
    zip_path = MODEL_ROOT / f"{MODEL_PACK}.zip"
    print(f"Downloading model pack: {url}")
    urllib.request.urlretrieve(url, zip_path)

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(MODEL_ROOT)

    normalize_layout(MODEL_PACK)
    try:
        zip_path.unlink(missing_ok=True)
    except OSError:
        pass

    if not has_onnx(MODEL_PACK):
        raise RuntimeError(f"No ONNX files found for model pack: {MODEL_PACK}")

    print(f"Model ready: {MODEL_ROOT / MODEL_PACK}")


if __name__ == "__main__":
    preload()
