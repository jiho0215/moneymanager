/**
 * Permissive Database types for MVP.
 * After all migrations stabilize, regenerate via `npx supabase gen types typescript`.
 */

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

type AnyRow = Record<string, Json | undefined>;

interface AnyTable {
  Row: AnyRow;
  Insert: AnyRow;
  Update: AnyRow;
  Relationships: [];
}

interface AnyFunction {
  Args: Record<string, Json | undefined>;
  Returns: Json;
}

export type Database = {
  public: {
    Tables: {
      families: AnyTable;
      memberships: AnyTable;
      consents: AnyTable;
      accounts: AnyTable;
      transactions: AnyTable;
      claim_attempts: AnyTable;
      weekly_snapshots: AnyTable;
      kid_login_codes: AnyTable;
    };
    Views: Record<string, never>;
    Functions: {
      compute_week_num: AnyFunction;
      reconcile_balance: AnyFunction;
      recompute_balance: AnyFunction;
      create_family_with_kid: AnyFunction;
      process_claim: AnyFunction;
      transfer_free_to_experiment: AnyFunction;
      process_deposit: AnyFunction;
      choose_cycle_end_action: AnyFunction;
      generate_kid_login_code: AnyFunction;
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
