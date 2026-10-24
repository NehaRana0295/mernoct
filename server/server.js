


const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const User = require("./models/User");
const requireAuth = require("./middleware/requireAuth");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS must allow credentials so the browser can send the auth cookie.
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked this origin: ${origin}`));
    },
    credentials: true,
  })
);

// Parse JSON and cookies before routes try to read req.body or req.cookies.
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    console.info(
      `[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`,
      { origin: req.headers.origin || "(none)" }
    );
  });
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

// One-day, HTTP-only cookie: frontend JavaScript cannot read the token.
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};

// SIGNUP: validate fields, hash the password, create the user, and sign in.
app.post("/api/auth/signup", async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!name || !email || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Name, email, and a password of at least 8 characters are required.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    const token = jwt.sign(
      { sub: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("authToken", token, cookieOptions);
    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "That email is already registered." });
    }
    console.error("[Auth] Signup failed:", error);
    res.status(500).json({ message: "Could not create account." });
  }
});

// LOGIN: compare the password with the saved hash, then issue the auth cookie.
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const user = await User.findOne({ email });

    // Same error for unknown email and wrong password.
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { sub: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.cookie("authToken", token, cookieOptions);
    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("[Auth] Login failed:", error);
    res.status(500).json({ message: "Could not log in." });
  }
});

// ME: lets the frontend restore the signed-in user after a browser refresh.
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("name email");
    if (!user) return res.status(401).json({ message: "Account not found." });
    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("[Auth] Loading current user failed:", error);
    res.status(500).json({ message: "Could not load your account." });
  }
});

// LOGOUT: remove the browser's auth cookie.
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("authToken", { ...cookieOptions, maxAge: undefined });
  res.json({ message: "Logged out." });
});

const mediaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mediaUrl: { type: String, default: "" },
    mediaType: { type: String, default: "" },
  },
  { timestamps: true }
);

// The list endpoint filters by category and sorts newest first.
mediaSchema.index({ category: 1, createdAt: -1 });

const Media = mongoose.model("Media", mediaSchema);

const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4"];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error("Use JPG, PNG, WebP, or MP4."));
    }

    callback(null, true);
  },
});

app.get("/api/posts", requireAuth, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const category = req.query.category;

    // Every query is scoped to the authenticated user, even when category is empty.
    const filter = { owner: req.userId };
    if (category) filter.category = category;

    const posts = await Media.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json(posts);
  } catch (error) {
    console.error("[API] GET /api/posts failed:", error);
    res.status(500).json({ message: "Could not load posts." });
  }
});

app.post("/api/posts", requireAuth, upload.single("media"), async (req, res) => {
  try {
    const title = req.body.title?.trim();
    const category = req.body.category?.trim();

    if (!title || !category) {
      return res.status(400).json({ message: "Title and category are required." });
    }

    const post = await Media.create({
      title,
      category,
      owner: req.userId,
      mediaUrl: req.file ? `/uploads/${req.file.filename}` : "",
      mediaType: req.file?.mimetype || "",
    });

    console.info("[API] Post created", { id: post._id.toString() });
    res.status(201).json(post);
  } catch (error) {
    console.error("[API] POST /api/posts failed:", error);
    res.status(400).json({ message: error.message || "Could not create post." });
  }
});

app.get("/api/stats/categories", requireAuth, async (req, res) => {
  try {
    const stats = await Media.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.userId) } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, category: "$_id", count: 1 } },
    ]);

    res.json(stats);
  } catch (error) {
    console.error("[API] GET /api/stats/categories failed:", error);
    res.status(500).json({ message: "Could not load category stats." });
  }
});

app.use((error, req, res, _next) => {
  console.error(`[API] Middleware error for ${req.method} ${req.originalUrl}:`, error);
  res.status(error.status || 400).json({ message: error.message || "Request failed." });
});

mongoose.connection.on("error", (error) => {
  console.error("[MongoDB] Connection error:", error);
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
    server.on("error", (error) => {
      console.error(`[Server] Could not listen on port ${PORT}:`, error);
      process.exitCode = 1;
    });
  })
  .catch((error) => {
    console.error("[MongoDB] Connection failed:", error);
    process.exit(1);
  });
