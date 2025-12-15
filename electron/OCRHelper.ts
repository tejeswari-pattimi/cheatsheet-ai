// OCRHelper.ts - Ultra-fast text extraction from screenshots
import { createWorker, Worker } from 'tesseract.js';
import fs from 'fs';
import sharp from 'sharp';

export class OCRHelper {
  private workers: Worker[] = [];
  private isInitialized: boolean = false;
  private workerCount: number = 4; // Use 4 workers for maximum parallel processing
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
        
        // SPEED-OPTIMIZED CONFIGURATION - Maximum speed with acceptable accuracy
        await worker.setParameters({
          tessedit_pageseg_mode: 6 as any, // Assume uniform block of text (fastest)
          tessedit_ocr_engine_mode: 1 as any, // LSTM only
          
          // Preserve whitespace (critical for code)
          preserve_interword_spaces: 1 as any,
          
          // Disable all dictionaries for maximum speed
          load_system_dawg: 0 as any,
          load_freq_dawg: 0 as any,
          load_unambig_dawg: 0 as any,
          load_punc_dawg: 0 as any,
          load_number_dawg: 0 as any,
          load_bigram_dawg: 0 as any,
          
          // Disable adaptive features for speed
          classify_enable_learning: 0 as any,
          classify_enable_adaptive_matcher: 0 as any,
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
      
      // Minimal upscaling for maximum speed
      const scaleFactor = originalWidth < 1920 ? 1.5 : 1.0;
      const targetWidth = Math.round(originalWidth * scaleFactor);
      const targetHeight = Math.round(originalHeight * scaleFactor);
      
      const processed = await sharp(imagePath)
        // Minimal upscaling
        .resize(targetWidth, targetHeight, {
          fit: 'fill',
          kernel: 'nearest' // Fastest resampling
        })
        // Convert to grayscale
        .grayscale()
        // Normalize contrast (essential for OCR)
        .normalize()
        // Output as PNG with minimal compression
        .png({
          compressionLevel: 0, // No compression for speed
          quality: 90
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
      
      // Perform OCR with speed-focused settings
      const { data: { text } } = await worker.recognize(imageBuffer, {
        rotateAuto: false, // Disable auto-rotation for speed
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
