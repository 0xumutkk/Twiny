/**
 * SocialAgent — stub (architecture plan §9 marks this out-of-scope for MVP).
 *
 * Kept as a no-op so the orchestrator, registry and Permission Dashboard can
 * show "Not connected" consistently with the in-scope subagents.
 */

export interface SocialPreview {
  status:  'not_connected';
  posts:   [];
  message: string;
}

export async function runSocialAgent(): Promise<SocialPreview> {
  return {
    status:  'not_connected',
    posts:   [],
    message: 'Social Agent is planned for Phase 3. No social account is connected.',
  };
}
