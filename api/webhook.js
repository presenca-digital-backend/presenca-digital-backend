import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.CHAVE_SEGRETA_LISTRADA);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.CHAVE_DE_SERVIÇO_SUPABASE
);
const resend = new Resend(process.env.REENVIAR_API_CHAVE);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SEGREDO
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
        <br><br>
        <p style="color:#666;font-size:12px;">Guarde bem sua senha. Em caso de dúvidas responda este email.</p>
      `
    });
  }

  res.status(200).json({ received: true });
}
