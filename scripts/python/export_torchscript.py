import torch
from transformers import AutoTokenizer, AutoModel

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
OUTPUT_FILE = "embedding_model.pt"

print(f"Loading model {MODEL_ID}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModel.from_pretrained(MODEL_ID)

class EmbeddingWrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask):
        outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
        # use CLS token embedding
        return outputs.last_hidden_state[:, 0]

print("Tracing model...")
dummy = tokenizer("Hello world!", return_tensors="pt")
traced = torch.jit.trace(
    EmbeddingWrapper(model),
    (dummy["input_ids"], dummy["attention_mask"])
)

print(f"Saving TorchScript model to {OUTPUT_FILE}...")
traced.save(OUTPUT_FILE)
