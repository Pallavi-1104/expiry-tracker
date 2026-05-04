const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");

// ── REGISTER ─────────────────────────────────────────────
// POST /auth/register
// Body: { name, email, password }
router.post("/register", (req, res) => {
    const db = req.app.get("db");
    const { name, email, password } = req.body;

    // Validate inputs
    if (!name || !email || !password) {
        return res.json({ status: "error", message: "All fields are required" });
    }
    if (password.length < 6) {
        return res.json({ status: "error", message: "Password must be at least 6 characters" });
    }

    // Check if email already exists
    db.query("SELECT id FROM users WHERE email = ?", [email], (err, results) => {
        if (err) {
            console.log("Register DB error:", err);
            return res.json({ status: "error", message: "Database error" });
        }

        if (results.length > 0) {
            return res.json({ status: "error", message: "Email is already registered" });
        }

        // Hash the password (NEVER store plain text passwords!)
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) return res.json({ status: "error", message: "Hashing failed" });

            // Insert new user into database
            const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
            db.query(sql, [name, email, hashedPassword], (err, result) => {
                if (err) {
                    console.log("Insert user error:", err);
                    return res.json({ status: "error", message: "Could not create account" });
                }
                console.log("✅ New user registered:", email);
                res.json({ status: "success", message: "Account created! Please login." });
            });
        });
    });
});

// ── LOGIN ────────────────────────────────────────────────
// POST /auth/login
// Body: { email, password }
router.post("/login", (req, res) => {
    const db = req.app.get("db");
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ status: "error", message: "Email and password required" });
    }

    // Find user by email
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) {
            console.log("Login DB error:", err);
            return res.json({ status: "error", message: "Database error" });
        }

        if (results.length === 0) {
            return res.json({ status: "error", message: "No account found with this email" });
        }

        const user = results[0];

        // Compare entered password with the hashed password in DB
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.json({ status: "error", message: "Comparison error" });

            if (!isMatch) {
                return res.json({ status: "error", message: "Incorrect password" });
            }

            // Password is correct — create JWT token (valid for 7 days)
            const token = jwt.sign(
                { id: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            console.log("✅ User logged in:", email);
            res.json({
                status: "success",
                token:  token,
                name:   user.name,
                userId: user.id
            });
        });
    });
});

module.exports = router;