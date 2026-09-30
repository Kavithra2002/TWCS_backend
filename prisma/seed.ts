import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SENSOR_DEFAULTS } from '../src/modules/sensors/sensor-defaults';

const prisma = new PrismaClient();

// Development-only credentials. Change before deploying anywhere real.
const ADMIN_EMAIL = 'admin@twcs.local';
const ADMIN_PASSWORD = 'Admin@12345';

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: { email: ADMIN_EMAIL, name: 'System Admin', passwordHash, role: 'ADMIN' },
  });

  const factory = await prisma.factory.upsert({
    where: { code: 'F01' },
    update: {},
    create: { code: 'F01', name: 'Main Tea Factory', location: 'Nuwara Eliya' },
  });

  const troughCount = 6;
  for (let i = 1; i <= troughCount; i++) {
    const code = `WT-${String(i).padStart(2, '0')}`;
    const trough = await prisma.trough.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: `Withering Trough ${i}`,
        factoryId: factory.id,
        capacityKg: 1800,
        status: i <= 4 ? 'RUNNING' : i === 5 ? 'IDLE' : 'MAINTENANCE',
      },
    });

    for (const s of SENSOR_DEFAULTS) {
      await prisma.sensor.upsert({
        where: { troughId_type: { troughId: trough.id, type: s.type } },
        update: {},
        create: {
          troughId: trough.id,
          type: s.type,
          label: s.label,
          unit: s.unit,
          minThreshold: s.min,
          maxThreshold: s.max,
        },
      });
    }

    const existingSchedules = await prisma.schedule.count({ where: { troughId: trough.id } });
    if (existingSchedules === 0) {
      await prisma.schedule.createMany({
        data: [
          { troughId: trough.id, name: 'Morning wither', action: 'WITHERING_CYCLE', startTime: '06:00', endTime: '14:00', daysOfWeek: [1, 2, 3, 4, 5, 6] },
          { troughId: trough.id, name: 'Hot air boost', action: 'HEATER_ON', startTime: '09:00', endTime: '11:30', daysOfWeek: [1, 2, 3, 4, 5, 6], setpoint: 32 },
          { troughId: trough.id, name: 'Reverse airflow', action: 'REVERSE_AIRFLOW', startTime: '12:00', endTime: '12:30', daysOfWeek: [1, 2, 3, 4, 5, 6] },
          { troughId: trough.id, name: 'Leaf turning', action: 'LEAF_TURNING', startTime: '10:00', endTime: '10:20', daysOfWeek: [1, 3, 5] },
        ],
      });
    }

    if (i <= 4) {
      const activeBatch = await prisma.batch.findFirst({ where: { troughId: trough.id, status: 'WITHERING' } });
      if (!activeBatch) {
        await prisma.batch.create({
          data: {
            code: `B-${code}-${Date.now().toString(36).toUpperCase()}`,
            troughId: trough.id,
            leafIntakeKg: 1500 + i * 40,
            initialMoisture: 78,
            targetMoisture: 62,
            status: 'WITHERING',
            startedAt: new Date(Date.now() - i * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  console.log(`Seed complete. Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
