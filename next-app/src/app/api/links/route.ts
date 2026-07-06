import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { verifyAuth } from '@/lib/verifyAuth';
import { successResponse, errorResponse, handleOptions } from '@/lib/apiResponse';

export async function OPTIONS() {
  return handleOptions();
}

// GET /api/links - Returns the user's quickLinks array
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) return errorResponse('Unauthorized', 401);

    const user = await User.findById(authPayload.userId);
    if (!user) return errorResponse('User not found', 404);

    return successResponse({ links: user.quickLinks || [] });
  } catch (err) {
    console.error('GET /api/links error:', err);
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/links - Add a new quick link { name, url }
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) return errorResponse('Unauthorized', 401);

    const { name, url } = await req.json();
    if (!name || !url) return errorResponse('name and url are required', 400);

    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    const user = await User.findById(authPayload.userId);
    if (!user) return errorResponse('User not found', 404);

    // Prevent duplicates by URL
    const exists = (user.quickLinks || []).some((l: { name: string; url: string }) => l.url === normalizedUrl);
    if (exists) return errorResponse('This link already exists', 409);

    user.quickLinks.push({ name, url: normalizedUrl });
    await user.save();

    return successResponse({ link: { name, url: normalizedUrl }, message: 'Link added successfully' });
  } catch (err) {
    console.error('POST /api/links error:', err);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE /api/links - Remove a quick link by URL { url }
export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) return errorResponse('Unauthorized', 401);

    const { url } = await req.json();
    if (!url) return errorResponse('url is required', 400);

    const user = await User.findById(authPayload.userId);
    if (!user) return errorResponse('User not found', 404);

    const before = user.quickLinks.length;
    user.quickLinks = user.quickLinks.filter((l: { url: string }) => l.url !== url);
    if (user.quickLinks.length === before) return errorResponse('Link not found', 404);

    await user.save();
    return successResponse({ message: 'Link removed successfully' });
  } catch (err) {
    console.error('DELETE /api/links error:', err);
    return errorResponse('Internal server error', 500);
  }
}
