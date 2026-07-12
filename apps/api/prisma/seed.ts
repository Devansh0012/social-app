/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const COLLEGES = [
  { name: 'Stanford University', domain: 'stanford.edu', country: 'USA' },
  { name: 'Massachusetts Institute of Technology', domain: 'mit.edu', country: 'USA' },
  { name: 'University of California, Berkeley', domain: 'berkeley.edu', country: 'USA' },
  { name: 'Harvard University', domain: 'harvard.edu', country: 'USA' },
  { name: 'Princeton University', domain: 'princeton.edu', country: 'USA' },
  { name: 'Carnegie Mellon University', domain: 'cmu.edu', country: 'USA' },
  { name: 'University of Cambridge', domain: 'cam.ac.uk', country: 'UK' },
  { name: 'University of Oxford', domain: 'ox.ac.uk', country: 'UK' },
  { name: 'Imperial College London', domain: 'imperial.ac.uk', country: 'UK' },
  { name: 'IIT Bombay', domain: 'iitb.ac.in', country: 'IN' },
  { name: 'IIT Delhi', domain: 'iitd.ac.in', country: 'IN' },
  { name: 'IIT Madras', domain: 'iitm.ac.in', country: 'IN' },
  { name: 'IIT Roorkee', domain: 'iitr.ac.in', country: 'IN' },
  { name: 'IIT Guwahati', domain: 'iitg.ac.in', country: 'IN' },
  { name: 'IIT Kharagpur', domain: 'iitkgp.ac.in', country: 'IN' },
  { name: 'IIT BHU(Varanasi)', domain: 'itbhu.ac.in', country: 'IN' },
  { name: 'IIT Kanpur', domain: 'iitk.ac.in', country: 'IN' },
  { name: 'BITS Pilani', domain: 'pilani.bits-pilani.ac.in', country: 'IN' },
  { name: 'University of Toronto', domain: 'mail.utoronto.ca', country: 'CA' },
  { name: 'National University of Singapore', domain: 'u.nus.edu', country: 'SG' },
  { name: 'University of Melbourne', domain: 'student.unimelb.edu.au', country: 'AU' },
  // For local dev convenience:
  { name: 'Braventex Dev University', domain: 'braventex.dev', country: 'XX' },
];

const COMMUNITIES = [
  { slug: 'ai', name: 'AI', tags: ['ai', 'ml'], description: 'Machine learning, LLMs, and applied AI.' },
  {
    slug: 'hackathons',
    name: 'Hackathons',
    tags: ['hackathon', 'teams'],
    description: 'Find your next team and ship something in 48 hours.',
  },
  {
    slug: 'startups',
    name: 'Startups',
    tags: ['startups', 'product'],
    description: 'Builders, founders, and ramen-funded ideas.',
  },
  {
    slug: 'placements',
    name: 'Placements',
    tags: ['placements', 'careers'],
    description: 'Interview prep, offers, and salary transparency.',
  },
  {
    slug: 'open-source',
    name: 'Open Source',
    tags: ['oss', 'github'],
    description: 'OSS projects to contribute to + maintainers helping out.',
  },
  {
    slug: 'competitive-programming',
    name: 'Competitive Programming',
    tags: ['cp', 'algorithms'],
    description: 'Codeforces, Leetcode, ICPC.',
  },
  {
    slug: 'hardware',
    name: 'Hardware',
    tags: ['hardware', 'embedded'],
    description: 'PCBs, embedded, robotics, and silicon.',
  },
];

