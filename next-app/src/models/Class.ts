import mongoose, { Schema } from 'mongoose';

const ClassSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    className: {
      type: String,
      required: [true, 'Please provide a class name.'],
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
    },
    room: {
      type: String,
      trim: true,
    },
    startTime: {
      type: String, // "HH:MM" 24h format
      required: [true, 'Please provide a start time.'],
    },
    endTime: {
      type: String, // "HH:MM" 24h format
      required: [true, 'Please provide an end time.'],
    },
    dayOfWeek: {
      type: Number, // 0 (Sunday) to 6 (Saturday)
      required: [true, 'Please provide a day of the week.'],
    },
    instructor: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Class || mongoose.model('Class', ClassSchema);
