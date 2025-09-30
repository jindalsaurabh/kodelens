use anyhow::{Error, Result};
use candle_core::{Device, Tensor, DType};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config};
use serde::{Deserialize, Serialize};
use std::io;
use std::io::Write;
use tokenizers::tokenizer::Tokenizer;

#[derive(Serialize, Deserialize)]
struct EmbeddingRequest {
    texts: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct EmbeddingResponse {
    embeddings: Vec<Vec<f32>>,
    error: Option<String>,
}

fn main() -> Result<()> {
    // Set stdout to be unbuffered and ensure clean output
    let stdout = io::stdout();
    let mut handle = stdout.lock();
    
    // Read input from stdin
    let mut input = String::new();
    io::stdin().read_line(&mut input)?;
    
    let request: EmbeddingRequest = match serde_json::from_str(&input) {
        Ok(req) => req,
        Err(e) => {
            let response = EmbeddingResponse {
                embeddings: vec![],
                error: Some(format!("Invalid JSON input: {}", e)),
            };
            writeln!(handle, "{}", serde_json::to_string(&response)?)?;
            return Ok(());
        }
    };
    
    // Generate embeddings
    match generate_embeddings(&request.texts) {
        Ok(embeddings) => {
            let response = EmbeddingResponse {
                embeddings,
                error: None,
            };
            writeln!(handle, "{}", serde_json::to_string(&response)?)?;
        }
        Err(e) => {
            let response = EmbeddingResponse {
                embeddings: vec![],
                error: Some(format!("Embedding failed: {}", e)),
            };
            writeln!(handle, "{}", serde_json::to_string(&response)?)?;
        }
    }
    
    Ok(())
}

fn generate_embeddings(texts: &[String]) -> Result<Vec<Vec<f32>>> {
    let device = Device::Cpu;
    let model_dir = "./models/shipped/all-MiniLM-L6-v2";
    
    // Load tokenizer
    let tokenizer_path = format!("{}/tokenizer.json", model_dir);
    let tokenizer = Tokenizer::from_file(&tokenizer_path)
        .map_err(|e| Error::msg(format!("Tokenizer error: {}", e)))?;
    
    // Load config
    let config_path = format!("{}/config.json", model_dir);
    let config_content = std::fs::read_to_string(&config_path)?;
    let config: Config = serde_json::from_str(&config_content)?;
    
    // Load model weights
    let model_path = format!("{}/model.safetensors", model_dir);
    let vb = unsafe { 
        VarBuilder::from_mmaped_safetensors(&[model_path], DType::F32, &device)?
    };
    let model = BertModel::load(vb, &config)?;
    
    let mut embeddings = Vec::new();
    
    for text in texts {
        let encoding = tokenizer.encode(text.as_str(), true)
            .map_err(|e| Error::msg(format!("Tokenization failed: {}", e)))?;
        
        let token_ids: Vec<u32> = encoding.get_ids().to_vec();
        
        if token_ids.is_empty() {
            embeddings.push(vec![0.0; 384]);
            continue;
        }
        
        let tokens = Tensor::new(&token_ids[..], &device)?.unsqueeze(0)?;
        let token_type_ids = Tensor::zeros((1, token_ids.len()), DType::U32, &device)?;
        
        let output = model.forward(&tokens, &token_type_ids, None)?;
        let embedding = output.mean(1)?.squeeze(0)?;
        let embedding_vec: Vec<f32> = embedding.to_vec1()?;
        
        embeddings.push(embedding_vec);
    }
    
    Ok(embeddings)
}