const express = require('express');
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'agent.md');
const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
const knownServices = [
  'onlysnarf',
  'instapy',
  'instagrapi',
  'tiktok_api',
  'pytube',
  'youtube_upload'
];

function parseInventory() {
  if (!manifest) return [];
  const lines = manifest.split(/\r?\n/);
  const inventory = [];

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('### ')) continue;
    const project = trimmed.replace('### ', '').trim();
    let description = '';

    for (let j = i + 1; j < lines.length; j += 1) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;
      if (nextLine.startsWith('-')) {
        description = nextLine.replace(/^-+\s*/, '').trim();
        break;
      }
      if (nextLine.startsWith('### ')) {
        break;
      }
    }

    inventory.push({ project, description });
  }

  return inventory;
}

function parseOverlaps() {
  if (!manifest) return [];
  const marker = '## Capability Overlap & Consolidation';
  const start = manifest.indexOf(marker);
  if (start === -1) return [];
  const rest = manifest.slice(start + marker.length);
  const nextSection = rest.indexOf('\n## ');
  const relevant = nextSection === -1 ? rest : rest.slice(0, nextSection);

  return relevant
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk && !chunk.startsWith('##'))
    .map((chunk) => chunk.replace(/^-+\s*/, '').trim());
}

const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.json({ service: 'agent-orchestrator', deployed: true });
});

app.get('/inventory', (_req, res) => {
  res.json({ inventory: parseInventory() });
});

app.get('/overlaps', (_req, res) => {
  res.json({ overlaps: parseOverlaps() });
});

app.get('/manifest', (_req, res) => {
  res.set('Content-Type', 'text/markdown');
  res.send(manifest);
});

app.get('/status', (_req, res) => {
  res.json({ status: 'ready', services: knownServices });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Agent orchestrator listening on port ${port}`);
});
