#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os

# Read the file as binary first
with open('src/components/PosUI.jsx', 'rb') as f:
    content = f.read()

# Decode with utf-8, removing BOM if present
text = content.decode('utf-8-sig')

# Define exact replacements (using the garbled text as keys)
replacements = {
    '* �ӹǳ�ҡ�ʹ��ѧ�ѡ�����������': '* คำนวณจากมูลค่าหลังหักส่วนลดรายการสินค้า',
    '* Ŵ�ҡ�ʹ�ط�Է��º��': '* หักจากยอดท้ายที่ต้องชำระ',
    '<div className="text-slate-400 mb-1">�ʹ����Թ���</div>': '<div className="text-slate-400 mb-1">มูลค่าสินค้า</div>',
    '<div className="text-slate-400 text-sm font-medium mb-1">�ʹ�ط�� (Net Total)</div>': '<div className="text-slate-400 text-sm font-medium mb-1">มูลค่าสุทธิ (Net Total)</div>',
}

# Apply replacements
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new)
        print(f"✓ Replaced: {old[:30]}...")
    else:
        print(f"✗ Not found: {old[:30]}...")

# Write back without BOM
with open('src/components/PosUI.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("\nEncoding fix completed!")
