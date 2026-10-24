const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true, // MongoDB will reject duplicate email addresses.
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true, // Store only the bcrypt hash, never the original password.
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);