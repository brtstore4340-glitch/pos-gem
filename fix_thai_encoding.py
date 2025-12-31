#!/usr/bin/env python
# -*- coding: utf-8 -*-
import codecs

# Read the file
with codecs.open('src/components/PosUI.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the encoding issues
replacements = [
    ('* �ӹǳ�ҡ�ʹ��ѧ�ѡ�����������', '* คำนวณจากมูลค่าหลังหักส่วนลดรายการสินค้า'),
    ('* Ŵ�ҡ�ʹ�ط�Է��º��', '* หักจากยอดท้ายที่ต้องชำระ'),
    ('�ʹ����Թ���', 'มูลค่าสินค้า'),
    ('�ʹ�ط��', 'มูลค่าสุทธิ'),
]

for old, new in replacements:
    content = content.replace(old, new)

# Write back with UTF-8 encoding
with codecs.open('src/components/PosUI.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed Thai encoding issues successfully!")
