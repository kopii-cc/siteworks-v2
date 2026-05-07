/**
 * Cloudflare Pages Function — Contact Form Handler
 * POST /api/submit
 *
 * Receives form submissions from the contact page, validates the data,
 * and forwards the enquiry via email.
 *
 * TO CONFIGURE EMAIL SENDING:
 * 1. In Cloudflare Dashboard → Pages → your project → Settings → Functions
 * 2. Add an environment variable for your email service:
 *    - NOTIFICATION_EMAIL = "your@email.com" (where to receive enquiries)
 *    - SENDGRID_API_KEY = "SG.xxx" (if using SendGrid)
 *    - Or use Cloudflare Email Workers for native email sending
 *
 * For a quick setup without external services, this function logs
 * the submission and returns a success response. You can integrate
 * any email provider by adding a fetch call below.
 */

export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();

    // Parse all fields into an object
    const data = {};
    for (const [key, value] of formData) {
      data[key] = value;
    }

    // Validate required fields
    const errors = [];
    if (!data.name || data.name.trim().length < 2) {
      errors.push('Name is required');
    }
    if (!data.phone || data.phone.trim().length < 6) {
      errors.push('Phone number is required');
    }
    if (!data.message || data.message.trim().length < 5) {
      errors.push('Message is required');
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ success: false, errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Format the enquiry for email/notification
    const serviceNames = {
      retaining: 'Limestone Retaining Wall',
      earthworks: 'Bulk Earthworks',
      bobcat: 'Bobcat & Site Clearing',
      drainage: 'Drainage & Site Prep',
      other: 'Other / Not Sure',
    };

    const emailBody = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NEW ENQUIRY — COASTAL LIMESTONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name:     ${data.name}
Phone:    ${data.phone}
Email:    ${data.email || 'Not provided'}
Service:  ${serviceNames[data.service] || data.service || 'Not specified'}
Location: ${data.address || 'Not provided'}

Message:
${data.message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Submitted: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Perth' })}
IP: ${context.request.headers.get('cf-connecting-ip') || 'Unknown'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    // ========================================
    // EMAIL SENDING — Configure one of these:
    // ========================================

    // OPTION 1: SendGrid (set SENDGRID_API_KEY env var)
    if (context.env.SENDGRID_API_KEY) {
      const notificationEmail = context.env.NOTIFICATION_EMAIL || 'info@coastallimestone.com.au';
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: notificationEmail }],
            subject: `[New Enquiry] ${serviceNames[data.service] || 'Website'} — ${data.name}`,
          }],
          from: { email: 'noreply@coastallimestone.com.au', name: 'Coastal Limestone Website' },
          content: [{ type: 'text/plain', value: emailBody }],
        }),
      });
    }

    // OPTION 2: Mailgun (set MAILGUN_API_KEY and MAILGUN_DOMAIN env vars)
    if (context.env.MAILGUN_API_KEY && !context.env.SENDGRID_API_KEY) {
      const notificationEmail = context.env.NOTIFICATION_EMAIL || 'info@coastallimestone.com.au';
      const mailgunDomain = context.env.MAILGUN_DOMAIN;
      const formData2 = new FormData();
      formData2.append('from', 'Coastal Limestone Website <noreply@coastallimestone.com.au>');
      formData2.append('to', notificationEmail);
      formData2.append('subject', `[New Enquiry] ${serviceNames[data.service] || 'Website'} — ${data.name}`);
      formData2.append('text', emailBody);
      await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa('api:' + context.env.MAILGUN_API_KEY)}`,
        },
        body: formData2,
      });
    }

    // Log submission (visible in Functions logs for debugging)
    console.log('New enquiry received:', JSON.stringify(data, null, 2));

    // Return success — the frontend JS will handle the redirect/show message
    return new Response(JSON.stringify({
      success: true,
      message: 'Enquiry received! We\'ll be in touch within 24 hours.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Form handler error:', err);
    return new Response(JSON.stringify({
      success: false,
      errors: ['Something went wrong. Please try again or call us directly.'],
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
