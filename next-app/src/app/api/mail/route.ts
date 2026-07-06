import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { verifyAuth } from '@/lib/verifyAuth';
import { successResponse, errorResponse, handleOptions } from '@/lib/apiResponse';
// @ts-ignore
import { ImapFlow } from 'imapflow';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) {
      return errorResponse('Unauthorized', 401);
    }

    const user = await User.findById(authPayload.userId);
    if (!user) {
      return errorResponse('User not found', 404);
    }

    if (!user.gmailAddress || !user.gmailAppPassword) {
      return successResponse({ connected: false, emails: [] }, 200);
    }

    // Connect to Gmail via IMAP
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
        name: 'AssistTab Dashboard'
      }
    });

    await client.connect();
    
    const lock = await client.getMailboxLock('INBOX');
    const emails: any[] = [];
    
    try {
      // Search for unseen messages
      const searchResult = await client.search({ seen: false });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      // Take the latest 5 unread and reverse (so newest are first)
      const targetUids = uids.slice(-5).reverse();
      
      for (const uid of targetUids) {
        const msg = await client.fetchOne(uid, { envelope: true });
        if (msg && msg.envelope) {
          emails.push({
            id: uid,
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

    return successResponse({
      connected: true,
      emails,
    }, 200);
  } catch (error: any) {
    console.error('IMAP fetch emails error:', error);
    if (error.message && (error.message.includes('AUTHENTICATIONFAILED') || error.message.includes('login failed') || error.message.includes('auth'))) {
      return successResponse({
        connected: true,
        error: 'Authentication failed. Please check your Gmail address and App Password.',
        emails: []
      }, 200);
    }
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
