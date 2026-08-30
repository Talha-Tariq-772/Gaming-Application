-- Replace any test/mock payment_methods rows with the real receiving
-- accounts. These are public receiving-account details shown to customers
-- during checkout (bank/wallet name, account title, IBAN/number) — not
-- secrets — so they're seeded directly here rather than via a one-off
-- script, keeping this change tracked and reversible like any other schema
-- change.
--
-- Bank account numbers for the two IBAN-only rows are the trailing 16
-- digits of the IBAN itself (standard Pakistani IBAN layout: PK + 2-digit
-- checksum + 4-char bank code + 16-digit account number) — there's no
-- separately-issued account number for these two.
delete from public.payment_methods;

insert into public.payment_methods
  (label, account_title, account_number, iban, instructions, is_active, sort_order)
values
  (
    'Bank Transfer (HBL)',
    'Saad Ali',
    '0016607900409503',
    'PK65HABB0016607900409503',
    'Habib Bank Limited (HBL)',
    true,
    1
  ),
  (
    'Bank Transfer (Faysal Bank)',
    'Naseer',
    '3650301000002594',
    'PK33FAYS3650301000002594',
    'Faysal Bank',
    true,
    2
  ),
  (
    'JazzCash',
    'Naseer',
    '03403838944',
    null,
    'Send via JazzCash mobile wallet',
    true,
    3
  ),
  (
    'Easypaisa',
    'Naseer',
    '03403838944',
    null,
    'Send via Easypaisa mobile wallet',
    true,
    4
  );
