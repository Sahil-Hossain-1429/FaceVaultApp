import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// ─── Environment variables ────────────────────────────────────────────────────
//
// Add these to your .env file at the project root:
//
//   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
//   EXPO_PUBLIC_SUPABASE_KEY=your-anon-key
//
// Expo automatically exposes variables prefixed with EXPO_PUBLIC_ to the
// JavaScript bundle. Never use the service-role key here.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        '[Supabase] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY ' +
        'must be set in your .env file.',
    );
}

// ─── Client ───────────────────────────────────────────────────────────────────
//
// A single shared Supabase client for the entire app.
// Auth session is persisted in AsyncStorage across app launches.
//
// Note: We are using Clerk for authentication, NOT Supabase Auth.
// The Supabase client here is used only for database access.
// We pass the Clerk JWT as a custom Authorization header on each
// request via the accessToken option — configured in the repository.

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
    global: {
        headers: {},
    },
});

/**
 * Create a Supabase client instance authenticated with a Clerk JWT.
 * Call this inside repository functions where you have the Clerk token.
 *
 * This produces a client that sends:
 *   Authorization: Bearer <clerkToken>
 *
 * The Supabase JWT secret must be configured to verify Clerk tokens.
 * See: https://supabase.com/docs/guides/auth/third-party/clerk
 */
export function createAuthenticatedClient(clerkToken: string) {
    return createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${clerkToken}`,
            },
        },
    });
}

// Temporary — add near the bottom of supabase.ts
export async function testSupabaseAuth(clerkToken?: string): Promise<void> {
    console.log('[Supabase] Testing unauthenticated connection...');
    const { data: d1, error: e1 } = await supabase
        .from('face_enrollment_templates')
        .select('count');
    console.log('[Supabase] Unauthed result — data:', d1, 'error:', e1?.message ?? 'none');

    if (clerkToken) {
        console.log('[Supabase] Testing authenticated connection...');
        const authedClient = createAuthenticatedClient(clerkToken);
        const { data: d2, error: e2 } = await authedClient
            .from('face_enrollment_templates')
            .select('count');
        console.log('[Supabase] Authed result — data:', d2, 'error:', e2?.message ?? 'none');
    } else {
        console.warn('[Supabase] No token — skipping auth test');
    }
}