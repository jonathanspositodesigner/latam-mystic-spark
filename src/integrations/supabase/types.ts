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
      abandoned_checkouts: {
        Row: {
          abandoned_at: string | null
          amount: number | null
          checkout_link: string | null
          checkout_step: number | null
          contacted_at: string | null
          cpf: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          notes: string | null
          offer_name: string | null
          phone: string | null
          product_id: number | null
          product_name: string | null
          remarketing_email_sent_at: string | null
          remarketing_status: string | null
          updated_at: string | null
        }
        Insert: {
          abandoned_at?: string | null
          amount?: number | null
          checkout_link?: string | null
          checkout_step?: number | null
          contacted_at?: string | null
          cpf?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          notes?: string | null
          offer_name?: string | null
          phone?: string | null
          product_id?: number | null
          product_name?: string | null
          remarketing_email_sent_at?: string | null
          remarketing_status?: string | null
          updated_at?: string | null
        }
        Update: {
          abandoned_at?: string | null
          amount?: number | null
          checkout_link?: string | null
          checkout_step?: number | null
          contacted_at?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          notes?: string | null
          offer_name?: string | null
          phone?: string | null
          product_id?: number | null
          product_name?: string | null
          remarketing_email_sent_at?: string | null
          remarketing_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_artes: {
        Row: {
          bonus_clicks: number | null
          canva_link: string | null
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          download_url: string | null
          drive_link: string | null
          id: string
          image_url: string
          is_active: boolean | null
          is_premium: boolean | null
          motion_type: string | null
          pack: string | null
          title: string
          tutorial_url: string | null
        }
        Insert: {
          bonus_clicks?: number | null
          canva_link?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          download_url?: string | null
          drive_link?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          is_premium?: boolean | null
          motion_type?: string | null
          pack?: string | null
          title: string
          tutorial_url?: string | null
        }
        Update: {
          bonus_clicks?: number | null
          canva_link?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          download_url?: string | null
          drive_link?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          motion_type?: string | null
          pack?: string | null
          title?: string
          tutorial_url?: string | null
        }
        Relationships: []
      }
      admin_goals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          is_completed: boolean | null
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          is_completed?: boolean | null
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          is_completed?: boolean | null
          title?: string
        }
        Relationships: []
      }
      ai_tool_library_categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          slug: string
          tool_slug: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          slug: string
          tool_slug: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          slug?: string
          tool_slug?: string
        }
        Relationships: []
      }
      ai_tool_library_items: {
        Row: {
          category_id: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_visible: boolean | null
          source_id: string
          tool_slug: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_visible?: boolean | null
          source_id: string
          tool_slug: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_visible?: boolean | null
          source_id?: string
          tool_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_library_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ai_tool_library_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_settings: {
        Row: {
          api_cost: number
          credit_cost: number
          has_api_cost: boolean
          tool_name: string
          updated_at: string | null
        }
        Insert: {
          api_cost?: number
          credit_cost?: number
          has_api_cost?: boolean
          tool_name: string
          updated_at?: string | null
        }
        Update: {
          api_cost?: number
          credit_cost?: number
          has_api_cost?: boolean
          tool_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_installations: {
        Row: {
          created_at: string | null
          device_type: string
          id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          device_type?: string
          id?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          device_type?: string
          id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      artes_banners: {
        Row: {
          button_link: string
          button_text: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean | null
          mobile_image_url: string | null
          title: string
        }
        Insert: {
          button_link: string
          button_text?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          mobile_image_url?: string | null
          title: string
        }
        Update: {
          button_link?: string
          button_text?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          mobile_image_url?: string | null
          title?: string
        }
        Relationships: []
      }
      artes_categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          platform: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          platform?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          platform?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      artes_packs: {
        Row: {
          checkout_link_1_ano: string | null
          checkout_link_6_meses: string | null
          checkout_link_membro_1_ano: string | null
          checkout_link_membro_6_meses: string | null
          checkout_link_membro_vitalicio: string | null
          checkout_link_renovacao_1_ano: string | null
          checkout_link_renovacao_6_meses: string | null
          checkout_link_renovacao_vitalicio: string | null
          checkout_link_vitalicio: string | null
          cover_url: string | null
          created_at: string | null
          display_order: number | null
          download_url: string | null
          enabled_1_ano: boolean | null
          enabled_6_meses: boolean | null
          enabled_vitalicio: boolean | null
          greenn_product_id_1_ano: number | null
          greenn_product_id_6_meses: number | null
          greenn_product_id_order_bump: number | null
          greenn_product_id_vitalicio: number | null
          id: string
          is_visible: boolean | null
          name: string
          price_1_ano: number | null
          price_6_meses: number | null
          price_vitalicio: number | null
          slug: string | null
          tool_versions: Json | null
          tutorial_lessons: Json | null
          type: string | null
        }
        Insert: {
          checkout_link_1_ano?: string | null
          checkout_link_6_meses?: string | null
          checkout_link_membro_1_ano?: string | null
          checkout_link_membro_6_meses?: string | null
          checkout_link_membro_vitalicio?: string | null
          checkout_link_renovacao_1_ano?: string | null
          checkout_link_renovacao_6_meses?: string | null
          checkout_link_renovacao_vitalicio?: string | null
          checkout_link_vitalicio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_order?: number | null
          download_url?: string | null
          enabled_1_ano?: boolean | null
          enabled_6_meses?: boolean | null
          enabled_vitalicio?: boolean | null
          greenn_product_id_1_ano?: number | null
          greenn_product_id_6_meses?: number | null
          greenn_product_id_order_bump?: number | null
          greenn_product_id_vitalicio?: number | null
          id?: string
          is_visible?: boolean | null
          name: string
          price_1_ano?: number | null
          price_6_meses?: number | null
          price_vitalicio?: number | null
          slug?: string | null
          tool_versions?: Json | null
          tutorial_lessons?: Json | null
          type?: string | null
        }
        Update: {
          checkout_link_1_ano?: string | null
          checkout_link_6_meses?: string | null
          checkout_link_membro_1_ano?: string | null
          checkout_link_membro_6_meses?: string | null
          checkout_link_membro_vitalicio?: string | null
          checkout_link_renovacao_1_ano?: string | null
          checkout_link_renovacao_6_meses?: string | null
          checkout_link_renovacao_vitalicio?: string | null
          checkout_link_vitalicio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_order?: number | null
          download_url?: string | null
          enabled_1_ano?: boolean | null
          enabled_6_meses?: boolean | null
          enabled_vitalicio?: boolean | null
          greenn_product_id_1_ano?: number | null
          greenn_product_id_6_meses?: number | null
          greenn_product_id_order_bump?: number | null
          greenn_product_id_vitalicio?: number | null
          id?: string
          is_visible?: boolean | null
          name?: string
          price_1_ano?: number | null
          price_6_meses?: number | null
          price_vitalicio?: number | null
          slug?: string | null
          tool_versions?: Json | null
          tutorial_lessons?: Json | null
          type?: string | null
        }
        Relationships: []
      }
      blacklisted_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      bug_notification_log: {
        Row: {
          context: Json | null
          error_key: string
          error_message: string | null
          error_type: string | null
          id: string
          sent_at: string
        }
        Insert: {
          context?: Json | null
          error_key: string
          error_message?: string | null
          error_type?: string | null
          id?: string
          sent_at?: string
        }
        Update: {
          context?: Json | null
          error_key?: string
          error_message?: string | null
          error_type?: string | null
          id?: string
          sent_at?: string
        }
        Relationships: []
      }
      device_signups: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      email_confirmation_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          name: string
          sender_email: string | null
          sender_name: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          name: string
          sender_email?: string | null
          sender_name?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          name?: string
          sender_email?: string | null
          sender_name?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      flyer_maker_jobs: {
        Row: {
          address: string | null
          api_account: string
          artist_count: number | null
          artist_names: string | null
          artist_photo_file_names: Json | null
          artist_photo_urls: Json | null
          completed_at: string | null
          created_at: string | null
          creativity: number | null
          credits_charged: boolean | null
          credits_refunded: boolean | null
          current_step: string | null
          date_time_location: string | null
          error_message: string | null
          failed_at_step: string | null
          footer_promo: string | null
          id: string
          image_size: string | null
          job_payload: Json | null
          logo_file_name: string | null
          logo_url: string | null
          output_url: string | null
          position: number | null
          queue_wait_seconds: number | null
          raw_api_response: Json | null
          raw_webhook_payload: Json | null
          reference_file_name: string | null
          reference_image_url: string | null
          reference_prompt_id: string | null
          rh_cost: number | null
          session_id: string
          started_at: string | null
          status: string
          step_history: Json | null
          task_id: string | null
          thumbnail_url: string | null
          title: string | null
          tool_type: string | null
          updated_at: string | null
          user_credit_cost: number | null
          user_id: string | null
          waited_in_queue: boolean | null
        }
        Insert: {
          address?: string | null
          api_account?: string
          artist_count?: number | null
          artist_names?: string | null
          artist_photo_file_names?: Json | null
          artist_photo_urls?: Json | null
          completed_at?: string | null
          created_at?: string | null
          creativity?: number | null
          credits_charged?: boolean | null
          credits_refunded?: boolean | null
          current_step?: string | null
          date_time_location?: string | null
          error_message?: string | null
          failed_at_step?: string | null
          footer_promo?: string | null
          id?: string
          image_size?: string | null
          job_payload?: Json | null
          logo_file_name?: string | null
          logo_url?: string | null
          output_url?: string | null
          position?: number | null
          queue_wait_seconds?: number | null
          raw_api_response?: Json | null
          raw_webhook_payload?: Json | null
          reference_file_name?: string | null
          reference_image_url?: string | null
          reference_prompt_id?: string | null
          rh_cost?: number | null
          session_id: string
          started_at?: string | null
          status?: string
          step_history?: Json | null
          task_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          tool_type?: string | null
          updated_at?: string | null
          user_credit_cost?: number | null
          user_id?: string | null
          waited_in_queue?: boolean | null
        }
        Update: {
          address?: string | null
          api_account?: string
          artist_count?: number | null
          artist_names?: string | null
          artist_photo_file_names?: Json | null
          artist_photo_urls?: Json | null
          completed_at?: string | null
          created_at?: string | null
          creativity?: number | null
          credits_charged?: boolean | null
          credits_refunded?: boolean | null
          current_step?: string | null
          date_time_location?: string | null
          error_message?: string | null
          failed_at_step?: string | null
          footer_promo?: string | null
          id?: string
          image_size?: string | null
          job_payload?: Json | null
          logo_file_name?: string | null
          logo_url?: string | null
          output_url?: string | null
          position?: number | null
          queue_wait_seconds?: number | null
          raw_api_response?: Json | null
          raw_webhook_payload?: Json | null
          reference_file_name?: string | null
          reference_image_url?: string | null
          reference_prompt_id?: string | null
          rh_cost?: number | null
          session_id?: string
          started_at?: string | null
          status?: string
          step_history?: Json | null
          task_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          tool_type?: string | null
          updated_at?: string | null
          user_credit_cost?: number | null
          user_id?: string | null
          waited_in_queue?: boolean | null
        }
        Relationships: []
      }
      flyer_maker_test_credits: {
        Row: {
          balance: number
          created_at: string
          granted_amount: number
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          granted_amount?: number
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          granted_amount?: number
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      image_generator_jobs: {
        Row: {
          aspect_ratio: string | null
          created_at: string | null
          credits_charged: boolean | null
          current_step: string | null
          error_message: string | null
          id: string
          model: string | null
          output_url: string | null
          prompt: string
          session_id: string | null
          status: string | null
          step_history: Json | null
          task_id: string | null
          updated_at: string | null
          user_credit_cost: number | null
          user_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string | null
          credits_charged?: boolean | null
          current_step?: string | null
          error_message?: string | null
          id?: string
          model?: string | null
          output_url?: string | null
          prompt: string
          session_id?: string | null
          status?: string | null
          step_history?: Json | null
          task_id?: string | null
          updated_at?: string | null
          user_credit_cost?: number | null
          user_id: string
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string | null
          credits_charged?: boolean | null
          current_step?: string | null
          error_message?: string | null
          id?: string
          model?: string | null
          output_url?: string | null
          prompt?: string
          session_id?: string | null
          status?: string | null
          step_history?: Json | null
          task_id?: string | null
          updated_at?: string | null
          user_credit_cost?: number | null
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      partner_artes: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          bonus_clicks: number | null
          canva_link: string | null
          category: string
          created_at: string | null
          deletion_requested: boolean | null
          description: string | null
          drive_link: string | null
          id: string
          image_url: string
          is_premium: boolean | null
          pack: string | null
          partner_id: string | null
          rejected: boolean | null
          rejected_at: string | null
          rejected_by: string | null
          title: string
          tutorial_url: string | null
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          bonus_clicks?: number | null
          canva_link?: string | null
          category: string
          created_at?: string | null
          deletion_requested?: boolean | null
          description?: string | null
          drive_link?: string | null
          id?: string
          image_url: string
          is_premium?: boolean | null
          pack?: string | null
          partner_id?: string | null
          rejected?: boolean | null
          rejected_at?: string | null
          rejected_by?: string | null
          title: string
          tutorial_url?: string | null
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          bonus_clicks?: number | null
          canva_link?: string | null
          category?: string
          created_at?: string | null
          deletion_requested?: boolean | null
          description?: string | null
          drive_link?: string | null
          id?: string
          image_url?: string
          is_premium?: boolean | null
          pack?: string | null
          partner_id?: string | null
          rejected?: boolean | null
          rejected_at?: string | null
          rejected_by?: string | null
          title?: string
          tutorial_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_artes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_platforms: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          partner_id: string
          platform: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          partner_id: string
          platform: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          partner_id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_platforms_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      premium_artes_users: {
        Row: {
          created_at: string | null
          expires_at: string | null
          external_id: string | null
          id: string
          is_active: boolean | null
          pack_slug: string | null
          payment_gateway: string | null
          plan_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          pack_slug?: string | null
          payment_gateway?: string | null
          plan_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          pack_slug?: string | null
          payment_gateway?: string | null
          plan_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          email_verified: boolean | null
          has_logged_in: boolean | null
          id: string
          name: string | null
          password_changed: boolean | null
          phone: string | null
          recovery_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          has_logged_in?: boolean | null
          id: string
          name?: string | null
          password_changed?: boolean | null
          phone?: string | null
          recovery_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          has_logged_in?: boolean | null
          id?: string
          name?: string | null
          password_changed?: boolean | null
          phone?: string | null
          recovery_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_notification_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          name: string
          title: string
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          name: string
          title: string
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          name?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          endpoint: string
          id: string
          ip_address: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          endpoint: string
          id?: string
          ip_address: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          endpoint?: string
          id?: string
          ip_address?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      seedance_jobs: {
        Row: {
          aspect_ratio: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string | null
          credits_charged: number | null
          credits_refunded: number
          duration: number | null
          error_message: string | null
          generate_audio: boolean | null
          generation_type: string | null
          id: string
          input_audio_urls: string[] | null
          input_image_urls: string[] | null
          input_video_urls: string[] | null
          model: string
          output_url: string | null
          prompt: string
          quality: string | null
          reference_prompt_id: string | null
          refunded_at: string | null
          rh_cost: number | null
          source_tool: string | null
          status: string | null
          task_id: string | null
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_charged?: number | null
          credits_refunded?: number
          duration?: number | null
          error_message?: string | null
          generate_audio?: boolean | null
          generation_type?: string | null
          id?: string
          input_audio_urls?: string[] | null
          input_image_urls?: string[] | null
          input_video_urls?: string[] | null
          model: string
          output_url?: string | null
          prompt: string
          quality?: string | null
          reference_prompt_id?: string | null
          refunded_at?: string | null
          rh_cost?: number | null
          source_tool?: string | null
          status?: string | null
          task_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aspect_ratio?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_charged?: number | null
          credits_refunded?: number
          duration?: number | null
          error_message?: string | null
          generate_audio?: boolean | null
          generation_type?: string | null
          id?: string
          input_audio_urls?: string[] | null
          input_image_urls?: string[] | null
          input_video_urls?: string[] | null
          model?: string
          output_url?: string | null
          prompt?: string
          quality?: string | null
          reference_prompt_id?: string | null
          refunded_at?: string | null
          rh_cost?: number | null
          source_tool?: string | null
          status?: string | null
          task_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      upscaler_credit_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string | null
          credit_type: string | null
          description: string | null
          id: string
          tool_type: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string | null
          credit_type?: string | null
          description?: string | null
          id?: string
          tool_type?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string | null
          credit_type?: string | null
          description?: string | null
          id?: string
          tool_type?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      upscaler_credits: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          lifetime_balance: number | null
          monthly_balance: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          lifetime_balance?: number | null
          monthly_balance?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          lifetime_balance?: number | null
          monthly_balance?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      upscaler_jobs: {
        Row: {
          api_account: string | null
          cancelled_at: string | null
          category: string | null
          completed_at: string | null
          created_at: string | null
          credits_charged: boolean | null
          credits_refunded: boolean | null
          current_step: string | null
          detail_denoise: number | null
          editing_level: number | null
          error_message: string | null
          failed_at_step: string | null
          fallback_attempted: boolean | null
          framing_mode: string | null
          id: string
          input_file_name: string | null
          input_url: string | null
          job_payload: Json | null
          original_task_id: string | null
          output_url: string | null
          position: number | null
          prompt: string | null
          queue_wait_seconds: number | null
          raw_api_response: Json | null
          raw_webhook_payload: Json | null
          resolution: number | null
          rh_cost: number | null
          session_id: string | null
          started_at: string | null
          status: string
          step_history: Json | null
          task_id: string | null
          thumbnail_url: string | null
          user_credit_cost: number | null
          user_id: string
          version: string | null
          waited_in_queue: boolean | null
        }
        Insert: {
          api_account?: string | null
          cancelled_at?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_charged?: boolean | null
          credits_refunded?: boolean | null
          current_step?: string | null
          detail_denoise?: number | null
          editing_level?: number | null
          error_message?: string | null
          failed_at_step?: string | null
          fallback_attempted?: boolean | null
          framing_mode?: string | null
          id?: string
          input_file_name?: string | null
          input_url?: string | null
          job_payload?: Json | null
          original_task_id?: string | null
          output_url?: string | null
          position?: number | null
          prompt?: string | null
          queue_wait_seconds?: number | null
          raw_api_response?: Json | null
          raw_webhook_payload?: Json | null
          resolution?: number | null
          rh_cost?: number | null
          session_id?: string | null
          started_at?: string | null
          status?: string
          step_history?: Json | null
          task_id?: string | null
          thumbnail_url?: string | null
          user_credit_cost?: number | null
          user_id: string
          version?: string | null
          waited_in_queue?: boolean | null
        }
        Update: {
          api_account?: string | null
          cancelled_at?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_charged?: boolean | null
          credits_refunded?: boolean | null
          current_step?: string | null
          detail_denoise?: number | null
          editing_level?: number | null
          error_message?: string | null
          failed_at_step?: string | null
          fallback_attempted?: boolean | null
          framing_mode?: string | null
          id?: string
          input_file_name?: string | null
          input_url?: string | null
          job_payload?: Json | null
          original_task_id?: string | null
          output_url?: string | null
          position?: number | null
          prompt?: string | null
          queue_wait_seconds?: number | null
          raw_api_response?: Json | null
          raw_webhook_payload?: Json | null
          resolution?: number | null
          rh_cost?: number | null
          session_id?: string | null
          started_at?: string | null
          status?: string
          step_history?: Json | null
          task_id?: string | null
          thumbnail_url?: string | null
          user_credit_cost?: number | null
          user_id?: string
          version?: string | null
          waited_in_queue?: boolean | null
        }
        Relationships: []
      }
      user_pack_purchases: {
        Row: {
          amount: number | null
          created_at: string | null
          expires_at: string | null
          external_id: string | null
          gateway: string | null
          id: string
          pack_id: string | null
          pack_slug: string | null
          payment_status: string | null
          plan_type: string | null
          user_id: string
          welcome_email_sent: boolean | null
          welcome_email_sent_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          expires_at?: string | null
          external_id?: string | null
          gateway?: string | null
          id?: string
          pack_id?: string | null
          pack_slug?: string | null
          payment_status?: string | null
          plan_type?: string | null
          user_id: string
          welcome_email_sent?: boolean | null
          welcome_email_sent_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          expires_at?: string | null
          external_id?: string | null
          gateway?: string | null
          id?: string
          pack_id?: string | null
          pack_slug?: string | null
          payment_status?: string | null
          plan_type?: string | null
          user_id?: string
          welcome_email_sent?: boolean | null
          welcome_email_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_pack_purchases_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "artes_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          source: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          source?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          source?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_device_signup_limit: {
        Args: { p_fingerprint: string }
        Returns: boolean
      }
      check_profile_exists: {
        Args: { check_email: string }
        Returns: {
          exists_in_db: boolean
          has_logged_in: boolean
          password_changed: boolean
        }[]
      }
      check_rate_limit: {
        Args: {
          _endpoint: string
          _ip_address: string
          _max_requests: number
          _window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
        }[]
      }
      cleanup_all_stale_ai_jobs: {
        Args: never
        Returns: {
          arcano_cancelled: number
          arcano_refunded: number
          bgremover_cancelled: number
          bgremover_refunded: number
          chargen_cancelled: number
          chargen_refunded: number
          flyer_cancelled: number
          flyer_refunded: number
          imggen_cancelled: number
          imggen_refunded: number
          movieled_cancelled: number
          movieled_refunded: number
          pose_cancelled: number
          pose_refunded: number
          seedance_cancelled: number
          seedance_refunded: number
          upscaler_cancelled: number
          upscaler_refunded: number
          veste_cancelled: number
          veste_refunded: number
          video_cancelled: number
          video_refunded: number
          videogen_cancelled: number
          videogen_refunded: number
        }[]
      }
      consume_flyer_test_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: {
          remaining: number
          test_used: number
        }[]
      }
      consume_upscaler_credits: {
        Args: { _amount: number; _description?: string; _user_id: string }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
        }[]
      }
      consume_upscaler_credits_forced: {
        Args: { _amount: number; _description?: string; _user_id: string }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
        }[]
      }
      get_ai_tools_cost_averages: {
        Args: never
        Returns: {
          avg_rh_cost: number
          avg_user_credits: number
          tool_name: string
          total_completed: number
          total_rh_cost: number
          total_user_credits: number
        }[]
      }
      get_flyer_test_credits: { Args: { _user_id: string }; Returns: number }
      get_upscaler_credits: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_pending_job_as_failed:
        | {
            Args: { p_job_id: string; p_table_name: string }
            Returns: undefined
          }
        | {
            Args: {
              p_error_message?: string
              p_job_id: string
              p_table_name: string
            }
            Returns: boolean
          }
      refund_seedance_job: {
        Args: { _job_id: string; _reason?: string }
        Returns: {
          message: string
          refunded_amount: number
          success: boolean
        }[]
      }
      refund_upscaler_credits: {
        Args: { _amount: number; _description?: string; _user_id: string }
        Returns: undefined
      }
      register_collaborator_tool_earning: {
        Args: {
          _job_id: string
          _prompt_id: string
          _tool_table: string
          _user_id: string
        }
        Returns: Json
      }
      register_device_signup: {
        Args: { p_fingerprint: string; p_user_id: string }
        Returns: undefined
      }
      user_cancel_ai_job: {
        Args: { p_job_id: string; p_table_name: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
