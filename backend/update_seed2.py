import re

def main():
    seed_file = "prisma/seed.ts"
    with open(seed_file, "r") as f:
        content = f.read()

    # Remove duplicates like `clinicId, clinicId,`
    content = re.sub(r'clinicId,\s*clinicId\s*}', r'clinicId }', content)
    content = re.sub(r'clinicId,\s*clinicId,', r'clinicId,', content)
    
    # Let's fix specific lines based on the compiler error
    # prisma/seed.ts:247:53 - error TS1117: clinicId, shareType: 'percentage', value: 5 , clinicId },
    content = content.replace("clinicId, shareType: 'percentage', value: 5 , clinicId },", "shareType: 'percentage', value: 5 , clinicId },")
    content = content.replace("clinicId, shareType: 'fixed', value: 300 , clinicId },", "shareType: 'fixed', value: 300 , clinicId },")
    content = content.replace("clinicId, shareType: 'percentage', value: 15 , clinicId },", "shareType: 'percentage', value: 15 , clinicId },")
    content = content.replace("clinicId, shareType: 'percentage', value: 10 , clinicId },", "shareType: 'percentage', value: 10 , clinicId },")
    
    # 332, 361, 379, 418
    # Let's just do a regex to remove lines that just say `clinicId,` if they immediately precede another `clinicId,`
    content = re.sub(r'clinicId,\s*\n\s*clinicId,', 'clinicId,', content)
    content = re.sub(r'clinicId,\s*\n\s*clinicId,', 'clinicId,', content)
    content = re.sub(r'clinicId,\s*\n\s*clinicId,', 'clinicId,', content)
    
    with open(seed_file, "w") as f:
        f.write(content)

if __name__ == "__main__":
    main()
