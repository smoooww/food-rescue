import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabaseUrl, supabasePublishableKey } from './supabase-config.js';

let client = null;
if (supabaseUrl && supabasePublishableKey && !supabaseUrl.includes('YOUR_') && !supabasePublishableKey.includes('YOUR_')) {
  try {
    client = createClient(supabaseUrl, supabasePublishableKey);
  } catch (error) {
    console.error('Invalid Supabase configuration:', error);
  }
}
export const supabase = client;
