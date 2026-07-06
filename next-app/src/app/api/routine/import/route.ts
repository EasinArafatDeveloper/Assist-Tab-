import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Routine from '@/models/Routine';
import { verifyAuth } from '@/lib/verifyAuth';
import { successResponse, errorResponse, handleOptions } from '@/lib/apiResponse';
import * as xlsx from 'xlsx';
// Polyfill global DOMMatrix to prevent pdf-parse/pdfjs runtime crash in Node environment
if (typeof global !== 'undefined' && !('DOMMatrix' in global)) {
  // @ts-ignore
  global.DOMMatrix = class DOMMatrix {};
}
// @ts-ignore
const pdf = require('pdf-parse');

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) {
      return errorResponse('Unauthorized', 401);
    }

    const { fileData, fileName, fileType, sheetUrl } = await req.json();

    const provider = req.headers.get('x-ai-provider') || 'deepseek';

    // Get custom keys from headers
    const deepseekCustomKey = req.headers.get('x-deepseek-api-key') || req.headers.get('X-DeepSeek-Api-Key');
    const deepseekKey = deepseekCustomKey || process.env.DEEPSEEK_API_KEY;

    const geminiCustomKey = req.headers.get('x-gemini-api-key') || req.headers.get('X-Gemini-Api-Key');
    const geminiKey = geminiCustomKey || process.env.GEMINI_API_KEY;

    const openaiCustomKey = req.headers.get('x-openai-api-key') || req.headers.get('X-OpenAI-Api-Key');
    const openaiKey = openaiCustomKey || process.env.OPENAI_API_KEY;

    const claudeCustomKey = req.headers.get('x-claude-api-key') || req.headers.get('X-Claude-Api-Key');
    const claudeKey = claudeCustomKey || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

    const isImage = fileType && fileType.startsWith('image/');
    let extractedText = '';

    if (!isImage) {
      // Case 1: Google Sheets URL
      if (sheetUrl) {
        let csvUrl = sheetUrl.trim();
        if (csvUrl.includes('/edit')) {
          csvUrl = csvUrl.substring(0, csvUrl.indexOf('/edit')) + '/export?format=csv';
        } else if (!csvUrl.endsWith('/export?format=csv') && !csvUrl.includes('/export')) {
          csvUrl = csvUrl.replace(/\/$/, '') + '/export?format=csv';
        }
        
        const sheetRes = await fetch(csvUrl);
        if (!sheetRes.ok) {
          return errorResponse('Failed to fetch content from the provided Google Sheet link. Make sure the sheet is shared as "Anyone with the link can view".', 400);
        }
        extractedText = await sheetRes.text();
      } 
      // Case 2: Uploaded File (Base64)
      else if (fileData) {
        const buffer = Buffer.from(fileData, 'base64');
        const nameLower = fileName ? fileName.toLowerCase() : '';

        if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
          const workbook = xlsx.read(buffer, { type: 'buffer' });
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const csv = xlsx.utils.sheet_to_csv(worksheet);
            extractedText += `[Sheet: ${sheetName}]\n${csv}\n\n`;
          });
        } else if (nameLower.endsWith('.pdf')) {
          const pdfData = await pdf(buffer);
          extractedText = pdfData.text;
        } else {
          // Plain text, CSV, etc.
          extractedText = buffer.toString('utf-8');
        }
      } else {
        return errorResponse('Invalid request. Either fileData or sheetUrl is required.', 400);
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return errorResponse('No readable text could be extracted from the uploaded document.', 400);
      }
    }

    const systemPrompt = isImage
      ? `You are a productivity AI assistant designed to extract lists of daily routines or schedules from raw images or screenshots of routines.
Analyze the provided image content and extract all relevant routine items or daily tasks.

Your output MUST be a valid JSON array of objects, where each object has these fields:
- "title" (string, required): Short name of the routine/task. Keep it concise.
- "description" (string, optional): Extra details or context, if available.
- "time" (string, optional): Time of day in "HH:MM" 24h format (e.g. "08:00") if specified in the image.
- "recurrence" (array of numbers, optional): Days of the week this routine occurs on (0 for Sunday, 1 for Monday, 2 for Tuesday, 3 for Wednesday, 4 for Thursday, 5 for Friday, 6 for Saturday). If it is a weekly routine on specific days, provide the numbers. If it is done every day or if no specific days are mentioned, output an empty array [].
- "priority" (string, optional): One of "emergency", "important", or "normal". Deduce this based on clues in the image (e.g., words like "urgent", "must do", "critical" mean "emergency"; words like "important", "high priority", "should do" mean "important"; general tasks mean "normal"). If unspecified, use "normal".

Do not output any markdown code blocks, conversational text, explanations, or backticks. Return ONLY the raw JSON array.`
      : `You are a productivity AI assistant designed to extract lists of daily routines or schedules from raw text, spreadsheets, CSV files, or PDF documents.
Analyze the provided text content and extract all relevant routine items or daily tasks.

Your output MUST be a valid JSON array of objects, where each object has these fields:
- "title" (string, required): Short name of the routine/task. Keep it concise.
- "description" (string, optional): Extra details or context, if available.
- "time" (string, optional): Time of day in "HH:MM" 24h format (e.g. "08:00") if specified in the text.
- "recurrence" (array of numbers, optional): Days of the week this routine occurs on (0 for Sunday, 1 for Monday, 2 for Tuesday, 3 for Wednesday, 4 for Thursday, 5 for Friday, 6 for Saturday). If it is a weekly routine on specific days, provide the numbers. If it is done every day or if no specific days are mentioned, output an empty array [].
- "priority" (string, optional): One of "emergency", "important", or "normal". Deduce this based on clues in the text (e.g., words like "urgent", "must do", "critical" mean "emergency"; words like "important", "high priority", "should do" mean "important"; general tasks mean "normal"). If unspecified, use "normal".

Do not output any markdown code blocks, conversational text, explanations, or backticks. Return ONLY the raw JSON array.

Extracted Document Content:
--------------------
${extractedText}
--------------------`;

    let aiResponse = '[]';

    if (isImage) {
      const base64Data = fileData.split(',')[1] || fileData;

      if (provider === 'gemini') {
        if (!geminiKey) {
          return errorResponse('Google Gemini API key is not configured. Please configure Gemini key in settings to extract tasks from images.', 400);
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: 'Extract the routines and return the JSON array.' },
                  {
                    inlineData: {
                      mimeType: fileType,
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.2
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API returned error: ${errText}`);
        }

        const resData = await response.json();
        aiResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

      } else if (provider === 'openai') {
        if (!openaiKey) {
          return errorResponse('OpenAI API key is not configured. Please configure OpenAI key in settings to extract tasks from images.', 400);
        }

        const dataUrl = fileData.startsWith('data:') ? fileData : `data:${fileType};base64,${base64Data}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Extract the routines and return the JSON array.' },
                  {
                    type: 'image_url',
                    image_url: { url: dataUrl }
                  }
                ]
              }
            ],
            max_tokens: 2048,
            temperature: 0.2
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI API returned error: ${errText}`);
        }

        const resData = await response.json();
        aiResponse = resData.choices?.[0]?.message?.content || '[]';

      } else if (provider === 'anthropic') {
        if (!claudeKey) {
          return errorResponse('Anthropic Claude API key is not configured. Please configure Claude key in settings to extract tasks from images.', 400);
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Extract the routines and return the JSON array.' },
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: fileType,
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            max_tokens: 2048,
            temperature: 0.2
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Anthropic API returned error: ${errText}`);
        }

        const resData = await response.json();
        aiResponse = resData.content?.[0]?.text || '[]';

      } else {
        return errorResponse('DeepSeek does not support image analysis. Please select Google Gemini, OpenAI, or Anthropic Claude in Settings to extract routines from images.', 400);
      }
    } else {
      // Document processing
      if (provider === 'gemini') {
        if (!geminiKey) {
          return errorResponse('Google Gemini API key is not configured. Please configure Gemini key in settings.', 400);
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            contents: [{ role: 'user', parts: [{ text: 'Extract the routines and return the JSON array.' }] }],
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.2
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API returned error: ${errText}`);
        }

        const resData = await response.json();
        aiResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

      } else if (provider === 'openai') {
        if (!openaiKey) {
          return errorResponse('OpenAI API key is not configured. Please configure OpenAI key in settings.', 400);
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Extract the routines and return the JSON array.' }
            ],
            max_tokens: 2048,
            temperature: 0.2
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI API returned error: ${errText}`);
        }

        const resData = await response.json();
        aiResponse = resData.choices?.[0]?.message?.content || '[]';

      } else if (provider === 'anthropic') {
        if (!claudeKey) {
          return errorResponse('Anthropic Claude API key is not configured. Please configure Claude key in settings.', 400);
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            system: systemPrompt,
            messages: [{ role: 'user', content: 'Extract the routines and return the JSON array.' }],
            max_tokens: 2048,
            temperature: 0.2
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Anthropic API returned error: ${errText}`);
        }

        const resData = await response.json();
        aiResponse = resData.content?.[0]?.text || '[]';

      } else {
        // Default: DeepSeek
        if (!deepseekKey) {
          return errorResponse('DeepSeek API key is not configured on the server.', 500);
        }

        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Extract the routines and return the JSON array.' }
            ],
            max_tokens: 2048,
            temperature: 0.2,
            stream: false
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`DeepSeek API returned error: ${errText}`);
        }

        const resData = await response.json();
        aiResponse = resData.choices?.[0]?.message?.content || '[]';
      }
    }

    // Clean JSON wrapper markdown if any
    let cleanedJson = aiResponse.trim();
    if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedRoutines = JSON.parse(cleanedJson);
    if (!Array.isArray(parsedRoutines)) {
      throw new Error('AI did not return a JSON array');
    }

    // Save routines to Database
    const createdRoutines = [];
    for (const item of parsedRoutines) {
      if (!item.title || item.title.trim().length === 0) continue;
      const newRoutine = await Routine.create({
        userId: authPayload.userId,
        title: item.title.trim(),
        description: (item.description || '').trim(),
        time: (item.time || '').trim(),
        recurrence: item.recurrence || [],
        priority: item.priority || 'normal',
        isCompleted: false
      });
      createdRoutines.push(newRoutine);
    }

    return successResponse(createdRoutines, 201);

  } catch (error: any) {
    console.error('Import routines error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}