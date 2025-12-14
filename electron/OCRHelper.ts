// OCRHelper.ts - Ultra-fast text extraction from screenshots
import { createWorker, Worker } from 'tesseract.js';
import fs from 'fs';
import sharp from 'sharp';

export class OCRHelper {
  private workers: Worker[] = [];
  private isInitialized: boolean = false;
  private workerCount: number = 2; // Use 2 workers for parallel processing
  private currentWorkerIndex: number = 0;

  constructor() {
    this.initializeWorkers();
  }

  private async initializeWorkers(): Promise<void> {
    try {
      console.log(`Initializing ${this.workerCount} Tesseract OCR workers...`);
      
      // Create multiple workers in parallel
      const workerPromises = Array.from({ length: this.workerCount }, async () => {
        const worker = await createWorker('eng', 1, {
          logger: () => {}, // Disable logging for speed
          errorHandler: () => {} // Disable error logging
        });
        
        // OPTIMIZED CONFIGURATION - Maximum accuracy for code/text
        await worker.setParameters({
          tessedit_pageseg_mode: 1 as any, // Automatic page segmentation with OSD (Orientation and Script Detection)
          tessedit_ocr_engine_mode: 1 as any, // LSTM only (best accuracy)
          
          // Preserve whitespace and formatting (critical for code)
          preserve_interword_spaces: 1 as any,
          
          // Better handling of numbers and special characters
          classify_bln_numeric_mode: 1 as any,
          
          // Enable all dictionaries for maximum accuracy
          load_system_dawg: 1 as any,
          load_freq_dawg: 1 as any,
          load_unambig_dawg: 1 as any,
          load_punc_dawg: 1 as any,
          load_number_dawg: 1 as any,
          load_bigram_dawg: 1 as any,
          
          // Character whitelist for code (letters, numbers, common symbols)
          // Removed to allow all characters for better flexibility
          
          // Improve character recognition
          classify_enable_learning: 1 as any,
          classify_enable_adaptive_matcher: 1 as any,
        });
        
        return worker;
      });
      
      this.workers = await Promise.all(workerPromises);
      this.isInitialized = true;
      console.log(`✓ ${this.workers.length} OCR workers initialized with MAXIMUM ACCURACY settings`);
    } catch (error) {
      console.error('Failed to initialize OCR workers:', error);
      this.isInitialized = false;
    }
  }
  
  private getNextWorker(): Worker | null {
    if (this.workers.length === 0) return null;
    const worker = this.workers[this.currentWorkerIndex];
    this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Preprocess image for maximum OCR accuracy
   * Tesseract works best with 300 DPI images and clean black/white text
   */
  private async preprocessImage(imagePath: string): Promise<Buffer> {
    try {
      // Get image metadata
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const originalWidth = metadata.width || 1920;
      const originalHeight = metadata.height || 1080;
      
      // Calculate optimal size for OCR (aim for ~300 DPI equivalent)
      // For typical screen text, 2x-3x upscaling works well
      const scaleFactor = originalWidth < 1920 ? 2.5 : 1.5;
      const targetWidth = Math.round(originalWidth * scaleFactor);
      const targetHeight = Math.round(originalHeight * scaleFactor);
      
      const processed = await sharp(imagePath)
        // Upscale for better text recognition
        .resize(targetWidth, targetHeight, {
          fit: 'fill',
          kernel: 'lanczos3' // Highest quality resampling
        })
        // Convert to grayscale (better for text recognition)
        .grayscale()
        // Normalize to improve contrast (adaptive)
        .normalize()
        // Moderate sharpening (not too aggressive)
        .sharpen({
          sigma: 1.0,
          m1: 0.5,
          m2: 1.5
        })
        // Slight brightness boost
        .modulate({
          brightness: 1.1
        })
        // Moderate contrast boost (less aggressive than before)
        .linear(1.3, -(128 * 0.3))
        // Gentle gamma correction
        .gamma(1.1)
        // Output as high-quality PNG (no threshold - let Tesseract handle it)
        .png({
          compressionLevel: 0,
          quality: 100
        })
        .toBuffer();
      
      console.log(`OCR preprocessing: ${originalWidth}x${originalHeight} → ${targetWidth}x${targetHeight} (${scaleFactor.toFixed(1)}x scale)`);
      
      return processed;
    } catch (error) {
      console.error('Image preprocessing failed, using original:', error);
      return fs.readFileSync(imagePath);
    }
  }

  /**
   * Extract text from screenshot file with improved accuracy
   */
  public async extractText(imagePath: string): Promise<string> {
    if (!this.isInitialized || this.workers.length === 0) {
      console.log('OCR workers not initialized, initializing now...');
      await this.initializeWorkers();
    }

    const worker = this.getNextWorker();
    if (!worker) {
      console.error('OCR workers failed to initialize');
      return ''; // Return empty string instead of throwing
    }

    try {
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.error(`Image file not found: ${imagePath}`);
        return '';
      }

      const startTime = Date.now();
      
      // Preprocess image for maximum accuracy
      const imageBuffer = await this.preprocessImage(imagePath);
      
      // Perform OCR with accuracy-focused settings
      const { data: { text } } = await worker.recognize(imageBuffer, {
        rotateAuto: true, // Enable auto-rotation for better accuracy
        rotateRadians: 0
      });
      
      const duration = Date.now() - startTime;
      console.log(`✓ OCR completed in ${duration}ms (${text.length} chars)`);
      
      return text.trim();
    } catch (error) {
      console.error('OCR extraction failed:', error);
      return ''; // Return empty string instead of throwing
    }
  }

  /**
   * Extract text from multiple screenshots - PARALLEL PROCESSING
   */
  public async extractTextFromMultiple(imagePaths: string[]): Promise<string> {
    if (!imagePaths || imagePaths.length === 0) {
      return '';
    }
    
    try {
      // Process all images in parallel for maximum speed
      const textPromises = imagePaths.map(imagePath => this.extractText(imagePath));
      const texts = await Promise.all(textPromises);
      
      // Filter out empty results
      const validTexts = texts.filter(text => text && text.trim().length > 0);
      
      return validTexts.join('\n\n---\n\n');
    } catch (error) {
      console.error('Error extracting text from multiple images:', error);
      return '';
    }
  }

  /**
   * Cleanup worker
   */
  public async terminate(): Promise<void> {
    try {
      if (this.workers.length > 0) {
        await Promise.all(this.workers.map(w => w.terminate()));
        this.workers = [];
        this.isInitialized = false;
        console.log('OCR workers terminated');
      }
    } catch (error) {
      console.error('Error terminating OCR workers:', error);
      this.workers = [];
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const ocrHelper = new OCRHelper();
