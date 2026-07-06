import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Please provide an email.'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password.'],
    },
    gmailAddress: {
      type: String,
      default: '',
    },
    gmailAppPassword: {
      type: String,
      default: '',
    },
    quickLinks: {
      type: [
        {
          name: { type: String, required: true },
          url: { type: String, required: true },
        }
      ],
      default: [],
    },
  },
  { timestamps: true }
);

if (mongoose.models && mongoose.models.User) {
  delete mongoose.models.User;
}
export default mongoose.models.User || mongoose.model('User', UserSchema);
