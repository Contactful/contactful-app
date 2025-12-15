'use client'

export default function Home() {
  const startCheckout = async () => {
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' }),
    })

    const data = await res.json()
    window.location.href = data.url
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Contactful – Dev Test</h1>
      <button onClick={startCheckout}>
        Test Stripe Checkout (PRO)
      </button>
    </main>
  )
}

