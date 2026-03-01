/**
 * Generates self-contained JS scripts from learned field selectors.
 * Scripts run in the browser (via browser-use console execution)
 * and return extracted data without needing AI interpretation.
 */

export interface FieldMeta {
  name: string;
  selector: string;
  sampleValue: string;
  type: string;
}

/**
 * Convert a (possibly jQuery-style) selector into a JS expression
 * that returns the field value as a string.
 *
 * Handles these patterns from our learned configs:
 *   1. Standard CSS:               "header h1.text-xl.font-bold"
 *   2. :contains('text'):          "button:contains('OR-1')"
 *   3. :contains('text') child:    "label:contains('Room Cleaned') input"
 *   4. :contains('text') + sibling: "p:contains('Procedure') + p"
 *   5. Standard + :nth-of-type:    "input[type='checkbox']:nth-of-type(1)"
 */
function selectorToJS(selector: string, fieldType: string): string {
  const isBoolean = fieldType === "boolean";

  // Check for :contains() pattern
  const containsMatch = selector.match(
    /^(.*?):contains\(\s*['"](.+?)['"]\s*\)\s*(.*)$/
  );

  if (containsMatch) {
    const parentSelector = containsMatch[1].trim(); // e.g. "button", "label", "p", "header span", "footer span"
    const searchText = containsMatch[2];             // e.g. "OR-1", "Room Cleaned", "Procedure"
    const rest = containsMatch[3].trim();            // e.g. "", "input", "+ p"

    const escapedParent = parentSelector.replace(/'/g, "\\'");
    const escapedText = searchText.replace(/'/g, "\\'");

    if (rest.startsWith("+ ")) {
      // Adjacent sibling: p:contains('Procedure') + p
      const siblingTag = rest.slice(2).trim().replace(/'/g, "\\'");
      return `(function(){
  try {
    var els = document.querySelectorAll('${escapedParent}');
    for (var i = 0; i < els.length; i++) {
      if (els[i].textContent && els[i].textContent.indexOf('${escapedText}') !== -1) {
        var sib = els[i].nextElementSibling;
        if (sib && sib.matches('${siblingTag}')) return sib.textContent.trim();
      }
    }
  } catch(e) {}
  return '';
})()`;
    }

    if (rest) {
      // Child selector: label:contains('Room Cleaned') input
      const childSelector = rest.replace(/'/g, "\\'");
      if (isBoolean) {
        return `(function(){
  try {
    var els = document.querySelectorAll('${escapedParent}');
    for (var i = 0; i < els.length; i++) {
      if (els[i].textContent && els[i].textContent.indexOf('${escapedText}') !== -1) {
        var child = els[i].querySelector('${childSelector}');
        if (child) return String(child.checked);
      }
    }
  } catch(e) {}
  return 'false';
})()`;
      }
      return `(function(){
  try {
    var els = document.querySelectorAll('${escapedParent}');
    for (var i = 0; i < els.length; i++) {
      if (els[i].textContent && els[i].textContent.indexOf('${escapedText}') !== -1) {
        var child = els[i].querySelector('${childSelector}');
        if (child) return child.textContent.trim();
      }
    }
  } catch(e) {}
  return '';
})()`;
    }

    // Just :contains(), no child: button:contains('OR-1'), header span:contains('Unit:')
    return `(function(){
  try {
    var els = document.querySelectorAll('${escapedParent}');
    for (var i = 0; i < els.length; i++) {
      if (els[i].textContent && els[i].textContent.indexOf('${escapedText}') !== -1) {
        return els[i].textContent.trim();
      }
    }
  } catch(e) {}
  return '';
})()`;
  }

  // Standard CSS selector — use querySelector directly
  const escaped = selector.replace(/'/g, "\\'");
  if (isBoolean) {
    return `(function(){
  try {
    var el = document.querySelector('${escaped}');
    return el ? String(el.checked) : 'false';
  } catch(e) { return 'false'; }
})()`;
  }

  return `(function(){
  try {
    var el = document.querySelector('${escaped}');
    return el ? el.textContent.trim() : '';
  } catch(e) { return ''; }
})()`;
}

/**
 * Generate a quick-check script that returns a hash of all field values.
 * Used for rapid change detection without full extraction.
 */
export function generateQuickCheckScript(fields: FieldMeta[]): string {
  const extractors = fields.map((f) => `  vals.push(${selectorToJS(f.selector, f.type)});`);

  return `(function(){
var vals = [];
${extractors.join("\n")}
var str = vals.join('|');
var hash = 5381;
for (var i = 0; i < str.length; i++) {
  hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xFFFFFFFF;
}
return (hash >>> 0).toString(16);
})()`;
}

/**
 * Generate a full extraction script that returns all field values as JSON.
 */
export function generateFullExtractScript(fields: FieldMeta[]): string {
  const extractors = fields.map(
    (f) => `  result[${JSON.stringify(f.name)}] = ${selectorToJS(f.selector, f.type)};`
  );

  return `(function(){
var result = {};
${extractors.join("\n")}
return JSON.stringify(result);
})()`;
}
