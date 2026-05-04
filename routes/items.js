const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");

// ── ADD ITEM ─────────────────────────────────────────────
// POST /add   (protected — must be logged in)
router.post("/add", auth, (req, res) => {
    const db = req.app.get("db");
    const { item_name, expiry_date, category } = req.body;
    const userId = req.userId; // set by authMiddleware

    if (!item_name || !expiry_date) {
        return res.json({ status: "error", message: "Item name and date are required" });
    }

    const cat = category || "General";
    const sql = "INSERT INTO inventory (item_name, expiry_date, category, user_id) VALUES (?, ?, ?, ?)";

    db.query(sql, [item_name, expiry_date, cat, userId], (err) => {
        if (err) {
            console.log("❌ Add item error:", err);
            return res.json({ status: "error" });
        }
        console.log("✅ Item added:", item_name);
        res.json({ status: "success" });
    });
});

// ── GET ALL ITEMS ─────────────────────────────────────────
// GET /items?search=milk&category=Food&filter=expiring_soon
router.get("/items", auth, (req, res) => {
    const db = req.app.get("db");
    const userId = req.userId;
    const { search, category, filter } = req.query;

    let sql    = "SELECT * FROM inventory WHERE user_id = ?";
    let params = [userId];

    // Search by name (partial match)
    if (search && search.trim() !== "") {
        sql += " AND item_name LIKE ?";
        params.push("%" + search.trim() + "%");
    }

    // Filter by category
    if (category && category !== "All") {
        sql += " AND category = ?";
        params.push(category);
    }

    // Show only items expiring in next 3 days
    if (filter === "expiring_soon") {
        sql += " AND expiry_date >= CURDATE()";
        sql += " AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)";
    }

    sql += " ORDER BY expiry_date ASC";

    db.query(sql, params, (err, results) => {
        if (err) {
            console.log("❌ Get items error:", err);
            return res.json([]);
        }
        res.json(results);
    });
});

// ── DASHBOARD COUNTS ──────────────────────────────────────
// GET /dashboard
router.get("/dashboard", auth, (req, res) => {
    const db = req.app.get("db");
    const userId = req.userId;

    const sql = `
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN expiry_date < CURDATE()
                THEN 1 ELSE 0 END) AS expired,
            SUM(CASE WHEN expiry_date >= CURDATE()
                     AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
                THEN 1 ELSE 0 END) AS expiring_soon,
            SUM(CASE WHEN expiry_date > DATE_ADD(CURDATE(), INTERVAL 3 DAY)
                THEN 1 ELSE 0 END) AS safe
        FROM inventory
        WHERE user_id = ?
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.log("❌ Dashboard error:", err);
            return res.json({ total:0, expired:0, expiring_soon:0, safe:0 });
        }
        res.json(results[0]);
    });
});

// ── DELETE ITEM ───────────────────────────────────────────
// DELETE /delete/:id
router.delete("/delete/:id", auth, (req, res) => {
    const db = req.app.get("db");
    const itemId = req.params.id;
    const userId = req.userId;

    // user_id check ensures users can only delete their own items
    db.query(
        "DELETE FROM inventory WHERE id = ? AND user_id = ?",
        [itemId, userId],
        (err, result) => {
            if (err) {
                console.log("❌ Delete error:", err);
                return res.json({ status: "error" });
            }
            console.log("✅ Deleted item id:", itemId);
            res.json({ status: "deleted" });
        }
    );
});

module.exports = router;