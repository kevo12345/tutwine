CREATE TABLE public.nowpayments_ipn_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  signature_valid boolean NOT NULL DEFAULT false,
  signature_present boolean NOT NULL DEFAULT false,
  payment_id text,
  order_id text,
  payment_status text,
  pay_currency text,
  pay_amount numeric,
  price_amount numeric,
  price_currency text,
  matched_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  activation_result text NOT NULL DEFAULT 'noop',
  error text,
  raw_payload jsonb
);

CREATE INDEX nowpayments_ipn_log_received_at_idx ON public.nowpayments_ipn_log (received_at DESC);
CREATE INDEX nowpayments_ipn_log_payment_id_idx ON public.nowpayments_ipn_log (payment_id);
CREATE INDEX nowpayments_ipn_log_order_id_idx ON public.nowpayments_ipn_log (order_id);

GRANT SELECT ON public.nowpayments_ipn_log TO authenticated;
GRANT ALL ON public.nowpayments_ipn_log TO service_role;

ALTER TABLE public.nowpayments_ipn_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view IPN log"
  ON public.nowpayments_ipn_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));