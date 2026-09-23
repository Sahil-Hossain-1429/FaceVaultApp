import { supabase } from '../../../lib/supabase';
import type { EnrollmentTemplate } from './enrollmentService';

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Persist an enrollment template to the `face_enrollment_templates` table.
 *
 * The embedding Float32Array is serialised as a JSON number array so it fits
 * in a Supabase `jsonb` column without binary encoding concerns.
 *
 * Row-level security on the table uses `auth.uid()` so the Clerk JWT must be
 * set on the Supabase client before this is called (handled in supabase.ts).
 *
 * @param userId    Clerk user ID (stored for querying; RLS enforces ownership).
 * @param template  Enrollment template from enrollmentService.
 */
export async function saveEnrollmentTemplate(
    userId: string,
    clerkToken: string, 
    template: EnrollmentTemplate,
): Promise<void> {
    const client = createAuthenticatedClient(clerkToken);
    const embeddingArray = Array.from(template.embedding);

    console.log(`[Repository] Saving template for user ${userId}, embedding length: ${embeddingArray.length}`);

    const { data, error } = await supabase.from('face_enrollment_templates').upsert(
        {
            user_id: userId,
            embedding: embeddingArray,
            frame_count: template.frameCount,
            enrolled_at: template.enrolledAt,
        },
        { onConflict: 'user_id' },
    );

    console.log('[Repository] Upsert result — error:', error, 'data:', data);

    if (error) {
        throw new Error(`[Repository] Failed to save enrollment template: ${error.message}`);
    }

    console.log('[Repository] ✓ Template saved successfully');
}

/**
 * Fetch the enrollment template for a user, or null if none exists.
 */
export async function fetchEnrollmentTemplate(
    userId: string,
): Promise<EnrollmentTemplate | null> {
    const { data, error } = await supabase
        .from('face_enrollment_templates')
        .select('embedding, frame_count, enrolled_at')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw new Error(`[Repository] Failed to fetch enrollment template: ${error.message}`);
    }

    if (!data) return null;

    return {
        embedding: new Float32Array(data.embedding as number[]),
        frameCount: data.frame_count as number,
        enrolledAt: data.enrolled_at as string,
    };
}