import { createClient } from '@supabase/supabase-js'
import { Team } from '../types'; // Assuming your types file defines the database schema structure

// Ensure environment variables are loaded
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in .env file");
}

// Define Database interface matching Supabase schema (adjust if needed)
// This helps with type safety but doesn't require generating types from Supabase CLI
interface Database {
  public: {
    Tables: {
      teams: {
        Row: Team; // Use your existing Team type (now updated with logoUrl)
        Insert: Omit<Team, 'id'>; // Type for inserting new teams (omit auto-generated id)
        Update: Partial<Team>; // Type for updating teams
      }
    }
    Views: {
      [_ in never]: never;
    }
    Functions: {
      [_ in never]: never;
    }
    Enums: {
      [_ in never]: never;
    }
    CompositeTypes: {
      [_ in never]: never;
    }
  }
}


// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
