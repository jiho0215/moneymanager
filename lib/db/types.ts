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
      rotate_kid_access_code: AnyFunction;
      generate_unique_access_code: AnyFunction;
      next_sunday_kst: AnyFunction;
      finalize_parent_recommendations: AnyFunction;
      finalize_kid_choices: AnyFunction;
      today_midnight_in_tz: AnyFunction;
      update_family_timezone: AnyFunction;
      generate_invite_token: AnyFunction;
      add_kid_to_family: AnyFunction;
      claim_kid_login: AnyFunction;
      reset_kid_login_id: AnyFunction;
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
