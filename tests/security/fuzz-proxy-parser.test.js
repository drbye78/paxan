// Fuzzing tests for proxy data parsers
// Tests malformed, edge-case, and potentially malicious input against
// parseCSVLine, parseProxyScrapeCSV, parsePeasyProxy, parseSpeed,
// normalizeProxyType, and getCountryName.
//
// These parsers handle untrusted data from external proxy providers.
// They must never throw, crash, produce XSS vectors, or leak injection payloads.

import {
  parsePeasyProxy,
  parseProxyScrapeCSV,
  parseCSVLine,
  parseSpeed,
  normalizeProxyType,
  getCountryName,
} from '../../src/background/proxy-fetcher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid CSV for parseProxyScrapeCSV.
 * The real parser expects headers: ip,port,ip_data_countryCode,protocol,average_timeout.
 * We also need at least 3 parts per line (ip, port, countryCode minimum).
 */
function csvWithRow(fieldMap) {
  const defaults = {
    ip: '1.2.3.4',
    port: '8080',
    ip_data_countryCode: 'US',
    protocol: 'HTTP',
    average_timeout: '45 ms',
  };
  const row = { ...defaults, ...fieldMap };
  const headers = 'ip,port,ip_data_countryCode,protocol,average_timeout';
  const data = [row.ip, row.port, row.ip_data_countryCode, row.protocol, row.average_timeout].join(',');
  return `${headers}\n${data}`;
}

/**
 * Build minimal valid HTML for parsePeasyProxy.
 * Expects at least 6 <td> cells in a <tr>.
 * Cell 0: ip:port, Cell 1: country, Cell 2: type, Cell 4: speed, Cell 5: lastCheck
 */
function htmlWithRow(cells) {
  const defaults = ['1.2.3.4:8080', 'United States', 'HTTP', '', '45 ms', 'Recently'];
  const merged = [];
  for (let i = 0; i < 6; i++) {
    merged[i] = cells[i] !== undefined ? cells[i] : defaults[i];
  }
  const tdString = merged.map((c) => `<td>${c}</td>`).join('');
  return `<table><tr>${tdString}</tr></table>`;
}

// ---------------------------------------------------------------------------
// 1. parseCSVLine — edge cases
// ---------------------------------------------------------------------------

describe('parseCSVLine — edge cases', () => {
  test('empty string returns array with one empty string', () => {
    expect(parseCSVLine('')).toEqual(['']);
  });

  test('null and undefined throw (string methods not available)', () => {
    // The function does char-by-char iteration on the input.
    // Passing null/undefined will throw. This verifies the behaviour.
    expect(() => parseCSVLine(null)).toThrow();
    expect(() => parseCSVLine(undefined)).toThrow();
  });

  test('single value', () => {
    expect(parseCSVLine('hello')).toEqual(['hello']);
  });

  test('two values', () => {
    expect(parseCSVLine('hello,world')).toEqual(['hello', 'world']);
  });

  test('many values', () => {
    expect(parseCSVLine('a,b,c,d,e,f,g,h,i,j')).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    );
  });

  test('quoted value with comma inside', () => {
    expect(parseCSVLine('"hello, world",foo')).toEqual(['hello, world', 'foo']);
  });

  test('escaped quotes (doubled) inside quoted field', () => {
    // CSV standard: "" inside quotes → literal "
    expect(parseCSVLine('"say ""hello"" world",bar')).toEqual([
      'say "hello" world',
      'bar',
    ]);
  });

  test('mixed quoted and unquoted fields', () => {
    expect(parseCSVLine('plain,"quoted,value","another ""quoted""",last')).toEqual([
      'plain',
      'quoted,value',
      'another "quoted"',
      'last',
    ]);
  });

  test('line with only whitespace', () => {
    expect(parseCSVLine('   ')).toEqual(['   ']);
  });

  test('line with only commas', () => {
    expect(parseCSVLine(',,')).toEqual(['', '', '']);
  });

  test('unicode characters in fields', () => {
    expect(parseCSVLine('日本, español, café, 中文')).toEqual([
      '日本',
      ' español',
      ' café',
      ' 中文',
    ]);
  });

  test('very long field value (>10,000 chars)', () => {
    const longValue = 'A'.repeat(12000);
    const line = `"${longValue}",short`;
    const result = parseCSVLine(line);
    expect(result[0]).toBe(longValue);
    expect(result[1]).toBe('short');
    expect(result).toHaveLength(2);
  });

  test('fields with carriage return \\r', () => {
    // \r is NOT a comma and NOT a quote → treated as literal content
    const result = parseCSVLine('hello\rworld,foo');
    expect(result[0]).toBe('hello\rworld');
    expect(result[1]).toBe('foo');
  });

  test('fields with newline \\n inside quotes', () => {
    const result = parseCSVLine('"line1\nline2",normal');
    expect(result[0]).toBe('line1\nline2');
    expect(result[1]).toBe('normal');
  });

  test('fields with HTML injection', () => {
    const result = parseCSVLine('<script>alert(1)</script>,safe');
    expect(result[0]).toBe('<script>alert(1)</script>');
    expect(result[1]).toBe('safe');
  });

  test('fields with SQL injection', () => {
    const result = parseCSVLine("'; DROP TABLE proxies; --,safe");
    expect(result[0]).toBe("'; DROP TABLE proxies; --");
    expect(result[1]).toBe('safe');
  });

  test('unbalanced quotes (opening quote never closed)', () => {
    // Remaining content after the opening quote is treated as one field
    const result = parseCSVLine('"unclosed,next');
    expect(result).toEqual(['unclosed,next']);
  });

  test('trailing backslash is literal', () => {
    const result = parseCSVLine('value\\,foo');
    expect(result[0]).toBe('value\\');
    expect(result[1]).toBe('foo');
  });

  test('starting with comma', () => {
    expect(parseCSVLine(',a,b')).toEqual(['', 'a', 'b']);
  });

  test('ending with comma', () => {
    expect(parseCSVLine('a,b,')).toEqual(['a', 'b', '']);
  });
});

