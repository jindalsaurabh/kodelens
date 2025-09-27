use anyhow::{Context, Result};
use std::env;
use std::path::Path;
use tch::{Device, Kind, Tensor, CModule, IValue};

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: rust_embed --model <path_to_model> <text>");
        std::process::exit(1);
    }

    // crude CLI parser (replace with clap later if needed)
    let mut model_path: Option<String> = None;
    let mut text: Option<String> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--model" => {
                if i + 1 < args.len() {
                    model_path = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            _ => {
                // assume first non-flag is the text input
                if text.is_none() {
                    text = Some(args[i].clone());
                }
            }
        }
        i += 1;
    }

    let model_path = model_path.context("Missing --model argument")?;
    let text = text.unwrap_or_else(|| "Hello world!".to_string());

    let device = Device::Cpu;

    // Ensure the model file exists
    if !Path::new(&model_path).exists() {
        anyhow::bail!("Model file does not exist: {}", model_path);
    }

    // Load TorchScript model
    let model = CModule::load_on_device(&model_path, device)
        .with_context(|| format!("Failed to load model from {}", model_path))?;

    // Dummy tokenized input (replace with real tokenizer later)
    let input_ids = Tensor::f_from_slice(&[101, 7592, 2088, 999, 102])?
        .reshape(&[1, 5])
        .to_kind(Kind::Int64);

    let attention_mask = Tensor::ones(&[1, 5], (Kind::Int64, device));

    let outputs = model.forward_is(&[
        IValue::Tensor(input_ids),
        IValue::Tensor(attention_mask),
    ])?;

    let embeddings: Tensor = outputs.try_into()?;
    let numel = embeddings.numel();
    let mut embeddings_vec = vec![0f32; numel as usize];
    embeddings.f_copy_data(&mut embeddings_vec, numel as usize)?;

    println!("Embeddings for '{}': {:?}", text, embeddings_vec);
    Ok(())
}
