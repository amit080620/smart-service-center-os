// Typed Supabase schema — hand-written to match the actual SQL migrations
// (supabase/migrations/*.sql), covering the tables built so far. This is
// what makes .from('employees').insert({...}) actually type-check against
// real column names instead of defaulting to `never`. Expand this file
// with each new module's tables as they're built — it's the single source
// of truth the Supabase client generic is parametrized with everywhere.
//
// Every table needs Row/Insert/Update/Relationships (Relationships can be
// an empty array if there are no foreign-key joins declared) — omitting
// any of these, even Relationships, causes postgrest-js's internal type
// matching to fail silently and every table falls back to `never`.
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          business_type: string;
          status: string;
          contact_email: string;
          contact_phone: string;
          address: string;
          logo_url: string | null;
          plan: string;
          trial_ends_at: string | null;
          max_branches: number;
          max_employees: number;
          settings: Record<string, unknown>;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          business_type: string;
          status: string;
          contact_email: string;
          contact_phone?: string;
          address?: string;
          logo_url?: string | null;
          plan: string;
          trial_ends_at?: string | null;
          max_branches: number;
          max_employees: number;
          settings: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
        Relationships: [];
      };
      branches: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          address: string;
          phone: string;
          manager_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          address: string;
          phone?: string;
          manager_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['branches']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'branches_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      employees: {
        Row: {
          id: string;
          org_id: string;
          branch_id: string;
          user_id: string;
          full_name: string;
          role: string;
          phone: string;
          email: string;
          hire_date: string;
          monthly_salary: number | null;
          hourly_rate: number | null;
          status: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          branch_id: string;
          user_id: string;
          full_name: string;
          role: string;
          phone?: string;
          email: string;
          hire_date: string;
          monthly_salary?: number | null;
          hourly_rate?: number | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['employees']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'employees_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employees_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          }
        ];
      };
      customers: {
        Row: {
          id: string;
          org_id: string;
          first_name: string;
          last_name: string;
          phone: string;
          email: string;
          address: string;
          whatsapp_opt_in: boolean;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          first_name: string;
          last_name?: string;
          phone: string;
          email?: string;
          address?: string;
          whatsapp_opt_in?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'customers_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      vehicles: {
        Row: {
          id: string;
          org_id: string;
          customer_id: string;
          plate_number: string;
          vin: string;
          make: string;
          model: string;
          year: number;
          color: string;
          odometer_km: number;
          last_service_odometer: number | null;
          next_service_date: string | null;
          next_service_odometer: number | null;
          notes: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          customer_id: string;
          plate_number: string;
          vin?: string;
          make: string;
          model: string;
          year?: number;
          color?: string;
          odometer_km?: number;
          last_service_odometer?: number | null;
          next_service_date?: string | null;
          next_service_odometer?: number | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['vehicles']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'vehicles_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          }
        ];
      };
      services: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          description: string;
          base_cost: number;
          est_duration_minutes: number;
          category: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          description?: string;
          base_cost: number;
          est_duration_minutes?: number;
          category?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'services_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      parts: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          sku: string;
          description: string;
          category: string;
          supplier: string;
          unit_cost: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          sku: string;
          description?: string;
          category?: string;
          supplier?: string;
          unit_cost: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['parts']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'parts_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}