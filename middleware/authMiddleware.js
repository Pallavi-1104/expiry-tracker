

const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    // ❌ No token
    if (!token) {
        return res.status(401).json({
            status: "error",
            message: "No token provided. Please login first."
        });
    }

    // ✅ Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                status: "error",
                message: "Token is invalid or expired."
            });
        }

        // Attach user data
        req.userId = decoded.id;

        next();
    });
};