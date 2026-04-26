DROP TRIGGER IF EXISTS transactions_no_update ON transactions;
DROP TRIGGER IF EXISTS transactions_no_delete ON transactions;
DROP TRIGGER IF EXISTS consents_no_update ON consents;
DROP TRIGGER IF EXISTS consents_no_delete ON consents;
DROP FUNCTION IF EXISTS transactions_immutable();
DROP FUNCTION IF EXISTS consents_immutable();
