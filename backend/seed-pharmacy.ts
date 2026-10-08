import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    console.error('Clinic not found, please run the main seed first.');
    return;
  }
  const clinicId = clinic.id;

  // Find a pharmacy or admin user to act as the performer
  const admin = await prisma.user.findFirst({
    where: { clinicId, role: 'SUPER_ADMIN' }
  });
  const adminId = admin ? admin.id : undefined;

  console.log('Clearing old medicines and batches...');
  await prisma.batchDispenseRecord.deleteMany();
  await prisma.medicineBatch.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.retailSaleItem.deleteMany();
  await prisma.careOrder.deleteMany(); // Care orders depend on medicines
  await prisma.medicationAdministration.deleteMany();
  await prisma.medicationOrder.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.medicine.deleteMany();

  console.log('Seeding real-world pharmacy catalog...');

  const catalog = [
    {
      name: 'Paracetamol 500mg (Dolo)',
      unit: 'tablet',
      unitPrice: 2.0,
      stockQty: 500,
      reorderPoint: 100,
      isActive: true,
      shelf: 'A1, Rack 1',
      isGstTaxable: false,
      hsnCode: '3004',
      taxRate: 0,
      batches: [
        { batchNumber: 'DOL-2026-A', expiryDate: '2026-12-31', quantity: 300, costPrice: 1.2 },
        { batchNumber: 'DOL-2024-X', expiryDate: '2024-10-15', quantity: 200, costPrice: 1.1 } // Expiring soon
      ]
    },
    {
      name: 'Azithromycin 500mg',
      unit: 'tablet',
      unitPrice: 15.0,
      stockQty: 250,
      reorderPoint: 50,
      isActive: true,
      shelf: 'A1, Rack 2',
      isGstTaxable: true,
      hsnCode: '30049099',
      taxRate: 12,
      batches: [
        { batchNumber: 'AZI-B01', expiryDate: '2025-05-20', quantity: 250, costPrice: 10.0 }
      ]
    },
    {
      name: 'Amoxicillin + Clavulanate 625mg (Augmentin)',
      unit: 'tablet',
      unitPrice: 22.5,
      stockQty: 400,
      reorderPoint: 80,
      isActive: true,
      shelf: 'A2, Rack 1',
      isGstTaxable: true,
      hsnCode: '3004',
      taxRate: 12,
      batches: [
        { batchNumber: 'AUG-001', expiryDate: '2026-08-10', quantity: 400, costPrice: 15.0 }
      ]
    },
    {
      name: 'Cetirizine 10mg',
      unit: 'tablet',
      unitPrice: 3.5,
      stockQty: 600,
      reorderPoint: 200,
      isActive: true,
      shelf: 'A2, Rack 3',
      isGstTaxable: false,
      hsnCode: '3004',
      taxRate: 0,
      batches: [
        { batchNumber: 'CET-882', expiryDate: '2027-01-01', quantity: 600, costPrice: 1.5 }
      ]
    },
    {
      name: 'Pantoprazole 40mg (Pan 40)',
      unit: 'capsule',
      unitPrice: 9.0,
      stockQty: 300,
      reorderPoint: 100,
      isActive: true,
      shelf: 'B1, Rack 1',
      isGstTaxable: true,
      hsnCode: '3004',
      taxRate: 12,
      batches: [
        { batchNumber: 'PAN-X11', expiryDate: '2025-11-30', quantity: 300, costPrice: 6.0 }
      ]
    },
    {
      name: 'Ondansetron 4mg (Zofran)',
      unit: 'tablet',
      unitPrice: 12.0,
      stockQty: 150,
      reorderPoint: 50,
      isActive: true,
      shelf: 'B1, Rack 2',
      isGstTaxable: true,
      hsnCode: '3004',
      taxRate: 12,
      batches: [
        { batchNumber: 'OND-102', expiryDate: '2026-04-15', quantity: 150, costPrice: 8.5 }
      ]
    },
    // Syrups
    {
      name: 'Cough Syrup (Benadryl 150ml)',
      unit: 'bottle',
      unitPrice: 120.0,
      stockQty: 45,
      reorderPoint: 20,
      isActive: true,
      shelf: 'C1, Rack 1',
      isGstTaxable: true,
      hsnCode: '3004',
      taxRate: 12,
      batches: [
        { batchNumber: 'BEN-SYR-01', expiryDate: '2025-06-01', quantity: 20, costPrice: 90.0 },
        { batchNumber: 'BEN-SYR-02', expiryDate: '2024-11-10', quantity: 25, costPrice: 88.0 } // Expiring soon
      ]
    },
    {
      name: 'Paracetamol Paediatric Suspension 60ml',
      unit: 'bottle',
      unitPrice: 45.0,
      stockQty: 60,
      reorderPoint: 25,
      isActive: true,
      shelf: 'C1, Rack 2',
      isGstTaxable: false,
      hsnCode: '3004',
      taxRate: 0,
      batches: [
        { batchNumber: 'PCM-PED-99', expiryDate: '2026-02-15', quantity: 60, costPrice: 30.0 }
      ]
    },
    // Injections & Vials
    {
      name: 'Ceftriaxone 1g Injection',
      unit: 'vial',
      unitPrice: 55.0,
      stockQty: 200,
      reorderPoint: 50,
      isActive: true,
      shelf: 'Fridge 1, Top',
      isGstTaxable: true,
      hsnCode: '3004',
      taxRate: 12,
      batches: [
        { batchNumber: 'CEF-INJ-1', expiryDate: '2025-09-30', quantity: 200, costPrice: 40.0 }
      ]
    },
    {
      name: 'Diclofenac 75mg/3ml Injection',
      unit: 'vial',
      unitPrice: 25.0,
      stockQty: 100,
      reorderPoint: 30,
      isActive: true,
      shelf: 'D1, Rack 1',
      isGstTaxable: true,
      hsnCode: '3004',
      taxRate: 12,
      batches: [
        { batchNumber: 'DICLO-001', expiryDate: '2024-12-05', quantity: 100, costPrice: 15.0 } // Expiring in ~3 months
      ]
    },
    {
      name: 'Insulin Glargine 100IU/ml Pen',
      unit: 'syringe',
      unitPrice: 650.0,
      stockQty: 15,
      reorderPoint: 10,
      isActive: true,
      shelf: 'Fridge 1, Bottom',
      isGstTaxable: true,
      hsnCode: '3004',
      taxRate: 5,
      batches: [
        { batchNumber: 'INS-GLA-9X', expiryDate: '2025-08-20', quantity: 15, costPrice: 550.0 }
      ]
    },
    // Topicals / Drops
    {
      name: 'Betadine Ointment 20g',
      unit: 'tube',
      unitPrice: 110.0,
      stockQty: 40,
      reorderPoint: 15,
      isActive: true,
      shelf: 'E1, Rack 1',
      isGstTaxable: true,
      hsnCode: '3004',
      taxRate: 12,
      batches: [
        { batchNumber: 'BET-OINT-A', expiryDate: '2027-03-10', quantity: 40, costPrice: 85.0 }
      ]
    },
    {
      name: 'Refresh Tears Eye Drops 10ml',
      unit: 'bottle',
      unitPrice: 145.0,
      stockQty: 35,
      reorderPoint: 15,
      isActive: true,
      shelf: 'E1, Rack 2',
      isGstTaxable: true,
      hsnCode: '3004',
      taxRate: 12,
      batches: [
        { batchNumber: 'REF-EYE-01', expiryDate: '2025-01-31', quantity: 35, costPrice: 110.0 }
      ]
    },
    // Consumables / Medical Devices
    {
      name: 'Disposable Syringe 5ml with Needle',
      unit: 'syringe',
      unitPrice: 10.0,
      stockQty: 1000,
      reorderPoint: 200,
      isActive: true,
      shelf: 'Store Room A, Bin 1',
      isGstTaxable: true,
      hsnCode: '9018',
      taxRate: 18,
      batches: [
        { batchNumber: 'SYR-5ML-A', expiryDate: '2028-01-01', quantity: 1000, costPrice: 6.0 }
      ]
    },
    {
      name: 'Sterile Gauze Swab 10x10cm',
      unit: 'tablet', // Using tablet as generic piece for now, or just piece
      unitPrice: 5.0,
      stockQty: 500,
      reorderPoint: 100,
      isActive: true,
      shelf: 'Store Room A, Bin 2',
      isGstTaxable: true,
      hsnCode: '3005',
      taxRate: 12,
      batches: [
        { batchNumber: 'GAUZE-10X10', expiryDate: '2029-05-01', quantity: 500, costPrice: 2.5 }
      ]
    },
    {
      name: 'ORS Powder (Electral 21.8g)',
      unit: 'sachet',
      unitPrice: 22.0,
      stockQty: 120,
      reorderPoint: 50,
      isActive: true,
      shelf: 'F1, Rack 1',
      isGstTaxable: true,
      hsnCode: '2106',
      taxRate: 12,
      batches: [
        { batchNumber: 'ORS-ELEC-90', expiryDate: '2025-07-15', quantity: 120, costPrice: 16.0 }
      ]
    },
    // Out of stock item to test warnings
    {
      name: 'Ibuprofen 400mg',
      unit: 'tablet',
      unitPrice: 5.0,
      stockQty: 0,
      reorderPoint: 100,
      isActive: true,
      shelf: 'A3, Rack 1',
      isGstTaxable: false,
      hsnCode: '3004',
      taxRate: 0,
      batches: []
    }
  ];

  for (const item of catalog) {
    const medicine = await prisma.medicine.create({
      data: {
        clinicId,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        stockQty: item.stockQty,
        reorderPoint: item.reorderPoint,
        isActive: item.isActive,
        shelf: item.shelf,
        isGstTaxable: item.isGstTaxable,
        hsnCode: item.hsnCode,
        taxRate: item.taxRate
      }
    });

    if (item.batches.length > 0) {
      // Create a dummy purchase for these batches
      const purchase = await prisma.purchase.create({
        data: {
          clinicId,
          vendorName: 'Global Med Suppliers',
          vendorGstn: '27AAAAA0000A1Z5',
          invoiceNumber: `INV-OPEN-${Math.floor(Math.random() * 10000)}`,
          invoiceDate: new Date().toISOString(),
          itemDescription: 'Opening Stock',
          inputClassification: 'Medicine Stock',
          itcEligibility: 'Full',
          taxableValue: item.batches.reduce((sum, b) => sum + (b.quantity * b.costPrice), 0),
          igst: 0,
          cgst: 0,
          sgst: 0,
          totalValue: item.batches.reduce((sum, b) => sum + (b.quantity * b.costPrice), 0),
          recordedById: adminId || ''
        }
      });

      for (const batch of item.batches) {
        await prisma.medicineBatch.create({
          data: {
            medicineId: medicine.id,
            purchaseId: purchase.id,
            batchNumber: batch.batchNumber,
            expiryDate: new Date(batch.expiryDate).toISOString(),
            originalQty: batch.quantity,
            currentQty: batch.quantity,
            costPrice: batch.costPrice
          }
        });
      }
    }

    if (item.stockQty > 0) {
      await prisma.stockMovement.create({
        data: {
          clinicId,
          medicineId: medicine.id,
          delta: item.stockQty,
          newQty: item.stockQty,
          reason: 'Initial Seed Stock',
          performedById: adminId || ''
        }
      });
    }
  }

  console.log('Pharmacy catalog seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
