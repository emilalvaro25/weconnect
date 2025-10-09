/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ockscvdpcdblgnfvociq.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ja3NjdmRwY2RibGduZnZvY2lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1Nzg1NDMsImV4cCI6MjA3NTE1NDU0M30.6E8PdkGLougJjZCIyCKUZgcbSmtfDO2wYXo11lEnCuE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);