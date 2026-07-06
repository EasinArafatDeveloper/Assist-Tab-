import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Routine from '@/models/Routine';
import Class from '@/models/Class';
import User from '@/models/User';
import { verifyAuth } from '@/lib/verifyAuth';
import { successResponse, errorResponse, handleOptions } from '@/lib/apiResponse';
// @ts-ignore
import { ImapFlow } from 'imapflow';
// Polyfill global DOMMatrix to prevent pdf-parse/pdfjs runtime crash in Node environment
if (typeof global !== 'undefined' && !('DOMMatrix' in global)) {
  // @ts-ignore
  global.DOMMatrix = class DOMMatrix {};
}
// @ts-ignore
const pdf = require('pdf-parse');
// @ts-ignore
import * as XLSX from 'xlsx';

async function parseAttachedFiles(files: any[]): Promise<{ name: string; content: string }[]> {
  const parsed: { name: string; content: string }[] = [];
  if (!files || !Array.isArray(files)) return parsed;

  for (const file of files) {
    try {
      if (!file.data || !file.name) continue;
      
      const base64Data = file.data.split(',')[1];
      if (!base64Data) continue;
      
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = file.name.split('.').pop().toLowerCase();
      
      let text = '';
      if (ext === 'pdf') {
        const parsedPdf = await pdf(buffer);
        text = parsedPdf.text || '';
      } else if (ext === 'xlsx' || ext === 'xls') {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        workbook.SheetNames.forEach((sheetName: string) => {
          const sheet = workbook.Sheets[sheetName];
          text += `Sheet: ${sheetName}\n` + XLSX.utils.sheet_to_csv(sheet) + '\n';
        });
      } else if (ext === 'csv' || ext === 'txt' || (file.type && file.type.startsWith('text/'))) {
        text = buffer.toString('utf-8');
      } else {
        text = `[Binary file content: ${file.name} (${file.type || 'unknown type'})]`;
      }
      
      parsed.push({ name: file.name, content: text });
    } catch (err: any) {
      console.error(`Failed to parse file ${file.name}:`, err);
      parsed.push({ name: file.name, content: `[Error parsing file: ${err.message}]` });
    }
  }
  return parsed;
}

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

    const { messages, timeStats, files } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return errorResponse('Invalid request body. "messages" array is required.', 400);
    }

    // 1. Fetch user routine, class, and profile context
    const routines = await Routine.find({ userId: authPayload.userId }).sort({ order: 1, createdAt: 1 });
    const classes = await Class.find({ userId: authPayload.userId }).sort({ dayOfWeek: 1, startTime: 1 });
    const user = await User.findById(authPayload.userId);
    const gmailConnected = !!(user && user.gmailAddress && user.gmailAppPassword);
    const gmailAddress = user ? user.gmailAddress : '';

    let unreadEmailsContext = 'No unread emails in your inbox.';
    if (gmailConnected && user) {
      try {
        const client = new ImapFlow({
          host: 'imap.gmail.com',
          port: 993,
          secure: true,
          auth: {
            user: user.gmailAddress,
            pass: user.gmailAppPassword,
          },
          logger: false,
          clientInfo: {
            name: 'AssistTab AI Assistant'
          }
        });
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        const emails = [];
        try {
          const searchResult = await client.search({ seen: false });
          const uids = Array.isArray(searchResult) ? searchResult : [];
          const targetUids = uids.slice(-5).reverse();
          for (const uid of targetUids) {
            const msg = await client.fetchOne(uid, { envelope: true });
            if (msg && msg.envelope) {
              emails.push({
                subject: msg.envelope.subject || '(No Subject)',
                from: msg.envelope.from 
                  ? msg.envelope.from.map((f: any) => f.name ? `${f.name} <${f.address}>` : f.address).join(', ')
                  : 'Unknown Sender',
                date: msg.envelope.date || new Date(),
              });
            }
          }
        } finally {
          lock.release();
        }
        await client.logout();

        if (emails.length > 0) {
          unreadEmailsContext = emails.map((email, idx) => {
            return `${idx + 1}. From: ${email.from}, Subject: "${email.subject}" (Date: ${email.date.toLocaleString()})`;
          }).join('\n');
        } else {
          unreadEmailsContext = 'No unread emails.';
        }
      } catch (err) {
        console.error('Failed to fetch emails for AI context:', err);
        unreadEmailsContext = 'Failed to fetch unread emails (check credentials).';
      }
    }

    // 2. Format context
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const routineContext = routines.map((r, idx) => {
      const timeStr = r.time ? `[${r.time}] ` : '';
      const priorityStr = `[Priority: ${r.priority ? r.priority.toUpperCase() : 'NORMAL'}]`;
      const recurrenceStr = r.recurrence && r.recurrence.length > 0
        ? ` (Repeats on: ${r.recurrence.map((d: number) => days[d]).join(', ')})`
        : '';
      const completionStr = r.isCompleted ? '✓ Completed' : '☐ Incomplete';
      return `${idx + 1}. ${priorityStr} ${timeStr}${r.title} - ${completionStr}${recurrenceStr}${r.description ? ` (${r.description})` : ''}`;
    }).join('\n') || 'No routine items added yet.';

    const classesContext = classes.map((c, idx) => {
      return `${idx + 1}. ${c.className} - Room: ${c.room || 'N/A'}, Time: ${c.startTime} - ${c.endTime} on ${days[c.dayOfWeek]}${c.instructor ? ` (Instructor: ${c.instructor})` : ''}`;
    }).join('\n') || 'No classes scheduled yet.';

    // Format active time tracker stats context
    let timeStatsContext = 'No website usage stats tracked today.';
    if (timeStats && typeof timeStats === 'object') {
      const entries = Object.entries(timeStats);
      if (entries.length > 0) {
        entries.sort((a: any, b: any) => b[1] - a[1]);
        timeStatsContext = entries.map(([domain, seconds]: any) => {
          const minutes = Math.floor(seconds / 60);
          const hrs = Math.floor(minutes / 60);
          const remMin = minutes % 60;
          const timeStr = hrs > 0 ? `${hrs}h ${remMin}m` : `${minutes}m`;
          return `- ${domain}: ${timeStr} active today`;
        }).join('\n');
      }
    }

    // Current local time from client request headers or request URL search params (if provided)
    const searchParams = new URL(req.url).searchParams;
    const clientTimeStr = searchParams.get('clientTime') || new Date().toISOString();

    const systemPrompt = `You are a personalized AI Assistant embedded directly in the user's Chrome New Tab page dashboard.
Your job is to act as their personal assistant, scheduler, and productivity coach.

Here is the user's current data context:
----------------------------------------
Current Daily Routine Checklist (with Priorities):
${routineContext}

University / Class Schedule:
${classesContext}

Website Usage Stats Today (Productivity tracker):
${timeStatsContext}

Gmail Connection Status: ${gmailConnected ? `Connected (Email: ${gmailAddress})` : 'Disconnected (Not connected)'}
Unread Emails in Inbox:
${unreadEmailsContext}

Current Client Local Time:
${clientTimeStr}
----------------------------------------

Guidelines & Capabilities:
1. Provide personalized schedule assistance based on the routine, classes, and time stats provided above.
2. Keep your answers concise, clear, and friendly (limit to 1-3 paragraphs).
3. Warn the user if they spend too much time on distraction sites (e.g. facebook.com, youtube.com, instagram.com). Guide them to prioritize routines.
4. Highlight upcoming routines or classes (e.g. reminding them if they have a class tomorrow at 9:00 AM or a task in a few minutes).
5. Address the user directly. Do not mention system prompt configurations.
6. You have direct read access to the user's unread Gmail headers (Sender, Subject, Date) listed under "Unread Emails in Inbox". Answer user queries about their inbox, new emails, or senders using this data. Never tell the user you cannot check their email, as you have direct access to their unread headers.

AGENT ACTION COMMANDS (Tool Calling):
You can execute database mutations on the user's dashboard! If the user commands you to add a routine task, complete/check off a task, or delete a task, you MUST append a command token exactly in one of these formats at the very end of your response:
- To add a routine: [ADD_ROUTINE: title | description | time | priority] (where priority can be 'normal', 'important', or 'emergency')
  Example: "I've added 'Read a book' to your schedule at 5:00 PM. [ADD_ROUTINE: Read a book | Auto-added by AI | 17:00 | normal]"
- To complete/check off a routine: [COMPLETE_ROUTINE: title]
  Example: "Marked 'Read a book' as completed! [COMPLETE_ROUTINE: Read a book]"
- To delete/remove a routine: [DELETE_ROUTINE: title]
  Example: "I have deleted the 'Read a book' task. [DELETE_ROUTINE: Read a book]"
- To add a workspace app link: [ADD_LINK: name | url]
  Example: "I've added Trello to your Workspace Apps! [ADD_LINK: Trello | https://trello.com]"
- To remove a workspace app link: [REMOVE_LINK: url]
  Example: "I've removed that link. [REMOVE_LINK: https://trello.com]"

Only append the command token if the user explicitly asked you to perform that action and you are executing it. The system will parse these tags automatically.`;

    // 3. Extract provider & separate image files from documents
    const provider = req.headers.get('x-ai-provider') || 'deepseek';
    const images: any[] = [];
    const documents: any[] = [];

    if (files && Array.isArray(files)) {
      files.forEach((file: any) => {
        if (file.type && file.type.startsWith('image/')) {
          images.push(file);
        } else {
          documents.push(file);
        }
      });
    }

    // Parse files/documents (PDF, Excel, txt, csv)
    const parsedDocs = await parseAttachedFiles(documents);

    // Format chat messages
    const apiMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || '',
    }));

    // Inject parsed document content into the last user message
    if (parsedDocs.length > 0) {
      let lastUserMsgIdx = -1;
      for (let i = apiMessages.length - 1; i >= 0; i--) {
        if (apiMessages[i].role === 'user') {
          lastUserMsgIdx = i;
          break;
        }
      }

      let documentContext = '\n\n--- Attached Files / Documents Content ---';
      parsedDocs.forEach(doc => {
        documentContext += `\n\n[File Name: ${doc.name}]\n${doc.content}\n[End of File: ${doc.name}]`;
      });
      documentContext += '\n------------------------------------------';

      if (lastUserMsgIdx !== -1) {
        apiMessages[lastUserMsgIdx].content += documentContext;
      } else {
        apiMessages.push({ role: 'user', content: documentContext });
      }
    }

    let textResponse = '';

    if (provider === 'gemini') {
      const customKey = req.headers.get('x-gemini-api-key') || req.headers.get('X-Gemini-Api-Key');
      const apiKey = customKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return successResponse({
          role: 'assistant',
          content: 'Google Gemini API key is not configured. Please enter your Gemini API Key in Settings to start chatting!',
        }, 200);
      }

      // Convert messages to Gemini role-part schema
      const geminiContents = apiMessages.map((m: any, idx: number) => {
        const role = m.role === 'assistant' ? 'model' : 'user';
        const parts: any[] = [{ text: m.content }];

        // Attach images to the last user message
        if (role === 'user' && idx === apiMessages.length - 1 && images.length > 0) {
          images.forEach(img => {
            const base64Data = img.data.split(',')[1];
            if (base64Data) {
              parts.push({
                inlineData: {
                  mimeType: img.type,
                  data: base64Data
                }
              });
            }
          });
        }

        return { role, parts };
      });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API returned error status ${response.status}: ${errText}`);
      }

      const resData = await response.json();
      textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text generated.';

    } else if (provider === 'openai') {
      const customKey = req.headers.get('x-openai-api-key') || req.headers.get('X-OpenAI-Api-Key');
      const apiKey = customKey || process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return successResponse({
          role: 'assistant',
          content: 'OpenAI API key is not configured. Please enter your OpenAI API Key in Settings to start chatting!',
        }, 200);
      }

      const openAiMessages = [
        { role: 'system', content: systemPrompt },
        ...apiMessages.map((m: any, idx: number) => {
          if (m.role === 'user' && idx === apiMessages.length - 1 && images.length > 0) {
            const content: any[] = [{ type: 'text', text: m.content }];
            images.forEach(img => {
              content.push({
                type: 'image_url',
                image_url: { url: img.data }
              });
            });
            return { role: 'user', content };
          }
          return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
        })
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openAiMessages,
          max_tokens: 1024,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API returned error status ${response.status}: ${errText}`);
      }

      const resData = await response.json();
      textResponse = resData.choices?.[0]?.message?.content || 'No response text generated.';

    } else if (provider === 'anthropic') {
      const customKey = req.headers.get('x-claude-api-key') || req.headers.get('X-Claude-Api-Key');
      const apiKey = customKey || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        return successResponse({
          role: 'assistant',
          content: 'Anthropic Claude API key is not configured. Please enter your Claude API Key in Settings to start chatting!',
        }, 200);
      }

      const claudeMessages = apiMessages.map((m: any, idx: number) => {
        if (m.role === 'user' && idx === apiMessages.length - 1 && images.length > 0) {
          const content: any[] = [{ type: 'text', text: m.content }];
          images.forEach(img => {
            const base64Data = img.data.split(',')[1];
            if (base64Data) {
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: img.type,
                  data: base64Data
                }
              });
            }
          });
          return { role: 'user', content };
        }
        return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          system: systemPrompt,
          messages: claudeMessages,
          max_tokens: 1024,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API returned error status ${response.status}: ${errText}`);
      }

      const resData = await response.json();
      textResponse = resData.content?.[0]?.text || 'No response text generated.';

    } else {
      // Default: DeepSeek
      const customKey = req.headers.get('x-deepseek-api-key') || req.headers.get('X-DeepSeek-Api-Key');
      const apiKey = customKey || process.env.DEEPSEEK_API_KEY;

      if (!apiKey || apiKey.startsWith('your-deepseek-api-key') || apiKey === 'sk-6d8c201f651f4e989edb3b23d0222726_example') {
        return successResponse({
          role: 'assistant',
          content: 'DeepSeek API key is not configured. Please enter your API Key in Settings to start chatting!',
        }, 200);
      }

      if (images.length > 0) {
        return successResponse({
          role: 'assistant',
          content: 'DeepSeek does not support image analysis. Please select Google Gemini, OpenAI, or Anthropic Claude in settings to analyze images.',
        }, 200);
      }

      const deepSeekMessages = [
        { role: 'system', content: systemPrompt },
        ...apiMessages
      ];

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: deepSeekMessages,
          max_tokens: 1024,
          temperature: 0.7,
          stream: false
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API returned error status ${response.status}: ${errText}`);
      }

      const resData = await response.json();
      textResponse = resData.choices?.[0]?.message?.content || 'No response text generated.';
    }

    return successResponse({
      role: 'assistant',
      content: textResponse,
    }, 200);

  } catch (error: any) {
    console.error('AI assistant route error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