async function main() {
  console.log('Seeding colleges…');
  for (const c of COLLEGES) {
    await prisma.college.upsert({ where: { domain: c.domain }, create: c, update: c });
  }

  const devCollege = await prisma.college.findUnique({ where: { domain: 'braventex.dev' } });
  if (!devCollege) throw new Error('Dev college failed to seed');

  console.log('Seeding admin user…');
  const passwordHash = await argon2.hash('Braventex123!');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@braventex.dev' },
    update: {},
    create: {
      email: 'admin@braventex.dev',
      username: 'admin',
      fullName: 'Braventex Admin',
      passwordHash,
      collegeId: devCollege.id,
      status: 'ACTIVE',
      emailVerified: true,
      isVerifiedStudent: true,
      onboardingCompleted: true,
      role: 'ADMIN',
      department: 'Platform',
      graduationYear: new Date().getFullYear() + 1,
      interests: ['platform', 'community'],
      skills: ['typescript', 'postgres'],
    },
  });
  console.log(`  admin → ${admin.email} (password: Braventex123!)`);

  console.log('Seeding sample student…');
  const studentHash = await argon2.hash('Student123!');
  const student = await prisma.user.upsert({
    where: { email: 'ada@braventex.dev' },
    update: {},
    create: {
      email: 'ada@braventex.dev',
      username: 'ada',
      fullName: 'Ada Lovelace',
      passwordHash: studentHash,
      collegeId: devCollege.id,
      status: 'ACTIVE',
      emailVerified: true,
      isVerifiedStudent: true,
      onboardingCompleted: true,
      role: 'USER',
      department: 'Computer Science',
      graduationYear: new Date().getFullYear() + 2,
      interests: ['ai', 'algorithms', 'startups'],
      skills: ['typescript', 'rust', 'python'],
      bio: 'Building tiny tools, big ideas.',
    },
  });
  console.log(`  student → ${student.email} (password: Student123!)`);

  console.log('Seeding communities…');
  for (const c of COMMUNITIES) {
    await prisma.community.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        tags: c.tags,
        privacy: 'PUBLIC',
        creatorId: admin.id,
        memberCount: 2,
        members: {
          createMany: {
            data: [
              { userId: admin.id, role: 'CREATOR' },
              { userId: student.id, role: 'MEMBER' },
            ],
          },
        },
      },
    });
  }

  console.log('Seeding sample posts…');
  const aiCommunity = await prisma.community.findUnique({ where: { slug: 'ai' } });
  const hackCommunity = await prisma.community.findUnique({ where: { slug: 'hackathons' } });
  if (aiCommunity) {
    const title = 'Reading group: papers on retrieval augmentation';
    const exists = await prisma.post.findFirst({
      where: { authorId: student.id, communityId: aiCommunity.id, title },
    });
    if (!exists) {
      await prisma.post.create({
        data: {
          authorId: student.id,
          communityId: aiCommunity.id,
          type: 'TEXT',
          title,
          body: 'Anyone interested in a weekly paper club? Drop a comment with your favorite RAG paper.',
          tags: ['ai', 'reading-group'],
        },
      });
      await prisma.community.update({
        where: { id: aiCommunity.id },
        data: { postCount: { increment: 1 } },
      });
    }
  }
  if (hackCommunity) {
    const title = 'Looking for a designer for HackMIT';
    const exists = await prisma.post.findFirst({
      where: { authorId: admin.id, communityId: hackCommunity.id, title },
    });
    if (!exists) {
      const collabPost = await prisma.post.create({
        data: {
          authorId: admin.id,
          communityId: hackCommunity.id,
          type: 'COLLAB',
          title,
          body: 'Building a campus tool. Need someone strong in product UX.',
          tags: ['hackathon', 'design'],
        },
      });
      await prisma.collabPost.create({
        data: {
          postId: collabPost.id,
          projectTitle: 'Braventex × HackMIT',
          requiredSkills: ['Figma', 'UX', 'Design Systems'],
          projectType: 'HACKATHON',
          duration: 'SHORT',
          teamSize: 4,
          locationType: 'HYBRID',
          openSlots: 1,
        },
      });
      await prisma.community.update({
        where: { id: hackCommunity.id },
        data: { postCount: { increment: 1 } },
      });
    }
  }

  console.log('Done.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
