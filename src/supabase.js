import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ffurcpbxygvprykhebus.supabase.co";

const supabaseAnonKey = "sb_publishable_MRdV2fhp8xn4wahceNETlQ__NIADWLr";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);