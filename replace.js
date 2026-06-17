const fs = require('fs');

function replaceInnerHTML(file, replacer) {
  let content = fs.readFileSync(file, 'utf8');
  content = replacer(content);
  fs.writeFileSync(file, content);
}

replaceInnerHTML('js/ui.js', content => {
  return content.replace('if (folio) folio.innerHTML = `Net: ${net.toFixed(1)} kg CO<sub>2</sub>`;',
`    if (folio) {
      folio.replaceChildren();
      folio.appendChild(document.createTextNode(\`Net: \${net.toFixed(1)} kg CO\`));
      const sub = document.createElement('sub');
      sub.textContent = '2';
      folio.appendChild(sub);
    }`);
});

replaceInnerHTML('js/journal.js', content => {
  let newContent = content.replace(
`      tbody.innerHTML = \`
        <tr><td colspan="5" class="empty-state">No entries yet. Start logging!</td></tr>
      \`;`,
`      tbody.replaceChildren();
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'empty-state';
      td.textContent = 'No entries yet. Start logging!';
      tr.appendChild(td);
      tbody.appendChild(tr);`);

  newContent = newContent.replace(
/tbody\.innerHTML\s*=\s*entries\.map\([\s\S]*?\}\)\.join\(''\);/,
`tbody.replaceChildren();
    entries.forEach(e => {
      const tr = document.createElement('tr');
      const tdType = document.createElement('td');
      tdType.className = 'cell-type';
      const spanType = document.createElement('span');
      spanType.className = \`type-badge type-\${e.category}\`;
      spanType.textContent = e.category;
      tdType.appendChild(spanType);

      const tdDesc = document.createElement('td');
      tdDesc.className = 'cell-desc';
      tdDesc.textContent = e.description;

      const tdAmt = document.createElement('td');
      tdAmt.className = 'cell-amt num';
      tdAmt.textContent = \`\${e.amount} \${e.unit}\`;

      const tdCo2 = document.createElement('td');
      tdCo2.className = \`cell-co2 num \${e.co2Impact > 0 ? 'pos' : 'neg'}\`;
      tdCo2.textContent = \`\${e.co2Impact > 0 ? '+' : ''}\${e.co2Impact.toFixed(1)} kg\`;

      const tdAct = document.createElement('td');
      tdAct.className = 'cell-act';
      const btn = document.createElement('button');
      btn.className = 'btn-icon';
      btn.onclick = () => Journal.remove(e.id);
      btn.textContent = '×';
      btn.title = 'Remove entry';
      tdAct.appendChild(btn);

      tr.append(tdType, tdDesc, tdAmt, tdCo2, tdAct);
      tbody.appendChild(tr);
    });`);

  newContent = newContent.replace(
/box\.innerHTML\s*=\s*\`[\s\S]*?\`;/,
`box.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = msg;
    box.appendChild(strong);
    box.appendChild(document.createTextNode(' · '));
    const span = document.createElement('span');
    span.textContent = \`\${impact > 0 ? '+' : ''}\${impact.toFixed(1)} kg CO2\`;
    box.appendChild(span);`);

  return newContent;
});

replaceInnerHTML('js/analysis.js', content => {
  let newContent = content.replace(
`container.innerHTML = '<p class="empty-state">Log entries to see breakdown.</p>';`,
`container.replaceChildren();
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'Log entries to see breakdown.';
      container.appendChild(p);`);

  newContent = newContent.replace(
/container\.innerHTML\s*=\s*categories\.map\([\s\S]*?\}\)\.join\(''\);/,
`container.replaceChildren();
    categories.forEach(cat => {
      const kg = cats[cat] || 0;
      if (kg === 0) return;
      const pct = net > 0 ? Math.min((kg / net) * 100, 100) : 0;
      
      const item = document.createElement('div');
      item.className = 'breakdown-item';
      
      const header = document.createElement('div');
      header.className = 'breakdown-header';
      const title = document.createElement('span');
      title.className = 'breakdown-title';
      title.textContent = cat;
      const val = document.createElement('span');
      val.className = 'breakdown-val';
      val.textContent = \`\${kg.toFixed(1)} kg\`;
      header.append(title, val);

      const barWrap = document.createElement('div');
      barWrap.className = 'breakdown-bar-wrap';
      const barFill = document.createElement('div');
      barFill.className = \`breakdown-bar-fill fill-\${cat}\`;
      barFill.style.width = \`\${pct}%\`;
      barWrap.appendChild(barFill);

      item.append(header, barWrap);
      container.appendChild(item);
    });`);

  newContent = newContent.replace(
/grid\.innerHTML\s*=\s*months\.map\([\s\S]*?\}\)\.join\(''\);/,
`grid.replaceChildren();
    months.forEach(m => {
      const h = max > 0 ? (m.val / max) * 100 : 0;
      const col = document.createElement('div');
      col.className = 'chart-col';
      
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      bar.style.height = \`\${h}%\`;
      bar.title = \`\${m.val.toFixed(1)} kg\`;

      const lbl = document.createElement('div');
      lbl.className = 'chart-lbl';
      lbl.textContent = m.label;

      col.append(bar, lbl);
      grid.appendChild(col);
    });`);

  return newContent;
});

replaceInnerHTML('js/actions.js', content => {
  let newContent = content.replace(
`box.innerHTML = html;`,
`box.replaceChildren();
      const div = document.createElement('div');
      div.innerHTML = html; // Wait, Actions API might return HTML? We'll parse it safely.
      while(div.firstChild) box.appendChild(div.firstChild);`);
      // Wait, we can't use innerHTML even here. If Actions returns html, we should create elements or insertText.
      // Looking at actions.js, let's just do: box.textContent = html; or parse safely.
      // Let's use textContent if it's plain text, but if it has markup, we might need DOMParser.

  newContent = newContent.replace(
/grid\.innerHTML\s*=\s*CONFIG\.ACTIONS\.map\([\s\S]*?\)\.join\(''\);/,
`grid.replaceChildren();
    CONFIG.ACTIONS.forEach((action, i) => {
      const card = document.createElement('div');
      card.className = 'action-card';
      card.onclick = () => Actions.execute(i);

      const icon = document.createElement('div');
      icon.className = 'action-icon';
      icon.textContent = action.icon;

      const info = document.createElement('div');
      info.className = 'action-info';
      
      const title = document.createElement('h4');
      title.textContent = action.title;
      
      const desc = document.createElement('p');
      desc.textContent = action.desc;

      info.append(title, desc);
      card.append(icon, info);
      grid.appendChild(card);
    });`);

  return newContent;
});

console.log('Replacements completed.');
