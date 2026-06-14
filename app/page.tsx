import { createClient } from '@/lib/db/supabaseServerClient';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect('/chat');
  }

  redirect('/login');
}
