#!/usr/bin/env python3
from transformers import AutoModel, AutoTokenizer
import torch
from safetensors.torch import save_file
import os
import json

def convert_model_for_candle():
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    output_dir = "./candle-model"
    
    print(f"Downloading {model_name}...")
    
    # Load model and tokenizer
    model = AutoModel.from_pretrained(model_name)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Save tokenizer files
    tokenizer.save_pretrained(output_dir)
    
    # Convert model to safetensors format
    state_dict = model.state_dict()
    
    # Remove unnecessary prefixes that might cause issues in Candle
    cleaned_state_dict = {}
    for key, value in state_dict.items():
        # Remove 'bert.' or 'roberta.' prefix if present
        new_key = key.replace("bert.", "").replace("roberta.", "").replace("model.", "")
        cleaned_state_dict[new_key] = value
    
    # Save as safetensors
    safetensors_path = os.path.join(output_dir, "model.safetensors")
    save_file(cleaned_state_dict, safetensors_path)
    print(f"Model saved as safetensors: {safetensors_path}")
    
    # Create a Candle-compatible config
    config = {
        "vocab_size": tokenizer.vocab_size,
        "hidden_size": 384,
        "num_hidden_layers": 6,
        "num_attention_heads": 12,
        "intermediate_size": 1536,
        "hidden_act": "gelu",
        "hidden_dropout_prob": 0.1,
        "attention_probs_dropout_prob": 0.1,
        "max_position_embeddings": 512,
        "type_vocab_size": 2,
        "initializer_range": 0.02,
        "layer_norm_eps": 1e-12,
        "pad_token_id": tokenizer.pad_token_id,
        "model_type": "bert"
    }
    
    config_path = os.path.join(output_dir, "config.json")
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"Config saved: {config_path}")
    
    print(f"Model successfully converted to Candle format in: {output_dir}")
    print(f"Estimated size: ~80MB")

if __name__ == "__main__":
    convert_model_for_candle()