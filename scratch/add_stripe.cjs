const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/index.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add Stripe import
if (!code.includes("import Stripe from 'stripe'")) {
  code = "import Stripe from 'stripe'\n" + code;
}

// 2. Add Stripe bindings
code = code.replace(
  'CRON_SECRET: string',
  `CRON_SECRET: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PRICE_PREMIUM: string
  STRIPE_PRICE_TICKET: string`
);

// 3. Add Stripe endpoints
const stripeEndpoints = `
// --- Stripe Integration ---
app.post('/api/create-checkout-session', async (c) => {
  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' });
  const body = await c.req.json();
  const userId = body.userId;
  const priceId = body.priceId;
  const isSubscription = body.isSubscription;

  if (!userId || !priceId) {
    return c.json({ error: 'Missing userId or priceId' }, 400);
  }

  // Get or Create Customer (Simplified for MVP, ideally look up from users table first)
  const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);
  const { data: user } = await supabase.from('users').select('stripe_customer_id').eq('line_user_id', userId).single();
  
  let customerId = user?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { line_user_id: userId } });
    customerId = customer.id;
    await supabase.from('users').update({ stripe_customer_id: customerId }).eq('line_user_id', userId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: isSubscription ? 'subscription' : 'payment',
    success_url: \`https://liff.line.me/\${ENV.LINE_LIFF_ID}/premium?success=true\`,
    cancel_url: \`https://liff.line.me/\${ENV.LINE_LIFF_ID}/premium?canceled=true\`,
    metadata: { line_user_id: userId, isSubscription: isSubscription ? 'true' : 'false' }
  });

  return c.json({ url: session.url });
});

app.post('/api/stripe-webhook', async (c) => {
  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' });
  const sig = c.req.header('stripe-signature');
  const body = await c.req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig || '', ENV.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook Error:', err.message);
    return c.text(\`Webhook Error: \${err.message}\`, 400);
  }

  const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.line_user_id;
      const isSubscription = session.metadata?.isSubscription === 'true';

      if (userId) {
        if (isSubscription) {
          await supabase.from('users').update({ is_premium: true, stripe_subscription_id: session.subscription as string }).eq('line_user_id', userId);
        } else {
          // Increment tickets
          const { data: user } = await supabase.from('users').select('tickets').eq('line_user_id', userId).single();
          const currentTickets = user?.tickets || 0;
          await supabase.from('users').update({ tickets: currentTickets + 5 }).eq('line_user_id', userId);
        }
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase.from('users').update({ is_premium: false, stripe_subscription_id: null }).eq('stripe_subscription_id', subscription.id);
      break;
    }
  }

  return c.json({ received: true });
});

// --- Routes ---`;

code = code.replace('// --- Routes ---', stripeEndpoints);

fs.writeFileSync(filePath, code);
console.log('Successfully injected Stripe endpoints');
