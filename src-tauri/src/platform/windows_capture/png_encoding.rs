use std::io::Write as IoWrite;
use std::path::Path;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

/// Parameters for PNG encoding
pub struct PngEncodeParams<'a> {
    pub output_path: &'a Path,
    pub width: u32,
    pub height: u32,
    pub rgba_pixels: &'a [u8],
}

pub fn write_rgba_png(params: PngEncodeParams<'_>) -> Result<(), AppError> {
    let row_len = (params.width as usize) * 4;
    let mut raw_data = Vec::with_capacity((row_len + 1) * params.height as usize);
    for row in params.rgba_pixels.chunks_exact(row_len) {
        raw_data.push(0u8);
        raw_data.extend_from_slice(row);
    }

    let compressed = deflate_zlib(&raw_data);

    let mut file = std::fs::File::create(params.output_path).map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Failed to create capture file: {error}"),
            false,
        )
    })?;

    file.write_all(&[137, 80, 78, 71, 13, 10, 26, 10])
        .map_err(map_png_write_error)?;

    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&params.width.to_be_bytes());
    ihdr.extend_from_slice(&params.height.to_be_bytes());
    ihdr.push(8);
    ihdr.push(6);
    ihdr.push(0);
    ihdr.push(0);
    ihdr.push(0);
    write_png_chunk(&mut file, b"IHDR", &ihdr)?;
    write_png_chunk(&mut file, b"IDAT", &compressed)?;
    write_png_chunk(&mut file, b"IEND", &[])?;
    Ok(())
}

fn write_png_chunk(
    file: &mut std::fs::File,
    chunk_type: &[u8; 4],
    data: &[u8],
) -> Result<(), AppError> {
    let len = data.len() as u32;
    file.write_all(&len.to_be_bytes())
        .map_err(map_png_write_error)?;
    file.write_all(chunk_type).map_err(map_png_write_error)?;
    file.write_all(data).map_err(map_png_write_error)?;

    let mut crc_input = Vec::with_capacity(4 + data.len());
    crc_input.extend_from_slice(chunk_type);
    crc_input.extend_from_slice(data);
    let crc = png_crc32(&crc_input);
    file.write_all(&crc.to_be_bytes())
        .map_err(map_png_write_error)?;
    Ok(())
}

fn map_png_write_error(error: std::io::Error) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Failed to write PNG: {error}"),
        false,
    )
}

fn png_crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFFFFFF;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB88320;
            } else {
                crc >>= 1;
            }
        }
    }
    crc ^ 0xFFFFFFFF
}

fn deflate_zlib(data: &[u8]) -> Vec<u8> {
    let mut output = Vec::new();
    output.push(0x78);
    output.push(0x01);

    let chunks: Vec<&[u8]> = data.chunks(65535).collect();
    for (index, chunk) in chunks.iter().enumerate() {
        let is_last = index == chunks.len() - 1;
        output.push(if is_last { 0x01 } else { 0x00 });
        let len = chunk.len() as u16;
        let nlen = !len;
        output.extend_from_slice(&len.to_le_bytes());
        output.extend_from_slice(&nlen.to_le_bytes());
        output.extend_from_slice(chunk);
    }

    let adler = adler32(data);
    output.extend_from_slice(&adler.to_be_bytes());
    output
}

fn adler32(data: &[u8]) -> u32 {
    let mut a: u32 = 1;
    let mut b: u32 = 0;
    for &byte in data {
        a = (a + byte as u32) % 65521;
        b = (b + a) % 65521;
    }
    (b << 16) | a
}
