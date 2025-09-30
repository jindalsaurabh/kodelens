from transformers import AutoModel, AutoTokenizer
import torch

# Load and quantize model
model_name = "microsoft/codebert-base"
model = AutoModel.from_pretrained(model_name)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Quantize to int8
quantized_model = torch.quantization.quantize_dynamic(
    model, {torch.nn.Linear}, dtype=torch.qint8
)

# Save quantized
quantized_model.save_pretrained("./quantized-codebert")
tokenizer.save_pretrained("./quantized-codebert")

print("Model quantized and saved!")