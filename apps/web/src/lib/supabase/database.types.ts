export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accommodation_amenities: {
        Row: {
          accommodation_id: string
          amenity_id: string
        }
        Insert: {
          accommodation_id: string
          amenity_id: string
        }
        Update: {
          accommodation_id?: string
          amenity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_amenities_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodation_photos: {
        Row: {
          accommodation_id: string
          created_at: string
          id: string
          position: number
          storage_path: string
        }
        Insert: {
          accommodation_id: string
          created_at?: string
          id?: string
          position?: number
          storage_path: string
        }
        Update: {
          accommodation_id?: string
          created_at?: string
          id?: string
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_photos_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodations: {
        Row: {
          address: string | null
          area: string | null
          business_id: string
          cancellation_policy_id: string | null
          check_in_from: string | null
          check_out_by: string | null
          city: string | null
          created_at: string
          description: string | null
          featured: boolean
          fulfilment: Database["public"]["Enums"]["fulfilment_mode"]
          house_rules: string | null
          id: string
          is_demo: boolean
          latitude: number | null
          latitude_public: number | null
          location: unknown
          location_public: unknown
          longitude: number | null
          longitude_public: number | null
          name: string
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          slug: string
          source: Database["public"]["Enums"]["source_kind"]
          star_rating: number | null
          state_code: string | null
          status: Database["public"]["Enums"]["listing_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          business_id: string
          cancellation_policy_id?: string | null
          check_in_from?: string | null
          check_out_by?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          fulfilment?: Database["public"]["Enums"]["fulfilment_mode"]
          house_rules?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          latitude_public?: number | null
          location?: unknown
          location_public?: unknown
          longitude?: number | null
          longitude_public?: number | null
          name: string
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          slug: string
          source?: Database["public"]["Enums"]["source_kind"]
          star_rating?: number | null
          state_code?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          business_id?: string
          cancellation_policy_id?: string | null
          check_in_from?: string | null
          check_out_by?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          fulfilment?: Database["public"]["Enums"]["fulfilment_mode"]
          house_rules?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          latitude_public?: number | null
          location?: unknown
          location_public?: unknown
          longitude?: number | null
          longitude_public?: number | null
          name?: string
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          slug?: string
          source?: Database["public"]["Enums"]["source_kind"]
          star_rating?: number | null
          state_code?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodations_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodations_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      account_deletion_requests: {
        Row: {
          attempts: number
          cancelled_at: string | null
          completed_at: string | null
          counts: Json
          id: string
          last_error: string | null
          money_retain_until: string | null
          purge_after: string
          requested_at: string
          restore_code_hash: string | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          cancelled_at?: string | null
          completed_at?: string | null
          counts?: Json
          id?: string
          last_error?: string | null
          money_retain_until?: string | null
          purge_after: string
          requested_at?: string
          restore_code_hash?: string | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          cancelled_at?: string | null
          completed_at?: string | null
          counts?: Json
          id?: string
          last_error?: string | null
          money_retain_until?: string | null
          purge_after?: string
          requested_at?: string
          restore_code_hash?: string | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      account_identities: {
        Row: {
          canonical_rule: string
          email_canonical: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          canonical_rule: string
          email_canonical: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          canonical_rule?: string
          email_canonical?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      account_money_holds: {
        Row: {
          created_at: string
          hold_until: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hold_until: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          hold_until?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_bootstrap: {
        Row: {
          added_by: string | null
          claimed_at: string | null
          created_at: string
          email: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          added_by?: string | null
          claimed_at?: string | null
          created_at?: string
          email: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          added_by?: string | null
          claimed_at?: string | null
          created_at?: string
          email?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      admin_saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          owner: string
          shared: boolean
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          owner?: string
          shared?: boolean
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          owner?: string
          shared?: boolean
        }
        Relationships: []
      }
      agent_applications: {
        Row: {
          account_name: string | null
          account_number: string | null
          agency_fee_bps: number | null
          agree_terms: boolean
          applicant_response: string | null
          area: string | null
          association_proof: string | null
          bank_name: string | null
          business_address: string | null
          business_email: string | null
          business_established_on: string | null
          business_name: string | null
          business_phone: string | null
          business_rc: string | null
          business_tax_id: string | null
          city: string | null
          created_at: string
          email: string | null
          firm_team: Json
          full_name: string | null
          id: string
          id_number: string | null
          id_type: string | null
          kyc_retain_until: string | null
          lasrera_number: string | null
          legal_fee_bps: number | null
          ownership_document: string | null
          phone: string | null
          principal_email: string | null
          reference: string
          residential_address: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          state_code: string | null
          status: Database["public"]["Enums"]["agent_application_status"]
          submitted_at: string | null
          supply_role: string | null
          type: Database["public"]["Enums"]["agent_type"]
          updated_at: string
          user_id: string
          years_experience: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          agency_fee_bps?: number | null
          agree_terms?: boolean
          applicant_response?: string | null
          area?: string | null
          association_proof?: string | null
          bank_name?: string | null
          business_address?: string | null
          business_email?: string | null
          business_established_on?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_rc?: string | null
          business_tax_id?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          firm_team?: Json
          full_name?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          kyc_retain_until?: string | null
          lasrera_number?: string | null
          legal_fee_bps?: number | null
          ownership_document?: string | null
          phone?: string | null
          principal_email?: string | null
          reference?: string
          residential_address?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          state_code?: string | null
          status?: Database["public"]["Enums"]["agent_application_status"]
          submitted_at?: string | null
          supply_role?: string | null
          type?: Database["public"]["Enums"]["agent_type"]
          updated_at?: string
          user_id: string
          years_experience?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          agency_fee_bps?: number | null
          agree_terms?: boolean
          applicant_response?: string | null
          area?: string | null
          association_proof?: string | null
          bank_name?: string | null
          business_address?: string | null
          business_email?: string | null
          business_established_on?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_rc?: string | null
          business_tax_id?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          firm_team?: Json
          full_name?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          kyc_retain_until?: string | null
          lasrera_number?: string | null
          legal_fee_bps?: number | null
          ownership_document?: string | null
          phone?: string | null
          principal_email?: string | null
          reference?: string
          residential_address?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          state_code?: string | null
          status?: Database["public"]["Enums"]["agent_application_status"]
          submitted_at?: string | null
          supply_role?: string | null
          type?: Database["public"]["Enums"]["agent_type"]
          updated_at?: string
          user_id?: string
          years_experience?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_applications_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      agent_badges: {
        Row: {
          agent_id: string
          tier: Database["public"]["Enums"]["badge_tier"]
          updated_at: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          agent_id: string
          tier?: Database["public"]["Enums"]["badge_tier"]
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          agent_id?: string
          tier?: Database["public"]["Enums"]["badge_tier"]
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_badges_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_documents: {
        Row: {
          application_id: string | null
          back_storage_path: string | null
          issuing_country: string | null
          id: string
          issued_on: string | null
          kind: string
          listing_id: string | null
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["document_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          subtype: Database["public"]["Enums"]["document_subtype"] | null
          supersedes_id: string | null
          uploaded_at: string
          uploader_id: string | null
        }
        Insert: {
          application_id?: string | null
          back_storage_path?: string | null
          issuing_country?: string | null
          id?: string
          issued_on?: string | null
          kind: string
          listing_id?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["document_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          subtype?: Database["public"]["Enums"]["document_subtype"] | null
          supersedes_id?: string | null
          uploaded_at?: string
          uploader_id?: string | null
        }
        Update: {
          application_id?: string | null
          back_storage_path?: string | null
          issuing_country?: string | null
          id?: string
          issued_on?: string | null
          kind?: string
          listing_id?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["document_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          subtype?: Database["public"]["Enums"]["document_subtype"] | null
          supersedes_id?: string | null
          uploaded_at?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "agent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_documents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "agent_documents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "agent_documents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "agent_documents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "agent_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_suspensions: {
        Row: {
          agent_id: string
          fraud_note: string | null
          fraud_upheld_at: string | null
          fraud_upheld_by: string | null
          id: string
          lift_note: string | null
          lifted_at: string | null
          lifted_by: string | null
          reason: string
          restored: Json
          stays_ahead: number
          suspended_at: string
          suspended_by: string | null
          withdrawn: Json
        }
        Insert: {
          agent_id: string
          fraud_note?: string | null
          fraud_upheld_at?: string | null
          fraud_upheld_by?: string | null
          id?: string
          lift_note?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason: string
          restored?: Json
          stays_ahead?: number
          suspended_at?: string
          suspended_by?: string | null
          withdrawn?: Json
        }
        Update: {
          agent_id?: string
          fraud_note?: string | null
          fraud_upheld_at?: string | null
          fraud_upheld_by?: string | null
          id?: string
          lift_note?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string
          restored?: Json
          stays_ahead?: number
          suspended_at?: string
          suspended_by?: string | null
          withdrawn?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agent_suspensions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_verification_checks: {
        Row: {
          agent_id: string
          decided_at: string
          decided_by: string | null
          id: string
          kind: string
          note: string | null
          status: string
        }
        Insert: {
          agent_id: string
          decided_at?: string
          decided_by?: string | null
          id?: string
          kind: string
          note?: string | null
          status: string
        }
        Update: {
          agent_id?: string
          decided_at?: string
          decided_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_verification_checks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          application_id: string | null
          created_at: string
          display_name: string
          firm_id: string | null
          id: string
          is_demo: boolean
          lookup_opted_in_at: string | null
          lookup_phone_hint: string | null
          lookup_phone_hmac: string | null
          public_code: string | null
          record_code: string | null
          role: Database["public"]["Enums"]["supply_role"]
          status: Database["public"]["Enums"]["agent_application_status"]
          type: Database["public"]["Enums"]["agent_type"]
          updated_at: string
          user_id: string
          verification_tier: number
          verified: boolean
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          display_name: string
          firm_id?: string | null
          id?: string
          is_demo?: boolean
          lookup_opted_in_at?: string | null
          lookup_phone_hint?: string | null
          lookup_phone_hmac?: string | null
          public_code?: string | null
          record_code?: string | null
          role?: Database["public"]["Enums"]["supply_role"]
          status?: Database["public"]["Enums"]["agent_application_status"]
          type?: Database["public"]["Enums"]["agent_type"]
          updated_at?: string
          user_id: string
          verification_tier?: number
          verified?: boolean
        }
        Update: {
          application_id?: string | null
          created_at?: string
          display_name?: string
          firm_id?: string | null
          id?: string
          is_demo?: boolean
          lookup_opted_in_at?: string | null
          lookup_phone_hint?: string | null
          lookup_phone_hmac?: string | null
          public_code?: string | null
          record_code?: string | null
          role?: Database["public"]["Enums"]["supply_role"]
          status?: Database["public"]["Enums"]["agent_application_status"]
          type?: Database["public"]["Enums"]["agent_type"]
          updated_at?: string
          user_id?: string
          verification_tier?: number
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "agent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_risk_settings: {
        Row: {
          amount_threshold_minor: number
          check_amount: boolean
          check_first_deal: boolean
          check_fraud_radar: boolean
          check_payout_name: boolean
          check_recent_change: boolean
          id: number
          recent_change_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_threshold_minor?: number
          check_amount?: boolean
          check_first_deal?: boolean
          check_fraud_radar?: boolean
          check_payout_name?: boolean
          check_recent_change?: boolean
          id?: number
          recent_change_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_threshold_minor?: number
          check_amount?: boolean
          check_first_deal?: boolean
          check_fraud_radar?: boolean
          check_payout_name?: boolean
          check_recent_change?: boolean
          id?: number
          recent_change_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      amenities: {
        Row: {
          category: string
          code: string
          id: string
          label: string
        }
        Insert: {
          category?: string
          code: string
          id?: string
          label: string
        }
        Update: {
          category?: string
          code?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      aml_ledger_observations: {
        Row: {
          amount_minor: number
          counterparty_id: string | null
          direction: string
          id: string
          observed_at: string
          occurred_at: string
          party_class: string
          party_id: string
          party_role: string
          reference: string | null
          source: string
          source_id: string
        }
        Insert: {
          amount_minor: number
          counterparty_id?: string | null
          direction: string
          id?: string
          observed_at?: string
          occurred_at: string
          party_class: string
          party_id: string
          party_role: string
          reference?: string | null
          source: string
          source_id: string
        }
        Update: {
          amount_minor?: number
          counterparty_id?: string | null
          direction?: string
          id?: string
          observed_at?: string
          occurred_at?: string
          party_class?: string
          party_id?: string
          party_role?: string
          reference?: string | null
          source?: string
          source_id?: string
        }
        Relationships: []
      }
      area_members: {
        Row: {
          area_id: string
          joined_at: string
          notify_utility: boolean
          residency_source:
            | Database["public"]["Enums"]["area_residency_source"]
            | null
          residency_verified_at: string | null
          role: Database["public"]["Enums"]["area_role"]
          user_id: string
          utility_weight: number
        }
        Insert: {
          area_id: string
          joined_at?: string
          notify_utility?: boolean
          residency_source?:
            | Database["public"]["Enums"]["area_residency_source"]
            | null
          residency_verified_at?: string | null
          role?: Database["public"]["Enums"]["area_role"]
          user_id: string
          utility_weight?: number
        }
        Update: {
          area_id?: string
          joined_at?: string
          notify_utility?: boolean
          residency_source?:
            | Database["public"]["Enums"]["area_residency_source"]
            | null
          residency_verified_at?: string | null
          role?: Database["public"]["Enums"]["area_role"]
          user_id?: string
          utility_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "area_members_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      area_moderator_applications: {
        Row: {
          area_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          reason: string
          status: Database["public"]["Enums"]["moderator_application_status"]
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason: string
          status?: Database["public"]["Enums"]["moderator_application_status"]
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason?: string
          status?: Database["public"]["Enums"]["moderator_application_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_moderator_applications_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      area_pulses: {
        Row: {
          answer: string
          area_id: string
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          answer: string
          area_id: string
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          answer?: string
          area_id?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_pulses_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          area: string | null
          blurb: string | null
          centre_lat: number | null
          centre_lng: number | null
          city: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          kind: Database["public"]["Enums"]["area_kind"]
          lga_code: string | null
          member_count: number
          name: string
          opened_at: string | null
          post_count: number
          slow_mode: boolean
          slug: string
          state_code: string
          status: Database["public"]["Enums"]["area_status"]
          within_lga_code: string | null
        }
        Insert: {
          area?: string | null
          blurb?: string | null
          centre_lat?: number | null
          centre_lng?: number | null
          city: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["area_kind"]
          lga_code?: string | null
          member_count?: number
          name: string
          opened_at?: string | null
          post_count?: number
          slow_mode?: boolean
          slug: string
          state_code: string
          status?: Database["public"]["Enums"]["area_status"]
          within_lga_code?: string | null
        }
        Update: {
          area?: string | null
          blurb?: string | null
          centre_lat?: number | null
          centre_lng?: number | null
          city?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["area_kind"]
          lga_code?: string | null
          member_count?: number
          name?: string
          opened_at?: string | null
          post_count?: number
          slow_mode?: boolean
          slug?: string
          state_code?: string
          status?: Database["public"]["Enums"]["area_status"]
          within_lga_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_lga_code_fkey"
            columns: ["lga_code"]
            isOneToOne: false
            referencedRelation: "local_governments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "areas_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "areas_within_lga_code_fkey"
            columns: ["within_lga_code"]
            isOneToOne: false
            referencedRelation: "local_governments"
            referencedColumns: ["code"]
          },
        ]
      }
      arrival_charge_declarations: {
        Row: {
          accommodation_id: string | null
          charges: Json
          declared_at: string
          declared_by: string
          id: string
          listing_id: string | null
        }
        Insert: {
          accommodation_id?: string | null
          charges: Json
          declared_at?: string
          declared_by: string
          id?: string
          listing_id?: string | null
        }
        Update: {
          accommodation_id?: string | null
          charges?: Json
          declared_at?: string
          declared_by?: string
          id?: string
          listing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arrival_charge_declarations_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_charge_declarations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "arrival_charge_declarations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "arrival_charge_declarations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "arrival_charge_declarations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      arrival_charge_snapshots: {
        Row: {
          booking_id: string
          charges: Json | null
          declaration_id: string | null
          frozen_at: string
        }
        Insert: {
          booking_id: string
          charges?: Json | null
          declaration_id?: string | null
          frozen_at?: string
        }
        Update: {
          booking_id?: string
          charges?: Json | null
          declaration_id?: string | null
          frozen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arrival_charge_snapshots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_charge_snapshots_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: false
            referencedRelation: "arrival_charge_declarations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      availability: {
        Row: {
          date: string
          listing_id: string
          status: Database["public"]["Enums"]["availability_status"]
        }
        Insert: {
          date: string
          listing_id: string
          status?: Database["public"]["Enums"]["availability_status"]
        }
        Update: {
          date?: string
          listing_id?: string
          status?: Database["public"]["Enums"]["availability_status"]
        }
        Relationships: [
          {
            foreignKeyName: "availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_checks: {
        Row: {
          answer: Database["public"]["Enums"]["availability_answer"] | null
          answered_at: string | null
          asked_at: string
          asker_id: string
          available_from: string | null
          conversation_id: string
          id: string
          lister_id: string
          listing_id: string
        }
        Insert: {
          answer?: Database["public"]["Enums"]["availability_answer"] | null
          answered_at?: string | null
          asked_at?: string
          asker_id: string
          available_from?: string | null
          conversation_id: string
          id?: string
          lister_id: string
          listing_id: string
        }
        Update: {
          answer?: Database["public"]["Enums"]["availability_answer"] | null
          answered_at?: string | null
          asked_at?: string
          asker_id?: string
          available_from?: string | null
          conversation_id?: string
          id?: string
          lister_id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_checks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_checks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "availability_checks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "availability_checks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "availability_checks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          audience: Database["public"]["Enums"]["badge_audience"]
          code: string
          created_at: string
          description: string
          manual_only: boolean
          name: string
          object_name: string
          tier: number
        }
        Insert: {
          audience: Database["public"]["Enums"]["badge_audience"]
          code: string
          created_at?: string
          description: string
          manual_only?: boolean
          name: string
          object_name: string
          tier?: number
        }
        Update: {
          audience?: Database["public"]["Enums"]["badge_audience"]
          code?: string
          created_at?: string
          description?: string
          manual_only?: boolean
          name?: string
          object_name?: string
          tier?: number
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string
          bank_code: string
          bank_name: string
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          paystack_subaccount_code: string | null
          recipient_code: string | null
          resolved_account_name: string
          resolved_at: string
          subaccount_created_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          bank_code: string
          bank_name: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          paystack_subaccount_code?: string | null
          recipient_code?: string | null
          resolved_account_name: string
          resolved_at: string
          subaccount_created_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          paystack_subaccount_code?: string | null
          recipient_code?: string | null
          resolved_account_name?: string
          resolved_at?: string
          subaccount_created_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_terms: {
        Row: {
          action: string
          added_by: string | null
          category: string
          created_at: string
          reason: string
          refusal_reason: string | null
          retired_at: string | null
          retired_by: string | null
          retired_reason: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          term: string
        }
        Insert: {
          action?: string
          added_by?: string | null
          category: string
          created_at?: string
          reason: string
          refusal_reason?: string | null
          retired_at?: string | null
          retired_by?: string | null
          retired_reason?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          term: string
        }
        Update: {
          action?: string
          added_by?: string | null
          category?: string
          created_at?: string
          reason?: string
          refusal_reason?: string | null
          retired_at?: string | null
          retired_by?: string | null
          retired_reason?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          term?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          created_at: string
          other_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          other_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          other_id?: string
          user_id?: string
        }
        Relationships: []
      }
      booking_arrival_checks: {
        Row: {
          answer: string
          answered_at: string
          booking_id: string
          guest_id: string
          id: string
          note: string | null
          photo_paths: string[]
          ruled_at: string | null
          ruled_by: string | null
          ruling: string | null
          ticket_ref: string | null
        }
        Insert: {
          answer: string
          answered_at?: string
          booking_id: string
          guest_id: string
          id?: string
          note?: string | null
          photo_paths?: string[]
          ruled_at?: string | null
          ruled_by?: string | null
          ruling?: string | null
          ticket_ref?: string | null
        }
        Update: {
          answer?: string
          answered_at?: string
          booking_id?: string
          guest_id?: string
          id?: string
          note?: string | null
          photo_paths?: string[]
          ruled_at?: string | null
          ruled_by?: string | null
          ruling?: string | null
          ticket_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_arrival_checks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_cancellation_terms: {
        Row: {
          booking_id: string
          frozen_at: string
          source: string
          terms: Json
        }
        Insert: {
          booking_id: string
          frozen_at?: string
          source: string
          terms: Json
        }
        Update: {
          booking_id?: string
          frozen_at?: string
          source?: string
          terms?: Json
        }
        Relationships: [
          {
            foreignKeyName: "booking_cancellation_terms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_refund_parts: {
        Row: {
          amount_minor: number
          claim_key: string
          created_at: string
          id: string
          processor_refund_id: string | null
          processor_status: string
          provider_ref: string
          refund_id: string
          settled_at: string | null
          submitted_at: string | null
          transaction_id: string
        }
        Insert: {
          amount_minor: number
          claim_key: string
          created_at?: string
          id?: string
          processor_refund_id?: string | null
          processor_status?: string
          provider_ref: string
          refund_id: string
          settled_at?: string | null
          submitted_at?: string | null
          transaction_id: string
        }
        Update: {
          amount_minor?: number
          claim_key?: string
          created_at?: string
          id?: string
          processor_refund_id?: string | null
          processor_status?: string
          provider_ref?: string
          refund_id?: string
          settled_at?: string | null
          submitted_at?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_refund_parts_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "booking_refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_refund_parts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_refunds: {
        Row: {
          booking_id: string
          created_at: string
          decided_by: string | null
          guest_id: string
          id: string
          note: string | null
          paid_minor: number
          processor_refund_id: string | null
          processor_settled_at: string | null
          processor_status: string
          processor_submitted_at: string | null
          reason: string
          refund_minor: number
          retained_minor: number
          wallet_entry_id: string | null
          wallet_reference: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          decided_by?: string | null
          guest_id: string
          id?: string
          note?: string | null
          paid_minor: number
          processor_refund_id?: string | null
          processor_settled_at?: string | null
          processor_status?: string
          processor_submitted_at?: string | null
          reason: string
          refund_minor: number
          retained_minor: number
          wallet_entry_id?: string | null
          wallet_reference?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          decided_by?: string | null
          guest_id?: string
          id?: string
          note?: string | null
          paid_minor?: number
          processor_refund_id?: string | null
          processor_settled_at?: string | null
          processor_status?: string
          processor_submitted_at?: string | null
          reason?: string
          refund_minor?: number
          retained_minor?: number
          wallet_entry_id?: string | null
          wallet_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_state_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_state_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accommodation_id: string | null
          adults: number
          check_in: string
          check_out: string
          children: number
          cleaning_fee_minor: number
          created_at: string
          currency: string
          during: unknown
          guest_email: string | null
          guest_id: string
          guest_name: string | null
          guest_phone: string | null
          id: string
          listing_id: string | null
          nights: number
          price_per_night_minor: number
          rate_plan_id: string | null
          room_type_id: string | null
          rooms: number
          service_fee_minor: number
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_minor: number
          total_minor: number
          updated_at: string
        }
        Insert: {
          accommodation_id?: string | null
          adults?: number
          check_in: string
          check_out: string
          children?: number
          cleaning_fee_minor?: number
          created_at?: string
          currency?: string
          during?: unknown
          guest_email?: string | null
          guest_id: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          listing_id?: string | null
          nights: number
          price_per_night_minor: number
          rate_plan_id?: string | null
          room_type_id?: string | null
          rooms?: number
          service_fee_minor?: number
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_minor: number
          total_minor: number
          updated_at?: string
        }
        Update: {
          accommodation_id?: string | null
          adults?: number
          check_in?: string
          check_out?: string
          children?: number
          cleaning_fee_minor?: number
          created_at?: string
          currency?: string
          during?: unknown
          guest_email?: string | null
          guest_id?: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          listing_id?: string | null
          nights?: number
          price_per_night_minor?: number
          rate_plan_id?: string | null
          room_type_id?: string | null
          rooms?: number
          service_fee_minor?: number
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_minor?: number
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_invocations: {
        Row: {
          answer: string | null
          area_id: string | null
          cost_minor: number
          created_at: string
          id: string
          input_tokens: number
          output_tokens: number
          post_id: string | null
          prompt: string
          refused_reason: string | null
          reply_post_id: string | null
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          area_id?: string | null
          cost_minor?: number
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          post_id?: string | null
          prompt: string
          refused_reason?: string | null
          reply_post_id?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          area_id?: string | null
          cost_minor?: number
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          post_id?: string | null
          prompt?: string
          refused_reason?: string | null
          reply_post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_invocations_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_invocations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_invocations_reply_post_id_fkey"
            columns: ["reply_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings: {
        Row: {
          daily_ceiling_minor: number
          enabled: boolean
          id: boolean
          model: string
          monthly_ceiling_minor: number
          per_person_daily: number
          updated_at: string
        }
        Insert: {
          daily_ceiling_minor?: number
          enabled?: boolean
          id?: boolean
          model?: string
          monthly_ceiling_minor?: number
          per_person_daily?: number
          updated_at?: string
        }
        Update: {
          daily_ceiling_minor?: number
          enabled?: boolean
          id?: boolean
          model?: string
          monthly_ceiling_minor?: number
          per_person_daily?: number
          updated_at?: string
        }
        Relationships: []
      }
      brief_answers: {
        Row: {
          brief_id: string
          conversation_id: string | null
          created_at: string
          lister_id: string
          listing_id: string
        }
        Insert: {
          brief_id: string
          conversation_id?: string | null
          created_at?: string
          lister_id: string
          listing_id: string
        }
        Update: {
          brief_id?: string
          conversation_id?: string | null
          created_at?: string
          lister_id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brief_answers_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_answers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_answers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "brief_answers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "brief_answers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "brief_answers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs: {
        Row: {
          areas: string[]
          bedrooms_min: number | null
          closed_at: string | null
          created_at: string
          expires_at: string
          id: string
          intent: string
          max_minor: number | null
          move_from: string | null
          property_type: string | null
          saved_search_id: string | null
          state_code: string
          user_id: string
        }
        Insert: {
          areas: string[]
          bedrooms_min?: number | null
          closed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          intent: string
          max_minor?: number | null
          move_from?: string | null
          property_type?: string | null
          saved_search_id?: string | null
          state_code: string
          user_id: string
        }
        Update: {
          areas?: string[]
          bedrooms_min?: number | null
          closed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          intent?: string
          max_minor?: number | null
          move_from?: string | null
          property_type?: string | null
          saved_search_id?: string | null
          state_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefs_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      business_documents: {
        Row: {
          business_id: string
          id: string
          kind: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          business_id: string
          id?: string
          kind: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          business_id?: string
          id?: string
          kind?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_photos: {
        Row: {
          business_id: string
          created_at: string
          id: string
          position: number
          storage_path: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          position?: number
          storage_path: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_transfers: {
        Row: {
          business_id: string
          expires_at: string
          from_user_id: string
          id: string
          note: string | null
          offered_at: string
          responded_at: string | null
          status: string
          to_user_id: string
        }
        Insert: {
          business_id: string
          expires_at: string
          from_user_id: string
          id?: string
          note?: string | null
          offered_at?: string
          responded_at?: string | null
          status?: string
          to_user_id: string
        }
        Update: {
          business_id?: string
          expires_at?: string
          from_user_id?: string
          id?: string
          note?: string | null
          offered_at?: string
          responded_at?: string | null
          status?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_transfers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_verification_checks: {
        Row: {
          business_id: string
          decided_at: string
          id: string
          note: string | null
          reviewer_id: string | null
          rung: string
          status: string
        }
        Insert: {
          business_id: string
          decided_at?: string
          id?: string
          note?: string | null
          reviewer_id?: string | null
          rung: string
          status: string
        }
        Update: {
          business_id?: string
          decided_at?: string
          id?: string
          note?: string | null
          reviewer_id?: string | null
          rung?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_verification_checks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          agent_id: string | null
          area: string | null
          cac_number: string | null
          city: string | null
          consents: Json
          created_at: string
          description: string | null
          email: string | null
          host_type: string | null
          hygiene_attested_at: string | null
          id: string
          is_demo: boolean
          kind: Database["public"]["Enums"]["business_kind"]
          latitude: number | null
          latitude_public: number | null
          licence_attested_at: string | null
          location: unknown
          location_public: unknown
          longitude: number | null
          longitude_public: number | null
          name: string
          owner_id: string | null
          phone: string | null
          published_at: string | null
          registered_name: string | null
          representative_name: string | null
          representative_phone: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          slug: string
          source: Database["public"]["Enums"]["source_kind"]
          state_code: string | null
          status: Database["public"]["Enums"]["listing_status"]
          submitted_at: string | null
          tin: string | null
          updated_at: string
          verification_tier: number
          verified: boolean
        }
        Insert: {
          address?: string | null
          agent_id?: string | null
          area?: string | null
          cac_number?: string | null
          city?: string | null
          consents?: Json
          created_at?: string
          description?: string | null
          email?: string | null
          host_type?: string | null
          hygiene_attested_at?: string | null
          id?: string
          is_demo?: boolean
          kind: Database["public"]["Enums"]["business_kind"]
          latitude?: number | null
          latitude_public?: number | null
          licence_attested_at?: string | null
          location?: unknown
          location_public?: unknown
          longitude?: number | null
          longitude_public?: number | null
          name: string
          owner_id?: string | null
          phone?: string | null
          published_at?: string | null
          registered_name?: string | null
          representative_name?: string | null
          representative_phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          slug: string
          source?: Database["public"]["Enums"]["source_kind"]
          state_code?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          tin?: string | null
          updated_at?: string
          verification_tier?: number
          verified?: boolean
        }
        Update: {
          address?: string | null
          agent_id?: string | null
          area?: string | null
          cac_number?: string | null
          city?: string | null
          consents?: Json
          created_at?: string
          description?: string | null
          email?: string | null
          host_type?: string | null
          hygiene_attested_at?: string | null
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["business_kind"]
          latitude?: number | null
          latitude_public?: number | null
          licence_attested_at?: string | null
          location?: unknown
          location_public?: unknown
          longitude?: number | null
          longitude_public?: number | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          published_at?: string | null
          registered_name?: string | null
          representative_name?: string | null
          representative_phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          slug?: string
          source?: Database["public"]["Enums"]["source_kind"]
          state_code?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          tin?: string | null
          updated_at?: string
          verification_tier?: number
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "businesses_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      calendar_feeds: {
        Row: {
          created_at: string
          id: string
          last_read_at: string | null
          listing_id: string | null
          owner_id: string
          room_type_id: string | null
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_read_at?: string | null
          listing_id?: string | null
          owner_id?: string
          room_type_id?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_read_at?: string | null
          listing_id?: string | null
          owner_id?: string
          room_type_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feeds_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "calendar_feeds_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "calendar_feeds_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "calendar_feeds_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_feeds_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_import_nights: {
        Row: {
          conflict_told: boolean
          date: string
          import_id: string
          plans_closed: boolean
          was_closed: boolean
        }
        Insert: {
          conflict_told?: boolean
          date: string
          import_id: string
          plans_closed?: boolean
          was_closed?: boolean
        }
        Update: {
          conflict_told?: boolean
          date?: string
          import_id?: string
          plans_closed?: boolean
          was_closed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calendar_import_nights_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "calendar_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_imports: {
        Row: {
          conflicts: number
          created_at: string
          enabled: boolean
          failures: number
          id: string
          last_attempt_at: string | null
          last_error: string | null
          last_synced_at: string | null
          listing_id: string | null
          nights_blocked: number
          owner_id: string
          room_type_id: string | null
          source: string
          url: string
        }
        Insert: {
          conflicts?: number
          created_at?: string
          enabled?: boolean
          failures?: number
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          listing_id?: string | null
          nights_blocked?: number
          owner_id?: string
          room_type_id?: string | null
          source: string
          url: string
        }
        Update: {
          conflicts?: number
          created_at?: string
          enabled?: boolean
          failures?: number
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          listing_id?: string | null
          nights_blocked?: number
          owner_id?: string
          room_type_id?: string | null
          source?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_imports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "calendar_imports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "calendar_imports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "calendar_imports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_imports_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      call_events: {
        Row: {
          actor_id: string | null
          call_id: string
          created_at: string
          detail: Json
          event: string
          from_state: string | null
          id: number
          source: string
          to_state: string | null
        }
        Insert: {
          actor_id?: string | null
          call_id: string
          created_at?: string
          detail?: Json
          event: string
          from_state?: string | null
          id?: never
          source: string
          to_state?: string | null
        }
        Update: {
          actor_id?: string | null
          call_id?: string
          created_at?: string
          detail?: Json
          event?: string
          from_state?: string | null
          id?: never
          source?: string
          to_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          connected_seconds: number
          first_joined_at: string | null
          id: string
          invited_at: string
          join_count: number
          joined_at: string | null
          last_seen_at: string | null
          last_token_at: string | null
          left_at: string | null
          provider_identity: string | null
          responded_at: string | null
          role: string
          state: string
          token_count: number
          user_id: string
        }
        Insert: {
          call_id: string
          connected_seconds?: number
          first_joined_at?: string | null
          id?: string
          invited_at?: string
          join_count?: number
          joined_at?: string | null
          last_seen_at?: string | null
          last_token_at?: string | null
          left_at?: string | null
          provider_identity?: string | null
          responded_at?: string | null
          role: string
          state?: string
          token_count?: number
          user_id: string
        }
        Update: {
          call_id?: string
          connected_seconds?: number
          first_joined_at?: string | null
          id?: string
          invited_at?: string
          join_count?: number
          joined_at?: string | null
          last_seen_at?: string | null
          last_token_at?: string | null
          left_at?: string | null
          provider_identity?: string | null
          responded_at?: string | null
          role?: string
          state?: string
          token_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_provider_events: {
        Row: {
          call_id: string | null
          event: string
          event_id: string
          outcome: string
          provider: string
          provider_created_at: string | null
          received_at: string
          room: string | null
        }
        Insert: {
          call_id?: string | null
          event: string
          event_id: string
          outcome?: string
          provider: string
          provider_created_at?: string | null
          received_at?: string
          room?: string | null
        }
        Update: {
          call_id?: string | null
          event?: string
          event_id?: string
          outcome?: string
          provider?: string
          provider_created_at?: string | null
          received_at?: string
          room?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_provider_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_review_entries: {
        Row: {
          author_id: string | null
          body: string
          corrects_id: string | null
          created_at: string
          evidence_ref: string | null
          id: string
          kind: string
          outcome: string | null
          review_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          corrects_id?: string | null
          created_at?: string
          evidence_ref?: string | null
          id?: string
          kind: string
          outcome?: string | null
          review_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          corrects_id?: string | null
          created_at?: string
          evidence_ref?: string | null
          id?: string
          kind?: string
          outcome?: string | null
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_review_entries_corrects_id_fkey"
            columns: ["corrects_id"]
            isOneToOne: false
            referencedRelation: "call_review_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_review_entries_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "call_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      call_reviews: {
        Row: {
          case_id: string
          case_kind: string
          created_at: string
          follow_up_due_at: string | null
          id: string
          kind: string
          outcome: string | null
          outcome_at: string | null
          outcome_by: string | null
          proposed_for: string | null
          purpose: string
          requested_by: string | null
          required_scope: string
          respond_by: string
          scheduled_for: string | null
          status: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          case_id: string
          case_kind: string
          created_at?: string
          follow_up_due_at?: string | null
          id?: string
          kind?: string
          outcome?: string | null
          outcome_at?: string | null
          outcome_by?: string | null
          proposed_for?: string | null
          purpose: string
          requested_by?: string | null
          required_scope: string
          respond_by?: string
          scheduled_for?: string | null
          status?: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          case_kind?: string
          created_at?: string
          follow_up_due_at?: string | null
          id?: string
          kind?: string
          outcome?: string | null
          outcome_at?: string | null
          outcome_by?: string | null
          proposed_for?: string | null
          purpose?: string
          requested_by?: string | null
          required_scope?: string
          respond_by?: string
          scheduled_for?: string | null
          status?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          accepted_at: string | null
          business_id: string | null
          client_key: string | null
          connected_at: string | null
          connecting_at: string | null
          conversation_id: string | null
          created_at: string
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          id: string
          initiator_id: string | null
          interrupted_at: string | null
          invitation_expires_at: string | null
          kind: string
          last_activity_at: string
          listing_id: string | null
          max_duration_seconds: number
          participant_seconds: number | null
          presence_checked_at: string | null
          provider: string
          provider_closed_at: string | null
          provider_room: string
          purpose: string
          reconciled_participant_seconds: number | null
          reconnect_count: number
          review_id: string | null
          ring_expires_at: string | null
          ringing_at: string | null
          scheduled_for: string | null
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          business_id?: string | null
          client_key?: string | null
          connected_at?: string | null
          connecting_at?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          initiator_id?: string | null
          interrupted_at?: string | null
          invitation_expires_at?: string | null
          kind: string
          last_activity_at?: string
          listing_id?: string | null
          max_duration_seconds?: number
          participant_seconds?: number | null
          presence_checked_at?: string | null
          provider?: string
          provider_closed_at?: string | null
          provider_room?: string
          purpose?: string
          reconciled_participant_seconds?: number | null
          reconnect_count?: number
          review_id?: string | null
          ring_expires_at?: string | null
          ringing_at?: string | null
          scheduled_for?: string | null
          state?: string
          updated_at?: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          business_id?: string | null
          client_key?: string | null
          connected_at?: string | null
          connecting_at?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          initiator_id?: string | null
          interrupted_at?: string | null
          invitation_expires_at?: string | null
          kind?: string
          last_activity_at?: string
          listing_id?: string | null
          max_duration_seconds?: number
          participant_seconds?: number | null
          presence_checked_at?: string | null
          provider?: string
          provider_closed_at?: string | null
          provider_room?: string
          purpose?: string
          reconciled_participant_seconds?: number | null
          reconnect_count?: number
          review_id?: string | null
          ring_expires_at?: string | null
          ringing_at?: string | null
          scheduled_for?: string | null
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calls_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "calls_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "calls_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "calls_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "call_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_policies: {
        Row: {
          created_at: string
          id: string
          is_free_until_hours: number | null
          name: string
          refund_to: string
          rules: Json
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_free_until_hours?: number | null
          name: string
          refund_to?: string
          rules?: Json
          summary: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_free_until_hours?: number | null
          name?: string
          refund_to?: string
          rules?: Json
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_entries: {
        Row: {
          amenity_codes: string[]
          area: string | null
          city: string | null
          cover_path: string | null
          entity_id: string
          entity_kind: Database["public"]["Enums"]["catalogue_entity_kind"]
          featured: boolean
          has_breakfast: boolean
          has_free_cancellation: boolean
          headline_price_minor: number | null
          headline_price_period: string | null
          id: string
          is_demo: boolean
          kind: string
          latitude: number | null
          latitude_public: number | null
          location: unknown
          location_public: unknown
          longitude: number | null
          longitude_public: number | null
          max_sleeps: number | null
          price_band: number | null
          published_at: string | null
          rating_avg: number | null
          rating_count: number
          room_categories: Database["public"]["Enums"]["room_category"][]
          search: unknown
          source: Database["public"]["Enums"]["source_kind"]
          state_code: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          amenity_codes?: string[]
          area?: string | null
          city?: string | null
          cover_path?: string | null
          entity_id: string
          entity_kind: Database["public"]["Enums"]["catalogue_entity_kind"]
          featured?: boolean
          has_breakfast?: boolean
          has_free_cancellation?: boolean
          headline_price_minor?: number | null
          headline_price_period?: string | null
          id?: string
          is_demo?: boolean
          kind: string
          latitude?: number | null
          latitude_public?: number | null
          location?: unknown
          location_public?: unknown
          longitude?: number | null
          longitude_public?: number | null
          max_sleeps?: number | null
          price_band?: number | null
          published_at?: string | null
          rating_avg?: number | null
          rating_count?: number
          room_categories?: Database["public"]["Enums"]["room_category"][]
          search?: unknown
          source: Database["public"]["Enums"]["source_kind"]
          state_code?: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          amenity_codes?: string[]
          area?: string | null
          city?: string | null
          cover_path?: string | null
          entity_id?: string
          entity_kind?: Database["public"]["Enums"]["catalogue_entity_kind"]
          featured?: boolean
          has_breakfast?: boolean
          has_free_cancellation?: boolean
          headline_price_minor?: number | null
          headline_price_period?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          latitude?: number | null
          latitude_public?: number | null
          location?: unknown
          location_public?: unknown
          longitude?: number | null
          longitude_public?: number | null
          max_sleeps?: number | null
          price_band?: number | null
          published_at?: string | null
          rating_avg?: number | null
          rating_count?: number
          room_categories?: Database["public"]["Enums"]["room_category"][]
          search?: unknown
          source?: Database["public"]["Enums"]["source_kind"]
          state_code?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      caution_deduction_answers: {
        Row: {
          answer: string
          answered_at: string
          answered_by: string
          deduction_id: string
        }
        Insert: {
          answer: string
          answered_at?: string
          answered_by: string
          deduction_id: string
        }
        Update: {
          answer?: string
          answered_at?: string
          answered_by?: string
          deduction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caution_deduction_answers_deduction_id_fkey"
            columns: ["deduction_id"]
            isOneToOne: true
            referencedRelation: "caution_deductions"
            referencedColumns: ["id"]
          },
        ]
      }
      caution_deductions: {
        Row: {
          amount_minor: number
          created_at: string
          id: string
          item: string
          note: string | null
          obligation_id: string
          photo_id: string
          proposed_by: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          id?: string
          item: string
          note?: string | null
          obligation_id: string
          photo_id: string
          proposed_by: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          id?: string
          item?: string
          note?: string | null
          obligation_id?: string
          photo_id?: string
          proposed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "caution_deductions_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "caution_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caution_deductions_photo_fk"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "tenancy_report_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      caution_dispute_rulings: {
        Row: {
          allowed_minor: number
          decided_at: string
          decided_by: string
          deduction_id: string
          reason: string
        }
        Insert: {
          allowed_minor: number
          decided_at?: string
          decided_by: string
          deduction_id: string
          reason: string
        }
        Update: {
          allowed_minor?: number
          decided_at?: string
          decided_by?: string
          deduction_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "caution_dispute_rulings_deduction_id_fkey"
            columns: ["deduction_id"]
            isOneToOne: true
            referencedRelation: "caution_deductions"
            referencedColumns: ["id"]
          },
        ]
      }
      caution_obligations: {
        Row: {
          amount_minor: number
          due_on: string
          id: string
          lister_id: string
          opened_at: string
          rent_payment_id: string
          tenancy_end: string
          tenant_id: string
        }
        Insert: {
          amount_minor: number
          due_on: string
          id?: string
          lister_id: string
          opened_at?: string
          rent_payment_id: string
          tenancy_end: string
          tenant_id: string
        }
        Update: {
          amount_minor?: number
          due_on?: string
          id?: string
          lister_id?: string
          opened_at?: string
          rent_payment_id?: string
          tenancy_end?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caution_obligations_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: true
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      caution_return_contests: {
        Row: {
          contested_at: string
          contested_by: string
          note: string
          return_id: string
        }
        Insert: {
          contested_at?: string
          contested_by: string
          note: string
          return_id: string
        }
        Update: {
          contested_at?: string
          contested_by?: string
          note?: string
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caution_return_contests_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: true
            referencedRelation: "caution_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      caution_return_rulings: {
        Row: {
          decided_at: string
          decided_by: string
          outcome: string
          reason: string
          return_id: string
        }
        Insert: {
          decided_at?: string
          decided_by: string
          outcome: string
          reason: string
          return_id: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          outcome?: string
          reason?: string
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caution_return_rulings_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: true
            referencedRelation: "caution_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      caution_returns: {
        Row: {
          amount_minor: number
          id: string
          idempotency_key: string
          method: string
          obligation_id: string
          recorded_as: string
          recorded_at: string
          recorded_by: string
          reference: string | null
          returned_on: string
        }
        Insert: {
          amount_minor: number
          id?: string
          idempotency_key: string
          method: string
          obligation_id: string
          recorded_as: string
          recorded_at?: string
          recorded_by: string
          reference?: string | null
          returned_on: string
        }
        Update: {
          amount_minor?: number
          id?: string
          idempotency_key?: string
          method?: string
          obligation_id?: string
          recorded_as?: string
          recorded_at?: string
          recorded_by?: string
          reference?: string | null
          returned_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "caution_returns_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "caution_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      chargeback_events: {
        Row: {
          actor_id: string | null
          chargeback_id: string
          created_at: string
          evidence_due_at: string | null
          from_state: string | null
          id: string
          kind: string
          note: string | null
          raw: Json | null
          recovered_minor: number | null
          recovery: string | null
          to_state: string
        }
        Insert: {
          actor_id?: string | null
          chargeback_id: string
          created_at?: string
          evidence_due_at?: string | null
          from_state?: string | null
          id?: string
          kind?: string
          note?: string | null
          raw?: Json | null
          recovered_minor?: number | null
          recovery?: string | null
          to_state: string
        }
        Update: {
          actor_id?: string | null
          chargeback_id?: string
          created_at?: string
          evidence_due_at?: string | null
          from_state?: string | null
          id?: string
          kind?: string
          note?: string | null
          raw?: Json | null
          recovered_minor?: number | null
          recovery?: string | null
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "chargeback_events_chargeback_id_fkey"
            columns: ["chargeback_id"]
            isOneToOne: false
            referencedRelation: "chargebacks"
            referencedColumns: ["id"]
          },
        ]
      }
      chargebacks: {
        Row: {
          amount_minor: number
          closed_at: string | null
          currency: string
          evidence_due_at: string | null
          id: string
          lister_unattributed: boolean
          lister_user_id: string | null
          opened_at: string
          provider: string
          provider_dispute_id: string
          provider_status: string | null
          recovered_minor: number
          recovery_closed_at: string | null
          recovery_state: string
          state: string
          transaction_id: string
        }
        Insert: {
          amount_minor: number
          closed_at?: string | null
          currency: string
          evidence_due_at?: string | null
          id?: string
          lister_unattributed?: boolean
          lister_user_id?: string | null
          opened_at?: string
          provider: string
          provider_dispute_id: string
          provider_status?: string | null
          recovered_minor?: number
          recovery_closed_at?: string | null
          recovery_state?: string
          state?: string
          transaction_id: string
        }
        Update: {
          amount_minor?: number
          closed_at?: string | null
          currency?: string
          evidence_due_at?: string | null
          id?: string
          lister_unattributed?: boolean
          lister_user_id?: string | null
          opened_at?: string
          provider?: string
          provider_dispute_id?: string
          provider_status?: string | null
          recovered_minor?: number
          recovery_closed_at?: string | null
          recovery_state?: string
          state?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chargebacks_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      commute_bands: {
        Row: {
          anchor_id: string
          created_at: string
          high_min: number
          id: string
          low_min: number
          origin_area: string
          peak: string
          route_label: string | null
          source: Database["public"]["Enums"]["source_kind"]
          state_code: string
        }
        Insert: {
          anchor_id: string
          created_at?: string
          high_min: number
          id?: string
          low_min: number
          origin_area: string
          peak: string
          route_label?: string | null
          source?: Database["public"]["Enums"]["source_kind"]
          state_code: string
        }
        Update: {
          anchor_id?: string
          created_at?: string
          high_min?: number
          id?: string
          low_min?: number
          origin_area?: string
          peak?: string
          route_label?: string | null
          source?: Database["public"]["Enums"]["source_kind"]
          state_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "commute_bands_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "landmarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commute_bands_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      commute_reports: {
        Row: {
          anchor_id: string
          area_id: string
          created_at: string
          day: string
          id: string
          minutes: number
          peak: string
          user_id: string
        }
        Insert: {
          anchor_id: string
          area_id: string
          created_at?: string
          day?: string
          id?: string
          minutes: number
          peak: string
          user_id: string
        }
        Update: {
          anchor_id?: string
          area_id?: string
          created_at?: string
          day?: string
          id?: string
          minutes?: number
          peak?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commute_reports_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "landmarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commute_reports_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmed_phones: {
        Row: {
          confirmed_at: string
          phone: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          phone: string
          user_id: string
        }
        Update: {
          confirmed_at?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      console_key_revocations: {
        Row: {
          credential_id: string
          reason: string
          revoked_at: string
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          credential_id: string
          reason: string
          revoked_at?: string
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          credential_id?: string
          reason?: string
          revoked_at?: string
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "console_key_revocations_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: true
            referencedRelation: "money_credentials"
            referencedColumns: ["credential_id"]
          },
        ]
      }
      console_step_ups: {
        Row: {
          credential_id: string | null
          expires_at: string
          session_id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          credential_id?: string | null
          expires_at: string
          session_id: string
          user_id: string
          verified_at?: string
        }
        Update: {
          credential_id?: string | null
          expires_at?: string
          session_id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      conversation_archives: {
        Row: {
          archived_at: string
          conversation_id: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          conversation_id: string
          user_id: string
        }
        Update: {
          archived_at?: string
          conversation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_archives_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_id: string
          booking_id: string | null
          business_id: string | null
          context_kind: Database["public"]["Enums"]["thread_context"]
          created_at: string
          guest_id: string
          id: string
          last_message_at: string
          listing_id: string | null
          reservation_id: string | null
          routed_agent_id: string | null
          routed_at: string | null
          routed_reason: string | null
          share_token: string | null
        }
        Insert: {
          agent_id: string
          booking_id?: string | null
          business_id?: string | null
          context_kind?: Database["public"]["Enums"]["thread_context"]
          created_at?: string
          guest_id: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          reservation_id?: string | null
          routed_agent_id?: string | null
          routed_at?: string | null
          routed_reason?: string | null
          share_token?: string | null
        }
        Update: {
          agent_id?: string
          booking_id?: string | null
          business_id?: string | null
          context_kind?: Database["public"]["Enums"]["thread_context"]
          created_at?: string
          guest_id?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          reservation_id?: string | null
          routed_agent_id?: string | null
          routed_at?: string | null
          routed_reason?: string | null
          share_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_routed_agent_id_fkey"
            columns: ["routed_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_share_token_fkey"
            columns: ["share_token"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["token"]
          },
        ]
      }
      credentials: {
        Row: {
          checked_at: string
          checked_by: string
          company_name: string | null
          id: string
          kind: string
          number: string
          register_name: string | null
          source: string
          subject_id: string
        }
        Insert: {
          checked_at?: string
          checked_by: string
          company_name?: string | null
          id?: string
          kind: string
          number: string
          register_name?: string | null
          source: string
          subject_id: string
        }
        Update: {
          checked_at?: string
          checked_by?: string
          company_name?: string | null
          id?: string
          kind?: string
          number?: string
          register_name?: string | null
          source?: string
          subject_id?: string
        }
        Relationships: []
      }
      crypto_aml_records: {
        Row: {
          agreement_id: string | null
          amount_minor: number
          asset: string
          asset_decimals: number
          booking_id: string
          charge_outcome: string | null
          crypto_amount: number
          crypto_payment_id: string
          crypto_received: number | null
          currency: string
          deposit_address: string | null
          id: string
          network: string
          payee_user_id: string | null
          payer_id: string
          payer_kyc_method: string | null
          payer_kyc_verification_id: string | null
          payer_legal_name: string | null
          provider: string
          provider_reference: string | null
          rate_ngn: number
          recorded_at: string
          reference: string
          refund_address: string | null
          settled_at: string
          tx_hash: string | null
        }
        Insert: {
          agreement_id?: string | null
          amount_minor: number
          asset: string
          asset_decimals: number
          booking_id: string
          charge_outcome?: string | null
          crypto_amount: number
          crypto_payment_id: string
          crypto_received?: number | null
          currency?: string
          deposit_address?: string | null
          id?: string
          network: string
          payee_user_id?: string | null
          payer_id: string
          payer_kyc_method?: string | null
          payer_kyc_verification_id?: string | null
          payer_legal_name?: string | null
          provider: string
          provider_reference?: string | null
          rate_ngn: number
          recorded_at?: string
          reference: string
          refund_address?: string | null
          settled_at: string
          tx_hash?: string | null
        }
        Update: {
          agreement_id?: string | null
          amount_minor?: number
          asset?: string
          asset_decimals?: number
          booking_id?: string
          charge_outcome?: string | null
          crypto_amount?: number
          crypto_payment_id?: string
          crypto_received?: number | null
          currency?: string
          deposit_address?: string | null
          id?: string
          network?: string
          payee_user_id?: string | null
          payer_id?: string
          payer_kyc_method?: string | null
          payer_kyc_verification_id?: string | null
          payer_legal_name?: string | null
          provider?: string
          provider_reference?: string | null
          rate_ngn?: number
          recorded_at?: string
          reference?: string
          refund_address?: string | null
          settled_at?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      crypto_payment_events: {
        Row: {
          applied: boolean
          crypto_payment_id: string
          facts: Json
          from_state: string
          id: string
          outcome: string
          provider: string
          provider_event_id: string
          received_at: string
          source: string
          to_state: string
        }
        Insert: {
          applied: boolean
          crypto_payment_id: string
          facts?: Json
          from_state: string
          id?: string
          outcome: string
          provider: string
          provider_event_id: string
          received_at?: string
          source: string
          to_state: string
        }
        Update: {
          applied?: boolean
          crypto_payment_id?: string
          facts?: Json
          from_state?: string
          id?: string
          outcome?: string
          provider?: string
          provider_event_id?: string
          received_at?: string
          source?: string
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_payment_events_crypto_payment_id_fkey"
            columns: ["crypto_payment_id"]
            isOneToOne: false
            referencedRelation: "crypto_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_payments: {
        Row: {
          agreement_id: string | null
          amount_minor: number
          asset: string
          asset_decimals: number
          booking_id: string
          charge_outcome: string | null
          confirmations: number | null
          confirmations_required: number | null
          created_at: string
          crypto_amount: number
          crypto_overpaid: number | null
          crypto_received: number | null
          crypto_refunded: number | null
          currency: string
          deposit_address: string | null
          deposit_memo: string | null
          failure_reason: string | null
          fee_minor: number
          hosted_url: string | null
          id: string
          last_event_at: string | null
          network: string
          payer_id: string
          provider: string
          provider_payment_id: string | null
          provider_quote_id: string | null
          quote_expires_at: string
          rate_ngn: number
          reference: string
          refund_address: string | null
          refund_tx_hash: string | null
          settled_at: string | null
          settled_minor: number | null
          state: string
          transaction_id: string | null
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          agreement_id?: string | null
          amount_minor: number
          asset: string
          asset_decimals: number
          booking_id: string
          charge_outcome?: string | null
          confirmations?: number | null
          confirmations_required?: number | null
          created_at?: string
          crypto_amount: number
          crypto_overpaid?: number | null
          crypto_received?: number | null
          crypto_refunded?: number | null
          currency?: string
          deposit_address?: string | null
          deposit_memo?: string | null
          failure_reason?: string | null
          fee_minor?: number
          hosted_url?: string | null
          id?: string
          last_event_at?: string | null
          network: string
          payer_id: string
          provider: string
          provider_payment_id?: string | null
          provider_quote_id?: string | null
          quote_expires_at: string
          rate_ngn: number
          reference: string
          refund_address?: string | null
          refund_tx_hash?: string | null
          settled_at?: string | null
          settled_minor?: number | null
          state?: string
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          agreement_id?: string | null
          amount_minor?: number
          asset?: string
          asset_decimals?: number
          booking_id?: string
          charge_outcome?: string | null
          confirmations?: number | null
          confirmations_required?: number | null
          created_at?: string
          crypto_amount?: number
          crypto_overpaid?: number | null
          crypto_received?: number | null
          crypto_refunded?: number | null
          currency?: string
          deposit_address?: string | null
          deposit_memo?: string | null
          failure_reason?: string | null
          fee_minor?: number
          hosted_url?: string | null
          id?: string
          last_event_at?: string | null
          network?: string
          payer_id?: string
          provider?: string
          provider_payment_id?: string | null
          provider_quote_id?: string | null
          quote_expires_at?: string
          rate_ngn?: number
          reference?: string
          refund_address?: string | null
          refund_tx_hash?: string | null
          settled_at?: string | null
          settled_minor?: number | null
          state?: string
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_payments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "deal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_agreement_events: {
        Row: {
          action: string
          actor_id: string | null
          agreement_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["agreement_status"] | null
          id: string
          note: string | null
          terms_version: number
          to_status: Database["public"]["Enums"]["agreement_status"]
        }
        Insert: {
          action: string
          actor_id?: string | null
          agreement_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["agreement_status"] | null
          id?: string
          note?: string | null
          terms_version: number
          to_status: Database["public"]["Enums"]["agreement_status"]
        }
        Update: {
          action?: string
          actor_id?: string | null
          agreement_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["agreement_status"] | null
          id?: string
          note?: string | null
          terms_version?: number
          to_status?: Database["public"]["Enums"]["agreement_status"]
        }
        Relationships: [
          {
            foreignKeyName: "deal_agreement_events_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "deal_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_agreement_versions: {
        Row: {
          agreement_id: string
          amount_minor: number
          created_at: string
          terms: Json
          terms_version: number
        }
        Insert: {
          agreement_id: string
          amount_minor: number
          created_at?: string
          terms?: Json
          terms_version: number
        }
        Update: {
          agreement_id?: string
          amount_minor?: number
          created_at?: string
          terms?: Json
          terms_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_agreement_versions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "deal_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_agreements: {
        Row: {
          accommodation_id: string | null
          amount_minor: number
          booking_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          inspection_id: string | null
          kind: string
          listing_id: string | null
          mandate_id: string | null
          owner_confirmed_at: string | null
          owner_confirmed_version: number | null
          owner_id: string
          paid_at: string | null
          renter_confirmed_at: string | null
          renter_confirmed_version: number | null
          renter_id: string
          status: Database["public"]["Enums"]["agreement_status"]
          submitted_at: string | null
          terms: Json
          terms_version: number
          updated_at: string
        }
        Insert: {
          accommodation_id?: string | null
          amount_minor: number
          booking_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          inspection_id?: string | null
          kind: string
          listing_id?: string | null
          mandate_id?: string | null
          owner_confirmed_at?: string | null
          owner_confirmed_version?: number | null
          owner_id: string
          paid_at?: string | null
          renter_confirmed_at?: string | null
          renter_confirmed_version?: number | null
          renter_id: string
          status?: Database["public"]["Enums"]["agreement_status"]
          submitted_at?: string | null
          terms: Json
          terms_version?: number
          updated_at?: string
        }
        Update: {
          accommodation_id?: string | null
          amount_minor?: number
          booking_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          inspection_id?: string | null
          kind?: string
          listing_id?: string | null
          mandate_id?: string | null
          owner_confirmed_at?: string | null
          owner_confirmed_version?: number | null
          owner_id?: string
          paid_at?: string | null
          renter_confirmed_at?: string | null
          renter_confirmed_version?: number | null
          renter_id?: string
          status?: Database["public"]["Enums"]["agreement_status"]
          submitted_at?: string | null
          terms?: Json
          terms_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_agreements_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_agreements_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_agreements_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: true
            referencedRelation: "inspection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "deal_agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "deal_agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "deal_agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_agreements_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "listing_mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      decide_reminders: {
        Row: {
          kind: string
          sent_at: string
          subject_id: string
        }
        Insert: {
          kind: string
          sent_at?: string
          subject_id: string
        }
        Update: {
          kind?: string
          sent_at?: string
          subject_id?: string
        }
        Relationships: []
      }
      door_charge_reports: {
        Row: {
          asked_minor: number | null
          booking_id: string
          created_at: string
          reporter_id: string
        }
        Insert: {
          asked_minor?: number | null
          booking_id: string
          created_at?: string
          reporter_id: string
        }
        Update: {
          asked_minor?: number | null
          booking_id?: string
          created_at?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "door_charge_reports_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      edd_approvals: {
        Row: {
          approved_at: string
          approved_by: string | null
          decision_id: string
          id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          decision_id: string
          id?: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          decision_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edd_approvals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: true
            referencedRelation: "edd_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      edd_decisions: {
        Row: {
          decided_at: string
          decided_by: string | null
          id: string
          note: string | null
          outcome: string
          review_id: string
          source_of_funds: string
        }
        Insert: {
          decided_at?: string
          decided_by?: string | null
          id?: string
          note?: string | null
          outcome: string
          review_id: string
          source_of_funds: string
        }
        Update: {
          decided_at?: string
          decided_by?: string | null
          id?: string
          note?: string | null
          outcome?: string
          review_id?: string
          source_of_funds?: string
        }
        Relationships: [
          {
            foreignKeyName: "edd_decisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "edd_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      edd_reviews: {
        Row: {
          amount_minor: number | null
          id: string
          raised_at: string
          reason: string
          scuml_item: number
          source_id: string
          source_table: string
          user_id: string | null
        }
        Insert: {
          amount_minor?: number | null
          id?: string
          raised_at?: string
          reason: string
          scuml_item: number
          source_id: string
          source_table: string
          user_id?: string | null
        }
        Update: {
          amount_minor?: number | null
          id?: string
          raised_at?: string
          reason?: string
          scuml_item?: number
          source_id?: string
          source_table?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          available_at: string
          claimed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          payload: Json
          settled_at: string | null
          status: string
          template: string
          user_id: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          claimed_at?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          payload?: Json
          settled_at?: string | null
          status?: string
          template: string
          user_id: string
        }
        Update: {
          attempts?: number
          available_at?: string
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          payload?: Json
          settled_at?: string | null
          status?: string
          template?: string
          user_id?: string
        }
        Relationships: []
      }
      email_recovery_requests: {
        Row: {
          began_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completed_notice_at: string | null
          eligible_at: string
          evidence_ref: string
          id: string
          identity_source: string
          last_error: string | null
          new_email: string
          old_email: string
          opened_at: string
          opened_by: string
          opened_notice_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          began_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_notice_at?: string | null
          eligible_at: string
          evidence_ref: string
          id?: string
          identity_source: string
          last_error?: string | null
          new_email: string
          old_email: string
          opened_at?: string
          opened_by: string
          opened_notice_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          began_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_notice_at?: string | null
          eligible_at?: string
          evidence_ref?: string
          id?: string
          identity_source?: string
          last_error?: string | null
          new_email?: string
          old_email?: string
          opened_at?: string
          opened_by?: string
          opened_notice_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      enquiry_stages: {
        Row: {
          conversation_id: string
          lost_reason: string | null
          set_at: string
          set_by: string | null
          stage: string
        }
        Insert: {
          conversation_id: string
          lost_reason?: string | null
          set_at?: string
          set_by?: string | null
          stage: string
        }
        Update: {
          conversation_id?: string
          lost_reason?: string | null
          set_at?: string
          set_by?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiry_stages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_plan_features: {
        Row: {
          feature_key: string
          granted: boolean
          plan_id: number
          quota: number | null
        }
        Insert: {
          feature_key: string
          granted: boolean
          plan_id: number
          quota?: number | null
        }
        Update: {
          feature_key?: string
          granted?: boolean
          plan_id?: number
          quota?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "entitlement_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_plans: {
        Row: {
          billing_interval: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: number
          is_default: boolean
          name: string
          note: string | null
          perks: string[]
          plan_key: string
          price_minor: number | null
        }
        Insert: {
          billing_interval?: string | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: never
          is_default?: boolean
          name: string
          note?: string | null
          perks?: string[]
          plan_key: string
          price_minor?: number | null
        }
        Update: {
          billing_interval?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: never
          is_default?: boolean
          name?: string
          note?: string | null
          perks?: string[]
          plan_key?: string
          price_minor?: number | null
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          decided_at: string | null
          event_id: string
          joined_at: string
          state: Database["public"]["Enums"]["event_attendance"]
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          event_id: string
          joined_at?: string
          state?: Database["public"]["Enums"]["event_attendance"]
          user_id: string
        }
        Update: {
          decided_at?: string | null
          event_id?: string
          joined_at?: string
          state?: Database["public"]["Enums"]["event_attendance"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          area_id: string
          attending_count: number
          blurb: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          capacity: number | null
          created_at: string
          edited_at: string | null
          ends_at: string | null
          hidden_by: string | null
          hold_reason: string | null
          host_id: string
          id: string
          post_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          venue_kind: Database["public"]["Enums"]["event_venue_kind"]
          venue_label: string
        }
        Insert: {
          area_id: string
          attending_count?: number
          blurb?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          capacity?: number | null
          created_at?: string
          edited_at?: string | null
          ends_at?: string | null
          hidden_by?: string | null
          hold_reason?: string | null
          host_id: string
          id?: string
          post_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          venue_kind: Database["public"]["Enums"]["event_venue_kind"]
          venue_label: string
        }
        Update: {
          area_id?: string
          attending_count?: number
          blurb?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          capacity?: number | null
          created_at?: string
          edited_at?: string | null
          ends_at?: string | null
          hidden_by?: string | null
          hold_reason?: string | null
          host_id?: string
          id?: string
          post_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          venue_kind?: Database["public"]["Enums"]["event_venue_kind"]
          venue_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          note: string | null
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fee_protection_rates: {
        Row: {
          created_at: string
          effective_from: string
          id: number
          note: string
          protection_bps: number
        }
        Insert: {
          created_at?: string
          effective_from: string
          id?: never
          note: string
          protection_bps: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: never
          note?: string
          protection_bps?: number
        }
        Relationships: []
      }
      fee_rates: {
        Row: {
          basis_points: number
          created_at: string
          created_by: string | null
          effective_from: string
          flat_minor: number
          id: string
          kind: Database["public"]["Enums"]["fee_kind"]
          note: string | null
        }
        Insert: {
          basis_points?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          flat_minor?: number
          id?: string
          kind: Database["public"]["Enums"]["fee_kind"]
          note?: string | null
        }
        Update: {
          basis_points?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          flat_minor?: number
          id?: string
          kind?: Database["public"]["Enums"]["fee_kind"]
          note?: string | null
        }
        Relationships: []
      }
      financial_provider_accounts: {
        Row: {
          country: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          provider: string
          provider_customer_id: string | null
          provider_status: string | null
          status: string
          status_observed_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          provider: string
          provider_customer_id?: string | null
          provider_status?: string | null
          status?: string
          status_observed_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          provider?: string
          provider_customer_id?: string | null
          provider_status?: string | null
          status?: string
          status_observed_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      firm_members: {
        Row: {
          admitted_at: string
          admitted_by: string | null
          agent_id: string
          firm_id: string
          id: string
          member_role: string
          revoke_note: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
        }
        Insert: {
          admitted_at?: string
          admitted_by?: string | null
          agent_id: string
          firm_id: string
          id?: string
          member_role?: string
          revoke_note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Update: {
          admitted_at?: string
          admitted_by?: string | null
          agent_id?: string
          firm_id?: string
          id?: string
          member_role?: string
          revoke_note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_members_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_routing: {
        Row: {
          area_agents: Json
          firm_id: string
          mode: string
          office_end: string | null
          office_start: string | null
          rr_cursor: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_agents?: Json
          firm_id: string
          mode?: string
          office_end?: string | null
          office_start?: string | null
          rr_cursor?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_agents?: Json
          firm_id?: string
          mode?: string
          office_end?: string | null
          office_start?: string | null
          rr_cursor?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "firm_routing_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      first_runs_seen: {
        Row: {
          feature: string
          seen_at: string
          user_id: string
        }
        Insert: {
          feature: string
          seen_at?: string
          user_id: string
        }
        Update: {
          feature?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      funds_movement_events: {
        Row: {
          detail: Json
          from_status: string | null
          id: number
          movement_id: string
          observed_at: string
          provider_status: string | null
          source: string
          to_status: string
        }
        Insert: {
          detail?: Json
          from_status?: string | null
          id?: never
          movement_id: string
          observed_at?: string
          provider_status?: string | null
          source: string
          to_status: string
        }
        Update: {
          detail?: Json
          from_status?: string | null
          id?: never
          movement_id?: string
          observed_at?: string
          provider_status?: string | null
          source?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "funds_movement_events_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "funds_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      funds_movements: {
        Row: {
          amount_minor: number
          client_key: string | null
          counterparty: Json
          created_at: string
          currency: string
          id: string
          kind: string
          narration: string | null
          provider: string
          provider_fee_minor: number | null
          provider_metadata: Json
          provider_status: string | null
          provider_transaction_id: string | null
          reference: string
          status: string
          status_observed_at: string
          status_source: string
          updated_at: string
          user_id: string
          vallo_fee_minor: number
          vat_minor: number
        }
        Insert: {
          amount_minor: number
          client_key?: string | null
          counterparty?: Json
          created_at?: string
          currency?: string
          id?: string
          kind: string
          narration?: string | null
          provider: string
          provider_fee_minor?: number | null
          provider_metadata?: Json
          provider_status?: string | null
          provider_transaction_id?: string | null
          reference: string
          status?: string
          status_observed_at?: string
          status_source?: string
          updated_at?: string
          user_id: string
          vallo_fee_minor?: number
          vat_minor?: number
        }
        Update: {
          amount_minor?: number
          client_key?: string | null
          counterparty?: Json
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          narration?: string | null
          provider?: string
          provider_fee_minor?: number | null
          provider_metadata?: Json
          provider_status?: string | null
          provider_transaction_id?: string | null
          reference?: string
          status?: string
          status_observed_at?: string
          status_source?: string
          updated_at?: string
          user_id?: string
          vallo_fee_minor?: number
          vat_minor?: number
        }
        Relationships: []
      }
      funnel_events: {
        Row: {
          door: string | null
          id: number
          locale: string
          occurred_at: string
          step: string
          surface: string
          user_id: string | null
          visit_id: string
        }
        Insert: {
          door?: string | null
          id?: never
          locale: string
          occurred_at?: string
          step: string
          surface: string
          user_id?: string | null
          visit_id: string
        }
        Update: {
          door?: string | null
          id?: never
          locale?: string
          occurred_at?: string
          step?: string
          surface?: string
          user_id?: string | null
          visit_id?: string
        }
        Relationships: []
      }
      guarantee_claims: {
        Row: {
          agreement_id: string
          approved_minor: number | null
          booking_id: string
          caution_obligation_id: string | null
          claimant_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          description: string
          evidence_paths: string[]
          id: string
          items: string[]
          paid_at: string | null
          paid_by: string | null
          paid_reference: string | null
          requested_minor: number
          status: string
        }
        Insert: {
          agreement_id: string
          approved_minor?: number | null
          booking_id: string
          caution_obligation_id?: string | null
          claimant_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          description: string
          evidence_paths?: string[]
          id?: string
          items?: string[]
          paid_at?: string | null
          paid_by?: string | null
          paid_reference?: string | null
          requested_minor: number
          status?: string
        }
        Update: {
          agreement_id?: string
          approved_minor?: number | null
          booking_id?: string
          caution_obligation_id?: string | null
          claimant_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          description?: string
          evidence_paths?: string[]
          id?: string
          items?: string[]
          paid_at?: string | null
          paid_by?: string | null
          paid_reference?: string | null
          requested_minor?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantee_claims_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "deal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantee_claims_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantee_claims_caution_obligation_id_fkey"
            columns: ["caution_obligation_id"]
            isOneToOne: false
            referencedRelation: "caution_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantee_reserve_entries: {
        Row: {
          amount_minor: number
          booking_id: string | null
          claim_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          id: string
          kind: string
          note: string | null
          transaction_id: string | null
        }
        Insert: {
          amount_minor: number
          booking_id?: string | null
          claim_id?: string | null
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          kind: string
          note?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount_minor?: number
          booking_id?: string | null
          claim_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          kind?: string
          note?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guarantee_reserve_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantee_reserve_entries_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "guarantee_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantee_reserve_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_records: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string
          key: string
          result: Json | null
          scope: string
          subject: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at: string
          key: string
          result?: Json | null
          scope: string
          subject: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          key?: string
          result?: Json | null
          scope?: string
          subject?: string
        }
        Relationships: []
      }
      identity_verifications: {
        Row: {
          decided_at: string
          id: string
          legal_name: string | null
          method: string
          nin_hmac: string | null
          note: string | null
          outcome: string
          provider_ref: string | null
          subject_id: string
        }
        Insert: {
          decided_at?: string
          id?: string
          legal_name?: string | null
          method: string
          nin_hmac?: string | null
          note?: string | null
          outcome: string
          provider_ref?: string | null
          subject_id: string
        }
        Update: {
          decided_at?: string
          id?: string
          legal_name?: string | null
          method?: string
          nin_hmac?: string | null
          note?: string | null
          outcome?: string
          provider_ref?: string | null
          subject_id?: string
        }
        Relationships: []
      }
      inspection_checkins: {
        Row: {
          id: string
          inspection_id: string
          observed_at: string
          received_at: string
          recorded_by: string
          result: string
          role: string
        }
        Insert: {
          id?: string
          inspection_id: string
          observed_at: string
          received_at?: string
          recorded_by: string
          result: string
          role: string
        }
        Update: {
          id?: string
          inspection_id?: string
          observed_at?: string
          received_at?: string
          recorded_by?: string
          result?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checkins_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspection_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_confirmations: {
        Row: {
          confirmed_at: string
          conversation_id: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          conversation_id: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string
          conversation_id?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_confirmations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_confirmations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_confirmations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_confirmations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_confirmations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_delegates: {
        Row: {
          accepted_at: string | null
          basis: string
          delegate_user_id: string
          inspection_id: string
          named_at: string
          named_by: string
        }
        Insert: {
          accepted_at?: string | null
          basis: string
          delegate_user_id: string
          inspection_id: string
          named_at?: string
          named_by: string
        }
        Update: {
          accepted_at?: string | null
          basis?: string
          delegate_user_id?: string
          inspection_id?: string
          named_at?: string
          named_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_delegates_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: true
            referencedRelation: "inspection_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_report_items: {
        Row: {
          checked: boolean
          checked_at: string | null
          inspection_id: string
          item: string
          note: string | null
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          inspection_id: string
          item: string
          note?: string | null
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          inspection_id?: string
          item?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_report_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspection_reports"
            referencedColumns: ["inspection_id"]
          },
        ]
      }
      inspection_report_photos: {
        Row: {
          created_at: string
          id: string
          inspection_id: string
          item: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_id: string
          item?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_id?: string
          item?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_report_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspection_reports"
            referencedColumns: ["inspection_id"]
          },
        ]
      }
      inspection_reports: {
        Row: {
          author_id: string
          created_at: string
          inspection_id: string
          notes: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          inspection_id: string
          notes?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          inspection_id?: string
          notes?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_reports_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: true
            referencedRelation: "inspection_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_requests: {
        Row: {
          completed_at: string | null
          confirmed_at: string | null
          conversation_id: string | null
          created_at: string
          id: string
          lister_id: string
          lister_note: string | null
          listing_id: string
          note: string | null
          outcome: string | null
          requested_at: string
          requester_id: string
          responded_at: string | null
          slot_at: string | null
          state: Database["public"]["Enums"]["inspection_state"]
          updated_at: string
          window_id: string | null
          visit_mode: string
        }
        Insert: {
          completed_at?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          lister_id: string
          lister_note?: string | null
          listing_id: string
          note?: string | null
          outcome?: string | null
          requested_at: string
          requester_id: string
          responded_at?: string | null
          slot_at?: string | null
          state?: Database["public"]["Enums"]["inspection_state"]
          updated_at?: string
          window_id?: string | null
          visit_mode?: string
        }
        Update: {
          completed_at?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          lister_id?: string
          lister_note?: string | null
          listing_id?: string
          note?: string | null
          outcome?: string | null
          requested_at?: string
          requester_id?: string
          responded_at?: string | null
          slot_at?: string | null
          state?: Database["public"]["Enums"]["inspection_state"]
          updated_at?: string
          window_id?: string | null
          visit_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_requests_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "viewing_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_safety_shares: {
        Row: {
          checked_in_at: string | null
          created_at: string
          created_by: string
          expected_back_at: string
          expires_at: string
          id: string
          inspection_id: string
          reminded_at: string | null
          revoked_at: string | null
          slot_at: string | null
          stopped_at: string | null
          token_hash: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          created_by: string
          expected_back_at: string
          expires_at: string
          id?: string
          inspection_id: string
          reminded_at?: string | null
          revoked_at?: string | null
          slot_at?: string | null
          stopped_at?: string | null
          token_hash: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          created_by?: string
          expected_back_at?: string
          expires_at?: string
          id?: string
          inspection_id?: string
          reminded_at?: string | null
          revoked_at?: string | null
          slot_at?: string | null
          stopped_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_safety_shares_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspection_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_truth: {
        Row: {
          agent_matched: string
          answered_at: string
          available: string
          inspection_id: string
          listing_id: string
          off_platform_ask: string
          property_matched: string
          respondent_id: string
          weight_withheld_reason: string[] | null
        }
        Insert: {
          agent_matched: string
          answered_at?: string
          available: string
          inspection_id: string
          listing_id: string
          off_platform_ask: string
          property_matched: string
          respondent_id: string
          weight_withheld_reason?: string[] | null
        }
        Update: {
          agent_matched?: string
          answered_at?: string
          available?: string
          inspection_id?: string
          listing_id?: string
          off_platform_ask?: string
          property_matched?: string
          respondent_id?: string
          weight_withheld_reason?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_truth_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: true
            referencedRelation: "inspection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_truth_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_truth_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_truth_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_truth_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_accounts: {
        Row: {
          marked_at: string
          marked_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          marked_at?: string
          marked_by?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          marked_at?: string
          marked_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          day: string
          first_at: string
          job: string
          last_at: string
          last_metadata: Json
          outcome: string
          runs: number
        }
        Insert: {
          day: string
          first_at?: string
          job: string
          last_at?: string
          last_metadata?: Json
          outcome: string
          runs?: number
        }
        Update: {
          day?: string
          first_at?: string
          job?: string
          last_at?: string
          last_metadata?: Json
          outcome?: string
          runs?: number
        }
        Relationships: []
      }
      known_devices: {
        Row: {
          device_words: string | null
          fingerprint: string
          first_seen_at: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          device_words?: string | null
          fingerprint: string
          first_seen_at?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          device_words?: string | null
          fingerprint?: string
          first_seen_at?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_consents: {
        Row: {
          consent: string
          consented_at: string
          id: string
          user_id: string
        }
        Insert: {
          consent: string
          consented_at?: string
          id?: string
          user_id: string
        }
        Update: {
          consent?: string
          consented_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      landmarks: {
        Row: {
          aliases: string[]
          city: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["landmark_kind"]
          latitude: number
          location: unknown
          longitude: number
          name: string
          slug: string
          source: Database["public"]["Enums"]["source_kind"]
          state_code: string
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          city: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["landmark_kind"]
          latitude: number
          location?: unknown
          longitude: number
          name: string
          slug: string
          source?: Database["public"]["Enums"]["source_kind"]
          state_code: string
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          city?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["landmark_kind"]
          latitude?: number
          location?: unknown
          longitude?: number
          name?: string
          slug?: string
          source?: Database["public"]["Enums"]["source_kind"]
          state_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landmarks_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      leaderboard_opt_outs: {
        Row: {
          created_at: string
          owner_id: string
          subject_id: string
          subject_kind: string
        }
        Insert: {
          created_at?: string
          owner_id: string
          subject_id: string
          subject_kind: string
        }
        Update: {
          created_at?: string
          owner_id?: string
          subject_id?: string
          subject_kind?: string
        }
        Relationships: []
      }
      ledger_customer_funds: {
        Row: {
          amount_minor: number
          corrects_entry_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          direction: string
          event_type: string
          id: string
          idempotency_key: string
          metadata: Json
          provider: string
          provider_reference: string | null
          rail: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount_minor: number
          corrects_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          direction: string
          event_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          provider: string
          provider_reference?: string | null
          rail?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount_minor?: number
          corrects_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          provider?: string
          provider_reference?: string | null
          rail?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_customer_funds_corrects_entry_id_fkey"
            columns: ["corrects_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_customer_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_customer_funds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          agent_share_minor: number
          booking_id: string
          created_at: string
          gross_minor: number
          guarantee_reserve_minor: number
          id: string
          net_settlement_minor: number
          platform_fee_minor: number
          processor_fee_minor: number
          transaction_id: string | null
        }
        Insert: {
          agent_share_minor?: number
          booking_id: string
          created_at?: string
          gross_minor: number
          guarantee_reserve_minor?: number
          id?: string
          net_settlement_minor: number
          platform_fee_minor?: number
          processor_fee_minor?: number
          transaction_id?: string | null
        }
        Update: {
          agent_share_minor?: number
          booking_id?: string
          created_at?: string
          gross_minor?: number
          guarantee_reserve_minor?: number
          id?: string
          net_settlement_minor?: number
          platform_fee_minor?: number
          processor_fee_minor?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_marketing_float: {
        Row: {
          amount_minor: number
          corrects_entry_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          direction: string
          event_type: string
          id: string
          idempotency_key: string
          metadata: Json
          provider: string
          provider_reference: string | null
          rail: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount_minor: number
          corrects_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          direction: string
          event_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          provider: string
          provider_reference?: string | null
          rail?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount_minor?: number
          corrects_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          provider?: string
          provider_reference?: string | null
          rail?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_marketing_float_corrects_entry_id_fkey"
            columns: ["corrects_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_marketing_float"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_marketing_float_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_vallo_revenue: {
        Row: {
          amount_minor: number
          corrects_entry_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          direction: string
          event_type: string
          id: string
          idempotency_key: string
          metadata: Json
          provider: string
          provider_reference: string | null
          rail: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount_minor: number
          corrects_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          direction: string
          event_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          provider: string
          provider_reference?: string | null
          rail?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount_minor?: number
          corrects_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          provider?: string
          provider_reference?: string | null
          rail?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_vallo_revenue_corrects_entry_id_fkey"
            columns: ["corrects_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_vallo_revenue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_vallo_revenue_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_access: {
        Row: {
          access_code: string | null
          estate_name: string | null
          gate_directions: string | null
          listing_id: string
          security_phone: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          estate_name?: string | null
          gate_directions?: string | null
          listing_id: string
          security_phone?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          estate_name?: string | null
          gate_directions?: string | null
          listing_id?: string
          security_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_access_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_access_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_access_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_access_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_amenities: {
        Row: {
          amenity_id: string
          listing_id: string
        }
        Insert: {
          amenity_id: string
          listing_id: string
        }
        Update: {
          amenity_id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_amenities_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_amenities_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_amenities_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_amenities_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_broadcast_marks: {
        Row: {
          listing_id: string
          unconfirmed: string[]
          updated_at: string
        }
        Insert: {
          listing_id: string
          unconfirmed?: string[]
          updated_at?: string
        }
        Update: {
          listing_id?: string
          unconfirmed?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_broadcast_marks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_broadcast_marks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_broadcast_marks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_broadcast_marks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_changes: {
        Row: {
          available: boolean | null
          change: string
          changed_at: string
          id: string
          listing_id: string
          new_minor: number | null
          old_minor: number | null
        }
        Insert: {
          available?: boolean | null
          change: string
          changed_at?: string
          id?: string
          listing_id: string
          new_minor?: number | null
          old_minor?: number | null
        }
        Update: {
          available?: boolean | null
          change?: string
          changed_at?: string
          id?: string
          listing_id?: string
          new_minor?: number | null
          old_minor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_changes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_changes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_changes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_changes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_daily_stats: {
        Row: {
          day: string
          impressions: number
          listing_id: string
          opens: number
        }
        Insert: {
          day: string
          impressions?: number
          listing_id: string
          opens?: number
        }
        Update: {
          day?: string
          impressions?: number
          listing_id?: string
          opens?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_daily_stats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_daily_stats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_daily_stats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_daily_stats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_fee_acceptances: {
        Row: {
          accepted_at: string
          cap_minor: number | null
          cap_threshold_minor: number | null
          commission_bps: number
          fee_high_minor: number
          fee_low_minor: number
          figures_shown: Json
          id: string
          listing_id: string
          member_id: string
          policy_version: string
          policy_version_id: number
          property_type: Database["public"]["Enums"]["property_type"]
          protection_bps: number
          protection_rate_id: number
          receive_high_minor: number
          receive_low_minor: number
          rent_minor: number
          terms_version: string
        }
        Insert: {
          accepted_at?: string
          cap_minor?: number | null
          cap_threshold_minor?: number | null
          commission_bps: number
          fee_high_minor: number
          fee_low_minor: number
          figures_shown: Json
          id?: string
          listing_id: string
          member_id: string
          policy_version: string
          policy_version_id: number
          property_type: Database["public"]["Enums"]["property_type"]
          protection_bps: number
          protection_rate_id: number
          receive_high_minor: number
          receive_low_minor: number
          rent_minor: number
          terms_version: string
        }
        Update: {
          accepted_at?: string
          cap_minor?: number | null
          cap_threshold_minor?: number | null
          commission_bps?: number
          fee_high_minor?: number
          fee_low_minor?: number
          figures_shown?: Json
          id?: string
          listing_id?: string
          member_id?: string
          policy_version?: string
          policy_version_id?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          protection_bps?: number
          protection_rate_id?: number
          receive_high_minor?: number
          receive_low_minor?: number
          rent_minor?: number
          terms_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_fee_acceptances_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "money_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_fee_acceptances_protection_rate_id_fkey"
            columns: ["protection_rate_id"]
            isOneToOne: false
            referencedRelation: "fee_protection_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_lineage: {
        Row: {
          created_at: string
          created_by: string
          predecessor_listing_id: string
          predecessor_rent_payment_id: string
          successor_listing_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          predecessor_listing_id: string
          predecessor_rent_payment_id: string
          successor_listing_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          predecessor_listing_id?: string
          predecessor_rent_payment_id?: string
          successor_listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_lineage_predecessor_listing_id_fkey"
            columns: ["predecessor_listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_lineage_predecessor_listing_id_fkey"
            columns: ["predecessor_listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_lineage_predecessor_listing_id_fkey"
            columns: ["predecessor_listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_lineage_predecessor_listing_id_fkey"
            columns: ["predecessor_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_lineage_predecessor_rent_payment_id_fkey"
            columns: ["predecessor_rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_lineage_successor_listing_id_fkey"
            columns: ["successor_listing_id"]
            isOneToOne: true
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_lineage_successor_listing_id_fkey"
            columns: ["successor_listing_id"]
            isOneToOne: true
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_lineage_successor_listing_id_fkey"
            columns: ["successor_listing_id"]
            isOneToOne: true
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_lineage_successor_listing_id_fkey"
            columns: ["successor_listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_mandates: {
        Row: {
          created_at: string
          document_id: string | null
          exclusive: boolean | null
          expires_on: string | null
          id: string
          kind: string
          listing_id: string
          principal_consent_read_by: string | null
          principal_consent_sentence: string | null
          principal_consent_withdrawn_at: string | null
          principal_consented_at: string | null
          principal_id_document_kind: string | null
          principal_id_document_ref: string | null
          principal_key: string | null
          principal_name: string
          principal_phone: string | null
          principal_relationship: string | null
          principal_verified_at: string | null
          principal_verified_by: string | null
          principal_verified_how: string | null
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["document_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          signed_on: string | null
          superseded_at: string | null
          superseded_by: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          exclusive?: boolean | null
          expires_on?: string | null
          id?: string
          kind: string
          listing_id: string
          principal_consent_read_by?: string | null
          principal_consent_sentence?: string | null
          principal_consent_withdrawn_at?: string | null
          principal_consented_at?: string | null
          principal_id_document_kind?: string | null
          principal_id_document_ref?: string | null
          principal_key?: string | null
          principal_name: string
          principal_phone?: string | null
          principal_relationship?: string | null
          principal_verified_at?: string | null
          principal_verified_by?: string | null
          principal_verified_how?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["document_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          signed_on?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          exclusive?: boolean | null
          expires_on?: string | null
          id?: string
          kind?: string
          listing_id?: string
          principal_consent_read_by?: string | null
          principal_consent_sentence?: string | null
          principal_consent_withdrawn_at?: string | null
          principal_consented_at?: string | null
          principal_id_document_kind?: string | null
          principal_id_document_ref?: string | null
          principal_key?: string | null
          principal_name?: string
          principal_phone?: string | null
          principal_relationship?: string | null
          principal_verified_at?: string | null
          principal_verified_by?: string | null
          principal_verified_how?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["document_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          signed_on?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_mandates_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "agent_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_mandates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_mandates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_mandates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_mandates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_mandates_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "listing_mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_match_queue: {
        Row: {
          enqueued_at: string
          listing_id: string
          processed_at: string | null
          published_at: string
        }
        Insert: {
          enqueued_at?: string
          listing_id: string
          processed_at?: string | null
          published_at: string
        }
        Update: {
          enqueued_at?: string
          listing_id?: string
          processed_at?: string | null
          published_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_match_queue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_match_queue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_match_queue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_match_queue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photo_hashes: {
        Row: {
          hashed_at: string
          phash: number
          photo_id: string
        }
        Insert: {
          hashed_at?: string
          phash: number
          photo_id: string
        }
        Update: {
          hashed_at?: string
          phash?: number
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photo_hashes_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: true
            referencedRelation: "listing_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photo_slots: {
        Row: {
          listing_id: string
          photo_id: string
          set_at: string
          set_by: string
          slot: string
        }
        Insert: {
          listing_id: string
          photo_id: string
          set_at?: string
          set_by: string
          slot: string
        }
        Update: {
          listing_id?: string
          photo_id?: string
          set_at?: string
          set_by?: string
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photo_slots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_photo_slots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_photo_slots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_photo_slots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_photo_slots_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: true
            referencedRelation: "listing_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          position: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          position?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_rate_acceptances: {
        Row: {
          accepted_at: string
          amount_minor: number
          cap_minor: number | null
          cap_threshold_minor: number | null
          commission_bps: number
          commission_minor: number
          figures_shown: Json
          id: string
          listing_id: string
          member_id: string
          net_minor: number
          policy_version_id: number
          property_type: Database["public"]["Enums"]["property_type"]
        }
        Insert: {
          accepted_at?: string
          amount_minor: number
          cap_minor?: number | null
          cap_threshold_minor?: number | null
          commission_bps: number
          commission_minor: number
          figures_shown: Json
          id?: string
          listing_id: string
          member_id: string
          net_minor: number
          policy_version_id: number
          property_type: Database["public"]["Enums"]["property_type"]
        }
        Update: {
          accepted_at?: string
          amount_minor?: number
          cap_minor?: number | null
          cap_threshold_minor?: number | null
          commission_bps?: number
          commission_minor?: number
          figures_shown?: Json
          id?: string
          listing_id?: string
          member_id?: string
          net_minor?: number
          policy_version_id?: number
          property_type?: Database["public"]["Enums"]["property_type"]
        }
        Relationships: [
          {
            foreignKeyName: "listing_rate_acceptances_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "money_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          listing_id: string
          position: number
          poster_path: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          listing_id: string
          position?: number
          poster_path?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          listing_id?: string
          position?: number
          poster_path?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_videos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_videos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_videos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_videos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_view_marks: {
        Row: {
          day: string
          kind: unknown
          listing_id: string
          viewer_hash: string
        }
        Insert: {
          day: string
          kind: unknown
          listing_id: string
          viewer_hash: string
        }
        Update: {
          day?: string
          kind?: unknown
          listing_id?: string
          viewer_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_view_marks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_view_marks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_view_marks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_view_marks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string | null
          address_verified_at: string | null
          agency_fee_minor: number | null
          agent_id: string
          agreement_fee_minor: number | null
          area: string | null
          assigned_agent_id: string | null
          availability_confirmed_at: string | null
          available_from: string | null
          bathrooms: number
          bedrooms: number
          car_access: boolean | null
          caution_deposit_minor: number | null
          city: string | null
          close_reason: string | null
          closed_at: string | null
          closed_rent_payment_id: string | null
          condition: Database["public"]["Enums"]["build_condition"] | null
          created_at: string
          demo_retire_after: string | null
          description: string | null
          ensuite_count: number | null
          estate_type: string | null
          featured: boolean
          firm_id: string | null
          flats_in_compound: number | null
          flooding: string | null
          floor: number | null
          furnished: Database["public"]["Enums"]["furnishing"] | null
          governors_consent_fee_minor: number | null
          has_bq: boolean | null
          has_estate_access: boolean
          id: string
          is_demo: boolean
          is_serviced: boolean | null
          landlord_on_site: boolean | null
          landmark: string | null
          latitude: number | null
          latitude_public: number | null
          legal_fee_minor: number | null
          lister_confirmed_at: string | null
          listing_fee_charged_at: string | null
          listing_fee_minor: number | null
          listing_fee_rate_id: string | null
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          listing_role: Database["public"]["Enums"]["listing_role"]
          location: unknown
          location_public: unknown
          longitude: number | null
          longitude_public: number | null
          mandate_verified_at: string | null
          minimum_tenancy_months: number | null
          needs_mandate_since: string | null
          not_reconfirmed_since: string | null
          ownership_verified_at: string | null
          parking_spaces: number | null
          parking_type: string | null
          physically_inspected_at: string | null
          power_backup: Database["public"]["Enums"]["power_backup"] | null
          power_backup_hours: number | null
          power_grid: Database["public"]["Enums"]["power_grid"] | null
          prepaid_meter: boolean | null
          price_negotiable: boolean
          property_id: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string | null
          rate_minor: number
          rate_period: Database["public"]["Enums"]["rate_period"] | null
          reference: string | null
          rent_amount_minor: number | null
          rent_negotiable: boolean
          rent_period: Database["public"]["Enums"]["rent_period"] | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          sale_agency_fee_minor: number | null
          sale_legal_fee_minor: number | null
          sale_price_minor: number | null
          sale_status: Database["public"]["Enums"]["sale_status"] | null
          service_charge_covers: string[] | null
          service_charge_minor: number | null
          service_charge_period:
            | Database["public"]["Enums"]["rent_period"]
            | null
          service_charge_reconciled: boolean | null
          size_sqm: number | null
          stamp_duty_minor: number | null
          state_code: string | null
          status: Database["public"]["Enums"]["listing_status"]
          submitted_at: string | null
          supply_verified_by: string | null
          survey_registration_fee_minor: number | null
          tenure: Database["public"]["Enums"]["land_tenure"] | null
          title: string
          toilets: number | null
          total_floors: number | null
          total_move_in_cost_minor: number | null
          total_purchase_cost_minor: number | null
          unit_shape: Database["public"]["Enums"]["unit_shape"] | null
          updated_at: string
          verified_by: string | null
          waste_disposal: string | null
          water_supply: Database["public"]["Enums"]["water_supply"] | null
          year_built: number | null
        }
        Insert: {
          address?: string | null
          address_verified_at?: string | null
          agency_fee_minor?: number | null
          agent_id: string
          agreement_fee_minor?: number | null
          area?: string | null
          assigned_agent_id?: string | null
          availability_confirmed_at?: string | null
          available_from?: string | null
          bathrooms?: number
          bedrooms?: number
          car_access?: boolean | null
          caution_deposit_minor?: number | null
          city?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_rent_payment_id?: string | null
          condition?: Database["public"]["Enums"]["build_condition"] | null
          created_at?: string
          demo_retire_after?: string | null
          description?: string | null
          ensuite_count?: number | null
          estate_type?: string | null
          featured?: boolean
          firm_id?: string | null
          flats_in_compound?: number | null
          flooding?: string | null
          floor?: number | null
          furnished?: Database["public"]["Enums"]["furnishing"] | null
          governors_consent_fee_minor?: number | null
          has_bq?: boolean | null
          has_estate_access?: boolean
          id?: string
          is_demo?: boolean
          is_serviced?: boolean | null
          landlord_on_site?: boolean | null
          landmark?: string | null
          latitude?: number | null
          latitude_public?: number | null
          legal_fee_minor?: number | null
          lister_confirmed_at?: string | null
          listing_fee_charged_at?: string | null
          listing_fee_minor?: number | null
          listing_fee_rate_id?: string | null
          listing_intent?: Database["public"]["Enums"]["listing_intent"]
          listing_role: Database["public"]["Enums"]["listing_role"]
          location?: unknown
          location_public?: unknown
          longitude?: number | null
          longitude_public?: number | null
          mandate_verified_at?: string | null
          minimum_tenancy_months?: number | null
          needs_mandate_since?: string | null
          not_reconfirmed_since?: string | null
          ownership_verified_at?: string | null
          parking_spaces?: number | null
          parking_type?: string | null
          physically_inspected_at?: string | null
          power_backup?: Database["public"]["Enums"]["power_backup"] | null
          power_backup_hours?: number | null
          power_grid?: Database["public"]["Enums"]["power_grid"] | null
          prepaid_meter?: boolean | null
          price_negotiable?: boolean
          property_id?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          published_at?: string | null
          rate_minor?: number
          rate_period?: Database["public"]["Enums"]["rate_period"] | null
          reference?: string | null
          rent_amount_minor?: number | null
          rent_negotiable?: boolean
          rent_period?: Database["public"]["Enums"]["rent_period"] | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          sale_agency_fee_minor?: number | null
          sale_legal_fee_minor?: number | null
          sale_price_minor?: number | null
          sale_status?: Database["public"]["Enums"]["sale_status"] | null
          service_charge_covers?: string[] | null
          service_charge_minor?: number | null
          service_charge_period?:
            | Database["public"]["Enums"]["rent_period"]
            | null
          service_charge_reconciled?: boolean | null
          size_sqm?: number | null
          stamp_duty_minor?: number | null
          state_code?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          supply_verified_by?: string | null
          survey_registration_fee_minor?: number | null
          tenure?: Database["public"]["Enums"]["land_tenure"] | null
          title: string
          toilets?: number | null
          total_floors?: number | null
          total_move_in_cost_minor?: number | null
          total_purchase_cost_minor?: number | null
          unit_shape?: Database["public"]["Enums"]["unit_shape"] | null
          updated_at?: string
          verified_by?: string | null
          waste_disposal?: string | null
          water_supply?: Database["public"]["Enums"]["water_supply"] | null
          year_built?: number | null
        }
        Update: {
          address?: string | null
          address_verified_at?: string | null
          agency_fee_minor?: number | null
          agent_id?: string
          agreement_fee_minor?: number | null
          area?: string | null
          assigned_agent_id?: string | null
          availability_confirmed_at?: string | null
          available_from?: string | null
          bathrooms?: number
          bedrooms?: number
          car_access?: boolean | null
          caution_deposit_minor?: number | null
          city?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_rent_payment_id?: string | null
          condition?: Database["public"]["Enums"]["build_condition"] | null
          created_at?: string
          demo_retire_after?: string | null
          description?: string | null
          ensuite_count?: number | null
          estate_type?: string | null
          featured?: boolean
          firm_id?: string | null
          flats_in_compound?: number | null
          flooding?: string | null
          floor?: number | null
          furnished?: Database["public"]["Enums"]["furnishing"] | null
          governors_consent_fee_minor?: number | null
          has_bq?: boolean | null
          has_estate_access?: boolean
          id?: string
          is_demo?: boolean
          is_serviced?: boolean | null
          landlord_on_site?: boolean | null
          landmark?: string | null
          latitude?: number | null
          latitude_public?: number | null
          legal_fee_minor?: number | null
          lister_confirmed_at?: string | null
          listing_fee_charged_at?: string | null
          listing_fee_minor?: number | null
          listing_fee_rate_id?: string | null
          listing_intent?: Database["public"]["Enums"]["listing_intent"]
          listing_role?: Database["public"]["Enums"]["listing_role"]
          location?: unknown
          location_public?: unknown
          longitude?: number | null
          longitude_public?: number | null
          mandate_verified_at?: string | null
          minimum_tenancy_months?: number | null
          needs_mandate_since?: string | null
          not_reconfirmed_since?: string | null
          ownership_verified_at?: string | null
          parking_spaces?: number | null
          parking_type?: string | null
          physically_inspected_at?: string | null
          power_backup?: Database["public"]["Enums"]["power_backup"] | null
          power_backup_hours?: number | null
          power_grid?: Database["public"]["Enums"]["power_grid"] | null
          prepaid_meter?: boolean | null
          price_negotiable?: boolean
          property_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          published_at?: string | null
          rate_minor?: number
          rate_period?: Database["public"]["Enums"]["rate_period"] | null
          reference?: string | null
          rent_amount_minor?: number | null
          rent_negotiable?: boolean
          rent_period?: Database["public"]["Enums"]["rent_period"] | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          sale_agency_fee_minor?: number | null
          sale_legal_fee_minor?: number | null
          sale_price_minor?: number | null
          sale_status?: Database["public"]["Enums"]["sale_status"] | null
          service_charge_covers?: string[] | null
          service_charge_minor?: number | null
          service_charge_period?:
            | Database["public"]["Enums"]["rent_period"]
            | null
          service_charge_reconciled?: boolean | null
          size_sqm?: number | null
          stamp_duty_minor?: number | null
          state_code?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          supply_verified_by?: string | null
          survey_registration_fee_minor?: number | null
          tenure?: Database["public"]["Enums"]["land_tenure"] | null
          title?: string
          toilets?: number | null
          total_floors?: number | null
          total_move_in_cost_minor?: number | null
          total_purchase_cost_minor?: number | null
          unit_shape?: Database["public"]["Enums"]["unit_shape"] | null
          updated_at?: string
          verified_by?: string | null
          waste_disposal?: string | null
          water_supply?: Database["public"]["Enums"]["water_supply"] | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_closed_rent_payment_id_fkey"
            columns: ["closed_rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_listing_fee_rate_id_fkey"
            columns: ["listing_fee_rate_id"]
            isOneToOne: false
            referencedRelation: "fee_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      local_governments: {
        Row: {
          code: string
          name: string
          state_code: string
        }
        Insert: {
          code: string
          name: string
          state_code: string
        }
        Update: {
          code?: string
          name?: string
          state_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_governments_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      mandate_expiry_notices: {
        Row: {
          days_before: number
          mandate_id: string
          sent_at: string
        }
        Insert: {
          days_before: number
          mandate_id: string
          sent_at?: string
        }
        Update: {
          days_before?: number
          mandate_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandate_expiry_notices_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "listing_mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      mandate_invitations: {
        Row: {
          asking_max_minor: number
          asking_min_minor: number
          bedrooms: number | null
          city: string | null
          created_at: string
          expires_at: string
          id: string
          listing_id: string
          owner_user: string
          place_name: string
          property_type: Database["public"]["Enums"]["property_type"] | null
          rent_period: Database["public"]["Enums"]["rent_period"]
          state_code: string | null
          status: string
        }
        Insert: {
          asking_max_minor: number
          asking_min_minor: number
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          listing_id: string
          owner_user: string
          place_name: string
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rent_period?: Database["public"]["Enums"]["rent_period"]
          state_code?: string | null
          status?: string
        }
        Update: {
          asking_max_minor?: number
          asking_min_minor?: number
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          listing_id?: string
          owner_user?: string
          place_name?: string
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rent_period?: Database["public"]["Enums"]["rent_period"]
          state_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandate_invitations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "mandate_invitations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "mandate_invitations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "mandate_invitations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mandate_pitches: {
        Row: {
          agent_id: string
          awarded_at: string | null
          created_at: string
          id: string
          invitation_id: string
          note: string
        }
        Insert: {
          agent_id: string
          awarded_at?: string | null
          created_at?: string
          id?: string
          invitation_id: string
          note: string
        }
        Update: {
          agent_id?: string
          awarded_at?: string | null
          created_at?: string
          id?: string
          invitation_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandate_pitches_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandate_pitches_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "mandate_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_alert_quota: {
        Row: {
          day: string
          sent: number
          user_id: string
        }
        Insert: {
          day: string
          sent?: number
          user_id: string
        }
        Update: {
          day?: string
          sent?: number
          user_id?: string
        }
        Relationships: []
      }
      match_alert_walk: {
        Row: {
          after_id: string | null
          id: number
          pass_started_at: string | null
          updated_at: string
        }
        Insert: {
          after_id?: string | null
          id?: number
          pass_started_at?: string | null
          updated_at?: string
        }
        Update: {
          after_id?: string | null
          id?: number
          pass_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      member_entitlement_plans: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          granted_by: string | null
          id: string
          plan_id: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          granted_by?: string | null
          id?: string
          plan_id: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          granted_by?: string | null
          id?: string
          plan_id?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_entitlement_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "entitlement_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      member_funds_reported: {
        Row: {
          available_minor: number
          currency: string
          observed_at: string
          protected_minor: number
          provider: string
          provider_balance_id: string
          user_id: string
        }
        Insert: {
          available_minor: number
          currency: string
          observed_at: string
          protected_minor: number
          provider: string
          provider_balance_id: string
          user_id: string
        }
        Update: {
          available_minor?: number
          currency?: string
          observed_at?: string
          protected_minor?: number
          provider?: string
          provider_balance_id?: string
          user_id?: string
        }
        Relationships: []
      }
      member_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          scope: Database["public"]["Enums"]["staff_scope"] | null
          subject_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          scope?: Database["public"]["Enums"]["staff_scope"] | null
          subject_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          scope?: Database["public"]["Enums"]["staff_scope"] | null
          subject_id?: string
        }
        Relationships: []
      }
      member_passcodes: {
        Row: {
          failed_count: number
          hash: string
          length: number
          locked_until: string | null
          reset_required: boolean
          set_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          failed_count?: number
          hash: string
          length: number
          locked_until?: string | null
          reset_required?: boolean
          set_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          failed_count?: number
          hash?: string
          length?: number
          locked_until?: string | null
          reset_required?: boolean
          set_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_reminders: {
        Row: {
          kind: string
          sent_at: string
          stage: string
          subject_id: string
        }
        Insert: {
          kind: string
          sent_at?: string
          stage: string
          subject_id: string
        }
        Update: {
          kind?: string
          sent_at?: string
          stage?: string
          subject_id?: string
        }
        Relationships: []
      }
      member_subscriptions: {
        Row: {
          amount_minor: number | null
          cancel_requested_at: string | null
          checkout_email_sha256: string | null
          checkout_reference: string | null
          created_at: string
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          end_reason: string | null
          ended_at: string | null
          grant_id: string | null
          id: string
          kind: string
          mode: string | null
          plan_id: number
          plan_key: string
          provider: string | null
          provider_customer_code: string | null
          provider_email_token: string | null
          provider_plan_code: string | null
          provider_subscription_code: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor?: number | null
          cancel_requested_at?: string | null
          checkout_email_sha256?: string | null
          checkout_reference?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          end_reason?: string | null
          ended_at?: string | null
          grant_id?: string | null
          id?: string
          kind: string
          mode?: string | null
          plan_id: number
          plan_key: string
          provider?: string | null
          provider_customer_code?: string | null
          provider_email_token?: string | null
          provider_plan_code?: string | null
          provider_subscription_code?: string | null
          status: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number | null
          cancel_requested_at?: string | null
          checkout_email_sha256?: string | null
          checkout_reference?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          end_reason?: string | null
          ended_at?: string | null
          grant_id?: string | null
          id?: string
          kind?: string
          mode?: string | null
          plan_id?: number
          plan_key?: string
          provider?: string | null
          provider_customer_code?: string | null
          provider_email_token?: string | null
          provider_plan_code?: string | null
          provider_subscription_code?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_subscriptions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "member_entitlement_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "entitlement_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      message_account_checks: {
        Row: {
          bank_code: string | null
          checked_at: string
          conversation_id: string
          last4: string | null
          message_id: string
          name_matches_lister: boolean | null
          outcome: string
          shares_a_name: boolean | null
        }
        Insert: {
          bank_code?: string | null
          checked_at?: string
          conversation_id: string
          last4?: string | null
          message_id: string
          name_matches_lister?: boolean | null
          outcome: string
          shares_a_name?: boolean | null
        }
        Update: {
          bank_code?: string | null
          checked_at?: string
          conversation_id?: string
          last4?: string | null
          message_id?: string
          name_matches_lister?: boolean | null
          outcome?: string
          shares_a_name?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "message_account_checks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_account_checks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          duration_ms: number | null
          height: number | null
          id: string
          kind: string
          message_id: string
          peaks: Json | null
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind?: string
          message_id: string
          peaks?: Json | null
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind?: string
          message_id?: string
          peaks?: Json | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_flags: {
        Row: {
          created_at: string
          id: string
          matched: string
          message_id: string
          reason: Database["public"]["Enums"]["message_flag_reason"]
          reviewed_by: string | null
          status: Database["public"]["Enums"]["message_flag_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          matched: string
          message_id: string
          reason: Database["public"]["Enums"]["message_flag_reason"]
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["message_flag_status"]
        }
        Update: {
          created_at?: string
          id?: string
          matched?: string
          message_id?: string
          reason?: Database["public"]["Enums"]["message_flag_reason"]
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["message_flag_status"]
        }
        Relationships: [
          {
            foreignKeyName: "message_flags_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_hidden: {
        Row: {
          hidden_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          hidden_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          hidden_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_hidden_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          conversation_id: string
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id?: string
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          call_id: string | null
          conversation_id: string
          created_at: string
          deleted_for_everyone_at: string | null
          forwarded: boolean
          id: string
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          call_id?: string | null
          conversation_id: string
          created_at?: string
          deleted_for_everyone_at?: string | null
          forwarded?: boolean
          id?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          call_id?: string | null
          conversation_id?: string
          created_at?: string
          deleted_for_everyone_at?: string | null
          forwarded?: boolean
          id?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      money_challenges: {
        Row: {
          challenge: string
          created_at: string
          digest: string | null
          expires_at: string
          id: string
          purpose: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          challenge: string
          created_at?: string
          digest?: string | null
          expires_at?: string
          id?: string
          purpose: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          challenge?: string
          created_at?: string
          digest?: string | null
          expires_at?: string
          id?: string
          purpose?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      money_credentials: {
        Row: {
          alg: number
          created_at: string
          credential_id: string
          id: string
          label: string | null
          last_used_at: string | null
          public_key_spki: string
          sign_count: number
          user_id: string
        }
        Insert: {
          alg: number
          created_at?: string
          credential_id: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          public_key_spki: string
          sign_count?: number
          user_id: string
        }
        Update: {
          alg?: number
          created_at?: string
          credential_id?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          public_key_spki?: string
          sign_count?: number
          user_id?: string
        }
        Relationships: []
      }
      money_policy: {
        Row: {
          claim_window_hours: number
          guarantee_bps: number
          id: boolean
          min_inspection_photos: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          claim_window_hours?: number
          guarantee_bps?: number
          id?: boolean
          min_inspection_photos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          claim_window_hours?: number
          guarantee_bps?: number
          id?: boolean
          min_inspection_photos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      money_policy_commission_rates: {
        Row: {
          cap_minor: number | null
          cap_threshold_minor: number | null
          commission_bps: number
          created_at: string
          id: number
          policy_version_id: number
          property_type: Database["public"]["Enums"]["property_type"]
        }
        Insert: {
          cap_minor?: number | null
          cap_threshold_minor?: number | null
          commission_bps: number
          created_at?: string
          id?: never
          policy_version_id: number
          property_type: Database["public"]["Enums"]["property_type"]
        }
        Update: {
          cap_minor?: number | null
          cap_threshold_minor?: number | null
          commission_bps?: number
          created_at?: string
          id?: never
          policy_version_id?: number
          property_type?: Database["public"]["Enums"]["property_type"]
        }
        Relationships: [
          {
            foreignKeyName: "money_policy_commission_rates_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "money_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      money_policy_versions: {
        Row: {
          commission_bps: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          guarantee_bps: number
          id: number
          note: string
          vat_bps: number
          vat_registered: boolean
          version: string
          withdrawal_min_minor: number
        }
        Insert: {
          commission_bps: number
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          guarantee_bps: number
          id?: never
          note: string
          vat_bps: number
          vat_registered: boolean
          version: string
          withdrawal_min_minor: number
        }
        Update: {
          commission_bps?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          guarantee_bps?: number
          id?: never
          note?: string
          vat_bps?: number
          vat_registered?: boolean
          version?: string
          withdrawal_min_minor?: number
        }
        Relationships: []
      }
      money_policy_withdrawal_bands: {
        Row: {
          confirmed: boolean
          created_at: string
          fee_bps: number | null
          fee_cap_minor: number | null
          flat_fee_minor: number | null
          from_minor: number
          id: number
          note: string | null
          policy_version_id: number
          to_minor: number | null
        }
        Insert: {
          confirmed: boolean
          created_at?: string
          fee_bps?: number | null
          fee_cap_minor?: number | null
          flat_fee_minor?: number | null
          from_minor: number
          id?: never
          note?: string | null
          policy_version_id: number
          to_minor?: number | null
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          fee_bps?: number | null
          fee_cap_minor?: number | null
          flat_fee_minor?: number | null
          from_minor?: number
          id?: never
          note?: string | null
          policy_version_id?: number
          to_minor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "money_policy_withdrawal_bands_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "money_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      money_step_ups: {
        Row: {
          created_at: string
          digest: string
          expires_at: string
          id: string
          method: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          digest: string
          expires_at?: string
          id?: string
          method: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          digest?: string
          expires_at?: string
          id?: string
          method?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      move_in_quotes: {
        Row: {
          agency_minor: number | null
          agreement_minor: number | null
          caution_minor: number | null
          currency: string
          inspection_id: string
          legal_minor: number | null
          lister_id: string
          listing_id: string
          quoted_at: string
          rent_minor: number | null
          rent_period: Database["public"]["Enums"]["rent_period"]
          service_minor: number | null
          tenant_id: string
          total_minor: number
          total_stated: boolean
        }
        Insert: {
          agency_minor?: number | null
          agreement_minor?: number | null
          caution_minor?: number | null
          currency?: string
          inspection_id: string
          legal_minor?: number | null
          lister_id: string
          listing_id: string
          quoted_at?: string
          rent_minor?: number | null
          rent_period?: Database["public"]["Enums"]["rent_period"]
          service_minor?: number | null
          tenant_id: string
          total_minor: number
          total_stated: boolean
        }
        Update: {
          agency_minor?: number | null
          agreement_minor?: number | null
          caution_minor?: number | null
          currency?: string
          inspection_id?: string
          legal_minor?: number | null
          lister_id?: string
          listing_id?: string
          quoted_at?: string
          rent_minor?: number | null
          rent_period?: Database["public"]["Enums"]["rent_period"]
          service_minor?: number | null
          tenant_id?: string
          total_minor?: number
          total_stated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "move_in_quotes_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: true
            referencedRelation: "inspection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_in_quotes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "move_in_quotes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "move_in_quotes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "move_in_quotes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mutes: {
        Row: {
          created_at: string
          target_id: string
          target_kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          target_id: string
          target_kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          target_id?: string
          target_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      ng_public_holidays: {
        Row: {
          day: string
          estimated: boolean
          name: string
        }
        Insert: {
          day: string
          estimated?: boolean
          name: string
        }
        Update: {
          day?: string
          estimated?: boolean
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          href: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          severity: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          severity?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          severity?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      occupations: {
        Row: {
          category: string
          code: string
          common_rank: number | null
          name: string
          sort_order: number
        }
        Insert: {
          category: string
          code: string
          common_rank?: number | null
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          code?: string
          common_rank?: number | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      owner_heartbeats: {
        Row: {
          answer: string | null
          answered_at: string | null
          asked_at: string
          id: string
          listing_id: string
          owner_user: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          asked_at?: string
          id?: string
          listing_id: string
          owner_user: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          asked_at?: string
          id?: string
          listing_id?: string
          owner_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_heartbeats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "owner_heartbeats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "owner_heartbeats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "owner_heartbeats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      payluk_commission_sweeps: {
        Row: {
          currency: string | null
          environment: string
          error_code: string | null
          error_detail: string | null
          escrow_balance_minor: number | null
          finished_at: string | null
          id: string
          main_balance_minor: number | null
          outcome: string
          rate_limit_remaining: number | null
          started_at: string
          withdrawal_minor: number | null
          withdrawal_reference: string | null
        }
        Insert: {
          currency?: string | null
          environment: string
          error_code?: string | null
          error_detail?: string | null
          escrow_balance_minor?: number | null
          finished_at?: string | null
          id?: string
          main_balance_minor?: number | null
          outcome: string
          rate_limit_remaining?: number | null
          started_at?: string
          withdrawal_minor?: number | null
          withdrawal_reference?: string | null
        }
        Update: {
          currency?: string | null
          environment?: string
          error_code?: string | null
          error_detail?: string | null
          escrow_balance_minor?: number | null
          finished_at?: string | null
          id?: string
          main_balance_minor?: number | null
          outcome?: string
          rate_limit_remaining?: number | null
          started_at?: string
          withdrawal_minor?: number | null
          withdrawal_reference?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          authorization_code: string
          bank: string | null
          bin: string | null
          card_type: string | null
          channel: string | null
          created_at: string
          deleted_at: string | null
          email_used: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          provider: string
          reusable: boolean
          signature: string
          updated_at: string
          user_id: string
        }
        Insert: {
          authorization_code: string
          bank?: string | null
          bin?: string | null
          card_type?: string | null
          channel?: string | null
          created_at?: string
          deleted_at?: string | null
          email_used: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          provider?: string
          reusable: boolean
          signature: string
          updated_at?: string
          user_id: string
        }
        Update: {
          authorization_code?: string
          bank?: string | null
          bin?: string | null
          card_type?: string | null
          channel?: string | null
          created_at?: string
          deleted_at?: string | null
          email_used?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          provider?: string
          reusable?: boolean
          signature?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_rail_policy: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          lister_kind: Database["public"]["Enums"]["agent_type"] | null
          listing_intent: Database["public"]["Enums"]["listing_intent"] | null
          milestones: boolean
          precedence: number
          property_type: Database["public"]["Enums"]["property_type"] | null
          rail: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          lister_kind?: Database["public"]["Enums"]["agent_type"] | null
          listing_intent?: Database["public"]["Enums"]["listing_intent"] | null
          milestones?: boolean
          precedence?: number
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rail: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          lister_kind?: Database["public"]["Enums"]["agent_type"] | null
          listing_intent?: Database["public"]["Enums"]["listing_intent"] | null
          milestones?: boolean
          precedence?: number
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rail?: string
          reason?: string
        }
        Relationships: []
      }
      payout_accounts: {
        Row: {
          account_name: string
          account_number: string
          agent_id: string
          bank_code: string | null
          bank_name: string
          created_at: string
          id: string
          is_default: boolean
          paystack_subaccount_code: string | null
          recipient_code: string | null
          resolved_account_name: string | null
          resolved_at: string | null
          subaccount_created_at: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          agent_id: string
          bank_code?: string | null
          bank_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          paystack_subaccount_code?: string | null
          recipient_code?: string | null
          resolved_account_name?: string | null
          resolved_at?: string | null
          subaccount_created_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          agent_id?: string
          bank_code?: string | null
          bank_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          paystack_subaccount_code?: string | null
          recipient_code?: string | null
          resolved_account_name?: string | null
          resolved_at?: string | null
          subaccount_created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      pep_clear_approvals: {
        Row: {
          approved_at: string
          approved_by: string | null
          flag_id: string
          id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          flag_id: string
          id?: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          flag_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pep_clear_approvals_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: true
            referencedRelation: "pep_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      pep_declarations: {
        Row: {
          asked_at: string
          declared_at: string
          id: string
          is_pep: boolean
          relation: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          asked_at: string
          declared_at?: string
          id?: string
          is_pep: boolean
          relation?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          asked_at?: string
          declared_at?: string
          id?: string
          is_pep?: boolean
          relation?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pep_flags: {
        Row: {
          flagged: boolean
          id: string
          note: string
          relation: string | null
          role: string | null
          set_at: string
          set_by: string | null
          user_id: string | null
        }
        Insert: {
          flagged: boolean
          id?: string
          note: string
          relation?: string | null
          role?: string | null
          set_at?: string
          set_by?: string | null
          user_id?: string | null
        }
        Update: {
          flagged?: boolean
          id?: string
          note?: string
          relation?: string | null
          role?: string | null
          set_at?: string
          set_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      platform_revenue: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          escrow_id: string | null
          id: string
          listing_id: string | null
          metadata: Json
          rate_id: string | null
          reference: string
          source: Database["public"]["Enums"]["revenue_source"]
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          escrow_id?: string | null
          id?: string
          listing_id?: string | null
          metadata?: Json
          rate_id?: string | null
          reference: string
          source: Database["public"]["Enums"]["revenue_source"]
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          escrow_id?: string | null
          id?: string
          listing_id?: string | null
          metadata?: Json
          rate_id?: string | null
          reference?: string
          source?: Database["public"]["Enums"]["revenue_source"]
        }
        Relationships: [
          {
            foreignKeyName: "platform_revenue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "platform_revenue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "platform_revenue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "platform_revenue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_revenue_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "fee_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          height: number | null
          id: string
          position: number
          post_id: string
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          post_id: string
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          post_id?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          mark: Database["public"]["Enums"]["post_mark"]
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mark: Database["public"]["Enums"]["post_mark"]
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          mark?: Database["public"]["Enums"]["post_mark"]
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reposts: {
        Row: {
          area_id: string | null
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reposts_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          post_id: string
          seen_on: string
          viewer_bucket: string
        }
        Insert: {
          post_id: string
          seen_on?: string
          viewer_bucket: string
        }
        Update: {
          post_id?: string
          seen_on?: string
          viewer_bucket?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          allow_quotes: boolean
          area_id: string | null
          author_id: string | null
          author_kind: Database["public"]["Enums"]["post_author_kind"]
          body: string | null
          created_at: string
          depth: number
          edited_at: string | null
          hidden_by: string | null
          hold_reason: string | null
          id: string
          kind: Database["public"]["Enums"]["post_kind"]
          like_count: number
          listing_id: string | null
          parent_id: string | null
          payload: Json | null
          quoted_post_id: string | null
          removed_at: string | null
          reply_count: number
          repost_count: number
          root_id: string | null
          status: Database["public"]["Enums"]["social_status"]
          view_count: number
        }
        Insert: {
          allow_quotes?: boolean
          area_id?: string | null
          author_id?: string | null
          author_kind?: Database["public"]["Enums"]["post_author_kind"]
          body?: string | null
          created_at?: string
          depth?: number
          edited_at?: string | null
          hidden_by?: string | null
          hold_reason?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["post_kind"]
          like_count?: number
          listing_id?: string | null
          parent_id?: string | null
          payload?: Json | null
          quoted_post_id?: string | null
          removed_at?: string | null
          reply_count?: number
          repost_count?: number
          root_id?: string | null
          status?: Database["public"]["Enums"]["social_status"]
          view_count?: number
        }
        Update: {
          allow_quotes?: boolean
          area_id?: string | null
          author_id?: string | null
          author_kind?: Database["public"]["Enums"]["post_author_kind"]
          body?: string | null
          created_at?: string
          depth?: number
          edited_at?: string | null
          hidden_by?: string | null
          hold_reason?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["post_kind"]
          like_count?: number
          listing_id?: string | null
          parent_id?: string | null
          payload?: Json | null
          quoted_post_id?: string | null
          removed_at?: string | null
          reply_count?: number
          repost_count?: number
          root_id?: string | null
          status?: Database["public"]["Enums"]["social_status"]
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_quoted_post_id_fkey"
            columns: ["quoted_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      price_check_events: {
        Row: {
          bedrooms: number | null
          check_id: string
          comparable_count: number | null
          confidence: string | null
          created_at: string
          dispersion: number | null
          entry_point: string | null
          geohash5: string | null
          id: string
          intent_chosen: string | null
          lga_code: string | null
          listing_id: string | null
          listing_intent: Database["public"]["Enums"]["listing_intent"] | null
          outcome: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          radius_m: number | null
          refusal_code: string | null
          size_stated: boolean | null
          stage: string
          state_code: string | null
          user_id: string | null
        }
        Insert: {
          bedrooms?: number | null
          check_id: string
          comparable_count?: number | null
          confidence?: string | null
          created_at?: string
          dispersion?: number | null
          entry_point?: string | null
          geohash5?: string | null
          id?: string
          intent_chosen?: string | null
          lga_code?: string | null
          listing_id?: string | null
          listing_intent?: Database["public"]["Enums"]["listing_intent"] | null
          outcome?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          radius_m?: number | null
          refusal_code?: string | null
          size_stated?: boolean | null
          stage: string
          state_code?: string | null
          user_id?: string | null
        }
        Update: {
          bedrooms?: number | null
          check_id?: string
          comparable_count?: number | null
          confidence?: string | null
          created_at?: string
          dispersion?: number | null
          entry_point?: string | null
          geohash5?: string | null
          id?: string
          intent_chosen?: string | null
          lga_code?: string | null
          listing_id?: string | null
          listing_intent?: Database["public"]["Enums"]["listing_intent"] | null
          outcome?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          radius_m?: number | null
          refusal_code?: string | null
          size_stated?: boolean | null
          stage?: string
          state_code?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_check_events_lga_code_fkey"
            columns: ["lga_code"]
            isOneToOne: false
            referencedRelation: "local_governments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_check_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "price_check_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "price_check_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "price_check_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_check_events_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      price_check_shares: {
        Row: {
          area: string | null
          bedrooms: number | null
          created_at: string
          created_by: string | null
          high_minor: number
          id: string
          lga_code: string | null
          listing_count: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          low_minor: number
          mid_minor: number
          newest_at: string | null
          oldest_at: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          scope: Database["public"]["Enums"]["price_check_share_scope"]
          state_code: string
        }
        Insert: {
          area?: string | null
          bedrooms?: number | null
          created_at?: string
          created_by?: string | null
          high_minor: number
          id?: string
          lga_code?: string | null
          listing_count: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          low_minor: number
          mid_minor: number
          newest_at?: string | null
          oldest_at?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          scope: Database["public"]["Enums"]["price_check_share_scope"]
          state_code: string
        }
        Update: {
          area?: string | null
          bedrooms?: number | null
          created_at?: string
          created_by?: string | null
          high_minor?: number
          id?: string
          lga_code?: string | null
          listing_count?: number
          listing_intent?: Database["public"]["Enums"]["listing_intent"]
          low_minor?: number
          mid_minor?: number
          newest_at?: string | null
          oldest_at?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          scope?: Database["public"]["Enums"]["price_check_share_scope"]
          state_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_check_shares_lga_code_fkey"
            columns: ["lga_code"]
            isOneToOne: false
            referencedRelation: "local_governments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_check_shares_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      price_check_watches: {
        Row: {
          answered_at: string | null
          area: string | null
          bedrooms: number | null
          checked_at: string | null
          created_at: string
          id: string
          lat: number
          lga_code: string | null
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          lng: number
          notified_at: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          state_code: string | null
          user_id: string
        }
        Insert: {
          answered_at?: string | null
          area?: string | null
          bedrooms?: number | null
          checked_at?: string | null
          created_at?: string
          id?: string
          lat: number
          lga_code?: string | null
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          lng: number
          notified_at?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          state_code?: string | null
          user_id: string
        }
        Update: {
          answered_at?: string | null
          area?: string | null
          bedrooms?: number | null
          checked_at?: string | null
          created_at?: string
          id?: string
          lat?: number
          lga_code?: string | null
          listing_intent?: Database["public"]["Enums"]["listing_intent"]
          lng?: number
          notified_at?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          state_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_check_watches_lga_code_fkey"
            columns: ["lga_code"]
            isOneToOne: false
            referencedRelation: "local_governments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_check_watches_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      principal_asks: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_via: string | null
          created_at: string
          expires_at: string | null
          id: string
          inspection_id: string | null
          listing_id: string
          mandate_id: string
          note: string | null
          purpose: string
          reason: string
          rent_payment_id: string | null
          reply_code: string | null
          sent_at: string | null
          token_hash: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_via?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          inspection_id?: string | null
          listing_id: string
          mandate_id: string
          note?: string | null
          purpose: string
          reason: string
          rent_payment_id?: string | null
          reply_code?: string | null
          sent_at?: string | null
          token_hash?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_via?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          inspection_id?: string | null
          listing_id?: string
          mandate_id?: string
          note?: string | null
          purpose?: string
          reason?: string
          rent_payment_id?: string | null
          reply_code?: string | null
          sent_at?: string | null
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "principal_asks_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "principal_asks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "principal_asks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "principal_asks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "principal_asks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "principal_asks_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "listing_mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "principal_asks_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      principal_messages: {
        Row: {
          ask_id: string
          body: string
          channel: string
          created_at: string
          finished_at: string | null
          id: string
          mandate_id: string
          status: string
          transport_ref: string | null
        }
        Insert: {
          ask_id: string
          body: string
          channel: string
          created_at?: string
          finished_at?: string | null
          id?: string
          mandate_id: string
          status?: string
          transport_ref?: string | null
        }
        Update: {
          ask_id?: string
          body?: string
          channel?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          mandate_id?: string
          status?: string
          transport_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "principal_messages_ask_id_fkey"
            columns: ["ask_id"]
            isOneToOne: false
            referencedRelation: "principal_asks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "principal_messages_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "listing_mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          interests: Database["public"]["Enums"]["property_type"][]
          lga_code: string | null
          locale: Database["public"]["Enums"]["locale"]
          nickname: string | null
          occupation_code: string | null
          phone: string | null
          settings: Json
          signup_role: Database["public"]["Enums"]["signup_role"] | null
          state_code: string | null
          surname: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          welcomed_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          interests?: Database["public"]["Enums"]["property_type"][]
          lga_code?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          nickname?: string | null
          occupation_code?: string | null
          phone?: string | null
          settings?: Json
          signup_role?: Database["public"]["Enums"]["signup_role"] | null
          state_code?: string | null
          surname?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          welcomed_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          interests?: Database["public"]["Enums"]["property_type"][]
          lga_code?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          nickname?: string | null
          occupation_code?: string | null
          phone?: string | null
          settings?: Json
          signup_role?: Database["public"]["Enums"]["signup_role"] | null
          state_code?: string | null
          surname?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          welcomed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_lga_code_fkey"
            columns: ["lga_code"]
            isOneToOne: false
            referencedRelation: "local_governments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profiles_occupation_code_fkey"
            columns: ["occupation_code"]
            isOneToOne: false
            referencedRelation: "occupations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profiles_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      properties: {
        Row: {
          area: string | null
          bedrooms: number | null
          created_at: string
          created_by: string | null
          id: string
          location: unknown
          principal_key: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          state_code: string | null
        }
        Insert: {
          area?: string | null
          bedrooms?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: unknown
          principal_key?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          state_code?: string | null
        }
        Update: {
          area?: string | null
          bedrooms?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: unknown
          principal_key?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          state_code?: string | null
        }
        Relationships: []
      }
      property_decisions: {
        Row: {
          decided_at: string
          decided_by: string | null
          decision: string
          id: string
          listing_id: string
          other_listing_id: string | null
          property_id: string | null
          signals: Json
        }
        Insert: {
          decided_at?: string
          decided_by?: string | null
          decision: string
          id?: string
          listing_id: string
          other_listing_id?: string | null
          property_id?: string | null
          signals?: Json
        }
        Update: {
          decided_at?: string
          decided_by?: string | null
          decision?: string
          id?: string
          listing_id?: string
          other_listing_id?: string | null
          property_id?: string | null
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "property_decisions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "property_decisions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "property_decisions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "property_decisions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_decisions_other_listing_id_fkey"
            columns: ["other_listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "property_decisions_other_listing_id_fkey"
            columns: ["other_listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "property_decisions_other_listing_id_fkey"
            columns: ["other_listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "property_decisions_other_listing_id_fkey"
            columns: ["other_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_decisions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_arrangement_events: {
        Row: {
          arrangement_id: string
          detail: Json
          from_status: string | null
          id: number
          observed_at: string
          provider_event_key: string | null
          provider_state: string | null
          provider_status: string | null
          refused: boolean
          source: string
          to_status: string
        }
        Insert: {
          arrangement_id: string
          detail?: Json
          from_status?: string | null
          id?: never
          observed_at?: string
          provider_event_key?: string | null
          provider_state?: string | null
          provider_status?: string | null
          refused?: boolean
          source: string
          to_status: string
        }
        Update: {
          arrangement_id?: string
          detail?: Json
          from_status?: string | null
          id?: never
          observed_at?: string
          provider_event_key?: string | null
          provider_state?: string | null
          provider_status?: string | null
          refused?: boolean
          source?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_arrangement_events_arrangement_id_fkey"
            columns: ["arrangement_id"]
            isOneToOne: false
            referencedRelation: "provider_arrangements"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_arrangement_milestones: {
        Row: {
          amount_minor: number
          arrangement_id: string
          description: string | null
          id: string
          position: number
          provider_milestone_id: string | null
          provider_status: string | null
          release_requested_at: string | null
          released_at: string | null
          status: string
          title: string
        }
        Insert: {
          amount_minor: number
          arrangement_id: string
          description?: string | null
          id?: string
          position: number
          provider_milestone_id?: string | null
          provider_status?: string | null
          release_requested_at?: string | null
          released_at?: string | null
          status?: string
          title: string
        }
        Update: {
          amount_minor?: number
          arrangement_id?: string
          description?: string | null
          id?: string
          position?: number
          provider_milestone_id?: string | null
          provider_status?: string | null
          release_requested_at?: string | null
          released_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_arrangement_milestones_arrangement_id_fkey"
            columns: ["arrangement_id"]
            isOneToOne: false
            referencedRelation: "provider_arrangements"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_arrangements: {
        Row: {
          agreement_id: string
          amount_minor: number
          buyer_customer_id: string
          buyer_user_id: string
          created_at: string
          currency: string
          id: string
          kind: string
          provider: string
          provider_arrangement_id: string | null
          provider_fee_minor: number | null
          provider_payment_token: string | null
          provider_state: string | null
          provider_status: string | null
          reference: string
          release_pause_reason: string | null
          release_paused_at: string | null
          release_paused_by: string | null
          seller_customer_id: string
          seller_user_id: string
          status: string
          status_observed_at: string
          status_source: string
          updated_at: string
          who_pays_fee: string
        }
        Insert: {
          agreement_id: string
          amount_minor: number
          buyer_customer_id: string
          buyer_user_id: string
          created_at?: string
          currency?: string
          id?: string
          kind: string
          provider?: string
          provider_arrangement_id?: string | null
          provider_fee_minor?: number | null
          provider_payment_token?: string | null
          provider_state?: string | null
          provider_status?: string | null
          reference: string
          release_pause_reason?: string | null
          release_paused_at?: string | null
          release_paused_by?: string | null
          seller_customer_id: string
          seller_user_id: string
          status?: string
          status_observed_at?: string
          status_source?: string
          updated_at?: string
          who_pays_fee?: string
        }
        Update: {
          agreement_id?: string
          amount_minor?: number
          buyer_customer_id?: string
          buyer_user_id?: string
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          provider?: string
          provider_arrangement_id?: string | null
          provider_fee_minor?: number | null
          provider_payment_token?: string | null
          provider_state?: string | null
          provider_status?: string | null
          reference?: string
          release_pause_reason?: string | null
          release_paused_at?: string | null
          release_paused_by?: string | null
          seller_customer_id?: string
          seller_user_id?: string
          status?: string
          status_observed_at?: string
          status_source?: string
          updated_at?: string
          who_pays_fee?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_arrangements_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "deal_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_webhook_events: {
        Row: {
          environment: string | null
          error: string | null
          event_key: string
          event_type: string
          id: number
          payload: Json
          processed_at: string | null
          processing_status: string
          provider: string
          received_at: string
          retry_count: number
          signature_valid: boolean
        }
        Insert: {
          environment?: string | null
          error?: string | null
          event_key: string
          event_type: string
          id?: never
          payload: Json
          processed_at?: string | null
          processing_status?: string
          provider: string
          received_at?: string
          retry_count?: number
          signature_valid: boolean
        }
        Update: {
          environment?: string | null
          error?: string | null
          event_key?: string
          event_type?: string
          id?: never
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          received_at?: string
          retry_count?: number
          signature_valid?: boolean
        }
        Relationships: []
      }
      push_deliveries: {
        Row: {
          attempted_at: string
          attempts: number
          device_ref: string
          id: string
          platform: Database["public"]["Enums"]["push_platform"]
          provider_error: string | null
          provider_message_id: string | null
          provider_status: number | null
          queue_id: string
          settled_at: string | null
          state: Database["public"]["Enums"]["push_delivery_state"]
          token_id: string
        }
        Insert: {
          attempted_at?: string
          attempts?: number
          device_ref: string
          id?: string
          platform: Database["public"]["Enums"]["push_platform"]
          provider_error?: string | null
          provider_message_id?: string | null
          provider_status?: number | null
          queue_id: string
          settled_at?: string | null
          state?: Database["public"]["Enums"]["push_delivery_state"]
          token_id: string
        }
        Update: {
          attempted_at?: string
          attempts?: number
          device_ref?: string
          id?: string
          platform?: Database["public"]["Enums"]["push_platform"]
          provider_error?: string | null
          provider_message_id?: string | null
          provider_status?: number | null
          queue_id?: string
          settled_at?: string | null
          state?: Database["public"]["Enums"]["push_delivery_state"]
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "push_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_deliveries_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      push_queue: {
        Row: {
          attempts: number
          claim_token: string | null
          claimed_at: string | null
          collapsed_into: string | null
          created_at: string
          expires_at: string
          id: string
          last_error: string | null
          not_before: string
          notification_id: string
          outcome: Database["public"]["Enums"]["push_queue_outcome"] | null
          settled_at: string | null
          state: Database["public"]["Enums"]["push_queue_state"]
          user_id: string
        }
        Insert: {
          attempts?: number
          claim_token?: string | null
          claimed_at?: string | null
          collapsed_into?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          not_before?: string
          notification_id: string
          outcome?: Database["public"]["Enums"]["push_queue_outcome"] | null
          settled_at?: string | null
          state?: Database["public"]["Enums"]["push_queue_state"]
          user_id: string
        }
        Update: {
          attempts?: number
          claim_token?: string | null
          claimed_at?: string | null
          collapsed_into?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          not_before?: string
          notification_id?: string
          outcome?: Database["public"]["Enums"]["push_queue_outcome"] | null
          settled_at?: string | null
          state?: Database["public"]["Enums"]["push_queue_state"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_queue_collapsed_into_fkey"
            columns: ["collapsed_into"]
            isOneToOne: false
            referencedRelation: "push_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_queue_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          app_version: string | null
          auth: string | null
          created_at: string
          device_label: string | null
          device_ref: string
          failure_streak: number
          id: string
          last_seen_at: string
          p256dh: string | null
          platform: Database["public"]["Enums"]["push_platform"]
          revoked_at: string | null
          revoked_reason:
            | Database["public"]["Enums"]["push_revoked_reason"]
            | null
          token: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          auth?: string | null
          created_at?: string
          device_label?: string | null
          device_ref?: string
          failure_streak?: number
          id?: string
          last_seen_at?: string
          p256dh?: string | null
          platform: Database["public"]["Enums"]["push_platform"]
          revoked_at?: string | null
          revoked_reason?:
            | Database["public"]["Enums"]["push_revoked_reason"]
            | null
          token: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          auth?: string | null
          created_at?: string
          device_label?: string | null
          device_ref?: string
          failure_streak?: number
          id?: string
          last_seen_at?: string
          p256dh?: string | null
          platform?: Database["public"]["Enums"]["push_platform"]
          revoked_at?: string | null
          revoked_reason?:
            | Database["public"]["Enums"]["push_revoked_reason"]
            | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_accounts: {
        Row: {
          added_at: string
          label: string
          reason: string
          user_id: string
        }
        Insert: {
          added_at?: string
          label: string
          reason: string
          user_id: string
        }
        Update: {
          added_at?: string
          label?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      queue_claims: {
        Row: {
          claimed_at: string
          claimed_by: string
          item_id: string
          kind: string
          touched_at: string
        }
        Insert: {
          claimed_at?: string
          claimed_by: string
          item_id: string
          kind: string
          touched_at?: string
        }
        Update: {
          claimed_at?: string
          claimed_by?: string
          item_id?: string
          kind?: string
          touched_at?: string
        }
        Relationships: []
      }
      rate_calendar: {
        Row: {
          closed: boolean
          date: string
          host_closed: boolean
          import_closed: boolean
          rate_minor: number | null
          rate_plan_id: string
        }
        Insert: {
          closed?: boolean
          date: string
          host_closed?: boolean
          import_closed?: boolean
          rate_minor?: number | null
          rate_plan_id: string
        }
        Update: {
          closed?: boolean
          date?: string
          host_closed?: boolean
          import_closed?: boolean
          rate_minor?: number | null
          rate_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_calendar_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          subject: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          subject: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          subject?: string
          window_start?: string
        }
        Relationships: []
      }
      rate_plans: {
        Row: {
          active: boolean
          cancellation_policy_id: string
          created_at: string
          currency: string
          id: string
          max_stay_nights: number | null
          meal_plan: Database["public"]["Enums"]["meal_plan"]
          min_stay_nights: number
          name: string
          rate_minor: number
          room_type_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cancellation_policy_id: string
          created_at?: string
          currency?: string
          id?: string
          max_stay_nights?: number | null
          meal_plan?: Database["public"]["Enums"]["meal_plan"]
          min_stay_nights?: number
          name: string
          rate_minor: number
          room_type_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cancellation_policy_id?: string
          created_at?: string
          currency?: string
          id?: string
          max_stay_nights?: number | null
          meal_plan?: Database["public"]["Enums"]["meal_plan"]
          min_stay_nights?: number
          name?: string
          rate_minor?: number
          room_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_plans_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_plans_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_codes: {
        Row: {
          code_hash: string
          code_hint: string
          created_at: string
          id: string
          owner_id: string
          revoked_at: string | null
          subject_id: string
          subject_kind: string
        }
        Insert: {
          code_hash: string
          code_hint: string
          created_at?: string
          id?: string
          owner_id: string
          revoked_at?: string | null
          subject_id: string
          subject_kind: string
        }
        Update: {
          code_hash?: string
          code_hint?: string
          created_at?: string
          id?: string
          owner_id?: string
          revoked_at?: string | null
          subject_id?: string
          subject_kind?: string
        }
        Relationships: []
      }
      referral_budget_periods: {
        Row: {
          alerted_at: string | null
          cap_minor: number
          committed_minor: number
          created_at: string
          created_by: string | null
          period_month: string
          reason: string
          updated_at: string
        }
        Insert: {
          alerted_at?: string | null
          cap_minor: number
          committed_minor?: number
          created_at?: string
          created_by?: string | null
          period_month: string
          reason: string
          updated_at?: string
        }
        Update: {
          alerted_at?: string | null
          cap_minor?: number
          committed_minor?: number
          created_at?: string
          created_by?: string | null
          period_month?: string
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_budget_releases: {
        Row: {
          amount_minor: number
          campaign_id: string
          created_at: string
          member_id: string
          period_month: string
          reason: string
          referral_id: string
        }
        Insert: {
          amount_minor: number
          campaign_id: string
          created_at?: string
          member_id: string
          period_month: string
          reason: string
          referral_id: string
        }
        Update: {
          amount_minor?: number
          campaign_id?: string
          created_at?: string
          member_id?: string
          period_month?: string
          reason?: string
          referral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_budget_releases_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          kind: string
          member_cap_minor: number
          reason: string
          requirement_keys: string[]
          requirement_params: Json
          review_window: string
          reward_minor: number
          slug: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind: string
          member_cap_minor: number
          reason: string
          requirement_keys: string[]
          requirement_params?: Json
          review_window: string
          reward_minor: number
          slug: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          member_cap_minor?: number
          reason?: string
          requirement_keys?: string[]
          requirement_params?: Json
          review_window?: string
          reward_minor?: number
          slug?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: Json
          from_status: string | null
          id: string
          reason: string
          referral_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          from_status?: string | null
          id?: string
          reason: string
          referral_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          from_status?: string | null
          id?: string
          reason?: string
          referral_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_member_period_spend: {
        Row: {
          campaign_id: string
          committed_minor: number
          member_id: string
          period_month: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          committed_minor: number
          member_id: string
          period_month: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          committed_minor?: number
          member_id?: string
          period_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_member_period_spend_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_policy: {
        Row: {
          cluster_flag_score: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          hold_days: number
          id: string
          member_monthly_cap: number
          payouts_enabled: boolean
          platform_monthly_budget_minor: number
          reason: string
          review_risk_score: number
          reward_minor: number
          velocity_per_day: number
          withdrawal_min_minor: number
        }
        Insert: {
          cluster_flag_score?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          hold_days?: number
          id?: string
          member_monthly_cap: number
          payouts_enabled?: boolean
          platform_monthly_budget_minor: number
          reason: string
          review_risk_score?: number
          reward_minor: number
          velocity_per_day?: number
          withdrawal_min_minor: number
        }
        Update: {
          cluster_flag_score?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          hold_days?: number
          id?: string
          member_monthly_cap?: number
          payouts_enabled?: boolean
          platform_monthly_budget_minor?: number
          reason?: string
          review_risk_score?: number
          reward_minor?: number
          velocity_per_day?: number
          withdrawal_min_minor?: number
        }
        Relationships: []
      }
      referral_requirements: {
        Row: {
          check_function: string
          created_at: string
          description: string
          key: string
          takes_params: boolean
        }
        Insert: {
          check_function: string
          created_at?: string
          description: string
          key: string
          takes_params?: boolean
        }
        Update: {
          check_function?: string
          created_at?: string
          description?: string
          key?: string
          takes_params?: boolean
        }
        Relationships: []
      }
      referrals: {
        Row: {
          approved_at: string | null
          attributed_at: string
          available_at: string | null
          blocked_on: string | null
          campaign_id: string | null
          code: string
          id: string
          last_checked_at: string | null
          month: string | null
          payout_id: string | null
          period_month: string | null
          policy_id: string | null
          qualified_at: string | null
          qualifying_booking_id: string | null
          qualifying_tx_id: string | null
          referred_id: string
          referred_phone_key: string | null
          referrer_id: string
          review_reason: string | null
          review_until: string | null
          reward_minor: number | null
          risk_reasons: Json
          risk_score: number
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          attributed_at?: string
          available_at?: string | null
          blocked_on?: string | null
          campaign_id?: string | null
          code: string
          id?: string
          last_checked_at?: string | null
          month?: string | null
          payout_id?: string | null
          period_month?: string | null
          policy_id?: string | null
          qualified_at?: string | null
          qualifying_booking_id?: string | null
          qualifying_tx_id?: string | null
          referred_id: string
          referred_phone_key?: string | null
          referrer_id: string
          review_reason?: string | null
          review_until?: string | null
          reward_minor?: number | null
          risk_reasons?: Json
          risk_score?: number
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          attributed_at?: string
          available_at?: string | null
          blocked_on?: string | null
          campaign_id?: string | null
          code?: string
          id?: string
          last_checked_at?: string | null
          month?: string | null
          payout_id?: string | null
          period_month?: string | null
          policy_id?: string | null
          qualified_at?: string | null
          qualifying_booking_id?: string | null
          qualifying_tx_id?: string | null
          referred_id?: string
          referred_phone_key?: string | null
          referrer_id?: string
          review_reason?: string | null
          review_until?: string | null
          reward_minor?: number | null
          risk_reasons?: Json
          risk_score?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "referral_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "rewards_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "referral_policy"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_request_decisions: {
        Row: {
          decided_at: string
          decided_by: string
          decision: string
          note: string | null
          request_id: string
        }
        Insert: {
          decided_at?: string
          decided_by: string
          decision: string
          note?: string | null
          request_id: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          decision?: string
          note?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_request_decisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          booking_id: string
          due_by: string | null
          guest_id: string
          id: string
          note: string | null
          reason: string
          requested_at: string
        }
        Insert: {
          booking_id: string
          due_by?: string | null
          guest_id?: string
          id?: string
          note?: string | null
          reason: string
          requested_at?: string
        }
        Update: {
          booking_id?: string
          due_by?: string | null
          guest_id?: string
          id?: string
          note?: string | null
          reason?: string
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payment_contributors: {
        Row: {
          added_at: string
          added_by: string
          id: string
          rent_payment_id: string
          share_minor: number
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          id?: string
          rent_payment_id: string
          share_minor: number
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          id?: string
          rent_payment_id?: string
          share_minor?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payment_contributors_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payments: {
        Row: {
          agency_minor: number | null
          agreement_minor: number | null
          booking_id: string
          caution_minor: number | null
          created_at: string
          currency: string
          id: string
          inspection_id: string
          legal_minor: number | null
          lister_id: string
          listing_id: string
          move_in: string
          rent_minor: number | null
          rent_period: Database["public"]["Enums"]["rent_period"]
          service_minor: number | null
          tenant_id: string
          total_minor: number
          total_stated: boolean
          updated_at: string
        }
        Insert: {
          agency_minor?: number | null
          agreement_minor?: number | null
          booking_id: string
          caution_minor?: number | null
          created_at?: string
          currency?: string
          id?: string
          inspection_id: string
          legal_minor?: number | null
          lister_id: string
          listing_id: string
          move_in: string
          rent_minor?: number | null
          rent_period?: Database["public"]["Enums"]["rent_period"]
          service_minor?: number | null
          tenant_id: string
          total_minor: number
          total_stated?: boolean
          updated_at?: string
        }
        Update: {
          agency_minor?: number | null
          agreement_minor?: number | null
          booking_id?: string
          caution_minor?: number | null
          created_at?: string
          currency?: string
          id?: string
          inspection_id?: string
          legal_minor?: number | null
          lister_id?: string
          listing_id?: string
          move_in?: string
          rent_minor?: number | null
          rent_period?: Database["public"]["Enums"]["rent_period"]
          service_minor?: number | null
          tenant_id?: string
          total_minor?: number
          total_stated?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: true
            referencedRelation: "inspection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "rent_payments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "rent_payments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "rent_payments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_refunds_owed: {
        Row: {
          amount_minor: number
          booking_id: string
          cleared_at: string | null
          created_at: string
          lister_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          booking_id: string
          cleared_at?: string | null
          created_at?: string
          lister_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          booking_id?: string
          cleared_at?: string | null
          created_at?: string
          lister_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_refunds_owed_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_share_answers: {
        Row: {
          answer: string
          answered_at: string
          contributor_id: string
        }
        Insert: {
          answer: string
          answered_at?: string
          contributor_id: string
        }
        Update: {
          answer?: string
          answered_at?: string
          contributor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_share_answers_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: true
            referencedRelation: "rent_payment_contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_share_declines: {
        Row: {
          declined_at: string
          rent_payment_id: string
          user_id: string
        }
        Insert: {
          declined_at?: string
          rent_payment_id: string
          user_id: string
        }
        Update: {
          declined_at?: string
          rent_payment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_share_declines_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_share_notices: {
        Row: {
          rent_payment_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          rent_payment_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          rent_payment_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_share_notices_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_share_refunds: {
        Row: {
          amount_minor: number
          attempts: number
          claimed_at: string | null
          created_at: string
          id: string
          payer_id: string
          processor_refund_id: string | null
          processor_settled_at: string | null
          processor_status: string
          processor_submitted_at: string | null
          reason: string
          rent_payment_id: string
          transaction_id: string
        }
        Insert: {
          amount_minor: number
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          payer_id: string
          processor_refund_id?: string | null
          processor_settled_at?: string | null
          processor_status?: string
          processor_submitted_at?: string | null
          reason: string
          rent_payment_id: string
          transaction_id: string
        }
        Update: {
          amount_minor?: number
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          payer_id?: string
          processor_refund_id?: string | null
          processor_settled_at?: string | null
          processor_status?: string
          processor_submitted_at?: string | null
          reason?: string
          rent_payment_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_share_refunds_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_share_refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          category: string | null
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      reservation_deposits: {
        Row: {
          access_code: string | null
          amount_minor: number
          authorization_url: string | null
          commission_bps: number
          commission_minor: number
          created_at: string
          currency: string
          decided_at: string | null
          guest_id: string
          id: string
          lister_share_minor: number
          outcome_reason: string | null
          paid_at: string | null
          payee_subaccount_code: string
          payee_user_id: string
          paystack_mode: string | null
          processor_refund_id: string | null
          provider: string
          provider_ref: string
          refund_until: string
          reservation_id: string
          rule_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          amount_minor: number
          authorization_url?: string | null
          commission_bps: number
          commission_minor: number
          created_at?: string
          currency?: string
          decided_at?: string | null
          guest_id: string
          id?: string
          lister_share_minor: number
          outcome_reason?: string | null
          paid_at?: string | null
          payee_subaccount_code: string
          payee_user_id: string
          paystack_mode?: string | null
          processor_refund_id?: string | null
          provider?: string
          provider_ref: string
          refund_until: string
          reservation_id: string
          rule_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          amount_minor?: number
          authorization_url?: string | null
          commission_bps?: number
          commission_minor?: number
          created_at?: string
          currency?: string
          decided_at?: string | null
          guest_id?: string
          id?: string
          lister_share_minor?: number
          outcome_reason?: string | null
          paid_at?: string | null
          payee_subaccount_code?: string
          payee_user_id?: string
          paystack_mode?: string | null
          processor_refund_id?: string | null
          provider?: string
          provider_ref?: string
          refund_until?: string
          reservation_id?: string
          rule_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_deposits_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_deposits_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "restaurant_deposit_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          business_id: string | null
          conversation_id: string | null
          created_at: string
          guest_id: string
          id: string
          listing_id: string | null
          note: string | null
          party_size: number
          reserved_for: string
          responded_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          conversation_id?: string | null
          created_at?: string
          guest_id: string
          id?: string
          listing_id?: string | null
          note?: string | null
          party_size: number
          reserved_for: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          conversation_id?: string | null
          created_at?: string
          guest_id?: string
          id?: string
          listing_id?: string | null
          note?: string | null
          party_size?: number
          reserved_for?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_deposit_rules: {
        Row: {
          active: boolean
          amount_minor: number
          business_id: string
          created_at: string
          id: string
          min_party_size: number | null
          per_guest: boolean
          refund_until_hours: number
          service_window_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_minor: number
          business_id: string
          created_at?: string
          id?: string
          min_party_size?: number | null
          per_guest?: boolean
          refund_until_hours?: number
          service_window_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_minor?: number
          business_id?: string
          created_at?: string
          id?: string
          min_party_size?: number | null
          per_guest?: boolean
          refund_until_hours?: number
          service_window_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_deposit_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_deposit_rules_service_window_id_fkey"
            columns: ["service_window_id"]
            isOneToOne: false
            referencedRelation: "service_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_profiles: {
        Row: {
          business_id: string
          created_at: string
          cuisines: string[]
          dress_code: string | null
          menu_url: string | null
          outdoor: boolean
          parking: boolean
          power_backup: boolean
          price_band: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          cuisines?: string[]
          dress_code?: string | null
          menu_url?: string | null
          outdoor?: boolean
          parking?: boolean
          power_backup?: boolean
          price_band?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          cuisines?: string[]
          dress_code?: string | null
          menu_url?: string | null
          outdoor?: boolean
          parking?: boolean
          power_backup?: boolean
          price_band?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      review_contests: {
        Row: {
          created_at: string
          criterion: string
          decided_at: string | null
          decided_by: string | null
          id: string
          lister_id: string
          note: string | null
          public_note: string | null
          report_id: string | null
          review_id: string
          status: string
        }
        Insert: {
          created_at?: string
          criterion: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          lister_id: string
          note?: string | null
          public_note?: string | null
          report_id?: string | null
          review_id: string
          status?: string
        }
        Update: {
          created_at?: string
          criterion?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          lister_id?: string
          note?: string | null
          public_note?: string | null
          report_id?: string | null
          review_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_contests_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_contests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_contests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews_counted"
            referencedColumns: ["id"]
          },
        ]
      }
      review_responses: {
        Row: {
          agent_id: string | null
          body: string
          created_at: string
          responder_id: string | null
          review_id: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          body: string
          created_at?: string
          responder_id?: string | null
          review_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          body?: string
          created_at?: string
          responder_id?: string | null
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_responses_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews_counted"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          accommodation_id: string | null
          author_id: string
          author_label: string | null
          body: string | null
          booking_id: string
          created_at: string
          hidden_at: string | null
          hidden_note: string | null
          id: string
          listing_id: string | null
          rating: number
          updated_at: string
        }
        Insert: {
          accommodation_id?: string | null
          author_id: string
          author_label?: string | null
          body?: string | null
          booking_id: string
          created_at?: string
          hidden_at?: string | null
          hidden_note?: string | null
          id?: string
          listing_id?: string | null
          rating: number
          updated_at?: string
        }
        Update: {
          accommodation_id?: string | null
          author_id?: string
          author_label?: string | null
          body?: string | null
          booking_id?: string
          created_at?: string
          hidden_at?: string | null
          hidden_note?: string | null
          id?: string
          listing_id?: string | null
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards_ledger: {
        Row: {
          actor_id: string | null
          amount_minor: number
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          member_id: string
          payout_id: string | null
          reason: string
          referral_id: string | null
        }
        Insert: {
          actor_id?: string | null
          amount_minor: number
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          member_id: string
          payout_id?: string | null
          reason: string
          referral_id?: string | null
        }
        Update: {
          actor_id?: string | null
          amount_minor?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          member_id?: string
          payout_id?: string | null
          reason?: string
          referral_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rewards_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "rewards_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_ledger_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards_payouts: {
        Row: {
          account_key: string | null
          account_last4: string
          account_name: string
          amount_minor: number
          bank_code: string
          created_at: string
          failure_reason: string | null
          id: string
          member_id: string
          provider_status: string | null
          recipient_code: string | null
          reference: string
          risk_reasons: Json
          risk_score: number
          settled_at: string | null
          status: string
          transfer_code: string | null
          transfer_initiated_at: string | null
          updated_at: string
        }
        Insert: {
          account_key?: string | null
          account_last4: string
          account_name: string
          amount_minor: number
          bank_code: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          member_id: string
          provider_status?: string | null
          recipient_code?: string | null
          reference: string
          risk_reasons?: Json
          risk_score?: number
          settled_at?: string | null
          status?: string
          transfer_code?: string | null
          transfer_initiated_at?: string | null
          updated_at?: string
        }
        Update: {
          account_key?: string | null
          account_last4?: string
          account_name?: string
          amount_minor?: number
          bank_code?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          member_id?: string
          provider_status?: string | null
          recipient_code?: string | null
          reference?: string
          risk_reasons?: Json
          risk_score?: number
          settled_at?: string | null
          status?: string
          transfer_code?: string | null
          transfer_initiated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rewards_transfer_events: {
        Row: {
          amount_minor: number | null
          event: string
          id: string
          idempotency_key: string
          outcome: string
          payload: Json
          received_at: string
          reference: string
          transfer_code: string | null
        }
        Insert: {
          amount_minor?: number | null
          event: string
          id?: string
          idempotency_key: string
          outcome: string
          payload?: Json
          received_at?: string
          reference: string
          transfer_code?: string | null
        }
        Update: {
          amount_minor?: number | null
          event?: string
          id?: string
          idempotency_key?: string
          outcome?: string
          payload?: Json
          received_at?: string
          reference?: string
          transfer_code?: string | null
        }
        Relationships: []
      }
      risk_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
        }
        Relationships: []
      }
      risk_classes: {
        Row: {
          factors: Json
          id: string
          needs_approval: boolean
          reason: string | null
          reasons: string[]
          review_due_at: string
          risk_class: string
          set_at: string
          set_by: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          factors: Json
          id?: string
          needs_approval?: boolean
          reason?: string | null
          reasons?: string[]
          review_due_at: string
          risk_class: string
          set_at?: string
          set_by?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          factors?: Json
          id?: string
          needs_approval?: boolean
          reason?: string | null
          reasons?: string[]
          review_due_at?: string
          risk_class?: string
          set_at?: string
          set_by?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      risk_override_approvals: {
        Row: {
          approved_at: string
          approved_by: string | null
          id: string
          risk_class_id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          id?: string
          risk_class_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          id?: string
          risk_class_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_override_approvals_risk_class_id_fkey"
            columns: ["risk_class_id"]
            isOneToOne: true
            referencedRelation: "risk_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      room_inventory: {
        Row: {
          date: string
          room_type_id: string
          units_booked: number
          units_held_back: number
          units_open: number
          updated_at: string
        }
        Insert: {
          date: string
          room_type_id: string
          units_booked?: number
          units_held_back?: number
          units_open: number
          updated_at?: string
        }
        Update: {
          date?: string
          room_type_id?: string
          units_booked?: number
          units_held_back?: number
          units_open?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_inventory_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          accommodation_id: string
          base_rate_minor: number
          bedrooms: number | null
          beds: Json
          category: Database["public"]["Enums"]["room_category"]
          created_at: string
          currency: string
          description: string | null
          id: string
          is_demo: boolean
          name: string
          size_sqm: number | null
          sleeps: number
          status: Database["public"]["Enums"]["listing_status"]
          units_total: number
          updated_at: string
        }
        Insert: {
          accommodation_id: string
          base_rate_minor: number
          bedrooms?: number | null
          beds?: Json
          category: Database["public"]["Enums"]["room_category"]
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          size_sqm?: number | null
          sleeps: number
          status?: Database["public"]["Enums"]["listing_status"]
          units_total: number
          updated_at?: string
        }
        Update: {
          accommodation_id?: string
          base_rate_minor?: number
          bedrooms?: number | null
          beds?: Json
          category?: Database["public"]["Enums"]["room_category"]
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          size_sqm?: number | null
          sleeps?: number
          status?: Database["public"]["Enums"]["listing_status"]
          units_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
        ]
      }
      sanctions_delisting_flags: {
        Row: {
          hit_id: string
          id: string
          raised_at: string
          version_id: string
        }
        Insert: {
          hit_id: string
          id?: string
          raised_at?: string
          version_id: string
        }
        Update: {
          hit_id?: string
          id?: string
          raised_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanctions_delisting_flags_hit_id_fkey"
            columns: ["hit_id"]
            isOneToOne: false
            referencedRelation: "sanctions_hits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_delisting_flags_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "sanctions_list_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      sanctions_entries: {
        Row: {
          aliases: string[]
          dates_of_birth: string[]
          id: string
          kind: string
          listed_on: string | null
          names_normalised: string[]
          nationalities: string[]
          primary_name: string
          reference: string
          source: string
          version_id: string
        }
        Insert: {
          aliases?: string[]
          dates_of_birth?: string[]
          id?: string
          kind: string
          listed_on?: string | null
          names_normalised: string[]
          nationalities?: string[]
          primary_name: string
          reference: string
          source: string
          version_id: string
        }
        Update: {
          aliases?: string[]
          dates_of_birth?: string[]
          id?: string
          kind?: string
          listed_on?: string | null
          names_normalised?: string[]
          nationalities?: string[]
          primary_name?: string
          reference?: string
          source?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanctions_entries_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "sanctions_list_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      sanctions_hit_decisions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          decision: string
          hit_id: string
          id: string
          note: string
          proposed_at: string
          proposed_by: string
          rejected_at: string | null
          rejected_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          decision: string
          hit_id: string
          id?: string
          note: string
          proposed_at?: string
          proposed_by: string
          rejected_at?: string | null
          rejected_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          decision?: string
          hit_id?: string
          id?: string
          note?: string
          proposed_at?: string
          proposed_by?: string
          rejected_at?: string | null
          rejected_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sanctions_hit_decisions_hit_id_fkey"
            columns: ["hit_id"]
            isOneToOne: false
            referencedRelation: "sanctions_hits"
            referencedColumns: ["id"]
          },
        ]
      }
      sanctions_hits: {
        Row: {
          common_name: boolean
          created_at: string
          decided_at: string | null
          entry_id: string
          entry_reference: string
          id: string
          match_kind: string
          matched_name: string
          person_id: string
          score: number
          screened_name: string
          screening_id: string
          source: string
          status: string
        }
        Insert: {
          common_name?: boolean
          created_at?: string
          decided_at?: string | null
          entry_id: string
          entry_reference: string
          id?: string
          match_kind: string
          matched_name: string
          person_id: string
          score: number
          screened_name: string
          screening_id: string
          source: string
          status?: string
        }
        Update: {
          common_name?: boolean
          created_at?: string
          decided_at?: string | null
          entry_id?: string
          entry_reference?: string
          id?: string
          match_kind?: string
          matched_name?: string
          person_id?: string
          score?: number
          screened_name?: string
          screening_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanctions_hits_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "sanctions_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_hits_screening_id_fkey"
            columns: ["screening_id"]
            isOneToOne: false
            referencedRelation: "sanctions_screenings"
            referencedColumns: ["id"]
          },
        ]
      }
      sanctions_list_versions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          activation_proposed_at: string | null
          activation_proposed_by: string | null
          complete: boolean
          entry_count: number
          id: string
          loaded_at: string
          loaded_by: string | null
          origin: string
          previous_entries: number | null
          sha256: string
          source: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          activation_proposed_at?: string | null
          activation_proposed_by?: string | null
          complete?: boolean
          entry_count?: number
          id?: string
          loaded_at?: string
          loaded_by?: string | null
          origin: string
          previous_entries?: number | null
          sha256: string
          source: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          activation_proposed_at?: string | null
          activation_proposed_by?: string | null
          complete?: boolean
          entry_count?: number
          id?: string
          loaded_at?: string
          loaded_by?: string | null
          origin?: string
          previous_entries?: number | null
          sha256?: string
          source?: string
        }
        Relationships: []
      }
      sanctions_screen_queue: {
        Row: {
          done_at: string | null
          enqueued_at: string
          id: number
          person_id: string | null
          subject_kind: string
          taken_at: string | null
          transaction_id: string | null
          transaction_kind: string | null
          trigger: string
        }
        Insert: {
          done_at?: string | null
          enqueued_at?: string
          id?: never
          person_id?: string | null
          subject_kind: string
          taken_at?: string | null
          transaction_id?: string | null
          transaction_kind?: string | null
          trigger: string
        }
        Update: {
          done_at?: string | null
          enqueued_at?: string
          id?: never
          person_id?: string | null
          subject_kind?: string
          taken_at?: string | null
          transaction_id?: string | null
          transaction_kind?: string | null
          trigger?: string
        }
        Relationships: []
      }
      sanctions_screenings: {
        Row: {
          best_score: number | null
          id: string
          matches: Json
          names_screened: string[]
          ng_version_id: string | null
          outcome: string
          person_id: string | null
          screened_at: string
          screened_by: string | null
          subject_kind: string
          transaction_id: string | null
          transaction_kind: string | null
          trigger: string
          un_version_id: string | null
        }
        Insert: {
          best_score?: number | null
          id?: string
          matches?: Json
          names_screened?: string[]
          ng_version_id?: string | null
          outcome: string
          person_id?: string | null
          screened_at?: string
          screened_by?: string | null
          subject_kind: string
          transaction_id?: string | null
          transaction_kind?: string | null
          trigger: string
          un_version_id?: string | null
        }
        Update: {
          best_score?: number | null
          id?: string
          matches?: Json
          names_screened?: string[]
          ng_version_id?: string | null
          outcome?: string
          person_id?: string | null
          screened_at?: string
          screened_by?: string | null
          subject_kind?: string
          transaction_id?: string | null
          transaction_kind?: string | null
          trigger?: string
          un_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sanctions_screenings_ng_version_id_fkey"
            columns: ["ng_version_id"]
            isOneToOne: false
            referencedRelation: "sanctions_list_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_screenings_un_version_id_fkey"
            columns: ["un_version_id"]
            isOneToOne: false
            referencedRelation: "sanctions_list_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "saved_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "saved_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "saved_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_places: {
        Row: {
          created_at: string
          entity_id: string
          entity_kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          alert_checked_at: string | null
          alert_cursor_at: string | null
          alert_enabled: boolean
          alert_notified_at: string | null
          created_at: string
          id: string
          label: string | null
          query: Json
          query_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_checked_at?: string | null
          alert_cursor_at?: string | null
          alert_enabled?: boolean
          alert_notified_at?: string | null
          created_at?: string
          id?: string
          label?: string | null
          query?: Json
          query_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_checked_at?: string | null
          alert_cursor_at?: string | null
          alert_enabled?: boolean
          alert_notified_at?: string | null
          created_at?: string
          id?: string
          label?: string | null
          query?: Json
          query_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scam_recalls: {
        Row: {
          category: string
          recipients: number
          report_id: string | null
          sent_at: string
          sent_by: string
          suspension_id: string
        }
        Insert: {
          category: string
          recipients?: number
          report_id?: string | null
          sent_at?: string
          sent_by: string
          suspension_id: string
        }
        Update: {
          category?: string
          recipients?: number
          report_id?: string | null
          sent_at?: string
          sent_by?: string
          suspension_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scam_recalls_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scam_recalls_suspension_id_fkey"
            columns: ["suspension_id"]
            isOneToOne: true
            referencedRelation: "agent_suspensions"
            referencedColumns: ["id"]
          },
        ]
      }
      search_demand_events: {
        Row: {
          area_key: string | null
          bedrooms_min: number | null
          budget_band: number | null
          id: number
          market: string
          person_hash: string
          results_band: number
          state_code: string | null
          week: string
        }
        Insert: {
          area_key?: string | null
          bedrooms_min?: number | null
          budget_band?: number | null
          id?: never
          market: string
          person_hash: string
          results_band: number
          state_code?: string | null
          week: string
        }
        Update: {
          area_key?: string | null
          bedrooms_min?: number | null
          budget_band?: number | null
          id?: never
          market?: string
          person_hash?: string
          results_band?: number
          state_code?: string | null
          week?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_demand_events_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      service_windows: {
        Row: {
          business_id: string
          closes: string
          covers: number
          created_at: string
          id: string
          last_seating: string
          opens: string
          updated_at: string
          weekday: number
        }
        Insert: {
          business_id: string
          closes: string
          covers: number
          created_at?: string
          id?: string
          last_seating: string
          opens: string
          updated_at?: string
          weekday: number
        }
        Update: {
          business_id?: string
          closes?: string
          covers?: number
          created_at?: string
          id?: string
          last_seating?: string
          opens?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_windows_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          created_by: string | null
          kind: string
          opens: number
          revoked_at: string | null
          target_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          kind: string
          opens?: number
          revoked_at?: string | null
          target_id: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          kind?: string
          opens?: number
          revoked_at?: string | null
          target_id?: string
          token?: string
        }
        Relationships: []
      }
      show_me_requests: {
        Row: {
          answered_at: string | null
          clip_path: string | null
          clip_seconds: number | null
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          item: string
          note: string | null
          requester_id: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          clip_path?: string | null
          clip_seconds?: number | null
          conversation_id: string
          created_at?: string
          expires_at?: string
          id?: string
          item: string
          note?: string | null
          requester_id: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          clip_path?: string | null
          clip_seconds?: number | null
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          item?: string
          note?: string | null
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_me_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          agent_id: string | null
          avatar_path: string | null
          banner_path: string | null
          bio: string | null
          bio_status: Database["public"]["Enums"]["social_status"]
          contact_policy: string
          cover_path: string | null
          created_at: string
          display_label: string | null
          follower_count: number
          following_count: number
          handle: string
          handle_claimed_at: string
          home_area_id: string | null
          is_agent: boolean
          lga_code: string | null
          link: string | null
          occupation_code: string | null
          pidgin_ok: boolean
          post_count: number
          pronouns: string | null
          state_code: string | null
          supply_role: Database["public"]["Enums"]["supply_role"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          avatar_path?: string | null
          banner_path?: string | null
          bio?: string | null
          bio_status?: Database["public"]["Enums"]["social_status"]
          contact_policy?: string
          cover_path?: string | null
          created_at?: string
          display_label?: string | null
          follower_count?: number
          following_count?: number
          handle: string
          handle_claimed_at?: string
          home_area_id?: string | null
          is_agent?: boolean
          lga_code?: string | null
          link?: string | null
          occupation_code?: string | null
          pidgin_ok?: boolean
          post_count?: number
          pronouns?: string | null
          state_code?: string | null
          supply_role?: Database["public"]["Enums"]["supply_role"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          avatar_path?: string | null
          banner_path?: string | null
          bio?: string | null
          bio_status?: Database["public"]["Enums"]["social_status"]
          contact_policy?: string
          cover_path?: string | null
          created_at?: string
          display_label?: string | null
          follower_count?: number
          following_count?: number
          handle?: string
          handle_claimed_at?: string
          home_area_id?: string | null
          is_agent?: boolean
          lga_code?: string | null
          link?: string | null
          occupation_code?: string | null
          pidgin_ok?: boolean
          post_count?: number
          pronouns?: string | null
          state_code?: string | null
          supply_role?: Database["public"]["Enums"]["supply_role"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_profiles_home_area_id_fkey"
            columns: ["home_area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_grants: {
        Row: {
          granted_at: string
          granted_by: string
          note: string | null
          position: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          scopes: Database["public"]["Enums"]["staff_scope"][]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          note?: string | null
          position?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes: Database["public"]["Enums"]["staff_scope"][]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          note?: string | null
          position?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: Database["public"]["Enums"]["staff_scope"][]
          user_id?: string
        }
        Relationships: []
      }
      staff_handbook_acks: {
        Row: {
          acknowledged_at: string
          user_id: string
          version: string
        }
        Insert: {
          acknowledged_at?: string
          user_id: string
          version: string
        }
        Update: {
          acknowledged_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      states: {
        Row: {
          code: string
          created_at: string
          name: string
          zone: Database["public"]["Enums"]["geopolitical_zone"]
        }
        Insert: {
          code: string
          created_at?: string
          name: string
          zone: Database["public"]["Enums"]["geopolitical_zone"]
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          zone?: Database["public"]["Enums"]["geopolitical_zone"]
        }
        Relationships: []
      }
      stories: {
        Row: {
          area_id: string | null
          author_id: string
          comment_count: number
          created_at: string
          edited_at: string | null
          headline: string
          hidden_by: string | null
          hold_reason: string | null
          id: string
          image_path: string
          like_count: number
          listing_id: string | null
          place_label: string | null
          removed_at: string | null
          save_count: number
          standfirst: string | null
          status: Database["public"]["Enums"]["social_status"]
          view_count: number
        }
        Insert: {
          area_id?: string | null
          author_id: string
          comment_count?: number
          created_at?: string
          edited_at?: string | null
          headline: string
          hidden_by?: string | null
          hold_reason?: string | null
          id?: string
          image_path: string
          like_count?: number
          listing_id?: string | null
          place_label?: string | null
          removed_at?: string | null
          save_count?: number
          standfirst?: string | null
          status?: Database["public"]["Enums"]["social_status"]
          view_count?: number
        }
        Update: {
          area_id?: string | null
          author_id?: string
          comment_count?: number
          created_at?: string
          edited_at?: string | null
          headline?: string
          hidden_by?: string | null
          hold_reason?: string | null
          id?: string
          image_path?: string
          like_count?: number
          listing_id?: string | null
          place_label?: string | null
          removed_at?: string | null
          save_count?: number
          standfirst?: string | null
          status?: Database["public"]["Enums"]["social_status"]
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "stories_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "stories_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "stories_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "stories_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "story_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          edited_at: string | null
          hold_reason: string | null
          id: string
          like_count: number
          parent_id: string | null
          status: Database["public"]["Enums"]["social_status"]
          story_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          hold_reason?: string | null
          id?: string
          like_count?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["social_status"]
          story_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          hold_reason?: string | null
          id?: string
          like_count?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["social_status"]
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "story_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          mark: Database["public"]["Enums"]["post_mark"]
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mark: Database["public"]["Enums"]["post_mark"]
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          mark?: Database["public"]["Enums"]["post_mark"]
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          seen_on: string
          story_id: string
          viewer_bucket: string
        }
        Insert: {
          seen_on?: string
          story_id: string
          viewer_bucket: string
        }
        Update: {
          seen_on?: string
          story_id?: string
          viewer_bucket?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          amount_minor: number | null
          currency: string | null
          event_key: string
          event_type: string
          from_status: string | null
          id: number
          invoice_code: string | null
          mode: string | null
          outcome: string
          provider: string
          provider_status: string | null
          provider_subscription_code: string | null
          received_at: string
          reference: string | null
          subscription_id: string | null
          to_status: string | null
        }
        Insert: {
          amount_minor?: number | null
          currency?: string | null
          event_key: string
          event_type: string
          from_status?: string | null
          id?: never
          invoice_code?: string | null
          mode?: string | null
          outcome: string
          provider: string
          provider_status?: string | null
          provider_subscription_code?: string | null
          received_at?: string
          reference?: string | null
          subscription_id?: string | null
          to_status?: string | null
        }
        Update: {
          amount_minor?: number | null
          currency?: string | null
          event_key?: string
          event_type?: string
          from_status?: string | null
          id?: never
          invoice_code?: string | null
          mode?: string | null
          outcome?: string
          provider?: string
          provider_status?: string | null
          provider_subscription_code?: string | null
          received_at?: string
          reference?: string | null
          subscription_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_provider_plans: {
        Row: {
          amount_minor: number
          billing_interval: string
          created_at: string
          currency: string
          id: number
          mode: string
          plan_key: string
          provider: string
          provider_plan_code: string
        }
        Insert: {
          amount_minor: number
          billing_interval?: string
          created_at?: string
          currency?: string
          id?: never
          mode: string
          plan_key: string
          provider?: string
          provider_plan_code: string
        }
        Update: {
          amount_minor?: number
          billing_interval?: string
          created_at?: string
          currency?: string
          id?: never
          mode?: string
          plan_key?: string
          provider?: string
          provider_plan_code?: string
        }
        Relationships: []
      }
      subscription_settings: {
        Row: {
          id: number
          note: string | null
          renewal_grace_days: number
          trial_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          note?: string | null
          renewal_grace_days?: number
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          note?: string | null
          renewal_grace_days?: number
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          height: number | null
          id: string
          message_id: string | null
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploader_id: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          message_id?: string | null
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploader_id?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          message_id?: string | null
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          ticket_id?: string
          uploader_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_escalations: {
        Row: {
          escalated_at: string
          escalated_by: string | null
          id: string
          reason: string
          return_note: string | null
          returned_at: string | null
          returned_by: string | null
          ticket_id: string
          to_scope: Database["public"]["Enums"]["staff_scope"]
        }
        Insert: {
          escalated_at?: string
          escalated_by?: string | null
          id?: string
          reason: string
          return_note?: string | null
          returned_at?: string | null
          returned_by?: string | null
          ticket_id: string
          to_scope: Database["public"]["Enums"]["staff_scope"]
        }
        Update: {
          escalated_at?: string
          escalated_by?: string | null
          id?: string
          reason?: string
          return_note?: string | null
          returned_at?: string | null
          returned_by?: string | null
          ticket_id?: string
          to_scope?: Database["public"]["Enums"]["staff_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_escalations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string | null
          sender_role: string
          staff_name: string | null
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role: string
          staff_name?: string | null
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: string
          staff_name?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          body: string
          created_at: string
          email: string
          id: string
          kind: string
          last_member_reply_at: string | null
          member_read_at: string | null
          name: string
          queue_at: string | null
          rated_at: string | null
          rating: number | null
          rating_comment: string | null
          reference: string
          related_id: string | null
          related_kind: string | null
          related_label: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          topic: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          id?: string
          kind?: string
          last_member_reply_at?: string | null
          member_read_at?: string | null
          name: string
          queue_at?: string | null
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          reference: string
          related_id?: string | null
          related_kind?: string | null
          related_label?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          topic?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          id?: string
          kind?: string
          last_member_reply_at?: string | null
          member_read_at?: string | null
          name?: string
          queue_at?: string | null
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          reference?: string
          related_id?: string | null
          related_kind?: string | null
          related_label?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          topic?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tax_schedule_lines: {
        Row: {
          borne_by: string
          confirmed_by: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: number
          note: string
          rate_bps: number | null
          source: string | null
          tax_kind: string
        }
        Insert: {
          borne_by: string
          confirmed_by?: string | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: never
          note: string
          rate_bps?: number | null
          source?: string | null
          tax_kind: string
        }
        Update: {
          borne_by?: string
          confirmed_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: never
          note?: string
          rate_bps?: number | null
          source?: string | null
          tax_kind?: string
        }
        Relationships: []
      }
      tenancy_exit_accounts: {
        Row: {
          answered_at: string
          answered_by: string
          flooding: string
          light: string
          rent_payment_id: string
          water: string
        }
        Insert: {
          answered_at?: string
          answered_by: string
          flooding: string
          light: string
          rent_payment_id: string
          water: string
        }
        Update: {
          answered_at?: string
          answered_by?: string
          flooding?: string
          light?: string
          rent_payment_id?: string
          water?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_exit_accounts_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: true
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_pins: {
        Row: {
          created_at: string
          message_id: string
          pinned_by: string
          rent_payment_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          pinned_by?: string
          rent_payment_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          pinned_by?: string
          rent_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_pins_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_pins_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_renewal_answers: {
        Row: {
          answer: string
          answered_at: string
          answered_by: string
          rent_payment_id: string
        }
        Insert: {
          answer: string
          answered_at?: string
          answered_by: string
          rent_payment_id: string
        }
        Update: {
          answer?: string
          answered_at?: string
          answered_by?: string
          rent_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_renewal_answers_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: true
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_renewal_notices: {
        Row: {
          notified_at: string
          rent_payment_id: string
        }
        Insert: {
          notified_at?: string
          rent_payment_id: string
        }
        Update: {
          notified_at?: string
          rent_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_renewal_notices_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: true
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_renewal_offers: {
        Row: {
          agency_minor: number
          agreement_minor: number
          id: string
          legal_minor: number
          offered_at: string
          offered_by: string
          rent_minor: number
          rent_payment_id: string
          service_minor: number | null
        }
        Insert: {
          agency_minor?: number
          agreement_minor?: number
          id?: string
          legal_minor?: number
          offered_at?: string
          offered_by: string
          rent_minor: number
          rent_payment_id: string
          service_minor?: number | null
        }
        Update: {
          agency_minor?: number
          agreement_minor?: number
          id?: string
          legal_minor?: number
          offered_at?: string
          offered_by?: string
          rent_minor?: number
          rent_payment_id?: string
          service_minor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_renewal_offers_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_report_items: {
        Row: {
          checked: boolean
          checked_at: string | null
          item: string
          note: string | null
          report_id: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          item: string
          note?: string | null
          report_id: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          item?: string
          note?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "tenancy_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_report_photos: {
        Row: {
          created_at: string
          id: string
          item: string | null
          report_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          item?: string | null
          report_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          item?: string | null
          report_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "tenancy_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_reports: {
        Row: {
          author_id: string
          countersigned_at: string | null
          countersigned_by: string | null
          created_at: string
          id: string
          notes: string | null
          rent_payment_id: string
          stage: string
          submitted_at: string | null
        }
        Insert: {
          author_id: string
          countersigned_at?: string | null
          countersigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          rent_payment_id: string
          stage: string
          submitted_at?: string | null
        }
        Update: {
          author_id?: string
          countersigned_at?: string | null
          countersigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          rent_payment_id?: string
          stage?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_reports_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_reviews: {
        Row: {
          again: string
          agent_on_time: string
          answered_at: string
          as_listed: string
          body: string | null
          extra_minor: number | null
          extra_to: string | null
          lister_id: string
          listing_id: string
          paid_extra: string
          rating: number
          rent_payment_id: string
          tenant_id: string
          weight_withheld_reason: string[] | null
        }
        Insert: {
          again: string
          agent_on_time: string
          answered_at?: string
          as_listed: string
          body?: string | null
          extra_minor?: number | null
          extra_to?: string | null
          lister_id: string
          listing_id: string
          paid_extra: string
          rating: number
          rent_payment_id: string
          tenant_id: string
          weight_withheld_reason?: string[] | null
        }
        Update: {
          again?: string
          agent_on_time?: string
          answered_at?: string
          as_listed?: string
          body?: string | null
          extra_minor?: number | null
          extra_to?: string | null
          lister_id?: string
          listing_id?: string
          paid_extra?: string
          rating?: number
          rent_payment_id?: string
          tenant_id?: string
          weight_withheld_reason?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "tenancy_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "tenancy_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "tenancy_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_reviews_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: true
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_snapshots: {
        Row: {
          amenities: string[]
          listing: Json
          rent_payment_id: string
          taken_at: string
        }
        Insert: {
          amenities?: string[]
          listing: Json
          rent_payment_id: string
          taken_at?: string
        }
        Update: {
          amenities?: string[]
          listing?: Json
          rent_payment_id?: string
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_snapshots_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: true
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          document: string
          id: string
          source: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document: string
          id?: string
          source?: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          document?: string
          id?: string
          source?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      threshold_approvals: {
        Row: {
          approved_at: string
          approved_by: string
          decision_id: string
          note: string | null
          verdict: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          decision_id: string
          note?: string | null
          verdict: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          decision_id?: string
          note?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "threshold_approvals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: true
            referencedRelation: "threshold_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      threshold_decisions: {
        Row: {
          decided_at: string
          decided_by: string
          decision: string
          event_id: string
          external_reference: string | null
          id: string
          note: string | null
          reported_on: string | null
        }
        Insert: {
          decided_at?: string
          decided_by: string
          decision: string
          event_id: string
          external_reference?: string | null
          id?: string
          note?: string | null
          reported_on?: string | null
        }
        Update: {
          decided_at?: string
          decided_by?: string
          decision?: string
          event_id?: string
          external_reference?: string | null
          id?: string
          note?: string | null
          reported_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "threshold_decisions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "threshold_events"
            referencedColumns: ["id"]
          },
        ]
      }
      threshold_events: {
        Row: {
          amount_minor: number
          counterparty_class: string | null
          counterparty_id: string | null
          direction: string | null
          due_at: string
          id: string
          kind: string
          observation_ids: string[]
          occurred_at: string
          party_class: string
          party_id: string
          raised_at: string
          source: string | null
          source_id: string | null
          threshold_minor: number
        }
        Insert: {
          amount_minor: number
          counterparty_class?: string | null
          counterparty_id?: string | null
          direction?: string | null
          due_at: string
          id?: string
          kind: string
          observation_ids: string[]
          occurred_at: string
          party_class: string
          party_id: string
          raised_at?: string
          source?: string | null
          source_id?: string | null
          threshold_minor: number
        }
        Update: {
          amount_minor?: number
          counterparty_class?: string | null
          counterparty_id?: string | null
          direction?: string | null
          due_at?: string
          id?: string
          kind?: string
          observation_ids?: string[]
          occurred_at?: string
          party_class?: string
          party_id?: string
          raised_at?: string
          source?: string | null
          source_id?: string | null
          threshold_minor?: number
        }
        Relationships: []
      }
      threshold_reminders: {
        Row: {
          event_id: string
          sent_at: string
          stage: string
        }
        Insert: {
          event_id: string
          sent_at?: string
          stage: string
        }
        Update: {
          event_id?: string
          sent_at?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "threshold_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "threshold_events"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          access_code: string | null
          agreement_id: string | null
          amount_minor: number
          authorization_url: string | null
          booking_id: string
          checkout_opened_at: string | null
          closed_reason: string | null
          commission_minor: number | null
          created_at: string
          currency: string
          guarantee_minor: number | null
          id: string
          lister_share_minor: number | null
          payee_subaccount_code: string | null
          payee_user_id: string | null
          paystack_mode: string | null
          processor_checked_at: string | null
          processor_status: string | null
          provider: string
          provider_ref: string | null
          rail: string | null
          rail_policy_id: string | null
          reserve_subaccount_code: string | null
          share_payer_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          agreement_id?: string | null
          amount_minor: number
          authorization_url?: string | null
          booking_id: string
          checkout_opened_at?: string | null
          closed_reason?: string | null
          commission_minor?: number | null
          created_at?: string
          currency?: string
          guarantee_minor?: number | null
          id?: string
          lister_share_minor?: number | null
          payee_subaccount_code?: string | null
          payee_user_id?: string | null
          paystack_mode?: string | null
          processor_checked_at?: string | null
          processor_status?: string | null
          provider?: string
          provider_ref?: string | null
          rail?: string | null
          rail_policy_id?: string | null
          reserve_subaccount_code?: string | null
          share_payer_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          agreement_id?: string | null
          amount_minor?: number
          authorization_url?: string | null
          booking_id?: string
          checkout_opened_at?: string | null
          closed_reason?: string | null
          commission_minor?: number | null
          created_at?: string
          currency?: string
          guarantee_minor?: number | null
          id?: string
          lister_share_minor?: number | null
          payee_subaccount_code?: string | null
          payee_user_id?: string | null
          paystack_mode?: string | null
          processor_checked_at?: string | null
          processor_status?: string | null
          provider?: string
          provider_ref?: string | null
          rail?: string | null
          rail_policy_id?: string | null
          reserve_subaccount_code?: string | null
          share_payer_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "deal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_rail_policy_id_fkey"
            columns: ["rail_policy_id"]
            isOneToOne: false
            referencedRelation: "payment_rail_policy"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          room_type_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          room_type_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          room_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_code: string
          evidence: Json | null
          granted_at: string
          granted_by: string | null
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          badge_code: string
          evidence?: Json | null
          granted_at?: string
          granted_by?: string | null
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          badge_code?: string
          evidence?: Json | null
          granted_at?: string
          granted_by?: string | null
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viewing_windows: {
        Row: {
          active: boolean
          created_at: string
          ends: string
          id: string
          lister_id: string
          listing_ids: string[]
          slot_minutes: number
          starts: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends: string
          id?: string
          lister_id: string
          listing_ids: string[]
          slot_minutes?: number
          starts: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          ends?: string
          id?: string
          lister_id?: string
          listing_ids?: string[]
          slot_minutes?: number
          starts?: string
          weekday?: number
        }
        Relationships: []
      }
      web_vitals_samples: {
        Row: {
          at: string
          effective_type: string | null
          id: number
          metric: string
          route: string
          save_data: boolean
          transfer_kb: number | null
          value: number
        }
        Insert: {
          at?: string
          effective_type?: string | null
          id?: never
          metric: string
          route: string
          save_data?: boolean
          transfer_kb?: number | null
          value: number
        }
        Update: {
          at?: string
          effective_type?: string | null
          id?: never
          metric?: string
          route?: string
          save_data?: boolean
          transfer_kb?: number | null
          value?: number
        }
        Relationships: []
      }
      weight_withheld: {
        Row: {
          kind: string
          reasons: string[]
          stamped_at: string
          subject_id: string
        }
        Insert: {
          kind: string
          reasons: string[]
          stamped_at?: string
          subject_id: string
        }
        Update: {
          kind?: string
          reasons?: string[]
          stamped_at?: string
          subject_id?: string
        }
        Relationships: []
      }
      whatsapp_inbound_seen: {
        Row: {
          seen_at: string
          wamid_hash: string
        }
        Insert: {
          seen_at?: string
          wamid_hash: string
        }
        Update: {
          seen_at?: string
          wamid_hash?: string
        }
        Relationships: []
      }
      whatsapp_queue: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          event: string
          id: string
          last_error: string | null
          not_before: string | null
          notification_id: string | null
          path: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          event: string
          id?: string
          last_error?: string | null
          not_before?: string | null
          notification_id?: string | null
          path: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          event?: string
          id?: string
          last_error?: string | null
          not_before?: string | null
          notification_id?: string | null
          path?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      widget_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      door_honesty: {
        Row: {
          listing_id: string | null
          nothing_more: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "tenancy_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "tenancy_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "tenancy_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_balances_by_book: {
        Row: {
          balance_minor: number | null
          currency: string | null
          entries: number | null
          pot: string | null
        }
        Relationships: []
      }
      listing_credentials: {
        Row: {
          checked_at: string | null
          company_name: string | null
          kind: string | null
          listing_id: string | null
          number: string | null
          register_name: string | null
        }
        Relationships: []
      }
      listing_lister: {
        Row: {
          lister_name: string | null
          listing_id: string | null
        }
        Relationships: []
      }
      listing_lister_tier: {
        Row: {
          listing_id: string | null
          tier: Database["public"]["Enums"]["badge_tier"] | null
        }
        Relationships: []
      }
      listing_truth_summary: {
        Row: {
          as_listed: number | null
          attended: number | null
          last_at: string | null
          listing_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_truth_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_truth_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_truth_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "inspection_truth_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      person_badge: {
        Row: {
          tier: Database["public"]["Enums"]["badge_tier"] | null
          user_id: string | null
        }
        Relationships: []
      }
      push_queue_health: {
        Row: {
          dead: number | null
          delivered_last_hour: number | null
          failed: number | null
          gave_up_last_hour: number | null
          held: number | null
          oldest_due_seconds: number | null
          pending: number | null
          sending: number | null
          stale_claims: number | null
        }
        Relationships: []
      }
      reviews_counted: {
        Row: {
          author_id: string | null
          author_label: string | null
          body: string | null
          booking_id: string | null
          created_at: string | null
          id: string | null
          listing_id: string | null
          rating: number | null
        }
        Insert: {
          author_id?: string | null
          author_label?: string | null
          body?: string | null
          booking_id?: string | null
          created_at?: string | null
          id?: string | null
          listing_id?: string | null
          rating?: number | null
        }
        Update: {
          author_id?: string | null
          author_label?: string | null
          body?: string | null
          booking_id?: string | null
          created_at?: string | null
          id?: string | null
          listing_id?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_credentials"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_lister_tier"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_fee_terms: {
        Args: {
          p_fee_high_minor: number
          p_fee_low_minor: number
          p_listing: string
          p_policy_version: number
          p_protection_rate: number
          p_receive_high_minor: number
          p_receive_low_minor: number
          p_rent_minor: number
          p_terms_version: string
        }
        Returns: Json
      }
      accept_listing_rate: {
        Args: {
          p_amount_minor: number
          p_listing: string
          p_policy_version: number
        }
        Returns: Json
      }
      account_deletion_blockers: { Args: { p_user: string }; Returns: Json }
      acting_for: { Args: { p_id: string; p_kind: string }; Returns: Json }
      add_rent_contributor: {
        Args: { p_rent_payment: string; p_share: number; p_user: string }
        Returns: Json
      }
      add_tenancy_report_photo: {
        Args: { p_item: string; p_path: string; p_report: string }
        Returns: Json
      }
      admin_agreement_watch_list: { Args: { p_limit?: number }; Returns: Json }
      admin_begin_email_recovery: {
        Args: { p_request: string }
        Returns: {
          new_email: string
          old_email: string
          user_id: string
        }[]
      }
      admin_cancel_email_recovery: {
        Args: { p_reason: string; p_request: string }
        Returns: undefined
      }
      admin_caution_desk: { Args: never; Returns: Json }
      admin_clear_console_keys: {
        Args: { p_reason: string; p_user: string }
        Returns: Json
      }
      admin_decide_agreement: {
        Args: { p_agreement: string; p_decision: string; p_reason?: string }
        Returns: Json
      }
      admin_decide_guarantee_claim: {
        Args: {
          p_amount_minor?: number
          p_claim: string
          p_decision: string
          p_reason?: string
        }
        Returns: Json
      }
      admin_erased_identity_matches: {
        Args: never
        Returns: {
          canonical_rule: string
          erased_user_id: string
          user_id: string
        }[]
      }
      admin_field_speed: {
        Args: never
        Returns: {
          effective_type: string
          p75_cls: number
          p75_inp_ms: number
          p75_lcp_ms: number
          p75_transfer_kb: number
          route: string
          samples: number
        }[]
      }
      admin_finish_email_recovery: {
        Args: { p_error?: string; p_ok: boolean; p_request: string }
        Returns: undefined
      }
      admin_funnel_summary: {
        Args: { p_days?: number }
        Returns: {
          locale: string
          step: string
          surface: string
          visits: number
        }[]
      }
      admin_grant_staff: {
        Args: {
          p_note?: string
          p_position?: string
          p_scopes?: string[]
          p_user: string
        }
        Returns: Json
      }
      admin_guarantee_reserve: { Args: never; Returns: Json }
      admin_mark_guarantee_claim_paid: {
        Args: { p_bank_reference: string; p_claim: string }
        Returns: Json
      }
      admin_money_history: {
        Args: {
          p_before?: string
          p_from?: string
          p_limit?: number
          p_to?: string
        }
        Returns: {
          amount_minor: number
          booking_id: string
          commission_minor: number
          entry_id: string
          guarantee_minor: number
          kind: string
          lister_share_minor: number
          occurred_at: string
          payee_name: string
          payer_name: string
          reference: string
          status: string
          title: string
        }[]
      }
      admin_money_summary: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      admin_open_email_recovery: {
        Args: {
          p_evidence_ref: string
          p_new_email: string
          p_nin: string
          p_user: string
        }
        Returns: string
      }
      admin_pause_release: {
        Args: { p_arrangement: string; p_reason: string }
        Returns: Json
      }
      admin_payluk_commission_sweep: { Args: never; Returns: Json }
      admin_payment_health: {
        Args: { p_stale_minutes?: number }
        Returns: Json
      }
      admin_person_file: { Args: { p_user: string }; Returns: Json }
      admin_referral_budget_set: {
        Args: { p_cap_minor: number; p_month: string; p_reason: string }
        Returns: Json
      }
      admin_referral_cluster_exposure: {
        Args: { p_limit?: number }
        Returns: {
          exposure_minor: number
          members: number
          non_network: boolean
          reasons: Json
          referrer_id: string
          score: number
        }[]
      }
      admin_referral_clusters: {
        Args: { p_min_size?: number }
        Returns: {
          referred_ids: string[]
          referrer_id: string
          shared_by: number
          signal: string
        }[]
      }
      admin_referral_counts: {
        Args: { p_days?: number }
        Returns: {
          code: string
          confirmed: number
          first_name: string
        }[]
      }
      admin_referral_decide: {
        Args: { p_decision: string; p_reason: string; p_referral: string }
        Returns: string
      }
      admin_referral_graph: {
        Args: { p_depth?: number; p_member: string }
        Returns: {
          depth: number
          referred_id: string
          referrer_id: string
          risk_reasons: Json
          risk_score: number
          status: string
        }[]
      }
      admin_referral_liability: { Args: never; Returns: Json }
      admin_refund_clock: {
        Args: never
        Returns: {
          amount_minor: number
          booking_id: string
          due_by: string
          kind: string
          subject_id: string
        }[]
      }
      admin_remove_support: {
        Args: { p_reason: string; p_user: string }
        Returns: Json
      }
      admin_report_signals: {
        Args: { p_reports: string[] }
        Returns: {
          attended_at: string
          past_closed: number
          past_upheld: number
          phone_confirmed: boolean
          report_id: string
        }[]
      }
      admin_resume_release: { Args: { p_arrangement: string }; Returns: Json }
      admin_retire_demo_listings: {
        Args: { p_listing_ids: string[] }
        Returns: Json
      }
      admin_revenue_summary: { Args: { p_days?: number }; Returns: Json }
      admin_revoke_staff: {
        Args: { p_reason: string; p_user: string }
        Returns: Json
      }
      admin_rewards_payout_decide: {
        Args: { p_decision: string; p_payout: string; p_reason: string }
        Returns: string
      }
      admin_rule_caution_dispute: {
        Args: { p_allowed_minor: number; p_deduction: string; p_reason: string }
        Returns: Json
      }
      admin_rule_caution_return: {
        Args: { p_outcome: string; p_reason: string; p_return: string }
        Returns: Json
      }
      admin_set_internal: {
        Args: { p_internal: boolean; p_reason?: string; p_user: string }
        Returns: Json
      }
      admin_set_review_kill_switch: {
        Args: { p_on: boolean; p_reason: string }
        Returns: Json
      }
      admin_update_risk_settings: {
        Args: {
          p_amount_threshold_minor: number
          p_check_amount: boolean
          p_check_first_deal: boolean
          p_check_fraud_radar: boolean
          p_check_payout_name: boolean
          p_check_recent_change: boolean
          p_recent_change_days: number
        }
        Returns: Json
      }
      admin_user_id_by_email: { Args: { p_email: string }; Returns: string }
      agent_lookup: { Args: { p_query: string }; Returns: Json }
      agent_lookup_opt_in: { Args: { p_phone: string }; Returns: Json }
      agent_trust: {
        Args: { p_user: string }
        Returns: {
          average_rating: number
          completed_deals: number
          response_minutes: number
          review_count: number
        }[]
      }
      agreement_amend_as: {
        Args: {
          p_actor: string
          p_agreement: string
          p_handover?: string
          p_move_in: string
          p_notes?: string
        }
        Returns: Json
      }
      agreement_cancel_as: {
        Args: { p_actor: string; p_agreement: string; p_note: string }
        Returns: Json
      }
      agreement_confirm_as: {
        Args: { p_actor: string; p_agreement: string; p_version: number }
        Returns: Json
      }
      agreement_open_rent_as: {
        Args: {
          p_actor: string
          p_handover?: string
          p_inspection: string
          p_move_in: string
          p_notes?: string
        }
        Returns: Json
      }
      agreement_payable_for: { Args: { p_agreement: string }; Returns: Json }
      answer_arrival_check: {
        Args: {
          p_answer: string
          p_booking: string
          p_note?: string
          p_photos?: string[]
        }
        Returns: Json
      }
      answer_availability: {
        Args: {
          p_answer: Database["public"]["Enums"]["availability_answer"]
          p_check: string
          p_from?: string
        }
        Returns: undefined
      }
      answer_brief: {
        Args: { p_brief: string; p_listing: string }
        Returns: string
      }
      answer_caution_deduction: {
        Args: { p_answer: string; p_deduction: string }
        Returns: Json
      }
      answer_exit_account: {
        Args: {
          p_flooding: string
          p_light: string
          p_rent_payment: string
          p_water: string
        }
        Returns: Json
      }
      answer_inspection_delegation: {
        Args: { p_accept: boolean; p_inspection: string }
        Returns: Json
      }
      answer_pep_question: {
        Args: {
          p_asked_at: string
          p_is_pep: boolean
          p_relation: string
          p_role: string
        }
        Returns: string
      }
      answer_renewal: {
        Args: { p_answer: string; p_rent_payment: string }
        Returns: Json
      }
      answer_rent_share: {
        Args: { p_answer: string; p_contributor: string }
        Returns: Json
      }
      answer_show_me: {
        Args: { p_path: string; p_request: string; p_seconds: number }
        Returns: string
      }
      apply_calendar_import: {
        Args: { p_error?: string; p_import: string; p_nights: string[] }
        Returns: Json
      }
      approve_edd_decision: { Args: { p_decision: string }; Returns: string }
      approve_pep_clear: { Args: { p_flag: string }; Returns: string }
      approve_risk_override: { Args: { p_row: string }; Returns: string }
      approve_threshold_decision: {
        Args: { p_decision: string; p_note?: string; p_verdict: string }
        Returns: Json
      }
      area_asking_summary: {
        Args: {
          p_area?: string
          p_bedrooms?: number
          p_city?: string
          p_intent?: Database["public"]["Enums"]["listing_intent"]
          p_max_age_days?: number
          p_property_type?: Database["public"]["Enums"]["property_type"]
          p_state_code: string
        }
        Returns: {
          bedrooms: number
          listing_count: number
          median_minor: number
          median_per_sqm_minor: number
          newest_at: string
          oldest_at: string
          p25_minor: number
          p75_minor: number
          property_type: Database["public"]["Enums"]["property_type"]
          scope: string
          sized_count: number
        }[]
      }
      area_fee_norms: {
        Args: {
          p_area: string
          p_bedrooms?: number
          p_city: string
          p_intent?: string
          p_property_type?: string
          p_state_code: string
        }
        Returns: {
          agency_bp: number
          agency_count: number
          agency_listers: number
          legal_bp: number
          legal_count: number
          legal_listers: number
          listing_count: number
          similar_listers: number
        }[]
      }
      area_paid_summary: {
        Args: { p_area: string; p_state_code: string }
        Returns: {
          bedrooms: number
          median_fee_share_bps: number
          median_minor: number
          newest_at: string
          oldest_at: string
          p25_minor: number
          p75_minor: number
          property_type: Database["public"]["Enums"]["property_type"]
          tenancy_band: string
        }[]
      }
      area_price_pages: {
        Args: { p_minimum?: number }
        Returns: {
          area: string
          listing_count: number
          newest_at: string
          state_code: string
          state_name: string
        }[]
      }
      area_pulse_summary: {
        Args: { p_area: string; p_state: string }
        Returns: {
          answer: string
          area_name: string
          kind: string
          members: number
          reports: number
          window_days: number
        }[]
      }
      area_suggestions: {
        Args: { p_limit?: number; p_query?: string; p_state_code: string }
        Returns: {
          area: string
          city: string
          listing_count: number
        }[]
      }
      area_supply_census: {
        Args: {
          p_area?: string
          p_city?: string
          p_intent?: Database["public"]["Enums"]["listing_intent"]
          p_state_code: string
        }
        Returns: {
          demo_count: number
          located_count: number
          real_count: number
          sized_count: number
        }[]
      }
      area_supply_census_exact: {
        Args: {
          p_area?: string
          p_city?: string
          p_intent?: Database["public"]["Enums"]["listing_intent"]
          p_state_code: string
        }
        Returns: {
          demo_count: number
          located_count: number
          real_count: number
          sized_count: number
        }[]
      }
      area_supply_census_public: {
        Args: {
          p_area?: string
          p_city?: string
          p_intent?: Database["public"]["Enums"]["listing_intent"]
          p_state_code: string
        }
        Returns: {
          demo_count: number
          located_count: number
          real_count: number
          sized_count: number
        }[]
      }
      area_utility_facts: {
        Args: { p_area?: string; p_city?: string; p_state_code: string }
        Returns: {
          estate_access_count: number
          estate_access_known: number
          listing_count: number
          power_backup: Database["public"]["Enums"]["power_backup"]
          power_backup_count: number
          power_grid: Database["public"]["Enums"]["power_grid"]
          power_grid_count: number
          prepaid_meter_count: number
          prepaid_meter_known: number
          water_supply: Database["public"]["Enums"]["water_supply"]
          water_supply_count: number
        }[]
      }
      arrival_check_state: { Args: { p_booking: string }; Returns: Json }
      ask_availability: { Args: { p_conversation: string }; Returns: string }
      assign_listing: {
        Args: { p_agent: string; p_listing: string }
        Returns: undefined
      }
      attribute_conversation: {
        Args: { p_conversation: string; p_first_touch: string; p_token: string }
        Returns: boolean
      }
      badge_tier: {
        Args: { is_checked: boolean; is_staff: boolean }
        Returns: Database["public"]["Enums"]["badge_tier"]
      }
      beneficial_ownership_desk: { Args: never; Returns: Json }
      book_viewing_slot: {
        Args: { p_listing: string; p_note?: string; p_slot: string }
        Returns: string
      }
      bot_may_run: { Args: { p_user: string }; Returns: string }
      briefs_for_me: {
        Args: never
        Returns: {
          answered: number
          areas: string[]
          bedrooms_min: number
          created_at: string
          expires_at: string
          id: string
          intent: string
          max_minor: number
          move_from: string
          property_type: string
          state_code: string
        }[]
      }
      business_private_fields: {
        Args: { p_ids: string[] }
        Returns: {
          address: string
          cac_number: string
          consents: Json
          email: string
          id: string
          phone: string
          registered_name: string
          representative_name: string
          representative_phone: string
          review_notes: string
          reviewer_id: string
          tin: string
          verification_tier: number
        }[]
      }
      business_transfer_board: { Args: { p_user: string }; Returns: Json }
      calendar_feed: { Args: { p_token: string }; Returns: Json }
      calendar_imports_due: {
        Args: { p_interval?: string; p_limit?: number }
        Returns: {
          id: string
          source: string
          url: string
        }[]
      }
      call_accept: { Args: { p_call: string }; Returns: Json }
      call_cancel: { Args: { p_call: string }; Returns: Json }
      call_decline: { Args: { p_call: string }; Returns: Json }
      call_end: { Args: { p_call: string }; Returns: Json }
      call_heartbeat: { Args: { p_call: string }; Returns: Json }
      call_history: {
        Args: { p_conversation: string; p_limit?: number }
        Returns: Json
      }
      call_join_check: { Args: { p_call: string }; Returns: Json }
      call_provider_event: {
        Args: {
          p_at: string
          p_event: string
          p_event_id: string
          p_identity: string
          p_provider: string
          p_room: string
        }
        Returns: Json
      }
      call_provider_presence: {
        Args: { p_call: string; p_identities: string[] }
        Returns: Json
      }
      call_review_add_entry: {
        Args: {
          p_body: string
          p_corrects?: string
          p_evidence_ref?: string
          p_kind: string
          p_review: string
        }
        Returns: Json
      }
      call_review_cancel: {
        Args: { p_reason: string; p_review: string }
        Returns: Json
      }
      call_review_complete: {
        Args: {
          p_follow_up_due_at?: string
          p_outcome: string
          p_review: string
          p_summary: string
        }
        Returns: Json
      }
      call_review_request: {
        Args: {
          p_case_id: string
          p_case_kind: string
          p_kind?: string
          p_purpose: string
          p_scheduled_for?: string
        }
        Returns: Json
      }
      call_review_reschedule: {
        Args: { p_reason: string; p_review: string; p_scheduled_for: string }
        Returns: Json
      }
      call_review_respond: {
        Args: { p_proposed_for?: string; p_response: string; p_review: string }
        Returns: Json
      }
      call_review_start: { Args: { p_review: string }; Returns: Json }
      call_start: {
        Args: { p_client_key?: string; p_conversation: string; p_kind: string }
        Returns: Json
      }
      call_usage_summary: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      calls_mark_rooms_closed: { Args: { p_calls: string[] }; Returns: number }
      calls_rooms_to_close: {
        Args: { p_limit?: number }
        Returns: {
          call_id: string
          provider: string
          provider_room: string
        }[]
      }
      calls_sweep_service: { Args: never; Returns: Json }
      cancel_account_deletion: {
        Args: { p_restore_code_hash: string; p_user: string }
        Returns: Json
      }
      card_refund_claims_for: {
        Args: { p_refs: string[] }
        Returns: {
          amount_minor: number
          claim_key: string
          reference: string
          state: string
        }[]
      }
      chargeback_move: {
        Args: {
          p_chargeback: string
          p_evidence_due_at?: string
          p_note?: string
          p_provider_status?: string
          p_raw?: Json
          p_recovered_total_minor?: number
          p_recovery?: string
          p_to_state?: string
        }
        Returns: Json
      }
      chargeback_open: {
        Args: {
          p_amount_minor: number
          p_evidence_due_at?: string
          p_note?: string
          p_provider: string
          p_provider_dispute_id: string
          p_provider_status?: string
          p_raw?: Json
          p_reference: string
        }
        Returns: Json
      }
      claim_card_refund: {
        Args: {
          p_amount_minor: number
          p_key: string
          p_reason: string
          p_reference: string
        }
        Returns: Json
      }
      claim_idempotency: {
        Args: {
          key: string
          scope: string
          subject: string
          ttl_seconds: number
        }
        Returns: Json
      }
      claim_rent_share_refund: {
        Args: { p_refund: string }
        Returns: {
          amount_minor: number
          attempts: number
          reference: string
          refund_id: string
        }[]
      }
      clear_safety_hold: {
        Args: { p_hold: string; p_note: string }
        Returns: string
      }
      clear_weight_withheld: {
        Args: { p_kind: string; p_note: string; p_subject: string }
        Returns: string
      }
      close_brief: { Args: { p_brief: string }; Returns: undefined }
      close_future_commitments: { Args: { p_request: string }; Returns: Json }
      close_listing: {
        Args: { p_listing: string; p_reason: string; p_rent_payment?: string }
        Returns: Json
      }
      closed_listing_count: { Args: never; Returns: number }
      closed_listing_reasons: {
        Args: { p_listings: string[] }
        Returns: {
          close_reason: string
          closed_at: string
          listing_id: string
        }[]
      }
      commission_quote: {
        Args: {
          p_amount_minor: number
          p_type: Database["public"]["Enums"]["property_type"]
          p_version: number
        }
        Returns: Json
      }
      commute_for: {
        Args: { p_anchor: string; p_area: string; p_state: string }
        Returns: {
          high_min: number
          low_min: number
          peak: string
          reports: number
          route_label: string
          source: string
        }[]
      }
      comparable_listings: {
        Args: {
          p_bedrooms: number
          p_exclude_id?: string
          p_intent: Database["public"]["Enums"]["listing_intent"]
          p_lat: number
          p_limit?: number
          p_lng: number
          p_max_age_days?: number
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_radius_m?: number
        }
        Returns: {
          age_days: number
          area: string
          bathrooms: number
          bedrooms: number
          city: string
          condition: Database["public"]["Enums"]["build_condition"]
          distance_m: number
          furnished: Database["public"]["Enums"]["furnishing"]
          id: string
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          price_basis: string
          price_minor: number
          price_per_sqm_minor: number
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string
          size_sqm: number
          state_code: string
          title: string
          toilets: number
        }[]
      }
      comparable_listings_exact: {
        Args: {
          p_bedrooms: number
          p_exclude_id?: string
          p_intent: Database["public"]["Enums"]["listing_intent"]
          p_lat: number
          p_limit?: number
          p_lng: number
          p_max_age_days?: number
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_radius_m?: number
        }
        Returns: {
          age_days: number
          area: string
          bathrooms: number
          bedrooms: number
          city: string
          condition: Database["public"]["Enums"]["build_condition"]
          distance_m: number
          furnished: Database["public"]["Enums"]["furnishing"]
          id: string
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          price_basis: string
          price_minor: number
          price_per_sqm_minor: number
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string
          size_sqm: number
          state_code: string
          title: string
          toilets: number
        }[]
      }
      comparable_listings_public: {
        Args: {
          p_bedrooms: number
          p_exclude_id?: string
          p_intent: Database["public"]["Enums"]["listing_intent"]
          p_lat: number
          p_limit?: number
          p_lng: number
          p_max_age_days?: number
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_radius_m?: number
        }
        Returns: {
          age_days: number
          area: string
          bathrooms: number
          bedrooms: number
          city: string
          condition: Database["public"]["Enums"]["build_condition"]
          distance_m: number
          furnished: Database["public"]["Enums"]["furnishing"]
          id: string
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          price_basis: string
          price_minor: number
          price_per_sqm_minor: number
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string
          size_sqm: number
          state_code: string
          title: string
          toilets: number
        }[]
      }
      comparable_supply_near: {
        Args: {
          p_bedrooms: number
          p_intent: Database["public"]["Enums"]["listing_intent"]
          p_lat: number
          p_lng: number
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_radius_m?: number
        }
        Returns: {
          demo_count: number
          real_count: number
          stale_real_count: number
        }[]
      }
      comparable_supply_near_exact: {
        Args: {
          p_bedrooms: number
          p_intent: Database["public"]["Enums"]["listing_intent"]
          p_lat: number
          p_lng: number
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_radius_m?: number
        }
        Returns: {
          demo_count: number
          real_count: number
          stale_real_count: number
        }[]
      }
      comparable_supply_near_public: {
        Args: {
          p_bedrooms: number
          p_intent: Database["public"]["Enums"]["listing_intent"]
          p_lat: number
          p_lng: number
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_radius_m?: number
        }
        Returns: {
          demo_count: number
          real_count: number
          stale_real_count: number
        }[]
      }
      complete_ended_stays: { Args: { p_limit?: number }; Returns: Json }
      confidence_band: {
        Args: {
          p_count: number
          p_dispersion: number
          p_median_age: number
          p_radius_m: number
        }
        Returns: string
      }
      confirm_phone: { Args: { p_code: string }; Returns: string }
      consume_rate_limit: {
        Args: {
          bucket: string
          limit_count: number
          subject: string
          window_seconds: number
        }
        Returns: boolean
      }
      contest_caution_return: {
        Args: { p_note: string; p_return: string }
        Returns: Json
      }
      contest_review: {
        Args: { p_criterion: string; p_note?: string; p_review: string }
        Returns: Json
      }
      countersign_tenancy_report: { Args: { p_report: string }; Returns: Json }
      create_price_check_share: {
        Args: {
          p_area: string
          p_bedrooms: number
          p_created_by?: string
          p_high_minor: number
          p_lga_code: string
          p_listing_count: number
          p_listing_intent: Database["public"]["Enums"]["listing_intent"]
          p_low_minor: number
          p_mid_minor: number
          p_newest_at?: string
          p_oldest_at?: string
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_scope: Database["public"]["Enums"]["price_check_share_scope"]
          p_state_code: string
        }
        Returns: string
      }
      create_receipt_code: { Args: { p_rent_payment: string }; Returns: Json }
      create_share_link: {
        Args: { p_kind: string; p_target: string }
        Returns: string
      }
      cron_job_failures: {
        Args: { p_limit?: number; p_since?: string }
        Returns: Json
      }
      crypto_open_attempt: {
        Args: { p_payment: string; p_reserve_code: string }
        Returns: Json
      }
      crypto_payment_apply: {
        Args: {
          p_event_id: string
          p_facts?: Json
          p_provider: string
          p_reference: string
          p_source: string
          p_to_state: string
        }
        Returns: Json
      }
      crypto_payments_due_for_check: {
        Args: { p_limit?: number }
        Returns: {
          provider: string
          provider_payment_id: string
          quote_expires_at: string
          reference: string
          state: string
          updated_at: string
        }[]
      }
      current_agent_id: { Args: never; Returns: string }
      current_fee_acceptance: {
        Args: { p_at?: string; p_listing: string }
        Returns: {
          accepted_at: string
          cap_minor: number | null
          cap_threshold_minor: number | null
          commission_bps: number
          fee_high_minor: number
          fee_low_minor: number
          figures_shown: Json
          id: string
          listing_id: string
          member_id: string
          policy_version: string
          policy_version_id: number
          property_type: Database["public"]["Enums"]["property_type"]
          protection_bps: number
          protection_rate_id: number
          receive_high_minor: number
          receive_low_minor: number
          rent_minor: number
          terms_version: string
        }
        SetofOptions: {
          from: "*"
          to: "listing_fee_acceptances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_edd_review: {
        Args: {
          p_note: string
          p_outcome: string
          p_review: string
          p_source_of_funds: string
        }
        Returns: string
      }
      decide_listing_mandate: {
        Args: {
          p_decision: string
          p_id_document_kind: string
          p_id_document_ref: string
          p_mandate: string
          p_reason: string
          p_relationship: string
          p_verified_how: string
        }
        Returns: Json
      }
      decide_refund_request: {
        Args: { p_decision: string; p_note?: string; p_request: string }
        Returns: Json
      }
      decide_review_contest: {
        Args: { p_contest: string; p_outcome: string; p_public_note?: string }
        Returns: Json
      }
      decide_threshold_event: {
        Args: {
          p_decision: string
          p_event: string
          p_note?: string
          p_reference?: string
          p_reported_on?: string
        }
        Returns: Json
      }
      declare_arrival_charges: {
        Args: { p_accommodation: string; p_charges: Json; p_listing: string }
        Returns: Json
      }
      delete_message: {
        Args: { p_message_id: string; p_scope: string }
        Returns: Json
      }
      demand_board: {
        Args: { p_weeks?: number }
        Returns: {
          area_key: string
          bedrooms_min: number
          budget_band: number
          market: string
          real_supply: number
          searches: number
          state_code: string
          unmet: number
        }[]
      }
      destroy_expired_kyc: { Args: { p_user: string }; Returns: Json }
      destroy_expired_money_records: {
        Args: { p_limit?: number }
        Returns: Json
      }
      directory: {
        Args: {
          p_limit?: number
          p_query?: string
          p_side: string
          p_state?: string
        }
        Returns: {
          area: string
          avatar_url: string
          completed: number
          display_name: string
          kind: string
          live_listings: number
          place_code: string
          place_name: string
          ref: string
          since: string
          verification_tier: number
          verified: boolean
        }[]
      }
      due_account_purges: { Args: { p_limit: number }; Returns: Json }
      due_kyc_destructions: { Args: { p_limit?: number }; Returns: Json }
      duplicate_listing: {
        Args: { p_copies: number; p_listing: string }
        Returns: string[]
      }
      email_outbox_claim: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          available_at: string
          claimed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          payload: Json
          settled_at: string | null
          status: string
          template: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      email_outbox_enqueue_welcome: {
        Args: { p_user: string }
        Returns: string
      }
      email_outbox_health: { Args: { p_stuck_minutes?: number }; Returns: Json }
      email_outbox_settle: {
        Args: {
          p_error?: string
          p_id: string
          p_max_attempts?: number
          p_result: string
          p_retry_seconds?: number
        }
        Returns: string
      }
      end_other_sessions: { Args: never; Returns: Json }
      end_session: { Args: { p_session: string }; Returns: Json }
      enquiry_stage_facts: {
        Args: never
        Returns: {
          conversation_id: string
          lost_reason: string
          manual_at: string
          manual_stage: string
          proven_at: string
          proven_stage: string
        }[]
      }
      enter_place: {
        Args: { p_lga_code: string }
        Returns: {
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["area_status"]
        }[]
      }
      entitlement_check: {
        Args: { p_at?: string; p_feature: string; p_user: string }
        Returns: boolean
      }
      escalate_caution_to_guarantee: {
        Args: { p_obligation: string }
        Returns: Json
      }
      estimate_value: {
        Args: {
          p_bedrooms: number
          p_exclude_id?: string
          p_intent: Database["public"]["Enums"]["listing_intent"]
          p_lat: number
          p_lng: number
          p_property_type: Database["public"]["Enums"]["property_type"]
          p_size_sqm?: number
        }
        Returns: {
          basis: string
          comparable_count: number
          comparable_ids: string[]
          confidence: string
          dispersion: number
          high_minor: number
          low_minor: number
          median_age_days: number
          median_distance_m: number
          mid_minor: number
          outcome: string
          radius_m: number
          refusal_code: string
        }[]
      }
      expire_booking_holds: {
        Args: { p_limit?: number; p_ttl?: string }
        Returns: Json
      }
      extend_safety_hold: {
        Args: { p_hold: string; p_note: string }
        Returns: string
      }
      fail_account_purge: {
        Args: { p_reason: string; p_request: string }
        Returns: Json
      }
      fee_protection_rate_at: {
        Args: { p_at?: string }
        Returns: {
          created_at: string
          effective_from: string
          id: number
          note: string
          protection_bps: number
        }
        SetofOptions: {
          from: "*"
          to: "fee_protection_rates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fee_rate_at: {
        Args: { p_at?: string; p_kind: Database["public"]["Enums"]["fee_kind"] }
        Returns: {
          basis_points: number
          effective_from: string
          flat_minor: number
          rate_id: string
        }[]
      }
      fee_terms_quote: { Args: { p_listing: string }; Returns: Json }
      feel_unsafe: {
        Args: { p_block: boolean; p_conversation: string; p_inspection: string }
        Returns: Json
      }
      file_listing_mandate: {
        Args: {
          p_exclusive: boolean
          p_expires_on: string
          p_kind: string
          p_listing: string
          p_principal_name: string
          p_principal_phone: string
          p_relationship: string
          p_signed_on: string
        }
        Returns: Json
      }
      finish_account_purge: {
        Args: { p_request: string; p_storage: Json }
        Returns: Json
      }
      firm_desk: {
        Args: { p_firm: string }
        Returns: {
          area: string
          assigned_agent_id: string
          enquiries_30d: number
          listed_by: string
          listing_id: string
          status: string
          title: string
        }[]
      }
      firm_team: {
        Args: { p_firm: string }
        Returns: {
          agent_id: string
          display_name: string
          member_role: string
          routed_30d: number
        }[]
      }
      flag_pep: {
        Args: {
          p_flagged: boolean
          p_note: string
          p_relation: string
          p_role: string
          p_user: string
        }
        Returns: string
      }
      forward_message: {
        Args: { p_conversation_id: string; p_message_id: string }
        Returns: string
      }
      funds_movement_observe: {
        Args: {
          p_detail?: Json
          p_provider_fee_minor?: number
          p_provider_status?: string
          p_provider_transaction_id?: string
          p_reference: string
          p_source: string
          p_to_status: string
        }
        Returns: string
      }
      grant_staff_role: {
        Args: {
          acting_admin: string
          new_role: Database["public"]["Enums"]["app_role"]
          target_email: string
        }
        Returns: Json
      }
      guarantee_claim_file_as: {
        Args: {
          p_actor: string
          p_agreement: string
          p_description: string
          p_evidence_paths: string[]
          p_items: string[]
          p_requested_minor: number
        }
        Returns: Json
      }
      hold_claims_sweep: { Args: never; Returns: number }
      inspection_handshake: { Args: { p_inspection: string }; Returns: Json }
      inventory_drift: { Args: { p_limit?: number }; Returns: Json }
      is_checked_person: { Args: { check_user_id: string }; Returns: boolean }
      is_platform_staff: { Args: { check_user_id: string }; Returns: boolean }
      join_text_array: { Args: { items: string[] }; Returns: string }
      landlord_line_answer: {
        Args: { p_answer: string; p_note?: string; p_token: string }
        Returns: Json
      }
      landlord_line_begin: {
        Args: { p_ask: string; p_body: string; p_channel: string }
        Returns: string
      }
      landlord_line_claim: { Args: { p_ask: string }; Returns: boolean }
      landlord_line_enqueue: { Args: never; Returns: Json }
      landlord_line_finish: {
        Args: { p_delivered: boolean; p_message: string; p_ref: string }
        Returns: undefined
      }
      landlord_line_inbound: {
        Args: {
          p_channel?: string
          p_code: string
          p_digit: number
          p_phone: string
        }
        Returns: Json
      }
      landlord_line_issue: {
        Args: { p_limit?: number }
        Returns: {
          ask_id: string
          consented_at: string
          expires_on: string
          is_demo: boolean
          lister_name: string
          move_in: string
          place: string
          principal_phone: string
          purpose: string
          reason: string
          rent_period: Database["public"]["Enums"]["rent_period"]
          reply_code: string
          review_status: string
          token: string
          total_minor: number
          withdrawn_at: string
        }[]
      }
      landlord_line_read: { Args: { p_token: string }; Returns: Json }
      landlord_line_release: { Args: { p_ask: string }; Returns: undefined }
      landlord_line_requeue: { Args: never; Returns: number }
      landlord_line_stop: { Args: { p_token: string }; Returns: Json }
      landlord_line_stop_number: {
        Args: { p_channel?: string; p_phone: string }
        Returns: Json
      }
      landmarks_resolve: {
        Args: { p_limit?: number; p_state?: string; p_term: string }
        Returns: {
          city: string
          id: string
          kind: Database["public"]["Enums"]["landmark_kind"]
          latitude: number
          longitude: number
          name: string
          score: number
          slug: string
          state_code: string
        }[]
      }
      leaderboard: {
        Args: {
          p_board: string
          p_limit?: number
          p_period?: string
          p_state?: string
        }
        Returns: {
          avatar_url: string
          display_name: string
          is_me: boolean
          kind: string
          next_score: number
          place_code: string
          place_name: string
          previous_rank: number
          rank: number
          ref: string
          score: number
          total: number
          verified: boolean
        }[]
      }
      leaderboard_set_hidden: {
        Args: { p_business?: string; p_hidden: boolean }
        Returns: boolean
      }
      ledger_record: {
        Args: {
          p_actor?: string
          p_amount: number
          p_corrects?: string
          p_currency: string
          p_direction: string
          p_event: string
          p_key: string
          p_metadata?: Json
          p_pot: string
          p_provider: string
          p_provider_reference?: string
          p_rail?: string
          p_status?: string
          p_transaction?: string
        }
        Returns: string
      }
      ledger_record_payluk_commission: {
        Args: {
          p_actor?: string
          p_amount: number
          p_provider_reference?: string
          p_transaction: string
        }
        Returns: Json
      }
      lister_caution_record: { Args: { p_lister: string }; Returns: Json }
      lister_chargeback_hold: { Args: { p_lister: string }; Returns: boolean }
      lister_confirm_available: {
        Args: { p_listings: string[] }
        Returns: number
      }
      lister_fee_accept: {
        Args: {
          p_cap_minor: number
          p_direct_processor_fee_cap_minor: number
          p_escrow_protection_bps: number
          p_escrow_protection_minor: number
          p_listing: string
          p_price_minor: number
          p_processor_up_to_minor: number
          p_rate_version: string
          p_receive_high_minor: number
          p_receive_low_minor: number
          p_terms_version: string
          p_vallo_bps: number
          p_vallo_minor: number
        }
        Returns: Json
      }
      lister_fee_policy: {
        Args: {
          p_listing: string
          p_listing_intent: string
          p_property_type: string
        }
        Returns: Json
      }
      lister_record_by_code: {
        Args: { p_code: string }
        Returns: {
          answered_in_day: number
          described: number
          described_of: number
          display_name: string
          enquiries: number
          kept: number
          kept_of: number
          lets: number
          record_code: string
          replied: number
          reply_median_minutes: number
          since: string
          stopped: boolean
          stopped_at: string
        }[]
      }
      lister_record_for_listing: {
        Args: { p_listing: string }
        Returns: {
          answered_in_day: number
          described: number
          described_of: number
          display_name: string
          enquiries: number
          kept: number
          kept_of: number
          lets: number
          record_code: string
          replied: number
          reply_median_minutes: number
          since: string
          stopped: boolean
          stopped_at: string
        }[]
      }
      lister_record_for_user: {
        Args: { p_user: string }
        Returns: {
          answered_in_day: number
          described: number
          described_of: number
          display_name: string
          enquiries: number
          kept: number
          kept_of: number
          lets: number
          record_code: string
          replied: number
          reply_median_minutes: number
          since: string
          stopped: boolean
          stopped_at: string
        }[]
      }
      lister_reply_band: { Args: { p_lister: string }; Returns: string }
      lister_verified_names: {
        Args: { p_user: string }
        Returns: {
          kind: string
          name: string
        }[]
      }
      listing_exact_location: {
        Args: { p_listing: string }
        Returns: {
          address: string
          landmark: string
          latitude: number
          longitude: number
          why: string
        }[]
      }
      listing_funnel: {
        Args: { p_listing: string }
        Returns: {
          area_median: number
          compared: number
          mine: number
          stage: string
        }[]
      }
      listing_landlord_facts: {
        Args: { p_listings: string[] }
        Returns: {
          is_representative: boolean
          listing_id: string
          not_reconfirmed: boolean
          offer_count: number
          owner_confirmed_at: string
          property_id: string
        }[]
      }
      listing_last_let: { Args: { p_listing: string }; Returns: Json }
      listing_photo_hash_coverage: {
        Args: { p_listing: string }
        Returns: {
          hashed: number
          photos: number
          pool: number
          pool_waiting: number
        }[]
      }
      listing_photo_matches: {
        Args: { p_listing: string }
        Returns: {
          distance: number
          match_listing_id: string
          match_reference: string
          match_rejected: boolean
          match_status: Database["public"]["Enums"]["listing_status"]
          photo_id: string
          photo_position: number
        }[]
      }
      listing_photos_without_hash: {
        Args: { p_limit: number }
        Returns: {
          id: string
          storage_path: string
        }[]
      }
      listing_private_fields: {
        Args: { p_ids: string[] }
        Returns: {
          address: string
          id: string
          landmark: string
          review_notes: string
          reviewer_id: string
        }[]
      }
      listing_recently_let: { Args: { p_listing: string }; Returns: string }
      listing_review_stats: {
        Args: { p_listing_ids: string[] }
        Returns: {
          listing_id: string
          rating_avg: number
          review_count: number
        }[]
      }
      listing_truth_for_lister: {
        Args: { p_listing: string }
        Returns: {
          attended: number
          money_asked: number
          not_available: number
          not_the_agent: number
          not_the_flat: number
        }[]
      }
      listings_in_bounds: {
        Args: {
          p_bedrooms?: number
          p_east: number
          p_intent?: Database["public"]["Enums"]["listing_intent"]
          p_limit?: number
          p_max_price_minor?: number
          p_min_price_minor?: number
          p_north: number
          p_property_type?: Database["public"]["Enums"]["property_type"]
          p_south: number
          p_west: number
        }
        Returns: {
          area: string
          bathrooms: number
          bedrooms: number
          city: string
          id: string
          is_demo: boolean
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          longitude: number
          price_minor: number
          property_type: Database["public"]["Enums"]["property_type"]
          state_code: string
          title: string
        }[]
      }
      listings_in_bounds_exact: {
        Args: {
          p_bedrooms?: number
          p_east: number
          p_intent?: Database["public"]["Enums"]["listing_intent"]
          p_limit?: number
          p_max_price_minor?: number
          p_min_price_minor?: number
          p_north: number
          p_property_type?: Database["public"]["Enums"]["property_type"]
          p_south: number
          p_west: number
        }
        Returns: {
          area: string
          bathrooms: number
          bedrooms: number
          city: string
          id: string
          is_demo: boolean
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          longitude: number
          price_minor: number
          property_type: Database["public"]["Enums"]["property_type"]
          state_code: string
          title: string
        }[]
      }
      listings_in_bounds_public: {
        Args: {
          p_bedrooms?: number
          p_east: number
          p_intent?: Database["public"]["Enums"]["listing_intent"]
          p_limit?: number
          p_max_price_minor?: number
          p_min_price_minor?: number
          p_north: number
          p_property_type?: Database["public"]["Enums"]["property_type"]
          p_south: number
          p_west: number
        }
        Returns: {
          area: string
          bathrooms: number
          bedrooms: number
          city: string
          id: string
          is_demo: boolean
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          longitude: number
          price_minor: number
          property_type: Database["public"]["Enums"]["property_type"]
          state_code: string
          title: string
        }[]
      }
      lost_reasons_by_area: {
        Args: { p_weeks?: number }
        Returns: {
          area: string
          area_lost: number
          lost: number
          reason: string
          state_code: string
        }[]
      }
      mandate_award: { Args: { p_pitch: string }; Returns: Json }
      mandate_briefs: {
        Args: never
        Returns: {
          asking_max_minor: number
          asking_min_minor: number
          awarded: boolean
          bedrooms: number
          expires_at: string
          invitation_id: string
          pitched: boolean
          place_name: string
          property_type: Database["public"]["Enums"]["property_type"]
          rent_period: Database["public"]["Enums"]["rent_period"]
        }[]
      }
      mandate_consents: {
        Args: { p_mandates: string[] }
        Returns: {
          consented_at: string
          has_number: boolean
          mandate_id: string
          number_stopped_at: string
          read_by_name: string
          withdrawn_at: string
        }[]
      }
      mandate_invite: {
        Args: { p_listing: string; p_max_minor: number; p_min_minor: number }
        Returns: Json
      }
      mandate_pitch: {
        Args: { p_invitation: string; p_note: string }
        Returns: Json
      }
      mandate_pitches_for: {
        Args: { p_invitation: string }
        Returns: {
          agent_name: string
          awarded_at: string
          created_at: string
          lets_through_vallo: number
          live_listings: number
          note: string
          on_vallo_since: string
          pitch_id: string
          verified_tier: number
        }[]
      }
      mandate_withdraw: { Args: { p_invitation: string }; Returns: number }
      mark_first_run_seen: { Args: { p_feature: string }; Returns: boolean }
      moderation_decide: {
        Args: {
          p_decision: string
          p_id: string
          p_reason: string
          p_target: string
        }
        Returns: Json
      }
      money_policy_at: {
        Args: { p_at?: string }
        Returns: {
          commission_bps: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          guarantee_bps: number
          id: number
          note: string
          vat_bps: number
          vat_registered: boolean
          version: string
          withdrawal_min_minor: number
        }
        SetofOptions: {
          from: "*"
          to: "money_policy_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_agent_lookup: { Args: never; Returns: Json }
      my_brief_answers: {
        Args: { p_brief: string }
        Returns: {
          conversation_id: string
          listing_id: string
        }[]
      }
      my_buildings: {
        Args: never
        Returns: {
          achieved_rent_minor: number
          bedrooms: number
          invitation_id: string
          invitation_status: string
          let_state: string
          listing_id: string
          mandate_holders: string[]
          other_listers: string[]
          pitch_count: number
          place_name: string
          property_type: Database["public"]["Enums"]["property_type"]
          rent_period: Database["public"]["Enums"]["rent_period"]
          status: Database["public"]["Enums"]["listing_status"]
          tenancy_ends_on: string
        }[]
      }
      my_call_reviews: { Args: never; Returns: Json }
      my_earnings_history: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          amount_minor: number
          booking_id: string
          commission_minor: number
          entry_id: string
          gross_minor: number
          guarantee_minor: number
          kind: string
          occurred_at: string
          reference: string
          status: string
          title: string
        }[]
      }
      my_earnings_summary: { Args: never; Returns: Json }
      my_leaderboard_visibility: {
        Args: never
        Returns: {
          business_id: string
          hidden: boolean
          kind: string
          name: string
          subject_kind: string
        }[]
      }
      my_listing_mandate: { Args: { p_listing: string }; Returns: Json }
      my_new_device: {
        Args: { p_fingerprint: string }
        Returns: {
          device_words: string
          first_seen_at: string
        }[]
      }
      my_payments_history: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          amount_minor: number
          booking_id: string
          entry_id: string
          kind: string
          occurred_at: string
          reference: string
          status: string
          title: string
        }[]
      }
      my_payments_summary: { Args: never; Returns: Json }
      my_pep_answered_at: { Args: never; Returns: string }
      my_pulse_areas: {
        Args: never
        Returns: {
          area_id: string
          area_name: string
          eligible: boolean
          flood: boolean
          light: boolean
          lister: boolean
          water: boolean
        }[]
      }
      my_referral_code: { Args: never; Returns: string }
      my_referral_progress: {
        Args: { p_limit?: number }
        Returns: {
          earned_state: string
          first_name: string
          id: string
          joined_at: string
          not_eligible_reason: string
          qualified_at: string
          review_until: string
          reward_minor: number
          stage: string
          waiting_on: string
        }[]
      }
      my_referrals: {
        Args: { p_limit?: number }
        Returns: {
          attributed_at: string
          first_name: string
          id: string
          qualified_at: string
          reward_minor: number
          status: string
        }[]
      }
      my_rent_share: { Args: { p_contributor: string }; Returns: Json }
      my_reports: {
        Args: never
        Returns: {
          category: string
          created_at: string
          id: string
          reporter_note: string
          resolved_at: string
          status: string
          target_type: string
        }[]
      }
      my_rewards_summary: { Args: never; Returns: Json }
      my_routing_firms: {
        Args: never
        Returns: {
          firm_id: string
          firm_name: string
          member_role: string
        }[]
      }
      my_sessions: {
        Args: never
        Returns: {
          aal: string
          is_current: boolean
          last_seen_at: string
          session_id: string
          signed_in_at: string
          user_agent: string
        }[]
      }
      my_staff_access: { Args: never; Returns: Json }
      my_stay_details: { Args: { p_booking: string }; Returns: Json }
      my_unread_counts: {
        Args: never
        Returns: {
          as_agent: boolean
          conversation_id: string
          unread: number
        }[]
      }
      name_inspection_delegate: {
        Args: { p_email: string; p_inspection: string }
        Returns: Json
      }
      note_share_door_open: {
        Args: { p_token: string; p_viewer: string }
        Returns: undefined
      }
      notification_severity: {
        Args: {
          n_href: string
          n_kind: Database["public"]["Enums"]["notification_kind"]
          n_title: string
        }
        Returns: string
      }
      offer_business_transfer: {
        Args: {
          p_business: string
          p_from: string
          p_note: string
          p_to: string
        }
        Returns: Json
      }
      offer_renewal: {
        Args: {
          p_agency?: number
          p_agreement?: number
          p_legal?: number
          p_rent: number
          p_rent_payment: string
          p_service?: number
        }
        Returns: Json
      }
      open_account_deletion: { Args: { p_user: string }; Returns: Json }
      open_rent_charge: {
        Args: { p_inspection: string; p_move_in: string; p_tenant: string }
        Returns: Json
      }
      open_safety_holds: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          held_id: string
          held_name: string
          id: string
          report_id: string
        }[]
      }
      override_risk_class: {
        Args: {
          p_class: string
          p_reason: string
          p_review_due_at: string
          p_user: string
        }
        Returns: string
      }
      owner_heartbeat_answer: { Args: { p_listing: string }; Returns: Json }
      owner_heartbeats_open: {
        Args: never
        Returns: {
          asked_at: string
          listing_id: string
        }[]
      }
      passcode_set: {
        Args: { p_code: string; p_current?: string; p_length: number }
        Returns: Json
      }
      passcode_status: { Args: never; Returns: Json }
      passcode_verify: { Args: { p_code: string }; Returns: Json }
      payment_attempts_due_for_check: {
        Args: { p_limit?: number; p_mode: string }
        Returns: {
          booking_id: string
          checkout_opened_at: string
          created_at: string
          id: string
          paystack_mode: string
          processor_status: string
          provider_ref: string
        }[]
      }
      payment_split_for_booking: { Args: { p_booking: string }; Returns: Json }
      payment_split_for_rent_share: {
        Args: { p_payer: string; p_rent_payment: string }
        Returns: Json
      }
      pep_desk: { Args: never; Returns: Json }
      phone_otp_issue: {
        Args: { p_code: string; p_phone: string; p_user: string }
        Returns: string
      }
      plan_booking_refund: {
        Args: { p_parts?: Json; p_refund: string }
        Returns: Json
      }
      platform_stats: {
        Args: never
        Returns: {
          agents: number
          cities: number
          listings: number
          states: number
        }[]
      }
      post_brief: {
        Args: {
          p_areas: string[]
          p_bedrooms_min: number
          p_intent: string
          p_max_minor: number
          p_move_from: string
          p_property_type: string
          p_saved_search?: string
          p_state_code: string
        }
        Returns: string
      }
      profile_public_facts: {
        Args: { p_user: string }
        Returns: {
          lga: string
          occupation: string
          state: string
        }[]
      }
      profile_public_facts_many: {
        Args: { p_users: string[] }
        Returns: {
          lga: string
          occupation: string
          state: string
          user_id: string
        }[]
      }
      promotion_my_purchases: {
        Args: never
        Returns: {
          amount_minor: number
          created_at: string
          currency: string
          duration_days: number
          ends_at: string
          id: string
          listing_id: string
          paid_at: string
          starts_at: string
          status: string
          tier: string
        }[]
      }
      promotion_price_now: {
        Args: { p_tier: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "tier_prices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      promotion_purchase_mark: {
        Args: { p_reference: string; p_status: string }
        Returns: boolean
      }
      promotion_purchase_open: {
        Args: { p_listing: string; p_member: string; p_tier: string }
        Returns: Json
      }
      promotion_purchase_settle: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_reference: string
        }
        Returns: Json
      }
      property_candidates: {
        Args: { p_listing: string }
        Returns: {
          different_principal: boolean
          distance_m: number
          lister_name: string
          listing_id: string
          move_in_total_minor: number
          property_id: string
          reference: string
          same_principal: boolean
          same_shape: boolean
          status: Database["public"]["Enums"]["listing_status"]
          title: string
        }[]
      }
      property_join: {
        Args: { p_listing: string; p_other: string }
        Returns: string
      }
      property_keep_apart: {
        Args: { p_listing: string; p_other: string }
        Returns: undefined
      }
      property_offers: {
        Args: { p_listing: string }
        Returns: {
          availability_confirmed_at: string
          is_this_listing: boolean
          lister_name: string
          listing_id: string
          listing_role: Database["public"]["Enums"]["listing_role"]
          move_in_total_minor: number
          rent_amount_minor: number
          rent_period: Database["public"]["Enums"]["rent_period"]
          title: string
        }[]
      }
      property_split: { Args: { p_listing: string }; Returns: undefined }
      propose_caution_deduction: {
        Args: {
          p_amount: number
          p_item: string
          p_note?: string
          p_obligation: string
          p_photo: string
        }
        Returns: Json
      }
      provider_arrangement_observe: {
        Args: {
          p_arrangement: string
          p_detail?: Json
          p_milestones?: Json
          p_provider_amount_minor?: number
          p_provider_arrangement_id?: string
          p_provider_event_key?: string
          p_provider_fee_minor?: number
          p_provider_payment_token?: string
          p_provider_state?: string
          p_provider_status?: string
          p_source: string
          p_to_status: string
        }
        Returns: string
      }
      provider_arrangement_open: {
        Args: { p_agreement: string; p_kind: string; p_milestones?: Json }
        Returns: Json
      }
      purge_account_rows: { Args: { p_request: string }; Returns: Json }
      purge_job_runs: { Args: { p_keep_days?: number }; Returns: number }
      queue_assign: {
        Args: { p_batch?: string; p_item: string; p_kind: string; p_to: string }
        Returns: Json
      }
      queue_operators: {
        Args: never
        Returns: {
          name: string
          user_id: string
        }[]
      }
      queue_release: { Args: { p_item: string; p_kind: string }; Returns: Json }
      queue_take: {
        Args: { p_batch?: string; p_item: string; p_kind: string }
        Returns: Json
      }
      quote_listing_rate: { Args: { p_listing: string }; Returns: Json }
      record_area_pulse: {
        Args: { p_answer: string; p_area: string; p_kind: string }
        Returns: string
      }
      record_booking_no_show: {
        Args: { p_actor: string; p_booking: string; p_note?: string }
        Returns: Json
      }
      record_caution_return: {
        Args: {
          p_amount: number
          p_key: string
          p_method: string
          p_obligation: string
          p_reference: string
          p_returned_on: string
        }
        Returns: Json
      }
      record_credential: {
        Args: {
          p_company: string
          p_kind: string
          p_number: string
          p_register_name: string
          p_source: string
          p_subject: string
        }
        Returns: string
      }
      record_derived_risk_class: {
        Args: {
          p_class: string
          p_factors: Json
          p_reasons: string[]
          p_review_due_at: string
          p_user: string
        }
        Returns: string
      }
      record_funnel_event: {
        Args: {
          p_door?: string
          p_locale: string
          p_step: string
          p_surface: string
          p_visit: string
        }
        Returns: undefined
      }
      record_idempotency_result: {
        Args: { key: string; result: Json; scope: string; subject: string }
        Returns: boolean
      }
      record_idempotency_result_kept: {
        Args: {
          keep_seconds: number
          key: string
          result: Json
          scope: string
          subject: string
        }
        Returns: boolean
      }
      record_inspection_checkin: {
        Args: { p_inspection: string; p_observed_at: string; p_result: string }
        Returns: Json
      }
      record_job_run: {
        Args: { p_job: string; p_metadata?: Json; p_outcome: string }
        Returns: undefined
      }
      record_listing_views: {
        Args: { p_opened?: string; p_seen: string[]; p_viewer: string }
        Returns: undefined
      }
      record_price_check_event: {
        Args: {
          p_bedrooms?: number
          p_check_id: string
          p_comparable_count?: number
          p_confidence?: string
          p_dispersion?: number
          p_entry_point?: string
          p_geohash5?: string
          p_intent_chosen?: string
          p_lga_code?: string
          p_listing_id?: string
          p_listing_intent?: Database["public"]["Enums"]["listing_intent"]
          p_outcome?: string
          p_property_type?: Database["public"]["Enums"]["property_type"]
          p_radius_m?: number
          p_refusal_code?: string
          p_size_stated?: boolean
          p_stage: string
          p_state_code?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      record_principal_consent: {
        Args: {
          p_answer: string
          p_mandate: string
          p_note?: string
          p_sentence?: string
        }
        Returns: Json
      }
      record_processor_refund: {
        Args: { p_processor_id: string; p_refund: string; p_status: string }
        Returns: Json
      }
      record_processor_refund_outcome: {
        Args: {
          p_amount_minor: number
          p_processor_refund_id: string
          p_status: string
          p_transaction_reference: string
        }
        Returns: Json
      }
      record_refund_part: {
        Args: { p_part: string; p_processor_id: string; p_status: string }
        Returns: Json
      }
      record_rent_share_refund: {
        Args: { p_processor_id: string; p_refund: string; p_status: string }
        Returns: Json
      }
      record_search_demand: {
        Args: {
          p_area_key: string
          p_bedrooms_min: number
          p_budget_band: number
          p_market: string
          p_results: number
          p_state_code: string
          p_user: string
        }
        Returns: undefined
      }
      record_vnin_check: {
        Args: {
          p_legal_name: string
          p_matched: boolean
          p_nin_hmac: string
          p_note: string
          p_provider_ref: string
          p_user: string
        }
        Returns: string
      }
      referral_claim_code: { Args: { p_code: string }; Returns: string }
      referral_door: { Args: { p_code: string }; Returns: Json }
      referral_flag_clusters: { Args: { p_limit?: number }; Returns: number }
      referral_programme_status: { Args: never; Returns: Json }
      referral_qualify_pending: { Args: { p_limit?: number }; Returns: Json }
      referral_release_due: { Args: never; Returns: number }
      referral_reverse_for_chargeback: {
        Args: { p_reason: string; p_tx: string }
        Returns: number
      }
      refund_agent_check_slot: {
        Args: { p_bucket: string; p_window_start: string }
        Returns: undefined
      }
      refund_and_cancel_booking: {
        Args: {
          acting_admin: string
          decision_note?: string
          reason_code: string
          refund_amount: number
          refund_reference: string
          target_booking: string
        }
        Returns: Json
      }
      refund_booking_payment: {
        Args: {
          acting_admin: string
          decision_note?: string
          reason_code: string
          refund_amount: number
          refund_reference: string
          target_booking: string
        }
        Returns: Json
      }
      reinstate_agent: {
        Args: { acting_admin: string; note?: string; target_agent: string }
        Returns: Json
      }
      release_idempotency: {
        Args: { key: string; scope: string; subject: string }
        Returns: boolean
      }
      release_room_nights: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_room_type: string
          p_rooms: number
        }
        Returns: number
      }
      relist_from_tenancy: { Args: { p_rent_payment: string }; Returns: Json }
      remove_calendar_import: { Args: { p_import: string }; Returns: Json }
      remove_own_story_comment: {
        Args: { p_comment_id: string }
        Returns: string
      }
      remove_rent_contributor: {
        Args: { p_contributor: string }
        Returns: Json
      }
      rent_landlord_fact: { Args: { p_inspection: string }; Returns: Json }
      rent_share_refunds_due: {
        Args: { p_limit?: number }
        Returns: {
          amount_minor: number
          processor_status: string
          reference: string
          refund_id: string
        }[]
      }
      rent_share_refunds_stuck: {
        Args: never
        Returns: {
          amount_minor: number
          attempts: number
          claimed_at: string
          processor_status: string
          refund_id: string
          rent_payment_id: string
        }[]
      }
      rent_split_cancel_as: {
        Args: { p_actor: string; p_note?: string; p_rent_payment: string }
        Returns: Json
      }
      reopen_edd_review: { Args: { p_user: string }; Returns: string }
      reopen_listing: {
        Args: { p_listing: string; p_note: string }
        Returns: Json
      }
      report_commute: {
        Args: { p_anchor: string; p_area: string; p_minutes: number }
        Returns: string
      }
      report_door_charge: {
        Args: { p_asked?: number; p_booking: string }
        Returns: Json
      }
      report_not_me: { Args: never; Returns: Json }
      request_show_me: {
        Args: { p_conversation: string; p_item: string; p_note?: string }
        Returns: string
      }
      reservation_deposit_close: {
        Args: { p_reference: string; p_status: string }
        Returns: string
      }
      reservation_deposit_open: {
        Args: { p_guest: string; p_mode: string; p_reservation: string }
        Returns: Json
      }
      reservation_deposit_quote_for: {
        Args: { p_reservation: string }
        Returns: Json
      }
      reservation_deposit_refunded: {
        Args: { p_processor_refund_id: string; p_reference: string }
        Returns: string
      }
      reservation_deposit_settle: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_reference: string
        }
        Returns: Json
      }
      reserve_room_nights: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_rate_plan?: string
          p_room_type: string
          p_rooms: number
        }
        Returns: number
      }
      resolve_payment_rail: {
        Args: {
          p_at?: string
          p_lister_kind: Database["public"]["Enums"]["agent_type"]
          p_listing_intent: Database["public"]["Enums"]["listing_intent"]
          p_property_type: Database["public"]["Enums"]["property_type"]
        }
        Returns: Record<string, unknown>
      }
      respond_to_business_transfer: {
        Args: { p_accept: boolean; p_transfer: string; p_user: string }
        Returns: Json
      }
      review_kyc_document: {
        Args: { p_approve: boolean; p_document: string; p_reason: string }
        Returns: Json
      }
      revoke_receipt_code: { Args: { p_code_id: string }; Returns: Json }
      revoke_share_link: { Args: { p_token: string }; Returns: boolean }
      revoke_staff_role: {
        Args: {
          acting_admin: string
          old_role: Database["public"]["Enums"]["app_role"]
          target_user: string
        }
        Returns: Json
      }
      rewards_payout_claim_send: {
        Args: { p_reference: string }
        Returns: boolean
      }
      rewards_payout_open: {
        Args: {
          p_account_name: string
          p_account_number: string
          p_bank_code: string
          p_member: string
          p_recipient_code: string
        }
        Returns: Json
      }
      rewards_payout_settle: {
        Args: {
          p_outcome: string
          p_provider_status?: string
          p_reason?: string
          p_recipient_code?: string
          p_reference: string
          p_transfer_code?: string
        }
        Returns: Json
      }
      rewards_payout_webhook: {
        Args: {
          p_amount_minor: number
          p_event: string
          p_payload?: Json
          p_reference: string
          p_transfer_code?: string
        }
        Returns: Json
      }
      rewards_payouts_stuck: {
        Args: { p_older_than_hours?: number }
        Returns: {
          created_at: string
          initiated: boolean
          reference: string
          status: string
        }[]
      }
      rewards_payouts_to_send: {
        Args: { p_older_than_minutes?: number }
        Returns: {
          amount_minor: number
          recipient_code: string
          reference: string
        }[]
      }
      rewards_payouts_to_verify: {
        Args: { p_older_than_minutes?: number }
        Returns: {
          created_at: string
          reference: string
          status: string
        }[]
      }
      risk_desk: { Args: never; Returns: Json }
      risk_factors_for: { Args: { p_user: string }; Returns: Json }
      risk_people_due: {
        Args: { p_limit: number }
        Returns: {
          user_id: string
        }[]
      }
      rule_arrival_check: {
        Args: { p_booking: string; p_ruling: string }
        Returns: Json
      }
      safety_share_create: {
        Args: { p_inspection: string; p_minutes?: number }
        Returns: Json
      }
      safety_share_done: { Args: { p_inspection: string }; Returns: number }
      safety_share_read: { Args: { p_token: string }; Returns: Json }
      safety_share_stop: { Args: { p_inspection: string }; Returns: number }
      sanctions_claim_queue: {
        Args: { p_limit: number }
        Returns: {
          done_at: string | null
          enqueued_at: string
          id: number
          person_id: string | null
          subject_kind: string
          taken_at: string | null
          transaction_id: string | null
          transaction_kind: string | null
          trigger: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sanctions_screen_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      sanctions_desk: { Args: never; Returns: Json }
      sanctions_hit_approve: { Args: { p_decision: string }; Returns: Json }
      sanctions_hit_propose: {
        Args: { p_decision: string; p_hit: string; p_note: string }
        Returns: Json
      }
      sanctions_hit_reject: { Args: { p_decision: string }; Returns: Json }
      sanctions_list_activate: { Args: { p_version: string }; Returns: Json }
      sanctions_list_autoactivate: {
        Args: { p_version: string }
        Returns: Json
      }
      sanctions_lists_waiting: { Args: never; Returns: number }
      sanctions_renew_holds: { Args: never; Returns: number }
      save_tenancy_report: {
        Args: {
          p_items?: Json
          p_notes?: string
          p_rent_payment: string
          p_stage: string
          p_submit?: boolean
        }
        Returns: Json
      }
      scam_recall_preview: {
        Args: { p_suspension: string }
        Returns: {
          audience: number
          category: string
          lifted: boolean
          report_id: string
          report_resolved_at: string
          sent_at: string
          sent_category: string
          sent_to: number
        }[]
      }
      scam_recall_send: {
        Args: {
          p_body_about: string
          p_body_plain: string
          p_listing_fallback: string
          p_reason_pay: string
          p_reason_rules: string
          p_report: string
          p_suspension: string
          p_title: string
        }
        Returns: Json
      }
      schedule_account_deletion: {
        Args: { p_days: number; p_restore_code_hash: string; p_user: string }
        Returns: Json
      }
      set_enquiry_stage: {
        Args: { p_conversation: string; p_reason?: string; p_stage: string }
        Returns: undefined
      }
      set_fee_rate: {
        Args: {
          p_basis_points: number
          p_effective_from: string
          p_flat_minor: number
          p_kind: Database["public"]["Enums"]["fee_kind"]
          p_note: string
        }
        Returns: Json
      }
      set_firm_routing: {
        Args: {
          p_area_agents?: Json
          p_firm: string
          p_mode: string
          p_office_end?: string
          p_office_start?: string
        }
        Returns: undefined
      }
      set_listing_photo_phash: {
        Args: { p_hash: number; p_photo: string }
        Returns: boolean
      }
      set_listing_photo_slot: {
        Args: { p_photo: string; p_slot: string }
        Returns: Json
      }
      settle_booking_charge: {
        Args: {
          p_amount_minor: number
          p_fallback_booking?: string
          p_processor_fee_minor?: number
          p_reference: string
        }
        Returns: Json
      }
      settle_card_refund_claim: {
        Args: { p_key: string; p_processor_refund_id: string; p_state: string }
        Returns: Json
      }
      share_door: {
        Args: { p_token: string }
        Returns: {
          agency_fee_minor: number
          agreement_fee_minor: number
          area: string
          bedrooms: number
          caution_deposit_minor: number
          city: string
          is_demo: boolean
          legal_fee_minor: number
          listing_id: string
          listing_intent: string
          photo_path: string
          power_grid: string
          price_share_id: string
          property_type: string
          rate_minor: number
          rate_period: string
          reference: string
          rent_amount_minor: number
          rent_period: string
          sale_price_minor: number
          service_charge_minor: number
          service_charge_period: string
          state: string
          state_code: string
          state_name: string
          title: string
          total_move_in_cost_minor: number
          water_supply: string
        }[]
      }
      shell_context: { Args: never; Returns: Json }
      signup_method_for_email: { Args: { p_email: string }; Returns: string }
      social_follow_suggestions: {
        Args: {
          p_city?: string
          p_kind?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: {
          avatar_path: string
          city: string
          display_label: string
          handle: string
          kind: string
          published: number
          user_id: string
          verified: boolean
        }[]
      }
      staff_acknowledge_handbook: { Args: { p_version: string }; Returns: Json }
      staff_add_member_note: {
        Args: { p_body: string; p_scope?: string; p_subject: string }
        Returns: Json
      }
      staff_blocked_term_put: {
        Args: {
          p_action: string
          p_category: string
          p_reason: string
          p_refusal_reason?: string
          p_severity: Database["public"]["Enums"]["alert_severity"]
          p_term: string
        }
        Returns: undefined
      }
      staff_blocked_term_retire: {
        Args: { p_reason: string; p_term: string }
        Returns: undefined
      }
      staff_blocked_terms: {
        Args: never
        Returns: {
          action: string
          added_by: string
          category: string
          created_at: string
          reason: string
          refusal_reason: string
          retired_at: string
          retired_by: string
          retired_reason: string
          severity: Database["public"]["Enums"]["alert_severity"]
          term: string
        }[]
      }
      staff_chargebacks: {
        Args: never
        Returns: {
          amount_minor: number
          closed_at: string
          currency: string
          evidence_due_at: string
          id: string
          lister_unattributed: boolean
          lister_user_id: string
          opened_at: string
          provider: string
          provider_dispute_id: string
          provider_status: string
          recovered_minor: number
          recovery_closed_at: string
          recovery_state: string
          reference: string
          state: string
          transaction_id: string
        }[]
      }
      staff_member_notes: {
        Args: { p_subject: string }
        Returns: {
          author_name: string
          body: string
          created_at: string
          id: string
          mine: boolean
          scope: string
        }[]
      }
      staff_member_notes_for: {
        Args: { p_subjects: string[] }
        Returns: {
          author_name: string
          body: string
          created_at: string
          id: string
          mine: boolean
          scope: string
          subject_id: string
        }[]
      }
      start_direct_conversation: { Args: { p_other: string }; Returns: string }
      status_stats: {
        Args: { p_listing: string }
        Returns: {
          enquiries: number
          opens: number
        }[]
      }
      stays_search: {
        Args: {
          p_amenities?: string[]
          p_area?: string
          p_breakfast?: boolean
          p_check_in?: string
          p_check_out?: string
          p_city?: string
          p_entity_kinds?: Database["public"]["Enums"]["catalogue_entity_kind"][]
          p_free_cancellation?: boolean
          p_guests?: number
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_max_price_minor?: number
          p_min_price_minor?: number
          p_min_rating?: number
          p_offset?: number
          p_q?: string
          p_radius_m?: number
          p_room_categories?: Database["public"]["Enums"]["room_category"][]
          p_rooms?: number
          p_sort?: string
          p_state_code?: string
          p_verified?: boolean
        }
        Returns: {
          amenity_codes: string[]
          area: string
          city: string
          cover_path: string
          distance_m: number
          entity_id: string
          entity_kind: Database["public"]["Enums"]["catalogue_entity_kind"]
          featured: boolean
          has_breakfast: boolean
          has_free_cancellation: boolean
          headline_price_minor: number
          headline_price_period: string
          id: string
          is_demo: boolean
          kind: string
          latitude: number
          longitude: number
          max_sleeps: number
          nightly_minor: number
          nights: number
          price_band: number
          rate_plan_id: string
          rating_avg: number
          rating_count: number
          room_categories: Database["public"]["Enums"]["room_category"][]
          room_type_id: string
          source: Database["public"]["Enums"]["source_kind"]
          state_code: string
          title: string
          total_count: number
          total_minor: number
          verified: boolean
        }[]
      }
      stays_search_exact: {
        Args: {
          p_amenities?: string[]
          p_area?: string
          p_breakfast?: boolean
          p_check_in?: string
          p_check_out?: string
          p_city?: string
          p_entity_kinds?: Database["public"]["Enums"]["catalogue_entity_kind"][]
          p_free_cancellation?: boolean
          p_guests?: number
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_max_price_minor?: number
          p_min_price_minor?: number
          p_min_rating?: number
          p_offset?: number
          p_q?: string
          p_radius_m?: number
          p_room_categories?: Database["public"]["Enums"]["room_category"][]
          p_rooms?: number
          p_sort?: string
          p_state_code?: string
          p_verified?: boolean
        }
        Returns: {
          amenity_codes: string[]
          area: string
          city: string
          cover_path: string
          distance_m: number
          entity_id: string
          entity_kind: Database["public"]["Enums"]["catalogue_entity_kind"]
          featured: boolean
          has_breakfast: boolean
          has_free_cancellation: boolean
          headline_price_minor: number
          headline_price_period: string
          id: string
          is_demo: boolean
          kind: string
          latitude: number
          longitude: number
          max_sleeps: number
          nightly_minor: number
          nights: number
          price_band: number
          rate_plan_id: string
          rating_avg: number
          rating_count: number
          room_categories: Database["public"]["Enums"]["room_category"][]
          room_type_id: string
          source: Database["public"]["Enums"]["source_kind"]
          state_code: string
          title: string
          total_count: number
          total_minor: number
          verified: boolean
        }[]
      }
      stays_search_public: {
        Args: {
          p_amenities?: string[]
          p_area?: string
          p_breakfast?: boolean
          p_check_in?: string
          p_check_out?: string
          p_city?: string
          p_entity_kinds?: Database["public"]["Enums"]["catalogue_entity_kind"][]
          p_free_cancellation?: boolean
          p_guests?: number
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_max_price_minor?: number
          p_min_price_minor?: number
          p_min_rating?: number
          p_offset?: number
          p_q?: string
          p_radius_m?: number
          p_room_categories?: Database["public"]["Enums"]["room_category"][]
          p_rooms?: number
          p_sort?: string
          p_state_code?: string
          p_verified?: boolean
        }
        Returns: {
          amenity_codes: string[]
          area: string
          city: string
          cover_path: string
          distance_m: number
          entity_id: string
          entity_kind: Database["public"]["Enums"]["catalogue_entity_kind"]
          featured: boolean
          has_breakfast: boolean
          has_free_cancellation: boolean
          headline_price_minor: number
          headline_price_period: string
          id: string
          is_demo: boolean
          kind: string
          latitude: number
          longitude: number
          max_sleeps: number
          nightly_minor: number
          nights: number
          price_band: number
          rate_plan_id: string
          rating_avg: number
          rating_count: number
          room_categories: Database["public"]["Enums"]["room_category"][]
          room_type_id: string
          source: Database["public"]["Enums"]["source_kind"]
          state_code: string
          title: string
          total_count: number
          total_minor: number
          verified: boolean
        }[]
      }
      store_readiness_facts: { Args: never; Returns: Json }
      story_count: { Args: { p_author: string }; Returns: number }
      str_approve: {
        Args: { p_approve: boolean; p_decision: string; p_note: string }
        Returns: string
      }
      str_approve_release: { Args: { p_release: string }; Returns: string }
      str_cases: {
        Args: never
        Returns: {
          approved: boolean
          approver_id: string
          decided_at: string
          decided_by: string
          decision: string
          decision_id: string
          due_at: string
          grounds: string
          id: string
          links: Json
          opened_at: string
          opened_by: string
          overdue: boolean
          reasons: string
          source_id: string
          source_kind: string
          state: string
          subject_id: string
        }[]
      }
      str_decide: {
        Args: { p_case: string; p_decision: string; p_reasons: string }
        Returns: Json
      }
      str_link: {
        Args: { p_case: string; p_kind: string; p_ref: string }
        Returns: string
      }
      str_open_case: {
        Args: {
          p_grounds: string
          p_source_id: string
          p_source_kind: string
          p_subject: string
        }
        Returns: Json
      }
      str_pending_releases: {
        Args: never
        Returns: {
          case_id: string
          note: string
          release_id: string
          requested_at: string
          requested_by: string
        }[]
      }
      str_place_hold: { Args: { p_case: string }; Returns: Json }
      str_record_filing: {
        Args: { p_case: string; p_filed_at: string; p_goaml_reference: string }
        Returns: string
      }
      str_register: {
        Args: never
        Returns: {
          approver_id: string
          case_id: string
          decided_by: string
          filed_at: string
          goaml_reference: string
          recorded_at: string
          recorded_by: string
        }[]
      }
      str_release_hold: {
        Args: { p_case: string; p_note: string }
        Returns: Json
      }
      subscription_apply_event: {
        Args: {
          p_data: Json
          p_event: string
          p_event_key: string
          p_mode: string
        }
        Returns: Json
      }
      subscription_checkout_open: {
        Args: {
          p_amount_minor: number
          p_email_sha256: string
          p_mode: string
          p_plan_code: string
          p_plan_key: string
          p_user: string
        }
        Returns: Json
      }
      subscription_mark_cancelled: {
        Args: { p_subscription: string; p_user: string }
        Returns: Json
      }
      subscription_provider_plan_record: {
        Args: {
          p_amount_minor: number
          p_mode: string
          p_plan_code: string
          p_plan_key: string
        }
        Returns: string
      }
      subscription_start_trial: { Args: { p_plan_key: string }; Returns: Json }
      support_escalate_ticket: {
        Args: { p_reason: string; p_scope: string; p_ticket: string }
        Returns: Json
      }
      support_member_context: { Args: { p_ticket: string }; Returns: Json }
      support_return_escalation: {
        Args: { p_escalation: string; p_note: string }
        Returns: Json
      }
      support_ticket_escalations_for: {
        Args: { p_ticket: string }
        Returns: {
          escalated_at: string
          escalated_by_me: boolean
          escalated_by_name: string
          id: string
          reason: string
          return_note: string
          returned_at: string
          returned_by_name: string
          to_scope: string
        }[]
      }
      support_ticket_member_mark_read: {
        Args: { p_ticket: string }
        Returns: Json
      }
      support_ticket_member_rate: {
        Args: { p_comment: string; p_rating: number; p_ticket: string }
        Returns: Json
      }
      support_ticket_member_reopen: {
        Args: { p_ticket: string }
        Returns: Json
      }
      support_ticket_member_resolve: {
        Args: { p_ticket: string }
        Returns: Json
      }
      suspend_agent: {
        Args: {
          acting_admin: string
          stop_reason: string
          target_agent: string
        }
        Returns: Json
      }
      tax_line_at: { Args: { p_at?: string; p_kind: string }; Returns: Json }
      tenancy_is_void: { Args: { p_rent_payment: string }; Returns: boolean }
      thread_counterpart_facts: {
        Args: { p_conversation: string }
        Returns: {
          identity_nimc_at: string
          identity_seen_at: string
          member_since: string
          phone_confirmed: boolean
          viewings_arranged: number
        }[]
      }
      thread_counterpart_record: {
        Args: { p_conversation: string }
        Returns: {
          answered_in_day: number
          described: number
          described_of: number
          display_name: string
          enquiries: number
          kept: number
          kept_of: number
          lets: number
          record_code: string
          replied: number
          reply_median_minutes: number
          since: string
          stopped: boolean
          stopped_at: string
        }[]
      }
      threshold_lane: {
        Args: { p_closed?: number; p_open?: number }
        Returns: Json
      }
      unaccent_immutable: { Args: { input: string }; Returns: string }
      uphold_stop_as_fraud: {
        Args: { p_note: string; p_suspension: string }
        Returns: Json
      }
      verification_is_required: { Args: { p_user: string }; Returns: boolean }
      verify_payout_account: {
        Args: {
          p_account: string
          p_identity_name: string
          p_resolved_name: string
        }
        Returns: Json
      }
      verify_receipt: {
        Args: { p_code: string; p_subject?: string }
        Returns: Json
      }
      viewing_slots: {
        Args: { p_days?: number; p_listing: string }
        Returns: {
          slot_at: string
          slot_minutes: number
          window_id: string
        }[]
      }
      weight_withheld_reasons: {
        Args: never
        Returns: {
          kind: string
          reasons: string[]
          stamped_at: string
          subject_id: string
        }[]
      }
      widget_next_up: { Args: { p_token_hash: string }; Returns: Json }
      withdraw_business_transfer: {
        Args: { p_transfer: string; p_user: string }
        Returns: Json
      }
      withdraw_my_report: { Args: { p_report: string }; Returns: Json }
      withdrawal_fee_quote: {
        Args: { p_amount_minor: number; p_at?: string }
        Returns: Json
      }
    }
    Enums: {
      agent_application_status:
        | "DRAFT"
        | "SUBMITTED"
        | "UNDER_REVIEW"
        | "MORE_INFO_REQUIRED"
        | "APPROVED"
        | "REJECTED"
        | "SUSPENDED"
      agent_type: "individual" | "business"
      agreement_status:
        | "awaiting_parties"
        | "in_review"
        | "approved"
        | "rejected"
        | "cancelled"
        | "paid"
      alert_severity: "low" | "medium" | "high"
      alert_status: "open" | "resolved"
      app_role: "user" | "agent" | "admin" | "super_admin"
      area_kind: "CITY" | "AREA" | "ESTATE" | "CAMPUS"
      area_residency_source: "STAY" | "INVITE" | "PRESENCE" | "ADMIN"
      area_role: "MEMBER" | "RESIDENT" | "MODERATOR"
      area_status: "PROPOSED" | "ACTIVE" | "PAUSED" | "ARCHIVED" | "REJECTED"
      availability_answer: "available" | "available_later" | "let"
      availability_status: "available" | "booked" | "unavailable"
      badge_audience: "AGENT" | "MEMBER"
      badge_tier: "none" | "gold" | "platinum"
      booking_status:
        | "PENDING"
        | "CONFIRMED"
        | "COMPLETED"
        | "NO_SHOW"
        | "CANCELLED"
      build_condition: "newly_built" | "renovated" | "old" | "off_plan"
      business_kind:
        | "hotel"
        | "serviced_apartments"
        | "guest_house"
        | "resort"
        | "shortlet_operator"
        | "restaurant"
        | "agency"
      catalogue_entity_kind: "listing" | "accommodation" | "restaurant"
      document_review_status: "pending" | "approved" | "rejected"
      document_subtype:
        | "passport"
        | "drivers_licence"
        | "nin_card"
        | "voters_card"
        | "national_id"
        | "utility_bill"
        | "bank_statement"
        | "tenancy_agreement"
        | "cac_certificate"
        | "tax_certificate"
        | "business_address_proof"
        | "certificate_of_occupancy"
        | "deed_of_assignment"
        | "governors_consent"
        | "survey_plan"
        | "land_use_charge_receipt"
        | "gazette"
        | "mandate_letter"
        | "lasrera_certificate"
        | "esvarbon_certificate"
      event_attendance: "GOING" | "WAITLIST" | "WITHDRAWN"
      event_status: "DRAFT" | "LIVE" | "HELD" | "CANCELLED" | "REMOVED"
      event_venue_kind: "PUBLIC_VENUE" | "ESTATE_COMMON" | "ONLINE"
      fee_kind: "commission" | "listing_fee"
      fulfilment_mode: "vallo" | "external_completion" | "partner_handoff"
      furnishing: "unfurnished" | "semi_furnished" | "fully_furnished"
      geopolitical_zone:
        | "north_central"
        | "north_east"
        | "north_west"
        | "south_east"
        | "south_south"
        | "south_west"
      inspection_state:
        | "REQUESTED"
        | "CONFIRMED"
        | "PROPOSED"
        | "DECLINED"
        | "COMPLETED"
        | "WITHDRAWN"
        | "NO_SHOW"
      land_tenure:
        | "certificate_of_occupancy"
        | "governors_consent"
        | "deed_of_assignment"
        | "gazette"
        | "freehold"
        | "leasehold"
      landmark_kind:
        | "airport"
        | "business_district"
        | "market"
        | "mall"
        | "stadium"
        | "beach"
        | "park"
        | "transport"
        | "education"
        | "hospital"
        | "worship"
        | "other"
      listing_intent: "rent" | "sale"
      listing_role: "owner" | "agent" | "firm"
      listing_status:
        | "DRAFT"
        | "SUBMITTED"
        | "UNDER_REVIEW"
        | "MORE_INFO_REQUIRED"
        | "APPROVED"
        | "PUBLISHED"
        | "REJECTED"
        | "SUSPENDED"
      locale: "en" | "yo" | "ha" | "ig"
      meal_plan: "room_only" | "breakfast" | "half_board" | "full_board"
      message_flag_reason: "account_number" | "payment_keyword"
      message_flag_status: "open" | "reviewed"
      moderator_application_status:
        | "PENDING"
        | "APPROVED"
        | "DECLINED"
        | "WITHDRAWN"
      notification_kind:
        | "booking"
        | "message"
        | "wallet"
        | "listing"
        | "agent"
        | "support"
        | "system"
        | "social"
      post_author_kind: "USER" | "BOT" | "SYSTEM"
      post_kind: "GIST" | "ASK" | "REPLY" | "SHOWCASE" | "SYSTEM" | "STORY"
      post_mark: "LIKE" | "SAVE"
      power_backup:
        | "NONE"
        | "GENERATOR"
        | "INVERTER"
        | "SOLAR"
        | "GENERATOR_INVERTER"
      power_grid: "BAND_A" | "MOSTLY_ON" | "PATCHY" | "RARELY" | "NONE"
      price_check_share_scope: "area" | "area_and_type"
      property_type:
        | "apartment"
        | "hotel"
        | "home"
        | "villa"
        | "shortlet"
        | "rental"
        | "shop"
        | "office"
        | "land"
        | "restaurant"
      push_delivery_state: "sending" | "sent" | "failed" | "gone"
      push_platform: "web" | "ios" | "android"
      push_queue_outcome:
        | "delivered"
        | "suppressed_preference"
        | "suppressed_no_device"
        | "suppressed_expired"
        | "collapsed"
        | "gave_up"
      push_queue_state:
        | "pending"
        | "held"
        | "sending"
        | "done"
        | "failed"
        | "dead"
      push_revoked_reason:
        | "by_person"
        | "provider_gone"
        | "provider_invalid"
        | "repeated_failure"
        | "signed_out"
      rate_period: "night" | "guest"
      rent_period: "month" | "quarter" | "year"
      report_status:
        | "open"
        | "reviewing"
        | "resolved"
        | "dismissed"
        | "withdrawn"
      revenue_source: "escrow_commission" | "listing_fee"
      room_category:
        | "entire_flat"
        | "whole_house"
        | "private_room"
        | "single"
        | "double"
        | "twin"
        | "suite"
        | "family"
        | "dorm"
      sale_status: "available" | "under_offer" | "sold"
      signup_role: "renter" | "buyer" | "landlord" | "seller" | "agent"
      social_status: "LIVE" | "HELD" | "REMOVED"
      source_kind: "first_party" | "partner" | "licensed_data"
      staff_scope:
        | "listing_approval"
        | "kyc_review"
        | "moderation"
        | "support"
        | "agreements"
        | "guarantee"
        | "finance"
        | "compliance"
        | "operations"
      supply_role: "owner" | "agent"
      support_ticket_status: "open" | "pending" | "resolved" | "closed"
      thread_context:
        | "listing"
        | "reservation"
        | "booking"
        | "business"
        | "direct"
      transaction_status:
        | "SUCCESSFUL"
        | "PENDING"
        | "FAILED"
        | "REFUNDED"
        | "ABANDONED"
      unit_shape:
        | "self_contain"
        | "room_parlour"
        | "mini_flat"
        | "flat"
        | "duplex"
        | "terrace"
        | "semi_detached"
        | "detached"
        | "bungalow"
        | "maisonette"
        | "penthouse"
        | "boys_quarters"
      water_supply:
        | "TREATED_MAINS"
        | "BOREHOLE"
        | "PUMPED_STORAGE"
        | "TANKER"
        | "NONE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_application_status: [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "MORE_INFO_REQUIRED",
        "APPROVED",
        "REJECTED",
        "SUSPENDED",
      ],
      agent_type: ["individual", "business"],
      agreement_status: [
        "awaiting_parties",
        "in_review",
        "approved",
        "rejected",
        "cancelled",
        "paid",
      ],
      alert_severity: ["low", "medium", "high"],
      alert_status: ["open", "resolved"],
      app_role: ["user", "agent", "admin", "super_admin"],
      area_kind: ["CITY", "AREA", "ESTATE", "CAMPUS"],
      area_residency_source: ["STAY", "INVITE", "PRESENCE", "ADMIN"],
      area_role: ["MEMBER", "RESIDENT", "MODERATOR"],
      area_status: ["PROPOSED", "ACTIVE", "PAUSED", "ARCHIVED", "REJECTED"],
      availability_answer: ["available", "available_later", "let"],
      availability_status: ["available", "booked", "unavailable"],
      badge_audience: ["AGENT", "MEMBER"],
      badge_tier: ["none", "gold", "platinum"],
      booking_status: [
        "PENDING",
        "CONFIRMED",
        "COMPLETED",
        "NO_SHOW",
        "CANCELLED",
      ],
      build_condition: ["newly_built", "renovated", "old", "off_plan"],
      business_kind: [
        "hotel",
        "serviced_apartments",
        "guest_house",
        "resort",
        "shortlet_operator",
        "restaurant",
        "agency",
      ],
      catalogue_entity_kind: ["listing", "accommodation", "restaurant"],
      document_review_status: ["pending", "approved", "rejected"],
      document_subtype: [
        "passport",
        "drivers_licence",
        "nin_card",
        "voters_card",
        "national_id",
        "utility_bill",
        "bank_statement",
        "tenancy_agreement",
        "cac_certificate",
        "tax_certificate",
        "business_address_proof",
        "certificate_of_occupancy",
        "deed_of_assignment",
        "governors_consent",
        "survey_plan",
        "land_use_charge_receipt",
        "gazette",
        "mandate_letter",
        "lasrera_certificate",
        "esvarbon_certificate",
      ],
      event_attendance: ["GOING", "WAITLIST", "WITHDRAWN"],
      event_status: ["DRAFT", "LIVE", "HELD", "CANCELLED", "REMOVED"],
      event_venue_kind: ["PUBLIC_VENUE", "ESTATE_COMMON", "ONLINE"],
      fee_kind: ["commission", "listing_fee"],
      fulfilment_mode: ["vallo", "external_completion", "partner_handoff"],
      furnishing: ["unfurnished", "semi_furnished", "fully_furnished"],
      geopolitical_zone: [
        "north_central",
        "north_east",
        "north_west",
        "south_east",
        "south_south",
        "south_west",
      ],
      inspection_state: [
        "REQUESTED",
        "CONFIRMED",
        "PROPOSED",
        "DECLINED",
        "COMPLETED",
        "WITHDRAWN",
        "NO_SHOW",
      ],
      land_tenure: [
        "certificate_of_occupancy",
        "governors_consent",
        "deed_of_assignment",
        "gazette",
        "freehold",
        "leasehold",
      ],
      landmark_kind: [
        "airport",
        "business_district",
        "market",
        "mall",
        "stadium",
        "beach",
        "park",
        "transport",
        "education",
        "hospital",
        "worship",
        "other",
      ],
      listing_intent: ["rent", "sale"],
      listing_role: ["owner", "agent", "firm"],
      listing_status: [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "MORE_INFO_REQUIRED",
        "APPROVED",
        "PUBLISHED",
        "REJECTED",
        "SUSPENDED",
      ],
      locale: ["en", "yo", "ha", "ig"],
      meal_plan: ["room_only", "breakfast", "half_board", "full_board"],
      message_flag_reason: ["account_number", "payment_keyword"],
      message_flag_status: ["open", "reviewed"],
      moderator_application_status: [
        "PENDING",
        "APPROVED",
        "DECLINED",
        "WITHDRAWN",
      ],
      notification_kind: [
        "booking",
        "message",
        "wallet",
        "listing",
        "agent",
        "support",
        "system",
        "social",
      ],
      post_author_kind: ["USER", "BOT", "SYSTEM"],
      post_kind: ["GIST", "ASK", "REPLY", "SHOWCASE", "SYSTEM", "STORY"],
      post_mark: ["LIKE", "SAVE"],
      power_backup: [
        "NONE",
        "GENERATOR",
        "INVERTER",
        "SOLAR",
        "GENERATOR_INVERTER",
      ],
      power_grid: ["BAND_A", "MOSTLY_ON", "PATCHY", "RARELY", "NONE"],
      price_check_share_scope: ["area", "area_and_type"],
      property_type: [
        "apartment",
        "hotel",
        "home",
        "villa",
        "shortlet",
        "rental",
        "shop",
        "office",
        "land",
        "restaurant",
      ],
      push_delivery_state: ["sending", "sent", "failed", "gone"],
      push_platform: ["web", "ios", "android"],
      push_queue_outcome: [
        "delivered",
        "suppressed_preference",
        "suppressed_no_device",
        "suppressed_expired",
        "collapsed",
        "gave_up",
      ],
      push_queue_state: [
        "pending",
        "held",
        "sending",
        "done",
        "failed",
        "dead",
      ],
      push_revoked_reason: [
        "by_person",
        "provider_gone",
        "provider_invalid",
        "repeated_failure",
        "signed_out",
      ],
      rate_period: ["night", "guest"],
      rent_period: ["month", "quarter", "year"],
      report_status: [
        "open",
        "reviewing",
        "resolved",
        "dismissed",
        "withdrawn",
      ],
      revenue_source: ["escrow_commission", "listing_fee"],
      room_category: [
        "entire_flat",
        "whole_house",
        "private_room",
        "single",
        "double",
        "twin",
        "suite",
        "family",
        "dorm",
      ],
      sale_status: ["available", "under_offer", "sold"],
      signup_role: ["renter", "buyer", "landlord", "seller", "agent"],
      social_status: ["LIVE", "HELD", "REMOVED"],
      source_kind: ["first_party", "partner", "licensed_data"],
      staff_scope: [
        "listing_approval",
        "kyc_review",
        "moderation",
        "support",
        "agreements",
        "guarantee",
        "finance",
        "compliance",
        "operations",
      ],
      supply_role: ["owner", "agent"],
      support_ticket_status: ["open", "pending", "resolved", "closed"],
      thread_context: [
        "listing",
        "reservation",
        "booking",
        "business",
        "direct",
      ],
      transaction_status: [
        "SUCCESSFUL",
        "PENDING",
        "FAILED",
        "REFUNDED",
        "ABANDONED",
      ],
      unit_shape: [
        "self_contain",
        "room_parlour",
        "mini_flat",
        "flat",
        "duplex",
        "terrace",
        "semi_detached",
        "detached",
        "bungalow",
        "maisonette",
        "penthouse",
        "boys_quarters",
      ],
      water_supply: [
        "TREATED_MAINS",
        "BOREHOLE",
        "PUMPED_STORAGE",
        "TANKER",
        "NONE",
      ],
    },
  },
} as const
