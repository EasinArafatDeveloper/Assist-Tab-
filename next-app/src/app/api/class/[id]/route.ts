import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Class from '@/models/Class';
import { verifyAuth } from '@/lib/verifyAuth';
import { successResponse, errorResponse, handleOptions } from '@/lib/apiResponse';

export async function OPTIONS() {
  return handleOptions();
}

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    const classItem = await Class.findOne({ _id: id, userId: authPayload.userId });
    if (!classItem) {
      return errorResponse('Class item not found or access denied', 404);
    }

    const body = await req.json();
    const { className, subject, room, startTime, endTime, dayOfWeek, instructor } = body;

    if (className !== undefined) classItem.className = className;
    if (subject !== undefined) classItem.subject = subject;
    if (room !== undefined) classItem.room = room;
    if (startTime !== undefined) classItem.startTime = startTime;
    if (endTime !== undefined) classItem.endTime = endTime;
    if (instructor !== undefined) classItem.instructor = instructor;

    if (dayOfWeek !== undefined) {
      const day = Number(dayOfWeek);
      if (isNaN(day) || day < 0 || day > 6) {
        return errorResponse('dayOfWeek must be a number between 0 and 6', 400);
      }
      classItem.dayOfWeek = day;
    }

    await classItem.save();
    return successResponse(classItem, 200);
  } catch (error: any) {
    console.error('Update class error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    const deletedClass = await Class.findOneAndDelete({ _id: id, userId: authPayload.userId });

    if (!deletedClass) {
      return errorResponse('Class item not found or access denied', 404);
    }

    return successResponse({ message: 'Class schedule item deleted successfully' }, 200);
  } catch (error: any) {
    console.error('Delete class error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
