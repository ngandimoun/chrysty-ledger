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
      agent_voice_previews: {
        Row: {
          created_at: string
          language_code: string
          mime_type: string
          public_url: string
          sample_text: string
          storage_path: string
          style_label: string
          voice_name: string
        }
        Insert: {
          created_at?: string
          language_code?: string
          mime_type?: string
          public_url: string
          sample_text: string
          storage_path: string
          style_label: string
          voice_name: string
        }
        Update: {
          created_at?: string
          language_code?: string
          mime_type?: string
          public_url?: string
          sample_text?: string
          storage_path?: string
          style_label?: string
          voice_name?: string
        }
        Relationships: []
      }
      learning_files: {
        Row: {
          content: string | null
          created_at: string
          filename: string
          id: string
          media_url: string | null
          mime_type: string
          moonshot_id: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          filename: string
          id: string
          media_url?: string | null
          mime_type: string
          moonshot_id: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          filename?: string
          id?: string
          media_url?: string | null
          mime_type?: string
          moonshot_id?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
      learning_generation_log: {
        Row: {
          created_at: string
          id: string
          learner_key: string
          session_id: string | null
          session_type: string
          source_prompt: string | null
          subject: string | null
          summary: Json
        }
        Insert: {
          created_at?: string
          id?: string
          learner_key: string
          session_id?: string | null
          session_type: string
          source_prompt?: string | null
          subject?: string | null
          summary?: Json
        }
        Update: {
          created_at?: string
          id?: string
          learner_key?: string
          session_id?: string | null
          session_type?: string
          source_prompt?: string | null
          subject?: string | null
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "learning_generation_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_interactions: {
        Row: {
          action_type: string
          ai_response: string
          card_id: string | null
          created_at: string
          id: string
          metadata: Json
          session_id: string
          user_id: string | null
          user_message: string
        }
        Insert: {
          action_type: string
          ai_response?: string
          card_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          session_id: string
          user_id?: string | null
          user_message?: string
        }
        Update: {
          action_type?: string
          ai_response?: string
          card_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          session_id?: string
          user_id?: string | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_interactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_learner_memory: {
        Row: {
          learner_key: string
          memory: Json
          narrative_digest: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          learner_key: string
          memory?: Json
          narrative_digest?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          learner_key?: string
          memory?: Json
          narrative_digest?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      learning_session_files: {
        Row: {
          file_id: string
          session_id: string
        }
        Insert: {
          file_id: string
          session_id: string
        }
        Update: {
          file_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_session_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "learning_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_session_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_sessions: {
        Row: {
          content: Json | null
          created_at: string
          current_topic: string
          id: string
          learner_key: string | null
          progress: number
          source_prompt: string | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
          worker_slug: string
          workspace_id: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string
          current_topic?: string
          id: string
          learner_key?: string | null
          progress?: number
          source_prompt?: string | null
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
          worker_slug?: string
          workspace_id?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string
          current_topic?: string
          id?: string
          learner_key?: string | null
          progress?: number
          source_prompt?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          worker_slug?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_workspaces: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          platform_workspace_id: string | null
          settings: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          platform_workspace_id?: string | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          platform_workspace_id?: string | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_workspaces_platform_workspace_id_fkey"
            columns: ["platform_workspace_id"]
            isOneToOne: false
            referencedRelation: "worker_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_asset_events: {
        Row: {
          id: string
          occurred_at: string
          payload: Json
          sequence: number
          type: string
          workspace_id: string
        }
        Insert: {
          id: string
          occurred_at: string
          payload?: Json
          sequence: number
          type: string
          workspace_id: string
        }
        Update: {
          id?: string
          occurred_at?: string
          payload?: Json
          sequence?: number
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_asset_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "ledger_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_assets: {
        Row: {
          archived_at: string | null
          asset_data: Json
          asset_schema: Json
          category: string
          created_at: string
          creation_sequence: number
          id: string
          kind: string
          metadata: Json
          payload: Json
          project_id: string | null
          relations: Json
          source_message_id: string | null
          subtype: string | null
          title: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          asset_data?: Json
          asset_schema?: Json
          category: string
          created_at?: string
          creation_sequence: number
          id: string
          kind: string
          metadata?: Json
          payload: Json
          project_id?: string | null
          relations?: Json
          source_message_id?: string | null
          subtype?: string | null
          title: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          asset_data?: Json
          asset_schema?: Json
          category?: string
          created_at?: string
          creation_sequence?: number
          id?: string
          kind?: string
          metadata?: Json
          payload?: Json
          project_id?: string | null
          relations?: Json
          source_message_id?: string | null
          subtype?: string | null
          title?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ledger_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "ledger_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_asset_links: {
        Row: {
          created_at: string
          from_asset_id: string
          id: string
          relation: string
          to_asset_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          from_asset_id: string
          id?: string
          relation: string
          to_asset_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          from_asset_id?: string
          id?: string
          relation?: string
          to_asset_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      ledger_projects: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id: string
          metadata?: Json
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "ledger_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_messages: {
        Row: {
          created_at: string
          id: string
          payload: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id: string
          payload: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "ledger_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_workspaces: {
        Row: {
          canvas_state: Json
          created_at: string
          id: string
          is_default: boolean
          ledger_key: string | null
          name: string
          platform_workspace_id: string | null
          settings: Json
          updated_at: string
          user_id: string | null
          visitor_token: string
        }
        Insert: {
          canvas_state?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          ledger_key?: string | null
          name: string
          platform_workspace_id?: string | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
          visitor_token?: string
        }
        Update: {
          canvas_state?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          ledger_key?: string | null
          name?: string
          platform_workspace_id?: string | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
          visitor_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_workspaces_platform_workspace_id_fkey"
            columns: ["platform_workspace_id"]
            isOneToOne: false
            referencedRelation: "worker_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          limits: Json
          name: string
          slug: string
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          limits?: Json
          name: string
          slug: string
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          limits?: Json
          name?: string
          slug?: string
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      practice_messages: {
        Row: {
          created_at: string
          id: string
          interrupted: boolean
          is_partial: boolean
          is_transcription: boolean
          role: string
          session_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id: string
          interrupted?: boolean
          is_partial?: boolean
          is_transcription?: boolean
          role: string
          session_id: string
          text?: string
        }
        Update: {
          created_at?: string
          id?: string
          interrupted?: boolean
          is_partial?: boolean
          is_transcription?: boolean
          role?: string
          session_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_session_documents: {
        Row: {
          added_at: string
          byte_size: number | null
          category: string
          content_base64: string | null
          id: string
          mime_type: string
          name: string
          practice_key: string | null
          session_id: string
          storage_path: string | null
          user_id: string | null
        }
        Insert: {
          added_at?: string
          byte_size?: number | null
          category: string
          content_base64?: string | null
          id: string
          mime_type: string
          name: string
          practice_key?: string | null
          session_id: string
          storage_path?: string | null
          user_id?: string | null
        }
        Update: {
          added_at?: string
          byte_size?: number | null
          category?: string
          content_base64?: string | null
          id?: string
          mime_type?: string
          name?: string
          practice_key?: string | null
          session_id?: string
          storage_path?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_session_documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          coaching_report: Json | null
          created_at: string
          difficulty: string
          evaluation: Json | null
          goal: string
          id: string
          practice_key: string | null
          setup: Json | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string | null
          worker_slug: string
          workspace_id: string | null
        }
        Insert: {
          coaching_report?: Json | null
          created_at?: string
          difficulty: string
          evaluation?: Json | null
          goal: string
          id: string
          practice_key?: string | null
          setup?: Json | null
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
          worker_slug?: string
          workspace_id?: string | null
        }
        Update: {
          coaching_report?: Json | null
          created_at?: string
          difficulty?: string
          evaluation?: Json | null
          goal?: string
          id?: string
          practice_key?: string | null
          setup?: Json | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          worker_slug?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "practice_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_workspaces: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          platform_workspace_id: string | null
          practice_key: string | null
          settings: Json
          updated_at: string
          user_id: string | null
          visitor_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          platform_workspace_id?: string | null
          practice_key?: string | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
          visitor_token: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          platform_workspace_id?: string | null
          practice_key?: string | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
          visitor_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_workspaces_platform_workspace_id_fkey"
            columns: ["platform_workspace_id"]
            isOneToOne: false
            referencedRelation: "worker_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_enrich_jobs: {
        Row: {
          context: Json | null
          created_at: string
          error: string | null
          id: string
          progress: string | null
          session_id: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error?: string | null
          id: string
          progress?: string | null
          session_id: string
          source?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          progress?: string | null
          session_id?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_summary_jobs: {
        Row: {
          coaching_report: Json | null
          created_at: string
          error: string | null
          id: string
          progress: string | null
          session_id: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          coaching_report?: Json | null
          created_at?: string
          error?: string | null
          id: string
          progress?: string | null
          session_id: string
          source?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          coaching_report?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          progress?: string | null
          session_id?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stylist_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          status: string
          title: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          title?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          title?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_mem0_memory_refs: {
        Row: {
          category: string | null
          content_preview: string | null
          created_at: string
          id: string
          is_active: boolean
          mem0_memory_id: string
          source_id: string | null
          source_type: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          content_preview?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          mem0_memory_id: string
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          content_preview?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          mem0_memory_id?: string
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_mem0_memory_refs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_mem0_sync: {
        Row: {
          created_at: string
          error_message: string | null
          last_synced_at: string | null
          mem0_agent_id: string | null
          mem0_user_id: string
          sync_status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          last_synced_at?: string | null
          mem0_agent_id?: string | null
          mem0_user_id: string
          sync_status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          last_synced_at?: string | null
          mem0_agent_id?: string | null
          mem0_user_id?: string
          sync_status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_mem0_sync_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_memory_summaries: {
        Row: {
          content: Json
          id: string
          section: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content?: Json
          id?: string
          section: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: Json
          id?: string
          section?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_memory_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          token_count: number | null
          workspace_id: string | null
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          token_count?: number | null
          workspace_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          token_count?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stylist_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "stylist_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_outfit_generations: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          intent: string | null
          message_id: string | null
          model_config: Json
          prompt_context: Json | null
          status: string
          stylist_pick_id: string | null
          user_id: string | null
          user_prompt: string | null
          wardrobe_id: string | null
          workspace_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          message_id?: string | null
          model_config?: Json
          prompt_context?: Json | null
          status?: string
          stylist_pick_id?: string | null
          user_id?: string | null
          user_prompt?: string | null
          wardrobe_id?: string | null
          workspace_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          message_id?: string | null
          model_config?: Json
          prompt_context?: Json | null
          status?: string
          stylist_pick_id?: string | null
          user_id?: string | null
          user_prompt?: string | null
          wardrobe_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_outfit_generations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "stylist_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_outfit_generations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "stylist_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_outfit_generations_wardrobe_id_fkey"
            columns: ["wardrobe_id"]
            isOneToOne: false
            referencedRelation: "stylist_wardrobes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_outfit_generations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_outfit_look_items: {
        Row: {
          look_id: string
          sort_order: number
          wardrobe_item_id: string
        }
        Insert: {
          look_id: string
          sort_order?: number
          wardrobe_item_id: string
        }
        Update: {
          look_id?: string
          sort_order?: number
          wardrobe_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_outfit_look_items_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "stylist_outfit_looks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_outfit_look_items_wardrobe_item_id_fkey"
            columns: ["wardrobe_item_id"]
            isOneToOne: false
            referencedRelation: "stylist_wardrobe_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_outfit_looks: {
        Row: {
          created_at: string
          feedback: string | null
          generation_id: string
          id: string
          image_id: string | null
          is_stylist_pick: boolean
          occasion_tag: string | null
          rationale: string
          storage_path: string
          vibe: string | null
          wardrobe_item_ids: string[] | null
          worn_at: string | null
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          generation_id: string
          id?: string
          image_id?: string | null
          is_stylist_pick?: boolean
          occasion_tag?: string | null
          rationale?: string
          storage_path: string
          vibe?: string | null
          wardrobe_item_ids?: string[] | null
          worn_at?: string | null
        }
        Update: {
          created_at?: string
          feedback?: string | null
          generation_id?: string
          id?: string
          image_id?: string | null
          is_stylist_pick?: boolean
          occasion_tag?: string | null
          rationale?: string
          storage_path?: string
          vibe?: string | null
          wardrobe_item_ids?: string[] | null
          worn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stylist_outfit_looks_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "stylist_outfit_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_outfit_looks_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "stylist_uploaded_images"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_preference_signals: {
        Row: {
          created_at: string
          id: string
          payload: Json
          signal_type: string
          source_look_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          signal_type: string
          source_look_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          signal_type?: string
          source_look_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_preference_signals_source_look_id_fkey"
            columns: ["source_look_id"]
            isOneToOne: false
            referencedRelation: "stylist_outfit_looks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_preference_signals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_uploaded_images: {
        Row: {
          byte_size: number | null
          content_hash: string | null
          created_at: string
          deleted_at: string | null
          height: number | null
          id: string
          mime_type: string
          source: string
          status: string
          storage_path: string
          thumb_path: string | null
          user_id: string | null
          vision: Json
          width: number | null
          workspace_id: string
        }
        Insert: {
          byte_size?: number | null
          content_hash?: string | null
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          source?: string
          status?: string
          storage_path: string
          thumb_path?: string | null
          user_id?: string | null
          vision?: Json
          width?: number | null
          workspace_id: string
        }
        Update: {
          byte_size?: number | null
          content_hash?: string | null
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          source?: string
          status?: string
          storage_path?: string
          thumb_path?: string | null
          user_id?: string | null
          vision?: Json
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_uploaded_images_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_wardrobe_items: {
        Row: {
          category: string | null
          colors: string[] | null
          created_at: string
          description: string
          formality: string | null
          id: string
          image_id: string | null
          metadata: Json | null
          status: string
          storage_path: string
          thumb_path: string | null
          updated_at: string
          user_id: string | null
          wardrobe_id: string | null
          workspace_id: string
        }
        Insert: {
          category?: string | null
          colors?: string[] | null
          created_at?: string
          description?: string
          formality?: string | null
          id?: string
          image_id?: string | null
          metadata?: Json | null
          status?: string
          storage_path: string
          thumb_path?: string | null
          updated_at?: string
          user_id?: string | null
          wardrobe_id?: string | null
          workspace_id: string
        }
        Update: {
          category?: string | null
          colors?: string[] | null
          created_at?: string
          description?: string
          formality?: string | null
          id?: string
          image_id?: string | null
          metadata?: Json | null
          status?: string
          storage_path?: string
          thumb_path?: string | null
          updated_at?: string
          user_id?: string | null
          wardrobe_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_wardrobe_items_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "stylist_uploaded_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_wardrobe_items_wardrobe_id_fkey"
            columns: ["wardrobe_id"]
            isOneToOne: false
            referencedRelation: "stylist_wardrobes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_wardrobe_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_wardrobes: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          item_count: number
          name: string
          slug: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          item_count?: number
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          item_count?: number
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_wardrobes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "stylist_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_workspaces: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_default: boolean
          name: string
          onboarding_complete: boolean
          platform_workspace_id: string | null
          settings: Json
          updated_at: string
          user_id: string | null
          visitor_token: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_default?: boolean
          name?: string
          onboarding_complete?: boolean
          platform_workspace_id?: string | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
          visitor_token: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_default?: boolean
          name?: string
          onboarding_complete?: boolean
          platform_workspace_id?: string | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
          visitor_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_workspaces_platform_workspace_id_fkey"
            columns: ["platform_workspace_id"]
            isOneToOne: false
            referencedRelation: "worker_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          status: string
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          plan_id: string
          status?: string
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          action_type: string
          cost: number
          created_at: string
          id: string
          metadata: Json | null
          tokens_input: number
          tokens_output: number
          user_id: string
          worker_slug: string
        }
        Insert: {
          action_type: string
          cost?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_input?: number
          tokens_output?: number
          user_id: string
          worker_slug: string
        }
        Update: {
          action_type?: string
          cost?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_input?: number
          tokens_output?: number
          user_id?: string
          worker_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_worker_slug_fkey"
            columns: ["worker_slug"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["slug"]
          },
        ]
      }
      worker_composio_sessions: {
        Row: {
          created_at: string
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      worker_conversations: {
        Row: {
          created_at: string
          id: string
          mem0_digest_message_count: number
          mem0_last_captured_message_id: string | null
          mem0_last_digest_at: string | null
          model: string | null
          title: string | null
          updated_at: string
          user_id: string
          worker_slug: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mem0_digest_message_count?: number
          mem0_last_captured_message_id?: string | null
          mem0_last_digest_at?: string | null
          model?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          worker_slug: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mem0_digest_message_count?: number
          mem0_last_captured_message_id?: string | null
          mem0_last_digest_at?: string | null
          model?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          worker_slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_conversations_mem0_last_captured_message_id_fkey"
            columns: ["mem0_last_captured_message_id"]
            isOneToOne: false
            referencedRelation: "worker_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "worker_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_file_chunk_embeddings: {
        Row: {
          chunk_id: string
          created_at: string
          dimensions: number
          embedding: string
          id: string
          model: string
        }
        Insert: {
          chunk_id: string
          created_at?: string
          dimensions?: number
          embedding: string
          id?: string
          model: string
        }
        Update: {
          chunk_id?: string
          created_at?: string
          dimensions?: number
          embedding?: string
          id?: string
          model?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_file_chunk_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: true
            referencedRelation: "worker_file_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_file_chunks: {
        Row: {
          char_count: number
          chunk_index: number
          content: string | null
          created_at: string
          file_id: string
          id: string
          metadata: Json
          modality: string
          user_id: string
          worker_slug: string
          workspace_id: string
        }
        Insert: {
          char_count?: number
          chunk_index: number
          content?: string | null
          created_at?: string
          file_id: string
          id?: string
          metadata?: Json
          modality: string
          user_id: string
          worker_slug: string
          workspace_id: string
        }
        Update: {
          char_count?: number
          chunk_index?: number
          content?: string | null
          created_at?: string
          file_id?: string
          id?: string
          metadata?: Json
          modality?: string
          user_id?: string
          worker_slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_file_chunks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "worker_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_file_chunks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "worker_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_files: {
        Row: {
          byte_size: number | null
          content_type: string | null
          conversation_id: string | null
          created_at: string
          error_message: string | null
          filename: string
          id: string
          metadata: Json
          processed_at: string | null
          status: string
          storage_bucket: string
          storage_path: string
          user_id: string
          worker_slug: string
          workspace_id: string | null
        }
        Insert: {
          byte_size?: number | null
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          filename: string
          id?: string
          metadata?: Json
          processed_at?: string | null
          status?: string
          storage_bucket: string
          storage_path: string
          user_id: string
          worker_slug: string
          workspace_id?: string | null
        }
        Update: {
          byte_size?: number | null
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          filename?: string
          id?: string
          metadata?: Json
          processed_at?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          user_id?: string
          worker_slug?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "worker_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "worker_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          role: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "worker_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_workspace_memory: {
        Row: {
          created_at: string
          id: string
          memory_key: string
          memory_value: string
          source: string
          updated_at: string
          user_id: string
          worker_slug: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_key: string
          memory_value: string
          source?: string
          updated_at?: string
          user_id: string
          worker_slug: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_key?: string
          memory_value?: string
          source?: string
          updated_at?: string
          user_id?: string
          worker_slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_workspace_memory_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "worker_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_workspace_settings: {
        Row: {
          advisor_style: string | null
          business_name: string | null
          country_code: string | null
          created_at: string
          current_challenge: string | null
          current_goal: string | null
          custom_instructions: string | null
          explanation_level: string | null
          industry: string | null
          primary_focus: string
          response_length: string | null
          revenue_range: string | null
          team_size: string | null
          updated_at: string
          user_id: string
          user_role: string | null
          worker_slug: string
          workspace_id: string
        }
        Insert: {
          advisor_style?: string | null
          business_name?: string | null
          country_code?: string | null
          created_at?: string
          current_challenge?: string | null
          current_goal?: string | null
          custom_instructions?: string | null
          explanation_level?: string | null
          industry?: string | null
          primary_focus?: string
          response_length?: string | null
          revenue_range?: string | null
          team_size?: string | null
          updated_at?: string
          user_id: string
          user_role?: string | null
          worker_slug: string
          workspace_id: string
        }
        Update: {
          advisor_style?: string | null
          business_name?: string | null
          country_code?: string | null
          created_at?: string
          current_challenge?: string | null
          current_goal?: string | null
          custom_instructions?: string | null
          explanation_level?: string | null
          industry?: string | null
          primary_focus?: string
          response_length?: string | null
          revenue_range?: string | null
          team_size?: string | null
          updated_at?: string
          user_id?: string
          user_role?: string | null
          worker_slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "worker_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_workspaces: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
          worker_slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
          worker_slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          worker_slug?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          created_at: string
          name: string
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          name: string
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          name?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_workspace_file_chunks: {
        Args: {
          match_count?: number
          match_workspace_id: string
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          file_id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
