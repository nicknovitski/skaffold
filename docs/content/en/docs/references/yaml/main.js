import { html, render } from 'https://unpkg.com/lit-html@1.1.2/lit-html.js';
import { unsafeHTML } from 'https://unpkg.com/lit-html@1.1.2/directives/unsafe-html.js';

var version;
(async function() {
  version = document.getElementById('table').attributes['data-version'].value;
  version = version.replace('skaffold/', '');

  const response = await fetch(`/schemas/${version}.json`);
  const json = await response.json();
  const table = document.getElementById('table');

  render(html`
    ${template(json.definitions, undefined, json.anyOf[0].$ref, 0)}
  `, table);
})();

function* template(definitions, parentDefinition, ref, ident) {
  const name = ref.replace('#/definitions/', '');
  const allProperties = [];
  const seen = {};

  const properties = definitions[name].properties;
  for (const key of (definitions[name].preferredOrder || [])) {
    allProperties.push([key, properties[key]]);
    seen[key] = true;
  }

  const anyOfs = definitions[name].anyOf;
  for (const anyOf of (anyOfs || [])) {
    for (const key of (anyOf.preferredOrder || [])) {
      if (seen[key]) continue;

      allProperties.push([key, anyOf.properties[key]]);
      seen[key] = true;
    }
  }

  let index = -1;
  for (let [key, definition] of allProperties) {
    index++;

    // Key
    let required = definitions[name].required && definitions[name].required.includes(key);
    let keyClass = required ? 'key required' : 'key';

    // Value
    let value = definition.default;
    if (key === 'apiVersion') {
      value = `skaffold/${version}`;
    } else if (definition.examples && definition.examples.length > 0) {
      value = definition.examples[0];
    }
    let valueClass = definition.examples ? 'example' : 'value';

    // Description
    const desc = definition['x-intellij-html-description'];
    
    // Special case for profiles
    if ((name === 'Profile') && (key === 'build' || key === 'test' || key === 'deploy')) {
      value = '{}';
      yield html`
        <tr>
          <td>
            <span class="${keyClass}" style="margin-left: ${ident * 20}px">${key}:</span>
            <span class="${valueClass}">${value}</span>
          </td>
          <td><span class="comment">#&nbsp;</span></td>
          <td><span class="comment">${unsafeHTML(desc)}</span></td>
        </tr>
      `;
      continue;
    }

    if (definition.$ref) {
      // Check if the referenced description is a final one
      const refName = definition.$ref.replace('#/definitions/', '');
      if (!definitions[refName].properties && !definitions[refName].anyOf) {
        value = '{}';
      }

      yield html`
        <tr class="top">
          <td>
            <span class="${keyClass}" style="margin-left: ${ident * 20}px">${key}:</span>
            <span class="${valueClass}">${value}</span>
          </td>
          <td class="comment">#&nbsp;</td>
          <td class="comment">${unsafeHTML(desc)}</td>
        </tr>
      `;
    } else if (definition.items && definition.items.$ref) {
      yield html`
        <tr class="top">
          <td>
            <span class="${keyClass}" style="margin-left: ${ident * 20}px">${key}:</span>
            <span class="${valueClass}">${value}</span>
          </td>
          <td class="comment">#&nbsp;</td>
          <td class="comment">${unsafeHTML(desc)}</td>
        </tr>
      `;
    } else if (parentDefinition && (parentDefinition.type === 'array') && (index === 0)) {
      yield html`
        <tr>
          <td>
            <span class="${keyClass}" style="margin-left: ${(ident - 1) * 20}px">- ${key}:</span>
            <span class="${valueClass}">${value}</span>
          </td>
          <td class="comment">#&nbsp;</td>
          <td class="comment">${unsafeHTML(desc)}</td>
        </tr>
      `;
    } else if ((definition.type === 'array') && value && (value !== '[]')) {
      // Parse value to json array
      const values = JSON.parse(value);

      yield html`
        <tr>
          <td>
            <span class="${keyClass}" style="margin-left: ${ident * 20}px">${key}:</span>
          </td>
          <td class="comment">#&nbsp;</td>
          <td class="comment" rowspan="${1 + values.length}">
            ${unsafeHTML(desc)}
          </td>
        </tr>
      `;

      for (const v of values) {
        yield html`
          <tr>
            <td>
              <span class="key" style="margin-left: ${ident * 20}px">- <span class="${valueClass}">${v}</span></span>
            </td>
            <td class="comment">#&nbsp;</td>
          </tr>
        `;
      }
    } else if (definition.type === 'object' && value && value !== '{}') {
      // Parse value to json object
      const values = JSON.parse(value);

      yield html`
        <tr>
          <td>
            <span class="${keyClass}" style="margin-left: ${ident * 20}px">${key}:</span>
          </td>
          <td class="comment">#&nbsp;</td>
          <td class="comment" rowspan="${1 + Object.keys(values).length}">
            ${unsafeHTML(desc)}
          </td>
        </tr>
      `;

      for (const k in values) {
        if (!values.hasOwnProperty(k)) continue;
        const v = values[k];

        yield html`
          <tr>
            <td>
              <span class="key" style="margin-left: ${(ident + 1) * 20}px"><span class="${valueClass}">${k}: ${v}</span></span>
            </td>
            <td class="comment">#&nbsp;</td>
          </tr>
        `;
      }
    } else {
      yield html`
        <tr>
          <td>
            <span class="${keyClass}" style="margin-left: ${ident * 20}px">${key}:</span>
            <span class="${valueClass}">${value}</span>
          </td>
          <td class="comment">#&nbsp;</td>
          <td class="comment">${unsafeHTML(desc)}</td>
        </tr>
      `;
    }

    // This definition references another definition
    if (definition.$ref) {
      yield html`
        ${template(definitions, definition, definition.$ref, ident + 1)}
      `;
    }

    // This definition is an array
    if (definition.items && definition.items.$ref) {
      yield html`
        ${template(definitions, definition, definition.items.$ref, ident + 1)}
      `;
    }
  }
}
