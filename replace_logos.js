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

        // Replace <div class="sidebar-brand__orb">...</div>
        content = content.replace(/<div\s+class="sidebar-brand__orb"[^>]*>.*?<\/div>/gi, '<img src="/css/logo.PNG" alt="Logo" class="sidebar-brand__orb" style="background: none; object-fit: contain; padding: 2px;">');
        
        // Replace <div class="logo">...</div>
        content = content.replace(/<div\s+class="logo"[^>]*>.*?<\/div>/gi, '<img src="/css/logo.PNG" alt="Logo" class="logo" style="background: none; object-fit: contain; border-radius: 50%; padding: 2px;">');

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
