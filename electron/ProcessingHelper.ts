import sharp from "sharp"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { ocrHelper } from "./OCRHelper"
import { ErrorHandler } from "./errors/ErrorHandler"
import { performanceMonitor } from "./utils/PerformanceMonitor"
import { GroqProvider } from "./processing/ai-providers/GroqProvider"
import { API } from "./constants/app-constants"
import { MCQParser, WebDevParser, PythonParser, TextParser, ResponseParser } from "./processing/parsers/Parsers"
import { getSystemPrompt } from "./processing/prompts/system-prompts"

export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper | null = null

  // AI Providers
  private groqProvider: GroqProvider;

  // Parsers
  private parsers: ResponseParser[] = [];

  // Conversation history for debugging
  private conversationHistory: Array<{ role: string, content: any }> = []
  private lastResponse: string = ""

  // AbortControllers
  private currentAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    try {
      this.screenshotHelper = deps.getScreenshotHelper()
    } catch (error) {
      console.error('Error getting screenshot helper:', error)
    }

    this.groqProvider = new GroqProvider();

    // Initialize Parsers
    this.parsers = [
      new MCQParser(),
      new WebDevParser(),
      new PythonParser(),
      new TextParser() // Fallback
    ];
  }

  public cancelOngoingRequests(): void {
    try {
      if (this.currentAbortController) {
        this.currentAbortController.abort()
        this.currentAbortController = null
      }
    } catch (error) {
      console.error('Error canceling ongoing requests:', error)
      this.currentAbortController = null
    }
  }

  // MAIN PROCESSING - Single API call
  public async processScreenshots() {
    performanceMonitor.startTimer('processScreenshots (Total)');
    try {
      const view = this.deps.getView()
      const mainQueue = this.deps.getScreenshotQueue() || []
      const extraQueue = this.deps.getExtraScreenshotQueue() || []

      console.log(`processScreenshots called - View: ${view}, Main queue: ${mainQueue.length}, Extra queue: ${extraQueue.length}`)

      // If we have screenshots in main queue, it's a new question (even if view is "solutions")
      if (mainQueue.length > 0) {
        console.log("Processing main queue (new question)")
        // Reset to queue view for new question
        this.deps.setView("queue")
        const result = await this.processInitialQuestion()
        performanceMonitor.endTimer('processScreenshots (Total)');
        return result;
      }

      // If we're in solutions view and have extra screenshots, it's debugging
      if (view === "solutions" && extraQueue.length > 0) {
        console.log("Processing extra queue (debugging)")
        const result = await this.processDebugging()
        performanceMonitor.endTimer('processScreenshots (Total)');
        return result;
      }

      console.log("No screenshots to process")
      performanceMonitor.endTimer('processScreenshots (Total)');
      return { success: false, error: "No screenshots to process" }
    } catch (error: any) {
      performanceMonitor.endTimer('processScreenshots (Total)');
      console.error('Error in processScreenshots:', error)
      return { success: false, error: error.message || "Processing failed" }
    }
  }

  private async processInitialQuestion() {
    const mainWindow = this.deps.getMainWindow()

    try {
      const screenshots = this.deps.getScreenshotQueue()
      console.log(`processInitialQuestion - Found ${screenshots.length} screenshots:`, screenshots)

      if (screenshots.length === 0) {
        console.log("ERROR: Screenshot queue is empty in processInitialQuestion")
        return { success: false, error: "No screenshots to process" }
      }

      // Reset conversation for new question
      this.conversationHistory = []
      this.lastResponse = ""

      const config = configHelper.loadConfig()
      const model = config.groqModel || API.DEFAULT_GROQ_MODEL
      const isTextOnlyModel = model.includes('gpt-oss')

      console.log(`Processing with ${isTextOnlyModel ? 'GPT-OSS (text + OCR)' : 'Groq Maverick (vision)'}`)

      if (mainWindow) {
        console.log("Sending INITIAL_START event to switch to solutions view")
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
        
        mainWindow.webContents.send("processing-status", {
          message: isTextOnlyModel ? "Extracting text with OCR..." : "Analyzing screenshots...",
          progress: 30
        })
      }

      // Extract text with OCR if using text-only model
      let extractedText = ""
      if (isTextOnlyModel) {
        performanceMonitor.startTimer('OCR Extraction');
        try {
          extractedText = await ocrHelper.extractTextFromMultiple(screenshots)
          console.log(`OCR extracted ${extractedText.length} characters`)
          
          // Dev mode: Log extracted text
          if (process.env.NODE_ENV === 'development') {
            console.log('\n========== EXTRACTED TEXT (OCR) ==========')
            console.log(extractedText)
            console.log('==========================================\n')
          }
        } catch (error) {
          console.error('OCR failed:', error)
          throw new Error('OCR extraction failed')
        }
        performanceMonitor.endTimer('OCR Extraction');
      }

      // Load and compress screenshots for faster API calls (only for vision models)
      performanceMonitor.startTimer('Load Screenshots');
      const imageDataList = isTextOnlyModel ? [] : await Promise.all(
        screenshots.map(async (screenshotPath) => {
          // Compress image to reduce payload size and speed up API calls
          const compressedBuffer = await sharp(screenshotPath)
            .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer()
          return compressedBuffer.toString('base64')
        })
      )
      performanceMonitor.endTimer('Load Screenshots');

      this.currentAbortController = new AbortController()
      const signal = this.currentAbortController.signal

      const language = configHelper.getLanguage()
      const mode = configHelper.getMode()

      // Get optimized system prompt based on mode
      const systemPrompt = getSystemPrompt(mode, language)

      let responseText = ""

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Generating solution...",
          progress: 60
        })
      }

      // Call appropriate API based on mode (fallback handled in GroqProvider)
      performanceMonitor.startTimer('API Call');

      // Check if we're using fallback before the call
      const wasUsingFallback = this.groqProvider.isUsingFallbackModel();

      // Use appropriate method based on model type
      if (isTextOnlyModel) {
        performanceMonitor.startTimer('Groq Text API (with OCR)');
        responseText = await this.groqProvider.generateContent(systemPrompt, imageDataList, signal, undefined, extractedText);
        performanceMonitor.endTimer('Groq Text API (with OCR)');
      } else {
        performanceMonitor.startTimer('Groq Vision API (no OCR)');
        responseText = await this.groqProvider.generateContent(systemPrompt, imageDataList, signal);
        performanceMonitor.endTimer('Groq Vision API (no OCR)');
      }

      performanceMonitor.endTimer('API Call');

      // Warn user if Scout model was used (less accurate)
      if (!wasUsingFallback && this.groqProvider.isUsingFallbackModel() && mainWindow) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.SHOW_ERROR_NOTIFICATION, {
          title: "Using Backup Model",
          message: "Maverick is rate-limited. Using Scout model - answers may be less accurate."
        });
      }

      // Store for debugging
      this.lastResponse = responseText
      this.conversationHistory.push({
        role: "user",
        content: "Screenshots provided"
      })
      this.conversationHistory.push({
        role: "assistant",
        content: responseText
      })

      // Parse response
      const parsedResponse = this.parseResponse(responseText)

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Complete!",
          progress: 100
        })

        console.log("Sending SOLUTION_SUCCESS event with data:", JSON.stringify(parsedResponse).substring(0, 200))
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          parsedResponse
        )
      }

      // Clear the main queue after successful processing
      if (this.screenshotHelper) {
        this.screenshotHelper.clearMainScreenshotQueue()
      }
      
      this.deps.setView("solutions")
      console.log("Processing completed successfully, view set to solutions")
      return { success: true, data: parsedResponse }

    } catch (error: any) {
      // Use standardized ErrorHandler
      this.deps.setView("queue")
      return ErrorHandler.handle(error, "processInitialQuestion", mainWindow || undefined)
    }
  }

  private async processDebugging() {
    const mainWindow = this.deps.getMainWindow()

    try {
      const screenshots = this.deps.getExtraScreenshotQueue()

      if (screenshots.length === 0) {
        return { success: false, error: "No error screenshots provided" }
      }

      if (mainWindow) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing errors...",
          progress: 30
        })
      }

      const config = configHelper.loadConfig()
      const model = config.groqModel || API.DEFAULT_GROQ_MODEL
      const isTextOnlyModel = model.includes('gpt-oss')

      // Extract text with OCR if using text-only model
      let extractedText = ""
      if (isTextOnlyModel) {
        performanceMonitor.startTimer('OCR Extraction (Debug)');
        try {
          extractedText = await ocrHelper.extractTextFromMultiple(screenshots)
          console.log(`OCR extracted ${extractedText.length} characters (debug mode)`)
          
          // Dev mode: Log extracted text
          if (process.env.NODE_ENV === 'development') {
            console.log('\n========== EXTRACTED TEXT (DEBUG OCR) ==========')
            console.log(extractedText)
            console.log('================================================\n')
          }
        } catch (error) {
          console.error('OCR failed in debug:', error)
        }
        performanceMonitor.endTimer('OCR Extraction (Debug)');
      }

      // Load and compress error screenshots (only for vision models)
      const imageDataList = isTextOnlyModel ? [] : await Promise.all(
        screenshots.map(async (screenshotPath) => {
          // Compress image to reduce payload size and speed up API calls
          const compressedBuffer = await sharp(screenshotPath)
            .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer()
          return compressedBuffer.toString('base64')
        })
      )

      this.currentAbortController = new AbortController()
      const signal = this.currentAbortController.signal

      // DEBUG PROMPT with conversation history
      const debugPrompt = `Previous response:
${this.lastResponse}

Now analyze these error screenshots and fix the issues. Respond in the same format as before, but with corrected code.`

      let responseText = ""

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Fixing errors...",
          progress: 60
        })
      }

      // Call API (fallback handled in GroqProvider)
      performanceMonitor.startTimer('Debug API Call');

      // Check if we're using fallback before the call
      const wasUsingFallback = this.groqProvider.isUsingFallbackModel();

      // Use Groq with history
      const history = this.conversationHistory.map(h => ({
          role: h.role,
          content: h.content
      }));

      if (this.groqProvider.generateContentWithHistory) {
          responseText = await this.groqProvider.generateContentWithHistory(debugPrompt, imageDataList, history, signal, extractedText);
      } else {
          throw new Error("Groq provider does not support history");
      }

      performanceMonitor.endTimer('Debug API Call');

      // Warn user if Scout model was used (less accurate)
      if (!wasUsingFallback && this.groqProvider.isUsingFallbackModel() && mainWindow) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.SHOW_ERROR_NOTIFICATION, {
          title: "Using Backup Model",
          message: "Maverick is rate-limited. Using Scout model - answers may be less accurate."
        });
      }

      // Update conversation
      this.lastResponse = responseText
      this.conversationHistory.push({
        role: "user",
        content: debugPrompt
      })
      this.conversationHistory.push({
        role: "assistant",
        content: responseText
      })

      const parsedResponse = this.parseResponse(responseText)

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Fixed!",
          progress: 100
        })

        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
          parsedResponse
        )
      }

      // Clear the extra queue after successful debugging
      if (this.screenshotHelper) {
        this.screenshotHelper.clearExtraScreenshotQueue()
      }

      return { success: true, data: parsedResponse }

    } catch (error: any) {
      // Use standardized ErrorHandler - but keep view as solutions
      return ErrorHandler.handle(error, "processDebugging", mainWindow || undefined)
    }
  }

  // RESPONSE PARSING
  private parseResponse(response: string): any {
    // Try each parser until one returns a specific type or fall back to TextParser
    // The logic in Parsers is specific. We need to detect which parser to use.

    // MCQ Detection
    if (response.match(/option\s+\d+\)/i) || response.match(/FINAL ANSWER:/i)) {
      return new MCQParser().parse(response)
    }

    // Web Dev Detection
    if (response.includes('<html>') || response.includes('<!DOCTYPE html>')) {
      return new WebDevParser().parse(response)
    }

    // Python Detection
    if (response.includes('```python')) {
      return new PythonParser().parse(response)
    }

    // Default
    return new TextParser().parse(response)
  }
}
