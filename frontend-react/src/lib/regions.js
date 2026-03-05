// Map region/country names (as returned by Google Trends) to ISO alpha-3 codes
// for react-simple-maps geography matching.
const REGIONS = {
  'United States': 'USA',
  'United Kingdom': 'GBR',
  'Canada': 'CAN',
  'Germany': 'DEU',
  'France': 'FRA',
  'Australia': 'AUS',
  'Japan': 'JPN',
  'Brazil': 'BRA',
  'India': 'IND',
  'South Korea': 'KOR',
  'Mexico': 'MEX',
  'Italy': 'ITA',
  'Spain': 'ESP',
  'Netherlands': 'NLD',
  'Sweden': 'SWE',
  'Switzerland': 'CHE',
  'China': 'CHN',
  'Russia': 'RUS',
  'Indonesia': 'IDN',
  'Turkey': 'TUR',
  'Saudi Arabia': 'SAU',
  'Poland': 'POL',
  'Argentina': 'ARG',
  'Nigeria': 'NGA',
  'South Africa': 'ZAF',
  'Thailand': 'THA',
  'Vietnam': 'VNM',
  'Philippines': 'PHL',
  'Egypt': 'EGY',
  'Colombia': 'COL',
  'Chile': 'CHL',
  'Singapore': 'SGP',
  'Malaysia': 'MYS',
  'Israel': 'ISR',
  'Ireland': 'IRL',
  'New Zealand': 'NZL',
  'Portugal': 'PRT',
  'Belgium': 'BEL',
  'Austria': 'AUT',
  'Denmark': 'DNK',
  'Norway': 'NOR',
  'Finland': 'FIN',
  'Taiwan': 'TWN',
  'Hong Kong': 'HKG',
  'UAE': 'ARE',
  'United Arab Emirates': 'ARE',
  'Pakistan': 'PAK',
  'Bangladesh': 'BGD',
  'Peru': 'PER',
  'Ukraine': 'UKR',
  'Romania': 'ROU',
  'Czech Republic': 'CZE',
  'Czechia': 'CZE',
  'Greece': 'GRC',
  'Hungary': 'HUN',
  'Kenya': 'KEN',
  'Morocco': 'MAR',
  // Short codes
  'US': 'USA', 'UK': 'GBR', 'USA': 'USA', 'GB': 'GBR',
  'CA': 'CAN', 'DE': 'DEU', 'FR': 'FRA', 'AU': 'AUS',
  'JP': 'JPN', 'BR': 'BRA', 'IN': 'IND', 'KR': 'KOR',
}

export function getRegionCode(name) {
  if (REGIONS[name]) return REGIONS[name]
  const lower = name.toLowerCase()
  for (const [key, val] of Object.entries(REGIONS)) {
    if (key.toLowerCase() === lower) return val
  }
  for (const [key, val] of Object.entries(REGIONS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return val
  }
  return null
}

export function getHighlightedCodes(regionNames) {
  const codes = new Set()
  for (const name of regionNames) {
    const code = getRegionCode(name)
    if (code) codes.add(code)
  }
  return codes
}
