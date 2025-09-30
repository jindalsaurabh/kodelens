from huggingface_hub import snapshot_download
import os

# Create models directory
model_dir = "./models/all-MiniLM-L6-v2"
os.makedirs(model_dir, exist_ok=True)

# Download the model files
snapshot_download(
    "sentence-transformers/all-MiniLM-L6-v2",
    local_dir=model_dir,
    local_dir_use_symlinks=False
)

print(f"Model downloaded to {model_dir}")