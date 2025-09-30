import torch
from transformers import AutoTokenizer, AutoModel

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
OUTPUT_FILE = "embedding_model.pt"

print(f"Loading model {MODEL_ID}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModel.from_pretrained(MODEL_ID)

# Wrap the model so the forward() returns CLS embedding
class EmbeddingWrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask):
        outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
        # CLS token embedding
        return outputs.last_hidden_state[:, 0, :]

# Set model to evaluation mode
model.eval()

# Create dummy input for tracing
dummy_input = tokenizer("Hello world!", return_tensors="pt")

print("Tracing model...")
traced_model = torch.jit.trace(
    EmbeddingWrapper(model),
    (dummy_input["input_ids"], dummy_input["attention_mask"])
)

print(f"Saving TorchScript model to {OUTPUT_FILE}...")
traced_model.save(OUTPUT_FILE)

print("✅ TorchScript model saved successfully. You can now use it with RustBinaryEmbeddingService.")
