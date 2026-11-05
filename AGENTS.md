# Architecture rules
- Private chat access is enforced by database message policies using subscriptions or wallet-funded timed passes; the UI reads the same access rule.
- Coin purchase denominations are shared by the wallet page and payment function to keep validation consistent.
- Conversation creation uses the protected open_private_chat function with deterministic user ordering and block checks to avoid client-side insert permissions and duplicate threads.