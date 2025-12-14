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
        
        // BALANCED CONFIGURATION - Better accuracy for code/text
        await worker.setParameters({
          tessedit_pageseg_mode: 3 as any, // Fully automatic page segmentation (better for mixed content)
          tessedit_ocr_engine_mode: 1 as any, // LSTM only (better accuracy)
          
          // Preserve whitespace and formatting (important for code)
          preserve_interword_spaces: 1 as any,
          
          // Better handling of numbers and special characters
          classify_bln_numeric_mode: 1 as any,
          
          // Keep some dictionaries for better word recognition
          load_system_dawg: 1 as any,
          load_freq_dawg: 1 as any,
          
          // Disable less useful dictionaries
          load_unambig_dawg: 0 as any,
          load_punc_dawg: 0 as any,
          load_number_dawg: 0 as any,
          load_bigram_dawg: 0 as any,
        });
        
        return worker;
      });
      
      this.workers = await Promise.all(workerPromises);
      this.isInitialized = true;
      console.log(`✓ ${this.workers.length} OCR workers initialized with balanced accuracy settings`);
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
   * Preprocess image for better OCR accuracy
   */
  private async preprocessImage(imagePath: string): Promise<Buffer> {
    try {
      // Better preprocessing for accuracy with code/text
      const processed = await sharp(imagePath)
        .resize(1920, 1080, { // Higher resolution for better accuracy
          fit: 'inside',
          withoutEnlargement: true,
          kernel: 'lanczos3' // Better quality kernel
        })
        .grayscale() // Convert to grayscale
        .normalize() // Improve contrast
        .sharpen() // Sharpen text edges
        .modulate({
          brightness: 1.1 // Slightly brighter
        })
        .linear(1.2, 0) // Increase contrast (multiplier, offset)
        .png({
          compressionLevel: 0,
          quality: 100
        })
        .toBuffer();
      
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
      
      // Preprocess image for faster OCR
      const imageBuffer = await this.preprocessImage(imagePath);
      
      // Perform OCR with minimal processing
      const { data: { text } } = await worker.recognize(imageBuffer, {
        rotateAuto: false, // Skip auto-rotation
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
