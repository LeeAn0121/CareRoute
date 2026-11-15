#!/usr/bin/env python3
"""Refresh the bundled public legal-region directory; no app credentials required."""
import csv
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

SOURCE = 'https://www.code.go.kr/etc/codeFullDown.do?codeseId=00002'
ROOT = Path(__file__).resolve().parents[1]


def generate(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        files = [name for name in archive.namelist() if name.endswith('.txt')]
        if len(files) != 1:
            raise ValueError('Unexpected official code archive')
        content = archive.read(files[0])
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = content.decode('cp949')
    rows = []
    for row in csv.DictReader(io.StringIO(text), delimiter='\t'):
        code, name = row['법정동코드'], row['법정동명']
        if row['폐지여부'] != '존재' or not code.endswith('00'):
            continue  # Ri subdivisions are outside the three selectors.
        if len(code) != 10 or not code.isdigit() or not name.strip():
            raise ValueError('Invalid official code row')
        rows.append([code, name.strip()])
    if len(rows) < 5000 or len({row[0] for row in rows}) != len(rows):
        raise ValueError('Incomplete or duplicated official code directory')
    result = {
        'source': 'https://www.code.go.kr/stdcode/regCodeL.do',
        'download': SOURCE,
        'retrievedAt': datetime.now(timezone.utc).isoformat(),
        'records': sorted(rows),
    }
    target = ROOT / 'src/data/regions.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Wrote {len(rows)} current legal-region records to {target.relative_to(ROOT)}')


if __name__ == '__main__':
    with urlopen(SOURCE, timeout=60) as response:
        generate(response.read())
