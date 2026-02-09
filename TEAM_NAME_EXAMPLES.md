# Team Name Examples for API

This document shows how team names with special characters are handled automatically.

## How It Works

When searching for a team logo, the system:
1. **First** tries the exact name you provided (e.g., "FC Bayern München")
2. **If that fails**, automatically tries a normalized ASCII version (e.g., "FC Bayern Munchen")
3. **If that fails**, falls back to your local logo file

## Common Examples

### German Teams
| Database Name | API Search (Automatic) | TheSportsDB Result |
|--------------|------------------------|-------------------|
| FC Bayern München | FC Bayern Munchen | ✅ Bayern Munich |
| Borussia Mönchengladbach | Borussia Monchengladbach | ✅ Borussia Monchengladbach |
| 1. FC Köln | 1. FC Koln | ✅ FC Koln |
| VfL Bochum | VfL Bochum | ✅ VfL Bochum |

### Spanish Teams
| Database Name | API Search (Automatic) | TheSportsDB Result |
|--------------|------------------------|-------------------|
| Atlético de Madrid | Atletico de Madrid | ✅ Atletico Madrid |
| Athletic Bilbao | Athletic Bilbao | ✅ Athletic Bilbao |
| CA Osasuna | CA Osasuna | ✅ Osasuna |
| Real Betis Balompié | Real Betis Balompie | ✅ Real Betis |

### French Teams
| Database Name | API Search (Automatic) | TheSportsDB Result |
|--------------|------------------------|-------------------|
| AS Saint-Étienne | AS Saint-Etienne | ✅ Saint-Etienne |
| Olympique Marseille | Olympique Marseille | ✅ Marseille |
| Paris Saint-Germain | Paris Saint-Germain | ✅ Paris SG |
| Stade de Reims | Stade de Reims | ✅ Reims |

### Portuguese Teams
| Database Name | API Search (Automatic) | TheSportsDB Result |
|--------------|------------------------|-------------------|
| FC Porto | FC Porto | ✅ FC Porto |
| Sporting CP | Sporting CP | ✅ Sporting CP |
| SL Benfica | SL Benfica | ✅ Benfica |
| Vitória Guimarães SC | Vitoria Guimaraes SC | ✅ Guimaraes |

### Nordic Teams
| Database Name | API Search (Automatic) | TheSportsDB Result |
|--------------|------------------------|-------------------|
| FC København | FC Kobenhavn | ✅ FC Copenhagen |
| Brøndby IF | Brondby IF | ✅ Brondby |
| Malmö FF | Malmo FF | ✅ Malmo FF |
| IFK Göteborg | IFK Goteborg | ✅ IFK Goteborg |

### Turkish Teams
| Database Name | API Search (Automatic) | TheSportsDB Result |
|--------------|------------------------|-------------------|
| Galatasaray | Galatasaray | ✅ Galatasaray |
| Beşiktaş JK | Besiktas JK | ✅ Besiktas |
| Fenerbahçe | Fenerbahce | ✅ Fenerbahce |
| Trabzonspor | Trabzonspor | ✅ Trabzonspor |

## Best Practices

### ✅ Recommended: Use Normalized Names in Database

For best results, store the normalized (ASCII) version in the `apiTeamName` field:

```sql
-- Good: Normalized name
UPDATE teams SET apiTeamName = 'Bayern Munich' WHERE name = 'FC Bayern München';
UPDATE teams SET apiTeamName = 'Atletico Madrid' WHERE name = 'Atlético de Madrid';
```

### ✅ Even Better: Use API Team ID

The most reliable method is to use the specific TheSportsDB team ID:

```sql
-- Best: Use specific API ID
UPDATE teams SET apiTeamId = '133602' WHERE name = 'FC Bayern München';
UPDATE teams SET apiTeamId = '134301' WHERE name = 'Atlético de Madrid';
```

To find the team ID:
1. Search: `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Bayern`
2. Look for `idTeam` in the JSON response
3. Store that ID in your database

### ⚠️ Acceptable: Let Auto-Normalization Handle It

You can also just store the original name and let the system handle it:

```sql
-- Works: System will auto-normalize
UPDATE teams SET apiTeamName = 'FC Bayern München' WHERE name = 'FC Bayern München';
-- System will automatically try "FC Bayern Munchen" if the first search fails
```

## Special Characters Supported

The system automatically converts these characters:

- **German**: ü→u, ö→o, ä→a, ß→ss, Ü→U, Ö→O, Ä→A
- **French**: é→e, è→e, ê→e, ë→e, à→a, â→a, ç→c
- **Spanish**: á→a, é→e, í→i, ó→o, ú→u, ñ→n
- **Portuguese**: ã→a, õ→o, ç→c
- **Nordic**: å→a, ä→a, ö→o, ø→o, æ→ae
- **And many more...**

## Testing

Test if a team name works:

```tsx
import { testTeamLogo } from './scripts/populateApiTeamNames';

// Test with special characters
await testTeamLogo('Bayern München');

// Check console for:
// - Original API search result
// - Normalized API search result
// - Final logo URL found
```

## Troubleshooting

If a team still doesn't load after auto-normalization:

1. **Check the team exists in TheSportsDB**
   - Visit: `https://www.thesportsdb.com/team/133602-Bayern-Munich`
   - Search their database manually

2. **Try different name variations**
   ```sql
   -- Try English name
   UPDATE teams SET apiTeamName = 'Bayern Munich' WHERE name = 'FC Bayern München';

   -- Try shorter name
   UPDATE teams SET apiTeamName = 'Bayern' WHERE name = 'FC Bayern München';
   ```

3. **Use the specific API ID (most reliable)**
   ```sql
   UPDATE teams SET apiTeamId = '133602' WHERE name = 'FC Bayern München';
   ```

4. **Fall back to local logo**
   - Keep your local logo file as fallback
   - System will automatically use it if API fails
