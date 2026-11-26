import assert from 'node:assert/strict';

// Invoke through CUA after an authenticated route and its records have loaded.
// This checks rendered CSS, including parent inheritance and responsive overrides.
// Official document previews have their own typography and use no portal roles.
export async function assertPortalTypography(tab) {
  const result = await tab.playwright.evaluate(() => {
    const roles = {
      'section-heading': ['18px', '800'],
      'section-label': ['14px', '800'],
      'card-label': ['12px', '600'],
      'card-value': ['12px', '700'],
      'card-description': ['12px', '500'],
      'card-caption': ['10px', '500'],
      'card-metric': ['24px', '800'],
      'form-label': ['14px', '600'],
      'form-control': ['12px', '700'],
      'data-th': ['10px', '800'],
      'data-td': ['12px', '600'],
      'data-td-strong': ['12px', '700'],
    };
    const sharedTable = {
      'data-th': ['12px', '600'],
      'data-td': ['14px', '500'],
      'data-td-strong': ['14px', '600'],
    };
    const failures = [];
    let checked = 0;
    for (const element of document.querySelectorAll(Object.keys(roles).map(role => `.${role}`).join(','))) {
      if (!element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') continue;
      const closed = element.closest('details:not([open])');
      if (closed && !closed.querySelector('summary')?.contains(element)) continue;
      const style = getComputedStyle(element);
      const role = Object.keys(roles).find(role => element.classList.contains(role));
      const [size, defaultWeight] = (element.closest('.portal-table') && sharedTable[role]) || roles[role];
      const formatted = element.getAttribute('data-typography') === 'formatted-content';
      const weight = formatted && element.classList.contains('font-black') ? '900' : defaultWeight;
      const mono = element.classList.contains('font-mono');
      const family = mono ? 'JetBrains Mono' : 'Inter';
      checked += 1;
      if (style.fontSize !== size || style.fontWeight !== weight || !style.fontFamily.includes(family)) {
        failures.push({ role, text: element.textContent.trim().slice(0, 90), expected: [size, weight, family], actual: [style.fontSize, style.fontWeight, style.fontFamily] });
      }
      if (role === 'form-control' && (style.textTransform !== 'none' || (!formatted && style.fontStyle !== 'normal'))) {
        failures.push({ role, problem: 'Control inherited uppercase or italic text', actual: [style.textTransform, style.fontStyle] });
      }
    }
    return { checked, failures, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.ok(result.checked > 0, 'Load a portal page containing typography roles before checking');
  assert.equal(result.failures.length, 0, `Rendered typography mismatches: ${JSON.stringify(result.failures)}`);
  assert.ok(result.scrollWidth <= result.width, 'Portal content must not overflow the document horizontally');
  return result;
}
