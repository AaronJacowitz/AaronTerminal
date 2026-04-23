export interface CityOption {
  city: string
  state: string
  label: string // "City, ST"
}

const RAW: [string, string][] = [
  ['New York','NY'],['Los Angeles','CA'],['Chicago','IL'],['Houston','TX'],
  ['Phoenix','AZ'],['Philadelphia','PA'],['San Antonio','TX'],['San Diego','CA'],
  ['Dallas','TX'],['San Jose','CA'],['Austin','TX'],['Jacksonville','FL'],
  ['Fort Worth','TX'],['Columbus','OH'],['Charlotte','NC'],['Indianapolis','IN'],
  ['San Francisco','CA'],['Seattle','WA'],['Denver','CO'],['Nashville','TN'],
  ['Oklahoma City','OK'],['El Paso','TX'],['Washington','DC'],['Las Vegas','NV'],
  ['Louisville','KY'],['Memphis','TN'],['Portland','OR'],['Baltimore','MD'],
  ['Milwaukee','WI'],['Albuquerque','NM'],['Tucson','AZ'],['Fresno','CA'],
  ['Sacramento','CA'],['Mesa','AZ'],['Kansas City','MO'],['Atlanta','GA'],
  ['Omaha','NE'],['Colorado Springs','CO'],['Raleigh','NC'],['Long Beach','CA'],
  ['Virginia Beach','VA'],['Minneapolis','MN'],['Tampa','FL'],['New Orleans','LA'],
  ['Arlington','TX'],['Bakersfield','CA'],['Honolulu','HI'],['Anaheim','CA'],
  ['Aurora','CO'],['Santa Ana','CA'],['Corpus Christi','TX'],['Riverside','CA'],
  ['St. Louis','MO'],['Lexington','KY'],['Pittsburgh','PA'],['Anchorage','AK'],
  ['Stockton','CA'],['Cincinnati','OH'],['St. Paul','MN'],['Greensboro','NC'],
  ['Toledo','OH'],['Newark','NJ'],['Plano','TX'],['Henderson','NV'],
  ['Orlando','FL'],['Lincoln','NE'],['Jersey City','NJ'],['Chandler','AZ'],
  ['Fort Wayne','IN'],['Buffalo','NY'],['Durham','NC'],['Madison','WI'],
  ['Lubbock','TX'],['Winston-Salem','NC'],['Garland','TX'],['Glendale','AZ'],
  ['Hialeah','FL'],['Reno','NV'],['Baton Rouge','LA'],['Irvine','CA'],
  ['Chesapeake','VA'],['Irving','TX'],['Scottsdale','AZ'],['North Las Vegas','NV'],
  ['Fremont','CA'],['Gilbert','AZ'],['San Bernardino','CA'],['Birmingham','AL'],
  ['Boise','ID'],['Rochester','NY'],['Richmond','VA'],['Spokane','WA'],
  ['Des Moines','IA'],['Montgomery','AL'],['Modesto','CA'],['Fayetteville','NC'],
  ['Tacoma','WA'],['Shreveport','LA'],['Fontana','CA'],['Moreno Valley','CA'],
  ['Glendale','CA'],['Akron','OH'],['Yonkers','NY'],['Huntington Beach','CA'],
  ['Little Rock','AR'],['Columbus','GA'],['Augusta','GA'],['Grand Rapids','MI'],
  ['Oxnard','CA'],['Tallahassee','FL'],['Huntsville','AL'],['Worcester','MA'],
  ['Knoxville','TN'],['Newport News','VA'],['Providence','RI'],['Fort Lauderdale','FL'],
  ['Rancho Cucamonga','CA'],['Santa Clarita','CA'],['Garden Grove','CA'],
  ['Oceanside','CA'],['Chattanooga','TN'],['Fort Collins','CO'],['Springfield','MO'],
  ['Clarksville','TN'],['Murfreesboro','TN'],['Laredo','TX'],['Jackson','MS'],
  ['Alexandria','VA'],['Hayward','CA'],['Lancaster','CA'],['Salinas','CA'],
  ['Palmdale','CA'],['Sunnyvale','CA'],['Pomona','CA'],['Escondido','CA'],
  ['Kansas City','KS'],['Surprise','AZ'],['Pasadena','TX'],['Roseville','CA'],
  ['Torrance','CA'],['Paterson','NJ'],['Bridgeport','CT'],['McAllen','TX'],
  ['Savannah','GA'],['Syracuse','NY'],['Dayton','OH'],['Hollywood','FL'],
  ['Macon','GA'],['Rockford','IL'],['Tempe','AZ'],['Cape Coral','FL'],
  ['Peoria','IL'],['Springfield','MA'],['Eugene','OR'],['Salem','OR'],
  ['Sioux Falls','SD'],['Cary','NC'],['Fargo','ND'],['Hartford','CT'],
  ['Shreveport','LA'],['Overland Park','KS'],['Mesquite','TX'],['McKinney','TX'],
  ['Frisco','TX'],['Hampton','VA'],['Tallahassee','FL'],['Glendale','AZ'],
  ['Warren','MI'],['West Valley City','UT'],['Columbia','SC'],['Sterling Heights','MI'],
  ['Cedar Rapids','IA'],['Topeka','KS'],['Thousand Oaks','CA'],['Visalia','CA'],
  ['Elizabeth','NJ'],['Simi Valley','CA'],['Concord','CA'],['Stamford','CT'],
  ['Kent','WA'],['Santa Rosa','CA'],['Coral Springs','FL'],['Waco','TX'],
  ['Bellevue','WA'],['Gainesville','FL'],['Boulder','CO'],['Palm Bay','FL'],
  ['West Palm Beach','FL'],['Miami','FL'],['Fort Myers','FL'],['Naples','FL'],
  ['Sarasota','FL'],['Clearwater','FL'],['St. Petersburg','FL'],['Pensacola','FL'],
  ['Kissimmee','FL'],['Deltona','FL'],['Lakeland','FL'],['Daytona Beach','FL'],
]

