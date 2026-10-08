import re
import sys

def main():
    seed_file = "prisma/seed.ts"
    with open(seed_file, "r") as f:
        content = f.read()

    # 1. Add clinic creation at the start
    clinic_creation = """
  // 1. Create a Default Clinic for Seeding
  const defaultClinic = await prisma.clinic.upsert({
    where: { name: 'Apollo Dermatology Center' },
    update: {},
    create: {
      name: 'Apollo Dermatology Center',
      address: '100ft Road, Indiranagar',
      phone: '9876543210',
      email: 'contact@apollo-derm.com',
    },
  });
  const clinicId = defaultClinic.id;

"""
    if "const defaultClinic" not in content:
        content = content.replace("const superAdminHash", clinic_creation + "  const superAdminHash")

    # 2. Add clinicId to all user creations
    content = content.replace("role: 'SUPER_ADMIN',", "role: 'SUPER_ADMIN',\n      clinicId,")
    content = content.replace("role: 'MASTER',", "role: 'MASTER',\n      clinicId,")
    content = content.replace("role: 'DOCTOR',", "role: 'DOCTOR',\n      clinicId,")
    content = content.replace("role: 'RM',", "role: 'RM',\n      clinicId,")
    content = content.replace("role: 'RECEPTION',", "role: 'RECEPTION',\n      clinicId,")
    content = content.replace("role: 'PHARMACY',", "role: 'PHARMACY',\n      clinicId,")
    content = content.replace("role: 'ACCOUNT',", "role: 'ACCOUNT',\n      clinicId,")
    
    # User upsert doesn't need to change `where: { email }` because email is globally unique.
    # However we should make sure we're not duplicating `clinicId` if the script runs twice.
    # Actually just adding it to the objects in the array `users` is enough.

    # 3. Add clinicId to all patients
    content = re.sub(r'(howHeardAboutUs: [^,]+,)', r'\1\n      clinicId,', content)
    # Patient upsert where: { uhid } is fine because uhid is unique

    # 4. TreatmentMaster
    # Add clinicId to objects
    content = re.sub(r'(price: [0-9]+ )}', r'\1, clinicId }', content)
    # Modify upsert to use compound key for finding, but `create` and `update` get the object which has clinicId
    content = content.replace("where: { name: tr.name },", "where: { clinicId_name: { clinicId, name: tr.name } },")

    # 5. PackageType
    content = re.sub(r'(totalSittings: [0-9]+,)', r'\1\n      clinicId,', content)
    content = content.replace("where: { name: pkg.name },", "where: { clinicId_name: { clinicId, name: pkg.name } },")

    # 6. PackagePurchase
    # just add clinicId to the object
    content = content.replace("sittingsRemaining: 5,", "sittingsRemaining: 5,\n      clinicId,")
    
    # 7. CommissionRule
    content = re.sub(r'(value: [0-9]+ )}', r'\1, clinicId }', content)
    content = content.replace("where: { role: rule.role },", "where: { clinicId_role: { clinicId, role: rule.role } },")

    # 8. Visit
    content = content.replace("nextAppointmentDate: '2026-08-25',", "nextAppointmentDate: '2026-08-25',\n    clinicId,")
    content = content.replace("nextAppointmentDate: '2026-08-01',", "nextAppointmentDate: '2026-08-01',\n    clinicId,")

    # 9. CommissionRecord
    content = content.replace("visitId: visit1.id,", "clinicId,\n        visitId: visit1.id,")

    # 10. Invoice
    content = content.replace("paymentRef: 'UPI-9876543210',", "paymentRef: 'UPI-9876543210',\n      clinicId,")
    
    # 11. Medicine
    content = re.sub(r'(unitPrice: [0-9]+ )}', r'\1, clinicId }', content)
    content = content.replace("where: { name: med.name },", "where: { clinicId_name: { clinicId, name: med.name } },")

    # 12. Prescription
    content = content.replace("status: 'Pending',", "status: 'Pending',\n    clinicId,")
    
    # 13. Purchase
    content = content.replace("totalValue: 85550,", "totalValue: 85550,\n      clinicId,")
    content = content.replace("totalValue: 218300,", "totalValue: 218300,\n      clinicId,")
    content = content.replace("totalValue: 28320,", "totalValue: 28320,\n      clinicId,")

    with open(seed_file, "w") as f:
        f.write(content)

if __name__ == "__main__":
    main()
