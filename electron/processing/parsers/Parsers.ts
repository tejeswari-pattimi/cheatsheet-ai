// Abstract class or interface for Parsers
export interface ResponseParser {
  parse(response: string): any;
}

export class MCQParser implements ResponseParser {
  parse(response: string): any {
    // MCQ Detection logic
    let finalAnswerMatch = response.match(/FINAL ANSWER:\s*option\s+([\d,\s]+)\)\s*(.+?)$/im)

    let answer = "Answer not found"

    if (finalAnswerMatch) {
      const optionNumbers = finalAnswerMatch[1].trim()
      const optionValue = finalAnswerMatch[2].trim()
      answer = `option ${optionNumbers}) ${optionValue}`
    } else {
      finalAnswerMatch = response.match(/FINAL ANSWER:\s*([A-D](?:\s*,\s*[A-D])*)\s*(.*)$/im)

      if (finalAnswerMatch) {
        const firstCapture = finalAnswerMatch[1]
        const secondCapture = finalAnswerMatch[2]

        if (firstCapture.match(/^[A-D](?:\s*,\s*[A-D])*$/i)) {
          const choices = firstCapture.toUpperCase()
          const value = secondCapture ? secondCapture.trim() : ""
          answer = value ? `${choices} ${value}` : choices
        }
      } else {
        finalAnswerMatch = response.match(/FINAL ANSWER:\s*(.+?)$/im)

        if (finalAnswerMatch) {
          answer = finalAnswerMatch[1].trim()
        } else {
          finalAnswerMatch = response.match(/option\s+([\d,\s]+)\)\s*(.*)$/im)

          if (finalAnswerMatch) {
            const optionNumbers = finalAnswerMatch[1].trim()
            const optionValue = finalAnswerMatch[2].trim()
            answer = `option ${optionNumbers}) ${optionValue}`
          }
        }
      }
    }

    const reasoningMatch = response.match(/```markdown\s*([\s\S]*?)```/)

    let actualResponse = response

    const promptMarkers = [
      /1\. MULTIPLE CHOICE QUESTIONS[\s\S]*?FINAL ANSWER:/i,
      /RESPONSE FORMATS:[\s\S]*?(?=The question|Question:|FINAL ANSWER:)/i,
      /You are an expert[\s\S]*?(?=The question|Question:|FINAL ANSWER:)/i
    ]

    for (const marker of promptMarkers) {
      if (marker.test(actualResponse)) {
        actualResponse = actualResponse.replace(marker, '')
        break
      }
    }

    if (actualResponse.includes('MULTIPLE CHOICE QUESTIONS')) {
      const questionStart = actualResponse.search(/(?:The question|Question:|Options?:|Which|What|How|Why|When|Where)/i)
      if (questionStart > 0) {
        actualResponse = actualResponse.substring(questionStart)
      }
    }

    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : actualResponse.trim()

    let formattedCode = actualResponse.trim()
    if (!formattedCode.includes("FINAL ANSWER:")) {
      formattedCode = formattedCode + `\n\n**FINAL ANSWER:** ${answer}`
    }

    return {
      question_type: "multiple_choice",
      answer: answer,
      reasoning: reasoning,
      code: formattedCode,
      thoughts: [reasoning],
      final_answer_highlight: answer
    }
  }
}

export class WebDevParser implements ResponseParser {
  parse(response: string): any {
    let htmlMatch = response.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i)
    if (!htmlMatch) {
      htmlMatch = response.match(/<html[\s\S]*?<\/html>/i)
    }
    const html = htmlMatch ? htmlMatch[0] : ""

    let css = ""

    if (html) {
      const styleMatches = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)
      const cssBlocks = []
      for (const match of styleMatches) {
        if (match[1] && match[1].trim()) {
          cssBlocks.push(match[1].trim())
        }
      }
      if (cssBlocks.length > 0) {
        css = cssBlocks.join('\n\n')
      }
    }

    if (!css && html) {
      const afterHTML = response.substring(response.indexOf('</html>') + 7)
      const afterHTMLTrimmed = afterHTML.trim()

      const cssWithoutMarkdown = afterHTMLTrimmed
        .replace(/^```css\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      if (cssWithoutMarkdown && !cssWithoutMarkdown.includes('<')) {
        css = cssWithoutMarkdown
      }
    }

    const code = html + (css ? "\n\n" + css : "")

    return {
      question_type: "web_dev",
      code: code,
      html: html,
      css: css,
      thoughts: ["Web development solution generated"],
      explanation: "HTML and CSS code generated"
    }
  }
}

export class PythonParser implements ResponseParser {
  parse(response: string): any {
    const conceptMatch = response.match(/Main concept:\s*(.+?)(?=\n|```)/i)
    const codeMatch = response.match(/```python\s*([\s\S]*?)```/)

    return {
      question_type: "python",
      code: codeMatch ? codeMatch[1].trim() : response,
      concept: conceptMatch ? conceptMatch[1].trim() : "Python solution",
      thoughts: [conceptMatch ? conceptMatch[1].trim() : "Python solution"],
      explanation: conceptMatch ? conceptMatch[1].trim() : "Python solution"
    }
  }
}

export class TextParser implements ResponseParser {
  parse(response: string): any {
    const textMatch = response.match(/```text\s*([\s\S]*?)```/)
    const text = textMatch ? textMatch[1].trim() : response

    return {
      question_type: "text",
      code: text,
      thoughts: [text],
      explanation: text
    }
  }
}
