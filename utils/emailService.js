const nodemailer = require("nodemailer");

// Setup Gmail transporter using .env credentials
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS   // App password, NOT gmail password
    }
});

// This function is called by the cron job in server.js every day at 8AM
async function sendExpiryAlerts(db) {
    console.log("📧 Checking items expiring in the next 3 days...");

    // Find all items expiring in next 3 days, join with users to get email
    const sql = `
        SELECT
            i.id,
            i.item_name,
            i.expiry_date,
            i.category,
            u.name        AS user_name,
            u.email       AS user_email,
            DATEDIFF(i.expiry_date, CURDATE()) AS days_left
        FROM inventory i
        JOIN users u ON i.user_id = u.id
        WHERE i.expiry_date >= CURDATE()
          AND i.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
        ORDER BY u.email ASC, i.expiry_date ASC
    `;

    db.query(sql, async (err, results) => {
        if (err) {
            console.log("❌ Email query error:", err);
            return;
        }

        if (results.length === 0) {
            console.log("✅ No expiring items found. No emails sent.");
            return;
        }

        // Group items by each user's email
        const grouped = {};
        results.forEach(row => {
            if (!grouped[row.user_email]) {
                grouped[row.user_email] = {
                    name: row.user_name,
                    items: []
                };
            }
            grouped[row.user_email].items.push(row);
        });

        // Send one email per user
        for (const email in grouped) {
            const user = grouped[email];

            // Build HTML table rows for each item
            const rows = user.items.map(item => {
                const daysText = item.days_left === 0
                    ? 'Expires TODAY!'
                    : `${item.days_left} day(s) left`;

                const expDate = new Date(item.expiry_date);
                const formatted = expDate.getDate().toString().padStart(2,"0")
                    + "-" + (expDate.getMonth()+1).toString().padStart(2,"0")
                    + "-" + expDate.getFullYear();

                return `
                
                  ${item.item_name}
                  ${item.category}
                  ${formatted}
                  ${daysText}
                `;
            }).join("");

            // Full HTML email template
            const html = `
            

              

                
⚠️ Expiry Alert

                
Expiry Tracker System — Automated Notification


              

              

                
Hello ${user.name},


                

                  The following ${user.items.length} item(s) in your tracker
                  are expiring within the next 3 days. Please take action!
                


                ${rows}
Item	Category	Expiry Date	Status

                

                  This is an automated alert from your Expiry Tracker System.
                


              

            
`;

            try {
                await transporter.sendMail({
                    from:    process.env.EMAIL_USER,
                    to:      email,
                    subject: `⚠️ ${user.items.length} item(s) expiring soon — Expiry Tracker`,
                    html:    html
                });
                console.log(`✅ Alert email sent → ${email}`);
            } catch (e) {
                console.log(`❌ Failed to email ${email}:`, e.message);
            }
        }
    });
}

module.exports = { sendExpiryAlerts };