export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      households: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string };
        Relationships: Rel[];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: "admin" | "member";
          joined_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role?: "admin" | "member";
          joined_at?: string;
        };
        Update: { role?: "admin" | "member" };
        Relationships: Rel[];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string | null;
          avatar_url: string | null;
          household_id: string | null;
          currency: string;
          payday_day: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          household_id?: string | null;
          currency?: string;
          payday_day?: number | null;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          household_id?: string | null;
          currency?: string;
          payday_day?: number | null;
        };
        Relationships: Rel[];
      };
      accounts: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          name: string;
          type: "personal" | "shared";
          balance: number;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          name: string;
          type?: "personal" | "shared";
          balance?: number;
          currency?: string;
        };
        Update: {
          name?: string;
          type?: "personal" | "shared";
          balance?: number;
        };
        Relationships: Rel[];
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          icon: string | null;
          color: string;
          type: "income" | "expense";
          parent_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          icon?: string | null;
          color?: string;
          type?: "income" | "expense";
          parent_id?: string | null;
          sort_order?: number;
        };
        Update: {
          name?: string;
          icon?: string | null;
          color?: string;
          type?: "income" | "expense";
          parent_id?: string | null;
          sort_order?: number;
        };
        Relationships: Rel[];
      };
      transactions: {
        Row: {
          id: string;
          account_id: string;
          category_id: string | null;
          user_id: string;
          amount: number;
          currency: string;
          description: string;
          merchant_name: string | null;
          date: string;
          type: "income" | "expense" | "transfer";
          is_shared: boolean;
          is_planned: boolean;
          import_source: "manual" | "csv" | "pdf";
          import_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          category_id?: string | null;
          user_id: string;
          amount: number;
          currency?: string;
          description?: string;
          merchant_name?: string | null;
          date: string;
          type?: "income" | "expense" | "transfer";
          is_shared?: boolean;
          is_planned?: boolean;
          import_source?: "manual" | "csv" | "pdf";
          import_hash?: string | null;
        };
        Update: {
          category_id?: string | null;
          amount?: number;
          description?: string;
          merchant_name?: string | null;
          date?: string;
          type?: "income" | "expense" | "transfer";
          is_shared?: boolean;
          is_planned?: boolean;
        };
        Relationships: Rel[];
      };
      budgets: {
        Row: {
          id: string;
          household_id: string;
          category_id: string;
          amount: number;
          period: "monthly" | "yearly";
          start_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          category_id: string;
          amount: number;
          period?: "monthly" | "yearly";
          start_date?: string;
        };
        Update: { amount?: number; period?: "monthly" | "yearly" };
        Relationships: Rel[];
      };
      goals: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          target_amount: number;
          current_amount: number;
          deadline: string | null;
          icon: string | null;
          color: string;
          is_completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          target_amount: number;
          current_amount?: number;
          deadline?: string | null;
          icon?: string | null;
          color?: string;
          is_completed?: boolean;
        };
        Update: {
          name?: string;
          target_amount?: number;
          current_amount?: number;
          deadline?: string | null;
          icon?: string | null;
          color?: string;
          is_completed?: boolean;
        };
        Relationships: Rel[];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          is_read?: boolean;
        };
        Update: { is_read?: boolean };
        Relationships: Rel[];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        };
        Update: { endpoint?: string; p256dh?: string; auth?: string };
        Relationships: Rel[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      seed_default_categories: {
        Args: { p_household_id: string };
        Returns: undefined;
      };
      get_user_household_id: {
        Args: { uid: string };
        Returns: string;
      };
      create_household_for_user: {
        Args: { p_name: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
