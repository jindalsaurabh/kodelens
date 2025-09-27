# download_minilm_quantized.py

from huggingface_hub import snapshot_download
from transformers import AutoModel, AutoTokenizer
from optimum.onnxruntime import ORTModelForFeatureExtraction
from optimum.onnxruntime.configuration import OptimizationConfig
from optimum.onnxruntime import ORTOptimizer
import os

def download_and_quantize_minilm():
    repo_id = "sentence-transformers/all-MiniLM-L6-v2"
    local_dir = os.path.join(os.getcwd(), "models", "all-MiniLM-L6-v2")

    print(f"📥 Downloading {repo_id} into {local_dir} ...")
    snapshot_download(repo_id=repo_id, local_dir=local_dir, local_dir_use_symlinks=False)

    print("⚡ Converting to ONNX + applying int8 quantization ...")

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(local_dir)

    # Convert model to ONNX
    onnx_path = os.path.join(local_dir, "onnx")
    model = ORTModelForFeatureExtraction.from_pretrained(local_dir, from_transformers=True)
    model.save_pretrained(onnx_path)
    tokenizer.save_pretrained(onnx_path)

    # Quantize with dynamic int8
    optimizer = ORTOptimizer.from_pretrained(model)
    optimization_config = OptimizationConfig(optimization_level=99)
    optimizer.export(onnx_path, optimization_config=optimization_config, quantization=True)

    print(f"✅ Quantized model saved in {onnx_path}")

if __name__ == "__main__":
    download_and_quantize_minilm()
