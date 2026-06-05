import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details.email;
    const password = 'Mestre#' + Math.random().toString(36).slice(2, 8).toUpperCase();

    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error && error.message !== 'User already registered') {
      return res.status(500).json({ error: error.message });
    }

    await resend.emails.send({
      from: 'Presença Digital 2.0 <noreply@dmaalmacheckout.shop>',
      to: email,
      subject: '🎉 Seu acesso ao Presença Digital 2.0 está pronto!',
      html: `
        <h2>Pagamento confirmado! 🎉</h2>
        <p>Olá! Seu acesso foi liberado. Aqui estão seus dados:</p>
        <p><strong>Login:</strong> ${email}</p>
        <p><strong>Senha:</strong> ${password}</p>
        <br>
        <a href="https://xn--platafomrapresenadigital-bec.abacusai.app/" 
           style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">
          Acessar Plataforma
        </a>
      `
    });
  }

  res.status(200).json({ received: true });
}
