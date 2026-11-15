import directory from '@/data/regions.json';

export interface Region { code: string; name: string; fullName: string }
const records: Region[] = directory.records.map(([code, name]) => ({ code, name, fullName: name }));
const byCode = new Map(records.map(row => [row.code, row]));
export const PROVINCES = records.filter(row => !row.name.includes(' '));
export const REGION_SOURCE = directory.source;

export function getProvinceCode(code: string): string {
  const renamed: Record<string, string> = { '29': '12', '46': '12', '42': '51', '45': '52' };
  const prefix = renamed[code.slice(0, 2)] || code.slice(0, 2);
  return PROVINCES.find(row => row.code.slice(0, 2) === prefix)?.code || '';
}

export function getDistricts(provinceCode: string): Region[] {
  const province = byCode.get(provinceCode);
  if (!province) return [];
  const children = records.filter(row => row.code !== provinceCode
    && row.code.startsWith(provinceCode.slice(0, 2)) && row.code.endsWith('00000'));
  // Sejong has no intermediate district code; its legal dong are direct children.
  if (!children.length) return [{ ...province, name: `${province.name} 전체` }];
  return children.map(row => ({ ...row, name: row.fullName.slice(province.fullName.length).trim() }));
}

export function getNeighborhoods(districtCode: string): Region[] {
  const district = byCode.get(districtCode);
  if (!district) return [];
  // Non-autonomous wards (e.g. Suwon Jangan-gu) also belong to their city option.
  const prefix = districtCode[4] === '0' ? districtCode.slice(0, 4) : districtCode.slice(0, 5);
  return records.filter(row => row.code.startsWith(prefix) && !row.code.endsWith('00000'))
    .map(row => ({ ...row, name: row.fullName.startsWith(district.fullName + ' ')
      ? row.fullName.slice(district.fullName.length).trim() : row.fullName }));
}

const provinceAliases: Record<string, string[]> = {
  '서울특별시': ['서울'], '부산광역시': ['부산'], '대구광역시': ['대구'], '인천광역시': ['인천'],
  '대전광역시': ['대전'], '울산광역시': ['울산'], '세종특별자치시': ['세종'], '경기도': ['경기'],
  '충청북도': ['충북'], '충청남도': ['충남'], '경상북도': ['경북'], '경상남도': ['경남'],
  '강원특별자치도': ['강원도', '강원'], '전북특별자치도': ['전라북도', '전북'],
  '제주특별자치도': ['제주도', '제주'],
  '전남광주통합특별시': ['전라남도', '전남', '광주광역시', '광주'],
};

/** Match complete hierarchy tokens, including addresses saved before a province rename. */
export function addressMatchesRegion(address: string, region: Region | undefined, legalCode?: string): boolean {
  if (!region) return true;
  const prefixMap: Record<string, string> = { '42': '51', '45': '52' };
  const normalizedCode = legalCode && ((prefixMap[legalCode.slice(0, 2)] || legalCode.slice(0, 2)) + legalCode.slice(2));
  if (normalizedCode && byCode.has(normalizedCode)) {
    if (PROVINCES.some(row => row.code === region.code)) return getProvinceCode(normalizedCode) === region.code;
    if (region.code.endsWith('00000')) return normalizedCode.startsWith(region.code[4] === '0' ? region.code.slice(0, 4) : region.code.slice(0, 5));
    return normalizedCode === region.code;
  }
  const [province, ...rest] = region.fullName.split(/\s+/);
  const tokens = address.trim().split(/\s+/);
  if (![province, ...(provinceAliases[province] || [])].includes(tokens[0])) return false;
  if (region.code.endsWith('00000')) return rest.every((token, index) => tokens[index + 1] === token);
  const district = rest.slice(0, -1);
  if (!district.every((token, index) => tokens[index + 1] === token)) return false;
  // Road addresses may carry their legal dong inside Daum's parenthesized suffix.
  const parts = address.split(/[\s(),]+/);
  return parts.includes(rest[rest.length - 1]);
}