export const CITIES: CityOption[] = RAW.map(([city, state]) => ({
  city, state, label: `${city}, ${state}`,
}))

// Simple fuzzy score: lower is better
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t.startsWith(q)) return 0
  if (t.includes(q)) return 1
  // Check if all query chars appear in order
  let ti = 0
  let matches = 0
  for (const ch of q) {
    const idx = t.indexOf(ch, ti)
    if (idx === -1) break
    matches++
    ti = idx + 1
  }
  if (matches === q.length) return 2 + (t.length - q.length)
  // Levenshtein on first word only (for typo tolerance)
  const firstWord = t.split(' ')[0]
  return levenshtein(q.split(' ')[0], firstWord) + 3
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[a.length][b.length]
}

export function searchCities(query: string, limit = 6): CityOption[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  // Also check zip code — don't show city suggestions for pure digits
  if (/^\d+$/.test(q)) return []

  return CITIES
    .map(c => ({ c, score: Math.min(fuzzyScore(q, c.city), fuzzyScore(q, c.label)) }))
    .filter(({ score }) => score < 6)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ c }) => c)
}

// Normalize a free-form query to title case, handle common abbreviations
const ABBREVS: Record<string, string> = {
  'nyc': 'New York, NY', 'ny': 'New York, NY',
  'la':  'Los Angeles, CA', 'sf': 'San Francisco, CA',
  'dc':  'Washington, DC', 'phx': 'Phoenix, AZ',
  'chi': 'Chicago, IL', 'hou': 'Houston, TX',
  'atl': 'Atlanta, GA', 'mia': 'Miami, FL',
  'lv':  'Las Vegas, NV', 'pdx': 'Portland, OR',
  'sea': 'Seattle, WA', 'den': 'Denver, CO',
  'bos': 'Boston, MA', 'dfw': 'Dallas, TX',
}

export function normalizeQuery(raw: string): string {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  if (ABBREVS[lower]) return ABBREVS[lower]
  // Title-case each word
  return trimmed.replace(/\b\w/g, c => c.toUpperCase())
}
