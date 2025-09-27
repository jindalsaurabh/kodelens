# download_gte_small.py

from huggingface_hub import snapshot_download
import os

def download_gte_small():
    # Where you want to store the model
    local_dir = os.path.join(os.getcwd(), "models", "gte-small")

    print(f"📥 Downloading thenlper/gte-small into: {local_dir}")

    snapshot_download(
        repo_id="thenlper/gte-small",
        local_dir=local_dir,
        local_dir_use_symlinks=False,
        revision="main"
    )

    print("✅ Download complete!")

if __name__ == "__main__":
    download_gte_small()
