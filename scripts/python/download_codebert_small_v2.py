# download_codebert_small_v2.py

from huggingface_hub import snapshot_download
import os

def download_codebert_small_v2():
    # Define the local directory to store the model
    local_dir = os.path.join(os.getcwd(), "models", "codeBERT-small-v2")

    print(f"📥 Downloading codeBERT-small-v2 into: {local_dir}")

    # Download the model using snapshot_download
    snapshot_download(
        repo_id="codistai/codeBERT-small-v2",
        local_dir=local_dir,
        local_dir_use_symlinks=False,  # Ensure a real copy instead of symlinks
        revision="main"               # Ensure the latest version
    )

    print("✅ Download complete!")

if __name__ == "__main__":
    download_codebert_small_v2()
