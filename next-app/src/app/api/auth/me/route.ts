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

    const user = await User.findById(authPayload.userId).select('-password');
    if (!user) {
      return errorResponse('User not found', 404);
    }

    return successResponse({
      user: {
        id: user._id,
        email: user.email,
      },
    }, 200);
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
