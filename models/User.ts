import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface IUser {
  username: string;
  email: string;
  password: string;
  friends: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    friends: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const User = (mongoose.models.User as Model<IUser>) ?? mongoose.model<IUser>("User", userSchema);