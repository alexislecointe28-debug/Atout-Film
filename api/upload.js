export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, files, indexHtml, indexSha } = req.body;

  // Auth par mot de passe
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  const TOKEN = process.env.GITHUB_TOKEN;
  const REPO = process.env.GITHUB_REPO || 'alexislecointe28-debug/Atout-Film';

  if (!TOKEN) return res.status(500).json({ error: 'Token GitHub non configuré' });

  const results = [];

  // 1. Uploader les fichiers images
  for (const file of (files || [])) {
    try {
      // Récupérer le SHA actuel si le fichier existe
      let sha = null;
      try {
        const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${file.path}`, {
          headers: { Authorization: `token ${TOKEN}` }
        });
        if (r.ok) sha = (await r.json()).sha;
      } catch(e) {}

      const body = { message: `photo: update ${file.path}`, content: file.b64 };
      if (sha) body.sha = sha;

      const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${file.path}`, {
        method: 'PUT',
        headers: { Authorization: `token ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      results.push({ path: file.path, ok: !!d.commit, error: d.message });
    } catch(e) {
      results.push({ path: file.path, ok: false, error: e.message });
    }
  }

  // 2. Mettre à jour index.html si fourni
  if (indexHtml && indexSha) {
    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(indexHtml);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.slice(i, i + 8192));
      }
      // Node.js n'a pas btoa — utiliser Buffer
      const b64 = Buffer.from(indexHtml, 'utf-8').toString('base64');

      const r = await fetch(`https://api.github.com/repos/${REPO}/contents/index.html`, {
        method: 'PUT',
        headers: { Authorization: `token ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'seo: update image alt attributes', content: b64, sha: indexSha })
      });
      const d = await r.json();
      results.push({ path: 'index.html', ok: !!d.commit, error: d.message });
    } catch(e) {
      results.push({ path: 'index.html', ok: false, error: e.message });
    }
  }

  const allOk = results.every(r => r.ok);
  return res.status(allOk ? 200 : 207).json({ results });
}
