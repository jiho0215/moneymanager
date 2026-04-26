import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getAdminClient, createTestFamily, cleanupAllTestData, type CreatedFamily } from './setup';

describe('Kid login code generation', () => {
  let fam: CreatedFamily;

  beforeAll(async () => {
    await cleanupAllTestData();
    fam = await createTestFamily();
  }, 60000);

  afterAll(async () => {
    await cleanupAllTestData();
  }, 60000);

  it('guardian can issue 6-char code for own family kid', async () => {
    const admin = getAdminClient();
    const code = 'ABC234';
    const { error } = await admin.rpc('generate_kid_login_code', {
      p_kid_membership_id: fam.kidMembershipId,
      p_guardian_user_id: fam.guardianUserId,
      p_code: code,
      p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(error).toBeNull();

    const { data } = await admin.from('kid_login_codes').select('*').eq('code', code);
    expect(data?.length).toBe(1);
    expect(data![0]!.kid_membership_id).toBe(fam.kidMembershipId);
    expect(data![0]!.used_at).toBeNull();
  }, 30000);

  it('cross-family code generation rejected (other guardian cannot issue for unrelated kid)', async () => {
    const otherFam = await createTestFamily();
    const admin = getAdminClient();
    const { error } = await admin.rpc('generate_kid_login_code', {
      p_kid_membership_id: fam.kidMembershipId,
      p_guardian_user_id: otherFam.guardianUserId,
      p_code: 'XYZ234',
      p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/guardian not in same family/);
  }, 60000);
});
