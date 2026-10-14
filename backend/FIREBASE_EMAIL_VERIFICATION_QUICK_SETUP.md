# Firebase Email Verification - Quick Setup Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Log into Firebase Console
1. Go to https://console.firebase.google.com
2. Select project: **hnsapp-f9f67**
3. Click **Authentication** in left menu

### Step 2: Customize Email Template
1. Click **Templates** (or **Email Templates**)
2. Find **"Verify email address"**
3. Click **Edit** (pencil icon)

### Step 3: Update Sender Details
In the email template editor:

**Sender Name:** `H&S Booking System`
**Sender Email:** `noreply@hnsapp.com`

### Step 4: Update Email Subject
**Subject:** `Verify Your Email Address - H&S Booking System`

### Step 5: Replace Email Template Body
Delete the default template and paste this professional template:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email Address - H&S Booking System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); padding: 40px 20px; text-align: center; color: white; }
        .header-icon { font-size: 48px; margin-bottom: 15px; }
        .header h1 { font-size: 28px; font-weight: 700; margin: 0; }
        .header p { font-size: 14px; opacity: 0.95; margin: 5px 0 0 0; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 16px; color: #1f2937; margin-bottom: 20px; line-height: 1.6; }
        .message { font-size: 15px; color: #4b5563; line-height: 1.8; margin-bottom: 30px; }
        .button-wrapper { text-align: center; margin: 35px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-transform: uppercase; }
        .link-alternative { margin: 25px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #2563eb; border-radius: 4px; }
        .link-alternative p { font-size: 13px; color: #4b5563; margin-bottom: 8px; }
        .link-alternative a { color: #2563eb; word-break: break-all; font-weight: 500; text-decoration: none; }
        .security-note { margin: 30px 0; padding: 15px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 13px; color: #1e40af; line-height: 1.6; }
        .footer { background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { font-size: 13px; color: #6b7280; margin-bottom: 10px; line-height: 1.6; }
        .footer-links { font-size: 12px; color: #9ca3af; }
        .footer-links a { color: #2563eb; text-decoration: none; margin: 0 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">🚐</div>
            <h1>H&S Booking System</h1>
            <p>Safe and Reliable School Services</p>
        </div>
        <div class="content">
            <p class="greeting">Hello,</p>
            <p class="message">Thank you for signing up! To complete your registration and access H&S Booking System, please verify your email address by clicking the button below.</p>
            <div class="button-wrapper">
                <a href="%LINK%" class="cta-button">Verify Email Address</a>
            </div>
            <p class="message" style="margin-top: 25px;">Or copy and paste this link into your browser:</p>
            <div class="link-alternative">
                <p><strong>Verification Link:</strong></p>
                <a href="%LINK%">%LINK%</a>
            </div>
            <div class="security-note">
                <strong>⏱️ Link Expiration:</strong> This verification link will expire in 24 hours.
            </div>
            <div class="security-note" style="background: #fef3c7; border-color: #fcd34d; color: #92400e;">
                <strong>🔒 Security Tip:</strong> We will never ask for your password via email. If you did not create this account, please ignore this email.
            </div>
            <p class="message" style="font-size: 14px; color: #6b7280;">Need help? Contact us at <a href="mailto:support@hnsapp.com" style="color: #2563eb; text-decoration: none;">support@hnsapp.com</a></p>
        </div>
        <div class="footer">
            <p><strong>H&S Booking System</strong><br>Safe and reliable school service booking</p>
            <div style="height: 1px; background: #e5e7eb; margin: 15px 0;"></div>
            <div class="footer-links">
                <a href="https://hnsapp.com">Website</a> • 
                <a href="https://hnsapp.com/privacy">Privacy Policy</a> • 
                <a href="https://hnsapp.com/terms">Terms of Service</a>
            </div>
            <p style="margin-top: 15px; font-size: 11px; color: #d1d5db;">This is an automated email. Please do not reply directly.</p>
        </div>
    </div>
</body>
</html>
```

### Step 6: Save Changes
1. Click **Save** button
2. Confirm the changes

### Step 7: Test Email Template
1. Go to **Authentication** > **Users**
2. Select any user
3. Click **Send Verification Email**
4. Check test inbox for email

## ✅ Verification Checklist

After setup, verify:

- [ ] Email arrives in inbox (not spam)
- [ ] Sender shows "H&S Booking System"
- [ ] Subject line is professional
- [ ] Email template renders properly
- [ ] Button works and links correctly
- [ ] Link expires after 24 hours
- [ ] Admin accounts don't require verification
- [ ] Parent/Driver accounts require verification

## 🔧 Advanced: Custom Domain Setup (Optional)

For even better deliverability:

1. **In Firebase Console:**
   - Go to **Authentication** > **Email Templates** > **Manage Custom Domains**
   - Add domain: `noreply.hnsapp.com`
   - Follow Firebase's DNS verification

2. **Add DNS Records** (in your domain provider):
   
   **SPF Record:**
   ```
   Host: noreply.hnsapp.com
   Type: TXT
   Value: v=spf1 include:sendgrid.net ~all
   ```

   **DMARC Record:**
   ```
   Host: _dmarc.noreply
   Type: TXT
   Value: v=DMARC1; p=quarantine; rua=mailto:noreply@hnsapp.com
   ```

3. **Verify in Firebase:**
   - Wait for DNS to propagate (5-15 min)
   - Firebase will auto-verify
   - Activate custom domain

## 📱 User Experience

After implementation, users will see:

1. **Signup Completion:**
   - "Verification email sent! Check your inbox and spam folder"
   - Step-by-step instructions
   - Support contact info

2. **Email Received:**
   - Professional email from "H&S Booking System"
   - Clear action button
   - Security information

3. **After Verification:**
   - Account immediately activated
   - Can log in and start using service
   - Admin flow unchanged

## 🆘 Troubleshooting

**Email in spam folder?**
- Custom domain not set up (follow Advanced section)
- DNS records not configured
- Implement SPF/DKIM/DMARC

**Button not working?**
- Email client rendering issue
- Alternative link provided works
- Check link expiration

**Users not receiving?**
- Check spam folder
- Request new verification email
- Contact support: support@hnsapp.com

## 📞 Need Help?

- Firebase Docs: https://firebase.google.com/docs/auth
- Full Guide: `FIREBASE_EMAIL_VERIFICATION_SETUP.md`
- Support: support@hnsapp.com