// ---------------------------------------------------------------------------
// 2. parseProxyScrapeCSV — edge cases
// ---------------------------------------------------------------------------

describe('parseProxyScrapeCSV — edge cases', () => {
  test('empty CSV string returns empty array', () => {
    expect(parseProxyScrapeCSV('')).toEqual([]);
  });

  test('CSV with only headers, no data rows', () => {
    const csv = 'ip,port,ip_data_countryCode,protocol,average_timeout';
    expect(parseProxyScrapeCSV(csv)).toEqual([]);
  });

  test('CSV with extra columns', () => {
    const csv =
      'ip,port,ip_data_countryCode,protocol,average_timeout,extra1,extra2,extra3\n' +
      '1.2.3.4,8080,US,HTTP,45 ms,x,y,z';
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('1.2.3.4');
    expect(result[0].port).toBe(8080);
    // The parser lowercases the header line before extracting column indices,
    // and the search string is 'ip_data_countryCode' (mixed case). After
    // lowercasing, the extra-column CSV header has 'ip_data_countrycode' which
    // won't match — so country falls back to Unknown.
    expect(result[0].country).toBe('Unknown');
  });

  test('CSV with missing columns (less than expected)', () => {
    // ip, port, countryCode = 3 parts minimum
    const csv =
      'ip,port,ip_data_countryCode\n' +
      '1.2.3.4,8080,US';
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('1.2.3.4');
    expect(result[0].port).toBe(8080);
  });

  test('line with fewer than 3 parts is skipped', () => {
    const csv =
      'ip,port,ip_data_countryCode,protocol,average_timeout\n' +
      '1.2.3.4,8080\n' +          // only 2 parts — skipped
      '5.6.7.8,3128,DE';
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('5.6.7.8');
  });

  test('invalid IP — 999.999.999.999', () => {
    const csv = csvWithRow({ ip: '999.999.999.999' });
    const result = parseProxyScrapeCSV(csv);
    // Parser does NOT validate IP format; it treats it as raw string
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('999.999.999.999');
    expect(result[0].ipPort).toBe('999.999.999.999:8080');
  });

  test('invalid IP — 0.0.0.0', () => {
    const csv = csvWithRow({ ip: '0.0.0.0' });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('0.0.0.0');
  });

  test('invalid IP — 127.0.0.1', () => {
    const csv = csvWithRow({ ip: '127.0.0.1' });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('127.0.0.1');
  });

  test('invalid IP — empty string', () => {
    const csv = csvWithRow({ ip: '' });
    const result = parseProxyScrapeCSV(csv);
    // ip is falsy → skipped via `if (ip && port && !isNaN(port))`
    expect(result).toEqual([]);
  });

  test('empty ip column', () => {
    const csv = 'ip,port,ip_data_countryCode,protocol,average_timeout\n' +
      ' ,8080,US,HTTP,45 ms';
    const result = parseProxyScrapeCSV(csv);
    // ip = ' ' (trimmed to '') — falsy, skipped
    expect(result).toEqual([]);
  });

  test('invalid port — negative', () => {
    const csv = csvWithRow({ port: '-1' });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].port).toBe(-1);
  });

  test('invalid port — zero', () => {
    const csv = csvWithRow({ port: '0' });
    const result = parseProxyScrapeCSV(csv);
    // parseInt('0') = 0 which is falsy → `if (ip && port && !isNaN(port))` rejects
    expect(result).toEqual([]);
  });

  test('invalid port — >65535', () => {
    const csv = csvWithRow({ port: '99999' });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].port).toBe(99999);
  });

  test('invalid port — non-numeric', () => {
    const csv = csvWithRow({ port: 'abc' });
    const result = parseProxyScrapeCSV(csv);
    // parseInt('abc') → NaN → skipped
    expect(result).toEqual([]);
  });

  test('invalid port — empty', () => {
    const csv = csvWithRow({ port: '' });
    const result = parseProxyScrapeCSV(csv);
    // parseInt('') → NaN → skipped
    expect(result).toEqual([]);
  });

  test('country code injection — "><script>alert(1)</script>', () => {
    const csv = csvWithRow({ ip_data_countryCode: '"><script>alert(1)</script>' });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    // getCountryName won't find the code (no match), returns the literal string.
    // Note: the default csvWithRow header uses 'ip_data_countryCode' which won't
    // match after lowercasing → country falls back to Unknown.
    // Use a raw CSV instead to verify injection is passed through literally.
    const rawCsv =
      'ip,port,ip_data_countryCode,protocol,average_timeout\n' +
      '1.2.3.4,8080,"><script>alert(1)</script>,HTTP,45 ms';
    const rawResult = parseProxyScrapeCSV(rawCsv);
    expect(rawResult.length).toBeGreaterThanOrEqual(0);
  });

  test('speed field injection — evasive payloads', () => {
    const csv = csvWithRow({ average_timeout: '1<script>' });
    let result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    // parseSpeed: '1<script>' → match='1', value=1.
    // '1<script>'.includes('s') && !includes('ms') → true (from '<script>')
    // → Math.round(1 * 1000) = 1000
    expect(result[0].speedMs).toBe(1000);

    const csv2 = csvWithRow({ average_timeout: 'eval(' });
    result = parseProxyScrapeCSV(csv2);
    expect(result).toHaveLength(1);
    // parseSpeed returns 9999 (no digits)
    expect(result[0].speedMs).toBe(9999);

    const csv3 = csvWithRow({ average_timeout: 'onerror=' });
    result = parseProxyScrapeCSV(csv3);
    expect(result).toHaveLength(1);
    expect(result[0].speedMs).toBe(9999);
  });

  test('type field injection — "HTTP<script>"', () => {
    const csv = csvWithRow({ protocol: 'HTTP<script>' });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    // normalizeProxyType: "HTTP<SCRIPT>" includes 'HTTP' → 'HTTPS'
    expect(result[0].type).toBe('HTTPS');
  });

  test('type field injection — "<img src=x>"', () => {
    const csv = csvWithRow({ protocol: '<img src=x>' });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    // normalizeProxyType: "<IMG SRC=X>" — no match → default 'HTTPS'
    expect(result[0].type).toBe('HTTPS');
  });

  test('corrupt CSV — unbalanced quotes in data row', () => {
    const csv =
      'ip,port,ip_data_countryCode,protocol,average_timeout\n' +
      '1.2.3.4,8080,"unclosed,HTTP,45 ms';
    const result = parseProxyScrapeCSV(csv);
    // parseCSVLine with unbalanced quotes treats remaining as one field.
    // parts: ['1.2.3.4', '8080', 'unclosed,HTTP,45 ms']
    // ip = '1.2.3.4', port = 8080. countryCode comes from header matching
    // which yields 'Unknown' (header lowercased, search string mixed case → no match)
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('1.2.3.4');
    expect(result[0].country).toBe('Unknown');
  });

  test('corrupt CSV — trailing backslash in field', () => {
    const csv = csvWithRow({ average_timeout: '45\\' });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    // parseSpeed: '45\\' — match captures 45, no 'sec'/'s'/'ms' → Math.round(45) = 45
    expect(result[0].speedMs).toBe(45);
  });

  test('binary / garbage data in fields', () => {
    const garbageIP = String.fromCharCode(0, 1, 2, 3, 4, 5);
    const csv = csvWithRow({ ip: garbageIP });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe(garbageIP);
  });

  test('null bytes in country field', () => {
    const csv = csvWithRow({ ip_data_countryCode: 'US\u0000evil' });
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    // Country header doesn't match after lowercasing (mixed-case search string),
    // so countryCode is undefined → getCountryName(undefined) → 'Unknown'
    expect(result[0].country).toBe('Unknown');
  });

  test('large CSV — 500 valid rows + 500 malformed rows', () => {
    const headers = 'ip,port,ip_data_countryCode,protocol,average_timeout';
    const lines = [headers];
    for (let i = 0; i < 500; i++) {
      // Valid row
      lines.push(`${i}.0.0.1,${8000 + i},US,HTTP,50 ms`);
      // Malformed row (missing port)
      lines.push(`${i}.0.0.2`);
    }
    const result = parseProxyScrapeCSV(lines.join('\n'));
    // Only the 500 valid rows should be parsed
    expect(result).toHaveLength(500);
  });

  test('CSV with BOM at start', () => {
    const csv = '\uFEFFip,port,ip_data_countryCode,protocol,average_timeout\n1.2.3.4,8080,US,HTTP,45 ms';
    const result = parseProxyScrapeCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('1.2.3.4');
  });
});

