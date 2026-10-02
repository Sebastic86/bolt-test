import { createClient } from '@supabase/supabase-js';
import { Team, Player, Match, MatchPlayer, UserProfile } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided in .env file');
}

// `interface`-declared types (Team/Player/etc., from ../types) don't
// structurally satisfy postgrest-js's `Record<string, unknown>` constraint
// the same way a plain object type does — TS treats declared interfaces
// more conservatively here since they're open to declaration merging. Left
// unwrapped, every `Row: Team` collapses the *whole* Schema generic to
// `never`, which is why every .insert()/.update() call failed to
// type-check even on tables whose Insert/Update already used Omit/Partial
// (those produce mapped types, which are fine on their own — but they were
// being read off a Schema that had already gone `never`). This identity
// mapped type "flattens" an interface into a plain object type that does
// satisfy the constraint, with zero effect on the resulting type's shape.
type Flatten<T> = { [K in keyof T]: T[K] };

// Mirrors supabase/migrations/001_tables.sql exactly. `Relationships: []` on
// every table is required by @supabase/postgrest-js's GenericTable shape.
interface Database {
  public: {
    Tables: {
      teams: {
        Row: Flatten<Team>;
        Insert: Omit<Team, 'id'>;
        Update: Partial<Team>;
        Relationships: [];
      };
      players: {
        Row: Flatten<Player>;
        Insert: Omit<Player, 'id' | 'created_at'>;
        Update: Partial<Player>;
        Relationships: [];
      };
      matches: {
        Row: Flatten<Match>;
        Insert: Omit<Match, 'id' | 'played_at' | 'created_at'>;
        Update: Partial<Match>;
        Relationships: [];
      };
      match_players: {
        Row: Flatten<MatchPlayer>;
        Insert: Omit<MatchPlayer, 'id' | 'created_at'>;
        // Only team_number is ever updated (moving a player between teams),
        // per 003_rls.sql's "update own match's players" policy — there is
        // no delete policy (cascade-only) and no other column is mutable.
        Update: Partial<Pick<MatchPlayer, 'team_number'>>;
        Relationships: [];
      };
      user_profiles: {
        Row: Flatten<UserProfile>;
        // Unlike the other tables, id is NOT auto-generated here — it's
        // the FK to auth.users(id) and must be supplied on insert.
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>;
        Update: Partial<Pick<UserProfile, 'role' | 'updated_at'>>;
        Relationships: [];
      };
    };
    // Record<string, never>, NOT `{ [_ in never]: never }` — the latter
    // doesn't structurally satisfy postgrest-js's `Record<string,
    // GenericView>` and silently collapses every table's Insert/Update to
    // `never`, breaking every .insert()/.update() call's type-checking.
    Views: Record<string, never>;
    Functions: {
      admin_list_users: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          email: string;
          created_at: string;
          last_sign_in_at: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
