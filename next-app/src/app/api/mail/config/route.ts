import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { verifyAuth } from '@/lib/verifyAuth';
import { successResponse, errorResponse, handleOptions } from '@/lib/apiResponse';

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

    return successResponse({
      gmailAddress: user.gmailAddress || '',
      hasPassword: !!user.gmailAppPassword,
    }, 200);
  } catch (error: any) {
    console.error('Fetch mail config error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) {
      return errorResponse('Unauthorized', 401);
    }

    const { gmailAddress, gmailAppPassword } = await req.json();

    const user = await User.findById(authPayload.userId);
    if (!user) {
      return errorResponse('User not found', 404);
    }

    user.gmailAddress = gmailAddress || '';
    if (gmailAppPassword !== undefined) {
      user.gmailAppPassword = gmailAppPassword;
    }
    await user.save();

    return successResponse({
      message: 'Gmail configuration updated successfully.',
      gmailAddress: user.gmailAddress,
    }, 200);
  } catch (error: any) {
    console.error('Update mail config error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