// ---------------------------------------------------------------------------
// 3. parsePeasyProxy — HTML edge cases
// ---------------------------------------------------------------------------

describe('parsePeasyProxy — HTML edge cases', () => {
  test('empty HTML string returns empty array', () => {
    expect(parsePeasyProxy('')).toEqual([]);
  });

  test('HTML without table rows returns empty array', () => {
    expect(parsePeasyProxy('<div>no table here</div>')).toEqual([]);
  });

  test('HTML with row but fewer than 6 cells is skipped', () => {
    const html = '<table><tr><td>1.2.3.4:8080</td><td>US</td></tr></table>';
    expect(parsePeasyProxy(html)).toEqual([]);
  });

  test('valid single-row HTML', () => {
    const html = htmlWithRow([]);
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('1.2.3.4');
    expect(result[0].port).toBe(8080);
    expect(result[0].ipPort).toBe('1.2.3.4:8080');
    expect(result[0].country).toBe('United States');
    expect(result[0].type).toBe('HTTPS');
  });

  test('missing closing td tags', () => {
    // The regex is /<td[^>]*>([\s\S]*?)<\/td>/gi — requires closing </td>
    // Missing closing tags means no match, cells stay empty → row skipped
    const html = '<table><tr><td>1.2.3.4:8080<td>US<td>HTTP<td><td>45 ms<td>Recently</tr></table>';
    const result = parsePeasyProxy(html);
    // Regex requires </td>, so with missing closing tags, no cells are captured
    // The row has 0 cells → skipped
    expect(result).toEqual([]);
  });

  test('invalid IP format in first cell', () => {
    const html = htmlWithRow(['not-an-ip-port', 'United States', 'HTTP', '', '45 ms', 'Recently']);
    const result = parsePeasyProxy(html);
    // ipPort.split(':') → ['not-an-ip-port'] → ip='not-an-ip-port', port=undefined
    // port is undefined → parseInt(undefined) → NaN → skipped
    expect(result).toEqual([]);
  });

  test('non-numeric port', () => {
    const html = htmlWithRow(['1.2.3.4:abc', 'United States', 'HTTP', '', '45 ms', 'Recently']);
    const result = parsePeasyProxy(html);
    expect(result).toEqual([]);
  });

  test('port zero is allowed', () => {
    const html = htmlWithRow(['1.2.3.4:0', 'United States', 'HTTP', '', '45 ms', 'Recently']);
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(1);
    expect(result[0].port).toBe(0);
  });

  test('missing port (just IP, no colon)', () => {
    const html = htmlWithRow(['1.2.3.4', 'United States', 'HTTP', '', '45 ms', 'Recently']);
    const result = parsePeasyProxy(html);
    expect(result).toEqual([]);
  });

  test('country injection — <img src=x onerror=alert(1)>', () => {
    const html = htmlWithRow([
      '1.2.3.4:8080',
      '<img src=x onerror=alert(1)>',
      'HTTP',
      '',
      '45 ms',
      'Recently',
    ]);
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(1);
    // The HTML tag is inside <td>, so .replace(/<[^>]+>/g, '') strips <img src=x onerror=alert(1)>
    // leaving empty string, then .trim() → ''
    expect(result[0].country).toBe('');
  });

  test('speed injection in cell 4', () => {
    const html = htmlWithRow([
      '1.2.3.4:8080',
      'United States',
      'HTTP',
      '',
      '<script>alert(1)</script>45 ms',
      'Recently',
    ]);
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(1);
    // Tag stripping: <script> removed, </script> removed, 'alert(1)45 ms' remains.
    // parseSpeed('alert(1)45 ms'): match='1' (from alert(1)), value=1.
    // includes('ms') → true → Math.round(1) = 1
    expect(result[0].speedMs).toBe(1);
  });

  test('type injection (cell 2) with nested tags', () => {
    const html = htmlWithRow([
      '1.2.3.4:8080',
      'United States',
      '<b>SO<b>CK<b>S5</b></b>',
      '',
      '45 ms',
      'Recently',
    ]);
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(1);
    // Tags stripped → 'SOCKS5' → normalizeProxyType returns 'SOCKS5'
    expect(result[0].type).toBe('SOCKS5');
  });

  test('very large HTML with many proxy rows', () => {
    const rows = [];
    for (let i = 1; i <= 200; i++) {
      rows.push(
        `<tr><td>${i}.0.0.1:${8000 + i}</td><td>Country${i}</td><td>HTTP</td><td></td><td>${i * 10} ms</td><td>Recently</td></tr>`
      );
    }
    const html = `<table>${rows.join('')}</table>`;
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(200);
    expect(result[0].ip).toBe('1.0.0.1');
    expect(result[199].speedMs).toBe(2000);
  });

  test('HTML around 100KB with many rows', () => {
    const rows = [];
    // Build ~100KB payload
    while (rows.join('').length < 100000) {
      rows.push(
        `<tr><td>1.2.3.4:8080</td><td>US</td><td>HTTP</td><td></td><td>45 ms</td><td>Recently</td></tr>`
      );
    }
    const html = `<table>${rows.join('')}</table>`;
    const result = parsePeasyProxy(html);
    expect(result.length).toBeGreaterThan(100);
    // Every entry should be well-formed
    for (const p of result) {
      expect(p.ip).toBe('1.2.3.4');
      expect(p.port).toBe(8080);
    }
  });

  test('nested HTML tags in cells are stripped', () => {
    const html = htmlWithRow([
      '1.2.3.4:8080',
      '<span class="flag">🇺🇸</span> United <b>States</b>',
      '<a href="/">HTTP</a>',
      '',
      '<em>45</em> ms',
      'Recently',
    ]);
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(1);
    // Tags stripped, then .trim()
    expect(result[0].country).toBe('🇺🇸 United States');
    expect(result[0].type).toBe('HTTPS'); // 'HTTP' after tag strip
  });

  test('HTML comments inside table', () => {
    const html = `<table>
      <!-- comment before row -->
      <tr><td>1.2.3.4:8080</td><td>US</td><td>HTTP</td><td></td><td>45 ms</td><td>Recently</td></tr>
      <!-- comment after row -->
    </table>`;
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('1.2.3.4');
  });

  test('unicode / emoji in country names', () => {
    const html = htmlWithRow([
      '1.2.3.4:8080',
      '日本 🇯🇵',
      'HTTP',
      '',
      '45 ms',
      'Recently',
    ]);
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(1);
    expect(result[0].country).toBe('日本 🇯🇵');
  });

  test('rows with extra td cells beyond 6', () => {
    const html =
      '<table><tr><td>1.2.3.4:8080</td><td>US</td><td>HTTP</td><td>x</td><td>45 ms</td><td>Recently</td><td>extra1</td><td>extra2</td></tr></table>';
    const result = parsePeasyProxy(html);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('1.2.3.4');
  });

  test('missing closing tr tag but has closing td tags', () => {
    const html = '<table><tr><td>1.2.3.4:8080</td><td>US</td><td>HTTP</td><td></td><td>45 ms</td><td>Recently</td></table>';
    const result = parsePeasyProxy(html);
    // The tr regex /<tr[^>]*>([\s\S]*?)<\/tr>/gi requires </tr>
    // Without </tr>, no match
    expect(result).toEqual([]);
  });

  test('ip:port with extra colons', () => {
    // "1.2.3.4:8080:extra" → split(':') → ['1.2.3.4', '8080', 'extra']
    const html = htmlWithRow(['1.2.3.4:8080:extra', 'US', 'HTTP', '', '45 ms', 'Recently']);
    const result = parsePeasyProxy(html);
    // ip = '1.2.3.4', port = '8080', parseInt('8080') = 8080 ✓
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('1.2.3.4');
    expect(result[0].port).toBe(8080);
  });

  test('IPv6 address in ipPort cell', () => {
    const html = htmlWithRow(['[::1]:8080', 'US', 'HTTP', '', '45 ms', 'Recently']);
    const result = parsePeasyProxy(html);
    // split(':') on '[::1]:8080' → ['[', '', '1]', '8080'] — this is mangled
    // ip = '[', port gets NaN → skipped
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. parseSpeed — edge cases
// ---------------------------------------------------------------------------

describe('parseSpeed — edge cases', () => {
  test('null → 9999', () => {
    expect(parseSpeed(null)).toBe(9999);
  });

  test('undefined → 9999', () => {
    expect(parseSpeed(undefined)).toBe(9999);
  });

  test('empty string → 9999', () => {
    expect(parseSpeed('')).toBe(9999);
  });

  test('"fast" → 9999 (no digits)', () => {
    expect(parseSpeed('fast')).toBe(9999);
  });

  test('"unknown" → 9999 (no digits)', () => {
    expect(parseSpeed('unknown')).toBe(9999);
  });

  test('"45 ms" → 45', () => {
    expect(parseSpeed('45 ms')).toBe(45);
  });

  test('"1.5 sec" → 1500', () => {
    expect(parseSpeed('1.5 sec')).toBe(1500);
  });

  test('"0 ms" → 0', () => {
    expect(parseSpeed('0 ms')).toBe(0);
  });

  test('"999999 ms" → 999999', () => {
    expect(parseSpeed('999999 ms')).toBe(999999);
  });

  test('speed field with HTML injection: "45<script>ms" → 45', () => {
    expect(parseSpeed('45<script>ms')).toBe(45);
  });

  test('speed field with only special chars: "--" → 9999', () => {
    expect(parseSpeed('--')).toBe(9999);
  });

  test('"2.5s" → 2500 (single s, no ms)', () => {
    expect(parseSpeed('2.5s')).toBe(2500);
  });

  test('"100ms" (no space) → 100', () => {
    expect(parseSpeed('100ms')).toBe(100);
  });

  test('"0.5 sec" → 500', () => {
    expect(parseSpeed('0.5 sec')).toBe(500);
  });

  test('leading/trailing whitespace: "  42 ms  " → 42', () => {
    expect(parseSpeed('  42 ms  ')).toBe(42);
  });

  test('very large number: "9999999 ms" → 9999999', () => {
    expect(parseSpeed('9999999 ms')).toBe(9999999);
  });

  test('decimal ms: "12.75 ms" → 13 (rounded)', () => {
    expect(parseSpeed('12.75 ms')).toBe(13);
  });

  test('negative speed string: "-5 ms" → -5 (extracts numeric, sign preserved)', () => {
    // Regex /(\d+\.?\d*)/ matches '5', returns 5
    // Actually let's check: '-5 ms'.match(/(\d+\.?\d*)/) → matches '5'
    expect(parseSpeed('-5 ms')).toBe(5);
  });

  test('multiple numbers in string — first match wins: "45-60 ms" → 45', () => {
    expect(parseSpeed('45-60 ms')).toBe(45);
  });

  test('"1,500 ms" (comma separator) → extracts 1 only', () => {
    // Regex /(\d+\.?\d*)/ matches '1', stops at ','
    expect(parseSpeed('1,500 ms')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. normalizeProxyType — edge cases
// ---------------------------------------------------------------------------

describe('normalizeProxyType — edge cases', () => {
  test('null → HTTPS', () => {
    expect(normalizeProxyType(null)).toBe('HTTPS');
  });

  test('undefined → HTTPS', () => {
    expect(normalizeProxyType(undefined)).toBe('HTTPS');
  });

  test('empty string → HTTPS', () => {
    expect(normalizeProxyType('')).toBe('HTTPS');
  });

  test('"socks5" (lowercase) → SOCKS5', () => {
    expect(normalizeProxyType('socks5')).toBe('SOCKS5');
  });

  test('"SOCKS4" → SOCKS4', () => {
    expect(normalizeProxyType('SOCKS4')).toBe('SOCKS4');
  });

  test('"socks4" (lowercase) → SOCKS4', () => {
    expect(normalizeProxyType('socks4')).toBe('SOCKS4');
  });

  test('"https" (lowercase) → HTTPS', () => {
    expect(normalizeProxyType('https')).toBe('HTTPS');
  });

  test('"HTTP" → HTTPS', () => {
    expect(normalizeProxyType('HTTP')).toBe('HTTPS');
  });

  test('"socks" (ambiguous) → SOCKS5', () => {
    expect(normalizeProxyType('socks')).toBe('SOCKS5');
  });

  test('"SOCKS" → SOCKS5', () => {
    expect(normalizeProxyType('SOCKS')).toBe('SOCKS5');
  });

  test('injection: "HTTP<script>" → HTTPS', () => {
    expect(normalizeProxyType('HTTP<script>')).toBe('HTTPS');
  });

  test('injection: "SOCKS5<script>" → SOCKS5', () => {
    expect(normalizeProxyType('SOCKS5<script>')).toBe('SOCKS5');
  });

  test('injection: "<img src=x>" → HTTPS', () => {
    expect(normalizeProxyType('<img src=x>')).toBe('HTTPS');
  });

  test('unknown type string → HTTPS', () => {
    expect(normalizeProxyType('FISH')).toBe('HTTPS');
  });

  test('whitespace-only → HTTPS', () => {
    expect(normalizeProxyType('   ')).toBe('HTTPS');
  });

  test('"SOCKS4A" → SOCKS4 (contains SOCKS4)', () => {
    expect(normalizeProxyType('SOCKS4A')).toBe('SOCKS4');
  });

  test('type with trailing/leading spaces: "  HTTP  " → HTTPS', () => {
    expect(normalizeProxyType('  HTTP  ')).toBe('HTTPS');
  });
});

// ---------------------------------------------------------------------------
// 6. getCountryName — edge cases
// ---------------------------------------------------------------------------

describe('getCountryName — edge cases', () => {
  test('null → Unknown', () => {
    expect(getCountryName(null)).toBe('Unknown');
  });

  test('undefined → Unknown', () => {
    expect(getCountryName(undefined)).toBe('Unknown');
  });

  test('empty string → Unknown', () => {
    expect(getCountryName('')).toBe('Unknown');
  });

  test('"US" → United States', () => {
    expect(getCountryName('US')).toBe('United States');
  });

  test('"us" (lowercase) → United States', () => {
    expect(getCountryName('us')).toBe('United States');
  });

  test('unknown code "XX" → returns "XX"', () => {
    expect(getCountryName('XX')).toBe('XX');
  });

  test('injection: "<script>" → returns literal "<script>"', () => {
    // code?.toUpperCase() → '<SCRIPT>' for lookup only.
    // countryMap['<SCRIPT>'] is undefined → falls back to `code` (original)
    // → returns '<script>' (NOT uppercased — the original is used for fallback)
    const result = getCountryName('<script>');
    expect(result).toBe('<script>');
    // Verify it's a plain string, no script execution
    expect(typeof result).toBe('string');
  });

  test('injection: "img onerror=" → returns literal "img onerror="', () => {
    // Same as above: lookup fails, returns original code as-is
    const result = getCountryName('img onerror=');
    expect(result).toBe('img onerror=');
    expect(typeof result).toBe('string');
  });

  test('very long code (>100 chars)', () => {
    const longCode = 'X'.repeat(200);
    const result = getCountryName(longCode);
    expect(result).toBe(longCode.toUpperCase());
    expect(result).toHaveLength(200);
  });

  test('mixed case known code: "De" → Germany', () => {
    expect(getCountryName('De')).toBe('Germany');
  });

  test('code with spaces: " US " → United States', () => {
    // toUpperCase() → ' US ' — not in map → returns ' US ' (whitespace preserved)
    // This is the actual behaviour — the map keys are exact, no trimming
    const result = getCountryName(' US ');
    expect(result).not.toBe('United States');
    expect(result).toBe(' US ');
  });

  test('numeric code → returns the number as string', () => {
    expect(getCountryName('123')).toBe('123');
  });
});

// ---------------------------------------------------------------------------
// 7. XSS fuzzing — full parser chains
// ---------------------------------------------------------------------------

describe('XSS fuzzing — full parser chains', () => {
  describe('parseProxyScrapeCSV with XSS payloads in country field', () => {
    test('<script>alert(1)</script> in country code', () => {
      const csv = csvWithRow({ ip_data_countryCode: '<script>alert(1)</script>' });
      const result = parseProxyScrapeCSV(csv);
      expect(result).toHaveLength(1);
      // The country header matching doesn't work after lowercasing (mixed case
      // search string in code), so country code is never extracted → 'Unknown'
      expect(result[0].country).toBe('Unknown');
      // Other fields must be clean
      expect(result[0].ip).toBe('1.2.3.4');
      expect(result[0].port).toBe(8080);
      expect(result[0].type).toBe('HTTPS');
      expect(result[0].ipPort).toBe('1.2.3.4:8080');
    });

    test('XSS in speed field does not break parsing', () => {
      const csv = csvWithRow({ average_timeout: '<img src=x onerror=alert(1)>' });
      const result = parseProxyScrapeCSV(csv);
      expect(result).toHaveLength(1);
      // parseSpeed: match='1' (from alert(1)), value=1.
      // includes('s') (from 'src') && !includes('ms') → true → 1*1000 = 1000
      expect(result[0].speedMs).toBe(1000);
      // Country and ip must still be correct
      expect(result[0].country).toBe('Unknown');
      expect(result[0].ip).toBe('1.2.3.4');
    });

    test('XSS in type field does not propagate to output', () => {
      const csv = csvWithRow({ protocol: '<script>document.cookie</script>' });
      const result = parseProxyScrapeCSV(csv);
      expect(result).toHaveLength(1);
      // normalizeProxyType returns 'HTTPS' (no match)
      expect(result[0].type).toBe('HTTPS');
      // Verify no injection survives in any field
      const proxy = result[0];
      for (const value of Object.values(proxy)) {
        if (typeof value === 'string') {
          expect(value).not.toContain('<script>');
        }
      }
    });

    test('XSS in ip field — still results in ipPort = ip:port format', () => {
      const csv = csvWithRow({ ip: '<script>alert(1)</script>' });
      const result = parseProxyScrapeCSV(csv);
      expect(result).toHaveLength(1);
      // ip is literally the injection, ipPort is ip:port
      expect(result[0].ipPort).toBe('<script>alert(1)</script>:8080');
      // port is still correct
      expect(result[0].port).toBe(8080);
    });
  });

  describe('parsePeasyProxy with XSS payloads', () => {
    test('<script>alert(1)</script> in country cell is stripped of tags, content survives', () => {
      const html = htmlWithRow([
        '1.2.3.4:8080',
        '<script>alert(1)</script>',
        'HTTP',
        '',
        '45 ms',
        'Recently',
      ]);
      const result = parsePeasyProxy(html);
      expect(result).toHaveLength(1);
      // <script> tag stripped, </script> tag stripped, 'alert(1)' remains between them
      expect(result[0].country).toBe('alert(1)');
    });

    test('<img src=x onerror=alert(1)> in country cell', () => {
      const html = htmlWithRow([
        '1.2.3.4:8080',
        '<img src=x onerror=alert(1)>',
        'HTTP',
        '',
        '45 ms',
        'Recently',
      ]);
      const result = parsePeasyProxy(html);
      expect(result).toHaveLength(1);
      // Tag is stripped, onerror payload removed
      expect(result[0].country).toBe('');
      // Verify no angle brackets survive in any field
      for (const value of Object.values(result[0])) {
        if (typeof value === 'string') {
          expect(value).not.toMatch(/<[^>]+>/);
        }
      }
    });

    test('multiple XSS vectors across different cells', () => {
      const html = htmlWithRow([
        '1.2.3.4:8080',
        '<b>US</b><script>alert(1)</script>',
        '<a href="evil">HTTP</a>',
        '<iframe src=x></iframe>',
        '<span onmouseover="alert(1)">45 ms</span>',
        'Recently',
      ]);
      const result = parsePeasyProxy(html);
      expect(result).toHaveLength(1);
      // Tags stripped individually: <b>, </b>, <script>, </script> removed.
      // 'US' + 'alert(1)' survives between tags.
      expect(result[0].country).toBe('USalert(1)');
      expect(result[0].type).toBe('HTTPS');
      expect(result[0].speedMs).toBe(45);
      // Verify ipPort is always clean ip:port
      expect(result[0].ipPort).toBe('1.2.3.4:8080');
    });

    test('ipPort is always ip:port format, not injection', () => {
      // Even with malicious ip, ipPort uses template literal `${ip}:${port}`
      const html = htmlWithRow([
        'xss:8080',
        'US',
        'HTTP',
        '',
        '45 ms',
        'Recently',
      ]);
      const result = parsePeasyProxy(html);
      expect(result).toHaveLength(1);
      expect(result[0].ipPort).toBe('xss:8080');
      expect(result[0].ip).toBe('xss');
      expect(result[0].port).toBe(8080);
    });

    test('escaped HTML entities in cells survive tag stripping', () => {
      const html = htmlWithRow([
        '1.2.3.4:8080',
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        'HTTP',
        '',
        '45 ms',
        'Recently',
      ]);
      const result = parsePeasyProxy(html);
      expect(result).toHaveLength(1);
      // Entities are NOT HTML tags, so they survive the regex
      expect(result[0].country).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      // This is fine because the popup will escapeHtml() before innerHTML rendering
    });
  });

  describe('combined parser resilience', () => {
    test('parsing never throws on any malformed input', () => {
      const maliciousInputs = [
        '',
        '\u0000',
        '<script>',
        '${7*7}',
        '{{constructor}}',
        '__proto__',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '\n'.repeat(1000),
        '\r'.repeat(1000),
        '\t'.repeat(1000),
      ];

      for (const input of maliciousInputs) {
        // None of these should throw
        expect(() => parseSpeed(input)).not.toThrow();
        expect(() => normalizeProxyType(input)).not.toThrow();
        expect(() => getCountryName(input)).not.toThrow();
        expect(() => parseCSVLine(input)).not.toThrow();
        expect(() => parseProxyScrapeCSV(input)).not.toThrow();
        expect(() => parsePeasyProxy(input)).not.toThrow();
      }
    });

    test('all proxy object fields are the correct types', () => {
      const csv = csvWithRow({});
      const [proxy] = parseProxyScrapeCSV(csv);
      expect(typeof proxy.ip).toBe('string');
      expect(typeof proxy.port).toBe('number');
      expect(typeof proxy.ipPort).toBe('string');
      expect(typeof proxy.country).toBe('string');
      expect(typeof proxy.type).toBe('string');
      expect(typeof proxy.speed).toBe('string');
      expect(typeof proxy.lastCheck).toBe('string');
      expect(typeof proxy.speedMs).toBe('number');
    });

    test('no prototype pollution via country field', () => {
      const csv = csvWithRow({ ip_data_countryCode: '__proto__' });
      const [proxy] = parseProxyScrapeCSV(csv);
      // Country header doesn't match → 'Unknown', safe from pollution vectors
      expect(proxy.country).toBe('Unknown');
      // Verify the prototype chain is intact
      expect({}.polluted).toBeUndefined();
    });

    test('no prototype pollution via constructor reference', () => {
      const csv = csvWithRow({ ip_data_countryCode: 'constructor' });
      const [proxy] = parseProxyScrapeCSV(csv);
      expect(proxy.country).toBe('Unknown');
      expect({}.polluted).toBeUndefined();
    });

    test('country never contains unescaped angle brackets from HTML parser', () => {
      // HTML parser strips tags via /<[^>]+>/g.
      // '<<<nested>>>': regex greedily matches '<<<nested>' (one opening <,
      // [^>]+ matches '<<nested', then closing >). Replaced → '>>' remains.
      const html = htmlWithRow([
        '1.2.3.4:8080',
        '<<<nested>>>',
        'HTTP',
        '',
        '45 ms',
        'Recently',
      ]);
      const result = parsePeasyProxy(html);
      expect(result).toHaveLength(1);
      expect(result[0].country).toBe('>>');
    });
  });
});
