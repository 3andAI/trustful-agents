import 'dotenv/config';
import { query, closePool } from './index.js';

/**
 * Seed the database with test data for development
 */
async function seed() {
  console.log('Seeding database...');
  
  // Sample governance signers (Safe owners)
  const signers = [
    {
      address: '0x1234567890123456789012345678901234567890',
      name: 'Alice (Governance)',
      email: 'alice@example.com',
    },
    {
      address: '0x2345678901234567890123456789012345678901',
      name: 'Bob (Governance)',
      email: 'bob@example.com',
    },
    {
      address: '0x3456789012345678901234567890123456789012',
      name: 'Charlie (Governance)',
      email: 'charlie@example.com',
    },
  ];
  
  for (const signer of signers) {
    await query(
      `INSERT INTO governance_signers (address, name, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (address) DO UPDATE SET name = $2, email = $3`,
      [signer.address.toLowerCase(), signer.name, signer.email]
    );
  }
  console.log(`✓ Inserted ${signers.length} governance signers`);
  
  // Sample council ID (you would get this from the deployed contract)
  const sampleCouncilId = '0x' + 'a'.repeat(64); // Replace with actual council ID
  
  // Sample council members
  const members = [
    {
      address: '0x4567890123456789012345678901234567890123',
      councilId: sampleCouncilId,
      name: 'Council Member 1',
      description: 'Expert in DeFi dispute resolution',
      email: 'member1@example.com',
    },
    {
      address: '0x5678901234567890123456789012345678901234',
      councilId: sampleCouncilId,
      name: 'Council Member 2',
      description: 'Blockchain security specialist',
      email: 'member2@example.com',
    },
    {
      address: '0x6789012345678901234567890123456789012345',
      councilId: sampleCouncilId,
      name: 'Council Member 3',
      description: 'Smart contract auditor',
      email: 'member3@example.com',
    },
  ];
  
  for (const member of members) {
    await query(
      `INSERT INTO council_members (address, council_id, name, description, email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (address, council_id) DO UPDATE SET 
         name = $3, description = $4, email = $5`,
      [
        member.address.toLowerCase(),
        member.councilId,
        member.name,
        member.description,
        member.email,
      ]
    );
  }
  console.log(`✓ Inserted ${members.length} council members`);
  
  // Sample audit logs
  const auditLogs = [
    {
      action: 'council_created',
      actorAddress: signers[0].address,
      targetType: 'council',
      targetId: sampleCouncilId,
      metadata: { name: 'DeFi Council', vertical: 'defi' },
    },
    {
      action: 'member_added',
      actorAddress: signers[0].address,
      targetType: 'member',
      targetId: `${sampleCouncilId}:${members[0].address}`,
      metadata: { name: members[0].name },
    },
    {
      action: 'member_added',
      actorAddress: signers[1].address,
      targetType: 'member',
      targetId: `${sampleCouncilId}:${members[1].address}`,
      metadata: { name: members[1].name },
    },
  ];
  
  for (const log of auditLogs) {
    await query(
      `INSERT INTO audit_log (action, actor_address, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        log.action,
        log.actorAddress.toLowerCase(),
        log.targetType,
        log.targetId,
        JSON.stringify(log.metadata),
      ]
    );
  }
  console.log(`✓ Inserted ${auditLogs.length} audit log entries`);
  
  console.log('\n✓ Database seeded successfully');
}

async function main() {
  try {
    await seed();
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
