// Lecture publique des données du site (photos, travaux, avis).
// Tout le monde peut LIRE, personne ne peut modifier d'ici.
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });
  try {
    const { blobs } = await list({ prefix: 'site-data.json', limit: 1 });
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    if (!blobs.length) return res.status(200).json({});
    const r = await fetch(blobs[0].url + '?t=' + Date.now());
    if (!r.ok) return res.status(200).json({});
    return res.status(200).json(await r.json());
  } catch (e) {
    return res.status(200).json({});
  }
}
