const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  // The login route puts this cookie in the browser.
  const token = req.cookies?.authToken;

  if (!token) {
    return res.status(401).json({ message: "Please log in first." });
  }

  try {
    // Verify that the token was signed by this server and has not expired.
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Routes can use this ID to find or filter the signed-in user's data.
    req.userId = payload.sub;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Your session expired. Please log in again." });
  }
}

module.exports = requireAuth;