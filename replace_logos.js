const fs = require('fs');
const path = require('path');

const files = [
  "admin-login.html", "aml.html", "buyconfirm.html", "confirm_id.html",
  "contact.html", "create_ticket.html", "dashboard.html", "faq.html",
  "forgot-password.html", "help.html", "index.html", "login.html",
  "order_summary.html", "payment_method.html", "privacy.html", "profile.html",
  "register-success.html", "register.html", "reset-password.html",
  "sell_order_summary.html", "sell_payment_method.html", "sell_payout_details.html",
  "sell_send_crypto.html", "support.html", "terms.html", "ticket_detail.html",
  "trade.html", "transactions.html",
  "admin/index.html", "admin/transactions.html", "admin/users.html", "admin/support.html", "admin/referrals.html", "admin/rates.html"
];

const basePath = '/Users/vandijk/Downloads/Telegram Desktop/SC/public';

let updatedCount = 0;

for (const file of files) {
    const filePath = path.join(basePath, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let initialContent = content;

        // Replace logo element encapsulating CE or CP
        content = content.replace(/<div\s+class="logo"[^>]*>(?:CE|CP)<\/div>/gi, '<img src="/css/logo.jpg" alt="Logo" class="logo" style="width: 35px; height: 35px; object-fit: cover; border-radius: 50%;">');
        
        // Also capture anchors that function as logos
        content = content.replace(/<a\s+href="[^"]*"\s+class="logo"[^>]*>(?:CE|CP)<\/a>/gi, '<a href="index.html" class="logo" style="width: 35px; height: 35px; display: inline-block; overflow: hidden; border-radius: 50%;"><img src="/css/logo.jpg" alt="Logo" style="width:100%; height:100%; object-fit:cover;"></a>');

        if (content !== initialContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated: ${file}`);
            updatedCount++;
        }
    } else {
        console.log(`Not found: ${file}`);
    }
}
console.log(`\nCompleted! \${updatedCount} files updated.`);
