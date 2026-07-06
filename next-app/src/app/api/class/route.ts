import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Class from '@/models/Class';
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

    // Fetch user's classes, sorted by day of week then starting time
    const classes = await Class.find({ userId: authPayload.userId })
      .sort({ dayOfWeek: 1, startTime: 1 });

    return successResponse(classes, 200);
  } catch (error: any) {
    console.error('Fetch classes error:', error);
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

    const { className, subject, room, startTime, endTime, dayOfWeek, instructor } = await req.json();

    if (!className || !startTime || !endTime || dayOfWeek === undefined) {
      return errorResponse('Missing required fields (className, startTime, endTime, dayOfWeek)', 400);
    }

    // dayOfWeek must be between 0 and 6
    const day = Number(dayOfWeek);
    if (isNaN(day) || day < 0 || day > 6) {
      return errorResponse('dayOfWeek must be a number between 0 (Sunday) and 6 (Saturday)', 400);
    }

    const newClass = await Class.create({
      userId: authPayload.userId,
      className,
      subject,
      room,
      startTime,
      endTime,
      dayOfWeek: day,
      instructor,
    });

    return successResponse(newClass, 201);
  } catch (error: any) {
    console.error('Create class error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
